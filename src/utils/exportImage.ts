/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MindMapNode, MindMapEdge, NodeShape } from '../types.js';

interface ExportImageOptions {
  title: string;
  subject: string;
  educatorName?: string;
  isDarkMode?: boolean;
}

export function downloadCanvasAsImage(
  nodes: MindMapNode[],
  edges: MindMapEdge[],
  options: ExportImageOptions
) {
  if (nodes.length === 0) return;

  // Calculate bounding box for all nodes
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  });

  const padding = 120;
  const headerHeight = 100;
  
  const contentWidth = Math.max(maxX - minX, 600);
  const contentHeight = Math.max(maxY - minY, 400);

  const canvasWidth = Math.round(contentWidth + padding * 2);
  const canvasHeight = Math.round(contentHeight + padding * 2 + headerHeight);

  // Offset coordinates to align inside canvas
  const offsetX = padding - minX;
  const offsetY = padding + headerHeight - minY;

  const canvas = document.createElement('canvas');
  const dpr = Math.max(window.devicePixelRatio || 1, 2); // High DPI crisp output
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(dpr, dpr);

  const isDark = options.isDarkMode ?? false;
  const bgColor = isDark ? '#0f172a' : '#f8fafc';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subtextColor = isDark ? '#94a3b8' : '#64748b';

  // 1. Draw Background & Grid
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Grid dots/lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  const gridSize = 24;
  for (let x = 0; x < canvasWidth; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();
  }
  for (let y = 0; y < canvasHeight; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();
  }

  // 2. Draw Header Branding Banner
  ctx.save();
  ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.06)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillRect(20, 20, canvasWidth - 40, headerHeight - 20);
  ctx.restore();

  // Header Title Text
  ctx.font = 'bold 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = textColor;
  ctx.fillText(options.title || 'MindSphere Interactive Mind Map', 40, 52);

  ctx.font = '12px "Inter", system-ui, sans-serif';
  ctx.fillStyle = subtextColor;
  const subtitle = `Subject: ${options.subject || 'Interactive Learning'} • Hosted by ${options.educatorName || 'Ejoe Tso'} • ${nodes.length} Nodes`;
  ctx.fillText(subtitle, 40, 74);

  // Watermark Badge
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('⚡ EJOE MINDSPHERE INTERACTIVE BOARD', canvasWidth - 300, 55);

  // 3. Draw Edges
  const nodeMap = new Map<string, MindMapNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  edges.forEach((edge) => {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) return;

    const x1 = src.x + offsetX;
    const y1 = src.y + offsetY;
    const x2 = tgt.x + offsetX;
    const y2 = tgt.y + offsetY;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = edge.color || (isDark ? '#475569' : '#cbd5e1');
    ctx.lineWidth = edge.thickness || 2.5;

    if (edge.style === 'dashed') {
      ctx.setLineDash([6, 6]);
    } else {
      ctx.setLineDash([]);
    }

    // Curved bezier path
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 - 20;
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    // Edge label if present
    if (edge.label) {
      ctx.font = '10px sans-serif';
      ctx.fillStyle = subtextColor;
      ctx.fillText(edge.label, midX - 10, midY - 6);
    }
    ctx.restore();
  });

  // 4. Draw Nodes with Custom Shapes
  nodes.forEach((node) => {
    const nx = node.x + offsetX;
    const ny = node.y + offsetY;
    const shape: NodeShape = node.shape || 'rectangle';

    const w = 150;
    const h = 70;

    ctx.save();

    // Node Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Node Fill & Border
    const primaryColor = node.color || '#3b82f6';
    ctx.fillStyle = isDark ? '#1e293b' : '#ffffff';
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;

    // Render Shape Geometry
    drawShapePath(ctx, shape, nx - w / 2, ny - h / 2, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.restore(); // remove shadow for text

    // Accent header pill inside node
    ctx.save();
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.arc(nx - w / 2 + 18, ny - h / 2 + 18, 12, 0, Math.PI * 2);
    ctx.fill();

    // Node Emoji Icon
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.icon || '💡', nx - w / 2 + 18, ny - h / 2 + 18);

    // Node Title Text
    ctx.font = 'bold 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const maxTitleWidth = w - 44;
    let titleText = node.title;
    if (ctx.measureText(titleText).width > maxTitleWidth) {
      while (titleText.length > 3 && ctx.measureText(titleText + '...').width > maxTitleWidth) {
        titleText = titleText.slice(0, -1);
      }
      titleText += '...';
    }
    ctx.fillText(titleText, nx - w / 2 + 36, ny - h / 2 + 12);

    // Category / Description
    ctx.font = '10px "Inter", system-ui, sans-serif';
    ctx.fillStyle = subtextColor;
    ctx.fillText(node.category || 'Concept', nx - w / 2 + 36, ny - h / 2 + 30);

    // Upvote badge if votes > 0
    if (node.votes && node.votes.length > 0) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(`❤️ ${node.votes.length}`, nx + w / 2 - 32, ny + h / 2 - 16);
    }

    ctx.restore();
  });

  // 5. Trigger File Download
  const link = document.createElement('a');
  const safeFilename = (options.title || 'MindMap').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  link.download = `${safeFilename}_board_export.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function drawShapePath(
  ctx: CanvasRenderingContext2D,
  shape: NodeShape,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.beginPath();
  switch (shape) {
    case 'circle': {
      const radius = Math.max(w, h) / 2;
      ctx.arc(x + w / 2, y + h / 2, radius, 0, Math.PI * 2);
      break;
    }
    case 'ellipse': {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    }
    case 'diamond': {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      break;
    }
    case 'cloud': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.arc(cx - 30, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx, cy - 15, 25, 0, Math.PI * 2);
      ctx.arc(cx + 30, cy, 20, 0, Math.PI * 2);
      ctx.arc(cx, cy + 10, 22, 0, Math.PI * 2);
      break;
    }
    case 'hexagon': {
      const hw = w / 2;
      const hh = h / 2;
      const cx = x + hw;
      const cy = y + hh;
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = cx + hw * Math.cos(angle);
        const py = cy + hh * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'capsule': {
      const r = h / 2;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(x + r, y + h);
      ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
      ctx.closePath();
      break;
    }
    case 'star': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR / 2.2;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const px = cx + r * Math.cos(angle);
        const py = cy + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'rectangle':
    default: {
      const r = 14; // rounded corner radius
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      break;
    }
  }
}
