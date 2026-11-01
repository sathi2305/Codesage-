import type {
  BlastRadiusReport,
  CodeAnalysisSummary,
  DependencyPathResult,
  EdgeRelationType,
  GraphEdge,
  GraphNode,
  NodeCategory,
  RelationshipCertainty,
  RepoFile,
  RepositoryGraph,
} from '../types/index.ts';
import { generateFindings } from './parser.ts';

export function isNeo4jConfigured(): boolean {
  if (typeof process === 'undefined' || !process.env) return false;
  return Boolean(
    process.env.NEO4J_URI &&
      process.env.NEO4J_URI.trim().length > 0 &&
      process.env.NEO4J_PASSWORD &&
      process.env.NEO4J_PASSWORD.trim().length > 0
  );
}

export function buildRepositoryGraph(
  repoId: string,
  repoName: string,
  isSample: boolean,
  files: RepoFile[]
): RepositoryGraph {
  const nodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeDedup = new Set<string>();

  const addNode = (
    id: string,
    label: string,
    category: NodeCategory,
    extra: Partial<GraphNode['data']> = {}
  ) => {
    if (!nodesMap.has(id)) {
      nodesMap.set(id, {
        id,
        type: 'codesageNode',
        position: { x: 0, y: 0 },
        data: {
          label,
          category,
          inDegree: 0,
          outDegree: 0,
          cypherSnippet: `MATCH (n:${category} {id: $id, repoId: $repoId}) OPTIONAL MATCH (n)-[r]-(m) RETURN n, r, m`,
          ...extra,
        },
      });
    }
  };

  const addEdge = (
    source: string,
    target: string,
    label: EdgeRelationType,
    certainty: RelationshipCertainty,
    line?: number
  ) => {
    if (source === target) return;
    if (!nodesMap.has(source) || !nodesMap.has(target)) return;
    const key = `${source}->${label}->${target}`;
    if (edgeDedup.has(key)) return;
    edgeDedup.add(key);
    edges.push({
      id: `edge-${edges.length + 1}`,
      source,
      target,
      label,
      certainty,
      line,
    });
  };

  const repoNodeId = `repo:${repoId}`;
  addNode(repoNodeId, repoName, 'Repository', {
    description: `Root repository node (${files.length} indexed files)`,
  });

  // Symbol lookup table for cross-file CALLS resolution
  const symbolByName = new Map<string, { nodeId: string; filePath: string }[]>();

  // 1. Add File, Configuration, Test, Documentation, Function, Class, APIEndpoint nodes
  for (const file of files) {
    const fileCategory: NodeCategory =
      file.fileType === 'config'
        ? 'Configuration'
        : file.fileType === 'test'
        ? 'Test'
        : file.fileType === 'docs'
        ? 'Documentation'
        : 'File';

    const fileNodeId = `file:${file.path}`;
    addNode(fileNodeId, file.name, fileCategory, {
      filePath: file.path,
      startLine: 1,
      endLine: file.lineCount,
      language: file.language,
      description: `${file.path} (${file.language}, ${file.lineCount} lines)`,
    });

    addEdge(repoNodeId, fileNodeId, 'CONTAINS', 'observed', 1);

    // Top-level symbols (limit per file so graph stays clean and navigable)
    for (const sym of file.symbols.slice(0, 8)) {
      const symCategory: NodeCategory =
        sym.kind === 'APIEndpoint'
          ? 'APIEndpoint'
          : sym.kind === 'Class'
          ? 'Class'
          : 'Function';
      const symNodeId = `sym:${sym.id}`;
      addNode(symNodeId, sym.name, symCategory, {
        filePath: file.path,
        startLine: sym.startLine,
        endLine: sym.endLine,
        language: file.language,
        signature: sym.signature,
        description: sym.docstring || sym.signature,
      });
      addEdge(fileNodeId, symNodeId, 'CONTAINS', 'observed', sym.startLine);

      const list = symbolByName.get(sym.name) || [];
      list.push({ nodeId: symNodeId, filePath: file.path });
      symbolByName.set(sym.name, list);
    }
  }

  // 2. Add IMPORTS, DEPENDS_ON, CONFIGURES, TESTS, DOCUMENTS, and CALLS relationships
  const configFiles = files.filter((f) => f.fileType === 'config');

  for (const file of files) {
    const fileNodeId = `file:${file.path}`;
    const importedPaths = new Set<string>();

    for (const imp of file.imports) {
      if (imp.resolvedPath) {
        importedPaths.add(imp.resolvedPath);
        const targetId = `file:${imp.resolvedPath}`;
        if (file.fileType === 'test') {
          addEdge(fileNodeId, targetId, 'TESTS', 'observed', imp.line);
        } else {
          addEdge(fileNodeId, targetId, 'IMPORTS', 'observed', imp.line);
        }
      } else if (imp.isExternal && file.fileType === 'source') {
        // Connect key external architecture modules (e.g. pyjwt, fastapi, redis, express)
        const notablePkg = /^(fastapi|flask|jwt|pyjwt|jose|passlib|sqlalchemy|redis|pydantic|express|jsonwebtoken|axios|prisma|neo4j)/i.test(
          imp.source
        );
        if (notablePkg) {
          const modId = `mod:${imp.source.toLowerCase()}`;
          addNode(modId, imp.source, 'Module', {
            description: `External package dependency (${imp.source})`,
          });
          addEdge(fileNodeId, modId, 'DEPENDS_ON', 'observed', imp.line);
        }
      }
    }

    // Configuration links: if source file reads env/config keys defined in a config file
    if (file.fileType === 'source' && file.configKeys.length > 0) {
      for (const cfg of configFiles) {
        const shared = cfg.configKeys.some((k) => file.configKeys.includes(k));
        if (shared && cfg.path !== file.path) {
          addEdge(`file:${cfg.path}`, fileNodeId, 'CONFIGURES', 'observed', 1);
        }
      }
    }

    // Documentation links: if docs mention a filename or symbol
    if (file.fileType === 'docs') {
      for (const other of files) {
        if (other.path === file.path) continue;
        if (file.content.includes(other.name) || file.content.includes(other.path)) {
          addEdge(fileNodeId, `file:${other.path}`, 'DOCUMENTS', 'observed', 1);
        }
      }
    }

    // Cross-file & intra-file CALLS between parsed functions/endpoints
    for (const sym of file.symbols.slice(0, 8)) {
      const callerId = `sym:${sym.id}`;
      for (const calleeName of sym.calls) {
        const candidates = symbolByName.get(calleeName);
        if (!candidates) continue;
        for (const cand of candidates) {
          if (cand.nodeId === callerId) continue;
          const isObserved =
            cand.filePath === file.path || importedPaths.has(cand.filePath);
          addEdge(
            callerId,
            cand.nodeId,
            'CALLS',
            isObserved ? 'observed' : 'inferred',
            sym.startLine
          );
        }
      }
    }

    // Cross-language REST API bridge (inferred): frontend fetch('/auth/login') -> backend APIEndpoint
    if (file.language === 'TypeScript' || file.language === 'JavaScript') {
      for (const other of files) {
        for (const ep of other.symbols.filter((s) => s.kind === 'APIEndpoint')) {
          const routeOnly = ep.name.split(' ')[1];
          if (routeOnly && routeOnly.length > 3 && file.content.includes(routeOnly)) {
            addEdge(fileNodeId, `sym:${ep.id}`, 'CALLS', 'inferred', 1);
          }
        }
      }
    }
  }

  // 3. Compute node degrees & deterministic layered radial/grid layout
  for (const edge of edges) {
    const s = nodesMap.get(edge.source);
    const t = nodesMap.get(edge.target);
    if (s) s.data.outDegree += 1;
    if (t) t.data.inDegree += 1;
  }

  const categoryColumns: Record<NodeCategory, number> = {
    Repository: 0,
    Documentation: 1,
    Configuration: 1,
    APIEndpoint: 2,
    File: 3,
    Class: 4,
    Function: 4,
    Module: 5,
    Test: 2,
  };

  const columnBuckets = new Map<number, GraphNode[]>();
  for (const node of nodesMap.values()) {
    const col = categoryColumns[node.data.category] ?? 3;
    const arr = columnBuckets.get(col) || [];
    arr.push(node);
    columnBuckets.set(col, arr);
  }

  for (const [col, bucket] of columnBuckets.entries()) {
    bucket.sort((a, b) => b.data.inDegree + b.data.outDegree - (a.data.inDegree + a.data.outDegree));
    const totalHeight = (bucket.length - 1) * 112;
    bucket.forEach((node, idx) => {
      node.position = {
        x: col * 290 + (idx % 2 === 0 ? 0 : 28),
        y: idx * 112 - totalHeight / 2 + 320,
      };
    });
  }

  const cypherPreview = [
    `MERGE (r:Repository {id: $repoId}) SET r.name = $repoName, r.indexedAt = datetime()`,
    `UNWIND $files AS f MERGE (file:File {id: f.id, repoId: $repoId}) SET file.path = f.path, file.language = f.language MERGE (r)-[:CONTAINS]->(file)`,
    `UNWIND $imports AS imp MATCH (src:File {id: imp.source, repoId: $repoId}), (dst:File {id: imp.target, repoId: $repoId}) MERGE (src)-[:IMPORTS {certainty: imp.certainty, line: imp.line}]->(dst)`,
    `UNWIND $calls AS c MATCH (caller {id: c.source, repoId: $repoId}), (callee {id: c.target, repoId: $repoId}) MERGE (caller)-[:CALLS {certainty: c.certainty}]->(callee)`,
  ];

  return {
    repoId,
    isSample,
    engineMode: isNeo4jConfigured() ? 'neo4j' : 'local_fallback',
    nodes: Array.from(nodesMap.values()),
    edges,
    cypherPreview,
  };
}

