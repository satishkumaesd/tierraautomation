import { Renderer } from './gl/renderer';
import { buildWorld } from './world/world';
import { SHOTS, glowArray, type Shot } from './world/shots';
import { GROUP_COUNT, type WorldState } from './world/scene';
import { robotReadout } from './world/factory';
import { catmull, clamp, damp, lerp, project, smoothstep, type Vec3 } from './gl/math';
import { SmoothScroll } from './ui/smooth';
import { setupCursor } from './ui/cursor';
import { renderProjects } from './data/projects';
import { renderCareers } from './data/careers';

const root = document.documentElement;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => Array.from(r.querySelectorAll<T>(s));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const lowPower = coarse || innerWidth < 820 || (navigator.hardwareConcurrency || 8) <= 4;
const narrow = () => innerWidth < 820 || innerWidth / innerHeight < 0.8;

renderProjects($('[data-projects]')!);
const careersRoot = $('[data-careers]');
if (careersRoot) renderCareers(careersRoot);

/* ------------------------------------------------------------------ *
 * World + renderer
 * ------------------------------------------------------------------ */
const canvas = $<HTMLCanvasElement>('#stage')!;
const world = buildWorld(lowPower);
const renderer = new Renderer(canvas, world, { lowPower });
if (!renderer.ok) root.classList.add('no-webgl');
const smooth = new SmoothScroll(!reduced && !coarse);

/* ------------------------------------------------------------------ *
 * Chapters → camera keyframes
 * ------------------------------------------------------------------ */
interface Chapter { id: string; el: HTMLElement; pin: boolean; top: number; height: number; start: number; end: number; p: number; state: string; lastP: number }
const chapters: Chapter[] = $$('[data-chapter]').map((el) => ({
  id: el.dataset.chapter!, el, pin: el.classList.contains('pin'), top: 0, height: 0, start: 0, end: 0, p: 0, state: '', lastP: -1,
}));
const byId = Object.fromEntries(chapters.map((c) => [c.id, c]));

interface Key { y: number; s: Shot; glow: Float32Array }
let keys: Key[] = [];

function adapt(s: Shot): Shot {
  if (!narrow()) return s;
  const k = 1.38;
  const eye: Vec3 = [s.target[0] + (s.eye[0] - s.target[0]) * k, s.target[1] + (s.eye[1] - s.target[1]) * k, s.target[2] + (s.eye[2] - s.target[2]) * k];
  return { ...s, eye, fov: s.fov + 8, sx: 0 };
}

function measure() {
  const vh = innerHeight;
  for (const c of chapters) {
    c.top = c.el.getBoundingClientRect().top + scrollY;
    c.height = c.el.offsetHeight;
    if (c.pin) { c.start = c.top; c.end = c.top + c.height - vh; }
    else { c.start = c.top - vh * 0.65; c.end = c.top + c.height - vh * 0.35; }
  }
  keys = [];
  for (const c of chapters) {
    const shots = SHOTS[c.id] || [];
    shots.forEach((s, i) => {
      const y = shots.length === 1 ? c.start : lerp(c.start, c.end, i / (shots.length - 1));
      const a = adapt(s);
      keys.push({ y, s: a, glow: glowArray(a) });
    });
  }
  for (let i = 1; i < keys.length; i++) if (keys[i].y <= keys[i - 1].y) keys[i].y = keys[i - 1].y + 1;
}

