import { Course, User } from '../types';
import { ComputedDailyStudyGoal, formatStudyDuration } from './studyGoal';
import { getLocalDateKey } from './learningStreak';

export type MilestoneCategory = 'study_time' | 'course_completion';
export type MilestoneTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type MilestoneIconKey =
  | 'clock'
  | 'target'
  | 'zap'
  | 'terminal'
  | 'flame'
  | 'book'
  | 'layers'
  | 'compass'
  | 'graduation'
  | 'award';

export interface MilestoneBadgeUnlockRecord {
  badgeId: string;
  unlockedAt: string; // ISO timestamp
}

export interface MilestoneTrackerData {
  cumulativeCourseSeconds: number;
  cumulativeLabSeconds: number;
  cumulativePracticeSeconds: number;
  lastSyncedDateKey: string;
  lastSyncedCourseSeconds: number;
  lastSyncedLabSeconds: number;
  lastSyncedPracticeSeconds: number;
  goalReachedDateKeys: string[];
  unlockedBadges: Record<string, MilestoneBadgeUnlockRecord>;
  updatedAt?: string;
}

export interface ComputedMilestoneBadge {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: MilestoneCategory;
  categoryLabel: string;
  tier: MilestoneTier;
  criteriaLabel: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  progressText: string;
  unlocked: boolean;
  unlockedAt: string | null;
  iconKey: MilestoneIconKey;
  actionHint: 'course' | 'lab' | 'study_goal';
}

export interface ComputedMilestoneOverview {
  badges: ComputedMilestoneBadge[];
  earnedCount: number;
  totalCount: number;
  completionPercent: number;
  studyTimeEarnedCount: number;
  studyTimeTotalCount: number;
  courseCompletionEarnedCount: number;
  courseCompletionTotalCount: number;
  cumulativeStudySeconds: number;
  cumulativeLabSeconds: number;
  goalReachedDaysCount: number;
  completedModulesCount: number;
  completedCoursesCount: number;
  certificatesCount: number;
  nextClosestBadge: ComputedMilestoneBadge | null;
  recentlyUnlockedBadge: ComputedMilestoneBadge | null;
}

const MILESTONE_STORAGE_PREFIX = 'netpulse_milestone_badges_v1_';
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function clampNonNegativeInt(value: unknown, max = 315_360_000): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(max, Math.round(num));
}

function sanitizeDateKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  for (const item of input) {
    if (typeof item === 'string' && DATE_KEY_REGEX.test(item.trim())) {
      unique.add(item.trim());
    }
    if (unique.size >= 365) break;
  }
  return Array.from(unique).sort();
}

function sanitizeUnlockedMap(
  input: unknown
): Record<string, MilestoneBadgeUnlockRecord> {
  if (!input || typeof input !== 'object') return {};
  const result: Record<string, MilestoneBadgeUnlockRecord> = {};
  for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
    if (
      val &&
      typeof val === 'object' &&
      typeof (val as MilestoneBadgeUnlockRecord).badgeId === 'string' &&
      typeof (val as MilestoneBadgeUnlockRecord).unlockedAt === 'string'
    ) {
      result[key] = {
        badgeId: (val as MilestoneBadgeUnlockRecord).badgeId,
        unlockedAt: (val as MilestoneBadgeUnlockRecord).unlockedAt
      };
    }
  }
  return result;
}

export function createEmptyMilestoneTrackerData(
  referenceDate: Date = new Date()
): MilestoneTrackerData {
  return {
    cumulativeCourseSeconds: 0,
    cumulativeLabSeconds: 0,
    cumulativePracticeSeconds: 0,
    lastSyncedDateKey: getLocalDateKey(referenceDate),
    lastSyncedCourseSeconds: 0,
    lastSyncedLabSeconds: 0,
    lastSyncedPracticeSeconds: 0,
    goalReachedDateKeys: [],
    unlockedBadges: {}
  };
}

