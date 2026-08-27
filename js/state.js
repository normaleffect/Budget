import { uid, todayKey, addMonths } from './format.js';

const START = todayKey();
const nextDec = (() => {
  const now = new Date();
  const y = now.getMonth() > 11 ? now.getFullYear() + 1 : now.getFullYear();
  return `${y}-12`;
})();

export function makeDefaultState() {
  return {
    meta: { version: 3, householdName: 'Our Household', createdAt: new Date().toISOString(), startMonth: START, theme: 'auto' },

    profile: {
      filingStatus: 'mfj',
      state: 'GA',
      dependents: [
        { id: uid('dep'), name: 'Kid 1', age: 11 },
        { id: uid('dep'), name: 'Kid 2', age: 9 },
        { id: uid('dep'), name: 'Kid 3', age: 4 }
      ],
      ages: { you: 38, spouse: 38 },
      retireAge: 60
    },

    /* ---------------- income ---------------- */
    income: [
      {
        id: 'wife_base', name: 'Base Salary', who: 'Wife', kind: 'w2', annual: 115000,
        schedule: 'even', note: 'Salaried, paid evenly through the year', color: 'green', active: true
      },
      {
        id: 'wife_bonus', name: 'Bonus & Incentives', who: 'Wife', kind: 'w2', annual: 45000,
        schedule: 'even', note: '~$15k over the first 120 days, then ongoing', color: 'teal', active: true,
        rampMonths: 4, rampAmount: 15000
      },
      {
        id: 'ebay', name: 'eBay Business', who: 'You', kind: 'se', annual: 36000,
        schedule: 'even', note: 'Conservative $3,000/mo. Scaling is upside, not the plan.', color: 'violet', active: true,
        growthPctPerYear: 0
      }
    ],

    /* ---------------- payroll & benefits ---------------- */
    payroll: {
      deferralPct: 4,            // wife's 401(k) elective deferral, % of total W-2 comp
      deferralIsRoth: false,
      matchPct: 4,               // employer match rate
      matchLimitPct: 4,          // matched up to this % of pay
      healthPremiumMonthly: 450, // ASSUMPTION - confirm with her benefits packet
      hsaAnnual: 0,
      otherPreTaxMonthly: 0,
      soloEmployeeAnnual: 0,     // your solo 401(k) deferral from eBay income
      soloEmployerPct: 0,        // profit-sharing % of net SE earnings
      rothIraYou: 0,
      rothIraSpouse: 0,
      ga529Annual: 0
    },

    /* ---------------- spending ---------------- */
    expenses: [
      { id: 'mortgage',  name: 'Mortgage (P&I, tax, ins)', group: 'Housing',   monthly: 2100, essential: true,  note: 'Primary residence' },
      { id: 'utilities', name: 'Utilities & other bills',  group: 'Housing',   monthly: 1000, essential: true,  note: 'Power, water, internet, phones, insurance' },
      { id: 'food',      name: 'Groceries & eating out',   group: 'Living',    monthly: 800,  essential: true,  note: 'Family of 5' },
      { id: 'health',    name: 'Health insurance premium', group: 'Insurance', monthly: 450,  essential: true,  note: 'Pre-tax payroll deduction', payrollDeducted: true },
      { id: 'fun',       name: 'Fun money & misc',         group: 'Lifestyle', monthly: 0,    essential: false, note: 'Set this once you see the surplus' }
    ],

    /* ---------------- debts ---------------- */
    debts: [
      { id: 'misc',  name: 'Misc debts (cards etc.)', balance: 5000, apr: 22.9, minPayment: 150, kind: 'card',     openedNote: 'Estimate - split between the two of you' },
      { id: 'truck', name: 'Truck loan',              balance: 4000, apr: 7.5,  minPayment: 500, kind: 'auto',     openedNote: '~8 payments left' },
      { id: 'dad',   name: 'Owed to Dad',             balance: 3000, apr: 0,    minPayment: 0,   kind: 'family',   openedNote: 'He floated us $2,700. Paying back $3,000.', payoffFirst: true },
      { id: 'mtg',   name: 'Mortgage',                balance: 0,    apr: 6.5,  minPayment: 0,   kind: 'mortgage', excludeFromPayoff: true, paidByExpenseId: 'mortgage', openedNote: 'Add your balance + P&I to track home equity' }
    ],

    /* ---------------- accounts / net worth ---------------- */
    accounts: [
      { id: 'checking', name: 'Checking',        kind: 'cash',       balance: 0, apy: 0.1,  note: 'Operating account' },
      { id: 'hysa',     name: 'Emergency Fund',  kind: 'cash',       balance: 0, apy: 4.0,  note: 'High-yield savings', goalId: 'goal_ef' },
      { id: 'sink',     name: 'Sinking Funds',   kind: 'cash',       balance: 0, apy: 4.0,  note: 'Vacation, Christmas, car repairs' },
      { id: 'k401',     name: "Wife's 401(k)",   kind: 'retirement', balance: 0, apy: 7.0,  note: 'Pre-tax + employer match' },
      { id: 'solo',     name: 'Solo 401(k)',     kind: 'retirement', balance: 0, apy: 7.0,  note: 'Not open yet - see Opportunities' },
      { id: 'rothira',  name: 'Roth IRAs',       kind: 'retirement', balance: 0, apy: 7.0,  note: 'Not open yet' },
      { id: 'r529',     name: '529 Plans',       kind: 'education',  balance: 0, apy: 6.0,  note: 'Georgia Path2College' },
      { id: 'broker',   name: 'Brokerage',       kind: 'invest',     balance: 0, apy: 7.0,  note: 'Where the leftover surplus lands' },
      { id: 'home',     name: 'Home value',      kind: 'property',   balance: 0, apy: 3.0,  note: 'Add your estimate' }
    ],

    /* ---------------- goals ---------------- */
    goals: [
      { id: 'goal_dad',  name: 'Pay Dad back',              target: 3000,  priority: 1, icon: '\u{1F91D}', color: 'amber',  linkedDebtId: 'dad',   note: 'First dollar out of the refund. Non-negotiable.' },
      { id: 'goal_ef1',  name: 'Starter emergency fund',    target: 5000,  priority: 2, icon: '\u{1F6DF}', color: 'blue',   account: 'hysa',       note: 'One month of survival money before anything else.' },
      { id: 'goal_card', name: 'Kill the 22.9% debt',       target: 5000,  priority: 3, icon: '\u{1F525}', color: 'red',    linkedDebtId: 'misc',  note: 'Highest rate in the house. It goes first.' },
      { id: 'goal_truck',name: 'Pay off the truck',         target: 4000,  priority: 4, icon: '\u{1F6FB}', color: 'violet', linkedDebtId: 'truck', note: 'Frees up $500/mo forever.' },
      { id: 'goal_vac',  name: 'Christmas vacation',        target: 5000,  priority: 5, icon: '\u{1F3DD}', color: 'teal',   account: 'sink',       deadline: nextDec, note: 'Funded on purpose, guilt-free.' },
      { id: 'goal_ef',   name: 'Full emergency fund',       target: 0,     priority: 6, icon: '\u{1F3E6}', color: 'green',  account: 'hysa',       auto: 'emergency', note: 'Auto-sized to 6 months of core spending.' },
      { id: 'goal_home', name: 'Home & car repair fund',    target: 6000,  priority: 7, icon: '\u{1F527}', color: 'amber',  account: 'sink',       note: 'So the next surprise is not a crisis.' },
      { id: 'goal_529',  name: 'College savings started',   target: 12000, priority: 8, icon: '\u{1F393}', color: 'blue',   account: 'r529',       note: 'Georgia gives a state deduction for this.' }
    ],

    /* ---------------- one-off money in / out ---------------- */
    events: [
      { id: 'refund', name: 'Tax refunds (2023 + 2024)', amount: 10000, month: START, direction: 'in',  note: 'Already filed, on the way' },
      { id: 'vac',    name: 'Christmas vacation',        amount: 5000,  month: nextDec, direction: 'out', note: 'Linked to the vacation goal', goalId: 'goal_vac' }
    ],

    /* ---------------- assumptions ---------------- */
    assumptions: {
      inflation: 2.5,
      investReturn: 7.0,
      savingsApy: 4.0,
      raisePct: 3.0,
      ebayGrowthPct: 0,
      homeAppreciation: 3.0,
      emergencyMonths: 6,
      payoffMethod: 'avalanche',   // avalanche | snowball
      horizonMonths: 24,
      checkingBuffer: 2500,
      surplusSweep: 'broker',
      forecastYears: 25,
      withdrawRate: 4.0
    },

    /* transactions users log by hand (optional) */
    actuals: {},   // { "2026-09": { expenseId: amount } }
    ui: { flowMonth: null, planTab: 'forecast', budgetTab: 'overview', goalsTab: 'goals' }
  };
}

