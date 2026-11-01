import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code2,
  Compass,
  CornerDownLeft,
  FileCode,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useCodeSage } from '../../context/CodeSageContext';
import { isMacOs } from '../../hooks/useKeyboardShortcuts';
import { codeSageApi } from '../../services/api';
import type { RepoFile } from '../../types';

interface SearchItem {
  id: string;
  type: 'symbol' | 'file' | 'route';
  title: string;
  subtitle: string;
  badge?: string;
  shortcutHint?: string;
  onSelect: () => void;
}

const QUICK_ROUTES = [
  { label: 'Overview (Home Workspace)', path: '/', shortcut: 'H' },
  { label: 'Ask CodeSage (Evidence-Grounded AI)', path: '/ask', shortcut: 'J' },
  { label: 'Repository Explorer', path: '/explorer', shortcut: 'E' },
  { label: '3D Knowledge Graph Galaxy', path: '/graph', shortcut: 'G' },
  { label: 'Dependency Lab & Blast Radius', path: '/dependencies', shortcut: 'D' },
  { label: 'Bug Detective & Root Cause Triage', path: '/bugs', shortcut: 'B' },
  { label: 'Code Explainer & Architectural Intent', path: '/explainer', shortcut: 'X' },
  { label: 'API Flow Visualizer', path: '/apiflow', shortcut: 'F' },
  { label: 'Documentation Studio', path: '/docs', shortcut: 'O' },
  { label: 'Investigation History & Findings', path: '/history', shortcut: 'Y' },
  { label: 'Code Analysis & Metrics', path: '/analysis', shortcut: 'M' },
  { label: 'Settings & Diagnostics', path: '/settings', shortcut: ',' },
];

