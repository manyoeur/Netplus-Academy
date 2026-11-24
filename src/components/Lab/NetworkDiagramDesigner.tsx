import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Bold,
  BoxSelect,
  Cable,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileCode,
  FileJson,
  Grid3x3,
  Group,
  Hand,
  Image as ImageIcon,
  Layers,
  Loader2,
  Magnet,
  Maximize2,
  MousePointer2,
  Network,
  Redo2,
  Rows3,
  Search,
  Server,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Upload,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  AlignmentGuideLine,
  CABLE_SPECS,
  CableRoutingStyle,
  CableType,
  computeCableGeometry,
  computeDeviceAlignment,
  computeRackBoundsForNodes,
  ConcretePortSide,
  DIAGRAM_CANVAS_HEIGHT,
  DIAGRAM_CANVAS_WIDTH,
  DIAGRAM_TEMPLATES,
  DeviceCategory,
  DiagramToolMode,
  exportNetworkDiagramToPng,
  exportNetworkDiagramToSvg,
  GRID_SNAP_SIZE,
  LABEL_COLOR_STYLES,
  LABEL_SIZE_CONFIG,
  LabelColorTheme,
  LabelSizePreset,
  NETWORK_DEVICE_STENCILS,
  NetworkDeviceType,
  NetworkDiagramCable,
  NetworkDiagramDocument,
  NetworkDiagramLabel,
  NetworkDiagramNode,
  NetworkDiagramRack,
  NetworkDiagramZone,
  NODE_HEIGHT,
  NODE_WIDTH,
  PortSide,
  RackColorTheme,
  RackContainerStyle,
  resolvePortAnchor,
  STENCIL_MAP,
  ZoneColorTheme
} from '../../utils/networkDiagramData';
import {
  cloneDiagramDocument,
  createInitialDiagramHistory,
  diagramHistoryReducer
} from '../../utils/diagramHistory';
import { NetworkDeviceGlyph } from './NetworkDeviceGlyph';

const STORAGE_KEY = 'netpulse_network_diagram_designer_v1';
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

type SelectionState =
  | { kind: 'node'; id: string }
  | { kind: 'cable'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'label'; id: string }
  | { kind: 'rack'; id: string }
  | null;

const ZONE_STYLE_MAP: Record<
  ZoneColorTheme,
  { container: string; title: string; label: string }
> = {
  blue: {
    container:
      'bg-blue-50/55 dark:bg-blue-950/20 border-blue-300/80 dark:border-cyan-500/35',
    title: 'text-blue-700 dark:text-cyan-300',
    label: 'Blue'
  },
  emerald: {
    container:
      'bg-emerald-50/55 dark:bg-emerald-950/20 border-emerald-300/80 dark:border-emerald-500/35',
    title: 'text-emerald-700 dark:text-emerald-300',
    label: 'Emerald'
  },
  amber: {
    container:
      'bg-amber-50/55 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-500/35',
    title: 'text-amber-700 dark:text-amber-300',
    label: 'Amber'
  },
  violet: {
    container:
      'bg-violet-50/55 dark:bg-violet-950/20 border-violet-300/80 dark:border-violet-500/35',
    title: 'text-violet-700 dark:text-violet-300',
    label: 'Violet'
  },
  slate: {
    container:
      'bg-slate-100/70 dark:bg-slate-800/30 border-slate-300/90 dark:border-slate-600/50',
    title: 'text-slate-700 dark:text-slate-200',
    label: 'Slate'
  }
};

const RACK_STYLE_MAP: Record<
  RackColorTheme,
  {
    label: string;
    container: string;
    header: string;
    rail: string;
    badge: string;
    swatch: string;
  }
> = {
  slate: {
    label: 'Slate',
    container: 'bg-slate-100/85 dark:bg-slate-900/75 border-slate-400/90 dark:border-slate-600',
    header: 'bg-slate-700 dark:bg-slate-800 text-white',
    rail: 'bg-slate-300/60 dark:bg-slate-700/50 border-slate-300 dark:border-slate-700',
    badge: 'bg-slate-600/80 text-slate-100',
    swatch: 'bg-slate-700'
  },
  blue: {
    label: 'Blue',
    container: 'bg-blue-50/85 dark:bg-blue-950/35 border-blue-400/90 dark:border-blue-600/80',
    header: 'bg-blue-700 dark:bg-blue-800 text-white',
    rail: 'bg-blue-200/55 dark:bg-blue-900/45 border-blue-300/80 dark:border-blue-700/70',
    badge: 'bg-blue-600/80 text-blue-50',
    swatch: 'bg-blue-600'
  },
  cyan: {
    label: 'Cyan',
    container: 'bg-sky-50/85 dark:bg-cyan-950/35 border-sky-400/90 dark:border-cyan-500/80',
    header: 'bg-sky-700 dark:bg-cyan-800 text-white',
    rail: 'bg-sky-200/55 dark:bg-cyan-900/45 border-sky-300/80 dark:border-cyan-700/70',
    badge: 'bg-sky-600/80 text-sky-50',
    swatch: 'bg-sky-600'
  },
  emerald: {
    label: 'Green',
    container: 'bg-emerald-50/85 dark:bg-emerald-950/35 border-emerald-400/90 dark:border-emerald-600/80',
    header: 'bg-emerald-700 dark:bg-emerald-800 text-white',
    rail: 'bg-emerald-200/55 dark:bg-emerald-900/45 border-emerald-300/80 dark:border-emerald-700/70',
    badge: 'bg-emerald-600/80 text-emerald-50',
    swatch: 'bg-emerald-600'
  },
  amber: {
    label: 'Amber',
    container: 'bg-amber-50/85 dark:bg-amber-950/35 border-amber-400/90 dark:border-amber-600/80',
    header: 'bg-amber-700 dark:bg-amber-800 text-white',
    rail: 'bg-amber-200/55 dark:bg-amber-900/45 border-amber-300/80 dark:border-amber-700/70',
    badge: 'bg-amber-600/80 text-amber-50',
    swatch: 'bg-amber-600'
  },
  violet: {
    label: 'Violet',
    container: 'bg-violet-50/85 dark:bg-violet-950/35 border-violet-400/90 dark:border-violet-600/80',
    header: 'bg-violet-700 dark:bg-violet-800 text-white',
    rail: 'bg-violet-200/55 dark:bg-violet-900/45 border-violet-300/80 dark:border-violet-700/70',
    badge: 'bg-violet-600/80 text-violet-50',
    swatch: 'bg-violet-600'
  }
};

function reconcileTarget(
  target: SelectionState,
  doc: NetworkDiagramDocument
): SelectionState {
  if (!target) return null;
  if (target.kind === 'node') {
    return doc.nodes.some(n => n.id === target.id) ? target : null;
  }
  if (target.kind === 'cable') {
    return doc.cables.some(c => c.id === target.id) ? target : null;
  }
  if (target.kind === 'label') {
    return (doc.labels || []).some(l => l.id === target.id) ? target : null;
  }
  if (target.kind === 'rack') {
    return (doc.racks || []).some(r => r.id === target.id) ? target : null;
  }
  return doc.zones.some(z => z.id === target.id) ? target : null;
}

function loadInitialDiagram(): NetworkDiagramDocument {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray(parsed.nodes) &&
        Array.isArray(parsed.cables) &&
        Array.isArray(parsed.zones)
      ) {
        return {
          name: typeof parsed.name === 'string' ? parsed.name : 'Network Topology Diagram',
          nodes: parsed.nodes,
          cables: parsed.cables,
          zones: parsed.zones,
          labels: Array.isArray(parsed.labels) ? parsed.labels : [],
          racks: Array.isArray(parsed.racks) ? parsed.racks : []
        };
      }
    }
  } catch {
    // Fall back to default starter template
  }
  return cloneDiagramDocument(DIAGRAM_TEMPLATES[0].document);
}

