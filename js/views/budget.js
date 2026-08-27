import { money, pct, esc, uid, sum, fullMonth, labelMonth, addMonths } from '../format.js';
import { card, cardHead, stat, note, chip, row, donut, barChart, lineChart, sectionLabel, fMoney, fNum, fText, fSelect, fSwitch, openSheet, closeSheet, progress } from '../ui.js';
import { setState } from '../state.js';

export const title = 'Budget';
export const subtabs = [['overview', 'Overview'], ['track', 'Track'], ['income', 'Income'], ['spending', 'Spending'], ['payroll', 'Paycheck']];
export const subtitle = (s, c) => `${money(c.now.monthlyTakeHome)} in · ${money(c.now.monthlyExpenses)} out · ${money(c.now.monthlySurplus)} free`;

export function render(s, c, tab = 'overview') {
  if (tab === 'track') return renderTrack(s, c);
  if (tab === 'income') return renderIncome(s, c);
  if (tab === 'spending') return renderSpending(s, c);
  if (tab === 'payroll') return renderPayroll(s, c);
  return renderOverview(s, c);
}

/* ================= OVERVIEW ================= */
function renderOverview(s, c) {
  const t = c.snap.tax, gross = c.snap.grossIncome;
  const monthly = (v) => money(v / 12);
  const waterfall = [
    { label: 'Gross household income', v: gross, color: 'green', big: true },
    { label: 'Federal income tax', v: -t.fedIncomeTax, color: 'red' },
    { label: 'Payroll tax (Social Security + Medicare)', v: -t.ficaEmployee, color: 'red' },
    { label: 'Self-employment tax on eBay', v: -t.seTax, color: 'red' },
    { label: 'Georgia income tax', v: -t.gaTax, color: 'red' },
    { label: 'Health insurance premium', v: -t.healthPremium, color: 'blue' },
    { label: 'Retirement contributions', v: -(c.snap.deferral + c.snap.soloEmployee + c.snap.soloEmployer + c.snap.hsa + c.snap.rothIra), color: 'violet' },
    { label: 'Take-home pay', v: c.snap.netCash, color: 'green', big: true },
    { label: 'Living expenses', v: -c.exp.cashMonthly * 12, color: 'amber' },
    { label: 'Debt minimums', v: -minDebt(s) * 12, color: 'amber' },
    { label: 'Free to build with', v: c.now.monthlySurplus * 12, color: 'green', big: true }
  ];

  const wf = card(`${cardHead('Where every dollar goes', '<span class="mut" style="font-size:12px">per year · per month</span>')}
    ${waterfall.map((w) => `<div class="kv ${w.big ? 'total' : ''}">
      <span class="k" style="${w.big ? 'font-weight:700;color:var(--text)' : ''}">${esc(w.label)}</span>
      <span class="v ${w.v < 0 ? 'neg' : w.big ? 'pos' : ''}">${money(w.v, { sign: w.v > 0 && !w.big })} <small class="mut" style="font-weight:500">${monthly(w.v)}/mo</small></span></div>`).join('')}`);

  const groups = c.exp.groups;
  const dn = card(`${cardHead('Spending mix')}
    ${donut(groups.map((g, i) => ({ value: g.monthly, color: ['blue', 'violet', 'amber', 'teal', 'pink'][i % 5] })), {
      size: 158, thickness: 24,
      center: `<div><div class="num" style="font-size:20px;font-weight:750">${money(c.exp.totalMonthly)}</div><div class="tiny">a month</div></div>`
    })}
    <div class="legend" style="justify-content:center;margin-top:16px">
      ${groups.map((g, i) => `<span><i style="background:var(--${['blue', 'violet', 'amber', 'teal', 'pink'][i % 5]})"></i>${esc(g.name)} ${money(g.monthly)}</span>`).join('')}
    </div>`);

  const health = card(`${cardHead('Health check')}
    ${healthRow('Housing cost', c.exp.groups.find((g) => g.name === 'Housing')?.monthly || 0, c.now.monthlyTakeHome, 0.28, 'Under 28% of take-home is comfortable')}
    ${healthRow('All debt payments', minDebt(s) + (s.expenses.find((e) => e.id === 'mortgage')?.monthly || 0), c.now.monthlyTakeHome, 0.36, 'Under 36% keeps you flexible')}
    ${healthRow('Total living expenses', c.exp.cashMonthly, c.now.monthlyTakeHome, 0.5, 'Half your pay or less means real freedom')}
    <div class="divider"></div>
    <div class="kv"><span class="k">Savings rate</span><span class="v pos">${pct(c.now.savingsRate, 0)}</span></div>
    <div class="tiny" style="margin-top:6px">Most households save under 10%. Anything over 25% puts financial independence in play within 20 years.</div>`);

  return `<div class="stack">
    <div class="grid-2">
      ${stat('Take-home', money(c.now.monthlyTakeHome), 'per month')}
      ${stat('Free cash', `<span class="pos">${money(c.now.monthlySurplus)}</span>`, 'per month after everything')}
    </div>
    ${wf}${dn}${health}</div>`;
}

