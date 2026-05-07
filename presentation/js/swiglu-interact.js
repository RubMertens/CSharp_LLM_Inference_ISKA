(function () {
  var N = 4;
  var x = [-3, 4, -1, 2];
  var ZERO = 320;
  var SCALE = 35;

  var IX = [95, 185, 275, 365];
  var IC = [127, 217, 307, 397];
  var OX = [700, 790, 880, 970];
  var OC = [732, 822, 912, 1002];
  var BAR_W = 65;

  var dragging = null, dragStartY = 0, dragStartVal = 0, svg = null;

  function el(id) { return document.getElementById(id); }

  function swish(v) { return v / (1 + Math.exp(-v)); }

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
  }

  function clientToSVG(svgEl, cx, cy) {
    var pt = svgEl.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(svgEl.getScreenCTM().inverse());
  }

  document.addEventListener('pointerdown', function (e) {
    if (!e.target || !e.target.id) return;
    var m = e.target.id.match(/^silu-hit(\d)$/);
    if (!m) return;
    e.preventDefault(); e.stopPropagation();
    dragging = parseInt(m[1], 10);
    svg = e.target.closest('svg');
    dragStartY = clientToSVG(svg, e.clientX, e.clientY).y;
    dragStartVal = x[dragging];
    document.body.style.cursor = 'ns-resize';
  });

  document.addEventListener('pointermove', function (e) {
    if (dragging === null || !svg) return;
    e.preventDefault();
    var pt = clientToSVG(svg, e.clientX, e.clientY);
    var dy = dragStartY - pt.y;
    var newVal = dragStartVal + dy / 18;
    newVal = Math.round(newVal * 10) / 10;
    newVal = Math.max(-5, Math.min(5, newVal));
    x[dragging] = newVal;
    update();
  });

  document.addEventListener('pointerup', function () {
    if (dragging === null) return;
    dragging = null;
    document.body.style.cursor = '';
    svg = null;
  });
})();
