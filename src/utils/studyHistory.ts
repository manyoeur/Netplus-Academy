import { getLocalDateKey, shiftDateKey } from './learningStreak';
import type { ComputedDailyStudyGoal, DailyStudyGoalData } from './studyGoal';

export interface DailyStudyHistoryRecord {
  dateKey: string; // YYYY-MM-DD (local calendar date)
  courseSeconds: number;
  labSeconds: number;
  practiceSeconds: number;
  totalSeconds: number;
  goalMinutes?: number;
  updatedAt?: string;
}

export type StudyHistoryMap = Record<string, DailyStudyHistoryRecord>;

export interface WeeklyStudyDayPoint {
  dateKey: string;
  axisLabel: string;
  weekdayShort: string;
  dateLabel: string;
  fullDateLabel: string;
  isToday: boolean;
  courseSeconds: number;
  labSeconds: number;
  practiceSeconds: number;
  totalSeconds: number;
  courseMinutes: number;
  labMinutes: number;
  practiceMinutes: number;
  totalMinutes: number;
  goalMinutes: number;
  goalMet: boolean;
  goalPercent: number;
}

export interface WeeklyLearningTrendsSummary {
  days: WeeklyStudyDayPoint[];
  totalSeconds7d: number;
  averageSecondsPerDay: number;
  bestDay: WeeklyStudyDayPoint | null;
  goalDaysHit: number;
  activeDaysCount: number;
  dailyGoalMinutes: number;
  hasAnyStudyData: boolean;
}

export const STUDY_HISTORY_STORAGE_PREFIX = 'netpulse_weekly_study_history_v1_';
export const STUDY_HISTORY_UPDATED_EVENT = 'netpulse:study-history-updated';
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HISTORY_DAYS = 60;

function clampSeconds(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(86400, Math.round(num));
}

function toRoundedMinutes(seconds: number): number {
  return Math.round((Math.max(0, seconds) / 60) * 10) / 10;
}

export function getStudyHistoryStorageKey(userId: string): string {
  return `${STUDY_HISTORY_STORAGE_PREFIX}${userId}`;
}

export function readStudyHistory(userId: string): StudyHistoryMap {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(getStudyHistoryStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const clean: StudyHistoryMap = {};
    for (const [key, entry] of Object.entries(parsed as Record<string, any>)) {
      if (!DATE_KEY_REGEX.test(key) || !entry || typeof entry !== 'object') continue;
      const courseSeconds = clampSeconds(entry.courseSeconds);
      const labSeconds = clampSeconds(entry.labSeconds);
      const practiceSeconds = clampSeconds(entry.practiceSeconds);
      const summed = courseSeconds + labSeconds + practiceSeconds;
      const totalSeconds = Math.max(summed, clampSeconds(entry.totalSeconds));
      clean[key] = {
        dateKey: key,
        courseSeconds,
        labSeconds,
        practiceSeconds,
        totalSeconds,
        goalMinutes:
          typeof entry.goalMinutes === 'number' && Number.isFinite(entry.goalMinutes)
            ? Math.max(5, Math.min(300, Math.round(entry.goalMinutes)))
            : undefined,
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined
      };
    }
    return clean;
  } catch {
    return {};
  }
}

