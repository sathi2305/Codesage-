import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockViewerProps {
  code: string;
  language?: string;
  startLine?: number;
  highlightStart?: number;
  highlightEnd?: number;
  maxHeightClass?: string;
  filePath?: string;
}

const KEYWORDS = new Set([
  'import',
  'from',
  'export',
  'default',
  'function',
  'async',
  'await',
  'return',
  'const',
  'let',
  'var',
  'if',
  'else',
  'try',
  'except',
  'catch',
  'finally',
  'raise',
  'throw',
  'new',
  'class',
  'interface',
  'type',
  'def',
  'for',
  'in',
  'while',
  'True',
  'False',
  'None',
  'true',
  'false',
  'null',
  'undefined',
  'public',
  'private',
  'static',
  'with',
  'as',
]);

function tokenizeLine(line: string): React.ReactNode[] {
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return [<span key="comment" className="text-slate-500 italic">{line}</span>];
  }

  const tokens = line.split(/(\s+|[()[\]{}.,:;=@]|"[^"]*"|'[^']*'|`[^`]*`)/g);
  return tokens.map((tok, idx) => {
    if (!tok) return null;
    if ((tok.startsWith('"') && tok.endsWith('"')) || (tok.startsWith("'") && tok.endsWith("'")) || (tok.startsWith('`') && tok.endsWith('`'))) {
      return (
        <span key={idx} className="text-emerald-300">
          {tok}
        </span>
      );
    }
    if (tok.startsWith('@')) {
      return (
        <span key={idx} className="text-cyan-300">
          {tok}
        </span>
      );
    }
    if (KEYWORDS.has(tok)) {
      return (
        <span key={idx} className="text-[#60A5FA] font-medium">
          {tok}
        </span>
      );
    }
    if (/^\d+$/.test(tok)) {
      return (
        <span key={idx} className="text-violet-300">
          {tok}
        </span>
      );
    }
    if (/^[A-Z][A-Za-z0-9_]*$/.test(tok)) {
      return (
        <span key={idx} className="text-cyan-200">
          {tok}
        </span>
      );
    }
    return <span key={idx}>{tok}</span>;
  });
}

export const CodeBlockViewer: React.FC<CodeBlockViewerProps> = ({
  code,
  language = 'text',
  startLine = 1,
  highlightStart,
  highlightEnd,
  maxHeightClass = 'max-h-[420px]',
  filePath,
}) => {
  const [copied, setCopied] = useState(false);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const lines = code.split(/\r?\n/);

  useEffect(() => {
    if (highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightStart, filePath]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="rounded-lg border border-slate-800/90 bg-[#020817] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-slate-800/80 bg-[#041126]">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono truncate">
          {filePath ? <span className="text-slate-200 truncate">{filePath}</span> : null}
          {filePath ? <span aria-hidden="true">·</span> : null}
          <span>{language}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            L{startLine}–L{startLine + lines.length - 1}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#0A2042] hover:bg-[#2563FF]/30 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          aria-label="Copy source code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className={`overflow-auto font-mono text-[12.5px] leading-relaxed ${maxHeightClass}`}>
        <div className="py-2 min-w-full inline-block">
          {lines.map((line, idx) => {
            const lineNumber = startLine + idx;
            const isHighlighted =
              highlightStart !== undefined &&
              highlightEnd !== undefined &&
              lineNumber >= highlightStart &&
              lineNumber <= highlightEnd;
            const isFirstHighlight = highlightStart !== undefined && lineNumber === highlightStart;

            return (
              <div
                key={lineNumber}
                ref={isFirstHighlight ? highlightRef : undefined}
                className={`flex items-start px-3 transition-colors ${
                  isHighlighted ? 'bg-[#2563FF]/18 text-white' : 'hover:bg-slate-900/60 text-slate-200'
                }`}
              >
                <span
                  className={`w-11 pr-3 text-right select-none shrink-0 tabular-nums ${
                    isHighlighted ? 'text-cyan-300 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {lineNumber}
                </span>
                <pre className="whitespace-pre font-mono flex-1 overflow-visible">
                  {tokenizeLine(line)}
                </pre>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
