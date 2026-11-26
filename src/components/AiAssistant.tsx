import { FileImport } from './FileImport';
import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Bookmark,
  Trash2,
  FileText,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { ChatMessage, SavedMaterial } from '../types';
import { safeStorageGet, safeStorageSet } from '../utils/storage';
import { useLanguage } from '../contexts/LanguageContext';

interface AiAssistantProps {
  initialContext?: string;
  onSaveMaterial: (material: Omit<SavedMaterial, 'id' | 'createdAt'>) => void;
  hasGeminiKey: boolean;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  initialContext = '',
  onSaveMaterial,
}) => {
  const { lang, langMeta, t } = useLanguage();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = safeStorageGet<ChatMessage[]>('zakir_assistant_messages', []);
    if (saved.length > 0) return saved;
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        content: t.assistant.welcomeMsg,
        timestamp: new Date().toLocaleTimeString(langMeta.locale, { hour: '2-digit', minute: '2-digit' }),
        source: t.assistant.liveEngine,
        isLiveAi: true,
      },
    ];
  });

  // Update standalone welcome message when language changes before user chats
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && (prev[0].id === 'welcome' || prev[0].id === 'welcome-reset')) {
        return [
          {
            ...prev[0],
            content: prev[0].id === 'welcome' ? t.assistant.welcomeMsg : t.assistant.resetMsg,
            source: t.assistant.liveEngine,
          },
        ];
      }
      return prev;
    });
  }, [lang, t.assistant.welcomeMsg, t.assistant.resetMsg, t.assistant.liveEngine]);

  useEffect(() => {
    safeStorageSet('zakir_assistant_messages', messages);
  }, [messages]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studyContext, setStudyContext] = useState(initialContext);
  const [showContextPanel, setShowContextPanel] = useState(Boolean(initialContext));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [savedSuccessId, setSavedSuccessId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialContext) {
      setStudyContext(initialContext);
      setShowContextPanel(true);
    }
  }, [initialContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString(langMeta.locale, { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    if (!customText) setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          studyContext: studyContext.trim() || undefined,
          language: lang,
          profile: safeStorageGet<any>('zakir_profile', null) || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.reply) {
        throw new Error(data?.error || t.assistant.errorFallback);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString(langMeta.locale, { hour: '2-digit', minute: '2-digit' }),
        source: data.source === 'gemini-4-hydrogen' ? t.assistant.liveEngine : data.source,
        isLiveAi: data.isLiveAi ?? true,
        sources: Array.isArray(data.sources) && data.sources.length ? data.sources : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.assistant.errorFallback;
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        content: msg || t.assistant.errorFallback,
        timestamp: new Date().toLocaleTimeString(langMeta.locale, { hour: '2-digit', minute: '2-digit' }),
        source: t.common.error,
        isLiveAi: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (id: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langMeta.speechLang;
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSaveToNotebook = (msg: ChatMessage) => {
    onSaveMaterial({
      title: `${t.assistant.notePrefix}${msg.content.slice(0, 35)}...`,
      type: 'note',
      subject: t.assistant.noteSubject,
      tags: [t.assistant.noteTag1, t.assistant.noteTag2],
      content: { text: msg.content, timestamp: msg.timestamp },
    });
    setSavedSuccessId(msg.id);
    setTimeout(() => setSavedSuccessId(null), 2500);
  };

  const confirmAndClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        content: t.assistant.resetMsg,
        timestamp: new Date().toLocaleTimeString(langMeta.locale, { hour: '2-digit', minute: '2-digit' }),
        source: t.assistant.liveEngine,
        isLiveAi: true,
      },
    ]);
    setConfirmClear(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[540px] bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl dark:shadow-2xl">
      {/* Assistant Header & Context Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-teal-500/20 to-cyan-500/20 border border-teal-500/30 text-teal-600 dark:text-teal-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>{t.assistant.title}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                {t.assistant.liveEngine}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.assistant.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowContextPanel(!showContextPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              studyContext.trim()
                ? 'bg-teal-500/15 border-teal-500/40 text-teal-700 dark:text-teal-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>
              {studyContext.trim() ? t.assistant.contextAttached : t.assistant.attachContext}
            </span>
          </button>

          {confirmClear ? (
            <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-rose-700 dark:text-rose-300 font-bold">
                {t.assistant.clearConfirmAsk}
              </span>
              <button
                type="button"
                onClick={confirmAndClearChat}
                className="px-2 py-0.5 rounded-lg bg-rose-500 text-white font-bold text-[11px] cursor-pointer"
              >
                {t.assistant.clearConfirmYes}
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] cursor-pointer"
              >
                {t.common.cancel}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-rose-500 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              title={t.assistant.clearChat}
              aria-label={t.assistant.clearChat}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Study Context Drawer */}
      {showContextPanel && (
        <div className="p-3 bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              {t.assistant.contextLabel}
            </span>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  const s = t.samples.find((m) => m.id === e.target.value);
                  if (s) setStudyContext(s.fullText);
                }}
                className="text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-800 dark:text-slate-200"
                defaultValue=""
              >
                <option value="" disabled>
                  {t.assistant.chooseSample}
                </option>
                {([] as typeof t.samples).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
              {studyContext && (
                <button
                  type="button"
                  onClick={() => setStudyContext('')}
                  className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                >
                  {t.assistant.clearContext}
                </button>
              )}
            </div>
          </div>
<FileImport className="mb-2" onText={(x) => setStudyContext((p) => (p ? p + "\n" : "") + x)} />
          <textarea
            value={studyContext}
            onChange={(e) => setStudyContext(e.target.value)}
            placeholder={t.assistant.contextPlaceholder}
            rows={2}
            className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500/50 resize-none"
          />
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${isUser ? 'ms-auto flex-row-reverse' : 'me-auto'}`}
            >
              <div
                className={`p-2 rounded-2xl flex-shrink-0 h-9 w-9 flex items-center justify-center ${
                  isUser
                    ? 'bg-gradient-to-tr from-cyan-600 to-teal-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-teal-600 dark:text-teal-400'
                }`}
              >
                {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>

              <div
                className={`flex flex-col space-y-1.5 max-w-[85%] sm:max-w-[78%] ${
                  isUser ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`p-4 rounded-3xl text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser
                      ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-se-none shadow-md shadow-teal-900/20'
                      : 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/80 rounded-ss-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {msg.sources && msg.sources.length > 0 && (
                  <div className="px-2 space-y-1">
                    <div className="text-[11px] font-bold text-teal-700 dark:text-teal-400">{lang === 'ar' ? 'المصادر من مادتك:' : 'Sources from your material:'}</div>
                    {msg.sources.map((s) => (
                      <div key={s.n} className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 leading-relaxed">
                        <span className="font-bold text-teal-700 dark:text-teal-400">[{s.n}]</span> {s.text}{s.text.length >= 400 ? '…' : ''}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 px-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{msg.timestamp}</span>
                  {msg.source && (
                    <>
                      <span>•</span>
                      <span className="text-teal-600 dark:text-teal-400/80">{msg.source}</span>
                    </>
                  )}

                  {!isUser && (
                    <div className="flex items-center gap-1.5 ms-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="p-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        title={t.assistant.copyTitle}
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSpeak(msg.id, msg.content)}
                        className={`p-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer ${
                          speakingId === msg.id ? 'text-teal-600 dark:text-teal-300 animate-pulse' : ''
                        }`}
                        title={t.assistant.speakTitle}
                      >
                        {speakingId === msg.id ? (
                          <VolumeX className="w-3.5 h-3.5 text-teal-500" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveToNotebook(msg)}
                        className="p-1 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                        title={t.assistant.saveNoteTitle}
                      >
                        {savedSuccessId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Bookmark className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-xl me-auto">
            <div className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-teal-600 dark:text-teal-400 h-9 w-9 flex items-center justify-center">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div className="p-4 rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-ss-none flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce delay-100" />
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce delay-200" />
              </span>
              <span>{t.assistant.thinking}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Chips */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800/70 bg-slate-50 dark:bg-slate-900/50 flex gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pe-1 flex-shrink-0">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>{t.assistant.suggestionsLabel}</span>
        </div>
        {t.assistant.suggestions.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="text-xs px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-slate-700/80 whitespace-nowrap transition flex-shrink-0 cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 sm:gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.assistant.inputPlaceholder}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-sm shadow-md shadow-teal-500/20 transition flex items-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <span>{t.assistant.sendBtn}</span>
            <Send className="w-4 h-4 rtl:rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
};
