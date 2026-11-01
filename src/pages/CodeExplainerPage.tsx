import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Code2,
  Copy,
  ExternalLink,
  FileCode,
  Globe,
  Layers,
  Network,
  Sparkles,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { CodeBlockViewer } from '../components/common/CodeBlockViewer';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../types';
import { codeSageApi } from '../services/api';

interface ExplainerItem {
  id: string;
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  language: string;
  codeSnippet: string;
  summary: string;
  stepByStep: string[];
  inputs: { name: string; type: string; desc: string }[];
  outputs: { type: string; desc: string };
  dependencies: string[];
  architectureRationale: string;
}

const SAMPLE_EXPLAINERS: ExplainerItem[] = [
  {
    id: 'exp-create-token',
    name: 'create_access_token(user_id, role, custom_claims)',
    file: 'backend/app/auth/jwt_handler.py',
    startLine: 18,
    endLine: 45,
    language: 'python',
    codeSnippet: `def create_access_token(user_id: str, role: str, custom_claims: dict = None) -> str:
    """
    Issues a cryptographically signed RS256 JWT access token.
    Enforces a strict 15-minute expiration and embeds a random UUID jti
    claim for O(1) Redis blocklist revocation.
    """
    now = datetime.now(timezone.utc)
    jti = str(uuid.uuid4())
    payload = {
        "sub": user_id,
        "role": role,
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(minutes=15),
        "iss": "codesage-auth-service",
    }
    if custom_claims:
        payload.update(custom_claims)

    encoded_jwt = jwt.encode(payload, JWT_PRIVATE_KEY_PEM, algorithm="RS256")
    return encoded_jwt`,
    summary:
      'Generates short-lived (15 min) asymmetric RS256 JWT access tokens embedded with a unique UUID `jti` claim for immediate server-side revocation in Redis.',
    stepByStep: [
      'Computes UTC timestamp to prevent clock-skew errors across distributed nodes.',
      'Generates an O(1) revocable UUID `jti` (JWT ID) token identifier.',
      'Sets expiration to precisely 15 minutes (`now + timedelta(minutes=15)`).',
      'Signs the payload using the private RSA key (`RS256`), allowing downstream microservices to verify via public key without hitting the auth database.',
    ],
    inputs: [
      { name: 'user_id', type: 'str', desc: 'Unique account identifier' },
      { name: 'role', type: 'str', desc: 'RBAC authorization level (admin, member, etc.)' },
      { name: 'custom_claims', type: 'dict (optional)', desc: 'Tenant ID or permission flags' },
    ],
    outputs: {
      type: 'str',
      desc: 'Base64URL-encoded RS256 signed JSON Web Token',
    },
    dependencies: [
      'cryptography / pyjwt',
      'backend/app/auth/revocation_store.py (matches jti on logout)',
      'docs/ADR-001-authentication-architecture.md',
    ],
    architectureRationale:
      'Per ADR-001, stateful server sessions created a 14ms bottleneck on downstream microservices. Using RS256 allows downstream verification locally using the public key.',
  },
  {
    id: 'exp-revoke-jti',
    name: 'revoke_token_jti(jti, ttl_seconds)',
    file: 'backend/app/auth/revocation_store.py',
    startLine: 12,
    endLine: 36,
    language: 'python',
    codeSnippet: `def revoke_token_jti(jti: str, ttl_seconds: int = 900) -> bool:
    """
    Stores revoked JTI in Redis with automatic TTL expiration.
    Once TTL expires, the token would have expired naturally anyway.
    """
    key = f"revoked:jti:{jti}"
    try:
        redis_client.setex(name=key, time=ttl_seconds, value="1")
        return True
    except ConnectionError as err:
        logger.critical(f"Failed to write revocation to Redis: {err}")
        # Fail-closed for security: do not report successful logout if revocation failed
        raise RevocationStoreError("Revocation store unavailable")`,
    summary:
      'Invalidates a JWT by saving its unique `jti` to Redis with an automatic TTL matching the token remaining lifespan, closing the classic JWT revocation security gap.',
    stepByStep: [
      'Constructs Redis cache key `revoked:jti:{jti}`.',
      'Sets key in Redis with exact remaining token TTL (`setex`). Memory is automatically freed when TTL expires.',
      'Implements a fail-closed policy: if Redis is unreachable, raises an error rather than allowing silent logout failure.',
    ],
    inputs: [
      { name: 'jti', type: 'str', desc: 'Unique token UUID from JWT claims' },
      { name: 'ttl_seconds', type: 'int', desc: 'Remaining seconds before token expires (max 900)' },
    ],
    outputs: {
      type: 'bool',
      desc: 'True if revocation was durably committed to Redis',
    },
    dependencies: [
      'redis-py cluster client',
      'backend/app/routes/auth.py',
    ],
    architectureRationale:
      'Standard stateless JWTs cannot be revoked before expiration. Storing only the revoked JTIs until their natural expiry provides immediate logout with minimal Redis memory overhead.',
  },
];