function healthRow(label, v, base, threshold, hint) {
  const p = base ? (v / base) * 100 : 0;
  const ok = p <= threshold * 100;
  return `<div style="padding:10px 0;border-bottom:1px solid var(--border-soft)">
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span style="font-size:14px;font-weight:600">${esc(label)}</span>
      <span class="num" style="font-weight:700;color:var(--${ok ? 'green' : 'amber'})">${pct(p, 0)}</span></div>
    ${progress(Math.min(p, 100), 100, ok ? 'green' : 'amber')}
    <div class="tiny" style="margin-top:5px">${esc(hint)} · you are at ${money(v)}/mo</div></div>`;
}

/* ================= INCOME ================= */
function renderIncome(s, c) {
  const items = s.income.map((i) => {
    const mo = i.annual / 12;
    return `<div class="row tap" data-edit-income="${i.id}">
      <div class="pill-ico" style="background:var(--${i.color || 'green'}-dim);color:var(--${i.color || 'green'})">${i.kind === 'se' ? '📦' : '💼'}</div>
      <div class="grow"><div class="r-title">${esc(i.name)}</div>
        <div class="r-sub">${esc(i.who)} · ${i.kind === 'se' ? 'Self-employed (1099)' : 'W-2'}${i.note ? ` · ${esc(i.note)}` : ''}</div></div>
      <div class="r-val num">${money(mo)}<small>${money(i.annual)}/yr</small></div></div>`;
  }).join('');

  const totals = card(`${cardHead('Gross household income')}
    ${items}
    <div class="kv total"><span class="k">Total</span><span class="v">${money(c.snap.grossIncome)} <small class="mut" style="font-weight:500">${money(c.snap.grossIncome / 12)}/mo</small></span></div>
    <div class="btn-row"><button class="btn wide" data-add-income>+ Add income source</button></div>`);

  const match = card(`${cardHead('Employer money')}
    ${row({ icon: '🎁', iconBg: 'var(--green-dim)', title: '401(k) match', sub: `${s.payroll.matchPct}% of pay, captured at your current ${s.payroll.deferralPct}% deferral`, value: money(c.snap.employerMatch), valueSub: 'per year' })}
    ${row({ icon: '🚗', iconBg: 'var(--blue-dim)', title: 'Company car + gas', sub: 'Worth roughly $9,000–$12,000 a year you never have to earn', value: 'free', valueSub: 'not taxed to you' })}
    ${s.payroll.deferralPct < s.payroll.matchPct ? note('r', 'Match not maxed', `Raise her deferral to ${s.payroll.matchPct}% to collect the whole thing.`) : ''}`);

  const seCard = c.snap.sePro > 0 ? card(`${cardHead('eBay income reality check')}
    <div class="kv"><span class="k">Gross profit reported</span><span class="v">${money(c.snap.sePro)}</span></div>
    <div class="kv"><span class="k">Self-employment tax (15.3%)</span><span class="v neg">${money(c.snap.tax.seTax)}</span></div>
    <div class="kv"><span class="k">Income tax on it (${pct(c.snap.tax.marginalFed + c.snap.tax.marginalState, 1)})</span><span class="v neg">${money(c.snap.sePro * (c.snap.tax.marginalFed + c.snap.tax.marginalState) / 100)}</span></div>
    <div class="kv"><span class="k">QBI deduction credit</span><span class="v pos">${money(c.snap.tax.qbi * (c.snap.tax.marginalFed / 100))}</span></div>
    <div class="kv total"><span class="k">Set aside per month</span><span class="v">${money((c.snap.tax.seTax + c.snap.sePro * (c.snap.tax.marginalFed + c.snap.tax.marginalState) / 100 - c.snap.tax.qbi * (c.snap.tax.marginalFed / 100)) / 12)}</span></div>
    ${note('a', 'No one withholds this for you', 'Move roughly 30% of every eBay dollar into a separate account the day it lands, and pay estimated taxes Apr 15, Jun 15, Sep 15 and Jan 15. This is the single most common way self-employed people blow up their April.')}`) : '';

  return `<div class="stack">${totals}${match}${seCard}</div>`;
}

