import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { AIConversationPanel } from '../components/chat/AIConversationPanel';
import { EvidencePanel } from '../components/evidence/EvidencePanel';

export const AskCodeSagePage: React.FC = () => {
  const { activeRepo, activeEvidence, sendQuestion, askingQuestion } = useCodeSage();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Ask CodeSage — Evidence-Grounded Q&amp;A
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            GraphRAG retrieval pipeline over{' '}
            <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>{' '}
            {activeRepo?.isSample ? '(Sample Data)' : '(Live Indexed Repository)'}
          </p>
        </div>

        {activeRepo?.suggestedQuestions && activeRepo.suggestedQuestions.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            {activeRepo.suggestedQuestions.slice(0, 2).map((q) => (
              <button
                key={q}
                type="button"
                disabled={askingQuestion}
                onClick={() => sendQuestion(q)}
                className="px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-800 text-xs text-slate-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7">
          <AIConversationPanel />
        </div>
        <div className="xl:col-span-5 xl:sticky xl:top-20">
          <EvidencePanel items={activeEvidence} />
        </div>
      </div>
    </div>
  );
};