export function writeStudyHistory(userId: string, history: StudyHistoryMap): void {
  if (!userId) return;
  try {
    // Keep only the most recent MAX_HISTORY_DAYS entries sorted by dateKey
    const sortedKeys = Object.keys(history)
      .filter(k => DATE_KEY_REGEX.test(k))
      .sort()
      .slice(-MAX_HISTORY_DAYS);
    const pruned: StudyHistoryMap = {};
    for (const key of sortedKeys) {
      pruned[key] = history[key];
    }
    localStorage.setItem(getStudyHistoryStorageKey(userId), JSON.stringify(pruned));
    window.dispatchEvent(new CustomEvent(STUDY_HISTORY_UPDATED_EVENT));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function syncStudyGoalSnapshotToHistory(
  userId: string,
  goalData: DailyStudyGoalData
): void {
  if (!userId || !goalData?.dateKey || !DATE_KEY_REGEX.test(goalData.dateKey)) return;

  const history = readStudyHistory(userId);
  const existing = history[goalData.dateKey];

  const courseSeconds = Math.max(
    existing?.courseSeconds ?? 0,
    clampSeconds(goalData.courseSeconds)
  );
  const labSeconds = Math.max(
    existing?.labSeconds ?? 0,
    clampSeconds(goalData.labSeconds)
  );
  const practiceSeconds = Math.max(
    existing?.practiceSeconds ?? 0,
    clampSeconds(goalData.practiceSeconds)
  );
  const totalSeconds = courseSeconds + labSeconds + practiceSeconds;
  const goalMinutes = Math.max(5, Math.min(300, Math.round(goalData.dailyGoalMinutes || 30)));

  if (
    existing &&
    existing.courseSeconds === courseSeconds &&
    existing.labSeconds === labSeconds &&
    existing.practiceSeconds === practiceSeconds &&
    existing.totalSeconds === totalSeconds &&
    existing.goalMinutes === goalMinutes
  ) {
    return;
  }

  history[goalData.dateKey] = {
    dateKey: goalData.dateKey,
    courseSeconds,
    labSeconds,
    practiceSeconds,
    totalSeconds,
    goalMinutes,
    updatedAt: new Date().toISOString()
  };

  writeStudyHistory(userId, history);
}

export function buildWeeklyLearningTrends(
  userId: string,
  currentGoal: ComputedDailyStudyGoal,
  referenceDate: Date = new Date()
): WeeklyLearningTrendsSummary {
  const history = readStudyHistory(userId);
  const todayKey = getLocalDateKey(referenceDate);
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  });
  const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const days: WeeklyStudyDayPoint[] = [];
  let totalSeconds7d = 0;
  let goalDaysHit = 0;
  let activeDaysCount = 0;
  let bestDay: WeeklyStudyDayPoint | null = null;

  for (let offset = -6; offset <= 0; offset += 1) {
    const dateKey = shiftDateKey(todayKey, offset);
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    const isToday = dateKey === todayKey;

    const stored = history[dateKey];
    let courseSeconds = stored?.courseSeconds ?? 0;
    let labSeconds = stored?.labSeconds ?? 0;
    let practiceSeconds = stored?.practiceSeconds ?? 0;

    if (isToday && currentGoal.dateKey === todayKey) {
      courseSeconds = Math.max(courseSeconds, clampSeconds(currentGoal.courseSeconds));
      labSeconds = Math.max(labSeconds, clampSeconds(currentGoal.labSeconds));
      practiceSeconds = Math.max(practiceSeconds, clampSeconds(currentGoal.practiceSeconds));
    }

    const totalSeconds = Math.max(
      courseSeconds + labSeconds + practiceSeconds,
      stored?.totalSeconds ?? 0
    );

    const dayGoalMinutes = isToday
      ? currentGoal.dailyGoalMinutes
      : stored?.goalMinutes ?? currentGoal.dailyGoalMinutes;
    const goalTargetSeconds = dayGoalMinutes * 60;
    const goalMet = totalSeconds > 0 && totalSeconds >= goalTargetSeconds;
    const goalPercent =
      goalTargetSeconds > 0 ? Math.min(100, Math.round((totalSeconds / goalTargetSeconds) * 100)) : 0;

    const weekdayShort = weekdayFormatter.format(dt);
    const dateLabel = shortDateFormatter.format(dt);
    const fullDateLabel = fullDateFormatter.format(dt);

    const point: WeeklyStudyDayPoint = {
      dateKey,
      axisLabel: isToday ? 'Today' : weekdayShort,
      weekdayShort,
      dateLabel,
      fullDateLabel: isToday ? `${fullDateLabel} (Today)` : fullDateLabel,
      isToday,
      courseSeconds,
      labSeconds,
      practiceSeconds,
      totalSeconds,
      courseMinutes: toRoundedMinutes(courseSeconds),
      labMinutes: toRoundedMinutes(labSeconds),
      practiceMinutes: toRoundedMinutes(practiceSeconds),
      totalMinutes: toRoundedMinutes(totalSeconds),
      goalMinutes: dayGoalMinutes,
      goalMet,
      goalPercent
    };

    days.push(point);
    totalSeconds7d += totalSeconds;
    if (totalSeconds > 0) activeDaysCount += 1;
    if (goalMet) goalDaysHit += 1;
    if (totalSeconds > 0 && (!bestDay || totalSeconds > bestDay.totalSeconds)) {
      bestDay = point;
    }
  }

  return {
    days,
    totalSeconds7d,
    averageSecondsPerDay: Math.round(totalSeconds7d / 7),
    bestDay,
    goalDaysHit,
    activeDaysCount,
    dailyGoalMinutes: currentGoal.dailyGoalMinutes,
    hasAnyStudyData: totalSeconds7d > 0
  };
}
