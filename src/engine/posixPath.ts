/**
 * Cross-platform, Browser & Node.js POSIX Path Utility
 * Eliminates external Node.js 'path' dependency for 100% Vite SPA compatibility.
 */
export const posix: any = {
  basename(filePath: string, ext?: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    let base = segments[segments.length - 1] || '';
    if (ext && base.endsWith(ext)) {
      base = base.slice(0, -ext.length);
    }
    return base;
  },

  extname(filePath: string): string {
    const base = posix.basename(filePath);
    const lastDot = base.lastIndexOf('.');
    if (lastDot <= 0) return '';
    return base.slice(lastDot);
  },

  dirname(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length <= 1) return '.';
    return segments.slice(0, -1).join('/');
  },

  normalize(filePath: string): string {
    const normalized = filePath.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    const resolved: string[] = [];
    for (const seg of segments) {
      if (seg === '..') {
        resolved.pop();
      } else if (seg !== '.') {
        resolved.push(seg);
      }
    }
    return resolved.join('/');
  },

  join(...paths: string[]): string {
    return posix.normalize(paths.join('/'));
  },
};

// Mirror path.posix alias for direct compatibility
posix.posix = posix;

export default posix;
