// Mosey, the machined one: the graphite robot built by script in Blender (the script is in the pack, extras/blender/build_robot.py), behind the same calls
// as the generated model in robot-model.js.
//
// The model is made of rigid parts, each on exactly one bone, and no bone has a rest rotation. So a pose is three angles
// per bone, in the robot's own axes: x is the side axle (negative swings forward), y lifts sideways, z twists.
// Nothing is patched in the shader and nothing is rebuilt in code. What this file does:
//   the walk     no clip. Each foot is put where it should be on the floor for the distance walked, and hip and knee
//                are solved from that with plain trigonometry, so a planted foot stays planted in both directions
//   the acts     a few angles per act on top of standing, clamped to the joint limits that travel inside the GLB
//   the floor    after every pose the lowest point of the robot is found and the hips are set so it touches the floor
//   the look     its own pale studio to reflect (dark metal is its reflections) and a small black studio for the glass
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';

export const WAYS = {
  classic: { name: 'Graphite', body: 0x47464b, fixed: true },      // the model's own finish: blasted graphite and brass
  tomato:  { name: 'Tomato',   body: 0xe8452c, paint: 0xe8452c },
  mint:    { name: 'Mint',     body: 0x8fd3b6, paint: 0x8fd3b6 },
  sunny:   { name: 'Sunny',    body: 0xf6c21a, paint: 0xf6c21a },
};

const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const sat = (v) => clamp(v, 0, 1), ss = (t) => { t = sat(t); return t * t * (3 - 2 * t); }, s5 = (t) => { t = sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const bell = (t) => Math.sin(Math.PI * sat(t));
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const HEIGHT = 1.15, K = HEIGHT / 0.14;                              // the file is in metres and stands 0.14. The page wants 1.15

/* ---------- the light it reflects ----------
   With the page's RoomEnvironment at 0.5 this robot reads black, and changing that would change everything else on the page.
   So its materials carry their own environment: a pale room with big light cards. The glass mirrors a second one, black with
   narrow slanted cards, so the pane is deep black with one soft band that slides across as he turns. Both are from the viewer. */
const card = (s, w, h, pos, power, tint = [1, 1, 1], map = null, aim = [0, 1.1, 0], roll = 0) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint[0] * power, tint[1] * power, tint[2] * power), side: THREE.DoubleSide, map, transparent: !!map }));
  m.position.set(...pos); m.lookAt(...aim); m.rotateZ(roll); s.add(m); return m;
};
function studio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 24, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.61, 0.59), side: THREE.BackSide }));
  room.position.y = 8; s.add(room);
  card(s, 11, 11, [5, 11, 12], 7, [1, 0.97, 0.93]);      // key, front right, high
  card(s, 14, 10, [-14, 4, 7], 2.4, [0.95, 0.97, 1]);    // fill, front left
  card(s, 12, 12, [0, 15.5, -2], 4.5);                   // top card
  card(s, 5, 12, [12, 5, -10], 5);                       // rim strip, back right
  card(s, 5, 12, [-12, 5, -11], 3);                      // rim strip, back left
  card(s, 16, 9, [0, 5, -15], 1.5, [0.94, 0.96, 1]);     // a wide soft card behind. On the page he is often seen from the back, and a flat back with nothing to mirror is a black hole
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.82, 0.78) }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; s.add(floor);      // the warm white floor bounces into the undersides
  return s;
}
function glassStudio() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0.012, 0.012, 0.014);
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'), across = g.createLinearGradient(0, 0, 64, 0);
  across.addColorStop(0, 'rgba(255,255,255,0)'); across.addColorStop(0.5, 'rgba(255,255,255,1)'); across.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = across; g.fillRect(0, 0, 64, 256);
  const along = g.createLinearGradient(0, 0, 0, 256); along.addColorStop(0, 'rgba(0,0,0,1)'); along.addColorStop(0.3, 'rgba(0,0,0,0)'); along.addColorStop(0.7, 'rgba(0,0,0,0)'); along.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = along; g.fillRect(0, 0, 64, 256);
  const soft = new THREE.CanvasTexture(c), R = 9, head = [0, 1.135, 0.175], rad = D2R;
  for (const [deg, up, w, power, roll] of [[37, 4, 0.8, 1, 0.55], [-37, 4, 0.9, 0.8, -0.55], [0, 7, 1.6, 0.5, 1.45], [66, 3, 1.0, 0.8, 0.5], [-66, 3, 1.0, 0.7, -0.5], [98, 3, 1.2, 0.7, 0.45], [-98, 3, 1.2, 0.7, -0.45], [142, 4, 1.2, 0.6, 0.5], [-142, 4, 1.2, 0.6, -0.5], [180, 6, 1.6, 0.5, 1.45]])
    card(s, w, 7, [head[0] + R * Math.sin(deg * rad), head[1] + R * Math.tan(up * rad), head[2] + R * Math.cos(deg * rad)], 24 * power, [1, 0.97, 0.93], soft, head, roll);      // the last three are behind him: on the page he is also seen from the back
  return s;
}
// fine tiling maps on the box UVs the build script wrote: a faint grain for the blasted metal, thin streaks for the brass
function finishMaps() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mapFrom = (fill, ru, rv) => { const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), img = g.createImageData(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 255 * fill(x, y); img.data.set([v, v, v, 255], (y * n + x) * 4); }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(ru, rv); t.anisotropy = 8; return t; };
  const low = Array.from({ length: 64 }, rnd), at = (x, y) => low[((y & 7) * 8 + (x & 7))];
  const blotch = (x, y) => { const fx = x / 32, fy = y / 32, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy; };
  const rows = Array.from({ length: 256 }, rnd);
  return { grain: mapFrom((x, y) => 0.86 + 0.09 * rnd() + 0.05 * blotch(x, y), 3, 3), brush: mapFrom((x, y) => 0.70 + 0.22 * rows[y] + 0.08 * rnd(), 1.5, 5) };
}

