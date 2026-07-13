/**
 * Pure pricing calculations for the SMG Mid-Market Pricing Model (July 2026).
 * Transcribed from "Developing a pricing tool - July 2026.xlsx":
 *   - Quoting Tool / Working Model  -> base plan pricing, volume tiers, GM%
 *   - Ratings & Reviews             -> reputation product tiers
 *   - Call Center WM                -> AgentTrack add-on
 *   - ALTERNATIVE - LARGE PROSPECT  -> enterprise (>1,250 locations) pricing
 *
 * No LWC/Apex dependencies here by design - keep this file plain, importable,
 * and unit-testable in isolation.
 */

export const PLAN_TRACKS = ["Standard", "Professional"];
export const PLAN_TIERS = ["Foundational", "Advanced", "Elite"];

export const PLANS = [
  "Standard Foundational",
  "Standard Advanced",
  "Standard Elite",
  "Professional Foundational",
  "Professional Advanced",
  "Professional Elite"
];

// Working Model D10/E10/F10 - annual contract value at the 100-location entry point.
const STANDARD_BASE_ACV = {
  Foundational: 60000,
  Advanced: 130000,
  Elite: 340000
};

// Working Model I12/J12/K12 - Professional track carries a flat 35% premium over Standard.
export const STANDARD_TO_PROFESSIONAL_PREMIUM = 0.35;

export const BASE_ACV = {};
PLAN_TIERS.forEach((tier) => {
  BASE_ACV[`Standard ${tier}`] = STANDARD_BASE_ACV[tier];
  BASE_ACV[`Professional ${tier}`] =
    Math.round(
      STANDARD_BASE_ACV[tier] * (1 + STANDARD_TO_PROFESSIONAL_PREMIUM) * 100
    ) / 100;
});

// Working Model E12/F12 - Advanced/Elite premiums over Foundational, applied to
// discounted volume-tier pricing only (the entry tier uses each plan's own ACV directly).
export const ADVANCED_PREMIUM_OVER_FOUNDATIONAL = 0.3;
export const ELITE_PREMIUM_OVER_FOUNDATIONAL = 0.55;

// Working Model H15 - every plan's entry tier covers the first 100 locations, billed as a
// minimum commitment: the tier's 100 locations are always charged even if fewer are entered.
export const ENTRY_POINT_LOCATIONS = 100;

// Working Model C16:C20 / G16:H20 - volume discount tiers beyond the entry point.
// Each tier's monthly rate = (Foundational track entry price) * (1 - discount), then
// Advanced/Elite = that discounted Foundational rate * (1 + their premium over Foundational).
export const VOLUME_DISCOUNT_TIERS = [
  {
    min: 0,
    max: ENTRY_POINT_LOCATIONS,
    discount: 0,
    label: `1-${ENTRY_POINT_LOCATIONS}`
  },
  { min: 101, max: 250, discount: 0.05, label: "101-250" },
  { min: 251, max: 500, discount: 0.075, label: "251-500" },
  { min: 501, max: 750, discount: 0.15, label: "501-750" },
  { min: 751, max: 1000, discount: 0.25, label: "751-1,000" },
  { min: 1001, max: 1250, discount: 0.4, label: "1,001-1,250" }
];

export const ENTERPRISE_LOCATION_THRESHOLD = 1250;

// Working Model O19:T20 / Q20 - est. delivery hours and hourly labor rate by plan tier,
// plus a flat 5.5% COGS overhead on ACV. Used to estimate GM% for the seller's own reference.
const EST_HOURS_BY_TIER = { Foundational: 170, Advanced: 546, Elite: 1457 };
const LABOR_HOURLY_RATE = 83008 / (2080 * 0.5);
const COGS_OVERHEAD_PERCENT = 0.055;

// Quoting Tool D26:G41 - flat unit rates for add-ons over the base package.
export const ADD_ON_RATES = {
  additionalLanguageSurveys: 2500, // per additional language, survey translation
  additionalLanguageReports: 7500, // per additional language, report translation
  additionalSurveys: 12500,
  additionalSurveyRevisions: 1500,
  additionalIntegrations: 10000,
  additionalBrands: 15000
};

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

