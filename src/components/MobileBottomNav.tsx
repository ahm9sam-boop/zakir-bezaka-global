import React from 'react';
import {
  LayoutDashboard,
  Bot,
  Mic,
  FileText,
  Menu,
} from 'lucide-react';
import { DashboardTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface MobileBottomNavProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  onOpenMenu: () => void;
  isAdmin?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentTab,
  onTabChange,
  onOpenMenu,
}) => {
  const { t } = useLanguage();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl"
      aria-label={t.nav.menuLabel}
    >
      <button
        type="button"
        onClick={() => onTabChange('home')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer ${
          currentTab === 'home'
            ? 'text-teal-600 dark:text-teal-400 font-bold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">{t.nav.mobileHome}</span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('transcription')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer ${
          currentTab === 'transcription'
            ? 'text-amber-600 dark:text-amber-400 font-bold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <Mic className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">{t.nav.mobileTranscribe}</span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('assistant')}
        className={`flex flex-col items-center justify-center -mt-4 p-2 rounded-2xl shadow-xl transition transform active:scale-95 cursor-pointer ${
          currentTab === 'assistant'
            ? 'bg-gradient-to-tr from-teal-500 to-cyan-400 text-slate-950 ring-2 ring-teal-400'
            : 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 border border-teal-500/30'
        }`}
      >
        <Bot className="w-6 h-6 mb-0.5" />
        <span className="text-[9px] font-extrabold">{t.nav.mobileAssistant}</span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('summarizer')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer ${
          currentTab === 'summarizer'
            ? 'text-teal-600 dark:text-teal-400 font-bold'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
        }`}
      >
        <FileText className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">{t.nav.mobileSummary}</span>
      </button>

      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[10px]">{t.nav.mobileMenu}</span>
      </button>
    </nav>
  );
};