const sampleGlow = new Float32Array(GROUP_COUNT);
function sample(y: number) {
  const n = keys.length;
  let i = 0;
  if (y <= keys[0].y) i = 0;
  else if (y >= keys[n - 1].y) i = n - 2;
  else while (i < n - 2 && y > keys[i + 1].y) i++;
  const a = keys[i], b = keys[i + 1];
  const raw = clamp((y - a.y) / (b.y - a.y), 0, 1);
  const t = lerp(raw, raw * raw * (3 - 2 * raw), 0.55);
  const k0 = keys[Math.max(0, i - 1)], k3 = keys[Math.min(n - 1, i + 2)];
  for (let g = 0; g < GROUP_COUNT; g++) sampleGlow[g] = lerp(a.glow[g], b.glow[g], t);
  return {
    eye: catmull(k0.s.eye, a.s.eye, b.s.eye, k3.s.eye, t),
    target: catmull(k0.s.target, a.s.target, b.s.target, k3.s.target, t),
    fov: lerp(a.s.fov, b.s.fov, t), sx: lerp(a.s.sx, b.s.sx, t), exposure: lerp(a.s.exposure, b.s.exposure, t),
    fog: lerp(a.s.fog, b.s.fog, t), dust: lerp(a.s.dust, b.s.dust, t),
  };
}

/* ------------------------------------------------------------------ *
 * Projected 3D tags
 * ------------------------------------------------------------------ */
