export interface QuickNote {
  id: string;
  ownerUid: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  content: string;
  videoTimestampSeconds?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface QuickNoteInput {
  id?: string;
  courseId: string;
  courseCode?: string;
  courseTitle?: string;
  moduleId: string;
  moduleTitle: string;
  title?: string;
  content: string;
  videoTimestampSeconds?: number;
  tags?: string[];
}

export const QUICK_NOTE_TAGS = [
  'Concept',
  'CLI Command',
  'Protocol',
  'Exam Tip',
  'Lab Step',
  'Troubleshooting',
] as const;

const STORAGE_PREFIX = 'netpulse_quick_notes_v1';

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`;
}

export function sanitizeNoteId(rawId: string): string {
  const cleaned = (rawId || '').replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `qn-${Date.now()}`;
}

export function sanitizeNoteTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];
  const unique = new Set<string>();
  for (const item of rawTags) {
    if (typeof item === 'string') {
      const trimmed = item.trim().slice(0, 40);
      if (trimmed.length > 0) {
        unique.add(trimmed);
      }
    }
    if (unique.size >= 6) break;
  }
  return Array.from(unique);
}

export function sanitizeVideoTimestamp(seconds: unknown): number | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return undefined;
  }
  return Math.min(86400, Math.floor(seconds));
}

export function formatVideoTimestamp(seconds?: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const safe = Math.floor(seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function normalizeQuickNote(
  raw: Partial<QuickNote>,
  fallbackOwnerUid: string
): QuickNote {
  const nowIso = new Date().toISOString();
  const safeId = sanitizeNoteId(
    raw.id || `qn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );
  const safeOwnerUid = sanitizeNoteId(raw.ownerUid || fallbackOwnerUid);
  const safeCourseId = sanitizeNoteId(raw.courseId || 'general');
  const safeModuleId = sanitizeNoteId(raw.moduleId || 'module-general');
  const rawContent = String(raw.content || '').trim().slice(0, 4000);
  const fallbackTitle =
    rawContent
      .split('\n')[0]
      ?.replace(/^#+\s*/, '')
      .trim()
      .slice(0, 80) || 'Technical Concept';
  const safeTitle = String(raw.title || fallbackTitle).trim().slice(0, 140) || fallbackTitle;
  const safeTimestamp = sanitizeVideoTimestamp(raw.videoTimestampSeconds);

  return {
    id: safeId,
    ownerUid: safeOwnerUid,
    courseId: safeCourseId,
    ...(raw.courseCode ? { courseCode: String(raw.courseCode).trim().slice(0, 64) } : {}),
    ...(raw.courseTitle ? { courseTitle: String(raw.courseTitle).trim().slice(0, 200) } : {}),
    moduleId: safeModuleId,
    moduleTitle: String(raw.moduleTitle || 'Lesson Notes').trim().slice(0, 200) || 'Lesson Notes',
    title: safeTitle,
    content: rawContent,
    ...(typeof safeTimestamp === 'number' ? { videoTimestampSeconds: safeTimestamp } : {}),
    tags: sanitizeNoteTags(raw.tags),
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt.slice(0, 64) : nowIso,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt.slice(0, 64) : nowIso,
  };
}

export function loadLocalQuickNotes(userId: string): QuickNote[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item === 'object' && typeof item.content === 'string' && item.content.trim().length > 0)
      .map(item => normalizeQuickNote(item, userId));
  } catch {
    return [];
  }
}

export function saveLocalQuickNotes(userId: string, notes: QuickNote[]): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(notes));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

export function mergeQuickNotes(
  localNotes: QuickNote[],
  remoteNotes: QuickNote[] | null
): QuickNote[] {
  const map = new Map<string, QuickNote>();

  for (const note of localNotes) {
    map.set(note.id, note);
  }

  if (remoteNotes) {
    for (const remote of remoteNotes) {
      const existing = map.get(remote.id);
      if (!existing) {
        map.set(remote.id, remote);
      } else {
        const existingMs = Date.parse(existing.updatedAt) || 0;
        const remoteMs = Date.parse(remote.updatedAt) || 0;
        map.set(remote.id, remoteMs >= existingMs ? remote : existing);
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
  );
}
