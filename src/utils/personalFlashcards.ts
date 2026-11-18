import {
  CardMasteryStatus,
  FlashcardCategory,
  PersonalFlashcard,
} from '../components/Flashcards/flashcardTypes';

export const GENERAL_COURSE_ID = 'general';

const STORAGE_PREFIX = 'netpulse_personal_flashcards_v1';

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId || 'guest'}`;
}

export function sanitizeFlashcardId(rawId: string): string {
  const cleaned = (rawId || '').replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `fc-${Date.now()}`;
}

export function sanitizeCourseRefId(rawId?: string): string {
  const cleaned = (rawId || '').replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || GENERAL_COURSE_ID;
}

function sanitizeCategory(raw?: string): FlashcardCategory {
  if (
    raw === 'Terminology' ||
    raw === 'Protocol' ||
    raw === 'Port Number' ||
    raw === 'Architecture'
  ) {
    return raw;
  }
  return 'Terminology';
}

function sanitizeMastery(raw?: string): CardMasteryStatus {
  if (raw === 'mastered' || raw === 'review') return raw;
  return 'unreviewed';
}

export function normalizePersonalFlashcard(
  raw: Partial<PersonalFlashcard>,
  fallbackOwnerUid: string
): PersonalFlashcard {
  const nowIso = new Date().toISOString();
  const safeId = sanitizeFlashcardId(raw.id || `fc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const safeOwnerUid = sanitizeFlashcardId(raw.ownerUid || fallbackOwnerUid);
  const safeCourseId = sanitizeCourseRefId(raw.courseId);
  const safeModuleId = raw.moduleId ? sanitizeFlashcardId(raw.moduleId) : undefined;

  return {
    id: safeId,
    ownerUid: safeOwnerUid,
    courseId: safeCourseId,
    ...(raw.courseCode ? { courseCode: String(raw.courseCode).trim().slice(0, 64) } : {}),
    ...(raw.courseTitle ? { courseTitle: String(raw.courseTitle).trim().slice(0, 200) } : {}),
    ...(safeModuleId ? { moduleId: safeModuleId } : {}),
    ...(raw.moduleTitle ? { moduleTitle: String(raw.moduleTitle).trim().slice(0, 200) } : {}),
    category: sanitizeCategory(raw.category),
    term: String(raw.term || 'Networking Concept').trim().slice(0, 140) || 'Networking Concept',
    question: String(raw.question || '').trim().slice(0, 600),
    answer: String(raw.answer || '').trim().slice(0, 800),
    ...(raw.portNumber ? { portNumber: String(raw.portNumber).trim().slice(0, 40) } : {}),
    ...(raw.transportProtocol
      ? { transportProtocol: String(raw.transportProtocol).trim().slice(0, 40) }
      : {}),
    ...(raw.osiLayer ? { osiLayer: String(raw.osiLayer).trim().slice(0, 64) } : {}),
    explanation: String(raw.explanation || '').trim().slice(0, 1200),
    memoryTip: String(raw.memoryTip || '').trim().slice(0, 600),
    masteryStatus: sanitizeMastery(raw.masteryStatus),
    createdAt: typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt.slice(0, 64) : nowIso,
    updatedAt: typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt.slice(0, 64) : nowIso,
  };
}

export function loadLocalPersonalFlashcards(userId: string): PersonalFlashcard[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item => item && typeof item === 'object' && typeof item.question === 'string' && typeof item.answer === 'string')
      .map(item => normalizePersonalFlashcard(item, userId));
  } catch {
    return [];
  }
}

export function saveLocalPersonalFlashcards(
  userId: string,
  cards: PersonalFlashcard[]
): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(cards));
  } catch {
    // Ignore localStorage quota or private-mode errors
  }
}

export function mergePersonalFlashcards(
  localCards: PersonalFlashcard[],
  remoteCards: PersonalFlashcard[] | null
): PersonalFlashcard[] {
  const map = new Map<string, PersonalFlashcard>();

  for (const card of localCards) {
    map.set(card.id, card);
  }

  if (remoteCards) {
    for (const remote of remoteCards) {
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
