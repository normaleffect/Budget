import { money, pct, esc, fullMonth, labelMonth } from '../format.js';
import { card, cardHead, stat, note, chip, row, ring, donut, lineChart, sectionLabel, progress } from '../ui.js';

export const title = 'Home';

export function subtitle(s, c) {
  return `${fullMonth(s.meta.startMonth)} · ${esc(s.meta.householdName)}`;
}

export function render(s, c) {
  const n = c.now;
  const rows12 = c.sim.rows.slice(0, 12);
  const nwSeries = rows12.map((r) => r.netWorth);
  const nw12 = nwSeries[nwSeries.length - 1];

  /* ---- hero ---- */
  const hero = `
    <div class="hero">
      <div class="hero-label">Net worth</div>
      <div class="hero-value num">${money(n.netWorth)}</div>
      <div class="hero-sub">
        ${chip(nw12 >= n.netWorth ? 'g' : 'r', `${money(nw12 - n.netWorth, { sign: true, compact: true })} projected in 12 months`)}
        <span class="mut">→ ${money(nw12, { compact: true })}</span>
      </div>
      <div class="hero-sub" style="margin-top:6px">
        ${chip('n', `${money(n.assets, { compact: true })} owned`)}
        ${chip('n', `${money(n.liabilities, { compact: true })} owed`)}
        ${n.equity ? chip('g', `${money(n.equity, { compact: true })} home equity`) : ''}
      </div>
      <div style="margin-top:14px">${lineChart([{ data: nwSeries, color: 'green' }], { height: 92, labels: rows12.map((r, i) => (i === 0 || i === 11 || i === 6) ? labelMonth(r.key) : ''), formatY: (v) => money(v, { compact: true }) })}</div>
    </div>`;

  /* ---- month at a glance ---- */
  const inflow = n.monthlyTakeHome;
  const out = n.monthlyExpenses + minDebt(s);
  const surplus = inflow - out;
  const act = s.actuals[s.meta.startMonth] || {};
  const spent = Object.values(act).reduce((a, v) => a + (Number(v) || 0), 0);
  const budgeted = s.expenses.filter((e) => !e.payrollDeducted).reduce((a, e) => a + e.monthly, 0);
  const tracked = spent > 0 ? `<div style="margin-top:14px;padding-top:13px;border-top:1px solid var(--border-soft)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:7px">
        <span style="font-size:13.5px;font-weight:600">Actually spent so far</span>
        <span class="num" style="font-weight:700;color:var(--${spent > budgeted ? 'red' : 'green'})">${money(spent)} <small class="mut" style="font-weight:500">of ${money(budgeted)}</small></span></div>
      ${progress(spent, budgeted || 1, spent > budgeted ? 'red' : 'green')}</div>`
    : `<div class="tiny" style="margin-top:12px">Nothing logged this month yet. <span class="link" data-goto="budget" data-subtab="track" style="color:var(--accent);font-weight:650">Track your spending →</span></div>`;

  const glance = card(`
    ${cardHead('This month', `<span class="mut" style="font-size:12px">${fullMonth(s.meta.startMonth)}</span>`)}
    <div class="grid-3" style="margin-bottom:14px">
      ${stat('In', money(inflow), 'after tax', 'tight')}
      ${stat('Out', money(out), 'bills + debt', 'tight')}
      ${stat('Left', `<span class="${surplus >= 0 ? 'pos' : 'neg'}">${money(surplus)}</span>`, `${pct(inflow ? (surplus / inflow) * 100 : 0, 0)} of pay`, 'tight')}
    </div>
    <div class="bar" style="height:10px">
      <i style="width:${bpct(n.monthlyExpenses, inflow)}%;background:var(--blue)"></i>
      <i style="width:${bpct(minDebt(s), inflow)}%;background:var(--red)"></i>
      <i style="width:${bpct(Math.max(0, surplus), inflow)}%;background:var(--green)"></i>
    </div>
    <div class="legend">
      <span><i style="background:var(--blue)"></i>Living ${money(n.monthlyExpenses)}</span>
      <span><i style="background:var(--red)"></i>Debt ${money(minDebt(s))}</span>
      <span><i style="background:var(--green)"></i>Free ${money(Math.max(0, surplus))}</span>
    </div>${tracked}`);

  /* ---- key numbers ---- */
  const invested = s.accounts.filter((a) => ['retirement', 'invest', 'education'].includes(a.kind)).reduce((a, x) => a + x.balance, 0);
  const keyStats = `<div class="grid-2">
    ${stat('Savings rate', pct(n.savingsRate, 0), 'income kept, not spent')}
    ${stat('Effective tax', pct(n.effectiveRate, 1), `${money(c.snap.tax.totalTax)} this year`)}
    ${stat('Emergency fund', money(n.efNow), `of ${money(n.efTarget)} target`)}
    ${stat('Non-mortgage debt', `<span class="${n.nonMortgageDebt > 0 ? 'neg' : 'pos'}">${money(n.nonMortgageDebt)}</span>`, c.milestones.debtFreeMonth ? `clear by ${fullMonth(c.milestones.debtFreeMonth)}` : 'all clear')}
    ${stat('Home equity', `<span class="pos">${money(n.equity)}</span>`, `${pct(n.homeEquityPct, 0)} of ${money(n.homeValue, { compact: true })}`)}
    ${stat('Invested', money(invested), invested ? 'working for you' : 'nothing yet, this is the gap')}
  </div>`;

  /* ---- goal rings ---- */
  const gRows = c.sim.goals.slice(0, 6).map((g) => {
    const cur = goalCurrent(s, g);
    const p = g.target ? (cur / g.target) * 100 : 0;
    return `<div class="row tap" data-goto="goals">
      ${ring(p, { color: g.color || 'green', size: 52, thickness: 5 })}
      <div class="grow"><div class="r-title">${g.icon || ''} ${esc(g.name)}</div>
        <div class="r-sub">${money(cur)} of ${money(g.target)}</div></div>
      <div class="r-val num">${g.doneMonth ? chip('g', fullMonth(g.doneMonth)) : chip('n', 'later')}</div>
    </div>`;
  }).join('');

  /* ---- alerts ---- */
  const alerts = c.alerts.length
    ? sectionLabel('Needs attention') + c.alerts.map((a) => note(a.tone, a.title, esc(a.body))).join('')
    : '';

  /* ---- the plan ---- */
  const plan = card(`
    ${cardHead('The plan, in order')}
    ${planSteps(s, c).map((p, i) => `<div class="row">
      <div class="pill-ico" style="background:var(--${p.color}-dim);color:var(--${p.color});font-weight:700;font-size:13px">${i + 1}</div>
      <div class="grow"><div class="r-title">${esc(p.title)}</div><div class="r-sub">${esc(p.sub)}</div></div>
      <div class="r-val num" style="font-size:13.5px">${p.when}</div></div>`).join('')}`);

  /* ---- opportunities ---- */
  const opps = c.opportunities.slice(0, 3);
  const oppCard = opps.length ? card(`
    ${cardHead('Biggest wins available', `<span class="link" data-goto="plan" data-subtab="taxes">See all</span>`)}
    ${opps.map((o) => `<div class="row"><div class="grow">
      <div class="r-title">${esc(o.title)}</div><div class="r-sub" style="line-height:1.45;margin-top:3px">${esc(o.body)}</div></div>
      ${o.value ? `<div class="r-val num pos">${money(o.value, { compact: true })}<small>a year</small></div>` : ''}</div>`).join('')}`) : '';

  return `<div class="stack">${hero}${glance}${keyStats}
    ${sectionLabel('Goals')}${card(gRows)}
    ${alerts}
    ${sectionLabel('Roadmap')}${plan}
    ${sectionLabel('Advisor')}${oppCard}
    <div class="tiny" style="margin:18px 4px 0">Every figure here recalculates from the numbers on the Budget, Goals and Plan tabs. Change one, it changes everywhere.</div>
  </div>`;
}

