// Scene data: everything the renderer draws lives in a handful of instanced batches,
// so the whole electronics world renders in ~8 draw calls.
import { hex, QI, type Quat, type Vec3 } from '../gl/math';

/** Glow / activity groups. Each gets a level (0..n) every frame from the scroll position. */
export const G = {
  none: 0, base: 1, mcu: 2, pcb: 3, sensors: 4, auto: 5, robot: 6, iot: 7, damper: 8, rnd: 9, ambient: 10, power: 11,
} as const;
export const GROUP_COUNT = 12;

/** Surface patterns resolved in the fragment shader (stored as negative label ids). */
export const PATTERN = { pcb: -1, floor: -2, brushed: -3, die: -4 } as const;

export const PART_STRIDE = 18; // pos3 scale3 rot4 col4 mat4
export const TRACE_STRIDE = 13; // a3 b3 info4(width, phase, group, kind) col3

const toLinear = (c: Vec3): Vec3 => [Math.pow(c[0], 2.2), Math.pow(c[1], 2.2), Math.pow(c[2], 2.2)];
const colorCache = new Map<string, Vec3>();
export function lin(h: string): Vec3 {
  let c = colorCache.get(h);
  if (!c) { c = toLinear(hex(h)); colorCache.set(h, c); }
  return c;
}

export interface PartSpec {
  pos: Vec3;
  size: Vec3;
  rot?: Quat;
  color: string | Vec3;
  metal?: number;
  rough?: number;
  emissive?: number;
  group?: number;
  label?: number;
}

export class Batch {
  data: Float32Array<ArrayBuffer>;
  count = 0;
  dirtyFrom = Infinity;
  dirtyTo = -1;
  constructor(public stride: number, capacity = 1024) {
    this.data = new Float32Array(stride * capacity);
  }
  private grow() {
    const next = new Float32Array(this.data.length * 2);
    next.set(this.data);
    this.data = next;
  }
  push(values: number[]): number {
    if ((this.count + 1) * this.stride > this.data.length) this.grow();
    this.data.set(values, this.count * this.stride);
    return this.count++;
  }
  write(index: number, values: number[]) {
    this.data.set(values, index * this.stride);
    this.dirtyFrom = Math.min(this.dirtyFrom, index);
    this.dirtyTo = Math.max(this.dirtyTo, index);
  }
  clearDirty() { this.dirtyFrom = Infinity; this.dirtyTo = -1; }
}

export function partValues(p: PartSpec): number[] {
  const c = typeof p.color === 'string' ? lin(p.color) : p.color;
  const r = p.rot || QI;
  return [
    p.pos[0], p.pos[1], p.pos[2],
    p.size[0], p.size[1], p.size[2],
    r[0], r[1], r[2], r[3],
    c[0], c[1], c[2], p.emissive ?? 0,
    p.metal ?? 0, p.rough ?? 0.6, p.group ?? 0, p.label ?? 0,
  ];
}

export interface Label3D { id: string; pos: Vec3; section: string }
export interface LightSpec { pos: Vec3; color: Vec3; radius: number; group: number }

export class SceneData {
  boxes = new Batch(PART_STRIDE, 4096);
  cyls = new Batch(PART_STRIDE, 1024);
  traces = new Batch(TRACE_STRIDE, 4096); // flat on a surface
  wires = new Batch(TRACE_STRIDE, 1024); // free 3D ribbons (cables, network arcs)
  labels: Label3D[] = [];
  lights: LightSpec[] = [];
  updaters: ((t: number, s: WorldState) => void)[] = [];

  box(p: PartSpec) { return this.boxes.push(partValues(p)); }
  cyl(p: PartSpec) { return this.cyls.push(partValues(p)); }

  /**
   * Polyline trace. Pulses travel from the first point toward the last.
   * kind: 0 copper, 1 silkscreen, 2 cable, 3 light-arc
   */
  trace(points: Vec3[], width: number, group: number, color = '#3a3127', kind = 0, phase0 = 0, target: Batch = this.traces) {
    const c = lin(color);
    let phase = phase0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      target.push([a[0], a[1], a[2], b[0], b[1], b[2], width, phase, group, kind, c[0], c[1], c[2]]);
      phase += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    return phase;
  }
  wire(points: Vec3[], width: number, group: number, color = '#20242a', kind = 2, phase0 = 0) {
    return this.trace(points, width, group, color, kind, phase0, this.wires);
  }
  label(id: string, pos: Vec3, section: string) { this.labels.push({ id, pos, section }); }
  light(pos: Vec3, color: string, intensity: number, radius: number, group = 0) {
    const c = lin(color);
    this.lights.push({ pos, color: [c[0] * intensity, c[1] * intensity, c[2] * intensity], radius, group });
  }
}

/** Per-frame state handed to animated pieces of the world. */
export interface WorldState {
  /** 0..1 progress inside each named section (scroll driven, smoothed). */
  progress: Record<string, number>;
  /** 0..1 how "present" each section is right now. */
  active: Record<string, number>;
  reduced: boolean;
}
