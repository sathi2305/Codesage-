import React, { useState } from 'react';
import {
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../types';
import { useCodeSage } from '../context/CodeSageContext';
import { codeSageApi } from '../services/api';

export const SettingsPage: React.FC = () => {
  const {
    health,
    refreshHealth,
    repositories,
    activeRepo,
    selectRepository,
    refreshRepositories,
    language,
    setLanguage,
    setIngestModalOpen,
  } = useCodeSage();

  const [checkingHealth, setCheckingHealth] = useState(false);
  const [busyRepoId, setBusyRepoId] = useState<string | null>(null);

  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    await refreshHealth();
    setCheckingHealth(false);
  };

  const handleReindex = async (repoId: string) => {
    setBusyRepoId(repoId);
    try {
      await codeSageApi.reindexRepository(repoId);
      await refreshRepositories();
    } catch {
      // Ignore error
    } finally {
      setBusyRepoId(null);
    }
  };

  const handleDelete = async (repoId: string) => {
    if (repositories.length <= 1) return;
    setBusyRepoId(repoId);
    try {
      await codeSageApi.deleteRepository(repoId);
      await refreshRepositories();
    } catch {
      // Ignore error
    } finally {
      setBusyRepoId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Settings &amp; Integration Diagnostics
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Transparent service telemetry, multilingual preferences, and indexed repository management
          </p>
        </div>

        <button
          type="button"
          onClick={handleCheckHealth}
          disabled={checkingHealth}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0A2042] hover:bg-[#2563FF] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      {/* Live Backend & External Service Status (Read-only server environment inspection, zero API key inputs) */}
      <section className="rounded-xl border border-slate-800/80 bg-[#071A35] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80">
          <h2 className="text-sm font-semibold text-white">Live Service Integration Status</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Reported directly by <span className="font-mono">GET /api/health</span> — services without runtime environment credentials use documented local fallbacks rather than simulated connections.
          </p>
        </div>

        <div className="divide-y divide-slate-800/80 text-xs">
          <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-white">CodeSage Static AST &amp; Ingestion API</div>
              <div className="text-slate-400 mt-0.5">
                Handles GitHub HTTPS tree ingestion, safe .ZIP extraction, symbol parsing, and evidence verification
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium whitespace-nowrap">
              <CheckCircle2 className="w-4 h-4" />
              <span>{health?.services.api.label || 'Connected'}</span>
            </span>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-white">Server-Side GraphRAG Reasoning Engine</div>
              <div className="text-slate-400 mt-0.5">
                Configured exclusively via server environment variables with strict citation verification
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
                health?.services.llm.status === 'connected' ? 'text-emerald-400' : 'text-amber-300'
              }`}
            >
              {health?.services.llm.status === 'connected' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Info className="w-4 h-4" />
              )}
              <span>{health?.services.llm.label || 'Checking...'}</span>
            </span>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-white">Neo4j Knowledge Graph Database</div>
              <div className="text-slate-400 mt-0.5">
                Reads <span className="font-mono">NEO4J_URI</span> on the server; runs Local Knowledge Graph Engine when unconfigured
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
                health?.services.neo4j.status === 'connected' ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              <Info className="w-4 h-4 text-cyan-300" />
              <span>{health?.services.neo4j.label || 'Not Configured (Local Graph Fallback)'}</span>
            </span>
          </div>

          <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-white">Sarvam Indian-Language Translation API</div>
              <div className="text-slate-400 mt-0.5">
                Reads <span className="font-mono">SARVAM_API_KEY</span> on the server; falls back to neural translation preserving code identifiers
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 font-medium whitespace-nowrap ${
                health?.services.sarvam.status === 'connected' ? 'text-emerald-400' : 'text-slate-300'
              }`}
            >
              <Info className="w-4 h-4 text-violet-300" />
              <span>{health?.services.sarvam.label || 'Not Configured · AI Fallback'}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Multilingual Default Preference */}
      <section className="rounded-xl border border-slate-800/80 bg-[#071A35] p-5 space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Default Explanation Language</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Applies to new Ask CodeSage questions while keeping filenames, function signatures, and line citations in original ASCII.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLanguage(l.code as LanguageCode)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                language === l.code
                  ? 'bg-[#2563FF] text-white'
                  : 'bg-[#020817] text-slate-300 hover:bg-[#0A2042] border border-slate-800'
              }`}
            >
              {l.label} · {l.nativeLabel}
            </button>
          ))}
        </div>
      </section>

      {/* Repository Management */}
      <section className="rounded-xl border border-slate-800/80 bg-[#071A35] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Indexed Repositories</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Switch active workspace, re-run static AST indexing, or remove repositories
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIngestModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Repository</span>
          </button>
        </div>

        <div className="divide-y divide-slate-800/80">
          {repositories.map((repo) => {
            const isActive = repo.id === activeRepo?.id;
            const busy = busyRepoId === repo.id;
            return (
              <div
                key={repo.id}
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-white">{repo.fullName}</span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">
                      {repo.isSample ? 'Sample Repository' : `Live (${repo.sourceType})`}
                    </span>
                    {isActive && (
                      <>
                        <span className="text-slate-500">·</span>
                        <span className="text-cyan-300 font-medium">Active</span>
                      </>
                    )}
                  </div>
                  <p className="text-slate-400 mt-0.5 truncate max-w-xl">{repo.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => selectRepository(repo.id)}
                      className="px-3 py-1.5 rounded-lg bg-[#0A2042] hover:bg-[#2563FF] text-slate-200 hover:text-white font-medium cursor-pointer"
                    >
                      Select
                    </button>
                  )}

                  {repo.sourceType === 'github' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleReindex(repo.id)}
                      className="p-1.5 rounded-lg bg-[#020817] hover:bg-[#0A2042] border border-slate-800 text-slate-300 cursor-pointer"
                      title="Re-index repository"
                    >
                      {busy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}

                  {repositories.length > 1 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(repo.id)}
                      className="p-1.5 rounded-lg bg-[#020817] hover:bg-rose-950/60 border border-slate-800 text-slate-400 hover:text-rose-300 cursor-pointer"
                      title="Remove repository"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Hackathon Team Identity Card */}
      <section className="rounded-xl border border-slate-800/80 bg-[#071A35] p-5 text-xs text-slate-300 space-y-1.5">
        <div className="text-sm font-semibold text-white">
          hackFront India 2026 · Theme T1: AI and Developer Tools (Problem T1.1)
        </div>
        <div>
          Team: <strong className="text-cyan-300 font-medium">INNOVATION NINJAS</strong> · Mission: “Why The Code Is Like This” — Grounding every architectural answer in verifiable source code evidence.
        </div>
      </section>
    </div>
  );
};