/* helpers */
const bpct = (v, total) => (total > 0 ? Math.max(0, Math.min(100, (v / total) * 100)) : 0);
const minDebt = (s) => s.debts.filter((d) => !d.excludeFromPayoff && d.balance > 0).reduce((a, d) => a + (d.minPayment || 0), 0);
export function goalCurrent(s, g) {
  if (g.linkedDebtId) {
    const d = s.debts.find((x) => x.id === g.linkedDebtId);
    if (!d) return 0;
    const start = Math.max(d.balance, g.target || 0);
    return Math.max(0, start - d.balance);
  }
  const acc = s.accounts.find((x) => x.id === g.account);
  return Math.min(acc ? acc.balance : 0, g.target);
}

function planSteps(s, c) {
  const m = c.milestones, when = (k) => (k ? fullMonth(k) : '—');
  const steps = [
    { title: 'Pay Dad his $3,000', sub: 'Straight off the top of the refund. Relationships first.', when: when(m.dadPaidMonth), color: 'amber' },
    { title: 'Bank a $5,000 starter fund', sub: 'So the next flat tire is not a credit card.', when: when(c.sim.goals.find((g) => g.id === 'goal_ef1')?.doneMonth), color: 'blue' },
    { title: 'Wipe out the 22.9% debt', sub: 'A guaranteed 22.9% return. Nothing else comes close.', when: when(c.sim.goals.find((g) => g.id === 'goal_card')?.doneMonth), color: 'red' },
    { title: 'Pay off the truck', sub: 'Kills the $500 payment for good.', when: when(c.sim.goals.find((g) => g.id === 'goal_truck')?.doneMonth), color: 'violet' },
    { title: 'Fund Christmas properly', sub: `${money(5000)} set aside on purpose, not on a card.`, when: when(m.vacationFundedMonth), color: 'teal' },
    { title: `Fill the ${money(c.now.efTarget, { compact: true })} emergency fund`, sub: `${s.assumptions.emergencyMonths} months of everything.`, when: when(m.efFundedMonth), color: 'green' },
    { title: 'Turn the surplus into retirement', sub: 'Max the 401(k), open a Solo 401(k) and two Roth IRAs.', when: 'ongoing', color: 'teal' }
  ];
  return steps;
}
