import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  ChatMessage,
  ChatResponse,
  EvidenceItem,
  HealthStatus,
  LanguageCode,
  RepositoryGraph,
  RepositorySummary,
} from '../types';
import { codeSageApi } from '../services/api';

interface CodeSageContextValue {
  health: HealthStatus | null;
  repositories: RepositorySummary[];
  activeRepo: RepositorySummary | null;
  activeGraph: RepositoryGraph | null;
  loadingRepo: boolean;
  repoError: string | null;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  selectRepository: (repoId: string) => void;
  refreshRepositories: () => Promise<void>;
  refreshHealth: () => Promise<void>;
  conversationsByRepo: Record<string, ChatMessage[]>;
  activeEvidence: EvidenceItem[];
  highlightedCitationId: string | null;
  setHighlightedCitationId: (id: string | null) => void;
  setActiveEvidence: (items: EvidenceItem[]) => void;
  askingQuestion: boolean;
  askError: string | null;
  sendQuestion: (question: string, overrideLang?: LanguageCode) => Promise<ChatResponse | undefined>;
  markFeedback: (messageId: string, feedback: 'helpful' | 'unhelpful') => void;
  clearConversation: () => void;
  ingestModalOpen: boolean;
  setIngestModalOpen: (open: boolean) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  shortcutsModalOpen: boolean;
  setShortcutsModalOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  shortcutToast: { message: string; combo: string } | null;
  triggerShortcutToast: (message: string, combo: string) => void;
}

const CodeSageContext = createContext<CodeSageContextValue | null>(null);

