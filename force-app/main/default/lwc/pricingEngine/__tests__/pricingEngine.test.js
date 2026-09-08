import {
  computeBaseQuote,
  computeSetupFee,
  computeThreeYearProjection,
  computeAddOns,
  computeCallCenter,
  computeRatingsReviews,
  computeCommunityQuote,
  computeIgniteEx,
  computeIgniteDigitalExtras,
  getDiscountGuidance,
  SERVICE_TIERS,
  LOCATION_BANDS,
  ANNUAL_MINIMUM_FLOOR,
  AGENT_COUNT_BANDS
} from "c/pricingEngine";

describe("computeBaseQuote", () => {
  it("matches the REVISED Pricing Table's Advanced tier $/location/month band rates", () => {
    expect(computeBaseQuote("Advanced", 125, 36).listRatePerLocationPerMonth).toBe(72);
    expect(computeBaseQuote("Advanced", 225, 36).listRatePerLocationPerMonth).toBe(52.2);
    expect(computeBaseQuote("Advanced", 450, 36).listRatePerLocationPerMonth).toBe(25);
    expect(computeBaseQuote("Advanced", 900, 36).listRatePerLocationPerMonth).toBe(23.25);
    // The raw table rate (20.925/18.414/15.83604) has more precision than round2 keeps (2
    // decimal places) - listRatePerLocationPerMonth is always the rounded figure, same as the
    // original 5-plan rate card's many-decimal Pro/Advanced rates were.
    expect(computeBaseQuote("Advanced", 1800, 36).listRatePerLocationPerMonth).toBe(20.93);
    expect(computeBaseQuote("Advanced", 3500, 36).listRatePerLocationPerMonth).toBe(18.41);
    expect(computeBaseQuote("Advanced", 6000, 36).listRatePerLocationPerMonth).toBe(15.84);
  });

  it("matches Elite's recommended $/location/month band rates (2026-08-17)", () => {
    expect(computeBaseQuote("Elite", 125, 36).listRatePerLocationPerMonth).toBe(92);
    expect(computeBaseQuote("Elite", 225, 36).listRatePerLocationPerMonth).toBe(67);
    expect(computeBaseQuote("Elite", 450, 36).listRatePerLocationPerMonth).toBe(32);
    expect(computeBaseQuote("Elite", 900, 36).listRatePerLocationPerMonth).toBe(30);
    expect(computeBaseQuote("Elite", 1800, 36).listRatePerLocationPerMonth).toBe(27);
    expect(computeBaseQuote("Elite", 3500, 36).listRatePerLocationPerMonth).toBe(23.5);
    expect(computeBaseQuote("Elite", 6000, 36).listRatePerLocationPerMonth).toBe(20.25);
  });

  it("matches the REVISED Pricing Table's per-tier rates in the 151-300 band", () => {
    expect(computeBaseQuote("Advanced", 225, 36).listRatePerLocationPerMonth).toBe(52.2);
    expect(computeBaseQuote("Foundational", 225, 36).listRatePerLocationPerMonth).toBe(43.5);
    expect(computeBaseQuote("Elite", 225, 36).listRatePerLocationPerMonth).toBe(67);
  });

  it("prices the 1-100 location band as a flat annual fee, not a $/location/month rate", () => {
    const flatFeesByTier = {
      Advanced: 120000,
      Foundational: 60000,
      Elite: 155000
    };
    for (const tier of SERVICE_TIERS) {
      expect(computeBaseQuote(tier, 50, 36).totalAnnual).toBe(flatFeesByTier[tier]);
      expect(computeBaseQuote(tier, 100, 36).totalAnnual).toBe(flatFeesByTier[tier]);
    }
  });

  it("matches the 2,501-5,000 band exactly for Advanced at 3,500 locations", () => {
    // Uses the rounded 18.41 rate (see the band-rates test above), not the raw 18.414 -
    // 18.41 x 3,500 x 12.
    const result = computeBaseQuote("Advanced", 3500, 36);
    expect(result.totalAnnual).toBe(773220);
  });

  it("matches the 2,501-5,000 band exactly for Elite at 3,500 locations", () => {
    const result = computeBaseQuote("Elite", 3500, 36);
    expect(result.totalAnnual).toBe(987000);
  });

  it("flags locations above 5,000 as custom pricing", () => {
    expect(computeBaseQuote("Advanced", 3500, 36).isCustomPricing).toBe(false);
    expect(computeBaseQuote("Advanced", 5001, 36).isCustomPricing).toBe(true);
    expect(computeBaseQuote("Elite", 5001, 36).isCustomPricing).toBe(true);
  });

  it("defines the annual minimum floors by service tier", () => {
    expect(ANNUAL_MINIMUM_FLOOR.advanced).toBe(80000);
    expect(ANNUAL_MINIMUM_FLOOR.foundational).toBe(60000);
    expect(ANNUAL_MINIMUM_FLOOR.elite).toBe(155000);
  });

  it("never needs to apply the annual minimum floor under the new rate card - every tier's flat 1-100 fee already clears its own floor", () => {
    for (const tier of SERVICE_TIERS) {
      expect(computeBaseQuote(tier, 50, 36).floorApplied).toBe(false);
    }
  });

  it("does not apply the floor once the raw annual clears it", () => {
    const result = computeBaseQuote("Advanced", 900, 36);
    expect(result.floorApplied).toBe(false);
    expect(result.totalAnnual).toBe(251100);
  });

  it("applies Elite's $155,000 floor at the low end of the 101-150 band, where the $/location rate alone falls short", () => {
    // 92/loc/mo x 101 locations x 12 = $111,504 raw - below the $155,000 floor.
    const result = computeBaseQuote("Elite", 101, 36);
    expect(result.floorApplied).toBe(true);
    expect(result.totalAnnual).toBe(155000);
  });

  it("no longer needs Elite's floor once the $/location rate clears it within the same band", () => {
    // 92/loc/mo x 150 locations x 12 = $165,600 raw - already above the $155,000 floor.
    const result = computeBaseQuote("Elite", 150, 36);
    expect(result.floorApplied).toBe(false);
    expect(result.totalAnnual).toBe(165600);
  });

  it("applies the 24-month (+5%) and 12-month (+10%) term premiums", () => {
    // Advanced 601-1,200 band rate (REVISED Pricing Table) - compare against this raw
    // rate directly rather than the already-rounded 36-month result, since chaining two
    // roundings (rate -> term36 -> *1.1) can drift past a tight toBeCloseTo tolerance.
    const baseRate = 23.25;
    const term36 = computeBaseQuote("Advanced", 900, 36).listRatePerLocationPerMonth;
    const term24 = computeBaseQuote("Advanced", 900, 24).listRatePerLocationPerMonth;
    const term12 = computeBaseQuote("Advanced", 900, 12).listRatePerLocationPerMonth;
    expect(term36).toBeCloseTo(baseRate, 2);
    expect(term24).toBeCloseTo(baseRate * 1.05, 2);
    expect(term12).toBeCloseTo(baseRate * 1.1, 2);
  });

  it("applies the term premium to the flat 1-100 fee too", () => {
    const term36 = computeBaseQuote("Advanced", 50, 36).totalAnnual;
    const term12 = computeBaseQuote("Advanced", 50, 12).totalAnnual;
    expect(term12).toBeCloseTo(term36 * 1.1, 2);
  });

  it("throws for an unknown service tier", () => {
    expect(() => computeBaseQuote("Bogus", 100, 36)).toThrow();
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

  it("gives every service tier a rate (flat fee or $/location/month) in every band", () => {
    for (const band of LOCATION_BANDS) {
      const rateMap = band.isFlatFee
        ? band.flatAnnualFeeByPlan
        : band.ratePerLocationPerMonthByPlan;
      for (const tier of SERVICE_TIERS) {
        expect(typeof rateMap[tier]).toBe("number");
      }
    }
  });
});

describe("AGENT_COUNT_BANDS", () => {
  it("defines exactly the three bands the Number of Agents picklist exposes", () => {
    expect(AGENT_COUNT_BANDS.map((band) => band.key)).toEqual([
      "0-60",
      "60-100",
      "100-200"
    ]);
  });

  it("gives each band a representative agent count that feeds computeCallCenter's existing tiers", () => {
    expect(
      AGENT_COUNT_BANDS.find((band) => band.key === "0-60").representativeCount
    ).toBe(30);
    expect(
      AGENT_COUNT_BANDS.find((band) => band.key === "60-100")
        .representativeCount
    ).toBe(80);
    expect(
      AGENT_COUNT_BANDS.find((band) => band.key === "100-200")
        .representativeCount
    ).toBe(150);
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
  it("matches the Deal Calculator sheet's worked example (800 locations, Advanced, 36mo)", () => {
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

  it("prices additional Performance, Agile, and Consultative units at their flat per-unit rates", () => {
    const result = computeAddOns(
      { additionalPerformance: 2, additionalAgile: 1, additionalConsultative: 1 },
      300
    );
    expect(result.annualTotal).toBe(2 * 12000 + 15000 + 35000);
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

describe("computeIgniteEx", () => {
  it("prices the Long Form Annual Survey engagement tiers off the location band", () => {
    const result = computeIgniteEx({
      selectedItems: ["engagementOneConsultative"],
      locations: 600,
      pulseQuantity: 0
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].unitPrice).toBe(135000);
    expect(result.annualTotal).toBe(135000);
    expect(result.oneTimeTotal).toBe(0);
  });

  it("prices Pulse as a flat $20,000 per pulse, one-time", () => {
    const result = computeIgniteEx({
      selectedItems: ["pulse"],
      locations: 600,
      pulseQuantity: 3
    });
    expect(result.lines[0].quantity).toBe(3);
    expect(result.lines[0].unitPrice).toBe(20000);
    expect(result.oneTimeTotal).toBe(60000);
    expect(result.annualTotal).toBe(0);
  });

  it("does not add a Pulse line when Pulse is selected but the quantity is zero", () => {
    const result = computeIgniteEx({
      selectedItems: ["pulse"],
      locations: 600,
      pulseQuantity: 0
    });
    expect(result.lines).toHaveLength(0);
  });

  it("splits Onboard, Exit, and Always-On into a one-time setup line and a recurring annual line", () => {
    const result = computeIgniteEx({
      selectedItems: ["onboard"],
      locations: 600,
      pulseQuantity: 0
    });
    expect(result.lines).toHaveLength(2);
    expect(result.oneTimeTotal).toBe(10000);
    expect(result.annualTotal).toBe(5000);
  });

  it("prices Staggered Onboard, 2 Agile Analyses, Performance Insight, and Consultative as flat one-time fees", () => {
    const result = computeIgniteEx({
      selectedItems: [
        "staggeredOnboard",
        "agileAnalysesPair",
        "performanceInsight",
        "consultative"
      ],
      locations: 600,
      pulseQuantity: 0
    });
    expect(result.oneTimeTotal).toBe(40000 + 10000 + 8000 + 28000);
    expect(result.annualTotal).toBe(0);
  });

  it("flags 10,000+ locations as custom pricing for the banded items", () => {
    const result = computeIgniteEx({
      selectedItems: ["engagementOneConsultative"],
      locations: 10500,
      pulseQuantity: 0
    });
    expect(result.isCustomPricing).toBe(true);
    expect(result.lines[0].unitPrice).toBe(0);
  });
});

describe("computeIgniteDigitalExtras", () => {
  it("prices Mouseflow Config by its own Essential/Advanced/Elite tier, independent of Service Tier", () => {
    expect(
      computeIgniteDigitalExtras(["mouseflowConfig"], "Essential").annualTotal
    ).toBe(45000);
    expect(
      computeIgniteDigitalExtras(["mouseflowConfig"], "Advanced").annualTotal
    ).toBe(75000);
    expect(
      computeIgniteDigitalExtras(["mouseflowConfig"], "Elite").annualTotal
    ).toBe(110000);
  });

  it("prices Contact Us (Inform) as a flat $30,000/year regardless of Mouseflow tier", () => {
    expect(
      computeIgniteDigitalExtras(["contactUs"], "Essential").annualTotal
    ).toBe(30000);
    expect(
      computeIgniteDigitalExtras(["contactUs"], "Elite").annualTotal
    ).toBe(30000);
  });

  it("sums both extras when both are selected", () => {
    const result = computeIgniteDigitalExtras(
      ["mouseflowConfig", "contactUs"],
      "Advanced"
    );
    expect(result.lines).toHaveLength(2);
    expect(result.annualTotal).toBe(75000 + 30000);
  });

  it("returns no lines when nothing is selected", () => {
    expect(computeIgniteDigitalExtras([], "Advanced").lines).toHaveLength(0);
  });
});

describe("getDiscountGuidance", () => {
  it("returns guidance consistent with the 10%-capped modeled discount", () => {
    expect(getDiscountGuidance()).toMatch(/10%/);
  });
});
