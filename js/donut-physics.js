/* Homie's Donuts — rigid-body physics for the hero donut drop.
 *
 * Box space (same as js/hero-box.js): x across the box 0..W, y depth (0 = front, 1 = hinge at the back),
 * z up (0 = box rim, the box stands on the ground at z = -0.25).
 *
 * Bodies
 *   donut : a rigid ring (traced from the pistachio donut model) with mass, inertia, restitution and friction.
 *           Contacts are found from points sampled over its surface and resolved with sequential impulses.
 *   lid   : a hinged panel (one rotational degree of freedom) with its own inertia, gravity torque, hinge
 *           damping and a stop at the fully open angle. Cardboard is springy: a hard hit flexes the closed lid
 *           down a little and the stored energy pops it up off the rim, so the hit is what opens the box.
 * Static: the ground, and the box itself (a solid block below the rim).
 * Fixed time step, so the same start gives the same fall on every device.
 */
var H = 1 / 480;                                    // physics step (s)

function v3(x, y, z) { return [x, y, z]; }
function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function qmul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
function qnorm(q) { var l = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
function qaxis(ax, ang) { var s = Math.sin(ang / 2), l = len(ax); return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(ang / 2)]; }
function qmat(q) {
  var x = q[0], y = q[1], z = q[2], w = q[3];
  return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];
}
function mv(m, v) { return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]]; }
function mtv(m, v) { return [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]]; }

/* Donut shape in its own frame (axis = local z), in box units. Numbers come from the model builder:
 * outer radius 1, hole 0.207, domed top (half-height 0.315 + glaze), flatter base (0.235), scaled to SIZE. */
export var DONUT = { size: 0.205, ro: 1, ri: 0.207, bt: 0.315, bb: 0.235, pt: 2.25, pb: 3.3, glaze: 0.03, lift: 0.05, com: 0.07 };
function sx(c, p) { return Math.sign(c) * Math.pow(Math.abs(c), 2 / p); }
function samplePoints(nu, nv) {
  var D = DONUT, pts = [], Rc = (D.ro + D.ri) / 2, a = (D.ro - D.ri) / 2;
  for (var j = 0; j < nv; j++) {
    var ps = (j + 0.5) / nv * Math.PI * 2, c = Math.cos(ps), s = Math.sin(ps), up = s >= 0, p = up ? D.pt : D.pb;
    var r = Rc + a * sx(c, p), z = sx(s, p) * (up ? D.bt : D.bb) + D.lift - D.com + (up ? D.glaze * Math.max(0, s) : 0);
    // the inner (hole) half of the ring can't touch a flat surface before the outer half does: sample it lightly
    var n = c < -0.3 ? Math.round(nu / 2) : nu;
    for (var i = 0; i < n; i++) {
      var ph = (i + (j % 2) * 0.5) / n * Math.PI * 2;
      pts.push([r * Math.cos(ph) * D.size, r * Math.sin(ph) * D.size, z * D.size]);
    }
  }
  return pts;
}

