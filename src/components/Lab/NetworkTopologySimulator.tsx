import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Network,
  Cable,
  MousePointer2,
  Trash2,
  Plus,
  RotateCcw,
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
  saveActiveLabDraftToIdb
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
  SimLink
} from './networkSimTypes';
import {
  computeCableGeometry,
  computeRoutingTable,
  createDefaultDevice,
  evaluateLinkStatus,
  executeDeviceCommand,
  getCliPrompt,
  isInterfaceLineProtocolUp,
  isPortCompatibleWithCable,
  isValidIp,
  isValidMask,
  maskToPrefix,
  simulatePing
} from './networkSimEngine';
import { NETWORK_LAB_PRESETS } from './networkLabPresets';
import { CiscoDeviceIcon, getCiscoDeviceInnerSvg } from './CiscoDeviceIcon';

type CanvasTool = 'select' | 'cable' | 'delete';
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
  devices: SimDevice[];
  links: SimLink[];
}

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

      {devices.map(dev => {
        const previewScale = 1.1;
        return (
          <g key={dev.id} transform={`translate(${dev.x}, ${dev.y})`}>
            <g
              transform={`translate(${(-32 * previewScale).toFixed(1)}, ${(-28 * previewScale).toFixed(1)}) scale(${previewScale})`}
              dangerouslySetInnerHTML={{ __html: getCiscoDeviceInnerSvg(dev.type) }}
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
  const { currentUser, isOffline } = useAcademy();

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
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('config');

  // CLI state
  const [cliInput, setCliInput] = useState<string>('');
  const [cmdHistoryMap, setCmdHistoryMap] = useState<Record<string, string[]>>({});
  const [cmdCursor, setCmdCursor] = useState<number>(-1);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const cliInputRef = useRef<HTMLInputElement>(null);

  // Dragging & marquee selection box state
  const canvasRef = useRef<HTMLDivElement>(null);
  const devicesRef = useRef<SimDevice[]>(devices);
  devicesRef.current = devices;
  const [selectionBox, setSelectionBox] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const dragStateRef = useRef<{
    startClientX: number;
    startClientY: number;
    startCanvasX: number;
    startCanvasY: number;
    initialPositions: Array<{ id: string; x: number; y: number }>;
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
        setActiveSavedLabId(draft.activeSavedLabId || null);
        const firstId = draft.devices[0]?.id || null;
        setSelectedDeviceId(firstId);
        setSelectedDeviceIds(firstId ? [firstId] : []);
        setSelectedLinkId(null);
        setLastPingResult(null);
        setLastAutoSavedAt(draft.updatedAt);
      } else {
        setActivePresetId('blank-sandbox');
        setDevices([]);
        setLinks([]);
        setActiveSavedLabId(null);
        setSelectedDeviceId(null);
        setSelectedDeviceIds([]);
        setSelectedLinkId(null);
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
                const scopedCloudItem: SavedLabRecord = { ...cloudItem, userId: ownerScopeId };
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
  }, [activePresetId, activeSavedLabId, ownerScopeId, devices, links, workspaceView]);

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

  const selectedLink = useMemo(
    () => links.find(l => l.id === selectedLinkId) || null,
    [links, selectedLinkId]
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

  // Pointer drag & marquee selection box handling for topology canvas nodes
  useEffect(() => {
    const clientToCanvas = (clientX: number, clientY: number, rect: DOMRect) => ({
      x: Math.min(1000, Math.max(0, ((clientX - rect.left) / rect.width) * 1000)),
      y: Math.min(580, Math.max(0, ((clientY - rect.top) / rect.height) * 580))
    });

    const handlePointerMove = (e: PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const drag = dragStateRef.current;
      if (drag) {
        const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
        if (dist > 3) {
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

        const minDx = 65 - minInitX;
        const maxDx = 935 - maxInitX;
        const minDy = 60 - minInitY;
        const maxDy = 515 - maxInitY;

        const dx = Math.round(Math.min(maxDx, Math.max(minDx, rawDx)));
        const dy = Math.round(Math.min(maxDy, Math.max(minDy, rawDy)));

        const nextPosMap = new Map(
          drag.initialPositions.map(p => [p.id, { x: p.x + dx, y: p.y + dy }])
        );

        setDevices(prev =>
          prev.map(d => {
            const nextPos = nextPosMap.get(d.id);
            return nextPos ? { ...d, x: nextPos.x, y: nextPos.y } : d;
          })
        );
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
        setSelectionBox({
          startX: marquee.startCanvasX,
          startY: marquee.startCanvasY,
          currentX: curr.x,
          currentY: curr.y
        });

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

        setSelectedDeviceIds(nextIds);
        setSelectedLinkId(null);
        setSelectedDeviceId(prev =>
          prev && nextIds.includes(prev) ? prev : nextIds[0] || null
        );
      }
    };

    const handlePointerUp = () => {
      if (marqueeStateRef.current?.moved) {
        suppressCanvasClickRef.current = true;
      }
      dragStateRef.current = null;
      marqueeStateRef.current = null;
      setSelectionBox(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const flashBanner = (msg: string) => {
    setStatusBanner(msg);
    window.setTimeout(() => {
      setStatusBanner(prev => (prev === msg ? null : prev));
    }, 3600);
  };

  // Load or reset preset
  const handleSelectPreset = (presetId: string) => {
    const preset = NETWORK_LAB_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const built = preset.buildInitialState();
    setActivePresetId(preset.id);
    setDevices(built.devices);
    setLinks(built.links);
    const firstId = built.devices[0]?.id || null;
    setSelectedDeviceId(firstId);
    setSelectedDeviceIds(firstId ? [firstId] : []);
    setSelectedLinkId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    setLastPingResult(null);
    setInspectorTab(preset.objectives.length > 0 ? 'objectives' : 'config');
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

  // Add device to canvas
  const handleAddDevice = (type: SimDeviceType) => {
    const prefixMap: Record<SimDeviceType, string> = {
      router: 'R',
      switch: 'SW',
      pc: 'PC',
      server: 'Server'
    };
    const sameTypeCount = devices.filter(d => d.type === type).length + 1;
    const name = `${prefixMap[type]}-${sameTypeCount}`;
    const offset = (devices.length % 6) * 42;
    const newDev = createDefaultDevice(
      type,
      name,
      240 + (devices.length % 4) * 165,
      140 + offset
    );
    setDevices(prev => [...prev, newDev]);
    setSelectedDeviceId(newDev.id);
    setSelectedDeviceIds([newDev.id]);
    setSelectedLinkId(null);
    setTool('select');
    setInspectorTab(type === 'router' || type === 'switch' ? 'cli' : 'config');
  };

  const handleDeleteDevice = useCallback(
    (deviceId: string) => {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      setLinks(prev => prev.filter(l => l.fromDeviceId !== deviceId && l.toDeviceId !== deviceId));
      const remaining = selectedDeviceIds.filter(id => id !== deviceId);
      setSelectedDeviceIds(remaining);
      setSelectedDeviceId(cur => (cur === deviceId ? remaining[0] || null : cur));
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
    setPendingCableSource(prev => (prev && deleteSet.has(prev.deviceId) ? null : prev));
    setPendingCableTarget(prev => (prev && deleteSet.has(prev.deviceId) ? null : prev));
    flashBanner(`Removed ${count} selected device${count === 1 ? '' : 's'} and attached cables`);
  }, [selectedDeviceIds]);

  const handleDeleteLink = useCallback((linkId: string) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
    setSelectedLinkId(prev => (prev === linkId ? null : prev));
  }, []);

  // Keyboard shortcuts for canvas multi-select (Delete / Backspace, Ctrl/Cmd+A, Escape)
  useEffect(() => {
    if (workspaceView !== 'editor' || isSavePromptOpen || isTemplatesModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active?.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && tool === 'select') {
        if (devices.length === 0) return;
        e.preventDefault();
        setSelectedDeviceIds(devices.map(d => d.id));
        setSelectedDeviceId(prev => prev || devices[0]?.id || null);
        setSelectedLinkId(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedDeviceIds.length > 0) {
          e.preventDefault();
          handleDeleteSelectedDevices();
        } else if (selectedLinkId) {
          e.preventDefault();
          handleDeleteLink(selectedLinkId);
        }
        return;
      }

      if (e.key === 'Escape') {
        setSelectedDeviceIds([]);
        setSelectedDeviceId(null);
        setSelectedLinkId(null);
        setPendingCableSource(null);
        setPendingCableTarget(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    devices,
    handleDeleteLink,
    handleDeleteSelectedDevices,
    isSavePromptOpen,
    isTemplatesModalOpen,
    selectedDeviceIds.length,
    selectedLinkId,
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
    if (dragStateRef.current?.moved) return;

    if (tool === 'delete') {
      handleDeleteDevice(device.id);
      return;
    }

    if (tool === 'cable') {
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
      setSelectedLinkId(null);
      return;
    }

    setSelectedDeviceIds([device.id]);
    setSelectedDeviceId(device.id);
    setSelectedLinkId(null);
    if (inspectorTab === 'objectives') {
      setInspectorTab(device.type === 'pc' || device.type === 'server' ? 'config' : 'cli');
    }
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
  };

  const handleCliKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!selectedDevice) return;
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
    setActiveSavedLabId(null);
    setSelectedDeviceId(null);
    setSelectedDeviceIds([]);
    setSelectedLinkId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    setLastPingResult(null);
    setRecentlySavedProjectId(null);
    setIsSavePromptOpen(false);
    setInspectorTab('config');
    setWorkspaceView('editor');
    flashBanner('Started a new Blank Lab Project');
  };

  const handleExportTopology = (record?: SavedLabRecord) => {
    const exportTitle =
      record?.title ||
      savedLabs.find(l => l.id === activeSavedLabId)?.title ||
      activePreset.title;
    const payload: SavedLabSnapshot = {
      format: 'netplus-lab-project-v1',
      title: exportTitle,
      status: record?.status || 'in_progress',
      presetId: record?.presetId || activePresetId,
      exportedAt: new Date().toISOString(),
      devices: record ? record.devices : devices,
      links: record ? record.links : links
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = toProjectFileName(exportTitle);
    a.click();
    URL.revokeObjectURL(url);
    flashBanner(`Downloaded project file ${toProjectFileName(exportTitle)}`);
  };

  const handleExportImage = async (format: 'png' | 'svg') => {
    if (devices.length === 0) {
      flashBanner('Place at least one device on the canvas before exporting a topology image');
      return;
    }

    const activeRecord = savedLabs.find(l => l.id === activeSavedLabId);
    const title =
      activeRecord?.title ||
      (saveTitleInput.trim() ? saveTitleInput.trim() : activePreset.title);
    const isDarkTheme =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const options = {
      title,
      devices,
      links,
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
          setActiveSavedLabId(null);
          const firstImportedId = parsed.devices[0]?.id || null;
          setSelectedDeviceId(firstImportedId);
          setSelectedDeviceIds(firstImportedId ? [firstImportedId] : []);
          setSelectedLinkId(null);
          if (typeof parsed.title === 'string' && parsed.title.trim()) {
            setSaveTitleInput(parsed.title.trim());
          }
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

    const record: SavedLabRecord = {
      id: targetId,
      userId: ownerScopeId,
      title: trimmedTitle.slice(0, 120),
      presetId: activePresetId,
      devices: cleanDevices,
      links: cleanLinks,
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
        setActiveSavedLabId(null);
        setSelectedDeviceId(null);
        setSelectedDeviceIds([]);
        setSelectedLinkId(null);
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
    setActiveSavedLabId(record.id);
    setSaveTitleInput(record.title);
    const firstId = record.devices[0]?.id || null;
    setSelectedDeviceId(firstId);
    setSelectedDeviceIds(firstId ? [firstId] : []);
    setSelectedLinkId(null);
    setPendingCableSource(null);
    setPendingCableTarget(null);
    setLastPingResult(null);
    setRecentlySavedProjectId(null);
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
    if (tool !== 'cable') return null;
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
                onClick={() => handleExportTopology()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                title="Download .netlab.json project file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Download File</span>
              </button>

              <button
                type="button"
                disabled={devices.length === 0 || isExportingImage}
                onClick={() => handleExportImage('png')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                title="Export high-resolution PNG image (2000×1380)"
              >
                <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                <span>{isExportingImage ? 'Exporting PNG...' : 'Export PNG'}</span>
              </button>

              <button
                type="button"
                disabled={devices.length === 0}
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
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Add Devices */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
            Add Device:
          </span>
          <button
            type="button"
            onClick={() => handleAddDevice('router')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-semibold text-sky-800 dark:text-cyan-200 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <CiscoDeviceIcon type="router" className="w-5 h-4 shrink-0" />
            <span>Cisco Router</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddDevice('switch')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-semibold text-sky-800 dark:text-cyan-200 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <CiscoDeviceIcon type="switch" className="w-5 h-4 shrink-0" />
            <span>Cisco Switch</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddDevice('pc')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-semibold text-sky-800 dark:text-cyan-200 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <CiscoDeviceIcon type="pc" className="w-5 h-4 shrink-0" />
            <span>Workstation</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddDevice('server')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-semibold text-sky-800 dark:text-cyan-200 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <CiscoDeviceIcon type="server" className="w-4 h-4 shrink-0" />
            <span>Server</span>
          </button>
        </div>

        {/* Canvas Tools & Cable Type Selector */}
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
                setTool('cable');
                setPendingCableSource(null);
                setPendingCableTarget(null);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tool === 'cable'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Cable className="w-3.5 h-3.5" />
              <span>Connect Cable</span>
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

          {tool === 'cable' && (
            <select
              aria-label="Cable Type"
              value={selectedCableType}
              onChange={(e) => {
                setSelectedCableType(e.target.value as SimCableType);
                setPendingCableSource(null);
                setPendingCableTarget(null);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-semibold text-blue-800 dark:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(CABLE_META) as SimCableType[]).map(ct => (
                <option key={ct} value={ct}>
                  {CABLE_META[ct].label}
                </option>
              ))}
            </select>
          )}
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
                </span>
                {tool === 'select' && devices.length > 0 && selectedDeviceIds.length === 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Drag box or Ctrl+Click to multi-select
                    </span>
                  </>
                )}
                {tool === 'select' && selectedDeviceIds.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums font-semibold text-blue-600 dark:text-cyan-400">
                      {selectedDeviceIds.length} selected
                    </span>
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
                      {pendingCableSource?.portName
                        ? `Source ${devices.find(d => d.id === pendingCableSource.deviceId)?.name} (${pendingCableSource.portName}) — click target device`
                        : `Click first device to attach ${CABLE_META[selectedCableType].short} cable (${CABLE_META[selectedCableType].hint})`}
                    </span>
                  </>
                )}
                {tool === 'delete' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Click any device or cable to remove it
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

            {/* Interactive Blueprint Stage */}
            <div
              ref={canvasRef}
              onPointerDown={(e) => {
                if (tool !== 'select' || e.button !== 0) return;
                if (e.target !== e.currentTarget) return;
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
                if (e.target === e.currentTarget) {
                  setSelectedLinkId(null);
                  if (tool === 'select' && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
                    setSelectedDeviceIds([]);
                    setSelectedDeviceId(null);
                  }
                }
              }}
              className="relative w-full aspect-[1000/580] min-h-[260px] sm:min-h-[380px] bg-slate-50 dark:bg-[#090f1d] select-none overflow-hidden"
              style={{
                backgroundImage:
                  'radial-gradient(circle, rgba(148,163,184,0.22) 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            >
              {/* Marquee Drag Selection Box */}
              {selectionBox && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500/10 dark:border-cyan-400 dark:bg-cyan-400/15 rounded-sm pointer-events-none z-20"
                  style={{
                    left: `${(Math.min(selectionBox.startX, selectionBox.currentX) / 1000) * 100}%`,
                    top: `${(Math.min(selectionBox.startY, selectionBox.currentY) / 580) * 100}%`,
                    width: `${(Math.abs(selectionBox.currentX - selectionBox.startX) / 1000) * 100}%`,
                    height: `${(Math.abs(selectionBox.currentY - selectionBox.startY) / 580) * 100}%`
                  }}
                />
              )}
              {/* Empty Canvas Guide */}
              {devices.length === 0 && (
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
                className="absolute inset-0 w-full h-full pointer-events-none"
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
                          if (tool === 'delete') {
                            handleDeleteLink(link.id);
                          } else {
                            setSelectedLinkId(link.id);
                            setSelectedDeviceId(null);
                            setSelectedDeviceIds([]);
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

              {/* Draggable Topology Device Nodes */}
              {devices.map(dev => {
                const isSelected = selectedDeviceId === dev.id || selectedDeviceIds.includes(dev.id);
                const isPendingSrc = pendingCableSource?.deviceId === dev.id;
                const isActiveHop =
                  animStepIndex !== null &&
                  lastPingResult?.hops[animStepIndex]?.deviceId === dev.id;
                const primaryIp = dev.interfaces.find(i => isValidIp(i.ip))?.ip;

                return (
                  <div
                    key={dev.id}
                    style={{
                      left: `${(dev.x / 1000) * 100}%`,
                      top: `${(dev.y / 580) * 100}%`
                    }}
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

                      if (!selectedDeviceIds.includes(dev.id)) {
                        setSelectedDeviceIds([dev.id]);
                        setSelectedDeviceId(dev.id);
                        setSelectedLinkId(null);
                      }

                      const initialPositions = devices
                        .filter(d => activeGroupIds.includes(d.id))
                        .map(d => ({ id: d.id, x: d.x, y: d.y }));

                      dragStateRef.current = {
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        startCanvasX,
                        startCanvasY,
                        initialPositions,
                        moved: false
                      };
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeviceClick(dev, e);
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 cursor-pointer group z-10"
                  >
                    <div
                      className={`p-1 rounded-2xl flex items-center justify-center transition-transform duration-150 group-hover:scale-105 ${
                        isActiveHop
                          ? 'ring-3 ring-emerald-400 bg-emerald-500/15 scale-110'
                          : isSelected || isPendingSrc
                          ? 'ring-2 ring-blue-500 dark:ring-cyan-400 bg-blue-500/10 dark:bg-cyan-400/10'
                          : ''
                      } ${tool === 'delete' ? 'hover:ring-2 hover:ring-red-500 hover:bg-red-500/10' : ''}`}
                    >
                      <CiscoDeviceIcon
                        type={dev.type}
                        className="w-12 h-11 sm:w-14 sm:h-12 drop-shadow-[0_2px_4px_rgba(15,23,42,0.28)]"
                      />
                    </div>

                    <div className="px-2 py-0.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-xs text-center whitespace-nowrap">
                      <div className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                        {dev.name}
                      </div>
                      {primaryIp && (
                        <div className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-cyan-300 leading-tight">
                          {primaryIp}
                        </div>
                      )}
                    </div>
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
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {selectedDeviceIds.length > 1
                    ? `${selectedDeviceIds.length} Devices Selected`
                    : selectedDevice
                    ? `${selectedDevice.name} · ${selectedDevice.model}`
                    : 'Lab Verification & Packet Trace'}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedDeviceIds.length > 1
                    ? 'Drag any selected node to move the group together, or click Delete Selected'
                    : selectedDevice
                    ? 'Configure interfaces, routing, VLANs, or run CLI commands below'
                    : 'Click any device or drag a selection box on the canvas to begin'}
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

            {/* Segmented Inspector Tabs */}
            <div
              role="tablist"
              aria-label="Device inspector panels"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'cli'}
                disabled={!selectedDevice}
                onClick={() => setInspectorTab('cli')}
                className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-40 ${
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
                disabled={!selectedDevice}
                onClick={() => setInspectorTab('config')}
                className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-40 ${
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
                disabled={!selectedDevice}
                onClick={() => setInspectorTab('tables')}
                className={`inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-40 ${
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
          </div>

          {/* Inspector Body */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* TAB 1: Per-Device CLI Terminal */}
            {inspectorTab === 'cli' && selectedDevice && (
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
                      placeholder="Type command or ?..."
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
                        'show run',
                        'int s0/0/0',
                        'no shutdown'
                      ]
                    : selectedDevice.type === 'switch'
                    ? [
                        'conf t',
                        'show vlan brief',
                        'show int trunk',
                        'vlan 10',
                        'int gig0/1',
                        'switchport mode trunk'
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
            {inspectorTab === 'config' && selectedDevice && (
              <div className="p-4 space-y-4 overflow-y-auto max-h-[480px]">
                {/* Hostname Editor */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Device Hostname
                  </label>
                  <input
                    type="text"
                    value={selectedDevice.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateSelectedDevice(d => ({ ...d, name: val }));
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
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
            {inspectorTab === 'tables' && selectedDevice && (
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
            {(inspectorTab === 'objectives' || !selectedDevice) && (
              <div className="p-4 space-y-4 overflow-y-auto max-h-[480px]">
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
                  Only your own saved and closed network lab project files appear here for later reopening or downloading as portable .netlab.json files.
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
                            title={`Download ${toProjectFileName(item.title)}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download File</span>
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
