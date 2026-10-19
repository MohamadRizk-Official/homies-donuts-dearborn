/* Homie's Donuts — the hero box scene.
 *
 * 1. The box sits closed and still.
 * 2. A chocolate-sprinkle donut (img/hero/sprinkle-donut.glb, built from the product photo by tools/make_donut.py)
 *    falls in from above and hits the lid. The hit flexes the lid down and gives it the momentum that swings it open.
 * 3. The donut makes one smooth flip to the right and drops almost straight down onto the ground, well clear of the box.
 * 4. A gray mascot runs in from the right, bends, picks the donut up, turns round and runs off to the right with it.
 *
 * Everything is drawn with three.js through the camera recovered from the box photo, so it sits in the photo's space.
 * The lid is real 3D cardboard (thickness, folds, hinge, lighting and shadows) drawn in the lid's own layer, so it
 * still slips behind the box once open. The donut and mascot are drawn above the page in the hero; invisible stand-ins
 * for the box and lid hide them where the box is in front and catch their shadows.
 *
 * The mascot is an articulated figure: its legs and arms are solved with two-bone IK every frame, feet are planted
 * on footprints that are laid down along its path (so they never slide), and every pose blends into the next.
 * Plays once per page load. Reduced motion: the box is shown open with the mascot standing beside it holding the donut.
 */
// nothing is downloaded unless this page has the hero box (the menu page shares these scripts)
const hb = window.HomiesHeroBox;
const hero = hb && hb.el.closest('.hero');