// ALTERNATIVE - LARGE PROSPECT sheet: enterprise (>1,250 locations) pricing.
export const ENTERPRISE = {
  locationSurveyPricePerMonth: 17,
  websiteSurveyFlatAnnual: 30000, // sheet's own static "DO COMPLEXITY" placeholder
  advancedPremiumOverFoundational: 0.25,
  elitePremiumOverAdvanced: 0.3
};

// Quoting Tool T51-T56 - manual discount guidance notes, since list prices are set high
// relative to market and reps are expected to apply a location-based discount band.
export function getDiscountGuidance(locations) {
  if (locations <= 100) {
    return "Common discounts at the small end of the market, up to 100 locations: 20-25% off list price.";
  } else if (locations <= 400) {
    return "100-400 locations: discounts required are typically 20-30% off list price.";
  } else if (locations <= 800) {
    return "400-800 locations: discounts required are typically 25-35% off list price.";
  }
  return "800-1,200+ locations: discounts required are typically 30-40% off list price.";
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function planTier(plan) {
  return PLAN_TIERS.find((tier) => plan.endsWith(tier));
}

function planTrack(plan) {
  return PLAN_TRACKS.find((track) => plan.startsWith(track));
}

/**
 * Monthly $/location rate for every one of the 6 volume buckets, for the given plan.
 * Bucket 0 (entry, 1-100 locations) uses the plan's own ACV directly.
 * Buckets 1-5 discount the *Foundational* track's entry price, then Advanced/Elite
 * apply their premium on top of that discounted Foundational rate.
 */
function buildRateTable(plan) {
  const track = planTrack(plan);
  const tier = planTier(plan);
  const foundationalEntryRate = round2(
    BASE_ACV[`${track} Foundational`] / ENTRY_POINT_LOCATIONS / 12
  );
  const entryRate = round2(BASE_ACV[plan] / ENTRY_POINT_LOCATIONS / 12);
  const premium =
    tier === "Advanced"
      ? ADVANCED_PREMIUM_OVER_FOUNDATIONAL
      : tier === "Elite"
        ? ELITE_PREMIUM_OVER_FOUNDATIONAL
        : 0;

  return VOLUME_DISCOUNT_TIERS.map((bucket, index) => {
    if (index === 0) {
      return { ...bucket, ratePerMonth: entryRate };
    }
    const discountedFoundational = round2(
      foundationalEntryRate * (1 - bucket.discount)
    );
    const rate =
      tier === "Foundational"
        ? discountedFoundational
        : round2(discountedFoundational * (1 + premium));
    return { ...bucket, ratePerMonth: rate };
  });
}

/**
 * Allocates a total location count across the 6 volume buckets, matching the sheet's
 * P7:P12 formulas. The entry bucket always allocates its full 100 locations (a minimum
 * billing commitment) regardless of the actual location count entered.
 */
function allocateLocations(locations) {
  const capped = Math.min(locations, ENTERPRISE_LOCATION_THRESHOLD);
  const allocations = [ENTRY_POINT_LOCATIONS];
  let previousMax = ENTRY_POINT_LOCATIONS;
  for (let i = 1; i < VOLUME_DISCOUNT_TIERS.length; i += 1) {
    const bucketMax = VOLUME_DISCOUNT_TIERS[i].max;
    const alloc = Math.max(0, Math.min(capped, bucketMax) - previousMax);
    allocations.push(alloc);
    previousMax = bucketMax;
  }
  return allocations;
}

function estimatedGmPercent(plan, cumulativeAnnualRevenue) {
  const tier = planTier(plan);
  const laborCostTotal = Math.round(
    LABOR_HOURLY_RATE * EST_HOURS_BY_TIER[tier]
  );
  const cogsOverhead = COGS_OVERHEAD_PERCENT * BASE_ACV[plan];
  const totalCogs = laborCostTotal + cogsOverhead;
  if (cumulativeAnnualRevenue <= 0) {
    return null;
  }
  return (cumulativeAnnualRevenue - totalCogs) / cumulativeAnnualRevenue;
}

/**
 * Computes the base package quote for a given plan and location count (Quoting Tool sheet).
 * Returns { isEnterprise: true } above the 1,250-location threshold - callers should route
 * to computeEnterpriseQuote() instead.
 */
export function computeBaseQuote(plan, locations) {
  if (!PLANS.includes(plan)) {
    throw new Error(`Unknown plan: ${plan}`);
  }
  const safeLocations = Math.max(0, Number(locations) || 0);
  if (safeLocations > ENTERPRISE_LOCATION_THRESHOLD) {
    return { isEnterprise: true };
  }

  const rateTable = buildRateTable(plan);
  const allocations = allocateLocations(safeLocations);

  let cumulativeAnnual = 0;
  const buckets = rateTable.map((bucket, index) => {
    const locationsInBucket = allocations[index];
    const monthly = round2(locationsInBucket * bucket.ratePerMonth);
    const annual = round2(monthly * 12);
    cumulativeAnnual = round2(cumulativeAnnual + annual);
    return {
      label: bucket.label,
      ratePerMonth: bucket.ratePerMonth,
      locationsInBucket,
      monthly,
      annual,
      cumulativeAnnual,
      gmPercent:
        locationsInBucket > 0
          ? estimatedGmPercent(plan, cumulativeAnnual)
          : null
    };
  });

  const totalLocationsBilled = allocations.reduce((sum, n) => sum + n, 0);
  const totalMonthly = round2(buckets.reduce((sum, b) => sum + b.monthly, 0));
  const totalAnnual = round2(totalMonthly * 12);
  const pricePerLocationPerMonth =
    totalLocationsBilled > 0 ? totalMonthly / totalLocationsBilled : 0;
  const gmPercent =
    [...buckets].reverse().find((b) => b.gmPercent !== null)?.gmPercent ?? null;

  return {
    isEnterprise: false,
    plan,
    buckets,
    totalLocationsBilled,
    totalMonthly,
    totalAnnual,
    pricePerLocationPerMonth,
    gmPercent
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

/**
 * ALTERNATIVE - LARGE PROSPECT sheet: enterprise pricing above 1,250 locations.
 * Reuses the shared add-on and Ratings & Reviews engines rather than the source sheet's
 * static "SEE QUOTING TAB" stubs (0) or its hardcoded single-bracket R&R cell reference -
 * see plan notes for why this is a correction, verified against the sheet's own example.
 */
export function computeEnterpriseQuote(
  locations,
  addOnQuantities,
  ratingsReviewsSelection,
  websiteSurveyNeeded
) {
  const safeLocations = Math.max(1, Number(locations) || 1);

  const locationSurveyAnnual = round2(
    safeLocations * ENTERPRISE.locationSurveyPricePerMonth * 12
  );
  const addOns = computeAddOns(addOnQuantities, safeLocations);
  const ratingsReviews =
    ratingsReviewsSelection && ratingsReviewsSelection.enabled
      ? computeRatingsReviews(ratingsReviewsSelection.tier, safeLocations)
      : null;
  const websiteSurveyAnnual = websiteSurveyNeeded
    ? ENTERPRISE.websiteSurveyFlatAnnual
    : 0;

  const foundationalAnnual = round2(
    locationSurveyAnnual +
      addOns.annualTotal +
      (ratingsReviews ? ratingsReviews.annual : 0) +
      websiteSurveyAnnual
  );
  const advancedAnnual = round2(
    foundationalAnnual * (1 + ENTERPRISE.advancedPremiumOverFoundational)
  );
  const eliteAnnual = round2(
    advancedAnnual * (1 + ENTERPRISE.elitePremiumOverAdvanced)
  );

  const blendedPerLocPerMonth = (annual) => round2(annual / safeLocations / 12);

  return {
    locationSurveyAnnual,
    addOns,
    ratingsReviews,
    websiteSurveyAnnual,
    foundational: {
      annual: foundationalAnnual,
      perLocPerMonth: blendedPerLocPerMonth(foundationalAnnual)
    },
    advanced: {
      annual: advancedAnnual,
      perLocPerMonth: blendedPerLocPerMonth(advancedAnnual)
    },
    elite: {
      annual: eliteAnnual,
      perLocPerMonth: blendedPerLocPerMonth(eliteAnnual)
    }
  };
}