let source = null, RIG = null;                                       // the loaded file, and what is measured from it once
const ENV = { studio: null, glass: null, mats: new Set() };          // every material that reflects one of the two studios
const DAY = 1.5, NIGHT = 0.7;                                       // how bright the studio is by day, and with the lights out
// The page calls this once with its renderer, so both studios are built behind the loader. A page that does not call it
// (a viewer) gets them the first time a robot is drawn.
export function prepare(renderer) {
  if (ENV.studio || !renderer) return;
  const pm = new THREE.PMREMGenerator(renderer);
  ENV.studio = pm.fromScene(studio(), 0.03).texture; ENV.glass = pm.fromScene(glassStudio(), 0.01).texture; pm.dispose();
  for (const m of ENV.mats) { m.envMap = m.userData.glass ? ENV.glass : ENV.studio; m.needsUpdate = true; }
}

export async function loadRobot(url = 'models/mosey-graphite.glb') {
  source = await new GLTFLoader().loadAsync(url);
  const scene = source.scene; scene.updateMatrixWorld(true);
  const rig = scene.getObjectByName('MoseyRig'), rest = {}, pts = {}, v = new THREE.Vector3(), mats = {};
  scene.traverse((o) => { if (o.isBone) { rest[o.name] = o.getWorldPosition(new THREE.Vector3()); pts[o.name] = []; } });
  // every vertex follows one bone. Collect each bone's own vertices, in that bone's space
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    mats[o.material.name] = o.material;
    const pos = o.geometry.attributes.position, si = o.geometry.attributes.skinIndex, sk = o.skeleton;
    for (let i = 0; i < pos.count; i++) { const b = si.getX(i); v.fromBufferAttribute(pos, i).applyMatrix4(o.bindMatrix).applyMatrix4(sk.boneInverses[b]); pts[sk.bones[b].name].push(v.x, v.y, v.z); }
  });
  // For finding the floor only the outermost points of a part matter. Keep the furthest point in each of a set of directions.
  const dirs = [];
  for (let a = 0; a < 360; a += 6) dirs.push([0, Math.cos(a * D2R), Math.sin(a * D2R)]);
  for (const tilt of [-50, -25, 25, 50]) for (let a = 0; a < 360; a += 15) dirs.push([Math.sin(tilt * D2R), Math.cos(a * D2R) * Math.cos(tilt * D2R), Math.sin(a * D2R) * Math.cos(tilt * D2R)]);
  dirs.push([1, 0, 0], [-1, 0, 0]);
  const hull = {};
  for (const name in pts) { const p = pts[name], keep = new Set();
    for (const d of dirs) { let best = -1, bd = -1e9; for (let i = 0; i < p.length; i += 3) { const k = p[i] * d[0] + p[i + 1] * d[1] + p[i + 2] * d[2]; if (k > bd) { bd = k; best = i; } } if (best >= 0) keep.add(best); }
    hull[name] = new Float32Array([...keep].flatMap((i) => [p[i], p[i + 1], p[i + 2]])); }
  // the legs, measured (page units): thigh, shin, ankle above the sole, where the hip axles are, where the sole ends front and back
  const L = { a: (rest.UpperLegL.y - rest.LowerLegL.y) * K, b: (rest.LowerLegL.y - rest.FootL.y) * K, h: rest.FootL.y * K, hipY: rest.UpperLegL.y * K, hipX: rest.UpperLegL.x * K };
  { let z0 = 1e9, z1 = -1e9; const f = pts.FootL; for (let i = 0; i < f.length; i += 3) if (f[i + 1] * K + L.h < 0.012) { z0 = Math.min(z0, f[i + 2] * K); z1 = Math.max(z1, f[i + 2] * K); } L.zh = z0 + 0.008; L.zt = z1 - 0.012; }
  const parse = (k) => { try { return JSON.parse(rig.userData[k]); } catch (e) { return null; } };
  // joint limits, from inside the file: for each bone and axis the range in which no two parts touch. Some open up once the arm is lifted.
  const limits = {};
  for (const l of parse('mosey_limits') || []) { const b = l.bone.replace('.', ''), k = limits[b] ||= {}, e = k[l.axis] ||= { min: l.min, max: l.max };
    if (l.with) { e.lift = +(l.with.match(/\d+/) || [0])[0]; e.min2 = l.min; e.max2 = l.max; } else { e.min = l.min; e.max = l.max; } }
  // the finish, once, on the file's own materials
  const { grain, brush } = finishMaps();
  for (const name of ['GraphiteDark', 'Bezel']) { const m = mats[name]; m.roughnessMap = grain; m.roughness = Math.min(1, m.roughness / 0.92); m.bumpMap = grain; m.bumpScale = 0.10; }
  { const m = mats.Brass; m.roughnessMap = brush; m.roughness = Math.min(1, m.roughness / 0.82); m.bumpMap = brush; m.bumpScale = 0.12; }
  for (const name of ['GlassSmoked', 'LensGlass']) { const m = mats[name]; m.userData.glass = true; m.depthWrite = false; }
  for (const name of ['Screen', 'Black']) mats[name].userData.day = mats[name].color.clone();      // what sits behind the glass. At night the page holds a lamp a hand's width from his face, and it must not light them up
  for (const name in mats) { const m = mats[name]; m.userData.ei = 1; ENV.mats.add(m); if (ENV.studio) m.envMap = m.userData.glass ? ENV.glass : ENV.studio; }
  RIG = { rest, hull, L, limits, mats, grain, poses: parse('mosey_poses') || {}, order: Object.keys(rest) };
  return source;
}

