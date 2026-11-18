import { getLocalDateKey } from './learningStreak';

export type StudySource = 'course' | 'lab' | 'practice';

export interface DailyStudyGoalData {
  dailyGoalMinutes: number;
  dateKey: string; // YYYY-MM-DD (local date)
  courseSeconds: number;
  labSeconds: number;
  practiceSeconds: number;
  creditedModuleIds: string[];
  updatedAt?: string;
}

export interface ComputedDailyStudyGoal {
  dailyGoalMinutes: number;
  dateKey: string;
  totalSecondsToday: number;
  totalMinutesToday: number;
  courseSeconds: number;
  labSeconds: number;
  practiceSeconds: number;
  courseMinutes: number;
  labMinutes: number;
  practiceMinutes: number;
  progressPercent: number;
  rawPercent: number;
  goalReached: boolean;
  remainingSeconds: number;
  bonusSeconds: number;
}

export const DEFAULT_DAILY_GOAL_MINUTES = 30;
export const MIN_DAILY_GOAL_MINUTES = 5;
export const MAX_DAILY_GOAL_MINUTES = 300;
export const DAILY_GOAL_PRESETS = [15, 30, 45, 60, 90];

const STUDY_GOAL_STORAGE_PREFIX = 'netpulse_daily_study_goal_v1_';
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function clampGoalMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_DAILY_GOAL_MINUTES;
  return Math.min(MAX_DAILY_GOAL_MINUTES, Math.max(MIN_DAILY_GOAL_MINUTES, Math.round(minutes)));
}

function clampSeconds(seconds: unknown): number {
  const num = Number(seconds);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.min(86400, Math.round(num));
}

function sanitizeModuleIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const unique = new Set<string>();
  for (const item of ids) {
    if (typeof item === 'string' && item.trim().length > 0) {
      unique.add(item.trim().slice(0, 128));
    }
    if (unique.size >= 100) break;
  }
  return Array.from(unique);
}

