// Careers are data. Add an opening here and the Careers section lists it;
// with none listed, an honest "no current openings" state is shown.
export interface Opening {
  title: string;
  type: string; // e.g. Full-time, Internship, Contract
  location: string;
  summary: string;
}

export const OPENINGS: Opening[] = [];

export const CAREERS_EMAIL = 'info@tierraautomation.in';
export const CAREERS_SUBJECT = 'Career Application - Tierra Automation';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function renderCareers(root: HTMLElement) {
  const mail = (role?: string) =>
    `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(role ? `${CAREERS_SUBJECT} - ${role}` : CAREERS_SUBJECT)}`;
  const list = OPENINGS.length
    ? `<ul class="roles">${OPENINGS.map((o) => `
        <li><div><h4>${esc(o.title)}</h4><p>${esc(o.type)} · ${esc(o.location)}</p><p>${esc(o.summary)}</p></div>
        <a class="btn btn-line" href="${mail(o.title)}">Apply</a></li>`).join('')}</ul>`
    : `<p class="openings-empty">We're always interested in people who enjoy building real technology. Current openings will be published here as they become available.</p>`;
  root.innerHTML = `
    <h3>Current opportunities</h3>
    ${list}
    <a class="btn btn-solid" href="${mail()}" data-magnetic>Send your profile</a>
    <p class="fine">Opens your email app, addressed to ${CAREERS_EMAIL}.</p>`;
}
