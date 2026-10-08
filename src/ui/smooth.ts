// Lightweight inertial wheel scrolling (desktop only). Native scrolling stays in
// charge for touch, keyboard, scrollbar and reduced motion; this only eases wheel input.
export class SmoothScroll {
  current = scrollY;
  private target = scrollY;
  private running = false;
  private last = 0;
  private ours = false;
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) return;
    addEventListener('wheel', this.onWheel, { passive: false });
    addEventListener('scroll', () => {
      if (this.ours) { this.ours = false; return; }
      if (!this.running) { this.current = this.target = scrollY; }
    }, { passive: true });
  }

  private max() { return document.documentElement.scrollHeight - innerHeight; }

  private onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('dialog, [data-native-scroll], select, textarea')) return;
    if (document.documentElement.classList.contains('menu-open')) return;
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 32;
    else if (e.deltaMode === 2) d *= innerHeight;
    if (!this.running) this.current = scrollY;
    this.target = Math.max(0, Math.min(this.max(), (this.running ? this.target : scrollY) + d));
    this.start();
  };

  scrollTo(y: number) {
    if (!this.enabled) { scrollTo({ top: y, behavior: 'smooth' }); return; }
    this.current = scrollY;
    this.target = Math.max(0, Math.min(this.max(), y));
    this.start();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.step);
  }

  private step = (now: number) => {
    const dt = Math.min(0.12, (now - this.last) / 1000);
    this.last = now;
    const k = 1 - Math.exp(-dt * 7.5);
    this.current += (this.target - this.current) * k;
    if (Math.abs(this.target - this.current) < 0.4) this.current = this.target;
    this.ours = true;
    window.scrollTo(0, this.current);
    if (this.current !== this.target) requestAnimationFrame(this.step);
    else this.running = false;
  };

  get y() { return this.enabled && this.running ? this.current : scrollY; }
}
