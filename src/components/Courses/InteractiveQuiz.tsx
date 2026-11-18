import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Award,
  BookOpen,
  SkipForward,
  CheckSquare,
  Lock
} from 'lucide-react';
import { QuizQuestion } from '../../types';

export interface QuizResult {
  score: number;
  correctCount: number;
  totalCount: number;
  passed: boolean;
  answers: Record<string, number>;
  completedAt: string;
}

interface InteractiveQuizProps {
  quizKey: string;
  title: string;
  subtitle?: string;
  questions: QuizQuestion[];
  passingScore: number;
  mode?: 'checkpoint' | 'module' | 'quiz-mode';
  allowModeToggle?: boolean;
  defaultFeedbackMode?: 'immediate' | 'exam';
  nextModuleTitle?: string;
  previousModuleTitle?: string;
  continueLabel?: string;
  previousResult?: QuizResult | null;
  allowRetakes?: boolean;
  onProgressChange?: (progress: { answeredCount: number; totalCount: number; percent: number }) => void;
  onComplete?: (result: QuizResult) => void;
  onContinue?: () => void;
  onSkip?: () => void;
  onBackToModule?: () => void;
  requirePassToContinue?: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const InteractiveQuiz: React.FC<InteractiveQuizProps> = ({
  quizKey,
  title,
  subtitle,
  questions,
  passingScore,
  mode = 'checkpoint',
  allowModeToggle = false,
  defaultFeedbackMode = 'immediate',
  nextModuleTitle,
  previousModuleTitle,
  continueLabel,
  previousResult,
  allowRetakes = true,
  onProgressChange,
  onComplete,
  onContinue,
  onSkip,
  onBackToModule,
  requirePassToContinue = false
}) => {
  const [feedbackMode, setFeedbackMode] = useState<'immediate' | 'exam'>(defaultFeedbackMode);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [isExamSubmitted, setIsExamSubmitted] = useState<boolean>(false);
  const completedAttemptRef = useRef<boolean>(false);

  // Reset internal state cleanly whenever the quiz target changes
  useEffect(() => {
    setAnswers({});
    setActiveIndex(0);
    setShowSummary(false);
    setIsExamSubmitted(false);
    completedAttemptRef.current = false;
  }, [quizKey]);

  const totalCount = questions.length;

  const metrics = useMemo(() => {
    let answeredCount = 0;
    let correctCount = 0;

    questions.forEach(q => {
      const picked = answers[q.id];
      if (typeof picked === 'number') {
        answeredCount += 1;
        if (picked === q.correctAnswerIndex) {
          correctCount += 1;
        }
      }
    });

    const overallScore = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const accuracySoFar = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
    const completionPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;
    const allAnswered = totalCount > 0 && answeredCount === totalCount;
    const passed = overallScore >= passingScore;

    return {
      answeredCount,
      correctCount,
      overallScore,
      accuracySoFar,
      completionPercent,
      allAnswered,
      passed
    };
  }, [answers, passingScore, questions, totalCount]);

  // Report live question completion progress to parent container (e.g., CoursePlayer Quiz Mode)
  useEffect(() => {
    onProgressChange?.({
      answeredCount: metrics.answeredCount,
      totalCount,
      percent: metrics.completionPercent
    });
  }, [metrics.answeredCount, metrics.completionPercent, onProgressChange, totalCount]);

  // In immediate mode, fire completion callback automatically once all questions are answered
  useEffect(() => {
    if (feedbackMode === 'immediate' && metrics.allAnswered && !completedAttemptRef.current) {
      completedAttemptRef.current = true;
      onComplete?.({
        score: metrics.overallScore,
        correctCount: metrics.correctCount,
        totalCount,
        passed: metrics.passed,
        answers,
        completedAt: new Date().toISOString()
      });
    }
  }, [
    answers,
    feedbackMode,
    metrics.allAnswered,
    metrics.correctCount,
    metrics.overallScore,
    metrics.passed,
    onComplete,
    totalCount
  ]);

  if (totalCount === 0) {
    return null;
  }

  const currentQuestion = questions[activeIndex] || questions[0];
  const selectedForCurrent = answers[currentQuestion.id];
  const isCurrentAnswered = typeof selectedForCurrent === 'number';
  const shouldRevealCurrent =
    isCurrentAnswered && (feedbackMode === 'immediate' || isExamSubmitted);
  const isCurrentCorrect =
    shouldRevealCurrent && selectedForCurrent === currentQuestion.correctAnswerIndex;

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (feedbackMode === 'immediate') {
      // Immediate feedback locks the question so the learner reviews the result right away
      if (typeof answers[questionId] === 'number') return;
    } else if (isExamSubmitted) {
      return;
    }
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSwitchFeedbackMode = (nextMode: 'immediate' | 'exam') => {
    if (nextMode === feedbackMode) return;
    setFeedbackMode(nextMode);
    setAnswers({});
    setActiveIndex(0);
    setShowSummary(false);
    setIsExamSubmitted(false);
    completedAttemptRef.current = false;
  };

  const handleSubmitExam = () => {
    if (!metrics.allAnswered) return;
    setIsExamSubmitted(true);
    setShowSummary(true);
    if (!completedAttemptRef.current) {
      completedAttemptRef.current = true;
      onComplete?.({
        score: metrics.overallScore,
        correctCount: metrics.correctCount,
        totalCount,
        passed: metrics.passed,
        answers,
        completedAt: new Date().toISOString()
      });
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setActiveIndex(0);
    setShowSummary(false);
    setIsExamSubmitted(false);
    completedAttemptRef.current = false;
  };

  const handleNextStep = () => {
    if (activeIndex < totalCount - 1) {
      setActiveIndex(prev => prev + 1);
    } else if (feedbackMode === 'exam' && !isExamSubmitted) {
      handleSubmitExam();
    } else {
      setShowSummary(true);
    }
  };

  const handlePrevStep = () => {
    if (showSummary) {
      setShowSummary(false);
      setActiveIndex(totalCount - 1);
      return;
    }
    if (activeIndex > 0) {
      setActiveIndex(prev => prev - 1);
    }
  };

  return (
    <section
      aria-label={title}
      className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      {/* Top Quiz Header & Live Score Strip */}
      <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-blue-600 dark:text-cyan-400 font-semibold">
              <CheckSquare className="w-3.5 h-3.5 shrink-0" />
              <span>
                {mode === 'quiz-mode'
                  ? 'Module Quiz Mode'
                  : mode === 'checkpoint'
                  ? 'Between-Module Retention Check'
                  : 'Module Assessment'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="tabular-nums text-slate-600 dark:text-slate-400">
                Pass {passingScore}%
              </span>
              {previousResult && !(feedbackMode === 'immediate' ? metrics.allAnswered : isExamSubmitted) && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span
                    className={`tabular-nums ${
                      previousResult.passed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    Best score {previousResult.score}% ({previousResult.passed ? 'Passed' : 'Retry'})
                  </span>
                </>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
            {allowModeToggle && (
              <div
                role="group"
                aria-label="Quiz feedback mode"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  onClick={() => handleSwitchFeedbackMode('immediate')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    feedbackMode === 'immediate'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Instant Feedback
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchFeedbackMode('exam')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    feedbackMode === 'exam'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Exam Check
                </button>
              </div>
            )}

            {/* Live Scoreboard Readout */}
            <div className="flex items-center gap-4 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shrink-0 tabular-nums">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
                  {feedbackMode === 'exam' && !isExamSubmitted ? 'Exam Score' : 'Live Score'}
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white">
                  {feedbackMode === 'exam' && !isExamSubmitted
                    ? 'Pending'
                    : metrics.answeredCount > 0
                    ? `${metrics.overallScore}%`
                    : '0%'}
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
                  Correct
                </div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {feedbackMode === 'exam' && !isExamSubmitted
                    ? `—/${totalCount}`
                    : `${metrics.correctCount}/${totalCount}`}
                </div>
              </div>
              <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <div className="text-[10px] uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
                  Answered
                </div>
                <div className="text-sm font-bold text-blue-600 dark:text-cyan-400">
                  {metrics.answeredCount}/{totalCount}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Completion Progress Tracker */}
        <div className="p-3 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Question Progress:{' '}
              <strong className="text-slate-900 dark:text-white">
                {metrics.answeredCount} of {totalCount}
              </strong>{' '}
              completed
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">
                {metrics.allAnswered
                  ? 'All questions completed'
                  : `${totalCount - metrics.answeredCount} remaining`}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
              <span
                className={`font-bold ${
                  metrics.allAnswered
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-blue-600 dark:text-cyan-400'
                }`}
              >
                {metrics.completionPercent}%
              </span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={metrics.answeredCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label={`Quiz progress: ${metrics.answeredCount} of ${totalCount} questions completed`}
            className="h-2 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden"
          >
            <div
              className={`h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none ${
                metrics.allAnswered
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-400'
              }`}
              style={{ width: `${metrics.completionPercent}%` }}
            />
          </div>
        </div>

        {/* Question Stepper / Retention Progress Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {questions.map((q, idx) => {
            const picked = answers[q.id];
            const answered = typeof picked === 'number';
            const revealed = answered && (feedbackMode === 'immediate' || isExamSubmitted);
            const correct = revealed && picked === q.correctAnswerIndex;
            const isCurrent = !showSummary && idx === activeIndex;

            let stepStyle =
              'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-cyan-500';

            if (revealed) {
              stepStyle = correct
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300';
            } else if (answered) {
              stepStyle =
                'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-cyan-700 text-blue-800 dark:text-cyan-200';
            }

            if (isCurrent) {
              stepStyle += ' ring-2 ring-blue-500/30 dark:ring-cyan-400/30 border-blue-600 dark:border-cyan-400 font-bold';
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => {
                  setShowSummary(false);
                  setActiveIndex(idx);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono tabular-nums transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${stepStyle}`}
              >
                {revealed ? (
                  correct ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                  )
                ) : null}
                <span>Q{idx + 1}</span>
              </button>
            );
          })}

