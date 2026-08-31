// Aphex Landing — Particle System
// Three.js r171 particle animation with logo coalesce and mouse interaction

import * as THREE from 'three';

declare global {
  interface Window {
    __NO_WEBGL?: boolean;
  }
}

interface LogoTargets {
  positions: Float32Array;
  aspect: number;
}

/**
 * Generate target positions for particles by sampling filled pixels
 * from the APHEX logo drawn on an offscreen canvas.
 */
function generateLogoTargets(particleCount: number): LogoTargets {
  const W = 1200;
  const H = 300;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // --- Letter metrics ---
  // 5 letters, each ~210px wide, with ~37px gaps between them
  // Total: 5*210 + 4*37 = 1050+148 = 1198 ~ 1200
  const letterWidth = 210;
  const gap = 37;
  const padTop = 30;
  const letterHeight = H - padTop * 2; // 240px tall
  const stroke = 42; // stroke thickness for heavy/black weight

  function letterX(index: number): number {
    return index * (letterWidth + gap) + (W - (5 * letterWidth + 4 * gap)) / 2;
  }

  // Shared metrics for bar alignment across P, H, E
  // E divides letterHeight into 5 equal bands: bar, gap, bar, gap, bar
  const bandH = letterHeight / 5;
  const midBarY = padTop + bandH * 2;  // Y position of middle bar (shared by P, H, E)
  const midBarH = bandH;               // thickness for E's free-floating bars
  const crossBarH = bandH * 0.7;       // optically corrected: thinner for H/P where bars are enclosed

  ctx.fillStyle = '#fff';

  // ---- A: Wide triangular, pointed top, NO crossbar ----
  (function drawA(): void {
    const x0 = letterX(0);
    const cx = x0 + letterWidth / 2;
    const top = padTop;
    const bot = padTop + letterHeight;
    // outer triangle
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(x0 + letterWidth, bot);
    ctx.lineTo(x0, bot);
    ctx.closePath();
    ctx.fill();
    // cut out inner triangle — inner peak aligns with top of E's middle bar
    const inset = stroke * 1.35;
    const innerTop = midBarY;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(cx, innerTop);
    ctx.lineTo(x0 + letterWidth - inset, bot);
    ctx.lineTo(x0 + inset, bot);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  })();

  // ---- P: ≡-style with short bottom stub evoking a P's descending stem ----
  (function drawP(): void {
    const x0 = letterX(1);
    const top = padTop;

    // Top bar (full width, same as E)
    ctx.fillRect(x0, top, letterWidth, midBarH);
    // Middle bar (full width, same as E)
    ctx.fillRect(x0, midBarY, letterWidth, midBarH);
    // Bottom stub — left-aligned, same width as vertical stems
    ctx.fillRect(x0, top + bandH * 4, stroke, midBarH);
  })();

  // ---- H: Block H — crossbar aligns with E's middle bar ----
  (function drawH(): void {
    const x0 = letterX(2);
    const top = padTop;
    const bottom = top + letterHeight - midBarH;
    const rightX = x0 + letterWidth - stroke;

    // Four corner stubs (same width as stroke)
    ctx.fillRect(x0, top, stroke, midBarH);        // top-left
    ctx.fillRect(rightX, top, stroke, midBarH);     // top-right
    ctx.fillRect(x0, bottom, stroke, midBarH);      // bottom-left
    ctx.fillRect(rightX, bottom, stroke, midBarH);  // bottom-right
    // Floating crossbar — same as E's middle bar
    ctx.fillRect(x0, midBarY, letterWidth, midBarH);
  })();

  // ---- E: Three independent horizontal bars (≡ style, NO left vertical stem) ----
  (function drawE(): void {
    const x0 = letterX(3);
    const top = padTop;

    // Top bar
    ctx.fillRect(x0, top, letterWidth, midBarH);
    // Middle bar (same position shared with P and H)
    ctx.fillRect(x0, midBarY, letterWidth, midBarH);
    // Bottom bar
    ctx.fillRect(x0, top + bandH * 4, letterWidth, midBarH);
  })();

  // ---- X: Two thick diagonal strokes crossing ----
  (function drawX(): void {
    const x0 = letterX(4);
    const top = padTop;
    const bot = padTop + letterHeight;
    const hw = stroke * 1.1; // half-width of each stroke at endpoints

    // Forward slash stroke (\\)
    ctx.beginPath();
    ctx.moveTo(x0, top);
    ctx.lineTo(x0 + hw, top);
    ctx.lineTo(x0 + letterWidth, bot);
    ctx.lineTo(x0 + letterWidth - hw, bot);
    ctx.closePath();
    ctx.fill();

    // Back slash stroke (/)
    ctx.beginPath();
    ctx.moveTo(x0 + letterWidth - hw, top);
    ctx.lineTo(x0 + letterWidth, top);
    ctx.lineTo(x0 + hw, bot);
    ctx.lineTo(x0, bot);
    ctx.closePath();
    ctx.fill();
  })();

  // --- Pixel sampling ---
  const imageData = ctx.getImageData(0, 0, W, H);
  const pixels = imageData.data;

  // Collect all filled pixel coordinates
  const filled: number[] = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      if (pixels[idx + 3] > 128) {
        filled.push(x, y);
      }
    }
  }

  const filledCount = filled.length / 2;
  if (filledCount === 0) {
    // Safety fallback: return centered zeros
    return { positions: new Float32Array(particleCount * 3), aspect: W / H };
  }

  // Map pixel coordinates to 3D world coordinates
  // Logo spans ~10 world units wide, centered at origin
  const worldWidth = 10;
  const scale = worldWidth / W;
  const offsetX = -worldWidth / 2;
  const offsetY = (H * scale) / 2;

  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const ri = Math.floor(Math.random() * filledCount);
    const px = filled[ri * 2];
    const py = filled[ri * 2 + 1];

    positions[i * 3]     = px * scale + offsetX;
    positions[i * 3 + 1] = -(py * scale) + offsetY; // flip Y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.15; // small z-offset
  }

  return { positions: positions, aspect: W / H };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
