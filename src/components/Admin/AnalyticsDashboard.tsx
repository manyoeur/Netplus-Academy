import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Award, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Activity, 
  Layers, 
  AlertCircle,
  Zap,
  Globe
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';

export const AnalyticsDashboard: React.FC = () => {
  const { courses, studentProgressList, activityFeed, lmsConfigs } = useAcademy();

  const totalEnrollments = courses.reduce((acc, c) => acc + c.enrolledCount, 0);
  const completedStudents = studentProgressList.filter(p => p.progressPercent === 100).length;
  const avgQuiz = Math.round(studentProgressList.reduce((acc, p) => acc + p.quizAverage, 0) / (studentProgressList.length || 1));

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="px-2 py-0.5 rounded bg-white/10 font-mono text-[11px] text-cyan-300 font-semibold">
              Real-Time Telemetry Stream
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Academy Performance & Learner Telemetry
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Live telemetry monitoring student completion milestones, lab CLI activity, assessment benchmarks, and revenue metrics.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-white/5 border border-white/10 px-3.5 py-2 rounded-xl">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Active Nodes: 342 Concurrent Students</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Enrollments</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {totalEnrollments.toLocaleString()}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>+14.8% this month</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completion Rate</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            84.2%
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>High lab pass-rate</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Quiz Score</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
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
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
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
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
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
                Curriculum Enrollment & Completion Distribution
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
                    <span className="font-mono text-slate-500 dark:text-slate-400">
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
    </div>
  );
};
