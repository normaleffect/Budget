import { money, pct, esc, fullMonth, labelMonth, uid } from '../format.js';
import { card, cardHead, stat, note, chip, row, barChart, lineChart, sectionLabel, fMoney, fText, fSelect, openSheet } from '../ui.js';
import { setState } from '../state.js';

export const title = 'Cash Flow';
export const subtabs = [['12', 'Next 12'], ['24', 'Next 24'], ['events', 'One-offs']];
export const subtitle = (s, c) => {
  const r = c.sim.rows.slice(0, 12);
  const total = r.reduce((a, x) => a + x.surplus, 0);
  return `${money(total, { compact: true })} of free cash over the next 12 months`;
};

export function render(s, c, tab = '12') {
  if (tab === 'events') return renderEvents(s, c);
  const n = tab === '24' ? 24 : 12;
  const rows = c.sim.rows.slice(0, n);

  const surpluses = rows.map((r) => r.surplus);
  const cashLine = rows.map((r) => r.cash);
  const nw = rows.map((r) => r.netWorth);

  const chart = card(`${cardHead('Money left over each month', `<span class="mut" style="font-size:12px">${n} months</span>`)}
    ${barChart(surpluses, { height: 150, labels: rows.map((r, i) => (i % (n === 24 ? 4 : 2) === 0 ? labelMonth(r.key) : '')), colorFor: (v) => (v >= 0 ? 'green' : 'red') })}
    <div class="legend"><span><i style="background:var(--green)"></i>Surplus</span><span><i style="background:var(--red)"></i>Shortfall</span></div>
    <div class="divider"></div>
    <div class="grid-3">
      ${stat('Best month', money(Math.max(...surpluses)), labelMonth(rows[surpluses.indexOf(Math.max(...surpluses))].key), 'tight')}
      ${stat('Worst month', money(Math.min(...surpluses)), labelMonth(rows[surpluses.indexOf(Math.min(...surpluses))].key), 'tight')}
      ${stat('Total', money(surpluses.reduce((a, b) => a + b, 0), { compact: true }), 'over the period', 'tight')}
    </div>`);

  const balances = card(`${cardHead('Cash and net worth climbing')}
    ${lineChart([{ data: cashLine, color: 'blue' }, { data: nw, color: 'green' }], { height: 150, labels: rows.map((r, i) => (i % (n === 24 ? 6 : 3) === 0 ? labelMonth(r.key) : '')) })}
    <div class="legend"><span><i style="background:var(--blue)"></i>Cash in the bank</span><span><i style="background:var(--green)"></i>Net worth</span></div>`);

  const table = card(`${cardHead('Month by month', '<span class="mut" style="font-size:12px">tap a row</span>')}
    <div class="scroll-x"><table class="tbl">
      <thead><tr><th>Month</th><th>In</th><th>Out</th><th>Left</th><th>Cash</th><th>Net worth</th></tr></thead>
      <tbody>${rows.map((r) => `<tr data-month="${r.key}" style="cursor:pointer">
        <td>${labelMonth(r.key, true)} ${r.evIn ? '<span class="chip g" style="padding:1px 6px;font-size:10px">in</span>' : ''}${r.evOut ? '<span class="chip a" style="padding:1px 6px;font-size:10px">out</span>' : ''}</td>
        <td>${money(r.takeHome + r.evIn, { compact: true })}</td>
        <td>${money(r.cashExpenses + r.minPayments + r.evOut, { compact: true })}</td>
        <td class="${r.surplus >= 0 ? 'pos' : 'neg'}">${money(r.surplus, { compact: true })}</td>
        <td>${money(r.cash, { compact: true })}</td>
        <td>${money(r.netWorth, { compact: true })}</td></tr>`).join('')}</tbody>
    </table></div>`);

  const insight = buildInsight(s, c, rows);

  return `<div class="stack">${chart}${balances}${insight}${table}</div>`;
}

function buildInsight(s, c, rows) {
  const neg = rows.filter((r) => r.surplus < 0);
  const first = rows[0];
  const out = [];
  if (neg.length) out.push(note('r', `${neg.length} month${neg.length > 1 ? 's' : ''} run negative`, `Worst is ${labelMonth(neg[0].key, true)} at ${money(neg[0].surplus)}. Move a one-off expense or trim a category to smooth it.`));
  else out.push(note('g', 'Every month clears', `Even the tightest month in this window leaves ${money(Math.min(...rows.map((r) => r.surplus)))} on the table. That is a rare position and it is the whole reason the rest of this plan works.`));
  const bigIn = rows.filter((r) => r.evIn > 0);
  if (bigIn.length) out.push(note('b', 'Windfall landing', bigIn.map((r) => `${money(r.evIn)} in ${labelMonth(r.key, true)}`).join(', ') + '. It is already allocated in the roadmap on the Home tab, not sitting loose.'));
  return out.join('');
}

