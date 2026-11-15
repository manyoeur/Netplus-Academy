import { Course, CourseEnrollment, User } from '../types';

export const DEFAULT_ENROLLMENT_DAYS = 180;
export const EXPIRING_SOON_THRESHOLD_DAYS = 14;

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDateLocal(isoDate?: string): Date | null {
  if (!isoDate) return null;
  const clean = isoDate.split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  return new Date(year, month - 1, day);
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const parsed = parseIsoDateLocal(isoDate) || new Date();
  const next = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + days);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createDefaultCourseEnrollment(
  courseId: string,
  accessDays: number = DEFAULT_ENROLLMENT_DAYS,
  baseStartDate?: string
): CourseEnrollment {
  const startDate = (baseStartDate && parseIsoDateLocal(baseStartDate))
    ? baseStartDate.split('T')[0]
    : getTodayIsoDate();
  const safeDays = Math.max(1, accessDays || DEFAULT_ENROLLMENT_DAYS);
  const endDate = addDaysToIsoDate(startDate, safeDays);
  return {
    courseId,
    startDate,
    endDate,
    expiresAt: endDate
  };
}

export function resolveCourseEnrollment(
  user: User,
  course: Pick<Course, 'id' | 'defaultAccessDays'>
): CourseEnrollment | null {
  if (!user.enrolledCourseIds.includes(course.id)) {
    return null;
  }
  const existing = user.courseEnrollments?.[course.id];
  if (existing && existing.startDate && existing.expiresAt) {
    return {
      courseId: course.id,
      startDate: existing.startDate.split('T')[0],
      endDate: (existing.endDate || existing.expiresAt).split('T')[0],
      expiresAt: existing.expiresAt.split('T')[0]
    };
  }
  const baseStart = user.joinedDate && parseIsoDateLocal(user.joinedDate)
    ? user.joinedDate
    : getTodayIsoDate();
  return createDefaultCourseEnrollment(
    course.id,
    course.defaultAccessDays || DEFAULT_ENROLLMENT_DAYS,
    baseStart
  );
}

export function formatEnrollmentDate(isoDate?: string): string {
  const date = parseIsoDateLocal(isoDate);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
}

export function formatEnrollmentDateRange(enrollment: CourseEnrollment): string {
  const start = formatEnrollmentDate(enrollment.startDate);
  const end = formatEnrollmentDate(enrollment.expiresAt || enrollment.endDate);
  return `${start} - ${end}`;
}

export interface EnrollmentExpirationInfo {
  status: 'upcoming' | 'active' | 'expiring_soon' | 'expired';
  statusLabel: string;
  countdownLabel: string;
  daysRemaining: number;
  daysUntilStart: number;
}

export function getEnrollmentExpirationInfo(
  enrollment: CourseEnrollment,
  referenceIsoDate: string = getTodayIsoDate()
): EnrollmentExpirationInfo {
  const refDate = parseIsoDateLocal(referenceIsoDate) || new Date();
  const start = parseIsoDateLocal(enrollment.startDate) || refDate;
  const expiry = parseIsoDateLocal(enrollment.expiresAt || enrollment.endDate) || refDate;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilStart = Math.round((start.getTime() - refDate.getTime()) / msPerDay);
  const daysRemaining = Math.round((expiry.getTime() - refDate.getTime()) / msPerDay);

  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      status: 'expired',
      statusLabel: 'Expired',
      countdownLabel: overdueDays === 1 ? 'Expired 1 day ago' : `Expired ${overdueDays} days ago`,
      daysRemaining,
      daysUntilStart
    };
  }

  if (daysUntilStart > 0) {
    return {
      status: 'upcoming',
      statusLabel: 'Scheduled',
      countdownLabel: daysUntilStart === 1 ? 'Starts tomorrow' : `Starts in ${daysUntilStart} days`,
      daysRemaining,
      daysUntilStart
    };
  }

  if (daysRemaining <= EXPIRING_SOON_THRESHOLD_DAYS) {
    return {
      status: 'expiring_soon',
      statusLabel: 'Expiring Soon',
      countdownLabel:
        daysRemaining === 0
          ? 'Expires today'
          : daysRemaining === 1
          ? '1 day left'
          : `${daysRemaining} days left`,
      daysRemaining,
      daysUntilStart
    };
  }

  return {
    status: 'active',
    statusLabel: 'Active',
    countdownLabel: `${daysRemaining} days left`,
    daysRemaining,
    daysUntilStart
  };
}
