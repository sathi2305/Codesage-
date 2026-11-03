import type { NodeCategory, RepositoryGraph } from '../types';

export interface EndpointTraceHop {
  layer: string;
  componentName: string;
  filePath: string;
  line: number;
  description: string;
  icon?: string;
}

export interface EndpointTraceData {
  id: string;
  method: string;
  path: string;
  description: string;
  hops: EndpointTraceHop[];
}

const CATEGORY_COLORS: Record<NodeCategory, { fill: string; border: string; text: string }> = {
  Repository: { fill: '#1d4ed8', border: '#3b82f6', text: '#93c5fd' },
  File: { fill: '#0e7490', border: '#22d3ee', text: '#a5f3fc' },
  Function: { fill: '#6d28d9', border: '#a855f7', text: '#e9d5ff' },
  Class: { fill: '#4338ca', border: '#6366f1', text: '#c7d2fe' },
  APIEndpoint: { fill: '#047857', border: '#10b981', text: '#6ee7b7' },
  Configuration: { fill: '#b45309', border: '#f59e0b', text: '#fde68a' },
  Test: { fill: '#0f766e', border: '#14b8a6', text: '#99f6e4' },
  Documentation: { fill: '#0369a1', border: '#38bdf8', text: '#bae6fd' },
  Module: { fill: '#334155', border: '#64748b', text: '#cbd5e1' },
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an SVG representation of the repository knowledge graph
 */
export function exportKnowledgeGraphToSvg(
  graph: RepositoryGraph,
  repoName: string,
  options?: { categoryFilter?: string }
): string {
  const nodes = options?.categoryFilter && options.categoryFilter !== 'ALL'
    ? graph.nodes.filter((n) => n.data.category === options.categoryFilter)
    : graph.nodes;

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  // Compute bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (nodes.length === 0) {
    minX = 0;
    minY = 0;
    maxX = 1000;
    maxY = 600;
  } else {
    for (const node of nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + 220);
      maxY = Math.max(maxY, node.position.y + 90);
    }
  }

  const padding = 80;
  const headerHeight = 110;
  const footerHeight = 70;

  const width = Math.max(1200, Math.ceil(maxX - minX + padding * 2));
  const height = Math.max(760, Math.ceil(maxY - minY + padding * 2 + headerHeight + footerHeight));

  const offsetX = padding - minX;
  const offsetY = padding + headerHeight - minY;

  // Node position cache for edge curves
  const posMap = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    posMap.set(n.id, {
      x: n.position.x + offsetX,
      y: n.position.y + offsetY,
    });
  }

  const observedCount = edges.filter((e) => e.certainty === 'observed').length;
  const inferredCount = edges.filter((e) => e.certainty === 'inferred').length;

  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <!-- Background grid pattern -->
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#1e293b" opacity="0.6"/>
    </pattern>

    <!-- Arrow markers -->
    <marker id="arrow-cyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#22d3ee"/>
    </marker>
    <marker id="arrow-violet" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#a855f7"/>
    </marker>
    <marker id="arrow-slate" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569"/>
    </marker>

    <!-- Node shadows -->
    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.5"/>
    </filter>

    <style>
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .font-mono { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
  </defs>

  <!-- Deep space background -->
  <rect width="100%" height="100%" fill="#020817" rx="16"/>
  <rect width="100%" height="100%" fill="url(#grid)" rx="16"/>
  <rect width="100%" height="100%" fill="none" stroke="#1e293b" stroke-width="2" rx="16"/>

  <!-- Header Banner -->
  <g transform="translate(40, 36)">
    <!-- Brand Tag -->
    <rect x="0" y="0" width="180" height="24" rx="6" fill="#071a35" stroke="#2563ff" stroke-width="1"/>
    <text x="12" y="16" class="font-mono" font-size="10" font-weight="700" fill="#60a5fa" letter-spacing="1">CODESAGE AI GRAPH</text>

    <!-- Title -->
    <text x="0" y="54" class="font-sans" font-size="22" font-weight="700" fill="#ffffff">${escapeXml(
      repoName
    )}</text>
    <text x="0" y="74" class="font-mono" font-size="12" fill="#94a3b8">Knowledge Graph · ${
      nodes.length
    } Nodes · ${observedCount} Observed AST Edges · ${inferredCount} Inferred Cross-Module Edges</text>
  </g>

  <!-- Edges -->
  <g id="edges">
`;

  // Draw edges
  for (const edge of edges) {
    const s = posMap.get(edge.source);
    const t = posMap.get(edge.target);
    if (!s || !t) continue;

    const sourceX = s.x + 200;
    const sourceY = s.y + 36;
    const targetX = t.x;
    const targetY = t.y + 36;

    const dx = targetX - sourceX;
    const cx1 = sourceX + Math.max(30, dx * 0.45);
    const cy1 = sourceY;
    const cx2 = targetX - Math.max(30, dx * 0.45);
    const cy2 = targetY;

    const isObserved = edge.certainty === 'observed';
    const strokeColor = isObserved ? '#22d3ee' : '#a855f7';
    const strokeWidth = isObserved ? 1.6 : 1.4;
    const dash = isObserved ? 'none' : '5,4';
    const marker = isObserved ? 'url(#arrow-cyan)' : 'url(#arrow-violet)';

    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;

    svgContent += `    <path d="M ${sourceX} ${sourceY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${targetX} ${targetY}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="${dash}" marker-end="${marker}" opacity="0.75"/>\n`;

    // Edge Label Pill
    if (edge.label && edge.label !== 'CONTAINS') {
      const labelText = escapeXml(edge.label);
      const labelWidth = Math.max(50, labelText.length * 6.5 + 12);
      svgContent += `    <g transform="translate(${midX - labelWidth / 2}, ${midY - 10})">
      <rect width="${labelWidth}" height="18" rx="4" fill="#041126" stroke="${strokeColor}" stroke-width="0.8" opacity="0.95"/>
      <text x="${labelWidth / 2}" y="12" class="font-mono" font-size="9" fill="${
        isObserved ? '#67e8f9' : '#d8b4fe'
      }" text-anchor="middle">${labelText}</text>
    </g>\n`;
    }
  }

  svgContent += `  </g>\n\n  <!-- Nodes -->\n  <g id="nodes">\n`;

  // Draw nodes
  for (const node of nodes) {
    const pos = posMap.get(node.id);
    if (!pos) continue;

    const style = CATEGORY_COLORS[node.data.category] || CATEGORY_COLORS.File;
    const nodeWidth = 200;
    const nodeHeight = 72;
    const label = escapeXml(node.data.label);
    const subText = node.data.filePath ? escapeXml(node.data.filePath.split('/').slice(-2).join('/')) : '';

    svgContent += `    <g transform="translate(${pos.x}, ${pos.y})" filter="url(#card-shadow)">
      <!-- Card background -->
      <rect width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="#071a35" stroke="${
      style.border
    }" stroke-width="1.4"/>
      <!-- Category top pill -->
      <rect x="8" y="8" width="80" height="15" rx="3" fill="#020817" stroke="${
      style.border
    }" stroke-width="0.8"/>
      <text x="14" y="19" class="font-mono" font-size="8.5" font-weight="600" fill="${
      style.text
    }">${escapeXml(node.data.category.toUpperCase())}</text>

      <!-- Degree badge -->
      <text x="${nodeWidth - 10}" y="19" class="font-mono" font-size="8.5" fill="#64748b" text-anchor="end">${
      node.data.inDegree
    } in / ${node.data.outDegree} out</text>

      <!-- Node Main Title -->
      <text x="10" y="42" class="font-mono" font-size="11.5" font-weight="700" fill="#ffffff">${label}</text>

      <!-- Subtitle / Path -->
      <text x="10" y="58" class="font-mono" font-size="9" fill="#94a3b8">${subText}</text>
    </g>\n`;
  }

  svgContent += `  </g>\n\n  <!-- Footer & Legend -->\n  <g transform="translate(40, ${
    height - footerHeight + 15
  })">
    <rect x="0" y="0" width="${width - 80}" height="42" rx="8" fill="#041126" stroke="#1e293b" stroke-width="1"/>
    
    <!-- Legend dots -->
    <g transform="translate(16, 26)">
      <circle cx="0" cy="-4" r="5" fill="#22d3ee"/>
      <text x="10" y="0" class="font-mono" font-size="10" fill="#cbd5e1">File</text>

      <circle cx="65" cy="-4" r="5" fill="#10b981"/>
      <text x="75" y="0" class="font-mono" font-size="10" fill="#cbd5e1">API</text>

      <circle cx="125" cy="-4" r="5" fill="#a855f7"/>
      <text x="135" y="0" class="font-mono" font-size="10" fill="#cbd5e1">Function</text>

      <circle cx="215" cy="-4" r="5" fill="#6366f1"/>
      <text x="225" y="0" class="font-mono" font-size="10" fill="#cbd5e1">Class</text>

      <circle cx="290" cy="-4" r="5" fill="#f59e0b"/>
      <text x="300" y="0" class="font-mono" font-size="10" fill="#cbd5e1">Config</text>

      <circle cx="370" cy="-4" r="5" fill="#14b8a6"/>
      <text x="380" y="0" class="font-mono" font-size="10" fill="#cbd5e1">Test</text>

      <!-- Line legend -->
      <line x1="440" y1="-4" x2="470" y2="-4" stroke="#22d3ee" stroke-width="2"/>
      <text x="478" y="0" class="font-mono" font-size="10" fill="#cbd5e1">Observed AST</text>

      <line x1="590" y1="-4" x2="620" y2="-4" stroke="#a855f7" stroke-width="2" stroke-dasharray="4,3"/>
      <text x="628" y="0" class="font-mono" font-size="10" fill="#cbd5e1">Inferred</text>
    </g>

    <text x="${width - 100}" y="26" class="font-mono" font-size="10" fill="#64748b" text-anchor="end">Exported via CodeSage AI Engine · ${new Date().toLocaleDateString()}</text>
  </g>
</svg>`;

  return svgContent;
}

