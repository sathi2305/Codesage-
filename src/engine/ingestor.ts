import JSZip from 'jszip';
import type {
  CodeAnalysisSummary,
  EvidenceItem,
  RepoFile,
  RepositoryGraph,
  RepositorySummary,
} from '../types/index.ts';
import {
  MAX_ARCHIVE_BYTES,
  MAX_INDEXED_FILES,
  MAX_SINGLE_FILE_BYTES,
  sanitizeArchiveEntryPath,
  shouldIndexFilePath,
  validateRepositoryUrl,
} from './security.ts';
import { parseSourceFile, resolveInternalImports } from './parser.ts';
import { buildRepositoryGraph, computeCodeAnalysis } from './graphEngine.ts';
import { SAMPLE_REPOSITORIES } from './sampleRepos.ts';

export interface IndexedRepositoryRecord {
  summary: RepositorySummary;
  files: RepoFile[];
  graph: RepositoryGraph;
  analysis: CodeAnalysisSummary;
}

const repoStore = new Map<string, IndexedRepositoryRecord>();
const evidenceCache = new Map<string, EvidenceItem>();

export function saveEvidenceItems(items: EvidenceItem[]): void {
  for (const item of items) {
    evidenceCache.set(item.id, item);
  }
}

export function getEvidenceById(id: string): EvidenceItem | undefined {
  return evidenceCache.get(id);
}

function buildRecordFromRawFiles(params: {
  id: string;
  name: string;
  fullName: string;
  url: string;
  branch: string;
  description: string;
  isSample: boolean;
  sourceType: 'sample' | 'github' | 'archive';
  suggestedQuestions?: string[];
  rawFiles: { path: string; content: string }[];
}): IndexedRepositoryRecord {
  const parsedFiles = params.rawFiles.map((rf) => parseSourceFile(rf.path, rf.content));
  resolveInternalImports(parsedFiles);

  const graph = buildRepositoryGraph(params.id, params.name, params.isSample, parsedFiles);
  const analysis = computeCodeAnalysis(params.id, parsedFiles, graph);

  const topFiles = analysis.topCoupledFiles.slice(0, 2).map((t) => t.filePath);
  const autoQuestions =
    params.suggestedQuestions && params.suggestedQuestions.length > 0
      ? params.suggestedQuestions
      : [
          `Explain the overall architecture and module organization of ${params.name}.`,
          topFiles[0]
            ? `What could break if ${topFiles[0]} changes?`
            : `Which files have the highest dependency coupling?`,
          topFiles[1]
            ? `Why is ${topFiles[1]} structured this way and what depends on it?`
            : `How are configuration and environment settings managed in this codebase?`,
          `Show the main entrypoints, API routes, or exported interfaces.`,
        ];

  const summary: RepositorySummary = {
    id: params.id,
    name: params.name,
    fullName: params.fullName,
    url: params.url,
    branch: params.branch,
    description: params.description,
    isSample: params.isSample,
    sourceType: params.sourceType,
    status: 'ready',
    progress: 100,
    statusMessage: `Indexed ${parsedFiles.length} files and ${analysis.totalSymbols} symbols`,
    indexedAt: new Date().toISOString(),
    fileCount: parsedFiles.length,
    symbolCount: analysis.totalSymbols,
    edgeCount: graph.edges.length,
    primaryLanguage: analysis.languages[0]?.language || 'Unknown',
    languages: analysis.languages,
    suggestedQuestions: autoQuestions,
  };

  return {
    summary,
    files: parsedFiles,
    graph,
    analysis,
  };
}

export function initializeSampleRepositories(): void {
  if (repoStore.size > 0) return;
  for (const sample of SAMPLE_REPOSITORIES) {
    const record = buildRecordFromRawFiles({
      id: sample.id,
      name: sample.name,
      fullName: sample.fullName,
      url: sample.url,
      branch: sample.branch,
      description: sample.description,
      isSample: true,
      sourceType: 'sample',
      suggestedQuestions: sample.suggestedQuestions,
      rawFiles: sample.rawFiles,
    });
    repoStore.set(sample.id, record);
  }
}

export function listRepositories(): RepositorySummary[] {
  initializeSampleRepositories();
  return Array.from(repoStore.values()).map((r) => r.summary);
}

export function getRepositoryRecord(id: string): IndexedRepositoryRecord | undefined {
  initializeSampleRepositories();
  return repoStore.get(id);
}

export function deleteRepositoryRecord(id: string): boolean {
  return repoStore.delete(id);
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'CodeSage-AI-Indexer/1.0',
  };
  const token =
    typeof process !== 'undefined' && process.env ? process.env.GITHUB_TOKEN : undefined;
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  return headers;
}

