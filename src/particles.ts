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
    // cut out inner triangle (no crossbar, just thick legs)
    const inset = stroke * 1.35;
    const innerTop = top + stroke * 2.2;
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

  // ---- P: Block P with squared/rectangular counter ----
  (function drawP(): void {
    const x0 = letterX(1);
    const top = padTop;
    const bowlBottom = top + letterHeight * 0.55;

    // Full vertical stem
    ctx.fillRect(x0, top, stroke, letterHeight);
    // Top horizontal bar
    ctx.fillRect(x0, top, letterWidth, stroke);
    // Right side of bowl
    ctx.fillRect(x0 + letterWidth - stroke, top, stroke, bowlBottom - top);
    // Bottom of bowl
    ctx.fillRect(x0, bowlBottom - stroke, letterWidth, stroke);
  })();

  // ---- H: Standard block H ----
  (function drawH(): void {
    const x0 = letterX(2);
    const top = padTop;
    const midY = top + letterHeight / 2 - stroke / 2;

    // Left vertical
    ctx.fillRect(x0, top, stroke, letterHeight);
    // Right vertical
    ctx.fillRect(x0 + letterWidth - stroke, top, stroke, letterHeight);
    // Horizontal bar
    ctx.fillRect(x0, midY, letterWidth, stroke);
  })();

  // ---- E: Three independent horizontal bars (≡ style, NO left vertical stem) ----
  (function drawE(): void {
    const x0 = letterX(3);
    const top = padTop;
    // Three horizontal bars with equal gaps — like the ≡ symbol
    // Divide letterHeight into 5 equal bands: bar, gap, bar, gap, bar
    const bandH = letterHeight / 5;

    // Top bar
    ctx.fillRect(x0, top, letterWidth, bandH);
    // Middle bar
    ctx.fillRect(x0, top + bandH * 2, letterWidth, bandH);
    // Bottom bar
    ctx.fillRect(x0, top + bandH * 4, letterWidth, bandH);
  })();

  // ---- X: Two thick diagonal strokes crossing ----
  (function drawX(): void {
    const x0 = letterX(4);
    const top = padTop;
    const bot = padTop + letterHeight;
    const hw = stroke * 1.1; // half-width of each stroke at endpoints

    // Forward slash stroke (\)
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
  scene.background = new THREE.Color(0x000000);

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
    sizes[i] = 0.05 + Math.random() * 0.04;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // --- Custom glow shader material ---
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
    vertexShader: `
      attribute float size;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vFlicker;

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

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vFlicker;

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

        // Slight warm tint at the edges of the halo
        vec3 color = mix(vec3(1.0, 1.0, 1.0), vec3(0.85, 0.9, 1.0), dist * 0.5);

        gl_FragColor = vec4(color * glow, glow * vAlpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
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
  const CAM_DRIFT_START  = new THREE.Vector3(0, 0, 5);    // inside the cloud
  const CAM_DRIFT_END    = new THREE.Vector3(0.5, 0.3, 8);
  const CAM_REST         = new THREE.Vector3(0, 0, 12);   // framing distance

  camera.position.copy(CAM_DRIFT_START);

  // --- Resize handler ---
  window.addEventListener('resize', function (): void {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
  });

  // --- Mouse/touch interaction ---
  const PUSH_RADIUS = 1.5;
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

  // --- Phase management ---
  const COALESCE_DURATION = 5.5; // seconds — slow, organic gathering
  let phase: string;
  let phaseStartTime: number;
  const emailOverlay = document.getElementById('email-overlay');
  let emailShown = false;

  // Cubic ease-out: 1 - (1 - t)^3
  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
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
    // Show email immediately
    if (emailOverlay) {
      emailOverlay.classList.add('visible');
      emailShown = true;
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

      // Show email overlay after 1s in rest
      if (!emailShown && elapsed > 1 && emailOverlay) {
        emailOverlay.classList.add('visible');
        emailShown = true;
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
