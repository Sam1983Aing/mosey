// The rest of Mosey's home, at its own scale (he is 1.15 tall here, so 1 unit is about 12 cm).
// home-kit.js built a living room and a kitchen end. This file makes it a flat you walk into through its front door and out of through its back door:
// a floor under every room, walls 14 high with doorways and windows, ceilings, the walls you see from outside, and three rooms that were not there before:
// a hall (the front door, a doormat, boots, umbrellas, the dock), a bedroom (the bed from below, curtains, a rug, slippers) and a bath (the side of a tub, a mat, tiles, a duck).
// The way through it: front door, hall, living room, bedroom, bath, kitchen, back door. The kitchen is mapped last, and the stove is the last thing he checks.
// From 14 cm up the picture is mostly floor, the bottom of walls and the sides of furniture, so those surfaces carry it. They are photos of real materials
// (media/home, put in by home-kit's onPhoto once they have loaded), with the grout, the gaps and the edges drawn here so they are exact.
// The light is the page's own sun. Walls and ceilings cast shadows now, so it only comes in through the windows and the open doors, as it does in a room.
//   addRooms(kit)  ->  { rooms, tour, exit, pins, looks, doors, dockAt }      kit is home-kit's own toolbox, handed over as one object. Everything is in the home's own coordinates (x 0 is the front door).
export function addRooms(kit) {
  const { THREE, PAL, V3, V2, PI, hash, rr, canvas, texOf, again, paint, normalFrom, strokes, smooth, softBox, sheet, lathe, cord, put, add, merge, mergeTinted, tint, boxUV, cloth, wood, brass, steel, sit, cloths, tinted, brassG, weaveN, knitN, softRectT, paperM, glossM, tileWallM, slipper, onPhoto, photoTex, photoRelief, swap } = kit;
  const H = 14, DH = 10.4, WX = -11.6;      // how high the walls stand, how high a doorway is, the face of the left wall
  const ROOMS = [      // in the order he maps them
    { key: 'hall', name: 'Hall', area: 6, x0: -6.5, x1: 6.5, z0: -19.15, z1: -6.5, entry: [0, -6.5] },
    { key: 'living', name: 'Living room', area: 24, x0: WX - 0.6, x1: 10, z0: -45.5, z1: -19.15, entry: [0, -19.3] },
    { key: 'bedroom', name: 'Bedroom', area: 14, x0: 10, x1: 33, z0: -40.3, z1: -19.0, entry: [10, -37.7] },
    { key: 'bath', name: 'Bath', area: 7, x0: 10, x1: 27, z0: -57.5, z1: -40.3, entry: [22, -40.3] },
    { key: 'kitchen', name: 'Kitchen', area: 11, x0: WX - 0.6, x1: 10, z0: -53.7, z1: -45.5, entry: [0, -19.3] },      // one open space with the living room: its light is measured from the living room's doorway, so it is lit as the living room's light gets there
  ];
  const [HALL, LIV, BED, BATH, KIT] = ROOMS;
  const DOOR = { front: [-2.6, 2.6], hallLiv: [-2.4, 2.4], livBed: [-39.8, -35.6], bedBath: [19.9, 24.1], bathKit: [-45.2, -41.0], back: [-1.7, 2.7] };
  const WIN = { living: [-27.0, -21.5, 5.2, 11.6], kitchen: [-51.6, -47.2, 5.2, 11.6], bedroom: [15.6, 28.4, 8.6, 13.0], bath: [-52.5, -47.5, 7.0, 12.0], hall: [3.9, 6.1, 5.2, 9.8] };      // [from, to, sill, head]

  /* ---------- surfaces ---------- */
  // Each is first drawn (so the home is whole at once) and takes its photo when that has loaded.
  // Oak boards, drawn: eight planks to a tile, each its own shade, a dark seam between planks.
  const boards = (() => {
    const S = 512, c = canvas(S, S), k = c.getContext('2d'), h = canvas(S, S), kh = h.getContext('2d'), pw = S / 8;
    kh.fillStyle = '#fff'; kh.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) { const cut = Math.floor(hash(i, 3) * S);
      for (const [x0, x1, n] of [[0, cut, 0], [cut, S, 1]]) { const l = 0.86 + 0.2 * hash(i * 7 + n, 11); k.fillStyle = `rgb(${196 * l | 0},${150 * l | 0},${98 * l | 0})`; k.fillRect(x0, i * pw, x1 - x0, pw); }
      kh.fillStyle = '#000'; kh.fillRect(0, i * pw - 1, S, 2); kh.fillRect(cut - 1, i * pw, 2, pw); }
    k.globalCompositeOperation = 'multiply'; k.globalAlpha = 0.6; k.drawImage(h, 0, 0); k.globalCompositeOperation = 'source-over'; k.globalAlpha = 1;
    return { map: texOf(c), normalMap: texOf(normalFrom(h, 1.6), { srgb: false }) };
  })();
  // Tiles: n by n to a picture. The grout, the bevel at each edge and the roughness (grout matt, glaze not) are drawn. The face of each tile is a flat colour
  // until the photo comes: then every tile gets its own piece of the photo, turned or mirrored, so no two tiles are alike.
  const tiles = (n, cols, grout, { gap = 0.035, gloss = 0.3, photo = null, tintK = 1, bevel = false } = {}) => {
    const S = 1024, c = canvas(S, S), k = c.getContext('2d'), q = S / n, rgb = (hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16));
    const face = (im) => { k.fillStyle = grout; k.fillRect(0, 0, S, S);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const col = cols[(i + j) % cols.length], [r, g, b] = rgb(col), l = 0.95 + 0.07 * hash(i * 3 + n, j * 5), x = i * q + q * gap, y = j * q + q * gap, w = q * (1 - 2 * gap);
        k.save(); k.beginPath(); k.roundRect(x, y, w, w, q * 0.03); k.clip();
        if (im) { const sw = im.width / 2.2, sx = hash(i + 7, j) * (im.width - sw), sy = hash(i, j + 9) * (im.height - sw); k.translate(x + w / 2, y + w / 2); k.rotate(Math.floor(hash(i * 5, j * 3) * 4) * PI / 2); k.drawImage(im, sx, sy, sw, sw, -w / 2, -w / 2, w, w); k.setTransform(1, 0, 0, 1, 0, 0);
          k.globalCompositeOperation = 'multiply'; k.globalAlpha = tintK; k.fillStyle = `rgb(${Math.min(255, r * l) | 0},${Math.min(255, g * l) | 0},${Math.min(255, b * l) | 0})`; k.fillRect(x, y, w, w); k.globalCompositeOperation = 'source-over'; k.globalAlpha = 1; }
        else { k.fillStyle = `rgb(${r * l | 0},${g * l | 0},${b * l | 0})`; k.fillRect(x, y, w, w); }
        if (bevel) { k.strokeStyle = 'rgba(58,46,32,0.2)'; k.lineWidth = q * 0.03; k.strokeRect(x, y, w, w); k.strokeStyle = 'rgba(40,30,20,0.3)'; k.lineWidth = q * 0.01; k.strokeRect(x, y, w, w); }      // the edge of a tile is ground to a small bevel: it turns away from the light, so it is a shade darker
        k.restore(); }
      if (bevel) { k.strokeStyle = 'rgba(30,24,18,0.38)'; k.lineWidth = Math.max(1.5, q * gap * 0.8); for (let i = 0; i <= n; i++) { k.beginPath(); k.moveTo(i * q, 0); k.lineTo(i * q, S); k.moveTo(0, i * q); k.lineTo(S, i * q); k.stroke(); } } };      // and the grout lies lower than the tiles: dark down its middle
    face(null); const map = texOf(c), edge = (x, y) => { const fx = (x % (512 / n)) / (512 / n), fy = (y % (512 / n)) / (512 / n); return Math.min(fx, 1 - fx, fy, 1 - fy); };
    const out = { map, normalMap: texOf(normalFrom(paint(512, 512, bevel ? (x, y) => { const e = edge(x, y); return e < gap * 0.8 ? 0 : 0.7 * smooth(e, gap * 0.8, gap * 1.7) + 0.3 * smooth(e, gap * 1.7, gap * 5.5); } : (x, y) => smooth(edge(x, y), gap * 0.5, gap * 2.2)), bevel ? 4.5 : 3), { srgb: false }), roughnessMap: texOf(paint(256, 256, (x, y) => (edge(x * 2, y * 2) < gap ? 0.95 : gloss)), { srgb: false }) };
    if (photo) onPhoto(photo, (im) => { face(im); map.needsUpdate = true; });
    return out;
  };
  // Painted plaster, drawn: nearly even, with the marks a roller leaves. The photo (a trowelled plaster) goes in large and faint, mostly as relief.
  const plasterC = (() => { const c = canvas(256, 256), k = c.getContext('2d'); k.fillStyle = '#f4f2ee'; k.fillRect(0, 0, 256, 256);
    strokes(c, 500, (k, x, y, s, t) => { k.fillStyle = s > 0.5 ? `rgba(255,255,255,${0.05 + t * 0.08})` : `rgba(120,110,95,${0.03 + t * 0.05})`; k.fillRect(x, y, 3 + s * 22, 1 + t * 2); });
    strokes(c, 1500, (k, x, y, s, t) => { k.fillStyle = `rgba(${s > 0.5 ? '255,255,255' : '90,80,66'},${0.04 + t * 0.06})`; k.fillRect(x, y, 1, 1); }); return texOf(c); })();
  const shell = (m) => { m.userData.shell = true; return m; }, outside = (m) => { m.userData.ext = true; m.fog = false; return m; };      // the outside takes no haze: close up, the top of the house has to be as crisp and dark as the bottom
  const plaster = (color) => { const m = shell(new THREE.MeshStandardMaterial({ color, map: plasterC, bumpMap: plasterC, bumpScale: 0.5, roughness: 0.95 }));
    onPhoto('wall-paint', (im) => swap(m, { map: photoTex(im, { size: 512, wash: '#f6f3ec', washK: 0.86, rep: [0.46, 0.46] }), bumpMap: photoTex(im, { size: 512, rep: [0.46, 0.46], srgb: false }), bumpScale: 0.55 })); return m; };      // boxUV gives walls 0.5 a unit, so 0.46 of that is one photo to about 4.3 units of wall (half a metre): the fine stipple a roller leaves, not the blotches of a trowel
  const enamel = new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.14 });      // the tub and the toilet
  const rubber = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.3 });   // boots, the duck, the bowls
  const lacquer = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2b30', roughness: 0.45, metalness: 0.6 });
  const veneer = (color, rep = [0.5, 0.5], turn = 0) => { const m = wood(color); onPhoto('oak-veneer', (im) => { swap(m, { map: photoTex(im, { rep, turn }) }); m.color.set('#f3e2c6'); }); return m; };      // furniture wood: drawn grain first, the veneer photo when it is there
  const linen = (color, o = {}) => { const m = cloth(color, o); onPhoto('linen', (im) => swap(m, { map: photoTex(im, { size: 512, rep: [0.9, 0.9] }), normalMap: photoRelief(im, 1.8, [0.9, 0.9]) })); return m; };
  const off = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };      // the floors lie a hair above the page's own floor: this keeps the two from flickering far away
  paperM.userData.shell = glossM.userData.shell = tileWallM.userData.shell = true;

  /* ---------- floors and ceilings ---------- */
  const floor = (r, size, mat, turn = false) => { const w = r.x1 - r.x0, d = r.z1 - r.z0, g = new THREE.PlaneGeometry(w, d); g.rotateX(-PI / 2); put(g, (r.x0 + r.x1) / 2, 0.004, (r.z0 + r.z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (turn ? p.getZ(i) : p.getX(i)) / size, (turn ? p.getX(i) : p.getZ(i)) / size); add(g, shell(mat), { cast: false }); };
  const oak = new THREE.MeshStandardMaterial({ ...boards, normalScale: V2(0.7, 0.7), roughness: 0.5, envMapIntensity: 1.2, ...off });
  onPhoto('oak-floor', (im) => { swap(oak, { map: photoTex(im, { rep: [0.76, 0.76] }), normalMap: photoRelief(im, 2.2, [0.76, 0.76]) }); oak.normalScale.set(0.9, 0.9); });      // real planks, about ten to the picture: one picture to 10.5 units of floor
  const stone = new THREE.MeshStandardMaterial({ ...tiles(2, ['#e9dcc6', '#f1e6d2'], '#8d8474', { gap: 0.014, gloss: 0.78, photo: 'stone-tile', bevel: true }), roughness: 1, ...off });
  const checks = new THREE.MeshStandardMaterial({ ...tiles(4, ['#f3ead8', '#b9c7b5'], '#9a9486', { gloss: 0.6, photo: 'stone-tile' }), roughness: 1, ...off });
  floor(HALL, 5, stone); floor(KIT, 5, checks);                                                                                                // hall: big honed stone tiles. kitchen: small checks, cream and sage
  floor(LIV, 8, oak); floor(BED, 8, oak);                                                                                                      // living room and bedroom: oak boards
  floor(BATH, 3.2, new THREE.MeshStandardMaterial({ ...tiles(4, ['#f1efe8', '#e2e4dd'], '#8f9a97', { gloss: 0.4, photo: 'ceramic-glaze' }), roughness: 1, envMapIntensity: 1.2, ...off }));      // bath: small white tiles, glazed
  // The ceilings are slabs, a little thick, so they keep the sun out. Their undersides are what you see when he looks up. They stop just inside the outer face
  // of the outside walls: flush with it, slab and boards fought over the same dots and left a white band with hatch marks under the gable.
  add(merge(ROOMS.map((r) => put(new THREE.BoxGeometry(r.x1 - r.x0 + 0.6, 0.3, r.z1 - r.z0 + 0.6), (r.x0 + r.x1) / 2, H + 0.15, (r.z0 + r.z1) / 2))), shell(new THREE.MeshStandardMaterial({ color: '#f1eee7', roughness: 1 })), { receive: false });

  /* ---------- walls ---------- */
  // A wall is a thin box along x or along z. gaps are doorways, as [from, to] along its length: the wall stops there and a lintel closes it above the door.
  // wins are windows, as [from, to, sill, head]: wall below and above, a hole between, with a painted frame and a cross bar. side says on which side of the box
  // the room is (+1 or -1): skirting, casings and frames go there. Walls cast shadows, so daylight comes in only where there is a hole.
  const wallG = new Map(), trim = [], trim2 = [], shade = { p: [], c: [] };
  // The skirting, in section: [how far out from the wall, how high]. A flat board, a quirk, a bead, and a cove up to the wall.
  const skirtS = new THREE.Shape([[0, 0], [0.19, 0], [0.19, 0.61], [0.17, 0.66], [0.17, 0.7], [0.185, 0.73], [0.185, 0.79], [0.16, 0.83], [0.1, 0.9], [0.06, 0.99], [0.045, 1.04], [0, 1.04]].map(([d, y]) => V2(d, y)));
  const wall = (mat, axis, at, from, to, side, { gaps = [], wins = [], t = 0.3, uv = 0.5, skirt = true, casing = true } = {}) => {
    if (!wallG.has(mat)) wallG.set(mat, []); const list = wallG.get(mat);
    const box = (a, b, y0, y1) => { const len = b - a; if (len < 0.02 || y1 - y0 < 0.02) return; const g = boxUV(new THREE.BoxGeometry(axis === 'x' ? len : t, y1 - y0, axis === 'x' ? t : len), uv); list.push(axis === 'x' ? put(g, (a + b) / 2, (y0 + y1) / 2, at + t / 2) : put(g, at + t / 2, (y0 + y1) / 2, (a + b) / 2)); };
    const strip = (g, mid, y, o) => trim.push(axis === 'x' ? put(g, mid, y, at + t / 2 + o) : put(g.rotateY(PI / 2), at + t / 2 + o, y, mid));
    const holes = [...gaps.map(([a, b]) => [a, b, 0, DH, true]), ...wins.map(([a, b, y0, y1]) => [a, b, y0, y1, false])].sort((p, q) => p[0] - q[0]).concat([[to, to, 0, 0, true]]);
    let a = from; const face = side * (t / 2 + 0.08), fy = side * (t / 2);
    for (const [g0, g1, y0, y1, door] of holes) {
      box(a, g0, 0, H);
      if (skirt && g0 - a > 0.3) { const sk = new THREE.ExtrudeGeometry(skirtS, { depth: g0 - a, bevelEnabled: false }).translate(0, 0, -(g0 - a) / 2).rotateY(side > 0 ? -PI / 2 : PI / 2); strip(sk, (a + g0) / 2, 0, fy); }
      if (g0 - a > 0.3) { const P = (u, y, d) => (axis === 'x' ? [u, y, at + t / 2 + fy + side * d] : [at + t / 2 + fy + side * d, y, u]), quad = (r0, r1) => { for (const [u, [y, d, al]] of [[a, r0], [g0, r0], [g0, r1], [a, r0], [g0, r1], [a, r1]]) { shade.p.push(...P(u, y, d)); shade.c.push(1, 1, 1, al); } };
        if (skirt) { quad([0.655, 0.2, 0], [0.685, 0.176, 0.5]); quad([0.685, 0.176, 0.5], [0.72, 0.172, 0]); }      // the line of shadow in the quirk under the skirting's bead
        if (casing) { quad([0.018, 0.02, 0.34], [0.018, 0.55, 0.12]); quad([0.018, 0.55, 0.12], [0.018, 1.9, 0]); quad([1.0, 0.012, 0.16], [2.4, 0.012, 0]); } }      // the soft dark where this wall meets the floor: on the floor in front of it, and up the wall above the skirting
      if (g1 > g0) { box(g0, g1, y1, H); if (!door) box(g0, g1, 0, y0);
        if (casing) { for (const e of [g0, g1]) strip(softBox(0.42, y1 - y0 + 0.2, t + 0.22, { r: 0.05, c: 2, flat: 1 }), e, (y0 + y1 + 0.2) / 2, 0);                  // the casing: two jambs and a head
          strip(softBox(g1 - g0 + 0.84, 0.46, t + 0.22, { r: 0.05, c: 2, flat: 1 }), (g0 + g1) / 2, y1 + 0.2, 0);
          if (!door) { strip(softBox(g1 - g0 + 1.0, 0.3, t + 0.7, { r: 0.08, c: 2, flat: 1 }), (g0 + g1) / 2, y0 - 0.1, side * 0.2);                                 // a window: a sill, one upright bar and one across
            strip(softBox(0.16, y1 - y0, 0.16, { r: 0.03, c: 1, flat: 1 }), (g0 + g1) / 2, (y0 + y1) / 2, 0); strip(softBox(g1 - g0, 0.16, 0.16, { r: 0.03, c: 1, flat: 1 }), (g0 + g1) / 2, y0 + (y1 - y0) * 0.58, 0); } } }
      a = g1;
    }
  };
  // The outside, drawn: dark charred boards standing upright, each its own shade of near black, a groove between them. The photo of real charred timber takes its place when it has loaded.
  const timber = (() => { const S = 256, c = canvas(S, S), k = c.getContext('2d'), h = canvas(S, S), kh = h.getContext('2d'), bw = S / 8; kh.fillStyle = '#fff'; kh.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) { const l = 0.8 + 0.4 * hash(i * 3, 17); k.fillStyle = `rgb(${46 * l | 0},${41 * l | 0},${38 * l | 0})`; k.fillRect(i * bw, 0, bw, S); kh.fillStyle = '#000'; kh.fillRect(i * bw - 1.5, 0, 3, S);
      for (let n = 0; n < 26; n++) { const x = i * bw + 2 + hash(i, n) * (bw - 4), a = 0.05 + 0.1 * hash(n, i + 5); k.fillStyle = hash(n, i) > 0.5 ? `rgba(0,0,0,${a})` : `rgba(120,108,96,${a})`; k.fillRect(x, 0, 1, S); kh.fillStyle = `rgba(0,0,0,${a * 2})`; kh.fillRect(x, 0, 1, S); } }      // the grain runs up the board
    k.globalCompositeOperation = 'multiply'; k.globalAlpha = 0.7; k.drawImage(h, 0, 0); k.globalCompositeOperation = 'source-over'; k.globalAlpha = 1;
    return { map: texOf(c, { rep: [0.35, 0.35] }), bumpMap: texOf(h, { srgb: false, rep: [0.35, 0.35] }) }; })();
  const hallM = plaster('#aebcae'), kitM = plaster('#e9e2d2'), bedM = plaster('#b4c4d0'), extM = outside(new THREE.MeshStandardMaterial({ ...timber, bumpScale: 1.6, roughness: 0.86 }));
  onPhoto('facade-timber', (im) => { const map = photoTex(im, { rep: [0.35, 0.35] }), bump = photoTex(im, { size: 512, rep: [0.35, 0.35], srgb: false }); map.anisotropy = bump.anisotropy = 16; swap(extM, { map, bumpMap: bump, bumpScale: 2.2 }); });
  // The photo is 1024 dots to 5.7 units of wall, which is soft once the camera stands at the door. So a fine grain is laid over it: long thin streaks, eleven times
  // finer than the photo, that only darken or lighten it a little. They are what the eye takes for sharpness.
  { const S2 = 256, c = canvas(S2, S2), k = c.getContext('2d'); k.fillStyle = 'rgb(128,128,128)'; k.fillRect(0, 0, S2, S2);
    for (let i = 0; i < 2600; i++) { const x = hash(i, 3) * S2, y = hash(i, 7) * S2, l = 10 + hash(i, 11) * 70, v = hash(i, 13) > 0.5 ? 255 : 0; k.fillStyle = `rgba(${v},${v},${v},${0.05 + 0.13 * hash(i, 17)})`; k.fillRect(x, y, 1, l); k.fillRect(x, y - S2, 1, l); }
    const grainT = texOf(c, { srgb: false }); grainT.anisotropy = 16; timber.map.anisotropy = timber.bumpMap.anisotropy = 16;
    extM.onBeforeCompile = (sh) => { sh.uniforms.uFine = { value: grainT }; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uFine;').replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n diffuseColor.rgb *= 0.8 + 0.4 * texture2D(uFine, vMapUv * vec2(11.0, 3.0)).g;\n#endif'); };
    extM.customProgramCacheKey = () => 'timber-fine'; }      // boxUV gives walls 0.5 a unit, so 0.35 of that is one photo (eight boards, about a metre) to 5.7 units of wall
  const bathT = shell(new THREE.MeshStandardMaterial({ ...tiles(4, ['#6fa9a0', '#7bb3aa', '#69a39b'], '#dfe7e2', { gloss: 0.34, photo: 'ceramic-glaze' }), roughness: 1, envMapIntensity: 1.0 }));      // sea-green handmade tiles, so the white tub stands out against them
  // living room and kitchen: the old wall on the left, now with a window in each room, the wall you come in through, the wall to the bedroom, the tiled wall behind the stove (the bath's door is in it)
  wall(paperM, 'z', WX - 0.4, -53.7, -19.15, 1, { wins: [WIN.living, WIN.kitchen], t: 0.4, skirt: false });
  wall(paperM, 'x', -19.45, WX, 10, -1, { gaps: [DOOR.hallLiv] }); wall(paperM, 'z', 9.7, -40.3, -19.15, -1, { gaps: [DOOR.livBed] });
  wall(tileWallM, 'z', 9.75, -53.7, -40.3, -1, { gaps: [DOOR.bathKit], t: 0.4, uv: 0.2, skirt: false });
  wall(kitM, 'x', -53.7, WX, 9.75, 1, { gaps: [DOOR.back] });
  // hall
  wall(hallM, 'x', -6.8, HALL.x0, HALL.x1, -1, { gaps: [DOOR.front], wins: [WIN.hall] }); wall(hallM, 'x', -19.15, HALL.x0, HALL.x1, 1, { gaps: [DOOR.hallLiv] });
  wall(hallM, 'z', HALL.x0, -18.85, -6.8, 1); wall(hallM, 'z', HALL.x1 - 0.3, -18.85, -6.8, -1);
  // bedroom
  wall(bedM, 'z', 10, -40.0, -19.3, 1, { gaps: [DOOR.livBed] }); wall(bedM, 'x', -19.3, 10, BED.x1, -1, { wins: [WIN.bedroom] }); wall(bedM, 'z', BED.x1 - 0.3, -40.0, -19.3, -1); wall(bedM, 'x', -40.3, 10.3, BED.x1 - 0.3, 1, { gaps: [DOOR.bedBath] });
  // bath: tiled to the ceiling, no skirting
  wall(bathT, 'x', -40.6, 10, BATH.x1, -1, { gaps: [DOOR.bedBath], uv: 0.16, skirt: false }); wall(bathT, 'z', 10, -57.2, -40.6, 1, { gaps: [DOOR.bathKit], uv: 0.16, skirt: false });
  wall(bathT, 'z', BATH.x1 - 0.3, -57.2, -40.6, -1, { wins: [WIN.bath], uv: 0.16, skirt: false }); wall(bathT, 'x', -57.5, 10, BATH.x1, 1, { uv: 0.16, skirt: false });
  // The outside: one skin of dark charred timber round the whole flat, with the same doors and windows in it. out says which way is outside (+1 or -1 along
  // the other axis). Along the foot of every outside wall runs a course of pale stone, a hand proud of the boards.
  const E = 0.35, extBase = [], extTrim = [], extTrimDark = [], extGlow = [], extWood = [];
  // The wire cage of the outside, for the scan that brings the house into being (js/home-kit.js draws it): the lines a draughtsman would give it. Every wall's outline,
  // its doors and windows with their bars, the board edges, the gables, each roof's ridge, eaves and seams. A wire is a thin ribbon lying in the face it belongs to,
  // not a GL line, so it has a real width in the world. An edge is two ribbons crossed, so it reads from any side. k is how strong the wire is (boards and seams are faint).
  const cage = { p: [], k: [] }, _d = V3(), _s = V3(), _n = V3();
  const rib = (a, b, n, k, w) => { _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (_d.lengthSq() < 1e-5) return; _s.set(n[0], n[1], n[2]).cross(_d).normalize().multiplyScalar(w / 2);
    for (const [q, sg] of [[a, -1], [b, -1], [b, 1], [a, -1], [b, 1], [a, 1]]) { cage.p.push(q[0] + _s.x * sg, q[1] + _s.y * sg, q[2] + _s.z * sg); cage.k.push(k); } };
  const wire = (a, b, n, k = 1, w = 0.085) => rib(a, b, n, k, w);
  const edge = (a, b, n, k = 1, w = 0.085) => { rib(a, b, n, k, w); _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _n.set(n[0], n[1], n[2]).cross(_d).normalize(); rib(a, b, [_n.x, _n.y, _n.z], k, w); };
  const BOARD = 0.714;      // one board of the timber outside
  const cageWall = (axis, at, from, to, out, o) => { const f = at + (out > 0 ? E + 0.05 : -0.05), P = (u, y) => (axis === 'x' ? [u, y, f] : [f, y, u]), n = axis === 'x' ? [0, 0, 1] : [1, 0, 0];
    const holes = [...(o.gaps || []).map(([a, b]) => [a, b, 0, DH, true]), ...(o.wins || []).map(([a, b, y0, y1]) => [a, b, y0, y1, false])];
    wire(P(from, H), P(to, H), n); edge(P(from, 0), P(from, H), n); edge(P(to, 0), P(to, H), n);
    { let a = from; for (const [g0, g1] of [...holes.filter((h) => h[4]).sort((p, q) => p[0] - q[0]), [to, to]]) { wire(P(a, 0.03), P(g0, 0.03), n); wire(P(a, 1.2), P(g0, 1.2), n, 0.6, 0.055); a = g1; } }      // the foot of the wall and the top of its stone course
    for (const [a, b, y0, y1, door] of holes) { wire(P(a, y0), P(a, y1), n); wire(P(b, y0), P(b, y1), n); wire(P(a, y1), P(b, y1), n); if (!door) { wire(P(a, y0), P(b, y0), n);
      wire(P((a + b) / 2, y0), P((a + b) / 2, y1), n, 0.8, 0.06); wire(P(a, y0 + (y1 - y0) * 0.58), P(b, y0 + (y1 - y0) * 0.58), n, 0.8, 0.06); } }                                                  // a window: its frame and its two bars
    for (let u = Math.ceil((from + 0.2) / BOARD) * BOARD; u < to - 0.2; u += BOARD) { const h = holes.find(([a, b]) => u > a - 0.05 && u < b + 0.05);
      if (!h) wire(P(u, 1.2), P(u, H), n, 0.5, 0.042); else { if (h[2] > 1.3) wire(P(u, 1.2), P(u, h[2]), n, 0.5, 0.042); wire(P(u, h[3]), P(u, H), n, 0.5, 0.042); } } };
  const ext = (axis, at, from, to, out, o = {}) => { wall(extM, axis, at, from, to, 1, { t: E, skirt: false, casing: false, ...o }); cageWall(axis, at, from, to, out, o);
    { const len = to - from, g = boxUV(new THREE.BoxGeometry(axis === 'x' ? len : E, 0.3, axis === 'x' ? E : len), 0.5); wallG.get(extM).push(axis === 'x' ? put(g, (from + to) / 2, H + 0.15, at + E / 2) : put(g, at + E / 2, H + 0.15, (from + to) / 2)); }      // the boards run on up past the ceiling slab to the roof, so no slab edge shows
    let a = from; const face = at + (out > 0 ? E + 0.06 : -0.06);
    for (const [g0, g1] of [...(o.gaps || []), [to, to]]) { const len = g0 - a; if (len > 0.05) { const g = boxUV(new THREE.BoxGeometry(axis === 'x' ? len : 0.2, 1.2, axis === 'x' ? 0.2 : len), 0.5); extBase.push(axis === 'x' ? put(g, (a + g0) / 2, 0.6, face) : put(g, face, 0.6, (a + g0) / 2)); } a = g1; } };
  ext('x', -6.5, -6.85, 6.85, 1, { gaps: [DOOR.front], wins: [WIN.hall] }); ext('z', -6.85, -19.15, -6.5, -1); ext('z', 6.5, -19.0, -6.5, 1);
  ext('x', -19.15, WX - 0.75, -6.85, 1); ext('x', -19.0, 6.85, 33.35, 1, { wins: [WIN.bedroom] });
  ext('z', WX - 0.75, -54.05, -18.8, -1, { wins: [WIN.living, WIN.kitchen] }); ext('x', -54.05, WX - 0.75, 9.65, -1, { gaps: [DOOR.back] });
  ext('z', 33, -40.65, -18.65, 1); ext('x', -40.65, 27.35, 33.35, -1); ext('z', 27, -57.85, -40.65, 1, { wins: [WIN.bath] }); ext('x', -57.85, 9.65, 27.35, -1); ext('z', 9.65, -57.85, -54.05, -1);
  ext('z', WX - 0.75, -57.85, -54.05, -1);      // a wing wall beside the back door: with the bath's wall on the other side and the roof over it, the back door stands in a porch
  // The roof: three pitched roofs of dark standing-seam metal with eaves. One over the hall, its gable over the front door. One across the living room and the bedroom.
  // One across the kitchen and the bath, which comes forward over the back door. Each is two slabs leaning on a ridge. The gables under them are boarded like the walls.
  const TOP = H + 0.3, TAN = 0.625, PITCH = Math.atan(TAN), OH = 1.15, roofG = [], gableG = wallG.get(extM);
  // A slab covers the slope from the ridge down to the wall. The eaves, the strip that hangs out past the wall, are separate pieces and are only built where there is
  // open air under them: an eave drops below the top of the wall, and where two roofs meet it would hang down into the room under the other roof.
  const slabX = (zr, sg, yR, a, b, x0, x1) => roofG.push(put(boxUV(new THREE.BoxGeometry(x1 - x0, 0.3, (b - a) / Math.cos(PITCH)), 0.5), (x0 + x1) / 2, yR - (a + b) / 2 * TAN + 0.18, zr + sg * (a + b) / 2, sg * PITCH, 0, 0));
  const slabZ = (xr, sg, yR, a, b, z0, z1) => roofG.push(put(boxUV(new THREE.BoxGeometry(z1 - z0, 0.3, (b - a) / Math.cos(PITCH)), 0.5).rotateY(PI / 2), xr + sg * (a + b) / 2, yR - (a + b) / 2 * TAN + 0.18, (z0 + z1) / 2, 0, 0, -sg * PITCH));
  const SEAM = 1.54, LIFT = 0.42;      // the roof's standing seams, and how far above a slab's middle its top face is
  const lip = (g, x, y, z, rx, rz) => extTrimDark.push(put(g, x, y, z, rx, 0, rz));      // a slim dark board along an eave, so the roof ends in a clean line
  const roofX = (zr, half, x0, x1, front = [], back = []) => { const yR = TOP + half * TAN;      // ridge along x at z = zr, from x0 to x1. front and back: where along x each side has eaves
    for (const sg of [1, -1]) for (const [a, b] of (sg > 0 ? front : back)) lip(new THREE.BoxGeometry(b - a, 0.46, 0.12), (a + b) / 2, yR - (half + OH) * TAN + 0.16, zr + sg * (half + OH + 0.03), sg * PITCH, 0);
    edge([x0, yR + LIFT, zr], [x1, yR + LIFT, zr], [0, 1, 0]);
    for (const sg of [1, -1]) { const P = (x, s) => [x, yR - s * TAN + LIFT, zr + sg * s], n = [0, 1, sg * TAN]; edge(P(x0, half), P(x1, half), n); edge(P(x0, 0), P(x0, half), n); edge(P(x1, 0), P(x1, half), n);
      for (const [a, b] of (sg > 0 ? front : back)) { edge(P(a, half + OH), P(b, half + OH), n); wire(P(a, half), P(a, half + OH), n); wire(P(b, half), P(b, half + OH), n); }
      for (let x = x0 + SEAM; x < x1 - 0.3; x += SEAM) wire(P(x, 0), P(x, half), n, 0.5, 0.05); }
    for (const sg of [1, -1]) { slabX(zr, sg, yR, 0, half, x0, x1); for (const [a, b] of (sg > 0 ? front : back)) slabX(zr, sg, yR, half - 0.02, half + OH, a, b); } };
  const roofZ = (xr, half, z0, z1, e0, e1) => { const yR = TOP + half * TAN;      // ridge along z at x = xr, from z0 to z1. Eaves on both sides from e0 to e1
    for (const sg of [1, -1]) { lip(new THREE.BoxGeometry(0.12, 0.46, e1 - e0), xr + sg * (half + OH + 0.03), yR - (half + OH) * TAN + 0.16, (e0 + e1) / 2, 0, -sg * PITCH);
      const L = (half + OH) / Math.cos(PITCH); lip(new THREE.BoxGeometry(L, 0.46, 0.12), xr + sg * (half + OH) / 2, yR - (half + OH) / 2 * TAN + 0.16, z1 + 0.03, 0, -sg * PITCH); }      // and up the two slopes of the end that faces the front
    edge([xr, yR + LIFT, z0], [xr, yR + LIFT, z1], [0, 1, 0]);
    for (const sg of [1, -1]) { const P = (z, s) => [xr + sg * s, yR - s * TAN + LIFT, z], n = [sg * TAN, 1, 0]; edge(P(e0, half + OH), P(e1, half + OH), n); edge(P(z1, 0), P(z1, half + OH), n); edge(P(z0, 0), P(z0, half), n);
      for (let z = z1 - SEAM; z > z0 + 0.3; z -= SEAM) wire(P(z, 0), P(z, z > e0 ? half + OH : half), n, 0.5, 0.05); }
    for (const sg of [1, -1]) { slabZ(xr, sg, yR, 0, half, z0, z1); slabZ(xr, sg, yR, half - 0.02, half + OH, e0, e1); } };
  const gable = (axis, at, from, to, out) => { const rise = (to - from) / 2 * TAN, w = out > 0 ? E : 0, pos = [], nor = [], uv = [];      // the triangle of wall under a roof's end, on the outer face of the wall box that starts at `at`
    const HG = H + 0.3, P = (u, v) => (axis === 'x' ? [u, HG + v, at + w] : [at + w, HG + v, u]), n = axis === 'x' ? [0, 0, out] : [out, 0, 0], tri = [[from, 0], [to, 0], [(from + to) / 2, rise]];      // HG: a gable starts where the wall under it now ends
    const flip = (axis === 'x') !== (out > 0); for (const [u, v] of (flip ? [tri[0], tri[2], tri[1]] : tri)) { pos.push(...P(u, v)); nor.push(...n); uv.push(u * 0.5, (HG + v) * 0.5); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gableG.push(g);
    { const f = at + (out > 0 ? E + 0.05 : -0.05), C = (u, v) => (axis === 'x' ? [u, HG + v, f] : [f, HG + v, u]), cn = axis === 'x' ? [0, 0, 1] : [1, 0, 0], mid = (from + to) / 2;      // its wires: the two slopes, and the boards running on up to them
      edge(C(from, 0), C(mid, rise), cn); edge(C(to, 0), C(mid, rise), cn);
      for (let u = Math.ceil((from + 0.2) / BOARD) * BOARD; u < to - 0.2; u += BOARD) wire(C(u, 0), C(u, rise * (1 - Math.abs(u - mid) / ((to - from) / 2))), cn, 0.5, 0.042); } };
  roofZ(0, 6.85, -25.7, -4.9, -18.65, -4.9); gable('x', -6.5, -6.85, 6.85, 1);                                                   // the hall, and the gable over the front door
  roofX(-29.65, 11, WX - 0.75 - OH, 33.35 + OH, [[WX - 0.75 - OH, -8.0], [8.0, 33.35 + OH]], [[27.35 + OH, 33.35 + OH]]); gable('z', WX - 0.75, -40.65, -18.65, -1); gable('z', 33, -40.65, -18.65, 1);      // living room and bedroom
  roofX(-49.25, 8.6, WX - 0.75 - OH, 27.35 + OH, [], [[WX - 0.75 - OH, 27.35 + OH]]); gable('z', WX - 0.75, -57.85, -40.65, -1); gable('z', 27, -57.85, -40.65, 1);       // kitchen and bath, forward over the back door
  gableG.push(boxUV(new THREE.BoxGeometry(22.0, 2.8, E), 0.5).translate((WX - 0.75 + 9.65) / 2, H + 1.4, -54.05 + E / 2));      // the boards above the back door, up to the porch roof
  // The metal: dark and matt. As a half mirror it showed the pale sky as one soft gradient and no seams. A standing seam is a thin lit edge and its shadow,
  // drawn fine (a seam is 12 dots of 512) and filtered at the card's best, so it stays a line at a low angle.
  { const c = canvas(512, 8), k = c.getContext('2d'); k.fillStyle = '#26282c'; k.fillRect(0, 0, 512, 8); k.fillStyle = '#4a4e55'; k.fillRect(250, 0, 5, 8); k.fillStyle = '#0f1012'; k.fillRect(255, 0, 7, 8);
    const h = canvas(512, 8), kh = h.getContext('2d'); kh.fillStyle = '#000'; kh.fillRect(0, 0, 512, 8); kh.fillStyle = '#fff'; kh.fillRect(249, 0, 12, 8);
    const map = texOf(c, { rep: [1.3, 1] }), bump = texOf(h, { srgb: false, rep: [1.3, 1] }); map.anisotropy = bump.anisotropy = 16;
    add(merge(roofG), outside(new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 3, roughness: 0.78, metalness: 0.15, envMapIntensity: 0.35 }))); }
  // What makes it a house from outside, at his height: a painted surround at each door, a lamp beside it that is on, the number by the front door, a mat, and light in the windows.
  const surround = (x0, x1, z, out, lampX, number) => { const zc = z + out * 0.13;
    for (const x of [x0 - 0.3, x1 + 0.3]) extTrim.push(put(softBox(0.8, DH + 0.4, 0.3, { r: 0.07, c: 2, flat: 1 }), x, (DH + 0.4) / 2, zc));
    extTrim.push(put(softBox(x1 - x0 + 2.2, 0.9, 0.46, { r: 0.09, c: 2, flat: 1 }), (x0 + x1) / 2, DH + 0.8, zc + out * 0.06));
    extTrim.push(put(softBox(0.5, 0.5, 0.16, { r: 0.06, c: 2, flat: 1 }), lampX, 8.6, z + out * 0.07), put(softBox(0.14, 0.14, 0.8, { r: 0.05, c: 1, flat: 1 }), lampX, 8.6, z + out * 0.45));      // the lamp's plate and arm
    extGlow.push(put(new THREE.SphereGeometry(0.42, 22, 14), lampX, 8.35, z + out * 0.85));
    { const zf = z + out * 0.42, cn = [0, 0, 1], a = x0 - 0.7, b = x1 + 0.7, top = DH + 1.25; wire([a, 0, zf], [a, top, zf], cn); wire([b, 0, zf], [b, top, zf], cn); wire([a, top, zf], [b, top, zf], cn); wire([a, DH + 0.35, zf], [b, DH + 0.35, zf], cn, 0.8, 0.06); }      // the door's surround, in the cage
    if (number) { const c = canvas(128, 128), k = c.getContext('2d'); k.fillStyle = '#1f2f8f'; k.beginPath(); k.roundRect(4, 4, 120, 120, 22); k.fill(); k.strokeStyle = '#f4f1ea'; k.lineWidth = 5; k.beginPath(); k.roundRect(13, 13, 102, 102, 14); k.stroke(); k.fillStyle = '#f4f1ea'; k.font = '700 68px Helvetica, Arial, sans-serif'; k.textAlign = 'center'; k.fillText(number, 64, 88);
      add(put(new THREE.PlaneGeometry(1.5, 1.5), lampX, 6.2, z + out * 0.03, 0, out > 0 ? 0 : PI, 0), outside(new THREE.MeshStandardMaterial({ map: texOf(c), roughness: 0.3 })), { cast: false }); } };
  surround(DOOR.front[0], DOOR.front[1], -6.15, 1, DOOR.front[0] - 2.0, '14'); surround(DOOR.back[0], DOOR.back[1], -54.05, -1, DOOR.back[1] + 2.0);
  extWood.push(put(softBox(4.6, 0.08, 2.5, { r: 0.035, c: 2, flat: 1, uv: 0.5 }), 0, 0.04, -4.5));      // a coir mat on the step outside the front door
  // Light in the windows, seen from outside only: a warm pane set back in each opening, with the curtains and the glazing bars drawn on it. It faces out, so from inside it is not there.
  { const c = canvas(128, 160), k = c.getContext('2d'), g = k.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#ffe9bd'); g.addColorStop(0.55, '#ffcf86'); g.addColorStop(1, '#f2a85a'); k.fillStyle = g; k.fillRect(0, 0, 128, 160);
    const lamp = k.createRadialGradient(84, 62, 4, 84, 62, 70); lamp.addColorStop(0, 'rgba(255,250,225,0.95)'); lamp.addColorStop(1, 'rgba(255,240,200,0)'); k.fillStyle = lamp; k.fillRect(0, 0, 128, 160);
    for (const [x0, x1] of [[0, 26], [102, 128]]) { const cg = k.createLinearGradient(x0, 0, x1, 0); cg.addColorStop(0, 'rgba(150,84,40,0.5)'); cg.addColorStop(0.5, 'rgba(210,140,80,0.3)'); cg.addColorStop(1, 'rgba(150,84,40,0.5)'); k.fillStyle = cg; k.fillRect(x0, 0, x1 - x0, 160); }      // a curtain to either side
    k.fillStyle = '#3a2a1c'; k.fillRect(61, 0, 6, 160); k.fillRect(0, 62, 128, 6);
    const paneM = outside(new THREE.MeshBasicMaterial({ map: texOf(c), toneMapped: false })), panes = [];
    const pane = (axis, at, [a, b, y0, y1], out) => { const g = new THREE.PlaneGeometry(b - a, y1 - y0); panes.push(axis === 'x' ? put(g, (a + b) / 2, (y0 + y1) / 2, at, 0, out > 0 ? 0 : PI, 0) : put(g, at, (y0 + y1) / 2, (a + b) / 2, 0, out > 0 ? PI / 2 : -PI / 2, 0)); };
    pane('x', -6.38, WIN.hall, 1); pane('x', -18.88, WIN.bedroom, 1); pane('z', WX - 0.52, WIN.living, -1); pane('z', WX - 0.52, WIN.kitchen, -1);
    add(merge(panes), paneM, { cast: false, receive: false }); }
  { const baseM = outside(new THREE.MeshStandardMaterial({ color: '#b3ab9d', map: plasterC, bumpMap: plasterC, bumpScale: 0.9, roughness: 0.92 }));
    onPhoto('stone-tile', (im) => { swap(baseM, { map: photoTex(im, { size: 512, rep: [0.3, 0.6] }), bumpMap: photoTex(im, { size: 512, rep: [0.3, 0.6], srgb: false }), bumpScale: 1.2 }); baseM.color.set('#cfc6b6'); });
    add(merge(extBase), baseM); add(merge(extTrim), outside(new THREE.MeshPhysicalMaterial({ color: '#f4f1ea', roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.4 })));
    add(merge(extGlow), outside(new THREE.MeshBasicMaterial({ color: '#fff1c9', toneMapped: false })), { cast: false, receive: false });
    if (extTrimDark.length) add(merge(extTrimDark), outside(new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.7, metalness: 0.2, envMapIntensity: 0.3 })), { receive: false });
    const matM = outside(new THREE.MeshStandardMaterial({ color: '#8f7046', roughness: 1 })); onPhoto('wool-rug', (im) => swap(matM, { map: photoTex(im, { size: 512, tint: '#c79a5c', rep: [1.2, 1.2] }), bumpMap: photoTex(im, { size: 512, rep: [1.2, 1.2], srgb: false }), bumpScale: 2 }));
    add(merge(extWood), matM, { cast: false }); }
  // Behind every window stands a garden: a photograph, out of focus, on a card a few units outside the wall, brighter than the room. The cards are not part of the house
  // (they do not scan and do not grow with it). js/main.js shows them only while the camera is indoors, so from outside there is no card standing in the air.
  const garden = new THREE.Group();
  { const c = canvas(256, 128), k = c.getContext('2d'), g = k.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#eef4f6'); g.addColorStop(0.45, '#d9e8d2'); g.addColorStop(1, '#8fae78'); k.fillStyle = g; k.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 26; i++) { const x = hash(i, 2) * 256, y = 50 + hash(i, 5) * 70, r = 16 + hash(i, 9) * 30, b = k.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, `rgba(${70 + hash(i, 1) * 50 | 0},${120 + hash(i, 3) * 40 | 0},${70 + hash(i, 4) * 30 | 0},0.55)`); b.addColorStop(1, 'rgba(90,140,90,0)'); k.fillStyle = b; k.fillRect(x - r, y - r, r * 2, r * 2); }      // drawn first: soft green shapes under a pale sky
    const tex = texOf(c); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; const gm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false }); gm.color.setScalar(1.4);      // brighter than the room: it is daylight out there
    onPhoto('outside', (im) => { const pc = canvas(1024, 512); pc.getContext('2d').drawImage(im, 0, 0, im.width, im.height * 0.82, 0, 0, 1024, 512); const t = texOf(pc); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; swap(gm, { map: t }); });      // the photo has a dark window ledge across its bottom 18 percent: left off
    const card = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 26), gm); m.position.set(x, 14.5, z); m.rotation.y = ry; garden.add(m); };
    card(26, WX - 0.75 - 5.5, (WIN.living[0] + WIN.living[1]) / 2, PI / 2); card(26, WX - 0.75 - 5.5, (WIN.kitchen[0] + WIN.kitchen[1]) / 2, PI / 2);      // living room and kitchen: outside the left wall, facing in
    card(34, (WIN.bedroom[0] + WIN.bedroom[1]) / 2, -18.65 + 5.5, PI); card(12, 9.2, -6.15 + 5.5, PI); }                                                        // the bedroom and the hall's small window: outside the front, facing in
  for (const [m, list] of wallG) add(merge(list), m, m === extM ? { receive: false } : {});      // the boards outside take no shadow: the roof's shadow on them is drawn from a map that covers the whole house, and came out as a pale smear
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(shade.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(shade.c, 4));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#2b2218', vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 1; kit.group.add(m); }
  // the bath window is frosted: a pale pane, bright with the day behind it
  add(put(new THREE.PlaneGeometry(WIN.bath[1] - WIN.bath[0], WIN.bath[3] - WIN.bath[2]).rotateY(-PI / 2), BATH.x1 - 0.15, (WIN.bath[2] + WIN.bath[3]) / 2, (WIN.bath[0] + WIN.bath[1]) / 2), new THREE.MeshBasicMaterial({ color: '#f3f7f8', side: THREE.DoubleSide }), { cast: false, receive: false });

  /* ---------- doors: the front door and the back door, both standing open ---------- */
  const rubberG = [], ironG = [], woodG = [], blueG = [], plateG = [];
  // A door leaf, hinged at (hx, hz) and swung by ang. On each face: two panels, each a raised field inside a bolection moulding, with stiles and rails round them,
  // a brass kick plate held by six screws, and a brass letter plate in the middle rail. A knob through it, and the latch plate on its free edge.
  const leaf = (hx, hz, ang, w) => { const TK = 0.34, pw = w - 1.5, g = [softBox(w, DH - 0.2, TK, { r: 0.04, c: 2, flat: 2 }).translate(w / 2, DH / 2, 0)], br = [], mould = { r: 0.045, c: 1, flat: 1 };
    for (const s of [-1, 1]) { const zf = s * TK / 2;
      for (const [y, h] of [[3.55, 3.3], [7.95, 3.7]]) {
        for (const e of [-1, 1]) g.push(softBox(pw, 0.2, 0.1, mould).translate(w / 2, y + e * (h / 2 - 0.1), zf + s * 0.03), softBox(0.2, h - 0.36, 0.1, mould).translate(w / 2 + e * (pw / 2 - 0.1), y, zf + s * 0.03));
        g.push(softBox(pw - 0.8, h - 0.8, 0.08, { r: 0.035, c: 1, flat: 1 }).translate(w / 2, y, zf + s * 0.02)); }
      br.push(softBox(w - 0.7, 1.28, 0.03, { r: 0.012, c: 1, flat: 1 }).translate(w / 2, 0.86, zf + s * 0.012));
      for (const sx of [-1, 0, 1]) for (const sy of [-1, 1]) br.push(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10).rotateX(PI / 2).translate(w / 2 + sx * (w / 2 - 0.52), 0.86 + sy * 0.5, zf + s * 0.034));
      br.push(softBox(1.8, 0.56, 0.03, { r: 0.012, c: 1, flat: 1 }).translate(w / 2, 5.64, zf + s * 0.012), softBox(1.46, 0.28, 0.03, { r: 0.012, c: 1, flat: 1 }).translate(w / 2, 5.64, zf + s * 0.034)); }
    br.push(softBox(0.5, 0.5, 0.9, { r: 0.12, c: 2, flat: 1 }).translate(w - 0.55, 5.4, 0), softBox(0.03, 0.9, 0.2, { r: 0.01, c: 1, flat: 1 }).translate(w + 0.004, 5.4, 0));
    blueG.push(put(merge(g), hx, 0, hz, 0, ang, 0)); plateG.push(put(merge(br), hx, 0, hz, 0, ang, 0)); };
  leaf(DOOR.front[1] - 0.1, -6.75, PI / 2 + 0.16, 5.0); leaf(DOOR.back[0] + 0.1, -54.0, PI / 2 + 0.25, 4.2);      // the front door swings into the hall, the back door out into the street
  woodG.push(put(softBox(5.6, 0.1, 1.0, { r: 0.04, c: 2, flat: 1, uv: 0.6 }), 0, 0.05, -6.6), put(softBox(4.8, 0.1, 1.0, { r: 0.04, c: 2, flat: 1, uv: 0.6 }), 0.5, 0.05, -53.8));      // the two thresholds
  add(put(softBox(6.6, 0.18, 2.2, { r: 0.05, c: 2, flat: 2 }), 0.5, 0.09, -55.2), outside(new THREE.MeshStandardMaterial({ color: '#8d867a', roughness: 0.85 })));      // the step outside the back door, of darker stone: an edge you can see between the kitchen floor and the street (low, because he walks across it)
  add(put(new THREE.BoxGeometry(6.9, 0.03, 2.5), 0.5, 0.015, -55.2), outside(new THREE.MeshBasicMaterial({ color: '#4a463f' })), { cast: false, receive: false });      // and a dark line at its foot, where a step always has one      // a stone step outside the back door

  /* ---------- the hall ---------- */
  // The hall has no lamp of its own, and the sun only reaches a patch of floor by the door. So its things are lit from all round and would look flat. Each one
  // therefore carries its own light and dark in its colours: a soft key from the open front door (from the door's side and a little from the right, as he sees it),
  // less light underneath, and less close to the floor. bake() writes that into a geometry's colours once the geometry stands in its place.
  const { lerp, clamp, knitC } = kit, KEY = V3(0.52, 0.5, 0.69).normalize();
  const bake = (g, { amb = 0.78, key = 0.3, under = 0.16, ground = 0, gk = 0.3 } = {}) => { if (!g.attributes.color) tint(g, '#ffffff'); const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) { let k = amb + key * Math.max(0, n.getX(i) * KEY.x + n.getY(i) * KEY.y + n.getZ(i) * KEY.z) - under * Math.max(0, -n.getY(i)); if (ground) k *= 1 - gk * (1 - smooth(p.getY(i), 0, ground)); c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k); } return g; };
  // a skin over rings of points. Every ring has the same count and goes round the same way. Closed round, open at both ends.
  const loft = (rows, su = 1, sv = 1) => { const n = rows[0].length, pos = [], uv = [], idx = [];
    rows.forEach((row, r) => { for (let j = 0; j <= n; j++) { const p = row[j % n]; pos.push(p.x, p.y, p.z); uv.push(j / n * su, r / (rows.length - 1) * sv); }
      if (r) for (let j = 0; j < n; j++) { const a = (r - 1) * (n + 1) + j, b = a + n + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const N = g.attributes.normal, v = V3(); for (let r = 0; r < rows.length; r++) { const a = r * (n + 1), b = a + n; v.set(N.getX(a) + N.getX(b), N.getY(a) + N.getY(b), N.getZ(a) + N.getZ(b)).normalize(); N.setXYZ(a, v.x, v.y, v.z); N.setXYZ(b, v.x, v.y, v.z); } return g; };
  const flatUV = (g, u = 0.5, v = 0.02) => { const a = g.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, u, v); return g; };
  const darkG = [], dark = (x, z, w, d, turn = 0) => darkG.push(put(new THREE.PlaneGeometry(w, d).rotateX(-PI / 2), x, 0.017, z, 0, turn, 0));      // the dark under a piece of furniture: a soft-edged rectangle on the floor

  { // The doormat, inside the front door: a coir pile set in a black rubber tray with a raised lip, worn pale where feet land.
    const coirC = (() => { const c = canvas(256, 256), k = c.getContext('2d'); k.fillStyle = '#9a7648'; k.fillRect(0, 0, 256, 256); strokes(c, 5200, (k, x, y, s, t) => { k.strokeStyle = s > 0.45 ? `rgba(200,164,110,${0.25 + t * 0.4})` : `rgba(70,46,20,${0.2 + t * 0.4})`; k.lineWidth = 0.8; k.beginPath(); k.moveTo(x, y); k.lineTo(x + (s - 0.5) * 5, y + 2 + t * 5); k.stroke(); }); return c; })();
    const MW = 4.5, MD = 2.7, mz = -8.7;
    const matC = (() => { const c = canvas(1024, 640), k = c.getContext('2d'); k.fillStyle = k.createPattern(coirC, 'repeat'); k.fillRect(0, 0, 1024, 640);      // the fibres four times finer than one picture over the whole mat
      const g = k.createRadialGradient(512, 320, 60, 512, 320, 520); g.addColorStop(0, 'rgba(232,208,160,0.34)'); g.addColorStop(1, 'rgba(232,208,160,0)'); k.fillStyle = g; k.fillRect(0, 0, 1024, 640);
      k.strokeStyle = 'rgba(44,28,12,0.3)'; k.lineWidth = 30; k.strokeRect(0, 0, 1024, 640); k.strokeStyle = 'rgba(30,18,8,0.45)'; k.lineWidth = 8; k.strokeRect(0, 0, 1024, 640); return texOf(c); })();      // darker where the pile meets the lip
    const pile = softBox(MW, 0.22, MD, { r: 0.05, c: 2, flat: 3 }), mu = pile.attributes.uv, mp = pile.attributes.position; for (let i = 0; i < mp.count; i++) mu.setXY(i, mp.getX(i) / MW + 0.5, mp.getZ(i) / MD + 0.5);
    add(put(pile, 0, 0.16, mz), new THREE.MeshStandardMaterial({ map: matC, bumpMap: texOf(coirC, { srgb: false, rep: [4, 2.5] }), bumpScale: 2.6, roughness: 1 }), { cast: false });
    tinted.push(tint(put(softBox(MW + 0.46, 0.07, MD + 0.46, { r: 0.03, c: 1, flat: 1 }), 0, 0.04, mz), '#25262a'));
    for (const [w, d, x, z] of [[MW + 0.46, 0.18, 0, MD / 2 + 0.14], [MW + 0.46, 0.18, 0, -MD / 2 - 0.14], [0.18, MD + 0.12, MW / 2 + 0.14, 0], [0.18, MD + 0.12, -MW / 2 - 0.14, 0]]) tinted.push(tint(put(softBox(w, 0.13, d, { r: 0.05, c: 2, flat: 1 }), x, 0.085, mz + z), '#2c2d31'));
    sit(0, mz, 6.2, 4.4); dark(0, mz, MW + 1.3, MD + 1.3);
  }
  { // Two rain boots. Each is ONE boot: every level slice through it, from the ground to the rim, comes from the same three curves (where its front is at that height,
    // where its back is, how wide it is). The sole is the lowest slices of that same shape, a hair wider, so sole and upper cannot drift apart: same length, same
    // toe curve, directly under each other, with a welt bead round the join. Side on: a low toe box, the instep rising to the ankle, a shaft that leans a little
    // forward and widens to the rim, a rounded heel counter, and under it a sole plate with a heel block, an arch and a lugged forepart.
    const YEL = new THREE.Color('#cf9f1d'), DUST = new THREE.Color('#b6a67c'), DEEP = new THREE.Color('#94700f'), INSIDE = new THREE.Color('#4a3a0e'), SOLE = '#232326', c = new THREE.Color();
    const FRONT = [[0.2, 1.48], [0.3, 1.5], [0.46, 1.49], [0.58, 1.44], [0.68, 1.35], [0.76, 1.2], [0.82, 1.0], [0.9, 0.78], [1.02, 0.56], [1.18, 0.38], [1.4, 0.25], [1.7, 0.17], [2.1, 0.15], [2.6, 0.19], [3.3, 0.27]];      // [height, where the front is]
    const BACK = [[0.2, -0.98], [0.4, -1.0], [0.7, -0.99], [1.1, -0.92], [1.6, -0.83], [2.1, -0.81], [2.7, -0.8], [3.3, -0.78]];
    const WIDE = [[0.2, 0.5], [0.5, 0.51], [0.8, 0.49], [1.1, 0.45], [1.5, 0.415], [1.9, 0.41], [2.4, 0.44], [3.3, 0.5]];      // half the width
    const prof = (P, y) => { let i = 0; while (i < P.length - 2 && y > P[i + 1][0]) i++; const a = P[Math.max(0, i - 1)], b = P[i], d = P[i + 1], e = P[Math.min(P.length - 1, i + 2)], h = d[0] - b[0], t = clamp((y - b[0]) / h, 0, 1), m1 = (d[1] - a[1]) / (d[0] - a[0]) * h, m2 = (e[1] - b[1]) / (e[0] - b[0]) * h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * b[1] + (t3 - 2 * t2 + t) * m1 + (3 * t2 - 2 * t3) * d[1] + (t3 - t2) * m2; };
    const WELT = 0.2, TOP = 3.3, N = 36;
    // one point of the boot: at height y, at angle t round the slice (0 is the outer side, a quarter turn on is the toe). Low down the slice is a foot: long, blunt at
    // the toe, narrower at the heel, the toe turned a little inward. Higher up it becomes the oval of the shaft. push moves it out along the slice.
    const at = (y, t, push = 0, side = 1) => { const zf = prof(FRONT, y) + push, zb = prof(BACK, y) - push, w = prof(WIDE, y) + push, k = 1 - smooth(y, 0.7, 1.4), u = Math.sin(t), cs = Math.cos(t), sh = 1 - k * (0.2 * smooth(-u, 0, 0.9) + 0.08 * smooth(u, 0.55, 1));
      return V3(Math.sign(cs) * Math.pow(Math.abs(cs), lerp(1, 0.74, k)) * w * sh + side * 0.05 * k * smooth(u, 0.1, 1), y, (zf + zb) / 2 + (zf - zb) / 2 * u); };
    const ring = (y, push = 0, side = 1, n = N) => Array.from({ length: n }, (_, j) => at(y, j / n * PI * 2, push, side));
    const YS = [0.2, 0.26, 0.33, 0.41, 0.49, 0.56, 0.62, 0.67, 0.71, 0.75, 0.79, 0.83, 0.88, 0.94, 1.02, 1.11, 1.22, 1.34, 1.48, 1.64, 1.82, 2.02, 2.25, 2.5, 2.78, 3.05, 3.2, 3.3];
    const bootG = [];
    const boot = (x, z, ry, { down = false, side = 1 } = {}) => { const parts = [];
      // the upper, and back down inside it: the lining you see when you look into the top
      const rows = YS.map((y) => ring(y, 0, side)); rows.push(ring(TOP, -0.055, side), ring(TOP - 0.3, -0.06, side), ring(TOP - 1.1, -0.08, side), ring(TOP - 1.5, -0.32, side));
      const skin = loft(rows, 3, 8), sp = skin.attributes.position, col = new Float32Array(sp.count * 3);
      for (let i = 0; i < sp.count; i++) { const r = Math.floor(i / (N + 1)), j = i % (N + 1), y = sp.getY(i), u = Math.sin(j / N * PI * 2);
        if (r >= YS.length) c.copy(INSIDE);
        else { const crease = smooth(u, 0.2, 0.9) * smooth(y, 0.9, 1.15) * (1 - smooth(y, 1.3, 1.7)), low = 1 - smooth(y, 0.2, 0.75), scuff = smooth(sp.getZ(i), 1.05, 1.45) * (1 - smooth(y, 0.45, 0.72));
          c.copy(YEL).lerp(DEEP, 0.5 * crease).lerp(DUST, Math.min(0.5, (low * 0.26 + scuff * 0.12) * (0.6 + 0.4 * hash(j * 7 + r, r * 3 + 1)))).multiplyScalar(0.97 + 0.05 * hash(r * 5, j * 11)); }
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      skin.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(skin);
      // the foxing: a band of thicker rubber round the foot, higher over the toe, and the welt bead where it meets the sole
      { const h = (t) => 0.4 + 0.14 * smooth(Math.sin(t), 0.45, 0.95), mk = (f, push) => Array.from({ length: N }, (_, j) => { const t = j / N * PI * 2; return at(f(t), t, push, side); });
        parts.push(tint(loft([0, 0.25, 0.5, 0.75, 1].map((f) => mk((t) => lerp(WELT - 0.01, h(t) - 0.04, f), 0.017)).concat([mk(h, 0.005)])), '#d3a626'));      // five rings up the band, so it follows the bulge of the toe and the upper never shows through it
        parts.push(tint(cord(ring(WELT + 0.004, 0.03, side, 40), 0.022, 44, 4, true), '#7d6010')); }
      // the rim, the binding under it, the moulding seam down the back, a strap with a buckle on the outer side, and the maker's label on the front
      parts.push(tint(cord(ring(TOP, 0.012, side, 24), 0.05, 32, 6, true), '#d9aa27'), tint(loft([ring(TOP - 0.36, 0.002, side), ring(TOP - 0.33, 0.013, side), ring(TOP - 0.1, 0.013, side)]), '#a17c12'));
      { const seam = []; for (let y = 0.62; y <= TOP - 0.38; y += 0.23) seam.push(at(y, PI * 1.5, 0.006, side)); parts.push(tint(cord(seam, 0.02, 16, 4), '#b98c16')); }
      { const t0 = side > 0 ? 0 : PI; parts.push(tint(sheet(8, 1, (u, v) => at(2.8 + 0.13 * v, t0 + lerp(-0.7, 0.55, u), 0.014, side), 0.028), '#a17c12'));
        const b = at(2.865, t0 + 0.12, 0.03, side); parts.push(tint(softBox(0.05, 0.21, 0.2, { r: 0.02, c: 1, flat: 1 }).translate(b.x, b.y, b.z), '#aeb2b8')); }
      { const p = at(2.7, PI / 2, 0, side); parts.push(tint(new THREE.BoxGeometry(0.36, 0.22, 0.04).rotateX(-0.08).translate(p.x, p.y, p.z), '#ece5d3'), tint(new THREE.BoxGeometry(0.27, 0.13, 0.05).rotateX(-0.08).translate(p.x, p.y, p.z), '#a53d2b')); }
      // the sole, from the same outline as the lowest slice of the upper: a plate under the whole foot, a heel block, an arch, a forepart with chevron lugs
      const rot = (a, s) => a.slice(s).concat(a.slice(0, s));
      const slab = (pts, y0, h, bev = 0.012) => new THREE.ExtrudeGeometry(new THREE.Shape(pts.map((p) => V2(p.x, -p.z))), { depth: h, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 1 }).rotateX(-PI / 2).translate(0, y0, 0);
      parts.push(tint(slab(ring(WELT, 0.022, side, 40), 0.085, 0.105), SOLE));
      parts.push(tint(slab(rot(ring(WELT, 0.022, side, 40), 10).filter((p) => p.z <= -0.22), 0.04, 0.05), SOLE));
      parts.push(tint(slab(rot(ring(WELT, 0.0, side, 40), 30).filter((p) => p.z >= 0.02), 0.045, 0.03, 0.008), SOLE));
      const zf = prof(FRONT, WELT), zb = prof(BACK, WELT), span = (zz) => { const a = Math.asin(clamp((zz - (zf + zb) / 2) / ((zf - zb) / 2), -1, 1)), xr = at(WELT, a, 0, side).x, xl = at(WELT, PI - a, 0, side).x; return [(xr + xl) / 2, (xr - xl) / 2]; };
      for (let i = 0; i < 7; i++) { const zz = 0.16 + i * 0.185, [cx, w] = span(zz); for (const s of [-1, 1]) parts.push(tint(new THREE.BoxGeometry(w - 0.02, 0.05, 0.085).rotateY(s * 0.3).translate(cx + s * (w - 0.02) * 0.48, 0.025, zz - 0.02), SOLE)); }
      for (const zz of [-0.84, -0.61, -0.38]) { const [cx, w] = span(zz); parts.push(tint(new THREE.BoxGeometry(w * 2 - 0.1, 0.045, 0.1).translate(cx, 0.0225, zz), SOLE)); }
      const g = mergeTinted(parts.map((q) => (q.index ? q.toNonIndexed() : q)));
      if (down) { // the one that has fallen over lies on its side, and its shaft has sunk a little flat, the way rubber lies
        const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 1.5) { const s = smooth(y, 1.5, TOP), yy = Math.min(y, TOP), zc = (prof(FRONT, yy) + prof(BACK, yy)) / 2; p.setX(i, p.getX(i) * (1 - 0.2 * s)); p.setZ(i, zc + (p.getZ(i) - zc) * (1 + 0.07 * s)); } }
        g.rotateZ(PI / 2 + 0.03); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0); }
      bootG.push(bake(put(g, x, 0, z, 0, ry, 0), { ground: 0.55, gk: 0.26 }));
      const dx = Math.sin(ry), dz = Math.cos(ry);
      if (down) { sit(x + dx * 0.25 - dz * 1.4, z + dz * 0.25 + dx * 1.4, 4.6, 3.2, ry); sit(x + dx * 0.25 - dz * 0.2, z + dz * 0.25 + dx * 0.2, 1.3, 2.9, ry); }
      else { sit(x + dx * 0.25, z + dz * 0.25, 2.3, 3.7, ry); sit(x + dx * 0.25, z + dz * 0.25, 1.35, 2.9, ry); for (let i = 0; i < 3; i++) dark(x + dx * 0.25, z + dz * 0.25, 1.5, 3.0, ry); } };      // a wide soft shadow and a close dark one right under the sole, so it stands on the floor
    boot(-4.8, -11.82, 2.38); boot(-1.95, -16.6, 0.62, { side: -1 });      // kicked off in two places. One stands half under the bench, side on from the door, its toe out into the room. The other was left further in, turned toward the door. Well apart, so each has its own outline, and neither hides the umbrella stand
    // rubber: matt to satin, a broad soft highlight, and a fine grain so it is not smooth plastic
    const grainC = paint(128, 128, (px, py) => 0.5 + 0.5 * (hash(px * 3 + 1, py * 7 + 2) - 0.5));
    add(mergeTinted(bootG), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.56, clearcoat: 0.2, clearcoatRoughness: 0.5, bumpMap: texOf(grainC, { srgb: false, rep: [6, 6] }), bumpScale: 0.25, envMapIntensity: 0.8 }));
  }
  { // An umbrella stand in the corner: a tube of powder-coated steel with a rolled rim, rows of punched holes and a wall you can see the thickness of, standing in a
    // drip tray. Two folded umbrellas lean in it, against the two walls of the corner.
    const ux = -4.96, uz = -17.6, R = 0.85, HS = 4.0;
    const holesC = canvas(1024, 512), holesH = canvas(1024, 512);
    { const k = holesC.getContext('2d'), kh = holesH.getContext('2d'); k.fillStyle = '#3b3e41'; k.fillRect(0, 0, 1024, 512); kh.fillStyle = '#fff'; kh.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 2600; i++) { k.fillStyle = `rgba(${hash(i, 5) > 0.5 ? '255,255,255' : '0,0,0'},${0.02 + 0.04 * hash(i, 9)})`; k.fillRect(hash(i, 1) * 1024, hash(i, 2) * 512, 2, 2); }      // the fine orange peel of powder coat
      const NA = 44, NRW = 19; for (let r = 0; r < NRW; r++) for (let i = 0; i < NA; i++) { const x = (i + (r % 2) * 0.5) * 1024 / NA, y = 512 * (1 - (0.32 + 0.58 * r / (NRW - 1)));
        for (const ox of [0, 1024]) { k.fillStyle = '#0b0c0d'; k.beginPath(); k.ellipse(x + ox, y, 6.2, 4.7, 0, 0, 7); k.fill(); k.strokeStyle = 'rgba(132,138,144,0.6)'; k.lineWidth = 1.3; k.beginPath(); k.ellipse(x + ox, y + 0.7, 6.5, 5.0, 0, 0.25, 2.9); k.stroke(); kh.fillStyle = '#000'; kh.beginPath(); kh.ellipse(x + ox, y, 6.2, 4.7, 0, 0, 7); kh.fill(); } } }
    const standM = new THREE.MeshStandardMaterial({ map: texOf(holesC), bumpMap: texOf(holesH, { srgb: false }), bumpScale: 0.9, roughness: 0.6, metalness: 0.25, vertexColors: true, envMapIntensity: 0.9 });
    const rim = tint(flatUV(lathe([[R, HS - 0.04], [R + 0.035, HS], [R + 0.045, HS + 0.05], [R + 0.02, HS + 0.1], [R - 0.03, HS + 0.1], [R - 0.06, HS + 0.05], [R - 0.05, HS - 0.04], [R - 0.05, 0.5], [0.001, 0.5]], 48)), '#ffffff');
    { const p = rim.attributes.position, cl = rim.attributes.color; for (let i = 0; i < p.count; i++) if (Math.hypot(p.getX(i), p.getZ(i)) < R - 0.02 && p.getY(i) < HS + 0.06) { const k = lerp(0.2, 0.55, smooth(p.getY(i), HS - 2.2, HS)); cl.setXYZ(i, k, k, k); } }      // inside it is dark, darker further down
    const standG = mergeTinted([tint(new THREE.CylinderGeometry(R, R, HS - 0.3, 48, 1, true).translate(0, 0.3 + (HS - 0.3) / 2, 0), '#ffffff'), rim,
      tint(flatUV(lathe([[0.001, 0.2], [R - 0.03, 0.2], [R + 0.022, 0.22], [R + 0.022, 0.32], [R, 0.345]], 48)), '#ffffff'),      // a foot ring
      tint(flatUV(lathe([[0.001, 0.02], [0.96, 0.02], [1.01, 0.06], [1.02, 0.2], [0.99, 0.235], [0.96, 0.2], [0.94, 0.1], [0.001, 0.085]], 48)), '#8f8f8f')]);      // the drip tray, of black rubber
    add(bake(put(standG, ux, 0, uz), { amb: 0.74, key: 0.4, ground: 0.5, gk: 0.3 }), standM); sit(ux, uz, 3.3); for (let i = 0; i < 3; i++) sit(ux, uz, 2.5);
    // A folded umbrella, standing on its tip. The cloth is gathered round the stick in eight flaps (one between each pair of ribs), each wrapped over the next, loose
    // and deep at the rib tips and tight at the point. A strap with a press stud holds them. Above the rib tips: the runner, the stick, a collar and a wooden handle.
    const canopyG = [], bump = (v, a, w) => Math.exp(-(((v - a) / w) ** 2));
    const umbrella = (col, { crook = true, twist = 0.55, phase = 0, spin = 0, dx = 0, dz = 0, rx = 0, rz = 0 } = {}) => { const C = new THREE.Color(col), cc = new THREE.Color(), Y0 = 0.42, Y1 = 5.9, NA = 48, NV = 20, pos = [], colr = [], uv = [], idx = [], hard = [];
      const radius = (v) => lerp(0.075, 0.34, Math.pow(v, 0.62)) * (1 - 0.17 * bump(v, 0.81, 0.045)) * (1 - 0.3 * smooth(v, 0.93, 1));
      for (let i = 0; i <= NV + 1; i++) { const top = i > NV, v = Math.min(1, i / NV), y = lerp(Y0, Y1, v), Rv = radius(v), depth = lerp(0.12, 0.52, smooth(v, 0.05, 0.9)) * (1 - 0.62 * bump(v, 0.81, 0.05));
        for (let j = 0; j <= NA; j++) { const a = j / NA * PI * 2, q = (((j / NA * 8 + twist * v + phase) % 1) + 1) % 1, flap = Math.pow(q, 0.55) * (1 - smooth(q, 0.8, 1)), r = top ? 0.06 : Rv * (1 - depth * (1 - flap));
          pos.push(Math.cos(a) * r, top ? y - 0.06 : y + (i === NV ? 0.12 * flap : 0), Math.sin(a) * r); uv.push(j / NA * 4, v * 6); cc.copy(C).multiplyScalar(top ? 0.35 : lerp(1, 0.42 + 0.66 * flap, Math.min(1, depth * 2.2))); colr.push(cc.r, cc.g, cc.b); }
        if (i) for (let j = 0; j < NA; j++) { const A = (i - 1) * (NA + 1) + j, B = A + NA + 1; idx.push(A, B, A + 1, A + 1, B, B + 1); } }
      const cv = new THREE.BufferGeometry(); cv.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); cv.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cv.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3)); cv.setIndex(idx); cv.computeVertexNormals();
      const ys = lerp(Y0, Y1, 0.81), rs = radius(0.81) + 0.012, strap = tint(lathe([[rs, ys - 0.12], [rs + 0.012, ys - 0.1], [rs + 0.012, ys + 0.1], [rs, ys + 0.12]], 20), '#' + C.clone().multiplyScalar(0.6).getHexString());
      const tail = tint(softBox(0.03, 0.17, 0.3, { r: 0.012, c: 1, flat: 1 }).translate(rs + 0.02, ys, 0.17), '#' + C.clone().multiplyScalar(0.6).getHexString());
      const place = (g) => put(g.rotateY(spin), ux + dx, 0.5, uz + dz, rx, 0, rz, 0.9);
      canopyG.push(place(mergeTinted([cv.toNonIndexed(), strap.toNonIndexed(), tail])));
      hard.push(tint(new THREE.SphereGeometry(0.04, 10, 8).scale(0.6, 1, 1).translate(rs + 0.03, ys, 0.06), '#c9cdd2'));                                                    // the press stud
      for (let n = 0; n < 8; n++) { const a = ((0.8 - twist - phase + n) / 8) * PI * 2; hard.push(tint(new THREE.SphereGeometry(0.035, 6, 4).translate(Math.cos(a) * radius(1) * 0.95, Y1 + 0.1, Math.sin(a) * radius(1) * 0.95), '#b9bcc2')); }      // the rib tips
      hard.push(tint(new THREE.CylinderGeometry(0.075, 0.09, 0.32, 12).translate(0, Y1 + 0.14, 0), '#1d1e21'), tint(new THREE.CylinderGeometry(0.036, 0.036, 0.6, 8).translate(0, Y1 + 0.6, 0), '#2a2b2e'), tint(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 12).translate(0, Y1 + 0.94, 0), '#b9954f'));      // runner, stick, collar
      hard.push(tint(lathe([[0.001, 0.0], [0.028, 0.02], [0.04, 0.3], [0.07, 0.36], [0.075, 0.44]], 10), '#b9bcc2'));                                                              // the ferrule
      if (crook) hard.push(tint(cord([[0, Y1 + 1.0, 0], [0, Y1 + 1.85, 0], [0.09, Y1 + 2.22, 0], [0.36, Y1 + 2.42, 0], [0.63, Y1 + 2.24, 0], [0.72, Y1 + 1.9, 0], [0.72, Y1 + 1.62, 0]], 0.085, 30, 8), '#8a5a33'), tint(new THREE.SphereGeometry(0.085, 10, 8).translate(0.72, Y1 + 1.62, 0), '#8a5a33'));
      else hard.push(tint(lathe([[0.06, Y1 + 1.0], [0.085, Y1 + 1.08], [0.09, Y1 + 1.95], [0.115, Y1 + 2.08], [0.105, Y1 + 2.24], [0.06, Y1 + 2.32], [0.001, Y1 + 2.34]], 14), '#6f4a2c'), tint(cord([[0.09, Y1 + 1.8, 0], [0.3, Y1 + 1.55, 0.04], [0.33, Y1 + 1.2, 0], [0.2, Y1 + 1.0, -0.04], [0.085, Y1 + 1.74, 0]], 0.018, 20, 4), '#2e2119'));      // a straight turned handle with a leather wrist loop
      tinted.push(place(mergeTinted(hard.map((h) => (h.index ? h.toNonIndexed() : h))))); };
    umbrella('#1e2a45', { crook: true, spin: 2.6, dx: 0.12, dz: 0.18, rz: 0.15, rx: 0.02 });                       // deep navy, leaning on the left wall
    umbrella('#b3852b', { crook: false, twist: 0.4, phase: 0.3, spin: 0.7, dx: -0.1, dz: 0.1, rx: -0.115, rz: -0.03 });      // ochre, leaning on the back wall
    add(bake(mergeTinted(canopyG), { amb: 0.8, key: 0.34 }), new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, sheen: 0.5, sheenRoughness: 0.4, sheenColor: new THREE.Color('#aeb6c6'), normalMap: again(weaveN, 6, 14), normalScale: V2(0.3, 0.3) }));
  }
  { // The entrance bench along the left wall, to sit on while you pull the boots on. A thick oak board with softened edges and end grain you can see at both ends.
    // It rests on two loops of black flat steel, each standing on two small feet, with a rail between them under the seat. Four pucks hold the board a finger
    // above the steel, so there is a line of shadow under it. From his height you see it from below: the underside, the loops, the screws.
    const bx = -5.22, z0 = -14.3, z1 = -8.1, bw = 1.66, ST = 4.0, TH = 0.34, zc = (z0 + z1) / 2, len = z1 - z0, FT = ST - TH - 0.05;      // FT: the top of the steel
    const benchM = wood('#c2a078', { vertexColors: true, roughness: 0.5 }); onPhoto('oak-veneer', (im) => { swap(benchM, { map: photoTex(im, { rep: [0.5, 0.5] }) }); benchM.color.set('#f1dfc2'); });
    add(bake(put(softBox(bw, len, TH, { r: 0.07, c: 3, flat: 3, uv: 0.6 }).rotateX(PI / 2), bx, ST - TH / 2, zc), { amb: 0.8, key: 0.26, under: 0.34 }), benchM);      // made standing up and laid down, so the grain runs along it on every long face
    const endC = (() => { const c = canvas(256, 64), k = c.getContext('2d'); k.fillStyle = '#bd9865'; k.fillRect(0, 0, 256, 64);
      for (let s = 0; s < 3; s++) { k.save(); k.beginPath(); k.rect(s * 85.4, 0, 85.4, 64); k.clip(); const cx = s * 85.4 + 20 + hash(s, 3) * 46, cy = s % 2 ? -30 - hash(s, 5) * 30 : 94 + hash(s, 7) * 30;      // three staves glued up, each cut from a different part of the tree
        for (let r = 12; r < 220; r += 5 + hash(r, s) * 5) { k.strokeStyle = `rgba(104,68,34,${0.22 + 0.3 * hash(r, s + 9)})`; k.lineWidth = 1 + hash(r, s + 4) * 1.6; k.beginPath(); k.arc(cx, cy, r, 0, 7); k.stroke(); } k.restore(); k.fillStyle = 'rgba(70,44,20,0.55)'; k.fillRect(s * 85.4 - 0.6, 0, 1.2, 64); }
      for (let i = 0; i < 900; i++) { k.fillStyle = `rgba(80,50,24,${0.1 + 0.25 * hash(i, 2)})`; k.fillRect(hash(i, 11) * 256, hash(i, 13) * 64, 1, 1); } return texOf(c); })();      // pores
    add(merge([put(new THREE.PlaneGeometry(bw - 0.13, TH - 0.13), bx, ST - TH / 2, z1 + 0.004), put(new THREE.PlaneGeometry(bw - 0.13, TH - 0.13).rotateY(PI), bx, ST - TH / 2, z0 - 0.004)]), new THREE.MeshStandardMaterial({ map: endC, roughness: 0.7 }), { cast: false });
    for (const fz of [z0 + 0.75, z1 - 0.75]) { const xs = [bx - bw / 2 + 0.13, bx + bw / 2 - 0.13];
      for (const x of xs) { ironG.push(put(softBox(0.07, FT - 0.03, 0.3, { r: 0.018, c: 1, flat: 1 }), x, (FT + 0.03) / 2, fz));
        tinted.push(tint(put(new THREE.CylinderGeometry(0.11, 0.12, 0.035, 14), x, 0.0175, fz), '#141416'), tint(put(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 12), x + (x < bx ? 0.2 : -0.2), FT + 0.025, fz), '#17171a'));      // a foot under it, a puck over it
        brassG.push(put(new THREE.CylinderGeometry(0.04, 0.04, 0.016, 10), x + (x < bx ? 0.2 : -0.2), FT - 0.078, fz)); }                                                                                              // the screw up into the board
      ironG.push(put(softBox(bw - 0.19, 0.07, 0.3, { r: 0.018, c: 1, flat: 1 }), bx, FT - 0.035, fz), put(softBox(bw - 0.19, 0.07, 0.3, { r: 0.018, c: 1, flat: 1 }), bx, 0.065, fz));
      sit(bx, fz, bw + 1.0, 1.0); sit(bx, fz, bw + 0.3, 0.55); }
    ironG.push(put(softBox(0.07, 0.24, len - 1.5 - 0.3, { r: 0.018, c: 1, flat: 1 }), bx - bw / 2 + 0.24, FT - 0.19, zc));      // the rail between the two loops
    dark(bx - 0.1, zc, bw + 2.0, len + 1.6);
    // A knitted wool scarf, thrown over the front edge of the bench: a short end lies on the board, the long end hangs down in front with two pale stripes and a fringe.
    { const sz = -12.5, sw = 0.96, ex = bx + bw / 2, Rr = 0.1, L1 = 1.0, L2 = (Rr + 0.04) * PI / 2, HG = 2.25, LT = L1 + L2 + HG, nu = 8, nv = 32, RUST = new THREE.Color('#a4472e'), CREAM = new THREE.Color('#e4d3b2'), cs = new THREE.Color();
      const path = (s) => { if (s < L1) return [ex - Rr - (L1 - s), ST + 0.04]; if (s < L1 + L2) { const a = (s - L1) / (Rr + 0.04); return [ex - Rr + Math.sin(a) * (Rr + 0.04), ST - Rr + Math.cos(a) * (Rr + 0.04)]; } return [ex + 0.04, ST - Rr - (s - L1 - L2)]; };
      const fall = (u, v) => { const s = v * LT, [px, py] = path(s), hk = smooth(s, L1 + L2, L1 + L2 + 0.7), dn = Math.max(0, s - L1 - L2); return V3(px + hk * (0.05 * Math.sin(u * 6.5 + 1) + 0.035 * Math.sin(dn * 2.6 + 0.5)) + (s < L1 ? 0 : 0), py + (s < L1 ? 0.03 * Math.sin(u * 5 + s * 4) : 0), sz + (u - 0.5) * sw * (1 - 0.1 * hk * Math.sin(dn * 1.4)) + 0.1 * dn / HG); };
      const sc = sheet(nu, nv, fall, 0.09, 1.75, 6.4), M = (nu + 1) * (nv + 1), col = new Float32Array(M * 6);
      for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const k = j * (nu + 1) + i, e = (1 - j / nv) * LT, stripe = (e > 0.22 && e < 0.4) || (e > 0.52 && e < 0.6), fold = 0.86 + 0.14 * Math.sin(i / nu * 6.5 + 1) * smooth(j / nv * LT, L1 + L2, LT); cs.copy(stripe ? CREAM : RUST).multiplyScalar(fold * (0.95 + 0.08 * hash(i, j))); col.set([cs.r, cs.g, cs.b], k * 3); col.set([cs.r * 0.8, cs.g * 0.8, cs.b * 0.8], (M + k) * 3); }
      sc.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const bits = [sc.toNonIndexed(), tint(put(softBox(1.05, 0.3, 1.25, { r: 0.14, c: 3, flat: 2, top: 0.09, uv: 2.2 }), bx + 0.12, ST + 0.16, sz - 0.25, 0, 0.3, 0), '#9c432b')];      // the rest of it, in a soft heap on the board
      for (let i = 0; i < 11; i++) { const p = fall((i + 0.5) / 11, 1), l = 0.3 + 0.08 * hash(i, 4); bits.push(tint(cord([[p.x, p.y + 0.03, p.z], [p.x + 0.02 * Math.sin(i * 2.1), p.y - l * 0.5, p.z + 0.015 * Math.cos(i * 1.7)], [p.x + 0.035 * Math.sin(i * 1.3), p.y - l, p.z + 0.03 * Math.sin(i * 2.9)]], 0.024, 3, 5), i % 3 ? '#a4472e' : '#e4d3b2')); }      // the fringe: eleven tassels
      add(bake(mergeTinted(bits.map((q) => (q.index ? q.toNonIndexed() : q))), { amb: 0.82, key: 0.3 }), cloth('#ffffff', { vertexColors: true, map: knitC, normalMap: knitN, normalScale: V2(1.7, 1.7), sheen: 0.6, sheenColor: new THREE.Color('#d8a892') })); }
  }
  if (darkG.length) { const m = new THREE.Mesh(merge(darkG), new THREE.MeshBasicMaterial({ map: softRectT, color: '#120e0a', transparent: true, opacity: 0.26, depthWrite: false })); m.renderOrder = 1; kit.group.add(m); }

  /* ---------- the kitchen: cupboards by the back door, the cat's bowls, a pedal bin, a runner in front of the stove ---------- */
  { const cx = 7.5, cz = -52.45, sage = '#9fae9a', doors = [];
    ironG.push(put(new THREE.BoxGeometry(4.1, 0.6, 1.6), cx, 0.3, cz - 0.1));                                             // the toe kick, set back
    doors.push(put(softBox(4.4, 6.2, 1.9, { r: 0.06, c: 2, flat: 2 }), cx, 3.7, cz));
    for (let i = 0; i < 2; i++) { doors.push(put(softBox(2.05, 5.9, 0.12, { r: 0.05, c: 2, flat: 2 }), cx - 1.1 + i * 2.2, 3.72, cz + 0.98)); brassG.push(put(new THREE.SphereGeometry(0.13, 14, 10), cx + (i ? 0.3 : -0.3), 6.0, cz + 1.12)); }
    add(merge(doors), lacquer(sage));
    woodG.push(put(softBox(4.6, 0.32, 2.2, { r: 0.08, c: 2, flat: 2, uv: 0.6 }), cx, 6.96, cz + 0.08)); sit(cx, cz + 0.4, 5.8, 3.4);
    // two bowls on a mat
    const bx = -4.9, bz = -51.7, bowl = (x, z, col) => rubberG.push(tint(lathe([[0.001, 0.03], [0.62, 0.03], [0.7, 0.1], [0.9, 0.56], [0.93, 0.66], [0.86, 0.68], [0.72, 0.2], [0.001, 0.16]], 36), col).translate(x, 0.05, z));
    tinted.push(tint(put(softBox(4.4, 0.06, 2.4, { r: 0.025, c: 1, flat: 1 }), bx + 1, 0.03, bz, 0, 0.08, 0), '#3b4a5e'));
    bowl(bx, bz, PAL.accent); bowl(bx + 2.05, bz + 0.1, '#f1ece0'); sit(bx + 1, bz, 5, 3);
    for (let i = 0; i < 16; i++) tinted.push(tint(put(new THREE.IcosahedronGeometry(rr(0.09, 0.13), 0), bx + rr(-0.42, 0.42), 0.28 + rr(0, 0.06), bz + rr(-0.42, 0.42), rr(0, 3), rr(0, 3), 0), '#8a5a36'));      // kibble
    const water = new THREE.CircleGeometry(0.72, 24); water.rotateX(-PI / 2); add(put(water, bx + 2.05, 0.42, bz + 0.1), new THREE.MeshPhysicalMaterial({ color: '#bfdcea', roughness: 0.04, clearcoat: 1 }), { cast: false });
    // a brushed steel pedal bin between the back door and the cupboards
    add(merge([put(lathe([[0.001, 0.05], [0.82, 0.05], [0.9, 0.2], [0.92, 4.3], [0.85, 4.5], [0.001, 4.62]], 40), 4.15, 0, -52.3), put(softBox(0.9, 0.16, 0.5, { r: 0.06, c: 2, flat: 1 }), 4.15, 0.12, -51.25)]), steel); sit(4.15, -52.2, 2.5);
    // a woven runner in front of the stove
    const runC = (() => { const c = canvas(128, 256), k = c.getContext('2d'); k.fillStyle = '#d9cdb4'; k.fillRect(0, 0, 128, 256); k.fillStyle = PAL.face; for (const y of [18, 36, 214, 232]) k.fillRect(0, y, 128, 8); k.fillStyle = '#b9553a'; k.fillRect(0, 124, 128, 8); return c; })();
    const runM = new THREE.MeshStandardMaterial({ map: texOf(runC), normalMap: again(knitN, 5, 12), normalScale: V2(1.3, 1.3), roughness: 1 });
    onPhoto('wool-rug', (im) => { const c = canvas(256, 512), k = c.getContext('2d'); k.drawImage(runC, 0, 0, 256, 512); k.globalCompositeOperation = 'multiply'; k.drawImage(im, 0, 0, 256, 256); k.drawImage(im, 0, 256, 256, 256); swap(runM, { map: texOf(c) }); });
    add(sheet(10, 24, (u, v) => V3(1.6 + u * 2.4, 0.07 + 0.01 * Math.sin(v * 21 + u * 5), -50.6 + v * 5.4), 0.12), runM, { cast: false }); sit(2.8, -47.9, 3.2, 6.2);
  }

  /* ---------- the bedroom ---------- */
  { const bx = 22, z0 = -20.2, z1 = -34.2, bw = 12.4, zc = (z0 + z1) / 2, fab = '#5a72e4';
    // the frame: four legs, three rails, a headboard, and the slats you see from underneath
    for (const sx of [-1, 1]) for (const z of [z0 - 0.1, z1 + 0.1]) { woodG.push(put(softBox(0.8, 2.0, 0.8, { r: 0.1, c: 2, flat: 1, uv: 0.6 }), bx + sx * (bw / 2 - 0.1), 1.0, z)); sit(bx + sx * (bw / 2 - 0.1), z, 1.8); }
    for (const sx of [-1, 1]) woodG.push(put(softBox(0.5, 1.0, z0 - z1 + 0.6, { r: 0.1, c: 2, flat: 2, uv: 0.6 }), bx + sx * (bw / 2 + 0.05), 2.45, zc));
    woodG.push(put(softBox(bw + 0.6, 1.0, 0.5, { r: 0.1, c: 2, flat: 2, uv: 0.6 }), bx, 2.45, z1 - 0.15), put(softBox(bw + 1.0, 6.6, 0.55, { r: 0.16, c: 3, flat: 3, uv: 0.6 }), bx, 4.8, z0 + 0.45));
    const slats = []; for (let i = 0; i < 9; i++) slats.push(put(boxUV(new THREE.BoxGeometry(bw, 0.14, 0.95), 0.6), bx, 2.72, z0 - 0.9 - i * 1.56));
    add(merge(slats), wood('#8a765c', { roughness: 0.8 }), { cast: false });
    // the mattress, a linen duvet that hangs over the foot and the near side in folds, a mustard throw, two pillows
    add(put(softBox(bw, 1.9, z0 - z1, { r: 0.4, c: 4, flat: 5, top: 0.05, puff: 4, uv: 2.2 }), bx, 3.8, zc), linen('#efe9dc', { sheen: 0.25 }));
    const duvet = linen(fab, { vertexColors: true, sheen: 0.6 }), pleat = (u) => 0.5 + 0.34 * Math.sin(u * 23 + 0.7) + 0.16 * Math.sin(u * 51 + 2);
    const top = softBox(bw + 0.5, 0.95, 9.8, { r: 0.44, c: 4, flat: 6, top: 0.26, puff: 3, uv: 2.2, ao: [0, 0, 0.3, 0, 0, 0] }); put(top, bx, 5.15, z1 + 4.85);
    const hangFoot = sheet(46, 14, (u, v) => { const p = pleat(u), drop = 2.9 + 0.22 * Math.sin(u * 7); return V3(bx - bw / 2 - 0.2 + u * (bw + 0.4), 5.2 - v * drop, z1 - 0.5 - (0.1 + 0.3 * v) * p - 0.08 * Math.sin(v * PI)); }, 0.1, 6, 2, (u, v) => 1 - 0.4 * v * Math.pow(1 - pleat(u), 1.5));
    const hangSide = sheet(36, 14, (u, v) => { const p = pleat(u + 0.31), drop = 2.7 + 0.25 * Math.sin(u * 5 + 1); return V3(bx - bw / 2 - 0.4 - (0.1 + 0.3 * v) * p - 0.08 * Math.sin(v * PI), 5.2 - v * drop, z1 - 0.4 + u * 9.8); }, 0.1, 5, 2, (u, v) => 1 - 0.4 * v * Math.pow(1 - pleat(u + 0.31), 1.5));
    add(mergeTinted([top, hangFoot, hangSide]), duvet);
    add(put(softBox(bw + 0.7, 0.5, 2.3, { r: 0.22, c: 3, flat: 5, top: 0.12, puff: 3, uv: 2.2 }), bx, 5.72, z1 + 2.0), linen(PAL.accent, { sheen: 0.4 }));
    const pil = []; for (const sx of [-1, 1]) pil.push(put(softBox(5.2, 1.3, 3.2, { r: 0.6, c: 4, flat: 4, top: 0.25, puff: 2, pinch: 0.04, uv: 2.2 }), bx + sx * 3.0, 5.5, z0 - 2.3, 0.1, sx * 0.05, 0)); add(merge(pil), linen('#f4f0e6', { sheen: 0.3 }));
    // the dark under it, and what gets pushed under a bed: a storage box and a rolled yoga mat
    const dark = new THREE.Mesh(new THREE.PlaneGeometry(bw + 5, z0 - z1 + 5), new THREE.MeshBasicMaterial({ map: softRectT, color: '#0b0a10', transparent: true, opacity: 0.6, depthWrite: false })); dark.rotation.x = -PI / 2; dark.position.set(bx, 0.02, zc); dark.renderOrder = 1; kit.group.add(dark);
    add(put(softBox(5.6, 1.25, 4.2, { r: 0.07, c: 2, flat: 2, uv: 0.8 }), bx + 2.6, 0.63, zc + 1.5, 0, 0.12, 0), new THREE.MeshStandardMaterial({ color: '#b99a70', map: plasterC, roughness: 0.95 }));
    cloths.push(tint(put(new THREE.CylinderGeometry(0.55, 0.55, 5.4, 22).rotateZ(PI / 2), bx - 2.4, 0.56, zc - 2.2, 0, 0.3, 0), '#7fb8a4'));
    // a bedside table with a brass knob, on four turned legs
    const nx = 13.4, nz = -21.6;
    woodG.push(put(softBox(3.2, 2.7, 3.0, { r: 0.12, c: 3, flat: 2, uv: 0.6 }), nx, 3.25, nz)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { woodG.push(put(boxUV(new THREE.CylinderGeometry(0.16, 0.1, 1.9, 12), 0.6), nx + sx * 1.25, 0.95, nz + sz * 1.15)); sit(nx + sx * 1.25, nz + sz * 1.15, 0.7); }
    brassG.push(put(new THREE.SphereGeometry(0.14, 14, 10), nx, 3.3, nz - 1.56));
    // the wardrobe, floor to ceiling nearly: three doors, three knobs
    const wx = BED.x1 - 1.3, wz = -32.8; ironG.push(put(new THREE.BoxGeometry(1.7, 0.5, 11.6), wx + 0.1, 0.25, wz));
    const ward = [softBox(2.0, 12.3, 12, { r: 0.08, c: 2, flat: 3, uv: 0.6 }).translate(wx, 6.65, wz)]; for (let i = 0; i < 3; i++) { ward.push(softBox(0.12, 11.8, 3.82, { r: 0.05, c: 2, flat: 2, uv: 0.6 }).translate(wx - 1.04, 6.65, wz - 3.96 + i * 3.96)); brassG.push(put(new THREE.SphereGeometry(0.13, 14, 10), wx - 1.2, 5.9, wz - 3.96 + i * 3.96 + (i === 1 ? 0 : i ? -1.5 : 1.5))); }
    add(merge(ward), veneer('#c7a77c', [0.5, 0.25])); sit(wx - 0.4, wz, 4, 13.5);
    // a linen curtain down to the floor on each side of the window over the headboard
    const curtain = linen('#e3dbc9', { vertexColors: true, sheen: 0.35 });
    for (const cx of [bx - 8.4, bx + 8.4]) add(sheet(34, 12, (u, v) => { const f = 0.5 + 0.5 * Math.sin(u * 31 + cx); return V3(cx - 1.7 + u * 3.4 * (0.94 + 0.06 * v), 13.4 - v * 13.2, -19.5 - 0.12 - 0.42 * f * (0.5 + 0.5 * v)); }, 0.06, 2, 6, (u, v) => 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(u * 31 + cx))), curtain);
    brassG.push(put(new THREE.CylinderGeometry(0.09, 0.09, 21, 10).rotateZ(PI / 2), bx, 13.5, -19.75));
    // a round braided wool rug by the bed, and a pair of slippers on the boards beside it
    const rx = 14.0, rz = -30.6, ringC = (() => { const c = canvas(8, 256), k = c.getContext('2d'); for (let y = 0; y < 256; y++) { const b = Math.floor(y / 16) % 3; k.fillStyle = y > 236 ? PAL.face : b === 0 ? '#e9dfc8' : b === 1 ? '#d6c6a2' : '#c2ae86'; k.fillRect(0, y, 8, 1); } return texOf(c); })();
    add(put(lathe([[3.44, 0.0], [3.44, 0.07], [3.3, 0.13], [0.8, 0.14], [0.001, 0.13]], 64), rx, 0.006, rz), new THREE.MeshStandardMaterial({ map: ringC, normalMap: again(knitN, 26, 5), normalScale: V2(1.2, 1.2), roughness: 1 }), { cast: false }); sit(rx, rz, 8.2);
    slipper(1, 12.9, -25.7, 0.5); slipper(-1, 11.8, -26.2, 0.2);
  }

  /* ---------- the bath ---------- */
  { const tx = 18.6, tz = -54.4;
    // the tub: one long white side with a rolled rim and three framed panels, on a dark plinth, a tap over the far end
    add(merge([put(softBox(13.4, 4.6, 5.3, { r: 0.55, c: 5, flat: 6, uv: 1 }), tx, 2.75, tz), put(softBox(13.7, 0.5, 5.6, { r: 0.24, c: 3, flat: 6, uv: 1 }), tx, 5.0, tz)]), enamel); ironG.push(put(new THREE.BoxGeometry(12.6, 0.5, 4.6), tx, 0.25, tz)); sit(tx, tz + 0.6, 15.5, 7.6);
    { const fr = []; for (const [w, h, x, y] of [[11.8, 0.22, 0, 4.2], [11.8, 0.22, 0, 1.15], [0.22, 3.27, -5.8, 2.67], [0.22, 3.27, 5.8, 2.67], [0.2, 3.05, -1.95, 2.67], [0.2, 3.05, 1.95, 2.67]]) fr.push(put(softBox(w, h, 0.14, { r: 0.05, c: 2, flat: 1 }), tx + x, y, tz + 2.68)); add(merge(fr), enamel, { cast: false }); }
    add(merge([put(new THREE.CylinderGeometry(0.16, 0.16, 2.0, 16), tx - 5.4, 6.2, tz + 1.2), put(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 12).rotateX(PI / 2), tx - 5.4, 7.0, tz + 1.9), put(new THREE.SphereGeometry(0.24, 14, 10), tx - 5.4, 7.25, tz + 1.2)]), steel);
    // a linen towel over the rim: striped, hanging in folds
    const towelC = (() => { const c = canvas(128, 512), k = c.getContext('2d'); k.fillStyle = '#f1eadb'; k.fillRect(0, 0, 128, 512); k.fillStyle = PAL.face; for (const y of [300, 336, 372]) k.fillRect(0, y, 128, 16); k.fillStyle = PAL.accent; k.fillRect(0, 440, 128, 8); return c; })();
    const towelM = new THREE.MeshStandardMaterial({ map: texOf(towelC), normalMap: again(knitN, 6, 14), roughness: 1 });
    onPhoto('linen', (im) => { const c = canvas(256, 1024), k = c.getContext('2d'); k.drawImage(towelC, 0, 0, 256, 1024); k.globalCompositeOperation = 'multiply'; for (let j = 0; j < 4; j++) k.drawImage(im, 0, j * 256, 256, 256); swap(towelM, { map: texOf(c), normalMap: photoRelief(im, 2.2, [1, 4]) }); });
    add(sheet(20, 44, (u, v) => { const s = v * 6.4, x = tx + 3.2 + (u - 0.5) * 3.0 * (0.86 + 0.14 * smooth(Math.abs(s - 2.4), 0, 2)), f = 0.5 + 0.5 * Math.sin(u * 17 + 1); const zr = tz + 2.8;
      if (s < 2.0) return V3(x, 5.3 + 0.03 * f, zr - 2.0 + s); if (s < 2.6) { const a = (s - 2.0) / 0.6 * PI / 2; return V3(x, 5.0 + 0.3 * Math.cos(a), zr + 0.3 * Math.sin(a)); } return V3(x, 5.0 - (s - 2.6), zr + 0.3 + (0.03 + 0.1 * smooth(s - 2.6, 0, 1.6)) * f); }, 0.07), towelM);
    // the bath mat: thick wool with a blue border
    const matC = (() => { const c = canvas(256, 160), k = c.getContext('2d'); k.fillStyle = '#ece5d4'; k.fillRect(0, 0, 256, 160); k.strokeStyle = PAL.face; k.lineWidth = 9; k.strokeRect(16, 16, 224, 128); return c; })();
    const matM = new THREE.MeshStandardMaterial({ map: texOf(matC), normalMap: again(knitN, 12, 7), normalScale: V2(1.5, 1.5), roughness: 1 });
    onPhoto('wool-rug', (im) => { const c = canvas(512, 320), k = c.getContext('2d'); k.drawImage(matC, 0, 0, 512, 320); k.globalCompositeOperation = 'multiply'; k.drawImage(im, 0, 0, 256, 320); k.drawImage(im, 256, 0, 256, 320); swap(matM, { map: texOf(c), normalMap: photoRelief(im, 3, [2, 1.3]) }); });
    add(sheet(28, 16, (u, v) => V3(tx - 2.9 + u * 5.8, 0.13 + 0.012 * Math.sin(u * 19 + v * 7), -48.2 - v * 3.3), 0.24), matM, { cast: false }); sit(tx, -49.85, 6.9, 4.4);
    // the duck
    const dk = V3(22.9, 0, -50.4), duck = [tint(new THREE.SphereGeometry(0.62, 28, 20).scale(1.25, 0.82, 1).translate(0, 0.5, 0), PAL.accent), tint(new THREE.SphereGeometry(0.4, 24, 16).translate(0.5, 1.12, 0), PAL.accent), tint(new THREE.ConeGeometry(0.3, 0.5, 16).scale(1, 1, 0.6).rotateZ(PI / 2 + 0.5).translate(-0.82, 0.74, 0), PAL.accent),
      tint(new THREE.ConeGeometry(0.16, 0.36, 12).scale(1, 1, 1.5).rotateZ(-PI / 2).translate(0.98, 1.06, 0), '#ee6a2c'), ...[-1, 1].map((s) => tint(new THREE.SphereGeometry(0.055, 8, 6).translate(0.78, 1.24, s * 0.24), '#15151a'))];
    rubberG.push(put(mergeTinted(duck), dk.x, 0.02, dk.z, 0, 2.5, 0)); sit(dk.x, dk.z, 2.2);
    // the toilet against the tiled wall, and a woven laundry basket with a towel thrown over it
    const px = 12.9, pz = -49.6;
    add(merge([put(lathe([[0.001, 0], [1.05, 0], [1.12, 0.12], [0.95, 0.9], [0.86, 2.2], [1.1, 3.2], [1.5, 3.95], [1.58, 4.3], [1.5, 4.42], [0.001, 4.42]], 36).scale(1.25, 1, 1), px, 0, pz), put(softBox(1.5, 4.2, 3.4, { r: 0.22, c: 3, flat: 3 }), 11.1, 6.4, pz), put(softBox(3.3, 0.24, 3.0, { r: 0.12, c: 2, flat: 3 }), px + 0.1, 4.55, pz)]), enamel); sit(px, pz, 4.2, 3.6);
    const lx = BATH.x1 - 2.4, lz = -46.4;
    add(put(lathe([[0.001, 0.06], [1.35, 0.06], [1.5, 0.3], [1.8, 4.5], [1.92, 4.72], [1.78, 4.8], [1.66, 4.5]], 40), lx, 0, lz), new THREE.MeshStandardMaterial({ color: '#c9b089', normalMap: again(weaveN, 9, 4), normalScale: V2(1.6, 1.6), roughness: 1, side: THREE.DoubleSide })); sit(lx, lz, 4.6);
    add(put(softBox(2.9, 1.1, 2.9, { r: 0.5, c: 4, flat: 3, top: 0.3, puff: 2, uv: 2.2 }), lx + 0.2, 4.9, lz, 0.1, 0.4, -0.12), linen('#f1eadb', { sheen: 0.3 }));
  }

  { const c = canvas(256, 256), k = c.getContext('2d'); k.fillStyle = '#b0b0b0'; k.fillRect(0, 0, 256, 256); for (let i = 0; i < 1400; i++) { const v = hash(i, 3) > 0.5 ? 255 : 0; k.fillStyle = `rgba(${v},${v},${v},${0.05 + 0.12 * hash(i, 7)})`; k.fillRect(hash(i, 11) * 256 - 60, hash(i, 13) * 256, 30 + hash(i, 17) * 120, 1); }      // door furniture: satin brass, brushed along its length, so it is gold and not a dark mirror
    const brushed = texOf(c, { srgb: false, rep: [0.7, 2.4] }); add(merge(plateG), new THREE.MeshStandardMaterial({ color: '#cfae5e', metalness: 0.62, roughness: 0.8, roughnessMap: brushed, bumpMap: brushed, bumpScale: 0.12, envMapIntensity: 1.5 })); }
  add(mergeTinted(rubberG), rubber); add(merge(ironG), iron); add(merge(woodG), veneer('#c2a078')); add(merge(blueG), lacquer(PAL.face));
  { const all = trim.concat(trim2); add(merge(all), glossM); }

  /* ---------- the walk: the way he goes, room by room, and the way out ---------- */
  // Each room's stretch starts at its doorway. stop marks a place where he stands for a while (under the sofa, in front of the stove).
  const tour = [
    [[0, -6.5], [0.2, -12.6], [0, -19.3]],
    [[0, -19.3], [-0.2, -24.0], [0, -28.4], [0, -31.3, 'sofa'], [0, -36.4], [2.6, -38.5], [6.6, -37.9], [10, -37.7]],
    [[10, -37.7], [13.6, -37.2], [18.0, -36.9], [21.2, -37.7], [22, -40.3]],
    [[22, -40.3], [21.3, -43.6], [18.8, -46.6], [14.6, -45.4], [11.6, -43.3], [10, -43.1]],
    [[10, -43.1], [6.0, -43.3], [2.4, -44.8], [0.5, -46.8, 'stove']],
  ];
  const exit = [[0.5, -50.5], [0.5, -53.9], [0.5, -58.8]];      // from the stove to the back door, and out
  // What he will remember, where no lock-on tag already says it: where the pin stands, how tall it is, what it is called.
  const pins = [
    { room: 0, p: [4.4, -15.6], h: 2.3, name: 'Dock' },
    { room: 2, p: [14.6, -26.4], h: 2.6, name: 'Your side' },
    { room: 3, p: [24.3, -50.2], h: 2.0, name: 'Duck' },
  ];
  // What his eye turns to on the way: in this room, at this share of it, this point, this strongly, for this long.
  const looks = [
    { room: 0, at: 0.25, span: 0.5, w: 0.55, p: [-4.0, 1.4, -13.5] },     // the boots and the bench
    { room: 0, at: 0.8, span: 0.4, w: 0.4, p: [4.4, 0.6, -15.6] },        // the dock
    { room: 1, at: 0.1, span: 0.13, w: 0.62, p: [WX, 7.6, -24.2] },        // as he comes into the living room: the window, and the garden behind it
    { room: 1, at: 0.7, span: 0.25, w: 0.6, p: [-3.0, 1.2, -40.5] },      // out from under the sofa: the cat on the rug
    { room: 2, at: 0.1, span: 0.16, w: 0.6, p: [22, 10.5, -19.2] },         // the bedroom window, high up
    { room: 2, at: 0.55, span: 0.6, w: 0.8, p: [20, 2.6, -31] },          // the bed, from below
    { room: 3, at: 0.38, span: 0.5, w: 0.75, p: [21.8, 1.0, -51.6] },     // the side of the tub, the towel, the duck
    { room: 4, at: 0.2, span: 0.5, w: 0.5, p: [-6.5, 1.6, -49.6] },       // the kitchen table and its chair: a forest of legs
    { room: 4, at: 0.56, span: 0.2, w: 0.55, p: [WX, 8.0, -49.4] },        // and over the table, the kitchen window
  ];
  return { rooms: ROOMS, tour, exit, pins, looks, doors: DOOR, dockAt: [4.4, -15.6], garden, cage };
}
