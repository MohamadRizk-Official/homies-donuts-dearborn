/* Homie's Donuts — the hero box scene.
 *
 * 1. The box sits closed and still.
 * 2. A chocolate-sprinkle donut (img/hero/sprinkle-donut.glb, built from the product photo by tools/make_donut.py)
 *    falls in from above and hits the lid. The hit flexes the lid down and gives it the momentum that swings it open.
 * 3. It carries on in one continuous arc: off the lid, one smooth flip, down onto the ground well clear of the box,
 *    where it slides a touch and settles.
 * 4. A small white cartoon kid runs in from the right, picks the donut up in both hands, turns round and runs off.
 *
 * Everything is drawn with three.js through the camera recovered from the box photo, so it sits in the photo's space.
 * The lid is real 3D cardboard (thickness, folds, hinge, lighting and shadows) drawn in the lid's own layer, so it
 * still slips behind the box once open. The donut and mascot are drawn above the page in the hero; invisible stand-ins
 * for the box and lid hide them where the box is in front and catch their shadows.
 *
 * The mascot is drawn flat in 2D, in screen space at one fixed scale, so its run is a straight horizontal line and it
 * never changes size. A little skeleton underneath keeps it fluid: arms and legs use two-bone IK, feet are planted
 * on the ground while the body passes over them (so they never slide), and it turns gradually, like a cut-out.
 * Plays once per page load. Reduced motion: the box is shown open with the mascot standing beside it holding the donut.
 */
// nothing is downloaded unless this page has the hero box (the menu page shares these scripts)
const hb = window.HomiesHeroBox;
const hero = hb && hb.el.closest('.hero');

function fallback() { if (hb) { hb.lidFailed(); hb.revealed.then(hb.fallback); } }

if (hb && hero && !hb.el.dataset.drop) {
  hb.el.dataset.drop = 'loading';          // one run per page load, however often this module is evaluated
  start().catch((err) => { console.warn('Hero scene unavailable:', err); fallback(); });
}

// ---------------------------------------------------------------------------------------------------------------
// small maths helpers (box space: x across the box 0..W, y depth 0 = front .. 1 = hinge, z up, 0 = box rim)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const smoother = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
const angLerp = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;

