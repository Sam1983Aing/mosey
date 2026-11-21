// The place behind MEET MOSEY: his drawing sheet. A paper wall behind the name with his engineering drawing on it, a front view and a side view,
// drawn line by line as the page opens, with a scan line that never stops. ?hero=plain leaves it out (the empty hero of before, for comparing).
//
// The two views are not drawn by hand. They are made from the robot the page loads (the Blender model): every edge of the model where two faces meet at more
// than 30 degrees, or where the surface turns away from you, flattened along the view. An edge is kept only where nothing stands in front of it, which is found
// with a small depth picture of the model, made here on the processor. If the page runs with a robot that has no such model, the views fall back to boxes
// measured from him by hand.
//
// Where the views stand is worked out from the picture: the rectangles the letters cover on the wall, as the camera has them, leave free corners, and the views
// are made as large as those corners allow. It is worked out again when the window changes shape. Nothing here adds a render pass.
//
// The paper is one sheet, hung like a photographer's backdrop roll: down the wall, round a soft curve and out along the floor toward you, where it fades into the
// page's own floor. So there is no line where a wall meets a floor. The grid is drawn by the shader in the sheet's own measure (across, and along its length),
// which is why its lines run straight down the wall, round the curve and on across the floor.
export function createHeroBackdrop(ctx) {
  const { THREE, scene, renderer, BX, heroType, tall, coarse, DROP_D, MONO, robot, reduceMotion, restCam } = ctx;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const root = new THREE.Group(); root.position.set(BX, 0, 0); scene.add(root);
  const ZW = -2.6;                      // where the wall stands, behind the letters (they are at z 0)

  // a fine paper grain that tiles
  const grainT = (() => { const c = canvas(256, 256), k = c.getContext('2d'), im = k.createImageData(256, 256); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < im.data.length; i += 4) { const v = 118 + r() * 40; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } k.putImageData(im, 0, 0);
    k.globalAlpha = 0.5; for (let i = 0; i < 90; i++) { const x = r() * 256, y = r() * 256, rad = 14 + r() * 40, g = k.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, r() > 0.5 ? 'rgba(160,160,160,0.5)' : 'rgba(96,96,96,0.5)'); g.addColorStop(1, 'rgba(128,128,128,0)'); k.fillStyle = g; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) k.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t; })();

  // The wall: one plane, 46 wide and 18 high, with its own small shader (no lights). Two meshes share it. The opaque one is what stands there. The other is the same
  // wall drawn see-through, only for the half second it takes to go and to come back.
  // uInk is the drawing: red is how much graphite, green is when that bit of line gets drawn. uDim is the one line that is measured again now and then.
  const U = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uT: { value: 0 }, uK: { value: 1 }, uGrain: { value: grainT }, uPhoto: { value: grainT }, uPhotoK: { value: 0 },
    uPaper: { value: new THREE.Color('#ebe3d4') }, uInkCol: { value: new THREE.Color('#2b2b30') }, uInk: { value: null }, uInkK: { value: 0.7 }, uRegion: { value: new THREE.Vector4(0, 0, 1, 1) }, uReveal: { value: 0 },
    uSpan: { value: new THREE.Vector2(-13, 13) }, uCross: { value: new THREE.Vector2(2.9, 1.2) }, uLive: { value: reduceMotion ? 0 : 1 }, uDim: { value: new THREE.Vector4(0, 0, 1, 0.1) }, uDimK: { value: 1 }, uLineW: { value: 1 }, uCM: { value: 0.1 } };
  const wallMat = (seeThrough) => new THREE.ShaderMaterial({ uniforms: U, fog: true, transparent: seeThrough, depthWrite: !seeThrough, toneMapped: false,
    vertexShader: `attribute vec2 sheet, aux; varying vec2 vW, vAux;\n#include <common>\n#include <fog_pars_vertex>\nvoid main() { vW = sheet; vAux = aux; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: `precision highp float; varying vec2 vW, vAux; uniform float uT, uK, uPhotoK, uReveal, uInkK, uLive, uDimK, uLineW, uCM; uniform vec3 uPaper, uInkCol; uniform vec2 uSpan, uCross; uniform vec4 uRegion, uDim; uniform sampler2D uGrain, uPhoto, uInk;
      #include <common>
      #include <fog_pars_fragment>
      void main() {
        float grain = mix(texture2D(uGrain, vW * 0.33).r, texture2D(uPhoto, vW * 0.11).r, uPhotoK);
        vec3 col = uPaper * (0.965 + 0.07 * grain) * (1.0 - 0.04 * smoothstep(1.4, 0.0, vW.y) - 0.035 * vAux.x);      // a little darker toward the foot of the wall, and a touch more in the curve, which is what makes it read as one sheet
        // the grid: a line every centimetre of the robot at the scale he is drawn, a darker one every five. In the sheet's own measure, so it follows the paper round the curve
        vec2 fw = fwidth(vW), g1 = abs(fract(vW / uCM + 0.5) - 0.5) * uCM, g5 = abs(fract(vW / (uCM * 5.0) + 0.5) - 0.5) * uCM * 5.0; float lw = 0.0032;
        vec2 l1 = (1.0 - smoothstep(vec2(lw), vec2(lw) + fw, g1)) * lw / (lw + fw * 0.5), l5 = (1.0 - smoothstep(vec2(lw), vec2(lw) + fw, g5)) * lw / (lw + fw * 0.5);
        float grid = max(max(l1.x, l1.y) * 0.4 * (1.0 - smoothstep(uCM * 0.25, uCM * 0.6, max(fw.x, fw.y))), max(l5.x, l5.y) * 0.75);      // far off along the floor the fine lines close up and are let go
        vec2 uv = (vW - uRegion.xy) / uRegion.zw; float ink = 0.0;
        if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) { vec4 d = texture2D(uInk, uv); ink = d.r * smoothstep(d.g - 0.012, d.g + 0.012, uReveal); }
        // the height is measured again now and then: its line is taken away and drawn again from the floor up, with a small mark riding on the end of it
        float inDim = step(abs(vW.x - uDim.x), uDim.w) * step(uDim.y - 0.12, vW.y) * step(vW.y, uDim.z + 0.12), dy = uDim.y + (uDim.z - uDim.y) * uDimK;
        ink = mix(ink, min(ink, 0.24), inDim * step(dy, vW.y) * step(uDimK, 0.999));
        float mark = inDim * step(uDimK, 0.999) * (1.0 - smoothstep(0.0, 0.03 * uLineW, abs(vW.y - dy))) * step(abs(vW.x - uDim.x), uDim.w * 0.8);
        // a thin scan line that crosses the sheet from edge to edge, with a small crosshair riding on it
        float w = uSpan.y - uSpan.x, sx = uSpan.x + mod(uT * 0.4, w + 2.0) - 1.0, cy = uCross.x + uCross.y * sin(uT * 0.23), on = uLive * step(1.0, uReveal);
        float scan = (1.0 - smoothstep(0.0, 0.014 * uLineW, abs(vW.x - sx))) * 0.42 + (1.0 - smoothstep(0.0, 0.7, sx - vW.x)) * step(vW.x, sx) * 0.05;
        float cross = max((1.0 - smoothstep(0.008 * uLineW, 0.02 * uLineW, abs(vW.y - cy))) * step(abs(vW.x - sx), 0.24), (1.0 - smoothstep(0.012 * uLineW, 0.03 * uLineW, abs(length(vW - vec2(sx, cy)) - 0.12))));
        col = mix(col, uInkCol, clamp(ink * uInkK + grid * 0.3 + (scan * 0.5 + cross * 0.4 + mark * 0.7) * on, 0.0, 0.8));
        gl_FragColor = vec4(col, uK * smoothstep(0.0, 1.0, vAux.y));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  // The sheet's shape, as a strip from the top of the wall to its end on the floor. R is the curve where it leaves the wall. Every corner knows where it is on the
  // sheet (across, and along its length: on the wall that is its height, and it runs on below nought round the curve and along the floor), how far into the curve it is,
  // and how much of the paper is left there: the last stretch toward you thins out into the page's own floor.
  const R = 0.62, FLOOR_Y = 0.012, FADE0 = 0.7 - ZW, FADE1 = 3.5 - ZW, HALF = 23;      // FADE0, FADE1: where the paper starts to thin and where it is gone, measured from the wall toward you
  const strip = (rows) => { const pos = [], sh = [], aux = [], idx = []; rows.forEach(([y, z, ys, cove, left], i) => { for (const x of [-HALF, HALF]) { pos.push(x, y, z); sh.push(x, ys); aux.push(cove, left); } if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('sheet', new THREE.Float32BufferAttribute(sh, 2)); g.setAttribute('aux', new THREE.Float32BufferAttribute(aux, 2)); g.setIndex(idx); return g; };
  const coveRows = Array.from({ length: 29 }, (_, i) => { const a = i / 28 * Math.PI / 2; return [FLOOR_Y + R - R * Math.sin(a), R - R * Math.cos(a), R - R * a, Math.sin(a * 2), 1]; }), END = R - R * Math.PI / 2;      // END: where on the sheet's length the curve meets the floor
  const geo = strip([[18, 0, 18, 0, 1], [FLOOR_Y + R, 0, R, 0, 1], ...coveRows.slice(1), [FLOOR_Y, FADE0, END - (FADE0 - R), 0, 1]]), geoEnd = strip([[FLOOR_Y, FADE0, END - (FADE0 - R), 0, 1], [FLOOR_Y, FADE1, END - (FADE1 - R), 0, 0]]);
  const solidM = wallMat(false), thinM = wallMat(true), wall = new THREE.Mesh(geo, solidM), wallGo = new THREE.Mesh(geo, thinM), tail = new THREE.Mesh(geoEnd, thinM);      // the tail is always see-through. The rest is solid, and see-through only while it goes and comes back
  for (const m of [wall, wallGo, tail]) { m.position.z = ZW; m.frustumCulled = false; root.add(m); } wallGo.visible = false; wallGo.renderOrder = tail.renderOrder = -3;
  // The letters' shadows fall on the page's floor, which the paper now covers. So one more layer lies on the paper that shows nothing but shadow, and thins out with it.
  const shadeG = new THREE.BufferGeometry(); shadeG.setAttribute('position', new THREE.Float32BufferAttribute([-HALF, 0, R, HALF, 0, R, -HALF, 0, FADE0, HALF, 0, FADE0, -HALF, 0, FADE1, HALF, 0, FADE1], 3)); shadeG.setAttribute('left', new THREE.Float32BufferAttribute([1, 1, 1, 1, 0, 0], 1)); shadeG.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]); shadeG.computeVertexNormals();
  const SHADE = 0.085, shadeM = new THREE.ShadowMaterial({ opacity: SHADE, transparent: true, depthWrite: false });
  shadeM.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float left; varying float vLeft;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeft = left;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLeft;').replace('opacity * ( 1.0 - getShadowMask() )', 'opacity * smoothstep(0.0, 1.0, vLeft) * ( 1.0 - getShadowMask() )'); };
  const shade = new THREE.Mesh(shadeG, shadeM); shade.position.set(0, FLOOR_Y + 0.006, ZW); shade.receiveShadow = true; shade.frustumCulled = false; shade.renderOrder = -2; root.add(shade);
  // real paper grain, from the photograph the home already uses for its plaster. It comes in as a slow blend, never as a jump
  const st = { k: -1, lastNow: 0, t0: -1, px: 0, photo: false, laid: false, laidAt: 0, again: false, dimT: 0, shape: '' };
  { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { const c = canvas(512, 512), k = c.getContext('2d'); k.filter = 'grayscale(1) contrast(1.5)'; k.drawImage(im, 0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.colorSpace = THREE.NoColorSpace; U.uPhoto.value = t; st.photo = true; }; im.src = 'media/home/wall-paint.jpg'; }

  /* ---------- the two views, from the model ---------- */
  // Each view comes back as line pieces in the robot's own measure (he is 1.15 tall, his feet on y 0): [x0, y0, x1, y1, kind]. kind 2 is an outline (the surface
  // turns away there, or ends), 1 an edge on the surface, 0 an edge of a pane of glass.
  const modelViews = () => {
    const meshes = []; robot?.root?.traverse((o) => { if (o.isSkinnedMesh && o.geometry?.attributes.position) meshes.push(o); }); if (!meshes.length) return null;
    const v = V3(), parts = []; let lo = V3(1e9, 1e9, 1e9), hi = V3(-1e9, -1e9, -1e9);
    for (const o of meshes) { const pos = o.geometry.attributes.position, n = pos.count, id = new Int32Array(n), P = [], seen = new Map();      // the pose it was modelled in, and corners that share a place made one corner
      for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix); const key = Math.round(v.x * 2e4) + '_' + Math.round(v.y * 2e4) + '_' + Math.round(v.z * 2e4); let j = seen.get(key);
        if (j === undefined) { j = P.length / 3; seen.set(key, j); P.push(v.x, v.y, v.z); lo.min(v); hi.max(v); } id[i] = j; }
      const ix = o.geometry.index ? o.geometry.index.array : null, nt = (ix ? ix.length : n) / 3, T = new Int32Array(nt * 3); for (let i = 0; i < nt * 3; i++) T[i] = id[ix ? ix[i] : i];
      const m = [].concat(o.material)[0]; parts.push({ P, T, glass: !!(m && (m.userData.glass || m.transparent)) }); }
    const K = 1.15 / (hi.y - lo.y), cx = (lo.x + hi.x) / 2, cz = (lo.z + hi.z) / 2;
    for (const p of parts) { const P = p.P; for (let i = 0; i < P.length; i += 3) { P[i] = (P[i] - cx) * K; P[i + 1] = (P[i + 1] - lo.y) * K; P[i + 2] = (P[i + 2] - cz) * K; } }
    const COS = Math.cos(30 * Math.PI / 180), RES = 420, BIAS = 0.014;
    const view = (side) => {      // front: across is x, toward you is z. side: across is -z (he faces left), toward you is x
      const A = (P, i) => (side ? -P[i * 3 + 2] : P[i * 3]), Zd = (P, i) => (side ? P[i * 3] : P[i * 3 + 2]), Yv = (P, i) => P[i * 3 + 1];
      let x0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of parts) for (let i = 0; i < p.P.length / 3; i++) { x0 = Math.min(x0, A(p.P, i)); x1 = Math.max(x1, A(p.P, i)); y1 = Math.max(y1, Yv(p.P, i)); }
      const W = Math.ceil((x1 - x0) * RES) + 6, Hh = Math.ceil(y1 * RES) + 6, zb = new Float32Array(W * Hh).fill(-1e9), px = (x) => (x - x0) * RES + 3, py = (y) => y * RES + 3;
      // the depth picture: every solid face that looks at you, the nearest one kept in each dot
      const faces = parts.map((p) => { const nt = p.T.length / 3, front = new Uint8Array(nt), N = new Float32Array(nt * 3);
        for (let t = 0; t < nt; t++) { const a = p.T[t * 3], b = p.T[t * 3 + 1], c = p.T[t * 3 + 2], P = p.P;
          const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2], wx = P[c * 3] - P[a * 3], wy = P[c * 3 + 1] - P[a * 3 + 1], wz = P[c * 3 + 2] - P[a * 3 + 2];
          let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; N[t * 3] = nx; N[t * 3 + 1] = ny; N[t * 3 + 2] = nz;
          front[t] = (side ? nx : nz) > 1e-4 ? 1 : 0; if (!front[t] || p.glass) continue;
          const ax = px(A(P, a)), ay = py(Yv(P, a)), az = Zd(P, a), bx = px(A(P, b)), by = py(Yv(P, b)), bz = Zd(P, b), qx = px(A(P, c)), qy = py(Yv(P, c)), qz = Zd(P, c), den = (by - qy) * (ax - qx) + (qx - bx) * (ay - qy); if (Math.abs(den) < 1e-9) continue;
          const i0 = Math.max(0, Math.floor(Math.min(ax, bx, qx))), i1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, qx))), j0 = Math.max(0, Math.floor(Math.min(ay, by, qy))), j1 = Math.min(Hh - 1, Math.ceil(Math.max(ay, by, qy)));
          for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const l0 = ((by - qy) * (i - qx) + (qx - bx) * (j - qy)) / den, l1 = ((qy - ay) * (i - qx) + (ax - qx) * (j - qy)) / den, l2 = 1 - l0 - l1;
            if (l0 < -0.02 || l1 < -0.02 || l2 < -0.02) continue; const z = l0 * az + l1 * bz + l2 * qz, k = j * W + i; if (z > zb[k]) zb[k] = z; } }
        return { front, N }; });
      const behind = (x, y) => { const i = Math.round(px(x)), j = Math.round(py(y)); let m = 1e9; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; m = Math.min(m, ii < 0 || jj < 0 || ii >= W || jj >= Hh ? -1e9 : zb[jj * W + ii]); } return m; };      // the furthest thing in the dots round this place
      const out = [];
      parts.forEach((p, pi) => { const { front, N } = faces[pi], nt = p.T.length / 3, nv = p.P.length / 3, edges = new Map();
        for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) { const a = p.T[t * 3 + e], b = p.T[t * 3 + (e + 1) % 3]; if (a === b) continue; const key = a < b ? a * nv + b : b * nv + a, rec = edges.get(key); if (rec) rec.push(t); else edges.set(key, [a, b, t]); }
        for (const rec of edges.values()) { const [a, b, t0, t1] = rec; let kind = -1;
          if (t1 === undefined) kind = front[t0] ? 2 : -1;                                                        // where the surface ends
          else if (front[t0] !== front[t1]) kind = 2;                                                           // where it turns away from you
          else if (front[t0] && N[t0 * 3] * N[t1 * 3] + N[t0 * 3 + 1] * N[t1 * 3 + 1] + N[t0 * 3 + 2] * N[t1 * 3 + 2] < COS) kind = 1;      // a real edge on the side you see
          if (kind < 0) continue; if (p.glass) kind = 0;
          const xa = A(p.P, a), ya = Yv(p.P, a), za = Zd(p.P, a), xb = A(p.P, b), yb = Yv(p.P, b), zb2 = Zd(p.P, b), n = Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya) * RES / 0.8)); let from = -1;
          for (let s = 0; s <= n + 1; s++) { const u = Math.min(1, s / n), vis = s <= n && lerp(za, zb2, u) + BIAS >= behind(lerp(xa, xb, u), lerp(ya, yb, u));
            if (vis && from < 0) from = s; else if (!vis && from >= 0) { const u0 = from / n, u1 = (s - 1) / n; if (s - 1 > from || n === 1) out.push([lerp(xa, xb, u0), lerp(ya, yb, u0), lerp(xa, xb, u1), lerp(ya, yb, u1), kind]); from = -1; } } } });
      return { segs: out, x0, x1, top: y1 };
    };
    // Where the model is fine work (the rings of the lens, the grille on his chest) the lines would run together into a black spot. So each piece is told how crowded
    // its own small square of the drawing is, and is drawn paler the more there is: fine work comes out as a grey tone, as hatching does on a real drawing.
    const thin = (vw) => { const C = 0.012, cols = Math.ceil((vw.x1 - vw.x0) / C) + 2, den = new Float32Array(cols * (Math.ceil(vw.top / C) + 2)), cell = (s) => Math.floor((s[1] + s[3]) / 2 / C) * cols + Math.floor(((s[0] + s[2]) / 2 - vw.x0) / C);
      for (const s of vw.segs) den[cell(s)] += Math.hypot(s[2] - s[0], s[3] - s[1]); for (const s of vw.segs) { const d = den[cell(s)] / C; s[5] = d < 3.2 ? 0 : d < 5 ? 1 : d < 8 ? 2 : 3; } return vw; };
    const t0 = performance.now(), front = thin(view(false)), side = thin(view(true));
    // two places the notes point at, read off the views: the front of the lens in the side view, and the antenna in the front view
    const sm = (side.x0 + side.x1) / 2, fm = (front.x0 + front.x1) / 2; let lensX = 0, antX = 0, n = 0;
    for (const s of side.segs) if (s[1] > 0.8 && s[1] < 0.92) lensX = Math.min(lensX, s[0] - sm, s[2] - sm);
    for (const s of front.segs) if (s[1] > front.top - 0.05) { antX += (s[0] + s[2]) / 2 - fm; n++; }
    return { front, side, lensX, antX: n ? antX / n : 0.1, ms: Math.round(performance.now() - t0), lines: front.segs.length + side.segs.length };
  };
  let model = null; try { model = modelViews(); } catch (e) { model = null; }
  if (model && (model.lines < 60 || model.lines > 30000)) model = null;      // nothing came of it, or far too much: the hand-built views are used

  /* ---------- the sheet: laid out in the picture as it is, and drawn on a canvas ---------- */
  let ink = null, ord = null, tex = null, ki, ko, CW = 0, CH = 0;
  const layout = () => {
    const small = tall(), camera = restCam(), cp = camera.position;
    // the picture on the wall: where its edges are, and the rectangle each letter of the name covers
    const onWall = (p) => { const t = (ZW - cp.z) / (p.z - cp.z); return [cp.x + (p.x - cp.x) * t - BX, cp.y + (p.y - cp.y) * t]; }, q = V3();
    const c00 = onWall(q.set(-1, -1, 0.5).unproject(camera)), c11 = onWall(q.set(1, 1, 0.5).unproject(camera)), FX0 = c00[0], FX1 = c11[0], FY1 = c11[1];
    const rects = heroType.map((L) => { let xa = 1e9, xb = -1e9, ya = 1e9, yb = -1e9; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const w = onWall(q.set(L.home.x + sx * L.half.x, L.home.y + sy * L.half.y, L.home.z + sz * L.half.z)); xa = Math.min(xa, w[0]); xb = Math.max(xb, w[0]); ya = Math.min(ya, w[1]); yb = Math.max(yb, w[1]); } return { xa, xb, ya, yb, y: L.home.y }; });
    const midY = (Math.min(...rects.map((r) => r.y)) + Math.max(...rects.map((r) => r.y))) / 2, top = rects.filter((r) => r.y > midY), bot = rects.filter((r) => r.y <= midY), both = bot.length && top.length;
    const ext = (list) => ({ xa: Math.min(...list.map((r) => r.xa)), xb: Math.max(...list.map((r) => r.xb)), ya: Math.min(...list.map((r) => r.ya)), yb: Math.max(...list.map((r) => r.yb)) });
    const TOP = ext(both ? top : rects), BOT = ext(both ? bot : rects), M = small ? 0.34 : Math.max(0.45, (FX1 - FX0) * 0.042), G = small ? 0.3 : 0.32, GV = 0.16, HEAD = FY1 - (small ? 84 : 100) * (FY1 - c00[1]) / innerHeight;      // M: clear of the picture's edge. G: clear of a letter to the side (the pointer moves the wall a little behind the letters). GV: clear of a letter above or below. HEAD: clear of the logo and the button across the top of the page, which are a fixed number of dots high whatever the window
    // how big the robot is drawn: as big as the free places allow
    const fw = model ? model.front.x1 - model.front.x0 : 0.56, sw = model ? model.side.x1 - model.side.x0 : 0.56, HT = model ? model.front.top : 1.19, LAB = 0.27, DIMW = 0.14;      // DIMW: a view is kept clear of the letters, its dimension line may come close to them
    let SC, FXc, SXc, FY, column = false;
    const BH = 0.62 * 0.6;      // how high the title block is on a phone
    if (small) { const w = FX1 - FX0 - 2 * M, y0 = TOP.yb + GV + 0.26 + BH + 0.36 - LAB, h = HEAD - y0; SC = clamp(Math.min((w - 1.5) / (fw + sw), (h - LAB) / HT), 0.9, 2.4); FY = y0 + LAB;      // on a phone: side by side above the name, with room under them for their labels, the small title block and some air
      const gap = (w - (fw + sw) * SC) / 3; FXc = FX0 + M + gap + fw * SC / 2; SXc = FX1 - M - gap - sw * SC / 2; }
    else { const fit = (x0, x1, y0, y1, w) => Math.min((x1 - x0 - DIMW) / w, (y1 - y0 - LAB) / HT);
      const cornerL = fit(FX0 + M, TOP.xa - G, BOT.yb + GV, HEAD, fw), cornerR = fit(TOP.xb + G, FX1 - M, BOT.yb + GV, HEAD, sw), colL = fit(FX0 + M, BOT.xa - G, 0.35, HEAD, fw), colR = fit(BOT.xb + G, FX1 - M, 0.35, HEAD, sw);
      const corner = Math.min(cornerL, cornerR), col = Math.min(colL, colR); column = col > corner; SC = clamp(Math.max(corner, col), 0.7, 2.3);
      const inL = (column ? BOT.xa : TOP.xa) - G, inR = (column ? BOT.xb : TOP.xb) + G; FY = (column ? 0.35 : BOT.yb + GV) + LAB;
      FXc = (FX0 + M + inL) / 2 - 0.1; SXc = (inR + FX1 - M) / 2 + 0.1; FY += Math.max(0, (HEAD - FY - HT * SC) * (column ? 0.45 : 0.3)); }
    // the canvas covers the picture and a little more, at as many dots as the card allows
    const RX0 = FX0 - 0.8, RW = FX1 - FX0 + 1.6, RH = Math.max(4, FY1 + 0.6), maxPx = Math.min(renderer.capabilities.maxTextureSize, coarse ? 2048 : 4096), PPU = Math.min(small ? 230 : 300, maxPx / RW, maxPx / RH), w = Math.round(RW * PPU), h = Math.round(RH * PPU);
    if (w !== CW || h !== CH) { CW = w; CH = h; ink = canvas(CW, CH); ord = canvas(CW, CH); ki = ink.getContext('2d'); ko = ord.getContext('2d'); tex?.dispose(); tex = new THREE.CanvasTexture(ink); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; U.uInk.value = tex; }
    const X = (x) => (x - RX0) * PPU, Y = (y) => (RH - y) * PPU, P = PPU / 200, WK = small ? 2.1 : clamp(1500 / innerWidth, 1, 1.5);      // WK: lines are drawn heavier where the picture is small, so they are as dark on a phone and in a small window
    for (const k of [ki, ko]) { k.globalCompositeOperation = 'source-over'; k.globalAlpha = 1; k.setLineDash([]); k.fillStyle = '#000'; k.fillRect(0, 0, CW, CH); k.lineCap = 'round'; k.lineJoin = 'round'; } ki.strokeStyle = ki.fillStyle = '#fff';
    const grey = (o) => { const v = Math.round(clamp(o, 0, 1) * 255); return `rgb(${v},${v},${v})`; };
    // a line through some places on the wall, drawn from order o0 to o1 along its length. a: how dark (1 is a full line). w: its width
    const pen = (pts, o0, o1, { a = 1, w = 2.6, dash = null, close = false } = {}) => { w *= WK; const p = close ? [...pts, pts[0]] : pts; let len = 0; const ls = [0]; for (let i = 1; i < p.length; i++) { len += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); ls.push(len); }
      ki.globalAlpha = a; ki.lineWidth = w * P; ki.setLineDash(dash ? dash.map((d) => d * PPU) : []); ki.beginPath(); p.forEach(([x, y], i) => (i ? ki.lineTo(X(x), Y(y)) : ki.moveTo(X(x), Y(y)))); ki.stroke(); ki.setLineDash([]);
      ko.lineWidth = w * P + 5; for (let i = 1; i < p.length; i++) { const g = ko.createLinearGradient(X(p[i - 1][0]), Y(p[i - 1][1]), X(p[i][0]), Y(p[i][1])); g.addColorStop(0, grey(lerp(o0, o1, ls[i - 1] / (len || 1)))); g.addColorStop(1, grey(lerp(o0, o1, ls[i] / (len || 1)))); ko.strokeStyle = g; ko.beginPath(); ko.moveTo(X(p[i - 1][0]), Y(p[i - 1][1])); ko.lineTo(X(p[i][0]), Y(p[i][1])); ko.stroke(); } };
    const circ = (cx, cy, r, o0, o1, o = {}) => pen(Array.from({ length: 48 }, (_, i) => [cx + Math.cos(i / 48 * 6.2832 + 1.2) * r, cy + Math.sin(i / 48 * 6.2832 + 1.2) * r]), o0, o1, { ...o, close: true });
    const rrect = (x0, y0, x1, y1, r, o0, o1, o = {}) => { const pts = []; for (const [cx, cy, a0] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 1], [x0 + r, y0 + r, 2], [x1 - r, y0 + r, 3]]) for (let i = 0; i <= 6; i++) { const a = (a0 + i / 6) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } pen(pts, o0, o1, { ...o, close: true }); };
    const text = (str, x, y, size, o, { align = 'left', rot = 0, a = 0.92, bold = false } = {}) => { const px = size * PPU; for (const k of [ki, ko]) { k.save(); k.translate(X(x), Y(y)); k.rotate(-rot); k.font = `${bold ? 700 : 500} ${px}px ${MONO}`; k.textAlign = align; k.textBaseline = 'middle'; try { k.letterSpacing = `${px * 0.12}px`; } catch (e) {} }
      ki.globalAlpha = a; ki.fillText(str, 0, 0); const wd = ki.measureText(str).width; ko.fillStyle = grey(o); ko.fillRect(align === 'center' ? -wd / 2 - 6 : align === 'right' ? -wd - 6 : -6, -px * 0.7, wd + 12, px * 1.4); ki.restore(); ko.restore(); };
    const CM = SC * 1.15 / 14; U.uCM.value = CM;      // the grid's square: a centimetre of the robot at the scale he is drawn (the shader draws the grid)
    const F = (x, y) => [FXc + x * SC, FY + y * SC], S = (x, y) => [SXc + x * SC, FY + y * SC];      // a place on the robot in the front view, and in the side view (which faces the name)
    let lensY = 0.86, lensX = -0.31, headY = robot?.headTop ?? 1.065, topY = 1.19, fHalf = 0.28, sHalf = 0.28, antX = 0.1;
    if (model) {
      // from the model: the pieces of each view go on in three weights, in the order of their height, so he is drawn from the feet up
      const LK = clamp(SC / 1.9, 0.7, 1), mid = (vw) => (vw.x0 + vw.x1) / 2, put = (vw, T, o0, o1) => { const cx = mid(vw); for (const kind of [1, 0, 2]) for (let lv = 0; lv < 4; lv++) { ki.globalAlpha = (kind === 2 ? 1 : kind === 1 ? 0.78 : 0.5) * [1, 0.7, 0.45, 0.28][lv]; ki.lineWidth = (kind === 2 ? 2.7 : 1.7) * WK * P * LK * (lv > 1 ? 0.8 : 1); ki.beginPath();
          for (const s of vw.segs) if (s[4] === kind && s[5] === lv) { const a = T(s[0] - cx, s[1]), b = T(s[2] - cx, s[3]); ki.moveTo(X(a[0]), Y(a[1])); ki.lineTo(X(b[0]), Y(b[1])); } ki.stroke(); }
        const NB = 28, buckets = Array.from({ length: NB }, () => []); for (const s of vw.segs) buckets[Math.min(NB - 1, Math.floor((s[1] + s[3]) / 2 / vw.top * NB))].push(s);
        ko.lineWidth = 2.9 * WK * P + 5; buckets.forEach((list, i) => { ko.strokeStyle = grey(lerp(o0, o1, (i + 0.5) / NB)); ko.beginPath(); for (const s of list) { const a = T(s[0] - cx, s[1]), b = T(s[2] - cx, s[3]); ko.moveTo(X(a[0]), Y(a[1])); ko.lineTo(X(b[0]), Y(b[1])); } ko.stroke(); }); };
      put(model.front, F, 0.02, 0.33); put(model.side, S, 0.34, 0.6);
      fHalf = fw / 2; sHalf = sw / 2; topY = model.front.top; lensX = model.lensX; antX = model.antX;
    } else {
      // by hand, measured from him: front view from the feet up, then the side view
      const o = { a: 1, w: 3 }, Sm = (x, y) => S(-x, y), box = (T, x0, y0, x1, y1, r, a, b, oo = o) => { const p0 = T(x0, y0), p1 = T(x1, y1); rrect(Math.min(p0[0], p1[0]), p0[1], Math.max(p0[0], p1[0]), p1[1], r * SC, a, b, oo); }, ring = (T, x, y, r, a, b, oo = o) => { const c = T(x, y); circ(c[0], c[1], r * SC, a, b, oo); };
      for (const sx of [-1, 1]) { box(F, sx * 0.04, 0, sx * 0.2, 0.07, 0.02, 0.02, 0.05); box(F, sx * 0.075, 0.07, sx * 0.165, 0.32, 0.02, 0.05, 0.09); ring(F, sx * 0.12, 0.2, 0.03, 0.09, 0.1, { a: 0.8, w: 2.2 }); }
      box(F, -0.2, 0.32, 0.2, 0.62, 0.05, 0.1, 0.15); ring(F, 0, 0.47, 0.072, 0.15, 0.17); ring(F, 0, 0.47, 0.046, 0.17, 0.18, { a: 0.7, w: 2 });
      for (const sx of [-1, 1]) { box(F, sx * 0.215, 0.26, sx * 0.275, 0.57, 0.025, 0.18, 0.21); ring(F, sx * 0.245, 0.57, 0.046, 0.21, 0.22); box(F, sx * 0.2, 0.19, sx * 0.29, 0.26, 0.025, 0.22, 0.23, { a: 0.85, w: 2.4 }); }
      box(F, -0.06, 0.62, 0.06, 0.655, 0.008, 0.23, 0.235); box(F, -0.25, 0.655, 0.25, 1.065, 0.07, 0.235, 0.3);
      ring(F, 0, 0.86, 0.125, 0.3, 0.32); ring(F, 0, 0.86, 0.085, 0.32, 0.33, { a: 0.8, w: 2.2 }); ring(F, 0, 0.86, 0.035, 0.33, 0.335, { a: 0.8, w: 2.2 });
      for (const sx of [-1, 1]) box(F, sx * 0.25, 0.8, sx * 0.275, 0.92, 0.008, 0.335, 0.34, { a: 0.8, w: 2.2 });
      pen([F(0.1, 1.065), F(0.1, 1.15)], 0.34, 0.345); ring(F, 0.1, 1.172, 0.022, 0.345, 0.35);
      box(Sm, -0.1, 0, 0.19, 0.07, 0.02, 0.36, 0.39); box(Sm, -0.05, 0.07, 0.05, 0.32, 0.02, 0.39, 0.42); ring(Sm, 0, 0.2, 0.03, 0.42, 0.425, { a: 0.8, w: 2.2 });
      box(Sm, -0.14, 0.32, 0.15, 0.62, 0.05, 0.425, 0.47); box(Sm, -0.04, 0.26, 0.04, 0.57, 0.025, 0.47, 0.5); ring(Sm, 0, 0.57, 0.046, 0.5, 0.505); box(Sm, -0.045, 0.19, 0.05, 0.26, 0.025, 0.505, 0.51, { a: 0.85, w: 2.4 });
      box(Sm, -0.05, 0.62, 0.05, 0.655, 0.008, 0.51, 0.515); box(Sm, -0.24, 0.655, 0.24, 1.065, 0.07, 0.515, 0.57); box(Sm, 0.24, 0.76, 0.31, 0.96, 0.012, 0.57, 0.585);
      pen([Sm(-0.02, 1.065), Sm(-0.02, 1.15)], 0.585, 0.59); ring(Sm, -0.02, 1.172, 0.022, 0.59, 0.595);
    }
    // centre lines, and the lines that carry the floor, the lens and the top of the head from one view to the other, behind the name
    const DD = [0.09, 0.03, 0.015, 0.03], xa = FXc - (fHalf + 0.16) * SC, xb = SXc + (sHalf + 0.16) * SC;
    pen([F(0, -0.1), F(0, topY + 0.1)], 0.6, 0.63, { a: 0.6, w: 1.8, dash: DD }); pen([S(0, -0.1), S(0, topY + 0.1)], 0.6, 0.63, { a: 0.6, w: 1.8, dash: DD });
    pen([[xa, FY], [xb, FY]], 0.63, 0.69, { a: 0.8, w: 2.2 }); pen([[xa, FY + headY * SC], [xb, FY + headY * SC]], 0.65, 0.71, { a: 0.5, w: 1.6, dash: [0.05, 0.04] }); pen([[xa, FY + lensY * SC], [xb, FY + lensY * SC]], 0.66, 0.72, { a: 0.5, w: 1.6, dash: DD });
    // what its lens throws: two thin lines opening out from the lens in the side view, toward the name
    { const l0 = S(lensX, lensY), len = 0.5 * SC; for (const sg of [-1, 1]) pen([l0, [l0[0] - len, l0[1] + sg * len * 0.36]], 0.72, 0.75, { a: 0.6, w: 1.8, dash: [0.06, 0.035] }); }
    // how tall, with its two end ticks: on the side of the front view that is toward the name
    const T = small ? 0.15 : clamp(0.075 * SC + 0.02, 0.1, 0.15), dx = FXc + (fHalf + 0.13) * SC, y0 = FY, y1 = FY + topY * SC;
    pen([[dx, y0], [dx, y1]], 0.75, 0.8, { a: 0.85, w: 1.9 }); for (const y of [y0, y1]) pen([[dx - 0.07, y - 0.07], [dx + 0.07, y + 0.07]], 0.8, 0.81, { a: 0.95, w: 2.4 });
    text('14 cm', dx + T * 1.05, y0 + (y1 - y0) * 0.5, T * 1.3, 0.86, { align: 'center', rot: Math.PI / 2, bold: true });
    U.uDim.value.set(dx, y0, y1, 0.04);
    // the notes
    text('FRONT', FXc, FY - 0.2, T, 0.88, { align: 'center', a: 0.8 }); text('SIDE', SXc, FY - 0.2, T, 0.89, { align: 'center', a: 0.8 });
    if (!small) { const l = S(lensX, lensY), len = 0.5 * SC; text('LENS', l[0] - len * 0.62, l[1] + len * 0.36 + T * 0.55, T * 0.86, 0.9, { align: 'center', a: 0.8 }); }
    // The title block is fine print: small, pale (about as strong as the grid's heavier lines), and in the middle of the sheet between the two views. On a wide
    // screen it sits between the two lines that run from one view to the other, the top of his head and his lens: they are its top and bottom edge, so it is part
    // of the drawing and not a box floating on it. That is above the name, where the letters do not cover it. On a phone it sits under the two views and their
    // labels, above the name. It is nowhere near PRESS. It is still the last thing to be drawn.
    { const h = small ? 0.6 * 0.62 : (headY - lensY) * SC, k = h / 0.6, bw = (small ? 4.3 : 4.1) * k, xc = small ? (FX0 + FX1) / 2 : (FXc + SXc) / 2, x0 = xc - bw / 2, x1 = xc + bw / 2, yb1 = small ? FY - 0.36 : FY + headY * SC, yb0 = yb1 - h, a = 0.42, w = small ? 1.1 : 1.5;
      if (small) pen([[x0, yb1], [x0, yb0], [x1, yb0], [x1, yb1]], 0.93, 0.96, { a, w, close: true }); else { pen([[x0, yb0], [x0, yb1]], 0.93, 0.95, { a, w }); pen([[x1, yb0], [x1, yb1]], 0.94, 0.96, { a, w }); } pen([[x0, yb0 + h * 0.44], [x1, yb0 + h * 0.44]], 0.95, 0.96, { a: a * 0.8, w: w * 0.8 }); pen([[x1 - bw * 0.3, yb0 + h * 0.44], [x1 - bw * 0.3, yb1]], 0.955, 0.965, { a: a * 0.8, w: w * 0.8 });
      text('GOOD COMPANY', x0 + 0.2 * k, yb0 + h * 0.72, 0.33 * h, 0.97, { bold: true, a: 0.5 }); text('SHEET 01', x1 - 0.2 * k, yb0 + h * 0.72, 0.22 * h, 0.975, { align: 'right', a: 0.46 }); text('MOSEY · FIRST EDITION · 14 CM · 310 G', x0 + 0.2 * k, yb0 + h * 0.22, Math.min(0.235 * h, (bw - 0.4 * k) / 26.5), 0.99, { a: 0.46 }); }
    // the two canvases become one picture: graphite in red, order in green
    for (const [k, col] of [[ki, '#ff0000'], [ko, '#00ff00']]) { k.globalAlpha = 1; k.globalCompositeOperation = 'multiply'; k.fillStyle = col; k.fillRect(0, 0, CW, CH); }
    ki.globalCompositeOperation = 'lighter'; ki.drawImage(ord, 0, 0);
    tex.needsUpdate = true; U.uRegion.value.set(RX0, 0, RW, RH); U.uSpan.value.set(FX0, FX1); U.uCross.value.set(FY + HT * SC * 0.5, HT * SC * 0.5);      // the crosshair rides up and down the height of the views U.uInkK.value = small ? 0.84 : 0.78; U.uLineW.value = small ? 1.8 : WK;
    st.info = { SC: +SC.toFixed(2), column, model: !!model, ms: model?.ms, lines: model?.lines, canvas: [CW, CH], frame: [FX0, FX1, FY1].map((n) => +n.toFixed(2)), views: [FXc, SXc, FY].map((n) => +n.toFixed(2)), top: TOP, bot: BOT };
  };
  let rsT = 0; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { st.again = true; }, 180); });      // laid out again when the window changes shape or a phone is turned

  /* ---------- every frame ---------- */
  function update(dt, { d, pointer, now }) {
    const real = st.lastNow ? Math.min(0.05, (now - st.lastNow) / 1000) : 0; st.lastNow = now;      // seconds on the wall clock
    const up = d < DROP_D - 0.02, tk = up ? 1 : 0, tR = now / 1000;                                 // the hero is up until the box starts to fall
    if (st.k < 0) st.k = tk; else st.k = clamp(st.k + (tk - st.k > 0 ? real / 0.7 : -real / 0.32), 0, 1);       // gone in a third of a second, before the box hits the name. Back in two thirds
    const k = st.k * st.k * (3 - 2 * st.k), lifted = !window.__introGate || window.__introGate.hold === false;
    // The sheet is laid out in the picture the camera has at the top of the page: once when the page opens, and again whenever the window changes shape.
    if (up && (!st.laid || st.again)) { st.again = false; st.laid = true; layout(); }
    if (pointer && !reduceMotion) st.px += (pointer.x - st.px) * Math.min(1, real * 3); else st.px *= 1 - Math.min(1, real * 2);
    const on = k > 0.001; wall.visible = k > 0.999; wallGo.visible = on && !wall.visible; tail.visible = shade.visible = on; shadeM.opacity = SHADE * k;
    U.uK.value = wall.visible ? 1 : k; U.uT.value = tR; root.position.x = BX - st.px * 0.14;      // a few centimetres of give to the pointer
    if (st.photo && U.uPhotoK.value < 1) U.uPhotoK.value = Math.min(1, U.uPhotoK.value + real / 2.5);
    if (st.t0 < 0 && lifted) st.t0 = tR;                                                           // the lines draw themselves once the loader has lifted: 3.6 seconds, the views first, the title block last
    U.uReveal.value = reduceMotion ? 1.05 : st.t0 < 0 ? 0 : Math.min(1.05, (tR - st.t0 - 0.2) / 3.6 * 1.05);
    // after that it is never quite still: every eight seconds or so the height is measured again
    if (!reduceMotion && U.uReveal.value >= 1.05) { if (!st.dimT) st.dimT = tR + 5; const e = tR - st.dimT; if (e > 8.5) st.dimT = tR; U.uDimK.value = e < 0 ? 1 : e < 0.25 ? 0 : Math.min(1, (e - 0.25) / 0.9); } else U.uDimK.value = 1;
  }
  return { update, root, get info() { return st.info; }, get dimK() { return U.uDimK.value; } };
}
