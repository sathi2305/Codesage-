import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react';
import { useCodeSage } from '../../context/CodeSageContext';

interface VoiceAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceAIAssistantModal: React.FC<VoiceAIAssistantModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { activeRepo, sendQuestion, askingQuestion, language } = useCodeSage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const recognitionRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      // Map app language to recognition language tag
      if (language === 'hi') recognition.lang = 'hi-IN';
      else if (language === 'ta') recognition.lang = 'ta-IN';
      else recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setErrorMsg(`Voice recognition note: ${event.error}. You can also type or click sample queries.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setErrorMsg('Web Speech API is not natively supported in this browser. You can click sample voice prompts below.');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [language]);

  // Animated Audio Waveform Canvas Loop
  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const barCount = 36;

    const renderWave = () => {
      time += 0.08;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / barCount;

      for (let i = 0; i < barCount; i++) {
        let amplitude = 0.15;
        if (isListening) {
          amplitude = 0.35 + Math.sin(time * 3 + i * 0.4) * 0.25 + Math.random() * 0.25;
        } else if (isSpeakingResponse) {
          amplitude = 0.45 + Math.sin(time * 5 + i * 0.3) * 0.35;
        } else {
          amplitude = 0.12 + Math.sin(time * 1.5 + i * 0.2) * 0.08;
        }

        const barHeight = Math.max(4, amplitude * (canvas.height * 0.8));
        const x = i * barWidth;
        const y = (canvas.height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, '#22D3EE');
        grad.addColorStop(0.5, '#2563FF');
        grad.addColorStop(1, '#793CFF');

        ctx.fillStyle = grad;
        ctx.fillRect(x + 1.5, y, barWidth - 3, barHeight);
      }

      animFrameRef.current = requestAnimationFrame(renderWave);
    };

    renderWave();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isListening, isSpeakingResponse]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      // Simulate speech recognition for demonstration if browser lacks mic permission
      setIsListening(true);
      setTimeout(() => {
        setTranscript('Why does this project use JWT tokens instead of database sessions?');
        setIsListening(false);
      }, 1800);
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      setTranscript('');
      setErrorMsg(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  const handleAsk = async () => {
    if (!transcript.trim() || askingQuestion) return;
    const q = transcript.trim();
    onClose();

    const result = await sendQuestion(q);

    // Optional Speech Synthesis playback
    if (soundEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window && result) {
      const utterance = new SpeechSynthesisUtterance(result.summary || 'Explanation retrieved from repository evidence.');
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      if (language === 'hi') utterance.lang = 'hi-IN';
      else if (language === 'ta') utterance.lang = 'ta-IN';
      else utterance.lang = 'en-US';

      utterance.onstart = () => setIsSpeakingResponse(true);
      utterance.onend = () => setIsSpeakingResponse(false);
      utterance.onerror = () => setIsSpeakingResponse(false);

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const samplePrompts = [
    'Why does this project use JWT tokens instead of server sessions?',
    'Where is the cryptographic signature verified?',
    'What happens if Redis goes down during logout?',
    'Which files would be affected if I change the auth routes?',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-2xl border border-cyan-500/30 bg-[#041126] p-6 shadow-2xl shadow-cyan-500/10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#0A2042] border border-cyan-500/40 text-cyan-300">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Voice AI Assistant</h2>
              <p className="text-xs text-slate-400">
                Speak naturally to query{' '}
                <span className="font-mono text-cyan-300">{activeRepo?.name || 'repository'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#071A35] transition-colors"
              title={soundEnabled ? 'Speech Audio Output On' : 'Speech Audio Output Muted'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-cyan-300" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#071A35] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Frequency Waveform Visualizer */}
        <div className="relative rounded-xl border border-slate-800 bg-[#020817] p-4 flex flex-col items-center justify-center min-h-[140px]">
          <canvas
            ref={canvasRef}
            width={480}
            height={90}
            className="w-full h-[90px] max-w-[480px]"
          />
          <div className="mt-3 text-xs font-mono text-cyan-300">
            {isListening
              ? 'Listening to microphone... Speak clearly.'
              : isSpeakingResponse
              ? 'Speaking response using Speech Synthesis...'
              : 'Microphone Idle · Tap button to speak'}
          </div>
        </div>

        {/* Live Transcription Box */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-slate-300">
            Detected Voice Transcription
          </label>
          <div className="relative">
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Your question will appear here as you speak, or you can select a sample below..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#020817] border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
            />
            {transcript && (
              <button
                type="button"
                onClick={() => setTranscript('')}
                className="absolute top-2.5 right-2.5 text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-950/40 border border-amber-600/30 text-amber-200 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Sample Voice Prompts */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-slate-400">Quick Voice Prompts:</span>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTranscript(p)}
                className="text-left text-xs px-2.5 py-1.5 rounded-lg bg-[#071A35] hover:bg-[#0A2042] border border-slate-800 text-slate-300 hover:text-cyan-200 transition-colors cursor-pointer"
              >
                "{p}"
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={toggleListening}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 animate-pulse'
                : 'bg-[#0A2042] hover:bg-[#071A35] text-cyan-300 border border-cyan-500/40'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Stop Listening</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-cyan-400" />
                <span>Start Microphone</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!transcript.trim() || askingQuestion}
              onClick={handleAsk}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#2563FF] hover:bg-[#1d4ed8] disabled:opacity-50 text-xs font-medium text-white transition-all shadow-lg shadow-[#2563FF]/30 cursor-pointer"
            >
              {askingQuestion ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Retrieving Evidence...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Ask CodeSage</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