async function start() {
  const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
    import('three'), import('three/addons/loaders/GLTFLoader.js'), import('three/addons/environments/RoomEnvironment.js')
  ]);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const CAM = hb.cam, W = CAM.W, LID = hb.lid, IMG_W = 1312, BOXH = 0.25;

  // ---------------- camera of the box photo, mapped onto any canvas ----------------
  const R = CAM.R, t = CAM.t;
  const view = new THREE.Matrix4().set(
    R[0][0], R[0][1], R[0][2], t[0],
    -R[1][0], -R[1][1], -R[1][2], -t[1],
    -R[2][0], -R[2][1], -R[2][2], -t[2],
    0, 0, 0, 1);
  function photoCamera() {
    const c = new THREE.PerspectiveCamera();
    c.matrixAutoUpdate = false;
    c.matrix.copy(view).invert();
    c.updateMatrixWorld(true);
    return c;
  }
  const near = 0.4, far = 14;
  // canvas rect and stage rect are page rects; the photo's intrinsics are scaled to the stage and shifted to the canvas
  function fitCamera(cam, cr, sr) {
    const k = sr.width / IMG_W, fx = CAM.f * k, cx = CAM.c[0] * k + (sr.left - cr.left), cy = CAM.c[1] * k + (sr.top - cr.top);
    cam.projectionMatrix.set(
      2 * fx / cr.width, 0, 1 - 2 * cx / cr.width, 0,
      0, 2 * fx / cr.height, 2 * cy / cr.height - 1, 0,
      0, 0, -(far + near) / (far - near), -2 * far * near / (far - near),
      0, 0, -1, 0);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    cam.userData = { fx, cx, cy };
  }
  function project(X) {              // box space -> photo pixels (+ depth)
    const px = R[0][0] * X[0] + R[0][1] * X[1] + R[0][2] * X[2] + t[0];
    const py = R[1][0] * X[0] + R[1][1] * X[1] + R[1][2] * X[2] + t[1];
    const pz = R[2][0] * X[0] + R[2][1] * X[1] + R[2][2] * X[2] + t[2];
    return [px / pz * CAM.f + CAM.c[0], py / pz * CAM.f + CAM.c[1], pz];
  }
  const toLight = V3(-0.35, -0.55, 0.76).normalize();      // the photo's soft key light: upper left, in front

  // ---------------- assets ----------------
  const texLoader = new THREE.TextureLoader();
  const loadTex = (src) => new Promise((res, rej) => texLoader.load(src, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; res(tx); }, undefined, rej));
  const gltfP = new GLTFLoader().loadAsync('img/hero/sprinkle-donut.glb?v=2');
  gltfP.catch(() => {});
  const [txPanelIn, txPanelOut, txLipIn, txLipFront, txLipSide] = await Promise.all([
    loadTex('img/hero/lid-inner.webp?v=2'), loadTex('img/hero/lid-outer.webp'), loadTex('img/hero/lip-in.webp'),
    loadTex('img/hero/lip-out-front.webp'), loadTex('img/hero/lip-out-side.webp')
  ]);

  // ================================================================================================================
  // LID: sturdy folded cardboard
  // ================================================================================================================
  const T = 0.014;                                   // board thickness (~3.5mm at this box's scale)
  const o = LID.over, L = LID.len, LP = 0.085, LH = 0.062;   // overhang, panel depth, front lip, side lip at the hinge
  const xL = -o, xR = W + o, yF = 1 - L, yH = 1;

  // a textured rectangle (possibly a trapezoid) from corners TL, TR, BR, BL; uv (0,1) is the image's top-left.
  // ao(u, v) darkens folds and the hinge through vertex colours; `n` is the outward normal used to fix the winding.
  function sheet(c, n, nu = 1, nv = 1, ao = null) {
    const pos = [], uv = [], col = [], idx = [];
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = i / nu, w = j / nv;
        const top = c[0].clone().lerp(c[1], u), bot = c[3].clone().lerp(c[2], u), p = top.lerp(bot, w);
        pos.push(p.x, p.y, p.z); uv.push(u, 1 - w);
        const a = ao ? ao(u, 1 - w) : 1; col.push(a, a, a);
      }
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, cc = a + nu + 1, d = cc + 1;
      idx.push(a, cc, b, b, cc, d);
    }
    const e1 = c[1].clone().sub(c[0]), e2 = c[3].clone().sub(c[0]);
    if (e2.clone().cross(e1).dot(n) < 0) for (let k = 0; k < idx.length; k += 3) { const s = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = s; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const board = (map) => new THREE.MeshStandardMaterial({ map, roughness: 0.86, metalness: 0, vertexColors: true });
  // the cut edge of the board: cream liner with the corrugation showing through
  const edgeTex = (() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 32;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 32);
    gr.addColorStop(0, '#f1e3d6'); gr.addColorStop(0.18, '#e2c9b1'); gr.addColorStop(0.5, '#cfae8e'); gr.addColorStop(0.82, '#e2c9b1'); gr.addColorStop(1, '#f6c3d4');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 32);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const matEdge = board(edgeTex);
  const fold = (u) => 1 - 0.1 * Math.exp(-u / 0.12);         // soft shade tucked into a fold

  function buildLid(withMaterials) {
    const P = (x, y, z) => V3(x, y - 1, z);                 // lid parts live in the hinge's frame
    const parts = [];
    const add = (geo, mat) => { parts.push([geo, mat]); };
    // main panel: outside (rings) on top, inside (logo) underneath, hinge and fold shading baked in
    add(sheet([P(xL, yF, T), P(xR, yF, T), P(xR, yH, T), P(xL, yH, T)], V3(0, 0, 1)), withMaterials && board(txPanelOut));
    add(sheet([P(xL, yF, 0), P(xR, yF, 0), P(xR, yH, 0), P(xL, yH, 0)], V3(0, 0, -1), 24, 24,
      (u, v) => 1 - 0.2 * Math.exp(-v / 0.07) - 0.07 * Math.exp(-(1 - v) / 0.035) - 0.07 * Math.exp(-u / 0.025) - 0.07 * Math.exp(-(1 - u) / 0.025)),
    withMaterials && board(txPanelIn));
    // front lip
    add(sheet([P(xL, yF, T), P(xR, yF, T), P(xR, yF, -LP), P(xL, yF, -LP)], V3(0, -1, 0)), withMaterials && board(txLipFront));
    add(sheet([P(xR, yF + T, 0), P(xL, yF + T, 0), P(xL, yF + T, -LP), P(xR, yF + T, -LP)], V3(0, 1, 0), 1, 8, (u, v) => fold(1 - v)), withMaterials && board(txLipIn));
    // side lips: the same depth and taper on both sides
    add(sheet([P(xL, yF, T), P(xL, yH, T), P(xL, yH, -LH), P(xL, yF, -LP)], V3(-1, 0, 0)), withMaterials && board(txLipSide));
    add(sheet([P(xL + T, yH, 0), P(xL + T, yF + T, 0), P(xL + T, yF + T, -LP), P(xL + T, yH, -LH)], V3(1, 0, 0), 1, 8, (u, v) => fold(1 - v)), withMaterials && board(txLipIn));
    add(sheet([P(xR, yH, T), P(xR, yF, T), P(xR, yF, -LP), P(xR, yH, -LH)], V3(1, 0, 0)), withMaterials && board(txLipSide));
    add(sheet([P(xR - T, yF + T, 0), P(xR - T, yH, 0), P(xR - T, yH, -LH), P(xR - T, yF + T, -LP)], V3(-1, 0, 0), 1, 8, (u, v) => fold(1 - v)), withMaterials && board(txLipIn));
    // cut edges: visible thickness along every free edge
    add(sheet([P(xL, yF, -LP), P(xR, yF, -LP), P(xR, yF + T, -LP), P(xL, yF + T, -LP)], V3(0, 0, -1)), withMaterials && matEdge);
    add(sheet([P(xL, yF, -LP), P(xL, yH, -LH), P(xL + T, yH, -LH), P(xL + T, yF + T, -LP)], V3(0, 0, -1)), withMaterials && matEdge);
    add(sheet([P(xR - T, yF + T, -LP), P(xR - T, yH, -LH), P(xR, yH, -LH), P(xR, yF, -LP)], V3(0, 0, -1)), withMaterials && matEdge);
    add(sheet([P(xL, yH, T), P(xL + T, yH, T), P(xL + T, yH, -LH), P(xL, yH, -LH)], V3(0, 1, 0)), withMaterials && matEdge);
    add(sheet([P(xR - T, yH, T), P(xR, yH, T), P(xR, yH, -LH), P(xR - T, yH, -LH)], V3(0, 1, 0)), withMaterials && matEdge);
    return parts;
  }

  // lid layer: its own canvas inside the lid element, so the page keeps putting an open lid behind the box
  const lidEl = hb.el.querySelector('[data-lid]');
  const lidCanvas = document.createElement('canvas');
  lidCanvas.className = 'hb-lid3d';
  lidCanvas.setAttribute('aria-hidden', 'true');
  const lidRenderer = new THREE.WebGLRenderer({ canvas: lidCanvas, alpha: true, antialias: true });
  lidRenderer.setClearColor(0, 0);
  lidRenderer.outputColorSpace = THREE.SRGBColorSpace;
  lidRenderer.shadowMap.enabled = true;
  lidRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const lidScene = new THREE.Scene();
  const lidCam = photoCamera();
  const lidKey = new THREE.DirectionalLight(0xfff6ee, 2.15);
  lidKey.target.position.set(W / 2, 0.6, 0.2);
  lidKey.position.copy(lidKey.target.position).addScaledVector(toLight, 4);
  lidKey.castShadow = true;
  lidKey.shadow.mapSize.set(1024, 1024);
  Object.assign(lidKey.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 1, far: 8 });
  lidKey.shadow.bias = -0.0006; lidKey.shadow.normalBias = 0.003; lidKey.shadow.radius = 3;
  lidScene.add(lidKey, lidKey.target, new THREE.HemisphereLight(0xfff8f4, 0xf6ddd4, 1.55));
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 1, 0);
  buildLid(true).forEach(([g, m]) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true; lidPivot.add(mesh); });
  // the rounded fold where the lid meets the back wall
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(T * 0.62, T * 0.62, xR - xL, 14, 1, false), new THREE.MeshStandardMaterial({ color: 0xf6a7c4, roughness: 0.85 }));
  hinge.rotation.z = Math.PI / 2; hinge.position.set(W / 2, 1 - T * 0.15, T * 0.45); hinge.castShadow = true;
  lidScene.add(lidPivot, hinge);
  // the lid's shadow on the box walls below it, and a soft contact line right under the lip
  const wallShade = new THREE.ShadowMaterial({ color: 0x5a1e30, opacity: 0.28 });
  const wallF = new THREE.Mesh(new THREE.PlaneGeometry(W, BOXH), wallShade); wallF.rotation.x = Math.PI / 2; wallF.position.set(W / 2, -0.0008, -BOXH / 2); wallF.receiveShadow = true;
  const wallR = new THREE.Mesh(new THREE.PlaneGeometry(BOXH, 1), wallShade); wallR.rotation.y = Math.PI / 2; wallR.position.set(W + 0.0008, 0.5, -BOXH / 2); wallR.receiveShadow = true;
  lidScene.add(wallF, wallR);
  const contactTex = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64;
    const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(70,18,36,0.55)'); gr.addColorStop(0.35, 'rgba(70,18,36,0.18)'); gr.addColorStop(1, 'rgba(70,18,36,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const contactMat = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false });
  const cF = new THREE.Mesh(sheet([V3(0, -0.0012, -LP), V3(W, -0.0012, -LP), V3(W, -0.0012, -LP - 0.045), V3(0, -0.0012, -LP - 0.045)], V3(0, -1, 0)), contactMat);
  const cR = new THREE.Mesh(sheet([V3(W + 0.0012, 1, -LH), V3(W + 0.0012, 0, -LP), V3(W + 0.0012, 0, -LP - 0.045), V3(W + 0.0012, 1, -LH - 0.04)], V3(1, 0, 0)), contactMat);
  lidScene.add(cF, cR);

  let lidDeg = hb.current();
  function drawLid(deg) {
    if (deg !== undefined) lidDeg = deg;
    lidPivot.rotation.x = -lidDeg * Math.PI / 180;
    contactMat.opacity = clamp(1 - lidDeg / 6, 0, 1);
    lidRenderer.render(lidScene, lidCam);
  }
  function layoutLid() {
    const sr = hb.stage.getBoundingClientRect();
    const cr = lidCanvas.getBoundingClientRect();
    if (!sr.width || !cr.width) return;
    lidRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    lidRenderer.setSize(Math.round(cr.width), Math.round(cr.height), false);
    fitCamera(lidCam, cr, sr);
  }
  // the 3D lid is the only lid anyone sees: the page keeps the box hidden until it is drawn
  lidEl.appendChild(lidCanvas);
  layoutLid();
  hb.useLid(drawLid);
  const gltf = await gltfP;

  // ================================================================================================================
  // DONUT + MASCOT layer
  // ================================================================================================================
  const canvas = document.createElement('canvas');
  canvas.className = 'hb-drop';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = photoCamera();
  const camPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

  const key = new THREE.DirectionalLight(0xfff4ea, 1.75);
  const keyDir = V3(-0.22, -0.34, 0.91).normalize();      // fairly overhead, so shadows sit under things
  key.target.position.set(1.3, 0.3, -0.25);
  key.position.copy(key.target.position).addScaledVector(keyDir, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 1, far: 10 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.004;
  const fill = new THREE.DirectionalLight(0xfff1e6, 0.6);  // from the camera side, so the underside of the donut reads
  fill.position.copy(camPos); fill.target.position.set(1.4, 0.2, -0.1);
  scene.add(key, key.target, fill, fill.target, new THREE.HemisphereLight(0xfff6f0, 0xf6d2bc, 0.9));

  // stand-ins for the photo's box and the lid: hide what is behind them and catch shadows
  const hide = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
  const shade = new THREE.ShadowMaterial({ color: 0x4a2229, opacity: 0.32, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(W, 1, BOXH), hide);
  base.position.set(W / 2, 0.5, -BOXH / 2); base.renderOrder = -2;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), shade); ground.position.set(1.5, 0.5, -BOXH); ground.receiveShadow = true; ground.renderOrder = 1;
  const shadeWall = shade.clone(); shadeWall.opacity = 0.24;
  const sWallR = new THREE.Mesh(new THREE.PlaneGeometry(BOXH, 1), shadeWall); sWallR.rotation.y = Math.PI / 2; sWallR.position.set(W + 0.0005, 0.5, -BOXH / 2); sWallR.receiveShadow = true;
  const sWallF = new THREE.Mesh(new THREE.PlaneGeometry(W, BOXH), shadeWall); sWallF.rotation.x = Math.PI / 2; sWallF.position.set(W / 2, -0.0005, -BOXH / 2); sWallF.receiveShadow = true;
  scene.add(base, ground, sWallR, sWallF);
  const lidProxy = new THREE.Group(); lidProxy.position.set(0, 1, 0);
  buildLid(false).forEach(([g]) => { const m = new THREE.Mesh(g, hide); m.renderOrder = -2; lidProxy.add(m); });
  const shadeLid = shade.clone();
  const lidTop = new THREE.Mesh(sheet([V3(xL, yF - 1, T), V3(xR, yF - 1, T), V3(xR, 0, T), V3(xL, 0, T)], V3(0, 0, 1)), shadeLid);
  lidTop.receiveShadow = true; lidTop.renderOrder = 1; lidProxy.add(lidTop);
  scene.add(lidProxy);

  // soft contact shadows (a shadow map alone looks thin right where things touch the ground)
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(60,24,30,0.8)'); gr.addColorStop(0.5, 'rgba(60,24,30,0.4)'); gr.addColorStop(1, 'rgba(60,24,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  function blob(size) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0 }));
    m.scale.set(size, size, 1); m.renderOrder = 2; scene.add(m); return m;
  }

  // ---------------- the donut ----------------
  const SIZE = 0.175;                                  // outer radius in box units (a shade under the donuts in the box)
  const donut = new THREE.Group();
  const model = gltf.scene;
  model.rotation.x = Math.PI / 2;                      // glTF is Y-up; here the donut's axis is local z
  model.scale.setScalar(SIZE);
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    m.material.envMapIntensity = 0.35;
    if ('specularIntensity' in m.material) m.material.specularIntensity = 0.55;   // satin chocolate, not lacquer
  });
  const mb = new THREE.Box3().setFromObject(model);
  const REST = -mb.min.z;                              // height of the donut's origin above whatever it rests on
  donut.add(model);
  scene.add(donut);
  // contact shadow: a soft ring right under the donut, darkest under the dough, lighter through the hole
  const ringTex = (() => {
    const n = 256, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'), img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2) * 1.32;   // 1 = the donut's outer edge
      const body = 1 - sstep(0.78, 1.28, r);                                  // soft fall-off past the edge
      const hole = 0.42 + 0.58 * sstep(0.08, 0.42, r);                         // the hole lets some light through
      const a = 0.62 * body * hole;
      const i = (y * n + x) * 4; img.data[i] = 58; img.data[i + 1] = 32; img.data[i + 2] = 34; img.data[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  })();
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, opacity: 0 }));
  contact.renderOrder = 2; scene.add(contact);
  ground.visible = false;                              // no cast shadow on the open ground: only the contact shadow

  // ---------------- the mascot: a small white cartoon kid, drawn flat in 2D ----------------
  // Drawn on its own canvas above the 3D layer, in screen space at one fixed scale (the scale of the ground where
  // the donut lands), so it runs in a dead straight horizontal line and never grows, shrinks or stretches. Wherever
  // the donut is in front of it, the donut's outline is cut out of the body, and the hands are drawn on top.
  const figCanvas = document.createElement('canvas');
  figCanvas.className = 'hb-fig';
  figCanvas.setAttribute('aria-hidden', 'true');
  const fctx = figCanvas.getContext('2d');
  // proportions in box units (scaled to screen once): big round head, rounded body, very short legs, charcoal shoes
  const MS = {
    headR: 0.155, hip: 0.138, hipW: 0.042, thigh: 0.047, shin: 0.045, legW: 0.062, shoeL: 0.1, shoeH: 0.054,
    shoulderUp: 0.165, shoulderW: 0.1, upper: 0.1, fore: 0.096, armW: 0.05, handR: 0.037, line: 0.009
  };
  const FIG_H = 0.6;
  const INK = '#2f2f33', WHITE = '#fbfaf7', SHOE = '#3b3b40', SHOE_INK = '#232326';
  const camR = V3(R[0][0], R[0][1], 0).normalize();     // screen-right, along the ground
  const camF = V3(R[2][0], R[2][1], 0).normalize();     // the camera's view direction, along the ground
  const camBack = camF.clone().negate();
  const Z = V3(0, 0, 1);
  let figPose = null;

  // two-bone IK in 2D (screen px): returns the elbow/knee; `side` picks which way it bends
  function ik2(S, Tg, L1, L2, side) {
    let dx = Tg[0] - S[0], dy = Tg[1] - S[1];
    const d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3), dd = Math.hypot(dx, dy) || 1;
    dx /= dd; dy /= dd;
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    return [[S[0] + dx * a - dy * h * side, S[1] + dy * a + dx * h * side], [S[0] + dx * d, S[1] + dy * d]];
  }
  const prof = (v) => Math.sqrt(Math.max(0, 1 - ((v - 0.095) / 0.14) ** 2));
  const belly = (v) => Math.exp(-(((v - 0.04) / 0.07) ** 2));
  function drawFigure() {
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, figCanvas.width, figCanvas.height);
    const q = figPose;
    if (!q || !q.visible || !CR) return;
    const dpr = figCanvas.width / CR.width;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = SM, f = Math.cos(q.theta), d = Math.sin(q.theta), af = Math.abs(f), sg = f >= 0 ? 1 : -1;
    const ow = Math.max(1.2, MS.line * S);
    const X0 = q.x, Y0 = q.y;                                   // ground point under the body, canvas px
    // body frame: origin at the hip joint, x across the screen, y up; the lean tips it toward where it faces
    const H = [X0, Y0 - q.hip * S];
    const lean = q.lean * sg * Math.sqrt(af), cl = Math.cos(lean), sl = Math.sin(lean);
    const fy = 1 - (1 - Math.cos(q.lean)) * (1 - af) * 0.6;   // seen from the front, a lean reads as a slight squash
    const B = (x, y) => [H[0] + (x * cl + y * sl) * S, H[1] - (-x * sl + y * cl) * fy * S];
    const loc = (a, b) => a * f + b * d;                        // body-local forward/left -> across the screen
    const path = (pts, close) => { fctx.beginPath(); pts.forEach((p, i) => (i ? fctx.lineTo(p[0], p[1]) : fctx.moveTo(p[0], p[1]))); if (close) fctx.closePath(); };
    const limb = (pts, w) => {
      fctx.lineCap = 'round'; fctx.lineJoin = 'round';
      path(pts); fctx.strokeStyle = INK; fctx.lineWidth = w * S + 2 * ow; fctx.stroke();
      path(pts); fctx.strokeStyle = WHITE; fctx.lineWidth = w * S; fctx.stroke();
    };
    const blobFill = (cx, cy, r) => { fctx.beginPath(); fctx.arc(cx, cy, r, 0, Math.PI * 2); fctx.fillStyle = WHITE; fctx.fill(); fctx.lineWidth = ow; fctx.strokeStyle = INK; fctx.stroke(); };
    // soft shadow on the ground under it
    const sh = fctx.createRadialGradient(X0, Y0, 0, X0, Y0, 0.19 * S);
    sh.addColorStop(0, 'rgba(70,40,42,0.24)'); sh.addColorStop(1, 'rgba(70,40,42,0)');
    fctx.save(); fctx.translate(X0, Y0); fctx.scale(1, 0.24); fctx.translate(-X0, -Y0);
    fctx.fillStyle = sh; fctx.beginPath(); fctx.arc(X0, Y0, 0.19 * S, 0, Math.PI * 2); fctx.fill(); fctx.restore();
    // legs and shoes
    const leg = (i) => {
      const side = i ? -1 : 1, ft = q.feet[i];
      const hip = [H[0] + loc(0, side * MS.hipW) * S, H[1] + 0.008 * S];
      const ankle = [X0 + loc(ft.a, side * MS.hipW) * S, Y0 - (ft.c + MS.shoeH * 0.8) * S];
      const [knee, end] = ik2(hip, ankle, MS.thigh * S, MS.shin * S, -sg);       // knees point forward
      return { pts: [hip, knee, end], end, pitch: ft.pitch || 0 };
    };
    const shoe = (end, pitch) => {
      const L = MS.shoeL * (0.62 + 0.38 * af) * S, Hh = MS.shoeH * S;
      fctx.save(); fctx.translate(end[0], end[1] + Hh * 0.3); fctx.rotate(-pitch * sg);
      const cx = sg * L * 0.18 * af;
      fctx.beginPath(); fctx.ellipse(cx, 0, L / 2, Hh / 2, 0, 0, Math.PI * 2);
      fctx.fillStyle = SHOE; fctx.fill(); fctx.lineWidth = ow; fctx.strokeStyle = SHOE_INK; fctx.stroke();
      fctx.restore();
    };
    // arms: shoulders ride on the body; hands go to their targets (swinging, reaching or holding)
    const arm = (i) => {
      const side = i ? -1 : 1;
      const s0 = B(loc(-0.004, side * MS.shoulderW), MS.shoulderUp);
      const tg = q.hands[i];
      // its arms are short, so raised overhead they stretch a little (cartoon style) to keep hold of the donut
      const k = Math.max(1, Math.hypot(tg[0] - s0[0], tg[1] - s0[1]) / ((MS.upper + MS.fore) * 0.97 * S));
      const [el, hand] = ik2(s0, tg, MS.upper * S * k, MS.fore * S * k, sg);     // elbows point back
      return { pts: [s0, el, hand], hand };
    };
    // which side is further from the viewer (its left side faces away when it faces right)
    const farI = f > 0 ? 0 : 1, nearI = 1 - farI;
    const legs = [leg(0), leg(1)], arms = [arm(0), arm(1)];
    const drawLeg = (i) => { limb(legs[i].pts, MS.legW); shoe(legs[i].end, legs[i].pitch); };
    // arm + mitten hand as one shape: an outline pass, then a fill pass, so the hand joins the arm seamlessly
    const mitten = (a, grow) => {
      const [e, h] = [a.pts[1], a.hand], ang = Math.atan2(h[1] - e[1], h[0] - e[0]);
      const r = MS.handR * S, cx = h[0] + Math.cos(ang) * r * 0.35, cy = h[1] + Math.sin(ang) * r * 0.35;
      fctx.beginPath(); fctx.ellipse(cx, cy, r * 1.22 + grow, r * 0.98 + grow, ang, 0, Math.PI * 2); fctx.fill();
      // a little thumb on the upper side
      const ta = ang - sg * Math.PI / 2, tx = cx + Math.cos(ta) * r * 0.75 - Math.cos(ang) * r * 0.25, ty = cy + Math.sin(ta) * r * 0.75 - Math.sin(ang) * r * 0.25;
      fctx.beginPath(); fctx.ellipse(tx, ty, r * 0.5 + grow, r * 0.42 + grow, ang, 0, Math.PI * 2); fctx.fill();
    };
    const drawArm = (i) => {
      const a = arms[i];
      fctx.lineCap = 'round'; fctx.lineJoin = 'round';
      path(a.pts); fctx.strokeStyle = INK; fctx.lineWidth = MS.armW * S + 2 * ow; fctx.stroke();
      fctx.fillStyle = INK; mitten(a, ow);
      path(a.pts); fctx.strokeStyle = WHITE; fctx.lineWidth = MS.armW * S; fctx.stroke();
      fctx.fillStyle = WHITE; mitten(a, 0);
    };
    drawLeg(farI);
    if (!q.holding) drawArm(farI);
    // body: rounded, a little fuller low in front (the belly), seen at whatever angle it is turned to
    const front = [], back = [];
    for (let k = 0; k <= 28; k++) {
      const v = -0.045 + 0.28 * k / 28, p = prof(v);
      const Af = (0.122 + 0.026 * belly(v)) * p, Ab = 0.112 * p, Bw = 0.126 * p;
      const e1 = Math.sqrt(Af * Af * f * f + Bw * Bw * d * d), e2 = Math.sqrt(Ab * Ab * f * f + Bw * Bw * d * d);
      front.push(B(sg * e1, v)); back.push(B(-sg * e2, v));
    }
    path(front.concat(back.reverse()), true);
    fctx.fillStyle = WHITE; fctx.fill(); fctx.lineWidth = ow; fctx.strokeStyle = INK; fctx.stroke();
    // overhead, both arms come up from the shoulders behind its head (the head hides where they cross it)
    if (q.holding && q.overhead) { drawArm(farI); drawArm(nearI); }
    // head: big, round and featureless, sitting just forward of the body
    const hc = B(sg * 0.012 * af, 0.215 + MS.headR * 0.78);
    blobFill(hc[0], hc[1], MS.headR * S);
    drawLeg(nearI);
    // holding the donut: arms and mitten hands go behind it, so its edge overlaps the hands on either side
    if (q.holding && !q.overhead) { drawArm(farI); drawArm(nearI); }
    // the donut in front of it (on the ground before it, or held up): cut its outline out of the body
    if (donut.visible) {
      donut.updateMatrixWorld();
      fctx.globalCompositeOperation = 'destination-out';
      fctx.fillStyle = '#000';
      for (const hz of [-REST * 0.85, 0, REST * 0.85]) {
        const pts = [];
        for (let k = 0; k < 40; k++) {
          const a = k / 40 * Math.PI * 2;
          const w = new THREE.Vector3(Math.cos(a) * SIZE * 0.99, Math.sin(a) * SIZE * 0.99, hz).applyMatrix4(donut.matrixWorld);
          pts.push(toCanvas([w.x, w.y, w.z]));
        }
        path(pts, true); fctx.fill();
      }
      fctx.globalCompositeOperation = 'source-over';
    }
    if (!q.holding) drawArm(nearI);
  }

  // ================================================================================================================
  // LAYOUT: where the canvas goes, and where on the ground there is room for the landing
  // ================================================================================================================
  const texts = Array.from(hero.querySelectorAll('.hero-hello, .hero h1, .hero-lede, .hero-ctas, .hero-address'));
  let CR = null, SR = null, planned = false;
  function layout() {
    const hr = hero.getBoundingClientRect(), sr = hb.stage.getBoundingClientRect();
    if (!sr.width) return false;
    const k = sr.width / IMG_W;
    const left = Math.max(hr.left, sr.left - 0.02 * sr.width), right = hr.right;
    let top = hr.top, bottom = hr.bottom;
    texts.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.height || r.right < left || r.left > right) return;
      if (r.bottom <= sr.top + sr.height * 0.4) top = Math.max(top, r.bottom + 6);     // headline above (phones)
      else if (r.top >= sr.bottom - 2) bottom = Math.min(bottom, r.top - 4);         // text below (phones)
    });
    const fade = Math.round(clamp(sr.width * 0.12, 30, 80));
    CR = { left, top, width: Math.round(right - left), height: Math.round(bottom - top), fade, k };
    SR = sr;
    canvas.style.left = (left - hr.left) + 'px'; canvas.style.top = (top - hr.top) + 'px';
    canvas.style.width = CR.width + 'px'; canvas.style.height = CR.height + 'px';
    canvas.style.setProperty('--fade', fade + 'px');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(CR.width, CR.height, false);
    Object.assign(figCanvas.style, { left: canvas.style.left, top: canvas.style.top, width: canvas.style.width, height: canvas.style.height });
    const fd = Math.min(window.devicePixelRatio || 1, 2);
    figCanvas.width = Math.round(CR.width * fd); figCanvas.height = Math.round(CR.height * fd);
    fitCamera(camera, CR, sr);
    layoutLid();
    if (planned) placeMascot();
    return true;
  }
  // box space -> canvas pixels, and back (a canvas point at a given camera depth -> box space)
  function toCanvas(X) {
    const p = project(X);
    return [(p[0]) * CR.k + (SR.left - CR.left), (p[1]) * CR.k + (SR.top - CR.top)];
  }
  function fromCanvas(cx, cy, depth) {
    const px = (cx - (SR.left - CR.left)) / CR.k, py = (cy - (SR.top - CR.top)) / CR.k;
    const c = [(px - CAM.c[0]) / CAM.f * depth - t[0], (py - CAM.c[1]) / CAM.f * depth - t[1], depth - t[2]];
    return V3(R[0][0] * c[0] + R[1][0] * c[1] + R[2][0] * c[2], R[0][1] * c[0] + R[1][1] * c[1] + R[2][1] * c[2], R[0][2] * c[0] + R[1][2] * c[1] + R[2][2] * c[2]);
  }
  const scaleAt = (x, y) => CAM.f / project([x, y, -BOXH])[2] * CR.k;    // canvas px per box unit on the ground there
  // screen bounds of a donut lying at ground point (x, y)
  function donutBox(x, y) {
    let b = [1e9, 1e9, -1e9, -1e9];
    for (let a = 0; a < 8; a++) for (const z of [-BOXH, -BOXH + 0.16]) {
      const s = toCanvas([x + Math.cos(a * Math.PI / 4) * SIZE, y + Math.sin(a * Math.PI / 4) * SIZE, z]);
      b = [Math.min(b[0], s[0]), Math.min(b[1], s[1]), Math.max(b[2], s[0]), Math.max(b[3], s[1])];
    }
    return b;
  }
  const STOP_GAP = 0.24;                                // the mascot stops this far (box units) past the donut's edge
  // the mascot's box when standing at the donut, on screen (it is drawn at the landing spot's scale)
  function mascotBox(x, y) {
    const g = toCanvas([x, y, -BOXH]), S = scaleAt(x, y), xs = g[0] + (SIZE + STOP_GAP) * S;
    return [xs - 0.3 * S, g[1] - (FIG_H + 0.06) * S, xs + 0.24 * S, g[1] + 0.05 * S];
  }
  function choosePlan() {
    // right of the box first (well clear of it), nearer the box only as far as still leaves a gap, then round the front
    const pts = [];
    for (let x = 2.08; x >= 1.84; x -= 0.02) pts.push([x, 0.5]);
    const pathPts = [[1.95, 0.05], [1.85, -0.15], [1.75, -0.28], [1.65, -0.38], [1.5, -0.48], [1.35, -0.55], [1.22, -0.58]];
    for (let i = 0; i < pathPts.length - 1; i++) for (let s = 0; s < 1; s += 0.125) pts.push([lerp(pathPts[i][0], pathPts[i + 1][0], s), lerp(pathPts[i][1], pathPts[i + 1][1], s)]);
    pts.push(pathPts[pathPts.length - 1]);
    const m = 8;
    let best = null;
    for (const [lx, ly] of pts) {
      const bd = donutBox(lx, ly), bf = mascotBox(lx, ly);
      const b = [Math.min(bd[0], bf[0]), Math.min(bd[1], bf[1]), Math.max(bd[2], bf[2]), Math.max(bd[3], bf[3])];
      const over = Math.max(0, m - b[0]) + Math.max(0, b[2] - (CR.width - m)) + Math.max(0, CR.fade + 4 - b[1]) + Math.max(0, b[3] - (CR.height - m));
      if (!best || over < best.over - 0.5) best = { lx, ly, over };
      if (over === 0) { best = { lx, ly, over }; break; }
    }
    return best;
  }

  hero.appendChild(canvas);
  hero.appendChild(figCanvas);
  await hb.revealed;
  const ours = hb.claim();
  await inView(hb.el);
  if (!layout()) throw new Error('hero box not laid out');
  hb.el.dataset.drop = 'playing';

  // ================================================================================================================
  // CHOREOGRAPHY
  // ================================================================================================================
  const plan = choosePlan();
  const Lx = plan.lx, Ly = plan.ly;                                     // where the donut lands

  // timing (seconds)
  const G = 12;                                       // gravity, box units/s² (a touch slower than life, for clarity)
  const landRight = Ly > 0.2;
  // where it hits the lid: its right side, near the back if it then flies off to the right (where the rising lid is
  // lowest), near the front if it lands in front of the box (the lid's front edge swings up and back, away from it)
  const P = { x: clamp(Lx - 0.36, 1.0, 1.3), y: landRight ? 0.62 : 0.15 };
  const zHit = T + REST;
  // start just above where the donut comes into view
  let zStart = zHit + 0.5;
  while (zStart < 6 && toCanvas([P.x, P.y, zStart])[1] + (SIZE * 1.15 * CAM.f / project([P.x, P.y, zStart])[2]) * CR.k > -2) zStart += 0.05;
  const tHold = 0.45;
  const tFall = Math.sqrt(2 * (zStart - zHit) / G);
  const tHit = tHold + tFall;
  const FALL_DRIFT = 0.1;                              // it is already drifting right as it falls
  const tiltAxis = V3(0.8, -0.6, 0).normalize(), TILT0 = 0.62, TILT1 = 0.12;   // tilted at first, nearly level on impact
  const qTilt = (a) => new THREE.Quaternion().setFromAxisAngle(tiltAxis, a);
  const qSpin = (a) => new THREE.Quaternion().setFromAxisAngle(Z, a);
  const qFlip = (a) => new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), a);   // top rolls over toward +x (the right)
  // after the hit: one ballistic arc (it never hovers) with one flip, then it touches down and slides to a stop
  const vUp = 3.05;
  const zLand = -BOXH + REST;
  const tFly = (vUp + Math.sqrt(vUp * vUp + 2 * G * (zHit - zLand))) / G;
  const tLeave = tHit + 0.035;
  const tLand = tLeave + tFly;
  const KICK = 0.4;                                    // the slide across the lid during the contact itself
  const dir = V3(Lx - P.x, Ly - P.y, 0); const span = dir.length(); dir.normalize();
  let slide = 0.09, vh = (span - slide) / tFly, tSlide = 0.2;
  for (let i = 0; i < 3; i++) { tSlide = clamp(2 * slide / Math.max(vh, 0.2), 0.12, 0.3); slide = Math.min(0.14, vh * tSlide / 2); vh = (span - slide) / tFly; }
  const TD = V3(Lx - dir.x * slide, Ly - dir.y * slide, zLand);   // touchdown point
  const tRest = tLand + tSlide;
  // the lid: dips under the hit, then swings open with real momentum (gravity about the hinge, damping, a stop at 135°)
  const lidTrack = (() => {
    const out = [], dt = 1 / 240, open = LID.open * Math.PI / 180;
    let th = 0, w = 0, tt = 0, popped = false;
    const gl = 3 * G / (2 * L) * 0.5;                    // gravity about the hinge (a light board, so it swings slowly)
    for (let i = 0; i < 240 * 3; i++) {
      tt = i * dt;
      if (tt < 0.07) { th = -0.05 * Math.sin(Math.PI * tt / 0.07); }        // the board gives a little under the hit
      else {
        if (!popped) { popped = true; th = 0; w = 4.75; }                   // ...and springs back with the energy of the hit
        w += (-gl * Math.cos(th) - 0.18 * w) * dt;
        th += w * dt;
        if (th > open) { th = open; if (w > 0) w = -w * 0.22; }
        if (th < 0) { th = 0; w = Math.abs(w) * 0.2; }
      }
      out.push(th * 180 / Math.PI);
    }
    let rest = out.length - 1;
    for (let i = 60; i < out.length; i++) if (Math.abs(out[i] - LID.open) < 0.05 && out.slice(i, i + 24).every((dd) => Math.abs(dd - LID.open) < 0.05)) { rest = i; break; }
    return { at: (s) => (s <= 0 ? 0 : out[Math.min(out.length - 1, Math.floor(s * 240))]), rest: rest / 240 };
  })();
  const tLidRest = tHit + lidTrack.rest;

  // ---------------- mascot: a straight, level run in from the right, pick up, turn, run off right ----------------
  // all in screen space at one scale, so it never changes size; positions along the run in box units
  let SM = 0, GX = 0, GY = 0, XS = 0, XOFF = 0;
  function placeMascot() {
    const g = toCanvas([Lx, Ly, -BOXH]);
    SM = scaleAt(Lx, Ly); GX = g[0]; GY = g[1];
    XS = GX + (SIZE + STOP_GAP) * SM;                  // where it stops, just past the donut
    XOFF = CR.width + 0.35 * SM;                       // completely off the right edge
  }
  placeMascot(); planned = true;
  const VRUN = 1.6, STRIDE = 0.46, STANCE = 0.34, REACH = STRIDE * STANCE / 2, DEC = 0.2;
  const dRun = Math.max(0.5, (XOFF - XS) / SM);       // run length in box units
  const tRunIn = tRest + 0.15;
  const tCruise = Math.max(0, (dRun - DEC) / VRUN), tDec = 2 * DEC / VRUN;
  const tStop = tRunIn + tCruise + tDec;
  const tPick = 1.4, tTurn = 0.45;
  const tTurnAt = tStop + tPick, tOut = tTurnAt + tTurn;
  const ACC = 0.12, tAcc = ACC / (VRUN / 2);
  const tEnd = Math.max(tLidRest, tOut + tAcc + (dRun - ACC) / VRUN + 0.1);
  function runIn(tt) {                                 // distance covered since the run-in started, and speed (0..1)
    const s = tt - tRunIn;
    if (s <= 0) return [0, 1];
    if (s < tCruise) return [VRUN * s, 1];
    const u = Math.min(s - tCruise, tDec);
    return [VRUN * tCruise + VRUN * u - (VRUN / tDec) * u * u / 2, 1 - u / tDec];
  }
  function runOut(tt) {
    const s = tt - tOut;
    if (s <= 0) return [0, 0];
    if (s < tAcc) return [(VRUN / tAcc) * s * s / 2, s / tAcc];
    return [ACC + VRUN * (s - tAcc), 1];
  }
  // a running gait with a short flight phase: each foot is planted (it never slides) while the body passes over it
  function gait(pathFn, tA, tB) {
    const T0 = [], Pp = [];
    for (let tt = tA - 0.3; tt <= tB + 0.3; tt += 1 / 240) { T0.push(tt); Pp.push(pathFn(tt)[0] / STRIDE); }
    const tAt = (ph) => {
      let lo = 0, hi = Pp.length - 1;
      if (ph <= Pp[0]) return T0[0];
      if (ph >= Pp[hi]) return T0[hi];
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Pp[mid] < ph) lo = mid; else hi = mid; }
      return T0[hi];
    };
    const plant = (ph) => { const tt = tAt(ph), [p, v] = pathFn(tt); return p + REACH * v; };
    return (tt, i) => {
      const [p, v] = pathFn(tt), off = i ? 0.5 : 0, q = p / STRIDE + off, k = Math.floor(q), fr = q - k;
      if (fr < STANCE) return { a: plant(k - off) - p, c: 0, pitch: 0 };
      const s = (fr - STANCE) / (1 - STANCE), e = smoother(s);
      const a0 = plant(k - off), a1 = plant(k + 1 - off);
      return { a: lerp(a0, a1, e) - p, c: Math.sin(Math.PI * s) * 0.06 * (0.4 + 0.6 * v), pitch: Math.sin(Math.PI * s) * 0.4 * v };
    };
  }
  const gaitIn = gait(runIn, tRunIn, tStop), gaitOut = gait(runOut, tOut, tEnd);
  const stand = (i) => ({ a: 0.005, c: 0, pitch: 0 });

  // donut poses
  const groundQuat = new THREE.Quaternion();
  const groundC = V3(Lx, Ly, zLand);
  const carryQuat = (() => {                          // held upright in front of it, its face turned to the viewer
    const n = camBack.clone().addScaledVector(Z, 0.5).normalize(), x = camR.clone(), y = n.clone().cross(x).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  })();
  let carryDepth = 0, carryRV = SIZE;
  function figureAt(tt, reduced) {
    // where it is (canvas px), which way it faces (theta: pi = left, pi/2 = the viewer, 0 = right) and how fast
    let x, theta, spd, feet, path = 0;
    if (reduced) { x = XS; theta = Math.PI / 2 - 0.5; spd = 0; feet = [stand(0), stand(1)]; }
    else if (tt < tStop) {
      const [p, v] = runIn(tt); x = XS + (dRun - p) * SM; theta = Math.PI; spd = v; path = p;
      const w = sstep(tStop - 0.13, tStop, tt);       // settle onto both feet as it pulls up
      feet = [0, 1].map((i) => { const g = gaitIn(tt, i); return { a: lerp(g.a, 0.005, w), c: lerp(g.c, 0, w), pitch: lerp(g.pitch, 0, w) }; });
    } else if (tt < tTurnAt) { x = XS; theta = Math.PI; spd = 0; feet = [stand(0), stand(1)]; }
    else if (tt < tOut) {
      const u = (tt - tTurnAt) / tTurn;
      x = XS; theta = Math.PI * (1 - smoother(u)); spd = 0;
      feet = [0, 1].map((i) => {                       // two little steps in place as it turns
        const a = i ? 0.52 : 0.08, b = i ? 0.9 : 0.46, s = clamp((u - a) / (b - a), 0, 1);
        return { a: 0.005, c: Math.sin(Math.PI * s) * 0.03, pitch: 0 };
      });
    } else {
      const [p, v] = runOut(tt); x = XS + p * SM; theta = 0; spd = v; path = p;
      const w = 1 - sstep(tOut, tOut + 0.1, tt);
      feet = [0, 1].map((i) => { const g = gaitOut(tt, i); return { a: lerp(g.a, 0.005, w), c: lerp(g.c, 0, w), pitch: lerp(g.pitch, 0, w) }; });
    }
    const ph = path / STRIDE;
    // pickup: bend down, take hold, straighten up with it
    const pk = reduced ? 1 : clamp((tt - tStop) / tPick, 0, 1);
    const bend = reduced ? 0 : sstep(0.03, 0.28, pk) * (1 - sstep(0.43, 0.72, pk));
    const bounce = 0.024 * spd * (1 - Math.cos(Math.PI * 4 * (ph - STANCE / 2))) / 2;
    const q = {
      x, y: GY, theta, hip: MS.hip + bounce - bend * 0.04, lean: 0.34 * spd + bend * 0.85, feet,
      visible: reduced || (tt > tRunIn - 0.01 && tt < tEnd), holding: false
    };
    // the donut: on the ground, or swung up past its chest to over its head and carried there (screen space, one depth)
    const f = Math.cos(theta), sg = f >= 0 ? 1 : -1, af = Math.abs(f);
    if (!carryDepth) {
      carryDepth = project([Lx, Ly, -BOXH + 0.2])[2] - 0.12;
      // how tall the held donut looks on screen (box units), so it can sit just clear of the top of its head
      const c0 = fromCanvas(GX, GY - 0.6 * SM, carryDepth), m = new THREE.Matrix4().compose(c0, carryQuat, V3(1, 1, 1));
      let lo = Infinity, hi = -Infinity;
      for (const hz of [-REST, REST]) for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, w = V3(Math.cos(a) * SIZE, Math.sin(a) * SIZE, hz).applyMatrix4(m), y = toCanvas([w.x, w.y, w.z])[1];
        lo = Math.min(lo, y); hi = Math.max(hi, y);
      }
      carryRV = (hi - lo) / 2 / SM;
    }
    const ln = q.lean * sg * Math.sqrt(af), hy0 = 0.215 + MS.headR * 0.78;
    const headX = x + (sg * 0.012 * af * Math.cos(ln) + hy0 * Math.sin(ln)) * SM;
    const headTop = GY - (q.hip + hy0 * Math.cos(ln) + MS.headR) * SM;
    const chestC = [x + 0.2 * f * SM, GY - (q.hip + 0.14) * SM];
    const overC = [headX + 0.02 * f * SM, headTop - (carryRV + 0.025) * SM];
    let dc, dq, carried = false, liftE = 0;
    if (reduced || tt >= tStop + tPick * 0.9) { liftE = 1; }
    else if (tt >= tStop + tPick * 0.36) liftE = smoother((pk - 0.36) / 0.54);
    if (liftE > 0) {
      // one smooth swing: up from the ground, out in front of its chest, then over its head
      const A = fromCanvas(chestC[0], chestC[1], carryDepth), O = fromCanvas(overC[0], overC[1], carryDepth), e = liftE;
      dc = groundC.clone().multiplyScalar((1 - e) * (1 - e)).addScaledVector(A, 2 * e * (1 - e)).addScaledVector(O, e * e);
      dq = groundQuat.clone().slerp(carryQuat, Math.min(1, e * 1.4)); carried = true;
    } else { dc = groundC.clone(); dq = groundQuat.clone(); }
    // hands: swinging while it runs, reaching to the donut's near rim, then gripping both sides of it
    const cl = Math.cos(q.lean * sg), sl = Math.sin(q.lean * sg);
    const swing = (i) => {
      const s = i ? -1 : 1, a = Math.sin(Math.PI * 2 * ph + (i ? Math.PI : 0)) * spd;
      const bx = s * MS.shoulderW * Math.sin(theta) * SM;
      const shx = x + bx + MS.shoulderUp * sl * SM, shy = GY - (q.hip + MS.shoulderUp * cl) * SM;
      // relaxed arms: nearly straight, hanging from the shoulder and swinging through a gentle arc
      const ang = 0.1 + 0.5 * a, len = (MS.upper + MS.fore) * 0.985 * SM;   // only a soft bend at the elbow
      return [shx + Math.sin(ang) * len * f, shy + Math.cos(ang) * len];
    };
    const g0 = toCanvas([groundC.x, groundC.y, -BOXH + REST]), rx = SIZE * SM;
    const reach = [[g0[0] + rx * 0.98, g0[1] - rx * 0.12], [g0[0] + rx * 0.8, g0[1] + rx * 0.3]];
    const dcs = toCanvas([dc.x, dc.y, dc.z]);
    // both hands on the donut's left and right rims (its left hand on the screen-right rim) while it comes up, then
    // underneath its lower rim on either side once it is over its head, all the way round the turn and the run
    const up = sstep(0.45, 1, liftE), rv = carryRV * SM;
    const hold = [1, -1].map((s) => [dcs[0] + s * rx * lerp(1.02, 0.66, up), dcs[1] + lerp(rx * 0.1, rv * 0.78, up)]);
    const holdW = reduced ? 1 : (tt < tStop ? 0 : sstep(0.04, 0.24, pk));
    q.hands = [0, 1].map((i) => {
      const e = Math.min(1, liftE * 3), g = [lerp(reach[i][0], hold[i][0], e), lerp(reach[i][1], hold[i][1], e)], s = swing(i);
      return [lerp(s[0], g[0], holdW), lerp(s[1], g[1], holdW)];
    });
    q.holding = holdW > 0.5; q.overhead = up > 0.5;
    return { q, dc, dq, carried };
  }

  const ev = { hit: false, open: false };
  // tt drives the drop and the lid; tf drives the mascot (it can be held back until its patch of ground is on screen)
  function frameAt(tt, reduced, tf = tt) {
    // ---- lid
    const lid = reduced ? LID.open : (tt < tHit ? 0 : lidTrack.at(tt - tHit));
    // ---- donut
    const pos = V3(0, 0, 0);
    let quat = new THREE.Quaternion(), squash = 1;
    const p0x = P.x + dir.x * KICK * (tLeave - tHit), p0y = P.y + dir.y * KICK * (tLeave - tHit);
    if (reduced) { /* placed by the mascot below */ }
    else if (tt < tHit) {                                  // falling, tilted, levelling out smoothly as it comes down
      const s = Math.max(0, tt - tHold), u = clamp(s / tFall, 0, 1);
      pos.set(P.x - FALL_DRIFT * (1 - u), P.y, zStart - 0.5 * G * s * s);
      quat = qSpin(0.5 * (1 - u)).multiply(qTilt(lerp(TILT0, TILT1, smoother(u))));
    } else if (tt < tLeave) {                              // the hit: a brief squash as it skids on the lid
      const k = tt - tHit;
      pos.set(P.x + dir.x * KICK * k, P.y + dir.y * KICK * k, zHit);
      quat = qTilt(TILT1);
      squash = 1 - 0.08 * Math.sin(Math.PI * k / (tLeave - tHit));
    } else if (tt < tLand) {                               // one continuous arc: away from the box, one flip, down
      const s = tt - tLeave, u = s / tFly;
      pos.set(lerp(p0x, TD.x, u), lerp(p0y, TD.y, u), zHit + vUp * s - 0.5 * G * s * s);
      quat = qFlip(Math.PI * 2 * (1 - Math.pow(1 - u, 1.6))).multiply(qTilt(TILT1 * (1 - u)));
    } else {                                               // touched down: slides a little, settles, no bounce
      const k = tt - tLand, s = Math.min(k, tSlide), dd = vh * s - 0.5 * (vh / tSlide) * s * s;
      pos.set(TD.x + dir.x * dd, TD.y + dir.y * dd, zLand);
      squash = 1 - 0.05 * Math.exp(-k / 0.05) * (k < 0.12 ? 1 : 0);
      quat = new THREE.Quaternion().setFromAxisAngle(V3(-dir.y, dir.x, 0), 0.06 * Math.exp(-k / 0.12) * Math.sin(k * 24));
    }
    const F2 = figureAt(tf, reduced);
    if (reduced || F2.carried) { donut.position.copy(F2.dc); donut.quaternion.copy(F2.dq); squash = 1; }
    else { donut.position.copy(pos); donut.quaternion.copy(quat); }
    donut.scale.set(1, 1, squash);
    donut.visible = reduced || tf < tEnd - 0.02;
    figPose = F2.q;
    // shadows: the box and lid catch a faint cast shadow while it falls; on the ground, a soft contact shadow
    const zz = donut.position.z, h = Math.max(0, zz - zLand);
    shadeWall.opacity = 0.2 * clamp(1.2 - (zz + BOXH) / 0.55, 0, 1);
    shadeLid.opacity = 0.3 * clamp(1.2 - (zz - T) / 0.5, 0, 1);
    const overGround = !(donut.position.x > 0 && donut.position.x < W && donut.position.y > 0 && donut.position.y < 1);
    const lift = F2.carried ? 1 : clamp(h / 0.35, 0, 1);
    contact.position.set(donut.position.x, donut.position.y, -BOXH + 0.001);
    contact.scale.setScalar(SIZE * 2.64 * (1 + lift * 0.6));
    contact.material.opacity = donut.visible && overGround && !F2.carried ? (1 - lift) * (1 - lift) : 0;
    lidProxy.rotation.x = -lid * Math.PI / 180;
    return lid;
  }

  const draw = () => { renderer.render(scene, camera); drawFigure(); };
  window.addEventListener('resize', () => { if (layout()) { drawLid(); draw(); } });

  const settledStatic = () => { hb.el.dataset.drop = 'done'; };
  if (hb.reduced || !ours) {
    // reduced motion (or the lid already opened on its own): a clean final picture, no motion
    frameAt(0, true); hb.render(LID.open); drawLid(LID.open); draw();
    if (!ours) { canvas.classList.add('is-late'); figCanvas.classList.add('is-late'); }
    settledStatic();
    return;
  }

  // ?dropslow=N plays N times slower and exposes seek(seconds) / frame(seconds) for checking individual moments
  const slow = Math.max(1, +new URLSearchParams(location.search).get('dropslow') || 1);
  let seekTo = null;
  if (slow > 1) window.HomiesDonutDrop = {
    seek: (s) => { seekTo = s; },
    frame: (s) => { seekTo = s; hb.render(frameAt(s, false, s)); draw(); },   // render one moment right now
    times: { tHit, tLand, tRest, tRunIn, tStop, tTurnAt, tOut, tEnd, tLidRest }, plan, layout: CR, scale: () => SM
  };
  // where the mascot will act: if that patch of ground is below the fold (short laptop screens), the donut waits on
  // the ground and the mascot runs in once it scrolls into view
  const area = document.createElement('div');
  area.className = 'hb-scene-area'; area.setAttribute('aria-hidden', 'true');
  (() => {
    const a = donutBox(Lx, Ly), b = mascotBox(Lx, Ly);
    const x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[2], b[2]), y1 = Math.max(a[3], b[3]);
    const offL = parseFloat(canvas.style.left), offT = parseFloat(canvas.style.top);
    Object.assign(area.style, { left: (offL + x0) + 'px', top: (offT + y0) + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
  })();
  hero.appendChild(area);
  let areaSeen = false;
  const areaIO = new IntersectionObserver((es) => { areaSeen = es.some((e) => e.intersectionRatio >= 0.8); }, { threshold: [0, 0.8, 1] });
  areaIO.observe(area);
  let t0 = 0, finished = false, last = 0, hold = 0, running = false;
  function tick(now) {
    if (!t0) t0 = now;
    const raw = seekTo !== null ? seekTo : (now - t0) / 1000 / slow;
    if (seekTo === null && last && !running) {
      if (raw - hold >= tRunIn - 0.02 && !areaSeen) hold += (now - last) / 1000 / slow;
      else if (raw - hold >= tRunIn - 0.02) running = true;
    }
    last = now;
    const tt = raw, tf = seekTo !== null ? seekTo : raw - hold;
    const lid = frameAt(tt, false, tf);
    if (!finished) hb.render(lid); else drawLid(LID.open);
    if (!ev.hit && tt >= tHit) { ev.hit = true; hb.opening(); }
    if (!finished && tt >= tLidRest) { finished = true; hb.finish(); }
    draw();
    if (tf < tEnd || tt < tLidRest || seekTo !== null) requestAnimationFrame(tick);
    else { if (!finished) hb.finish(); frameAt(tEnd + 1, false); draw(); areaIO.disconnect(); area.remove(); settledStatic(); }
  }
  frameAt(0, false); hb.render(0); draw();
  requestAnimationFrame(tick);
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
