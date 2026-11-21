import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Award,
  Terminal,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  LayoutGrid,
  List,
  Calendar,
  Clock,
  AlertTriangle,
  XCircle,
  Play,
  Building2,
  CreditCard,
  FileText,
  Flame,
  NotebookPen,
  Clock as ClockIcon,
  Bookmark,
  Compass
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { Course, CoursePaymentRecord } from '../../types';
import { CourseThumbnail } from '../Courses/CourseThumbnail';
import { QuickNotesDrawer } from '../Courses/QuickNotesDrawer';
import { CourseRadialProgressChart } from './CourseRadialProgressChart';
import { DailyStreakCard } from './DailyStreakCard';
import { DailyStudyGoalCard } from './DailyStudyGoalCard';
import {
  resolveCourseEnrollment,
  formatEnrollmentDateRange,
  getEnrollmentExpirationInfo
} from '../../utils/enrollmentDates';
import { formatStudyDuration } from '../../utils/studyGoal';
import { formatVideoTimestamp } from '../../utils/quickNotes';

interface StudentDashboardProps {
  onSelectCourse: (courseId: string) => void;
  onViewCertificates: () => void;
  onOpenPricing: () => void;
  onOpenCliLab: () => void;
  onBrowseCourses?: () => void;
  onOpenCourseCheckout?: (course: Course | null, receipt?: CoursePaymentRecord) => void;
}

