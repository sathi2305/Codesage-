import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { codeSageApi } from '../services/api';
import { InvestigationToolbox } from '../components/investigation/InvestigationToolbox';
import type { CodeAnalysisSummary } from '../types';

const CHART_COLORS = ['#2563FF', '#22D3EE', '#793CFF', '#10B981', '#F59E0B', '#60A5FA'];

export const CodeAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRepo } = useCodeSage();
  const [analysis, setAnalysis] = useState<CodeAnalysisSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeRepo) return;
    const ctrl = new AbortController();
    setLoading(true);
    codeSageApi
      .getAnalysis(activeRepo.id, ctrl.signal)
      .then((res) => setAnalysis(res))
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [activeRepo?.id]);

  if (loading || !analysis) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#071A35] p-12 flex items-center justify-center gap-2 text-sm text-slate-300">
        <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
        <span>Computing static repository analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Code Analysis &amp; Structural Insights
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Quantitative AST telemetry, language distribution, architectural layers, and verifiable static findings for{' '}
          <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>
        </p>
      </div>

      {/* Top KPI Strip (Clean structured stat grid with hairline dividers) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-slate-800/80 bg-[#071A35] divide-y lg:divide-y-0 lg:divide-x divide-slate-800/80">
        <div className="p-4">
          <div className="text-xs text-slate-400">Indexed Files</div>
          <div className="text-2xl font-bold text-white mt-1 tabular-nums">{analysis.totalFiles}</div>
          <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
            {analysis.testFilesCount} test · {analysis.configFilesCount} config · {analysis.docFilesCount} docs
          </div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-400">Source Lines Analyzed</div>
          <div className="text-2xl font-bold text-white mt-1 tabular-nums">
            {analysis.totalLines.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Read-only static parser</div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-400">Extracted AST Symbols</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1 tabular-nums">
            {analysis.totalSymbols}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Functions, classes &amp; endpoints</div>
        </div>

        <div className="p-4">
          <div className="text-xs text-slate-400">Import Statements</div>
          <div className="text-2xl font-bold text-violet-300 mt-1 tabular-nums">
            {analysis.totalImports}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Internal &amp; package edges</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border border-slate-800/80 bg-[#071A35] p-5">
          <h2 className="text-sm font-semibold text-white">Language Distribution (Lines of Code)</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">
            Measured across discovered repository files
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.languages} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="language"
                  stroke="#cbd5e1"
                  fontSize={11}
                  width={95}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#041126',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f1f5f9',
                  }}
                />
                <Bar dataKey="lines" radius={[0, 4, 4, 0]}>
                  {analysis.languages.map((_entry, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800/80 bg-[#071A35] p-5">
          <h2 className="text-sm font-semibold text-white">Extracted Symbol Breakdown</h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">
            Functions, classes, and HTTP API endpoints discovered statically
          </p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysis.symbolBreakdown} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="kind" stroke="#cbd5e1" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#041126',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#f1f5f9',
                  }}
                />
                <Bar dataKey="count" fill="#22D3EE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Architectural Layers & High-Coupling Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 rounded-xl border border-slate-800/80 bg-[#071A35] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Detected Architectural Layers</h2>
          <div className="divide-y divide-slate-800/80">
            {analysis.architecturalLayers.map((layer) => (
              <div key={layer.layer} className="py-3 first:pt-1 last:pb-0">
                <div className="flex items-center justify-between text-xs font-medium text-white">
                  <span>{layer.layer}</span>
                  <span className="text-cyan-300 tabular-nums">{layer.files.length} files</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{layer.responsibility}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-7 rounded-xl border border-slate-800/80 bg-[#071A35] overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800/80">
            <h2 className="text-sm font-semibold text-white">Highest-Coupling Modules</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Ranked by combined incoming and outgoing Knowledge Graph edges
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#041126] border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-medium">File Path</th>
                  <th className="py-2.5 px-4 font-medium text-right">Fan-In</th>
                  <th className="py-2.5 px-4 font-medium text-right">Fan-Out</th>
                  <th className="py-2.5 px-4 font-medium text-right">Lines</th>
                  <th className="py-2.5 px-4 font-medium text-right">Symbols</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {analysis.topCoupledFiles.map((row) => (
                  <tr
                    key={row.filePath}
                    onClick={() => navigate(`/explorer?file=${encodeURIComponent(row.filePath)}`)}
                    className="hover:bg-[#0A2042]/60 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-cyan-300 truncate max-w-[260px]">
                      {row.filePath}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-200">
                      {row.inDegree}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-200">
                      {row.outDegree}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-400">
                      {row.lineCount}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-400">
                      {row.symbolCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Interactive Code Investigation Lab & Toolbox (7 Core Analysis Utilities) */}
      <InvestigationToolbox analysis={analysis} />

      {/* Verifiable Static Findings */}
      <section className="rounded-xl border border-slate-800/80 bg-[#071A35] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/80">
          <h2 className="text-sm font-semibold text-white">
            Evidence-Backed Structural &amp; Security Findings ({analysis.findings.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every finding links directly to the discovered file and line range
          </p>
        </div>
        <div className="divide-y divide-slate-800/80">
          {analysis.findings.map((f) => (
            <div key={f.id} className="p-4 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      f.severity === 'warning'
                        ? 'text-amber-300 font-medium'
                        : f.severity === 'architectural'
                        ? 'text-cyan-300 font-medium'
                        : 'text-slate-300 font-medium'
                    }
                  >
                    {f.title}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono text-slate-400 tabular-nums">
                    {f.filePath}:L{f.startLine}–L{f.endLine}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{f.description}</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/explorer?file=${encodeURIComponent(f.filePath)}&start=${f.startLine}&end=${f.endLine}`
                  )
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0A2042] hover:bg-[#2563FF] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Inspect Lines</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
