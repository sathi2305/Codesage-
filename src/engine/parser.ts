import { posix as path } from './posixPath';
import type {
  CodeFinding,
  CodeSymbol,
  FileImport,
  RepoFile,
} from '../types/index.ts';

const LANGUAGE_MAP: Record<string, string> = {
  '.py': 'Python',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.go': 'Go',
  '.java': 'Java',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.sql': 'SQL',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.md': 'Markdown',
  '.rst': 'reStructuredText',
  '.txt': 'Text',
  '.css': 'CSS',
  '.html': 'HTML',
  '.sh': 'Shell',
};

export function detectLanguage(filePath: string): string {
  const base = path.posix.basename(filePath).toLowerCase();
  if (base === 'dockerfile') return 'Dockerfile';
  if (base === 'makefile') return 'Makefile';
  if (base.startsWith('.env')) return 'EnvConfig';
  if (base === 'requirements.txt') return 'PipRequirements';
  const ext = path.posix.extname(base);
  return LANGUAGE_MAP[ext] || 'Text';
}

export function classifyFileType(filePath: string): 'source' | 'config' | 'test' | 'docs' {
  const lower = filePath.toLowerCase();
  const base = path.posix.basename(lower);

  if (
    lower.endsWith('.md') ||
    lower.endsWith('.rst') ||
    lower.includes('/docs/') ||
    lower.startsWith('docs/') ||
    base.startsWith('readme') ||
    base.startsWith('adr-') ||
    base === 'architecture.txt'
  ) {
    return 'docs';
  }

  if (
    lower.includes('/tests/') ||
    lower.startsWith('tests/') ||
    lower.includes('/__tests__/') ||
    base.startsWith('test_') ||
    base.endsWith('_test.py') ||
    base.endsWith('_test.go') ||
    base.endsWith('.test.ts') ||
    base.endsWith('.test.tsx') ||
    base.endsWith('.spec.ts') ||
    base.endsWith('.spec.js')
  ) {
    return 'test';
  }

  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.toml') ||
    base === 'requirements.txt' ||
    base === 'dockerfile' ||
    base.startsWith('.env') ||
    base.includes('config') ||
    base.includes('settings')
  ) {
    if (lower.endsWith('.py') || lower.endsWith('.ts') || lower.endsWith('.js')) {
      return base === 'config.py' || base === 'settings.py' || base === 'config.ts'
        ? 'config'
        : 'source';
    }
    return 'config';
  }

  return 'source';
}

function estimateBlockEnd(lines: string[], startIndex: number, language: string): number {
  if (language === 'Python') {
    const startLine = lines[startIndex] || '';
    const baseIndent = startLine.search(/\S/);
    let lastCodeLine = startIndex;
    for (let i = startIndex + 1; i < Math.min(lines.length, startIndex + 140); i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const indent = line.search(/\S/);
      if (indent <= baseIndent && !trimmed.startsWith(')') && !trimmed.startsWith(']')) {
        break;
      }
      lastCodeLine = i;
    }
    return lastCodeLine + 1;
  }

  // Brace-delimited languages (TS/JS/Go/Java/Rust)
  let depth = 0;
  let opened = false;
  for (let i = startIndex; i < Math.min(lines.length, startIndex + 160); i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') {
        depth++;
        opened = true;
      } else if (ch === '}') {
        depth--;
        if (opened && depth <= 0) {
          return i + 1;
        }
      }
    }
  }
  return Math.min(lines.length, startIndex + 18);
}

function extractBodyCalls(lines: string[], startLine: number, endLine: number, ownName: string): string[] {
  const calls = new Set<string>();
  const slice = lines.slice(Math.max(0, startLine - 1), Math.min(lines.length, endLine)).join('\n');
  const callRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  const ignoredKeywords = new Set([
    'if',
    'for',
    'while',
    'switch',
    'catch',
    'return',
    'def',
    'class',
    'function',
    'super',
    'print',
    'len',
    'str',
    'int',
    'float',
    'dict',
    'list',
    'set',
    'isinstance',
    'getattr',
    'setattr',
    'console',
    'log',
    'Promise',
    'Array',
    'Object',
    'JSON',
    'Math',
    'Date',
    'Error',
    'Map',
    'Set',
    'require',
    'import',
  ]);

  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(slice)) !== null) {
    const fn = match[1];
    if (fn !== ownName && !ignoredKeywords.has(fn) && fn.length > 2) {
      calls.add(fn);
    }
  }
  return Array.from(calls).slice(0, 18);
}

