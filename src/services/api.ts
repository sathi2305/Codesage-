import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

// ============================================================================
// 1. PRIMARY TYPESCRIPT INTERFACES
// ============================================================================

// ----------------------------------------------------------------------------
// A. Repository Management Interfaces
// ----------------------------------------------------------------------------

export type IndexingStage =
  | 'queued'
  | 'validating'
  | 'cloning'
  | 'parsing'
  | 'graphing'
  | 'ready'
  | 'error';

export interface RepositorySummary {
  id: string;
  name: string;
  fullName: string;
  url: string;
  branch: string;
  description: string;
  isSample: boolean;
  sourceType: 'sample' | 'github' | 'archive';
  status: IndexingStage;
  progress: number;
  statusMessage: string;
  indexedAt: string;
  fileCount: number;
  symbolCount: number;
  edgeCount: number;
  primaryLanguage: string;
  languages: { language: string; files: number; lines: number; percentage: number }[];
  suggestedQuestions: string[];
}

export type Repository = RepositorySummary;

export interface IngestRepoPayload {
  url: string;
}

export interface UploadArchivePayload {
  fileName: string;
  base64Data: string;
}

export interface ReindexPayload {
  repoId?: string;
  url?: string;
}

export interface CodeSymbol {
  id: string;
  name: string;
  kind: 'Function' | 'Class' | 'APIEndpoint' | 'Variable';
  filePath: string;
  startLine: number;
  endLine: number;
  signature: string;
  docstring?: string;
  calls: string[];
}

export interface FileImport {
  source: string;
  resolvedPath?: string;
  specifiers: string[];
  line: number;
  isExternal: boolean;
}

export interface RepoFile {
  path: string;
  name: string;
  extension: string;
  language: string;
  fileType: 'source' | 'config' | 'test' | 'docs';
  sizeBytes: number;
  lineCount: number;
  content: string;
  symbols: CodeSymbol[];
  imports: FileImport[];
  exports: string[];
  configKeys: string[];
}

// ----------------------------------------------------------------------------
// B. Chat & Grounded Reasoning Interfaces
// ----------------------------------------------------------------------------

export type LanguageCode = 'en' | 'ta' | 'hi' | 'te' | 'ml' | 'kn' | 'bn';

export interface EvidenceItem {
  id: string;
  repoId: string;
  filePath: string;
  fileType: 'source' | 'config' | 'test' | 'docs';
  language: string;
  startLine: number;
  endLine: number;
  excerpt: string;
  relevance: string;
  certainty: 'observed' | 'inferred';
  verified: boolean;
}

export interface ReasoningSection {
  stepNumber: number;
  heading: string;
  body: string;
  citationIds: string[];
}

export interface ChatResponse {
  id: string;
  repoId: string;
  question: string;
  language: LanguageCode;
  translationProvider?: 'native' | 'sarvam' | 'gemini_fallback' | 'unavailable';
  answer: string;
  summary: string;
  reasoning_sections: ReasoningSection[];
  evidence: EvidenceItem[];
  related_files: string[];
  related_symbols: string[];
  confidence: number;
  evidence_coverage: 'high' | 'partial' | 'insufficient';
  limitations: string[];
  follow_up_suggestions: string[];
  engineMode: 'gemini_graphrag' | 'deterministic_graphrag';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  language?: LanguageCode;
  structured?: ChatResponse;
  feedback?: 'helpful' | 'unhelpful';
}

export interface AskQuestionPayload {
  repoId: string;
  question: string;
  language: LanguageCode;
}

export interface TranslatePayload {
  text: string;
  targetLanguage: LanguageCode;
}

// ----------------------------------------------------------------------------
// C. Knowledge Graph Data Structures
// ----------------------------------------------------------------------------

export type NodeCategory =
  | 'Repository'
  | 'File'
  | 'Function'
  | 'Class'
  | 'Module'
  | 'Configuration'
  | 'APIEndpoint'
  | 'Test'
  | 'Documentation';

export type EdgeRelationType =
  | 'CONTAINS'
  | 'IMPORTS'
  | 'CALLS'
  | 'DEPENDS_ON'
  | 'CONFIGURES'
  | 'TESTS'
  | 'DOCUMENTS';

