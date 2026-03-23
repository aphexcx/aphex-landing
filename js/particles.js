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

  // --- Camera position ---
  camera.position.set(0, 0, 5); // inside the cloud

  // --- Resize handler ---
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Render loop ---
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  animate();
})();
