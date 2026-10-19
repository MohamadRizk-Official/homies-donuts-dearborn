/* Homie's Donuts — the pistachio donut that knocks the hero box open.
 *
 * A custom 3D model of the shop's pistachio donut (img/hero/pistachio-donut.glb, built from the product photo)
 * falls onto the closed lid. Its motion and the lid's swing come from a rigid-body simulation
 * (js/donut-physics.js, baked by build-donut-track.mjs into js/donut-track.js so every browser plays the same
 * fall). The hit flexes the lid, the lid springs open, and the donut bounces off to the right, lands on the
 * ground beside the box, tips over and settles.
 *
 * The donut is rendered with three.js through the same camera that was recovered from the box photo, so it sits
 * in the photo's space: invisible stand-ins for the box and lid hide it wherever they are in front, and catch
 * its shadow. Plays once per page load. Reduced motion: the box is shown open with the donut already settled.
 */
// nothing is downloaded unless this page has the hero box (the menu page shares these scripts)
const hb = window.HomiesHeroBox;
const hero = hb && hb.el.closest('.hero');

function fallback() { if (hb) hb.revealed.then(hb.fallback); }

if (hb && hero && !hb.el.dataset.drop) {
  hb.el.dataset.drop = 'loading';          // one run per page load, however often this module is evaluated
  start().catch((err) => { console.warn('Donut drop unavailable:', err); fallback(); });
}

