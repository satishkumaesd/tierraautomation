// Level B — the factory floor below the board (y = -40): automation line, robot cell,
// connected-systems network, damper monitoring rig and the R&D bench.
import { clamp, lerp, qMul, qRot, qX, qY, qZ, QI, rng, smoothstep, type Quat, type Vec3, add } from '../gl/math';
import { G, PATTERN, partValues, type PartSpec, type SceneData } from './scene';

export const FY = -40;
const GRAPHITE = '#1c1f23';
const STEEL = '#9aa1a9';
const ORANGE = '#e8701c';

export interface RobotReadout { j1: number; j2: number; j3: number }
export const robotReadout: RobotReadout = { j1: 0, j2: 0, j3: 0 };

function arc(a: Vec3, b: Vec3, lift: number, n = 26): Vec3[] {
  const m: Vec3 = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2];
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], u * u * a[1] + 2 * u * t * m[1] + t * t * b[1], u * u * a[2] + 2 * u * t * m[2] + t * t * b[2]]);
  }
  return out;
}
function ring(c: Vec3, r: number, n = 40): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; out.push([c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r]); }
  return out;
}

export function buildFactory(s: SceneData, low: boolean) {
  const R = rng(4242);
  const Y = FY;
  const dyn = (spec: PartSpec, cyl = false) => {
    const batch = cyl ? s.cyls : s.boxes;
    const i = cyl ? s.cyl(spec) : s.box(spec);
    return (p: PartSpec) => batch.write(i, partValues(p));
  };

  // ---- floor ----
  s.box({ pos: [0, Y - 0.25, 0], size: [150, 0.5, 120], color: '#0a0b0d', rough: 0.85, label: PATTERN.floor });
  for (const z of [-3.6, 3.6]) s.box({ pos: [-6, Y + 0.01, z], size: [36, 0.02, 0.18], color: '#d98a1f', rough: 0.7, emissive: 0.05, group: G.auto });

  // ======================= AUTOMATION LINE =======================
  const beltY = Y + 1.4;
  for (let x = -21; x <= 9; x += 4) for (const z of [-1.3, 1.3]) s.box({ pos: [x, Y + 0.68, z], size: [0.28, 1.36, 0.28], color: '#2a2e33', metal: 0.6, rough: 0.5 });
  for (const z of [-1.42, 1.42]) s.box({ pos: [-6, beltY + 0.02, z], size: [32.6, 0.36, 0.22], color: STEEL, metal: 1, rough: 0.35, label: PATTERN.brushed });
  s.box({ pos: [-6, beltY - 0.02, 0], size: [32, 0.1, 2.6], color: '#141618', rough: 0.92 });
  for (const x of [-22.2, 10.2]) s.cyl({ pos: [x, beltY - 0.05, 0], size: [0.72, 2.7, 0.72], rot: qX(Math.PI / 2), color: '#b8bec5', metal: 1, rough: 0.25 });

  // products riding the belt
  const N = low ? 6 : 9;
  const products = Array.from({ length: N }, () => ({
    body: dyn({ pos: [0, -999, 0], size: [1.2, 0.9, 1.2], color: '#2a2e34', metal: 0.4, rough: 0.45 }),
    tag: dyn({ pos: [0, -999, 0], size: [0.9, 0.18, 0.02], color: '#ff8a2a', emissive: 0.6, group: G.auto }),
  }));
  s.updaters.push((t, st) => {
    const speed = st.reduced ? 0 : 1.4;
    products.forEach((p, i) => {
      const x = -21.4 + ((t * speed + i * (31 / N)) % 31);
      p.body({ pos: [x, beltY + 0.48, 0], size: [1.2, 0.9, 1.2], color: '#2a2e34', metal: 0.4, rough: 0.45 });
      p.tag({ pos: [x, beltY + 0.62, 0.61], size: [0.9, 0.18, 0.02], color: '#ff8a2a', emissive: 0.6, group: G.auto });
    });
  });

  // sensor gate (SENSE)
  for (const z of [-1.95, 1.95]) {
    s.box({ pos: [-14, Y + 1.3, z], size: [0.26, 2.6, 0.26], color: GRAPHITE, metal: 0.5, rough: 0.5 });
    s.box({ pos: [-14, Y + 2.25, z * 0.93], size: [0.5, 0.42, 0.4], color: '#0e1012', rough: 0.4 });
    s.box({ pos: [-14, Y + 2.25, z * 0.86], size: [0.32, 0.22, 0.04], color: '#ffae4a', emissive: 1.5, group: G.auto });
  }
  s.wire([[-14, Y + 2.25, -1.62], [-14, Y + 2.25, 1.62]], 0.05, G.auto, '#ff9a3d', 3);

  // drive motor with cooling fins
  const mz = 2.7, mx = -24.2;
  s.cyl({ pos: [mx, Y + 1.05, mz], size: [1.5, 2.5, 1.5], rot: qZ(Math.PI / 2), color: '#2b2f35', metal: 0.5, rough: 0.4 });
  for (let i = 0; i < 9; i++) s.cyl({ pos: [mx - 1.0 + i * 0.25, Y + 1.05, mz], size: [1.72, 0.06, 1.72], rot: qZ(Math.PI / 2), color: '#3a3f46', metal: 0.6, rough: 0.4 });
  s.cyl({ pos: [mx - 1.35, Y + 1.05, mz], size: [1.3, 0.2, 1.3], rot: qZ(Math.PI / 2), color: STEEL, metal: 1, rough: 0.3 });
  s.box({ pos: [mx + 0.2, Y + 2.0, mz], size: [0.8, 0.45, 0.8], color: GRAPHITE, rough: 0.5 });
  s.box({ pos: [mx + 0.2, Y + 2.0, mz + 0.41], size: [0.5, 0.12, 0.02], color: ORANGE, emissive: 0.8, group: G.auto });
  s.box({ pos: [mx + 1.6, Y + 1.05, mz - 0.3], size: [1.2, 1.3, 1.6], color: '#24282d', metal: 0.4, rough: 0.45 });
  s.box({ pos: [mx, Y + 0.2, mz], size: [2.6, 0.4, 1.6], color: '#1a1d21', metal: 0.4, rough: 0.6 });
  s.cyl({ pos: [-22.9, beltY - 0.05, 1.7], size: [0.25, 1.2, 0.25], rot: qX(Math.PI / 2), color: STEEL, metal: 1, rough: 0.3 });

  // pneumatic actuator (ACT)
  const ax = -4;
  s.cyl({ pos: [ax, beltY + 0.5, -3.5], size: [0.6, 2.4, 0.6], rot: qX(Math.PI / 2), color: '#c2c7cd', metal: 1, rough: 0.25, label: PATTERN.brushed });
  s.box({ pos: [ax, beltY + 0.5, -4.75], size: [0.8, 0.8, 0.2], color: GRAPHITE, metal: 0.5, rough: 0.4 });
  s.box({ pos: [ax, Y + 0.95, -3.5], size: [0.4, 1.9, 0.4], color: '#2a2e33', metal: 0.5, rough: 0.5 });
  const rod = dyn({ pos: [ax, beltY + 0.5, -2], size: [0.2, 0.5, 0.2], rot: qX(Math.PI / 2), color: '#dfe3e8', metal: 1, rough: 0.15 }, true);
  const pusher = dyn({ pos: [ax, beltY + 0.5, -1.9], size: [1.1, 0.75, 0.14], color: ORANGE, metal: 0.3, rough: 0.4 });
  s.updaters.push((t, st) => {
    const e = st.reduced ? 0.3 : smoothstep(0.55, 0.75, (Math.sin(t * 1.3) + 1) / 2) * 1.1;
    const z0 = -2.3, z1 = z0 + 0.3 + e;
    rod({ pos: [ax, beltY + 0.5, (z0 + z1) / 2], size: [0.2, z1 - z0, 0.2], rot: qX(Math.PI / 2), color: '#dfe3e8', metal: 1, rough: 0.15 });
    pusher({ pos: [ax, beltY + 0.5, z1], size: [1.1, 0.75, 0.14], color: ORANGE, metal: 0.3, rough: 0.4 });
  });

  // control cabinet (PROCESS / DECIDE)
  const cx = -12, cz = -7.5;
  s.box({ pos: [cx, Y + 2.3, cz], size: [3.4, 4.6, 1.4], color: '#1b1e22', metal: 0.35, rough: 0.45 });
  s.box({ pos: [cx, Y + 2.3, cz + 0.71], size: [0.03, 4.3, 0.02], color: '#0a0b0c', rough: 0.9 });
  s.box({ pos: [cx - 0.75, Y + 3.25, cz + 0.72], size: [1.5, 1.0, 0.04], color: '#ffd29c', emissive: 0.9, group: G.auto });
  s.box({ pos: [cx + 0.85, Y + 1.6, cz + 0.72], size: [1.2, 0.8, 0.04], color: '#25292e', rough: 0.4, label: 12 });
  for (let i = 0; i < 4; i++) s.box({ pos: [cx + 0.45 + i * 0.28, Y + 3.5, cz + 0.72], size: [0.14, 0.14, 0.04], color: i === 0 ? '#ffb347' : '#5a5f66', emissive: i === 0 ? 2 : 0.2, group: G.auto });
  for (let i = 0; i < 3; i++) s.cyl({ pos: [cx + 1.3, Y + 4.85 + i * 0.32, cz], size: [0.36, 0.3, 0.36], color: i === 2 ? '#ff8a1f' : i === 1 ? '#f2f2f2' : '#222', emissive: i === 2 ? 1.8 : i === 1 ? 0.25 : 0, group: G.auto });
  s.light([cx + 1, Y + 6, cz + 3], '#ffa24a', 6, 9, G.auto);

  // monitoring panel (MONITOR)
  const mp: Vec3 = [4, Y + 5, -6];
  s.box({ pos: [mp[0], Y + 2.0, mp[2] - 0.2], size: [0.25, 4.0, 0.25], color: GRAPHITE, metal: 0.5 });
  s.box({ pos: mp, size: [5.6, 3.2, 0.14], color: '#0b0d0f', metal: 0.3, rough: 0.25 });
  const bars = Array.from({ length: 10 }, (_, i) => ({ i, set: dyn({ pos: [mp[0] - 2.2 + i * 0.36, mp[1] - 1, mp[2] + 0.09], size: [0.2, 0.5, 0.02], color: '#ffa340', emissive: 1.2, group: G.auto }) }));
  s.updaters.push((t) => {
    for (const b of bars) {
      const h = 0.4 + 1.4 * (0.5 + 0.5 * Math.sin(t * (0.8 + b.i * 0.13) + b.i));
      b.set({ pos: [mp[0] - 2.2 + b.i * 0.36, mp[1] - 1.3 + h / 2, mp[2] + 0.09], size: [0.2, h, 0.02], color: '#ffa340', emissive: 1.2, group: G.auto });
    }
  });
  const graph: Vec3[] = [];
  for (let i = 0; i <= 16; i++) graph.push([mp[0] + 1.6 * 0 - 2.4 + i * 0.3, mp[1] + 0.85 + Math.sin(i * 0.9) * 0.25 + (i % 3) * 0.07, mp[2] + 0.1]);
  s.wire(graph, 0.05, G.auto, '#ffb35a', 3);
  s.light([mp[0], mp[1], mp[2] + 3], '#ffb066', 4, 7, G.auto);

  // cables: sensor → controller → actuator / motor / monitor
  const fy = Y + 0.07;
  s.wire([[-14, fy, -1.95], [-14, fy, -5.5], [-12.5, fy, -6.7]], 0.12, G.auto);
  s.wire([[-11, fy, -6.7], [-7, fy, -6.2], [ax, fy, -4.9]], 0.12, G.auto);
  s.wire([[-13.5, fy, -6.7], [-21, fy, -5.8], [-24, fy, 1.6]], 0.12, G.auto);
  s.wire([[-10.4, Y + 4.2, cz], [-4, Y + 5.6, -6.5], [mp[0] - 2.8, mp[1], mp[2]]], 0.08, G.auto);

  s.label('sense', [-14, Y + 3.3, 0], 'automation');
  s.label('process', [cx, Y + 6.2, cz], 'automation');
  s.label('decide', [cx - 0.75, Y + 2.35, cz + 0.8], 'automation');
  s.label('act', [ax, beltY + 1.7, -3.4], 'automation');
  s.label('monitor', [mp[0], mp[1] + 2.2, mp[2]], 'automation');
  s.light([-10, Y + 8, 3], '#ff8a2a', 7, 12, G.auto);
  s.light([-22, Y + 6, 4], '#ffb066', 4, 8, G.auto);

  // ======================= ROBOT CELL =======================
  const RB: Vec3 = [14, Y, 3.2];
  s.box({ pos: [RB[0], Y + 0.4, RB[2]], size: [2.4, 0.8, 2.4], color: '#16191c', metal: 0.4, rough: 0.5 });
  s.cyl({ pos: [RB[0], Y + 1.05, RB[2]], size: [2.1, 0.5, 2.1], color: '#2b2f35', metal: 0.6, rough: 0.35 });
  s.cyl({ pos: [RB[0], Y + 1.32, RB[2]], size: [2.12, 0.05, 2.12], color: ORANGE, emissive: 0.18, group: G.robot });
  // pallet where parts are placed
  const pallet: Vec3 = [17.6, Y + 0.5, 6.6];
  s.box({ pos: pallet, size: [2.6, 0.24, 2.6], color: '#3a332b', rough: 0.8 });
  for (const d of [-1, 0, 1]) s.box({ pos: [pallet[0] + d * 1.1, Y + 0.2, pallet[2]], size: [0.3, 0.4, 2.6], color: '#2c2721', rough: 0.85 });
  s.box({ pos: [pallet[0] - 0.6, Y + 1.07, pallet[2] - 0.5], size: [1.2, 0.9, 1.2], color: '#2a2e34', metal: 0.4, rough: 0.45 });
  // safety fence posts
  for (const [x, z] of [[19.5, -1.5], [19.5, 9.5], [9, 9.5]]) {
    s.box({ pos: [x, Y + 1.4, z], size: [0.18, 2.8, 0.18], color: '#d9871f', rough: 0.5 });
  }
  s.light([RB[0] - 2, Y + 7, RB[2] + 4], '#ff9a3c', 7, 10, G.robot);
  s.light([RB[0] + 4, Y + 4, RB[2] - 2], '#cfd8ff', 2.5, 8, G.robot);

  const L1 = 3.6, L2 = 3.0;
  const arm = {
    turret: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: '#c9ced4' }, true),
    housing: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: '#c9ced4' }),
    shoulder: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: GRAPHITE }, true),
    shoulderRing: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: ORANGE }, true),
    upper: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: '#c9ced4' }),
    upperStripe: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: ORANGE }),
    elbow: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: GRAPHITE }, true),
    elbowRing: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: ORANGE }, true),
    fore: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: '#c9ced4' }),
    wrist: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: GRAPHITE }, true),
    flange: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: STEEL }, true),
    gripBase: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: GRAPHITE }),
    fingerA: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: STEEL }),
    fingerB: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: STEEL }),
    payload: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: '#2a2e34' }),
    led: dyn({ pos: [0, -999, 0], size: [1, 1, 1], color: '#ffb347' }),
  };
  // keyframes: [progress, yaw, shoulder, elbow, wrist, grip(0 open..1 closed)]
  const yawConv = Math.atan2(9.6 - RB[0], 0 - RB[2]);
  const yawPal = Math.atan2(pallet[0] - RB[0], pallet[2] - RB[2]);
  const K: number[][] = [
    [0.0, yawConv + 0.25, 0.35, 1.25, 1.35, 0],
    [0.16, yawConv, 0.78, 1.08, 1.28, 0],
    [0.26, yawConv, 0.78, 1.08, 1.28, 1],
    [0.42, yawConv + 0.2, 0.28, 1.35, 1.5, 1],
    [0.66, yawPal, 0.3, 1.35, 1.48, 1],
    [0.82, yawPal, 0.9, 1.28, 0.96, 1],
    [0.9, yawPal, 0.9, 1.28, 0.96, 0],
    [1.0, yawPal - 0.15, 0.4, 1.3, 1.4, 0],
  ];
  const pose = (p: number) => {
    let i = 0;
    while (i < K.length - 2 && p > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1];
    const t = smoothstep(a[0], b[0], p);
    return a.map((v, k) => lerp(v, b[k], t));
  };
  const C = (pos: Vec3, size: Vec3, rot: Quat, color: string, metal = 0.3, rough = 0.38, emissive = 0, group: number = G.robot): PartSpec => ({ pos, size, rot, color, metal, rough, emissive, group });
  const lj: Record<'j1' | 'j2' | 'j3', Vec3> = { j1: [...RB] as Vec3, j2: [...RB] as Vec3, j3: [...RB] as Vec3 };
  const setV = (dst: Vec3, src: Vec3) => { dst[0] = src[0]; dst[1] = src[1]; dst[2] = src[2]; };
  s.label('j1', lj.j1, 'robotics');
  s.label('j2', lj.j2, 'robotics');
  s.label('j3', lj.j3, 'robotics');
  s.updaters.push((t, st) => {
    const p = clamp(st.progress.robotics ?? 0, 0, 1);
    const [, yaw, a2, a3, a5, grip] = pose(p);
    const idle = st.reduced ? 0 : Math.sin(t * 0.9) * 0.03;
    const q1 = qY(yaw + idle);
    const base: Vec3 = [RB[0], Y + 1.35, RB[2]];
    arm.turret(C(add(base, [0, 0.5, 0]), [1.7, 1.0, 1.7], q1, '#c9ced4'));
    arm.housing(C(add(base, qRot(q1, [0, 1.0, -0.2])), [1.3, 1.0, 1.3], q1, '#2b2f35', 0.5, 0.4));
    const sh = add(base, qRot(q1, [0, 1.55, 0]));
    const jointRot = (q: Quat) => qMul(q, qZ(Math.PI / 2));
    arm.shoulder(C(sh, [1.15, 1.5, 1.15], jointRot(q1), GRAPHITE, 0.5, 0.4));
    arm.shoulderRing(C(sh, [1.22, 0.12, 1.22], jointRot(q1), ORANGE, 0.3, 0.4, 0.7));
    const q2 = qMul(q1, qX(a2 + idle * 0.5));
    arm.upper(C(add(sh, qRot(q2, [0, L1 / 2, 0])), [0.72, L1, 0.82], q2, '#c9ced4'));
    arm.upperStripe(C(add(sh, qRot(q2, [0, L1 / 2, 0.42])), [0.5, L1 * 0.7, 0.03], q2, ORANGE, 0.2, 0.4, 0.5));
    const el = add(sh, qRot(q2, [0, L1, 0]));
    arm.elbow(C(el, [0.95, 1.05, 0.95], jointRot(q2), GRAPHITE, 0.5, 0.4));
    arm.elbowRing(C(el, [1.02, 0.1, 1.02], jointRot(q2), ORANGE, 0.3, 0.4, 0.7));
    const q3 = qMul(q2, qX(a3 - idle * 0.7));
    arm.fore(C(add(el, qRot(q3, [0, L2 / 2, 0])), [0.56, L2, 0.62], q3, '#c9ced4'));
    const wr = add(el, qRot(q3, [0, L2, 0]));
    arm.wrist(C(wr, [0.66, 0.78, 0.66], jointRot(q3), GRAPHITE, 0.5, 0.4));
    const q5 = qMul(q3, qX(a5));
    arm.flange(C(add(wr, qRot(q5, [0, 0.45, 0])), [0.55, 0.22, 0.55], q5, STEEL, 1, 0.25));
    arm.led(C(add(wr, qRot(q5, [0, 0.62, 0.28])), [0.16, 0.08, 0.05], q5, '#ffb347', 0, 0.3, 2));
    const gb = add(wr, qRot(q5, [0, 0.72, 0]));
    arm.gripBase(C(gb, [1.0, 0.26, 0.5], q5, GRAPHITE, 0.4, 0.4));
    const open = lerp(0.62, 0.4, grip);
    arm.fingerA(C(add(gb, qRot(q5, [open, 0.38, 0])), [0.12, 0.62, 0.42], q5, STEEL, 1, 0.3));
    arm.fingerB(C(add(gb, qRot(q5, [-open, 0.38, 0])), [0.12, 0.62, 0.42], q5, STEEL, 1, 0.3));
    const carrying = p > 0.25 && p < 0.88;
    arm.payload(carrying
      ? C(add(gb, qRot(q5, [0, 0.82, 0])), [0.7, 0.62, 0.7], q5, '#2a2e34', 0.4, 0.45)
      : C([0, -999, 0], [0, 0, 0], QI, '#000'));
    robotReadout.j1 = ((yaw + idle) * 180) / Math.PI;
    robotReadout.j2 = (a2 * 180) / Math.PI;
    robotReadout.j3 = (a3 * 180) / Math.PI;
    setV(lj.j1, add(base, [0.9, 0.6, 0]));
    setV(lj.j2, sh);
    setV(lj.j3, el);
  });

  // ======================= CONNECTED SYSTEMS =======================
  const EDGE: Vec3 = [27, Y, -9];
  s.cyl({ pos: [EDGE[0], Y + 2.25, EDGE[2]], size: [0.3, 4.5, 0.3], color: STEEL, metal: 1, rough: 0.35 });
  s.box({ pos: [EDGE[0], Y + 4.8, EDGE[2]], size: [2.0, 1.2, 1.0], color: GRAPHITE, metal: 0.4, rough: 0.4, label: 14, group: G.iot });
  for (const d of [-0.7, 0.7]) s.cyl({ pos: [EDGE[0] + d, Y + 6.0, EDGE[2]], size: [0.09, 1.3, 0.09], color: '#2b2f35', rough: 0.4 });
  s.box({ pos: [EDGE[0], Y + 4.6, EDGE[2] + 0.51], size: [1.2, 0.12, 0.02], color: '#ffb347', emissive: 1.8, group: G.iot });

  const NET: Vec3 = [38, Y, 2];
  const H = 13;
  for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    s.box({ pos: [NET[0] + dx * 0.7, Y + H / 2, NET[2] + dz * 0.7], size: [0.16, H, 0.16], color: '#8b929b', metal: 1, rough: 0.4 });
  }
  for (let h = 1.2; h < H; h += 1.6) {
    for (const [dx, dz, rot] of [[0, -0.63, 0], [0, 0.63, 0], [-0.63, 0, Math.PI / 2], [0.63, 0, Math.PI / 2]] as [number, number, number][]) {
      s.box({ pos: [NET[0] + dx, Y + h, NET[2] + dz], size: [1.3, 0.08, 0.08], rot: qMul(qY(rot), qZ(0.6)), color: '#7d848d', metal: 1, rough: 0.45 });
    }
  }
  s.cyl({ pos: [NET[0], Y + H + 0.5, NET[2]], size: [0.35, 1.0, 0.35], color: '#ffb347', emissive: 2.5, group: G.iot });
  for (let i = 0; i < 3; i++) s.wire(ring([NET[0], Y + H + 0.3, NET[2]], 1.6 + i * 1.4, 48), 0.05, G.iot, '#ffb347', 3, i * 4);
  s.light([NET[0], Y + H, NET[2]], '#ffa040', 6, 10, G.iot);

  const DATA: Vec3 = [32, Y, 15];
  for (const d of [-1.1, 1.1]) {
    s.box({ pos: [DATA[0] + d, Y + 2.6, DATA[2]], size: [1.9, 5.2, 1.4], color: '#16191d', metal: 0.4, rough: 0.35 });
    for (let i = 0; i < 11; i++) s.box({ pos: [DATA[0] + d, Y + 0.6 + i * 0.42, DATA[2] - 0.71], size: [1.5, 0.05, 0.02], color: '#ffae4a', emissive: i % 3 === 0 ? 2 : 0.8, group: G.iot });
  }
  s.light([DATA[0], Y + 4, DATA[2] - 3], '#ff9a3c', 4, 8, G.iot);

  const DASH: Vec3 = [20, Y + 8.5, 17];
  s.box({ pos: DASH, size: [6.4, 3.8, 0.12], color: '#0b0d10', metal: 0.3, rough: 0.2 });
  for (let i = 0; i < 12; i++) {
    const h = 0.4 + ((i * 37) % 11) / 11 * 1.8;
    s.box({ pos: [DASH[0] - 2.75 + i * 0.5, DASH[1] - 1.5 + h / 2, DASH[2] - 0.08], size: [0.28, h, 0.02], color: '#ffa340', emissive: 1.1, group: G.iot });
  }
  const dg: Vec3[] = [];
  for (let i = 0; i <= 20; i++) dg.push([DASH[0] - 2.9 + i * 0.29, DASH[1] + 1.1 + Math.sin(i * 0.7) * 0.3, DASH[2] - 0.09]);
  s.wire(dg, 0.05, G.iot, '#ffb35a', 3);

  const DEV: Vec3 = [RB[0], Y + 6.6, RB[2]];
  const hop = (a: Vec3, b: Vec3, lift: number, ph: number) => s.wire(arc(a, b, lift), 0.08, G.iot, '#ffb347', 3, ph);
  hop(DEV, [EDGE[0], Y + 5.4, EDGE[2]], 4, 0);
  hop([EDGE[0], Y + 5.4, EDGE[2]], [NET[0], Y + H, NET[2]], 3, 10);
  hop([NET[0], Y + H, NET[2]], [DATA[0], Y + 5.5, DATA[2]], 3, 20);
  hop([DATA[0], Y + 5.5, DATA[2]], [DASH[0] + 3.2, DASH[1], DASH[2]], 2, 30);

  // field of connected devices
  const nd = low ? 16 : 40;
  for (let i = 0, g = 0; i < nd && g < 400; g++) {
    const a = R() * Math.PI * 2, r = 9 + R() * 22;
    const x = 26 + Math.cos(a) * r, z = 4 + Math.sin(a) * r;
    if (x < 8 || (Math.abs(x - 32) < 3 && Math.abs(z - 15) < 3) || (Math.abs(x - 38) < 2.5 && Math.abs(z - 2) < 2.5)) continue;
    const h = 0.6 + R() * 3.2;
    s.box({ pos: [x, Y + h / 2, z], size: [0.7, h, 0.7], color: '#1a1d21', metal: 0.4, rough: 0.45 });
    s.box({ pos: [x, Y + h + 0.05, z], size: [0.72, 0.1, 0.72], color: '#ffb347', emissive: 1.2, group: G.iot });
    if (i % 3 === 0) s.wire(arc([x, Y + h + 0.1, z], [EDGE[0], Y + 5.4, EDGE[2]], 2 + R() * 3, 18), 0.04, G.iot, '#ffb347', 3, R() * 50);
    i++;
  }
  s.label('device', DEV, 'iot');
  s.label('edge', [EDGE[0], Y + 7.2, EDGE[2]], 'iot');
  s.label('network', [NET[0], Y + H + 1.6, NET[2]], 'iot');
  s.label('data', [DATA[0], Y + 6.2, DATA[2]], 'iot');
  s.label('dashboard', [DASH[0], DASH[1] + 2.5, DASH[2]], 'iot');

  // ======================= DAMPER MONITORING RIG =======================
  const D: Vec3 = [-32, Y, -14];
  const dy = Y + 3.4, dl = 9, dw = 3.2;
  const galv = '#8f969e';
  s.box({ pos: [D[0], dy + dw / 2, D[2]], size: [dl, 0.1, dw], color: galv, metal: 0.9, rough: 0.4, label: PATTERN.brushed });
  s.box({ pos: [D[0], dy - dw / 2, D[2]], size: [dl, 0.1, dw], color: galv, metal: 0.9, rough: 0.4, label: PATTERN.brushed });
  s.box({ pos: [D[0], dy, D[2] - dw / 2], size: [dl, dw, 0.1], color: galv, metal: 0.9, rough: 0.4 });
  s.box({ pos: [D[0], dy, D[2] + dw / 2], size: [dl, dw, 0.1], color: galv, metal: 0.9, rough: 0.4 });
  for (const ex of [-dl / 2, dl / 2]) {
    s.box({ pos: [D[0] + ex, dy + dw / 2 + 0.15, D[2]], size: [0.18, 0.3, dw + 0.6], color: '#6f767e', metal: 1, rough: 0.35 });
    s.box({ pos: [D[0] + ex, dy - dw / 2 - 0.15, D[2]], size: [0.18, 0.3, dw + 0.6], color: '#6f767e', metal: 1, rough: 0.35 });
    s.box({ pos: [D[0] + ex, dy, D[2] - dw / 2 - 0.15], size: [0.18, dw + 0.6, 0.3], color: '#6f767e', metal: 1, rough: 0.35 });
    s.box({ pos: [D[0] + ex, dy, D[2] + dw / 2 + 0.15], size: [0.18, dw + 0.6, 0.3], color: '#6f767e', metal: 1, rough: 0.35 });
  }
  for (const ex of [-3, 3]) s.box({ pos: [D[0] + ex, Y + (dy - dw / 2 - Y) / 2, D[2]], size: [0.3, dy - dw / 2 - Y, 2.4], color: GRAPHITE, metal: 0.4 });
  s.cyl({ pos: [D[0] + 2.4, dy, D[2] + 0.4], size: [0.16, dw + 1.6, 0.16], rot: qX(Math.PI / 2), color: '#d5d9de', metal: 1, rough: 0.2 });
  const blade = dyn({ pos: [D[0] + 2.4, dy, D[2]], size: [0.06, dw - 0.2, dw - 0.2], color: '#b5bbc2', metal: 1, rough: 0.3 });
  s.box({ pos: [D[0] + 2.4, dy, D[2] + dw / 2 + 0.85], size: [1.1, 1.1, 0.9], color: '#202327', metal: 0.4, rough: 0.4 });
  s.box({ pos: [D[0] + 2.4, dy + 0.56, D[2] + dw / 2 + 0.85], size: [0.8, 0.04, 0.6], color: ORANGE, emissive: 0.5, group: G.damper });
  s.cyl({ pos: [D[0] + 2.4, dy, D[2] + dw / 2 + 1.5], size: [0.6, 0.45, 0.6], rot: qX(Math.PI / 2), color: '#2b2f35', metal: 0.5, rough: 0.35 });
  const sensorLed = dyn({ pos: [D[0] + 2.4, dy + 0.2, D[2] + dw / 2 + 1.75], size: [0.14, 0.14, 0.04], color: '#ffb347', emissive: 2, group: G.damper });
  s.updaters.push((t, st) => {
    const cyc = st.reduced ? 0.5 : (Math.sin(t * 0.55) + 1) / 2;
    const open = smoothstep(0.2, 0.8, cyc);
    blade({ pos: [D[0] + 2.4, dy, D[2]], size: [0.06, dw - 0.2, dw - 0.2], rot: qZ(open * Math.PI / 2), color: '#b5bbc2', metal: 1, rough: 0.3 });
    sensorLed({ pos: [D[0] + 2.4, dy + 0.2, D[2] + dw / 2 + 1.75], size: [0.14, 0.14, 0.04], color: open > 0.5 ? '#ffb347' : '#5b6068', emissive: open > 0.5 ? 2 : 0.2, group: G.damper });
  });
  // controller, logger and monitor
  const LG: Vec3 = [-25, Y, -11];
  s.cyl({ pos: [LG[0], Y + 1.6, LG[2]], size: [0.25, 3.2, 0.25], color: STEEL, metal: 1, rough: 0.35 });
  s.box({ pos: [LG[0], Y + 3.6, LG[2]], size: [1.8, 1.3, 0.7], color: '#1d2024', metal: 0.4, rough: 0.4, label: 15, group: G.damper });
  s.box({ pos: [LG[0], Y + 3.7, LG[2] + 0.36], size: [1.1, 0.5, 0.02], color: '#ffcf8f', emissive: 1.0, group: G.damper });
  const MON: Vec3 = [-21, Y + 4.6, -14.5];
  s.box({ pos: [MON[0], Y + 2.0, MON[2] - 0.2], size: [0.2, 4.0, 0.2], color: GRAPHITE });
  s.box({ pos: MON, size: [3.4, 2.1, 0.1], color: '#0b0d10', rough: 0.25 });
  const mg: Vec3[] = [];
  for (let i = 0; i <= 14; i++) mg.push([MON[0] - 1.45 + i * 0.21, MON[1] + (i % 4 < 2 ? 0.5 : -0.4), MON[2] + 0.07]);
  s.wire(mg, 0.05, G.damper, '#ffb35a', 3);
  s.wire([[D[0] + 2.4, dy - 0.4, D[2] + dw / 2 + 1.7], [D[0] + 2.4, Y + 0.07, D[2] + dw / 2 + 1.9], [LG[0], Y + 0.07, LG[2] + 0.2], [LG[0], Y + 3.0, LG[2] + 0.2]], 0.1, G.damper);
  s.wire([[LG[0] + 0.9, Y + 3.6, LG[2]], [MON[0] - 0.8, Y + 3.8, LG[2] - 1.5], [MON[0] - 1.6, MON[1], MON[2]]], 0.08, G.damper);
  s.light([D[0] + 3, dy + 3, D[2] + 5], '#ff9a3c', 6, 10, G.damper);
  s.light([LG[0], Y + 5, LG[2] + 3], '#ffb066', 3, 6, G.damper);

  // ======================= R&D BENCH =======================
  const BN: Vec3 = [-30, Y, 14];
  s.box({ pos: [BN[0], Y + 2.3, BN[2]], size: [8, 0.22, 3.6], color: '#1b1d20', metal: 0.3, rough: 0.5 });
  s.box({ pos: [BN[0], Y + 2.19, BN[2] + 1.81], size: [8, 0.2, 0.04], color: ORANGE, emissive: 0.08, group: G.rnd });
  for (const [dx, dz] of [[-3.8, -1.6], [3.8, -1.6], [-3.8, 1.6], [3.8, 1.6]]) s.box({ pos: [BN[0] + dx, Y + 1.1, BN[2] + dz], size: [0.18, 2.2, 0.18], color: '#2a2e33', metal: 0.6 });
  // oscilloscope
  s.box({ pos: [BN[0] - 2.6, Y + 3.05, BN[2] - 0.8], size: [2.0, 1.3, 1.3], color: '#202328', metal: 0.3, rough: 0.4 });
  s.box({ pos: [BN[0] - 2.85, Y + 3.1, BN[2] - 0.14], size: [1.2, 0.8, 0.02], color: '#0e1a14', emissive: 0.15, group: G.rnd });
  const wave: Vec3[] = [];
  for (let i = 0; i <= 24; i++) wave.push([BN[0] - 3.4 + i * 0.046, BN[1] + 3.1 + (i % 6 < 3 ? 0.22 : -0.22), BN[2] - 0.12]);
  s.wire(wave, 0.03, G.rnd, '#ffc06a', 3);
  // exploded prototype
  const DV: Vec3 = [BN[0] + 1.2, Y + 2.62, BN[2]];
  const layer = (spec: PartSpec) => ({ spec, set: dyn(spec) });
  const layers = [
    layer({ pos: DV, size: [3.0, 0.42, 2.0], color: '#1e2125', metal: 0.3, rough: 0.45 }),
    layer({ pos: DV, size: [2.7, 0.08, 1.7], color: '#0e1214', rough: 0.4 }),
    layer({ pos: DV, size: [1.9, 0.3, 1.1], color: '#3b424b', metal: 0.5, rough: 0.35 }),
    layer({ pos: DV, size: [3.0, 0.3, 2.0], color: '#b6bcc3', metal: 1, rough: 0.28, label: PATTERN.brushed }),
    layer({ pos: DV, size: [2.2, 0.04, 1.4], color: '#ffcb8a', emissive: 0.7, group: G.rnd }),
  ];
  const chips = [
    layer({ pos: DV, size: [0.7, 0.14, 0.7], color: '#141518', label: 16, group: G.rnd }),
    layer({ pos: DV, size: [0.4, 0.12, 0.3], color: '#141518' }),
    layer({ pos: DV, size: [0.3, 0.1, 0.5], color: '#141518' }),
    layer({ pos: DV, size: [0.5, 0.25, 0.4], color: '#b8bdc3', metal: 1, rough: 0.25 }),
  ];
  const chipOff: Vec3[] = [[0.2, 0, 0], [-0.8, 0, 0.4], [0.9, 0, -0.45], [-1.05, 0, -0.5]];
  s.updaters.push((t, st) => {
    const p = clamp(st.progress.rnd ?? 0, 0, 1);
    const e = Math.pow(Math.sin(p * Math.PI), 0.7) * 1.15 + (st.reduced ? 0 : Math.sin(t * 1.2) * 0.04);
    const ys = [0, 0.32, 0.5, 0.78, 0.96];
    const spin = qY(e * 0.12);
    layers.forEach((l, i) => {
      l.set({ ...l.spec, pos: [DV[0], DV[1] + ys[i] + i * 0.4 * e, DV[2]], rot: spin });
    });
    chips.forEach((c, i) => {
      const o = qRot(spin, chipOff[i]);
      c.set({ ...c.spec, pos: [DV[0] + o[0], DV[1] + 0.38 + 0.4 * e + c.spec.size[1] / 2, DV[2] + o[2]], rot: spin });
    });
  });
  s.light([BN[0] + 1, Y + 6, BN[2] + 4], '#ffa24a', 6, 9, G.rnd);
  s.light([BN[0] - 3, Y + 5, BN[2] - 3], '#d8e2ff', 2, 7, G.rnd);

  // hanging work lights over the floor
  for (const [x, z] of [[-6, 6], [10, -6], [26, 6], [-28, 0]]) s.light([x, Y + 12, z], '#ffe2bd', 3, 18, G.ambient);

}
