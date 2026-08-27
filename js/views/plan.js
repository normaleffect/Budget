import { money, pct, esc, fullMonth, labelMonth, addMonths } from '../format.js';
import { card, cardHead, stat, note, chip, row, sectionLabel, lineChart, barChart, donut, ring, progress, fMoney, fNum, fText, fSelect, fSwitch, fSlider, openSheet, closeSheet, toast } from '../ui.js';
import { setState, resetState, getState, replaceState } from '../state.js';
import { compute } from '../engine.js';
import { TAX } from '../taxdata.js';

export const title = 'Plan';
export const subtabs = [['forecast', 'Forecast'], ['retire', 'Retirement'], ['taxes', 'Taxes'], ['what', 'What if'], ['settings', 'Settings']];
export const subtitle = (s, c) => `${money(c.retirement.projected, { compact: true })} projected by age ${s.profile.retireAge}`;

export function render(s, c, tab = 'forecast') {
  if (tab === 'retire') return renderRetire(s, c);
  if (tab === 'taxes') return renderTaxes(s, c);
  if (tab === 'what') return renderWhatIf(s, c);
  if (tab === 'settings') return renderSettings(s, c);
  return renderForecast(s, c);
}

/* ================= FORECAST ================= */
function renderForecast(s, c) {
  const years = s.assumptions.forecastYears;
  const yearly = [];
  for (let y = 0; y < years; y++) {
    const r = c.sim.rows[Math.min(c.sim.rows.length - 1, y * 12 + 11)];
    if (r) yearly.push({ y: y + 1, ...r });
  }
  const nwSeries = yearly.map((r) => r.netWorth);
  const investSeries = yearly.map((r) => r.accounts.k401 + r.accounts.solo + r.accounts.rothira + r.accounts.broker);
  const cashSeries = yearly.map((r) => r.cash);

  const chart = card(`${cardHead('Net worth over time', `<span class="mut" style="font-size:12px">${years} years</span>`)}
    ${lineChart([{ data: nwSeries, color: 'green' }, { data: investSeries, color: 'violet' }, { data: cashSeries, color: 'blue' }],
      { height: 200, labels: yearly.map((r, i) => (i % 5 === 0 || i === yearly.length - 1 ? `Y${r.y}` : '')) })}
    <div class="legend"><span><i style="background:var(--green)"></i>Net worth</span><span><i style="background:var(--violet)"></i>Invested</span><span><i style="background:var(--blue)"></i>Cash</span></div>`);

  const marks = [50000, 100000, 250000, 500000, 1000000, 2000000, 5000000];
  const crossings = marks.map((m) => {
    const r = c.sim.rows.find((x) => x.netWorth >= m);
    return { m, key: r?.key, months: r?.monthIndex };
  }).filter((x) => x.key);

  const milestones = card(`${cardHead('Milestones')}
    ${crossings.map((x) => `<div class="row">
      <div class="pill-ico" style="background:var(--green-dim);color:var(--green)">🏁</div>
      <div class="grow"><div class="r-title">${money(x.m, { compact: true })} net worth</div>
        <div class="r-sub">${(x.months / 12).toFixed(1)} years from now</div></div>
      <div class="r-val num">${fullMonth(x.key)}</div></div>`).join('')}`);

  const fiNumber = c.exp.totalMonthly * 12 / (s.assumptions.withdrawRate / 100);
  const fiRow = c.sim.rows.find((r) => (r.accounts.k401 + r.accounts.solo + r.accounts.rothira + r.accounts.broker) >= fiNumber);
  const fi = card(`${cardHead('Financial independence')}
    <div class="grid-2">
      ${stat('Your FI number', money(fiNumber, { compact: true }), `${s.assumptions.withdrawRate}% of it covers today's spending`)}
      ${stat('You get there', fiRow ? `${(fiRow.monthIndex / 12).toFixed(1)} yrs` : '—', fiRow ? fullMonth(fiRow.key) : 'extend the horizon')}
    </div>
    <div style="margin-top:12px">${progress(investSeries[0] || 0, fiNumber, 'teal')}</div>
    <div class="tiny" style="margin-top:9px">FI does not mean quitting. It means the day your money could cover your life, so every choice after that is a choice and not a requirement. At your current surplus you are on a genuinely fast track.</div>`);

  const table = card(`${cardHead('Year by year')}
    <div class="scroll-x"><table class="tbl">
      <thead><tr><th>Year</th><th>Invested</th><th>Cash</th><th>Debt</th><th>Net worth</th></tr></thead>
      <tbody>${yearly.filter((_, i) => i < 10 || i % 5 === 4).map((r) => `<tr>
        <td>Year ${r.y}</td><td>${money(r.accounts.k401 + r.accounts.solo + r.accounts.rothira + r.accounts.broker, { compact: true })}</td>
        <td>${money(r.cash, { compact: true })}</td><td>${money(r.liabilities, { compact: true })}</td>
        <td style="font-weight:700">${money(r.netWorth, { compact: true })}</td></tr>`).join('')}</tbody></table></div>
    <div class="tiny" style="margin-top:10px">Assumes ${pct(s.assumptions.investReturn, 1)} investment returns, ${pct(s.assumptions.raisePct, 1)} annual raises, ${pct(s.assumptions.inflation, 1)} inflation on your spending, and that eBay stays flat at ${money(c.snap.sePro)}. All of that is editable under Settings.</div>`);

  return `<div class="stack">${chart}${fi}${milestones}${table}</div>`;
}

/* ================= RETIREMENT ================= */
function renderRetire(s, c) {
  const yrs = c.retirement.years;
  const proj = c.retirement.projected;
  const income = c.retirement.safeIncome;
  const todaysDollars = proj / Math.pow(1 + s.assumptions.inflation / 100, yrs);

  const head = card(`${cardHead(`Retiring at ${s.profile.retireAge}`, `<span class="mut" style="font-size:12px">${yrs} years away</span>`)}
    <div class="hero-value num" style="font-size:36px">${money(proj, { compact: true })}</div>
    <div class="hero-sub">${chip('g', `${money(income)}/yr safe income`)} ${chip('n', `${money(todaysDollars, { compact: true })} in today's money`)}</div>
    <div class="divider"></div>
    <div class="kv"><span class="k">Monthly income it supports</span><span class="v">${money(income / 12)}</span></div>
    <div class="kv"><span class="k">Plus Social Security (rough)</span><span class="v">${money(4500)}</span></div>
    <div class="kv total"><span class="k">Estimated monthly income</span><span class="v pos">${money(income / 12 + 4500)}</span></div>
    <div class="tiny" style="margin-top:8px">Social Security is a placeholder. Pull your real numbers from ssa.gov once you both have accounts, and remember it does not start until 62 at the earliest.</div>`);

  const contribs = [
    { label: "Wife's 401(k) deferral", v: c.snap.deferral, color: 'green' },
    { label: 'Employer match', v: c.snap.employerMatch, color: 'teal' },
    { label: 'Solo 401(k)', v: c.snap.soloEmployee + c.snap.soloEmployer, color: 'violet' },
    { label: 'Roth IRAs', v: c.snap.rothIra, color: 'blue' },
    { label: 'HSA', v: c.snap.hsa, color: 'amber' },
    { label: 'Taxable brokerage sweep', v: Math.max(0, c.now.monthlySurplus * 12), color: 'pink' }
  ].filter((x) => x.v > 0);

  const totalIn = contribs.reduce((a, x) => a + x.v, 0);
  const mix = card(`${cardHead('Going in every year')}
    ${donut(contribs.map((x) => ({ value: x.v, color: x.color })), { size: 150, thickness: 22, center: `<div><div class="num" style="font-size:19px;font-weight:750">${money(totalIn, { compact: true })}</div><div class="tiny">a year</div></div>` })}
    <div class="legend" style="justify-content:center;margin-top:14px">${contribs.map((x) => `<span><i style="background:var(--${x.color})"></i>${esc(x.label)} ${money(x.v, { compact: true })}</span>`).join('')}</div>
    <div class="divider"></div>
    <div class="kv"><span class="k">Savings rate</span><span class="v pos">${pct(c.snap.grossIncome ? (totalIn / c.snap.grossIncome) * 100 : 0, 0)}</span></div>`);

  const gap = card(`${cardHead('Reality check')}
    ${note('a', 'You are starting from zero at 38', `That sounds bad and it is not. You have ${yrs} years and a surplus most households never see. ${money(Math.max(0, c.now.monthlySurplus))} a month invested at ${pct(s.assumptions.investReturn, 0)} becomes ${money(fv(Math.max(0, c.now.monthlySurplus), s.assumptions.investReturn, yrs), { compact: true })} by ${s.profile.retireAge}. Starting late with a big shovel beats starting early with a small one.`)}
    ${note('g', 'The order that matters', 'Employer match first, then the 22.9% debt, then HSA, then max her 401(k), then two Roth IRAs, then the Solo 401(k) for eBay money, then the taxable brokerage. Anything left over after that goes to the mortgage or the kids.')}
    ${note('b', 'Do not forget the boring stuff', 'Term life insurance on both of you (10 to 12 times income, 20 year level term, roughly $60 a month each at your ages), long-term disability on her since she is the main earner, and simple wills with guardianship named for the three kids. None of it is fun. All of it is the difference between a plan and a gamble.')}`);

  const settings = card(`${cardHead('Retirement assumptions')}
    ${fNum('Retire at age', 'profile.retireAge', s.profile.retireAge)}
    ${fNum('Your age', 'profile.ages.you', s.profile.ages.you)}
    ${fNum('Her age', 'profile.ages.spouse', s.profile.ages.spouse)}
    ${fNum('Safe withdrawal rate', 'assumptions.withdrawRate', s.assumptions.withdrawRate, 'The classic rule is 4%. It survived every 30 year period in modern history.', '%')}
    ${fNum('Investment return', 'assumptions.investReturn', s.assumptions.investReturn, 'The S&P 500 has averaged about 10% before inflation. 7% is the honest after-inflation-ish number to plan with.', '%')}`);

  return `<div class="stack">${head}${mix}${gap}${settings}</div>`;
}
const fv = (monthly, ratePct, years) => {
  const r = ratePct / 100 / 12, n = years * 12;
  return r === 0 ? monthly * n : monthly * ((Math.pow(1 + r, n) - 1) / r);
};

/* ================= TAXES ================= */
function renderTaxes(s, c) {
  const t = c.snap.tax;
  const slices = [
    { label: 'Federal income tax', v: t.fedIncomeTax, color: 'red' },
    { label: 'Social Security + Medicare', v: t.ficaEmployee, color: 'amber' },
    { label: 'Self-employment tax', v: t.seTax, color: 'violet' },
    { label: 'Georgia income tax', v: t.gaTax, color: 'blue' }
  ];

  const head = card(`${cardHead(`${TAX.year} tax picture`, `<span class="mut" style="font-size:12px">Married filing jointly · Georgia</span>`)}
    ${donut(slices.map((x) => ({ value: x.v, color: x.color })), { size: 158, thickness: 24, center: `<div><div class="num" style="font-size:20px;font-weight:750">${money(t.totalTax, { compact: true })}</div><div class="tiny">${pct(t.effectiveRate, 1)} of gross</div></div>` })}
    <div class="legend" style="justify-content:center;margin-top:14px">${slices.map((x) => `<span><i style="background:var(--${x.color})"></i>${esc(x.label)} ${money(x.v)}</span>`).join('')}</div>`);

  const rates = `<div class="grid-3">
    ${stat('Effective', pct(t.effectiveRate, 1), 'of every dollar', 'tight')}
    ${stat('Marginal', pct(t.savingsPerPreTaxDollar, 1), 'on the next dollar', 'tight')}
    ${stat('Take-home', pct(100 - t.effectiveRate, 1), 'you keep', 'tight')}</div>`;

  const detail = card(`${cardHead('How it is calculated')}
    <div class="kv"><span class="k">W-2 wages (base + bonus)</span><span class="v">${money(t.w2Gross)}</span></div>
    <div class="kv"><span class="k">eBay net profit</span><span class="v">${money(t.sePro)}</span></div>
    <div class="kv"><span class="k">Less pre-tax health + HSA</span><span class="v neg">-${money(t.section125)}</span></div>
    <div class="kv"><span class="k">Less 401(k) deferrals</span><span class="v neg">-${money(c.snap.deferral + c.snap.soloEmployee + c.snap.soloEmployer)}</span></div>
    <div class="kv"><span class="k">Less half of self-employment tax</span><span class="v neg">-${money(t.halfSE)}</span></div>
    <div class="kv total"><span class="k">Adjusted gross income</span><span class="v">${money(t.agi)}</span></div>
    <div class="kv"><span class="k">Standard deduction</span><span class="v neg">-${money(t.deduction)}</span></div>
    <div class="kv"><span class="k">QBI deduction (20% of eBay)</span><span class="v neg">-${money(t.qbi)}</span></div>
    <div class="kv total"><span class="k">Federal taxable income</span><span class="v">${money(t.taxableIncome)}</span></div>
    <div class="kv"><span class="k">Tax before credits</span><span class="v">${money(t.grossFedTax)}</span></div>
    <div class="kv"><span class="k">Child tax credits (${s.profile.dependents.filter((d) => d.age < 17).length} kids)</span><span class="v pos">-${money(t.credits)}</span></div>
    <div class="kv total"><span class="k">Federal income tax</span><span class="v">${money(t.fedIncomeTax)}</span></div>
    <div class="divider"></div>
    <div class="kv"><span class="k">Georgia starts from AGI</span><span class="v">${money(t.agi)}</span></div>
    <div class="kv"><span class="k">Georgia standard deduction</span><span class="v neg">-${money(TAX.georgia.standardDeduction.mfj)}</span></div>
    <div class="kv"><span class="k">Dependent exemptions (${s.profile.dependents.length} × ${money(TAX.georgia.dependentExemption)})</span><span class="v neg">-${money(s.profile.dependents.length * TAX.georgia.dependentExemption)}</span></div>
    ${t.ga529Ded ? `<div class="kv"><span class="k">529 contributions</span><span class="v neg">-${money(t.ga529Ded)}</span></div>` : ''}
    <div class="kv"><span class="k">Georgia taxable income</span><span class="v">${money(t.gaTaxable)}</span></div>
    <div class="kv total"><span class="k">Georgia tax at ${pct(TAX.georgia.rate * 100, 2)}</span><span class="v">${money(t.gaTax)}</span></div>`);

  const opps = card(`${cardHead('Every move available to you')}
    ${c.opportunities.map((o) => `<div class="note ${o.tone}" style="margin-bottom:10px">
      <h4>${esc(o.title)}${o.value ? ` <span class="chip g" style="margin-left:6px">${money(o.value)}/yr</span>` : ''}</h4>
      <div style="color:var(--text-2)">${esc(o.body)}</div></div>`).join('')}`);

  const maxed = maxedScenario(s);
  const compare = card(`${cardHead('If you maxed every tax-advantaged account')}
    <div class="grid-2">
      ${stat('Tax now', money(t.totalTax), pct(t.effectiveRate, 1) + ' effective')}
      ${stat('Tax maxed', `<span class="pos">${money(maxed.tax.totalTax)}</span>`, pct(maxed.tax.effectiveRate, 1) + ' effective')}
    </div>
    <div class="divider"></div>
    <div class="kv"><span class="k">Tax saved every year</span><span class="v pos">${money(t.totalTax - maxed.tax.totalTax)}</span></div>
    <div class="kv"><span class="k">Going into retirement accounts</span><span class="v">${money(maxed.retirementAdded)}</span></div>
    <div class="kv"><span class="k">Take-home left to live on</span><span class="v">${money(maxed.netCash / 12)}/mo</span></div>
    <div class="kv"><span class="k">Your expenses</span><span class="v">${money(c.exp.cashMonthly)}/mo</span></div>
    <div class="kv total"><span class="k">Still free after maxing everything</span><span class="v ${maxed.netCash / 12 - c.exp.cashMonthly > 0 ? 'pos' : 'neg'}">${money(maxed.netCash / 12 - c.exp.cashMonthly)}/mo</span></div>
    <div class="btn-row"><button class="btn primary wide" data-apply-max>Apply this to my plan</button></div>
    <div class="tiny" style="margin-top:9px">This sets her 401(k) to the ${money(TAX.federal.limits.elective401k)} limit, funds an ${money(TAX.federal.limits.hsaFamily)} HSA, both ${money(TAX.federal.limits.ira)} Roth IRAs, a Solo 401(k) on your eBay income, and ${money(4000 * s.profile.dependents.length)} into Georgia 529s. Do it gradually if that feels like a lot at once.</div>`);

  const assumptions = card(`${cardHead('Tax assumptions')}
    ${note('n', '', `Built on ${TAX.year} figures: ${money(TAX.federal.standardDeduction.mfj)} standard deduction, ${money(TAX.federal.childTaxCredit)} per child under 17, Georgia's ${pct(TAX.georgia.rate * 100, 2)} flat rate with a ${money(TAX.georgia.standardDeduction.mfj)} deduction and ${money(TAX.georgia.dependentExemption)} per dependent. Georgia's rate is scheduled to keep stepping down toward 4.99%. Verify against her actual W-2 and your Schedule C before you file, and use a CPA the first year you have real self-employment income.`)}`);

  return `<div class="stack">${head}${rates}${compare}${detail}${sectionLabel('Advisor')}${opps}${assumptions}</div>`;
}

function maxedScenario(s) {
  const clone = JSON.parse(JSON.stringify(s));
  const L = TAX.federal.limits;
  clone.payroll.deferralPct = Math.min(100, (L.elective401k / (s.income.filter((i) => i.kind === 'w2').reduce((a, i) => a + i.annual, 0) || 1)) * 100);
  clone.payroll.hsaAnnual = L.hsaFamily;
  clone.payroll.rothIraYou = L.ira;
  clone.payroll.rothIraSpouse = L.ira;
  clone.payroll.soloEmployerPct = 20;
  clone.payroll.ga529Annual = 4000 * s.profile.dependents.length;
  const c = compute(clone);
  return { ...c.snap, clone };
}

/* ================= WHAT IF ================= */
const WHATIF_KEY = '_whatif';
let whatIf = null;
function baseWhatIf(s) {
  return { incomePct: 0, expensePct: 0, deferralPct: s.payroll.deferralPct, returnPct: s.assumptions.investReturn, ebay: s.income.find((i) => i.kind === 'se')?.annual || 0, jobLossMonths: 0 };
}
function applyWhatIf(s, w) {
  const clone = JSON.parse(JSON.stringify(s));
  clone.income.forEach((i) => {
    if (i.kind === 'se') i.annual = w.ebay;
    else i.annual = i.annual * (1 + w.incomePct / 100);
  });
  clone.expenses.forEach((e) => { e.monthly = e.monthly * (1 + w.expensePct / 100); });
  clone.payroll.deferralPct = w.deferralPct;
  clone.assumptions.investReturn = w.returnPct;
  return clone;
}

function renderWhatIf(s, c) {
  whatIf = whatIf || baseWhatIf(s);
  const w = whatIf;
  const alt = compute(applyWhatIf(s, w));

  const cmp = (label, a, b, fmt = (v) => money(v)) => `<div class="kv"><span class="k">${esc(label)}</span>
    <span class="v">${fmt(b)} <small class="mut" style="font-weight:500">was ${fmt(a)}</small></span></div>`;

  const results = card(`${cardHead('Result')}
    <div class="grid-2">
      ${stat('Monthly free cash', `<span class="${alt.now.monthlySurplus >= 0 ? 'pos' : 'neg'}">${money(alt.now.monthlySurplus)}</span>`, `was ${money(c.now.monthlySurplus)}`)}
      ${stat('Net worth in 10 yrs', money(alt.sim.rows[119]?.netWorth || 0, { compact: true }), `was ${money(c.sim.rows[119]?.netWorth || 0, { compact: true })}`)}
    </div>
    <div class="divider"></div>
    ${cmp('Take-home per month', c.now.monthlyTakeHome, alt.now.monthlyTakeHome)}
    ${cmp('Total tax this year', c.snap.tax.totalTax, alt.snap.tax.totalTax)}
    ${cmp('Emergency fund full by', 0, 0, () => alt.milestones.efFundedMonth ? fullMonth(alt.milestones.efFundedMonth) : 'not in horizon')}
    ${cmp('Retirement at ' + s.profile.retireAge, c.retirement.projected, alt.retirement.projected, (v) => money(v, { compact: true }))}
    <div style="margin-top:14px">${lineChart([
      { data: c.sim.rows.filter((_, i) => i % 12 === 11).map((r) => r.netWorth), color: 'blue' },
      { data: alt.sim.rows.filter((_, i) => i % 12 === 11).map((r) => r.netWorth), color: 'green' }
    ], { height: 140, fill: false })}</div>
    <div class="legend"><span><i style="background:var(--blue)"></i>Current plan</span><span><i style="background:var(--green)"></i>What if</span></div>`);

  const sliders = card(`${cardHead('Move the dials')}
    ${fSlider('Household income', 'w.incomePct', w.incomePct, -50, 100, 5, `${w.incomePct > 0 ? '+' : ''}${w.incomePct}%`)}
    ${fSlider('Spending', 'w.expensePct', w.expensePct, -40, 100, 5, `${w.expensePct > 0 ? '+' : ''}${w.expensePct}%`)}
    ${fSlider('Her 401(k) deferral', 'w.deferralPct', w.deferralPct, 0, 25, 1, `${w.deferralPct}%`)}
    ${fSlider('eBay annual profit', 'w.ebay', w.ebay, 0, 200000, 6000, money(w.ebay, { compact: true }))}
    ${fSlider('Investment return', 'w.returnPct', w.returnPct, 0, 12, 0.5, `${w.returnPct}%`)}
    <div class="btn-row"><button class="btn wide" data-whatif-reset>Reset</button></div>`);

  const presets = card(`${cardHead('Preset scenarios')}
    ${[
      { id: 'jobloss', label: 'She loses her job tomorrow', sub: 'Only eBay income for a year', tone: 'r' },
      { id: 'ebay2x', label: 'You double eBay to $72k', sub: 'The scaling plan works', tone: 'g' },
      { id: 'baby', label: 'Spending jumps 25%', sub: 'Braces, sports, a bigger grocery bill', tone: 'a' },
      { id: 'max', label: 'Max every retirement account', sub: 'Full tax optimization', tone: 'v' },
      { id: 'crash', label: 'Markets return 3% not 7%', sub: 'A lost decade', tone: 'b' }
    ].map((p) => `<div class="row tap" data-preset="${p.id}">
      <div class="pill-ico" style="background:var(--${p.tone === 'r' ? 'red' : p.tone === 'g' ? 'green' : p.tone === 'a' ? 'amber' : p.tone === 'v' ? 'violet' : 'blue'}-dim)">▶</div>
      <div class="grow"><div class="r-title">${esc(p.label)}</div><div class="r-sub">${esc(p.sub)}</div></div></div>`).join('')}`);

  const survive = card(`${cardHead('Survival math')}
    ${note(alt.now.monthlySurplus >= 0 ? 'g' : 'r', 'If her income stopped completely',
      `Your eBay income of ${money(c.snap.sePro / 12)} a month against ${money(c.exp.cashMonthly)} of expenses leaves a gap of ${money(Math.max(0, c.exp.cashMonthly - c.snap.sePro / 12))} a month. A full ${money(c.now.efTarget, { compact: true })} emergency fund buys you ${(c.now.efTarget / Math.max(1, c.exp.cashMonthly - c.snap.sePro / 12)).toFixed(0)} months to figure it out. That is exactly why the emergency fund comes before anything fun.`)}`);

  return `<div class="stack">${results}${sliders}${presets}${survive}</div>`;
}

/* ================= SETTINGS ================= */
function renderSettings(s, c) {
  const profile = card(`${cardHead('Household')}
    ${fText('Household name', 'meta.householdName', s.meta.householdName)}
    ${fSelect('Filing status', 'profile.filingStatus', s.profile.filingStatus, [['mfj', 'Married filing jointly'], ['single', 'Single'], ['hoh', 'Head of household']])}
    ${fSelect('Theme', 'meta.theme', s.meta.theme, [['auto', 'Match my phone'], ['dark', 'Always dark'], ['light', 'Always light']])}
    <div class="section-label" style="margin-left:0">Kids</div>
    ${s.profile.dependents.map((d, i) => `<div class="inline-fields" style="margin-bottom:10px">
      <input class="input" type="text" data-path="profile.dependents.${i}.name" value="${esc(d.name)}">
      <input class="input" type="number" data-path="profile.dependents.${i}.age" value="${d.age}">
    </div>`).join('')}
    <div class="tiny">The child tax credit is ${money(TAX.federal.childTaxCredit)} per child until they turn 17, then ${money(TAX.federal.otherDependentCredit)}. Georgia gives ${money(TAX.georgia.dependentExemption)} per dependent regardless of age.</div>`);

  const assumptions = card(`${cardHead('Planning assumptions')}
    ${fNum('Inflation', 'assumptions.inflation', s.assumptions.inflation, 'Applied to your spending every year in the forecast.', '%')}
    ${fNum('Investment return', 'assumptions.investReturn', s.assumptions.investReturn, '', '%')}
    ${fNum('Savings account APY', 'assumptions.savingsApy', s.assumptions.savingsApy, 'Keep the emergency fund somewhere paying real interest.', '%')}
    ${fNum('Annual raises', 'assumptions.raisePct', s.assumptions.raisePct, '', '%')}
    ${fNum('eBay growth per year', 'assumptions.ebayGrowthPct', s.assumptions.ebayGrowthPct, 'Currently flat, which is the conservative call you asked for.', '%')}
    ${fNum('Home appreciation', 'assumptions.homeAppreciation', s.assumptions.homeAppreciation, '', '%')}
    ${fNum('Emergency fund size', 'assumptions.emergencyMonths', s.assumptions.emergencyMonths, `${s.assumptions.emergencyMonths} months of spending = ${money(c.now.efTarget)}. Six is right when one income is brand new.`, 'months')}
    ${fMoney('Checking buffer', 'assumptions.checkingBuffer', s.assumptions.checkingBuffer, 'Cash left in checking before anything gets allocated.')}
    ${fSelect('Leftover surplus goes to', 'assumptions.surplusSweep', s.assumptions.surplusSweep, s.accounts.map((a) => [a.id, a.name]))}
    ${fNum('Forecast horizon', 'assumptions.forecastYears', s.assumptions.forecastYears, '', 'years')}`);

  const data = card(`${cardHead('Your data')}
    ${note('b', 'It lives on this phone', 'Everything you type is stored locally in your browser. Nothing is uploaded, there is no account, and no company sees your numbers. That also means clearing your browser data wipes it, so export a backup now and then.')}
    <div class="btn-row"><button class="btn wide" data-export>Export backup</button><button class="btn wide" data-import>Restore</button></div>
    <div class="btn-row"><button class="btn danger wide" data-reset>Reset everything</button></div>`);

  const about = card(`${cardHead('About the numbers')}
    <div class="tiny" style="line-height:1.65">
      This app is a planning tool, not tax advice or an investment recommendation. The tax engine implements ${TAX.year} federal brackets, the standard deduction, the child tax credit, the QBI deduction, Social Security and Medicare including the self-employment version, and Georgia's flat income tax with dependent exemptions. It does not handle itemized deductions, capital gains, AMT, state credits, or the many things that only a real preparer will catch.
      <br><br>
      Two things to verify before you lean on any of it: her actual health insurance premium and her real bonus structure. Both are estimates right now and both move the answer by thousands.
      <br><br>
      Once eBay is producing real money, hire a CPA. The first year costs a few hundred dollars and usually pays for itself in deductions you would not have known to take.
    </div>`);

  return `<div class="stack">${profile}${assumptions}${data}${about}</div>`;
}

/* Sheet buttons live outside #view, so they are wired once at the document level. */
let sheetWired = false;
function wireSheetActions() {
  if (sheetWired) return; sheetWired = true;
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-copy-backup')) {
      const ta = document.getElementById('backup-json');
      try { await navigator.clipboard.writeText(ta.value); toast('Copied'); }
      catch { ta.select(); document.execCommand('copy'); toast('Copied'); }
    }
    if (t.hasAttribute('data-download-backup')) {
      try {
        const blob = new Blob([document.getElementById('backup-json').value], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        toast('Saved to your downloads');
      } catch { toast('Downloads are blocked here — use Copy instead'); }
    }
    if (t.hasAttribute('data-do-restore')) {
      const raw = document.getElementById('restore-json').value.trim();
      if (!raw) return toast('Paste a backup first');
      try { replaceState(JSON.parse(raw)); closeSheet(); toast('Restored'); }
      catch { toast('That does not look like a backup'); }
    }
    if (t.hasAttribute('data-restore-file')) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json,.json';
      inp.onchange = async () => {
        try { replaceState(JSON.parse(await inp.files[0].text())); closeSheet(); toast('Restored'); }
        catch { toast('Could not read that file'); }
      };
      inp.click();
    }
  });
}

/* ================= mount ================= */
export function mount(el, s, c, rerender) {
  wireSheetActions();
  el.querySelector('[data-apply-max]')?.addEventListener('click', () => {
    const L = TAX.federal.limits;
    const w2 = s.income.filter((i) => i.kind === 'w2').reduce((a, i) => a + i.annual, 0) || 1;
    setState((st) => {
      st.payroll.deferralPct = Math.min(100, Math.round((L.elective401k / w2) * 1000) / 10);
      st.payroll.hsaAnnual = L.hsaFamily;
      st.payroll.rothIraYou = L.ira;
      st.payroll.rothIraSpouse = L.ira;
      st.payroll.soloEmployerPct = 20;
      st.payroll.ga529Annual = 4000 * st.profile.dependents.length;
    });
    toast('Applied. Check the Budget tab.');
  });

  el.querySelectorAll('[data-slider]').forEach((n) => {
    const key = n.dataset.slider.replace('w.', '');
    const out = el.querySelector(`[data-slider-out="${n.dataset.slider}"]`);
    const label = (v) => {
      if (key === 'ebay') return money(v, { compact: true });
      if (key === 'incomePct' || key === 'expensePct') return `${v > 0 ? '+' : ''}${v}%`;
      return `${v}%`;
    };
    // live label while dragging, full recompute only on release so the drag never breaks
    n.addEventListener('input', (e) => { whatIf[key] = Number(e.target.value); if (out) out.textContent = label(Number(e.target.value)); });
    n.addEventListener('change', () => rerender());
  });
  el.querySelector('[data-whatif-reset]')?.addEventListener('click', () => { whatIf = baseWhatIf(s); rerender(); });
  el.querySelectorAll('[data-preset]').forEach((n) => n.addEventListener('click', () => {
    const p = n.dataset.preset;
    whatIf = baseWhatIf(s);
    if (p === 'jobloss') whatIf.incomePct = -100;
    if (p === 'ebay2x') whatIf.ebay = (s.income.find((i) => i.kind === 'se')?.annual || 36000) * 2;
    if (p === 'baby') whatIf.expensePct = 25;
    if (p === 'max') whatIf.deferralPct = Math.min(25, Math.round((TAX.federal.limits.elective401k / (s.income.filter((i) => i.kind === 'w2').reduce((a, i) => a + i.annual, 0) || 1)) * 100));
    if (p === 'crash') whatIf.returnPct = 3;
    rerender();
  }));

  el.querySelector('[data-export]')?.addEventListener('click', () => {
    const json = JSON.stringify(getState(), null, 2);
    openSheet('Backup', `
      <div class="tiny" style="margin-bottom:10px">Copy this somewhere safe — a note to yourself, an email, anywhere. Pasting it back into Restore rebuilds every number exactly as it is right now.</div>
      <textarea id="backup-json" readonly rows="9" style="font-family:var(--mono);font-size:11px;line-height:1.4">${esc(json)}</textarea>
      <div class="btn-row"><button class="btn primary wide" data-copy-backup>Copy to clipboard</button></div>
      <div class="btn-row"><button class="btn wide" data-download-backup>Save as a file</button></div>`);
  });
  el.querySelector('[data-import]')?.addEventListener('click', () => {
    openSheet('Restore', `
      <div class="tiny" style="margin-bottom:10px">Paste a backup below and hit Restore. This replaces everything currently in the app.</div>
      <textarea id="restore-json" rows="9" placeholder="Paste your backup here" style="font-family:var(--mono);font-size:11px;line-height:1.4"></textarea>
      <div class="btn-row"><button class="btn primary wide" data-do-restore>Restore</button></div>
      <div class="btn-row"><button class="btn wide" data-restore-file>Pick a backup file instead</button></div>`);
  });
  el.querySelector('[data-reset]')?.addEventListener('click', () => {
    if (confirm('Reset every number back to the starting plan? This cannot be undone.')) { resetState(); toast('Reset'); }
  });
}
