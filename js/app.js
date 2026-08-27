import { getState, setState, subscribe, setPath, resetState } from './state.js';
import { compute } from './engine.js';
import { closeSheet, toast } from './ui.js';
import * as home from './views/home.js';
import * as budget from './views/budget.js';
import * as flow from './views/flow.js';
import * as goals from './views/goals.js';
import * as plan from './views/plan.js';

const VIEWS = { home, budget, flow, goals, plan };
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.6V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.6"/><path d="M9.5 21v-6h5v6"/></svg>',
  budget: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>',
  flow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17.5 8.5 11l4 4L21 6"/><path d="M21 10.5V6h-4.5"/></svg>',
  goals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V9"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>'
};

let current = 'home';
const subtabState = { budget: 'overview', flow: '12', goals: 'goals', plan: 'forecast' };

/* ---------- theme ---------- */
function applyTheme() {
  const t = getState().meta.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/* ---------- render ----------
   Scheduled on the next frame so a re-render triggered from inside a blur or
   change handler never rips the focused node out from under the browser. */
let pending = false;
function render() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; doRender(); });
}

function doRender() {
  const s = getState();
  const c = compute(s);
  const view = VIEWS[current];
  const tab = subtabState[current];

  document.getElementById('view-title').textContent = typeof view.title === 'function' ? view.title(s, c) : view.title;
  document.getElementById('view-sub').textContent = view.subtitle ? view.subtitle(s, c) : '';

  const sub = document.getElementById('subnav');
  if (view.subtabs?.length) {
    sub.hidden = false;
    sub.innerHTML = view.subtabs.map(([id, label]) =>
      `<button data-subtab="${id}" aria-selected="${tab === id}">${label}</button>`).join('');
  } else { sub.hidden = true; sub.innerHTML = ''; }

  const el = document.getElementById('view');
  const scroll = window.scrollY;
  el.innerHTML = view.render(s, c, tab);
  view.mount?.(el, s, c, render);
  wireInputs(el);
  if (current === lastRendered) window.scrollTo(0, scroll); else window.scrollTo(0, 0);
  lastRendered = current;

  document.querySelectorAll('#tabbar .tab').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === current));
  applyTheme();
}
let lastRendered = null;

/* ---------- input wiring (shared by views and sheets) ---------- */
function wireInputs(root) {
  root.querySelectorAll('[data-path]').forEach((n) => {
    if (n._wired) return; n._wired = true;
    const commit = () => {
      const v = n.type === 'number' ? (n.value === '' ? 0 : Number(n.value)) : n.value;
      setPath(n.dataset.path, v);
    };
    n.addEventListener('change', () => { commit(); render(); });
    if (n.tagName === 'SELECT') n.addEventListener('input', () => { commit(); render(); });
  });
  root.querySelectorAll('[data-toggle]').forEach((n) => {
    if (n._wired) return; n._wired = true;
    n.addEventListener('click', () => {
      const on = n.getAttribute('aria-checked') === 'true';
      n.setAttribute('aria-checked', String(!on));
      setPath(n.dataset.toggle, !on);
      render();
    });
  });
  root.querySelectorAll('[data-goto]').forEach((n) => {
    if (n._wired) return; n._wired = true;
    n.addEventListener('click', () => {
      current = n.dataset.goto;
      if (n.dataset.subtab) subtabState[current] = n.dataset.subtab;
      render();
    });
  });
  root.querySelectorAll('[data-del]').forEach((n) => {
    if (n._wired) return; n._wired = true;
    n.addEventListener('click', () => {
      const [coll, id] = n.dataset.del.split('.');
      setState((st) => { st[coll] = st[coll].filter((x) => x.id !== id); });
      closeSheet(); render(); toast('Deleted');
    });
  });
  root.querySelectorAll('[data-close]').forEach((n) => {
    if (n._wired) return; n._wired = true;
    n.addEventListener('click', () => { closeSheet(); render(); });
  });
}

/* ---------- boot ---------- */
document.querySelectorAll('#tabbar .tab').forEach((b) => {
  b.querySelector('.tab-ico').innerHTML = ICONS[b.dataset.tab];
  b.addEventListener('click', () => { current = b.dataset.tab; render(); });
});
document.getElementById('subnav').addEventListener('click', (e) => {
  const b = e.target.closest('[data-subtab]'); if (!b) return;
  subtabState[current] = b.dataset.subtab; render();
});
document.getElementById('btn-menu').addEventListener('click', () => {
  current = 'plan'; subtabState.plan = 'settings'; render();
});
document.getElementById('sheet-close').addEventListener('click', () => { closeSheet(); render(); });
document.getElementById('sheet-scrim').addEventListener('click', () => { closeSheet(); render(); });

/* sheets are rendered outside #view, so wire them when they open */
new MutationObserver(() => {
  const b = document.getElementById('sheet-body');
  if (!document.getElementById('sheet').hidden) wireInputs(b);
}).observe(document.getElementById('sheet-body'), { childList: true });

subscribe(() => { /* state saved; views re-render explicitly */ });

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
