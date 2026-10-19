"""Build a custom 3D pistachio donut (GLB) from the reference photo (top-down shot, transparent background).

Geometry : a ring whose outer and hole outlines are traced from the photo, with a domed top and a flatter fried
           bottom (superellipse cross-section), low-frequency lumps, and the glaze / drizzle / chopped pistachios
           raised out of the surface from a height map derived from the photo.
Top      : planar UV straight from the photo (the real glaze, drizzle and nuts), plus a normal map, roughness and a
           clear-coat mask so the chocolate reads glossy and the nuts matte.
Bottom   : a procedural fried-dough texture (golden sides, pale fry band, browner flat base) with pores.
Output   : KHR_mesh_quantization GLB (int16 positions, int8 normals, uint16 uvs) + JPEG textures.
usage    : py -3.12 -I make_donut.py photo.webp out.glb [preview_dir]
"""
import sys, io, json, struct, math
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
prev = sys.argv[3] if len(sys.argv) > 3 else None
rng = np.random.default_rng(7)

ph = Image.open(src).convert('RGBA')
PW, PH = ph.size
S = max(PW, PH)
sq = Image.new('RGBA', (S, S), (0, 0, 0, 0)); sq.paste(ph, (0, 0))
A = np.asarray(sq).astype(np.float32)
alpha = A[..., 3] / 255.0
rgb = A[..., :3]

# ---------------- outlines ----------------
cx, cy = 377.1, 371.0                     # hole centre (refined below)
def trace(cx, cy, n=720):
    ri = np.zeros(n); ro = np.zeros(n)
    for k in range(n):
        t = 2 * math.pi * k / n
        dx, dy = math.cos(t), math.sin(t)
        rs = np.arange(0, 420, 0.5)
        xs = np.clip((cx + dx * rs).round().astype(int), 0, S - 1)
        ys = np.clip((cy + dy * rs).round().astype(int), 0, S - 1)
        inside = alpha[ys, xs] > 0.5
        idx = np.where(inside)[0]
        ri[k] = rs[idx[0]]; ro[k] = rs[idx[-1]]
    return ri, ro
for _ in range(3):
    ri, ro = trace(cx, cy)
    t = np.linspace(0, 2 * math.pi, len(ri), endpoint=False)
    # recentre on the hole (that's the axis the donut spins about)
    cx += (ri * np.cos(t)).mean() * 2 / 1; cy += (ri * np.sin(t)).mean() * 2 / 1
ri, ro = trace(cx, cy)
def smooth(a, w):
    k = np.ones(w) / w; p = np.concatenate([a[-w:], a, a[:w]])
    return np.convolve(p, k, 'same')[w:-w]
ri = smooth(ri, 15) + 1.0; ro = smooth(ro, 9) - 1.5   # keep just inside the cut-out edge
Rs = ro.mean()                                       # photo px per model unit (outer radius = 1)
print('centre', round(cx, 1), round(cy, 1), 'outer', round(Rs, 1), 'hole', round(ri.mean(), 1), 'ratio', round(ri.mean() / Rs, 3))

# ---------------- fill the transparent areas with neighbouring dough colour (no black/white at the edges) -------------
def inpaint(rgb, mask, iters=60):
    out = rgb.copy(); m = mask.astype(np.float32)
    for i in range(iters):
        blur = np.asarray(Image.fromarray(np.clip(out * m[..., None], 0, 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3))).astype(np.float32)
        wb = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3))).astype(np.float32) / 255
        fill = blur / np.maximum(wb[..., None], 1e-3)
        newm = wb > 0.02
        out = np.where(m[..., None] > 0.5, out, np.where(newm[..., None], fill, out))
        m = np.maximum(m, newm.astype(np.float32))
    return out
solid = alpha > 0.85
base = inpaint(rgb, solid)

