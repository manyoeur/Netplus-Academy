export interface StreakBadgeTier {
  id: string;
  title: string;
  subtitle: string;
  minDays: number;
  nextMilestoneDays: number | null;
  nextMilestoneTitle: string | null;
  tone: 'neutral' | 'emerald' | 'blue' | 'violet' | 'amber' | 'gold';
}

export interface StreakDayPoint {
  dateKey: string;
  dayShort: string;
  dayNumber: string;
  isToday: boolean;
  isActive: boolean;
}

export interface LearningStreakData {
  activeDates: string[]; // sorted unique YYYY-MM-DD (local time), capped at 365
  longestStreak: number;
  lastActiveDate: string;
  updatedAt?: string;
}

export interface ComputedLearningStreak {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  studiedToday: boolean;
  streakAtRisk: boolean;
  lastActiveDate: string;
  activeDates: string[];
  last7Days: StreakDayPoint[];
  badge: StreakBadgeTier;
  daysToNextBadge: number | null;
}

const STREAK_STORAGE_PREFIX = 'netpulse_learning_streak_v1_';
const MAX_STORED_DATES = 365;
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  return getLocalDateKey(dt);
}

export function sanitizeActiveDates(dates: unknown): string[] {
  if (!Array.isArray(dates)) return [];
  const unique = new Set<string>();
  for (const item of dates) {
    if (typeof item === 'string' && DATE_KEY_REGEX.test(item.trim())) {
      unique.add(item.trim());
    }
  }
  return Array.from(unique).sort().slice(-MAX_STORED_DATES);
}

export function computeLongestRun(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDates.length; i += 1) {
    if (sortedDates[i] === shiftDateKey(sortedDates[i - 1], 1)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return longest;
}

export function getStreakBadgeTier(currentStreak: number): StreakBadgeTier {
  if (currentStreak >= 30) {
    return {
      id: 'five-nines',
      title: 'Five-Nines Legend',
      subtitle: '30+ consecutive study days',
      minDays: 30,
      nextMilestoneDays: null,
      nextMilestoneTitle: null,
      tone: 'gold',
    };
  }
  if (currentStreak >= 14) {
    return {
      id: 'core-router',
      title: 'Core Router',
      subtitle: '14+ consecutive study days',
      minDays: 14,
      nextMilestoneDays: 30,
      nextMilestoneTitle: 'Five-Nines Legend',
      tone: 'amber',
    };
  }
  if (currentStreak >= 7) {
    return {
      id: 'weeklong-uptime',
      title: 'Weeklong Uptime',
      subtitle: '7+ consecutive study days',
      minDays: 7,
      nextMilestoneDays: 14,
      nextMilestoneTitle: 'Core Router',
      tone: 'violet',
    };
  }
  if (currentStreak >= 3) {
    return {
      id: 'three-day-sync',
      title: '3-Day Sync',
      subtitle: '3+ consecutive study days',
      minDays: 3,
      nextMilestoneDays: 7,
      nextMilestoneTitle: 'Weeklong Uptime',
      tone: 'blue',
    };
  }
  if (currentStreak >= 1) {
    return {
      id: 'link-up',
      title: 'Link Up',
      subtitle: 'Active daily streak started',
      minDays: 1,
      nextMilestoneDays: 3,
      nextMilestoneTitle: '3-Day Sync',
      tone: 'emerald',
    };
  }
  return {
    id: 'first-packet',
    title: 'First Packet',
    subtitle: 'Log a study session to earn Link Up',
    minDays: 0,
    nextMilestoneDays: 1,
    nextMilestoneTitle: 'Link Up',
    tone: 'neutral',
  };
}

export function computeLearningStreak(
  data: LearningStreakData,
  referenceDate: Date = new Date()
): ComputedLearningStreak {
  const activeDates = sanitizeActiveDates(data.activeDates);
  const dateSet = new Set(activeDates);
  const todayKey = getLocalDateKey(referenceDate);
  const yesterdayKey = shiftDateKey(todayKey, -1);

  const studiedToday = dateSet.has(todayKey);
  const studiedYesterday = dateSet.has(yesterdayKey);

  let currentStreak = 0;
  let cursor = studiedToday ? todayKey : studiedYesterday ? yesterdayKey : '';
  while (cursor && dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  const streakAtRisk = !studiedToday && studiedYesterday && currentStreak > 0;
  const computedMax = computeLongestRun(activeDates);
  const longestStreak = Math.max(Number(data.longestStreak) || 0, computedMax, currentStreak);
  const lastActiveDate = activeDates[activeDates.length - 1] || data.lastActiveDate || '';

  const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const last7Days: StreakDayPoint[] = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const key = shiftDateKey(todayKey, offset);
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    last7Days.push({
      dateKey: key,
      dayShort: dayFormatter.format(dt).slice(0, 2),
      dayNumber: String(d),
      isToday: key === todayKey,
      isActive: dateSet.has(key),
    });
  }

  const badge = getStreakBadgeTier(currentStreak);
  const daysToNextBadge =
    badge.nextMilestoneDays !== null ? Math.max(1, badge.nextMilestoneDays - currentStreak) : null;

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: activeDates.length,
    studiedToday,
    streakAtRisk,
    lastActiveDate,
    activeDates,
    last7Days,
    badge,
    daysToNextBadge,
  };
}

