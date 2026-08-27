import { calcTaxes } from './tax.js';
import { TAX } from './taxdata.js';
import { sum, addMonths, todayKey, parseKey } from './format.js';

/* ---------- income scheduling ---------- */
const WEIGHTS = {
  even:      Array(12).fill(1 / 12),
  quarterly: [0, 0, 1 / 4, 0, 0, 1 / 4, 0, 0, 1 / 4, 0, 0, 1 / 4],
  annual:    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  semi:      [0, 0, 0, 0, 0, .5, 0, 0, 0, 0, 0, .5]
};
const weightsFor = (item) => (item.customWeights?.length === 12
  ? item.customWeights.map((w) => w / (sum(item.customWeights) || 1))
  : WEIGHTS[item.schedule] || WEIGHTS.even);

/* ---------- annual snapshot for a given year offset ---------- */
export function yearSnapshot(state, yearOffset = 0) {
  const a = state.assumptions, p = state.payroll;
  const grow = (item) => {
    const g = item.kind === 'se' ? (a.ebayGrowthPct ?? 0) : (a.raisePct ?? 0);
    return item.annual * Math.pow(1 + g / 100, yearOffset);
  };
  const active = state.income.filter((i) => i.active !== false);
  const w2Items = active.filter((i) => i.kind === 'w2');
  const seItems = active.filter((i) => i.kind === 'se');
  const otherItems = active.filter((i) => i.kind === 'other');

  const w2Gross = sum(w2Items, grow);
  const sePro = sum(seItems, grow);
  const otherIncome = sum(otherItems, grow);

  const deferral = w2Gross * (p.deferralPct / 100);
  const employerMatch = w2Gross * (Math.min(p.deferralPct, p.matchPct) / 100);
  const seNetEarnings = Math.max(0, sePro) * TAX.federal.seTaxableShare;
  const soloEmployer = seNetEarnings * ((p.soloEmployerPct || 0) / 100);
  const soloEmployee = Math.min(p.soloEmployeeAnnual || 0, TAX.federal.limits.elective401k);
  const healthPremium = (p.healthPremiumMonthly || 0) * 12;
  const otherPreTax = (p.otherPreTaxMonthly || 0) * 12;

  const kids = state.profile.dependents.filter((d) => (d.age + yearOffset) < 17).length;
  const others = state.profile.dependents.length - kids;

  const taxInput = {
    filingStatus: state.profile.filingStatus,
    w2Gross, sePro: sePro + otherIncome,
    trad401k: p.deferralIsRoth ? 0 : deferral,
    roth401k: p.deferralIsRoth ? deferral : 0,
    solo401kEmployee: soloEmployee, solo401kEmployer: soloEmployer,
    hsa: p.hsaAnnual || 0, healthPremium, otherPreTax,
    ga529: p.ga529Annual || 0,
    kidsUnder17: kids, otherDependents: others,
    seOwnerW2Wages: 0
  };
  const tax = calcTaxes(taxInput);

  const rothIra = (p.rothIraYou || 0) + (p.rothIraSpouse || 0);
  const netCash = tax.netCash - rothIra;

  return {
    yearOffset, w2Gross, sePro, otherIncome, grossIncome: w2Gross + sePro + otherIncome,
    deferral, employerMatch, soloEmployee, soloEmployer, rothIra,
    hsa: p.hsaAnnual || 0, healthPremium, otherPreTax,
    retirementAdded: deferral + employerMatch + soloEmployee + soloEmployer + rothIra,
    tax, taxInput, netCash, netCashMonthly: netCash / 12,
    monthlyW2: (m) => w2Gross * sum(w2Items.map((i) => grow(i) * weightsFor(i)[m])) / (w2Gross || 1),
    weightsByItem: active.map((i) => ({ item: i, annual: grow(i), w: weightsFor(i) }))
  };
}