# ---------------- classify: chocolate glaze / pistachio topping / dough ----------------
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
ang = np.arctan2(yy - cy, xx - cx); ang = np.where(ang < 0, ang + 2 * math.pi, ang)
kk = (ang / (2 * math.pi) * len(ro)).astype(int) % len(ro)
rr = np.hypot(xx - cx, yy - cy)
rn = (rr - ri[kk]) / np.maximum(ro[kk] - ri[kk], 1)    # 0 at hole edge, 1 at outer edge
hsv = np.asarray(Image.fromarray(base.astype(np.uint8)).convert('HSV')).astype(np.float32)
hue = hsv[..., 0] * 360 / 255; sat = hsv[..., 1] / 255; val = hsv[..., 2] / 255
shine = (sat < 0.4) & (val >= 0.47) & solid           # white gloss highlights on the chocolate, not toppings
choc = ((val < 0.47) & solid) | shine
bright = (val >= 0.47) & solid & ~shine
# dough shows only as a thin ring at the outer and hole edges, and is orange rather than olive
edge = (rn > 0.9) | (rn < 0.07)
dough = bright & edge & (hue < 46) & ~(np.asarray(Image.fromarray((choc * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0)
dough = dough | (~solid)
top = bright & ~dough
def blurf(a, r): return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
glaze = blurf((choc | top).astype(np.float32), 1.2)
topf = blurf(top.astype(np.float32), 1.0)
luma = (0.3 * base[..., 0] + 0.59 * base[..., 1] + 0.11 * base[..., 2]) / 255
detail = np.clip((luma - blurf(luma, 6)) * 3, -1, 1)          # nut facets / drizzle edges
# pistachio chunks: greener or pinker than the olive drizzle, plus small bright blobs
green = (hue > 58) & top
pink = (hue < 30) & top
chunk = blurf((green | pink).astype(np.float32), 1.5)
height = 0.30 * glaze + 0.55 * topf + 0.45 * chunk * topf + 0.12 * detail * topf
height = np.clip(height, 0, 1.4)
height_s = blurf(height / 1.4, 2.0) * 1.4                     # what the mesh follows; the fine part goes in the normal map

# ---------------- textures ----------------
TS = 1024
def to_img(a): return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
top_col = to_img(base).resize((TS, TS), Image.LANCZOS)
h_t = np.asarray(Image.fromarray((height / 1.4 * 65535).astype(np.uint16)).resize((TS, TS), Image.BILINEAR)).astype(np.float32) / 65535 * 1.4 if False else None
hh = np.asarray(to_img(height / 1.4 * 255).resize((TS, TS), Image.BICUBIC)).astype(np.float32) / 255 * 1.4
hh = blurf(hh / 1.4, 0.7) * 1.4
def normal_map(h, strength):
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    # glTF: +X right (u), +Y up (-v, image rows go down)
    nx, ny, nz = -gx, gy, np.ones_like(h)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.dstack([nx / l, ny / l, nz / l]) * 127.5 + 127.5
top_nrm = to_img(normal_map(hh, 9.0))
cm = np.asarray(to_img(choc * 255.0).resize((TS, TS), Image.BILINEAR)).astype(np.float32) / 255
tm = np.asarray(to_img(topf * 255).resize((TS, TS), Image.BILINEAR)).astype(np.float32) / 255
chm = np.asarray(to_img(chunk * topf * 255).resize((TS, TS), Image.BILINEAR)).astype(np.float32) / 255
rough = 0.86 * (1 - cm - tm).clip(0, 1) + 0.30 * cm + 0.52 * tm
rough = rough * (1 - chm) + 0.74 * chm
rough = rough + rng.normal(0, 0.02, rough.shape)
clear = np.clip(cm * 1.0 + tm * 0.35 - chm * 0.35, 0, 1)
# glTF metallicRoughness: G = roughness, B = metalness; clearcoat factor read from R
top_mr = to_img(np.dstack([clear * 255, rough * 255, np.zeros_like(rough)]))

# bottom / sides: fried dough. u wraps around the ring, v runs hole equator (0) -> underside -> outer equator (1)
BW, BH = 1024, 256
edge_out = base[(rn > 0.93) & (rn < 0.99) & solid & dough].mean(0) if ((rn > 0.93) & (rn < 0.99) & solid & dough).any() else np.array([240, 185, 92])
edge_in = base[(rn > 0.0) & (rn < 0.05) & solid & dough].mean(0) if ((rn > 0.0) & (rn < 0.05) & solid & dough).any() else edge_out
print('edge colours', edge_out.round(), edge_in.round())
# the glazed cap (photo) spans the top from PSA above the outer equator to PSB above the hole's; dough covers the rest
PSA, PSB = 0.5, 0.55
def bot_psi(t): return (math.pi - PSB) + t * (math.pi + PSA + PSB)
v = np.linspace(0, 1, BH)[:, None]
pale = np.array([246, 226, 182.0]); deep = np.array([196, 120, 52.0]); mid = np.array([222, 156, 72.0])
def lerp(a, b, t): return a + (b - a) * min(1, max(0, t))
col = np.zeros((BH, 1, 3))
for i, t in enumerate(v[:, 0]):
    ps = bot_psi(t)
    if ps < math.pi + 0.35: c = lerp(edge_in, mid, (ps - (math.pi - PSB)) / (PSB + 0.35))       # hole side
    elif ps < 1.5 * math.pi: c = lerp(mid, deep, (ps - math.pi - 0.35) / (0.5 * math.pi - 0.35))   # flat fried base
    elif ps < 2 * math.pi - 0.42: c = lerp(deep, mid, (ps - 1.5 * math.pi) / (0.5 * math.pi - 0.42))
    elif ps < 2 * math.pi - 0.22: c = lerp(mid, pale, (ps - 2 * math.pi + 0.42) / 0.2)              # the pale fry line round the middle
    elif ps < 2 * math.pi + 0.1: c = pale
    else: c = lerp(pale, edge_out, (ps - 2 * math.pi - 0.1) / (PSA - 0.1))
    col[i, 0] = c
def tile_noise(w, h, scale, seed):
    r = np.random.default_rng(seed).normal(0, 1, (h // scale + 1, w // scale))
    img = Image.fromarray(((r - r.min()) / (np.ptp(r) + 1e-6) * 255).astype(np.uint8)).resize((w, h + scale), Image.BICUBIC)
    return np.asarray(img).astype(np.float32)[:h] / 255 - 0.5
n1 = tile_noise(BW, BH, 32, 1); n2 = tile_noise(BW, BH, 8, 2); n3 = tile_noise(BW, BH, 2, 3)
# pores: small dark specks
pores = (np.random.default_rng(4).random((BH, BW)) > 0.985).astype(np.float32)
pores = blurf(pores, 0.8)
shade = 1 + 0.10 * n1 + 0.06 * n2 + 0.035 * n3 - 0.35 * pores
bot_col = to_img(col * shade[..., None])
bh = 0.5 + 0.6 * n1 + 0.35 * n2 + 0.2 * n3 - 0.8 * pores
# keep the wrap seam continuous
bh = np.concatenate([bh, bh[:, :1]], 1)[:, :BW]
bot_nrm = to_img(normal_map(bh, 2.2))
bot_mr = to_img(np.dstack([np.zeros((BH, BW)), np.full((BH, BW), 0.88 * 255) + n2 * 20, np.zeros((BH, BW))]))

# ---------------- geometry ----------------
NU, NT, NB = 300, 64, 40                        # around, over the top (outer->hole), under the bottom (hole->outer)
BT, BB = 0.315, 0.235                           # half-heights above / below the widest line
PT, PB = 2.25, 3.3                              # superellipse exponents: rounded dome, flatter fried base
def sx(c, p): return np.sign(c) * np.abs(c) ** (2 / p)
ro_u = np.interp(np.linspace(0, len(ro), NU + 1) % len(ro), np.arange(len(ro) + 1), np.concatenate([ro, ro[:1]])) / Rs
ri_u = np.interp(np.linspace(0, len(ri), NU + 1) % len(ri), np.arange(len(ri) + 1), np.concatenate([ri, ri[:1]])) / Rs
phi = np.linspace(0, 2 * math.pi, NU + 1)
psi_t = np.linspace(PSA, math.pi - PSB, NT + 1)  # 0 = outer equator, pi/2 = crown, pi = hole equator
psi_b = np.linspace(math.pi - PSB, 2 * math.pi + PSA, NB + 1)
psi = np.concatenate([psi_t, psi_b[1:]])         # full ring, last row == outer equator again (dup of row 0)
lump = 0.012 * np.sin(3 * phi + 0.7)[:, None] + 0.006 * np.sin(5 * phi + 2.1)[:, None] + 0.002 * np.sin(9 * phi + 0.3)[:, None]

def bilinear(img, u, v):
    h, w = img.shape
    x = np.clip(u * (w - 1), 0, w - 1); y = np.clip(v * (h - 1), 0, h - 1)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); x1 = np.minimum(x0 + 1, w - 1); y1 = np.minimum(y0 + 1, h - 1)
    fx = x - x0; fy = y - y0
    return (img[y0, x0] * (1 - fx) + img[y0, x1] * fx) * (1 - fy) + (img[y1, x0] * (1 - fx) + img[y1, x1] * fx) * fy

P = np.zeros((NU + 1, len(psi), 3)); UVt = np.zeros((NU + 1, len(psi), 2))
Rc = (ro_u + ri_u) / 2; a = (ro_u - ri_u) / 2
def ring_r(ps):
    c, s = math.cos(ps), math.sin(ps); p = PT if s >= 0 else PB
    return Rc + a * sx(c, p) + lump[:, 0] * (1 + 0.5 * c)
cap_out, cap_in = ring_r(PSA), ring_r(math.pi - PSB)
for j, ps in enumerate(psi):
    c, s = math.cos(ps), math.sin(ps)
    up = s >= 0
    p = PT if up else PB
    hor = sx(c, p); ver = sx(s, p) * (BT if up else BB)
    r = ring_r(ps)
    y = ver + 0.05 + (lump[:, 0] * 0.6 if up else lump[:, 0] * 0.2)
    # photo coords: seen from straight above, with the cap stretched slightly so the photo's edges meet the dough
    q = np.clip((r - cap_in) / (cap_out - cap_in), 0, 1)
    rph = ri_u + q * (ro_u - ri_u)
    pxp = cx + rph * Rs * np.cos(phi); pyp = cy + rph * Rs * np.sin(phi)
    u_, v_ = pxp / S, pyp / S
    if up:
        w = max(0.0, s) ** 0.6
        y = y + bilinear(height_s, u_, v_) * 0.034 * w
    P[:, j, 0] = r * np.cos(phi); P[:, j, 2] = -r * np.sin(phi); P[:, j, 1] = y
    UVt[:, j, 0] = u_; UVt[:, j, 1] = v_
# shared seam: make last phi column identical to the first
P[-1] = P[0]

# normals on the closed grid (wrap in both directions)
G = P[:-1, :-1]                                    # unique verts: NU x (len(psi)-1)
du = np.roll(G, -1, 0) - np.roll(G, 1, 0)
dv = np.roll(G, -1, 1) - np.roll(G, 1, 1)
Nn = np.cross(dv, du)
Nn /= np.linalg.norm(Nn, axis=2, keepdims=True)
# make sure they point outward (top crown normal should be +Y)
if Nn[0, NT // 2, 1] < 0: Nn = -Nn
Nfull = np.zeros_like(P); Nfull[:-1, :-1] = Nn; Nfull[-1, :-1] = Nn[0]; Nfull[:, -1] = Nfull[:, 0]

def quant_prims():
    prims = []
    for rows, uvmode in [(range(0, NT + 1), 'top'), (range(NT, len(psi)), 'bot')]:
        rows = list(rows)
        pos = P[:, rows].reshape(-1, 3); nrm = Nfull[:, rows].reshape(-1, 3)
        if uvmode == 'top':
            uv = UVt[:, rows].reshape(-1, 2)
        else:
            uu = np.repeat((phi / (2 * math.pi) * 3)[:, None], len(rows), 1)       # texture wraps 3x round the ring
            vv = np.repeat(((psi[rows] - (math.pi - PSB)) / (math.pi + PSA + PSB))[None, :], NU + 1, 0)
            uv = np.dstack([uu, vv]).reshape(-1, 2)
        nr = len(rows); idx = []
        for i in range(NU):
            for j in range(nr - 1):
                a = i * nr + j; b = (i + 1) * nr + j
                idx += [a, a + 1, b, b, a + 1, b + 1]
        prims.append((pos, nrm, uv, np.array(idx, np.uint16), uvmode))
    return prims
prims = quant_prims()
# winding check: first triangle's geometric normal vs vertex normal
pos, nrm, uv, idx, _ = prims[0]
tri = pos[idx[:3]]; gn = np.cross(tri[1] - tri[0], tri[2] - tri[0])
flip = np.dot(gn, nrm[idx[0]]) < 0
if flip:
    prims = [(p, n, u, i.reshape(-1, 3)[:, [0, 2, 1]].reshape(-1).astype(np.uint16), m) for p, n, u, i, m in prims]
print('verts', sum(len(p[0]) for p in prims), 'tris', sum(len(p[3]) // 3 for p in prims), 'flipped', flip)

ext = np.abs(np.concatenate([p[0] for p in prims])).max() * 1.001
QS = 32767 / ext

# ---------------- GLB writer ----------------
bin_ = bytearray(); views = []; accessors = []
def pad4():
    while len(bin_) % 4: bin_.append(0)
def add_view(data, stride=None, target=None):
    pad4(); off = len(bin_); bin_.extend(data)
    v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
    if stride: v['byteStride'] = stride
    if target: v['target'] = target
    views.append(v); return len(views) - 1
def add_acc(view, ctype, count, typ, normalized=False, mn=None, mx=None):
    a = {'bufferView': view, 'componentType': ctype, 'count': count, 'type': typ}
    if normalized: a['normalized'] = True
    if mn is not None: a['min'] = mn; a['max'] = mx
    accessors.append(a); return len(accessors) - 1
def jpg(img, q):
    b = io.BytesIO(); img.convert('RGB').save(b, 'JPEG', quality=q, optimize=True, subsampling=0 if q >= 90 else 2); return b.getvalue()
images = []
for im, q in [(top_col, 88), (top_nrm, 86), (top_mr, 85), (bot_col, 85), (bot_nrm, 88), (bot_mr, 80)]:
    images.append({'bufferView': add_view(jpg(im, q)), 'mimeType': 'image/jpeg'})
mesh_prims = []
for k, (pos, nrm, uv, idx, mode) in enumerate(prims):
    n = len(pos)
    qp = np.zeros((n, 4), np.int16); qp[:, :3] = np.round(pos * QS).astype(np.int16)
    qn = np.zeros((n, 4), np.int8); qn[:, :3] = np.round(nrm / np.linalg.norm(nrm, axis=1, keepdims=True) * 127).astype(np.int8)
    if mode == 'top': qu = np.round(np.clip(uv, 0, 1) * 65535).astype(np.uint16)
    else: qu = np.round(np.clip(uv / np.array([3, 1]), 0, 1) * 65535).astype(np.uint16)
    pa = add_acc(add_view(qp.tobytes(), 8, 34962), 5122, n, 'VEC3', mn=qp[:, :3].min(0).tolist(), mx=qp[:, :3].max(0).tolist())
    na = add_acc(add_view(qn.tobytes(), 4, 34962), 5120, n, 'VEC3', normalized=True)
    ua = add_acc(add_view(qu.tobytes(), 4, 34962), 5123, n, 'VEC2', normalized=True)
    ia = add_acc(add_view(idx.tobytes(), None, 34963), 5123, len(idx), 'SCALAR')
    prim = {'attributes': {'POSITION': pa, 'NORMAL': na, 'TEXCOORD_0': ua}, 'indices': ia, 'material': k}
    mesh_prims.append(prim)
# bottom uv is stored 0..1 and scaled 3x round the ring by a texture transform-free trick: we bake the 3x into the sampler via KHR_texture_transform
gltf = {
    'asset': {'version': '2.0', 'generator': "Homie's Donuts pistachio donut builder"},
    'extensionsUsed': ['KHR_mesh_quantization', 'KHR_materials_clearcoat', 'KHR_texture_transform'],
    'extensionsRequired': ['KHR_mesh_quantization'],
    'scene': 0, 'scenes': [{'nodes': [0]}],
    'nodes': [{'name': 'PistachioDonut', 'mesh': 0, 'scale': [1 / QS] * 3}],
    'meshes': [{'name': 'PistachioDonut', 'primitives': mesh_prims}],
    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071},
                 {'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 33071}],
    'images': images,
    'textures': [{'sampler': 0, 'source': 0}, {'sampler': 0, 'source': 1}, {'sampler': 0, 'source': 2},
                 {'sampler': 1, 'source': 3}, {'sampler': 1, 'source': 4}, {'sampler': 1, 'source': 5}],
    'materials': [
        {'name': 'GlazeTop',
         'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0,
                                  'metallicRoughnessTexture': {'index': 2}},
         'normalTexture': {'index': 1, 'scale': 1.0},
         'extensions': {'KHR_materials_clearcoat': {'clearcoatFactor': 0.55, 'clearcoatTexture': {'index': 2},
                                                    'clearcoatRoughnessFactor': 0.22}}},
        {'name': 'FriedDough',
         'pbrMetallicRoughness': {'baseColorTexture': {'index': 3, 'extensions': {'KHR_texture_transform': {'scale': [3, 1]}}},
                                  'metallicFactor': 0.0, 'roughnessFactor': 1.0,
                                  'metallicRoughnessTexture': {'index': 5, 'extensions': {'KHR_texture_transform': {'scale': [3, 1]}}}},
         'normalTexture': {'index': 4, 'scale': 0.8, 'extensions': {'KHR_texture_transform': {'scale': [3, 1]}}}}
    ],
    'accessors': accessors, 'bufferViews': views, 'buffers': [{'byteLength': 0}]
}
pad4(); gltf['buffers'][0]['byteLength'] = len(bin_)
js = json.dumps(gltf, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_))
glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
open(out, 'wb').write(glb)
print('glb bytes', len(glb))
# physics proxy numbers (model units, outer radius 1)
print('PROXY', json.dumps({'ro': float(ro_u.mean()), 'ri': float(ri_u.mean()), 'bt': BT, 'bb': BB, 'yoff': 0.05,
                           'top': float(P[:, :, 1].max()), 'bottom': float(P[:, :, 1].min())}))
if prev:
    top_col.save(prev + '/top_col.png'); top_nrm.save(prev + '/top_nrm.png'); top_mr.save(prev + '/top_mr.png')
    bot_col.save(prev + '/bot_col.png'); bot_nrm.save(prev + '/bot_nrm.png')
    to_img(height / 1.4 * 255).save(prev + '/height.png')
    dbg = base.copy(); dbg[dough & solid] = [0, 120, 255]; dbg[choc] = dbg[choc] * 0.5; to_img(dbg).save(prev + '/classes.png')
