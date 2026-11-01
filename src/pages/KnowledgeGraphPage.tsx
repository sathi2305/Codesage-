import React, { useState } from 'react';
import { Box, Code, Database } from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { KnowledgeGraph3D } from '../components/graph/KnowledgeGraph3D';
import { CodeBlockViewer } from '../components/common/CodeBlockViewer';

export const KnowledgeGraphPage: React.FC = () => {
  const { activeRepo, activeGraph } = useCodeSage();
  const [showCypher, setShowCypher] = useState(false);

  const observedCount = activeGraph?.edges.filter((e) => e.certainty === 'observed').length || 0;
  const inferredCount = activeGraph?.edges.filter((e) => e.certainty === 'inferred').length || 0;

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

        <div className="flex items-center gap-2">
          {/* 3D Spatial Galaxy Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#071A35] border border-cyan-500/30 text-xs font-mono text-cyan-300">
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span>3D Spatial Galaxy</span>
          </div>

          <button
            type="button"
            onClick={() => setShowCypher((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-800 text-xs font-medium text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Database className="w-3.5 h-3.5" />
            <span>{showCypher ? 'Hide Cypher Schema' : 'Inspect Neo4j Cypher'}</span>
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
        <KnowledgeGraph3D graph={activeGraph} heightClass="h-[640px]" />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#071A35] p-12 text-center text-sm text-slate-400">
          Loading repository knowledge graph...
        </div>
      )}
    </div>
  );
};
