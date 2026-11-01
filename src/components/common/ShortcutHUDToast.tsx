import React from 'react';
import { Command } from 'lucide-react';
import { useCodeSage } from '../../context/CodeSageContext';

export const ShortcutHUDToast: React.FC = () => {
  const { shortcutToast } = useCodeSage();

  if (!shortcutToast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-12 right-6 z-50 pointer-events-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-[#041126]/95 border border-cyan-500/40 shadow-xl shadow-cyan-950/40 text-xs text-white backdrop-blur-md">
        <span className="flex items-center justify-center w-5 h-5 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 font-mono text-[10px] font-bold">
          {shortcutToast.combo}
        </span>
        <span className="text-slate-200 font-medium">{shortcutToast.message}</span>
      </div>
    </div>
  );
};
