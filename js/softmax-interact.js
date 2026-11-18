import { makeDraggable, registerInteraction, el } from './interactions.js';

/* ── Bar-chart visual slide (smv-*) ───────────────────── */
// Drag the four raw attention scores (any sign) and watch softmax turn them into
// positive weights that always sum to 100%. Same layout and drag feel as the
// RMSNorm visual slide.
(function () {
  var N = 4;
  var DEFAULTS = [2, 1, 0.5, -1];
  var x = DEFAULTS.slice();

  // Both charts share one baseline (y=500) and one top (y=100): a score of 4 is as
  // tall as 100%. Negative scores hang below the shared baseline.
  var IN_ZERO = 500;
  var IN_SCALE = 100;    // px per score unit → 4 = 400 px
  var IN_MAX = 4;
  var IN_MIN = -2;       // room below the baseline for -2 (200 px) inside the viewBox
  var OUT_BASE = 500;
  var OUT_FULL = 400;    // px for 100% (dashed 100% line at y=100)

  var dragStartY = 0, dragStartVal = 0;

  function fmtIn(v) { return v % 1 === 0 ? String(v) : v.toFixed(1); }
  function fmtPct(p) {
    var pct = p * 100;
    if (pct >= 10) return pct.toFixed(0) + '%';
    if (pct >= 0.1) return pct.toFixed(1) + '%';
    return '<0.1%';
  }

  // Write only on change: replacing a text node is a childList mutation, which
  // re-fires registerInteraction's observer → update() → loop.
  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function softmax(v) {
    var max = Math.max.apply(null, v);
    var e = v.map(function (s) { return Math.exp(s - max); });
    var sum = e.reduce(function (a, b) { return a + b; }, 0);
    return e.map(function (s) { return s / sum; });
  }

  function update() {
    var p = softmax(x);

    for (var i = 0; i < N; i++) {
      var bar = el('smv-ib' + i), label = el('smv-iv' + i);
      if (bar) {
        var h = Math.max(Math.abs(x[i]) * IN_SCALE, 2);
        var neg = x[i] < 0;
        bar.setAttribute('y', neg ? IN_ZERO : IN_ZERO - h);
        bar.setAttribute('height', h);
        if (label) {
          label.setAttribute('y', neg ? IN_ZERO + h + 20 : IN_ZERO - h - 10);
          setText(label, fmtIn(x[i]));
        }
      }

      var ob = el('smv-ob' + i), ol = el('smv-ov' + i);
      if (ob) {
        var oh = Math.max(p[i] * OUT_FULL, 2);
        ob.setAttribute('y', OUT_BASE - oh);
        ob.setAttribute('height', oh);
        if (ol) {
          ol.setAttribute('y', OUT_BASE - oh - 16);
          setText(ol, fmtPct(p[i]));
        }
      }
    }
  }

  // Redraw on every entrance so a drag left over from the last visit matches the bars.
  registerInteraction('smv-svg', update);

  makeDraggable({
    hit: /^smv-hit(\d)$/,
    cursor: 'ns-resize',
    onStart: function (ctx) {
      dragStartY = ctx.point.y;
      dragStartVal = x[ctx.index];
    },
    onDrag: function (ctx) {
      var dy = dragStartY - ctx.point.y;
      var newVal = dragStartVal + dy / IN_SCALE;
      newVal = Math.round(newVal * 10) / 10;
      newVal = Math.max(IN_MIN, Math.min(IN_MAX, newVal));
      x[ctx.index] = newVal;
      update();
    },
  });
})();
