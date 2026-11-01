import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Globe,
  Loader2,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, type ChatMessage, type EvidenceItem, type LanguageCode } from '../../types';
import { useCodeSage } from '../../context/CodeSageContext';
import { codeSageApi } from '../../services/api';

interface AIConversationPanelProps {
  compact?: boolean;
}

export const AIConversationPanel: React.FC<AIConversationPanelProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const {
    activeRepo,
    conversationsByRepo,
    askingQuestion,
    askError,
    sendQuestion,
    markFeedback,
    clearConversation,
    language,
    setLanguage,
    setActiveEvidence,
    setHighlightedCitationId,
    health,
  } = useCodeSage();

  const [input, setInput] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [translatingMsgId, setTranslatingMsgId] = useState<string | null>(null);
  const [translatedOverrides, setTranslatedOverrides] = useState<
    Record<string, { lang: LanguageCode; text: string; provider: string }>
  >({});
  const lastQuestionRef = useRef<string>('');

  // Voice-to-text Speech Recognition & Waveform state
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseInputRef = useRef<string>('');

  const stopVoiceRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      try {
        audioCtxRef.current.close();
      } catch {
        // ignore
      }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const analyser = analyserRef.current;

    const bufferLength = 32;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      if (analyser) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Dynamic procedural audio waveform generator if mic stream analyser is not attached
        const t = performance.now() * 0.006;
        for (let i = 0; i < bufferLength; i++) {
          const val = Math.sin(t + i * 0.38) * Math.cos(t * 0.7 + i * 0.22);
          const val2 = Math.sin(t * 1.3 - i * 0.25);
          dataArray[i] = Math.max(35, Math.floor((Math.abs(val * 0.7 + val2 * 0.3) * 0.75 + 0.25) * 235));
        }
      }

      ctx.clearRect(0, 0, width, height);

      // 1. Draw glowing background grid line
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // 2. Draw real-time vertical frequency bars
      const barWidth = 3.5;
      const spacing = (width - bufferLength * barWidth) / (bufferLength - 1);

      for (let i = 0; i < bufferLength; i++) {
        const magnitude = dataArray[i] / 255;
        const barHeight = Math.max(4, magnitude * (height - 6));
        const x = i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#38BDF8'); // Ice cyan
        grad.addColorStop(0.5, '#22D3EE'); // Vibrant cyan
        grad.addColorStop(1, '#818CF8'); // Electric indigo

        ctx.fillStyle = grad;
        ctx.beginPath();
        const radius = barWidth / 2;
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      // 3. Draw smooth real-time continuous spline waveform across points
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#22D3EE';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < bufferLength; i++) {
        const magnitude = dataArray[i] / 255;
        const ptX = (i / (bufferLength - 1)) * width;
        const ptY = height / 2 + Math.sin(i * 0.5 + performance.now() * 0.005) * (magnitude * (height * 0.35));

        if (i === 0) {
          ctx.moveTo(ptX, ptY);
        } else {
          const prevMagnitude = dataArray[i - 1] / 255;
          const prevPtX = ((i - 1) / (bufferLength - 1)) * width;
          const prevPtY = height / 2 + Math.sin((i - 1) * 0.5 + performance.now() * 0.005) * (prevMagnitude * (height * 0.35));
          const cpX = (prevPtX + ptX) / 2;
          ctx.quadraticCurveTo(prevPtX, prevPtY, cpX, (prevPtY + ptY) / 2);
        }
      }
      ctx.stroke();
      ctx.restore();
    };

    render();
  }, []);

  useEffect(() => {
    if (isListening) {
      const id = requestAnimationFrame(drawWaveform);
      return () => {
        cancelAnimationFrame(id);
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
      };
    }
  }, [isListening, drawWaveform]);

  useEffect(() => {
    return () => {
      stopVoiceRecording();
    };
  }, [stopVoiceRecording]);

  const startVoiceRecording = useCallback(async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    stopVoiceRecording();
    setSpeechError(null);
    baseInputRef.current = input ? input.trim() + ' ' : '';

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === language);
      recognition.lang = langObj?.sarvamCode || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interim = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }

        setInterimTranscript(interim);
        if (finalTranscript) {
          baseInputRef.current = (baseInputRef.current + ' ' + finalTranscript).trim() + ' ';
          setInput(baseInputRef.current.trim());
        } else if (interim) {
          setInput((baseInputRef.current + interim).trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access was denied. Please allow microphone permissions.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice error: ${event.error}`);
        }
        stopVoiceRecording();
      };

      recognition.onend = () => {
        stopVoiceRecording();
      };

      recognitionRef.current = recognition;
      recognition.start();

      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = stream;
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            audioCtxRef.current = audioCtx;
            analyserRef.current = analyser;
          }
        }
      } catch {
        // Fallback to synthetic procedural waveform smoothly
      }
    } catch (err: any) {
      setSpeechError(err.message || 'Unable to start speech recognition');
      stopVoiceRecording();
    }
  }, [drawWaveform, input, language, stopVoiceRecording]);

  const toggleVoiceRecording = () => {
    if (isListening) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  const messages: ChatMessage[] = activeRepo ? conversationsByRepo[activeRepo.id] || [] : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || askingQuestion) return;
    const q = input.trim();
    lastQuestionRef.current = q;
    setInput('');
    await sendQuestion(q);
  };

  const handleSuggestedClick = async (q: string) => {
    if (askingQuestion) return;
    lastQuestionRef.current = q;
    await sendQuestion(q);
  };

  const handleCitationSelect = (ev: EvidenceItem, allEvidence: EvidenceItem[]) => {
    setActiveEvidence(allEvidence);
    setHighlightedCitationId(ev.id);
  };

  const handleCopyMessage = async (msg: ChatMessage) => {
    const struct = msg.structured;
    const body = struct
      ? `# ${struct.question}\n\n${struct.summary}\n\n${struct.reasoning_sections
          .map((s) => `## ${s.heading}\n${s.body}`)
          .join('\n\n')}\n\n## Verified Citations\n${struct.evidence
          .map((e, i) => `[${i + 1}] ${e.filePath}:L${e.startLine}-L${e.endLine} — ${e.relevance}`)
          .join('\n')}`
      : msg.content;
    try {
      await navigator.clipboard.writeText(body);
      setCopiedMsgId(msg.id);
      setTimeout(() => setCopiedMsgId(null), 1800);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleExportReport = (msg: ChatMessage) => {
    const struct = msg.structured;
    if (!struct) return;
    const report = `# CodeSage AI — Evidence-Backed Codebase Report
