// Mosey, "Gone Walking".
// One world, one route. Scroll position is distance walked along the route.
// Mosey operates the page: it knocks LIGHTS over and the page goes to night,
// projects its own presentation with its lens, maps your home as it walks the headline,
// projects photos and film on a wall, and ends by landing on the RESERVE button.
import * as THREE from 'three';
import RAPIER from 'rapier';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PAL } from './options.js?v=1117-230645';
// the robot: the graphite one built by script in Blender (js/robot-machined.js). ?robot=generated is the Higgsfield model it replaced, for comparing.
const robotLib = await import({ generated: './robot-model.js?v=1117-230645' }[new URLSearchParams(location.search).get('robot')] || './robot-machined.js?v=1117-230645');
const { createRobot, WAYS } = robotLib;
if (robotLib.loadRobot) await robotLib.loadRobot();
import { createHome } from './home-kit.js?v=1117-230645';
import { createDock, createAntennaPulse, createPlinth, createCtaButton } from './props-kit.js?v=1117-230645';
import { createSizes } from './sizes.js?v=1117-230645';

const coarse = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, smooth = THREE.MathUtils.smoothstep;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const backOut = (t) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const bounceOut = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const boot = window.__boot = { start: Math.round(performance.now()) };      // the loader reads these stages (js/loader.js)
if (!WAYS.classic.fixed) { WAYS.classic.body = new THREE.Color(PAL.robot).getHex(); WAYS.classic.trim = new THREE.Color(PAL.trim).getHex(); }
document.documentElement.style.setProperty('--robot', PAL.robot);

/* ---------- renderer, scene, light ---------- */
const canvas = document.getElementById('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const DPR = Math.min(devicePixelRatio, coarse ? 1.5 : 2);
renderer.setPixelRatio(DPR);
robotLib.prepare?.(renderer);      // the machined robot reflects a studio of its own, built here once

const scene = new THREE.Scene();
const DEEP_PAPER = new THREE.Color('#d9c9ac');
const SKY = new THREE.Color(PAL.sky), BLUE_SKY = new THREE.Color(PAL.deep), NIGHT = new THREE.Color(PAL.night), DUSK = new THREE.Color(PAL.dusk ?? '#9d90b6');
scene.background = SKY.clone();
scene.fog = new THREE.Fog(PAL.sky, 10, 34);
{ const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; pm.dispose(); }
// The big words are cast glass (js/letter-options.js). On touch screens they are the lighter soft glass, which needs no second picture of the scene.
//   ?letters=now  the satin plastic of before, for before and after      ?letters=glass | soft  forces one of the two
const letterKey = (() => { const k = new URLSearchParams(location.search).get('letters'); return k === 'now' ? null : k === 'glass' || k === 'soft' ? k : coarse || PAL.dark ? 'soft' : 'glass'; })();      // on a dark page real glass only shows the dark behind it, so it gets the denser soft glass
const letterFx = letterKey ? (await import('./letter-options.js?v=1117-230645')).createLetterLook(letterKey, { THREE, renderer, PAL }) : null;
const camera = new THREE.PerspectiveCamera(36, 1, 0.08, 160);
const hemi = new THREE.HemisphereLight(0xeef2ff, 0xe9dcc8, 0.75); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffedd0, 2.5);
const SUN_OFF = V3(-6, 11, 7), RIM_OFF = V3(7, 5, -9);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 44 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 5;
scene.add(sun, sun.target);
const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9); scene.add(rim, rim.target);

/* ---------- physics ---------- */
await RAPIER.init(); boot.physics = Math.round(performance.now());
const world = new RAPIER.World({ x: 0, y: -24, z: 0 });
world.timestep = 1 / 60;
const letters = [], letterMeshes = [];

/* ---------- type as architecture ---------- */
const font = await new Promise((res, rej) => new TTFLoader().load('fonts/ArchivoBlack-Regular.ttf', (json) => res(new Font(json)), undefined, rej));
try { await document.fonts.load('40px "Archivo Black"'); } catch (e) { /* the canvas screens fall back to a system face */ }
boot.font = Math.round(performance.now());
const DISPLAY = '"Archivo Black", "Arial Black", sans-serif', MONO = 'ui-monospace, Menlo, monospace';
const blueMat = new THREE.MeshPhysicalMaterial({ color: PAL.side, roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.35 });
const faceMat = new THREE.MeshStandardMaterial({ color: PAL.face, roughness: 0.78 });
const LETTER = [faceMat, blueMat];
const END = [new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: 0xc3cdf7, roughness: 0.5 })];
const inkMat = new THREE.MeshStandardMaterial({ color: PAL.ink, roughness: 0.55 });
const yellowMat = new THREE.MeshStandardMaterial({ color: PAL.accent, roughness: 0.45, metalness: 0.2 });
const glyphCache = new Map();
function glyph(ch, size, depth) {
  const key = ch + size + '_' + depth;
  if (!glyphCache.has(key)) {
    const b = Math.min(0.06, size * 0.03) * (letterFx?.bevel ?? 1);
    const g = new TextGeometry(ch, { font, size, depth, curveSegments: 14, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.75, bevelSegments: letterFx?.bevelSegs ?? 4 });
    g.computeBoundingBox();
    const bb = g.boundingBox.clone(), c = bb.getCenter(V3());
    g.translate(-c.x, -c.y, -c.z);
    glyphCache.set(key, { g, bb, c, half: bb.getSize(V3()).multiplyScalar(0.5) });
  }
  return glyphCache.get(key);
}
const advance = (ch, size) => (font.data.glyphs[ch]?.ha ?? font.data.glyphs['n'].ha) * size / font.data.resolution;
const capHeight = (size) => glyph('N', size, 1).bb.max.y;

function makeWord(text, { size, depth, left = 0, z, physics = 'none', gaps = {}, tracking = 0.02, add = true, mat = LETTER, base = 0 }) {
  const out = []; let x = left;
  [...text].forEach((ch, i) => {
    if (ch === ' ') { x += advance('n', size) * 0.7; return; }
    if (gaps[i]) x += gaps[i];
    const G = glyph(ch, size, depth);
    const mesh = new THREE.Mesh(G.g, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    const home = V3(x + G.c.x, base + G.half.y + 0.045, z);
    mesh.position.copy(home);
    if (add) scene.add(mesh);
    out.push({ ch, i, mesh, home, homeQ: new THREE.Quaternion(), half: G.half, x0: x + G.bb.min.x, x1: x + G.bb.max.x, state: 'none', body: null, t: 0, sq: 0, sqV: 0, tilt: 0, block: physics === 'block' || (Array.isArray(physics) && physics.includes(i)) });
    x += advance(ch, size) + tracking;
  });
  out.right = x; return out;
}
function shiftWord(word, dx) { word.forEach((L) => { L.home.x += dx; L.mesh.position.x += dx; L.x0 += dx; L.x1 += dx; }); word.right += dx; }
function giveBodies(word) {
  for (const L of word) {
    if (!L.block) continue;
    L.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(true).setLinearDamping(0.15).setAngularDamping(0.4).setTranslation(L.home.x, L.home.y, L.home.z).setRotation(L.homeQ));
    world.createCollider(RAPIER.ColliderDesc.cuboid(L.half.x - 0.02, L.half.y, L.half.z).setDensity(0.6).setFriction(0.8).setRestitution(0.05), L.body);
    L.state = 'free'; letters.push(L); letterMeshes.push(L.mesh); L.mesh.userData.letter = L;
  }
}
function solidWall(word) {
  const a = word[0].x0, b = word[word.length - 1].x1, hy = word[0].half.y;
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation((a + b) / 2, hy, word[0].home.z));
  world.createCollider(RAPIER.ColliderDesc.cuboid((b - a) / 2, hy, word[0].half.z), body);
}
// letter states: free (falls, can be thrown), locked (solid ground), homing (flying back to its place)
function lock(L) { if (L.state === 'free') { if (displaced(L)) sendHome(L, 'locked'); else { L.body.setBodyType(RAPIER.RigidBodyType.Fixed, true); L.state = 'locked'; } } else if (L.state === 'homing') L.after = 'locked'; }
function free(L) { if (L.state === 'locked') { L.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); L.state = 'free'; } else if (L.state === 'homing') L.after = 'free'; }
function displaced(L) { const p = L.body.translation(), q = L.body.rotation(); return L.home.distanceToSquared(p) > 0.0025 || Math.abs(q.x * L.homeQ.x + q.y * L.homeQ.y + q.z * L.homeQ.z + q.w * L.homeQ.w) < 0.999; }
function sendHome(L, after = 'free') {
  if (L.state === 'homing') { L.after = after; return; }
  if (!displaced(L)) { if (after === 'locked') { L.state = 'free'; lock(L); } return; }
  L.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  L.from = V3().copy(L.body.translation()); L.fromQ = new THREE.Quaternion().copy(L.body.rotation());
  L.t = 0; L.state = 'homing'; L.after = after;
}
const _v = V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function stepLetters(dt) {
  for (const L of letters) {
    if (L.state !== 'homing') continue;
    L.t = Math.min(1, L.t + dt / 0.6);
    _v.lerpVectors(L.from, L.home, backOut(L.t)); _v.y += Math.sin(L.t * Math.PI) * 0.6;
    _q.slerpQuaternions(L.fromQ, L.homeQ, Math.min(1, L.t * 1.15));
    L.body.setNextKinematicTranslation(_v); L.body.setNextKinematicRotation(_q);
    if (L.t >= 1) {
      L.body.setTranslation(L.home, true); L.body.setRotation(L.homeQ, true);
      L.body.setLinvel({ x: 0, y: 0, z: 0 }, true); L.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      L.body.setBodyType(L.after === 'locked' ? RAPIER.RigidBodyType.Fixed : L.after === 'float' ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, true);
      L.state = L.after;
    }
  }
}