/**
 * Generates an SVG flow diagram for an API endpoint execution pipeline
 */
export function exportApiFlowToSvg(trace: EndpointTraceData, repoName: string): string {
  const hopCount = trace.hops.length;
  const cardWidth = 240;
  const gap = 48;
  const paddingX = 50;
  const paddingY = 40;
  const headerHeight = 130;
  const cardHeight = 220;
  const footerHeight = 60;

  const width = Math.max(1280, paddingX * 2 + hopCount * cardWidth + (hopCount - 1) * gap);
  const height = headerHeight + cardHeight + footerHeight + paddingY * 2;

  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <!-- Background grid pattern -->
    <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#1e293b" opacity="0.6"/>
    </pattern>

    <!-- Arrow marker -->
    <marker id="flow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#22d3ee"/>
    </marker>

    <filter id="card-shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.6"/>
    </filter>

    <style>
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .font-mono { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
  </defs>

  <!-- Deep dark background -->
  <rect width="100%" height="100%" fill="#020817" rx="16"/>
  <rect width="100%" height="100%" fill="url(#grid)" rx="16"/>
  <rect width="100%" height="100%" fill="none" stroke="#1e293b" stroke-width="2" rx="16"/>

  <!-- Header Section -->
  <g transform="translate(${paddingX}, ${paddingY})">
    <rect x="0" y="0" width="220" height="24" rx="6" fill="#071a35" stroke="#2563ff" stroke-width="1"/>
    <text x="12" y="16" class="font-mono" font-size="10" font-weight="700" fill="#60a5fa" letter-spacing="1">API FLOW PIPELINE TRACE</text>

    <!-- Endpoint Method & Path -->
    <g transform="translate(0, 36)">
      <rect x="0" y="0" width="${trace.method.length * 10 + 16}" height="28" rx="6" fill="#083344" stroke="#06b6d4" stroke-width="1.2"/>
      <text x="${(trace.method.length * 10 + 16) / 2}" y="18" class="font-mono" font-size="13" font-weight="700" fill="#22d3ee" text-anchor="middle">${escapeXml(
    trace.method
  )}</text>

      <text x="${trace.method.length * 10 + 28}" y="20" class="font-mono" font-size="20" font-weight="700" fill="#ffffff">${escapeXml(
    trace.path
  )}</text>
    </g>

    <text x="0" y="86" class="font-sans" font-size="13" fill="#94a3b8">${escapeXml(
      trace.description
    )} · Repository: <tspan fill="#e2e8f0" font-weight="600">${escapeXml(
      repoName
    )}</tspan></text>
  </g>

  <!-- Pipeline Stages Cards and Connecting Arrows -->
  <g transform="translate(${paddingX}, ${paddingY + headerHeight})">
`;

  trace.hops.forEach((hop, idx) => {
    const cardX = idx * (cardWidth + gap);
    const cardY = 0;

    // Card background
    svgContent += `    <!-- Stage ${idx + 1}: ${escapeXml(hop.layer)} -->
    <g transform="translate(${cardX}, ${cardY})" filter="url(#card-shadow)">
      <rect width="${cardWidth}" height="${cardHeight}" rx="12" fill="#071a35" stroke="#334155" stroke-width="1.2"/>
      
      <!-- Stage header bar -->
      <rect x="0" y="0" width="${cardWidth}" height="40" rx="12" fill="#0a2042"/>
      <rect x="0" y="28" width="${cardWidth}" height="12" fill="#0a2042"/>

      <!-- Layer pill -->
      <rect x="12" y="10" width="70" height="20" rx="4" fill="#020817" stroke="#22d3ee" stroke-width="0.8"/>
      <text x="47" y="23" class="font-mono" font-size="9" font-weight="700" fill="#22d3ee" text-anchor="middle">LAYER 0${
        idx + 1
      }</text>

      <text x="${cardWidth - 14}" y="24" class="font-mono" font-size="11" font-weight="700" fill="#ffffff" text-anchor="end">${escapeXml(
      hop.layer
    )}</text>

      <!-- Component Name -->
      <text x="14" y="66" class="font-mono" font-size="12" font-weight="700" fill="#38bdf8">${escapeXml(
      hop.componentName.length > 25 ? hop.componentName.slice(0, 24) + '…' : hop.componentName
    )}</text>

      <!-- File Path & Line -->
      <rect x="12" y="80" width="${cardWidth - 24}" height="28" rx="6" fill="#020817" stroke="#1e293b" stroke-width="0.8"/>
      <text x="20" y="98" class="font-mono" font-size="9.5" fill="#a5f3fc">${escapeXml(
      hop.filePath.length > 26 ? '…' + hop.filePath.slice(-24) : hop.filePath
    )}:L${hop.line}</text>

      <!-- Description -->
      <foreignObject x="14" y="118" width="${cardWidth - 28}" height="90">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 11px; color: #cbd5e1; line-height: 1.45;">
          ${escapeXml(hop.description)}
        </div>
      </foreignObject>
    </g>\n`;

    // Connecting Arrow to next stage
    if (idx < hopCount - 1) {
      const arrowStartX = cardX + cardWidth + 4;
      const arrowEndX = cardX + cardWidth + gap - 6;
      const arrowY = cardY + 20;

      svgContent += `    <!-- Arrow ${idx + 1} -> ${idx + 2} -->
    <line x1="${arrowStartX}" y1="${arrowY}" x2="${arrowEndX}" y2="${arrowY}" stroke="#22d3ee" stroke-width="2" marker-end="url(#flow-arrow)"/>
    <circle cx="${(arrowStartX + arrowEndX) / 2}" cy="${arrowY}" r="3" fill="#22d3ee"/>\n`;
    }
  });

  svgContent += `  </g>\n\n  <!-- Footer -->\n  <g transform="translate(${paddingX}, ${
    height - footerHeight + 15
  })">
    <rect x="0" y="0" width="${width - paddingX * 2}" height="36" rx="8" fill="#041126" stroke="#1e293b" stroke-width="1"/>
    <text x="16" y="22" class="font-mono" font-size="10.5" fill="#94a3b8">End-to-End Architectural Verification · 5 Layers Traced</text>
    <text x="${width - paddingX * 2 - 16}" y="22" class="font-mono" font-size="10.5" fill="#64748b" text-anchor="end">Generated by CodeSage AI · ${new Date().toLocaleDateString()}</text>
  </g>
</svg>`;

  return svgContent;
}

/**
 * Converts an SVG string into a high-resolution PNG Blob via offscreen canvas
 */
export async function svgToPngBlob(svgString: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const URLObj = window.URL || window.webkitURL || window;
    const blobURL = URLObj.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const width = img.naturalWidth || 1200;
        const height = img.naturalHeight || 800;

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URLObj.revokeObjectURL(blobURL);
          reject(new Error('Failed to acquire canvas 2D context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          URLObj.revokeObjectURL(blobURL);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to encode raster canvas into PNG blob'));
          }
        }, 'image/png');
      } catch (err) {
        URLObj.revokeObjectURL(blobURL);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URLObj.revokeObjectURL(blobURL);
      reject(new Error(`Failed to load SVG for PNG rasterization: ${err}`));
    };

    img.src = blobURL;
  });
}

/**
 * Triggers a file download in the browser
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const URLObj = window.URL || window.webkitURL || window;
  const objectUrl = URLObj.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URLObj.revokeObjectURL(objectUrl), 1000);
}

/**
 * Triggers a file download from a data URL or text content (e.g. SVG)
 */
export function downloadTextAsFile(content: string, fileName: string, mimeType = 'image/svg+xml'): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  downloadBlob(blob, fileName);
}