/* ================= SPENDING ================= */
function renderSpending(s, c) {
  const groups = c.exp.groups.map((g, gi) => card(`
    ${cardHead(g.name, `<span class="num mut" style="font-size:13px;font-weight:650">${money(g.monthly)}/mo</span>`)}
    ${g.items.map((e) => `<div class="row tap" data-edit-expense="${e.id}">
      <div class="dot" style="background:var(--${['blue', 'violet', 'amber', 'teal', 'pink'][gi % 5]})"></div>
      <div class="grow"><div class="r-title">${esc(e.name)}</div>
        <div class="r-sub">${e.essential ? 'Essential' : 'Flexible'}${e.payrollDeducted ? ' · taken pre-tax from her check' : ''}${e.note ? ` · ${esc(e.note)}` : ''}</div></div>
      <div class="r-val num">${money(e.monthly)}<small>${money(e.monthly * 12)}/yr</small></div></div>`).join('')}`)).join('');

  const summary = card(`${cardHead('Monthly spending')}
    <div class="grid-3">
      ${stat('Essential', money(c.exp.essential), 'must be paid', 'tight')}
      ${stat('Flexible', money(c.exp.discretionary), 'you control', 'tight')}
      ${stat('Total', money(c.exp.totalMonthly), `${pct(c.now.monthlyTakeHome ? (c.exp.totalMonthly / c.now.monthlyTakeHome) * 100 : 0, 0)} of pay`, 'tight')}
    </div>
    <div class="btn-row"><button class="btn wide primary" data-add-expense>+ Add an expense</button></div>`);

  const missing = note('b', 'Worth adding when you know the numbers',
    `Most families this size also have: car insurance, life insurance (you need term policies now that there is income to protect), kids activities and sports, clothing, subscriptions, home maintenance (budget 1% of home value a year), pet costs, and Christmas/birthdays. Every one you add here makes the forecast more honest.`);

  return `<div class="stack">${summary}${groups}${missing}</div>`;
}

