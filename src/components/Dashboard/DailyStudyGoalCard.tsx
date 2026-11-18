import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Pencil,
  Sparkles,
  Target,
  Terminal,
  X,
} from 'lucide-react';
import {
  ComputedDailyStudyGoal,
  DAILY_GOAL_PRESETS,
  MAX_DAILY_GOAL_MINUTES,
  MIN_DAILY_GOAL_MINUTES,
  clampGoalMinutes,
  formatStudyDuration,
} from '../../utils/studyGoal';

interface DailyStudyGoalCardProps {
  goal: ComputedDailyStudyGoal;
  onUpdateGoalMinutes: (minutes: number) => void;
  onContinueCourse?: () => void;
  onOpenLab: () => void;
  hasEnrolledCourses: boolean;
}

export const DailyStudyGoalCard: React.FC<DailyStudyGoalCardProps> = ({
  goal,
  onUpdateGoalMinutes,
  onContinueCourse,
  onOpenLab,
  hasEnrolledCourses,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState<string>(String(goal.dailyGoalMinutes));

  const size = 152;
  const center = size / 2;
  const outerRadius = 66;
  const innerRadius = 50;

  const { trackPath, progressPath } = useMemo(() => {
    const angleScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([0, 2 * Math.PI])
      .clamp(true);

    const trackGen = d3
      .arc<unknown>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .endAngle(2 * Math.PI);

    const progressGen = d3
      .arc<unknown>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(0)
      .endAngle(angleScale(goal.progressPercent))
      .cornerRadius((outerRadius - innerRadius) / 2);

    return {
      trackPath: trackGen({}) || '',
      progressPath: goal.progressPercent > 0 ? progressGen({}) || '' : '',
    };
  }, [goal.progressPercent]);

  const handleOpenEditor = () => {
    setDraftMinutes(String(goal.dailyGoalMinutes));
    setIsEditing(true);
  };

  const handleSaveGoal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = Number(draftMinutes);
    onUpdateGoalMinutes(clampGoalMinutes(parsed));
    setIsEditing(false);
  };

  const statusMeta = goal.goalReached
    ? {
        label: 'Goal Reached',
        classes:
          'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70',
      }
    : goal.progressPercent >= 65
    ? {
        label: 'Almost There',
        classes:
          'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/70',
      }
    : goal.totalSecondsToday > 0
    ? {
        label: 'In Progress',
        classes:
          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/70',
      }
    : {
        label: 'Ready to Start',
        classes:
          'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      };

  return (
    <section
      aria-label="Daily Study Goal progress"
      className="rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6"
    >
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Left: D3 Radial Progress Bar */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`Daily study goal: ${goal.progressPercent}% (${formatStudyDuration(
              goal.totalSecondsToday
            )} of ${goal.dailyGoalMinutes} minutes)`}
            className="overflow-visible"
          >
            <defs>
              <linearGradient id="daily-goal-grad-active" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
              <linearGradient id="daily-goal-grad-done" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#14b8a6" />
              </linearGradient>
            </defs>

            <g transform={`translate(${center}, ${center})`}>
              <path d={trackPath} className="fill-slate-200/90 dark:fill-slate-800" />
              {progressPath && (
                <path
                  d={progressPath}
                  fill={
                    goal.goalReached
                      ? 'url(#daily-goal-grad-done)'
                      : 'url(#daily-goal-grad-active)'
                  }
                />
              )}
            </g>
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
            <span className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white leading-none">
              {goal.progressPercent}%
            </span>
            <span className="text-[11px] font-mono font-semibold tabular-nums text-slate-500 dark:text-slate-400 mt-1.5">
              {formatStudyDuration(goal.totalSecondsToday)} / {goal.dailyGoalMinutes}m
            </span>
          </div>
        </div>

        {/* Right: Goal Details, Inline Editor & Breakdown */}
        <div className="flex-1 w-full min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Target className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Daily Study Goal
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${statusMeta.classes}`}
                >
                  {goal.goalReached && <CheckCircle2 className="w-3 h-3" />}
                  {statusMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {goal.goalReached ? (
                  <>
                    You met your <strong className="text-slate-700 dark:text-slate-200">{goal.dailyGoalMinutes}-minute</strong> goal today
                    {goal.bonusSeconds >= 60 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {' '}
                        (+{formatStudyDuration(goal.bonusSeconds)} bonus study)
                      </span>
                    )}
                    .
                  </>
                ) : (
                  <>
                    Target: <strong className="text-slate-700 dark:text-slate-200 tabular-nums">{goal.dailyGoalMinutes} min/day</strong> ·{' '}
                    <span className="tabular-nums font-medium text-blue-600 dark:text-cyan-400">
                      {formatStudyDuration(goal.remainingSeconds)} remaining
                    </span>{' '}
                    as you study courses, labs, or flashcards.
                  </>
                )}
              </p>
            </div>

            {!isEditing && (
              <button
                type="button"
                onClick={handleOpenEditor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                Set Goal ({goal.dailyGoalMinutes}m)
              </button>
            )}
          </div>

          {/* Inline Goal Editor */}
          {isEditing && (
            <form
              onSubmit={handleSaveGoal}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Choose Daily Target (Minutes)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DAILY_GOAL_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDraftMinutes(String(preset));
                        onUpdateGoalMinutes(preset);
                        setIsEditing(false);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold tabular-nums border transition-colors ${
                        goal.dailyGoalMinutes === preset
                          ? 'bg-blue-600 text-white border-blue-600 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {preset}m
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="daily-study-goal-minutes" className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Custom:
                </label>
                <input
                  id="daily-study-goal-minutes"
                  type="number"
                  min={MIN_DAILY_GOAL_MINUTES}
                  max={MAX_DAILY_GOAL_MINUTES}
                  value={draftMinutes}
                  onChange={(e) => setDraftMinutes(e.target.value)}
                  className="w-24 px-3 py-1.5 rounded-lg text-xs font-mono tabular-nums bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  min ({MIN_DAILY_GOAL_MINUTES}–{MAX_DAILY_GOAL_MINUTES})
                </span>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save Goal
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Study Activity Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                  Course Content
                </span>
              </div>
              <span className="text-xs font-mono font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                {formatStudyDuration(goal.courseSeconds)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Terminal className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                  Lab Simulator
                </span>
              </div>
              <span className="text-xs font-mono font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                {formatStudyDuration(goal.labSeconds)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
                  Flashcards &amp; Tools
                </span>
              </div>
              <span className="text-xs font-mono font-bold tabular-nums text-slate-900 dark:text-white shrink-0">
                {formatStudyDuration(goal.practiceSeconds)}
              </span>
            </div>
          </div>

          {/* Quick Study Shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Updates automatically while interacting with courses, labs, and flashcards.
            </span>

            <div className="flex items-center gap-2 shrink-0">
              {hasEnrolledCourses && onContinueCourse && (
                <button
                  type="button"
                  onClick={onContinueCourse}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Study Course
                </button>
              )}
              <button
                type="button"
                onClick={onOpenLab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                Open Lab Sim
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
