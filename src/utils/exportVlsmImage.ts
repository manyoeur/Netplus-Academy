import { VlsmAllocationSummary, VlsmTreeNode } from './vlsmTree';

export interface ExportableVlsmNode {
  node: VlsmTreeNode;
  x: number;
  y: number;
}

export interface ExportableVlsmEdge {
  id: string;
  bit: '0' | '1';
  pathD: string;
  labelX: number;
  labelY: number;
  isAllocatedBranch: boolean;
}

export interface ExportVlsmTreeImageOptions {
  nodes: ExportableVlsmNode[];
  edges: ExportableVlsmEdge[];
  treeWidth: number;
  treeHeight: number;
  cardWidth: number;
  cardHeight: number;
  summary: VlsmAllocationSummary;
  modeLabel: string;
  isDarkTheme: boolean;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (maxWidth <= 0) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = '…';
  let trimmed = text;
  while (trimmed.length > 0 && ctx.measureText(trimmed + ellipsis).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed ? trimmed + ellipsis : ellipsis;
}

export async function exportVlsmTreeToPng({
  nodes,
  edges,
  treeWidth,
  treeHeight,
  cardWidth,
  cardHeight,
  summary,
  modeLabel,
  isDarkTheme
}: ExportVlsmTreeImageOptions): Promise<void> {
  const outerPadX = 24;
  const headerHeight = 92;
  const bottomPad = 24;

  const canvasWidth = Math.max(760, treeWidth + outerPadX * 2);
  const canvasHeight = headerHeight + treeHeight + bottomPad;

  // Use 2x Retina scale, gracefully stepping down only if canvas exceeds safe browser limits
  const maxDim = Math.max(canvasWidth, canvasHeight);
  const dpr = maxDim * 2 <= 10000 ? 2 : Math.max(1, Math.floor((10000 / maxDim) * 10) / 10);

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(canvasWidth * dpr);
  canvas.height = Math.ceil(canvasHeight * dpr);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to initialize 2D canvas context for image export.');
  }

  ctx.scale(dpr, dpr);

  const palette = isDarkTheme
    ? {
        bg: '#070b14',
        headerBg: '#0c1220',
        border: '#1e293b',
        title: '#f8fafc',
        subtitle: '#94a3b8',
        accent: '#22d3ee',
        edgeAllocated: 'rgba(34, 211, 238, 0.72)',
        edgeDefault: '#334155',
        bitCircleFill: '#0f172a',
        bitCircleStroke: '#334155',
        bitText: '#e2e8f0',
        splitFill: '#0f172a',
        splitBorder: '#334155',
        splitLabel: '#94a3b8',
        allocFill: '#0e2444',
        allocBorder: '#0e7490',
        allocLabel: '#67e8f9',
        freeFill: '#0c1220',
        freeBorder: '#059669',
        freeLabel: '#34d399',
        cardCidr: '#ffffff',
        cardMeta: '#94a3b8',
        cardDivider: 'rgba(148, 163, 184, 0.16)',
        legendSplit: '#64748b',
        legendAlloc: '#22d3ee',
        legendFree: '#10b981'
      }
    : {
        bg: '#f8fafc',
        headerBg: '#ffffff',
        border: '#e2e8f0',
        title: '#0f172a',
        subtitle: '#475569',
        accent: '#2563eb',
        edgeAllocated: 'rgba(59, 130, 246, 0.78)',
        edgeDefault: '#cbd5e1',
        bitCircleFill: '#ffffff',
        bitCircleStroke: '#cbd5e1',
        bitText: '#334155',
        splitFill: '#ffffff',
        splitBorder: '#cbd5e1',
        splitLabel: '#64748b',
        allocFill: '#eff6ff',
        allocBorder: '#93c5fd',
        allocLabel: '#1d4ed8',
        freeFill: '#ffffff',
        freeBorder: '#34d399',
        freeLabel: '#047857',
        cardCidr: '#0f172a',
        cardMeta: '#64748b',
        cardDivider: 'rgba(148, 163, 184, 0.25)',
        legendSplit: '#94a3b8',
        legendAlloc: '#2563eb',
        legendFree: '#10b981'
      };

  const sansFont =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const monoFont =
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace';

