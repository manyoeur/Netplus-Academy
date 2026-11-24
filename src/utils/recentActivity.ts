import { Course, CourseModule } from '../types';
import { getModuleSectionBreadcrumb } from './courseHierarchy';
import { formatRelativeActivityTime, ReadingStore, readReadingStore } from './readingProgress';

export type RecentActivityKind = 'course' | 'lab';

export type LabToolTabId =
  | 'lab-sandbox'
  | 'lab-exercises'
  | 'network-designer'
  | 'subnet-calc'
  | 'base-converter'
  | 'binary-game';

export interface RecentActivityEntry {
  id: string;
  kind: RecentActivityKind;
  targetId: string; // courseId for 'course', LabToolTabId for 'lab'
  title: string;
  codeOrCategory: string;
  subtitle: string;
  accessedAt: string; // ISO timestamp
  courseId?: string;
  labTabId?: LabToolTabId;
}

export interface LabToolMetadata {
  tabId: LabToolTabId;
  title: string;
  codeOrCategory: string;
  subtitle: string;
}

export const LAB_TOOLS_METADATA: Record<LabToolTabId, LabToolMetadata> = {
  'lab-sandbox': {
    tabId: 'lab-sandbox',
    title: 'Lab Simulation',
    codeOrCategory: 'CLI & TOPOLOGY',
    subtitle: 'Network topology & interactive Cisco IOS CLI sandbox'
  },
  'lab-exercises': {
    tabId: 'lab-exercises',
    title: 'Lab Exercises',
    codeOrCategory: 'LAB GUIDES',
    subtitle: 'Step-by-step Cisco IOS configuration & troubleshooting guides'
  },
  'network-designer': {
    tabId: 'network-designer',
    title: 'Network Designer',
    codeOrCategory: 'TOPOLOGY STUDIO',
    subtitle: 'Visio-style network diagram & cable topology studio'
  },
  'subnet-calc': {
    tabId: 'subnet-calc',
    title: 'Subnet & VLSM',
    codeOrCategory: 'IPv4 / VLSM',
    subtitle: 'CIDR subnetting & variable-length mask planner'
  },
  'base-converter': {
    tabId: 'base-converter',
    title: 'Base Converter',
    codeOrCategory: 'RADIX LAB',
    subtitle: 'Binary, decimal & hexadecimal bit-level converter'
  },
  'binary-game': {
    tabId: 'binary-game',
    title: 'Binary Game',
    codeOrCategory: 'PRACTICE LAB',
    subtitle: 'Timed binary-to-decimal subnetting drill'
  }
};

export const RECENT_ACTIVITY_STORAGE_PREFIX = 'netpulse_academy_recent_activity_v1';
export const RECENT_ACTIVITY_UPDATED_EVENT = 'netpulse:recent-activity-updated';
const MAX_STORED_ENTRIES = 25;

export function isLabToolTabId(tabId: string): tabId is LabToolTabId {
  return (
    tabId === 'lab-sandbox' ||
    tabId === 'lab-exercises' ||
    tabId === 'network-designer' ||
    tabId === 'subnet-calc' ||
    tabId === 'base-converter' ||
    tabId === 'binary-game'
  );
}

export function getRecentActivityStorageKey(userId: string): string {
  return `${RECENT_ACTIVITY_STORAGE_PREFIX}:${userId}`;
}

export function readRecentActivity(userId: string): RecentActivityEntry[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getRecentActivityStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentActivityEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        (item.kind === 'course' || item.kind === 'lab') &&
        typeof item.targetId === 'string' &&
        typeof item.title === 'string' &&
        typeof item.accessedAt === 'string'
    );
  } catch {
    return [];
  }
}

