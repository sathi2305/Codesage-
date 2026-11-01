import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Database,
  ExternalLink,
  Layers,
  Network,
  Play,
  RotateCcw,
  Route,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';

interface ApiPipelineHop {
  layer: 'Client' | 'API Route' | 'Middleware' | 'Service' | 'Data Store';
  componentName: string;
  filePath: string;
  line: number;
  description: string;
  icon: string;
}

interface EndpointTrace {
  id: string;
  method: 'POST' | 'GET' | 'DELETE' | 'PUT';
  path: string;
  description: string;
  hops: ApiPipelineHop[];
}

const SAMPLE_TRACES: EndpointTrace[] = [
  {
    id: 'ep-login',
    method: 'POST',
    path: '/api/v1/auth/login',
    description: 'Authenticates credentials, generates RS256 token, and sets HttpOnly refresh cookie.',
    hops: [
      {
        layer: 'Client',
        componentName: 'authService.loginWithCredentials()',
        filePath: 'frontend/src/services/authService.ts',
        line: 14,
        description: 'Dispatches JSON payload with { email, password } and credentials: "include".',
        icon: 'client',
      },
      {
        layer: 'API Route',
        componentName: 'APIRouter.post("/login")',
        filePath: 'backend/app/routes/auth.py',
        line: 22,
        description: 'Validates request schema against Pydantic LoginRequest model.',
        icon: 'route',
      },
      {
        layer: 'Middleware',
        componentName: 'RateLimiter & CORS Policy',
        filePath: 'backend/app/middleware/rate_limit.py',
        line: 18,
        description: 'Enforces 10 req/min brute-force limit per IP.',
        icon: 'shield',
      },
      {
        layer: 'Service',
        componentName: 'create_access_token()',
        filePath: 'backend/app/auth/jwt_handler.py',
        line: 35,
        description: 'Signs RS256 token with private key and generates unique random jti claim.',
        icon: 'service',
      },
      {
        layer: 'Data Store',
        componentName: 'PostgreSQL User Query & Audit Log',
        filePath: 'backend/app/db/repositories/user_repo.py',
        line: 48,
        description: 'Fetches bcrypt password hash and updates last_login_at timestamp.',
        icon: 'database',
      },
    ],
  },
  {
    id: 'ep-logout',
    method: 'POST',
    path: '/api/v1/auth/logout',
    description: 'Extracts access token JTI and commits durable revocation to Redis cluster.',
    hops: [
      {
        layer: 'Client',
        componentName: 'authService.logout()',
        filePath: 'frontend/src/services/authService.ts',
        line: 45,
        description: 'Dispatches logout request and purges access token from JavaScript memory.',
        icon: 'client',
      },
      {
        layer: 'API Route',
        componentName: 'APIRouter.post("/logout")',
        filePath: 'backend/app/routes/auth.py',
        line: 65,
        description: 'Extracts Bearer token from Authorization header and decodes claims.',
        icon: 'route',
      },
      {
        layer: 'Middleware',
        componentName: 'JWTBearerSecurity.verify()',
        filePath: 'backend/app/auth/security.py',
        line: 28,
        description: 'Validates RS256 signature using local public key.',
        icon: 'shield',
      },
      {
        layer: 'Service',
        componentName: 'revoke_token_jti(jti, remaining_ttl)',
        filePath: 'backend/app/auth/revocation_store.py',
        line: 18,
        description: 'Calculates remaining token lifespan and invokes Redis write.',
        icon: 'service',
      },
      {
        layer: 'Data Store',
        componentName: 'Redis SETEX revoked:jti:{uuid}',
        filePath: 'backend/app/auth/revocation_store.py',
        line: 32,
        description: 'Writes key with TTL in O(1) time complexity. Closes session immediately.',
        icon: 'database',
      },
    ],
  },
  {
    id: 'ep-transfer',
    method: 'POST',
    path: '/api/v1/ledger/transfers',
    description: 'Double-entry cryptographic ledger transfer with optimistic locking.',
    hops: [
      {
        layer: 'Client',
        componentName: 'ledgerClient.executeTransfer()',
        filePath: 'frontend/src/services/ledgerService.ts',
        line: 30,
        description: 'Dispatches source/dest accounts and amount in cents to prevent floating point errors.',
        icon: 'client',
      },
      {
        layer: 'API Route',
        componentName: 'APIRouter.post("/transfers")',
        filePath: 'backend/app/routes/ledger.py',
        line: 40,
        description: 'Verifies user ownership of source account.',
        icon: 'route',
      },
      {
        layer: 'Middleware',
        componentName: 'RevocationCheckMiddleware',
        filePath: 'backend/app/middleware/auth_check.py',
        line: 22,
        description: 'Checks in O(1) whether caller jti is present in Redis blocklist.',
        icon: 'shield',
      },
      {
        layer: 'Service',
        componentName: 'LedgerService.processTransfer()',
        filePath: 'backend/app/services/ledger_service.py',
        line: 55,
        description: 'Sorts account IDs deterministically to prevent PostgreSQL transaction deadlocks.',
        icon: 'service',
      },
      {
        layer: 'Data Store',
        componentName: 'PostgreSQL ACID Transaction',
        filePath: 'backend/app/db/repositories/ledger_repo.py',
        line: 72,
        description: 'Executes atomic credit and debit entries within a single serializable transaction.',
        icon: 'database',
      },
    ],
  },
];

