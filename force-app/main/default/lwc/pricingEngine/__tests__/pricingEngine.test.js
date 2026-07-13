import {
  computeBaseQuote,
  computeAddOns,
  computeCallCenter,
  computeRatingsReviews,
  computeEnterpriseQuote,
  getDiscountGuidance,
  ENTERPRISE_LOCATION_THRESHOLD
} from "c/pricingEngine";

describe("computeBaseQuote", () => {
  it("matches the spreadsheet's saved example: Professional Foundational at 300 locations", () => {
    const result = computeBaseQuote("Professional Foundational", 300);
    expect(result.isEnterprise).toBe(false);
    expect(result.totalAnnual).toBeCloseTo(233898, 2);
    expect(result.totalMonthly).toBeCloseTo(19491.5, 2);
    expect(result.pricePerLocationPerMonth).toBeCloseTo(64.9717, 2);
    expect(result.gmPercent).toBeCloseTo(0.922940769053177, 6);
  });

  it("always bills a minimum of 100 locations even when fewer are entered", () => {
    const result = computeBaseQuote("Standard Foundational", 10);
    expect(result.totalLocationsBilled).toBe(100);
    // Standard Foundational entry rate = 60000 / 100 / 12 = 50/mo
    expect(result.totalMonthly).toBeCloseTo(5000, 2);
  });

  it("allocates locations across volume-discount buckets at tier boundaries", () => {
    const at100 = computeBaseQuote("Standard Foundational", 100);
    expect(at100.buckets[0].locationsInBucket).toBe(100);
    expect(at100.buckets[1].locationsInBucket).toBe(0);

    const at101 = computeBaseQuote("Standard Foundational", 101);
    expect(at101.buckets[0].locationsInBucket).toBe(100);
    expect(at101.buckets[1].locationsInBucket).toBe(1);
  });

  it("switches to enterprise mode above 1,250 locations", () => {
    const result = computeBaseQuote("Standard Elite", 1251);
    expect(result.isEnterprise).toBe(true);
  });

  it("bills the full 1,250-location ceiling at exactly the threshold", () => {
    const result = computeBaseQuote(
      "Standard Foundational",
      ENTERPRISE_LOCATION_THRESHOLD
    );
    expect(result.isEnterprise).toBe(false);
    expect(result.totalLocationsBilled).toBe(1250);
  });
});

describe("computeAddOns", () => {
  it("returns zero totals when no add-ons are selected", () => {
    const result = computeAddOns({}, 300);
    expect(result.annualTotal).toBe(0);
    expect(result.perLocPerMonth).toBe(0);
  });

  it("computes flat annual totals independent of location count (rate x qty)", () => {
    const result = computeAddOns({ additionalBrands: 1 }, 300);
    expect(result.annualTotal).toBe(15000);
    // $/loc/mo = 15000 / 300 / 12
    expect(result.perLocPerMonth).toBeCloseTo(4.17, 2);
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
    // annualTotal should already reflect the agent count once; perLocPerMonth should be
    // a small fraction of annualTotal/locations/12, not annualTotal*agents/locations/12.
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

describe("computeEnterpriseQuote", () => {
  it("matches the ALTERNATIVE - LARGE PROSPECT sheet's worked example at 3,000 locations", () => {
    const result = computeEnterpriseQuote(
      3000,
      {
        additionalLanguages: 0,
        additionalSurveys: 1,
        additionalSurveyRevisions: 0,
        additionalIntegrations: 0,
        additionalBrands: 0
      },
      { enabled: true, tier: "pro" },
      true
    );
    expect(result.foundational.annual).toBeCloseTo(792200, 2);
    expect(result.advanced.annual).toBeCloseTo(990250, 2);
    expect(result.elite.annual).toBeCloseTo(1287325, 2);
    expect(result.foundational.perLocPerMonth).toBeCloseTo(22.0056, 2);
    expect(result.advanced.perLocPerMonth).toBeCloseTo(27.5069, 2);
    expect(result.elite.perLocPerMonth).toBeCloseTo(35.759, 2);
  });
});

describe("getDiscountGuidance", () => {
  it("returns the applicable guidance band for the location count", () => {
    expect(getDiscountGuidance(50)).toMatch(/20-25%/);
    expect(getDiscountGuidance(300)).toMatch(/20-30%/);
    expect(getDiscountGuidance(600)).toMatch(/25-35%/);
    expect(getDiscountGuidance(1000)).toMatch(/30-40%/);
  });
});
