import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Cable,
  Check,
  LayoutGrid,
  Magnet,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X
} from 'lucide-react';
import {
  LabExerciseTopology,
  buildDefaultLabExerciseTopology
} from '../../data/labExerciseTopologies';
import {
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
  getLinkConnectorEndpoints,
  isPortCompatibleWithCable,
  isValidIp,
  isValidMask,
  maskToPrefix
} from './networkSimEngine';
import { CiscoDeviceIcon } from './CiscoDeviceIcon';
import { parseAndValidateTopologyJson } from '../../utils/topologyJson';
import { useAcademy } from '../../context/AcademyContext';

interface LabTopologyEditorModalProps {
  labNumber: number;
  labTitle: string;
  initialTopology: LabExerciseTopology;
  onSave: (updated: LabExerciseTopology) => Promise<void> | void;
  onResetToDefault: () => Promise<void> | void;
  onClose: () => void;
}

type EditorTool = 'select' | 'cable' | 'shape' | 'label' | 'delete';
type CableChoice = 'auto' | SimCableType;

interface TopologySnapshot {
  devices: SimDevice[];
  links: SimLink[];
  shapes: SimTopologyShape[];
  labels: SimDiagramLabel[];
}

const CABLE_STYLE: Record<
  SimCableType,
  { label: string; stroke: string; dash?: string }
> = {
  straight: { label: 'Straight', stroke: '#0284c7' },
  crossover: { label: 'Crossover', stroke: '#0ea5e9', dash: '6 4' },
  fiber: { label: 'Fiber', stroke: '#f59e0b' },
  serial: { label: 'Serial WAN', stroke: '#ef4444' }
};

const ZONE_COLOR_PRESETS = [
  { label: 'Blue LAN', border: '#0284c7', fill: '#0ea5e9', text: '#0369a1' },
  { label: 'Emerald Mgmt', border: '#059669', fill: '#10b981', text: '#047857' },
  { label: 'Amber DMZ', border: '#d97706', fill: '#f59e0b', text: '#b45309' },
  { label: 'Violet VLAN', border: '#7c3aed', fill: '#8b5cf6', text: '#6d28d9' },
  { label: 'Red Untrusted', border: '#dc2626', fill: '#ef4444', text: '#b91c1c' }
];

function cloneSnapshot(snap: TopologySnapshot): TopologySnapshot {
  return JSON.parse(JSON.stringify(snap));
}

function chooseBestCableType(src: SimDevice, dst: SimDevice): SimCableType {
  if (src.type === 'router' && dst.type === 'router') return 'serial';
  if (src.type === dst.type) return 'crossover';
  return 'straight';
}

function findFirstAvailablePort(
  dev: SimDevice,
  links: SimLink[],
  cableType: SimCableType
): string | null {
  const used = new Set<string>();
  links.forEach(l => {
    if (l.fromDeviceId === dev.id) used.add(l.fromPort);
    if (l.toDeviceId === dev.id) used.add(l.toPort);
  });
  const candidate = dev.interfaces.find(
    iface => !used.has(iface.name) && isPortCompatibleWithCable(iface, cableType)
  );
  if (candidate) return candidate.name;
  // Fallback: any unused non-subinterface port
  const fallback = dev.interfaces.find(
    iface => !used.has(iface.name) && iface.kind !== 'subinterface' && iface.kind !== 'svi'
  );
  return fallback ? fallback.name : null;
}

