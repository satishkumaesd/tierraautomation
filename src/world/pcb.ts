// Level A — the circuit board. Everything sits on the board top at y = 0.
import { rng, type Vec3 } from '../gl/math';
import { G, PATTERN, type SceneData } from './scene';

const MASK = '#0d1012';
const CHIP = '#141518';
const PIN = '#c6cad0';
const GOLD = '#c79a43';
const COPPER = '#3b3024';
const SILK = '#c3c8ce';

interface Rect { x0: number; z0: number; x1: number; z1: number }

export function buildPCB(s: SceneData, low: boolean) {
  const R = rng(20261007);
  const keep: Rect[] = [];
  const reserve = (x: number, z: number, w: number, d: number, pad = 0.4) => keep.push({ x0: x - w / 2 - pad, z0: z - d / 2 - pad, x1: x + w / 2 + pad, z1: z + d / 2 + pad });
  const free = (x: number, z: number, w: number, d: number) => !keep.some((k) => x + w / 2 > k.x0 && x - w / 2 < k.x1 && z + d / 2 > k.z0 && z - d / 2 < k.z1);
  const silkRect = (x: number, z: number, w: number, d: number) => {
    const y = 0.011, hw = w / 2 + 0.25, hd = d / 2 + 0.25;
    s.trace([[x - hw, y, z - hd], [x + hw, y, z - hd], [x + hw, y, z + hd], [x - hw, y, z + hd], [x - hw, y, z - hd + 0.01]], 0.05, G.none, SILK, 1);
  };

  // ---- the board ----
  s.box({ pos: [0, -0.2, 0], size: [64, 0.4, 44], color: MASK, rough: 0.42, label: PATTERN.pcb });
  s.box({ pos: [0, -0.4, 0], size: [64.2, 0.02, 44.2], color: GOLD, metal: 1, rough: 0.35 });
  for (const [x, z] of [[-30, -20], [30, -20], [-30, 20], [30, 20]]) {
    s.cyl({ pos: [x, 0.005, z], size: [2.4, 0.02, 2.4], color: GOLD, metal: 1, rough: 0.3 });
    s.cyl({ pos: [x, 0.012, z], size: [1.3, 0.02, 1.3], color: '#050506', rough: 0.9 });
    reserve(x, z, 2.4, 2.4);
  }

  // ---- generic package helpers ----
  const pins: Record<string, Vec3[]> = {};
  const qfp = (id: string, x: number, z: number, size: number, perSide: number, h: number, label: number, group: number) => {
    s.box({ pos: [x, h / 2 + 0.03, z], size: [size, h, size], color: CHIP, rough: 0.55, label, group });
    s.cyl({ pos: [x - size / 2 + 0.45, h + 0.035, z + size / 2 - 0.45], size: [0.3, 0.01, 0.3], color: '#08090a', rough: 0.9 });
    const pitch = (size * 0.86) / perSide;
    const pinLen = 0.55, tips: Vec3[] = [];
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < perSide; i++) {
        const o = (i - (perSide - 1) / 2) * pitch;
        const d = size / 2 + pinLen / 2 - 0.05;
        let px = x, pz = z, w = pitch * 0.5, l = pinLen;
        if (side === 0) { px = x + d; pz = z + o; [w, l] = [l, w]; tips.push([x + size / 2 + pinLen, 0.012, z + o]); }
        if (side === 1) { px = x - d; pz = z + o; [w, l] = [l, w]; tips.push([x - size / 2 - pinLen, 0.012, z + o]); }
        if (side === 2) { px = x + o; pz = z + d; tips.push([x + o, 0.012, z + size / 2 + pinLen]); }
        if (side === 3) { px = x + o; pz = z - d; tips.push([x + o, 0.012, z - size / 2 - pinLen]); }
        s.box({ pos: [px, 0.07, pz], size: [w, 0.07, l], color: PIN, metal: 1, rough: 0.28 });
      }
    }
    pins[id] = tips;
    reserve(x, z, size + pinLen * 2, size + pinLen * 2, 0.6);
    silkRect(x, z, size + pinLen * 2, size + pinLen * 2);
  };
  const soic = (id: string, x: number, z: number, w: number, l: number, perSide: number, label: number, group: number) => {
    s.box({ pos: [x, 0.22, z], size: [w, 0.34, l], color: CHIP, rough: 0.55, label, group });
    const pitch = (l * 0.82) / perSide, tips: Vec3[] = [];
    for (const dir of [-1, 1]) {
      for (let i = 0; i < perSide; i++) {
        const o = (i - (perSide - 1) / 2) * pitch;
        s.box({ pos: [x + dir * (w / 2 + 0.22), 0.08, z + o], size: [0.5, 0.07, pitch * 0.45], color: PIN, metal: 1, rough: 0.3 });
        tips.push([x + dir * (w / 2 + 0.5), 0.012, z + o]);
      }
    }
    pins[id] = tips;
    reserve(x, z, w + 1, l);
    silkRect(x, z, w + 1, l);
  };
  const passive = (x: number, z: number, horiz: boolean, big = false, kind = 0) => {
    const L = big ? 1.0 : 0.62, W = big ? 0.5 : 0.32, H = big ? 0.32 : 0.22;
    const body = kind === 0 ? '#16171a' : kind === 1 ? '#7b5c3c' : '#2a2c30';
    const sx = horiz ? L : W, sz = horiz ? W : L;
    s.box({ pos: [x, H / 2, z], size: [sx * 0.62, H, sz * (horiz ? 1 : 0.62)], color: body, rough: 0.6 });
    for (const d of [-1, 1]) {
      const ex = horiz ? x + d * L * 0.4 : x, ez = horiz ? z : z + d * L * 0.4;
      s.box({ pos: [ex, H / 2, ez], size: [horiz ? L * 0.2 : W, H * 1.02, horiz ? W : L * 0.2], color: PIN, metal: 1, rough: 0.3 });
    }
    reserve(x, z, sx, sz, 0.15);
  };
  const via = (x: number, z: number, group: number = G.none) => {
    s.cyl({ pos: [x, 0.006, z], size: [0.34, 0.012, 0.34], color: GOLD, metal: 1, rough: 0.35, group });
    s.cyl({ pos: [x, 0.013, z], size: [0.15, 0.01, 0.15], color: '#040405', rough: 1 });
  };
  const elcap = (x: number, z: number, d: number, h: number) => {
    s.cyl({ pos: [x, h / 2, z], size: [d, h, d], color: '#17191c', metal: 0.25, rough: 0.32 });
    s.cyl({ pos: [x, h + 0.01, z], size: [d * 0.92, 0.04, d * 0.92], color: '#aab0b7', metal: 1, rough: 0.25, label: PATTERN.brushed });
    s.box({ pos: [x - d * 0.47, h * 0.55, z], size: [0.04, h * 0.8, d * 0.28], color: '#ff8a2a', rough: 0.5 });
    reserve(x, z, d, d);
  };
  const inductor = (x: number, z: number, w: number) => {
    s.box({ pos: [x, 0.45, z], size: [w, 0.9, w], color: '#26292e', rough: 0.5, metal: 0.2 });
    s.cyl({ pos: [x, 0.91, z], size: [w * 0.7, 0.02, w * 0.7], color: '#5b6068', metal: 0.6, rough: 0.4 });
    reserve(x, z, w, w);
  };
  const to220 = (x: number, z: number) => {
    s.box({ pos: [x, 0.9, z], size: [2.0, 1.6, 0.9], color: CHIP, rough: 0.5, label: 10 });
    s.box({ pos: [x, 1.0, z - 0.55], size: [2.0, 2.2, 0.18], color: '#a9afb6', metal: 1, rough: 0.3 });
    for (const d of [-0.7, 0, 0.7]) s.box({ pos: [x + d, 0.12, z + 0.8], size: [0.18, 0.1, 0.8], color: PIN, metal: 1, rough: 0.3 });
    // heat sink fins
    for (let i = 0; i < 7; i++) s.box({ pos: [x - 1.5 + i * 0.5, 1.4, z - 1.3], size: [0.1, 2.6, 1.4], color: '#7f868f', metal: 1, rough: 0.45, label: PATTERN.brushed });
    s.box({ pos: [x, 0.15, z - 1.3], size: [3.4, 0.3, 1.5], color: '#7f868f', metal: 1, rough: 0.45 });
    reserve(x, z - 0.4, 3.6, 3.2);
  };
  const header = (x: number, z: number, n: number, rows: number) => {
    s.box({ pos: [x, 0.3, z], size: [n * 0.5, 0.6, rows * 0.5], color: '#111214', rough: 0.7 });
    for (let i = 0; i < n; i++) for (let r = 0; r < rows; r++) {
      s.box({ pos: [x + (i - (n - 1) / 2) * 0.5, 0.95, z + (r - (rows - 1) / 2) * 0.5], size: [0.13, 1.3, 0.13], color: GOLD, metal: 1, rough: 0.25 });
    }
    reserve(x, z, n * 0.5, rows * 0.5);
  };

  // ---- main controller ----
  const PER = low ? 16 : 22;
  qfp('mcu', 0, 0, 7, PER, 0.55, 0, G.mcu);
  s.box({ pos: [0, 0.585, -0.2], size: [3.4, 0.012, 3.4], color: '#16110b', metal: 0.85, rough: 0.28, label: PATTERN.die, group: G.mcu });
  s.trace([[-1.85, 0.592, -2.05], [1.85, 0.592, -2.05], [1.85, 0.592, 1.65], [-1.85, 0.592, 1.65], [-1.85, 0.592, -2.06]], 0.06, G.mcu, '#c79a43', 0);
  s.light([0, 4, 0], '#ff8a2a', 9, 9, G.mcu);
  s.light([0, 9, 8], '#ffc27a', 3, 14, G.base);
  // crystal + load caps
  s.box({ pos: [-5.9, 0.25, 5.3], size: [1.5, 0.5, 0.65], color: '#b9bec5', metal: 1, rough: 0.2, label: PATTERN.brushed });
  reserve(-5.9, 5.3, 1.5, 0.65);
  passive(-7.3, 5.3, false); passive(-4.5, 5.3, false);

  // ---- surrounding ICs ----
  soic('flash', 8.5, -7, 2.2, 2.6, 4, 5, G.pcb);
  soic('rs485', 18, -12.5, 2.2, 2.6, 4, 3, G.damper);
  soic('can', 11.5, -13.5, 2.2, 2.6, 4, 4, G.pcb);
  qfp('eth', -8, -12, 3.4, 8, 0.4, 13, G.pcb);
  qfp('drv', 14, 4, 3.6, 8, 0.4, 8, G.power);
  qfp('adc', 14.5, 11.5, 3, 7, 0.4, 11, G.sensors);
  s.light([16, 3, 10], '#ff9b3d', 4, 8, G.sensors);

  // RJ45 / USB-C / terminal blocks on the edges
  s.box({ pos: [-8, 1.0, -19.6], size: [5.6, 2.0, 4.6], color: '#9ea4ab', metal: 1, rough: 0.35, label: PATTERN.brushed });
  s.box({ pos: [-8, 0.9, -17.25], size: [3.2, 1.3, 0.1], color: '#050505', rough: 0.9 });
  reserve(-8, -19.6, 5.6, 4.6);
  s.box({ pos: [0, 0.32, 21], size: [3.0, 0.64, 2.2], color: '#b8bdc3', metal: 1, rough: 0.25, label: PATTERN.brushed });
  s.box({ pos: [0, 0.32, 22.05], size: [2.2, 0.28, 0.05], color: '#050505', rough: 0.9 });
  reserve(0, 21, 3, 2.2);
  for (let i = 0; i < 3; i++) {
    const x = 16 + i * 1.6;
    s.box({ pos: [x, 0.75, -19.4], size: [1.5, 1.5, 2.4], color: '#1a1d21', rough: 0.6 });
    s.cyl({ pos: [x, 1.52, -19.9], size: [0.75, 0.06, 0.75], color: '#b4b9bf', metal: 1, rough: 0.3 });
    s.box({ pos: [x, 1.55, -19.9], size: [0.5, 0.04, 0.08], color: '#2a2d31', rough: 0.6 });
  }
  reserve(17.6, -19.4, 4.8, 2.4);
  header(24, 19, 10, 2);
  header(-24, -16, 2, 6);

  // ---- ESP32-style module ----
  const ex = -18, ez = -2;
  s.box({ pos: [ex, 0.08, ez], size: [6.0, 0.16, 9.0], color: '#101315', rough: 0.45 });
  s.box({ pos: [ex, 0.48, ez + 1.1], size: [5.2, 0.62, 5.6], color: '#b9bec4', metal: 1, rough: 0.22, label: 2, group: G.pcb });
  const ant: Vec3[] = [];
  for (let i = 0; i <= 8; i++) {
    const zz = ez - 2.7 - (i % 2) * 1.1;
    ant.push([ex - 2.3 + i * 0.58, 0.172, zz], [ex - 2.3 + i * 0.58 + 0.29, 0.172, zz]);
  }
  s.trace(ant, 0.14, G.pcb, GOLD);
  for (let i = 0; i < 9; i++) {
    s.box({ pos: [ex - 3.0, 0.08, ez - 1 + i * 0.6], size: [0.18, 0.17, 0.36], color: GOLD, metal: 1, rough: 0.3 });
    s.box({ pos: [ex + 3.0, 0.08, ez - 1 + i * 0.6], size: [0.18, 0.17, 0.36], color: GOLD, metal: 1, rough: 0.3 });
  }
  reserve(ex, ez, 6.4, 9.4);
  s.light([ex, 4, ez + 2], '#ffb066', 3, 7, G.pcb);

  // ---- power stage ----
  s.box({ pos: [-14, 0.3, 12], size: [2.6, 0.6, 2.2], color: CHIP, rough: 0.5, label: 6, group: G.power });
  s.box({ pos: [-14, 0.12, 13.6], size: [2.2, 0.08, 1.0], color: PIN, metal: 1, rough: 0.3 });
  reserve(-14, 12.6, 2.6, 3.2);
  inductor(-19.5, 13.5, 2.6); inductor(-23.5, 9.5, 2.6); inductor(-10, 17, 2.2);
  elcap(-27, 15.5, 2.6, 3.2); elcap(-23.5, 17.5, 2.2, 2.6); elcap(-18.5, 18.5, 1.8, 2.2); elcap(-27.5, 4.5, 2.2, 2.8);
  to220(-25, -6); to220(-25, -12);
  s.light([-22, 5, 12], '#ff7a1a', 5, 9, G.power);
  for (let i = 0; i < 5; i++) {
    s.box({ pos: [26 - i * 1.2, 0.16, 15.5], size: [0.5, 0.3, 0.5], color: '#ffb35a', emissive: i % 2 ? 2.2 : 0.6, rough: 0.3, group: G.base });
  }
  reserve(23.6, 15.5, 6, 1);

  // ---- sensor zone (+x) ----
  const sensors: [string, Vec3][] = [];
  { // temperature: TO-92 + legs
    const x = 23.5, z = 9;
    s.cyl({ pos: [x, 0.95, z], size: [0.9, 1.0, 0.9], color: CHIP, rough: 0.45 });
    for (const d of [-0.25, 0, 0.25]) s.box({ pos: [x + d, 0.22, z], size: [0.07, 0.45, 0.07], color: PIN, metal: 1, rough: 0.3 });
    reserve(x, z, 1.2, 1.2); sensors.push(['temperature', [x, 0.02, z]]);
  }
  { // position: rotary encoder
    const x = 28, z = 7;
    s.box({ pos: [x, 0.45, z], size: [2.0, 0.9, 2.0], color: '#1c1f23', rough: 0.5 });
    s.cyl({ pos: [x, 1.25, z], size: [0.9, 0.7, 0.9], color: '#a6acb3', metal: 1, rough: 0.3, label: PATTERN.brushed });
    s.cyl({ pos: [x, 2.1, z], size: [0.45, 1.2, 0.45], color: '#c9ced4', metal: 1, rough: 0.2 });
    reserve(x, z, 2.2, 2.2); sensors.push(['position', [x, 0.02, z]]);
  }
  { // motion: IMU on a breakout
    const x = 23.5, z = 2;
    s.box({ pos: [x, 0.1, z], size: [3.0, 0.14, 2.4], color: '#121820', rough: 0.45 });
    s.box({ pos: [x, 0.3, z], size: [1.0, 0.24, 1.0], color: CHIP, rough: 0.5, label: 7, group: G.sensors });
    reserve(x, z, 3, 2.4); sensors.push(['motion', [x, 0.02, z]]);
  }
  { // pressure: metal can with port
    const x = 28.5, z = 0.5;
    s.cyl({ pos: [x, 0.55, z], size: [1.8, 1.1, 1.8], color: '#b0b6bd', metal: 1, rough: 0.25, label: PATTERN.brushed });
    s.cyl({ pos: [x, 1.45, z], size: [0.5, 0.7, 0.5], color: '#c9ced4', metal: 1, rough: 0.2 });
    reserve(x, z, 1.9, 1.9); sensors.push(['pressure', [x, 0.02, z]]);
  }
  { // level: ultrasonic transducers
    const x = 24, z = -5;
    s.box({ pos: [x, 0.1, z], size: [5.2, 0.14, 2.4], color: '#121820', rough: 0.45 });
    for (const d of [-1.3, 1.3]) {
      s.cyl({ pos: [x + d, 0.75, z], size: [1.9, 1.2, 1.9], color: '#aeb4bb', metal: 1, rough: 0.3 });
      s.cyl({ pos: [x + d, 1.36, z], size: [1.5, 0.03, 1.5], color: '#1b1d20', rough: 0.9 });
    }
    reserve(x, z, 5.4, 2.6); sensors.push(['level', [x, 0.02, z]]);
  }
  { // proximity: IR emitter/receiver
    const x = 28.5, z = -9.5;
    s.box({ pos: [x, 0.1, z], size: [2.6, 0.14, 1.6], color: '#121820', rough: 0.45 });
    s.cyl({ pos: [x - 0.55, 0.45, z], size: [0.6, 0.6, 0.6], color: '#0c0d0f', rough: 0.15 });
    s.cyl({ pos: [x + 0.55, 0.45, z], size: [0.6, 0.6, 0.6], color: '#ffb36b', rough: 0.15, emissive: 1.4, group: G.sensors });
    reserve(x, z, 2.8, 1.8); sensors.push(['proximity', [x, 0.02, z]]);
  }
  s.light([26, 5, 1], '#ff9a3c', 6, 10, G.sensors);

  // ---- traces: MCU fan-out on all four sides ----
  const tips = pins.mcu;
  const Y = 0.012;
  tips.forEach((t, i) => {
    const side = Math.floor(i / PER);
    const group = side === 0 ? G.sensors : side === 1 ? G.pcb : side === 3 ? G.mcu : G.power;
    const spread = 2.1;
    const reach = 9 + R() * 5;
    let pts: Vec3[] = [];
    if (side === 0 || side === 1) {
      const dir = side === 0 ? 1 : -1;
      const z1 = t[2] * spread, run = Math.abs(z1 - t[2]);
      pts = [t, [t[0] + dir * 0.9, Y, t[2]], [t[0] + dir * (0.9 + run), Y, z1], [t[0] + dir * reach, Y, z1]];
    } else {
      const dir = side === 2 ? 1 : -1;
      const x1 = t[0] * spread, run = Math.abs(x1 - t[0]);
      pts = [t, [t[0], Y, t[2] + dir * 0.9], [x1, Y, t[2] + dir * (0.9 + run)], [x1, Y, t[2] + dir * reach * 0.8]];
    }
    // signals flow INTO the controller: reverse so pulses travel toward the pins
    const rev = pts.slice().reverse();
    s.trace(rev, 0.11, group, COPPER, 0, R() * 30);
    const end = rev[0];
    via(end[0], end[2], group);
  });

  // ---- buses between peripherals and the controller fan-out ----
  const bus = (from: Vec3, to: Vec3, n: number, group: number, gap = 0.36) => {
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * gap;
      const dx = to[0] - from[0], dz = to[2] - from[2];
      const diag = Math.min(Math.abs(dx), Math.abs(dz));
      const a: Vec3 = [from[0], Y, from[2] + o];
      const b: Vec3 = [to[0] - Math.sign(dx) * diag, Y, from[2] + o];
      const c: Vec3 = [to[0] + o * 0.0, Y, to[2] + o];
      s.trace([a, [b[0] + o * Math.sign(dz) * Math.sign(dx), Y, b[2]], c], 0.1, group, COPPER, 0, R() * 40);
    }
  };
  bus([-15, 0, -4], [-11, 0, 0], 6, G.pcb);
  bus([-8, 0, -9.5], [-3, 0, -7.5], 5, G.pcb);
  bus([8.5, 0, -5.2], [3, 0, -7.6], 4, G.pcb);
  bus([16.5, 0, -12.5], [5, 0, -9], 4, G.damper);
  bus([12.5, 0, 4], [9, 0, 2], 6, G.power);
  bus([-13, 0, 12], [-4, 0, 9], 3, G.power, 0.6);
  bus([18, 0, -18], [18, 0, -13.8], 3, G.damper, 0.6);
  bus([-8, 0, -17], [-8, 0, -14], 4, G.pcb, 0.5);

  // sensors → ADC → controller (flow toward the MCU)
  const adcIn: Vec3 = [16.5, Y, 11.5];
  sensors.forEach(([name, p], i) => {
    const mid: Vec3 = [20.5, Y, p[2]];
    const pts: Vec3[] = [[p[0], Y, p[2]], mid, [18.2, Y, 11.5 + (i - 2.5) * 0.4], [adcIn[0], Y, 11.5 + (i - 2.5) * 0.4]];
    s.trace(pts, 0.13, G.sensors, COPPER, 0, i * 3);
    s.label(name, [p[0], p[1] + (name === 'position' ? 2.9 : 1.8), p[2]], 'sensors');
  });
  for (let i = 0; i < 4; i++) s.trace([[13, Y, 9.8 - i * 0.4], [10, Y, 9.8 - i * 0.4], [6.4, Y, 6.2 - i * 0.4], [5, Y, 6.2 - i * 0.4]], 0.11, G.sensors, COPPER, 0, i * 5);

  // ---- filler: passives, vias, stitched ground ----
  const fill = low ? 120 : 260;
  let placed = 0, guard = 0;
  while (placed < fill && guard++ < fill * 20) {
    const x = (R() * 2 - 1) * 30, z = (R() * 2 - 1) * 20.5;
    const big = R() < 0.25, horiz = R() < 0.5;
    if (!free(x, z, big ? 1.2 : 0.8, big ? 1.2 : 0.8)) continue;
    passive(x, z, horiz, big, R() < 0.55 ? 0 : R() < 0.7 ? 1 : 2);
    placed++;
  }
  const vias = low ? 120 : 320;
  for (let i = 0, g = 0; i < vias && g < vias * 10; g++) {
    const x = (R() * 2 - 1) * 31, z = (R() * 2 - 1) * 21.4;
    if (!free(x, z, 0.4, 0.4)) continue;
    via(x, z);
    reserve(x, z, 0.4, 0.4, 0.05);
    i++;
  }
  // long ambient buses near the edges keep the board alive in the hero shot
  for (let i = 0; i < 6; i++) {
    const z = -15.5 + i * 0.42;
    s.trace([[-29, Y, z], [-22, Y, z], [-19, Y, z + 3], [-12, Y, z + 3]], 0.09, G.base, COPPER, 0, i * 4);
  }
  for (let i = 0; i < 6; i++) {
    const x = 5 + i * 0.42;
    s.trace([[x, Y, 20], [x, Y, 15], [x - 3, Y, 12], [x - 3, Y, 8]], 0.09, G.base, COPPER, 0, i * 6);
  }

  // ---- protocol labels around the controller ----
  const L = 6.2;
  const tags: [string, Vec3][] = [
    ['gpio', [-L, 0.4, -2.2]], ['uart', [-L, 0.4, 2.2]], ['spi', [-2.2, 0.4, -L]], ['i2c', [2.2, 0.4, -L]],
    ['adc', [L, 0.4, -2.2]], ['pwm', [L, 0.4, 2.2]], ['can', [-2.2, 0.4, L]], ['rs485', [2.2, 0.4, L]],
  ];
  for (const [id, p] of tags) s.label(id, p, 'about');
}
