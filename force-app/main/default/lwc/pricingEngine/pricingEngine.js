/**
 * Pure pricing calculations for the SMG New Logo Pricing Model (July 2026).
 * Location-band rate card transcribed from "REVISED Pricing Table - RG - 7-27-2026.xlsx" -
 * each Service Tier has its own explicit $/location/month rate per band (not a flat
 * multiplier off one anchor). Everything else transcribed from "New Logo Pricing Analysis &
 * Rate Card.xlsx" and "New Logo Pricing Strategy Memo.docx" (14 executed new-logo order
 * forms, 2018-2026).
 *
 * Service Tier (Foundational/Advanced/Elite) replaces the prior 5-value Plan: Foundational
 * and Advanced reuse the former Standard/Foundational and Standard/Advanced rate columns
 * (the Pro/Standard distinction and the separate Solution-Support-Only plan were dropped).
 * Elite's rate card (recommended pricing, 2026-08-17) is a new tier, not reused from any
 * prior plan.
 *
 * No LWC/Apex dependencies here by design - keep this file plain, importable,
 * and unit-testable in isolation.
 */

export const SERVICE_TIERS = ["Foundational", "Advanced", "Elite"];

// REVISED Pricing Table (RG, 2026-07-27) for Foundational/Advanced (collapsed from 5 plans
// down to the 2 tiers that map onto them - the former Standard/Foundational and
// Standard/Advanced columns; the Pro/Standard distinction and the separate
// Solution-Support-Only plan were dropped when Plan became the 3-value Service Tier), plus
// Elite's recommended rate card (2026-08-17). Each tier has its own explicit $/location/month
// rate per band (not a flat multiplier off one anchor - the ratio between tiers isn't
// constant across bands). The 1-100 band is a flat annual fee, not a $/location/month rate,
// per that table's note ("Change 'up to 100 locations' to be a flat-rate, not $/loc./month").
export const LOCATION_BANDS = [
  {
    min: 1,
    max: 100,
    label: "1 - 100",
    isFlatFee: true,
    flatAnnualFeeByPlan: {
      Advanced: 120000,
      Foundational: 60000,
      Elite: 155000
    }
  },
  {
    min: 101,
    max: 150,
    label: "101 - 150",
    ratePerLocationPerMonthByPlan: {
      Advanced: 72,
      Foundational: 60,
      Elite: 92
    }
  },
  {
    min: 151,
    max: 300,
    label: "151 - 300",
    ratePerLocationPerMonthByPlan: {
      Advanced: 52.2,
      Foundational: 43.5,
      Elite: 67
    }
  },
  {
    min: 301,
    max: 600,
    label: "301 - 600",
    ratePerLocationPerMonthByPlan: {
      Advanced: 25,
      Foundational: 20,
      Elite: 32
    }
  },
  {
    min: 601,
    max: 1200,
    label: "601 - 1,200",
    ratePerLocationPerMonthByPlan: {
      Advanced: 23.25,
      Foundational: 18.6,
      Elite: 30
    }
  },
  {
    min: 1201,
    max: 2500,
    label: "1,201 - 2,500",
    ratePerLocationPerMonthByPlan: {
      Advanced: 20.925,
      Foundational: 16.74,
      Elite: 27
    }
  },
  {
    min: 2501,
    max: 5000,
    label: "2,501 - 5,000",
    ratePerLocationPerMonthByPlan: {
      Advanced: 18.414,
      Foundational: 14.7312,
      Elite: 23.5
    }
  },
  {
    min: 5001,
    max: Infinity,
    label: "5,000+ (custom)",
    isCustom: true,
    ratePerLocationPerMonthByPlan: {
      Advanced: 15.83604,
      Foundational: 12.668832,
      Elite: 20.25
    }
  }
];

// Rate Card sheet, row 16 - annual minimum floors by service tier. Elite's floor equals its
// own flat 1-100 fee, so unlike Foundational/Advanced (where the floor rarely binds) it does
// bind for real at the low end of the 101-150 band, before the $/location rate alone clears it.
export const ANNUAL_MINIMUM_FLOOR = {
  advanced: 80000,
  foundational: 60000,
  elite: 155000
};

// Rate Card sheet, row 17 - $5,000 base + $10/committed location, capped at $40,000.
export const SETUP_FEE = {
  base: 5000,
  perLocation: 10,
  cap: 40000
};

// Rate Card sheet, row 18 - already the de facto standard in 9 of 12 subscription deals.
export const ESCALATOR_PERCENT = 0.04;

// Rate Card sheet, row 19 - 36 months standard; shorter terms carry a rate premium.
export const TERM_OPTIONS = [
  { months: 36, label: "36 months (standard)", ratePremium: 0 },
  { months: 24, label: "24 months", ratePremium: 0.05 },
  { months: 12, label: "12 months", ratePremium: 0.1 }
];

// Quoting Tool D26:G41 - flat unit rates for add-ons over the base package.
// additionalBrands updated per Rate Card row 22 (multi-brand adder): $15,000 -> $6,000/yr.
export const ADD_ON_RATES = {
  additionalLanguageSurveys: 2500, // per additional language, survey translation
  additionalLanguageReports: 7500, // per additional language, report translation
  additionalSurveys: 12500,
  additionalSurveyRevisions: 1500,
  additionalIntegrations: 10000,
  additionalBrands: 6000,
  additionalPerformance: 12000,
  additionalAgile: 15000,
  additionalConsultative: 35000
};