export function normalizeMilestoneTrackerData(
  raw: Partial<MilestoneTrackerData> | null | undefined,
  referenceDate: Date = new Date()
): MilestoneTrackerData {
  const todayKey = getLocalDateKey(referenceDate);
  const lastSyncedDateKey =
    typeof raw?.lastSyncedDateKey === 'string' && DATE_KEY_REGEX.test(raw.lastSyncedDateKey)
      ? raw.lastSyncedDateKey
      : todayKey;

  const isSameDay = lastSyncedDateKey === todayKey;

  return {
    cumulativeCourseSeconds: clampNonNegativeInt(raw?.cumulativeCourseSeconds),
    cumulativeLabSeconds: clampNonNegativeInt(raw?.cumulativeLabSeconds),
    cumulativePracticeSeconds: clampNonNegativeInt(raw?.cumulativePracticeSeconds),
    lastSyncedDateKey: todayKey,
    lastSyncedCourseSeconds: isSameDay ? clampNonNegativeInt(raw?.lastSyncedCourseSeconds, 86400) : 0,
    lastSyncedLabSeconds: isSameDay ? clampNonNegativeInt(raw?.lastSyncedLabSeconds, 86400) : 0,
    lastSyncedPracticeSeconds: isSameDay
      ? clampNonNegativeInt(raw?.lastSyncedPracticeSeconds, 86400)
      : 0,
    goalReachedDateKeys: sanitizeDateKeys(raw?.goalReachedDateKeys),
    unlockedBadges: sanitizeUnlockedMap(raw?.unlockedBadges),
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined
  };
}

export function loadLocalMilestoneTracker(userId: string): MilestoneTrackerData {
  if (!userId) return createEmptyMilestoneTrackerData();
  try {
    const raw = localStorage.getItem(`${MILESTONE_STORAGE_PREFIX}${userId}`);
    if (!raw) return createEmptyMilestoneTrackerData();
    return normalizeMilestoneTrackerData(JSON.parse(raw) as Partial<MilestoneTrackerData>);
  } catch {
    return createEmptyMilestoneTrackerData();
  }
}