/* ---------- small makers ---------- */
const pops = [];
const pop = (obj, d, homeY = null, span = 2.2) => { const p = { obj, d, homeY, span, e: -1 }; pops.push(p); return p; };
const rr = (k, x, y, w, h, r, fill) => { k.fillStyle = fill; k.beginPath(); k.roundRect(x, y, w, h, r); k.fill(); };
const canvasTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return { c, k: c.getContext('2d'), tex }; };
const tinyMosey = (k, x, y, s, col = PAL.robot) => {          // a small drawn Mosey, for screens and stand-in photos
  k.fillStyle = 'rgba(40,30,20,.18)'; k.beginPath(); k.ellipse(x + s * 0.5, y + s * 1.02, s * 0.9, s * 0.16, 0, 0, 7); k.fill();
  k.fillStyle = col; k.beginPath(); k.roundRect(x - s * 0.55, y - s * 1.5, s * 1.1, s, s * 0.28); k.fill();
  k.beginPath(); k.ellipse(x, y, s * 0.42, s * 0.5, 0, 0, 7); k.fill(); k.fillRect(x - s * 0.04, y - s * 1.75, s * 0.08, s * 0.3); k.beginPath(); k.arc(x, y - s * 1.8, s * 0.1, 0, 7); k.fill();
  k.fillStyle = '#8b8d92'; k.beginPath(); k.ellipse(x - s * 0.22, y + s * 0.95, s * 0.22, s * 0.12, 0, 0, 7); k.ellipse(x + s * 0.22, y + s * 0.95, s * 0.22, s * 0.12, 0, 0, 7); k.fill();
  k.fillStyle = col; k.fillRect(x - s * 0.3, y + s * 0.3, s * 0.2, s * 0.6); k.fillRect(x + s * 0.1, y + s * 0.3, s * 0.2, s * 0.6);
  k.fillStyle = '#0a0a0c'; k.beginPath(); k.arc(x, y - s, s * 0.27, 0, 7); k.fill(); k.fillStyle = '#fff'; k.beginPath(); k.arc(x - s * 0.09, y - s * 1.09, s * 0.06, 0, 7); k.fill();
};
// a burst of paper. Its flight is a function of a 0..1.7 clock, so scroll can scrub it both ways.
function makeBurst(n, power = 1) {
  const cols = [PAL.accent, PAL.face, '#ff5a3c', '#8fd3b6', '#ff9ecb', '#fbf8f3', '#7b5cff', '#ffb02e'];
  const shapes = [new THREE.BoxGeometry(0.17, 0.006, 0.055), new THREE.BoxGeometry(0.085, 0.006, 0.085), new THREE.CylinderGeometry(0.05, 0.05, 0.006, 14), new THREE.BoxGeometry(0.3, 0.005, 0.028)];      // strips, squares, dots, streamers
  const sets = shapes.map((geo, g) => { const count = Math.ceil(n * [0.4, 0.25, 0.2, 0.15][g]);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }), count); mesh.castShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    const data = Array.from({ length: count }, (_, i) => { mesh.setColorAt(i, new THREE.Color(cols[(i * 3 + g * 5) % cols.length]));
      const a = rnd() * 6.28, r = (0.5 + rnd() * 1.9) * power;                              // thrown out in a ring, some high, some wide
      return { vx: Math.cos(a) * r, vz: Math.sin(a) * r * 0.8, vy: (2.2 + rnd() * 3.6) * power, s: rnd() * 6.28, w: 4 + rnd() * 9, sway: 0.08 + rnd() * 0.16, k: 0.75 + rnd() * 0.6, late: rnd() * 0.12 }; });
    return { mesh, data }; });
  const m = new THREE.Matrix4(), e = new THREE.Euler(), sc = V3(), p = V3(), q = new THREE.Quaternion();
  const run = (st, ox, oy, oz, ground) => {
    for (const { mesh, data } of sets) {
      for (let i = 0; i < data.length; i++) {
        const b = data[i], s1 = Math.max(0, st - b.late), tl = (b.vy + Math.sqrt(b.vy * b.vy + 10 * (oy - ground))) / 5, t = Math.min(s1, tl), down = s1 >= tl;
        const flutter = down ? 0 : Math.sin(t * b.w * 0.6 + b.s) * b.sway * Math.min(1, t * 1.5);      // paper doesn't fall straight
        p.set(ox + b.vx * t + flutter, Math.max(ground + 0.012 + i * 0.0004, oy + b.vy * t - 2.5 * t * t), oz + b.vz * t + flutter * 0.6);
        e.set(down ? 0 : b.s + t * b.w, b.s + t * 3, down ? 0 : t * b.w * 0.7);
        m.compose(p, q.setFromEuler(e), sc.setScalar(s1 > 0 ? b.k : 0.001)); mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  run.show = (v) => { for (const { mesh } of sets) mesh.visible = v; };
  return run;
}
// A wall Mosey can project on: painted plaster with a moulded skirting board, a socket and a light switch.
// The picture is light thrown on the plaster: feathered at the edges, brightest in the middle, with a little spill round it.
const wallRnd = (() => { let s = 4711; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();      // the wall has its own dice, so the page's dice roll as they did
const wallPaint = (() => { const { k, tex } = canvasTex(512, 512); k.fillStyle = '#ece5d8'; k.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { k.fillStyle = `rgba(${rnd() > 0.5 ? '255,250,240' : '120,105,85'},${(0.02 + rnd() * 0.035).toFixed(3)})`; k.fillRect(rnd() * 512, rnd() * 512, 2 + rnd() * 26, 1 + rnd() * 2); }      // roller marks
  for (let i = 0; i < 44; i++) {                                                                  // patches where the paint dried a little lighter or darker. They wrap, so the tiles don't show.
    const x = wallRnd() * 512, y = wallRnd() * 512, r = 40 + wallRnd() * 110, c = wallRnd() > 0.5 ? '255,251,240' : '96,82,62', a = (0.03 + wallRnd() * 0.035).toFixed(3);
    for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) { const gr = k.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`); k.fillStyle = gr; k.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
  }
  for (let i = 0; i < 7000; i++) { k.fillStyle = `rgba(${wallRnd() > 0.5 ? '255,252,244' : '70,60,46'},${(0.03 + wallRnd() * 0.05).toFixed(3)})`; k.fillRect(wallRnd() * 512, wallRnd() * 512, 1, 1); }      // the grain of the plaster
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 3); return tex; })();
// How much of the picture reaches the wall: all of it in the middle, none at the soft rounded edge, and a little less where the plaster is rough, so the wall shows through the light.
const edgeFade = (() => { const w = 512, h = 288, { k, tex } = canvasTex(w, h), im = k.createImageData(w, h), d = im.data;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const qx = Math.abs(x + 0.5 - w / 2) - (w / 2 - 16), qy = Math.abs(y + 0.5 - h / 2) - (h / 2 - 16), sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 10;
    d[i] = d[i + 1] = d[i + 2] = 255 * smooth(-sd, 0, 12) * (1 - 0.05 * wallRnd()); d[i + 3] = 255; }
  k.putImageData(im, 0, 0);
  for (let i = 0; i < 520; i++) { k.fillStyle = `rgba(0,0,0,${(0.02 + wallRnd() * 0.05).toFixed(3)})`; k.fillRect(wallRnd() * w, wallRnd() * h, 3 + wallRnd() * 22, 1); }
  tex.colorSpace = THREE.NoColorSpace; return tex; })();
const WALL_PX = coarse ? [1024, 576] : [1536, 864];      // the canvas the home screens are drawn on: bigger where there are the pixels to show it
function makeWall(cx, cz, rotY, paint, WW = 15, home = false) {
  const W = 6.4, Hh = 3.6, cy = home ? 2.81 : 2.4, WH = 8.4, ks = home ? 0.018 : 0;      // at home the picture is a touch narrower at the bottom: it is thrown up from the floor. cy: the middle of the picture. At home it is half way between the top of the skirting (0.6) and the picture rail (5.02), so there is clear wall under it
  const g = new THREE.Group(); g.position.set(cx, cy, cz); g.rotation.y = rotY;
  const plaster = new THREE.MeshStandardMaterial({ map: wallPaint, bumpMap: wallPaint, bumpScale: 0.5, roughness: 0.96, vertexColors: true }), trim = new THREE.MeshStandardMaterial({ color: '#f6f1e7', roughness: 0.55 });
  // The slab. It is painted a little darker away from the picture and down by the floor, so the light seems to fall off.
  const slabGeo = new THREE.BoxGeometry(WW, WH, 0.3, Math.round(WW / 0.8), 10, 1), sp = slabGeo.attributes.position, su = slabGeo.attributes.uv, sc = new Float32Array(sp.count * 3);
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), y = sp.getY(i) + WH / 2 - cy, v = (1 - 0.27 * smooth(Math.hypot(x / 7, y / 4.4), 0.55, 2)) * (0.9 + 0.1 * smooth(y + cy, 0.5, 1.7)); sc.set([v, v * 0.992, v * 0.975], i * 3); su.setX(i, su.getX(i) * WW / 15); }
  slabGeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  const slab = new THREE.Mesh(slabGeo, plaster); slab.position.set(0, WH / 2 - cy, -0.1); slab.receiveShadow = true; g.add(slab);
  // A moulding is its section pulled along the wall. The skirting has a flat face, a cove and a bead on top.
  const mould = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); const e = new THREE.ExtrudeGeometry(s, { depth: WW, bevelEnabled: false }); e.rotateY(-Math.PI / 2); e.translate(WW / 2, 0, 0); return e; };
  const skirt = new THREE.Mesh(mould([[0, 0], [0.1, 0], [0.1, 0.4], [0.088, 0.425], [0.088, 0.44], [0.07, 0.475], [0.056, 0.52], [0.056, 0.545], [0.064, 0.56], [0.064, 0.58], [0.05, 0.6], [0, 0.6]]), trim); skirt.position.set(0, -cy, 0.05); skirt.receiveShadow = true; g.add(skirt);
  if (home) { const rail = new THREE.Mesh(mould([[0, 0], [0.03, 0.012], [0.062, 0.05], [0.062, 0.09], [0.042, 0.1], [0.042, 0.13], [0, 0.15]]), trim); rail.position.set(0, 5.02 - cy, 0.05); g.add(rail); }      // a picture rail, up above the shelf
  for (const [x, y, w, h] of [[W / 2 + (home ? 4.4 : 1.5), 0.95, 0.5, 0.5], [home ? -W / 2 - 5.9 : -W / 2 - 2.1, 4.3, 0.5, 0.74]]) {                    // a socket low down, a light switch higher up. At home they are further along, clear of the shelf and the basket.
    const plate = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.05, 2, 0.02), trim); plate.position.set(x, y - cy, 0.07); g.add(plate);
    const key = new THREE.Mesh(new RoundedBoxGeometry(w * 0.4, h * 0.45, 0.04, 2, 0.015), new THREE.MeshStandardMaterial({ color: '#dcd5c8', roughness: 0.5 })); key.position.set(x, y - cy, 0.1); key.rotation.x = 0.12; g.add(key);
  }
  // Soft shade where things meet: on the floor in front of the skirting, on the wall above it, and under the rail. Strips that fade out, each corner with its own strength.
  const sh = { p: [], c: [] }, L = -WW / 2, R = WW / 2;
  const strip = (rows) => { for (let i = 0; i < rows.length - 1; i++) { const [ay, az, aa] = rows[i], [by, bz, ba] = rows[i + 1]; sh.p.push(L, ay, az, R, ay, az, R, by, bz, L, ay, az, R, by, bz, L, by, bz); for (const a of [aa, aa, ba, aa, ba, ba]) sh.c.push(1, 1, 1, a); } };
  strip([[0.016 - cy, 0.15, 0.3], [0.016 - cy, 0.5, 0.11], [0.016 - cy, 1.6, 0]]); strip([[0.6 - cy, 0.053, 0.2], [0.73 - cy, 0.053, 0.07], [1.05 - cy, 0.053, 0]]);
  if (home) strip([[5.02 - cy, 0.053, 0.2], [4.93 - cy, 0.053, 0.06], [4.7 - cy, 0.053, 0]]);
  const shGeo = new THREE.BufferGeometry(); shGeo.setAttribute('position', new THREE.Float32BufferAttribute(sh.p, 3)); shGeo.setAttribute('color', new THREE.Float32BufferAttribute(sh.c, 4));
  const shade = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ color: '#2b2218', vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })); shade.renderOrder = -2; g.add(shade);
  // The picture: a sheet of light on the plaster, a little dimmer towards its corners as a lamp is.
  const [cw, ch] = home ? WALL_PX : [1024, 576], { k, tex } = canvasTex(cw, ch), tilt = (x, y) => x * (1 - ks * (1 - y / (Hh / 2)));
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaMap: edgeFade, vertexColors: true, transparent: true, fog: false, toneMapped: false });
  const faceGeo = new THREE.PlaneGeometry(W, Hh, 12, 8), fp = faceGeo.attributes.position, fc = new Float32Array(fp.count * 3);
  for (let i = 0; i < fp.count; i++) { fc.fill(1 - 0.13 * smooth(Math.hypot(fp.getX(i) / (W / 2), fp.getY(i) / (Hh / 2)), 0.3, 1.35), i * 3, i * 3 + 3); fp.setX(i, tilt(fp.getX(i), fp.getY(i))); }
  faceGeo.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const face = new THREE.Mesh(faceGeo, mat); face.position.z = 0.064; g.add(face);
  // The light that spills: a glow round the picture, and a wash on the floor under it. Unlit and added on, it is not a lamp.
  const hp = [], hc = [], tri = (...v) => { for (const [x, y, z, b] of v) { hp.push(x, y, z); hc.push(b, b, b); } };
  const ring = (off, b) => { const pts = [], r = 0.3 + Math.max(off, 0), hx = W / 2 + off - r, hy = Hh / 2 + off - r; [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sy], q) => { for (let j = 0; j < 7; j++) { const a = (q + j / 6) * Math.PI / 2, y = sy * hy + Math.sin(a) * r; pts.push([tilt(sx * hx + Math.cos(a) * r, clamp(y, -Hh / 2, Hh / 2)), y, 0.058, b]); } }); return pts; };
  [ring(-0.16, 1), ring(0.08, 0.33), ring(0.4, 0.09), ring(0.9, 0.014), ring(1.6, 0)].forEach((a, i, all) => { const b = all[i + 1]; if (b) a.forEach((p, j) => { const n = (j + 1) % a.length; tri(p, a[n], b[n], p, b[n], b[j]); }); });
  [-W / 2 - 1.3, -W / 2 + 0.7, W / 2 - 0.7, W / 2 + 1.3].forEach((x, i, xs) => { if (i < 3) { const fy = 0.022 - cy, a = [x, fy, 0.16, i === 0 ? 0 : 0.3], b = [xs[i + 1], fy, 0.16, i === 2 ? 0 : 0.3], c = [xs[i + 1], fy, 2.7, 0], d = [x, fy, 2.7, 0]; tri(a, b, c, a, c, d); } });
  const haloGeo = new THREE.BufferGeometry(); haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)); haloGeo.setAttribute('color', new THREE.Float32BufferAttribute(hc, 3));
  const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: '#fff0cc', vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false })); halo.visible = false; g.add(halo);
  scene.add(g);
  const local = [[-W / 2, Hh / 2], [W / 2, Hh / 2], [W / 2, -Hh / 2], [-W / 2, -Hh / 2]].map(([x, y]) => [tilt(x, y), y]), corners = [V3(), V3(), V3(), V3()];
  let level = 0.6, lv = 0.6;                                              // how bright the picture is, which is how much light it spills
  return { g, cy, mat, get lit() { return lv; }, corners: () => { local.forEach((c, i) => g.localToWorld(corners[i].set(c[0], c[1], 0.06))); return corners; },
    paint: (a, b, c, d) => { const r = paint(k, a, b, c, d); if (r === false) return; if (r >= 0) level = r; tex.needsUpdate = true; },      // a painter can say nothing changed (false), or how bright its picture is (0 to 1)
    spill: (v) => { lv += (level - lv) * 0.06; face.visible = v > 0.003; halo.visible = home && face.visible; halo.material.opacity = v * (0.03 + 0.2 * lv); } };      // the first screen is lit by its own lamp, so only the wall at home gets the glow
}
// the light from its lens to a wall: a cone in three lengths, brightest at the lens and nearly gone by the time it reaches the plaster
const projLamp = new THREE.SpotLight('#fff1cf', 0, 18, 0.6, 0.7, 1.1); scene.add(projLamp, projLamp.target);      // what its projector throws on the room, seen from inside its head
const beam = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#fff3c4', vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }));
beam.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(39), 3)); beam.geometry.setIndex([0, 1, 2, 3].flatMap((i) => { const j = (i + 1) % 4; return [0, 1 + i, 1 + j, 1 + i, 5 + i, 5 + j, 1 + i, 5 + j, 1 + j, 5 + i, 9 + i, 9 + j, 5 + i, 9 + j, 5 + j]; }));
beam.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, ...Array(12).fill(0.1), ...Array(12).fill(0.014), ...Array(12).fill(0.001)]), 3));
beam.frustumCulled = false; beam.visible = false; scene.add(beam);
// dust drifting in that light. Each mote sits part of the way from the lens to a spot on the picture, and glints as it turns.
const motes = (() => { const n = 40, geo = new THREE.BufferGeometry(), seeds = Array.from({ length: n }, () => [wallRnd(), wallRnd(), wallRnd(), wallRnd()]);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const { k, tex } = canvasTex(32, 32), gr = k.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = gr; k.fillRect(0, 0, 32, 32);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, color: '#fff3c4', size: 0.036, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  pts.frustumCulled = false; pts.visible = false; scene.add(pts);
  const sway = (x) => Math.abs(((x / Math.PI) % 2 + 2) % 2 - 1);      // to and fro at an even pace, 0 to 1
  return { pts, move(from, c, T, on) { const p = geo.attributes.position, col = geo.attributes.color;
    seeds.forEach(([a, b, s, w], i) => { const u = 0.04 + 0.92 * sway(a * 40 + T * (0.05 + w * 0.08)), v = 0.04 + 0.92 * sway(b * 40 + T * (0.04 + a * 0.07)), f = (s + T * (0.006 + w * 0.012)) % 1, far = 0.08 + 0.72 * f * f;      // more of them near the lens, where the light is strongest
      const x = lerp(lerp(c[0].x, c[1].x, u), lerp(c[3].x, c[2].x, u), v), y = lerp(lerp(c[0].y, c[1].y, u), lerp(c[3].y, c[2].y, u), v), z = lerp(lerp(c[0].z, c[1].z, u), lerp(c[3].z, c[2].z, u), v);
      p.setXYZ(i, lerp(from.x, x, far), lerp(from.y, y, far), lerp(from.z, z, far));
      const glint = on * Math.sin(f * Math.PI) * (1 - 0.6 * far) * (0.2 + 0.8 * (0.5 + 0.5 * Math.sin(T * (0.7 + w * 1.6) + a * 30)) ** 2); col.setXYZ(i, glint, glint, glint); });
    p.needsUpdate = col.needsUpdate = true; } }; })();

/* ---------- the world ---------- */
// the headline
const HEAD_SIZE = 2.75, HEAD_DEPTH = 1.5, X0 = -7;
const H = capHeight(HEAD_SIZE) + 0.045;
// GONE WALKING is two words, and where each stands is data: where its left end is on the floor, and how far it is turned (its right end going back).
//   stagger   a two-line title set in depth: GONE near and to the left, WALKING further back and to the right, both turned so you see their sides and tops.
//             The passage between the end of GONE and the start of WALKING leads straight back to the front door of his home, which stands close behind it.
//   line      ?gw=line: as it was, one line across the screen, the home far behind the gap between the two words.
//   gate, avenue   two more ways to stand them, for a still only (?gw=gate, ?gw=avenue). The walk is not laid out for them.
// lane: how wide the passage is. door: how far behind the passage the front door stands. For each word, pivot 'end' turns it about its right end.
const GW_KEY = new URLSearchParams(location.search).get('gw'), GW = ({
  line:    { gone: { x: X0, z: 0, yaw: 0 }, walking: { dx: 1.9, dz: 0, yaw: 0 }, lane: 1.9, door: 24, drop: 1.3 },
  gate:    { gone: { x: X0, z: -1.5, yaw: -0.44, pivot: 'end' }, walking: { dx: 3.4, dz: 0, yaw: 0.44 }, lane: 3.4, door: 9, drop: 2.2 },
  avenue:  { gone: { x: X0, z: -1.5, yaw: -1.2, pivot: 'end' }, walking: { dx: 6.5, dz: 0, yaw: 1.2 }, lane: 6.5, door: 16, drop: 2.2 },
})[GW_KEY] || { gone: { x: X0, z: 1.0, yaw: 0.3 }, walking: { dx: 2.5, dz: -3.9, yaw: -0.25 }, lane: 2.5, door: 8.6, drop: 1.5 };
const headline = [...makeWord('GONE', { size: HEAD_SIZE, depth: HEAD_DEPTH, left: 0, z: 0, physics: 'block' }), ...makeWord('WALKING', { size: HEAD_SIZE, depth: HEAD_DEPTH, left: 0, z: 0, physics: 'block' })];
const WORDS = [headline.slice(0, 4), headline.slice(4)];
// Stand a word in its place: every letter is moved and turned as one block about the word's left end (or its right end).
const standWord = (word, x, z, yaw, pivot) => { const w = word[word.length - 1].x1, px = pivot === 'end' ? w : 0, c = Math.cos(yaw), sn = Math.sin(yaw), q = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), yaw);
  for (const L of word) { const lx = L.home.x - px; L.home.set(x + lx * c, L.home.y, z - lx * sn); L.homeQ.copy(q); L.mesh.position.copy(L.home); L.mesh.quaternion.copy(q); L.ax = V3(c, 0, -sn); L.yaw = yaw; }
  return { a: V3(x - px * c, 0, z + px * sn), b: V3(x + (w - px) * c, 0, z - (w - px) * sn), ax: V3(c, 0, -sn), yaw }; };      // where the word starts and ends on the floor, and which way it runs
const GONE_AT = standWord(WORDS[0], GW.gone.x, GW.gone.z, GW.gone.yaw, GW.gone.pivot);
const WALK_AT = standWord(WORDS[1], GONE_AT.b.x + GW.walking.dx, GONE_AT.b.z + GW.walking.dz, GW.walking.yaw);
headline.right = Math.max(GONE_AT.b.x, WALK_AT.b.x);
giveBodies(headline);
headline.forEach((L) => { L.face = faceMat.clone(); L.face.emissive = new THREE.Color(PAL.accent); L.face.emissiveIntensity = 0; L.mesh.material = [L.face, blueMat]; });   // each letter can light up on its own
// The passage: the lane between the end of GONE and the start of WALKING. He comes down off the E at its near end and walks it away from you. His home's front door is at its far end.
const gapA = GONE_AT.b.x, gapB = WALK_AT.a.x, GAPX = (gapA + gapB) / 2;
const LANE = { x: GAPX, z0: Math.max(GONE_AT.b.z, WALK_AT.a.z) + GW.drop, z1: Math.min(GONE_AT.b.z, WALK_AT.a.z) - 1.0 };      // where he lands on the floor, and where he is through
// Where everything after the headline stands. His home, at his own scale, stands behind the passage: its front door is straight ahead of it. He walks through the flat
// and leaves by the back door, by the stove. That door opens on the street: TALKS stands there in line with the door, then the stand (specs),
// then +x past the colours to the evening (LIGHTS, the wall with the film, the dock), the price and the edge.
const HX = GAPX, HZ = LANE.z1 - GW.door + 6.5;                               // where the home stands: its own x 0 (the front door, 6.5 in from its own z 0) is the lane
const hw = (x, y, z) => V3(HX + x, y, HZ + z);                               // a place in the home, in the world
const SX = HX + 0.5, ZD = HZ - 53.7;                                         // the street runs down -z from the back door
// the box, to the left of the headline
const BX = X0 - 7.15, BS = 1.36, BH = 1.05;      // near the title: from where he waves to the G is just under three units of walk (it was eight, over an empty floor)
const Zh = { sock: -24.5, sofa: -32, cat: -41, stove: -47, surface: -51 };      // the home's own places, as js/home-kit.js builds them
const Z = { sock: HZ + Zh.sock, sofa: HZ + Zh.sofa, cat: HZ + Zh.cat, stove: HZ + Zh.stove, talksWord: ZD - 12.6, bump: ZD - 12.6 + 0.62, talk: ZD - 16.4 }; Z.details = Z.talk - 1.0; Z.plinth = Z.details - 3.2;      // the specs plinth stands four units on from where he talks (it was thirteen, over an empty floor). Not closer: the camera at the plinth must stand clear of the fallen letters
//      // TALKS stands in line with the back door, close enough to read through it from the stove
const PZ = Z.plinth, PH = 0.3;
// LIGHTS: the word it knocks over to switch the page to night. It stands behind the path after the colours, as the evening begins.
const lightsW = makeWord('LIGHTS', { size: 1.25, depth: 0.45, left: SX + 19.5, z: PZ - 1.0 });
lightsW.forEach((L) => { L.pivot = V3(L.home.x, L.home.y - L.half.y, L.home.z - L.half.z); L.face = faceMat.clone(); L.face.color.set('#ffe9a6'); L.face.emissive = new THREE.Color('#ffc94d'); L.face.emissiveIntensity = 1.3; L.mesh.material = [L.face, blueMat]; });      // each letter is a lamp: lit while it stands, dark once it is down
const haloTex = (() => { const { k, tex } = canvasTex(128, 128); const g = k.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.42)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 128); return tex; })();
const signLamp = new THREE.PointLight('#ffd48a', 0, 14, 1.4); scene.add(signLamp);
const Lx0 = lightsW[0].x0, Lx1 = lightsW[5].x1;
const S0 = V3(Lx0 - 0.7, 0, PZ), S1 = V3(Lx1 + 0.5, 0, PZ);
// The evening is one set: a wall behind the path. LIGHTS stands in front of its near end, the picture he projects is further along it, and his dock stands at its far end.
// The wall is simply there, as a place, from the colours on. Nothing in the evening pops up: he knocks the lights out, turns to the wall and his own light finds it.
const WALLZ = PZ - 3.1, WCX = Lx1 + 5.6, WEND = WCX + 13;                    // the wall's face, the middle of the picture on it, where the wall ends
const WALL_LEN = 18, WALL_AT = [5, 7.6, 10.2, 12.8, 15.4];      // the stop at the wall, in units of walk, and where on it each next screen comes up: the film has the first 5, the other five 2.6 each
const FILMP = V3(WCX - 0.6, 0, PZ + 2.5), DOCKP = V3(WCX + 9.6, 0, WALLZ + 1.0);      // where he stands to project, and where the dock is
const signShade = (() => { const { k, tex } = canvasTex(256, 128), im = k.createImageData(256, 128); for (let y = 0, i = 0; y < 128; y++) for (let x = 0; x < 256; x++, i += 4) { const u = Math.abs(x - 127.5) / 128, v = Math.abs(y - 63.5) / 64, a = smooth(1 - u, 0, 0.42) * smooth(1 - v, 0, 0.5); im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = 255 * a; } k.putImageData(im, 0, 0); tex.needsUpdate = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(Lx1 - Lx0 + 11, 7.8), new THREE.MeshBasicMaterial({ map: tex, color: '#2a2018', transparent: true, opacity: 0, depthWrite: false, fog: false })); m.position.set((Lx0 + Lx1) / 2, 3.5, WALLZ + 0.07); m.renderOrder = -2; m.visible = false; scene.add(m); return m; })();
// Each letter of LIGHTS is a lamp, and its light has depth: a tight glow on the air just behind it, a wide soft one on the wall behind that, and a pool on the floor
// in front of it. Three sheets of light at three distances, so the glow moves against itself as the camera passes. (One flat sheet behind the word read as weak.)
lightsW.forEach((L) => {
  const glow = (w, h, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: haloTex, color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.renderOrder = -1; m.visible = false; scene.add(m); return m; };
  L.halo = glow(L.half.x * 2 + 2.3, L.half.y * 2 + 1.7, '#ffb84a'); L.halo.position.set(L.home.x, L.home.y + 0.25, L.home.z - L.half.z - 0.35);
  L.wash = glow(L.half.x * 2 + 5.4, L.half.y * 2 + 5.2, '#ff9a3a'); L.wash.position.set(L.home.x, L.home.y + 0.8, WALLZ + 0.075);
  L.pool = glow(L.half.x * 2 + 3.2, 5.0, '#ffbe5c'); L.pool.rotation.x = -Math.PI / 2; L.pool.position.set(L.home.x, 0.022, L.home.z + 1.5);
});
// The film itself, made with Higgsfield (Seedance 2.5, from pictures of this robot). It plays in its own time, not with the scroll.
// If it can't load, a drawn stand-in plays on the wall instead (filmStandIn).
// crossOrigin: the film and the photos below are drawn into the 3D scene, and a browser only allows that for pictures it may read.
// Inside a locked-down frame (some previews and embeds) the page has no origin of its own, so even its own files count as
// someone else's unless they are asked for this way. Without it the wall stayed blank there.
const filmVid = Object.assign(document.createElement('video'), { crossOrigin: 'anonymous', src: 'media/mosey-at-home.mp4', preload: 'auto', muted: true, playsInline: true });
filmVid.setAttribute('playsinline', '');
const filmS = { where: null, t: 0, done: false, sound: true }, FILM_LEN = 40;
const filmReady = () => filmVid.readyState >= 2 && !filmVid.error;
// Its album: six wide pictures of it at home, made with Higgsfield, in the order of its day. And grandma, for the call. None of them is asked for before the
// first frame (wallMediaIn, further down): they come one after the other once the page is up. Each is decoded as soon as it has arrived, off the main thread
// (im.bmp), the album ones at the small size the wall shows them. The wall then draws a ready picture. Without this the browser decoded them all the first
// time the album was drawn, which was a stall of several frames on a slow phone.
const ALBUM = ['hello', 'keys', 'homework', 'film', 'bedtime', 'dock'], wallPic = () => Object.assign(new Image(), { crossOrigin: 'anonymous' });
const photos = ALBUM.map(wallPic), callPic = wallPic(), picReady = (im) => im.complete && im.naturalWidth > 0;
let wallMediaAsked = false;
function wallMediaIn() {
  if (wallMediaAsked) return; wallMediaAsked = true;
  const ask = (im, src, small) => { im.addEventListener('load', () => { if (!window.createImageBitmap) return; const keep = (b) => { im.bmp = b; };
    (small ? createImageBitmap(im, { resizeWidth: 640, resizeHeight: 360, resizeQuality: 'high' }) : createImageBitmap(im)).then(keep).catch(() => createImageBitmap(im).then(keep).catch(() => {})); }, { once: true }); im.src = src; };
  photos.forEach((im, i) => setTimeout(() => ask(im, `media/album-${ALBUM[i]}.jpg`, true), i * 120)); setTimeout(() => ask(callPic, 'media/call-grandma.jpg', false), ALBUM.length * 120);
  setTimeout(() => wallScreens.prep(), 1600);
}

// what it does: three words, each with a screen floating over the path
const talks = makeWord('TALKS', { size: 2.1, depth: 0.9, z: Z.talksWord, physics: 'block' });        // its S is the one Mosey walks into
shiftWord(talks, SX - talks[2].home.x); giveBodies(talks);      // the word stands across his line out of the back door, its middle letter, the L, dead ahead of him. He walks straight into it
const TX = talks[2].home.x;      // the line he walks: at the L
const GAP = 1.35;
const sees = [];      // the word SEES was a gate you went through into the home. The home has a front door now, so the word is gone.

// what it says: a speech card that floats beside it and types its answers
const HELLO = [null, 'Hi, I\'m Mosey.'];      // the first thing it says, in the same bubble, as it waves
const QA = [['Mosey, pasta timer?', 'Nine minutes. I\'ll come and find you.'], ['Mosey, what\'s 7 times 8?', '56. Five, six, seven, eight: 56 is 7 times 8.'], ['Tell me a joke.', 'Why did I cross the page? You kept scrolling.']];
const speech = (() => {
  const { k, tex } = canvasTex(768, 432);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.406), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, toneMapped: false, depthWrite: false }));
  m.visible = false; m.renderOrder = 5; scene.add(m);
  const wrap = (text, x, y, w, lh) => { let line = ''; for (const word of text.split(' ')) { if (k.measureText(line + word).width > w && line) { k.fillText(line, x, y); y += lh; line = ''; } line += word + ' '; } k.fillText(line, x, y); };
  return { m, paint(pair, n, t, rows = 2) {      // pair: what you asked (or nothing, when it speaks first) and what it says. rows: how many lines its answer takes
    k.clearRect(0, 0, 768, 432); k.textAlign = 'left';
    const [q, a] = pair;
    if (q) { k.font = `30px ${DISPLAY}`; const qw = Math.min(748, Math.ceil(k.measureText(q).width) + 60); rr(k, 768 - qw - 10, 10, qw, 70, 35, PAL.ink); k.fillStyle = '#fff'; k.fillText(q, 768 - qw + 20, 56); }      // the dark bubble is as wide as its question. At a fixed 420 the longest one ran off the edge
    if (n > 0) {
      k.font = `44px ${DISPLAY}`; let lines = 1, line = ''; for (const word of a.split(' ')) { if (k.measureText(line + word).width > 630 && line) { lines++; line = ''; } line += word + ' '; }      // the bubble is as tall as the whole answer needs, from the first letter
      const bh = rows === 1 ? 116 : 96 + rows * 54;                                                                   // every answer at the talk stop is two lines, so the bubble never changes size there
      const bw = rows === 1 ? Math.min(700, Math.ceil(k.measureText(a).width) + 84) : 700;      // one short line gets a bubble its own width
      rr(k, 10, 104, bw, bh, 36, PAL.accent); k.fillStyle = PAL.accent; k.beginPath(); k.moveTo(50, 90 + bh); k.lineTo(20, 170 + bh); k.lineTo(130, 100 + bh); k.fill();
      k.fillStyle = PAL.onAccent; wrap(a.slice(0, n), 46, rows === 1 ? 178 : 176, 630, 54);
      if (n < a.length) if (rows > 1) for (let j = 0; j < 7; j++) { const h = 8 + Math.abs(Math.sin(t * 9 + j)) * 26; rr(k, 560 + j * 18, 68 + bh - h / 2, 10, h, 5, PAL.onAccent); }      // its voice, while it is speaking
    }
    tex.needsUpdate = true;
  } };
})();

// its home, at its own scale. From 14 cm up, a sofa is a building and a sock is a landmark. The furniture is built in home-kit.js.
const homeKit = createHome({ THREE, RoundedBoxGeometry, PAL, SX: 0, Z: Zh });
const home = homeKit.group; home.visible = false; scene.add(home); homeKit.scan.at(HX, 0, HZ);
const keyObj = homeKit.keyObj;
const ping = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false }));
ping.rotation.x = -Math.PI / 2; ping.position.copy(keyObj.position).add(home.position).setY(0.04); scene.add(ping);
// what its lens picks out on the way through
const SEEN = [      // room: which room of the home it is in (0 hall, 1 living room, 2 bedroom, 3 bath, 4 kitchen). It is only picked out once that room has been lit
  { p: V3(HX - 1.05, 0.22, Z.sock + 0.25), room: 1, name: 'Sock', line: 'The other one. Finally.' },
  { p: V3(HX - 1.5, 0.4, Z.sofa + 1.5), room: 1, name: 'Dust', line: 'Not my job.' },
  { p: V3(HX + 1.1, 0.25, Z.sofa - 1.2), room: 1, name: 'Keys', line: 'Last seen 8:14. Found.' },
  { p: V3(HX - 2.9, 1.3, Z.cat), room: 1, name: 'Cat', line: 'Asleep. Do not disturb.' },
  { p: V3(HX + 3.9, 6.3, Z.stove - 1), room: 4, name: 'Stove', line: 'Off. I checked twice.' },
];
SEEN.forEach((t) => { const r = homeKit.scan.rooms[t.room]; t.far = Math.hypot(t.p.x - HX - r.entry[0], t.p.z - HZ - r.entry[1]); });      // how far the room's light has to run to reach it
const hud = document.getElementById('hud'), hudA = hud.querySelector('.hud-a'), hudB = hud.querySelector('.hud-b');
const chip = document.getElementById('mapchip'), chipLabel = chip.querySelector('span'), chipCount = chip.querySelector('b'); chip.classList.add('pov'); hud.classList.add('scan');      // the counter in its view: which room it is mapping, and how much is mapped
SEEN.forEach((t) => { t.el = document.createElement('div'); t.el.className = 'vtag'; t.el.innerHTML = `<i><u></u><u></u><u></u><u></u></i><em></em><p><b>${t.name}</b><span>${t.line}</span><small></small></p>`; t.dist = t.el.querySelector('em'); t.conf = t.el.querySelector('small'); hud.appendChild(t.el); });
// the pulse it sends out along the floor to measure the room
const scanRing = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 96), new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending }));
scanRing.rotation.x = -Math.PI / 2; scanRing.visible = false; scene.add(scanRing);
const povLamp = new THREE.PointLight('#ffe2a0', 0, 9, 1.4); scene.add(povLamp);
const IN = (() => { const q = new URLSearchParams(location.search).get('in'), v = q ? q.split(',').map(Number) : []; return { hemi: v[0] ?? 0.58, rim: v[1] ?? 0.15, sun: v[2] ?? 1.3, env: v[3] ?? 0.8, fog: [v[4] ?? 26, v[5] ?? 120] }; })();      // the light indoors, next to the page's own (?in=hemi,rim,sun,env,fogNear,fogFar tries other values)
const povLook = V3();
// The way into its head: from behind its shoulder, up and over the top of its head, and down in front of its face to where its lens is. Places are relative to where it stands
// (x to its right, y up, z behind it). The camera never goes through it, so there is nothing to cut and nothing to fade: its head slides out under the picture, and
// when the camera is in front of its face there is none of it left in view.
const HEAD_PATH = new THREE.CatmullRomCurve3([V3(0.3, 1.1, 2.3), V3(0.1, 1.38, 0.62), V3(0, 1.27, -0.3), V3(0, 0.8, -0.36)], false, 'centripetal'), HEAD_END = V3(0, 0.8, -0.36), HEAD_IN = 0.8;      // HEAD_IN: how far along that way its body is put away (the camera is past its face by then, and none of it is in the picture)
// the dock it charges on (props-kit.js): a ring of lights fills as the battery does, and rings pulse from its antenna while it charges
// The pulse on the floor: the same sphere that brings the house into being (homeKit.scan.pulse), where it cuts the page's own floor. A thin dark line with a pale wash
// behind it, running out from his lens to the foot of his front wall. There the wall's own wires take over and the ring has faded.
const pulseRing = (() => { const u = { uR: { value: 0 }, uInk: { value: new THREE.Color('#3b342d') } };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uR; uniform vec3 uInk; varying vec2 vP;
      void main() { float b = uR - length(vP), line = smoothstep(0.09, 0.03, abs(b - 0.05)), wash = step(0.0, b) * smoothstep(3.2, 0.0, b), k = 1.0 - smoothstep(13.0, 18.5, uR);
        float a = max(line * 0.7, wash * 0.5) * k; if (a < 0.004) discard; gl_FragColor = vec4(mix(vec3(1.0, 0.985, 0.95), uInk, line), a);
        #include <colorspace_fragment>
      }` }));
  m.renderOrder = -12; m.visible = false; m.frustumCulled = false; m.position.set(LANE.x, 0.035, LANE.z0 - 0.3); scene.add(m);
  return { mesh: m, show(on, r) { if (on !== m.visible) m.visible = on; u.uR.value = Math.sqrt(Math.max(0, r * r - 0.6)); } }; })();      // 0.6: the lens is 0.8 off the floor, so on the floor the ring is a little smaller than the sphere
const garden = homeKit.garden; garden.position.set(HX, 0, HZ); garden.visible = false; scene.add(garden);      // the gardens behind the windows (js/home-rooms.js): only there while the camera is indoors
const hallDock = createDock({ THREE, PAL, DISPLAY, MONO }); hallDock.group.position.set(homeKit.dockAt[0], 0, homeKit.dockAt[1]); hallDock.group.rotation.y = -0.5; home.add(hallDock.group); homeKit.scan.patch(hallDock.group); hallDock.update(0, 1, false);      // the same dock, standing in the hall of the home he scans
const DOCK_TURN = -1.4, SOCKET = V3(WCX + 3.2 + 4.4, 0.95, WALLZ + 0.1);      // the wall socket (makeWall puts its plate there), and how far the dock is turned: its display stands to the right of him, facing you
const toDock = (v) => v.clone().sub(DOCKP).applyAxisAngle(V3(0, 1, 0), -DOCK_TURN);
const dockKit = createDock({ THREE, PAL, DISPLAY, MONO, plugAt: toDock(SOCKET), plugDir: V3(0, 0, 1).applyAxisAngle(V3(0, 1, 0), -DOCK_TURN) }), dock = dockKit.group; dock.position.copy(DOCKP); dock.rotation.y = DOCK_TURN; scene.add(dock);      // turned so the display is beside it, facing you, and clear of the way it walks on
const pulse = createAntennaPulse({ THREE, PAL }); scene.add(pulse.group);

// at home: a wall it projects film, photos, a lesson, the day's reminders, a call and the night sky on. The film and the photos are made with Higgsfield.
// This is the drawn stand-in for the film, for a browser that can't play it: Mosey pacing a kitchen floor.
const filmStandIn = (k, t = 0) => { k.fillStyle = '#cfe3d6'; k.fillRect(0, 0, 480, 600); k.fillStyle = '#f6efe2'; for (let y = 380; y < 600; y += 55) for (let x = (y / 55) % 2 ? 0 : 55; x < 480; x += 110) k.fillRect(x, y, 55, 55); k.fillStyle = '#b9d2c2'; k.fillRect(0, 380, 480, 4); k.fillStyle = '#f4f1ea'; k.fillRect(40, 120, 190, 262); k.fillStyle = '#d9d2c4'; k.fillRect(40, 244, 190, 6); k.fillStyle = '#e8452c'; k.beginPath(); k.ellipse(380, 470, 44, 16, 0, 0, 7); k.fill(); tinyMosey(k, 290 + Math.sin(t * 1.1) * 70, 440 + Math.abs(Math.sin(t * 6)) * -6, 44); };
const SLOTS = ['Film', 'Photos', 'Homework', 'Reminders', 'Calls', 'Bedtime'];      // the card's six keys, in two rows of three, and the number each screen goes by
// What is on and by the wall at home, beside the picture: an oak shelf with a print, books and a plant, a brass wall lamp,
// a rope basket with a folded blanket. (Two big books and a mug used to lie on the floor further along. They stood behind LIGHTS, and nothing should stand behind the word.)
// Each part is baked into one of a few meshes, one mesh per kind of surface, and carries its own colour.
const dressWall = (g, cy) => {
  const bins = { matte: [], glaze: [], brass: [], leaf: [], lit: [], glow: [], shade: [] }, m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), eu = new THREE.Euler(), c3 = new THREE.Color();
  const put = (bin, geo, col, x, y, z, rx = 0, ry = 0, rz = 0) => {      // turned about z, then x, then y, and set down at x, y, z
    const o = geo.index ? geo.toNonIndexed() : geo; o.applyMatrix4(m4.compose(V3(x, y - cy, z), q4.setFromEuler(eu.set(rx, ry, rz, 'YXZ')), V3(1, 1, 1)));
    const n = o.attributes.position.count; let cs = o.attributes.color && o.attributes.color.array; if (!cs) { cs = new Float32Array(n * 3); c3.set(col); for (let i = 0; i < n; i++) c3.toArray(cs, i * 3); }
    bins[bin].push({ position: o.attributes.position.array, normal: o.attributes.normal.array, color: cs }); };
  const bake = (bin, mat, shadow = true, tint = 3) => { const geo = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'color']) { const a = new Float32Array(bins[bin].reduce((s, o) => s + o[name].length, 0)); let at = 0; for (const o of bins[bin]) { a.set(o[name], at); at += o[name].length; } geo.setAttribute(name, new THREE.BufferAttribute(a, name === 'color' ? tint : 3)); }
    const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; g.add(m); return m; };
  const lathe = (pts, seg = 22) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  const fan = (rx, ry, vals, dark = false, seg = 20) => { const p = [], c = [], at = (i, k) => { const a = i / seg * Math.PI * 2, r = k / (vals.length - 1); p.push(Math.cos(a) * rx * r, Math.sin(a) * ry * r, 0); if (dark) c.push(1, 1, 1, vals[k]); else c.push(vals[k], vals[k], vals[k]); };      // a soft round patch, strongest in the middle and gone at the rim: a glow, or a shadow if dark
    for (let i = 0; i < seg; i++) for (let k = 0; k < vals.length - 1; k++) { at(i, k); at(i + 1, k + 1); at(i, k + 1); if (k) { at(i, k); at(i + 1, k); at(i + 1, k + 1); } }
    const f = new THREE.BufferGeometry(); f.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); f.setAttribute('color', new THREE.Float32BufferAttribute(c, dark ? 4 : 3)); f.computeVertexNormals(); return f; };
  const OAK = '#b88a55', LINEN = '#efe7d8', PAGES = '#f3ecdc', TERRA = '#c2633f', BRASS = '#d8b468', GREENS = ['#2f6b47', '#3a7d55', '#27583c', '#468a5c'];
  // a hardback standing on its tail with its spine towards you: two boards, a spine with two thin bands, and the pages set back between them
  const book = (x, y, z, a, b, c, col, band, rx = 0, ry = 0, rz = 0) => { const t = 0.022;
    for (const s of [-1, 1]) put('matte', new THREE.BoxGeometry(t, b, c).translate(s * (a - t) / 2, b / 2, 0), col, x, y, z, rx, ry, rz);
    put('matte', new THREE.BoxGeometry(a, b, t).translate(0, b / 2, (c - t) / 2), col, x, y, z, rx, ry, rz);
    for (const h of [0.14, 0.84]) put('matte', new THREE.BoxGeometry(a, 0.014, 0.006).translate(0, b * h, c / 2), band, x, y, z, rx, ry, rz);
    put('matte', new THREE.BoxGeometry(a - 2 * t, b - 0.03, c - t - 0.035).translate(0, b / 2, -t / 2 - 0.0175), PAGES, x, y, z, rx, ry, rz); };
  // a leaf: narrow at the stalk, widest a third of the way up, folded a little along its rib and curling over at the tip
  const leaf = (len, wid, bend, up = 0) => { const p = [], idx = [], rows = 6;
    for (let i = 0; i <= rows; i++) { const t = i / rows, w = wid * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.85), a = bend * t, y = up + len * (a ? Math.sin(a) / bend : t), z = a ? len * (1 - Math.cos(a)) / bend : 0;
      p.push(-w, y, z + w * 0.22, 0, y, z, w, y, z + w * 0.22); if (i) { const o = i * 3; idx.push(o - 3, o - 2, o + 1, o - 3, o + 1, o, o - 2, o - 1, o + 2, o - 2, o + 2, o + 1); } }
    const f = new THREE.BufferGeometry(); f.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); f.setIndex(idx); f.computeVertexNormals(); return f; };

  // the shelf: a thick oak board with a rounded edge, on two brass pegs
  const sx = -4.66, ty = 3.365;
  put('matte', new RoundedBoxGeometry(1.9, 0.13, 0.52, 3, 0.055), OAK, sx, ty - 0.065, 0.31);
  for (const dx of [-0.66, 0.66]) {      // a brass bracket under each end: a leg down the wall, an arm under the board, a curved brace between them, and two screws
    put('brass', new RoundedBoxGeometry(0.06, 0.46, 0.024, 2, 0.01), BRASS, sx + dx, ty - 0.36, 0.062); put('brass', new RoundedBoxGeometry(0.06, 0.024, 0.44, 2, 0.01), BRASS, sx + dx, ty - 0.142, 0.27);
    put('brass', new THREE.TorusGeometry(0.3, 0.014, 6, 14, Math.PI / 2), BRASS, sx + dx, ty - 0.154, 0.074, 0, -Math.PI / 2, -Math.PI / 2);
    for (const dy of [-0.24, -0.5]) put('brass', new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8), '#a8853f', sx + dx, ty + dy, 0.078, Math.PI / 2); }
  { // a framed print leans against the wall at one end: coloured shapes on cream paper
    const part = (bin, geo, col, x, y, z) => put(bin, geo.translate(x, y + 0.51, z), col, sx - 0.5, ty, 0.2, -0.1, 0.06);
    for (const [w, h, x, y] of [[0.8, 0.04, 0, 0.49], [0.8, 0.04, 0, -0.49], [0.04, 0.94, -0.38, 0], [0.04, 0.94, 0.38, 0]]) part('matte', new THREE.BoxGeometry(w, h, 0.05), '#6b4a2c', x, y, 0);
    part('matte', new THREE.BoxGeometry(0.74, 0.96, 0.012), '#f6f0e3', 0, 0, -0.012);
    part('matte', new THREE.CircleGeometry(0.17, 28), '#8d9a8b', -0.07, 0.15, 0); part('matte', new THREE.CircleGeometry(0.21, 24, 0, Math.PI), '#c9a57c', 0.07, -0.16, 0.003);      // an abstract print in quiet tones: sage, sand, a bar of terracotta
    part('matte', new THREE.BoxGeometry(0.1, 0.3, 0.002), TERRA, 0.2, 0.2, 0.004); part('matte', new THREE.BoxGeometry(0.5, 0.012, 0.002), PAL.ink, 0, -0.2, 0.006);
  }
  // books of different sizes, the last one leaning on the others
  [[0.17, 0.68, 0.34, '#6f7f73', LINEN], [0.1, 0.52, 0.3, '#d8ccb4', '#8f6c10'], [0.13, 0.6, 0.32, '#a9553a', LINEN]].reduce((x, [a, b, c, col, band]) => { book(x + a / 2, ty, 0.37, a, b, c, col, band); return x + a + 0.012; }, sx - 0.1);      // cloth spines in sage, linen and rust, each its own height
  book(sx + 0.47, ty, 0.37, 0.15, 0.63, 0.34, PAL.ink, LINEN, 0, 0, 0.17);
  put('matte', new THREE.BoxGeometry(0.02, 0.2, 0.004), '#b23a2a', sx - 0.015, ty - 0.1, 0.56);      // a ribbon marker hangs out of the first one, over the edge of the shelf
  put('shade', fan(1.2, 0.3, [0.2, 0.1, 0], true), 0, sx, ty - 0.22, 0.054);      // the shelf's shadow on the wall under it
  { // a terracotta pot with a plant in it, and one stem trailing over the edge of the shelf
    const px = sx + 0.72, pz = 0.3;
    put('glaze', lathe([[0.001, 0], [0.13, 0], [0.165, 0.03], [0.2, 0.2], [0.2, 0.31], [0.19, 0.335], [0.176, 0.33], [0.17, 0.27], [0.001, 0.27]], 28), '#ebe4d6', px, ty, pz); put('glaze', lathe([[0.001, 0], [0.2, 0], [0.215, 0.014], [0.2, 0.026], [0.001, 0.026]], 28), '#ebe4d6', px, ty - 0.001, pz);      // a glazed ceramic pot on its saucer
    put('matte', new THREE.CircleGeometry(0.166, 18), '#3a2c20', px, ty + 0.275, pz, -Math.PI / 2);
    for (let i = 0; i < 11; i++) { const yaw = i * 2.4 + 0.5, lean = 0.2 + 0.62 * ((i * 0.37) % 1), stalk = 0.16 + 0.26 * ((i * 0.61) % 1), size = 0.26 + 0.12 * ((i * 0.83) % 1);
      put('leaf', new THREE.CylinderGeometry(0.009, 0.012, stalk, 5).translate(0, stalk / 2, 0), '#2a5a3c', px, ty + 0.27, pz, lean, yaw);
      put('leaf', leaf(size, size * 0.3, 1.1, stalk), GREENS[i % 4], px, ty + 0.27, pz, lean, yaw); }
    put('leaf', new THREE.CylinderGeometry(0.008, 0.008, 0.36, 5).translate(0, -0.18, 0), '#2a5a3c', px + 0.06, ty + 0.34, pz + 0.17, 0.75);
    put('leaf', new THREE.CylinderGeometry(0.008, 0.008, 0.72, 5).translate(0, -0.36, 0), '#2a5a3c', px + 0.06, ty + 0.08, pz + 0.3, 0, 0, 0.05);
    for (let i = 0; i < 6; i++) put('leaf', leaf(0.2, 0.068, 0.7), GREENS[(i + 1) % 4], px + 0.06 + i * 0.006, ty + 0.02 - i * 0.125, pz + 0.3, 0.25, 0, Math.PI + (i % 2 ? 0.95 : -0.95));
  }
  { // The wall lamp: a sconce. A round brass backplate with a raised boss, an arm that comes out and curves up through a turned joint, a brass cup, and in the cup a
    // globe of opal glass that is the light itself. It paints a soft pool on the wall behind it.
    const lx = 4.2, ly = 4.3, R = 0.34, lz = 0.07 + R;
    put('brass', lathe([[0.001, 0], [0.17, 0], [0.17, 0.018], [0.15, 0.03], [0.07, 0.036], [0.055, 0.07], [0.001, 0.07]], 28), BRASS, lx, ly - 0.32 - R, 0.055, Math.PI / 2);
    put('brass', new THREE.TorusGeometry(R, 0.02, 8, 18, Math.PI / 2), BRASS, lx, ly - 0.32, 0.09, 0, -Math.PI / 2, -Math.PI / 2);
    put('brass', new THREE.SphereGeometry(0.04, 14, 10), BRASS, lx, ly - 0.32 - R, 0.12); for (const dz of [0.085, 0.155]) put('brass', new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), '#a8853f', lx, ly - 0.32 - R, dz, Math.PI / 2);      // the turned joint, with a collar either side
    put('brass', lathe([[0.02, 0], [0.05, 0.004], [0.062, 0.03], [0.1, 0.06], [0.118, 0.1], [0.1, 0.1], [0.05, 0.05], [0.02, 0.04]], 22), BRASS, lx, ly - 0.33, lz);      // the cup the globe sits in
    put('lit', new THREE.SphereGeometry(0.255, 28, 20), '#ffeccb', lx, ly - 0.02, lz);
    put('glow', fan(1.3, 1.6, [0.17, 0.06, 0.014, 0]), 0, lx, ly - 0.3, 0.057); put('glow', fan(0.56, 0.56, [0.12, 0.04, 0.008, 0]), 0, lx, ly - 0.02, lz + 0.27);
  }
  { // The basket: rope coiled round and round, fourteen turns, wider in the middle, each turn a little off the last so it reads as woven. A darker rim, two
    // leather handles held on by brass rivets. In it a blanket folded in three, the top fold slipping out over the rim, with two quiet stripes.
    const bx = 3.95, bz = 0.95, N = 14;
    for (let i = 0; i < N; i++) { const t = i / (N - 1), r = 0.45 + 0.115 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.25 * t); put('matte', new THREE.TorusGeometry(r, 0.037, 7, 34), i === N - 1 ? '#9c7a4e' : ['#c9a878', '#bf9c69', '#d2b383'][i % 3], bx + 0.006 * Math.sin(i * 2.1), 0.04 + i * 0.066, bz + 0.006 * Math.cos(i * 1.7), Math.PI / 2, i * 0.4); }
    put('matte', new THREE.CylinderGeometry(0.5, 0.42, 0.86, 22, 1, true), '#8a6d47', bx, 0.45, bz);
    for (const s of [-1, 1]) { put('matte', new THREE.TorusGeometry(0.13, 0.024, 7, 14, Math.PI), '#7d5230', bx + s * 0.57, 0.86, bz, 0, Math.PI / 2); for (const dz of [-0.13, 0.13]) put('brass', new THREE.SphereGeometry(0.022, 8, 6), BRASS, bx + s * 0.585, 0.85, bz + dz); }
    put('shade', fan(0.9, 0.78, [0.36, 0.26, 0.08, 0], true), 0, bx, 0.019, bz + 0.04, -Math.PI / 2);      // and the shadow it sits in
    for (const [w, h, d, x, y, z, rx, ry, rz] of [[0.84, 0.2, 0.66, 0, 0.9, 0, 0, 0.16, 0.02], [0.78, 0.19, 0.6, 0.02, 1.06, 0.03, 0, -0.1, -0.04], [0.7, 0.18, 0.6, -0.03, 1.14, 0.3, 0.5, 0.12, 0]]) {
      put('matte', new RoundedBoxGeometry(w, h, d, 4, 0.09), LINEN, bx + x, y, bz + z, rx, ry, rz);
      for (const [dx, col] of [[0.14, '#b9a58a'], [0.24, '#a9553a']]) put('matte', new RoundedBoxGeometry(w, h + 0.008, d + 0.008, 4, 0.09).scale(0.045 / w, 1, 1).translate(dx, 0, 0), col, bx + x, y, bz + z, rx, ry, rz); }      // two stripes run over every fold: taupe and a thin rust
  }
  bake('matte', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 })); bake('glaze', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26 }));
  bake('brass', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.45 })); bake('leaf', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }));
  bake('lit', new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false }), false);      // the inside of the lamp is not lit by anything: it is the light
  bake('shade', new THREE.MeshBasicMaterial({ color: '#2b2218', vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }), false, 4);
  return bake('glow', new THREE.MeshBasicMaterial({ color: '#ffcf8a', vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }), false);      // the lamp's glow is handed back, so the page can turn it up as the room goes dark
};
// The six screens it projects at home, in the order of the card's keys: the film, its photos, homework, today's reminders, a call, bedtime.
// Each is drawn on a 1600 by 900 sheet with an 88 margin, whatever size the canvas is, and is only drawn again when what it shows has changed.
const wallScreens = (() => {
  const INK = PAL.ink, INK2 = 'rgba(21,21,26,0.6)', INK3 = 'rgba(21,21,26,0.4)', CREAM = '#fff6e0', BOARD = '#f5f1e6', DIMW = 'rgba(255,246,224,0.66)'; let last = '';
  const label = (k, s, x, y, px, col, align = 'left') => { k.font = `600 ${px}px ${MONO}`; k.letterSpacing = `${(px * 0.14).toFixed(1)}px`; k.textAlign = align; k.fillStyle = col; k.fillText(s, x, y); k.letterSpacing = '0px'; k.textAlign = 'left'; };
  const head = (k, s, x, y, px, col, align = 'left') => { k.font = `${px}px ${DISPLAY}`; k.textAlign = align; k.fillStyle = col; k.fillText(s, x, y); k.textAlign = 'left'; };
  const dot = (k, x, y, r, col) => { k.fillStyle = col; k.beginPath(); k.arc(x, y, r, 0, 7); k.fill(); };
  const top = (k, a, b, colA, colB, ring) => {                    // every screen starts the same way: its eye, what this is, and a note on the right
    dot(k, 105, 112, 17, ring); dot(k, 105, 112, 13, PAL.accent); dot(k, 105, 112, 7.5, INK); dot(k, 102.5, 109.5, 2.2, '#fff');
    label(k, a, 140, 122, 28, colA); label(k, b, 1512, 122, 28, colB, 'right'); };
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  // The part of a screen that never changes is drawn once, the first time it is wanted, on a sheet of its own. After that it is one picture to copy.
  const sheet = (draw) => { let c = null; return () => { if (!c) { c = document.createElement('canvas'); [c.width, c.height] = WALL_PX; const k = c.getContext('2d'), s = c.width / 1600; k.setTransform(s, 0, 0, s, 0, 0); draw(k); } return c; }; };
  // A photo fills its box and keeps its shape: scaled until it covers, centred, and what sticks out is cut off by the clip. Never stretched.
  const cover = (k, im, x, y, w, h, r = 0) => { const src = im.bmp || im, sc = Math.max(w / src.width, h / src.height), iw = src.width * sc, ih = src.height * sc;
    k.save(); k.beginPath(); k.roundRect(x, y, w, h, r); k.clip(); k.drawImage(src, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); k.restore(); };

  // Today's reminders. It is 14 centimetres tall and can't cook, so the recipe went. What it can do is remember for you. The list never changes, so it is drawn
  // once. Only the ring on the right moves: how long until the next one.
  const TODO = [['7:30', 'Bins out', 1], ['16:00', 'Dentist, Lena', 1], ['18:30', 'Call grandma', 2], ['21:00', 'Bedtime story', 0]];      // the time, the line, and where it stands: 1 done, 2 next, 0 still to come
  const RING = [1268, 446, 196];
  const remindBase = sheet((k) => {
    k.fillStyle = CREAM; k.fillRect(0, 0, 1600, 900);
    top(k, 'REMINDERS · TODAY', `${TODO.length} TODAY · ${TODO.filter((r) => r[2] === 1).length} DONE`, INK, INK2, INK); k.fillStyle = 'rgba(21,21,26,0.14)'; k.fillRect(88, 160, 1424, 2);
    TODO.forEach(([time, line, st], i) => { const y = 196 + i * 142, mid = y + 62;                   // four rows, each 124 high
      if (st === 2) rr(k, 64, y, 900, 124, 28, INK);                                                  // the next one stands on a dark bar
      if (st === 1) { dot(k, 118, mid, 24, INK3); k.strokeStyle = CREAM; k.lineWidth = 6; k.lineCap = k.lineJoin = 'round'; k.beginPath(); k.moveTo(107, mid + 1); k.lineTo(115, mid + 9); k.lineTo(130, mid - 8); k.stroke(); k.lineCap = 'butt'; k.lineJoin = 'miter'; }      // done: a disc with a tick in it
      else { k.strokeStyle = st === 2 ? PAL.accent : 'rgba(21,21,26,0.5)'; k.lineWidth = 4; k.beginPath(); k.arc(118, mid, 22, 0, 7); k.stroke(); if (st === 2) dot(k, 118, mid, 9, PAL.accent); }
      k.font = `600 40px ${MONO}`; k.textAlign = 'right'; k.fillStyle = st === 2 ? PAL.accent : st ? INK3 : PAL.deep; k.fillText(time, 304, mid + 14); k.textAlign = 'left';
      head(k, line, 338, mid + 22, 62, st === 2 ? CREAM : st ? INK3 : INK);
      if (st === 1) { k.fillStyle = INK3; k.fillRect(330, mid + 1, k.measureText(line).width + 16, 4); }      // and a line through it
      if (st === 2) label(k, 'NEXT', 930, mid + 9, 24, PAL.accent, 'right'); });
    label(k, 'SAY “MOSEY, REMIND ME”', 88, 826, 26, INK2);
    const [cx, cy, r] = RING; k.lineWidth = 26; k.strokeStyle = 'rgba(21,21,26,0.08)'; k.beginPath(); k.arc(cx, cy, r, 0, 7); k.stroke();
    k.lineWidth = 2; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = r - 30, r1 = r0 - (i % 5 ? 7 : 15); k.strokeStyle = i % 5 ? 'rgba(21,21,26,0.16)' : 'rgba(21,21,26,0.42)'; k.beginPath(); k.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); k.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); k.stroke(); }
    label(k, 'NEXT IN', cx, cy - 62, 26, INK2, 'center'); label(k, 'MIN', cx, cy + 92, 26, INK2, 'center');
    const next = TODO.find((r) => r[2] === 2); label(k, `${next[0]} · ${next[1].toUpperCase()}`, cx, 736, 28, PAL.deep, 'center');
  });
  const remind = (k, left) => {
    k.drawImage(remindBase(), 0, 0, 1600, 900);
    const [cx, cy, r] = RING, a1 = -Math.PI / 2 + left / 720 * Math.PI * 2;
    k.lineWidth = 26; k.strokeStyle = PAL.accent; k.lineCap = 'round'; k.beginPath(); k.arc(cx, cy, r, -Math.PI / 2, a1); k.stroke(); k.lineCap = 'butt';
    dot(k, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, 6, INK); head(k, clock(left), cx, cy + 40, 112, INK, 'center');
  };

  // Homework: a lesson on a pale board, the way a teacher would draw it. The sun, eight orbits, and the planets going round on them, the near ones faster.
  // The planets are not to scale and nor are the gaps, as in every school book. The board, the orbits and the words are drawn once. The planets move.
  const SUN = [1150, 520], LAP = 90, EARTH = 2;                                                       // LAP: the seconds the Earth takes to go round once here
  const PLANETS = [[58, 6, 0.4], [92, 10, 2.5], [130, 11, 5.6], [170, 8, 3.7], [222, 23, 1.3], [268, 17, 4.5], [304, 14, 2.9], [334, 13, 0.1]];      // how far out each is drawn, how big, and where on its lap it starts
  const lessonBase = sheet((k) => {
    k.fillStyle = BOARD; k.fillRect(0, 0, 1600, 900);
    for (let y = 204.5; y < 860; y += 44.5) for (let x = 88; x <= 1512; x += 44.5) dot(k, x, y, 1.6, 'rgba(21,21,26,0.13)');      // squared paper, in dots
    top(k, 'HOMEWORK · THE SOLAR SYSTEM', 'LESSON 4 · SPACE', INK, INK2, INK); k.fillStyle = 'rgba(21,21,26,0.14)'; k.fillRect(88, 160, 1424, 2);
    label(k, `PLANET ${EARTH + 1} OF ${PLANETS.length}`, 88, 262, 34, PAL.deep); head(k, 'Earth.', 82, 408, 150, INK);
    k.font = `600 36px ${MONO}`; k.fillStyle = 'rgba(21,21,26,0.8)'; k.fillText('Third from the sun.', 90, 486); k.fillText('One lap is one year.', 90, 536);
    let x = 88; for (const [name, qty] of [['ONE LAP', '365 DAYS'], ['MOONS', '1']]) {              // two facts, in the outlined tags the recipe had
      k.font = `600 26px ${MONO}`; k.letterSpacing = '3.6px'; const w1 = k.measureText(name).width, w = w1 + k.measureText(qty).width + 66; k.letterSpacing = '0px';
      rr(k, x, 590, w, 60, 30, BOARD); k.strokeStyle = 'rgba(21,21,26,0.26)'; k.lineWidth = 2.5; k.beginPath(); k.roundRect(x, 590, w, 60, 30); k.stroke();
      label(k, name, x + 26, 629, 26, INK); label(k, qty, x + 40 + w1, 629, 26, PAL.deep); x += w + 14; }
    k.font = `600 26px ${MONO}`; k.letterSpacing = '3.6px'; const aw = k.measureText('ASK IT ANYTHING').width + 92; k.letterSpacing = '0px'; rr(k, 88, 770, aw, 62, 31, INK); label(k, 'ASK IT ANYTHING', 148, 810, 26, CREAM);
    const [sx, sy] = SUN; rr(k, sx - 350, sy - 346, 700, 692, 346, BOARD);                           // the dots stop where the drawing is
    PLANETS.forEach(([r], i) => { k.strokeStyle = i === EARTH ? 'rgba(21,21,26,0.62)' : 'rgba(21,21,26,0.24)'; k.lineWidth = i === EARTH ? 3 : 2; k.beginPath(); k.arc(sx, sy, r, 0, 7); k.stroke(); });
    k.strokeStyle = PAL.accent; k.lineWidth = 4; k.lineCap = 'round'; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r1 = i % 2 ? 44 : 49; k.beginPath(); k.moveTo(sx + Math.cos(a) * 37, sy + Math.sin(a) * 37); k.lineTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1); k.stroke(); } k.lineCap = 'butt';
    dot(k, sx, sy, 30, INK); dot(k, sx, sy, 26.5, PAL.accent);                                        // the sun: brass, with an ink edge and short rays
  });
  const lesson = (k, t) => {
    k.drawImage(lessonBase(), 0, 0, 1600, 900);
    dot(k, 118, 801, 8 + 2.5 * Math.sin(t * 3), PAL.accent);                                          // it is listening
    PLANETS.forEach(([r, size, a0], i) => { const a = a0 - t * (Math.PI * 2 / LAP) * Math.pow(PLANETS[EARTH][0] / r, 1.5), x = SUN[0] + Math.cos(a) * r, y = SUN[1] + Math.sin(a) * r;
      k.strokeStyle = INK; k.lineWidth = 3;
      if (i === 5) { k.beginPath(); k.ellipse(x, y, size * 1.9, size * 0.55, -0.4, 0, 7); k.stroke(); }      // Saturn's ring, the far half first
      k.fillStyle = i === EARTH ? INK : BOARD; k.beginPath(); k.arc(x, y, size, 0, 7); k.fill(); k.stroke();
      if (i === 5) { k.beginPath(); k.ellipse(x, y, size * 1.9, size * 0.55, -0.4, 0, Math.PI); k.stroke(); }
      if (i === 4) { k.lineWidth = 2; for (const dy of [-7, 6]) { const hw = Math.sqrt(size * size - dy * dy) - 2; k.beginPath(); k.moveTo(x - hw, y + dy); k.lineTo(x + hw, y + dy); k.stroke(); } }      // Jupiter's bands
      if (i === EARTH) {                                                                              // the one the lesson is about: a brass ring round it, its moon, and its name
        const m = t * 0.8; dot(k, x + Math.cos(m) * 19, y + Math.sin(m) * 19, 3.5, INK);
        k.strokeStyle = PAL.accent; k.lineWidth = 5; k.beginPath(); k.arc(x, y, 30, 0, 7); k.stroke();
        k.font = `600 24px ${MONO}`; k.letterSpacing = '3.4px'; const w = k.measureText('EARTH').width + 34; k.letterSpacing = '0px';
        k.strokeStyle = INK; k.lineWidth = 2.5; k.beginPath(); k.moveTo(x + 22, y - 22); k.lineTo(x + 46, y - 46); k.stroke();
        rr(k, x + 40, y - 90, w, 46, 23, INK); label(k, 'EARTH', x + 58, y - 58, 24, CREAM); } });
  };

  // A call on the wall. Grandma fills the picture as she would on a video call. Over her: how long the call has run, her name, the two buttons, and you in the corner.
  const call = (k, t, secs) => {
    if (picReady(callPic)) cover(k, callPic, 0, 0, 1600, 900);
    else { const g = k.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, '#6d6257'); g.addColorStop(1, '#3a332d'); k.fillStyle = g; k.fillRect(0, 0, 1600, 900); dot(k, 800, 400, 120, 'rgba(255,246,224,0.2)'); k.beginPath(); k.ellipse(800, 900, 330, 290, 0, 0, 7); k.fill(); }      // until she has arrived: a head and shoulders
    let g = k.createLinearGradient(0, 0, 0, 230); g.addColorStop(0, 'rgba(8,8,12,0.6)'); g.addColorStop(1, 'rgba(8,8,12,0)'); k.fillStyle = g; k.fillRect(0, 0, 1600, 230);
    g = k.createLinearGradient(0, 560, 0, 900); g.addColorStop(0, 'rgba(8,8,12,0)'); g.addColorStop(1, 'rgba(8,8,12,0.84)'); k.fillStyle = g; k.fillRect(0, 560, 1600, 340);
    dot(k, 99, 112, 9, '#43d17c'); label(k, `CALL · ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`, 124, 122, 28, '#fff'); label(k, 'VIDEO · 40 IN', 1512, 122, 28, DIMW, 'right');
    head(k, 'Grandma', 84, 792, 88, '#fff'); const nx = 84 + k.measureText('Grandma').width + 30;
    for (let i = 0; i < 4; i++) { const h = 12 + 30 * Math.abs(Math.sin(t * (2.3 + i * 0.9) + i * 1.7)); rr(k, nx + i * 15, 760 - h / 2, 8, h, 4, PAL.accent); }      // she is the one talking
    label(k, 'ON THE KITCHEN WALL', 88, 838, 26, PAL.accent);
    { const x = 742, y = 796;                                                                        // mute: a microphone
      dot(k, x, y, 44, 'rgba(255,255,255,0.22)'); rr(k, x - 8, y - 22, 16, 28, 8, '#fff'); k.strokeStyle = '#fff'; k.lineWidth = 3.5; k.lineCap = 'round';
      k.beginPath(); k.arc(x, y - 6, 15, 0, Math.PI); k.stroke(); k.beginPath(); k.moveTo(x, y + 9); k.lineTo(x, y + 19); k.moveTo(x - 9, y + 19); k.lineTo(x + 9, y + 19); k.stroke(); }
    { const x = 858, y = 796;                                                                        // end: a handset, hung up
      dot(k, x, y, 44, '#e5412d'); k.strokeStyle = '#fff'; k.lineWidth = 11; k.beginPath(); k.arc(x, y + 30, 34, Math.PI * 1.24, Math.PI * 1.76); k.stroke(); k.lineCap = 'butt'; }
    { const w = 288, h = 162, x = 1512 - w, y = 846 - h;                                              // you, in the corner: a soft tile with a head and shoulders
      k.save(); k.beginPath(); k.roundRect(x, y, w, h, 18); k.clip(); const tg = k.createLinearGradient(0, y, 0, y + h); tg.addColorStop(0, '#4b4640'); tg.addColorStop(1, '#2a2826'); k.fillStyle = tg; k.fillRect(x, y, w, h);
      dot(k, x + w / 2, y + 66, 30, 'rgba(255,246,224,0.34)'); k.beginPath(); k.ellipse(x + w / 2, y + h + 22, 74, 66, 0, 0, 7); k.fill(); k.restore();
      k.strokeStyle = 'rgba(255,246,224,0.8)'; k.lineWidth = 3; k.beginPath(); k.roundRect(x, y, w, h, 18); k.stroke(); label(k, 'YOU', x + 18, y + h - 16, 20, DIMW); }
  };

  const filmScr = (k, t) => {                                     // the film, the same one it showed you at the start, with a title and a scrub bar over it
    k.fillStyle = '#0c0d12'; k.fillRect(0, 0, 1600, 900);
    if (filmReady()) k.drawImage(filmVid, 0, 0, 1600, 900); else { k.save(); k.translate(0, -470); k.scale(1600 / 480, 1600 / 480); filmStandIn(k, t); k.restore(); }
    let g = k.createLinearGradient(0, 0, 0, 230); g.addColorStop(0, 'rgba(8,8,12,0.62)'); g.addColorStop(1, 'rgba(8,8,12,0)'); k.fillStyle = g; k.fillRect(0, 0, 1600, 230);
    const dur = filmReady() ? filmVid.duration || 30 : 12, now = filmReady() ? filmVid.currentTime : t % 12, u = clamp(now / dur, 0, 1);
    const ta = 1 - smooth(now, 2.6, 3.8);      // the title is an opening title: up for the first seconds, then it leaves the picture to the film (it sat over him in the last two scenes)
    g = k.createLinearGradient(0, 500, 0, 900); g.addColorStop(0, 'rgba(8,8,12,0)'); g.addColorStop(1, `rgba(8,8,12,${(0.5 + 0.38 * ta).toFixed(2)})`); k.fillStyle = g; k.fillRect(0, 500, 1600, 400);
    dot(k, 99, 112, 9, '#ff5a3c'); label(k, 'NOW PLAYING', 124, 122, 28, '#fff'); label(k, 'FILM · 40 IN', 1512, 122, 28, DIMW, 'right');
    if (ta > 0.01) { k.save(); k.globalAlpha = ta; head(k, 'A day with Mosey', 84, 716, 88, '#fff'); label(k, 'MADE WITH HIGGSFIELD', 88, 762, 28, PAL.accent); k.restore(); }
    rr(k, 88, 794, 8, 28, 2, '#fff'); rr(k, 103, 794, 8, 28, 2, '#fff'); label(k, clock(now), 136, 818, 28, '#fff');
    rr(k, 250, 805, 1140, 7, 3.5, 'rgba(255,255,255,0.28)'); rr(k, 250, 805, 1140 * u, 7, 3.5, PAL.accent); dot(k, 250 + 1140 * u, 808.5, 11, PAL.accent);
    label(k, clock(dur), 1512, 818, 28, DIMW, 'right');
  };

  // Its album: six photos of its day, two rows of three with a thin gap. One is picked out at a time, a little larger and outlined, and its caption stands under the rows.
  const SHOTS = [['FRONT DOOR', '08:05', 'See you tonight.'], ['SOFA', '16:10', 'Found your keys.'], ['DESK', '17:05', 'Homework, done together.'], ['LIVING ROOM', '20:15', 'Movie night.'], ['BEDROOM', '21:20', 'Stars until they sleep.'], ['HALL', '02:12', 'All quiet.']];      // its day, in the order it happened
  const album = (k, sel) => {
    const g0 = k.createLinearGradient(0, 0, 0, 900); g0.addColorStop(0, 'rgba(22,23,30,0.9)'); g0.addColorStop(1, 'rgba(30,31,42,0.9)'); k.clearRect(0, 0, 1600, 900); k.fillStyle = g0; k.fillRect(0, 0, 1600, 900);      // not quite solid: a projector has no black, so the wall shows through the dark
    top(k, `PHOTOS · ${SHOTS.length}`, 'TODAY · AT HOME', CREAM, PAL.accent, CREAM);
    const gap = 14, w = (1424 - 2 * gap) / 3, h = w * 9 / 16;                                         // the photos are 16 by 9, and so is each place in the rows
    const tile = (i, on) => { const g = on ? 9 : 0, tw = w + g * 32 / 9, th = h + g * 2, x = 88 + (i % 3) * (w + gap) - g * 16 / 9, y = 172 + Math.floor(i / 3) * (h + gap) - g, im = photos[i];
      if (on) rr(k, x - 6, y - 2, tw + 12, th + 14, 22, 'rgba(8,8,12,0.5)');
      if (picReady(im)) cover(k, im, x, y, tw, th, 16); else { rr(k, x, y, tw, th, 16, 'rgba(255,246,224,0.1)'); tinyMosey(k, x + tw / 2, y + th * 0.66, 40); }      // until a photo has arrived: a soft tile with a small drawn Mosey
      if (!on) rr(k, x, y, tw, th, 16, 'rgba(22,23,30,0.36)');
      else { k.strokeStyle = PAL.accent; k.lineWidth = 5; k.beginPath(); k.roundRect(x - 2.5, y - 2.5, tw + 5, th + 5, 18); k.stroke(); } };
    SHOTS.forEach((sh, i) => { if (i !== sel) tile(i, false); }); tile(sel, true);                    // the picked one last, over the edges of its neighbours
    const [place, time, line] = SHOTS[sel]; label(k, `0${sel + 1} / 0${SHOTS.length} · ${place} · ${time}`, 88, 784, 26, PAL.accent); head(k, line, 84, 842, 50, '#fff');
    SHOTS.forEach((sh, i) => rr(k, 1512 - (SHOTS.length - i) * 58 + 10, 812, 48, 8, 4, i === sel ? PAL.accent : 'rgba(255,246,224,0.25)'));
  };

  // The night sky looking north: the Plough, the Pole Star at the tip of the Little Bear, and Cassiopeia on the far side of it, in the Milky Way.
  const at = ([x, y]) => [860 + (x - 860) * 1.3, 380 + (y - 310) * 1.3];
  const SKY = [
    ['URSA MAJOR', 372, 560, [[407, 193], [474, 214], [508, 244], [540, 292], [492, 331], [515, 411], [570, 395]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
    ['URSA MINOR', 814, 626, [[860, 310], [846, 356], [822, 398], [800, 440], [756, 452], [764, 492], [806, 484]], [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]]],
    ['CASSIOPEIA', 1298, 300, [[1179, 284], [1141, 259], [1158, 223], [1122, 202], [1146, 162]], [[0, 1], [1, 2], [2, 3], [3, 4]]],
  ].map(([name, lx, ly, pts, lines]) => ({ name, lx, ly, pts: pts.map(at), lines }));
  const bright = SKY.flatMap((c, n) => c.pts.map(([x, y], i) => [x, y, n === 1 && i === 0 ? 4.6 : 2.6 + ((i * 7 + n * 3) % 4) * 0.45]));
  for (let i = 0; i < 26; i++) bright.push([60 + wallRnd() * 1480, 60 + wallRnd() * 600, 1.5 + wallRnd() * 1.6]);
  const sky = (() => { const c = document.createElement('canvas'); [c.width, c.height] = WALL_PX; const k = c.getContext('2d'), s = c.width / 1600; k.setTransform(s, 0, 0, s, 0, 0);
    const g = k.createLinearGradient(0, 0, 0, 900); g.addColorStop(0, 'rgba(5,7,26,0.9)'); g.addColorStop(0.6, 'rgba(10,15,46,0.9)'); g.addColorStop(1, 'rgba(23,30,72,0.9)'); k.fillStyle = g; k.fillRect(0, 0, 1600, 900);
    k.save(); k.translate(1230, 300); k.rotate(-1.02); const mw = k.createLinearGradient(0, -190, 0, 190); mw.addColorStop(0, 'rgba(150,170,255,0)'); mw.addColorStop(0.5, 'rgba(170,185,255,0.1)'); mw.addColorStop(1, 'rgba(150,170,255,0)'); k.fillStyle = mw; k.fillRect(-1200, -190, 2400, 380);
    for (let i = 0; i < 420; i++) dot(k, (wallRnd() - 0.5) * 2200, (wallRnd() + wallRnd() + wallRnd() - 1.5) * 110, 0.5 + wallRnd() * 0.8, `rgba(225,232,255,${(0.15 + wallRnd() * 0.4).toFixed(2)})`); k.restore();
    for (let i = 0; i < 260; i++) dot(k, wallRnd() * 1600, wallRnd() * 900, 0.6 + wallRnd() * 1.2, `rgba(${wallRnd() > 0.3 ? '255,244,214' : '200,216,255'},${(0.2 + wallRnd() * 0.6).toFixed(2)})`);
    k.strokeStyle = 'rgba(170,190,255,0.36)'; k.lineWidth = 1.6;
    for (const c of SKY) { for (const [a, b] of c.lines) { const [x0, y0] = c.pts[a], [x1, y1] = c.pts[b], d = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / d * 11, uy = (y1 - y0) / d * 11; k.beginPath(); k.moveTo(x0 + ux, y0 + uy); k.lineTo(x1 - ux, y1 - uy); k.stroke(); }      // the lines stop short of each star
      label(k, c.name, c.lx, c.ly, 24, 'rgba(190,205,255,0.82)'); }
    label(k, 'POLARIS', 886, 374, 24, PAL.accent);
    const fade = k.createLinearGradient(0, 600, 0, 900); fade.addColorStop(0, 'rgba(5,7,26,0)'); fade.addColorStop(1, 'rgba(5,7,26,0.55)'); k.fillStyle = fade; k.fillRect(0, 600, 1600, 300);
    top(k, 'BEDTIME · NIGHT LIGHT', 'NORTH SKY · TONIGHT', CREAM, DIMW, CREAM);
    head(k, 'Goodnight.', 82, 724, 124, CREAM); label(k, "STARS ON THE WALL UNTIL THEY'RE ASLEEP", 88, 772, 26, 'rgba(226,232,255,0.8)');
    return c; })();
  // Bedtime. The screen was a star map with constellation names, and the new photos have the real thing:
  // a child's room with his stars on the ceiling. So the screen is that picture now (the album's
  // fifth photo), with the same header, the same "Goodnight." and the sleep timer, and a few of its stars twinkling. The drawn star map stays as
  // the stand-in until the photo has arrived.
  const nightPic = (k, t) => { const im = photos[4];
    k.clearRect(0, 0, 1600, 900); cover(k, im, 0, 0, 1600, 900);
    let g = k.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, 'rgba(5,7,26,0.62)'); g.addColorStop(1, 'rgba(5,7,26,0)'); k.fillStyle = g; k.fillRect(0, 0, 1600, 240);
    g = k.createLinearGradient(0, 470, 0, 900); g.addColorStop(0, 'rgba(5,7,26,0)'); g.addColorStop(1, 'rgba(5,7,26,0.9)'); k.fillStyle = g; k.fillRect(0, 470, 1600, 430);
    for (let i = 0; i < 26; i++) { const x = 380 + ((i * 397) % 1100), y = 40 + ((i * 211) % 270), a = 0.5 + 0.5 * Math.sin(t * (0.9 + (i % 5) * 0.4) + i * 2.4); dot(k, x, y, 5.5, `rgba(255,244,214,${(a * 0.16).toFixed(3)})`); dot(k, x, y, 1.9, `rgba(255,250,236,${(0.25 + a * 0.6).toFixed(3)})`); }      // a few of its stars breathe, over the ceiling only
    top(k, 'BEDTIME · NIGHT LIGHT', 'ON THE CEILING · TONIGHT', CREAM, DIMW, CREAM);
    head(k, 'Goodnight.', 82, 724, 124, CREAM); label(k, "STARS ON THE CEILING UNTIL THEY'RE ASLEEP", 88, 772, 26, 'rgba(226,232,255,0.85)'); };
  const night = (k, t) => {                                       // the picture of his stars on the ceiling, or the drawn star map until it has loaded
    if (picReady(photos[4])) nightPic(k, t); else { k.clearRect(0, 0, 1600, 900); k.drawImage(sky, 0, 0, 1600, 900); }
    { const left = 15 * 60 - (t % (15 * 60)), mm = Math.floor(left / 60), ss = Math.floor(left % 60), bw = 620; label(k, `LIGHTS OFF IN ${mm}:${String(ss).padStart(2, '0')}`, 88, 826, 30, PAL.accent);      // what it is for: a night light on a sleep timer, counting down
      k.fillStyle = 'rgba(226,232,255,0.22)'; k.fillRect(88, 846, bw, 4); k.fillStyle = PAL.accent; k.fillRect(88, 846, bw * left / (15 * 60), 4); }
    if (!picReady(photos[4])) bright.forEach(([x, y, r], i) => { const a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (1.1 + (i % 5) * 0.45) + i * 2.4)); dot(k, x, y, r * 3.4, `rgba(190,205,255,${(a * 0.1).toFixed(3)})`); dot(k, x, y, r * 1.8, `rgba(255,244,214,${(a * 0.28).toFixed(3)})`); dot(k, x, y, r, `rgba(255,248,230,${a.toFixed(3)})`); });
  };

  let cur = -1, t0 = 0;
  const paint = (k, slot, t) => {
    if (slot !== cur) { cur = slot; t0 = t; last = ''; }                                             // each screen starts from its beginning: the first photo, 12 minutes to go, 04:12 into the call
    const since = t - t0, left = Math.ceil(720 - (since % 720)), sel = Math.floor(since / 2.6) % SHOTS.length, secs = 252 + Math.floor(since);
    const key = slot === 1 ? `1 ${sel} ${photos.filter(picReady).length} ${photos.filter((im) => im.bmp).length}` : slot === 2 ? `2 ${Math.floor(t * 10)}` : slot === 3 ? `3 ${left}` : slot === 4 ? `4 ${Math.floor(t * 5)}` : slot === 5 ? `5 ${Math.floor(t * 8)}` : '';
    if (key && key === last) return false; last = key;      // the film is the only screen that changes every time
    const s = k.canvas.width / 1600; k.setTransform(s, 0, 0, s, 0, 0); k.textAlign = 'left';
    if (slot === 0) filmScr(k, t); else if (slot === 1) album(k, sel); else if (slot === 2) lesson(k, t); else if (slot === 3) remind(k, left); else if (slot === 4) call(k, t, secs); else night(k, t);
    return [0.5, 0.3, 0.86, 1, 0.5, 0.14][slot];                                                     // how bright each picture is: the film, the album, the pale board, the cream list, the call, the night sky
  };
  paint.prep = () => { lessonBase(); remindBase(); };                                                // the two drawn boards, made ready on a quiet moment so the first look at them costs nothing
  return paint;
})();
const wallB = makeWall(WCX, WALLZ, 0, wallScreens, 26, true);

