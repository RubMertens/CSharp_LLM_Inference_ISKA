import { makeDraggable, registerInteraction, el } from './interactions.js';

(function () {
  var N = 4;
  var x = [-3, 4, -1, 2];
  var ZERO = 320;
  var SCALE = 35;

  function swish(v) { return v / (1 + Math.exp(-v)); }

  var G_L = 30, G_R = 270, G_T = 60, G_B = 520;
  var G_W = G_R - G_L, G_H = G_B - G_T;
  var G_YMIN = -1, G_YMAX = 6;
  function gx(v) { return G_L + (v + 6) / 12 * G_W; }
  function gy(v) { return G_B - (v - G_YMIN) / (G_YMAX - G_YMIN) * G_H; }

  var dragStartY = 0, dragStartVal = 0;

  function fmt(v) {
    if (Math.abs(v) < 0.01) return '0';
    return Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1);
  }
  function fmtIn(v) { return v % 1 === 0 ? String(v) : v.toFixed(1); }

  function setBar(barId, labelId, value, scale) {
    var bar = el(barId), label = el(labelId);
    if (!bar) return;
    var h = Math.abs(value) * scale;
    h = Math.max(h, 2);
    var neg = value < 0;
    bar.setAttribute('y', neg ? ZERO : ZERO - h);
    bar.setAttribute('height', h);
    if (label) label.setAttribute('y', neg ? ZERO + h + 20 : ZERO - h - 10);
  }

  function update() {
    var out = x.map(swish);

    for (var i = 0; i < N; i++) {
      setBar('silu-ib' + i, 'silu-iv' + i, x[i], SCALE);
      var il = el('silu-iv' + i);
      if (il) il.textContent = fmtIn(x[i]);

      setBar('silu-ob' + i, 'silu-ov' + i, out[i], SCALE);
      var ol = el('silu-ov' + i);
      if (ol) ol.textContent = fmt(out[i]);
    }
    updateSigmoidDot();
  }

  function initSigmoidGraph() {
    var curve = el('sigmoid-curve');
    if (!curve) return;
    var d = '';
    for (var v = -6; v <= 6; v += 0.1) {
      d += (d ? 'L' : 'M') + gx(v).toFixed(1) + ',' + gy(swish(v)).toFixed(1);
    }
    curve.setAttribute('d', d);
    updateSigmoidDot();
  }

  function updateSigmoidDot() {
    var val = x[0], s = swish(val);
    var sx = gx(val), sy = gy(s);
    var dot = el('sigmoid-dot');
    if (dot) { dot.setAttribute('cx', sx); dot.setAttribute('cy', sy); }
    var xl = el('sigmoid-xline');
    if (xl) { xl.setAttribute('x1', sx); xl.setAttribute('y1', sy); xl.setAttribute('x2', sx); xl.setAttribute('y2', gy(0)); }
    var yl = el('sigmoid-yline');
    if (yl) { yl.setAttribute('x1', G_L); yl.setAttribute('y1', sy); yl.setAttribute('x2', sx); yl.setAttribute('y2', sy); }
    var trace = el('sigmoid-trace');
    if (trace) {
      var d = '';
      var end = Math.min(val, 6);
      for (var v = -6; v <= end; v += 0.1) {
        d += (d ? 'L' : 'M') + gx(v).toFixed(1) + ',' + gy(swish(v)).toFixed(1);
      }
      d += 'L' + sx.toFixed(1) + ',' + sy.toFixed(1);
      trace.setAttribute('d', d);
    }
  }

  makeDraggable({
    hit: /^silu-hit(\d)$/,
    cursor: 'ns-resize',
    onStart: function (ctx) {
      dragStartY = ctx.point.y;
      dragStartVal = x[ctx.index];
    },
    onDrag: function (ctx) {
      var dy = dragStartY - ctx.point.y;
      var newVal = dragStartVal + dy / 18;
      newVal = Math.round(newVal * 10) / 10;
      newVal = Math.max(-5, Math.min(5, newVal));
      x[ctx.index] = newVal;
      update();
    },
  });

  // Draw the sigmoid curve when this slide enters (replaces old rAF poll).
  registerInteraction('sigmoid-curve', initSigmoidGraph);
})();
