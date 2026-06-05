import { makeDraggable, el } from './interactions.js';

// Origin and vector length in SVG coords. a is fixed along +x.
const CX = 250, CY = 250, LEN = 130, ARC_R = 60;

// CSS variable colors with fallbacks (resolved once per update).
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// Arc from a's direction (0 rad) to b's angle, drawn at radius r.
function arcPath(to, r) {
  const sx = CX + r, sy = CY;
  const ex = CX + r * Math.cos(to), ey = CY - r * Math.sin(to);
  let sweep = to;
  if (sweep < 0) sweep += 2 * Math.PI;
  const large = sweep > Math.PI ? 1 : 0;
  // sweep flag 0 = counter-clockwise in screen coords (y flipped)
  return `M ${sx.toFixed(1)},${sy.toFixed(1)} A ${r},${r} 0 ${large},0 ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

function update(angle) {
  // Keep angle in (-π, π] so θ shows the acute/obtuse separation symmetrically.
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;

  const bx = CX + LEN * Math.cos(a);
  const by = CY - LEN * Math.sin(a);

  const cos = Math.cos(a);
  const dot = cos;                       // |a| = |b| = 1 (unit vectors)
  const deg = Math.round(Math.abs(a) * 180 / Math.PI);

  const accent = cssVar('--color-accent', '#00A3E0');
  const danger = cssVar('--color-danger', '#F04E23');
  const muted = cssVar('--color-text-muted', '#4A6A8A');
  const sec = cssVar('--color-accent-secondary', '#6ECFF6');

  // Sign drives color: positive = accent, ~0 = muted, negative = danger.
  let signColor, signTag;
  if (dot > 0.02) { signColor = accent; signTag = 'same direction'; }
  else if (dot < -0.02) { signColor = danger; signTag = 'opposing'; }
  else { signColor = muted; signTag = 'perpendicular'; }

  // Vector b line + tip dot + hit target + label.
  const line = el('dp-vec-b');
  if (line) { line.setAttribute('x2', bx); line.setAttribute('y2', by); line.setAttribute('stroke', signColor); }
  const dot1 = el('dp-drag-dot');
  if (dot1) { dot1.setAttribute('cx', bx); dot1.setAttribute('cy', by); dot1.setAttribute('fill', signColor); }
  const hit = el('dp-drag-hit');
  if (hit) { hit.setAttribute('cx', bx); hit.setAttribute('cy', by); }
  const bLabel = el('dp-b-label');
  if (bLabel) { bLabel.setAttribute('x', bx + (bx >= CX ? 18 : -18)); bLabel.setAttribute('y', by - 12); bLabel.setAttribute('fill', signColor); }

  // Projection of b onto a lies along the x-axis at length cos (signed).
  const projX = CX + LEN * cos;
  const projSeg = el('dp-proj-seg');
  if (projSeg) { projSeg.setAttribute('x2', projX); projSeg.setAttribute('stroke', sec); }
  const projDrop = el('dp-proj-drop');
  if (projDrop) {
    projDrop.setAttribute('x1', bx); projDrop.setAttribute('y1', by);
    projDrop.setAttribute('x2', projX); projDrop.setAttribute('y2', CY);
  }
  const projLabel = el('dp-proj-label');
  if (projLabel) { projLabel.setAttribute('x', (CX + projX) / 2); }

  // θ arc + label (always positive magnitude).
  const arc = el('dp-arc');
  if (arc) {
    if (deg > 1) {
      arc.setAttribute('d', arcPath(a, ARC_R));
      arc.style.display = '';
      arc.setAttribute('stroke', signColor);
    } else {
      arc.style.display = 'none';
    }
  }
  const theta = el('dp-theta');
  if (theta) {
    const mid = a / 2;
    const lr = ARC_R + 24;
    theta.setAttribute('x', CX + lr * Math.cos(mid));
    theta.setAttribute('y', CY - lr * Math.sin(mid));
    theta.textContent = `θ = ${deg}°`;
    theta.setAttribute('fill', signColor);
  }

  // Result readout (large, colored by sign). Round first so ±0.00 shows as +0.00.
  const result = el('dp-result');
  if (result) {
    const mag = Math.abs(dot).toFixed(2);
    const s = (dot >= 0 || mag === '0.00') ? '+' : '−';
    result.textContent = `${s}${mag}`;
    result.setAttribute('fill', signColor);
  }
  const box = el('dp-result-box');
  if (box) { box.setAttribute('stroke', signColor); }
  const tag = el('dp-sign-tag');
  if (tag) { tag.textContent = signTag; tag.setAttribute('fill', signColor); }

  // Breakdown |a||b|cos θ.
  const bd = el('dp-breakdown');
  if (bd) { bd.textContent = `|a|·|b|·cos(${deg}°)`; }
  const bdn = el('dp-breakdown-nums');
  if (bdn) {
    const cmag = Math.abs(cos).toFixed(2);
    const c = (cos >= 0 || cmag === '0.00') ? cmag : `−${cmag}`;
    bdn.textContent = `1.00 · 1.00 · ${c}`;
  }

  // Sign-scale marker: map dot [+1..-1] → x [525..705].
  const marker = el('dp-sign-marker');
  if (marker) {
    const x = 615 - dot * 90;
    marker.setAttribute('cx', x);
    marker.setAttribute('fill', signColor);
  }
}

makeDraggable({
  hit: /^dp-drag-(hit|dot)$/,
  cursor: 'grabbing',
  onDrag({ point }) {
    const dx = point.x - CX;
    const dy = -(point.y - CY);
    const angle = Math.atan2(dy, dx);
    update(angle);
  },
});
