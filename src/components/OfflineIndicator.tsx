import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const OfflineIndicator: React.FC = () => {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const onOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };
    const onOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3500);
    };

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className="fixed bottom-20 lg:bottom-4 inset-x-4 z-50 flex justify-center pointer-events-none animate-fadeIn">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl border backdrop-blur-md ${
          isOnline
            ? 'bg-emerald-600/95 border-emerald-400 text-white'
            : 'bg-amber-600/95 border-amber-400 text-white'
        }`}
      >
        {isOnline ? <Wifi className="w-4 h-4 shrink-0" /> : <WifiOff className="w-4 h-4 shrink-0" />}
        <span>{isOnline ? t.pwa.onlineMsg : t.pwa.offlineMsg}</span>
      </div>
    </div>
  );
};
