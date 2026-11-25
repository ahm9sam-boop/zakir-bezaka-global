import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  AlertCircle,
  Check,
} from 'lucide-react';
import { QuizQuestion, SavedMaterial } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { safeStorageGet, safeStorageSet } from '../utils/storage';

interface QuizGeneratorProps {
  initialText?: string;
  onSaveMaterial: (material: Omit<SavedMaterial, 'id' | 'createdAt'>) => void;
  onUpdateQuizProgress: (scorePercentage: number) => void;
  hasGeminiKey: boolean;
  studentPhone?: string;
}

export const QuizGenerator: React.FC<QuizGeneratorProps> = ({
  initialText = '',
  onSaveMaterial,
  onUpdateQuizProgress,
  hasGeminiKey,
  studentPhone,
}) => {
  const { t, lang } = useLanguage();
  const [topicInput, setTopicInput] = useState(initialText);
  const [questionCount, setQuestionCount] = useState<number>(4);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [quizType, setQuizType] = useState<'mixed' | 'mcq' | 'true_false'>('mixed');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [customQuestions, setCustomQuestions] = useState<QuizQuestion[] | null>(() =>
    safeStorageGet<QuizQuestion[] | null>('zakir_custom_quiz', null)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const questions = customQuestions && customQuestions.length > 0 ? customQuestions : t.quizzes.sampleQuestions;

  useEffect(() => {
    if (initialText) {
      setTopicInput(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    safeStorageSet('zakir_custom_quiz', customQuestions);
  }, [customQuestions]);

  // Reset answer index safely when question list size changes
  useEffect(() => {
    if (currentIdx >= questions.length) {
      setCurrentIdx(0);
    }
  }, [questions.length, currentIdx]);

  const handleGenerateQuiz = async () => {
    if (!topicInput.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setIsSubmitted(false);
    setSelectedAnswers({});
    setCurrentIdx(0);

    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicOrText: topicInput,
          count: questionCount,
          difficulty,
          type: quizType,
          language: lang,
          studentPhone,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.questions || data.questions.length === 0) {
        setErrorMsg(data.error || t.quizzes.errorMsg);
        return;
      }

      setCustomQuestions(data.questions);
    } catch {
      setErrorMsg(t.quizzes.errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, option: string) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleSubmitQuiz = () => {
    setIsSubmitted(true);

    let correctCount = 0;
    questions.forEach((q) => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correctCount++;
      }
    });

    const percentage = Math.round((correctCount / questions.length) * 100);
    onUpdateQuizProgress(percentage);

    if (percentage >= 70) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const handleResetQuiz = () => {
    setSelectedAnswers({});
    setIsSubmitted(false);
    setCurrentIdx(0);
  };

  const handleSaveQuiz = () => {
    onSaveMaterial({
      title: `${t.saved.types.quiz}: ${(topicInput || questions[0]?.question || t.tabs.quizzes.label).slice(0, 35)}`,
      type: 'quiz',
      subject: t.tabs.quizzes.label,
      tags: [t.saved.types.quiz],
      content: {
        questions,
        answers: selectedAnswers,
      },
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const currentQ = questions[currentIdx];
  const totalCorrect = questions.filter((q) => selectedAnswers[q.id] === q.correctAnswer).length;
  const scorePercent = questions.length ? Math.round((totalCorrect / questions.length) * 100) : 0;
  const allAnswered = questions.length > 0 && questions.every((q) => Boolean(selectedAnswers[q.id]));

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-sky-500 dark:text-sky-400" />
            <span>{t.quizzes.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t.quizzes.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1.5 font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{hasGeminiKey ? t.assistant.liveEngine : t.nav.aiOffline}</span>
          </span>
        </div>
      </div>

      {/* Generator Controls */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
            <span>{t.quizzes.samplesLabel}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {t.samples.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => setTopicInput(sample.fullText)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder={t.quizzes.placeholder}
          rows={3}
          className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-sky-500 transition resize-none"
        />

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            {/* Count */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 px-2">{t.quizzes.countLabel}</span>
              {[3, 5, 8].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setQuestionCount(count)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    questionCount === count
                      ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>

            {/* Difficulty */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 px-2">{t.quizzes.diffLabel}</span>
              {(
                [
                  { id: 'easy', label: t.quizzes.easy },
                  { id: 'medium', label: t.quizzes.medium },
                  { id: 'hard', label: t.quizzes.hard },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    difficulty === d.id
                      ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Type */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400 px-2">{t.quizzes.typeLabel}</span>
              {(
                [
                  { id: 'mixed', label: t.quizzes.mixed },
                  { id: 'mcq', label: t.quizzes.mcq },
                  { id: 'true_false', label: t.quizzes.trueFalse },
                ] as const
              ).map((qt) => (
                <button
                  key={qt.id}
                  type="button"
                  onClick={() => setQuizType(qt.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    quizType === qt.id
                      ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {qt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateQuiz}
            disabled={isLoading || !topicInput.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md transition cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>{t.quizzes.generatingBtn}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t.quizzes.generateBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Quiz Runner */}
      {questions.length > 0 && currentQ && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">
                {t.quizzes.questionOf
                  .replace('{current}', String(currentIdx + 1))
                  .replace('{total}', String(questions.length))}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {currentQ.type === 'mcq' ? t.quizzes.mcqTag : t.quizzes.tfTag}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {isSubmitted && (
                <div className="flex items-center gap-1.5 font-bold text-sm">
                  <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span className={scorePercent >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                    {t.quizzes.scoreLabel} {scorePercent}% ({totalCorrect}/{questions.length})
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveQuiz}
                className="flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
              >
                {savedSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
                <span>{savedSuccess ? t.quizzes.savedQuiz : t.quizzes.saveQuiz}</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
              {currentQ.question}
            </h3>

            <div className="space-y-2.5">
              {currentQ.options.map((opt, oIdx) => {
                const isSelected = selectedAnswers[currentQ.id] === opt;
                const isCorrect = opt === currentQ.correctAnswer;
                const isWrongSelection = isSubmitted && isSelected && !isCorrect;
                const isCorrectShow = isSubmitted && isCorrect;

                return (
                  <button
                    key={oIdx}
                    type="button"
                    onClick={() => handleSelectOption(currentQ.id, opt)}
                    disabled={isSubmitted}
                    className={`w-full p-4 rounded-2xl text-start text-sm font-medium transition-all flex items-center justify-between cursor-pointer ${
                      isCorrectShow
                        ? 'bg-emerald-500/15 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : isWrongSelection
                        ? 'bg-rose-500/15 border-2 border-rose-500 text-rose-900 dark:text-rose-200'
                        : isSelected
                        ? 'bg-sky-500/15 border-2 border-sky-500 text-sky-900 dark:text-sky-200'
                        : 'bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span>{opt}</span>
                    </div>

                    {isCorrectShow && <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />}
                    {isWrongSelection && <XCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {isSubmitted && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 space-y-1.5 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-600 dark:text-sky-400">
                <AlertCircle className="w-4 h-4" />
                <span>{t.quizzes.explanationTitle}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {currentQ.explanation}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t.common.prev}</span>
            </button>

            <div className="flex items-center gap-2">
              {!isSubmitted ? (
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  disabled={!allAnswered}
                  className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.quizzes.submitBtn}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.quizzes.retryBtn}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
              disabled={currentIdx === questions.length - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              <span>{t.common.next}</span>
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