(function main(): void {
  'use strict';

  // Skip if WebGL detection already failed
  if (window.__NO_WEBGL) return;

  // --- Device detection ---
  const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 1;
  const PARTICLE_COUNT = isMobile ? 4000 : 8000;
  const DRIFT_DURATION = isMobile ? 2.0 : 4.0; // seconds
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Generate logo target positions ---
  const logo = generateLogoTargets(PARTICLE_COUNT);
  const logoPositions = logo.positions; // Float32Array, length = PARTICLE_COUNT * 3

  // --- Three.js setup ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  // 3D fog — thick during drift phase so particles glow through mist,
  // fades away during coalesce so the logo is bright and crisp.
  // Density is animated in the render loop.
  const DRIFT_FOG_DENSITY = 0.06;  // atmospheric during drift
  const REST_FOG_DENSITY  = 0.005; // nearly invisible when logo is displayed
  const fog = new THREE.FogExp2(0x111111, DRIFT_FOG_DENSITY);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Prepend canvas to body (before other elements)
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  // --- Particle geometry ---
  const geometry = new THREE.BufferGeometry();
  const SCATTER_RADIUS = 15;

  const currentPositions = new Float32Array(PARTICLE_COUNT * 3);
  const scatterPositions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities       = new Float32Array(PARTICLE_COUNT * 3); // starts at 0
  const sizes            = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    // Random scatter positions (spherical-ish distribution)
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = SCATTER_RADIUS * Math.cbrt(Math.random()); // cube root for uniform volume
    const sx = r * Math.sin(phi) * Math.cos(theta);
    const sy = r * Math.sin(phi) * Math.sin(theta);
    const sz = r * Math.cos(phi);

    scatterPositions[i * 3]     = sx;
    scatterPositions[i * 3 + 1] = sy;
    scatterPositions[i * 3 + 2] = sz;

    // Current positions start at scatter positions
    currentPositions[i * 3]     = sx;
    currentPositions[i * 3 + 1] = sy;
    currentPositions[i * 3 + 2] = sz;

    // Per-particle size variation
    sizes[i] = 0.09 + Math.random() * 0.06;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // --- Custom glow shader material with fog support ---
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      fogColor: { value: new THREE.Color(0x111111) },
      fogDensity: { value: DRIFT_FOG_DENSITY },
    },
    vertexShader: `
      attribute float size;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float fogDensity;
      varying float vAlpha;
      varying float vFlicker;
      varying float vFogFactor;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = -mvPosition.z;

        // Per-particle flicker based on position hash + time
        float hash = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
        vFlicker = 0.6 + 0.4 * sin(uTime * (3.0 + hash * 5.0) + hash * 6.283);

        // Size with distance attenuation — big for visible glow halo
        float baseSize = size * 800.0 * uPixelRatio;
        gl_PointSize = max(baseSize / dist, 2.0);

        // Alpha — keep bright
        vAlpha = clamp(2.5 / dist, 0.3, 1.0);

        // Fog: exponential squared
        float fogDepth = length(mvPosition.xyz);
        vFogFactor = 1.0 - exp(-fogDensity * fogDensity * fogDepth * fogDepth);

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 fogColor;
      varying float vAlpha;
      varying float vFlicker;
      varying float vFogFactor;

      void main() {
        // Distance from center of point sprite (0 at center, 1 at edge)
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center) * 2.0;

        // Soft gaussian glow — bright core fading to soft halo
        float core = exp(-dist * dist * 6.0);   // tight bright center
        float halo = exp(-dist * dist * 1.5);   // wider soft glow
        float glow = core * 0.8 + halo * 0.4;

        // Apply flicker
        glow *= vFlicker;

        // Slight cool tint at the edges of the halo
        vec3 color = mix(vec3(1.0, 1.0, 1.0), vec3(0.85, 0.9, 1.0), dist * 0.5);

        // Mix with fog
        vec3 finalColor = mix(color * glow, fogColor, vFogFactor);

        gl_FragColor = vec4(finalColor, glow * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });

  // --- Points mesh ---
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // --- Ambient point lights for subtle 3D illumination ---
  const pointLight1 = new THREE.PointLight(0xffffff, 0.4, 30);
  const pointLight2 = new THREE.PointLight(0xaaccff, 0.3, 25);
  const pointLight3 = new THREE.PointLight(0xffeedd, 0.2, 20);
  scene.add(pointLight1, pointLight2, pointLight3);

  // --- Camera positions for each phase ---
  // Compute rest distance dynamically so the logo (10 world units wide) always
  // fits within the viewport with 20% padding, regardless of aspect ratio.
  const LOGO_WORLD_WIDTH = 10;
  const LOGO_PADDING = 1.3; // 30% breathing room
  const halfFovRad = (camera.fov / 2) * Math.PI / 180;

  const BASE_REST_Z = 12;

  function computeRestZ(): number {
    const minZ = (LOGO_WORLD_WIDTH * LOGO_PADDING / 2) / (Math.tan(halfFovRad) * camera.aspect);
    return Math.max(BASE_REST_Z, minZ); // never closer than 12 on wide screens
  }

  const CAM_DRIFT_START  = new THREE.Vector3(0, 0, 5);    // inside the cloud
  const CAM_DRIFT_END    = new THREE.Vector3(0.5, 0.3, 8);
  const CAM_REST         = new THREE.Vector3(0, 0, computeRestZ());

  camera.position.copy(CAM_DRIFT_START);

  // --- Resize handler ---
  window.addEventListener('resize', function (): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    // Recompute rest distance for new aspect ratio
    CAM_REST.z = computeRestZ();
  });

  // --- Mouse/touch interaction ---
  const PUSH_RADIUS = 0.45;
  const PUSH_STRENGTH = 0.15;
  const SPRING_STIFFNESS = 0.03;
  const DAMPING = 0.85;

  const mouseWorld = new THREE.Vector3(9999, 9999, 0); // offscreen
  const mouseNDC = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const intersectPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z=0 plane
  const intersectPoint = new THREE.Vector3();

  function updateMouse(clientX: number, clientY: number): void {
    mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouseNDC, camera);
    if (raycaster.ray.intersectPlane(intersectPlane, intersectPoint)) {
      mouseWorld.copy(intersectPoint);
    }
  }

  if (!reducedMotion) {
    window.addEventListener('mousemove', function (e: MouseEvent): void {
      updateMouse(e.clientX, e.clientY);
    });
    window.addEventListener('touchmove', function (e: TouchEvent): void {
      e.preventDefault();
      if (e.touches.length > 0) {
        updateMouse(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    window.addEventListener('touchend', function (): void {
      mouseWorld.set(9999, 9999, 0);
    });
  }

  // --- Show mode (kiosk display: logo + Instagram QR) ---
  // The inline script in index.html sets the class from ?show / #show.
  const showMode = document.documentElement.classList.contains('show-mode');

  if (showMode) {
    // Lift the logo above center so the QR code has room underneath
    points.position.y = 1.3;

    // Keep the display awake during shows (best effort; Guided Access is the
    // robust fallback on iPad)
    if ('wakeLock' in navigator) {
      const requestWakeLock = function (): void {
        navigator.wakeLock.request('screen').catch(function (): void { /* ignore */ });
      };
      requestWakeLock();
      document.addEventListener('visibilitychange', function (): void {
        if (!document.hidden) requestWakeLock();
      });
    }
  }

  // --- Phase management ---
  const COALESCE_DURATION = 5.5; // seconds — slow, organic gathering
  let phase: string;
  let phaseStartTime: number;
  const overlay = document.getElementById(showMode ? 'show-overlay' : 'email-overlay');
  let overlayShown = false;

  // Cubic ease-out: 1 - (1 - t)^3
  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // Smooth ease-in-out for natural camera arcs
  function easeInOutQuart(t: number): number {
    return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
  }

  // Linear interpolation helper
  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // --- Reduced motion: skip animation entirely ---
  if (reducedMotion) {
    phase = 'rest';
    phaseStartTime = performance.now() / 1000;
    // Set particles directly to logo targets
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      currentPositions[i * 3]     = logoPositions[i * 3];
      currentPositions[i * 3 + 1] = logoPositions[i * 3 + 1];
      currentPositions[i * 3 + 2] = logoPositions[i * 3 + 2];
    }
    (geometry.attributes.position as import('three').BufferAttribute).needsUpdate = true;
    camera.position.copy(CAM_REST);
    // Show overlay immediately
    if (overlay) {
      overlay.classList.add('visible');
      overlayShown = true;
    }
  } else {
    phase = 'drift';
    phaseStartTime = performance.now() / 1000;
  }

  // --- Pre-compute per-particle stagger for coalesce ---
  const staggerOffsets = new Float32Array(PARTICLE_COUNT);
  (function computeStagger(): void {
    // Particles closer to their target arrive sooner
    let maxDist = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const dx = scatterPositions[i * 3]     - logoPositions[i * 3];
      const dy = scatterPositions[i * 3 + 1] - logoPositions[i * 3 + 1];
      const dz = scatterPositions[i * 3 + 2] - logoPositions[i * 3 + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      staggerOffsets[i] = d;
      if (d > maxDist) maxDist = d;
    }
    // Normalize to 0..1  (0 = arrives first, 1 = arrives last)
    if (maxDist > 0) {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        staggerOffsets[i] /= maxDist;
      }
    }
  })();

  // Snapshot of camera at start of coalesce (set when transitioning)
  const camCoalesceStart = new THREE.Vector3();

  // --- Animate ---
  function animate(): void {
    requestAnimationFrame(animate);

    const now = performance.now() / 1000;
    const elapsed = now - phaseStartTime;

    const posAttr = geometry.attributes.position as import('three').BufferAttribute;

    if (phase === 'drift') {
      // --- Drift phase ---
      const t = Math.min(elapsed / DRIFT_DURATION, 1);

      // Camera interpolation
      camera.position.lerpVectors(CAM_DRIFT_START, CAM_DRIFT_END, t);

      // Full fog during drift — particles glow through the mist
      fog.density = DRIFT_FOG_DENSITY;
      material.uniforms.fogDensity.value = DRIFT_FOG_DENSITY;

      // Velocity-based drift with brownian motion and mouse push
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const px = currentPositions[i3];
        const py = currentPositions[i3 + 1];
        const pz = currentPositions[i3 + 2];

        // Brownian: small random velocity additions
        velocities[i3]     += (Math.random() - 0.5) * 0.004;
        velocities[i3 + 1] += (Math.random() - 0.5) * 0.004;
        velocities[i3 + 2] += (Math.random() - 0.5) * 0.002;

        // Gentle spring back to scatter positions
        velocities[i3]     += (scatterPositions[i3]     - px) * 0.005;
        velocities[i3 + 1] += (scatterPositions[i3 + 1] - py) * 0.005;
        velocities[i3 + 2] += (scatterPositions[i3 + 2] - pz) * 0.005;

        // Mouse push force
        const dmx = px - mouseWorld.x;
        const dmy = py - mouseWorld.y;
        const distMouse = Math.sqrt(dmx * dmx + dmy * dmy);
        if (distMouse < PUSH_RADIUS && distMouse > 0.001) {
          const pushForce = PUSH_STRENGTH / (distMouse * distMouse);
          velocities[i3]     += (dmx / distMouse) * pushForce;
          velocities[i3 + 1] += (dmy / distMouse) * pushForce;
        }

        // Apply damping and integrate
        velocities[i3]     *= DAMPING;
        velocities[i3 + 1] *= DAMPING;
        velocities[i3 + 2] *= DAMPING;
        currentPositions[i3]     += velocities[i3];
        currentPositions[i3 + 1] += velocities[i3 + 1];
        currentPositions[i3 + 2] += velocities[i3 + 2];
      }
      posAttr.needsUpdate = true;

      // Transition to coalesce
      if (t >= 1) {
        phase = 'coalesce';
        phaseStartTime = now;
        camCoalesceStart.copy(camera.position);
      }

    } else if (phase === 'coalesce') {
      // --- Coalesce phase ---
      const rawT = Math.min(elapsed / COALESCE_DURATION, 1);

      // Camera: cubic ease-out toward rest
      const camT = easeOutCubic(rawT);
      camera.position.lerpVectors(camCoalesceStart, CAM_REST, camT);

      // Fade fog out as logo forms — lerp density from drift → rest
      const coalesceFogDensity = DRIFT_FOG_DENSITY + (REST_FOG_DENSITY - DRIFT_FOG_DENSITY) * easeOutCubic(rawT);
      fog.density = coalesceFogDensity;
      material.uniforms.fogDensity.value = coalesceFogDensity;

      // Per-particle interpolation with stagger
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        // stagger: particle's local progress (delayed by distance)
        const staggerDelay = staggerOffsets[i] * 0.4; // max 40% delay
        const localT = Math.min(Math.max((rawT - staggerDelay) / (1 - staggerDelay), 0), 1);
        const eased = easeOutCubic(localT);

        currentPositions[i3]     = lerp(scatterPositions[i3],     logoPositions[i3],     eased);
        currentPositions[i3 + 1] = lerp(scatterPositions[i3 + 1], logoPositions[i3 + 1], eased);
        currentPositions[i3 + 2] = lerp(scatterPositions[i3 + 2], logoPositions[i3 + 2], eased);
      }
      posAttr.needsUpdate = true;

      // Transition to rest
      if (rawT >= 1) {
        phase = 'rest';
        phaseStartTime = now;
      }

    } else if (phase === 'rest') {
      // --- Rest phase ---
      // Keep fog minimal so logo stays bright
      fog.density = REST_FOG_DENSITY;
      material.uniforms.fogDensity.value = REST_FOG_DENSITY;

      // Spring physics with breathing offset and mouse push
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;
        const seed = i * 0.1;
        const px = currentPositions[i3];
        const py = currentPositions[i3 + 1];
        const pz = currentPositions[i3 + 2];

        // Breathing offset — more visible wiggle in place
        const breathX = Math.sin(now * 1.2 + seed) * 0.025;
        const breathY = Math.cos(now * 0.9 + seed * 1.3) * 0.025;
        const breathZ = Math.sin(now * 1.0 + seed * 0.7) * 0.015;

        const targetX = logoPositions[i3]     + breathX;
        const targetY = logoPositions[i3 + 1] + breathY;
        const targetZ = logoPositions[i3 + 2] + breathZ;

        // Spring force toward target
        velocities[i3]     += (targetX - px) * SPRING_STIFFNESS;
        velocities[i3 + 1] += (targetY - py) * SPRING_STIFFNESS;
        velocities[i3 + 2] += (targetZ - pz) * SPRING_STIFFNESS;

        // Mouse push force (inverse-square within PUSH_RADIUS)
        const dmx = px - mouseWorld.x;
        const dmy = py - mouseWorld.y;
        const distMouse = Math.sqrt(dmx * dmx + dmy * dmy);
        if (distMouse < PUSH_RADIUS && distMouse > 0.001) {
          const pushForce = PUSH_STRENGTH / (distMouse * distMouse);
          velocities[i3]     += (dmx / distMouse) * pushForce;
          velocities[i3 + 1] += (dmy / distMouse) * pushForce;
        }

        // Damping and integrate
        velocities[i3]     *= DAMPING;
        velocities[i3 + 1] *= DAMPING;
        velocities[i3 + 2] *= DAMPING;
        currentPositions[i3]     += velocities[i3];
        currentPositions[i3 + 1] += velocities[i3 + 1];
        currentPositions[i3 + 2] += velocities[i3 + 2];
      }
      posAttr.needsUpdate = true;

      // Imperceptible camera drift
      camera.position.x = CAM_REST.x + Math.sin(now * 0.15) * 0.05;
      camera.position.y = CAM_REST.y + Math.cos(now * 0.12) * 0.05;

      // Show overlay (email, or QR in show mode) after 1s in rest
      if (!overlayShown && elapsed > 1 && overlay) {
        overlay.classList.add('visible');
        overlayShown = true;
      }
    }

    // Update shader time uniform
    material.uniforms.uTime.value = now;

    // Drift point lights around the scene for subtle 3D illumination
    pointLight1.position.set(
      Math.sin(now * 0.3) * 5,
      Math.cos(now * 0.2) * 3,
      Math.sin(now * 0.15) * 4 + 2
    );
    pointLight2.position.set(
      Math.cos(now * 0.25) * 6,
      Math.sin(now * 0.35) * 4,
      Math.cos(now * 0.1) * 3 - 2
    );
    pointLight3.position.set(
      Math.sin(now * 0.4) * 4,
      Math.cos(now * 0.3) * 2,
      5
    );

    renderer.render(scene, camera);
  }

  animate();
})();