  // Canvas Background
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Header Banner
  ctx.fillStyle = palette.headerBg;
  ctx.fillRect(0, 0, canvasWidth, headerHeight);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight - 0.5);
  ctx.lineTo(canvasWidth, headerHeight - 0.5);
  ctx.stroke();

  // Header Title & Supernet Summary
  ctx.textBaseline = 'top';
  ctx.fillStyle = palette.title;
  ctx.font = `700 16px ${sansFont}`;
  ctx.fillText(`VLSM Hierarchy Tree · ${summary.baseCidrLabel}`, outerPadX, 18);

  ctx.fillStyle = palette.subtitle;
  ctx.font = `500 12px ${monoFont}`;
  const metricsText =
    `Mode: ${modeLabel}  ·  Allocated: ${summary.allocatedAddresses.toLocaleString()} / ` +
    `${summary.totalSupernetAddresses.toLocaleString()} IPs (${summary.utilizationPercent}%)  ·  ` +
    `${summary.allocatedLeaves.length} allocated · ${summary.freeLeaves.length} available`;
  ctx.fillText(truncateText(ctx, metricsText, canvasWidth - outerPadX * 2), outerPadX, 42);

  // Header Color Legend
  const legendY = 66;
  let legendX = outerPadX;
  const legendItems: Array<{ label: string; color: string; dashed?: boolean }> = [
    { label: 'Split Branch (Parent)', color: palette.legendSplit },
    { label: 'Allocated Subnet', color: palette.legendAlloc },
    { label: 'Available Block', color: palette.legendFree, dashed: true }
  ];

  ctx.font = `500 11px ${sansFont}`;
  legendItems.forEach(item => {
    if (item.dashed) {
      ctx.save();
      ctx.setLineDash([2.5, 2]);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(legendX + 0.5, legendY + 1.5, 9, 9);
      ctx.restore();
    } else {
      ctx.fillStyle = item.color;
      drawRoundedRect(ctx, legendX, legendY + 1, 10, 10, 2);
      ctx.fill();
    }
    legendX += 16;
    ctx.fillStyle = palette.subtitle;
    ctx.fillText(item.label, legendX, legendY);
    legendX += ctx.measureText(item.label).width + 20;
  });

  // Render Tree Geometry
  ctx.save();
  const treeOffsetX = Math.max(outerPadX, Math.round((canvasWidth - treeWidth) / 2));
  ctx.translate(treeOffsetX, headerHeight);

  // 1. Edges & Binary Bit Circles
  edges.forEach(edge => {
    const path = new Path2D(edge.pathD);
    ctx.strokeStyle = edge.isAllocatedBranch ? palette.edgeAllocated : palette.edgeDefault;
    ctx.lineWidth = edge.isAllocatedBranch ? 2 : 1.5;
    ctx.stroke(path);

    ctx.beginPath();
    ctx.arc(edge.labelX, edge.labelY, 10, 0, Math.PI * 2);
    ctx.fillStyle = palette.bitCircleFill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.bitCircleStroke;
    ctx.stroke();

    ctx.fillStyle = palette.bitText;
    ctx.font = `700 10px ${monoFont}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(edge.bit, edge.labelX, edge.labelY + 0.5);
  });

  // Reset alignment for Node Cards
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 2. Node Cards
  nodes.forEach(({ node, x, y }) => {
    const isAllocated = node.status === 'allocated';
    const isSplit = node.status === 'split';
    const isFree = node.status === 'free';

    const fillColor = isAllocated
      ? palette.allocFill
      : isFree
      ? palette.freeFill
      : palette.splitFill;
    const borderColor = isAllocated
      ? palette.allocBorder
      : isFree
      ? palette.freeBorder
      : palette.splitBorder;
    const statusColor = isAllocated
      ? palette.allocLabel
      : isFree
      ? palette.freeLabel
      : palette.splitLabel;

    ctx.save();
    drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 12);
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.lineWidth = 1.25;
    if (isFree) {
      ctx.setLineDash([4, 3]);
    }
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.restore();

    const innerPad = 10;
    const innerWidth = cardWidth - innerPad * 2;
    const leftX = x + innerPad;

    // Top row: Assigned/Status label + optional branchBit
    let bitLabelWidth = 0;
    if (node.branchBit) {
      const bitStr = `bit ${node.branchBit}`;
      ctx.font = `500 10px ${monoFont}`;
      bitLabelWidth = ctx.measureText(bitStr).width + 6;
      ctx.fillStyle = palette.cardMeta;
      ctx.textAlign = 'right';
      ctx.fillText(bitStr, x + cardWidth - innerPad, y + innerPad);
      ctx.textAlign = 'left';
    }

    const statusText = isAllocated
      ? node.assignedName || 'Allocated'
      : isSplit
      ? 'Split Branch'
      : 'Available Block';
    ctx.font = `600 10px ${sansFont}`;
    ctx.fillStyle = statusColor;
    ctx.fillText(truncateText(ctx, statusText, innerWidth - bitLabelWidth), leftX, y + innerPad);

    // Middle: Network/CIDR
    ctx.font = `700 12px ${monoFont}`;
    ctx.fillStyle = palette.cardCidr;
    ctx.fillText(truncateText(ctx, node.cidrLabel, innerWidth), leftX, y + innerPad + 16);

    // Subline: Host stats
    const hostsLine =
      isAllocated && node.hostsRequired
        ? `${node.hostsRequired} req / ${node.stats.usableHosts} usable`
        : `${node.stats.usableHosts.toLocaleString()} usable · ${node.stats.totalAddresses.toLocaleString()} IPs`;
    ctx.font = `500 10px ${monoFont}`;
    ctx.fillStyle = palette.cardMeta;
    ctx.fillText(truncateText(ctx, hostsLine, innerWidth), leftX, y + innerPad + 34);

    // Footer divider & IP summary
    const footerLineY = y + cardHeight - 28;
    ctx.strokeStyle = palette.cardDivider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX, footerLineY);
    ctx.lineTo(x + cardWidth - innerPad, footerLineY);
    ctx.stroke();

    const footerText = isAllocated
      ? `${node.stats.firstHost} – ${node.stats.lastHost}`
      : isSplit
      ? `2 × /${node.prefix + 1} child blocks`
      : `First usable: ${node.stats.firstHost}`;
    ctx.font = `500 10px ${monoFont}`;
    ctx.fillStyle = isAllocated ? palette.allocLabel : palette.cardMeta;
    ctx.fillText(truncateText(ctx, footerText, innerWidth), leftX, footerLineY + 7);
  });

  ctx.restore();

  // Trigger Download
  const safeSlug = summary.baseCidrLabel
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename = `vlsm-tree-${safeSlug || 'subnet'}.png`;

  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png')
  );

  if (blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
