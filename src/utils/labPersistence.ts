import { SimDevice, SimDiagramLabel, SimLink, SimTopologyShape } from '../components/Lab/networkSimTypes';

export const DEFAULT_LAB_CANVAS_WIDTH = 1000;
export const DEFAULT_LAB_CANVAS_HEIGHT = 580;
export const MAX_LAB_CANVAS_WIDTH = 4000;
export const MAX_LAB_CANVAS_HEIGHT = 2500;

export interface ActiveLabDraft {
  draftKey: string;
  userId: string;
  activeSavedLabId?: string;
  title?: string;
  presetId: string;
  canvasWidth?: number;
  canvasHeight?: number;
  devices: SimDevice[];
  links: SimLink[];
  shapes?: SimTopologyShape[];
  labels?: SimDiagramLabel[];
  updatedAt: string;
}

export interface SavedLabRecord {
  id: string;
  userId: string;
  title: string;
  presetId: string;
  canvasWidth?: number;
  canvasHeight?: number;
  devices: SimDevice[];
  links: SimLink[];
  shapes?: SimTopologyShape[];
  labels?: SimDiagramLabel[];
  deviceCount: number;
  linkCount: number;
  objectivesPassed: number;
  objectivesTotal: number;
  status?: 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
  syncStatus: 'cloud' | 'local';
}

export function normalizeCanvasDimensions(
  rawWidth?: unknown,
  rawHeight?: unknown
): { width: number; height: number } {
  const wNum = Number(rawWidth);
  const hNum = Number(rawHeight);
  const width = Number.isFinite(wNum)
    ? Math.round(Math.min(MAX_LAB_CANVAS_WIDTH, Math.max(DEFAULT_LAB_CANVAS_WIDTH, wNum)))
    : DEFAULT_LAB_CANVAS_WIDTH;
  const height = Number.isFinite(hNum)
    ? Math.round(Math.min(MAX_LAB_CANVAS_HEIGHT, Math.max(DEFAULT_LAB_CANVAS_HEIGHT, hNum)))
    : DEFAULT_LAB_CANVAS_HEIGHT;
  return { width, height };
}

export function computeRequiredCanvasSize(
  devices: SimDevice[] = [],
  shapes: SimTopologyShape[] = [],
  labels: SimDiagramLabel[] = [],
  requestedWidth?: number,
  requestedHeight?: number
): { width: number; height: number } {
  const base = normalizeCanvasDimensions(requestedWidth, requestedHeight);
  let reqW = base.width;
  let reqH = base.height;

  devices.forEach(dev => {
    if (Number.isFinite(dev.x)) reqW = Math.max(reqW, Math.ceil(dev.x + 60));
    if (Number.isFinite(dev.y)) reqH = Math.max(reqH, Math.ceil(dev.y + 60));
  });
  shapes.forEach(shape => {
    if (Number.isFinite(shape.x) && Number.isFinite(shape.width)) {
      reqW = Math.max(reqW, Math.ceil(shape.x + shape.width + 12));
    }
    if (Number.isFinite(shape.y) && Number.isFinite(shape.height)) {
      reqH = Math.max(reqH, Math.ceil(shape.y + shape.height + 12));
    }
  });
  labels.forEach(lbl => {
    if (Number.isFinite(lbl.x)) reqW = Math.max(reqW, Math.ceil(lbl.x + 40));
    if (Number.isFinite(lbl.y)) reqH = Math.max(reqH, Math.ceil(lbl.y + 24));
  });

  return {
    width: Math.min(MAX_LAB_CANVAS_WIDTH, Math.max(DEFAULT_LAB_CANVAS_WIDTH, reqW)),
    height: Math.min(MAX_LAB_CANVAS_HEIGHT, Math.max(DEFAULT_LAB_CANVAS_HEIGHT, reqH))
  };
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
  return devices.slice(0, 80).map(dev => {
    const rawRot = Number(dev.rotation);
    const normRot = Number.isFinite(rawRot) ? ((Math.round(rawRot) % 360) + 360) % 360 : 0;
    const rawLx = Number(dev.labelOffsetX);
    const normLx = Number.isFinite(rawLx) ? Math.round(Math.min(220, Math.max(-220, rawLx))) : 0;
    const rawLy = Number(dev.labelOffsetY);
    const normLy = Number.isFinite(rawLy) ? Math.round(Math.min(180, Math.max(-180, rawLy))) : 0;
    return stripUndefinedDeep({
      ...dev,
      id: String(dev.id).slice(0, 128),
      name: String(dev.name || 'Device').slice(0, 64),
      model: String(dev.model || '').slice(0, 80),
      x: Math.round(Number(dev.x) || 0),
      y: Math.round(Number(dev.y) || 0),
      rotation: normRot !== 0 ? normRot : undefined,
      labelOffsetX: normLx !== 0 ? normLx : undefined,
      labelOffsetY: normLy !== 0 ? normLy : undefined,
      cliHistory: Array.isArray(dev.cliHistory)
        ? dev.cliHistory.slice(-40).map(line => String(line).slice(0, 400))
        : [],
      interfaces: Array.isArray(dev.interfaces) ? dev.interfaces.slice(0, 24) : [],
      staticRoutes: Array.isArray(dev.staticRoutes) ? dev.staticRoutes.slice(0, 32) : [],
      vlans: Array.isArray(dev.vlans) ? dev.vlans.slice(0, 32) : []
    });
  });
}

