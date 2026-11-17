import { jsPDF } from 'jspdf';
import { Certificate } from '../types';

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
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
      if (lines.length === maxLines - 1) {
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    const remainingStart = words.slice(
      lines.join(' ').split(/\s+/).filter(Boolean).length
    );
    const tail = remainingStart.join(' ');
    let finalLine = tail || currentLine;
    while (ctx.measureText(finalLine).width > maxWidth && finalLine.length > 4) {
      finalLine = `${finalLine.slice(0, -4)}...`;
    }
    lines.push(finalLine);
  }

  return lines;
}

function drawStarburstSeal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawVerificationMatrix(
  ctx: CanvasRenderingContext2D,
  hash: string,
  x: number,
  y: number,
  size: number
) {
  const cells = 7;
  const cellSize = size / cells;
  const seed = hash || 'NETPLUS-VERIFIED';

  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, x - 10, y - 10, size + 20, size + 20, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const isCornerFinder =
        (row < 2 && col < 2) ||
        (row < 2 && col >= cells - 2) ||
        (row >= cells - 2 && col < 2);
      const charCode = seed.charCodeAt((row * cells + col) % seed.length);
      const isFilled = isCornerFinder || (charCode + row * 7 + col * 13) % 2 === 0;

      if (isFilled) {
        ctx.fillStyle = isCornerFinder ? '#b45309' : '#0f172a';
        ctx.fillRect(
          x + col * cellSize + 1.5,
          y + row * cellSize + 1.5,
          cellSize - 3,
          cellSize - 3
        );
      }
    }
  }
}

