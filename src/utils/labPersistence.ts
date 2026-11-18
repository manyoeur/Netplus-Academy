import { SimDevice, SimLink } from '../components/Lab/networkSimTypes';

export interface ActiveLabDraft {
  draftKey: string;
  userId: string;
  activeSavedLabId?: string;
  title?: string;
  presetId: string;
  devices: SimDevice[];
  links: SimLink[];
  updatedAt: string;
}

export interface SavedLabRecord {
  id: string;
  userId: string;
  title: string;
  presetId: string;
  devices: SimDevice[];
  links: SimLink[];
  deviceCount: number;
  linkCount: number;
  objectivesPassed: number;
  objectivesTotal: number;
  status?: 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'cloud' | 'local';
}

const IDB_NAME = 'netplus_academy_labs_idb_v1';
const IDB_VERSION = 1;
const STORE_DRAFTS = 'drafts';
const STORE_SAVED_LABS = 'savedLabs';

const LEGACY_DRAFT_PREFIX = 'netpulse_academy_network_lab_v1';
const FALLBACK_DRAFTS_KEY = 'netpulse_academy_lab_drafts_fallback_v1';
const FALLBACK_SAVED_KEY = 'netpulse_academy_lab_saved_fallback_v1';

// Strip undefined properties & bound array sizes so data is 100% Firestore + IndexedDB safe
function stripUndefinedDeep<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map(item => stripUndefinedDeep(item)) as unknown as T;
  }
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(val as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    });
    return out as T;
  }
  return val;
}

export function sanitizeDevicesForStorage(devices: SimDevice[]): SimDevice[] {
  return devices.slice(0, 40).map(dev =>
    stripUndefinedDeep({
      ...dev,
      id: String(dev.id).slice(0, 128),
      name: String(dev.name || 'Device').slice(0, 64),
      model: String(dev.model || '').slice(0, 80),
      x: Math.round(Number(dev.x) || 0),
      y: Math.round(Number(dev.y) || 0),
      cliHistory: Array.isArray(dev.cliHistory)
        ? dev.cliHistory.slice(-40).map(line => String(line).slice(0, 400))
        : [],
      interfaces: Array.isArray(dev.interfaces) ? dev.interfaces.slice(0, 24) : [],
      staticRoutes: Array.isArray(dev.staticRoutes) ? dev.staticRoutes.slice(0, 32) : [],
      vlans: Array.isArray(dev.vlans) ? dev.vlans.slice(0, 32) : []
    })
  );
}

export function sanitizeLinksForStorage(links: SimLink[]): SimLink[] {
  return links.slice(0, 80).map(link =>
    stripUndefinedDeep({
      id: String(link.id).slice(0, 128),
      cableType: link.cableType,
      fromDeviceId: String(link.fromDeviceId).slice(0, 128),
      fromPort: String(link.fromPort).slice(0, 64),
      toDeviceId: String(link.toDeviceId).slice(0, 128),
      toPort: String(link.toPort).slice(0, 64)
    })
  );
}

export function sanitizeLabId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `lab-${Date.now()}`;
}

function openLabsDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
          db.createObjectStore(STORE_DRAFTS, { keyPath: 'draftKey' });
        }
        if (!db.objectStoreNames.contains(STORE_SAVED_LABS)) {
          const store = db.createObjectStore(STORE_SAVED_LABS, { keyPath: 'id' });
          store.createIndex('by_user', 'userId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function readFallbackMap<T>(storageKey: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeFallbackMap<T>(storageKey: string, data: Record<string, T>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // ignore storage errors
  }
}

