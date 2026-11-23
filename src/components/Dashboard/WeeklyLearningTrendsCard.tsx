import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  Compass,
  Terminal,
  TrendingUp
} from 'lucide-react';
import { formatStudyDuration } from '../../utils/studyGoal';
import {
  WeeklyLearningTrendsSummary,
  WeeklyStudyDayPoint
} from '../../utils/studyHistory';

type ChartViewMode = 'bars' | 'area';

interface WeeklyLearningTrendsCardProps {
  summary: WeeklyLearningTrendsSummary;
  hasEnrolledCourses?: boolean;
  onContinueCourse?: () => void;
  onBrowseCourses?: () => void;
  onOpenLab?: () => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: WeeklyStudyDayPoint;
  }>;
}

const TrendsTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg px-3.5 py-2.5 text-xs space-y-2 min-w-[205px]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-1.5">
        <span className="font-semibold text-slate-900 dark:text-white">
          {point.fullDateLabel}
        </span>
        <span className="font-mono font-bold tabular-nums text-blue-600 dark:text-cyan-400">
          {point.totalSeconds > 0 ? formatStudyDuration(point.totalSeconds) : '0m'}
        </span>
      </div>

      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-xs bg-blue-600 shrink-0" />
            <span>Courses</span>
          </span>
          <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
            {point.courseSeconds > 0 ? formatStudyDuration(point.courseSeconds) : '0m'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-xs bg-cyan-500 shrink-0" />
            <span>Hands-on Labs</span>
          </span>
          <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
            {point.labSeconds > 0 ? formatStudyDuration(point.labSeconds) : '0m'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span className="w-2 h-2 rounded-xs bg-violet-500 shrink-0" />
            <span>Practice Tools</span>
          </span>
          <span className="font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200">
            {point.practiceSeconds > 0 ? formatStudyDuration(point.practiceSeconds) : '0m'}
          </span>
        </div>
      </div>

      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-500 dark:text-slate-400">
          Daily target ({point.goalMinutes}m)
        </span>
        {point.goalMet ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Goal met</span>
          </span>
        ) : (
          <span className="font-mono tabular-nums font-semibold text-slate-600 dark:text-slate-300">
            {point.goalPercent}%
          </span>
        )}
      </div>
    </div>
  );
};

