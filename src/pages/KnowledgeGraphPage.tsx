import React, { useState } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  Code,
  Database,
  Download,
  FileImage,
  ImageIcon,
  Loader2,
  Network,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { KnowledgeGraph3D } from '../components/graph/KnowledgeGraph3D';
import { KnowledgeGraphCanvas } from '../components/graph/KnowledgeGraphCanvas';
import { CodeBlockViewer } from '../components/common/CodeBlockViewer';
import {
  downloadBlob,
  downloadTextAsFile,
  exportKnowledgeGraphToSvg,
  svgToPngBlob,
} from '../utils/graphExporter';

export const KnowledgeGraphPage: React.FC = () => {
  const { activeRepo, activeGraph, triggerShortcutToast } = useCodeSage();
  const [showCypher, setShowCypher] = useState(false);
  const [graphMode, setGraphMode] = useState<'3d' | '2d'>('3d');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<'png' | 'svg' | null>(null);

  const observedCount = activeGraph?.edges.filter((e) => e.certainty === 'observed').length || 0;
  const inferredCount = activeGraph?.edges.filter((e) => e.certainty === 'inferred').length || 0;

  const repoSlug = (activeRepo?.name || 'repository').toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  const handleExportSvg = () => {
    if (!activeGraph) return;
    setIsExporting('svg');
    setExportMenuOpen(false);

    try {
      const svgString = exportKnowledgeGraphToSvg(
        activeGraph,
        activeRepo?.fullName || activeRepo?.name || 'Repository'
      );
      downloadTextAsFile(svgString, `${repoSlug}-knowledge-graph.svg`);
      triggerShortcutToast('Exported Vector Graphic SVG', '.SVG');
    } catch (err) {
      console.error('Failed to export SVG:', err);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPng = async () => {
    if (!activeGraph) return;
    setIsExporting('png');
    setExportMenuOpen(false);

    try {
      const svgString = exportKnowledgeGraphToSvg(
        activeGraph,
        activeRepo?.fullName || activeRepo?.name || 'Repository'
      );
      const pngBlob = await svgToPngBlob(svgString, 2);
      downloadBlob(pngBlob, `${repoSlug}-knowledge-graph.png`);
      triggerShortcutToast('Exported High-Res PNG (2x)', '.PNG');
    } catch (err) {
      console.error('Failed to export PNG:', err);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Repository Knowledge Graph
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 tabular-nums">
            {activeRepo?.fullName} · {activeGraph?.nodes.length || 0} nodes · {observedCount} observed AST edges · {inferredCount} inferred cross-module edges
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: 3D Galaxy vs 2D Architecture */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#071A35] border border-slate-800">
            <button
              type="button"
              onClick={() => setGraphMode('3d')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                graphMode === '3d'
                  ? 'bg-[#2563FF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-cyan-300" />
              <span>3D Galaxy</span>
            </button>
            <button
              type="button"
              onClick={() => setGraphMode('2d')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                graphMode === '2d'
                  ? 'bg-[#2563FF] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5 text-cyan-300" />
              <span>2D Architecture</span>
            </button>
          </div>

          {/* Export Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportMenuOpen((open) => !open)}
              disabled={!activeGraph || isExporting !== null}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-cyan-500/40 text-xs font-medium text-cyan-300 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{isExporting ? 'Exporting...' : 'Export Graph'}</span>
              <ChevronDown className="w-3 h-3 text-cyan-400 opacity-80" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl border border-slate-700 bg-[#041126] p-1.5 shadow-2xl z-30 space-y-1">
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                  Documentation Export
                </div>

                <button
                  type="button"
                  onClick={handleExportPng}
                  className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[#0A2042] transition-colors cursor-pointer group"
                >
                  <ImageIcon className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-xs font-semibold text-white">High-Res PNG Image</div>
                    <div className="text-[11px] text-slate-400">2x Retina raster for slides &amp; wikis</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[#0A2042] transition-colors cursor-pointer group"
                >
                  <FileImage className="w-4 h-4 text-violet-300 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-xs font-semibold text-white">Scalable Vector SVG</div>
                    <div className="text-[11px] text-slate-400">Lossless vector for READMEs &amp; print</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Inspect Cypher Schema Button */}
          <button
            type="button"
            onClick={() => setShowCypher((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-800 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showCypher ? 'Hide Cypher' : 'Inspect Cypher'}</span>
          </button>
        </div>
      </div>

      {showCypher && activeGraph && (
        <div className="rounded-xl border border-slate-800/80 bg-[#071A35] p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
            <Code className="w-4 h-4 text-cyan-300" />
            <span>
              Parameterized Neo4j Graph Schema Queries ({activeGraph.engineMode === 'neo4j' ? 'Neo4j AuraDB Active' : 'Local Fallback Active — Configure NEO4J_URI to sync'})
            </span>
          </div>
          <CodeBlockViewer
            code={activeGraph.cypherPreview.join('\n\n')}
            language="cypher"
            maxHeightClass="max-h-48"
          />
        </div>
      )}

      {activeGraph ? (
        graphMode === '3d' ? (
          <KnowledgeGraph3D graph={activeGraph} heightClass="h-[640px]" />
        ) : (
          <KnowledgeGraphCanvas graph={activeGraph} compact={false} />
        )
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#071A35] p-12 text-center text-sm text-slate-400">
          Loading repository knowledge graph...
        </div>
      )}
    </div>
  );
};
