// Aphex Landing — Particle System
// Three.js r171 particle animation with logo coalesce and mouse interaction

/**
 * Generate target positions for particles by sampling filled pixels
 * from the APHEX logo drawn on an offscreen canvas.
 *
 * @param {number} particleCount — number of target positions to produce
 * @returns {{ positions: Float32Array, aspect: number }}
 */
function generateLogoTargets(particleCount) {
  var W = 1200, H = 300;
  var canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  var ctx = canvas.getContext('2d');

  // --- Letter metrics ---
  // 5 letters, each ~210px wide, with ~37px gaps between them
  // Total: 5*210 + 4*37 = 1050+148 = 1198 ≈ 1200
  var letterWidth = 210;
  var gap = 37;
  var padTop = 30;
  var letterHeight = H - padTop * 2; // 240px tall
  var stroke = 42; // stroke thickness for heavy/black weight

  function letterX(index) {
    return index * (letterWidth + gap) + (W - (5 * letterWidth + 4 * gap)) / 2;
  }

  ctx.fillStyle = '#fff';

  // ---- A: Wide triangular, pointed top, NO crossbar ----
  (function drawA() {
    var x0 = letterX(0);
    var cx = x0 + letterWidth / 2;
    var top = padTop;
    var bot = padTop + letterHeight;
    // outer triangle
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(x0 + letterWidth, bot);
    ctx.lineTo(x0, bot);
    ctx.closePath();
    ctx.fill();
    // cut out inner triangle (no crossbar, just thick legs)
    var inset = stroke * 1.35;
    var innerTop = top + stroke * 2.2;
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
  (function drawP() {
    var x0 = letterX(1);
    var top = padTop;
    var bot = padTop + letterHeight;
    var bowlBottom = top + letterHeight * 0.55;

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
  (function drawH() {
    var x0 = letterX(2);
    var top = padTop;
    var midY = top + letterHeight / 2 - stroke / 2;

    // Left vertical
    ctx.fillRect(x0, top, stroke, letterHeight);
    // Right vertical
    ctx.fillRect(x0 + letterWidth - stroke, top, stroke, letterHeight);
    // Horizontal bar
    ctx.fillRect(x0, midY, letterWidth, stroke);
  })();

  // ---- E: Block E with 3 prongs and 2 gaps (slotted/striped) ----
  (function drawE() {
    var x0 = letterX(3);
    var top = padTop;
    // Three horizontal prongs separated by two gaps
    // Divide letterHeight into 5 equal bands: prong, gap, prong, gap, prong
    var bandH = letterHeight / 5;

    // Left vertical stem (full height)
    ctx.fillRect(x0, top, stroke, letterHeight);

    // Top prong
    ctx.fillRect(x0, top, letterWidth, bandH);
    // Middle prong
    ctx.fillRect(x0, top + bandH * 2, letterWidth, bandH);
    // Bottom prong
    ctx.fillRect(x0, top + bandH * 4, letterWidth, bandH);
  })();

  // ---- X: Two thick diagonal strokes crossing ----
  (function drawX() {
    var x0 = letterX(4);
    var top = padTop;
    var bot = padTop + letterHeight;
    var hw = stroke * 1.1; // half-width of each stroke at endpoints

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
  var imageData = ctx.getImageData(0, 0, W, H);
  var pixels = imageData.data;

  // Collect all filled pixel coordinates
  var filled = [];
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var idx = (y * W + x) * 4;
      if (pixels[idx + 3] > 128) {
        filled.push(x, y);
      }
    }
  }

  var filledCount = filled.length / 2;
  if (filledCount === 0) {
    // Safety fallback: return centered zeros
    return { positions: new Float32Array(particleCount * 3), aspect: W / H };
  }

  // Map pixel coordinates to 3D world coordinates
  // Logo spans ~10 world units wide, centered at origin
  var worldWidth = 10;
  var scale = worldWidth / W;
  var offsetX = -worldWidth / 2;
  var offsetY = (H * scale) / 2;

  var positions = new Float32Array(particleCount * 3);

  for (var i = 0; i < particleCount; i++) {
    var ri = Math.floor(Math.random() * filledCount);
    var px = filled[ri * 2];
    var py = filled[ri * 2 + 1];

    positions[i * 3]     = px * scale + offsetX;
    positions[i * 3 + 1] = -(py * scale) + offsetY; // flip Y
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.15; // small z-offset
  }

  return { positions: positions, aspect: W / H };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
(function main() {
  'use strict';

  // Skip if WebGL detection already failed
  if (window.__NO_WEBGL) return;

  // --- Device detection ---
  var isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 1;
  var PARTICLE_COUNT = isMobile ? 4000 : 8000;
  var DRIFT_DURATION = isMobile ? 2.0 : 4.0; // seconds
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- Generate logo target positions ---
  var logo = generateLogoTargets(PARTICLE_COUNT);
  var logoPositions = logo.positions; // Float32Array, length = PARTICLE_COUNT * 3

  // --- Three.js setup ---
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  var camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  var renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Prepend canvas to body (before other elements)
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  // --- Particle geometry ---
  var geometry = new THREE.BufferGeometry();
  var SCATTER_RADIUS = 15;

  var currentPositions = new Float32Array(PARTICLE_COUNT * 3);
  var scatterPositions = new Float32Array(PARTICLE_COUNT * 3);
  var velocities       = new Float32Array(PARTICLE_COUNT * 3); // starts at 0
  var sizes            = new Float32Array(PARTICLE_COUNT);

  for (var i = 0; i < PARTICLE_COUNT; i++) {
    // Random scatter positions (spherical-ish distribution)
    var theta = Math.random() * Math.PI * 2;
    var phi   = Math.acos(2 * Math.random() - 1);
    var r     = SCATTER_RADIUS * Math.cbrt(Math.random()); // cube root for uniform volume
    var sx = r * Math.sin(phi) * Math.cos(theta);
    var sy = r * Math.sin(phi) * Math.sin(theta);
    var sz = r * Math.cos(phi);

    scatterPositions[i * 3]     = sx;
    scatterPositions[i * 3 + 1] = sy;
    scatterPositions[i * 3 + 2] = sz;

    // Current positions start at scatter positions
    currentPositions[i * 3]     = sx;
    currentPositions[i * 3 + 1] = sy;
    currentPositions[i * 3 + 2] = sz;

    // Per-particle size variation
    sizes[i] = 0.03 + Math.random() * 0.02;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // --- Particle material ---
  var material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.04,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // --- Points mesh ---
  var points = new THREE.Points(geometry, material);
  scene.add(points);

  // --- Camera positions for each phase ---
  var CAM_DRIFT_START  = new THREE.Vector3(0, 0, 5);    // inside the cloud
  var CAM_DRIFT_END    = new THREE.Vector3(0.5, 0.3, 8);
  var CAM_REST         = new THREE.Vector3(0, 0, 12);   // framing distance

  camera.position.copy(CAM_DRIFT_START);

  // --- Resize handler ---
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Phase management ---
  var COALESCE_DURATION = 2.5; // seconds
  var phase, phaseStartTime;
  var emailOverlay = document.getElementById('email-overlay');
  var emailShown = false;

  // Cubic ease-out: 1 - (1 - t)^3
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // Linear interpolation helper
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // --- Reduced motion: skip animation entirely ---
  if (reducedMotion) {
    phase = 'rest';
    phaseStartTime = performance.now() / 1000;
    // Set particles directly to logo targets
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      currentPositions[i * 3]     = logoPositions[i * 3];
      currentPositions[i * 3 + 1] = logoPositions[i * 3 + 1];
      currentPositions[i * 3 + 2] = logoPositions[i * 3 + 2];
    }
    geometry.attributes.position.needsUpdate = true;
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
  var staggerOffsets = new Float32Array(PARTICLE_COUNT);
  (function computeStagger() {
    // Particles closer to their target arrive sooner
    var maxDist = 0;
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var dx = scatterPositions[i * 3]     - logoPositions[i * 3];
      var dy = scatterPositions[i * 3 + 1] - logoPositions[i * 3 + 1];
      var dz = scatterPositions[i * 3 + 2] - logoPositions[i * 3 + 2];
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      staggerOffsets[i] = d;
      if (d > maxDist) maxDist = d;
    }
    // Normalize to 0..1  (0 = arrives first, 1 = arrives last)
    if (maxDist > 0) {
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        staggerOffsets[i] /= maxDist;
      }
    }
  })();

  // Snapshot of camera at start of coalesce (set when transitioning)
  var camCoalesceStart = new THREE.Vector3();

  // --- Animate ---
  function animate() {
    requestAnimationFrame(animate);

    var now = performance.now() / 1000;
    var elapsed = now - phaseStartTime;

    var posAttr = geometry.attributes.position;

    if (phase === 'drift') {
      // --- Drift phase ---
      var t = Math.min(elapsed / DRIFT_DURATION, 1);

      // Camera interpolation
      camera.position.lerpVectors(CAM_DRIFT_START, CAM_DRIFT_END, t);

      // Brownian motion: small random offsets
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var i3 = i * 3;
        currentPositions[i3]     += (Math.random() - 0.5) * 0.01;
        currentPositions[i3 + 1] += (Math.random() - 0.5) * 0.01;
        currentPositions[i3 + 2] += (Math.random() - 0.5) * 0.01;
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
      var rawT = Math.min(elapsed / COALESCE_DURATION, 1);

      // Camera: cubic ease-out toward rest
      var camT = easeOutCubic(rawT);
      camera.position.lerpVectors(camCoalesceStart, CAM_REST, camT);

      // Per-particle interpolation with stagger
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var i3 = i * 3;
        // stagger: particle's local progress (delayed by distance)
        var staggerDelay = staggerOffsets[i] * 0.4; // max 40% delay
        var localT = Math.min(Math.max((rawT - staggerDelay) / (1 - staggerDelay), 0), 1);
        var eased = easeOutCubic(localT);

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

      // Subtle particle oscillation around logo targets
      for (var i = 0; i < PARTICLE_COUNT; i++) {
        var i3 = i * 3;
        var seed = i * 0.1;
        var breathX = Math.sin(now * 0.8 + seed) * 0.008;
        var breathY = Math.cos(now * 0.6 + seed * 1.3) * 0.008;
        var breathZ = Math.sin(now * 0.7 + seed * 0.7) * 0.004;

        currentPositions[i3]     = logoPositions[i3]     + breathX;
        currentPositions[i3 + 1] = logoPositions[i3 + 1] + breathY;
        currentPositions[i3 + 2] = logoPositions[i3 + 2] + breathZ;
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

    renderer.render(scene, camera);
  }

  animate();
})();
