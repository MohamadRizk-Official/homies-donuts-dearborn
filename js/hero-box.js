/* Homie's Donuts — hero box
 *
 * The base and donuts are the real product photo (img/hero/box-base.webp + donut layers).
 * The lid is drawn on top as textured faces projected through the same camera as the photo
 * (recovered from the box rim), so it hinges on the real back edge and can close over the
 * whole box. Sequence: closed box drops in → wiggle → lid hinges back to ~135° → glow + shine.
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
  var LID = { len: 1.02, lip: 0.06, over: 0.015, open: 135 };
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
  var F = {
    panel: { w: 700, h: 506, out: makeFace('lf-out', 700, 506, 'img/hero/lid-outer.webp'), inn: makeFace('lf-in', 700, 506, 'img/hero/lid-inner.webp') },
    front: { w: 700, h: 55, out: makeFace('lf-out', 700, 55, 'img/hero/lip-front.webp'), inn: makeFace('lf-in lf-paper', 700, 55) },
    left: { w: 506, h: 55, out: makeFace('lf-out', 506, 55, 'img/hero/lip-front.webp'), inn: makeFace('lf-in lf-paper', 506, 55) },
    right: { w: 506, h: 55, out: makeFace('lf-out', 506, 55, 'img/hero/lip-front.webp'), inn: makeFace('lf-in lf-paper', 506, 55) }
  };

  function geometry(deg) {
    var th = deg * Math.PI / 180, W = CAM.W, o = LID.over;
    var d = [0, -Math.cos(th), Math.sin(th)];          // hinge -> free edge
    var n = [0, -Math.sin(th), -Math.cos(th)];         // inner normal (lips fold this way)
    var hL = [-o, 1, 0], hR = [W + o, 1, 0];
    var fL = add(hL, d, LID.len), fR = add(hR, d, LID.len);
    var lp = LID.lip;
    return {
      // corners in element order TL, TR, BR, BL; outward normal for the outer skin
      panel: { q: [fL, fR, hR, hL], nOut: [-n[0], -n[1], -n[2]] },
      front: { q: [fL, fR, add(fR, n, lp), add(fL, n, lp)], nOut: d },
      left: { q: [fL, hL, add(hL, n, lp), add(fL, n, lp)], nOut: [-1, 0, 0] },
      right: { q: [hR, fR, add(fR, n, lp), add(hR, n, lp)], nOut: [1, 0, 0] }
    };
  }

  var current = 0;
  function render(deg) {
    current = deg;
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
      var light = (name === 'panel' ? 0.62 : 0.8) + 0.4 * Math.max(0, dot(nVis, LIGHT));
      show.style.filter = 'brightness(' + Math.min(light, 1.08).toFixed(3) + ')';
      show.style.zIndex = String(100 - Math.round(Math.hypot(toCam[0], toCam[1], toCam[2]) * 10));
      show.style.visibility = 'visible'; hide.style.visibility = 'hidden';
    });
    // a closed (or nearly closed) lid sits in front of the box; an open one is behind it
    box.classList.toggle('lid-behind', deg > 88);
    if (dim) dim.style.opacity = String(Math.max(0, 1 - deg / 70) * 0.55);
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

  // the opening plays once per visit; refreshing shows the open box straight away
  var played = false;
  try { played = sessionStorage.getItem('homiesBoxOpened') === '1'; } catch (e) {}
  function finish() {
    render(LID.open);
    box.classList.add('is-in', 'is-opening', 'is-open');
    try { sessionStorage.setItem('homiesBoxOpened', '1'); } catch (e) {}
  }

  render(0);
  window.HomiesHeroBox = { render: render };   // handy for checking angles from the console
  if (reduce || played) { finish(); return; }
  var imgs = Array.prototype.slice.call(box.querySelectorAll('img'));
  var ready = Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }));
  Promise.race([ready, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
    box.classList.add('is-in');
    setTimeout(function () {
      box.classList.add('is-opening');
      tween(0, LID.open, 1700, easeIO, finish);
    }, 450);
  });
})();
