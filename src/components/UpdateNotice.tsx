import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const cmp = (a: string, b: string) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };

// Shows only inside the Android app: compares the app version (from the user agent) with a remote version file.
export const UpdateNotice: React.FC = () => {
  const { lang } = useLanguage() as any;
  const [info, setInfo] = useState<{ version: string; url: string } | null>(null);
  useEffect(() => {
    const m = navigator.userAgent.match(/ZakirApp\/([\d.]+)/);
    if (!m) return;
    fetch('https://raw.githubusercontent.com/ahm9sam-boop/zakir-bezaka-global/main/version.json', { cache: 'no-store' })
      .then(r => r.json()).then(j => { if (j?.version && cmp(j.version, m[1]) > 0) setInfo(j); }).catch(() => {});
  }, []);
  if (!info) return null;
  return (
    <div className="fixed bottom-20 inset-x-3 z-50 rounded-2xl bg-teal-500 text-slate-950 p-3 flex items-center justify-between gap-3 text-sm font-bold shadow-xl">
      <span>{lang === 'ar' ? `يوجد تحديث جديد (${info.version})` : `New version available (${info.version})`}</span>
      <a href="https://ahm9sam-boop.github.io/apps-store/" target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl bg-slate-950 text-white text-xs">{lang === 'ar' ? 'تحديث' : 'Update'}</a>
    </div>
  );
};