/* ---------- expenses ---------- */
export function expenseSummary(state) {
  const list = state.expenses.filter((e) => e.active !== false);
  const cashMonthly = sum(list.filter((e) => !e.payrollDeducted), (e) => e.monthly);
  const totalMonthly = sum(list, (e) => e.monthly);
  const essential = sum(list.filter((e) => e.essential), (e) => e.monthly);
  const groups = {};
  for (const e of list) {
    groups[e.group] = groups[e.group] || { name: e.group, monthly: 0, items: [] };
    groups[e.group].monthly += e.monthly;
    groups[e.group].items.push(e);
  }
  return { list, cashMonthly, totalMonthly, essential, discretionary: totalMonthly - essential, groups: Object.values(groups).sort((a, b) => b.monthly - a.monthly) };
}

/* ---------- the simulator ---------- */
export function simulate(state, months = 300) {
  const a = state.assumptions;
  const start = state.meta.startMonth || todayKey();
  const exp = expenseSummary(state);

  const accounts = Object.fromEntries(state.accounts.map((x) => [x.id, { ...x }]));
  const debts = state.debts.map((d) => ({ ...d, start: d.balance }));
  const goals = state.goals.map((g) => ({
    ...g,
    target: g.auto === 'emergency' ? exp.totalMonthly * (a.emergencyMonths || 6) : g.target,
    saved: g.account ? 0 : 0,
    done: false, doneMonth: null
  })).sort((x, y) => (x.priority || 99) - (y.priority || 99));

  const eventsByMonth = {};
  for (const ev of state.events || []) (eventsByMonth[ev.month] = eventsByMonth[ev.month] || []).push(ev);

  const rows = [];
  let snap = yearSnapshot(state, 0);
  const startMonthIdx = parseKey(start).getMonth();

  for (let m = 0; m < months; m++) {
    const key = addMonths(start, m);
    const calMonth = parseKey(key).getMonth();
    const yearOffset = Math.floor((startMonthIdx + m) / 12);
    if (yearOffset !== snap.yearOffset) snap = yearSnapshot(state, yearOffset);

    /* --- income for this calendar month --- */
    let gross = 0, w2Month = 0, seMonth = 0;
    for (const { item, annual, w } of snap.weightsByItem) {
      const amt = annual * w[calMonth];
      gross += amt;
      if (item.kind === 'w2') w2Month += amt; else seMonth += amt;
    }
    const shareOfYear = snap.grossIncome ? gross / snap.grossIncome : 1 / 12;

    const deferral = snap.deferral * (w2Month / (snap.w2Gross || 1));
    const match = snap.employerMatch * (w2Month / (snap.w2Gross || 1));
    const solo = (snap.soloEmployee + snap.soloEmployer) * (seMonth / (snap.sePro || 1) || 0);
    const hsa = snap.hsa / 12;
    const health = snap.healthPremium / 12;
    const otherPre = snap.otherPreTax / 12;
    const taxes = snap.tax.totalTax * shareOfYear;
    const rothIra = snap.rothIra / 12;

    const takeHome = gross - taxes - deferral - solo - hsa - health - otherPre - rothIra;

    /* --- fixed outflows (grown by inflation each year) --- */
    const cashExpenses = exp.cashMonthly * Math.pow(1 + (a.inflation || 0) / 100, yearOffset);
    let evIn = 0, evOut = 0;
    for (const ev of eventsByMonth[key] || []) { if (ev.direction === 'in') evIn += ev.amount; else evOut += ev.amount; }

    /* --- debt interest + minimums --- */
    let minPayments = 0, interestPaid = 0;
    for (const d of debts) {
      if (d.balance <= 0) continue;
      const int = d.balance * (d.apr / 100 / 12);
      interestPaid += int;
      d.balance += int;
      if (d.excludeFromPayoff) {
        const pi = d.piPayment || 0;
        if (pi > 0) d.balance = Math.max(0, d.balance - pi);   // paid inside the mortgage expense line
        continue;
      }
      const pay = Math.min(d.balance, d.minPayment || 0);
      d.balance -= pay; minPayments += pay;
    }

    /* --- pool available for allocation --- */
    accounts.checking.balance += takeHome + evIn - cashExpenses - minPayments - evOut;
    let pool = accounts.checking.balance - (a.checkingBuffer || 0);
    const allocations = [];

    if (pool > 0) {
      for (const g of goals) {
        if (pool <= 0) break;
        if (g.linkedDebtId) {
          const d = debts.find((x) => x.id === g.linkedDebtId);
          if (!d || d.balance <= 0.01) { if (d && !g.done) { g.done = true; g.doneMonth = g.doneMonth || key; } continue; }
          const pay = Math.min(pool, d.balance);
          d.balance -= pay; pool -= pay;
          allocations.push({ goalId: g.id, name: g.name, amount: pay, type: 'debt' });
          if (d.balance <= 0.01) { g.done = true; g.doneMonth = key; }
        } else {
          const acct = accounts[g.account] || accounts.hysa;
          const need = Math.max(0, g.target - (g.savedRun || 0));
          if (need <= 0.01) { if (!g.done) { g.done = true; g.doneMonth = g.doneMonth || key; } continue; }
          const cap = g.monthlyCap || Infinity;
          const put = Math.min(pool, need, cap);
          g.savedRun = (g.savedRun || 0) + put;
          acct.balance += put; pool -= put;
          allocations.push({ goalId: g.id, name: g.name, amount: put, type: 'save' });
          if (g.savedRun >= g.target - 0.01) { g.done = true; g.doneMonth = key; }
        }
      }
      /* leftover sweeps to the chosen account */
      if (pool > 0) {
        const sweep = accounts[a.surplusSweep] || accounts.broker || accounts.hysa;
        sweep.balance += pool;
        allocations.push({ goalId: '_sweep', name: sweep.name, amount: pool, type: 'sweep' });
        pool = 0;
      }
      accounts.checking.balance = (a.checkingBuffer || 0);
    }

    /* --- retirement + growth --- */
    accounts.k401.balance += deferral + match;
    accounts.solo.balance += solo;
    accounts.rothira.balance += rothIra;
    for (const id of Object.keys(accounts)) {
      const acc = accounts[id];
      if (acc.kind === 'property') acc.balance *= 1 + (a.homeAppreciation / 100 / 12);
      else if (acc.kind === 'retirement' || acc.kind === 'invest' || acc.kind === 'education') acc.balance *= 1 + ((acc.apy ?? a.investReturn) / 100 / 12);
      else acc.balance *= 1 + ((acc.apy ?? 0) / 100 / 12);
    }

    const assets = sum(Object.values(accounts), (x) => x.balance);
    const liabilities = sum(debts, (d) => Math.max(0, d.balance));

    rows.push({
      key, monthIndex: m, gross, w2Month, seMonth, taxes, deferral, match, solo, hsa, health, rothIra,
      takeHome, cashExpenses, minPayments, interestPaid, evIn, evOut,
      surplus: takeHome + evIn - cashExpenses - minPayments - evOut,
      allocations,
      cash: accounts.checking.balance + accounts.hysa.balance + accounts.sink.balance,
      accounts: Object.fromEntries(Object.entries(accounts).map(([k, v]) => [k, v.balance])),
      debts: Object.fromEntries(debts.map((d) => [d.id, Math.max(0, d.balance)])),
      assets, liabilities, netWorth: assets - liabilities
    });
  }

  return { rows, goals, debts, accounts, expenses: exp };
}