export function createSim(o) {
  o = o || {};
  var W = o.W || 1.409145, BOXH = 0.25, LIDLEN = o.lidLen || 1.02, OVER = 0.015;
  var g = o.gravity || 15;
  var D = DONUT, S = D.size;
  var m = 1, Rc = (D.ro + D.ri) / 2 * S, aa = (D.ro - D.ri) / 2 * S, bb = (D.bt + D.bb) / 2 * S;
  var Iz = m * (Rc * Rc + 0.75 * aa * aa), Ixy = m * (0.5 * Rc * Rc + 0.625 * aa * aa + 0.25 * bb * bb);
  var Iinv = [1 / Ixy, 1 / Ixy, 1 / Iz];
  var pts = samplePoints(o.nu || 28, o.nv || 12);

  var RIM_K = o.rimK || 3000;                         // how stiffly the box rim holds the closed lid up
  var lid = { th: 0, w: 0, m: o.lidMass || 0.9, popped: false, hitJ: 0, free: 0, maxDip: 0, drive: 0, driveT: 0 };
  lid.I = lid.m * LIDLEN * LIDLEN / 3;
  lid.th = -lid.m * g * (LIDLEN / 2) / RIM_K;          // resting on the rim, carrying its own weight
  var OPEN = (o.open || 135) * Math.PI / 180;

  var b = {
    x: o.x0.slice(), v: o.v0.slice(), q: qnorm(o.q0 || [0, 0, 0, 1]), w: (o.w0 || [0, 0, 0]).slice(),
    sleeping: false, still: 0, t: 0
  };
  var ev = { first: null, impact: null, pop: null, leftLid: null, ground: null, sleep: null, lidRest: null };

  function worldInvI(R) {
    // R * diag(Iinv) * R^T
    var M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      M[i][j] = R[i][0] * Iinv[0] * R[j][0] + R[i][1] * Iinv[1] * R[j][1] + R[i][2] * Iinv[2] * R[j][2];
    }
    return M;
  }
  function lidFrame(th) {
    return { h: [0, 1, 0], d: [0, -Math.cos(th), Math.sin(th)], n: [0, Math.sin(th), Math.cos(th)] };
  }

  // find contacts for the current pose
  function contacts(R) {
    var out = [], L = lidFrame(lid.th), lidOpenEnough = lid.th > 0.17;
    for (var i = 0; i < pts.length; i++) {
      var r = mv(R, pts[i]), p = add(b.x, r);
      // ground
      var dg = p[2] + BOXH;
      if (dg < 0.002) out.push({ r: r, n: [0, 0, 1], depth: -dg, kind: 'ground', e: 0.28, mu: 0.6 });
      // lid panel (outer face)
      var rel = sub(p, L.h), s = dot(rel, L.d), dl = dot(rel, L.n);
      if (s > -0.01 && s < LIDLEN + 0.01 && p[0] > -OVER - 0.01 && p[0] < W + OVER + 0.01 && dl < 0.002 && dl > -0.09) {
        out.push({ r: r, n: L.n, depth: -dl, kind: 'lid', s: s, e: 0.38, mu: 0.45 });
        continue;
      }
      // the box below the rim, as a solid block (push out through the nearest face)
      if (p[0] > 0 && p[0] < W && p[1] > 0 && p[1] < 1 && p[2] < 0 && p[2] > -BOXH) {
        var f = [[W - p[0], [1, 0, 0]], [p[0], [-1, 0, 0]], [p[1], [0, -1, 0]], [1 - p[1], [0, 1, 0]], [-p[2], [0, 0, 1]]];
        f.sort(function (A, B) { return A[0] - B[0]; });
        out.push({ r: r, n: f[0][1], depth: f[0][0], kind: 'box', e: 0.22, mu: 0.5 });
      }
    }
    return out;
  }

  function lidTorques(th, w) {
    var t = -lid.m * g * (LIDLEN / 2) * Math.cos(th) - 0.06 * w;     // gravity about the hinge + hinge friction
    if (th < 0) t += -RIM_K * th - 10 * w;                            // the rim pushes back on a flexed lid
    if (lid.drive > 0) t += lid.driveT;                               // the flexed board springing back
    return t;
  }

  function stepOnce() {
    var R = qmat(b.q);
    b.t += H;
    // lid dynamics
    lid.w += lidTorques(lid.th, lid.w) / lid.I * H;
    if (lid.drive > 0) lid.drive -= H;
    if (b.sleeping) { integrateLid(); return; }
    // gravity + a breath of air drag
    b.v[2] -= g * H;
    b.v = mul(b.v, 1 - 0.02 * H);
    var cs = contacts(R), Iw = worldInvI(R);
    var onGround = false, onLid = false;
    for (var k = 0; k < cs.length; k++) {
      var c = cs[k];
      if (c.kind === 'ground') onGround = true;
      if (c.kind === 'lid') onLid = true;
      if (ev.first === null) ev.first = c.kind;
      var vp = add(b.v, cross(b.w, c.r));
      if (c.kind === 'lid') vp = sub(vp, mul(c.n, lid.w * c.s));
      c.vn0 = dot(vp, c.n);
      var rn = cross(c.r, c.n);
      c.kn = 1 / m + dot(rn, mv(Iw, rn)) + (c.kind === 'lid' ? c.s * c.s / lid.I : 0);
      c.jn = 0; c.jt = [0, 0, 0];
      c.bias = Math.max(0, c.depth - 0.002) * 0.2 / H * 0.25;
    }
    // sequential impulses
    for (var it = 0; it < 10; it++) {
      for (k = 0; k < cs.length; k++) {
        c = cs[k];
        vp = add(b.v, cross(b.w, c.r));
        if (c.kind === 'lid') vp = sub(vp, mul(c.n, lid.w * c.s));
        var vn = dot(vp, c.n);
        var target = c.vn0 < -0.6 ? -c.e * c.vn0 : 0;
        var dj = (target + c.bias - vn) / c.kn;
        var jn = Math.max(0, c.jn + dj); dj = jn - c.jn; c.jn = jn;
        if (dj !== 0) applyImpulse(c, mul(c.n, dj), Iw);
        // friction
        vp = add(b.v, cross(b.w, c.r));
        if (c.kind === 'lid') vp = sub(vp, mul(c.n, lid.w * c.s));
        var vt = sub(vp, mul(c.n, dot(vp, c.n))), vtl = len(vt);
        if (vtl > 1e-6) {
          var tdir = mul(vt, 1 / vtl), rt = cross(c.r, tdir);
          var kt = 1 / m + dot(rt, mv(Iw, rt));
          var jt = -vtl / kt;
          var old = c.jt, nt = add(old, mul(tdir, jt)), ntl = len(nt), lim = c.mu * c.jn;
          if (ntl > lim) nt = mul(nt, lim / ntl);
          var djt = sub(nt, old); c.jt = nt;
          applyImpulse(c, djt, Iw, true);
        }
      }
    }
    // record the hit on the lid, and pop it open off the rim once the flex springs back
    var lidJ = 0;
    for (k = 0; k < cs.length; k++) if (cs[k].kind === 'lid') lidJ += cs[k].jn;
    if (lidJ > 0 && ev.impact === null) ev.impact = b.t;
    if (!lid.popped) {
      lid.hitJ += lidJ;
      if (lid.th < lid.maxDip) lid.maxDip = lid.th;
      // the flexed board springs back as soon as the donut comes off it
      lid.free = onLid ? 0 : lid.free + 1;
      if (lid.hitJ > 0.5 && lid.free > 5) {
        lid.popped = true; ev.pop = b.t;
        lid.w = Math.max(lid.w, o.popBase || 3);
        lid.drive = o.popDur || 0.14;
        lid.driveT = Math.min(o.popMax || 40, (o.popGain || 3) * lid.hitJ + (o.popTorque || 14));
      }
    }
    // rolling resistance / settling on the ground
    if (onGround) {
      b.w = mul(b.w, Math.exp(-(o.rollDamp || 2.2) * H));
      if (ev.ground === null && ev.pop !== null) ev.ground = b.t;
    }
    // integrate
    b.x = add(b.x, mul(b.v, H));
    var wl = len(b.w);
    if (wl > 1e-9) b.q = qnorm(qmul(qaxis(b.w, wl * H), b.q));
    integrateLid();
    // push out of anything still overlapping (position only, no energy added)
    R = qmat(b.q);
    var cs2 = contacts(R), worst = {};
    for (k = 0; k < cs2.length; k++) {
      c = cs2[k];
      var key = c.kind + (c.kind === 'box' ? c.n.join() : '');
      if (!worst[key] || c.depth > worst[key].depth) worst[key] = c;
    }
    Object.keys(worst).forEach(function (key) {
      var c = worst[key];
      if (c.depth > 0.003) b.x = add(b.x, mul(c.n, Math.min(0.01, (c.depth - 0.003) * 0.5)));
    });
    if (ev.leftLid === null && ev.pop !== null && b.x[0] - (D.ro * S) > W + OVER) ev.leftLid = b.t;
    // sleep
    var slow = len(b.v) < 0.05 && len(b.w) < 0.2;
    b.still = onGround && slow ? b.still + H : 0;
    if (b.still > 0.3) { b.sleeping = true; b.v = [0, 0, 0]; b.w = [0, 0, 0]; ev.sleep = b.t; }
  }
  function applyImpulse(c, J, Iw) {
    b.v = add(b.v, mul(J, 1 / m));
    b.w = add(b.w, mv(Iw, cross(c.r, J)));
    if (c.kind === 'lid') lid.w -= dot(J, c.n) * c.s / lid.I;      // equal and opposite on the lid, about the hinge
  }
  function integrateLid() {
    lid.th += lid.w * H;
    if (lid.th > OPEN) { lid.th = OPEN; if (lid.w > 0) lid.w = -lid.w * 0.22; }
    if (lid.popped && Math.abs(lid.w) < 0.05 && lid.th > OPEN - 0.01 && ev.lidRest === null) ev.lidRest = b.t;
  }

  var acc = 0;
  return {
    H: H, events: ev, lid: lid, body: b, points: pts,
    step: function (dt) {
      acc += Math.min(dt, 0.05);
      while (acc >= H) { stepOnce(); acc -= H; }
    },
    done: function () { return b.sleeping && (lid.popped ? ev.lidRest !== null : true); },
    lidDeg: function () { return lid.th * 180 / Math.PI; },
    matrix: function () { return qmat(b.q); }
  };
}
export var util = { qaxis: qaxis, qmul: qmul, qmat: qmat, mv: mv };
