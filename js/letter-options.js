// The big 3D words are glass, "cast glass".
//   glass   real cast glass: light passes through each letter and bends (transmission). The word's colour is the colour of the
//           glass itself, pale where it is thin and deep where it is thick. This is what a desktop gets.
//   soft    tinted see-through blocks with a lit edge and a hard shine, no bending. It needs no second picture of the scene,
//           so touch screens get this one.
// Both mirror a small studio of soft boxes that only the letters see, so a shiny edge has shapes to reflect, and both use a wider,
// rounder bevel than the plastic of before, because glass is cast and not cut.
// main.js calls createLetterLook(key, ...) once, apply(words) after every word exists, and frame(night) before each render.
// What real glass costs: the renderer draws the solid scene once more into a texture every frame the letters are on screen.
// That texture is drawn at half size here (HALF). Three r170 has no setting for it, so vendor/three.module.js carries one added factor.

const HALF = 0.5;

export function createLetterLook(key, { THREE, renderer, PAL }) {
  if (key !== 'glass' && key !== 'soft') return null;
  const C = (c) => new THREE.Color(c), q = new URLSearchParams(location.search);
  if (key === 'glass') renderer.transmissionResolutionScale = +(q.get('tres') || HALF);      // &tres=1 draws it at full size, to compare

  /* ---------- the studio only the letters see ---------- */
  const studio = (() => {
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), new THREE.MeshBasicMaterial({ color: 0x8a8f9c, side: THREE.BackSide })));
    const card = (w, h, x, y, z, rx, ry, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: C(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m); };
    card(14, 7, 0, 5.9, 0, Math.PI / 2, 0, '#fff6e8', 7);          // a big soft box overhead
    card(3, 9, -11.5, 1, 3, 0, Math.PI / 2, '#ffe2b8', 10);        // a warm strip on the left
    card(2, 9, 11.5, 1, -4, 0, -Math.PI / 2, '#cfe0ff', 8);        // a cool strip on the right
    card(9, 2.2, 0, 3.2, 11.5, 0, Math.PI, '#ffffff', 6);          // a long card behind the camera, it draws the line along each bevel
    card(24, 24, 0, -5.9, 0, -Math.PI / 2, 0, PAL.ground, 1.1);    // the page's own floor colour from below
    const pm = new THREE.PMREMGenerator(renderer), tex = pm.fromScene(s, 0.015).texture; pm.dispose();
    s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    return tex;
  })();

  /* ---------- one maker per look. role: 'face' (front and back), 'side' (walls and bevels), 'solid' (one material for all).
     kind: 'hero' (MEET MOSEY), 'headline' (GONE WALKING), 'lights', 'word' (TALKS, SEES, the price), 'name' (TOMATO and the others), 'end' ---------- */
  const lit = [];      // every material made here, with its day-time reflection strength, so night can turn the studio down
  const keep = (m, env) => { m.envMap = studio; m.envMapIntensity = env; lit.push([m, env]); return m; };
  const copyGlow = (m, src) => { if (src.emissive) { m.emissive.copy(src.emissive); m.emissiveIntensity = src.emissiveIntensity; } return m; };
  // a lit edge: where the surface turns away from the eye it picks up light, the way thick glass and resin do
  const edge = (m, tint, power, gain) => {
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uEdge = { value: C(tint) };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uEdge;')
        .replace('#include <opaque_fragment>', `float ndv = saturate(dot(normalize(normal), normalize(vViewPosition)));\noutgoingLight += uEdge * pow(1.0 - ndv, ${power.toFixed(1)}) * ${gain.toFixed(2)};\n#include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => `edge-${tint}-${power}-${gain}`; return m;
  };

  const MAKE = {
    // Real glass. The colour of the word is the colour light takes on inside the block (attenuation), so thin parts are pale and thick parts are deep.
    glass(src, role, kind) {
      const hero = kind === 'hero', end = kind === 'end', lamp = kind === 'lights', name = kind === 'name';
      // the intro is smoked black glass, the last words by the button are clear, LIGHTS is one warm block (a lamp, not a blue letter with a lit face)
      const tint = hero ? C(PAL.hero ?? '#2b2620') : end ? C('#eef3ff') : lamp ? C('#f2a531') : src.color.clone();      // a palette can give the intro its own glass (PAL.hero)
      const walked = kind === 'headline' && role === 'face';      // the faces of GONE WALKING change colour under his feet. The page drives their colour, so the glass itself is clear: blue glass under a yellow light came out olive in daylight
      const m = new THREE.MeshPhysicalMaterial({
        color: C('#ffffff'), transmission: 1, thickness: hero ? 0.45 : 1.0, ior: 1.5, roughness: lamp ? 0.14 : 0.05, metalness: 0,
        attenuationColor: walked ? C('#ffffff') : tint, attenuationDistance: hero ? (PAL.heroDist ?? 0.22) : end ? 4 : lamp ? 0.8 : name ? 0.7 : 1.25,
        specularIntensity: 1, clearcoat: 0, dispersion: 0.3,
      });
      copyGlow(m, src);
      if (lamp && role === 'face') m.emissive.set('#ffc45a').multiplyScalar(0.72);      // the page drives how bright each lamp is. Half as strong, or the glass burns out to a flat cream
      return keep(m, 1.4);      // the page recolours L.face.color (blue to yellow under his feet): on glass that tints the light passing through
    },
    // Soft glass, the light one: an ordinary see-through material. The depth is faked with a lit edge and a hard clear coat over a soft body.
    soft(src, role, kind) {
      const hero = kind === 'hero';
      const base = hero ? C(PAL.hero ?? '#1b1a1f') : kind === 'lights' ? C('#f2a531') : src.color.clone();      // LIGHTS is one warm block here too
      const m = new THREE.MeshPhysicalMaterial({ color: base, roughness: role === 'face' ? 0.42 : 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.1, ior: 1.5, specularIntensity: 1,
        transparent: true, opacity: hero ? 0.9 : kind === 'lights' ? 0.95 : role === 'face' ? 0.9 : 0.8, side: THREE.DoubleSide, depthWrite: true });      // dense enough to read on a small screen
      copyGlow(m, src); if (kind === 'lights' && role === 'face') m.emissive.set('#e8921c').multiplyScalar(0.3);
      edge(m, hero ? '#c9982e' : '#' + base.clone().lerp(C('#ffffff'), 0.6).getHexString(), 3.0, hero ? 0.5 : kind === 'lights' ? 0.12 : 0.34);
      return keep(m, 1.3);
    },
  };

  /* ---------- swap the materials on every word, keeping what the page animates (L.face.color, emissiveIntensity) ---------- */
  const shared = new Map();      // a material used by many letters stays one material
  const swap = (src, role, kind, own) => { if (own) return MAKE[key](src, role, kind); const k = src.uuid + role + kind; if (!shared.has(k)) shared.set(k, MAKE[key](src, role, kind)); return shared.get(k); };
  function word(list, kind) {
    for (const L of list) {
      const mesh = L.mesh, mat = mesh.material;
      if (Array.isArray(mat)) { const own = !!L.face; const face = swap(mat[0], 'face', kind, own), side = swap(mat[1], 'side', kind, false); mesh.material = [face, side]; if (L.face) L.face = face; }
      else mesh.material = swap(mat, 'solid', kind, true);
    }
  }
  function apply(w) {
    word(w.heroType, 'hero'); word(w.headline, 'headline'); word(w.lightsW, 'lights'); word(w.talks, 'word'); word(w.sees, 'word'); word(w.price, 'word');
    word(w.endL1, 'end'); word(w.endL2, 'end'); for (const k of Object.keys(w.nameWords)) word(w.nameWords[k], 'name');
  }
  // night: the studio dims with the room, or the letters would glow in the dark
  function frame(night) { const k = 1 - 0.72 * night; for (const [m, env] of lit) m.envMapIntensity = env * k; }

  return { key, apply, frame, bevel: key === 'soft' ? 1.9 : 1.6, bevelSegs: 7 };      // a wider, rounder edge: glass is cast, not cut
}
