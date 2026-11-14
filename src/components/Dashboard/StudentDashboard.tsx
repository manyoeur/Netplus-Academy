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
  List
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { CourseThumbnail } from '../Courses/CourseThumbnail';

interface StudentDashboardProps {
  onSelectCourse: (courseId: string) => void;
  onViewCertificates: () => void;
  onOpenPricing: () => void;
  onOpenCliLab: () => void;
}

type DashboardViewMode = 'grid' | 'list';
const DASHBOARD_VIEW_STORAGE_KEY = 'netpulse_academy_dashboard_view';

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onSelectCourse,
  onViewCertificates,
  onOpenPricing,
  onOpenCliLab
}) => {
  const { currentUser, courses } = useAcademy();
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

        <div className="flex items-center gap-3">
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

      {/* Enrolled Courses Progress Section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Current Enrolled Curriculums
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {enrolledCourses.length} Active
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

        {enrolledCourses.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-xs text-slate-500">You are not enrolled in any networking courses yet.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* THUMBNAIL GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {enrolledCourses.map(course => {
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
                        {course.category} · {course.level}
                      </p>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {nextModule ? `Next: ${nextModule.title}` : 'All curriculum modules completed'}
                      </p>
                    </div>

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
          /* LIST VIEW */
          <div className="space-y-3">
            {enrolledCourses.map(course => {
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
                  className="p-4 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-cyan-500/40 transition-all flex flex-col sm:flex-row sm:items-center gap-4 group cursor-pointer"
                >
                  <CourseThumbnail
                    course={course}
                    className="w-full sm:w-44 aspect-video sm:aspect-[16/10] rounded-xl shrink-0"
                    imgClassName="group-hover:scale-[1.03] transition-transform duration-300"
                  >
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between z-10">
                      <span className="font-mono text-[10px] font-bold tracking-wider text-cyan-300">
                        {course.code}
                      </span>
                    </div>
                  </CourseThumbnail>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span>{course.category}</span>
                        <span>·</span>
                        <span>{course.level}</span>
                        {progressPercent === 100 && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Certified
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {nextModule ? `Next: ${nextModule.title}` : 'All curriculum modules completed'}
                      </p>
                    </div>

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
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-stretch justify-end gap-2 sm:w-40 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCourse(course.id);
                      }}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{progressPercent === 100 ? 'Review' : 'Continue Lesson'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenCliLab();
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap"
                      title="Open CLI Sandbox"
                    >
                      <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                      <span>CLI Lab</span>
                    </button>
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
    </div>
  );
};