export function findShortestDependencyPath(
  files: RepoFile[],
  fromFile: string,
  toFile: string
): DependencyPathResult {
  if (fromFile === toFile) {
    return {
      fromFile,
      toFile,
      found: true,
      hops: [{ file: fromFile, relation: 'CONTAINS', certainty: 'observed', line: 1 }],
    };
  }

  const adj = new Map<
    string,
    { next: string; relation: EdgeRelationType; certainty: RelationshipCertainty; line?: number }[]
  >();

  for (const f of files) {
    const list: {
      next: string;
      relation: EdgeRelationType;
      certainty: RelationshipCertainty;
      line?: number;
    }[] = [];
    for (const imp of f.imports) {
      if (imp.resolvedPath) {
        list.push({
          next: imp.resolvedPath,
          relation: f.fileType === 'test' ? 'TESTS' : 'IMPORTS',
          certainty: 'observed',
          line: imp.line,
        });
      }
    }
    adj.set(f.path, list);
  }

  const queue: {
    current: string;
    path: { file: string; relation: EdgeRelationType; certainty: RelationshipCertainty; line?: number }[];
  }[] = [
    {
      current: fromFile,
      path: [{ file: fromFile, relation: 'CONTAINS', certainty: 'observed', line: 1 }],
    },
  ];
  const visited = new Set<string>([fromFile]);

  while (queue.length > 0) {
    const item = queue.shift()!;
    const neighbors = adj.get(item.current) || [];
    for (const nb of neighbors) {
      if (visited.has(nb.next)) continue;
      const nextPath = [
        ...item.path,
        { file: nb.next, relation: nb.relation, certainty: nb.certainty, line: nb.line },
      ];
      if (nb.next === toFile) {
        return { fromFile, toFile, found: true, hops: nextPath };
      }
      visited.add(nb.next);
      queue.push({ current: nb.next, path: nextPath });
    }
  }

  return { fromFile, toFile, found: false, hops: [] };
}