/* ============ one-off events ============ */
function renderEvents(s, c) {
  const list = [...s.events].sort((a, b) => a.month.localeCompare(b.month));
  const items = list.map((e) => `<div class="row tap" data-edit-event="${e.id}">
    <div class="pill-ico" style="background:var(--${e.direction === 'in' ? 'green' : 'amber'}-dim);color:var(--${e.direction === 'in' ? 'green' : 'amber'})">${e.direction === 'in' ? '↓' : '↑'}</div>
    <div class="grow"><div class="r-title">${esc(e.name)}</div><div class="r-sub">${fullMonth(e.month)}${e.note ? ` · ${esc(e.note)}` : ''}</div></div>
    <div class="r-val num ${e.direction === 'in' ? 'pos' : ''}">${e.direction === 'in' ? '+' : '-'}${money(e.amount)}</div></div>`).join('');

  return `<div class="stack">
    ${card(`${cardHead('Money arriving or leaving once')}${items || '<div class="empty">Nothing scheduled</div>'}
      <div class="btn-row"><button class="btn wide primary" data-add-event>+ Add a one-off</button></div>`)}
    ${note('b', 'Use this for the lumpy stuff', 'Tax refunds, the Christmas trip, a new HVAC, braces, a bonus that lands as one check, property tax if it is not escrowed, back-to-school. Anything that hits one month and then disappears belongs here rather than in the monthly budget.')}
    ${card(`${cardHead('The refund decision')}
      <div class="tiny" style="line-height:1.6">
      You have ${money(10000)} coming and three sensible ways to use it. Here is how they actually compare:
      </div>
      <div class="divider"></div>
      ${optionRow('Your original plan', 'Dad $3,000, rest to emergency fund', 'Safe, simple, leaves 22.9% debt running', 'a')}
      ${optionRow('What I would do', 'Dad $3,000 → misc debt $5,000 → $2,000 starter fund', 'The 22.9% debt is costing you about $95 a month in pure interest. Killing it is a guaranteed 22.9% return, better than any investment you can buy. With your surplus the emergency fund refills inside 60 days anyway.', 'g')}
      ${optionRow('The aggressive version', 'Dad $3,000, then $7,000 split across misc debt and the truck', 'Frees the most monthly cash flow but leaves you with nothing banked. With a brand new job in the house, I would not.', 'r')}`)}
  </div>`;
}

const optionRow = (title, plan, why, tone) => `<div class="note ${tone}" style="margin-bottom:10px">
  <h4>${esc(title)}</h4><div style="font-weight:650;margin-bottom:4px">${esc(plan)}</div>
  <div style="color:var(--text-2)">${esc(why)}</div></div>`;

export function mount(el, s, c, rerender) {
  el.querySelectorAll('[data-month]').forEach((n) => n.addEventListener('click', () => showMonth(s, c, n.dataset.month)));
  el.querySelectorAll('[data-edit-event]').forEach((n) => n.addEventListener('click', () => editEvent(s, n.dataset.editEvent, rerender)));
  el.querySelector('[data-add-event]')?.addEventListener('click', () => {
    const id = uid('ev');
    setState((st) => st.events.push({ id, name: 'New one-off', amount: 0, month: st.meta.startMonth, direction: 'out', note: '' }));
    editEvent(s, id, rerender);
  });
}

function showMonth(s, c, key) {
  const r = c.sim.rows.find((x) => x.key === key); if (!r) return;
  const line = (k, v, cls = '') => `<div class="kv"><span class="k">${esc(k)}</span><span class="v ${cls}">${v}</span></div>`;
  openSheet(fullMonth(key), `
    ${line('Gross income', money(r.gross))}
    ${line('Taxes', `-${money(r.taxes)}`, 'neg')}
    ${line('401(k) + retirement', `-${money(r.deferral + r.solo + r.rothIra + r.hsa)}`, 'neg')}
    ${line('Health insurance', `-${money(r.health)}`, 'neg')}
    <div class="kv total"><span class="k">Take-home</span><span class="v pos">${money(r.takeHome)}</span></div>
    ${r.evIn ? line('One-off money in', `+${money(r.evIn)}`, 'pos') : ''}
    ${line('Living expenses', `-${money(r.cashExpenses)}`, 'neg')}
    ${line('Debt minimums', `-${money(r.minPayments)}`, 'neg')}
    ${r.evOut ? line('One-off money out', `-${money(r.evOut)}`, 'neg') : ''}
    <div class="kv total"><span class="k">Free this month</span><span class="v ${r.surplus >= 0 ? 'pos' : 'neg'}">${money(r.surplus)}</span></div>
    <div class="section-label" style="margin-left:0">Where it went</div>
    ${r.allocations.length ? r.allocations.map((a) => `<div class="kv"><span class="k">${a.type === 'debt' ? '⛓️' : a.type === 'sweep' ? '📈' : '🎯'} ${esc(a.name)}</span><span class="v">${money(a.amount)}</span></div>`).join('') : '<div class="tiny">Nothing left to allocate.</div>'}
    <div class="section-label" style="margin-left:0">End of month</div>
    ${line('Cash on hand', money(r.cash))}
    ${line('Retirement + investments', money(r.accounts.k401 + r.accounts.solo + r.accounts.rothira + r.accounts.broker))}
    ${line('Debt remaining', money(r.liabilities), r.liabilities > 0 ? 'neg' : 'pos')}
    <div class="kv total"><span class="k">Net worth</span><span class="v">${money(r.netWorth)}</span></div>
    <div class="btn-row"><button class="btn primary wide" data-close>Close</button></div>`);
}

function editEvent(s, id, rerender) {
  const e = s.events.find((x) => x.id === id); if (!e) return;
  const idx = s.events.indexOf(e);
  const months = Array.from({ length: 36 }, (_, i) => {
    const [y, m] = s.meta.startMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + i, 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return [k, fullMonth(k)];
  });
  openSheet('Edit one-off', `
    ${fText('What is it', `events.${idx}.name`, e.name)}
    ${fMoney('Amount', `events.${idx}.amount`, e.amount)}
    ${fSelect('Direction', `events.${idx}.direction`, e.direction, [['in', 'Money coming in'], ['out', 'Money going out']])}
    ${fSelect('Month', `events.${idx}.month`, e.month, months)}
    ${fText('Note', `events.${idx}.note`, e.note || '')}
    <div class="btn-row"><button class="btn danger wide" data-del="events.${id}">Delete</button><button class="btn primary wide" data-close>Done</button></div>`, rerender);
}
