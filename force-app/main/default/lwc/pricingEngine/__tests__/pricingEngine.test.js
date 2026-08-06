import {
  computeBaseQuote,
  computeSetupFee,
  computeThreeYearProjection,
  computeAddOns,
  computeCallCenter,
  computeRatingsReviews,
  computeCommunityQuote,
  getDiscountGuidance,
  PLANS,
  LOCATION_BANDS,
  ANNUAL_MINIMUM_FLOOR
} from "c/pricingEngine";

describe("computeBaseQuote", () => {
  it("matches the REVISED Pricing Table's Pro/Advanced $/location/month band rates", () => {
    expect(computeBaseQuote("Pro/Advanced", 125, 36).listRatePerLocationPerMonth).toBe(80);
    expect(computeBaseQuote("Pro/Advanced", 225, 36).listRatePerLocationPerMonth).toBe(58);
    expect(computeBaseQuote("Pro/Advanced", 450, 36).listRatePerLocationPerMonth).toBeCloseTo(32.44, 2);
    expect(computeBaseQuote("Pro/Advanced", 900, 36).listRatePerLocationPerMonth).toBeCloseTo(30.17, 2);
    expect(computeBaseQuote("Pro/Advanced", 1800, 36).listRatePerLocationPerMonth).toBeCloseTo(27.15, 2);
    expect(computeBaseQuote("Pro/Advanced", 3500, 36).listRatePerLocationPerMonth).toBeCloseTo(23.89, 2);
    expect(computeBaseQuote("Pro/Advanced", 6000, 36).listRatePerLocationPerMonth).toBeCloseTo(20.55, 2);
  });

  it("matches the REVISED Pricing Table's per-plan rates in the 151-300 band", () => {
    expect(computeBaseQuote("Standard/Advanced", 225, 36).listRatePerLocationPerMonth).toBe(52.2);
    expect(computeBaseQuote("Pro/Foundational", 225, 36).listRatePerLocationPerMonth).toBe(48.14);
    expect(computeBaseQuote("Standard/Foundational", 225, 36).listRatePerLocationPerMonth).toBe(43.5);
    expect(computeBaseQuote("Solution Support Only", 225, 36).listRatePerLocationPerMonth).toBe(31.9);
  });

  it("prices the 1-100 location band as a flat annual fee, not a $/location/month rate", () => {
    const flatFeesByPlan = {
      "Pro/Advanced": 144000,
      "Standard/Advanced": 120000,
      "Pro/Foundational": 80000,
      "Standard/Foundational": 60000,
      "Solution Support Only": 44000
    };
    for (const plan of PLANS) {
      expect(computeBaseQuote(plan, 50, 36).totalAnnual).toBe(flatFeesByPlan[plan]);
      expect(computeBaseQuote(plan, 100, 36).totalAnnual).toBe(flatFeesByPlan[plan]);
    }
  });

  it("matches the 2,501-5,000 band exactly for Pro/Advanced at 3,500 locations", () => {
    const result = computeBaseQuote("Pro/Advanced", 3500, 36);
    expect(result.totalAnnual).toBe(1003380);
  });

  it("flags locations above 5,000 as custom pricing", () => {
    expect(computeBaseQuote("Pro/Advanced", 3500, 36).isCustomPricing).toBe(false);
    expect(computeBaseQuote("Pro/Advanced", 5001, 36).isCustomPricing).toBe(true);
  });

  it("defines the annual minimum floors by plan tier", () => {
    expect(ANNUAL_MINIMUM_FLOOR.advanced).toBe(80000);
    expect(ANNUAL_MINIMUM_FLOOR.foundational).toBe(60000);
    expect(ANNUAL_MINIMUM_FLOOR.supportOnly).toBe(36000);
  });

  it("never needs to apply the annual minimum floor under the new rate card - every plan's flat 1-100 fee already clears its own floor", () => {
    for (const plan of PLANS) {
      expect(computeBaseQuote(plan, 50, 36).floorApplied).toBe(false);
    }
  });

  it("does not apply the floor once the raw annual clears it", () => {
    const result = computeBaseQuote("Pro/Advanced", 900, 36);
    expect(result.floorApplied).toBe(false);
    expect(result.totalAnnual).toBe(325836);
  });

  it("applies the 24-month (+5%) and 12-month (+10%) term premiums", () => {
    // Pro/Advanced 601-1,200 band rate (REVISED Pricing Table) - compare against this raw
    // rate directly rather than the already-rounded 36-month result, since chaining two
    // roundings (rate -> term36 -> *1.1) can drift past a tight toBeCloseTo tolerance.
    const baseRate = 30.166875;
    const term36 = computeBaseQuote("Pro/Advanced", 900, 36).listRatePerLocationPerMonth;
    const term24 = computeBaseQuote("Pro/Advanced", 900, 24).listRatePerLocationPerMonth;
    const term12 = computeBaseQuote("Pro/Advanced", 900, 12).listRatePerLocationPerMonth;
    expect(term36).toBeCloseTo(baseRate, 2);
    expect(term24).toBeCloseTo(baseRate * 1.05, 2);
    expect(term12).toBeCloseTo(baseRate * 1.1, 2);
  });

  it("applies the term premium to the flat 1-100 fee too", () => {
    const term36 = computeBaseQuote("Pro/Advanced", 50, 36).totalAnnual;
    const term12 = computeBaseQuote("Pro/Advanced", 50, 12).totalAnnual;
    expect(term12).toBeCloseTo(term36 * 1.1, 2);
  });

  it("throws for an unknown plan", () => {
    expect(() => computeBaseQuote("Elite", 100, 36)).toThrow();
  });
});