export function computeBlastRadius(files: RepoFile[], targetFile: string): BlastRadiusReport {
  const target = files.find((f) => f.path === targetFile);
  const directDependents: { file: string; line?: number; certainty: RelationshipCertainty }[] = [];
  const reverseAdj = new Map<string, string[]>();

  for (const f of files) {
    for (const imp of f.imports) {
      if (!imp.resolvedPath) continue;
      const rev = reverseAdj.get(imp.resolvedPath) || [];
      if (!rev.includes(f.path)) rev.push(f.path);
      reverseAdj.set(imp.resolvedPath, rev);

      if (imp.resolvedPath === targetFile && f.fileType !== 'test') {
        directDependents.push({ file: f.path, line: imp.line, certainty: 'observed' });
      }
    }
  }

  // BFS transitive dependents
  const visited = new Set<string>([targetFile]);
  const queue = directDependents.map((d) => d.file);
  queue.forEach((p) => visited.add(p));
  const transitiveDependents: string[] = [];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const parent of reverseAdj.get(curr) || []) {
      const parentObj = files.find((x) => x.path === parent);
      if (!visited.has(parent) && parentObj?.fileType !== 'test') {
        visited.add(parent);
        transitiveDependents.push(parent);
        queue.push(parent);
      }
    }
  }

  const affectedFilesSet = new Set<string>([
    targetFile,
    ...directDependents.map((d) => d.file),
    ...transitiveDependents,
  ]);

  const affectedEndpoints: { route: string; filePath: string; line: number }[] = [];
  for (const f of files) {
    if (!affectedFilesSet.has(f.path)) continue;
    for (const sym of f.symbols) {
      if (sym.kind === 'APIEndpoint') {
        affectedEndpoints.push({
          route: sym.name,
          filePath: f.path,
          line: sym.startLine,
        });
      }
    }
  }

  const coveringTests: { testFile: string; symbols: string[] }[] = [];
  for (const f of files.filter((x) => x.fileType === 'test')) {
    const touchesAffected = f.imports.some(
      (imp) => imp.resolvedPath && affectedFilesSet.has(imp.resolvedPath)
    );
    if (touchesAffected) {
      coveringTests.push({
        testFile: f.path,
        symbols: f.symbols.map((s) => s.name),
      });
    }
  }

  const externalPackages = (target?.imports || [])
    .filter((i) => i.isExternal)
    .map((i) => i.source);

  const totalAffected = directDependents.length + transitiveDependents.length + affectedEndpoints.length;
  const riskLevel: 'low' | 'moderate' | 'high' =
    totalAffected >= 5 ? 'high' : totalAffected >= 2 ? 'moderate' : 'low';

  const summary =
    directDependents.length === 0 && affectedEndpoints.length === 0
      ? `${targetFile} is a leaf module with 0 internal source dependents. Changes stay localized.`
      : `Modifying ${targetFile} directly affects ${directDependents.length} module(s), propagates to ${transitiveDependents.length} transitive module(s), and impacts ${affectedEndpoints.length} API endpoint(s). ${
          coveringTests.length > 0
            ? `${coveringTests.length} test suite(s) verify this path.`
            : 'No direct automated test suite references this module.'
        }`;

  return {
    targetFile,
    directDependents,
    transitiveDependents,
    affectedEndpoints,
    coveringTests,
    externalPackages,
    riskLevel,
    summary,
  };
}