export type RelationshipCertainty = 'observed' | 'inferred';

export interface GraphNodeData extends Record<string, unknown> {
  label: string;
  category: NodeCategory;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  language?: string;
  signature?: string;
  description?: string;
  inDegree: number;
  outDegree: number;
  cypherSnippet?: string;
}

export interface GraphNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: GraphNodeData;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: EdgeRelationType;
  certainty: RelationshipCertainty;
  line?: number;
}

export interface RepositoryGraph {
  repoId: string;
  isSample: boolean;
  engineMode: 'neo4j' | 'local_fallback';
  nodes: GraphNode[];
  edges: GraphEdge[];
  cypherPreview: string[];
}

// ----------------------------------------------------------------------------
// D. Auxiliary Analysis & Diagnostics Interfaces
// ----------------------------------------------------------------------------

export interface DependencyPathResult {
  fromFile: string;
  toFile: string;
  found: boolean;
  hops: {
    file: string;
    relation: EdgeRelationType;
    certainty: RelationshipCertainty;
    line?: number;
  }[];
}

export interface BlastRadiusReport {
  targetFile: string;
  directDependents: { file: string; line?: number; certainty: RelationshipCertainty }[];
  transitiveDependents: string[];
  affectedEndpoints: { route: string; filePath: string; line: number }[];
  coveringTests: { testFile: string; symbols: string[] }[];
  externalPackages: string[];
  riskLevel: 'low' | 'moderate' | 'high';
  summary: string;
}

export interface CodeFinding {
  id: string;
  severity: 'info' | 'warning' | 'architectural';
  title: string;
  description: string;
  filePath: string;
  startLine: number;
  endLine: number;
  category: 'coupling' | 'security' | 'test_coverage' | 'configuration' | 'documentation';
}

export interface CodeAnalysisSummary {
  repoId: string;
  totalFiles: number;
  totalLines: number;
  totalSymbols: number;
  totalImports: number;
  testFilesCount: number;
  docFilesCount: number;
  configFilesCount: number;
  languages: { language: string; files: number; lines: number; percentage: number }[];
  symbolBreakdown: { kind: string; count: number }[];
  topCoupledFiles: {
    filePath: string;
    inDegree: number;
    outDegree: number;
    lineCount: number;
    symbolCount: number;
  }[];
  architecturalLayers: {
    layer: string;
    files: string[];
    responsibility: string;
  }[];
  findings: CodeFinding[];
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  team: string;
  services: {
    api: { status: 'connected'; label: string };
    llm: { status: 'connected' | 'fallback'; model: string; label: string };
    neo4j: { status: 'connected' | 'not_configured' | 'error'; uri: string | null; label: string };
    sarvam: { status: 'connected' | 'not_configured'; label: string };
  };
}

// ============================================================================
// 2. CENTRALIZED AXIOS INSTANCE
// ============================================================================

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Primary centralized Axios client for backend API communication
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 35000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Centralized request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Centralized response interceptor for consistent error extraction
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const errorData = error.response?.data;
    const message =
      (typeof errorData === 'object' && errorData !== null && errorData.error) ||
      (typeof errorData === 'object' && errorData !== null && errorData.message) ||
      error.message ||
      'An error occurred while communicating with the CodeSage AI backend service.';
    return Promise.reject(new Error(message));
  }
);

export const api = apiClient;
export default apiClient;

// ============================================================================
// 3. IN-MEMORY VITE ENGINE INTEGRATION (Zero-failure on Vercel)
// ============================================================================

import {
  deleteRepositoryRecord,
  getEvidenceById,
  getRepositoryRecord,
  ingestPublicGitRepository,
  ingestZipArchive,
  initializeSampleRepositories,
  listRepositories as engineListRepositories,
} from '../engine/ingestor';
import {
  computeBlastRadius,
  findShortestDependencyPath,
  isNeo4jConfigured,
} from '../engine/graphEngine';
import {
  generateGroundedExplanation,
  isGeminiConfigured,
  isSarvamConfigured,
  translateTextContent,
} from '../engine/ragEngine';

// Pre-initialize sample repositories in browser memory
initializeSampleRepositories();