export async function exportCertificateToPdf(cert: Certificate): Promise<string> {
  if (typeof document === 'undefined') {
    throw new Error('PDF export is only supported in a browser environment.');
  }

  try {
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 400))
      ]);
    }
  } catch {
    // Proceed cleanly if font readiness check fails
  }

  // Exact A4 landscape aspect ratio (297mm x 210mm) at ~254 DPI
  const W = 2970;
  const H = 2100;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas rendering context for PDF export.');
  }

  // 1. Background parchment gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#fffdf6');
  bgGrad.addColorStop(0.5, '#ffffff');
  bgGrad.addColorStop(1, '#fef9eb');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle geometric radial halo behind crest & center
  const haloGrad = ctx.createRadialGradient(W / 2, H * 0.44, 120, W / 2, H * 0.44, 1300);
  haloGrad.addColorStop(0, 'rgba(245, 158, 11, 0.06)');
  haloGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = haloGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle guilloche dot lattice
  ctx.fillStyle = 'rgba(180, 83, 9, 0.04)';
  for (let gx = 160; gx < W - 160; gx += 75) {
    for (let gy = 160; gy < H - 160; gy += 75) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Ornamental Double Border & Corner Brackets
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.52)';
  ctx.lineWidth = 10;
  drawRoundedRect(ctx, 72, 72, W - 144, H - 144, 40);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(217, 119, 6, 0.28)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 96, 96, W - 192, H - 192, 30);
  ctx.stroke();

  const drawCorner = (x: number, y: number, dx: number, dy: number, len = 130) => {
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, y + dy * len);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * len, y);
    ctx.stroke();
  };
  drawCorner(135, 135, 1, 1);
  drawCorner(W - 135, 135, -1, 1);
  drawCorner(135, H - 135, 1, -1, 160);
  drawCorner(W - 135, H - 135, -1, -1, 160);

  // 3. Top Crest & Academy Header
  const crestX = W / 2;
  const crestY = 260;

  const sealGrad = ctx.createLinearGradient(crestX - 80, crestY - 80, crestX + 80, crestY + 80);
  sealGrad.addColorStop(0, '#fbbf24');
  sealGrad.addColorStop(0.5, '#d97706');
  sealGrad.addColorStop(1, '#f59e0b');

  ctx.save();
  ctx.shadowColor = 'rgba(217, 119, 6, 0.25)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = sealGrad;
  ctx.beginPath();
  ctx.arc(crestX, crestY, 74, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(crestX, crestY, 60, 0, Math.PI * 2);
  ctx.stroke();

  // Inner rosette star
  ctx.fillStyle = '#ffffff';
  drawStarburstSeal(ctx, crestX, crestY, 34, 16, 8);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#b45309';
  ctx.font = '700 32px "Fira Code", ui-monospace, monospace';
  ctx.fillText('NETPLUS NETWORKING ACADEMY OF TECHNOLOGY', W / 2, 382);

  // Accent divider
  ctx.fillStyle = 'rgba(217, 119, 6, 0.35)';
  ctx.fillRect(W / 2 - 220, 416, 440, 4);

  // 4. Student Name & Course Attestation
  ctx.fillStyle = '#64748b';
  ctx.font = '600 30px Georgia, "Times New Roman", serif';
  ctx.fillText('THIS IS TO CERTIFY THAT', W / 2, 490);

  // Dynamic font fit for student name
  let nameFontSize = 104;
  ctx.font = `900 ${nameFontSize}px Georgia, "Times New Roman", serif`;
  while (ctx.measureText(cert.studentName).width > W - 520 && nameFontSize > 56) {
    nameFontSize -= 6;
    ctx.font = `900 ${nameFontSize}px Georgia, "Times New Roman", serif`;
  }
  ctx.fillStyle = '#0f172a';
  ctx.fillText(cert.studentName, W / 2, 598);

  // Gold underline beneath student name
  const nameLineWidth = Math.min(W - 760, Math.max(540, ctx.measureText(cert.studentName).width + 120));
  ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
  ctx.fillRect(W / 2 - nameLineWidth / 2, 666, nameLineWidth, 5);

  ctx.fillStyle = '#475569';
  ctx.font = '400 31px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(
    'has successfully fulfilled all curriculum requirements, passed comprehensive laboratory simulations,',
    W / 2,
    740
  );
  ctx.fillText('and demonstrated professional engineering mastery in:', W / 2, 786);

  // Course title (wrapped cleanly if long)
  ctx.fillStyle = '#1e40af';
  ctx.font = '800 56px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  const courseLines = wrapTextLines(ctx, cert.courseTitle, W - 480, 2);
  let courseBottomY = 880;
  courseLines.forEach((line, idx) => {
    const lineY = courseLines.length === 1 ? 880 : 864 + idx * 68;
    ctx.fillText(line, W / 2, lineY);
    courseBottomY = lineY;
  });

  // Final Grade
  const gradeY = courseBottomY + 72;
  ctx.fillStyle = '#059669';
  ctx.font = '700 32px "Fira Code", ui-monospace, monospace';
  ctx.fillText(`Final Grade: ${cert.grade}`, W / 2, gradeY);

  // 5. Demonstrated Engineering Competencies Box
  const skills = cert.skillsAcquired?.length ? cert.skillsAcquired : ['Enterprise Networking', 'Protocol Verification'];
  const boxX = 320;
  const boxY = gradeY + 56;
  const boxW = W - 640;
  const boxH = 270;

  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 24);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '700 24px "Fira Code", ui-monospace, monospace';
  ctx.fillText('DEMONSTRATED ENGINEERING COMPETENCIES:', boxX + 46, boxY + 48);

  // Flow skill badges neatly inside the box
  ctx.font = '600 25px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
  let cursorX = boxX + 46;
  let cursorY = boxY + 86;
  const chipH = 54;
  const chipGapX = 18;
  const chipGapY = 18;
  const maxBoxRight = boxX + boxW - 46;

  for (const skill of skills.slice(0, 12)) {
    const label = `✓ ${skill}`;
    const textW = ctx.measureText(label).width;
    const chipW = Math.min(textW + 44, boxW - 92);

    if (cursorX + chipW > maxBoxRight) {
      cursorX = boxX + 46;
      cursorY += chipH + chipGapY;
    }
    if (cursorY + chipH > boxY + boxH - 22) {
      break;
    }

    ctx.fillStyle = '#fef3c7';
    drawRoundedRect(ctx, cursorX, cursorY, chipW, chipH, 12);
    ctx.fill();
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.fillText(label, cursorX + 22, cursorY + chipH / 2 + 1);
    cursorX += chipW + chipGapX;
  }

  // 6. Footer Signatures & Verification Metadata
  const footerTopY = 1615;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(220, footerTopY);
  ctx.lineTo(W - 220, footerTopY);
  ctx.stroke();

  // Left: Serial & Hash
  ctx.textAlign = 'left';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 24px "Fira Code", ui-monospace, monospace';
  ctx.fillText('CERTIFICATE SERIAL', 220, footerTopY + 62);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 34px "Fira Code", ui-monospace, monospace';
  ctx.fillText(cert.certificateNumber, 220, footerTopY + 114);

  const hashPreview =
    cert.verificationHash.length > 38
      ? `${cert.verificationHash.slice(0, 38)}...`
      : cert.verificationHash;
  ctx.fillStyle = '#64748b';
  ctx.font = '500 22px "Fira Code", ui-monospace, monospace';
  ctx.fillText(`SHA-256: ${hashPreview}`, 220, footerTopY + 162);

  // Center: Verified Official Seal + Verification Matrix
  const matrixSize = 132;
  drawVerificationMatrix(
    ctx,
    cert.verificationHash || cert.certificateNumber,
    W / 2 - matrixSize / 2,
    footerTopY + 48,
    matrixSize
  );
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b45309';
  ctx.font = '700 22px "Fira Code", ui-monospace, monospace';
  ctx.fillText('VERIFIED OFFICIAL CREDENTIAL', W / 2, footerTopY + 216);

  // Right: Instructor Signature & Issue Date
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'italic 700 46px Georgia, "Times New Roman", serif';
  ctx.fillText(cert.instructorName, W - 220, footerTopY + 80);

  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W - 760, footerTopY + 116);
  ctx.lineTo(W - 220, footerTopY + 116);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '600 25px "Fira Code", ui-monospace, monospace';
  ctx.fillText(cert.instructorTitle.toUpperCase(), W - 220, footerTopY + 152);

  ctx.fillStyle = '#475569';
  ctx.font = '600 25px "Fira Code", ui-monospace, monospace';
  ctx.fillText(`Issued: ${cert.issueDate}`, W - 220, footerTopY + 194);

  // 7. Package into A4 Landscape PDF & download locally
  const imgData = canvas.toDataURL('image/png', 1.0);
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  doc.setProperties({
    title: `${cert.courseTitle} — Certificate (${cert.certificateNumber})`,
    subject: `Netplus Academy Official Certificate for ${cert.studentName}`,
    author: 'Netplus Academy',
    keywords: `certificate,${cert.certificateNumber},${cert.courseTitle}`
  });

  doc.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');

  const safeSerial = (cert.certificateNumber || 'certificate').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Netplus-Certificate-${safeSerial}.pdf`;
  doc.save(filename);

  return filename;
}
