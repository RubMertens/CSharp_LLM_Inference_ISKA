// Builds the handout: one print-frame.html iframe per slide, scaled into page slots.
//
// Why iframes. Printing resolves vh/vw/vmin against the *page box*, so laying slides
// out directly on an A4 sheet would re-flow every slide that sizes itself off the
// viewport (most of this deck). An iframe carries its own viewport, so a frame fixed
// at 1280x720 keeps the on-stage layout exactly, and only the frame gets scaled.
//
//   print.html?per=2&paper=a4&numbers=1&auto=0
//
import { loadAllSlides } from './loader.js';

const MM_PER_PX = 25.4 / 96;          // CSS mm is a fixed ratio, on screen and on paper
const SLIDE_W = 1280;
const PAPERS = {
  a4:     { w: 210, h: 297 },
  letter: { w: 216, h: 279 },
};
const MARGIN = 8;                      // mm, all round
const CONCURRENCY = 4;                 // frames rendering at once
const FRAME_TIMEOUT = 20000;

const params = new URLSearchParams(location.search);
const per = params.get('per') === '1' ? 1 : 2;
const paperKey = PAPERS[params.get('paper')] ? params.get('paper') : 'a4';
const showNumbers = params.get('numbers') !== '0';
// Code walkthroughs print one page per step (see stepCount); steps=0 collapses them
// back to one page per slide, showing only the last step.
const expandSteps = params.get('steps') !== '0';
// 1-based, inclusive: print.html?from=12&to=20 reprints one section
const from = Math.max(1, Number(params.get('from') || 1));
const to = Number(params.get('to') || Infinity);

// 2-up wants portrait (two 16:9 slides stack neatly); 1-up wants landscape.
const paper = PAPERS[paperKey];
const page = per === 1
  ? { w: paper.h, h: paper.w }
  : { w: paper.w, h: paper.h };

const slotW = page.w - 2 * MARGIN;
// +1px of overscan: the scaled frame and the slot round to device pixels
// independently, and without it a hairline of slot shows down the right edge.
const scale = (slotW / MM_PER_PX + 1) / SLIDE_W;

const root = document.documentElement;
root.style.setProperty('--slot-w', `${slotW}mm`);
root.style.setProperty('--print-scale', scale.toFixed(5));
root.style.setProperty('--paper-w', `${page.w}mm`);
root.style.setProperty('--paper-margin', `${MARGIN}mm`);
// Height of the printable area, so the slides on a sheet can sit centred rather than
// hugging the top. 1mm short of the real box: exactly 100% risks a rounding overflow
// that Chrome pays for with a blank page after every sheet.
root.style.setProperty('--page-content-h', `${page.h - 2 * MARGIN - 1}mm`);

// @page can't be written with custom properties, so emit the rule.
const pageRule = document.createElement('style');
pageRule.textContent = `@page { size: ${page.w}mm ${page.h}mm; margin: ${MARGIN}mm; }`;
document.head.appendChild(pageRule);

document.getElementById('paper-name').textContent =
  `${paperKey.toUpperCase()} ${per === 1 ? 'landscape' : 'portrait'}`;

// Each option link flips one setting and keeps the rest of the query intact.
for (const a of document.querySelectorAll('.print-opts a')) {
  const next = new URLSearchParams(params);
  if (a.dataset.per) next.set('per', a.dataset.per);
  if (a.dataset.paper) next.set('paper', a.dataset.paper === paperKey ? 'a4' : a.dataset.paper);
  a.href = `?${next}`;
  const current = (a.dataset.per && Number(a.dataset.per) === per)
    || (a.dataset.paper && a.dataset.paper === paperKey);
  if (current) a.setAttribute('aria-current', 'true');
}

const status = document.getElementById('status');
const printBtn = document.getElementById('print-btn');
const sheets = document.getElementById('sheets');

const all = await loadAllSlides();
const offset = from - 1;
const slides = all.slice(offset, Number.isFinite(to) ? to : undefined);