async function start() {
  const [THREE, { GLTFLoader }, { RoomEnvironment }, { default: TRACK }, { DONUT }] = await Promise.all([
    import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/environments/RoomEnvironment.js'),
    import('./donut-track.js?v=1'), import('./donut-physics.js?v=1')
  ]);
  const CAM = hb.cam, W = CAM.W, LID = hb.lid, IMG_W = 1312;
  const canvas = document.createElement('canvas');
  canvas.className = 'hb-drop';
  canvas.setAttribute('aria-hidden', 'true');

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const gltf = await new GLTFLoader().loadAsync('img/hero/pistachio-donut.glb?v=1');

  // ---------------- scene (box space: x across, y depth, z up) ----------------
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const sun = new THREE.DirectionalLight(0xfff4ea, 1.75);       // soft studio key from the upper left, like the photo
  const toLight = new THREE.Vector3(-0.22, -0.34, 0.91).normalize();
  sun.target.position.set(0.95, 0.45, -0.2);
  sun.position.copy(sun.target.position).addScaledVector(toLight, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 1, far: 8 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.004;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xfff6f0, 0xf2c9b0, 0.5));

  // the donut: model is Y-up with its outer radius = 1; physics body has its axis on z and origin at the centre of mass
  const donut = new THREE.Group();
  const model = gltf.scene;
  model.rotation.x = Math.PI / 2;
  model.scale.setScalar(DONUT.size);
  model.position.z = -DONUT.com * DONUT.size;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    o.material.envMapIntensity = 0.4;
  });
  donut.add(model);
  scene.add(donut);

  // invisible stand-ins: they hide the donut where the real box / lid is in front, and catch its shadow
  const hide = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const shade = new THREE.ShadowMaterial({ color: 0x4a2229, opacity: 0.34, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const shadeSoft = shade.clone(); shadeSoft.opacity = 0.26;
  const shadeLid = shade.clone();
  function slab(w, h, mat, order) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.renderOrder = order; return m;
  }
  const BOXH = 0.25;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 1, BOXH), hide);
  base.position.set(W / 2, 0.5, -BOXH / 2); base.renderOrder = -2;
  const ground = slab(6, 6, shade, 1); ground.position.set(1, 0.5, -BOXH); ground.receiveShadow = true;
  const wallR = slab(BOXH, 1, shadeSoft, 1); wallR.rotation.y = Math.PI / 2; wallR.position.set(W + 0.0005, 0.5, -BOXH / 2); wallR.receiveShadow = true;
  const wallF = slab(W, BOXH, shadeSoft, 1); wallF.rotation.x = Math.PI / 2; wallF.position.set(W / 2, -0.0005, -BOXH / 2); wallF.receiveShadow = true;
  scene.add(base, ground, wallR, wallF);
  // soft contact shadow right under the donut, so it sits on the ground instead of hovering
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(60,24,30,0.85)'); gr.addColorStop(0.55, 'rgba(60,24,30,0.45)'); gr.addColorStop(1, 'rgba(60,24,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0 }));
  blob.scale.setScalar(DONUT.size * 2.5); blob.renderOrder = 2;
  scene.add(blob);
  // lid: pivots on the hinge along the back edge; panel + front and side lips, as in js/hero-box.js
  const lid = new THREE.Group(); lid.position.set(0, 1, 0);
  const o = LID.over, Lw = W + 2 * o;
  const panel = slab(Lw, LID.len, hide, -2); panel.position.set(W / 2, -LID.len / 2, 0);
  const panelShade = slab(Lw, LID.len, shadeLid, 1); panelShade.position.copy(panel.position); panelShade.receiveShadow = true;
  const lipF = slab(Lw, LID.lip, hide, -2); lipF.rotation.x = Math.PI / 2; lipF.position.set(W / 2, -LID.len, -LID.lip / 2);
  const sideShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(LID.len, 0), new THREE.Vector2(LID.len, -LID.lip), new THREE.Vector2(0, -LID.lip * LID.taper)]);
  const sideGeo = new THREE.ShapeGeometry(sideShape);
  const sideBasis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0));
  [-o, W + o].forEach((x) => {
    const s = new THREE.Mesh(sideGeo, hide); s.renderOrder = -2;
    s.quaternion.setFromRotationMatrix(sideBasis); s.position.set(x, 0, 0);   // shape x -> toward the front, shape y -> up
    lid.add(s);
  });
  lid.add(panel, panelShade, lipF);
  scene.add(lid);

  // ---------------- camera: the box photo's camera, mapped onto this canvas ----------------
  const camera = new THREE.PerspectiveCamera();
  camera.matrixAutoUpdate = false;
  const R = CAM.R, t = CAM.t;
  const view = new THREE.Matrix4().set(
    R[0][0], R[0][1], R[0][2], t[0],
    -R[1][0], -R[1][1], -R[1][2], -t[1],
    -R[2][0], -R[2][1], -R[2][2], -t[2],
    0, 0, 0, 1);
  camera.matrix.copy(view).invert();
  camera.updateMatrixWorld(true);
  const near = 0.5, far = 12;
  function project(X) {          // box space -> photo pixels
    const px = R[0][0] * X[0] + R[0][1] * X[1] + R[0][2] * X[2] + t[0];
    const py = R[1][0] * X[0] + R[1][1] * X[1] + R[1][2] * X[2] + t[1];
    const pz = R[2][0] * X[0] + R[2][1] * X[1] + R[2][2] * X[2] + t[2];
    return [px / pz * CAM.f + CAM.c[0], py / pz * CAM.f + CAM.c[1], pz];
  }
  // where the donut first comes into view: just below its starting position, so it falls in from out of sight
  const F = TRACK.frames, n = TRACK.count;
  const s0 = project([F[0], F[1], F[2]]);
  const enterBottom = s0[1] + 0.23 * CAM.f / s0[2];               // photo px (negative: above the photo frame)
  const texts = Array.from(hero.querySelectorAll('.hero-hello, .hero h1, .hero-lede, .hero-ctas, .hero-address'));

  let cw = 0, ch = 0;
  function layout() {
    const hr = hero.getBoundingClientRect(), sr = hb.stage.getBoundingClientRect();
    if (!sr.width) return false;
    const k = sr.width / IMG_W;
    const left = Math.max(hr.left, sr.left - 0.02 * sr.width);
    const right = Math.min(hr.right, sr.right + 0.34 * sr.width);
    let top = sr.top + enterBottom * k;
    // never over the headline, buttons or any other text above the box
    texts.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height && r.bottom < sr.top + sr.height * 0.4 && r.right > left && r.left < right) top = Math.max(top, r.bottom + 6);
    });
    top = Math.max(top, hr.top);
    const bottom = Math.min(hr.bottom, sr.bottom + 0.03 * sr.width);
    cw = Math.round(right - left); ch = Math.round(bottom - top);
    canvas.style.left = (left - hr.left) + 'px';
    canvas.style.top = (top - hr.top) + 'px';
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    const fade = Math.round(Math.max(40, Math.min(110, sr.width * 0.17)));   // it eases into view as it falls in
    canvas.style.setProperty('--fade', fade + 'px');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(cw, ch, false);
    // intrinsics of the photo camera, scaled to the stage and shifted to this canvas
    const fx = CAM.f * k, cx = CAM.c[0] * k + (sr.left - left), cy = CAM.c[1] * k + (sr.top - top);
    camera.projectionMatrix.set(
      2 * fx / cw, 0, 1 - 2 * cx / cw, 0,
      0, 2 * fx / ch, 2 * cy / ch - 1, 0,
      0, 0, -(far + near) / (far - near), -2 * far * near / (far - near),
      0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    return true;
  }

  // ---------------- playback ----------------
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function pose(f) {
    f = Math.max(0, Math.min(n - 1, f));
    const i = Math.min(n - 2, Math.floor(f)), a = f - i, A = i * 8, B = A + 8;
    donut.position.set(F[A] + (F[B] - F[A]) * a, F[A + 1] + (F[B + 1] - F[A + 1]) * a, F[A + 2] + (F[B + 2] - F[A + 2]) * a);
    qa.set(F[A + 3], F[A + 4], F[A + 5], F[A + 6]); qb.set(F[B + 3], F[B + 4], F[B + 5], F[B + 6]);
    donut.quaternion.slerpQuaternions(qa, qb, a);
    const deg = F[A + 7] + (F[B + 7] - F[A + 7]) * a;
    lid.rotation.x = -deg * Math.PI / 180;
    // a soft studio light: the shadow is faint while the donut is high and firms up as it comes down
    const z = donut.position.z;
    ground.material.opacity = 0.34 * Math.min(1, Math.max(0, 1.2 - (z + BOXH) / 0.5));
    shadeSoft.opacity = 0.26 * Math.min(1, Math.max(0, 1.2 - (z + BOXH) / 0.5));
    panelShade.material.opacity = 0.34 * Math.min(1, Math.max(0, 1.2 - z / 0.5));
    const lift = z + BOXH - 0.04;                 // height of the donut's base above the ground
    blob.position.set(donut.position.x + 0.01, donut.position.y + 0.015, -BOXH + 0.001);
    blob.material.opacity = 0.5 * Math.min(1, Math.max(0, 1 - lift / 0.22)) * (donut.position.x > W + 0.05 ? 1 : 0);
    return deg;
  }
  function draw() { renderer.render(scene, camera); }

  hero.appendChild(canvas);
  await hb.revealed;
  // ready to play: from here the donut opens the box, whenever the visitor actually sees it
  const ours = hb.claim();
  await inView(hb.el);
  if (!layout()) throw new Error('hero box not laid out');
  hb.el.dataset.drop = 'playing';

  const settled = () => {
    pose(n - 1); layout(); draw();
    hb.el.dataset.drop = 'done';
    window.addEventListener('resize', () => { if (layout()) draw(); });
  };
  if (hb.reduced) { settled(); return; }
  if (!ours) {                            // the lid already opened without us (slow connection): just show it resting
    canvas.classList.add('is-late');
    settled(); return;
  }

  const ev = TRACK.events;
  // ?dropslow=N plays N times slower and exposes seek(frame) for checking individual moments
  const slow = Math.max(1, +new URLSearchParams(location.search).get('dropslow') || 1);
  let seekTo = null;
  if (slow > 1) window.HomiesDonutDrop = { seek: (f) => { seekTo = f; }, frames: n, events: ev };
  let t0 = 0, popped = false, finished = false;
  let resized = true;
  const onResize = () => { resized = true; };
  window.addEventListener('resize', onResize);
  function frame(now) {
    if (!t0) t0 = now;
    const f = seekTo !== null ? seekTo : (now - t0) / 1000 * TRACK.fps / slow;
    if (resized) { resized = false; layout(); }
    const deg = pose(f);
    if (!finished) hb.render(deg);
    if (!popped && f >= ev.pop) { popped = true; hb.opening(); }
    if (!finished && f >= ev.lidRest) { finished = true; hb.finish(); }
    draw();
    if (f < n - 1) requestAnimationFrame(frame);
    else { window.removeEventListener('resize', onResize); if (!finished) hb.finish(); settled(); }
  }
  pose(0); hb.render(0); draw();
  requestAnimationFrame(frame);
}

// resolve once the box is at least partly on screen and the page is visible
function inView(el) {
  return new Promise((resolve) => {
    const ready = () => document.visibilityState === 'visible';
    if (!('IntersectionObserver' in window)) { resolve(); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && ready()) { io.disconnect(); resolve(); }
    }, { threshold: 0.35 });
    io.observe(el);
    document.addEventListener('visibilitychange', () => { if (ready()) { io.unobserve(el); io.observe(el); } });
  });
}
