import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  FileText,
  FileSpreadsheet,
  Mic,
  GitFork,
  HelpCircle,
  Layers,
  CalendarCheck,
  Bookmark,
  TrendingUp,
  ArrowRight,
  Flame,
  CheckCircle2,
  Clock,
  BookOpen,
  RefreshCw,
} from 'lucide-react';
import { DashboardTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface DashboardHomeProps {
  onTabChange: (tab: DashboardTab) => void;
  onSelectSample: (sampleId: string, targetTab: DashboardTab) => void;
  streakDays: number;
  studyMinutes: number;
  completedTasksCount: number;
  totalTasksCount: number;
  hasGeminiKey?: boolean;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  onTabChange,
  onSelectSample,
  streakDays,
  studyMinutes,
  completedTasksCount,
  totalTasksCount,
}) => {
  const { t } = useLanguage();
  const [quoteIndex, setQuoteIndex] = useState(0);

  const quotes = t.home.quotes;
  const currentQuote = quotes[quoteIndex % quotes.length];

  const nextQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % quotes.length);
  };

  const featureCards: Array<{
    id: DashboardTab;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    border: string;
    iconColor: string;
    badge?: string;
  }> = [
    {
      id: 'assistant',
      title: t.tabs.assistant.label,
      subtitle: t.tabs.assistant.desc,
      icon: Bot,
      border: 'hover:border-teal-500/50',
      iconColor: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
      badge: t.tabs.assistant.badge,
    },
    {
      id: 'summarizer',
      title: t.tabs.summarizer.label,
      subtitle: t.tabs.summarizer.desc,
      icon: FileText,
      border: 'hover:border-indigo-500/50',
      iconColor: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
    },
    {
      id: 'pdf_reader',
      title: t.tabs.pdf_reader.label,
      subtitle: t.tabs.pdf_reader.desc,
      icon: FileSpreadsheet,
      border: 'hover:border-emerald-500/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    },
    {
      id: 'transcription',
      title: t.tabs.transcription.label,
      subtitle: t.tabs.transcription.desc,
      icon: Mic,
      border: 'hover:border-amber-500/50',
      iconColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
      badge: t.tabs.transcription.badge,
    },
    {
      id: 'mindmaps',
      title: t.tabs.mindmaps.label,
      subtitle: t.tabs.mindmaps.desc,
      icon: GitFork,
      border: 'hover:border-purple-500/50',
      iconColor: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
    },
    {
      id: 'quizzes',
      title: t.tabs.quizzes.label,
      subtitle: t.tabs.quizzes.desc,
      icon: HelpCircle,
      border: 'hover:border-sky-500/50',
      iconColor: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
    },
    {
      id: 'flashcards',
      title: t.tabs.flashcards.label,
      subtitle: t.tabs.flashcards.desc,
      icon: Layers,
      border: 'hover:border-teal-500/50',
      iconColor: 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
    },
    {
      id: 'planner',
      title: t.tabs.planner.label,
      subtitle: t.tabs.planner.desc,
      icon: CalendarCheck,
      border: 'hover:border-rose-500/50',
      iconColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    },
    {
      id: 'saved',
      title: t.tabs.saved.label,
      subtitle: t.tabs.saved.desc,
      icon: Bookmark,
      border: 'hover:border-cyan-500/50',
      iconColor: 'text-cyan-600 dark:text-cyan-300 bg-cyan-500/10',
    },
    {
      id: 'progress',
      title: t.tabs.progress.label,
      subtitle: t.tabs.progress.desc,
      icon: TrendingUp,
      border: 'hover:border-emerald-500/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      badge: t.tabs.progress.badge,
    },
  ];

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-teal-50/40 to-emerald-50/40 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 border border-teal-500/30 p-6 sm:p-8 lg:p-10 shadow-xl dark:shadow-2xl">
        <div className="absolute top-0 start-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 end-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none translate-x-1/3 translate-y-1/3" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/25 text-teal-700 dark:text-teal-300 text-xs sm:text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>{t.home.heroBadge}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              {t.home.heroTitle}
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.home.heroSub}
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onTabChange('assistant')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/25 transition transform active:scale-95 cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>{t.home.startAssistant}</span>
              </button>

              <button
                type="button"
                onClick={() => onTabChange('pdf_reader')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-white font-semibold text-sm border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.home.uploadPdf}</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Widget */}
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 bg-white/80 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm lg:min-w-[250px] shadow-sm">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-amber-400/20" />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {streakDays} {t.common.days}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t.home.streakLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                  {studyMinutes} {t.common.minShort}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t.home.studyTimeLabel}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white">
                  {completedTasksCount}/{totalTasksCount}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t.home.tasksDoneLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inspiring Motivational Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-50 via-white to-teal-50 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/40 border border-emerald-500/30 p-5 sm:p-6 shadow-md dark:shadow-xl">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {currentQuote.tag}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {currentQuote.author}
                </span>
              </div>
              <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed pt-1">
                "{currentQuote.quote}"
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={nextQuote}
            className="flex-shrink-0 self-end sm:self-center flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-slate-200 dark:border-slate-700/80 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t.home.anotherQuote}</span>
          </button>
        </div>
      </div>

      {/* 10 Main Dashboard Feature Cards */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
            {t.home.toolsTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t.home.toolsSub}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                onClick={() => onTabChange(card.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTabChange(card.id);
                  }
                }}
                className={`group relative p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between ${card.border}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2.5 rounded-xl ${card.iconColor} transition-transform group-hover:scale-110`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    {card.badge && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80">
                        {card.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1 group-hover:text-teal-600 dark:group-hover:text-teal-300 transition">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">
                    {card.subtitle}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-teal-600 dark:text-teal-400 group-hover:text-teal-500">
                  <span>{t.home.openTool}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instant Study Samples Starter */}
      <div className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            {t.home.samplesTitle}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.home.samplesSub}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {t.samples.map((sample) => (
            <div
              key={sample.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500/40 transition flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">
                  {sample.subject}
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-2 mb-1.5">
                  {sample.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                  {sample.excerpt}
                </p>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onSelectSample(sample.id, 'summarizer')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-teal-500/15 hover:text-teal-700 dark:hover:text-teal-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium transition cursor-pointer"
                >
                  {t.home.btnSummarize}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSample(sample.id, 'quizzes')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-cyan-500/15 hover:text-cyan-700 dark:hover:text-cyan-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium transition cursor-pointer"
                >
                  {t.home.btnQuiz}
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSample(sample.id, 'assistant')}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-500/15 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium transition cursor-pointer"
                >
                  {t.home.btnChat}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
