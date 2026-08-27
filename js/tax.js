import { TAX } from './taxdata.js';

const bracketTax = (income, brackets) => {
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [floor, rate] = brackets[i];
    const ceil = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (income <= floor) break;
    tax += (Math.min(income, ceil) - floor) * rate;
  }
  return tax;
};
const marginalRate = (income, brackets) => {
  let r = brackets[0][1];
  for (const [floor, rate] of brackets) if (income > floor) r = rate;
  return r;
};

/**
 * Full household tax calculation: federal income tax, FICA, self-employment tax
 * and Georgia state income tax. All dollar inputs are annual.
 */
export function calcTaxes(input, table = TAX) {
  const {
    filingStatus = 'mfj',
    w2Gross = 0,               // wife's total W-2 comp incl. bonus, before any deferral
    sePro = 0,                 // net profit from the eBay business (Schedule C)
    trad401k = 0,              // pre-tax elective deferral from W-2 pay
    roth401k = 0,              // after-tax deferral (no current deduction)
    solo401kEmployee = 0,      // pre-tax deferral from self-employment
    solo401kEmployer = 0,      // profit-sharing contribution from self-employment
    hsa = 0,                   // HSA via payroll (exempt from FICA too)
    healthPremium = 0,         // Section 125 premiums (exempt from FICA)
    otherPreTax = 0,           // FSA, dependent care, etc.
    tradIRA = 0,               // deductible IRA (assumed non-deductible if covered & over limit)
    ga529 = 0,                 // Georgia Path2College contributions
    kidsUnder17 = 0,
    otherDependents = 0,
    itemized = 0,
    seOwnerW2Wages = 0         // W-2 wages earned by the SAME person as the self-employment income
  } = input;

  const f = table.federal, g = table.georgia;
  const fs = filingStatus in f.standardDeduction ? filingStatus : 'mfj';

  /* ---- payroll / FICA ---- */
  const section125 = healthPremium + otherPreTax + hsa;
  const ficaWages = Math.max(0, w2Gross - section125);
  const taxableW2 = Math.max(0, ficaWages - trad401k);

  const ssW2 = Math.min(ficaWages, f.socialSecurityWageBase) * f.socialSecurityRate;
  const medW2 = ficaWages * f.medicareRate;

  /* ---- self-employment tax ---- */
  const seNet = Math.max(0, sePro) * f.seTaxableShare;
  // The Social Security wage base is per person, so only W-2 wages belonging to the
  // self-employed spouse eat into their own base.
  const ssRoom = Math.max(0, f.socialSecurityWageBase - Math.max(0, seOwnerW2Wages));
  const seSS = Math.min(seNet, ssRoom) * f.socialSecurityRate * 2;
  const seMed = seNet * f.medicareRate * 2;
  const seTax = seSS + seMed;
  const halfSE = seTax / 2;

  /* ---- additional Medicare (0.9% over threshold) ---- */
  const addlBase = Math.max(0, ficaWages + seNet - f.addlMedicareThreshold[fs]);
  const addlMedicare = addlBase * f.addlMedicareRate;

  const ficaEmployee = ssW2 + medW2 + addlMedicare;

  /* ---- AGI ---- */
  const seDeductions = halfSE + solo401kEmployee + solo401kEmployer;
  const scheduleCtoAGI = Math.max(0, sePro) - seDeductions;
  const agi = Math.max(0, taxableW2 + scheduleCtoAGI - tradIRA);

  /* ---- deduction + QBI ---- */
  const stdDed = f.standardDeduction[fs];
  const deduction = Math.max(stdDed, itemized);
  const preQbiTaxable = Math.max(0, agi - deduction);
  const qbiBase = Math.max(0, Math.max(0, sePro) - seDeductions);
  const qbi = Math.min(qbiBase * f.qbiRate, preQbiTaxable * f.qbiRate);
  const taxableIncome = Math.max(0, preQbiTaxable - qbi);

  /* ---- federal income tax ---- */
  const brackets = f.brackets[fs];
  const grossFedTax = bracketTax(taxableIncome, brackets);

  let credits = kidsUnder17 * f.childTaxCredit + otherDependents * f.otherDependentCredit;
  const poStart = f.ctcPhaseoutStart[fs];
  if (agi > poStart) credits = Math.max(0, credits - Math.ceil((agi - poStart) / 1000) * 50);
  const fedIncomeTax = Math.max(0, grossFedTax - credits);

  /* Credits bigger than the tax bill are partly refundable (the additional child
     tax credit), which is how a low-income year hands money back. */
  const unusedCredits = Math.max(0, credits - grossFedTax);
  const earnedIncome = ficaWages + seNet;
  const refundableCredit = Math.min(
    unusedCredits,
    kidsUnder17 * f.refundableCTCPerChild,
    Math.max(0, (earnedIncome - f.actcEarnedIncomeFloor) * f.actcRate)
  );

  /* ---- Georgia ---- */
  const gaStd = g.standardDeduction[fs];
  const ga529Cap = (g.r529DeductionPerBeneficiary[fs] ?? 2000) * Math.max(0, kidsUnder17 + otherDependents);
  const ga529Ded = Math.min(ga529, ga529Cap);
  const gaTaxable = Math.max(0, agi - gaStd - (kidsUnder17 + otherDependents) * g.dependentExemption - ga529Ded);
  const gaTax = gaTaxable * g.rate;

  /* ---- totals ---- */
  const totalTax = fedIncomeTax - refundableCredit + ficaEmployee + seTax + gaTax;
  const grossIncome = w2Gross + Math.max(0, sePro);
  const preTaxSaved = trad401k + solo401kEmployee + solo401kEmployer + hsa;
  const afterTaxSaved = roth401k;

  // cash that actually reaches the checking account
  const netCash = grossIncome - totalTax - preTaxSaved - afterTaxSaved - healthPremium - otherPreTax;

  const fedMarginal = marginalRate(taxableIncome, brackets);
  const marginalAll = fedMarginal + g.rate + (sePro > 0 ? 0 : 0);

  return {
    year: table.year, filingStatus: fs,
    grossIncome, w2Gross, sePro,
    section125, ficaWages, taxableW2,
    agi, deduction, qbi, taxableIncome,
    grossFedTax, credits, fedIncomeTax, unusedCredits, refundableCredit,
    ssW2, medW2, addlMedicare, ficaEmployee,
    seNet, seSS, seMed, seTax, halfSE,
    gaTaxable, gaTax, ga529Ded, ga529Cap,
    totalTax,
    preTaxSaved, afterTaxSaved, healthPremium, otherPreTax,
    netCash, netCashMonthly: netCash / 12,
    effectiveRate: grossIncome ? (totalTax / grossIncome) * 100 : 0,
    fedEffectiveRate: grossIncome ? (fedIncomeTax / grossIncome) * 100 : 0,
    marginalFed: fedMarginal * 100,
    marginalState: g.rate * 100,
    marginalCombined: marginalAll * 100,
    // what one more pre-tax dollar saves
    savingsPerPreTaxDollar: (fedMarginal + g.rate) * 100
  };
}

/** Marginal value of an extra pre-tax contribution, measured by re-running the model. */
export function marginalBenefit(input, field, amount, table = TAX) {
  const a = calcTaxes(input, table);
  const b = calcTaxes({ ...input, [field]: (input[field] || 0) + amount }, table);
  return { taxSaved: a.totalTax - b.totalTax, netCashCost: a.netCash - b.netCash, before: a, after: b };
}
