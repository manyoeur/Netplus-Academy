export interface CourseBookmark {
  id: string;
  ownerUid: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = 'netpulse_course_bookmarks_v1';

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`;
}

export function sanitizeBookmarkIdPart(raw: string, fallback = 'item', maxLen = 64): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLen);
  return cleaned || fallback;
}

export function buildBookmarkDocId(ownerUid: string, courseId: string): string {
  const safeOwner = sanitizeBookmarkIdPart(ownerUid, 'user', 56);
  const safeCourse = sanitizeBookmarkIdPart(courseId, 'course', 64);
  return `bm_${safeOwner}_${safeCourse}`.slice(0, 128);
}

export function normalizeCourseBookmark(
  raw: Partial<CourseBookmark>,
  fallbackOwnerUid: string
): CourseBookmark {
  const nowIso = new Date().toISOString();
  const safeOwnerUid = sanitizeBookmarkIdPart(raw.ownerUid || fallbackOwnerUid, 'guest', 128);
  const safeCourseId = sanitizeBookmarkIdPart(raw.courseId || 'course', 'course', 128);
  const safeId = buildBookmarkDocId(safeOwnerUid, safeCourseId);

  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt.trim()
      ? raw.createdAt.trim().slice(0, 64)
      : nowIso;
  const updatedAt =
    typeof raw.updatedAt === 'string' && raw.updatedAt.trim()
      ? raw.updatedAt.trim().slice(0, 64)
      : createdAt;

  return {
    id: safeId,
    ownerUid: safeOwnerUid,
    courseId: safeCourseId,
    ...(raw.courseCode ? { courseCode: String(raw.courseCode).trim().slice(0, 64) } : {}),
    ...(raw.courseTitle ? { courseTitle: String(raw.courseTitle).trim().slice(0, 200) } : {}),
    createdAt,
    updatedAt
  };
}

export function loadLocalCourseBookmarks(userId: string): CourseBookmark[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byCourse = new Map<string, CourseBookmark>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || typeof item.courseId !== 'string' || !item.courseId.trim()) {
        continue;
      }
      const normalized = normalizeCourseBookmark(item, userId);
      const existing = byCourse.get(normalized.courseId);
      if (!existing) {
        byCourse.set(normalized.courseId, normalized);
      } else {
        const existingMs = Date.parse(existing.updatedAt) || 0;
        const incomingMs = Date.parse(normalized.updatedAt) || 0;
        if (incomingMs >= existingMs) {
          byCourse.set(normalized.courseId, normalized);
        }
      }
    }
    return Array.from(byCourse.values()).sort(
      (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
    );
  } catch {
    return [];
  }
}

export function saveLocalCourseBookmarks(userId: string, bookmarks: CourseBookmark[]): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(bookmarks));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

export function mergeCourseBookmarks(
  localBookmarks: CourseBookmark[],
  remoteBookmarks: CourseBookmark[] | null,
  ownerUid: string
): CourseBookmark[] {
  const byCourse = new Map<string, CourseBookmark>();

  for (const item of localBookmarks) {
    const normalized = normalizeCourseBookmark(item, ownerUid);
    byCourse.set(normalized.courseId, normalized);
  }

  if (remoteBookmarks) {
    for (const remote of remoteBookmarks) {
      const normalized = normalizeCourseBookmark(remote, ownerUid);
      const existing = byCourse.get(normalized.courseId);
      if (!existing) {
        byCourse.set(normalized.courseId, normalized);
      } else {
        const existingMs = Date.parse(existing.updatedAt) || 0;
        const remoteMs = Date.parse(normalized.updatedAt) || 0;
        byCourse.set(normalized.courseId, remoteMs >= existingMs ? normalized : existing);
      }
    }
  }

  return Array.from(byCourse.values()).sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  );
}