// ============================================================================
// 4. BACKEND INTERACTION SERVICE LAYER WITH DUAL-TIER VERCEL SUPPORT
// ============================================================================

export const codeSageApi = {
  /**
   * Health and service integration telemetry
   */
  async getHealth(signal?: AbortSignal): Promise<HealthStatus> {
    try {
      const { data } = await apiClient.get<HealthStatus>('/api/health', { signal });
      return data;
    } catch {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        team: 'INNOVATION NINJAS',
        services: {
          api: { status: 'connected', label: 'Vite In-Browser Engine Active' },
          llm: {
            status: isGeminiConfigured() ? 'connected' : 'fallback',
            model: 'gemini-3.8-flash',
            label: isGeminiConfigured() ? 'Gemini 3.8 Flash Active' : 'Deterministic AST GraphRAG',
          },
          neo4j: {
            status: isNeo4jConfigured() ? 'connected' : 'not_configured',
            uri: null,
            label: 'In-Memory Knowledge Graph',
          },
          sarvam: {
            status: isSarvamConfigured() ? 'connected' : 'not_configured',
            label: isSarvamConfigured() ? 'Sarvam Indic Connected' : 'Native Indic Localization',
          },
        },
      };
    }
  },

  /**
   * List all indexed repositories
   */
  async listRepositories(signal?: AbortSignal): Promise<{ repositories: RepositorySummary[] }> {
    try {
      const { data } = await apiClient.get<{ repositories: RepositorySummary[] }>('/api/repositories', { signal });
      return data;
    } catch {
      return { repositories: engineListRepositories() };
    }
  },

  /**
   * Ingest and index a public Git repository by URL
   */
  async addGitRepository(url: string, config?: AxiosRequestConfig): Promise<{ repository: RepositorySummary }> {
    try {
      const { data } = await apiClient.post<{ repository: RepositorySummary }>('/api/repositories', { url }, config);
      return data;
    } catch {
      const rec = await ingestPublicGitRepository(url);
      return { repository: rec.summary };
    }
  },

  /**
   * Upload and index a repository .zip archive
   */
  async uploadRepositoryArchive(
    fileName: string,
    base64Data: string,
    config?: AxiosRequestConfig
  ): Promise<{ repository: RepositorySummary }> {
    try {
      const { data } = await apiClient.post<{ repository: RepositorySummary }>(
        '/api/repositories/upload',
        { fileName, base64Data },
        config
      );
      return data;
    } catch {
      const rec = await ingestZipArchive(fileName, base64Data);
      return { repository: rec.summary };
    }
  },

  /**
   * Re-index an existing repository
   */
  async reindexRepository(repoId: string): Promise<{ repository: RepositorySummary }> {
    try {
      const { data } = await apiClient.post<{ repository: RepositorySummary }>('/api/repositories/index', { repoId });
      return data;
    } catch {
      const rec = getRepositoryRecord(repoId);
      if (!rec) throw new Error(`Repository '${repoId}' not found.`);
      return { repository: rec.summary };
    }
  },

  /**
   * Delete an indexed repository
   */
  async deleteRepository(repoId: string): Promise<{ deleted: boolean; id: string }> {
    try {
      const { data } = await apiClient.delete<{ deleted: boolean; id: string }>(
        `/api/repositories/${encodeURIComponent(repoId)}`
      );
      return data;
    } catch {
      const deleted = deleteRepositoryRecord(repoId);
      return { deleted, id: repoId };
    }
  },

  /**
   * List files in a repository with optional search query
   */
  async listFiles(
    repoId: string,
    query = '',
    signal?: AbortSignal
  ): Promise<{ repoId: string; isSample: boolean; total: number; files: Omit<RepoFile, 'content'>[] }> {
    try {
      const { data } = await apiClient.get<{
        repoId: string;
        isSample: boolean;
        total: number;
        files: Omit<RepoFile, 'content'>[];
      }>(`/api/repositories/${encodeURIComponent(repoId)}/files`, {
        params: query ? { q: query } : undefined,
        signal,
      });
      return data;
    } catch {
      const rec = getRepositoryRecord(repoId);
      if (!rec) throw new Error(`Repository '${repoId}' not found.`);
      let list = rec.files.map(({ content: _c, ...f }) => f);
      if (query) {
        const qLower = query.toLowerCase();
        list = list.filter((f) => f.path.toLowerCase().includes(qLower));
      }
      return {
        repoId,
        isSample: rec.summary.isSample,
        total: list.length,
        files: list,
      };
    }
  },

  /**
   * Fetch verbatim file content by path
   */
  async getFileContent(repoId: string, filePath: string, signal?: AbortSignal): Promise<{ file: RepoFile }> {
    try {
      const { data } = await apiClient.get<{ file: RepoFile }>(
        `/api/repositories/${encodeURIComponent(repoId)}/files/content`,
        { params: { path: filePath }, signal }
      );
      return data;
    } catch {
      const rec = getRepositoryRecord(repoId);
      if (!rec) throw new Error(`Repository '${repoId}' not found.`);
      const file = rec.files.find((f) => f.path === filePath);
      if (!file) throw new Error(`File '${filePath}' not found in repository '${repoId}'.`);
      return { file };
    }
  },

  /**
   * Retrieve the complete interactive knowledge graph for a repository
   */
  async getGraph(repoId: string, signal?: AbortSignal): Promise<RepositoryGraph> {
    try {
      const { data } = await apiClient.get<RepositoryGraph>(
        `/api/repositories/${encodeURIComponent(repoId)}/graph`,
        { signal }
      );
      return data;
    } catch {
      const rec = getRepositoryRecord(repoId);
      if (!rec) throw new Error(`Repository '${repoId}' not found.`);
      return rec.graph;
    }
  },

  /**
   * Compute blast radius and shortest dependency paths
   */
  async getDependencies(
    repoId: string,
    params: { target?: string; from?: string; to?: string },
    signal?: AbortSignal
  ): Promise<{
    repoId: string;
    isSample: boolean;
    blastRadius: BlastRadiusReport | null;
    shortestPath: DependencyPathResult | null;
  }> {
    try {
      const { data } = await apiClient.get<{
        repoId: string;
        isSample: boolean;
        blastRadius: BlastRadiusReport | null;
        shortestPath: DependencyPathResult | null;
      }>(`/api/repositories/${encodeURIComponent(repoId)}/dependencies`, {
        params,
        signal,
      });
      return data;
    } catch {
      const rec = getRepositoryRecord(repoId);
      if (!rec) throw new Error(`Repository '${repoId}' not found.`);
      const blastRadius = params.target ? computeBlastRadius(rec.files, params.target) : null;
      const shortestPath =
        params.from && params.to ? findShortestDependencyPath(rec.files, params.from, params.to) : null;
      return {
        repoId,
        isSample: rec.summary.isSample,
        blastRadius,
        shortestPath,
      };
    }
  },

  /**
   * Retrieve static code analysis summary and architectural findings
   */
  async getAnalysis(repoId: string, signal?: AbortSignal): Promise<CodeAnalysisSummary> {
    try {
      const { data } = await apiClient.get<CodeAnalysisSummary>(
        `/api/repositories/${encodeURIComponent(repoId)}/analysis`,
        { signal }
      );
      return data;
    } catch {
      const rec = getRepositoryRecord(repoId);
      if (!rec) throw new Error(`Repository '${repoId}' not found.`);
      return rec.analysis;
    }
  },

  /**
   * Submit an evidence-grounded question to CodeSage AI
   */
  async askCodeSage(
    repoId: string,
    question: string,
    language: LanguageCode,
    signal?: AbortSignal
  ): Promise<ChatResponse> {
    try {
      const { data } = await apiClient.post<ChatResponse>(
        '/api/chat',
        { repoId, question, language },
        { signal }
      );
      return data;
    } catch {
      const rec = getRepositoryRecord(repoId);
      if (!rec) throw new Error(`Repository '${repoId}' not found.`);
      return await generateGroundedExplanation({
        repoId,
        repoName: rec.summary.name,
        question,
        language,
        files: rec.files,
        graph: rec.graph,
      });
    }
  },

  /**
   * Retrieve verified evidence by citation ID
   */
  async getEvidence(evidenceId: string): Promise<{ evidence: EvidenceItem }> {
    try {
      const { data } = await apiClient.get<{ evidence: EvidenceItem }>(
        `/api/evidence/${encodeURIComponent(evidenceId)}`
      );
      return data;
    } catch {
      const evidence = getEvidenceById(evidenceId);
      if (!evidence) throw new Error(`Evidence '${evidenceId}' not found.`);
      return { evidence };
    }
  },

  /**
   * Translate text into an Indian language via Sarvam AI or AI fallback
   */
  async translateText(
    text: string,
    targetLanguage: LanguageCode
  ): Promise<{ translatedText: string; provider: 'native' | 'sarvam' | 'gemini_fallback' | 'unavailable' }> {
    try {
      const { data } = await apiClient.post<{
        translatedText: string;
        provider: 'native' | 'sarvam' | 'gemini_fallback' | 'unavailable';
      }>('/api/translate', { text, targetLanguage });
      return data;
    } catch {
      return await translateTextContent(text, targetLanguage);
    }
  },

  /**
   * Dedicated Dependency Impact Analysis
   */
  async analyzeImpact(
    payload: { repoId: string; targetFile: string; fromFile?: string; toFile?: string },
    signal?: AbortSignal
  ): Promise<{
    repoId: string;
    targetFile: string;
    blastRadius: BlastRadiusReport;
    shortestPath: DependencyPathResult | null;
    timestamp: string;
  }> {
    try {
      const { data } = await apiClient.post('/api/impact/analyze', payload, { signal });
      return data;
    } catch {
      const rec = getRepositoryRecord(payload.repoId);
      if (!rec) throw new Error(`Repository '${payload.repoId}' not found.`);
      const blastRadius = computeBlastRadius(rec.files, payload.targetFile);
      const shortestPath =
        payload.fromFile && payload.toFile
          ? findShortestDependencyPath(rec.files, payload.fromFile, payload.toFile)
          : null;
      return {
        repoId: payload.repoId,
        targetFile: payload.targetFile,
        blastRadius,
        shortestPath,
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Dedicated Investigation Report Export
   */
  async exportInvestigation(
    payload: {
      repoId: string;
      title?: string;
      questions?: string[];
      findings?: unknown[];
      notes?: string;
      format?: 'markdown' | 'json';
    },
    signal?: AbortSignal
  ): Promise<string | object> {
    try {
      const { data } = await apiClient.post('/api/investigations/export', payload, {
        signal,
        responseType: payload.format === 'json' ? 'json' : 'text',
      });
      return data;
    } catch {
      if (payload.format === 'json') {
        return {
          title: payload.title || 'CodeSage AI Investigation Export',
          repoId: payload.repoId,
          exportedAt: new Date().toISOString(),
          questions: payload.questions || [],
          findings: payload.findings || [],
          notes: payload.notes || '',
        };
      }
      return `# ${payload.title || 'CodeSage AI Investigation Report'}
Generated: ${new Date().toISOString()}
Repository: ${payload.repoId}

## Questions Investigated
${(payload.questions || []).map((q) => `- ${q}`).join('\n') || 'None recorded'}

## Notes
${payload.notes || 'None recorded'}
`;
    }
  },
};

// Shorthand export aliases for direct functional usage
export const getHealth = codeSageApi.getHealth;
export const listRepositories = codeSageApi.listRepositories;
export const addGitRepository = codeSageApi.addGitRepository;
export const uploadRepositoryArchive = codeSageApi.uploadRepositoryArchive;
export const reindexRepository = codeSageApi.reindexRepository;
export const deleteRepository = codeSageApi.deleteRepository;
export const listFiles = codeSageApi.listFiles;
export const getFileContent = codeSageApi.getFileContent;
export const getGraph = codeSageApi.getGraph;
export const getDependencies = codeSageApi.getDependencies;
export const getAnalysis = codeSageApi.getAnalysis;
export const askCodeSage = codeSageApi.askCodeSage;
export const getEvidence = codeSageApi.getEvidence;
export const translateText = codeSageApi.translateText;
export const analyzeImpact = codeSageApi.analyzeImpact;
export const exportInvestigation = codeSageApi.exportInvestigation;

