import { GoogleGenAI, Type } from '@google/genai';
import type {
  ChatResponse,
  EvidenceItem,
  LanguageCode,
  ReasoningSection,
  RepoFile,
  RepositoryGraph,
} from '../types/index.ts';
import { SUPPORTED_LANGUAGES } from '../types/index.ts';
import { saveEvidenceItems } from './ingestor.ts';

function getGeminiKey(): string | undefined {
  if (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  try {
    return (import.meta as any).env?.VITE_GEMINI_API_KEY;
  } catch {
    return undefined;
  }
}

function getGeminiClient(): GoogleGenAI | null {
  const key = getGeminiKey();
  if (!key || key === 'MY_GEMINI_API_KEY' || key.trim().length < 8) {
    return null;
  }
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return getGeminiClient() !== null;
}

export function isSarvamConfigured(): boolean {
  const key = typeof process !== 'undefined' ? process.env?.SARVAM_API_KEY : undefined;
  return Boolean(key && key.trim().length > 8);
}

interface CandidateSnippet {
  evidenceId: string;
  file: RepoFile;
  startLine: number;
  endLine: number;
  excerpt: string;
  score: number;
  reason: string;
  certainty: 'observed' | 'inferred';
}

function tokenizeQuery(question: string): string[] {
  const stopWords = new Set([
    'why',
    'does',
    'this',
    'project',
    'use',
    'instead',
    'the',
    'and',
    'for',
    'how',
    'what',
    'could',
    'break',
    'changes',
    'change',
    'explain',
    'show',
    'with',
    'from',
    'that',
    'are',
    'used',
    'file',
    'module',
    'code',
    'codebase',
    'repo',
    'repository',
  ]);

  return question
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

function extractLines(content: string, startLine: number, endLine: number): string {
  const lines = content.split(/\r?\n/);
  const s = Math.max(1, Math.min(lines.length, startLine));
  const e = Math.max(s, Math.min(lines.length, endLine));
  return lines.slice(s - 1, e).join('\n');
}

export function retrieveGraphRagEvidence(
  repoId: string,
  question: string,
  files: RepoFile[],
  graph: RepositoryGraph
): {
  snippets: CandidateSnippet[];
  relatedFiles: string[];
  relatedSymbols: string[];
} {
  const tokens = tokenizeQuery(question);
  const fileScores = new Map<string, { score: number; reasons: string[] }>();

  for (const file of files) {
    let score = 0;
    const reasons: string[] = [];
    const lowerPath = file.path.toLowerCase();
    const lowerContent = file.content.toLowerCase();

    // Direct filename or full path mention
    if (question.toLowerCase().includes(lowerPath) || question.toLowerCase().includes(file.name.toLowerCase())) {
      score += 45;
      reasons.push(`Directly referenced in developer query (${file.path})`);
    }

    for (const tok of tokens) {
      if (lowerPath.includes(tok)) {
        score += 14;
        reasons.push(`File path matches concept '${tok}'`);
      }
      for (const sym of file.symbols) {
        if (sym.name.toLowerCase().includes(tok)) {
          score += 12;
          reasons.push(`Defines symbol '${sym.name}' matching '${tok}'`);
        }
      }
      if (lowerContent.includes(tok)) {
        score += 5;
      }
    }

    // Boost ADR / architectural documentation when asking "Why" or "architecture"
    if (/why|instead|architecture|design|trade-?off|decision/i.test(question) && file.fileType === 'docs') {
      score += 16;
      reasons.push('Architectural Decision Record / documentation context');
    }

    if (/config|env|setting|expire|ttl|secret/i.test(question) && file.fileType === 'config') {
      score += 12;
      reasons.push('Runtime configuration definition');
    }

    if (/test|verify|break/i.test(question) && file.fileType === 'test') {
      score += 10;
      reasons.push('Verification test coverage reference');
    }

    if (score > 0) {
      fileScores.set(file.path, { score, reasons });
    }
  }

  // Fallback if query is broad (e.g. "Explain this architecture"): pick highest-degree graph hubs + docs
  if (fileScores.size === 0) {
    for (const file of files) {
      const node = graph.nodes.find((n) => n.id === `file:${file.path}`);
      const deg = (node?.data.inDegree || 0) + (node?.data.outDegree || 0);
      fileScores.set(file.path, {
        score: deg + (file.fileType === 'docs' ? 15 : 2),
        reasons: ['Core architectural hub discovered via Knowledge Graph centrality'],
      });
    }
  }

  // Graph traversal: boost 1-hop neighbors of top 3 matching files
  const initialTop = Array.from(fileScores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3)
    .map(([p]) => p);

  for (const topPath of initialTop) {
    const topNodeId = `file:${topPath}`;
    for (const edge of graph.edges) {
      if (edge.source === topNodeId && edge.target.startsWith('file:')) {
        const neighborPath = edge.target.replace(/^file:/, '');
        const curr = fileScores.get(neighborPath) || { score: 0, reasons: [] };
        curr.score += 9;
        curr.reasons.push(`Connected via ${edge.label} from ${topPath}`);
        fileScores.set(neighborPath, curr);
      } else if (edge.target === topNodeId && edge.source.startsWith('file:')) {
        const neighborPath = edge.source.replace(/^file:/, '');
        const curr = fileScores.get(neighborPath) || { score: 0, reasons: [] };
        curr.score += 9;
        curr.reasons.push(`Depends on ${topPath} via ${edge.label}`);
        fileScores.set(neighborPath, curr);
      }
    }
  }

  const rankedPaths = Array.from(fileScores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 6);

  const snippets: CandidateSnippet[] = [];
  const relatedSymbolsSet = new Set<string>();

  rankedPaths.forEach(([filePath, meta], idx) => {
    const file = files.find((f) => f.path === filePath);
    if (!file) return;

    // Pick best matching symbol range or relevant matching lines
    let startLine = 1;
    let endLine = Math.min(file.lineCount, 28);
    let matchedSym = file.symbols.find((s) =>
      tokens.some((t) => s.name.toLowerCase().includes(t) || s.signature.toLowerCase().includes(t))
    );

    if (!matchedSym && file.symbols.length > 0) {
      matchedSym = file.symbols[0];
    }

    if (matchedSym) {
      startLine = Math.max(1, matchedSym.startLine - 1);
      endLine = Math.min(file.lineCount, Math.max(matchedSym.endLine, matchedSym.startLine + 16));
      relatedSymbolsSet.add(matchedSym.name);
    } else {
      // Find first line matching any token
      const rawLines = file.content.split(/\r?\n/);
      const hitIdx = rawLines.findIndex((ln) => tokens.some((t) => ln.toLowerCase().includes(t)));
      if (hitIdx >= 0) {
        startLine = Math.max(1, hitIdx - 2);
        endLine = Math.min(file.lineCount, hitIdx + 18);
      }
    }

    for (const s of file.symbols.slice(0, 3)) {
      relatedSymbolsSet.add(s.name);
    }

    snippets.push({
      evidenceId: `evid-${repoId.slice(-6)}-${Date.now().toString(36)}-${idx + 1}`,
      file,
      startLine,
      endLine,
      excerpt: extractLines(file.content, startLine, endLine),
      score: meta.score,
      reason: meta.reasons[0] || `Retrieved via GraphRAG from ${file.path}`,
      certainty: 'observed',
    });
  });

  return {
    snippets,
    relatedFiles: rankedPaths.map(([p]) => p),
    relatedSymbols: Array.from(relatedSymbolsSet).slice(0, 10),
  };
}

export async function translateTextContent(
  text: string,
  targetLanguage: LanguageCode
): Promise<{ translatedText: string; provider: 'native' | 'sarvam' | 'gemini_fallback' | 'unavailable' }> {
  if (targetLanguage === 'en' || !text.trim()) {
    return { translatedText: text, provider: 'native' };
  }

  const langSpec = SUPPORTED_LANGUAGES.find((l) => l.code === targetLanguage);
  if (!langSpec) {
    return { translatedText: text, provider: 'unavailable' };
  }

  // 1. Try Sarvam AI API when SARVAM_API_KEY is configured
  if (isSarvamConfigured()) {
    try {
      const resp = await fetch('https://api.sarvam.ai/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': (typeof process !== 'undefined' && process.env?.SARVAM_API_KEY ? process.env.SARVAM_API_KEY : '').trim(),
        },
        body: JSON.stringify({
          input: text.slice(0, 1800),
          source_language_code: 'en-IN',
          target_language_code: langSpec.sarvamCode,
          speaker_gender: 'Male',
          mode: 'formal',
          enable_preprocessing: true,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { translated_text?: string };
        if (data.translated_text) {
          return { translatedText: data.translated_text, provider: 'sarvam' };
        }
      }
    } catch {
      // Fall through to Gemini fallback
    }
  }

  // 2. Server-side Gemini neural translation preserving technical identifiers & citations
  const ai = getGeminiClient();
  if (ai) {
    try {
      const resp = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Translate the following software engineering explanation into ${langSpec.label} (${langSpec.nativeLabel}).
CRITICAL RULES:
- Preserve ALL file paths (e.g. backend/app/auth/jwt_handler.py), function/class identifiers, backtick code spans, and citation IDs EXACTLY in English ASCII.
- Translate only natural-language prose headings and sentences accurately and naturally for an Indian software developer.
- Return ONLY the translated text without extra commentary.

TEXT TO TRANSLATE:
${text}`,
      });
      if (resp.text && resp.text.trim()) {
        return { translatedText: resp.text.trim(), provider: 'gemini_fallback' };
      }
    } catch {
      // Fall through
    }
  }

  return { translatedText: text, provider: 'unavailable' };
}

export async function generateGroundedExplanation(params: {
  repoId: string;
  repoName: string;
  question: string;
  language: LanguageCode;
  files: RepoFile[];
  graph: RepositoryGraph;
}): Promise<ChatResponse> {
  const { repoId, repoName, question, language, files, graph } = params;
  const retrieved = retrieveGraphRagEvidence(repoId, question, files, graph);

  const verifiedEvidencePool: EvidenceItem[] = retrieved.snippets.map((s) => ({
    id: s.evidenceId,
    repoId,
    filePath: s.file.path,
    fileType: s.file.fileType,
    language: s.file.language,
    startLine: s.startLine,
    endLine: s.endLine,
    excerpt: s.excerpt,
    relevance: s.reason,
    certainty: s.certainty,
    verified: true,
  }));

  saveEvidenceItems(verifiedEvidencePool);

  const contextBlocks = verifiedEvidencePool
    .map(
      (ev, i) =>
        `[CITATION_ID: ${ev.id}] (Index #${i + 1})
File: ${ev.filePath} (Lines ${ev.startLine}-${ev.endLine}, Type: ${ev.fileType})
Graph Discovery Reason: ${ev.relevance}
Verbatim Source Excerpt:
\`\`\`${ev.language.toLowerCase()}
${ev.excerpt}
\`\`\``
    )
    .join('\n\n---\n\n');

  const graphEdgesSummary = graph.edges
    .filter((e) =>
      verifiedEvidencePool.some(
        (ev) => e.source === `file:${ev.filePath}` || e.target === `file:${ev.filePath}`
      )
    )
    .slice(0, 18)
    .map((e) => `${e.source} -[${e.label} (${e.certainty})]-> ${e.target}`)
    .join('\n');

  const langSpec = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  const ai = getGeminiClient();

  if (ai && verifiedEvidencePool.length > 0) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Developer Question about repository "${repoName}":
"${question}"

Retrieved Verifiable Repository Evidence:
${contextBlocks}

Extracted Knowledge Graph Relationships:
${graphEdgesSummary || 'No cross-file edges between retrieved snippets.'}

Target Explanation Language: ${langSpec.label} (${langSpec.nativeLabel})`,
        config: {
          systemInstruction: `You are CodeSage AI, an evidence-first codebase intelligence architect.
STRICT VERIFICATION RULES:
1. Ground EVERY architectural claim strictly in the provided [CITATION_ID: ...] blocks and Graph Relationships.
2. NEVER invent file paths, line numbers, libraries, or design motives not supported by the retrieved context.
3. If the repository does NOT contain evidence answering part of the question, state that explicitly in 'limitations' and set 'evidence_coverage' to 'partial' or 'insufficient'.
4. Reference exact CITATION_ID values in 'citationIds' for each reasoning section.
5. If Target Explanation Language is not English, write 'summary', 'answer', section 'heading' and 'body', 'limitations', and 'follow_up_suggestions' in ${langSpec.label} (${langSpec.nativeLabel}), while keeping ALL file paths, code symbols, and backtick identifiers in original English.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'Concise 2-sentence executive summary grounded in the repository evidence.',
              },
              answer: {
                type: Type.STRING,
                description: 'Detailed markdown overview integrating key findings and code identifiers.',
              },
              reasoning_sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    heading: { type: Type.STRING },
                    body: { type: Type.STRING },
                    citationIds: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['stepNumber', 'heading', 'body', 'citationIds'],
                },
              },
              evidence_relevance_overrides: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    citationId: { type: Type.STRING },
                    relevance: { type: Type.STRING },
                  },
                  required: ['citationId', 'relevance'],
                },
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Estimated evidence confidence between 0.15 and 0.96.',
              },
              evidence_coverage: {
                type: Type.STRING,
                description: 'One of: high, partial, insufficient',
              },
              limitations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              follow_up_suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'summary',
              'answer',
              'reasoning_sections',
              'confidence',
              'evidence_coverage',
              'limitations',
              'follow_up_suggestions',
            ],
          },
        },
      });

      const rawText = response.text;
      if (rawText) {
        const parsed = JSON.parse(rawText) as {
          summary: string;
          answer: string;
          reasoning_sections: ReasoningSection[];
          evidence_relevance_overrides?: { citationId: string; relevance: string }[];
          confidence: number;
          evidence_coverage: string;
          limitations: string[];
          follow_up_suggestions: string[];
        };

        // Strict Evidence Verifier: filter citationIds to ONLY genuine retrieved IDs
        const validIds = new Set(verifiedEvidencePool.map((e) => e.id));
        const relevanceMap = new Map(
          (parsed.evidence_relevance_overrides || []).map((o) => [o.citationId, o.relevance])
        );

        const finalEvidence = verifiedEvidencePool.map((ev) => ({
          ...ev,
          relevance: relevanceMap.get(ev.id) || ev.relevance,
          verified: true,
        }));
        saveEvidenceItems(finalEvidence);

        const sanitizedSections: ReasoningSection[] = (parsed.reasoning_sections || []).map(
          (sec, i) => ({
            stepNumber: i + 1,
            heading: sec.heading,
            body: sec.body,
            citationIds: (sec.citationIds || []).filter((cid) => validIds.has(cid)),
          })
        );

        const cov =
          parsed.evidence_coverage === 'high' ||
          parsed.evidence_coverage === 'partial' ||
          parsed.evidence_coverage === 'insufficient'
            ? parsed.evidence_coverage
            : 'partial';

        return {
          id: `ans-${Date.now().toString(36)}`,
          repoId,
          question,
          language,
          translationProvider:
            language === 'en' ? 'native' : isSarvamConfigured() ? 'sarvam' : 'gemini_fallback',
          answer: parsed.answer,
          summary: parsed.summary,
          reasoning_sections: sanitizedSections,
          evidence: finalEvidence,
          related_files: retrieved.relatedFiles,
          related_symbols: retrieved.relatedSymbols,
          confidence: Math.max(0.1, Math.min(0.98, Number(parsed.confidence) || 0.84)),
          evidence_coverage: cov,
          limitations:
            parsed.limitations && parsed.limitations.length > 0
              ? parsed.limitations
              : ['Static analysis reflects indexed repository source files without runtime execution traces.'],
          follow_up_suggestions: (parsed.follow_up_suggestions || []).slice(0, 4),
          engineMode: 'gemini_graphrag',
          createdAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.error('Gemini GraphRAG fallback triggered:', err instanceof Error ? err.message : err);
    }
  }

  // Honest Deterministic GraphRAG Fallback grounded strictly in retrieved AST & files
  const sections: ReasoningSection[] = verifiedEvidencePool.slice(0, 4).map((ev, idx) => ({
    stepNumber: idx + 1,
    heading: `Evidence in ${ev.filePath} (Lines ${ev.startLine}–${ev.endLine})`,
    body: `${ev.relevance}. Statically extracted from \`${ev.filePath}\` (${ev.language}, ${ev.fileType}).`,
    citationIds: [ev.id],
  }));

  let summaryText =
    verifiedEvidencePool.length > 0
      ? `Retrieved ${verifiedEvidencePool.length} verified source evidence blocks across ${retrieved.relatedFiles.length} repository files (${retrieved.relatedFiles.slice(0, 3).join(', ')}) matching your question.`
      : `Insufficient matching source evidence found in indexed files for "${question}". Inspect the Repository Explorer to verify available modules.`;

  let answerMarkdown =
    verifiedEvidencePool.length > 0
      ? `Based on static AST analysis and Knowledge Graph traversal of **${repoName}**, the implementation spans **${retrieved.relatedFiles.length} connected modules**:\n\n` +
        verifiedEvidencePool
          .slice(0, 4)
          .map(
            (ev, i) =>
              `${i + 1}. **\`${ev.filePath}\` (L${ev.startLine}–L${ev.endLine})** — ${ev.relevance}.`
          )
          .join('\n')
      : `No verifiable code excerpts matched your query in **${repoName}**.`;

  let translationProvider: ChatResponse['translationProvider'] = 'native';
  if (language !== 'en') {
    const tr = await translateTextContent(summaryText, language);
    summaryText = tr.translatedText;
    translationProvider = tr.provider;
  }

  return {
    id: `ans-${Date.now().toString(36)}`,
    repoId,
    question,
    language,
    translationProvider,
    answer: answerMarkdown,
    summary: summaryText,
    reasoning_sections: sections,
    evidence: verifiedEvidencePool,
    related_files: retrieved.relatedFiles,
    related_symbols: retrieved.relatedSymbols,
    confidence: verifiedEvidencePool.length >= 3 ? 0.78 : 0.45,
    evidence_coverage:
      verifiedEvidencePool.length >= 3
        ? 'high'
        : verifiedEvidencePool.length > 0
        ? 'partial'
        : 'insufficient',
    limitations: [
      'Synthesized via deterministic GraphRAG static AST analyzer (configure LLM credentials for deeper narrative reasoning).',
      'Relationships marked as inferred rely on cross-module symbol matching rather than runtime trace execution.',
    ],
    follow_up_suggestions: [
      retrieved.relatedFiles[0]
        ? `What could break if ${retrieved.relatedFiles[0]} changes?`
        : 'Which files have the highest dependency coupling?',
      'Show the dependency chain between route handlers and core services.',
      'Which test suites cover these modules?',
    ],
    engineMode: 'deterministic_graphrag',
    createdAt: new Date().toISOString(),
  };
}
