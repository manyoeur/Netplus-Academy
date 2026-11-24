import {
  LabExerciseTopology,
  buildDefaultLabExerciseTopology
} from '../data/labExerciseTopologies';
import {
  DEFAULT_LAB_CANVAS_HEIGHT,
  DEFAULT_LAB_CANVAS_WIDTH,
  normalizeCanvasDimensions,
  sanitizeDevicesForStorage,
  sanitizeLabId,
  sanitizeLabelsForStorage,
  sanitizeLinksForStorage,
  sanitizeShapesForStorage
} from './labPersistence';

const STORAGE_KEY = 'netpulse_lab_exercise_topologies_v1';
export const LAB_EXERCISE_TOPOLOGIES_UPDATED_EVENT =
  'netpulse:lab-exercise-topologies-updated';

export type LabExerciseTopologyMap = Record<string, LabExerciseTopology>;

export function normalizeLabExerciseTopology(
  raw: Partial<LabExerciseTopology> & { labId: string }
): LabExerciseTopology {
  const safeLabId = sanitizeLabId(raw.labId);
  const { width, height } = normalizeCanvasDimensions(
    raw.canvasWidth ?? DEFAULT_LAB_CANVAS_WIDTH,
    raw.canvasHeight ?? DEFAULT_LAB_CANVAS_HEIGHT
  );

  return {
    labId: safeLabId,
    canvasWidth: width,
    canvasHeight: height,
    devices: sanitizeDevicesForStorage(Array.isArray(raw.devices) ? raw.devices : []),
    links: sanitizeLinksForStorage(Array.isArray(raw.links) ? raw.links : []),
    shapes: sanitizeShapesForStorage(raw.shapes, width, height),
    labels: sanitizeLabelsForStorage(raw.labels, width, height),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    updatedByName: typeof raw.updatedByName === 'string' ? raw.updatedByName : undefined,
    updatedByRole:
      raw.updatedByRole === 'admin' || raw.updatedByRole === 'instructor'
        ? raw.updatedByRole
        : undefined,
    isCustomized: Boolean(raw.isCustomized ?? true)
  };
}

export function loadLocalLabExerciseTopologies(): LabExerciseTopologyMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: LabExerciseTopologyMap = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        const normalized = normalizeLabExerciseTopology({
          ...(value as Partial<LabExerciseTopology>),
          labId: key
        });
        out[normalized.labId] = normalized;
      }
    });
    return out;
  } catch {
    return {};
  }
}

export function saveLocalLabExerciseTopology(
  topology: LabExerciseTopology
): LabExerciseTopologyMap {
  const existing = loadLocalLabExerciseTopologies();
  const normalized = normalizeLabExerciseTopology({
    ...topology,
    isCustomized: true,
    updatedAt: topology.updatedAt || new Date().toISOString()
  });
  const next = {
    ...existing,
    [normalized.labId]: normalized
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(LAB_EXERCISE_TOPOLOGIES_UPDATED_EVENT));
  } catch {
    // Ignore storage quota issues
  }
  return next;
}

export function deleteLocalLabExerciseTopology(
  labId: string
): LabExerciseTopologyMap {
  const existing = loadLocalLabExerciseTopologies();
  const safeId = sanitizeLabId(labId);
  const next = { ...existing };
  delete next[safeId];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(LAB_EXERCISE_TOPOLOGIES_UPDATED_EVENT));
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function mergeLabExerciseTopologyMaps(
  localMap: LabExerciseTopologyMap,
  remoteList: LabExerciseTopology[] | null
): LabExerciseTopologyMap {
  if (!remoteList || remoteList.length === 0) return localMap;
  const merged: LabExerciseTopologyMap = { ...localMap };
  remoteList.forEach(remote => {
    const normalized = normalizeLabExerciseTopology(remote);
    const localMatch = merged[normalized.labId];
    const localMs = localMatch?.updatedAt ? Date.parse(localMatch.updatedAt) || 0 : -1;
    const remoteMs = normalized.updatedAt ? Date.parse(normalized.updatedAt) || 0 : 0;
    if (!localMatch || remoteMs >= localMs) {
      merged[normalized.labId] = normalized;
    }
  });
  return merged;
}

export function getResolvedLabExerciseTopology(
  labId: string,
  customMap: LabExerciseTopologyMap
): LabExerciseTopology {
  const custom = customMap[labId];
  if (custom) {
    return custom;
  }
  return buildDefaultLabExerciseTopology(labId);
}
