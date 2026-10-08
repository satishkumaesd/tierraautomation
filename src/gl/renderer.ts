// WebGL2 renderer for the Tierra electronics world.
// Instanced boxes + cylinders (all components, machines, robot), instanced trace
// ribbons with travelling signal pulses, and a drifting dust layer.
import { lookAt, multiply, perspective, type Mat4, type Vec3 } from './math';
import { GROUP_COUNT, PART_STRIDE, TRACE_STRIDE, type Batch, type SceneData } from '../world/scene';

type GL = WebGL2RenderingContext;

const COMMON = `#version 300 es
precision highp float;
`;

const PART_VS = COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNor;
layout(location=2) in vec2 aUv;
layout(location=3) in vec3 iPos;
layout(location=4) in vec3 iScale;
layout(location=5) in vec4 iRot;
layout(location=6) in vec4 iCol;
layout(location=7) in vec4 iMat;
uniform mat4 uVP;
out vec3 vW; out vec3 vN; out vec4 vCol; out vec4 vMat; out vec2 vUv; out vec3 vL;
vec3 qrot(vec4 q, vec3 v){ vec3 t = 2.0 * cross(q.xyz, v); return v + q.w * t + cross(q.xyz, t); }
void main(){
  vec3 p = qrot(iRot, aPos * iScale) + iPos;
  vN = normalize(qrot(iRot, aNor / max(iScale, vec3(1e-4))));
  vW = p; vCol = iCol; vMat = iMat; vUv = aUv; vL = aPos * iScale;
  gl_Position = uVP * vec4(p, 1.0);
}`;

const LIGHTING = `
uniform vec3 uCam; uniform vec3 uFog; uniform float uFogD; uniform float uExposure; uniform float uTime;
uniform vec3 uKeyDir; uniform vec3 uKeyCol;
uniform vec4 uPL[4]; uniform vec3 uPLc[4];
uniform float uGlow[${GROUP_COUNT}];
uniform vec3 uGlowCol;
vec3 envMap(vec3 r){
  float h = r.y;
  vec3 c = mix(vec3(0.010,0.011,0.014), vec3(0.055,0.058,0.066), smoothstep(-0.3, 0.9, h));
  c += vec3(1.0, 0.52, 0.16) * 0.24 * exp(-pow((h - 0.06) * 5.0, 2.0));
  c += vec3(0.82, 0.87, 0.96) * 0.38 * smoothstep(0.6, 0.98, h);
  return c;
}
vec3 finish(vec3 col, vec3 w){
  float d = length(uCam - w);
  float f = 1.0 - exp(-pow(d * uFogD, 2.0));
  col = mix(col, uFog, clamp(f, 0.0, 1.0));
  col *= uExposure;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  return pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
}
float glowLevel(float g){ int i = int(g + 0.5); return uGlow[i]; }
`;

const PART_FS = COMMON + LIGHTING + `
in vec3 vW; in vec3 vN; in vec4 vCol; in vec4 vMat; in vec2 vUv; in vec3 vL;
uniform sampler2D uAtlas;
out vec4 o;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vW);
  vec3 base = vCol.rgb;
  float emis = vCol.a;
  float metal = vMat.x;
  float rough = clamp(vMat.y, 0.06, 1.0);
  float lvl = glowLevel(vMat.z);
  float label = vMat.w;
  float top = step(0.9, N.y);

  if (label > 0.5 && vUv.x >= 0.0) {
    float id = label - 1.0;
    vec2 cell = vec2(mod(id, 4.0), floor(id / 4.0));
    vec2 uv = (cell + vec2(vUv.x, vUv.y)) / 4.0;
    float t = texture(uAtlas, uv).r;
    base = mix(base, vec3(0.62, 0.63, 0.66), t * 0.9);
    emis += t * 0.12 * lvl;
  } else if (label < -0.5 && top > 0.5) {
    if (label > -1.5) {           // PCB solder mask: ground-pour hatch + speckle
      vec2 q = vW.xz;
      float hatch = smoothstep(0.92, 1.0, abs(sin((q.x + q.y) * 7.0)));
      float speck = hash(floor(q * 18.0)) * 0.06;
      base *= 0.9 + speck + hatch * 0.12;
    } else if (label > -2.5) {    // factory floor: poured resin with joint grid
      vec2 q = vW.xz / 4.0;
      vec2 gd = abs(fract(q) - 0.5);
      float line = smoothstep(0.485, 0.5, max(gd.x, gd.y));
      base = mix(base, base * 1.8 + vec3(0.01), line);
      base *= 0.92 + hash(floor(vW.xz * 2.0)) * 0.08;
    } else if (label > -3.5) {    // brushed metal
      base *= 0.9 + 0.1 * sin(vW.x * 220.0 + hash(vec2(floor(vW.z * 40.0), 1.0)) * 6.0);
    } else {                      // silicon die: lattice of logic blocks
      vec2 q = vW.xz * 16.0;
      vec2 cell = floor(q);
      vec2 big = floor(vW.xz * 2.2);
      float region = hash(big);
      float on = step(0.62 - region * 0.25, hash(cell));
      vec2 f = abs(fract(q) - 0.5);
      float blk = smoothstep(0.44, 0.34, max(f.x, f.y));
      vec2 fb = abs(fract(vW.xz * 2.2) - 0.5);
      float bus = smoothstep(0.47, 0.5, max(fb.x, fb.y));
      base = mix(base, vec3(0.42, 0.33, 0.2), on * blk * 0.55 + bus * 0.5);
      float twinkle = 0.55 + 0.45 * sin(uTime * 2.2 + hash(cell) * 40.0);
      emis += (on * blk * 0.16 * twinkle + bus * 0.35) * lvl;
    }
  }

  float shin = mix(220.0, 8.0, rough);
  vec3 diffC = base * (1.0 - metal);
  vec3 specC = mix(vec3(0.04), base, metal);
  vec3 col = diffC * mix(vec3(0.018, 0.02, 0.024), vec3(0.06, 0.058, 0.056), N.y * 0.5 + 0.5);

  float ndl = max(dot(N, uKeyDir), 0.0);
  vec3 H = normalize(uKeyDir + V);
  float sp = pow(max(dot(N, H), 0.0), shin) * (shin + 8.0) / 30.0;
  col += (diffC * ndl + specC * sp * ndl) * uKeyCol;

  for (int i = 0; i < 4; i++) {
    vec3 Ld = uPL[i].xyz - vW;
    float d = length(Ld);
    Ld /= max(d, 1e-4);
    float att = 1.0 / (1.0 + pow(d / max(uPL[i].w, 0.01), 2.0) * 3.0);
    float nl = max(dot(N, Ld), 0.0);
    float spp = pow(max(dot(N, normalize(Ld + V)), 0.0), shin) * (shin + 8.0) / 30.0;
    col += (diffC * nl + specC * spp * nl) * uPLc[i] * att;
  }

  float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  col += envMap(R) * mix(specC, vec3(1.0), fres * 0.5) * (1.0 - rough * 0.75);

  if (emis > 0.0) col += base * emis * (0.15 + 1.6 * lvl) + uGlowCol * emis * 0.05 * lvl;
  o = vec4(finish(col, vW), 1.0);
}`;

const TRACE_VS = COMMON + `
layout(location=0) in vec2 aQ;
layout(location=1) in vec3 iA;
layout(location=2) in vec3 iB;
layout(location=3) in vec4 iW;
layout(location=4) in vec3 iCol;
uniform mat4 uVP; uniform vec3 uCam; uniform float uFlat; uniform float uHalo;
out float vAlong; out float vAcross; out vec3 vW; out vec3 vCol; out vec4 vInfo;
void main(){
  vec3 d = iB - iA;
  float L = length(d);
  vec3 dir = d / max(L, 1e-5);
  vec3 side = uFlat > 0.5 ? normalize(cross(dir, vec3(0.0, 1.0, 0.0)) + vec3(1e-6))
                          : normalize(cross(dir, normalize(uCam - (iA + iB) * 0.5)) + vec3(1e-6));
  float k = iW.w;
  float w = iW.x * (uHalo > 0.5 ? (k > 2.5 ? 7.0 : 5.5) : 1.0);
  float ext = iW.x * 0.5;
  float s = aQ.x * (L + 2.0 * ext) - ext;
  vec3 p = iA + dir * s + side * aQ.y * w * 0.5;
  if (uFlat > 0.5) p.y += uHalo > 0.5 ? 0.004 : 0.0;
  vAlong = iW.y + s;
  vAcross = aQ.y; vW = p; vCol = iCol; vInfo = iW;
  gl_Position = uVP * vec4(p, 1.0);
}`;

const TRACE_FS = COMMON + LIGHTING + `
in float vAlong; in float vAcross; in vec3 vW; in vec3 vCol; in vec4 vInfo;
uniform float uHalo; uniform float uFlat;
out vec4 o;
void main(){
  float lvl = glowLevel(vInfo.z);
  float kind = vInfo.w;
  float speed = kind > 2.5 ? 9.0 : 5.5;
  float period = kind > 2.5 ? 9.0 : 6.5;
  float jitter = fract(sin(vInfo.y * 12.9898) * 43758.5);
  float f = fract((vAlong - uTime * speed * (0.75 + jitter * 0.5)) / period + jitter);
  float pulse = smoothstep(0.0, 0.03, f) * (1.0 - smoothstep(0.03, 0.32, f));
  float a = abs(vAcross);
  if (uHalo > 0.5) {
    if (kind > 0.5 && kind < 1.5) discard;            // silkscreen never glows
    float core = exp(-a * a * 9.0);
    float steady = kind > 2.5 ? 0.35 : 0.06;
    vec3 c = uGlowCol * core * (pulse * 2.4 + steady) * lvl;
    float d = length(uCam - vW);
    c *= exp(-pow(d * uFogD, 2.0)) * uExposure;
    o = vec4(c, 0.0);
    return;
  }
  vec3 base = vCol;
  vec3 col;
  if (kind > 0.5 && kind < 1.5) {
    col = base * 0.55;                                 // silkscreen ink
  } else {
    vec3 N = uFlat > 0.5 ? vec3(0.0, 1.0, 0.0) : normalize(uCam - vW);
    vec3 V = normalize(uCam - vW);
    float ndl = max(dot(N, uKeyDir), 0.0);
    float sp = pow(max(dot(N, normalize(uKeyDir + V)), 0.0), 60.0);
    col = base * (0.25 + 0.6 * ndl) * uKeyCol + base * 0.08 + vec3(sp) * 0.25 * uKeyCol;
    col *= smoothstep(1.05, 0.55, a) * 0.5 + 0.5;
    col += uGlowCol * (pulse * 1.6 + 0.05) * lvl * smoothstep(1.0, 0.2, a);
  }
  o = vec4(finish(col, vW), 1.0);
}`;

const DUST_VS = COMMON + `
layout(location=0) in vec4 aP;
uniform mat4 uVP; uniform float uTime; uniform vec3 uCam; uniform float uDpr; uniform float uH;
out float vA;
void main(){
  vec3 p = aP.xyz + uCam * vec3(0.0, 0.0, 0.0);
  float sp = 0.3 + aP.w;
  vec3 c = uCam;
  // wrap the dust volume around the camera so it is always present
  vec3 box = vec3(40.0, 26.0, 40.0);
  p = c + mod(p - c + box * 0.5 + vec3(sin(uTime * 0.07 + aP.w * 9.0) * 2.0, uTime * 0.25 * sp, 0.0), box) - box * 0.5;
  vec4 clip = uVP * vec4(p, 1.0);
  gl_PointSize = clamp((1.2 + 3.0 * aP.w) * uDpr * uH * 0.004 / clip.w * 6.0, 1.0, 9.0);
  vA = (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aP.w) + aP.w * 50.0))) * smoothstep(40.0, 6.0, clip.w);
  gl_Position = clip;
}`;

const DUST_FS = COMMON + `
in float vA;
uniform vec3 uColor; uniform float uAlpha;
out vec4 o;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  o = vec4(uColor * a * a * vA * uAlpha, 0.0);
}`;

interface Prog { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> }

export interface FrameParams {
  eye: Vec3;
  target: Vec3;
  fov: number;
  /** lens shift in NDC: moves the subject on screen without moving the camera */
  shift: [number, number];
  time: number;
  glow: Float32Array;
  exposure: number;
  fogDensity: number;
  fog: Vec3;
  dust: number;
}

function boxMesh() {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const faces: [Vec3, Vec3, Vec3][] = [
    [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]],
    [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ];
  for (const [n, u, v] of faces) {
    const b = pos.length / 3;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push((n[0] + u[0] * su + v[0] * sv) * 0.5, (n[1] + u[1] * su + v[1] * sv) * 0.5, (n[2] + u[2] * su + v[2] * sv) * 0.5);
      nor.push(n[0], n[1], n[2]);
      if (n[1] > 0.5) uv.push((su + 1) / 2, 1 - (sv + 1) / 2); else uv.push(-1, -1);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return { pos, nor, uv, idx };
}

function cylMesh(seg: number) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * 0.5, -0.5, s * 0.5, c * 0.5, 0.5, s * 0.5);
    nor.push(c, 0, s, c, 0, s);
    uv.push(-1, -1, -1, -1);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  for (const y of [0.5, -0.5]) {
    const center = pos.length / 3;
    pos.push(0, y, 0); nor.push(0, Math.sign(y), 0); uv.push(-1, -1);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a) * 0.5, y, Math.sin(a) * 0.5); nor.push(0, Math.sign(y), 0); uv.push(-1, -1);
    }
    for (let i = 0; i < seg; i++) {
      if (y > 0) idx.push(center, center + 2 + i, center + 1 + i);
      else idx.push(center, center + 1 + i, center + 2 + i);
    }
  }
  return { pos, nor, uv, idx };
}

function makeAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 1024, 1024);
  const labels = [
    ['TIERRA', 'TA-32 MCU'], ['ESP32-S3', 'WROOM'], ['RS-485', 'XCVR'], ['CAN-FD', 'XCVR'],
    ['FLASH', '16 MB'], ['LDO', '3V3'], ['IMU', '6-DOF'], ['DRV', '8 A'],
    ['TIERRA', 'TA-PWR'], ['MOSFET', 'N-CH'], ['ADC', '24-BIT'], ['PLC', 'CPU 1214'],
    ['ETH', 'PHY'], ['EDGE', 'GATEWAY'], ['TA-LOG', 'RS-485'], ['PROTO', 'REV C'],
  ];
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  labels.forEach(([a, b], i) => {
    const x = (i % 4) * 256 + 128, y = Math.floor(i / 4) * 256 + 128;
    g.font = 'bold 54px "Barlow Condensed", "Arial Narrow", "DejaVu Sans Condensed", sans-serif';
    g.fillText(a, x, y - 26);
    g.font = '600 36px "Barlow Condensed", "Arial Narrow", "DejaVu Sans Condensed", sans-serif';
    g.fillText(b, x, y + 30);
    g.beginPath();
    g.arc(x - 92, y + 82, 9, 0, Math.PI * 2);
    g.fill();
  });
  return c;
}

export class Renderer {
  ok = false;
  gl!: GL;
  width = 1;
  height = 1;
  dpr = 1;
  readonly vp: Mat4 = new Float32Array(16);
  private view: Mat4 = new Float32Array(16);
  private proj: Mat4 = new Float32Array(16);
  private part!: Prog;
  private trace!: Prog;
  private dust!: Prog;
  private vaos: { vao: WebGLVertexArrayObject; inst: WebGLBuffer; batch: Batch; count: number; kind: 'box' | 'cyl' | 'trace' | 'wire' }[] = [];
  private boxIdx = 0;
  private cylIdx = 0;
  private dustVao!: WebGLVertexArrayObject;
  private dustCount = 0;
  private atlas!: WebGLTexture;

  constructor(private canvas: HTMLCanvasElement, private scene: SceneData, private opts: { lowPower: boolean }) {
    try { this.ok = this.init(); } catch (e) { console.warn('[tierra] WebGL init failed', e); this.ok = false; }
  }

  private init(): boolean {
    const gl = this.canvas.getContext('webgl2', { antialias: !this.opts.lowPower || (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance', depth: true });
    if (!gl) return false;
    this.gl = gl;
    this.part = this.program(PART_VS, PART_FS);
    this.trace = this.program(TRACE_VS, TRACE_FS);
    this.dust = this.program(DUST_VS, DUST_FS);

    const box = boxMesh();
    const cyl = cylMesh(this.opts.lowPower ? 14 : 22);
    this.boxIdx = box.idx.length;
    this.cylIdx = cyl.idx.length;
    this.vaos.push(this.partVao(box, this.scene.boxes, 'box'));
    this.vaos.push(this.partVao(cyl, this.scene.cyls, 'cyl'));
    this.vaos.push(this.traceVao(this.scene.traces, 'trace'));
    this.vaos.push(this.traceVao(this.scene.wires, 'wire'));

    const n = this.opts.lowPower ? 260 : 700;
    const d = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { d[i * 4] = Math.random() * 40; d[i * 4 + 1] = Math.random() * 26; d[i * 4 + 2] = Math.random() * 40; d[i * 4 + 3] = Math.random(); }
    this.dustCount = n;
    this.dustVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.dustVao);
    this.buf(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.atlas = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);

    this.resize();
    return true;
  }

  /** Re-draw chip markings once web fonts have arrived. */
  refreshAtlas() {
    if (!this.ok) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeAtlas());
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  private program(vs: string, fs: string): Prog {
    const gl = this.gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader error');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link error');
    const u: Record<string, WebGLUniformLocation | null> = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(p, i);
      if (!info) continue;
      const name = info.name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  private buf(target: number, data: BufferSource, usage: number) {
    const gl = this.gl;
    const b = gl.createBuffer()!;
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, usage);
    return b;
  }

  private partVao(mesh: { pos: number[]; nor: number[]; uv: number[]; idx: number[] }, batch: Batch, kind: 'box' | 'cyl') {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const attr = (loc: number, data: number[], size: number) => {
      this.buf(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr(0, mesh.pos, 3); attr(1, mesh.nor, 3); attr(2, mesh.uv, 2);
    this.buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.idx), gl.STATIC_DRAW);
    const inst = this.buf(gl.ARRAY_BUFFER, batch.data.subarray(0, Math.max(1, batch.count) * PART_STRIDE), gl.DYNAMIC_DRAW);
    const S = PART_STRIDE * 4;
    const layout: [number, number, number][] = [[3, 3, 0], [4, 3, 12], [5, 4, 24], [6, 4, 40], [7, 4, 56]];
    for (const [loc, size, off] of layout) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S, off);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    batch.clearDirty();
    return { vao, inst, batch, count: batch.count, kind };
  }

  private traceVao(batch: Batch, kind: 'trace' | 'wire') {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    this.buf(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    const inst = this.buf(gl.ARRAY_BUFFER, batch.data.subarray(0, Math.max(1, batch.count) * TRACE_STRIDE), gl.DYNAMIC_DRAW);
    const S = TRACE_STRIDE * 4;
    const layout: [number, number, number][] = [[1, 3, 0], [2, 3, 12], [3, 4, 24], [4, 3, 40]];
    for (const [loc, size, off] of layout) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S, off);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
    batch.clearDirty();
    return { vao, inst, batch, count: batch.count, kind };
  }

  resize() {
    if (!this.gl) return;
    const w = this.canvas.clientWidth || innerWidth;
    const h = this.canvas.clientHeight || innerHeight;
    const cap = this.opts.lowPower ? 1.25 : 1.75;
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    if (w === this.width && h === this.height && dpr === this.dpr) return;
    this.width = w; this.height = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private setCommon(P: Prog, f: FrameParams, lights: { pos: Vec3; color: Vec3; radius: number }[]) {
    const gl = this.gl;
    const u = P.u;
    gl.uniformMatrix4fv(u.uVP, false, this.vp);
    gl.uniform3fv(u.uCam, f.eye);
    gl.uniform3fv(u.uFog, f.fog);
    gl.uniform1f(u.uFogD, f.fogDensity);
    gl.uniform1f(u.uExposure, f.exposure);
    gl.uniform1f(u.uTime, f.time);
    gl.uniform3f(u.uKeyDir, -0.42, 0.82, 0.38);
    gl.uniform3f(u.uKeyCol, 0.66, 0.68, 0.72);
    gl.uniform3f(u.uGlowCol, 1.0, 0.46, 0.09);
    if (u.uGlow) gl.uniform1fv(u.uGlow, f.glow);
    if (u.uPL) {
      const pl = new Float32Array(16), pc = new Float32Array(12);
      lights.forEach((l, i) => { pl.set([...l.pos, l.radius], i * 4); pc.set(l.color, i * 3); });
      gl.uniform4fv(u.uPL, pl);
      gl.uniform3fv(u.uPLc, pc);
    }
  }

  render(f: FrameParams) {
    if (!this.ok) return;
    const gl = this.gl;
    this.resize();
    perspective(this.proj, f.fov, this.width / this.height, 0.05, 400);
    this.proj[8] = -f.shift[0];
    this.proj[9] = -f.shift[1];
    lookAt(this.view, f.eye, f.target);
    multiply(this.vp, this.proj, this.view);

    // 4 strongest lights near what the camera is looking at
    const lights = this.scene.lights
      .map((l) => ({ l, d: Math.hypot(l.pos[0] - f.target[0], l.pos[1] - f.target[1], l.pos[2] - f.target[2]) / l.radius }))
      .sort((a, b) => a.d - b.d).slice(0, 4)
      .map(({ l }) => { const k = 0.35 + 0.65 * f.glow[l.group]; return { pos: l.pos, radius: l.radius, color: [l.color[0] * k, l.color[1] * k, l.color[2] * k] as Vec3 }; });
    while (lights.length < 4) lights.push({ pos: [0, -999, 0], radius: 0.01, color: [0, 0, 0] });

    for (const v of this.vaos) {
      const b = v.batch;
      if (b.dirtyTo >= 0) {
        const S = b.stride;
        gl.bindBuffer(gl.ARRAY_BUFFER, v.inst);
        gl.bufferSubData(gl.ARRAY_BUFFER, b.dirtyFrom * S * 4, b.data, b.dirtyFrom * S, (b.dirtyTo - b.dirtyFrom + 1) * S);
        b.clearDirty();
      }
    }

    gl.clearColor(Math.pow(f.fog[0], 1 / 2.2) * f.exposure, Math.pow(f.fog[1], 1 / 2.2) * f.exposure, Math.pow(f.fog[2], 1 / 2.2) * f.exposure, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);

    // solids
    gl.useProgram(this.part.p);
    this.setCommon(this.part, f, lights);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.atlas);
    gl.uniform1i(this.part.u.uAtlas, 0);
    for (const v of this.vaos) {
      if (v.kind !== 'box' && v.kind !== 'cyl') continue;
      if (!v.count) continue;
      gl.bindVertexArray(v.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, v.kind === 'box' ? this.boxIdx : this.cylIdx, gl.UNSIGNED_SHORT, 0, v.count);
    }

    // traces + cables (solid pass)
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.trace.p);
    this.setCommon(this.trace, f, lights);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(-1, -4);
    for (const v of this.vaos) {
      if (v.kind !== 'trace' && v.kind !== 'wire') continue;
      if (!v.count) continue;
      gl.uniform1f(this.trace.u.uFlat, v.kind === 'trace' ? 1 : 0);
      gl.uniform1f(this.trace.u.uHalo, 0);
      gl.bindVertexArray(v.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, v.count);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // glow pass (additive)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    for (const v of this.vaos) {
      if (v.kind !== 'trace' && v.kind !== 'wire') continue;
      if (!v.count) continue;
      gl.uniform1f(this.trace.u.uFlat, v.kind === 'trace' ? 1 : 0);
      gl.uniform1f(this.trace.u.uHalo, 1);
      gl.bindVertexArray(v.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, v.count);
    }

    if (f.dust > 0.01) {
      gl.useProgram(this.dust.p);
      gl.uniformMatrix4fv(this.dust.u.uVP, false, this.vp);
      gl.uniform1f(this.dust.u.uTime, f.time);
      gl.uniform3fv(this.dust.u.uCam, f.eye);
      gl.uniform1f(this.dust.u.uDpr, this.dpr);
      gl.uniform1f(this.dust.u.uH, this.canvas.height);
      gl.uniform3f(this.dust.u.uColor, 1.0, 0.62, 0.25);
      gl.uniform1f(this.dust.u.uAlpha, f.dust * f.exposure);
      gl.bindVertexArray(this.dustVao);
      gl.drawArrays(gl.POINTS, 0, this.dustCount);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
  }
}