/* ================= PAYCHECK ================= */
function renderPayroll(s, c) {
  const p = s.payroll, t = c.snap.tax;
  const perPaycheck = (v) => money(v / 24);
  const stub = card(`${cardHead("Her paycheck, semi-monthly", '<span class="mut" style="font-size:12px">24 checks a year</span>')}
    <div class="kv"><span class="k">Gross pay</span><span class="v">${perPaycheck(c.snap.w2Gross)}</span></div>
    <div class="kv"><span class="k">401(k) deferral (${p.deferralPct}%)</span><span class="v neg">-${perPaycheck(c.snap.deferral)}</span></div>
    <div class="kv"><span class="k">Health insurance</span><span class="v neg">-${perPaycheck(c.snap.healthPremium)}</span></div>
    ${p.hsaAnnual ? `<div class="kv"><span class="k">HSA</span><span class="v neg">-${perPaycheck(p.hsaAnnual)}</span></div>` : ''}
    <div class="kv"><span class="k">Federal income tax</span><span class="v neg">-${perPaycheck(t.fedIncomeTax * (c.snap.w2Gross / (c.snap.grossIncome || 1)))}</span></div>
    <div class="kv"><span class="k">Social Security + Medicare</span><span class="v neg">-${perPaycheck(t.ficaEmployee)}</span></div>
    <div class="kv"><span class="k">Georgia income tax</span><span class="v neg">-${perPaycheck(t.gaTax * (c.snap.w2Gross / (c.snap.grossIncome || 1)))}</span></div>
    <div class="kv total"><span class="k">Net deposit</span><span class="v pos">${perPaycheck(c.snap.w2Gross - c.snap.deferral - c.snap.healthPremium - p.hsaAnnual - (t.fedIncomeTax + t.gaTax) * (c.snap.w2Gross / (c.snap.grossIncome || 1)) - t.ficaEmployee)}</span></div>
    <div class="tiny" style="margin-top:8px">Estimate based on your full-year tax picture. Real stubs vary because bonuses are usually withheld at a flat 22% federal, which tends to true up at filing.</div>`);

  const settings = card(`${cardHead('Benefit elections')}
    ${fNum('401(k) deferral', 'payroll.deferralPct', p.deferralPct, `Every 1% is ${money(c.snap.w2Gross / 100)} a year, and saves you ${money(c.snap.w2Gross / 100 * t.savingsPerPreTaxDollar / 100)} in tax.`, '%')}
    ${fNum('Employer match', 'payroll.matchPct', p.matchPct, 'Dollar for dollar up to this percent of pay.', '%')}
    ${fMoney('Health insurance premium (monthly)', 'payroll.healthPremiumMonthly', p.healthPremiumMonthly, 'Pull the real number off her benefits packet. This is currently an estimate.')}
    ${fMoney('HSA contribution (annual)', 'payroll.hsaAnnual', p.hsaAnnual, 'Only if her plan is high-deductible. Family limit is $8,750.')}
    ${fMoney('Your Solo 401(k) deferral (annual)', 'payroll.soloEmployeeAnnual', p.soloEmployeeAnnual, 'From eBay profit. Your own separate $24,500 limit.')}
    ${fNum('Solo 401(k) profit sharing', 'payroll.soloEmployerPct', p.soloEmployerPct, 'Up to 20% of net self-employment earnings, on top of the deferral.', '%')}
    ${fMoney('Roth IRA — you (annual)', 'payroll.rothIraYou', p.rothIraYou, '')}
    ${fMoney('Roth IRA — wife (annual)', 'payroll.rothIraSpouse', p.rothIraSpouse, 'Limit is $7,500 each.')}
    ${fMoney('Georgia 529 contributions (annual)', 'payroll.ga529Annual', p.ga529Annual, `Georgia deduction capped at ${money(t.ga529Cap)} for ${s.profile.dependents.length} kids.`)}
    ${fSwitch('Use Roth 401(k) instead of pre-tax', 'Pay tax now, never again. Usually wrong in a 22% bracket.', 'payroll.deferralIsRoth', p.deferralIsRoth)}`);

  const totalSaved = c.snap.retirementAdded;
  const impact = card(`${cardHead('What these elections do')}
    <div class="grid-2">
      ${stat('Into retirement', money(totalSaved), 'per year, all sources')}
      ${stat('Tax saved', money(c.snap.deferral + c.snap.soloEmployee + c.snap.soloEmployer + c.snap.hsa) === money(0) ? money(0) : money((c.snap.deferral + c.snap.soloEmployee + c.snap.soloEmployer) * t.savingsPerPreTaxDollar / 100 + c.snap.hsa * (t.savingsPerPreTaxDollar / 100 + 0.0765)), 'vs contributing nothing')}
    </div>
    <div class="tiny" style="margin-top:10px">Your combined marginal rate is ${pct(t.savingsPerPreTaxDollar, 1)} (${pct(t.marginalFed, 0)} federal + ${pct(t.marginalState, 2)} Georgia). That is what the last dollar you earn is taxed at, and what every pre-tax dollar saves.</div>`);

  return `<div class="stack">${stub}${impact}${settings}</div>`;
}


/* ================= TRACK (planned vs actual) ================= */
function trackMonth(s) { return s.ui.trackMonth || s.meta.startMonth; }