// specs: the plinth
const wallLamp = dressWall(wallB.g, wallB.cy);
const plinthKit = createPlinth({ THREE, PAL, PH, post: [0, 0] }), plinth = plinthKit.group; plinth.position.set(SX, 0, PZ); scene.add(plinth);
for (const c of plinth.children) if (c.isGroup && c !== plinthKit.ring) c.visible = false;      // the kit's measuring post falls outside both camera angles here, and the labels already say 14 cm      // a turntable stand with a ruler round it (props-kit.js)
// colours: a gate, the family behind it, and the colour's name standing behind them
const GATE_X = SX + 5.5;
const gate = new THREE.Group(); gate.position.set(GATE_X, 0, PZ); scene.add(gate);
{ // The gate is a scanner: a lamp under its top bar, and a level sheet of light that comes down through the frame as he walks through it.
  // What is above the sheet is already the new colour (see scanPaint). The sheet's height follows the scroll, so it runs both ways.
  // The sheet shows as a thin level bar of light between the two posts (it was a round soft disc, which lay on the floor as a white circle under him).
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 1.72), new THREE.MeshBasicMaterial({ color: '#ffe9b8', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, fog: false }));
  sheet.position.set(0, 1.13, 0); sheet.visible = false; gate.add(sheet); gate.userData.sheet = sheet;
  for (const z of [-0.9, 0.9]) { const foot = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.07, 0.34, 2, 0.03), inkMat); foot.position.set(0, 0.035, z); foot.castShadow = true; gate.add(foot); }
  const tube = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 1.74, 2, 0.03), new THREE.MeshBasicMaterial({ color: '#fff1c4', toneMapped: false })); tube.position.set(0, 2.235, 0); gate.add(tube);      // the lamp, under the top bar
  for (const z of [-0.86, 0.86]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.16, 0.02), new THREE.MeshBasicMaterial({ color: '#ffe2a0', toneMapped: false })); strip.position.set(0, 1.12, z); gate.add(strip); }      // and a lit line down the inside of each post
}
{
  const bar = (w, h, d, px, py, pz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), inkMat); m.position.set(px, py, pz); m.castShadow = true; gate.add(m); };
  bar(0.09, 2.3, 0.09, 0, 1.15, -0.9); bar(0.09, 2.3, 0.09, 0, 1.15, 0.9); bar(0.09, 0.09, 1.89, 0, 2.3, 0);
}
// A change of colour is a scan: a line of light goes over the robot, and the new colour is behind the line. The robot's shell is one material (named Shell
// in js/robot-machined.js, which is not touched). Here that material's shader gets a plane: on one side of it the shell is drawn as the robot has just been
// painted (setWay), on the other as it was before, with a thin band of light where the plane cuts it. The plane is level and comes down over him: with the scroll
// when he walks through the gate, and on a clock, head to feet, when you pick a colour on the card. A robot without a Shell material just changes colour at once.
const scanPaint = (() => {
  const all = [], OFF = [0, 1, 0, 1e4];
  const snap = (st) => { st.U.uOldCol.value.copy(st.shell.color); st.U.uOld.value.set(st.shell.metalness, st.shell.roughness, st.shell.clearcoat); };
  const add = (r) => { let shell = null; r.root.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.name === 'Shell') shell = m; }); if (!shell) return null;
    const U = { uOldCol: { value: shell.color.clone() }, uOld: { value: V3(shell.metalness, shell.roughness, shell.clearcoat) }, uPlane: { value: new THREE.Vector4(...OFF) }, uGlow: { value: 0 } };
    shell.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintW;').replace('#include <project_vertex>', '#include <project_vertex>\nvPaintW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPaintW; uniform vec3 uOldCol; uniform vec3 uOld; uniform vec4 uPlane; uniform float uGlow;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat paintD = dot(uPlane.xyz, vPaintW) + uPlane.w, paintM = step(0.0, paintD);\ndiffuseColor.rgb = mix(uOldCol, diffuseColor.rgb, paintM);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= mix(uOld.y / max(roughness, 0.001), 1.0, paintM);')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(uOld.x, metalnessFactor, paintM);')
        .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= mix(uOld.z / max(clearcoat, 0.001), 1.0, paintM);\n#endif')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.84, 0.42) * uGlow * exp(-paintD * paintD / 0.003);'); };
    shell.customProgramCacheKey = () => 'paint-scan'; shell.needsUpdate = true;
    const st = { r, shell, U, t: -1, base: { col: shell.color.clone(), v: V3(shell.metalness, shell.roughness, shell.clearcoat) } }; all.push(st); return st; };
  return { add,
    to(st, key) { snap(st); st.r.setWay(key); st.t = 0; },                                           // paint it now, and run the line over it: head to feet, a little over half a second
    level(st, y) { st.t = -1; st.U.uOldCol.value.copy(st.base.col); st.U.uOld.value.copy(st.base.v); st.U.uPlane.value.set(0, 1, 0, -y); st.U.uGlow.value = 3; },      // the gate: what is above y is new, what is below is still as it came out of the box
    rest(st) { if (st.t < 0) { st.U.uPlane.value.set(...OFF); st.U.uGlow.value = 0; } },
    update(dt) { for (const st of all) { if (st.t < 0) continue; st.t += dt / 0.95; if (st.t >= 1) { st.t = -1; st.U.uPlane.value.set(...OFF); st.U.uGlow.value = 0; continue; }
      const e = st.t * st.t * (3 - 2 * st.t), y0 = st.r.root.position.y, sc = st.r.root.scale.y; st.y = y0 + lerp(1.3, -0.1, e) * sc; st.U.uPlane.value.set(0, 1, 0, -st.y); st.U.uGlow.value = 3 * Math.sin(Math.PI * Math.min(1, st.t * 1.15)) ** 0.6; } } };
})();
const scanBar = (() => { const mat = new THREE.MeshBasicMaterial({ color: '#ffe9b8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }), g = new THREE.Group(), w = 1.0, t = 0.014;
  for (const [sx, sz, px, pz] of [[w, t, 0, w / 2], [w, t, 0, -w / 2], [t, w, w / 2, 0], [t, w, -w / 2, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.008, sz), mat); m.position.set(px, 0, pz); g.add(m); }
  g.material = mat; g.visible = false; scene.add(g); return g; })();
const family = Object.keys(WAYS).filter((key) => key !== 'classic').map((key, i) => {
  const r = createRobot(); r.setWay(key);
  r.root.position.set(GATE_X + 3.6 + i * 1.5, 1.3, PZ - 2.7); r.root.rotation.y = -0.2 + i * 0.12;
  scene.add(r.root); return { r, key, seed: i * 1.7, paint: scanPaint.add(r) };      // every robot's shell gets the scan, so they all share the same two shaders (bare metal and painted) and both are built behind the loader
});
const sizes = createSizes({ THREE, RoundedBoxGeometry, scene, family, WAYS, createRobot, mats: { blue: blueMat, ink: inkMat }, at: [GATE_X + 5.1, PZ - 2.7], DISPLAY, MONO, PAL, paint: scanPaint, canvasTex, get robot() { return robot; } });      // the stage they stand on, with a Mosey XL next to them (js/sizes.js)
const shelf = sizes.group; scene.add(shelf);
const nameWords = {}, NAME_X = GATE_X + 5.3, NAME_K = 0.72;      // the colour's name stands behind the stage. With the camera this close it is shown at 0.72, or TOMATO runs off both sides
for (const key of Object.keys(WAYS)) {
  const m = [new THREE.MeshStandardMaterial({ color: WAYS[key].body, roughness: 0.7 }), new THREE.MeshPhysicalMaterial({ color: WAYS[key].body, roughness: 0.4, clearcoat: 0.4 })];
  const w = makeWord(WAYS[key].name.toUpperCase(), { size: 1.5, depth: 0.6, z: PZ - 4.2, mat: m });
  shiftWord(w, GATE_X + 5.3 - (w[0].x0 + w[w.length - 1].x1) / 2); w.k = 0; w.forEach((L) => { L.mesh.visible = false; }); nameWords[key] = w;
}
// price: thin numerals that fall like dominoes
const PRICE_X = WEND + 11;
const priceProbe = makeWord('$149', { size: 3.7, depth: 0.55, z: 0, add: false, gaps: { 3: 0.22 } });
const price = makeWord('$149', { size: 3.7, depth: 0.55, left: PRICE_X - priceProbe.right / 2, z: PZ - 3.7, physics: 'block', gaps: { 3: 0.22 } });
giveBodies(price);

// the floor is a thin board with a graph paper grid and an accent edge
const EX = PRICE_X + 11, EZ = PZ - 0.5; let floorMesh = null;
{
  const { k, tex } = canvasTex(256, 256);
  k.fillStyle = PAL.ground; k.fillRect(0, 0, 256, 256);
  k.fillStyle = 'rgba(21,21,26,0.085)'; k.fillRect(0, 0, 256, 3); k.fillRect(0, 0, 3, 256);
  k.fillStyle = 'rgba(21,21,26,0.3)'; k.fillRect(0, 0, 14, 3); k.fillRect(0, 0, 3, 14);
  const FW = EX - BX + 50, FCX = (EX + BX - 50) / 2;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(FW, 200); tex.offset.x = (FCX - FW / 2) % 1; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94 }), side = new THREE.MeshStandardMaterial({ color: '#e9e1d4', roughness: 0.95 });
  const floor = floorMesh = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.4, 200), [yellowMat, side, top, new THREE.MeshBasicMaterial({ color: '#a89878' }), side, side]);      // the underside is in its own shadow: deep blue, so it sinks into the drop
  floor.position.set(FCX, -0.2, -50); floor.receiveShadow = true; scene.add(floor);
  const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(FCX, -20, -50));
  world.createCollider(RAPIER.ColliderDesc.cuboid(FW / 2, 20, 100).setFriction(0.9), b);
  const p = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(SX, PH / 2, PZ));
  world.createCollider(RAPIER.ColliderDesc.cylinder(PH / 2, 0.95), p);
}
// far below the edge: the last words of the page, and the button it lands on
const FY = -17, ES = 1.7;
const endL2 = makeWord('WALKING.', { size: ES, depth: 0.8, z: EZ, mat: END, base: FY });
shiftWord(endL2, EX + 4.1 - endL2[5].home.x);      // (3.0 put the button, and so his whole fall, exactly under the edge of the floor: he came down through the slab with half his body. 1.1 further out and he is a full arm's length clear of it all the way)
const endL1 = makeWord('GONE', { size: ES, depth: 0.8, left: endL2[0].x0, z: EZ, mat: END, base: FY + capHeight(ES) + 0.16 });
// the 2 that takes the 1's place when he knocks it over (see the price in the loop). It waits out of sight under the floor.
const two = makeWord('2', { size: 3.7, depth: 0.55, left: 0, z: PZ - 3.7, physics: 'block' })[0];
{ const dx = price[1].home.x - two.home.x; two.home.x += dx; two.x0 += dx; two.x1 += dx; two.mesh.visible = false; two.landed = true; giveBodies([two]); letters.splice(letters.indexOf(two), 1); two.body.setBodyType(RAPIER.RigidBodyType.Fixed, true); two.body.setTranslation({ x: two.home.x, y: -40, z: two.home.z }, true); }
const tagA = document.getElementById('tag-regular'), tagB = document.getElementById('tag-xl');
const endBox = { cx: (endL2[0].x0 + endL2[endL2.length - 1].x1) / 2, cy: FY + capHeight(ES) + 0.3, w: endL2[endL2.length - 1].x1 - endL2[0].x0 };
{ const g = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: '#d6c6a6', roughness: 0.9 })); g.rotation.x = -Math.PI / 2; g.position.set(EX, FY, EZ); g.receiveShadow = true; scene.add(g); }
const BTN = V3(endBox.cx, FY, EZ + 4.2);
const ctaKit = createCtaButton({ THREE, PAL, DISPLAY, MONO }), cta = ctaKit.group, capBtn = ctaKit.cap; cta.position.copy(BTN); scene.add(cta);      // the big button (props-kit.js)
const LAND = V3(BTN.x, FY + 0.8, BTN.z - 0.98);      // on the back of the cap, so the word on it stays whole
// When it lands on the button the last words are blown apart. Each letter has a place it ends up lying, worked out once, so scroll can run the blast both ways.
const endLetters = [...endL1, ...endL2];      // (after the letters' look is applied they get a smoke and brass tint, further down: clear glass does not read on the paper tone)
endLetters.forEach((L, i) => {
  const dx = L.home.x - BTN.x, far = 0.8 + rnd() * 0.9, top = L.home.y > FY + capHeight(ES);
  const side = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
  L.rest = V3(BTN.x + side * (3.9 + rnd() * 4.6), FY + L.half.z + 0.03, BTN.z - 3.4 + rnd() * 3.8);      // they come down to the left and right of the button, on the floor, clear of the words under it
  L.arc = 2.4 + rnd() * 3.2 + (top ? 1.6 : 0); L.rot = new THREE.Euler(-Math.PI / 2 - Math.PI * 2 * (1 + (i % 2)), (rnd() - 0.5) * 2.6, (rnd() - 0.5) * 1.2); L.late = Math.abs(dx) * 0.012;
});
{ // streaks in the drop, so you feel the speed going down
  const n = 46, m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 1.5, 0.03), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, fog: false }), n), mx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) { let x = BTN.x + (rnd() - 0.5) * 20; if (Math.abs(x - BTN.x) < 1.6) x += 3.2; mx.makeTranslation(x, FY + 2.5 + rnd() * 13.5, EZ - 5 + rnd() * 14); m.setMatrixAt(i, mx); }
  m.frustumCulled = false; scene.add(m);
}