/* ---------- top-level derived model ---------- */
export function compute(state) {
  const snap = yearSnapshot(state, 0);
  const exp = expenseSummary(state);
  const horizon = Math.max(state.assumptions.forecastYears * 12, 60);
  const sim = simulate(state, horizon);

  const m0 = sim.rows[0];
  const monthlyIncome = snap.grossIncome / 12;
  const monthlyTakeHome = snap.netCash / 12;
  const monthlySurplus = monthlyTakeHome - exp.cashMonthly - sum(state.debts.filter((d) => !d.excludeFromPayoff && d.balance > 0), (d) => d.minPayment || 0);

  const nonMortgageDebt = sum(state.debts.filter((d) => !d.excludeFromPayoff), (d) => d.balance);
  const debtFreeMonth = sim.rows.find((r) => sum(Object.entries(r.debts).filter(([id]) => !state.debts.find((d) => d.id === id)?.excludeFromPayoff), ([, v]) => v) < 1)?.key || null;

  const efGoal = sim.goals.find((g) => g.auto === 'emergency');
  const efTarget = efGoal ? efGoal.target : exp.totalMonthly * state.assumptions.emergencyMonths;

  const savingsRate = snap.grossIncome ? ((snap.retirementAdded + Math.max(0, monthlySurplus) * 12) / snap.grossIncome) * 100 : 0;

  /* retirement projection */
  const retireYears = Math.max(0, (state.profile.retireAge || 60) - (state.profile.ages?.you || 40));
  const retireRow = sim.rows[Math.min(sim.rows.length - 1, retireYears * 12 - 1)] || sim.rows[sim.rows.length - 1];
  const retirementAtTarget = retireRow ? sum(Object.entries(retireRow.accounts).filter(([id]) => ['k401', 'solo', 'rothira', 'broker'].includes(id)), ([, v]) => v) : 0;

  return {
    snap, exp, sim,
    now: {
      monthlyIncome, monthlyTakeHome, monthlySurplus,
      monthlyExpenses: exp.cashMonthly,
      effectiveRate: snap.tax.effectiveRate,
      netWorth: sum(state.accounts, (x) => x.balance) - sum(state.debts, (d) => d.balance),
      assets: sum(state.accounts, (x) => x.balance),
      liabilities: sum(state.debts, (d) => d.balance),
      nonMortgageDebt, efTarget,
      monthlyTotalSpend: exp.totalMonthly,
      efNow: (state.accounts.find((x) => x.id === 'hysa')?.balance) || 0,
      savingsRate,
      runwayMonths: exp.cashMonthly ? ((state.accounts.find((x) => x.id === 'hysa')?.balance || 0) + (state.accounts.find((x) => x.id === 'checking')?.balance || 0)) / exp.cashMonthly : 0
    },
    milestones: {
      debtFreeMonth,
      efFundedMonth: sim.goals.find((g) => g.auto === 'emergency')?.doneMonth || null,
      vacationFundedMonth: sim.goals.find((g) => g.id === 'goal_vac')?.doneMonth || null,
      dadPaidMonth: sim.goals.find((g) => g.linkedDebtId === 'dad')?.doneMonth || null
    },
    retirement: { years: retireYears, projected: retirementAtTarget, safeIncome: retirementAtTarget * (state.assumptions.withdrawRate / 100) },
    opportunities: findOpportunities(state, snap, exp),
    alerts: findAlerts(state, snap, exp, monthlySurplus)
  };
}