// Rate Card sheet, row 23 - Case management build, one-time.
export const CASE_MANAGEMENT_FEE = 7500;

// Ignite CX (formerly "Location Survey") is a distinct SMG product/price-book line item,
// priced off the selected Plan's rate card (computeBaseQuote) - billed as its own line only
// on a standalone (no base subscription) quote. When a base subscription is also being
// quoted, Ignite CX's location cost is already folded into the base package price, so the
// LWC skips adding a separate line item for it.

// Ignite Digital has no flat/base fee - it's priced purely through its two components below.
// Mouseflow Config has its own independent 3-tier pricing (Essential/Advanced/Elite) - not
// tied to the quote's Service Tier, since a customer's Mouseflow tier is picked separately.
// Contact Us (Inform) is a flat annual fee. Both recurring.
export const IGNITE_DIGITAL_MOUSEFLOW_TIERS = ["Essential", "Advanced", "Elite"];
export const IGNITE_DIGITAL_MOUSEFLOW_FEE_BY_TIER = {
  Essential: 45000,
  Advanced: 75000,
  Elite: 110000
};
export const IGNITE_DIGITAL_CONTACT_US_FEE = 30000;

export const IGNITE_DIGITAL_EXTRA_KEYS = ["mouseflowConfig", "contactUs"];
export const IGNITE_DIGITAL_EXTRA_LABELS = {
  mouseflowConfig: "Mouseflow Config",
  contactUs: "Contact Us (Inform)"
};

/**
 * Prices whichever Ignite Digital extras the rep has selected. mouseflowTier is Mouseflow
 * Config's own Essential/Advanced/Elite selection - independent of the quote's Service Tier.
 */
export function computeIgniteDigitalExtras(selectedExtras, mouseflowTier) {
  const selected = new Set(selectedExtras || []);
  const lines = [];

  if (selected.has("mouseflowConfig")) {
    lines.push({
      key: "mouseflowConfig",
      label: `${IGNITE_DIGITAL_EXTRA_LABELS.mouseflowConfig} (${mouseflowTier})`,
      quantity: 1,
      unitPrice: IGNITE_DIGITAL_MOUSEFLOW_FEE_BY_TIER[mouseflowTier] || 0
    });
  }
  if (selected.has("contactUs")) {
    lines.push({
      key: "contactUs",
      label: IGNITE_DIGITAL_EXTRA_LABELS.contactUs,
      quantity: 1,
      unitPrice: IGNITE_DIGITAL_CONTACT_US_FEE
    });
  }

  const withTotals = lines.map((line) => ({
    ...line,
    annualTotal: line.quantity * line.unitPrice
  }));
  const annualTotal = round2(
    withTotals.reduce((sum, line) => sum + line.annualTotal, 0)
  );

  return { lines: withTotals, annualTotal };
}

// Call Center WM - AgentTrack call-center add-on.
export const CALL_CENTER = {
  basePlatformPrice: 20000,
  webIvrSurveyBaseIncrease: 8000, // Web + IVR only
  coachingAlertPrice: 2500,
  coachingAlertQty: 2,
  ivrPricePerMinute: 0.011 * 1.15,
  ivrIncompleteMinutes: 1.5, // 50% drop scenario
  ivrCompleteMinutes: 3,
  ivrVoiceToTextPrice: 0.025,
  ivrVoiceToTextCommentRate: 0.7, // 70% leave a comment
  emailInvitePricePerMillion: 800,
  emailInviteMultiplier: 1.25,
  webIvrIvrDiscount: 0.9, // Web+IVR: 10% off IVR incompletes/completes cost
  webIvrEmailDiscount: 0.75, // Web+IVR: 25% off email cost
  agentPriceTiers: [
    { min: 0, max: 99, pricePerAgent: 185 },
    { min: 100, max: 249, pricePerAgent: 175 },
    { min: 250, max: 499, pricePerAgent: 165 },
    { min: 500, max: 749, pricePerAgent: 145 },
    { min: 750, max: 999, pricePerAgent: 125 },
    { min: 1000, max: 1249, pricePerAgent: 105 },
    { min: 1250, max: Infinity, pricePerAgent: 85 }
  ]
};

export const AGENT_TRACK_VARIANTS = ["web", "ivr", "webIvr"];

// Number of Agents is a 3-band picklist in the UI rather than a free count - each band prices
// off a representative agent count run through the (unchanged) agentPriceTiers table above,
// rather than the exact count the rep would otherwise have entered.
export const AGENT_COUNT_BANDS = [
  { key: "0-60", label: "0-60 agents", representativeCount: 30 },
  { key: "60-100", label: "60-100 agents", representativeCount: 80 },
  { key: "100-200", label: "100-200 agents", representativeCount: 150 }
];

