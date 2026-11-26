import { uploadFile } from '../utils/uploadChunks';
import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Upload,
  Copy,
  Bookmark,
  Check,
  FileText,
  AlertCircle,
  Sparkles,
  FileAudio,
  Radio,
  CheckCircle2,
  ListChecks,
  RotateCcw,
} from 'lucide-react';
import { SavedMaterial } from '../types';
import { safeStorageGet, safeStorageSet } from '../utils/storage';
import { useLanguage } from '../contexts/LanguageContext';

interface LectureTranscriptionProps {
  onSaveMaterial: (material: Omit<SavedMaterial, 'id' | 'createdAt'>) => void;
  onSendToSummarizer: (text: string) => void;
  hasGeminiKey: boolean;
  studentPhone?: string;
}

interface TranscriptResultState {
  title: string;
  transcription: string;
  summary: string;
  keyPoints?: string[];
  engine?: string;
  durationEstimate?: string;
}

export const LectureTranscription: React.FC<LectureTranscriptionProps> = ({
  onSaveMaterial,
  onSendToSummarizer,
  hasGeminiKey,
  studentPhone,
}) => {
  const { lang, langMeta, t } = useLanguage();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioFileObj, setAudioFileObj] = useState<File | null>(null);
  const [jobNote, setJobNote] = useState('');
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioFileSize, setAudioFileSize] = useState<string>('');
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/mp3');
  const [isReadingFile, setIsReadingFile] = useState(false);

  const [isLiveListening, setIsLiveListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [jobPct, setJobPct] = useState(0);
  const [audioLang, setAudioLang] = useState('auto');
  const [loadingStep, setLoadingStep] = useState(1);
  const [transcriptResult, setTranscriptResult] = useState<TranscriptResultState | null>(() =>
    safeStorageGet<TranscriptResultState | null>('zakir_saved_transcript', null)
  );

  useEffect(() => {
    safeStorageSet('zakir_saved_transcript', transcriptResult);
  }, [transcriptResult]);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [audioUrl]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isLoading) {
      setLoadingStep(1);
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 2500);
    } else {
      setLoadingStep(1);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLoading]);

  const startRecording = async () => {
    try {
      setErrorMessage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setAudioFileName(`${t.transcription.micRecording} ${new Date().toLocaleTimeString(langMeta.locale)}`);
        setAudioFileSize(`${(audioBlob.size / (1024 * 1024)).toFixed(2)} MB`);
        setAudioMimeType('audio/webm');

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(',')[1];
          setAudioBase64(base64Data);
          setAudioFileObj(null);
        };

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      setErrorMessage(t.transcription.micErr);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const toggleLiveSpeech = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any };
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(t.transcription.liveUnsupported);
      return;
    }

    if (isLiveListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsLiveListening(false);
      return;
    }

    try {
      setErrorMessage(null);
      const recognition = new SpeechRecognition();
      recognition.lang = langMeta.speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => setIsLiveListening(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalStr = '';
        for (let i = 0; i < event.results.length; i++) {
          finalStr += event.results[i][0].transcript + ' ';
        }
        setLiveTranscript(finalStr);
      };
      recognition.onerror = () => {
        setIsLiveListening(false);
        setErrorMessage(t.transcription.liveErr);
      };
      recognition.onend = () => setIsLiveListening(false);

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setErrorMessage(t.transcription.liveErr);
      setIsLiveListening(false);
    }
  };

  const handleUseLiveTranscript = () => {
    if (!liveTranscript.trim()) return;
    setTranscriptResult({
      title: t.transcription.liveTitle,
      transcription: liveTranscript.trim(),
      summary: t.transcription.liveSub,
      engine: 'Web Speech API',
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    const MAX_AUDIO_SIZE = 2 * 1024 * 1024 * 1024;
    if (file.size > MAX_AUDIO_SIZE) {
      const actualMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(t.transcription.sizeErr.replace('{actual}', actualMb));
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    let mime = file.type;
    if (!mime || mime === 'application/octet-stream') {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'mp3') mime = 'audio/mp3';
      else if (ext === 'wav') mime = 'audio/wav';
      else if (ext === 'm4a') mime = 'audio/m4a';
      else if (ext === 'aac') mime = 'audio/aac';
      else if (ext === 'ogg') mime = 'audio/ogg';
      else if (ext === 'webm') mime = 'audio/webm';
      else if (ext === 'mp4') mime = 'audio/mp4';
      else mime = 'audio/mp3';
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioFileName(file.name);
    setAudioFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    setAudioMimeType(mime);
    setAudioBase64(null);
    setAudioFileObj(file);
    setIsReadingFile(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTranscribe = async () => {
    if (isReadingFile) {
      setErrorMessage(t.transcription.readingFileWait);
      return;
    }

    if (!audioBase64 && !audioFileObj) {
      setErrorMessage(t.transcription.noAudioErr);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const post = async (u: string, body?: unknown) => {
        const r = await fetch(u, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
        const j = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, j };
      };
      let start: { ok: boolean; status: number; j: any };
      if (audioFileObj) {
        setLoadingStep(1);
        const uid = await uploadFile(audioFileObj, (p) => { setJobPct(Math.round(p * 0.08)); setJobNote(`⬆ ${p}%`); });
        setJobNote('');
        start = await post('/api/transcribe-file', { uploadId: uid, title: audioFileName || t.transcription.title, language: lang, audioLang });
      } else {
        start = await post('/api/transcribe-start', {
          audioBase64,
          mimeType: audioMimeType || 'audio/mp3',
          fileName: audioFileName,
          title: audioFileName || t.transcription.title,
          language: lang,
          audioLang,
        });
      }
      if (start.status === 501) {
        const old = await post('/api/transcribe', { audioBase64, mimeType: audioMimeType || 'audio/mp3', title: audioFileName || t.transcription.title, studentPhone: studentPhone || undefined, language: lang });
        if (!old.ok) throw new Error(old.j.error || t.assistant.errorFallback);
        setTranscriptResult(old.j);
        return;
      }
      if (!start.ok) throw new Error(start.j.error || t.assistant.errorFallback);
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000));
        const st = await post('/api/transcribe-status/' + start.j.jobId);
        if (!st.ok) throw new Error(st.j.error || t.assistant.errorFallback);
        setJobPct(Math.max(8, st.j.progress || 0)); setJobNote(st.j.note || '');
        setLoadingStep(st.j.stage === 'summarize' ? 3 : st.j.stage === 'transcribe' ? 2 : 1);
        if (st.j.status === 'error') throw new Error(st.j.error || t.assistant.errorFallback);
        if (st.j.status === 'done') { setTranscriptResult(st.j.result); break; }
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t.assistant.errorFallback);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!transcriptResult) return;
    navigator.clipboard.writeText(transcriptResult.transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!transcriptResult) return;
    onSaveMaterial({
      title: transcriptResult.title,
      type: 'transcription',
      subject: t.tabs.transcription.label,
      tags: [t.tabs.transcription.label],
      content: transcriptResult,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const confirmAndClear = () => {
    setTranscriptResult(null);
    setAudioUrl(null);
    setAudioBase64(null);
    setAudioFileObj(null);
    setAudioFileName('');
    setAudioFileSize('');
    setConfirmClear(false);
    safeStorageSet('zakir_saved_transcript', null);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            {t.transcription.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t.transcription.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            {hasGeminiKey ? t.transcription.engineBadge : t.nav.aiOffline}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5 shadow-md">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Recording & Upload Options Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl dark:shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Option 1: Live Microphone Recording */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center space-y-4 flex flex-col items-center justify-center">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {t.transcription.micTitle}
            </div>

            <div className="relative">
              {isRecording && (
                <span className="absolute -inset-2 rounded-full bg-rose-500/40 animate-ping pointer-events-none" />
              )}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-xl cursor-pointer ${
                  isRecording
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-gradient-to-tr from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950'
                }`}
              >
                {isRecording ? <Square className="w-6 h-6 fill-white" /> : <Mic className="w-7 h-7" />}
              </button>
            </div>

            <div className="text-base font-mono font-bold text-slate-900 dark:text-white">
              {isRecording ? formatTime(recordingSeconds) : '00:00'}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {isRecording ? t.transcription.micStop : t.transcription.micStart}
            </div>
          </div>

          {/* Option 2: Upload Audio */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t.transcription.uploadTitle}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.transcription.uploadSub}
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*,video/*,.mp3,.m4a,.wav,.webm,.ogg,.aac,.mp4,.mkv,.mov,.opus"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-amber-500" />
              <span>{t.transcription.chooseFileBtn}</span>
            </button>

          </div>

          {/* Option 3: Live Dictation */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.transcription.liveTitle}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.transcription.liveSub}
              </p>
            </div>

            <button
              type="button"
              onClick={toggleLiveSpeech}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                isLiveListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 border border-teal-500/30'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>{isLiveListening ? t.transcription.liveStopBtn : t.transcription.liveStartBtn}</span>
            </button>

            {liveTranscript && (
              <button
                type="button"
                onClick={handleUseLiveTranscript}
                className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.transcription.useLiveBtn}</span>
              </button>
            )}
          </div>
        </div>

        {liveTranscript && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-teal-500/30 space-y-2">
            <div className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{t.transcription.livePreviewTitle}</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
              {liveTranscript}
            </p>
          </div>
        )}

        {(audioUrl || audioFileName) && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-300 min-w-0">
                <FileAudio className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="font-bold truncate">{audioFileName}</span>
                {audioFileSize && <span className="text-slate-500 text-[11px] shrink-0">({audioFileSize})</span>}
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                {audioMimeType}
              </span>
            </div>

            {audioUrl && <audio controls src={audioUrl} className="w-full h-9 rounded-lg" />}
          </div>
        )}

        {(audioUrl || audioBase64) && (
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{t.transcription.aiHint}</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <select value={audioLang} onChange={(e) => setAudioLang(e.target.value)} className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800">
                <option value="auto">Auto</option>
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
              {isLoading && <span className="font-bold">{jobPct}%{jobNote ? ' · ' + jobNote : ''}</span>}
            </div>
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={isLoading || isReadingFile}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>
                    {loadingStep === 1
                      ? t.transcription.step1
                      : loadingStep === 2
                      ? t.transcription.step2
                      : t.transcription.step3}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t.transcription.transcribeBtn}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Results Display */}
      {transcriptResult && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl dark:shadow-2xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-800 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {transcriptResult.engine || t.transcription.engineBadge}
                </span>
                {transcriptResult.durationEstimate && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {transcriptResult.durationEstimate}
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1.5">
                {transcriptResult.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? t.common.copied : t.transcription.copyText}</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {saved ? <Check className="w-4 h-4 text-emerald-500" /> : <Bookmark className="w-4 h-4" />}
                <span>{saved ? t.transcription.savedLib : t.transcription.saveLib}</span>
              </button>

              <button
                type="button"
                onClick={() => onSendToSummarizer(transcriptResult.transcription)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-teal-300 text-xs font-bold border border-teal-500/30 transition shadow-sm cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{t.transcription.sendToSum}</span>
              </button>

              {confirmClear ? (
                <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2 py-1 text-[11px]">
                  <span className="text-rose-600 dark:text-rose-300 font-bold">{t.transcription.clearAsk}</span>
                  <button
                    type="button"
                    onClick={confirmAndClear}
                    className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold cursor-pointer"
                  >
                    {t.common.confirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  title={t.common.reset}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {transcriptResult.summary && (
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs sm:text-sm leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                <Sparkles className="w-4 h-4" />
                <span>{t.transcription.summaryTitle}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 leading-relaxed pt-1">
                {transcriptResult.summary}
              </p>
            </div>
          )}

          {transcriptResult.keyPoints && transcriptResult.keyPoints.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.transcription.keyPointsTitle}</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-disc list-inside">
                {transcriptResult.keyPoints.map((point, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>{t.transcription.fullTextTitle}</span>
            </h4>
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-loose whitespace-pre-wrap max-h-[500px] overflow-y-auto">
              {transcriptResult.transcription}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
