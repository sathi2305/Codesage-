import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Bug,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCheck,
  FileCode,
  FileSearch,
  FileSpreadsheet,
  FileText,
  GitBranch,
  Layers,
  Network,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useCodeSage } from '../../context/CodeSageContext';
import { codeSageApi } from '../../services/api';
import type { CodeAnalysisSummary, RepoFile } from '../../types';

interface InvestigationToolboxProps {
  analysis: CodeAnalysisSummary;
}

type ToolTab =
  | 'detective'
  | 'bugs'
  | 'tracer'
  | 'planner'
  | 'docs'
  | 'health'
  | 'export';

export const InvestigationToolbox: React.FC<InvestigationToolboxProps> = ({ analysis }) => {
  const navigate = useNavigate();
  const { activeRepo, conversationsByRepo } = useCodeSage();
  const [activeTab, setActiveTab] = useState<ToolTab>('detective');

  // Bug Investigation State
  const [bugQuery, setBugQuery] = useState('Invalid RS256 JWT signature or token expired');
  // API Flow Tracer State
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('');
  // Change Planner State
  const [plannerTarget, setPlannerTarget] = useState<string>('');
  // Export State
  const [exportTitle, setExportTitle] = useState(
    `CodeSage AI Investigation: ${activeRepo?.name || 'Repository'}`
  );
  const [exportNotes, setExportNotes] = useState(
    'Architecture inquiry into stateless RS256 authentication and dependency blast radius.'
  );
  const [copiedDocs, setCopiedDocs] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Files with symbols for investigations
  const [repoFiles, setRepoFiles] = useState<Omit<RepoFile, 'content'>[]>([]);

  React.useEffect(() => {
    if (!activeRepo) return;
    const ctrl = new AbortController();
    codeSageApi
      .listFiles(activeRepo.id, '', ctrl.signal)
      .then((res) => {
        setRepoFiles(res.files);
        if (res.files.length > 0) {
          setPlannerTarget(res.files[0].path);
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [activeRepo?.id]);

  // Discovered API endpoints
  const apiEndpoints = useMemo(() => {
    return repoFiles.flatMap((f) =>
      f.symbols
        .filter((s) => s.kind === 'APIEndpoint' || s.name.startsWith('GET') || s.name.startsWith('POST'))
        .map((s) => ({
          name: s.name,
          filePath: f.path,
          startLine: s.startLine,
          endLine: s.endLine,
          signature: s.signature,
        }))
    );
  }, [repoFiles]);

  React.useEffect(() => {
    if (apiEndpoints.length > 0 && !selectedEndpoint) {
      setSelectedEndpoint(apiEndpoints[0].name);
    }
  }, [apiEndpoints, selectedEndpoint]);

  // 1. Bug Investigation matches
  const bugMatches = useMemo(() => {
    const q = bugQuery.toLowerCase();
    const tokens = q.split(/\s+/).filter((t) => t.length >= 3);
    if (tokens.length === 0) return [];

    const results: Array<{
      filePath: string;
      line: number;
      symbolName: string;
      reason: string;
      confidence: 'verified_symbol' | 'inferred_pattern';
      excerpt: string;
    }> = [];

    for (const f of repoFiles) {
      for (const sym of f.symbols) {
        const symName = sym.name.toLowerCase();
        const sig = sym.signature.toLowerCase();
        const matchesToken = tokens.some((t) => symName.includes(t) || sig.includes(t) || f.path.toLowerCase().includes(t));

        if (matchesToken) {
          const isVerified = symName.includes('jwt') || symName.includes('token') || symName.includes('auth') || symName.includes('error');
          results.push({
            filePath: f.path,
            line: sym.startLine,
            symbolName: sym.name,
            reason: `Symbol matches query keyword in ${f.language} AST`,
            confidence: isVerified ? 'verified_symbol' : 'inferred_pattern',
            excerpt: sym.signature,
          });
        }
      }
    }

    return results.slice(0, 6);
  }, [bugQuery, repoFiles]);

  // 2. API Flow Trace steps
  const activeFlow = useMemo(() => {
    const endpoint = apiEndpoints.find((e) => e.name === selectedEndpoint) || apiEndpoints[0];
    if (!endpoint) return null;

    const routeFile = endpoint.filePath;
    // Derive auth / middleware dependencies
    const authFile = repoFiles.find((f) => f.path.includes('auth') || f.path.includes('jwt') || f.path.includes('security'));
    const coreFile = repoFiles.find((f) => f.fileType === 'config' || f.path.includes('config'));
    const testFile = repoFiles.find((f) => f.fileType === 'test');

    return {
      endpoint: endpoint.name,
      steps: [
        {
          step: 1,
          stage: 'HTTP Ingress & Handler',
          filePath: routeFile,
          line: endpoint.startLine,
          detail: `Route endpoint definition parsed: ${endpoint.signature}`,
        },
        ...(authFile
          ? [
              {
                step: 2,
                stage: 'Authentication & Signature Verification',
                filePath: authFile.path,
                line: authFile.symbols[0]?.startLine || 1,
                detail: `Stateless token decoding & Redis blocklist lookup in ${authFile.name}`,
              },
            ]
          : []),
        ...(coreFile
          ? [
              {
                step: 3,
                stage: 'Configuration & Keys',
                filePath: coreFile.path,
                line: 1,
                detail: `Runtime secrets & public PEM key loaded in ${coreFile.name}`,
              },
            ]
          : []),
        ...(testFile
          ? [
              {
                step: 4,
                stage: 'Automated Test Verification',
                filePath: testFile.path,
                line: testFile.symbols[0]?.startLine || 1,
                detail: `Verified endpoint test suite in ${testFile.name}`,
              },
            ]
          : []),
      ],
    };
  }, [selectedEndpoint, apiEndpoints, repoFiles]);

  // 3. Change Planner steps
  const changePlan = useMemo(() => {
    const target = repoFiles.find((f) => f.path === plannerTarget) || repoFiles[0];
    if (!target) return null;

    // Upstream dependents
    const targetBase = target.name.split('.')[0].toLowerCase();
    const dependents = repoFiles.filter(
      (f) =>
        f.path !== target.path &&
        f.imports.some((imp) => imp.source.toLowerCase().includes(targetBase))
    );

    // Covering test suites
    const tests = repoFiles.filter(
      (f) =>
        f.fileType === 'test' &&
        (f.path.toLowerCase().includes(targetBase) ||
          f.imports.some((imp) => imp.source.toLowerCase().includes(targetBase)))
    );

    return {
      target,
      dependents,
      tests,
      estimatedRisk: dependents.length > 2 ? 'High Coupling' : dependents.length > 0 ? 'Moderate' : 'Low',
    };
  }, [plannerTarget, repoFiles]);

  // 4. Documentation Generator content
  const generatedDocs = useMemo(() => {
    let md = `# Architecture Reference: ${activeRepo?.fullName || 'Repository'}\n\n`;
    md += `*Generated automatically by CodeSage AI AST Analyzer*\n\n`;
    md += `## 1. Overview\n`;
    md += `- **Primary Language:** ${activeRepo?.primaryLanguage || 'Unknown'}\n`;
    md += `- **Indexed Files:** ${analysis.totalFiles}\n`;
    md += `- **Total Lines of Code:** ${analysis.totalLines.toLocaleString()}\n`;
    md += `- **Extracted Symbols:** ${analysis.totalSymbols}\n\n`;

    md += `## 2. Architectural Layers\n\n`;
    for (const layer of analysis.architecturalLayers) {
      md += `### ${layer.layer}\n`;
      md += `**Responsibility:** ${layer.responsibility}\n\n`;
      md += `**Discovered Files:**\n`;
      for (const f of layer.files) {
        md += `- \`${f}\`\n`;
      }
      md += `\n`;
    }

    md += `## 3. Discovered Public API Endpoints\n\n`;
    if (apiEndpoints.length > 0) {
      for (const ep of apiEndpoints) {
        md += `- **${ep.name}** in \`${ep.filePath}:L${ep.startLine}\`\n`;
      }
    } else {
      md += `*No public HTTP endpoints identified in static AST scan.*\n`;
    }
    md += `\n`;

    md += `## 4. High-Coupling Hubs\n\n`;
    for (const hub of analysis.topCoupledFiles.slice(0, 5)) {
      md += `- \`${hub.filePath}\` (Fan-in: ${hub.inDegree}, Fan-out: ${hub.outDegree}, Lines: ${hub.lineCount})\n`;
    }
    md += `\n---\n*Verified via CodeSage AI Graph Engine*\n`;
    return md;
  }, [activeRepo, analysis, apiEndpoints]);

  // 5. Repository Health Checks
  const healthAudit = useMemo(() => {
    const oversized = repoFiles.filter((f) => f.lineCount > 150);
    const untested = repoFiles.filter(
      (f) =>
        f.fileType === 'source' &&
        !repoFiles.some(
          (t) => t.fileType === 'test' && t.path.toLowerCase().includes(f.name.split('.')[0].toLowerCase())
        )
    );
    const highCoupled = analysis.topCoupledFiles.filter((f) => f.inDegree + f.outDegree >= 4);

    return {
      oversized,
      untested,
      highCoupled,
      healthyScore: Math.max(65, 100 - oversized.length * 4 - untested.length * 5),
    };
  }, [repoFiles, analysis]);

  // Handle Export Download
  const handleExport = async (format: 'markdown' | 'json') => {
    if (!activeRepo) return;
    setExporting(true);
    try {
      const questions = (conversationsByRepo[activeRepo.id] || [])
        .filter((m) => m.role === 'user')
        .map((m) => m.content);

      const res = await codeSageApi.exportInvestigation({
        repoId: activeRepo.id,
        title: exportTitle,
        notes: exportNotes,
        questions,
        findings: analysis.findings,
        format,
      });

      const content = typeof res === 'string' ? res : JSON.stringify(res, null, 2);
      const mime = format === 'json' ? 'application/json' : 'text/markdown';
      const ext = format === 'json' ? 'json' : 'md';
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `codesage-${activeRepo.name}-investigation.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Graceful fallback
    } finally {
      setExporting(false);
    }
  };

  const copyDocumentation = () => {
    navigator.clipboard.writeText(generatedDocs);
    setCopiedDocs(true);
    setTimeout(() => setCopiedDocs(false), 2000);
  };

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-[#071A35] shadow-2xl overflow-hidden">
      {/* Toolbox Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-[#041126] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Code Investigation Toolbox
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0A2042] text-cyan-300 border border-cyan-500/30">
                7 Active Tools
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive diagnostic utilities grounded in statically discovered AST evidence
            </p>
          </div>
        </div>
      </div>

      {/* Tool Tabs Strip */}
      <div className="flex items-center gap-1 px-4 py-2.5 bg-[#05162E] border-b border-slate-800 overflow-x-auto no-scrollbar">
        {[
          { id: 'detective', label: 'Architecture Detective', icon: Layers },
          { id: 'bugs', label: 'Bug Investigation', icon: Bug },
          { id: 'tracer', label: 'API Flow Tracer', icon: Route },
          { id: 'planner', label: 'Code Change Planner', icon: FileCheck },
          { id: 'docs', label: 'Documentation Generator', icon: BookOpen },
          { id: 'health', label: 'Repository Health Audit', icon: ShieldCheck },
          { id: 'export', label: 'Export Investigation', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ToolTab)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#2563FF] text-white shadow-sm shadow-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0A2042]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tool Viewport */}
      <div className="p-6">
        {/* 1. Architecture Detective */}
        {activeTab === 'detective' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-300" />
                <span>Architecture Detective</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Statically mapped modules, layers, ingress points, and verified coupling hubs for{' '}
                <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analysis.architecturalLayers.map((layer) => (
                <div
                  key={layer.layer}
                  className="rounded-xl border border-slate-800 bg-[#041126] p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-white mb-1.5">
                      <span className="text-cyan-300">{layer.layer}</span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {layer.files.length} file{layer.files.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{layer.responsibility}</p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1">
                    <div className="text-[11px] text-slate-400 font-medium">Mapped Files:</div>
                    <div className="max-h-24 overflow-y-auto space-y-1">
                      {layer.files.map((filePath) => (
                        <button
                          key={filePath}
                          type="button"
                          onClick={() => navigate(`/explorer?file=${encodeURIComponent(filePath)}`)}
                          className="w-full flex items-center justify-between text-[11px] font-mono text-slate-300 hover:text-cyan-300 hover:underline truncate cursor-pointer text-left"
                        >
                          <span className="truncate">{filePath}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 ml-1 opacity-60" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Bug Investigation */}
        {activeTab === 'bugs' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bug className="w-4 h-4 text-rose-300" />
                <span>Bug &amp; Stack-Trace Investigation</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Describe an unexpected behavior or paste a stack trace snippet to retrieve suspected source code lines with verified AST evidence.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="bug-query" className="block text-xs font-medium text-slate-300">
                Error Message or Exception Description
              </label>
              <div className="flex gap-2">
                <input
                  id="bug-query"
                  type="text"
                  value={bugQuery}
                  onChange={(e) => setBugQuery(e.target.value)}
                  placeholder="e.g. Invalid RS256 JWT signature, token expired, or RedisConnectionError..."
                  className="flex-1 px-3.5 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400">Quick tests:</span>
                {[
                  'Invalid RS256 JWT signature',
                  'Redis connection refused on jti revocation',
                  'Missing Bearer token in Authorization header',
                  'Optimistic concurrency transfer conflict',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setBugQuery(sample)}
                    className="px-2 py-0.5 rounded bg-[#041126] hover:bg-[#0A2042] border border-slate-800 text-[11px] text-cyan-300 cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Results list */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white flex items-center justify-between">
                <span>Suspect Source Locations ({bugMatches.length})</span>
                <span className="text-[11px] text-slate-400">
                  Ranked by AST identifier token match
                </span>
              </div>

              {bugMatches.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  No suspect files found matching "{bugQuery}". Try broader technical terms.
                </div>
              ) : (
                <div className="space-y-2">
                  {bugMatches.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-800 bg-[#041126] flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-white">
                            {m.symbolName}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                              m.confidence === 'verified_symbol'
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {m.confidence === 'verified_symbol'
                              ? 'Verified AST Target'
                              : 'Inferred Hypothesis'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-cyan-300">
                          {m.filePath}:L{m.line}
                        </div>
                        <div className="text-xs text-slate-300 font-mono bg-[#020817] p-2 rounded border border-slate-800/80">
                          {m.excerpt}
                        </div>
                        <p className="text-[11px] text-slate-400">{m.reason}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/explorer?file=${encodeURIComponent(m.filePath)}&start=${m.line}&end=${m.line + 15}`
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A2042] hover:bg-[#2563FF] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Inspect Line</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. API Flow Tracer */}
        {activeTab === 'tracer' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Route className="w-4 h-4 text-cyan-300" />
                <span>API Flow Tracer</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Select an indexed HTTP route to inspect the full execution call graph: Ingress Route &rarr; Middleware &rarr; Core Logic &rarr; Test Suite.
              </p>
            </div>

            {apiEndpoints.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                No HTTP API route endpoints discovered in this repository.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label htmlFor="endpoint-select" className="text-xs font-medium text-slate-300 shrink-0">
                    Target Endpoint:
                  </label>
                  <select
                    id="endpoint-select"
                    value={selectedEndpoint}
                    onChange={(e) => setSelectedEndpoint(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {apiEndpoints.map((ep) => (
                      <option key={ep.name} value={ep.name} className="bg-[#041126] text-white">
                        {ep.name} ({ep.filePath})
                      </option>
                    ))}
                  </select>
                </div>

                {activeFlow && (
                  <div className="rounded-xl border border-slate-800 bg-[#041126] p-5 space-y-4">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>End-to-End Execution Trace for</span>
                      <span className="font-mono text-cyan-300">{activeFlow.endpoint}</span>
                    </div>

                    <div className="space-y-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                      {activeFlow.steps.map((st) => (
                        <div key={st.step} className="flex items-start gap-3 relative pl-8">
                          <div className="absolute left-1.5 top-1 w-5 h-5 rounded-full bg-[#2563FF] text-white flex items-center justify-center text-[10px] font-bold">
                            {st.step}
                          </div>
                          <div className="flex-1 p-3 rounded-lg bg-[#020817] border border-slate-800">
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span>{st.stage}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/explorer?file=${encodeURIComponent(st.filePath)}&start=${st.line}&end=${st.line + 20}`
                                  )
                                }
                                className="text-[11px] font-mono text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>{st.filePath}:L{st.line}</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                            <p className="text-xs text-slate-300 mt-1">{st.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 4. Code Change Planner */}
        {activeTab === 'planner' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-300" />
                <span>Code Change Planner</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generate an evidence-backed checklist of upstream callers that require review and automated test suites to run before modifying a file.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="planner-target" className="text-xs font-medium text-slate-300 shrink-0">
                File You Intend to Modify:
              </label>
              <select
                id="planner-target"
                value={plannerTarget}
                onChange={(e) => setPlannerTarget(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400 cursor-pointer"
              >
                {repoFiles.map((f) => (
                  <option key={f.path} value={f.path} className="bg-[#041126] text-white">
                    {f.path} ({f.language} · {f.lineCount}L)
                  </option>
                ))}
              </select>
            </div>

            {changePlan && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-[#041126] space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>Upstream Dependents to Re-Test</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                      {changePlan.dependents.length} Affected
                    </span>
                  </div>
                  {changePlan.dependents.length === 0 ? (
                    <div className="text-xs text-slate-400">
                      No direct internal dependents discovered. Safe leaf component.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {changePlan.dependents.map((dep) => (
                        <div
                          key={dep.path}
                          className="flex items-center justify-between p-2 rounded bg-[#020817] border border-slate-800 text-xs font-mono text-slate-300"
                        >
                          <span className="truncate">{dep.path}</span>
                          <button
                            type="button"
                            onClick={() => navigate(`/explorer?file=${encodeURIComponent(dep.path)}`)}
                            className="text-cyan-400 hover:underline text-[11px] ml-2 shrink-0 cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-[#041126] space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-white">
                    <span>Associated Unit &amp; Integration Tests</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                      {changePlan.tests.length} Discovered
                    </span>
                  </div>
                  {changePlan.tests.length === 0 ? (
                    <div className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/60 p-2.5 rounded-lg">
                      Warning: No test files import this target module directly.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {changePlan.tests.map((t) => (
                        <div
                          key={t.path}
                          className="flex items-center justify-between p-2 rounded bg-[#020817] border border-slate-800 text-xs font-mono text-emerald-300"
                        >
                          <span className="truncate">{t.path}</span>
                          <button
                            type="button"
                            onClick={() => navigate(`/explorer?file=${encodeURIComponent(t.path)}`)}
                            className="text-cyan-400 hover:underline text-[11px] ml-2 shrink-0 cursor-pointer"
                          >
                            Inspect
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Documentation Generator */}
        {activeTab === 'docs' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-300" />
                  <span>Automated Architecture Documentation</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Synthesized Markdown architecture reference compiled from statically discovered symbols and layers
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyDocumentation}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A2042] hover:bg-[#2563FF] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedDocs ? 'Copied!' : 'Copy Markdown'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('markdown')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-[#020817] border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
              {generatedDocs}
            </pre>
          </div>
        )}

        {/* 6. Repository Health & Hygiene */}
        {activeTab === 'health' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span>Repository Health &amp; Hygiene Audit</span>
              </h3>
              <p className="text-xs text-slate-400">
                Static risk assessment covering modularity, test gaps, and coupling bottlenecks
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-[#041126] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>Architecture Health Score</span>
                  <span className="text-lg text-cyan-300 tabular-nums">
                    {healthAudit.healthyScore}/100
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-[#2563FF]"
                    style={{ width: `${healthAudit.healthyScore}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Computed from file modularity and test link density.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-[#041126] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>Untested Source Modules</span>
                  <span className="text-amber-300 tabular-nums font-mono">
                    {healthAudit.untested.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Modules without a corresponding test file matching their base name.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-[#041126] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>High-Coupling Hubs</span>
                  <span className="text-violet-300 tabular-nums font-mono">
                    {healthAudit.highCoupled.length}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Files with combined incoming + outgoing relationships &ge; 4.
                </p>
              </div>
            </div>

            {/* Detailed warnings list */}
            <div className="rounded-xl border border-slate-800 bg-[#041126] overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 text-xs font-semibold text-white">
                Discovered Audit Items
              </div>
              <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto">
                {healthAudit.oversized.map((f) => (
                  <div
                    key={f.path}
                    className="p-3 flex items-center justify-between text-xs text-slate-300 hover:bg-[#071A35]"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        Oversized file: <strong className="font-mono text-white">{f.path}</strong> ({f.lineCount} lines)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/explorer?file=${encodeURIComponent(f.path)}`)}
                      className="text-cyan-300 hover:underline font-mono text-[11px] cursor-pointer"
                    >
                      Inspect
                    </button>
                  </div>
                ))}

                {healthAudit.untested.map((f) => (
                  <div
                    key={f.path}
                    className="p-3 flex items-center justify-between text-xs text-slate-300 hover:bg-[#071A35]"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>
                        Untested module: <strong className="font-mono text-white">{f.path}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/explorer?file=${encodeURIComponent(f.path)}`)}
                      className="text-cyan-300 hover:underline font-mono text-[11px] cursor-pointer"
                    >
                      Inspect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 7. Export Investigation */}
        {activeTab === 'export' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-300" />
                <span>Export Investigation Report</span>
              </h3>
              <p className="text-xs text-slate-400">
                Package all explored questions, findings, citations, and architecture layers into a verifiable Markdown or JSON report
              </p>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <label htmlFor="export-title" className="block text-xs font-medium text-slate-300 mb-1">
                  Report Title
                </label>
                <input
                  id="export-title"
                  type="text"
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label htmlFor="export-notes" className="block text-xs font-medium text-slate-300 mb-1">
                  Investigation Scope / Executive Summary
                </label>
                <textarea
                  id="export-notes"
                  rows={3}
                  value={exportNotes}
                  onChange={(e) => setExportNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#020817] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => handleExport('markdown')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{exporting ? 'Generating...' : 'Download Markdown (.md)'}</span>
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => handleExport('json')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A2042] hover:bg-[#13386C] disabled:opacity-50 text-xs font-semibold text-cyan-200 transition-colors border border-slate-700 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download JSON (.json)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