// Ratings & Reviews sheet, rows 7-12: $/location/month by location-count bracket.
export const RATINGS_REVIEWS_TIERS = [
  { min: 1, max: 499, label: "1-499", premium: 11.52, pro: 7.65, basic: 5.76 },
  {
    min: 500,
    max: 999,
    label: "500-999",
    premium: 10.14,
    pro: 6.75,
    basic: 4.605
  },
  {
    min: 1000,
    max: 1499,
    label: "1,000-1,499",
    premium: 9.66,
    pro: 5.775,
    basic: 4.38
  },
  {
    min: 1500,
    max: 1999,
    label: "1,500-1,999",
    premium: 8.775,
    pro: 4.8,
    basic: 3.225
  },
  {
    min: 2000,
    max: 3999,
    label: "2,000-3,999",
    premium: 6.45,
    pro: 3.825,
    basic: 2.58
  },
  {
    min: 4000,
    max: Infinity,
    label: "4,000+",
    premium: 5.46,
    pro: 3.15,
    basic: 1.665
  }
];

export const RATINGS_REVIEWS_TIER_KEYS = ["premium", "pro", "basic"];
export const RATINGS_REVIEWS_TIER_LABELS = {
  premium: "Premium (all 40+ directories)",
  pro: "Pro (Google, Facebook, Bing, Yelp)",
  basic: "Basic (Google only)"
};

// Ratings & Reviews sheet, rows 18-24: Managed Listing Management / ChatExec / Local Pages.
// Not referenced by any other formula in the workbook and the column-to-breakpoint mapping
// is ambiguous (inconsistent headers) - shipped as a read-only reference table only.
export const MANAGED_LISTING_MANAGEMENT_REFERENCE = [
  { locations: "1-499", premium: 23.104, pro: 11.776, basic: 9.248 },
  { locations: "500-999", premium: 20.896, pro: 10.656, basic: 8.352 },
  { locations: "1,000-2,499", premium: 18.432, pro: 9.408, basic: 7.376 },
  { locations: "2,500-9,999", premium: 18.432, pro: 9.408, basic: 7.376 },
  { locations: "10,000-19,999", premium: 14.752, pro: 7.52, basic: 5.904 },
  { locations: "20,000+", premium: 14.256, pro: 7.264, basic: 5.696 }
];

// Ignite Communities (Bulbshare) rate card - "Bulbshare USD quote builder v1" workbook.
// Rolls up into a single Ignite Communities line item (product code IGNITE-COMMUNITIES) -
// no separate products for platform/recruitment/service/etc.
//
// Each tier's fees below are reconciled from the workbook's own Market-1 total ("Total
// Subscription Fees") minus its included AGILE/CONSULTANCY project costs, split into:
//   platformFee               - discounted 50% for each market beyond the first
//   serviceFee                - discounted to 25% for each market beyond the first
//   recruitmentAndIncentiveFee - billed in full per market (real pass-through cost, not a
//                                licence/service fee - Bulbshare always recruits the same
//                                base 1,000 members + 25% refresh regardless of tier)
//
// AGILE/CONSULTANCY per-project rates are tier-specific, not a single universal rate: Elite's
// own Market-1 formula computes to $3,050/$8,950 (24 AGILE @ $3,050 = $73,200; 8 CONSULTANCY
// @ $8,950 = $71,600) while Foundation/Advanced both reconcile to $4,555/$13,366 (Foundation:
// 8 AGILE @ $4,555 = $36,439 rounding; Advanced: 12 @ $4,555 = $54,660, 4 @ $13,366 = $53,464).
// Elite's lower per-project rate is a genuine bulk/enterprise discount, not a data error.
export const COMMUNITY_TIERS = ["DIY", "Foundation", "Advanced", "Elite"];

export const COMMUNITY_TIER_SPECS = {
  DIY: {
    label: "DIY (Starter)",
    platformFee: 59736,
    serviceFee: 5600,
    recruitmentAndIncentiveFee: 19843,
    includedCommunitySize: 1000,
    includedAgileProjects: 0,
    agileProjectRate: null,
    includedConsultancyProjects: 0,
    consultancyProjectRate: null,
    includedAdminUsers: 5,
    tierDiscountPercent: 0
  },
  Foundation: {
    label: "Foundation",
    platformFee: 59736,
    serviceFee: 14371,
    recruitmentAndIncentiveFee: 19843,
    includedCommunitySize: 1500,
    includedAgileProjects: 8,
    agileProjectRate: 4555,
    includedConsultancyProjects: 0,
    consultancyProjectRate: null,
    includedAdminUsers: 10,
    tierDiscountPercent: 0.025
  },
  Advanced: {
    label: "Advanced",
    platformFee: 67202,
    serviceFee: 33913,
    recruitmentAndIncentiveFee: 19843,
    includedCommunitySize: 2000,
    includedAgileProjects: 12,
    agileProjectRate: 4555,
    includedConsultancyProjects: 4,
    consultancyProjectRate: 13366,
    includedAdminUsers: Infinity,
    tierDiscountPercent: 0.05
  },
  Elite: {
    label: "Elite (Enterprise)",
    platformFee: 67202,
    serviceFee: 81644,
    recruitmentAndIncentiveFee: 17830,
    includedCommunitySize: 1000,
    includedAgileProjects: 24,
    agileProjectRate: 3050,
    includedConsultancyProjects: 8,
    consultancyProjectRate: 8950,
    includedAdminUsers: 10,
    tierDiscountPercent: 0.075
  }
};

