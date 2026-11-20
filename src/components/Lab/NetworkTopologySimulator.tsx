import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Network,
  MousePointer2,
  Trash2,
  Plus,
  RotateCcw,
  RotateCw,
  Play,
  Terminal as TerminalIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Upload,
  CheckSquare,
  ArrowRight,
  Power,
  Save,
  FolderOpen,
  Cloud,
  HardDrive,
  Archive,
  Copy,
  FileCode2,
  ArrowLeft,
  LayoutGrid,
  Grid3x3,
  Image as ImageIcon,
  FileCode,
  Square,
  Circle,
  Pencil,
  Check,
  Type,
  Magnet,
  Hand,
  SquareDashedMousePointer,
  Move,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Minus,
  X,
  ChevronDown,
  Tag,
  Settings
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import {
  auth,
  deleteLabTopologyFromFirestore,
  fetchLabTopologiesFromFirestore,
  saveLabTopologyToFirestore
} from '../../firebase';
import {
  DEFAULT_LAB_CANVAS_HEIGHT,
  DEFAULT_LAB_CANVAS_WIDTH,
  LabGridSettings,
  MAX_LAB_CANVAS_HEIGHT,
  MAX_LAB_CANVAS_WIDTH,
  SavedLabRecord,
  clearActiveLabDraftFromIdb,
  computeRequiredCanvasSize,
  deleteSavedLabFromIdb,
  listSavedLabsFromIdb,
  loadActiveLabDraftFromIdb,
  putSavedLabToIdb,
  sanitizeDevicesForStorage,
  sanitizeLabId,
  sanitizeLinksForStorage,
  sanitizeShapesForStorage,
  saveActiveLabDraftToIdb,
  sanitizeLabelsForStorage
} from '../../utils/labPersistence';
import {
  exportTopologyAsPng,
  exportTopologyAsSvg
} from '../../utils/topologyImageExport';
import {
  buildTopologyJsonPayload,
  parseAndValidateTopologyJson,
  triggerTopologyJsonDownload
} from '../../utils/topologyJson';
import {
  LabScenarioPreset,
  LabTemplateCategory,
  PingSimulationResult,
  SimCableType,
  SimDevice,
  SimDeviceType,
  SimDiagramLabel,
  SimLink,
  SimShapeKind,
  SimShapeLineStyle,
  SimTopologyShape
} from './networkSimTypes';
import {
  computeCableGeometry,
  createDefaultDevice,
  evaluateLinkStatus,
  executeDeviceCommand,
  getCliPrompt,
  getCliTabCompletions,
  getDevicePortAnchors,
  getDevicePortPosition,
  isPortCompatibleWithCable,
  isValidIp,
  simulatePing
} from './networkSimEngine';
import { NETWORK_LAB_PRESETS } from './networkLabPresets';
import { CiscoDeviceIcon, getCiscoDeviceInnerSvg } from './CiscoDeviceIcon';
import { TopologyMiniMap } from './TopologyMiniMap';

type CanvasTool = 'select' | 'marquee' | 'pan' | 'cable' | 'delete';
type CableToolMode = 'auto' | SimCableType;

interface PendingCableSource {
  deviceId: string;
  portName?: string;
}

interface PendingCableTarget {
  deviceId: string;
}

interface LiveCableSnapTarget {
  deviceId: string;
  deviceName: string;
  portName: string;
  shortName: string;
  x: number;
  y: number;
  cableType: SimCableType;
}

interface LiveCableDrawState {
  fromDeviceId: string;
  fromPort: string;
  fromShortName: string;
  fromX: number;
  fromY: number;
  fromPortLocked: boolean;
  cursorX: number;
  cursorY: number;
  startClientX: number;
  startClientY: number;
  isDragGesture: boolean;
  snapTarget: LiveCableSnapTarget | null;
  blockedTarget: {
    deviceId: string;
    deviceName: string;
    x: number;
    y: number;
    reason: string;
  } | null;
}

type ShapeResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type SnapGridStep = 10 | 20 | 40 | 50;
type GridStyle = 'lines' | 'dots';

const GRID_STEP_OPTIONS: SnapGridStep[] = [10, 20, 40, 50];
const SIM_GRID_PREFS_STORAGE_PREFIX = 'netpulse_sim_grid_prefs_v1';

const normalizeGridStep = (raw: unknown): SnapGridStep => {
  const n = Number(raw);
  return n === 10 || n === 20 || n === 40 || n === 50 ? n : 20;
};

const snapToStep = (val: number, step: number): number => Math.round(val / step) * step;

const snapClampedToGrid = (
  val: number,
  min: number,
  max: number,
  step: number,
  enabled: boolean
): number => {
  if (!enabled) {
    return Math.round(Math.min(max, Math.max(min, val)));
  }
  const minGrid = Math.ceil(min / step) * step;
  const maxGrid = Math.floor(max / step) * step;
  if (minGrid > maxGrid) {
    return Math.round(Math.min(max, Math.max(min, val)));
  }
  return Math.min(maxGrid, Math.max(minGrid, snapToStep(val, step)));
};

const alignDevicesToGrid = (
  currentDevices: SimDevice[],
  step: SnapGridStep,
  canvasWidth: number,
  canvasHeight: number
): SimDevice[] => {
  if (currentDevices.length === 0) return currentDevices;
  const minX = 60;
  const maxX = Math.max(minX, canvasWidth - 60);
  const minY = 60;
  const maxY = Math.max(minY, canvasHeight - 60);
  const minGridX = Math.ceil(minX / step) * step;
  const maxGridX = Math.floor(maxX / step) * step;
  const minGridY = Math.ceil(minY / step) * step;
  const maxGridY = Math.floor(maxY / step) * step;
  const occupied = new Set<string>();

  return currentDevices.map(dev => {
    const baseX = snapClampedToGrid(dev.x, minX, maxX, step, true);
    const baseY = snapClampedToGrid(dev.y, minY, maxY, step, true);
    let chosenX = baseX;
    let chosenY = baseY;
    const baseKey = `${chosenX},${chosenY}`;

    if (occupied.has(baseKey) && minGridX <= maxGridX && minGridY <= maxGridY) {
      let bestDist = Infinity;
      for (let ring = 1; ring <= 6; ring++) {
        let foundInRing = false;
        for (let gx = -ring; gx <= ring; gx++) {
          for (let gy = -ring; gy <= ring; gy++) {
            if (Math.abs(gx) !== ring && Math.abs(gy) !== ring) continue;
            const candX = baseX + gx * step;
            const candY = baseY + gy * step;
            if (candX < minGridX || candX > maxGridX || candY < minGridY || candY > maxGridY) {
              continue;
            }
            const key = `${candX},${candY}`;
            if (occupied.has(key)) continue;
            const dist = Math.hypot(candX - dev.x, candY - dev.y);
            if (dist < bestDist) {
              bestDist = dist;
              chosenX = candX;
              chosenY = candY;
              foundInRing = true;
            }
          }
        }
        if (foundInRing) break;
      }
    }

    occupied.add(`${chosenX},${chosenY}`);
    return chosenX === dev.x && chosenY === dev.y ? dev : { ...dev, x: chosenX, y: chosenY };
  });
};

const WORKSPACE_SIZE_PRESETS: Array<{
  id: string;
  label: string;
  width: number;
  height: number;
}> = [
  { id: 'standard', label: 'Standard', width: 1000, height: 580 },
  { id: 'medium', label: 'Medium', width: 1500, height: 870 },
  { id: 'large', label: 'Large', width: 2000, height: 1160 },
  { id: 'enterprise', label: 'Enterprise', width: 2800, height: 1620 }
];

const SHAPE_FILL_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'None', value: 'transparent' },
  { label: 'Lavender', value: '#ddd6fe' },
  { label: 'Mint', value: '#ccfbf1' },
  { label: 'Slate', value: '#cbd5e1' },
  { label: 'Sky', value: '#bae6fd' },
  { label: 'Amber', value: '#fef3c7' },
  { label: 'Rose', value: '#ffe4e6' }
];

const SHAPE_BORDER_PRESETS: Array<{ label: string; value: string }> = [
  { label: 'Slate', value: '#64748b' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Red', value: '#dc2626' }
];

const DIAGRAM_LABEL_COLORS: Array<{ label: string; value: string }> = [
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Slate', value: '#475569' }
];

function toProjectFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `${slug || 'network-lab-project'}.netlab.json`;
}

function getDeviceDisplayLabel(
  dev: SimDevice,
  showCustomLabels: boolean
): { primary: string; secondaryHostname: string | null; isCustomActive: boolean } {
  const custom = dev.customLabel?.trim();
  const isCustomActive = Boolean(showCustomLabels && custom && dev.useCustomLabel !== false);
  if (isCustomActive && custom) {
    return {
      primary: custom,
      secondaryHostname: custom !== dev.name ? dev.name : null,
      isCustomActive: true
    };
  }
  return {
    primary: dev.name,
    secondaryHostname: null,
    isCustomActive: false
  };
}

const CABLE_META: Record<
  SimCableType,
  { label: string; short: string; stroke: string; dash?: string; hint: string }
> = {
  straight: {
    label: 'Copper Straight-Through',
    short: 'Straight',
    stroke: '#0284c7',
    hint: 'Switch <-> Router, PC, or Server'
  },
  crossover: {
    label: 'Copper Crossover',
    short: 'Crossover',
    stroke: '#0ea5e9',
    dash: '6 4',
    hint: 'Router <-> Router, Router <-> PC/Server, or Switch <-> Switch'
  },
  fiber: {
    label: 'Optical Fiber',
    short: 'Fiber',
    stroke: '#f59e0b',
    hint: 'Fiber SFP/Gigabit ports (Gig0/2, Gig1)'
  },
  serial: {
    label: 'Serial DCE/DTE',
    short: 'Serial WAN',
    stroke: '#ef4444',
    dash: '3 3',
    hint: 'Router Serial0/0/x <-> Router Serial0/0/x'
  }
};

const TEMPLATE_CATEGORIES: Array<Exclude<LabTemplateCategory, 'Blank'>> = [
  'LAN & Star',
  'WAN & Routing',
  'Enterprise & Mesh'
];

interface TemplateSummaryItem {
  preset: LabScenarioPreset;
  category: Exclude<LabTemplateCategory, 'Blank'>;
  devices: SimDevice[];
  links: SimLink[];
  summaryCounts: {
    routers: number;
    switches: number;
    endpoints: number;
  };
}