export const ApiFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRepo } = useCodeSage();
  const [selectedTraceId, setSelectedTraceId] = useState<string>(SAMPLE_TRACES[0].id);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isPlayingFlow, setIsPlayingFlow] = useState<boolean>(false);

  const activeTrace =
    SAMPLE_TRACES.find((t) => t.id === selectedTraceId) || SAMPLE_TRACES[0];

  const handlePlayFlow = () => {
    setIsPlayingFlow(true);
    setActiveStep(0);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < activeTrace.hops.length) {
        setActiveStep(step);
      } else {
        clearInterval(interval);
        setIsPlayingFlow(false);
      }
    }, 1100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <Route className="w-3.5 h-3.5" />
            <span>API FLOW VISUALIZER &amp; CALL PIPELINE</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Multi-Tier Request Tracing
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Step through frontend invocation, routing, middleware auth, services, and database queries in{' '}
            <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePlayFlow}
          disabled={isPlayingFlow}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-all cursor-pointer shadow-lg shadow-[#2563FF]/30"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>{isPlayingFlow ? 'Tracing Packet...' : 'Animate Flow'}</span>
        </button>
      </div>

      {/* Endpoint Selector Chips */}
      <div className="flex flex-wrap gap-2">
        {SAMPLE_TRACES.map((trace) => (
          <button
            key={trace.id}
            type="button"
            onClick={() => {
              setSelectedTraceId(trace.id);
              setActiveStep(0);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              selectedTraceId === trace.id
                ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30 border border-transparent'
                : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
            }`}
          >
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#020817] text-cyan-300">
              {trace.method}
            </span>
            <span>{trace.path}</span>
          </button>
        ))}
      </div>

      {/* Endpoint Overview Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#041126] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
              {activeTrace.method}
            </span>
            <span className="text-base font-bold font-mono text-white">
              {activeTrace.path}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{activeTrace.description}</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{activeTrace.hops.length} Architectural Layers</span>
          <span>·</span>
          <span>ACID Compliant</span>
        </div>
      </div>

      {/* Visual Pipeline Stages */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {activeTrace.hops.map((hop, idx) => {
            const isCurrent = activeStep === idx;
            const isPassed = activeStep > idx;

            return (
              <div
                key={hop.layer}
                onClick={() => setActiveStep(idx)}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isCurrent
                    ? 'bg-[#0A2042] border-cyan-400 ring-2 ring-cyan-400/30 shadow-xl'
                    : isPassed
                    ? 'bg-[#071A35] border-slate-700/80'
                    : 'bg-[#041126] border-slate-800/80 opacity-70 hover:opacity-100'
                }`}
              >
                {/* Step Pill */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 font-bold">
                    Layer 0{idx + 1}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isCurrent
                        ? 'bg-cyan-400 animate-ping'
                        : isPassed
                        ? 'bg-emerald-400'
                        : 'bg-slate-600'
                    }`}
                  />
                </div>

                <div className="text-xs font-bold text-white font-mono">{hop.layer}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                  {hop.componentName}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Layer Detail Drawer */}
        {activeTrace.hops[activeStep] && (
          <div className="rounded-2xl border border-cyan-500/30 bg-[#041126] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-mono uppercase text-cyan-400 font-semibold tracking-wider">
                  Inspecting Layer {activeStep + 1}: {activeTrace.hops[activeStep].layer}
                </span>
                <h3 className="text-base font-bold font-mono text-white mt-0.5">
                  {activeTrace.hops[activeStep].componentName}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/explorer?file=${encodeURIComponent(
                      activeTrace.hops[activeStep].filePath
                    )}&start=${activeTrace.hops[activeStep].line}`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                <span>View File in Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-xl bg-[#020817] border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Source File Location:</span>
                <div className="text-xs font-mono text-cyan-300">
                  {activeTrace.hops[activeStep].filePath}:L{activeTrace.hops[activeStep].line}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#020817] border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400 font-mono">Execution Responsibility:</span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {activeTrace.hops[activeStep].description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
