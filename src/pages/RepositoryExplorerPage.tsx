import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Code2,
  FileCode2,
  Folder,
  FolderOpen,
  Loader2,
  MessageSquareCode,
  Search,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { codeSageApi } from '../services/api';
import type { RepoFile } from '../types';
import { CodeBlockViewer } from '../components/common/CodeBlockViewer';

export const RepositoryExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeRepo, sendQuestion } = useCodeSage();

  const [files, setFiles] = useState<Omit<RepoFile, 'content'>[]>([]);
  const [selectedFile, setSelectedFile] = useState<RepoFile | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [collapsedDirs, setCollapsedDirs] = useState<Record<string, boolean>>({});

  const requestedPath = searchParams.get('file');
  const startLineParam = searchParams.get('start') ? Number(searchParams.get('start')) : undefined;
  const endLineParam = searchParams.get('end') ? Number(searchParams.get('end')) : undefined;

  useEffect(() => {
    if (!activeRepo) return;
    const ctrl = new AbortController();
    setLoadingFiles(true);
    codeSageApi
      .listFiles(activeRepo.id, '', ctrl.signal)
      .then((res) => {
        setFiles(res.files);
        const initialPath =
          requestedPath && res.files.some((f) => f.path === requestedPath)
            ? requestedPath
            : res.files[0]?.path;
        if (initialPath && initialPath !== requestedPath) {
          setSearchParams({ file: initialPath }, { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));

    return () => ctrl.abort();
  }, [activeRepo?.id]);

  useEffect(() => {
    if (!activeRepo || !requestedPath) return;
    const ctrl = new AbortController();
    setLoadingContent(true);
    codeSageApi
      .getFileContent(activeRepo.id, requestedPath, ctrl.signal)
      .then((res) => setSelectedFile(res.file))
      .catch(() => setSelectedFile(null))
      .finally(() => setLoadingContent(false));

    return () => ctrl.abort();
  }, [activeRepo?.id, requestedPath]);

  const groupedByDir = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const filtered = files.filter(
      (f) =>
        !q ||
        f.path.toLowerCase().includes(q) ||
        f.symbols.some((s) => s.name.toLowerCase().includes(q))
    );

    const map = new Map<string, Omit<RepoFile, 'content'>[]>();
    for (const f of filtered) {
      const parts = f.path.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)';
      const arr = map.get(dir) || [];
      arr.push(f);
      map.set(dir, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [files, filterText]);

  const handleAskAboutFile = async () => {
    if (!selectedFile) return;
    navigate('/ask');
    await sendQuestion(`Why is ${selectedFile.path} structured this way and how does it fit into the architecture?`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Repository Explorer
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Inspect discovered files, AST symbols, imports, and exact cited line ranges in{' '}
            <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>
          </p>
        </div>

        {selectedFile && (
          <button
            type="button"
            onClick={handleAskAboutFile}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs sm:text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquareCode className="w-4 h-4" />
            <span>Ask CodeSage About This File</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* File Tree Sidebar */}
        <aside className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-[#071A35] overflow-hidden">
          <div className="p-3 border-b border-slate-800/80 bg-[#041126]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter files or symbols..."
                aria-label="Filter repository files"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#020817] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563FF]"
              />
            </div>
          </div>

          <div className="max-h-[640px] overflow-y-auto p-2 space-y-2">
            {loadingFiles ? (
              <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading file tree...</span>
              </div>
            ) : groupedByDir.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No files match "{filterText}".
              </div>
            ) : (
              groupedByDir.map(([dir, dirFiles]) => {
                const isClosed = Boolean(collapsedDirs[dir]);
                return (
                  <div key={dir}>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedDirs((prev) => ({ ...prev, [dir]: !prev[dir] }))
                      }
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-[#0A2042]/60 text-left cursor-pointer"
                    >
                      {isClosed ? (
                        <Folder className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />
                      ) : (
                        <FolderOpen className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      )}
                      <span className="font-mono truncate">{dir}</span>
                    </button>

                    {!isClosed && (
                      <div className="pl-4 mt-0.5 space-y-0.5">
                        {dirFiles.map((f) => {
                          const active = f.path === requestedPath;
                          return (
                            <button
                              key={f.path}
                              type="button"
                              onClick={() => setSearchParams({ file: f.path })}
                              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left cursor-pointer ${
                                active
                                  ? 'bg-[#2563FF] text-white font-medium'
                                  : 'text-slate-300 hover:bg-[#0A2042] hover:text-white'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                <span className="font-mono truncate">{f.name}</span>
                              </div>
                              <span className="text-[10px] opacity-75 tabular-nums shrink-0">
                                {f.lineCount}L
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Source Viewer & Symbol Outline */}
        <div className="lg:col-span-8 space-y-4">
          {loadingContent ? (
            <div className="rounded-xl border border-slate-800 bg-[#071A35] p-12 flex items-center justify-center gap-2 text-sm text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
              <span>Loading verbatim source file...</span>
            </div>
          ) : !selectedFile ? (
            <div className="rounded-xl border border-slate-800 bg-[#071A35] p-12 text-center text-sm text-slate-400">
              Select a file from the repository tree to inspect its source code and extracted symbols.
            </div>
          ) : (
            <>
              {/* Extracted Symbols Jump Bar */}
              {selectedFile.symbols.length > 0 && (
                <div className="rounded-xl border border-slate-800/80 bg-[#071A35] p-3.5">
                  <div className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-violet-300" />
                    <span>
                      Extracted AST Symbols ({selectedFile.symbols.length}) — click to highlight lines:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFile.symbols.map((sym) => (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() =>
                          setSearchParams({
                            file: selectedFile.path,
                            start: String(sym.startLine),
                            end: String(sym.endLine),
                          })
                        }
                        className="px-2.5 py-1 rounded-md bg-[#020817] hover:bg-[#2563FF]/30 border border-slate-800 font-mono text-xs text-cyan-300 transition-colors cursor-pointer"
                      >
                        {sym.name}{' '}
                        <span className="text-slate-500 tabular-nums">L{sym.startLine}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Verbatim Source Code */}
              <CodeBlockViewer
                code={selectedFile.content}
                language={selectedFile.language}
                filePath={selectedFile.path}
                startLine={1}
                highlightStart={startLineParam}
                highlightEnd={endLineParam}
                maxHeightClass="max-h-[620px]"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
