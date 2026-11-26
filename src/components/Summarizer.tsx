import { FileImport } from './FileImport';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Bookmark,
  HelpCircle,
  AlertCircle,
  Lightbulb,
  Tag,
  RotateCcw,
} from 'lucide-react';
import { SummaryResult, SavedMaterial } from '../types';
import { safeStorageGet, safeStorageSet } from '../utils/storage';
import { useLanguage } from '../contexts/LanguageContext';

interface SummarizerProps {
  initialText?: string;
  onSaveMaterial: (material: Omit<SavedMaterial, 'id' | 'createdAt'>) => void;
  onSendToQuiz: (text: string) => void;
  hasGeminiKey: boolean;
}

export const Summarizer: React.FC<SummarizerProps> = ({
  initialText = '',
  onSaveMaterial,
  onSendToQuiz,
  hasGeminiKey,
}) => {
  const { lang, t } = useLanguage();

  const [inputText, setInputText] = useState(() =>
    initialText || safeStorageGet('zakir_saved_summary_input', '')
  );
  const [length, setLength] = useState<'short' | 'medium' | 'detailed'>('medium');
  const [style, setStyle] = useState<'balanced' | 'bullets' | 'comprehensive'>('balanced');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(() =>
    safeStorageGet<SummaryResult | null>('zakir_saved_summary', null)
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (initialText) {
      setInputText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    safeStorageSet('zakir_saved_summary', result);
  }, [result]);

  useEffect(() => {
    safeStorageSet('zakir_saved_summary_input', inputText);
  }, [inputText]);

  const handleSummarize = async () => {
    if (!inputText.trim()) {
      setErrorMessage(t.summarizer.emptyErr);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          length,
          style,
          language: lang,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || t.summarizer.failErr);
      }

      setResult(data as SummaryResult);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : t.summarizer.failErr);
    } finally {
      setIsLoading(false);
    }
  };

  const [speaking, setSpeaking] = useState(false);
  const toggleSpeak = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(buildFullText());
    const map: Record<string, string> = { ar: 'ar-EG', en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES', pt: 'pt-BR', ru: 'ru-RU', tr: 'tr-TR', hi: 'hi-IN', id: 'id-ID' };
    u.lang = map[lang] || lang;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  useEffect(() => () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  const buildFullText = () => {
    if (!result) return '';
    return `${result.title}\n\n${t.summarizer.overviewTitle}:\n${result.overview}\n\n${t.summarizer.pointsTitle}:\n${result.mainPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n${t.summarizer.defsTitle}:\n${result.definitions.map((d) => `• ${d.term}: ${d.definition}`).join('\n')}\n\n${t.summarizer.tipsTitle}:\n${result.examTips.map((tip) => `* ${tip}`).join('\n')}`;
  };

  const handleDownloadTxt = () => {
    const txt = buildFullText();
    if (!txt) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + txt], { type: 'text/plain;charset=utf-8' }));
    a.download = 'summary.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const handleDownloadPdf = () => {
    const txt = buildFullText();
    if (!txt) return;
    const esc = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html dir="auto"><head><meta charset="utf-8"><title>Summary</title><style>body{font-family:system-ui,Tahoma,sans-serif;line-height:1.8;padding:24px;white-space:pre-wrap}</style></head><body>${esc}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const handleCopy = () => {
    if (!result) return;
    const fullText = `${result.title}\n\n${t.summarizer.overviewTitle}:\n${result.overview}\n\n${t.summarizer.pointsTitle}:\n${result.mainPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n${t.summarizer.defsTitle}:\n${result.definitions.map((d) => `• ${d.term}: ${d.definition}`).join('\n')}\n\n${t.summarizer.tipsTitle}:\n${result.examTips.map((tip) => `* ${tip}`).join('\n')}`;

    navigator.clipboard.writeText(fullText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = () => {
    if (!result) return;
    onSaveMaterial({
      title: result.title,
      type: 'summary',
      subject: t.summarizer.subjectTag,
      tags: [t.summarizer.subjectTag],
      content: result,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    setResult(null);
    setInputText('');
    setConfirmReset(false);
    safeStorageSet('zakir_saved_summary', null);
    safeStorageSet('zakir_saved_summary_input', '');
  };

  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Page Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            {t.summarizer.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t.summarizer.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-500/30 flex items-center gap-1.5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            {hasGeminiKey ? t.assistant.liveEngine : t.nav.aiOffline}
          </span>
        </div>
      </div>

      {/* Input Section */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 space-y-4 shadow-xl">
        {/* Sample Loaders */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            {t.summarizer.samplesLabel}
          </span>
          <div className="flex flex-wrap gap-2">
            {([] as typeof t.samples).map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => setInputText(sample.fullText)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {sample.subject}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input Area */}
<FileImport className="mb-2" onText={(x) => setInputText((p) => (p ? p + "\n" : "") + x)} />
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t.summarizer.placeholder}
            rows={7}
            className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition resize-y"
          />
          {inputText && (
            <div className="mt-1.5 flex justify-end text-[11px] text-slate-500 dark:text-slate-400">
              <span className="bg-slate-100 dark:bg-slate-900/90 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                {inputText.length} {t.summarizer.chars} | ~{wordCount} {t.summarizer.words}
              </span>
            </div>
          )}
        </div>

        {/* Options & Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            {/* Length selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 px-2">{t.summarizer.sizeLabel}</span>
              {(['short', 'medium', 'detailed'] as const).map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => setLength(len)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    length === len
                      ? 'bg-teal-500/20 text-teal-700 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {t.summarizer[len]}
                </button>
              ))}
            </div>

            {/* Style selector */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 px-2">{t.summarizer.styleLabel}</span>
              <button
                type="button"
                onClick={() => setStyle('balanced')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  style === 'balanced'
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {t.summarizer.balanced}
              </button>
              <button
                type="button"
                onClick={() => setStyle('bullets')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  style === 'bullets'
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {t.summarizer.bullets}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {inputText && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {t.summarizer.clearBtn}
              </button>
            )}

            <button
              type="button"
              onClick={handleSummarize}
              disabled={isLoading || !inputText.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md shadow-teal-500/20 transition active:scale-95 flex-shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>{t.summarizer.loadingBtn}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{t.summarizer.summarizeBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Summary Output Area */}
      {result && (
        <div className="rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-5 sm:p-8 space-y-6 shadow-xl dark:shadow-2xl animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                  {result.engine || t.assistant.liveEngine}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{t.summarizer.successTag}</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-1">
                {result.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? t.common.copied : t.common.copy}</span>
              </button>

              <button type="button" onClick={handleDownloadTxt} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer">TXT</button>
              <button type="button" onClick={handleDownloadPdf} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer">PDF</button>

              <button type="button" onClick={toggleSpeak} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer">
                {speaking ? (lang === 'ar' ? '⏹ إيقاف القراءة' : '⏹ Stop') : (lang === 'ar' ? '🔊 استمع للملخص' : '🔊 Listen')}
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {isSaved ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Bookmark className="w-3.5 h-3.5" />}
                <span>{isSaved ? t.summarizer.savedLib : t.summarizer.saveLib}</span>
              </button>

              <button
                type="button"
                onClick={() => onSendToQuiz(result.overview + ' ' + result.mainPoints.join(' '))}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs shadow transition active:scale-95 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{t.summarizer.sendToQuiz}</span>
              </button>

              {confirmReset ? (
                <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2 py-1 text-[11px]">
                  <span className="text-rose-600 dark:text-rose-300 font-bold">
                    {t.summarizer.confirmResetAsk}
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold cursor-pointer"
                  >
                    {t.common.confirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmReset(false)}
                    className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 dark:text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  title={t.common.reset}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-teal-600 dark:text-teal-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              {t.summarizer.overviewTitle}
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80">
              {result.overview}
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500" />
              {t.summarizer.pointsTitle}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.mainPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 flex items-start gap-3 hover:border-teal-500/30 transition"
                >
                  <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {result.definitions && result.definitions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-500" />
                {t.summarizer.defsTitle}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.definitions.map((def, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/25 space-y-1"
                  >
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                      {def.term}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {def.definition}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.examTips && result.examTips.length > 0 && (
            <div className="p-4 rounded-2xl bg-teal-500/5 dark:bg-gradient-to-r dark:from-teal-950/40 dark:to-slate-950 border border-teal-500/25 space-y-2">
              <h4 className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                {t.summarizer.tipsTitle}
              </h4>
              <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {result.examTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-teal-600 dark:text-teal-400 font-bold">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