export function writeRecentActivity(userId: string, entries: RecentActivityEntry[]): void {
  if (!userId) return;
  try {
    localStorage.setItem(
      getRecentActivityStorageKey(userId),
      JSON.stringify(entries.slice(0, MAX_STORED_ENTRIES))
    );
    window.dispatchEvent(new CustomEvent(RECENT_ACTIVITY_UPDATED_EVENT));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

function parseIsoMs(iso?: string): number {
  if (!iso || typeof iso !== 'string') return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function upsertActivityEntry(userId: string, entry: RecentActivityEntry): void {
  if (!userId) return;
  const existing = readRecentActivity(userId);
  const top = existing[0];
  const nowMs = parseIsoMs(entry.accessedAt);
  const topMs = top ? parseIsoMs(top.accessedAt) : 0;

  // Avoid duplicate back-to-back writes within 1.5s for the exact same item and subtitle
  if (
    top &&
    top.kind === entry.kind &&
    top.targetId === entry.targetId &&
    top.subtitle === entry.subtitle &&
    Math.abs(nowMs - topMs) < 1500
  ) {
    return;
  }

  const deduped = existing.filter(
    item => !(item.kind === entry.kind && item.targetId === entry.targetId)
  );
  const next = [entry, ...deduped].slice(0, MAX_STORED_ENTRIES);
  writeRecentActivity(userId, next);
}

export function formatCourseActivitySubtitle(
  course: Course,
  activeModule?: CourseModule | null
): string {
  if (!activeModule) {
    return course.subtitle || `${course.modules.length} curriculum modules`;
  }
  const breadcrumb = getModuleSectionBreadcrumb(course, activeModule.id);
  const prefix = activeModule.type === 'lab' ? 'Lab · ' : '';
  if (breadcrumb) {
    return `${prefix}${breadcrumb.itemNumber} ${activeModule.title}`;
  }
  return `${prefix}${activeModule.title}`;
}

export function recordCourseAccess(
  userId: string,
  course: Course,
  activeModule?: CourseModule | null
): void {
  if (!userId || !course?.id) return;
  const existing = readRecentActivity(userId).find(
    item => item.kind === 'course' && item.targetId === course.id
  );
  const subtitle = activeModule
    ? formatCourseActivitySubtitle(course, activeModule)
    : existing?.subtitle || formatCourseActivitySubtitle(course, null);

  upsertActivityEntry(userId, {
    id: `course:${course.id}`,
    kind: 'course',
    targetId: course.id,
    title: course.title,
    codeOrCategory: course.code || course.category,
    subtitle,
    accessedAt: new Date().toISOString(),
    courseId: course.id
  });
}

export function recordLabAccess(
  userId: string,
  labTabId: LabToolTabId,
  customSubtitle?: string
): void {
  if (!userId) return;
  const meta = LAB_TOOLS_METADATA[labTabId];
  if (!meta) return;

  upsertActivityEntry(userId, {
    id: `lab:${labTabId}`,
    kind: 'lab',
    targetId: labTabId,
    title: meta.title,
    codeOrCategory: meta.codeOrCategory,
    subtitle: customSubtitle || meta.subtitle,
    accessedAt: new Date().toISOString(),
    labTabId
  });
}

function getCourseReadingLatestMs(
  courseState?: ReadingStore[string]
): { ms: number; moduleId?: string } {
  if (!courseState) return { ms: 0 };
  let latestMs = parseIsoMs(courseState.lastOpenedAt);
  let latestModuleId = courseState.lastModuleId;

  if (courseState.modules && typeof courseState.modules === 'object') {
    for (const [modId, modProgress] of Object.entries(courseState.modules)) {
      const modMs = parseIsoMs(modProgress?.updatedAt);
      if (modMs > latestMs) {
        latestMs = modMs;
        latestModuleId = modId;
      }
    }
  }

  return { ms: latestMs, moduleId: latestModuleId };
}

export interface HydratedRecentActivityItem extends RecentActivityEntry {
  accessedAtMs: number;
  relativeTimeLabel: string;
  exactTimeLabel: string;
  fullDateTimeTitle: string;
  courseMissing?: boolean;
}

export function formatExactActivityTimestamp(timestampMs: number): string {
  if (!timestampMs) return '—';
  const date = new Date(timestampMs);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const timePart = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });

  if (isSameDay) {
    return `Today, ${timePart}`;
  }
  if (isYesterday) {
    return `Yesterday, ${timePart}`;
  }
  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
  return `${datePart}, ${timePart}`;
}

export function getCombinedRecentActivity(
  userId: string,
  courses: Course[],
  readingStoreInput?: ReadingStore,
  limit = 5,
  kindFilter: 'all' | RecentActivityKind = 'all'
): HydratedRecentActivityItem[] {
  if (!userId) return [];

  const stored = readRecentActivity(userId);
  const readingStore = readingStoreInput ?? readReadingStore(userId);
  const courseMap = new Map<string, Course>(courses.map(c => [c.id, c]));

  const mergedByKey = new Map<string, RecentActivityEntry>();

  // 1. Seed from persisted reading progress store so previously opened courses appear immediately
  for (const [courseId, courseState] of Object.entries(readingStore)) {
    const course = courseMap.get(courseId);
    if (!course) continue;
    const { ms, moduleId } = getCourseReadingLatestMs(courseState);
    if (!ms) continue;
    const activeMod = moduleId
      ? course.modules.find(m => m.id === moduleId) || null
      : null;

    mergedByKey.set(`course:${courseId}`, {
      id: `course:${courseId}`,
      kind: 'course',
      targetId: courseId,
      title: course.title,
      codeOrCategory: course.code || course.category,
      subtitle: formatCourseActivitySubtitle(course, activeMod),
      accessedAt: new Date(ms).toISOString(),
      courseId
    });
  }

  // 2. Overlay explicit activity entries, keeping whichever timestamp is newer
  for (const item of stored) {
    const key = `${item.kind}:${item.targetId}`;
    const existing = mergedByKey.get(key);
    const itemMs = parseIsoMs(item.accessedAt);
    const existingMs = existing ? parseIsoMs(existing.accessedAt) : 0;

    if (!existing || itemMs >= existingMs) {
      if (item.kind === 'course') {
        const liveCourse = courseMap.get(item.targetId);
        mergedByKey.set(key, {
          ...item,
          title: liveCourse?.title || item.title,
          codeOrCategory: liveCourse?.code || item.codeOrCategory
        });
      } else {
        const liveLabMeta = isLabToolTabId(item.targetId)
          ? LAB_TOOLS_METADATA[item.targetId]
          : null;
        mergedByKey.set(key, {
          ...item,
          title: liveLabMeta?.title || item.title,
          codeOrCategory: liveLabMeta?.codeOrCategory || item.codeOrCategory
        });
      }
    }
  }

  // 3. Filter, sort newest first, hydrate formatted timestamps, and cap to limit
  const sorted = Array.from(mergedByKey.values())
    .filter(item => kindFilter === 'all' || item.kind === kindFilter)
    .map(item => {
      const accessedAtMs = parseIsoMs(item.accessedAt);
      const courseMissing =
        item.kind === 'course' && !courseMap.has(item.targetId);
      return {
        ...item,
        accessedAtMs,
        relativeTimeLabel: formatRelativeActivityTime(accessedAtMs || null),
        exactTimeLabel: formatExactActivityTimestamp(accessedAtMs),
        fullDateTimeTitle: accessedAtMs
          ? new Date(accessedAtMs).toLocaleString()
          : 'Unknown time',
        courseMissing
      };
    })
    .filter(item => item.accessedAtMs > 0 && !item.courseMissing)
    .sort((a, b) => b.accessedAtMs - a.accessedAtMs);

  return sorted.slice(0, Math.max(0, limit));
}