export const NetworkDiagramDesigner: React.FC = () => {
  const [history, dispatchHistory] = useReducer(
    diagramHistoryReducer,
    undefined,
    () => createInitialDiagramHistory(loadInitialDiagram())
  );
  const doc = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const [toolMode, setToolMode] = useState<DiagramToolMode>('select');
  const [activeCableType, setActiveCableType] = useState<CableType>('ethernet');
  const [activeRoutingStyle, setActiveRoutingStyle] =
    useState<CableRoutingStyle>('orthogonal');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [guidesEnabled, setGuidesEnabled] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(0.9);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const [selection, setSelection] = useState<SelectionState>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [inspectorTarget, setInspectorTarget] = useState<SelectionState>(null);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [stencilQuery, setStencilQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'All' | DeviceCategory>('All');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [exportedImageFormat, setExportedImageFormat] = useState<'png' | 'svg' | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuideLine[]>([]);

  // Marquee multi-selection box on canvas
  const [marqueeRect, setMarqueeRect] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Live rubber-band cable preview when dragging from a device port
  const [wirePreview, setWirePreview] = useState<{
    sourceId: string;
    sourcePort: ConcretePortSide;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const labelInputRef = useRef<HTMLTextAreaElement | null>(null);
  const spacePressedRef = useRef<boolean>(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  selectedNodeIdsRef.current = selectedNodeIds;
  const snapToGridRef = useRef(snapToGrid);
  snapToGridRef.current = snapToGrid;
  const guidesEnabledRef = useRef(guidesEnabled);
  guidesEnabledRef.current = guidesEnabled;

  const focusCanvas = useCallback(() => {
    viewportRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
      // Ignore storage quota errors
    }
  }, [doc]);

  useEffect(() => {
    setSelection(prev => reconcileTarget(prev, doc));
    setInspectorTarget(prev => reconcileTarget(prev, doc));
    const validIds = new Set(doc.nodes.map(n => n.id));
    setSelectedNodeIds(prev => {
      const filtered = prev.filter(id => validIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [doc]);

  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handlePointerDown = (evt: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(evt.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKey = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isExportMenuOpen]);

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => {
      setStatusNotice(prev => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const commitChange = useCallback(
    (updater: (prev: NetworkDiagramDocument) => NetworkDiagramDocument) => {
      dispatchHistory({ type: 'COMMIT', updater });
    },
    []
  );

  const commitCoalescedEdit = useCallback(
    (editKey: string, updater: (prev: NetworkDiagramDocument) => NetworkDiagramDocument) => {
      dispatchHistory({
        type: 'COALESCED_EDIT',
        editKey,
        now: Date.now(),
        updater
      });
    },
    []
  );

  const endEditSession = useCallback(() => {
    dispatchHistory({ type: 'END_EDIT_SESSION' });
  }, []);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    dispatchHistory({ type: 'UNDO' });
    setConnectSourceId(null);
    setWirePreview(null);
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    dispatchHistory({ type: 'REDO' });
    setConnectSourceId(null);
    setWirePreview(null);
  }, [canRedo]);

  const snapCoord = useCallback(
    (val: number) => (snapToGrid ? Math.round(val / GRID_SNAP_SIZE) * GRID_SNAP_SIZE : Math.round(val)),
    [snapToGrid]
  );

  const clientToCanvas = useCallback((clientX: number, clientY: number) => {
    const el = viewportRef.current;
    if (!el) return { x: 200, y: 200 };
    const rect = el.getBoundingClientRect();
    const x = (clientX - rect.left + el.scrollLeft) / zoomRef.current;
    const y = (clientY - rect.top + el.scrollTop) / zoomRef.current;
    return {
      x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, x)),
      y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, y))
    };
  }, []);

  const addDeviceAt = useCallback(
    (
      deviceType: NetworkDeviceType,
      rawX?: number,
      rawY?: number,
      useExactCoords: boolean = false
    ) => {
      const meta = STENCIL_MAP[deviceType];
      const el = viewportRef.current;
      let x = rawX;
      let y = rawY;

      if (x === undefined || y === undefined) {
        if (el) {
          const centerX = (el.scrollLeft + el.clientWidth / 2) / zoomRef.current - NODE_WIDTH / 2;
          const centerY = (el.scrollTop + el.clientHeight / 2) / zoomRef.current - NODE_HEIGHT / 2;
          const cascade = (docRef.current.nodes.length % 5) * 24;
          x = centerX + cascade;
          y = centerY + cascade;
        } else {
          x = 240;
          y = 180;
        }
      }

      const finalX = useExactCoords ? Math.round(x) : snapCoord(x);
      const finalY = useExactCoords ? Math.round(y) : snapCoord(y);

      const existingCount = docRef.current.nodes.filter(n => n.type === deviceType).length + 1;
      const newNode: NetworkDiagramNode = {
        id: `nd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: deviceType,
        label: `${meta.shortPrefix}-${String(existingCount).padStart(2, '0')}`,
        ipAddress: meta.defaultIp,
        subnetMask: meta.defaultMask,
        vlanOrAsn: meta.defaultVlanOrAsn,
        notes: '',
        x: Math.max(20, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20, finalX)),
        y: Math.max(20, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20, finalY))
      };

      commitChange(prev => ({
        ...prev,
        nodes: [...prev.nodes, newNode]
      }));
      setSelectedNodeIds([]);
      setSelection({ kind: 'node', id: newNode.id });
      setInspectorTarget(null);
      setToolMode('select');
    },
    [commitChange, snapCoord]
  );

  const addZoneAt = useCallback(
    (rawX?: number, rawY?: number) => {
      const el = viewportRef.current;
      let x = rawX;
      let y = rawY;
      if (x === undefined || y === undefined) {
        if (el) {
          x = (el.scrollLeft + el.clientWidth / 2) / zoomRef.current - 160;
          y = (el.scrollTop + el.clientHeight / 2) / zoomRef.current - 110;
        } else {
          x = 180;
          y = 140;
        }
      }

      const newZone: NetworkDiagramZone = {
        id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `Network Zone ${docRef.current.zones.length + 1}`,
        subtitle: '10.0.0.0/24',
        color: 'blue',
        x: Math.max(20, snapCoord(x)),
        y: Math.max(20, snapCoord(y)),
        width: 340,
        height: 220
      };

      commitChange(prev => ({
        ...prev,
        zones: [...prev.zones, newZone]
      }));
      setSelectedNodeIds([]);
      setSelection({ kind: 'zone', id: newZone.id });
      setInspectorTarget(null);
      setToolMode('select');
    },
    [commitChange, snapCoord]
  );

  const addLabelAt = useCallback(
    (rawX?: number, rawY?: number) => {
      const el = viewportRef.current;
      let x = rawX;
      let y = rawY;
      if (x === undefined || y === undefined) {
        if (el) {
          const cascade = ((docRef.current.labels || []).length % 5) * 20;
          x = (el.scrollLeft + el.clientWidth / 2) / zoomRef.current - 55 + cascade;
          y = (el.scrollTop + el.clientHeight / 2) / zoomRef.current - 16 + cascade;
        } else {
          x = 260;
          y = 200;
        }
      }

      const newLabel: NetworkDiagramLabel = {
        id: `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: 'Label',
        x: Math.max(10, Math.min(DIAGRAM_CANVAS_WIDTH - 140, snapCoord(x))),
        y: Math.max(10, Math.min(DIAGRAM_CANVAS_HEIGHT - 40, snapCoord(y))),
        fontSize: 'sm',
        color: 'slate',
        bold: false
      };

      commitChange(prev => ({
        ...prev,
        labels: [...(prev.labels || []), newLabel]
      }));
      setSelectedNodeIds([]);
      setSelection({ kind: 'label', id: newLabel.id });
      setInspectorTarget({ kind: 'label', id: newLabel.id });
      setToolMode('select');
      window.requestAnimationFrame(() => {
        labelInputRef.current?.focus();
        labelInputRef.current?.select();
      });
    },
    [commitChange, snapCoord]
  );

  const createCableBetween = useCallback(
    (
      sourceId: string,
      targetId: string,
      sourcePort: PortSide = 'auto',
      targetPort: PortSide = 'auto'
    ) => {
      if (sourceId === targetId) return;
      const spec = CABLE_SPECS[activeCableType];
      const newCable: NetworkDiagramCable = {
        id: `cb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sourceId,
        targetId,
        sourcePort,
        targetPort,
        cableType: activeCableType,
        routingStyle: activeRoutingStyle,
        bandwidth: spec.defaultBandwidth,
        sourceInterface: 'Gi0/0',
        targetInterface: 'Gi0/1',
        label: ''
      };

      commitChange(prev => ({
        ...prev,
        cables: [...prev.cables, newCable]
      }));
      setSelectedNodeIds([]);
      setSelection({ kind: 'cable', id: newCable.id });
      setInspectorTarget(null);
    },
    [activeCableType, activeRoutingStyle, commitChange]
  );

  const groupNodesIntoRack = useCallback(
    (nodeIdsToGroup: string[], style: RackContainerStyle = 'rack') => {
      const validIds = Array.from(
        new Set(
          nodeIdsToGroup.filter(id => docRef.current.nodes.some(n => n.id === id))
        )
      );
      if (validIds.length === 0) return;

      const memberNodes = docRef.current.nodes.filter(n => validIds.includes(n.id));
      const bounds = computeRackBoundsForNodes(memberNodes, style);
      const rackIndex = (docRef.current.racks || []).length + 1;
      const newRack: NetworkDiagramRack = {
        id: `rack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: style === 'rack' ? `Rack ${String(rackIndex).padStart(2, '0')}` : `Device Group ${rackIndex}`,
        subtitle: style === 'rack' ? '19" Enclosure' : `${validIds.length} Devices`,
        style,
        color: style === 'rack' ? 'slate' : 'blue',
        nodeIds: validIds,
        x: snapCoord(bounds.x),
        y: snapCoord(bounds.y),
        width: snapCoord(bounds.width),
        height: snapCoord(bounds.height)
      };

      const groupedSet = new Set(validIds);
      commitChange(prev => ({
        ...prev,
        racks: [
          ...(prev.racks || [])
            .map(r => ({
              ...r,
              nodeIds: r.nodeIds.filter(id => !groupedSet.has(id))
            }))
            .filter(r => r.nodeIds.length > 0),
          newRack
        ]
      }));

      setSelectedNodeIds([]);
      setSelection({ kind: 'rack', id: newRack.id });
      setInspectorTarget(null);
      setToolMode('select');
      showNotice(
        `Grouped ${validIds.length} device${validIds.length === 1 ? '' : 's'} into ${newRack.title}.`
      );
    },
    [commitChange, snapCoord, showNotice]
  );

  const ungroupRack = useCallback(
    (rackId: string) => {
      const targetRack = (docRef.current.racks || []).find(r => r.id === rackId);
      if (!targetRack) return;
      const memberIds = targetRack.nodeIds.filter(id =>
        docRef.current.nodes.some(n => n.id === id)
      );

      commitChange(prev => ({
        ...prev,
        racks: (prev.racks || []).filter(r => r.id !== rackId)
      }));

      setInspectorTarget(prev => (prev?.kind === 'rack' && prev.id === rackId ? null : prev));
      setSelectedNodeIds(memberIds);
      setSelection(memberIds.length > 0 ? { kind: 'node', id: memberIds[0] } : null);
      showNotice(`Ungrouped "${targetRack.title}" — ${memberIds.length} devices kept.`);
    },
    [commitChange, showNotice]
  );

  const fitRackToMembers = useCallback(
    (rackId: string) => {
      const rack = (docRef.current.racks || []).find(r => r.id === rackId);
      if (!rack) return;
      const members = docRef.current.nodes.filter(n => rack.nodeIds.includes(n.id));
      if (members.length === 0) return;
      const bounds = computeRackBoundsForNodes(members, rack.style);
      commitChange(prev => ({
        ...prev,
        racks: (prev.racks || []).map(r =>
          r.id === rackId
            ? {
                ...r,
                x: snapCoord(bounds.x),
                y: snapCoord(bounds.y),
                width: snapCoord(bounds.width),
                height: snapCoord(bounds.height)
              }
            : r
        )
      }));
    },
    [commitChange, snapCoord]
  );

  const stackRackMembersVertically = useCallback(
    (rackId: string) => {
      const rack = (docRef.current.racks || []).find(r => r.id === rackId);
      if (!rack) return;
      const members = rack.nodeIds
        .map(id => docRef.current.nodes.find(n => n.id === id))
        .filter((n): n is NetworkDiagramNode => Boolean(n));
      if (members.length === 0) return;

      const slotX = snapCoord(rack.x + Math.max(36, (rack.width - NODE_WIDTH) / 2));
      const startY = snapCoord(rack.y + 48);
      const stepY = NODE_HEIGHT + 12;

      const updatedPos = new Map<string, { x: number; y: number }>();
      members.forEach((m, idx) => {
        updatedPos.set(m.id, {
          x: Math.max(20, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20, slotX)),
          y: Math.max(20, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20, startY + idx * stepY))
        });
      });

      const simulatedNodes = members.map(m => ({
        ...m,
        ...(updatedPos.get(m.id) || { x: m.x, y: m.y })
      }));
      const bounds = computeRackBoundsForNodes(simulatedNodes, rack.style);

      commitChange(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => {
          const p = updatedPos.get(n.id);
          return p ? { ...n, x: p.x, y: p.y } : n;
        }),
        racks: (prev.racks || []).map(r =>
          r.id === rackId
            ? {
                ...r,
                x: snapCoord(bounds.x),
                y: snapCoord(bounds.y),
                width: Math.max(180, snapCoord(bounds.width)),
                height: Math.max(140, snapCoord(bounds.height))
              }
            : r
        )
      }));
      showNotice(`Stacked ${members.length} devices inside ${rack.title}.`);
    },
    [commitChange, snapCoord, showNotice]
  );

  const handleDeleteSelection = useCallback(() => {
    if (selectedNodeIds.length > 1) {
      const delSet = new Set(selectedNodeIds);
      commitChange(prev => ({
        ...prev,
        nodes: prev.nodes.filter(n => !delSet.has(n.id)),
        cables: prev.cables.filter(c => !delSet.has(c.sourceId) && !delSet.has(c.targetId)),
        racks: (prev.racks || [])
          .map(r => ({ ...r, nodeIds: r.nodeIds.filter(id => !delSet.has(id)) }))
          .filter(r => r.nodeIds.length > 0)
      }));
      setSelectedNodeIds([]);
      setSelection(null);
      setInspectorTarget(null);
      return;
    }

    const target = selection || inspectorTarget;
    if (!target) return;
    if (target.kind === 'node') {
      commitChange(prev => ({
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== target.id),
        cables: prev.cables.filter(
          c => c.sourceId !== target.id && c.targetId !== target.id
        ),
        racks: (prev.racks || [])
          .map(r => ({ ...r, nodeIds: r.nodeIds.filter(id => id !== target.id) }))
          .filter(r => r.nodeIds.length > 0)
      }));
      setSelectedNodeIds([]);
    } else if (target.kind === 'cable') {
      commitChange(prev => ({
        ...prev,
        cables: prev.cables.filter(c => c.id !== target.id)
      }));
    } else if (target.kind === 'zone') {
      commitChange(prev => ({
        ...prev,
        zones: prev.zones.filter(z => z.id !== target.id)
      }));
    } else if (target.kind === 'label') {
      commitChange(prev => ({
        ...prev,
        labels: (prev.labels || []).filter(l => l.id !== target.id)
      }));
    } else if (target.kind === 'rack') {
      const rack = (docRef.current.racks || []).find(r => r.id === target.id);
      const delSet = new Set(rack?.nodeIds || []);
      commitChange(prev => ({
        ...prev,
        racks: (prev.racks || []).filter(r => r.id !== target.id),
        nodes: prev.nodes.filter(n => !delSet.has(n.id)),
        cables: prev.cables.filter(c => !delSet.has(c.sourceId) && !delSet.has(c.targetId))
      }));
      setSelectedNodeIds([]);
    }
    setSelection(null);
    setInspectorTarget(null);
  }, [selectedNodeIds, selection, inspectorTarget, commitChange]);

  const handleDuplicateSelectedNode = useCallback(() => {
    if (selectedNodeIds.length > 1) {
      const origNodes = docRef.current.nodes.filter(n => selectedNodeIds.includes(n.id));
      if (origNodes.length === 0) return;
      const idMap = new Map<string, string>();
      const clonedNodes: NetworkDiagramNode[] = origNodes.map((orig, idx) => {
        const newId = `nd-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
        idMap.set(orig.id, newId);
        return {
          ...orig,
          id: newId,
          label: `${orig.label}-copy`,
          x: Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20, orig.x + 40),
          y: Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20, orig.y + 40)
        };
      });
      const clonedCables: NetworkDiagramCable[] = docRef.current.cables
        .filter(c => idMap.has(c.sourceId) && idMap.has(c.targetId))
        .map((c, idx) => ({
          ...c,
          id: `cb-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          sourceId: idMap.get(c.sourceId)!,
          targetId: idMap.get(c.targetId)!
        }));
      commitChange(prev => ({
        ...prev,
        nodes: [...prev.nodes, ...clonedNodes],
        cables: [...prev.cables, ...clonedCables]
      }));
      const newIds = clonedNodes.map(n => n.id);
      setSelectedNodeIds(newIds);
      setSelection({ kind: 'node', id: newIds[0] });
      return;
    }

    const target = selection || inspectorTarget;
    if (!target) return;

    if (target.kind === 'node') {
      const orig = docRef.current.nodes.find(n => n.id === target.id);
      if (!orig) return;
      const clone: NetworkDiagramNode = {
        ...orig,
        id: `nd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: `${orig.label}-copy`,
        x: Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20, orig.x + 40),
        y: Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20, orig.y + 40)
      };
      commitChange(prev => ({
        ...prev,
        nodes: [...prev.nodes, clone]
      }));
      setSelectedNodeIds([clone.id]);
      setSelection({ kind: 'node', id: clone.id });
      if (inspectorTarget?.kind === 'node') {
        setInspectorTarget({ kind: 'node', id: clone.id });
      }
    } else if (target.kind === 'label') {
      const orig = (docRef.current.labels || []).find(l => l.id === target.id);
      if (!orig) return;
      const clone: NetworkDiagramLabel = {
        ...orig,
        id: `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: Math.min(DIAGRAM_CANVAS_WIDTH - 120, orig.x + 24),
        y: Math.min(DIAGRAM_CANVAS_HEIGHT - 40, orig.y + 24)
      };
      commitChange(prev => ({
        ...prev,
        labels: [...(prev.labels || []), clone]
      }));
      setSelection({ kind: 'label', id: clone.id });
      if (inspectorTarget?.kind === 'label') {
        setInspectorTarget({ kind: 'label', id: clone.id });
      }
    } else if (target.kind === 'rack') {
      const origRack = (docRef.current.racks || []).find(r => r.id === target.id);
      if (!origRack) return;
      const offsetX = 40;
      const offsetY = 40;
      const idMap = new Map<string, string>();
      const memberNodes = docRef.current.nodes.filter(n => origRack.nodeIds.includes(n.id));
      const clonedNodes: NetworkDiagramNode[] = memberNodes.map((m, idx) => {
        const newId = `nd-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`;
        idMap.set(m.id, newId);
        return {
          ...m,
          id: newId,
          label: `${m.label}-copy`,
          x: Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20, m.x + offsetX),
          y: Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20, m.y + offsetY)
        };
      });
      const clonedCables: NetworkDiagramCable[] = docRef.current.cables
        .filter(c => idMap.has(c.sourceId) && idMap.has(c.targetId))
        .map((c, idx) => ({
          ...c,
          id: `cb-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          sourceId: idMap.get(c.sourceId)!,
          targetId: idMap.get(c.targetId)!
        }));
      const clonedRack: NetworkDiagramRack = {
        ...origRack,
        id: `rack-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: `${origRack.title} Copy`,
        nodeIds: clonedNodes.map(n => n.id),
        x: Math.min(DIAGRAM_CANVAS_WIDTH - origRack.width - 10, origRack.x + offsetX),
        y: Math.min(DIAGRAM_CANVAS_HEIGHT - origRack.height - 10, origRack.y + offsetY)
      };
      commitChange(prev => ({
        ...prev,
        nodes: [...prev.nodes, ...clonedNodes],
        cables: [...prev.cables, ...clonedCables],
        racks: [...(prev.racks || []), clonedRack]
      }));
      setSelection({ kind: 'rack', id: clonedRack.id });
      if (inspectorTarget?.kind === 'rack') {
        setInspectorTarget({ kind: 'rack', id: clonedRack.id });
      }
    }
  }, [selectedNodeIds, selection, inspectorTarget, commitChange]);

  // Keyboard controls inside Network Designer (Undo/Redo, Group/Ungroup, Select All, Delete, Escape, Duplicate, Nudge, Space Pan)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        spacePressedRef.current = true;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        if (docRef.current.nodes.length > 0) {
          e.preventDefault();
          const allIds = docRef.current.nodes.map(n => n.id);
          setSelectedNodeIds(allIds);
          setSelection({ kind: 'node', id: allIds[0] });
          setInspectorTarget(null);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          const rackId =
            selection?.kind === 'rack'
              ? selection.id
              : inspectorTarget?.kind === 'rack'
              ? inspectorTarget.id
              : null;
          if (rackId) ungroupRack(rackId);
        } else if (selectedNodeIds.length >= 1) {
          groupNodesIntoRack(selectedNodeIds, 'rack');
        } else if (selection?.kind === 'node') {
          groupNodesIntoRack([selection.id], 'rack');
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (
          selectedNodeIds.length > 0 ||
          selection?.kind === 'node' ||
          selection?.kind === 'label' ||
          selection?.kind === 'rack'
        ) {
          e.preventDefault();
          handleDuplicateSelectedNode();
        }
        return;
      }

      if (e.key === 'Escape') {
        setConnectSourceId(null);
        setWirePreview(null);
        setMarqueeRect(null);
        setInspectorTarget(null);
        setSelectedNodeIds([]);
        setSelection(null);
        setToolMode('select');
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && (selection || selectedNodeIds.length > 0)) {
        e.preventDefault();
        handleDeleteSelection();
        return;
      }

      if (
        (selectedNodeIds.length > 0 ||
          selection?.kind === 'node' ||
          selection?.kind === 'label' ||
          selection?.kind === 'rack') &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? GRID_SNAP_SIZE : 4;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;

        if (selection?.kind === 'rack') {
          const rackId = selection.id;
          const rackObj = (docRef.current.racks || []).find(r => r.id === rackId);
          const memberSet = new Set(rackObj?.nodeIds || []);
          commitCoalescedEdit(`nudge-rack:${rackId}`, prev => ({
            ...prev,
            racks: (prev.racks || []).map(r =>
              r.id === rackId
                ? {
                    ...r,
                    x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - r.width, r.x + dx)),
                    y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - r.height, r.y + dy))
                  }
                : r
            ),
            nodes: prev.nodes.map(n =>
              memberSet.has(n.id)
                ? {
                    ...n,
                    x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, n.x + dx)),
                    y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, n.y + dy))
                  }
                : n
            )
          }));
        } else if (selectedNodeIds.length > 0 || selection?.kind === 'node') {
          const moveIds =
            selectedNodeIds.length > 0
              ? new Set(selectedNodeIds)
              : new Set(selection?.kind === 'node' ? [selection.id] : []);
          commitCoalescedEdit(`nudge-nodes:${Array.from(moveIds).join(',')}`, prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
              moveIds.has(n.id)
                ? {
                    ...n,
                    x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, n.x + dx)),
                    y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, n.y + dy))
                  }
                : n
            )
          }));
        } else if (selection?.kind === 'label') {
          commitCoalescedEdit(`nudge-label:${selection.id}`, prev => ({
            ...prev,
            labels: (prev.labels || []).map(l =>
              l.id === selection.id
                ? {
                    ...l,
                    x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - 40, l.x + dx)),
                    y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - 24, l.y + dy))
                  }
                : l
            )
          }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    selection,
    selectedNodeIds,
    inspectorTarget,
    handleUndo,
    handleRedo,
    handleDeleteSelection,
    handleDuplicateSelectedNode,
    groupNodesIntoRack,
    ungroupRack,
    commitCoalescedEdit
  ]);

  const applyZoom = useCallback((nextRaw: number, anchorX?: number, anchorY?: number) => {
    const clamped = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.round(nextRaw * 100) / 100)
    );
    const el = viewportRef.current;
    const prevZoom = zoomRef.current;
    if (!el || clamped === prevZoom) {
      zoomRef.current = clamped;
      setZoom(clamped);
      return;
    }

    const ax = anchorX ?? el.clientWidth / 2;
    const ay = anchorY ?? el.clientHeight / 2;
    const contentX = (el.scrollLeft + ax) / prevZoom;
    const contentY = (el.scrollTop + ay) / prevZoom;

    zoomRef.current = clamped;
    setZoom(clamped);

    window.requestAnimationFrame(() => {
      const target = viewportRef.current;
      if (!target) return;
      target.scrollLeft = Math.max(0, contentX * clamped - ax);
      target.scrollTop = Math.max(0, contentY * clamped - ay);
    });
  }, []);

  const handleFitDiagram = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    docRef.current.zones.forEach(z => {
      minX = Math.min(minX, z.x);
      minY = Math.min(minY, z.y);
      maxX = Math.max(maxX, z.x + z.width);
      maxY = Math.max(maxY, z.y + z.height);
    });
    (docRef.current.racks || []).forEach(r => {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.width);
      maxY = Math.max(maxY, r.y + r.height);
    });
    docRef.current.nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_WIDTH);
      maxY = Math.max(maxY, n.y + NODE_HEIGHT);
    });
    (docRef.current.labels || []).forEach(lbl => {
      minX = Math.min(minX, lbl.x);
      minY = Math.min(minY, lbl.y);
      maxX = Math.max(maxX, lbl.x + Math.max(80, lbl.text.length * 9));
      maxY = Math.max(maxY, lbl.y + 36);
    });

    if (!Number.isFinite(minX)) {
      applyZoom(1);
      el.scrollLeft = 0;
      el.scrollTop = 0;
      return;
    }

    const boxW = Math.max(300, maxX - minX + 80);
    const boxH = Math.max(240, maxY - minY + 80);
    const fitScale = Math.min(
      (el.clientWidth - 24) / boxW,
      (el.clientHeight - 24) / boxH
    );
    const clampedFit = Math.max(MIN_ZOOM, Math.min(1.1, Math.floor(fitScale * 100) / 100));
    zoomRef.current = clampedFit;
    setZoom(clampedFit);

    window.requestAnimationFrame(() => {
      const target = viewportRef.current;
      if (!target) return;
      const centerX = ((minX + maxX) / 2) * clampedFit - target.clientWidth / 2;
      const centerY = ((minY + maxY) / 2) * clampedFit - target.clientHeight / 2;
      target.scrollLeft = Math.max(0, centerX);
      target.scrollTop = Math.max(0, centerY);
    });
  }, [applyZoom]);

  // Ctrl/Cmd + Scroll Zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const step = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      applyZoom(zoomRef.current + step, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [applyZoom]);

  // Dragging a single device node or all currently selected nodes together
  const startNodeDrag = (e: React.MouseEvent, node: NetworkDiagramNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    focusCanvas();

    if (toolMode === 'connect') {
      setInspectorTarget(null);
      setSelectedNodeIds([]);
      if (!connectSourceId) {
        setConnectSourceId(node.id);
        setSelection({ kind: 'node', id: node.id });
      } else if (connectSourceId === node.id) {
        setConnectSourceId(null);
      } else {
        createCableBetween(connectSourceId, node.id);
        setConnectSourceId(null);
      }
      return;
    }

    const isToggleModifier = e.shiftKey || e.metaKey || e.ctrlKey;
    const currentSelected = selectedNodeIdsRef.current;

    if (isToggleModifier) {
      const exists = currentSelected.includes(node.id);
      const nextIds = exists
        ? currentSelected.filter(id => id !== node.id)
        : [...currentSelected, node.id];
      setSelectedNodeIds(nextIds);
      setSelection(nextIds.length > 0 ? { kind: 'node', id: nextIds[nextIds.length - 1] } : null);
      setInspectorTarget(null);
      return;
    }

    const activeMoveIds =
      currentSelected.length > 1 && currentSelected.includes(node.id)
        ? currentSelected
        : [node.id];

    const clickedWasPartOfMulti =
      currentSelected.length > 1 && currentSelected.includes(node.id);

    if (!clickedWasPartOfMulti) {
      setSelectedNodeIds([node.id]);
    }
    setSelection({ kind: 'node', id: node.id });
    setInspectorTarget(prev => (prev && prev.kind === 'node' && prev.id === node.id ? prev : null));

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const preDragDoc = cloneDiagramDocument(docRef.current);
    const activeMoveSet = new Set(activeMoveIds);
    const stationaryNodes = preDragDoc.nodes.filter(n => !activeMoveSet.has(n.id));
    const origPositions = new Map<string, { x: number; y: number }>();
    preDragDoc.nodes.forEach(n => {
      if (activeMoveSet.has(n.id)) {
        origPositions.set(n.id, { x: n.x, y: n.y });
      }
    });

    const origCoords = Array.from(origPositions.values());
    const boxOrigX = origCoords.length > 0 ? Math.min(...origCoords.map(p => p.x)) : node.x;
    const boxOrigY = origCoords.length > 0 ? Math.min(...origCoords.map(p => p.y)) : node.y;
    const boxMaxX =
      origCoords.length > 0
        ? Math.max(...origCoords.map(p => p.x + NODE_WIDTH))
        : node.x + NODE_WIDTH;
    const boxMaxY =
      origCoords.length > 0
        ? Math.max(...origCoords.map(p => p.y + NODE_HEIGHT))
        : node.y + NODE_HEIGHT;
    const boxW = Math.max(NODE_WIDTH, boxMaxX - boxOrigX);
    const boxH = Math.max(NODE_HEIGHT, boxMaxY - boxOrigY);

    let deltaX = 0;
    let deltaY = 0;
    let hasMoved = false;

    const onMove = (moveEvt: MouseEvent) => {
      const rawDx = (moveEvt.clientX - startClientX) / zoomRef.current;
      const rawDy = (moveEvt.clientY - startClientY) / zoomRef.current;
      if (!hasMoved && Math.hypot(rawDx, rawDy) > 3) {
        hasMoved = true;
      }
      if (!hasMoved) return;

      const aligned = computeDeviceAlignment(
        boxOrigX + rawDx,
        boxOrigY + rawDy,
        boxW,
        boxH,
        stationaryNodes,
        {
          snapToGrid: snapToGridRef.current,
          enableGuides: guidesEnabledRef.current,
          bypassSnap: moveEvt.altKey
        }
      );

      deltaX = aligned.x - boxOrigX;
      deltaY = aligned.y - boxOrigY;
      setAlignmentGuides(aligned.guides);

      dispatchHistory({
        type: 'PREVIEW',
        updater: prev => ({
          ...prev,
          nodes: prev.nodes.map(n => {
            const orig = origPositions.get(n.id);
            if (!orig) return n;
            return {
              ...n,
              x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, orig.x + deltaX)),
              y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, orig.y + deltaY))
            };
          })
        })
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setAlignmentGuides([]);
      if (hasMoved) {
        const finalDoc: NetworkDiagramDocument = {
          ...preDragDoc,
          nodes: preDragDoc.nodes.map(n => {
            const orig = origPositions.get(n.id);
            if (!orig) return n;
            return {
              ...n,
              x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, orig.x + deltaX)),
              y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, orig.y + deltaY))
            };
          })
        };
        dispatchHistory({
          type: 'COMMIT_DRAG',
          preDragDoc,
          nextDoc: finalDoc
        });
      } else if (clickedWasPartOfMulti) {
        // Clicking one node inside a multi-selection without dragging focuses that single node
        setSelectedNodeIds([node.id]);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Dragging from a specific device port handle to draw a new cable
  const startPortCableDrag = (
    e: React.MouseEvent,
    node: NetworkDiagramNode,
    side: ConcretePortSide
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const anchor = resolvePortAnchor(node, side);
    setWirePreview({
      sourceId: node.id,
      sourcePort: side,
      startX: anchor.x,
      startY: anchor.y,
      endX: anchor.x,
      endY: anchor.y
    });

    const onMove = (moveEvt: MouseEvent) => {
      const pt = clientToCanvas(moveEvt.clientX, moveEvt.clientY);
      setWirePreview(prev => (prev ? { ...prev, endX: pt.x, endY: pt.y } : null));
    };

    const onUp = (upEvt: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setWirePreview(null);

      const targetEl = (upEvt.target as HTMLElement | null)?.closest(
        '[data-node-id]'
      ) as HTMLElement | null;
      const targetNodeId = targetEl?.getAttribute('data-node-id');
      const targetPortAttr = (upEvt.target as HTMLElement | null)
        ?.closest('[data-port-side]')
        ?.getAttribute('data-port-side') as ConcretePortSide | undefined;

      if (targetNodeId && targetNodeId !== node.id) {
        createCableBetween(node.id, targetNodeId, side, targetPortAttr || 'auto');
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Dragging or resizing a Zone frame
  const startZoneDrag = (
    e: React.MouseEvent,
    zone: NetworkDiagramZone,
    mode: 'move' | 'resize'
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    focusCanvas();
    setSelection({ kind: 'zone', id: zone.id });
    setInspectorTarget(prev => (prev && prev.kind === 'zone' && prev.id === zone.id ? prev : null));

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = zone.x;
    const origY = zone.y;
    const origW = zone.width;
    const origH = zone.height;
    let latestX = origX;
    let latestY = origY;
    let latestW = origW;
    let latestH = origH;
    const preDragDoc = cloneDiagramDocument(docRef.current);
    let hasMoved = false;

    const onMove = (moveEvt: MouseEvent) => {
      const dx = (moveEvt.clientX - startClientX) / zoomRef.current;
      const dy = (moveEvt.clientY - startClientY) / zoomRef.current;
      if (!hasMoved && Math.hypot(dx, dy) > 3) {
        hasMoved = true;
      }
      if (!hasMoved) return;

      if (mode === 'move') {
        latestX = Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - zone.width, snapCoord(origX + dx)));
        latestY = Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - zone.height, snapCoord(origY + dy)));
      } else {
        latestW = Math.max(180, snapCoord(origW + dx));
        latestH = Math.max(120, snapCoord(origH + dy));
      }

      dispatchHistory({
        type: 'PREVIEW',
        updater: prev => ({
          ...prev,
          zones: prev.zones.map(z =>
            z.id === zone.id
              ? { ...z, x: latestX, y: latestY, width: latestW, height: latestH }
              : z
          )
        })
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (hasMoved) {
        const finalDoc: NetworkDiagramDocument = {
          ...preDragDoc,
          zones: preDragDoc.zones.map(z =>
            z.id === zone.id
              ? { ...z, x: latestX, y: latestY, width: latestW, height: latestH }
              : z
          )
        };
        dispatchHistory({
          type: 'COMMIT_DRAG',
          preDragDoc,
          nextDoc: finalDoc
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Dragging a standalone text label
  const startLabelDrag = (e: React.MouseEvent, lbl: NetworkDiagramLabel) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    focusCanvas();
    setSelection({ kind: 'label', id: lbl.id });
    setInspectorTarget(prev => (prev && prev.kind === 'label' && prev.id === lbl.id ? prev : null));

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = lbl.x;
    const origY = lbl.y;
    let latestX = origX;
    let latestY = origY;
    const preDragDoc = cloneDiagramDocument(docRef.current);
    let hasMoved = false;

    const onMove = (moveEvt: MouseEvent) => {
      const dx = (moveEvt.clientX - startClientX) / zoomRef.current;
      const dy = (moveEvt.clientY - startClientY) / zoomRef.current;
      if (!hasMoved && Math.hypot(dx, dy) > 3) {
        hasMoved = true;
      }
      if (!hasMoved) return;

      latestX = Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - 40, snapCoord(origX + dx)));
      latestY = Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - 24, snapCoord(origY + dy)));

      dispatchHistory({
        type: 'PREVIEW',
        updater: prev => ({
          ...prev,
          labels: (prev.labels || []).map(item =>
            item.id === lbl.id ? { ...item, x: latestX, y: latestY } : item
          )
        })
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (hasMoved) {
        const finalDoc: NetworkDiagramDocument = {
          ...preDragDoc,
          labels: (preDragDoc.labels || []).map(item =>
            item.id === lbl.id ? { ...item, x: latestX, y: latestY } : item
          )
        };
        dispatchHistory({
          type: 'COMMIT_DRAG',
          preDragDoc,
          nextDoc: finalDoc
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Dragging or resizing a Rack / Device Group Container (moving moves all member devices together)
  const startRackDrag = (
    e: React.MouseEvent,
    rack: NetworkDiagramRack,
    mode: 'move' | 'resize'
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    focusCanvas();
    setSelectedNodeIds([]);
    setSelection({ kind: 'rack', id: rack.id });
    setInspectorTarget(prev => (prev && prev.kind === 'rack' && prev.id === rack.id ? prev : null));

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = rack.x;
    const origY = rack.y;
    const origW = rack.width;
    const origH = rack.height;
    const preDragDoc = cloneDiagramDocument(docRef.current);
    const memberSet = new Set(rack.nodeIds);
    const stationaryNodes = preDragDoc.nodes.filter(n => !memberSet.has(n.id));
    const origMemberPos = new Map<string, { x: number; y: number }>();
    preDragDoc.nodes.forEach(n => {
      if (memberSet.has(n.id)) {
        origMemberPos.set(n.id, { x: n.x, y: n.y });
      }
    });

    let deltaX = 0;
    let deltaY = 0;
    let latestW = origW;
    let latestH = origH;
    let hasMoved = false;

    const onMove = (moveEvt: MouseEvent) => {
      const rawDx = (moveEvt.clientX - startClientX) / zoomRef.current;
      const rawDy = (moveEvt.clientY - startClientY) / zoomRef.current;
      if (!hasMoved && Math.hypot(rawDx, rawDy) > 3) {
        hasMoved = true;
      }
      if (!hasMoved) return;

      if (mode === 'move') {
        const aligned = computeDeviceAlignment(
          origX + rawDx,
          origY + rawDy,
          origW,
          origH,
          stationaryNodes,
          {
            snapToGrid: snapToGridRef.current,
            enableGuides: guidesEnabledRef.current,
            bypassSnap: moveEvt.altKey
          }
        );
        deltaX = aligned.x - origX;
        deltaY = aligned.y - origY;
        setAlignmentGuides(aligned.guides);
      } else {
        latestW = Math.max(180, snapCoord(origW + rawDx));
        latestH = Math.max(140, snapCoord(origH + rawDy));
      }

      dispatchHistory({
        type: 'PREVIEW',
        updater: prev => ({
          ...prev,
          racks: (prev.racks || []).map(r =>
            r.id === rack.id
              ? {
                  ...r,
                  x: origX + deltaX,
                  y: origY + deltaY,
                  width: latestW,
                  height: latestH
                }
              : r
          ),
          nodes:
            mode === 'move'
              ? prev.nodes.map(n => {
                  const orig = origMemberPos.get(n.id);
                  if (!orig) return n;
                  return {
                    ...n,
                    x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, orig.x + deltaX)),
                    y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, orig.y + deltaY))
                  };
                })
              : prev.nodes
        })
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setAlignmentGuides([]);
      if (hasMoved) {
        const finalDoc: NetworkDiagramDocument = {
          ...preDragDoc,
          racks: (preDragDoc.racks || []).map(r =>
            r.id === rack.id
              ? {
                  ...r,
                  x: origX + deltaX,
                  y: origY + deltaY,
                  width: latestW,
                  height: latestH
                }
              : r
          ),
          nodes:
            mode === 'move'
              ? preDragDoc.nodes.map(n => {
                  const orig = origMemberPos.get(n.id);
                  if (!orig) return n;
                  return {
                    ...n,
                    x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, orig.x + deltaX)),
                    y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, orig.y + deltaY))
                  };
                })
              : preDragDoc.nodes
        };
        dispatchHistory({
          type: 'COMMIT_DRAG',
          preDragDoc,
          nextDoc: finalDoc
        });
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Canvas background click (marquee select / place zone / place label / pan)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('[data-node-id]') ||
      target?.closest('[data-cable-id]') ||
      target?.closest('[data-zone-id]') ||
      target?.closest('[data-rack-id]') ||
      target?.closest('[data-label-id]') ||
      target?.closest('button, input, select, textarea')
    ) {
      return;
    }

    focusCanvas();

    if (toolMode === 'zone' && e.button === 0) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      addZoneAt(pt.x - 160, pt.y - 100);
      return;
    }

    if (toolMode === 'label' && e.button === 0) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      addLabelAt(pt.x - 36, pt.y - 12);
      return;
    }

    const shouldPan =
      toolMode === 'pan' || e.button === 1 || spacePressedRef.current;

    if (!shouldPan && toolMode === 'select' && e.button === 0) {
      const startPt = clientToCanvas(e.clientX, e.clientY);
      const baseSelection = e.shiftKey ? [...selectedNodeIdsRef.current] : [];
      if (!e.shiftKey) {
        setSelectedNodeIds([]);
        setSelection(null);
      }
      setInspectorTarget(null);
      setConnectSourceId(null);

      let hasDraggedMarquee = false;

      const onMove = (moveEvt: MouseEvent) => {
        const curPt = clientToCanvas(moveEvt.clientX, moveEvt.clientY);
        if (
          !hasDraggedMarquee &&
          Math.hypot(curPt.x - startPt.x, curPt.y - startPt.y) > 6
        ) {
          hasDraggedMarquee = true;
        }
        if (!hasDraggedMarquee) return;

        setMarqueeRect({
          startX: startPt.x,
          startY: startPt.y,
          currentX: curPt.x,
          currentY: curPt.y
        });

        const minX = Math.min(startPt.x, curPt.x);
        const maxX = Math.max(startPt.x, curPt.x);
        const minY = Math.min(startPt.y, curPt.y);
        const maxY = Math.max(startPt.y, curPt.y);

        const hitIds = docRef.current.nodes
          .filter(
            n =>
              n.x + NODE_WIDTH >= minX &&
              n.x <= maxX &&
              n.y + NODE_HEIGHT >= minY &&
              n.y <= maxY
          )
          .map(n => n.id);

        const merged = Array.from(new Set([...baseSelection, ...hitIds]));
        setSelectedNodeIds(merged);
        setSelection(merged.length > 0 ? { kind: 'node', id: merged[0] } : null);
      };

      const onUp = () => {
        setMarqueeRect(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return;
    }

    setSelection(null);
    setSelectedNodeIds([]);
    setInspectorTarget(null);
    setConnectSourceId(null);

    const el = viewportRef.current;
    if (!el) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startScrollLeft = el.scrollLeft;
    const startScrollTop = el.scrollTop;
    let moved = false;

    const onMove = (moveEvt: MouseEvent) => {
      const dx = moveEvt.clientX - startX;
      const dy = moveEvt.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 4) {
        moved = true;
        setIsPanning(true);
      }
      if (moved) {
        el.scrollLeft = startScrollLeft - dx;
        el.scrollTop = startScrollTop - dy;
      }
    };

    const onUp = () => {
      setIsPanning(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setAlignmentGuides([]);
    const isLabelDrop = e.dataTransfer.getData('application/x-network-label');
    if (isLabelDrop) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      addLabelAt(pt.x - 36, pt.y - 12);
      return;
    }
    const deviceType = e.dataTransfer.getData('application/x-network-device') as NetworkDeviceType;
    if (!deviceType || !STENCIL_MAP[deviceType]) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    const aligned = computeDeviceAlignment(
      pt.x - NODE_WIDTH / 2,
      pt.y - NODE_HEIGHT / 2,
      NODE_WIDTH,
      NODE_HEIGHT,
      docRef.current.nodes,
      {
        snapToGrid: snapToGridRef.current,
        enableGuides: guidesEnabledRef.current,
        bypassSnap: e.altKey,
        maxX: DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20,
        maxY: DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20
      }
    );
    addDeviceAt(deviceType, Math.max(20, aligned.x), Math.max(20, aligned.y), true);
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = DIAGRAM_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    commitChange(() => cloneDiagramDocument(tpl.document));
    setSelection(null);
    setInspectorTarget(null);
    setConnectSourceId(null);
    showNotice(`Loaded template: ${tpl.label}`);
  };

  const handleExportPng = async () => {
    if (isExportingPng) return;
    setIsExportMenuOpen(false);
    setIsExportingPng(true);
    try {
      const isDark = document.documentElement.classList.contains('dark');
      await exportNetworkDiagramToPng(doc, isDark);
      setExportedImageFormat('png');
      showNotice('Exported topology diagram as PNG image.');
      window.setTimeout(() => {
        setExportedImageFormat(prev => (prev === 'png' ? null : prev));
      }, 2200);
    } catch {
      showNotice('Failed to export PNG image.');
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleExportSvg = () => {
    setIsExportMenuOpen(false);
    try {
      const isDark = document.documentElement.classList.contains('dark');
      exportNetworkDiagramToSvg(doc, isDark);
      setExportedImageFormat('svg');
      showNotice('Exported topology diagram as SVG vector.');
      window.setTimeout(() => {
        setExportedImageFormat(prev => (prev === 'svg' ? null : prev));
      }, 2200);
    } catch {
      showNotice('Failed to export SVG vector.');
    }
  };

  const handleExportJson = () => {
    const json = JSON.stringify(doc, null, 2);
    const slug = (doc.name || 'network-topology')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug || 'network-topology'}.netdiag.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotice('Exported topology JSON blueprint.');
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !Array.isArray(parsed.nodes) ||
          !Array.isArray(parsed.cables)
        ) {
          showNotice('Invalid topology JSON file.');
          return;
        }
        commitChange(() => ({
          name: typeof parsed.name === 'string' ? parsed.name : 'Imported Network Topology',
          nodes: parsed.nodes,
          cables: parsed.cables,
          zones: Array.isArray(parsed.zones) ? parsed.zones : [],
          labels: Array.isArray(parsed.labels) ? parsed.labels : [],
          racks: Array.isArray(parsed.racks) ? parsed.racks : []
        }));
        setSelection(null);
        setSelectedNodeIds([]);
        setInspectorTarget(null);
        showNotice(`Imported ${parsed.nodes.length} devices.`);
      } catch {
        showNotice('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const filteredStencils = useMemo(() => {
    const q = stencilQuery.trim().toLowerCase();
    return NETWORK_DEVICE_STENCILS.filter(item => {
      if (activeCategory !== 'All' && item.category !== activeCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.shortPrefix.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        Boolean(item.keywords && item.keywords.toLowerCase().includes(q))
      );
    });
  }, [stencilQuery, activeCategory]);

  const nodeMap = useMemo(() => new Map(doc.nodes.map(n => [n.id, n])), [doc.nodes]);

  const inspectedNode =
    inspectorTarget?.kind === 'node'
      ? doc.nodes.find(n => n.id === inspectorTarget.id) || null
      : null;
  const inspectedCable =
    inspectorTarget?.kind === 'cable'
      ? doc.cables.find(c => c.id === inspectorTarget.id) || null
      : null;
  const inspectedZone =
    inspectorTarget?.kind === 'zone'
      ? doc.zones.find(z => z.id === inspectorTarget.id) || null
      : null;
  const inspectedLabel =
    inspectorTarget?.kind === 'label'
      ? (doc.labels || []).find(l => l.id === inspectorTarget.id) || null
      : null;
  const inspectedRack =
    inspectorTarget?.kind === 'rack'
      ? (doc.racks || []).find(r => r.id === inspectorTarget.id) || null
      : null;

  const updateInspectedNode = (
    patch: Partial<NetworkDiagramNode>,
    editKey?: string
  ) => {
    if (!inspectedNode) return;
    const updater = (prev: NetworkDiagramDocument): NetworkDiagramDocument => ({
      ...prev,
      nodes: prev.nodes.map(n => (n.id === inspectedNode.id ? { ...n, ...patch } : n))
    });
    if (editKey) {
      commitCoalescedEdit(`node:${inspectedNode.id}:${editKey}`, updater);
    } else {
      commitChange(updater);
    }
  };

  const updateInspectedCable = (
    patch: Partial<NetworkDiagramCable>,
    editKey?: string
  ) => {
    if (!inspectedCable) return;
    const updater = (prev: NetworkDiagramDocument): NetworkDiagramDocument => ({
      ...prev,
      cables: prev.cables.map(c => (c.id === inspectedCable.id ? { ...c, ...patch } : c))
    });
    if (editKey) {
      commitCoalescedEdit(`cable:${inspectedCable.id}:${editKey}`, updater);
    } else {
      commitChange(updater);
    }
  };

  const updateInspectedZone = (
    patch: Partial<NetworkDiagramZone>,
    editKey?: string
  ) => {
    if (!inspectedZone) return;
    const updater = (prev: NetworkDiagramDocument): NetworkDiagramDocument => ({
      ...prev,
      zones: prev.zones.map(z => (z.id === inspectedZone.id ? { ...z, ...patch } : z))
    });
    if (editKey) {
      commitCoalescedEdit(`zone:${inspectedZone.id}:${editKey}`, updater);
    } else {
      commitChange(updater);
    }
  };

  const updateInspectedLabel = (
    patch: Partial<NetworkDiagramLabel>,
    editKey?: string
  ) => {
    if (!inspectedLabel) return;
    const updater = (prev: NetworkDiagramDocument): NetworkDiagramDocument => ({
      ...prev,
      labels: (prev.labels || []).map(l =>
        l.id === inspectedLabel.id ? { ...l, ...patch } : l
      )
    });
    if (editKey) {
      commitCoalescedEdit(`label:${inspectedLabel.id}:${editKey}`, updater);
    } else {
      commitChange(updater);
    }
  };

  const updateInspectedRack = (
    patch: Partial<NetworkDiagramRack>,
    editKey?: string
  ) => {
    if (!inspectedRack) return;
    const updater = (prev: NetworkDiagramDocument): NetworkDiagramDocument => ({
      ...prev,
      racks: (prev.racks || []).map(r =>
        r.id === inspectedRack.id ? { ...r, ...patch } : r
      )
    });
    if (editKey) {
      commitCoalescedEdit(`rack:${inspectedRack.id}:${editKey}`, updater);
    } else {
      commitChange(updater);
    }
  };

  const removeNodeFromRack = (rackId: string, nodeId: string) => {
    commitChange(prev => ({
      ...prev,
      racks: (prev.racks || [])
        .map(r =>
          r.id === rackId ? { ...r, nodeIds: r.nodeIds.filter(id => id !== nodeId) } : r
        )
        .filter(r => r.nodeIds.length > 0)
    }));
  };

  const addNodesToRack = (rackId: string, candidateIds: string[]) => {
    const validAdds = candidateIds.filter(id => docRef.current.nodes.some(n => n.id === id));
    if (validAdds.length === 0) return;
    const addSet = new Set(validAdds);
    commitChange(prev => {
      const nextRacks = (prev.racks || [])
        .map(r => {
          if (r.id === rackId) {
            const mergedIds = Array.from(new Set([...r.nodeIds, ...validAdds]));
            const members = prev.nodes.filter(n => mergedIds.includes(n.id));
            const bounds = computeRackBoundsForNodes(members, r.style);
            return {
              ...r,
              nodeIds: mergedIds,
              x: Math.min(r.x, snapCoord(bounds.x)),
              y: Math.min(r.y, snapCoord(bounds.y)),
              width: Math.max(r.width, snapCoord(bounds.x + bounds.width) - Math.min(r.x, snapCoord(bounds.x))),
              height: Math.max(r.height, snapCoord(bounds.y + bounds.height) - Math.min(r.y, snapCoord(bounds.y)))
            };
          }
          return {
            ...r,
            nodeIds: r.nodeIds.filter(id => !addSet.has(id))
          };
        })
        .filter(r => r.nodeIds.length > 0);
      return {
        ...prev,
        racks: nextRacks
      };
    });
  };

  return (
    <div
      data-disable-global-shortcuts="true"
      className="w-full min-w-0 space-y-4"
    >
      {/* Top Studio Header & Primary Controls */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
              <Network className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <input
                  type="text"
                  value={doc.name}
                  onChange={e =>
                    commitCoalescedEdit('doc:name', prev => ({
                      ...prev,
                      name: e.target.value
                    }))
                  }
                  onBlur={endEditSession}
                  aria-label="Topology diagram title"
                  className="text-base font-bold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 focus:outline-none min-w-[200px] max-w-md truncate"
                />
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {doc.nodes.length} devices · {doc.cables.length} cables · {(doc.racks || []).length} racks · {(doc.labels || []).length} labels · {doc.zones.length} zones
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Visio &amp; draw.io-style network diagramming studio — drag-select devices to group into racks, route cables, and export blueprints.
              </p>
            </div>
          </div>

          {/* Template & Import/Export Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Load starter topology template"
              value=""
              onChange={e => {
                if (e.target.value) handleApplyTemplate(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>
                Load Template...
              </option>
              {DIAGRAM_TEMPLATES.map(tpl => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportJson}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Import .netdiag.json topology"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import</span>
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Export topology as JSON"
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Save JSON</span>
            </button>

            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={isExportingPng}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                title="Export topology drawing as PNG image or SVG vector"
              >
                {isExportingPng ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : exportedImageFormat ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Exported {exportedImageFormat.toUpperCase()}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Export PNG / SVG</span>
                    <ChevronDown className="w-3.5 h-3.5 opacity-85" />
                  </>
                )}
              </button>

              {isExportMenuOpen && (
                <div
                  role="menu"
                  aria-label="Export diagram image formats"
                  className="absolute right-0 mt-1.5 w-52 rounded-xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-700 shadow-xl py-1.5 z-40"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportPng}
                    className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        Export PNG Image
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        High-DPI raster snapshot (.png)
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportSvg}
                    className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-start gap-2.5 transition-colors"
                  >
                    <FileCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        Export SVG Vector
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Crisp scalable vector (.svg)
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawing Toolbar (Tools, Cable Type, Routing, Undo/Redo, Grid, Zoom) */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary Tool Switch */}
            <div
              role="group"
              aria-label="Diagram tool mode"
              className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <button
                type="button"
                onClick={() => {
                  setToolMode('select');
                  setConnectSourceId(null);
                }}
                aria-pressed={toolMode === 'select'}
                title="Box-select or drag devices (Shift+Click for multi-select)"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  toolMode === 'select'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                <span>Select</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode('pan');
                  setConnectSourceId(null);
                }}
                aria-pressed={toolMode === 'pan'}
                title="Pan canvas (or hold Space + Drag)"
                className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  toolMode === 'pan'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>Pan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode('connect');
                  setConnectSourceId(null);
                }}
                aria-pressed={toolMode === 'connect'}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  toolMode === 'connect'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Cable className="w-3.5 h-3.5" />
                <span>Connect Cable</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode('label');
                  setConnectSourceId(null);
                }}
                aria-pressed={toolMode === 'label'}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  toolMode === 'label'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Label</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setToolMode('zone');
                  setConnectSourceId(null);
                }}
                aria-pressed={toolMode === 'zone'}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  toolMode === 'zone'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <SquareDashed className="w-3.5 h-3.5" />
                <span>Draw Zone</span>
              </button>
            </div>

            {selectedNodeIds.length >= 2 && (
              <button
                type="button"
                onClick={() => groupNodesIntoRack(selectedNodeIds, 'rack')}
                title="Group selected devices into a movable Rack container (Ctrl+G)"
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs transition-colors"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Group into Rack ({selectedNodeIds.length})</span>
              </button>
            )}

            {selection?.kind === 'rack' && (
              <button
                type="button"
                onClick={() => ungroupRack(selection.id)}
                title="Ungroup Rack container and keep devices (Ctrl+Shift+G)"
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:border-blue-500 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Ungroup className="w-3.5 h-3.5" />
                <span>Ungroup Rack</span>
              </button>
            )}

            {/* Active Cable Medium & Routing Style */}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                aria-label="Active cable type"
                value={activeCableType}
                onChange={e => setActiveCableType(e.target.value as CableType)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.values(CABLE_SPECS).map(spec => (
                  <option key={spec.type} value={spec.type}>
                    Cable: {spec.shortLabel}
                  </option>
                ))}
              </select>

              <select
                aria-label="Cable routing style"
                value={activeRoutingStyle}
                onChange={e => setActiveRoutingStyle(e.target.value as CableRoutingStyle)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="orthogonal">Route: Orthogonal (Visio)</option>
                <option value="curved">Route: Curved (draw.io)</option>
                <option value="straight">Route: Straight</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Undo / Redo */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <button
                type="button"
                disabled={!canUndo}
                onClick={handleUndo}
                title={`Undo (${history.past.length}) · Ctrl+Z`}
                aria-label={`Undo (${history.past.length} steps available)`}
                className="px-2 py-1.5 inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                {history.past.length > 0 && (
                  <span className="text-[10px] font-mono tabular-nums font-semibold">
                    {history.past.length}
                  </span>
                )}
              </button>
              <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              <button
                type="button"
                disabled={!canRedo}
                onClick={handleRedo}
                title={`Redo (${history.future.length}) · Ctrl+Shift+Z`}
                aria-label={`Redo (${history.future.length} steps available)`}
                className="px-2 py-1.5 inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" />
                {history.future.length > 0 && (
                  <span className="text-[10px] font-mono tabular-nums font-semibold">
                    {history.future.length}
                  </span>
                )}
              </button>
            </div>

            {/* Grid, Snap & Smart Alignment Guides Controls */}
            <button
              type="button"
              onClick={() => setSnapToGrid(s => !s)}
              aria-pressed={snapToGrid}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                snapToGrid
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-cyan-700 text-blue-700 dark:text-cyan-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title={`Toggle ${GRID_SNAP_SIZE}px grid snapping (hold Alt while dragging to bypass)`}
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              <span>Snap {GRID_SNAP_SIZE}px</span>
            </button>

            <button
              type="button"
              onClick={() => setGuidesEnabled(g => !g)}
              aria-pressed={guidesEnabled}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                guidesEnabled
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-cyan-700 text-blue-700 dark:text-cyan-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="Toggle automatic alignment guidelines when dragging devices"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Guides</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGrid(g => !g)}
              aria-pressed={showGrid}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                showGrid
                  ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>

            {/* Zoom Controls */}
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono tabular-nums">
              <button
                type="button"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => applyZoom(zoom - ZOOM_STEP)}
                aria-label="Zoom out diagram"
                className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-35"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyZoom(1)}
                title="Reset zoom to 100%"
                className="px-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => applyZoom(zoom + ZOOM_STEP)}
                aria-label="Zoom in diagram"
                className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-35"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />
              <button
                type="button"
                onClick={handleFitDiagram}
                className="px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 font-sans font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Fit</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Pane Visio Workspace: Stencils (Left) + Expanded Canvas with Double-Click Properties Box */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start min-w-0">
        {/* Left Stencil Palette: Network Devices Only */}
        <aside
          aria-label="Network Device Stencils"
          className="lg:col-span-3 xl:col-span-2 min-w-0 p-3.5 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-slate-900 dark:text-white">
              Network Stencils
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredStencils.length}
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={stencilQuery}
              onChange={e => setStencilQuery(e.target.value)}
              placeholder="Filter devices..."
              aria-label="Filter network device stencils"
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {(
              [
                'All',
                'Routing & Switching',
                'Security & WAN',
                'Wireless & Endpoints',
                'CCTV & Surveillance'
              ] as const
            ).map(
              cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors whitespace-nowrap ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat === 'All'
                    ? 'All'
                    : cat === 'Routing & Switching'
                    ? 'Routing/SW'
                    : cat === 'Security & WAN'
                    ? 'Security/WAN'
                    : cat === 'Wireless & Endpoints'
                    ? 'Wireless/Host'
                    : 'CCTV / NVR'}
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-[450px] overflow-y-auto pr-0.5">
            {filteredStencils.map(stencil => (
              <button
                key={stencil.type}
                type="button"
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/x-network-device', stencil.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addDeviceAt(stencil.type)}
                title={`Drag onto canvas or click to add ${stencil.name}`}
                className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 border border-slate-200/80 dark:border-slate-800 hover:border-blue-400 dark:hover:border-cyan-500/60 transition-all flex flex-col items-center justify-center gap-1.5 group cursor-grab active:cursor-grabbing"
              >
                <div className="w-14 h-12 flex items-center justify-center transition-transform duration-150 group-hover:scale-110">
                  <NetworkDeviceGlyph type={stencil.type} className="w-12 h-11 drop-shadow-xs" />
                </div>
                <span className="text-[10.5px] font-semibold text-slate-700 dark:text-slate-200 text-center leading-tight line-clamp-2">
                  {stencil.name}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              draggable
              onDragStart={e => {
                e.dataTransfer.setData('application/x-network-label', '1');
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => addLabelAt()}
              title="Drag onto canvas or click to place a text label mark"
              className="w-full px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400 inline-flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Add Label</span>
            </button>

            <button
              type="button"
              onClick={() => addZoneAt()}
              className="w-full px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 inline-flex items-center justify-center gap-1.5"
            >
              <SquareDashed className="w-3.5 h-3.5" />
              <span>Add Subnet Zone Frame</span>
            </button>
          </div>
        </aside>

        {/* Interactive Drawing Canvas (Full Remaining Width) */}
        <div className="lg:col-span-9 xl:col-span-10 min-w-0 relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#070b14] shadow-sm overflow-hidden">
          {/* Active Mode Contextual Hint Banner */}
          {(toolMode !== 'select' || connectSourceId || statusNotice) && (
            <div className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex justify-center">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-medium shadow-md border border-slate-700 pointer-events-auto">
                {statusNotice
                  ? statusNotice
                  : toolMode === 'connect'
                  ? connectSourceId
                    ? `Select destination device to finish ${CABLE_SPECS[activeCableType].shortLabel} cable (Esc to cancel)`
                    : `Click source device, then target device to connect a ${CABLE_SPECS[activeCableType].shortLabel} cable`
                  : toolMode === 'pan'
                  ? 'Drag anywhere on the canvas to pan viewport'
                  : toolMode === 'label'
                  ? 'Click anywhere on the canvas to place a text label mark (Esc to cancel)'
                  : 'Click anywhere on the canvas to place a new Subnet / Security Zone frame'}
              </div>
            </div>
          )}

          {/* Multi-Selection Contextual Action Bar (appears when 2+ devices are selected) */}
          {selectedNodeIds.length >= 2 && (
            <div
              onMouseDown={e => e.stopPropagation()}
              className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex justify-center"
            >
              <div className="pointer-events-auto inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-blue-300 dark:border-cyan-500/60 shadow-lg text-xs">
                <span className="px-1.5 font-mono font-bold text-blue-600 dark:text-cyan-400">
                  {selectedNodeIds.length} selected
                </span>
                <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => groupNodesIntoRack(selectedNodeIds, 'rack')}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>Group into Rack</span>
                </button>
                <button
                  type="button"
                  onClick={() => groupNodesIntoRack(selectedNodeIds, 'group')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Group className="w-3.5 h-3.5" />
                  <span>Container Group</span>
                </button>
                <button
                  type="button"
                  onClick={handleDuplicateSelectedNode}
                  title="Duplicate selected devices (Ctrl+D)"
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelection}
                  title="Delete selected devices (Del)"
                  className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNodeIds([]);
                    setSelection(null);
                  }}
                  title="Clear selection (Esc)"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div
            ref={viewportRef}
            tabIndex={0}
            aria-label="Interactive network topology canvas"
            onMouseDown={handleCanvasMouseDown}
            onDragOver={e => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
              if (
                guidesEnabledRef.current &&
                e.dataTransfer.types.includes('application/x-network-device')
              ) {
                const pt = clientToCanvas(e.clientX, e.clientY);
                const aligned = computeDeviceAlignment(
                  pt.x - NODE_WIDTH / 2,
                  pt.y - NODE_HEIGHT / 2,
                  NODE_WIDTH,
                  NODE_HEIGHT,
                  docRef.current.nodes,
                  {
                    snapToGrid: snapToGridRef.current,
                    enableGuides: true,
                    bypassSnap: e.altKey,
                    maxX: DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20,
                    maxY: DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20
                  }
                );
                setAlignmentGuides(aligned.guides);
              }
            }}
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setAlignmentGuides([]);
              }
            }}
            onDrop={handleCanvasDrop}
            className={`w-full h-[640px] overflow-auto relative select-none focus:outline-none ${
              isPanning
                ? 'cursor-grabbing'
                : toolMode === 'pan'
                ? 'cursor-grab'
                : toolMode === 'zone'
                ? 'cursor-crosshair'
                : toolMode === 'label'
                ? 'cursor-text'
                : toolMode === 'connect'
                ? 'cursor-cell'
                : 'cursor-default'
            }`}
          >
            <div
              style={{
                width: Math.ceil(DIAGRAM_CANVAS_WIDTH * zoom),
                height: Math.ceil(DIAGRAM_CANVAS_HEIGHT * zoom),
                position: 'relative'
              }}
            >
              <div
                style={{
                  width: DIAGRAM_CANVAS_WIDTH,
                  height: DIAGRAM_CANVAS_HEIGHT,
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  position: 'relative',
                  backgroundImage: showGrid
                    ? 'radial-gradient(circle, rgba(148, 163, 184, 0.35) 1px, transparent 1px)'
                    : undefined,
                  backgroundSize: showGrid ? `${GRID_SNAP_SIZE}px ${GRID_SNAP_SIZE}px` : undefined
                }}
              >
                {/* Layer 1: Zone Frames */}
                {doc.zones.map(zone => {
                  const zStyle = ZONE_STYLE_MAP[zone.color] || ZONE_STYLE_MAP.blue;
                  const isZoneSelected =
                    selection?.kind === 'zone' && selection.id === zone.id;
                  return (
                    <div
                      key={zone.id}
                      data-zone-id={zone.id}
                      onMouseDown={e => startZoneDrag(e, zone, 'move')}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        focusCanvas();
                        setSelectedNodeIds([]);
                        setSelection({ kind: 'zone', id: zone.id });
                        setInspectorTarget({ kind: 'zone', id: zone.id });
                      }}
                      style={{
                        position: 'absolute',
                        left: zone.x,
                        top: zone.y,
                        width: zone.width,
                        height: zone.height
                      }}
                      className={`rounded-2xl border-2 border-dashed p-3 transition-shadow cursor-move ${zStyle.container} ${
                        isZoneSelected ? 'ring-2 ring-blue-500 dark:ring-cyan-400' : ''
                      }`}
                    >
                      <div className="pointer-events-none">
                        <p className={`text-xs font-bold ${zStyle.title}`}>{zone.title}</p>
                        {zone.subtitle && (
                          <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            {zone.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Bottom-Right Resize Handle */}
                      <div
                        onMouseDown={e => startZoneDrag(e, zone, 'resize')}
                        title="Drag to resize zone"
                        className="absolute right-1.5 bottom-1.5 w-3.5 h-3.5 rounded-sm border-r-2 border-b-2 border-slate-400 dark:border-slate-500 cursor-nwse-resize"
                      />
                    </div>
                  );
                })}

                {/* Layer 1.5: Racks & Device Group Containers */}
                {(doc.racks || []).map(rack => {
                  const rStyle = RACK_STYLE_MAP[rack.color] || RACK_STYLE_MAP.slate;
                  const isRackSelected =
                    selection?.kind === 'rack' && selection.id === rack.id;
                  const isRackVisual = rack.style !== 'group';

                  return (
                    <div
                      key={rack.id}
                      data-rack-id={rack.id}
                      onMouseDown={e => startRackDrag(e, rack, 'move')}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        focusCanvas();
                        setSelectedNodeIds([]);
                        setSelection({ kind: 'rack', id: rack.id });
                        setInspectorTarget({ kind: 'rack', id: rack.id });
                      }}
                      style={{
                        position: 'absolute',
                        left: rack.x,
                        top: rack.y,
                        width: rack.width,
                        height: rack.height
                      }}
                      className={`group rounded-xl border-2 ${
                        isRackVisual ? 'border-solid' : 'border-dashed'
                      } overflow-hidden shadow-sm transition-shadow cursor-move ${rStyle.container} ${
                        isRackSelected ? 'ring-2 ring-blue-500 dark:ring-cyan-400 shadow-md' : ''
                      }`}
                    >
                      {/* Rack / Group Header Bar */}
                      <div
                        className={`h-8 px-2.5 flex items-center justify-between gap-2 ${rStyle.header}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isRackVisual ? (
                            <Server className="w-3.5 h-3.5 shrink-0 opacity-90" />
                          ) : (
                            <BoxSelect className="w-3.5 h-3.5 shrink-0 opacity-90" />
                          )}
                          <span className="text-[11px] font-bold truncate">
                            {rack.title}
                          </span>
                          {rack.subtitle && (
                            <span className="text-[10px] font-mono opacity-75 truncate hidden sm:inline">
                              · {rack.subtitle}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${rStyle.badge}`}
                          >
                            {rack.nodeIds.length}
                          </span>
                          <button
                            type="button"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => {
                              e.stopPropagation();
                              ungroupRack(rack.id);
                            }}
                            title="Ungroup (keep devices)"
                            aria-label={`Ungroup ${rack.title}`}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/20 transition-opacity"
                          >
                            <Ungroup className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 19" Rack Mounting Rails */}
                      {isRackVisual && (
                        <>
                          <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute top-8 bottom-0 left-0 w-3.5 border-r border-dashed flex flex-col items-center justify-evenly py-2 ${rStyle.rail}`}
                          >
                            {Array.from({ length: Math.max(4, Math.floor((rack.height - 40) / 28)) }).map((_, idx) => (
                              <span
                                key={idx}
                                className="w-1.5 h-1.5 rounded-full bg-slate-500/45 dark:bg-slate-300/35"
                              />
                            ))}
                          </div>
                          <div
                            aria-hidden="true"
                            className={`pointer-events-none absolute top-8 bottom-0 right-0 w-3.5 border-l border-dashed flex flex-col items-center justify-evenly py-2 ${rStyle.rail}`}
                          >
                            {Array.from({ length: Math.max(4, Math.floor((rack.height - 40) / 28)) }).map((_, idx) => (
                              <span
                                key={idx}
                                className="w-1.5 h-1.5 rounded-full bg-slate-500/45 dark:bg-slate-300/35"
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Bottom-Right Resize Handle */}
                      <div
                        onMouseDown={e => startRackDrag(e, rack, 'resize')}
                        title="Drag to resize rack/container"
                        className="absolute right-1.5 bottom-1.5 w-3.5 h-3.5 rounded-sm border-r-2 border-b-2 border-slate-500/70 dark:border-slate-300/70 cursor-nwse-resize z-10"
                      />
                    </div>
                  );
                })}

                {/* Layer 2: SVG Cables & Labels */}
                <svg
                  width={DIAGRAM_CANVAS_WIDTH}
                  height={DIAGRAM_CANVAS_HEIGHT}
                  className="absolute inset-0 pointer-events-none"
                >
                  {doc.cables.map(cable => {
                    const src = nodeMap.get(cable.sourceId);
                    const dst = nodeMap.get(cable.targetId);
                    if (!src || !dst) return null;
                    const geom = computeCableGeometry(src, dst, cable);
                    const spec = CABLE_SPECS[cable.cableType];
                    const isSelected =
                      selection?.kind === 'cable' && selection.id === cable.id;
                    const badgeLabel = cable.label;

                    return (
                      <g
                        key={cable.id}
                        data-cable-id={cable.id}
                        className="pointer-events-auto cursor-pointer"
                        onClick={e => {
                          e.stopPropagation();
                          focusCanvas();
                          setSelection({ kind: 'cable', id: cable.id });
                          setInspectorTarget(prev =>
                            prev && prev.kind === 'cable' && prev.id === cable.id ? prev : null
                          );
                        }}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          focusCanvas();
                          setSelection({ kind: 'cable', id: cable.id });
                          setInspectorTarget({ kind: 'cable', id: cable.id });
                        }}
                      >
                        {/* Wide invisible hit target for easy cable clicking */}
                        <path
                          d={geom.pathD}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={14}
                        />
                        {isSelected && (
                          <path
                            d={geom.pathD}
                            fill="none"
                            strokeWidth={spec.strokeWidth + 5}
                            className="stroke-blue-500/25 dark:stroke-cyan-400/25"
                          />
                        )}
                        <path
                          d={geom.pathD}
                          fill="none"
                          stroke={spec.lightStroke}
                          strokeWidth={isSelected ? spec.strokeWidth + 1 : spec.strokeWidth}
                          strokeDasharray={spec.dashArray}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx={geom.startX} cy={geom.startY} r={3.5} fill={spec.lightStroke} />
                        <circle cx={geom.endX} cy={geom.endY} r={3.5} fill={spec.lightStroke} />

                        {badgeLabel && (
                          <g transform={`translate(${geom.midX}, ${geom.midY})`}>
                            <rect
                              x={-(badgeLabel.length * 3.4 + 8)}
                              y={-9}
                              width={badgeLabel.length * 6.8 + 16}
                              height={18}
                              rx={5}
                              className={`fill-white dark:fill-slate-900 ${
                                isSelected
                                  ? 'stroke-blue-500 dark:stroke-cyan-400'
                                  : 'stroke-slate-200 dark:stroke-slate-700'
                              }`}
                              strokeWidth={1}
                            />
                            <text
                              textAnchor="middle"
                              dominantBaseline="central"
                              className="fill-slate-700 dark:fill-slate-200 font-mono text-[9.5px] font-semibold select-none"
                            >
                              {badgeLabel}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Live Rubber-Band Wire Preview when dragging from a device port */}
                  {wirePreview && (
                    <path
                      d={`M ${wirePreview.startX} ${wirePreview.startY} L ${wirePreview.endX} ${wirePreview.endY}`}
                      fill="none"
                      stroke={CABLE_SPECS[activeCableType].lightStroke}
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                    />
                  )}
                </svg>

                {/* Layer 3: Enlarged Network Device Symbols (No Card Box, Label, or Role Clutter) */}
                {doc.nodes.map(node => {
                  const isSelected =
                    selectedNodeIds.includes(node.id) ||
                    (selection?.kind === 'node' && selection.id === node.id);
                  const isConnectSource = connectSourceId === node.id;
                  const showPorts =
                    hoveredNodeId === node.id ||
                    isSelected ||
                    isConnectSource ||
                    Boolean(wirePreview);

                  return (
                    <div
                      key={node.id}
                      data-node-id={node.id}
                      title={node.label}
                      onMouseDown={e => startNodeDrag(e, node)}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        if (toolMode === 'connect') return;
                        focusCanvas();
                        setSelectedNodeIds([node.id]);
                        setSelection({ kind: 'node', id: node.id });
                        setInspectorTarget({ kind: 'node', id: node.id });
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() =>
                        setHoveredNodeId(prev => (prev === node.id ? null : prev))
                      }
                      style={{
                        position: 'absolute',
                        left: node.x,
                        top: node.y,
                        width: NODE_WIDTH,
                        height: NODE_HEIGHT
                      }}
                      className={`group rounded-2xl flex items-center justify-center transition-all ${
                        toolMode === 'connect' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
                      } ${
                        isConnectSource
                          ? 'ring-2 ring-emerald-500 bg-emerald-500/10'
                          : isSelected
                          ? 'ring-2 ring-blue-500 dark:ring-cyan-400 bg-blue-500/10'
                          : 'hover:bg-blue-500/5 hover:ring-1 hover:ring-blue-400/50 dark:hover:ring-cyan-400/40'
                      }`}
                    >
                      <NetworkDeviceGlyph
                        type={node.type}
                        className="w-[84px] h-[72px] drop-shadow-sm transition-transform duration-150 group-hover:scale-105 pointer-events-none"
                      />

                      {/* 4 Drag-to-Connect Port Handles */}
                      {showPorts &&
                        (['top', 'right', 'bottom', 'left'] as ConcretePortSide[]).map(side => {
                          const posClass =
                            side === 'top'
                              ? 'left-1/2 -top-1.5 -translate-x-1/2'
                              : side === 'right'
                              ? '-right-1.5 top-1/2 -translate-y-1/2'
                              : side === 'bottom'
                              ? 'left-1/2 -bottom-1.5 -translate-x-1/2'
                              : '-left-1.5 top-1/2 -translate-y-1/2';

                          return (
                            <button
                              key={side}
                              type="button"
                              data-port-side={side}
                              onMouseDown={e => startPortCableDrag(e, node, side)}
                              title={`Drag from ${side} port to connect cable`}
                              aria-label={`Connect cable from ${node.label} ${side} port`}
                              className={`absolute ${posClass} w-3 h-3 rounded-full bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-cyan-400 hover:scale-125 transition-transform cursor-crosshair z-10`}
                            />
                          );
                        })}
                    </div>
                  );
                })}

                {/* Layer 4: Standalone Workspace Text Labels */}
                {(doc.labels || []).map(lbl => {
                  const isSelected =
                    selection?.kind === 'label' && selection.id === lbl.id;
                  const sizeCfg = LABEL_SIZE_CONFIG[lbl.fontSize] || LABEL_SIZE_CONFIG.sm;
                  const colorCfg = LABEL_COLOR_STYLES[lbl.color] || LABEL_COLOR_STYLES.slate;

                  return (
                    <div
                      key={lbl.id}
                      data-label-id={lbl.id}
                      onMouseDown={e => startLabelDrag(e, lbl)}
                      onDoubleClick={e => {
                        e.stopPropagation();
                        focusCanvas();
                        setSelectedNodeIds([]);
                        setSelection({ kind: 'label', id: lbl.id });
                        setInspectorTarget({ kind: 'label', id: lbl.id });
                        window.requestAnimationFrame(() => {
                          labelInputRef.current?.focus();
                          labelInputRef.current?.select();
                        });
                      }}
                      style={{
                        position: 'absolute',
                        left: lbl.x,
                        top: lbl.y
                      }}
                      title="Drag to move · Double-click to edit label"
                      className={`px-1.5 py-0.5 rounded-md whitespace-pre-wrap select-none cursor-move transition-all ${sizeCfg.className} ${colorCfg.className} ${
                        lbl.bold ? 'font-bold' : 'font-medium'
                      } ${
                        isSelected
                          ? 'ring-1 ring-blue-500 dark:ring-cyan-400 bg-blue-500/10'
                          : 'hover:bg-slate-900/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {lbl.text || 'Label'}
                    </div>
                  );
                })}

                {/* Layer 5: Automatic Smart Alignment Guidelines */}
                {alignmentGuides.length > 0 && (
                  <svg
                    width={DIAGRAM_CANVAS_WIDTH}
                    height={DIAGRAM_CANVAS_HEIGHT}
                    aria-hidden="true"
                    className="absolute inset-0 pointer-events-none z-20"
                  >
                    {alignmentGuides.map((guide, idx) => (
                      <g key={`${guide.orientation}-${guide.kind}-${idx}`}>
                        {guide.orientation === 'vertical' ? (
                          <line
                            x1={guide.pos}
                            y1={guide.start}
                            x2={guide.pos}
                            y2={guide.end}
                            strokeWidth={1.25}
                            strokeDasharray={guide.kind === 'center' ? '4 4' : '3 4'}
                            className={
                              guide.kind === 'center'
                                ? 'stroke-blue-500/75 dark:stroke-cyan-400/80'
                                : 'stroke-blue-400/55 dark:stroke-cyan-400/55'
                            }
                          />
                        ) : (
                          <line
                            x1={guide.start}
                            y1={guide.pos}
                            x2={guide.end}
                            y2={guide.pos}
                            strokeWidth={1.25}
                            strokeDasharray={guide.kind === 'center' ? '4 4' : '3 4'}
                            className={
                              guide.kind === 'center'
                                ? 'stroke-blue-500/75 dark:stroke-cyan-400/80'
                                : 'stroke-blue-400/55 dark:stroke-cyan-400/55'
                            }
                          />
                        )}
                        {guide.anchors.map((pt, aIdx) => (
                          <circle
                            key={aIdx}
                            cx={pt.x}
                            cy={pt.y}
                            r={2.5}
                            className="fill-blue-500/80 dark:fill-cyan-400/85"
                          />
                        ))}
                      </g>
                    ))}
                  </svg>
                )}

                {/* Marquee Box-Select Rectangle */}
                {marqueeRect && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: Math.min(marqueeRect.startX, marqueeRect.currentX),
                      top: Math.min(marqueeRect.startY, marqueeRect.currentY),
                      width: Math.abs(marqueeRect.currentX - marqueeRect.startX),
                      height: Math.abs(marqueeRect.currentY - marqueeRect.startY)
                    }}
                    className="pointer-events-none border-2 border-blue-500 dark:border-cyan-400 bg-blue-500/10 dark:bg-cyan-400/10 rounded-md z-20"
                  />
                )}

                {/* Empty Canvas Callout */}
                {doc.nodes.length === 0 && doc.zones.length === 0 && (doc.racks || []).length === 0 && (doc.labels || []).length === 0 && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center space-y-2 pointer-events-none max-w-xs">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Blank Network Topology Canvas
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Drag any device symbol or Label from the left stencil palette onto this grid, or load a starter template above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom-left Quick Hint */}
          <div className="pointer-events-none absolute left-3 bottom-3 hidden sm:flex items-center px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400 shadow-xs">
            Drag empty canvas or Shift+Click to multi-select · Hold Alt while dragging to bypass snap · Double-click to edit
          </div>

          {/* Floating Properties Box — appears ONLY when double-clicking or adding a label */}
          {(inspectedNode || inspectedCable || inspectedZone || inspectedLabel || inspectedRack) && (
            <aside
              role="dialog"
              aria-label="Diagram Element Properties"
              onMouseDown={e => e.stopPropagation()}
              className="absolute top-3 right-3 z-30 w-[calc(100%-1.5rem)] sm:w-[340px] max-h-[calc(100%-1.5rem)] overflow-y-auto p-4 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
            >
              {inspectedNode ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          STENCIL_MAP[inspectedNode.type].badgeBgClass
                        } ${STENCIL_MAP[inspectedNode.type].badgeTextClass}`}
                      >
                        <NetworkDeviceGlyph type={inspectedNode.type} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-slate-400 block">
                          Device Properties
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {inspectedNode.label}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleDuplicateSelectedNode}
                        title="Duplicate device (Ctrl+D)"
                        aria-label="Duplicate device"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelection}
                        title="Delete device (Del)"
                        aria-label="Delete device"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTarget(null)}
                        title="Close properties (Esc)"
                        aria-label="Close device properties"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Hostname / Label
                      </label>
                      <input
                        type="text"
                        value={inspectedNode.label}
                        onChange={e => updateInspectedNode({ label: e.target.value }, 'label')}
                        onBlur={endEditSession}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Device Role / Stencil
                      </label>
                      <select
                        value={inspectedNode.type}
                        onChange={e =>
                          updateInspectedNode({ type: e.target.value as NetworkDeviceType })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {NETWORK_DEVICE_STENCILS.map(s => (
                          <option key={s.type} value={s.type}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          IP Address
                        </label>
                        <input
                          type="text"
                          value={inspectedNode.ipAddress}
                          onChange={e =>
                            updateInspectedNode({ ipAddress: e.target.value }, 'ipAddress')
                          }
                          onBlur={endEditSession}
                          className="w-full px-2.5 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          CIDR
                        </label>
                        <input
                          type="text"
                          value={inspectedNode.subnetMask}
                          onChange={e =>
                            updateInspectedNode({ subnetMask: e.target.value }, 'subnetMask')
                          }
                          onBlur={endEditSession}
                          className="w-full px-2.5 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        VLAN / ASN / Role Tag
                      </label>
                      <input
                        type="text"
                        value={inspectedNode.vlanOrAsn}
                        onChange={e =>
                          updateInspectedNode({ vlanOrAsn: e.target.value }, 'vlanOrAsn')
                        }
                        onBlur={endEditSession}
                        className="w-full px-2.5 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Architecture Notes
                      </label>
                      <textarea
                        rows={2}
                        value={inspectedNode.notes}
                        onChange={e => updateInspectedNode({ notes: e.target.value }, 'notes')}
                        onBlur={endEditSession}
                        placeholder="Redundancy, routing protocol, PoE budget..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setToolMode('connect');
                        setConnectSourceId(inspectedNode.id);
                        setInspectorTarget(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <Cable className="w-3.5 h-3.5" />
                      <span>Connect Cable from {inspectedNode.label}</span>
                    </button>
                  </div>
                </div>
              ) : inspectedCable ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 block">
                        Cable Connector
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {nodeMap.get(inspectedCable.sourceId)?.label || 'Source'} ↔{' '}
                        {nodeMap.get(inspectedCable.targetId)?.label || 'Target'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleDeleteSelection}
                        title="Delete cable (Del)"
                        aria-label="Delete cable"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTarget(null)}
                        title="Close properties (Esc)"
                        aria-label="Close cable properties"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Cable Medium
                      </label>
                      <select
                        value={inspectedCable.cableType}
                        onChange={e =>
                          updateInspectedCable({ cableType: e.target.value as CableType })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        {Object.values(CABLE_SPECS).map(spec => (
                          <option key={spec.type} value={spec.type}>
                            {spec.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Connector Routing
                      </label>
                      <select
                        value={inspectedCable.routingStyle}
                        onChange={e =>
                          updateInspectedCable({
                            routingStyle: e.target.value as CableRoutingStyle
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="orthogonal">Orthogonal (Visio Elbow)</option>
                        <option value="curved">Curved (Bezier)</option>
                        <option value="straight">Straight Line</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Cable Badge Label
                      </label>
                      <input
                        type="text"
                        value={inspectedCable.label}
                        onChange={e => updateInspectedCable({ label: e.target.value }, 'label')}
                        onBlur={endEditSession}
                        placeholder="e.g. LACP Trunk, eBGP, 10G"
                        className="w-full px-2.5 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Source Port
                        </label>
                        <input
                          type="text"
                          value={inspectedCable.sourceInterface}
                          onChange={e =>
                            updateInspectedCable(
                              { sourceInterface: e.target.value },
                              'sourceInterface'
                            )
                          }
                          onBlur={endEditSession}
                          className="w-full px-2 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Target Port
                        </label>
                        <input
                          type="text"
                          value={inspectedCable.targetInterface}
                          onChange={e =>
                            updateInspectedCable(
                              { targetInterface: e.target.value },
                              'targetInterface'
                            )
                          }
                          onBlur={endEditSession}
                          className="w-full px-2 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Source Anchor
                        </label>
                        <select
                          value={inspectedCable.sourcePort}
                          onChange={e =>
                            updateInspectedCable({ sourcePort: e.target.value as PortSide })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="auto">Auto</option>
                          <option value="top">Top</option>
                          <option value="right">Right</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Target Anchor
                        </label>
                        <select
                          value={inspectedCable.targetPort}
                          onChange={e =>
                            updateInspectedCable({ targetPort: e.target.value as PortSide })
                          }
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="auto">Auto</option>
                          <option value="top">Top</option>
                          <option value="right">Right</option>
                          <option value="bottom">Bottom</option>
                          <option value="left">Left</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : inspectedZone ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="min-w-0">
                      <span className="text-[10px] font-mono text-slate-400 block">
                        Network Zone Frame
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {inspectedZone.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleDeleteSelection}
                        title="Delete zone (Del)"
                        aria-label="Delete zone"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTarget(null)}
                        title="Close properties (Esc)"
                        aria-label="Close zone properties"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Zone Name
                      </label>
                      <input
                        type="text"
                        value={inspectedZone.title}
                        onChange={e => updateInspectedZone({ title: e.target.value }, 'title')}
                        onBlur={endEditSession}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Subnet / VLAN Subtitle
                      </label>
                      <input
                        type="text"
                        value={inspectedZone.subtitle}
                        onChange={e => updateInspectedZone({ subtitle: e.target.value }, 'subtitle')}
                        onBlur={endEditSession}
                        className="w-full px-2.5 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Zone Color
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(Object.keys(ZONE_STYLE_MAP) as ZoneColorTheme[]).map(col => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => updateInspectedZone({ color: col })}
                            className={`py-1.5 rounded-lg border text-[10px] font-semibold ${
                              inspectedZone.color === col
                                ? 'border-blue-600 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {ZONE_STYLE_MAP[col].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : inspectedLabel ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                        <Type className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-slate-400 block">
                          Workspace Text Label
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {inspectedLabel.text || 'Label'}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleDuplicateSelectedNode}
                        title="Duplicate label (Ctrl+D)"
                        aria-label="Duplicate label"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelection}
                        title="Delete label (Del)"
                        aria-label="Delete label"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTarget(null)}
                        title="Close properties (Esc)"
                        aria-label="Close label properties"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Label Text
                      </label>
                      <textarea
                        ref={labelInputRef}
                        rows={3}
                        value={inspectedLabel.text}
                        onChange={e => updateInspectedLabel({ text: e.target.value }, 'text')}
                        onBlur={endEditSession}
                        placeholder="e.g. Cisco 3620, Layer 3 switch, PSTN..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Text Size
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                          {(Object.keys(LABEL_SIZE_CONFIG) as LabelSizePreset[]).map(sz => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => updateInspectedLabel({ fontSize: sz })}
                              className={`py-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                                inspectedLabel.fontSize === sz
                                  ? 'border-blue-600 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {LABEL_SIZE_CONFIG[sz].label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Weight
                        </label>
                        <button
                          type="button"
                          onClick={() => updateInspectedLabel({ bold: !inspectedLabel.bold })}
                          aria-pressed={inspectedLabel.bold}
                          title="Toggle bold text"
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-semibold inline-flex items-center gap-1 transition-colors ${
                            inspectedLabel.bold
                              ? 'border-blue-600 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Bold className="w-3 h-3" />
                          <span>Bold</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Text Color
                      </label>
                      <div className="grid grid-cols-7 gap-1.5">
                        {(Object.keys(LABEL_COLOR_STYLES) as LabelColorTheme[]).map(col => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => updateInspectedLabel({ color: col })}
                            title={LABEL_COLOR_STYLES[col].label}
                            aria-label={`Set label color to ${LABEL_COLOR_STYLES[col].label}`}
                            className={`h-7 rounded-lg border flex items-center justify-center transition-all ${
                              inspectedLabel.color === col
                                ? 'border-blue-600 dark:border-cyan-400 ring-2 ring-blue-500/30 scale-105'
                                : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full ${LABEL_COLOR_STYLES[col].swatchClass}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : inspectedRack ? (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-cyan-400 flex items-center justify-center shrink-0">
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {inspectedRack.style === 'rack' ? '19" Network Rack' : 'Device Container Group'}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {inspectedRack.title}
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={handleDuplicateSelectedNode}
                        title="Duplicate rack & grouped devices (Ctrl+D)"
                        aria-label="Duplicate rack"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => ungroupRack(inspectedRack.id)}
                        title="Ungroup (keep devices)"
                        aria-label="Ungroup rack"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      >
                        <Ungroup className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelection}
                        title="Delete rack and member devices (Del)"
                        aria-label="Delete rack and devices"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInspectorTarget(null)}
                        title="Close properties (Esc)"
                        aria-label="Close rack properties"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Rack / Container Name
                      </label>
                      <input
                        type="text"
                        value={inspectedRack.title}
                        onChange={e => updateInspectedRack({ title: e.target.value }, 'title')}
                        onBlur={endEditSession}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Subtitle / Rack Unit / Location
                      </label>
                      <input
                        type="text"
                        value={inspectedRack.subtitle}
                        onChange={e => updateInspectedRack({ subtitle: e.target.value }, 'subtitle')}
                        onBlur={endEditSession}
                        placeholder="e.g. 42U · MDF Closet A"
                        className="w-full px-2.5 py-1.5 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Container Style
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateInspectedRack({ style: 'rack' })}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 ${
                            inspectedRack.style !== 'group'
                              ? 'border-blue-600 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Server className="w-3.5 h-3.5" />
                          <span>19&quot; Rack</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateInspectedRack({ style: 'group' })}
                          className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 ${
                            inspectedRack.style === 'group'
                              ? 'border-blue-600 dark:border-cyan-400 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-cyan-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <BoxSelect className="w-3.5 h-3.5" />
                          <span>Group Box</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Rack Color
                      </label>
                      <div className="grid grid-cols-6 gap-1.5">
                        {(Object.keys(RACK_STYLE_MAP) as RackColorTheme[]).map(col => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => updateInspectedRack({ color: col })}
                            title={RACK_STYLE_MAP[col].label}
                            aria-label={`Set rack color to ${RACK_STYLE_MAP[col].label}`}
                            className={`h-7 rounded-lg border flex items-center justify-center transition-all ${
                              inspectedRack.color === col
                                ? 'border-blue-600 dark:border-cyan-400 ring-2 ring-blue-500/30 scale-105'
                                : 'border-slate-200 dark:border-slate-700 hover:scale-105'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded-full ${RACK_STYLE_MAP[col].swatch}`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => stackRackMembersVertically(inspectedRack.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1"
                      >
                        <Rows3 className="w-3.5 h-3.5" />
                        <span>Stack Vertically</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fitRackToMembers(inspectedRack.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Fit Frame</span>
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Grouped Devices ({inspectedRack.nodeIds.length})
                        </label>
                        {selectedNodeIds.some(id => !inspectedRack.nodeIds.includes(id)) && (
                          <button
                            type="button"
                            onClick={() => addNodesToRack(inspectedRack.id, selectedNodeIds)}
                            className="text-[10px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                          >
                            + Add selected
                          </button>
                        )}
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
                        {inspectedRack.nodeIds.map(nid => {
                          const member = nodeMap.get(nid);
                          if (!member) return null;
                          return (
                            <div
                              key={nid}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <NetworkDeviceGlyph
                                  type={member.type}
                                  className="w-5 h-4 shrink-0"
                                />
                                <span className="text-[11px] font-medium text-slate-800 dark:text-slate-100 truncate">
                                  {member.label}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeNodeFromRack(inspectedRack.id, nid)}
                                title={`Detach ${member.label} from rack`}
                                aria-label={`Remove ${member.label} from rack`}
                                className="p-0.5 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => ungroupRack(inspectedRack.id)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5"
                    >
                      <Ungroup className="w-3.5 h-3.5" />
                      <span>Ungroup Container (Keep Devices)</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