type DashboardViewMode = 'grid' | 'list';
const DASHBOARD_VIEW_STORAGE_KEY = 'netpulse_academy_dashboard_view';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onSelectCourse,
  onViewCertificates,
  onOpenPricing,
  onOpenCliLab,
  onBrowseCourses,
  onOpenCourseCheckout
}) => {
  const {
    currentUser,
    courses,
    coursePayments,
    learningStreak,
    recordLearningActivity,
    dailyStudyGoal,
    setDailyStudyGoalMinutes,
    quickNotes,
    saveQuickNote,
    deleteQuickNote,
    bookmarkedCourseIds,
    isCourseBookmarked,
    toggleCourseBookmark,
    enrollInCourse,
  } = useAcademy();
  const [isQuickNotesOpen, setIsQuickNotesOpen] = useState(false);
  const [viewMode, setViewMode] = useState<DashboardViewMode>(() => {
    try {
      const saved = localStorage.getItem(DASHBOARD_VIEW_STORAGE_KEY);
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_VIEW_STORAGE_KEY, viewMode);
    } catch {
      // Ignore storage write errors in restricted browsing contexts
    }
  }, [viewMode]);

  const enrolledCourses = courses.filter(c => currentUser.enrolledCourseIds.includes(c.id));
  const totalCompletedModules = currentUser.completedModuleIds.length;

  const enrolledItems = enrolledCourses.map(course => {
    const enrollment = resolveCourseEnrollment(currentUser, course);
    const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;
    return { course, enrollment, expiryInfo };
  });

  const expiringSoonCount = enrolledItems.filter(i => i.expiryInfo?.status === 'expiring_soon').length;
  const expiredCount = enrolledItems.filter(i => i.expiryInfo?.status === 'expired').length;
  const activeCount = enrolledItems.length - expiredCount;

  const studentPayments = coursePayments.filter(
    p =>
      p.studentId === currentUser.id ||
      (p.studentEmail && p.studentEmail.toLowerCase() === currentUser.email.toLowerCase())
  );

  const favoriteItems = bookmarkedCourseIds
    .map(courseId => courses.find(c => c.id === courseId))
    .filter((course): course is Course => Boolean(course))
    .map(course => {
      const isEnrolled = currentUser.enrolledCourseIds.includes(course.id);
      const enrollment = resolveCourseEnrollment(currentUser, course);
      const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;
      return { course, isEnrolled, enrollment, expiryInfo };
    });

  return (
    <div className="w-full space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/20 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2 mb-1 text-xs text-slate-300">
              <span className="font-mono uppercase font-bold text-cyan-300">
                {currentUser.role.toUpperCase()}
              </span>
              <span>·</span>
              <span>Joined {currentUser.joinedDate}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">
              Welcome back, {currentUser.name}
            </h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Academy Subscription: <strong className="text-cyan-300 uppercase">{currentUser.subscription.tier}</strong>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              document
                .getElementById('learning-streak-tracker')
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            title={`Learning Streak: ${learningStreak.currentStreak} consecutive ${
              learningStreak.currentStreak === 1 ? 'day' : 'days'
            } with logged study time · Today: ${
              dailyStudyGoal.totalSecondsToday > 0
                ? formatStudyDuration(dailyStudyGoal.totalSecondsToday)
                : learningStreak.studiedToday
                ? 'Checked in'
                : 'Not logged yet'
            } · Best: ${learningStreak.longestStreak}d (${learningStreak.badge.title})`}
            aria-label={`Learning Streak: ${learningStreak.currentStreak} consecutive ${
              learningStreak.currentStreak === 1 ? 'day' : 'days'
            }`}
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-mono flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              learningStreak.studiedToday
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-100 hover:bg-amber-500/30'
                : learningStreak.streakAtRisk
                ? 'bg-amber-500/15 border-amber-400/35 text-amber-200 hover:bg-amber-500/25'
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/15'
            }`}
          >
            <Flame
              className={`w-4 h-4 shrink-0 ${
                learningStreak.currentStreak > 0 ? 'text-amber-400' : 'text-slate-300'
              }`}
            />
            <span className="font-semibold text-slate-200">Learning Streak</span>
            <span className="font-bold tabular-nums text-white">
              {learningStreak.currentStreak}{' '}
              {learningStreak.currentStreak === 1 ? 'day' : 'days'}
            </span>
            <span className="text-white/35" aria-hidden="true">
              ·
            </span>
            {learningStreak.studiedToday ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {dailyStudyGoal.totalSecondsToday > 0
                  ? formatStudyDuration(dailyStudyGoal.totalSecondsToday)
                  : 'Today'}
              </span>
            ) : learningStreak.streakAtRisk ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Log today
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-cyan-200">
                {learningStreak.badge.title}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsQuickNotesOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            title="View and manage Quick Notes saved to your profile"
          >
            <NotebookPen className="w-4 h-4 text-cyan-300" />
            <span>Quick Notes</span>
            <span className="font-mono text-[11px] font-bold text-cyan-200 tabular-nums">
              ({quickNotes.length})
            </span>
          </button>

          {currentUser.subscription.tier === 'free' ? (
            <button
              onClick={onOpenPricing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-xs font-bold shadow-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Upgrade to Pro ($29/mo)</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-mono text-cyan-300 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{currentUser.subscription.tier.toUpperCase()} Member</span>
            </div>
          )}
        </div>
      </div>

      {/* Daily Learning Streak & Achievement Badge */}
      <DailyStreakCard
        streak={learningStreak}
        todayStudySeconds={dailyStudyGoal.totalSecondsToday}
        onLogTodayStudy={() => recordLearningActivity('Daily study check-in')}
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Enrolled Courses</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {enrolledCourses.length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed Modules</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-cyan-400 mt-1">
            {totalCompletedModules}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Certificates Earned</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-500 mt-1">
            {currentUser.certificates.length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Community Reputation</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-500 mt-1">
            {currentUser.reputationPoints} pts
          </p>
        </div>
      </div>

      {/* Daily Study Goal Radial Progress */}
      <DailyStudyGoalCard
        goal={dailyStudyGoal}
        onUpdateGoalMinutes={setDailyStudyGoalMinutes}
        hasEnrolledCourses={enrolledCourses.length > 0}
        onContinueCourse={
          enrolledCourses.length > 0 ? () => onSelectCourse(enrolledCourses[0].id) : undefined
        }
        onOpenLab={onOpenCliLab}
      />

      {/* D3.js Radial Progress Analytics */}
      <CourseRadialProgressChart
        courses={enrolledCourses}
        completedModuleIds={currentUser.completedModuleIds}
        onSelectCourse={onSelectCourse}
      />

      {/* My Favorites Section */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bookmark className="w-5 h-5 text-amber-500 fill-amber-500 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  My Favorites
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {favoriteItems.length} {favoriteItems.length === 1 ? 'saved' : 'saved'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Bookmarked courses pinned to your dashboard for quick access.
              </p>
            </div>
          </div>

          {onBrowseCourses && (
            <button
              type="button"
              onClick={onBrowseCourses}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-500 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Browse Catalog</span>
            </button>
          )}
        </div>

        {favoriteItems.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                No favorite courses saved yet
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Click the bookmark icon on any course in the Course Catalog or Course Player to save it here for quick access later.
              </p>
            </div>
            {onBrowseCourses && (
              <button
                type="button"
                onClick={onBrowseCourses}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                <span>Explore Courses</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {favoriteItems.map(({ course, isEnrolled, expiryInfo }) => {
              const totalModules = course.modules.length;
              const completedCount = course.modules.filter(m =>
                currentUser.completedModuleIds.includes(m.id)
              ).length;
              const progressPercent =
                totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

              return (
                <div
                  key={`fav-${course.id}`}
                  onClick={() => onSelectCourse(course.id)}
                  className="rounded-2xl bg-slate-50/70 dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500/50 transition-all flex flex-col group cursor-pointer"
                >
                  <CourseThumbnail
                    course={course}
                    className="aspect-video"
                    imgClassName="group-hover:scale-[1.03] transition-transform duration-300"
                  >
                    <span className="absolute top-2.5 left-3 z-10 px-2 py-0.5 rounded bg-slate-950/70 backdrop-blur-sm border border-white/15 text-white text-[10px] font-bold uppercase tracking-wider">
                      {course.level}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCourseBookmark(course.id);
                      }}
                      aria-pressed={true}
                      aria-label={`Remove ${course.title} from My Favorites`}
                      title="Remove from My Favorites"
                      className="absolute top-2.5 right-2.5 z-20 p-2 rounded-xl bg-amber-500/95 hover:bg-amber-600 border border-amber-300/70 text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    >
                      <Bookmark className="w-3.5 h-3.5 fill-current" />
                    </button>

                    <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between gap-2 z-10">
                      <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300">
                        {course.code}
                      </span>
                      {isEnrolled ? (
                        progressPercent === 100 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] font-semibold text-slate-200 tabular-nums">
                            {progressPercent}% done
                          </span>
                        )
                      ) : (
                        <span className="font-mono text-[11px] font-bold text-amber-300 tabular-nums">
                          {course.price > 0 ? `$${course.price}` : 'Free'}
                        </span>
                      )}
                    </div>
                  </CourseThumbnail>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate tabular-nums">
                        {course.category} · {course.durationHours}h · {totalModules} modules
                      </p>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {course.subtitle}
                      </p>
                    </div>

                    {isEnrolled && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          <span>
                            {completedCount}/{totalModules} modules
                          </span>
                          <span className="font-bold text-blue-600 dark:text-cyan-400">
                            {progressPercent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              progressPercent === 100
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      {isEnrolled && expiryInfo?.status === 'expired' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (course.price > 0 && onOpenCourseCheckout) {
                              onOpenCourseCheckout(course);
                            } else {
                              onOpenPricing();
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{course.price > 0 ? `Renew · $${course.price}` : 'Renew Access'}</span>
                        </button>
                      ) : isEnrolled ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCourse(course.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{progressPercent === 100 ? 'Review' : 'Continue Lesson'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const needsStudentPayment =
                              currentUser.role === 'student' && course.price > 0;
                            if (needsStudentPayment && onOpenCourseCheckout) {
                              onOpenCourseCheckout(course);
                              return;
                            }
                            enrollInCourse(course.id);
                            onSelectCourse(course.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <span>
                            {currentUser.role === 'student' && course.price > 0
                              ? `Enroll · $${course.price}`
                              : 'Enroll Now'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCourseBookmark(course.id);
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-300 dark:hover:border-red-500/40 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                        title="Remove from My Favorites"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enrolled Courses Progress Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Current Enrolled Curriculums
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {activeCount} Active
              {expiringSoonCount > 0 ? ` · ${expiringSoonCount} Expiring Soon` : ''}
              {expiredCount > 0 ? ` · ${expiredCount} Expired` : ''}
            </span>
          </div>

          {enrolledCourses.length > 0 && (
            <div
              role="group"
              aria-label="Enrolled courses display view"
              className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                title="Thumbnail view"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Thumbnails</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                title="List view"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List</span>
              </button>
            </div>
          )}
        </div>

        {enrolledItems.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-xs text-slate-500">You are not enrolled in any networking courses yet.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* THUMBNAIL GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enrolledItems.map(({ course, enrollment, expiryInfo }) => {
              const totalModules = course.modules.length;
              const completedCount = course.modules.filter(m =>
                currentUser.completedModuleIds.includes(m.id)
              ).length;
              const progressPercent =
                totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
              const nextModule = course.modules.find(
                m => !currentUser.completedModuleIds.includes(m.id)
              );

              return (
                <div
                  key={course.id}
                  onClick={() => onSelectCourse(course.id)}
                  className="rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-lg hover:border-blue-400 dark:hover:border-cyan-500/40 transition-all flex flex-col group cursor-pointer"
                >
                  <CourseThumbnail
                    course={course}
                    className="aspect-video"
                    imgClassName="group-hover:scale-[1.03] transition-transform duration-300"
                  >
                    <span className="absolute top-2.5 left-3 z-10 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      {course.level}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCourseBookmark(course.id);
                      }}
                      aria-pressed={isCourseBookmarked(course.id)}
                      aria-label={
                        isCourseBookmarked(course.id)
                          ? `Remove ${course.title} from My Favorites`
                          : `Save ${course.title} to My Favorites`
                      }
                      title={
                        isCourseBookmarked(course.id)
                          ? 'Saved in My Favorites'
                          : 'Save to My Favorites'
                      }
                      className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-xl backdrop-blur-md border transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        isCourseBookmarked(course.id)
                          ? 'bg-amber-500/95 border-amber-300/70 text-white hover:bg-amber-600'
                          : 'bg-slate-950/55 border-white/15 text-white/90 hover:bg-slate-950/80 hover:text-amber-300'
                      }`}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          isCourseBookmarked(course.id) ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                    <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between gap-2 z-10">
                      <span className="font-mono text-[11px] font-bold tracking-wider text-cyan-300">
                        {course.code}
                      </span>
                      {progressPercent === 100 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Certified</span>
                        </span>
                      )}
                    </div>
                  </CourseThumbnail>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                        {course.category} · {course.code}
                      </p>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {nextModule ? `Next: ${nextModule.title}` : 'All curriculum modules completed'}
                      </p>
                    </div>

                    {enrollment && expiryInfo && (
                      <div
                        className={`flex flex-wrap items-center gap-1.5 text-xs tabular-nums ${
                          expiryInfo.status === 'expired'
                            ? 'text-red-600 dark:text-red-400'
                            : expiryInfo.status === 'expiring_soon'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {expiryInfo.status === 'expired' ? (
                          <XCircle className="w-4 h-4 shrink-0" />
                        ) : expiryInfo.status === 'expiring_soon' ? (
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                        )}
                        <span className="font-medium">
                          {formatEnrollmentDateRange(enrollment)}
                        </span>
                        {(expiryInfo.status === 'expiring_soon' || expiryInfo.status === 'expired') && (
                          <span className="text-[11px] font-semibold">
                            · {expiryInfo.countdownLabel}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums font-medium">
                        <span className="text-slate-500 dark:text-slate-400">
                          {completedCount}/{totalModules} modules
                        </span>
                        <span
                          className={`font-bold ${
                            progressPercent === 100
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : progressPercent > 0
                              ? 'text-blue-600 dark:text-cyan-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {progressPercent}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${course.title} completion ${progressPercent}%`}
                        className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            progressPercent === 100
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      {expiryInfo?.status === 'expired' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (course.price > 0 && onOpenCourseCheckout) {
                              onOpenCourseCheckout(course);
                            } else {
                              onOpenPricing();
                            }
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{course.price > 0 ? `Renew · $${course.price}` : 'Renew Access'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCourse(course.id);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{progressPercent === 100 ? 'Review' : 'Continue Lesson'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenCliLab();
                        }}
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
                        title="Open CLI Sandbox"
                      >
                        <Terminal className="w-3 h-3 text-cyan-500" />
                        <span>CLI Lab</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW (clean reference card + progress bar) */
          <div className="space-y-4">
            {enrolledItems.map(({ course, enrollment, expiryInfo }) => {
              const totalModules = course.modules.length;
              const completedCount = course.modules.filter(m =>
                currentUser.completedModuleIds.includes(m.id)
              ).length;
              const progressPercent =
                totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;

              return (
                <div
                  key={course.id}
                  onClick={() => onSelectCourse(course.id)}
                  className="rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-cyan-500/40 transition-all overflow-hidden flex flex-col sm:flex-row group cursor-pointer"
                >
                  {/* Left Thumbnail with Level Tag & Centered Play Button */}
                  <CourseThumbnail
                    course={course}
                    className="w-full sm:w-56 md:w-64 aspect-video sm:aspect-auto sm:min-h-[184px] shrink-0"
                    imgClassName="group-hover:scale-[1.03] transition-transform duration-300"
                  >
                    <span className="absolute top-2.5 left-2.5 z-10 px-2.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                      {course.level}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCourseBookmark(course.id);
                      }}
                      aria-pressed={isCourseBookmarked(course.id)}
                      aria-label={
                        isCourseBookmarked(course.id)
                          ? `Remove ${course.title} from My Favorites`
                          : `Save ${course.title} to My Favorites`
                      }
                      title={
                        isCourseBookmarked(course.id)
                          ? 'Saved in My Favorites'
                          : 'Save to My Favorites'
                      }
                      className={`absolute top-2.5 right-2.5 z-20 p-1.5 rounded-xl backdrop-blur-md border transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        isCourseBookmarked(course.id)
                          ? 'bg-amber-500/95 border-amber-300/70 text-white hover:bg-amber-600'
                          : 'bg-slate-950/55 border-white/15 text-white/90 hover:bg-slate-950/80 hover:text-amber-300'
                      }`}
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          isCourseBookmarked(course.id) ? 'fill-current' : ''
                        }`}
                      />
                    </button>

                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                      <div className="w-11 h-11 rounded-full bg-slate-950/45 border-2 border-white/90 flex items-center justify-center text-white shadow-lg group-hover:scale-105 transition-transform">
                        <Play className="w-5 h-5 ml-0.5 fill-white/90" />
                      </div>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between z-10">
                      <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-300">
                        {course.code}
                      </span>
                      {progressPercent === 100 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Certified</span>
                        </span>
                      )}
                    </div>
                  </CourseThumbnail>

                  {/* Right Content Area */}
                  <div className="flex-1 min-w-0 p-4 sm:p-5 flex flex-col justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{course.category}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Course</span>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <span>{course.instructor.name}</span>
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                        {course.title}
                      </h3>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {course.subtitle}
                      </p>
                    </div>

                    {/* Progress Bar (kept along in list view mode) */}
                    <div className="flex items-center gap-3">
                      <div
                        role="progressbar"
                        aria-valuenow={progressPercent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${course.title} completion ${progressPercent}%`}
                        className="h-2 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
                      >
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            progressPercent === 100
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300 shrink-0">
                        {completedCount}/{totalModules} ·{' '}
                        <strong
                          className={
                            progressPercent === 100
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-blue-600 dark:text-cyan-400'
                          }
                        >
                          {progressPercent}%
                        </strong>
                      </span>
                    </div>

                    {/* Footer: Simple Clock Date Range + Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      {enrollment && expiryInfo ? (
                        <div
                          className={`flex flex-wrap items-center gap-2 text-xs tabular-nums ${
                            expiryInfo.status === 'expired'
                              ? 'text-red-600 dark:text-red-400'
                              : expiryInfo.status === 'expiring_soon'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {expiryInfo.status === 'expired' ? (
                            <XCircle className="w-4 h-4 shrink-0" />
                          ) : expiryInfo.status === 'expiring_soon' ? (
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                          ) : (
                            <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                          )}
                          <span className="font-medium">
                            {formatEnrollmentDateRange(enrollment)}
                          </span>
                          {(expiryInfo.status === 'expiring_soon' || expiryInfo.status === 'expired') && (
                            <span className="text-[11px] font-semibold">
                              · {expiryInfo.countdownLabel}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>Enrolled</span>
                        </span>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCliLab();
                          }}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                          title="Open CLI Sandbox"
                        >
                          <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                          <span>CLI Lab</span>
                        </button>

                        {expiryInfo?.status === 'expired' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (course.price > 0 && onOpenCourseCheckout) {
                                onOpenCourseCheckout(course);
                              } else {
                                onOpenPricing();
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{course.price > 0 ? `Renew · $${course.price}` : 'Renew Access'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCourse(course.id);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{progressPercent === 100 ? 'Review' : 'Continue Lesson'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Earned Certificates summary */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Official Certificates & Accreditations
            </h2>
          </div>
          <button
            onClick={onViewCertificates}
            className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap shrink-0"
          >
            Open Certificate Registry
          </button>
        </div>

        {currentUser.certificates.length === 0 ? (
          <p className="text-xs text-slate-500">No certificates earned yet. Complete all modules in a course to receive your credential.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentUser.certificates.map(cert => (
              <div
                key={cert.id}
                onClick={onViewCertificates}
                className="p-4 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20 cursor-pointer hover:border-amber-500 transition-all flex items-center justify-between"
              >
                <div>
                  <span className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400">
                    Serial: {cert.certificateNumber}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                    {cert.courseTitle}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Issued {cert.issueDate} · Grade: {cert.grade}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Course Payments & Receipts */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Course Payments &amp; Receipts
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Per-course tuition transactions and downloadable enrollment invoices.
              </p>
            </div>
          </div>
          {studentPayments.length > 0 && (
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {studentPayments.length} {studentPayments.length === 1 ? 'Receipt' : 'Receipts'}
            </span>
          )}
        </div>

        {studentPayments.length === 0 ? (
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No course payments recorded yet. Receipts and invoices appear here after completing course enrollment checkout.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3.5 font-semibold">Date</th>
                  <th className="py-2.5 px-3.5 font-semibold">Course</th>
                  <th className="py-2.5 px-3.5 font-semibold">Invoice #</th>
                  <th className="py-2.5 px-3.5 font-semibold">Method</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Amount Paid</th>
                  <th className="py-2.5 px-3.5 font-semibold">Status</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentPayments.map((payment) => {
                  const matchedCourse = courses.find(c => c.id === payment.courseId) || null;
                  const methodLabel =
                    payment.paymentMethod === 'card'
                      ? `Card${payment.cardLast4 ? ` ···· ${payment.cardLast4}` : ''}`
                      : payment.paymentMethod === 'paypal'
                      ? 'PayPal'
                      : 'Bank Transfer';

                  return (
                    <tr
                      key={payment.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3 px-3.5 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {payment.paidAt.slice(0, 10)}
                      </td>
                      <td className="py-3 px-3.5 min-w-[180px]">
                        <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-cyan-400 block">
                          {payment.courseCode}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                          {payment.courseTitle}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {payment.invoiceNumber}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {methodLabel}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white whitespace-nowrap">
                        ${payment.amountPaid.toFixed(2)} {payment.currency}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Paid</span>
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenCourseCheckout?.(matchedCourse, payment)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-500 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-300 text-[11px] font-semibold transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Saved Technical Quick Notes on Profile */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <NotebookPen className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Saved Study Quick Notes
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Technical concepts and video timestamps synced to {currentUser.name}&apos;s profile.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsQuickNotesOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
          >
            <NotebookPen className="w-3.5 h-3.5" />
            <span>{quickNotes.length > 0 ? `Open Notebook (${quickNotes.length})` : 'New Quick Note'}</span>
          </button>
        </div>

        {quickNotes.length === 0 ? (
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No quick notes saved yet. Open Quick Notes while watching any course video to capture protocols, CLI syntax, and timestamps directly to your profile.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickNotes.slice(0, 3).map(note => (
              <div
                key={note.id}
                onClick={() => setIsQuickNotesOpen(true)}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 hover:border-blue-400 dark:hover:border-cyan-500/50 transition-colors cursor-pointer space-y-1.5 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-cyan-400">
                      {note.courseCode || 'STUDY'}
                    </span>
                    {typeof note.videoTimestampSeconds === 'number' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-cyan-300 font-mono text-[10px] font-bold tabular-nums">
                        <ClockIcon className="w-2.5 h-2.5" />
                        <span>{formatVideoTimestamp(note.videoTimestampSeconds)}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    {note.title}
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[10px] text-slate-400">
                  <span className="truncate">{note.moduleTitle}</span>
                  <span className="font-mono tabular-nums shrink-0">{note.updatedAt.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <QuickNotesDrawer
        isOpen={isQuickNotesOpen}
        userName={currentUser.name}
        notes={quickNotes}
        courses={courses}
        onNavigateToModule={(courseId) => {
          setIsQuickNotesOpen(false);
          if (courseId && courseId !== 'general') {
            onSelectCourse(courseId);
          }
        }}
        onSaveNote={saveQuickNote}
        onDeleteNote={deleteQuickNote}
        onClose={() => setIsQuickNotesOpen(false)}
      />
    </div>
  );
};