export function sanitizeLinksForStorage(links: SimLink[]): SimLink[] {
  return links.slice(0, 160).map(link =>
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

export function sanitizeShapesForStorage(
  shapes: SimTopologyShape[] | undefined,
  maxWidth: number = MAX_LAB_CANVAS_WIDTH,
  maxHeight: number = MAX_LAB_CANVAS_HEIGHT
): SimTopologyShape[] {
  if (!Array.isArray(shapes)) return [];
  const safeMaxW = Math.max(DEFAULT_LAB_CANVAS_WIDTH, Math.min(MAX_LAB_CANVAS_WIDTH, maxWidth));
  const safeMaxH = Math.max(DEFAULT_LAB_CANVAS_HEIGHT, Math.min(MAX_LAB_CANVAS_HEIGHT, maxHeight));
  return shapes.slice(0, 60).map(shape =>
    stripUndefinedDeep({
      id: String(shape.id).slice(0, 128),
      kind: shape.kind === 'circle' ? ('circle' as const) : ('rectangle' as const),
      x: Math.round(Math.min(safeMaxW - 20, Math.max(0, Number(shape.x) || 0))),
      y: Math.round(Math.min(safeMaxH - 20, Math.max(0, Number(shape.y) || 0))),
      width: Math.round(Math.min(safeMaxW - 10, Math.max(50, Number(shape.width) || 180))),
      height: Math.round(Math.min(safeMaxH - 10, Math.max(40, Number(shape.height) || 120))),
      fillColor: String(shape.fillColor || 'transparent').slice(0, 32),
      fillOpacity: Math.min(1, Math.max(0, Number.isFinite(Number(shape.fillOpacity)) ? Number(shape.fillOpacity) : 0.32)),
      borderColor: String(shape.borderColor || '#64748b').slice(0, 32),
      lineStyle:
        shape.lineStyle === 'dotted'
          ? ('dotted' as const)
          : shape.lineStyle === 'solid'
          ? ('solid' as const)
          : ('dashed' as const),
      borderWidth: Math.min(5, Math.max(1, Math.round(Number(shape.borderWidth) || 2))),
      label: typeof shape.label === 'string' && shape.label.trim() ? shape.label.trim().slice(0, 80) : undefined,
      labelColor: typeof shape.labelColor === 'string' && shape.labelColor.trim() ? shape.labelColor.trim().slice(0, 32) : undefined
    })
  );
}

export function sanitizeLabelsForStorage(
  labels: SimDiagramLabel[] | undefined,
  maxWidth: number = MAX_LAB_CANVAS_WIDTH,
  maxHeight: number = MAX_LAB_CANVAS_HEIGHT
): SimDiagramLabel[] {
  if (!Array.isArray(labels)) return [];
  const safeMaxW = Math.max(DEFAULT_LAB_CANVAS_WIDTH, Math.min(MAX_LAB_CANVAS_WIDTH, maxWidth));
  const safeMaxH = Math.max(DEFAULT_LAB_CANVAS_HEIGHT, Math.min(MAX_LAB_CANVAS_HEIGHT, maxHeight));
  return labels
    .slice(0, 80)
    .map(item =>
      stripUndefinedDeep({
        id: String(item.id).slice(0, 128),
        text: String(item.text || '').slice(0, 160),
        x: Math.round(Math.min(safeMaxW - 20, Math.max(20, Number(item.x) || 500))),
        y: Math.round(Math.min(safeMaxH - 15, Math.max(15, Number(item.y) || 290))),
        color: typeof item.color === 'string' && item.color.trim() ? item.color.trim().slice(0, 32) : undefined,
        bgColor: typeof item.bgColor === 'string' && item.bgColor.trim() ? item.bgColor.trim().slice(0, 32) : undefined,
        fontSize: Math.min(20, Math.max(10, Math.round(Number(item.fontSize) || 12))),
        bold: item.bold !== undefined ? Boolean(item.bold) : true,
        italic: item.italic ? true : undefined
      })
    )
    .filter(item => item.text.trim().length > 0);
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
    shapes: sanitizeShapesForStorage(draft.shapes),
    labels: sanitizeLabelsForStorage(draft.labels),
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
    links: sanitizeLinksForStorage(record.links),
    shapes: sanitizeShapesForStorage(record.shapes),
    labels: sanitizeLabelsForStorage(record.labels)
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
