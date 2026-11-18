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
  Sliders,
  Table2,
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
  X
} from 'lucide-react';
import { useAcademy } from '../../context/AcademyContext';
import {
  auth,
  deleteLabTopologyFromFirestore,
  fetchLabTopologiesFromFirestore,
  saveLabTopologyToFirestore
} from '../../firebase';
import {
  SavedLabRecord,
  clearActiveLabDraftFromIdb,
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
  computeRoutingTable,
  createDefaultDevice,
  evaluateLinkStatus,
  executeDeviceCommand,
  getCliPrompt,
  getCliTabCompletions,
  isInterfaceLineProtocolUp,
  isPortCompatibleWithCable,
  isValidIp,
  isValidMask,
  maskToPrefix,
  simulatePing
} from './networkSimEngine';
import { NETWORK_LAB_PRESETS } from './networkLabPresets';
import { CiscoDeviceIcon, getCiscoDeviceInnerSvg } from './CiscoDeviceIcon';

type CanvasTool = 'select' | 'marquee' | 'pan' | 'cable' | 'delete';
type CableToolMode = 'auto' | SimCableType;
type InspectorTab = 'cli' | 'config' | 'tables' | 'objectives';

interface PendingCableSource {
  deviceId: string;
  portName?: string;
}

interface PendingCableTarget {
  deviceId: string;
}

interface SavedLabSnapshot {
  format?: string;
  title?: string;
  status?: 'in_progress' | 'completed';
  presetId: string;
  exportedAt?: string;
  studentEmail?: string;
  objectivesSummary?: {
    passed: number;
    total: number;
    completed: boolean;
  };
  devices: SimDevice[];
  links: SimLink[];
  shapes?: SimTopologyShape[];
  labels?: SimDiagramLabel[];
}

type ShapeResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type SnapGridStep = 10 | 20 | 40;

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
  mode: AutoLayoutMode
): SimDevice[] {
  if (currentDevices.length === 0) return currentDevices;
  if (currentDevices.length === 1) {
    return currentDevices.map(d => ({ ...d, x: 500, y: 288 }));
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
    const rx = n <= 3 ? 210 : Math.min(355, 190 + n * 16);
    const ry = n <= 3 ? 135 : Math.min(198, 125 + n * 8);

    ordered.forEach((dev, idx) => {
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / n;
      const x = Math.round(Math.min(925, Math.max(75, 500 + rx * Math.cos(angle))));
      const y = Math.round(Math.min(505, Math.max(70, 288 + ry * Math.sin(angle))));
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

    const MAX_PER_ROW = 5;
    const rows: SimDevice[][] = [
      ...chunkEvenly(routers, MAX_PER_ROW),
      ...chunkEvenly(switches, MAX_PER_ROW),
      ...chunkEvenly(endpoints, MAX_PER_ROW)
    ];

    const minY = 92;
    const maxY = 486;
    const rowCount = rows.length;

    rows.forEach((row, rIdx) => {
      const y =
        rowCount === 1
          ? 288
          : rowCount === 2
          ? rIdx === 0
            ? 175
            : 400
          : Math.round(minY + (rIdx * (maxY - minY)) / (rowCount - 1));

      const count = row.length;
      const colStep = count > 1 ? Math.min(185, 810 / (count - 1)) : 0;
      const startX = 500 - ((count - 1) * colStep) / 2;

      row.forEach((dev, cIdx) => {
        const x = Math.round(Math.min(925, Math.max(75, startX + cIdx * colStep)));
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
  const [isRenamingInspectorHeader, setIsRenamingInspectorHeader] = useState<boolean>(false);
  const [inspectorNameDraft, setInspectorNameDraft] = useState<string>('');
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('objectives');
  const [consoleDeviceId, setConsoleDeviceId] = useState<string | null>(null);
  const [longPressMoveDeviceId, setLongPressMoveDeviceId] = useState<string | null>(null);
  const draggedPaletteTypeRef = useRef<SimDeviceType | null>(null);
  const [paletteDropPreview, setPaletteDropPreview] = useState<{
    type: SimDeviceType;
    x: number;
    y: number;
  } | null>(null);
  const suppressDeviceClickAfterDragRef = useRef<boolean>(false);

  useEffect(() => {
    setIsRenamingInspectorHeader(false);
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!consoleDeviceId) {
      setInspectorTab('objectives');
    } else if (!devices.some(d => d.id === consoleDeviceId)) {
      setConsoleDeviceId(null);
    }
  }, [consoleDeviceId, devices]);

  // CLI state
  const [cliInput, setCliInput] = useState<string>('');
  const [cmdHistoryMap, setCmdHistoryMap] = useState<Record<string, string[]>>({});
  const [cmdCursor, setCmdCursor] = useState<number>(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const cliInputRef = useRef<HTMLInputElement>(null);

  // Viewport & logical canvas refs (zoom/pan wrapper + 1000x580 stage)
  const viewportRef = useRef<HTMLDivElement>(null);
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
  const devicesRef = useRef<SimDevice[]>(devices);
  devicesRef.current = devices;
  const shapesRef = useRef<SimTopologyShape[]>(shapes);
  shapesRef.current = shapes;
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<SnapGridStep>(20);
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

  // Static route & VLAN quick-add form state
  const [newRouteNet, setNewRouteNet] = useState('');
  const [newRouteMask, setNewRouteMask] = useState('255.255.255.0');
  const [newRouteHop, setNewRouteHop] = useState('');
  const [newSubIfId, setNewSubIfId] = useState('');
  const [newVlanId, setNewVlanId] = useState('');
  const [newVlanName, setNewVlanName] = useState('');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
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

      if (draft) {
        setActivePresetId(draft.presetId);
        setDevices(draft.devices);
        setLinks(draft.links);
        setShapes(Array.isArray(draft.shapes) ? draft.shapes : []);
        setDiagramLabels(Array.isArray(draft.labels) ? draft.labels : []);
        setActiveSavedLabId(draft.activeSavedLabId || null);
        const firstId = draft.devices[0]?.id || null;
        setSelectedDeviceId(firstId);
        setSelectedDeviceIds(firstId ? [firstId] : []);
        setConsoleDeviceId(null);
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        setSelectedDiagramLabelId(null);
        setLastPingResult(null);
        setLastAutoSavedAt(draft.updatedAt);
      } else {
        setActivePresetId('blank-sandbox');
        setDevices([]);
        setLinks([]);
        setShapes([]);
        setDiagramLabels([]);
        setActiveSavedLabId(null);
        setSelectedDeviceId(null);
        setSelectedDeviceIds([]);
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
      activePresetId !== 'blank-sandbox';

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
  }, [activePresetId, activeSavedLabId, ownerScopeId, devices, links, shapes, diagramLabels, workspaceView]);

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

  const isConsoleActive = Boolean(
    selectedDevice && consoleDeviceId === selectedDevice.id && selectedDeviceIds.length <= 1
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

  // Scroll terminal to bottom on new output
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedDevice?.cliHistory.length]);

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
      e.preventDefault();
      const vRect = viewport.getBoundingClientRect();
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
        Math.max(0.4, Number((curZoom * Math.exp(-clampedDelta * sensitivity)).toFixed(4)))
      );
      if (nextZoom === curZoom) return;

      const mouseX = e.clientX - vRect.left;
      const mouseY = e.clientY - vRect.top;
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

  // Pointer drag, viewport pan, & marquee selection box handling for topology canvas nodes
  useEffect(() => {
    const clientToCanvas = (clientX: number, clientY: number, rect: DOMRect) => ({
      x: Math.min(1000, Math.max(0, ((clientX - rect.left) / rect.width) * 1000)),
      y: Math.min(580, Math.max(0, ((clientY - rect.top) / rect.height) * 580))
    });

    const handlePointerMove = (e: PointerEvent) => {
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
          975,
          step,
          snapActive
        );
        const nextY = snapClampedToGrid(
          diagramLabelDrag.initY + (curr.y - diagramLabelDrag.startCanvasY),
          18,
          562,
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
        const maxOx = Math.min(220, 958 - labelDrag.devX);
        const minOy = Math.max(-180, 14 - (labelDrag.devY + 34));
        const maxOy = Math.min(180, 558 - (labelDrag.devY + 34));
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
        const maxDx = 940 - maxInitX;
        const minDy = 60 - minInitY;
        const maxDy = 520 - maxInitY;

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
          right = snapClampedToGrid(initRight + dx, initLeft + minW, 996, step, snapActive);
        }
        if (shapeResize.handle.includes('n')) {
          top = snapClampedToGrid(initTop + dy, 4, initBottom - minH, step, snapActive);
        }
        if (shapeResize.handle.includes('s')) {
          bottom = snapClampedToGrid(initBottom + dy, initTop + minH, 576, step, snapActive);
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
              bottom = Math.min(576, top + adjH);
            }
          } else {
            const adjW = Math.max(minW, nextH * ratio);
            if (shapeResize.handle.includes('w')) {
              left = Math.max(4, right - adjW);
            } else {
              right = Math.min(996, left + adjW);
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
          996 - shapeDrag.width,
          step,
          snapActive
        );
        const nextY = snapClampedToGrid(
          shapeDrag.initY + rawDy,
          4,
          576 - shapeDrag.height,
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
      panStateRef.current = null;
      dragStateRef.current = null;
      marqueeStateRef.current = null;
      rotateStateRef.current = null;
      shapeDragStateRef.current = null;
      shapeResizeStateRef.current = null;
      labelDragStateRef.current = null;
      diagramLabelDragStateRef.current = null;
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

      const startCanvasX = Math.min(
        1000,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000)
      );
      const startCanvasY = Math.min(
        580,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * 580)
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

      const startCanvasX = Math.min(
        1000,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000)
      );
      const startCanvasY = Math.min(
        580,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * 580)
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

  const flashBanner = (msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => {
      setStatusBanner(prev => (prev === msg ? null : prev));
    }, 3600);
  };

  const zoomAtViewportCenter = useCallback((targetZoom: number) => {
    const nextZoom = Math.min(2.75, Math.max(0.4, Number(targetZoom.toFixed(4))));
    const curZoom = zoomRef.current;
    const curPan = panRef.current;
    const viewport = viewportRef.current;
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

  const handleFitToView = useCallback(() => {
    const viewport = viewportRef.current;
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
      handleResetZoomPan();
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

    const baseScaleX = vRect.width / 1000;
    const baseScaleY = vRect.height / 580;
    const contentPxW = Math.max(60, (maxX - minX) * baseScaleX);
    const contentPxH = Math.max(60, (maxY - minY) * baseScaleY);

    const fitZoom = Math.min(
      2.0,
      Math.max(
        0.4,
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
  }, [devices, shapes, diagramLabels, handleResetZoomPan]);

  // Load or reset preset
  const handleSelectPreset = (presetId: string) => {
    const preset = NETWORK_LAB_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const built = preset.buildInitialState();
    setActivePresetId(preset.id);
    setDevices(built.devices);
    setLinks(built.links);
    setShapes([]);
    setDiagramLabels([]);
    const firstId = built.devices[0]?.id || null;
    setSelectedDeviceId(firstId);
    setSelectedDeviceIds(firstId ? [firstId] : []);
    setConsoleDeviceId(null);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    setLastPingResult(null);
    setInspectorTab('objectives');
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
      setDevices(prev => computeAutoLayoutPositions(prev, links, mode));
      flashBanner(
        `Arranged ${devices.length} device${devices.length === 1 ? '' : 's'} in ${
          mode === 'grid' ? 'Grid' : 'Circular'
        } layout`
      );
    },
    [autoLayoutMode, devices.length, links]
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
    const offset = (devices.length % 6) * 42;
    const rawX = dropX !== undefined ? dropX : 240 + (devices.length % 4) * 165;
    const rawY = dropY !== undefined ? dropY : 140 + offset;
    const newDev = createDefaultDevice(
      type,
      name,
      snapClampedToGrid(rawX, 60, 940, gridSize, snapToGrid),
      snapClampedToGrid(rawY, 60, 520, gridSize, snapToGrid)
    );
    setDevices(prev => [...prev, newDev]);
    setSelectedDeviceId(null);
    setSelectedDeviceIds([]);
    setConsoleDeviceId(null);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setTool('select');
    setInspectorTab('objectives');
  };

  const handleAddShape = (kind: SimShapeKind) => {
    let x = snapClampedToGrid(280 + ((shapes.length * 36) % 240), 4, 720, gridSize, snapToGrid);
    let y = snapClampedToGrid(140 + ((shapes.length * 28) % 180), 4, 360, gridSize, snapToGrid);
    let width = snapClampedToGrid(kind === 'circle' ? 210 : 260, 80, 400, gridSize, snapToGrid);
    let height = snapClampedToGrid(kind === 'circle' ? 210 : 160, 80, 400, gridSize, snapToGrid);

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
        x = snapClampedToGrid(minX - padX, 8, 840, gridSize, snapToGrid);
        y = snapClampedToGrid(minY - padTop, 8, 440, gridSize, snapToGrid);
        width = snapClampedToGrid(maxX - minX + padX * 2, 140, 992 - x, gridSize, snapToGrid);
        height = snapClampedToGrid(maxY - minY + padTop + padBottom, 120, 572 - y, gridSize, snapToGrid);
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
      x: Math.min(992 - selectedShape.width, selectedShape.x + 28),
      y: Math.min(572 - selectedShape.height, selectedShape.y + 24),
      label: selectedShape.label ? `${selectedShape.label} Copy` : undefined
    };
    setShapes(prev => [...prev, copy]);
    setSelectedShapeId(copy.id);
  }, [selectedShape]);

  const handleAddDiagramLabel = () => {
    const newId = `label-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const x = 360 + ((diagramLabels.length * 42) % 280);
    const y = 160 + ((diagramLabels.length * 32) % 220);
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
      x: Math.min(975, selectedDiagramLabel.x + 28),
      y: Math.min(560, selectedDiagramLabel.y + 24)
    };
    setDiagramLabels(prev => [...prev, copy]);
    setSelectedDiagramLabelId(copy.id);
  }, [selectedDiagramLabel]);

  const handleDeleteDevice = useCallback(
    (deviceId: string) => {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setLinks(prev => prev.filter(l => l.fromDeviceId !== deviceId && l.toDeviceId !== deviceId));
      const remaining = selectedDeviceIds.filter(id => id !== deviceId);
      setSelectedDeviceIds(remaining);
      setSelectedDeviceId(cur => (cur === deviceId ? remaining[0] || null : cur));
      setConsoleDeviceId(cur => (cur === deviceId ? null : cur));
      setPendingCableSource(prev => (prev?.deviceId === deviceId ? null : prev));
      setPendingCableTarget(prev => (prev?.deviceId === deviceId ? null : prev));
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
    setConsoleDeviceId(cur => (cur && deleteSet.has(cur) ? null : cur));
    setPendingCableSource(prev => (prev && deleteSet.has(prev.deviceId) ? null : prev));
    setPendingCableTarget(prev => (prev && deleteSet.has(prev.deviceId) ? null : prev));
    flashBanner(`Removed ${count} selected device${count === 1 ? '' : 's'} and attached cables`);
  }, [selectedDeviceIds]);

  const handleDeleteLink = useCallback((linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
    setSelectedLinkId(prev => (prev === linkId ? null : prev));
  }, []);

  const commitDeviceRename = useCallback((deviceId: string, rawName: string) => {
    const trimmed = rawName.trim().slice(0, 64);
    if (trimmed) {
      setDevices(prev => prev.map(d => (d.id === deviceId ? { ...d, name: trimmed } : d)));
    }
    setEditingDeviceLabelId(prev => (prev === deviceId ? null : prev));
    setIsRenamingInspectorHeader(false);
  }, []);

  const startCanvasLabelEdit = useCallback((dev: SimDevice) => {
    setSelectedDeviceIds([dev.id]);
    setSelectedDeviceId(dev.id);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setEditingDeviceLabelId(dev.id);
    setEditingDeviceLabelDraft(dev.name);
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
        setIsRenamingInspectorHeader(false);
        setSelectedDeviceIds([]);
        setSelectedDeviceId(null);
        setConsoleDeviceId(null);
        setSelectedLinkId(null);
        setSelectedShapeId(null);
        setSelectedDiagramLabelId(null);
        setPendingCableSource(null);
        setPendingCableTarget(null);
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
    devices,
    handleDeleteDiagramLabel,
    handleDeleteLink,
    handleDeleteSelectedDevices,
    handleDeleteShape,
    isSavePromptOpen,
    isTemplatesModalOpen,
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
      if (cableToolMode === 'auto') {
        if (!pendingCableSource) {
          setPendingCableSource({ deviceId: device.id });
          setPendingCableTarget(null);
          return;
        }
        if (pendingCableSource.deviceId === device.id) {
          setPendingCableSource(null);
          setPendingCableTarget(null);
          return;
        }
        const sourceDev = devices.find(d => d.id === pendingCableSource.deviceId);
        if (!sourceDev) {
          setPendingCableSource(null);
          return;
        }

        const candidateOrder: SimCableType[] = (() => {
          const pair = new Set([sourceDev.type, device.type]);
          if (sourceDev.type === 'switch' && device.type === 'switch') {
            return ['crossover', 'fiber', 'straight'];
          }
          if (pair.has('switch')) {
            return ['straight', 'fiber', 'crossover'];
          }
          if (sourceDev.type === 'router' && device.type === 'router') {
            return ['crossover', 'serial', 'fiber', 'straight'];
          }
          return ['crossover', 'straight', 'fiber'];
        })();

        let chosenType: SimCableType | null = null;
        let chosenFromPort: string | null = null;
        let chosenToPort: string | null = null;

        for (const ct of candidateOrder) {
          const fromIface = sourceDev.interfaces.find(
            i =>
              i.kind !== 'subinterface' &&
              !isPortInUse(sourceDev.id, i.name) &&
              isPortCompatibleWithCable(i, ct)
          );
          const toIface = device.interfaces.find(
            i =>
              i.kind !== 'subinterface' &&
              !isPortInUse(device.id, i.name) &&
              isPortCompatibleWithCable(i, ct)
          );
          if (fromIface && toIface) {
            chosenType = ct;
            chosenFromPort = fromIface.name;
            chosenToPort = toIface.name;
            break;
          }
        }

        if (!chosenType || !chosenFromPort || !chosenToPort) {
          flashBanner(`No free compatible ports between ${sourceDev.name} and ${device.name}`);
          setPendingCableSource(null);
          setPendingCableTarget(null);
          return;
        }

        const newLink: SimLink = {
          id: `link-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          cableType: chosenType,
          fromDeviceId: sourceDev.id,
          fromPort: chosenFromPort,
          toDeviceId: device.id,
          toPort: chosenToPort
        };
        const status = evaluateLinkStatus(newLink, devices);
        setLinks(prev => [...prev, newLink]);
        setSelectedLinkId(newLink.id);
        setPendingCableSource(null);
        setPendingCableTarget(null);
        flashBanner(
          status.isUp
            ? `Auto-connected ${sourceDev.name} ↔ ${device.name} (${CABLE_META[chosenType].short})`
            : `Auto-attached ${CABLE_META[chosenType].short} cable (${status.reason})`
        );
        return;
      }

      if (!pendingCableSource) {
        setPendingCableSource({ deviceId: device.id });
        setPendingCableTarget(null);
        return;
      }
      if (pendingCableSource.deviceId === device.id) {
        setPendingCableSource(null);
        setPendingCableTarget(null);
        return;
      }
      if (!pendingCableSource.portName) {
        // User hadn't picked port on source yet; switch source
        setPendingCableSource({ deviceId: device.id });
        return;
      }
      setPendingCableTarget({ deviceId: device.id });
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
      setConsoleDeviceId(null);
      setSelectedLinkId(null);
      setSelectedShapeId(null);
      setSelectedDiagramLabelId(null);
      return;
    }

    setSelectedDeviceIds([device.id]);
    setSelectedDeviceId(device.id);
    if (consoleDeviceId !== device.id) {
      setConsoleDeviceId(null);
    }
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
  };

  // Run CLI command on selected device
  const handleRunCliCommand = (e?: React.FormEvent, overrideCmd?: string) => {
    if (e) e.preventDefault();
    if (!selectedDevice) return;
    const raw = (overrideCmd ?? cliInput).trim();
    if (!raw) return;

    const result = executeDeviceCommand(selectedDevice, raw, devices, links);
    setDevices(prev => prev.map(d => (d.id === selectedDevice.id ? result.updatedDevice : d)));

    if (!overrideCmd) {
      setCliInput('');
    }
    setCmdHistoryMap(prev => ({
      ...prev,
      [selectedDevice.id]: [...(prev[selectedDevice.id] || []), raw]
    }));
    setCmdCursor(-1);

    if (result.pingResult) {
      setLastPingResult(result.pingResult);
    }
    recordStudyTime(15, 'lab');
  };

  const handleCliKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selectedDevice) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const { completed, suggestions } = getCliTabCompletions(selectedDevice, cliInput);
      if (completed !== cliInput) {
        setCliInput(completed);
      } else if (suggestions.length > 0) {
        const prompt = getCliPrompt(selectedDevice);
        const hintLines = [
          `${prompt} ${cliInput}`,
          suggestions.slice(0, 12).join('    ')
        ];
        setDevices(prev =>
          prev.map(d =>
            d.id === selectedDevice.id
              ? { ...d, cliHistory: [...d.cliHistory, ...hintLines] }
              : d
          )
        );
      }
      return;
    }

    const cmds = cmdHistoryMap[selectedDevice.id] || [];
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
    setInspectorTab('objectives');
  };

  // Update selected device helper
  const updateSelectedDevice = (updater: (dev: SimDevice) => SimDevice) => {
    if (!selectedDeviceId) return;
    setDevices(prev => prev.map(d => (d.id === selectedDeviceId ? updater(d) : d)));
  };

  const handleStartNewBlankLab = () => {
    const blankPreset = NETWORK_LAB_PRESETS.find(p => p.id === 'blank-sandbox') || NETWORK_LAB_PRESETS[0];
    setActivePresetId(blankPreset.id);
    setDevices([]);
    setLinks([]);
    setShapes([]);
    setDiagramLabels([]);
    setActiveSavedLabId(null);
    setSelectedDeviceId(null);
    setSelectedDeviceIds([]);
    setConsoleDeviceId(null);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    setLastPingResult(null);
    setRecentlySavedProjectId(null);
    setIsSavePromptOpen(false);
    setInspectorTab('objectives');
    handleResetZoomPan();
    setWorkspaceView('editor');
    flashBanner('Started a new Blank Lab Project');
  };

  const handleExportTopology = (record?: SavedLabRecord) => {
    if (!record && devices.length === 0 && shapes.length === 0 && diagramLabels.length === 0) {
      flashBanner('Place at least one device, zone, or label before exporting a topology JSON file');
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

    const payload: SavedLabSnapshot = {
      format: 'netplus-lab-project-v1',
      title: exportTitle,
      status: resolvedStatus,
      presetId: record?.presetId || activePresetId,
      exportedAt: new Date().toISOString(),
      studentEmail: currentUser.email,
      ...(objectivesSummary ? { objectivesSummary } : {}),
      devices: record ? record.devices : devices,
      links: record ? record.links : links,
      shapes: record ? record.shapes || [] : shapes,
      labels: record ? record.labels || [] : diagramLabels
    };
    const filename = toProjectFileName(exportTitle);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    flashBanner(`Exported topology JSON (${filename})`);
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

    const options = {
      title,
      subtitle,
      devices: targetDevices,
      links: targetLinks,
      shapes: targetShapes,
      labels: targetLabels,
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
      flashBanner(`Exported high-resolution PNG diagram 2000×1380 (${filename})`);
    } catch {
      flashBanner('Could not export PNG diagram in this browser; try SVG export');
    } finally {
      setIsExportingImage(false);
    }
  };

  const handleImportTopology = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (Array.isArray(parsed.devices) && Array.isArray(parsed.links)) {
          setActivePresetId(typeof parsed.presetId === 'string' ? parsed.presetId : 'blank-sandbox');
          setDevices(parsed.devices);
          setLinks(parsed.links);
          setShapes(Array.isArray(parsed.shapes) ? sanitizeShapesForStorage(parsed.shapes) : []);
          setDiagramLabels(Array.isArray(parsed.labels) ? sanitizeLabelsForStorage(parsed.labels) : []);
          setActiveSavedLabId(null);
          const firstImportedId = parsed.devices[0]?.id || null;
          setSelectedDeviceId(firstImportedId);
          setSelectedDeviceIds(firstImportedId ? [firstImportedId] : []);
          setConsoleDeviceId(null);
          setSelectedLinkId(null);
          setSelectedShapeId(null);
          setSelectedDiagramLabelId(null);
          if (typeof parsed.title === 'string' && parsed.title.trim()) {
            setSaveTitleInput(parsed.title.trim());
          }
          handleResetZoomPan();
          setWorkspaceView('editor');
          flashBanner(
            `Opened project file "${typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : file.name}"`
          );
        } else {
          flashBanner('Invalid lab project file format');
        }
      } catch {
        flashBanner('Could not parse lab project JSON file');
      }
    };
    reader.readAsText(file);
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
        setDevices([]);
        setLinks([]);
        setShapes([]);
        setActiveSavedLabId(null);
        setSelectedDeviceId(null);
        setSelectedDeviceIds([]);
        setConsoleDeviceId(null);
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
    setActivePresetId(record.presetId);
    setDevices(record.devices);
    setLinks(record.links);
    setShapes(Array.isArray(record.shapes) ? record.shapes : []);
    setDiagramLabels(Array.isArray(record.labels) ? record.labels : []);
    setActiveSavedLabId(record.id);
    setSaveTitleInput(record.title);
    const firstId = record.devices[0]?.id || null;
    setSelectedDeviceId(firstId);
    setSelectedDeviceIds(firstId ? [firstId] : []);
    setConsoleDeviceId(null);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedDiagramLabelId(null);
    setEditingDiagramLabelId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    setLastPingResult(null);
    setRecentlySavedProjectId(null);
    handleResetZoomPan();
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

  const routingTable = useMemo(
    () => (selectedDevice?.type === 'router' ? computeRoutingTable(selectedDevice, devices, links) : []),
    [devices, links, selectedDevice]
  );

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
      right: Math.min(992, maxX + 48),
      top: Math.max(8, minY - 46),
      bottom: Math.min(572, maxY + 52)
    };
  }, [devices, selectedDeviceIds, tool]);

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

              <button
                type="button"
                disabled={devices.length === 0 && shapes.length === 0 && diagramLabels.length === 0}
                onClick={() => handleExportTopology()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                title="Export topology & device configurations as JSON (.netlab.json)"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Export JSON</span>
              </button>

              <button
                type="button"
                disabled={(devices.length === 0 && shapes.length === 0 && diagramLabels.length === 0) || isExportingImage}
                onClick={() => handleExportImage('png')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                title="Export high-resolution PNG diagram (2000×1380)"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>{isExportingImage ? 'Exporting PNG...' : 'Export PNG'}</span>
              </button>

              <button
                type="button"
                disabled={devices.length === 0 && shapes.length === 0 && diagramLabels.length === 0}
                onClick={() => handleExportImage('svg')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                title="Export scalable SVG vector diagram"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Export SVG</span>
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

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            title="Open a saved .netlab.json project file from your device"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import File</span>
          </button>
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
        <div className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-900 dark:text-cyan-200 flex items-center justify-between gap-2">
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-blue-600 dark:text-cyan-300 font-semibold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {workspaceView === 'editor' ? (
        <>
          {/* Design Palette & Cabling Toolbar */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
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

          <span className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5 hidden sm:inline-block" aria-hidden="true" />

          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
            Group Zone:
          </span>

          <button
            type="button"
            onClick={() => handleAddShape('rectangle')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-xs font-semibold text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-colors whitespace-nowrap shrink-0"
            title="Add a resizable Rectangle grouping box (auto-wraps selected devices)"
          >
            <Square className="w-3.5 h-3.5" />
            <span>Rectangle</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddShape('circle')}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-xs font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors whitespace-nowrap shrink-0"
            title="Add a resizable Circle / Oval grouping zone (auto-wraps selected devices)"
          >
            <Circle className="w-3.5 h-3.5" />
            <span>Circle</span>
          </button>

          <button
            type="button"
            onClick={handleAddDiagramLabel}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors whitespace-nowrap shrink-0"
            title="Add a movable text label anywhere on the topology diagram (e.g. OSPF, VLAN 10, 10.0.0.0/24)"
          >
            <Type className="w-3.5 h-3.5" />
            <span>Label</span>
          </button>
        </div>

        {/* Canvas Tools & Auto-Layout */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-full">
            <button
              type="button"
              onClick={() => {
                setTool('select');
                setPendingCableSource(null);
                setPendingCableTarget(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tool === 'select'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>Select &amp; Move</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('marquee');
                setPendingCableSource(null);
                setPendingCableTarget(null);
              }}
              title="Drag a rectangular marquee anywhere on the canvas to select multiple devices and move them as a group (hold Shift to add)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tool === 'marquee'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SquareDashedMousePointer className="w-3.5 h-3.5" />
              <span>Marquee</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('pan');
                setPendingCableSource(null);
                setPendingCableTarget(null);
              }}
              title="Drag to pan canvas (or hold Space + drag, or middle-mouse drag)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tool === 'pan'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Hand className="w-3.5 h-3.5" />
              <span>Pan</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTool('delete');
                setPendingCableSource(null);
                setPendingCableTarget(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tool === 'delete'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              aria-pressed={snapToGrid}
              onClick={() => setSnapToGrid(prev => !prev)}
              title="Toggle Snap-to-Grid alignment while dragging devices and shapes (hold Alt to temporarily bypass)"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                snapToGrid
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Snap</span>
            </button>

            <select
              aria-label="Grid Snap Size"
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value) as SnapGridStep)}
              title="Grid snap increment (logical canvas units)"
              className="px-2 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10px</option>
              <option value={20}>20px</option>
              <option value={40}>40px</option>
            </select>
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
        </div>
      </div>

      {/* Main Two-Zone Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start min-w-0">
        {/* Left Zone (7 cols): Interactive Topology Canvas + Quick Ping Bar */}
        <div className="xl:col-span-7 space-y-4 min-w-0">
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Canvas Info Strip */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-xs">
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
                          title="Rename device label (F2 or double-click label on canvas)"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Rename</span>
                        </button>
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
                      {cableToolMode === 'auto'
                        ? pendingCableSource
                          ? `Auto-cable from ${devices.find(d => d.id === pendingCableSource.deviceId)?.name} — click target device`
                          : 'Auto-Choose Cable: click source device, then target device'
                        : pendingCableSource?.portName
                        ? `Source ${devices.find(d => d.id === pendingCableSource.deviceId)?.name} (${pendingCableSource.portName}) — click target device`
                        : `Click first device to attach ${CABLE_META[selectedCableType].short} cable (${CABLE_META[selectedCableType].hint})`}
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

              {/* Cable Legend */}
              <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
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
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const rect = canvas.getBoundingClientRect();
                  if (rect.width <= 0 || rect.height <= 0) return;
                  const rawX = ((e.clientX - rect.left) / rect.width) * 1000;
                  const rawY = ((e.clientY - rect.top) / rect.height) * 580;
                  const x = snapClampedToGrid(rawX, 60, 940, gridSize, snapToGrid);
                  const y = snapClampedToGrid(rawY, 60, 520, gridSize, snapToGrid);
                  setPaletteDropPreview(prev =>
                    prev && prev.type === activeType && prev.x === x && prev.y === y
                      ? prev
                      : { type: activeType, x, y }
                  );
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setPaletteDropPreview(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
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
                const rawX = ((e.clientX - rect.left) / rect.width) * 1000;
                const rawY = ((e.clientY - rect.top) / rect.height) * 580;
                handleAddDevice(dropType, rawX, rawY);
              }}
              onPointerDownCapture={(e) => {
                const targetEl = e.target as HTMLElement | null;
                if (targetEl?.closest('[data-zoom-hud="true"]')) return;
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
                    1000,
                    Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000)
                  );
                  const startCanvasY = Math.min(
                    580,
                    Math.max(0, ((e.clientY - rect.top) / rect.height) * 580)
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
                if (tool !== 'select' || isSpacePanningRef.current || e.button !== 0) return;
                if (e.target !== viewportRef.current && e.target !== canvasRef.current) return;
                const canvas = canvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) return;

                const startCanvasX = Math.min(1000, Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000));
                const startCanvasY = Math.min(580, Math.max(0, ((e.clientY - rect.top) / rect.height) * 580));

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
                  e.target === viewportRef.current || e.target === canvasRef.current;
                if (clickedStage || (tool === 'marquee' && !(e.target as HTMLElement | null)?.closest('[data-device-id]'))) {
                  setSelectedLinkId(null);
                  setSelectedShapeId(null);
                  setSelectedDiagramLabelId(null);
                  setConsoleDeviceId(null);
                  if ((tool === 'select' || tool === 'marquee') && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
                    setSelectedDeviceIds([]);
                    setSelectedDeviceId(null);
                  }
                }
              }}
              className={`relative w-full aspect-[1000/580] min-h-[260px] sm:min-h-[380px] bg-slate-100/80 dark:bg-[#050914] select-none overflow-hidden ${
                isPanningActive
                  ? 'cursor-grabbing'
                  : tool === 'pan' || isSpacePanning
                  ? 'cursor-grab'
                  : tool === 'marquee'
                  ? 'cursor-crosshair'
                  : ''
              }`}
            >
              <div
                ref={canvasRef}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0'
                }}
                className="relative w-full h-full bg-slate-50 dark:bg-[#090f1d] shadow-xs ring-1 ring-slate-200/70 dark:ring-slate-800/70"
              >
              {/* True-Coordinate Logical SVG Grid Backdrop */}
              <svg
                viewBox="0 0 1000 580"
                className="absolute inset-0 w-full h-full pointer-events-none z-0"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <pattern
                    id="sim-snap-grid-pattern"
                    width={gridSize}
                    height={gridSize}
                    patternUnits="userSpaceOnUse"
                  >
                    {snapToGrid ? (
                      <path
                        d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                        fill="none"
                        stroke="rgba(148,163,184,0.18)"
                        strokeWidth="0.7"
                      />
                    ) : (
                      <circle
                        cx={gridSize / 2}
                        cy={gridSize / 2}
                        r="0.9"
                        fill="rgba(148,163,184,0.22)"
                      />
                    )}
                  </pattern>
                </defs>
                <rect width="1000" height="580" fill="url(#sim-snap-grid-pattern)" />
                {activeSnapGuides?.x !== undefined && (
                  <line
                    x1={activeSnapGuides.x}
                    y1={0}
                    x2={activeSnapGuides.x}
                    y2={580}
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
                    x2={1000}
                    y2={activeSnapGuides.y}
                    stroke="#0ea5e9"
                    strokeWidth={1.1}
                    strokeDasharray="4 4"
                    strokeOpacity={0.75}
                  />
                )}
              </svg>
              {/* SVG Grouping Shapes Layer (Rendered Behind Cables & Devices) */}
              {shapes.length > 0 && (
                <svg
                  viewBox="0 0 1000 580"
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
                        1000,
                        Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000)
                      );
                      const startCanvasY = Math.min(
                        580,
                        Math.max(0, ((e.clientY - rect.top) / rect.height) * 580)
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
                    left: `${(selectedShape.x / 1000) * 100}%`,
                    top: `${(selectedShape.y / 580) * 100}%`,
                    width: `${(selectedShape.width / 1000) * 100}%`,
                    height: `${(selectedShape.height / 580) * 100}%`
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
                          1000,
                          Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000)
                        );
                        const startCanvasY = Math.min(
                          580,
                          Math.max(0, ((e.clientY - rect.top) / rect.height) * 580)
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
                    left: `${(activeShapeResizeInfo.x / 1000) * 100}%`,
                    top: `${Math.max(4, ((activeShapeResizeInfo.y - 12) / 580) * 100)}%`
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
                    left: `${(activeSnapGuides.readout.x / 1000) * 100}%`,
                    top: `${Math.max(5, (activeSnapGuides.readout.y / 580) * 100)}%`
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
                    left: `${(Math.min(selectionBox.startX, selectionBox.currentX) / 1000) * 100}%`,
                    top: `${(Math.min(selectionBox.startY, selectionBox.currentY) / 580) * 100}%`,
                    width: `${(Math.abs(selectionBox.currentX - selectionBox.startX) / 1000) * 100}%`,
                    height: `${(Math.abs(selectionBox.currentY - selectionBox.startY) / 580) * 100}%`
                  }}
                >
                  <div
                    className={`absolute ${
                      Math.max(selectionBox.startY, selectionBox.currentY) > 540
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
                    left: `${(selectedGroupBounds.left / 1000) * 100}%`,
                    top: `${(selectedGroupBounds.top / 580) * 100}%`,
                    width: `${((selectedGroupBounds.right - selectedGroupBounds.left) / 1000) * 100}%`,
                    height: `${((selectedGroupBounds.bottom - selectedGroupBounds.top) / 580) * 100}%`
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
                      selectedGroupBounds.bottom > 542
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
                    left: `${(activeRotationInfo.x / 1000) * 100}%`,
                    top: `${Math.max(4, ((activeRotationInfo.y - 54) / 580) * 100)}%`
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
                viewBox="0 0 1000 580"
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

                  // Compute endpoint LED and per-interface label geometry near each device
                  const geom = computeCableGeometry(fromDev.x, fromDev.y, toDev.x, toDev.y);

                  const fromIf = fromDev.interfaces.find(i => i.name === link.fromPort);
                  const toIf = toDev.interfaces.find(i => i.name === link.toPort);
                  const fromPortLabel = fromIf?.shortName || link.fromPort;
                  const toPortLabel = toIf?.shortName || link.toPort;

                  return (
                    <g key={link.id}>
                      {/* Invisible wide hit-area for clicking/deleting links */}
                      <line
                        x1={fromDev.x}
                        y1={fromDev.y}
                        x2={toDev.x}
                        y2={toDev.y}
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

                      {/* Visible Link Line */}
                      <line
                        x1={fromDev.x}
                        y1={fromDev.y}
                        x2={toDev.x}
                        y2={toDev.y}
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
                      />

                      {/* Endpoint Link LEDs (Green = Up, Red = Down/Mismatch) */}
                      <circle
                        cx={geom.x1Led}
                        cy={geom.y1Led}
                        r={4.5}
                        fill={isUp ? '#10b981' : '#ef4444'}
                        stroke="#0f172a"
                        strokeWidth={1}
                      />
                      <circle
                        cx={geom.x2Led}
                        cy={geom.y2Led}
                        r={4.5}
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

              {/* Draggable Topology Device Nodes & Movable Labels */}
              {devices.map(dev => {
                const isSelected = selectedDeviceId === dev.id || selectedDeviceIds.includes(dev.id);
                const isPendingSrc = pendingCableSource?.deviceId === dev.id;
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

                return (
                  <React.Fragment key={dev.id}>
                    {/* Dashed association line when dragging or viewing a custom-positioned label */}
                    {(draggingLabelDeviceId === dev.id || (isSelected && hasCustomLabelOffset)) && (
                      <svg
                        viewBox="0 0 1000 580"
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
                        left: `${(dev.x / 1000) * 100}%`,
                        top: `${(dev.y / 580) * 100}%`
                      }}
                      title={
                        tool === 'select'
                          ? 'Click: select · Long-click & drag: move · Double-click: open console'
                          : tool === 'marquee'
                          ? isSelected && selectedDeviceIds.length >= 2
                            ? 'Drag to move selected group · Shift+drag canvas to adjust marquee'
                            : 'Drag rectangle to select multiple devices'
                          : undefined
                      }
                      onPointerDown={(e) => {
                        if (tool !== 'select' || e.button !== 0) return;
                        e.stopPropagation();
                        const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
                        if (isModifier) return;

                        const canvas = canvasRef.current;
                        if (!canvas) return;
                        const rect = canvas.getBoundingClientRect();
                        if (rect.width <= 0 || rect.height <= 0) return;

                        const startCanvasX = Math.min(1000, Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000));
                        const startCanvasY = Math.min(580, Math.max(0, ((e.clientY - rect.top) / rect.height) * 580));

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
                        if (tool !== 'select') return;
                        e.stopPropagation();
                        if (dragStateRef.current?.holdTimerId != null) {
                          window.clearTimeout(dragStateRef.current.holdTimerId);
                        }
                        dragStateRef.current = null;
                        setLongPressMoveDeviceId(null);
                        setActiveSnapGuides(null);
                        setSelectedDeviceIds([dev.id]);
                        setSelectedDeviceId(dev.id);
                        setSelectedLinkId(null);
                        setSelectedShapeId(null);
                        setSelectedDiagramLabelId(null);
                        setConsoleDeviceId(dev.id);
                        setInspectorTab(dev.type === 'pc' || dev.type === 'server' ? 'config' : 'cli');
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
                        left: `${((dev.x + labelOx) / 1000) * 100}%`,
                        top: `${((dev.y + 34 + labelOy) / 580) * 100}%`
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
                            className="w-24 sm:w-28 bg-transparent text-center text-[11px] font-bold text-slate-900 dark:text-white focus:outline-none"
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

                            const startCanvasX = Math.min(1000, Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000));
                            const startCanvasY = Math.min(580, Math.max(0, ((e.clientY - rect.top) / rect.height) * 580));

                            setSelectedDeviceIds([dev.id]);
                            setSelectedDeviceId(dev.id);
                            if (consoleDeviceId !== dev.id) {
                              setConsoleDeviceId(null);
                            }
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
                              ? 'Drag to reposition label · Double-click to rename'
                              : undefined
                          }
                          className={`px-2 py-0.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border shadow-xs text-center whitespace-nowrap select-none transition-colors ${
                            draggingLabelDeviceId === dev.id
                              ? 'border-blue-500 dark:border-cyan-400 ring-2 ring-blue-500/30 cursor-grabbing'
                              : tool === 'select'
                              ? 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-cyan-400 cursor-grab'
                              : 'border-slate-200 dark:border-slate-700 cursor-pointer'
                          }`}
                        >
                          <div className="inline-flex items-center justify-center gap-1 text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                            <span>{dev.name}</span>
                            {tool === 'select' && isSelected && selectedDeviceIds.length === 1 && (
                              <button
                                type="button"
                                aria-label={`Rename ${dev.name}`}
                                title="Rename device label (F2)"
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
                    left: `${(paletteDropPreview.x / 1000) * 100}%`,
                    top: `${(paletteDropPreview.y / 580) * 100}%`
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
                      left: `${(lbl.x / 1000) * 100}%`,
                      top: `${(lbl.y / 580) * 100}%`
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

                          const startCanvasX = Math.min(1000, Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000));
                          const startCanvasY = Math.min(580, Math.max(0, ((e.clientY - rect.top) / rect.height) * 580));

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

              {/* Floating Viewport Zoom & Fit Controls HUD */}
              <div
                data-zoom-hud="true"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-3 right-3 z-40 inline-flex items-center gap-0.5 p-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-xs"
              >
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  disabled={zoom <= 0.41}
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
                  <Maximize2 className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                  <span>Fit</span>
                </button>
              </div>
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
            className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3"
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
          </form>
        </div>

        {/* Right Zone (5 cols): Device Inspector, CLI Terminal, Config & Lab Objectives */}
        <div className="xl:col-span-5 min-w-0 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col min-h-[460px] xl:min-h-[540px]">
          {/* Inspector Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                {selectedDeviceIds.length === 1 && selectedDevice && isRenamingInspectorHeader ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitDeviceRename(selectedDevice.id, inspectorNameDraft);
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      autoFocus
                      maxLength={64}
                      aria-label="Edit device label name"
                      value={inspectorNameDraft}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setInspectorNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setIsRenamingInspectorHeader(false);
                        }
                      }}
                      className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-blue-500 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      aria-label="Save device label"
                      title="Save label"
                      className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel rename"
                      title="Cancel"
                      onClick={() => setIsRenamingInspectorHeader(false)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h2
                      onDoubleClick={() => {
                        if (selectedDeviceIds.length === 1 && selectedDevice) {
                          setInspectorNameDraft(selectedDevice.name);
                          setIsRenamingInspectorHeader(true);
                        }
                      }}
                      className="text-sm font-bold text-slate-900 dark:text-white truncate"
                    >
                      {selectedDeviceIds.length > 1
                        ? `${selectedDeviceIds.length} Devices Selected`
                        : selectedDevice
                        ? `${selectedDevice.name} · ${selectedDevice.model}`
                        : 'Lab Verification & Packet Trace'}
                    </h2>
                    {selectedDeviceIds.length === 1 && selectedDevice && (
                      <button
                        type="button"
                        onClick={() => {
                          setInspectorNameDraft(selectedDevice.name);
                          setIsRenamingInspectorHeader(true);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors shrink-0"
                        title="Rename device label"
                        aria-label="Rename device label"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedDeviceIds.length > 1
                    ? 'Long-click any selected node to drag together, or click Delete Selected'
                    : isConsoleActive
                    ? 'Configure interfaces, routing, VLANs, or run CLI commands below'
                    : selectedDevice
                    ? 'Device selected — double-click on canvas to open console & configuration'
                    : 'Drag devices onto the workspace, click to select, long-click to move, double-click for console'}
                </p>
              </div>

              {selectedDeviceIds.length > 1 ? (
                <button
                  type="button"
                  onClick={handleDeleteSelectedDevices}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors shrink-0 whitespace-nowrap"
                  title="Delete all selected devices"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete ({selectedDeviceIds.length})</span>
                </button>
              ) : (
                selectedDevice && (
                  <button
                    type="button"
                    onClick={() => handleDeleteDevice(selectedDevice.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                    title="Delete selected device"
                    aria-label="Delete selected device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )
              )}
            </div>

            {/* Segmented Inspector Tabs (shown only when a user double-clicks a device to start console) */}
            {isConsoleActive && (
              <div
                role="tablist"
                aria-label="Device inspector panels"
                className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === 'cli'}
                  onClick={() => setInspectorTab('cli')}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    inspectorTab === 'cli'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <TerminalIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>CLI</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === 'config'}
                  onClick={() => setInspectorTab('config')}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    inspectorTab === 'config'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  <span>Config</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === 'tables'}
                  onClick={() => setInspectorTab('tables')}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    inspectorTab === 'tables'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Tables</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === 'objectives'}
                  onClick={() => setInspectorTab('objectives')}
                  className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    inspectorTab === 'objectives'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                  <span>Verify</span>
                </button>
              </div>
            )}
          </div>

          {/* Inspector Body */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* TAB 1: Per-Device CLI Terminal */}
            {inspectorTab === 'cli' && isConsoleActive && selectedDevice && (
              <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 font-mono">
                <div
                  onClick={() => cliInputRef.current?.focus()}
                  className="flex-1 p-4 overflow-y-auto text-xs leading-relaxed space-y-1 max-h-[420px] cursor-text"
                >
                  {selectedDevice.cliHistory.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-words">
                      {line.startsWith(selectedDevice.name) ? (
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
                      {getCliPrompt(selectedDevice)}
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

                {/* Quick Run Snippets per Device Type */}
                <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  <span className="text-slate-400 shrink-0 px-1">Quick:</span>
                  {(selectedDevice.type === 'router'
                    ? [
                        'conf t',
                        'show ip int br',
                        'show ip route',
                        'show ip ospf nei',
                        'show cdp nei',
                        'show run',
                        'copy run start'
                      ]
                    : selectedDevice.type === 'switch'
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
            )}

            {/* TAB 2: Visual GUI Configuration */}
            {inspectorTab === 'config' && isConsoleActive && selectedDevice && (
              <div className="p-4 space-y-4 overflow-y-auto max-h-[480px]">
                {/* Device Label / Hostname Editor */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="device-label-hostname-input"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Device Label / Hostname
                    </label>
                    {((selectedDevice.labelOffsetX || 0) !== 0 ||
                      (selectedDevice.labelOffsetY || 0) !== 0) && (
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedDevice(d => ({ ...d, labelOffsetX: 0, labelOffsetY: 0 }))
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline whitespace-nowrap"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Label Position</span>
                      </button>
                    )}
                  </div>
                  <input
                    id="device-label-hostname-input"
                    type="text"
                    maxLength={64}
                    value={selectedDevice.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateSelectedDevice(d => ({ ...d, name: val }));
                    }}
                    onBlur={(e) => {
                      const trimmed = e.target.value.trim().slice(0, 64);
                      if (!trimmed) {
                        const prefixMap: Record<SimDeviceType, string> = {
                          router: 'R',
                          switch: 'SW',
                          pc: 'PC',
                          server: 'Server'
                        };
                        updateSelectedDevice(d => ({ ...d, name: prefixMap[d.type] }));
                      } else if (trimmed !== selectedDevice.name) {
                        updateSelectedDevice(d => ({ ...d, name: trimmed }));
                      }
                    }}
                    placeholder="Enter device label (e.g. R1-HQ, Core-SW)..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Diagram Orientation Control */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="device-orientation-slider"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Diagram Orientation
                    </label>
                    <span className="font-mono tabular-nums text-xs font-bold text-blue-600 dark:text-cyan-400">
                      {selectedDevice.rotation || 0}°
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="device-orientation-slider"
                      type="range"
                      min={0}
                      max={359}
                      step={1}
                      value={selectedDevice.rotation || 0}
                      onChange={(e) => {
                        const deg = Number(e.target.value);
                        updateSelectedDevice(d => ({ ...d, rotation: deg }));
                      }}
                      className="flex-1 accent-blue-600 dark:accent-cyan-400 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedDevice(d => ({
                          ...d,
                          rotation: (((d.rotation || 0) - 90) % 360 + 360) % 360
                        }))
                      }
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 whitespace-nowrap"
                      title="Rotate 90° counter-clockwise"
                    >
                      -90°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedDevice(d => ({
                          ...d,
                          rotation: ((d.rotation || 0) + 90) % 360
                        }))
                      }
                      className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 whitespace-nowrap"
                      title="Rotate 90° clockwise"
                    >
                      +90°
                    </button>
                    {(selectedDevice.rotation || 0) !== 0 && (
                      <button
                        type="button"
                        onClick={() => updateSelectedDevice(d => ({ ...d, rotation: 0 }))}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 whitespace-nowrap"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* PC / Server IPv4 Desktop Settings */}
                {(selectedDevice.type === 'pc' || selectedDevice.type === 'server') && (
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      IPv4 Configuration
                    </h3>
                    {selectedDevice.interfaces.map(iface => (
                      <div
                        key={iface.name}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                            {iface.name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateSelectedDevice(d => ({
                                ...d,
                                interfaces: d.interfaces.map(i =>
                                  i.name === iface.name ? { ...i, adminUp: !i.adminUp } : i
                                )
                              }))
                            }
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ${
                              iface.adminUp
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{iface.adminUp ? 'Enabled' : 'Disabled'}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                              IPv4 Address
                            </label>
                            <input
                              type="text"
                              value={iface.ip}
                              placeholder="192.168.20.10"
                              onChange={(e) => {
                                const ip = e.target.value;
                                updateSelectedDevice(d => ({
                                  ...d,
                                  interfaces: d.interfaces.map(i =>
                                    i.name === iface.name ? { ...i, ip } : i
                                  )
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                              Subnet Mask
                            </label>
                            <input
                              type="text"
                              value={iface.mask}
                              placeholder="255.255.255.0"
                              onChange={(e) => {
                                const mask = e.target.value;
                                updateSelectedDevice(d => ({
                                  ...d,
                                  interfaces: d.interfaces.map(i =>
                                    i.name === iface.name ? { ...i, mask } : i
                                  )
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                          Default Gateway
                        </label>
                        <input
                          type="text"
                          value={selectedDevice.gateway || ''}
                          placeholder="192.168.20.1"
                          onChange={(e) => {
                            const gw = e.target.value;
                            updateSelectedDevice(d => ({ ...d, gateway: gw }));
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                          DNS Server
                        </label>
                        <input
                          type="text"
                          value={selectedDevice.dns || ''}
                          placeholder="8.8.8.8"
                          onChange={(e) => {
                            const dns = e.target.value;
                            updateSelectedDevice(d => ({ ...d, dns }));
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Router Interface + Static Route Editor */}
                {selectedDevice.type === 'router' && (
                  <>
                    <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                          Router Interfaces
                        </h3>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            max={4094}
                            value={newSubIfId}
                            onChange={(e) => setNewSubIfId(e.target.value)}
                            placeholder="VLAN ID"
                            className="w-20 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const vid = Number(newSubIfId);
                              if (!Number.isInteger(vid) || vid < 1 || vid > 4094) return;
                              const subName = `GigabitEthernet0/0.${vid}`;
                              if (selectedDevice.interfaces.some(i => i.name === subName)) return;
                              updateSelectedDevice(d => ({
                                ...d,
                                interfaces: [
                                  ...d.interfaces,
                                  {
                                    name: subName,
                                    shortName: `Gig0/0.${vid}`,
                                    kind: 'subinterface',
                                    ip: '',
                                    mask: '255.255.255.0',
                                    adminUp: true,
                                    mac: d.interfaces[0]?.mac || '00:50:56:00:00:01',
                                    parentInterface: 'GigabitEthernet0/0',
                                    dot1qVlan: vid
                                  }
                                ]
                              }));
                              setNewSubIfId('');
                            }}
                            className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-cyan-300 whitespace-nowrap"
                          >
                            + Gig0/0.VLAN
                          </button>
                        </div>
                      </div>

                      {selectedDevice.interfaces.map(iface => {
                        const lineUp = isInterfaceLineProtocolUp(
                          selectedDevice,
                          iface,
                          devices,
                          links
                        );
                        return (
                          <div
                            key={iface.name}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate">
                                  {iface.name}
                                </span>
                                {iface.dot1qVlan && (
                                  <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-300">
                                    dot1Q {iface.dot1qVlan}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`text-[10px] font-mono font-bold ${
                                    lineUp
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {lineUp ? 'line up' : 'line down'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSelectedDevice(d => ({
                                      ...d,
                                      interfaces: d.interfaces.map(i =>
                                        i.name === iface.name ? { ...i, adminUp: !i.adminUp } : i
                                      )
                                    }))
                                  }
                                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                    iface.adminUp
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                                  }`}
                                >
                                  {iface.adminUp ? 'Up' : 'Shutdown'}
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                aria-label={`${iface.name} IP`}
                                value={iface.ip}
                                placeholder="IPv4 Address"
                                onChange={(e) => {
                                  const ip = e.target.value;
                                  updateSelectedDevice(d => ({
                                    ...d,
                                    interfaces: d.interfaces.map(i =>
                                      i.name === iface.name ? { ...i, ip } : i
                                    )
                                  }));
                                }}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums"
                              />
                              <input
                                type="text"
                                aria-label={`${iface.name} Subnet Mask`}
                                value={iface.mask}
                                placeholder="Subnet Mask"
                                onChange={(e) => {
                                  const mask = e.target.value;
                                  updateSelectedDevice(d => ({
                                    ...d,
                                    interfaces: d.interfaces.map(i =>
                                      i.name === iface.name ? { ...i, mask } : i
                                    )
                                  }));
                                }}
                                className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quick Static Route Builder */}
                    <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Static Routes (ip route)
                      </h3>
                      <div className="grid grid-cols-3 gap-1.5">
                        <input
                          type="text"
                          value={newRouteNet}
                          onChange={(e) => setNewRouteNet(e.target.value)}
                          placeholder="Network"
                          className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono"
                        />
                        <input
                          type="text"
                          value={newRouteMask}
                          onChange={(e) => setNewRouteMask(e.target.value)}
                          placeholder="Mask"
                          className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono"
                        />
                        <input
                          type="text"
                          value={newRouteHop}
                          onChange={(e) => setNewRouteHop(e.target.value)}
                          placeholder="Next Hop"
                          className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isValidIp(newRouteNet) || !isValidMask(newRouteMask) || !isValidIp(newRouteHop)) {
                            flashBanner('Enter valid IPv4 network, mask, and next-hop IP.');
                            return;
                          }
                          updateSelectedDevice(d => ({
                            ...d,
                            staticRoutes: [
                              ...d.staticRoutes,
                              { network: newRouteNet.trim(), mask: newRouteMask.trim(), nextHop: newRouteHop.trim() }
                            ]
                          }));
                          setNewRouteNet('');
                          setNewRouteHop('');
                        }}
                        className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                      >
                        Add Static Route
                      </button>

                      {selectedDevice.staticRoutes.length > 0 && (
                        <div className="space-y-1">
                          {selectedDevice.staticRoutes.map((sr, i) => (
                            <div
                              key={i}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] font-mono"
                            >
                              <span>
                                {sr.network}/{maskToPrefix(sr.mask)} via {sr.nextHop}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedDevice(d => ({
                                    ...d,
                                    staticRoutes: d.staticRoutes.filter((_, idx) => idx !== i)
                                  }))
                                }
                                className="text-red-500 hover:text-red-400 font-semibold"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Switch VLAN & Port Mode Editor */}
                {selectedDevice.type === 'switch' && (
                  <>
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Create VLAN
                      </h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={2}
                          max={4094}
                          value={newVlanId}
                          onChange={(e) => setNewVlanId(e.target.value)}
                          placeholder="ID (e.g. 10)"
                          className="w-24 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono tabular-nums"
                        />
                        <input
                          type="text"
                          value={newVlanName}
                          onChange={(e) => setNewVlanName(e.target.value)}
                          placeholder="VLAN Name (e.g. Sales)"
                          className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const vid = Number(newVlanId);
                            if (!Number.isInteger(vid) || vid < 2 || vid > 4094) return;
                            updateSelectedDevice(d => ({
                              ...d,
                              vlans: d.vlans.some(v => v.id === vid)
                                ? d.vlans
                                : [
                                    ...d.vlans,
                                    { id: vid, name: newVlanName.trim() || `VLAN${vid}` }
                                  ]
                            }));
                            setNewVlanId('');
                            setNewVlanName('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Switchport Assignment
                      </h3>
                      {selectedDevice.interfaces.map(iface => (
                        <div
                          key={iface.name}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                            {iface.shortName}
                          </span>
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`${iface.name} mode`}
                              value={iface.switchportMode || 'access'}
                              onChange={(e) => {
                                const mode = e.target.value as 'access' | 'trunk';
                                updateSelectedDevice(d => ({
                                  ...d,
                                  interfaces: d.interfaces.map(i =>
                                    i.name === iface.name ? { ...i, switchportMode: mode } : i
                                  )
                                }));
                              }}
                              className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold"
                            >
                              <option value="access">Access</option>
                              <option value="trunk">Trunk (802.1Q)</option>
                            </select>

                            {iface.switchportMode !== 'trunk' && (
                              <input
                                type="number"
                                min={1}
                                max={4094}
                                aria-label={`${iface.name} access VLAN`}
                                value={iface.accessVlan || 1}
                                onChange={(e) => {
                                  const vid = Number(e.target.value) || 1;
                                  updateSelectedDevice(d => ({
                                    ...d,
                                    vlans: d.vlans.some(v => v.id === vid)
                                      ? d.vlans
                                      : [...d.vlans, { id: vid, name: `VLAN${vid}` }],
                                    interfaces: d.interfaces.map(i =>
                                      i.name === iface.name ? { ...i, accessVlan: vid } : i
                                    )
                                  }));
                                }}
                                className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono tabular-nums"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 3: Live Tables (Routing Table / VLAN Database / NIC Status) */}
            {inspectorTab === 'tables' && isConsoleActive && selectedDevice && (
              <div className="p-4 space-y-4 overflow-y-auto max-h-[480px]">
                {selectedDevice.type === 'router' && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      IPv4 Routing Table ({selectedDevice.name})
                    </h3>
                    {routingTable.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No active routes. Assign IP addresses and bring up interfaces.
                      </p>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto font-mono text-[11px]">
                        <table className="w-full text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <tr>
                              <th className="p-2">Code</th>
                              <th className="p-2">Prefix</th>
                              <th className="p-2">Next Hop</th>
                              <th className="p-2">Exit If</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                            {routingTable.map((r, i) => (
                              <tr key={i}>
                                <td className="p-2 font-bold text-blue-600 dark:text-cyan-400">
                                  {r.code}
                                </td>
                                <td className="p-2">
                                  {r.network}/{r.prefix}
                                </td>
                                <td className="p-2">{r.nextHop || 'Direct'}</td>
                                <td className="p-2">{r.exitInterface}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {selectedDevice.type === 'switch' && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      VLAN Database ({selectedDevice.name})
                    </h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto font-mono text-[11px]">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <tr>
                            <th className="p-2">VLAN</th>
                            <th className="p-2">Name</th>
                            <th className="p-2">Access Ports</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                          {selectedDevice.vlans.map(v => (
                            <tr key={v.id}>
                              <td className="p-2 font-bold">{v.id}</td>
                              <td className="p-2">{v.name}</td>
                              <td className="p-2">
                                {selectedDevice.interfaces
                                  .filter(
                                    i => i.switchportMode !== 'trunk' && (i.accessVlan || 1) === v.id
                                  )
                                  .map(i => i.shortName)
                                  .join(', ') || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(selectedDevice.type === 'pc' || selectedDevice.type === 'server') && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Network Adapter Summary
                    </h3>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-xs space-y-1.5 tabular-nums">
                      <div>IPv4: {selectedDevice.interfaces[0]?.ip || 'Unassigned'}</div>
                      <div>Mask: {selectedDevice.interfaces[0]?.mask || 'Unassigned'}</div>
                      <div>Gateway: {selectedDevice.gateway || 'Unassigned'}</div>
                      <div>MAC: {selectedDevice.interfaces[0]?.mac}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Lab Verification Objectives & Packet Hop Trace */}
            {(inspectorTab === 'objectives' || !isConsoleActive) && (
              <div className="p-4 space-y-4 overflow-y-auto max-h-[480px]">
                {selectedDevice && !isConsoleActive && selectedDeviceIds.length === 1 ? (
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {selectedDevice.name} selected
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        Double-click on canvas to open console · Long-click &amp; drag to move
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setConsoleDeviceId(selectedDevice.id);
                        setInspectorTab(
                          selectedDevice.type === 'pc' || selectedDevice.type === 'server'
                            ? 'config'
                            : 'cli'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap shrink-0"
                    >
                      <TerminalIcon className="w-3.5 h-3.5" />
                      <span>Open Console</span>
                    </button>
                  </div>
                ) : (
                  devices.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
                      <TerminalIcon className="w-4 h-4 text-blue-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                      <span>
                        {selectedDeviceIds.length > 1
                          ? 'Multiple devices are selected. Long-click any selected device to move them together, or double-click a single device to open its console.'
                          : 'One-click a device to select it, long-click & drag to move it, or double-click to start its console for configuration.'}
                      </span>
                    </div>
                  )
                )}
                {/* Scenario Objectives */}
                {activePreset.objectives.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Lab Verification Checklist
                      </h3>
                      <span className="text-[11px] font-mono tabular-nums font-bold text-blue-600 dark:text-cyan-400">
                        {objectiveProgress.passedCount}/{objectiveProgress.totalCount} complete
                      </span>
                    </div>

                    <div className="space-y-2">
                      {objectiveProgress.results.map(obj => (
                        <div
                          key={obj.id}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs ${
                            obj.passed
                              ? 'bg-emerald-50/80 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {obj.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <span>{obj.label}</span>
                        </div>
                      ))}
                    </div>

                    {objectiveProgress.passedCount === objectiveProgress.totalCount && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 space-y-2.5">
                        <div className="flex items-start gap-2 text-xs text-emerald-900 dark:text-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold">Lab Completed!</div>
                            <p className="text-[11px] text-emerald-800/90 dark:text-emerald-300/90 mt-0.5">
                              Export your finished topology as JSON or a high-resolution PNG diagram for submission.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportTopology()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export JSON</span>
                          </button>
                          <button
                            type="button"
                            disabled={isExportingImage}
                            onClick={() => handleExportImage('png')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 disabled:opacity-50 text-xs font-semibold transition-colors whitespace-nowrap"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>{isExportingImage ? 'Exporting PNG...' : 'Export PNG'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Packet Trace Log */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Live Packet Simulation Trace
                  </h3>

                  {!lastPingResult ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Run a ping from the bar below the topology canvas or inside any device&apos;s CLI to inspect Layer 2 switching, VLANs, and Layer 3 routing hops.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                          lastPingResult.success
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {lastPingResult.success ? (
                          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        )}
                        <span className="font-mono">{lastPingResult.summary}</span>
                      </div>

                      <div className="space-y-1.5">
                        {lastPingResult.hops.map((hop, idx) => (
                          <div
                            key={idx}
                            className={`p-2 rounded-lg border text-[11px] flex items-start gap-2 transition-colors ${
                              animStepIndex === idx
                                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-cyan-500'
                                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <span className="font-mono font-bold text-slate-500 tabular-nums">
                              {hop.step}.
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-100">
                                {hop.title}
                              </div>
                              <div className="text-slate-600 dark:text-slate-400 font-mono">
                                {hop.detail}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
        </>
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
