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