const TAG_TEXT: Record<string, string> = {
  gpio: 'GPIO', uart: 'UART', spi: 'SPI', i2c: 'I²C', adc: 'ADC', pwm: 'PWM', can: 'CAN', rs485: 'RS485',
  temperature: 'Temperature', position: 'Position', motion: 'Motion', pressure: 'Pressure', level: 'Level', proximity: 'Proximity',
  sense: 'Sense', process: 'Process', decide: 'Decide', act: 'Act', monitor: 'Monitor',
  device: 'Device', edge: 'Edge', network: 'Network', data: 'Data', dashboard: 'Dashboard', j1: 'J1', j2: 'J2', j3: 'J3',
};
const tagHost = $('[data-tags]')!;
const tags = world.labels.map((l) => {
  const el = document.createElement('div');
  el.className = `tag tag--${l.section}`;
  el.innerHTML = `<i></i><span>${TAG_TEXT[l.id] || l.id}</span>`;
  tagHost.appendChild(el);
  return { l, el, text: el.querySelector('span')!, o: -1 };
});
let frameNo = 0;
function updateTags(vis: Record<string, number>) {
  const W = renderer.width, H = renderer.height;
  frameNo++;
  for (const t of tags) {
    const w = vis[t.l.section] || 0;
    if (w < 0.01) {
      if (t.o !== 0) { t.el.style.opacity = '0'; t.o = 0; }
      continue;
    }
    const [nx, ny, cw] = project(renderer.vp, t.l.pos);
    if (cw <= 0 || nx < -1.2 || nx > 1.2 || ny < -1.2 || ny > 1.2) {
      if (t.o !== 0) { t.el.style.opacity = '0'; t.o = 0; }
      continue;
    }
    const x = (nx * 0.5 + 0.5) * W, y = (0.5 - ny * 0.5) * H;
    const edge = smoothstep(1.05, 0.8, Math.abs(nx)) * smoothstep(1.05, 0.8, Math.abs(ny));
    const o = Math.round(w * edge * 100) / 100;
    t.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    if (o !== t.o) { t.el.style.opacity = String(o); t.o = o; }
    if (t.l.section === 'robotics' && frameNo % 4 === 0) {
      const v = robotReadout[t.l.id as 'j1' | 'j2' | 'j3'];
      t.text.textContent = `${t.l.id.toUpperCase()}  ${v.toFixed(1)}°`;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Chapter UI driven by progress
 * ------------------------------------------------------------------ */
const autoWords = $$('[data-steps] .mask');
const stages = $$('[data-stages] li');
const track = $('[data-track]');
const trackItems = track ? $$('li', track) : [];
const trackFill = $('[data-track-fill]');
const trackPulse = $('[data-track-pulse]');
const flash = $('.flash')!;
const nav = $('[data-nav]')!;
const navLinks = $$<HTMLAnchorElement>('[data-link]');
const NAV_OF: Record<string, string> = {
  home: 'home', about: 'about', pcb: 'about', sensors: 'about', dive: 'about', automation: 'about', robotics: 'about', iot: 'about',
  domains: 'domains', process: 'domains', projects: 'projects', rnd: 'rnd', internships: 'internships', careers: 'careers', contact: 'contact',
};
let currentNav = '';
let lastAuto = -1, lastStage = -1, lastStep = -1;

function updateChapters(y: number, vis: Record<string, number>, progress: Record<string, number>) {
  const vh = innerHeight;
  for (const c of chapters) {
    let state: string;
    if (c.pin) {
      c.p = clamp((y - c.start) / Math.max(1, c.end - c.start), 0, 1);
      state = y < c.start - vh * 0.45 ? 'pre' : c.p > 0.9 || y > c.end + vh * 0.2 ? 'out' : 'in';
      vis[c.id] = y < c.start - vh * 0.1 || y > c.end + vh * 0.1 ? 0 : smoothstep(0.02, 0.14, c.p) * (1 - smoothstep(0.84, 0.95, c.p));
    } else {
      c.p = clamp((y - c.start) / Math.max(1, c.end - c.start), 0, 1);
      state = y < c.top - vh * 0.75 ? 'pre' : y > c.top + c.height - vh * 0.15 ? 'out' : 'in';
      vis[c.id] = 0;
    }
    progress[c.id] = c.p;
    if (state !== c.state) {
      c.el.classList.toggle('is-in', state === 'in');
      c.el.classList.toggle('is-out', state === 'out');
      c.state = state;
    }
    if (Math.abs(c.p - c.lastP) > 0.0015) { c.el.style.setProperty('--p', c.p.toFixed(4)); c.lastP = c.p; }
  }

  const ai = Math.min(4, Math.floor(byId.automation.p * 5.2));
  if (ai !== lastAuto) { autoWords.forEach((w, i) => w.classList.toggle('on', i === ai)); lastAuto = ai; }
  const si = Math.min(4, Math.floor(byId.rnd.p * 5.4));
  if (si !== lastStage) { stages.forEach((w, i) => { w.classList.toggle('on', i === si); w.classList.toggle('done', i < si); }); lastStage = si; }

  if (track) {
    const p = byId.process.p;
    const step = Math.min(8, Math.floor(p * 9.2));
    if (!narrow()) {
      const span = Math.max(0, track.scrollWidth - track.parentElement!.clientWidth);
      track.style.transform = `translate3d(${(-p * span).toFixed(1)}px,0,0)`;
    } else track.style.transform = '';
    if (trackFill) trackFill.style.transform = `scaleX(${p.toFixed(4)})`;
    if (trackPulse) trackPulse.style.left = `${(p * 100).toFixed(2)}%`;
    if (step !== lastStep) { trackItems.forEach((li, i) => { li.classList.toggle('on', i === step); li.classList.toggle('done', i < step); }); lastStep = step; }
  }

  // flash while the camera passes through the controller
  const d = byId.dive;
  const dp = d ? d.p : 0;
  const inDive = d && y > d.start - vh * 0.2 && y < d.end + vh * 0.2;
  const f = inDive ? smoothstep(0.16, 0.36, dp) * (1 - smoothstep(0.6, 0.78, dp)) : 0;
  flash.style.opacity = (reduced ? f * 0.5 : f).toFixed(3);
  root.style.setProperty('--dive', (inDive ? dp : 0).toFixed(3));

  // nav
  const probe = y + vh * 0.4;
  let cur = 'home';
  for (const c of chapters) if (probe >= c.top) cur = NAV_OF[c.id] || cur;
  if (cur !== currentNav) { navLinks.forEach((a) => a.classList.toggle('is-current', a.dataset.link === cur)); currentNav = cur; }
  nav.classList.toggle('is-scrolled', y > 30);
}

/* ------------------------------------------------------------------ *
 * Frame loop
 * ------------------------------------------------------------------ */
const cam = { eye: [0, 21, 31] as Vec3, target: [0, 0, 3] as Vec3, fov: 44, sx: 0.16, exposure: 1, fog: 0.011, dust: 0.8 };
const glow = new Float32Array(GROUP_COUNT);
const state: WorldState = { progress: {}, active: {}, reduced };
const vis: Record<string, number> = {};
let last = performance.now();
let time = 0;
let running = false;
let first = true;
let intro = reduced ? 1 : 0;

function frame(now: number) {
  if (!running) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += dt;
  const y = smooth.y;
  updateChapters(y, vis, state.progress);
  const t = sample(y);
  const k = first || reduced ? 1 : damp(lowPower ? 5 : 4.2, dt);
  first = false;
  for (let i = 0; i < 3; i++) {
    cam.eye[i] += (t.eye[i] - cam.eye[i]) * k;
    cam.target[i] += (t.target[i] - cam.target[i]) * k;
  }
  cam.fov += (t.fov - cam.fov) * k;
  cam.sx += (t.sx - cam.sx) * k;
  cam.exposure += (t.exposure - cam.exposure) * k;
  cam.fog += (t.fog - cam.fog) * k;
  cam.dust += (t.dust - cam.dust) * k;
  for (let g = 0; g < GROUP_COUNT; g++) glow[g] += (sampleGlow[g] - glow[g]) * k;

  // intro: power-on sweep from dark
  if (intro < 1) intro = Math.min(1, intro + dt / 2.2);
  const power = smoothstep(0, 1, intro);

  for (const u of world.updaters) u(time, state);
  if (renderer.ok) {
    renderer.render({
      eye: cam.eye, target: cam.target, fov: (cam.fov * Math.PI) / 180, shift: [cam.sx, narrow() ? 0.2 : 0],
      time, glow: glow.map((g) => g * power) as Float32Array, exposure: cam.exposure * (0.35 + 0.65 * power),
      fogDensity: cam.fog, fog: [0.004, 0.0045, 0.006], dust: cam.dust,
    });
    updateTags(vis);
  }
  requestAnimationFrame(frame);
}
function start() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}
function stop() { running = false; }
document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

/* ------------------------------------------------------------------ *
 * Navigation, menu, anchors
 * ------------------------------------------------------------------ */
const menu = $('[data-menu]')!;
const toggle = $<HTMLButtonElement>('[data-menu-toggle]')!;
function setMenu(open: boolean) {
  toggle.setAttribute('aria-expanded', String(open));
  root.classList.toggle('menu-open', open);
  if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); }
  else { menu.classList.remove('is-open'); setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 450); }
}
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); toggle.focus(); } });

