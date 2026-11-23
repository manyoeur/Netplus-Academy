import { Course, CourseModule, User } from '../types';
import { getModuleSectionBreadcrumb } from './courseHierarchy';
import { getEnrollmentExpirationInfo, resolveCourseEnrollment } from './enrollmentDates';

export interface ModuleReadingProgress {
  scrollY: number;
  scrollRatio: number;
  percent: number;
  updatedAt: string;
}

export interface CourseReadingState {
  lastModuleId: string;
  lastOpenedAt?: string;
  modules: Record<string, ModuleReadingProgress>;
}

export type ReadingStore = Record<string, CourseReadingState>;

export const READING_PROGRESS_STORAGE_PREFIX = 'netpulse_academy_reading_progress_v1';

export function getReadingStorageKey(userId: string): string {
  return `${READING_PROGRESS_STORAGE_PREFIX}:${userId}`;
}

export function readReadingStore(userId: string): ReadingStore {
  if (!userId) return {};
  try {
    const raw = localStorage.getItem(getReadingStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeReadingStore(userId: string, store: ReadingStore): void {
  if (!userId) return;
  try {
    localStorage.setItem(getReadingStorageKey(userId), JSON.stringify(store));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

export interface LastActiveCourseSession {
  course: Course;
  activeModule: CourseModule | null;
  moduleNumberLabel: string;
  sectionTitle: string | null;
  completedCount: number;
  totalModules: number;
  coursePercent: number;
  moduleReadPercent: number;
  lastUpdatedAtMs: number | null;
  hasPriorActivity: boolean;
  isExpired: boolean;
}

export interface OverallStudentProgress {
  enrolledCoursesCount: number;
  activeCoursesCount: number;
  completedCoursesCount: number;
  inProgressCoursesCount: number;
  totalCompletedModules: number;
  totalEnrolledModules: number;
  overallPercent: number;
}

function parseIsoMs(iso?: string): number | null {
  if (!iso || typeof iso !== 'string') return null;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getCourseLastActivityMs(courseState?: CourseReadingState): number | null {
  if (!courseState) return null;
  let latestMs: number | null = parseIsoMs(courseState.lastOpenedAt);

  if (courseState.modules && typeof courseState.modules === 'object') {
    for (const modProgress of Object.values(courseState.modules)) {
      const modMs = parseIsoMs(modProgress?.updatedAt);
      if (modMs !== null && (latestMs === null || modMs > latestMs)) {
        latestMs = modMs;
      }
    }
  }

  return latestMs;
}

export function computeOverallStudentProgress(
  user: User,
  courses: Course[]
): OverallStudentProgress {
  const enrolledCourses = courses.filter(c => user.enrolledCourseIds.includes(c.id));
  const completedSet = new Set(user.completedModuleIds);

  let activeCoursesCount = 0;
  let completedCoursesCount = 0;
  let inProgressCoursesCount = 0;
  let totalCompletedModules = 0;
  let totalEnrolledModules = 0;

  for (const course of enrolledCourses) {
    const enrollment = resolveCourseEnrollment(user, course);
    const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;
    if (expiryInfo?.status !== 'expired') {
      activeCoursesCount += 1;
    }

    const modCount = course.modules.length;
    const doneInCourse = course.modules.filter(m => completedSet.has(m.id)).length;
    totalEnrolledModules += modCount;
    totalCompletedModules += doneInCourse;

    if (modCount > 0 && doneInCourse >= modCount) {
      completedCoursesCount += 1;
    } else if (doneInCourse > 0) {
      inProgressCoursesCount += 1;
    }
  }

  const overallPercent =
    totalEnrolledModules > 0
      ? Math.min(100, Math.round((totalCompletedModules / totalEnrolledModules) * 100))
      : 0;

  return {
    enrolledCoursesCount: enrolledCourses.length,
    activeCoursesCount,
    completedCoursesCount,
    inProgressCoursesCount,
    totalCompletedModules,
    totalEnrolledModules,
    overallPercent
  };
}

export function resolveLastActiveCourseSession(
  user: User,
  courses: Course[],
  readingStoreInput?: ReadingStore
): LastActiveCourseSession | null {
  const enrolledCourses = courses.filter(c => user.enrolledCourseIds.includes(c.id));
  if (enrolledCourses.length === 0) return null;

  const store = readingStoreInput ?? readReadingStore(user.id);
  const completedSet = new Set(user.completedModuleIds);

  interface Candidate {
    course: Course;
    courseState?: CourseReadingState;
    lastUpdatedAtMs: number | null;
    completedCount: number;
    totalModules: number;
    coursePercent: number;
    isExpired: boolean;
    orderIndex: number;
  }

  const candidates: Candidate[] = enrolledCourses.map((course, orderIndex) => {
    const enrollment = resolveCourseEnrollment(user, course);
    const expiryInfo = enrollment ? getEnrollmentExpirationInfo(enrollment) : null;
    const isExpired = expiryInfo?.status === 'expired';
    const courseState = store[course.id];
    const lastUpdatedAtMs = getCourseLastActivityMs(courseState);
    const totalModules = course.modules.length;
    const completedCount = course.modules.filter(m => completedSet.has(m.id)).length;
    const coursePercent =
      totalModules > 0 ? Math.min(100, Math.round((completedCount / totalModules) * 100)) : 0;

    return {
      course,
      courseState,
      lastUpdatedAtMs,
      completedCount,
      totalModules,
      coursePercent,
      isExpired,
      orderIndex
    };
  });

  // Sort candidates by:
  // 1. Non-expired before expired
  // 2. Most recent reading timestamp (if any)
  // 3. In-progress course (0 < percent < 100) before unstarted/completed
  // 4. Original enrollment order
  const sorted = [...candidates].sort((a, b) => {
    if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;

    const aTime = a.lastUpdatedAtMs ?? -1;
    const bTime = b.lastUpdatedAtMs ?? -1;
    if (aTime !== bTime) return bTime - aTime;

    const aInProgress = a.completedCount > 0 && a.completedCount < a.totalModules ? 1 : 0;
    const bInProgress = b.completedCount > 0 && b.completedCount < b.totalModules ? 1 : 0;
    if (aInProgress !== bInProgress) return bInProgress - aInProgress;

    const aStarted = a.completedCount > 0 ? 1 : 0;
    const bStarted = b.completedCount > 0 ? 1 : 0;
    if (aStarted !== bStarted) return bStarted - aStarted;

    return a.orderIndex - b.orderIndex;
  });

  const best = sorted[0];
  if (!best) return null;

  const { course, courseState, lastUpdatedAtMs, completedCount, totalModules, coursePercent, isExpired } =
    best;

  // Determine exact active module to resume
  let activeModule: CourseModule | null = null;
  if (course.modules.length > 0) {
    if (courseState?.lastModuleId) {
      activeModule = course.modules.find(m => m.id === courseState.lastModuleId) ?? null;
    }
    if (!activeModule) {
      activeModule =
        course.modules.find(m => !completedSet.has(m.id)) ?? course.modules[0] ?? null;
    }
  }

  let moduleNumberLabel = 'Module 1';
  let sectionTitle: string | null = null;
  let moduleReadPercent = 0;

  if (activeModule) {
    const breadcrumb = getModuleSectionBreadcrumb(course, activeModule.id);
    if (breadcrumb) {
      moduleNumberLabel = breadcrumb.itemNumber;
      sectionTitle = breadcrumb.mainContentTitle;
    } else {
      const idx = course.modules.findIndex(m => m.id === activeModule!.id);
      moduleNumberLabel = `Module ${idx >= 0 ? idx + 1 : 1}`;
    }
    moduleReadPercent = Math.min(
      100,
      Math.max(0, courseState?.modules?.[activeModule.id]?.percent ?? 0)
    );
  }

  const hasPriorActivity = Boolean(
    lastUpdatedAtMs !== null || courseState?.lastModuleId || completedCount > 0
  );

  return {
    course,
    activeModule,
    moduleNumberLabel,
    sectionTitle,
    completedCount,
    totalModules,
    coursePercent,
    moduleReadPercent,
    lastUpdatedAtMs,
    hasPriorActivity,
    isExpired
  };
}

export function formatRelativeActivityTime(timestampMs: number | null): string {
  if (!timestampMs) return 'Ready to start';
  const diffMs = Math.max(0, Date.now() - timestampMs);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 2) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(timestampMs).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}
