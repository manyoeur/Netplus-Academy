import React from 'react';
import { 
  BookOpen, 
  Award, 
  Terminal, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  CreditCard,
  Activity,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';

interface StudentDashboardProps {
  onSelectCourse: (courseId: string) => void;
  onViewCertificates: () => void;
  onOpenPricing: () => void;
  onOpenCliLab: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onSelectCourse,
  onViewCertificates,
  onOpenPricing,
  onOpenCliLab
}) => {
  const { currentUser, courses } = useAcademy();

  const enrolledCourses = courses.filter(c => currentUser.enrolledCourseIds.includes(c.id));
  const totalCompletedModules = currentUser.completedModuleIds.length;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-16 h-16 rounded-2xl object-cover ring-4 ring-white/20 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {currentUser.role.toUpperCase()}
              </span>
              <span className="text-xs text-slate-300">• Joined {currentUser.joinedDate}</span>
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
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-xs font-bold shadow-md flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Upgrade to Pro ($29/mo)</span>
            </button>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-xs font-mono text-cyan-300 flex items-center gap-1.5">
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
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {enrolledCourses.length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completed Modules</span>
          <p className="text-2xl font-bold font-mono text-blue-600 dark:text-cyan-400 mt-1">
            {totalCompletedModules}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Certificates Earned</span>
          <p className="text-2xl font-bold font-mono text-amber-500 mt-1">
            {currentUser.certificates.length}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Community Reputation</span>
          <p className="text-2xl font-bold font-mono text-emerald-500 mt-1">
            {currentUser.reputationPoints} pts
          </p>
        </div>
      </div>

      {/* Enrolled Courses Progress Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Current Enrolled Curriculums
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {enrolledCourses.length} Active Courses
          </span>
        </div>

        {enrolledCourses.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-xs text-slate-500">You are not enrolled in any networking courses yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledCourses.map(course => {
              const completedCount = course.modules.filter(m => currentUser.completedModuleIds.includes(m.id)).length;
              const progressPercent = Math.round((completedCount / course.modules.length) * 100);

              return (
                <div
                  key={course.id}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-cyan-500/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold">
                        {course.code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {course.title}
                      </h3>
                    </div>

                    {progressPercent === 100 && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Certified
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono font-medium">
                      <span className="text-slate-500 dark:text-slate-400">{completedCount} of {course.modules.length} Modules Done</span>
                      <span className="font-bold text-blue-600 dark:text-cyan-400">{progressPercent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <button
                      onClick={() => onSelectCourse(course.id)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{progressPercent === 100 ? 'Review Course' : 'Resume Learning'}</span>
                    </button>

                    <button
                      onClick={onOpenCliLab}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1"
                    >
                      <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Open Cisco CLI</span>
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
            className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
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
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Issued {cert.issueDate} • Grade: {cert.grade}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