Repository: ${activeRepo?.fullName || struct.repoId}
Generated: ${struct.createdAt}
Question: ${struct.question}
Confidence Estimate: ${Math.round(struct.confidence * 100)}% (${struct.evidence_coverage} coverage)

## Executive Summary
${struct.summary}

## Detailed Overview
${struct.answer}

## Grounded Reasoning Sections
${struct.reasoning_sections
  .map((s) => `### ${s.heading}\n${s.body}`)
  .join('\n\n')}

## Verified Source Citations
${struct.evidence
  .map(
    (e, idx) =>
      `### [${idx + 1}] ${e.filePath} (Lines ${e.startLine}–${e.endLine})\nRelevance: ${e.relevance}\n\`\`\`${e.language.toLowerCase()}\n${e.excerpt}\n\`\`\``
  )
  .join('\n\n')}

## Known Limitations
${struct.limitations.map((l) => `- ${l}`).join('\n')}
`;
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codesage-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTranslateMessage = async (msg: ChatMessage, targetLang: LanguageCode) => {
    if (targetLang === 'en') {
      setTranslatedOverrides((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }

    const struct = msg.structured;
    const sourceText = struct
      ? `${struct.summary}\n\n${struct.reasoning_sections
          .map((s) => `### ${s.heading}\n${s.body}`)
          .join('\n\n')}`
      : msg.content;

    setTranslatingMsgId(msg.id);
    try {
      const res = await codeSageApi.translateText(sourceText, targetLang);
      setTranslatedOverrides((prev) => ({
        ...prev,
        [msg.id]: {
          lang: targetLang,
          text: res.translatedText,
          provider:
            res.provider === 'sarvam'
              ? 'Sarvam AI'
              : res.provider === 'gemini_fallback'
              ? 'AI Translation Fallback'
              : 'Original',
        },
      }));
    } catch {
      // Keep original text on failure
    } finally {
      setTranslatingMsgId(null);
    }
  };

  const defaultPrompts = activeRepo?.suggestedQuestions?.length
    ? activeRepo.suggestedQuestions
    : [
        'Explain this architecture.',
        'Show dependencies of core modules.',
        'Find related files and API routes.',
        'What could break if a central module changes?',
      ];

  return (
    <section className="rounded-xl border border-slate-800/80 bg-[#071A35] flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/80">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white tracking-tight truncate">
            Ask CodeSage — Evidence-First Reasoning
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            Answers cite exact discovered files and line ranges ·{' '}
            {health?.services.sarvam.status === 'connected'
              ? 'Sarvam Multilingual Active'
              : 'Multilingual Ready (AI Fallback)'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#020817] border border-slate-800 text-xs text-slate-200">
            <Globe className="w-3.5 h-3.5 text-cyan-300" />
            <label htmlFor="chat-lang-select" className="sr-only">
              Explanation Language
            </label>
            <select
              id="chat-lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-xs text-slate-100 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#041126] text-slate-100">
                  {l.label} ({l.nativeLabel})
                </option>
              ))}
            </select>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A2042] transition-colors cursor-pointer"
              title="Clear conversation history"
              aria-label="Clear conversation history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Stream */}
      <div
        className={`p-4 space-y-5 overflow-y-auto ${
          compact ? 'max-h-[620px]' : 'min-h-[460px] max-h-[680px]'
        }`}
      >
        {messages.length === 0 && !askingQuestion ? (
          <div className="py-10 text-center max-w-lg mx-auto">
            <h3 className="text-base font-semibold text-white">
              Ask why {activeRepo?.name || 'this repository'} is designed the way it is
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              CodeSage traverses the AST knowledge graph, retrieves matching source lines, configuration, and documentation, and verifies every citation before responding.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {defaultPrompts.slice(0, 4).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleSuggestedClick(q)}
                  className="px-3 py-1.5 rounded-lg bg-[#0A2042] hover:bg-[#2563FF]/25 border border-slate-700/70 text-xs text-slate-200 transition-colors text-left cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl bg-[#2563FF] px-4 py-2.5 text-sm text-white">
                    {msg.content}
                  </div>
                </div>
              );
            }

            const struct = msg.structured;
            const trOverride = translatedOverrides[msg.id];

            return (
              <article
                key={msg.id}
                className="rounded-xl border border-slate-800/90 bg-[#020817] p-4 space-y-4"
              >
                {/* Metadata Header (clean unboxed text with separators) */}
                {struct && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 text-xs text-slate-400 tabular-nums">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-cyan-300 font-medium">
                        {struct.evidence.length} Verified Citations
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Confidence Estimate: {Math.round(struct.confidence * 100)}%
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{struct.evidence_coverage} Coverage</span>
                      {trOverride && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-violet-300">
                            Translated ({trOverride.provider})
                          </span>
                        </>
                      )}
                    </div>

                    {/* Per-message Indian Language Quick Translate */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Translate:</span>
                      {(['en', 'ta', 'hi', 'te', 'ml'] as LanguageCode[]).map((lc) => {
                        const lObj = SUPPORTED_LANGUAGES.find((x) => x.code === lc)!;
                        const isActiveLang = (trOverride?.lang || struct.language) === lc;
                        return (
                          <button
                            key={lc}
                            type="button"
                            disabled={translatingMsgId === msg.id}
                            onClick={() => handleTranslateMessage(msg, lc)}
                            className={`px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                              isActiveLang
                                ? 'bg-[#2563FF] text-white font-medium'
                                : 'text-slate-400 hover:text-white hover:bg-[#0A2042]'
                            }`}
                          >
                            {lObj.nativeLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {translatingMsgId === msg.id ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-cyan-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Translating explanation while preserving code identifiers and citations...</span>
                  </div>
                ) : trOverride ? (
                  <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{trOverride.text}</ReactMarkdown>
                  </div>
                ) : struct ? (
                  <>
                    {/* Executive Summary */}
                    <p className="text-sm font-medium text-slate-100 leading-relaxed">
                      {struct.summary}
                    </p>

                    {/* Markdown Overview */}
                    <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{struct.answer}</ReactMarkdown>
                    </div>

                    {/* Numbered Reasoning Sections */}
                    {struct.reasoning_sections.length > 0 && (
                      <div className="space-y-3 pt-1">
                        {struct.reasoning_sections.map((sec) => (
                          <div
                            key={sec.stepNumber}
                            className="rounded-lg border border-slate-800/80 bg-[#041126] p-3.5"
                          >
                            <h4 className="text-xs sm:text-sm font-semibold text-white">
                              {sec.heading}
                            </h4>
                            <div className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{sec.body}</ReactMarkdown>
                            </div>

                            {sec.citationIds.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                {sec.citationIds.map((cid) => {
                                  const evIdx = struct.evidence.findIndex((e) => e.id === cid);
                                  const ev = struct.evidence[evIdx];
                                  if (!ev) return null;
                                  return (
                                    <button
                                      key={cid}
                                      type="button"
                                      onClick={() => handleCitationSelect(ev, struct.evidence)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0A2042] hover:bg-[#2563FF]/30 border border-slate-700/80 font-mono text-[11px] text-cyan-300 transition-colors cursor-pointer"
                                    >
                                      <span>
                                        [{evIdx + 1}] {ev.filePath.split('/').pop()}:L{ev.startLine}–L
                                        {ev.endLine}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Clickable Source Citations Summary Strip */}
                    {struct.evidence.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="text-[11px] text-slate-400 mb-2">
                          Click any citation to inspect source lines or open in Repository Explorer:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {struct.evidence.map((ev, idx) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => {
                                handleCitationSelect(ev, struct.evidence);
                              }}
                              onDoubleClick={() =>
                                navigate(
                                  `/explorer?file=${encodeURIComponent(ev.filePath)}&start=${
                                    ev.startLine
                                  }&end=${ev.endLine}`
                                )
                              }
                              className="px-2.5 py-1 rounded-md bg-[#071A35] hover:bg-[#2563FF]/25 border border-slate-800 font-mono text-[11px] text-slate-200 hover:text-cyan-200 transition-colors cursor-pointer"
                              title={`${ev.filePath} (Lines ${ev.startLine}–${ev.endLine})`}
                            >
                              [{idx + 1}] {ev.filePath}:L{ev.startLine}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Limitations / Honest Uncertainty Disclosure */}
                    {struct.limitations.length > 0 && (
                      <div className="rounded-lg bg-amber-950/20 border border-amber-800/40 px-3 py-2 text-xs text-amber-200/90 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-amber-300">Verification Scope: </span>
                          {struct.limitations.join(' ')}
                        </div>
                      </div>
                    )}

                    {/* Follow-up Suggestions */}
                    {struct.follow_up_suggestions.length > 0 && (
                      <div className="pt-1">
                        <div className="text-[11px] text-slate-400 mb-1.5">Suggested follow-ups:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {struct.follow_up_suggestions.map((fq) => (
                            <button
                              key={fq}
                              type="button"
                              onClick={() => handleSuggestedClick(fq)}
                              className="px-2.5 py-1 rounded-md bg-[#0A2042]/80 hover:bg-[#2563FF]/30 text-xs text-slate-300 hover:text-white transition-colors text-left cursor-pointer"
                            >
                              {fq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-slate-200">{msg.content}</p>
                )}

                {/* Action Footer: Copy, Export Report, Feedback */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-[#0A2042] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedMsgId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy Answer'}</span>
                    </button>

                    {struct && (
                      <button
                        type="button"
                        onClick={() => handleExportReport(msg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-white hover:bg-[#0A2042] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Report</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => markFeedback(msg.id, 'helpful')}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        msg.feedback === 'helpful'
                          ? 'text-emerald-400 bg-emerald-950/50'
                          : 'text-slate-500 hover:text-slate-200'
                      }`}
                      aria-label="Mark explanation helpful"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => markFeedback(msg.id, 'unhelpful')}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        msg.feedback === 'unhelpful'
                          ? 'text-rose-400 bg-rose-950/50'
                          : 'text-slate-500 hover:text-slate-200'
                      }`}
                      aria-label="Mark explanation unhelpful"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}

        {/* Loading Skeleton */}
        {askingQuestion && (
          <div className="rounded-xl border border-slate-800 bg-[#020817] p-4 space-y-3 animate-pulse">
            <div className="flex items-center gap-2 text-xs text-cyan-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Traversing Knowledge Graph & verifying source citations...</span>
            </div>
            <div className="h-3 bg-slate-800 rounded w-3/4" />
            <div className="h-3 bg-slate-800 rounded w-full" />
            <div className="h-16 bg-slate-900 rounded w-full" />
          </div>
        )}

        {/* Error & Retry State */}
        {askError && (
          <div className="rounded-xl border border-rose-800/70 bg-rose-950/30 p-3.5 flex items-center justify-between gap-3">
            <div className="text-xs text-rose-200">{askError}</div>
            {lastQuestionRef.current && (
              <button
                type="button"
                onClick={() => sendQuestion(lastQuestionRef.current)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-xs font-medium text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quick Prompt Chips + Input Form */}
      <div className="p-3.5 border-t border-slate-800/80 bg-[#041126] space-y-2.5">
        {/* Active Voice Recording Status & Audio Waveform Banner */}
        {isListening && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#03152E]/90 border border-cyan-500/50 shadow-[0_0_25px_rgba(34,211,238,0.2)]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <span>Listening for speech...</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/70 text-cyan-400 font-mono">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.label || 'English'} (
                    {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.sarvamCode || 'en-US'})
                  </span>
                </div>
                {interimTranscript && (
                  <p className="text-[11px] text-slate-200 italic truncate max-w-[220px] sm:max-w-[360px]">
                    "{interimTranscript}"
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 ml-auto">
              {/* Visual Audio Waveform Animation Canvas */}
              <canvas
                ref={canvasRef}
                width={240}
                height={32}
                aria-label="Real-time audio waveform visualizer"
                className="h-8 w-36 sm:w-56 rounded-lg bg-[#010816]/90 border border-cyan-500/40 shadow-inner"
              />
              <button
                type="button"
                onClick={stopVoiceRecording}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/70 text-xs font-medium text-rose-200 hover:text-white transition-colors cursor-pointer"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        )}

        {/* Speech Error Banner */}
        {speechError && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
            <div className="flex items-center gap-1.5 truncate">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">{speechError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSpeechError(null)}
              className="text-rose-400 hover:text-white text-xs cursor-pointer px-1 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {[
            'Why is this authentication used?',
            'Show dependencies of core modules',
            'Explain this architecture',
            'What could break if a hub file changes?',
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={askingQuestion}
              onClick={() => handleSuggestedClick(chip)}
              className="px-2.5 py-1 rounded-md bg-[#071A35] hover:bg-[#0A2042] border border-slate-800 text-[11px] text-slate-300 hover:text-cyan-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={askingQuestion}
            placeholder={`Ask about ${activeRepo?.name || 'repository'} architecture, symbols, or trade-offs...`}
            aria-label="Ask CodeSage a codebase question"
            className="flex-1 px-3.5 py-2.5 rounded-lg bg-[#020817] border border-slate-700/80 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#2563FF]"
          />

          {/* Voice Recording button */}
          <button
            type="button"
            onClick={toggleVoiceRecording}
            disabled={askingQuestion}
            title={isListening ? 'Stop recording voice' : 'Voice Recording: Capture audio & transcribe with Web Speech API'}
            aria-label={isListening ? 'Stop voice recording' : 'Voice Recording'}
            className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg transition-all border cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-600/30 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
                : 'bg-[#071A35] hover:bg-[#0A2042] border-slate-700 text-slate-300 hover:text-cyan-300'
            }`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-rose-400" />
            ) : (
              <Mic className="w-4 h-4 text-cyan-400" />
            )}
            <span className="text-xs font-medium hidden sm:inline">
              {isListening ? 'Recording...' : 'Voice Recording'}
            </span>
            {isListening && (
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </button>

          <button
            type="submit"
            disabled={askingQuestion || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] disabled:opacity-50 text-xs sm:text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {askingQuestion ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>Ask</span>
          </button>
        </form>
      </div>
    </section>
  );
};