function renderTrack(s, c) {
  const key = trackMonth(s);
  const actuals = s.actuals[key] || {};
  const items = s.expenses.filter((e) => e.active !== false && !e.payrollDeducted);
  const planned = items.reduce((a, e) => a + e.monthly, 0);
  const spent = items.reduce((a, e) => a + (Number(actuals[e.id]) || 0), 0) + (Number(actuals.__extra) || 0);
  const variance = planned - spent;
  const anyLogged = Object.values(actuals).some((v) => Number(v) > 0);

  const nav = `<div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px">
    <button class="icon-btn" data-month-step="-1">‹</button>
    <div style="text-align:center"><div style="font-size:15.5px;font-weight:700">${fullMonth(key)}</div>
      <div class="tiny">${anyLogged ? 'tracking' : 'nothing logged yet'}</div></div>
    <button class="icon-btn" data-month-step="1">›</button></div>`;

  const summary = card(`${cardHead('Planned vs actual')}
    <div class="grid-3" style="margin-bottom:14px">
      ${stat('Budgeted', money(planned), 'this month', 'tight')}
      ${stat('Spent', money(spent), `${pct(planned ? (spent / planned) * 100 : 0, 0)} of budget`, 'tight')}
      ${stat(variance >= 0 ? 'Left' : 'Over', `<span class="${variance >= 0 ? 'pos' : 'neg'}">${money(Math.abs(variance))}</span>`, variance >= 0 ? 'still to spend' : 'over budget', 'tight')}
    </div>
    <div class="bar" style="height:10px"><i style="width:${Math.min(100, planned ? (spent / planned) * 100 : 0)}%;background:var(--${spent > planned ? 'red' : 'green'})"></i></div>
    <div class="tiny" style="margin-top:9px">Take-home this month is ${money(c.now.monthlyTakeHome)}. After ${money(spent)} spent and ${money(minDebt(s))} of debt minimums you have ${money(c.now.monthlyTakeHome - spent - minDebt(s))} left to put to work.</div>`);

  const rows = card(`${cardHead('Log what you actually spent')}
    ${items.map((e) => {
      const act = Number(actuals[e.id]) || 0;
      const over = act > e.monthly;
      return `<div style="padding:11px 0;border-bottom:1px solid var(--border-soft)">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="grow" style="flex:1;min-width:0">
            <div class="r-title">${esc(e.name)}</div>
            <div class="r-sub">Budget ${money(e.monthly)}${act ? ` · ${over ? 'over by ' + money(act - e.monthly) : money(e.monthly - act) + ' left'}` : ''}</div>
          </div>
          <div class="money-in" style="width:118px;flex:none">
            <input class="input" type="number" inputmode="decimal" step="any" style="padding:9px 9px 9px 24px;font-size:15px;text-align:right"
              data-actual="${e.id}" value="${act || ''}" placeholder="0">
          </div>
        </div>
        ${progress(act, e.monthly || 1, over ? 'red' : 'green')}
      </div>`;
    }).join('')}
    <div style="padding:11px 0;display:flex;align-items:center;gap:12px">
      <div class="grow"><div class="r-title">Unplanned / everything else</div><div class="r-sub">The stuff that has no category yet</div></div>
      <div class="money-in" style="width:118px;flex:none">
        <input class="input" type="number" inputmode="decimal" step="any" style="padding:9px 9px 9px 24px;font-size:15px;text-align:right"
          data-actual="__extra" value="${Number(actuals.__extra) || ''}" placeholder="0"></div>
    </div>`);

  const hist = historyCard(s, c);
  const tip = note('b', 'Four minutes, once a week',
    'You do not need to log every receipt. Open your bank app on Sunday, glance at the totals by category, and type them in here. That is the whole habit. It is the difference between a budget you have and a budget you use.');

  return `<div class="stack">${nav}${summary}${rows}${hist}${tip}</div>`;
}

function historyCard(s, c) {
  const keys = Object.keys(s.actuals).sort();
  if (!keys.length) return '';
  const items = s.expenses.filter((e) => !e.payrollDeducted);
  const planned = items.reduce((a, e) => a + e.monthly, 0);
  const data = keys.map((k) => {
    const a = s.actuals[k] || {};
    return Object.values(a).reduce((x, v) => x + (Number(v) || 0), 0);
  });
  return card(`${cardHead('Spending history')}
    ${barChart(data, { height: 130, labels: keys.map((k) => labelMonth(k)), colorFor: (v) => (v > planned ? 'red' : 'green') })}
    <div class="tiny" style="margin-top:8px">Green months came in under the ${money(planned)} budget.</div>`);
}

