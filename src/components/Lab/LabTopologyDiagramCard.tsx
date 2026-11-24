import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  Download,
  FileCode,
  FileJson,
  Image as ImageIcon,
  Maximize2,
  Pencil,
  Terminal,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { LabExerciseTopology } from '../../data/labExerciseTopologies';
import {
  computeCableGeometry,
  evaluateLinkStatus,
  getLinkConnectorEndpoints,
  isValidIp,
  maskToPrefix
} from './networkSimEngine';
import { SimCableType } from './networkSimTypes';
import { CiscoDeviceIcon } from './CiscoDeviceIcon';
import {
  exportTopologyAsPng,
  exportTopologyAsSvg
} from '../../utils/topologyImageExport';
import {
  buildTopologyJsonPayload,
  triggerTopologyJsonDownload
} from '../../utils/topologyJson';
import { useAcademy } from '../../context/AcademyContext';

interface LabTopologyDiagramCardProps {
  labNumber: number;
  labTitle: string;
  topologySummary: string;
  topology: LabExerciseTopology;
  canEdit: boolean;
  onEditTopology?: () => void;
  onLaunchSimulator?: () => void;
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

export const LabTopologyDiagramCard: React.FC<LabTopologyDiagramCardProps> = ({
  labNumber,
  labTitle,
  topologySummary,
  topology,
  canEdit,
  onEditTopology,
  onLaunchSimulator
}) => {
  const { darkMode, currentUser } = useAcademy();
  const [zoom, setZoom] = useState<number>(1);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const canvasW = topology.canvasWidth || 1000;
  const canvasH = topology.canvasHeight || 480;

  const linkStatuses = useMemo(() => {
    const map = new Map<string, { isUp: boolean; reason: string }>();
    topology.links.forEach(link => {
      const st = evaluateLinkStatus(link, topology.devices);
      map.set(link.id, { isUp: st.isUp, reason: st.reason });
    });
    return map;
  }, [topology.links, topology.devices]);

  const selectedDevice = useMemo(
    () => topology.devices.find(d => d.id === selectedDeviceId) || null,
    [topology.devices, selectedDeviceId]
  );

  const selectedLink = useMemo(
    () => topology.links.find(l => l.id === selectedLinkId) || null,
    [topology.links, selectedLinkId]
  );

  const handleExportPng = async () => {
    setIsExporting(true);
    setIsExportMenuOpen(false);
    try {
      await exportTopologyAsPng({
        title: `Lab ${labNumber} - ${labTitle}`,
        subtitle: `${topology.devices.length} devices · ${topology.links.length} links`,
        devices: topology.devices,
        links: topology.links,
        shapes: topology.shapes,
        labels: topology.labels,
        canvasWidth: canvasW,
        canvasHeight: canvasH,
        showCustomLabels: true,
        showGrid: true,
        gridSize: 20,
        gridStyle: 'dots',
        isDark: darkMode
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSvg = () => {
    setIsExportMenuOpen(false);
    exportTopologyAsSvg({
      title: `Lab ${labNumber} - ${labTitle}`,
      subtitle: `${topology.devices.length} devices · ${topology.links.length} links`,
      devices: topology.devices,
      links: topology.links,
      shapes: topology.shapes,
      labels: topology.labels,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
      showCustomLabels: true,
      showGrid: true,
      gridSize: 20,
      gridStyle: 'dots',
      isDark: darkMode
    });
  };

  const handleExportJson = () => {
    setIsExportMenuOpen(false);
    const payload = buildTopologyJsonPayload({
      title: `Lab ${labNumber}: ${labTitle}`,
      status: 'in_progress',
      presetId: topology.labId,
      canvasSize: { width: canvasW, height: canvasH },
      showCustomLabels: true,
      gridSettings: { showGrid: true, snapToGrid: true, gridSize: 20, gridStyle: 'dots' },
      studentEmail: currentUser?.email,
      devices: topology.devices,
      links: topology.links,
      shapes: topology.shapes,
      labels: topology.labels
    });
    triggerTopologyJsonDownload(payload, `lab-${labNumber}-topology.json`);
  };

  return (
    <section className="space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800">
      {/* Section Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
              02. Network Topology Diagram
            </h3>
            <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {topology.devices.length} devices · {topology.links.length} links
            </span>
            {topology.isCustomized && (
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                · Updated{topology.updatedByName ? ` by ${topology.updatedByName}` : ''}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Click any device or cable to inspect interface IPs and link state in Lab Simulation style.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Zoom Controls */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-0.5">
            <button
              type="button"
              onClick={() => setZoom(z => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
              aria-label="Zoom out topology"
              title="Zoom out"
              className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              title="Reset zoom to fit"
              className="px-2 py-0.5 text-[11px] font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-cyan-400"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => setZoom(z => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
              aria-label="Zoom in topology"
              title="Zoom in"
              className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            {zoom !== 1 && (
              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="Fit topology diagram"
                title="Fit to width"
                className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-colors"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              disabled={isExporting}
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            {isExportMenuOpen && (
              <div
                onMouseLeave={() => setIsExportMenuOpen(false)}
                className="absolute right-0 mt-1.5 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-30"
              >
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
                  <span>Export PNG Image</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Export SVG Vector</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-2"
                >
                  <FileJson className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Simulator JSON</span>
                </button>
              </div>
            )}
          </div>

          {canEdit && onEditTopology && (
            <button
              type="button"
              onClick={onEditTopology}
              className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-cyan-800 bg-blue-50/70 dark:bg-cyan-950/40 hover:bg-blue-100 dark:hover:bg-cyan-900/50 text-xs font-semibold text-blue-700 dark:text-cyan-300 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Topology</span>
            </button>
          )}

          {onLaunchSimulator && (
            <button
              type="button"
              onClick={onLaunchSimulator}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Open in Lab Simulator</span>
            </button>
          )}
        </div>
      </div>

      {/* Lab Simulation Style Canvas */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090f1d] overflow-hidden">
        <div className="overflow-auto">
          <div
            onClick={() => {
              setSelectedDeviceId(null);
              setSelectedLinkId(null);
            }}
            style={{
              width: `${Math.round(zoom * 100)}%`,
              minWidth: zoom >= 1 ? '100%' : undefined,
              aspectRatio: `${canvasW} / ${canvasH}`,
              backgroundImage: darkMode
                ? 'radial-gradient(rgba(148,163,184,0.22) 1px, transparent 1px)'
                : 'radial-gradient(rgba(100,116,139,0.25) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
            className="relative mx-auto select-none"
          >
            {/* Layer 1: Zone Boundary Shapes */}
            {topology.shapes.map(shape => {
              const strokeDasharray =
                shape.lineStyle === 'dashed'
                  ? '7 5'
                  : shape.lineStyle === 'dotted'
                  ? '2 4'
                  : undefined;

              return (
                <div
                  key={shape.id}
                  style={{
                    left: `${(shape.x / canvasW) * 100}%`,
                    top: `${(shape.y / canvasH) * 100}%`,
                    width: `${(shape.width / canvasW) * 100}%`,
                    height: `${(shape.height / canvasH) * 100}%`
                  }}
                  className="absolute pointer-events-none z-[1]"
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
                      className="absolute top-2 left-3 text-[11px] font-bold tracking-tight"
                    >
                      {shape.label}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Layer 2: Cables, Link LEDs & Port Labels */}
            <svg
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
            >
              {topology.links.map(link => {
                const fromDev = topology.devices.find(d => d.id === link.fromDeviceId);
                const toDev = topology.devices.find(d => d.id === link.toDeviceId);
                if (!fromDev || !toDev) return null;

                const status = linkStatuses.get(link.id);
                const isUp = Boolean(status?.isUp);
                const meta = CABLE_STYLE[link.cableType];
                const isSelected = selectedLinkId === link.id;

                const endpoints = getLinkConnectorEndpoints(
                  link,
                  fromDev,
                  toDev,
                  topology.links
                );
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
                const fromPortLabel = fromIf?.shortName || link.fromPort;
                const toPortLabel = toIf?.shortName || link.toPort;

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
                        setSelectedLinkId(link.id);
                        setSelectedDeviceId(null);
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
                      strokeOpacity={isUp || isSelected ? 0.95 : 0.7}
                      strokeLinecap="round"
                      strokeLinejoin="miter"
                    />
                    <circle
                      cx={geom.x1Led}
                      cy={geom.y1Led}
                      r={4}
                      fill={isUp ? '#10b981' : '#ef4444'}
                      stroke={darkMode ? '#090f1d' : '#ffffff'}
                      strokeWidth={1.1}
                    />
                    <circle
                      cx={geom.x2Led}
                      cy={geom.y2Led}
                      r={4}
                      fill={isUp ? '#10b981' : '#ef4444'}
                      stroke={darkMode ? '#090f1d' : '#ffffff'}
                      strokeWidth={1.1}
                    />
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
            </svg>

            {/* Layer 3: Devices & Hostname/IP Cards */}
            {topology.devices.map(dev => {
              const isSelected = selectedDeviceId === dev.id;
              const custom = dev.customLabel?.trim();
              const useCustom = Boolean(custom && dev.useCustomLabel !== false);
              const primaryLabel = useCustom && custom ? custom : dev.name;
              const secondaryHostname =
                useCustom && custom && custom !== dev.name ? dev.name : '';
              const primaryIface = dev.interfaces.find(i => isValidIp(i.ip));
              const ipText = primaryIface
                ? `${primaryIface.ip}${
                    isValidIp(primaryIface.mask)
                      ? `/${maskToPrefix(primaryIface.mask)}`
                      : ''
                  }`
                : '';
              const labelOx = dev.labelOffsetX || 0;
              const labelOy = dev.labelOffsetY || 0;

              return (
                <React.Fragment key={dev.id}>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedDeviceId(dev.id);
                      setSelectedLinkId(null);
                    }}
                    style={{
                      left: `${(dev.x / canvasW) * 100}%`,
                      top: `${(dev.y / canvasH) * 100}%`
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-2xl transition-transform cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-blue-500 dark:ring-cyan-400 bg-blue-500/10 dark:bg-cyan-400/15 scale-105 z-20'
                        : 'hover:scale-105 z-10'
                    }`}
                    title={`${dev.name} (${dev.model})`}
                  >
                    <div
                      style={{
                        transform: dev.rotation ? `rotate(${dev.rotation}deg)` : undefined
                      }}
                    >
                      <CiscoDeviceIcon
                        type={dev.type}
                        className="w-12 h-10 sm:w-14 sm:h-12 drop-shadow-[0_4px_8px_rgba(2,6,23,0.28)]"
                      />
                    </div>
                  </button>

                  <div
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedDeviceId(dev.id);
                      setSelectedLinkId(null);
                    }}
                    style={{
                      left: `${((dev.x + labelOx) / canvasW) * 100}%`,
                      top: `${((dev.y + 34 + labelOy) / canvasH) * 100}%`
                    }}
                    className={`absolute -translate-x-1/2 px-2 py-0.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border shadow-xs text-center whitespace-nowrap cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 dark:border-cyan-400 z-20'
                        : 'border-slate-200 dark:border-slate-700 z-[15]'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">
                      {primaryLabel}
                    </div>
                    {secondaryHostname && (
                      <div className="text-[9.5px] font-mono text-slate-400 leading-tight">
                        {secondaryHostname}
                      </div>
                    )}
                    {ipText && (
                      <div className="text-[10px] font-mono tabular-nums text-blue-600 dark:text-cyan-300 leading-tight">
                        {ipText}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            {/* Layer 4: Freeform Annotation Labels */}
            {topology.labels.map(lbl => {
              const hasBg = Boolean(lbl.bgColor && lbl.bgColor !== 'transparent');
              const fontSize = Math.min(20, Math.max(10, Number(lbl.fontSize) || 11));
              return (
                <div
                  key={lbl.id}
                  style={{
                    left: `${(lbl.x / canvasW) * 100}%`,
                    top: `${(lbl.y / canvasH) * 100}%`,
                    color: lbl.color || (darkMode ? '#e2e8f0' : '#0f172a'),
                    backgroundColor: hasBg ? lbl.bgColor : undefined,
                    fontSize: `${fontSize}px`
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg pointer-events-none z-[18] whitespace-nowrap ${
                    hasBg
                      ? 'border border-slate-200/80 dark:border-slate-700/70 shadow-xs'
                      : ''
                  } ${lbl.bold !== false ? 'font-bold' : 'font-medium'} ${
                    lbl.italic ? 'italic' : ''
                  }`}
                >
                  {lbl.text}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Cable Legend & Click-Inspector Strip */}
        <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-400 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#0284c7] inline-block" /> Straight
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-[#0ea5e9] inline-block" /> Crossover
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#f59e0b] inline-block" /> Fiber
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#ef4444] inline-block" /> Serial WAN
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Up
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Down
            </span>
          </div>

          {selectedDevice && (
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-800 dark:text-slate-200">
              <span className="font-bold text-blue-600 dark:text-cyan-400">
                {selectedDevice.name}
              </span>
              <span className="text-slate-400">({selectedDevice.model})</span>
              {selectedDevice.interfaces
                .filter(i => isValidIp(i.ip))
                .slice(0, 3)
                .map(i => (
                  <span
                    key={i.name}
                    className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                  >
                    {i.shortName}: {i.ip}/{maskToPrefix(i.mask)}
                  </span>
                ))}
            </div>
          )}

          {selectedLink && (() => {
            const fromDev = topology.devices.find(d => d.id === selectedLink.fromDeviceId);
            const toDev = topology.devices.find(d => d.id === selectedLink.toDeviceId);
            const st = linkStatuses.get(selectedLink.id);
            return (
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-800 dark:text-slate-200">
                <span className="font-bold text-blue-600 dark:text-cyan-400">
                  {fromDev?.name || 'Src'} ({selectedLink.fromPort})
                </span>
                <span>↔</span>
                <span className="font-bold text-blue-600 dark:text-cyan-400">
                  {toDev?.name || 'Dst'} ({selectedLink.toPort})
                </span>
                <span className="text-slate-400">· {CABLE_STYLE[selectedLink.cableType].label}</span>
                <span className={st?.isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                  · {st?.isUp ? 'Link Up' : st?.reason || 'Link Down'}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Text Topology Path Reference */}
      <p className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-200 break-words">
        {topologySummary}
      </p>
    </section>
  );
};