export function saveLocalMilestoneTracker(userId: string, data: MilestoneTrackerData): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${MILESTONE_STORAGE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Synchronizes cumulative study counters against today's ComputedDailyStudyGoal
 * without double-counting already-synced seconds for the same calendar date.
 */
export function syncStudyGoalIntoMilestoneTracker(
  prev: MilestoneTrackerData,
  dailyGoal: ComputedDailyStudyGoal,
  referenceDate: Date = new Date()
): { next: MilestoneTrackerData; changed: boolean } {
  const normalized = normalizeMilestoneTrackerData(prev, referenceDate);
  const todayKey = dailyGoal.dateKey || getLocalDateKey(referenceDate);

  const deltaCourse = Math.max(0, dailyGoal.courseSeconds - normalized.lastSyncedCourseSeconds);
  const deltaLab = Math.max(0, dailyGoal.labSeconds - normalized.lastSyncedLabSeconds);
  const deltaPractice = Math.max(
    0,
    dailyGoal.practiceSeconds - normalized.lastSyncedPracticeSeconds
  );

  const nextCourseTotal = Math.max(
    normalized.cumulativeCourseSeconds + deltaCourse,
    dailyGoal.courseSeconds
  );
  const nextLabTotal = Math.max(
    normalized.cumulativeLabSeconds + deltaLab,
    dailyGoal.labSeconds
  );
  const nextPracticeTotal = Math.max(
    normalized.cumulativePracticeSeconds + deltaPractice,
    dailyGoal.practiceSeconds
  );

  const nextGoalDates =
    dailyGoal.goalReached && !normalized.goalReachedDateKeys.includes(todayKey)
      ? [...normalized.goalReachedDateKeys, todayKey].sort().slice(-365)
      : normalized.goalReachedDateKeys;

  const changed =
    nextCourseTotal !== normalized.cumulativeCourseSeconds ||
    nextLabTotal !== normalized.cumulativeLabSeconds ||
    nextPracticeTotal !== normalized.cumulativePracticeSeconds ||
    dailyGoal.courseSeconds !== normalized.lastSyncedCourseSeconds ||
    dailyGoal.labSeconds !== normalized.lastSyncedLabSeconds ||
    dailyGoal.practiceSeconds !== normalized.lastSyncedPracticeSeconds ||
    nextGoalDates.length !== normalized.goalReachedDateKeys.length;

  if (!changed) {
    return { next: normalized, changed: false };
  }

  return {
    next: {
      ...normalized,
      cumulativeCourseSeconds: nextCourseTotal,
      cumulativeLabSeconds: nextLabTotal,
      cumulativePracticeSeconds: nextPracticeTotal,
      lastSyncedDateKey: todayKey,
      lastSyncedCourseSeconds: dailyGoal.courseSeconds,
      lastSyncedLabSeconds: dailyGoal.labSeconds,
      lastSyncedPracticeSeconds: dailyGoal.practiceSeconds,
      goalReachedDateKeys: nextGoalDates,
      updatedAt: new Date().toISOString()
    },
    changed: true
  };
}

export function countCompletedCourses(user: User, courses: Course[]): number {
  const completedSet = new Set(user.completedModuleIds);
  let completedCourses = 0;

  for (const course of courses) {
    if (!user.enrolledCourseIds.includes(course.id)) continue;
    if (course.modules.length === 0) continue;
    const allDone = course.modules.every(m => completedSet.has(m.id));
    if (allDone) {
      completedCourses += 1;
    }
  }

  return completedCourses;
}

interface MilestoneBadgeBlueprint {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: MilestoneCategory;
  tier: MilestoneTier;
  criteriaLabel: string;
  targetValue: number;
  iconKey: MilestoneIconKey;
  actionHint: 'course' | 'lab' | 'study_goal';
  measure: (metrics: {
    cumulativeStudySeconds: number;
    cumulativeLabSeconds: number;
    goalReachedDaysCount: number;
    completedModulesCount: number;
    completedCoursesCount: number;
    certificatesCount: number;
  }) => { currentValue: number; progressText: string };
}

const MILESTONE_BADGE_DEFINITIONS: MilestoneBadgeBlueprint[] = [
  // Study Time Goals
  {
    id: 'study-15m',
    title: 'First Signal',
    subtitle: '15 Min Study Time',
    description: 'Accumulate 15 minutes of active study across courses, labs, or flashcards.',
    category: 'study_time',
    tier: 'bronze',
    criteriaLabel: '15 min total study',
    targetValue: 900,
    iconKey: 'clock',
    actionHint: 'course',
    measure: ({ cumulativeStudySeconds }) => ({
      currentValue: Math.min(900, cumulativeStudySeconds),
      progressText: `${formatStudyDuration(Math.min(900, cumulativeStudySeconds))} / 15m`
    })
  },
  {
    id: 'study-daily-goal',
    title: 'Target Lock',
    subtitle: 'Daily Goal Met',
    description: 'Reach 100% of your personalized daily study time target in a single day.',
    category: 'study_time',
    tier: 'silver',
    criteriaLabel: '1 daily goal reached',
    targetValue: 1,
    iconKey: 'target',
    actionHint: 'study_goal',
    measure: ({ goalReachedDaysCount }) => ({
      currentValue: Math.min(1, goalReachedDaysCount),
      progressText: `${Math.min(1, goalReachedDaysCount)} / 1 day`
    })
  },
  {
    id: 'study-1h',
    title: 'Deep Focus',
    subtitle: '1 Hour Study Time',
    description: 'Log 60 cumulative minutes of focused networking study time.',
    category: 'study_time',
    tier: 'silver',
    criteriaLabel: '60 min total study',
    targetValue: 3600,
    iconKey: 'zap',
    actionHint: 'course',
    measure: ({ cumulativeStudySeconds }) => ({
      currentValue: Math.min(3600, cumulativeStudySeconds),
      progressText: `${formatStudyDuration(Math.min(3600, cumulativeStudySeconds))} / 1h`
    })
  },
  {
    id: 'study-lab-30m',
    title: 'CLI Tactician',
    subtitle: '30 Min Lab Time',
    description: 'Spend 30 minutes building topologies and practicing Cisco IOS commands.',
    category: 'study_time',
    tier: 'gold',
    criteriaLabel: '30 min CLI lab time',
    targetValue: 1800,
    iconKey: 'terminal',
    actionHint: 'lab',
    measure: ({ cumulativeLabSeconds }) => ({
      currentValue: Math.min(1800, cumulativeLabSeconds),
      progressText: `${formatStudyDuration(Math.min(1800, cumulativeLabSeconds))} / 30m`
    })
  },
  {
    id: 'study-5h',
    title: 'Packet Scholar',
    subtitle: '5 Hours Study Time',
    description: 'Reach 5 cumulative hours of study across curriculum lessons and labs.',
    category: 'study_time',
    tier: 'platinum',
    criteriaLabel: '5 hrs total study',
    targetValue: 18000,
    iconKey: 'flame',
    actionHint: 'course',
    measure: ({ cumulativeStudySeconds }) => ({
      currentValue: Math.min(18000, cumulativeStudySeconds),
      progressText: `${formatStudyDuration(Math.min(18000, cumulativeStudySeconds))} / 5h`
    })
  },

  // Course Completion Goals
  {
    id: 'course-mod-1',
    title: 'First Hop',
    subtitle: '1 Module Completed',
    description: 'Complete your first theory lesson, video, lab, or quiz module.',
    category: 'course_completion',
    tier: 'bronze',
    criteriaLabel: '1 module completed',
    targetValue: 1,
    iconKey: 'book',
    actionHint: 'course',
    measure: ({ completedModulesCount }) => ({
      currentValue: Math.min(1, completedModulesCount),
      progressText: `${Math.min(1, completedModulesCount)} / 1 module`
    })
  },
  {
    id: 'course-mod-5',
    title: 'Subnet Builder',
    subtitle: '5 Modules Completed',
    description: 'Complete 5 curriculum modules across your enrolled academy courses.',
    category: 'course_completion',
    tier: 'silver',
    criteriaLabel: '5 modules completed',
    targetValue: 5,
    iconKey: 'layers',
    actionHint: 'course',
    measure: ({ completedModulesCount }) => ({
      currentValue: Math.min(5, completedModulesCount),
      progressText: `${Math.min(5, completedModulesCount)} / 5 modules`
    })
  },
  {
    id: 'course-mod-15',
    title: 'Core Architect',
    subtitle: '15 Modules Completed',
    description: 'Complete 15 curriculum modules across networking engineering tracks.',
    category: 'course_completion',
    tier: 'gold',
    criteriaLabel: '15 modules completed',
    targetValue: 15,
    iconKey: 'compass',
    actionHint: 'course',
    measure: ({ completedModulesCount }) => ({
      currentValue: Math.min(15, completedModulesCount),
      progressText: `${Math.min(15, completedModulesCount)} / 15 modules`
    })
  },
  {
    id: 'course-complete-1',
    title: 'Track Graduate',
    subtitle: '1 Course Completed',
    description: 'Finish 100% of all required modules in an enrolled academy course.',
    category: 'course_completion',
    tier: 'gold',
    criteriaLabel: '1 full course completed',
    targetValue: 1,
    iconKey: 'graduation',
    actionHint: 'course',
    measure: ({ completedCoursesCount }) => ({
      currentValue: Math.min(1, completedCoursesCount),
      progressText: `${Math.min(1, completedCoursesCount)} / 1 course`
    })
  },
  {
    id: 'course-cert-1',
    title: 'Certified Pro',
    subtitle: 'Certificate Earned',
    description: 'Earn an official verified Netplus Academy certification credential.',
    category: 'course_completion',
    tier: 'platinum',
    criteriaLabel: '1 certificate earned',
    targetValue: 1,
    iconKey: 'award',
    actionHint: 'course',
    measure: ({ certificatesCount }) => ({
      currentValue: Math.min(1, certificatesCount),
      progressText: `${Math.min(1, certificatesCount)} / 1 cert`
    })
  }
];

export function computeMilestoneBadgesOverview(params: {
  user: User;
  courses: Course[];
  dailyGoal: ComputedDailyStudyGoal;
  trackerData: MilestoneTrackerData;
}): ComputedMilestoneOverview {
  const { user, courses, dailyGoal, trackerData } = params;
  const todayKey = dailyGoal.dateKey || getLocalDateKey(new Date());

  const { next: syncedTracker } = syncStudyGoalIntoMilestoneTracker(trackerData, dailyGoal);

  const cumulativeStudySeconds =
    syncedTracker.cumulativeCourseSeconds +
    syncedTracker.cumulativeLabSeconds +
    syncedTracker.cumulativePracticeSeconds;
  const cumulativeLabSeconds = syncedTracker.cumulativeLabSeconds;
  const goalReachedDaysCount = Math.max(
    syncedTracker.goalReachedDateKeys.length,
    dailyGoal.goalReached && syncedTracker.goalReachedDateKeys.includes(todayKey) ? 1 : dailyGoal.goalReached ? 1 : 0
  );

  const completedModulesCount = user.completedModuleIds.length;
  const completedCoursesCount = countCompletedCourses(user, courses);
  const certificatesCount = user.certificates.length;

  const badges: ComputedMilestoneBadge[] = MILESTONE_BADGE_DEFINITIONS.map(def => {
    const measured = def.measure({
      cumulativeStudySeconds,
      cumulativeLabSeconds,
      goalReachedDaysCount,
      completedModulesCount,
      completedCoursesCount,
      certificatesCount
    });
    const unlockedRecord = syncedTracker.unlockedBadges[def.id];
    const criteriaMet = measured.currentValue >= def.targetValue;
    const unlocked = Boolean(unlockedRecord || criteriaMet);
    const progressPercent = unlocked
      ? 100
      : def.targetValue > 0
      ? Math.min(99, Math.max(0, Math.round((measured.currentValue / def.targetValue) * 100)))
      : 0;

    return {
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      description: def.description,
      category: def.category,
      categoryLabel: def.category === 'study_time' ? 'Study Time' : 'Course Completion',
      tier: def.tier,
      criteriaLabel: def.criteriaLabel,
      currentValue: unlocked ? def.targetValue : measured.currentValue,
      targetValue: def.targetValue,
      progressPercent,
      progressText: unlocked ? 'Goal achieved' : measured.progressText,
      unlocked,
      unlockedAt: unlockedRecord?.unlockedAt ?? null,
      iconKey: def.iconKey,
      actionHint: def.actionHint
    };
  });

  const earnedBadges = badges.filter(b => b.unlocked);
  const lockedBadges = badges.filter(b => !b.unlocked);
  const studyBadges = badges.filter(b => b.category === 'study_time');
  const courseBadges = badges.filter(b => b.category === 'course_completion');

  const nextClosestBadge =
    [...lockedBadges].sort((a, b) => b.progressPercent - a.progressPercent)[0] ?? null;

  const recentlyUnlockedBadge =
    [...earnedBadges].sort((a, b) => {
      const aTime = a.unlockedAt ? Date.parse(a.unlockedAt) : 0;
      const bTime = b.unlockedAt ? Date.parse(b.unlockedAt) : 0;
      return bTime - aTime;
    })[0] ?? null;

  return {
    badges,
    earnedCount: earnedBadges.length,
    totalCount: badges.length,
    completionPercent:
      badges.length > 0 ? Math.round((earnedBadges.length / badges.length) * 100) : 0,
    studyTimeEarnedCount: studyBadges.filter(b => b.unlocked).length,
    studyTimeTotalCount: studyBadges.length,
    courseCompletionEarnedCount: courseBadges.filter(b => b.unlocked).length,
    courseCompletionTotalCount: courseBadges.length,
    cumulativeStudySeconds,
    cumulativeLabSeconds,
    goalReachedDaysCount,
    completedModulesCount,
    completedCoursesCount,
    certificatesCount,
    nextClosestBadge,
    recentlyUnlockedBadge
  };
}

/**
 * Stamps unlock timestamps into trackerData for any newly satisfied badges and returns
 * the list of newly unlocked badges (so caller can fire achievement notifications).
 */
export function reconcileUnlockedBadges(params: {
  user: User;
  courses: Course[];
  dailyGoal: ComputedDailyStudyGoal;
  trackerData: MilestoneTrackerData;
}): {
  nextTracker: MilestoneTrackerData;
  newlyUnlocked: ComputedMilestoneBadge[];
  changed: boolean;
} {
  const { next: synced, changed: studyChanged } = syncStudyGoalIntoMilestoneTracker(
    params.trackerData,
    params.dailyGoal
  );

  const overview = computeMilestoneBadgesOverview({
    user: params.user,
    courses: params.courses,
    dailyGoal: params.dailyGoal,
    trackerData: synced
  });

  const nowIso = new Date().toISOString();
  const nextUnlockedMap = { ...synced.unlockedBadges };
  const newlyUnlocked: ComputedMilestoneBadge[] = [];

  for (const badge of overview.badges) {
    if (badge.unlocked && !nextUnlockedMap[badge.id]) {
      nextUnlockedMap[badge.id] = {
        badgeId: badge.id,
        unlockedAt: nowIso
      };
      newlyUnlocked.push({
        ...badge,
        unlockedAt: nowIso
      });
    }
  }

  const changed = studyChanged || newlyUnlocked.length > 0;
  if (!changed) {
    return { nextTracker: synced, newlyUnlocked: [], changed: false };
  }

  return {
    nextTracker: {
      ...synced,
      unlockedBadges: nextUnlockedMap,
      updatedAt: nowIso
    },
    newlyUnlocked,
    changed: true
  };
}
