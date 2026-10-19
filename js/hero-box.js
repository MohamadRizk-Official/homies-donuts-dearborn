/* Homie's Donuts — hero box
 *
 * The base and donuts are the real product photo (img/hero/box-base.webp + donut layers).
 * The lid is drawn on top as textured faces projected through the same camera as the photo
 * (recovered from the box rim), so it hinges on the real back edge and can close over the
 * whole box. Every fresh load starts closed; the falling 3D donut (js/hero-scene.js) knocks it open.
 * When WebGL is available that module also draws the lid as real 3D cardboard; these CSS faces are the fallback.
 */
(function () {
  'use strict';
  var box = document.querySelector('[data-hero-box]');
  if (!box) return;
  var stage = box.querySelector('.hb-stage');
  var lidEl = box.querySelector('[data-lid]');
  var dim = box.querySelector('.hb-dim');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // camera recovered from the photo (image space 1312 x 1199, principal point at centre)
  var CAM = {
    f: 2240.8268, W: 1.409145, c: [656, 600],
    R: [[0.917431, 0.390856, -0.07451], [0.179916, -0.574521, -0.798471], [-0.354895, 0.719136, -0.597405]],
    t: [-0.860662, 0.347017, 3.425569]
  };
  var LID = { len: 1.02, lip: 0.085, taper: 0.25, over: 0.015, open: 135 };
  var IMG_W = 1312;
  // camera position in box space: C = -R^T t
  var CPOS = [0, 1, 2].map(function (i) { return -(CAM.R[0][i] * CAM.t[0] + CAM.R[1][i] * CAM.t[1] + CAM.R[2][i] * CAM.t[2]); });
  var LIGHT = norm([-0.35, -0.55, 0.76]);

  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function add(a, b, s) { s = s == null ? 1 : s; return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function proj(X, k) {
    var R = CAM.R, t = CAM.t;
    var px = R[0][0] * X[0] + R[0][1] * X[1] + R[0][2] * X[2] + t[0];
    var py = R[1][0] * X[0] + R[1][1] * X[1] + R[1][2] * X[2] + t[1];
    var pz = R[2][0] * X[0] + R[2][1] * X[1] + R[2][2] * X[2] + t[2];
    return [(px / pz * CAM.f + CAM.c[0]) * k, (py / pz * CAM.f + CAM.c[1]) * k];
  }
  // CSS matrix3d that maps a w x h element onto quad q (TL, TR, BR, BL)
  function quadMatrix(w, h, q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    var den = dx1 * dy2 - dy1 * dx2;
    var g = (dx3 * dy2 - dy3 * dx2) / den, hh = (dx1 * dy3 - dy1 * dx3) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
    var d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
    return 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, c, f, 0, 1].join(',') + ')';
  }

  // faces: panel + three lips, each with an outer and an inner skin
  function makeFace(cls, w, h, src) {
    var el = document.createElement(src ? 'img' : 'div');
    if (src) { el.src = src; el.alt = ''; el.decoding = 'async'; el.draggable = false; }
    el.className = 'lf ' + cls; el.style.width = w + 'px'; el.style.height = h + 'px';
    lidEl.appendChild(el); return el;
  }
  // the side and front panels are cardboard: cream inside, box-pink outside, with a fold line and a cut edge
  var F = {
    panel: { w: 700, h: 506, out: makeFace('lf-out', 700, 506, 'img/hero/lid-outer.webp'), inn: makeFace('lf-in', 700, 506, 'img/hero/lid-inner.webp?v=2') },
    front: { w: 700, h: 60, out: makeFace('lf-out', 700, 60, 'img/hero/lip-out-front.webp'), inn: makeFace('lf-in', 700, 60, 'img/hero/lip-in.webp') },
    left: { w: 506, h: 60, out: makeFace('lf-out', 506, 60, 'img/hero/lip-out-side.webp'), inn: makeFace('lf-in', 506, 60, 'img/hero/lip-in.webp') },
    right: { w: 506, h: 60, out: makeFace('lf-out', 506, 60, 'img/hero/lip-out-side.webp'), inn: makeFace('lf-in', 506, 60, 'img/hero/lip-in.webp') }
  };

  function geometry(deg) {
    var th = deg * Math.PI / 180, W = CAM.W, o = LID.over;
    var d = [0, -Math.cos(th), Math.sin(th)];          // hinge -> free edge
    var n = [0, -Math.sin(th), -Math.cos(th)];         // inner normal (lips fold this way)
    var hL = [-o, 1, 0], hR = [W + o, 1, 0];
    var fL = add(hL, d, LID.len), fR = add(hR, d, LID.len);
    var lp = LID.lip, lh = LID.lip * LID.taper;        // side panels taper toward the hinge, like a real lid
    // fold edges start a hair behind the main panel so the joins never show a gap
    var e = -0.002;
    var fLe = add(fL, n, e), fRe = add(fR, n, e), hLe = add(hL, n, e), hRe = add(hR, n, e);
    return {
      // corners in element order TL, TR, BR, BL; outward normal for the outer skin
      panel: { q: [fL, fR, hR, hL], nOut: [-n[0], -n[1], -n[2]] },
      front: { q: [fLe, fRe, add(fR, n, lp), add(fL, n, lp)], nOut: d },
      left: { q: [fLe, hLe, add(hL, n, lh), add(fL, n, lp)], nOut: [-1, 0, 0] },
      right: { q: [hRe, fRe, add(fR, n, lp), add(hR, n, lh)], nOut: [1, 0, 0] }
    };
  }

  var current = 0;
  var lidHook = null;                    // set when the 3D cardboard lid (js/hero-scene.js) takes over drawing
  function render(deg) {
    current = deg;
    // a closed (or nearly closed) lid sits in front of the box; an open one is behind it
    box.classList.toggle('lid-behind', deg > 88);
    if (dim) dim.style.opacity = String(Math.min(1, Math.max(0, 1 - deg / 70)) * 0.55);
    if (lidHook) { lidHook(deg); return; }
    var k = stage.clientWidth / IMG_W;
    var g = geometry(deg);
    Object.keys(F).forEach(function (name) {
      var face = F[name], geo = g[name];
      var centre = [0, 1, 2].map(function (i) { return (geo.q[0][i] + geo.q[1][i] + geo.q[2][i] + geo.q[3][i]) / 4; });
      var toCam = sub(CPOS, centre);
      var outerVisible = dot(geo.nOut, toCam) > 0;
      var show = outerVisible ? face.out : face.inn, hide = outerVisible ? face.inn : face.out;
      var q = geo.q.map(function (X) { return proj(X, k); });
      // the inner skin is seen from the other side: mirror it so the logo reads correctly
      if (!outerVisible && name !== 'panel') q = [q[1], q[0], q[3], q[2]];
      show.style.transform = quadMatrix(face.w, face.h, q);
      var nVis = outerVisible ? geo.nOut : [-geo.nOut[0], -geo.nOut[1], -geo.nOut[2]];
      // soft, consistent light: a strong ambient term so faces turned from the light read as shade, not grime
      var ln = dot(nVis, LIGHT);
      var light = name === 'panel' ? 0.62 + 0.4 * Math.max(0, ln) : 0.93 + 0.1 * ln;
      show.style.filter = 'brightness(' + Math.max(0.86, Math.min(light, 1.02)).toFixed(3) + ')';
      show.style.zIndex = String(100 - Math.round(Math.hypot(toCam[0], toCam[1], toCam[2]) * 10));
      show.style.visibility = 'visible'; hide.style.visibility = 'hidden';
    });
  }

  // smooth, controlled swing: ease in and out, no overshoot, the box itself never moves
  function easeIO(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function tween(from, to, ms, fn, done) {
    var start = performance.now();
    function step(now) {
      var p = Math.min(1, (now - start) / ms);
      render(from + (to - from) * fn(p));
      if (p < 1) requestAnimationFrame(step); else if (done) done();
    }
    requestAnimationFrame(step);
  }

  window.addEventListener('resize', function () { render(current); });

  /* Opening. On every fresh load the box starts closed and a 3D donut (js/hero-scene.js) falls onto
   * the lid; its impact is what swings the lid open, and js/hero-scene.js drives render() frame by frame.
   * If the donut can't run (no WebGL, the 3D library didn't load), the lid opens on its own after a pause. */
  var state = 'closed';                 // closed -> (claimed by the donut) -> open
  var fallbackTimer = 0;
  function finish() {
    clearTimeout(fallbackTimer);
    state = 'open';
    render(LID.open);
    box.classList.add('is-in', 'is-opening', 'is-open');
  }
  function fallbackOpen() {
    if (state !== 'closed') return;
    state = 'claimed';
    box.classList.add('is-opening');
    tween(current, LID.open, 1700, easeIO, finish);
  }

  render(0);
  var revealed = new Promise(function (resolve) {
    if (reduce) { finish(); resolve(); return; }
    var imgs = Array.prototype.slice.call(box.querySelectorAll('img'));
    var ready = Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }));
    Promise.race([ready, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
      box.classList.add('is-in');
      fallbackTimer = setTimeout(fallbackOpen, 7000);
      resolve();
    });
  });
  window.HomiesHeroBox = {
    el: box, stage: stage, cam: CAM, lid: LID, reduced: reduce,
    render: render,                     // lid angle in degrees (also handy from the console)
    revealed: revealed,                 // resolves once the closed box is on screen
    // the donut takes over the opening; false if the lid already opened without it
    claim: function () { if (state !== 'closed') return false; state = 'claimed'; clearTimeout(fallbackTimer); return true; },
    opening: function () { box.classList.add('is-opening'); },
    finish: finish,
    current: function () { return current; },
    // hand lid drawing to a 3D renderer; the flat CSS faces stay as the fallback
    useLid: function (fn) { lidHook = fn; box.classList.add('has-3d-lid'); render(current); },
    fallback: fallbackOpen
  };
})();
