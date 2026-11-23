import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  GraduationCap,
  Layers,
  Lock,
  Play,
  Target,
  Terminal,
  X,
  Zap
} from 'lucide-react';
import {
  ComputedMilestoneBadge,
  ComputedMilestoneOverview,
  MilestoneCategory,
  MilestoneIconKey,
  MilestoneTier
} from '../../utils/milestoneBadges';
import { formatStudyDuration } from '../../utils/studyGoal';

interface MilestoneBadgesCardProps {
  overview: ComputedMilestoneOverview;
  hasEnrolledCourses: boolean;
  onContinueCourse?: () => void;
  onBrowseCourses?: () => void;
  onOpenLab: () => void;
}

type BadgeFilterTab = 'all' | MilestoneCategory;

function renderMilestoneIcon(iconKey: MilestoneIconKey, className = 'w-5 h-5') {
  switch (iconKey) {
    case 'clock':
      return <Clock className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'terminal':
      return <Terminal className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'book':
      return <BookOpen className={className} />;
    case 'layers':
      return <Layers className={className} />;
    case 'compass':
      return <Compass className={className} />;
    case 'graduation':
      return <GraduationCap className={className} />;
    case 'award':
    default:
      return <Award className={className} />;
  }
}

function getTierLabel(tier: MilestoneTier): string {
  switch (tier) {
    case 'platinum':
      return 'Platinum';
    case 'gold':
      return 'Gold';
    case 'silver':
      return 'Silver';
    case 'bronze':
    default:
      return 'Bronze';
  }
}

function getMedalStyles(tier: MilestoneTier, unlocked: boolean): {
  ring: string;
  core: string;
  cardSurface: string;
  accentText: string;
  progressFill: string;
} {
  if (!unlocked) {
    return {
      ring: 'border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-900/60',
      core: 'bg-slate-200/80 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
      cardSurface:
        'bg-slate-50/70 dark:bg-slate-900/45 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
      accentText: 'text-slate-500 dark:text-slate-400',
      progressFill: 'bg-blue-600 dark:bg-cyan-500'
    };
  }

  switch (tier) {
    case 'platinum':
      return {
        ring: 'border-cyan-400/70 dark:border-cyan-500/50 bg-cyan-50 dark:bg-cyan-950/40',
        core: 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-sm',
        cardSurface:
          'bg-white dark:bg-slate-900/90 border-cyan-300/80 dark:border-cyan-700/60 hover:border-cyan-400 dark:hover:border-cyan-500',
        accentText: 'text-cyan-700 dark:text-cyan-300',
        progressFill: 'bg-cyan-500'
      };
    case 'gold':
      return {
        ring: 'border-amber-400/80 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/40',
        core: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm',
        cardSurface:
          'bg-white dark:bg-slate-900/90 border-amber-300/80 dark:border-amber-700/60 hover:border-amber-400 dark:hover:border-amber-500',
        accentText: 'text-amber-700 dark:text-amber-300',
        progressFill: 'bg-amber-500'
      };
    case 'silver':
      return {
        ring: 'border-blue-300 dark:border-blue-600/60 bg-blue-50 dark:bg-blue-950/40',
        core: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm',
        cardSurface:
          'bg-white dark:bg-slate-900/90 border-blue-200 dark:border-blue-800/70 hover:border-blue-400 dark:hover:border-blue-600',
        accentText: 'text-blue-700 dark:text-blue-300',
        progressFill: 'bg-blue-600'
      };
    case 'bronze':
    default:
      return {
        ring: 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40',
        core: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm',
        cardSurface:
          'bg-white dark:bg-slate-900/90 border-emerald-200 dark:border-emerald-800/70 hover:border-emerald-400 dark:hover:border-emerald-600',
        accentText: 'text-emerald-700 dark:text-emerald-300',
        progressFill: 'bg-emerald-500'
      };
  }
}