describe("LOCATION_BANDS", () => {
  it("covers every location count from 1 upward with no gaps", () => {
    expect(LOCATION_BANDS[0].min).toBe(1);
    for (let i = 1; i < LOCATION_BANDS.length; i += 1) {
      expect(LOCATION_BANDS[i].min).toBe(LOCATION_BANDS[i - 1].max + 1);
    }
    expect(LOCATION_BANDS[LOCATION_BANDS.length - 1].max).toBe(Infinity);
  });

  it("gives every plan a rate (flat fee or $/location/month) in every band", () => {
    for (const band of LOCATION_BANDS) {
      const rateMap = band.isFlatFee
        ? band.flatAnnualFeeByPlan
        : band.ratePerLocationPerMonthByPlan;
      for (const plan of PLANS) {
        expect(typeof rateMap[plan]).toBe("number");
      }
    }
  });
});

describe("computeSetupFee", () => {
  it("matches the Deal Calculator sheet's worked example: 800 committed locations -> $13,000", () => {
    expect(computeSetupFee(800)).toBe(13000);
  });

  it("charges just the $5,000 base fee at zero committed locations", () => {
    expect(computeSetupFee(0)).toBe(5000);
  });

  it("caps the fee at $40,000 regardless of location count", () => {
    expect(computeSetupFee(4000)).toBe(40000);
    expect(computeSetupFee(100000)).toBe(40000);
  });
});

describe("computeThreeYearProjection", () => {
  it("matches the Deal Calculator sheet's worked example (800 locations, Pro/Advanced, 36mo)", () => {
    const result = computeThreeYearProjection(326400);
    expect(result.year1).toBe(326400);
    expect(result.year2).toBeCloseTo(339456, 2);
    expect(result.year3).toBeCloseTo(353034.24, 2);
    expect(result.threeYearTotal).toBeCloseTo(1018890.24, 2);
  });
});

describe("computeAddOns", () => {
  it("returns zero totals when no add-ons are selected", () => {
    const result = computeAddOns({}, 300);
    expect(result.annualTotal).toBe(0);
    expect(result.perLocPerMonth).toBe(0);
  });

  it("prices additional brands at the memo's updated $6,000/yr multi-brand rate", () => {
    const result = computeAddOns({ additionalBrands: 1 }, 300);
    expect(result.annualTotal).toBe(6000);
    // $/loc/mo = 6000 / 300 / 12
    expect(result.perLocPerMonth).toBeCloseTo(1.67, 2);
  });
});

describe("computeCallCenter", () => {
  it('returns zero cost for variant "none"', () => {
    expect(computeCallCenter("none", 0, 300).annualTotal).toBe(0);
  });

  it("applies the flat platform floor even at zero agents once a variant is selected", () => {
    const web = computeCallCenter("web", 0, 300);
    expect(web.annualTotal).toBe(25000);
  });

  it("does not double-count agents when converting to $/loc/mo (corrected G46-style formula)", () => {
    const web = computeCallCenter("web", 50, 500);
    const expectedPerLoc = Math.round((web.annualTotal / 500 / 12) * 100) / 100;
    expect(web.perLocPerMonth).toBeCloseTo(expectedPerLoc, 2);
  });

  it("applies the correct agent price-per-seat tier", () => {
    const low = computeCallCenter("web", 50, 500);
    const high = computeCallCenter("web", 2000, 500);
    expect(low.pricePerAgent).toBe(185);
    expect(high.pricePerAgent).toBe(85);
  });
});

describe("computeRatingsReviews", () => {
  it("matches the ALTERNATIVE - LARGE PROSPECT sheet's worked example: Pro tier at 3,000 locations", () => {
    const result = computeRatingsReviews("pro", 3000);
    expect(result.monthly).toBeCloseTo(11475, 2);
    expect(result.annual).toBeCloseTo(137700, 2);
  });

  it("picks the top bracket for very large location counts", () => {
    const result = computeRatingsReviews("basic", 10000);
    expect(result.bracket).toBe("4,000+");
  });
});

