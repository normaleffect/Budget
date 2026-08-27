import { money, pct, esc, labelMonth } from './format.js';

/* ---------------- generic helpers ---------------- */
export const h = (html) => html;
export const card = (inner, cls = '') => `<div class="card ${cls}">${inner}</div>`;
export const cardHead = (title, right = '') => `<div class="card-head"><h3>${esc(title)}</h3>${right}</div>`;
export const sectionLabel = (t) => `<div class="section-label">${esc(t)}</div>`;
export const stat = (k, v, m = '', cls = '') =>
  `<div class="stat ${cls}"><div class="k">${esc(k)}</div><div class="v num">${v}</div>${m ? `<div class="m">${m}</div>` : ''}</div>`;
export const note = (tone, title, body) =>
  `<div class="note ${tone}">${title ? `<h4>${esc(title)}</h4>` : ''}<div>${body}</div></div>`;
export const chip = (tone, text) => `<span class="chip ${tone}">${text}</span>`;
export const bar = (fracs) => {
  // fracs: [{pct, color}]
  return `<div class="bar">${fracs.map((f) => `<i style="width:${Math.max(0, Math.min(100, f.pct))}%;background:var(--${f.color})"></i>`).join('')}</div>`;
};
export const progress = (v, target, color = 'green') => {
  const p = target > 0 ? (v / target) * 100 : 0;
  return `<div class="bar mini-bar"><i style="width:${Math.max(0, Math.min(100, p))}%;background:var(--${color})"></i></div>`;
};

export const row = ({ icon, iconBg, title, sub, value, valueSub, cls = '', data = '' }) => `
  <div class="row ${cls}" ${data}>
    ${icon ? `<div class="pill-ico" style="background:${iconBg || 'var(--surface-2)'}">${icon}</div>` : ''}
    <div class="grow"><div class="r-title">${title}</div>${sub ? `<div class="r-sub">${sub}</div>` : ''}</div>
    ${value !== undefined ? `<div class="r-val num">${value}${valueSub ? `<small>${valueSub}</small>` : ''}</div>` : ''}
  </div>`;

/* ---------------- charts (dependency-free SVG) ---------------- */
const PAL = ['green', 'blue', 'violet', 'amber', 'teal', 'pink', 'red', 'blue'];

export function lineChart(series, opts = {}) {
  const { height = 160, labels = [], fill = true, zeroLine = true, formatY = (v) => money(v, { compact: true }) } = opts;
  const W = 320, H = height, PADL = 4, PADB = 20, PADT = 10;
  const all = series.flatMap((s) => s.data);
  if (!all.length) return '<div class="empty">No data</div>';
  let min = Math.min(0, ...all), max = Math.max(...all);
  if (max === min) max = min + 1;
  const n = series[0].data.length;
  const x = (i) => PADL + (i / Math.max(1, n - 1)) * (W - PADL * 2);
  const y = (v) => PADT + (1 - (v - min) / (max - min)) * (H - PADT - PADB);

  const paths = series.map((s, si) => {
    const color = s.color || PAL[si % PAL.length];
    const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${d} L${x(n - 1).toFixed(1)},${y(Math.max(min, 0)).toFixed(1)} L${x(0).toFixed(1)},${y(Math.max(min, 0)).toFixed(1)} Z`;
    return `${fill && si === 0 ? `<path d="${area}" fill="url(#g${si})" opacity=".28"/>` : ''}
      <path d="${d}" fill="none" stroke="var(--${color})" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }).join('');

  const defs = series.map((s, si) => `<linearGradient id="g${si}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--${s.color || PAL[si % PAL.length]})" stop-opacity=".9"/>
      <stop offset="100%" stop-color="var(--${s.color || PAL[si % PAL.length]})" stop-opacity="0"/></linearGradient>`).join('');

  const ticks = labels.map((l, i) => l ? `<text class="axis" x="${x(i)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(l)}</text>` : '').join('');
  const zl = zeroLine && min < 0 ? `<line x1="${PADL}" x2="${W - PADL}" y1="${y(0)}" y2="${y(0)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 3"/>` : '';

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px"><defs>${defs}</defs>
    ${zl}${paths}${ticks}
    <text class="axis" x="${PADL}" y="${PADT + 2}" text-anchor="start">${esc(formatY(max))}</text>
  </svg>`;
}

export function barChart(data, opts = {}) {
  const { height = 150, labels = [], colorFor = () => 'green', formatY = (v) => money(v, { compact: true }) } = opts;
  const W = 320, H = height, PADB = 18, PADT = 12;
  if (!data.length) return '<div class="empty">No data</div>';
  const max = Math.max(1, ...data.map((v) => Math.abs(v)));
  const min = Math.min(0, ...data);
  const span = max - Math.min(0, min);
  const bw = (W / data.length);
  const gap = Math.min(5, bw * 0.22);
  const zeroY = PADT + (max / span) * (H - PADT - PADB);
  const bars = data.map((v, i) => {
    const hgt = (Math.abs(v) / span) * (H - PADT - PADB);
    const yy = v >= 0 ? zeroY - hgt : zeroY;
    return `<rect x="${(i * bw + gap / 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - gap).toFixed(1)}" height="${Math.max(1.5, hgt).toFixed(1)}" rx="3" fill="var(--${colorFor(v, i)})" opacity="${v >= 0 ? 1 : .85}"/>`;
  }).join('');
  const ticks = labels.map((l, i) => l ? `<text class="axis" x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${esc(l)}</text>` : '').join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">
    <line x1="0" x2="${W}" y1="${zeroY}" y2="${zeroY}" stroke="var(--border)" stroke-width="1"/>
    ${bars}${ticks}<text class="axis" x="2" y="${PADT - 2}">${esc(formatY(max))}</text></svg>`;
}

