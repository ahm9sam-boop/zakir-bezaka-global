import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true)
    ) {
      setIsStandalone(true);
    }

    QRCode.toDataURL(currentUrl, {
      width: 180,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [currentUrl]);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(currentUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNativeShare = async () => {
    const shareData = {
      title: t.seoTitle,
      text: `${t.share.whatsappShareText} ${currentUrl}`,
      url: currentUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
        return;
      } catch {
        // Fall back to copy
      }
    }
    handleCopyLink();
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Share Link & QR */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.share.quickShareTitle}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">{t.share.quickShareSub}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 space-y-2">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                {t.share.directLinkLabel}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-teal-700 dark:text-teal-300 font-mono text-xs focus:outline-none"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t.common.copied : t.common.copy}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-600 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{t.share.nativeShareBtn}</span>
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${t.share.whatsappShareText} ${currentUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-500/40 flex items-center justify-center gap-1.5 transition"
              >
                <span>{t.share.whatsappBtn}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Real Scannable QR Code */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-white p-1.5 flex items-center justify-center flex-shrink-0 shadow-md border border-slate-200">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={t.share.qrTitle}
                  className="w-full h-full object-contain rounded"
                />
              ) : (
                <QrCode className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <div className="space-y-1 text-xs">
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t.share.qrTitle}</span>
              </span>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.share.qrSub}
              </p>
            </div>
          </div>
        </div>

        {/* Install PWA Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Smartphone className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30">
                {t.share.installBadge}
              </span>
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.share.installTitle}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.share.installSub}
            </p>

            <div className="space-y-2 text-xs">
              {t.share.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-slate-700 dark:text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {isStandalone ? (
              <div className="w-full py-3.5 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2">
                <Check className="w-4 h-4" />
                <span>{t.share.installedBtn}</span>
              </div>
            ) : (
              <>
                <PWAInstallButton variant="card" />
                <button
                  type="button"
                  onClick={() => setShowManualInfo((v) => !v)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{t.share.installBtn}</span>
                </button>
                {showManualInfo && (
                  <p className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/25 text-[11px] text-teal-800 dark:text-teal-200 leading-relaxed animate-fadeIn">
                    {t.share.manualInstallInfo}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
        {t.share.features.map((feat, idx) => {
          const Icon = idx === 0 ? Zap : idx === 1 ? Smartphone : ShieldCheck;
          const color =
            idx === 0
              ? 'text-amber-500 dark:text-amber-400'
              : idx === 1
              ? 'text-teal-600 dark:text-teal-400'
              : 'text-emerald-600 dark:text-emerald-400';

          return (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3 shadow-sm"
            >
              <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
              <div>
                <div className="font-bold text-slate-900 dark:text-white">{feat.title}</div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400">{feat.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
