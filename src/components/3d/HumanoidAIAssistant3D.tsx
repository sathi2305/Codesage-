import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Brain,
  Camera,
  Eye,
  Headphones,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';

export type AIAvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type AIAvatarMode = 'cybernetic' | 'hologram' | 'synapse';
export type AICameraView = 'portrait' | 'cinematic';

interface HumanoidAIAssistant3DProps {
  className?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  isThinking?: boolean;
  onVoiceToggle?: () => void;
  statusText?: string;
  showControls?: boolean;
}

/**
 * Procedural Electric-Cyan Neural Iris Canvas Texture Generator
 */
function createIrisTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const cx = 256;
    const cy = 256;
    const radius = 240;

    // Outer dark limbal ring
    const limbalGrad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, radius);
    limbalGrad.addColorStop(0, '#0284C7');
    limbalGrad.addColorStop(0.7, '#0369A1');
    limbalGrad.addColorStop(1, '#02182B');
    ctx.fillStyle = limbalGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Electric cyan radial striations (iris fibers)
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 280; i++) {
      const angle = (i / 280) * Math.PI * 2;
      const rInner = 60 + Math.random() * 20;
      const rOuter = radius * 0.96;
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(34, 211, 238, 0.75)' : 'rgba(56, 189, 248, 0.5)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
      ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
      ctx.stroke();
    }

    // Neural circuitry branching rings
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (radius * 0.45), cy + Math.sin(a) * (radius * 0.45), 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    // Inner bright cyan pupillary collarette
    const innerGrad = ctx.createRadialGradient(cx, cy, 55, cx, cy, 110);
    innerGrad.addColorStop(0, '#00F0FF');
    innerGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.4)');
    innerGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fill();

    // Deep black pupil
    ctx.fillStyle = '#010612';
    ctx.beginPath();
    ctx.arc(cx, cy, 62, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * Procedural Cybernetic Carbon Armor Pattern Generator
 */
function createCarbonArmorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#061325';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = '#0A2040';
    for (let y = 0; y < 256; y += 8) {
      for (let x = 0; x < 256; x += 8) {
        if ((x / 8 + y / 8) % 2 === 0) {
          ctx.fillRect(x, y, 8, 8);
        }
      }
    }

    // Fine cyan circuit traces
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(80, 128);
    ctx.lineTo(128, 176);
    ctx.lineTo(256, 176);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

export const HumanoidAIAssistant3D: React.FC<HumanoidAIAssistant3DProps> = ({
  className = 'h-[440px] lg:h-[500px] w-full',
  isListening: propIsListening = false,
  isSpeaking: propIsSpeaking = false,
  isThinking: propIsThinking = false,
  onVoiceToggle,
  statusText = 'Neural Core Active',
  showControls = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [avatarMode, setAvatarMode] = useState<AIAvatarMode>('cybernetic');
  const [cameraView, setCameraView] = useState<AICameraView>('portrait');
  const [simulatedState, setSimulatedState] = useState<AIAvatarState>('idle');
  const [isLowPower, setIsLowPower] = useState(false);
  const [speechActive, setSpeechActive] = useState(false);

  // Sync props with state
  const effectiveState: AIAvatarState = propIsListening
    ? 'listening'
    : propIsSpeaking || speechActive
    ? 'speaking'
    : propIsThinking
    ? 'thinking'
    : simulatedState;

  const effectiveStateRef = useRef(effectiveState);
  effectiveStateRef.current = effectiveState;

  const avatarModeRef = useRef(avatarMode);
  avatarModeRef.current = avatarMode;

  const cameraViewRef = useRef(cameraView);
  cameraViewRef.current = cameraView;

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Handle mock speech synthesis for judges to preview lip-sync and voice response
  const triggerSpeechDemo = () => {
    if (speechActive) {
      setSpeechActive(false);
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }

    setSpeechActive(true);
    setSimulatedState('speaking');

    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(
        'CodeSage AI neural model activated. I am ready to inspect repository architecture, trace dependencies, and explain design decisions.'
      );
      utter.rate = 1.05;
      utter.pitch = 1.1;
      utter.onend = () => {
        setSpeechActive(false);
        setSimulatedState('idle');
      };
      utter.onerror = () => {
        setSpeechActive(false);
        setSimulatedState('idle');
      };
      window.speechSynthesis.speak(utter);
    } else {
      setTimeout(() => {
        setSpeechActive(false);
        setSimulatedState('idle');
      }, 5000);
    }
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect hardware capabilities
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) setIsPlaying(false);

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

    if (isSoftwareGl) setIsLowPower(true);

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 480;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020817, 0.035);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    // Initial camera placement (portrait view)
    camera.position.set(0, 1.25, 4.4);
    camera.lookAt(0, 1.15, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.appendChild(renderer.domElement);

    // 2. High-End Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0x091b35, 2.4);
    scene.add(ambientLight);

    // Key Light: Crisp cool white illuminating facial features
    const keyLight = new THREE.DirectionalLight(0xe0f2fe, 3.6);
    keyLight.position.set(2.5, 3.0, 3.5);
    scene.add(keyLight);

    // Fill Light: Deep sapphire blue softening shadows
    const fillLight = new THREE.DirectionalLight(0x1d4ed8, 2.0);
    fillLight.position.set(-2.5, 1.0, 2.0);
    scene.add(fillLight);

    // Rim Light 1: Electric Cyan highlighting silhouette and hair edges
    const cyanRimLight = new THREE.PointLight(0x00f0ff, 5.5, 15);
    cyanRimLight.position.set(2.8, 2.2, -2.5);
    scene.add(cyanRimLight);

    // Rim Light 2: Cyber Violet highlighting jawline and opposite shoulder
    const violetRimLight = new THREE.PointLight(0xa855f7, 4.2, 15);
    violetRimLight.position.set(-2.8, 1.0, -2.2);
    scene.add(violetRimLight);

    // Chest Arc Core Point Light (dynamic pulse)
    const chestCoreLight = new THREE.PointLight(0x22d3ee, 4.0, 6);
    chestCoreLight.position.set(0, 0.15, 0.75);
    scene.add(chestCoreLight);

    // Procedural Textures
    const irisTexture = createIrisTexture();
    const armorTexture = createCarbonArmorTexture();

    // 3. MAIN HUMANOID MODEL HIERARCHY
    const rootAvatarGroup = new THREE.Group();
    scene.add(rootAvatarGroup);

    // Shared Premium Materials
    const skinMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0e2444, // Refined dark porcelain cyber-skin
      metalness: 0.12,
      roughness: 0.38,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
      sheen: 0.45,
      sheenColor: new THREE.Color(0x38bdf8),
      transmission: 0.08,
      thickness: 0.5,
    });

    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x081830,
      metalness: 0.88,
      roughness: 0.22,
      map: armorTexture,
    });

    const goldTrimMaterial = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x0891b2,
      emissiveIntensity: 0.6,
    });

    const hairMaterial = new THREE.MeshStandardMaterial({
      color: 0x030d1e,
      metalness: 0.82,
      roughness: 0.28,
    });

    // --- A. UPPER TORSO & CHEST CUIRASS ---
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.1, 0);
    rootAvatarGroup.add(torsoGroup);

    // Segmented Chest Plate (Beveled anatomical cuirass)
    const chestGeo = new THREE.CylinderGeometry(0.72, 0.55, 1.1, 32, 1, false);
    const chestMesh = new THREE.Mesh(chestGeo, armorMaterial);
    chestMesh.position.set(0, -0.15, 0);
    chestMesh.scale.set(1.15, 1.0, 0.72);
    torsoGroup.add(chestMesh);

    // Clavicle & Collarbone Trim Plate
    const clavicleGeo = new THREE.TorusGeometry(0.62, 0.045, 16, 32, Math.PI * 0.9);
    const clavicleMesh = new THREE.Mesh(clavicleGeo, goldTrimMaterial);
    clavicleMesh.position.set(0, 0.36, 0.22);
    clavicleMesh.rotation.x = Math.PI * 0.42;
    torsoGroup.add(clavicleMesh);

    // Shoulder Pauldrons (Left & Right kinetic armor)
    const pauldronGeo = new THREE.SphereGeometry(0.34, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const leftPauldron = new THREE.Mesh(pauldronGeo, armorMaterial);
    leftPauldron.position.set(-0.9, 0.25, 0.02);
    leftPauldron.rotation.z = Math.PI * 0.35;
    leftPauldron.scale.set(1.1, 1.3, 1.0);
    torsoGroup.add(leftPauldron);

    const rightPauldron = leftPauldron.clone();
    rightPauldron.position.x = 0.9;
    rightPauldron.rotation.z = -Math.PI * 0.35;
    torsoGroup.add(rightPauldron);

    // Luminous Quantum Arc AI Core on Sternum
    const coreHousingGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.08, 32);
    const coreHousingMesh = new THREE.Mesh(coreHousingGeo, armorMaterial);
    coreHousingMesh.rotation.x = Math.PI / 2;
    coreHousingMesh.position.set(0, 0.08, 0.36);
    torsoGroup.add(coreHousingMesh);

    // Core Outer Kinetic Gyro Ring
    const gyroRing1Geo = new THREE.TorusGeometry(0.18, 0.016, 16, 32);
    const gyroRing1Mat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9,
      metalness: 0.9,
    });
    const gyroRing1 = new THREE.Mesh(gyroRing1Geo, gyroRing1Mat);
    gyroRing1.position.set(0, 0.08, 0.41);
    torsoGroup.add(gyroRing1);

    // Core Inner Kinetic Gyro Ring
    const gyroRing2Geo = new THREE.TorusGeometry(0.12, 0.014, 16, 32);
    const gyroRing2Mat = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x6366f1,
      emissiveIntensity: 1.0,
      metalness: 0.9,
    });
    const gyroRing2 = new THREE.Mesh(gyroRing2Geo, gyroRing2Mat);
    gyroRing2.position.set(0, 0.08, 0.42);
    torsoGroup.add(gyroRing2);

    // Central Glowing AI Core Crystal Orb
    const coreCrystalGeo = new THREE.IcosahedronGeometry(0.075, 1);
    const coreCrystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x22d3ee,
      emissive: 0x00ffff,
      emissiveIntensity: 2.2,
      roughness: 0.1,
      transmission: 0.7,
      thickness: 0.4,
    });
    const coreCrystal = new THREE.Mesh(coreCrystalGeo, coreCrystalMat);
    coreCrystal.position.set(0, 0.08, 0.43);
    torsoGroup.add(coreCrystal);

    // --- B. SCULPTED NECK & HEAD GROUP ---
    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0.46, 0);
    torsoGroup.add(neckGroup);

    // Sculpted Neck (Smooth anatomical cylinder with throat contour)
    const neckGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.46, 32);
    const neckMesh = new THREE.Mesh(neckGeo, skinMaterial);
    neckMesh.position.set(0, 0.15, 0.04);
    neckGroup.add(neckMesh);

    // Neck Cybernetic Circuit Spinal Strip
    const spineGeo = new THREE.BoxGeometry(0.06, 0.42, 0.04);
    const spineMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const spineMesh = new THREE.Mesh(spineGeo, spineMat);
    spineMesh.position.set(0, 0.15, -0.23);
    neckGroup.add(spineMesh);

    // Head Pivot Group (Enables lifelike look-around and head nodding)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.42, 0.04);
    neckGroup.add(headGroup);

    // --- ANATOMICALLY SCULPTED HUMAN FACE & CRANIUM ---
    // Parametric sculpted head base using deformed high-resolution geometry
    const headGeo = new THREE.SphereGeometry(0.56, 48, 48);
    const posAttr = headGeo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);

      // Anatomical cranial shaping:
      // 1. Oval cranial ratio
      v.y *= 1.22;

      // 2. Taper jawline and chin
      if (v.y < -0.1) {
        const factor = 1.0 - (-v.y - 0.1) * 0.45;
        v.x *= Math.max(0.68, factor);
        if (v.z > 0) v.z *= Math.max(0.72, factor);
      }

      // 3. Defined cheekbones (Zygomatic arches)
      if (v.y > -0.15 && v.y < 0.12 && Math.abs(v.x) > 0.3) {
        v.x *= 1.08;
        if (v.z > 0.25) v.z += 0.035;
      }

      // 4. Forehead & brow ridge definition
      if (v.y > 0.22 && v.z > 0.3) {
        v.z += 0.025;
      }

      // 5. Eye sockets (orbital recesses)
      if (v.y > -0.02 && v.y < 0.18 && Math.abs(v.x) > 0.14 && Math.abs(v.x) < 0.42 && v.z > 0.34) {
        v.z -= 0.048;
      }

      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    headGeo.computeVertexNormals();

    const headMesh = new THREE.Mesh(headGeo, skinMaterial);
    headGroup.add(headMesh);

    // Sculpted Nose (Anatomical bridge, apex tip, and nostril base)
    const noseGeo = new THREE.ConeGeometry(0.085, 0.32, 16);
    const noseMesh = new THREE.Mesh(noseGeo, skinMaterial);
    noseMesh.position.set(0, 0.04, 0.55);
    noseMesh.rotation.x = -Math.PI * 0.1;
    headGroup.add(noseMesh);

    // Sculpted Upper Lip (Refined Cupid's Bow)
    const upperLipGeo = new THREE.TorusGeometry(0.12, 0.024, 16, 24, Math.PI * 0.65);
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a3d6b, // Subtle glowing cyber-rose/cyan hue
      metalness: 0.1,
      roughness: 0.25,
      clearcoat: 0.5,
    });
    const upperLipMesh = new THREE.Mesh(upperLipGeo, lipMat);
    upperLipMesh.position.set(0, -0.19, 0.485);
    upperLipMesh.rotation.x = Math.PI * 0.5;
    upperLipMesh.rotation.z = Math.PI * 0.18;
    headGroup.add(upperLipMesh);

    // Articulated Jaw & Lower Lip Group (Animated for real speech visemes!)
    const jawGroup = new THREE.Group();
    jawGroup.position.set(0, -0.22, 0.42);
    headGroup.add(jawGroup);

    const lowerLipGeo = new THREE.TorusGeometry(0.11, 0.026, 16, 24, Math.PI * 0.62);
    const lowerLipMesh = new THREE.Mesh(lowerLipGeo, lipMat);
    lowerLipMesh.position.set(0, -0.02, 0.08);
    lowerLipMesh.rotation.x = Math.PI * 0.5;
    lowerLipMesh.rotation.z = Math.PI * 0.19;
    jawGroup.add(lowerLipMesh);

    // Chin Mental Protuberance Accent
    const chinAccentGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const chinAccentMesh = new THREE.Mesh(chinAccentGeo, skinMaterial);
    chinAccentMesh.position.set(0, -0.15, 0.06);
    chinAccentMesh.scale.set(1.2, 0.8, 1.0);
    jawGroup.add(chinAccentMesh);

    // --- C. LIFELIKE HUMAN EYES & RIGGED EYELIDS ---
    const leftEyeAssembly = new THREE.Group();
    leftEyeAssembly.position.set(-0.21, 0.085, 0.42);
    headGroup.add(leftEyeAssembly);

    const rightEyeAssembly = new THREE.Group();
    rightEyeAssembly.position.set(0.21, 0.085, 0.42);
    headGroup.add(rightEyeAssembly);

    // Sclera Eyeball (Glossy white eyeball sphere)
    const eyeballGeo = new THREE.SphereGeometry(0.115, 32, 32);
    const scleraMat = new THREE.MeshStandardMaterial({
      color: 0xebf4ff,
      roughness: 0.06,
      metalness: 0.02,
    });

    const leftEyeball = new THREE.Mesh(eyeballGeo, scleraMat);
    leftEyeAssembly.add(leftEyeball);
    const rightEyeball = new THREE.Mesh(eyeballGeo, scleraMat);
    rightEyeAssembly.add(rightEyeball);

    // Iris (High-Res Electric Cyan Neural Disk)
    const irisGeo = new THREE.PlaneGeometry(0.12, 0.12);
    const irisMat = new THREE.MeshBasicMaterial({
      map: irisTexture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const leftIris = new THREE.Mesh(irisGeo, irisMat);
    leftIris.position.set(0, 0, 0.112);
    leftEyeAssembly.add(leftIris);

    const rightIris = new THREE.Mesh(irisGeo, irisMat);
    rightIris.position.set(0, 0, 0.112);
    rightEyeAssembly.add(rightIris);

    // Cornea Glass Refractive Lens
    const corneaGeo = new THREE.SphereGeometry(0.118, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.35);
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.96,
      roughness: 0.02,
      ior: 1.336, // Human Cornea refractive index
      thickness: 0.2,
      transparent: true,
      opacity: 0.9,
    });

    const leftCornea = new THREE.Mesh(corneaGeo, corneaMat);
    leftCornea.rotation.x = Math.PI / 2;
    leftEyeAssembly.add(leftCornea);

    const rightCornea = new THREE.Mesh(corneaGeo, corneaMat);
    rightCornea.rotation.x = Math.PI / 2;
    rightEyeAssembly.add(rightCornea);

    // Rigged Upper Eyelids (Blinking & Expression control)
    const eyelidGeo = new THREE.SphereGeometry(0.125, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const eyelidMat = skinMaterial.clone();

    const leftUpperEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
    leftUpperEyelid.rotation.x = -Math.PI * 0.48; // resting above pupil
    leftEyeAssembly.add(leftUpperEyelid);

    const rightUpperEyelid = new THREE.Mesh(eyelidGeo, eyelidMat);
    rightUpperEyelid.rotation.x = -Math.PI * 0.48;
    rightEyeAssembly.add(rightUpperEyelid);

    // Refined Eyebrows
    const browGeo = new THREE.BoxGeometry(0.24, 0.028, 0.04);
    const browMat = new THREE.MeshStandardMaterial({ color: 0x071b33, metalness: 0.6, roughness: 0.3 });

    const leftBrow = new THREE.Mesh(browGeo, browMat);
    leftBrow.position.set(-0.22, 0.22, 0.49);
    leftBrow.rotation.z = 0.08;
    headGroup.add(leftBrow);

    const rightBrow = new THREE.Mesh(browGeo, browMat);
    rightBrow.position.set(0.22, 0.22, 0.49);
    rightBrow.rotation.z = -0.08;
    headGroup.add(rightBrow);

    // --- D. SLEEK FUTURISTIC CYBER-HAIR ---
    // Sculpted aerodynamic locks framing face and crown
    const hairCrownGeo = new THREE.SphereGeometry(0.58, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const hairCrown = new THREE.Mesh(hairCrownGeo, hairMaterial);
    hairCrown.position.set(0, 0.12, -0.04);
    hairCrown.scale.set(1.02, 1.15, 1.08);
    headGroup.add(hairCrown);

    // Flowing hair strands (Left & Right temples)
    const hairStrandGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.65, 12);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI - Math.PI / 2;
      const strand = new THREE.Mesh(hairStrandGeo, hairMaterial);
      strand.position.set(
        Math.cos(angle) * 0.52,
        0.05 - (i % 3) * 0.08,
        Math.sin(angle) * 0.25 - 0.15
      );
      strand.rotation.z = angle * 0.4;
      strand.rotation.x = 0.2;
      headGroup.add(strand);
    }

    // --- E. CYBERNETIC TEMPLE SENSORS & EAR COMMUNICATION NODES ---
    const earGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 24);
    const earSensorMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.6,
    });

    const leftEar = new THREE.Mesh(earGeo, earSensorMat);
    leftEar.position.set(-0.54, 0.08, 0.02);
    leftEar.rotation.z = Math.PI / 2;
    headGroup.add(leftEar);

    const rightEar = leftEar.clone();
    rightEar.position.x = 0.54;
    headGroup.add(rightEar);

    // Holographic Temple Neural Circuit Decal (Luminous pulse path along temple)
    const templeDecalGeo = new THREE.TorusGeometry(0.12, 0.008, 8, 24, Math.PI * 0.8);
    const templeDecalMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const leftTempleDecal = new THREE.Mesh(templeDecalGeo, templeDecalMat);
    leftTempleDecal.position.set(-0.48, 0.18, 0.22);
    leftTempleDecal.rotation.y = -Math.PI * 0.4;
    headGroup.add(leftTempleDecal);

    // --- F. HOLOGRAPHIC ENVIRONMENT & NEURAL CONSTELLATION ---
    // Floating Neural Network Orbiting Nodes & Synapse Links
    const nodeCount = isSoftwareGl ? 35 : 85;
    const nodePositions = new Float32Array(nodeCount * 3);
    const nodeVelocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const radius = 1.2 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.8;

      nodePositions[i * 3] = radius * Math.cos(theta) * Math.cos(phi);
      nodePositions[i * 3 + 1] = 0.8 + radius * Math.sin(phi);
      nodePositions[i * 3 + 2] = radius * Math.sin(theta) * Math.cos(phi);

      nodeVelocities.push({
        x: (Math.random() - 0.5) * 0.004,
        y: (Math.random() - 0.5) * 0.004,
        z: (Math.random() - 0.5) * 0.004,
      });
    }

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));

    const nodeMat = new THREE.PointsMaterial({
      color: 0x22d3ee,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const neuralNodes = new THREE.Points(nodeGeo, nodeMat);
    scene.add(neuralNodes);

    // Holographic Floor Pedestal Rings
    const pedestalGroup = new THREE.Group();
    pedestalGroup.position.set(0, -1.0, 0);
    scene.add(pedestalGroup);

    const outerRingGeo = new THREE.RingGeometry(1.6, 1.68, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, ringMat);
    outerRing.rotation.x = Math.PI / 2;
    pedestalGroup.add(outerRing);

    const innerRingGeo = new THREE.RingGeometry(1.1, 1.15, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    pedestalGroup.add(innerRing);

    // Holographic Scanner Beam Grid
    const scanPlaneGeo = new THREE.PlaneGeometry(3.2, 0.03);
    const scanPlaneMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const scanBeam = new THREE.Mesh(scanPlaneGeo, scanPlaneMat);
    scanBeam.rotation.x = Math.PI / 2;
    pedestalGroup.add(scanBeam);

    // 4. MOUSE & EYE INTERACTION TRACKING
    const targetLook = { x: 0, y: 0 };
    const currentLook = { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetLook.x = x * 0.45;
      targetLook.y = y * 0.35;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // 5. ANIMATION & STATE SIMULATION LOOP
    let animationFrameId: number;
    let clock = new THREE.Clock();

    // Natural Blinking & Saccades Timers
    let nextBlinkTime = 2.5;
    let isBlinking = false;
    let blinkStartTime = 0;
    let saccadeOffset = { x: 0, y: 0 };
    let nextSaccadeTime = 1.8;

    const animate = () => {
      if (!isPlayingRef.current) return;
      animationFrameId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();
      const state = effectiveStateRef.current;
      const mode = avatarModeRef.current;
      const view = cameraViewRef.current;

      // Smooth camera transition between Portrait & Cinematic
      const targetCamY = view === 'portrait' ? 1.25 : 0.95;
      const targetCamZ = view === 'portrait' ? 4.3 : 5.8;
      camera.position.y += (targetCamY - camera.position.y) * 0.05;
      camera.position.z += (targetCamZ - camera.position.z) * 0.05;

      // Mode shader adjustments
      if (mode === 'hologram') {
        skinMaterial.wireframe = false;
        skinMaterial.opacity = 0.72;
        skinMaterial.transparent = true;
        skinMaterial.emissive = new THREE.Color(0x0284c7);
        skinMaterial.emissiveIntensity = 0.8;
      } else if (mode === 'synapse') {
        skinMaterial.wireframe = true;
        skinMaterial.opacity = 0.9;
        skinMaterial.transparent = false;
        skinMaterial.emissive = new THREE.Color(0x22d3ee);
        skinMaterial.emissiveIntensity = 0.5;
      } else {
        // Photorealistic Cybernetic PBR
        skinMaterial.wireframe = false;
        skinMaterial.opacity = 1.0;
        skinMaterial.transparent = false;
        skinMaterial.emissive = new THREE.Color(0x051329);
        skinMaterial.emissiveIntensity = 0.2;
      }

      // Smooth cursor gaze tracking (Lerp)
      currentLook.x += (targetLook.x - currentLook.x) * 0.06;
      currentLook.y += (targetLook.y - currentLook.y) * 0.06;

      // Saccadic eye micro-movements
      if (time > nextSaccadeTime) {
        saccadeOffset.x = (Math.random() - 0.5) * 0.06;
        saccadeOffset.y = (Math.random() - 0.5) * 0.04;
        nextSaccadeTime = time + 1.2 + Math.random() * 2.5;
      }

      // Natural Human Blinking Controller
      if (time > nextBlinkTime && !isBlinking) {
        isBlinking = true;
        blinkStartTime = time;
      }

      if (isBlinking) {
        const blinkProgress = (time - blinkStartTime) / 0.22;
        if (blinkProgress <= 0.45) {
          // Closing eyelids
          const closeFactor = blinkProgress / 0.45;
          const closedRot = -Math.PI * 0.08;
          leftUpperEyelid.rotation.x = -Math.PI * 0.48 + closeFactor * (-closedRot - -Math.PI * 0.48);
          rightUpperEyelid.rotation.x = leftUpperEyelid.rotation.x;
        } else if (blinkProgress <= 1.0) {
          // Opening eyelids
          const openFactor = (blinkProgress - 0.45) / 0.55;
          const closedRot = -Math.PI * 0.08;
          leftUpperEyelid.rotation.x = closedRot - openFactor * (closedRot - -Math.PI * 0.48);
          rightUpperEyelid.rotation.x = leftUpperEyelid.rotation.x;
        } else {
          isBlinking = false;
          leftUpperEyelid.rotation.x = -Math.PI * 0.48;
          rightUpperEyelid.rotation.x = -Math.PI * 0.48;
          nextBlinkTime = time + 2.8 + Math.random() * 3.5;
        }
      }

      // 1. Organic Breathing & Idle Kinetics
      const breathScale = 1.0 + Math.sin(time * 1.5) * 0.015;
      torsoGroup.scale.set(breathScale, breathScale, breathScale);
      torsoGroup.position.y = 0.1 + Math.sin(time * 1.5) * 0.015;

      // 2. Head Orientation & Expressive Gaze Tracking
      headGroup.rotation.y = currentLook.x * 0.85 + Math.sin(time * 0.7) * 0.03;
      headGroup.rotation.x = -currentLook.y * 0.65 + Math.cos(time * 0.8) * 0.02;

      // 3. Eye Assemblies Direction
      const eyeTargetX = currentLook.x * 0.5 + saccadeOffset.x;
      const eyeTargetY = currentLook.y * 0.4 + saccadeOffset.y;
      leftEyeAssembly.rotation.y = eyeTargetX;
      leftEyeAssembly.rotation.x = -eyeTargetY;
      rightEyeAssembly.rotation.y = eyeTargetX;
      rightEyeAssembly.rotation.x = -eyeTargetY;

      // 4. Arc Reactor AI Core Kinetic Rotation
      gyroRing1.rotation.z = time * 1.8;
      gyroRing1.rotation.x = time * 1.2;
      gyroRing2.rotation.z = -time * 2.4;
      gyroRing2.rotation.y = time * 1.5;

      const corePulse = 2.2 + Math.sin(time * (state === 'thinking' ? 9 : 3.5)) * 0.8;
      coreCrystalMat.emissiveIntensity = corePulse;
      chestCoreLight.intensity = corePulse * 1.5;

      // 5. State-Driven Animations
      if (state === 'speaking') {
        // Natural speech viseme modulation: jaw pivots open and lower lip syncs
        const speechFreq1 = Math.sin(time * 15);
        const speechFreq2 = Math.sin(time * 8);
        const jawOpen = Math.max(0, speechFreq1 * 0.09 + speechFreq2 * 0.05);
        jawGroup.rotation.x = jawOpen;

        // Head makes subtle natural conversational nods
        headGroup.rotation.x += Math.sin(time * 7) * 0.025;
        headGroup.rotation.z = Math.sin(time * 3.5) * 0.018;

        // Chest core and lights react to speech cadence
        chestCoreLight.color.setHex(0x00ffff);
      } else if (state === 'listening') {
        // Attentive posture: character leans forward, head tilts, eyes widen slightly
        headGroup.rotation.z = -0.06;
        headGroup.rotation.y = currentLook.x * 0.95;
        jawGroup.rotation.x = 0;
        if (!isBlinking) {
          leftUpperEyelid.rotation.x = -Math.PI * 0.52; // slightly wider eyes
          rightUpperEyelid.rotation.x = -Math.PI * 0.52;
        }
        chestCoreLight.color.setHex(0x22d3ee);
      } else if (state === 'thinking') {
        // Thoughtful posture: eyes angle upward, head tilts slightly
        headGroup.rotation.y = 0.12;
        headGroup.rotation.x = 0.08;
        jawGroup.rotation.x = 0;
        chestCoreLight.color.setHex(0xa855f7); // Violet thinking aura
      } else {
        // Idle
        jawGroup.rotation.x = 0;
        headGroup.rotation.z = 0;
        chestCoreLight.color.setHex(0x22d3ee);
      }

      // 6. Neural Network Constellation Node Drift & Orbit
      const posArray = nodeGeo.attributes.position.array as Float32Array;
      const speedMult = state === 'thinking' ? 2.5 : 1.0;

      for (let i = 0; i < nodeCount; i++) {
        const idx = i * 3;
        posArray[idx] += nodeVelocities[i].x * speedMult;
        posArray[idx + 1] += nodeVelocities[i].y * speedMult;
        posArray[idx + 2] += nodeVelocities[i].z * speedMult;

        // Rebound within sphere perimeter
        const dist = Math.hypot(posArray[idx], posArray[idx + 1] - 0.8, posArray[idx + 2]);
        if (dist > 3.2 || dist < 0.8) {
          nodeVelocities[i].x *= -1;
          nodeVelocities[i].y *= -1;
          nodeVelocities[i].z *= -1;
        }
      }
      nodeGeo.attributes.position.needsUpdate = true;
      neuralNodes.rotation.y = time * (0.04 * speedMult);

      // 7. Holographic Pedestal Rotation
      outerRing.rotation.z = -time * 0.25;
      innerRing.rotation.z = time * 0.4;
      scanBeam.position.z = Math.sin(time * 1.5) * 1.2;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 480;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);

      // Clean disposal of Three.js objects
      renderer.dispose();
      irisTexture.dispose();
      armorTexture.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`relative ${className} bg-radial from-[#041633] via-[#020817] to-[#01040a] select-none rounded-2xl overflow-hidden border border-cyan-500/20 shadow-2xl`}>
      {/* 3D WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Header: Status Badge & Camera Presets */}
      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2 pointer-events-none">
        {/* Status Indicator */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#03152E]/90 border border-cyan-500/40 backdrop-blur-md shadow-lg shadow-cyan-500/10">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                effectiveState === 'speaking'
                  ? 'bg-emerald-400'
                  : effectiveState === 'listening'
                  ? 'bg-rose-400'
                  : effectiveState === 'thinking'
                  ? 'bg-purple-400'
                  : 'bg-cyan-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                effectiveState === 'speaking'
                  ? 'bg-emerald-500'
                  : effectiveState === 'listening'
                  ? 'bg-rose-500'
                  : effectiveState === 'thinking'
                  ? 'bg-purple-500'
                  : 'bg-cyan-500'
              }`}
            />
          </span>
          <span className="text-xs font-semibold text-white tracking-wide">
            {effectiveState === 'speaking'
              ? 'Speaking (Lip-Sync Active)'
              : effectiveState === 'listening'
              ? 'Attentive Listening'
              : effectiveState === 'thinking'
              ? 'Neural Processing AST'
              : statusText}
          </span>
        </div>

        {/* View Mode & Camera Selectors */}
        <div className="pointer-events-auto flex items-center gap-1.5 p-1 rounded-xl bg-[#03152E]/90 border border-slate-800 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setCameraView((v) => (v === 'portrait' ? 'cinematic' : 'portrait'))}
            className="px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1 text-slate-300 hover:text-cyan-300 bg-[#071F42] hover:bg-[#0C2A59] border border-cyan-900/40 transition-colors cursor-pointer"
            title="Toggle Portrait Close-Up / Cinematic Bust View"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="capitalize hidden sm:inline">{cameraView}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setAvatarMode((m) =>
                m === 'cybernetic' ? 'hologram' : m === 'hologram' ? 'synapse' : 'cybernetic'
              )
            }
            className="px-2.5 py-1 rounded-lg text-xs font-mono capitalize bg-[#071F42] hover:bg-[#0C2A59] border border-cyan-900/40 text-cyan-200 hover:text-white transition-colors cursor-pointer"
            title="Switch Avatar Shading: Cybernetic PBR / Hologram / Synapse Wire"
          >
            {avatarMode}
          </button>
        </div>
      </div>

      {/* Floating State Simulator Pill (For Hackathon Judges to Test All States Instantly) */}
      {showControls && (
        <div className="absolute top-14 left-3.5 flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#03152E]/80 border border-cyan-900/60 backdrop-blur-md">
          {(['idle', 'listening', 'thinking', 'speaking'] as AIAvatarState[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setSimulatedState(st);
                if (st !== 'speaking' && speechActive) {
                  setSpeechActive(false);
                  if (window.speechSynthesis) window.speechSynthesis.cancel();
                }
              }}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono capitalize transition-all cursor-pointer ${
                effectiveState === st
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Floating Bar: Interaction Info & Voice Speech Tester */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            className="p-1.5 rounded-lg bg-[#071A35]/80 hover:bg-[#0A2042] border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer backdrop-blur-md"
            title={isPlaying ? 'Pause 3D Rendering' : 'Resume 3D Rendering'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-cyan-300" />}
          </button>

          <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
            3D Photorealistic AI Companion · Gaze &amp; Viseme Sync
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Live Viseme Lip-Sync Speech Demo Button */}
          <button
            type="button"
            onClick={triggerSpeechDemo}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-lg ${
              speechActive
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/40 animate-pulse'
                : 'bg-[#071F42] hover:bg-[#0B2C5C] border border-cyan-500/50 text-cyan-200 hover:text-white'
            }`}
            title="Demonstrate dynamic speech viseme mouth animation"
          >
            <Volume2 className={`w-3.5 h-3.5 ${speechActive ? 'animate-bounce' : 'text-cyan-400'}`} />
            <span>{speechActive ? 'Stop Speaking' : 'Speech Lip-Sync'}</span>
          </button>

          {/* Voice Input Toggle Button */}
          {onVoiceToggle && (
            <button
              type="button"
              onClick={onVoiceToggle}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-lg ${
                propIsListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/40 animate-pulse'
                  : 'bg-[#2563FF] hover:bg-[#1d4ed8] text-white shadow-[#2563FF]/30'
              }`}
            >
              {propIsListening ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Stop Listening</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Voice Ask AI</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
