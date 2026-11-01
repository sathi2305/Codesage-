export type IndexingStage =
  | 'queued'
  | 'validating'
  | 'cloning'
  | 'parsing'
  | 'graphing'
  | 'ready'
  | 'error';

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

export type LanguageCode = 'en' | 'ta' | 'hi' | 'te' | 'ml' | 'kn' | 'bn';

export interface SupportedLanguage {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  sarvamCode: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', sarvamCode: 'en-IN' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்', sarvamCode: 'ta-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', sarvamCode: 'hi-IN' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', sarvamCode: 'te-IN' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', sarvamCode: 'ml-IN' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ', sarvamCode: 'kn-IN' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', sarvamCode: 'bn-IN' },
];

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
  certainty: RelationshipCertainty;
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
