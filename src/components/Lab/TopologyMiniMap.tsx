import React, { useId } from 'react';
import { ChevronDown, Map as MapIcon } from 'lucide-react';
import {
  SimCableType,
  SimDevice,
  SimDiagramLabel,
  SimLink,
  SimTopologyShape
} from './networkSimTypes';

const MINI_MAP_CABLE_COLORS: Record<SimCableType, { stroke: string; dash?: string }> = {
  straight: { stroke: '#0284c7' },
  crossover: { stroke: '#0ea5e9', dash: '5 3' },
  fiber: { stroke: '#f59e0b' },
  serial: { stroke: '#ef4444', dash: '3 3' }
};

export interface TopologyMiniMapViewportBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TopologyMiniMapProps {
  canvasWidth: number;
  canvasHeight: number;
  devices: SimDevice[];
  links: SimLink[];
  shapes: SimTopologyShape[];
  diagramLabels: SimDiagramLabel[];
  selectedDeviceIds: string[];
  selectedLinkId: string | null;
  linkStatuses: Map<string, { isUp: boolean }>;
  activeHopLinkId?: string | null;
  viewportBox: TopologyMiniMapViewportBox;
  zoom: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  isDragging: boolean;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onMiniMapPointerDown: (
    e: React.PointerEvent<SVGSVGElement>,
    svgRect: DOMRect
  ) => void;
}

