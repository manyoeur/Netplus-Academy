import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Bold,
  Cable,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileCode,
  FileJson,
  Grid3x3,
  Image as ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  MousePointer2,
  Network,
  Redo2,
  Search,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  CABLE_SPECS,
  CableRoutingStyle,
  CableType,
  computeCableGeometry,
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
  NetworkDiagramZone,
  NODE_HEIGHT,
  NODE_WIDTH,
  PortSide,
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
          labels: Array.isArray(parsed.labels) ? parsed.labels : []
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
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(0.9);
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const [selection, setSelection] = useState<SelectionState>(null);
  const [inspectorTarget, setInspectorTarget] = useState<SelectionState>(null);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [stencilQuery, setStencilQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<'All' | DeviceCategory>('All');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [exportedImageFormat, setExportedImageFormat] = useState<'png' | 'svg' | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

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
  const docRef = useRef(doc);
  docRef.current = doc;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

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
    (deviceType: NetworkDeviceType, rawX?: number, rawY?: number) => {
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

      const existingCount = docRef.current.nodes.filter(n => n.type === deviceType).length + 1;
      const newNode: NetworkDiagramNode = {
        id: `nd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: deviceType,
        label: `${meta.shortPrefix}-${String(existingCount).padStart(2, '0')}`,
        ipAddress: meta.defaultIp,
        subnetMask: meta.defaultMask,
        vlanOrAsn: meta.defaultVlanOrAsn,
        notes: '',
        x: Math.max(20, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH - 20, snapCoord(x))),
        y: Math.max(20, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT - 20, snapCoord(y)))
      };

      commitChange(prev => ({
        ...prev,
        nodes: [...prev.nodes, newNode]
      }));
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
      setSelection({ kind: 'cable', id: newCable.id });
      setInspectorTarget(null);
    },
    [activeCableType, activeRoutingStyle, commitChange]
  );

  const handleDeleteSelection = useCallback(() => {
    const target = selection || inspectorTarget;
    if (!target) return;
    if (target.kind === 'node') {
      commitChange(prev => ({
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== target.id),
        cables: prev.cables.filter(
          c => c.sourceId !== target.id && c.targetId !== target.id
        )
      }));
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
    }
    setSelection(null);
    setInspectorTarget(null);
  }, [selection, inspectorTarget, commitChange]);

  const handleDuplicateSelectedNode = useCallback(() => {
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
    }
  }, [selection, inspectorTarget, commitChange]);

  // Keyboard controls inside Network Designer (Undo/Redo, Delete, Escape, Duplicate, Nudge)
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        if (selection?.kind === 'node' || selection?.kind === 'label') {
          e.preventDefault();
          handleDuplicateSelectedNode();
        }
        return;
      }

      if (e.key === 'Escape') {
        setConnectSourceId(null);
        setWirePreview(null);
        setInspectorTarget(null);
        setToolMode('select');
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault();
        handleDeleteSelection();
        return;
      }

      if (
        (selection?.kind === 'node' || selection?.kind === 'label') &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? GRID_SNAP_SIZE : 4;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (selection.kind === 'node') {
          commitCoalescedEdit(`nudge:${selection.id}`, prev => ({
            ...prev,
            nodes: prev.nodes.map(n =>
              n.id === selection.id
                ? {
                    ...n,
                    x: Math.max(0, Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, n.x + dx)),
                    y: Math.max(0, Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, n.y + dy))
                  }
                : n
            )
          }));
        } else {
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selection,
    handleUndo,
    handleRedo,
    handleDeleteSelection,
    handleDuplicateSelectedNode,
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

  // Dragging a device node
  const startNodeDrag = (e: React.MouseEvent, node: NetworkDiagramNode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    focusCanvas();

    if (toolMode === 'connect') {
      setInspectorTarget(null);
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

    setSelection({ kind: 'node', id: node.id });
    setInspectorTarget(prev => (prev && prev.kind === 'node' && prev.id === node.id ? prev : null));

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const origX = node.x;
    const origY = node.y;
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

      const nextX = Math.max(
        0,
        Math.min(DIAGRAM_CANVAS_WIDTH - NODE_WIDTH, snapCoord(origX + dx))
      );
      const nextY = Math.max(
        0,
        Math.min(DIAGRAM_CANVAS_HEIGHT - NODE_HEIGHT, snapCoord(origY + dy))
      );
      latestX = nextX;
      latestY = nextY;

      dispatchHistory({
        type: 'PREVIEW',
        updater: prev => ({
          ...prev,
          nodes: prev.nodes.map(n => (n.id === node.id ? { ...n, x: nextX, y: nextY } : n))
        })
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (hasMoved) {
        const finalDoc: NetworkDiagramDocument = {
          ...preDragDoc,
          nodes: preDragDoc.nodes.map(n =>
            n.id === node.id ? { ...n, x: latestX, y: latestY } : n
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

  // Canvas background click (place zone / place label / clear selection / pan)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('[data-node-id]') ||
      target?.closest('[data-cable-id]') ||
      target?.closest('[data-zone-id]') ||
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

    setSelection(null);
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
    const isLabelDrop = e.dataTransfer.getData('application/x-network-label');
    if (isLabelDrop) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      addLabelAt(pt.x - 36, pt.y - 12);
      return;
    }
    const deviceType = e.dataTransfer.getData('application/x-network-device') as NetworkDeviceType;
    if (!deviceType || !STENCIL_MAP[deviceType]) return;
    const pt = clientToCanvas(e.clientX, e.clientY);
    addDeviceAt(deviceType, pt.x - NODE_WIDTH / 2, pt.y - NODE_HEIGHT / 2);
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
          labels: Array.isArray(parsed.labels) ? parsed.labels : []
        }));
        setSelection(null);
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
                  {doc.nodes.length} devices · {doc.cables.length} cables · {(doc.labels || []).length} labels · {doc.zones.length} zones
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Visio &amp; draw.io-style network diagramming studio — drag network stencils, route cables, and export blueprints.
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
                className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${
                  toolMode === 'select'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MousePointer2 className="w-3.5 h-3.5" />
                <span>Select / Move</span>
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

            {/* Grid & Snap Toggle */}
            <button
              type="button"
              onClick={() => setSnapToGrid(s => !s)}
              aria-pressed={snapToGrid}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                snapToGrid
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-cyan-700 text-blue-700 dark:text-cyan-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title="Toggle 20px grid snapping"
            >
              <Grid3x3 className="w-3.5 h-3.5" />
              <span>Snap 20px</span>
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
                  : toolMode === 'label'
                  ? 'Click anywhere on the canvas to place a text label mark (Esc to cancel)'
                  : 'Click anywhere on the canvas to place a new Subnet / Security Zone frame'}
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
            }}
            onDrop={handleCanvasDrop}
            className={`w-full h-[640px] overflow-auto relative select-none focus:outline-none ${
              isPanning
                ? 'cursor-grabbing'
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
                    selection?.kind === 'node' && selection.id === node.id;
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

                {/* Empty Canvas Callout */}
                {doc.nodes.length === 0 && doc.zones.length === 0 && (doc.labels || []).length === 0 && (
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
            Double-click device, label, cable, or zone to edit · Drag ports to connect · Ctrl + Scroll to zoom
          </div>

          {/* Floating Properties Box — appears ONLY when double-clicking or adding a label */}
          {(inspectedNode || inspectedCable || inspectedZone || inspectedLabel) && (
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
              ) : null}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};