const minDebt = (s) => s.debts.filter((d) => !d.excludeFromPayoff && d.balance > 0).reduce((a, d) => a + (d.minPayment || 0), 0);

/* ================= sheets ================= */
export function mount(el, s, c, rerender) {
  el.querySelectorAll('[data-month-step]').forEach((n) => n.addEventListener('click', () => {
    const step = Number(n.dataset.monthStep);
    setState((st) => { st.ui.trackMonth = addMonths(trackMonth(st), step); });
    rerender();
  }));
  el.querySelectorAll('[data-actual]').forEach((n) => n.addEventListener('change', () => {
    const key = trackMonth(s), id = n.dataset.actual, v = n.value === '' ? 0 : Number(n.value);
    setState((st) => { st.actuals[key] = st.actuals[key] || {}; if (v) st.actuals[key][id] = v; else delete st.actuals[key][id]; });
    rerender();
  }));
  el.querySelectorAll('[data-edit-income]').forEach((n) => n.addEventListener('click', () => editIncome(s, n.dataset.editIncome, rerender)));
  el.querySelectorAll('[data-edit-expense]').forEach((n) => n.addEventListener('click', () => editExpense(s, n.dataset.editExpense, rerender)));
  el.querySelector('[data-add-income]')?.addEventListener('click', () => {
    const id = uid('inc');
    setState((st) => st.income.push({ id, name: 'New income', who: 'You', kind: 'w2', annual: 0, schedule: 'even', color: 'blue', active: true }));
    editIncome(s, id, rerender);
  });
  el.querySelector('[data-add-expense]')?.addEventListener('click', () => {
    const id = uid('exp');
    setState((st) => st.expenses.push({ id, name: 'New expense', group: 'Living', monthly: 0, essential: false }));
    editExpense(s, id, rerender);
  });
}

function editIncome(s, id, rerender) {
  const i = s.income.find((x) => x.id === id); if (!i) return;
  const idx = s.income.indexOf(i);
  openSheet('Edit income', `
    ${fText('Name', `income.${idx}.name`, i.name)}
    ${fText('Who earns it', `income.${idx}.who`, i.who)}
    ${fMoney('Annual amount', `income.${idx}.annual`, i.annual, `${money(i.annual / 12)} a month`)}
    ${fSelect('Type', `income.${idx}.kind`, i.kind, [['w2', 'W-2 employee'], ['se', 'Self-employed / 1099']], 'Self-employed income pays an extra 15.3% self-employment tax but gets the 20% QBI deduction.')}
    ${fSelect('How it lands', `income.${idx}.schedule`, i.schedule, [['even', 'Evenly all year'], ['quarterly', 'Quarterly'], ['semi', 'Twice a year'], ['annual', 'One lump in January']])}
    ${fText('Note', `income.${idx}.note`, i.note || '')}
    <div class="btn-row"><button class="btn danger wide" data-del="income.${id}">Delete</button><button class="btn primary wide" data-close>Done</button></div>`, rerender);
}

function editExpense(s, id, rerender) {
  const e = s.expenses.find((x) => x.id === id); if (!e) return;
  const idx = s.expenses.indexOf(e);
  openSheet('Edit expense', `
    ${fText('Name', `expenses.${idx}.name`, e.name)}
    ${fMoney('Monthly amount', `expenses.${idx}.monthly`, e.monthly, `${money(e.monthly * 12)} a year`)}
    ${fSelect('Category', `expenses.${idx}.group`, e.group, [['Housing', 'Housing'], ['Living', 'Living'], ['Insurance', 'Insurance'], ['Transport', 'Transport'], ['Kids', 'Kids'], ['Lifestyle', 'Lifestyle'], ['Giving', 'Giving'], ['Other', 'Other']])}
    ${fText('Note', `expenses.${idx}.note`, e.note || '')}
    ${fSwitch('Essential', 'Cannot be cut without real pain', `expenses.${idx}.essential`, e.essential)}
    ${fSwitch('Deducted from her paycheck', 'Pre-tax payroll deduction, not paid from checking', `expenses.${idx}.payrollDeducted`, e.payrollDeducted)}
    <div class="btn-row"><button class="btn danger wide" data-del="expenses.${id}">Delete</button><button class="btn primary wide" data-close>Done</button></div>`, rerender);
}
