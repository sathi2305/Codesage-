import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  GitFork,
  Loader2,
  MessageSquareCode,
  ShieldAlert,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { codeSageApi } from '../services/api';
import type { BlastRadiusReport, DependencyPathResult, RepoFile } from '../types';

export const DependenciesPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRepo, sendQuestion } = useCodeSage();

  const [files, setFiles] = useState<Omit<RepoFile, 'content'>[]>([]);
  const [targetFile, setTargetFile] = useState('');
  const [fromFile, setFromFile] = useState('');
  const [toFile, setToFile] = useState('');

  const [blastRadius, setBlastRadius] = useState<BlastRadiusReport | null>(null);
  const [shortestPath, setShortestPath] = useState<DependencyPathResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeRepo) return;
    const ctrl = new AbortController();
    codeSageApi
      .listFiles(activeRepo.id, '', ctrl.signal)
      .then((res) => {
        setFiles(res.files);
        const sourceFiles = res.files.filter((f) => f.fileType === 'source');
        const defaultTarget =
          sourceFiles.find((f) => f.path.includes('jwt') || f.path.includes('hmac'))?.path ||
          sourceFiles[0]?.path ||
          res.files[0]?.path ||
          '';
        const defaultFrom =
          sourceFiles.find((f) => f.path.includes('routes'))?.path ||
          res.files[0]?.path ||
          '';
        const defaultTo =
          res.files.find((f) => f.fileType === 'config')?.path ||
          res.files[res.files.length - 1]?.path ||
          '';

        setTargetFile(defaultTarget);
        setFromFile(defaultFrom);
        setToFile(defaultTo);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [activeRepo?.id]);

  useEffect(() => {
    if (!activeRepo || !targetFile) return;
    const ctrl = new AbortController();
    setLoading(true);
    codeSageApi
      .getDependencies(
        activeRepo.id,
        {
          target: targetFile,
          from: fromFile || undefined,
          to: toFile || undefined,
        },
        ctrl.signal
      )
      .then((res) => {
        setBlastRadius(res.blastRadius);
        setShortestPath(res.shortestPath);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [activeRepo?.id, targetFile, fromFile, toFile]);

  const askBlastQuestion = async () => {
    if (!targetFile) return;
    navigate('/ask');
    await sendQuestion(`What could break if ${targetFile} changes?`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Dependencies &amp; Blast-Radius Explorer
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Simulate downstream impact before modifying shared modules and trace shortest import paths in{' '}
            <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>
          </p>
        </div>

        {targetFile && (
          <button
            type="button"
            onClick={askBlastQuestion}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs sm:text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquareCode className="w-4 h-4" />
            <span>Ask AI About This Blast Radius</span>
          </button>
        )}
      </div>

      {/* Section 1: Blast Radius Impact Simulator */}
      <section className="rounded-xl border border-slate-800/80 bg-[#071A35] p-5 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex-1 min-w-[260px]">
            <label htmlFor="blast-target-select" className="block text-xs font-medium text-slate-300 mb-1.5">
              Select Module to Simulate Modification ("What could break if this file changes?")
            </label>
            <select
              id="blast-target-select"
              value={targetFile}
              onChange={(e) => setTargetFile(e.target.value)}
              className="w-full max-w-xl px-3.5 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-[#2563FF]"
            >
              {files.map((f) => (
                <option key={f.path} value={f.path} className="bg-[#041126]">
                  {f.path} ({f.fileType})
                </option>
              ))}
            </select>
          </div>

          {blastRadius && (
            <div className="flex items-center gap-2 text-xs tabular-nums">
              {blastRadius.riskLevel === 'high' ? (
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              ) : blastRadius.riskLevel === 'moderate' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-medium text-white capitalize">
                {blastRadius.riskLevel} Impact Risk
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
            <span>Computing dependency graph blast radius...</span>
          </div>
        ) : blastRadius ? (
          <div className="space-y-5">
            <p className="text-sm text-slate-200 leading-relaxed">{blastRadius.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Direct & Transitive Dependents */}
              <div className="rounded-lg border border-slate-800 bg-[#020817] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 tabular-nums">
                  <span>Dependent Source Modules</span>
                  <span className="text-cyan-300">
                    {blastRadius.directDependents.length + blastRadius.transitiveDependents.length}
                  </span>
                </div>
                {blastRadius.directDependents.length === 0 &&
                blastRadius.transitiveDependents.length === 0 ? (
                  <p className="text-xs text-slate-500">No internal source modules import this file.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs font-mono">
                    {blastRadius.directDependents.map((d) => (
                      <li key={d.file} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/explorer?file=${encodeURIComponent(d.file)}&start=${
                                d.line || 1
                              }&end=${(d.line || 1) + 12}`
                            )
                          }
                          className="text-cyan-300 hover:underline truncate text-left cursor-pointer"
                        >
                          {d.file}
                        </button>
                        <span className="text-[10px] text-slate-400 shrink-0">Direct</span>
                      </li>
                    ))}
                    {blastRadius.transitiveDependents.map((t) => (
                      <li key={t} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/explorer?file=${encodeURIComponent(t)}`)}
                          className="text-violet-300 hover:underline truncate text-left cursor-pointer"
                        >
                          {t}
                        </button>
                        <span className="text-[10px] text-slate-400 shrink-0">Transitive</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Affected API Routes */}
              <div className="rounded-lg border border-slate-800 bg-[#020817] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 tabular-nums">
                  <span>Exposed API Endpoints Affected</span>
                  <span className="text-emerald-300">{blastRadius.affectedEndpoints.length}</span>
                </div>
                {blastRadius.affectedEndpoints.length === 0 ? (
                  <p className="text-xs text-slate-500">No HTTP endpoints directly or transitively bound.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs font-mono">
                    {blastRadius.affectedEndpoints.map((ep) => (
                      <li key={`${ep.filePath}:${ep.route}`} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/explorer?file=${encodeURIComponent(ep.filePath)}&start=${ep.line}&end=${
                                ep.line + 18
                              }`
                            )
                          }
                          className="text-emerald-300 hover:underline truncate text-left cursor-pointer"
                        >
                          {ep.route}
                        </button>
                        <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                          L{ep.line}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Covering Tests */}
              <div className="rounded-lg border border-slate-800 bg-[#020817] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-300 tabular-nums">
                  <span>Verification Test Suites</span>
                  <span className="text-teal-300">{blastRadius.coveringTests.length}</span>
                </div>
                {blastRadius.coveringTests.length === 0 ? (
                  <p className="text-xs text-amber-300/90">
                    Warning: No indexed test suite directly imports this module chain.
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {blastRadius.coveringTests.map((tc) => (
                      <li key={tc.testFile}>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/explorer?file=${encodeURIComponent(tc.testFile)}`)
                          }
                          className="inline-flex items-center gap-1.5 font-mono text-teal-300 hover:underline cursor-pointer"
                        >
                          <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{tc.testFile}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Section 2: Shortest Dependency Path Solver */}
      <section className="rounded-xl border border-slate-800/80 bg-[#071A35] p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Shortest Dependency Path Finder</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Compute directed import/test hops connecting any two repository files.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="path-from-select" className="block text-xs text-slate-300 mb-1">
              Source File (Caller / Importer)
            </label>
            <select
              id="path-from-select"
              value={fromFile}
              onChange={(e) => setFromFile(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs font-mono text-white"
            >
              {files.map((f) => (
                <option key={f.path} value={f.path} className="bg-[#041126]">
                  {f.path}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="path-to-select" className="block text-xs text-slate-300 mb-1">
              Target File (Dependency)
            </label>
            <select
              id="path-to-select"
              value={toFile}
              onChange={(e) => setToFile(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs font-mono text-white"
            >
              {files.map((f) => (
                <option key={f.path} value={f.path} className="bg-[#041126]">
                  {f.path}
                </option>
              ))}
            </select>
          </div>
        </div>

        {shortestPath && (
          <div className="rounded-lg border border-slate-800 bg-[#020817] p-4">
            {shortestPath.found ? (
              <div className="flex flex-wrap items-center gap-2">
                {shortestPath.hops.map((hop, idx) => (
                  <React.Fragment key={`${hop.file}-${idx}`}>
                    {idx > 0 && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                        <span>—[{hop.relation}]→</span>
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/explorer?file=${encodeURIComponent(hop.file)}&start=${
                            hop.line || 1
                          }&end=${(hop.line || 1) + 10}`
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0A2042] hover:bg-[#2563FF] font-mono text-xs text-white transition-colors cursor-pointer"
                    >
                      <GitFork className="w-3 h-3 text-cyan-300" />
                      <span>{hop.file}</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </button>
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No directed static import chain found from <span className="font-mono text-slate-200">{fromFile}</span> to{' '}
                <span className="font-mono text-slate-200">{toFile}</span>. Try swapping Source and Target or inspecting cross-module calls in Knowledge Graph.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
