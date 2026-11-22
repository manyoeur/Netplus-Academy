import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  Award,
  CheckCircle2,
  DollarSign,
  Activity,
  Zap,
  Globe,
  FileDown,
  Loader2,
  Search,
  X
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import { exportAnalyticsReportToPdf } from '../../utils/analyticsPdf';

export const AnalyticsDashboard: React.FC = () => {
  const { currentUser, courses, studentProgressList, activityFeed, lmsConfigs } = useAcademy();

  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const totalEnrollments = courses.reduce((acc, c) => acc + c.enrolledCount, 0);
  const completedStudents = studentProgressList.filter(p => p.progressPercent === 100).length;
  const avgQuiz = Math.round(
    studentProgressList.reduce((acc, p) => acc + p.quizAverage, 0) /
      (studentProgressList.length || 1)
  );
  const avgProgress = Math.round(
    studentProgressList.reduce((acc, p) => acc + p.progressPercent, 0) /
      (studentProgressList.length || 1)
  );

  const filteredStudentProgress = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studentProgressList.filter(record => {
      const matchesCourse = courseFilter === 'all' || record.courseId === courseFilter;
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesQuery =
        !q ||
        record.studentName.toLowerCase().includes(q) ||
        record.studentEmail.toLowerCase().includes(q) ||
        record.courseCode.toLowerCase().includes(q) ||
        record.courseTitle.toLowerCase().includes(q);
      return matchesCourse && matchesStatus && matchesQuery;
    });
  }, [studentProgressList, courseFilter, statusFilter, searchQuery]);

  const activeScopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (courseFilter !== 'all') {
      const matched = courses.find(c => c.id === courseFilter);
      parts.push(matched ? matched.code : courseFilter);
    } else {
      parts.push('All Curriculums');
    }
    if (statusFilter !== 'all') {
      parts.push(`Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`);
    } else {
      parts.push('All Statuses');
    }
    if (searchQuery.trim()) {
      parts.push(`Search: "${searchQuery.trim()}"`);
    }
    return parts.join(' | ');
  }, [courseFilter, statusFilter, searchQuery, courses]);

  const hasActiveFilters =
    courseFilter !== 'all' || statusFilter !== 'all' || searchQuery.trim() !== '';

  const handleExportPdf = async () => {
    setExportError(null);
    setExportMessage(null);
    setIsExportingPdf(true);
    try {
      const filename = await exportAnalyticsReportToPdf({
        generatedByName: currentUser.name,
        generatedByRole: currentUser.role,
        scopeLabel: activeScopeLabel,
        courses,
        studentProgressList: filteredStudentProgress,
        allStudentProgressCount: studentProgressList.length,
        activityFeed,
        lmsConfigs,
      });
      setExportMessage(`Downloaded ${filename} (${filteredStudentProgress.length} learner records).`);
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Unable to generate PDF analytics report.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[11px] text-cyan-300 font-semibold">
              Real-Time Telemetry Stream
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Academy Performance &amp; Learner Telemetry
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Live telemetry monitoring student completion milestones, lab CLI activity, assessment benchmarks, and revenue metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl whitespace-nowrap">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Active Nodes: 342 Concurrent Students</span>
          </div>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Download Student Progress & Academy Performance Report as PDF"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <FileDown className="w-4 h-4 shrink-0" />
            )}
            <span>{isExportingPdf ? 'Generating PDF...' : 'Export PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Export Confirmation / Error Feedback */}
      {exportMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200"
        >
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setExportMessage(null)}
            aria-label="Dismiss notification"
            className="text-emerald-600 dark:text-emerald-300 hover:opacity-75 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {exportError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-700 dark:text-red-300"
        >
          <span>{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            aria-label="Dismiss error"
            className="hover:opacity-75 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Enrollments</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono tabular-nums">
            {totalEnrollments.toLocaleString()}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+14.8% this month</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Cohort Progress</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono tabular-nums">
            {avgProgress}%
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 tabular-nums">
            <TrendingUp className="w-3 h-3" />
            <span>{completedStudents}/{studentProgressList.length} completed</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Quiz Score</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono tabular-nums">
            {avgQuiz}%
          </p>
          <div className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
            <span>Honors Benchmark</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Monthly Revenue</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono tabular-nums">
            $48,290
          </p>
          <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1">
            <span>Subscriptions + LTI</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">External LMS Sync</span>
            <div className="p-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono tabular-nums">
            {lmsConfigs.filter(c => c.connected).length} Connected
          </p>
          <div className="flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold mt-1">
            <span>Canvas / Blackboard</span>
          </div>
        </div>
      </div>

      {/* Main Analytics Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Enrollment Breakdown */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Curriculum Enrollment &amp; Completion Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Active students by course subject and lab execution status.
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Live Roster
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {courses.map(c => {
              const share = Math.round((c.enrolledCount / (totalEnrollments || 1)) * 100);
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {c.code}: {c.title}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {c.enrolledCount.toLocaleString()} ({share}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance Distribution */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Honors Tier (&gt;90%)</span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">68%</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Standard Pass (80-89%)</span>
              <span className="text-lg font-bold font-mono text-blue-600 dark:text-cyan-400">24%</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">Lab Assistance (&lt;80%)</span>
              <span className="text-lg font-bold font-mono text-amber-500">8%</span>
            </div>
          </div>
        </div>

        {/* Live Activity Telemetry Feed */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>Live Activity Stream</span>
              </h3>
              <span className="text-[10px] font-mono text-emerald-500 flex items-center gap-1 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 text-xs">
              {activityFeed.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <img
                    src={item.avatar}
                    alt={item.studentName}
                    className="w-7 h-7 rounded-full object-cover ring-1 ring-blue-500/30 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-800 dark:text-slate-200">
                      <strong className="text-slate-900 dark:text-white">{item.studentName}</strong>{' '}
                      {item.action === 'finished_lab' && 'finished lab exercise'}
                      {item.action === 'passed_quiz' && 'scored high on'}
                      {item.action === 'earned_certificate' && 'earned official credential for'}
                      {item.action === 'enrolled' && 'enrolled in'}{' '}
                      <span className="font-semibold text-blue-600 dark:text-cyan-400">{item.target}</span>
                    </p>
                    <span className="text-[10px] font-mono text-slate-400">{item.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[11px] font-mono text-slate-400">
              WebSocket Event Bus: Connected to Academy PubSub
            </span>
          </div>
        </div>
      </div>

      {/* Student Progress & Performance Report Table */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Student Progress &amp; Performance Report
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Filter by curriculum or standing, then export a formatted PDF report for records or cohort reviews.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or course..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              aria-label="Filter report by course"
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Courses</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>
                  {course.code}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter report by status"
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="active">Active</option>
              <option value="behind">Behind</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-cyan-800/60 bg-blue-50 dark:bg-cyan-950/40 hover:bg-blue-600 hover:text-white dark:hover:bg-cyan-500 dark:hover:text-slate-950 text-blue-700 dark:text-cyan-300 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="tabular-nums">
            Showing <strong className="text-slate-900 dark:text-slate-100">{filteredStudentProgress.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-slate-100">{studentProgressList.length}</strong> learner records
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setCourseFilter('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="text-blue-600 dark:text-cyan-400 font-semibold hover:underline"
            >
              Reset report filters
            </button>
          )}
        </div>

        {filteredStudentProgress.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No student progress records match your active filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3.5 font-semibold">Student</th>
                  <th className="py-2.5 px-3.5 font-semibold">Course</th>
                  <th className="py-2.5 px-3.5 font-semibold">Modules</th>
                  <th className="py-2.5 px-3.5 font-semibold">Completion</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Quiz Avg</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Study Time</th>
                  <th className="py-2.5 px-3.5 font-semibold">Standing</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudentProgress.map(record => (
                  <tr
                    key={`${record.studentId}-${record.courseId}`}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-3.5 min-w-[180px]">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={record.avatar}
                          alt={record.studentName}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {record.studentName}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                            {record.studentEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 min-w-[160px]">
                      <span className="font-mono text-[10px] font-bold text-blue-600 dark:text-cyan-400 block">
                        {record.courseCode}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300 line-clamp-1">
                        {record.courseTitle}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {record.completedModulesCount}/{record.totalModulesCount}
                    </td>
                    <td className="py-3 px-3.5 min-w-[130px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              record.progressPercent === 100
                                ? 'bg-emerald-500'
                                : record.status === 'behind'
                                ? 'bg-amber-500'
                                : 'bg-blue-600 dark:bg-cyan-400'
                            }`}
                            style={{ width: `${record.progressPercent}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold tabular-nums text-slate-800 dark:text-slate-200 w-9 text-right">
                          {record.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td
                      className={`py-3 px-3.5 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                        record.quizAverage >= 90
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : record.quizAverage >= 80
                          ? 'text-blue-600 dark:text-cyan-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {record.quizAverage}%
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {record.timeSpentHours.toFixed(1)}h
                    </td>
                    <td className="py-3 px-3.5 whitespace-nowrap">
                      <span
                        className={`font-semibold capitalize ${
                          record.status === 'completed'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : record.status === 'active'
                            ? 'text-blue-600 dark:text-cyan-400'
                            : record.status === 'behind'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {record.status}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {record.lastActive}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

