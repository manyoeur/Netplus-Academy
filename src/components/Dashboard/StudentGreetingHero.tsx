import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  NotebookPen,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  AlertTriangle
} from 'lucide-react';
import { Course, CoursePaymentRecord, ModuleType, User } from '../../types';
import { ComputedLearningStreak } from '../../utils/learningStreak';
import { ComputedDailyStudyGoal, formatStudyDuration } from '../../utils/studyGoal';
import {
  LastActiveCourseSession,
  OverallStudentProgress,
  formatRelativeActivityTime
} from '../../utils/readingProgress';
import { CourseThumbnail } from '../Courses/CourseThumbnail';

interface StudentGreetingHeroProps {
  user: User;
  lastSession: LastActiveCourseSession | null;
  overallProgress: OverallStudentProgress;
  learningStreak: ComputedLearningStreak;
  dailyStudyGoal: ComputedDailyStudyGoal;
  quickNotesCount: number;
  onResumeCourse: (courseId: string) => void;
  onOpenQuickNotes: () => void;
  onOpenCliLab: () => void;
  onOpenPricing: () => void;
  onBrowseCourses?: () => void;
  onOpenCourseCheckout?: (course: Course | null, receipt?: CoursePaymentRecord) => void;
}

function getTimeGreeting(date: Date): { salutation: string; dayPhaseLabel: string } {
  const hour = date.getHours();
  if (hour < 12) {
    return { salutation: 'Good morning', dayPhaseLabel: 'Morning Session' };
  }
  if (hour < 17) {
    return { salutation: 'Good afternoon', dayPhaseLabel: 'Afternoon Session' };
  }
  return { salutation: 'Good evening', dayPhaseLabel: 'Evening Session' };
}

function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'Learner';
  const parts = trimmed.split(/\s+/);
  return parts[0] || trimmed;
}

function formatModuleKind(type: ModuleType): string {
  switch (type) {
    case 'lab':
      return 'CLI Lab';
    case 'quiz':
      return 'Quiz';
    case 'video':
      return 'Video';
    case 'pcap':
      return 'PCAP';
    case 'theory':
    default:
      return 'Reading';
  }
}

