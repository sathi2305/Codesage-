import React, { useMemo, useState } from 'react';
import {
  Command,
  Compass,
  CornerDownLeft,
  FolderGit2,
  Keyboard,
  Layers,
  Search,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import { useCodeSage } from '../../context/CodeSageContext';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export const KeyboardShortcutsModal: React.FC = () => {
  const { shortcutsModalOpen, setShortcutsModalOpen } = useCodeSage();
  const { shortcuts, modKey, isMac } = useKeyboardShortcuts();
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Navigation', 'Command Palette', 'Repository', 'General'];

  const filteredShortcuts = useMemo(() => {
    return shortcuts.filter((s) => {
      if (s.id === 'shortcuts-cheat-sheet-alt') return false; // avoid duplicate in modal display
      const matchesCategory =
        selectedCategory === 'All' || s.category === selectedCategory;
      const q = filterQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.keys.join('').toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [shortcuts, selectedCategory, filterQuery]);

  if (!shortcutsModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts Cheat Sheet"
      onClick={() => setShortcutsModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#071A35] shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#041126]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Keyboard Shortcuts</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#0A2042] text-cyan-300 border border-cyan-500/30">
                  {isMac ? 'macOS (⌘)' : 'Win/Linux (Ctrl)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Speed up codebase exploration with global shortcuts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShortcutsModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A2042] transition-colors cursor-pointer"
            aria-label="Close shortcuts dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800/80 bg-[#05162E] space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search shortcut name or key..."
              className="w-full pl-9 pr-4 py-2 bg-[#020817] border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#2563FF] text-white shadow-sm shadow-blue-500/30'
                    : 'bg-[#0A2042] text-slate-400 hover:text-slate-200 hover:bg-[#0E2A56]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcut items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-800/50">
          {filteredShortcuts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No shortcuts found matching "{filterQuery}".
            </div>
          ) : (
            filteredShortcuts.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  item.action();
                  setShortcutsModalOpen(false);
                }}
                className="group pt-2 first:pt-0 flex items-center justify-between gap-4 p-2.5 rounded-xl hover:bg-[#0A2042]/70 transition-all cursor-pointer border border-transparent hover:border-slate-700"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white group-hover:text-cyan-200 transition-colors">
                      {item.label}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#020817] text-slate-400 border border-slate-800">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.description}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.keys.map((k, idx) => (
                    <React.Fragment key={idx}>
                      <kbd className="min-w-[26px] h-6 px-1.5 flex items-center justify-center rounded bg-[#020817] border border-slate-700 group-hover:border-cyan-500/50 text-[11px] font-mono font-medium text-cyan-300 shadow-sm transition-colors">
                        {k}
                      </kbd>
                      {idx < item.keys.length - 1 && (
                        <span className="text-slate-600 text-xs">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#041126] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#071A35] border border-slate-700 text-[10px] font-mono text-slate-300">
              ?
            </kbd>
            <span>or</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[#071A35] border border-slate-700 text-[10px] font-mono text-slate-300">
              {modKey} /
            </kbd>
            <span>anywhere to reopen</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span>Click any shortcut to execute</span>
          </div>
        </div>
      </div>
    </div>
  );
};
