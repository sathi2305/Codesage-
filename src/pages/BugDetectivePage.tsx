import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bug,
  CheckCircle2,
  Code,
  ExternalLink,
  FileCode,
  HelpCircle,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { CodeBlockViewer } from '../components/common/CodeBlockViewer';

interface BugPreset {
  id: string;
  name: string;
  category: string;
  errorLog: string;
  suspectFile: string;
  startLine: number;
  endLine: number;
  confidence: number;
  observedFacts: string[];
  hypotheses: string[];
  remediationSteps: string[];
}

const SAMPLE_BUGS: BugPreset[] = [
  {
    id: 'bug-jwt-signature',
    name: 'Invalid RS256 JWT Signature on Ingress Validation',
    category: 'Authentication / Crypto',
    errorLog: `jwt.exceptions.InvalidSignatureError: Signature verification failed
  File "backend/app/auth/jwt_handler.py", line 42, in verify_access_token
    payload = jwt.decode(token, JWT_PUBLIC_KEY_PEM, algorithms=["RS256"])
  File "jwt/api_jwt.py", line 128, in decode
    return self.decode_complete(token, key, algorithms, options)
ValueError: Public key format unrecognized or missing newline in PEM header`,
    suspectFile: 'backend/app/auth/jwt_handler.py',
    startLine: 35,
    endLine: 48,
    confidence: 0.96,
    observedFacts: [
      'AST confirms jwt_handler.py imports `jwt` and expects `JWT_PUBLIC_KEY_PEM` environment variable.',
      'Lines 38-42 call `jwt.decode(token, JWT_PUBLIC_KEY_PEM, algorithms=["RS256"])` without stripping trailing carriage returns from base64 secret mounts.',
      'ADR-001 stipulates that keys are rotated via Kubernetes secrets where trailing newline formatting may be stripped.',
    ],
    hypotheses: [
      'The mounted environment variable `JWT_PUBLIC_KEY_PEM` was injected as a single-line string with literal `\\n` escapes rather than raw line breaks.',
      'Downstream microservices may be using an old cached public key after an asynchronous rotation event.',
    ],
    remediationSteps: [
      'Wrap `JWT_PUBLIC_KEY_PEM` reading with `.replace("\\n", "\n")` in `jwt_handler.py:L26`.',
      'Add a startup healthcheck assertion verifying that the public key is parsable before launching the ASGI worker.',
      'Check `tests/test_auth.py:L89` for public key fixture formatting.',
    ],
  },
  {
    id: 'bug-redis-connection',
    name: 'Redis JTI Blocklist Connection Timeout on /logout',
    category: 'Cache / Distributed Systems',
    errorLog: `redis.exceptions.ConnectionError: Error 111 connecting to redis-cluster.internal:6379. Connection refused.
  File "backend/app/routes/auth.py", line 78, in logout_endpoint
    revoke_token_jti(claims["jti"], remaining_ttl)
  File "backend/app/auth/revocation_store.py", line 32, in revoke_token_jti
    redis_client.setex(f"revoked:jti:{jti}", ttl_seconds, "1")`,
    suspectFile: 'backend/app/auth/revocation_store.py',
    startLine: 24,
    endLine: 40,
    confidence: 0.92,
    observedFacts: [
      'AST reveals `revoke_token_jti()` connects to Redis synchronously without a circuit breaker or fallback queue.',
      'If Redis is unreachable, `POST /api/v1/auth/logout` raises an uncaught 500 error back to the client.',
    ],
    hypotheses: [
      'Redis cluster failover caused DNS propagation delay in the Kubernetes cluster.',
      'A network policy partition between the web deployment and the Redis pod.',
    ],
    remediationSteps: [
      'Implement fail-closed handling in `revocation_store.py` with exponential backoff retry (max 3 attempts).',
      'Log an alert to Audit Sentry and record the revocation in a durable dead-letter queue.',
    ],
  },
  {
    id: 'bug-ledger-deadlock',
    name: 'Optimistic Locking Version Conflict in Ledger Transfer',
    category: 'Database / Concurrency',
    errorLog: `psycopg2.errors.DeadlockDetected: deadlock detected
DETAIL: Process 8214 waits for ShareLock on transaction 941029; blocked by process 8215.
Process 8215 waits for ExclusiveLock on tuple (14, 2) in relation "ledger_accounts"; blocked by process 8214.
HINT: See server log for query details.
  File "backend/app/services/ledger_service.py", line 64, in execute_transfer
    account.balance += amount`,
    suspectFile: 'backend/app/services/ledger_service.py',
    startLine: 50,
    endLine: 72,
    confidence: 0.89,
    observedFacts: [
      'Code in `execute_transfer` acquires row locks in order of request parameters (`from_account`, `to_account`) rather than canonical account ID order.',
      'Two concurrent transfers in reverse directions (`A->B` and `B->A`) create a circular wait dependency.',
    ],
    hypotheses: [
      'High-frequency automated webhook payouts triggered concurrent mutual settlements between partner accounts.',
    ],
    remediationSteps: [
      'Sort account IDs deterministically (`min(from_id, to_id)`, `max(from_id, to_id)`) before acquiring `SELECT FOR UPDATE` locks.',
      'Add retries for PostgreSQL serialization failure code `40P01`.',
    ],
  },
];