const TemplateTopologyPreview: React.FC<{ devices: SimDevice[]; links: SimLink[] }> = ({
  devices,
  links
}) => {
  const patternId = React.useId();
  return (
    <svg
      viewBox="-30 -20 1060 620"
      className="w-full h-32 rounded-xl bg-slate-100/90 dark:bg-slate-950/90 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300"
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} width="80" height="80" patternUnits="userSpaceOnUse">
          <path
            d="M 80 0 L 0 0 0 80"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="2"
          />
        </pattern>
      </defs>
      <rect x="-30" y="-20" width="1060" height="620" fill={`url(#${patternId})`} />

      {links.map(link => {
        const from = devices.find(d => d.id === link.fromDeviceId);
        const to = devices.find(d => d.id === link.toDeviceId);
        if (!from || !to) return null;
        const meta = CABLE_META[link.cableType];
        return (
          <line
            key={link.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={meta.stroke}
            strokeWidth={7}
            strokeDasharray={meta.dash ? '16 10' : undefined}
            strokeOpacity={0.78}
            strokeLinecap="round"
          />
        );
      })}

      {devices.map((dev, idx) => {
        const previewScale = 1.1;
        const rot = typeof dev.rotation === 'number' && Number.isFinite(dev.rotation) ? dev.rotation : 0;
        return (
          <g key={dev.id} transform={`translate(${dev.x}, ${dev.y})`}>
            <g
              transform={`${rot ? `rotate(${rot}) ` : ''}translate(${(-32 * previewScale).toFixed(1)}, ${(-28 * previewScale).toFixed(1)}) scale(${previewScale})`}
              dangerouslySetInnerHTML={{ __html: getCiscoDeviceInnerSvg(dev.type, `tpl_${patternId}_${idx}`) }}
            />
            <text
              y={46}
              textAnchor="middle"
              fontSize="22"
              fontWeight="700"
              fontFamily="Fira Code, monospace"
              fill="currentColor"
            >
              {dev.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

type AutoLayoutMode = 'grid' | 'circular';

function chunkEvenly<T>(items: T[], maxPerRow: number): T[][] {
  if (items.length === 0) return [];
  const rowCount = Math.ceil(items.length / maxPerRow);
  const rows: T[][] = [];
  let cursor = 0;
  for (let r = 0; r < rowCount; r++) {
    const remaining = items.length - cursor;
    const rowsLeft = rowCount - r;
    const take = Math.ceil(remaining / rowsLeft);
    rows.push(items.slice(cursor, cursor + take));
    cursor += take;
  }
  return rows;
}

function computeAutoLayoutPositions(
  currentDevices: SimDevice[],
  currentLinks: SimLink[],
  mode: AutoLayoutMode,
  canvasWidth: number = DEFAULT_LAB_CANVAS_WIDTH,
  canvasHeight: number = DEFAULT_LAB_CANVAS_HEIGHT
): SimDevice[] {
  const centerX = Math.round(canvasWidth / 2);
  const centerY = Math.round(canvasHeight / 2);
  if (currentDevices.length === 0) return currentDevices;
  if (currentDevices.length === 1) {
    return currentDevices.map(d => ({ ...d, x: centerX, y: centerY }));
  }

  const deviceById = new Map(currentDevices.map(d => [d.id, d]));
  const adj = new Map<string, Set<string>>();
  currentDevices.forEach(d => adj.set(d.id, new Set()));
  currentLinks.forEach(l => {
    if (adj.has(l.fromDeviceId) && adj.has(l.toDeviceId) && l.fromDeviceId !== l.toDeviceId) {
      adj.get(l.fromDeviceId)!.add(l.toDeviceId);
      adj.get(l.toDeviceId)!.add(l.fromDeviceId);
    }
  });

  const positions = new Map<string, { x: number; y: number }>();

  if (mode === 'circular') {
    const typeRank: Record<SimDeviceType, number> = {
      router: 0,
      switch: 1,
      server: 2,
      pc: 3
    };
    const remaining = [...currentDevices].sort((a, b) => {
      const degDiff = (adj.get(b.id)?.size || 0) - (adj.get(a.id)?.size || 0);
      if (degDiff !== 0) return degDiff;
      const typeDiff = typeRank[a.type] - typeRank[b.type];
      if (typeDiff !== 0) return typeDiff;
      return a.name.localeCompare(b.name);
    });

    const visited = new Set<string>();
    const ordered: SimDevice[] = [];

    for (const seed of remaining) {
      if (visited.has(seed.id)) continue;
      const queue: SimDevice[] = [seed];
      visited.add(seed.id);
      while (queue.length > 0) {
        const curr = queue.shift()!;
        ordered.push(curr);
        const neighbors = Array.from(adj.get(curr.id) || [])
          .map(id => deviceById.get(id))
          .filter((d): d is SimDevice => Boolean(d))
          .filter(d => !visited.has(d.id))
          .sort((a, b) => {
            const typeDiff = typeRank[a.type] - typeRank[b.type];
            return typeDiff !== 0 ? typeDiff : a.name.localeCompare(b.name);
          });
        neighbors.forEach(n => {
          visited.add(n.id);
          queue.push(n);
        });
      }
    }

    const n = ordered.length;
    const maxRx = Math.max(210, canvasWidth * 0.41);
    const maxRy = Math.max(135, canvasHeight * 0.39);
    const rx = n <= 3 ? Math.min(maxRx, 210 + (canvasWidth - 1000) * 0.12) : Math.min(maxRx, 190 + n * 24);
    const ry = n <= 3 ? Math.min(maxRy, 135 + (canvasHeight - 580) * 0.12) : Math.min(maxRy, 125 + n * 14);

    ordered.forEach((dev, idx) => {
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / n;
      const x = Math.round(Math.min(canvasWidth - 75, Math.max(75, centerX + rx * Math.cos(angle))));
      const y = Math.round(Math.min(canvasHeight - 75, Math.max(70, centerY + ry * Math.sin(angle))));
      positions.set(dev.id, { x, y });
    });
  } else {
    // Hierarchical / Barycenter Grid Layout: Routers -> Switches -> Servers & PCs
    const routers = currentDevices
      .filter(d => d.type === 'router')
      .sort((a, b) => a.name.localeCompare(b.name));

    const routerOrderMap = new Map(routers.map((d, i) => [d.id, i]));
    const switches = currentDevices
      .filter(d => d.type === 'switch')
      .sort((a, b) => {
        const avgParentRank = (dev: SimDevice) => {
          const parents = Array.from(adj.get(dev.id) || []).filter(id => routerOrderMap.has(id));
          if (parents.length === 0) return Number.MAX_SAFE_INTEGER;
          return (
            parents.reduce((sum, id) => sum + (routerOrderMap.get(id) || 0), 0) / parents.length
          );
        };
        const diff = avgParentRank(a) - avgParentRank(b);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });

    const upperTierMap = new Map<string, number>();
    routers.forEach((d, i) => upperTierMap.set(d.id, i));
    switches.forEach((d, i) => upperTierMap.set(d.id, i));

    const endpoints = currentDevices
      .filter(d => d.type === 'pc' || d.type === 'server')
      .sort((a, b) => {
        const avgParentRank = (dev: SimDevice) => {
          const parents = Array.from(adj.get(dev.id) || []).filter(id => upperTierMap.has(id));
          if (parents.length === 0) return Number.MAX_SAFE_INTEGER;
          return (
            parents.reduce((sum, id) => sum + (upperTierMap.get(id) || 0), 0) / parents.length
          );
        };
        const diff = avgParentRank(a) - avgParentRank(b);
        if (diff !== 0) return diff;
        if (a.type !== b.type) return a.type === 'server' ? 1 : -1;
        return a.name.localeCompare(b.name);
      });

    const maxPerRow = Math.max(5, Math.floor((canvasWidth - 150) / 175));
    const rows: SimDevice[][] = [
      ...chunkEvenly(routers, maxPerRow),
      ...chunkEvenly(switches, maxPerRow),
      ...chunkEvenly(endpoints, maxPerRow)
    ];

    const minY = 92;
    const maxY = Math.max(minY + 120, canvasHeight - 94);
    const rowCount = rows.length;

    rows.forEach((row, rIdx) => {
      const y =
        rowCount === 1
          ? centerY
          : rowCount === 2
          ? rIdx === 0
            ? Math.round(canvasHeight * 0.3)
            : Math.round(canvasHeight * 0.69)
          : Math.round(minY + (rIdx * (maxY - minY)) / (rowCount - 1));

      const count = row.length;
      const usableW = Math.max(200, canvasWidth - 190);
      const colStep = count > 1 ? Math.min(230, usableW / (count - 1)) : 0;
      const startX = centerX - ((count - 1) * colStep) / 2;

      row.forEach((dev, cIdx) => {
        const x = Math.round(Math.min(canvasWidth - 75, Math.max(75, startX + cIdx * colStep)));
        positions.set(dev.id, { x, y });
      });
    });
  }

  return currentDevices.map(dev => {
    const next = positions.get(dev.id);
    return next ? { ...dev, x: next.x, y: next.y } : dev;
  });
}

export const NetworkTopologySimulator: React.FC = () => {
  const { currentUser, isOffline, recordStudyTime } = useAcademy();

  const initialPresetState = useMemo(() => {
    const defaultPreset = NETWORK_LAB_PRESETS[0];
    const built = defaultPreset.buildInitialState();
    return {
      presetId: defaultPreset.id,
      devices: built.devices,
      links: built.links
    };
  }, []);

  const [activePresetId, setActivePresetId] = useState<string>(initialPresetState.presetId);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_LAB_CANVAS_WIDTH,
    height: DEFAULT_LAB_CANVAS_HEIGHT
  });
  const canvasSizeRef = useRef<{ width: number; height: number }>(canvasSize);
  canvasSizeRef.current = canvasSize;
  const [devices, setDevices] = useState<SimDevice[]>(initialPresetState.devices);
  const [links, setLinks] = useState<SimLink[]>(initialPresetState.links);
  const [shapes, setShapes] = useState<SimTopologyShape[]>([]);
  const [diagramLabels, setDiagramLabels] = useState<SimDiagramLabel[]>([]);

  // IndexedDB + Firestore persistent lab project state
  const [workspaceView, setWorkspaceView] = useState<'editor' | 'projects'>('editor');
  const [activeSavedLabId, setActiveSavedLabId] = useState<string | null>(null);
  const [savedLabs, setSavedLabs] = useState<SavedLabRecord[]>([]);
  const [projectFilter, setProjectFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [recentlySavedProjectId, setRecentlySavedProjectId] = useState<string | null>(null);
  const [isSavePromptOpen, setIsSavePromptOpen] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'save' | 'save_and_close'>('save');
  const [saveTitleInput, setSaveTitleInput] = useState<string>('');
  const [saveStatusInput, setSaveStatusInput] = useState<'completed' | 'in_progress'>('completed');
  const [isSavingLab, setIsSavingLab] = useState<boolean>(false);
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const draftHydratedForUserRef = useRef<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const [tool, setTool] = useState<CanvasTool>('select');
  const [autoLayoutMode, setAutoLayoutMode] = useState<AutoLayoutMode>('grid');
  const [cableToolMode, setCableToolMode] = useState<CableToolMode>('auto');
  const [selectedCableType, setSelectedCableType] = useState<SimCableType>('straight');
  const [pendingCableSource, setPendingCableSource] = useState<PendingCableSource | null>(null);
  const [pendingCableTarget, setPendingCableTarget] = useState<PendingCableTarget | null>(null);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    initialPresetState.devices[0]?.id || null
  );
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(
    initialPresetState.devices[0]?.id ? [initialPresetState.devices[0].id] : []
  );
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedDiagramLabelId, setSelectedDiagramLabelId] = useState<string | null>(null);
  const [editingDiagramLabelId, setEditingDiagramLabelId] = useState<string | null>(null);
  const [editingDiagramLabelDraft, setEditingDiagramLabelDraft] = useState<string>('');
  const [editingDeviceLabelId, setEditingDeviceLabelId] = useState<string | null>(null);
  const [editingDeviceLabelDraft, setEditingDeviceLabelDraft] = useState<string>('');
  const [consoleTabIds, setConsoleTabIds] = useState<string[]>([]);
  const [consoleDeviceId, setConsoleDeviceId] = useState<string | null>(null);
  const [isWorkspaceFullscreen, setIsWorkspaceFullscreen] = useState<boolean>(false);
  const [isConsoleMinimized, setIsConsoleMinimized] = useState<boolean>(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState<boolean>(false);
  const [isDraggingConsole, setIsDraggingConsole] = useState<boolean>(false);
  const [consoleOffset, setConsoleOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [consoleSize, setConsoleSize] = useState<{ width: number; height: number } | null>(null);
  const consoleDialogRef = useRef<HTMLDivElement>(null);
  const consoleDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    initX: number;
    initY: number;
  } | null>(null);
  const consoleResizeRef = useRef<{
    startClientX: number;
    startClientY: number;
    initWidth: number;
    initHeight: number;
    initOffsetX: number;
    initOffsetY: number;
  } | null>(null);
  const [longPressMoveDeviceId, setLongPressMoveDeviceId] = useState<string | null>(null);
  const draggedPaletteTypeRef = useRef<SimDeviceType | null>(null);
  const [paletteDropPreview, setPaletteDropPreview] = useState<{
    type: SimDeviceType;
    x: number;
    y: number;
  } | null>(null);
  const suppressDeviceClickAfterDragRef = useRef<boolean>(false);

  useEffect(() => {
    if (workspaceView !== 'editor') {
      setIsWorkspaceFullscreen(false);
    }
  }, [workspaceView]);

  const consoleTabs = useMemo(
    () =>
      consoleTabIds
        .map(id => devices.find(d => d.id === id))
        .filter((d): d is SimDevice => Boolean(d)),
    [consoleTabIds, devices]
  );

  useEffect(() => {
    setConsoleTabIds(prev => {
      const validIds = prev.filter(id => devices.some(d => d.id === id));
      return validIds.length === prev.length ? prev : validIds;
    });
  }, [devices]);

  useEffect(() => {
    if (consoleTabs.length === 0) {
      if (consoleDeviceId !== null) setConsoleDeviceId(null);
      setIsConsoleMinimized(false);
      setIsConsoleExpanded(false);
      setIsDraggingConsole(false);
      setConsoleOffset({ x: 0, y: 0 });
      setConsoleSize(null);
    } else if (!consoleDeviceId || !consoleTabs.some(d => d.id === consoleDeviceId)) {
      setConsoleDeviceId(consoleTabs[consoleTabs.length - 1].id);
    }
  }, [consoleDeviceId, consoleTabs]);

  useEffect(() => {
    if (!consoleDeviceId || isConsoleExpanded || isConsoleMinimized) return;
    const reclampToViewport = () => {
      const viewportEl = viewportRef.current;
      const dialogEl = consoleDialogRef.current;
      if (!viewportEl || !dialogEl) return;
      const vpW = viewportEl.clientWidth;
      const vpH = viewportEl.clientHeight;
      if (vpW <= 0 || vpH <= 0) return;

      setConsoleSize(prev => {
        if (!prev) return prev;
        const maxW = Math.max(380, vpW - 24);
        const maxH = Math.max(270, vpH - 24);
        const nextW = Math.min(prev.width, maxW);
        const nextH = Math.min(prev.height, maxH);
        return nextW === prev.width && nextH === prev.height
          ? prev
          : { width: nextW, height: nextH };
      });

      const dlgW = dialogEl.offsetWidth;
      const dlgH = dialogEl.offsetHeight;
      const maxDx = Math.max(16, Math.floor((vpW - dlgW) / 2) - 8);
      const maxDy = Math.max(16, Math.floor((vpH - dlgH) / 2) - 8);
      setConsoleOffset(prev => {
        const nextX = Math.max(-maxDx, Math.min(maxDx, prev.x));
        const nextY = Math.max(-maxDy, Math.min(maxDy, prev.y));
        return nextX === prev.x && nextY === prev.y ? prev : { x: nextX, y: nextY };
      });
    };

    const rafId = window.requestAnimationFrame(reclampToViewport);
    window.addEventListener('resize', reclampToViewport);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', reclampToViewport);
    };
  }, [consoleDeviceId, isWorkspaceFullscreen, isConsoleExpanded, isConsoleMinimized, consoleSize]);

  // CLI state (per-device draft input so multi-tab CLI sessions stay independent)
  const [cliDraftMap, setCliDraftMap] = useState<Record<string, string>>({});
  const cliInput = consoleDeviceId ? (cliDraftMap[consoleDeviceId] ?? '') : '';
  const setCliInput = useCallback(
    (nextValue: string) => {
      if (!consoleDeviceId) return;
      setCliDraftMap(prev => ({ ...prev, [consoleDeviceId]: nextValue }));
    },
    [consoleDeviceId]
  );
  const [cmdHistoryMap, setCmdHistoryMap] = useState<Record<string, string[]>>({});
  const [cmdCursor, setCmdCursor] = useState<number>(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const cliInputRef = useRef<HTMLInputElement>(null);

  // Viewport & logical canvas refs (zoom/pan wrapper + 1000x580 stage)
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(zoom);
  zoomRef.current = zoom;
  const panRef = useRef<{ x: number; y: number }>(pan);
  panRef.current = pan;
  const [isSpacePanning, setIsSpacePanning] = useState<boolean>(false);
  const isSpacePanningRef = useRef<boolean>(isSpacePanning);
  isSpacePanningRef.current = isSpacePanning;
  const [isPanningActive, setIsPanningActive] = useState<boolean>(false);
  const panStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    initPanX: number;
    initPanY: number;
    moved: boolean;
  } | null>(null);
  const [isMiniMapOpen, setIsMiniMapOpen] = useState<boolean>(true);
  const [isMiniMapDragging, setIsMiniMapDragging] = useState<boolean>(false);
  const miniMapSvgRef = useRef<SVGSVGElement>(null);
  const miniMapDragRef = useRef<{
    svgRect: DOMRect;
    grabOffsetX: number;
    grabOffsetY: number;
  } | null>(null);
  const [viewportMetrics, setViewportMetrics] = useState<{
    vpWidth: number;
    vpHeight: number;
    stageWidth: number;
    stageHeight: number;
    stageOffsetX: number;
    stageOffsetY: number;
  }>({
    vpWidth: DEFAULT_LAB_CANVAS_WIDTH,
    vpHeight: DEFAULT_LAB_CANVAS_HEIGHT,
    stageWidth: DEFAULT_LAB_CANVAS_WIDTH,
    stageHeight: DEFAULT_LAB_CANVAS_HEIGHT,
    stageOffsetX: 0,
    stageOffsetY: 0
  });
  const devicesRef = useRef<SimDevice[]>(devices);
  devicesRef.current = devices;
  const linksRef = useRef<SimLink[]>(links);
  linksRef.current = links;
  const shapesRef = useRef<SimTopologyShape[]>(shapes);
  shapesRef.current = shapes;
  const toolRef = useRef<CanvasTool>(tool);
  toolRef.current = tool;
  const cableToolModeRef = useRef<CableToolMode>(cableToolMode);
  cableToolModeRef.current = cableToolMode;
  const selectedCableTypeRef = useRef<SimCableType>(selectedCableType);
  selectedCableTypeRef.current = selectedCableType;
  const [liveCableDraw, setLiveCableDraw] = useState<LiveCableDrawState | null>(null);
  const liveCableDrawRef = useRef<LiveCableDrawState | null>(null);
  const [hoveredPortKey, setHoveredPortKey] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [gridStyle, setGridStyle] = useState<GridStyle>('lines');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<SnapGridStep>(20);
  const [showCustomLabels, setShowCustomLabels] = useState<boolean>(true);
  const snapToGridRef = useRef<boolean>(snapToGrid);
  snapToGridRef.current = snapToGrid;
  const gridSizeRef = useRef<SnapGridStep>(gridSize);
  gridSizeRef.current = gridSize;
  const [activeSnapGuides, setActiveSnapGuides] = useState<{
    x?: number;
    y?: number;
    readout?: { x: number; y: number; text: string };
  } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    count: number;
  } | null>(null);
  const dragStateRef = useRef<{
    leadId: string;
    startClientX: number;
    startClientY: number;
    startCanvasX: number;
    startCanvasY: number;
    initialPositions: Array<{ id: string; x: number; y: number }>;
    isLongPressReady: boolean;
    holdTimerId: number | null;
    moved: boolean;
  } | null>(null);
  const marqueeStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startCanvasX: number;
    startCanvasY: number;
    additive: boolean;
    initialSelectedIds: string[];
    moved: boolean;
  } | null>(null);
  const rotateStateRef = useRef<{
    pivotX: number;
    pivotY: number;
    startPointerAngleDeg: number;
    initialRotations: Array<{ id: string; rotation: number }>;
    isGroup: boolean;
    moved: boolean;
  } | null>(null);
  const [activeRotationInfo, setActiveRotationInfo] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const shapeDragStateRef = useRef<{
    shapeId: string;
    startClientX: number;
    startClientY: number;
    startCanvasX: number;
    startCanvasY: number;
    initX: number;
    initY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const shapeResizeStateRef = useRef<{
    shapeId: string;
    handle: ShapeResizeHandle;
    startCanvasX: number;
    startCanvasY: number;
    initX: number;
    initY: number;
    initW: number;
    initH: number;
    moved: boolean;
  } | null>(null);
  const [activeShapeResizeInfo, setActiveShapeResizeInfo] = useState<{
    x: number;
    y: number;
    label: string;
  } | null>(null);
  const labelDragStateRef = useRef<{
    deviceId: string;
    startClientX: number;
    startClientY: number;
    startCanvasX: number;
    startCanvasY: number;
    devX: number;
    devY: number;
    initOffsetX: number;
    initOffsetY: number;
    moved: boolean;
  } | null>(null);
  const [draggingLabelDeviceId, setDraggingLabelDeviceId] = useState<string | null>(null);
  const diagramLabelDragStateRef = useRef<{
    labelId: string;
    startClientX: number;
    startClientY: number;
    startCanvasX: number;
    startCanvasY: number;
    initX: number;
    initY: number;
    moved: boolean;
  } | null>(null);
  const suppressCanvasClickRef = useRef<boolean>(false);

  // Quick Ping Tester & Packet Animation state
  const [pingSourceId, setPingSourceId] = useState<string>(
    initialPresetState.devices.find(d => d.type === 'pc')?.id ||
      initialPresetState.devices[0]?.id ||
      ''
  );
  const [pingTargetIp, setPingTargetIp] = useState<string>('192.168.20.10');
  const [lastPingResult, setLastPingResult] = useState<PingSimulationResult | null>(null);
  const [animStepIndex, setAnimStepIndex] = useState<number | null>(null);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [statusBannerTone, setStatusBannerTone] = useState<'info' | 'error'>('info');
  const [isJsonFileDragOver, setIsJsonFileDragOver] = useState<boolean>(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState<boolean>(false);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<
    'all' | Exclude<LabTemplateCategory, 'Blank'>
  >('all');

  const templateLibraryItems = useMemo<TemplateSummaryItem[]>(() => {
    return NETWORK_LAB_PRESETS.filter(p => p.id !== 'blank-sandbox').map(preset => {
      const built = preset.buildInitialState();
      return {
        preset,
        category:
          preset.category && preset.category !== 'Blank'
            ? preset.category
            : 'LAN & Star',
        devices: built.devices,
        links: built.links,
        summaryCounts: {
          routers: built.devices.filter(d => d.type === 'router').length,
          switches: built.devices.filter(d => d.type === 'switch').length,
          endpoints: built.devices.filter(d => d.type === 'pc' || d.type === 'server').length
        }
      };
    });
  }, []);

  const filteredTemplates = useMemo(() => {
    if (templateCategoryFilter === 'all') return templateLibraryItems;
    return templateLibraryItems.filter(item => item.category === templateCategoryFilter);
  }, [templateCategoryFilter, templateLibraryItems]);

  const importInputRef = useRef<HTMLInputElement>(null);
  const [isImportExportMenuOpen, setIsImportExportMenuOpen] = useState<boolean>(false);
  const importExportMenuRef = useRef<HTMLDivElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isImportExportMenuOpen && !isSettingsOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        isImportExportMenuOpen &&
        importExportMenuRef.current &&
        !importExportMenuRef.current.contains(e.target as Node)
      ) {
        setIsImportExportMenuOpen(false);
      }
      if (
        isSettingsOpen &&
        settingsMenuRef.current &&
        !settingsMenuRef.current.contains(e.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsImportExportMenuOpen(false);
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isImportExportMenuOpen, isSettingsOpen]);

  useEffect(() => {
    if (!isTemplatesModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTemplatesModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTemplatesModalOpen]);

  const firebaseUid = auth.currentUser?.uid || null;
  const ownerScopeId = firebaseUid && !isOffline ? firebaseUid : currentUser.id;
  const isCloudAuthReady = Boolean(auth.currentUser && auth.currentUser.emailVerified && !isOffline);

  // Load IndexedDB active draft + merge saved labs strictly for the current individual student
  useEffect(() => {
    let cancelled = false;
    draftHydratedForUserRef.current = null;
    setSavedLabs([]);
    setRecentlySavedProjectId(null);
    setIsSavePromptOpen(false);

    const hydratePersistence = async () => {
      const [draft, localSaved] = await Promise.all([
        loadActiveLabDraftFromIdb(ownerScopeId),
        listSavedLabsFromIdb(ownerScopeId)
      ]);

      if (cancelled) return;

      let prefShowGrid = true;
      let prefSnapToGrid = true;
      let prefGridSize: SnapGridStep = 20;
      let prefGridStyle: GridStyle = 'lines';
      try {
        const rawPrefs = window.localStorage.getItem(`${SIM_GRID_PREFS_STORAGE_PREFIX}:${ownerScopeId}`);
        if (rawPrefs) {
          const parsedPrefs = JSON.parse(rawPrefs) as LabGridSettings;
          if (typeof parsedPrefs.showGrid === 'boolean') prefShowGrid = parsedPrefs.showGrid;
          if (typeof parsedPrefs.snapToGrid === 'boolean') prefSnapToGrid = parsedPrefs.snapToGrid;
          if (parsedPrefs.gridSize !== undefined) prefGridSize = normalizeGridStep(parsedPrefs.gridSize);
          if (parsedPrefs.gridStyle === 'lines' || parsedPrefs.gridStyle === 'dots') {
            prefGridStyle = parsedPrefs.gridStyle;
          }
        }
      } catch {
        // Ignore storage read failures
      }

      if (draft) {
        const draftShapes = Array.isArray(draft.shapes) ? draft.shapes : [];
        const draftLabels = Array.isArray(draft.labels) ? draft.labels : [];
        const restoredSize = computeRequiredCanvasSize(
          draft.devices,
          draftShapes,
          draftLabels,
          draft.canvasWidth,
          draft.canvasHeight
        );
        const dg = draft.gridSettings;
        setActivePresetId(draft.presetId);
        setCanvasSize(restoredSize);
        setShowCustomLabels(draft.showCustomLabels !== false);
        setShowGrid(typeof dg?.showGrid === 'boolean' ? dg.showGrid : prefShowGrid);
        setSnapToGrid(typeof dg?.snapToGrid === 'boolean' ? dg.snapToGrid : prefSnapToGrid);
        setGridSize(dg?.gridSize !== undefined ? normalizeGridStep(dg.gridSize) : prefGridSize);
        setGridStyle(
          dg?.gridStyle === 'lines' || dg?.gridStyle === 'dots' ? dg.gridStyle : prefGridStyle
        );
        setDevices(draft.devices);
        setLinks(draft.links);
        setShapes(draftShapes);
        setDiagramLabels(draftLabels);
        setActiveSavedLabId(draft.activeSavedLabId || null);
        const firstId = draft.devices[0]?.id || null;
        setSelectedDeviceId(firstId);
        setSelectedDeviceIds(firstId ? [firstId] : []);
        setConsoleTabIds([]);
        setConsoleDeviceId(null);
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        setSelectedDiagramLabelId(null);
        setLastPingResult(null);
        setLastAutoSavedAt(draft.updatedAt);
      } else {
        setActivePresetId('blank-sandbox');
        setCanvasSize({ width: DEFAULT_LAB_CANVAS_WIDTH, height: DEFAULT_LAB_CANVAS_HEIGHT });
        setShowCustomLabels(true);
        setShowGrid(prefShowGrid);
        setSnapToGrid(prefSnapToGrid);
        setGridSize(prefGridSize);
        setGridStyle(prefGridStyle);
        setDevices([]);
        setLinks([]);
        setShapes([]);
        setDiagramLabels([]);
        setActiveSavedLabId(null);
        setSelectedDeviceId(null);
        setSelectedDeviceIds([]);
        setConsoleTabIds([]);
        setConsoleDeviceId(null);
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        setSelectedDiagramLabelId(null);
        setLastPingResult(null);
        setLastAutoSavedAt(null);
      }

      let mergedSaved = localSaved.filter(item => item.userId === ownerScopeId);

      if (auth.currentUser && auth.currentUser.emailVerified && !isOffline) {
        try {
          const cloudLabs = await fetchLabTopologiesFromFirestore();
          if (!cancelled && cloudLabs) {
            const currentUid = auth.currentUser.uid;
            const mergedMap = new Map<string, SavedLabRecord>();
            mergedSaved.forEach(item => mergedMap.set(item.id, item));
            for (const cloudItem of cloudLabs) {
              if (cloudItem.userId !== currentUid) continue;
              const existingLocal = mergedMap.get(cloudItem.id);
              const cloudTime = new Date(cloudItem.updatedAt).getTime();
              const localTime = existingLocal ? new Date(existingLocal.updatedAt).getTime() : 0;
              if (!existingLocal || cloudTime >= localTime) {
                const scopedCloudItem: SavedLabRecord = {
                  ...cloudItem,
                  userId: ownerScopeId,
                  shapes:
                    Array.isArray(cloudItem.shapes) && cloudItem.shapes.length > 0
                      ? cloudItem.shapes
                      : existingLocal?.shapes,
                  labels:
                    Array.isArray(cloudItem.labels) && cloudItem.labels.length > 0
                      ? cloudItem.labels
                      : existingLocal?.labels
                };
                mergedMap.set(cloudItem.id, scopedCloudItem);
                await putSavedLabToIdb(scopedCloudItem);
              }
            }
            mergedSaved = Array.from(mergedMap.values())
              .filter(item => item.userId === ownerScopeId)
              .sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
          }
        } catch {
          // Remote Firestore read failed (e.g. rules not yet deployed); continue cleanly with IndexedDB
        }
      }

      if (!cancelled) {
        setSavedLabs(mergedSaved);
        draftHydratedForUserRef.current = ownerScopeId;
      }
    };

    hydratePersistence();

    return () => {
      cancelled = true;
    };
  }, [ownerScopeId, isOffline]);

  // Persist user's grid & snap preferences in localStorage
  useEffect(() => {
    if (draftHydratedForUserRef.current !== ownerScopeId) return;
    try {
      window.localStorage.setItem(
        `${SIM_GRID_PREFS_STORAGE_PREFIX}:${ownerScopeId}`,
        JSON.stringify({ showGrid, snapToGrid, gridSize, gridStyle })
      );
    } catch {
      // Ignore storage quota issues
    }
  }, [gridSize, gridStyle, ownerScopeId, showGrid, snapToGrid]);

  // Debounced auto-save active workspace draft into IndexedDB
  useEffect(() => {
    if (draftHydratedForUserRef.current !== ownerScopeId) return;
    if (workspaceView !== 'editor') return;

    const hasWorkspaceContent =
      devices.length > 0 ||
      links.length > 0 ||
      shapes.length > 0 ||
      diagramLabels.length > 0 ||
      activeSavedLabId !== null ||
      activePresetId !== 'blank-sandbox' ||
      canvasSize.width > DEFAULT_LAB_CANVAS_WIDTH ||
      canvasSize.height > DEFAULT_LAB_CANVAS_HEIGHT;

    if (!hasWorkspaceContent) return;

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const nowIso = new Date().toISOString();
      saveActiveLabDraftToIdb({
        draftKey: ownerScopeId,
        userId: ownerScopeId,
        activeSavedLabId: activeSavedLabId || undefined,
        presetId: activePresetId,
        canvasWidth: canvasSize.width,
        canvasHeight: canvasSize.height,
        showCustomLabels,
        gridSettings: { showGrid, snapToGrid, gridSize, gridStyle },
        devices,
        links,
        shapes,
        labels: diagramLabels,
        updatedAt: nowIso
      }).then(() => {
        setLastAutoSavedAt(nowIso);
      });
    }, 250);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    activePresetId,
    activeSavedLabId,
    canvasSize,
    diagramLabels,
    devices,
    gridSize,
    gridStyle,
    links,
    ownerScopeId,
    shapes,
    showCustomLabels,
    showGrid,
    snapToGrid,
    workspaceView
  ]);

  // Keep pingSourceId valid
  useEffect(() => {
    if (devices.length === 0) {
      setPingSourceId('');
      return;
    }
    if (!devices.some(d => d.id === pingSourceId)) {
      const preferred = devices.find(d => d.type === 'pc' || d.type === 'server') || devices[0];
      setPingSourceId(preferred.id);
    }
  }, [devices, pingSourceId]);

  const activePreset = useMemo(
    () => NETWORK_LAB_PRESETS.find(p => p.id === activePresetId) || NETWORK_LAB_PRESETS[0],
    [activePresetId]
  );

  const objectiveProgress = useMemo(() => {
    const results = activePreset.objectives.map(obj => ({
      id: obj.id,
      label: obj.label,
      passed: obj.check(devices, links)
    }));
    const passedCount = results.filter(r => r.passed).length;
    return {
      results,
      passedCount,
      totalCount: results.length
    };
  }, [activePreset, devices, links]);

  const selectedDevice = useMemo(
    () => devices.find(d => d.id === selectedDeviceId) || null,
    [devices, selectedDeviceId]
  );

  const customLabelCount = useMemo(
    () => devices.filter(d => Boolean(d.customLabel?.trim())).length,
    [devices]
  );

  const offGridDeviceCount = useMemo(
    () => devices.filter(d => d.x % gridSize !== 0 || d.y % gridSize !== 0).length,
    [devices, gridSize]
  );

  const consoleDevice = useMemo(
    () => devices.find(d => d.id === consoleDeviceId) || null,
    [devices, consoleDeviceId]
  );

  const selectedLink = useMemo(
    () => links.find(l => l.id === selectedLinkId) || null,
    [links, selectedLinkId]
  );

  const selectedShape = useMemo(
    () => shapes.find(s => s.id === selectedShapeId) || null,
    [shapes, selectedShapeId]
  );

  const selectedDiagramLabel = useMemo(
    () => diagramLabels.find(l => l.id === selectedDiagramLabelId) || null,
    [diagramLabels, selectedDiagramLabelId]
  );

  const linkStatuses = useMemo(() => {
    const map = new Map<string, ReturnType<typeof evaluateLinkStatus>>();
    links.forEach(l => {
      map.set(l.id, evaluateLinkStatus(l, devices));
    });
    return map;
  }, [devices, links]);

  // Scroll terminal to bottom on new output or tab switch
  useEffect(() => {
    if (isConsoleMinimized || !consoleDevice) return;
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleDevice?.id, consoleDevice?.cliHistory.length, isConsoleMinimized]);

  // Packet animation playback across hops
  useEffect(() => {
    if (!lastPingResult || lastPingResult.hops.length === 0) {
      setAnimStepIndex(null);
      return;
    }
    setAnimStepIndex(0);
    let idx = 0;
    const timer = window.setInterval(() => {
      idx += 1;
      if (idx >= lastPingResult.hops.length) {
        window.clearInterval(timer);
        window.setTimeout(() => setAnimStepIndex(null), 900);
      } else {
        setAnimStepIndex(idx);
      }
    }, 450);

    return () => window.clearInterval(timer);
  }, [lastPingResult]);

  // Native non-passive mouse-wheel zoom anchored at cursor position
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || workspaceView !== 'editor') return;

    const handleWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement | null)?.closest('[data-console-overlay="true"]')) {
        return;
      }
      e.preventDefault();
      const measureEl = stageBoxRef.current || viewport;
      const vRect = measureEl.getBoundingClientRect();
      if (vRect.width <= 0 || vRect.height <= 0) return;

      const rawDeltaY =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
          ? e.deltaY * 240
          : e.deltaY;
      if (rawDeltaY === 0) return;

      const clampedDelta = Math.max(-180, Math.min(180, rawDeltaY));
      const curZoom = zoomRef.current;
      const curPan = panRef.current;
      const sensitivity = e.ctrlKey ? 0.008 : 0.0016;
      const nextZoom = Math.min(
        2.75,
        Math.max(0.2, Number((curZoom * Math.exp(-clampedDelta * sensitivity)).toFixed(4)))
      );
      if (nextZoom === curZoom) return;

      const isOverMiniMap = Boolean(
        (e.target as HTMLElement | null)?.closest('[data-minimap-hud="true"]')
      );
      const mouseX = isOverMiniMap ? vRect.width / 2 : e.clientX - vRect.left;
      const mouseY = isOverMiniMap ? vRect.height / 2 : e.clientY - vRect.top;
      const stageX = (mouseX - curPan.x) / curZoom;
      const stageY = (mouseY - curPan.y) / curZoom;
      const nextPan = {
        x: mouseX - stageX * nextZoom,
        y: mouseY - stageY * nextZoom
      };

      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, [workspaceView]);

  // Keep viewport/stage box measurements fresh so the mini-map viewport rectangle stays exact
  useEffect(() => {
    if (workspaceView !== 'editor') return;
    const vpEl = viewportRef.current;
    const stageEl = stageBoxRef.current;
    if (!vpEl || !stageEl) return;

    const measure = () => {
      const vpRect = vpEl.getBoundingClientRect();
      const stageRect = stageEl.getBoundingClientRect();
      if (
        vpRect.width <= 0 ||
        vpRect.height <= 0 ||
        stageRect.width <= 0 ||
        stageRect.height <= 0
      ) {
        return;
      }
      const next = {
        vpWidth: vpRect.width,
        vpHeight: vpRect.height,
        stageWidth: stageRect.width,
        stageHeight: stageRect.height,
        stageOffsetX: stageRect.left - vpRect.left,
        stageOffsetY: stageRect.top - vpRect.top
      };
      setViewportMetrics(prev =>
        Math.abs(prev.vpWidth - next.vpWidth) < 0.5 &&
        Math.abs(prev.vpHeight - next.vpHeight) < 0.5 &&
        Math.abs(prev.stageWidth - next.stageWidth) < 0.5 &&
        Math.abs(prev.stageHeight - next.stageHeight) < 0.5 &&
        Math.abs(prev.stageOffsetX - next.stageOffsetX) < 0.5 &&
        Math.abs(prev.stageOffsetY - next.stageOffsetY) < 0.5
          ? prev
          : next
      );
    };

    measure();
    const rafId = window.requestAnimationFrame(measure);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(vpEl);
    observer?.observe(stageEl);
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [workspaceView, isWorkspaceFullscreen, canvasSize.width, canvasSize.height, isMiniMapOpen]);

  const miniMapViewportBox = useMemo(() => {
    const baseScaleX = viewportMetrics.stageWidth / DEFAULT_LAB_CANVAS_WIDTH;
    const baseScaleY = viewportMetrics.stageHeight / DEFAULT_LAB_CANVAS_HEIGHT;
    const effScaleX = Math.max(0.0001, baseScaleX * zoom);
    const effScaleY = Math.max(0.0001, baseScaleY * zoom);

    return {
      x: -(viewportMetrics.stageOffsetX + pan.x) / effScaleX,
      y: -(viewportMetrics.stageOffsetY + pan.y) / effScaleY,
      width: viewportMetrics.vpWidth / effScaleX,
      height: viewportMetrics.vpHeight / effScaleY
    };
  }, [pan.x, pan.y, viewportMetrics, zoom]);

  const panViewportToCanvasCenter = useCallback((targetX: number, targetY: number) => {
    const vpEl = viewportRef.current;
    const stageEl = stageBoxRef.current;
    if (!vpEl || !stageEl) return;
    const vpRect = vpEl.getBoundingClientRect();
    const stageRect = stageEl.getBoundingClientRect();
    if (
      vpRect.width <= 0 ||
      vpRect.height <= 0 ||
      stageRect.width <= 0 ||
      stageRect.height <= 0
    ) {
      return;
    }

    const { width: canvasW, height: canvasH } = canvasSizeRef.current;
    const curZoom = zoomRef.current;
    const clampedX = Math.max(0, Math.min(canvasW, targetX));
    const clampedY = Math.max(0, Math.min(canvasH, targetY));

    const baseScaleX = stageRect.width / DEFAULT_LAB_CANVAS_WIDTH;
    const baseScaleY = stageRect.height / DEFAULT_LAB_CANVAS_HEIGHT;
    const vpCenterInStageX = vpRect.left + vpRect.width / 2 - stageRect.left;
    const vpCenterInStageY = vpRect.top + vpRect.height / 2 - stageRect.top;

    const nextPan = {
      x: vpCenterInStageX - clampedX * baseScaleX * curZoom,
      y: vpCenterInStageY - clampedY * baseScaleY * curZoom
    };

    panRef.current = nextPan;
    setPan(nextPan);
  }, []);

  const handleMiniMapPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>, svgRect: DOMRect) => {
      if (e.button !== 0 || svgRect.width <= 0 || svgRect.height <= 0) return;
      const { width: canvasW, height: canvasH } = canvasSizeRef.current;
      const clickX = Math.max(
        0,
        Math.min(canvasW, ((e.clientX - svgRect.left) / svgRect.width) * canvasW)
      );
      const clickY = Math.max(
        0,
        Math.min(canvasH, ((e.clientY - svgRect.top) / svgRect.height) * canvasH)
      );

      const curVp = miniMapViewportBox;
      const insideVpBox =
        clickX >= curVp.x &&
        clickX <= curVp.x + curVp.width &&
        clickY >= curVp.y &&
        clickY <= curVp.y + curVp.height;

      const vpCenterX = curVp.x + curVp.width / 2;
      const vpCenterY = curVp.y + curVp.height / 2;

      miniMapDragRef.current = {
        svgRect,
        grabOffsetX: insideVpBox ? clickX - vpCenterX : 0,
        grabOffsetY: insideVpBox ? clickY - vpCenterY : 0
      };
      setIsMiniMapDragging(true);

      if (!insideVpBox) {
        panViewportToCanvasCenter(clickX, clickY);
      }
    },
    [miniMapViewportBox, panViewportToCanvasCenter]
  );

  // Pointer drag, viewport pan, & marquee selection box handling for topology canvas nodes
  useEffect(() => {
    const clientToCanvas = (clientX: number, clientY: number, rect: DOMRect) => {
      const { width: canvasW, height: canvasH } = canvasSizeRef.current;
      return {
        x: Math.min(canvasW, Math.max(0, ((clientX - rect.left) / rect.width) * canvasW)),
        y: Math.min(canvasH, Math.max(0, ((clientY - rect.top) / rect.height) * canvasH))
      };
    };

    const clampConsoleOffset = (offset: { x: number; y: number }) => {
      const viewportEl = viewportRef.current;
      const dialogEl = consoleDialogRef.current;
      const vpW = viewportEl?.clientWidth ?? 1000;
      const vpH = viewportEl?.clientHeight ?? 580;
      const dlgW = dialogEl?.offsetWidth ?? (isWorkspaceFullscreen ? 620 : 720);
      const dlgH = dialogEl?.offsetHeight ?? (isWorkspaceFullscreen ? 410 : 440);
      const maxDx = Math.max(16, Math.floor((vpW - dlgW) / 2) - 8);
      const maxDy = Math.max(16, Math.floor((vpH - dlgH) / 2) - 8);
      return {
        x: Math.max(-maxDx, Math.min(maxDx, Math.round(offset.x))),
        y: Math.max(-maxDy, Math.min(maxDy, Math.round(offset.y)))
      };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const cResize = consoleResizeRef.current;
      if (cResize) {
        const viewportEl = viewportRef.current;
        const maxW = viewportEl ? Math.max(400, viewportEl.clientWidth - 24) : 1100;
        const maxH = viewportEl ? Math.max(280, viewportEl.clientHeight - 24) : 760;
        const nextWidth = Math.max(
          380,
          Math.min(maxW, Math.round(cResize.initWidth + (e.clientX - cResize.startClientX)))
        );
        const nextHeight = Math.max(
          270,
          Math.min(maxH, Math.round(cResize.initHeight + (e.clientY - cResize.startClientY)))
        );
        setConsoleSize({ width: nextWidth, height: nextHeight });
        const dw = nextWidth - cResize.initWidth;
        const dh = nextHeight - cResize.initHeight;
        const vpW = viewportEl?.clientWidth ?? 1000;
        const vpH = viewportEl?.clientHeight ?? 580;
        const maxDx = Math.max(16, Math.floor((vpW - nextWidth) / 2) - 8);
        const maxDy = Math.max(16, Math.floor((vpH - nextHeight) / 2) - 8);
        setConsoleOffset({
          x: Math.max(-maxDx, Math.min(maxDx, Math.round(cResize.initOffsetX + dw / 2))),
          y: Math.max(-maxDy, Math.min(maxDy, Math.round(cResize.initOffsetY + dh / 2)))
        });
        return;
      }

      const cDrag = consoleDragRef.current;
      if (cDrag) {
        const dx = e.clientX - cDrag.startClientX;
        const dy = e.clientY - cDrag.startClientY;
        setConsoleOffset(clampConsoleOffset({ x: cDrag.initX + dx, y: cDrag.initY + dy }));
        return;
      }

      const mmDrag = miniMapDragRef.current;
      if (mmDrag) {
        const svgEl = miniMapSvgRef.current;
        const rect = svgEl ? svgEl.getBoundingClientRect() : mmDrag.svgRect;
        if (rect.width > 0 && rect.height > 0) {
          const { width: canvasW, height: canvasH } = canvasSizeRef.current;
          const currX = ((e.clientX - rect.left) / rect.width) * canvasW;
          const currY = ((e.clientY - rect.top) / rect.height) * canvasH;
          panViewportToCanvasCenter(currX - mmDrag.grabOffsetX, currY - mmDrag.grabOffsetY);
        }
        return;
      }

      const pDrag = panStateRef.current;
      if (pDrag) {
        const dx = e.clientX - pDrag.startClientX;
        const dy = e.clientY - pDrag.startClientY;
        if (Math.hypot(dx, dy) > 2) {
          pDrag.moved = true;
        }
        const nextPan = {
          x: pDrag.initPanX + dx,
          y: pDrag.initPanY + dy
        };
        panRef.current = nextPan;
        setPan(nextPan);
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const activeCableDraw = liveCableDrawRef.current;
      if (activeCableDraw) {
        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const distFromStart = Math.hypot(
          e.clientX - activeCableDraw.startClientX,
          e.clientY - activeCableDraw.startClientY
        );
        const nextIsDrag = activeCableDraw.isDragGesture || distFromStart > 8;
        const nextState = updateLiveCableDrawForCursor(
          activeCableDraw,
          curr.x,
          curr.y,
          nextIsDrag
        );
        liveCableDrawRef.current = nextState;
        setLiveCableDraw(nextState);
        return;
      }

      const { width: canvasW, height: canvasH } = canvasSizeRef.current;
      const snapActive = snapToGridRef.current && !e.altKey;
      const step = gridSizeRef.current;

      const diagramLabelDrag = diagramLabelDragStateRef.current;
      if (diagramLabelDrag) {
        const dist = Math.hypot(
          e.clientX - diagramLabelDrag.startClientX,
          e.clientY - diagramLabelDrag.startClientY
        );
        if (dist > 3) {
          diagramLabelDrag.moved = true;
        }
        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const nextX = snapClampedToGrid(
          diagramLabelDrag.initX + (curr.x - diagramLabelDrag.startCanvasX),
          25,
          canvasW - 25,
          step,
          snapActive
        );
        const nextY = snapClampedToGrid(
          diagramLabelDrag.initY + (curr.y - diagramLabelDrag.startCanvasY),
          18,
          canvasH - 18,
          step,
          snapActive
        );
        setDiagramLabels(prev =>
          prev.map(l =>
            l.id === diagramLabelDrag.labelId ? { ...l, x: nextX, y: nextY } : l
          )
        );
        setActiveSnapGuides({
          readout: { x: nextX, y: nextY - 14, text: `${nextX}, ${nextY}` }
        });
        return;
      }

      const labelDrag = labelDragStateRef.current;
      if (labelDrag) {
        const dist = Math.hypot(e.clientX - labelDrag.startClientX, e.clientY - labelDrag.startClientY);
        if (dist > 3) {
          labelDrag.moved = true;
        }
        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const rawDx = curr.x - labelDrag.startCanvasX;
        const rawDy = curr.y - labelDrag.startCanvasY;
        const minOx = Math.max(-220, 42 - labelDrag.devX);
        const maxOx = Math.min(220, canvasW - 42 - labelDrag.devX);
        const minOy = Math.max(-180, 14 - (labelDrag.devY + 34));
        const maxOy = Math.min(180, canvasH - 22 - (labelDrag.devY + 34));
        const nextOx = Math.round(Math.min(maxOx, Math.max(minOx, labelDrag.initOffsetX + rawDx)));
        const nextOy = Math.round(Math.min(maxOy, Math.max(minOy, labelDrag.initOffsetY + rawDy)));
        setDevices(prev =>
          prev.map(d =>
            d.id === labelDrag.deviceId
              ? { ...d, labelOffsetX: nextOx, labelOffsetY: nextOy }
              : d
          )
        );
        return;
      }

      const drag = dragStateRef.current;
      if (drag) {
        const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
        if (!drag.isLongPressReady) {
          if (dist > 12) {
            if (drag.holdTimerId != null) {
              window.clearTimeout(drag.holdTimerId);
            }
            dragStateRef.current = null;
          }
          return;
        }
        if (dist > 2) {
          drag.moved = true;
        }

        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const rawDx = curr.x - drag.startCanvasX;
        const rawDy = curr.y - drag.startCanvasY;

        let minInitX = Infinity;
        let maxInitX = -Infinity;
        let minInitY = Infinity;
        let maxInitY = -Infinity;
        drag.initialPositions.forEach(p => {
          if (p.x < minInitX) minInitX = p.x;
          if (p.x > maxInitX) maxInitX = p.x;
          if (p.y < minInitY) minInitY = p.y;
          if (p.y > maxInitY) maxInitY = p.y;
        });

        const minDx = 60 - minInitX;
        const maxDx = canvasW - 60 - maxInitX;
        const minDy = 60 - minInitY;
        const maxDy = canvasH - 60 - maxInitY;

        const leadInit =
          drag.initialPositions.find(p => p.id === drag.leadId) || drag.initialPositions[0];

        let dx: number;
        let dy: number;
        if (snapActive && leadInit) {
          const snappedLeadX = snapClampedToGrid(
            leadInit.x + rawDx,
            leadInit.x + minDx,
            leadInit.x + maxDx,
            step,
            true
          );
          const snappedLeadY = snapClampedToGrid(
            leadInit.y + rawDy,
            leadInit.y + minDy,
            leadInit.y + maxDy,
            step,
            true
          );
          dx = snappedLeadX - leadInit.x;
          dy = snappedLeadY - leadInit.y;
        } else {
          dx = Math.round(Math.min(maxDx, Math.max(minDx, rawDx)));
          dy = Math.round(Math.min(maxDy, Math.max(minDy, rawDy)));
        }

        const nextPosMap = new Map(
          drag.initialPositions.map(p => [p.id, { x: p.x + dx, y: p.y + dy }])
        );

        setDevices(prev =>
          prev.map(d => {
            const nextPos = nextPosMap.get(d.id);
            return nextPos ? { ...d, x: nextPos.x, y: nextPos.y } : d;
          })
        );

        if (leadInit) {
          const leadX = leadInit.x + dx;
          const leadY = leadInit.y + dy;
          const draggedIds = new Set(drag.initialPositions.map(p => p.id));
          const otherDevices = devicesRef.current.filter(d => !draggedIds.has(d.id));
          const alignTol = snapActive ? 0 : 2;
          const matchedX = otherDevices.find(d => Math.abs(d.x - leadX) <= alignTol)?.x;
          const matchedY = otherDevices.find(d => Math.abs(d.y - leadY) <= alignTol)?.y;
          setActiveSnapGuides({
            x: matchedX,
            y: matchedY,
            readout: { x: leadX, y: leadY - 34, text: `${leadX}, ${leadY}` }
          });
        }
        return;
      }

      const rot = rotateStateRef.current;
      if (rot) {
        rot.moved = true;
        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const currAngleDeg =
          Math.atan2(curr.y - rot.pivotY, curr.x - rot.pivotX) * (180 / Math.PI);

        let deltaDeg = currAngleDeg - rot.startPointerAngleDeg;
        while (deltaDeg > 180) deltaDeg -= 360;
        while (deltaDeg < -180) deltaDeg += 360;

        const normalizeDeg = (deg: number) => ((Math.round(deg) % 360) + 360) % 360;
        const snapCardinal = (deg: number) => {
          const n = normalizeDeg(deg);
          for (const cardinal of [0, 90, 180, 270, 360]) {
            if (Math.abs(n - cardinal) <= 2) {
              return cardinal === 360 ? 0 : cardinal;
            }
          }
          return n;
        };

        const nextRotMap = new Map<string, number>();
        let singleDisplayDeg = 0;

        rot.initialRotations.forEach((item, idx) => {
          let nextVal: number;
          if (e.shiftKey) {
            nextVal = normalizeDeg(Math.round((item.rotation + deltaDeg) / 15) * 15);
          } else {
            nextVal = snapCardinal(item.rotation + deltaDeg);
          }
          nextRotMap.set(item.id, nextVal);
          if (idx === 0) singleDisplayDeg = nextVal;
        });

        setDevices(prev =>
          prev.map(d => {
            const nextRot = nextRotMap.get(d.id);
            return nextRot !== undefined ? { ...d, rotation: nextRot } : d;
          })
        );

        const deltaRounded = Math.round(e.shiftKey ? Math.round(deltaDeg / 15) * 15 : deltaDeg);
        setActiveRotationInfo({
          x: rot.pivotX,
          y: rot.pivotY,
          label: rot.isGroup
            ? `${deltaRounded >= 0 ? '+' : ''}${deltaRounded}°`
            : `${singleDisplayDeg}°`
        });
        return;
      }

      const shapeResize = shapeResizeStateRef.current;
      if (shapeResize) {
        shapeResize.moved = true;
        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const dx = curr.x - shapeResize.startCanvasX;
        const dy = curr.y - shapeResize.startCanvasY;
        const minW = 64;
        const minH = 48;

        const initLeft = shapeResize.initX;
        const initTop = shapeResize.initY;
        const initRight = shapeResize.initX + shapeResize.initW;
        const initBottom = shapeResize.initY + shapeResize.initH;

        let left = initLeft;
        let top = initTop;
        let right = initRight;
        let bottom = initBottom;

        if (shapeResize.handle.includes('w')) {
          left = snapClampedToGrid(initLeft + dx, 4, initRight - minW, step, snapActive);
        }
        if (shapeResize.handle.includes('e')) {
          right = snapClampedToGrid(initRight + dx, initLeft + minW, canvasW - 4, step, snapActive);
        }
        if (shapeResize.handle.includes('n')) {
          top = snapClampedToGrid(initTop + dy, 4, initBottom - minH, step, snapActive);
        }
        if (shapeResize.handle.includes('s')) {
          bottom = snapClampedToGrid(initBottom + dy, initTop + minH, canvasH - 4, step, snapActive);
        }

        if (
          e.shiftKey &&
          (shapeResize.handle === 'nw' ||
            shapeResize.handle === 'ne' ||
            shapeResize.handle === 'se' ||
            shapeResize.handle === 'sw')
        ) {
          const ratio = shapeResize.initW / Math.max(1, shapeResize.initH);
          const nextW = right - left;
          const nextH = bottom - top;
          if (nextW / Math.max(1, nextH) > ratio) {
            const adjH = Math.max(minH, nextW / ratio);
            if (shapeResize.handle.includes('n')) {
              top = Math.max(4, bottom - adjH);
            } else {
              bottom = Math.min(canvasH - 4, top + adjH);
            }
          } else {
            const adjW = Math.max(minW, nextH * ratio);
            if (shapeResize.handle.includes('w')) {
              left = Math.max(4, right - adjW);
            } else {
              right = Math.min(canvasW - 4, left + adjW);
            }
          }
        }

        const nextX = Math.round(left);
        const nextY = Math.round(top);
        const nextW = Math.round(right - left);
        const nextH = Math.round(bottom - top);

        setShapes(prev =>
          prev.map(s =>
            s.id === shapeResize.shapeId
              ? { ...s, x: nextX, y: nextY, width: nextW, height: nextH }
              : s
          )
        );
        setActiveShapeResizeInfo({
          x: nextX + nextW / 2,
          y: nextY,
          label: `${nextW} × ${nextH}`
        });
        return;
      }

      const shapeDrag = shapeDragStateRef.current;
      if (shapeDrag) {
        const dist = Math.hypot(
          e.clientX - shapeDrag.startClientX,
          e.clientY - shapeDrag.startClientY
        );
        if (dist > 3) {
          shapeDrag.moved = true;
        }
        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const rawDx = curr.x - shapeDrag.startCanvasX;
        const rawDy = curr.y - shapeDrag.startCanvasY;
        const nextX = snapClampedToGrid(
          shapeDrag.initX + rawDx,
          4,
          canvasW - 4 - shapeDrag.width,
          step,
          snapActive
        );
        const nextY = snapClampedToGrid(
          shapeDrag.initY + rawDy,
          4,
          canvasH - 4 - shapeDrag.height,
          step,
          snapActive
        );
        setShapes(prev =>
          prev.map(s => (s.id === shapeDrag.shapeId ? { ...s, x: nextX, y: nextY } : s))
        );

        const otherShapes = shapesRef.current.filter(s => s.id !== shapeDrag.shapeId);
        const tol = snapActive ? 0 : 2;
        const matchedX = otherShapes.find(s => Math.abs(s.x - nextX) <= tol)?.x;
        const matchedY = otherShapes.find(s => Math.abs(s.y - nextY) <= tol)?.y;
        setActiveSnapGuides({
          x: matchedX,
          y: matchedY,
          readout: {
            x: nextX + shapeDrag.width / 2,
            y: nextY,
            text: `${nextX}, ${nextY}`
          }
        });
        return;
      }

      const marquee = marqueeStateRef.current;
      if (marquee) {
        const dist = Math.hypot(e.clientX - marquee.startClientX, e.clientY - marquee.startClientY);
        if (dist > 4) {
          marquee.moved = true;
        }
        if (!marquee.moved) return;

        const curr = clientToCanvas(e.clientX, e.clientY, rect);
        const minX = Math.min(marquee.startCanvasX, curr.x);
        const maxX = Math.max(marquee.startCanvasX, curr.x);
        const minY = Math.min(marquee.startCanvasY, curr.y);
        const maxY = Math.max(marquee.startCanvasY, curr.y);

        const boxedIds = devicesRef.current
          .filter(
            d =>
              d.x + 24 >= minX &&
              d.x - 24 <= maxX &&
              d.y + 24 >= minY &&
              d.y - 24 <= maxY
          )
          .map(d => d.id);

        const nextIds = marquee.additive
          ? Array.from(new Set([...marquee.initialSelectedIds, ...boxedIds]))
          : boxedIds;

        setSelectionBox({
          startX: marquee.startCanvasX,
          startY: marquee.startCanvasY,
          currentX: curr.x,
          currentY: curr.y,
          count: nextIds.length
        });

        setSelectedDeviceIds(nextIds);
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        setSelectedDiagramLabelId(null);
        setSelectedDeviceId(prev =>
          prev && nextIds.includes(prev) ? prev : nextIds[0] || null
        );
      }
    };

    const handlePointerUp = () => {
      const activeCableDraw = liveCableDrawRef.current;
      if (activeCableDraw && activeCableDraw.isDragGesture) {
        if (activeCableDraw.snapTarget) {
          finalizeMagneticCableLink(
            activeCableDraw.fromDeviceId,
            activeCableDraw.fromPort,
            activeCableDraw.snapTarget
          );
        } else {
          if (activeCableDraw.blockedTarget) {
            flashBanner(
              `${activeCableDraw.blockedTarget.deviceName}: ${activeCableDraw.blockedTarget.reason}`
            );
          }
          clearLiveCableDraw();
        }
        suppressCanvasClickRef.current = true;
        window.setTimeout(() => {
          suppressCanvasClickRef.current = false;
        }, 0);
      }

      if (dragStateRef.current?.holdTimerId != null) {
        window.clearTimeout(dragStateRef.current.holdTimerId);
      }
      if (dragStateRef.current?.moved) {
        suppressDeviceClickAfterDragRef.current = true;
        window.setTimeout(() => {
          suppressDeviceClickAfterDragRef.current = false;
        }, 0);
      }
      if (
        dragStateRef.current?.moved ||
        panStateRef.current?.moved ||
        marqueeStateRef.current?.moved ||
        rotateStateRef.current?.moved ||
        shapeDragStateRef.current?.moved ||
        shapeResizeStateRef.current?.moved ||
        labelDragStateRef.current?.moved ||
        diagramLabelDragStateRef.current?.moved
      ) {
        suppressCanvasClickRef.current = true;
        window.setTimeout(() => {
          suppressCanvasClickRef.current = false;
        }, 0);
      }
      consoleDragRef.current = null;
      consoleResizeRef.current = null;
      miniMapDragRef.current = null;
      panStateRef.current = null;
      dragStateRef.current = null;
      marqueeStateRef.current = null;
      rotateStateRef.current = null;
      shapeDragStateRef.current = null;
      shapeResizeStateRef.current = null;
      labelDragStateRef.current = null;
      diagramLabelDragStateRef.current = null;
      setIsDraggingConsole(false);
      setIsMiniMapDragging(false);
      setIsPanningActive(false);
      setLongPressMoveDeviceId(null);
      setDraggingLabelDeviceId(null);
      setSelectionBox(null);
      setActiveRotationInfo(null);
      setActiveShapeResizeInfo(null);
      setActiveSnapGuides(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const startGroupDrag = useCallback(
    (e: React.PointerEvent, preferredLeadId?: string) => {
      if (
        (tool !== 'select' && tool !== 'marquee') ||
        e.button !== 0 ||
        selectedDeviceIds.length === 0
      ) {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const { width: canvasW, height: canvasH } = canvasSizeRef.current;
      const startCanvasX = Math.min(
        canvasW,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasW)
      );
      const startCanvasY = Math.min(
        canvasH,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasH)
      );

      const activeSet = new Set(selectedDeviceIds);
      const initialPositions = devicesRef.current
        .filter(d => activeSet.has(d.id))
        .map(d => ({ id: d.id, x: d.x, y: d.y }));
      if (initialPositions.length === 0) return;

      const lead =
        (preferredLeadId
          ? initialPositions.find(p => p.id === preferredLeadId)
          : undefined) || initialPositions[0];

      if (dragStateRef.current?.holdTimerId != null) {
        window.clearTimeout(dragStateRef.current.holdTimerId);
      }

      dragStateRef.current = {
        leadId: lead.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startCanvasX,
        startCanvasY,
        initialPositions,
        isLongPressReady: true,
        holdTimerId: null,
        moved: false
      };
      setLongPressMoveDeviceId(lead.id);
      setSelectedLinkId(null);
      setSelectedShapeId(null);
      setSelectedDiagramLabelId(null);
      setActiveSnapGuides({
        readout: { x: lead.x, y: lead.y - 34, text: `${lead.x}, ${lead.y}` }
      });
    },
    [selectedDeviceIds, tool]
  );

  const startRotationDrag = useCallback(
    (
      e: React.PointerEvent,
      targetIds: string[],
      pivotX: number,
      pivotY: number
    ) => {
      if ((tool !== 'select' && tool !== 'marquee') || e.button !== 0 || targetIds.length === 0) return;
      e.stopPropagation();
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const { width: canvasW, height: canvasH } = canvasSizeRef.current;
      const startCanvasX = Math.min(
        canvasW,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasW)
      );
      const startCanvasY = Math.min(
        canvasH,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasH)
      );
      const startPointerAngleDeg =
        Math.atan2(startCanvasY - pivotY, startCanvasX - pivotX) * (180 / Math.PI);

      const targetSet = new Set(targetIds);
      const initialRotations = devicesRef.current
        .filter(d => targetSet.has(d.id))
        .map(d => ({
          id: d.id,
          rotation: typeof d.rotation === 'number' && Number.isFinite(d.rotation) ? d.rotation : 0
        }));

      if (initialRotations.length === 0) return;

      rotateStateRef.current = {
        pivotX,
        pivotY,
        startPointerAngleDeg,
        initialRotations,
        isGroup: initialRotations.length > 1,
        moved: false
      };

      setActiveRotationInfo({
        x: pivotX,
        y: pivotY,
        label: initialRotations.length > 1 ? '0°' : `${initialRotations[0].rotation}°`
      });
    },
    [tool]
  );

  const handleResetRotation = useCallback((targetIds: string[]) => {
    if (targetIds.length === 0) return;
    const targetSet = new Set(targetIds);
    setDevices(prev =>
      prev.map(d => (targetSet.has(d.id) ? { ...d, rotation: 0 } : d))
    );
    flashBanner(
      `Reset orientation to 0° for ${targetIds.length} device${targetIds.length === 1 ? '' : 's'}`
    );
  }, []);

  const flashBanner = (msg: string, tone: 'info' | 'error' = 'info') => {
    setStatusBannerTone(tone);
    setStatusBanner(msg);
    window.setTimeout(() => {
      setStatusBanner(prev => (prev === msg ? null : prev));
    }, tone === 'error' ? 5600 : 3800);
  };

  const zoomAtViewportCenter = useCallback((targetZoom: number) => {
    const nextZoom = Math.min(2.75, Math.max(0.2, Number(targetZoom.toFixed(4))));
    const curZoom = zoomRef.current;
    const curPan = panRef.current;
    const viewport = stageBoxRef.current || viewportRef.current;
    if (!viewport) {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      return;
    }
    const vRect = viewport.getBoundingClientRect();
    const cx = vRect.width > 0 ? vRect.width / 2 : 500;
    const cy = vRect.height > 0 ? vRect.height / 2 : 290;
    const stageX = (cx - curPan.x) / curZoom;
    const stageY = (cy - curPan.y) / curZoom;
    const nextPan = {
      x: cx - stageX * nextZoom,
      y: cy - stageY * nextZoom
    };
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoom(nextZoom);
    setPan(nextPan);
  }, []);

  const handleResetZoomPan = useCallback(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const fitSheetToViewport = useCallback((targetWidth: number, targetHeight: number) => {
    const fitZoom = Math.max(
      0.2,
      Math.min(
        1,
        Number(
          Math.min(
            DEFAULT_LAB_CANVAS_WIDTH / targetWidth,
            DEFAULT_LAB_CANVAS_HEIGHT / targetHeight
          ).toFixed(4)
        )
      )
    );
    const nextPan = { x: 0, y: 0 };
    zoomRef.current = fitZoom;
    panRef.current = nextPan;
    setZoom(fitZoom);
    setPan(nextPan);
  }, []);

  const handleFitToView = useCallback(() => {
    const viewport = stageBoxRef.current || viewportRef.current;
    if (!viewport) {
      handleResetZoomPan();
      return;
    }
    const vRect = viewport.getBoundingClientRect();
    if (vRect.width <= 0 || vRect.height <= 0) {
      handleResetZoomPan();
      return;
    }
    if (devices.length === 0 && shapes.length === 0 && diagramLabels.length === 0) {
      if (canvasSize.width > DEFAULT_LAB_CANVAS_WIDTH || canvasSize.height > DEFAULT_LAB_CANVAS_HEIGHT) {
        fitSheetToViewport(canvasSize.width, canvasSize.height);
      } else {
        handleResetZoomPan();
      }
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    devices.forEach(d => {
      minX = Math.min(minX, d.x - 48);
      minY = Math.min(minY, d.y - 44);
      maxX = Math.max(maxX, d.x + 48);
      maxY = Math.max(maxY, d.y + 62);
    });
    shapes.forEach(s => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + s.width);
      maxY = Math.max(maxY, s.y + s.height);
    });
    diagramLabels.forEach(l => {
      minX = Math.min(minX, l.x - 45);
      minY = Math.min(minY, l.y - 20);
      maxX = Math.max(maxX, l.x + 45);
      maxY = Math.max(maxY, l.y + 20);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      handleResetZoomPan();
      return;
    }

    const baseScaleX = vRect.width / DEFAULT_LAB_CANVAS_WIDTH;
    const baseScaleY = vRect.height / DEFAULT_LAB_CANVAS_HEIGHT;
    const contentPxW = Math.max(60, (maxX - minX) * baseScaleX);
    const contentPxH = Math.max(60, (maxY - minY) * baseScaleY);

    const fitZoom = Math.min(
      2.0,
      Math.max(
        0.2,
        Number(
          Math.min((vRect.width * 0.88) / contentPxW, (vRect.height * 0.88) / contentPxH).toFixed(4)
        )
      )
    );

    const stageCxPx = ((minX + maxX) / 2) * baseScaleX;
    const stageCyPx = ((minY + maxY) / 2) * baseScaleY;
    const nextPan = {
      x: vRect.width / 2 - stageCxPx * fitZoom,
      y: vRect.height / 2 - stageCyPx * fitZoom
    };

    zoomRef.current = fitZoom;
    panRef.current = nextPan;
    setZoom(fitZoom);
    setPan(nextPan);
  }, [devices, shapes, diagramLabels, canvasSize, fitSheetToViewport, handleResetZoomPan]);

  const handleChangeWorkspaceSize = useCallback(
    (nextWidth: number, nextHeight: number) => {
      const clampedW = Math.round(
        Math.min(MAX_LAB_CANVAS_WIDTH, Math.max(DEFAULT_LAB_CANVAS_WIDTH, nextWidth))
      );
      const clampedH = Math.round(
        Math.min(MAX_LAB_CANVAS_HEIGHT, Math.max(DEFAULT_LAB_CANVAS_HEIGHT, nextHeight))
      );
      if (clampedW === canvasSize.width && clampedH === canvasSize.height) return;

      const occupied = computeRequiredCanvasSize(
        devices,
        shapes,
        diagramLabels,
        DEFAULT_LAB_CANVAS_WIDTH,
        DEFAULT_LAB_CANVAS_HEIGHT
      );
      if (clampedW < occupied.width || clampedH < occupied.height) {
        flashBanner(
          `Items currently extend to ${occupied.width}×${occupied.height} — run Auto-Layout or move items inward before shrinking to ${clampedW}×${clampedH}.`,
          'error'
        );
        return;
      }

      const nextSize = { width: clampedW, height: clampedH };
      canvasSizeRef.current = nextSize;
      setCanvasSize(nextSize);
      fitSheetToViewport(clampedW, clampedH);

      if (clampedW > DEFAULT_LAB_CANVAS_WIDTH || clampedH > DEFAULT_LAB_CANVAS_HEIGHT) {
        flashBanner(
          `Workspace set to ${clampedW}×${clampedH} — hold Space+drag or use Pan to navigate, or Zoom in for 1:1 editing`
        );
      } else {
        flashBanner('Workspace reset to Standard (1000×580)');
      }
    },
    [canvasSize, devices, diagramLabels, fitSheetToViewport, shapes]
  );

  const handleExpandWorkspace = useCallback(() => {
    const nextW = Math.min(MAX_LAB_CANVAS_WIDTH, canvasSize.width + 500);
    const nextH = Math.min(MAX_LAB_CANVAS_HEIGHT, canvasSize.height + 290);
    if (nextW === canvasSize.width && nextH === canvasSize.height) {
      flashBanner(`Workspace is already at maximum size (${MAX_LAB_CANVAS_WIDTH}×${MAX_LAB_CANVAS_HEIGHT})`);
      return;
    }
    handleChangeWorkspaceSize(nextW, nextH);
  }, [canvasSize, handleChangeWorkspaceSize]);

  // Load or reset preset
  const handleSelectPreset = (presetId: string) => {
    const preset = NETWORK_LAB_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const built = preset.buildInitialState();
    const requiredSize = computeRequiredCanvasSize(built.devices, [], []);
    setActivePresetId(preset.id);
    setCanvasSize(requiredSize);
    setDevices(built.devices);
    setLinks(built.links);
    setShapes([]);
    setDiagramLabels([]);
    const firstId = built.devices[0]?.id || null;
    setSelectedDeviceId(firstId);
    setSelectedDeviceIds(firstId ? [firstId] : []);
    setConsoleTabIds([]);
    setConsoleDeviceId(null);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    clearLiveCableDraw();
    setLastPingResult(null);
    handleResetZoomPan();
    flashBanner(`Loaded "${preset.title}"`);
  };

  // Arrange devices automatically in a clean Grid or Circular layout
  const handleAutoLayout = useCallback(
    (modeOverride?: AutoLayoutMode) => {
      if (devices.length === 0) {
        flashBanner('Add devices to the canvas before running Auto-Layout');
        return;
      }
      const mode = modeOverride ?? autoLayoutMode;
      dragStateRef.current = null;
      setDevices(prev => {
        const arranged = computeAutoLayoutPositions(
          prev,
          links,
          mode,
          canvasSize.width,
          canvasSize.height
        );
        return snapToGrid
          ? alignDevicesToGrid(arranged, gridSize, canvasSize.width, canvasSize.height)
          : arranged;
      });
      flashBanner(
        `Arranged ${devices.length} device${devices.length === 1 ? '' : 's'} in ${
          mode === 'grid' ? 'Grid' : 'Circular'
        } layout${snapToGrid ? ` (snapped to ${gridSize}px grid)` : ''}`
      );
    },
    [autoLayoutMode, canvasSize.height, canvasSize.width, devices.length, gridSize, links, snapToGrid]
  );

  // Force all devices on the canvas to align to nearest grid coordinates
  const handleAlignDevicesToGrid = useCallback(
    (stepOverride?: SnapGridStep) => {
      if (devices.length === 0) {
        flashBanner('Add devices to the canvas before aligning to the grid');
        return;
      }
      const step = stepOverride ?? gridSize;
      dragStateRef.current = null;
      const offCount = devices.filter(d => d.x % step !== 0 || d.y % step !== 0).length;
      if (offCount === 0) {
        flashBanner(
          `All ${devices.length} device${devices.length === 1 ? '' : 's'} are already aligned to the ${step}px grid`
        );
        return;
      }
      setDevices(prev => alignDevicesToGrid(prev, step, canvasSize.width, canvasSize.height));
      flashBanner(
        `Aligned ${offCount} off-grid device${offCount === 1 ? '' : 's'} to ${step}px grid coordinates`
      );
    },
    [canvasSize.height, canvasSize.width, devices, gridSize]
  );

  // Add device to canvas (via palette click or drag-and-drop)
  const handleAddDevice = (type: SimDeviceType, dropX?: number, dropY?: number) => {
    const prefixMap: Record<SimDeviceType, string> = {
      router: 'R',
      switch: 'SW',
      pc: 'PC',
      server: 'Server'
    };
    const sameTypeCount = devices.filter(d => d.type === type).length + 1;
    const name = `${prefixMap[type]}-${sameTypeCount}`;
    const cols = Math.max(4, Math.floor((canvasSize.width - 260) / 165));
    const offset = (Math.floor(devices.length / cols) * 65) % Math.max(180, canvasSize.height - 220);
    const rawX = dropX !== undefined ? dropX : 180 + (devices.length % cols) * 165;
    const rawY = dropY !== undefined ? dropY : 130 + offset;
    const newDev = createDefaultDevice(
      type,
      name,
      snapClampedToGrid(rawX, 60, canvasSize.width - 60, gridSize, snapToGrid),
      snapClampedToGrid(rawY, 60, canvasSize.height - 60, gridSize, snapToGrid)
    );
    setDevices(prev => [...prev, newDev]);
    setSelectedDeviceId(null);
    setSelectedDeviceIds([]);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setTool('select');
  };

  const handleAddShape = (kind: SimShapeKind) => {
    let x = snapClampedToGrid(
      280 + ((shapes.length * 36) % Math.max(240, canvasSize.width - 520)),
      4,
      canvasSize.width - 260,
      gridSize,
      snapToGrid
    );
    let y = snapClampedToGrid(
      140 + ((shapes.length * 28) % Math.max(180, canvasSize.height - 340)),
      4,
      canvasSize.height - 200,
      gridSize,
      snapToGrid
    );
    let width = snapClampedToGrid(kind === 'circle' ? 210 : 260, 80, 420, gridSize, snapToGrid);
    let height = snapClampedToGrid(kind === 'circle' ? 210 : 160, 80, 420, gridSize, snapToGrid);

    if (selectedDeviceIds.length > 0) {
      const selectedSet = new Set(selectedDeviceIds);
      const selectedDevs = devices.filter(d => selectedSet.has(d.id));
      if (selectedDevs.length > 0) {
        const minX = Math.min(...selectedDevs.map(d => d.x));
        const maxX = Math.max(...selectedDevs.map(d => d.x));
        const minY = Math.min(...selectedDevs.map(d => d.y));
        const maxY = Math.max(...selectedDevs.map(d => d.y));
        const padX = kind === 'circle' ? 85 : 70;
        const padTop = kind === 'circle' ? 75 : 62;
        const padBottom = kind === 'circle' ? 85 : 68;
        x = snapClampedToGrid(minX - padX, 8, canvasSize.width - 160, gridSize, snapToGrid);
        y = snapClampedToGrid(minY - padTop, 8, canvasSize.height - 140, gridSize, snapToGrid);
        width = snapClampedToGrid(
          maxX - minX + padX * 2,
          140,
          canvasSize.width - 8 - x,
          gridSize,
          snapToGrid
        );
        height = snapClampedToGrid(
          maxY - minY + padTop + padBottom,
          120,
          canvasSize.height - 8 - y,
          gridSize,
          snapToGrid
        );
      }
    }

    const newShape: SimTopologyShape = {
      id: `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      kind,
      x,
      y,
      width,
      height,
      fillColor: kind === 'rectangle' ? '#ddd6fe' : '#ccfbf1',
      fillOpacity: 0.34,
      borderColor: '#64748b',
      lineStyle: 'dashed',
      borderWidth: 2,
      label: `Group ${shapes.length + 1}`
    };

    setShapes(prev => [...prev, newShape]);
    setSelectedShapeId(newShape.id);
    setSelectedDiagramLabelId(null);
    setSelectedDeviceIds([]);
    setSelectedDeviceId(null);
    setSelectedLinkId(null);
    setTool('select');
    flashBanner(`Added ${kind === 'circle' ? 'Circle' : 'Rectangle'} grouping zone — drag corners to resize`);
  };

  const updateSelectedShape = useCallback(
    (updater: (shape: SimTopologyShape) => SimTopologyShape) => {
      if (!selectedShapeId) return;
      setShapes(prev => prev.map(s => (s.id === selectedShapeId ? updater(s) : s)));
    },
    [selectedShapeId]
  );

  const handleDeleteShape = useCallback((shapeId: string) => {
    setShapes(prev => prev.filter(s => s.id !== shapeId));
    setSelectedShapeId(prev => (prev === shapeId ? null : prev));
  }, []);

  const handleDuplicateSelectedShape = useCallback(() => {
    if (!selectedShape) return;
    const copy: SimTopologyShape = {
      ...selectedShape,
      id: `shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x: Math.min(canvasSize.width - 8 - selectedShape.width, selectedShape.x + 28),
      y: Math.min(canvasSize.height - 8 - selectedShape.height, selectedShape.y + 24),
      label: selectedShape.label ? `${selectedShape.label} Copy` : undefined
    };
    setShapes(prev => [...prev, copy]);
    setSelectedShapeId(copy.id);
  }, [canvasSize.height, canvasSize.width, selectedShape]);

  const handleAddDiagramLabel = () => {
    const newId = `label-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const x = Math.min(
      canvasSize.width - 60,
      360 + ((diagramLabels.length * 42) % Math.max(280, canvasSize.width - 520))
    );
    const y = Math.min(
      canvasSize.height - 30,
      160 + ((diagramLabels.length * 32) % Math.max(220, canvasSize.height - 300))
    );
    const newLabel: SimDiagramLabel = {
      id: newId,
      text: 'Label',
      x,
      y,
      color: '#7c3aed',
      bgColor: 'transparent',
      fontSize: 12,
      bold: true
    };
    setDiagramLabels(prev => [...prev, newLabel]);
    setSelectedDiagramLabelId(newId);
    setEditingDiagramLabelId(newId);
    setEditingDiagramLabelDraft('Label');
    setSelectedShapeId(null);
    setSelectedDeviceIds([]);
    setSelectedDeviceId(null);
    setSelectedLinkId(null);
    setTool('select');
  };

  const updateSelectedDiagramLabel = useCallback(
    (updater: (label: SimDiagramLabel) => SimDiagramLabel) => {
      if (!selectedDiagramLabelId) return;
      setDiagramLabels(prev =>
        prev.map(l => (l.id === selectedDiagramLabelId ? updater(l) : l))
      );
    },
    [selectedDiagramLabelId]
  );

  const commitDiagramLabelEdit = useCallback((labelId: string, rawText: string) => {
    const cleaned = rawText.replace(/\r/g, '').slice(0, 160);
    if (!cleaned.trim()) {
      setDiagramLabels(prev => prev.filter(l => l.id !== labelId));
      setSelectedDiagramLabelId(prev => (prev === labelId ? null : prev));
    } else {
      setDiagramLabels(prev =>
        prev.map(l => (l.id === labelId ? { ...l, text: cleaned } : l))
      );
    }
    setEditingDiagramLabelId(prev => (prev === labelId ? null : prev));
  }, []);

  const handleDeleteDiagramLabel = useCallback((labelId: string) => {
    setDiagramLabels(prev => prev.filter(l => l.id !== labelId));
    setSelectedDiagramLabelId(prev => (prev === labelId ? null : prev));
    setEditingDiagramLabelId(prev => (prev === labelId ? null : prev));
  }, []);

  const handleDuplicateSelectedDiagramLabel = useCallback(() => {
    if (!selectedDiagramLabel) return;
    const copy: SimDiagramLabel = {
      ...selectedDiagramLabel,
      id: `label-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      x: Math.min(canvasSize.width - 25, selectedDiagramLabel.x + 28),
      y: Math.min(canvasSize.height - 20, selectedDiagramLabel.y + 24)
    };
    setDiagramLabels(prev => [...prev, copy]);
    setSelectedDiagramLabelId(copy.id);
  }, [canvasSize.height, canvasSize.width, selectedDiagramLabel]);

  const handleDeleteDevice = useCallback(
    (deviceId: string) => {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setLinks(prev => prev.filter(l => l.fromDeviceId !== deviceId && l.toDeviceId !== deviceId));
      const remaining = selectedDeviceIds.filter(id => id !== deviceId);
      setSelectedDeviceIds(remaining);
      setSelectedDeviceId(cur => (cur === deviceId ? remaining[0] || null : cur));
      setConsoleTabIds(prev => prev.filter(id => id !== deviceId));
      setPendingCableSource(prev => (prev?.deviceId === deviceId ? null : prev));
      setPendingCableTarget(prev => (prev?.deviceId === deviceId ? null : prev));
      if (liveCableDrawRef.current?.fromDeviceId === deviceId) {
        clearLiveCableDraw();
      }
    },
    [selectedDeviceIds]
  );

  const handleDeleteSelectedDevices = useCallback(() => {
    if (selectedDeviceIds.length === 0) return;
    const deleteSet = new Set(selectedDeviceIds);
    const count = deleteSet.size;
    setDevices(prev => prev.filter(d => !deleteSet.has(d.id)));
    setLinks(prev =>
      prev.filter(l => !deleteSet.has(l.fromDeviceId) && !deleteSet.has(l.toDeviceId))
    );
    setSelectedDeviceIds([]);
    setSelectedDeviceId(null);
    setConsoleTabIds(prev => prev.filter(id => !deleteSet.has(id)));
    setPendingCableSource(prev => (prev && deleteSet.has(prev.deviceId) ? null : prev));
    setPendingCableTarget(prev => (prev && deleteSet.has(prev.deviceId) ? null : prev));
    if (liveCableDrawRef.current && deleteSet.has(liveCableDrawRef.current.fromDeviceId)) {
      clearLiveCableDraw();
    }
    flashBanner(`Removed ${count} selected device${count === 1 ? '' : 's'} and attached cables`);
  }, [selectedDeviceIds]);

  const handleDeleteLink = useCallback((linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
    setSelectedLinkId(prev => (prev === linkId ? null : prev));
  }, []);

  const commitDeviceRename = useCallback(
    (deviceId: string, rawName: string) => {
      const trimmed = rawName.trim().slice(0, 64);
      setDevices(prev =>
        prev.map(d => {
          if (d.id !== deviceId) return d;
          if (showCustomLabels) {
            if (!trimmed || trimmed === d.name) {
              return { ...d, customLabel: undefined, useCustomLabel: undefined };
            }
            return { ...d, customLabel: trimmed, useCustomLabel: true };
          }
          if (!trimmed) return d;
          return { ...d, name: trimmed };
        })
      );
      setEditingDeviceLabelId(prev => (prev === deviceId ? null : prev));
    },
    [showCustomLabels]
  );

  const startCanvasLabelEdit = useCallback(
    (dev: SimDevice) => {
      setSelectedDeviceIds([dev.id]);
      setSelectedDeviceId(dev.id);
      setSelectedLinkId(null);
      setSelectedShapeId(null);
      setEditingDeviceLabelId(dev.id);
      setEditingDeviceLabelDraft(
        showCustomLabels ? dev.customLabel?.trim() || dev.name : dev.name
      );
    },
    [showCustomLabels]
  );

  const toggleDeviceCustomLabel = useCallback((deviceId: string) => {
    setDevices(prev =>
      prev.map(d => {
        if (d.id !== deviceId || !d.customLabel?.trim()) return d;
        const nextUse = d.useCustomLabel === false;
        return { ...d, useCustomLabel: nextUse };
      })
    );
    setShowCustomLabels(true);
  }, []);

  const clearDeviceCustomLabel = useCallback((deviceId: string) => {
    setDevices(prev =>
      prev.map(d =>
        d.id === deviceId ? { ...d, customLabel: undefined, useCustomLabel: undefined } : d
      )
    );
    flashBanner('Cleared custom node label and restored default hostname');
  }, []);

  // Keyboard shortcuts for canvas multi-select & rename (Delete / Backspace, Ctrl/Cmd+A, F2, Escape)
  useEffect(() => {
    if (workspaceView !== 'editor' || isSavePromptOpen || isTemplatesModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          setIsSpacePanning(true);
        }
        return;
      }

      if (e.key === 'F2' && tool === 'select' && selectedDeviceIds.length === 1) {
        const target = devices.find(d => d.id === selectedDeviceIds[0]);
        if (target) {
          e.preventDefault();
          startCanvasLabelEdit(target);
        }
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'a' &&
        (tool === 'select' || tool === 'marquee')
      ) {
        if (devices.length === 0) return;
        e.preventDefault();
        setSelectedDeviceIds(devices.map(d => d.id));
        setSelectedDeviceId(prev => prev || devices[0]?.id || null);
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        return;
      }

      if (
        (e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight') &&
        selectedDeviceIds.length > 0 &&
        (tool === 'select' || tool === 'marquee')
      ) {
        e.preventDefault();
        const useSnap = snapToGridRef.current && !e.altKey;
        const step = useSnap ? gridSizeRef.current * (e.shiftKey ? 2 : 1) : e.shiftKey ? 20 : 5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const selectedSet = new Set(selectedDeviceIds);
        const { width: canvasW, height: canvasH } = canvasSizeRef.current;
        setDevices(prev =>
          prev.map(d => {
            if (!selectedSet.has(d.id)) return d;
            return {
              ...d,
              x: snapClampedToGrid(d.x + dx, 60, canvasW - 60, gridSizeRef.current, useSnap),
              y: snapClampedToGrid(d.y + dy, 60, canvasH - 60, gridSizeRef.current, useSnap)
            };
          })
        );
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDeviceIds.length > 0) {
          e.preventDefault();
          handleDeleteSelectedDevices();
        } else if (selectedDiagramLabelId) {
          e.preventDefault();
          handleDeleteDiagramLabel(selectedDiagramLabelId);
        } else if (selectedShapeId) {
          e.preventDefault();
          handleDeleteShape(selectedShapeId);
        } else if (selectedLinkId) {
          e.preventDefault();
          handleDeleteLink(selectedLinkId);
        }
        return;
      }

      if (e.key === 'Escape') {
        setEditingDeviceLabelId(null);
        setEditingDiagramLabelId(null);
        if (consoleDeviceId || consoleTabIds.length > 0) {
          setConsoleTabIds([]);
          setConsoleDeviceId(null);
          setIsConsoleMinimized(false);
          setIsConsoleExpanded(false);
          return;
        }
        if (isWorkspaceFullscreen) {
          setIsWorkspaceFullscreen(false);
          return;
        }
        setSelectedDeviceIds([]);
        setSelectedDeviceId(null);
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        setSelectedDiagramLabelId(null);
        setPendingCableSource(null);
        setPendingCableTarget(null);
        clearLiveCableDraw();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePanning(false);
      }
    };

    const handleWindowBlur = () => {
      setIsSpacePanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
      setIsSpacePanning(false);
    };
  }, [
    consoleDeviceId,
    consoleTabIds.length,
    devices,
    handleDeleteDiagramLabel,
    handleDeleteLink,
    handleDeleteSelectedDevices,
    handleDeleteShape,
    isSavePromptOpen,
    isTemplatesModalOpen,
    isWorkspaceFullscreen,
    selectedDeviceIds,
    selectedDiagramLabelId,
    selectedLinkId,
    selectedShapeId,
    startCanvasLabelEdit,
    tool,
    workspaceView
  ]);

  const isPortInUse = useCallback(
    (deviceId: string, portName: string) =>
      links.some(
        l =>
          (l.fromDeviceId === deviceId && l.fromPort === portName) ||
          (l.toDeviceId === deviceId && l.toPort === portName)
      ),
    [links]
  );

  const clearLiveCableDraw = () => {
    liveCableDrawRef.current = null;
    setLiveCableDraw(null);
    setHoveredPortKey(null);
  };

  const getAutoCableCandidateOrder = (
    sourceType: SimDeviceType,
    targetType: SimDeviceType
  ): SimCableType[] => {
    const pair = new Set([sourceType, targetType]);
    if (sourceType === 'switch' && targetType === 'switch') {
      return ['crossover', 'fiber', 'straight'];
    }
    if (pair.has('switch')) {
      return ['straight', 'fiber', 'crossover'];
    }
    if (sourceType === 'router' && targetType === 'router') {
      return ['crossover', 'serial', 'fiber', 'straight'];
    }
    return ['crossover', 'straight', 'fiber'];
  };

  const resolveMagneticPortPair = (
    sourceDev: SimDevice,
    targetDev: SimDevice,
    cursorX: number,
    cursorY: number,
    fromPortLocked: boolean,
    lockedFromPort: string,
    forcedTargetPort?: string
  ): {
    cableType: SimCableType;
    fromAnchor: ReturnType<typeof getDevicePortAnchors>[number];
    toAnchor: ReturnType<typeof getDevicePortAnchors>[number];
  } | null => {
    const currentLinks = linksRef.current;
    const isBusy = (devId: string, pName: string) =>
      currentLinks.some(
        l =>
          (l.fromDeviceId === devId && l.fromPort === pName) ||
          (l.toDeviceId === devId && l.toPort === pName)
      );

    const sourceAnchors = getDevicePortAnchors(sourceDev);
    const targetAnchors = getDevicePortAnchors(targetDev);
    const availableSource = sourceAnchors.filter(a => {
      if (isBusy(sourceDev.id, a.name)) return false;
      if (fromPortLocked) return a.name === lockedFromPort;
      return true;
    });
    const availableTarget = targetAnchors.filter(a => {
      if (isBusy(targetDev.id, a.name)) return false;
      if (forcedTargetPort) return a.name === forcedTargetPort;
      return true;
    });

    if (availableSource.length === 0 || availableTarget.length === 0) {
      return null;
    }

    const mode = cableToolModeRef.current;
    const baseOrder: SimCableType[] =
      mode === 'auto'
        ? getAutoCableCandidateOrder(sourceDev.type, targetDev.type)
        : [selectedCableTypeRef.current];

    // If pointer is right over a specific free target port in Auto mode, prioritize its media type
    let orderedTypes = baseOrder;
    if (mode === 'auto') {
      const hoveredTargetAnchor = forcedTargetPort
        ? availableTarget.find(a => a.name === forcedTargetPort)
        : availableTarget.find(a => Math.hypot(cursorX - a.x, cursorY - a.y) <= 18);
      if (hoveredTargetAnchor) {
        const directTypes = baseOrder.filter(ct => {
          const tIf = targetDev.interfaces.find(i => i.name === hoveredTargetAnchor.name);
          return tIf ? isPortCompatibleWithCable(tIf, ct) : false;
        });
        if (directTypes.length > 0) {
          orderedTypes = [
            ...directTypes,
            ...baseOrder.filter(ct => !directTypes.includes(ct))
          ];
        }
      }
    }

    for (const ct of orderedTypes) {
      const compatSrc = availableSource.filter(a => {
        const iface = sourceDev.interfaces.find(i => i.name === a.name);
        return iface ? isPortCompatibleWithCable(iface, ct) : false;
      });
      const compatDst = availableTarget.filter(a => {
        const iface = targetDev.interfaces.find(i => i.name === a.name);
        return iface ? isPortCompatibleWithCable(iface, ct) : false;
      });
      if (compatSrc.length === 0 || compatDst.length === 0) continue;

      // Pick target port anchor closest to cursor (magnetic capture)
      let bestDst = compatDst[0];
      let bestDstDist = Math.hypot(cursorX - bestDst.x, cursorY - bestDst.y);
      for (let i = 1; i < compatDst.length; i++) {
        const d = Math.hypot(cursorX - compatDst[i].x, cursorY - compatDst[i].y);
        if (d < bestDstDist) {
          bestDst = compatDst[i];
          bestDstDist = d;
        }
      }

      // Pick source port anchor facing the snapped target port (minimizing crossing)
      let bestSrc = compatSrc[0];
      let bestSrcDist = Math.hypot(bestDst.x - bestSrc.x, bestDst.y - bestSrc.y);
      for (let i = 1; i < compatSrc.length; i++) {
        const d = Math.hypot(bestDst.x - compatSrc[i].x, bestDst.y - compatSrc[i].y);
        if (d < bestSrcDist) {
          bestSrc = compatSrc[i];
          bestSrcDist = d;
        }
      }

      return {
        cableType: ct,
        fromAnchor: bestSrc,
        toAnchor: bestDst
      };
    }

    return null;
  };

  const updateLiveCableDrawForCursor = (
    prev: LiveCableDrawState,
    cursorX: number,
    cursorY: number,
    isDragGesture: boolean
  ): LiveCableDrawState => {
    const currentDevices = devicesRef.current;
    const currentLinks = linksRef.current;
    const sourceDev = currentDevices.find(d => d.id === prev.fromDeviceId);
    if (!sourceDev) return { ...prev, cursorX, cursorY, isDragGesture };

    const isBusy = (devId: string, pName: string) =>
      currentLinks.some(
        l =>
          (l.fromDeviceId === devId && l.fromPort === pName) ||
          (l.toDeviceId === devId && l.toPort === pName)
      );

    // Find closest candidate target device within magnetic capture radius
    let nearestTarget: { dev: SimDevice; score: number } | null = null;
    for (const dev of currentDevices) {
      if (dev.id === sourceDev.id) continue;
      const centerDist = Math.hypot(cursorX - dev.x, cursorY - dev.y);
      const anchors = getDevicePortAnchors(dev);
      let minPortDist = Infinity;
      for (const a of anchors) {
        const d = Math.hypot(cursorX - a.x, cursorY - a.y);
        if (d < minPortDist) minPortDist = d;
      }
      if (centerDist <= 70 || minPortDist <= 38) {
        const score = Math.min(centerDist, minPortDist + 14);
        if (!nearestTarget || score < nearestTarget.score) {
          nearestTarget = { dev, score };
        }
      }
    }

    if (nearestTarget) {
      const resolved = resolveMagneticPortPair(
        sourceDev,
        nearestTarget.dev,
        cursorX,
        cursorY,
        prev.fromPortLocked,
        prev.fromPort
      );
      if (resolved) {
        return {
          ...prev,
          fromPort: resolved.fromAnchor.name,
          fromShortName: resolved.fromAnchor.shortName,
          fromX: resolved.fromAnchor.x,
          fromY: resolved.fromAnchor.y,
          cursorX,
          cursorY,
          isDragGesture,
          snapTarget: {
            deviceId: nearestTarget.dev.id,
            deviceName: nearestTarget.dev.name,
            portName: resolved.toAnchor.name,
            shortName: resolved.toAnchor.shortName,
            x: resolved.toAnchor.x,
            y: resolved.toAnchor.y,
            cableType: resolved.cableType
          },
          blockedTarget: null
        };
      }
      return {
        ...prev,
        cursorX,
        cursorY,
        isDragGesture,
        snapTarget: null,
        blockedTarget: {
          deviceId: nearestTarget.dev.id,
          deviceName: nearestTarget.dev.name,
          x: nearestTarget.dev.x,
          y: nearestTarget.dev.y,
          reason: 'No free compatible port'
        }
      };
    }

    // No target device captured yet: dynamically orient source port toward cursor if unlocked
    let nextFromPort = prev.fromPort;
    let nextFromShort = prev.fromShortName;
    let nextFromX = prev.fromX;
    let nextFromY = prev.fromY;

    if (!prev.fromPortLocked) {
      const mode = cableToolModeRef.current;
      const fixedType = selectedCableTypeRef.current;
      const candidates = getDevicePortAnchors(sourceDev).filter(a => {
        if (isBusy(sourceDev.id, a.name)) return false;
        if (mode === 'auto') return true;
        const iface = sourceDev.interfaces.find(i => i.name === a.name);
        return iface ? isPortCompatibleWithCable(iface, fixedType) : false;
      });
      if (candidates.length > 0) {
        let best = candidates[0];
        let bestDist = Math.hypot(cursorX - best.x, cursorY - best.y);
        for (let i = 1; i < candidates.length; i++) {
          const d = Math.hypot(cursorX - candidates[i].x, cursorY - candidates[i].y);
          if (d < bestDist) {
            best = candidates[i];
            bestDist = d;
          }
        }
        nextFromPort = best.name;
        nextFromShort = best.shortName;
        nextFromX = best.x;
        nextFromY = best.y;
      }
    }

    return {
      ...prev,
      fromPort: nextFromPort,
      fromShortName: nextFromShort,
      fromX: nextFromX,
      fromY: nextFromY,
      cursorX,
      cursorY,
      isDragGesture,
      snapTarget: null,
      blockedTarget: null
    };
  };

  const finalizeMagneticCableLink = (
    fromDeviceId: string,
    fromPort: string,
    snap: LiveCableSnapTarget
  ) => {
    if (fromDeviceId === snap.deviceId) {
      clearLiveCableDraw();
      return;
    }

    const newLink: SimLink = {
      id: `link-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      cableType: snap.cableType,
      fromDeviceId,
      fromPort,
      toDeviceId: snap.deviceId,
      toPort: snap.portName
    };

    const currentDevices = devicesRef.current;
    const sourceDev = currentDevices.find(d => d.id === fromDeviceId);
    const fromIf = sourceDev?.interfaces.find(i => i.name === fromPort);
    const status = evaluateLinkStatus(newLink, currentDevices);

    setLinks(prev => [...prev, newLink]);
    setSelectedLinkId(newLink.id);
    setSelectedDeviceIds([]);
    setSelectedDeviceId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    clearLiveCableDraw();

    if (!status.cableValid) {
      flashBanner(status.reason);
    } else if (!status.isUp) {
      flashBanner(
        `Anchored ${sourceDev?.name || 'Source'} (${fromIf?.shortName || fromPort}) ↔ ${snap.deviceName} (${snap.shortName}) — ${status.reason}`
      );
    } else {
      flashBanner(
        `Connected ${sourceDev?.name || 'Source'} (${fromIf?.shortName || fromPort}) ↔ ${snap.deviceName} (${snap.shortName}) — link is up/up`
      );
    }
  };

  const handleCableSurfacePointerDown = (
    device: SimDevice,
    e: React.PointerEvent,
    forcedPortName?: string
  ) => {
    if (toolRef.current !== 'cable' || e.button !== 0 || isSpacePanningRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const { width: canvasW, height: canvasH } = canvasSizeRef.current;
    const currX = Math.min(canvasW, Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasW));
    const currY = Math.min(canvasH, Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasH));

    const currentLinks = linksRef.current;
    const isBusy = (devId: string, pName: string) =>
      currentLinks.some(
        l =>
          (l.fromDeviceId === devId && l.fromPort === pName) ||
          (l.toDeviceId === devId && l.toPort === pName)
      );

    const active = liveCableDrawRef.current;
    const mode = cableToolModeRef.current;
    const fixedType = selectedCableTypeRef.current;

    if (!active) {
      const anchors = getDevicePortAnchors(device);
      if (forcedPortName) {
        const anchor = anchors.find(a => a.name === forcedPortName);
        const iface = device.interfaces.find(i => i.name === forcedPortName);
        if (!anchor || !iface) return;
        if (isBusy(device.id, anchor.name)) {
          flashBanner(`${device.name} ${anchor.shortName} is already connected`);
          return;
        }
        if (mode !== 'auto' && !isPortCompatibleWithCable(iface, fixedType)) {
          flashBanner(`${CABLE_META[fixedType].short} cable cannot attach to ${anchor.shortName}`);
          return;
        }
        const initial: LiveCableDrawState = {
          fromDeviceId: device.id,
          fromPort: anchor.name,
          fromShortName: anchor.shortName,
          fromX: anchor.x,
          fromY: anchor.y,
          fromPortLocked: true,
          cursorX: currX,
          cursorY: currY,
          startClientX: e.clientX,
          startClientY: e.clientY,
          isDragGesture: false,
          snapTarget: null,
          blockedTarget: null
        };
        liveCableDrawRef.current = initial;
        setLiveCableDraw(initial);
        setPendingCableSource(null);
        setPendingCableTarget(null);
        return;
      }

      const freeAnchors = anchors.filter(a => {
        if (isBusy(device.id, a.name)) return false;
        if (mode === 'auto') return true;
        const iface = device.interfaces.find(i => i.name === a.name);
        return iface ? isPortCompatibleWithCable(iface, fixedType) : false;
      });
      if (freeAnchors.length === 0) {
        flashBanner(
          mode === 'auto'
            ? `No free ports available on ${device.name}`
            : `No free ${CABLE_META[fixedType].short}-compatible ports on ${device.name}`
        );
        return;
      }

      let best = freeAnchors[0];
      let bestDist = Math.hypot(currX - best.x, currY - best.y);
      for (let i = 1; i < freeAnchors.length; i++) {
        const d = Math.hypot(currX - freeAnchors[i].x, currY - freeAnchors[i].y);
        if (d < bestDist) {
          best = freeAnchors[i];
          bestDist = d;
        }
      }

      const initial: LiveCableDrawState = {
        fromDeviceId: device.id,
        fromPort: best.name,
        fromShortName: best.shortName,
        fromX: best.x,
        fromY: best.y,
        fromPortLocked: false,
        cursorX: currX,
        cursorY: currY,
        startClientX: e.clientX,
        startClientY: e.clientY,
        isDragGesture: false,
        snapTarget: null,
        blockedTarget: null
      };
      liveCableDrawRef.current = initial;
      setLiveCableDraw(initial);
      setPendingCableSource(null);
      setPendingCableTarget(null);
      return;
    }

    // Active click-move-click mode: second click completes or cancels
    suppressCanvasClickRef.current = true;
    window.setTimeout(() => {
      suppressCanvasClickRef.current = false;
    }, 0);

    if (device.id === active.fromDeviceId) {
      if (forcedPortName && forcedPortName !== active.fromPort) {
        const anchor = getDevicePortAnchors(device).find(a => a.name === forcedPortName);
        const iface = device.interfaces.find(i => i.name === forcedPortName);
        if (
          anchor &&
          iface &&
          !isBusy(device.id, anchor.name) &&
          (mode === 'auto' || isPortCompatibleWithCable(iface, fixedType))
        ) {
          const switched: LiveCableDrawState = {
            ...active,
            fromPort: anchor.name,
            fromShortName: anchor.shortName,
            fromX: anchor.x,
            fromY: anchor.y,
            fromPortLocked: true,
            snapTarget: null,
            blockedTarget: null
          };
          liveCableDrawRef.current = switched;
          setLiveCableDraw(switched);
          return;
        }
      }
      clearLiveCableDraw();
      return;
    }

    const sourceDev = devicesRef.current.find(d => d.id === active.fromDeviceId);
    if (!sourceDev) {
      clearLiveCableDraw();
      return;
    }

    const resolved = resolveMagneticPortPair(
      sourceDev,
      device,
      currX,
      currY,
      active.fromPortLocked,
      active.fromPort,
      forcedPortName
    );
    if (resolved) {
      finalizeMagneticCableLink(sourceDev.id, resolved.fromAnchor.name, {
        deviceId: device.id,
        deviceName: device.name,
        portName: resolved.toAnchor.name,
        shortName: resolved.toAnchor.shortName,
        x: resolved.toAnchor.x,
        y: resolved.toAnchor.y,
        cableType: resolved.cableType
      });
    } else {
      flashBanner(`No free compatible ports between ${sourceDev.name} and ${device.name}`);
      clearLiveCableDraw();
    }
  };

  // Cable port selection completion
  const completeCableConnection = (toPort: string) => {
    if (!pendingCableSource?.portName || !pendingCableTarget) return;
    if (pendingCableSource.deviceId === pendingCableTarget.deviceId) {
      setPendingCableSource(null);
      setPendingCableTarget(null);
      return;
    }

    const newLink: SimLink = {
      id: `link-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      cableType: selectedCableType,
      fromDeviceId: pendingCableSource.deviceId,
      fromPort: pendingCableSource.portName,
      toDeviceId: pendingCableTarget.deviceId,
      toPort
    };

    const status = evaluateLinkStatus(newLink, devices);
    setLinks(prev => [...prev, newLink]);
    setSelectedLinkId(newLink.id);
    setPendingCableSource(null);
    setPendingCableTarget(null);

    if (!status.cableValid) {
      flashBanner(status.reason);
    } else if (!status.isUp) {
      flashBanner(`Cable attached (${status.reason})`);
    } else {
      flashBanner('Cable connected — link is up/up');
    }
  };

  const handleDeviceClick = (device: SimDevice, e?: React.MouseEvent) => {
    if (
      suppressCanvasClickRef.current ||
      suppressDeviceClickAfterDragRef.current ||
      dragStateRef.current?.moved
    ) {
      suppressDeviceClickAfterDragRef.current = false;
      return;
    }

    if (tool === 'pan' || isSpacePanningRef.current) {
      return;
    }

    if (tool === 'delete') {
      handleDeleteDevice(device.id);
      return;
    }

    if (tool === 'cable') {
      // Handled via magnetic line drawing in handleCableSurfacePointerDown / pointermove / pointerup
      return;
    }

    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      const exists = selectedDeviceIds.includes(device.id);
      const next = exists
        ? selectedDeviceIds.filter(id => id !== device.id)
        : [...selectedDeviceIds, device.id];
      setSelectedDeviceIds(next);
      setSelectedDeviceId(cur => {
        if (!exists) return device.id;
        if (cur === device.id) return next[next.length - 1] || null;
        return cur;
      });
      setSelectedLinkId(null);
      setSelectedShapeId(null);
      setSelectedDiagramLabelId(null);
      return;
    }

    setSelectedDeviceIds([device.id]);
    setSelectedDeviceId(device.id);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
  };

  // Run CLI command on active console device
  const handleRunCliCommand = (e?: React.FormEvent, overrideCmd?: string) => {
    if (e) e.preventDefault();
    const targetDevice = consoleDevice || selectedDevice;
    if (!targetDevice) return;
    const raw = (overrideCmd ?? cliInput).trim();
    if (!raw) return;

    const result = executeDeviceCommand(targetDevice, raw, devices, links);
    setDevices(prev => prev.map(d => (d.id === targetDevice.id ? result.updatedDevice : d)));

    if (!overrideCmd) {
      setCliInput('');
    }
    setCmdHistoryMap(prev => ({
      ...prev,
      [targetDevice.id]: [...(prev[targetDevice.id] || []), raw]
    }));
    setCmdCursor(-1);

    if (result.pingResult) {
      setLastPingResult(result.pingResult);
    }
    recordStudyTime(15, 'lab');
  };

  const handleCliKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const targetDevice = consoleDevice || selectedDevice;
    if (!targetDevice) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const { completed, suggestions } = getCliTabCompletions(targetDevice, cliInput);
      if (completed !== cliInput) {
        setCliInput(completed);
      } else if (suggestions.length > 0) {
        const prompt = getCliPrompt(targetDevice);
        const hintLines = [
          `${prompt} ${cliInput}`,
          suggestions.slice(0, 12).join('    ')
        ];
        setDevices(prev =>
          prev.map(d =>
            d.id === targetDevice.id
              ? { ...d, cliHistory: [...d.cliHistory, ...hintLines] }
              : d
          )
        );
      }
      return;
    }

    const cmds = cmdHistoryMap[targetDevice.id] || [];
    if (cmds.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = cmdCursor < 0 ? cmds.length - 1 : Math.max(0, cmdCursor - 1);
      setCmdCursor(nextIdx);
      setCliInput(cmds[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cmdCursor < 0) return;
      if (cmdCursor >= cmds.length - 1) {
        setCmdCursor(-1);
        setCliInput('');
      } else {
        const nextIdx = cmdCursor + 1;
        setCmdCursor(nextIdx);
        setCliInput(cmds[nextIdx]);
      }
    }
  };

  // Quick Ping bar execution
  const handleQuickPing = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pingSourceId || !pingTargetIp.trim()) return;
    const res = simulatePing(devices, links, pingSourceId, pingTargetIp.trim());
    setLastPingResult(res);
  };

  const openDeviceConsole = useCallback(
    (dev: SimDevice) => {
      setSelectedDeviceIds([dev.id]);
      setSelectedDeviceId(dev.id);
      setSelectedLinkId(null);
      setSelectedShapeId(null);
      setSelectedDiagramLabelId(null);
      setConsoleTabIds(prev => (prev.includes(dev.id) ? prev : [...prev, dev.id]));
      setConsoleOffset(prev => (consoleTabIds.length > 0 ? prev : { x: 0, y: 0 }));
      setConsoleDeviceId(dev.id);
      setIsConsoleMinimized(false);
      setCmdCursor(-1);
      window.setTimeout(() => cliInputRef.current?.focus(), 0);
    },
    [consoleTabIds.length]
  );

  const closeConsoleTab = useCallback((deviceId: string) => {
    setConsoleTabIds(prev => {
      const idx = prev.indexOf(deviceId);
      const next = prev.filter(id => id !== deviceId);
      setConsoleDeviceId(cur => {
        if (cur !== deviceId) return cur;
        if (next.length === 0) return null;
        return next[Math.min(idx, next.length - 1)];
      });
      return next;
    });
    setCmdCursor(-1);
  }, []);

  const closeAllConsoleTabs = useCallback(() => {
    setConsoleTabIds([]);
    setConsoleDeviceId(null);
    setIsConsoleMinimized(false);
    setIsConsoleExpanded(false);
    setIsDraggingConsole(false);
    setCmdCursor(-1);
  }, []);

  const handleStartNewBlankLab = () => {
    const blankPreset = NETWORK_LAB_PRESETS.find(p => p.id === 'blank-sandbox') || NETWORK_LAB_PRESETS[0];
    setActivePresetId(blankPreset.id);
    setCanvasSize({ width: DEFAULT_LAB_CANVAS_WIDTH, height: DEFAULT_LAB_CANVAS_HEIGHT });
    setShowCustomLabels(true);
    setDevices([]);
    setLinks([]);
    setShapes([]);
    setDiagramLabels([]);
    setActiveSavedLabId(null);
    setSelectedDeviceId(null);
    setSelectedDeviceIds([]);
    closeAllConsoleTabs();
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    clearLiveCableDraw();
    setLastPingResult(null);
    setRecentlySavedProjectId(null);
    setIsSavePromptOpen(false);
    handleResetZoomPan();
    setWorkspaceView('editor');
    flashBanner('Started a new Blank Lab Project');
  };

  const handleExportTopology = (record?: SavedLabRecord) => {
    const targetDevices = record ? record.devices : devices;
    const targetLinks = record ? record.links : links;
    const targetShapes = record ? record.shapes || [] : shapes;
    const targetLabels = record ? record.labels || [] : diagramLabels;

    if (
      targetDevices.length === 0 &&
      targetShapes.length === 0 &&
      targetLabels.length === 0
    ) {
      flashBanner(
        'Place at least one device, zone, or label before exporting a topology JSON file',
        'error'
      );
      return;
    }

    const activeRecord = savedLabs.find(l => l.id === activeSavedLabId);
    const exportTitle =
      record?.title ||
      activeRecord?.title ||
      (saveTitleInput.trim() ? saveTitleInput.trim() : activePreset.title);

    const isLiveCompleted =
      objectiveProgress.totalCount > 0 &&
      objectiveProgress.passedCount === objectiveProgress.totalCount;

    const resolvedStatus: 'in_progress' | 'completed' = record
      ? record.status || 'in_progress'
      : activeRecord?.status === 'completed' || isLiveCompleted
      ? 'completed'
      : 'in_progress';

    const objectivesSummary = record
      ? record.objectivesTotal > 0
        ? {
            passed: record.objectivesPassed,
            total: record.objectivesTotal,
            completed: record.objectivesPassed >= record.objectivesTotal
          }
        : undefined
      : objectiveProgress.totalCount > 0
      ? {
          passed: objectiveProgress.passedCount,
          total: objectiveProgress.totalCount,
          completed: isLiveCompleted
        }
      : undefined;

    const exportCanvasSize = record
      ? computeRequiredCanvasSize(
          targetDevices,
          targetShapes,
          targetLabels,
          record.canvasWidth,
          record.canvasHeight
        )
      : canvasSize;

    const payload = buildTopologyJsonPayload({
      title: exportTitle,
      status: resolvedStatus,
      presetId: record?.presetId || activePresetId,
      canvasSize: exportCanvasSize,
      showCustomLabels: record ? record.showCustomLabels !== false : showCustomLabels,
      gridSettings: record?.gridSettings || { showGrid, snapToGrid, gridSize, gridStyle },
      studentEmail: currentUser.email,
      ...(objectivesSummary ? { objectivesSummary } : {}),
      devices: targetDevices,
      links: targetLinks,
      shapes: targetShapes,
      labels: targetLabels
    });

    const filename = toProjectFileName(exportTitle);
    triggerTopologyJsonDownload(payload, filename);
    flashBanner(
      `Exported "${payload.title}" (${payload.summary.deviceCount} devices, ${payload.summary.linkCount} cables) → ${filename}`
    );
  };

  const handleExportImage = async (format: 'png' | 'svg', record?: SavedLabRecord) => {
    const targetDevices = record ? record.devices : devices;
    const targetLinks = record ? record.links : links;
    const targetShapes = record ? record.shapes || [] : shapes;
    const targetLabels = record ? record.labels || [] : diagramLabels;

    if (targetDevices.length === 0 && targetShapes.length === 0 && targetLabels.length === 0) {
      flashBanner('Place at least one device, zone, or label before exporting a topology image');
      return;
    }

    const activeRecord = savedLabs.find(l => l.id === activeSavedLabId);
    const title =
      record?.title ||
      activeRecord?.title ||
      (saveTitleInput.trim() ? saveTitleInput.trim() : activePreset.title);
    const isDarkTheme =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const objPassed = record ? record.objectivesPassed : objectiveProgress.passedCount;
    const objTotal = record ? record.objectivesTotal : objectiveProgress.totalCount;
    const isCompleted = record
      ? record.status === 'completed'
      : activeRecord?.status === 'completed' || (objTotal > 0 && objPassed === objTotal);

    const statusTag = isCompleted
      ? objTotal > 0
        ? `Completed (${objPassed}/${objTotal} objectives)`
        : 'Completed'
      : objTotal > 0
      ? `${objPassed}/${objTotal} objectives`
      : '';

    const subtitle = [
      statusTag,
      `${targetDevices.length} devices`,
      `${targetLinks.length} cables`,
      currentUser.email
    ]
      .filter(Boolean)
      .join(' · ');

    const exportCanvasSize = record
      ? computeRequiredCanvasSize(
          targetDevices,
          targetShapes,
          targetLabels,
          record.canvasWidth,
          record.canvasHeight
        )
      : canvasSize;

    const options = {
      title,
      subtitle,
      devices: targetDevices,
      links: targetLinks,
      shapes: targetShapes,
      labels: targetLabels,
      canvasWidth: exportCanvasSize.width,
      canvasHeight: exportCanvasSize.height,
      showCustomLabels: record ? record.showCustomLabels !== false : showCustomLabels,
      showGrid: record?.gridSettings?.showGrid ?? showGrid,
      gridSize: record?.gridSettings?.gridSize ?? gridSize,
      gridStyle: record?.gridSettings?.gridStyle ?? gridStyle,
      isDark: isDarkTheme
    };

    if (format === 'svg') {
      const filename = exportTopologyAsSvg(options);
      flashBanner(`Exported scalable SVG diagram (${filename})`);
      return;
    }

    setIsExportingImage(true);
    try {
      const filename = await exportTopologyAsPng(options);
      flashBanner(`Exported high-resolution PNG diagram (${filename})`);
    } catch {
      flashBanner('Could not export PNG diagram in this browser; try SVG export');
    } finally {
      setIsExportingImage(false);
    }
  };

  const importTopologyFromText = (rawText: string, fileName: string) => {
    const knownPresets = new Set(NETWORK_LAB_PRESETS.map(p => p.id));
    const parsed = parseAndValidateTopologyJson(rawText, knownPresets);
    if (!parsed.ok) {
      flashBanner(parsed.error, 'error');
      return;
    }

    const {
      title,
      status,
      presetId,
      canvasSize: importedCanvasSize,
      showCustomLabels: importedShowCustomLabels,
      gridSettings: importedGridSettings,
      devices: importedDevices,
      links: importedLinks,
      shapes: importedShapes,
      labels: importedLabels,
      warnings
    } = parsed.data;

    setActivePresetId(presetId);
    setCanvasSize(importedCanvasSize);
    setShowCustomLabels(importedShowCustomLabels !== false);
    if (importedGridSettings) {
      if (typeof importedGridSettings.showGrid === 'boolean') {
        setShowGrid(importedGridSettings.showGrid);
      }
      if (typeof importedGridSettings.snapToGrid === 'boolean') {
        setSnapToGrid(importedGridSettings.snapToGrid);
      }
      if (importedGridSettings.gridSize !== undefined) {
        setGridSize(normalizeGridStep(importedGridSettings.gridSize));
      }
      if (
        importedGridSettings.gridStyle === 'lines' ||
        importedGridSettings.gridStyle === 'dots'
      ) {
        setGridStyle(importedGridSettings.gridStyle);
      }
    }
    setDevices(importedDevices);
    setLinks(importedLinks);
    setShapes(importedShapes);
    setDiagramLabels(importedLabels);
    setActiveSavedLabId(null);
    setRecentlySavedProjectId(null);
    setIsSavePromptOpen(false);

    const firstImportedId = importedDevices[0]?.id || null;
    setSelectedDeviceId(firstImportedId);
    setSelectedDeviceIds(firstImportedId ? [firstImportedId] : []);
    const preferredPingSource =
      importedDevices.find(d => d.type === 'pc' || d.type === 'server') || importedDevices[0];
    setPingSourceId(preferredPingSource?.id || '');

    closeAllConsoleTabs();
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDeviceLabelId(null);
    setEditingDiagramLabelId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    clearLiveCableDraw();
    setLastPingResult(null);
    setAnimStepIndex(null);

    const cleanFileBase = fileName.replace(/\.(netlab\.)?json$/i, '').trim();
    const resolvedTitle = title || cleanFileBase || 'Imported Network Lab';
    setSaveTitleInput(resolvedTitle);
    setSaveStatusInput(status);

    if (
      importedCanvasSize.width > DEFAULT_LAB_CANVAS_WIDTH ||
      importedCanvasSize.height > DEFAULT_LAB_CANVAS_HEIGHT
    ) {
      fitSheetToViewport(importedCanvasSize.width, importedCanvasSize.height);
    } else {
      handleResetZoomPan();
    }
    setWorkspaceView('editor');

    const countParts = [
      `${importedDevices.length} device${importedDevices.length === 1 ? '' : 's'}`,
      `${importedLinks.length} cable${importedLinks.length === 1 ? '' : 's'}`
    ];
    if (importedShapes.length > 0) {
      countParts.push(`${importedShapes.length} zone${importedShapes.length === 1 ? '' : 's'}`);
    }
    if (importedLabels.length > 0) {
      countParts.push(`${importedLabels.length} label${importedLabels.length === 1 ? '' : 's'}`);
    }
    const warningSuffix = warnings.length > 0 ? ` (${warnings.join('; ')})` : '';
    flashBanner(`Imported "${resolvedTitle}" — ${countParts.join(', ')}${warningSuffix}`);
  };

  const importTopologyFile = (file: File) => {
    const looksLikeJson =
      /\.json$/i.test(file.name) ||
      file.type === 'application/json' ||
      file.type === 'text/json';
    if (!looksLikeJson) {
      flashBanner(
        `Unsupported file "${file.name}". Select a .json or .netlab.json topology file.`,
        'error'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      importTopologyFromText(String(reader.result || ''), file.name);
    };
    reader.onerror = () => {
      flashBanner(`Failed to read topology file "${file.name}".`, 'error');
    };
    reader.readAsText(file);
  };

  const handleImportTopology = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importTopologyFile(file);
    e.target.value = '';
  };

  // Save current topology layout & progress to IndexedDB + Firestore (when signed in)
  const handleSaveTopologySnapshot = async (
    saveAsNew: boolean,
    closeAfterSave: boolean = false
  ) => {
    const trimmedTitle =
      saveTitleInput.trim() ||
      `${activePreset.title} (${new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })})`;

    const targetId =
      !saveAsNew && activeSavedLabId
        ? sanitizeLabId(activeSavedLabId)
        : sanitizeLabId(`lab-${ownerScopeId.slice(0, 12)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`);

    const existing = savedLabs.find(l => l.id === targetId && l.userId === ownerScopeId);
    const nowIso = new Date().toISOString();

    const cleanDevices = sanitizeDevicesForStorage(devices);
    const cleanLinks = sanitizeLinksForStorage(links);
    const cleanShapes = sanitizeShapesForStorage(shapes);
    const cleanLabels = sanitizeLabelsForStorage(diagramLabels);

    const record: SavedLabRecord = {
      id: targetId,
      userId: ownerScopeId,
      title: trimmedTitle.slice(0, 120),
      presetId: activePresetId,
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      showCustomLabels,
      gridSettings: { showGrid, snapToGrid, gridSize, gridStyle },
      devices: cleanDevices,
      links: cleanLinks,
      shapes: cleanShapes,
      labels: cleanLabels,
      deviceCount: cleanDevices.length,
      linkCount: cleanLinks.length,
      objectivesPassed: objectiveProgress.passedCount,
      objectivesTotal: objectiveProgress.totalCount,
      status: saveStatusInput,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
      syncStatus: existing?.syncStatus || 'local'
    };

    setIsSavingLab(true);
    try {
      let syncedCloud = false;
      if (isCloudAuthReady) {
        try {
          syncedCloud = await saveLabTopologyToFirestore(record);
        } catch {
          syncedCloud = false;
        }
      }
      const finalRecord: SavedLabRecord = {
        ...record,
        syncStatus: syncedCloud ? 'cloud' : 'local'
      };
      await putSavedLabToIdb(finalRecord);
      setSavedLabs(prev => {
        const filtered = prev.filter(item => item.id !== finalRecord.id && item.userId === ownerScopeId);
        return [finalRecord, ...filtered];
      });
      setIsSavePromptOpen(false);

      if (closeAfterSave) {
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        await clearActiveLabDraftFromIdb(ownerScopeId);
        setActivePresetId('blank-sandbox');
        setCanvasSize({ width: DEFAULT_LAB_CANVAS_WIDTH, height: DEFAULT_LAB_CANVAS_HEIGHT });
        setDevices([]);
        setLinks([]);
        setShapes([]);
        setDiagramLabels([]);
        setActiveSavedLabId(null);
        setSelectedDeviceId(null);
        setSelectedDeviceIds([]);
        closeAllConsoleTabs();
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        setPendingCableSource(null);
        setPendingCableTarget(null);
        setLastPingResult(null);
        setLastAutoSavedAt(null);
        setRecentlySavedProjectId(finalRecord.id);
        setWorkspaceView('projects');
        flashBanner(
          syncedCloud
            ? `Saved & closed "${finalRecord.title}" — stored in My Lab Projects (Firestore + IndexedDB)`
            : `Saved & closed "${finalRecord.title}" — stored in My Lab Projects (IndexedDB)`
        );
      } else {
        setActiveSavedLabId(finalRecord.id);
        flashBanner(
          syncedCloud
            ? `Saved "${finalRecord.title}" to Firestore & IndexedDB`
            : `Saved "${finalRecord.title}" locally in IndexedDB`
        );
      }
    } finally {
      setIsSavingLab(false);
    }
  };

  const handleResumeSavedLab = (record: SavedLabRecord) => {
    if (record.userId !== ownerScopeId) return;
    const recordShapes = Array.isArray(record.shapes) ? record.shapes : [];
    const recordLabels = Array.isArray(record.labels) ? record.labels : [];
    const restoredSize = computeRequiredCanvasSize(
      record.devices,
      recordShapes,
      recordLabels,
      record.canvasWidth,
      record.canvasHeight
    );
    setActivePresetId(record.presetId);
    setCanvasSize(restoredSize);
    setShowCustomLabels(record.showCustomLabels !== false);
    if (record.gridSettings) {
      if (typeof record.gridSettings.showGrid === 'boolean') {
        setShowGrid(record.gridSettings.showGrid);
      }
      if (typeof record.gridSettings.snapToGrid === 'boolean') {
        setSnapToGrid(record.gridSettings.snapToGrid);
      }
      if (record.gridSettings.gridSize !== undefined) {
        setGridSize(normalizeGridStep(record.gridSettings.gridSize));
      }
      if (
        record.gridSettings.gridStyle === 'lines' ||
        record.gridSettings.gridStyle === 'dots'
      ) {
        setGridStyle(record.gridSettings.gridStyle);
      }
    }
    setDevices(record.devices);
    setLinks(record.links);
    setShapes(recordShapes);
    setDiagramLabels(recordLabels);
    setActiveSavedLabId(record.id);
    setSaveTitleInput(record.title);
    const firstId = record.devices[0]?.id || null;
    setSelectedDeviceId(firstId);
    setSelectedDeviceIds(firstId ? [firstId] : []);
    closeAllConsoleTabs();
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    clearLiveCableDraw();
    setLastPingResult(null);
    setRecentlySavedProjectId(null);
    if (
      restoredSize.width > DEFAULT_LAB_CANVAS_WIDTH ||
      restoredSize.height > DEFAULT_LAB_CANVAS_HEIGHT
    ) {
      fitSheetToViewport(restoredSize.width, restoredSize.height);
    } else {
      handleResetZoomPan();
    }
    setWorkspaceView('editor');
    flashBanner(`Opened lab project "${record.title}"`);
  };

  const handleDuplicateSavedLab = async (record: SavedLabRecord) => {
    if (record.userId !== ownerScopeId) return;
    const nowIso = new Date().toISOString();
    const copyTitle = `${record.title} (Copy)`.slice(0, 120);
    const copyRecord: SavedLabRecord = {
      ...record,
      id: sanitizeLabId(`lab-${ownerScopeId.slice(0, 12)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
      userId: ownerScopeId,
      title: copyTitle,
      status: 'in_progress',
      createdAt: nowIso,
      updatedAt: nowIso,
      syncStatus: 'local'
    };

    let syncedCloud = false;
    if (isCloudAuthReady) {
      try {
        syncedCloud = await saveLabTopologyToFirestore(copyRecord);
      } catch {
        syncedCloud = false;
      }
    }

    const storedCopy: SavedLabRecord = {
      ...copyRecord,
      syncStatus: syncedCloud ? 'cloud' : 'local'
    };
    await putSavedLabToIdb(storedCopy);
    setSavedLabs(prev => [storedCopy, ...prev]);
    flashBanner(`Duplicated project as "${storedCopy.title}"`);
  };

  const handleDeleteSavedLab = async (labId: string) => {
    await deleteSavedLabFromIdb(labId, ownerScopeId);
    if (isCloudAuthReady) {
      try {
        await deleteLabTopologyFromFirestore(labId);
      } catch {
        // Ignore remote deletion error when offline/rules pending; local IndexedDB removal succeeded
      }
    }
    setSavedLabs(prev => prev.filter(item => item.id !== labId));
    if (activeSavedLabId === labId) {
      setActiveSavedLabId(null);
    }
    if (recentlySavedProjectId === labId) {
      setRecentlySavedProjectId(null);
    }
    flashBanner('Deleted saved lab project');
  };

  const handleSyncLocalLabsToCloud = async () => {
    if (!isCloudAuthReady) return;
    const localOnly = savedLabs.filter(l => l.userId === ownerScopeId && l.syncStatus !== 'cloud');
    if (localOnly.length === 0) return;

    setIsSavingLab(true);
    let count = 0;
    try {
      for (const item of localOnly) {
        try {
          const ok = await saveLabTopologyToFirestore(item);
          if (ok) {
            count += 1;
            await putSavedLabToIdb({ ...item, syncStatus: 'cloud' });
          }
        } catch {
          // Continue syncing remaining items
        }
      }
      const updated = await listSavedLabsFromIdb(ownerScopeId);
      setSavedLabs(updated);
      if (count > 0) {
        flashBanner(`Synced ${count} saved lab${count > 1 ? 's' : ''} to Firestore`);
      } else {
        flashBanner('Could not sync to Firestore yet — projects remain safely stored in IndexedDB');
      }
    } finally {
      setIsSavingLab(false);
    }
  };

  // Port picker modal data when cabling
  const portPickerDevice = useMemo(() => {
    if (tool !== 'cable' || cableToolMode === 'auto') return null;
    if (pendingCableTarget) {
      return {
        role: 'destination' as const,
        device: devices.find(d => d.id === pendingCableTarget.deviceId) || null
      };
    }
    if (pendingCableSource && !pendingCableSource.portName) {
      return {
        role: 'source' as const,
        device: devices.find(d => d.id === pendingCableSource.deviceId) || null
      };
    }
    return null;
  }, [devices, pendingCableSource, pendingCableTarget, tool]);

  // Compute animated packet coordinates
  const activePacketPos = useMemo(() => {
    if (animStepIndex === null || !lastPingResult) return null;
    const hop = lastPingResult.hops[animStepIndex];
    if (!hop) return null;
    const dev = devices.find(d => d.id === hop.deviceId);
    if (!dev) return null;
    return { x: dev.x, y: dev.y, status: hop.status };
  }, [animStepIndex, devices, lastPingResult]);

  // Assignable target IPs for quick ping dropdown/suggestions
  const knownDeviceIps = useMemo(() => {
    const items: Array<{ label: string; ip: string }> = [];
    devices.forEach(d => {
      d.interfaces.forEach(i => {
        if (isValidIp(i.ip)) {
          items.push({ label: `${d.name} (${i.shortName})`, ip: i.ip });
        }
      });
    });
    return items;
  }, [devices]);

  const selectedGroupBounds = useMemo(() => {
    if ((tool !== 'select' && tool !== 'marquee') || selectedDeviceIds.length < 2) return null;
    const selectedSet = new Set(selectedDeviceIds);
    const items = devices.filter(d => selectedSet.has(d.id));
    if (items.length < 2) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    items.forEach(d => {
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    });
    return {
      ids: items.map(d => d.id),
      pivotX: (minX + maxX) / 2,
      pivotY: (minY + maxY) / 2,
      left: Math.max(8, minX - 48),
      right: Math.min(canvasSize.width - 8, maxX + 48),
      top: Math.max(8, minY - 46),
      bottom: Math.min(canvasSize.height - 8, maxY + 52)
    };
  }, [canvasSize.height, canvasSize.width, devices, selectedDeviceIds, tool]);

  const hasRotatedSelection = useMemo(() => {
    if (selectedDeviceIds.length === 0) return false;
    const selectedSet = new Set(selectedDeviceIds);
    return devices.some(d => selectedSet.has(d.id) && (d.rotation || 0) !== 0);
  }, [devices, selectedDeviceIds]);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Header & Preset Selector */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-blue-600 dark:text-cyan-400">
              Hands-on Network Simulator
            </span>
            <span aria-hidden="true">·</span>
            <span>{activePreset.difficulty}</span>
            {objectiveProgress.totalCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                  {objectiveProgress.passedCount}/{objectiveProgress.totalCount} objectives passed
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {isCloudAuthReady ? (
                <Cloud className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {lastAutoSavedAt
                  ? `Draft auto-saved (${isCloudAuthReady ? 'IndexedDB + Cloud Save' : 'IndexedDB'})`
                  : 'IndexedDB Ready'}
              </span>
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Network Topology &amp; Cisco Lab Simulator
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-4xl">
            {activePreset.description}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 min-w-0">
          {workspaceView === 'editor' ? (
            <>
              <select
                aria-label="Select Lab Scenario"
                value={activePresetId}
                onChange={(e) => {
                  setActiveSavedLabId(null);
                  handleSelectPreset(e.target.value);
                }}
                className="w-full sm:w-auto sm:max-w-[280px] min-w-0 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
              >
                <optgroup label="Free Build">
                  {NETWORK_LAB_PRESETS.filter(p => p.id === 'blank-sandbox').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.difficulty})
                    </option>
                  ))}
                </optgroup>
                {TEMPLATE_CATEGORIES.map(cat => (
                  <optgroup key={cat} label={cat}>
                    {NETWORK_LAB_PRESETS.filter(p => p.category === cat).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.difficulty})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsTemplatesModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-blue-500 hover:bg-blue-50/60 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>Templates ({templateLibraryItems.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const activeRecord = savedLabs.find(l => l.id === activeSavedLabId);
                  setSaveMode('save');
                  setSaveStatusInput(activeRecord?.status === 'completed' ? 'completed' : 'in_progress');
                  setSaveTitleInput(
                    activeRecord?.title ||
                      (activePresetId === 'blank-sandbox'
                        ? `Network Lab Project (${new Date().toLocaleDateString()})`
                        : `${activePreset.title} - Progress`)
                  );
                  setIsSavePromptOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Progress</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const activeRecord = savedLabs.find(l => l.id === activeSavedLabId);
                  setSaveMode('save_and_close');
                  setSaveStatusInput('completed');
                  setSaveTitleInput(
                    activeRecord?.title ||
                      (activePresetId === 'blank-sandbox'
                        ? `Completed Network Lab (${new Date().toLocaleDateString()})`
                        : `${activePreset.title} - Completed`)
                  );
                  setIsSavePromptOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Save &amp; Close Project</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSavePromptOpen(false);
                  setWorkspaceView('projects');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>My Lab Projects ({savedLabs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSavedLabId(null);
                  handleSelectPreset(activePresetId);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                title="Reset current canvas"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </>
          ) : (
            <>
              {(devices.length > 0 || activeSavedLabId !== null) && (
                <button
                  type="button"
                  onClick={() => setWorkspaceView('editor')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Open Lab</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsTemplatesModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>Templates ({templateLibraryItems.length})</span>
              </button>

              <button
                type="button"
                onClick={handleStartNewBlankLab}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start New Blank Lab</span>
              </button>
            </>
          )}

          {/* Unified Import / Export Dropdown Menu */}
          <div ref={importExportMenuRef} className="relative shrink-0">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={isImportExportMenuOpen}
              onClick={() => setIsImportExportMenuOpen(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                isImportExportMenuOpen
                  ? 'border-blue-500 bg-blue-50/70 dark:bg-slate-800 text-blue-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Import or export network topology files"
            >
              <FileCode2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>{isExportingImage ? 'Exporting PNG...' : 'Import / Export'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                  isImportExportMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isImportExportMenuOpen && (
              <div
                role="menu"
                aria-label="Import and export topology options"
                className="absolute left-0 mt-1.5 w-60 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-50"
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Import
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsImportExportMenuOpen(false);
                    importInputRef.current?.click();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Upload className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="truncate">Import JSON</div>
                    <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate">
                      Load .netlab.json or .json
                    </div>
                  </div>
                </button>

                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Export Current Lab
                </div>
                {(() => {
                  const hasCanvasContent =
                    devices.length > 0 || shapes.length > 0 || diagramLabels.length > 0;
                  return (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!hasCanvasContent}
                        onClick={() => {
                          setIsImportExportMenuOpen(false);
                          handleExportTopology();
                        }}
                        className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors"
                      >
                        <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate">Export JSON</div>
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate">
                            Save topology &amp; CLI config
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        disabled={!hasCanvasContent || isExportingImage}
                        onClick={() => {
                          setIsImportExportMenuOpen(false);
                          handleExportImage('png');
                        }}
                        className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors"
                      >
                        <ImageIcon className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate">
                            {isExportingImage ? 'Exporting PNG...' : 'Export PNG'}
                          </div>
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate">
                            High-res diagram (2000×1380)
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        disabled={!hasCanvasContent}
                        onClick={() => {
                          setIsImportExportMenuOpen(false);
                          handleExportImage('svg');
                        }}
                        className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors"
                      >
                        <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate">Export SVG</div>
                          <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 truncate">
                            Scalable vector diagram
                          </div>
                        </div>
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,.netlab.json,application/json"
            onChange={handleImportTopology}
            className="hidden"
          />
        </div>
      </div>

      {/* Inline Save / Save & Close Lab Project Bar */}
      {isSavePromptOpen && workspaceView === 'editor' && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <FileCode2 className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <label className="sr-only" htmlFor="save-project-title">
                  Lab Project File Name
                </label>
                <input
                  id="save-project-title"
                  type="text"
                  value={saveTitleInput}
                  onChange={(e) => setSaveTitleInput(e.target.value)}
                  maxLength={120}
                  placeholder="Enter lab project name (e.g. Branch Office Dual-Router Topology)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div
                role="group"
                aria-label="Project completion status"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  onClick={() => setSaveStatusInput('completed')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    saveStatusInput === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => setSaveStatusInput('in_progress')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    saveStatusInput === 'in_progress'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  In Progress
                </button>
              </div>

              {saveMode === 'save_and_close' ? (
                <button
                  type="button"
                  disabled={isSavingLab}
                  onClick={() => handleSaveTopologySnapshot(false, true)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  {isSavingLab ? 'Saving & Closing...' : 'Confirm Save & Close'}
                </button>
              ) : (
                <>
                  {activeSavedLabId && (
                    <button
                      type="button"
                      disabled={isSavingLab}
                      onClick={() => handleSaveTopologySnapshot(false, false)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                    >
                      {isSavingLab ? 'Saving...' : 'Update Project'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isSavingLab}
                    onClick={() => handleSaveTopologySnapshot(true, false)}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    {isSavingLab ? 'Saving...' : activeSavedLabId ? 'Save as New' : 'Save Project'}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingLab}
                    onClick={() => handleSaveTopologySnapshot(false, true)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    {isSavingLab ? 'Closing...' : 'Save & Close'}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsSavePromptOpen(false)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            Project file: {toProjectFileName(saveTitleInput || activePreset.title)} · Saved to My Lab Projects (
            {isCloudAuthReady ? 'Firestore + IndexedDB' : 'IndexedDB Local'})
          </p>
        </div>
      )}

      {/* Feedback Banner */}
      {statusBanner && (
        <div
          role={statusBannerTone === 'error' ? 'alert' : 'status'}
          className={`px-4 py-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            statusBannerTone === 'error'
              ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-cyan-200'
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {statusBannerTone === 'error' && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>{statusBanner}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className={`font-semibold hover:underline shrink-0 ${
              statusBannerTone === 'error'
                ? 'text-red-700 dark:text-red-300'
                : 'text-blue-600 dark:text-cyan-300'
            }`}
          >
            Dismiss
          </button>
        </div>
      )}

      {workspaceView === 'editor' ? (
        <div
          className={
            isWorkspaceFullscreen
              ? 'fixed inset-0 z-40 bg-slate-100 dark:bg-slate-950 p-2.5 sm:p-4 flex flex-col gap-2.5 overflow-hidden'
              : 'space-y-4 w-full min-w-0'
          }
        >
          {/* Design Palette & Cabling Toolbar */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Icon-Only Device Palette + Un-Collapsed Cable Symbols + Group Zones & Label */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div
            role="group"
            aria-label="Network devices and cables"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            {/* Device Symbols (Drag onto canvas or click to add) */}
            {(
              [
                { type: 'router' as const, label: 'Router', iconClass: 'w-8 h-6' },
                { type: 'switch' as const, label: 'Switch', iconClass: 'w-8 h-6' },
                { type: 'pc' as const, label: 'Workstation', iconClass: 'w-8 h-6' },
                { type: 'server' as const, label: 'Server', iconClass: 'w-7 h-6' }
              ] as const
            ).map(item => (
              <button
                key={item.type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-netlab-device', item.type);
                  e.dataTransfer.setData('text/plain', item.type);
                  e.dataTransfer.effectAllowed = 'copy';
                  draggedPaletteTypeRef.current = item.type;
                }}
                onDragEnd={() => {
                  draggedPaletteTypeRef.current = null;
                  setPaletteDropPreview(null);
                }}
                onClick={() => handleAddDevice(item.type)}
                title={`Drag onto workspace or click to add ${item.label}`}
                aria-label={`Add ${item.label}`}
                className="relative inline-flex items-center justify-center w-11 h-9 rounded-lg bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-700/90 shadow-xs hover:shadow-sm hover:border-sky-400 dark:hover:border-cyan-400 hover:bg-sky-50/70 dark:hover:bg-sky-950/60 hover:-translate-y-0.5 cursor-grab active:cursor-grabbing transition-all shrink-0"
              >
                <CiscoDeviceIcon type={item.type} className={item.iconClass} />
              </button>
            ))}

            <span className="h-5 w-px bg-slate-300 dark:bg-slate-600 mx-0.5" aria-hidden="true" />

            {/* Un-collapsed Cable Symbols (Packet Tracer style) */}
            {(
              [
                {
                  mode: 'auto' as const,
                  title: 'Automatically Choose Connection Type',
                  renderIcon: () => (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path
                        d="M13.5 3L6.5 13h5l-1 8 7-10h-5l1-8z"
                        fill="#facc15"
                        stroke="#ef4444"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )
                },
                {
                  mode: 'straight' as const,
                  title: 'Copper Straight-Through (Switch ↔ Router, PC, Server)',
                  renderIcon: () => (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <line
                        x1="5"
                        y1="19"
                        x2="19"
                        y2="5"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )
                },
                {
                  mode: 'crossover' as const,
                  title: 'Copper Crossover (Router ↔ Router, Switch ↔ Switch, PC ↔ Router)',
                  renderIcon: () => (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <line
                        x1="5"
                        y1="19"
                        x2="19"
                        y2="5"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeDasharray="3.5 4.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )
                },
                {
                  mode: 'fiber' as const,
                  title: 'Optical Fiber (Fiber SFP / Gig ports)',
                  renderIcon: () => (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <line
                        x1="5"
                        y1="19"
                        x2="19"
                        y2="5"
                        stroke="#f97316"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  )
                },
                {
                  mode: 'serial' as const,
                  title: 'Serial DCE/DTE WAN (Router Serial0/0/x ↔ Serial0/0/x)',
                  renderIcon: () => (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                      <path
                        d="M5 18l5-6-3-2 7-5-2 6 3 2-5 5"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )
                }
              ] as const
            ).map(item => {
              const isActive = tool === 'cable' && cableToolMode === item.mode;
              return (
                <button
                  key={item.mode}
                  type="button"
                  aria-label={item.title}
                  aria-pressed={isActive}
                  title={item.title}
                  onClick={() => {
                    if (isActive) {
                      setTool('select');
                    } else {
                      setTool('cable');
                      setCableToolMode(item.mode);
                      if (item.mode !== 'auto') {
                        setSelectedCableType(item.mode);
                      }
                    }
                    setPendingCableSource(null);
                    setPendingCableTarget(null);
                    clearLiveCableDraw();
                  }}
                  className={`inline-flex items-center justify-center w-10 h-9 rounded-lg border transition-colors shrink-0 ${
                    isActive
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm ring-2 ring-blue-500/30'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:border-blue-400 dark:hover:border-cyan-400 hover:bg-blue-50/70 dark:hover:bg-slate-800'
                  }`}
                >
                  {item.renderIcon()}
                </button>
              );
            })}
          </div>

          <div
            role="group"
            aria-label="Group zones and diagram labels"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0"
          >
            <button
              type="button"
              onClick={() => handleAddShape('rectangle')}
              aria-label="Add Rectangle Group Zone"
              title="Add Rectangle Group Zone (auto-wraps selected devices)"
              className="inline-flex items-center justify-center w-10 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-violet-600 dark:text-violet-400 hover:border-violet-400 dark:hover:border-violet-400 hover:bg-violet-50/70 dark:hover:bg-violet-950/50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Square className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => handleAddShape('circle')}
              aria-label="Add Circle Group Zone"
              title="Add Circle / Oval Group Zone (auto-wraps selected devices)"
              className="inline-flex items-center justify-center w-10 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-teal-600 dark:text-teal-400 hover:border-teal-400 dark:hover:border-teal-400 hover:bg-teal-50/70 dark:hover:bg-teal-950/50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Circle className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={handleAddDiagramLabel}
              aria-label="Add Diagram Text Label"
              title="Add Movable Text Label (e.g. OSPF, VLAN 10, 10.0.0.0/24)"
              className="inline-flex items-center justify-center w-10 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-amber-600 dark:text-amber-400 hover:border-amber-400 dark:hover:border-amber-400 hover:bg-amber-50/70 dark:hover:bg-amber-950/50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <Type className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Canvas Tools & Auto-Layout */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div
            role="group"
            aria-label="Canvas interaction tools"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-full"
          >
            <button
              type="button"
              aria-label="Select and Move"
              aria-pressed={tool === 'select'}
              title="Select & Move (Click: select, Drag: move, Double-click: console)"
              onClick={() => {
                setTool('select');
                setPendingCableSource(null);
                setPendingCableTarget(null);
                clearLiveCableDraw();
              }}
              className={`inline-flex items-center justify-center w-10 h-9 rounded-lg border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                tool === 'select'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-sm ring-2 ring-blue-500/25'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-cyan-400 hover:bg-blue-50/70 dark:hover:bg-slate-800'
              }`}
            >
              <MousePointer2 className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label="Marquee Select"
              aria-pressed={tool === 'marquee'}
              title="Marquee Select (Drag a box to select multiple devices; hold Shift to add)"
              onClick={() => {
                setTool('marquee');
                setPendingCableSource(null);
                setPendingCableTarget(null);
                clearLiveCableDraw();
              }}
              className={`inline-flex items-center justify-center w-10 h-9 rounded-lg border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                tool === 'marquee'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-sm ring-2 ring-blue-500/25'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-cyan-400 hover:bg-blue-50/70 dark:hover:bg-slate-800'
              }`}
            >
              <SquareDashedMousePointer className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label="Pan Canvas"
              aria-pressed={tool === 'pan'}
              title="Pan Canvas (Drag to pan, or hold Space + drag / middle-mouse drag)"
              onClick={() => {
                setTool('pan');
                setPendingCableSource(null);
                setPendingCableTarget(null);
                clearLiveCableDraw();
              }}
              className={`inline-flex items-center justify-center w-10 h-9 rounded-lg border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                tool === 'pan'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-sm ring-2 ring-blue-500/25'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-cyan-400 hover:bg-blue-50/70 dark:hover:bg-slate-800'
              }`}
            >
              <Hand className="w-4 h-4" aria-hidden="true" />
            </button>

            <button
              type="button"
              aria-label="Remove Item"
              aria-pressed={tool === 'delete'}
              title="Remove Tool (Click any device, cable, group zone, or label to delete)"
              onClick={() => {
                setTool('delete');
                setPendingCableSource(null);
                setPendingCableTarget(null);
                clearLiveCableDraw();
              }}
              className={`inline-flex items-center justify-center w-10 h-9 rounded-lg border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                tool === 'delete'
                  ? 'bg-red-600 border-red-500 text-white shadow-sm ring-2 ring-red-500/25'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-red-400 hover:border-red-400 dark:hover:border-red-400 hover:bg-red-50/70 dark:hover:bg-red-950/40'
              }`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Grid, Snap-to-Grid & Simulator Settings */}
          <div ref={settingsMenuRef} className="relative inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              aria-pressed={showGrid}
              onClick={() => setShowGrid(prev => !prev)}
              title="Toggle background alignment grid visibility"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                showGrid
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/80 dark:ring-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-900/60'
              }`}
            >
              <Grid3x3 className={`w-3.5 h-3.5 ${showGrid ? 'text-blue-600 dark:text-cyan-400' : ''}`} />
              <span>Grid</span>
            </button>

            <button
              type="button"
              aria-pressed={snapToGrid}
              onClick={() => setSnapToGrid(prev => !prev)}
              title="Toggle Snap-to-Grid alignment while placing or dragging devices (hold Alt to temporarily bypass)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                snapToGrid
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Snap</span>
            </button>

            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={isSettingsOpen}
              onClick={() => setIsSettingsOpen(prev => !prev)}
              title="Simulator Grid, Snap & Display Settings"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                isSettingsOpen
                  ? 'bg-blue-50 dark:bg-slate-900 text-blue-700 dark:text-cyan-300 ring-1 ring-blue-300 dark:ring-cyan-700'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Settings</span>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
                  isSettingsOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isSettingsOpen && (
              <div
                role="dialog"
                aria-label="Simulator settings"
                className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-4 z-50 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <Settings className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      Workspace &amp; Grid Settings
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label="Close settings"
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Background Grid Visibility */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Background Grid
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Show coordinate grid behind topology
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showGrid}
                      aria-label="Toggle background grid"
                      onClick={() => setShowGrid(prev => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        showGrid ? 'bg-blue-600 dark:bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
                          showGrid ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Grid Style Selector */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Grid Pattern
                    </span>
                    <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {(['lines', 'dots'] as const).map(styleOpt => (
                        <button
                          key={styleOpt}
                          type="button"
                          onClick={() => {
                            setGridStyle(styleOpt);
                            if (!showGrid) setShowGrid(true);
                          }}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                            gridStyle === styleOpt && showGrid
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {styleOpt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-3">
                  {/* Snap to Grid Toggle */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        Snap to Grid
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Align placed &amp; dragged nodes (Alt bypasses)
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={snapToGrid}
                      aria-label="Toggle Snap to Grid"
                      onClick={() => setSnapToGrid(prev => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        snapToGrid ? 'bg-blue-600 dark:bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
                          snapToGrid ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Grid Spacing */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-600 dark:text-slate-300">
                        Grid Spacing
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {gridSize}px
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {GRID_STEP_OPTIONS.map(stepOpt => (
                        <button
                          key={stepOpt}
                          type="button"
                          onClick={() => setGridSize(stepOpt)}
                          className={`py-1 rounded-lg text-[11px] font-mono tabular-nums font-semibold transition-colors ${
                            gridSize === stepOpt
                              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {stepOpt}px
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Force Align Existing Devices */}
                  <div className="pt-1 space-y-1.5">
                    <button
                      type="button"
                      disabled={devices.length === 0}
                      onClick={() => handleAlignDevicesToGrid()}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-semibold transition-colors shadow-xs"
                    >
                      <Magnet className="w-3.5 h-3.5" />
                      <span>Align All Devices to Grid</span>
                    </button>
                    {devices.length > 0 && (
                      <div className="text-[11px] text-center text-slate-500 dark:text-slate-400 tabular-nums">
                        {offGridDeviceCount === 0
                          ? `All ${devices.length} device${devices.length === 1 ? '' : 's'} aligned to ${gridSize}px grid`
                          : `${offGridDeviceCount} of ${devices.length} device${devices.length === 1 ? '' : 's'} currently off-grid`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white">
                      Custom Node Labels
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {customLabelCount > 0
                        ? `${customLabelCount} custom label${customLabelCount === 1 ? '' : 's'} saved`
                        : 'Double-click any node label to rename'}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showCustomLabels}
                    aria-label="Toggle custom node labels"
                    onClick={() => setShowCustomLabels(prev => !prev)}
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      showCustomLabels
                        ? 'bg-blue-600 dark:bg-cyan-500'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
                        showCustomLabels ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <select
              aria-label="Auto-Layout Style"
              value={autoLayoutMode}
              onChange={(e) => {
                setAutoLayoutMode(e.target.value as AutoLayoutMode);
              }}
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="grid">Grid</option>
              <option value="circular">Circular</option>
            </select>

            <button
              type="button"
              disabled={devices.length === 0}
              onClick={() => handleAutoLayout()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-cyan-400 disabled:opacity-45 disabled:pointer-events-none shadow-sm transition-colors whitespace-nowrap shrink-0"
              title="Automatically arrange devices cleanly on the canvas"
            >
              <Grid3x3 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
              <span>Auto-Layout</span>
            </button>
          </div>

          <button
            type="button"
            aria-pressed={showCustomLabels}
            onClick={() => {
              setShowCustomLabels(prev => {
                const next = !prev;
                flashBanner(
                  next
                    ? 'Custom labels enabled — double-click any node label or press F2 to rename'
                    : 'Showing default device hostnames (custom labels hidden)'
                );
                return next;
              });
            }}
            title={
              showCustomLabels
                ? 'Custom Labels ON — click to switch nodes back to default hostnames'
                : 'Custom Labels OFF — click to display custom node labels'
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
              showCustomLabels
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Custom Labels{customLabelCount > 0 ? ` (${customLabelCount})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Full-Width Interactive Topology Workspace + Quick Ping Bar */}
      <div
        className={
          isWorkspaceFullscreen
            ? 'flex-1 min-h-0 flex flex-col gap-2.5 min-w-0'
            : 'space-y-4 w-full min-w-0'
        }
      >
          <div
            className={
              isWorkspaceFullscreen
                ? 'flex-1 min-h-0 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden'
                : 'rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden'
            }
          >
            {/* Canvas Info Strip */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300 min-w-0">
                <span className="font-semibold text-slate-900 dark:text-white">
                  Topology Workspace
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {devices.length} devices, {links.length} cables
                  {shapes.length > 0 ? `, ${shapes.length} zones` : ''}
                  {diagramLabels.length > 0 ? `, ${diagramLabels.length} labels` : ''}
                </span>
                {tool === 'select' && devices.length > 0 && selectedDeviceIds.length === 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Click: select · Hold: move · Double-click: console · Drag empty: marquee · Space+drag: pan
                    </span>
                  </>
                )}
                {tool === 'marquee' && selectedDeviceIds.length === 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[11px] font-medium text-blue-600 dark:text-cyan-400">
                      Drag rectangle anywhere to select multiple devices · Hold Shift to add
                    </span>
                  </>
                )}
                {tool === 'pan' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[11px] font-medium text-blue-600 dark:text-cyan-400">
                      Drag canvas to pan · Scroll mouse wheel to zoom
                    </span>
                  </>
                )}
                {(tool === 'select' || tool === 'marquee') && selectedDeviceIds.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-cyan-400">
                      {selectedDeviceIds.length} selected
                      {selectedDeviceIds.length === 1 && selectedDevice && (selectedDevice.rotation || 0) !== 0
                        ? ` (${selectedDevice.rotation}°)`
                        : ''}
                    </span>
                    {selectedDeviceIds.length === 1 && selectedDevice && (
                      <>
                        <button
                          type="button"
                          onClick={() => startCanvasLabelEdit(selectedDevice)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap"
                          title={
                            showCustomLabels
                              ? 'Set custom node label (F2 or double-click label on canvas)'
                              : 'Rename device hostname (F2 or double-click label on canvas)'
                          }
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Rename</span>
                        </button>
                        {selectedDevice.customLabel?.trim() && (
                          <>
                            <button
                              type="button"
                              aria-pressed={showCustomLabels && selectedDevice.useCustomLabel !== false}
                              onClick={() => toggleDeviceCustomLabel(selectedDevice.id)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                showCustomLabels && selectedDevice.useCustomLabel !== false
                                  ? 'bg-blue-50 dark:bg-cyan-950/50 border-blue-300 dark:border-cyan-700 text-blue-700 dark:text-cyan-300'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-500'
                              }`}
                              title="Toggle custom label vs. hostname for this node"
                            >
                              <Tag className="w-3 h-3" />
                              <span>
                                {showCustomLabels && selectedDevice.useCustomLabel !== false
                                  ? 'Custom: On'
                                  : 'Custom: Off'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => clearDeviceCustomLabel(selectedDevice.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap"
                              title="Clear custom label and revert to default hostname"
                            >
                              <X className="w-3 h-3" />
                              <span>Reset Name</span>
                            </button>
                          </>
                        )}
                        {((selectedDevice.labelOffsetX || 0) !== 0 ||
                          (selectedDevice.labelOffsetY || 0) !== 0) && (
                          <button
                            type="button"
                            onClick={() =>
                              setDevices(prev =>
                                prev.map(d =>
                                  d.id === selectedDevice.id
                                    ? { ...d, labelOffsetX: 0, labelOffsetY: 0 }
                                    : d
                                )
                              )
                            }
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap"
                            title="Snap device label back underneath the device icon"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Label</span>
                          </button>
                        )}
                      </>
                    )}
                    {hasRotatedSelection && (
                      <button
                        type="button"
                        onClick={() => handleResetRotation(selectedDeviceIds)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap"
                        title="Reset orientation to 0°"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset 0°</span>
                      </button>
                    )}
                    {selectedDeviceIds.length < devices.length && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDeviceIds(devices.map(d => d.id));
                          setSelectedDeviceId(prev => prev || devices[0]?.id || null);
                          setSelectedLinkId(null);
                        }}
                        className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap"
                      >
                        Select All
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDeleteSelectedDevices}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold transition-colors whitespace-nowrap tabular-nums"
                      title="Delete all selected devices and attached cables (Delete key)"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>
                        Delete Selected{selectedDeviceIds.length > 1 ? ` (${selectedDeviceIds.length})` : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDeviceIds([]);
                        setSelectedDeviceId(null);
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 whitespace-nowrap"
                    >
                      Clear
                    </button>
                  </>
                )}
                {tool === 'cable' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-blue-600 dark:text-cyan-400 font-medium truncate">
                      {liveCableDraw
                        ? liveCableDraw.snapTarget
                          ? `Magnetic snap: ${devices.find(d => d.id === liveCableDraw.fromDeviceId)?.name} (${liveCableDraw.fromShortName}) ↔ ${liveCableDraw.snapTarget.deviceName} (${liveCableDraw.snapTarget.shortName}) · ${CABLE_META[liveCableDraw.snapTarget.cableType].short}`
                          : `Drawing ${cableToolMode === 'auto' ? 'Auto' : CABLE_META[selectedCableType].short} from ${devices.find(d => d.id === liveCableDraw.fromDeviceId)?.name} (${liveCableDraw.fromShortName}) — aim near target port or device to snap`
                        : `Magnetic Cable (${cableToolMode === 'auto' ? 'Auto-Choose' : CABLE_META[selectedCableType].short}): drag or click from a device/port to another to snap & anchor`}
                    </span>
                  </>
                )}
                {tool === 'delete' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Click any device, cable, zone, or label to remove it
                    </span>
                  </>
                )}
              </div>

              {/* Cable Legend, Workspace Size & Fullscreen Controls */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-sky-600 inline-block" /> Straight
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 border-b-2 border-dashed border-sky-400 inline-block" /> Crossover
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-amber-500 inline-block" /> Fiber
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-3 h-0.5 border-b-2 border-dotted border-red-500 inline-block" /> Serial
                  </span>
                </div>

                {isWorkspaceFullscreen && objectiveProgress.totalCount > 0 && (
                  <span className="hidden md:inline-flex items-center font-mono tabular-nums text-[11px] font-semibold text-blue-600 dark:text-cyan-400">
                    {objectiveProgress.passedCount}/{objectiveProgress.totalCount} goals
                  </span>
                )}

                <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shrink-0">
                  <select
                    aria-label="Workspace canvas size"
                    title="Choose logical workspace dimensions for small or large topologies"
                    value={
                      WORKSPACE_SIZE_PRESETS.some(
                        p => p.width === canvasSize.width && p.height === canvasSize.height
                      )
                        ? `${canvasSize.width}x${canvasSize.height}`
                        : 'custom'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') return;
                      const [wStr, hStr] = val.split('x');
                      const w = Number(wStr);
                      const h = Number(hStr);
                      if (Number.isFinite(w) && Number.isFinite(h)) {
                        handleChangeWorkspaceSize(w, h);
                      }
                    }}
                    className="px-2 py-1 bg-transparent text-[11px] font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
                  >
                    {WORKSPACE_SIZE_PRESETS.map(p => (
                      <option key={p.id} value={`${p.width}x${p.height}`}>
                        {p.width}×{p.height} ({p.label})
                      </option>
                    ))}
                    {!WORKSPACE_SIZE_PRESETS.some(
                      p => p.width === canvasSize.width && p.height === canvasSize.height
                    ) && (
                      <option value="custom">
                        {canvasSize.width}×{canvasSize.height} (Expanded)
                      </option>
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={handleExpandWorkspace}
                    disabled={
                      canvasSize.width >= MAX_LAB_CANVAS_WIDTH &&
                      canvasSize.height >= MAX_LAB_CANVAS_HEIGHT
                    }
                    title="Expand workspace canvas (+500×290) without shrinking icons"
                    aria-label="Expand workspace canvas"
                    className="inline-flex items-center gap-1 px-2 py-1 border-l border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:bg-blue-50 dark:hover:bg-slate-700/70 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Expand</span>
                  </button>
                </div>

                <button
                  type="button"
                  aria-label={isWorkspaceFullscreen ? 'Minimize workspace' : 'Maximize workspace to fullscreen'}
                  title={isWorkspaceFullscreen ? 'Minimize workspace (Esc)' : 'Maximize workspace to fullscreen'}
                  onClick={() => setIsWorkspaceFullscreen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap shrink-0"
                >
                  {isWorkspaceFullscreen ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>Minimize</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                      <span>Fullscreen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Interactive Viewport & Zoom/Pan Blueprint Stage */}
            <div
              ref={viewportRef}
              onAuxClick={(e) => {
                if (e.button === 1) e.preventDefault();
              }}
              onDragOver={(e) => {
                const transferType = e.dataTransfer.getData('application/x-netlab-device') as SimDeviceType;
                const activeType = draggedPaletteTypeRef.current || transferType;
                if (
                  activeType === 'router' ||
                  activeType === 'switch' ||
                  activeType === 'pc' ||
                  activeType === 'server'
                ) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setIsJsonFileDragOver(false);
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  if (rect.width <= 0 || rect.height <= 0) return;
                  const rawX = ((e.clientX - rect.left) / rect.width) * canvasSize.width;
                  const rawY = ((e.clientY - rect.top) / rect.height) * canvasSize.height;
                  const x = snapClampedToGrid(rawX, 60, canvasSize.width - 60, gridSize, snapToGrid);
                  const y = snapClampedToGrid(rawY, 60, canvasSize.height - 60, gridSize, snapToGrid);
                  setPaletteDropPreview(prev =>
                    prev && prev.type === activeType && prev.x === x && prev.y === y
                      ? prev
                      : { type: activeType, x, y }
                  );
                  return;
                }

                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                  setIsJsonFileDragOver(true);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setPaletteDropPreview(null);
                  setIsJsonFileDragOver(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsJsonFileDragOver(false);
                if (
                  !draggedPaletteTypeRef.current &&
                  e.dataTransfer.files &&
                  e.dataTransfer.files.length > 0
                ) {
                  importTopologyFile(e.dataTransfer.files[0]);
                  return;
                }
                const transferType = (e.dataTransfer.getData('application/x-netlab-device') ||
                  e.dataTransfer.getData('text/plain')) as SimDeviceType;
                const dropType = draggedPaletteTypeRef.current || transferType;
                draggedPaletteTypeRef.current = null;
                setPaletteDropPreview(null);
                if (
                  dropType !== 'router' &&
                  dropType !== 'switch' &&
                  dropType !== 'pc' &&
                  dropType !== 'server'
                ) {
                  return;
                }
                const canvas = canvasRef.current;
                if (!canvas) {
                  handleAddDevice(dropType);
                  return;
                }
                const rect = canvas.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) {
                  handleAddDevice(dropType);
                  return;
                }
                const rawX = ((e.clientX - rect.left) / rect.width) * canvasSize.width;
                const rawY = ((e.clientY - rect.top) / rect.height) * canvasSize.height;
                handleAddDevice(dropType, rawX, rawY);
              }}
              onPointerDownCapture={(e) => {
                const targetEl = e.target as HTMLElement | null;
                if (
                  targetEl?.closest('[data-zoom-hud="true"]') ||
                  targetEl?.closest('[data-minimap-hud="true"]') ||
                  targetEl?.closest('[data-console-overlay="true"]')
                ) {
                  return;
                }
                const shouldStartPan =
                  e.button === 1 ||
                  (e.button === 0 && (tool === 'pan' || isSpacePanningRef.current));
                if (shouldStartPan) {
                  e.stopPropagation();
                  e.preventDefault();
                  panStateRef.current = {
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    initPanX: panRef.current.x,
                    initPanY: panRef.current.y,
                    moved: false
                  };
                  setIsPanningActive(true);
                  return;
                }

                if (tool === 'marquee' && e.button === 0) {
                  if (
                    targetEl?.closest('[data-group-move="true"]') ||
                    targetEl?.closest('[data-group-rotate="true"]')
                  ) {
                    return;
                  }
                  const devEl = targetEl?.closest('[data-device-id]') as HTMLElement | null;
                  const devId = devEl?.getAttribute('data-device-id');
                  const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
                  if (devId && !isModifier && selectedDeviceIds.includes(devId)) {
                    startGroupDrag(e, devId);
                    return;
                  }

                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  if (rect.width <= 0 || rect.height <= 0) return;

                  e.stopPropagation();
                  e.preventDefault();
                  const startCanvasX = Math.min(
                    canvasSize.width,
                    Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasSize.width)
                  );
                  const startCanvasY = Math.min(
                    canvasSize.height,
                    Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasSize.height)
                  );

                  marqueeStateRef.current = {
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startCanvasX,
                    startCanvasY,
                    additive: isModifier,
                    initialSelectedIds: selectedDeviceIds,
                    moved: false
                  };
                }
              }}
              onPointerDown={(e) => {
                if (tool === 'cable' && e.button === 0 && !isSpacePanningRef.current && liveCableDrawRef.current) {
                  const isStageClick =
                    e.target === viewportRef.current ||
                    e.target === stageBoxRef.current ||
                    e.target === canvasRef.current;
                  if (isStageClick) {
                    clearLiveCableDraw();
                    suppressCanvasClickRef.current = true;
                  }
                  return;
                }
                if (tool !== 'select' || isSpacePanningRef.current || e.button !== 0) return;
                if (
                  e.target !== viewportRef.current &&
                  e.target !== stageBoxRef.current &&
                  e.target !== canvasRef.current
                ) {
                  return;
                }
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;

                const startCanvasX = Math.min(
                  canvasSize.width,
                  Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasSize.width)
                );
                const startCanvasY = Math.min(
                  canvasSize.height,
                  Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasSize.height)
                );

                marqueeStateRef.current = {
                  startClientX: e.clientX,
                  startClientY: e.clientY,
                  startCanvasX,
                  startCanvasY,
                  additive: e.ctrlKey || e.metaKey || e.shiftKey,
                  initialSelectedIds: selectedDeviceIds,
                  moved: false
                };
              }}
              onClick={(e) => {
                if (suppressCanvasClickRef.current) {
                  suppressCanvasClickRef.current = false;
                  return;
                }
                if (tool === 'pan') return;
                const clickedStage =
                  e.target === viewportRef.current ||
                  e.target === stageBoxRef.current ||
                  e.target === canvasRef.current;
                if (clickedStage || (tool === 'marquee' && !(e.target as HTMLElement | null)?.closest('[data-device-id]'))) {
                  setSelectedLinkId(null);
                  setSelectedShapeId(null);
                  setSelectedDiagramLabelId(null);
                  if ((tool === 'select' || tool === 'marquee') && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
                    setSelectedDeviceIds([]);
                    setSelectedDeviceId(null);
                  }
                }
              }}
              style={{ containerType: 'size' }}
              className={`relative bg-slate-100/80 dark:bg-[#050914] select-none overflow-hidden flex items-center justify-center ${
                isWorkspaceFullscreen
                  ? 'flex-1 min-h-0 w-full'
                  : 'w-full h-[clamp(420px,64vh,680px)] min-h-[340px]'
              } ${
                isPanningActive
                  ? 'cursor-grabbing'
                  : tool === 'pan' || isSpacePanning
                  ? 'cursor-grab'
                  : tool === 'marquee' || tool === 'cable'
                  ? 'cursor-crosshair'
                  : ''
              }`}
            >
              <div
                ref={stageBoxRef}
                style={{ width: 'min(100cqw, calc(100cqh * 1000 / 580))' }}
                className="relative aspect-[1000/580] shrink-0"
              >
              <div
                ref={canvasRef}
                style={{
                  width: `${(canvasSize.width / DEFAULT_LAB_CANVAS_WIDTH) * 100}%`,
                  height: `${(canvasSize.height / DEFAULT_LAB_CANVAS_HEIGHT) * 100}%`,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0'
                }}
                className="relative bg-slate-50 dark:bg-[#090f1d] shadow-xs ring-1 ring-slate-200/70 dark:ring-slate-800/70"
              >
              {/* True-Coordinate Logical SVG Grid Backdrop */}
              {(showGrid || activeSnapGuides?.x !== undefined || activeSnapGuides?.y !== undefined) && (
                <svg
                  viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                  className="absolute inset-0 w-full h-full pointer-events-none z-0"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {showGrid && (
                    <>
                      <defs>
                        <pattern
                          id="sim-snap-grid-pattern"
                          x={gridStyle === 'dots' ? -1 : 0}
                          y={gridStyle === 'dots' ? -1 : 0}
                          width={gridSize}
                          height={gridSize}
                          patternUnits="userSpaceOnUse"
                        >
                          {gridStyle === 'lines' ? (
                            <path
                              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                              fill="none"
                              stroke="rgba(148,163,184,0.22)"
                              strokeWidth="0.7"
                            />
                          ) : (
                            <circle
                              cx={1}
                              cy={1}
                              r="1.15"
                              fill="rgba(148,163,184,0.36)"
                            />
                          )}
                        </pattern>
                        {gridStyle === 'lines' && (
                          <pattern
                            id="sim-snap-grid-major-pattern"
                            width={gridSize * 5}
                            height={gridSize * 5}
                            patternUnits="userSpaceOnUse"
                          >
                            <path
                              d={`M ${gridSize * 5} 0 L 0 0 0 ${gridSize * 5}`}
                              fill="none"
                              stroke="rgba(100,116,139,0.24)"
                              strokeWidth="0.95"
                            />
                          </pattern>
                        )}
                      </defs>
                      <rect
                        width={canvasSize.width}
                        height={canvasSize.height}
                        fill="url(#sim-snap-grid-pattern)"
                      />
                      {gridStyle === 'lines' && (
                        <rect
                          width={canvasSize.width}
                          height={canvasSize.height}
                          fill="url(#sim-snap-grid-major-pattern)"
                        />
                      )}
                    </>
                  )}
                  {activeSnapGuides?.x !== undefined && (
                    <line
                      x1={activeSnapGuides.x}
                      y1={0}
                      x2={activeSnapGuides.x}
                      y2={canvasSize.height}
                      stroke="#0ea5e9"
                      strokeWidth={1.1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.75}
                    />
                  )}
                  {activeSnapGuides?.y !== undefined && (
                    <line
                      x1={0}
                      y1={activeSnapGuides.y}
                      x2={canvasSize.width}
                      y2={activeSnapGuides.y}
                      stroke="#0ea5e9"
                      strokeWidth={1.1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.75}
                    />
                  )}
                </svg>
              )}
              {/* SVG Grouping Shapes Layer (Rendered Behind Cables & Devices) */}
              {shapes.length > 0 && (
                <svg
                  viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                  className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
                  preserveAspectRatio="none"
                >
                  {shapes.map(shape => {
                    const isShapeSelected = selectedShapeId === shape.id;
                    const isFillNone =
                      !shape.fillColor ||
                      shape.fillColor === 'transparent' ||
                      shape.fillColor === 'none';
                    const dash =
                      shape.lineStyle === 'dashed'
                        ? '7 5'
                        : shape.lineStyle === 'dotted'
                        ? '2.5 4.5'
                        : undefined;
                    const strokeW = shape.borderWidth || 2;
                    const labelText = shape.label?.trim();
                    const labelColor = shape.labelColor || shape.borderColor || '#64748b';

                    const handleShapePointerDown = (e: React.PointerEvent) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();

                      if (tool === 'delete') {
                        handleDeleteShape(shape.id);
                        return;
                      }
                      if (tool !== 'select') return;

                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const rect = canvas.getBoundingClientRect();
                      if (rect.width <= 0 || rect.height <= 0) return;

                      const startCanvasX = Math.min(
                        canvasSize.width,
                        Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasSize.width)
                      );
                      const startCanvasY = Math.min(
                        canvasSize.height,
                        Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasSize.height)
                      );

                      setSelectedShapeId(shape.id);
                      setSelectedDeviceIds([]);
                      setSelectedDeviceId(null);
                      setSelectedLinkId(null);
                      setSelectedDiagramLabelId(null);

                      shapeDragStateRef.current = {
                        shapeId: shape.id,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        startCanvasX,
                        startCanvasY,
                        initX: shape.x,
                        initY: shape.y,
                        width: shape.width,
                        height: shape.height,
                        moved: false
                      };
                    };

                    return (
                      <g key={shape.id}>
                        {shape.kind === 'circle' ? (
                          <>
                            <ellipse
                              cx={shape.x + shape.width / 2}
                              cy={shape.y + shape.height / 2}
                              rx={shape.width / 2}
                              ry={shape.height / 2}
                              fill={isFillNone ? 'none' : shape.fillColor}
                              fillOpacity={isFillNone ? 0 : shape.fillOpacity}
                              stroke={isShapeSelected ? '#2563eb' : shape.borderColor}
                              strokeWidth={isShapeSelected ? Math.max(strokeW, 2.5) : strokeW}
                              strokeDasharray={dash}
                              className={
                                isFillNone && tool !== 'delete'
                                  ? 'pointer-events-none'
                                  : 'pointer-events-auto cursor-move'
                              }
                              onPointerDown={handleShapePointerDown}
                              onClick={(e) => e.stopPropagation()}
                            />
                            {/* Wide stroke hit area so outline-only shapes are always easy to select & drag */}
                            <ellipse
                              cx={shape.x + shape.width / 2}
                              cy={shape.y + shape.height / 2}
                              rx={shape.width / 2}
                              ry={shape.height / 2}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={14}
                              className="pointer-events-auto cursor-move"
                              onPointerDown={handleShapePointerDown}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        ) : (
                          <>
                            <rect
                              x={shape.x}
                              y={shape.y}
                              width={shape.width}
                              height={shape.height}
                              rx={14}
                              fill={isFillNone ? 'none' : shape.fillColor}
                              fillOpacity={isFillNone ? 0 : shape.fillOpacity}
                              stroke={isShapeSelected ? '#2563eb' : shape.borderColor}
                              strokeWidth={isShapeSelected ? Math.max(strokeW, 2.5) : strokeW}
                              strokeDasharray={dash}
                              className={
                                isFillNone && tool !== 'delete'
                                  ? 'pointer-events-none'
                                  : 'pointer-events-auto cursor-move'
                              }
                              onPointerDown={handleShapePointerDown}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <rect
                              x={shape.x}
                              y={shape.y}
                              width={shape.width}
                              height={shape.height}
                              rx={14}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={14}
                              className="pointer-events-auto cursor-move"
                              onPointerDown={handleShapePointerDown}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </>
                        )}

                        {labelText && (
                          <text
                            x={shape.kind === 'circle' ? shape.x + shape.width / 2 : shape.x + 12}
                            y={
                              shape.kind === 'circle'
                                ? shape.y + Math.min(26, Math.max(16, shape.height * 0.16))
                                : shape.y + 19
                            }
                            textAnchor={shape.kind === 'circle' ? 'middle' : 'start'}
                            fontSize="12"
                            fontWeight="700"
                            fill={labelColor}
                            className="pointer-events-auto cursor-move select-none"
                            onPointerDown={handleShapePointerDown}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {labelText}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Selected Shape 8-Handle Resize Box */}
              {selectedShape && tool === 'select' && (
                <div
                  className="absolute border border-blue-500/80 dark:border-cyan-400/80 pointer-events-none z-[5]"
                  style={{
                    left: `${(selectedShape.x / canvasSize.width) * 100}%`,
                    top: `${(selectedShape.y / canvasSize.height) * 100}%`,
                    width: `${(selectedShape.width / canvasSize.width) * 100}%`,
                    height: `${(selectedShape.height / canvasSize.height) * 100}%`
                  }}
                >
                  {(
                    [
                      { id: 'nw', pos: '-top-1.5 -left-1.5', cursor: 'cursor-nwse-resize' },
                      { id: 'n', pos: '-top-1.5 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
                      { id: 'ne', pos: '-top-1.5 -right-1.5', cursor: 'cursor-nesw-resize' },
                      { id: 'e', pos: 'top-1/2 -right-1.5 -translate-y-1/2', cursor: 'cursor-ew-resize' },
                      { id: 'se', pos: '-bottom-1.5 -right-1.5', cursor: 'cursor-nwse-resize' },
                      { id: 's', pos: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
                      { id: 'sw', pos: '-bottom-1.5 -left-1.5', cursor: 'cursor-nesw-resize' },
                      { id: 'w', pos: 'top-1/2 -left-1.5 -translate-y-1/2', cursor: 'cursor-ew-resize' }
                    ] as Array<{ id: ShapeResizeHandle; pos: string; cursor: string }>
                  ).map(h => (
                    <button
                      key={h.id}
                      type="button"
                      aria-label={`Resize ${h.id}`}
                      title="Drag to resize grouping zone (hold Shift on corners to lock aspect ratio)"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        if (rect.width <= 0 || rect.height <= 0) return;

                        const startCanvasX = Math.min(
                          canvasSize.width,
                          Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasSize.width)
                        );
                        const startCanvasY = Math.min(
                          canvasSize.height,
                          Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasSize.height)
                        );

                        shapeResizeStateRef.current = {
                          shapeId: selectedShape.id,
                          handle: h.id,
                          startCanvasX,
                          startCanvasY,
                          initX: selectedShape.x,
                          initY: selectedShape.y,
                          initW: selectedShape.width,
                          initH: selectedShape.height,
                          moved: false
                        };
                        setActiveShapeResizeInfo({
                          x: selectedShape.x + selectedShape.width / 2,
                          y: selectedShape.y,
                          label: `${selectedShape.width} × ${selectedShape.height}`
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute ${h.pos} w-3 h-3 rounded-xs bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-cyan-400 shadow-sm pointer-events-auto z-30 ${h.cursor} hover:scale-125 transition-transform`}
                    />
                  ))}
                </div>
              )}

              {/* Live Shape Resize Readout */}
              {activeShapeResizeInfo && (
                <div
                  style={{
                    left: `${(activeShapeResizeInfo.x / canvasSize.width) * 100}%`,
                    top: `${Math.max(2, ((activeShapeResizeInfo.y - 12) / canvasSize.height) * 100)}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-mono font-bold tabular-nums shadow-md pointer-events-none z-40 whitespace-nowrap"
                >
                  {activeShapeResizeInfo.label}
                </div>
              )}

              {/* Live Snap-to-Grid Drag Coordinate Readout */}
              {activeSnapGuides?.readout && (
                <div
                  style={{
                    left: `${(activeSnapGuides.readout.x / canvasSize.width) * 100}%`,
                    top: `${Math.max(2, (activeSnapGuides.readout.y / canvasSize.height) * 100)}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-md bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-[10px] font-mono font-bold tabular-nums shadow-md pointer-events-none z-40 whitespace-nowrap"
                >
                  {activeSnapGuides.readout.text}
                </div>
              )}

              {/* Marquee Drag Selection Box */}
              {selectionBox && (
                <div
                  className="absolute border-2 border-dashed border-blue-600 bg-blue-500/12 dark:border-cyan-400 dark:bg-cyan-400/15 rounded-md pointer-events-none z-30"
                  style={{
                    left: `${(Math.min(selectionBox.startX, selectionBox.currentX) / canvasSize.width) * 100}%`,
                    top: `${(Math.min(selectionBox.startY, selectionBox.currentY) / canvasSize.height) * 100}%`,
                    width: `${(Math.abs(selectionBox.currentX - selectionBox.startX) / canvasSize.width) * 100}%`,
                    height: `${(Math.abs(selectionBox.currentY - selectionBox.startY) / canvasSize.height) * 100}%`
                  }}
                >
                  <div
                    className={`absolute ${
                      Math.max(selectionBox.startY, selectionBox.currentY) > canvasSize.height - 40
                        ? '-top-6'
                        : '-bottom-6'
                    } right-0 px-2 py-0.5 rounded-md bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-[10px] font-mono font-bold tabular-nums shadow-md whitespace-nowrap`}
                  >
                    {selectionBox.count} {selectionBox.count === 1 ? 'device' : 'devices'}
                  </div>
                </div>
              )}

              {/* Multi-Select Group Bounding Box, Group Move Handle & Group Rotation Handle */}
              {selectedGroupBounds && (
                <div
                  className="absolute border-2 border-dashed border-blue-500/80 dark:border-cyan-400/80 bg-blue-500/[0.03] dark:bg-cyan-400/[0.04] rounded-2xl pointer-events-none z-20"
                  style={{
                    left: `${(selectedGroupBounds.left / canvasSize.width) * 100}%`,
                    top: `${(selectedGroupBounds.top / canvasSize.height) * 100}%`,
                    width: `${((selectedGroupBounds.right - selectedGroupBounds.left) / canvasSize.width) * 100}%`,
                    height: `${((selectedGroupBounds.bottom - selectedGroupBounds.top) / canvasSize.height) * 100}%`
                  }}
                >
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-auto z-30 ${
                      selectedGroupBounds.top < 36 ? '-bottom-7 flex-col-reverse' : '-top-7 flex-col'
                    }`}
                  >
                    <button
                      type="button"
                      data-group-rotate="true"
                      aria-label="Rotate selected devices"
                      title="Drag to rotate selected devices together (Shift snaps 15° · double-click resets 0°)"
                      onPointerDown={(e) =>
                        startRotationDrag(
                          e,
                          selectedGroupBounds.ids,
                          selectedGroupBounds.pivotX,
                          selectedGroupBounds.pivotY
                        )
                      }
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleResetRotation(selectedGroupBounds.ids);
                      }}
                      className="w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                    <div className="w-px h-2.5 bg-blue-500 dark:bg-cyan-400" />
                  </div>

                  {/* Direct Group Drag-to-Move Handle */}
                  <button
                    type="button"
                    data-group-move="true"
                    aria-label={`Move ${selectedGroupBounds.ids.length} selected devices as a group`}
                    title="Drag to move all selected devices together as a group"
                    onPointerDown={(e) => startGroupDrag(e)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute left-1/2 -translate-x-1/2 ${
                      selectedGroupBounds.bottom > canvasSize.height - 38
                        ? 'top-1.5'
                        : selectedGroupBounds.top < 36
                        ? '-top-3.5'
                        : '-bottom-3.5'
                    } inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950 text-[11px] font-semibold shadow-md pointer-events-auto z-30 cursor-grab active:cursor-grabbing hover:brightness-110 transition-all whitespace-nowrap tabular-nums`}
                  >
                    <Move className="w-3 h-3" />
                    <span>Move Group ({selectedGroupBounds.ids.length})</span>
                  </button>
                </div>
              )}

              {/* Live Rotation Degree Readout */}
              {activeRotationInfo && (
                <div
                  style={{
                    left: `${(activeRotationInfo.x / canvasSize.width) * 100}%`,
                    top: `${Math.max(2, ((activeRotationInfo.y - 54) / canvasSize.height) * 100)}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-mono font-bold tabular-nums shadow-md pointer-events-none z-40 whitespace-nowrap"
                >
                  {activeRotationInfo.label}
                </div>
              )}
              {/* Empty Canvas Guide */}
              {devices.length === 0 && shapes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
                  <div className="max-w-sm text-center space-y-2 p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <Network className="w-8 h-8 mx-auto text-blue-600 dark:text-cyan-400" />
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Blank Topology Canvas
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Use the Add Device buttons above to place Cisco routers, switches, PCs, and servers, then connect them with cables.
                    </p>
                  </div>
                </div>
              )}

              {/* SVG Links & Packet Flow Layer */}
              <svg
                viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
                preserveAspectRatio="none"
              >
                {links.map(link => {
                  const fromDev = devices.find(d => d.id === link.fromDeviceId);
                  const toDev = devices.find(d => d.id === link.toDeviceId);
                  if (!fromDev || !toDev) return null;

                  const st = linkStatuses.get(link.id);
                  const isUp = Boolean(st?.isUp);
                  const meta = CABLE_META[link.cableType];
                  const isSelected = selectedLinkId === link.id;
                  const isActivePacketLink =
                    animStepIndex !== null &&
                    lastPingResult?.hops[animStepIndex]?.linkId === link.id;

                  // Compute anchored endpoint socket coordinates and per-interface label geometry
                  const fromAnchor = getDevicePortPosition(fromDev, link.fromPort);
                  const toAnchor = getDevicePortPosition(toDev, link.toPort);
                  const geom = computeCableGeometry(
                    fromAnchor.x,
                    fromAnchor.y,
                    toAnchor.x,
                    toAnchor.y,
                    { anchored: true }
                  );

                  const fromIf = fromDev.interfaces.find(i => i.name === link.fromPort);
                  const toIf = toDev.interfaces.find(i => i.name === link.toPort);
                  const fromPortLabel = fromIf?.shortName || link.fromPort;
                  const toPortLabel = toIf?.shortName || link.toPort;

                  return (
                    <g key={link.id}>
                      {/* Invisible wide hit-area for clicking/deleting links */}
                      <line
                        x1={fromAnchor.x}
                        y1={fromAnchor.y}
                        x2={toAnchor.x}
                        y2={toAnchor.y}
                        stroke="transparent"
                        strokeWidth={18}
                        className="pointer-events-auto cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressCanvasClickRef.current) {
                            suppressCanvasClickRef.current = false;
                            return;
                          }
                          if (tool === 'pan' || tool === 'marquee' || isSpacePanningRef.current) return;
                          if (tool === 'delete') {
                            handleDeleteLink(link.id);
                          } else {
                            setSelectedLinkId(link.id);
                            setSelectedDeviceId(null);
                            setSelectedDeviceIds([]);
                            setSelectedShapeId(null);
                            setSelectedDiagramLabelId(null);
                          }
                        }}
                      />

                      {/* Visible Link Line Anchored to Port Sockets */}
                      <line
                        x1={fromAnchor.x}
                        y1={fromAnchor.y}
                        x2={toAnchor.x}
                        y2={toAnchor.y}
                        stroke={
                          isActivePacketLink
                            ? '#10b981'
                            : isSelected
                            ? '#2563eb'
                            : isUp
                            ? meta.stroke
                            : '#94a3b8'
                        }
                        strokeWidth={isActivePacketLink || isSelected ? 4 : 2.5}
                        strokeDasharray={meta.dash}
                        strokeOpacity={isUp || isSelected ? 0.95 : 0.6}
                        strokeLinecap="round"
                      />

                      {/* Port Socket Anchor Pins */}
                      <circle
                        cx={fromAnchor.x}
                        cy={fromAnchor.y}
                        r={3.3}
                        fill={isSelected ? '#2563eb' : isUp ? meta.stroke : '#64748b'}
                        stroke="#ffffff"
                        strokeWidth={1.1}
                      />
                      <circle
                        cx={toAnchor.x}
                        cy={toAnchor.y}
                        r={3.3}
                        fill={isSelected ? '#2563eb' : isUp ? meta.stroke : '#64748b'}
                        stroke="#ffffff"
                        strokeWidth={1.1}
                      />

                      {/* Endpoint Link LEDs (Green = Up, Red = Down/Mismatch) */}
                      <circle
                        cx={geom.x1Led}
                        cy={geom.y1Led}
                        r={4.2}
                        fill={isUp ? '#10b981' : '#ef4444'}
                        stroke="#0f172a"
                        strokeWidth={1}
                      />
                      <circle
                        cx={geom.x2Led}
                        cy={geom.y2Led}
                        r={4.2}
                        fill={isUp ? '#10b981' : '#ef4444'}
                        stroke="#0f172a"
                        strokeWidth={1}
                      />

                      {/* Source Device Interface Label */}
                      <text
                        x={geom.fromLabelX}
                        y={geom.fromLabelY}
                        textAnchor={geom.textAnchor}
                        className={`font-mono font-semibold ${
                          isSelected
                            ? 'fill-blue-600 dark:fill-cyan-300'
                            : 'fill-slate-700 dark:fill-slate-300'
                        } stroke-slate-50 dark:stroke-[#090f1d]`}
                        fontSize="10"
                        strokeWidth={3.5}
                        strokeLinejoin="round"
                        style={{ paintOrder: 'stroke' }}
                      >
                        {fromPortLabel}
                      </text>

                      {/* Target Device Interface Label */}
                      <text
                        x={geom.toLabelX}
                        y={geom.toLabelY}
                        textAnchor={geom.textAnchor}
                        className={`font-mono font-semibold ${
                          isSelected
                            ? 'fill-blue-600 dark:fill-cyan-300'
                            : 'fill-slate-700 dark:fill-slate-300'
                        } stroke-slate-50 dark:stroke-[#090f1d]`}
                        fontSize="10"
                        strokeWidth={3.5}
                        strokeLinejoin="round"
                        style={{ paintOrder: 'stroke' }}
                      >
                        {toPortLabel}
                      </text>
                    </g>
                  );
                })}

                {/* Live Magnetic Cable Line Drawing Preview */}
                {liveCableDraw && (() => {
                  const previewType: SimCableType =
                    liveCableDraw.snapTarget?.cableType ||
                    (cableToolMode === 'auto' ? 'straight' : selectedCableType);
                  const previewMeta = CABLE_META[previewType];
                  const endX = liveCableDraw.snapTarget
                    ? liveCableDraw.snapTarget.x
                    : liveCableDraw.cursorX;
                  const endY = liveCableDraw.snapTarget
                    ? liveCableDraw.snapTarget.y
                    : liveCableDraw.cursorY;

                  return (
                    <g>
                      {liveCableDraw.snapTarget && (
                        <line
                          x1={liveCableDraw.cursorX}
                          y1={liveCableDraw.cursorY}
                          x2={endX}
                          y2={endY}
                          stroke={previewMeta.stroke}
                          strokeWidth={1.2}
                          strokeDasharray="2 3"
                          strokeOpacity={0.55}
                        />
                      )}
                      <line
                        x1={liveCableDraw.fromX}
                        y1={liveCableDraw.fromY}
                        x2={endX}
                        y2={endY}
                        stroke={liveCableDraw.blockedTarget ? '#ef4444' : previewMeta.stroke}
                        strokeWidth={liveCableDraw.snapTarget ? 3.2 : 2.5}
                        strokeDasharray={previewMeta.dash || (liveCableDraw.snapTarget ? undefined : '5 4')}
                        strokeOpacity={0.95}
                        strokeLinecap="round"
                      />
                      <circle
                        cx={liveCableDraw.fromX}
                        cy={liveCableDraw.fromY}
                        r={6.5}
                        fill="none"
                        stroke={previewMeta.stroke}
                        strokeWidth={1.8}
                        strokeOpacity={0.75}
                      />
                      <circle
                        cx={liveCableDraw.fromX}
                        cy={liveCableDraw.fromY}
                        r={3.8}
                        fill={previewMeta.stroke}
                        stroke="#ffffff"
                        strokeWidth={1.2}
                      />
                      {liveCableDraw.snapTarget ? (
                        <g>
                          <circle
                            cx={endX}
                            cy={endY}
                            r={10.5}
                            fill={previewMeta.stroke}
                            fillOpacity={0.18}
                            stroke={previewMeta.stroke}
                            strokeWidth={1.8}
                          />
                          <circle
                            cx={endX}
                            cy={endY}
                            r={4.5}
                            fill={previewMeta.stroke}
                            stroke="#ffffff"
                            strokeWidth={1.4}
                          />
                        </g>
                      ) : (
                        <circle
                          cx={endX}
                          cy={endY}
                          r={3.5}
                          fill={liveCableDraw.blockedTarget ? '#ef4444' : previewMeta.stroke}
                          fillOpacity={0.85}
                        />
                      )}
                    </g>
                  );
                })()}

                {/* Animated Packet Marker */}
                {activePacketPos && (
                  <g>
                    <circle
                      cx={activePacketPos.x}
                      cy={activePacketPos.y - 34}
                      r={9}
                      fill={activePacketPos.status === 'ok' ? '#10b981' : '#ef4444'}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </g>
                )}
              </svg>

              {/* Magnetic Interface Port Socket Overlay during Cable Mode */}
              {tool === 'cable' && (
                <svg
                  viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                  className="absolute inset-0 w-full h-full pointer-events-none z-[25]"
                  preserveAspectRatio="none"
                >
                  {devices.map(dev => {
                    const anchors = getDevicePortAnchors(dev);
                    const isSourceDev = liveCableDraw?.fromDeviceId === dev.id;
                    const isSnappedDev = liveCableDraw?.snapTarget?.deviceId === dev.id;
                    const isBlockedDev = liveCableDraw?.blockedTarget?.deviceId === dev.id;

                    return (
                      <g key={`ports-${dev.id}`}>
                        {(isSourceDev || isSnappedDev) && (
                          <circle
                            cx={dev.x}
                            cy={dev.y}
                            r={36}
                            fill="none"
                            stroke={isSnappedDev ? '#10b981' : '#0ea5e9'}
                            strokeWidth={1.4}
                            strokeDasharray="4 3"
                            strokeOpacity={0.65}
                          />
                        )}
                        {isBlockedDev && (
                          <circle
                            cx={dev.x}
                            cy={dev.y}
                            r={36}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={1.4}
                            strokeDasharray="4 3"
                            strokeOpacity={0.75}
                          />
                        )}
                        {anchors.map(anchor => {
                          const iface = dev.interfaces.find(i => i.name === anchor.name);
                          const used = isPortInUse(dev.id, anchor.name);
                          const compatible =
                            cableToolMode === 'auto'
                              ? true
                              : iface
                              ? isPortCompatibleWithCable(iface, selectedCableType)
                              : false;
                          const isSrcAnchor =
                            liveCableDraw?.fromDeviceId === dev.id &&
                            liveCableDraw.fromPort === anchor.name;
                          const isSnappedAnchor =
                            liveCableDraw?.snapTarget?.deviceId === dev.id &&
                            liveCableDraw.snapTarget.portName === anchor.name;
                          const portKey = `${dev.id}:${anchor.name}`;
                          const isHovered = hoveredPortKey === portKey;

                          const kindColor =
                            anchor.kind === 'fiber'
                              ? '#f59e0b'
                              : anchor.kind === 'serial'
                              ? '#ef4444'
                              : '#0ea5e9';

                          return (
                            <g
                              key={portKey}
                              className={
                                used || !compatible
                                  ? 'pointer-events-auto cursor-not-allowed'
                                  : 'pointer-events-auto cursor-crosshair'
                              }
                              onPointerEnter={() => setHoveredPortKey(portKey)}
                              onPointerLeave={() =>
                                setHoveredPortKey(prev => (prev === portKey ? null : prev))
                              }
                              onPointerDown={(e) => handleCableSurfacePointerDown(dev, e, anchor.name)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <circle cx={anchor.x} cy={anchor.y} r={8} fill="transparent" />
                              {(isSnappedAnchor || isSrcAnchor || isHovered) && compatible && !used && (
                                <circle
                                  cx={anchor.x}
                                  cy={anchor.y}
                                  r={isSnappedAnchor ? 9.5 : 7}
                                  fill={kindColor}
                                  fillOpacity={isSnappedAnchor ? 0.24 : 0.16}
                                  stroke={kindColor}
                                  strokeWidth={1.3}
                                />
                              )}
                              <circle
                                cx={anchor.x}
                                cy={anchor.y}
                                r={isSnappedAnchor || isSrcAnchor ? 4.4 : isHovered ? 4.2 : 3.3}
                                fill={
                                  isSnappedAnchor || isSrcAnchor
                                    ? kindColor
                                    : used
                                    ? '#64748b'
                                    : compatible
                                    ? '#ffffff'
                                    : '#475569'
                                }
                                fillOpacity={!compatible && !used ? 0.35 : 0.96}
                                stroke={used ? '#334155' : compatible ? kindColor : '#64748b'}
                                strokeOpacity={!compatible && !used ? 0.4 : 0.95}
                                strokeWidth={isSnappedAnchor || isSrcAnchor ? 1.6 : 1.5}
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Magnetic Snap & Port Hover Readout Pill */}
              {tool === 'cable' &&
                (() => {
                  if (liveCableDraw?.snapTarget) {
                    const st = liveCableDraw.snapTarget;
                    return (
                      <div
                        style={{
                          left: `${(st.x / canvasSize.width) * 100}%`,
                          top: `${Math.max(2, ((st.y - 16) / canvasSize.height) * 100)}%`
                        }}
                        className="absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-md bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-[10px] font-mono font-bold shadow-md pointer-events-none z-40 whitespace-nowrap"
                      >
                        {st.deviceName} · {st.shortName} ({CABLE_META[st.cableType].short})
                      </div>
                    );
                  }
                  if (liveCableDraw?.blockedTarget) {
                    const bt = liveCableDraw.blockedTarget;
                    return (
                      <div
                        style={{
                          left: `${(bt.x / canvasSize.width) * 100}%`,
                          top: `${Math.max(2, ((bt.y - 38) / canvasSize.height) * 100)}%`
                        }}
                        className="absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-mono font-bold shadow-md pointer-events-none z-40 whitespace-nowrap"
                      >
                        {bt.deviceName}: {bt.reason}
                      </div>
                    );
                  }
                  if (hoveredPortKey) {
                    const sepIdx = hoveredPortKey.indexOf(':');
                    const hDevId = hoveredPortKey.slice(0, sepIdx);
                    const hPortName = hoveredPortKey.slice(sepIdx + 1);
                    const hDev = devices.find(d => d.id === hDevId);
                    if (!hDev) return null;
                    const hAnchor = getDevicePortAnchors(hDev).find(a => a.name === hPortName);
                    if (!hAnchor) return null;
                    const used = isPortInUse(hDev.id, hAnchor.name);
                    return (
                      <div
                        style={{
                          left: `${(hAnchor.x / canvasSize.width) * 100}%`,
                          top: `${Math.max(2, ((hAnchor.y - 14) / canvasSize.height) * 100)}%`
                        }}
                        className="absolute -translate-x-1/2 -translate-y-full px-2 py-0.5 rounded-md bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-[10px] font-mono font-bold shadow-md pointer-events-none z-40 whitespace-nowrap"
                      >
                        {hDev.name} · {hAnchor.shortName} {used ? '(In use)' : '(Free)'}
                      </div>
                    );
                  }
                  return null;
                })()}

              {/* Draggable Topology Device Nodes & Movable Labels */}
              {devices.map(dev => {
                const isSelected = selectedDeviceId === dev.id || selectedDeviceIds.includes(dev.id);
                const isPendingSrc =
                  pendingCableSource?.deviceId === dev.id ||
                  liveCableDraw?.fromDeviceId === dev.id;
                const isActiveHop =
                  animStepIndex !== null &&
                  lastPingResult?.hops[animStepIndex]?.deviceId === dev.id;
                const primaryIp = dev.interfaces.find(i => isValidIp(i.ip))?.ip;
                const labelOx =
                  typeof dev.labelOffsetX === 'number' && Number.isFinite(dev.labelOffsetX)
                    ? dev.labelOffsetX
                    : 0;
                const labelOy =
                  typeof dev.labelOffsetY === 'number' && Number.isFinite(dev.labelOffsetY)
                    ? dev.labelOffsetY
                    : 0;
                const hasCustomLabelOffset = labelOx !== 0 || labelOy !== 0;
                const {
                  primary: displayLabel,
                  secondaryHostname,
                  isCustomActive
                } = getDeviceDisplayLabel(dev, showCustomLabels);

                return (
                  <React.Fragment key={dev.id}>
                    {/* Dashed association line when dragging or viewing a custom-positioned label */}
                    {(draggingLabelDeviceId === dev.id || (isSelected && hasCustomLabelOffset)) && (
                      <svg
                        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                        preserveAspectRatio="none"
                        className="absolute inset-0 w-full h-full pointer-events-none z-[9]"
                      >
                        <line
                          x1={dev.x}
                          y1={dev.y}
                          x2={dev.x + labelOx}
                          y2={dev.y + 34 + labelOy + 12}
                          stroke={draggingLabelDeviceId === dev.id ? '#38bdf8' : '#94a3b8'}
                          strokeWidth={1.2}
                          strokeDasharray="3 3"
                          strokeOpacity={0.75}
                        />
                      </svg>
                    )}

                    {/* Device Icon Node */}
                    <div
                      data-device-id={dev.id}
                      style={{
                        left: `${(dev.x / canvasSize.width) * 100}%`,
                        top: `${(dev.y / canvasSize.height) * 100}%`
                      }}
                      title={
                        tool === 'cable'
                          ? 'Drag or click to draw magnetic cable to another device port'
                          : tool === 'select'
                          ? 'Click: select · Long-click & drag: move · Double-click: open console'
                          : tool === 'marquee'
                          ? isSelected && selectedDeviceIds.length >= 2
                            ? 'Drag to move selected group · Shift+drag canvas to adjust marquee'
                            : 'Drag rectangle to select multiple devices'
                          : undefined
                      }
                      onPointerDown={(e) => {
                        if (tool === 'cable' && e.button === 0) {
                          handleCableSurfacePointerDown(dev, e);
                          return;
                        }
                        if (tool !== 'select' || e.button !== 0) return;
                        e.stopPropagation();
                        const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
                        if (isModifier) return;

                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        if (rect.width <= 0 || rect.height <= 0) return;

                        const startCanvasX = Math.min(
                          canvasSize.width,
                          Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasSize.width)
                        );
                        const startCanvasY = Math.min(
                          canvasSize.height,
                          Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasSize.height)
                        );

                        const activeGroupIds = selectedDeviceIds.includes(dev.id)
                          ? selectedDeviceIds
                          : [dev.id];

                        const initialPositions = devices
                          .filter(d => activeGroupIds.includes(d.id))
                          .map(d => ({ id: d.id, x: d.x, y: d.y }));

                        if (dragStateRef.current?.holdTimerId != null) {
                          window.clearTimeout(dragStateRef.current.holdTimerId);
                        }

                        const holdTimerId = window.setTimeout(() => {
                          if (!dragStateRef.current || dragStateRef.current.holdTimerId !== holdTimerId) {
                            return;
                          }
                          dragStateRef.current.isLongPressReady = true;
                          setLongPressMoveDeviceId(dev.id);
                          setSelectedDeviceIds(activeGroupIds);
                          setSelectedDeviceId(dev.id);
                          setSelectedLinkId(null);
                          setSelectedShapeId(null);
                          setSelectedDiagramLabelId(null);
                          setActiveSnapGuides({
                            readout: { x: dev.x, y: dev.y - 34, text: `${dev.x}, ${dev.y}` }
                          });
                        }, 220);

                        dragStateRef.current = {
                          leadId: dev.id,
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          startCanvasX,
                          startCanvasY,
                          initialPositions,
                          isLongPressReady: false,
                          holdTimerId,
                          moved: false
                        };
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeviceClick(dev, e);
                      }}
                      onDoubleClick={(e) => {
                        if (tool !== 'select' && tool !== 'marquee') return;
                        e.stopPropagation();
                        if (dragStateRef.current?.holdTimerId != null) {
                          window.clearTimeout(dragStateRef.current.holdTimerId);
                        }
                        dragStateRef.current = null;
                        setLongPressMoveDeviceId(null);
                        setActiveSnapGuides(null);
                        openDeviceConsole(dev);
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group ${
                        longPressMoveDeviceId === dev.id ? 'cursor-grabbing z-30' : 'cursor-pointer'
                      } ${isSelected ? 'z-20' : 'z-10'}`}
                    >
                      <div
                        className={`relative p-1.5 rounded-2xl flex items-center justify-center transition-transform duration-150 ${
                          longPressMoveDeviceId === dev.id
                            ? 'ring-2 ring-cyan-400 bg-cyan-500/15 scale-105 shadow-md'
                            : isActiveHop
                            ? 'ring-3 ring-emerald-400 bg-emerald-500/15 scale-110'
                            : isSelected || isPendingSrc
                            ? 'ring-2 ring-blue-500 dark:ring-cyan-400 bg-blue-500/10 dark:bg-cyan-400/10 shadow-sm'
                            : ''
                        } ${tool === 'delete' ? 'hover:ring-2 hover:ring-red-500 hover:bg-red-500/10' : ''}`}
                      >
                        <div
                          style={{
                            transform: dev.rotation ? `rotate(${dev.rotation}deg)` : undefined
                          }}
                          className="relative flex items-center justify-center"
                        >
                          <CiscoDeviceIcon
                            type={dev.type}
                            className="w-13 h-11 sm:w-15 sm:h-13 drop-shadow-[0_4px_8px_rgba(2,6,23,0.3)] dark:drop-shadow-[0_4px_10px_rgba(56,189,248,0.16)] transition-transform duration-150 group-hover:scale-105"
                          />

                          {/* Single-Device Rotation Handle (orbits around device center) */}
                          {tool === 'select' &&
                            longPressMoveDeviceId !== dev.id &&
                            selectedDeviceIds.length === 1 &&
                            selectedDeviceIds[0] === dev.id && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto z-30">
                                <button
                                  type="button"
                                  aria-label={`Rotate ${dev.name}`}
                                  title="Drag to rotate device (Shift snaps 15° · double-click resets 0°)"
                                  onPointerDown={(e) => startRotationDrag(e, [dev.id], dev.x, dev.y)}
                                  onClick={(e) => e.stopPropagation()}
                                  onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    handleResetRotation([dev.id]);
                                  }}
                                  className="w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-cyan-400 text-blue-600 dark:text-cyan-400 shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 transition-transform"
                                >
                                  <RotateCw className="w-2.5 h-2.5" />
                                </button>
                                <div className="w-px h-2 bg-blue-500 dark:bg-cyan-400" />
                              </div>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Independently Movable & Editable Device Label Pill */}
                    <div
                      style={{
                        left: `${((dev.x + labelOx) / canvasSize.width) * 100}%`,
                        top: `${((dev.y + 34 + labelOy) / canvasSize.height) * 100}%`
                      }}
                      className={`absolute -translate-x-1/2 ${
                        editingDeviceLabelId === dev.id || draggingLabelDeviceId === dev.id
                          ? 'z-30'
                          : isSelected
                          ? 'z-20'
                          : 'z-[15]'
                      }`}
                    >
                      {editingDeviceLabelId === dev.id ? (
                        <div
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border-2 border-blue-500 dark:border-cyan-400 shadow-md"
                        >
                          <input
                            type="text"
                            autoFocus
                            maxLength={64}
                            placeholder={showCustomLabels ? `Custom label (${dev.name})` : dev.name}
                            aria-label={`Edit label for ${dev.name}`}
                            value={editingDeviceLabelDraft}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => setEditingDeviceLabelDraft(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitDeviceRename(dev.id, editingDeviceLabelDraft);
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setEditingDeviceLabelId(null);
                              }
                            }}
                            onBlur={() => commitDeviceRename(dev.id, editingDeviceLabelDraft)}
                            className="w-28 sm:w-32 bg-transparent text-center text-[11px] font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div
                          onPointerDown={(e) => {
                            if (tool !== 'select' || e.button !== 0) return;
                            e.stopPropagation();
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            if (rect.width <= 0 || rect.height <= 0) return;

                            const startCanvasX = Math.min(
                              canvasSize.width,
                              Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasSize.width)
                            );
                            const startCanvasY = Math.min(
                              canvasSize.height,
                              Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasSize.height)
                            );

                            setSelectedDeviceIds([dev.id]);
                            setSelectedDeviceId(dev.id);
                            setSelectedLinkId(null);
                            setSelectedShapeId(null);
                            setSelectedDiagramLabelId(null);
                            setDraggingLabelDeviceId(dev.id);

                            labelDragStateRef.current = {
                              deviceId: dev.id,
                              startClientX: e.clientX,
                              startClientY: e.clientY,
                              startCanvasX,
                              startCanvasY,
                              devX: dev.x,
                              devY: dev.y,
                              initOffsetX: labelOx,
                              initOffsetY: labelOy,
                              moved: false
                            };
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (labelDragStateRef.current?.moved) return;
                            handleDeviceClick(dev, e);
                          }}
                          onDoubleClick={(e) => {
                            if (tool !== 'select') return;
                            e.stopPropagation();
                            startCanvasLabelEdit(dev);
                          }}
                          title={
                            tool === 'select'
                              ? isCustomActive
                                ? `${displayLabel} (Hostname: ${dev.name}) · Drag to move · Double-click to edit`
                                : 'Drag to reposition label · Double-click to rename'
                              : isCustomActive
                              ? `${displayLabel} (Hostname: ${dev.name})`
                              : undefined
                          }
                          className={`px-2 py-0.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border shadow-xs text-center whitespace-nowrap select-none transition-colors ${
                            draggingLabelDeviceId === dev.id
                              ? 'border-blue-500 dark:border-cyan-400 ring-2 ring-blue-500/30 cursor-grabbing'
                              : isCustomActive
                              ? tool === 'select'
                                ? 'border-blue-300 dark:border-cyan-700 hover:border-blue-500 dark:hover:border-cyan-400 cursor-grab'
                                : 'border-blue-300 dark:border-cyan-700 cursor-pointer'
                              : tool === 'select'
                              ? 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-cyan-400 cursor-grab'
                              : 'border-slate-200 dark:border-slate-700 cursor-pointer'
                          }`}
                        >
                          <div className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                            {isCustomActive && (
                              <Tag
                                className="w-2.5 h-2.5 text-blue-600 dark:text-cyan-400 shrink-0"
                                aria-hidden="true"
                              />
                            )}
                            <span>{displayLabel}</span>
                            {tool === 'select' && isSelected && selectedDeviceIds.length === 1 && (
                              <button
                                type="button"
                                aria-label={`Rename ${displayLabel}`}
                                title={
                                  showCustomLabels
                                    ? 'Edit custom label (F2)'
                                    : 'Rename hostname (F2)'
                                }
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startCanvasLabelEdit(dev);
                                }}
                                className="p-0.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                          {secondaryHostname && (
                            <div className="text-[9.5px] font-mono text-slate-400 dark:text-slate-400 leading-tight">
                              {secondaryHostname}
                            </div>
                          )}
                          {primaryIp && (
                            <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-cyan-300 leading-tight">
                              {primaryIp}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Palette Drag-and-Drop Ghost Preview */}
              {paletteDropPreview && (
                <div
                  style={{
                    left: `${(paletteDropPreview.x / canvasSize.width) * 100}%`,
                    top: `${(paletteDropPreview.y / canvasSize.height) * 100}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-40"
                >
                  <div className="p-1.5 rounded-2xl border-2 border-dashed border-sky-500 bg-sky-500/15 shadow-lg">
                    <CiscoDeviceIcon
                      type={paletteDropPreview.type}
                      className="w-13 h-11 sm:w-15 sm:h-13 opacity-85"
                    />
                  </div>
                  <span className="mt-1 px-1.5 py-0.5 rounded bg-slate-900/90 text-white text-[10px] font-mono tabular-nums">
                    {paletteDropPreview.x}, {paletteDropPreview.y}
                  </span>
                </div>
              )}

              {/* Freeform Diagram Informational Labels */}
              {diagramLabels.map(lbl => {
                const isLblSelected = selectedDiagramLabelId === lbl.id;
                const isEditing = editingDiagramLabelId === lbl.id;
                const hasBg = Boolean(lbl.bgColor && lbl.bgColor !== 'transparent');
                const fontSize = Math.min(20, Math.max(10, Number(lbl.fontSize) || 12));

                return (
                  <div
                    key={lbl.id}
                    style={{
                      left: `${(lbl.x / canvasSize.width) * 100}%`,
                      top: `${(lbl.y / canvasSize.height) * 100}%`
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 ${
                      isEditing || isLblSelected ? 'z-[26]' : 'z-[24]'
                    }`}
                  >
                    {isEditing ? (
                      <div
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded-lg bg-white dark:bg-slate-900 border-2 border-blue-500 dark:border-cyan-400 shadow-lg"
                      >
                        <textarea
                          autoFocus
                          rows={Math.min(4, Math.max(1, editingDiagramLabelDraft.split('\n').length))}
                          maxLength={160}
                          aria-label="Edit diagram label text"
                          value={editingDiagramLabelDraft}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setEditingDiagramLabelDraft(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              commitDiagramLabelEdit(lbl.id, editingDiagramLabelDraft);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingDiagramLabelId(null);
                            }
                          }}
                          onBlur={() => commitDiagramLabelEdit(lbl.id, editingDiagramLabelDraft)}
                          className="w-36 sm:w-44 bg-transparent text-center text-xs font-bold text-slate-900 dark:text-white focus:outline-none resize-none leading-snug"
                        />
                      </div>
                    ) : (
                      <div
                        onPointerDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          if (tool === 'delete') {
                            handleDeleteDiagramLabel(lbl.id);
                            return;
                          }
                          if (tool !== 'select') return;
                          const canvas = canvasRef.current;
                          if (!canvas) return;
                          const rect = canvas.getBoundingClientRect();
                          if (rect.width <= 0 || rect.height <= 0) return;

                          const startCanvasX = Math.min(
                            canvasSize.width,
                            Math.max(0, ((e.clientX - rect.left) / rect.width) * canvasSize.width)
                          );
                          const startCanvasY = Math.min(
                            canvasSize.height,
                            Math.max(0, ((e.clientY - rect.top) / rect.height) * canvasSize.height)
                          );

                          setSelectedDiagramLabelId(lbl.id);
                          setSelectedShapeId(null);
                          setSelectedDeviceIds([]);
                          setSelectedDeviceId(null);
                          setSelectedLinkId(null);

                          diagramLabelDragStateRef.current = {
                            labelId: lbl.id,
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            startCanvasX,
                            startCanvasY,
                            initX: lbl.x,
                            initY: lbl.y,
                            moved: false
                          };
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          if (tool !== 'select') return;
                          e.stopPropagation();
                          setSelectedDiagramLabelId(lbl.id);
                          setEditingDiagramLabelId(lbl.id);
                          setEditingDiagramLabelDraft(lbl.text);
                        }}
                        title={
                          tool === 'delete'
                            ? 'Click to delete label'
                            : 'Drag to move label · Double-click to edit text'
                        }
                        style={{
                          color: lbl.color || undefined,
                          backgroundColor: hasBg ? lbl.bgColor : undefined,
                          fontSize: `${fontSize}px`
                        }}
                        className={`px-2 py-0.5 rounded-md whitespace-pre-wrap text-center leading-snug select-none transition-all ${
                          lbl.bold !== false ? 'font-bold' : 'font-medium'
                        } ${lbl.italic ? 'italic' : ''} ${
                          !lbl.color ? 'text-slate-800 dark:text-slate-100' : ''
                        } ${
                          hasBg
                            ? 'border border-slate-200/80 dark:border-slate-700/80 shadow-xs'
                            : ''
                        } ${
                          isLblSelected
                            ? 'ring-2 ring-blue-500 dark:ring-cyan-400 bg-white/75 dark:bg-slate-900/75'
                            : tool === 'delete'
                            ? 'hover:ring-2 hover:ring-red-500 cursor-pointer'
                            : 'cursor-move hover:ring-1 hover:ring-blue-400/60'
                        }`}
                      >
                        {lbl.text}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Floating Port Picker Overlay during Cabling */}
              {portPickerDevice?.device && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-80 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-20 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        Select {portPickerDevice.role === 'source' ? 'Source' : 'Target'} Port on{' '}
                        {portPickerDevice.device.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Cable: {CABLE_META[selectedCableType].label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingCableSource(null);
                        setPendingCableTarget(null);
                      }}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                    {portPickerDevice.device.interfaces
                      .filter(i => i.kind !== 'subinterface')
                      .map(iface => {
                        const used = isPortInUse(portPickerDevice.device!.id, iface.name);
                        const compatible = isPortCompatibleWithCable(iface, selectedCableType);
                        const disabled = used || !compatible;
                        return (
                          <button
                            key={iface.name}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              if (portPickerDevice.role === 'source') {
                                setPendingCableSource({
                                  deviceId: portPickerDevice.device!.id,
                                  portName: iface.name
                                });
                              } else {
                                completeCableConnection(iface.name);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border text-left font-mono text-[11px] transition-colors ${
                              disabled
                                ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/60'
                            }`}
                          >
                            <div className="font-bold truncate">{iface.shortName}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {used ? 'In use' : !compatible ? `Needs ${iface.kind}` : 'Available'}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
              </div>
              </div>

              {/* JSON Topology File Drop Overlay */}
              {isJsonFileDragOver && (
                <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center bg-blue-500/10 dark:bg-cyan-500/10 border-2 border-dashed border-blue-500 dark:border-cyan-400 rounded-b-2xl backdrop-blur-[1px]">
                  <div className="px-4 py-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-blue-200 dark:border-cyan-700 shadow-lg flex items-center gap-2.5 text-xs font-bold text-slate-900 dark:text-white">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                    <span>Drop topology JSON file (.netlab.json / .json) to load</span>
                  </div>
                </div>
              )}

              {/* Floating Viewport Zoom, Fit & Fullscreen Controls HUD */}
              <div
                data-zoom-hud="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 right-3 z-30 inline-flex items-center gap-0.5 p-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-xs"
              >
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  disabled={zoom <= 0.21}
                  onClick={() => zoomAtViewportCenter(zoom - 0.15)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  aria-label="Reset zoom and pan to 100%"
                  title="Reset zoom & pan to 100%"
                  onClick={handleResetZoomPan}
                  className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold tabular-nums text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-[3.25rem] text-center whitespace-nowrap shrink-0"
                >
                  {Math.round(zoom * 100)}%
                </button>

                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  disabled={zoom >= 2.74}
                  onClick={() => zoomAtViewportCenter(zoom + 0.15)}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <span className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />

                <button
                  type="button"
                  aria-label="Fit topology to view"
                  title="Fit topology diagram to view"
                  onClick={handleFitToView}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <Grid3x3 className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                  <span>Fit</span>
                </button>

                <button
                  type="button"
                  aria-label={isWorkspaceFullscreen ? 'Minimize workspace' : 'Maximize workspace'}
                  title={isWorkspaceFullscreen ? 'Minimize workspace (Esc)' : 'Maximize workspace to fullscreen'}
                  onClick={() => setIsWorkspaceFullscreen(prev => !prev)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {isWorkspaceFullscreen ? (
                    <>
                      <Minimize2 className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                      <span>Min</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                      <span>Full</span>
                    </>
                  )}
                </button>
              </div>

              {/* Floating Workspace Mini-Map Overview */}
              <TopologyMiniMap
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                devices={devices}
                links={links}
                shapes={shapes}
                diagramLabels={diagramLabels}
                selectedDeviceIds={selectedDeviceIds}
                selectedLinkId={selectedLinkId}
                linkStatuses={linkStatuses}
                activeHopLinkId={
                  animStepIndex !== null ? lastPingResult?.hops[animStepIndex]?.linkId : null
                }
                viewportBox={miniMapViewportBox}
                zoom={zoom}
                isOpen={isMiniMapOpen}
                onToggleOpen={() => setIsMiniMapOpen(prev => !prev)}
                isDragging={isMiniMapDragging}
                svgRef={miniMapSvgRef}
                onMiniMapPointerDown={handleMiniMapPointerDown}
              />

              {/* Multi-Device Tabbed CLI Console Pop-up (opens on device double-click) */}
              {consoleTabs.length > 0 && consoleDevice && isConsoleMinimized && (
                <div
                  data-console-overlay="true"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="absolute bottom-3 left-3 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur-xs max-w-[calc(100%-13rem)]"
                >
                  <CiscoDeviceIcon type={consoleDevice.type} className="w-6 h-5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {consoleDevice.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate tabular-nums">
                      {consoleTabs.length} CLI {consoleTabs.length === 1 ? 'session' : 'sessions'} minimized
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConsoleMinimized(false);
                      window.setTimeout(() => cliInputRef.current?.focus(), 0);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Restore</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Close all console tabs"
                    title="Close console"
                    onClick={closeAllConsoleTabs}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {consoleTabs.length > 0 && consoleDevice && !isConsoleMinimized && (
                <div className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center p-2 sm:p-4">
                  <div
                    ref={consoleDialogRef}
                    data-console-overlay="true"
                    role="dialog"
                    aria-label={`${consoleDevice.name} CLI console`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    style={
                      isConsoleExpanded
                        ? undefined
                        : {
                            transform: `translate(${consoleOffset.x}px, ${consoleOffset.y}px)`,
                            ...(consoleSize
                              ? { width: `${consoleSize.width}px`, height: `${consoleSize.height}px` }
                              : {})
                          }
                    }
                    className={`pointer-events-auto relative flex flex-col rounded-2xl bg-slate-100 dark:bg-slate-900 border shadow-2xl overflow-hidden ${
                      isDraggingConsole
                        ? 'border-blue-500 dark:border-cyan-400 ring-2 ring-blue-500/25 dark:ring-cyan-400/25'
                        : 'border-slate-300 dark:border-slate-700'
                    } ${
                      isConsoleExpanded
                        ? 'w-full h-full'
                        : consoleSize
                        ? ''
                        : isWorkspaceFullscreen
                        ? 'w-[min(86%,640px)] h-[min(78%,410px)]'
                        : 'w-[min(96%,720px)] h-[min(92%,440px)]'
                    }`}
                  >
                    {/* Draggable Console Title Bar */}
                    <div
                      onPointerDown={(e) => {
                        if (isConsoleExpanded || e.button !== 0) return;
                        const targetEl = e.target as HTMLElement | null;
                        if (targetEl?.closest('button, select, input, option')) return;
                        e.stopPropagation();
                        setIsDraggingConsole(true);
                        consoleDragRef.current = {
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          initX: consoleOffset.x,
                          initY: consoleOffset.y
                        };
                      }}
                      onDoubleClick={(e) => {
                        const targetEl = e.target as HTMLElement | null;
                        if (targetEl?.closest('button, select, input, option')) return;
                        e.stopPropagation();
                        setIsConsoleExpanded(prev => !prev);
                      }}
                      title={isConsoleExpanded ? undefined : 'Drag to move console window · Double-click to expand'}
                      className={`px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 flex items-center justify-between gap-2 shrink-0 select-none touch-none ${
                        isConsoleExpanded ? '' : 'cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {!isConsoleExpanded && (
                          <Move
                            className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <TerminalIcon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white truncate">
                          <span className="truncate">{consoleDevice.name} CLI</span>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {consoleDevice.model}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isConsoleExpanded &&
                          (consoleOffset.x !== 0 || consoleOffset.y !== 0 || consoleSize !== null) && (
                            <button
                              type="button"
                              aria-label="Center console window"
                              title="Reset console position and size"
                              onClick={() => {
                                setConsoleOffset({ x: 0, y: 0 });
                                setConsoleSize(null);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Center</span>
                            </button>
                          )}

                        <button
                          type="button"
                          aria-label="Minimize console"
                          title="Minimize console to workspace corner"
                          onClick={() => setIsConsoleMinimized(true)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          aria-label={isConsoleExpanded ? 'Restore console size' : 'Expand console window'}
                          title={isConsoleExpanded ? 'Restore floating window size' : 'Expand console over workspace'}
                          onClick={() => setIsConsoleExpanded(prev => !prev)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {isConsoleExpanded ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                          ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          aria-label="Close all console tabs"
                          title="Close console (Esc)"
                          onClick={closeAllConsoleTabs}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Multi-Device Session Tab Strip (PuTTY / SecureCRT style) */}
                    <div
                      onPointerDown={(e) => {
                        if (isConsoleExpanded || e.button !== 0) return;
                        const targetEl = e.target as HTMLElement | null;
                        if (targetEl?.closest('[data-console-tab="true"], button, select, input')) return;
                        e.stopPropagation();
                        setIsDraggingConsole(true);
                        consoleDragRef.current = {
                          startClientX: e.clientX,
                          startClientY: e.clientY,
                          initX: consoleOffset.x,
                          initY: consoleOffset.y
                        };
                      }}
                      role="tablist"
                      aria-label="Open device CLI sessions"
                      className={`px-2 pt-1.5 bg-slate-200/80 dark:bg-slate-900 border-b border-slate-800 flex items-end gap-1 overflow-x-auto shrink-0 select-none touch-none ${
                        isConsoleExpanded ? '' : 'cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      {consoleTabs.map(tabDev => {
                        const isActiveTab = tabDev.id === consoleDevice.id;
                        return (
                          <div
                            key={tabDev.id}
                            data-console-tab="true"
                            onAuxClick={(e) => {
                              if (e.button === 1) {
                                e.preventDefault();
                                closeConsoleTab(tabDev.id);
                              }
                            }}
                            className={`inline-flex items-center rounded-t-lg border border-b-0 transition-colors shrink-0 ${
                              isActiveTab
                                ? 'bg-slate-950 text-white border-slate-700 border-t-2 border-t-cyan-400 -mb-px pb-0.5 z-10 shadow-xs'
                                : 'bg-white/90 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800'
                            }`}
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-selected={isActiveTab}
                              onClick={() => {
                                setConsoleDeviceId(tabDev.id);
                                setSelectedDeviceId(tabDev.id);
                                setSelectedDeviceIds([tabDev.id]);
                                setCmdCursor(-1);
                                window.setTimeout(() => cliInputRef.current?.focus(), 0);
                              }}
                              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 text-xs font-mono font-semibold whitespace-nowrap focus:outline-none"
                            >
                              <CiscoDeviceIcon type={tabDev.type} className="w-4 h-3.5 shrink-0" />
                              <span className="truncate max-w-[140px]">{tabDev.name}</span>
                            </button>
                            <button
                              type="button"
                              aria-label={`Close ${tabDev.name} tab`}
                              title={`Close ${tabDev.name} tab`}
                              onClick={(e) => {
                                e.stopPropagation();
                                closeConsoleTab(tabDev.id);
                              }}
                              className={`mr-1.5 p-0.5 rounded transition-colors ${
                                isActiveTab
                                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                                  : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Active Device CLI Terminal */}
                    <div className="flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100 font-mono overflow-hidden">
                          <div
                            onClick={() => cliInputRef.current?.focus()}
                            className="flex-1 min-h-0 p-4 overflow-y-auto text-xs leading-relaxed space-y-1 cursor-text"
                          >
                            {consoleDevice.cliHistory.map((line, i) => (
                              <div key={i} className="whitespace-pre-wrap break-words">
                                {line.startsWith(consoleDevice.name) ? (
                                  <span className="text-amber-300 font-semibold">{line}</span>
                                ) : line.startsWith('%') ? (
                                  <span className="text-red-300">{line}</span>
                                ) : (
                                  <span className="text-slate-300">{line}</span>
                                )}
                              </div>
                            ))}

                            <form onSubmit={(e) => handleRunCliCommand(e)} className="flex items-center gap-1.5 pt-1">
                              <span className="text-amber-300 font-bold whitespace-nowrap">
                                {getCliPrompt(consoleDevice)}
                              </span>
                              <input
                                ref={cliInputRef}
                                type="text"
                                value={cliInput}
                                onChange={(e) => setCliInput(e.target.value)}
                                onKeyDown={handleCliKeyDown}
                                autoFocus
                                placeholder="Type command, ? for help, or Tab to autocomplete..."
                                className="flex-1 bg-transparent border-none outline-none text-cyan-300 font-mono text-xs p-0 placeholder-slate-600"
                              />
                            </form>
                            <div ref={terminalEndRef} />
                          </div>

                          <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
                            <span className="text-slate-400 shrink-0 px-1">Quick:</span>
                            {(consoleDevice.type === 'router'
                              ? [
                                  'conf t',
                                  'show ip int br',
                                  'show ip route',
                                  'show ip ospf nei',
                                  'show cdp nei',
                                  'show run',
                                  'copy run start'
                                ]
                              : consoleDevice.type === 'switch'
                              ? [
                                  'conf t',
                                  'show vlan brief',
                                  'show int status',
                                  'show int trunk',
                                  'show mac address-table',
                                  'show cdp nei',
                                  'int range fa0/1-4'
                                ]
                              : ['ipconfig', 'ipconfig /all', 'ping ', 'tracert ']
                            ).map(snippet => (
                              <button
                                key={snippet}
                                type="button"
                                onClick={() => {
                                  if (snippet.endsWith(' ')) {
                                    setCliInput(snippet);
                                    cliInputRef.current?.focus();
                                  } else {
                                    handleRunCliCommand(undefined, snippet);
                                  }
                                }}
                                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 whitespace-nowrap shrink-0"
                              >
                                {snippet.trim()}
                              </button>
                            ))}
                          </div>
                        </div>

                    {!isConsoleExpanded && (
                      <div
                        role="separator"
                        aria-label="Resize console window"
                        title="Drag corner to resize console window"
                        onPointerDown={(e) => {
                          if (e.button !== 0 || !consoleDialogRef.current) return;
                          e.stopPropagation();
                          const rect = consoleDialogRef.current.getBoundingClientRect();
                          consoleResizeRef.current = {
                            startClientX: e.clientX,
                            startClientY: e.clientY,
                            initWidth: rect.width,
                            initHeight: rect.height,
                            initOffsetX: consoleOffset.x,
                            initOffsetY: consoleOffset.y
                          };
                        }}
                        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize touch-none flex items-end justify-end p-1 text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors"
                      >
                        <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true">
                          <path
                            d="M11 1L1 11M11 5L5 11M11 9L9 11"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Shape Styling Bar */}
            {selectedShape && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Group Zone
                    </span>
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedShape(s => ({ ...s, kind: 'rectangle' }))
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          selectedShape.kind === 'rectangle'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Square className="w-3 h-3" />
                        <span>Rectangle</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedShape(s => ({ ...s, kind: 'circle' }))
                        }
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          selectedShape.kind === 'circle'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Circle className="w-3 h-3" />
                        <span>Circle</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      aria-label="Group zone label"
                      value={selectedShape.label || ''}
                      maxLength={80}
                      placeholder="Zone label (e.g. AS-100, VLAN 10)..."
                      onChange={(e) => {
                        const val = e.target.value;
                        updateSelectedShape(s => ({ ...s, label: val }));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white w-44 sm:w-52 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedShape.width}×{selectedShape.height}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDuplicateSelectedShape}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:border-blue-500 whitespace-nowrap"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShape(selectedShape.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-semibold hover:bg-red-100 whitespace-nowrap"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Zone</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {/* Fill Color Swatches */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Fill:
                    </span>
                    <div className="flex items-center gap-1">
                      {SHAPE_FILL_PRESETS.map(swatch => {
                        const active = selectedShape.fillColor === swatch.value;
                        return (
                          <button
                            key={swatch.value}
                            type="button"
                            title={swatch.label}
                            aria-label={`Fill ${swatch.label}`}
                            onClick={() =>
                              updateSelectedShape(s => ({ ...s, fillColor: swatch.value }))
                            }
                            className={`w-5 h-5 rounded-md border transition-transform ${
                              active
                                ? 'ring-2 ring-blue-600 dark:ring-cyan-400 scale-110 border-slate-900 dark:border-white'
                                : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                            }`}
                            style={{
                              backgroundColor:
                                swatch.value === 'transparent' ? undefined : swatch.value,
                              backgroundImage:
                                swatch.value === 'transparent'
                                  ? 'linear-gradient(135deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)'
                                  : undefined
                            }}
                          />
                        );
                      })}
                      <label
                        className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden cursor-pointer relative"
                        title="Custom fill color"
                      >
                        <input
                          type="color"
                          aria-label="Custom fill color"
                          value={
                            selectedShape.fillColor === 'transparent'
                              ? '#ddd6fe'
                              : selectedShape.fillColor
                          }
                          onChange={(e) =>
                            updateSelectedShape(s => ({ ...s, fillColor: e.target.value }))
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <span
                          className="block w-full h-full"
                          style={{
                            background:
                              'conic-gradient(#ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)'
                          }}
                        />
                      </label>
                    </div>
                    {selectedShape.fillColor !== 'transparent' && (
                      <input
                        type="range"
                        aria-label="Fill opacity"
                        min={10}
                        max={85}
                        step={5}
                        value={Math.round((selectedShape.fillOpacity ?? 0.34) * 100)}
                        onChange={(e) =>
                          updateSelectedShape(s => ({
                            ...s,
                            fillOpacity: Number(e.target.value) / 100
                          }))
                        }
                        className="w-16 accent-blue-600 dark:accent-cyan-400 cursor-pointer"
                        title={`Fill opacity ${Math.round((selectedShape.fillOpacity ?? 0.34) * 100)}%`}
                      />
                    )}
                  </div>

                  {/* Border Color Swatches */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Border:
                    </span>
                    <div className="flex items-center gap-1">
                      {SHAPE_BORDER_PRESETS.map(swatch => {
                        const active = selectedShape.borderColor === swatch.value;
                        return (
                          <button
                            key={swatch.value}
                            type="button"
                            title={swatch.label}
                            aria-label={`Border ${swatch.label}`}
                            onClick={() =>
                              updateSelectedShape(s => ({ ...s, borderColor: swatch.value }))
                            }
                            className={`w-5 h-5 rounded-md border transition-transform ${
                              active
                                ? 'ring-2 ring-blue-600 dark:ring-cyan-400 scale-110 border-slate-900 dark:border-white'
                                : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                            }`}
                            style={{ backgroundColor: swatch.value }}
                          />
                        );
                      })}
                      <label
                        className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden cursor-pointer relative"
                        title="Custom border color"
                      >
                        <input
                          type="color"
                          aria-label="Custom border color"
                          value={selectedShape.borderColor}
                          onChange={(e) =>
                            updateSelectedShape(s => ({ ...s, borderColor: e.target.value }))
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <span
                          className="block w-full h-full"
                          style={{
                            background:
                              'conic-gradient(#64748b, #7c3aed, #2563eb, #059669, #d97706, #dc2626, #64748b)'
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Line Style & Width */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Line:
                    </span>
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {(
                        [
                          { id: 'dashed', label: 'Dashed' },
                          { id: 'dotted', label: 'Dotted' },
                          { id: 'solid', label: 'Solid' }
                        ] as Array<{ id: SimShapeLineStyle; label: string }>
                      ).map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            updateSelectedShape(s => ({ ...s, lineStyle: opt.id }))
                          }
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                            selectedShape.lineStyle === opt.id
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <select
                      aria-label="Border width"
                      value={selectedShape.borderWidth || 2}
                      onChange={(e) =>
                        updateSelectedShape(s => ({
                          ...s,
                          borderWidth: Number(e.target.value)
                        }))
                      }
                      className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <option value={1}>1px</option>
                      <option value={2}>2px</option>
                      <option value={3}>3px</option>
                      <option value={4}>4px</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Freeform Label Styling Bar */}
            {selectedDiagramLabel && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white shrink-0">
                      Diagram Label
                    </span>
                    <input
                      type="text"
                      aria-label="Diagram label text"
                      value={selectedDiagramLabel.text.replace(/\n/g, ' | ')}
                      maxLength={160}
                      placeholder="Type annotation (e.g. OSPF, AS-100, 10.0.16.0/24)..."
                      onChange={(e) => {
                        const val = e.target.value;
                        updateSelectedDiagramLabel(l => ({ ...l, text: val || 'Label' }));
                      }}
                      className="flex-1 min-w-[180px] max-w-sm px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDuplicateSelectedDiagramLabel}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold hover:border-blue-500 whitespace-nowrap"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDiagramLabel(selectedDiagramLabel.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-semibold hover:bg-red-100 whitespace-nowrap"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete Label</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {/* Text Color Swatches */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Color:
                    </span>
                    <div className="flex items-center gap-1">
                      {DIAGRAM_LABEL_COLORS.map(swatch => {
                        const active = (selectedDiagramLabel.color || '#7c3aed') === swatch.value;
                        return (
                          <button
                            key={swatch.value}
                            type="button"
                            title={swatch.label}
                            aria-label={`Label color ${swatch.label}`}
                            onClick={() =>
                              updateSelectedDiagramLabel(l => ({ ...l, color: swatch.value }))
                            }
                            className={`w-5 h-5 rounded-md border transition-transform ${
                              active
                                ? 'ring-2 ring-blue-600 dark:ring-cyan-400 scale-110 border-slate-900 dark:border-white'
                                : 'border-slate-300 dark:border-slate-600 hover:scale-105'
                            }`}
                            style={{ backgroundColor: swatch.value }}
                          />
                        );
                      })}
                      <label
                        className="w-5 h-5 rounded-md border border-slate-300 dark:border-slate-600 overflow-hidden cursor-pointer relative"
                        title="Custom text color"
                      >
                        <input
                          type="color"
                          aria-label="Custom label color"
                          value={selectedDiagramLabel.color || '#7c3aed'}
                          onChange={(e) =>
                            updateSelectedDiagramLabel(l => ({ ...l, color: e.target.value }))
                          }
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <span
                          className="block w-full h-full"
                          style={{
                            background:
                              'conic-gradient(#7c3aed, #2563eb, #059669, #d97706, #dc2626, #7c3aed)'
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Background Pill Option */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Backdrop:
                    </span>
                    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {[
                        { label: 'None', value: 'transparent' },
                        { label: 'Light Pill', value: '#ffffff' },
                        { label: 'Dark Pill', value: '#0f172a' }
                      ].map(opt => {
                        const active = (selectedDiagramLabel.bgColor || 'transparent') === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              updateSelectedDiagramLabel(l => ({ ...l, bgColor: opt.value }))
                            }
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                              active
                                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Size & Style */}
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Label font size"
                      value={selectedDiagramLabel.fontSize || 12}
                      onChange={(e) =>
                        updateSelectedDiagramLabel(l => ({
                          ...l,
                          fontSize: Number(e.target.value)
                        }))
                      }
                      className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <option value={10}>10px</option>
                      <option value={12}>12px</option>
                      <option value={14}>14px</option>
                      <option value={16}>16px</option>
                      <option value={18}>18px</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedDiagramLabel(l => ({ ...l, bold: l.bold === false }))
                      }
                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-colors ${
                        selectedDiagramLabel.bold !== false
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                      title="Toggle bold"
                    >
                      B
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedDiagramLabel(l => ({ ...l, italic: !l.italic }))
                      }
                      className={`px-2 py-0.5 rounded-lg border text-[11px] italic font-semibold transition-colors ${
                        selectedDiagramLabel.italic
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                      title="Toggle italic"
                    >
                      I
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Selected Link Inspector Bar */}
            {selectedLink && (
              <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Selected Cable: {CABLE_META[selectedLink.cableType].label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-600 dark:text-slate-300">
                    {devices.find(d => d.id === selectedLink.fromDeviceId)?.name} ({selectedLink.fromPort}) ↔{' '}
                    {devices.find(d => d.id === selectedLink.toDeviceId)?.name} ({selectedLink.toPort})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-semibold ${
                      linkStatuses.get(selectedLink.id)?.isUp
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {linkStatuses.get(selectedLink.id)?.reason}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteLink(selectedLink.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-semibold hover:bg-red-100 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>

          {/* Quick End-to-End Connectivity Tester */}
          <form
            onSubmit={handleQuickPing}
            className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3 shrink-0"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100 shrink-0">
              <Play className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
              <span>Packet Ping Test</span>
            </div>

            <select
              aria-label="Ping source device"
              value={pingSourceId}
              onChange={(e) => setPingSourceId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-100"
            >
              {devices
                .filter(d => d.type !== 'switch')
                .map(d => (
                  <option key={d.id} value={d.id}>
                    From: {d.name}
                  </option>
                ))}
            </select>

            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

            <input
              type="text"
              list="sim-known-ips"
              value={pingTargetIp}
              onChange={(e) => setPingTargetIp(e.target.value)}
              placeholder="Destination IPv4 (e.g. 192.168.20.10)"
              className="flex-1 min-w-[160px] px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="sim-known-ips">
              {knownDeviceIps.map((item, idx) => (
                <option key={idx} value={item.ip}>
                  {item.label}
                </option>
              ))}
            </datalist>

            <button
              type="submit"
              disabled={!pingSourceId || !pingTargetIp.trim()}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Send Ping
            </button>

            {lastPingResult && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs min-w-0 max-w-full ${
                  lastPingResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                }`}
              >
                {lastPingResult.success ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="font-mono truncate">{lastPingResult.summary}</span>
                <button
                  type="button"
                  onClick={() => setLastPingResult(null)}
                  aria-label="Dismiss ping result"
                  className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </form>
        </div>
        </div>
      ) : (
        /* My Lab Projects Repository View (Destination for Saved & Closed Lab Project Files) */
        <div className="space-y-6">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <Archive className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>Private to {currentUser.email}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {savedLabs.length} saved project{savedLabs.length === 1 ? '' : 's'}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  My Lab Projects
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Only your own saved and completed network lab projects appear here for reopening or exporting as portable JSON (.netlab.json) and PNG diagram files.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Filter saved lab projects"
                className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto"
              >
                <button
                  type="button"
                  onClick={() => setProjectFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    projectFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({savedLabs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectFilter('completed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    projectFilter === 'completed'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Completed ({savedLabs.filter(l => l.status === 'completed').length})
                </button>
                <button
                  type="button"
                  onClick={() => setProjectFilter('in_progress')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    projectFilter === 'in_progress'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  In Progress ({savedLabs.filter(l => l.status !== 'completed').length})
                </button>
              </div>
            </div>

            {isCloudAuthReady && savedLabs.some(l => l.syncStatus !== 'cloud') && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-blue-900 dark:text-cyan-200 font-medium">
                  Some saved project files are stored only in IndexedDB on this device.
                </span>
                <button
                  type="button"
                  disabled={isSavingLab}
                  onClick={handleSyncLocalLabsToCloud}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold whitespace-nowrap"
                >
                  Sync Local to Firestore
                </button>
              </div>
            )}

            {(() => {
              const filteredProjects = savedLabs.filter(item => {
                if (projectFilter === 'completed') return item.status === 'completed';
                if (projectFilter === 'in_progress') return item.status !== 'completed';
                return true;
              });

              if (filteredProjects.length === 0) {
                return (
                  <div className="py-12 text-center space-y-3">
                    <FolderOpen className="w-9 h-9 mx-auto text-slate-400" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {savedLabs.length === 0
                        ? 'No saved lab project files yet'
                        : 'No projects match this filter'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Start from a Blank Lab, design and configure your topology, and click &quot;Save &amp; Close Project&quot; to archive the project file here for later use.
                    </p>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleStartNewBlankLab}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Start Blank Lab</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  {filteredProjects.map(item => {
                    const presetMeta = NETWORK_LAB_PRESETS.find(p => p.id === item.presetId);
                    const isHighlighted =
                      recentlySavedProjectId === item.id || activeSavedLabId === item.id;
                    const isCompleted = item.status === 'completed';
                    return (
                      <div
                        key={item.id}
                        className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                          isHighlighted
                            ? 'bg-blue-50/70 dark:bg-blue-950/30'
                            : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <FileCode2 className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </h3>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                              ·
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                isCompleted
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5" />
                              )}
                              <span>{isCompleted ? 'Completed' : 'In Progress'}</span>
                            </span>
                            {recentlySavedProjectId === item.id && (
                              <>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                                  ·
                                </span>
                                <span className="font-semibold text-blue-600 dark:text-cyan-400">
                                  Just saved
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            <span>{toProjectFileName(item.title)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{presetMeta?.title || item.presetId}</span>
                            <span aria-hidden="true">·</span>
                            <span>
                              {item.deviceCount} devices, {item.linkCount} cables
                            </span>
                            {item.objectivesTotal > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {item.objectivesPassed}/{item.objectivesTotal} objectives
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>
                              {item.syncStatus === 'cloud'
                                ? 'Firestore + IndexedDB'
                                : 'IndexedDB Local'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>Updated {new Date(item.updatedAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResumeSavedLab(item)}
                            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            Open Project
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExportTopology(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                            title={`Export JSON (${toProjectFileName(item.title)})`}
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Export JSON</span>
                          </button>

                          <button
                            type="button"
                            disabled={
                              isExportingImage ||
                              (item.devices.length === 0 &&
                                (item.shapes?.length ?? 0) === 0 &&
                                (item.labels?.length ?? 0) === 0)
                            }
                            onClick={() => handleExportImage('png', item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap"
                            title={`Export high-resolution PNG diagram for ${item.title}`}
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                            <span>Export PNG</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicateSavedLab(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                            title="Create a copy of this lab project"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Duplicate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteSavedLab(item.id)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            aria-label={`Delete ${item.title}`}
                            title="Delete saved project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Pre-Built Topology Templates Library */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pre-Built Topology Templates Library
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Load a wired Star, LAN, WAN, Hierarchical Tree, or Mesh template to practice switching, VLANs, and routing.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Filter topology templates"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto"
              >
                <button
                  type="button"
                  onClick={() => setTemplateCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                    templateCategoryFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({templateLibraryItems.length})
                </button>
                {TEMPLATE_CATEGORIES.map(cat => {
                  const count = templateLibraryItems.filter(t => t.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTemplateCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                        templateCategoryFilter === cat
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map(item => (
                <div
                  key={item.preset.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2.5">
                    <TemplateTopologyPreview devices={item.devices} links={item.links} />
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-blue-600 dark:text-cyan-400 font-semibold tabular-nums">
                      <span>{item.category}</span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <span>{item.preset.difficulty}</span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                      <span className="text-slate-500 dark:text-slate-400 font-normal">
                        {item.devices.length} devices, {item.links.length} cables
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.preset.title}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.preset.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.preset.objectives.length} verification objectives
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSavedLabId(null);
                        handleSelectPreset(item.preset.id);
                        setWorkspaceView('editor');
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      Load Template
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visual Topology Templates Library Modal */}
      {isTemplatesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm"
          onClick={() => setIsTemplatesModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="templates-library-title"
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-mono font-semibold text-blue-600 dark:text-cyan-400">
                  Pre-Wired Topologies · {templateLibraryItems.length} practice templates
                </div>
                <h2
                  id="templates-library-title"
                  className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight"
                >
                  Network Topology Templates Library
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Pick a Star, Office LAN, Router-on-a-Stick VLAN, Serial WAN, Hub-and-Spoke, Tree, or OSPF Mesh topology to load onto the canvas immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplatesModalOpen(false)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close templates library"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Template categories"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  onClick={() => setTemplateCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                    templateCategoryFilter === 'all'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Templates ({templateLibraryItems.length})
                </button>
                {TEMPLATE_CATEGORIES.map(cat => {
                  const count = templateLibraryItems.filter(t => t.category === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setTemplateCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                        templateCategoryFilter === cat
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsTemplatesModalOpen(false);
                  handleStartNewBlankLab();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Blank Canvas</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(item => {
                const isActive = activePresetId === item.preset.id && activeSavedLabId === null;
                return (
                  <div
                    key={item.preset.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                      isActive
                        ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/25'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/35 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <TemplateTopologyPreview devices={item.devices} links={item.links} />

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums">
                        <span className="font-semibold text-blue-600 dark:text-cyan-400">
                          {item.category}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          {item.preset.difficulty}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {item.devices.length} nodes, {item.links.length} links
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.preset.title}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.preset.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {item.summaryCounts.routers}R / {item.summaryCounts.switches}SW /{' '}
                        {item.summaryCounts.endpoints}Hosts · {item.preset.objectives.length} goals
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSavedLabId(null);
                          handleSelectPreset(item.preset.id);
                          setWorkspaceView('editor');
                          setIsTemplatesModalOpen(false);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                      >
                        Load Template
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
