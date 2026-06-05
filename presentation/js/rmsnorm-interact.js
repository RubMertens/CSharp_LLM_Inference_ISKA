import { makeDraggable, el } from './interactions.js';

/* ── Numeric table slide (rms-*) ──────────────────────── */
(function () {
  const N = 4;
  const WEIGHTS = [1.0, 0.5, 2.0, 1.0];
  const x = [2, 3, 1, 4];

  let dragStartY = 0;
  let dragStartVal = 0;

  function fmt(v, d) { return v.toFixed(d === undefined ? 2 : d); }

  function update() {
    const sq = x.map(v => v * v);
    const sum = sq.reduce((a, b) => a + b, 0);
    const mean = sum / N;
    const rms = Math.sqrt(mean + 1e-5);
    const scale = 1 / rms;

    for (let i = 0; i < N; i++) {
      const xi = el('rms-x' + i);
      if (xi) xi.textContent = fmt(x[i], x[i] % 1 === 0 ? 0 : 1);

      const sqi = el('rms-sq' + i);
      if (sqi) sqi.textContent = fmt(sq[i], sq[i] % 1 === 0 ? 0 : 1);

      const sx = scale * x[i];
      const sxi = el('rms-sx' + i);
      if (sxi) sxi.textContent = fmt(sx);

      const wi = el('rms-w' + i);
      if (wi) wi.textContent = fmt(WEIGHTS[i], 1);

      const out = WEIGHTS[i] * sx;
      const outi = el('rms-out' + i);
      if (outi) outi.textContent = fmt(out);
    }

    const sumEl = el('rms-sum');
    if (sumEl) sumEl.textContent = 'Σ = ' + fmt(sum, sum % 1 === 0 ? 0 : 1);

    const meanEl = el('rms-mean');
    if (meanEl) meanEl.textContent = '÷' + N + ' = ' + fmt(mean, 1);

    const rmsEl = el('rms-rms');
    if (rmsEl) rmsEl.textContent = '√ = ' + fmt(rms);

    const scaleEl = el('rms-scale');
    if (scaleEl) scaleEl.textContent = fmt(scale);
  }

  makeDraggable({
    hit: /^rms-hit(\d)$/,
    cursor: 'ns-resize',
    onStart({ index, point }) {
      dragStartY = point.y;
      dragStartVal = x[index];
    },
    onDrag({ index, point }) {
      const dy = dragStartY - point.y;
      let newVal = dragStartVal + dy / 25;
      newVal = Math.round(newVal * 10) / 10;
      newVal = Math.max(-9, Math.min(9, newVal));
      x[index] = newVal;
      update();
    },
  });
})();

/* ── Bar-chart visual slide (rmsv-*) ──────────────────── */
(function () {
  var N = 4;
  var x = [2, 3, 1, 4];
  var BASELINE = 540;
  var MAX_H = 420;
  var IN_SCALE = MAX_H / 9;
  var OUT_SCALE = 200;

  var IX = [95, 180, 265, 350];
  var IC = [127, 212, 297, 382];
  var OX = [700, 785, 870, 955];
  var OC = [732, 817, 902, 987];

  var dragStartY = 0, dragStartVal = 0;

  function fmt(v) { return Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1); }
  function fmtIn(v) { return v % 1 === 0 ? String(v) : v.toFixed(1); }

  function setBar(barId, labelId, xPos, centerX, value, scale) {
    var bar = el(barId), label = el(labelId);
    if (!bar) return;
    var h = Math.min(Math.abs(value) * scale, MAX_H);
    h = Math.max(h, 2);
    var neg = value < 0;
    bar.setAttribute('y', neg ? BASELINE : BASELINE - h);
    bar.setAttribute('height', h);
    if (label) {
      label.setAttribute('y', neg ? BASELINE + h + 16 : BASELINE - h - 8);
    }
  }

  function update() {
    var sq = x.map(function (v) { return v * v; });
    var sum = 0;
    for (var i = 0; i < N; i++) sum += sq[i];
    var mean = sum / N;
    var rms = Math.sqrt(mean + 1e-5);
    var scale = 1 / rms;
    var norm = x.map(function (v) { return v * scale; });

    for (var i = 0; i < N; i++) {
      setBar('rmsv-ib' + i, 'rmsv-iv' + i, IX[i], IC[i], x[i], IN_SCALE);
      var label = el('rmsv-iv' + i);
      if (label) label.textContent = fmtIn(x[i]);

      setBar('rmsv-ob' + i, 'rmsv-ov' + i, OX[i], OC[i], norm[i], OUT_SCALE);
      var olabel = el('rmsv-ov' + i);
      if (olabel) olabel.textContent = fmt(norm[i]);
    }

    var rmsLine = el('rmsv-rmsline');
    if (rmsLine) {
      var rmsY = BASELINE - Math.min(rms * IN_SCALE, MAX_H);
      rmsLine.setAttribute('y1', rmsY);
      rmsLine.setAttribute('y2', rmsY);
    }
    var rmsLabel = el('rmsv-rmslabel');
    if (rmsLabel) rmsLabel.setAttribute('y', BASELINE - Math.min(rms * IN_SCALE, MAX_H));
  }

  makeDraggable({
    hit: /^rmsv-hit(\d)$/,
    cursor: 'ns-resize',
    onStart: function (ctx) {
      dragStartY = ctx.point.y;
      dragStartVal = x[ctx.index];
    },
    onDrag: function (ctx) {
      var dy = dragStartY - ctx.point.y;
      var newVal = dragStartVal + dy / 18;
      newVal = Math.round(newVal * 10) / 10;
      newVal = Math.max(0.1, Math.min(9, newVal));
      x[ctx.index] = newVal;
      update();
    },
  });
})();