export function donut(slices, opts = {}) {
  const { size = 150, thickness = 22, center = '' } = opts;
  const total = slices.reduce((a, b) => a + b.value, 0) || 1;
  const r = (size - thickness) / 2, C = 2 * Math.PI * r;
  let off = 0;
  const rings = slices.map((s, i) => {
    const len = (s.value / total) * C;
    const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--${s.color || PAL[i % PAL.length]})"
      stroke-width="${thickness}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
      stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" stroke-linecap="butt"/>`;
    off += len; return el;
  }).join('');
  return `<div style="position:relative;width:${size}px;height:${size}px;margin:0 auto">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"/>${rings}
    </svg>
    ${center ? `<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;line-height:1.15">${center}</div>` : ''}
  </div>`;
}

export function ring(percent, opts = {}) {
  const { size = 62, thickness = 6, color = 'green', label = '' } = opts;
  const r = (size - thickness) / 2, C = 2 * Math.PI * r;
  const len = Math.max(0, Math.min(1, percent / 100)) * C;
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:none">
    <svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--${color})" stroke-width="${thickness}" stroke-linecap="round"
      stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div style="position:absolute;inset:0;display:grid;place-items:center;font-size:12.5px;font-weight:700" class="num">${label || Math.round(percent) + '%'}</div>
  </div>`;
}

/* ---------------- form controls ---------------- */
export const fMoney = (label, path, value, hint = '') => `
  <div class="field"><label>${esc(label)}</label>
    <div class="money-in"><input class="input" type="number" inputmode="decimal" step="any" data-path="${path}" value="${value ?? 0}"></div>
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
export const fNum = (label, path, value, hint = '', suffix = '') => `
  <div class="field"><label>${esc(label)}${suffix ? ` (${suffix})` : ''}</label>
    <input class="input" type="number" inputmode="decimal" step="any" data-path="${path}" value="${value ?? 0}">
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
export const fText = (label, path, value, hint = '') => `
  <div class="field"><label>${esc(label)}</label>
    <input class="input" type="text" data-path="${path}" value="${esc(value ?? '')}">
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
export const fSelect = (label, path, value, options, hint = '') => `
  <div class="field"><label>${esc(label)}</label>
    <select data-path="${path}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
    ${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
export const fSwitch = (label, sub, path, value) => `
  <div class="switch"><div><div class="sw-l">${esc(label)}</div>${sub ? `<div class="sw-s">${esc(sub)}</div>` : ''}</div>
  <button class="toggle" role="switch" aria-checked="${!!value}" data-toggle="${path}"></button></div>`;
export const fSlider = (label, path, value, min, max, step, display) => `
  <div class="slider-row"><div class="slider-top"><span class="sl-l">${esc(label)}</span><span class="sl-v num" data-slider-out="${path}">${display}</span></div>
  <input type="range" data-slider="${path}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;

/* ---------------- sheet ---------------- */
let sheetOnClose = null;
export function openSheet(title, body, onClose) {
  const sheet = document.getElementById('sheet'), scrim = document.getElementById('sheet-scrim');
  document.getElementById('sheet-title').textContent = title;
  document.getElementById('sheet-body').innerHTML = body;
  sheet.hidden = false; scrim.hidden = false;
  document.body.style.overflow = 'hidden';
  sheetOnClose = onClose || null;
}
export function closeSheet() {
  const sheet = document.getElementById('sheet'), scrim = document.getElementById('sheet-scrim');
  sheet.hidden = true; scrim.hidden = true; document.body.style.overflow = '';
  const cb = sheetOnClose; sheetOnClose = null; if (cb) cb();
}
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(() => { t.hidden = true; }, 1900);
}
export { money, pct, esc, labelMonth };