export const WeeklyLearningTrendsCard: React.FC<WeeklyLearningTrendsCardProps> = ({
  summary,
  hasEnrolledCourses = true,
  onContinueCourse,
  onBrowseCourses,
  onOpenLab
}) => {
  const [chartMode, setChartMode] = useState<ChartViewMode>('bars');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const syncTheme = () => setIsDarkMode(root.classList.contains('dark'));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const yAxisMax = useMemo(() => {
    const maxDayMinutes = Math.max(
      summary.dailyGoalMinutes,
      ...summary.days.map(d => d.totalMinutes),
      15
    );
    return Math.ceil((maxDayMinutes * 1.15) / 5) * 5;
  }, [summary]);

  const dateRangeLabel = useMemo(() => {
    if (summary.days.length === 0) return 'Last 7 days';
    const first = summary.days[0];
    const last = summary.days[summary.days.length - 1];
    return `${first.dateLabel} – ${last.dateLabel}`;
  }, [summary.days]);

  const axisTickColor = isDarkMode ? '#94a3b8' : '#64748b';
  const gridStrokeColor = isDarkMode ? '#1e293b' : '#e2e8f0';
  const goalLineColor = isDarkMode ? '#34d399' : '#059669';

  return (
    <section
      aria-label="Weekly Learning Trends"
      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Weekly Learning Trends
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {dateRangeLabel}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Daily study time over the past 7 days across courses, hands-on labs, and practice tools.
            </p>
          </div>
        </div>

        {/* Chart Mode Toggle */}
        <div
          role="group"
          aria-label="Weekly trends chart view"
          className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
        >
          <button
            type="button"
            onClick={() => setChartMode('bars')}
            aria-pressed={chartMode === 'bars'}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
              chartMode === 'bars'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Breakdown</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('area')}
            aria-pressed={chartMode === 'area'}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
              chartMode === 'area'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Trend Line</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="px-4 py-3">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            7-Day Study Total
          </span>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
            {summary.totalSeconds7d > 0 ? formatStudyDuration(summary.totalSeconds7d) : '0m'}
          </p>
        </div>

        <div className="px-4 py-3">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Daily Average
          </span>
          <p className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-cyan-400 mt-0.5">
            {summary.averageSecondsPerDay > 0
              ? formatStudyDuration(summary.averageSecondsPerDay)
              : '0m'}
          </p>
        </div>

        <div className="px-4 py-3">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Peak Day
          </span>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-0.5 truncate">
            {summary.bestDay
              ? `${formatStudyDuration(summary.bestDay.totalSeconds)} · ${summary.bestDay.axisLabel}`
              : '—'}
          </p>
        </div>

        <div className="px-4 py-3">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
            Daily Goal Hit
          </span>
          <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
            {summary.goalDaysHit}/7 days
          </p>
        </div>
      </div>

      {/* Recharts Canvas */}
      <div className="space-y-3">
        <div className="h-64 sm:h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {chartMode === 'bars' ? (
              <BarChart
                data={summary.days}
                margin={{ top: 14, right: 12, left: -12, bottom: 2 }}
                barCategoryGap="24%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={gridStrokeColor}
                />
                <XAxis
                  dataKey="axisLabel"
                  tickLine={false}
                  axisLine={{ stroke: gridStrokeColor }}
                  tick={{ fill: axisTickColor, fontSize: 12, fontWeight: 500 }}
                  dy={6}
                />
                <YAxis
                  domain={[0, yAxisMax]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  tickFormatter={(val: number) => `${val}m`}
                  width={48}
                />
                <Tooltip
                  cursor={{
                    fill: isDarkMode ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.04)'
                  }}
                  content={<TrendsTooltip />}
                />
                <ReferenceLine
                  y={summary.dailyGoalMinutes}
                  stroke={goalLineColor}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Goal ${summary.dailyGoalMinutes}m`,
                    position: 'insideTopRight',
                    fill: goalLineColor,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                />
                <Bar
                  dataKey="courseMinutes"
                  name="Courses"
                  stackId="study"
                  fill="#2563eb"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="labMinutes"
                  name="Hands-on Labs"
                  stackId="study"
                  fill="#06b6d4"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="practiceMinutes"
                  name="Practice Tools"
                  stackId="study"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={summary.days}
                margin={{ top: 14, right: 12, left: -12, bottom: 2 }}
              >
                <defs>
                  <linearGradient id="weeklyStudyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={gridStrokeColor}
                />
                <XAxis
                  dataKey="axisLabel"
                  tickLine={false}
                  axisLine={{ stroke: gridStrokeColor }}
                  tick={{ fill: axisTickColor, fontSize: 12, fontWeight: 500 }}
                  dy={6}
                />
                <YAxis
                  domain={[0, yAxisMax]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  tickFormatter={(val: number) => `${val}m`}
                  width={48}
                />
                <Tooltip content={<TrendsTooltip />} />
                <ReferenceLine
                  y={summary.dailyGoalMinutes}
                  stroke={goalLineColor}
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Goal ${summary.dailyGoalMinutes}m`,
                    position: 'insideTopRight',
                    fill: goalLineColor,
                    fontSize: 11,
                    fontWeight: 600
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="totalMinutes"
                  name="Total Study"
                  stroke={isDarkMode ? '#22d3ee' : '#2563eb'}
                  strokeWidth={2.5}
                  fill="url(#weeklyStudyAreaGrad)"
                  dot={{
                    r: 4,
                    fill: isDarkMode ? '#0c1220' : '#ffffff',
                    stroke: isDarkMode ? '#22d3ee' : '#2563eb',
                    strokeWidth: 2
                  }}
                  activeDot={{
                    r: 6,
                    fill: isDarkMode ? '#22d3ee' : '#2563eb',
                    stroke: '#ffffff',
                    strokeWidth: 2
                  }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Clean Unboxed Legend */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-600 dark:text-slate-300">
          {chartMode === 'bars' ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 shrink-0" />
                <span>Courses</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500 shrink-0" />
                <span>Hands-on Labs</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-violet-500 shrink-0" />
                <span>Practice Tools</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-emerald-600 dark:border-emerald-400 shrink-0" />
                <span className="font-mono tabular-nums">
                  Daily goal ({summary.dailyGoalMinutes}m)
                </span>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-blue-600 dark:border-cyan-400 shrink-0" />
                <span>Total study minutes</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-emerald-600 dark:border-emerald-400 shrink-0" />
                <span className="font-mono tabular-nums">
                  Daily goal ({summary.dailyGoalMinutes}m)
                </span>
              </span>
            </div>
          )}

          <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
            {summary.activeDaysCount}/7 active days
          </span>
        </div>
      </div>

      {/* Empty-state helper bar when no minutes have been logged yet */}
      {!summary.hasAnyStudyData && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            No study minutes recorded in the past 7 days yet. Open any course lesson or launch a lab to start logging real-time study progress.
          </p>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {hasEnrolledCourses && onContinueCourse ? (
              <button
                type="button"
                onClick={onContinueCourse}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Continue Course</span>
              </button>
            ) : (
              onBrowseCourses && (
                <button
                  type="button"
                  onClick={onBrowseCourses}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Browse Courses</span>
                </button>
              )
            )}
            {onOpenLab && (
              <button
                type="button"
                onClick={onOpenLab}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                <span>Open CLI Lab</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