const INITIAL_SAMPLE_SEED: ChatMessage[] = [
  {
    id: 'seed-q-1',
    role: 'user',
    content: 'Why does this project use JWT authentication instead of session-based authentication?',
    timestamp: new Date().toISOString(),
    language: 'en',
  },
  {
    id: 'seed-a-1',
    role: 'assistant',
    content:
      'This repository implements **stateless asymmetric RS256 JWT access tokens** paired with **Redis JTI revocation** and **rotating HttpOnly refresh cookies** to eliminate synchronous PostgreSQL session-table lookups across horizontally scaled Kubernetes microservices while preserving immediate logout revocation.',
    timestamp: new Date().toISOString(),
    language: 'en',
    structured: {
      id: 'seed-struct-1',
      repoId: 'sample-fintech-auth-platform',
      question: 'Why does this project use JWT authentication instead of session-based authentication?',
      language: 'en',
      translationProvider: 'native',
      summary:
        'Stateless RS256 JWTs avoid ~14ms p99 database session lookups across Ledger, Fraud, and Audit services, while a Redis JTI blocklist closes the classic JWT revocation gap.',
      answer:
        'As documented in `docs/ADR-001-authentication-architecture.md` and enforced in `backend/app/auth/jwt_handler.py`, stateful server sessions required sticky load-balancer affinity or per-hop PostgreSQL lookups. Instead, the architecture issues 15-minute RS256 JWTs verified locally via `JWT_PUBLIC_KEY_PEM` and checks `jti` claims in O(1) against Redis (`backend/app/auth/revocation_store.py`).',
      reasoning_sections: [
        {
          stepNumber: 1,
          heading: '1. Stateless Microservice Verification Without Sticky Sessions',
          body: 'Downstream services (Ledger, Fraud Scoring, Audit) validate requests locally using `JWT_PUBLIC_KEY_PEM` and `RS256` in `verify_access_token()`, avoiding synchronous database session queries on every internal hop.',
          citationIds: ['seed-ev-1', 'seed-ev-2'],
        },
        {
          stepNumber: 2,
          heading: '2. Immediate Revocation via Redis JTI Blocklist',
          body: 'Because pure stateless JWTs cannot be invalidated prior to expiry, `create_access_token()` embeds a UUID `jti` claim. On logout (`POST /api/v1/auth/logout`), `revoke_token_jti()` writes `revoked:jti:{jti}` to Redis with the remaining TTL and fails closed if Redis is unreachable.',
          citationIds: ['seed-ev-2', 'seed-ev-3', 'seed-ev-4'],
        },
        {
          stepNumber: 3,
          heading: '3. XSS-Resistant Frontend Memory Storage & Silent Rotation',
          body: '`frontend/src/services/authService.ts` keeps the short-lived access token strictly in JavaScript memory (`inMemoryAccessToken`) rather than `localStorage`, relying on an `HttpOnly; SameSite=Strict` refresh cookie to rotate expired 401 tokens via single-flight `/api/v1/auth/refresh`.',
          citationIds: ['seed-ev-4', 'seed-ev-5'],
        },
      ],
      evidence: [
        {
          id: 'seed-ev-1',
          repoId: 'sample-fintech-auth-platform',
          filePath: 'docs/ADR-001-authentication-architecture.md',
          fileType: 'docs',
          language: 'Markdown',
          startLine: 6,
          endLine: 18,
          excerpt: `## Context
Our payment ledger API serves three independent downstream microservices (Ledger, Fraud Scoring, and Audit) deployed across multiple Kubernetes availability zones behind a stateless ingress controller, alongside a React SPA frontend and mobile clients.

Traditional server-side session authentication required sticky load-balancer affinity or synchronous PostgreSQL session-table lookups on every API call (~14ms p99 overhead per internal hop).

## Decision
1. **Asymmetric RS256 Access Tokens (15-minute TTL):** Issued by \`backend/app/auth/jwt_handler.py\`. Downstream microservices verify signatures locally using the public key without querying PostgreSQL on each request.`,
          relevance: 'Architectural Decision Record documenting why stateful DB sessions were rejected',
          certainty: 'observed',
          verified: true,
        },
        {
          id: 'seed-ev-2',
          repoId: 'sample-fintech-auth-platform',
          filePath: 'backend/app/auth/jwt_handler.py',
          fileType: 'source',
          language: 'Python',
          startLine: 8,
          endLine: 51,
          excerpt: `def create_access_token(user_id: str, role: str, scopes: list[str]) -> dict:
    """Issue short-lived stateless RS256 JWT with unique JTI claim for horizontal scaling."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = str(uuid.uuid4())
    payload = {
        "sub": user_id,
        "role": role,
        "scopes": scopes,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": "fintech-auth-service",
    }
    encoded = jwt.encode(
        payload,
        settings.JWT_PRIVATE_KEY_PEM,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"access_token": encoded, "jti": jti, "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}`,
          relevance: 'RS256 token signing with embedded scopes and UUID jti claim',
          certainty: 'observed',
          verified: true,
        },
        {
          id: 'seed-ev-3',
          repoId: 'sample-fintech-auth-platform',
          filePath: 'backend/app/auth/revocation_store.py',
          fileType: 'source',
          language: 'Python',
          startLine: 6,
          endLine: 19,
          excerpt: `def revoke_token_jti(jti: str, remaining_ttl_seconds: int) -> None:
    """Persist revoked JWT ID in Redis until original token expiration."""
    ttl = max(1, remaining_ttl_seconds)
    redis_client.setex(f"revoked:jti:{jti}", ttl, "1")

def is_token_revoked(jti: str) -> bool:
    """Check O(1) Redis blocklist; fail closed in production if cache is unreachable."""
    try:
        return redis_client.exists(f"revoked:jti:{jti}") == 1
    except redis.RedisError:
        if settings.REDIS_FAIL_CLOSED:
            return True
        return False`,
          relevance: 'O(1) Redis JTI revocation store with fail-closed production safety',
          certainty: 'observed',
          verified: true,
        },
        {
          id: 'seed-ev-4',
          repoId: 'sample-fintech-auth-platform',
          filePath: 'backend/app/routes/auth.py',
          fileType: 'source',
          language: 'Python',
          startLine: 15,
          endLine: 49,
          excerpt: `@router.post("/login")
def login_with_credentials(email: str, password: str, response: Response, db_session=None) -> dict:
    """Authenticate user credentials, return short-lived RS256 JWT + HttpOnly rotating refresh cookie."""
    user: User = db_session.query(User).filter(User.email == email).first()
    if not user or not user.is_active or not user.verify_password(password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    token_bundle = create_access_token(user_id=user.id, role=user.role, scopes=["ledger:read", "ledger:transfer"])`,
          relevance: 'FastAPI auth route issuing Bearer JWT alongside Strict HttpOnly refresh cookie',
          certainty: 'observed',
          verified: true,
        },
        {
          id: 'seed-ev-5',
          repoId: 'sample-fintech-auth-platform',
          filePath: 'frontend/src/services/authService.ts',
          fileType: 'source',
          language: 'TypeScript',
          startLine: 8,
          endLine: 44,
          excerpt: `export async function loginUser(email: string, password: string): Promise<void> {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Authentication failed');
  const data = await res.json();
  // Stored strictly in JS memory rather than localStorage to mitigate XSS token exfiltration
  inMemoryAccessToken = data.access_token;
}`,
          relevance: 'Frontend client storing Bearer token in memory and rotating on 401',
          certainty: 'observed',
          verified: true,
        },
      ],
      related_files: [
        'docs/ADR-001-authentication-architecture.md',
        'backend/app/auth/jwt_handler.py',
        'backend/app/auth/revocation_store.py',
        'backend/app/routes/auth.py',
        'frontend/src/services/authService.ts',
      ],
      related_symbols: [
        'create_access_token',
        'verify_access_token',
        'is_token_revoked',
        'login_with_credentials',
        'fetchWithAuth',
      ],
      confidence: 0.94,
      evidence_coverage: 'high',
      limitations: [
        'Kubernetes ingress TLS termination config is referenced in ADR-001 prose rather than Helm YAML manifests in this sample repository.',
      ],
      follow_up_suggestions: [
        'What could break if backend/app/auth/jwt_handler.py changes?',
        'How does optimistic locking prevent double-spend in ledger transfers?',
        'Which automated tests verify JWT revocation behavior?',
      ],
      engineMode: 'gemini_graphrag',
      createdAt: new Date().toISOString(),
    },
  },
];