          {(feedbackMode === 'immediate' ? metrics.allAnswered : isExamSubmitted) && (
            <button
              type="button"
              onClick={() => setShowSummary(true)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                showSummary
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500'
              }`}
            >
              <Award className="w-3.5 h-3.5 shrink-0" />
              <span>Score Summary</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Quiz Body: Active Question OR Summary View */}
      {!showSummary ? (
        <div className="p-5 sm:p-6 space-y-5">
          {/* Question Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>
                Question {activeIndex + 1} of {totalCount}
              </span>
              {shouldRevealCurrent ? (
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    isCurrentCorrect
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {isCurrentCorrect ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Answered · Correct</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Answered · Incorrect</span>
                    </>
                  )}
                </span>
              ) : isCurrentAnswered ? (
                <span className="font-semibold text-blue-600 dark:text-cyan-400">
                  Selection recorded · Submit at end to grade
                </span>
              ) : (
                <span>
                  {feedbackMode === 'exam'
                    ? 'Select an option (you can change answers before submitting)'
                    : 'Select an answer for immediate feedback'}
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {currentQuestion.question}
            </h3>
          </div>

          {/* Options List */}
          <div className="space-y-2.5" role="radiogroup" aria-label={currentQuestion.question}>
            {currentQuestion.options.map((option, optIdx) => {
              const isSelected = selectedForCurrent === optIdx;
              const isRightOption = optIdx === currentQuestion.correctAnswerIndex;
              const letter = OPTION_LETTERS[optIdx] || String(optIdx + 1);
              const lockOption =
                feedbackMode === 'immediate' ? isCurrentAnswered : isExamSubmitted;

              let containerClass =
                'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500 dark:hover:border-cyan-400 hover:bg-slate-50 dark:hover:bg-slate-800/70';
              let badgeClass =
                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';

              if (shouldRevealCurrent) {
                if (isRightOption) {
                  containerClass =
                    'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-600 text-emerald-950 dark:text-emerald-100';
                  badgeClass =
                    'bg-emerald-600 text-white border-emerald-600';
                } else if (isSelected) {
                  containerClass =
                    'bg-red-50 dark:bg-red-950/40 border-red-500 dark:border-red-600 text-red-950 dark:text-red-100';
                  badgeClass =
                    'bg-red-600 text-white border-red-600';
                } else {
                  containerClass =
                    'bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-75';
                }
              } else if (isSelected) {
                containerClass =
                  'bg-blue-50/90 dark:bg-blue-950/40 border-blue-600 dark:border-cyan-400 text-blue-950 dark:text-cyan-50';
                badgeClass =
                  'bg-blue-600 dark:bg-cyan-500 text-white border-blue-600 dark:border-cyan-500';
              }

              return (
                <button
                  key={optIdx}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={lockOption}
                  onClick={() => handleSelectOption(currentQuestion.id, optIdx)}
                  className={`w-full min-h-[44px] p-3 rounded-xl border text-left transition-colors duration-150 motion-reduce:transition-none flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    lockOption ? 'cursor-default' : 'cursor-pointer'
                  } ${containerClass}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono text-xs font-bold shrink-0 ${badgeClass}`}
                    >
                      {letter}
                    </span>
                    <span className="text-xs sm:text-sm leading-snug">{option}</span>
                  </div>

                  {shouldRevealCurrent && isRightOption && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{isSelected ? 'Correct' : 'Correct Answer'}</span>
                    </span>
                  )}

                  {shouldRevealCurrent && isSelected && !isRightOption && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-300 whitespace-nowrap shrink-0">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>Incorrect</span>
                    </span>
                  )}

                  {!shouldRevealCurrent && isSelected && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-cyan-300 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Selected</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Immediate Feedback & Explanation Callout */}
          {shouldRevealCurrent && (
            <div
              role="status"
              aria-live="polite"
              className={`p-4 rounded-xl border space-y-1.5 ${
                isCurrentCorrect
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                  : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                {isCurrentCorrect ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Spot on — concept verified</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                    <span>
                      Not quite — the correct option is{' '}
                      {OPTION_LETTERS[currentQuestion.correctAnswerIndex]}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {currentQuestion.explanation}
              </p>
            </div>
          )}

          {/* Question Footer Navigation */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevStep}
                disabled={activeIndex === 0}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev Question</span>
              </button>

              {onBackToModule && (
                <button
                  type="button"
                  onClick={onBackToModule}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{previousModuleTitle ? 'Review Module' : 'Back to Study Mode'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {onSkip && !(feedbackMode === 'immediate' ? metrics.allAnswered : isExamSubmitted) && (
                <button
                  type="button"
                  onClick={onSkip}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Skip Check</span>
                </button>
              )}

              {activeIndex < totalCount - 1 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!isCurrentAnswered}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <span>Next Question</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : feedbackMode === 'exam' && !isExamSubmitted ? (
                <button
                  type="button"
                  onClick={handleSubmitExam}
                  disabled={!metrics.allAnswered}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Submit &amp; Grade Quiz</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!metrics.allAnswered}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>View Score Summary</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Score Summary & Review Screen */
        <div className="p-5 sm:p-6 space-y-5">
          {/* Score Result Banner */}
          <div
            className={`p-5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              metrics.passed
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2.5 rounded-xl border shrink-0 ${
                  metrics.passed
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-100 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                }`}
              >
                {metrics.passed ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span
                    className={
                      metrics.passed
                        ? 'text-emerald-800 dark:text-emerald-200'
                        : 'text-amber-900 dark:text-amber-200'
                    }
                  >
                    {metrics.passed ? 'Retention Benchmark Met · Passed' : `Below ${passingScore}% Benchmark · Review Recommended`}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                  You answered <strong>{metrics.correctCount}</strong> of{' '}
                  <strong>{totalCount}</strong> questions correctly ({metrics.overallScore}%).
                  {!metrics.passed && ' Retake the check or review the explanations below before moving on.'}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 tabular-nums">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Final Score
              </div>
              <div
                className={`text-3xl font-extrabold ${
                  metrics.passed
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {metrics.overallScore}%
              </div>
            </div>
          </div>

          {/* Per-Question Breakdown */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400">
              Question Breakdown
            </h4>
            <div className="space-y-2">
              {questions.map((q, idx) => {
                const picked = answers[q.id];
                const correct = picked === q.correctAnswerIndex;
                return (
                  <div
                    key={q.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {idx + 1}. {q.question}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                          correct
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {correct ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Correct</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Incorrect</span>
                          </>
                        )}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-800 dark:text-slate-200">Answer:</strong>{' '}
                      {q.options[q.correctAnswerIndex]}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {q.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            {requirePassToContinue && !metrics.passed && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200"
              >
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  Mastery gate locked: score at least <strong className="tabular-nums">{passingScore}%</strong> to unlock{' '}
                  <strong>{nextModuleTitle || 'the next segment'}</strong>.
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {allowRetakes && (
                  <button
                    type="button"
                    onClick={handleRetake}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors duration-150 ${
                      requirePassToContinue && !metrics.passed
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{requirePassToContinue && !metrics.passed ? 'Retake Quiz to Unlock' : 'Retake Quiz'}</span>
                  </button>
                )}

                {onBackToModule && (
                  <button
                    type="button"
                    onClick={onBackToModule}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Back to Module</span>
                  </button>
                )}
              </div>

              {onContinue && (!requirePassToContinue || metrics.passed || previousResult?.passed) && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <span>
                    {continueLabel
                      ? continueLabel
                      : nextModuleTitle
                      ? `Continue to ${nextModuleTitle}`
                      : 'Continue'}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
