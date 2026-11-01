export interface RawSampleRepo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  branch: string;
  description: string;
  suggestedQuestions: string[];
  rawFiles: { path: string; content: string }[];
}

export const SAMPLE_REPOSITORIES: RawSampleRepo[] = [
  {
    id: 'sample-fintech-auth-platform',
    name: 'fintech-auth-platform',
    fullName: 'innovation-ninjas/fintech-auth-platform',
    url: 'https://github.com/innovation-ninjas/fintech-auth-platform',
    branch: 'main',
    description:
      'Sample multi-service FastAPI + React TypeScript payment ledger repository demonstrating stateless RS256 JWT authentication, Redis JTI revocation, optimistic concurrency, and role-based access control.',
    suggestedQuestions: [
      'Why does this project use JWT authentication instead of session-based authentication?',
      'What could break if backend/app/auth/jwt_handler.py changes?',
      'How does optimistic locking prevent double-spend in ledger transfers?',
      'How does the frontend refresh expired access tokens without logging users out?',
      'Explain the overall authentication and authorization architecture.',
    ],
    rawFiles: [
      {
        path: 'docs/ADR-001-authentication-architecture.md',
        content: `# ADR-001: Stateless RS256 JWT Authentication with Redis JTI Revocation

## Status
Accepted — Architecture Review Board

## Context
Our payment ledger API serves three independent downstream microservices (Ledger, Fraud Scoring, and Audit) deployed across multiple Kubernetes availability zones behind a stateless ingress controller, alongside a React SPA frontend and mobile clients.

Traditional server-side session authentication required sticky load-balancer affinity or synchronous PostgreSQL session-table lookups on every API call (~14ms p99 overhead per internal hop).

## Decision
1. **Asymmetric RS256 Access Tokens (15-minute TTL):** Issued by \`backend/app/auth/jwt_handler.py\`. Downstream microservices verify signatures locally using the public key without querying PostgreSQL on each request.
2. **Redis JTI Blocklist for Immediate Revocation:** Pure JWTs cannot be revoked before expiry. To mitigate stolen-token risk, every token carries a unique \`jti\` claim checked against Redis (\`backend/app/auth/revocation_store.py\`) with sub-millisecond O(1) lookup.
3. **Rotating HttpOnly Refresh Tokens (7-day TTL):** Stored as SHA-256 hashes on \`UserSession\` models (\`backend/app/models/user.py\`) and rotated on \`POST /api/v1/auth/refresh\`.

## Trade-offs & Limitations
- Slightly higher complexity than opaque cookie sessions due to key rotation and Redis JTI TTL synchronization.
- Access tokens remain valid for up to 15 minutes ONLY if Redis becomes unreachable and fail-open mode is explicitly enabled (disabled by default in production).
`,
      },
      {
        path: 'backend/requirements.txt',
        content: `fastapi==0.115.4
uvicorn==0.32.0
pyjwt[crypto]==2.9.0
passlib[bcrypt]==1.7.4
sqlalchemy==2.0.36
redis==5.2.0
pydantic==2.9.2
pydantic-settings==2.6.1
pytest==8.3.3
httpx==0.27.2
`,
      },
      {
        path: 'backend/app/core/config.py',
        content: `import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Centralized runtime settings loaded from environment variables."""
    APP_NAME: str = "Fintech Ledger & Auth API"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg://ledger:secret@db:5432/ledger")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://cache:6379/0")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "RS256")
    JWT_PRIVATE_KEY_PEM: str = os.getenv("JWT_PRIVATE_KEY_PEM", "DEV_RSA_PRIVATE_KEY")
    JWT_PUBLIC_KEY_PEM: str = os.getenv("JWT_PUBLIC_KEY_PEM", "DEV_RSA_PUBLIC_KEY")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REDIS_FAIL_CLOSED: bool = True

settings = Settings()
`,
      },
      {
        path: 'backend/app/auth/revocation_store.py',
        content: `import redis
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

def revoke_token_jti(jti: str, remaining_ttl_seconds: int) -> None:
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
        return False
`,
      },
      {
        path: 'backend/app/auth/jwt_handler.py',
        content: `import uuid
from datetime import datetime, timedelta, timezone
import jwt
from fastapi import HTTPException, status
from app.core.config import settings
from app.auth.revocation_store import is_token_revoked, revoke_token_jti

def create_access_token(user_id: str, role: str, scopes: list[str]) -> dict:
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
    return {"access_token": encoded, "jti": jti, "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60}

def verify_access_token(token: str) -> dict:
    """Verify RS256 signature, expiration, and Redis JTI revocation status."""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_PUBLIC_KEY_PEM,
            algorithms=[settings.JWT_ALGORITHM],
            issuer="fintech-auth-service",
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired; trigger refresh rotation.",
        ) from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cryptographic token signature or issuer.",
        ) from exc

    jti = payload.get("jti")
    if not jti or is_token_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been explicitly revoked.",
        )
    return payload

def invalidate_current_token(payload: dict) -> None:
    """Revoke active token JTI immediately upon logout or privilege change."""
    now_ts = int(datetime.now(timezone.utc).timestamp())
    remaining = max(1, int(payload.get("exp", now_ts)) - now_ts)
    revoke_token_jti(payload["jti"], remaining)
`,
      },
      {
        path: 'backend/app/models/user.py',
        content: `import hashlib
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User:
    """Core user identity entity decoupled from ephemeral HTTP transport sessions."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="analyst")
    is_active = Column(Boolean, nullable=False, default=True)

    def verify_password(self, plain_password: str) -> bool:
        """Verify plaintext password against bcrypt hash."""
        return pwd_context.verify(plain_password, self.password_hash)

class RefreshTokenRecord:
    """Hashed rotating refresh token bound to device fingerprint for replay detection."""
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token_sha256 = Column(String(64), unique=True, nullable=False)
    revoked = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    @staticmethod
    def hash_raw_token(raw_token: str) -> str:
        """Hash refresh token with SHA-256 before database persistence."""
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
`,
      },
      {
        path: 'backend/app/models/ledger.py',
        content: `from sqlalchemy import Column, String, Numeric, Integer

class LedgerAccount:
    """Double-entry account using optimistic concurrency version column."""
    __tablename__ = "ledger_accounts"

    id = Column(String(36), primary_key=True)
    owner_id = Column(String(36), nullable=False, index=True)
    currency = Column(String(3), nullable=False, default="INR")
    balance_minor = Column(Numeric(18, 0), nullable=False, default=0)
    version = Column(Integer, nullable=False, default=1)
`,
      },
      {
        path: 'backend/app/services/ledger_service.py',
        content: `from fastapi import HTTPException, status
from app.models.ledger import LedgerAccount

class OptimisticLockConflictError(Exception):
    """Raised when concurrent ledger mutation increments version before commit."""
    pass

def execute_atomic_transfer(db_session, source_id: str, dest_id: str, amount_minor: int, actor_id: str) -> dict:
    """Execute double-entry transfer guarded by optimistic version check to prevent double-spend."""
    if amount_minor <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transfer amount must be positive.")

    source: LedgerAccount = db_session.get(LedgerAccount, source_id)
    dest: LedgerAccount = db_session.get(LedgerAccount, dest_id)
    if not source or not dest:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ledger account not found.")

    if source.balance_minor < amount_minor:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Insufficient settled balance.")

    expected_version = source.version
    updated_rows = (
        db_session.query(LedgerAccount)
        .filter(LedgerAccount.id == source_id, LedgerAccount.version == expected_version)
        .update({
            "balance_minor": source.balance_minor - amount_minor,
            "version": expected_version + 1,
        })
    )
    if updated_rows != 1:
        db_session.rollback()
        raise OptimisticLockConflictError(f"Concurrent balance modification detected on account {source_id}")

    dest.balance_minor += amount_minor
    dest.version += 1
    db_session.commit()
    return {"status": "settled", "source_id": source_id, "dest_id": dest_id, "new_version": expected_version + 1}
`,
      },
      {
        path: 'backend/app/routes/auth.py',
        content: `import secrets
from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from app.auth.jwt_handler import create_access_token, verify_access_token, invalidate_current_token
from app.models.user import User, RefreshTokenRecord

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

def get_current_principal(authorization: str = Header(...)) -> dict:
    """Extract Bearer JWT and return verified principal claims."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer scheme.")
    raw_token = authorization.removeprefix("Bearer ").strip()
    return verify_access_token(raw_token)

@router.post("/login")
def login_with_credentials(email: str, password: str, response: Response, db_session=None) -> dict:
    """Authenticate user credentials, return short-lived RS256 JWT + HttpOnly rotating refresh cookie."""
    user: User = db_session.query(User).filter(User.email == email).first()
    if not user or not user.is_active or not user.verify_password(password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

    token_bundle = create_access_token(user_id=user.id, role=user.role, scopes=["ledger:read", "ledger:transfer"])
    raw_refresh = secrets.token_urlsafe(48)
    _hashed = RefreshTokenRecord.hash_raw_token(raw_refresh)

    response.set_cookie(
        key="refresh_token",
        value=raw_refresh,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=7 * 86400,
    )
    return token_bundle

@router.post("/refresh")
def rotate_refresh_token(response: Response, principal: dict = Depends(get_current_principal)) -> dict:
    """Rotate refresh cookie and issue a fresh 15-minute access token."""
    return create_access_token(
        user_id=principal["sub"],
        role=principal["role"],
        scopes=principal.get("scopes", []),
    )

@router.post("/logout")
def logout_principal(response: Response, principal: dict = Depends(get_current_principal)) -> dict:
    """Revoke active JWT JTI in Redis and clear HttpOnly refresh cookie."""
    invalidate_current_token(principal)
    response.delete_cookie("refresh_token")
    return {"revoked": True, "jti": principal["jti"]}
`,
      },
      {
        path: 'backend/app/routes/transfers.py',
        content: `from fastapi import APIRouter, Depends, HTTPException, status
from app.routes.auth import get_current_principal
from app.services.ledger_service import execute_atomic_transfer

router = APIRouter(prefix="/api/v1/transfers", tags=["ledger"])

@router.post("/execute")
def create_ledger_transfer(
    source_id: str,
    dest_id: str,
    amount_minor: int,
    principal: dict = Depends(get_current_principal),
    db_session=None,
) -> dict:
    """Authorize scope via stateless JWT claims without extra user-table lookup, then execute transfer."""
    if "ledger:transfer" not in principal.get("scopes", []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Missing ledger:transfer scope.")
    return execute_atomic_transfer(db_session, source_id, dest_id, amount_minor, principal["sub"])
`,
      },
      {
        path: 'frontend/src/services/authService.ts',
        content: `let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export async function loginUser(email: string, password: string): Promise<void> {
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
}

export async function fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (inMemoryAccessToken) {
    headers.set('Authorization', \`Bearer \${inMemoryAccessToken}\`);
  }

  const response = await fetch(url, { ...init, headers, credentials: 'include' });
  if (response.status !== 401) {
    return response;
  }

  // Single-flight silent token rotation using HttpOnly refresh cookie
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers,
    })
      .then(async (r) => {
        if (!r.ok) return null;
        const payload = await r.json();
        inMemoryAccessToken = payload.access_token;
        return inMemoryAccessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  const renewed = await refreshPromise;
  if (!renewed) {
    inMemoryAccessToken = null;
    throw new Error('Session expired');
  }

  headers.set('Authorization', \`Bearer \${renewed}\`);
  return fetch(url, { ...init, headers, credentials: 'include' });
}
`,
      },
      {
        path: 'backend/tests/test_auth_jwt.py',
        content: `import pytest
from app.auth.jwt_handler import create_access_token, verify_access_token, invalidate_current_token

def test_stateless_jwt_issuance_and_verification(monkeypatch):
    """Verify issued RS256 token decodes claims and checks revocation store."""
    revoked_set = set()
    monkeypatch.setattr("app.auth.jwt_handler.is_token_revoked", lambda jti: jti in revoked_set)
    monkeypatch.setattr("app.auth.jwt_handler.revoke_token_jti", lambda jti, ttl: revoked_set.add(jti))

    bundle = create_access_token(user_id="usr_101", role="treasurer", scopes=["ledger:transfer"])
    claims = verify_access_token(bundle["access_token"])
    assert claims["sub"] == "usr_101"
    assert "ledger:transfer" in claims["scopes"]

    invalidate_current_token(claims)
    with pytest.raises(Exception):
        verify_access_token(bundle["access_token"])
`,
      },
    ],
  },
  {
    id: 'sample-event-mesh-gateway',
    name: 'event-mesh-gateway',
    fullName: 'innovation-ninjas/event-mesh-gateway',
    url: 'https://github.com/innovation-ninjas/event-mesh-gateway',
    branch: 'main',
    description:
      'Sample Node.js + TypeScript webhook ingestion gateway using HMAC-SHA256 replay protection, bounded circuit breakers, and dead-letter retry queues.',
    suggestedQuestions: [
      'Why does webhook verification check timestamp drift before computing HMAC?',
      'How does the circuit breaker protect downstream consumers during outages?',
      'What could break if src/security/hmacVerifier.ts changes?',
      'Explain the retry and dead-letter queue architecture.',
    ],
    rawFiles: [
      {
        path: 'docs/ADR-002-webhook-reliability.md',
        content: `# ADR-002: Bounded Timestamp HMAC Verification & Half-Open Circuit Breakers

## Context
External payment partners deliver bursty webhook events (up to 4,000 req/s). Downstream consumers occasionally stall during schema migrations.

## Decision
1. Reject webhook requests whose \`X-Webhook-Timestamp\` drifts more than 300 seconds from server UTC *before* allocating crypto buffers (\`src/security/hmacVerifier.ts\`) to block replay attacks cheaply.
2. Wrap downstream HTTP dispatch in a state-machine Circuit Breaker (\`src/engine/circuitBreaker.ts\`) that trips open after 5 consecutive failures and diverts payloads into \`src/queue/deadLetterQueue.ts\`.
`,
      },
      {
        path: 'package.json',
        content: `{
  "name": "event-mesh-gateway",
  "version": "1.4.0",
  "dependencies": {
    "express": "^4.21.2",
    "redis": "^4.7.0"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^2.1.4"
  }
}
`,
      },
      {
        path: 'src/config/gatewayConfig.ts',
        content: `export const gatewayConfig = {
  webhookSecret: process.env.WEBHOOK_SIGNING_SECRET || 'whsec_dev_only',
  maxTimestampDriftSeconds: Number(process.env.MAX_DRIFT_SECONDS || 300),
  circuitFailureThreshold: Number(process.env.CIRCUIT_FAILURE_THRESHOLD || 5),
  circuitCooldownMs: Number(process.env.CIRCUIT_COOLDOWN_MS || 30000),
};
`,
      },
      {
        path: 'src/security/hmacVerifier.ts',
        content: `import crypto from 'crypto';
import { gatewayConfig } from '../config/gatewayConfig';

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  timestampHeader: string
): boolean {
  const eventTs = Number(timestampHeader);
  if (!Number.isFinite(eventTs)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - eventTs) > gatewayConfig.maxTimestampDriftSeconds) {
    // Reject stale replay attempts prior to cryptographic digest computation
    return false;
  }

  const signedPayload = \`\${eventTs}.\${rawBody}\`;
  const expected = crypto
    .createHmac('sha256', gatewayConfig.webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(signatureHeader.replace(/^v1=/, ''), 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
`,
      },
      {
        path: 'src/engine/circuitBreaker.ts',
        content: `import { gatewayConfig } from '../config/gatewayConfig';

export class CircuitBreaker {
  private failures = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttemptAt = 0;

  canExecute(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      return true;
    }
    return this.state === 'HALF_OPEN';
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= gatewayConfig.circuitFailureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + gatewayConfig.circuitCooldownMs;
    }
  }

  getState(): string {
    return this.state;
  }
}
`,
      },
      {
        path: 'src/queue/deadLetterQueue.ts',
        content: `export interface DeadLetterEvent {
  eventId: string;
  payload: string;
  reason: string;
  enqueuedAt: string;
}

const dlqBuffer: DeadLetterEvent[] = [];

export function enqueueDeadLetter(eventId: string, payload: string, reason: string): DeadLetterEvent {
  const item: DeadLetterEvent = {
    eventId,
    payload,
    reason,
    enqueuedAt: new Date().toISOString(),
  };
  dlqBuffer.push(item);
  return item;
}

export function listDeadLetters(): DeadLetterEvent[] {
  return [...dlqBuffer];
}
`,
      },
      {
        path: 'src/routes/webhookRoutes.ts',
        content: `import express from 'express';
import { verifyWebhookSignature } from '../security/hmacVerifier';
import { CircuitBreaker } from '../engine/circuitBreaker';
import { enqueueDeadLetter } from '../queue/deadLetterQueue';

export const router = express.Router();
const breaker = new CircuitBreaker();

router.post('/api/webhooks/ingest', async (req, res) => {
  const signature = String(req.headers['x-webhook-signature'] || '');
  const timestamp = String(req.headers['x-webhook-timestamp'] || '');
  const rawBody = JSON.stringify(req.body || {});

  if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
    res.status(401).json({ error: 'Invalid HMAC signature or replay window exceeded' });
    return;
  }

  if (!breaker.canExecute()) {
    const dlq = enqueueDeadLetter(String(req.body?.id || 'evt_unknown'), rawBody, 'Circuit OPEN');
    res.status(202).json({ status: 'queued_dlq', dlq });
    return;
  }

  breaker.recordSuccess();
  res.status(200).json({ status: 'delivered', circuit: breaker.getState() });
});
`,
      },
      {
        path: 'tests/hmacVerifier.test.ts',
        content: `import crypto from 'crypto';
import { verifyWebhookSignature } from '../src/security/hmacVerifier';
import { gatewayConfig } from '../src/config/gatewayConfig';

export function testValidSignaturePasses(): boolean {
  const ts = String(Math.floor(Date.now() / 1000));
  const body = '{"id":"evt_1"}';
  const sig = crypto
    .createHmac('sha256', gatewayConfig.webhookSecret)
    .update(\`\${ts}.\${body}\`)
    .digest('hex');
  return verifyWebhookSignature(body, \`v1=\${sig}\`, ts);
}
`,
      },
    ],
  },
];
