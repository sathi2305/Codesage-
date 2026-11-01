import assert from 'node:assert/strict';
import { sanitizeArchiveEntryPath, validateRepositoryUrl } from '../src/engine/security.ts';
import {
  getRepositoryRecord,
  initializeSampleRepositories,
  listRepositories,
} from '../src/engine/ingestor.ts';
import { computeBlastRadius, findShortestDependencyPath } from '../src/engine/graphEngine.ts';
import { retrieveGraphRagEvidence } from '../src/engine/ragEngine.ts';

async function runVerificationSuite() {
  // 1. Security validation checks
  assert.equal(validateRepositoryUrl('https://github.com/expressjs/cors').valid, true);
  assert.equal(validateRepositoryUrl('file:///etc/passwd').valid, false);
  assert.equal(validateRepositoryUrl('https://127.0.0.1/internal/repo').valid, false);
  assert.equal(validateRepositoryUrl('http://github.com/expressjs/cors').valid, false);
  assert.equal(sanitizeArchiveEntryPath('../../../etc/passwd'), null);
  assert.equal(sanitizeArchiveEntryPath('src/auth/jwt.py'), 'src/auth/jwt.py');

  // 2. Repository initialization & AST parsing checks
  initializeSampleRepositories();
  const repos = listRepositories();
  assert.ok(repos.length >= 2, 'Expected at least 2 sample repositories');

  const fintech = getRepositoryRecord('sample-fintech-auth-platform');
  assert.ok(fintech, 'Expected fintech sample repository');
  assert.ok(fintech.files.length >= 10, 'Expected discovered source/config/doc/test files');
  assert.ok(fintech.graph.nodes.length >= 15, 'Expected Knowledge Graph nodes');
  assert.ok(fintech.graph.edges.length >= 15, 'Expected Knowledge Graph edges');

  // 3. Blast-radius & shortest dependency path checks
  const blast = computeBlastRadius(fintech.files, 'backend/app/auth/jwt_handler.py');
  assert.ok(blast.directDependents.length >= 1, 'jwt_handler.py must have direct dependents');
  assert.ok(blast.coveringTests.length >= 1, 'jwt_handler.py must link to test_auth_jwt.py');

  const depPath = findShortestDependencyPath(
    fintech.files,
    'backend/app/routes/transfers.py',
    'backend/app/core/config.py'
  );
  assert.equal(depPath.found, true, 'Expected shortest dependency path from transfers.py to config.py');

  // 4. GraphRAG evidence retrieval verification
  const rag = retrieveGraphRagEvidence(
    fintech.summary.id,
    'Why does this project use JWT authentication instead of session-based authentication?',
    fintech.files,
    fintech.graph
  );
  assert.ok(rag.snippets.length >= 3, 'Expected multiple verified evidence snippets');
  assert.ok(
    rag.relatedFiles.includes('backend/app/auth/jwt_handler.py'),
    'Expected jwt_handler.py in retrieved evidence'
  );

  // 5. Code Investigation & Architectural Layering checks
  assert.ok(fintech.analysis.architecturalLayers.length >= 3, 'Expected at least 3 architectural layers');
  assert.ok(fintech.analysis.findings.length >= 3, 'Expected structural findings with verified line references');
  for (const f of fintech.analysis.findings) {
    assert.ok(f.filePath, 'Finding must specify filePath');
    assert.ok(f.startLine > 0 && f.endLine >= f.startLine, 'Finding line bounds must be valid');
  }

  console.log('ALL CRITICAL ENGINE TESTS PASSED');
}

runVerificationSuite();