export const GlobalSearchModal: React.FC = () => {
  const navigate = useNavigate();
  const { searchModalOpen, setSearchModalOpen, activeRepo } = useCodeSage();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'symbol' | 'file' | 'route'>('all');
  const [files, setFiles] = useState<Omit<RepoFile, 'content'>[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = useMemo(() => isMacOs(), []);
  const modKey = isMac ? '⌘' : 'Ctrl';

  useEffect(() => {
    if (!searchModalOpen || !activeRepo) return;
    const ctrl = new AbortController();
    codeSageApi
      .listFiles(activeRepo.id, '', ctrl.signal)
      .then((res) => setFiles(res.files))
      .catch(() => {});
    return () => ctrl.abort();
  }, [searchModalOpen, activeRepo?.id]);

  useEffect(() => {
    if (searchModalOpen) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setFilterType('all');
    }
  }, [searchModalOpen]);

  const q = query.trim().toLowerCase();

  const searchItems: SearchItem[] = useMemo(() => {
    const items: SearchItem[] = [];

    // 1. Extracted Code Symbols
    if (filterType === 'all' || filterType === 'symbol') {
      const symbols = files
        .flatMap((f) =>
          f.symbols.map((s) => ({
            ...s,
            language: f.language,
          }))
        )
        .filter(
          (s) =>
            q &&
            (s.name.toLowerCase().includes(q) ||
              s.signature.toLowerCase().includes(q) ||
              s.filePath.toLowerCase().includes(q))
        )
        .slice(0, 8);

      for (const sym of symbols) {
        items.push({
          id: `sym-${sym.id}`,
          type: 'symbol',
          title: sym.name,
          subtitle: `${sym.filePath}:L${sym.startLine}`,
          badge: sym.kind,
          onSelect: () => {
            setSearchModalOpen(false);
            navigate(
              `/explorer?file=${encodeURIComponent(sym.filePath)}&start=${sym.startLine}&end=${sym.endLine}`
            );
          },
        });
      }
    }

    // 2. Indexed Repository Files
    if (filterType === 'all' || filterType === 'file') {
      const matchedFiles = files
        .filter((f) => !q || f.path.toLowerCase().includes(q))
        .slice(0, 10);

      for (const f of matchedFiles) {
        items.push({
          id: `file-${f.path}`,
          type: 'file',
          title: f.path,
          subtitle: `${f.language} · ${f.lineCount} lines · ${f.fileType}`,
          badge: f.language,
          onSelect: () => {
            setSearchModalOpen(false);
            navigate(`/explorer?file=${encodeURIComponent(f.path)}&start=1&end=30`);
          },
        });
      }
    }

    // 3. Workspace Views
    if (filterType === 'all' || filterType === 'route') {
      const matchedRoutes = QUICK_ROUTES.filter(
        (r) => !q || r.label.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)
      );

      for (const r of matchedRoutes) {
        items.push({
          id: `route-${r.path}`,
          type: 'route',
          title: r.label,
          subtitle: `Navigate to ${r.path}`,
          shortcutHint: `${modKey}${r.shortcut}`,
          onSelect: () => {
            setSearchModalOpen(false);
            navigate(r.path);
          },
        });
      }
    }

    return items;
  }, [files, q, filterType, navigate, setSearchModalOpen, modKey]);

  // Reset or constrain selectedIndex when items change
  useEffect(() => {
    setSelectedIndex((prev) => (itemsLength > 0 ? Math.min(prev, itemsLength - 1) : 0));
  }, [searchItems.length]);

  const itemsLength = searchItems.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (itemsLength > 0 ? (prev + 1) % itemsLength : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (itemsLength > 0 ? (prev - 1 + itemsLength) % itemsLength : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchItems[selectedIndex]) {
        searchItems[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchModalOpen(false);
    }
  };

  // Ensure active element is scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!searchModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 backdrop-blur-sm pt-16 sm:pt-20 p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette and Repository Search"
      onClick={() => setSearchModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#071A35] shadow-2xl shadow-black/90 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-[#041126]">
          <Search className="w-5 h-5 text-cyan-300 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search symbols, files, endpoints in ${activeRepo?.name || 'repository'}...`}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-[#020817] text-slate-400 border border-slate-800">
            Esc
          </kbd>
          <button
            type="button"
            onClick={() => setSearchModalOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-800/80 bg-[#05162E] text-xs">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Filter:</span>
          {(['all', 'symbol', 'file', 'route'] as const).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => setFilterType(ft)}
              className={`px-2.5 py-1 rounded text-xs capitalize cursor-pointer transition-colors ${
                filterType === ft
                  ? 'bg-[#2563FF] text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0A2042]'
              }`}
            >
              {ft === 'all'
                ? 'All'
                : ft === 'symbol'
                ? 'Symbols'
                : ft === 'file'
                ? 'Files'
                : 'Views'}
            </button>
          ))}
          <div className="ml-auto text-[11px] text-slate-500 hidden sm:block">
            {searchItems.length} result{searchItems.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-slate-800/40 max-h-[380px]">
          {searchItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No matching symbols, files, or workspace routes found for "{query}".
            </div>
          ) : (
            searchItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0A2042] border border-cyan-500/40 text-white shadow-sm'
                      : 'border border-transparent hover:bg-[#0A2042]/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        item.type === 'symbol'
                          ? 'bg-violet-950/60 text-violet-300 border border-violet-500/30'
                          : item.type === 'file'
                          ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                          : 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                      }`}
                    >
                      {item.type === 'symbol' ? (
                        <Code2 className="w-3.5 h-3.5" />
                      ) : item.type === 'file' ? (
                        <FileCode className="w-3.5 h-3.5" />
                      ) : (
                        <Compass className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate text-white">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcutHint && (
                      <kbd className="px-1.5 py-0.5 rounded bg-[#020817] border border-slate-700 text-[10px] font-mono text-cyan-300">
                        {item.shortcutHint}
                      </kbd>
                    )}
                    {item.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#020817] text-slate-400 border border-slate-800">
                        {item.badge}
                      </span>
                    )}
                    {isSelected && (
                      <span className="hidden sm:inline-flex items-center text-[11px] text-cyan-400 font-medium">
                        <CornerDownLeft className="w-3 h-3 ml-1" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts bar */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-[#041126] flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-[#071A35] border border-slate-700 text-[10px] font-mono text-slate-300">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-[#071A35] border border-slate-700 text-[10px] font-mono text-slate-300">
                ↓
              </kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-[#071A35] border border-slate-700 text-[10px] font-mono text-slate-300">
                ↵
              </kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-[#071A35] border border-slate-700 text-[10px] font-mono text-slate-300">
                Esc
              </kbd>
              <span>Close</span>
            </span>
          </div>

          <div className="text-slate-500 hidden sm:block">
            Quick jump to any symbol or file
          </div>
        </div>
      </div>
    </div>
  );
};