/* ---------- the walk ----------
   One cycle is two steps and covers G.C of floor (0.5, the robot is 1.15 tall). A foot is on the floor for G.beta of the cycle. While it is down it goes
   back under the body exactly as fast as the body goes forward, so it does not move on the floor. It lands a little on its
   heel and leaves a little off its toe (it turns about the edge of the sole, so the edge stays put). In the air it is carried
   forward on a curve that starts and ends with no speed over the floor, comes up fast and is put down firmly.
   The hips ride as high as the legs allow, so the body drops into every step by itself. */
const G = { C: 0.5, beta: 0.58, ph: 7 * D2R, pt: 8 * D2R, t1: 0.22, t2: 0.64, lift: 0.046, skew: 0.72, sharp: 0.85, dangle: 7 * D2R, hip: 0.3875, ext: 0.992, k: 0.012, zHip: 0.022, phase: 0.21, sway: 0.019, roll: 2.2 };
function rollAbout(p, psi, out) { const { h, zt, zh } = RIG.L, zp = psi >= 0 ? zt : zh; out.z = p + zp + h * Math.sin(psi) - zp * Math.cos(psi); out.y = h * Math.cos(psi) + zp * Math.sin(psi); return out; }
const _r0 = {}, _r1 = {};
function footAt(u, out) {      // one foot at phase u. 0 is the moment its heel comes down
  u = ((u % 1) + 1) % 1; const { C, beta } = G;
  if (u < beta) { const t = u / beta, psi = t < G.t1 ? -G.ph * (1 - ss(t / G.t1)) : t > G.t2 ? G.pt * ss((t - G.t2) / (1 - G.t2)) : 0;
    rollAbout(C * (beta / 2 - u), psi, out); out.psi = psi; out.s = 0; out.down = 1; return out; }
  const s = (u - beta) / (1 - beta), a = rollAbout(-C * beta / 2, G.pt, _r0), b = rollAbout(C * beta / 2, -G.ph, _r1), air = (1 - beta) * C, e = s5(s);
  out.z = a.z + (b.z - a.z + air) * e - air * s; out.y = a.y + (b.y - a.y) * e + G.lift * Math.pow(Math.sin(Math.PI * Math.pow(s, G.skew)), G.sharp);
  out.psi = G.pt + (-G.ph - G.pt) * ss(s) + G.dangle * Math.sin(Math.PI * s); out.s = s; out.down = 0; return out;
}
const smin = (a, b, k) => { const h = sat(0.5 + 0.5 * (b - a) / k); return b + (a - b) * h - k * h * (1 - h); };
// hip and knee from where the ankle is, seen from the hip: dz forward, dy down. Angles in degrees, in the robot's axes.
function solveLeg(dz, dy, out) {
  const { a, b } = RIG.L, max = a + b; let d = Math.hypot(dz, dy); d = clamp(d, 0.187, max);      // 0.187 is the knee folded to 97 degrees
  const al = Math.atan2(dz, dy), bk = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), kf = Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  out.hip = -(al + bk) * R2D; out.knee = kf * R2D; return out;
}

