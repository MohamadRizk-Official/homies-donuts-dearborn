/* Homie's Donuts — the hero box scene.
 *
 * 1. The box sits closed and still.
 * 2. A chocolate-sprinkle donut (img/hero/sprinkle-donut.glb, built from the product photo by tools/make_donut.py)
 *    falls in from above and hits the lid. The hit flexes the lid down and gives it the momentum that swings it open.
 * 3. It carries on in one continuous arc: off the lid, one smooth flip, down onto the ground well clear of the box,
 *    where it slides a touch and settles.
 * 4. A small flat gray silhouette runs in from the right, bends, picks the donut up, turns round and runs off with it.
 *
 * Everything is drawn with three.js through the camera recovered from the box photo, so it sits in the photo's space.
 * The lid is real 3D cardboard (thickness, folds, hinge, lighting and shadows) drawn in the lid's own layer, so it
 * still slips behind the box once open. The donut and mascot are drawn above the page in the hero; invisible stand-ins
 * for the box and lid hide them where the box is in front and catch their shadows.
 *
 * The mascot is a flat 2D cut-out (drawn on a canvas under the 3D layer) with a little skeleton underneath: legs
 * and arms use two-bone IK, feet are planted on footprints laid along its path (so they never slide), and it turns
 * gradually, foreshortening like a cut-out rather than flipping.
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
    new GLTFLoader().loadAsync('img/hero/sprinkle-donut.glb?v=2'),
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
  donut.add(model);
  scene.add(donut);
  const donutBlob = blob(SIZE * 2.6);

  // ---------------- the mascot: a small, flat gray silhouette ----------------
  // Drawn in 2D on its own canvas above the 3D layer; wherever the donut is in front of it, the donut's outline is
  // cut out of the figure, so a carried donut still sits in front of the body. Its little
  // skeleton walks on the real ground (footprints, IK), but every point is flattened onto a screen-facing plane
  // through its feet: it stays a flat cut-out and only foreshortens, gradually, as it turns round.
  const figCanvas = document.createElement('canvas');
  figCanvas.className = 'hb-fig';
  figCanvas.setAttribute('aria-hidden', 'true');
  const fctx = figCanvas.getContext('2d');
  const FK = 1.25;                                      // figure scale: about as tall as the donut is wide on screen
  const FIG_H = 0.42 * FK;
  const M = { hip: 0.165 * FK, hipW: 0.024 * FK, thigh: 0.088 * FK, shin: 0.082 * FK, ankle: 0.012 * FK, shoulderUp: 0.1 * FK, shoulderW: 0.046 * FK, upper: 0.085 * FK, fore: 0.078 * FK, headR: 0.058 * FK, foot: 0.034 * FK };
  const camR = V3(R[0][0], R[0][1], 0).normalize();     // screen-right, along the ground
  const camF = V3(R[2][0], R[2][1], 0).normalize();     // the camera's view direction, along the ground
  const camBack = camF.clone().negate();
  const Z = V3(0, 0, 1);
  const figBlob = blob(0.3 * FK);
  let figPose = null;

  // two-bone IK: from root joint S toward target T with a bend hint; returns [middle joint, reached end]
  function ik(S, Tg, L1, L2, hint) {
    const d = Tg.clone().sub(S);
    const len = clamp(d.length(), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
    const n = d.normalize();
    const a = (L1 * L1 - L2 * L2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const m = hint.clone().addScaledVector(n, -hint.dot(n)).normalize();
    return [S.clone().addScaledVector(n, a).addScaledVector(m, h), S.clone().addScaledVector(n, len)];
  }
  // body-local coordinates (a = forward, b = left, c = up from the ground) of a world point
  function toLocal(q, p) {
    const dx = p.x - q.x, dy = p.y - q.y, ch = Math.cos(q.heading), sh = Math.sin(q.heading);
    return V3(dx * ch + dy * sh, -dx * sh + dy * ch, p.z + BOXH);
  }
  const bellyBump = (v) => Math.exp(-(((v - 0.3) / 0.2) ** 2));
  const prof = (v) => Math.sqrt(Math.max(0, 1 - ((v - 0.42) / 0.62) ** 2));
  function drawFigure() {
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, figCanvas.width, figCanvas.height);
    const q = figPose;
    if (!q || !q.visible || !CR) return;
    const dpr = figCanvas.width / CR.width;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const fwd = V3(Math.cos(q.heading), Math.sin(q.heading), 0), left = V3(-Math.sin(q.heading), Math.cos(q.heading), 0);
    const f = fwd.dot(camR), l = left.dot(camR);
    const sg = f >= 0 ? 1 : -1;
    // flatten a body-local point onto the screen-facing plane through the feet, then onto the canvas
    const P = (a, b, c) => { const s = a * f + b * l; return toCanvas([q.x + camR.x * s, q.y + camR.y * s, -BOXH + c]); };
    const o = P(0, 0, 0), up1 = P(0, 0, 0.1);
    const unit = Math.hypot(up1[0] - o[0], up1[1] - o[1]) / 0.1;          // canvas px per box unit, here
    const sPt = (s, c) => toCanvas([q.x + camR.x * s, q.y + camR.y * s, -BOXH + c]);
    const lean = q.lean, cl = Math.cos(lean), sl = Math.sin(lean);
    const body = '#67676d', far = '#58585e';
    const limb = (pts, wdt, col) => {
      fctx.strokeStyle = col; fctx.lineWidth = wdt * unit; fctx.lineCap = 'round'; fctx.lineJoin = 'round';
      fctx.beginPath(); pts.forEach((p, i) => (i ? fctx.lineTo(p[0], p[1]) : fctx.moveTo(p[0], p[1]))); fctx.stroke();
    };
    // joints (body-local)
    const torsoAt = (x, y) => V3(x * cl + y * sl, 0, q.hip + (-x * sl + y * cl));
    const shoulderC = torsoAt(-0.005 * FK, M.shoulderUp);
    const leg = (side) => {
      const hipJ = V3(0, side * M.hipW, q.hip - 0.01), ankle = q.feet[side > 0 ? 0 : 1].clone().add(V3(0, 0, M.ankle));
      const [knee, end] = ik(hipJ, ankle, M.thigh, M.shin, V3(1, 0, 0.1));
      const toe = end.clone().add(V3(M.foot * Math.cos(q.footPitch[side > 0 ? 0 : 1]), 0, -M.ankle * 0.5 + M.foot * Math.sin(q.footPitch[side > 0 ? 0 : 1])));
      return [[P(hipJ.x, hipJ.y, hipJ.z), P(knee.x, knee.y, knee.z), P(end.x, end.y, end.z)], [P(end.x - 0.008 * FK, end.y, end.z - M.ankle * 0.4), P(toe.x, toe.y, toe.z)]];
    };
    const arm = (side) => {
      const sh = shoulderC.clone().add(V3(0, side * M.shoulderW, 0));
      const [elbow, hand] = ik(sh, q.hands[side > 0 ? 0 : 1], M.upper, M.fore, V3(-0.7, side * 0.35, -0.6));
      return [P(sh.x, sh.y, sh.z), P(elbow.x, elbow.y, elbow.z), P(hand.x, hand.y, hand.z)];
    };
    const farSide = left.dot(camF) > 0 ? 1 : -1;          // which side is further from the viewer
    const drawLeg = (side, col) => { const [lg, ft] = leg(side); limb(lg, 0.026 * FK, col); limb(ft, 0.022 * FK, col); };
    const drawArm = (side, col) => {
      const a = arm(side); limb(a, 0.02 * FK, col);
      fctx.fillStyle = col; fctx.beginPath(); fctx.arc(a[2][0], a[2][1], 0.015 * FK * unit, 0, Math.PI * 2); fctx.fill();
    };
    drawArm(farSide, far); drawLeg(farSide, far);
    // torso: a rounded body, fuller low down in front (the belly), seen at whatever angle it is turned to
    const af = Math.abs(f), pts1 = [], pts2 = [];
    for (let i = 0; i <= 24; i++) {
      const v = -0.2 + 1.24 * i / 24, y = v * 0.12 * FK, pv = prof(v);
      const Af = (0.05 + 0.03 * bellyBump(v)) * pv * FK, Ab = 0.044 * pv * FK, B = 0.05 * pv * FK;
      const cpt = torsoAt(0, y);
      const sc = cpt.x * f, cc = cpt.z;
      const e1 = Math.sqrt(Af * Af * f * f + B * B * l * l), e2 = Math.sqrt(Ab * Ab * f * f + B * B * l * l);
      // widths go across the (leaning) body, toward its front (belly) and back
      const dl = Math.hypot(sl * f, cl), ns = cl / dl * sg, nc = -sl * f / dl * sg;
      pts1.push(sPt(sc + ns * e1, cc + nc * e1));
      pts2.push(sPt(sc - ns * e2, cc - nc * e2));
    }
    fctx.fillStyle = body; fctx.beginPath();
    pts1.forEach((p, i) => (i ? fctx.lineTo(p[0], p[1]) : fctx.moveTo(p[0], p[1])));
    for (let i = pts2.length - 1; i >= 0; i--) fctx.lineTo(pts2[i][0], pts2[i][1]);
    fctx.closePath(); fctx.fill();
    // head: smooth and featureless
    const hc = torsoAt(0.004 * FK, M.shoulderUp + 0.072 * FK);
    const hp = P(hc.x, hc.y, hc.z);
    fctx.beginPath(); fctx.arc(hp[0], hp[1], M.headR * unit, 0, Math.PI * 2); fctx.fill();
    drawLeg(-farSide, body); drawArm(-farSide, body);
    // the donut is in front of the figure (lying on the ground before it, or held out in front): cut its outline out
    if (donut.visible && project([donut.position.x, donut.position.y, donut.position.z])[2] < project([q.x, q.y, -BOXH + q.hip])[2] + 0.04) {
      donut.updateMatrixWorld();
      fctx.globalCompositeOperation = 'destination-out';
      fctx.fillStyle = '#000';
      for (const hz of [-REST * 0.85, 0, REST * 0.85]) {
        fctx.beginPath();
        for (let i = 0; i < 40; i++) {
          const a = i / 40 * Math.PI * 2;
          const w = new THREE.Vector3(Math.cos(a) * SIZE * 0.99, Math.sin(a) * SIZE * 0.99, hz).applyMatrix4(donut.matrixWorld);
          const c = toCanvas([w.x, w.y, w.z]);
          if (i) fctx.lineTo(c[0], c[1]); else fctx.moveTo(c[0], c[1]);
        }
        fctx.closePath(); fctx.fill();
      }
      fctx.globalCompositeOperation = 'source-over';
    }
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
    Object.assign(figCanvas.style, { left: canvas.style.left, top: canvas.style.top, width: canvas.style.width, height: canvas.style.height });
    const fd = Math.min(window.devicePixelRatio || 1, 2);
    figCanvas.width = Math.round(CR.width * fd); figCanvas.height = Math.round(CR.height * fd);
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
  const STOP = SIZE + 0.15;                                     // it stops this far short of the donut
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
      const bd = figureBox(lx, ly, 0.16, SIZE * 1.05), bf = figureBox(fx, fy, FIG_H + 0.08, SIZE * 1.15);
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
      const b = figureBox(x + RUN_DIR.x * d, y + RUN_DIR.y * d, FIG_H + 0.1, SIZE * 1.6);
      if (b[0] > CR.width + 4) return d;
    }
    return 6;
  }

  hero.appendChild(canvas);
  hero.appendChild(figCanvas);
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
    for (let i = 60; i < out.length; i++) if (Math.abs(out[i] - LID.open) < 0.05 && out.slice(i, i + 24).every((d) => Math.abs(d - LID.open) < 0.05)) { rest = i; break; }
    return { at: (s) => (s <= 0 ? 0 : out[Math.min(out.length - 1, Math.floor(s * 240))]), rest: rest / 240 };
  })();
  const tLidRest = tHit + lidTrack.rest;

  // mascot: run in, stop, bend and pick up, turn round, run off
  const STRIDE = 0.27 * FK, VRUN = 0.95, DEC = 0.12;
  const tRunIn = tRest + 0.12;
  let dIn = Math.max(offscreenDist(stopX, stopY) + 0.08, 0.6);
  dIn = STRIDE * (Math.ceil(dIn / STRIDE - 0.525) + 0.525);                 // arrive in double support, both feet down
  const tCruise = (dIn - DEC) / VRUN, tDec = 2 * DEC / VRUN;
  const tStop = tRunIn + tCruise + tDec;
  const tPick = 1.2, tTurn = 0.9;
  const tTurnAt = tStop + tPick, tOut = tTurnAt + tTurn;
  const dOut = offscreenDist(stopX, stopY) + 0.15, ACC = 0.12;
  const tOutRun = ACC / (VRUN / 2) + (dOut - ACC) / VRUN;
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
    if (tt < tOut) return phiStop + (tt - tTurnAt) / tTurn;               // two small steps while it turns
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
  const SWING = 0.45, FOOT_W = 0.026 * FK;
  function footprint(ph, side) {
    const tt = timeAtPhi(ph), r = rootAt(tt);
    const lead = STRIDE * 0.24 * r.speed;
    return { x: r.x + Math.cos(r.heading) * lead - Math.sin(r.heading) * side * FOOT_W, y: r.y + Math.sin(r.heading) * lead + Math.cos(r.heading) * side * FOOT_W };
  }
  function foot(tt, side) {
    const off = side > 0 ? 0 : 0.5, ph = gaitPhi(tt) + off, k = Math.floor(ph), f = ph - k;
    const plant = (kk) => footprint(kk - off, side);
    if (f < 1 - SWING) { const p = plant(k); return { p: V3(p.x, p.y, -BOXH), pitch: 0 }; }
    const s = (f - (1 - SWING)) / SWING, a = plant(k), b = plant(k + 1), e = smoother(s);
    const r = rootAt(tt), lift = (0.014 + 0.03 * r.speed) * FK;
    return { p: V3(lerp(a.x, b.x, e), lerp(a.y, b.y, e), -BOXH + Math.sin(Math.PI * s) * lift), pitch: Math.sin(Math.PI * s) * 0.5 * (r.speed + 0.3) };
  }

  // donut poses
  const groundQuat = new THREE.Quaternion();
  const groundC = V3(Lx, Ly, zLand);
  // carried in both hands out in front at chest height, its face to the viewer; seen side-on that puts it beside the
  // body, and during the turn it swings up over the head to the other side, so body and turn stay readable
  const carryQuat = (() => {
    const n = camBack.clone().addScaledVector(Z, 0.55).normalize(), x = camR.clone(), y = n.clone().cross(x).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
  })();
  function carryCentre(r, hip) {
    const f = Math.cos(r.heading) * camR.x + Math.sin(r.heading) * camR.y;      // how side-on it is (+1 facing right)
    const sOff = f * (SIZE + 0.075 * FK), cOff = hip + 0.12 * FK + (1 - f * f) * 0.27 * FK;
    return V3(r.x, r.y, -BOXH + cOff).addScaledVector(camR, sOff).addScaledVector(camBack, 0.04);
  }
  function grips(dc, r, carried) {                    // where the hands hold it
    const fwd = V3(Math.cos(r.heading), Math.sin(r.heading), 0), left = V3(-Math.sin(r.heading), Math.cos(r.heading), 0);
    if (!carried) return [1, -1].map((s) => groundC.clone().addScaledVector(fwd, -SIZE * 0.72).addScaledVector(left, s * 0.06 * FK).add(V3(0, 0, 0.035)));
    const f = fwd.dot(camR), af = Math.abs(f), sl = Math.sign(left.dot(camR) || 1);
    // side-on: both hands on the rim nearest the body (one high, one low); facing the viewer: one each side, underneath
    return [1, -1].map((s) => dc.clone()
      .addScaledVector(camR, -Math.sign(f || 1) * SIZE * 0.82 * af + s * sl * SIZE * 0.8 * (1 - af))
      .addScaledVector(Z, s * SIZE * 0.4 * af - SIZE * 0.45 * (1 - af)));
  }

  function figureAt(tt, reduced) {
    const r = reduced ? { x: stopX, y: stopY, heading: Math.atan2(camBack.y, camBack.x) + 0.55 * turnSign, speed: 0 } : rootAt(tt);
    const spd = r.speed;
    const ph = reduced ? phiStop : gaitPhi(tt);
    // bend for the pickup: down, hold, up
    const pk = reduced ? 1 : clamp((tt - tStop) / tPick, 0, 1);
    const bend = reduced ? 0 : sstep(0.04, 0.38, pk) * (1 - sstep(0.56, 0.95, pk));
    const bob = 0.012 * FK * spd * (0.5 + 0.5 * Math.cos(Math.PI * 4 * ph));
    const hip = M.hip - bob - bend * 0.075 * FK;
    const q = { x: r.x, y: r.y, heading: r.heading, hip, lean: 0.22 * spd + bend * 1.05, visible: reduced || (tt > tRunIn - 0.01 && tt < tEnd) };
    const fl = reduced ? { p: V3(r.x - Math.sin(r.heading) * FOOT_W, r.y + Math.cos(r.heading) * FOOT_W, -BOXH), pitch: 0 } : foot(tt, 1);
    const fr = reduced ? { p: V3(r.x + Math.sin(r.heading) * FOOT_W, r.y - Math.cos(r.heading) * FOOT_W, -BOXH), pitch: 0 } : foot(tt, -1);
    q.feet = [toLocal(q, fl.p), toLocal(q, fr.p)];
    q.footPitch = [fl.pitch, fr.pitch];
    // where the donut is right now
    let dc, dq, carried = false, liftE = 0;
    if (reduced || tt >= tStop + tPick * 0.95) { dc = carryCentre(r, hip); dq = carryQuat.clone(); carried = true; liftE = 1; }
    else if (tt >= tStop + tPick * 0.5) {
      liftE = smoother((pk - 0.5) / 0.45);
      const fwd = V3(Math.cos(r.heading), Math.sin(r.heading), 0);
      dc = groundC.clone().lerp(carryCentre(r, hip), liftE).addScaledVector(fwd, Math.sin(Math.PI * liftE) * 0.03);
      dq = groundQuat.clone().slerp(carryQuat, liftE);
      dc.z += Math.sin(Math.PI * liftE) * 0.04; carried = true;
    } else { dc = groundC.clone(); dq = groundQuat.clone(); }
    // hands: swinging while running, reaching for the donut, then holding it
    const cl = Math.cos(q.lean), sl = Math.sin(q.lean);
    const swing = (s) => {
      const a = Math.sin(Math.PI * 2 * ph + (s > 0 ? Math.PI : 0)) * spd;
      const sh = V3(M.shoulderUp * sl, s * M.shoulderW, hip + M.shoulderUp * cl);
      return sh.add(V3((0.015 + 0.07 * a) * FK, s * 0.012 * FK, (-0.11 + 0.025 * Math.abs(a)) * FK));
    };
    const holdW = reduced ? 1 : (tt < tStop ? 0 : sstep(0.06, 0.34, pk));
    const g0 = grips(dc, r, false), g1 = grips(dc, r, true);
    q.hands = [1, -1].map((s, i) => {
      const g = g0[i].clone().lerp(g1[i], liftE);
      return swing(s).lerp(toLocal(q, g), holdW);
    });
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
      const k = tt - tLand, s = Math.min(k, tSlide), d = vh * s - 0.5 * (vh / tSlide) * s * s;
      pos.set(TD.x + dir.x * d, TD.y + dir.y * d, zLand);
      squash = 1 - 0.05 * Math.exp(-k / 0.05) * (k < 0.12 ? 1 : 0);
      quat = new THREE.Quaternion().setFromAxisAngle(V3(-dir.y, dir.x, 0), 0.06 * Math.exp(-k / 0.12) * Math.sin(k * 24));
    }
    const F2 = figureAt(tf, reduced);
    if (reduced || F2.carried) { donut.position.copy(F2.dc); donut.quaternion.copy(F2.dq); squash = 1; }
    else { donut.position.copy(pos); donut.quaternion.copy(quat); }
    donut.scale.set(1, 1, squash);
    donut.visible = reduced || tf < tEnd - 0.02;
    figPose = F2.q;
    figBlob.position.set(F2.q.x + 0.01, F2.q.y + 0.01, -BOXH + 0.001);
    figBlob.material.opacity = F2.q.visible ? 0.35 : 0;
    // shadows: faint while high up, firm near the ground
    const zz = donut.position.z;
    ground.material.opacity = Math.max(0.32 * clamp(1.2 - (zz + BOXH) / 0.55, 0, 1), F2.q.visible ? 0.3 : 0);
    shadeWall.opacity = 0.24 * clamp(1.2 - (zz + BOXH) / 0.55, 0, 1);
    shadeLid.opacity = 0.34 * clamp(1.2 - (zz - T) / 0.5, 0, 1);
    const onGround = !F2.carried && (reduced || tt >= tLand);
    donutBlob.position.set(donut.position.x + 0.01, donut.position.y + 0.015, -BOXH + 0.001);
    donutBlob.material.opacity = onGround ? 0.5 : (tt < tLand && !reduced ? 0.32 * clamp(1 - (zz - zLand) / 0.25, 0, 1) * (zz < 0 ? 1 : 0) : 0);
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

  // ?dropslow=N plays N times slower and exposes seek(seconds) for checking individual moments
  const slow = Math.max(1, +new URLSearchParams(location.search).get('dropslow') || 1);
  let seekTo = null;

  if (slow > 1) window.HomiesDonutDrop = {
    seek: (s) => { seekTo = s; },
    frame: (s) => { seekTo = s; hb.render(frameAt(s, false, s)); draw(); },   // render one moment right now
    times: { tHit, tLand, tRest, tRunIn, tStop, tTurnAt, tOut, tEnd, tLidRest }, plan, layout: CR

  };
  // where the mascot will act: if that patch of ground is below the fold (short laptop screens), the donut waits on
  // the ground and the mascot runs in once it scrolls into view
  const area = document.createElement('div');
  area.className = 'hb-scene-area'; area.setAttribute('aria-hidden', 'true');
  (() => {
    const a = figureBox(Lx, Ly, 0.16, SIZE), b = figureBox(stopX, stopY, FIG_H + 0.08, SIZE * 1.15);
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