/* ---------- advisor logic ---------- */
function findOpportunities(state, snap, exp) {
  const out = [];
  const p = state.payroll, L = TAX.federal.limits;
  const marg = snap.tax.savingsPerPreTaxDollar / 100;

  if (p.deferralPct < p.matchPct) {
    const missed = snap.w2Gross * ((p.matchPct - p.deferralPct) / 100);
    out.push({ id: 'match', tone: 'r', title: 'You are leaving free money on the table',
      body: `Contributing ${p.deferralPct}% when the match goes to ${p.matchPct}% throws away ${fmt(missed)} a year of employer money. Raise the deferral to at least ${p.matchPct}%.`, value: missed });
  }
  const deferral = snap.deferral;
  if (deferral < L.elective401k) {
    const room = L.elective401k - deferral;
    out.push({ id: 'max401k', tone: 'g', title: `Fill her 401(k) — ${fmt(room)} of room left`,
      body: `Every pre-tax dollar saves you ${(marg * 100).toFixed(1)}¢ between the IRS and Georgia. Maxing it out shelters ${fmt(room)} more and cuts this year's tax bill by about ${fmt(room * marg)}.`, value: room * marg });
  }
  if (snap.sePro > 0 && (p.soloEmployeeAnnual || 0) + (p.soloEmployerPct || 0) === 0) {
    const seNet = snap.sePro * TAX.federal.seTaxableShare;
    const capacity = Math.min(L.elective401k, seNet - snap.tax.halfSE) + (seNet - snap.tax.halfSE) * 0.2;
    out.push({ id: 'solo', tone: 'v', title: 'Open a Solo 401(k) for the eBay business',
      body: `Your eBay profit gives you a second, separate retirement plan. You could shelter roughly ${fmt(Math.max(0, capacity))} a year on top of her 401(k) — worth about ${fmt(Math.max(0, capacity) * marg)} in tax. Takes 20 minutes at Fidelity or Schwab and it is free.`, value: capacity * marg });
  }
  if ((p.hsaAnnual || 0) < L.hsaFamily) {
    out.push({ id: 'hsa', tone: 'b', title: 'HSA is the best account in the tax code',
      body: `If her plan is a high-deductible one, ${fmt(L.hsaFamily)} a year goes in tax-free, grows tax-free and comes out tax-free for medical costs. It also dodges the 7.65% payroll tax, which no 401(k) does. Worth roughly ${fmt(L.hsaFamily * (marg + 0.0765))}.`, value: L.hsaFamily * (marg + 0.0765) });
  }
  const rothLim = TAX.federal.limits.rothIraPhaseout[snap.tax.filingStatus] || [242000, 252000];
  if (snap.tax.agi < rothLim[1] && (p.rothIraYou + p.rothIraSpouse) < L.ira * 2) {
    out.push({ id: 'roth', tone: 'a', title: 'Two Roth IRAs, straight in',
      body: `Your AGI of ${fmt(snap.tax.agi)} is under the ${fmt(rothLim[0])} Roth cutoff, so you can each put in ${fmt(L.ira)} directly — ${fmt(L.ira * 2)} a year that is never taxed again. This window closes if her bonuses grow.`, value: 0 });
  }
  const kids = state.profile.dependents.length;
  if ((p.ga529Annual || 0) < 4000 * kids && kids > 0) {
    const ded = 4000 * kids;
    out.push({ id: 'ga529', tone: 'b', title: `Georgia pays you to fund 529s`,
      body: `Path2College gets you a ${fmt(ded)} Georgia deduction for ${kids} kids (${fmt(4000)} each, married filing jointly). That is ${fmt(ded * TAX.georgia.rate)} back on your state return every year, before the money even grows.`, value: ded * TAX.georgia.rate });
  }
  if (snap.tax.qbi > 0) {
    out.push({ id: 'qbi', tone: 'g', title: 'Your eBay income already gets a 20% discount',
      body: `The qualified business income deduction is knocking ${fmt(snap.tax.qbi)} off your taxable income this year. Keep clean books — mileage, shipping supplies, fees and home office all shrink the eBay profit that gets taxed twice (income tax and 15.3% self-employment tax).`, value: 0 });
  }
  const seTaxNote = snap.tax.seTax;
  if (seTaxNote > 3000) {
    out.push({ id: 'estimated', tone: 'a', title: 'Set aside quarterly estimated taxes',
      body: `eBay has no withholding, so about ${fmt(seTaxNote + snap.tax.sePro * 0.22)} of your ${fmt(snap.tax.sePro)} is the government's, not yours. Park roughly 30% of every eBay dollar in a separate account and pay quarterly (Apr 15, Jun 15, Sep 15, Jan 15) so April is never a surprise.`, value: 0 });
  }
  return out.sort((a, b) => (b.value || 0) - (a.value || 0));
}