export function normalizeStudyGoalData(
  raw: Partial<DailyStudyGoalData> | null | undefined,
  referenceDate: Date = new Date()
): DailyStudyGoalData {
  const todayKey = getLocalDateKey(referenceDate);
  const dailyGoalMinutes = clampGoalMinutes(
    typeof raw?.dailyGoalMinutes === 'number' ? raw.dailyGoalMinutes : DEFAULT_DAILY_GOAL_MINUTES
  );
  const storedDate =
    typeof raw?.dateKey === 'string' && DATE_KEY_REGEX.test(raw.dateKey) ? raw.dateKey : todayKey;

  if (storedDate !== todayKey) {
    return {
      dailyGoalMinutes,
      dateKey: todayKey,
      courseSeconds: 0,
      labSeconds: 0,
      practiceSeconds: 0,
      creditedModuleIds: [],
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    dailyGoalMinutes,
    dateKey: todayKey,
    courseSeconds: clampSeconds(raw?.courseSeconds),
    labSeconds: clampSeconds(raw?.labSeconds),
    practiceSeconds: clampSeconds(raw?.practiceSeconds),
    creditedModuleIds: sanitizeModuleIds(raw?.creditedModuleIds),
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

export function computeDailyStudyGoal(
  raw: DailyStudyGoalData,
  referenceDate: Date = new Date()
): ComputedDailyStudyGoal {
  const data = normalizeStudyGoalData(raw, referenceDate);
  const totalSecondsToday = data.courseSeconds + data.labSeconds + data.practiceSeconds;
  const totalMinutesToday = Math.round((totalSecondsToday / 60) * 10) / 10;
  const targetSeconds = data.dailyGoalMinutes * 60;
  const rawPercent = targetSeconds > 0 ? Math.round((totalSecondsToday / targetSeconds) * 100) : 0;
  const progressPercent = Math.min(100, Math.max(0, rawPercent));
  const goalReached = totalSecondsToday >= targetSeconds;
  const remainingSeconds = Math.max(0, targetSeconds - totalSecondsToday);
  const bonusSeconds = Math.max(0, totalSecondsToday - targetSeconds);

  return {
    dailyGoalMinutes: data.dailyGoalMinutes,
    dateKey: data.dateKey,
    totalSecondsToday,
    totalMinutesToday,
    courseSeconds: data.courseSeconds,
    labSeconds: data.labSeconds,
    practiceSeconds: data.practiceSeconds,
    courseMinutes: Math.round((data.courseSeconds / 60) * 10) / 10,
    labMinutes: Math.round((data.labSeconds / 60) * 10) / 10,
    practiceMinutes: Math.round((data.practiceSeconds / 60) * 10) / 10,
    progressPercent,
    rawPercent,
    goalReached,
    remainingSeconds,
    bonusSeconds,
  };
}

export function addStudySecondsToData(
  prev: DailyStudyGoalData,
  seconds: number,
  source: StudySource,
  moduleId?: string,
  referenceDate: Date = new Date()
): { next: DailyStudyGoalData; added: boolean } {
  const normalized = normalizeStudyGoalData(prev, referenceDate);
  const safeAdd = clampSeconds(seconds);
  if (safeAdd <= 0) {
    return { next: normalized, added: false };
  }

  if (moduleId) {
    const cleanModId = moduleId.trim().slice(0, 128);
    if (normalized.creditedModuleIds.includes(cleanModId)) {
      return { next: normalized, added: false };
    }
    const nextIds = [...normalized.creditedModuleIds, cleanModId].slice(-100);
    return {
      next: {
        ...normalized,
        courseSeconds:
          source === 'course'
            ? Math.min(86400, normalized.courseSeconds + safeAdd)
            : normalized.courseSeconds,
        labSeconds:
          source === 'lab'
            ? Math.min(86400, normalized.labSeconds + safeAdd)
            : normalized.labSeconds,
        practiceSeconds:
          source === 'practice'
            ? Math.min(86400, normalized.practiceSeconds + safeAdd)
            : normalized.practiceSeconds,
        creditedModuleIds: nextIds,
        updatedAt: new Date().toISOString(),
      },
      added: true,
    };
  }

  return {
    next: {
      ...normalized,
      courseSeconds:
        source === 'course'
          ? Math.min(86400, normalized.courseSeconds + safeAdd)
          : normalized.courseSeconds,
      labSeconds:
        source === 'lab'
          ? Math.min(86400, normalized.labSeconds + safeAdd)
          : normalized.labSeconds,
      practiceSeconds:
        source === 'practice'
          ? Math.min(86400, normalized.practiceSeconds + safeAdd)
          : normalized.practiceSeconds,
      updatedAt: new Date().toISOString(),
    },
    added: true,
  };
}

export function updateDailyGoalMinutesInData(
  prev: DailyStudyGoalData,
  minutes: number,
  referenceDate: Date = new Date()
): DailyStudyGoalData {
  const normalized = normalizeStudyGoalData(prev, referenceDate);
  return {
    ...normalized,
    dailyGoalMinutes: clampGoalMinutes(minutes),
    updatedAt: new Date().toISOString(),
  };
}

export function mergeStudyGoalData(
  localRaw: DailyStudyGoalData,
  remoteRaw: DailyStudyGoalData | null,
  referenceDate: Date = new Date()
): DailyStudyGoalData {
  const local = normalizeStudyGoalData(localRaw, referenceDate);
  if (!remoteRaw) return local;
  const remote = normalizeStudyGoalData(remoteRaw, referenceDate);

  const useRemoteGoal =
    remote.updatedAt && (!local.updatedAt || remote.updatedAt >= local.updatedAt);

  return {
    dailyGoalMinutes: useRemoteGoal ? remote.dailyGoalMinutes : local.dailyGoalMinutes,
    dateKey: local.dateKey,
    courseSeconds: Math.max(local.courseSeconds, remote.courseSeconds),
    labSeconds: Math.max(local.labSeconds, remote.labSeconds),
    practiceSeconds: Math.max(local.practiceSeconds, remote.practiceSeconds),
    creditedModuleIds: sanitizeModuleIds([
      ...local.creditedModuleIds,
      ...remote.creditedModuleIds,
    ]),
    updatedAt: new Date().toISOString(),
  };
}

export function formatStudyDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
  }
  return remSec > 0 && mins < 10 ? `${mins}m ${remSec}s` : `${mins}m`;
}

export function loadLocalStudyGoal(userId: string): DailyStudyGoalData {
  if (!userId) return normalizeStudyGoalData(null);
  try {
    const raw = localStorage.getItem(`${STUDY_GOAL_STORAGE_PREFIX}${userId}`);
    if (!raw) return normalizeStudyGoalData(null);
    return normalizeStudyGoalData(JSON.parse(raw) as Partial<DailyStudyGoalData>);
  } catch {
    return normalizeStudyGoalData(null);
  }
}

export function saveLocalStudyGoal(userId: string, data: DailyStudyGoalData): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${STUDY_GOAL_STORAGE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}