export function parseSourceFile(filePath: string, content: string): RepoFile {
  const language = detectLanguage(filePath);
  const fileType = classifyFileType(filePath);
  const lines = content.split(/\r?\n/);
  const symbols: CodeSymbol[] = [];
  const imports: FileImport[] = [];
  const exportsList = new Set<string>();
  const configKeys = new Set<string>();

  if (language === 'Python') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Imports
      const fromImport = trimmed.match(/^from\s+([a-zA-Z0-9_.]+)\s+import\s+(.+)$/);
      if (fromImport) {
        const specs = fromImport[2]
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);
        imports.push({
          source: fromImport[1],
          specifiers: specs,
          line: i + 1,
          isExternal: !fromImport[1].startsWith('.') && !fromImport[1].startsWith('app') && !fromImport[1].startsWith('backend'),
        });
      } else {
        const plainImport = trimmed.match(/^import\s+([a-zA-Z0-9_.,\s]+)$/);
        if (plainImport) {
          for (const mod of plainImport[1].split(',').map((m) => m.trim()).filter(Boolean)) {
            const cleanMod = mod.split(/\s+as\s+/)[0].trim();
            imports.push({
              source: cleanMod,
              specifiers: [cleanMod],
              line: i + 1,
              isExternal: !cleanMod.startsWith('app') && !cleanMod.startsWith('backend'),
            });
          }
        }
      }

      // FastAPI / Flask route decorators
      const routeMatch = trimmed.match(/^@(?:app|router|bp)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/i);
      if (routeMatch) {
        const method = routeMatch[1].toUpperCase();
        const routePath = routeMatch[2];
        const endLine = estimateBlockEnd(lines, Math.min(i + 1, lines.length - 1), 'Python');
        symbols.push({
          id: `${filePath}::endpoint::${method}_${routePath}::${i + 1}`,
          name: `${method} ${routePath}`,
          kind: 'APIEndpoint',
          filePath,
          startLine: i + 1,
          endLine,
          signature: `${method} ${routePath}`,
          calls: extractBodyCalls(lines, i + 1, endLine, routePath),
        });
      }

      // Classes
      const classMatch = line.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)(\([^)]*\))?:/);
      if (classMatch) {
        const name = classMatch[1];
        const endLine = estimateBlockEnd(lines, i, 'Python');
        let docstring: string | undefined;
        const nextLine = (lines[i + 1] || '').trim();
        if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
          docstring = nextLine.replace(/^['"]{3}|['"]{3}$/g, '').trim();
        }
        symbols.push({
          id: `${filePath}::class::${name}::${i + 1}`,
          name,
          kind: 'Class',
          filePath,
          startLine: i + 1,
          endLine,
          signature: `class ${name}${classMatch[2] || ''}`,
          docstring,
          calls: extractBodyCalls(lines, i + 1, endLine, name),
        });
        exportsList.add(name);
      }

      // Functions
      const fnMatch = line.match(/^\s*(async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      if (fnMatch) {
        const isAsync = Boolean(fnMatch[1]);
        const name = fnMatch[2];
        const params = fnMatch[3].trim();
        const endLine = estimateBlockEnd(lines, i, 'Python');
        let docstring: string | undefined;
        const nextLine = (lines[i + 1] || '').trim();
        if (nextLine.startsWith('"""') || nextLine.startsWith("'''")) {
          docstring = nextLine.replace(/^['"]{3}|['"]{3}$/g, '').trim();
        }
        symbols.push({
          id: `${filePath}::fn::${name}::${i + 1}`,
          name,
          kind: 'Function',
          filePath,
          startLine: i + 1,
          endLine,
          signature: `${isAsync ? 'async ' : ''}def ${name}(${params})`,
          docstring,
          calls: extractBodyCalls(lines, i + 1, endLine, name),
        });
        if (!name.startsWith('_')) exportsList.add(name);
      }

      // Environment / Settings references
      const envMatches = line.matchAll(/(?:os\.getenv|os\.environ\.get)\(\s*['"]([A-Z0-9_]+)['"]/g);
      for (const m of envMatches) {
        configKeys.add(m[1]);
      }
      if (fileType === 'config') {
        const settingField = line.match(/^\s*([A-Z][A-Z0-9_]{2,})\s*[:=]/);
        if (settingField) configKeys.add(settingField[1]);
      }
    }
  } else if (language === 'TypeScript' || language === 'JavaScript') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // ES imports
      const esImport = trimmed.match(/^import\s+(?:type\s+)?(?:(.+?)\s+from\s+)?['"]([^'"]+)['"]/);
      if (esImport) {
        const rawSpecs = esImport[1] || '';
        const source = esImport[2];
        const specs = rawSpecs
          .replace(/[{}*]/g, '')
          .split(',')
          .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);
        imports.push({
          source,
          specifiers: specs,
          line: i + 1,
          isExternal: !source.startsWith('.') && !source.startsWith('@/') && !source.startsWith('/'),
        });
      }

      // Express / Router endpoints
      const expressRoute = trimmed.match(/\b(?:app|router)\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/);
      if (expressRoute) {
        const method = expressRoute[1].toUpperCase();
        const routePath = expressRoute[2];
        const endLine = estimateBlockEnd(lines, i, language);
        symbols.push({
          id: `${filePath}::endpoint::${method}_${routePath}::${i + 1}`,
          name: `${method} ${routePath}`,
          kind: 'APIEndpoint',
          filePath,
          startLine: i + 1,
          endLine,
          signature: `${method} ${routePath}`,
          calls: extractBodyCalls(lines, i + 1, endLine, routePath),
        });
      }

      // Classes / Interfaces
      const classOrIface = trimmed.match(/^(?:export\s+)?(?:default\s+)?(class|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (classOrIface) {
        const kindWord = classOrIface[1];
        const name = classOrIface[2];
        const endLine = estimateBlockEnd(lines, i, language);
        symbols.push({
          id: `${filePath}::class::${name}::${i + 1}`,
          name,
          kind: 'Class',
          filePath,
          startLine: i + 1,
          endLine,
          signature: `${kindWord} ${name}`,
          calls: kindWord === 'class' ? extractBodyCalls(lines, i + 1, endLine, name) : [],
        });
        if (trimmed.startsWith('export')) exportsList.add(name);
      }

      // Named functions & arrow functions
      const fnDecl = trimmed.match(
        /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/
      );
      const arrowDecl = trimmed.match(
        /^(?:export\s+)?const\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?::\s*[^=]+)?=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?=>/
      );

      if (fnDecl || arrowDecl) {
        const match = (fnDecl || arrowDecl)!;
        const name = match[1];
        const params = (match[2] || '').trim();
        const endLine = estimateBlockEnd(lines, i, language);
        symbols.push({
          id: `${filePath}::fn::${name}::${i + 1}`,
          name,
          kind: 'Function',
          filePath,
          startLine: i + 1,
          endLine,
          signature: `${name}(${params})`,
          calls: extractBodyCalls(lines, i + 1, endLine, name),
        });
        if (trimmed.startsWith('export')) exportsList.add(name);
      }

      const envRefs = line.matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z0-9_]+)/g);
      for (const m of envRefs) {
        configKeys.add(m[1]);
      }
    }
  } else if (language === 'Go' || language === 'Java' || language === 'Rust') {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const goFn = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      const rustFn = trimmed.match(/^(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
      const javaMethod = trimmed.match(
        /^(?:public|private|protected)\s+(?:static\s+)?[A-Za-z0-9_<>\[\]]+\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/
      );
      const match = goFn || rustFn || javaMethod;
      if (match) {
        const endLine = estimateBlockEnd(lines, i, language);
        symbols.push({
          id: `${filePath}::fn::${match[1]}::${i + 1}`,
          name: match[1],
          kind: 'Function',
          filePath,
          startLine: i + 1,
          endLine,
          signature: `${match[1]}(${match[2]})`,
          calls: extractBodyCalls(lines, i + 1, endLine, match[1]),
        });
      }
    }
  } else if (language === 'PipRequirements') {
    lines.forEach((raw, idx) => {
      const trimmed = raw.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const pkg = trimmed.split(/[=<>!~\[]/)[0].trim();
      if (pkg) {
        imports.push({
          source: pkg,
          specifiers: [trimmed],
          line: idx + 1,
          isExternal: true,
        });
        configKeys.add(pkg);
      }
    });
  } else if (language === 'EnvConfig') {
    lines.forEach((raw) => {
      const m = raw.trim().match(/^([A-Z0-9_]+)\s*=/);
      if (m) configKeys.add(m[1]);
    });
  } else if (language === 'JSON' && path.posix.basename(filePath) === 'package.json') {
    try {
      const parsed = JSON.parse(content);
      const deps = { ...(parsed.dependencies || {}), ...(parsed.devDependencies || {}) };
      Object.keys(deps).forEach((pkg, idx) => {
        imports.push({
          source: pkg,
          specifiers: [`${pkg}@${deps[pkg]}`],
          line: idx + 1,
          isExternal: true,
        });
      });
    } catch {
      // Ignore malformed JSON
    }
  }

  return {
    path: filePath,
    name: path.posix.basename(filePath),
    extension: path.posix.extname(filePath).toLowerCase(),
    language,
    fileType,
    sizeBytes: typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(content).length
      : content.length,
    lineCount: lines.length,
    content,
    symbols,
    imports,
    exports: Array.from(exportsList),
    configKeys: Array.from(configKeys),
  };
}

export function resolveInternalImports(files: RepoFile[]): void {
  const pathSet = new Set(files.map((f) => f.path));
  const stemIndex = new Map<string, string>();

  for (const f of files) {
    const withoutExt = f.path.replace(/\.[^.]+$/, '');
    stemIndex.set(withoutExt, f.path);
    const pyDotted = withoutExt.replace(/\//g, '.');
    stemIndex.set(pyDotted, f.path);
    // Also map stripped top folder (e.g. backend/app/auth/jwt_handler -> app.auth.jwt_handler)
    const parts = withoutExt.split('/');
    if (parts.length > 1) {
      stemIndex.set(parts.slice(1).join('.'), f.path);
    }
  }

  for (const file of files) {
    const dir = path.posix.dirname(file.path);
    for (const imp of file.imports) {
      if (imp.source.startsWith('.')) {
        if (file.language === 'Python') {
          // Python relative import like .jwt_handler or ..models.user
          const dotsMatch = imp.source.match(/^(\.+)(.*)$/);
          if (dotsMatch) {
            const upCount = dotsMatch[1].length - 1;
            const remainder = dotsMatch[2].replace(/\./g, '/');
            let baseDir = dir;
            for (let u = 0; u < upCount; u++) {
              baseDir = path.posix.dirname(baseDir);
            }
            const candidate = path.posix.join(baseDir, remainder);
            const resolved =
              stemIndex.get(candidate) ||
              (pathSet.has(`${candidate}/__init__.py`) ? `${candidate}/__init__.py` : undefined);
            if (resolved) {
              imp.resolvedPath = resolved;
              imp.isExternal = false;
            }
          }
        } else {
          // TS/JS relative import
          const cleanSource = imp.source.replace(/\.(ts|tsx|js|jsx)$/, '');
          const candidate = path.posix.normalize(path.posix.join(dir, cleanSource));
          const resolved =
            stemIndex.get(candidate) ||
            stemIndex.get(`${candidate}/index`) ||
            (pathSet.has(imp.source) ? imp.source : undefined);
          if (resolved) {
            imp.resolvedPath = resolved;
            imp.isExternal = false;
          }
        }
      } else if (imp.source.startsWith('@/')) {
        const candidate = imp.source.replace(/^@\//, 'src/').replace(/\.(ts|tsx|js|jsx)$/, '');
        const resolved =
          stemIndex.get(candidate) ||
          stemIndex.get(`frontend/${candidate}`) ||
          stemIndex.get(`${candidate}/index`);
        if (resolved) {
          imp.resolvedPath = resolved;
          imp.isExternal = false;
        }
      } else {
        // Dotted Python module import (e.g. app.auth.jwt_handler or backend.app.models.user)
        const directMatch = stemIndex.get(imp.source);
        if (directMatch) {
          imp.resolvedPath = directMatch;
          imp.isExternal = false;
        } else {
          // Check if specifier points to module file (e.g. from app.models import user)
          for (const spec of imp.specifiers) {
            const subCandidate = stemIndex.get(`${imp.source}.${spec}`);
            if (subCandidate) {
              imp.resolvedPath = subCandidate;
              imp.isExternal = false;
              break;
            }
          }
        }
      }
    }
  }
}

export function generateFindings(files: RepoFile[], inDegreeMap: Map<string, number>): CodeFinding[] {
  const findings: CodeFinding[] = [];
  const sourceFiles = files.filter((f) => f.fileType === 'source');
  const testFiles = files.filter((f) => f.fileType === 'test');

  for (const file of sourceFiles) {
    const inDeg = inDegreeMap.get(`file:${file.path}`) || 0;
    if (inDeg >= 3) {
      findings.push({
        id: `finding-coupling-${file.path}`,
        severity: 'architectural',
        category: 'coupling',
        title: `Core Architectural Hub (${inDeg} incoming module dependents)`,
        description: `${file.path} acts as a central dependency hub imported by ${inDeg} modules. Modifying exported signatures here has a multi-module blast radius.`,
        filePath: file.path,
        startLine: 1,
        endLine: Math.min(file.lineCount, 25),
      });
    }

    if (file.lineCount > 180) {
      findings.push({
        id: `finding-size-${file.path}`,
        severity: 'info',
        category: 'coupling',
        title: `High Responsibility Density (${file.lineCount} lines, ${file.symbols.length} symbols)`,
        description: `${file.name} defines ${file.symbols.length} symbols across ${file.lineCount} lines. Consider reviewing cohesion if additional responsibilities are added.`,
        filePath: file.path,
        startLine: 1,
        endLine: Math.min(file.lineCount, 30),
      });
    }

    // Security / Auth pattern inspection
    const lines = file.content.split(/\r?\n/);
    lines.forEach((ln, idx) => {
      if (/jwt\.encode|jwt\.decode|create_access_token|verify_token|createHmac/i.test(ln)) {
        findings.push({
          id: `finding-sec-${file.path}-${idx + 1}`,
          severity: 'architectural',
          category: 'security',
          title: `Cryptographic / Token Verification Boundary`,
          description: `Security-critical token or signature handling detected at ${file.name}:${idx + 1}. Ensure secret rotation and algorithm pinning remain enforced.`,
          filePath: file.path,
          startLine: Math.max(1, idx - 1),
          endLine: Math.min(file.lineCount, idx + 8),
        });
      }
    });
  }

  if (testFiles.length === 0 && sourceFiles.length > 0) {
    findings.push({
      id: 'finding-no-tests',
      severity: 'warning',
      category: 'test_coverage',
      title: 'No Automated Test Suite Detected in Indexed Paths',
      description: `Indexed ${sourceFiles.length} source files without discovering matching test modules (test_*.py, *.test.ts, *.spec.ts).`,
      filePath: sourceFiles[0].path,
      startLine: 1,
      endLine: Math.min(sourceFiles[0].lineCount, 15),
    });
  }

  return findings.slice(0, 12);
}
