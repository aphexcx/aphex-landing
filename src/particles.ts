// Aphex Landing — Particle System
// Three.js r171 particle animation with logo coalesce and mouse interaction

import * as THREE from 'three';

declare global {
  interface Window {
    __NO_WEBGL?: boolean;
    __beatCount?: number; // beats detected (show mode) — handy for remote debugging
    __pulseDbg?: { bass: number; avg: number; level: number; env: number };
    webkitAudioContext?: typeof AudioContext;
  }
}

type QrLayout = 'none' | 'stacked';

interface LogoTargets {
  positions: Float32Array;
  qrFlags: Float32Array; // 1 = particle belongs to the QR code (show mode)
  contentW: number;      // world-unit extent of the full layout (for camera framing)
  contentH: number;
  aspect: number;
}

// QR code for https://instagram.com/aphexcx — version 3, error correction M,
// 29x29 modules ('1' = dark module). Generated with the `qrcode` npm package.
// In show mode the particles themselves form these modules (bright-on-dark,
// i.e. an inverted QR — handled by phone camera scanners).
const QR_MATRIX = [
  '11111110100110011011101111111',
  '10000010110110110100001000001',
  '10111010001011110010101011101',
  '10111010101110001101001011101',
  '10111010000011000111101011101',
  '10000010000110100001101000001',
  '11111110101010101010101111111',
  '00000000100001100100000000000',
  '10110111010011101110001001011',
  '00101101001110011111111110001',
  '10101110011110110100000100110',
  '01010101011011110000111100001',
  '00011111001000001101000101100',
  '11011001001101000101001000111',
  '00110110011110100011111110111',
  '11000100000001010001001010010',
  '11111010101110000010110011010',
  '01100101110111000110110101110',
  '10100110000100000010010000100',
  '00111100111110011101001010100',
  '01111110010001010110111111100',
  '00000000101111110010100011111',
  '11111110111001001001101011010',
  '10000010110000001011100011011',
  '10111010001000110100111110101',
  '10111010100000101011110111010',
  '10111010100110011000100100101',
  '10000010011011001010110111010',
  '11111110101001110101110110010',
];

/**
 * Generate target positions for particles by sampling filled pixels
 * from the APHEX logo drawn on an offscreen canvas.
 * In show mode ('stacked') the Instagram QR code joins the layout below the
 * full-width logo, and the camera frames the stack as tightly as the viewport
 * allows, so the QR gets as big as the page permits under a large logo.
 * The canvas itself only ever holds the logo (drawn at its native 1200x300
 * metrics); QR targets are computed directly from QR_MATRIX.
 */