// the box: closed and taped. Mosey has to get out of it.
// The box is drawn where its body is. At rest that is BOX_HOME, and everything inside is built in world coordinates around it.
const BOX_HOME = V3(BX, BH / 2, 0), BOX_SKY = V3(BX + 0.12, 10, 0.02), DROP_D = 0.3;
const boxDrop = new THREE.Group(), boxInner = new THREE.Group(); boxInner.position.copy(BOX_HOME).negate(); boxDrop.add(boxInner); boxDrop.position.copy(BOX_SKY); boxDrop.visible = false; scene.add(boxDrop);
const boxBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(BOX_SKY.x, BOX_SKY.y, BOX_SKY.z).setCcdEnabled(true).setAngularDamping(1.4));
world.createCollider(RAPIER.ColliderDesc.cuboid(BS / 2, BH / 2, BS / 2).setDensity(0.55).setFriction(0.9).setRestitution(0.02), boxBody);
const drop = { state: 'sky', t: 0, hitT: -1, from: V3(), fromQ: new THREE.Quaternion() };
const Q0 = new THREE.Quaternion();
const boxPivot = new THREE.Group(); boxPivot.position.set(BX - BS / 2, 0, 0); boxInner.add(boxPivot);
const flaps = [];
{
  const kraft = '#c9a373', t = 0.04;
  // Kraft paper: an even tan with fibres, specks, a little scuffing and the faint ribs of the corrugation showing through.
  let sd = 11; const rn = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const paper = (k, w, h) => {
    k.fillStyle = kraft; k.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 9) { k.fillStyle = `rgba(70,45,15,${0.018 + rn() * 0.03})`; k.fillRect(x, 0, 3, h); }                   // ribs
    for (let i = 0; i < w * h / 260; i++) { const x = rn() * w, y = rn() * h, l = 4 + rn() * 14, a = rn() * 6.28; k.strokeStyle = rn() > 0.5 ? `rgba(255,236,200,${0.05 + rn() * 0.09})` : `rgba(80,52,20,${0.05 + rn() * 0.1})`; k.lineWidth = 0.6 + rn() * 0.8; k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); k.stroke(); }      // fibres
    for (let i = 0; i < w * h / 900; i++) { k.fillStyle = `rgba(60,38,12,${0.1 + rn() * 0.2})`; k.fillRect(rn() * w, rn() * h, 1 + rn() * 1.5, 1 + rn() * 1.5); }                 // specks
    for (let i = 0; i < 5; i++) { const x = rn() * w, y = rn() * h, g = k.createRadialGradient(x, y, 0, x, y, 40 + rn() * 80); g.addColorStop(0, `rgba(255,240,210,${0.05 + rn() * 0.05})`); g.addColorStop(1, 'rgba(255,240,210,0)'); k.fillStyle = g; k.fillRect(0, 0, w, h); }      // scuffs
    const e = k.createLinearGradient(0, 0, 0, h); e.addColorStop(0, 'rgba(60,35,10,0.1)'); e.addColorStop(0.06, 'rgba(60,35,10,0)'); e.addColorStop(0.94, 'rgba(60,35,10,0)'); e.addColorStop(1, 'rgba(60,35,10,0.14)'); k.fillStyle = e; k.fillRect(0, 0, w, h);                // worn edges
  };
  const kraftTex = (() => { const { k, tex } = canvasTex(512, 512); paper(k, 512, 512); return tex; })();
  const ribs = (() => { const { k, tex } = canvasTex(256, 64); k.fillStyle = '#808080'; k.fillRect(0, 0, 256, 64); for (let x = 0; x < 256; x += 8) { const g = k.createLinearGradient(x, 0, x + 8, 0); g.addColorStop(0, '#6f6f6f'); g.addColorStop(0.5, '#8e8e8e'); g.addColorStop(1, '#6f6f6f'); k.fillStyle = g; k.fillRect(x, 0, 8, 64); } tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 1); tex.colorSpace = THREE.NoColorSpace; return tex; })();
  const cardMat = new THREE.MeshStandardMaterial({ map: kraftTex, bumpMap: ribs, bumpScale: 0.6, roughness: 0.95 }), inMat = new THREE.MeshStandardMaterial({ map: kraftTex, color: '#c9a98a', bumpMap: ribs, bumpScale: 0.6, roughness: 1 });
  // the cut edge of corrugated board: two liners with a wave of fluting between them
  const flute = (len, turned = false) => { const { k, tex } = canvasTex(64, 32); k.fillStyle = '#b08a58'; k.fillRect(0, 0, 64, 32); k.fillStyle = '#d9b98a'; k.fillRect(0, 0, 64, 5); k.fillRect(0, 27, 64, 5);
    k.strokeStyle = '#7d5c33'; k.lineWidth = 3; k.beginPath(); for (let x = 0; x <= 64; x++) { const y = 16 + Math.sin(x / 64 * Math.PI * 4) * 8; x ? k.lineTo(x, y) : k.moveTo(x, y); } k.stroke();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(len / 0.05)), 1); if (turned) { tex.center.set(0.5, 0.5); tex.rotation = Math.PI / 2; }
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }); };
  const tapeMat = new THREE.MeshPhysicalMaterial({ color: PAL.accent, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.25 });        // packing tape has a sheen that paper doesn't
  const printed = (draw) => { const { k, tex } = canvasTex(1024, 800); paper(k, 1024, 800); k.save(); k.scale(2, 2); k.globalAlpha = 0.93; draw(k); k.restore();
    k.globalCompositeOperation = 'multiply'; k.globalAlpha = 0.35; k.drawImage(kraftTex.image, 0, 0, 1024, 800); k.globalCompositeOperation = 'source-over'; k.globalAlpha = 1;      // the ink sits in the paper, not on top of it
    return new THREE.MeshStandardMaterial({ map: tex, bumpMap: ribs, bumpScale: 0.6, roughness: 0.93 }); };
  const front = printed((k) => {
    k.fillStyle = PAL.deep; k.fillRect(0, 0, 512, 58);
    k.fillStyle = '#fbf8f3'; k.font = `600 19px ${MONO}`; k.textAlign = 'left'; k.fillText('A SMALL AI COMPANION · FIRST EDITION', 28, 37);
    k.fillStyle = PAL.deep; k.font = `112px ${DISPLAY}`; k.fillText('MOSEY', 22, 208);
    k.fillStyle = 'rgba(50,30,10,0.8)'; k.font = `600 21px ${MONO}`; k.fillText('HANDLE WITH CURIOSITY', 30, 254); k.fillText('14 CM · 310 G · WALKS', 30, 284);
    k.fillRect(28, 314, 456, 3); for (let i = 0; i < 30; i++) k.fillRect(30 + i * 4.6, 332, i % 3 ? 2 : 3.6, 40);
    k.fillStyle = PAL.accent; k.beginPath(); k.arc(420, 322, 50, 0, 7); k.fill(); k.fillStyle = PAL.onAccent; k.textAlign = 'center'; k.font = `600 16px ${MONO}`; k.fillText('No.', 420, 306); k.font = `34px ${DISPLAY}`; k.fillText('001', 420, 342); k.textAlign = 'left';
  });
  const side = printed((k) => {
    k.fillStyle = PAL.deep; k.fillRect(0, 0, 512, 58);
    for (const x of [176, 276]) { k.beginPath(); k.moveTo(x, 190); k.lineTo(x + 30, 130); k.lineTo(x + 60, 190); k.lineTo(x + 40, 190); k.lineTo(x + 40, 250); k.lineTo(x + 20, 250); k.lineTo(x + 20, 190); k.fill(); }
    k.font = `40px ${DISPLAY}`; k.textAlign = 'center'; k.fillText('THIS WAY UP', 256, 312); k.fillStyle = 'rgba(50,30,10,0.8)'; k.font = `600 19px ${MONO}`; k.fillText('OR ANY WAY. IT GETS UP.', 256, 346);
  });
  const g = new THREE.Group(); g.position.set(BS / 2, 0, 0); boxPivot.add(g);
  const wall = (w, h, d, x, y, z, mat = cardMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
  wall(BS - 0.03, t, BS - 0.03, 0, t / 2 + 0.004, 0, inMat);                                    // no two faces share a plane, so nothing flickers when the box moves
  const topZ = flute(BS), topX = flute(BS, true);
  wall(BS, BH, t, 0, BH / 2, -BS / 2, [cardMat, cardMat, topZ, cardMat, inMat, cardMat]); wall(BS, BH, t, 0, BH / 2, BS / 2, [cardMat, cardMat, topZ, cardMat, front, inMat]);
  wall(t, BH, BS - t, -BS / 2, BH / 2, 0, [inMat, cardMat, topX, cardMat, cardMat, cardMat]); wall(t, BH, BS - t, BS / 2, BH / 2, 0, [side, inMat, topX, cardMat, cardMat, cardMat]);
  const pad = wall(BS - 0.14, 0.27, BS - 0.14, 0, 0.06 + 0.135, 0, new THREE.MeshStandardMaterial({ color: '#e6d6b8', roughness: 1 })); pad.castShadow = false;
  for (const s of [-1, 1]) { const tail = wall(0.16, 0.3, 0.008, 0, BH - 0.15, s * (BS / 2 + t / 2 + 0.005), tapeMat); tail.castShadow = false; }
  const flap = (px, pz, axis, sign, w, d, y, outer) => {
    const h = new THREE.Group(); h.position.set(px, y, pz); g.add(h);
    const eX = flute(d), eZ = flute(w);                                    // the flap's cut edges
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), [eX, eX, cardMat, inMat, eZ, eZ]); m.position.set(axis === 'z' ? sign * w / 2 : 0, 0, axis === 'x' ? sign * d / 2 : 0); m.castShadow = m.receiveShadow = true; h.add(m);
    if (outer) { const tape = new THREE.Mesh(new THREE.BoxGeometry(0.08, t + 0.008, BS + 0.02), tapeMat); tape.position.set(sign * (w - 0.04), 0, 0); h.add(tape); }
    flaps.push({ h, axis, sign, outer, rest: 0.7 + rnd() * 0.3, board: outer && sign > 0 });      // the right-hand lid is the one it climbs out on to
  };
  flap(BS / 2, 0, 'z', 1, BS / 2, BS, BH + t / 2, true); flap(-BS / 2, 0, 'z', -1, BS / 2, BS, BH + t / 2, true);
  flap(0, BS / 2, 'x', 1, BS - 2 * t, BS * 0.28, BH - t / 2 - 0.006, false); flap(0, -BS / 2, 'x', -1, BS - 2 * t, BS * 0.28, BH - t / 2 - 0.006, false);
}
const boxBurst = makeBurst(150, 1.1), landBurst = makeBurst(90, 1.5);
const dust = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 48), new THREE.MeshBasicMaterial({ color: '#b9ad9a', transparent: true, opacity: 0, depthWrite: false }));
dust.rotation.x = -Math.PI / 2; scene.add(dust);
const LANDP = V3(BX + 3.1, 0, 0.7);

// the hero headline: letters that float, turn and glow. They are real bodies, so the box can land on them.
const heroType = [], heroMeshes = [];
const tall = () => innerWidth / innerHeight < 0.8;
{
  const small = tall(), size = small ? 0.56 : 0.8, depth = small ? 0.18 : 0.26;
  const baseMat = new THREE.MeshPhysicalMaterial({ color: PAL.ink, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: PAL.accent, emissiveIntensity: 0 });
  ['MEET', 'MOSEY.'].forEach((row, r) => { let x = 0; [...row].forEach((ch) => {
    const G = glyph(ch, size, depth), mesh = new THREE.Mesh(G.g, baseMat.clone()); mesh.castShadow = true; scene.add(mesh);
    const L = { ch, mesh, r, lx: x + G.c.x, ly: G.half.y, half: G.half, home: V3(), homeQ: new THREE.Quaternion(), i: heroType.length, spinT: -9, push: V3(), state: 'float', t: 0, row: small ? [2.72, 1.98][r] : [2.5, 1.5][r] };
    L.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(BX, L.row, 0).setCanSleep(true).setLinearDamping(0.15).setAngularDamping(0.5).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.cuboid(G.half.x, G.half.y, G.half.z).setDensity(1.1).setFriction(0.8).setRestitution(0.12), L.body);
    mesh.userData.hero = mesh.userData.letter = L; heroType.push(L); heroMeshes.push(mesh); letters.push(L); letterMeshes.push(mesh);
    x += advance(ch, size) + 0.04; }); heroType.filter((L) => L.r === r).forEach((L) => { L.w = x - 0.04; }); });
}
letterFx?.apply({ heroType, headline, lightsW, talks, sees, price, endL1, endL2, nameWords });
two.mesh.material = price[1].mesh.material;
for (const L of endLetters) for (const m of [].concat(L.mesh.material)) if (m.transmission > 0) { m.attenuationColor.set('#a99d89'); m.attenuationDistance = 1.9; m.fog = false; }      // the last words by the button: pale smoked glass, light and see-through. (Smoked brass came out as brown blocks.)
for (const L of endLetters) L.mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(L.mesh.geometry, 40), new THREE.LineBasicMaterial({ color: '#fffaf0', transparent: true, opacity: 0.8, fog: false })));      // and a fine bright line along every edge, which is what makes pale glass show on cream
// TALKS is seen from the kitchen, through the back door, against a pale street and a pale sky, and the lower half of its glass showed the street through it and melted
// into it. So this word gets its own copy of the glass, which takes no haze and is a shade deeper at its foot. (For a while it was also denser all through. That came out too blue.)
// What makes it stand on the floor is a soft contact shadow under each letter that belongs to that letter: it goes where the letter goes, stretches as the letter
// tips, and lies under it where it comes to rest (see the dominoes in the loop). There is no slab under the word and nothing that outlives a letter.
const talksBase = (() => { const g = new THREE.Group(); g.visible = false; scene.add(g);
  const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d'), gr = k.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); k.fillStyle = gr; k.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c), geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (const L of talks) { L.mesh.material = Array.isArray(L.mesh.material) ? L.mesh.material.map((m) => m.clone()) : L.mesh.material.clone();
    for (const m of [].concat(L.mesh.material)) { m.fog = false; if (m.transmission > 0) m.attenuationDistance *= 1.6; const was = m.onBeforeCompile, key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';      // the same glass as the other words. Only its foot is a shade deeper, the nearer the floor the more, which is what stands it on the floor (it works lying down too)
      m.onBeforeCompile = (sh, r) => { was?.call(m, sh, r); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBaseY;').replace('#include <project_vertex>', '#include <project_vertex>\nvBaseY = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBaseY;').replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= mix(0.7, 1.0, smoothstep(0.0, 0.85, vBaseY));\n#include <tonemapping_fragment>'); };
      m.customProgramCacheKey = () => key + '|talks-base'; }
    L.blob = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, color: '#17161c', transparent: true, opacity: 0.4, depthWrite: false, fog: false })); L.blob.renderOrder = 1; g.add(L.blob); }
  return g; })();
// The pushes of the strike, counted in steps of the physics and not in seconds, so that the same pushes land on the same steps on every run and at any frame rate.
// Step 0: the L. Hit low on its front, so its foot goes first: hard backward, a little up, and turning over. Step 3: the A and the K are thrown outward and back,
// spinning. Step 9: the T and the S, less, toppling outward. Each push is an impulse (mass times the speed below) and a spin. After that it is all the physics.
// Each row is one letter: its speed sideways, up and back, then its spin about x (turning over), about y (spinning on the floor) and about z (toppling sideways).
const STRIKE = { T: [-0.4, 2.4, -3.2, -4, -1.0, 0.3], A: [-3.0, 5, -5, -5, -3, 2], L: [0.3, 5.5, -8.5, 6, -1.5, -0.6], K: [3.6, 5.5, -3.8, 4, 3.5, -2.5], S: [0.5, 2.2, -2.8, -3.6, 1.2, -0.3], at: [6, 2, 0, 2, 6], curveAt: 12, curve: 7.5 };
function strikeStep(n) {
  talks.forEach((L, i) => { if (STRIKE.at[i] !== n) return; const v = STRIKE[L.ch], m = L.body.mass(); L.body.wakeUp();
    L.body.applyImpulse({ x: m * v[0], y: m * v[1], z: m * v[2] }, true); L.body.setAngvel({ x: v[3], y: v[4], z: v[5] }, true); });
  if (n === 150) for (const L of talks) { const q = L.body.rotation(); if (1 - 2 * (q.x * q.x + q.z * q.z) > 0.5) { L.body.wakeUp(); L.body.applyImpulse({ x: 0, y: L.body.mass() * 2.4, z: -L.body.mass() * 3 }, true); L.body.setAngvel({ x: -4.5, y: 0.8, z: 0 }, true); } }      // the net under it: nothing is left standing. A letter still on its feet two and a half seconds on goes over backward
  if (n === STRIKE.curveAt) { const L = talks[2], m = L.body.mass(); L.body.applyImpulse({ x: m * STRIKE.curve, y: 0, z: 0 }, true); }      // the L leaves straight back, between its neighbours. Its sideways part comes once it is clear of them, so it does not come down on his way
}
function priceStep(n) {
  if (n === 0) { const L = price[1], m = L.body.mass(), p = L.body.translation(); L.body.lockRotations(false, true); L.body.wakeUp();      // the knock: high on its front, and a shove at its middle so that its foot slides back with it
    L.body.applyImpulseAtPoint({ x: 0, y: 0, z: -m * 3.4 }, { x: p.x, y: p.y + L.half.y * 0.85, z: p.z }, true); L.body.applyImpulse({ x: 0, y: 0, z: -m * 2.2 }, true); }
  if (n === 33) { S.twoT = S.time; two.mesh.visible = true; two.landed = false; two.sq = two.sqV = 0; two.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); two.body.lockRotations(true, true); two.body.setTranslation({ x: two.home.x, y: two.home.y + 9, z: two.home.z }, true); two.body.setRotation(two.homeQ, true); two.body.setLinvel({ x: 0, y: 0, z: 0 }, true); two.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
}
const landDust = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#a89a82', transparent: true, opacity: 0, depthWrite: false, fog: false })); landDust.position.set(BTN.x, FY + 0.62, BTN.z); landDust.visible = false; scene.add(landDust);
const strikeDust = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#b9ad9a', transparent: true, opacity: 0, depthWrite: false, fog: false })); strikeDust.position.set(TX, 0.03, Z.talksWord + 0.35); strikeDust.visible = false; scene.add(strikeDust);
function placeHero() { for (const L of heroType) L.home.set(BX - L.w / 2 + L.lx, L.row + L.ly, 0.02); }
const heroTop = heroType[0].row + heroType[0].half.y * 2;      // the top of the upper row, where the box first touches
// a hero letter lets go of its place and falls, or flies back to it
function freeHero(L, away = 0) {
  if (L.state !== 'float') return;
  L.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); L.state = 'free';
  L.body.setLinvel({ x: away * 1.4, y: -1.5, z: (rnd() - 0.4) * 1.6 }, true); L.body.setAngvel({ x: (rnd() - 0.5) * 5, y: (rnd() - 0.5) * 3, z: -away * 3 }, true);
}
function floatHero(L) {
  if (L.state === 'float') return;
  if (L.state === 'homing') { L.after = 'float'; return; }
  L.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  L.from = V3().copy(L.body.translation()); L.fromQ = new THREE.Quaternion().copy(L.body.rotation()); L.t = 0; L.state = 'homing'; L.after = 'float';
}

/* ---------- the route ---------- */
const PIN = V3(BX - 0.05, 0.33, 0.1), RIMP = V3(BX + BS / 2 + 0.32, BH + 0.014, 0.1);      // on the opened right-hand lid, which lies out like a board
// The headline is hopped across, letter by letter. Each letter has one spot to land on: the highest flat place of its top, found by dropping a line on the real glass
// (the round letters stand a little taller than the flat ones, and the glass has a wide bevel, so a fixed height put his feet into the G and over the edge of the O).
const topAt = (L, p) => { const r = new THREE.Raycaster(V3(p.x, 20, p.z), V3(0, -1, 0)); L.mesh.updateMatrixWorld(); const h = r.intersectObject(L.mesh, false)[0]; return h ? h.point.y : -1; };
const along = (L, t) => V3(L.home.x + L.ax.x * t, 0, L.home.z + L.ax.z * t);      // a place on the floor under a letter, t along the way its word runs, from the letter's middle
const SPOT = headline.slice(0, 4).map((L) => { let best = null;      // the middle of the widest stretch that is within 2 hundredths of the letter's top
  const xs = []; for (let t = -L.half.x + 0.15; t <= L.half.x - 0.15; t += 0.04) xs.push([t, topAt(L, along(L, t))]); const top = Math.max(...xs.map((q) => q[1]));
  for (let i = 0, a = -1; i <= xs.length; i++) { const ok = i < xs.length && xs[i][1] > top - 0.02; if (ok && a < 0) a = i; if (!ok && a >= 0) { if (!best || i - a > best[1] - best[0]) best = [a, i]; a = -1; } }
  const p = along(L, (xs[best[0]][0] + xs[best[1] - 1][0]) / 2); p.y = topAt(L, p); return p; });
const E_END = (() => { const L = headline[3], p = along(L, L.half.x - 0.5); p.y = topAt(L, p); return p; })();      // the far end of the E's flat top, over the passage
// The way across the tops of GONE. He walks, as he walks on the floor, and the ground under his feet is the glass itself: a ray dropped on the real letters every
// 15 hundredths along the word, nothing smoothed. Where there is no glass to stand on (between two letters, and the notch in the top of the N) he takes one long
// stride from the last foothold to the next, in a straight line. The footholds are set a little in from each letter's rounded corner. The marks say where each
// stretch of glass starts and ends: onG offG, onO offO, onN offN, midN (one foot on the slope inside the N), onN2 offN2, onE.
const TOPS = (() => { const L4 = headline.slice(0, 4), a = GONE_AT.a, ax = GONE_AT.ax, at = (sd, y) => V3(a.x + ax.x * sd, y, a.z + ax.z * sd), out = [];
  const hAt = (sd) => { const pt = at(sd, 0); let y = -1; for (const L of L4) y = Math.max(y, topAt(L, pt)); return y; };
  const sp = L4.map((L) => { const c = V3(L.home.x - a.x, 0, L.home.z - a.z).dot(ax); return [c - L.half.x, c + L.half.x]; }), s1 = V3(E_END.x - a.x, 0, E_END.z - a.z).dot(ax);
  const runs = [[sp[0][0] + 0.35, sp[0][1] - 0.16, 'onG', 'offG'], [sp[1][0] + 0.25, sp[1][1] - 0.18, 'onO', 'offO'], [sp[2][0] + 0.11, sp[2][0] + 0.81, 'onN', 'offN'], [sp[2][0] + 1.24, sp[2][0] + 1.24, 'midN', null], [sp[2][0] + 1.84, sp[2][1] - 0.12, 'onN2', 'offN2'], [sp[3][0] + 0.13, s1, 'onE', null]];
  let last = H; for (const [s0, sEnd, m0, m1] of runs) { const n = sEnd > s0 ? Math.max(1, Math.round((sEnd - s0) / 0.15)) : 0;
    for (let i = 0; i <= n; i++) { const sd = n ? s0 + (sEnd - s0) * i / n : s0; let y = hAt(sd); if (y < 0) y = last; last = y; const e = { p: at(sd, y) }; if (i === 0) e.mark = m0; else if (i === n && m1) e.mark = m1; out.push(e); } }
  return out; })();
const G_SIDE = along(headline[0], -headline[0].half.x - 0.34);      // on the floor against the side of the G, where he climbs up
const G_FOOT = along(headline[0], -headline[0].half.x - 1.3);                                                       // on the floor before the G, where he jumps from
const DROP = V3(LANE.x, 0, LANE.z0), THRU = V3(LANE.x, 0, LANE.z1);                                                 // where he comes down in the passage, and where he is through it
const WALK_MID = V3().addVectors(WALK_AT.a, WALK_AT.b).multiplyScalar(0.5), FACE_WALK = Math.atan2(WALK_MID.x - E_END.x, WALK_MID.z - E_END.z);      // from the E he turns to look across at WALKING
// The walk through the home: the points of each room (js/home-rooms.js), as steps of the route. A place marked as a stop gets a wait after it.
const PACE = 0.8, hp = (q) => hw(q[0], 0, q[1]), STOPS = { sofa: 4.5, stove: 9.5 };
const houseKnots = [];      // for the camera in his head: at this much walked since the front door, he is at this point of the tour
const houseSteps = (() => { const out = []; let d = 0, k = 0, prev = hp(homeKit.tour[0][0]); houseKnots.push([0, 0]);
  homeKit.tour.forEach((room, i) => room.slice(1).forEach((q, j) => { const p = hp(q), len = prev.distanceTo(p) * PACE, last = j === room.length - 2; d += len; k++; houseKnots.push([d, k]); prev = p;
    out.push({ p, len, ...(q[2] ? { mark: q[2] } : last && i < 4 ? { mark: 'rm' + (i + 1) } : {}) });
    if (q[2]) { d += STOPS[q[2]]; houseKnots.push([d, k]); out.push({ p, how: 'wait', len: STOPS[q[2]], mark: q[2] + 'End', ...(q[2] === 'stove' ? { face: 1.9 } : {}) }); } }));
  return out; })();
// The ground under his feet. Nearly all of the walk is on one floor at height 0, and the y of a point of the route is the ground he stands on there. A few things lie
// on that floor in his way: the mat and the sill at his front door, the doormat and two rugs inside, the sill and the stone step at the back door, the deck and the
// pad of his dock. GROUND says how high the top of each is and where it is (the numbers are the ones js/home-rooms.js, js/home-kit.js and js/props-kit.js build them
// with: if one of those moves, move it here). onGround() takes a stretch of the walk and lays it over them: at every hundredth of the way his height is the highest
// ground under his sole (TOE ahead of him, HEEL behind), so no part of a foot is ever in a surface, and from there it rises and falls at SLOPE, so he is up a step
// just before his toe is over its edge and down only when his heel has left it. The corners of that line go into the route as extra points of the same walk.
const DOCK_OUT = V3(WEND + 1.5, 0, PZ);      // where he walks to from the dock, in the morning
const GROUND = (() => { const box = (h, x, z, w, d) => (px, pz) => (Math.abs(px - x) < w / 2 && Math.abs(pz - z) < d / 2 ? h : 0), home = (h, x, z, w, d) => box(h, HX + x, HZ + z, w, d), ring = (h, c, r0, r1) => (px, pz) => { const r = Math.hypot(px - c.x, pz - c.z); return r >= r0 && r < r1 ? h : 0; }, u = V3().subVectors(DOCK_OUT, DOCKP).setY(0).normalize();
  return [home(0.08, 0, -4.5, 4.6, 2.5), home(0.1, 0, -6.6, 5.6, 1.0),      /* outside the front door: the coir mat, then the wooden sill */
    home(0.15, 0, -8.7, 4.96, 3.16), home(0.27, 0, -8.7, 4.5, 2.7),          /* the doormat in the hall: its rubber tray, and the pile in it */
    home(0.1, -0.5, -41.3, 10, 8), home(0.18, 4.2, -38.2, 0.8, 1.2), home(0.14, 2.8, -47.9, 2.4, 5.4),      /* the rug in the living room, its turned-up corner where he leaves it, the runner by the stove */
    home(0.1, 0.5, -53.8, 4.8, 1.0), home(0.18, 0.5, -55.2, 6.6, 2.2),       /* the back door: the wooden sill, then the stone step outside it */
    ring(0.05, DOCKP, 0, 0.62), ring(0.075, DOCKP, 0.62, 0.76), ring(0.06, DOCKP, 0.76, 0.82),      /* the dock: the white pad he sleeps on, the brass ring round it, the deck that slopes down from the ring */
    (px, pz) => { const s = (px - DOCKP.x) * u.x + (pz - DOCKP.z) * u.z, l = (px - DOCKP.x) * u.z - (pz - DOCKP.z) * u.x; return s > 1.01 && s < 1.13 && Math.abs(l) < 0.25 ? 0.055 : 0; }]; })();      /* and the dock's cable, which lies across his way off it, a step past the deck: he treads on it, not through it */
const groundAt = (x, z) => { let h = 0; for (const g of GROUND) h = Math.max(h, g(x, z)); return h; };
const onGround = (from, steps) => { const TOE = 0.22, HEEL = 0.12, SLOPE = 0.8, DS = 0.01, P = [from, ...steps.map((e) => e.p)], S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  const n = Math.max(1, Math.ceil(S[S.length - 1] / DS)), raw = new Float32Array(n + 1), y = new Float32Array(n + 1), q = V3(); let seg = 1;
  const at = (s) => { while (seg < P.length - 1 && s > S[seg]) seg++; while (seg > 1 && s < S[seg - 1]) seg--; const w = S[seg] - S[seg - 1]; return q.lerpVectors(P[seg - 1], P[seg], w > 1e-6 ? clamp((s - S[seg - 1]) / w, 0, 1) : 1); };
  for (let i = 0; i <= n; i++) { at(i * DS); raw[i] = groundAt(q.x, q.z); }
  for (let i = 0, a = Math.round(HEEL / DS), b = Math.round(TOE / DS); i <= n; i++) { let h = 0; for (let j = Math.max(0, i - a); j <= Math.min(n, i + b); j++) h = Math.max(h, raw[j]); y[i] = h; }      /* the highest ground under his sole */
  for (let i = 1; i <= n; i++) y[i] = Math.max(y[i], y[i - 1] - SLOPE * DS); for (let i = n - 1; i >= 0; i--) y[i] = Math.max(y[i], y[i + 1] - SLOPE * DS);                                           /* up to it and down from it, at a slope */
  const out = []; steps.forEach((e, k) => { const s0 = S[k], s1 = S[k + 1], flat = s1 - s0, i1 = Math.min(n, Math.round(s1 / DS)), end = { ...e, p: V3(e.p.x, y[i1], e.p.z) }; let sPrev = s0;
    if (flat > 1e-6 && (!e.how || e.how === 'walk')) for (let i = Math.floor(s0 / DS) + 1; i * DS < s1 - DS / 2 && i < n; i++) { if (i < 1 || Math.abs(y[i + 1] - 2 * y[i] + y[i - 1]) < 1e-6) continue;      /* a corner in his height: a point of the walk */
      const s = i * DS, c = at(s).clone(); c.y = y[i]; out.push({ p: c, ...(e.len !== undefined ? { len: e.len * (s - sPrev) / flat } : {}) }); sPrev = s; }
    if (e.len !== undefined && sPrev > s0) end.len = e.len * (s1 - sPrev) / flat; out.push(end); });
  return out; };
const route = buildRoute([
  { p: PIN },
  { p: PIN, how: 'wait', len: 1.5, mark: 'knock' },                                              // closed box, something moves inside
  { p: PIN, how: 'wait', len: 2.4, act: 'peek', face: 0.45, mark: 'peeked' },                    // the lid lifts, a lens looks out
  { p: RIMP, how: 'climb', len: 2.4, act: 'climb', mark: 'rim' },
  { p: RIMP, how: 'wait', len: 1.4, act: 'teeter', face: 1.2 },
  { p: LANDP, how: 'jump', len: 3.4, act: 'tumble', lift: 1.15, mark: 'out' },
  { p: LANDP, how: 'wait', len: 1.0, act: 'land', face: 0.4 },
  { p: LANDP, how: 'wait', len: 2.6, act: 'wave', face: 0.12, mark: 'landed' },                 // on its feet, it turns to you and waves
  { p: LANDP, how: 'wait', len: 3.2, act: 'wave', face: 0.12, mark: 'hello' },                  // still waving, it says its name: "Hi, I'm Mosey."
  { p: LANDP, how: 'wait', len: 1.6, face: 0.12 },                                               // it stands and looks at you while the words are still up
  { p: LANDP, how: 'wait', len: 0.9, face: 0.9, mark: 'helloEnd' },                              // it turns to go. The headline is straight ahead.
  { p: G_FOOT, mark: 'headline' },
  { p: G_SIDE },                                                                                 // up to the side of the G
  { ...TOPS[0], how: 'climb', len: 2.6, act: 'climb', mantle: true },                                          // and up it, the way he came out of his box: no jump. It plays with the scroll, forwards and backwards
  ...TOPS.slice(1, -1),                                                                          // then he walks across the tops of the four letters, one continuous walk by distance. Each letter lights as his feet reach it
  { p: E_END, mark: 'gone' },                                                                    // to the end of the E's flat top
  { p: E_END, how: 'wait', len: 2.6, face: FACE_WALK, mark: 'peer' },                            // he stops, turns and looks across at the other word: WALKING, whole
  { p: DROP, how: 'jump', lift: 0, len: 2.6, drop: true, mark: 'gap' },                                   // and steps off the end of the E down into the passage: a low drop that follows the scroll, so it cannot skip
  { p: DROP, how: 'wait', len: 0.5, act: 'land', face: Math.PI - 0.6 },
  { p: DROP, how: 'wait', len: 0.7, face: Math.PI, mark: 'scan' },                               // it turns away from you, to the passage. A pulse leaves its lens: its home starts to come out of it
  { p: THRU, mark: 'inGap' },                                                                    // and walks in, between the end of GONE and the start of WALKING
  ...onGround(THRU, [                                                                            // from here to the street his height is the ground's own: mats, sills, rugs and the step at the back door (see GROUND)
  { p: hp(homeKit.tour[0][0]), mark: 'door' },                                                   // on, to the front door of its home, which stands close behind the passage
  ...houseSteps,                                                                                 // through the flat: hall, living room (the sock, the keys under the sofa), bedroom, bath, kitchen (the stove, and your phone)
  { p: hp(homeKit.tour[4].at(-1)), how: 'wait', len: 3.6, face: Math.PI, mark: 'outHead' },      // it turns to the back door. You come back out of its head, behind it.
  { p: hp(homeKit.exit[0]) },
  { p: hp(homeKit.exit[1]), mark: 'backdoor' },                                                  // out through the back door: up on to the sill, across the stone step
  { p: hp(homeKit.exit[2]), mark: 'street' }]),                                                  // and down: that is the street
  { p: V3(TX, 0, Z.bump), mark: 'bump' },                                                        // straight at the L, without slowing, and into it
  { p: V3(TX + 0.05, 0, Z.talksWord - 1.7), mark: 'strewn' },                                     // on through where it stood
  { p: V3(TX + 0.05, 0, Z.talksWord - 1.7), how: 'wait', len: 2.4, act: 'stumble', mark: 'strewnEnd' },      // he stumbles, shakes his head and looks round at the mess
  { p: V3(TX + 0.1, 0, Z.talksWord - 3.0), mark: 'talk' },
  { p: V3(TX + 0.1, 0, Z.talksWord - 3.0), how: 'wait', len: 8, act: 'talk', face: 0.12, mark: 'talkEnd' },  // it turns to you, among the fallen letters. Ask it something.
  { p: V3(SX + 0.2, 0, Z.details), mark: 'details' },
  { p: V3(SX, 0, PZ + 1.5) },
  { p: V3(SX, PH, PZ), how: 'jump', mark: 'plinth' },
  { p: V3(SX, PH, PZ), how: 'wait', len: 9, act: 'pose', face: 0, mark: 'plinthEnd' },
  { p: V3(SX + 1.7, 0, PZ), how: 'jump', mark: 'family' },
  { p: V3(GATE_X, 0, PZ), mark: 'gate' },
  { p: V3(SX + 15.5, 0, PZ), mark: 'famEnd' },                                                   // past the stage. The evening starts here.
  { p: S0, mark: 'slap0' },
  { p: S1, mark: 'slapEnd' },                                                                    // it walks past LIGHTS and the letters go down behind it: night
  { p: FILMP, mark: 'photo' },                                                                   // a few steps back from the wall, in the dark
  { p: FILMP, how: 'wait', len: WALL_LEN, act: 'present', face: Math.PI - 0.25, mark: 'photoEnd' },    // movie night: its own light finds the wall
  ...onGround(FILMP, [                                                                           // on to the dock: over its deck and on to the pad, and off it again in the morning (see GROUND)
  { p: DOCKP, mark: 'nap' },
  { p: DOCKP, how: 'wait', len: 0.9, face: 0.4 },                                                // it turns round to you first, then hunkers down
  { p: DOCKP, how: 'wait', len: 4.2, act: 'nap', face: 0.4, mark: 'napEnd' },
  { p: DOCKP, how: 'wait', len: 2.6, face: 0.9, mark: 'morning' },                               // morning: the light comes back, it gets to its feet
  { p: DOCK_OUT }]),
  { p: V3(PRICE_X - 6.5, 0, PZ), mark: 'price' },
  { p: V3(PRICE_X, 0, PZ) },
  { p: V3(PRICE_X - 2.0, 0, PZ - 3.02), mark: 'shove' },                                         // right up against the 1
  { p: V3(PRICE_X - 2.0, 0, PZ - 3.02), how: 'wait', len: 2.6, face: Math.PI, mark: 'shoveEnd' },  // he stays there and watches the 2 come down into its place
  { p: V3(PRICE_X + 5.5, 0, EZ), mark: 'edge' },
  { p: V3(EX - 0.22, 0, EZ), mark: 'lip0' },
  { p: V3(EX - 0.22, 0, EZ), how: 'wait', len: 2.6, act: 'teeter', mark: 'lip' },
  { p: LAND, how: 'fall', len: 5.2, act: 'fall', mark: 'land' },                                  // it can't fly. A jump, a front flip, then straight down on to the button, feet first
  { p: LAND, how: 'wait', len: 2, act: 'land', face: 0.15 },
  { p: LAND, how: 'wait', len: 4, act: 'wave', face: 0.15, mark: 'end' },
]);
function buildRoute(pts) {
  const segs = [], marks = {}; let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].p, b = pts[i].p, P = pts[i], how = P.how || 'walk';
    const flat = Math.hypot(b.x - a.x, b.z - a.z);
    const len = P.len ?? (how === 'walk' ? a.distanceTo(b) : how === 'jump' ? Math.max(1.6, flat + Math.abs(b.y - a.y) * 0.5) : 3.2);
    segs.push({ a, b, how, len, start: total, act: P.act, face: P.face, lift: P.lift, timed: P.timed, dir: flat > 0.01 ? V3(b.x - a.x, 0, b.z - a.z).normalize() : null });
    total += len;
    if (P.mark) marks[P.mark] = total;
  }
  for (let i = 0; i < segs.length; i++) if (!segs[i].dir) { let j = i; while (j < segs.length && !segs[j].dir) j++; segs[i].dir = (segs[j] || segs[i - 1]).dir; }
  const out = { pos: V3(), dir: V3(), air: -1, act: { name: null, t: 0 }, face: undefined };
  function at(d) {
    d = clamp(d, 0, total - 1e-4);
    const s = segs.find((g) => d < g.start + g.len) || segs[segs.length - 1];
    const t = (d - s.start) / s.len;
    out.pos.lerpVectors(s.a, s.b, t); out.dir.copy(s.dir); out.air = -1; out.face = s.face; out.how = s.how;
    out.act.name = s.act || null; out.act.t = t;
    out.crouch = 0;
    if (s.how === 'jump' && s.drop) {      // off the end of the E. He crouches at the edge, steps off it, and comes down feet first, faster as he goes. All of it by the scroll, so it plays backwards too
      const k = smooth(t, 0.22, 0.5), f = clamp((t - 0.3) / 0.7, 0, 1); out.pos.x = lerp(s.a.x, s.b.x, k); out.pos.z = lerp(s.a.z, s.b.z, k); out.pos.y = lerp(s.a.y, s.b.y, f * f);
      out.crouch = smooth(t, 0, 0.2) * (1 - smooth(t, 0.3, 0.42)); out.air = t < 0.3 ? -1 : f; out.act.t = f; }
    else if (s.how === 'jump') { const lift = s.lift ?? (0.55 + Math.max(0, s.b.y - s.a.y) * 0.22), c = s.timed ? 0.15 : 0, tt = clamp((t - c) / (1 - c), 0, 1);      // a timed jump starts with a crouch: it gathers itself on the spot, then goes
      out.pos.lerpVectors(s.a, s.b, tt); out.pos.y = lerp(s.a.y, s.b.y, tt) + 4 * lift * tt * (1 - tt); out.air = t < c ? -1 : tt; out.act.t = tt; out.crouch = t < c ? Math.sin(Math.PI / 2 * Math.min(1, t / (c * 0.6))) : 0; }
    if (s.how === 'climb' && s.mantle) {      // on to the G. Hand over hand up its side, then over the edge: the body swings up and in while it is still coming up (it is not standing on anything yet, so nothing slides), it lands in a deep crouch with its knees on the edge, and stands
      out.pos.y = lerp(s.a.y, s.b.y, smooth(t, 0, 0.76)) + Math.sin(Math.PI * smooth(t, 0.6, 0.9)) * 0.12; const k = smooth(t, 0.58, 0.88); out.pos.x = lerp(s.a.x, s.b.x, k); out.pos.z = lerp(s.a.z, s.b.z, k);
      out.crouch = Math.sin(Math.PI * smooth(t, 0.68, 1)) * 0.95; if (t > 0.74) out.act.name = null; out.act.t = t * 0.74; }
    else if (s.how === 'climb') { const e = t * t * (3 - 2 * t); out.pos.y = lerp(s.a.y, s.b.y, Math.min(1, e * 1.25)) + Math.sin(Math.PI * smooth(t, 0.62, 1)) * 0.09; out.pos.x = lerp(s.a.x, s.b.x, smooth(t, 0.56, 1)); out.pos.z = lerp(s.a.z, s.b.z, smooth(t, 0.56, 1)); }      // straight up inside the box first, then a step over the rim
    if (s.how === 'fall') { const j = smooth(t, 0, 0.22), f = clamp((t - 0.13) / 0.87, 0, 1); out.pos.x = lerp(s.a.x, s.b.x, j); out.pos.z = lerp(s.a.z, s.b.z, j); out.pos.y = s.a.y + Math.sin(Math.min(1, t / 0.22) * Math.PI) * 1.3 + (s.b.y - s.a.y) * Math.pow(f, 1.7); }      // out and up, then faster and faster. He is four units out past the edge before he is back down at floor height, so nothing of him goes through the floor. (For an afternoon this was a drop of 0.8 seconds with no jump. It was too fast, the lines were gone, and he cut through the edge.)
    if (s.how === 'float') { const e = smooth(t, 0, 0.45); out.pos.x = lerp(s.a.x, s.b.x, e); out.pos.z = lerp(s.a.z, s.b.z, e); out.pos.y = lerp(s.a.y, s.b.y, t * t * (3 - 2 * t)) + Math.sin(t * 16) * 0.1 * Math.sin(t * Math.PI) + Math.sin(Math.min(1, t * 9) * Math.PI) * 0.5; }
    return out;
  }
  return { at, total, marks, segs };
}
const M = route.marks;
// His steps over GONE. The robot's walk puts a heel down every quarter unit of the distance it is given. On the glass it is given a distance of its own, laid
// out so that a heel comes down exactly on each foothold: a whole number of steps along each stretch of glass, and exactly one step for each long stride.
const GAIT = (() => { const C = 0.25, g0 = Math.ceil((M.onG + 0.105) / C) * C - 0.105, pts = [[M.onG, 0]], strides = []; let g = 0;
  const walk = (a, b) => { g += Math.max(1, Math.round((b - a) / C)) * C; pts.push([b, g]); }, stride = (a, b) => { g += C; pts.push([b, g]); strides.push([a, b]); };
  walk(M.onG, M.offG); stride(M.offG, M.onO); walk(M.onO, M.offO); stride(M.offO, M.onN); walk(M.onN, M.offN); stride(M.offN, M.midN); stride(M.midN, M.onN2); walk(M.onN2, M.offN2); stride(M.offN2, M.onE); walk(M.onE, M.gone);
  const end = pts[pts.length - 1], at = (d) => { if (d <= M.onG) return d + (g0 - M.onG) * smooth(d, M.onG - 2.6, M.onG); if (d >= end[0]) return d + (g0 + end[1] - end[0]) * (1 - smooth(d, M.peer, M.gap));
    let i = 1; while (d > pts[i][0]) i++; const [a, ga] = pts[i - 1], [b, gb] = pts[i]; return g0 + ga + (gb - ga) * (d - a) / (b - a); };
  return { at, strides }; })(), strideAct = { name: 'teeter', t: 0 };