/* ---------------- store ---------------- */
const KEY = 'ledger.state.v3';
let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return makeDefaultState();
    const parsed = JSON.parse(raw);
    return merge(makeDefaultState(), parsed);
  } catch { return makeDefaultState(); }
}
function merge(base, over) {
  if (Array.isArray(base) || Array.isArray(over)) return over ?? base;
  if (base && typeof base === 'object' && over && typeof over === 'object') {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
    return out;
  }
  return over === undefined ? base : over;
}

export const getState = () => state;
export function setState(mutator, { silent = false } = {}) {
  if (typeof mutator === 'function') mutator(state); else Object.assign(state, mutator);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  if (!silent) listeners.forEach((fn) => fn(state));
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function resetState() { localStorage.removeItem(KEY); state = makeDefaultState(); listeners.forEach((f) => f(state)); }
export function replaceState(next) { state = merge(makeDefaultState(), next); setState(() => {}); }

/** dotted-path setter used by every input in the app */
export function setPath(path, value) {
  setState((s) => {
    const parts = path.split('.');
    let o = s;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      const idx = /^\d+$/.test(p) ? Number(p) : p;
      o = o[idx];
      if (o == null) return;
    }
    o[parts[parts.length - 1]] = value;
  });
}
export function getPath(path, s = state) {
  return path.split('.').reduce((o, p) => (o == null ? o : o[/^\d+$/.test(p) ? Number(p) : p]), s);
}
