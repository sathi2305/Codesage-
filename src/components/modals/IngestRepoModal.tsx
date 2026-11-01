import React, { useState } from 'react';
import { CheckCircle2, FolderUp, GitBranch, Loader2, Shield, X } from 'lucide-react';
import { useCodeSage } from '../../context/CodeSageContext';
import { codeSageApi } from '../../services/api';

const QUICK_PUBLIC_REPOS = [
  {
    label: 'expressjs/cors',
    url: 'https://github.com/expressjs/cors',
    note: 'Node.js CORS middleware',
  },
  {
    label: 'pallets/itsdangerous',
    url: 'https://github.com/pallets/itsdangerous',
    note: 'Python cryptographic signing',
  },
  {
    label: 'sindresorhus/ky',
    url: 'https://github.com/sindresorhus/ky',
    note: 'TypeScript Fetch HTTP client',
  },
];

export const IngestRepoModal: React.FC = () => {
  const {
    ingestModalOpen,
    setIngestModalOpen,
    refreshRepositories,
    selectRepository,
  } = useCodeSage();

  const [mode, setMode] = useState<'url' | 'zip'>('url');
  const [gitUrl, setGitUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [stageLabel, setStageLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!ingestModalOpen) return null;

  const handleIngestUrl = async (targetUrl?: string) => {
    const urlToUse = (targetUrl ?? gitUrl).trim();
    if (!urlToUse || busy) return;
    setBusy(true);
    setError(null);
    setStageLabel('Validating HTTPS Git URL & SSRF rules...');

    try {
      const stageTimer = setTimeout(() => {
        setStageLabel('Fetching repository tree, parsing AST symbols & constructing Knowledge Graph...');
      }, 900);

      const { repository } = await codeSageApi.addGitRepository(urlToUse);
      clearTimeout(stageTimer);
      await refreshRepositories();
      selectRepository(repository.id);
      setGitUrl('');
      setIngestModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to index repository.');
    } finally {
      setBusy(false);
      setStageLabel('');
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a valid .zip repository archive.');
      return;
    }

    setBusy(true);
    setError(null);
    setStageLabel('Sanitizing archive paths & extracting supported source files...');

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const commaIdx = result.indexOf(',');
          resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
        };
        reader.onerror = () => reject(new Error('Unable to read selected file.'));
        reader.readAsDataURL(file);
      });

      const { repository } = await codeSageApi.uploadRepositoryArchive(file.name, base64Data);
      await refreshRepositories();
      selectRepository(repository.id);
      setIngestModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archive ingestion failed.');
    } finally {
      setBusy(false);
      setStageLabel('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingest-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-700/90 bg-[#071A35] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 id="ingest-modal-title" className="text-base font-semibold text-white">
              Import & Analyze Repository
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Static read-only AST indexing · Untrusted repository code is never executed
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => setIngestModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A2042] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#020817] border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('url');
                setError(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                mode === 'url' ? 'bg-[#2563FF] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Public GitHub URL</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('zip');
                setError(null);
              }}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                mode === 'zip' ? 'bg-[#2563FF] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Upload .ZIP Archive</span>
            </button>
          </div>

          {mode === 'url' ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="repo-url-input" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Public HTTPS GitHub Repository URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="repo-url-input"
                    type="url"
                    value={gitUrl}
                    onChange={(e) => setGitUrl(e.target.value)}
                    disabled={busy}
                    placeholder="https://github.com/expressjs/cors"
                    className="flex-1 px-3.5 py-2 rounded-lg bg-[#020817] border border-slate-700 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563FF]"
                  />
                  <button
                    type="button"
                    disabled={busy || !gitUrl.trim()}
                    onClick={() => handleIngestUrl()}
                    className="px-4 py-2 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] disabled:opacity-50 text-xs font-medium text-white whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {busy ? 'Indexing...' : 'Index Repo'}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-slate-400 mb-1.5">
                  Or click a real public GitHub repository to test live ingestion:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {QUICK_PUBLIC_REPOS.map((item) => (
                    <button
                      key={item.url}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setGitUrl(item.url);
                        handleIngestUrl(item.url);
                      }}
                      className="p-2.5 rounded-lg bg-[#020817] hover:bg-[#0A2042] border border-slate-800 text-left transition-colors cursor-pointer"
                    >
                      <div className="font-mono text-xs font-medium text-cyan-300 truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{item.note}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 bg-[#020817] p-6 text-center">
              <FolderUp className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-white">Select a .zip repository archive</p>
              <p className="text-xs text-slate-400 mt-1">
                Max 10 MB · Binary files, lockfiles, and node_modules are automatically excluded
              </p>
              <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white cursor-pointer">
                <span>Choose .ZIP File</span>
                <input
                  type="file"
                  accept=".zip,application/zip"
                  disabled={busy}
                  onChange={handleZipUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {busy && (
            <div className="rounded-lg bg-[#041126] border border-slate-800 p-3 flex items-center gap-2.5 text-xs text-cyan-300">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{stageLabel || 'Indexing repository...'}</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-rose-950/40 border border-rose-800/70 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex items-start gap-2 text-[11px] text-slate-400">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Security sandboxing active: SSRF private-IP blocking, zip-slip path normalization, 200 KB per-file cap, and strictly non-executing static AST parsing.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