export function recordActivityInStreakData(
  prev: LearningStreakData,
  referenceDate: Date = new Date()
): { next: LearningStreakData; changed: boolean } {
  const todayKey = getLocalDateKey(referenceDate);
  const existingDates = sanitizeActiveDates(prev.activeDates);
  if (existingDates.includes(todayKey)) {
    return {
      next: {
        ...prev,
        activeDates: existingDates,
        lastActiveDate: todayKey,
      },
      changed: false,
    };
  }

  const updatedDates = sanitizeActiveDates([...existingDates, todayKey]);
  const computed = computeLearningStreak(
    {
      activeDates: updatedDates,
      longestStreak: prev.longestStreak,
      lastActiveDate: todayKey,
    },
    referenceDate
  );

  return {
    next: {
      activeDates: updatedDates,
      longestStreak: computed.longestStreak,
      lastActiveDate: todayKey,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}

export function mergeStreakData(
  localData: LearningStreakData,
  remoteData: LearningStreakData | null
): LearningStreakData {
  if (!remoteData) return localData;
  const mergedDates = sanitizeActiveDates([
    ...localData.activeDates,
    ...remoteData.activeDates,
  ]);
  const computedMax = computeLongestRun(mergedDates);
  return {
    activeDates: mergedDates,
    longestStreak: Math.max(
      Number(localData.longestStreak) || 0,
      Number(remoteData.longestStreak) || 0,
      computedMax
    ),
    lastActiveDate: mergedDates[mergedDates.length - 1] || remoteData.lastActiveDate || localData.lastActiveDate || '',
    updatedAt: new Date().toISOString(),
  };
}

export function loadLocalLearningStreak(userId: string): LearningStreakData {
  if (!userId) {
    return { activeDates: [], longestStreak: 0, lastActiveDate: '' };
  }
  try {
    const raw = localStorage.getItem(`${STREAK_STORAGE_PREFIX}${userId}`);
    if (!raw) return { activeDates: [], longestStreak: 0, lastActiveDate: '' };
    const parsed = JSON.parse(raw) as Partial<LearningStreakData>;
    const activeDates = sanitizeActiveDates(parsed.activeDates);
    return {
      activeDates,
      longestStreak: Math.max(0, Number(parsed.longestStreak) || 0, computeLongestRun(activeDates)),
      lastActiveDate:
        typeof parsed.lastActiveDate === 'string'
          ? parsed.lastActiveDate
          : activeDates[activeDates.length - 1] || '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch {
    return { activeDates: [], longestStreak: 0, lastActiveDate: '' };
  }
}

export function saveLocalLearningStreak(userId: string, data: LearningStreakData): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${STREAK_STORAGE_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}