export function computeCodeAnalysis(
  repoId: string,
  files: RepoFile[],
  graph: RepositoryGraph
): CodeAnalysisSummary {
  const totalLines = files.reduce((acc, f) => acc + f.lineCount, 0);
  const totalSymbols = files.reduce((acc, f) => acc + f.symbols.length, 0);
  const totalImports = files.reduce((acc, f) => acc + f.imports.length, 0);

  const langCounts = new Map<string, { files: number; lines: number }>();
  for (const f of files) {
    const entry = langCounts.get(f.language) || { files: 0, lines: 0 };
    entry.files += 1;
    entry.lines += f.lineCount;
    langCounts.set(f.language, entry);
  }

  const languages = Array.from(langCounts.entries())
    .map(([language, stats]) => ({
      language,
      files: stats.files,
      lines: stats.lines,
      percentage: totalLines > 0 ? Math.round((stats.lines / totalLines) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.lines - a.lines);

  const kindMap = new Map<string, number>();
  for (const f of files) {
    for (const s of f.symbols) {
      kindMap.set(s.kind, (kindMap.get(s.kind) || 0) + 1);
    }
  }
  const symbolBreakdown = Array.from(kindMap.entries()).map(([kind, count]) => ({ kind, count }));

  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();
  for (const n of graph.nodes) {
    inDegreeMap.set(n.id, n.data.inDegree);
    outDegreeMap.set(n.id, n.data.outDegree);
  }

  const topCoupledFiles = files
    .map((f) => ({
      filePath: f.path,
      inDegree: inDegreeMap.get(`file:${f.path}`) || 0,
      outDegree: outDegreeMap.get(`file:${f.path}`) || 0,
      lineCount: f.lineCount,
      symbolCount: f.symbols.length,
    }))
    .sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree))
    .slice(0, 10);

  // Group into clear architectural layers
  const layerDefs: { layer: string; match: (p: string, t: RepoFile['fileType']) => boolean; responsibility: string }[] = [
    {
      layer: 'API & Transport Routes',
      match: (p) => /routes|controllers|api|gateway|endpoints|server/i.test(p),
      responsibility: 'HTTP request validation, routing, authentication guards, and response serialization.',
    },
    {
      layer: 'Domain Services & Security',
      match: (p) => /auth|services|security|ledger|worker|engine|handlers/i.test(p),
      responsibility: 'Core business invariants, cryptographic token issuance, and cross-service orchestration.',
    },
    {
      layer: 'Data Models & Persistence',
      match: (p) => /models|db|schema|repositories|store/i.test(p),
      responsibility: 'Entity definitions, relational constraints, optimistic concurrency, and storage adapters.',
    },
    {
      layer: 'Frontend Client & State',
      match: (p) => /frontend|client|components|hooks|pages/i.test(p),
      responsibility: 'Browser UI components, token refresh interceptors, and API service consumers.',
    },
    {
      layer: 'Configuration, Tests & ADRs',
      match: (_p, t) => t === 'config' || t === 'test' || t === 'docs',
      responsibility: 'Environment configuration, automated verification suites, and architectural decision records.',
    },
  ];

  const assigned = new Set<string>();
  const architecturalLayers = layerDefs
    .map((def) => {
      const matched = files
        .filter((f) => !assigned.has(f.path) && def.match(f.path, f.fileType))
        .map((f) => {
          assigned.add(f.path);
          return f.path;
        });
      return {
        layer: def.layer,
        files: matched,
        responsibility: def.responsibility,
      };
    })
    .filter((l) => l.files.length > 0);

  const remaining = files.filter((f) => !assigned.has(f.path)).map((f) => f.path);
  if (remaining.length > 0) {
    architecturalLayers.push({
      layer: 'Core Application Modules',
      files: remaining,
      responsibility: 'Shared utilities, entrypoints, and foundational helpers.',
    });
  }

  return {
    repoId,
    totalFiles: files.length,
    totalLines,
    totalSymbols,
    totalImports,
    testFilesCount: files.filter((f) => f.fileType === 'test').length,
    docFilesCount: files.filter((f) => f.fileType === 'docs').length,
    configFilesCount: files.filter((f) => f.fileType === 'config').length,
    languages,
    symbolBreakdown,
    topCoupledFiles,
    architecturalLayers,
    findings: generateFindings(files, inDegreeMap),
  };
}
