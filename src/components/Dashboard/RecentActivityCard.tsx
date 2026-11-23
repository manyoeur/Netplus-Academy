import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Binary,
  BookOpen,
  Calculator,
  Compass,
  Gamepad2,
  History,
  Terminal
} from 'lucide-react';
import {
  HydratedRecentActivityItem,
  LabToolTabId,
  RecentActivityKind
} from '../../utils/recentActivity';

type ActivityFilter = 'all' | RecentActivityKind;

interface RecentActivityCardProps {
  activities: HydratedRecentActivityItem[];
  onSelectCourse: (courseId: string) => void;
  onOpenLabTab: (tabId: LabToolTabId) => void;
  onBrowseCourses?: () => void;
}

function getLabIcon(tabId?: string) {
  switch (tabId) {
    case 'subnet-calc':
      return Calculator;
    case 'base-converter':
      return Binary;
    case 'binary-game':
      return Gamepad2;
    case 'lab-sandbox':
    default:
      return Terminal;
  }
}

export const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
  activities,
  onSelectCourse,
  onOpenLabTab,
  onBrowseCourses
}) => {
  const [filter, setFilter] = useState<ActivityFilter>('all');

  const visibleActivities = useMemo(() => {
    const filtered =
      filter === 'all'
        ? activities
        : activities.filter(item => item.kind === filter);
    return filtered.slice(0, 5);
  }, [activities, filter]);

  const handleOpenItem = (item: HydratedRecentActivityItem) => {
    if (item.kind === 'course') {
      onSelectCourse(item.courseId || item.targetId);
      return;
    }
    const targetLab: LabToolTabId = item.labTabId || 'lab-sandbox';
    onOpenLabTab(targetLab);
  };

  return (
    <section
      aria-label="Recent Activity"
      className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Activity
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {visibleActivities.length}/5 recent
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Last 5 accessed courses and hands-on labs with timestamps.
            </p>
          </div>
        </div>

        {/* Segmented Filter */}
        <div
          role="group"
          aria-label="Filter recent activity"
          className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
        >
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'course', label: 'Courses' },
              { id: 'lab', label: 'Labs' }
            ] as const
          ).map(tab => {
            const isActive = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                aria-pressed={isActive}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List or Empty State */}
      {visibleActivities.length === 0 ? (
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {filter === 'course'
                ? 'No recent courses recorded yet'
                : filter === 'lab'
                ? 'No recent hands-on labs recorded yet'
                : 'No recent course or lab activity yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filter === 'lab'
                ? 'Launch the CLI Lab Simulator, Subnet Calculator, or Binary tools to log your lab sessions here.'
                : 'Open a curriculum module or launch a networking lab and your last 5 sessions will appear here with timestamps.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {filter !== 'lab' && onBrowseCourses && (
              <button
                type="button"
                onClick={onBrowseCourses}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Browse Courses</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenLabTab('lab-sandbox')}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-500" />
              <span>Open CLI Lab</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {visibleActivities.map(item => {
            const isCourse = item.kind === 'course';
            const ItemIcon = isCourse ? BookOpen : getLabIcon(item.labTabId);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOpenItem(item)}
                title={`${item.title} · Last accessed ${item.fullDateTimeTitle}`}
                className="w-full text-left px-4 py-3 bg-white dark:bg-[#0c1220] hover:bg-slate-50/90 dark:hover:bg-slate-900/70 transition-colors flex items-center justify-between gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isCourse
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200/70 dark:border-blue-800/60 text-blue-600 dark:text-cyan-400'
                        : 'bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200/70 dark:border-cyan-800/60 text-cyan-600 dark:text-cyan-400'
                    }`}
                  >
                    <ItemIcon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {isCourse ? 'Course' : 'Hands-on Lab'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-semibold text-blue-600 dark:text-cyan-400 truncate">
                        {item.codeOrCategory}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors">
                      {item.title}
                    </p>

                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-semibold font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {item.relativeTimeLabel}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap">
                      {item.exactTimeLabel}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
