import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowRight,
  Clock,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  History,
  MessageSquare,
  Network,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';

interface SavedInvestigation {
  id: string;
  title: string;
  repoName: string;
  category: 'Architecture' | 'Security' | 'Bug Triage' | 'Dependency';
  timestamp: string;
  summary: string;
  evidenceCount: number;
  tags: string[];
}

const INITIAL_HISTORY: SavedInvestigation[] = [
  {
    id: 'inv-1',
    title: 'Why RS256 JWT Authentication Was Selected Over Stateful DB Sessions',
    repoName: 'sample-fintech-auth-platform',
    category: 'Architecture',
    timestamp: '2026-10-31T08:15:00Z',
    summary:
      'Verified via docs/ADR-001. State sessions caused ~14ms latency across Kubernetes microservices. Local verification dropped latency to 0.4ms.',
    evidenceCount: 4,
    tags: ['ADR-001', 'RS256', 'JWT', 'Microservices'],
  },
  {
    id: 'inv-2',
    title: 'Redis JTI Revocation Store Fail-Closed Behavior on /logout',
    repoName: 'sample-fintech-auth-platform',
    category: 'Security',
    timestamp: '2026-10-30T17:40:00Z',
    summary:
      'Inspected backend/app/auth/revocation_store.py. Confirmed fail-closed policy when Redis is unreachable to avoid silent logout failures.',
    evidenceCount: 3,
    tags: ['Redis', 'JTI', 'Revocation', 'Fail-Closed'],
  },
  {
    id: 'inv-3',
    title: 'Ledger Transfer Optimistic Locking & Deadlock Mitigation',
    repoName: 'sample-fintech-auth-platform',
    category: 'Bug Triage',
    timestamp: '2026-10-29T14:22:00Z',
    summary:
      'Traced concurrent deadlock on accounts table. Found deterministic sorting of account IDs before SELECT FOR UPDATE prevents circular wait locks.',
    evidenceCount: 2,
    tags: ['PostgreSQL', 'Deadlock', 'Concurrency', 'ACID'],
  },
  {
    id: 'inv-4',
    title: 'Blast Radius Analysis for backend/app/auth/jwt_handler.py',
    repoName: 'sample-fintech-auth-platform',
    category: 'Dependency',
    timestamp: '2026-10-28T11:05:00Z',
    summary:
      'Graph traversal identified 8 direct downstream callers and 14 transitive endpoints. High blast radius risk level confirmed.',
    evidenceCount: 6,
    tags: ['Blast Radius', 'Dependency Graph', 'Risk: High'],
  },
];

export const InvestigationHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRepo } = useCodeSage();
  const [historyItems, setHistoryItems] = useState<SavedInvestigation[]>(INITIAL_HISTORY);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = historyItems.filter((item) => {
    const matchesCat = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(historyItems, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codesage-investigation-history.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear your local investigation history?')) {
      setHistoryItems([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <History className="w-3.5 h-3.5" />
            <span>INVESTIGATION HISTORY &amp; AUDIT TRAIL</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Saved Findings &amp; Rationale Records
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse and reopen previous architectural inquiries, bug root-cause triages, and blast radius reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-300" />
            <span>Export JSON</span>
          </button>

          {historyItems.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-red-950/40 border border-slate-800 text-xs font-medium text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-slate-800 bg-[#041126]">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved investigations by keyword or tag..."
            className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {['all', 'Architecture', 'Security', 'Bug Triage', 'Dependency'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterCategory === cat
                  ? 'bg-[#2563FF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-[#071A35]'
              }`}
            >
              {cat === 'all' ? 'All Records' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* History Cards List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#041126] p-12 text-center text-sm text-slate-400">
            No matching investigations found.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-800 bg-[#041126] hover:border-slate-700/80 p-5 transition-all space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#0A2042] text-cyan-300 border border-cyan-500/30">
                      {item.category}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    {item.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/ask')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <span>Reopen in AI Assistant</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#020817] p-3 rounded-xl border border-slate-800/80">
                {item.summary}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#071A35] text-slate-300 border border-slate-800"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="text-[11px] font-mono text-slate-400">
                  {item.evidenceCount} Verified AST Citations
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
