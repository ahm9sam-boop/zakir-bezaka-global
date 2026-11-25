import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  Rotate3d,
  CheckCircle,
  XCircle,
  Plus,
  Shuffle,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Trash2,
  Bookmark,
  Check,
  AlertCircle,
  X,
} from 'lucide-react';
import { Flashcard, SavedMaterial } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { safeStorageGet, safeStorageSet } from '../utils/storage';

interface FlashcardsViewProps {
  initialText?: string;
  onSaveMaterial: (material: Omit<SavedMaterial, 'id' | 'createdAt'>) => void;
  onUpdateFlashcardProgress: (masteredCount: number) => void;
  hasGeminiKey: boolean;
  studentPhone?: string;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  initialText = '',
  onSaveMaterial,
  onUpdateFlashcardProgress,
  hasGeminiKey,
  studentPhone,
}) => {
  const { t, lang } = useLanguage();
  const [customCards, setCustomCards] = useState<Flashcard[] | null>(() =>
    safeStorageGet<Flashcard[] | null>('zakir_custom_flashcards', null)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [topicInput, setTopicInput] = useState(initialText);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedDeck, setSavedDeck] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const cards = customCards && customCards.length > 0 ? customCards : t.flashcards.sampleCards;

  useEffect(() => {
    if (initialText) {
      setTopicInput(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    safeStorageSet('zakir_custom_flashcards', customCards);
  }, [customCards]);

  useEffect(() => {
    if (currentIdx >= cards.length && cards.length > 0) {
      setCurrentIdx(cards.length - 1);
    }
  }, [cards.length, currentIdx]);

  const handleGenerateCards = async () => {
    if (!topicInput.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setIsFlipped(false);

    try {
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicOrText: topicInput,
          count: 6,
          language: lang,
          studentPhone,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.cards || data.cards.length === 0) {
        setErrorMsg(data.error || t.flashcards.errorMsg);
        return;
      }

      setCustomCards(data.cards);
      setCurrentIdx(0);
    } catch {
      setErrorMsg(t.flashcards.errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMastery = (mastered: boolean) => {
    const updated = cards.map((card, idx) => (idx === currentIdx ? { ...card, mastered } : card));
    setCustomCards(updated);

    const masteredCount = updated.filter((c) => c.mastered).length;
    onUpdateFlashcardProgress(masteredCount);

    setIsFlipped(false);
    if (currentIdx < updated.length - 1) {
      setTimeout(() => setCurrentIdx((prev) => prev + 1), 200);
    }
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCustomCards(shuffled);
    setCurrentIdx(0);
  };

  const handleDeleteCurrentCard = () => {
    if (cards.length <= 1) return;
    const updated = cards.filter((_, idx) => idx !== currentIdx);
    setCustomCards(updated);
    setIsFlipped(false);
    setCurrentIdx((prev) => Math.max(0, Math.min(prev, updated.length - 1)));
  };

  const handleSaveDeck = () => {
    onSaveMaterial({
      title: `${t.saved.types.flashcards}: ${(topicInput || cards[0]?.category || t.tabs.flashcards.label).slice(0, 35)}`,
      type: 'flashcards',
      subject: cards[0]?.category || t.tabs.flashcards.label,
      tags: [t.saved.types.flashcards],
      content: { cards },
    });
    setSavedDeck(true);
    setTimeout(() => setSavedDeck(false), 2000);
  };

  const handleAddCustomCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFront.trim() || !newBack.trim()) return;

    const newCard: Flashcard = {
      id: `custom-${Date.now()}`,
      front: newFront.trim(),
      back: newBack.trim(),
      category: newCategory.trim() || t.tabs.flashcards.label,
      difficulty: 'medium',
      mastered: false,
    };

    const next = [...cards, newCard];
    setCustomCards(next);
    setNewFront('');
    setNewBack('');
    setNewCategory('');
    setShowAddModal(false);
    setCurrentIdx(next.length - 1);
  };

  const masteredTotal = cards.filter((c) => c.mastered).length;
  const progressPercent = cards.length ? Math.round((masteredTotal / cards.length) * 100) : 0;
  const currentCard = cards[currentIdx];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-teal-600 dark:text-teal-400" />
            <span>{t.flashcards.title}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            {t.flashcards.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{hasGeminiKey ? t.assistant.liveEngine : t.nav.aiOffline}</span>
          </span>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>{t.flashcards.addManualBtn}</span>
          </button>
        </div>
      </div>

      {/* Generator Box */}
      <div className="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{t.flashcards.samplesLabel}</span>
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

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder={t.flashcards.placeholder}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-teal-500 transition"
          />

          <button
            type="button"
            onClick={handleGenerateCards}
            disabled={isLoading || !topicInput.trim()}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 text-slate-950 font-bold text-sm shadow-md transition flex-shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>{t.flashcards.generatingBtn}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{t.flashcards.generateBtn}</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Progress & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-900 dark:text-white">
            {t.flashcards.cardOf
              .replace('{current}', String(cards.length > 0 ? currentIdx + 1 : 0))
              .replace('{total}', String(cards.length))}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-28 sm:w-40 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-500 dark:bg-teal-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-teal-700 dark:text-teal-300 font-bold">
              {t.flashcards.masteredPct.replace('{pct}', String(progressPercent))}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSaveDeck}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 border border-teal-500/25 text-xs font-semibold transition cursor-pointer"
          >
            {savedDeck ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
            <span>{savedDeck ? t.flashcards.savedDeckBtn : t.flashcards.saveDeckBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleShuffle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs transition cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>{t.flashcards.shuffleBtn}</span>
          </button>

          {cards.length > 1 && (
            <button
              type="button"
              onClick={handleDeleteCurrentCard}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-500/15 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-500 transition cursor-pointer"
              title={t.common.delete}
              aria-label={t.common.delete}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Flip Card */}
      {currentCard ? (
        <div className="flex flex-col items-center space-y-6">
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsFlipped(!isFlipped);
              }
            }}
            className="w-full max-w-xl h-72 sm:h-80 cursor-pointer select-none group"
          >
            {!isFlipped ? (
              <div className="w-full h-full rounded-3xl bg-gradient-to-br from-white via-slate-50 to-teal-50/40 dark:from-slate-900 dark:via-slate-800/80 dark:to-slate-900 border-2 border-teal-500/30 p-6 sm:p-8 flex flex-col justify-between shadow-2xl group-hover:border-teal-500/60 transition animate-fadeIn">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                    {currentCard.category}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Rotate3d className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>{t.flashcards.tapToFlip}</span>
                  </span>
                </div>

                <div className="text-center my-auto px-4">
                  <div className="text-xs text-teal-600 dark:text-teal-400 uppercase tracking-widest font-bold mb-2">
                    {t.flashcards.frontLabel}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-relaxed">
                    {currentCard.front}
                  </h3>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <span>
                    {t.flashcards.diffLabel}{' '}
                    {currentCard.difficulty === 'easy'
                      ? t.flashcards.easy
                      : currentCard.difficulty === 'hard'
                      ? t.flashcards.hard
                      : t.flashcards.medium}
                  </span>
                  {currentCard.mastered && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> {t.flashcards.masteredBadge}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full rounded-3xl bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-slate-900 dark:via-teal-950/40 dark:to-slate-900 border-2 border-teal-500/60 p-6 sm:p-8 flex flex-col justify-between shadow-2xl animate-fadeIn">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30">
                    {t.flashcards.backLabel}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Rotate3d className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    <span>{t.flashcards.tapToReturn}</span>
                  </span>
                </div>

                <div className="text-center my-auto px-4">
                  <p className="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {currentCard.back}
                  </p>
                </div>

                <div className="flex items-center justify-center text-xs text-teal-700 dark:text-teal-300 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <span>{t.flashcards.rateBelow}</span>
                </div>
              </div>
            )}
          </div>

          {/* Mastery & Navigation */}
          <div className="w-full max-w-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setIsFlipped(false);
                setCurrentIdx((i) => Math.max(0, i - 1));
              }}
              disabled={currentIdx === 0}
              className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title={t.common.prev}
              aria-label={t.common.prev}
            >
              <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
              <button
                type="button"
                onClick={() => handleMastery(false)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                <span>{t.flashcards.needReview}</span>
              </button>

              <button
                type="button"
                onClick={() => handleMastery(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>{t.flashcards.masteredBtn}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsFlipped(false);
                setCurrentIdx((i) => Math.min(cards.length - 1, i + 1));
              }}
              disabled={currentIdx === cards.length - 1}
              className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              title={t.common.next}
              aria-label={t.common.next}
            >
              <ChevronRight className="w-5 h-5 rtl:rotate-180" />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 space-y-3">
          <Layers className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-600" />
          <div className="text-sm font-bold text-slate-900 dark:text-white">{t.flashcards.emptyTitle}</div>
          <p className="text-xs">{t.flashcards.emptySub}</p>
        </div>
      )}

      {/* Add Custom Card Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t.flashcards.modalTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomCard} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t.flashcards.frontInputLabel}
                </label>
                <input
                  type="text"
                  value={newFront}
                  onChange={(e) => setNewFront(e.target.value)}
                  placeholder={t.flashcards.frontPlaceholder}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t.flashcards.backInputLabel}
                </label>
                <textarea
                  value={newBack}
                  onChange={(e) => setNewBack(e.target.value)}
                  placeholder={t.flashcards.backPlaceholder}
                  rows={3}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  {t.flashcards.catInputLabel}
                </label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder={t.flashcards.catPlaceholder}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold cursor-pointer"
                >
                  {t.flashcards.saveCardBtn}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