function generateLogoTargets(particleCount: number, qrLayout: QrLayout): LogoTargets {
  const LOGO_W = 1200;
  const LOGO_H = 300;
  const canvas = document.createElement('canvas');
  canvas.width = LOGO_W;
  canvas.height = LOGO_H;
  const ctx = canvas.getContext('2d')!;

  // --- Layout metrics (conceptual px; world = px / 120) ---
  const QR_MODULE = 25;
  const QR_SIZE = QR_MATRIX.length * QR_MODULE; // 725
  // Logo remap within the layout + QR placement, per layout:
  let W: number;      // full layout width
  let H: number;      // full layout height
  let logoScale: number;
  let logoX: number;
  let logoY: number;
  let qrX0 = 0;
  let qrY0 = 0;
  if (qrLayout === 'stacked') {
    // logo band (300, letters end at y=270) + 100px quiet-zone gap + QR 725
    // + 25 margin = 1120
    logoScale = 1;
    W = LOGO_W;
    H = 1120;
    logoX = 0;
    logoY = 0;
    qrX0 = (W - QR_SIZE) / 2;
    qrY0 = 370;
  } else {
    logoScale = 1;
    W = LOGO_W;
    H = LOGO_H;
    logoX = 0;
    logoY = 0;
  }

  // --- Letter metrics ---
  // 5 letters, each ~210px wide, with ~37px gaps between them
  // Total: 5*210 + 4*37 = 1050+148 = 1198 ~ 1200
  const letterWidth = 210;
  const gap = 37;
  const padTop = 30;
  const letterHeight = LOGO_H - padTop * 2; // 240px tall
  const stroke = 42; // stroke thickness for heavy/black weight

  function letterX(index: number): number {
    return index * (letterWidth + gap) + (LOGO_W - (5 * letterWidth + 4 * gap)) / 2;
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

  // --- Pixel sampling (logo canvas) ---
  const imageData = ctx.getImageData(0, 0, LOGO_W, LOGO_H);
  const pixels = imageData.data;

  // Collect all filled pixel coordinates
  const filled: number[] = [];
  for (let y = 0; y < LOGO_H; y++) {
    for (let x = 0; x < LOGO_W; x++) {
      const idx = (y * LOGO_W + x) * 4;
      if (pixels[idx + 3] > 128) {
        filled.push(x, y);
      }
    }
  }

  // Map layout px coordinates to 3D world coordinates: 120px = 1 world unit
  // (the full-width logo spans 10 world units, as before), layout centered
  // at the origin.
  const scale = 10 / LOGO_W;
  const offsetX = -(W * scale) / 2;
  const offsetY = (H * scale) / 2;
  const contentW = W * scale;
  const contentH = H * scale;

  const filledCount = filled.length / 2;
  if (filledCount === 0) {
    // Safety fallback: return centered zeros
    return {
      positions: new Float32Array(particleCount * 3),
      qrFlags: new Float32Array(particleCount),
      contentW: contentW,
      contentH: contentH,
      aspect: W / H,
    };
  }

  const positions = new Float32Array(particleCount * 3);
  const qrFlags = new Float32Array(particleCount);

  // --- QR targets (show mode): jittered 4x4 grid inside every dark module ---
  // Deterministic per-module coverage (rather than random sampling) so each
  // module reads as a solid blob a phone camera can binarize.
  let qrCount = 0;
  if (qrLayout !== 'none') {
    const n = QR_MATRIX.length;          // 29 modules
    const PER_MODULE = 16;               // 4x4 sub-grid
    let darkModules = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (QR_MATRIX[r].charAt(c) === '1') darkModules++;
      }
    }
    // ~420 dark modules x 16 = ~6720; the cap only bites if the particle
    // budget is unexpectedly tight, thinning modules evenly below.
    const budget = Math.min(darkModules * PER_MODULE, Math.floor(particleCount * 0.7));

    // Fill from the end of the arrays; the logo gets the remainder.
    // Outer loop over sub-grid passes so a tight budget thins all modules
    // evenly instead of leaving some modules empty.
    let i = particleCount - 1;
    outer:
    for (let g = 0; g < PER_MODULE; g++) {
      const gx = g % 4;
      const gy = (g / 4) | 0;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (QR_MATRIX[r].charAt(c) !== '1') continue;
          if (qrCount >= budget) break outer;
          const px = qrX0 + c * QR_MODULE + (gx + 0.5) * (QR_MODULE / 4) + (Math.random() - 0.5) * (QR_MODULE / 8);
          const py = qrY0 + r * QR_MODULE + (gy + 0.5) * (QR_MODULE / 4) + (Math.random() - 0.5) * (QR_MODULE / 8);
          positions[i * 3]     = px * scale + offsetX;
          positions[i * 3 + 1] = -(py * scale) + offsetY; // flip Y
          positions[i * 3 + 2] = (Math.random() - 0.5) * 0.06; // near-planar for crispness
          qrFlags[i] = 1;
          i--;
          qrCount++;
        }
      }
    }
  }

  // --- Logo targets: random sampling of filled pixels, remapped into layout ---
  const logoCount = particleCount - qrCount;
  for (let i = 0; i < logoCount; i++) {
    const ri = Math.floor(Math.random() * filledCount);
    const px = logoX + filled[ri * 2] * logoScale;
    const py = logoY + filled[ri * 2 + 1] * logoScale;

    positions[i * 3]     = px * scale + offsetX;
    positions[i * 3 + 1] = -(py * scale) + offsetY; // flip Y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.15 * logoScale; // small z-offset
  }

  return {
    positions: positions,
    qrFlags: qrFlags,
    contentW: contentW,
    contentH: contentH,
    aspect: W / H,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
(function main(): void {
  'use strict';

  // Skip if WebGL detection already failed
  if (window.__NO_WEBGL) return;

  // --- Show mode (kiosk display: particles form the logo AND the Instagram QR) ---
  // The inline script in index.html sets the class from ?show / #show.
  const showMode = document.documentElement.classList.contains('show-mode');
  const qrLayout: QrLayout = showMode ? 'stacked' : 'none';

  // --- Device detection ---
  const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 1;
  // Show mode needs enough particles for QR modules to read as solid blobs
  // (~6720 for the QR — see the budget in generateLogoTargets — plus the logo)
  const PARTICLE_COUNT = showMode ? (isMobile ? 14000 : 16000) : (isMobile ? 4000 : 8000);
  const DRIFT_DURATION = isMobile ? 2.0 : 4.0; // seconds
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Damp the rest-phase breathing in show mode so QR modules stay crisp enough to scan
  const BREATH_SCALE = showMode ? 0.4 : 1;

  // --- Generate logo target positions ---
  const logo = generateLogoTargets(PARTICLE_COUNT, qrLayout);
  const logoPositions = logo.positions; // Float32Array, length = PARTICLE_COUNT * 3
  const qrFlags = logo.qrFlags;         // 1 = particle forms the QR code

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

    // Per-particle size variation — QR particles run bigger so modules read solid
    sizes[i] = qrFlags[i] > 0
      ? 0.15 + Math.random() * 0.05
      : 0.09 + Math.random() * 0.06;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aQr', new THREE.BufferAttribute(qrFlags, 1));

  // --- Custom glow shader material with fog support ---
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      fogColor: { value: new THREE.Color(0x111111) },
      fogDensity: { value: DRIFT_FOG_DENSITY },
      uBeat: { value: 0 },   // beat envelope (show mode audio pulse)
      uLevel: { value: 0 },  // smoothed music loudness
    },
    vertexShader: `
      attribute float size;
      attribute float aQr;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float fogDensity;
      varying float vAlpha;
      varying float vFlicker;
      varying float vFogFactor;
      varying float vQr;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = -mvPosition.z;
        vQr = aQr;

        // Per-particle flicker based on position hash + time.
        // QR particles get a slow, subtle shimmer instead of the fast
        // twinkle — alive, but stable enough for a camera to scan.
        float hash = fract(sin(dot(position.xy, vec2(12.9898, 78.233))) * 43758.5453);
        vFlicker = 0.6 + 0.4 * sin(uTime * (3.0 + hash * 5.0) + hash * 6.283);
        float qrFlicker = 0.88 + 0.10 * sin(uTime * (0.5 + hash * 0.9) + hash * 6.283);
        vFlicker = mix(vFlicker, qrFlicker, aQr);

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
      uniform float uBeat;
      uniform float uLevel;
      varying float vAlpha;
      varying float vFlicker;
      varying float vFogFactor;
      varying float vQr;

      void main() {
        // Distance from center of point sprite (0 at center, 1 at edge)
        vec2 center = gl_PointCoord - 0.5;
        float dist = length(center) * 2.0;

        // Soft gaussian glow — bright core fading to soft halo
        float core = exp(-dist * dist * 6.0);   // tight bright center
        float halo = exp(-dist * dist * 1.5);   // wider soft glow
        float glow = core * 0.8 + halo * 0.4;

        // Apply flicker; QR particles get a brightness boost for scan contrast
        glow *= vFlicker;
        glow *= 1.0 + 0.45 * vQr;

        // Audio pulse (show mode): brief glow lift on each beat plus a slow
        // swell with the music's loudness; both 0 when the mic is off
        glow *= 1.0 + 0.30 * uBeat + 0.10 * uLevel;

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
    if (showMode) {
      // Frame the whole layout (logo + QR) as tightly as the viewport allows:
      // the QR gets as big as the page permits, especially in landscape.
      const zW = (logo.contentW * 1.03 / 2) / (Math.tan(halfFovRad) * camera.aspect);
      const zH = (logo.contentH * 1.06 / 2) / Math.tan(halfFovRad);
      return Math.max(zW, zH);
    }
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

  // --- Audio-reactive pulse (show mode): subtle thump on detected beats ---
  // Energy-flux beat detection on the bass band of the mic signal. Fails
  // quietly (no pulse) if the mic is unavailable or permission is denied.
  let beatEnv = 0;      // spikes to 1 on a detected beat, decays fast
  let audioLevel = 0;   // slow-smoothed overall loudness (0..1)
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freqData: Uint8Array | null = null;
  let micRequested = false;
  let bassAvg = 0;
  let bassPrev = 0;
  let lastBeatAt = 0;

  function startMic(): void {
    if (micRequested) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    micRequested = true;
    navigator.mediaDevices.getUserMedia({
      audio: {
        // Music, not speech: keep the dynamics the beat detector needs
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    }).then(function (stream: MediaStream): void {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      // Widen the dB window: the default [-100,-30] rails loud signals at
      // byte 255, flattening the kick-vs-bassline ratio the detector needs
      analyser.minDecibels = -90;
      analyser.maxDecibels = 0;
      source.connect(analyser);
      freqData = new Uint8Array(analyser.frequencyBinCount);
    }).catch(function (): void {
      // Allow a retry on the next user gesture (some browsers require one)
      micRequested = false;
    });
  }

  if (showMode) {
    // Ask for the mic up front (kiosk setup moment); retry/resume on gesture
    startMic();
    const resumeAudio = function (): void {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(function (): void { /* ignore */ });
      }
      if (!micRequested) startMic();
    };
    window.addEventListener('touchend', resumeAudio);
    window.addEventListener('click', resumeAudio);

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

    // Double-tap (or double-click) toggles fullscreen — Safari and Chrome on
    // iPad have no persistent fullscreen UI of their own
    const toggleFullscreen = function (): void {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => void;
      };
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => void;
      };
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(function (): void { /* ignore */ });
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        }
      } else if (el.requestFullscreen) {
        el.requestFullscreen().catch(function (): void { /* ignore */ });
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    };
    let lastTap = 0;
    window.addEventListener('touchend', function (): void {
      const t = performance.now();
      if (t - lastTap < 350) toggleFullscreen();
      lastTap = t;
    });
    window.addEventListener('dblclick', toggleFullscreen);
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

  let lastFrameTime = performance.now() / 1000;

  // --- Animate ---
  function animate(): void {
    requestAnimationFrame(animate);

    const now = performance.now() / 1000;
    const elapsed = now - phaseStartTime;
    const dt = Math.min(Math.max(now - lastFrameTime, 0.001), 0.1);
    lastFrameTime = now;

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
        // (damped in show mode, extra-damped for QR particles)
        const bs = qrFlags[i] > 0 ? BREATH_SCALE * 0.5 : BREATH_SCALE;
        const breathX = Math.sin(now * 1.2 + seed) * 0.025 * bs;
        const breathY = Math.cos(now * 0.9 + seed * 1.3) * 0.025 * bs;
        const breathZ = Math.sin(now * 1.0 + seed * 0.7) * 0.015 * bs;

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

    // --- Audio pulse: beat detection + envelopes ---
    if (analyser && freqData) {
      analyser.getByteFrequencyData(freqData);

      // Bass band ~20-165 Hz (bins 1..7 at fftSize 2048, 44.1/48 kHz).
      // Convert the analyser's dB-scaled bytes back to linear power —
      // ratios in dB space are too compressed for a reliable beat gate.
      let bassPow = 0;
      for (let b = 1; b <= 7; b++) {
        const db = -90 + (freqData[b] / 255) * 90; // minDecibels..maxDecibels
        bassPow += Math.pow(10, db / 10);
      }
      const bass = bassPow / 7; // 1.0 = all bins at 0 dBFS

      // Overall loudness across the musical range (up to ~5.5 kHz)
      let levelSum = 0;
      for (let b = 0; b < 240; b++) levelSum += freqData[b];
      const level = levelSum / (240 * 255);

      // Rolling average of the bass energy (~1.5s window)
      const aSlow = 1 - Math.exp(-dt / 1.5);
      bassAvg += aSlow * (bass - bassAvg);

      const aLevel = 1 - Math.exp(-dt / 0.25);
      audioLevel += aLevel * (level - audioLevel);

      // A beat = bass power rising and clearly above its recent average
      // (linear power: a kick a few dB over a sustained bassline is >2x)
      if (bass > Math.max(1.8 * bassAvg, 0.00001) && bass > bassPrev && now - lastBeatAt > 0.28) {
        beatEnv = 1;
        lastBeatAt = now;
        window.__beatCount = (window.__beatCount || 0) + 1;
      }
      bassPrev = bass;
      // Live tuning probe (also handy via remote inspector at the venue)
      window.__pulseDbg = { bass: bass, avg: bassAvg, level: audioLevel, env: beatEnv };
    }
    beatEnv *= Math.exp(-dt * 5.5);

    // Apply: subtle whole-field scale thump + glow lift (no-ops without mic)
    const pulseScale = 1 + 0.035 * beatEnv;
    points.scale.set(pulseScale, pulseScale, pulseScale);
    material.uniforms.uBeat.value = beatEnv;
    material.uniforms.uLevel.value = audioLevel;

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
