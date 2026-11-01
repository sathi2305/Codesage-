import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import {
  Code2,
  Database,
  ExternalLink,
  FileCode,
  FileText,
  FlaskConical,
  FolderGit2,
  List,
  Maximize2,
  Network,
  Package,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import type { GraphNodeData, NodeCategory, RepositoryGraph } from '../../types';

const CATEGORY_STYLE: Record<
  NodeCategory,
  { border: string; accentText: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Repository: { border: 'border-[#2563FF]', accentText: 'text-[#60A5FA]', icon: FolderGit2 },
  File: { border: 'border-cyan-500/70', accentText: 'text-cyan-300', icon: FileCode },
  Function: { border: 'border-violet-500/70', accentText: 'text-violet-300', icon: Code2 },
  Class: { border: 'border-indigo-400/70', accentText: 'text-indigo-300', icon: Database },
  APIEndpoint: { border: 'border-emerald-500/70', accentText: 'text-emerald-300', icon: Network },
  Configuration: { border: 'border-amber-500/70', accentText: 'text-amber-300', icon: Settings2 },
  Test: { border: 'border-teal-400/70', accentText: 'text-teal-300', icon: FlaskConical },
  Documentation: { border: 'border-sky-400/70', accentText: 'text-sky-300', icon: FileText },
  Module: { border: 'border-slate-500/80', accentText: 'text-slate-300', icon: Package },
};

const CodeSageGraphNode: React.FC<NodeProps> = ({ data, selected }) => {
  const d = data as GraphNodeData & { dimmed?: boolean; highlighted?: boolean };
  const style = CATEGORY_STYLE[d.category] || CATEGORY_STYLE.File;
  const Icon = style.icon;

  return (
    <div
      className={`px-3 py-2 rounded-lg bg-[#071A35] border transition-opacity min-w-[165px] max-w-[225px] ${
        selected || d.highlighted
          ? 'border-[#22D3EE] ring-2 ring-[#22D3EE]/30'
          : style.border
      } ${d.dimmed ? 'opacity-25' : 'opacity-100'}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 shrink-0 ${style.accentText}`} />
        <span className="text-xs font-semibold text-white truncate">{d.label}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 tabular-nums">
        <span className={style.accentText}>{d.category}</span>
        <span aria-hidden="true">·</span>
        <span>
          {d.inDegree} in / {d.outDegree} out
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-cyan-400 !w-2 !h-2" />
    </div>
  );
};

const nodeTypes = {
  codesageNode: CodeSageGraphNode,
};

interface InnerGraphProps {
  graph: RepositoryGraph;
  compact?: boolean;
}

const InnerKnowledgeGraph: React.FC<InnerGraphProps> = ({ graph, compact = false }) => {
  const navigate = useNavigate();
  const { fitView } = useReactFlow();
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<NodeCategory | 'ALL'>('ALL');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedNodeId(null);
    const timer = setTimeout(() => {
      fitView({ padding: 0.18, duration: 200 });
    }, 60);
    return () => clearTimeout(timer);
  }, [graph.repoId, categoryFilter, fitView]);

  const filteredNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of graph.nodes) {
      if (compact && (n.data.category === 'Function' || n.data.category === 'Module')) {
        // Keep compact home preview crisp and legible
        continue;
      }
      if (categoryFilter !== 'ALL' && n.data.category !== categoryFilter) {
        continue;
      }
      set.add(n.id);
    }
    return set;
  }, [graph.nodes, categoryFilter, compact]);

  const connectedToSelected = useMemo(() => {
    if (!selectedNodeId) return null;
    const neighbors = new Set<string>([selectedNodeId]);
    for (const e of graph.edges) {
      if (e.source === selectedNodeId) neighbors.add(e.target);
      if (e.target === selectedNodeId) neighbors.add(e.source);
    }
    return neighbors;
  }, [selectedNodeId, graph.edges]);

  const rfNodes: Node[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return graph.nodes
      .filter((n) => filteredNodeIds.has(n.id))
      .map((n) => {
        const matchesSearch =
          q.length > 0 &&
          (n.data.label.toLowerCase().includes(q) ||
            (n.data.filePath || '').toLowerCase().includes(q));
        const dimmedBySelection = connectedToSelected ? !connectedToSelected.has(n.id) : false;
        const dimmedBySearch = q.length > 0 ? !matchesSearch : false;

        return {
          id: n.id,
          type: 'codesageNode',
          position: n.position,
          selected: n.id === selectedNodeId,
          data: {
            ...n.data,
            highlighted: matchesSearch || n.id === selectedNodeId,
            dimmed: dimmedBySelection || dimmedBySearch,
          },
        };
      });
  }, [graph.nodes, filteredNodeIds, searchQuery, connectedToSelected, selectedNodeId]);

  const rfEdges: Edge[] = useMemo(() => {
    return graph.edges
      .filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target))
      .map((e) => {
        const activeEdge =
          selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId);
        const strokeColor = activeEdge
          ? '#22D3EE'
          : e.certainty === 'inferred'
          ? '#793CFF'
          : '#334155';

        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: compact && !activeEdge ? undefined : e.label,
          animated: Boolean(activeEdge),
          style: {
            stroke: strokeColor,
            strokeWidth: activeEdge ? 2 : 1.2,
            strokeDasharray: e.certainty === 'inferred' ? '5 4' : undefined,
            opacity: selectedNodeId && !activeEdge ? 0.2 : 0.9,
          },
          labelStyle: {
            fill: '#94A3B8',
            fontSize: 9,
            fontFamily: 'JetBrains Mono, monospace',
          },
          labelBgStyle: {
            fill: '#041126',
            fillOpacity: 0.85,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: strokeColor,
            width: 14,
            height: 14,
          },
        };
      });
  }, [graph.edges, filteredNodeIds, selectedNodeId, compact]);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId]
  );

  const incomingEdges = useMemo(
    () => (selectedNodeId ? graph.edges.filter((e) => e.target === selectedNodeId) : []),
    [graph.edges, selectedNodeId]
  );

  const outgoingEdges = useMemo(
    () => (selectedNodeId ? graph.edges.filter((e) => e.source === selectedNodeId) : []),
    [graph.edges, selectedNodeId]
  );

  const categories: (NodeCategory | 'ALL')[] = [
    'ALL',
    'File',
    'APIEndpoint',
    'Function',
    'Class',
    'Configuration',
    'Test',
    'Documentation',
  ];

  return (
    <section className="rounded-xl border border-slate-800/80 bg-[#071A35] flex flex-col overflow-hidden">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/80">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white tracking-tight truncate">
              Repository Knowledge Graph
            </h2>
            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
              · {rfNodes.length} nodes · {rfEdges.length} edges
              {graph.isSample ? ' · Sample Data' : ' · Live AST'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {graph.engineMode === 'neo4j'
              ? 'Synchronized with Neo4j AuraDB'
              : 'Local Graph Engine (Solid edges: Observed AST · Dashed violet: Inferred)'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Highlight node..."
              aria-label="Search knowledge graph nodes"
              className="pl-8 pr-3 py-1.5 w-36 sm:w-44 rounded-lg bg-[#020817] border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#2563FF]"
            />
          </div>

          <div className="flex items-center p-0.5 rounded-lg bg-[#020817] border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('graph')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'graph'
                  ? 'bg-[#2563FF] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Graph</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#2563FF] text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {viewMode === 'graph' && (
            <button
              type="button"
              onClick={() => fitView({ padding: 0.18, duration: 200 })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A2042] hover:bg-[#2563FF]/30 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Fit graph to screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Fit</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Strip (Full mode) */}
      {!compact && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-800/70 bg-[#041126] overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-[#2563FF] text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0A2042]'
              }`}
            >
              {cat === 'ALL' ? 'All Nodes' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Main Graph or List Body */}
      <div className={`relative ${compact ? 'h-[320px]' : 'h-[560px]'} bg-[#020817]`}>
        {viewMode === 'graph' ? (
          rfNodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <Network className="w-8 h-8 text-slate-500 mb-2" />
              <p className="text-sm font-medium text-slate-300">No nodes match current filter</p>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter('ALL');
                  setSearchQuery('');
                }}
                className="mt-3 px-3 py-1.5 rounded-lg bg-[#2563FF] text-xs font-medium text-white cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              onNodeClick={(_e, node) =>
                setSelectedNodeId((prev) => (prev === node.id ? null : node.id))
              }
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              minZoom={0.2}
              maxZoom={1.8}
            >
              <Background color="#1e293b" gap={22} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          )
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-[#041126] border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Node Label</th>
                  <th className="py-2.5 px-4 font-medium">Category</th>
                  <th className="py-2.5 px-4 font-medium">File Path</th>
                  <th className="py-2.5 px-4 font-medium text-right">Incoming</th>
                  <th className="py-2.5 px-4 font-medium text-right">Outgoing</th>
                  <th className="py-2.5 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {graph.nodes
                  .filter((n) => filteredNodeIds.has(n.id))
                  .filter(
                    (n) =>
                      !searchQuery.trim() ||
                      n.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (n.data.filePath || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((n) => (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedNodeId(n.id)}
                      className="hover:bg-[#0A2042]/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-slate-100">{n.data.label}</td>
                      <td className="py-2.5 px-4 text-slate-300">{n.data.category}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 truncate max-w-[240px]">
                        {n.data.filePath || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-300">
                        {n.data.inDegree}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums text-slate-300">
                        {n.data.outDegree}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {n.data.filePath ? (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              navigate(
                                `/explorer?file=${encodeURIComponent(n.data.filePath!)}&start=${
                                  n.data.startLine || 1
                                }&end=${n.data.endLine || 25}`
                              );
                            }}
                            className="text-cyan-300 hover:text-cyan-200 font-medium cursor-pointer"
                          >
                            Inspect
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Selected Node Details Overlay Drawer */}
        {selectedNode && (
          <div className="absolute right-3 top-3 bottom-3 w-72 sm:w-80 rounded-xl border border-slate-700/90 bg-[#041126]/95 backdrop-blur-md p-4 overflow-y-auto z-20 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-cyan-300 font-medium">
                    {selectedNode.data.category}
                  </div>
                  <h3 className="text-sm font-semibold text-white font-mono break-all mt-0.5">
                    {selectedNode.data.label}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNodeId(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                  aria-label="Close node details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedNode.data.description && (
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {selectedNode.data.description}
                </p>
              )}

              {selectedNode.data.filePath && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1 font-mono">
                  <div className="truncate text-slate-200">{selectedNode.data.filePath}</div>
                  {selectedNode.data.startLine && (
                    <div className="tabular-nums">
                      Lines {selectedNode.data.startLine}–{selectedNode.data.endLine}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                <div className="text-xs font-medium text-slate-200 tabular-nums">
                  Incoming Relationships ({incomingEdges.length})
                </div>
                {incomingEdges.length === 0 ? (
                  <p className="text-xs text-slate-500">None</p>
                ) : (
                  <ul className="space-y-1 max-h-24 overflow-y-auto text-[11px] font-mono text-slate-300">
                    {incomingEdges.slice(0, 8).map((e) => (
                      <li key={e.id} className="truncate">
                        {e.source.replace(/^(file:|sym:|repo:|mod:)/, '')} → {e.label} (
                        {e.certainty})
                      </li>
                    ))}
                  </ul>
                )}

                <div className="text-xs font-medium text-slate-200 pt-1 tabular-nums">
                  Outgoing Relationships ({outgoingEdges.length})
                </div>
                {outgoingEdges.length === 0 ? (
                  <p className="text-xs text-slate-500">None</p>
                ) : (
                  <ul className="space-y-1 max-h-24 overflow-y-auto text-[11px] font-mono text-slate-300">
                    {outgoingEdges.slice(0, 8).map((e) => (
                      <li key={e.id} className="truncate">
                        {e.label} → {e.target.replace(/^(file:|sym:|repo:|mod:)/, '')} (
                        {e.certainty})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {selectedNode.data.filePath && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/explorer?file=${encodeURIComponent(selectedNode.data.filePath!)}&start=${
                      selectedNode.data.startLine || 1
                    }&end=${selectedNode.data.endLine || 30}`
                  )
                }
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>Open Source File</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Node Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-t border-slate-800/80 bg-[#041126] text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-cyan-300">File</span>
          <span>·</span>
          <span className="text-emerald-300">APIEndpoint</span>
          <span>·</span>
          <span className="text-violet-300">Function</span>
          <span>·</span>
          <span className="text-indigo-300">Class</span>
          <span>·</span>
          <span className="text-amber-300">Config</span>
          <span>·</span>
          <span className="text-teal-300">Test</span>
        </div>
        {compact && (
          <button
            type="button"
            onClick={() => navigate('/graph')}
            className="text-cyan-300 hover:text-cyan-200 font-medium whitespace-nowrap cursor-pointer"
          >
            Expand Full Graph →
          </button>
        )}
      </div>
    </section>
  );
};

export const KnowledgeGraphCanvas: React.FC<InnerGraphProps> = (props) => (
  <ReactFlowProvider>
    <InnerKnowledgeGraph {...props} />
  </ReactFlowProvider>
);
