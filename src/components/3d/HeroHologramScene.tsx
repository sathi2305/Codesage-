import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, EyeOff, Layers, Pause, Play, Sparkles } from 'lucide-react';

interface HeroHologramSceneProps {
  repoName?: string;
  symbolCount?: number;
  className?: string;
}

export type ScenePerspectiveMode = 'neural' | 'modules' | 'synapses';

export const HeroHologramScene: React.FC<HeroHologramSceneProps> = ({
  repoName = 'CodeSage Intelligence Core',
  symbolCount = 42,
  className = 'h-[360px] lg:h-[440px] w-full',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeMode, setActiveMode] = useState<ScenePerspectiveMode>('neural');
  const [isLowPower, setIsLowPower] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  const activeModeRef = useRef<ScenePerspectiveMode>(activeMode);

  isPlayingRef.current = isPlaying;
  activeModeRef.current = activeMode;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Detect Reduced Motion preference & Software WebGL
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsPlaying(false);
    }

    const isSoftwareGl = (() => {
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    if (isSoftwareGl) {
      setIsLowPower(true);
    }

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;

    // 2. Three.js Scene, Camera & Renderer setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020817, 0.045);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 80);
    camera.position.set(0, 1.2, 7.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    container.appendChild(renderer.domElement);

    // 3. Studio Lighting
    const ambientLight = new THREE.AmbientLight(0x0a2042, 1.8);
    scene.add(ambientLight);

    const cyanKeyLight = new THREE.PointLight(0x22d3ee, 4.5, 20);
    cyanKeyLight.position.set(4, 3, 4);
    scene.add(cyanKeyLight);

    const violetRimLight = new THREE.PointLight(0x793cff, 4.0, 20);
    violetRimLight.position.set(-4, -2, -3);
    scene.add(violetRimLight);

    const blueFillLight = new THREE.DirectionalLight(0x2563ff, 2.2);
    blueFillLight.position.set(0, 5, 2);
    scene.add(blueFillLight);

    // 4. Procedural Geometry & Objects
    const masterGroup = new THREE.Group();
    scene.add(masterGroup);

    // --- A. Central Holographic Geodesic Core ---
    const coreGroup = new THREE.Group();
    masterGroup.add(coreGroup);

    // Inner glowing nucleus
    const nucleusGeo = new THREE.IcosahedronGeometry(0.85, 2);
    const nucleusMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const nucleusMesh = new THREE.Mesh(nucleusGeo, nucleusMat);
    coreGroup.add(nucleusMesh);

    // Middle multifaceted crystal cage
    const cageGeo = new THREE.IcosahedronGeometry(1.22, 1);
    const cageMat = new THREE.MeshPhysicalMaterial({
      color: 0x071a35,
      emissive: 0x2563ff,
      emissiveIntensity: 0.45,
      roughness: 0.15,
      metalness: 0.85,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    coreGroup.add(cageMesh);

    // Outer faint pulsing orbital wire sphere
    const haloGeo = new THREE.SphereGeometry(1.6, 24, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x793cff,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    coreGroup.add(haloMesh);

    // --- B. Concentric Orbital Rings & Module Nodes ---
    const orbitalGroup = new THREE.Group();
    masterGroup.add(orbitalGroup);

    const createOrbitRing = (radius: number, color: number, tiltX: number, tiltZ: number) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.015, radius + 0.015, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2 + tiltX;
      ringMesh.rotation.z = tiltZ;
      return ringMesh;
    };

    const ring1 = createOrbitRing(2.3, 0x22d3ee, 0.25, 0.1);
    const ring2 = createOrbitRing(3.1, 0x2563ff, -0.35, 0.4);
    const ring3 = createOrbitRing(3.8, 0x793cff, 0.15, -0.3);
    orbitalGroup.add(ring1, ring2, ring3);

    // Procedural canvas badge helper for node tags
    const createTextBadgeTexture = (text: string, color: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 72;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#071A35';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.roundRect(4, 4, 248, 64, 12);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 24px monospace';
        ctx.fillStyle = '#F1F5F9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 36);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const modules = [
      { name: 'Auth/JWT', radius: 2.3, speed: 0.6, angle: 0, color: 0x22d3ee },
      { name: 'Ledger Engine', radius: 2.3, speed: 0.6, angle: Math.PI, color: 0x2563ff },
      { name: 'API Router', radius: 3.1, speed: -0.45, angle: Math.PI * 0.4, color: 0x10b981 },
      { name: 'Models/Store', radius: 3.1, speed: -0.45, angle: Math.PI * 1.4, color: 0x793cff },
      { name: 'KnowledgeGraph', radius: 3.8, speed: 0.35, angle: Math.PI * 0.8, color: 0x22d3ee },
      { name: 'Blast Radius', radius: 3.8, speed: 0.35, angle: Math.PI * 1.8, color: 0xf59e0b },
    ];

    const moduleMeshes: {
      mesh: THREE.Mesh;
      badge: THREE.Sprite;
      radius: number;
      speed: number;
      angle: number;
    }[] = [];

    modules.forEach((mod) => {
      const nodeGeo = new THREE.OctahedronGeometry(0.18, 0);
      const nodeMat = new THREE.MeshPhysicalMaterial({
        color: mod.color,
        emissive: mod.color,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.8,
      });
      const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);

      const badgeTex = createTextBadgeTexture(mod.name, `#${mod.color.toString(16).padStart(6, '0')}`);
      const spriteMat = new THREE.SpriteMaterial({
        map: badgeTex,
        transparent: true,
        opacity: 0.9,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.1, 0.32, 1);
      sprite.position.y = 0.32;

      nodeMesh.add(sprite);
      orbitalGroup.add(nodeMesh);

      moduleMeshes.push({
        mesh: nodeMesh,
        badge: sprite,
        radius: mod.radius,
        speed: mod.speed,
        angle: mod.angle,
      });
    });

    // --- C. Synaptic Particle Cloud & Connection Filaments ---
    const particleCount = isSoftwareGl ? 350 : 850;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const cyanCol = new THREE.Color(0x22d3ee);
    const blueCol = new THREE.Color(0x2563ff);
    const violetCol = new THREE.Color(0x793cff);

    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;
      const r = 2.0 + Math.random() * 2.8;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = (r * Math.sin(phi) * Math.sin(theta)) * 0.7;
      positions[i * 3 + 2] = r * Math.cos(phi);

      const mixed = Math.random();
      const col = mixed < 0.4 ? cyanCol : mixed < 0.75 ? blueCol : violetCol;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    masterGroup.add(particleSystem);

    // Dynamic neural synaptic lines between core and orbital nodes
    const lineCount = 18;
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = new Float32Array(lineCount * 2 * 3);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });
    const connectionLines = new THREE.LineSegments(lineGeo, lineMat);
    masterGroup.add(connectionLines);

    // --- D. Floating Code Syntax Planes ---
    const codeSnippets = [
      'jwt.verify(token, RS256)',
      'executeTransfer(src, dst, amt)',
      'GraphRAG.retrieveEvidence()',
      'class LedgerAccount(Base)',
    ];

    const codePlanesGroup = new THREE.Group();
    masterGroup.add(codePlanesGroup);

    codeSnippets.forEach((snippet, i) => {
      const tex = createTextBadgeTexture(snippet, '#2563FF');
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.75 });
      const sp = new THREE.Sprite(mat);
      const angle = (i / codeSnippets.length) * Math.PI * 2;
      sp.position.set(Math.cos(angle) * 3.4, (i % 2 === 0 ? 1.2 : -1.0), Math.sin(angle) * 3.4);
      sp.scale.set(1.4, 0.4, 1);
      codePlanesGroup.add(sp);
    });

    // 5. Interactive Pointer Parallax
    let targetRotX = 0;
    let targetRotY = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetRotY = nx * 0.45;
      targetRotX = -ny * 0.3;
    };

    container.addEventListener('pointermove', onPointerMove);

    // 6. Responsive Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
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
    resizeObserver.observe(container);

    // 7. Render Loop
    let animationFrameId = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth pointer parallax
      masterGroup.rotation.y = THREE.MathUtils.damp(masterGroup.rotation.y, targetRotY, 4.0, delta);
      masterGroup.rotation.x = THREE.MathUtils.damp(masterGroup.rotation.x, targetRotX, 4.0, delta);

      if (isPlayingRef.current) {
        // Core rotation
        nucleusMesh.rotation.y += delta * 0.55;
        nucleusMesh.rotation.x += delta * 0.25;

        cageMesh.rotation.y -= delta * 0.35;
        cageMesh.rotation.z += delta * 0.15;

        haloMesh.rotation.y += delta * 0.15;

        // Pulse scale
        const pulse = 1 + Math.sin(elapsed * 2.2) * 0.045;
        nucleusMesh.scale.set(pulse, pulse, pulse);

        // Orbit modules
        moduleMeshes.forEach((mod, idx) => {
          mod.angle += delta * mod.speed * 0.5;
          const x = Math.cos(mod.angle) * mod.radius;
          const z = Math.sin(mod.angle) * mod.radius;
          const y = Math.sin(elapsed * 1.5 + idx) * 0.25;
          mod.mesh.position.set(x, y, z);
          mod.mesh.rotation.y += delta * 1.5;
        });

        // Rotate particles cloud slowly
        particleSystem.rotation.y += delta * 0.08;
        particleSystem.rotation.x = Math.sin(elapsed * 0.25) * 0.08;

        // Rotate code badges
        codePlanesGroup.rotation.y -= delta * 0.12;

        // Update synaptic connection line coordinates
        const linePos = lineGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < lineCount; i++) {
          const mod = moduleMeshes[i % moduleMeshes.length];
          // Origin at core
          linePos[i * 6] = Math.sin(elapsed * 2 + i) * 0.15;
          linePos[i * 6 + 1] = Math.cos(elapsed * 2 + i) * 0.15;
          linePos[i * 6 + 2] = 0;
          // Target at orbiting module
          if (mod) {
            linePos[i * 6 + 3] = mod.mesh.position.x;
            linePos[i * 6 + 4] = mod.mesh.position.y;
            linePos[i * 6 + 5] = mod.mesh.position.z;
          }
        }
        lineGeo.attributes.position.needsUpdate = true;
      }

      // Smooth camera position transitions based on active mode
      const mode = activeModeRef.current;
      let targetCamZ = 7.5;
      let targetCamY = 1.2;

      if (mode === 'modules') {
        targetCamZ = 6.2;
        targetCamY = 2.4;
      } else if (mode === 'synapses') {
        targetCamZ = 5.2;
        targetCamY = 0.5;
      }

      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 3.0, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 3.0, delta);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();

    // 8. Clean Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', onPointerMove);

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      renderer.dispose();
      nucleusGeo.dispose();
      nucleusMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    };
  }, []);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-[#020817] via-[#041126] to-[#071A35] border border-slate-800/80 ${className}`}>
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Atmospheric Vignette & Horizon Grid Lines */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,8,23,0.75)_95%)]" />

      {/* Minimal Top Telemetry Badge */}
      <div className="absolute top-3 left-4 flex items-center gap-2 pointer-events-none select-none">
        <div className="px-2.5 py-1 rounded-md bg-[#020817]/80 backdrop-blur-md border border-slate-700/80 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5 tabular-nums">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>AST Core: {symbolCount} Nodes Synced</span>
        </div>
        {isLowPower && (
          <span className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] text-slate-400">
            Optimized Renderer
          </span>
        )}
      </div>

      {/* Interactive 3D HUD Dock (Pinned cleanly at bottom center with Zero Viewport Occlusion) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1 rounded-xl bg-[#020817]/90 backdrop-blur-md border border-slate-700/80 shadow-2xl z-10 max-w-[94vw]">
        {/* Perspective Mode Segmented Selector */}
        <div className="flex items-center gap-1 pr-1 border-r border-slate-800">
          <button
            type="button"
            onClick={() => setActiveMode('neural')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeMode === 'neural'
                ? 'bg-[#2563FF] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0A2042]'
            }`}
          >
            Neural Core
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('modules')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeMode === 'modules'
                ? 'bg-[#2563FF] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0A2042]'
            }`}
          >
            AST Orbits
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('synapses')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeMode === 'synapses'
                ? 'bg-[#2563FF] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#0A2042]'
            }`}
          >
            Synapses
          </button>
        </div>

        {/* Play/Pause Rotation Button */}
        <button
          type="button"
          onClick={() => setIsPlaying((p) => !p)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#0A2042] transition-colors cursor-pointer"
          title={isPlaying ? 'Pause 3D Motion' : 'Resume 3D Motion'}
          aria-label={isPlaying ? 'Pause 3D Motion' : 'Resume 3D Motion'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-cyan-300" />}
        </button>
      </div>
    </div>
  );
};