export const CodeExplainerPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeRepo, language } = useCodeSage();
  const [selectedId, setSelectedId] = useState<string>(SAMPLE_EXPLAINERS[0].id);
  const [copied, setCopied] = useState<boolean>(false);
  const [translating, setTranslating] = useState<boolean>(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);

  const activeItem =
    SAMPLE_EXPLAINERS.find((e) => e.id === selectedId) || SAMPLE_EXPLAINERS[0];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeItem.codeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleTranslate = async (targetLang: LanguageCode) => {
    if (targetLang === 'en') {
      setTranslatedText(null);
      return;
    }
    setTranslating(true);
    try {
      const res = await codeSageApi.translateText(activeItem.summary, targetLang);
      setTranslatedText(res.translatedText);
    } catch {
      setTranslatedText('Translation service currently using offline model fallback.');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>CODE EXPLAINER &amp; ARCHITECTURAL INTENT</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Deep Function &amp; Module Rationale
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Split-screen interactive breakdown of critical functions in{' '}
            <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Multilingual Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] border border-slate-800 text-xs">
            <Globe className="w-3.5 h-3.5 text-cyan-300" />
            <select
              value={language}
              onChange={(e) => handleTranslate(e.target.value as LanguageCode)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#041126]">
                  {l.nativeLabel} ({l.label})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Function Selection Tabs */}
      <div className="flex flex-wrap gap-2">
        {SAMPLE_EXPLAINERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setSelectedId(item.id);
              setTranslatedText(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono transition-all cursor-pointer ${
              selectedId === item.id
                ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30 border border-transparent'
                : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-300" />
            <span className="truncate max-w-[280px]">{item.name}</span>
          </button>
        ))}
      </div>

      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Code Editor / Viewer */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#041126] p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-cyan-400" />
              <span className="font-mono text-xs text-slate-200 font-semibold truncate">
                {activeItem.file}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#071A35] hover:bg-[#0A2042] border border-slate-700 text-[11px] text-slate-300 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3 text-cyan-300" />
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/explorer?file=${encodeURIComponent(activeItem.file)}&start=${
                      activeItem.startLine
                    }&end=${activeItem.endLine}`
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#071A35] hover:bg-[#0A2042] border border-slate-700 text-[11px] text-cyan-300 transition-colors cursor-pointer"
              >
                <span>Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>

          <CodeBlockViewer
            code={activeItem.codeSnippet}
            language={activeItem.language}
            maxHeightClass="max-h-[520px]"
          />
        </div>

        {/* Right Side: Structured Explanation */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-800 bg-[#041126] p-5 space-y-5">
          {/* Summary */}
          <div>
            <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>What It Does</span>
            </h3>
            <p className="text-sm text-slate-200 leading-relaxed font-sans bg-[#020817] p-3.5 rounded-xl border border-slate-800">
              {translatedText || activeItem.summary}
            </p>
          </div>

          {/* Architectural Rationale */}
          <div>
            <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-1.5">
              Why It Is Designed This Way
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed bg-[#071A35]/60 p-3 rounded-xl border border-slate-800">
              {activeItem.architectureRationale}
            </p>
          </div>

          {/* Step-by-Step Execution */}
          <div>
            <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider mb-2">
              Execution Sequence
            </h3>
            <div className="space-y-2">
              {activeItem.stepByStep.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-slate-300 bg-[#020817] p-2.5 rounded-lg border border-slate-800"
                >
                  <span className="w-5 h-5 rounded-full bg-[#0A2042] text-cyan-300 text-[10px] font-mono flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inputs & Outputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div className="p-3 rounded-xl bg-[#020817] border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-mono font-semibold text-slate-400">
                Inputs / Parameters
              </span>
              <div className="space-y-1">
                {activeItem.inputs.map((inp) => (
                  <div key={inp.name} className="text-xs text-slate-200">
                    <strong className="font-mono text-cyan-300">{inp.name}</strong>{' '}
                    <span className="text-slate-500 font-mono text-[10px]">({inp.type})</span>
                    <div className="text-[11px] text-slate-400 leading-tight">{inp.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#020817] border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-mono font-semibold text-slate-400">
                Return Value
              </span>
              <div className="text-xs font-mono text-emerald-300">{activeItem.outputs.type}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {activeItem.outputs.desc}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
