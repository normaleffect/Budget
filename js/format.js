export const money = (n, opts = {}) => {
  const { cents = false, sign = false, compact = false } = opts;
  const v = Number.isFinite(n) ? n : 0;
  if (compact && Math.abs(v) >= 1000) {
    const a = Math.abs(v);
    const s = v < 0 ? '-' : (sign ? '+' : '');
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.0+$/, '')}M`;
    return `${s}$${(a / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '')}k`;
  }
  const str = Math.abs(v).toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0
  });
  if (v < 0) return `-${str}`;
  return sign && v > 0 ? `+${str}` : str;
};

export const pct = (n, d = 1) => `${(Number.isFinite(n) ? n : 0).toFixed(d)}%`;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const sum = (arr, f = (x) => x) => arr.reduce((a, b) => a + (f(b) || 0), 0);
export const uid = (p = 'id') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const parseKey = (k) => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1); };
export const addMonths = (k, n) => { const d = parseKey(k); d.setMonth(d.getMonth() + n); return monthKey(d); };
export const monthsBetween = (a, b) => {
  const x = parseKey(a), y = parseKey(b);
  return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth());
};
export const labelMonth = (k, long = false) => {
  const d = parseKey(k);
  return long ? `${MON[d.getMonth()]} ${d.getFullYear()}` : `${MON[d.getMonth()]}${d.getMonth() === 0 ? ` '${String(d.getFullYear()).slice(2)}` : ''}`;
};
export const fullMonth = (k) => { const d = parseKey(k); return `${MON[d.getMonth()]} ${d.getFullYear()}`; };
export const todayKey = () => monthKey(new Date());
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