export const LabTopologyEditorModal: React.FC<LabTopologyEditorModalProps> = ({
  labNumber,
  labTitle,
  initialTopology,
  onSave,
  onResetToDefault,
  onClose
}) => {
  const { darkMode } = useAcademy();

  const canvasW = initialTopology.canvasWidth || 1000;
  const canvasH = initialTopology.canvasHeight || 480;

  const [devices, setDevices] = useState<SimDevice[]>(() =>
    JSON.parse(JSON.stringify(initialTopology.devices))
  );
  const [links, setLinks] = useState<SimLink[]>(() =>
    JSON.parse(JSON.stringify(initialTopology.links))
  );
  const [shapes, setShapes] = useState<SimTopologyShape[]>(() =>
    JSON.parse(JSON.stringify(initialTopology.shapes))
  );
  const [labels, setLabels] = useState<SimDiagramLabel[]>(() =>
    JSON.parse(JSON.stringify(initialTopology.labels))
  );

  const [historyPast, setHistoryPast] = useState<TopologySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<TopologySnapshot[]>([]);

  const [tool, setTool] = useState<EditorTool>('select');
  const [cableChoice, setCableChoice] = useState<CableChoice>('auto');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [pendingCableSourceId, setPendingCableSourceId] = useState<string | null>(null);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(
    initialTopology.devices[0]?.id || null
  );
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    kind: 'info' | 'error';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    kind: 'device' | 'shape' | 'label';
    id: string;
    startCanvasX: number;
    startCanvasY: number;
    origX: number;
    origY: number;
    snapshotBefore: TopologySnapshot;
    moved: boolean;
  } | null>(null);

  const snapshotCurrent = (): TopologySnapshot =>
    cloneSnapshot({ devices, links, shapes, labels });

  const commitChange = (
    next: Partial<TopologySnapshot>,
    explicitBefore?: TopologySnapshot
  ) => {
    const before = explicitBefore || snapshotCurrent();
    setHistoryPast(prev => [...prev.slice(-39), before]);
    setHistoryFuture([]);
    if (next.devices !== undefined) setDevices(next.devices);
    if (next.links !== undefined) setLinks(next.links);
    if (next.shapes !== undefined) setShapes(next.shapes);
    if (next.labels !== undefined) setLabels(next.labels);
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    const current = snapshotCurrent();
    setHistoryPast(p => p.slice(0, -1));
    setHistoryFuture(f => [current, ...f.slice(0, 39)]);
    setDevices(prev.devices);
    setLinks(prev.links);
    setShapes(prev.shapes);
    setLabels(prev.labels);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const current = snapshotCurrent();
    setHistoryFuture(f => f.slice(1));
    setHistoryPast(p => [...p.slice(-39), current]);
    setDevices(next.devices);
    setLinks(next.links);
    setShapes(next.shapes);
    setLabels(next.labels);
  };

  const getCanvasCoords = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: canvasW / 2, y: canvasH / 2 };
    const rect = el.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / Math.max(1, rect.width)) * canvasW;
    const rawY = ((clientY - rect.top) / Math.max(1, rect.height)) * canvasH;
    const snap = (val: number, max: number) => {
      const clamped = Math.min(max - 20, Math.max(20, val));
      return snapToGrid ? Math.round(clamped / 20) * 20 : Math.round(clamped);
    };
    return { x: snap(rawX, canvasW), y: snap(rawY, canvasH) };
  };

  const linkStatuses = useMemo(() => {
    const map = new Map<string, { isUp: boolean; reason: string }>();
    links.forEach(link => {
      const st = evaluateLinkStatus(link, devices);
      map.set(link.id, { isUp: st.isUp, reason: st.reason });
    });
    return map;
  }, [links, devices]);

  const handleAddDevice = (type: SimDeviceType) => {
    const prefix =
      type === 'router' ? 'R' : type === 'switch' ? 'SW' : type === 'server' ? 'SRV' : 'PC';
    let idx = devices.filter(d => d.type === type).length + 1;
    const existingNames = new Set(devices.map(d => d.name.toUpperCase()));
    while (existingNames.has(`${prefix}${idx}`.toUpperCase())) idx++;

    const offset = (devices.length % 5) * 40;
    const x = Math.min(canvasW - 80, Math.max(80, Math.round((canvasW / 2 + offset - 80) / 20) * 20));
    const y = Math.min(canvasH - 80, Math.max(70, Math.round((canvasH / 2 + (devices.length % 3) * 30 - 30) / 20) * 20));
    const created = createDefaultDevice(type, `${prefix}${idx}`, x, y);
    if (type === 'router' && created.interfaces[0]) {
      created.interfaces[0].adminUp = true;
    }

    commitChange({ devices: [...devices, created] });
    setSelectedDeviceId(created.id);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedLabelId(null);
    setTool('select');
    setStatusMessage({ kind: 'info', text: `Added ${created.name} (${created.model}).` });
  };

  const handleConnectDevices = (srcId: string, dstId: string) => {
    if (srcId === dstId) {
      setPendingCableSourceId(null);
      return;
    }
    const srcDev = devices.find(d => d.id === srcId);
    const dstDev = devices.find(d => d.id === dstId);
    if (!srcDev || !dstDev) {
      setPendingCableSourceId(null);
      return;
    }

    let resolvedCable: SimCableType =
      cableChoice === 'auto' ? chooseBestCableType(srcDev, dstDev) : cableChoice;

    let fromPort = findFirstAvailablePort(srcDev, links, resolvedCable);
    let toPort = findFirstAvailablePort(dstDev, links, resolvedCable);

    // If auto picked serial and one side lacks serial, gracefully fall back to crossover ethernet
    if (cableChoice === 'auto' && (!fromPort || !toPort) && resolvedCable === 'serial') {
      resolvedCable = 'crossover';
      fromPort = findFirstAvailablePort(srcDev, links, resolvedCable);
      toPort = findFirstAvailablePort(dstDev, links, resolvedCable);
    }

    if (!fromPort || !toPort) {
      setStatusMessage({
        kind: 'error',
        text: `No free compatible ${resolvedCable} port available between ${srcDev.name} and ${dstDev.name}.`
      });
      setPendingCableSourceId(null);
      return;
    }

    const newLink: SimLink = {
      id: `link-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      cableType: resolvedCable,
      fromDeviceId: srcDev.id,
      fromPort,
      toDeviceId: dstDev.id,
      toPort
    };

    commitChange({ links: [...links, newLink] });
    setPendingCableSourceId(null);
    setSelectedLinkId(newLink.id);
    setSelectedDeviceId(null);
    setSelectedShapeId(null);
    setSelectedLabelId(null);
    setStatusMessage({
      kind: 'info',
      text: `Connected ${srcDev.name} (${fromPort}) ↔ ${dstDev.name} (${toPort}) via ${CABLE_STYLE[resolvedCable].label}.`
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current?.moved) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (tool === 'shape') {
      const shape: SimTopologyShape = {
        id: `zone-${Date.now()}`,
        kind: 'rectangle',
        x: Math.max(20, Math.min(canvasW - 260, x - 120)),
        y: Math.max(20, Math.min(canvasH - 160, y - 70)),
        width: 240,
        height: 150,
        fillColor: '#0ea5e9',
        fillOpacity: 0.08,
        borderColor: '#0284c7',
        lineStyle: 'dashed',
        borderWidth: 2,
        label: 'New Subnet Zone',
        labelColor: '#0369a1'
      };
      commitChange({ shapes: [...shapes, shape] });
      setSelectedShapeId(shape.id);
      setSelectedDeviceId(null);
      setSelectedLinkId(null);
      setSelectedLabelId(null);
      setTool('select');
      return;
    }

    if (tool === 'label') {
      const lbl: SimDiagramLabel = {
        id: `lbl-${Date.now()}`,
        text: 'VLAN / Protocol Note',
        x,
        y,
        color: '#0f172a',
        bgColor: '#e0f2fe',
        fontSize: 11,
        bold: true
      };
      commitChange({ labels: [...labels, lbl] });
      setSelectedLabelId(lbl.id);
      setSelectedDeviceId(null);
      setSelectedLinkId(null);
      setSelectedShapeId(null);
      setTool('select');
      return;
    }

    setPendingCableSourceId(null);
    setSelectedDeviceId(null);
    setSelectedLinkId(null);
    setSelectedShapeId(null);
    setSelectedLabelId(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    const dx = x - drag.startCanvasX;
    const dy = y - drag.startCanvasY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      drag.moved = true;
    }

    if (drag.kind === 'device') {
      const nx = Math.min(canvasW - 50, Math.max(50, drag.origX + dx));
      const ny = Math.min(canvasH - 55, Math.max(45, drag.origY + dy));
      setDevices(prev => prev.map(d => (d.id === drag.id ? { ...d, x: nx, y: ny } : d)));
    } else if (drag.kind === 'shape') {
      const nx = Math.min(canvasW - 60, Math.max(10, drag.origX + dx));
      const ny = Math.min(canvasH - 50, Math.max(10, drag.origY + dy));
      setShapes(prev => prev.map(s => (s.id === drag.id ? { ...s, x: nx, y: ny } : s)));
    } else if (drag.kind === 'label') {
      const nx = Math.min(canvasW - 40, Math.max(40, drag.origX + dx));
      const ny = Math.min(canvasH - 20, Math.max(20, drag.origY + dy));
      setLabels(prev => prev.map(l => (l.id === drag.id ? { ...l, x: nx, y: ny } : l)));
    }
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.moved) {
      setHistoryPast(prev => [...prev.slice(-39), drag.snapshotBefore]);
      setHistoryFuture([]);
    }
  };

  const handleAutoLayout = () => {
    if (devices.length === 0) return;
    const routers = devices.filter(d => d.type === 'router');
    const switches = devices.filter(d => d.type === 'switch');
    const endpoints = devices.filter(d => d.type === 'pc' || d.type === 'server');
    const rows = [routers, switches, endpoints].filter(r => r.length > 0);
    const posMap = new Map<string, { x: number; y: number }>();

    rows.forEach((row, rIdx) => {
      const y =
        rows.length === 1
          ? Math.round(canvasH / 2)
          : Math.round(95 + (rIdx * (canvasH - 185)) / (rows.length - 1));
      const step = row.length > 1 ? Math.min(220, (canvasW - 180) / (row.length - 1)) : 0;
      const startX = canvasW / 2 - ((row.length - 1) * step) / 2;
      row.forEach((dev, cIdx) => {
        posMap.set(dev.id, {
          x: Math.round((startX + cIdx * step) / 20) * 20,
          y: Math.round(y / 20) * 20
        });
      });
    });

    commitChange({
      devices: devices.map(d => {
        const pos = posMap.get(d.id);
        return pos ? { ...d, x: pos.x, y: pos.y } : d;
      })
    });
    setStatusMessage({ kind: 'info', text: 'Applied hierarchical Grid Auto-Layout.' });
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseAndValidateTopologyJson(text);
      if (!parsed.ok) {
        setStatusMessage({ kind: 'error', text: parsed.error });
        return;
      }
      commitChange({
        devices: parsed.data.devices,
        links: parsed.data.links,
        shapes: parsed.data.shapes,
        labels: parsed.data.labels
      });
      setSelectedDeviceId(parsed.data.devices[0]?.id || null);
      setSelectedLinkId(null);
      setSelectedShapeId(null);
      setSelectedLabelId(null);
      setStatusMessage({
        kind: 'info',
        text: `Imported ${parsed.data.devices.length} devices and ${parsed.data.links.length} links from JSON.`
      });
    } catch {
      setStatusMessage({ kind: 'error', text: 'Failed to read topology JSON file.' });
    }
  };

  const handleDeleteDevice = (id: string) => {
    commitChange({
      devices: devices.filter(d => d.id !== id),
      links: links.filter(l => l.fromDeviceId !== id && l.toDeviceId !== id)
    });
    if (selectedDeviceId === id) setSelectedDeviceId(null);
  };

  const handleDeleteLink = (id: string) => {
    commitChange({ links: links.filter(l => l.id !== id) });
    if (selectedLinkId === id) setSelectedLinkId(null);
  };

  const handleDeleteShape = (id: string) => {
    commitChange({ shapes: shapes.filter(s => s.id !== id) });
    if (selectedShapeId === id) setSelectedShapeId(null);
  };

  const handleDeleteLabel = (id: string) => {
    commitChange({ labels: labels.filter(l => l.id !== id) });
    if (selectedLabelId === id) setSelectedLabelId(null);
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...initialTopology,
        canvasWidth: canvasW,
        canvasHeight: canvasH,
        devices,
        links,
        shapes,
        labels,
        updatedAt: new Date().toISOString(),
        isCustomized: true
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaultClick = async () => {
    const def = buildDefaultLabExerciseTopology(initialTopology.labId);
    commitChange({
      devices: def.devices,
      links: def.links,
      shapes: def.shapes,
      labels: def.labels
    });
    await onResetToDefault();
    setStatusMessage({
      kind: 'info',
      text: 'Restored default curriculum topology for this lab.'
    });
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null;
  const selectedLink = links.find(l => l.id === selectedLinkId) || null;
  const selectedShape = shapes.find(s => s.id === selectedShapeId) || null;
  const selectedLabel = labels.find(l => l.id === selectedLabelId) || null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Edit Topology for Lab ${labNumber}`}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
    >
      <div className="w-full max-w-7xl max-h-[94vh] rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="min-w-0">
            <p className="text-[11px] font-mono font-semibold text-blue-600 dark:text-cyan-400">
              Admin &amp; Instructor Topology Studio · Lab {labNumber}
            </p>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {labTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaultClick}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveClick}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Topology'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close topology editor"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Editor Toolbar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-[#0c1220]">
          {/* Left: Tools & Cable Choice */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'select', label: 'Select / Drag', icon: MousePointer2 },
                { id: 'cable', label: 'Connect Cable', icon: Cable },
                { id: 'shape', label: 'Add Zone', icon: Square },
                { id: 'label', label: 'Add Note', icon: Type },
                { id: 'delete', label: 'Delete', icon: Trash2 }
              ] as const
            ).map(item => {
              const Icon = item.icon;
              const active = tool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTool(item.id);
                    setPendingCableSourceId(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    active
                      ? item.id === 'delete'
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {tool === 'cable' && (
              <select
                aria-label="Cable type"
                value={cableChoice}
                onChange={e => setCableChoice(e.target.value as CableChoice)}
                className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="auto">Auto Cable</option>
                <option value="straight">Straight-Through</option>
                <option value="crossover">Crossover</option>
                <option value="fiber">Fiber Optic</option>
                <option value="serial">Serial WAN</option>
              </select>
            )}
          </div>

          {/* Right: Add Devices + Grid/History */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { type: 'router', label: 'Router' },
                { type: 'switch', label: 'Switch' },
                { type: 'pc', label: 'PC' },
                { type: 'server', label: 'Server' }
              ] as const
            ).map(item => (
              <button
                key={item.type}
                type="button"
                onClick={() => handleAddDevice(item.type)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-blue-500 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3 h-3 text-blue-600 dark:text-cyan-400" />
                <span>{item.label}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={handleAutoLayout}
              title="Arrange devices in hierarchical rows"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Auto Layout</span>
            </button>

            <button
              type="button"
              onClick={() => setSnapToGrid(prev => !prev)}
              aria-pressed={snapToGrid}
              title="Toggle 20px snap-to-grid"
              className={`px-2 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap ${
                snapToGrid
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Snap</span>
            </button>

            <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                type="button"
                disabled={historyPast.length === 0}
                onClick={handleUndo}
                title="Undo"
                className="p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={historyFuture.length === 0}
                onClick={handleRedo}
                title="Redo"
                className="p-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 border-l border-slate-200 dark:border-slate-700"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        {statusMessage && (
          <div
            className={`px-4 sm:px-6 py-1.5 text-xs font-medium flex items-center justify-between gap-2 border-b ${
              statusMessage.kind === 'error'
                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300'
                : 'bg-blue-50/70 dark:bg-blue-950/30 border-slate-200 dark:border-slate-800 text-blue-700 dark:text-cyan-300'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {statusMessage.kind === 'error' ? (
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Check className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-[11px] underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Main Workspace: Interactive Canvas + Property Inspector */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Canvas Column */}
          <div className="lg:col-span-8 xl:col-span-9 p-4 overflow-auto bg-slate-100/70 dark:bg-slate-950/60 flex items-center justify-center">
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{
                width: '100%',
                maxWidth: `${canvasW}px`,
                aspectRatio: `${canvasW} / ${canvasH}`,
                backgroundImage: darkMode
                  ? 'radial-gradient(rgba(148,163,184,0.22) 1px, transparent 1px)'
                  : 'radial-gradient(rgba(100,116,139,0.25) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}
              className={`relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090f1d] shadow-inner select-none touch-none ${
                tool === 'cable' || tool === 'shape' || tool === 'label'
                  ? 'cursor-crosshair'
                  : 'cursor-default'
              }`}
            >
              {/* Zone Shapes */}
              {shapes.map(shape => {
                const isSel = selectedShapeId === shape.id;
                const strokeDasharray =
                  shape.lineStyle === 'dashed'
                    ? '7 5'
                    : shape.lineStyle === 'dotted'
                    ? '2 4'
                    : undefined;

                return (
                  <div
                    key={shape.id}
                    onPointerDown={e => {
                      if (tool === 'delete') {
                        e.stopPropagation();
                        handleDeleteShape(shape.id);
                        return;
                      }
                      if (tool !== 'select') return;
                      e.stopPropagation();
                      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
                      setSelectedShapeId(shape.id);
                      setSelectedDeviceId(null);
                      setSelectedLinkId(null);
                      setSelectedLabelId(null);
                      dragRef.current = {
                        kind: 'shape',
                        id: shape.id,
                        startCanvasX: x,
                        startCanvasY: y,
                        origX: shape.x,
                        origY: shape.y,
                        snapshotBefore: snapshotCurrent(),
                        moved: false
                      };
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      left: `${(shape.x / canvasW) * 100}%`,
                      top: `${(shape.y / canvasH) * 100}%`,
                      width: `${(shape.width / canvasW) * 100}%`,
                      height: `${(shape.height / canvasH) * 100}%`
                    }}
                    className={`absolute z-[1] ${
                      tool === 'delete'
                        ? 'cursor-pointer hover:ring-2 hover:ring-red-500 rounded-xl'
                        : tool === 'select'
                        ? 'cursor-move'
                        : 'pointer-events-none'
                    } ${isSel ? 'ring-2 ring-blue-500 dark:ring-cyan-400 rounded-xl' : ''}`}
                  >
                    <svg
                      viewBox={`0 0 ${shape.width} ${shape.height}`}
                      preserveAspectRatio="none"
                      className="w-full h-full overflow-visible"
                    >
                      {shape.kind === 'circle' ? (
                        <ellipse
                          cx={shape.width / 2}
                          cy={shape.height / 2}
                          rx={Math.max(4, shape.width / 2 - 2)}
                          ry={Math.max(4, shape.height / 2 - 2)}
                          fill={shape.fillColor === 'transparent' ? 'none' : shape.fillColor}
                          fillOpacity={shape.fillColor === 'transparent' ? 0 : shape.fillOpacity}
                          stroke={shape.borderColor}
                          strokeWidth={shape.borderWidth || 2}
                          strokeDasharray={strokeDasharray}
                        />
                      ) : (
                        <rect
                          x={1.5}
                          y={1.5}
                          width={Math.max(8, shape.width - 3)}
                          height={Math.max(8, shape.height - 3)}
                          rx={12}
                          fill={shape.fillColor === 'transparent' ? 'none' : shape.fillColor}
                          fillOpacity={shape.fillColor === 'transparent' ? 0 : shape.fillOpacity}
                          stroke={shape.borderColor}
                          strokeWidth={shape.borderWidth || 2}
                          strokeDasharray={strokeDasharray}
                        />
                      )}
                    </svg>
                    {shape.label && (
                      <div
                        style={{ color: shape.labelColor || shape.borderColor }}
                        className="absolute top-2 left-3 text-[11px] font-bold pointer-events-none"
                      >
                        {shape.label}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* SVG Cables */}
              <svg
                viewBox={`0 0 ${canvasW} ${canvasH}`}
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
              >
                {links.map(link => {
                  const fromDev = devices.find(d => d.id === link.fromDeviceId);
                  const toDev = devices.find(d => d.id === link.toDeviceId);
                  if (!fromDev || !toDev) return null;

                  const st = linkStatuses.get(link.id);
                  const isUp = Boolean(st?.isUp);
                  const meta = CABLE_STYLE[link.cableType];
                  const isSelected = selectedLinkId === link.id;
                  const endpoints = getLinkConnectorEndpoints(link, fromDev, toDev, links);
                  const geom = computeCableGeometry(
                    endpoints.x1,
                    endpoints.y1,
                    endpoints.x2,
                    endpoints.y2,
                    {
                      anchored: false,
                      cableType: link.cableType,
                      fromDownClearance: endpoints.fromDownClearance,
                      toDownClearance: endpoints.toDownClearance
                    }
                  );

                  const fromIf = fromDev.interfaces.find(i => i.name === link.fromPort);
                  const toIf = toDev.interfaces.find(i => i.name === link.toPort);

                  return (
                    <g key={link.id}>
                      <path
                        d={geom.pathD}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={18}
                        className="pointer-events-auto cursor-pointer"
                        onClick={e => {
                          e.stopPropagation();
                          if (tool === 'delete') {
                            handleDeleteLink(link.id);
                          } else {
                            setSelectedLinkId(link.id);
                            setSelectedDeviceId(null);
                            setSelectedShapeId(null);
                            setSelectedLabelId(null);
                          }
                        }}
                      />
                      <path
                        d={geom.pathD}
                        fill="none"
                        stroke={
                          isSelected
                            ? '#2563eb'
                            : link.cableType === 'serial'
                            ? meta.stroke
                            : isUp
                            ? meta.stroke
                            : '#94a3b8'
                        }
                        strokeWidth={isSelected ? 4 : 2.6}
                        strokeDasharray={meta.dash}
                        strokeLinecap="round"
                      />
                      <circle
                        cx={geom.x1Led}
                        cy={geom.y1Led}
                        r={4}
                        fill={isUp ? '#10b981' : '#ef4444'}
                        stroke={darkMode ? '#090f1d' : '#ffffff'}
                        strokeWidth={1}
                      />
                      <circle
                        cx={geom.x2Led}
                        cy={geom.y2Led}
                        r={4}
                        fill={isUp ? '#10b981' : '#ef4444'}
                        stroke={darkMode ? '#090f1d' : '#ffffff'}
                        strokeWidth={1}
                      />
                      <text
                        x={geom.fromLabelX}
                        y={geom.fromLabelY}
                        textAnchor={geom.textAnchor}
                        className="font-mono font-semibold fill-slate-700 dark:fill-slate-300 stroke-slate-50 dark:stroke-[#090f1d]"
                        fontSize="10"
                        strokeWidth={3.5}
                        style={{ paintOrder: 'stroke' }}
                      >
                        {fromIf?.shortName || link.fromPort}
                      </text>
                      <text
                        x={geom.toLabelX}
                        y={geom.toLabelY}
                        textAnchor={geom.textAnchor}
                        className="font-mono font-semibold fill-slate-700 dark:fill-slate-300 stroke-slate-50 dark:stroke-[#090f1d]"
                        fontSize="10"
                        strokeWidth={3.5}
                        style={{ paintOrder: 'stroke' }}
                      >
                        {toIf?.shortName || link.toPort}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Devices */}
              {devices.map(dev => {
                const isSelected = selectedDeviceId === dev.id;
                const isPendingSrc = pendingCableSourceId === dev.id;
                const custom = dev.customLabel?.trim();
                const useCustom = Boolean(custom && dev.useCustomLabel !== false);
                const displayName = useCustom && custom ? custom : dev.name;
                const primaryIface = dev.interfaces.find(i => isValidIp(i.ip));
                const ipText = primaryIface
                  ? `${primaryIface.ip}${
                      isValidIp(primaryIface.mask)
                        ? `/${maskToPrefix(primaryIface.mask)}`
                        : ''
                    }`
                  : '';

                return (
                  <React.Fragment key={dev.id}>
                    <div
                      onPointerDown={e => {
                        e.stopPropagation();
                        if (tool === 'delete') {
                          handleDeleteDevice(dev.id);
                          return;
                        }
                        if (tool === 'cable') {
                          if (!pendingCableSourceId) {
                            setPendingCableSourceId(dev.id);
                            setStatusMessage({
                              kind: 'info',
                              text: `Cable source: ${dev.name}. Click another device to complete connection.`
                            });
                          } else {
                            handleConnectDevices(pendingCableSourceId, dev.id);
                          }
                          return;
                        }
                        if (tool !== 'select') return;
                        const { x, y } = getCanvasCoords(e.clientX, e.clientY);
                        setSelectedDeviceId(dev.id);
                        setSelectedLinkId(null);
                        setSelectedShapeId(null);
                        setSelectedLabelId(null);
                        dragRef.current = {
                          kind: 'device',
                          id: dev.id,
                          startCanvasX: x,
                          startCanvasY: y,
                          origX: dev.x,
                          origY: dev.y,
                          snapshotBefore: snapshotCurrent(),
                          moved: false
                        };
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        left: `${(dev.x / canvasW) * 100}%`,
                        top: `${(dev.y / canvasH) * 100}%`
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-2xl ${
                        tool === 'cable'
                          ? 'cursor-crosshair'
                          : tool === 'delete'
                          ? 'cursor-pointer hover:ring-2 hover:ring-red-500'
                          : 'cursor-grab active:cursor-grabbing'
                      } ${
                        isPendingSrc
                          ? 'ring-2 ring-emerald-500 bg-emerald-500/15 z-20'
                          : isSelected
                          ? 'ring-2 ring-blue-500 dark:ring-cyan-400 bg-blue-500/10 dark:bg-cyan-400/15 z-20'
                          : 'z-10'
                      }`}
                    >
                      <CiscoDeviceIcon
                        type={dev.type}
                        className="w-12 h-10 sm:w-14 sm:h-12 drop-shadow-[0_4px_8px_rgba(2,6,23,0.28)]"
                      />
                    </div>

                    <div
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedDeviceId(dev.id);
                        setSelectedLinkId(null);
                        setSelectedShapeId(null);
                        setSelectedLabelId(null);
                      }}
                      style={{
                        left: `${(dev.x / canvasW) * 100}%`,
                        top: `${((dev.y + 34) / canvasH) * 100}%`
                      }}
                      className={`absolute -translate-x-1/2 px-2 py-0.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border shadow-xs text-center whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 dark:border-cyan-400 z-20'
                          : 'border-slate-200 dark:border-slate-700 z-[15]'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                        {displayName}
                      </div>
                      {ipText && (
                        <div className="text-[10px] font-mono tabular-nums text-blue-600 dark:text-cyan-300 leading-tight">
                          {ipText}
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Annotation Labels */}
              {labels.map(lbl => {
                const isSel = selectedLabelId === lbl.id;
                const hasBg = Boolean(lbl.bgColor && lbl.bgColor !== 'transparent');
                return (
                  <div
                    key={lbl.id}
                    onPointerDown={e => {
                      e.stopPropagation();
                      if (tool === 'delete') {
                        handleDeleteLabel(lbl.id);
                        return;
                      }
                      if (tool !== 'select') return;
                      const { x, y } = getCanvasCoords(e.clientX, e.clientY);
                      setSelectedLabelId(lbl.id);
                      setSelectedDeviceId(null);
                      setSelectedLinkId(null);
                      setSelectedShapeId(null);
                      dragRef.current = {
                        kind: 'label',
                        id: lbl.id,
                        startCanvasX: x,
                        startCanvasY: y,
                        origX: lbl.x,
                        origY: lbl.y,
                        snapshotBefore: snapshotCurrent(),
                        moved: false
                      };
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{
                      left: `${(lbl.x / canvasW) * 100}%`,
                      top: `${(lbl.y / canvasH) * 100}%`,
                      color: lbl.color || '#0f172a',
                      backgroundColor: hasBg ? lbl.bgColor : undefined,
                      fontSize: `${lbl.fontSize || 11}px`
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg whitespace-nowrap z-[18] ${
                      tool === 'delete'
                        ? 'cursor-pointer ring-1 ring-red-400'
                        : 'cursor-move'
                    } ${
                      isSel
                        ? 'ring-2 ring-blue-500'
                        : hasBg
                        ? 'border border-slate-200/80 shadow-xs'
                        : ''
                    } font-bold`}
                  >
                    {lbl.text}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Inspector Panel */}
          <aside className="lg:col-span-4 xl:col-span-3 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1220] p-4 overflow-y-auto space-y-4">
            {selectedDevice ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[11px] font-mono text-blue-600 dark:text-cyan-400">
                      Device Properties
                    </p>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedDevice.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDevice(selectedDevice.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    title="Delete device"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Hostname
                    </label>
                    <input
                      type="text"
                      value={selectedDevice.name}
                      maxLength={32}
                      onChange={e => {
                        const val = e.target.value;
                        setDevices(prev =>
                          prev.map(d => (d.id === selectedDevice.id ? { ...d, name: val } : d))
                        );
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Display Badge Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={selectedDevice.customLabel || ''}
                      placeholder="e.g., R1 · Area 0 Border"
                      maxLength={48}
                      onChange={e => {
                        const val = e.target.value;
                        setDevices(prev =>
                          prev.map(d =>
                            d.id === selectedDevice.id
                              ? { ...d, customLabel: val, useCustomLabel: Boolean(val.trim()) }
                              : d
                          )
                        );
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  {(selectedDevice.type === 'pc' ||
                    selectedDevice.type === 'server' ||
                    selectedDevice.type === 'switch') && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Default Gateway
                      </label>
                      <input
                        type="text"
                        value={
                          selectedDevice.type === 'switch'
                            ? selectedDevice.defaultGateway || ''
                            : selectedDevice.gateway || ''
                        }
                        placeholder="192.168.10.1"
                        onChange={e => {
                          const val = e.target.value;
                          setDevices(prev =>
                            prev.map(d =>
                              d.id === selectedDevice.id
                                ? selectedDevice.type === 'switch'
                                  ? { ...d, defaultGateway: val }
                                  : { ...d, gateway: val }
                                : d
                            )
                          );
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Interface IPv4 Assignments */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    Interfaces &amp; IPv4
                  </p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selectedDevice.interfaces.slice(0, 6).map(iface => (
                      <div
                        key={iface.name}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">
                            {iface.shortName}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDevices(prev =>
                                prev.map(d =>
                                  d.id === selectedDevice.id
                                    ? {
                                        ...d,
                                        interfaces: d.interfaces.map(item =>
                                          item.name === iface.name
                                            ? { ...item, adminUp: !item.adminUp }
                                            : item
                                        )
                                      }
                                    : d
                                )
                              );
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                              iface.adminUp
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300'
                            }`}
                          >
                            {iface.adminUp ? 'UP' : 'DOWN'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            value={iface.ip}
                            placeholder="IPv4 address"
                            onChange={e => {
                              const val = e.target.value;
                              setDevices(prev =>
                                prev.map(d =>
                                  d.id === selectedDevice.id
                                    ? {
                                        ...d,
                                        interfaces: d.interfaces.map(item =>
                                          item.name === iface.name
                                            ? {
                                                ...item,
                                                ip: val,
                                                mask:
                                                  !item.mask && isValidIp(val)
                                                    ? '255.255.255.0'
                                                    : item.mask
                                              }
                                            : item
                                        )
                                      }
                                    : d
                                )
                              );
                            }}
                            className="px-2 py-1 rounded text-[11px] font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                          <input
                            type="text"
                            value={iface.mask}
                            placeholder="Subnet mask"
                            onChange={e => {
                              const val = e.target.value;
                              setDevices(prev =>
                                prev.map(d =>
                                  d.id === selectedDevice.id
                                    ? {
                                        ...d,
                                        interfaces: d.interfaces.map(item =>
                                          item.name === iface.name ? { ...item, mask: val } : item
                                        )
                                      }
                                    : d
                                )
                              );
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-mono bg-white dark:bg-slate-950 border text-slate-900 dark:text-white ${
                              iface.mask && !isValidMask(iface.mask)
                                ? 'border-red-400'
                                : 'border-slate-200 dark:border-slate-700'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedLink ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[11px] font-mono text-blue-600 dark:text-cyan-400">
                      Cable Link Properties
                    </p>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {devices.find(d => d.id === selectedLink.fromDeviceId)?.name || 'Src'} ↔{' '}
                      {devices.find(d => d.id === selectedLink.toDeviceId)?.name || 'Dst'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteLink(selectedLink.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    title="Delete cable"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Cable Medium
                  </label>
                  <select
                    value={selectedLink.cableType}
                    onChange={e => {
                      const nextType = e.target.value as SimCableType;
                      commitChange({
                        links: links.map(l =>
                          l.id === selectedLink.id ? { ...l, cableType: nextType } : l
                        )
                      });
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="straight">Copper Straight-Through</option>
                    <option value="crossover">Copper Crossover</option>
                    <option value="fiber">Fiber Optic</option>
                    <option value="serial">Serial WAN (DCE/DTE)</option>
                  </select>
                </div>

                <div className="text-xs font-mono space-y-1 text-slate-600 dark:text-slate-300">
                  <p>Source Port: {selectedLink.fromPort}</p>
                  <p>Target Port: {selectedLink.toPort}</p>
                </div>
              </div>
            ) : selectedShape ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Subnet / Zone Box
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleDeleteShape(selectedShape.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Zone Label
                  </label>
                  <input
                    type="text"
                    value={selectedShape.label || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setShapes(prev =>
                        prev.map(s => (s.id === selectedShape.id ? { ...s, label: val } : s))
                      );
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Shape
                    </label>
                    <select
                      value={selectedShape.kind}
                      onChange={e => {
                        const kind = e.target.value as SimShapeKind;
                        setShapes(prev =>
                          prev.map(s => (s.id === selectedShape.id ? { ...s, kind } : s))
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="rectangle">Rectangle</option>
                      <option value="circle">Ellipse</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Border Style
                    </label>
                    <select
                      value={selectedShape.lineStyle}
                      onChange={e => {
                        const lineStyle = e.target.value as SimShapeLineStyle;
                        setShapes(prev =>
                          prev.map(s => (s.id === selectedShape.id ? { ...s, lineStyle } : s))
                        );
                      }}
                      className="w-full px-2 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="solid">Solid</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Width ({selectedShape.width}px)
                    </label>
                    <input
                      type="range"
                      min={100}
                      max={canvasW - 40}
                      step={10}
                      value={selectedShape.width}
                      onChange={e => {
                        const w = Number(e.target.value);
                        setShapes(prev =>
                          prev.map(s => (s.id === selectedShape.id ? { ...s, width: w } : s))
                        );
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Height ({selectedShape.height}px)
                    </label>
                    <input
                      type="range"
                      min={80}
                      max={canvasH - 40}
                      step={10}
                      value={selectedShape.height}
                      onChange={e => {
                        const h = Number(e.target.value);
                        setShapes(prev =>
                          prev.map(s => (s.id === selectedShape.id ? { ...s, height: h } : s))
                        );
                      }}
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                    Color Theme
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ZONE_COLOR_PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => {
                          setShapes(prev =>
                            prev.map(s =>
                              s.id === selectedShape.id
                                ? {
                                    ...s,
                                    borderColor: p.border,
                                    fillColor: p.fill,
                                    labelColor: p.text
                                  }
                                : s
                            )
                          );
                        }}
                        className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: p.border }}
                        />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedLabel ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Annotation Badge
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleDeleteLabel(selectedLabel.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Annotation Text
                  </label>
                  <input
                    type="text"
                    value={selectedLabel.text}
                    maxLength={120}
                    onChange={e => {
                      const val = e.target.value;
                      setLabels(prev =>
                        prev.map(l => (l.id === selectedLabel.id ? { ...l, text: val } : l))
                      );
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2.5">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Instructor Topology Guide
                </p>
                <p>· Drag devices on the grid to customize placement.</p>
                <p>· Click a device, cable, zone box, or annotation to edit its properties or IPv4 assignments.</p>
                <p>· Use <strong>Connect Cable</strong> to wire new links between devices.</p>
                <p>· You can also click <strong>Import JSON</strong> to load a topology exported from Lab Simulation.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};
