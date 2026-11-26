import React, { useState, useEffect } from 'react';
import { getPlugin } from '../utils/native';
import {
  Share2,
  Copy,
  Check,
  Smartphone,
  QrCode,
  ExternalLink,
  ShieldCheck,
  Zap,
  X,
  Info,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { PWAInstallButton } from './PWAInstallButton';

interface ShareAppProps {
  onClose?: () => void;
  isModal?: boolean;
}

export const ShareApp: React.FC<ShareAppProps> = ({ onClose, isModal = false }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isStandalone, setIsStandalone] = useState(false);
  const [showManualInfo, setShowManualInfo] = useState(false);

  const currentUrl = 'https://ahm9sam-boop.github.io/apps-store/';

  const handleNativeShare = async () => {
    const text = `${t.share.whatsappShareText} ${currentUrl}`;
    try {
      const sh = getPlugin('Share');
      if (sh) {
        await sh.share({ title: t.seoTitle, text, url: currentUrl, dialogTitle: t.share.title });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
        return;
      }
    } catch {
      return; // user closed the share sheet
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: t.seoTitle, text, url: currentUrl });
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      } catch { /* closed */ }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-8">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-white to-teal-500/10 dark:from-emerald-950/60 dark:via-slate-900 dark:to-teal-950/60 border border-emerald-500/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner shrink-0">
            <Share2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-wide">
                {t.share.title}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                {t.share.badge}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
              {t.share.subtitle}
            </p>
          </div>
        </div>

        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {shareSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-center gap-3 shadow-lg animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{t.share.sharedBanner}</span>
        </div>
      )}

      <div className="max-w-md mx-auto p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl text-center">
        <p className="text-sm text-slate-600 dark:text-slate-300">{t.share.quickShareSub}</p>
        <button
          type="button"
          onClick={handleNativeShare}
          className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Share2 className="w-5 h-5" />
          <span>{t.share.nativeShareBtn}</span>
        </button>
      </div>
    </div>
  );
};