// $10/member above the tier's included community size, per market, per year - the one
// explicit surcharge rate stated anywhere in the workbook (Example/GBP sheet), in USD.
export const COMMUNITY_SIZE_SURCHARGE_PER_MEMBER = 10;
// $500/user/year beyond the tier's included admin users (generic DIY/Enterprise calculator
// sheets both price additional admins this way).
export const COMMUNITY_ADDITIONAL_ADMIN_USER_RATE = 500;
// "Add. markets 50% discount on licence fees" / "Add. market based on 25% allocation".
export const COMMUNITY_ADDITIONAL_MARKET_PLATFORM_RATE = 0.5;
export const COMMUNITY_ADDITIONAL_MARKET_SERVICE_RATE = 0.25;

/**
 * Computes the all-in annual Ignite Communities price - platform + service + recruitment
 * across every market, plus AGILE/CONSULTANCY project costs (included + overage) and any
 * admin-user overage, less the tier's fixed subscription discount.
 */
export function computeCommunityQuote({
  tier,
  numberOfMarkets,
  communitySizePerMarket,
  additionalAgileProjects,
  additionalConsultancyProjects,
  additionalAdminUsers
}) {
  const spec = COMMUNITY_TIER_SPECS[tier];
  if (!spec) {
    throw new Error(`Unknown community tier: ${tier}`);
  }

  const markets = Math.max(1, Number(numberOfMarkets) || 1);
  const size = Math.max(0, Number(communitySizePerMarket) || 0);
  const extraAgile = Math.max(0, Number(additionalAgileProjects) || 0);
  const extraConsultancy = Math.max(0, Number(additionalConsultancyProjects) || 0);
  const extraAdmins = Math.max(0, Number(additionalAdminUsers) || 0);

  const sizeSurchargePerMarket = round2(
    Math.max(0, size - spec.includedCommunitySize) *
      COMMUNITY_SIZE_SURCHARGE_PER_MEMBER
  );

  let marketsCost = 0;
  for (let i = 0; i < markets; i += 1) {
    const isAdditionalMarket = i > 0;
    const platformRate = isAdditionalMarket
      ? COMMUNITY_ADDITIONAL_MARKET_PLATFORM_RATE
      : 1;
    const serviceRate = isAdditionalMarket
      ? COMMUNITY_ADDITIONAL_MARKET_SERVICE_RATE
      : 1;
    marketsCost +=
      round2(spec.platformFee * platformRate) +
      round2(spec.serviceFee * serviceRate) +
      spec.recruitmentAndIncentiveFee +
      sizeSurchargePerMarket;
  }

  const includedAgileCost = spec.agileProjectRate
    ? spec.includedAgileProjects * spec.agileProjectRate
    : 0;
  const includedConsultancyCost = spec.consultancyProjectRate
    ? spec.includedConsultancyProjects * spec.consultancyProjectRate
    : 0;
  const agileOverageCost = spec.agileProjectRate
    ? extraAgile * spec.agileProjectRate
    : 0;
  const consultancyOverageCost = spec.consultancyProjectRate
    ? extraConsultancy * spec.consultancyProjectRate
    : 0;
  const adminOverageCost = Number.isFinite(spec.includedAdminUsers)
    ? extraAdmins * COMMUNITY_ADDITIONAL_ADMIN_USER_RATE
    : 0;

  const totalBeforeDiscount = round2(
    marketsCost +
      includedAgileCost +
      includedConsultancyCost +
      agileOverageCost +
      consultancyOverageCost +
      adminOverageCost
  );
  const totalAnnual = round2(
    totalBeforeDiscount * (1 - spec.tierDiscountPercent)
  );

  return {
    tier,
    label: spec.label,
    markets,
    communitySizePerMarket: size,
    totalAnnual,
    tierDiscountPercent: spec.tierDiscountPercent,
    includedCommunitySize: spec.includedCommunitySize,
    includedAgileProjects: spec.includedAgileProjects,
    includedConsultancyProjects: spec.includedConsultancyProjects,
    includedAdminUsers: spec.includedAdminUsers,
    agileProjectRate: spec.agileProjectRate,
    consultancyProjectRate: spec.consultancyProjectRate
  };
}

