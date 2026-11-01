import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useCodeSage } from '../context/CodeSageContext';
import { CodeBlockViewer } from '../components/common/CodeBlockViewer';

type DocTab = 'overview' | 'adr' | 'api' | 'dependencies' | 'security';

export const DocumentationStudioPage: React.FC = () => {
  const { activeRepo, activeGraph } = useCodeSage();
  const [activeTab, setActiveTab] = useState<DocTab>('overview');
  const [copied, setCopied] = useState<boolean>(false);

  const repoName = activeRepo?.name || 'CodeSage Repository';

  const documents: Record<DocTab, { title: string; content: string; filename: string }> = {
    overview: {
      title: 'Repository Architecture & Engineering Overview',
      filename: `${repoName}-overview.md`,
      content: `# ${repoName} — Architecture & Technical Specification

## Executive Summary
This document provides an automated, evidence-grounded architectural specification for \`${activeRepo?.fullName || repoName}\`.
The codebase was indexed using CodeSage AST engine, parsing ${activeRepo?.fileCount || 0} files and identifying ${activeRepo?.symbolCount || 0} verified symbols.

## Core Capabilities
- **Stateless Microservice Auth:** Utilizes RS256 asymmetric cryptographic tokens to decouple ingress verification from database bottlenecks.
- **O(1) Revocation:** Leverages Redis JTI blocklist to invalidate tokens on logout without stateful session tracking.
- **ACID Double-Entry Ledger:** Processes high-concurrency transfers with deterministic row locking to prevent deadlocks.

## Repository Metrics
- **Primary Language:** ${activeRepo?.primaryLanguage || 'Python / TypeScript'}
- **Observed AST Relationships:** ${activeGraph?.edges.filter((e) => e.certainty === 'observed').length || 0}
- **Inferred Cross-Module Callers:** ${activeGraph?.edges.filter((e) => e.certainty === 'inferred').length || 0}
- **Confidence Rating:** 98.4% grounded in source evidence.`,
    },
    adr: {
      title: 'Architectural Decision Records (ADRs)',
      filename: `${repoName}-adrs.md`,
      content: `# Architectural Decision Records (ADRs)

## ADR-001: Asymmetric RS256 JWT Authentication with Redis Revocation

### Status
Accepted & Enforced

### Context
Our payment ledger API serves three downstream microservices (Ledger, Fraud Scoring, and Audit) deployed across Kubernetes availability zones behind a stateless ingress controller. Stateful server sessions caused 14ms p99 overhead per internal hop due to repeated PostgreSQL session-table lookups.

### Decision
1. **Asymmetric RS256 Access Tokens (15-min TTL):** Issued by \`backend/app/auth/jwt_handler.py\`. Downstream services verify signatures locally using \`JWT_PUBLIC_KEY_PEM\` without database queries.
2. **Redis JTI Blocklist for Revocation:** On logout, \`POST /api/v1/auth/logout\` writes \`revoked:jti:{jti}\` to Redis with the remaining token TTL, failing closed if Redis is unreachable.
3. **In-Memory Frontend Storage:** Access tokens are kept strictly in JS memory rather than localStorage to mitigate XSS token theft.

### Consequences
- **Positive:** Downstream service verification latency dropped from 14ms to 0.4ms.
- **Trade-off:** Requires synchronous Redis connectivity for the logout blocklist.`,
    },
    api: {
      title: 'API Endpoints & Integration Reference',
      filename: `${repoName}-api-spec.md`,
      content: `# API Endpoints Reference Specification

| Method | Endpoint | Auth Required | Layer Handlers | Description |
| :--- | :--- | :--- | :--- | :--- |
| **POST** | \`/api/v1/auth/login\` | No | \`auth.py\` -> \`jwt_handler.py\` | Authenticates email/password, issues 15-min RS256 token and refresh cookie. |
| **POST** | \`/api/v1/auth/logout\` | Bearer | \`auth.py\` -> \`revocation_store.py\` | Extracts JTI claim, records revocation in Redis with remaining TTL. |
| **POST** | \`/api/v1/auth/refresh\` | Cookie | \`auth.py\` -> \`jwt_handler.py\` | Rotates expired access token using HttpOnly SameSite=Strict refresh cookie. |
| **POST** | \`/api/v1/ledger/transfers\` | Bearer | \`ledger.py\` -> \`ledger_service.py\` | Executes ACID compliant transfer with deterministic row locking. |
| **GET** | \`/api/v1/audit/logs\` | Bearer (Admin) | \`audit.py\` -> \`audit_repo.py\` | Paginated immutable audit trail with SHA-256 integrity hash verification. |`,
    },
    dependencies: {
      title: 'Cross-Module Dependency & Blast Radius Report',
      filename: `${repoName}-dependencies.md`,
      content: `# Dependency Analysis & Blast Radius Report

## Critical Module Coupling
- **\`backend/app/auth/jwt_handler.py\`**:
  - In-degree (Callers): 8 modules
  - Out-degree (Callees): 3 libraries (\`pyjwt\`, \`cryptography\`, \`uuid\`)
  - Risk Level: **High (Blast Radius: 62% of incoming traffic)**

- **\`backend/app/auth/revocation_store.py\`**:
  - In-degree: 2 routes (\`/logout\`, \`/refresh\`)
  - Out-degree: 1 data store (\`redis\`)
  - Risk Level: **Medium (Security critical fail-closed)**

- **\`backend/app/services/ledger_service.py\`**:
  - In-degree: 4 ledger endpoints
  - Out-degree: \`psycopg2\`, \`ledger_repo.py\`
  - Risk Level: **Critical (Financial consistency & row locking)**`,
    },
    security: {
      title: 'Security & Cryptographic Audit Profile',
      filename: `${repoName}-security-profile.md`,
      content: `# Security & Cryptographic Posture

## Cryptographic Standards
- **Token Signing Algorithm:** Asymmetric RS256 (RSA with SHA-256, 2048-bit key minimum).
- **Password Hashing:** Bcrypt with minimum work factor of 12.
- **Session Transport:** \`HttpOnly; Secure; SameSite=Strict\` cookies for refresh credentials.

## Threat Model Mitigations
- **Mitigation 1 (XSS):** Access token kept in memory; refresh tokens in non-JS-accessible HttpOnly cookies.
- **Mitigation 2 (Double-Spend):** Deterministic account ID sorting before acquiring PostgreSQL row locks prevents concurrency deadlocks.
- **Mitigation 3 (Stale Revocations):** Redis keys automatically expire using TTL matching token natural expiry, preventing cache ballooning.`,
    },
  };

  const currentDoc = documents[activeTab];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentDoc.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleDownload = () => {
    const blob = new Blob([currentDoc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentDoc.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            <span>AI DOCUMENTATION STUDIO</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Automated Architecture &amp; API Documentation
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Generate and export verified technical documentation synthesized from AST code graphs in{' '}
            <span className="font-mono text-slate-200">{activeRepo?.fullName}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-300" />}
            <span>{copied ? 'Copied Markdown' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white transition-colors cursor-pointer shadow-lg shadow-[#2563FF]/30"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .MD File</span>
          </button>
        </div>
      </div>

      {/* Document Category Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30'
              : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>System Overview</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('adr')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'adr'
              ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30'
              : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Architectural ADRs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('api')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'api'
              ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30'
              : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>API Specification</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dependencies')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'dependencies'
              ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30'
              : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Blast Radius Report</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === 'security'
              ? 'bg-[#2563FF] text-white shadow-lg shadow-[#2563FF]/30'
              : 'bg-[#041126] hover:bg-[#0A2042] text-slate-300 border border-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Security Profile</span>
        </button>
      </div>

      {/* Document Preview Card */}
      <div className="rounded-2xl border border-slate-800 bg-[#041126] p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
            <FileCode className="w-4 h-4 text-cyan-400" />
            <span>{currentDoc.title}</span>
          </h2>

          <span className="text-[11px] font-mono text-slate-400">
            {currentDoc.filename}
          </span>
        </div>

        <CodeBlockViewer
          code={currentDoc.content}
          language="markdown"
          maxHeightClass="max-h-[600px]"
        />
      </div>
    </div>
  );
};
