import React, { useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  ShieldCheck,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { ComputedLearningStreak, StreakBadgeTier } from '../../utils/learningStreak';
import { formatStudyDuration } from '../../utils/studyGoal';

interface DailyStreakCardProps {
  streak: ComputedLearningStreak;
  todayStudySeconds?: number;
  onLogTodayStudy: () => void;
}

const ACHIEVEMENT_MILESTONES: {
  id: string;
  title: string;
  minDays: number;
  tone: StreakBadgeTier['tone'];
}[] = [
  { id: 'link-up', title: 'Link Up', minDays: 1, tone: 'emerald' },
  { id: 'three-day-sync', title: '3-Day Sync', minDays: 3, tone: 'blue' },
  { id: 'weeklong-uptime', title: 'Weeklong Uptime', minDays: 7, tone: 'violet' },
  { id: 'core-router', title: 'Core Router', minDays: 14, tone: 'amber' },
  { id: 'five-nines', title: 'Five-Nines Legend', minDays: 30, tone: 'gold' },
];

function getBadgeToneClasses(tone: StreakBadgeTier['tone']): string {
  switch (tone) {
    case 'gold':
      return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-700 dark:text-amber-300 border-amber-400/60 dark:border-amber-500/50';
    case 'amber':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/70';
    case 'violet':
      return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/70';
    case 'blue':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-cyan-300 dark:border-blue-800/70';
    case 'emerald':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/70';
    case 'neutral':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

function renderBadgeIcon(tone: StreakBadgeTier['tone'], className = 'w-3.5 h-3.5') {
  switch (tone) {
    case 'gold':
      return <Trophy className={className} />;
    case 'amber':
      return <Flame className={className} />;
    case 'violet':
      return <ShieldCheck className={className} />;
    case 'blue':
      return <Zap className={className} />;
    case 'emerald':
      return <Award className={className} />;
    case 'neutral':
    default:
      return <Sparkles className={className} />;
  }
}

export const DailyStreakCard: React.FC<DailyStreakCardProps> = ({
  streak,
  todayStudySeconds = 0,
  onLogTodayStudy,
}) => {
  const [showMilestones, setShowMilestones] = useState(false);

  const streakUnit = streak.currentStreak === 1 ? 'Day' : 'Days';
  const bestStreakForUnlock = Math.max(streak.currentStreak, streak.longestStreak);

  return (
    <section
      id="learning-streak-tracker"
      aria-label="Daily learning streak and achievement badge"
      className="rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      <div className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        {/* Left: Flame Counter & Achievement Badge */}
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div
            className={`w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${
              streak.studiedToday
                ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white border-amber-400/50 shadow-md shadow-orange-500/25'
                : streak.currentStreak > 0
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/70'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Flame className={`w-6 h-6 ${streak.studiedToday ? 'fill-white/25' : ''}`} />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
                {streak.currentStreak} {streakUnit} Learning Streak
              </h2>

              {/* Small Badge of Achievement */}
              <span
                title={streak.badge.subtitle}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${getBadgeToneClasses(
                  streak.badge.tone
                )}`}
              >
                {renderBadgeIcon(streak.badge.tone, 'w-3.5 h-3.5 shrink-0')}
                <span>{streak.badge.title}</span>
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {streak.studiedToday ? (
                <>
                  {todayStudySeconds > 0 ? (
                    <>
                      Logged <strong className="text-emerald-600 dark:text-emerald-400 tabular-nums">{formatStudyDuration(todayStudySeconds)}</strong> of study time today.
                    </>
                  ) : (
                    <>Today&apos;s study activity is logged.</>
                  )}
                  {streak.daysToNextBadge !== null && streak.badge.nextMilestoneTitle && (
                    <span className="ml-1 text-slate-500 dark:text-slate-400">
                      · <strong className="text-slate-700 dark:text-slate-200 tabular-nums">{streak.daysToNextBadge}</strong>{' '}
                      more {streak.daysToNextBadge === 1 ? 'day' : 'days'} to unlock{' '}
                      <strong className="text-blue-600 dark:text-cyan-400">{streak.badge.nextMilestoneTitle}</strong>.
                    </span>
                  )}
                </>
              ) : streak.streakAtRisk ? (
                <span>
                  Your streak from yesterday is active — log study time in a course, lab, or check in today to reach{' '}
                  <strong className="text-amber-600 dark:text-amber-400 tabular-nums">
                    {streak.currentStreak + 1} consecutive days
                  </strong>
                  .
                </span>
              ) : (
                <span>
                  Log study time in a course, lab, or flashcard session today to start your consecutive-day streak and earn{' '}
                  <strong className="text-emerald-600 dark:text-emerald-400">Link Up</strong>.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right: 7-Day Strip, Stats & Check-in Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between xl:justify-end gap-4 shrink-0">
          {/* 7-Day Activity Tiles */}
          <div className="flex items-center gap-1.5" aria-label="Last 7 days study activity">
            {streak.last7Days.map((day) => (
              <div
                key={day.dateKey}
                title={`${day.dateKey}${day.isActive ? ' · Studied' : ' · No activity logged'}`}
                className={`w-9 py-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors ${
                  day.isActive
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/45 border-emerald-300 dark:border-emerald-700/80 text-emerald-700 dark:text-emerald-300'
                    : day.isToday
                    ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-cyan-700/70 text-blue-700 dark:text-cyan-300'
                    : 'bg-slate-50 dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                <span className="text-[10px] font-bold uppercase leading-none">
                  {day.dayShort}
                </span>
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono tabular-nums ${
                    day.isActive
                      ? 'bg-emerald-500 text-white'
                      : day.isToday
                      ? 'border border-dashed border-blue-400 dark:border-cyan-400 text-blue-600 dark:text-cyan-300'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {day.isActive ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : day.dayNumber}
                </span>
              </div>
            ))}
          </div>

          {/* Best / Total + Check-in / Badges Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span>
                Best: <strong className="text-slate-900 dark:text-white">{streak.longestStreak}d</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>
                Total: <strong className="text-slate-900 dark:text-white">{streak.totalActiveDays}d</strong>
              </span>
            </div>

            {streak.studiedToday ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Today Logged
              </span>
            ) : (
              <button
                type="button"
                onClick={onLogTodayStudy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-sm shadow-orange-500/20 transition-all whitespace-nowrap cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5" />
                Check In Today
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowMilestones((prev) => !prev)}
              aria-expanded={showMilestones}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap"
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Badges</span>
              {showMilestones ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Achievement Milestones Row */}
      {showMilestones && (
        <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {ACHIEVEMENT_MILESTONES.map((tier) => {
              const unlocked = bestStreakForUnlock >= tier.minDays;
              return (
                <div
                  key={tier.id}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                    unlocked
                      ? getBadgeToneClasses(tier.tone)
                      : 'bg-white/60 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-75'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      unlocked
                        ? 'bg-white/70 dark:bg-black/20'
                        : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    {renderBadgeIcon(unlocked ? tier.tone : 'neutral', 'w-3.5 h-3.5')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate">{tier.title}</p>
                    <p className="text-[10px] font-mono tabular-nums">
                      {tier.minDays} {tier.minDays === 1 ? 'Day' : 'Days'} · {unlocked ? 'Earned' : 'Locked'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
