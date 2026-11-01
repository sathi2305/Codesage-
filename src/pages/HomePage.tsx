import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  Code2,
  Compass,
  Cpu,
  Database,
  ExternalLink,
  FileCode,
  FolderTree,
  GitBranch,
  GitFork,
  Globe,
  Layers,
  Loader2,
  Mic,
  Network,
  Plus,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { AIConversationPanel } from '../components/chat/AIConversationPanel';
import { KnowledgeGraph3D } from '../components/graph/KnowledgeGraph3D';
import { EvidencePanel } from '../components/evidence/EvidencePanel';
import { HeroHologramScene } from '../components/3d/HeroHologramScene';
import { HumanoidAIAssistant3D } from '../components/3d/HumanoidAIAssistant3D';
import { CodeBlockViewer } from '../components/common/CodeBlockViewer';
import { codeSageApi } from '../services/api';

const QUICK_PUBLIC_PRESETS = [
  { label: 'expressjs/cors', url: 'https://github.com/expressjs/cors', desc: 'Node.js CORS middleware' },
  { label: 'pallets/itsdangerous', url: 'https://github.com/pallets/itsdangerous', desc: 'Python cryptographic signing' },
  { label: 'sindresorhus/ky', url: 'https://github.com/sindresorhus/ky', desc: 'Fetch HTTP client' },
];