export const CodeSageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [activeRepoId, setActiveRepoId] = useState<string>('sample-fintech-auth-platform');
  const [activeGraph, setActiveGraph] = useState<RepositoryGraph | null>(null);
  const [loadingRepo, setLoadingRepo] = useState<boolean>(true);
  const [repoError, setRepoError] = useState<string | null>(null);

  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('codesage_lang');
    return (saved as LanguageCode) || 'en';
  });

  const [conversationsByRepo, setConversationsByRepo] = useState<Record<string, ChatMessage[]>>({
    'sample-fintech-auth-platform': INITIAL_SAMPLE_SEED,
  });

  const [activeEvidence, setActiveEvidence] = useState<EvidenceItem[]>(
    INITIAL_SAMPLE_SEED[1].structured?.evidence || []
  );
  const [highlightedCitationId, setHighlightedCitationId] = useState<string | null>(null);

  const [askingQuestion, setAskingQuestion] = useState<boolean>(false);
  const [askError, setAskError] = useState<string | null>(null);

  const [ingestModalOpen, setIngestModalOpen] = useState<boolean>(false);
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('codesage_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('codesage_sidebar_collapsed', String(sidebarCollapsed));
    } catch {
      // ignore
    }
  }, [sidebarCollapsed]);

  const [shortcutToast, setShortcutToast] = useState<{ message: string; combo: string } | null>(null);

  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerShortcutToast = useCallback((message: string, combo: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setShortcutToast({ message, combo });
    toastTimerRef.current = setTimeout(() => {
      setShortcutToast(null);
    }, 1800);
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('codesage_lang', lang);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await codeSageApi.getHealth();
      setHealth(h);
    } catch {
      // Leave previous state or null
    }
  }, []);

  const refreshRepositories = useCallback(async () => {
    setLoadingRepo(true);
    setRepoError(null);
    try {
      const { repositories: list } = await codeSageApi.listRepositories();
      setRepositories(list);
      if (list.length > 0 && !list.some((r) => r.id === activeRepoId)) {
        setActiveRepoId(list[0].id);
      }
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Unable to load repositories');
    } finally {
      setLoadingRepo(false);
    }
  }, [activeRepoId]);

  useEffect(() => {
    refreshHealth();
    refreshRepositories();
  }, [refreshHealth, refreshRepositories]);

  const activeRepo = repositories.find((r) => r.id === activeRepoId) || repositories[0] || null;

  useEffect(() => {
    if (!activeRepo) return;
    const controller = new AbortController();
    codeSageApi
      .getGraph(activeRepo.id, controller.signal)
      .then((g) => setActiveGraph(g))
      .catch(() => {
        // Ignore aborted graph load
      });

    // Update active evidence panel to latest assistant answer in this repo
    const msgs = conversationsByRepo[activeRepo.id] || [];
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant' && m.structured);
    if (lastAssistant?.structured) {
      setActiveEvidence(lastAssistant.structured.evidence);
    } else {
      setActiveEvidence([]);
    }

    return () => controller.abort();
  }, [activeRepo?.id]);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectRepository = useCallback((repoId: string) => {
    setActiveRepoId(repoId);
    setAskError(null);
    setHighlightedCitationId(null);
  }, []);

  const sendQuestion = useCallback(
    async (question: string, overrideLang?: LanguageCode) => {
      if (!activeRepo || !question.trim() || askingQuestion) return;
      const targetLang = overrideLang || language;
      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: question.trim(),
        timestamp: new Date().toISOString(),
        language: targetLang,
      };

      setConversationsByRepo((prev) => ({
        ...prev,
        [activeRepo.id]: [...(prev[activeRepo.id] || []), userMsg],
      }));

      setAskingQuestion(true);
      setAskError(null);

      try {
        const res = await codeSageApi.askCodeSage(activeRepo.id, question.trim(), targetLang);
        const assistantMsg: ChatMessage = {
          id: res.id,
          role: 'assistant',
          content: res.summary,
          timestamp: res.createdAt,
          language: res.language,
          structured: res,
        };
        setConversationsByRepo((prev) => ({
          ...prev,
          [activeRepo.id]: [...(prev[activeRepo.id] || []), assistantMsg],
        }));
        setActiveEvidence(res.evidence);
        if (res.evidence[0]) {
          setHighlightedCitationId(res.evidence[0].id);
        }
        return res;
      } catch (err) {
        setAskError(err instanceof Error ? err.message : 'Failed to retrieve grounded explanation.');
        return undefined;
      } finally {
        setAskingQuestion(false);
      }
    },
    [activeRepo, askingQuestion, language]
  );

  const markFeedback = useCallback(
    (messageId: string, feedback: 'helpful' | 'unhelpful') => {
      if (!activeRepo) return;
      setConversationsByRepo((prev) => ({
        ...prev,
        [activeRepo.id]: (prev[activeRepo.id] || []).map((m) =>
          m.id === messageId ? { ...m, feedback } : m
        ),
      }));
    },
    [activeRepo]
  );

  const clearConversation = useCallback(() => {
    if (!activeRepo) return;
    setConversationsByRepo((prev) => ({
      ...prev,
      [activeRepo.id]: [],
    }));
    setActiveEvidence([]);
    setHighlightedCitationId(null);
  }, [activeRepo]);

  return (
    <CodeSageContext.Provider
      value={{
        health,
        repositories,
        activeRepo,
        activeGraph,
        loadingRepo,
        repoError,
        language,
        setLanguage,
        selectRepository,
        refreshRepositories,
        refreshHealth,
        conversationsByRepo,
        activeEvidence,
        highlightedCitationId,
        setHighlightedCitationId,
        setActiveEvidence,
        askingQuestion,
        askError,
        sendQuestion,
        markFeedback,
        clearConversation,
        ingestModalOpen,
        setIngestModalOpen,
        searchModalOpen,
        setSearchModalOpen,
        shortcutsModalOpen,
        setShortcutsModalOpen,
        sidebarCollapsed,
        setSidebarCollapsed,
        shortcutToast,
        triggerShortcutToast,
      }}
    >
      {children}
    </CodeSageContext.Provider>
  );
};

export function useCodeSage(): CodeSageContextValue {
  const ctx = useContext(CodeSageContext);
  if (!ctx) {
    throw new Error('useCodeSage must be used within CodeSageProvider');
  }
  return ctx;
}
