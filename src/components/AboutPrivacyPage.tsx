import React from 'react';
import { ShieldCheck, Sparkles, Lock, BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DashboardTab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface AboutPrivacyPageProps {
  onNavigate: (tab: DashboardTab) => void;
}


const NOTES = {
  en: {
    ai: 'AI features (tutor, summaries, quizzes, flashcards, mind maps) send the text you submit to AI providers (Google Gemini, Groq, OpenRouter or Pollinations, depending on availability) to generate the answer. Audio and video files you upload for transcription are sent from our server to Groq (Whisper) for speech-to-text; the server deletes the temporary file when the job ends. Always verify important academic details.',
    points: [
      'PDF, Word and text files are read inside your browser. Images are read by an OCR script (Tesseract) loaded from a public CDN, and the image stays in your browser.',
      'Audio and video files are uploaded to our server and then to Groq for transcription. Do not upload recordings that contain information you do not want shared with these providers.',
      'If advertising is enabled, ads are served by Google AdSense, which may use cookies. Your study content is not shared with advertisers, and we do not sell your data.',
    ],
  },
  ar: {
    ai: 'ميزات الذكاء الاصطناعي (المدرّس، التلخيص، الاختبارات، البطاقات، الخرائط الذهنية) ترسل النص الذي تدخله لمزوّدي ذكاء اصطناعي (Google Gemini أو Groq أو OpenRouter أو Pollinations حسب المتاح) لتوليد الإجابة. ملفات الصوت والفيديو التي ترفعها للتفريغ تُرسل من خادمنا إلى Groq (Whisper) لتحويل الكلام إلى نص، ويحذف الخادم الملف المؤقت بعد انتهاء المهمة. راجع دائماً المعلومات الأكاديمية المهمة.',
    points: [
      'ملفات PDF وWord والنص تُقرأ داخل متصفحك. الصور تُقرأ بسكربت OCR (Tesseract) يُحمّل من CDN عام وتبقى الصورة في متصفحك.',
      'ملفات الصوت والفيديو تُرفع إلى خادمنا ثم إلى Groq للتفريغ. لا ترفع تسجيلات فيها معلومات لا تريد مشاركتها مع هذه الجهات.',
      'عند تفعيل الإعلانات تُعرض عبر Google AdSense وقد يستخدم ملفات تعريف الارتباط. محتوى مذاكرتك لا يُشارَك مع المعلنين ولا نبيع بياناتك.',
    ],
  },
};

export const AboutPrivacyPage: React.FC<AboutPrivacyPageProps> = ({ onNavigate }) => {
  const { t, lang } = useLanguage();

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-br from-teal-500/10 via-white to-emerald-500/10 dark:from-slate-800/80 dark:via-slate-900 dark:to-teal-950/30 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-700 dark:text-teal-300 text-xs font-bold mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{t.tabs.about.label}</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
          {t.about.title}
        </h2>
        <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
          {t.about.subtitle}
        </p>
      </div>

      {/* Mission & AI Transparency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-teal-600 dark:text-teal-400">
            <BookOpen className="w-5 h-5" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t.about.missionTitle}</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.about.missionBody}
          </p>
        </section>

        <section className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 space-y-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t.about.aiTitle}</h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {NOTES[lang === 'ar' ? 'ar' : 'en'].ai}
          </p>
        </section>
      </div>

      {/* Privacy & Data Storage */}
      <section className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 text-sky-600 dark:text-sky-400">
          <Lock className="w-5 h-5" />
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t.about.privacyTitle}</h3>
        </div>
        <ul className="space-y-3">
          {[...t.about.privacyPoints.filter((_, i) => i === 0 || i === 2), ...NOTES[lang === 'ar' ? 'ar' : 'en'].points].map((point, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Academic Terms & Support CTA */}
      <section className="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1.5">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{t.about.termsTitle}</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            {t.about.termsBody}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('contact')}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
        >
          <span>{t.about.contactLinkText}</span>
          <ArrowRight className="w-4 h-4 rtl:rotate-180" />
        </button>
      </section>
    </div>
  );
};