const HEAD_MID = (X0 + headline.right) / 2;
// (the place behind MEET MOSEY, his drawing sheet, is made further down, once the robot it is drawn from exists: see heroBack)
// The home and the glass letters can now be in one picture: GONE and WALKING stand either side of the way to its front door, and TALKS stands outside its back door.
// A glass letter shows what is behind it from a second, smaller picture of the scene, and everything solid is drawn into that picture too, with a second set of shaders.
// For the home that set held a first visit for seconds. So the home's materials are marked as see-through at full strength: they look and sort exactly as before
// (they still write depth, and are drawn first among the see-through things), but the renderer leaves them out of the letters' picture. They are drawn without
// blending, so a graphics card that throws away hidden surfaces by itself (every phone, every Apple chip) still does, and nearest first, for the cards that do not.
home.traverse((o) => { if (!o.isMesh || o === homeKit.scan.cage) return; let any = false;
  for (const m of [].concat(o.material)) if (m && !m.transparent && !(m.transmission > 0)) { m.transparent = true; m.blending = THREE.NoBlending; m.forceSinglePass = true; m.needsUpdate = true; any = true; }
  if (any) o.renderOrder = -10; });
renderer.setTransparentSort((a, b) => a.groupOrder !== b.groupOrder ? a.groupOrder - b.groupOrder : a.renderOrder !== b.renderOrder ? a.renderOrder - b.renderOrder : a.z !== b.z ? (a.renderOrder === -10 ? a.z - b.z : b.z - a.z) : a.id - b.id);
const AWAY = M.talk + 0.6;              // where his home is put away. It is behind the camera from the moment he is out of the back door, but its shadow lies across the street in front of him all the way to TALKS, and a shadow that goes out is seen. So it stays until the street it shades is behind the camera too
boot.marks = M;
// "talk-0.4", "plinth+2", "end", "12": a place on the route
const parseD = (str) => { const m = /^\s*([a-zA-Z]\w*)?\s*([+-]?\s*[\d.]+)?\s*$/.exec(String(str)); return (m[1] ? M[m[1]] : 0) + (m[2] ? parseFloat(m[2].replace(/\s/g, '')) : 0); };

const stops = {
  hero: [0, M.landed], hello: [M.landed, M.helloEnd], headline: [M.helloEnd, M.gap + 1.5], sees: [M.gap + 1.5, M.backdoor + 0.5], talks: [M.backdoor + 0.5, M.talkEnd + 0.4], details: [M.talkEnd + 0.4, M.family], family: [M.family, M.famEnd],      // each stop starts when its word or its thing comes into the picture
  lights: [M.famEnd, M.photo - 1.5], life: [M.photo - 1.5, M.photoEnd + 1.5], charge: [M.photoEnd + 1.5, M.morning + 0.6], price: [M.morning + 0.6, M.edge], edge: [M.edge, route.total],      // the evening: lights out, movie night, the dock. Then morning and the price.
};
// The whole word is solid ground while it is on and around it. Each letter of GONE lights when he lands on it: the hops are timed, so that is the same moment however you scroll.
// WALKING is never walked on. It lights in one run, left to right, as he drops into the gap in front of it.
{ const ON = [M.onG, M.onO, M.onN, M.onE], w0 = headline[4].home.x, w1 = headline[headline.length - 1].home.x;
  headline.forEach((L, i) => { L.win = [M.headline - 2.6, M.door + 4]; L.dOn = i < 4 ? ON[i] - 0.04 : M.peer - 2.2 + 0.9 * (L.home.x - w0) / (w1 - w0); }); }      // WALKING lights in one run as he turns on the E to look at it
lightsW.forEach((L) => { L.dPass = M.slap0 + (L.home.x - S0.x); });

// when each thing pops up
// TALKS does not pop up. It stands outside the back door from the moment he is in the house, in daylight, and you see it through the open door from the stove (see talksOn in the loop).
// The wall and the dock of the evening do not pop up. They stand there as a place (see eveOn in the loop).
pop(plinth, M.talkEnd - 0.5); pop(shelf, M.plinthEnd + 0.3, 0.65);
family.forEach((f, i) => pop(f.r.root, M.plinthEnd + 0.6 + i * 0.4, null, 1.4));
for (const L of price) L.mesh.visible = false;      // the price comes up once the colour's name has gone, so the two never stand side by side

/* ---------- camera: one moment at a time ---------- */
// K: where the camera sits relative to the robot (x right, y up, z toward the viewer) and where it looks.
// P: the same shot framed for a phone held upright, where the generic phone rule isn't good enough.
const K = (d, off, look, fov = 36, fit = false) => ({ d, off, look, fov, fit });
const P = (key, off, look, fov) => { key.m = { off, look, fov, own: true }; return key; };
// Two shots of the title are not typed in as numbers. They are worked out from where the words stand (the GW table), so every layout gets them, and they are worked out
// again when the window changes shape. frameOn finds the camera that holds a set of points inside a box of the picture, looking from a given side and height:
// it starts far too close, looks at how much of the picture the points take, backs off and re-aims, a few dozen times.
const frameOn = (() => { const cam = new THREE.PerspectiveCamera(), dir = V3(), C = V3(), T = V3(), q = V3(), r = V3(), u = V3();
  return (pts, az, el, fov, aspect, [bx0, bx1, by0, by1]) => { cam.fov = fov; cam.aspect = aspect; cam.updateProjectionMatrix();
    dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)); T.set(0, 0, 0); for (const p of pts) T.addScaledVector(p, 1 / pts.length); let D = 30;
    for (let it = 0; it < 60; it++) { cam.position.copy(C.copy(T).addScaledVector(dir, D)); cam.lookAt(T); cam.updateMatrixWorld(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) { q.copy(p).project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      D *= 0.5 + 0.5 * Math.max((x1 - x0) / (bx1 - bx0), (y1 - y0) / (by1 - by0)); const t = Math.tan(fov * Math.PI / 360);
      r.setFromMatrixColumn(cam.matrixWorld, 0); u.setFromMatrixColumn(cam.matrixWorld, 1);
      T.addScaledVector(r, ((x0 + x1) / 2 - (bx0 + bx1) / 2) * t * aspect * D * 0.7).addScaledVector(u, ((y0 + y1) / 2 - (by0 + by1) / 2) * t * D * 0.7); }
    return { C: C.copy(T).addScaledVector(dir, D).clone(), T: T.clone() }; }; })();
const TITLE_KEYS = [P(K(M.helloEnd + 1.4, [0, 0, 0], [0, 0, 0], 46), [0, 0, 0], [0, 0, 0], 60), P(K(M.headline - 0.4, [0, 0, 0], [0, 0, 0], 46), [0, 0, 0], [0, 0, 0], 60),
  P(K(M.peer - 0.9, [0, 0, 0], [0, 0, 0], 46), [0, 0, 0], [0, 0, 0], 60), P(K(M.peer - 0.1, [0, 0, 0], [0, 0, 0], 46), [0, 0, 0], [0, 0, 0], 60)];
const titleShots = () => { const asp = innerWidth / innerHeight, wide = tall() ? 1.6 : Math.max(asp, 1), slim = tall() ? asp : 0.46, DEG = Math.PI / 180;
  const up = (v) => [v.clone(), v.clone().setY(H)], at = (d) => route.at(d).pos.clone(), words = [GONE_AT.a, GONE_AT.b, WALK_AT.a, WALK_AT.b].flatMap(up), mid = (GONE_AT.yaw + WALK_AT.yaw) / 2;
  const put = (key, shot, m) => { const R = at(key.d), o = m ? key.m : key; o.off = shot.C.clone().sub(R).toArray(); o.look = shot.T.clone().sub(R).toArray(); };
  // the whole title: both words and him, from in front of them and a little from his side, so GONE is near and the words run away from you
  const him = [at(M.helloEnd + 1.4), at(M.headline - 0.4)].flatMap((v) => [v, v.clone().setY(1.2)]);
  const estW = frameOn([...words, ...him], mid - 10 * DEG, 5 * DEG, 46, wide, [-0.9, 0.9, -0.42, 0.34]), estS = frameOn([...words, ...him], mid - 8 * DEG, 9 * DEG, 60, slim, [-0.97, 0.97, -0.4, 0.3]);      // a low camera: the title stands in the middle of the picture with sky over it, and the floor is the strip under it
  for (const k of TITLE_KEYS.slice(0, 2)) { put(k, estW, false); put(k, estS, true); }
  // WALKING from the E: the whole word, the E and him on it at the left
  const E = headline[3], onE = at(M.peer - 0.5), pts = [...[WALK_AT.a, WALK_AT.b].flatMap(up), E.home.clone().addScaledVector(E.ax, -E.half.x).setY(0), onE.clone().setY(onE.y + 1.25)];
  const wW = frameOn(pts, WALK_AT.yaw - 8 * DEG, 8 * DEG, 46, wide, [-0.84, 0.86, -0.55, 0.5]), wS = frameOn(pts, WALK_AT.yaw - 16 * DEG, 12 * DEG, 60, slim, [-0.9, 0.92, -0.5, 0.45]);
  for (const k of TITLE_KEYS.slice(2)) { put(k, wW, false); put(k, wS, true); } };
// The strike is held in one picture, framed the same way: wide and low, from behind him and a little to his right, with him and all five letters in it, where
// they stand and where they come to rest (the corners of that patch of floor are the points). On a phone the same patch is seen from his side and higher, the
// only way a word this wide and a phone go together. These two keys carry a shot: a place in the world. Between them the camera does not move at all (see camAt).
const STRIKE_SHOT = { w: null, m: null }, STRIKE_KEYS = [M.bump - 1.7, M.strewnEnd - 0.6].map((d) => { const k = P(K(d, [0, 0, 0], [0, 0, 0], 46), [0, 0, 0], [0, 0, 0], 60); k.shot = () => (tall() ? STRIKE_SHOT.m : STRIKE_SHOT.w); return k; });
const strikeShots = () => { const asp = innerWidth / innerHeight, wide = tall() ? 1.6 : Math.max(asp, 1), slim = tall() ? asp : 0.46, DEG = Math.PI / 180, zw = Z.talksWord, wall = hp(homeKit.exit[1]).z - 1.2;
  const pts = [[-6.2, 0.6, 2.5], [6.6, 0.6, 2.5], [-6.1, -3.4, 1.2], [6.6, -2.9, 1.2], [3.7, -6.1, 1.2], [0, Z.bump + 1.7 - zw, 1.3]].flatMap(([x, z, h]) => [V3(TX + x, 0, zw + z), V3(TX + x, h, zw + z)]);
  let sW, fW; for (const [fv, az] of [[46, 9], [54, 9], [62, 9], [62, 22], [62, 34], [62, 46], [62, 58]]) { sW = frameOn(pts, az * DEG, 6 * DEG, fW = fv, wide, [-0.92, 0.92, -0.7, 0.36]); if (sW.C.z < wall) break; }      // his home stands behind him here. The camera stays outside its back wall: a wider lens first, and round to his side when the window is too narrow even for that
  const sS = frameOn(pts, 66 * DEG, 20 * DEG, 60, slim, [-0.92, 0.92, -0.5, 0.4]); STRIKE_SHOT.w = sW; STRIKE_SHOT.m = sS;
  for (const k of STRIKE_KEYS) { const R = route.at(k.d).pos; k.fov = fW; k.off = sW.C.clone().sub(R).toArray(); k.look = sW.T.clone().sub(R).toArray(); k.m.off = sS.C.clone().sub(R).toArray(); k.m.look = sS.T.clone().sub(R).toArray(); } };
// The price gag is held the same way, in one shot that stands still: the whole word from the $ to the 9, the tag over it, the air the 2 falls through, and him.
// It is framed for the window, so nothing is cut off at any width, and it holds from the knock until he has set off again, wherever in that beat the scroll stops.
const PRICE_SHOT = { w: null, m: null }, PRICE_KEYS = [M.shove - 2.2, M.shoveEnd + 2.2].map((d) => { const k = P(K(d, [0, 0, 0], [0, 0, 0], 40), [0, 0, 0], [0, 0, 0], 60); k.shot = () => (tall() ? PRICE_SHOT.m : PRICE_SHOT.w); return k; });
const priceShots = () => { const asp = innerWidth / innerHeight, wide = tall() ? 1.6 : Math.max(asp, 1), slim = tall() ? asp : 0.46, DEG = Math.PI / 180, z = price[0].home.z, top = price[0].home.y + price[0].half.y;
  const pts = [V3(price[0].x0 - 0.4, 0, z), V3(price[3].x1 + 0.4, 0, z), V3(price[0].x0 - 0.4, top + 2.0, z), V3(price[3].x1 + 0.4, top + 2.0, z), V3(price[1].home.x, top + 5.2, z), V3(price[1].home.x, 0, z + 1.6)];
  PRICE_SHOT.w = frameOn(pts, 3 * DEG, 0, 40, wide, [-1.17 + 2 * Math.min(0.42, 345 / innerWidth), 0.7, -0.62, 0.92]); PRICE_SHOT.m = frameOn(pts, 3 * DEG, 2 * DEG, 60, slim, [-0.9, 0.9, -0.56, 0.34]);
  // (the card stands at the left for the first half of the beat, and while it does the page moves the whole picture a tenth to the right. The box allows for both: the $ clear of the card, the 9 inside the right edge)
  for (const k of PRICE_KEYS) { const R = route.at(k.d).pos, w = PRICE_SHOT.w, m = PRICE_SHOT.m; k.off = w.C.clone().sub(R).toArray(); k.look = w.T.clone().sub(R).toArray(); k.m.off = m.C.clone().sub(R).toArray(); k.m.look = m.T.clone().sub(R).toArray(); } };
for (const k of [...TITLE_KEYS, ...STRIKE_KEYS, ...PRICE_KEYS]) k.still = true;      // these two pictures are framed to the edge, so the camera does not lean in when the page is left alone, nor back off at speed
titleShots(); strikeShots(); priceShots();
const camKeys = [
  P(K(0,                [0.05, 1.88, 7.3],  [0.05, 1.84, 0], 34),    [0.05, 2.34, 10.4], [0.05, 2.3, 0], 50),     // just the name, floating, with room under it for the PRESS button
  P(K(DROP_D + 0.1,     [0.05, 1.88, 7.3],  [0.05, 1.84, 0], 34),    [0.05, 2.34, 10.4], [0.05, 2.3, 0], 50),
  K(DROP_D + 0.75,      [0.3, 0.95, 6.0],   [0, 0.22, 0], 34),          // the box lands: down to the floor with it
  K(M.peeked - 0.6,     [0.9, 0.8, 4.7],    [-0.5, 0.85, 0], 34),       // closer as the lid lifts
  K(M.rim - 0.4,        [2.1, 0.5, 3.9],    [-0.2, 0.5, 0], 36),
  K(M.rim + 1.0,        [3.0, 0.2, 3.4],    [0.1, 0.3, 0], 36),         // low, under it, as it teeters on the rim
  K(M.rim + 3.2,        [0.7, 0.1, 5.6],    [0.6, -0.15, 0], 38),       // side on and wide for the jump: the box behind, the floor ahead
  K(M.out + 0.3,        [1.3, 0.35, 3.6],   [0.1, 0.4, 0], 36),         // down at floor height for the landing
  K(M.landed - 2.4,     [1.0, 0.6, 3.2],    [0.2, 0.55, 0], 36),
  P(K(M.landed - 1.3,   [0.95, 0.74, 3.5],  [0.66, 0.74, 0], 36),    [0.2, 0.9, 3.6],   [0.05, 0.98, 0], 50),     // the hello: it stands to the left, with room beside its head for what it says
  P(K(M.helloEnd - 0.9, [0.95, 0.74, 3.5],  [0.66, 0.74, 0], 36),    [0.2, 0.9, 3.6],   [0.05, 0.98, 0], 50),     // held for "Hi, I'm Mosey.", with room beside it for what it says
  // The title. The moment you scroll past the wave the camera leaves the close shot and in one move opens on the whole title: GONE near and to the left, WALKING
  // further back and to the right, both on screen, with him small at the left setting off for the G. It holds there while he walks the three units to the G.
  // Then three quarters and from above as he hops along GONE, so the letters are blocks. From the end of the E, one shot from in front of WALKING: the whole word,
  // with him on the E at the left looking across at it. Down into the passage behind him, and behind and a little above him all the way to his front door.
  ...TITLE_KEYS.slice(0, 2),      // the whole title, and the same picture held while he walks to the G (see titleShots)
  P(K(M.onG + 0.6,      [5.0, 2.0, 9.0],    [1.6, -0.5, -1.5], 44),  [2.6, 2.6, 12.5],  [0.8, -0.8, -1.5], 58),   // up on the G, from the front and above: GONE as four blocks, WALKING behind them
  P(K(M.gone - 0.3,     [3.4, 1.6, 6.4],    [0.4, -0.4, -1.0], 42),  [1.6, 2.0, 8.5],   [0.2, -0.6, -1.0], 56),   // closer as he reaches the E
  ...TITLE_KEYS.slice(2),         // out in front of the other word: WALKING, whole, with him on the E at the left looking across at it. Held
  P(K(M.gap + 0.3,      [0.4, 2.6, 7.0],    [0, 4.2, -6], 60),       [0.2, 3.0, 8.0],   [0, 5.0, -6], 64),        // down with him into the passage and round behind him, low and wide: the two letters either side, and the open page ahead where his home is about to be
  P(K(M.scan + 0.2,     [0.4, 2.6, 7.0],    [0, 4.2, -6], 60),       [0.2, 3.0, 8.0],   [0, 5.0, -6], 64),        // behind him and a little above: his back and his head in the lower third, his home coming out of the pulse ahead and above
  P(K(M.inGap + 1.5,    [0.1, 2.6, 7.0],    [0, 4.2, -6], 60),       [0.1, 3.0, 8.0],   [0, 5.0, -6], 64),        // the same all the way down the passage, then closing up on him as he gets to the door
  P(K(M.door - 2.6,     [0.3, 1.1, 2.3],    [0, 0.9, -3.0], 44),     [0.2, 1.3, 2.5],   [0, 1.0, -2.5], 60),      // behind its head at the door. From here the camera glides over its head into its view (HEAD_PATH)
  P(K(M.outHead - 0.1,  [0.3, 1.1, 2.3],    [0, 0.9, -3.0], 44),     [0.25, 1.4, 2.8],  [0, 1.0, -2.5], 60),      // out of its view again at the stove, behind it: the back door is straight ahead, and through it the next word, TALKS, in daylight
  P(K(M.backdoor + 2.9, [0.35, 1.15, 2.4],  [0, 0.9, -3.0], 44),     [0.25, 1.4, 2.8],  [0, 1.0, -2.5], 60),      // behind it across the kitchen and out of the door, straight at the word
  P(K(M.bump - 3.4,     [0.6, 1.6, 5.6],    [0, 1.1, -4], 46), [0.5, 2.0, 6.4], [0, 1.2, -4], 62),       // no look back. The camera stays behind him as he walks out: TALKS straight ahead, whole
  ...STRIKE_KEYS,             // wide and low, from behind him to his right: the whole word ahead of him with air on both sides. The strike happens in this picture, and it is held until every letter lies still (see strikeShots)
  K(M.talk - 0.2,       [0.35, 0.95, 4.2],  [0.75, 1.0, 0], 40),        // it turns to you, with room for what it says
  K(M.talkEnd - 0.3,    [0.35, 0.95, 4.2],  [0.75, 1.0, 0], 40),      // (the camera stands where the word stood. The A lies to his left, the K to his right and the L behind him)
  K(M.details - 0.3,    [0.3, 1.3, 4.6],    [-0.2, 0.8, -3.5], 42),
  K(M.plinth + 0.2,     [-0.85, 1.1, 4.3],  [0.4, 0.47, 0], 34),        // the specs stop is one held picture now: he is turned by the plinth, so the camera need not go round him, and the tags can stand still
  K(M.plinthEnd - 0.2,  [-0.85, 1.1, 4.3],  [0.4, 0.47, 0], 34),
  K(M.gate - 1.6,       [4.6, 1.3, 4.6],    [0.3, 1.05, 0], 36),        // three quarters from the front, close: the gate's light comes down over it and you see the colour arrive
  K(M.gate + 0.9,       [3.9, 1.3, 4.9],    [0.5, 1.0, -0.2], 36),
  P(K(M.gate + 2.4,     [3.0, 2.5, 6.9],    [3.0, 1.7, -2.0], 40),   [2.6, 3.0, 12.4],  [2.6, 1.55, -2.0], 60),     // close on the stage: the two sizes, and the colour's name just over their heads
  P(K(M.gate + 4.8,     [0.6, 2.5, 6.9],    [0.6, 1.7, -2.0], 40),   [0.2, 3.0, 12.4],  [0.2, 1.55, -2.0], 60),
  P(K(M.famEnd - 2.5,   [-2.15, 2.3, 9.6],  [-2.15, 2.2, -2.0], 40), [-2.5, 3.0, 19.0], [-2.5, 1.4, -2.0], 60),    // the camera stays where it is while the colours card is up, so the word never slides out of the picture
  // The evening is one set, along one wall: LIGHTS stands in front of its near end, the picture is further along, the dock at its far end. The camera never leaves the wall.
  P(K(M.slap0 - 0.1,    [3.6, 1.5, 9.6],    [3.4, 0.7, -1.2], 40, true), [3.7, 2.6, 22.0], [3.7, 0.2, -1.2], 60), // past the stage, and there is the whole word, lit, on its wall: LIGHTS
  K(M.slap0 + 2.6,      [3.0, 1.3, 8.8],    [2.3, 0.7, -1.0], 40),      // ahead of it, looking back along the word as the letters go down
  K(M.slapEnd - 0.2,    [1.2, 1.5, 6.4],    [-2.2, 0.5, -1.0], 40),
  P(K(M.photo - 0.6,    [3.9, 1.35, 4.6],   [0.5, 1.6, -4.4], 44),   [0.45, 1.7, 7.5],  [0.6, 2.9, -5.6], 60),     // it steps back from the wall and turns to it, the fallen letters at the wall's foot. Behind its shoulder: its own light finds the wall. On a phone: straight on at the middle of the picture, from far enough back that all of it fits, also once the camera has leaned in (it stood left of the middle before, and the right eighth of the picture was off the screen)
  P(K(M.photo + WALL_LEN / 2, [3.4, 1.35, 5.0],   [0.5, 1.6, -4.6], 44),   [0.6, 1.7, 7.7],  [0.6, 2.9, -5.6], 60),
  P(K(M.photoEnd - 0.3, [3.0, 1.35, 4.8],   [0.5, 1.6, -4.6], 44),   [0.75, 1.7, 7.5],  [0.6, 2.9, -5.6], 60),
  K(M.nap - 2.0,        [-2.6, 1.0, 3.4],   [1.6, 0.7, -1.6], 42),      // along the wall to the dock at its end, in the dark
  K(M.nap + 1.2,        [-2.3, 1.1, 4.3],   [0.1, 0.5, -0.4], 38),      // him on the dock, the display beside him, the cable and the socket on the wall behind: one picture
  K(M.napEnd - 0.8,     [-2.0, 1.1, 4.2],   [0.15, 0.5, -0.4], 38),
  K(M.morning - 0.2,    [-0.6, 1.1, 3.9],   [0.2, 0.6, -0.4], 38),      // morning: a little back and up as the light returns and it stands
  P(K(M.morning + 3.4,  [5.6, 1.4, 3.2],    [-1.6, 0.6, -0.4], 42),  [5.4, 1.6, 1.6],   [-1.0, 0.7, -0.2], 56),     // off again: from ahead, looking back at it and at the dock and the wall it leaves
  P(K(M.price - 1.0,    [3.4, 1.5, 7.4],    [2.0, 1.2, -2.2], 42),   [1.2, 1.7, 7.0],   [0.6, 1.2, -1.5], 56),      // round the second corner, still near it, as the price comes up ahead
  P(K(M.price + 1.6,    [6.8, 2.0, 12.4],   [5.1, 1.8, -3.7], 40, true), [5.0, 3.2, 31.0], [5.0, 0.2, -3.7], 60), // the whole price, with room on the left for the card
  ...PRICE_KEYS,              // low and wide, the whole word across the picture with air over it: the 2 is seen all the way down. Held: $249, the tag, him beside it. Then on to the edge (see priceShots)
  K(M.edge + 1,         [-2.4, 1.2, 4.2],   [1.6, 0.5, 0], 38),
  K(M.lip0 - 1.6,       [4.6, 0.7, 6.4],    [0.6, -1.1, 0], 44),
  K(M.lip + 0.5,        [2.6, 0.9, 5.4],    [-0.2, 0.5, 0], 42),       // side on for the jump and the flip
  K(M.lip + 2.8,        [-0.4, 0.5, 5.0],   [1.9, 0.4, 0], 40),         // falling beside it: the robot on the left, open blue on the right for the words, the floor out of the picture
  K(M.land - 2.6,       [-0.4, 0.8, 5.4],   [1.9, 0.2, 0], 40),
];
const camOff = V3(), camLook = V3(), _a = V3(), _b = V3();
const C_FLASH = new THREE.Color('#fff4d0');
let camStill = 0; const camHold = { k: 0, C: V3(), T: V3() };
function camAt(d) {
  let i = 0; while (i < camKeys.length - 2 && d > camKeys[i + 1].d) i++;
  const A0 = camKeys[i], B0 = camKeys[i + 1], t = smooth(d, A0.d, B0.d), mob = tall(); camStill = lerp(A0.still ? 1 : 0, B0.still ? 1 : 0, t);
  // A key can carry a shot: a camera that stands in one place in the world. Between two of them the camera is that shot and nothing else. Into one and out of one it
  // travels in a straight line (no swing round him, which near a wall goes through the wall): his side of the move is the other key's picture, followed as always.
  const sa = A0.shot, sb = B0.shot, A1 = sa && !sb ? B0 : A0, B1 = sb && !sa ? A0 : B0; camHold.k = 0;
  if (sa || sb) { const w = (sb || sa)(); camHold.C.copy(w.C); camHold.T.copy(w.T); camHold.k = sa && sb ? 1 : sb ? t : 1 - t; }
  const A = mob && A1.m ? A1.m : A1, B = mob && B1.m ? B1.m : B1, Af = mob && A0.m ? A0.m : A0, Bf = mob && B0.m ? B0.m : B0;
  const ra = Math.hypot(A.off[0], A.off[2]), rb = Math.hypot(B.off[0], B.off[2]);
  const ta = Math.atan2(A.off[0], A.off[2]); let dt = Math.atan2(B.off[0], B.off[2]) - ta; dt = Math.atan2(Math.sin(dt), Math.cos(dt));
  let r = lerp(ra, rb, t), th = ta + dt * t, y = lerp(A.off[1], B.off[1], t), fov = lerp(Af.fov, Bf.fov, t);
  camLook.lerpVectors(_a.fromArray(A.look), _b.fromArray(B.look), t);
  const fit = clamp(1.6 / camera.aspect, 1, 1.5); if (!mob) r *= lerp(A.fit ? fit : 1, B.fit ? fit : 1, t);     // on a narrower window, back off until the word fits
  if (mob) { const g = lerp(Af.own ? 0 : 1, Bf.own ? 0 : 1, t);                                                     // the generic phone rule, faded out toward keys that bring their own framing
    r *= lerp(A.own ? 1 : A.fit ? 1.7 : 1.42, B.own ? 1 : B.fit ? 1.7 : 1.42, t); y += 0.25 * g; fov = Math.min(64, fov + 15 * g); camLook.x *= lerp(A.own ? 1 : A.fit ? 1 : 0.3, B.own ? 1 : B.fit ? 1 : 0.3, t); }
  camOff.set(Math.sin(th) * r, y, Math.cos(th) * r);
  return fov;
}

/* ---------- the robot ---------- */
const robot = createRobot();
// The place behind MEET MOSEY: his drawing sheet (js/hero-options.js). The two views on it are made from this robot's own model. ?hero=plain is the empty hero of before.
const heroBack = new URLSearchParams(location.search).get('hero') === 'plain' ? null : (await import('./hero-options.js?v=1117-230645')).createHeroBackdrop({ THREE, scene, camera, renderer, BX, heroType, tall, coarse, DROP_D, MONO, robot, reduceMotion,
  // the camera as it comes to rest at the top of the page: left alone it closes in by a tenth over its first second (S.close), and the sheet is laid out for that picture
  restCam: () => { const c = camera.clone(); c.position.copy(anchor).addScaledVector(camera.position.clone().sub(anchor), 0.9 / (1 - 0.1 * (S.close || 0))); c.lookAt(look); c.updateMatrixWorld(); return c; } });
scene.add(robot.root); robot.root.rotation.order = 'YXZ';      // turned first, then leaned: the lean (on the glass of GONE) is forward and back in his own frame
const paintMain = scanPaint.add(robot);      // its shell can be repainted as a scan (see scanPaint)
// It brings its own light, and a soft cool one behind it so its back never goes black at night.
// Both live in the scene, not on the robot: hiding the robot (when you are inside its head) must not change how many lights there are,
// or every surface in view has to be rebuilt for the new count and the page stalls for seconds.
const lamp = new THREE.PointLight('#ffe2a0', 0, 7, 1.5), fillLamp = new THREE.PointLight(0xcfd8ff, 0, 5, 1.6); scene.add(lamp, fillLamp);
const robotBody = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
world.createCollider(RAPIER.ColliderDesc.capsule(0.28, 0.27).setFriction(0.2), robotBody);
const hit = new THREE.Mesh(new THREE.SphereGeometry(0.62), new THREE.MeshBasicMaterial({ visible: false }));
hit.position.y = 0.6; robot.root.add(hit);
let userWay = null, gateWay = 'classic', way = 'classic';
const EVENING_COLOUR = new URLSearchParams(location.search).get('evening') === 'colour';      // ?evening=colour: as it was, he stays the first colour (tomato red) from the gate to the end
const PAINTS = Object.keys(WAYS).filter((k) => k !== 'classic');      // the colours this robot comes in besides the finish it leaves the box in (tomato, mint, sunny for the machined one)
function showWay(key, scan = false) {      // scan: run a line of light over it as the colour changes (when you pick one on the card)
  way = key; if (scan && paintMain) scanPaint.to(paintMain, key); else robot.setWay(key);
  document.getElementById('wayname').textContent = WAYS[key].name;
  document.querySelectorAll('.swatches button').forEach((b) => b.classList.toggle('is-on', b.dataset.way === key));
}
document.querySelectorAll('.swatches button').forEach((b, i) => { const key = Object.keys(WAYS)[i]; b.dataset.way = key; b.style.setProperty('--c', '#' + new THREE.Color(WAYS[key].body).getHexString()); b.setAttribute('aria-label', WAYS[key].name); });      // the swatches follow whichever robot is loaded
document.getElementById('wayname').textContent = WAYS.classic.name;
document.querySelectorAll('.swatches button').forEach((b) => b.addEventListener('click', () => {
  userWay = b.dataset.way; showWay(userWay, true); robot.hop(2.2);
  family.forEach((f, i) => setTimeout(() => f.r.hop(f.key === userWay ? 4.6 : 2.6), 80 + i * 90));
}));
const thumbs = [...document.querySelectorAll('.thumbs:not(.asks) button')], asks = [...document.querySelectorAll('.asks button')];
asks.forEach((b) => b.addEventListener('click', () => { S.qPick = +b.dataset.q; S.qPickT = S.time; robot.hop(2.4); }));
thumbs.forEach((b) => b.addEventListener('click', () => { S.pick = +b.dataset.slot; S.pickT = S.time; robot.hop(2.6); }));
const toast = document.getElementById('toast'); let toastT = 0;
const say = (text) => { toast.textContent = text; toast.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('is-on'), 2600); };

// The walk through its home, seen through its eye. One curve through every point of the tour (js/home-rooms.js). Its body walks the same points in straight lines,
// the camera in its head takes the corners round. Where on the curve it is comes from how far it has walked since the front door (houseKnots), so a stop on the route
// is a stop of the eye, and the whole walk scrubs both ways with the scroll.
const scanTour = (() => {
  const pts = [homeKit.tour[0][0], ...homeKit.tour.flatMap((room) => room.slice(1))].map((q) => hw(q[0], 0.8, q[1])), N = pts.length - 1, DIV = 40;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); curve.arcLengthDivisions = N * DIV;
  const lens = curve.getLengths(), total = lens[N * DIV], frac = pts.map((_, k) => lens[k * DIV] / total);      // how far along the whole curve each point of the tour is
  const rooms = homeKit.scan.rooms, far = rooms.map((r) => Math.max(...[[r.x0, r.z0], [r.x0, r.z1], [r.x1, r.z0], [r.x1, r.z1]].map(([x, z]) => Math.hypot(x - r.entry[0], z - r.entry[1]))));      // how far the light has to run to fill each room
  const marks = [M.door, M.rm1, M.rm2, M.rm3, M.rm4, M.stove], _t = V3();      // where on the route each room begins: its doorway
  const doneAt = M.rm4 + (M.stove - M.rm4) * 0.9;      // the last room is lit: the map is saved
  // how far along the curve (0 to 1) it is at this place on the route
  const uAt = (d) => { const x = d - M.door; if (x <= 0) return 0; let i = 0; while (i < houseKnots.length - 2 && x > houseKnots[i + 1][0]) i++;
    const [d0, k0] = houseKnots[i], [d1, k1] = houseKnots[i + 1]; return k1 === k0 ? frac[k0] : lerp(frac[k0], frac[k1], clamp((x - d0) / (d1 - d0), 0, 1)); };
  // d: where on the route. Gives the room it is in, how far through it (0 to 1), and where on the curve.
  const at = (d) => { let i = 0; while (i < 4 && d > marks[i + 1]) i++; return { i, e: clamp((d - marks[i]) / (marks[i + 1] - marks[i]), 0, 1), u: uAt(d) }; };
  // How far the light has run in each room, from its doorway. It is already on its way in a room while it walks up to the door, so a doorway never shows an empty room,
  // it keeps running LEAD ahead as it crosses the room, and it has reached the last corner before it leaves. The hall starts while it is still outside:
  // through the open front door you see the hall, lit, before it is in.
  const reach = [0, 0, 0, 0, 0], LEADS = [15, 10, 10, 12, 14], EARLY = [9, 6, 9, 6, 8];
  const reachOf = (i, d) => { const len = marks[i + 1] - marks[i]; if (d >= marks[i] + len * 0.9) return 1e5;
    const LEAD = LEADS[i]; if (d < marks[i]) { const t = clamp((d - (marks[i] - EARLY[i])) / EARLY[i], 0, 1); return LEAD * (1 - (1 - t) * (1 - t)); }
    const e = (d - marks[i]) / len; curve.getPointAt(uAt(d), _t);
    return Math.max(LEAD + Math.hypot(_t.x - HX - rooms[i].entry[0], _t.z - HZ - rooms[i].entry[1]), far[i] * smooth(e, 0.5, 0.9)) + 0.4; };
  const light = (d) => { for (let i = 0; i < 4; i++) reach[i] = reachOf(i, d); reach[4] = reach[1]; return reach; };      // the kitchen is the far end of the living room's own space: one light for both, from the living room's doorway. So the grey of what is not mapped yet is only ever at the far edge of where he looks
  const when = (i, dist) => { for (let d = marks[i] - EARLY[i]; d < marks[i + 1]; d += 0.1) if (reachOf(i, d) >= dist + 0.8) return d; return marks[i + 1]; };      // where on the route the light gets this far from room i's doorway
  // Where its eye is, and a point a few steps on along its way. Before the front door its eye is on the straight line up to the door.
  const eye = (d, pos, aim) => { const u = uAt(d), lead = 5.5 / total; curve.getPointAt(u, pos); curve.getTangentAt(u, _t); pos.addScaledVector(_t, 0.36 + Math.min(0, d - M.door));
    curve.getPointAt(Math.min(1, u + lead), aim); if (u + lead > 1) { curve.getTangentAt(1, _t); aim.addScaledVector(_t, (u + lead - 1) * total); } };
  return { curve, total, at, light, when, eye, rooms, reach, doneAt };
})();
// What it will remember: a pin drops in a room once the light has passed its spot, and lands on a spring.
const scanPins = homeKit.pins.map((q) => {
  const g = new THREE.Group(); g.position.copy(hw(q.p[0], 0, q.p[1])); g.visible = false; scene.add(g);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, q.h, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false })); stick.position.y = q.h / 2; g.add(stick);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshBasicMaterial({ color: PAL.accent, fog: false, toneMapped: false })); head.position.y = q.h + 0.12; g.add(head);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: PAL.accent, transparent: true, opacity: 0.9, depthWrite: false, fog: false })); ring.position.y = 0.03; g.add(ring);
  const el = document.createElement('div'); el.className = 'mpin spin'; el.innerHTML = `<p>${q.name}</p>`; document.getElementById('mappins').appendChild(el);
  return { ...q, g, ring, el, top: hw(q.p[0], q.h + 0.5, q.p[1]), far: Math.hypot(q.p[0] - scanTour.rooms[q.room].entry[0], q.p[1] - scanTour.rooms[q.room].entry[1]), on: false };
});
// The small map in the corner of its view: the five rooms as they really lie (the front door at the bottom), each filling with its colour from its doorway
// as its light runs, and a dot for where it is.
const miniMap = (() => {
  const box = document.createElement('div'); box.className = 'minimap'; box.innerHTML = '<canvas width="400" height="440"></canvas><span></span>'; hud.appendChild(box);
  const cv = box.firstChild, k = cv.getContext('2d'), cap = box.lastChild, W = 400, Hh = 440, pad = 12, rooms = homeKit.scan.rooms;
  const x0 = Math.min(...rooms.map((r) => r.x0)), x1 = Math.max(...rooms.map((r) => r.x1)), z0 = Math.min(...rooms.map((r) => r.z0)), z1 = Math.max(...rooms.map((r) => r.z1));
  const sc = Math.min((W - pad * 2) / (x1 - x0), (Hh - pad * 2) / (z1 - z0)), X = (x) => (W - (x1 - x0) * sc) / 2 + (x - x0) * sc, Y = (z) => (Hh - (z1 - z0) * sc) / 2 + (z - z0) * sc;
  const FILL = ['#cfc8ba', '#d1a877', '#b9c9d6', '#d6e4ea', '#ebe6d8']; let last = '';
  return (room, reach, done, px, pz) => {
    const dx = clamp(X(px), pad + 9, W - pad - 9), dy = clamp(Y(pz), pad + 9, Hh - pad - 9);
    const key = `${room} ${reach.map((r) => Math.min(60, Math.round(r * 2))).join(',')} ${done} ${Math.round(dx / 2)} ${Math.round(dy / 2)}`; if (key === last) return; last = key;
    k.clearRect(0, 0, W, Hh); k.fillStyle = 'rgba(7,7,11,0.82)'; k.beginPath(); k.roundRect(0, 0, W, Hh, 18); k.fill();
    rooms.forEach((r, i) => { const rx = X(r.x0), ry = Y(r.z0), rw = (r.x1 - r.x0) * sc, rh = (r.z1 - r.z0) * sc, full = done || reach[i] > 200;
      if (reach[i] > 0.5) { k.save(); k.beginPath(); k.rect(rx, ry, rw, rh); k.clip(); k.fillStyle = FILL[i];
        if (full) k.fillRect(rx, ry, rw, rh); else { k.beginPath(); k.arc(X(r.entry[0]), Y(r.entry[1]), reach[i] * sc, 0, 7); k.fill(); k.strokeStyle = '#fff3c4'; k.lineWidth = 5; k.stroke(); }      // the edge of the light, as in the room
        k.restore(); }
      k.setLineDash(full ? [] : [6, 7]); k.strokeStyle = full ? '#fbf8f3' : 'rgba(251,248,243,0.4)'; k.lineWidth = 3; k.strokeRect(rx, ry, rw, rh); k.setLineDash([]); });
    k.fillStyle = '#15151a'; k.beginPath(); k.arc(dx, dy, 13, 0, 7); k.fill(); k.fillStyle = PAL.accent; k.beginPath(); k.arc(dx, dy, 9, 0, 7); k.fill();
    cap.textContent = done ? 'Map saved · 5 rooms' : `Room ${room + 1} of 5`;
  };
})();

