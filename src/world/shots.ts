// Camera choreography. Each chapter of the page owns 2–3 shots; scroll position
// is mapped onto the sequence and interpolated with a Catmull-Rom spline, so the
// whole site plays as one continuous camera move.
import { G, GROUP_COUNT } from './scene';
import type { Vec3 } from '../gl/math';

type GroupName = keyof typeof G;

export interface Shot {
  eye: Vec3;
  target: Vec3;
  fov: number;
  /** horizontal lens shift on desktop (NDC); positive pushes the subject right */
  sx: number;
  glow: Partial<Record<GroupName, number>>;
  exposure: number;
  fog: number;
  dust: number;
}

const S = (eye: Vec3, target: Vec3, o: Partial<Shot> = {}): Shot => ({
  eye, target, fov: 42, sx: 0.24, glow: {}, exposure: 1, fog: 0.011, dust: 0.8, ...o,
});

const heroGlow = { base: 1.1, mcu: 1.0, pcb: 0.9, sensors: 0.7, power: 0.7, damper: 0.5 };
const factoryAmbient = { ambient: 1, auto: 0.45, robot: 0.4, iot: 0.35, damper: 0.35, rnd: 0.35 };

export const SHOTS: Record<string, Shot[]> = {
  home: [
    S([7, 12.5, 25], [1.5, 0, 1], { fov: 42, sx: 0.2, glow: heroGlow }),
    S([-2, 10, 16], [0, 0.4, 0.5], { fov: 40, sx: 0.22, glow: heroGlow }),
  ],
  about: [
    S([7.5, 7.2, 9.2], [0, 0.4, 0], { fov: 38, sx: 0.3, glow: { mcu: 1.9, base: 0.5, pcb: 0.35, sensors: 0.4, power: 0.3 } }),
    S([-6.5, 6.4, 8.6], [0, 0.3, 0], { fov: 38, sx: 0.3, glow: { mcu: 1.9, base: 0.5, pcb: 0.35, sensors: 0.4, power: 0.3 } }),
  ],
  pcb: [
    S([-8.5, 2.3, 13.5], [-15, 0.6, 5], { fov: 46, sx: 0.22, fog: 0.014, glow: { pcb: 1.4, power: 1.7, base: 0.7, mcu: 0.6 } }),
    S([-11.5, 2.5, -0.5], [-19, 0.6, -6], { fov: 46, sx: 0.22, fog: 0.014, glow: { pcb: 1.6, power: 1.3, base: 0.7, mcu: 0.6 } }),
  ],
  sensors: [
    S([15.5, 6.6, 17.5], [25, 0.6, 2.5], { fov: 40, sx: 0.22, glow: { sensors: 1.9, mcu: 1.0, base: 0.4, power: 0.3 } }),
    S([11.5, 5.2, 8.5], [25, 0.6, 1], { fov: 40, sx: 0.22, glow: { sensors: 1.9, mcu: 1.2, base: 0.4 } }),
  ],
  dive: [
    S([0.5, 6.5, 3.6], [0, 0, 0.25], { fov: 40, sx: 0, glow: { mcu: 2.4, sensors: 1, base: 0.6 }, dust: 0.4 }),
    S([0, 0.35, 0.14], [0, -3, 0.1], { fov: 50, sx: 0, glow: { mcu: 2.6 }, dust: 0 }),
    S([1, -14, 6], [-8, -40, -1], { fov: 46, sx: 0, glow: { ...factoryAmbient, auto: 1 }, fog: 0.012, dust: 0.6 }),
  ],
  automation: [
    S([-27, -33.5, 13], [-14, -38.6, -1], { glow: { ...factoryAmbient, auto: 1.7 }, sx: 0.2 }),
    S([-6, -33.8, 12.5], [-6, -38.4, -3], { glow: { ...factoryAmbient, auto: 1.8 }, sx: 0.2 }),
    S([7, -33.2, 9.5], [3, -36, -5], { glow: { ...factoryAmbient, auto: 1.8 }, sx: 0.2 }),
  ],
  robotics: [
    S([3.5, -32.4, 17], [15, -36.2, 3], { fov: 42, glow: { ...factoryAmbient, robot: 1.7, auto: 0.8 }, sx: 0.24 }),
    S([26.5, -31.8, 17], [15, -36.2, 3], { fov: 42, glow: { ...factoryAmbient, robot: 1.7, auto: 0.8 }, sx: 0.24 }),
  ],
  iot: [
    S([6, -22, 37], [27, -37, 5], { fov: 50, sx: 0.12, glow: { ...factoryAmbient, iot: 1.9, robot: 0.7 }, fog: 0.008 }),
    S([46, -23, 33], [25, -37, 5], { fov: 50, sx: 0.12, glow: { ...factoryAmbient, iot: 1.9, robot: 0.7 }, fog: 0.008 }),
  ],
  domains: [
    S([22, -15, 50], [8, -38, 0], { fov: 50, sx: 0, exposure: 0.42, fog: 0.008, glow: { ...factoryAmbient, iot: 0.8, auto: 0.8 } }),
    S([-6, -16, 50], [2, -38, 0], { fov: 50, sx: 0, exposure: 0.42, fog: 0.008, glow: { ...factoryAmbient, iot: 0.8, auto: 0.8 } }),
  ],
  process: [
    S([-25, -31, 15], [-15, -38.5, 0], { fov: 44, sx: 0, exposure: 0.55, glow: { ...factoryAmbient, auto: 1.3 } }),
    S([7, -31, 15], [4, -38.5, -2], { fov: 44, sx: 0, exposure: 0.55, glow: { ...factoryAmbient, auto: 1.3, robot: 0.9 } }),
  ],
  projects: [
    S([-19, -33.6, 0], [-29.5, -36.8, -13], { fov: 42, sx: 0.26, glow: { ...factoryAmbient, damper: 1.9 } }),
    S([-23, -32.6, 2], [-29, -36.6, -13.5], { fov: 42, sx: 0.26, glow: { ...factoryAmbient, damper: 1.9 } }),
  ],
  rnd: [
    S([-20.5, -32.6, 23], [-29, -35.8, 14], { fov: 40, sx: 0.15, glow: { ...factoryAmbient, rnd: 1.9 } }),
    S([-35, -32.4, 23], [-29, -35.8, 14], { fov: 40, sx: 0.15, glow: { ...factoryAmbient, rnd: 1.9 } }),
  ],
  internships: [
    S([-44, -22, 36], [-6, -36, 0], { fov: 50, sx: 0, exposure: 0.5, glow: { ...factoryAmbient, auto: 0.7 } }),
    S([-46, 8, 40], [0, -4, 0], { fov: 50, sx: 0, exposure: 0.5, glow: { base: 0.7, mcu: 0.6, ambient: 0.6 } }),
  ],
  contact: [
    S([0, 42, 50], [0, 0, 0], { fov: 42, sx: 0, exposure: 0.45, dust: 0.5, glow: { base: 0.8, mcu: 0.7, pcb: 0.4, sensors: 0.3 } }),
    S([0, 50, 36], [0, 0, 0], { fov: 42, sx: 0, exposure: 0.4, dust: 0.4, glow: { base: 0.8, mcu: 0.7, pcb: 0.4 } }),
  ],
};

export function glowArray(shot: Shot): Float32Array {
  const a = new Float32Array(GROUP_COUNT);
  a[G.none] = 0;
  for (const [k, v] of Object.entries(shot.glow)) a[G[k as GroupName]] = v ?? 0;
  return a;
}
