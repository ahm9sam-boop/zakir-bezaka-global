import React from 'react';
import {
  TrendingUp,
  Flame,
  Clock,
  Award,
  Layers,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { UserProgress } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface ProgressDashboardProps {
  progress: UserProgress;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({ progress }) => {
  const { t } = useLanguage();

  const badgeVisuals = [
    {
      unlocked: progress.streakDays >= 5,
      icon: Flame,
      color: 'from-amber-500 to-orange-500',
    },
    {
      unlocked: progress.averageQuizScore >= 80,
      icon: Award,
      color: 'from-emerald-500 to-teal-500',
    },
    {
      unlocked: progress.cardsMastered >= 5,
      icon: Layers,
      color: 'from-cyan-500 to-blue-500',
    },
    {
      unlocked: progress.tasksCompleted >= 3,
      icon: CheckCircle2,
      color: 'from-purple-500 to-pink-500',
    },
  ];

  const maxMinutes = Math.max(...progress.dailyMinutes.map((d) => d.minutes), 60);

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          <span>{t.progress.title}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          {t.progress.subtitle}
        </p>
      </div>

      {/* Top 4 Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>{t.progress.totalHoursTitle}</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {(progress.totalStudyMinutes / 60).toFixed(1)}{' '}
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{t.common.hours}</span>
          </div>
          <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
            {t.progress.focusMinsSub.replace('{mins}', String(progress.totalStudyMinutes))}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>{t.progress.streakTitle}</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {progress.streakDays}{' '}
            <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">{t.common.days}</span>
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {t.progress.streakSub}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>{t.progress.quizAvgTitle}</span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {progress.averageQuizScore}%
          </div>
          <div className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
            {t.progress.quizzesCountSub.replace('{count}', String(progress.quizzesTaken))}
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs">
            <span>{t.progress.cardsTitle}</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {progress.cardsMastered}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {t.progress.cardsSub}
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <span>{t.progress.chartTitle}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t.progress.chartSub}
            </p>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {t.progress.chartBadge}
          </span>
        </div>

        <div className="pt-6 pb-2">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 sm:h-52 px-2 border-b border-slate-200 dark:border-slate-800">
            {progress.dailyMinutes.map((dayData, idx) => {
              const heightPercent = Math.max(10, Math.round((dayData.minutes / maxMinutes) * 100));
              const isToday = idx === progress.dailyMinutes.length - 1;
              const dayLabel = t.progress.weekdays[idx] || dayData.day;

              return (
                <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                  <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition">
                    {dayData.minutes} {t.common.minShort}
                  </div>

                  <div className="w-full max-w-[45px] bg-slate-100 dark:bg-slate-800/80 rounded-2xl p-1 flex items-end h-full">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-xl transition-all duration-500 ${
                        isToday
                          ? 'bg-gradient-to-t from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/20'
                          : 'bg-gradient-to-t from-slate-300 to-teal-500/70 dark:from-slate-700 dark:to-teal-600/60 group-hover:from-teal-500 group-hover:to-teal-400'
                      }`}
                    />
                  </div>

                  <div
                    className={`text-[11px] sm:text-xs font-semibold truncate max-w-full ${
                      isToday ? 'text-teal-700 dark:text-teal-300 font-bold' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {dayLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Achievement Badges */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          <span>{t.progress.badgesTitle}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {t.progress.badges.map((badgeMeta, idx) => {
            const vis = badgeVisuals[idx] || badgeVisuals[0];
            const Icon = vis.icon;
            return (
              <div
                key={badgeMeta.id}
                className={`p-5 rounded-3xl border transition-all flex flex-col justify-between space-y-3 ${
                  vis.unlocked
                    ? 'bg-white dark:bg-slate-900 border-teal-500/40 shadow-xl'
                    : 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/60 opacity-60 grayscale'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-2xl bg-gradient-to-tr ${vis.color} text-white shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      vis.unlocked
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {vis.unlocked ? t.progress.doneBadge : t.progress.inProgressBadge}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{badgeMeta.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {badgeMeta.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
