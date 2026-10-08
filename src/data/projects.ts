// Projects are data. Add an entry here and the Projects chapter renders it;
// with more than one project a pager appears automatically.
export interface Project {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  /** the signal path shown as the animated diagram */
  flow: string[];
}

export const PROJECTS: Project[] = [
  {
    id: 'damper-monitoring',
    title: 'Damper Position Monitoring System & Data Logger',
    summary: 'Industrial damper state monitoring with open/close timing, RS485 communication and production data logging.',
    tags: ['Open / close timing', 'RS485 communication', 'Production data logging'],
    flow: ['Damper', 'Sensor', 'Controller', 'RS485', 'Logger', 'Monitoring'],
  },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

function projectMarkup(p: Project, i: number, total: number) {
  return `
    <article class="project" data-project="${esc(p.id)}" ${i > 0 ? 'hidden' : ''}>
      <p class="project-kicker">Featured project${total > 1 ? ` · ${i + 1} of ${total}` : ''}</p>
      <h3 class="project-title">${esc(p.title)}</h3>
      <p class="lede">${esc(p.summary)}</p>
      <ul class="chips">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      <ol class="pflow" aria-label="Signal path">
        ${p.flow.map((f, k) => `<li style="--i:${k}"><span>${esc(f)}</span></li>`).join('')}
      </ol>
    </article>`;
}

export function renderProjects(root: HTMLElement) {
  const total = PROJECTS.length;
  root.innerHTML = `
    <p class="eyebrow"><span class="idx">10</span>Projects</p>
    <h2 class="display">
      <span class="mask"><span style="--i:0">Real projects.</span></span>
      <span class="mask"><span style="--i:1">Real impact.</span></span>
    </h2>
    <div class="rise" style="--i:2">${PROJECTS.map((p, i) => projectMarkup(p, i, total)).join('')}</div>
    ${total > 1 ? `<div class="pager rise" style="--i:3"><button type="button" data-prev aria-label="Previous project">‹</button><button type="button" data-next aria-label="Next project">›</button></div>` : ''}`;
  if (total < 2) return;
  let cur = 0;
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-project]'));
  const show = (n: number) => {
    cur = (n + total) % total;
    items.forEach((el, k) => { el.hidden = k !== cur; });
  };
  root.querySelector('[data-prev]')?.addEventListener('click', () => show(cur - 1));
  root.querySelector('[data-next]')?.addEventListener('click', () => show(cur + 1));
}
