import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  GitBranch,
  GitMerge,
  Layers,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  Scissors,
  Trash2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { exportVlsmTreeToCsv } from '../../utils/exportVlsmCsv';
import { exportVlsmTreeToPng } from '../../utils/exportVlsmImage';
import {
  assignVlsmLeafNode,
  buildVlsmTreeFromDemands,
  findVlsmNodeById,
  mergeVlsmNode,
  parseCidrNotation,
  requiredPrefixForHosts,
  splitVlsmLeafNode,
  summarizeVlsmTree,
  unassignVlsmLeafNode,
  VlsmDepartmentDemand,
  VlsmTreeNode
} from '../../utils/vlsmTree';

type TreeOrientation = 'vertical' | 'horizontal';

interface VlsmHierarchyTreeProps {
  activeCalculatorIp?: string | null;
  activeCalculatorCidr?: number;
  onLoadIntoCalculator?: (ip: string, cidr: number) => void;
}

interface PositionedNode {
  node: VlsmTreeNode;
  depth: number;
  cx: number;
  cy: number;
  x: number;
  y: number;
}

interface PositionedEdge {
  id: string;
  parentId: string;
  childId: string;
  bit: '0' | '1';
  pathD: string;
  labelX: number;
  labelY: number;
  isAllocatedBranch: boolean;
}

interface TreePreset {
  id: string;
  label: string;
  baseCidr: string;
  departments: VlsmDepartmentDemand[];
}

const DEFAULT_DEPARTMENTS: VlsmDepartmentDemand[] = [
  { id: 'dept-1', name: 'Engineering Core', hostsRequired: 120 },
  { id: 'dept-2', name: 'Sales & Marketing', hostsRequired: 60 },
  { id: 'dept-3', name: 'IT Infrastructure', hostsRequired: 25 },
  { id: 'dept-4', name: 'Guest Wi-Fi', hostsRequired: 25 },
  { id: 'dept-5', name: 'Point-to-Point WAN', hostsRequired: 2 }
];

const VLSM_PRESETS: TreePreset[] = [
  {
    id: 'campus',
    label: 'Campus LAN (/20)',
    baseCidr: '172.16.0.0/20',
    departments: DEFAULT_DEPARTMENTS
  },
  {
    id: 'branch',
    label: 'Branch Office (/24)',
    baseCidr: '192.168.10.0/24',
    departments: [
      { id: 'b-1', name: 'Workstations', hostsRequired: 100 },
      { id: 'b-2', name: 'Voice VLAN', hostsRequired: 50 },
      { id: 'b-3', name: 'Servers & DMZ', hostsRequired: 24 },
      { id: 'b-4', name: 'Mgmt & WAN', hostsRequired: 6 }
    ]
  },
  {
    id: 'cloud',
    label: 'Cloud VPC (/22)',
    baseCidr: '10.10.0.0/22',
    departments: [
      { id: 'c-1', name: 'App Private Tier', hostsRequired: 400 },
      { id: 'c-2', name: 'Public Load Balancers', hostsRequired: 110 },
      { id: 'c-3', name: 'Database Subnet', hostsRequired: 50 },
      { id: 'c-4', name: 'Transit Gateway', hostsRequired: 12 }
    ]
  }
];

const CARD_W = 196;
const CARD_H = 104;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