export const TopologyMiniMap: React.FC<TopologyMiniMapProps> = ({
  canvasWidth,
  canvasHeight,
  devices,
  links,
  shapes,
  diagramLabels,
  selectedDeviceIds,
  selectedLinkId,
  linkStatuses,
  activeHopLinkId,
  viewportBox,
  zoom,
  isOpen,
  onToggleOpen,
  isDragging,
  svgRef,
  onMiniMapPointerDown
}) => {
  const uid = useId();
  const gridPatternId = `minimap-grid-${uid}`;
  const selectedSet = new Set(selectedDeviceIds);
  const deviceById = new Map(devices.map(d => [d.id, d]));

  // Keep marker sizing legible regardless of how large the logical workspace grows
  const scale = Math.max(1, canvasWidth / 1000);
  const gridStep = Math.max(250, Math.round((canvasWidth / 6) / 50) * 50);

  // Clamp visible viewport rectangle to workspace bounds for the scrim cutout
  const vx1 = Math.max(0, Math.min(canvasWidth, viewportBox.x));
  const vy1 = Math.max(0, Math.min(canvasHeight, viewportBox.y));
  const vx2 = Math.max(0, Math.min(canvasWidth, viewportBox.x + viewportBox.width));
  const vy2 = Math.max(0, Math.min(canvasHeight, viewportBox.y + viewportBox.height));
  const clampedW = Math.max(0, vx2 - vx1);
  const clampedH = Math.max(0, vy2 - vy1);
  const hasPartialViewport =
    clampedW < canvasWidth - 2 || clampedH < canvasHeight - 2;

  const minIndicatorW = Math.min(canvasWidth, Math.max(28 * scale, clampedW));
  const minIndicatorH = Math.min(canvasHeight, Math.max(20 * scale, clampedH));
  const indicatorX = Math.min(canvasWidth - minIndicatorW, Math.max(0, vx1));
  const indicatorY = Math.min(canvasHeight - minIndicatorH, Math.max(0, vy1));

  if (!isOpen) {
    return (
      <div
        data-minimap-hud="true"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="absolute bottom-14 right-3 z-30"
      >
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label="Show topology mini-map"
          title="Show floating workspace mini-map"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-xs text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-500 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap"
        >
          <MapIcon className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
          <span>Mini-Map</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-minimap-hud="true"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="absolute bottom-14 right-3 z-30 w-[164px] sm:w-[204px] rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-xs overflow-hidden select-none"
    >
      {/* Slim Mini-Map Header */}
      <div className="px-2 py-1 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 bg-slate-50/90 dark:bg-slate-950/70">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapIcon className="w-3 h-3 text-blue-600 dark:text-cyan-400 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
            Mini-Map
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            {canvasWidth}×{canvasHeight}
          </span>
          <button
            type="button"
            onClick={onToggleOpen}
            aria-label="Hide mini-map"
            title="Collapse mini-map"
            className="p-0.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive Workspace Overview Canvas */}
      <div className="p-1.5 bg-slate-100/70 dark:bg-slate-950/70">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Topology mini-map overview (${canvasWidth} by ${canvasHeight}, zoom ${Math.round(zoom * 100)}%)`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            onMiniMapPointerDown(e, rect);
          }}
          style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}
          className={`w-full max-h-[126px] block rounded-lg bg-slate-50 dark:bg-[#090f1d] border border-slate-200/90 dark:border-slate-800 touch-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-pointer'
          }`}
        >
          <defs>
            <pattern
              id={gridPatternId}
              width={gridStep}
              height={gridStep}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
                fill="none"
                stroke="rgba(148, 163, 184, 0.22)"
                strokeWidth="0.75"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
          </defs>

          {/* Subtle Blueprint Grid */}
          <rect
            x={0}
            y={0}
            width={canvasWidth}
            height={canvasHeight}
            fill={`url(#${gridPatternId})`}
          />

          {/* Grouping Zones */}
          {shapes.map(shape => {
            const hasFill =
              Boolean(shape.fillColor) &&
              shape.fillColor !== 'transparent' &&
              shape.fillColor !== 'none';
            const fillOpacity = hasFill
              ? Math.min(0.42, Math.max(0.14, shape.fillOpacity || 0.25))
              : 0;
            return shape.kind === 'circle' ? (
              <ellipse
                key={shape.id}
                cx={shape.x + shape.width / 2}
                cy={shape.y + shape.height / 2}
                rx={shape.width / 2}
                ry={shape.height / 2}
                fill={hasFill ? shape.fillColor : 'none'}
                fillOpacity={fillOpacity}
                stroke={shape.borderColor || '#64748b'}
                strokeOpacity={0.6}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <rect
                key={shape.id}
                x={shape.x}
                y={shape.y}
                width={shape.width}
                height={shape.height}
                rx={12 * scale}
                fill={hasFill ? shape.fillColor : 'none'}
                fillOpacity={fillOpacity}
                stroke={shape.borderColor || '#64748b'}
                strokeOpacity={0.6}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* Topology Links */}
          {links.map(link => {
            const fromDev = deviceById.get(link.fromDeviceId);
            const toDev = deviceById.get(link.toDeviceId);
            if (!fromDev || !toDev) return null;
            const isUp = Boolean(linkStatuses.get(link.id)?.isUp);
            const isSelected = selectedLinkId === link.id;
            const isActiveHop = activeHopLinkId === link.id;
            const meta = MINI_MAP_CABLE_COLORS[link.cableType];
            return (
              <line
                key={link.id}
                x1={fromDev.x}
                y1={fromDev.y}
                x2={toDev.x}
                y2={toDev.y}
                stroke={
                  isActiveHop
                    ? '#10b981'
                    : isSelected
                    ? '#2563eb'
                    : isUp
                    ? meta.stroke
                    : '#94a3b8'
                }
                strokeWidth={isActiveHop || isSelected ? 2 : 1.25}
                strokeOpacity={isUp || isSelected ? 0.9 : 0.55}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* Freeform Label Landmarks */}
          {diagramLabels.map(lbl => (
            <rect
              key={lbl.id}
              x={lbl.x - 16 * scale}
              y={lbl.y - 4 * scale}
              width={32 * scale}
              height={8 * scale}
              rx={3 * scale}
              fill={lbl.color || '#64748b'}
              fillOpacity={0.45}
            />
          ))}

          {/* Device Nodes */}
          {devices.map(dev => {
            const isSelected = selectedSet.has(dev.id);
            const r = 14 * scale;
            const fill =
              dev.type === 'router'
                ? '#2563eb'
                : dev.type === 'switch'
                ? '#0891b2'
                : dev.type === 'server'
                ? '#7c3aed'
                : '#475569';

            return (
              <g key={dev.id}>
                {isSelected && (
                  <circle
                    cx={dev.x}
                    cy={dev.y}
                    r={r + 8 * scale}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={1.6}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {dev.type === 'router' ? (
                  <circle
                    cx={dev.x}
                    cy={dev.y}
                    r={r}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : dev.type === 'server' ? (
                  <rect
                    x={dev.x - r * 0.8}
                    y={dev.y - r * 1.15}
                    width={r * 1.6}
                    height={r * 2.3}
                    rx={4 * scale}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <rect
                    x={dev.x - r * 0.95}
                    y={dev.y - r * 0.85}
                    width={r * 1.9}
                    height={r * 1.7}
                    rx={dev.type === 'switch' ? 4 * scale : 3 * scale}
                    fill={fill}
                    stroke="#ffffff"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}

          {/* Dimmed Scrim Outside Current Viewport */}
          {hasPartialViewport && (
            <path
              fillRule="evenodd"
              d={`M 0 0 H ${canvasWidth} V ${canvasHeight} H 0 Z M ${indicatorX} ${indicatorY} H ${
                indicatorX + minIndicatorW
              } V ${indicatorY + minIndicatorH} H ${indicatorX} Z`}
              className="fill-slate-900/18 dark:fill-slate-950/55 pointer-events-none"
            />
          )}

          {/* Active Viewport Indicator Rectangle */}
          <rect
            x={indicatorX}
            y={indicatorY}
            width={minIndicatorW}
            height={minIndicatorH}
            rx={4 * scale}
            fill="rgba(37, 99, 235, 0.08)"
            stroke="#2563eb"
            strokeWidth={1.75}
            vectorEffect="non-scaling-stroke"
            className="dark:stroke-cyan-400"
          />
        </svg>
      </div>
    </div>
  );
};