// Rate card is fitted to the observed volume-discount curve and the modeled discount is
// already capped at 10% in the LWC - keep guidance consistent with that, rather than the
// prior model's much deeper (20-40%) discount bands.
export function getDiscountGuidance() {
  return "Rates are already fitted to the volume-discount curve - use the modeled discount sparingly (max 10%). Prefer a setup-fee waiver or the 2% marketing-event credit over cutting the per-location rate.";
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function findLocationBand(locations) {
  const safeLocations = Math.max(1, Number(locations) || 1);
  return (
    LOCATION_BANDS.find(
      (band) => safeLocations >= band.min && safeLocations <= band.max
    ) || LOCATION_BANDS[LOCATION_BANDS.length - 1]
  );
}

function getTermPremium(termMonths) {
  const term = TERM_OPTIONS.find((t) => t.months === Number(termMonths));
  return term ? term.ratePremium : 0;
}

function getAnnualFloor(tier) {
  if (tier === "Foundational") {
    return ANNUAL_MINIMUM_FLOOR.foundational;
  }
  if (tier === "Elite") {
    return ANNUAL_MINIMUM_FLOOR.elite;
  }
  return ANNUAL_MINIMUM_FLOOR.advanced;
}

/**
 * Computes the base package quote for a given Service Tier, location count, and term length.
 * One continuous rate card covers every deal size (REVISED Pricing Table) - locations
 * above 5,000 use the top ("custom") band rate but are flagged via isCustomPricing so the
 * UI can prompt for deal-desk review rather than silently auto-quoting. Locations 1-100 use
 * that band's flat annual fee instead of a $/location/month rate.
 */
export function computeBaseQuote(tier, locations, termMonths) {
  if (!SERVICE_TIERS.includes(tier)) {
    throw new Error(`Unknown service tier: ${tier}`);
  }
  const safeLocations = Math.max(1, Number(locations) || 1);
  const band = findLocationBand(safeLocations);
  const termPremium = getTermPremium(termMonths);

  let rawAnnual;
  let listRatePerLocationPerMonth;
  if (band.isFlatFee) {
    // 1-100 locations is a flat annual fee regardless of the actual count - not a
    // $/location/month rate - so the "per location" figure is only ever a derived average.
    rawAnnual = round2(band.flatAnnualFeeByPlan[tier] * (1 + termPremium));
    listRatePerLocationPerMonth = round2(rawAnnual / safeLocations / 12);
  } else {
    listRatePerLocationPerMonth = round2(
      band.ratePerLocationPerMonthByPlan[tier] * (1 + termPremium)
    );
    rawAnnual = round2(listRatePerLocationPerMonth * safeLocations * 12);
  }
  const annualFloor = getAnnualFloor(tier);
  const totalAnnual = Math.max(rawAnnual, annualFloor);
  const pricePerLocationPerMonth = round2(totalAnnual / safeLocations / 12);

  return {
    tier,
    locations: safeLocations,
    bandLabel: band.label,
    isCustomPricing: Boolean(band.isCustom),
    listRatePerLocationPerMonth,
    pricePerLocationPerMonth,
    totalMonthly: round2(totalAnnual / 12),
    totalAnnual,
    floorApplied: totalAnnual > rawAnnual
  };
}

/**
 * Setup fee (Rate Card row 17): $5,000 base + $10/committed location, capped at $40,000.
 * Replaces the prior model's flat, ad hoc $0-$40,000 range.
 */
export function computeSetupFee(committedLocations) {
  const safeLocations = Math.max(0, Number(committedLocations) || 0);
  return Math.min(
    round2(SETUP_FEE.base + SETUP_FEE.perLocation * safeLocations),
    SETUP_FEE.cap
  );
}

/**
 * 3-year projection using the standard 4%/year escalator (Rate Card row 18), applied
 * in-term and at renewal. Purely informational - does not affect what's quoted for Year 1.
 */
export function computeThreeYearProjection(year1Annual) {
  const year1 = round2(year1Annual);
  const year2 = round2(year1 * (1 + ESCALATOR_PERCENT));
  const year3 = round2(year2 * (1 + ESCALATOR_PERCENT));
  return {
    year1,
    year2,
    year3,
    threeYearTotal: round2(year1 + year2 + year3)
  };
}

/**
 * Add-ons over the base package (Quoting Tool D26:G48): languages, surveys, revisions,
 * integrations, brands, and additional Performance/Agile/Consultative units. Each is a flat
 * annual $ divided across locations/12 -> $/loc/mo.
 */
export function computeAddOns(quantities, locations) {
  const safeLocations = Math.max(1, Number(locations) || 1);
  const qty = {
    additionalLanguages: 0,
    additionalSurveys: 0,
    additionalSurveyRevisions: 0,
    additionalIntegrations: 0,
    additionalBrands: 0,
    additionalPerformance: 0,
    additionalAgile: 0,
    additionalConsultative: 0,
    ...quantities
  };

  const perLocPerMonth = (annualTotal) =>
    round2(annualTotal / safeLocations / 12);

  const lines = [
    {
      key: "additionalLanguageSurveys",
      label: "Add'l Language Surveys",
      quantity: qty.additionalLanguages,
      annualTotal:
        qty.additionalLanguages * ADD_ON_RATES.additionalLanguageSurveys
    },
    {
      key: "additionalLanguageReports",
      label: "Add'l Language Reports",
      quantity: qty.additionalLanguages,
      annualTotal:
        qty.additionalLanguages * ADD_ON_RATES.additionalLanguageReports
    },
    {
      key: "additionalSurveys",
      label: "Add'l Surveys",
      quantity: qty.additionalSurveys,
      annualTotal: qty.additionalSurveys * ADD_ON_RATES.additionalSurveys
    },
    {
      key: "additionalSurveyRevisions",
      label: "Add'l Survey Revisions",
      quantity: qty.additionalSurveyRevisions,
      annualTotal:
        qty.additionalSurveyRevisions * ADD_ON_RATES.additionalSurveyRevisions
    },
    {
      key: "additionalIntegrations",
      label: "Add'l Integrations",
      quantity: qty.additionalIntegrations,
      annualTotal:
        qty.additionalIntegrations * ADD_ON_RATES.additionalIntegrations
    },
    {
      key: "additionalBrands",
      label: "Add'l Brands",
      quantity: qty.additionalBrands,
      annualTotal: qty.additionalBrands * ADD_ON_RATES.additionalBrands
    },
    {
      key: "additionalPerformance",
      label: "Add'l Performance",
      quantity: qty.additionalPerformance,
      annualTotal: qty.additionalPerformance * ADD_ON_RATES.additionalPerformance
    },
    {
      key: "additionalAgile",
      label: "Add'l Agile",
      quantity: qty.additionalAgile,
      annualTotal: qty.additionalAgile * ADD_ON_RATES.additionalAgile
    },
    {
      key: "additionalConsultative",
      label: "Add'l Consultative",
      quantity: qty.additionalConsultative,
      annualTotal: qty.additionalConsultative * ADD_ON_RATES.additionalConsultative
    }
  ].map((line) => ({
    ...line,
    perLocPerMonth: perLocPerMonth(line.annualTotal)
  }));

  const annualTotal = round2(lines.reduce((sum, l) => sum + l.annualTotal, 0));
  const perLocPerMonthTotal = round2(
    lines.reduce((sum, l) => sum + l.perLocPerMonth, 0)
  );

  return { lines, annualTotal, perLocPerMonth: perLocPerMonthTotal };
}

function agentPricePerAgent(agentCount) {
  const tier = CALL_CENTER.agentPriceTiers.find(
    (t) => agentCount >= t.min && agentCount <= t.max
  );
  return tier ? tier.pricePerAgent : 0;
}

/**
 * Replicates Call Center WM's Web / IVR / Web+IVR annual cost stack for the AgentTrack
 * add-on. Per user direction, the $/loc/mo conversion divides the (already agent-count-
 * aware) annual total by locations/12 with no further multiplication by agent count -
 * the sheet's G44/G45 do multiply again (double-counting agents); G46 does not, and G46's
 * pattern is used here for all three variants.
 */
export function computeCallCenter(variant, agentCount, locations) {
  if (variant === "none") {
    return { variant: "none", annualTotal: 0, perLocPerMonth: 0 };
  }
  const safeLocations = Math.max(1, Number(locations) || 1);
  const agents = Math.max(0, Number(agentCount) || 0);
  const pricePerAgent = agentPricePerAgent(agents);

  const basePlatform = CALL_CENTER.basePlatformPrice;
  const coachingAlert =
    CALL_CENTER.coachingAlertPrice * CALL_CENTER.coachingAlertQty;
  const agentTotal = pricePerAgent * agents;
  const webIvrSurveyIncrease =
    variant === "webIvr" ? CALL_CENTER.webIvrSurveyBaseIncrease : 0;

  const annualEmailVolume = agents * 60 * 21 * 12;
  const ivrResponsesPerYear = agents * 30 * 12;
  const ivrIncompleteMinutesTotal =
    ivrResponsesPerYear * CALL_CENTER.ivrIncompleteMinutes;
  const ivrCompleteMinutesTotal =
    ivrResponsesPerYear * CALL_CENTER.ivrCompleteMinutes;
  const voiceToTextVolume =
    ivrResponsesPerYear * CALL_CENTER.ivrVoiceToTextCommentRate;
  const emailInvitesMillions = (annualEmailVolume * 1.25) / 1000000;

  const ivrIncompleteCost =
    CALL_CENTER.ivrPricePerMinute * ivrIncompleteMinutesTotal;
  const ivrCompleteCost =
    CALL_CENTER.ivrPricePerMinute * ivrCompleteMinutesTotal;
  const voiceToTextCost = CALL_CENTER.ivrVoiceToTextPrice * voiceToTextVolume;
  const emailCost =
    CALL_CENTER.emailInvitePricePerMillion * emailInvitesMillions;

  const platform =
    agentTotal * 0.7 + basePlatform + webIvrSurveyIncrease + coachingAlert;
  const service = agentTotal * 0.3; // service/insight hours add-on defaults to 0 hours purchased

  let ivrEmailCost;
  if (variant === "web") {
    ivrEmailCost = emailCost;
  } else if (variant === "ivr") {
    ivrEmailCost = ivrIncompleteCost + ivrCompleteCost + voiceToTextCost;
  } else {
    ivrEmailCost =
      ivrIncompleteCost * CALL_CENTER.webIvrIvrDiscount +
      ivrCompleteCost * CALL_CENTER.webIvrIvrDiscount +
      voiceToTextCost +
      emailCost * CALL_CENTER.webIvrEmailDiscount;
  }

  const annualTotal = Math.round(platform + service + ivrEmailCost);
  const perLocPerMonth = round2(annualTotal / safeLocations / 12);

  return { variant, agents, pricePerAgent, annualTotal, perLocPerMonth };
}

/** Ratings & Reviews sheet rows 7-12: reputation product tiered by location count. */
export function computeRatingsReviews(tierKey, locations) {
  const safeLocations = Math.max(1, Number(locations) || 1);
  const bracket =
    RATINGS_REVIEWS_TIERS.find(
      (b) => safeLocations >= b.min && safeLocations <= b.max
    ) || RATINGS_REVIEWS_TIERS[RATINGS_REVIEWS_TIERS.length - 1];
  const ratePerMonth = bracket[tierKey];
  const monthly = round2(ratePerMonth * safeLocations);
  const annual = round2(monthly * 12);
  return { tierKey, bracket: bracket.label, ratePerMonth, monthly, annual };
}

// Ignite EX rate card, transcribed from the "Ignite EX pricing" sheet (2025, SMG confidential).
// The two location-banded columns are the "Long Form Annual Survey" engagement tiers; every
// other item is a flat, location-independent professional-services fee. 10,000+ locations has
// no published rate ("Custom, see Tara") - flagged via isCustom the same way the base package's
// 5,000+ band is.
export const IGNITE_EX_LOCATION_BANDS = [
  { min: 200, max: 300, label: "200 - 300", engagementOneConsultative: 75000, engagementTwoConsultative: 120000 },
  { min: 301, max: 400, label: "301 - 400", engagementOneConsultative: 95000, engagementTwoConsultative: 140000 },
  { min: 401, max: 500, label: "401 - 500", engagementOneConsultative: 110000, engagementTwoConsultative: 155000 },
  { min: 501, max: 1000, label: "501 - 1,000", engagementOneConsultative: 135000, engagementTwoConsultative: 180000 },
  { min: 1001, max: 1500, label: "1,001 - 1,500", engagementOneConsultative: 145000, engagementTwoConsultative: 190000 },
  { min: 1501, max: 2000, label: "1,501 - 2,000", engagementOneConsultative: 160000, engagementTwoConsultative: 205000 },
  { min: 2001, max: 2500, label: "2,001 - 2,500", engagementOneConsultative: 180000, engagementTwoConsultative: 225000 },
  { min: 2501, max: 3000, label: "2,501 - 3,000", engagementOneConsultative: 200000, engagementTwoConsultative: 245000 },
  { min: 3001, max: 4000, label: "3,001 - 4,000", engagementOneConsultative: 225000, engagementTwoConsultative: 270000 },
  { min: 4001, max: 5000, label: "4,001 - 5,000", engagementOneConsultative: 240000, engagementTwoConsultative: 285000 },
  { min: 5001, max: 7500, label: "5,001 - 7,500", engagementOneConsultative: 260000, engagementTwoConsultative: 305000 },
  { min: 7501, max: 10000, label: "7,500 - 10,000", engagementOneConsultative: 275000, engagementTwoConsultative: 320000 },
  {
    min: 10001,
    max: Infinity,
    label: "10,000+ (custom)",
    isCustom: true,
    engagementOneConsultative: null,
    engagementTwoConsultative: null
  }
];

// Flat (non-banded) Ignite EX items. pulseAgileAnalysisFee is inferred as half of
// agileAnalysesPairFee ("2 Agile Analyses" = $10,000) - the sheet gives Pulse's cost as
// "$20,000 + agile analysis" without stating that fee on its own; confirm before relying on it.
export const IGNITE_EX_FLAT_ITEMS = {
  pulseBaseFee: 20000,
  pulseAgileAnalysisFee: 5000,
  onboardSetupFee: 10000,
  onboardAnnualFee: 5000,
  staggeredOnboardFee: 40000,
  exitSetupFee: 10000,
  exitAnnualFee: 5000,
  alwaysOnSetupFee: 10000,
  alwaysOnAnnualFee: 5000,
  agileAnalysesPairFee: 10000,
  performanceInsightFee: 8000,
  consultativeFee: 28000
};

export const IGNITE_EX_ITEM_KEYS = [
  "engagementOneConsultative",
  "engagementTwoConsultative",
  "pulse",
  "onboard",
  "staggeredOnboard",
  "exit",
  "alwaysOn",
  "agileAnalysesPair",
  "performanceInsight",
  "consultative"
];

export const IGNITE_EX_ITEM_LABELS = {
  engagementOneConsultative: "Long Form Annual Survey (1 Engagement + 1 Consultative)",
  engagementTwoConsultative: "Long Form Annual Survey (2 Engagement + 2 Consultative)",
  pulse: "Pulse",
  onboard: "Onboard",
  staggeredOnboard: "Staggered Onboard (4 points)",
  exit: "Exit",
  alwaysOn: "Always-On",
  agileAnalysesPair: "2 Agile Analyses",
  performanceInsight: "Performance Insight",
  consultative: "Consultative"
};

function findIgniteExLocationBand(locations) {
  const safeLocations = Math.max(1, Number(locations) || 1);
  return (
    IGNITE_EX_LOCATION_BANDS.find(
      (band) => safeLocations >= band.min && safeLocations <= band.max
    ) || IGNITE_EX_LOCATION_BANDS[IGNITE_EX_LOCATION_BANDS.length - 1]
  );
}

/**
 * Prices every Ignite EX item the rep has selected. Location-banded items (the Long Form
 * Annual Survey engagement tiers) are recurring/annual; everything else is a one-time
 * professional-services fee, except Onboard/Exit/Always-On which each split into a one-time
 * setup line and a recurring annual line, per the source rate card.
 */
export function computeIgniteEx({ selectedItems, locations, pulseQuantity }) {
  const selected = new Set(selectedItems || []);
  const band = findIgniteExLocationBand(locations);
  const pulses = Math.max(0, Number(pulseQuantity) || 0);
  const lines = [];

  if (selected.has("engagementOneConsultative")) {
    lines.push({
      key: "engagementOneConsultative",
      label: IGNITE_EX_ITEM_LABELS.engagementOneConsultative,
      quantity: 1,
      unitPrice: band.engagementOneConsultative || 0,
      isOneTime: false,
      isCustomPricing: Boolean(band.isCustom)
    });
  }
  if (selected.has("engagementTwoConsultative")) {
    lines.push({
      key: "engagementTwoConsultative",
      label: IGNITE_EX_ITEM_LABELS.engagementTwoConsultative,
      quantity: 1,
      unitPrice: band.engagementTwoConsultative || 0,
      isOneTime: false,
      isCustomPricing: Boolean(band.isCustom)
    });
  }
  if (selected.has("pulse") && pulses > 0) {
    lines.push({
      key: "pulse",
      label: IGNITE_EX_ITEM_LABELS.pulse,
      quantity: pulses,
      unitPrice:
        IGNITE_EX_FLAT_ITEMS.pulseBaseFee +
        IGNITE_EX_FLAT_ITEMS.pulseAgileAnalysisFee,
      isOneTime: true,
      isCustomPricing: false
    });
  }
  if (selected.has("onboard")) {
    lines.push(
      {
        key: "onboardSetup",
        label: `${IGNITE_EX_ITEM_LABELS.onboard} — Setup Fee`,
        quantity: 1,
        unitPrice: IGNITE_EX_FLAT_ITEMS.onboardSetupFee,
        isOneTime: true,
        isCustomPricing: false
      },
      {
        key: "onboardAnnual",
        label: `${IGNITE_EX_ITEM_LABELS.onboard} — Annual Fee`,
        quantity: 1,
        unitPrice: IGNITE_EX_FLAT_ITEMS.onboardAnnualFee,
        isOneTime: false,
        isCustomPricing: false
      }
    );
  }
  if (selected.has("staggeredOnboard")) {
    lines.push({
      key: "staggeredOnboard",
      label: IGNITE_EX_ITEM_LABELS.staggeredOnboard,
      quantity: 1,
      unitPrice: IGNITE_EX_FLAT_ITEMS.staggeredOnboardFee,
      isOneTime: true,
      isCustomPricing: false
    });
  }
  if (selected.has("exit")) {
    lines.push(
      {
        key: "exitSetup",
        label: `${IGNITE_EX_ITEM_LABELS.exit} — Setup Fee`,
        quantity: 1,
        unitPrice: IGNITE_EX_FLAT_ITEMS.exitSetupFee,
        isOneTime: true,
        isCustomPricing: false
      },
      {
        key: "exitAnnual",
        label: `${IGNITE_EX_ITEM_LABELS.exit} — Annual Fee`,
        quantity: 1,
        unitPrice: IGNITE_EX_FLAT_ITEMS.exitAnnualFee,
        isOneTime: false,
        isCustomPricing: false
      }
    );
  }
  if (selected.has("alwaysOn")) {
    lines.push(
      {
        key: "alwaysOnSetup",
        label: `${IGNITE_EX_ITEM_LABELS.alwaysOn} — Setup Fee`,
        quantity: 1,
        unitPrice: IGNITE_EX_FLAT_ITEMS.alwaysOnSetupFee,
        isOneTime: true,
        isCustomPricing: false
      },
      {
        key: "alwaysOnAnnual",
        label: `${IGNITE_EX_ITEM_LABELS.alwaysOn} — Annual Fee`,
        quantity: 1,
        unitPrice: IGNITE_EX_FLAT_ITEMS.alwaysOnAnnualFee,
        isOneTime: false,
        isCustomPricing: false
      }
    );
  }
  if (selected.has("agileAnalysesPair")) {
    lines.push({
      key: "agileAnalysesPair",
      label: IGNITE_EX_ITEM_LABELS.agileAnalysesPair,
      quantity: 1,
      unitPrice: IGNITE_EX_FLAT_ITEMS.agileAnalysesPairFee,
      isOneTime: true,
      isCustomPricing: false
    });
  }
  if (selected.has("performanceInsight")) {
    lines.push({
      key: "performanceInsight",
      label: IGNITE_EX_ITEM_LABELS.performanceInsight,
      quantity: 1,
      unitPrice: IGNITE_EX_FLAT_ITEMS.performanceInsightFee,
      isOneTime: true,
      isCustomPricing: false
    });
  }
  if (selected.has("consultative")) {
    lines.push({
      key: "consultative",
      label: IGNITE_EX_ITEM_LABELS.consultative,
      quantity: 1,
      unitPrice: IGNITE_EX_FLAT_ITEMS.consultativeFee,
      isOneTime: true,
      isCustomPricing: false
    });
  }

  const withTotals = lines.map((line) => ({
    ...line,
    annualTotal: line.quantity * line.unitPrice
  }));

  const annualTotal = round2(
    withTotals.filter((l) => !l.isOneTime).reduce((sum, l) => sum + l.annualTotal, 0)
  );
  const oneTimeTotal = round2(
    withTotals.filter((l) => l.isOneTime).reduce((sum, l) => sum + l.annualTotal, 0)
  );
  const isCustomPricing = withTotals.some((l) => l.isCustomPricing);

  return { lines: withTotals, annualTotal, oneTimeTotal, isCustomPricing };
}
