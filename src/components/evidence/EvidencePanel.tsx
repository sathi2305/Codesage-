import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileCode2,
  ShieldCheck,
} from 'lucide-react';
import type { EvidenceItem } from '../../types';
import { useCodeSage } from '../../context/CodeSageContext';
import { CodeBlockViewer } from '../common/CodeBlockViewer';

interface EvidencePanelProps {
  items: EvidenceItem[];
  compact?: boolean;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ items, compact = false }) => {
  const navigate = useNavigate();
  const { highlightedCitationId, setHighlightedCitationId } = useCodeSage();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isExpanded = (id: string, index: number) => {
    if (highlightedCitationId === id) return true;
    if (expandedIds[id] !== undefined) return expandedIds[id];
    return index === 0;
  };

  const toggleExpand = (id: string, index: number) => {
    const curr = isExpanded(id, index);
    setExpandedIds((prev) => ({ ...prev, [id]: !curr }));
    if (!curr) {
      setHighlightedCitationId(id);
    } else if (highlightedCitationId === id) {
      setHighlightedCitationId(null);
    }
  };

  const copyReference = async (ev: EvidenceItem) => {
    const refText = `${ev.filePath}:L${ev.startLine}-L${ev.endLine} — ${ev.relevance}`;
    try {
      await navigator.clipboard.writeText(refText);
      setCopiedId(ev.id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failure
    }
  };

  const openInExplorer = (ev: EvidenceItem) => {
    navigate(
      `/explorer?file=${encodeURIComponent(ev.filePath)}&start=${ev.startLine}&end=${ev.endLine}`
    );
  };

  return (
    <section className="rounded-xl border border-slate-800/80 bg-[#071A35] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/80">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white tracking-tight truncate">
            Verified Source Evidence
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {items.length > 0
              ? `${items.length} repository citations cross-checked against indexed AST`
              : 'Ask a question to inspect cited repository excerpts'}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0 whitespace-nowrap">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified</span>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center">
          <FileCode2 className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-300 font-medium">No active citations selected</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Every CodeSage explanation attaches exact file paths and line ranges here so you can verify why the code works as it does.
          </p>
        </div>
      ) : (
        <div className={`divide-y divide-slate-800/80 overflow-y-auto ${compact ? 'max-h-[420px]' : 'max-h-[680px]'}`}>
          {items.map((ev, index) => {
            const open = isExpanded(ev.id, index);
            const active = highlightedCitationId === ev.id;

            return (
              <div
                key={ev.id}
                className={`transition-colors ${active ? 'bg-[#0A2042]/90' : 'hover:bg-[#0A2042]/45'}`}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(ev.id, index)}
                      className="flex items-start gap-2 text-left min-w-0 flex-1 group cursor-pointer"
                    >
                      <span className="mt-0.5 text-slate-400 group-hover:text-cyan-300 shrink-0">
                        {open ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs font-medium text-cyan-300 group-hover:text-cyan-200 truncate">
                          [{index + 1}] {ev.filePath}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 mt-1 tabular-nums">
                          <span>
                            Lines {ev.startLine}–{ev.endLine}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{ev.language}</span>
                          <span aria-hidden="true">·</span>
                          <span className="capitalize">{ev.fileType}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              ev.certainty === 'observed' ? 'text-emerald-400' : 'text-amber-300'
                            }
                          >
                            {ev.certainty === 'observed' ? 'Observed AST' : 'Inferred Link'}
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyReference(ev)}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                        title="Copy file:line reference"
                        aria-label="Copy file and line reference"
                      >
                        {copiedId === ev.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openInExplorer(ev)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-200 bg-[#0A2042] hover:bg-[#2563FF] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 pl-6 leading-relaxed">{ev.relevance}</p>

                  {open && (
                    <div className="mt-3 pl-6">
                      <CodeBlockViewer
                        code={ev.excerpt}
                        language={ev.language}
                        startLine={ev.startLine}
                        maxHeightClass="max-h-56"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