export const StudentGreetingHero: React.FC<StudentGreetingHeroProps> = ({
  user,
  lastSession,
  overallProgress,
  learningStreak,
  dailyStudyGoal,
  quickNotesCount,
  onResumeCourse,
  onOpenQuickNotes,
  onOpenCliLab,
  onOpenPricing,
  onBrowseCourses,
  onOpenCourseCheckout
}) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const { salutation, dayPhaseLabel } = getTimeGreeting(now);
  const firstName = getFirstName(user.name);

  const formattedToday = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  // Dynamic personalized status line grounded in actual progress
  const dynamicStatusText = (() => {
    if (dailyStudyGoal.goalReached) {
      return `You reached today's ${dailyStudyGoal.dailyGoalMinutes}-minute study target. Keep the momentum going.`;
    }
    if (learningStreak.streakAtRisk && learningStreak.currentStreak > 0) {
      return `Protect your ${learningStreak.currentStreak}-day learning streak with a quick lesson or CLI check-in today.`;
    }
    if (
      lastSession &&
      lastSession.hasPriorActivity &&
      !lastSession.isExpired &&
      lastSession.coursePercent > 0 &&
      lastSession.coursePercent < 100
    ) {
      return `You're ${lastSession.coursePercent}% through ${lastSession.course.code} — pick up right where you left off.`;
    }
    if (learningStreak.studiedToday && learningStreak.currentStreak > 0) {
      return `${learningStreak.currentStreak}-day study streak active with ${
        dailyStudyGoal.totalSecondsToday > 0
          ? formatStudyDuration(dailyStudyGoal.totalSecondsToday)
          : 'activity'
      } logged today.`;
    }
    if (overallProgress.enrolledCoursesCount > 0) {
      return `${overallProgress.activeCoursesCount} active ${
        overallProgress.activeCoursesCount === 1 ? 'course' : 'courses'
      } ready in your workspace. ${
        dailyStudyGoal.remainingSeconds > 0
          ? `${formatStudyDuration(dailyStudyGoal.remainingSeconds)} left for today's goal.`
          : ''
      }`.trim();
    }
    return 'Explore structured networking tracks, hands-on Cisco IOS labs, and packet analysis modules.';
  })();

  const scrollToStreakCard = () => {
    document
      .getElementById('learning-streak-tracker')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePrimaryResumeAction = () => {
    if (!lastSession) {
      onBrowseCourses?.();
      return;
    }
    if (lastSession.isExpired) {
      if (lastSession.course.price > 0 && onOpenCourseCheckout) {
        onOpenCourseCheckout(lastSession.course);
      } else {
        onOpenPricing();
      }
      return;
    }
    onResumeCourse(lastSession.course.id);
  };

  const resumeEyebrow = !lastSession
    ? 'GET STARTED'
    : lastSession.isExpired
    ? 'ACCESS EXPIRED'
    : lastSession.coursePercent === 100
    ? 'COMPLETED · REVIEW'
    : lastSession.hasPriorActivity
    ? 'RESUME WHERE YOU LEFT OFF'
    : 'NEXT UP IN CURRICULUM';

  const resumeButtonLabel = !lastSession
    ? 'Browse Course Catalog'
    : lastSession.isExpired
    ? lastSession.course.price > 0
      ? `Renew Access · $${lastSession.course.price}`
      : 'Renew Access'
    : lastSession.coursePercent === 100
    ? 'Review Course'
    : lastSession.hasPriorActivity
    ? 'Resume Lesson'
    : 'Start First Lesson';

  return (
    <section
      aria-label="Personalized greeting and resume learning overview"
      className="rounded-3xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Dynamic Greeting + Personalized Progress Metrics */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-5 min-w-0">
          <div className="space-y-4">
            {/* Student Identity & Date Metadata */}
            <div className="flex items-start sm:items-center gap-4">
              <img
                src={user.avatar}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-200 dark:ring-slate-700/80 shrink-0 shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                    {dayPhaseLabel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formattedToday}</span>
                  <span aria-hidden="true">·</span>
                  <span className="uppercase">
                    {user.subscription.tier} Plan
                  </span>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">Joined {user.joinedDate}</span>
                </div>

                <h1 className="text-2xl sm:text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight mt-0.5">
                  {salutation}, {firstName}
                </h1>

                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {dynamicStatusText}
                </p>
              </div>
            </div>

            {/* Personalized Progress Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Overall Curriculum Completion */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Curriculum
                  </span>
                  <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                </div>
                <div>
                  <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                    {overallProgress.overallPercent}%
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                    {overallProgress.totalCompletedModules}/{overallProgress.totalEnrolledModules} modules
                  </p>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={overallProgress.overallPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Overall curriculum progress ${overallProgress.overallPercent}%`}
                  className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500"
                    style={{ width: `${overallProgress.overallPercent}%` }}
                  />
                </div>
              </div>

              {/* Today's Study Goal */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Today&apos;s Study
                  </span>
                  {dailyStudyGoal.goalReached ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Target className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  )}
                </div>
                <div>
                  <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                    {dailyStudyGoal.totalSecondsToday > 0
                      ? formatStudyDuration(dailyStudyGoal.totalSecondsToday)
                      : '0m'}
                  </p>
                  <p
                    className={`text-[11px] font-mono tabular-nums mt-1 ${
                      dailyStudyGoal.goalReached
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {dailyStudyGoal.goalReached
                      ? `${dailyStudyGoal.dailyGoalMinutes}m goal met`
                      : `Target ${dailyStudyGoal.dailyGoalMinutes}m`}
                  </p>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={dailyStudyGoal.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Daily study goal ${dailyStudyGoal.progressPercent}%`}
                  className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      dailyStudyGoal.goalReached
                        ? 'bg-emerald-500'
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${dailyStudyGoal.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Learning Streak */}
              <button
                type="button"
                onClick={scrollToStreakCard}
                title="Jump to Learning Streak tracker"
                className="text-left p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400/70 dark:hover:border-amber-500/50 transition-colors flex flex-col justify-between gap-2 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1.5 w-full">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Study Streak
                  </span>
                  <Flame
                    className={`w-3.5 h-3.5 shrink-0 ${
                      learningStreak.currentStreak > 0
                        ? 'text-amber-500 fill-amber-500/20'
                        : 'text-slate-400'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                    {learningStreak.currentStreak}d
                  </p>
                  <p
                    className={`text-[11px] font-mono tabular-nums mt-1 ${
                      learningStreak.studiedToday
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : learningStreak.streakAtRisk
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {learningStreak.studiedToday
                      ? 'Checked in'
                      : learningStreak.streakAtRisk
                      ? 'Log today'
                      : `Best ${learningStreak.longestStreak}d`}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {learningStreak.badge.title}
                </span>
              </button>

              {/* Active Tracks & Certificates */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Credentials
                  </span>
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                </div>
                <div>
                  <p className="text-xl font-extrabold font-mono tabular-nums text-slate-900 dark:text-white leading-none">
                    {user.certificates.length}
                  </p>
                  <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-1">
                    {overallProgress.completedCoursesCount}/{overallProgress.enrolledCoursesCount} finished
                  </p>
                </div>
                <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {user.reputationPoints} rep pts
                </span>
              </div>
            </div>
          </div>

          {/* Utility Shortcuts Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onOpenQuickNotes}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <NotebookPen className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Quick Notes</span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                ({quickNotesCount})
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenCliLab}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Open CLI Sandbox</span>
            </button>

            {user.subscription.tier === 'free' ? (
              <button
                type="button"
                onClick={onOpenPricing}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-950/80 border border-amber-200 dark:border-amber-800/70 text-xs font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Upgrade to Pro</span>
              </button>
            ) : (
              <span className="px-2.5 py-1.5 text-xs font-mono text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{user.subscription.tier.toUpperCase()} Access Active</span>
              </span>
            )}
          </div>
        </div>

        {/* Right Column: Resume Where You Left Off Card */}
        <div className="lg:col-span-5 rounded-2xl bg-slate-50 dark:bg-slate-900/85 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between gap-4 min-w-0">
          {lastSession ? (
            <>
              <div className="space-y-3.5 min-w-0">
                {/* Panel Header */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider ${
                      lastSession.isExpired
                        ? 'text-red-600 dark:text-red-400'
                        : lastSession.coursePercent === 100
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-blue-600 dark:text-cyan-400'
                    }`}
                  >
                    {lastSession.isExpired ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    ) : lastSession.coursePercent === 100 ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <Play className="w-3.5 h-3.5 shrink-0 fill-current" />
                    )}
                    <span>{resumeEyebrow}</span>
                  </span>

                  <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatRelativeActivityTime(lastSession.lastUpdatedAtMs)}
                  </span>
                </div>

                {/* Course Thumbnail + Title */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <CourseThumbnail
                    course={lastSession.course}
                    className="w-20 h-16 sm:w-24 sm:h-18 rounded-xl shrink-0 border border-slate-200 dark:border-slate-700/80"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-cyan-400 block">
                      {lastSession.course.code}
                    </span>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mt-0.5">
                      {lastSession.course.title}
                    </h2>
                  </div>
                </div>

                {/* Exact Module / Section Position */}
                {lastSession.activeModule && (
                  <div className="p-3 rounded-xl bg-white dark:bg-[#0c1220] border border-slate-200/90 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono font-semibold text-slate-500 dark:text-slate-400 truncate">
                        {lastSession.sectionTitle
                          ? `${lastSession.moduleNumberLabel} · ${lastSession.sectionTitle}`
                          : lastSession.moduleNumberLabel}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {formatModuleKind(lastSession.activeModule.type)}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                      {lastSession.activeModule.title}
                    </p>
                    {lastSession.moduleReadPercent > 0 && lastSession.moduleReadPercent < 100 && (
                      <p className="text-[11px] font-mono tabular-nums text-blue-600 dark:text-cyan-400">
                        Saved position · {lastSession.moduleReadPercent}% read
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Course Progress + Resume CTA */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      Course Progress
                    </span>
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                      {lastSession.completedCount}/{lastSession.totalModules} ·{' '}
                      <strong
                        className={
                          lastSession.coursePercent === 100
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-blue-600 dark:text-cyan-400'
                        }
                      >
                        {lastSession.coursePercent}%
                      </strong>
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={lastSession.coursePercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${lastSession.course.title} completion ${lastSession.coursePercent}%`}
                    className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        lastSession.coursePercent === 100
                          ? 'bg-emerald-500'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                      }`}
                      style={{ width: `${lastSession.coursePercent}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrimaryResumeAction}
                  className={`w-full py-2.5 px-4 rounded-xl text-white text-xs sm:text-sm font-bold shadow-sm transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer ${
                    lastSession.isExpired
                      ? 'bg-amber-600 hover:bg-amber-500'
                      : lastSession.coursePercent === 100
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {lastSession.isExpired ? (
                    <Sparkles className="w-4 h-4 shrink-0" />
                  ) : lastSession.coursePercent === 100 ? (
                    <RotateCcw className="w-4 h-4 shrink-0" />
                  ) : (
                    <Play className="w-4 h-4 shrink-0 fill-current" />
                  )}
                  <span>{resumeButtonLabel}</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-between gap-4 py-1">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>{resumeEyebrow}</span>
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Start Your First Networking Course
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Enroll in a CCNA, Network Security, SD-WAN, or Wireshark track to unlock guided lessons, CLI labs, and resume tracking.
                </p>
              </div>

              <button
                type="button"
                onClick={onBrowseCourses}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-sm transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Compass className="w-4 h-4 shrink-0" />
                <span>Browse Course Catalog</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