function computeBinaryTreeLayout(
  root: VlsmTreeNode | null,
  orientation: TreeOrientation
): {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
} {
  if (!root) {
    return { nodes: [], edges: [], width: 600, height: 240 };
  }

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  const padX = 28;
  const padY = 24;
  let leafIndex = 0;
  let maxDepth = 0;

  if (orientation === 'vertical') {
    const slotX = CARD_W + 24;
    const levelY = CARD_H + 54;

    const place = (node: VlsmTreeNode, depth: number): PositionedNode => {
      if (depth > maxDepth) maxDepth = depth;
      const cy = padY + depth * levelY + CARD_H / 2;

      if (!node.children) {
        const cx = padX + leafIndex * slotX + CARD_W / 2;
        leafIndex += 1;
        const placed: PositionedNode = {
          node,
          depth,
          cx,
          cy,
          x: cx - CARD_W / 2,
          y: cy - CARD_H / 2
        };
        nodes.push(placed);
        return placed;
      }

      const leftPlaced = place(node.children[0], depth + 1);
      const rightPlaced = place(node.children[1], depth + 1);
      const cx = (leftPlaced.cx + rightPlaced.cx) / 2;

      const placed: PositionedNode = {
        node,
        depth,
        cx,
        cy,
        x: cx - CARD_W / 2,
        y: cy - CARD_H / 2
      };
      nodes.push(placed);

      const startX = cx;
      const startY = cy + CARD_H / 2;

      [
        { child: leftPlaced, bit: '0' as const },
        { child: rightPlaced, bit: '1' as const }
      ].forEach(({ child, bit }) => {
        const endX = child.cx;
        const endY = child.cy - CARD_H / 2;
        const midY = (startY + endY) / 2;
        const pathD = `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;

        // Evaluate cubic Bezier near t = 0.62 so the '0' and '1' bit labels sit clearly on each branch
        const t = 0.62;
        const inv = 1 - t;
        const labelX =
          inv * inv * inv * startX +
          3 * inv * inv * t * startX +
          3 * inv * t * t * endX +
          t * t * t * endX;
        const labelY =
          inv * inv * inv * startY +
          3 * inv * inv * t * midY +
          3 * inv * t * t * midY +
          t * t * t * endY;

        edges.push({
          id: `${node.id}->${child.node.id}`,
          parentId: node.id,
          childId: child.node.id,
          bit,
          pathD,
          labelX,
          labelY,
          isAllocatedBranch: child.node.status === 'allocated'
        });
      });

      return placed;
    };

    place(root, 0);

    const width = Math.max(760, padX * 2 + Math.max(1, leafIndex) * slotX - 24);
    const height = Math.max(260, padY * 2 + (maxDepth + 1) * levelY - 54);
    return { nodes, edges, width, height };
  }

  // Horizontal (Left-to-Right) layout
  const slotY = CARD_H + 22;
  const levelX = CARD_W + 76;

  const placeH = (node: VlsmTreeNode, depth: number): PositionedNode => {
    if (depth > maxDepth) maxDepth = depth;
    const cx = padX + depth * levelX + CARD_W / 2;

    if (!node.children) {
      const cy = padY + leafIndex * slotY + CARD_H / 2;
      leafIndex += 1;
      const placed: PositionedNode = {
        node,
        depth,
        cx,
        cy,
        x: cx - CARD_W / 2,
        y: cy - CARD_H / 2
      };
      nodes.push(placed);
      return placed;
    }

    const leftPlaced = placeH(node.children[0], depth + 1);
    const rightPlaced = placeH(node.children[1], depth + 1);
    const cy = (leftPlaced.cy + rightPlaced.cy) / 2;

    const placed: PositionedNode = {
      node,
      depth,
      cx,
      cy,
      x: cx - CARD_W / 2,
      y: cy - CARD_H / 2
    };
    nodes.push(placed);

    const startX = cx + CARD_W / 2;
    const startY = cy;

    [
      { child: leftPlaced, bit: '0' as const },
      { child: rightPlaced, bit: '1' as const }
    ].forEach(({ child, bit }) => {
      const endX = child.cx - CARD_W / 2;
      const endY = child.cy;
      const midX = (startX + endX) / 2;
      const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

      const t = 0.62;
      const inv = 1 - t;
      const labelX =
        inv * inv * inv * startX +
        3 * inv * inv * t * midX +
        3 * inv * t * t * midX +
        t * t * t * endX;
      const labelY =
        inv * inv * inv * startY +
        3 * inv * inv * t * startY +
        3 * inv * t * t * endY +
        t * t * t * endY;

      edges.push({
        id: `${node.id}->${child.node.id}`,
        parentId: node.id,
        childId: child.node.id,
        bit,
        pathD,
        labelX,
        labelY,
        isAllocatedBranch: child.node.status === 'allocated'
      });
    });

    return placed;
  };

  placeH(root, 0);

  const width = Math.max(760, padX * 2 + (maxDepth + 1) * levelX - 76);
  const height = Math.max(260, padY * 2 + Math.max(1, leafIndex) * slotY - 22);
  return { nodes, edges, width, height };
}

export const VlsmHierarchyTree: React.FC<VlsmHierarchyTreeProps> = ({
  activeCalculatorIp,
  activeCalculatorCidr,
  onLoadIntoCalculator
}) => {
  const [baseCidrInput, setBaseCidrInput] = useState('172.16.0.0/20');
  const [departments, setDepartments] = useState<VlsmDepartmentDemand[]>(DEFAULT_DEPARTMENTS);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptHosts, setNewDeptHosts] = useState<string>('14');

  const [orientation, setOrientation] = useState<TreeOrientation>('vertical');
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isCustomTree, setIsCustomTree] = useState<boolean>(false);
  const [customResult, setCustomResult] = useState<{
    root: VlsmTreeNode | null;
    unassignedDemands: VlsmDepartmentDemand[];
  } | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [assigningNodeId, setAssigningNodeId] = useState<string | null>(null);
  const [assignLabelInput, setAssignLabelInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [csvExportDone, setCsvExportDone] = useState<boolean>(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<number>(zoom);
  zoomRef.current = zoom;
  const suppressNodeClickRef = useRef<boolean>(false);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  } | null>(null);

  const autoResult = useMemo(
    () => buildVlsmTreeFromDemands(baseCidrInput, departments),
    [baseCidrInput, departments]
  );

  const activeTree = isCustomTree && customResult ? customResult : autoResult;
  const parsedBase = useMemo(() => parseCidrNotation(baseCidrInput), [baseCidrInput]);

  const summary = useMemo(
    () => summarizeVlsmTree(activeTree.root, activeTree.unassignedDemands),
    [activeTree]
  );

  const layout = useMemo(
    () => computeBinaryTreeLayout(activeTree.root, orientation),
    [activeTree.root, orientation]
  );

  const applyZoom = useCallback((nextZoomRaw: number, anchorX?: number, anchorY?: number) => {
    const clamped = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.round(nextZoomRaw * 100) / 100)
    );
    const el = viewportRef.current;
    const prevZoom = zoomRef.current;

    if (!el || prevZoom <= 0 || clamped === prevZoom) {
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
      const targetEl = viewportRef.current;
      if (!targetEl) return;
      targetEl.scrollLeft = Math.max(0, contentX * clamped - ax);
      targetEl.scrollTop = Math.max(0, contentY * clamped - ay);
    });
  }, []);

  const handleFitToView = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const availableW = Math.max(200, el.clientWidth - 24);
    const availableH = Math.max(200, el.clientHeight - 24);
    const fitScale = Math.min(availableW / layout.width, availableH / layout.height);
    const clampedFit = Math.max(
      MIN_ZOOM,
      Math.min(1, Math.floor(fitScale * 100) / 100)
    );
    zoomRef.current = clampedFit;
    setZoom(clampedFit);
    window.requestAnimationFrame(() => {
      const targetEl = viewportRef.current;
      if (!targetEl) return;
      targetEl.scrollLeft = 0;
      targetEl.scrollTop = 0;
    });
  }, [layout.width, layout.height]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      const step = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
      applyZoom(zoomRef.current + step, anchorX, anchorY);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [applyZoom, activeTree.root]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, a, select, textarea')) return;

    const el = viewportRef.current;
    if (!el) return;

    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false
    };

    const handleMouseMove = (moveEvt: MouseEvent) => {
      const drag = panDragRef.current;
      const scroller = viewportRef.current;
      if (!drag || !scroller) return;

      const dx = moveEvt.clientX - drag.startX;
      const dy = moveEvt.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 4) {
        drag.moved = true;
        setIsPanning(true);
      }

      if (drag.moved) {
        scroller.scrollLeft = drag.scrollLeft - dx;
        scroller.scrollTop = drag.scrollTop - dy;
      }
    };

    const handleMouseUp = () => {
      const drag = panDragRef.current;
      panDragRef.current = null;
      setIsPanning(false);
      if (drag?.moved) {
        suppressNodeClickRef.current = true;
        window.setTimeout(() => {
          suppressNodeClickRef.current = false;
        }, 0);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (!activeTree.root) {
      setSelectedNodeId(null);
      return;
    }
    const existing = findVlsmNodeById(activeTree.root, selectedNodeId);
    if (!existing) {
      setSelectedNodeId(activeTree.root.id);
    }
  }, [activeTree.root, selectedNodeId]);

  const selectedNode = useMemo(
    () => findVlsmNodeById(activeTree.root, selectedNodeId),
    [activeTree.root, selectedNodeId]
  );

  const handleApplyPreset = (preset: TreePreset) => {
    setIsCustomTree(false);
    setCustomResult(null);
    setBaseCidrInput(preset.baseCidr);
    setDepartments(preset.departments);
    setAssigningNodeId(null);
  };

  const handleSyncFromCalculator = () => {
    if (!activeCalculatorIp || typeof activeCalculatorCidr !== 'number') return;
    const clampedPrefix = Math.min(30, Math.max(8, activeCalculatorCidr));
    const parsed = parseCidrNotation(`${activeCalculatorIp}/${clampedPrefix}`);
    if (!parsed) return;
    setIsCustomTree(false);
    setCustomResult(null);
    setBaseCidrInput(`${parsed.cleanInputIp}/${parsed.prefix}`);
    setAssigningNodeId(null);
  };

  const handleStartFreshRoot = () => {
    if (!parsedBase) return;
    const fresh = buildVlsmTreeFromDemands(baseCidrInput, []);
    setCustomResult(fresh);
    setIsCustomTree(true);
    setSelectedNodeId(fresh.root?.id ?? null);
    setAssigningNodeId(null);
  };

  const handleRebuildFromDepartments = () => {
    setIsCustomTree(false);
    setCustomResult(null);
    setAssigningNodeId(null);
  };

  const handleSplitNode = (nodeId: string) => {
    if (!activeTree.root) return;
    const nextRoot = splitVlsmLeafNode(activeTree.root, nodeId);
    setCustomResult({
      root: nextRoot,
      unassignedDemands: isCustomTree ? activeTree.unassignedDemands : []
    });
    setIsCustomTree(true);
    setSelectedNodeId(nodeId);
    setAssigningNodeId(null);
  };

  const handleMergeNode = (nodeId: string) => {
    if (!activeTree.root) return;
    const nextRoot = mergeVlsmNode(activeTree.root, nodeId);
    setCustomResult({
      root: nextRoot,
      unassignedDemands: isCustomTree ? activeTree.unassignedDemands : []
    });
    setIsCustomTree(true);
    setSelectedNodeId(nodeId);
    setAssigningNodeId(null);
  };

  const handleConfirmAssignNode = (nodeId: string) => {
    if (!activeTree.root) return;
    const nextRoot = assignVlsmLeafNode(
      activeTree.root,
      nodeId,
      assignLabelInput || 'Custom Segment'
    );
    setCustomResult({
      root: nextRoot,
      unassignedDemands: isCustomTree ? activeTree.unassignedDemands : []
    });
    setIsCustomTree(true);
    setAssigningNodeId(null);
    setAssignLabelInput('');
  };

  const handleReleaseNode = (nodeId: string) => {
    if (!activeTree.root) return;
    const nextRoot = unassignVlsmLeafNode(activeTree.root, nodeId);
    setCustomResult({
      root: nextRoot,
      unassignedDemands: isCustomTree ? activeTree.unassignedDemands : []
    });
    setIsCustomTree(true);
  };

  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newDeptName.trim();
    const hosts = Math.max(1, Math.min(16777214, Math.floor(Number(newDeptHosts) || 0)));
    if (!cleanName || !hosts) return;
    setIsCustomTree(false);
    setCustomResult(null);
    setDepartments(prev => [
      ...prev,
      { id: `dept-${Date.now()}`, name: cleanName, hostsRequired: hosts }
    ]);
    setNewDeptName('');
    setNewDeptHosts('14');
  };

  const handleUpdateDepartmentHosts = (id: string, value: string) => {
    const parsed = Math.max(1, Math.min(16777214, Math.floor(Number(value) || 1)));
    setIsCustomTree(false);
    setCustomResult(null);
    setDepartments(prev =>
      prev.map(d => (d.id === id ? { ...d, hostsRequired: parsed } : d))
    );
  };

  const handleRemoveDepartment = (id: string) => {
    setIsCustomTree(false);
    setCustomResult(null);
    setDepartments(prev => prev.filter(d => d.id !== id));
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1800);
  };

  const handleExportImage = async () => {
    if (!activeTree.root || !summary || isExporting) return;
    setIsExporting(true);
    setExportStatus('idle');
    try {
      const isDark = document.documentElement.classList.contains('dark');
      await exportVlsmTreeToPng({
        nodes: layout.nodes.map(n => ({ node: n.node, x: n.x, y: n.y })),
        edges: layout.edges.map(e => ({
          id: e.id,
          bit: e.bit,
          pathD: e.pathD,
          labelX: e.labelX,
          labelY: e.labelY,
          isAllocatedBranch: e.isAllocatedBranch
        })),
        treeWidth: layout.width,
        treeHeight: layout.height,
        cardWidth: CARD_W,
        cardHeight: CARD_H,
        summary,
        modeLabel: isCustomTree ? 'Interactive Manual Tree' : 'Largest-First Auto VLSM',
        isDarkTheme: isDark
      });
      setExportStatus('done');
      window.setTimeout(() => setExportStatus('idle'), 2200);
    } catch {
      setExportStatus('error');
      window.setTimeout(() => setExportStatus('idle'), 2600);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (!activeTree.root || !summary) return;
    exportVlsmTreeToCsv(activeTree.root, summary);
    setCsvExportDone(true);
    window.setTimeout(() => setCsvExportDone(false), 2200);
  };

  return (
    <section
      aria-label="VLSM Hierarchy Tree Visualizer"
      className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 min-w-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/70 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-cyan-400 shrink-0">
            <GitBranch className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                VLSM Hierarchy Tree Visualizer
              </h2>
              {summary && (
                <span className="text-xs font-mono tabular-nums text-blue-600 dark:text-cyan-400 font-semibold">
                  {summary.baseCidrLabel} · {summary.allocatedLeaves.length} allocated ·{' '}
                  {summary.freeLeaves.length} available
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Watch how supernets split down binary 0/1 boundaries as you allocate departments or manually divide any subnet block.
            </p>
          </div>
        </div>

        {/* Presets & Mode Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {VLSM_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                !isCustomTree && baseCidrInput.trim() === preset.baseCidr
                  ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-cyan-700 text-blue-700 dark:text-cyan-300 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Supernet Input & Department Planner */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-w-0">
        {/* Left: Supernet Config + Department Demands */}
        <div className="xl:col-span-4 min-w-0 space-y-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="vlsm-base-cidr"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Base Supernet (CIDR)
              </label>
              {activeCalculatorIp && typeof activeCalculatorCidr === 'number' && (
                <button
                  type="button"
                  onClick={handleSyncFromCalculator}
                  className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Calculator className="w-3 h-3" />
                  <span>Use /{Math.min(30, Math.max(8, activeCalculatorCidr))} from Calc</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="vlsm-base-cidr"
                type="text"
                value={baseCidrInput}
                onChange={e => {
                  setIsCustomTree(false);
                  setCustomResult(null);
                  setBaseCidrInput(e.target.value);
                }}
                placeholder="e.g. 172.16.0.0/20"
                className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-slate-900 border text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 ${
                  parsedBase
                    ? 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                    : 'border-red-400 dark:border-red-500 focus:ring-red-500'
                }`}
              />
              <button
                type="button"
                disabled={!parsedBase}
                onClick={handleStartFreshRoot}
                title="Reset to a single unsplit root block for manual binary splitting"
                className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 disabled:opacity-40 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
              >
                Blank Root
              </button>
            </div>

            {!parsedBase && (
              <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Enter valid IPv4/CIDR between /8 and /30 (e.g. 172.16.0.0/20).</span>
              </p>
            )}
          </div>

          {/* Department Host Requirements */}
          <div className="space-y-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Network Segments ({departments.length})
              </span>
              {isCustomTree && (
                <button
                  type="button"
                  onClick={handleRebuildFromDepartments}
                  className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Auto-Allocate Plan</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
              {departments.map(dept => {
                const reqPrefix = requiredPrefixForHosts(dept.hostsRequired);
                return (
                  <div
                    key={dept.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <span className="flex-1 min-w-0 font-medium text-slate-800 dark:text-slate-200 truncate">
                      {dept.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      /{reqPrefix}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={16777214}
                      value={dept.hostsRequired}
                      onChange={e => handleUpdateDepartmentHosts(dept.id, e.target.value)}
                      aria-label={`Required hosts for ${dept.name}`}
                      className="w-16 sm:w-20 px-2 py-1 rounded-md font-mono tabular-nums text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-[10px] sm:text-[11px] text-slate-400 shrink-0">hosts</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDepartment(dept.id)}
                      aria-label={`Remove ${dept.name}`}
                      className="p-1 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleAddDepartment} className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
              <input
                type="text"
                value={newDeptName}
                onChange={e => setNewDeptName(e.target.value)}
                placeholder="New segment (e.g. VoIP)"
                aria-label="New segment name"
                className="w-full sm:w-auto sm:flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <input
                  type="number"
                  min={1}
                  max={16777214}
                  value={newDeptHosts}
                  onChange={e => setNewDeptHosts(e.target.value)}
                  aria-label="Hosts needed for new segment"
                  className="flex-1 sm:flex-none sm:w-16 px-2 py-1.5 rounded-lg text-xs font-mono tabular-nums text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newDeptName.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Utilization Summary + Interactive Binary Tree Canvas */}
        <div className="xl:col-span-8 space-y-4 min-w-0">
          {/* Address Utilization Strip & Tree Controls */}
          <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums min-w-0">
                <span className="text-slate-600 dark:text-slate-300">
                  Mode:{' '}
                  <strong className="text-slate-900 dark:text-white font-sans">
                    {isCustomTree ? 'Interactive Manual Tree' : 'Largest-First Auto VLSM'}
                  </strong>
                </span>
                {summary && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      Allocated:{' '}
                      <strong className="text-blue-600 dark:text-cyan-400">
                        {summary.allocatedAddresses.toLocaleString()}
                      </strong>{' '}
                      / {summary.totalSupernetAddresses.toLocaleString()} IPs ({summary.utilizationPercent}%)
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Orientation Toggle */}
                <div
                  role="group"
                  aria-label="Tree layout orientation"
                  className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => setOrientation('vertical')}
                    aria-pressed={orientation === 'vertical'}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all ${
                      orientation === 'vertical'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    <span>Top-Down</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('horizontal')}
                    aria-pressed={orientation === 'horizontal'}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-all ${
                      orientation === 'horizontal'
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <ArrowDownUp className="w-3 h-3 rotate-90" />
                    <span>Left-Right</span>
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono tabular-nums">
                  <button
                    type="button"
                    disabled={zoom <= MIN_ZOOM}
                    onClick={() => applyZoom(zoom - ZOOM_STEP)}
                    aria-label="Zoom out VLSM tree"
                    title="Zoom out (Ctrl + Scroll down)"
                    className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyZoom(1)}
                    className="px-1.5 text-slate-700 dark:text-slate-200 font-semibold hover:text-blue-600 dark:hover:text-cyan-400"
                    title="Reset zoom to 100%"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    disabled={zoom >= MAX_ZOOM}
                    onClick={() => applyZoom(zoom + ZOOM_STEP)}
                    aria-label="Zoom in VLSM tree"
                    title="Zoom in (Ctrl + Scroll up)"
                    className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={handleFitToView}
                    aria-label="Fit VLSM tree to viewport"
                    title="Fit entire tree to view"
                    className="px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 font-sans font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Fit</span>
                  </button>
                </div>

                {/* Export to PNG Image */}
                <button
                  type="button"
                  disabled={!activeTree.root || !summary || isExporting}
                  onClick={handleExportImage}
                  aria-label="Export VLSM hierarchy tree as PNG image"
                  title="Download full VLSM hierarchy tree as a high-resolution PNG"
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-500 disabled:opacity-45 disabled:cursor-not-allowed text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : exportStatus === 'done' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Exported PNG</span>
                    </>
                  ) : exportStatus === 'error' ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Retry Export</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Export Image</span>
                    </>
                  )}
                </button>

                {/* Export to CSV */}
                <button
                  type="button"
                  disabled={!activeTree.root || !summary}
                  onClick={handleExportCsv}
                  aria-label="Export VLSM hierarchy as CSV file"
                  title="Download VLSM hierarchy table as CSV (Subnet Address, CIDR, Broadcast, Host Range)"
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-cyan-500 disabled:opacity-45 disabled:cursor-not-allowed text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {csvExportDone ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Exported CSV</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {summary && (
              <div className="space-y-1.5">
                <div
                  role="progressbar"
                  aria-valuenow={summary.utilizationPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Supernet address utilization"
                  className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, summary.utilizationPercent)}%` }}
                  />
                </div>

                {/* Unboxed Legend */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-slate-400 dark:bg-slate-500 shrink-0" />
                    <span>Split Branch (Parent)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[2px] bg-blue-600 dark:bg-cyan-400 shrink-0" />
                    <span>Allocated Subnet</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[2px] border border-dashed border-emerald-500 shrink-0" />
                    <span>Available Block (Click Split ÷2)</span>
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-mono">
                    Branches show 0 / 1 binary split bits
                  </span>
                </div>
              </div>
            )}

            {activeTree.unassignedDemands.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Insufficient address space in <strong className="font-mono">{baseCidrInput}</strong> for:{' '}
                  {activeTree.unassignedDemands
                    .map(d => `${d.name} (${d.hostsRequired} hosts)`)
                    .join(', ')}
                  . Choose a larger supernet (smaller prefix) or reduce host requirements.
                </span>
              </div>
            )}
          </div>

          {/* Interactive Tree Viewport */}
          {activeTree.root ? (
            <div className="relative w-full max-w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-[#070b14] overflow-hidden">
              <div
                ref={viewportRef}
                onMouseDown={handleCanvasMouseDown}
                className={`w-full overflow-auto max-h-[540px] min-h-[340px] select-none ${
                  isPanning ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                <div className="min-w-full w-max p-3 pb-14">
                  <div
                    className="mx-auto"
                    style={{
                      width: Math.ceil(layout.width * zoom),
                      height: Math.ceil(layout.height * zoom),
                      position: 'relative'
                    }}
                  >
                    <div
                      style={{
                        width: layout.width,
                        height: layout.height,
                        transform: `scale(${zoom})`,
                        transformOrigin: 'top left',
                        position: 'relative'
                      }}
                    >
                      {/* SVG Edges & Binary Bit Labels */}
                      <svg
                        width={layout.width}
                        height={layout.height}
                        className="absolute inset-0 pointer-events-none"
                        aria-hidden="true"
                      >
                    {layout.edges.map(edge => {
                      const strokeClass = edge.isAllocatedBranch
                        ? 'stroke-blue-500/75 dark:stroke-cyan-400/70'
                        : 'stroke-slate-300 dark:stroke-slate-700';

                      return (
                        <g key={edge.id}>
                          <path
                            d={edge.pathD}
                            fill="none"
                            strokeWidth={edge.isAllocatedBranch ? 2 : 1.5}
                            className={strokeClass}
                          />
                          <circle
                            cx={edge.labelX}
                            cy={edge.labelY}
                            r={10}
                            className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700"
                            strokeWidth={1}
                          />
                          <text
                            x={edge.labelX}
                            y={edge.labelY + 3.5}
                            textAnchor="middle"
                            className="fill-slate-700 dark:fill-slate-200 font-mono text-[10px] font-bold"
                          >
                            {edge.bit}
                          </text>
                        </g>
                      );
                    })}
                  </svg>

                  {/* Node Cards */}
                  {layout.nodes.map(({ node, x, y }) => {
                    const isSelected = selectedNodeId === node.id;
                    const isAllocated = node.status === 'allocated';
                    const isSplit = node.status === 'split';
                    const isFree = node.status === 'free';
                    const isAssigning = assigningNodeId === node.id;

                    let cardClasses =
                      'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700';
                    if (isAllocated) {
                      cardClasses =
                        'bg-blue-50/70 dark:bg-blue-950/35 border border-blue-300 dark:border-cyan-700/70';
                    } else if (isFree) {
                      cardClasses =
                        'bg-white dark:bg-[#0c1220] border border-dashed border-emerald-400 dark:border-emerald-600/70';
                    }

                    const ringClass = isSelected
                      ? 'ring-2 ring-blue-600 dark:ring-cyan-400 shadow-md'
                      : 'shadow-xs hover:shadow-md';

                    return (
                      <div
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (suppressNodeClickRef.current) return;
                          setSelectedNodeId(node.id);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedNodeId(node.id);
                          }
                        }}
                        style={{
                          position: 'absolute',
                          left: x,
                          top: y,
                          width: CARD_W,
                          height: CARD_H
                        }}
                        className={`rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-shadow text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${cardClasses} ${ringClass}`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-[10px] font-semibold truncate ${
                                isAllocated
                                  ? 'text-blue-700 dark:text-cyan-300'
                                  : isFree
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {isAllocated
                                ? node.assignedName || 'Allocated'
                                : isSplit
                                ? 'Split Branch'
                                : 'Available Block'}
                            </span>
                            {node.branchBit && (
                              <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                                bit {node.branchBit}
                              </span>
                            )}
                          </div>

                          <p className="font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-white truncate">
                            {node.cidrLabel}
                          </p>

                          <p className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400 truncate">
                            {isAllocated && node.hostsRequired
                              ? `${node.hostsRequired} req / ${node.stats.usableHosts} usable`
                              : `${node.stats.usableHosts.toLocaleString()} usable · ${node.stats.totalAddresses.toLocaleString()} IPs`}
                          </p>
                        </div>

                        {/* Interactive Node Action Footer */}
                        {isAssigning ? (
                          <div
                            className="flex items-center gap-1 pt-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              autoFocus
                              value={assignLabelInput}
                              onChange={e => setAssignLabelInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  handleConfirmAssignNode(node.id);
                                } else if (e.key === 'Escape') {
                                  setAssigningNodeId(null);
                                }
                              }}
                              placeholder="Segment name"
                              className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-[10px] text-slate-900 dark:text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleConfirmAssignNode(node.id)}
                              aria-label="Confirm subnet assignment"
                              className="p-1 rounded bg-blue-600 text-white hover:bg-blue-500 shrink-0"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-between gap-1 pt-1 border-t border-slate-200/70 dark:border-slate-800"
                            onClick={e => e.stopPropagation()}
                          >
                            {isFree && (
                              <>
                                <button
                                  type="button"
                                  disabled={node.prefix >= 32}
                                  onClick={() => handleSplitNode(node.id)}
                                  title={`Split ${node.cidrLabel} into two /${node.prefix + 1} subnets`}
                                  className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                >
                                  <Scissors className="w-2.5 h-2.5" />
                                  <span>Split ÷2</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningNodeId(node.id);
                                    setAssignLabelInput('');
                                  }}
                                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-[10px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
                                >
                                  Assign
                                </button>
                              </>
                            )}

                            {isSplit && (
                              <>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                                  2 × /{node.prefix + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleMergeNode(node.id)}
                                  title={`Collapse children back into ${node.cidrLabel}`}
                                  className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:border-amber-500 text-[10px] font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                                >
                                  <GitMerge className="w-2.5 h-2.5" />
                                  <span>Merge</span>
                                </button>
                              </>
                            )}

                            {isAllocated && (
                              <>
                                <span className="text-[10px] font-mono text-blue-700 dark:text-cyan-300 truncate">
                                  {node.stats.firstHost}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleReleaseNode(node.id)}
                                  title="Release subnet back to Available"
                                  className="px-1.5 py-0.5 rounded border border-blue-200 dark:border-cyan-800 hover:border-red-400 text-[10px] font-semibold text-blue-700 dark:text-cyan-300 hover:text-red-600 dark:hover:text-red-400 whitespace-nowrap shrink-0"
                                >
                                  Release
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pinned Canvas Zoom & Pan HUD */}
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 z-10">
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400 shadow-xs">
                  Drag canvas to pan · Ctrl + Scroll to zoom
                </span>

                <div className="pointer-events-auto ml-auto inline-flex items-center gap-1 px-1.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 shadow-md text-[11px] font-mono tabular-nums">
                  <button
                    type="button"
                    disabled={zoom <= MIN_ZOOM}
                    onClick={() => applyZoom(zoom - ZOOM_STEP)}
                    aria-label="Canvas zoom out"
                    title="Zoom out"
                    className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => applyZoom(1)}
                    title="Reset zoom to 100%"
                    className="px-1.5 py-0.5 rounded-lg text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    disabled={zoom >= MAX_ZOOM}
                    onClick={() => applyZoom(zoom + ZOOM_STEP)}
                    aria-label="Canvas zoom in"
                    title="Zoom in"
                    className="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <span className="h-3.5 w-px bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={handleFitToView}
                    aria-label="Fit tree to canvas"
                    title="Fit entire tree to view"
                    className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400 font-sans font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Fit</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Enter a valid base supernet (e.g. 172.16.0.0/20) to render the VLSM hierarchy tree.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Selected Node Inspector + Allocation Table */}
      {selectedNode && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-slate-100 dark:border-slate-800 min-w-0">
          {/* Selected Subnet Block Details */}
          <div className="lg:col-span-5 min-w-0 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                  Selected Tree Node
                </span>
                <h3 className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-white break-words">
                  {selectedNode.cidrLabel}
                  {selectedNode.assignedName ? ` · ${selectedNode.assignedName}` : ''}
                </h3>
              </div>

              {onLoadIntoCalculator && (
                <button
                  type="button"
                  onClick={() =>
                    onLoadIntoCalculator(selectedNode.stats.networkStr, selectedNode.prefix)
                  }
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>Inspect in CIDR Calc</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs border-t border-slate-200/70 dark:border-slate-800 pt-2.5 min-w-0">
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Subnet Mask
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 break-words">
                  {selectedNode.stats.maskStr}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Wildcard Mask
                </span>
                <span className="font-mono font-semibold tabular-nums text-amber-600 dark:text-amber-400 break-words">
                  {selectedNode.stats.wildcardStr}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Usable Range
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 break-words">
                  {selectedNode.stats.firstHost} – {selectedNode.stats.lastHost}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Broadcast Address
                </span>
                <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 break-words">
                  {selectedNode.stats.broadcastStr}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span className="break-words">
                Binary Split Path:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {selectedNode.binaryPath ? `Root → ${selectedNode.binaryPath.split('').join(' → ')}` : 'Root Supernet'}
                </strong>
              </span>
              <span>{selectedNode.stats.usableHosts.toLocaleString()} usable hosts</span>
            </div>
          </div>

          {/* Allocated Subnets Allocation Schedule Table */}
          <div className="lg:col-span-7 min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Allocated VLSM Subnet Table ({summary.allocatedLeaves.length})
              </span>
              <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {summary.freeLeaves.length} free block{summary.freeLeaves.length === 1 ? '' : 's'} remaining
              </span>
            </div>

            {summary.allocatedLeaves.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No subnets allocated yet. Click <strong>Assign</strong> or <strong>Split ÷2</strong> on any available node in the tree, or click <strong>Auto-Allocate Plan</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 dark:bg-slate-900/40 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Segment</th>
                      <th className="py-2 px-3 font-semibold">Network / CIDR</th>
                      <th className="py-2 px-3 font-semibold">Subnet Mask</th>
                      <th className="py-2 px-3 font-semibold">Usable Range</th>
                      <th className="py-2 px-3 font-semibold text-right">Hosts</th>
                      <th className="py-2 px-3 font-semibold text-right">Copy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {summary.allocatedLeaves.map(leaf => (
                      <tr
                        key={leaf.id}
                        onClick={() => setSelectedNodeId(leaf.id)}
                        className={`cursor-pointer transition-colors ${
                          selectedNodeId === leaf.id
                            ? 'bg-blue-50/70 dark:bg-blue-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {leaf.assignedName}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-blue-600 dark:text-cyan-400 font-semibold whitespace-nowrap">
                          {leaf.cidrLabel}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {leaf.stats.maskStr}
                        </td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {leaf.stats.firstHost} – {leaf.stats.lastHost}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {leaf.hostsRequired
                            ? `${leaf.hostsRequired}/${leaf.stats.usableHosts}`
                            : leaf.stats.usableHosts}
                        </td>
                        <td
                          className="py-2 px-3 text-right whitespace-nowrap"
                          onClick={e => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                `${leaf.stats.networkStr} ${leaf.stats.maskStr}`,
                                leaf.id
                              )
                            }
                            aria-label={`Copy ${leaf.cidrLabel} IP and mask`}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400"
                          >
                            {copiedId === leaf.id ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
