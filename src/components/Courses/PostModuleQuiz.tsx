import React, { useEffect, useState } from 'react';
import {
  X,
  Lock,
  Unlock,
  CheckCircle2,
  Clapperboard
} from 'lucide-react';
import { CourseModule } from '../../types';
import { CheckpointQuizConfig } from '../../data/checkpointQuizzes';
import { InteractiveQuiz, QuizResult } from './InteractiveQuiz';

interface PostModuleQuizProps {
  courseId: string;
  videoModule: CourseModule;
  moduleIndex: number;
  totalModules: number;
  quiz: CheckpointQuizConfig;
  nextModule?: CourseModule;
  previousResult?: QuizResult | null;
  allowRetakes?: boolean;
  onComplete: (result: QuizResult) => void;
  onUnlockAndContinue: () => void;
  onClose: () => void;
}

export const PostModuleQuiz: React.FC<PostModuleQuizProps> = ({
  courseId,
  videoModule,
  moduleIndex,
  totalModules,
  quiz,
  nextModule,
  previousResult,
  allowRetakes = true,
  onComplete,
  onUnlockAndContinue,
  onClose
}) => {
  const [latestResult, setLatestResult] = useState<QuizResult | null>(previousResult || null);

  useEffect(() => {
    setLatestResult(previousResult || null);
  }, [previousResult, quiz.id]);

  // Allow dismissing back to review the video lecture with Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isMastered = Boolean(latestResult?.passed || previousResult?.passed);
  const bestScore = Math.max(latestResult?.score ?? 0, previousResult?.score ?? 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-module-quiz-title"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 flex items-start justify-center"
    >
      <div className="w-full max-w-3xl my-4 sm:my-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Clapperboard className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
              <span>Video Lecture Completed</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Module {moduleIndex + 1} of {totalModules}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Required Mastery {quiz.passingScore}%</span>
            </div>
            <h2
              id="post-module-quiz-title"
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug"
            >
              Post-Module Mastery Quiz
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close post-module quiz and return to video lecture"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X className="w-3.5 h-3.5" />
            <span>Review Video</span>
          </button>
        </div>

        {/* Next-Segment Mastery Gate Banner */}
        <div
          className={`px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs ${
            isMastered
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isMastered ? (
              <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <p className="leading-snug">
              {isMastered ? (
                <>
                  <strong>Mastery verified ({bestScore}%):</strong>{' '}
                  {nextModule
                    ? `"${nextModule.title}" is now unlocked.`
                    : 'This video lecture module is complete.'}
                </>
              ) : (
                <>
                  <strong>Next segment locked:</strong>{' '}
                  {nextModule
                    ? `Pass this quiz (${quiz.passingScore}%+) to unlock "${nextModule.title}".`
                    : `Pass this quiz (${quiz.passingScore}%+) to complete this module.`}
                </>
              )}
            </p>
          </div>

          {isMastered && (
            <button
              type="button"
              onClick={onUnlockAndContinue}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{nextModule ? 'Continue to Next Segment' : 'Finish Module'}</span>
            </button>
          )}
        </div>

        {/* Embedded Interactive Mastery Assessment (Non-Skippable) */}
        <div className="p-4 sm:p-5">
          <InteractiveQuiz
            quizKey={`post-video:${courseId}:${videoModule.id}:${quiz.id}`}
            title={quiz.title}
            subtitle={quiz.subtitle}
            questions={quiz.questions}
            passingScore={quiz.passingScore}
            mode="module"
            allowModeToggle={true}
            requirePassToContinue={true}
            previousModuleTitle={videoModule.title}
            nextModuleTitle={nextModule?.title}
            continueLabel={
              nextModule
                ? `Unlock & Continue to Module ${moduleIndex + 2}`
                : 'Complete Lecture Module'
            }
            previousResult={previousResult || null}
            allowRetakes={allowRetakes}
            onComplete={(result) => {
              setLatestResult(result);
              onComplete(result);
            }}
            onContinue={onUnlockAndContinue}
            onBackToModule={onClose}
          />
        </div>
      </div>
    </div>
  );
};