function formatEarnedDate(iso: string | null): string {
  if (!iso) return 'Earned';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'Earned';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

export const MilestoneBadgesCard: React.FC<MilestoneBadgesCardProps> = ({
  overview,
  hasEnrolledCourses,
  onContinueCourse,
  onBrowseCourses,
  onOpenLab
}) => {
  const [activeTab, setActiveTab] = useState<BadgeFilterTab>('all');
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

  const visibleBadges = useMemo(() => {
    if (activeTab === 'all') return overview.badges;
    return overview.badges.filter(b => b.category === activeTab);
  }, [overview.badges, activeTab]);

  const selectedBadge: ComputedMilestoneBadge | null = useMemo(() => {
    if (!selectedBadgeId) return null;
    return overview.badges.find(b => b.id === selectedBadgeId) ?? null;
  }, [overview.badges, selectedBadgeId]);

  const handleActionForBadge = (badge: ComputedMilestoneBadge) => {
    if (badge.actionHint === 'lab') {
      onOpenLab();
      return;
    }
    if (badge.actionHint === 'study_goal') {
      document
        .getElementById('daily-study-goal-card')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (hasEnrolledCourses && onContinueCourse) {
      onContinueCourse();
    } else if (onBrowseCourses) {
      onBrowseCourses();
    }
  };

  const getActionButtonLabel = (badge: ComputedMilestoneBadge): string => {
    if (badge.actionHint === 'lab') return 'Open CLI Lab';
    if (badge.actionHint === 'study_goal') return 'View Daily Study Goal';
    return hasEnrolledCourses ? 'Continue Active Course' : 'Browse Catalog';
  };

  return (
    <section
      id="milestone-badges-section"
      aria-label="Virtual Milestone Badges for Study Time and Course Completion"
      className="rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-6 space-y-5"
    >
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-500 shrink-0" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Milestone Badges
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {overview.earnedCount}/{overview.totalCount} unlocked · {overview.completionPercent}%
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Virtual awards unlocked as you hit study-time targets and complete course milestones.
            <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
              {' '}
              · Total study logged:{' '}
              <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                {overview.cumulativeStudySeconds > 0
                  ? formatStudyDuration(overview.cumulativeStudySeconds)
                  : '0m'}
              </strong>
              {' · '}
              Modules done:{' '}
              <strong className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
                {overview.completedModulesCount}
              </strong>
            </span>
          </p>
        </div>

        {/* Interactive Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filter milestone badges"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 self-start lg:self-auto shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({overview.earnedCount}/{overview.totalCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'study_time'}
            onClick={() => setActiveTab('study_time')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'study_time'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Study Time ({overview.studyTimeEarnedCount}/{overview.studyTimeTotalCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'course_completion'}
            onClick={() => setActiveTab('course_completion')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'course_completion'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Course Mastery ({overview.courseCompletionEarnedCount}/{overview.courseCompletionTotalCount})
          </button>
        </div>
      </div>

      {/* Overall Milestone Progress & Next Closest Callout */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {overview.nextClosestBadge ? (
            <button
              type="button"
              onClick={() => setSelectedBadgeId(overview.nextClosestBadge!.id)}
              className="text-left text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors cursor-pointer"
            >
              Next closest milestone:{' '}
              <strong className="text-slate-900 dark:text-white">
                {overview.nextClosestBadge.title}
              </strong>{' '}
              <span className="font-mono tabular-nums text-blue-600 dark:text-cyan-400">
                ({overview.nextClosestBadge.progressText} · {overview.nextClosestBadge.progressPercent}%)
              </span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>All milestone badges unlocked!</span>
            </span>
          )}

          {overview.recentlyUnlockedBadge && (
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Latest earned:{' '}
              <strong className="text-slate-700 dark:text-slate-200">
                {overview.recentlyUnlockedBadge.title}
              </strong>
            </span>
          )}
        </div>

        <div
          role="progressbar"
          aria-valuenow={overview.completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall milestone badges unlocked ${overview.completionPercent}%`}
          className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${overview.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Virtual Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {visibleBadges.map(badge => {
          const styles = getMedalStyles(badge.tier, badge.unlocked);
          const isSelected = selectedBadgeId === badge.id;

          return (
            <button
              key={badge.id}
              type="button"
              onClick={() =>
                setSelectedBadgeId(prev => (prev === badge.id ? null : badge.id))
              }
              aria-pressed={isSelected}
              className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                styles.cardSurface
              } ${
                isSelected
                  ? 'ring-2 ring-blue-500/70 dark:ring-cyan-400/70'
                  : ''
              }`}
            >
              <div className="space-y-3">
                {/* Top: Virtual Medallion Emblem & State */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center shrink-0 transition-transform ${styles.ring}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center ${styles.core}`}
                    >
                      {renderMilestoneIcon(badge.iconKey, 'w-4 h-4')}
                    </div>
                  </div>

                  {badge.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Earned</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>{badge.progressPercent}%</span>
                    </span>
                  )}
                </div>

                {/* Metadata & Title */}
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    <span className={badge.unlocked ? styles.accentText : ''}>
                      {getTierLabel(badge.tier)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{badge.categoryLabel}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug truncate">
                    {badge.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {badge.subtitle}
                  </p>
                </div>
              </div>

              {/* Footer Progress / Earned Timestamp */}
              <div className="space-y-1.5 pt-1">
                <div
                  role="progressbar"
                  aria-valuenow={badge.progressPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${badge.title} progress ${badge.progressPercent}%`}
                  className="h-1.5 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${styles.progressFill}`}
                    style={{ width: `${badge.progressPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                  <span
                    className={
                      badge.unlocked
                        ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                        : 'text-slate-500 dark:text-slate-400'
                    }
                  >
                    {badge.unlocked
                      ? `Earned ${formatEarnedDate(badge.unlockedAt)}`
                      : badge.progressText}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Badge Details Bar */}
      {selectedBadge && (
        <div
          role="region"
          aria-label={`Details for ${selectedBadge.title} milestone badge`}
          className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center shrink-0 ${
                getMedalStyles(selectedBadge.tier, selectedBadge.unlocked).ring
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  getMedalStyles(selectedBadge.tier, selectedBadge.unlocked).core
                }`}
              >
                {renderMilestoneIcon(selectedBadge.iconKey, 'w-4 h-4')}
              </div>
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <strong className="text-slate-900 dark:text-white">
                  {selectedBadge.title}
                </strong>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {getTierLabel(selectedBadge.tier)} {selectedBadge.categoryLabel}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Goal: {selectedBadge.criteriaLabel}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedBadge.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {!selectedBadge.unlocked && (
              <button
                type="button"
                onClick={() => handleActionForBadge(selectedBadge)}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{getActionButtonLabel(selectedBadge)}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedBadgeId(null)}
              aria-label="Close badge details"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
