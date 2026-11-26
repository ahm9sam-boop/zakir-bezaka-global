import React, { useState } from 'react';
import { safeStorageSet } from '../utils/storage';

const LEVELS = ['إعدادي', 'ثانوي', 'جامعة', 'دراسات عليا', 'أخرى'];
const SUBJECTS = ['رياضيات', 'علوم', 'فيزياء', 'كيمياء', 'أحياء', 'لغة عربية', 'إنجليزي', 'تاريخ', 'جغرافيا', 'برمجة', 'طب', 'هندسة', 'تجارة'];

export const Onboarding: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [level, setLevel] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [other, setOther] = useState('');

  const toggle = (s: string) => setSubjects((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const finish = (skip: boolean) => {
    const all = [...subjects, ...(other.trim() ? [other.trim()] : [])].join('، ');
    safeStorageSet('zakir_profile', skip ? { level: '', subjects: '', skipped: true } : { level, subjects: all });
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">أهلاً بيك في ذاكر بذكاء 👋</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">اختار مستواك ومواديك علشان الشرح والأسئلة تبقى على مقاسك.</p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">المستوى الدراسي</div>
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <button key={l} type="button" onClick={() => setLevel(l)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${level === l ? 'bg-teal-500 text-slate-950 border-teal-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-bold text-slate-800 dark:text-slate-200">المواد (اختار اللي تحتاجه)</div>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button key={s} type="button" onClick={() => toggle(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border cursor-pointer ${subjects.includes(s) ? 'bg-teal-500 text-slate-950 border-teal-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}>
                {s}
              </button>
            ))}
          </div>
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="مادة تانية (اختياري)"
            className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-500" />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" onClick={() => finish(true)} className="text-xs text-slate-500 dark:text-slate-400 underline cursor-pointer">تخطي</button>
          <button type="button" disabled={!level} onClick={() => finish(false)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 disabled:opacity-40 text-slate-950 font-bold text-sm cursor-pointer">
            ابدأ المذاكرة
          </button>
        </div>
      </div>
    </div>
  );
};
