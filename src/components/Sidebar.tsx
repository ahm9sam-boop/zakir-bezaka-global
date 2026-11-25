import React from 'react';
import {
  LayoutDashboard,
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
  Shield,
  User,
  MessageCircle,
  Share2,
  Info,
} from 'lucide-react';
import { DashboardTab, Student } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  savedCount?: number;
  tasksPendingCount?: number;
  isAdmin?: boolean;
  currentStudent?: Student | null;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  mobileMenuOpen,
  setMobileMenuOpen,
  savedCount = 2,
  tasksPendingCount = 3,
  isAdmin = false,
  currentStudent,
  onOpenAuthModal,
  onLogout,
}) => {
  const { t, isRtl } = useLanguage();

  const navItems = [
    ...(isAdmin
      ? [
          {
            id: 'admin' as DashboardTab,
            label: t.tabs.admin.label,
            description: t.tabs.admin.desc,
            icon: Shield,
            badge: t.tabs.admin.badge || null,
            badgeColor: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
          },
        ]
      : []),
    {
      id: 'home' as DashboardTab,
      label: t.tabs.home.label,
      description: t.tabs.home.desc,
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'transcription' as DashboardTab,
      label: t.tabs.transcription.label,
      description: t.tabs.transcription.desc,
      icon: Mic,
      badge: t.tabs.transcription.badge || null,
      badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    {
      id: 'assistant' as DashboardTab,
      label: t.tabs.assistant.label,
      description: t.tabs.assistant.desc,
      icon: Bot,
      badge: t.tabs.assistant.badge || null,
    },
    {
      id: 'summarizer' as DashboardTab,
      label: t.tabs.summarizer.label,
      description: t.tabs.summarizer.desc,
      icon: FileText,
      badge: null,
    },
    {
      id: 'pdf_reader' as DashboardTab,
      label: t.tabs.pdf_reader.label,
      description: t.tabs.pdf_reader.desc,
      icon: FileSpreadsheet,
      badge: null,
    },
    {
      id: 'mindmaps' as DashboardTab,
      label: t.tabs.mindmaps.label,
      description: t.tabs.mindmaps.desc,
      icon: GitFork,
      badge: null,
    },
    {
      id: 'quizzes' as DashboardTab,
      label: t.tabs.quizzes.label,
      description: t.tabs.quizzes.desc,
      icon: HelpCircle,
      badge: null,
    },
    {
      id: 'flashcards' as DashboardTab,
      label: t.tabs.flashcards.label,
      description: t.tabs.flashcards.desc,
      icon: Layers,
      badge: null,
    },
    {
      id: 'planner' as DashboardTab,
      label: t.tabs.planner.label,
      description: t.tabs.planner.desc,
      icon: CalendarCheck,
      badge: tasksPendingCount > 0 ? `${tasksPendingCount}` : null,
      badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    },
    {
      id: 'saved' as DashboardTab,
      label: t.tabs.saved.label,
      description: t.tabs.saved.desc,
      icon: Bookmark,
      badge: savedCount > 0 ? `${savedCount}` : null,
    },
    {
      id: 'progress' as DashboardTab,
      label: t.tabs.progress.label,
      description: t.tabs.progress.desc,
      icon: TrendingUp,
      badge: t.tabs.progress.badge || null,
      badgeColor: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30',
    },
    {
      id: 'share' as DashboardTab,
      label: t.tabs.share.label,
      description: t.tabs.share.desc,
      icon: Share2,
      badge: t.tabs.share.badge || null,
      badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    },
    {
      id: 'contact' as DashboardTab,
      label: t.tabs.contact.label,
      description: t.tabs.contact.desc,
      icon: MessageCircle,
      badge: null,
    },
    {
      id: 'about' as DashboardTab,
      label: t.tabs.about.label,
      description: t.tabs.about.desc,
      icon: Info,
      badge: null,
    },
  ];

  const handleSelect = (tab: DashboardTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  const closedTranslateClass = isRtl ? 'translate-x-full' : '-translate-x-full';

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed top-16 sm:top-20 start-0 bottom-0 z-40 w-72 lg:w-64 xl:w-72 bg-white/95 dark:bg-slate-900/95 lg:bg-white/80 lg:dark:bg-slate-900/50 border-e border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : `${closedTranslateClass} lg:translate-x-0`
        }`}
      >
        <div className="space-y-1.5">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>{t.nav.toolsHeader}</span>
            {isAdmin && (
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {t.nav.adminShort}
              </span>
            )}
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-start transition-all group relative cursor-pointer ${
                    isActive
                      ? item.id === 'admin'
                        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 font-bold shadow-sm'
                        : 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-500/35 font-bold shadow-sm'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition ${
                        isActive
                          ? item.id === 'admin'
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                            : 'bg-teal-500/20 text-teal-600 dark:text-teal-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 group-hover:bg-slate-200/70 dark:group-hover:bg-slate-700/80'
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    </div>

                    <div className="text-start truncate">
                      <div className="text-sm truncate">{item.label}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ms-1 ${
                        item.badgeColor
                          ? item.badgeColor
                          : 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area: User Card & Admin Trigger */}
        <div className="mt-4 space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          {currentStudent ? (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                  {currentStudent.name}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                  {t.nav.activeStudentBadge}
                </span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center justify-between">
                <span className="font-mono text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {currentStudent.phone}
                </span>
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="text-slate-500 dark:text-slate-400 hover:text-rose-500 text-[10px] underline cursor-pointer"
                  >
                    {t.nav.switchAccount}
                  </button>
                )}
              </div>
            </div>
          ) : isAdmin ? (
            <div className="p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 space-y-1 text-xs">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>{t.nav.adminSidebarTitle}</span>
                </span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full">
                  {t.admin.badge}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 dark:text-slate-400">
                {t.nav.adminSidebarSub}
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t.nav.loginBtn}</span>
            </button>
          )}

          {!isAdmin && onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="w-full text-center text-[11px] text-slate-500 hover:text-teal-600 dark:hover:text-teal-400 py-1 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Shield className="w-3 h-3" />
              <span>{t.nav.adminCheckPrompt}</span>
            </button>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-center">
            <button
              type="button"
              onClick={() => handleSelect('contact')}
              className="py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="truncate">{t.tabs.contact.label}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect('share')}
              className="py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{t.tabs.share.label}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
