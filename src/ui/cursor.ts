// Electronics cursor: orange signal core, light ring, short signal trail, magnetic buttons.
export function setupCursor(reduced: boolean) {
  const root = document.querySelector<HTMLElement>('.cursor');
  if (!root || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.documentElement.classList.add('has-cursor');
  const core = root.querySelector<HTMLElement>('.cursor-core')!;
  const ring = root.querySelector<HTMLElement>('.cursor-ring')!;
  const trailHost = root.querySelector<HTMLElement>('.cursor-trail')!;
  const TRAIL = reduced ? 0 : 7;
  const dots = Array.from({ length: TRAIL }, (_, i) => {
    const d = document.createElement('i');
    d.style.opacity = String(0.5 * (1 - i / TRAIL));
    trailHost.appendChild(d);
    return { el: d, x: 0, y: 0 };
  });
  const p = { x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2 };
  let seen = false;

  addEventListener('pointermove', (e) => {
    p.x = e.clientX; p.y = e.clientY;
    if (!seen) { seen = true; p.rx = p.x; p.ry = p.y; dots.forEach((d) => { d.x = p.x; d.y = p.y; }); root.classList.add('is-on'); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('is-on'));
  document.addEventListener('pointerenter', () => { if (seen) root.classList.add('is-on'); });
  addEventListener('pointerdown', () => root.classList.add('is-down'));
  addEventListener('pointerup', () => root.classList.remove('is-down'));
  document.addEventListener('pointerover', (e) => {
    const hot = (e.target as HTMLElement).closest('a, button, input, select, textarea, label, [role="tab"]');
    root.classList.toggle('is-hot', !!hot);
  });

  const loop = () => {
    const k = reduced ? 1 : 0.22;
    p.rx += (p.x - p.rx) * k;
    p.ry += (p.y - p.ry) * k;
    core.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
    ring.style.transform = `translate3d(${p.rx}px,${p.ry}px,0)`;
    let px = p.x, py = p.y;
    for (const d of dots) {
      d.x += (px - d.x) * 0.45;
      d.y += (py - d.y) * 0.45;
      d.el.style.transform = `translate3d(${d.x}px,${d.y}px,0)`;
      px = d.x; py = d.y;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  if (reduced) return;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-magnetic]'))) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.16}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }
}
