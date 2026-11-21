// Design options behind URL switches. Without a parameter the page is exactly as designed.
//   ?pal=poppy | ultra | moss | navy | champagne | slate | green | midnight        colour palette (default: cobalt)
export const PALS = {
  cobalt: { name: 'Cobalt', ground: '#f6f1ea', sky: '#efe6d8', side: '#1836cc', face: '#2a4cf0', deep: '#1f3fe0', accent: '#f6c21a', onAccent: '#15151a', ink: '#15151a', paper: '#fbf8f3', robot: '#f6c21a', trim: '#8b8d92', night: '#0e1230' },
  poppy:  { name: 'Poppy',  ground: '#f4ede2', sky: '#f1e4d3', side: '#d93a1c', face: '#ff5533', deep: '#e8401f', accent: '#2f5bff', onAccent: '#ffffff', ink: '#1a1413', paper: '#fffaf2', robot: '#f7f1e3', trim: '#2f5bff', night: '#1d0f14' },
  ultra:  { name: 'Ultra',  ground: '#f0edf7', sky: '#e6e0f3', side: '#5a2fe0', face: '#7650ff', deep: '#5a2fe0', accent: '#c9f24a', onAccent: '#16132a', ink: '#16132a', paper: '#fbfaff', robot: '#ff7a1a', trim: '#f3efe6', night: '#0f0b24' },
  moss:   { name: 'Moss',   ground: '#efe9dc', sky: '#e7dfcd', side: '#0c5a43', face: '#12785a', deep: '#0f6b4f', accent: '#ff8a3c', onAccent: '#14201b', ink: '#14201b', paper: '#fbf7ee', robot: '#f6efe0', trim: '#ff8a3c', night: '#0a1a16' },
  // Five premium palettes: less joyful, more expensive, and MEET MOSEY with more contrast than black.
  // Extra keys they may carry: hero (the glass of MEET MOSEY) and heroDist (how far light gets into it: larger is paler),
  // dusk (the sky between day and night), cool (the faint glow of unlit letters at night), dark (a dark page: the menu turns light).
  navy:      { name: 'Navy Brass',   ground: '#f1ece4', sky: '#e9e1d4', side: '#12224f', face: '#1d3270', deep: '#14275c', accent: '#c8a24a', onAccent: '#15151a', ink: '#14161d', paper: '#fbf8f3', robot: '#f6c21a', trim: '#8b8d92', night: '#090d1c', hero: '#1b2f6e', heroDist: 0.5, dusk: '#8f93ad', cool: '#aab6e6' },
  champagne: { name: 'Champagne',    ground: '#f2ede4', sky: '#eadfce', side: '#7a5632', face: '#8f6a40', deep: '#3b2a1a', accent: '#d2b071', onAccent: '#1a1510', ink: '#1c1712', paper: '#fbf7f0', robot: '#f6c21a', trim: '#8b8d92', night: '#14100b', hero: '#8a6236', heroDist: 0.5, dusk: '#b3a08c', cool: '#e7cfa0' },
  slate:     { name: 'Slate Ember',  ground: '#eaeae7', sky: '#dfe0de', side: '#474e58', face: '#5a626d', deep: '#23262b', accent: '#e4572e', onAccent: '#ffffff', ink: '#16181b', paper: '#f8f8f6', robot: '#f6c21a', trim: '#8b8d92', night: '#0d0f12', hero: '#565d67', heroDist: 0.55, dusk: '#8f949c', cool: '#b9c2cf' },
  green:     { name: 'Bottle Green', ground: '#efeadf', sky: '#e5dece', side: '#0e4a3a', face: '#15634e', deep: '#0c3a2e', accent: '#c9a04a', onAccent: '#10201a', ink: '#121a17', paper: '#fbf8f1', robot: '#f6c21a', trim: '#8b8d92', night: '#07130f', hero: '#10553f', heroDist: 0.5, dusk: '#8ea698', cool: '#a8d5c2' },
  midnight:  { name: 'Midnight',     ground: '#1b1c21', sky: '#111216', side: '#9fb0d0', face: '#c4d0e6', deep: '#0b0c10', accent: '#d9b56a', onAccent: '#15151a', ink: '#15151a', paper: '#f4f1ea', robot: '#f6c21a', trim: '#8b8d92', night: '#07080b', hero: '#b9c6de', heroDist: 1.4, dusk: '#16171c', cool: '#c9d6f2', dark: true },
};
const q = new URLSearchParams(location.search);
export const PAL = PALS[q.get('pal')] || PALS.cobalt;
if (PAL !== PALS.cobalt) {
  const r = document.documentElement.style;
  r.setProperty('--ground', PAL.ground); r.setProperty('--paper', PAL.paper); r.setProperty('--ink', PAL.ink);
  r.setProperty('--blue', PAL.deep); r.setProperty('--yellow', PAL.accent); r.setProperty('--on-accent', PAL.onAccent);
  if (PAL.dark) { document.documentElement.classList.add('pal-dark'); r.setProperty('--ground', PAL.ground); r.setProperty('--blue', PAL.side); }      // a dark page: light menu, and the UI's second colour is the ice of the letters
}