export async function loadActiveLabDraftFromIdb(
  userId: string
): Promise<ActiveLabDraft | null> {
  const draftKey = userId;
  const db = await openLabsDb();

  if (db) {
    const idbDraft = await new Promise<ActiveLabDraft | null>(resolve => {
      try {
        const tx = db.transaction(STORE_DRAFTS, 'readonly');
        const store = tx.objectStore(STORE_DRAFTS);
        const req = store.get(draftKey);
        req.onsuccess = () => resolve((req.result as ActiveLabDraft) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (idbDraft && idbDraft.userId === userId) return idbDraft;
  } else {
    const fallback = readFallbackMap<ActiveLabDraft>(FALLBACK_DRAFTS_KEY)[draftKey];
    if (fallback && fallback.userId === userId) return fallback;
  }

  // Migrate any legacy localStorage draft on first IndexedDB open
  try {
    const legacyRaw = localStorage.getItem(`${LEGACY_DRAFT_PREFIX}:${userId}`);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      if (legacy && typeof legacy.presetId === 'string' && Array.isArray(legacy.devices) && Array.isArray(legacy.links)) {
        const migrated: ActiveLabDraft = {
          draftKey,
          userId,
          presetId: legacy.presetId,
          devices: sanitizeDevicesForStorage(legacy.devices),
          links: sanitizeLinksForStorage(legacy.links),
          updatedAt: new Date().toISOString()
        };
        await saveActiveLabDraftToIdb(migrated);
        return migrated;
      }
    }
  } catch {
    // ignore legacy parse error
  }

  return null;
}

export async function saveActiveLabDraftToIdb(draft: ActiveLabDraft): Promise<void> {
  const sanitized: ActiveLabDraft = {
    ...draft,
    devices: sanitizeDevicesForStorage(draft.devices),
    links: sanitizeLinksForStorage(draft.links),
    updatedAt: draft.updatedAt || new Date().toISOString()
  };

  const db = await openLabsDb();
  if (!db) {
    const all = readFallbackMap<ActiveLabDraft>(FALLBACK_DRAFTS_KEY);
    all[draft.draftKey] = sanitized;
    writeFallbackMap(FALLBACK_DRAFTS_KEY, all);
    return;
  }

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_DRAFTS, 'readwrite');
      tx.objectStore(STORE_DRAFTS).put(sanitized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearActiveLabDraftFromIdb(userId: string): Promise<void> {
  const draftKey = userId;
  try {
    localStorage.removeItem(`${LEGACY_DRAFT_PREFIX}:${userId}`);
  } catch {
    // ignore storage errors
  }

  const db = await openLabsDb();
  if (!db) {
    const all = readFallbackMap<ActiveLabDraft>(FALLBACK_DRAFTS_KEY);
    delete all[draftKey];
    writeFallbackMap(FALLBACK_DRAFTS_KEY, all);
    return;
  }

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_DRAFTS, 'readwrite');
      tx.objectStore(STORE_DRAFTS).delete(draftKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function listSavedLabsFromIdb(userId: string): Promise<SavedLabRecord[]> {
  const db = await openLabsDb();
  let items: SavedLabRecord[] = [];

  if (!db) {
    const all = readFallbackMap<SavedLabRecord>(FALLBACK_SAVED_KEY);
    items = Object.values(all).filter(item => item.userId === userId);
  } else {
    items = await new Promise<SavedLabRecord[]>(resolve => {
      try {
        const tx = db.transaction(STORE_SAVED_LABS, 'readonly');
        const index = tx.objectStore(STORE_SAVED_LABS).index('by_user');
        const req = index.getAll(IDBKeyRange.only(userId));
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  return items
    .filter(item => item.userId === userId)
    .sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export async function putSavedLabToIdb(record: SavedLabRecord): Promise<void> {
  const sanitized: SavedLabRecord = {
    ...record,
    id: sanitizeLabId(record.id),
    title: record.title.trim().slice(0, 120) || 'Untitled Topology',
    devices: sanitizeDevicesForStorage(record.devices),
    links: sanitizeLinksForStorage(record.links)
  };

  const db = await openLabsDb();
  if (!db) {
    const all = readFallbackMap<SavedLabRecord>(FALLBACK_SAVED_KEY);
    all[sanitized.id] = sanitized;
    writeFallbackMap(FALLBACK_SAVED_KEY, all);
    return;
  }

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_SAVED_LABS, 'readwrite');
      tx.objectStore(STORE_SAVED_LABS).put(sanitized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteSavedLabFromIdb(labId: string, userId: string): Promise<void> {
  const db = await openLabsDb();
  if (!db) {
    const all = readFallbackMap<SavedLabRecord>(FALLBACK_SAVED_KEY);
    if (all[labId]?.userId === userId) {
      delete all[labId];
      writeFallbackMap(FALLBACK_SAVED_KEY, all);
    }
    return;
  }

  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE_SAVED_LABS, 'readwrite');
      const store = tx.objectStore(STORE_SAVED_LABS);
      const getReq = store.get(labId);
      getReq.onsuccess = () => {
        const existing = getReq.result as SavedLabRecord | undefined;
        if (existing && existing.userId === userId) {
          store.delete(labId);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
