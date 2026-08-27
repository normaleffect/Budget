/* Federal + Georgia tax parameters.
   2026 figures. Everything here is editable from Plan > Taxes > Assumptions. */
export const TAX = {
  year: 2026,
  federal: {
    standardDeduction: { mfj: 32200, single: 16100, hoh: 24150 },
    brackets: {
      mfj:    [[0,.10],[24800,.12],[100800,.22],[211100,.24],[402550,.32],[511300,.35],[767000,.37]],
      single: [[0,.10],[12400,.12],[50400,.22],[105550,.24],[201275,.32],[255650,.35],[640600,.37]],
      hoh:    [[0,.10],[17700,.12],[67450,.22],[105700,.24],[201250,.32],[255650,.35],[640600,.37]]
    },
    childTaxCredit: 2200,
    refundableCTCPerChild: 1700,
    actcEarnedIncomeFloor: 2500,
    actcRate: 0.15,
    otherDependentCredit: 500,
    ctcPhaseoutStart: { mfj: 400000, single: 200000, hoh: 200000 },
    qbiRate: 0.20,
    socialSecurityRate: 0.062,
    socialSecurityWageBase: 184500,
    medicareRate: 0.0145,
    addlMedicareRate: 0.009,
    addlMedicareThreshold: { mfj: 250000, single: 200000, hoh: 200000 },
    seTaxableShare: 0.9235,
    limits: {
      elective401k: 24500, catchup401k: 8000,
      totalDC: 72000,
      ira: 7500, iraCatchup: 1100,
      hsaFamily: 8750, hsaSingle: 4400,
      rothIraPhaseout: { mfj: [242000, 252000], single: [153000, 168000] }
    }
  },
  georgia: {
    rate: 0.0509,                 // flat rate, stepping down toward 4.99%
    standardDeduction: { mfj: 24000, single: 12000, hoh: 12000 },
    dependentExemption: 4000,
    r529DeductionPerBeneficiary: { mfj: 4000, single: 2000 },
    retirementExclusion62: 35000,
    retirementExclusion65: 65000
  }
};
