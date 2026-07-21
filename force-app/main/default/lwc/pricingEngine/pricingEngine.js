/**
 * Pure pricing calculations for the SMG New Logo Pricing Model (July 2026).
 * Transcribed from "New Logo Pricing Analysis & Rate Card.xlsx" and
 * "New Logo Pricing Strategy Memo.docx" (14 executed new-logo order forms, 2018-2026).
 *
 * Replaces the prior "Developing a pricing tool - July 2026.xlsx" model: there is no more
 * Elite tier and no separate >1,250-location Enterprise branch - one continuous rate card
 * by location band covers every deal size, with a new Solution-Support-Only tier added.
 *
 * No LWC/Apex dependencies here by design - keep this file plain, importable,
 * and unit-testable in isolation.
 */

export const PLANS = [
  "Pro/Advanced",
  "Standard/Advanced",
  "Pro/Foundational",
  "Standard/Foundational",
  "Solution Support Only"
];

export const SOLUTION_SUPPORT_ONLY_PLAN = "Solution Support Only";

// Rate Card sheet, row 4 header - anchor tier is Pro/Advanced; every other package is a
// flat multiplier off the same location-band rate.
export const PLAN_MULTIPLIERS = {
  "Pro/Advanced": 1.0,
  "Standard/Advanced": 0.9,
  "Pro/Foundational": 0.83,
  "Standard/Foundational": 0.75,
  "Solution Support Only": 0.55
};

// Recommended Rate Card sheet, rows 5-12 - Pro/Advanced anchor $/location/month by band.
export const LOCATION_BANDS = [
  { min: 1, max: 75, label: "1 - 75", ratePerLocationPerMonth: 110.0 },
  { min: 76, max: 150, label: "76 - 150", ratePerLocationPerMonth: 80.0 },
  { min: 151, max: 300, label: "151 - 300", ratePerLocationPerMonth: 58.0 },
  { min: 301, max: 600, label: "301 - 600", ratePerLocationPerMonth: 44.0 },
  { min: 601, max: 1200, label: "601 - 1,200", ratePerLocationPerMonth: 34.0 },
  { min: 1201, max: 2500, label: "1,201 - 2,500", ratePerLocationPerMonth: 27.0 },
  { min: 2501, max: 5000, label: "2,501 - 5,000", ratePerLocationPerMonth: 22.0 },
  {
    min: 5001,
    max: Infinity,
    label: "5,000+ (custom)",
    ratePerLocationPerMonth: 18.0,
    isCustom: true
  }
];

// Rate Card sheet, row 16 - annual minimum floors by service type.
export const ANNUAL_MINIMUM_FLOOR = {
  fullService: 80000,
  supportOnly: 36000
};

// Rate Card sheet, row 17 - replaces the observed $0-$40,000 setup fee inconsistency.
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
  additionalBrands: 6000
};

// Rate Card sheet, row 23 - Case management build, one-time.
export const CASE_MANAGEMENT_FEE = 7500;

// Ignite CX (formerly "Location Survey") is a distinct SMG product/price-book line item,
// not part of the New Logo memo - rate carried over unchanged from the prior model. Only
// billed as its own line on a standalone (no base subscription) quote - when a base
// subscription is also being quoted, Ignite CX's location cost is already folded into the
// base package price, so the LWC skips adding a separate line item for it.
export const IGNITE_CX_RATE_PER_LOCATION_PER_MONTH = 17;

// Ignite Digital has no per-location or per-market rate card yet - quoted as a flat annual fee.
export const IGNITE_DIGITAL_FLAT_FEE = 40000;

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

/**
 * Computes the base package quote for a given plan, location count, and term length.
 * One continuous rate card covers every deal size (Recommended Rate Card sheet) - locations
 * above 5,000 use the top ("custom") band rate but are flagged via isCustomPricing so the
 * UI can prompt for deal-desk review rather than silently auto-quoting.
 */
export function computeBaseQuote(plan, locations, termMonths) {
  if (!PLANS.includes(plan)) {
    throw new Error(`Unknown plan: ${plan}`);
  }
  const safeLocations = Math.max(1, Number(locations) || 1);
  const band = findLocationBand(safeLocations);
  const multiplier = PLAN_MULTIPLIERS[plan];
  const termPremium = getTermPremium(termMonths);

  const listRatePerLocationPerMonth = round2(
    band.ratePerLocationPerMonth * multiplier * (1 + termPremium)
  );
  const rawAnnual = round2(listRatePerLocationPerMonth * safeLocations * 12);
  const annualFloor =
    plan === SOLUTION_SUPPORT_ONLY_PLAN
      ? ANNUAL_MINIMUM_FLOOR.supportOnly
      : ANNUAL_MINIMUM_FLOOR.fullService;
  const totalAnnual = Math.max(rawAnnual, annualFloor);
  const pricePerLocationPerMonth = round2(totalAnnual / safeLocations / 12);

  return {
    plan,
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
 * integrations, and brands. Each is a flat annual $ divided across locations/12 -> $/loc/mo.
 */
export function computeAddOns(quantities, locations) {
  const safeLocations = Math.max(1, Number(locations) || 1);
  const qty = {
    additionalLanguages: 0,
    additionalSurveys: 0,
    additionalSurveyRevisions: 0,
    additionalIntegrations: 0,
    additionalBrands: 0,
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
