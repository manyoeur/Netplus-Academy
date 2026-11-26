import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  HelpCircle,
  LayoutGrid,
  Lightbulb,
  Plus,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  SquareStack,
  Trophy,
} from 'lucide-react';
import { CourseModule } from '../../types';
import {
  CardMasteryStatus,
  FlashcardCategory,
  FlashcardItem,
  PersonalFlashcard,
} from './flashcardTypes';

interface ModuleFlashcardDeckProps {
  userId: string;
  courseId: string;
  courseCode: string;
  module: CourseModule;
  isCompleted: boolean;
  canEdit?: boolean;
  personalModuleCards?: PersonalFlashcard[];
  onCompleteModule: () => void;
  onContinueNext?: () => void;
  nextModuleTitle?: string;
  onAddPersonalCard?: () => void;
  onStudyTimeTick?: (seconds: number) => void;
}

function getCategoryStyles(category: FlashcardCategory): string {
  switch (category) {
    case 'Port Number':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/70';
    case 'Protocol':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/70';
    case 'Architecture':
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/70';
    case 'Terminology':
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70';
  }
}

export const ModuleFlashcardDeck: React.FC<ModuleFlashcardDeckProps> = ({
  userId,
  courseId,
  courseCode,
  module,
  isCompleted,
  personalModuleCards = [],
  onCompleteModule,
  onContinueNext,
  nextModuleTitle,
  onAddPersonalCard,
  onStudyTimeTick,
}) => {
  const storageKey = `netpulse_mod_flashcards_v1_${userId}_${courseId}_${module.id}`;

  const [includePersonal, setIncludePersonal] = useState<boolean>(false);
  const [masteryMap, setMasteryMap] = useState<Record<string, CardMasteryStatus>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [shuffledOrder, setShuffledOrder] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [studyFilter, setStudyFilter] = useState<'all' | 'review'>('all');
  const [viewMode, setViewMode] = useState<'study' | 'list'>('study');
  const [revealAllInList, setRevealAllInList] = useState<boolean>(false);

  // Reload persisted mastery when switching module or user
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMasteryMap(parsed && typeof parsed === 'object' ? parsed : {});
      } else {
        setMasteryMap({});
      }
    } catch {
      setMasteryMap({});
    }
    setShuffledOrder([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
    setStudyFilter('all');
    setViewMode('study');
  }, [storageKey]);

  // Save mastery state
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(masteryMap));
    } catch {
      // Ignore quota issues
    }
  }, [masteryMap, storageKey]);

  const authoredCards: FlashcardItem[] = useMemo(
    () => module.flashcards?.cards || [],
    [module.flashcards?.cards]
  );

  const combinedBaseCards: FlashcardItem[] = useMemo(() => {
    const raw =
      includePersonal && personalModuleCards.length > 0
        ? [...authoredCards, ...personalModuleCards]
        : authoredCards;

    if (shuffledOrder.length === 0) return raw;
    const posMap = new Map(shuffledOrder.map((id, i) => [id, i]));
    return [...raw].sort(
      (a, b) =>
        (posMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (posMap.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
  }, [authoredCards, personalModuleCards, includePersonal, shuffledOrder]);

  const stats = useMemo(() => {
    let mastered = 0;
    let review = 0;
    for (const card of combinedBaseCards) {
      const st = masteryMap[card.id] || 'unreviewed';
      if (st === 'mastered') mastered += 1;
      else if (st === 'review') review += 1;
    }
    const total = combinedBaseCards.length;
    const masteryPct = total > 0 ? Math.round((mastered / total) * 100) : 0;
    return { total, mastered, review, masteryPct };
  }, [combinedBaseCards, masteryMap]);

  const visibleCards = useMemo(() => {
    if (studyFilter === 'review') {
      const flagged = combinedBaseCards.filter((c) => masteryMap[c.id] === 'review');
      return flagged.length > 0 ? flagged : combinedBaseCards;
    }
    return combinedBaseCards;
  }, [combinedBaseCards, masteryMap, studyFilter]);

  useEffect(() => {
    if (currentIndex >= visibleCards.length && visibleCards.length > 0) {
      setCurrentIndex(0);
      setIsFlipped(false);
      setShowHint(false);
    }
  }, [visibleCards.length, currentIndex]);

  const activeCard = visibleCards[currentIndex] || null;
  const activeStatus: CardMasteryStatus = activeCard
    ? masteryMap[activeCard.id] || 'unreviewed'
    : 'unreviewed';

  const hasHintData = Boolean(activeCard?.osiLayer || activeCard?.transportProtocol);

  const goToIndex = useCallback(
    (nextIdx: number) => {
      if (visibleCards.length === 0) return;
      const wrapped = ((nextIdx % visibleCards.length) + visibleCards.length) % visibleCards.length;
      setCurrentIndex(wrapped);
      setIsFlipped(false);
      setShowHint(false);
    },
    [visibleCards.length]
  );

  const handleMarkCard = useCallback(
    (status: CardMasteryStatus) => {
      if (!activeCard) return;
      const nextMap = { ...masteryMap, [activeCard.id]: status };
      setMasteryMap(nextMap);
      onStudyTimeTick?.(15);

      const allAuthoredMastered =
        authoredCards.length > 0 &&
        authoredCards.every((c) => nextMap[c.id] === 'mastered');
      if (allAuthoredMastered && !isCompleted) {
        onCompleteModule();
      }

      if (visibleCards.length > 1) {
        goToIndex(currentIndex + 1);
      } else {
        setIsFlipped(false);
      }
    },
    [
      activeCard,
      masteryMap,
      authoredCards,
      isCompleted,
      onCompleteModule,
      onStudyTimeTick,
      visibleCards.length,
      goToIndex,
      currentIndex,
    ]
  );

  const handleShuffle = () => {
    const ids = combinedBaseCards.map((c) => c.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setShuffledOrder(ids);
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  const handleResetMastery = () => {
    setMasteryMap({});
    setStudyFilter('all');
    setCurrentIndex(0);
    setIsFlipped(false);
    setShowHint(false);
  };

  if (authoredCards.length === 0 && personalModuleCards.length === 0) {
    return (
      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
          <SquareStack className="w-6 h-6" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No flashcards in this review deck yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Add cards to this deck from Course Manager → Drag &amp; Drop Module Builder, or create your own personal review card below.
          </p>
        </div>
        {onAddPersonalCard && (
          <button
            type="button"
            onClick={onAddPersonalCard}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Personal Flashcard</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Deck Summary & Mastery Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-[11px] font-bold">
                <SquareStack className="w-3.5 h-3.5" />
                Flashcards Review
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {stats.total} {stats.total === 1 ? 'card' : 'cards'}
              </span>
              {isCompleted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Completed
                </span>
              )}
            </div>
            {(module.flashcards?.deckTitle || module.flashcards?.summary) && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {module.flashcards?.deckTitle && (
                  <strong className="text-slate-700 dark:text-slate-200 mr-1.5">
                    {module.flashcards.deckTitle}:
                  </strong>
                )}
                {module.flashcards?.summary}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Mastery Telemetry */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs tabular-nums">
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {stats.mastered}
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <RotateCcw className="w-3 h-3" />
                {stats.review}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {stats.masteryPct}%
              </span>
            </div>

            {personalModuleCards.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIncludePersonal((prev) => !prev);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                  includePersonal
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-cyan-500 text-blue-700 dark:text-cyan-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                + My Notes ({personalModuleCards.length})
              </button>
            )}

            {/* View Mode Toggle */}
            <div className="inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('study')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'study'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <SquareStack className="w-3.5 h-3.5" />
                <span>Study</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>All Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mastery Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${stats.masteryPct}%` }}
          />
        </div>
      </div>

      {/* Mastery Complete Banner */}
      {stats.total > 0 && stats.mastered === stats.total && (
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                Review Complete! {stats.total} / {stats.total} cards mastered
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Reset mastery to drill again or continue to the next module.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetMastery}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100/50 transition-colors"
            >
              Drill Again
            </button>
            {onContinueNext && (
              <button
                type="button"
                onClick={onContinueNext}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <span>{nextModuleTitle ? `Continue to ${nextModuleTitle}` : 'Continue'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* STUDY MODE */}
      {viewMode === 'study' && activeCard && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
              <button
                type="button"
                onClick={() => {
                  setStudyFilter('all');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  studyFilter === 'all'
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                All ({combinedBaseCards.length})
              </button>
              <button
                type="button"
                disabled={stats.review === 0}
                onClick={() => {
                  setStudyFilter('review');
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-45 ${
                  studyFilter === 'review'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-800'
                }`}
              >
                Needs Review ({stats.review})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShuffle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle</span>
              </button>
              <button
                type="button"
                onClick={handleResetMastery}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Card Counter */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="font-mono font-bold tabular-nums">
              {courseCode} · Card {currentIndex + 1} of {visibleCards.length}
            </span>
            <span className="hidden sm:inline font-mono text-[11px]">
              Click card or press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">Space</kbd> to flip
            </span>
          </div>

          {/* Interactive 3D Flip Card */}
          <div
            role="button"
            tabIndex={0}
            aria-label={
              isFlipped
                ? 'Flashcard answer side. Click or press Space to view question.'
                : 'Flashcard question side. Click or press Space to reveal answer.'
            }
            onClick={() => setIsFlipped((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                setIsFlipped((prev) => !prev);
              }
            }}
            className="perspective-[1400px] cursor-pointer select-none focus:outline-none group"
          >
            <div
              className={`grid grid-cols-1 transform-3d transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                isFlipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* FRONT FACE */}
              <div className="col-start-1 row-start-1 backface-hidden rounded-3xl bg-white dark:bg-[#0d1526] border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-black/40 p-6 sm:p-8 min-h-[290px] flex flex-col justify-between group-hover:border-blue-300 dark:group-hover:border-cyan-700/80 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${getCategoryStyles(
                        activeCard.category
                      )}`}
                    >
                      {activeCard.category}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Question
                    </span>
                  </div>

                  {activeStatus !== 'unreviewed' && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        activeStatus === 'mastered'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                      }`}
                    >
                      {activeStatus === 'mastered' ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mastered
                        </>
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          Needs Review
                        </>
                      )}
                    </span>
                  )}
                </div>

                <div className="py-5 text-center space-y-3">
                  <p className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white leading-snug">
                    {activeCard.question}
                  </p>

                  {showHint && hasHintData && (
                    <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-200">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold">
                        Clue:
                        {activeCard.osiLayer ? ` ${activeCard.osiLayer}` : ''}
                        {activeCard.osiLayer && activeCard.transportProtocol ? ' •' : ''}
                        {activeCard.transportProtocol ? ` Transport: ${activeCard.transportProtocol}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-400 dark:text-slate-500">
                  {hasHintData ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint((prev) => !prev);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {showHint ? 'Hide Clue' : 'Show Clue'}
                    </button>
                  ) : (
                    <span />
                  )}
                  <span className="font-semibold text-blue-600 dark:text-cyan-400">
                    Tap card to reveal answer →
                  </span>
                </div>
              </div>

              {/* BACK FACE */}
              <div className="col-start-1 row-start-1 backface-hidden rotate-y-180 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0f172a] to-[#0a1328] dark:from-[#0f172a] dark:via-[#0b1222] dark:to-[#070d1a] text-white border border-slate-800 dark:border-cyan-900/50 shadow-xl p-6 sm:p-8 min-h-[290px] flex flex-col justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Answer · {activeCard.term}
                  </span>
                  {activeCard.portNumber && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold tabular-nums bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      Port {activeCard.portNumber}
                    </span>
                  )}
                  {activeCard.transportProtocol && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                      {activeCard.transportProtocol}
                    </span>
                  )}
                  {activeCard.osiLayer && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/10 text-slate-200 border border-white/10">
                      {activeCard.osiLayer}
                    </span>
                  )}
                </div>

                <div className="py-4 space-y-3">
                  <p className="text-lg sm:text-2xl font-extrabold text-white leading-snug">
                    {activeCard.answer}
                  </p>

                  {activeCard.explanation && (
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {activeCard.explanation}
                    </p>
                  )}

                  {activeCard.memoryTip && (
                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-2.5">
                      <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div className="text-xs text-slate-200 leading-relaxed">
                        <span className="font-bold text-amber-300">Memory Tip: </span>
                        {activeCard.memoryTip}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-slate-400">
                  <span>Self-grade below to track mastery</span>
                  <span className="font-semibold text-cyan-300">
                    ← Tap card to view question
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Grading & Navigation Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => goToIndex(currentIndex - 1)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            <button
              type="button"
              onClick={() => handleMarkCard('review')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Need Review</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFlipped((prev) => !prev)}
              className="col-span-2 sm:col-span-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors"
            >
              {isFlipped ? 'Show Question' : 'Flip Card'}
            </button>

            <button
              type="button"
              onClick={() => handleMarkCard('mastered')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Mastered</span>
            </button>

            <button
              type="button"
              onClick={() => goToIndex(currentIndex + 1)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Dot Navigator */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {visibleCards.map((card, idx) => {
              const st = masteryMap[card.id] || 'unreviewed';
              const isCurrent = idx === currentIndex;
              const dotCls =
                st === 'mastered'
                  ? 'bg-emerald-500'
                  : st === 'review'
                  ? 'bg-amber-500'
                  : 'bg-slate-300 dark:bg-slate-700';

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => goToIndex(idx)}
                  aria-label={`Jump to card ${idx + 1}: ${card.term}`}
                  title={`${idx + 1}. ${card.term}`}
                  className={`h-2.5 rounded-full transition-all ${dotCls} ${
                    isCurrent
                      ? 'w-7 ring-2 ring-blue-500/40 dark:ring-cyan-400/50'
                      : 'w-2.5 opacity-70 hover:opacity-100'
                  }`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ALL CARDS OVERVIEW MODE */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing {combinedBaseCards.length} flashcards in this module
            </span>
            <button
              type="button"
              onClick={() => setRevealAllInList((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {revealAllInList ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Hide Answers</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Reveal All Answers</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {combinedBaseCards.map((card, idx) => {
              const st = masteryMap[card.id] || 'unreviewed';
              return (
                <div
                  key={card.id}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryStyles(
                          card.category
                        )}`}
                      >
                        {card.category}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                        #{idx + 1} · {card.term}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                      {card.question}
                    </p>
                    {revealAllInList && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                        <p className="text-xs font-bold text-blue-600 dark:text-cyan-400">
                          {card.answer}
                        </p>
                        {card.explanation && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            {card.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setMasteryMap((prev) => ({ ...prev, [card.id]: 'review' }))
                        }
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                          st === 'review'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-50'
                        }`}
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...masteryMap, [card.id]: 'mastered' as const };
                          setMasteryMap(next);
                          if (
                            authoredCards.length > 0 &&
                            authoredCards.every((c) => next[c.id] === 'mastered') &&
                            !isCompleted
                          ) {
                            onCompleteModule();
                          }
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                          st === 'mastered'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50'
                        }`}
                      >
                        Mastered
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStudyFilter('all');
                        setCurrentIndex(idx);
                        setIsFlipped(false);
                        setViewMode('study');
                      }}
                      className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                    >
                      Open Card →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Explicit Module Completion Footer */}
      {!isCompleted && (
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Finished reviewing this deck? Mark this flashcard module complete to update your course progress.
          </p>
          <button
            type="button"
            onClick={onCompleteModule}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark Review Complete</span>
          </button>
        </div>
      )}
    </div>
  );
};