function findAlerts(state, snap, exp, surplus) {
  const out = [];
  const ef = state.accounts.find((a) => a.id === 'hysa')?.balance || 0;
  const months = exp.cashMonthly ? ef / exp.cashMonthly : 0;
  if (months < 1) out.push({ tone: 'r', title: 'No emergency fund yet', body: `You have ${months.toFixed(1)} months of expenses banked. Until that is at least 1, every surprise becomes debt.` });
  else if (months < state.assumptions.emergencyMonths) out.push({ tone: 'a', title: `Emergency fund at ${months.toFixed(1)} of ${state.assumptions.emergencyMonths} months`, body: 'Keep the automatic transfer running until it is full.' });
  if (surplus < 0) out.push({ tone: 'r', title: 'Spending more than you bring home', body: `You are ${fmt(-surplus)} short every month. Something in the budget has to move.` });
  const high = state.debts.filter((d) => d.apr >= 15 && d.balance > 0);
  if (high.length) out.push({ tone: 'r', title: `${fmt(sum(high, (d) => d.balance))} at ${Math.max(...high.map((d) => d.apr))}% APR`, body: 'This is the highest guaranteed return available to you. Nothing else in your plan beats paying it off.' });
  if (state.payroll.deferralPct < state.payroll.matchPct) out.push({ tone: 'a', title: 'Employer match not fully captured', body: `Raise her 401(k) to ${state.payroll.matchPct}% to collect all of it.` });
  return out;
}

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