document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href')!.slice(1);
  const c = byId[id];
  const el = id ? document.getElementById(id) : null;
  if (!el) return;
  e.preventDefault();
  if (root.classList.contains('menu-open')) setMenu(false);
  const yTarget = c ? (c.pin ? c.start + (c.end - c.start) * 0.12 : c.top) : el.getBoundingClientRect().top + scrollY;
  smooth.scrollTo(id === 'home' ? 0 : yTarget);
  history.replaceState(null, '', `#${id}`);
});

/* ------------------------------------------------------------------ *
 * Domains index
 * ------------------------------------------------------------------ */
for (const btn of $$<HTMLButtonElement>('[data-index] button')) {
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const li = btn.parentElement!;
    const open = !li.classList.contains('open');
    $$('[data-index] li.open').forEach((x) => { x.classList.remove('open'); x.querySelector('button')!.setAttribute('aria-expanded', 'false'); });
    li.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
}

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
const year = $('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());
setupCursor(reduced);

let lastW = innerWidth, lastH = innerHeight, rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = window.setTimeout(() => {
    // ignore mobile URL-bar jitter
    if (Math.abs(innerWidth - lastW) < 2 && Math.abs(innerHeight - lastH) < 140) return;
    lastW = innerWidth; lastH = innerHeight;
    measure();
  }, 150);
});

measure();
start();
const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  root.classList.remove('is-loading');
  root.classList.add('is-ready');
  measure();
  renderer.refreshAtlas();
});
addEventListener('load', () => measure());
