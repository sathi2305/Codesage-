import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ExternalLink, Maximize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GraphNode, RepositoryGraph } from '../../types';

interface KnowledgeGraph3DProps {
  graph: RepositoryGraph;
  heightClass?: string;
}

const CATEGORY_HEX: Record<string, number> = {
  Repository: 0x2563ff,
  File: 0x22d3ee,
  Function: 0x793cff,
  Class: 0x6366f1,
  APIEndpoint: 0x10b981,
  Configuration: 0xf59e0b,
  Test: 0x14b8a6,
  Documentation: 0x38bdf8,
  Module: 0x94a3b8,
};

export const KnowledgeGraph3D: React.FC<KnowledgeGraph3DProps> = ({
  graph,
  heightClass = 'h-[520px]',
}) => {
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isRotating, setIsRotating] = useState(true);
  const isRotatingRef = useRef(isRotating);
  isRotatingRef.current = isRotating;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020817, 0.035);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 5, 14);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x0a2042, 2.0);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x22d3ee, 3.5, 30);
    pointLight.position.set(5, 8, 8);
    scene.add(pointLight);

    const violetLight = new THREE.PointLight(0x793cff, 3.0, 30);
    violetLight.position.set(-8, -4, -5);
    scene.add(violetLight);

    // 3. Graph Layout Calculation in 3D Space
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    const nodePositions = new Map<string, THREE.Vector3>();
    const nodeMeshes: { mesh: THREE.Mesh; node: GraphNode }[] = [];
    const nodeGeometries: THREE.BufferGeometry[] = [];
    const nodeMaterials: THREE.Material[] = [];

    // Distribute nodes in spherical / concentric cylindrical layers by category
    const count = graph.nodes.length;
    graph.nodes.forEach((node, i) => {
      const cat = node.data.category;
      let radius = 5.2;
      let yOffset = 0;

      if (cat === 'Repository') {
        radius = 0.2;
        yOffset = 0;
      } else if (cat === 'Configuration' || cat === 'Documentation') {
        radius = 3.2;
        yOffset = (i % 2 === 0 ? 1 : -1) * 2.2;
      } else if (cat === 'APIEndpoint') {
        radius = 4.2;
        yOffset = 1.2;
      } else if (cat === 'File') {
        radius = 5.5;
        yOffset = Math.sin(i * 1.3) * 2.0;
      } else {
        radius = 7.0;
        yOffset = Math.cos(i * 1.5) * 2.8;
      }

      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const pos = new THREE.Vector3(
        Math.cos(angle) * radius,
        yOffset,
        Math.sin(angle) * radius
      );
      nodePositions.set(node.id, pos);

      const colHex = CATEGORY_HEX[cat] || 0x22d3ee;
      const size = cat === 'Repository' ? 0.45 : cat === 'File' || cat === 'APIEndpoint' ? 0.32 : 0.22;

      const geo =
        cat === 'APIEndpoint'
          ? new THREE.OctahedronGeometry(size, 0)
          : cat === 'Class'
          ? new THREE.BoxGeometry(size * 1.4, size * 1.4, size * 1.4)
          : new THREE.IcosahedronGeometry(size, 1);
      nodeGeometries.push(geo);

      const mat = new THREE.MeshPhysicalMaterial({
        color: colHex,
        emissive: colHex,
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.8,
      });
      nodeMaterials.push(mat);

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData = { nodeId: node.id };
      graphGroup.add(mesh);
      nodeMeshes.push({ mesh, node });
    });

    // 4. Graph Edges (Connecting Lines)
    const edgeCoords: number[] = [];
    const edgeColors: number[] = [];

    const cyanColor = new THREE.Color(0x22d3ee);
    const violetColor = new THREE.Color(0x793cff);

    graph.edges.forEach((edge) => {
      const p1 = nodePositions.get(edge.source);
      const p2 = nodePositions.get(edge.target);
      if (p1 && p2) {
        edgeCoords.push(p1.x, p1.y, p1.z);
        edgeCoords.push(p2.x, p2.y, p2.z);

        const col = edge.certainty === 'inferred' ? violetColor : cyanColor;
        edgeColors.push(col.r, col.g, col.b);
        edgeColors.push(col.r, col.g, col.b);
      }
    });

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeCoords, 3));
    edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3));

    const edgeMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    graphGroup.add(edgeLines);

    // 5. Interactive Raycaster for Node Clicking
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = false;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      const deltaX = Math.abs(e.clientX - prevMouseX);
      const deltaY = Math.abs(e.clientY - prevMouseY);
      if (deltaX > 4 || deltaY > 4) {
        isDragging = true;
      }
      if (e.buttons === 1) {
        graphGroup.rotation.y += (e.clientX - prevMouseX) * 0.006;
        graphGroup.rotation.x += (e.clientY - prevMouseY) * 0.006;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) {
        const rect = container.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(nodeMeshes.map((m) => m.mesh));
        if (intersects.length > 0) {
          const hit = intersects[0].object;
          const found = nodeMeshes.find((nm) => nm.mesh === hit);
          if (found) {
            setSelectedNode(found.node);
          }
        }
      }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);

    // 6. Responsive Resize
    const resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const nw = entry.contentRect.width;
        const nh = entry.contentRect.height;
        if (nw > 0 && nh > 0) {
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
          renderer.setSize(nw, nh);
        }
      }
    });
    resizeObs.observe(container);

    // 7. Render Loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (isRotatingRef.current) {
        graphGroup.rotation.y += delta * 0.2;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObs.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      nodeGeometries.forEach((g) => g.dispose());
      nodeMaterials.forEach((m) => m.dispose());
      edgeGeo.dispose();
      edgeMat.dispose();
    };
  }, [graph]);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#020817] border border-slate-800 ${heightClass}`}>
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Controls */}
      <div className="absolute bottom-3 left-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsRotating((r) => !r)}
          className="px-2.5 py-1.5 rounded-lg bg-[#071A35]/90 hover:bg-[#0A2042] border border-slate-700 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer backdrop-blur-md"
        >
          {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-cyan-300" />}
          <span>{isRotating ? 'Pause Orbit' : 'Rotate Orbit'}</span>
        </button>

        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
          Drag to rotate · Click node to inspect details
        </span>
      </div>

      {/* Selected Node Details Drawer */}
      {selectedNode && (
        <div className="absolute top-3 right-3 bottom-3 w-72 sm:w-80 rounded-xl border border-slate-700 bg-[#041126]/95 backdrop-blur-md p-4 overflow-y-auto z-20 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-wider">
                  {selectedNode.data.category}
                </span>
                <h3 className="text-sm font-semibold text-white font-mono break-all mt-0.5">
                  {selectedNode.data.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close node inspector"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedNode.data.filePath && (
              <div className="mt-3 text-xs font-mono text-slate-300 bg-[#020817] p-2 rounded border border-slate-800 break-all">
                {selectedNode.data.filePath}
              </div>
            )}

            <div className="mt-3 text-xs text-slate-400 space-y-1">
              <div>
                Incoming relations: <strong className="text-slate-200">{selectedNode.data.inDegree}</strong>
              </div>
              <div>
                Outgoing relations: <strong className="text-slate-200">{selectedNode.data.outDegree}</strong>
              </div>
              {selectedNode.data.description && (
                <p className="pt-2 text-slate-300 text-xs leading-relaxed border-t border-slate-800">
                  {selectedNode.data.description}
                </p>
              )}
            </div>
          </div>

          {selectedNode.data.filePath && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/explorer?file=${encodeURIComponent(selectedNode.data.filePath!)}&start=${
                    selectedNode.data.startLine || 1
                  }&end=${selectedNode.data.endLine || 25}`
                )
              }
              className="mt-4 w-full py-2 px-3 rounded-lg bg-[#2563FF] hover:bg-[#1d4ed8] text-xs font-medium text-white flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Inspect Source Code</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
