import React from 'react';
import { Logo } from './Logo';
import {
  Menu,
  X,
  Flame,
  Sparkles,
  Clock,
  Cpu,
  User,
  Shield,
  LogOut,
} from 'lucide-react';
import { NotificationManager } from './NotificationManager';
import { LanguageThemeControls } from './LanguageThemeControls';
import { PWAInstallButton } from './PWAInstallButton';
import { DashboardTab, Student } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface NavbarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  hasGeminiKey: boolean;
  streakDays: number;
  studyMinutes: number;
  onOpenPomodoro?: () => void;
  currentStudent?: Student | null;
  isAdmin?: boolean;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  mobileMenuOpen,
  setMobileMenuOpen,
  hasGeminiKey,
  streakDays,
  studyMinutes,
  onOpenPomodoro,
  currentStudent,
  isAdmin,
  onOpenAuthModal,
  onLogout,
}) => {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Start side: Mobile Menu Button & Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label={t.nav.menuLabel}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div onClick={() => onTabChange('home')} className="cursor-pointer shrink-0">
              <Logo size="md" />
            </div>
          </div>

          {/* Center: AI Engine status pill */}
          <div className="hidden xl:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    hasGeminiKey ? 'bg-teal-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    hasGeminiKey ? 'bg-teal-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <Cpu className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {hasGeminiKey ? t.nav.aiOnline : t.nav.aiOffline}
              </span>
            </div>
          </div>

          {/* End side: Language/Theme, Streak, Notifications, Timer, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <LanguageThemeControls compact />

            <PWAInstallButton variant="compact" />

            {/* Study Streak */}
            <div
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-semibold select-none"
              title={t.nav.streakTooltip}
            >
              <Flame className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
              <span>{streakDays}</span>
              <span className="hidden lg:inline">{t.common.days}</span>
            </div>

            {/* Notification Bell */}
            <NotificationManager />

            {/* Total Minutes Studied */}
            <button
              type="button"
              onClick={onOpenPomodoro}
              className="hidden sm:flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/25 text-teal-700 dark:text-teal-300 text-xs font-semibold hover:bg-teal-500/20 transition"
              title={t.nav.timerTooltip}
            >
              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>
                {studyMinutes} {t.common.minShort}
              </span>
            </button>

            {/* User Account / Admin Badge */}
            {isAdmin ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onTabChange('admin')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    currentTab === 'admin'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.nav.adminBtn}</span>
                  <span className="sm:hidden">{t.nav.adminShort}</span>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                    title={t.nav.logoutBtn}
                    aria-label={t.nav.logoutBtn}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : currentStudent ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="hidden sm:flex flex-col text-start">
                  <span className="font-bold text-slate-900 dark:text-white text-[11px] max-w-[100px] truncate">
                    {currentStudent.name}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono" dir="ltr">
                    {currentStudent.phone}
                  </span>
                </div>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-500 ms-0.5 cursor-pointer"
                    title={t.nav.logoutBtn}
                    aria-label={t.nav.logoutBtn}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.nav.loginBtn}</span>
              </button>
            )}

            {/* Quick Action: Start AI Assistant */}
            <button
              type="button"
              onClick={() => onTabChange('assistant')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 transition transform active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.nav.assistantBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