describe("computeCommunityQuote", () => {
  it("matches the workbook's Advanced tier Market-1 total exactly (default size, 1 market)", () => {
    const result = computeCommunityQuote({
      tier: "Advanced",
      numberOfMarkets: 1,
      communitySizePerMarket: 2000,
      additionalAgileProjects: 0,
      additionalConsultancyProjects: 0,
      additionalAdminUsers: 0
    });
    expect(result.totalAnnual).toBeCloseTo(217627.9, 2);
  });

  it("matches the workbook's Elite tier Market-1 total exactly (default size, 1 market)", () => {
    const result = computeCommunityQuote({
      tier: "Elite",
      numberOfMarkets: 1,
      communitySizePerMarket: 1000,
      additionalAgileProjects: 0,
      additionalConsultancyProjects: 0,
      additionalAdminUsers: 0
    });
    expect(result.totalAnnual).toBeCloseTo(288115.3, 2);
  });

  it("matches the workbook's DIY tier total exactly (no discount, no AGILE/CONSULTANCY available)", () => {
    const result = computeCommunityQuote({
      tier: "DIY",
      numberOfMarkets: 1,
      communitySizePerMarket: 1000,
      additionalAgileProjects: 5, // should have no effect - not available on this tier
      additionalConsultancyProjects: 5, // should have no effect - not available on this tier
      additionalAdminUsers: 0
    });
    expect(result.totalAnnual).toBe(85179);
  });

  it("discounts additional markets 50% on platform fee and 75% on service fee", () => {
    const oneMarket = computeCommunityQuote({
      tier: "Advanced",
      numberOfMarkets: 1,
      communitySizePerMarket: 2000
    });
    const twoMarkets = computeCommunityQuote({
      tier: "Advanced",
      numberOfMarkets: 2,
      communitySizePerMarket: 2000
    });
    // 2nd market adds: platform*0.5 (33,601) + service*0.25 (8,478.25) + recruitment (19,843)
    const expectedSecondMarketAddOn = 33601 + 8478.25 + 19843;
    expect(twoMarkets.totalAnnual - oneMarket.totalAnnual).toBeCloseTo(
      expectedSecondMarketAddOn * (1 - 0.05),
      2
    );
  });

  it("charges $10/member over the tier's included community size, per market", () => {
    const atIncluded = computeCommunityQuote({
      tier: "DIY",
      numberOfMarkets: 1,
      communitySizePerMarket: 1000
    });
    const overIncluded = computeCommunityQuote({
      tier: "DIY",
      numberOfMarkets: 1,
      communitySizePerMarket: 1200
    });
    expect(overIncluded.totalAnnual - atIncluded.totalAnnual).toBe(2000);
  });

  it("prices additional AGILE/CONSULTANCY projects at the tier's own reconciled rate", () => {
    const base = computeCommunityQuote({
      tier: "Advanced",
      numberOfMarkets: 1,
      communitySizePerMarket: 2000
    });
    const withExtraProjects = computeCommunityQuote({
      tier: "Advanced",
      numberOfMarkets: 1,
      communitySizePerMarket: 2000,
      additionalAgileProjects: 1,
      additionalConsultancyProjects: 1
    });
    const expectedDelta = (4555 + 13366) * (1 - 0.05);
    expect(withExtraProjects.totalAnnual - base.totalAnnual).toBeCloseTo(
      expectedDelta,
      2
    );
  });

  it("never charges for additional admin users on the Advanced tier (unlimited included)", () => {
    const base = computeCommunityQuote({
      tier: "Advanced",
      numberOfMarkets: 1,
      communitySizePerMarket: 2000,
      additionalAdminUsers: 0
    });
    const withExtraAdmins = computeCommunityQuote({
      tier: "Advanced",
      numberOfMarkets: 1,
      communitySizePerMarket: 2000,
      additionalAdminUsers: 50
    });
    expect(withExtraAdmins.totalAnnual).toBe(base.totalAnnual);
  });

  it("charges $500/user for additional admin users on tiers with a finite included count", () => {
    const base = computeCommunityQuote({
      tier: "DIY",
      numberOfMarkets: 1,
      communitySizePerMarket: 1000,
      additionalAdminUsers: 0
    });
    const withExtraAdmins = computeCommunityQuote({
      tier: "DIY",
      numberOfMarkets: 1,
      communitySizePerMarket: 1000,
      additionalAdminUsers: 3
    });
    expect(withExtraAdmins.totalAnnual - base.totalAnnual).toBe(1500);
  });

  it("throws for an unknown tier", () => {
    expect(() =>
      computeCommunityQuote({ tier: "Nope", numberOfMarkets: 1 })
    ).toThrow();
  });
});

describe("getDiscountGuidance", () => {
  it("returns guidance consistent with the 10%-capped modeled discount", () => {
    expect(getDiscountGuidance()).toMatch(/10%/);
  });
});
