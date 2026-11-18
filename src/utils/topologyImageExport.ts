import {
  SimCableType,
  SimDevice,
  SimDiagramLabel,
  SimLink,
  SimTopologyShape
} from '../components/Lab/networkSimTypes';
import { getCiscoDeviceInnerSvg } from '../components/Lab/CiscoDeviceIcon';
import {
  computeCableGeometry,
  evaluateLinkStatus,
  isValidIp,
  maskToPrefix
} from '../components/Lab/networkSimEngine';

interface TopologyExportOptions {
  title: string;
  subtitle?: string;
  devices: SimDevice[];
  links: SimLink[];
  shapes?: SimTopologyShape[];
  labels?: SimDiagramLabel[];
  isDark?: boolean;
}

const EXPORT_CABLE_STYLE: Record<
  SimCableType,
  { label: string; stroke: string; dash?: string }
> = {
  straight: { label: 'Straight', stroke: '#0284c7' },
  crossover: { label: 'Crossover', stroke: '#0ea5e9', dash: '6 4' },
  fiber: { label: 'Fiber', stroke: '#f59e0b' },
  serial: { label: 'Serial', stroke: '#ef4444', dash: '3 3' }
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toDiagramFileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'network-topology-diagram';
}

export function buildTopologySvgString(
  options: TopologyExportOptions,
  pixelScale: number = 1
): string {
  const { title, subtitle, devices, links, shapes = [], labels = [], isDark = false } = options;

  const logicalW = 1000;
  const headerH = 64;
  const canvasH = 580;
  const footerH = 46;
  const logicalH = headerH + canvasH + footerH; // 690
  const outputW = logicalW * pixelScale;
  const outputH = logicalH * pixelScale;

  const palette = isDark
    ? {
        bg: '#090f1d',
        surface: '#0f172a',
        border: '#1e293b',
        gridDot: '#334155',
        titleText: '#f8fafc',
        mutedText: '#94a3b8',
        accentText: '#22d3ee',
        pillBg: '#0f172a',
        pillBorder: '#334155',
        downStroke: '#64748b',
        ledBorder: '#0f172a'
      }
    : {
        bg: '#f8fafc',
        surface: '#ffffff',
        border: '#e2e8f0',
        gridDot: '#cbd5e1',
        titleText: '#0f172a',
        mutedText: '#64748b',
        accentText: '#2563eb',
        pillBg: '#ffffff',
        pillBorder: '#cbd5e1',
        downStroke: '#94a3b8',
        ledBorder: '#ffffff'
      };

  const exportedStamp = new Date().toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const linkElements = links
    .map(link => {
      const fromDev = devices.find(d => d.id === link.fromDeviceId);
      const toDev = devices.find(d => d.id === link.toDeviceId);
      if (!fromDev || !toDev) return '';

      const status = evaluateLinkStatus(link, devices);
      const isUp = status.isUp;
      const style = EXPORT_CABLE_STYLE[link.cableType];

      const x1 = fromDev.x;
      const y1 = fromDev.y + headerH;
      const x2 = toDev.x;
      const y2 = toDev.y + headerH;

      const geom = computeCableGeometry(x1, y1, x2, y2);

      const fromIf = fromDev.interfaces.find(i => i.name === link.fromPort);
      const toIf = toDev.interfaces.find(i => i.name === link.toPort);
      const fromPortText = fromIf?.shortName || link.fromPort;
      const toPortText = toIf?.shortName || link.toPort;

      const renderEndpointLabel = (text: string, lx: number, ly: number) => {
        const w = Math.max(32, text.length * 6.1 + 10);
        const rx =
          geom.textAnchor === 'start'
            ? lx - 5
            : geom.textAnchor === 'end'
            ? lx - w + 5
            : lx - w / 2;
        return `
          <rect x="${rx.toFixed(1)}" y="${(ly - 10.5).toFixed(1)}" width="${w.toFixed(1)}" height="14" rx="3.5" fill="${palette.pillBg}" fill-opacity="0.92" stroke="${palette.pillBorder}" stroke-width="0.65" />
          <text
            x="${lx.toFixed(1)}" y="${ly.toFixed(1)}"
            text-anchor="${geom.textAnchor}"
            font-family="Fira Code, ui-monospace, SFMono-Regular, Menlo, monospace"
            font-size="9.5"
            font-weight="600"
            fill="${palette.mutedText}"
          >${escapeXml(text)}</text>
        `;
      };

      return `
        <g>
          <line
            x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}"
            x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
            stroke="${isUp ? style.stroke : palette.downStroke}"
            stroke-width="2.6"
            ${style.dash ? `stroke-dasharray="${style.dash}"` : ''}
            stroke-opacity="${isUp ? '0.95' : '0.65'}"
            stroke-linecap="round"
          />
          <circle cx="${geom.x1Led.toFixed(1)}" cy="${geom.y1Led.toFixed(1)}" r="4.5" fill="${isUp ? '#10b981' : '#ef4444'}" stroke="${palette.ledBorder}" stroke-width="1.2" />
          <circle cx="${geom.x2Led.toFixed(1)}" cy="${geom.y2Led.toFixed(1)}" r="4.5" fill="${isUp ? '#10b981' : '#ef4444'}" stroke="${palette.ledBorder}" stroke-width="1.2" />
          ${renderEndpointLabel(fromPortText, geom.fromLabelX, geom.fromLabelY)}
          ${renderEndpointLabel(toPortText, geom.toLabelX, geom.toLabelY)}
        </g>
      `;
    })
    .join('\n');

  const deviceElements = devices
    .map(dev => {
      const cx = dev.x;
      const cy = dev.y + headerH;

      const primaryIface = dev.interfaces.find(i => isValidIp(i.ip));
      const ipText = primaryIface
        ? `${primaryIface.ip}${isValidIp(primaryIface.mask) ? `/${maskToPrefix(primaryIface.mask)}` : ''}`
        : '';

      const nameWidth = dev.name.length * 7.2 + 16;
      const ipWidth = ipText ? ipText.length * 6.2 + 16 : 0;
      const boxW = Math.max(76, nameWidth, ipWidth);
      const boxH = ipText ? 31 : 19;
      const iconScale = 0.88;
      const rotation = typeof dev.rotation === 'number' && Number.isFinite(dev.rotation) ? dev.rotation : 0;
      const labelOffsetX =
        typeof dev.labelOffsetX === 'number' && Number.isFinite(dev.labelOffsetX)
          ? dev.labelOffsetX
          : 0;
      const labelOffsetY =
        typeof dev.labelOffsetY === 'number' && Number.isFinite(dev.labelOffsetY)
          ? dev.labelOffsetY
          : 0;

      return `
        <g transform="translate(${cx.toFixed(1)}, ${cy.toFixed(1)})">
          <g transform="${rotation ? `rotate(${rotation.toFixed(1)}) ` : ''}translate(${(-32 * iconScale).toFixed(1)}, ${(-28 * iconScale).toFixed(1)}) scale(${iconScale})">
            ${getCiscoDeviceInnerSvg(dev.type)}
          </g>
          <g transform="translate(${labelOffsetX.toFixed(1)}, ${labelOffsetY.toFixed(1)})">
            <rect
              x="${(-boxW / 2).toFixed(1)}" y="29"
              width="${boxW.toFixed(1)}" height="${boxH}" rx="7"
              fill="${palette.pillBg}" stroke="${palette.pillBorder}" stroke-width="1"
            />
            <text
              x="0" y="42"
              text-anchor="middle"
              font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
              font-size="11"
              font-weight="700"
              fill="${palette.titleText}"
            >${escapeXml(dev.name)}</text>
            ${
              ipText
                ? `<text
                    x="0" y="54.5"
                    text-anchor="middle"
                    font-family="Fira Code, ui-monospace, SFMono-Regular, Menlo, monospace"
                    font-size="9.5"
                    font-weight="500"
                    fill="${palette.accentText}"
                  >${escapeXml(ipText)}</text>`
                : ''
            }
          </g>
        </g>
      `;
    })
    .join('\n');

  const shapeElements = shapes
    .map(shape => {
      const sx = shape.x;
      const sy = shape.y + headerH;
      const w = Math.max(50, shape.width);
      const h = Math.max(40, shape.height);
      const isFillNone = !shape.fillColor || shape.fillColor === 'transparent' || shape.fillColor === 'none';
      const fill = isFillNone ? 'none' : shape.fillColor;
      const fillOpacity = isFillNone ? 0 : Math.min(1, Math.max(0, shape.fillOpacity ?? 0.32));
      const stroke = shape.borderColor || '#64748b';
      const strokeWidth = shape.borderWidth || 2;
      const dash =
        shape.lineStyle === 'dashed'
          ? '7 5'
          : shape.lineStyle === 'dotted'
          ? '2.5 4.5'
          : undefined;
      const labelText = shape.label?.trim();
      const labelColor = shape.labelColor || stroke;

      const geomMarkup =
        shape.kind === 'circle'
          ? `<ellipse
              cx="${(sx + w / 2).toFixed(1)}"
              cy="${(sy + h / 2).toFixed(1)}"
              rx="${(w / 2).toFixed(1)}"
              ry="${(h / 2).toFixed(1)}"
              fill="${escapeXml(fill)}"
              fill-opacity="${fillOpacity.toFixed(2)}"
              stroke="${escapeXml(stroke)}"
              stroke-width="${strokeWidth}"
              ${dash ? `stroke-dasharray="${dash}"` : ''}
            />`
          : `<rect
              x="${sx.toFixed(1)}"
              y="${sy.toFixed(1)}"
              width="${w.toFixed(1)}"
              height="${h.toFixed(1)}"
              rx="14"
              fill="${escapeXml(fill)}"
              fill-opacity="${fillOpacity.toFixed(2)}"
              stroke="${escapeXml(stroke)}"
              stroke-width="${strokeWidth}"
              ${dash ? `stroke-dasharray="${dash}"` : ''}
            />`;

      const labelMarkup = labelText
        ? shape.kind === 'circle'
          ? `<text
              x="${(sx + w / 2).toFixed(1)}"
              y="${(sy + Math.min(26, Math.max(16, h * 0.16))).toFixed(1)}"
              text-anchor="middle"
              font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
              font-size="11.5"
              font-weight="700"
              fill="${escapeXml(labelColor)}"
            >${escapeXml(labelText)}</text>`
          : `<text
              x="${(sx + 12).toFixed(1)}"
              y="${(sy + 19).toFixed(1)}"
              text-anchor="start"
              font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
              font-size="11.5"
              font-weight="700"
              fill="${escapeXml(labelColor)}"
            >${escapeXml(labelText)}</text>`
        : '';

      return `<g>${geomMarkup}${labelMarkup}</g>`;
    })
    .join('\n');

  const labelElements = labels
    .filter(item => item.text && item.text.trim().length > 0)
    .map(item => {
      const lx = item.x;
      const ly = item.y + headerH;
      const fontSize = Math.min(20, Math.max(10, Number(item.fontSize) || 12));
      const lines = item.text.split('\n').slice(0, 6);
      const maxLen = Math.max(...lines.map(l => l.length), 1);
      const boxW = maxLen * (fontSize * 0.62) + 16;
      const lineH = fontSize * 1.3;
      const boxH = lines.length * lineH + 8;
      const textColor = item.color || (isDark ? '#e2e8f0' : '#1e293b');
      const hasBg = Boolean(item.bgColor && item.bgColor !== 'transparent');
      const weight = item.bold !== false ? '700' : '500';
      const style = item.italic ? 'italic' : 'normal';
      const startY = ly - ((lines.length - 1) * lineH) / 2 + fontSize * 0.35;

      const bgRect = hasBg
        ? `<rect x="${(lx - boxW / 2).toFixed(1)}" y="${(ly - boxH / 2).toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="6" fill="${escapeXml(item.bgColor!)}" fill-opacity="0.9" stroke="${palette.pillBorder}" stroke-width="1" />`
        : '';

      const tspans = lines
        .map(
          (line, idx) =>
            `<tspan x="${lx.toFixed(1)}" y="${(startY + idx * lineH).toFixed(1)}">${escapeXml(line)}</tspan>`
        )
        .join('');

      return `
        <g>
          ${bgRect}
          <text
            text-anchor="middle"
            font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
            font-size="${fontSize}"
            font-weight="${weight}"
            font-style="${style}"
            fill="${escapeXml(textColor)}"
          >${tspans}</text>
        </g>
      `;
    })
    .join('\n');

  const safeTitle = escapeXml(title || 'Network Topology Diagram');
  const safeSub = escapeXml(
    subtitle || `${devices.length} devices · ${links.length} cables · Exported ${exportedStamp}`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outputW}" height="${outputH}" viewBox="0 0 ${logicalW} ${logicalH}">
  <defs>
    <pattern id="bpGridDots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="12" cy="12" r="1" fill="${palette.gridDot}" fill-opacity="0.55" />
    </pattern>
  </defs>

  <!-- Document Canvas Background -->
  <rect x="0" y="0" width="${logicalW}" height="${logicalH}" fill="${palette.bg}" />

  <!-- Top Documentation Banner -->
  <rect x="0" y="0" width="${logicalW}" height="${headerH}" fill="${palette.surface}" />
  <line x1="0" y1="${headerH}" x2="${logicalW}" y2="${headerH}" stroke="${palette.border}" stroke-width="1" />
  <text
    x="28" y="27"
    font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    font-size="16"
    font-weight="800"
    fill="${palette.titleText}"
  >${safeTitle}</text>
  <text
    x="28" y="46"
    font-family="Fira Code, ui-monospace, SFMono-Regular, Menlo, monospace"
    font-size="11"
    fill="${palette.mutedText}"
  >${safeSub}</text>
  <text
    x="${logicalW - 28}" y="37"
    text-anchor="end"
    font-family="Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    font-size="11.5"
    font-weight="700"
    fill="${palette.accentText}"
  >Netplus Academy · Lab Topology Export</text>

  <!-- Topology Grid Background -->
  <rect x="0" y="${headerH}" width="${logicalW}" height="${canvasH}" fill="url(#bpGridDots)" />

  <!-- Grouping Shapes Layer -->
  ${shapeElements}

  <!-- Links Layer -->
  ${linkElements}

  <!-- Devices Layer -->
  ${deviceElements}

  <!-- Diagram Annotation Labels Layer -->
  ${labelElements}

  <!-- Bottom Legend Footer -->
  <rect x="0" y="${headerH + canvasH}" width="${logicalW}" height="${footerH}" fill="${palette.surface}" />
  <line x1="0" y1="${headerH + canvasH}" x2="${logicalW}" y2="${headerH + canvasH}" stroke="${palette.border}" stroke-width="1" />

  <g transform="translate(28, ${headerH + canvasH + 26})" font-family="Fira Code, ui-monospace, SFMono-Regular, Menlo, monospace" font-size="10.5" fill="${palette.mutedText}">
    <line x1="0" y1="-3" x2="20" y2="-3" stroke="#0284c7" stroke-width="2.5" />
    <text x="27" y="0">Straight</text>

    <line x1="100" y1="-3" x2="120" y2="-3" stroke="#0ea5e9" stroke-width="2.5" stroke-dasharray="5 3" />
    <text x="127" y="0">Crossover</text>

    <line x1="210" y1="-3" x2="230" y2="-3" stroke="#f59e0b" stroke-width="2.5" />
    <text x="237" y="0">Fiber</text>

    <line x1="290" y1="-3" x2="310" y2="-3" stroke="#ef4444" stroke-width="2.5" stroke-dasharray="3 3" />
    <text x="317" y="0">Serial WAN</text>

    <circle cx="418" cy="-3" r="4" fill="#10b981" />
    <text x="427" y="0">Link Up</text>

    <circle cx="496" cy="-3" r="4" fill="#ef4444" />
    <text x="505" y="0">Link Down</text>
  </g>
</svg>`;
}

function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportTopologyAsSvg(options: TopologyExportOptions): string {
  const svgContent = buildTopologySvgString(options, 1);
  const filename = `${toDiagramFileSlug(options.title)}.svg`;
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  triggerFileDownload(blob, filename);
  return filename;
}

export async function exportTopologyAsPng(options: TopologyExportOptions): Promise<string> {
  const scale = 2; // High-resolution 2000 x 1380 PNG
  const svgContent = buildTopologySvgString(options, scale);
  const filename = `${toDiagramFileSlug(options.title)}.png`;

  const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not rasterize topology SVG for PNG export'));
      image.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1000 * scale;
    canvas.height = 690 * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('PNG encoding returned empty blob'))),
        'image/png',
        1.0
      );
    });

    triggerFileDownload(pngBlob, filename);
    return filename;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