const PREVIEW_MODULES = [
  {
    id: 'mod-jwt',
    name: 'jwt_handler.py',
    category: 'Crypto Auth',
    code: `def verify_access_token(token: str) -> dict:
    """Verifies RS256 token locally using public key without DB lookup."""
    try:
        payload = jwt.decode(token, JWT_PUBLIC_KEY_PEM, algorithms=["RS256"])
        if is_token_revoked(payload["jti"]):
            raise TokenRevokedException("Token was explicitly revoked")
        return payload
    except PyJWTError as err:
        raise AuthenticationFailed(str(err))`,
    evidence: 'ADR-001 line 12: Eliminates 14ms synchronous PostgreSQL session lookup across Kubernetes pods.',
  },
  {
    id: 'mod-revocation',
    name: 'revocation_store.py',
    category: 'Redis Blocklist',
    code: `def revoke_token_jti(jti: str, ttl_seconds: int = 900) -> bool:
    """Writes revoked UUID to Redis with exact remaining token TTL."""
    key = f"revoked:jti:{jti}"
    redis_client.setex(key, ttl_seconds, "1")
    return True`,
    evidence: 'Closes classic JWT stateless revocation gap without keeping stateful database sessions.',
  },
  {
    id: 'mod-ledger',
    name: 'ledger_service.py',
    category: 'ACID Engine',
    code: `def execute_transfer(from_id: str, to_id: str, amount: int):
    """Sorts account IDs to guarantee deterministic deadlock-free locking."""
    first_id, second_id = sorted([from_id, to_id])
    with db.transaction():
        db.select_for_update(first_id)
        db.select_for_update(second_id)
        apply_double_entry_balance(from_id, to_id, amount)`,
    evidence: 'Eliminates Postgres 40P01 circular deadlocks during concurrent mutual transfers.',
  },
];

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    activeRepo,
    activeGraph,
    activeEvidence,
    setIngestModalOpen,
    refreshRepositories,
    selectRepository,
  } = useCodeSage();

  const [hero3dView, setHero3dView] = useState<'humanoid' | 'neural'>('humanoid');
  const [selectedPreviewMod, setSelectedPreviewMod] = useState(PREVIEW_MODULES[0]);
  const [quickUrl, setQuickUrl] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState<string | null>(null);

  const handleQuickIndex = async (targetUrl?: string) => {
    const url = (targetUrl ?? quickUrl).trim();
    if (!url || indexing) return;

    setIndexing(true);
    setIndexError(null);

    try {
      const { repository } = await codeSageApi.addGitRepository(url);
      await refreshRepositories();
      selectRepository(repository.id);
      setQuickUrl('');
    } catch (err) {
      setIndexError(err instanceof Error ? err.message : 'Repository indexing failed.');
    } finally {
      setIndexing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Cinematic 3D Developer Hero Section */}
      <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#041126]/95 via-[#020817] to-[#041126]/90 backdrop-blur-xl overflow-hidden relative shadow-2xl shadow-cyan-500/5">
        <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[480px]">
          {/* Left Column: Product Value, Ingestion & Controls */}
          <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-6 z-10">
            <div>
              {/* Product Badge */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-semibold flex items-center gap-1.5 shadow-sm shadow-cyan-500/10">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  AI REPOSITORY INTELLIGENCE
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-slate-300 text-[11px] font-mono">
                  hackFront India 2026 | T1.1
                </span>
              </div>

              {/* Main Heading */}
              <h1
                className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mt-3 leading-tight"
                style={{ textWrap: 'balance' }}
              >
                Your Codebase Has a Story. Discover It.
              </h1>

              {/* Description */}
              <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed max-w-xl">
                CodeSage AI connects deep AST parsing, Neo4j GraphRAG relationships, and verifiable source-code citations to explain <em>why</em> your architecture is built the way it is.
              </p>

              {/* Instant GitHub Repository Input & Dual Primary Actions */}
              <div className="mt-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <GitBranch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="url"
                      value={quickUrl}
                      onChange={(e) => setQuickUrl(e.target.value)}
                      disabled={indexing}
                      placeholder="Enter public GitHub URL (e.g. https://github.com/expressjs/cors)"
                      aria-label="Public GitHub repository URL"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#020817] border border-slate-700/80 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={indexing || !quickUrl.trim()}
                      onClick={() => handleQuickIndex()}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#2563FF] hover:bg-[#1d4ed8] disabled:opacity-50 text-xs font-semibold text-white transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#2563FF]/30"
                    >
                      {indexing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>{indexing ? 'Indexing AST...' : 'Analyze Repository'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        selectRepository('sample-fintech-auth-platform');
                        navigate('/ask');
                      }}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#071A35] hover:bg-[#0A2042] border border-cyan-500/40 text-xs font-semibold text-cyan-200 hover:text-white transition-all whitespace-nowrap flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Load pre-indexed Fintech Auth microservices sample"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                      <span>Explore Live Demo</span>
                    </button>
                  </div>
                </div>

                {indexError && (
                  <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/80 rounded-xl p-2.5">
                    {indexError}
                  </div>
                )}

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[11px] text-slate-400 font-mono">Try pre-indexed:</span>
                  {QUICK_PUBLIC_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      disabled={indexing}
                      onClick={() => {
                        setQuickUrl(preset.url);
                        handleQuickIndex(preset.url);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-800 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tasteful Technology Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-5 border-t border-slate-800/80 mt-5">
                <div className="p-2 rounded-lg bg-[#020817] border border-slate-800 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] font-mono text-slate-300">Neo4j GraphRAG</span>
                </div>
                <div className="p-2 rounded-lg bg-[#020817] border border-slate-800 flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[11px] font-mono text-slate-300">Gemini 3.8 Flash</span>
                </div>
                <div className="p-2 rounded-lg bg-[#020817] border border-slate-800 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-mono text-slate-300">Sarvam Indic AI</span>
                </div>
                <div className="p-2 rounded-lg bg-[#020817] border border-slate-800 flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-mono text-slate-300">AST Parser Core</span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/explorer')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Files ({activeRepo?.fileCount || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/dependencies')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <GitFork className="w-3.5 h-3.5 text-violet-400" />
                  <span>Blast Radius</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIngestModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-700/80 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Upload .ZIP</span>
                </button>
              </div>

              {/* 3D Model Switcher */}
              <div className="flex items-center p-0.5 rounded-lg bg-[#020817] border border-slate-800">
                <button
                  type="button"
                  onClick={() => setHero3dView('humanoid')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    hero3dView === 'humanoid' ? 'bg-[#2563FF] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  AI Humanoid
                </button>
                <button
                  type="button"
                  onClick={() => setHero3dView('neural')}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    hero3dView === 'neural' ? 'bg-[#2563FF] text-white shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Neural Core
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: 3D AI Assistant Centerpiece */}
          <div className="lg:col-span-6 relative min-h-[420px] lg:min-h-full border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-[#020817] overflow-hidden">
            {hero3dView === 'humanoid' ? (
              <HumanoidAIAssistant3D
                className="w-full h-full min-h-[420px]"
                statusText="Humanoid AI Assistant Ready"
              />
            ) : (
              <HeroHologramScene
                repoName={activeRepo?.name}
                symbolCount={activeRepo?.symbolCount || 38}
                className="w-full h-full min-h-[420px]"
              />
            )}
          </div>
        </div>
      </section>

      {/* Interactive Product Preview Section (Below Hero) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-0.5">
              <Zap className="w-3.5 h-3.5" />
              <span>LIVE INTERACTIVE PREVIEW</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Interactive Architectural Module Inspector
            </h2>
          </div>

          {/* Module Selection Chips */}
          <div className="flex flex-wrap gap-2">
            {PREVIEW_MODULES.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => setSelectedPreviewMod(mod)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono transition-all cursor-pointer ${
                  selectedPreviewMod.id === mod.id
                    ? 'bg-[#2563FF] text-white shadow-md shadow-[#2563FF]/30 border border-transparent'
                    : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>{mod.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Interactive Preview Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Code Editor Preview */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#041126] p-4 sm:p-5 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="font-mono text-xs text-white font-semibold">
                  {selectedPreviewMod.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0A2042] text-cyan-300 border border-slate-700">
                  {selectedPreviewMod.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/explorer')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#071A35] hover:bg-[#0A2042] text-[11px] text-cyan-300 transition-colors cursor-pointer"
              >
                <span>Full Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            <CodeBlockViewer
              code={selectedPreviewMod.code}
              language="python"
              maxHeightClass="max-h-[220px]"
            />

            <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>AST Verified · Lines 1–12 Indexed into Neo4j</span>
            </div>
          </div>

          {/* Right: Evidence & Q&A Preview */}
          <div className="lg:col-span-5 rounded-2xl border border-cyan-500/30 bg-[#041126] p-4 sm:p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Grounded Architectural Rationale</span>
              </div>

              <div className="p-3.5 rounded-xl bg-[#020817] border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans">
                {selectedPreviewMod.evidence}
              </div>

              <div className="p-3 rounded-xl bg-[#071A35]/60 border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Verified AST Linkage:
                </span>
                <div className="text-xs font-mono text-cyan-300">
                  {selectedPreviewMod.name} &rarr; docs/ADR-001.md
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/ask')}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#2563FF]/30 cursor-pointer"
            >
              <span>Ask CodeSage Why This Was Built This Way</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Main 2-Column CodeSage Command Center: AI Conversation Left + 3D Graph & Evidence Right */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <Bot className="w-3.5 h-3.5" />
          <span>EVIDENCE-GROUNDED REPOSITORY WORKSPACE</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <div className="xl:col-span-7">
            <AIConversationPanel compact />
          </div>

          <div className="xl:col-span-5 space-y-6">
            {activeGraph && <KnowledgeGraph3D graph={activeGraph} heightClass="h-[360px]" />}
            <EvidencePanel items={activeEvidence} compact />
          </div>
        </div>
      </section>
    </div>
  );
};
