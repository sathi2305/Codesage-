import { posix } from './posixPath';

const ALLOWED_GIT_HOSTS = new Set(['github.com', 'www.github.com', 'gitlab.com']);

const BLOCKED_PATH_SEGMENTS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
  '.idea',
  '.vscode',
  'vendor',
  'target',
]);

const BINARY_OR_SKIPPED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.pyc',
  '.lock',
  '.map',
  '.mp4',
  '.mp3',
  '.wav',
]);

export const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_SINGLE_FILE_BYTES = 200 * 1024; // 200 KB
export const MAX_INDEXED_FILES = 180;

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch?: string;
  normalizedUrl: string;
}

export function validateRepositoryUrl(rawUrl: string): {
  valid: boolean;
  error?: string;
  parsed?: ParsedGitHubUrl;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Repository URL is required.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 300 || trimmed.includes('\0') || trimmed.includes('..')) {
    return { valid: false, error: 'Invalid or potentially unsafe URL format.' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Enter a valid HTTPS Git repository URL (e.g., https://github.com/owner/repo).' };
  }

  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS public Git URLs are permitted (file://, ssh://, and http:// are blocked).' };
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return { valid: false, error: 'Private network hosts and loopback addresses are blocked for SSRF protection.' };
  }

  if (!ALLOWED_GIT_HOSTS.has(host)) {
    return {
      valid: false,
      error: 'Only public GitHub or GitLab HTTPS URLs are supported in this deployment.',
    };
  }

  const segments = parsedUrl.pathname
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean);

  if (segments.length < 2) {
    return {
      valid: false,
      error: 'URL must include both repository owner and name (e.g., https://github.com/pallets/click).',
    };
  }

  const [owner, repo] = segments;
  const safeNameRegex = /^[a-zA-Z0-9._-]+$/;
  if (!safeNameRegex.test(owner) || !safeNameRegex.test(repo)) {
    return { valid: false, error: 'Repository owner or name contains unsupported characters.' };
  }

  let branch: string | undefined;
  if (segments[2] === 'tree' && segments[3] && safeNameRegex.test(segments[3])) {
    branch = segments[3];
  }

  return {
    valid: true,
    parsed: {
      owner,
      repo,
      branch,
      normalizedUrl: `https://${host === 'www.github.com' ? 'github.com' : host}/${owner}/${repo}`,
    },
  };
}

export function sanitizeArchiveEntryPath(rawEntryPath: string): string | null {
  if (!rawEntryPath || rawEntryPath.includes('\0')) return null;
  const rawClean = rawEntryPath.replace(/\\/g, '/');
  if (rawClean.startsWith('../') || rawClean.includes('/../') || rawClean === '..') {
    return null;
  }
  const normalized = posix.normalize(rawClean).replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('..') || normalized.includes('/../')) {
    return null;
  }
  return normalized;
}

export function shouldIndexFilePath(filePath: string, sizeBytes?: number): boolean {
  if (sizeBytes !== undefined && sizeBytes > MAX_SINGLE_FILE_BYTES) {
    return false;
  }
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length === 0) return false;

  for (const part of parts) {
    if (BLOCKED_PATH_SEGMENTS.has(part)) return false;
  }

  const fileName = parts[parts.length - 1].toLowerCase();
  if (
    fileName === 'package-lock.json' ||
    fileName === 'pnpm-lock.yaml' ||
    fileName === 'yarn.lock' ||
    fileName === 'poetry.lock' ||
    fileName === 'cargo.lock' ||
    fileName.endsWith('.min.js') ||
    fileName.endsWith('.min.css') ||
    fileName.endsWith('.d.ts.map')
  ) {
    return false;
  }

  const ext = posix.extname(fileName);
  if (BINARY_OR_SKIPPED_EXTENSIONS.has(ext)) {
    return false;
  }

  return true;
}
