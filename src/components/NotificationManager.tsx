import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Sparkles,
  Trash2,
  X,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import { AppNotification } from '../types';
import { safeStorageGet, safeStorageSet } from '../utils/storage';
import { enableNativeReminders, getLN, REMINDER_POOL } from '../utils/reminders';
import { useLanguage } from '../contexts/LanguageContext';

export const NotificationManager: React.FC = () => {
  const { t, langMeta } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [notice, setNotice] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    safeStorageGet<AppNotification[]>('zakir_app_notifications', [])
  );

  // Seed localized welcome notifications on first visit if empty
  useEffect(() => {
    const existing = safeStorageGet<AppNotification[]>('zakir_app_notifications', []);
    if (existing.length === 0) {
      const nowTime = new Date().toLocaleTimeString(langMeta.locale, {
        hour: '2-digit',
        minute: '2-digit',
      });
      setNotifications([
        {
          id: 'notif_welcome',
          title: t.notifications.welcomeTitle,
          message: t.notifications.welcomeMsg,
          timestamp: nowTime,
          type: 'system',
          read: false,
        },
        {
          id: 'notif_update_lecture',
          title: t.notifications.updateTitle,
          message: t.notifications.updateMsg,
          timestamp: nowTime,
          type: 'feature',
          read: false,
        },
      ]);
    }
    // Only seed once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
    // Native app: ask once at start and (re)schedule 14 days of varied reminders
    if (getLN()) {
      const asked = safeStorageGet<boolean>('zakir_native_asked', false);
      enableNativeReminders(!asked).then((ok) => {
        safeStorageSet('zakir_native_asked', true);
        if (ok) setPermission('granted');
      });
    }
  }, []);

  useEffect(() => {
    safeStorageSet('zakir_app_notifications', notifications);
  }, [notifications]);

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {
      // AudioContext unavailable
    }
  };

  const sendPushNotification = useCallback(
    (title: string, body: string) => {
      playChime();

      const newEntry: AppNotification = {
        id: `notif_${Date.now()}`,
        title,
        message: body,
        timestamp: new Date().toLocaleTimeString(langMeta.locale, {
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: 'motivation',
        read: false,
      };
      setNotifications((prev) => [newEntry, ...prev].slice(0, 30));

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((reg) => {
              reg.showNotification(title, {
                body,
                icon: '/pwa-192x192.png',
                badge: '/icon.svg',
                dir: langMeta.dir,
                lang: langMeta.code,
              });
            });
          } else {
            new Notification(title, {
              body,
              icon: '/pwa-192x192.png',
              dir: langMeta.dir,
              lang: langMeta.code,
            });
          }
        } catch {
          // Optional system notification ignored if blocked
        }
      }
    },
    [langMeta]
  );

  const requestPermission = async () => {
    setNotice(null);
    if (getLN()) {
      const ok = await enableNativeReminders(true);
      setPermission(ok ? 'granted' : 'denied');
      if (!ok) setNotice('فعّل الإشعارات للتطبيق من إعدادات الهاتف');
      return;
    }
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotice(t.notifications.unsupportedNotice);
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        sendPushNotification(t.notifications.welcomeTitle, t.notifications.welcomeMsg);
      }
    } catch {
      setNotice(t.notifications.unsupportedNotice);
    }
  };

  const handleTriggerMotivation = () => {
    if (langMeta.code === 'ar') {
      const r = REMINDER_POOL[Math.floor(Math.random() * REMINDER_POOL.length)];
      sendPushNotification(r.t, r.b);
      return;
    }
    const list = t.notifications.alerts;
    const randomItem = list[Math.floor(Math.random() * list.length)];
    sendPushNotification(randomItem.title, randomItem.message);
  };

  // Keep latest callback ref for periodic interval without resetting timer
  const latestTriggerRef = useRef(handleTriggerMotivation);
  useEffect(() => {
    latestTriggerRef.current = handleTriggerMotivation;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      latestTriggerRef.current();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setNotice(null);
          if (!isOpen) markAllAsRead();
        }}
        className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition flex items-center justify-center cursor-pointer"
        title={t.notifications.centerTitle}
        aria-label={t.notifications.centerTitle}
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-rose-500 text-white font-mono font-bold text-[10px] flex items-center justify-center animate-pulse shadow-md">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />

          <div
            className="fixed sm:absolute top-16 sm:top-full end-4 sm:end-0 sm:mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-md rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 space-y-4 shadow-2xl z-50 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.notifications.centerTitle}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="p-1.5 text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 text-xs transition cursor-pointer"
                    title={t.notifications.clearAll}
                    aria-label={t.notifications.clearAll}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg cursor-pointer"
                  aria-label={t.common.close}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {notice && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {permission !== 'granted' && (
              <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs space-y-2">
                <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300 font-bold">
                  <Smartphone className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>{t.notifications.enableTitle}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t.notifications.enableDesc}
                </p>
                <button
                  type="button"
                  onClick={requestPermission}
                  className="w-full py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {t.notifications.enableBtn}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleTriggerMotivation}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>{t.notifications.triggerBtn}</span>
            </button>

            <div className="max-h-64 overflow-y-auto space-y-2.5 pe-1">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                  <Bell className="w-6 h-6 mx-auto text-slate-400 dark:text-slate-600" />
                  <p>{t.notifications.emptyMsg}</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{item.title}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">{item.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed ps-3">
                      {item.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