function fallback() { if (hb) hb.revealed.then(hb.fallback); }

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
  const [gltf, txPanelIn, txPanelOut, txLipIn, txLipFront, txLipSide] = await Promise.all([
    new GLTFLoader().loadAsync('img/hero/sprinkle-donut.glb?v=1'),
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
  const HALF = (mb.max.z - mb.min.z) / 2;
  donut.add(model);
  scene.add(donut);
  const donutBlob = blob(SIZE * 2.6);

  // ---------------- the mascot: an articulated, featureless gray figure ----------------
  const clay = new THREE.MeshPhysicalMaterial({ color: 0x67676c, roughness: 0.9, metalness: 0, sheen: 0.6, sheenRoughness: 0.75, sheenColor: new THREE.Color(0x9a9aa2) });
  const FS = 0.9;                                       // overall figure scale: ~0.92 tall, under three donuts
  const FIG_H = 1.02 * FS;
  const M = {                                           // proportions (box units)
    hip: 0.42 * FS, hipW: 0.072 * FS, thigh: 0.2 * FS, shin: 0.195 * FS, ankle: 0.045 * FS,
    shoulderUp: 0.31 * FS, shoulderW: 0.145 * FS, upper: 0.165 * FS, fore: 0.15 * FS, neck: 0.47 * FS, headR: 0.135 * FS
  };
  const fig = new THREE.Group();
  const part = (geo) => { const m = new THREE.Mesh(geo, clay); m.castShadow = true; m.receiveShadow = true; fig.add(m); return m; };
  // torso: an egg, a touch wider low down, with a soft belly in front
  const torsoGeo = (() => {
    const g = new THREE.SphereGeometry(1, 48, 32), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      // sphere is Y-up here; map to body axes: forward = +x, left = +z(sphere), up = +y(sphere)
      const up = y, fwd = x, side = -z;            // a proper rotation (keeps the winding, so normals face out)
      const wide = 1 + 0.1 * clamp(-up, 0, 1);
      let f = fwd * 0.125 * FS * wide, s = side * 0.148 * FS * wide, u = up * 0.2 * FS;
      const belly = 0.05 * FS * Math.exp(-((up + 0.3) ** 2) / 0.16 - (side ** 2) / 0.3) * Math.max(0, fwd);
      f += belly;
      p.setXYZ(i, f, s, u);
    }
    // after the remap: x forward, y side, z up
    g.computeVertexNormals(); return g;
  })();
  const torso = part(torsoGeo);
  const head = part(new THREE.SphereGeometry(M.headR, 40, 28));
  const neck = part(new THREE.CylinderGeometry(0.05 * FS, 0.06 * FS, 0.06 * FS, 16));
  const caps = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 14);
  const limb = (r, len) => { const m = part(caps(r, len)); m.userData.len = len; return m; };
  const thighL = limb(0.046 * FS, M.thigh), thighR = limb(0.046 * FS, M.thigh), shinL = limb(0.036 * FS, M.shin), shinR = limb(0.036 * FS, M.shin);
  const upL = limb(0.034 * FS, M.upper), upR = limb(0.034 * FS, M.upper), foreL = limb(0.029 * FS, M.fore), foreR = limb(0.029 * FS, M.fore);
  const footGeo = (() => { const g = new THREE.SphereGeometry(1, 24, 16); g.scale(0.072 * FS, 0.042 * FS, 0.03 * FS); g.translate(0.03 * FS, 0, 0); return g; })();
  const footL = part(footGeo), footR = part(footGeo);
  const handGeo = (() => { const g = new THREE.SphereGeometry(1, 20, 14); g.scale(0.04 * FS, 0.054 * FS, 0.033 * FS); g.translate(0, 0.02 * FS, 0); return g; })();
  const handL = part(handGeo), handR = part(handGeo);
  fig.scale.setScalar(1);
  scene.add(fig);
  const figBlob = blob(0.62 * FS);

  const Y = V3(0, 1, 0), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
  function placeLimb(mesh, a, b) {
    const d = b.clone().sub(a), len = d.length();
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y, d.divideScalar(len || 1));
  }
  // two-bone IK: from root joint S toward target T with a bend hint; returns [middle joint, reached end]
  function ik(S, Tg, L1, L2, hint) {
    const d = Tg.clone().sub(S);
    const len = clamp(d.length(), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
    const n = d.normalize();
    const a = (L1 * L1 - L2 * L2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const m = hint.clone().addScaledVector(n, -hint.dot(n)).normalize();
    return [S.clone().addScaledVector(n, a).addScaledVector(m, h), S.clone().addScaledVector(n, len)];
  }

  /* pose the figure. q: { x, y, heading, hipZ, pitch, lean (sideways), footL/footR: {p: Vector3, yaw, pitch},
     handL/handR: Vector3 targets, visible } */
  function poseFigure(q) {
    fig.visible = q.visible !== false;
    if (!fig.visible) { figBlob.material.opacity = 0; return; }
    const fwd = V3(Math.cos(q.heading), Math.sin(q.heading), 0), left = V3(-Math.sin(q.heading), Math.cos(q.heading), 0), up = V3(0, 0, 1);
    const U = up.clone().multiplyScalar(Math.cos(q.pitch)).addScaledVector(fwd, Math.sin(q.pitch)).addScaledVector(left, Math.sin(q.lean || 0)).normalize();
    const F = fwd.clone().addScaledVector(U, -fwd.dot(U)).normalize();
    const Ls = U.clone().cross(F).normalize();          // body's left
    const pel = V3(q.x, q.y, q.hipZ);
    tmpM.makeBasis(F, Ls, U);
    torso.position.copy(pel).addScaledVector(U, 0.17 * FS); torso.quaternion.setFromRotationMatrix(tmpM);
    const nk = pel.clone().addScaledVector(U, 0.36 * FS);
    neck.position.copy(nk); neck.quaternion.setFromUnitVectors(Y, U);
    head.position.copy(pel).addScaledVector(U, M.neck).addScaledVector(F, (0.015 + (q.nod || 0) * 0.05) * FS);
    // legs
    [[thighL, shinL, footL, q.footL, 1], [thighR, shinR, footR, q.footR, -1]].forEach(([th, sh, ft, f, s]) => {
      const hipJ = pel.clone().addScaledVector(Ls, s * M.hipW).addScaledVector(U, -0.01);
      const ankle = f.p.clone().add(V3(0, 0, M.ankle));
      const hint = fwd.clone().addScaledVector(left, s * 0.12);
      const [knee, end] = ik(hipJ, ankle, M.thigh, M.shin, hint);
      placeLimb(th, hipJ, knee); placeLimb(sh, knee, end);
      ft.position.copy(end).add(V3(0, 0, -M.ankle + 0.03 * FS));
      ft.rotation.set(0, -(f.pitch || 0), f.yaw, 'ZYX');
    });
    // arms
    [[upL, foreL, handL, q.handL, 1], [upR, foreR, handR, q.handR, -1]].forEach(([ua, fa, hd, tg, s]) => {
      const sh = pel.clone().addScaledVector(U, M.shoulderUp).addScaledVector(Ls, s * M.shoulderW).addScaledVector(F, -0.01 * FS);
      const hint = F.clone().multiplyScalar(-0.45).addScaledVector(Ls, s * 0.8).addScaledVector(U, -0.5);
      const [elbow, wrist] = ik(sh, tg, M.upper, M.fore, hint);
      placeLimb(ua, sh, elbow); placeLimb(fa, elbow, wrist);
      hd.position.copy(wrist); hd.quaternion.setFromUnitVectors(Y, wrist.clone().sub(elbow).normalize());
    });
    figBlob.position.set(q.x + 0.02, q.y + 0.02, -BOXH + 0.001);
    figBlob.material.opacity = 0.42;
  }
  // body frame helpers for the choreography
  function frame(q) {
    const fwd = V3(Math.cos(q.heading), Math.sin(q.heading), 0), left = V3(-Math.sin(q.heading), Math.cos(q.heading), 0), up = V3(0, 0, 1);
    const U = up.clone().multiplyScalar(Math.cos(q.pitch)).addScaledVector(fwd, Math.sin(q.pitch)).normalize();
    const F = fwd.clone().addScaledVector(U, -fwd.dot(U)).normalize();
    return { fwd, left, U, F, pel: V3(q.x, q.y, q.hipZ) };
  }

  // ================================================================================================================
  // LAYOUT: where the canvas goes, and where on the ground there is room for the landing
  // ================================================================================================================
  const texts = Array.from(hero.querySelectorAll('.hero-hello, .hero h1, .hero-lede, .hero-ctas, .hero-address'));
  let CR = null, SR = null;
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
    fitCamera(camera, CR, sr);
    layoutLid();
    return true;
  }
  // box space -> canvas pixels
  function toCanvas(X) {
    const p = project(X);
    return [(p[0]) * CR.k + (SR.left - CR.left), (p[1]) * CR.k + (SR.top - CR.top)];
  }
  // screen bounds of an upright figure (or donut) standing at ground point g
  function figureBox(gx, gy, height, radius) {
    let b = [1e9, 1e9, -1e9, -1e9];
    for (let a = 0; a < 8; a++) for (const z of [-BOXH, -BOXH + height]) {
      const s = toCanvas([gx + Math.cos(a * Math.PI / 4) * radius, gy + Math.sin(a * Math.PI / 4) * radius, z]);
      b = [Math.min(b[0], s[0]), Math.min(b[1], s[1]), Math.max(b[2], s[0]), Math.max(b[3], s[1])];
    }
    return b;
  }
  const RUN_DIR = V3(1, 0.12, 0).normalize();          // the mascot comes in from (and leaves to) the right
  const STOP = 0.27;                                     // it stops this far short of the donut
  function choosePlan() {
    // landing spots from right-of-the-box (preferred) round to in front of its right corner (narrow screens)
    // right of the box first (well clear of it), nearer the box only as far as still leaves a gap, then round the front
    const pts = [];
    for (let x = 2.08; x >= 1.84; x -= 0.02) pts.push([x, 0.5]);
    const path = [[1.95, 0.05], [1.85, -0.15], [1.75, -0.28], [1.65, -0.38], [1.5, -0.48], [1.35, -0.55], [1.22, -0.58]];
    for (let i = 0; i < path.length - 1; i++) for (let s = 0; s < 1; s += 0.125) pts.push([lerp(path[i][0], path[i + 1][0], s), lerp(path[i][1], path[i + 1][1], s)]);
    pts.push(path[path.length - 1]);
    const m = 8;
    let best = null;
    for (const [lx, ly] of pts) {
      const fx = lx + RUN_DIR.x * STOP, fy = ly + RUN_DIR.y * STOP;
      const bd = figureBox(lx, ly, 0.14, SIZE * 1.05), bf = figureBox(fx, fy, FIG_H + 0.03, 0.16);
      const b = [Math.min(bd[0], bf[0]), Math.min(bd[1], bf[1]), Math.max(bd[2], bf[2]), Math.max(bd[3], bf[3])];
      const over = Math.max(0, m - b[0]) + Math.max(0, b[2] - (CR.width - m)) + Math.max(0, CR.fade + 4 - b[1]) + Math.max(0, b[3] - (CR.height - m));
      if (!best || over < best.over - 0.5) best = { lx, ly, over };
      if (over === 0) { best = { lx, ly, over }; break; }
    }
    return best;
  }
  // distance along RUN_DIR from point (x, y) at which the figure is completely off the right of the canvas
  function offscreenDist(x, y) {
    for (let d = 0; d < 6; d += 0.05) {
      const b = figureBox(x + RUN_DIR.x * d, y + RUN_DIR.y * d, FIG_H + 0.03, 0.26);
      if (b[0] > CR.width + 4) return d;
    }
    return 6;
  }

  hero.appendChild(canvas);
  lidCanvas.style.visibility = 'hidden';
  lidEl.appendChild(lidCanvas);
  await hb.revealed;
  const ours = hb.claim();
  await inView(hb.el);
  if (!layout()) throw new Error('hero box not laid out');
  hb.useLid(drawLid);
  lidCanvas.style.visibility = '';
  hb.el.dataset.drop = 'playing';

  // ================================================================================================================
  // CHOREOGRAPHY
  // ================================================================================================================
  const plan = choosePlan();
  const Lx = plan.lx, Ly = plan.ly;                                     // where the donut lands
  const stopX = Lx + RUN_DIR.x * STOP, stopY = Ly + RUN_DIR.y * STOP;  // where the mascot stops to pick it up
  const headIn = Math.atan2(-RUN_DIR.y, -RUN_DIR.x), headOut = Math.atan2(RUN_DIR.y, RUN_DIR.x);
  // turn round through facing the camera, so the turn reads
  const toCam = Math.atan2(camPos.y - stopY, camPos.x - stopX);
  const turnSign = Math.cos(angLerp(headIn, headIn + Math.PI / 2, 1) - toCam) > Math.cos(angLerp(headIn, headIn - Math.PI / 2, 1) - toCam) ? 1 : -1;

  // timing (seconds)
  const G = 12;                                       // gravity, box units/s² (a touch slower than life, for clarity)
  const P = { x: clamp(Lx - 0.45, 1.0, 1.24), y: 0.45 };   // where it hits the lid: the right half, so it flips off to the right
  const zHit = T + REST;
  // start just above where the donut comes into view
  let zStart = zHit + 0.5;
  while (zStart < 6 && toCanvas([P.x, P.y, zStart])[1] + (SIZE * 1.15 * CAM.f / project([P.x, P.y, zStart])[2]) * CR.k > -2) zStart += 0.05;
  const tHold = 0.45;
  const tFall = Math.sqrt(2 * (zStart - zHit) / G);
  const tHit = tHold + tFall;
  const vHit = G * tFall;
  // flight after the hit: up and over to the right, one flip, then a near-vertical drop
  const apex = 0.4, vUp = Math.sqrt(2 * G * apex);
  const zLand = -BOXH + REST;
  const tUp = vUp / G, tDown = Math.sqrt(2 * (zHit + apex - zLand) / G);
  const tFly = tUp + tDown;
  const tLeave = tHit + 0.03;
  const tLand = tLeave + tFly;
  // the lid: dips under the hit, then swings open with real momentum (gravity about the hinge, damping, a stop at 135°)
  const lidTrack = (() => {
    const out = [], dt = 1 / 240, open = LID.open * Math.PI / 180;
    let th = 0, w = 0, tt = 0, popped = false;
    const gl = 3 * G / (2 * L) * 0.5;                    // gravity about the hinge (a light board, so it swings slowly)
    for (let i = 0; i < 240 * 3; i++) {
      tt = i * dt;
      if (tt < 0.06) { th = -0.05 * Math.sin(Math.PI * tt / 0.06); }        // the board gives a little under the hit
      else {
        if (!popped) { popped = true; th = 0; w = 4.75; }                   // ...and springs back with the hit's energy
        w += (-gl * Math.cos(th) - 0.18 * w) * dt;
        th += w * dt;
        if (th > open) { th = open; if (w > 0) w = -w * 0.22; }
        if (th < 0) { th = 0; w = Math.abs(w) * 0.2; }
      }
      out.push(th * 180 / Math.PI);
    }
    let rest = out.length - 1;
    for (let i = 60; i < out.length; i++) if (Math.abs(out[i] - LID.open) < 0.05 && out.slice(i, i + 24).every((d) => Math.abs(d - LID.open) < 0.05)) { rest = i; break; }
    return { at: (s) => (s <= 0 ? 0 : out[Math.min(out.length - 1, Math.floor(s * 240))]), rest: rest / 240 };
  })();
  const tLidRest = tHit + lidTrack.rest;

  // mascot: run in, stop, bend and pick up, turn round, run off
  const STRIDE = 0.6 * FS, VRUN = 1.45, DEC = 0.24;
  const tRunIn = tLand + 0.18;
  let dIn = Math.max(offscreenDist(stopX, stopY) + 0.1, 1);
  dIn = STRIDE * (Math.ceil(dIn / STRIDE - 0.525) + 0.525);                 // arrive in double support, both feet down
  const tCruise = (dIn - DEC) / VRUN, tDec = 2 * DEC / VRUN;
  const tStop = tRunIn + tCruise + tDec;
  const tPick = 1.3, tTurn = 0.62;
  const tTurnAt = tStop + tPick, tOut = tTurnAt + tTurn;
  const dOut = offscreenDist(stopX, stopY) + 0.2, ACC = 0.32;
  const tOutRun = ACC / (VRUN / 2) * 1 + (dOut - ACC) / VRUN;
  const tEnd = Math.max(tLidRest, tOut + tOutRun + 0.05);
  const phiStop = dIn / STRIDE;

  function runInDist(tt) {                          // distance covered since the run-in started
    const s = tt - tRunIn;
    if (s <= 0) return 0;
    if (s < tCruise) return VRUN * s;
    const u = Math.min(s - tCruise, tDec);
    return VRUN * tCruise + VRUN * u - (VRUN / tDec) * u * u / 2;
  }
  function runOutDist(tt) {
    const s = tt - tOut;
    if (s <= 0) return 0;
    const ta = ACC / (VRUN / 2);
    if (s < ta) return (VRUN / ta) * s * s / 2;
    return ACC + VRUN * (s - ta);
  }
  function gaitPhi(tt) {
    if (tt < tStop) return runInDist(tt) / STRIDE;
    if (tt < tTurnAt) return phiStop;
    if (tt < tOut) return phiStop + (tt - tTurnAt) / tTurn;
    return phiStop + 1 + runOutDist(tt) / STRIDE;
  }
  function rootAt(tt) {                              // position, heading, speed (0..1)
    if (tt < tStop) {
      const d = dIn - runInDist(tt);
      const s = tt < tRunIn + tCruise ? 1 : clamp(1 - (tt - tRunIn - tCruise) / tDec, 0, 1);
      return { x: stopX + RUN_DIR.x * d, y: stopY + RUN_DIR.y * d, heading: headIn, speed: s };
    }
    if (tt < tTurnAt) return { x: stopX, y: stopY, heading: headIn, speed: 0 };
    if (tt < tOut) return { x: stopX, y: stopY, heading: headIn + turnSign * Math.PI * smoother((tt - tTurnAt) / tTurn), speed: 0 };
    const d = runOutDist(tt), ta = ACC / (VRUN / 2);
    return { x: stopX + RUN_DIR.x * d, y: stopY + RUN_DIR.y * d, heading: headOut, speed: clamp((tt - tOut) / ta, 0, 1) };
  }
  // invert the gait clock (it never runs backwards)
  const tableT = [], tableP = [];
  for (let tt = tRunIn - 0.5; tt <= tEnd + 0.5; tt += 1 / 240) { tableT.push(tt); tableP.push(gaitPhi(tt)); }
  function timeAtPhi(ph) {
    let lo = 0, hi = tableP.length - 1;
    if (ph <= tableP[0]) return tableT[0];
    if (ph >= tableP[hi]) return tableT[hi];
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tableP[mid] < ph) lo = mid; else hi = mid; }
    return tableT[hi];
  }
  // footprints: where a foot lands at the end of a swing, from the body's pose at that moment
  const SWING = 0.45;
  function footprint(ph, side) {
    const tt = timeAtPhi(ph), r = rootAt(tt);
    const lead = STRIDE * 0.24 * r.speed;
    return { x: r.x + Math.cos(r.heading) * lead - Math.sin(r.heading) * side * 0.078 * FS, y: r.y + Math.sin(r.heading) * lead + Math.cos(r.heading) * side * 0.078 * FS, yaw: r.heading };
  }
  function foot(tt, side) {
    const off = side > 0 ? 0 : 0.5, ph = gaitPhi(tt) + off, k = Math.floor(ph), f = ph - k;
    const plant = (kk) => footprint(kk - off, side);
    if (f < 1 - SWING) { const p = plant(k); return { p: V3(p.x, p.y, -BOXH), yaw: p.yaw, pitch: 0 }; }
    const s = (f - (1 - SWING)) / SWING, a = plant(k), b = plant(k + 1), e = smoother(s);
    const r = rootAt(tt), lift = (0.035 + 0.06 * r.speed) * FS;
    return { p: V3(lerp(a.x, b.x, e), lerp(a.y, b.y, e), -BOXH + Math.sin(Math.PI * s) * lift), yaw: angLerp(a.yaw, b.yaw, e), pitch: Math.sin(Math.PI * s) * 0.35 * (r.speed + 0.3) };
  }

  // donut poses
  const qFlat = new THREE.Quaternion();
  const qFlip = (a) => new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), a);   // top rolls over toward +x (the right)
  const qWobble = new THREE.Quaternion();
  function carryPose(q) {                         // in front of the belly, held upright, facing forward
    const f = frame(q);
    const c = f.pel.clone().addScaledVector(f.U, 0.13 * FS).addScaledVector(f.F, 0.12 + SIZE * 0.45);
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.left, f.U, f.F));
    return { c, quat, f };
  }
  const groundQuat = new THREE.Quaternion();
  const groundC = V3(Lx, Ly, zLand);

  function figureAt(tt, reduced) {
    const r = reduced ? { x: stopX, y: stopY, heading: toCam - 0.5 * turnSign, speed: 0 } : rootAt(tt);
    const spd = r.speed;
    const ph = reduced ? phiStop : gaitPhi(tt);
    // bend for the pickup: down, hold, up
    const pk = reduced ? 1 : clamp((tt - tStop) / tPick, 0, 1);
    const bend = reduced ? 0 : sstep(0.04, 0.4, pk) * (1 - sstep(0.56, 0.95, pk));
    const bob = 0.022 * FS * spd * (0.5 + 0.5 * Math.cos(Math.PI * 4 * ph));
    const q = {
      x: r.x, y: r.y, heading: r.heading,
      hipZ: -BOXH + M.hip - bob - bend * 0.16 * FS,
      pitch: 0.2 * spd + bend * 0.98, lean: 0.03 * spd * Math.sin(Math.PI * 2 * ph), nod: bend * 0.6,
      footL: reduced ? { p: V3(r.x - Math.sin(r.heading) * 0.078 * FS, r.y + Math.cos(r.heading) * 0.078 * FS, -BOXH), yaw: r.heading } : foot(tt, 1),
      footR: reduced ? { p: V3(r.x + Math.sin(r.heading) * 0.078 * FS, r.y - Math.cos(r.heading) * 0.078 * FS, -BOXH), yaw: r.heading } : foot(tt, -1)
    };
    const f = frame(q);
    // hands: swinging while running, reaching for the donut, then holding it
    const sh = (s) => f.pel.clone().addScaledVector(f.U, M.shoulderUp).addScaledVector(f.left, s * M.shoulderW);
    const swing = (s) => {
      const a = Math.sin(Math.PI * 2 * ph + (s > 0 ? Math.PI : 0)) * spd;
      return sh(s).addScaledVector(f.F, (0.06 + 0.13 * a) * FS).addScaledVector(f.left, s * 0.05 * FS).addScaledVector(f.U, (-0.2 + 0.04 * Math.abs(a)) * FS);
    };
    const carrying = reduced || tt >= tStop + tPick * 0.52;
    const holdW = reduced ? 1 : (tt < tStop ? 0 : sstep(0.06, 0.36, pk));
    // where the donut is right now
    let dc, dq;
    if (reduced || tt >= tStop + tPick * 0.95) { const cp = carryPose(q); dc = cp.c; dq = cp.quat; }
    else if (tt >= tStop + tPick * 0.5) {
      const cp = carryPose(q), e = smoother((pk - 0.5) / 0.45);
      dc = groundC.clone().lerp(cp.c, e); dq = groundQuat.clone().slerp(cp.quat, e);
      dc.z += Math.sin(Math.PI * e) * 0.04;
    } else { dc = groundC.clone(); dq = groundQuat.clone(); }
    const grip = (s) => {
      // the sides of the donut, from the mascot's point of view
      return dc.clone().addScaledVector(f.left, s * SIZE * 0.95).addScaledVector(V3(0, 0, 1), carrying ? 0 : 0.02);
    };
    q.handL = swing(1).lerp(grip(1), holdW);
    q.handR = swing(-1).lerp(grip(-1), holdW);
    q.visible = reduced || (tt > tRunIn - 0.01 && tt < tEnd);
    return { q, dc, dq, carrying: carrying || tt >= tStop + tPick * 0.5 };
  }

  const ev = { hit: false, open: false };
  // tt drives the drop and the lid; tf drives the mascot (it can be held back until its patch of ground is on screen)
  function frameAt(tt, reduced, tf = tt) {
    // ---- lid
    let lid = reduced ? LID.open : (tt < tHit ? 0 : lidTrack.at(tt - tHit));
    // ---- donut
    let dz, dx, dy, quat = qFlat.clone(), squash = 1, shadowOn = 0;
    if (reduced) { dx = 0; dy = 0; dz = 0; }
    else if (tt < tHit) {                                 // falling, with a lazy turn
      const s = tt - tHold; dx = P.x - 0.02 * (tFall - Math.max(0, s)); dy = P.y; dz = zStart - 0.5 * G * Math.max(0, s) ** 2;
      quat = new THREE.Quaternion().setFromAxisAngle(V3(1, 0.2, 0).normalize(), -0.12 * (1 - s / tFall));
    } else if (tt < tLeave) {                             // the hit: a brief squash on the lid
      dx = P.x; dy = P.y; dz = zHit; squash = 1 - 0.07 * Math.sin(Math.PI * (tt - tHit) / (tLeave - tHit));
    } else if (tt < tLand) {                              // one smooth flip to the right, then down
      const s = tt - tLeave, u = s / tFly;
      const xe = 1 - Math.pow(1 - clamp(u / 0.8, 0, 1), 3);
      dx = lerp(P.x, Lx, xe); dy = lerp(P.y, Ly, xe);
      dz = zHit + vUp * s - 0.5 * G * s * s;
      quat = qFlip(Math.PI * 2 * smoother(clamp((u - 0.02) / 0.8, 0, 1)));
    } else {                                              // landed: a small settling rock, no bounce
      const s = tt - tLand;
      dx = Lx; dy = Ly; dz = zLand;
      squash = 1 - 0.05 * Math.exp(-s / 0.05) * (s < 0.12 ? 1 : 0);
      quat = qWobble.setFromAxisAngle(V3(0, 1, 0), 0.07 * Math.exp(-s / 0.11) * Math.sin(s * 26));
      shadowOn = 1;
    }
    const F2 = figureAt(tf, reduced);
    if (reduced || (tf >= tStop + tPick * 0.5)) {
      donut.position.copy(F2.dc); donut.quaternion.copy(F2.dq); squash = 1;
    } else {
      if (tt >= tLand) { donut.position.set(groundC.x, groundC.y, groundC.z); donut.quaternion.copy(groundQuat).multiply(quat); }
      else { donut.position.set(dx, dy, dz); donut.quaternion.copy(quat); }
    }
    donut.scale.set(1, 1, squash);
    donut.visible = reduced || tf < tEnd - 0.02;
    poseFigure(F2.q);
    // shadows: faint while high up, firm near the ground
    const zz = donut.position.z;
    ground.material.opacity = 0.32 * clamp(1.2 - (zz + BOXH) / 0.55, 0, 1) + (fig.visible ? 0.0 : 0);
    if (fig.visible) ground.material.opacity = Math.max(ground.material.opacity, 0.3);
    shadeWall.opacity = 0.24 * clamp(1.2 - (zz + BOXH) / 0.55, 0, 1);
    shadeLid.opacity = 0.34 * clamp(1.2 - (zz - T) / 0.5, 0, 1);
    const onGround = !F2.carrying && (tt >= tLand || reduced);
    if (!reduced && tt < tLand) donutBlob.material.opacity = 0;
    donutBlob.position.set(donut.position.x + 0.01, donut.position.y + 0.015, -BOXH + 0.001);
    donutBlob.material.opacity = onGround ? 0.5 * Math.min(1, (tt - tLand) / 0.05 + (reduced ? 1 : 0)) : 0.32 * clamp(1 - (zz - zLand) / 0.25, 0, 1) * (zz < 0 ? 1 : 0);
    lidProxy.rotation.x = -lid * Math.PI / 180;
    return lid;
  }

  let zoom = null;                                    // debug magnification (see ?dropslow)
  const draw = () => {
    if (zoom && fig.visible) {
      const pm = camera.projectionMatrix.clone(), c = new THREE.Vector3(fig.children[0].position.x, fig.children[0].position.y, fig.children[0].position.z).project(camera);
      const Tz = new THREE.Matrix4().set(zoom, 0, 0, -zoom * c.x, 0, zoom, 0, -zoom * c.y, 0, 0, 1, 0, 0, 0, 0, 1);
      camera.projectionMatrix.premultiply(Tz); renderer.render(scene, camera); camera.projectionMatrix.copy(pm); return;
    }
    renderer.render(scene, camera);
  };
  window.addEventListener('resize', () => { if (layout()) { drawLid(); draw(); } });

  const settledStatic = () => { hb.el.dataset.drop = 'done'; };
  if (hb.reduced || !ours) {
    // reduced motion (or the lid already opened on its own): a clean final picture, no motion
    frameAt(0, true); hb.render(LID.open); drawLid(LID.open); draw();
    if (!ours) canvas.classList.add('is-late');
    settledStatic();
    return;
  }

  // ?dropslow=N plays N times slower and exposes seek(seconds) for checking individual moments
  const slow = Math.max(1, +new URLSearchParams(location.search).get('dropslow') || 1);
  let seekTo = null;

  if (slow > 1) window.HomiesDonutDrop = {
    seek: (s) => { seekTo = s; }, times: { tHit, tLand, tRunIn, tStop, tTurnAt, tOut, tEnd, tLidRest }, plan, layout: CR,
    box: (x, y, h, r) => figureBox(x, y, h, r),
    zoom: (f) => { zoom = f || null; }               // magnify the view round the mascot (checking only)
  };
  // where the mascot will act: if that patch of ground is below the fold (short laptop screens), the donut waits on
  // the ground and the mascot runs in once it scrolls into view
  const area = document.createElement('div');
  area.className = 'hb-scene-area'; area.setAttribute('aria-hidden', 'true');
  (() => {
    const a = figureBox(Lx, Ly, 0.14, SIZE), b = figureBox(stopX, stopY, FIG_H, 0.16);
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
