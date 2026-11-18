// Shared SVG drag interaction layer.
//
// Slides ship static SVG at default positions; interaction code only updates
// element attributes/labels in response to dragging. All listeners live at the
// document level (delegation), so they survive the engine recreating slide DOM
// on every navigation — same approach the original per-slide files used.
//
// Two helpers:
//   svgPoint(svg, clientX, clientY) — client → SVG user coords
//   makeDraggable(opts)            — pointerdown/move/up lifecycle over a hit target
//
// And a registry: registerInteraction(sentinelId, initFn). When a slide whose
// DOM contains #sentinelId enters, initFn runs once (for slides needing initial
// computed state, e.g. drawing a curve). Drag handlers themselves don't need it.

export function svgPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// makeDraggable({ hit, cursor, onStart, onDrag, onEnd })
//
//   hit    — element id (string) for a single target, or RegExp matched against
//            e.target.id; first capture group (if any) is parsed as an integer
//            index and passed through.
//   cursor — body cursor while dragging ('grabbing', 'ns-resize', …).
//   onStart({ svg, index, point }) — optional; point is the SVG-space pointer.
//   onDrag({ svg, index, point })  — called at most once per animation frame with
//                                    the latest pointer position.
//   onEnd({ svg, index })          — optional; drag released or cancelled.
//
// While a drag is live the <svg> carries .is-dragging and data-drag-index, and the
// hit target carries .is-drag-target, so the grabbed element can be styled (svg.css).
//
// Returns nothing; registers document-level listeners immediately.
export function makeDraggable({ hit, cursor = 'grabbing', onStart, onDrag, onEnd }) {
  let dragging = false;
  let index = -1;
  let svg = null;
  let target = null;
  let frame = 0;
  let latest = null;

  const match = (target) => {
    if (!target || !target.id) return null;
    if (typeof hit === 'string') {
      return target.id === hit ? { index: -1 } : null;
    }
    const m = target.id.match(hit);
    if (!m) return null;
    return { index: m[1] !== undefined ? parseInt(m[1], 10) : -1 };
  };

  // Pointer events can arrive several times per frame (high-rate mice, pens).
  // Keep only the newest position and redraw once per frame: same result, no
  // wasted layout work, no visible lag.
  const flush = () => {
    frame = 0;
    if (!dragging || !svg || !latest) return;
    onDrag({ svg, index, point: svgPoint(svg, latest.x, latest.y) });
  };

  const end = () => {
    if (!dragging) return;
    if (frame) { cancelAnimationFrame(frame); flush(); }
    if (target) target.classList.remove('is-drag-target');
    if (svg) {
      svg.classList.remove('is-dragging');
      delete svg.dataset.dragIndex;
    }
    if (onEnd) onEnd({ svg, index });
    dragging = false;
    index = -1;
    svg = null;
    target = null;
    latest = null;
    document.body.style.cursor = '';
  };

  document.addEventListener('pointerdown', (e) => {
    const hitInfo = match(e.target);
    if (!hitInfo) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    index = hitInfo.index;
    svg = e.target.closest('svg');
    target = e.target;
    target.classList.add('is-drag-target');
    svg.classList.add('is-dragging');
    svg.dataset.dragIndex = String(index);
    document.body.style.cursor = cursor;
    if (onStart) onStart({ svg, index, point: svgPoint(svg, e.clientX, e.clientY) });
  });

  document.addEventListener('pointermove', (e) => {
    if (!dragging || !svg) return;
    e.preventDefault();
    latest = { x: e.clientX, y: e.clientY };
    if (!frame) frame = requestAnimationFrame(flush);
  });

  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}

// Registry: run initFn once per slide entrance when #sentinelId is present.
const interactions = [];

export function registerInteraction(sentinelId, initFn) {
  interactions.push({ sentinelId, initFn });
  // Slide may already be in the DOM (module loaded after first render).
  if (document.getElementById(sentinelId)) initFn();
}

// Watch the slide container; when a slide enters carrying a registered sentinel,
// fire its initFn. Engine swaps innerHTML, so each entrance is a fresh element.
function observe() {
  const container = document.getElementById('presentation');
  if (!container) return;
  const observer = new MutationObserver(() => {
    for (const { sentinelId, initFn } of interactions) {
      if (document.getElementById(sentinelId)) initFn();
    }
  });
  observer.observe(container, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observe);
} else {
  observe();
}

const el = (id) => document.getElementById(id);
export { el };
