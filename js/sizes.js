// The Colours stop: two sizes, four colours. One long stage (pale lacquer on a small dark foot, a slim brass line, a pale stone top, a little light from below) with the three colours
// you are not wearing on the left and a Mosey XL on the right, a thin brass post between them with a mark at each height, and a plate under each.
// The card has a size switch. Pick XL and the robot you are walking grows to XL for as long as you are at this stop.
// js/main.js calls createSizes once, puts the group where the shop shelf used to be, and calls update() every frame.
// The switch's look is in css/style.css ("sizes"), its buttons are in index.html.
//   ?demo=1   clicks a colour, the XL and another colour for you, for recordings
export const XL = 1.58;      // the XL is the same robot, this much bigger: 22 cm to the base model's 14

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createSizes(ctx) {
  const { THREE, RoundedBoxGeometry, scene, family, WAYS, createRobot, mats, at, DISPLAY, MONO, PAL } = ctx, [X, Z] = at;
  const group = new THREE.Group(); group.position.set(X, 0.65, Z);      // it pops up from 0.65 above the floor, the way the shelf did
  const F = -0.65, TOP = 0.6;                                            // the floor seen from inside the group, and how high the stage is
  // The stage is a jeweller's display base: warm white lacquer with a slim brass line let into it and a top of pale honed stone, standing on a foot that is
  // smaller than it and dark, so there is a gap of shadow under it and it floats a little. It was dark satin metal under black glass, and the graphite robots
  // on it had nothing to stand out against. Light: a thin warm line in the shadow gap, the glow it throws on the floor, a faint pool under each robot.
  const brass = new THREE.MeshStandardMaterial({ color: 0xb8924a, roughness: 0.3, metalness: 1 });
  const metal = new THREE.MeshPhysicalMaterial({ color: '#f1ece2', roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.9 });      // warm white lacquer, satin
  const foot = new THREE.MeshStandardMaterial({ color: '#17171b', roughness: 0.5, metalness: 0.7, envMapIntensity: 1.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e6dfd1', roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5, envMapIntensity: 0.8 });      // the top: pale honed stone. Dark robots and bright ones both read against it
  const lit = new THREE.MeshBasicMaterial({ color: '#ffe2a6', toneMapped: false });
  const add = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = shadow; m.position.set(x, y, z); group.add(m); return m; };
  const soft = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d'), g = k.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = g; k.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const glow = (w, d, x, y, z, color, opacity) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: soft, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.position.set(x, y, z); m.renderOrder = -1; group.add(m); return m; };
  add(new RoundedBoxGeometry(6.1, 0.1, 1.1, 3, 0.03), foot, 0.1, F + 0.05, 0);                                    // the foot: smaller than the body, so the body floats over a gap of shadow
  add(new RoundedBoxGeometry(6.16, 0.018, 1.16, 2, 0.008), lit, 0.1, F + 0.104, 0, false);                        // a thin line of light in that gap
  add(new RoundedBoxGeometry(6.5, 0.42, 1.5, 5, 0.09), metal, 0.1, F + 0.12 + 0.21, 0);                           // the body
  add(new RoundedBoxGeometry(6.515, 0.02, 1.515, 2, 0.008), brass, 0.1, F + 0.41, 0);                             // the brass line let into it
  add(new RoundedBoxGeometry(6.56, 0.016, 1.56, 2, 0.007), brass, 0.1, F + TOP - 0.052, 0);                       // a brass edge under the glass
  add(new RoundedBoxGeometry(6.46, 0.046, 1.46, 3, 0.02), glass, 0.1, F + TOP - 0.023, 0);                        // the glass top
  const under = glow(10.4, 5.2, 0.1, F + 0.006, 0.2, '#ffc878', 0.3);                                             // what the line of light throws on the floor
  const rings = [-2.35, -1.2, -0.05, 2.35].map((x, i) => glow(i === 3 ? 1.9 : 1.25, i === 3 ? 1.9 : 1.25, x, F + TOP + 0.003, 0.03, '#fff0cf', 0.3));      // a soft pool of light on the glass under each of them
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.95, 10), brass, 1.28, F + TOP + 0.975, -0.45);                   // the post between the two sizes
  for (const h of [1.15, 1.15 * XL]) add(new THREE.BoxGeometry(0.5, 0.022, 0.03), brass, 1.28, F + TOP + h, -0.45);      // and a mark at the top of each head
  // a printed plate: a name, and a line under it
  const plate = (name, sub, x) => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 90; const k = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const draw = () => { const gb = k.createLinearGradient(0, 0, 0, 90); gb.addColorStop(0, '#d9bd7c'); gb.addColorStop(0.5, '#c2a05a'); gb.addColorStop(1, '#a98846'); k.fillStyle = gb; k.fillRect(0, 0, 512, 90); k.strokeStyle = 'rgba(70,52,20,0.55)'; k.lineWidth = 2; k.strokeRect(6, 6, 500, 78); k.fillStyle = '#2a2015'; k.textAlign = 'center'; k.textBaseline = 'middle';      // a brass plate with the type engraved dark into it
      k.font = `36px ${DISPLAY}`; k.fillText(name.toUpperCase(), 256, 33); k.fillStyle = 'rgba(42,32,21,0.82)'; k.font = `600 18px ${MONO}`; k.fillText(sub.toUpperCase(), 256, 67); tex.needsUpdate = true; };
    draw(); document.fonts?.ready.then(draw);      // once more when the page's own typeface has arrived
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.3), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); m.position.set(x, F + 0.27, 0.752); group.add(m);
  };
  plate('Mosey', '14 cm · $149', -1.2); plate('Mosey XL', '22 cm · $249', 2.35);
  [-2.35, -1.2, -0.05].forEach((x, i) => { family[i].r.root.position.set(X + x, TOP, Z + 0.05); family[i].r.root.rotation.y = -0.1 + i * 0.1; });
  const big = createRobot(); big.root.position.set(X + 2.35, TOP, Z); big.root.rotation.y = -0.18; big.root.scale.setScalar(XL); big.root.visible = false; scene.add(big.root);

  // the card's size switch
  const buttons = [...document.querySelectorAll('.size-sw button')], line = document.getElementById('sizeline');
  const LINES = { base: '14 cm. Walks 6 hours. Puts 40 inches on a wall.', xl: '22 cm. Walks 12 hours. Puts 80 inches on a wall, and carries your tea.' };
  let size = 'base', grow = 1, lastWay = null;
  function setSize(s) {
    size = s; line.textContent = LINES[s];
    buttons.forEach((b) => { const on = b.dataset.size === s; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    ctx.robot.hop(s === 'xl' ? 5 : 3); big.hop(s === 'xl' ? 5 : 2.5);
  }
  buttons.forEach((b) => b.addEventListener('click', () => setSize(b.dataset.size)));

  // ?demo=1: once the card is up, a colour, then the XL, then another colour
  const DEMO = new URLSearchParams(location.search).has('demo'), card = document.querySelector('.size-sw').closest('.copy'), plan = [[1.4, 'mint'], [3.2, 'xl'], [5.4, 'sunny']];
  let t0 = 0, n = 0;
  function demo() {
    if (!card.classList.contains('is-on')) { t0 = 0; n = 0; return; }
    t0 ||= performance.now(); const t = (performance.now() - t0) / 1000;
    while (n < plan.length && t > plan[n][0]) { const k = plan[n++][1]; if (k === 'xl') setSize('xl'); else document.querySelector(`.swatches button[data-way="${k}"]`)?.click(); }
  }

  const bigPaint = ctx.paint?.add(big);                                                    // the XL is repainted the way the one you walk is: as a scan (scanPaint in js/main.js)
  return { group, update({ way, dt, T, d, M }) {
    if (way !== lastWay) { if (lastWay && bigPaint && big.root.visible) ctx.paint.to(bigPaint, way); else big.setWay(way); lastWay = way; }      // the XL wears the colour you picked
    const here = d > M.gate - 1 && d < M.famEnd + 0.6;                                      // you are only XL while you are at this stop
    grow += ((here && size === 'xl' ? XL : 1) - grow) * (1 - Math.exp(-7 * dt));
    ctx.robot.root.scale.setScalar(Math.abs(grow - 1) > 0.002 ? grow : 1);
    const lead = family[0].r.root; big.root.visible = lead.visible;                         // it comes and goes with the others
    if (big.root.visible) { big.root.scale.setScalar(XL * lead.scale.x); const me = ctx.robot.root.position, near = Math.hypot(me.x - big.root.position.x, me.z - big.root.position.z) < 4.2, down = near ? 0 : smooth(Math.sin(T * 0.37 + 1.2), -0.2, 0.5);      // most of the time it looks down at the small one beside it. When you come close it looks up at you
      big.root.rotation.y = -0.18 + Math.sin(T * 0.4 + 2) * 0.06; big.root.rotation.z = Math.sin(T * 0.7 + 1) * 0.015;
      big.update({ dist: 0, speed: 0, air: -1, falling: false, idleFor: 0, look: { yaw: 0.25 + (-1.05 - 0.25) * down, pitch: 0.34 * down }, act: size === 'xl' ? { name: 'wave', t: 0 } : null, dt, time: T + 3.1 }); }
    const pulse = 0.5 + 0.08 * Math.sin(T * 1.3); under.material.opacity = pulse * 0.6; rings.forEach((r, i) => { r.material.opacity = 0.24 + 0.06 * Math.sin(T * 1.1 + i * 1.7); });      // the light breathes, each pool in its own time
    if (DEMO) demo();
  } };
}