/* ---------- scroll: the page is the track ---------- */
const sections = [...document.querySelectorAll('section[data-stop]')];
const copies = [...document.querySelectorAll('.copy')].map((el) => ({ el, d0: parseD(el.dataset.d0), d1: parseD(el.dataset.d1), side: el.dataset.side || 'left' }));
const calloutLay = (() => { const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:visible';
  const lines = [], dots = []; for (let i = 0; i < 6; i++) { const l = document.createElementNS(NS, 'polyline'); l.setAttribute('fill', 'none'); l.setAttribute('stroke', '#15151a'); l.setAttribute('stroke-width', '1.5'); l.setAttribute('stroke-linejoin', 'round'); l.style.opacity = '0'; svg.appendChild(l); lines.push(l);
    const d = document.createElementNS(NS, 'circle'); d.setAttribute('r', '4.5'); d.setAttribute('fill', '#15151a'); d.setAttribute('stroke', 'rgba(21,21,26,0.16)'); d.setAttribute('stroke-width', '7'); d.style.opacity = '0'; svg.appendChild(d); dots.push(d); }
  const measure = document.createElementNS(NS, 'path'); measure.setAttribute('fill', 'none'); measure.setAttribute('stroke', '#15151a'); measure.setAttribute('stroke-width', '1.5'); measure.style.opacity = '0'; measure.style.transition = 'opacity 0.35s ease'; svg.appendChild(measure);
  // How far he reaches from the line he turns about, arms and all, in his own measure: the furthest point of his skin from that line, as he stands now. A circle of
  // that radius is everything he can cover on screen in a whole turn, so tags that stand outside it are never touched at any angle.
  const inv = new THREE.Matrix4(), q = V3(), reach = () => { let R = 0; robot.root.updateMatrixWorld(true); inv.copy(robot.root.matrixWorld).invert();
    robot.root.traverse((o) => { if (!o.isSkinnedMesh || !o.visible || !o.geometry?.attributes?.position) return; /* his skin only: not his shadow, his glow or the invisible ball that takes the pointer */ const pos = o.geometry.attributes.position, step = Math.max(1, Math.floor(pos.count / 2500));
      for (let i = 0; i < pos.count; i += step) { o.getVertexPosition(i, q); q.applyMatrix4(o.matrixWorld); R = Math.max(R, Math.hypot(q.x - robot.root.position.x, q.z - robot.root.position.z)); } }); return R; };      // measured in the world, since that is where it is projected from
  document.body.appendChild(svg); addEventListener('resize', () => { calloutLay.key = ''; }); return { key: '', lines, dots, measure, reach, R: 0, mT: -9 }; })();
const callouts = [...document.querySelectorAll('.callout:not(.pricetag)')].map((el, i) => ({ el, i, d0: parseD(el.dataset.d0), d1: parseD(el.dataset.d1), part: el.dataset.part || '', a: (el.dataset.anchor || '0,0,0').split(',').map(Number), p: V3(), sx: 0, sy: 0 }));
let track = [];
const RATE = { headline: 0.8 };          // how much scroll a stretch takes, next to the others. The headline walk felt long, so it goes by a little quicker.
function layout() {
  const px = tall() ? 84 : 104;
  sections.forEach((s) => { const [a, b] = stops[s.dataset.stop]; s.style.height = Math.max(innerHeight * 0.9, (b - a) * px * (RATE[s.dataset.stop] || 1)) + 'px'; });
  const maxY = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const sum = sections.reduce((n, s) => n + s.offsetHeight, 0);
  let y = 0;
  track = sections.map((s, i) => { const h = s.offsetHeight * maxY / sum, r = { s, i, y0: y, y1: y + h, d: stops[s.dataset.stop] }; y += h; return r; });
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  placeHero();
}
function readScroll() {
  const y = clamp(scrollY, 0, track[track.length - 1].y1);
  const r = track.find((k) => y <= k.y1) || track[track.length - 1];
  const t = clamp((y - r.y0) / (r.y1 - r.y0), 0, 1);
  return { d: lerp(r.d[0], r.d[1], t), r, t };
}
function scrollForD(d) { const r = track.find((k) => d <= k.d[1]) || track[track.length - 1]; return lerp(r.y0, r.y1, clamp((d - r.d[0]) / (r.d[1] - r.d[0]), 0, 1)); }
let lastW = innerWidth;
addEventListener('resize', () => { if (coarse && innerWidth === lastW) return; lastW = innerWidth; titleShots(); strikeShots(); priceShots(); const d = S.exact; layout(); scrollTo(0, scrollForD(d)); });
document.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault(); S.navT = S.time; scrollTo({ top: scrollForD(Math.min(parseD(a.dataset.go), route.total)), behavior: reduceMotion ? 'auto' : 'smooth' });
}));

// Sound. These five are recordings made with Higgsfield, the walk's own sound is made in js/sound.js. Everything goes out through
// one volume (out), and that starts shut: a page shouldn't make noise nobody asked for. Pressing PRESS is asking, and so is the
// sound switch in the top bar. sfx.set(true) opens it, sfx.set(false) shuts it again.
const sfx = (() => {
  const files = { press: 'audio/press.mp3', box: 'audio/box-drop.mp3', pop: 'audio/pop.mp3', whoosh: 'audio/whoosh.mp3', land: 'audio/land.mp3' }, raw = {}, buf = {}, want = {}, last = {}; let ctx = null, out = null;
  // while recording (?press=), a few pixels in the corner flash a colour per sound, so the recording can be given the same sounds at the same moments
  const mark = new URLSearchParams(location.search).has('press') ? document.body.appendChild(Object.assign(document.createElement('i'), { style: 'position:fixed;left:0;bottom:0;width:12px;height:12px;z-index:99;opacity:0' })) : null;
  const tint = { press: '#ff00ff', box: '#00ffff', pop: '#00ff00', whoosh: '#ff0000', land: '#0000ff' };
  for (const k in files) raw[k] = fetch(files[k]).then((r) => r.arrayBuffer()).catch(() => null);          // fetched up front, so the first click doesn't wait for the network
  const TRIM = 0.5;      // the recordings are loud. Played at half, they sit just above the walk's own sound and nothing jumps out
  const start = (k, vol) => { const src = ctx.createBufferSource(), gain = ctx.createGain(); src.buffer = buf[k]; gain.gain.value = vol * TRIM; src.connect(gain).connect(out); src.start(); };
  const unlock = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
    for (const k in files) raw[k].then((b) => b && ctx.decodeAudioData(b)).then((d) => { if (!d) return; buf[k] = d; if (want[k] && performance.now() - want[k].t < 400) start(k, want[k].vol); }).catch(() => {});
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, unlock, { passive: true, capture: true }));
  return { live: () => !!ctx && ctx.state === 'running', off: true, get ctx() { return ctx; }, get out() { return out; },
    set(on) { unlock(); this.off = !on; if (out) { const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.015 : 0.08); } filmVid.muted = !filmS.sound || !on; },
    play(k, vol = 0.9) {
    const now = performance.now(); if (now - (last[k] || -1e9) < 900) return; last[k] = now;          // never the same sound twice in a second, however you scrub
    if (mark) { mark.style.background = tint[k]; mark.style.opacity = 1; setTimeout(() => { mark.style.opacity = 0; }, 180); }
    if (!ctx || ctx.state !== 'running' || this.off) return; if (buf[k]) start(k, vol); else want[k] = { t: now, vol }; } };
})();

// The PRESS button under the name does the first scrolls for you: the box comes down, and once it has landed
// the page walks itself forward until the robot is out and standing. Any scroll of your own takes over.
let auto = null;
function autoTo(d, secs, ease) {      // ease: how far along (0 to 1) at each share of the time. Left out, it starts and stops gently
  const me = auto = { stop: false }, y0 = scrollY, y1 = scrollForD(d), t0 = performance.now();
  return new Promise((done) => { (function tick(now) {
    if (me.stop) { me.over = true; return done(false); }
    const k = clamp((now - t0) / (secs * 1000), 0, 1); scrollTo(0, y0 + (y1 - y0) * (ease ? ease(k) : k * k * (3 - 2 * k)));
    if (k < 1) requestAnimationFrame(tick); else { me.over = true; done(true); }
  })(t0); });
}
// The last fall is one motion. Step off the edge and the page scrolls itself: up to speed, a steady fall all the way to the button,
// then it slows down while the words fly and the camera comes in. Left to the scroll alone, any pause left the robot hanging in mid-air.
// Scroll back up off the button and it goes back to the edge in one go too. Your own scroll takes over again once it has landed.
const FALL_SECS = 4.2;      // from the edge to the button, long enough for the four lines to be read on the way down
function fallTo(dir) {
  if (dir < 0) { autoTo(M.lip - 0.4, 1.3); auto.fall = true; auto.hold = performance.now() + 1300; return; }
  const d0 = S.exact, dL = M.land, dE = M.land + 3.4, v = (dL - M.lip) / FALL_SECS, tA = 0.3, sA = v * tA / 2, tB = Math.max(0, dL - d0 - sA) / v, tC = 2 * (dE - dL) / v, tot = tA + tB + tC;
  autoTo(dE, tot, (k) => { const t = k * tot, u = t - tA - tB; return (t < tA ? v * t * t / (2 * tA) : u < 0 ? sA + v * (t - tA) : dL - d0 + v * u - v * u * u / (2 * tC)) / (dE - d0); });
  auto.fall = true; auto.hold = performance.now() + (tA + tB + 0.4) * 1000;      // nothing interrupts it until it has hit the button
}
document.getElementById('unbox').addEventListener('click', async () => {
  sfx.play('press');
  if (!(await autoTo(DROP_D + 0.55, reduceMotion ? 0.01 : 0.6))) return;
  const me = auto;
  await new Promise((done) => { const t = setInterval(() => { if (drop.state === 'home' || me.stop) { clearInterval(t); done(); } }, 50); });
  if (!me.stop) autoTo(M.landed - 1.0, reduceMotion ? 0.01 : 7);          // it stops in the middle of the wave, so it keeps waving until you scroll
});
['wheel', 'touchmove', 'keydown'].forEach((ev) => addEventListener(ev, () => { if (auto && performance.now() > (auto.hold || 0)) auto.stop = true; }, { passive: true }));
const ASSIST = new URLSearchParams(location.search).get('assist') !== '0';
{ const p = new URLSearchParams(location.search).get('press'); if (p) setTimeout(() => document.getElementById('unbox').click(), +p * 1000); }      // ?press=2 presses it for you after 2 s, for recordings

/* ---------- pointer: look, hop, grab, throw, spin, press ---------- */
const pointer = { x: 0, y: 0, has: false, down: false };
const ray = new THREE.Raycaster();
let drag = null, spin = null, userYaw = 0, hoverDirty = false;
const ndc = (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1; pointer.has = true; };
function pick() {
  ray.setFromCamera(pointer, camera);
  if (S.d > M.land - 1 && ray.intersectObject(capBtn, false)[0]) return { cta: true };
  const r = S.pov ? null : ray.intersectObject(hit, false)[0];
  const l = ray.intersectObjects(letterMeshes, false).find((h) => h.object.visible && h.object.userData.letter.state === 'free');
  if (r && (!l || r.distance < l.distance)) return { robot: true };
  if (l) return { letter: l.object.userData.letter, point: l.point };
  const h = ray.intersectObjects(heroMeshes, false).find((x) => x.object.userData.hero.state === 'float');
  if (h) return { hero: h.object.userData.hero };
  return null;
}
function startGrab(p) {
  if (!p) return false;
  if (p.cta) { S.ctaV = 7; robot.hop(4.4); say('Reserved. Well, not really. Mosey is made up.'); return true; }
  if (p.robot) { robot.hop(); return true; }
  if (p.hero) { p.hero.spinT = S.time; return true; }
  const L = p.letter, pos = L.body.translation();
  drag = { L, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(V3()).negate(), p.point), grip: V3().copy(p.point).sub(pos) };
  L.body.wakeUp(); document.body.classList.add('grabbing');
  return true;
}
canvas.addEventListener('touchstart', (e) => { ndc(e.touches[0]); const p = pick(); if (p && p.letter) e.preventDefault(); }, { passive: false });
addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('a,button')) return;
  ndc(e); pointer.down = true;
  if (!startGrab(pick()) && S.stop === 'details' && S.d > M.plinth - 0.5) spin = { x: e.clientX, yaw: userYaw };
});
addEventListener('pointermove', (e) => { ndc(e); hoverDirty = true; if (spin) userYaw = spin.yaw + (e.clientX - spin.x) * 0.012; });
const release = () => { pointer.down = false; drag = null; spin = null; document.body.classList.remove('grabbing'); };
addEventListener('pointerup', release); addEventListener('pointercancel', release);
document.addEventListener('pointerleave', () => { pointer.has = false; });

/* ---------- the loop ---------- */
const showAct = { name: 'present', t: 0 };
const S = { exact: 0, d: 0, prev: 0, speed: 0, sign: 1, idleFor: 0, yaw: 0.45, time: 0, stop: 'hero', shoved: false, tipped: false, bumped: false, found: false, acc: 0, close: 0, shiftX: 0, shiftY: 0, wasAir: false, tick: 0, pick: -1, pickT: -99, slot: -1, q: -1, qT: 0, qPick: 0, qPickT: -99, pov: false, povInit: false, cta: 0, ctaV: 0, night: 0 };
const anchor = V3(), look = V3(), camPos = V3(), headW = V3(), target = V3(), local = V3(), lens = V3(), cFace = new THREE.Color(), cAcc = new THREE.Color(letterFx?.faceLit ?? PAL.accent), cBase = new THREE.Color(letterFx?.faceBase ?? PAL.face), cCool = new THREE.Color(PAL.cool ?? '#a9b9ff');
const navA = [...document.querySelectorAll('nav.stops a')], navB = [...document.querySelectorAll('nav.tabs a')], seal = document.querySelector('.bar .mark');
navA.forEach((a) => a.style.setProperty('--x', (Math.min(parseD(a.dataset.go), route.total) / route.total * 100).toFixed(2) + '%'));      // each link stands on the track where its stop is
const hint = document.getElementById('hint'), stopname = document.getElementById('stopname'), stopnum = document.getElementById('stopnum'), railfill = document.getElementById('railfill'), railbot = document.getElementById('railbot');
const railticks = Object.values(stops).slice(1).map(([a]) => { const el = document.createElement('b'); el.style.left = (a / route.total * 100).toFixed(2) + '%'; document.getElementById('railticks').appendChild(el); return { el, a, done: false }; });      // a dot where each stop begins
boot.world = Math.round(performance.now());
layout();
{ const q = new URLSearchParams(location.search).get('d'); if (q) scrollTo(0, scrollForD(parseD(q))); }
S.exact = S.d = S.prev = readScroll().d;
anchor.copy(route.at(S.d).pos);
let first = true, last = performance.now(), running = true, manual = false;
const perf = { frames: 0, ms: 0, worst: 0 };