// A code slide is the one place where "every fragment revealed" loses information. The
// panel is sized to the slide, so a long method is clamped and scrolls, and the end
// state shows only the band the last step landed on -- the rest of the method never
// appears on paper. Printing one page per step instead walks the same path the room
// saw, and between them the steps cover the code.
//
// Counting mirrors the engine: fragments sharing a data-fragment-index reveal together
// and count once, an unindexed fragment is a step of its own.
function stepCount(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc.querySelector('.vscode-step')) return 0;   // only walkthroughs split
  const indexed = new Set();
  let loose = 0;
  for (const f of doc.querySelectorAll('.fragment')) {
    const idx = f.getAttribute('data-fragment-index');
    if (idx === null) loose++;
    else indexed.add(idx);
  }
  return indexed.size + loose;
}

// One entry per printed slot: a whole slide, or one step of a code walkthrough. The
// number stays the deck's own, so a stepped slide prints as 31 1/4 … 31 4/4.
const entries = [];
slides.forEach((slide, i) => {
  const number = offset + i + 1;
  const steps = expandSteps ? stepCount(slide.html) : 0;
  if (steps < 2) entries.push({ slide, number });
  else for (let step = 1; step <= steps; step++) entries.push({ slide, number, step, steps });
});

// Build the sheets up front so the page has its final height while frames fill in.
const slots = entries.map((entry, i) => {
  const slide = entry.slide;
  if (i % per === 0) {
    const pageEl = document.createElement('section');
    pageEl.className = 'print-page';
    sheets.appendChild(pageEl);
  }
  const pageEl = sheets.lastElementChild;

  const item = document.createElement('figure');
  item.className = 'print-item';

  const slot = document.createElement('div');
  slot.className = 'print-slot';

  const frame = document.createElement('iframe');
  frame.className = 'print-slide';
  frame.setAttribute('scrolling', 'no');
  frame.setAttribute('loading', 'eager');
  frame.title = entry.step ? `${slide.title} (step ${entry.step})` : slide.title;
  frame.dataset.src = `print-frame.html?i=${i}`
    + (entry.step ? `&step=${entry.step}` : '')
    + `#${encodeURIComponent(slide.id)}`;

  slot.appendChild(frame);
  item.appendChild(slot);

  if (showNumbers) {
    const cap = document.createElement('figcaption');
    cap.className = 'print-caption';
    cap.innerHTML = `<b>${entry.number}</b><span>${slide.title}</span>`
      + (entry.step ? `<em>${entry.step}/${entry.steps}</em>` : '');
    item.appendChild(cap);
  }

  pageEl.appendChild(item);
  return slot;
});

// Render in small batches: 60 frames at once means 60 Monaco tokenizers at once.
let done = 0;
const pending = new Map();   // seq -> resolve

window.addEventListener('message', (e) => {
  if (e.data?.type !== 'slide-ready') return;
  pending.get(String(e.data.seq))?.();
});

function renderFrame(i) {
  const slot = slots[i];
  const frame = slot.querySelector('iframe');
  return new Promise(resolve => {
    const finish = () => {
      if (!pending.has(String(i))) return;
      pending.delete(String(i));
      clearTimeout(timer);
      slot.dataset.ready = '1';
      status.textContent = `Rendering slides… ${++done} / ${entries.length}`;
      resolve();
    };
    const timer = setTimeout(finish, FRAME_TIMEOUT);
    pending.set(String(i), finish);
    frame.src = frame.dataset.src;
  });
}

status.textContent = `Rendering slides… 0 / ${entries.length}`;

const queue = entries.map((_, i) => i);
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) await renderFrame(queue.shift());
  })
);

const sheetCount = sheets.children.length;
const span = slides.length === 1 ? `${offset + 1}` : `${offset + 1}–${offset + slides.length}`;
const range = slides.length === all.length ? '' : ` (${span} of ${all.length})`;
const split = entries.length - slides.length;
status.dataset.state = 'ready';
status.textContent = `${slides.length} slide${slides.length === 1 ? '' : 's'}${range}`
  + (split > 0 ? `, +${split} code steps,` : '')
  + ` on ${sheetCount} sheet${sheetCount === 1 ? '' : 's'} — ready to print.`;
printBtn.disabled = false;
printBtn.addEventListener('click', () => window.print());
document.documentElement.dataset.printReady = '1';

if (params.get('auto') === '1') window.print();
