import { money, pct, esc, fullMonth, uid, labelMonth } from '../format.js';
import { card, cardHead, stat, note, chip, row, ring, sectionLabel, progress, fMoney, fText, fSelect, fNum, fSwitch, openSheet, barChart } from '../ui.js';
import { setState } from '../state.js';
import { goalCurrent } from './home.js';

export const title = 'Goals & Debt';
export const subtabs = [['goals', 'Goals'], ['debts', 'Debt'], ['accounts', 'Accounts']];
export const subtitle = (s, c) => {
  const done = c.sim.goals.filter((g) => g.doneMonth).length;
  return `${done} of ${c.sim.goals.length} goals funded in the plan`;
};

export function render(s, c, tab = 'goals') {
  if (tab === 'debts') return renderDebts(s, c);
  if (tab === 'accounts') return renderAccounts(s, c);
  return renderGoals(s, c);
}

/* ================= GOALS ================= */
function renderGoals(s, c) {
  const goals = [...c.sim.goals].sort((a, b) => (a.priority || 99) - (b.priority || 99));
  const totalTarget = goals.reduce((a, g) => a + g.target, 0);
  const totalNow = goals.reduce((a, g) => a + goalCurrent(s, g), 0);

  const header = card(`${cardHead('All goals')}
    <div class="grid-2">
      ${stat('Funded so far', money(totalNow), `of ${money(totalTarget)}`)}
      ${stat('Monthly firepower', money(Math.max(0, c.now.monthlySurplus)), 'flows down this list in order')}
    </div>
    <div style="margin-top:12px">${progress(totalNow, totalTarget, 'green')}</div>`);

  const items = goals.map((g, i) => {
    const cur = goalCurrent(s, g);
    const p = g.target ? (cur / g.target) * 100 : 0;
    const eta = g.doneMonth ? fullMonth(g.doneMonth) : 'beyond the horizon';
    const late = g.deadline && g.doneMonth && g.doneMonth > g.deadline;
    return `<div class="card" style="padding:14px">
      <div style="display:flex;gap:13px;align-items:center" class="tap" data-edit-goal="${g.id}">
        ${ring(p, { color: g.color || 'green', size: 56, thickness: 6 })}
        <div class="grow" style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:15.5px;font-weight:680;letter-spacing:-.015em">${g.icon || ''} ${esc(g.name)}</span>
            ${chip('n', `#${g.priority}`)}
          </div>
          <div class="r-sub" style="margin-top:2px">${money(cur)} of ${money(g.target)}${g.linkedDebtId ? ' · paying down debt' : ''}</div>
          <div style="margin-top:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${chip(late ? 'a' : 'g', `On track for ${eta}`)}
            ${g.deadline ? chip(late ? 'r' : 'n', `Want it by ${fullMonth(g.deadline)}`) : ''}
          </div>
        </div>
      </div>
      ${g.note ? `<div class="tiny" style="margin-top:10px;border-top:1px solid var(--border-soft);padding-top:9px">${esc(g.note)}</div>` : ''}
    </div>`;
  }).join('');

  const how = note('b', 'How the money flows',
    `Every month, after bills and debt minimums, whatever is left runs down this list top to bottom. Goal #1 fills completely before #2 gets a dollar. Once everything is funded, the leftover sweeps into ${esc(s.accounts.find((a) => a.id === s.assumptions.surplusSweep)?.name || 'your brokerage')}. Drag priorities by editing the number on each goal.`);

  return `<div class="stack">${header}${how}${sectionLabel('In priority order')}${items}
    ${card(`<button class="btn wide primary" data-add-goal>+ Add a goal</button>`)}</div>`;
}

/* ================= DEBTS ================= */
function renderDebts(s, c) {
  const debts = s.debts.filter((d) => !d.excludeFromPayoff);
  const mortgage = s.debts.find((d) => d.excludeFromPayoff);
  const total = debts.reduce((a, d) => a + d.balance, 0);
  const monthlyInterest = debts.reduce((a, d) => a + d.balance * (d.apr / 100 / 12), 0);

  const head = card(`${cardHead('Non-mortgage debt')}
    <div class="hero-value num" style="font-size:34px;color:${total > 0 ? 'var(--red)' : 'var(--green)'}">${money(total)}</div>
    <div class="hero-sub">${chip('a', `${money(monthlyInterest)}/mo in pure interest`)} ${c.milestones.debtFreeMonth ? chip('g', `Debt free ${fullMonth(c.milestones.debtFreeMonth)}`) : ''}</div>`);

  const list = [...debts].sort((a, b) => b.apr - a.apr).map((d, i) => {
    const off = c.sim.rows.find((r) => (r.debts[d.id] ?? 0) < 1)?.key;
    const tone = d.apr >= 15 ? 'red' : d.apr > 0 ? 'amber' : 'blue';
    return `<div class="row tap" data-edit-debt="${d.id}">
      <div class="pill-ico" style="background:var(--${tone}-dim);color:var(--${tone})">${i + 1}</div>
      <div class="grow"><div class="r-title">${esc(d.name)}</div>
        <div class="r-sub">${pct(d.apr, 2)} APR · ${money(d.minPayment)}/mo minimum${off ? ` · gone ${fullMonth(off)}` : ''}</div>
        ${progress(0, 1, tone)}</div>
      <div class="r-val num">${money(d.balance)}<small>${money(d.balance * d.apr / 100 / 12)}/mo interest</small></div></div>`;
  }).join('');

  const strategy = card(`${cardHead('Payoff strategy')}
    ${fSelect('Method', 'assumptions.payoffMethod', s.assumptions.payoffMethod, [['avalanche', 'Avalanche — highest rate first (cheapest)'], ['snowball', 'Snowball — smallest balance first (fastest wins)']], 'Your goal priorities on the Goals tab actually control the order. This sets the tie-break.')}
    ${note('g', 'Why the 22.9% debt goes first', `Paying it off is a guaranteed, tax-free 22.9% return. The stock market has averaged about 10% before tax. There is no investment on earth that reliably beats retiring that balance, and it is costing you ${money((s.debts.find((d) => d.id === 'misc')?.balance || 0) * 0.229 / 12)} a month just to exist.`)}`);

  const mtgCard = card(`${cardHead('Mortgage')}
    ${row({ icon: '🏠', iconBg: 'var(--blue-dim)', title: 'Home loan', sub: mortgage?.balance ? `${pct(mortgage.apr, 2)} APR` : 'Add your balance and rate to track home equity', value: money(mortgage?.balance || 0) })}
    ${row({ icon: '💵', iconBg: 'var(--surface-2)', title: 'Payment', sub: 'Principal, interest, taxes and insurance', value: money(s.expenses.find((e) => e.id === 'mortgage')?.monthly || 0), valueSub: 'per month' })}
    <div class="btn-row"><button class="btn wide" data-edit-debt="${mortgage?.id || ''}">Enter mortgage details</button></div>
    <div class="tiny" style="margin-top:10px">Do not rush this one. At a normal mortgage rate, every extra dollar aimed here earns you the mortgage rate risk-free, while the same dollar in her 401(k) gets an instant ${pct(c.snap.tax.savingsPerPreTaxDollar, 0)} tax break plus decades of growth. Fill the retirement accounts first, then decide.</div>`);

  const totalInterest = card(`${cardHead('What debt is costing you')}
    <div class="grid-2">
      ${stat('This year', money(monthlyInterest * 12), 'interest if nothing changes')}
      ${stat('Under the plan', money(estimateInterest(c)), 'because you kill it fast')}
    </div>`);

  return `<div class="stack">${head}${card(list || '<div class="empty">No debt. Outstanding.</div>')}${totalInterest}${strategy}${mtgCard}
    ${card(`<button class="btn wide" data-add-debt>+ Add a debt</button>`)}</div>`;
}

function estimateInterest(c) {
  return c.sim.rows.slice(0, 12).reduce((a, r) => a + (r.interestPaid || 0), 0);
}

/* ================= ACCOUNTS ================= */
function renderAccounts(s, c) {
  const groups = { cash: 'Cash', retirement: 'Retirement', invest: 'Investments', education: 'Education', property: 'Property' };
  const byKind = {};
  for (const a of s.accounts) (byKind[a.kind] = byKind[a.kind] || []).push(a);

  const nw = card(`${cardHead('Net worth today')}
    <div class="hero-value num" style="font-size:34px">${money(c.now.netWorth)}</div>
    <div class="hero-sub">${chip('g', `${money(c.now.assets)} assets`)} ${chip('r', `${money(c.now.liabilities)} debts`)}</div>
    <div class="divider"></div>
    <div class="tiny">In 12 months this plan puts you at ${money(c.sim.rows[11].netWorth)}. In 5 years, ${money(c.sim.rows[59].netWorth)}.</div>`);

  const cards = Object.entries(groups).filter(([k]) => byKind[k]?.length).map(([kind, label]) => card(`
    ${cardHead(label, `<span class="num mut" style="font-size:13px;font-weight:650">${money(byKind[kind].reduce((a, x) => a + x.balance, 0))}</span>`)}
    ${byKind[kind].map((a) => `<div class="row tap" data-edit-account="${a.id}">
      <div class="grow"><div class="r-title">${esc(a.name)}</div><div class="r-sub">${a.apy ? `${pct(a.apy, 1)} assumed growth` : ''}${a.note ? ` · ${esc(a.note)}` : ''}</div></div>
      <div class="r-val num">${money(a.balance)}</div></div>`).join('')}`)).join('');

  return `<div class="stack">${nw}${cards}
    ${note('b', 'Keep these honest', 'Update balances once a month, on the same day. That single habit does more for your finances than any app feature. It takes four minutes and it is the difference between a plan and a wish.')}
    ${card(`<button class="btn wide" data-add-account>+ Add an account</button>`)}</div>`;
}

/* ================= mount ================= */
export function mount(el, s, c, rerender) {
  el.querySelectorAll('[data-edit-goal]').forEach((n) => n.addEventListener('click', () => editGoal(s, n.dataset.editGoal, rerender)));
  el.querySelectorAll('[data-edit-debt]').forEach((n) => n.addEventListener('click', () => n.dataset.editDebt && editDebt(s, n.dataset.editDebt, rerender)));
  el.querySelectorAll('[data-edit-account]').forEach((n) => n.addEventListener('click', () => editAccount(s, n.dataset.editAccount, rerender)));
  el.querySelector('[data-add-goal]')?.addEventListener('click', () => {
    const id = uid('goal');
    setState((st) => st.goals.push({ id, name: 'New goal', target: 1000, priority: (Math.max(0, ...st.goals.map((g) => g.priority || 0)) + 1), icon: '🎯', color: 'blue', account: 'hysa', note: '' }));
    editGoal(s, id, rerender);
  });
  el.querySelector('[data-add-debt]')?.addEventListener('click', () => {
    const id = uid('debt');
    setState((st) => st.debts.push({ id, name: 'New debt', balance: 0, apr: 0, minPayment: 0, kind: 'other' }));
    editDebt(s, id, rerender);
  });
  el.querySelector('[data-add-account]')?.addEventListener('click', () => {
    const id = uid('acct');
    setState((st) => st.accounts.push({ id, name: 'New account', kind: 'cash', balance: 0, apy: 0, note: '' }));
    editAccount(s, id, rerender);
  });
}

function editGoal(s, id, rerender) {
  const g = s.goals.find((x) => x.id === id); if (!g) return;
  const idx = s.goals.indexOf(g);
  const accts = s.accounts.map((a) => [a.id, a.name]);
  openSheet('Edit goal', `
    ${fText('Name', `goals.${idx}.name`, g.name)}
    ${fText('Icon', `goals.${idx}.icon`, g.icon || '🎯', 'Any emoji')}
    ${g.auto === 'emergency'
      ? `<div class="field"><label>Target</label><div class="input" style="opacity:.7">${money(s.expenses.reduce((a, e) => a + e.monthly, 0) * s.assumptions.emergencyMonths)} — auto-sized</div><div class="hint">This one resizes itself from your spending. Change the months on the Plan tab.</div></div>`
      : fMoney('Target amount', `goals.${idx}.target`, g.target)}
    ${fNum('Priority', `goals.${idx}.priority`, g.priority, 'Lower number gets funded first.')}
    ${g.linkedDebtId ? '' : fSelect('Save it into', `goals.${idx}.account`, g.account || 'hysa', accts)}
    ${fMoney('Monthly cap (optional)', `goals.${idx}.monthlyCap`, g.monthlyCap || 0, 'Leave at 0 to let it fill as fast as the surplus allows.')}
    ${fText('Note', `goals.${idx}.note`, g.note || '')}
    <div class="btn-row"><button class="btn danger wide" data-del="goals.${id}">Delete</button><button class="btn primary wide" data-close>Done</button></div>`, rerender);
}

function editDebt(s, id, rerender) {
  const d = s.debts.find((x) => x.id === id); if (!d) return;
  const idx = s.debts.indexOf(d);
  openSheet('Edit debt', `
    ${fText('Name', `debts.${idx}.name`, d.name)}
    ${fMoney('Current balance', `debts.${idx}.balance`, d.balance)}
    ${fNum('Interest rate', `debts.${idx}.apr`, d.apr, `Costs ${money(d.balance * d.apr / 100 / 12)} a month at this balance.`, '% APR')}
    ${fMoney('Minimum payment', `debts.${idx}.minPayment`, d.minPayment)}
    ${d.excludeFromPayoff ? fMoney('Principal + interest portion', `debts.${idx}.piPayment`, d.piPayment || 0, 'The part of your mortgage payment that is not taxes and insurance. Used to amortize the balance.') : ''}
    ${fText('Note', `debts.${idx}.openedNote`, d.openedNote || '')}
    <div class="btn-row"><button class="btn danger wide" data-del="debts.${id}">Delete</button><button class="btn primary wide" data-close>Done</button></div>`, rerender);
}

function editAccount(s, id, rerender) {
  const a = s.accounts.find((x) => x.id === id); if (!a) return;
  const idx = s.accounts.indexOf(a);
  openSheet('Edit account', `
    ${fText('Name', `accounts.${idx}.name`, a.name)}
    ${fMoney('Balance', `accounts.${idx}.balance`, a.balance)}
    ${fSelect('Type', `accounts.${idx}.kind`, a.kind, [['cash', 'Cash / savings'], ['retirement', 'Retirement'], ['invest', 'Taxable investments'], ['education', '529 / education'], ['property', 'Property']])}
    ${fNum('Assumed annual growth', `accounts.${idx}.apy`, a.apy, '', '%')}
    ${fText('Note', `accounts.${idx}.note`, a.note || '')}
    <div class="btn-row"><button class="btn danger wide" data-del="accounts.${id}">Delete</button><button class="btn primary wide" data-close>Done</button></div>`, rerender);
}