function frame(now) {
  if (!running) return;
  if (now - last < 0.5) { if (!manual) requestAnimationFrame(frame); return; }          // a frame with no time in it: skip, never divide by zero
  const dt = Math.min((now - last) / 1000, 1 / 30) * (window.__heroFx?.timeScale ?? 1); last = now; S.time += dt; S.tick++;      // the freeze in the intro slows the clock (js/hero-fx.js)
  const T = S.time;
  perf.frames++; perf.ms += dt * 1000; perf.worst = Math.max(perf.worst, dt * 1000);

  // 1. scroll to distance walked
  const sc = readScroll();
  S.exact = sc.d;
  S.d = reduceMotion || first ? S.exact : damp(S.d, S.exact, 5.5, dt);
  if (Math.abs(S.d - S.exact) < 0.002) S.d = S.exact;
  S.speed = damp(S.speed, (S.d - S.prev) / dt, 12, dt);
  const forward = S.d > S.prev, was = S.prev; S.prev = S.d;
  if (S.speed > 0.4) S.sign = 1; else if (S.speed < -0.4) S.sign = -1;
  if (ASSIST && !reduceMotion && !first && !(auto && auto.fall && !auto.over)) {      // the last fall plays in one go (fallTo)
    const a = M.lip + 0.2, b = M.land - 0.3;
    if (forward && was <= a && S.d > a && S.exact < M.land - 1) fallTo(1); else if (!forward && was >= b && S.d < b && S.exact > M.lip + 1) fallTo(-1);
  }
  S.idleFor = Math.abs(S.speed) < 0.06 ? S.idleFor + dt : 0;
  if (S.stop !== sc.r.s.dataset.stop) { S.stop = sc.r.s.dataset.stop; stopname.textContent = sc.r.s.dataset.name; stopnum.textContent = String(sc.r.i + 1).padStart(2, '0'); }

  // 2. night and day. The page is in daylight until the evening: LIGHTS falling turns it dark. It stays dark for the film on the wall
  // and the nap on the dock, and the day comes back when it wakes.
  let fallen = 0;
  const lightsOn = S.d > M.plinthEnd - 2 && S.d < M.shove;      // the sign stands on its wall from the specs on, switched off. Once down, its letters lie at the foot of the wall for the whole evening
  let lamps = 0;
  lightsW.forEach((L, i) => {
    const e0 = clamp((S.d - (M.famEnd - 1.7 + i * 0.3)) / 0.9, 0, 1), on = e0 <= 0 ? 0 : e0 >= 1 ? 1 : e0 < 0.18 ? 1 : e0 < 0.34 ? 0.12 : e0 < 0.5 ? 0.9 : e0 < 0.62 ? 0.3 : 1;      // it does not pop up, it comes on, letter by letter, like a tube: a flash, a flicker, then steady
    const f = smooth(S.d, L.dPass - 0.15, L.dPass + 1.0), a = -Math.PI / 2 * bounceOut(f), lit = on * (1 - smooth(f, 0.05, 0.45)), air = on * (1 - smooth(f, 0.02, 0.3)); fallen += f; lamps += lit;
    L.face.emissiveIntensity = 1.1 * lit; L.halo.material.opacity = 0.2 * air; L.wash.material.opacity = 0.11 * air; L.pool.material.opacity = 0.13 * air;      // six letters' glows lie over each other and add up: at the strengths they had the wall behind the word burnt out to white. Now the faces of the letters are the brightest thing
    L.mesh.visible = lightsOn; L.halo.visible = L.wash.visible = L.pool.visible = lightsOn && air > 0.004; L.mesh.rotation.x = a;
    L.mesh.position.set(L.pivot.x, L.pivot.y + L.half.y * Math.cos(a) - L.half.z * Math.sin(a), L.pivot.z + L.half.y * Math.sin(a) + L.half.z * Math.cos(a));
  });
  signShade.visible = lightsOn && lamps > 0.01; signShade.material.opacity = 0.42 * lamps / lightsW.length * (1 - (S.night || 0));      // the wall behind the lit sign stands in its own soft shade by day, so the glow has something to be brighter than. At night the whole wall is dark and the shade is not needed
  signLamp.position.set((lightsW[0].home.x + lightsW[5].home.x) / 2, 1.7, lightsW[0].home.z + 2.1); signLamp.intensity = 38 * lamps / lightsW.length;      // and the lamps light what is near them: the floor, the wall behind, and him as he passes
  const eve = 0;      // no dusk before the lights go out: the page is in full daylight until he knocks the sign down. The sign gets its contrast from the shade on its own wall, see signShade
  const N = S.night = (eve + (1 - eve) * fallen / lightsW.length) * (1 - smooth(S.d, M.napEnd + 0.2, M.morning + 0.4));      // night is the word going down, letter by letter. Morning is it waking on the dock.
  const dim = smooth(S.d, M.photo - 2, M.photo) * (1 - smooth(S.d, M.photoEnd, M.photoEnd + 2)) * 0.9;      // lights down for the projector
  sun.intensity = lerp(2.5, 0.07, N) * (1 - dim); hemi.intensity = lerp(0.75, 0.2, N) * (1 - dim * 0.5); rim.intensity = lerp(0.9, 1.3, N);
  scene.environmentIntensity = lerp(0.5, 0.1, Math.max(N, dim)); lamp.intensity = 15 * Math.max(N, dim); fillLamp.intensity = 12 * Math.max(N, dim);
  { const dl = S.vd ?? S.d; for (const L of headline) {
    const lit = smooth(dl, L.dOn, L.dOn + 0.12);      // yellow means lit: each letter of GONE as he lands on it, WALKING in one run as he drops into the gap
    if (lit < 0.5) cFace.copy(cBase).lerp(C_FLASH, lit * 2); else cFace.copy(C_FLASH).lerp(cAcc, lit * 2 - 1); L.face.color.copy(cFace); /* blue to yellow by way of white, a flash, and not through the pink a straight blend makes */ L.face.emissive.copy(cCool).lerp(cAcc, lit); L.face.emissiveIntensity = lerp(N * 0.62, 0.12 + 0.9 * N, lit);      // unlit letters keep a faint glow at night, so the headline can be read before it gets there
  } }

  // 3. the robot on the route
  // S.vd is where he really is on the route. Mostly that is where the scroll is. On the title it is a queue: the jump on to the G, the hops, the walk along the E
  // and the drop into the passage are played one after the other, each from its start to its end, however the scroll moves. A hop takes its own time on the clock
  // (up to one and a half times faster when the scroll is well ahead), the next one starts when the one before has landed, and scrolling back plays them in reverse.
  // He is never put on a letter without the hop that takes him there. Only a jump from far away (the menu, a reload) puts him straight where the scroll is.
  { const d = S.d, Z0 = M.headline - 12, Z1 = M.inGap + 12, play = S.vd !== undefined && S.vd > Z0 && S.vd < Z1 && d > Z0 && d < Z1; S.play = play;
    if (!play) { if (S.vd === undefined || Math.abs(d - S.vd) > 7) S.vd = d; else S.vd += clamp(d - S.vd, -22 * dt, 22 * dt); }
    else { let left = dt, n = 0; const inTitle = (x) => x > M.helloEnd - 0.3 && x < M.inGap;
      while (left > 1e-5 && Math.abs(d - S.vd) > 1e-4 && n++ < 8) { const dir = d > S.vd ? 1 : -1;
        const sg = (dir > 0 ? route.segs.find((g) => S.vd < g.start + g.len - 1e-6) : route.segs.findLast((g) => S.vd > g.start + 1e-6)) || route.segs[route.segs.length - 1], a = sg.start, b = sg.start + sg.len;
        if (sg.how === 'jump' && sg.timed) {      // a hop: once begun it goes to an end. Which end: the scroll's side of it, or if the scroll stopped inside it, the way the scroll was going
          const tgt = d >= b ? b : d <= a ? a : S.sign >= 0 ? b : a; if (Math.abs(tgt - S.vd) < 1e-5) break;
          const v = sg.len / sg.timed * clamp(1 + (Math.abs(d - S.vd) - sg.len) / 3, 1, 1.5), step = Math.min(Math.abs(tgt - S.vd), v * left); S.vd += Math.sign(tgt - S.vd) * step; left -= step / v;
        } else if (sg.how === 'wait') S.vd = dir > 0 ? Math.min(d, b) : Math.max(d, a);      // standing still costs no time: the next hop can start at once
        else { const v = inTitle(S.vd) ? 9 : 30, tgt = dir > 0 ? Math.min(d, b) : Math.max(d, a), step = Math.min(Math.abs(tgt - S.vd), v * left); S.vd += dir * step; left -= step / v; }
      } } }
  let gy0 = 0, gy1 = 0; if (S.vd > M.onG && S.vd < M.gone) { gy1 = route.at(Math.min(M.gone, S.vd + 0.12)).pos.y; gy0 = route.at(Math.max(M.onG, S.vd - 0.12)).pos.y; }
  const R = route.at(S.vd);
  const dv = S.vd;
  // On the glass he stands on two points, not one: the glass under his front foot and under his back foot, read 12 hundredths ahead and behind. His height is their
  // middle and he leans with the line between them (up to 14 degrees), so on the round tops of the G and the O neither foot hangs in the air or sinks in.
  let pitch = 0, onStride = null; if (gy1) { R.pos.y = (gy0 + gy1) / 2; pitch = clamp(-Math.atan2(gy1 - gy0, 0.24) * 0.6, -0.25, 0.25) * S.sign;
    onStride = GAIT.strides.find((q) => dv > q[0] && dv < q[1]) || null;
    if (onStride) { const u = (dv - onStride[0]) / (onStride[1] - onStride[0]), b = Math.sin(Math.PI * u); R.crouch = Math.max(R.crouch, 0.5 * b); R.pos.y -= 0.05 * b; strideAct.t = u; } }      // the long stride: a small dip, and his arms go out for it
  S.pitch = damp(S.pitch || 0, pitch, 14, dt);
  // In its head. From the front door of its home to the stove you see what it sees. There is no cut on the way in or out: the camera behind its shoulder keeps going forward,
  // through the back of its head and out at its eye, and at the stove it comes back out the same way. headK: 0 behind it, 1 in its eye.
  const hx = clamp((dv - (M.door - 2.6)) / 3.8, 0, 1) * (1 - clamp((dv - (M.stoveEnd + 0.2)) / (M.outHead - 0.3 - M.stoveEnd), 0, 1)), headK = hx * hx * (3 - 2 * hx);
  const inside = smooth(dv, M.door - 1.6, M.door + 0.6) * (1 - smooth(dv, M.backdoor + 0.8, M.backdoor + 3.0));      // the camera is indoors: 0 outside, 1 in the rooms. The light, the haze and the gardens behind the windows go by this
  const pov = S.pov = headK > 0.995;
  // Its home stands behind the headline. It is drawn only once the camera is past the glass letters, and they are put away at the same moment: glass draws what is behind it
  // into a texture first, and building the home's shaders for that was a four second stall on a first visit. It is put away again once it has gone, before TALKS comes up.
  // His home stands close behind the passage. It is in the world from the moment he comes down off the E, and none of it is drawn until the pulse from his lens reaches it.
  // It is put away once he and the camera are out of the back door and it is behind the camera.
  const homeOn = dv > M.gap - 0.8 && dv < AWAY && S.d < AWAY + 3;
  robot.root.visible = headK < HEAD_IN; { const gv = dv > M.door - 0.6 && dv < M.backdoor + 2.6; if (gv !== garden.visible) garden.visible = gv; }
  if (homeOn !== S.homeOn) { S.homeOn = homeOn; home.visible = homeOn; if (!homeOn) { pulseRing.show(false, 0); S.pr = dv < M.gap ? 0 : 1e5; } if (!homeOn) for (const pn of scanPins) { pn.on = false; pn.g.visible = false; } }
  { const tv = dv < M.rm1 && S.d < M.rm1 + 2; if (tv !== S.titleOn) { S.titleOn = tv; for (const L of headline) L.mesh.visible = tv; } }      // the title is put away once he is deep in his home
  { const tk = dv > M.rm4 && S.d > M.rm4 - 3; if (tk !== S.talksOn) { S.talksOn = tk; for (const L of talks) L.mesh.visible = tk; talksBase.visible = tk; } }                          // and TALKS is out there, in the daylight behind the back door, before he can see that door
  if (homeOn) {
    // The scan that brings the house into being: a pulse leaves his lens where he stands in the passage and runs outwards as a sphere. Ahead of it there is nothing.
    // At it, the wire cage of the house in fine lines. A little behind it the real surfaces come in, and the wires burn away (js/home-kit.js, js/home-rooms.js).
    // Two pushes: the first takes the door wall and the hall, the second the roofs and the wings. Both follow where he is on the walk, so it runs backwards too.
    const g0 = M.gap, e1 = 1 - clamp((dv - g0) / 3.4, 0, 1), want = dv < g0 ? 0 : dv > g0 + 8.2 ? 1e5 : 1.2 + 25 * (1 - e1 * e1) + 66 * smooth(dv, g0 + 3.6, g0 + 8.0);      // it starts as he lands
    // It follows the scroll, forwards and backwards. Going forwards it also has a top speed, so after a hard flick it still sweeps and does not jump.
    const was = S.pr ?? 0, pr = S.pr = dv > M.door - 2 ? 1e5 : want > was ? Math.min(want, Math.min(was, 95) + 42 * dt) : want;
    homeKit.scan.pulse(DROP.x - HX, 0.8, DROP.z - 0.3 - HZ, pr >= 93 ? 1e5 : pr);
    pulseRing.show(pr > 0.01 && pr < 19, pr);
    const mapping = dv < M.outHead; homeKit.scan.set(mapping, mapping ? scanTour.light(dv) : null); hallDock.update(T, 1, false);      // inside, each room is bare until his light has run through it
    for (const pn of scanPins) {      // a pin comes down a moment after the light has passed its spot: a fall, then a spring that dies away. All of it a function of the scroll.
      const k = mapping && headK > 0.5 ? clamp((dv - (pn.d0 ??= scanTour.when(pn.room, pn.far) + 0.5)) / 2.6, 0, 1) : 0; pn.on = k > 0.3; pn.g.visible = k > 0;
      if (k > 0) { const fall = Math.min(1, k / 0.3), t2 = Math.max(0, k - 0.3) / 0.7, sp = Math.exp(-6 * t2) * Math.sin(t2 * 16);
        pn.g.position.y = 9 * (1 - fall * fall) + 0.5 * sp * (fall >= 1 ? 1 : 0); pn.g.scale.set(1 - 0.18 * sp, 1 + 0.3 * sp, 1 - 0.18 * sp); pn.ring.scale.setScalar(fall >= 1 ? 1 + t2 * 2.2 : 0.001); pn.ring.material.opacity = 0.9 * (1 - t2); pn.ring.position.y = 0.03 - pn.g.position.y; } }
  }
  { const hh = S.d > M.headline + 0.7; if (hh !== S.heroHid) { S.heroHid = hh; for (const L of heroType) L.mesh.visible = !hh; boxBurst.show(!hh); } }      // the box, the fallen letters of its name and the confetti are put away once it is up on GONE WALKING: they sat in the back of every shot there      // and the confetti is not on the floor of the room where the film plays      // the fallen letters of its name are put away while you watch the film, so none lies in front of the picture
  robot.root.position.copy(R.pos);
  if (S.d < M.peeked) robot.root.position.y -= 0.6 * (1 - smooth(S.d, M.knock, M.knock + 0.9));                    // crouched under the lid
  if (R.act.name === 'peek') robot.root.position.y += Math.pow(Math.max(0, Math.sin(T * 1.15)), 3) * 0.2 * (1 - R.act.t);
  const capDrop = 0.26 * clamp(Math.sin(clamp((S.d - M.land) / 1.5, 0, 1) * Math.PI) * 1.1 + S.cta, 0, 1.2);      // the button gives under it
  if (S.d >= M.land) robot.root.position.y -= capDrop;
  capBtn.position.y = 0.55 - capDrop; if (S.d > M.edge) ctaKit.update(T, clamp(capDrop / 0.26, 0, 1) * 0.8);
  { const below = S.d > M.lip + 2.6; if (below !== S.below) { S.below = below; floorMesh.visible = !below; cta.visible = below || S.d > M.land; for (const L of endLetters) L.mesh.visible = below; } }      // once it is falling, the floor it left is put away (it would hang over the picture), and what is at the bottom is only shown from here on
  S.ctaV += (-S.cta * 140 - S.ctaV * 11) * dt; S.cta = Math.max(0, S.cta + S.ctaV * dt);
  const dropping = R.how === 'float' || R.how === 'fall', still = R.how === 'wait' || R.how === 'climb' || dropping;
  const wantYaw = (R.face !== undefined ? R.face : dropping ? 0.2 + (R.how === 'fall' ? Math.sin(T * 1.25) * 0.55 * smooth(R.act.t, 0.2, 0.3) * (1 - smooth(R.act.t, 0.85, 0.97)) : 0) : Math.atan2(R.dir.x * (still ? 1 : S.sign), R.dir.z * (still ? 1 : S.sign))) + userYaw;
  let dy = wantYaw - S.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  S.yaw += dy * (1 - Math.exp(-9 * dt));
  robot.root.rotation.y = S.yaw; robot.root.rotation.x = S.pitch;
  S.lampUp = damp(S.lampUp || 0, R.air >= 0 ? 1 : 0, 7, dt);      // in a jump its lamp rides higher above it, so a flip never turns it white
  lamp.position.set(Math.sin(S.yaw) * 0.3, 1.25 + S.lampUp * 1.5, Math.cos(S.yaw) * 0.3).add(robot.root.position); fillLamp.position.set(-1.2 * Math.cos(S.yaw) - 1.5 * Math.sin(S.yaw), 1.5, 1.2 * Math.sin(S.yaw) - 1.5 * Math.cos(S.yaw)).add(robot.root.position);
  if (S.stop !== 'details' && !spin) { userYaw = Math.atan2(Math.sin(userYaw), Math.cos(userYaw)); userYaw = damp(userYaw, 0, 4, dt); }      // (it may have gone round several times: the short way back)

  const lookAt = { yaw: 0, pitch: 0 };
  // The specs plinth is asleep until his feet are on it, wakes, and goes back to sleep when he hops off. It follows where he is, so it plays backwards too.
  // Awake, it turns him slowly by itself (once round in twenty seconds) until you drag, and takes up again when you let go.
  { const onIt = S.d >= M.plinth - 0.04 && S.d < M.plinthEnd - 0.05; if (onIt && !S.plOn) S.wakeT = T; S.plOn = onIt; S.plK = damp(S.plK ?? 0, onIt ? 1 : 0, 4, dt);
    plinthKit.awake(S.plK, onIt ? clamp((T - S.wakeT) / 1.1, 0, 1) : 1, reduceMotion ? 0 : dt);
    if (onIt && !spin && !reduceMotion && T - S.wakeT > 1.0) userYaw += dt * (Math.PI * 2 / 20) * smooth(T - S.wakeT, 1.0, 2.2); }
  if (pointer.has && !coarse) {
    robot.root.getWorldPosition(headW); headW.y += 0.8;
    ray.setFromCamera(pointer, camera);
    target.copy(ray.ray.direction).multiplyScalar(camera.position.distanceTo(headW) * 0.82).add(ray.ray.origin);
    local.copy(target); robot.root.worldToLocal(local);
    lookAt.yaw = clamp(Math.atan2(local.x, Math.max(0.2, local.z)), -1.15, 1.15);
    lookAt.pitch = clamp(-Math.atan2(local.y - 0.8, Math.hypot(local.x, local.z)), -0.5, 0.45);
  }
  const an = R.act.name;
  if (S.d > M.landed - 2.6 && S.d < M.helloEnd - 0.9) { lookAt.yaw = 0; lookAt.pitch = 0; }
  if (dv > M.gone && dv < M.peer + 0.3) { lookAt.yaw = 0; lookAt.pitch = -0.08; }      // on the E: it looks down into the gap before the W                          // it holds still and looks straight at you
  if (an === 'present') { const g = smooth(Math.sin(T * 0.55), 0.55, 0.8); lookAt.yaw = 1.15 * g; lookAt.pitch = -0.1 * (1 - g); }      // it watches the wall, and looks round at you now and then
  if (an === 'present' && S.d > M.photo - 1) { showAct.name = ['talk', 'wave', 'present', 'talk', 'wave', 'pose'][Math.max(0, S.slot)] || 'present'; showAct.t = 0.5; }
  if (an === 'talk') { showAct.name = ['talk', 'present', 'pose'][Math.max(0, S.q)] || 'talk'; showAct.t = clamp((T - S.qT) / 3, 0, 1); if (S.q === 1) lookAt.pitch = -0.32; }      // the timer: it tells you. the rain: it points up and looks at the sky. the joke: a little bow      // film: it tells you about it. photos: it waves at them. homework: it points at the board. reminders: it tells you. the call: it waves at grandma. stars: it looks round at them
  if (S.plOn && T - S.wakeT < 1.2 && !reduceMotion) lookAt.pitch = 0.62 * Math.sin(Math.PI * (T - S.wakeT) / 1.2);      // as it wakes he looks down at his feet, and then it starts to turn
  robot.update({ dist: dv > M.onG - 2.6 && dv < M.gap ? GAIT.at(dv) : S.d, speed: still ? 0 : S.speed, air: R.air, crouch: R.crouch, onModel: false, falling: false, idleFor: S.d < M.headline ? 0 : S.idleFor, look: lookAt, lookDown: S.d > M.lip0, act: onStride ? strideAct : (an === 'present' && S.d > M.photo - 1) || an === 'talk' ? showAct : R.act, dt, time: T, blobOff: S.d < M.rim || dropping || (R.air >= 0 && S.d > M.headline - 1 && S.d < M.gap + 0.5) || (S.d > M.onG && S.d < M.gap - 0.2) || (S.d > M.lip0 - 1.2 && S.d < M.land) || camera.position.y - robot.root.position.y > 5.5, glow: Math.max(N, dim) });
  robotBody.setNextKinematicTranslation(dropping || pov || S.d < M.out || Math.abs(S.d - S.exact) > 3 || S.bumped || (S.d > M.bump - 0.8 && S.d < M.bump + 0.2) || (S.d > M.shove - 0.8 && S.d < M.shoveEnd + 0.6) ? { x: 0, y: -80, z: 0 } : { x: R.pos.x, y: R.pos.y + 0.55, z: R.pos.z });

  // the box comes down out of the sky, on to the name. A real fall, started by the first scroll.
  if (first && S.d > M.knock) { drop.state = 'home'; heroType.forEach((L, i) => { freeHero(L); L.body.setTranslation({ x: BX - (1.3 + i * 0.3), y: 0.5 + (i % 3) * 0.3, z: -0.9 + (i % 4) * 0.45 }, true); L.body.setRotation(_q.setFromEuler(_e.set(1.3, i, 0.3)), true); }); }      // the page was opened further down: the letters are already on the floor
  if (drop.state === 'sky' && S.d > DROP_D) {
    drop.state = 'falling'; drop.t = 0; drop.hitT = -1;
    boxBody.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    boxBody.setEnabledTranslations(false, true, false, true);                                             // it falls straight down, so it always ends up where the rest of the scene expects it
    boxBody.setTranslation({ x: BX, y: 7.6, z: 0 }, true); boxBody.setRotation(_q.setFromEuler(_e.set(0.05, 0.28, 0.09)), true);
    boxBody.setLinvel({ x: 0, y: -4.5, z: 0 }, true); boxBody.setAngvel({ x: 0.15, y: 0.4, z: -0.3 }, true);
  } else if (drop.state === 'falling') {
    drop.t += dt; const p = boxBody.translation(), bottom = p.y - BH / 2;
    if (drop.hitT < 0 && bottom < heroTop + 0.3) {                                                         // first touch. The letters under it let go now, the row below and the ones further out a beat later.
      drop.hitT = drop.t; sfx.play('box');
      for (const L of heroType) { L.dx = L.home.x - p.x; L.due = drop.t + L.r * 0.045 + Math.max(0, Math.abs(L.dx) - BS / 2) * 0.05; }
    }
    if (drop.hitT >= 0) for (const L of heroType) if (L.state === 'float' && drop.t >= L.due) freeHero(L, Math.abs(L.dx) > BS / 2 ? Math.sign(L.dx) : 0);
    const v = boxBody.linvel(); if (v.y > 1.2) boxBody.setLinvel({ x: 0, y: 1.2, z: 0 }, true);                  // cardboard doesn't bounce
    if ((drop.t > 0.7 && Math.hypot(v.x, v.y, v.z) < 0.25) || drop.t > 1.7 || S.d > M.knock + 0.3) { drop.state = 'settling'; drop.t = 0; drop.from.copy(p); drop.fromQ.copy(boxBody.rotation()); boxBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true); heroType.forEach((L) => freeHero(L)); }
  } else if (drop.state === 'settling') {                                                                 // it shuffles itself square. Something inside did that.
    drop.t = Math.min(1, drop.t + dt / 0.7); const e = drop.t * drop.t * (3 - 2 * drop.t);
    _v.lerpVectors(drop.from, BOX_HOME, e); _v.y += Math.sin(e * Math.PI) * 0.12; _q.slerpQuaternions(drop.fromQ, Q0, e);
    boxBody.setNextKinematicTranslation(_v); boxBody.setNextKinematicRotation(_q);
    if (drop.t >= 1) drop.state = 'home';
  } else if (drop.state === 'home') {
    boxBody.setNextKinematicTranslation({ x: BX - 0.6 * (1 - Math.pow(1 - smooth(S.d, M.rim + 1.5, M.rim + 3.4), 3)), y: BH / 2, z: 0 }); boxBody.setNextKinematicRotation(Q0);
  } else if (drop.state === 'rising') {                                                                   // scrolled back to the top: it goes back up
    drop.t = Math.min(1, drop.t + dt / 0.45); _v.lerpVectors(drop.from, BOX_SKY, drop.t * drop.t); _q.slerpQuaternions(drop.fromQ, Q0, drop.t);
    boxBody.setNextKinematicTranslation(_v); boxBody.setNextKinematicRotation(_q);
    if (drop.t >= 1) drop.state = 'sky';
  }
  if (drop.state !== 'sky' && drop.state !== 'rising' && S.d < DROP_D - 0.12) {
    drop.state = 'rising'; drop.t = 0; drop.from.copy(boxBody.translation()); drop.fromQ.copy(boxBody.rotation());
    boxBody.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true); heroType.forEach(floatHero);
  }
  // The letters fall where physics puts them, then make room: off the box, clear of the lids that are about to swing open,
  // away from the front of the box, and off the spot where it will land.
  if (drop.state === 'settling' || drop.state === 'home') {
    const pop = drop.state === 'settling' && drop.t < 0.06;                                          // the box shuffles square: everything touching it jumps
    if (S.d < M.headline) for (const L of heroType) {
      if (L.state !== 'free') continue;
      const p = L.body.translation(), v = L.body.linvel(), dx = p.x - BX, side = Math.abs(dx) < 0.05 ? (L.i % 2 ? 1 : -1) : Math.sign(dx);
      let vx = null, vz = null;
      if (Math.abs(dx) < 1.62 && p.z > -1.05 && p.z < BS / 2 + 1.9 && p.y < BH + 0.7) vx = side * 2.3;       // the box, its lids, and the view of its front
      const lx = p.x - LANDP.x, lz = p.z - LANDP.z, ld = Math.hypot(lx, lz);
      if (ld < 1.2) { const k = ld > 0.02 ? 1 / ld : 0; vx = (k ? lx * k : 1) * 2.1; vz = (k ? lz * k : 0.4) * 2.1; }                     // where it lands
      else if (lx > -0.8 && lx < 3.3 && lz > 0.2 && lz < 4.8) vx = -2.4;                                              // and the floor between it and the camera at the hello: a letter lying there stood in front of it. They go back toward the box
      if (vx !== null) { L.body.setLinvel({ x: lerp(v.x, vx, 0.18), y: pop ? 2.6 + rnd() * 1.4 : v.y, z: vz !== null ? lerp(v.z, vz, 0.18) : v.z }, true); if (pop) L.body.setAngvel({ x: (rnd() - 0.5) * 6, y: (rnd() - 0.5) * 4, z: -side * 3 }, true); }
      if (drop.state === 'home' && Math.abs(dx) < BS / 2 - 0.02 && Math.abs(p.z) < BS / 2 - 0.02 && p.y < BH) L.body.setTranslation({ x: BX + side * (BS / 2 + 0.9), y: 0.5, z: p.z }, true);      // one that somehow ended up inside the box
      if (p.y < 0.09) { L.body.setTranslation({ x: p.x, y: 0.16, z: p.z }, true); L.body.setLinvel({ x: v.x, y: 0, z: v.z }, true); }                                                    // or pressed into the floor
    }
  }
  if (drop.state === 'home') { boxDrop.position.copy(BOX_HOME); boxDrop.quaternion.identity(); } else { boxDrop.position.copy(boxBody.translation()); boxDrop.quaternion.copy(boxBody.rotation()); }
  boxDrop.visible = drop.state !== 'sky' && S.d < M.headline + 0.7;      // the box and the fallen LIGHTS are put away while it is up on GONE WALKING: they sat in the back of every shot there
  { const boxed = drop.state === 'home' || drop.state === 'settling'; if (boxed !== S.boxed) { S.boxed = boxed; document.body.classList.toggle('boxed', boxed); } }      // the copy and the tracker wait for the box
  if (drop.state !== 'home' && S.d < M.rim) robot.root.visible = false;                                    // it is in the box, wherever the box is
  if (forward && was <= M.peeked - 0.3 && S.d > M.peeked - 0.3) for (const L of heroType) {                // the lid flips off whatever landed on it
    const lp = L.body.translation(); if (L.state !== 'free' || lp.y < BH - 0.1 || Math.abs(lp.x - BX) > BS / 2 + 0.2 || Math.abs(lp.z) > BS / 2 + 0.2) continue;
    const m = L.body.mass(); L.body.applyImpulse({ x: Math.sign(lp.x - BX || 1) * m * 2.4, y: m * 4.2, z: m * (1 + rnd()) }, true); L.body.applyTorqueImpulse({ x: m * 0.3, y: 0, z: -m * 0.3 }, true);
  }

  if (forward) {                                                                                     // its sounds, on the way forward only
    const hit = (d) => was <= d && S.d > d;
    if (hit(M.peeked - 0.2)) sfx.play('pop', 0.85);                                                   // the lids fly open and the confetti goes up
    if (hit(M.rim + 1.45)) sfx.play('whoosh', 0.4);                                                  // it jumps and flips
    if (hit(M.out - 0.04)) sfx.play('land', 0.85);                                                   // both feet on the floor
    if (hit(M.lip + 0.5)) sfx.play('whoosh', 0.4);                                                   // off the edge, with a flip
    if (hit(M.land - 0.06)) { sfx.play('land', 0.95); sfx.play('pop', 0.7); S.landT = T; S.ctaV += 6.5; }      // the button takes the hit on its spring, and a ring of dust goes out from under him                        // on to the button, and the words go flying
  }
  // the box: taped shut, it shudders, the lid lifts, then it bursts
  const pk = smooth(S.d, M.knock, M.knock + 1.3), bk = smooth(S.d, M.peeked - 0.3, M.peeked + 0.5), be = bk <= 0 ? 0 : backOut(bk);
  const shake = S.d < M.knock ? Math.pow(Math.max(0, Math.sin(T * 1.25)), 14) : 0;
  const rattle = bk * (1 - smooth(S.d, M.rim + 1.2, M.out)) * Math.min(1, Math.abs(S.speed) * 0.5 + 0.15);
  const headTop = robot.root.position.y + (robot.headTop ?? 1.02) + 0.03, headX = robot.root.position.x - BX, headHalf = robot.headHalf ?? 0.27;
  flaps.forEach((f, i) => {
    // While it peeks, each lid lies on the top corner of its head: the lid's angle is worked out from where the head is, so the two never pass through each other.
    const lift = headTop - (BH + 0.04), reach = Math.max(0.08, BS / 2 - f.sign * headX - headHalf);
    const peekPhi = f.outer ? Math.max(shake * 0.24, lift > 0 ? Math.atan2(lift, reach) + (0.5 + 0.5 * Math.sin(T * 2.2 + i)) * 0.05 * pk : 0) : 0;
    const rest = f.board ? lerp(0.1, f.rest, smooth(S.d, M.rim + 1.7, M.rim + 2.6)) : f.rest;          // the board stays out flat until it has jumped off
    const phi = lerp(peekPhi, Math.PI + rest, be) + Math.sin(T * (9 + i * 2.3)) * 0.07 * rattle * (f.board ? 0.15 : 1);
    if (f.axis === 'z') f.h.rotation.z = f.sign * (Math.PI - phi); else f.h.rotation.x = f.sign * (phi - Math.PI);
  });
  const kick = smooth(S.d, M.rim + 1.5, M.rim + 3.4);                                             // pushed back as it jumps. It rocks, and stays the right way up.
  boxPivot.position.set(BX - BS / 2 - 0.6 * (1 - Math.pow(1 - kick, 3)), shake * 0.035, 0);
  boxPivot.rotation.z = Math.sin(kick * Math.PI * 3) * 0.2 * (1 - kick) + Math.sin(T * 31) * 0.02 * shake + Math.sin(T * 26) * 0.012 * rattle;
  boxBurst(clamp((S.d - (M.peeked - 0.25)) / 3.4, 0, 1) * 3.1, BX, BH, 0, 0);          // long enough on the clock for every piece to reach the floor
  const dk = clamp((S.d - M.out) / 1.3, 0, 1);                                                    // a ring of dust where it lands
  dust.visible = dk > 0 && dk < 1; dust.position.set(LANDP.x, 0.02, LANDP.z); dust.scale.setScalar(0.4 + dk * 1.5); dust.material.opacity = (1 - dk) * 0.55;
  landBurst(clamp((S.d - M.land) / 2.6, 0, 1) * 4.2, BTN.x, FY + 0.9, BTN.z, FY);
  { const b0 = clamp((S.d - M.land) / 2.2, 0, 1);                                                   // the last words, blown off their feet
    if (b0 !== S.blast) { S.blast = b0; for (const L of endLetters) {
      const e = clamp((b0 - L.late) / (1 - L.late), 0, 1), te = 1 - (1 - e) * (1 - e) * (1 - e);
      L.mesh.position.lerpVectors(L.home, L.rest, te); L.mesh.position.y += Math.sin(Math.min(1, e * 1.08) * Math.PI) * L.arc * (1 - e * 0.25);
      L.mesh.rotation.set(L.rot.x * te, L.rot.y * te, L.rot.z * te);
    } } }

  // the hero headline floats, turns and glows until the box lands on it
  for (const L of heroType) {
    const i = L.i, m = L.mesh;
    if (L.state !== 'float') { if (m.material.emissiveIntensity) m.material.emissiveIntensity = 0; m.scale.setScalar(1); continue; }
    const intro = clamp((T - 0.25 - i * 0.07) / 0.7, 0, 1);
    const wave = (T * 0.9 - i * 0.5) % 9, turn = wave > 0 && wave < 1.1 ? (wave / 1.1) * (wave / 1.1) * (3 - 2 * wave / 1.1) * Math.PI * 2 : 0;
    const tap = clamp((T - L.spinT) / 0.9, 0, 1), tapTurn = (1 - Math.pow(1 - tap, 3)) * Math.PI * 2 * (tap < 1 ? 1 : 0);
    _v.copy(L.home).project(camera);
    const dx = _v.x - pointer.x, dyp = (_v.y - pointer.y) / camera.aspect, dd = Math.hypot(dx, dyp), near = pointer.has && !coarse ? Math.max(0, 0.22 - dd) / 0.22 : 0;
    L.push.x = damp(L.push.x, near * Math.sign(dx || 1) * 0.16, 8, dt); L.push.y = damp(L.push.y, near * 0.14, 8, dt);
    _v.set(L.home.x + L.push.x, L.home.y + Math.sin(T * 1.3 + i * 0.7) * 0.05 + L.push.y, L.home.z);
    _q.setFromEuler(_e.set(Math.sin(T * 0.9 + i) * 0.06 - L.push.y * 2, Math.sin(T * 0.8 + i * 0.9) * 0.2 + turn + tapTurn + L.push.x * 3, Math.sin(T * 0.7 + i * 1.3) * 0.03));
    L.body.setNextKinematicTranslation(_v); L.body.setNextKinematicRotation(_q);
    m.scale.setScalar(Math.max(0.001, backOut(intro)));
    m.material.emissiveIntensity = Math.pow(Math.max(0, Math.sin(T * 1.7 - i * 0.6)), 10) * 1.1 + near * 0.8;
  }

  // The family waits, each in its own way, and never all at once. They shift their weight, their eyes wander and come back, and as he passes
  // they turn to him: the first gives a little hop, the middle one waves, the third nods.
  family.forEach((f, i) => {
    if (!f.r.root.visible) return; f.yaw0 ??= f.r.root.rotation.y;
    const t = T + f.seed * 2.3, dx = robot.root.position.x - f.r.root.position.x, dz = robot.root.position.z - f.r.root.position.z, dist = Math.hypot(dx, dz), near = dist < 3.6;
    if (!reduceMotion) { f.r.root.rotation.y = f.yaw0 + Math.sin(t * 0.45) * 0.1; f.r.root.rotation.z = Math.sin(t * 0.8) * 0.022; }      // from one foot to the other
    if (near && !f.near) { f.nearT = T; if (i === 0) f.r.hop(1.9); } f.near = near;
    const toHim = clamp(Math.atan2(dx, dz) - f.r.root.rotation.y, -1.2, 1.2), away = near ? 0 : smooth(Math.sin(t * 0.33), 0.5, 0.9);      // its eye wanders now and then, never while he is right in front of it
    const nod = i === 2 && near ? Math.sin(Math.min(1, (T - f.nearT) / 1.4) * Math.PI * 3) * 0.2 : 0;
    const look = { yaw: lerp(toHim, i === 1 ? -0.8 : 0.7 * Math.sin(t * 0.21), away), pitch: lerp(dist < 2.2 ? 0.1 : 0, i === 0 ? 0.14 : -0.12, away) + nod };
    f.r.update({ dist: 0, speed: 0, air: -1, falling: false, idleFor: 0, look, act: near && i === 1 ? { name: 'wave', t: 0 } : null, dt, time: T + f.seed });
  });
  sizes.update({ way, dt, T, d: S.d, M });
  for (const key in nameWords) {
    const w = nameWords[key], on = key === way && S.d > M.gate + 0.5 && S.d < M.famEnd - 2.4 ? 1 : 0;
    w.k = damp(w.k, on, on ? 7 : 12, dt); const e = w.k < 0.01 ? 0 : backOut(Math.min(1, w.k));
    w.forEach((L, i) => { L.mesh.visible = e > 0; L.mesh.scale.setScalar(Math.max(0.001, e * NAME_K)); L.mesh.position.x = NAME_X + (L.home.x - NAME_X) * NAME_K; L.mesh.position.y = (L.home.y + 2.85) * e + Math.sin(T * 1.2 + i * 0.6) * 0.04; L.mesh.rotation.y = (1 - e) * (i % 2 ? 1 : -1); });
  }

  // 4. words that are ground, words that fall, words that squash
  for (const L of headline) { if (S.d > L.win[0] && S.d < L.win[1]) lock(L); else free(L); }
  if (S.d < M.headline - 1 && was >= M.headline - 1) headline.forEach((L) => sendHome(L, 'free'));
  // The strike. He walks straight into the L like a bowling ball. The L is hit low and hard, goes over backward and tumbles. The shock throws the A and the K
  // outward and back with spin, and the T and the S a moment later and less. All five are real bodies: after those first pushes the physics has them, they hit
  // each other and the floor, and lie where they come to rest. The pushes are the same every time and the world takes the same steps, so it comes out the same.
  // Nothing is taken away. Scrolling back stands the word up again.
  if (S.d > M.bump && !S.bumped && talks.every((L) => L.state === 'free')) { S.bumped = true; S.bumpT = T; S.strikeN = 0; S.kick = 1; sfx.play('box', 0.7);
    for (const L of talks) { L.down = false; L.body.setTranslation({ x: L.home.x, y: L.home.y - 0.043, z: L.home.z }, true); L.body.setRotation(L.homeQ, true); L.body.setLinvel({ x: 0, y: 0, z: 0 }, true); L.body.setAngvel({ x: 0, y: 0, z: 0 }, true); } }      // each letter exactly in its place and still, so that every run starts from the same picture
  if (S.bumped) talks.forEach((L, i) => { if (!L.down) { const q = L.body.rotation(); if (1 - 2 * (q.x * q.x + q.z * q.z) < 0.3) { L.down = true; sfx.play('box', 0.45 * Math.pow(0.85, Math.abs(i - 2))); } } });
  { const t = S.bumped ? T - S.bumpT : 9, on = t < 0.6; if (on !== strikeDust.visible) strikeDust.visible = on; if (on) { const e = 1 - Math.pow(1 - t / 0.6, 2); strikeDust.scale.setScalar(0.5 + 3.4 * e); strikeDust.material.opacity = 0.5 * (1 - t / 0.6); } }      // a ring of dust where he hit it
  if (S.d < M.bump - 2.2 && S.bumped) { S.bumped = false; for (const L of talks) sendHome(L, 'free'); }
  // each letter's contact shadow: under it wherever it is, longer the further it has tipped
  if (S.talksOn) for (const L of talks) { const q = L.mesh.quaternion, upY = 1 - 2 * (q.x * q.x + q.z * q.z), tip = clamp(1 - upY, 0, 1), p = L.mesh.position;
    L.blob.position.set(p.x, 0.014, p.z); L.blob.rotation.y = Math.atan2(2 * (q.y * q.w + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z)); L.blob.scale.set(L.half.x * 2 + 0.9, 1, lerp(L.half.z * 2 + 1.3, L.half.y * 2 + 0.9, tip)); L.blob.material.opacity = lerp(0.42, 0.3, tip); }

  S.found = S.d > M.sofa;
  // The price. Its four blocks drop out of the air one after another and land on the floor as he walks up, as the letters of his name did: real bodies, a thud each.
  // They fall upright (their turning is held until they have landed, or blocks this tall would topple). Scrolling back before the stop takes them away again.
  { const want = S.d > M.price - 5.2; if (want !== S.priceIn) { S.priceIn = want; S.priceT = T;
      price.forEach((L, i) => { L.mesh.visible = want; L.landed = !want; if (L.state === 'homing') return; L.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); L.state = 'free'; L.body.lockRotations(true, true);
        L.body.setTranslation({ x: L.home.x, y: want && !first ? L.home.y + 9 + i * 3.2 : L.home.y, z: L.home.z }, true); L.body.setRotation(L.homeQ, true); L.body.setLinvel({ x: 0, y: 0, z: 0 }, true); L.body.setAngvel({ x: 0, y: 0, z: 0 }, true); });
      if (!want) { S.shoved = false; two.mesh.visible = false; two.body.setTranslation({ x: two.home.x, y: -40, z: two.home.z }, true); two.body.setBodyType(RAPIER.RigidBodyType.Fixed, true); } }
    if (S.priceIn) for (const L of [...price, two]) if (!L.landed && L.mesh.visible && L.body.translation().y < L.home.y + 1.5 && Math.abs(L.body.linvel().y) < 0.4 && T - (L === two ? S.twoT : S.priceT) > 0.3) { L.landed = true; L.sqV = 2.4; sfx.play('box', 0.4); } }      // (their turning stays held: only the 1 is let go, when he knocks it)
  // Regular and XL. As he walks past the 1 he knocks it over. It stays lying where it falls, and a 2 drops out of the air into its place: $149 has become $249,
  // and the small tag by the price changes from MOSEY to MOSEY XL. Scrolling back lifts the 2 away and stands the 1 up again.
  // The knock runs on the steps of the physics from one exact start (the 1 in its place and still, his own body out of the way), so it comes out the same on every
  // run: the 1 goes over backward and lies behind the row, clear of the place the 2 comes down into. (Left free, the 1 sometimes came to rest under the 2.)
  if (S.d > M.shove - 0.05 && !S.shoved && S.priceIn && price.every((L) => L.landed && L.state === 'free')) { S.shoved = true; S.shoveT = T; S.shoveN = 0; two.landed = false; robot.hop();
    const L = price[1]; L.body.setTranslation({ x: L.home.x, y: L.home.y - 0.043, z: L.home.z }, true); L.body.setRotation(L.homeQ, true); L.body.setLinvel({ x: 0, y: 0, z: 0 }, true); L.body.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  if (S.d < M.shove - 2.2 && S.shoved) { S.shoved = false; price[1].landed = true; sendHome(price[1], 'free'); two.mesh.visible = false; two.landed = true; two.body.setBodyType(RAPIER.RigidBodyType.Fixed, true); two.body.setTranslation({ x: two.home.x, y: -40, z: two.home.z }, true); }
  two.mesh.position.copy(two.body.translation()); two.mesh.quaternion.copy(two.body.rotation());
  { const up = S.priceIn && S.d > M.price - 3.4 && S.d < M.edge + 2 && price[0].landed, xl = up && S.shoved && two.landed; if (up !== S.tagOn || xl !== S.tagXL) { S.tagOn = up; S.tagXL = xl; tagA.classList.toggle('is-on', up && !xl); tagB.classList.toggle('is-on', xl); tagB.classList.toggle('is-pop', xl); }
    if (up) { _v.set((price[0].x0 + price[3].x1) / 2, price[0].home.y + price[0].half.y + 0.55, price[0].home.z).project(camera); const tr = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px) translate(-50%, -100%)`; tagA.style.transform = tagB.style.transform = tr; } }
  // The colours stop, left to the scroll: tomato at the gate, then mint, then sunny, and one last pass back to the graphite he came out of the box in, so the evening is walked by the dark robot.
  // A colour you picked on the card yourself stays.
  if (!userWay) { const g = S.d - M.gate, n = PAINTS.length, w = g < -1.3 || !n ? 'classic' : EVENING_COLOUR || g < 3.0 || n < 2 && g < 6.4 ? PAINTS[0] : g >= 6.4 ? 'classic' : PAINTS[Math.min(n - 1, 1 + Math.floor((g - 3.0) / (3.4 / (n - 1))))];
    if (w !== gateWay) { const atGate = g < 1.9 && (w === PAINTS[0] || w === 'classic'); gateWay = w; showWay(w, !atGate && !first); } }      // at the gate itself the sheet of light does the scan, with the scroll. The others run a line over him on a clock
  // Through the gate the colour comes on as a scan: a sheet of light comes down through the frame as he walks through, and above it he is already painted. It follows the scroll, both ways.
  { const k = smooth(S.d, M.gate - 1.0, M.gate + 1.0), y = lerp(1.36, -0.06, k) * robot.root.scale.y, on = !userWay && S.d > M.gate - 1.3 && S.d < M.gate + 1.8, sh = gate.userData.sheet;
    if (paintMain) { if (on) scanPaint.level(paintMain, y); else scanPaint.rest(paintMain); }
    sh.visible = on && k > 0 && k < 1; if (sh.visible) { sh.position.y = Math.max(0.02, y); sh.material.opacity = 0.95 * Math.sin(Math.PI * k) ** 0.5; } }
  scanPaint.update(dt);
  { const on = !!paintMain && paintMain.t >= 0; if (on !== scanBar.visible) scanBar.visible = on;      // the level sheet of every change that is not the gate's: a thin square of light round him, travelling down with the line on his shell
    if (on) { scanBar.position.set(robot.root.position.x, paintMain.y, robot.root.position.z); scanBar.scale.setScalar(robot.root.scale.x); scanBar.material.opacity = 0.9 * Math.sin(Math.PI * Math.min(1, paintMain.t * 1.1)) ** 0.5; } }
  if (way !== S.famWay) { S.famWay = way; for (const f of family) { const key = f.key === way ? 'classic' : f.key; if (f.paint && f.was && f.was !== key && f.r.root.visible) scanPaint.to(f.paint, key); else f.r.setWay(key); f.was = key; } }      // whichever colour it is wearing, the one waiting in that colour puts on silver

  if (drag) {
    if (drag.L.state !== 'free') release();
    else {
      ray.setFromCamera(pointer, camera);
      if (ray.ray.intersectPlane(drag.plane, target)) {
        const p = drag.L.body.translation();
        target.sub(drag.grip); target.y = Math.max(target.y, drag.L.half.z + 0.05);
        _v.set(target.x - p.x, target.y - p.y, target.z - p.z).multiplyScalar(13).clampLength(0, 34);
        drag.L.body.setLinvel(_v, true);
        const w = drag.L.body.angvel(); drag.L.body.setAngvel({ x: w.x * 0.9, y: w.y * 0.9, z: w.z * 0.9 }, true);
      }
    }
  } else if (hoverDirty && !coarse) { hoverDirty = false; document.body.classList.toggle('can-grab', !!pick()); }

  stepLetters(dt);
  S.acc = Math.min(S.acc + dt, 0.05);
  while (S.acc >= world.timestep) { if (S.bumped && S.strikeN < 160) strikeStep(S.strikeN++); if (S.shoved && S.shoveN < 40) priceStep(S.shoveN++); world.step(); S.acc -= world.timestep; }
  for (const L of letters) { L.mesh.position.copy(L.body.translation()); L.mesh.quaternion.copy(L.body.rotation()); }
  for (const L of [...price, two]) { L.sqV += (-L.sq * 150 - L.sqV * 21) * dt; L.sq += L.sqV * dt; const q = Math.abs(L.sq) < 1e-4 ? 0 : L.sq;      // each block squashes as it lands and springs back: the same spring as the letters he steps on
    if (q || L.mesh.scale.y !== 1) { L.mesh.scale.set(1 + q * 0.5, 1 - q, 1 + q * 0.5); L.mesh.position.y -= L.half.y * q; } }

  const onIdx = R.air >= 0 ? -1 : dv >= M.onE - 1e-3 && dv <= M.peer + 0.01 ? 3 : dv >= M.onN - 1e-3 && dv < M.onE ? 2 : dv >= M.onO - 1e-3 && dv < M.onN ? 1 : dv >= M.onG - 1e-3 && dv < M.onO ? 0 : -1;      // the letter under its feet squashes and rocks
  headline.forEach((L, i) => {
    const on = i === onIdx && L.state === 'locked', along = on ? (R.pos.x - L.home.x) * L.ax.x + (R.pos.z - L.home.z) * L.ax.z : 0;      // how far from the letter's middle he stands, along the word
    if (on && !L.wasOn) L.sqV += S.wasAir ? 1.5 : 0.55;
    L.wasOn = on;
    const step = on ? Math.max(0, Math.sin(dv * 7.4 * 2)) * 0.012 * Math.min(1, Math.abs(S.speed)) : 0;
    L.sqV += (((on ? 0.045 : 0) + step - L.sq) * 150 - L.sqV * 21) * dt; L.sq += L.sqV * dt;
    L.tilt = damp(L.tilt, on ? clamp(along / L.half.x, -1, 1) * -0.035 : 0, on ? 9 : 5, dt);
    if (L.state === 'locked' || Math.abs(L.sq) > 0.001) {
      const q = L.state === 'locked' ? L.sq : 0;
      L.mesh.scale.set(1 + q * 0.5, 1 - q, 1 + q * 0.5); L.mesh.position.y -= L.half.y * q; if (L.state === 'locked') L.mesh.rotateZ(L.tilt);
      if (on) robot.root.position.y += -2 * L.half.y * q + L.tilt * along;
    } else L.mesh.scale.setScalar(1);
  });
  S.wasAir = R.air >= 0;

  { const gu = clamp((S.d - (M.plinthEnd + 0.3)) / 1.6, 0, 1), gs = (gu <= 0 ? 0 : backOut(gu)) * (1 - smooth(S.d, M.gate + 0.9, M.gate + 1.6));      // the colours gate comes up once it has left the stand, and goes again once it is through
    gate.visible = gs > 0.002; gate.scale.setScalar(Math.max(gs, 0.001)); }
  { const nv = S.d > M.gate - 3 && S.d < M.famEnd ? 3 : S.stop === 'details' ? 2 : S.stop === 'talks' || (S.exact >= M.famEnd && S.exact < M.morning + 0.6) ? 1 : S.stop === 'sees' ? 0 : -1; if (nv !== S.nav) { S.nav = nv; navA.forEach((a, i) => a.classList.toggle('is-on', i === nv)); navB.forEach((a, i) => a.classList.toggle('is-on', i === nv)); } }      // the nav shows which of its four places you are in
  { const eveOn = S.d > M.talkEnd - 1 && S.d < M.lip; if (eveOn !== S.eveOn) { S.eveOn = eveOn; wallB.g.visible = dock.visible = eveOn; } }      // the wall of the evening and the dock at its end are simply there, as a place, from the specs on. They never pop up: you come to them.
  // the world pops up just ahead
  for (const p of pops) {
    const e0 = clamp((S.d - p.d) / p.span, 0, 1); if (e0 === p.e) continue; p.e = e0;
    const e = e0 <= 0 ? 0 : backOut(e0);
    p.obj.visible = e0 > 0; p.obj.scale.setScalar(Math.max(e, 0.001));
    if (p.homeY !== null && !p.obj.userData.letter) p.obj.position.y = p.homeY * e;
  }
  { const fk2 = 1 - smooth(S.d, M.famEnd + 0.3, M.famEnd + 1.1); if (fk2 < 1 && S.d > M.plinthEnd + 3) { for (const f of family) { f.r.root.visible = fk2 > 0.01; f.r.root.scale.setScalar(Math.max(0.001, fk2)); } shelf.visible = fk2 > 0.01; shelf.scale.setScalar(Math.max(0.001, fk2)); } }      // the others and their shelf are put away once it has gone on to the price
  // what it says
  const spH = smooth(S.d, M.landed - 1.8, M.landed - 1.2) * (1 - smooth(S.d, M.helloEnd - 1.3, M.helloEnd - 0.9));      // "Hi, I'm Mosey.": up while it waves and for the whole hold after, gone just before it turns to go
  const sp = smooth(S.d, M.talk - 0.6, M.talk + 0.2) * (1 - smooth(S.d, M.talkEnd - 0.9, M.talkEnd - 0.15));
  speech.m.visible = sp > 0.01 || spH > 0.01;
  if (spH > 0.01) {
    if (!S.hi) { S.hi = true; S.hiT = T; }
    const mobS = tall(); speech.m.position.set(R.pos.x + (mobS ? 0.63 : 1.22), (mobS ? 1.5 : 1.02) + Math.sin(T * 1.4) * 0.012, R.pos.z + 0.25); speech.m.quaternion.copy(camera.quaternion); speech.m.scale.setScalar(backOut(Math.min(1, spH)) * (mobS ? 0.5 : 0.6));
    if (S.tick % 2 === 0) speech.paint(HELLO, Math.max(0, Math.floor((T - S.hiT - 0.25) * 30)), T, 1);
  } else if (speech.m.visible) {
    S.hi = false;
    const auto = clamp(Math.floor((S.d - M.talk) / (8 / 3)), 0, 2), qi = T - S.qPickT < 9 ? S.qPick : auto;
    if (qi !== S.q) { S.q = qi; S.qT = T; asks.forEach((b, i) => b.classList.toggle('is-on', i === qi)); }
    const mobS = tall(); speech.m.position.set(R.pos.x + (mobS ? 0.15 : 1.5), (mobS ? 1.64 : 1.5) + Math.sin(T * 1.4) * 0.025, R.pos.z + 0.3); speech.m.quaternion.copy(camera.quaternion); speech.m.scale.setScalar(backOut(Math.min(1, sp)) * (mobS ? 0.68 : 1));      // on a phone: a little smaller and lower, so the question sits under the top bar and not behind it
    if (S.tick % 2 === 0) speech.paint(QA[S.q], Math.max(0, Math.floor((T - S.qT - 0.2) * 64)), T);
  } else S.hi = false;
  if (home.visible) { homeKit.catBody.scale.y = 0.9 + Math.sin(T * 1.6) * 0.035; if (homeKit.update) homeKit.update(T); }      // the cat breathes
  const pkk = S.d > M.sofa - 1.5 && S.d < M.sofaEnd + 3 ? (T * 0.8) % 1 : -1;
  ping.visible = pkk >= 0; if (pkk >= 0) { ping.scale.setScalar(0.3 + pkk * 1.2); ping.material.opacity = (1 - pkk) * 0.9; }
  keyObj.rotation.y = 0.6 + (S.found ? Math.sin(T * 9) * 0.05 : 0);
  { // charging: the dock's ring fills, rings pulse from its antenna, and a chip beside it says how full it is
    const charging = an === 'nap', byScroll = lerp(0.18, 1, smooth(S.d, M.nap + 0.3, M.napEnd - 0.5)); S.tick2 = charging ? Math.min(1, (S.tick2 ?? 0.18) + dt * 0.012) : S.d < M.nap ? 0.18 : S.tick2 ?? 0.18;      // the number follows the scroll through the stop, and never stands still while he is on the dock: it also ticks up by itself, slowly
    const level = S.d < M.nap ? 0.18 : Math.max(byScroll, S.tick2);
    if (dock.visible) dockKit.update(T, level, charging);
    const pk = charging ? smooth(R.act.t, 0.1, 0.28) * (1 - smooth(R.act.t, 0.9, 1)) : 0;
    if (pk > 0.01) robot.tipWorld(pulse.group.position); pulse.update(T, pk, camera);
  }

  // its projector: the film and the photos on the wall at home, in the evening
  const projB = smooth(S.d, M.photo - 0.6, M.photo + 0.6) * (1 - smooth(S.d, M.photoEnd - 0.2, M.photoEnd + 1));
  { // the film runs in its own time while the wall is showing it
    const want = wallB.g.visible && projB > 0.5 && S.slot === 0 ? 'B' : null;
    if (want !== filmS.where) { filmS.where = want; filmS.t = 0;
      if (want) { try { filmVid.currentTime = 0; } catch (e) {} filmVid.loop = true; filmVid.muted = !filmS.sound || !sfx.live() || sfx.off; filmVid.play().catch(() => { filmVid.muted = true; filmVid.play().catch(() => {}); }); }
      else filmVid.pause(); }
    if (want) filmS.t += dt;
  }
  if (wallB.g.visible) {
    let auto = 0; while (auto < WALL_AT.length && S.d - M.photo >= WALL_AT[auto]) auto++;      // the evening on the wall: the film first and longest, then its photos, homework, the reminders, a call, and the stars last, when the lights are already out
    const slot = T - S.pickT < 7 ? S.pick : auto;                                             // a tap on a key of the card jumps to that screen and holds it for seven seconds
    if (slot !== S.slot) { S.slot = slot; thumbs.forEach((b, i) => b.classList.toggle('is-on', i === slot)); }
    wallB.mat.opacity = projB; wallB.spill(projB); if (S.tick % 2 === 0 && projB > 0) wallB.paint(slot, T);
    wallLamp.material.opacity = 0.2 + 0.8 * Math.max(N, dim);                                      // by day the wall lamp hardly shows on the wall, in the dark it glows
  }
  beam.visible = motes.pts.visible = projB > 0.02;                                                                     // from outside you see the light it throws. From inside its head you are the light.
  if (beam.visible) {
    const pa = beam.geometry.attributes.position; robot.lensWorld(lens); pa.setXYZ(0, lens.x, lens.y, lens.z);
    const cs = wallB.corners(), lit = 0.14 + 0.86 * wallB.lit; [0.25, 0.6, 1].forEach((f, r) => cs.forEach((c, i) => pa.setXYZ(1 + r * 4 + i, lerp(lens.x, c.x, f), lerp(lens.y, c.y, f), lerp(lens.z, c.z, f)))); pa.needsUpdate = true;
    beam.material.opacity = projB * lit * (0.17 + Math.sin(T * 13) * 0.007); motes.move(lens, cs, T, projB * lit);      // a dark picture throws less light
  }

  // 5. the camera: close, always moving, leaning in when you stop
  let fov = camAt(S.play ? dv : S.d);      // on the title the camera follows where he really is, not where the scroll says he should be
  S.close = damp(S.close, S.idleFor > 0.7 ? 1 : 0, S.idleFor > 0.7 ? 0.9 : 3, dt);
  camOff.multiplyScalar(lerp((1 - 0.1 * S.close) * (1 + clamp(Math.abs(S.speed) / 16, 0, 0.14)), 1, camStill));
  const follow = first || reduceMotion ? 1 : 1 - Math.exp(-7 * dt);
  if (pov || anchor.distanceToSquared(R.pos) > 144) anchor.copy(R.pos);      // its body was moved unseen (into the model on the first walk, into the room at SEES): the point the camera follows goes with it at once, it does not travel there
  anchor.x += (R.pos.x - anchor.x) * follow; anchor.z += (R.pos.z - anchor.z) * follow;
  anchor.y += (R.pos.y - anchor.y) * (first ? 1 : 1 - Math.exp(-(R.how === 'fall' || (dv > M.peer && dv < M.scan + 1.5) ? 9 : R.air >= 0 || R.how === 'float' ? 4.5 : 3.2) * dt));      // down off the E the camera drops with him, so he is never under the picture
  camPos.copy(anchor).add(camOff); look.copy(anchor).add(camLook);
  if (camHold.k > 0) { camPos.lerp(camHold.C, camHold.k); look.lerp(camHold.T, camHold.k); }      // a shot that stands still in the world (the strike)
  if (!reduceMotion) { camPos.x += Math.sin(T * 0.7) * 0.03; camPos.y += Math.sin(T * 0.9 + 1) * 0.022; }
  if (pointer.has && !coarse && !drag) { camPos.x += pointer.x * 0.16; camPos.y += pointer.y * 0.09; }
  if (S.kick > 0.01) { S.kick *= Math.exp(-7 * dt); if (!reduceMotion) { camPos.y += Math.sin(T * 61) * 0.055 * S.kick; camPos.x += Math.sin(T * 47 + 1) * 0.04 * S.kick; } }      // a hit kicks the camera a few centimetres, and it dies away at once
  if (S.d <= M.lip) camPos.y = Math.max(camPos.y, 0.14);
  const endK = smooth(S.d, M.land - 1.7, M.land - 0.1);                                            // the last shot: pull back until the words and the button fit
  if (endK > 0) {
    const mob2 = tall(), f2 = mob2 ? 52 : 34, th = Math.tan(THREE.MathUtils.degToRad(f2 / 2));
    const r = Math.max(endBox.w * (mob2 ? 1.18 : 1.12) / (2 * th * camera.aspect), 5.2 / (2 * th));                   // closer on the landing: the words just fit
    _a.set(endBox.cx + (mob2 ? 0 : 1.0), endBox.cy + 4.4 + r * 0.16, EZ + r); _b.set(endBox.cx, endBox.cy + (mob2 ? -0.9 - r * 0.14 : 0.5), EZ + 1.8);      // the words sit below the nav, whole
    camPos.lerp(_a, endK); look.lerp(_b, endK); fov = lerp(fov, f2, endK);
    const inK = smooth(S.d, M.land + 0.5, M.land + 3.2);                                           // once the words have gone, come in close: the robot on its button
    if (inK > 0) { _a.set(BTN.x + (mob2 ? 0.2 : 0.8), FY + (mob2 ? 3.6 : 2.7), BTN.z + (mob2 ? 8.8 : 6.4)); _b.set(BTN.x, FY + (mob2 ? 0.9 : 1.05), BTN.z);      // far enough back, and aimed low enough, that the whole button and the robot on it sit between the bar and the card      // close: the robot is the picture, standing on the word it wants you to press
      camPos.lerp(_a, inK); look.lerp(_b, inK); fov = lerp(fov, mob2 ? 50 : 30, inK); }
  }
  { const tt = S.landT ? T - S.landT : 9, on = tt < 0.7; if (on !== landDust.visible) landDust.visible = on; if (on) { const e = 1 - Math.pow(1 - tt / 0.7, 2); landDust.scale.setScalar(0.6 + 3.2 * e); landDust.material.opacity = 0.45 * (1 - tt / 0.7); } }
  if (headK > 0) {                                                                                 // into its head, in its head, and out of it again (see headK above)
    const mobP = tall(), q = scanTour.at(dv), stay = dv > M.stoveEnd ? headK : 1;
    scanTour.eye(dv, _a, _b); _a.x += Math.sin(dv * 3.7) * 0.02 * headK; _a.y = 0.8 + Math.abs(Math.sin(dv * 5.2)) * 0.03 * headK; _b.y = 0.95;      // its eye, 14 cm off the floor, and a point a few steps on along its way
    _v.subVectors(_b, _a).setY(0).normalize(); const rx = -_v.z, rz = _v.x;                         // which way is ahead, and which is right, as it sees it
    for (const L of homeKit.looks) if (L.room === q.i) { const w = L.w * Math.max(0, 1 - Math.abs((q.e - L.at) / L.span)); if (w > 0) _b.lerp(lens.set(HX + L.p[0], L.p[1], HZ + L.p[2]), w * w * (3 - 2 * w)); }      // its eye goes to what matters in each room
    { let best = null, bd = 1e9; for (const t of SEEN) { if (t.room !== q.i || t.name === 'Stove') continue; const ahead = (t.p.x - _a.x) * _v.x + (t.p.z - _a.z) * _v.z, dd = t.p.distanceTo(_a); if (ahead > -0.6 && dd < bd) { bd = dd; best = t; } }
      if (best) _b.lerp(best.p, (1 - smooth(bd, 4, 11)) * 0.8); }                                  // and to the nearest thing it knows
    { const sk = smooth(dv, M.stove - 4.5, M.stove - 1) * stay; if (sk > 0) _b.lerp(lens.set(HX + 4.2, 4.4, Z.stove - 1.0), sk); }      // at the stove it looks up and round at the whole thing
    { const sway = (reduceMotion ? 0 : Math.sin(T * 0.5) * 0.5) + (pointer.has && !coarse ? pointer.x * 1.6 : 0); _b.x += rx * sway; _b.z += rz * sway; if (pointer.has && !coarse) _b.y += pointer.y * 0.9; }      // it looks about a little, and so can you
    if (!S.povInit) { S.povInit = true; povLook.copy(_b); }
    povLook.lerp(_b, 1 - Math.exp(-3.2 * dt));
    HEAD_PATH.getPoint(headK, lens); _a.add(lens).sub(HEAD_END); _a.y += R.pos.y * (1 - smooth(headK, HEAD_IN, 1));      // where the camera is on its way over his head, measured from his eye. While his body is still drawn the way goes up with him (he is on the mat and the sill at his front door then), so it goes through his head where it always did
    camPos.lerp(_a, smooth(headK, 0, 0.3)); look.lerp(povLook, headK); fov = lerp(fov, mobP ? 84 : 66, headK);
    const under = headK * (Math.abs(camPos.x - HX) < 4.5 ? 1 : 0) * smooth(-camPos.z, -Z.sofa - 3.6, -Z.sofa - 2.6) * (1 - smooth(-camPos.z, -Z.sofa + 2.6, -Z.sofa + 3.6));      // under the sofa it is dark, and its own lamp comes on
    hemi.intensity *= 1 - under * 0.8; scene.environmentIntensity *= 1 - under * 0.8; povLamp.intensity = under * 8; povLamp.position.copy(camPos);
    povLamp.distance = 9;
  } else { S.povInit = false;
    // Out of doors, in the dusk and the dark, the same small lamp stands behind him and above, on the far side from the camera: a warm rim, so a dark robot keeps its edge and its brass against a dark wall.
    const nk = Math.max(N, dim); if (nk > 0.02) { let rx = R.pos.x - camPos.x, rz = R.pos.z - camPos.z; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl; povLamp.distance = 3.6; povLamp.intensity = 11 * nk; povLamp.position.set(robot.root.position.x + rx * 0.95 - rz * 0.55, robot.root.position.y + 1.75, robot.root.position.z + rz * 0.95 + rx * 0.55); } else povLamp.intensity = 0; }
  // Indoors the light is the window's. The page's fill lights have no shadows and would light every room evenly through its walls, so they are turned well down,
  // and the sun is turned up a little: what comes in at a window or a door is then the brightest thing in the room, and the corners fall off.
  if (inside > 0) { hemi.intensity *= lerp(1, IN.hemi, inside); rim.intensity *= lerp(1, IN.rim, inside); sun.intensity *= lerp(1, IN.sun, inside); scene.environmentIntensity *= lerp(1, IN.env, inside); }
  camera.position.copy(camPos); camera.lookAt(look);
  camera.fov = fov;
  const live = copies.find((c) => c.on && c.side !== 'none'), side = live ? live.side : 'none', mob = tall();
  S.shiftX = damp(S.shiftX, mob ? 0 : side === 'left' ? 0.1 : side === 'right' ? -0.1 : 0, 2.6, dt);
  S.shiftY = damp(S.shiftY, mob && live ? (live.el.classList.contains('hero') ? 0.2 : 0.23) : 0, 2.6, dt);
  camera.setViewOffset(innerWidth, innerHeight, -S.shiftX * innerWidth, S.shiftY * innerHeight, innerWidth, innerHeight);
  if (inside > 0.5) { _a.set(camPos.x, 0, camPos.z); sun.target.position.copy(_a); sun.position.copy(_a).add(SUN_OFF); } else { sun.target.position.copy(anchor); sun.position.copy(anchor).add(SUN_OFF); }      // on the first walk the sun's shadow box follows its eye, not its body, which is elsewhere
  rim.target.position.copy(anchor); rim.position.copy(anchor).add(RIM_OFF);
  const reach = camHold.k > 0 ? camPos.distanceTo(anchor) : camOff.length(); scene.fog.near = reach * 1.15 + 4; scene.fog.far = reach + 26;
  const blueK = 0, deepK = smooth(S.d, M.edge + 0.5, M.lip0 - 0.5);      // (the sky used to turn a saturated blue over the edge, which was too blue. The fall and the end stay on the paper tone, a shade deeper and warmer below, which is the height)
  { const nk = Math.max(N, dim); if (nk < 0.5) scene.background.lerpColors(SKY, DUSK, nk * 2); else scene.background.lerpColors(DUSK, NIGHT, nk * 2 - 1); }      // day goes to night through a warm dusk, not through grey
  scene.background.lerp(DEEP_PAPER, deepK * 0.6); scene.fog.color.copy(scene.background);
  if (S.d > M.lip) { scene.fog.near = 30; scene.fog.far = 120; }
  { const hk = smooth(dv, M.gap, M.gap + 2) * (1 - smooth(dv, AWAY - 1, AWAY + 2)); if (hk > 0) { scene.fog.near += 16 * hk; scene.fog.far += 60 * hk; } }      // its home is a big thing: around it the haze starts further off, so the far end of a wall is not lost in it
  if (inside > 0) { scene.fog.near = lerp(scene.fog.near, IN.fog[0], inside); scene.fog.far = lerp(scene.fog.far, IN.fog[1], inside); }      // and in the rooms you see wall to wall
  { const sb = homeOn ? lerp(26, 30, inside) : 13; if (sb !== S.shBox) { S.shBox = sb; const c = sun.shadow.camera; c.left = c.bottom = -sb; c.right = c.top = sb; c.updateProjectionMatrix(); } }      // the sun's shadows reach 13 units round him on the page. Round his home they reach further: a ceiling outside that reach let the sun straight through, and the far end of every room was in full sun
  if (S.late !== (S.d > M.edge)) { S.late = S.d > M.edge; price.forEach((L) => { L.mesh.castShadow = !S.late; }); }

  // 6. the page copy
  { const ah = dv > M.gap + 3.0 && dv < M.door + 1.5 && headK < 0.97; if (ah !== S.atHouse) { S.atHouse = ah; document.body.classList.toggle('at-house', ah); } }      // the dark front of his home fills the top of the picture: the pale band behind the menu is taken away and the menu goes light (css)
  const cardD = S.play ? Math.min(S.exact, dv + 0.6) : S.exact;      // on the title he can be behind the scroll (the hops are a queue): the cards wait for him
  for (const c of copies) { const on = cardD >= c.d0 && cardD <= c.d1; if (on !== c.on) { c.on = on; c.el.classList.toggle('is-on', on); } }
  hint.classList.toggle('is-off', S.exact < M.landed - 1.6 || S.exact > M.landed + 2);          // "scroll to walk" shows once it is out of the box and waiting for you
  { const pr = (S.exact / route.total * 100).toFixed(2); if (pr !== S.rail) { S.rail = pr; railfill.style.width = `calc(${pr}% - 2px)`; railbot.style.left = pr + '%'; if (!reduceMotion) seal.style.setProperty('--turn', (S.exact * 9).toFixed(1) + 'deg');      /* the seal's ring turns with the walk */ for (const k of railticks) { const dn = S.exact > k.a; if (dn !== k.done) { k.done = dn; k.el.classList.toggle('is-done', dn); } } }
    const mv = Math.abs(S.speed) > 0.6; if (mv !== S.railMv) { S.railMv = mv; railbot.classList.toggle('is-moving', mv); } }
  document.body.classList.toggle('sky-blue', blueK > 0.5); document.body.classList.toggle('at-end', S.d > M.lip + 0.4); document.body.classList.toggle('night', Math.max(N, dim) > 0.5); document.body.classList.toggle('proj', dim > 0.5);

  heroBack?.update(dt, { T, d: S.d, pointer: pointer.has && !coarse ? pointer : null, night: S.night || 0, now });
  letterFx?.frame(S.night || 0);
  window.__heroFx?.frame?.(look);      // the intro's rain and freeze get the last word on the camera (js/hero-fx.js)
  if (window.__feetCam) { const f = window.__feetCam, p = robot.root.position, s = f.side ?? 1.2, a = f.along ?? 0; robot.root.visible = true; camera.position.set(p.x + R.dir.z * s + R.dir.x * a, p.y + (f.up ?? 0.1), p.z - R.dir.x * s + R.dir.z * a); camera.lookAt(p.x, p.y + (f.at ?? 0.1), p.z); }      // a check for the build only, the page never sets it: the camera goes side-on to his feet, close, so a still shows whether they are on the ground
  renderer.render(scene, camera);
  // The menu over the rooms of his home. Through his eye the menu is white, which is right over rooms that are still dark and wrong over a pale wall. So the
  // picture itself is asked: three times a second one row of it, under the menu's words, is read back and its brightness decides (ink over light, white over
  // dark), with a wide gap between the two thresholds so it does not flicker. Only inside his home. Everywhere else the menu keeps its own rules.
  { const inHome = pov || inside > 0.6; if (inHome && T - (S.navT2 || 0) > 0.33) { S.navT2 = T; const gl = renderer.getContext(), cw = gl.drawingBufferWidth, ch = gl.drawingBufferHeight, bar = document.querySelector('.bar'), by = bar ? bar.getBoundingClientRect() : null;
      const w = Math.floor(cw * 0.5), buf = S.navBuf && S.navBuf.length === w * 4 ? S.navBuf : (S.navBuf = new Uint8Array(w * 4)), row = Math.round(ch * (1 - (by ? (by.top + by.height * 0.5) / innerHeight : 0.07)));
      gl.readPixels(Math.floor(cw * 0.25), clamp(row, 0, ch - 1), w, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf); let sum = 0; for (let i = 0; i < buf.length; i += 16) sum += buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11; const lum = sum / (buf.length / 16) / 255;
      const ink = S.navInk ? lum > 0.42 : lum > 0.6; if (ink !== S.navInk) { S.navInk = ink; document.body.classList.toggle('nav-ink', ink); } }
    else if (!inHome && S.navInk) { S.navInk = false; document.body.classList.remove('nav-ink'); } }

  { // what its view shows on top of the picture: the counter, the labels of the pins, the small map
    const W2 = innerWidth, H2 = innerHeight, q = scanTour.at(dv), rooms = scanTour.rooms, done = dv >= scanTour.doneAt; let shown = 0;
    const chipOn = pov && dv > M.door + 1.4 && dv < M.stove + 0.9; if (chipOn !== S.chipOn) { S.chipOn = chipOn; chip.classList.toggle('is-on', chipOn); }      // it steps aside when the picture pulls back on to your phone
    if (chipOn) { const m2 = done ? 62 : Math.min(61, Math.round(rooms.slice(0, q.i).reduce((n, r) => n + r.area, 0) + rooms[q.i].area * q.e)), tag = done ? 'Map saved · 5 rooms' : 'Mapping · ' + rooms[q.i].name;
      if (m2 !== S.chipM2 || tag !== S.chipTag) { S.chipM2 = m2; S.chipTag = tag; chipCount.textContent = `${m2} m²`; chipLabel.textContent = tag; chip.classList.toggle('done', done); } }
    for (const pn of scanPins) { let ok = pov && pn.on && (pn.room === q.i || pn.room === q.i - 1) && shown < 2;
      if (ok) { _v.copy(pn.top).project(camera); const x = (_v.x * 0.5 + 0.5) * W2, y = (-_v.y * 0.5 + 0.5) * H2, dd = pn.top.distanceTo(camera.position); ok = _v.z < 1 && dd < 26 && x > W2 * 0.1 && x < W2 * (tall() ? 0.62 : 0.8) && y > H2 * (tall() ? 0.36 : 0.27) && y < H2 * 0.7;      // a label only where it has room: clear of the counter and the small map above, the caption below
        if (ok) { shown++; pn.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; } }
      if (ok !== pn.shown) { pn.shown = ok; pn.el.classList.toggle('is-on', ok); } }
    if (headK > 0.9) miniMap(q.i, scanTour.reach, done, camera.position.x - HX, camera.position.z - HZ);
    const hudOn = headK > 0.97; if (hudOn !== S.hudOn) { S.hudOn = hudOn; hud.classList.toggle('is-on', hudOn); }
    if (done !== S.hudDone) { S.hudDone = done; hudA.textContent = done ? '● Mosey vision' : '● Mapping'; }
  }
  // The callouts of the specs stop. Three tags stand in a column left of him and three in a column to his right, and they keep those places.
  // - The columns stand clear of him: his reach from the line he turns about is measured on his own skin (see reach), and each column's inner edge is that far
  //   out on screen plus a small margin (28 px in a window 1440 wide). They go with him when the picture shifts for the card.
  // - Each tag stands at the screen height of the part it names, so its leader is one straight, nearly level line from the tag to a dot on the part.
  // - A part on the far half of him, or turned away, gets no line through him: its line and dot fade and its tag dims in its place.
  // - His height is not a dot on his head. It is a measuring line beside him, floor to the top of his head, with the tag on it.
  // On a phone the same rules hold. There is room beside him only for the names, so the second line of each tag is left out there, and two are up at a time.
  { const up = S.plOn && S.exact <= M.plinthEnd - 0.4, since = T - S.wakeT, mobC = tall(), turnC = Math.floor(since / 3.4) % 3, rp = robot.root.position, key = innerWidth + 'x' + innerHeight + mobC, W2 = innerWidth, H2 = innerHeight, L = calloutLay;
    const scr = (v) => { v.project(camera); v.x = (v.x * 0.5 + 0.5) * W2; v.y = (-v.y * 0.5 + 0.5) * H2; return v; };
    let ext = 0, mx = 0, yTop = 0, yBot = 0;
    if (up) { const cxs = scr(_v.set(rp.x, rp.y + 0.6, rp.z)).x; S.cxs = cxs;
      for (const c of callouts) { if (c.part === 'antenna') robot.tipWorld(c.p); else if (c.part === 'lens') robot.lensWorld(c.p); else robot.root.localToWorld(c.p.set(c.a[0], c.a[1], c.a[2])); scr(_v.copy(c.p)); c.sx = _v.x; c.sy = _v.y; }
      if (L.key !== key || T - L.mT > 0.7) { const R = L.reach(); L.R = L.key === key ? Math.max(L.R, R) : R; L.mT = T; }      // his reach, read again now and then while he is up, and the widest kept (his arm moves)
      { const tc = _a.subVectors(camera.position, rp).setY(0).normalize(), rt = _b.set(tc.z, 0, -tc.x); ext = Math.abs(scr(_v.set(rp.x, rp.y + 0.6, rp.z).addScaledVector(tc, L.R).addScaledVector(rt, L.R)).x - cxs); }      // that reach on screen, at its nearest to the camera
      yBot = scr(_v.copy(rp)).y; yTop = scr(robot.root.localToWorld(_v.set(0, robot.headTop, 0))).y;
      const margin = mobC ? 8 : Math.max(16, 28 * W2 / 1440), wR = Math.max(...callouts.filter((c) => c.i % 2).map((c) => c.el.offsetWidth)), wL = Math.max(...callouts.filter((c) => c.i % 2 === 0).map((c) => c.el.offsetWidth));
      const xL = Math.max(wL + 6, cxs - ext - margin), xR = Math.max(cxs + ext * 0.6, Math.min(cxs + ext + margin, (mobC ? W2 - 6 : W2 * 0.73) - wR)); mx = xL + margin * 0.58;
      const fresh = L.key !== key; if (fresh) { L.key = key; callouts.forEach((c) => { const left = c.i % 2 === 0; c.fixL = left; c.lead = left ? 1 : -1; c.el.dataset.dir = left ? 'l' : 'r'; }); }
      // the heights: each tag at the height of its part. A part hardly changes height as he turns, so a tag only follows when its part has really moved (the camera
      // settling, the picture shifting for the card), and then slowly. Two on one side are kept apart by the least that stops them touching.
      { callouts.forEach((c) => { const want = c.i === 0 ? yTop + (yBot - yTop) * 0.24 : c.sy; if (fresh || c.fy === undefined || since < 0.5) c.fy = want; else { if (Math.abs(want - c.fy) > 12) c.go = true; else if (Math.abs(want - c.fy) < 1.5) c.go = false; if (c.go) c.fy = damp(c.fy, want, 5, dt); } });
        for (const side of [0, 1]) { const col = callouts.filter((c) => c.i % 2 === side).sort((a, b) => a.fy - b.fy), need = col[0].el.offsetHeight + 10;
          for (let n = 0; n < 6; n++) for (let i = 1; i < col.length; i++) { const lack = need - (col[i].fy - col[i - 1].fy); if (lack > 0) { col[i - 1].fy -= lack / 2; col[i].fy += lack / 2; } } } }
      for (const c of callouts) { const fx = c.fixL ? xL : xR; if (Math.abs(fx - (c.fx ?? -9)) > 0.3 || Math.abs((c.fyS ?? -9) - c.fy) > 0.3) { c.fx = fx; c.fyS = c.fy; c.el.style.transform = `translate(${fx.toFixed(1)}px, ${c.fy.toFixed(1)}px) translate(${c.fixL ? '-100%' : '0'}, -50%)`; }
        c.ex = c.fx; } }      // ex: the edge of the tag its leader leaves from
    for (const c of callouts) { const on = up && since > 0.5 + c.i * 0.26 && (!mobC || Math.floor(c.i / 2) === turnC); let see = 0;
      if (on && c.i === 0) see = 1;      // the height: always there, it is not a part that turns away
      else if (on) { const nx = c.p.x - rp.x, nz = c.p.z - rp.z, nl = Math.hypot(nx, nz), tx = camera.position.x - c.p.x, tz = camera.position.z - c.p.z, tl = Math.hypot(tx, tz) || 1, face = nl > 0.07 ? (nx * tx + nz * tz) / (nl * tl) : 1;
        const side = c.fixL ? c.sx < S.cxs + (nl < 0.14 ? 60 : 4) : c.sx > S.cxs - (nl < 0.14 ? 60 : 4); c.vis = side && face > (c.vis ? -0.2 : 0.02); see = c.vis ? 1 : 0; }      // a little slack before it goes and before it comes back, so it does not flicker at the edge
      c.k = damp(c.k ?? 0, see, 9, dt); if (on !== c.on) { c.on = on; c.el.classList.toggle('is-on', on); } const dim = on && c.k < 0.5; if (dim !== c.dim) { c.dim = dim; c.el.classList.toggle('is-dim', dim); }
      const ln = L.lines[c.i], dot = L.dots[c.i], show = on && c.k > 0.02; ln.style.opacity = show ? c.k.toFixed(2) : '0'; dot.style.opacity = show && c.i ? c.k.toFixed(2) : '0';
      if (c.i === 0) { L.measure.style.opacity = on ? '1' : '0'; if (on) { L.measure.setAttribute('d', `M${(mx - 5).toFixed(1)},${yTop.toFixed(1)} h10 M${mx.toFixed(1)},${yTop.toFixed(1)} V${yBot.toFixed(1)} M${(mx - 5).toFixed(1)},${yBot.toFixed(1)} h10`);
          ln.setAttribute('points', `${(c.ex + c.lead * 3).toFixed(1)},${c.fy.toFixed(1)} ${mx.toFixed(1)},${c.fy.toFixed(1)}`); } }
      else if (show) { ln.setAttribute('points', `${(c.ex + c.lead * 5).toFixed(1)},${c.fy.toFixed(1)} ${c.sx.toFixed(1)},${c.sy.toFixed(1)}`); dot.setAttribute('cx', c.sx.toFixed(1)); dot.setAttribute('cy', c.sy.toFixed(1)); } }
    if (!up && L.measure.style.opacity !== '0') L.measure.style.opacity = '0'; }
  // what the lens shows: tags that lock on to what it recognises
  if (pov) { const lit = scanTour.reach; S.nearSeen = 1e9; for (const t of SEEN) { t.vis = lit[t.room] > t.far + 1; if (!t.vis) continue; _v.copy(t.p).project(camera); if (_v.z < 1 && Math.abs(_v.x) < 1.02 && Math.abs(_v.y) < 1.02) S.nearSeen = Math.min(S.nearSeen, t.p.distanceTo(camera.position)); } }      // one thing at a time: only the nearest one in view gets brackets, plus any it has already locked on to
  if (pov) for (const t of SEEN) {
    _v.copy(t.p).project(camera); const dd = t.p.distanceTo(camera.position), on = t.vis && _v.z < 1 && dd < 13 && Math.abs(_v.x) < 1.02 && Math.abs(_v.y) < 1.02;
    const lk = on && dd < (t.name === 'Stove' ? 11.5 : 7.5) && dv < M.stoveEnd; t.el.classList.toggle('is-on', on && (lk || dd < S.nearSeen + 0.01)); t.el.classList.toggle('main', dd < S.nearSeen + 0.01); t.el.classList.toggle('lock', lk); t.el.classList.toggle('flip', _v.x > (tall() ? -0.2 : 0.2));
    if (lk && !t.lk) t.lockT = T; t.lk = lk;
    if (!on) continue;
    t.el.style.transform = `translate(${((_v.x * 0.5 + 0.5) * innerWidth).toFixed(1)}px, ${((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(1)}px)`;
    if (S.tick % 5 === 0) {                                                                         // the brackets grow as it gets nearer, with the distance under them in the robot's own centimetres
      const sz = Math.round(clamp(1300 / dd, 70, 230) / 10) * 10; if (sz !== t.sz) { t.sz = sz; t.el.style.setProperty('--s', sz + 'px'); }
      const cm = Math.round(dd * 12.2 / 5) * 5; if (cm !== t.cm) { t.cm = cm; t.dist.textContent = cm >= 100 ? (cm / 100).toFixed(1) + ' m' : cm + ' cm'; }
    }
    if (lk) { const c = Math.min(99 - (t.name.length % 4), Math.floor((T - t.lockT) * 150)); if (c !== t.c) { t.c = c; t.conf.textContent = `Match ${c}%`; } }
  }
  scanRing.visible = pov;
  if (pov) { const kk = (T * 0.42) % 1; scanRing.position.set(camera.position.x, 0.03, camera.position.z); scanRing.scale.setScalar(0.6 + kk * 13); scanRing.material.opacity = (1 - kk) * (1 - kk) * 0.55; }
  if (first) { first = false; boot.firstFrame = Math.round(performance.now()); document.getElementById('loading')?.classList.add('is-done'); setTimeout(warm, 400); setTimeout(wallMediaIn, 1200); setTimeout(photosIn, 9000); }
  if (boot.warmDone && !boot.shown && new URLSearchParams(location.search).has('boot')) { boot.shown = true; document.body.appendChild(Object.assign(document.createElement('pre'), { textContent: `world ${boot.world - boot.start} ms\nfirst frame ${boot.firstFrame - boot.start} ms\nwarm-up held the page ${boot.warmHeld} ms\nshaders ready ${boot.warmDone - boot.start} ms\nworst frame ${perf.worst.toFixed(0)} ms`, style: 'position:fixed;left:20px;top:80px;z-index:99;background:#000;color:#fff;font:600 22px/1.4 monospace;padding:14px 18px' })); }      // ?boot shows how long the page took to get ready
  if (!manual) requestAnimationFrame(frame);
}
// Right after the first frame: hand every material's shader to the graphics driver to build in the background.
// Without this each new kind of surface is built the first time it scrolls into view, and each one costs a stutter.
// (Drawing the whole world once up front did the same job but held the page for seven seconds.)
// ?warmtest draws each object of the home once on its own, off screen, and lists the slowest. For finding what stalls the first time the home shows.
function warmTest() {
  const rt = new THREE.WebGLRenderTarget(64, 64), cam = new THREE.PerspectiveCamera(70, 1, 0.1, 500), out = [], meshes = [];
  home.traverse((o) => { if (o.isMesh || o.isInstancedMesh || o.isLine || o.isPoints) meshes.push(o); });
  const top = scene.children.map((o) => [o, o.visible]); for (const [o] of top) if (!o.isLight && o !== home) o.visible = false;
  home.visible = true; for (const m of meshes) { m.userData.wv = m.visible; m.visible = false; m.userData.fc = m.frustumCulled; m.frustumCulled = false; }
  cam.position.set(SX, 30, -10); cam.lookAt(SX, 0, -38); renderer.setRenderTarget(rt);
  const gl = renderer.getContext(), px = new Uint8Array(4);
  for (const m of meshes) { m.visible = true; const t0 = performance.now(); renderer.render(scene, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const ms = performance.now() - t0; m.visible = false;
    const g = m.geometry, tris = Math.round((g.index ? g.index.count : g.attributes.position.count) / 3), mt = [].concat(m.material)[0], maps = ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'aoMap', 'alphaMap'].filter((n) => mt[n]).map((n) => `${n}:${mt[n].image?.width}`).join(' ');
    out.push([ms, `${ms.toFixed(0)} ms  ${m.name || m.parent?.name || mt.type}  tris ${tris}  ${m.isInstancedMesh ? 'x' + m.count : ''}  ${maps}`]); }
  renderer.setRenderTarget(null); for (const m of meshes) { m.visible = m.userData.wv; m.frustumCulled = m.userData.fc; } for (const [o, v] of top) o.visible = v; rt.dispose();
  out.sort((a, b) => b[0] - a[0]); const total = out.reduce((n, o) => n + o[0], 0);
  document.body.appendChild(Object.assign(document.createElement('pre'), { textContent: `home: ${meshes.length} objects, ${total.toFixed(0)} ms in all\n` + out.slice(0, 16).map((o) => o[1]).join('\n'), style: 'position:fixed;left:10px;top:70px;z-index:99;background:#000;color:#fff;font:600 15px/1.35 monospace;padding:12px 16px;max-width:1400px;white-space:pre-wrap' }));
}
// The photographs of real materials for the home (media/home) come in once the page is up and its shaders are built, never before the first picture.
// Until then the home wears its drawn textures, so nothing is ever bare. Each new texture is handed to the graphics card on a quiet moment, one at a time,
// so the first look at the home does not have to send them all at once.
let photosAsked = false;
function photosIn() {
  if (photosAsked) return; photosAsked = true; homeKit.loadPhotos();
  const sent = new Set(); let quiet = 0;
  const tick = () => { let one = null; home.traverse((o) => { if (one || !o.material) return; for (const m of [].concat(o.material)) for (const n of ['map', 'normalMap', 'bumpMap', 'roughnessMap']) { const t = m[n]; if (t && t.image && !sent.has(t.uuid + ':' + t.version)) { one = t; return; } } });
    if (one) { sent.add(one.uuid + ':' + one.version); quiet = 0; try { renderer.initTexture(one); } catch (e) {} } else quiet++;
    if (quiet < 60) setTimeout(tick, one ? 70 : 250); };
  setTimeout(tick, 600);
}
function warm() {
  try { const was = [], t0 = performance.now(); scene.traverse((o) => { was.push([o, o.visible]); o.visible = true; });
    const done = renderer.compileAsync(scene, camera); for (const [o, v] of was) o.visible = v;
    boot.warmHeld = Math.round(performance.now() - t0); done.then(() => { try { const rt = new THREE.WebGLRenderTarget(16, 16), keep = []; scene.traverse((o) => { if (o.isLight) return; keep.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; }); home.visible = false;      /* not the home: this picture is drawn into a texture, and that builds a second set of shaders, the ones the glass letters use for what is behind them. The home is never in a picture with a glass letter (see homeOn), and building that set for it held a first visit for seven seconds. It is drawn on the canvas instead, just below */ renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); for (const [o, v, f] of keep) { o.visible = v; o.frustumCulled = f; } rt.dispose(); } catch (e) { renderer.setRenderTarget(null); }      /* every mesh and texture goes to the graphics card now, behind the loader, and not as a stutter half way down the page */
      try { // The home is first seen in the middle of the walk, and the first real picture of it built its shaders for the canvas there and then: a stall of a second
        // on a first visit. So it is drawn once now, on the canvas, on its own, and the page's own picture is drawn over it before anyone sees it.
        const keep = scene.children.map((o) => [o, o.visible]), fc = []; for (const [o] of keep) if (!o.isLight && o !== home) o.visible = false; home.visible = true; home.traverse((o) => { fc.push([o, o.frustumCulled]); o.frustumCulled = false; });
        renderer.render(scene, camera); for (const [o, v] of keep) o.visible = v; for (const [o, f] of fc) o.frustumCulled = f; renderer.render(scene, camera); } catch (e) { /* the walk still works, with the stall */ }
      renderer.debug.checkShaderErrors = false;      /* every shader has been built and checked by now. Left on, the first real use of one later in the walk stops to ask the graphics card for its error log, which is a visible hitch on a slow phone */
      boot.warmDone = Math.round(performance.now()); setTimeout(photosIn, 300); if (new URLSearchParams(location.search).has('warmtest')) warmTest(); }).catch(() => {});
  } catch (e) { console.warn('warm-up skipped', e); }
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { last = performance.now(); requestAnimationFrame(frame); } });

// callable checks for the build, not shown on the page
window.__mosey = { talks, STRIKE, price, two, headline, topAt, GONE_AT,
  marks: M, total: route.total, scrollForD, scanTour, homeKit, hero: heroBack, geo: { X0, SX, HX, HZ, right: headline.right, gapA, gapB, H, BX, PZ, WCX, WALLZ }, state: S, boot, camera, robot, anchor, camOff, route, scene, renderer, world, drop, heroType, BX, sfx,
  yFor: (d) => scrollForD(typeof d === 'string' ? parseD(d) : d),
  goTo: (d) => scrollTo(0, scrollForD(typeof d === 'string' ? parseD(d) : d)),
  step: (n = 150) => { manual = true; for (let i = 0; i < n; i++) frame(last + 1000 / 60); manual = false; last = performance.now(); document.getElementById('loading')?.remove(); if (window.__introGate) window.__introGate.hold = false; return +S.d.toFixed(1); },   // run frames by hand, for checks while the tab is in the background
  perf: () => { const r = { fps: +(1000 / (perf.ms / perf.frames)).toFixed(1), worstMs: +perf.worst.toFixed(1), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, bodies: world.bodies.len(), dpr: DPR }; perf.frames = perf.ms = perf.worst = 0; return r; },
};
