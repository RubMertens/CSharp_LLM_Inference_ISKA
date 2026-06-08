import { makeDraggable, el } from './interactions.js';

const CX = 250, CY = 250, R = 180, ARC_R = 70;
const ALPHA = 25 * Math.PI / 180;

function arcPath(from, to, r) {
  const sx = CX + r * Math.cos(from), sy = CY - r * Math.sin(from);
  const ex = CX + r * Math.cos(to), ey = CY - r * Math.sin(to);
  let sweep = to - from;
  if (sweep < 0) sweep += 2 * Math.PI;
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${sx.toFixed(1)},${sy.toFixed(1)} A ${r},${r} 0 ${large},0 ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

function update(angle) {
  const px = CX + R * Math.cos(angle);
  const py = CY - R * Math.sin(angle);

  let theta = angle - ALPHA;
  if (theta < 0) theta += 2 * Math.PI;
  const deg = Math.round(theta * 180 / Math.PI);

  const line = el('rot-drag-line');
  if (line) { line.setAttribute('x2', px); line.setAttribute('y2', py); }

  const dot = el('rot-drag-dot');
  if (dot) { dot.setAttribute('cx', px); dot.setAttribute('cy', py); }

  const hit = el('rot-drag-hit');
  if (hit) { hit.setAttribute('cx', px); hit.setAttribute('cy', py); }

  const label = el('rot-drag-label');
  if (label) { label.setAttribute('x', px + 22); label.setAttribute('y', py - 16); }

  const projX = el('rot-drag-proj-x');
  if (projX) {
    projX.setAttribute('x1', px); projX.setAttribute('y1', py);
    projX.setAttribute('x2', px);
  }

  const projY = el('rot-drag-proj-y');
  if (projY) {
    projY.setAttribute('x1', px); projY.setAttribute('y1', py);
    projY.setAttribute('y2', py);
  }

  // cos brace follows the point's x projection
  const cosBrace = el('rot-cos-brace');
  if (cosBrace) { cosBrace.setAttribute('x2', px); }
  const cosLabel = el('rot-cos-label');
  if (cosLabel) {
    cosLabel.setAttribute('x', (CX + px) / 2);
    cosLabel.textContent = `cos(${Math.round(angle * 180 / Math.PI)}°)`;
  }

  // sin brace follows the point's y projection
  const sinBrace = el('rot-sin-brace');
  if (sinBrace) { sinBrace.setAttribute('y2', py); }
  const sinLabel = el('rot-sin-label');
  if (sinLabel) {
    sinLabel.setAttribute('y', (CY + py) / 2);
    sinLabel.textContent = `sin(${Math.round(angle * 180 / Math.PI)}°)`;
  }

  // Distance line between original and rotated point
  const origX = CX + R * Math.cos(ALPHA);
  const origY = CY - R * Math.sin(ALPHA);
  const distLine = el('rot-dist-line');
  if (distLine) { distLine.setAttribute('x2', px); distLine.setAttribute('y2', py); }
  const mx = (origX + px) / 2 + 12;
  const my = (origY + py) / 2;
  const dl1 = el('rot-dist-label1');
  if (dl1) {
    dl1.setAttribute('x', mx);
    dl1.setAttribute('y', my - 10);
    dl1.textContent = `x' = x·cos(${deg}°) − y·sin(${deg}°)`;
  }
  const dl2 = el('rot-dist-label2');
  if (dl2) {
    dl2.setAttribute('x', mx);
    dl2.setAttribute('y', my + 8);
    dl2.textContent = `y' = x·sin(${deg}°) + y·cos(${deg}°)`;
  }

  const arc = el('rot-drag-arc');
  if (arc) {
    if (theta > 0.03) {
      arc.setAttribute('d', arcPath(ALPHA, angle, ARC_R));
      arc.style.display = '';
    } else {
      arc.style.display = 'none';
    }
  }

  const thetaLabel = el('rot-drag-theta');
  if (thetaLabel) {
    const mid = ALPHA + theta / 2;
    const lr = ARC_R + 22;
    thetaLabel.setAttribute('x', CX + lr * Math.cos(mid));
    thetaLabel.setAttribute('y', CY - lr * Math.sin(mid));
    thetaLabel.textContent = `θ = ${deg}°`;
  }
}

makeDraggable({
  hit: /^rot-drag-(hit|dot)$/,
  cursor: 'grabbing',
  onDrag({ point }) {
    const dx = point.x - CX;
    const dy = -(point.y - CY);
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += 2 * Math.PI;
    update(angle);
  },
});