export async function ingestPublicGitRepository(rawUrl: string): Promise<IndexedRepositoryRecord> {
  const check = validateRepositoryUrl(rawUrl);
  if (!check.valid || !check.parsed) {
    throw new Error(check.error || 'Invalid repository URL.');
  }

  const { owner, repo, branch: requestedBranch, normalizedUrl } = check.parsed;
  const repoId = `gh-${owner.toLowerCase()}-${repo.toLowerCase()}`;

  // Create initial status placeholder
  const placeholderSummary: RepositorySummary = {
    id: repoId,
    name: repo,
    fullName: `${owner}/${repo}`,
    url: normalizedUrl,
    branch: requestedBranch || 'main',
    description: `Fetching repository metadata from ${normalizedUrl}...`,
    isSample: false,
    sourceType: 'github',
    status: 'cloning',
    progress: 20,
    statusMessage: 'Fetching public repository tree via HTTPS...',
    indexedAt: new Date().toISOString(),
    fileCount: 0,
    symbolCount: 0,
    edgeCount: 0,
    primaryLanguage: 'Detecting',
    languages: [],
    suggestedQuestions: [],
  };

  repoStore.set(repoId, {
    summary: placeholderSummary,
    files: [],
    graph: {
      repoId,
      isSample: false,
      engineMode: 'local_fallback',
      nodes: [],
      edges: [],
      cypherPreview: [],
    },
    analysis: {
      repoId,
      totalFiles: 0,
      totalLines: 0,
      totalSymbols: 0,
      totalImports: 0,
      testFilesCount: 0,
      docFilesCount: 0,
      configFilesCount: 0,
      languages: [],
      symbolBreakdown: [],
      topCoupledFiles: [],
      architecturalLayers: [],
      findings: [],
    },
  });

  try {
    const host = new URL(normalizedUrl).hostname;
    if (host.includes('gitlab.com')) {
      throw new Error(
        'Direct GitLab tree API requires project token configuration; use a public GitHub URL or upload a .zip repository archive.'
      );
    }

    // 1. Fetch GitHub repo metadata
    const metaResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders(),
      signal: AbortSignal.timeout(12000),
    });

    if (!metaResp.ok) {
      if (metaResp.status === 404) {
        throw new Error(`Public repository ${owner}/${repo} was not found or is private.`);
      }
      if (metaResp.status === 403) {
        throw new Error(
          `GitHub API rate limit reached for unauthenticated requests. Upload a .zip archive or configure GITHUB_TOKEN.`
        );
      }
      throw new Error(`GitHub metadata request failed with HTTP ${metaResp.status}.`);
    }

    const metaJson = (await metaResp.json()) as {
      default_branch?: string;
      description?: string | null;
    };
    const branch = requestedBranch || metaJson.default_branch || 'main';
    const description =
      metaJson.description || `Live indexed public GitHub repository (${owner}/${repo})`;

    placeholderSummary.branch = branch;
    placeholderSummary.progress = 45;
    placeholderSummary.statusMessage = `Discovering source files on branch '${branch}'...`;

    // 2. Fetch recursive git tree
    const treeResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      {
        headers: githubHeaders(),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!treeResp.ok) {
      throw new Error(`Unable to fetch Git tree for branch '${branch}' (HTTP ${treeResp.status}).`);
    }

    const treeData = (await treeResp.json()) as {
      tree?: { path: string; type: string; size?: number }[];
    };

    const blobs = (treeData.tree || [])
      .filter((item) => item.type === 'blob' && shouldIndexFilePath(item.path, item.size))
      // Prioritize core source, README/docs, configs, and tests
      .sort((a, b) => {
        const score = (p: string) => {
          const low = p.toLowerCase();
          if (low.startsWith('readme') || low.includes('adr')) return 0;
          if (/\.(py|ts|tsx|js|go|rs|java)$/.test(low) && !low.includes('test')) return 1;
          if (/package\.json|requirements\.txt|pyproject\.toml|cargo\.toml/.test(low)) return 2;
          return 3;
        };
        return score(a.path) - score(b.path);
      })
      .slice(0, Math.min(MAX_INDEXED_FILES, 65));

    if (blobs.length === 0) {
      throw new Error('No supported text or source files found within safe size limits.');
    }

    placeholderSummary.status = 'parsing';
    placeholderSummary.progress = 68;
    placeholderSummary.statusMessage = `Downloading & statically parsing ${blobs.length} source files...`;

    // 3. Download raw text files concurrently via raw.githubusercontent.com (avoids REST API rate limits!)
    const rawFiles: { path: string; content: string }[] = [];
    const batchSize = 12;
    for (let i = 0; i < blobs.length; i += batchSize) {
      const slice = blobs.slice(i, i + batchSize);
      const fetched = await Promise.all(
        slice.map(async (blob) => {
          try {
            const rawFileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(
              branch
            )}/${blob.path
              .split('/')
              .map(encodeURIComponent)
              .join('/')}`;
            const r = await fetch(rawFileUrl, { signal: AbortSignal.timeout(10000) });
            if (!r.ok) return null;
            const text = await r.text();
            const byteLen =
              typeof TextEncoder !== 'undefined'
                ? new TextEncoder().encode(text).length
                : text.length;
            if (byteLen > MAX_SINGLE_FILE_BYTES || text.includes('\0')) {
              return null;
            }
            return { path: blob.path, content: text };
          } catch {
            return null;
          }
        })
      );
      for (const item of fetched) {
        if (item) rawFiles.push(item);
      }
    }

    if (rawFiles.length === 0) {
      throw new Error('Failed to retrieve readable source content from repository branch.');
    }

    placeholderSummary.status = 'graphing';
    placeholderSummary.progress = 90;
    placeholderSummary.statusMessage = 'Constructing Knowledge Graph and dependency chains...';

    const record = buildRecordFromRawFiles({
      id: repoId,
      name: repo,
      fullName: `${owner}/${repo}`,
      url: normalizedUrl,
      branch,
      description,
      isSample: false,
      sourceType: 'github',
      rawFiles,
    });

    repoStore.set(repoId, record);
    return record;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Repository indexing failed.';
    placeholderSummary.status = 'error';
    placeholderSummary.statusMessage = message;
    throw err;
  }
}

export async function ingestZipArchive(
  archiveName: string,
  base64Data: string
): Promise<IndexedRepositoryRecord> {
  let cleanBuffer: Uint8Array;
  try {
    const binary = atob(base64Data);
    cleanBuffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      cleanBuffer[i] = binary.charCodeAt(i);
    }
  } catch {
    if (typeof Buffer !== 'undefined') {
      cleanBuffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Invalid base64 archive payload.');
    }
  }
  if (cleanBuffer.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`Archive exceeds maximum safe limit of ${MAX_ARCHIVE_BYTES / (1024 * 1024)} MB.`);
  }

  const zip = await JSZip.loadAsync(cleanBuffer);
  const entries = Object.values(zip.files).filter((e) => !e.dir);

  const rawFiles: { path: string; content: string }[] = [];
  let commonPrefix: string | null = null;

  // Detect if all files share a single root folder in the ZIP
  const sanitizedPaths = entries
    .map((e) => sanitizeArchiveEntryPath(e.name))
    .filter((p): p is string => Boolean(p));

  if (sanitizedPaths.length > 0 && sanitizedPaths.every((p) => p.includes('/'))) {
    const firstRoot = sanitizedPaths[0].split('/')[0];
    if (sanitizedPaths.every((p) => p.startsWith(`${firstRoot}/`))) {
      commonPrefix = `${firstRoot}/`;
    }
  }

  for (const entry of entries) {
    if (rawFiles.length >= MAX_INDEXED_FILES) break;
    let safePath = sanitizeArchiveEntryPath(entry.name);
    if (!safePath) continue;
    if (commonPrefix && safePath.startsWith(commonPrefix)) {
      safePath = safePath.slice(commonPrefix.length);
    }
    if (!safePath || !shouldIndexFilePath(safePath)) continue;

    const bytes = await entry.async('uint8array');
    if (bytes.byteLength > MAX_SINGLE_FILE_BYTES) continue;
    // Skip binary files containing null bytes
    if (bytes.subarray(0, 512).includes(0)) continue;

    const content =
      typeof TextDecoder !== 'undefined'
        ? new TextDecoder('utf-8').decode(bytes)
        : typeof Buffer !== 'undefined'
          ? Buffer.from(bytes).toString('utf8')
          : String.fromCharCode(...bytes);
    rawFiles.push({ path: safePath, content });
  }

  if (rawFiles.length === 0) {
    throw new Error('Archive contained no supported text source files after safety filtering.');
  }

  const cleanRepoName = archiveName
    .replace(/\.zip$/i, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48) || 'uploaded-archive';

  const repoId = `zip-${cleanRepoName.toLowerCase()}-${Date.now().toString(36)}`;

  const record = buildRecordFromRawFiles({
    id: repoId,
    name: cleanRepoName,
    fullName: `uploaded/${cleanRepoName}`,
    url: `archive://${cleanRepoName}.zip`,
    branch: 'archive',
    description: `Safely extracted and statically indexed from uploaded archive (${archiveName}).`,
    isSample: false,
    sourceType: 'archive',
    rawFiles,
  });

  repoStore.set(repoId, record);
  return record;
}