export const BugDetectivePage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRepo } = useCodeSage();
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SAMPLE_BUGS[0].id);
  const [customError, setCustomError] = useState<string>('');
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  const activeBug = SAMPLE_BUGS.find((b) => b.id === selectedPresetId) || SAMPLE_BUGS[0];

  const handleRunInvestigation = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <Bug className="w-3.5 h-3.5" />
            <span>BUG DETECTIVE &amp; ROOT CAUSE TRIAGE</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Evidence-Grounded Error Investigation
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Correlate runtime exceptions against AST call graphs, commit ADR rationale, and verified line numbers in{' '}
            <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCustomError('');
            setSelectedPresetId(SAMPLE_BUGS[0].id);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-800 text-xs text-slate-300 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Reset Investigation</span>
        </button>
      </div>

      {/* Preset Selector Chips */}
      <div className="flex flex-wrap gap-2">
        {SAMPLE_BUGS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              setSelectedPresetId(preset.id);
              setCustomError('');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              selectedPresetId === preset.id && !customError
                ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30 border border-transparent'
                : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-cyan-300" />
            <span>{preset.name}</span>
          </button>
        ))}
      </div>

      {/* Stack Trace / Error Input Panel */}
      <div className="rounded-2xl border border-slate-800 bg-[#041126] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
            <Code className="w-4 h-4 text-cyan-400" />
            <span>Runtime Exception / Stack Trace Log</span>
          </label>
          <span className="text-[11px] font-mono text-slate-400">
            AST Symbol Extraction Active
          </span>
        </div>

        <textarea
          rows={5}
          value={customError || activeBug.errorLog}
          onChange={(e) => setCustomError(e.target.value)}
          placeholder="Paste full stack trace, error logs, or runtime failure output..."
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#020817] border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors resize-y"
        />

        <div className="flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Cross-referenced against AST symbol tables &amp; ADR decisions</span>
          </div>

          <button
            type="button"
            onClick={handleRunInvestigation}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-all cursor-pointer shadow-md shadow-[#2563FF]/20"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>{analyzing ? 'Tracing AST Callers...' : 'Analyze Root Cause'}</span>
          </button>
        </div>
      </div>

      {/* Investigation Results: Split Screen */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Suspect File & Line Citations */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#041126] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Primary Suspect Location</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                {Math.round(activeBug.confidence * 100)}% Confidence
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#020817] p-3 font-mono text-xs text-slate-200">
              <div className="text-cyan-300 font-semibold">{activeBug.suspectFile}</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Lines {activeBug.startLine} – {activeBug.endLine}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                navigate(
                  `/explorer?file=${encodeURIComponent(activeBug.suspectFile)}&start=${
                    activeBug.startLine
                  }&end=${activeBug.endLine}`
                )
              }
              className="w-full py-2 px-3 rounded-xl bg-[#071A35] hover:bg-[#0A2042] border border-cyan-500/40 text-xs font-medium text-cyan-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Inspect in Repository Explorer</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Observed Facts (Verified AST) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified Facts from AST &amp; ADRs</span>
              </div>
              <ul className="space-y-2">
                {activeBug.observedFacts.map((fact, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-slate-300 bg-[#071A35]/50 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed"
                  >
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: AI Hypotheses vs Remediation Playbook */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-[#041126] p-5 space-y-4">
            {/* Hypotheses */}
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-violet-400" />
                <span>AI Root-Cause Hypotheses (Requiring Verification)</span>
              </h3>
              <div className="space-y-2">
                {activeBug.hypotheses.map((hyp, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-slate-300 bg-violet-950/20 border border-violet-500/20 p-3 rounded-xl leading-relaxed flex items-start gap-2.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                    <span>{hyp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Remediation Playbook */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Recommended Debugging &amp; Remediation Playbook</span>
              </h3>

              <div className="space-y-2">
                {activeBug.remediationSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[#020817] border border-slate-800 text-xs text-slate-200"
                  >
                    <span className="px-2 py-0.5 rounded bg-[#0A2042] text-cyan-300 font-mono text-[11px] font-bold shrink-0">
                      Step {idx + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