export function createRobot(opt = {}) {
  const { rest, hull, limits } = RIG, LG = RIG.L;
  const root = new THREE.Group();          // placed on the route by the page
  const spin = new THREE.Group();          // flips turn around the belly, not the feet
  spin.position.y = 0.5; root.add(spin);
  const body = new THREE.Group();          // hops, and tipping over on one foot
  body.position.y = -0.5; spin.add(body);
  const model = cloneRig(source.scene); model.scale.setScalar(K); body.add(model);

  /* ---------- the surface: the file's own ten materials. The shell is this robot's own, so it can be painted ---------- */
  const shell = new THREE.MeshPhysicalMaterial({ name: 'Shell', roughnessMap: RIG.grain, bumpMap: RIG.grain });
  const ring = RIG.mats.LightRing.clone();                           // the warm ring round the lens glows by itself
  shell.userData.ei = 1; ring.userData.ei = 1;
  for (const m of [shell, ring]) { ENV.mats.add(m); if (ENV.studio) m.envMap = ENV.studio; }
  const small = !!opt.small;                                         // the three on the shelf: no shadow pass
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const name = o.material.name; o.frustumCulled = false; o.receiveShadow = false;
    o.castShadow = !o.material.transparent && !small;                // a see-through pane must not shade the face behind it
    if (name === 'Graphite') o.material = shell; else if (name === 'LightRing') o.material = ring;
    if (!ENV.studio) o.onBeforeRender = (renderer) => { if (!ENV.studio) prepare(renderer); };
  });
  const bone = {}; model.traverse((o) => { if (o.isBone) bone[o.name] = o; });
  const hips = bone.Hips, hipsZ = hips.position.z, names = RIG.order, parent = names.map((n) => names.indexOf(bone[n].parent?.name));

  /* ---------- what rides on the head: the glow of the lens, the antenna's light, the propeller, the beam ---------- */
  const kit = new THREE.Group(); kit.scale.setScalar(1 / K); bone.Head.add(kit);      // page units, measured from the floor as he stands
  const onHead = (o, x, y, z) => { o.position.set(x, y - rest.Head.y * K, z - rest.Head.z * K); kit.add(o); return o; };
  const LENS = new THREE.Vector3(0, 0.9325, 0.146), TIP = new THREE.Vector3(0, 1.1315, 0);
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d'), g = k.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(0.3, 'rgba(255,200,120,0.05)'); g.addColorStop(0.46, 'rgba(255,208,130,1)'); g.addColorStop(0.6, 'rgba(255,190,110,0.32)'); g.addColorStop(1, 'rgba(255,180,100,0)');
    k.fillStyle = g; k.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const halo = onHead(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: haloTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })), 0, LENS.y, LENS.z + 0.003);
  halo.renderOrder = 3;                                               // light that spills over the glass, on top of it
  const tip = onHead(new THREE.Mesh(new THREE.SphereGeometry(0.027, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, fog: false, blending: THREE.AdditiveBlending, depthWrite: false })), 0, TIP.y, 0);
  const brass = RIG.mats.Brass;
  const prop = onHead(new THREE.Group(), 0, TIP.y + 0.032, 0); prop.visible = false;       // the antenna is also a propeller, for emergencies
  for (const r of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.01, 0.07), brass); b.rotation.y = r; prop.add(b); }
  const beam = onHead(new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.0, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false })), 0, LENS.y, LENS.z + 1.02);
  beam.rotation.x = -Math.PI / 2; beam.visible = false;                                    // what the lens is looking at, when it checks a room
  const lensAt = onHead(new THREE.Object3D(), 0, LENS.y, LENS.z);

  /* ---------- the shadow it stands in: soft, darkest under each shoe, and it lets go of a foot that lifts ---------- */
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d'), g = k.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.62)'); g.addColorStop(0.7, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = '#000'; k.fillRect(0, 0, 128, 128); k.fillStyle = g; k.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const blobGeo = new THREE.BufferGeometry(), BP = new Float32Array(36), BC = new Float32Array(48);
  blobGeo.setAttribute('position', new THREE.BufferAttribute(BP, 3)); blobGeo.setAttribute('color', new THREE.BufferAttribute(BC, 4));
  blobGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]), 2)); blobGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11]);
  const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x14121c, alphaMap: blobTex, vertexColors: true, transparent: true, depthWrite: false }));
  blob.frustumCulled = false; blob.renderOrder = -1; root.add(blob);
  BC.fill(1);
  const quad = (i, x, z, w, d, y, a) => { const o = i * 12, c = i * 16; BP[o] = BP[o + 9] = x - w; BP[o + 3] = BP[o + 6] = x + w; BP[o + 2] = BP[o + 5] = z + d; BP[o + 8] = BP[o + 11] = z - d; BP[o + 1] = BP[o + 4] = BP[o + 7] = BP[o + 10] = y; BC[c + 3] = BC[c + 7] = BC[c + 11] = BC[c + 15] = a; };

  /* ---------- a pose: three angles for each bone, added up over the frame, clamped to the limits, then written ---------- */
  const P = {}; for (const n of names) P[n] = [0, 0, 0];
  const add = (n, x = 0, y = 0, z = 0) => { const p = P[n]; p[0] += x; p[1] += y; p[2] += z; };
  const over = {};                                                    // the furthest any joint was asked past its range (for checking: it should stay empty)
  const AX = ['x', 'y', 'z'];
  function writePose() {
    const liftL = -P.UpperArmL[1], liftR = P.UpperArmR[1];
    for (const n of names) {
      if (n === 'Hips') continue;
      const p = P[n], lim = limits[n], lift = n.endsWith('L') ? liftL : liftR;
      for (let i = 0; i < 3; i++) {
        const e = lim && lim[AX[i]]; let lo = 0, hi = 0;
        if (e) { lo = e.min; hi = e.max; if (e.lift) { const k = sat(lift / e.lift); lo = lerp(e.min, e.min2, k); hi = lerp(e.max, e.max2, k); } }
        if (p[i] < lo - 0.01 || p[i] > hi + 0.01) { const by = p[i] < lo ? p[i] - lo : p[i] - hi, key = n + '.' + AX[i]; if (!over[key] || Math.abs(by) > Math.abs(over[key])) over[key] = +by.toFixed(1); }
        p[i] = clamp(p[i], lo, hi);
      }
      bone[n].rotation.set(p[0] * D2R, p[2] * D2R, -p[1] * D2R, 'YZX');      // the robot's axes to the file's axes
    }
  }
  // where every bone is, in the model's own space, worked out here so the floor can be found before the frame is drawn
  const rel = names.map(() => new THREE.Matrix4());
  const bones = names.map((n) => bone[n]), hulls = names.map((n) => hull[n]);
  function solveMatrices() { for (let i = 0; i < bones.length; i++) { const b = bones[i]; b.updateMatrix(); if (parent[i] < 0) rel[i].copy(b.matrix); else rel[i].multiplyMatrices(rel[parent[i]], b.matrix); } }
  function lowest() { let low = 1e9;
    for (let i = 0; i < bones.length; i++) { const h = hulls[i], e = rel[i].elements, a = e[1], b = e[5], c = e[9], d = e[13]; for (let k = 0; k < h.length; k += 3) { const y = a * h[k] + b * h[k + 1] + c * h[k + 2] + d; if (y < low) low = y; } }
    return low * K; }
  const iL = names.indexOf('FootL'), iR = names.indexOf('FootR'), iH = names.indexOf('Hips');

  const s = {
    run: 0, sit: 0, air: 0, hop: 0, hopV: 0, lookYaw: 0, lookPitch: 0, lean: 0, walk: 0, squash: 0, time: 0, wasAir: false, glow: -1,
    act: { peek: 0, climb: 0, teeter: 0, tumble: 0, land: 0, wobble: 0, stumble: 0, nap: 0, pose: 0, wave: 0, talk: 0, scan: 0, slap: 0, present: 0, fly: 0, fall: 0 },
  };
  const fL = {}, fR = {}, kL = {}, kR = {}, _qh = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _piv = new THREE.Vector3();
  const legL = { hip: 0, side: 0, knee: 0, ankle: 0, roll: 0 }, legR = { hip: 0, side: 0, knee: 0, ankle: 0, roll: 0 };
  const hip = { x: 0, y: 0, z: 0, pitch: 0, roll: 0 }, arm = { L: [0, 0, 0, 0, 0], R: [0, 0, 0, 0, 0] }, SIDES = [['L', 1, fL, legL, kL], ['R', -1, fR, legR, kR]];      // made once: nothing is allocated while it runs
  const BN = { L: ['UpperLegL', 'LowerLegL', 'FootL', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'HandL'], R: ['UpperLegR', 'LowerLegR', 'FootR', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'HandR'] };
  const cap = (f, Lmax) => f.y + Math.sqrt(Math.max(1e-6, Lmax * Lmax - (f.z - G.zHip) ** 2)) + (f.down ? 0 : 0.04 * Math.sin(Math.PI * f.s));      // how high the hips can ride over this foot
  // an arm blended toward a pose: (swing, lift away from the body, elbow, wrist twist, wrist bend)
  const to = (sd, wt, sw, lf, el, tw = 0, bd = 0) => { if (wt <= 0.001) return; const a = arm[sd]; wt = Math.min(1, wt); a[0] = lerp(a[0], sw, wt); a[1] = lerp(a[1], lf, wt); a[2] = lerp(a[2], el, wt); a[3] = lerp(a[3], tw, wt); a[4] = lerp(a[4], bd, wt); };
  // a leg let go of the floor: blend its angles toward a pose given outright
  const free = (leg, w, hip, knee, ankle) => { if (w <= 0.001) return; leg.hip = lerp(leg.hip, hip, w); leg.knee = lerp(leg.knee, knee, w); leg.ankle = lerp(leg.ankle, ankle, w); leg.side *= 1 - w; leg.roll *= 1 - w; };

  // st: { dist, speed, air (0..1 jump progress or -1), crouch, falling, idleFor, look:{yaw,pitch}, dt, time, act:{name,t}|null, blobOff, onModel, glow }
  function update(st) {
    const dt = st.dt, T = st.time, A = s.act;
    const an = st.act?.name, at = st.act?.t ?? 0;
    for (const k in A) A[k] = damp(A[k], an === k ? 1 : 0, k === 'nap' ? (an === k ? 4 : 3) : an === k ? 12 : 7, dt);      // sitting down and getting up take their time
    const moving = Math.abs(st.speed) > 0.05;
    s.run = damp(s.run, clamp((Math.abs(st.speed) - 3.4) / 4, 0, 1), 6, dt);
    const busy = A.peek + A.climb + A.teeter + A.nap + A.pose + A.stumble + A.land + A.talk + A.scan + A.wave + A.slap + A.present + A.fly + A.fall > 0.2;
    const wantSit = !moving && st.idleFor > 2.8 && st.air < 0 && !st.falling && !busy ? 1 : 0;
    s.sit = damp(s.sit, wantSit, wantSit ? 3.2 : 9, dt);
    const inAir = st.air >= 0 || !!st.falling;
    s.air = damp(s.air, inAir ? 1 : 0, 14, dt);
    if (s.wasAir && !inAir && an !== 'land') s.squash = Math.max(s.squash, 0.9);      // it is heavy: every landing goes through the knees
    s.wasAir = inAir;
    s.hopV -= 22 * dt; s.hop += s.hopV * dt; if (s.hop < 0) { if (s.hopV < -1) s.squash = 1; s.hop = 0; s.hopV = 0; }
    s.squash = damp(s.squash, 0, 9, dt);
    const down = Math.min(1, s.sit + A.nap), fk = A.fall * (an === 'fall' ? 1 - sat((at - 0.9) / 0.1) : 1);      // falling: everything straightens just before the feet touch
    const wm = Math.min(1, A.teeter + A.wobble), wind = T * 13;
    for (const n of names) { const p = P[n]; p[0] = p[1] = p[2] = 0; }

    /* ----- the body on its feet ----- */
    const walk = (1 - s.sit) * (1 - s.air) * (1 - A.nap) * (1 - A.climb) * (1 - A.fly) * (1 - A.fall) * (1 - A.peek);
    s.walk = damp(s.walk, moving ? walk : 0, moving ? 10 : 6, dt);
    const w = s.walk, u = st.dist / G.C + G.phase, dir = Math.sign(st.speed || 1);
    footAt(u, fL); footAt(u + 0.5, fR);
    const Lmax = (LG.a + LG.b) * G.ext, walkHip = smin(smin(G.hip, cap(fL, Lmax), G.k), cap(fR, Lmax), G.k), swayPh = Math.sin((u - 0.04) * Math.PI * 2);
    // a landing, the crouch before a jump, a hop coming down: all the same bend of the knees, hips back, chest forward
    const q = Math.min(1.15, A.land * (1 - sat(at * 3)) + s.squash * 0.7 + (st.crouch || 0) * 0.95);
    // teetering: it rocks about its ankles like a plank, feet flat, and sways from side to side
    const rock = (A.teeter + A.wobble * 0.8) * Math.sin(T * 7) * 12, tilt = wm * Math.sin(T * 5.3) * 4.5;
    s.lean = damp(s.lean, moving ? 3.5 + s.run * 12 : 0, 8, dt);
    const sitK = ss(down);      // sitting down, and napping: it cannot fold its legs under it or stretch them out and stay readable, so it hunkers down on its heels, feet where they were
    hip.x = w * G.sway * swayPh + LG.hipY * Math.sin(tilt * D2R) * 0.7; hip.y = lerp(LG.hipY, walkHip, w) - q * 0.082 * (1 - down) - sitK * 0.112;
    hip.z = w * G.zHip - q * 0.078 * (1 - down) - sitK * 0.1 + (LG.a + LG.b) * Math.sin(rock * D2R); hip.pitch = rock * 0.9; hip.roll = -w * G.roll * swayPh;
    _qh.setFromEuler(_e.set(hip.pitch * D2R, 0, hip.roll * D2R, 'YZX')); _qi.copy(_qh).invert();
    for (let i = 0; i < 2; i++) {
      const sg = SIDES[i][1], f = SIDES[i][2], leg = SIDES[i][3], k = SIDES[i][4], psi = w * f.psi;
      _piv.set(sg * LG.hipX, 0, 0).applyQuaternion(_qh); _piv.x += hip.x; _piv.y += hip.y; _piv.z += hip.z;
      _v.set(sg * LG.hipX, lerp(LG.h, f.y, w), w * f.z).sub(_piv).applyQuaternion(_qi);                       // from the hip axle to the ankle, as the hips see it
      const side = Math.atan2(_v.x, -_v.y) * R2D; let up = 0;
      for (let pass = 0; pass < 6; pass++) {
        solveLeg(_v.z, Math.hypot(_v.x, _v.y - up), k);
        leg.ankle = psi * R2D - hip.pitch - (k.hip + k.knee);
        if (f.down || w < 0.5) break;
        leg.ankle = clamp(leg.ankle, -40, 40);                        // a foot in the air hangs as the ankle allows. With the knee folded its toe points down,
        const tilt = (leg.ankle + hip.pitch + k.hip + k.knee) * D2R, toe = lerp(LG.h, f.y, w) + up - LG.h * Math.cos(tilt) - (tilt > 0 ? LG.zt + 0.012 : LG.zh - 0.008) * Math.sin(tilt);
        const need = w * Math.min(0.016, 0.3 * Math.sin(Math.PI * f.s)) - toe; if (need <= 0.0005) break; up += need * 1.25;      // so the ankle is carried higher until the toe clears the floor
      }
      leg.hip = k.hip; leg.knee = k.knee; leg.side = side; leg.roll = side + hip.roll;
    }

    /* ----- legs that have left the floor ----- */
    const tuck = s.air * (st.air >= 0 ? ss(st.air / 0.22) * (1 - ss((st.air - 0.72) / 0.22)) : 1);      // in a jump the legs fold, then reach for the floor before they meet it
    free(legL, s.air, -40 * tuck, 64 * tuck, lerp(-24 * tuck, 10, tuck)); free(legR, s.air, 14 * tuck, 50 * tuck, lerp(-64 * tuck, 16, tuck));      // as they reach, the ankles bring the soles level again
    { const sw = Math.sin(at * 16);                                   // climbing: one knee up, then the other
      free(legL, A.climb, -36 - 34 * sw, 45 + 40 * sw, -14); free(legR, A.climb, -36 + 34 * sw, 45 - 40 * sw, -14); }
    { const sw = Math.sin(T * 3); free(legL, A.fly, 6 + 11 * sw, 22, 20); free(legR, A.fly, 2 - 11 * sw, 16, 22); }      // legs dangle
    { const sw = Math.sin(T * 7); free(legL, fk, 2 + 26 * sw, 28 + 14 * sw, lerp(-30 - 40 * sw, 8, fk)); free(legR, fk, -4 - 26 * sw, 28 - 14 * sw, lerp(-24 + 40 * sw, 8, fk)); }      // and kick on the way down
    { const b = A.wobble * bell(at) + A.stumble * bell(at * 1.6); free(legR, Math.min(1, b), -54, 34, 6); }      // one foot comes off the floor
    for (let i = 0; i < 2; i++) { const n = BN[SIDES[i][0]], leg = SIDES[i][3]; add(n[0], leg.hip, -leg.side, 0); add(n[1], leg.knee); add(n[2], leg.ankle, leg.roll, 0); }

    /* ----- arms: (swing, lift away from the body, elbow, wrist twist, wrist bend) for the left and the right ----- */
    arm.L[0] = 5; arm.L[1] = 10; arm.L[2] = -17; arm.L[3] = arm.L[4] = 0; arm.R[0] = 7; arm.R[1] = 10; arm.R[2] = -22; arm.R[3] = arm.R[4] = 0;      // standing
    { const easy = (1 - w) * (1 - down) * (1 - s.air), sway = Math.sin(T * 1.6);      // standing still: elbows a little bent, arms breathing, never two straight rods
      arm.L[0] += easy * sway * 1.7; arm.R[0] -= easy * sway * 1.7; arm.L[2] -= easy * sway * 1.6; arm.R[2] += easy * sway * 1.6; }
    { const c = Math.cos(u * Math.PI * 2), amp = 17 + s.run * 12;      // walking: each arm goes back as its own leg comes forward
      arm.L[0] += w * amp * c; arm.R[0] -= w * amp * c; arm.L[2] -= w * (6 + 9 * Math.max(0, -c)); arm.R[2] -= w * (6 + 9 * Math.max(0, c)); arm.L[1] += w; arm.R[1] += w; }
    to('L', sitK, -36, 12, -44); to('R', sitK, -40, 12, -47);                                  // sitting: forearms out over the knees
    to('L', s.air * (1 - fk), -112, 24, -28); to('R', s.air * (1 - fk), -118, 24, -24);        // a jump: arms thrown up
    to('L', q * 0.8, 22, 14, -34); to('R', q * 0.8, 24, 14, -36);                              // landing: arms back and out, to catch its weight
    to('L', A.peek, -6, 8, -26); to('R', A.peek, -4, 8, -30);                                  // peeking: hands stay down inside the box
    { const sw = Math.sin(at * 16); to('L', A.climb, -140 - 26 * sw, 17, -32 - 16 * sw); to('R', A.climb, -140 + 26 * sw, 17, -32 + 16 * sw); }      // climbing: reaching up, hand over hand
    to('L', wm, -70 + 88 * Math.sin(wind), 24 + 8 * Math.sin(wind * 0.7), -16); to('R', wm, -70 + 88 * Math.sin(wind + 2.1), 24 + 8 * Math.sin(wind * 0.7 + 1), -16);      // arms windmill, clear of its head
    { const b = A.stumble * bell(at * 1.4); to('R', b, -96, 22, -24); to('L', b, -10, 62, -12); }                 // one arm up, one out
    const waving = Math.min(1, A.wave + A.pose * bell((at - 0.18) / 0.4));                     // a wave hello: upper arm out to the side, forearm up, rocking from the elbow, the hand a beat behind
    to('L', waving, -90, 70, -76 + Math.sin(T * 8.5) * 15, 0, Math.sin(T * 8.5 - 0.7) * 16);
    { const a = Math.sin(T * 5), b = Math.sin(T * 5 + 2); to('L', A.talk, -34 - 18 * a, 15, -46 - 10 * a, -40); to('R', A.talk, -44 - 20 * b, 15, -42 - 10 * b, -40); }      // talks with its hands, palms up
    to('R', A.slap, 8 + Math.sin(T * 16) * 8, 66, -8);                                          // one hand out, trailing along the letters
    to('L', A.present, -108, 13, -9, -25);                                                      // points at the wall
    to('L', A.fly, -14, 57, -10); to('R', A.fly, -14, 57, -10);
    to('L', fk, -22, 106 + Math.sin(T * 9) * 30, -28); to('R', fk, -22, 106 + Math.sin(T * 9 + 1.9) * 30, -28);      // falling: arms flung out and up to the sides, where you can see them past its head
    for (let i = 0; i < 2; i++) { const a = arm[SIDES[i][0]], sg = SIDES[i][1], n = BN[SIDES[i][0]]; add(n[3], a[0]); add(n[4], 0, -sg * a[1], 0); add(n[5], a[2]); add(n[6], a[4], 0, sg * a[3]); }

    /* ----- chest and head ----- */
    const peekScan = A.peek * (st.look.yaw === 0 ? Math.sin(T * 1.3) * 0.7 : 0);
    const lookBack = A.stumble * sat(at * 2.2 - 0.9) * 1.5;
    s.lookYaw = damp(s.lookYaw, (st.look.yaw + peekScan + lookBack) * (1 - A.nap), 7, dt);
    s.lookPitch = damp(s.lookPitch, st.look.pitch + (A.teeter > 0.5 && st.lookDown ? 0.5 : 0), 7, dt);
    const hy = (s.lookYaw + A.land * Math.sin(at * 22) * 0.45 * sat(1.2 - at) * sat(at * 4 - 1) + A.scan * Math.sin(T * 1.5) * 0.95) * R2D;
    const hx = (s.lookPitch * (1 - A.nap) + s.sit * 0.02 + A.nap * (0.42 + Math.sin(T * 1.3) * 0.05) + A.talk * Math.sin(T * 7) * 0.06 + A.scan * 0.12 - A.present * 0.24 + A.fly * 0.2 + fk * 0.22) * R2D - rock * 0.5;
    const hz = (Math.sin(T * 0.9) * 0.035 * (1 - w) + A.nap * 0.07 + A.peek * Math.sin(T * 0.7) * 0.12 + A.pose * Math.sin(T * 1.4) * 0.06) * R2D;
    // The head nods 18 degrees and tilts 15, each alone and facing front. Turned to the side its front edge is over the chest, not in front of it,
    // and it can dip less. Nodding and tilting at once, a corner comes down sooner than either does alone. Looking further up or down, the whole chest leans.
    const neck = clamp(hy * 0.34, -45, 45), side = ss(Math.abs(hy) / 38), nodMax = lerp(17, 8, side), leanMax = lerp(14, 6.5, side);
    let nod = clamp(hx, -nodMax, nodMax), lean = clamp(-hz + w * swayPh * 1.5, -leanMax, leanMax); const more = (hx - nod) * (1 - A.nap);
    { const k = Math.abs(nod) / nodMax + Math.abs(lean) / leanMax; if (k > 1) { nod /= k; lean /= k; } }
    add('Neck', 0, 0, neck); add('Head', nod, lean, hy - neck);
    add('Chest', s.lean * dir * (1 - A.nap) + q * 15 * (1 - down) + more * 0.8 + A.climb * 22 - rock * 0.45 + A.peek * 5 + A.fly * 6 + fk * Math.sin(T * 1.9) * 8 + sitK * 11 + A.nap * Math.sin(T * 1.3) * 1.2 + w * 1.2 * Math.cos(u * Math.PI * 4), 0, w * 3 * Math.cos(u * Math.PI * 2) + wm * Math.sin(T * 6.1) * 5);

    /* ----- write it, then find the floor ----- */
    writePose();
    hips.rotation.set(hip.pitch * D2R, 0, hip.roll * D2R, 'YZX');
    hips.position.set(hip.x / K, hip.y / K, hipsZ + hip.z / K);
    solveMatrices();
    const ground = (1 - s.air) * (1 - A.fly) * (1 - fk) * (1 - A.climb);
    hips.position.y -= lowest() * ground / K; solveMatrices();

    // tipping over on one foot (a stumble): the whole robot turns about the outer edge of its left shoe
    const tip2 = A.stumble * bell(at * 1.3) * 15 * D2R, px = LG.hipX + 0.085;
    body.rotation.z = -tip2 + A.fly * Math.sin(T * 2.2) * 0.14 + fk * Math.sin(T * 2.6) * 0.2;
    body.rotation.x = A.fly * 0.1 + fk * Math.sin(T * 1.9) * 0.14 + A.climb * 0.12;
    body.position.set(px - px * Math.cos(tip2), -0.5 + s.hop + A.peek * (0.05 + Math.sin(T * 2.4) * 0.02) + px * Math.sin(tip2), 0);

    // flips
    { const ft = ss(at / 0.84), qf = sat((at - 0.02) / 0.2); spin.rotation.x = (an === 'tumble' ? ft : an === 'fall' ? qf * qf * (3 - 2 * qf) : 0) * Math.PI * 2; }      // a full turn forward: over the jump out of the box, and at the top of the last fall. It is round before it lands
    if (st.falling) spin.rotation.x += st.fallSpin || 0;

    /* ----- light ----- */
    const glow = st.glow || 0, pulse = A.talk * Math.max(0, Math.sin(T * 9)), sleep = A.nap * (0.55 + 0.25 * Math.sin(T * 1.3));
    prop.visible = A.fly > 0.02; prop.scale.setScalar(Math.max(0.001, A.fly)); prop.rotation.y += dt * 42;
    tip.material.opacity = Math.min(1, glow * (0.6 + Math.sin(T * 4) * 0.12)); tip.visible = tip.material.opacity > 0.02;
    beam.material.opacity = A.scan * (0.2 + Math.sin(T * 9) * 0.03); beam.visible = A.scan > 0.02;
    ring.emissiveIntensity = (1.1 + glow * 0.8 + pulse * 1.3) * (1 - sleep);                                    // the ring glows a little, more in the dark, and pulses when it talks
    halo.material.opacity = Math.min(1, glow * 0.3 + pulse * 0.4) * (1 - sleep); halo.visible = halo.material.opacity > 0.01;
    if (st.glow !== undefined && Math.abs(glow - s.glow) > 0.002) { s.glow = glow; const k = lerp(DAY, NIGHT, glow); for (const m of ENV.mats) { m.envMapIntensity = m.userData.glass ? lerp(1, 0.5, glow) : k * m.userData.ei; if (m.userData.day) m.color.copy(m.userData.day).multiplyScalar(1 - 0.8 * glow); } }      // the studio dims with the page's own lights

    /* ----- the shadow on the floor ----- */
    const by = st.onModel ? 0.058 : 0.012, vis = st.blobOff ? 0 : (1 - s.air) * (st.falling ? 0 : 1) * (1 - A.fly) * (1 - fk) * sat(1 - s.hop * 1.1);      // in the model home the floor is a little higher than the ground
    blob.visible = vis > 0.01;
    if (blob.visible) {
      const eL = rel[iL].elements, eR = rel[iR].elements, eH = rel[iH].elements, bx = body.position.x;
      quad(0, eH[12] * K + bx, eH[14] * K + 0.04 + down * 0.03, 0.42 + down * 0.04, 0.33 + down * 0.07, by, (0.4 + down * 0.12) * vis);
      quad(1, eL[12] * K + bx, eL[14] * K + 0.05, 0.18, 0.24, by + 0.001, 0.72 * vis * sat(1 - (eL[13] * K - LG.h) / 0.09));
      quad(2, eR[12] * K + bx, eR[14] * K + 0.05, 0.18, 0.24, by + 0.002, 0.72 * vis * sat(1 - (eR[13] * K - LG.h) / 0.09));
      blobGeo.attributes.position.needsUpdate = true; blobGeo.attributes.color.needsUpdate = true;
    }
  }

  function hop(v = 3.4) { if (s.hop < 0.02) s.hopV = v; }
  // Colourways repaint the shell and nothing else, the way a painted product would: joints, soles, glass and brass stay.
  function setWay(key) { const wy = WAYS[key]; if (!wy) return; const g = RIG.mats.Graphite;
    if (wy.paint) { shell.color.setHex(wy.paint); shell.metalness = 0; shell.roughness = 0.5; shell.clearcoat = 0.6; shell.clearcoatRoughness = 0.22; shell.bumpScale = 0.03; shell.userData.ei = 0.42; }
    else { shell.color.copy(g.color); shell.metalness = g.metalness; shell.roughness = Math.min(1, g.roughness / 0.92); shell.clearcoat = 0; shell.bumpScale = 0.10; shell.userData.ei = 1; }
    shell.envMapIntensity = lerp(DAY, NIGHT, Math.max(0, s.glow)) * shell.userData.ei; }
  for (const m of ENV.mats) if (m.envMapIntensity === 1 && !m.userData.glass) m.envMapIntensity = DAY * m.userData.ei;
  setWay('classic');
  update({ dist: 0, speed: 0, air: -1, falling: false, idleFor: 0, look: { yaw: 0, pitch: 0 }, act: null, dt: 1 / 60, time: 0 });      // on its feet from the first frame

  return { root, update, hop, setWay, tipWorld: (v) => tip.getWorldPosition(v), height: HEIGHT, headTop: 1.064, headHalf: 0.194 + 0.06, lensWorld: (v) => lensAt.getWorldPosition(v),
    stepIndex: (d) => Math.floor((d / G.C + G.phase) * 2),          // goes up by one each time a heel comes down, for the sound of its steps
    check: { over, feet: () => { solveMatrices(); return [iL, iR].map((i) => { const h = hull[names[i]], e = rel[i].elements; let low = 1e9; for (let k = 0; k < h.length; k += 3) low = Math.min(low, e[1] * h[k] + e[5] * h[k + 1] + e[9] * h[k + 2] + e[13]); return +(low * K).toFixed(4); }); }, pose: () => JSON.parse(JSON.stringify(P, (k, v) => typeof v === 'number' ? +v.toFixed(1) : v)), bones: () => { solveMatrices(); const o = {}; names.forEach((n, i) => { o[n] = Array.from(rel[i].elements); }); return o; }, lowest: () => { solveMatrices(); return lowest(); } } };
}
