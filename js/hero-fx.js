// The intro's two big moments. Both sit on top of what main.js already does, through two small hooks:
// __heroFx.timeScale slows the page's clock, and __heroFx.frame(look) is called just before each render.
//   1. The rain. At page load the letters of the name fall out of the sky one by one, tumbling, and lock into place
//      with a flash and a little shake, while the camera cranes up from the floor to its usual place. PRESS drops in last.
//   2. The freeze. When the box hits the name, time almost stops and the camera flies once all the way round the box,
//      with the letters hanging in the air and a shockwave running out across the floor. Then time snaps back.
// With reduced motion neither plays and the page is as it was.
import * as THREE from 'three';
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const fx = window.__heroFx = { timeScale: 1 };
  const lerp = (a, b, k) => a + (b - a) * k, sat = (v) => Math.max(0, Math.min(1, v)), ease = (u) => u * u * (3 - 2 * u);
  const C = new THREE.Vector3(), v = new THREE.Vector3(), aim = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const flashEl = document.body.appendChild(Object.assign(document.createElement('i'), { className: 'hero-flash', ariaHidden: 'true' }));
  const RAIN = { start: 0.45, gap: 0.15, fall: 0.5, height: 9.5, crane: 3.5 };      // seconds between letters, seconds in the air, how far they fall, how long the camera takes
  const SPIN = { secs: 3.1, slow: 0.04 };                                             // how long the turn lasts in real time, and how slow the clock goes
  const st = { on: false, done: false, t: 0, rain: scrollY < 40, btn: false };
  let m = null, lastNow = performance.now(), ring;
  if (st.rain) document.body.classList.add('hero-wait');      // PRESS waits for the name

  // The shockwave that runs out across the floor from under the box, drawn as an instrument would draw it. One flat square on the floor and one shader, which
  // works everything out from two numbers: how far a dot is from the middle, and at what angle.
  //   a leading hairline, pale brass with a touch of warm white round it, that gets thinner as it travels and ends by thinning away
  //   right behind it a soft dark band, strongest at the hairline and gone a unit further in, like a contact shadow that moves: the wave has body
  //   two more hairlines in graphite, fainter, each starting a little later and running slower, so the gaps between the three open up
  //   short ticks on the leading ring every two degrees and a longer one every tenth, like the scale on a lens barrel (the hero's drawing sheet again)
  // Every radius is a fast start and a long ease out (one minus e to the minus t), never a straight line. Made at the start, so nothing is compiled at the impact.
  function make() {
    ring = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { uT: { value: 0 }, uInk: { value: new THREE.Color('#2b2b30') }, uBrass: { value: new THREE.Color('#a5843f') }, uWhite: { value: new THREE.Color('#fff6e4') } },
      vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `precision highp float; uniform float uT; uniform vec3 uInk, uBrass, uWhite; varying vec2 vP;
        float line(float d, float w, float px) { return (1.0 - smoothstep(w, w + px, abs(d))) * min(1.0, 0.3 + w / px); }      // a line thinner than a dot gets fainter and is not left a dot wide
        void main() {
          float r = length(vP), px = fwidth(r), life = clamp(uT / 2.9, 0.0, 1.0), fade = 1.0 - smoothstep(0.4, 1.0, life), thin = 1.0 - 0.9 * smoothstep(0.0, 1.0, life);
          float R1 = 0.5 + 9.6 * (1.0 - exp(-uT / 0.95)), R2 = 0.4 + 7.6 * (1.0 - exp(-max(uT - 0.14, 0.0) / 1.25)), R3 = 0.3 + 5.9 * (1.0 - exp(-max(uT - 0.3, 0.0) / 1.6));
          float h1 = line(r - R1, 0.042 * thin, px) * fade, h2 = line(r - R2, 0.016 * thin, px) * fade * 0.42 * step(0.14, uT), h3 = line(r - R3, 0.012 * thin, px) * fade * 0.28 * step(0.3, uT);
          float d = R1 - r, band = step(0.0, d) * exp(-d / 0.55) * fade * 0.24, glow = exp(-abs(d) / 0.11) * fade * 0.4;
          float seg = 6.2831853 / 180.0, k = atan(vP.y, vP.x) / seg, arc = abs(fract(k + 0.5) - 0.5) * seg * r, tall = step(mod(floor(k + 0.5), 10.0), 0.5), len = mix(0.16, 0.38, tall) * (0.55 + 0.45 * thin);
          float tick = (1.0 - smoothstep(0.009, 0.009 + px, arc)) * step(0.0, d) * step(d, len) * fade * mix(0.5, 0.8, tall) * smoothstep(0.045, 0.1, seg * r);      // near the middle the ticks would touch, so they wait until there is room
          float dark = clamp(band + h2 + h3 + tick, 0.0, 1.0); vec4 acc = vec4(uInk * dark, dark);
          acc = acc * (1.0 - glow) + vec4(uWhite * glow, glow); acc = acc * (1.0 - h1) + vec4(mix(uWhite, uBrass, 0.5 + 0.5 * life) * h1, h1);
          if (acc.a < 0.003) discard; gl_FragColor = vec4(acc.rgb / acc.a, acc.a);
          #include <colorspace_fragment>
        }` }));
    ring.position.set(m.BX, 0.024, 0); ring.renderOrder = 2; ring.frustumCulled = false; ring.visible = false; m.scene.add(ring);
  }
  // PRESS falls in after the name and lands on a spring: it goes past its place, squashes, comes back up and settles.
  // One formula, a sine that dies away (the same one the letters land with), drives how far it dips, how flat it gets and how it rocks.
  const BTN = { fall: 0.42, dip: 34, freq: 13, damp: 3.6, squash: 0.22, rock: 2.6, settle: 1.4 };      // seconds in the air, px past its place, how fast it swings, how fast that dies, how flat, degrees, seconds on the spring
  function dropBtn() {
    const el = document.getElementById('unbox'); if (!el || !el.animate) return;
    const H = innerHeight * 0.7, secs = BTN.fall + BTN.settle, N = Math.round(secs * 60), frames = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N * secs; let y, sq, rot;
      if (t < BTN.fall) { const u = t / BTN.fall; y = -H * (1 - u * u); sq = -0.12 * u; rot = -4 * (1 - u); }      // in the air: faster and a little longer as it falls
      else {
        const t2 = t - BTN.fall, e = Math.exp(-BTN.damp * t2);
        y = BTN.dip * e * Math.sin(BTN.freq * t2);                       // below its place first, then above, each swing smaller
        sq = BTN.squash * e * Math.sin(BTN.freq * t2 + 0.45);            // flat while it is down, tall while it is up, and a little ahead of the dip
        rot = BTN.rock * Math.exp(-BTN.damp * 1.15 * t2) * Math.sin(BTN.freq * 0.78 * t2);      // a small rock at its own pace, so it isn't a machine
      }
      if (i === N) y = sq = rot = 0;
      frames.push({ opacity: sat(t / 0.06), translate: `0 ${y.toFixed(2)}px`, scale: `${(1 + sq * 0.55).toFixed(4)} ${(1 - sq).toFixed(4)}`, rotate: `${rot.toFixed(3)}deg`, transformOrigin: '50% 100%' });
    }
    el.animate(frames, { duration: secs * 1000, easing: 'linear' });
  }
  const showBtn = () => { if (!st.btn) { st.btn = true; document.body.classList.replace('hero-wait', 'hero-btn'); dropBtn(); } };
  fx.dropBtn = dropBtn;      // tools/shoot-press.mjs plays it again to photograph it

  fx.frame = (look) => {
    m = window.__mosey; if (!m) return; if (!ring) make();
    const now = performance.now(), rdt = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;      // real seconds, whatever the page's clock is doing
    const { camera, state: S, drop, heroType, BX, world, marks } = m, tall = innerWidth / innerHeight < 0.8;
    // a loader can hold the rain back until it has opened (window.__introGate.hold), so the name never falls behind a curtain
    const gate = window.__introGate; if (gate && !gate.hold && gate.t0 === undefined) gate.t0 = S.time;
    const T = gate ? (gate.hold ? -1 : S.time - gate.t0) : S.time;

    // ---- 1. the rain ----
    if (st.rain && (drop.state !== 'sky' || S.d > 0.25)) { st.rain = false; showBtn(); }      // the page was opened further down, or someone is already walking: no rain, and the camera is left alone
    if (st.rain) {
      const last = RAIN.start + (heroType.length - 1) * RAIN.gap + RAIN.fall;
      if (T > last + 0.2 || drop.state !== 'sky') showBtn();
      if (T > Math.max(last + 1.2, RAIN.crane + 0.4)) st.rain = false;
      let shake = 0;
      for (const L of heroType) {
        if (L.state !== 'float') continue;
        const tau = T - (RAIN.start + L.i * RAIN.gap), ms = L.mesh, side = L.i % 2 ? 1 : -1;
        if (tau < 0) { ms.scale.setScalar(0.001); continue; }
        if (tau < RAIN.fall) {      // in the air: it speeds up as it falls, a little stretched, and turns over once on the way down
          const u = tau / RAIN.fall, left = 1 - u * u;
          ms.position.y += RAIN.height * left; ms.position.x += side * 0.22 * left; ms.scale.set(0.92, 1.16, 0.92);
          ms.rotateX(side * 2.4 * left); ms.rotateZ(side * 0.5 * left);
        } else {      // it overshoots, springs back and flashes
          const t2 = tau - RAIN.fall, d = Math.exp(-6 * t2);
          ms.position.y -= 0.42 * d * Math.sin(t2 * 15); const q = 0.3 * Math.exp(-8 * t2) * Math.cos(t2 * 17); ms.scale.set(1 + q * 0.5, 1 - q, 1 + q * 0.5);
          ms.material.emissiveIntensity = Math.max(ms.material.emissiveIntensity, 2.4 * Math.exp(-4 * t2)); if (t2 < 0.5) shake += Math.exp(-10 * t2);
        }
      }
      const k = 1 - ease(sat((T - 0.2) / RAIN.crane));      // the camera starts low and close, looking up, and cranes back to its place
      if (k > 0.0005 || shake > 0.01) {
        C.set(BX, 2.05, 0);
        camera.position.x += -1.9 * k + Math.sin(T * 83) * 0.03 * shake; camera.position.y += -1.38 * k + Math.sin(T * 97) * 0.04 * shake; camera.position.z += -3.6 * k * (tall ? 1.35 : 1);
        aim.copy(look).lerp(C, k); camera.lookAt(aim); camera.rotateZ(0.09 * k);
      }
    }

    // ---- 2. the freeze ----
    if (drop.state === 'sky') st.done = false;
    if (drop.state === 'falling' && drop.hitT >= 0 && drop.t - drop.hitT > 0.055 && !st.on && !st.done) {
      st.on = true; st.t = 0; flashEl.classList.remove('go'); void flashEl.offsetWidth; flashEl.classList.add('go'); m.sfx?.play('whoosh', 0.55);
    }
    if (!st.on) return;
    st.t += rdt * (S.d > marks.knock + 0.2 ? 4 : 1);      // scrolled on already: finish the turn quickly and get out of the way
    const u = sat(st.t / SPIN.secs);
    const slow = u < 0.05 ? lerp(1, SPIN.slow, u / 0.05) : u < 0.8 ? SPIN.slow : lerp(SPIN.slow, 1, ease((u - 0.8) / 0.2));
    fx.timeScale = slow; world.timestep = (1 / 60) * slow;      // smaller steps, not fewer: the letters keep moving smoothly
    const th = Math.PI * 2 * ease(u), k = Math.sin(Math.PI * u);      // once all the way round, so it ends exactly where the page's own camera is
    C.set(BX, 1.2, 0); v.copy(camera.position).sub(C).applyAxisAngle(UP, th).multiplyScalar(1 - 0.22 * k); v.y += 1.0 * k;
    camera.position.copy(C).add(v); aim.copy(look).lerp(C, sat(k * 1.6)); camera.lookAt(aim);
    ring.material.uniforms.uT.value = st.t; ring.visible = st.t < 2.9;
    if (u >= 1) { st.on = false; st.done = true; fx.timeScale = 1; world.timestep = 1 / 60; ring.visible = false; }
  };
}
