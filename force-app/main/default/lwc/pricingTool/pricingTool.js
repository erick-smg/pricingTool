import { LightningElement, api, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { RefreshEvent } from "lightning/refresh";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import OPPORTUNITY_TYPE_FIELD from "@salesforce/schema/Opportunity.Type";
import TERM_LENGTH_FIELD from "@salesforce/schema/Opportunity.Term_Length__c";
import DISCOUNT_FIELD from "@salesforce/schema/Opportunity.Discount__c";
import NUMBER_OF_LOCATIONS_FIELD from "@salesforce/schema/Opportunity.Number_of_Locations__c";
import syncLineItems from "@salesforce/apex/PricingToolController.syncLineItems";
import getExistingLineItems from "@salesforce/apex/PricingToolController.getExistingLineItems";
import {
  SERVICE_TIERS,
  TERM_OPTIONS,
  AGENT_COUNT_BANDS,
  RATINGS_REVIEWS_TIER_KEYS,
  RATINGS_REVIEWS_TIER_LABELS,
  MANAGED_LISTING_MANAGEMENT_REFERENCE,
  CASE_MANAGEMENT_FEE,
  COMMUNITY_TIERS,
  COMMUNITY_TIER_SPECS,
  IGNITE_EX_ITEM_KEYS,
  IGNITE_EX_ITEM_LABELS,
  IGNITE_DIGITAL_EXTRA_KEYS,
  IGNITE_DIGITAL_EXTRA_LABELS,
  IGNITE_DIGITAL_MOUSEFLOW_TIERS,
  computeBaseQuote,
  computeSetupFee,
  computeThreeYearProjection,
  computeAddOns,
  computeCallCenter,
  computeRatingsReviews,
  computeCommunityQuote,
  computeIgniteEx,
  computeIgniteDigitalExtras,
  getDiscountGuidance
} from "c/pricingEngine";

// "none" is never exposed in the UI (AgentTrack is a plain checkbox now) but is kept as the
// internal off-value so computeCallCenter's existing variant contract doesn't need to change.
const AGENT_TRACK_LABELS = {
  none: "None",
  web: "Agent Experience"
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Foundational/Advanced reuse the product codes from the former Standard/Foundational and
// Standard/Advanced plans so previously-synced Opportunities on those codes still round-trip.
const BASE_PACKAGE_PRODUCT_CODES = {
  Foundational: "BASE-STD-FOUND",
  Advanced: "BASE-STD-ADV",
  Elite: "BASE-ELITE"
};

// Legacy-only: the dropped Pro/Standard distinction on old synced Opportunities. Never written
// going forward - read-side only, so those records still rehydrate to a sensible tier.
// "Solution Support Only" (SOLUTION-SUPPORT) has no equivalent tier and is left unmapped; it
// simply won't be recognized on read, same graceful-degradation as any other unmapped code.
const LEGACY_BASE_PACKAGE_TIER_BY_PRODUCT_CODE = {
  "BASE-PRO-ADV": "Advanced",
  "BASE-PRO-FOUND": "Foundational"
};

const ADD_ON_PRODUCT_CODES = {
  additionalLanguageSurveys: "ADDON-LANG-SURVEY",
  additionalLanguageReports: "ADDON-LANG-REPORT",
  additionalSurveys: "ADDON-SURVEY",
  additionalSurveyRevisions: "ADDON-SURVEY-REV",
  additionalIntegrations: "ADDON-INTEGRATION",
  additionalBrands: "ADDON-BRAND",
  additionalPerformance: "ADDON-PERFORMANCE",
  additionalAgile: "ADDON-AGILE",
  additionalConsultative: "ADDON-CONSULTATIVE"
};

const AGENT_TRACK_PRODUCT_CODES = {
  web: "AGENTTRACK-WEB",
  ivr: "AGENTTRACK-IVR",
  webIvr: "AGENTTRACK-WEBIVR"
};

const RATINGS_REVIEWS_PRODUCT_CODES = {
  premium: "RR-PREMIUM",
  pro: "RR-PRO",
  basic: "RR-BASIC"
};

// Every Ignite EX line computeIgniteEx can produce, keyed by its `line.key`.
const IGNITE_EX_PRODUCT_CODES = {
  engagementOneConsultative: "EX-ENG1CONSULT",
  engagementTwoConsultative: "EX-ENG2CONSULT",
  pulse: "EX-PULSE",
  onboardSetup: "EX-ONBOARD-SETUP",
  onboardAnnual: "EX-ONBOARD-ANNUAL",
  staggeredOnboard: "EX-ONBOARD-STAGGERED",
  exitSetup: "EX-EXIT-SETUP",
  exitAnnual: "EX-EXIT-ANNUAL",
  alwaysOnSetup: "EX-ALWAYSON-SETUP",
  alwaysOnAnnual: "EX-ALWAYSON-ANNUAL",
  agileAnalysesPair: "EX-AGILE-PAIR",
  performanceInsight: "EX-PERF-INSIGHT",
  consultative: "EX-CONSULTATIVE"
};

// Onboard/Exit/Always-On each produce two lines (setup + annual) for one checkbox-group item -
// maps a synced line's key back to the item key the checkbox-group actually stores.
const IGNITE_EX_ITEM_KEY_BY_LINE_KEY = {
  engagementOneConsultative: "engagementOneConsultative",
  engagementTwoConsultative: "engagementTwoConsultative",
  pulse: "pulse",
  onboardSetup: "onboard",
  onboardAnnual: "onboard",
  staggeredOnboard: "staggeredOnboard",
  exitSetup: "exit",
  exitAnnual: "exit",
  alwaysOnSetup: "alwaysOn",
  alwaysOnAnnual: "alwaysOn",
  agileAnalysesPair: "agileAnalysesPair",
  performanceInsight: "performanceInsight",
  consultative: "consultative"
};

// Reputation Management / Ignite Digital / Add'l Surveys sub-selections have no pricing of
// their own - they're recorded as a plain "; includes X, Y" suffix on the parent line's
// description rather than as separate line items.
const REPUTATION_EXTRA_LABELS = {
  listingsManagement: "Listings Management",
  localPages: "Local pages"
};
const ADDITIONAL_SURVEY_TYPE_LABELS = {
  postship: "Postship",
  closeTheLoop: "Close the Loop",
  callCenterAgentTrack: "Call Center (AgentTrack)"
};

// Ignite Digital's extras ARE priced (unlike Reputation Management's/Add'l Surveys') - each
// selected extra becomes its own line item, same pattern as Ignite EX.
const IGNITE_DIGITAL_EXTRA_PRODUCT_CODES = {
  mouseflowConfig: "IGNITE-DIGITAL-MOUSEFLOW",
  contactUs: "IGNITE-DIGITAL-CONTACTUS"
};

const IGNITE_COMMUNITIES_PRODUCT_CODE = "IGNITE-COMMUNITIES";
const IGNITE_DIGITAL_PRODUCT_CODE = "IGNITE-DIGITAL";
const CASE_MANAGEMENT_PRODUCT_CODE = "CASE-MANAGEMENT";
const SETUP_FEE_PRODUCT_CODE = "SETUP";
const NEW_LOGO_OPPORTUNITY_TYPE = "New Logo";
const MAX_DISCOUNT_PERCENT = 10;

function reverseMap(map) {
  return Object.fromEntries(
    Object.entries(map).map(([key, value]) => [value, key])
  );
}

const REVERSE_BASE_PACKAGE_PRODUCT_CODES = {
  ...reverseMap(BASE_PACKAGE_PRODUCT_CODES),
  ...LEGACY_BASE_PACKAGE_TIER_BY_PRODUCT_CODE
};
const REVERSE_AGENT_TRACK_PRODUCT_CODES = reverseMap(
  AGENT_TRACK_PRODUCT_CODES
);
const REVERSE_RATINGS_REVIEWS_PRODUCT_CODES = reverseMap(
  RATINGS_REVIEWS_PRODUCT_CODES
);
const REVERSE_IGNITE_EX_PRODUCT_CODES = reverseMap(IGNITE_EX_PRODUCT_CODES);
const REVERSE_REPUTATION_EXTRA_LABELS = reverseMap(REPUTATION_EXTRA_LABELS);
const REVERSE_IGNITE_DIGITAL_EXTRA_PRODUCT_CODES = reverseMap(
  IGNITE_DIGITAL_EXTRA_PRODUCT_CODES
);
const REVERSE_ADDITIONAL_SURVEY_TYPE_LABELS = reverseMap(
  ADDITIONAL_SURVEY_TYPE_LABELS
);

// Term_Length__c is a picklist whose values are these exact labels, not the raw month count.
const TERM_MONTHS_BY_LABEL = Object.fromEntries(
  TERM_OPTIONS.map((term) => [term.label, String(term.months)])
);

// Not a plain reverse of ADD_ON_PRODUCT_CODES - the two language product codes both roll up
// to the single additionalLanguages input, there's no separate "surveys" vs. "reports" field.
const ADD_ON_STATE_FIELD_BY_PRODUCT_CODE = {
  "ADDON-LANG-SURVEY": "additionalLanguages",
  "ADDON-LANG-REPORT": "additionalLanguages",
  "ADDON-SURVEY": "additionalSurveys",
  "ADDON-SURVEY-REV": "additionalSurveyRevisions",
  "ADDON-INTEGRATION": "additionalIntegrations",
  "ADDON-BRAND": "additionalBrands",
  "ADDON-PERFORMANCE": "additionalPerformance",
  "ADDON-AGILE": "additionalAgile",
  "ADDON-CONSULTATIVE": "additionalConsultative"
};

function parseLocationsFromDescription(description) {
  const match = /(\d[\d,]*)\s+locations/.exec(description || "");
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function parseAgentBandFromDescription(description) {
  const match = /—\s*([\d]+-[\d]+)\s+agents/.exec(description || "");
  return match ? match[1] : "0-60";
}

function parseMouseflowTierFromDescription(description) {
  const match = /Mouseflow Config \((\w+)\)/.exec(description || "");
  return match && IGNITE_DIGITAL_MOUSEFLOW_TIERS.includes(match[1])
    ? match[1]
    : "Essential";
}

function parseIncludedExtrasFromDescription(description, keyByLabel) {
  const match = /; includes (.+)$/.exec(description || "");
  if (!match) {
    return [];
  }
  return match[1]
    .split(",")
    .map((label) => label.trim())
    .map((label) => keyByLabel[label])
    .filter(Boolean);
}

function appendIncludedExtras(description, selectedKeys, labelsByKey) {
  const labels = (selectedKeys || [])
    .map((key) => labelsByKey[key])
    .filter(Boolean);
  return labels.length > 0
    ? `${description}; includes ${labels.join(", ")}`
    : description;
}

const COMMUNITY_TIER_BY_LABEL = Object.fromEntries(
  COMMUNITY_TIERS.map((tier) => [COMMUNITY_TIER_SPECS[tier].label, tier])
);

function parseCommunityConfigurationFromDescription(description) {
  const match =
    /Ignite Communities — (.+?), (\d+) market\(s\), (\d+)\/market/.exec(
      description || ""
    );
  if (!match) {
    return null;
  }
  const tier = COMMUNITY_TIER_BY_LABEL[match[1]];
  if (!tier) {
    return null;
  }
  return {
    tier,
    markets: Number(match[2]),
    communitySizePerMarket: Number(match[3])
  };
}

export default class PricingTool extends LightningElement {
  @api recordId;

  locations = 0;
  serviceTier = "Foundational";
  termMonths = "36";

  // Ignite Platform is now the fixed, always-included base package - purely a reference list,
  // never selected/deselected by the rep.
  ignitePlatformItems = [
    "Performance Dashboard",
    "Location Survey",
    "Case Management",
    "Knowledge Agent"
  ];

  additionalLanguages = 0;
  additionalSurveys = 0;
  additionalSurveyRevisions = 0;
  additionalIntegrations = 0;
  additionalBrands = 0;
  additionalPerformance = 0;
  additionalAgile = 0;
  additionalConsultative = 0;
  additionalSurveyTypes = [];

  agentTrackEnabled = false;
  agentTrackVariant = "none";
  agentCountBand = "0-60";

  ratingsReviewsEnabled = false;
  ratingsReviewsTier = "pro";
  reputationManagementExtras = [];

  discountPercent = 0;

  igniteExEnabled = false;
  igniteExSelectedItems = [];
  igniteExPulseQuantity = 0;

  igniteCommunitiesEnabled = false;
  igniteDigitalEnabled = false;
  igniteDigitalExtras = [];
  mouseflowTier = "Essential";
  caseManagementEnabled = false;
  setupFeeEnabled = false;
  setupFeeDefaultApplied = false;
  prefillApplied = false;
  opportunityFieldsPrefillApplied = false;

  communityTier = "DIY";
  communityMarkets = 1;
  communitySizePerMarket = COMMUNITY_TIER_SPECS.DIY.includedCommunitySize;
  communityAdditionalAgileProjects = 0;
  communityAdditionalConsultancyProjects = 0;
  communityAdditionalAdminUsers = 0;

  isSyncingProducts = false;

  managedListingManagementReference = MANAGED_LISTING_MANAGEMENT_REFERENCE;

  @wire(getRecord, {
    recordId: "$recordId",
    fields: [
      OPPORTUNITY_TYPE_FIELD,
      TERM_LENGTH_FIELD,
      DISCOUNT_FIELD,
      NUMBER_OF_LOCATIONS_FIELD
    ]
  })
  wiredOpportunity({ data }) {
    if (!data) {
      return;
    }

    if (!this.setupFeeDefaultApplied) {
      this.setupFeeDefaultApplied = true;
      this.setupFeeEnabled =
        getFieldValue(data, OPPORTUNITY_TYPE_FIELD) ===
        NEW_LOGO_OPPORTUNITY_TYPE;
    }

    // Term, modeled discount, and locations aren't reliably recoverable from the synced
    // products themselves (see applyExistingConfiguration, which falls back to parsing
    // locations out of a line item's description for older syncs) - these plain fields are
    // where the last-used values actually live, written by handleAddProductsToOpportunity on
    // every sync, and take priority whenever present.
    if (!this.opportunityFieldsPrefillApplied) {
      const termLabel = getFieldValue(data, TERM_LENGTH_FIELD);
      const discountValue = getFieldValue(data, DISCOUNT_FIELD);
      const locationsValue = getFieldValue(data, NUMBER_OF_LOCATIONS_FIELD);
      if (termLabel || discountValue != null || locationsValue != null) {
        this.opportunityFieldsPrefillApplied = true;
        if (TERM_MONTHS_BY_LABEL[termLabel]) {
          this.termMonths = TERM_MONTHS_BY_LABEL[termLabel];
        }
        if (discountValue != null) {
          this.discountPercent = Math.min(
            Number(discountValue),
            MAX_DISCOUNT_PERCENT
          );
        }
        if (locationsValue != null) {
          this.locations = Number(locationsValue);
        }
      }
    }
  }

  // Pre-fills the Quote Builder from this Opportunity's existing SMG Price Book products, if
  // any, so a rep revisiting an Opportunity starts from its current configuration instead of a
  // blank quote. Guarded by prefillApplied so a later refresh (e.g. after this component's own
  // "Add Products" sync) doesn't clobber whatever the rep has since changed.
  @wire(getExistingLineItems, { opportunityId: "$recordId" })
  wiredExistingLineItems({ data }) {
    if (data && !this.prefillApplied) {
      this.prefillApplied = true;
      this.applyExistingConfiguration(data);
    }
  }

  get serviceTierOptions() {
    return SERVICE_TIERS.map((tier) => ({ label: tier, value: tier }));
  }

  get termOptions() {
    return TERM_OPTIONS.map((term) => ({
      label: term.label,
      value: String(term.months)
    }));
  }

  // Term_Length__c stores the picklist label text, not the raw month count.
  get termLengthLabel() {
    const term = TERM_OPTIONS.find(
      (option) => String(option.months) === this.termMonths
    );
    return term ? term.label : "";
  }

  get communityTierOptions() {
    return COMMUNITY_TIERS.map((tier) => ({
      label: COMMUNITY_TIER_SPECS[tier].label,
      value: tier
    }));
  }

  get agentCountBandOptions() {
    return AGENT_COUNT_BANDS.map((band) => ({
      label: band.label,
      value: band.key
    }));
  }

  get agentCountRepresentative() {
    const band = AGENT_COUNT_BANDS.find((b) => b.key === this.agentCountBand);
    return band ? band.representativeCount : 0;
  }

  get ratingsReviewsTierOptions() {
    return RATINGS_REVIEWS_TIER_KEYS.map((key) => ({
      label: RATINGS_REVIEWS_TIER_LABELS[key],
      value: key
    }));
  }

  get reputationManagementExtraOptions() {
    return [
      { label: "Listings Management", value: "listingsManagement" },
      { label: "Local pages", value: "localPages" }
    ];
  }

  get igniteDigitalExtraOptions() {
    return IGNITE_DIGITAL_EXTRA_KEYS.map((key) => ({
      label: IGNITE_DIGITAL_EXTRA_LABELS[key],
      value: key
    }));
  }

  get igniteDigitalExtrasResult() {
    return computeIgniteDigitalExtras(this.igniteDigitalExtras, this.mouseflowTier);
  }

  get mouseflowTierOptions() {
    return IGNITE_DIGITAL_MOUSEFLOW_TIERS.map((tier) => ({
      label: tier,
      value: tier
    }));
  }

  get mouseflowConfigSelected() {
    return this.igniteDigitalExtras.includes("mouseflowConfig");
  }

  get additionalSurveyTypeOptions() {
    return [
      { label: "Postship", value: "postship" },
      { label: "Close the Loop", value: "closeTheLoop" },
      { label: "Call Center (AgentTrack)", value: "callCenterAgentTrack" }
    ];
  }

  get igniteExItemOptions() {
    return IGNITE_EX_ITEM_KEYS.map((key) => ({
      label: IGNITE_EX_ITEM_LABELS[key],
      value: key
    }));
  }

  get igniteExPulseSelected() {
    return this.igniteExSelectedItems.includes("pulse");
  }

  get igniteExResult() {
    return computeIgniteEx({
      selectedItems: this.igniteExSelectedItems,
      locations: this.locations,
      pulseQuantity: this.igniteExPulseQuantity
    });
  }

  get communityTierSpec() {
    return COMMUNITY_TIER_SPECS[this.communityTier];
  }

  get communityQuote() {
    return computeCommunityQuote({
      tier: this.communityTier,
      numberOfMarkets: this.communityMarkets,
      communitySizePerMarket: this.communitySizePerMarket,
      additionalAgileProjects: this.communityAdditionalAgileProjects,
      additionalConsultancyProjects: this.communityAdditionalConsultancyProjects,
      additionalAdminUsers: this.communityAdditionalAdminUsers
    });
  }

  get communityTierDiscountPercentDisplay() {
    return round2(this.communityTierSpec.tierDiscountPercent * 100);
  }

  get communityAgileDisabled() {
    return !this.communityTierSpec.agileProjectRate;
  }

  get communityConsultancyDisabled() {
    return !this.communityTierSpec.consultancyProjectRate;
  }

  get communityAdminOverageDisabled() {
    return !Number.isFinite(this.communityTierSpec.includedAdminUsers);
  }

  // The Ignite Platform base package is always part of every quote now, so Locations is
  // always required - the setup fee formula still degrades gracefully to a flat $5,000 base
  // at zero locations, but the base package itself needs a real count.
  get locationsMissing() {
    return !(Number(this.locations) > 0);
  }

  get locationsRequiredMessage() {
    return this.locationsMissing
      ? "Locations is required for the Ignite Platform base package."
      : "";
  }

  get baseQuote() {
    return computeBaseQuote(this.serviceTier, this.locations, this.termMonths);
  }

  get addOnsResult() {
    return computeAddOns(
      {
        additionalLanguages: this.additionalLanguages,
        additionalSurveys: this.additionalSurveys,
        additionalSurveyRevisions: this.additionalSurveyRevisions,
        additionalIntegrations: this.additionalIntegrations,
        additionalBrands: this.additionalBrands,
        additionalPerformance: this.additionalPerformance,
        additionalAgile: this.additionalAgile,
        additionalConsultative: this.additionalConsultative
      },
      this.locations
    );
  }

  get callCenterResult() {
    if (!this.agentTrackEnabled) {
      return { variant: "none", annualTotal: 0, perLocPerMonth: 0 };
    }
    return computeCallCenter(
      this.agentTrackVariant,
      this.agentCountRepresentative,
      this.locations
    );
  }

  get ratingsReviewsResult() {
    if (!this.ratingsReviewsEnabled) {
      return null;
    }
    return computeRatingsReviews(this.ratingsReviewsTier, this.locations);
  }

  get discountGuidance() {
    return getDiscountGuidance();
  }

  get setupFeeAmount() {
    return computeSetupFee(this.locations);
  }

  get caseManagementFee() {
    return CASE_MANAGEMENT_FEE;
  }

  get setupFeeLabel() {
    return `One-Time Setup Fee ($${this.setupFeeAmount.toLocaleString()})`;
  }

  // The full list-price (pre-discount) recurring total across every product in the quote,
  // since the base package is now unconditionally part of every quote.
  get recurringListAnnual() {
    let total = this.baseQuote.totalAnnual + this.addOnsResult.annualTotal;
    if (this.agentTrackEnabled) {
      total += this.callCenterResult.annualTotal;
    }
    if (this.ratingsReviewsEnabled) {
      total += this.ratingsReviewsResult.annual;
    }
    if (this.igniteCommunitiesEnabled) {
      total += this.communityQuote.totalAnnual;
    }
    if (this.igniteDigitalEnabled) {
      total += this.igniteDigitalExtrasResult.annualTotal;
    }
    if (this.igniteExEnabled) {
      total += this.igniteExResult.annualTotal;
    }
    return round2(total);
  }

  get listAnnual() {
    return this.recurringListAnnual;
  }

  get listMonthly() {
    return Math.round(this.listAnnual / 12);
  }

  get listPricePerLocationPerMonth() {
    return this.locations > 0
      ? round2(this.listMonthly / this.locations)
      : 0;
  }

  get hasDiscount() {
    return Number(this.discountPercent) > 0;
  }

  get discountedAnnual() {
    return Math.round(
      this.listAnnual * (1 - Number(this.discountPercent) / 100)
    );
  }

  get discountedMonthly() {
    return Math.round(this.discountedAnnual / 12);
  }

  get discountedPerLocationPerMonth() {
    return this.locations > 0
      ? round2(this.discountedMonthly / this.locations)
      : 0;
  }

  get finalRatePerLocationPerMonth() {
    return this.hasDiscount
      ? this.discountedPerLocationPerMonth
      : this.listPricePerLocationPerMonth;
  }

  // The true "what's being added to this Opportunity" total - every line item that will
  // sync, not just the base subscription. Matches what Opportunity.Amount will roll up to.
  get lineItemsForDisplay() {
    return this.lineItemRequests.map((line) => ({
      ...line,
      key: `${line.productCode}-${line.description}`,
      totalPrice: round2(
        (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
      )
    }));
  }

  get lineItemsGrandTotal() {
    return round2(
      this.lineItemsForDisplay.reduce((sum, line) => sum + line.totalPrice, 0)
    );
  }

  get recurringLineItemsTotal() {
    return round2(
      this.lineItemsForDisplay
        .filter((line) => !line.isOneTime)
        .reduce((sum, line) => sum + line.totalPrice, 0)
    );
  }

  get oneTimeLineItemsTotal() {
    return round2(
      this.lineItemsForDisplay
        .filter((line) => line.isOneTime)
        .reduce((sum, line) => sum + line.totalPrice, 0)
    );
  }

  get threeYearProjection() {
    return computeThreeYearProjection(this.recurringLineItemsTotal);
  }

  get addProductsDisabled() {
    return (
      this.isSyncingProducts ||
      !this.recordId ||
      this.locationsMissing ||
      this.lineItemRequests.length === 0
    );
  }

  applyDiscount(annual) {
    return this.hasDiscount
      ? round2(annual * (1 - Number(this.discountPercent) / 100))
      : annual;
  }

  // Term and modeled discount aren't recoverable from the line items themselves - those are
  // pre-filled separately in wiredOpportunity, from the Term_Length__c/Discount__c fields that
  // handleAddProductsToOpportunity writes on every sync.
  applyExistingConfiguration(lineItems) {
    if (!lineItems || lineItems.length === 0) {
      return;
    }

    let recoveredLocations = null;

    for (const line of lineItems) {
      const code = line.productCode;

      if (REVERSE_BASE_PACKAGE_PRODUCT_CODES[code]) {
        this.serviceTier = REVERSE_BASE_PACKAGE_PRODUCT_CODES[code];
        recoveredLocations =
          recoveredLocations ?? parseLocationsFromDescription(line.description);
        continue;
      }

      if (ADD_ON_STATE_FIELD_BY_PRODUCT_CODE[code]) {
        this[ADD_ON_STATE_FIELD_BY_PRODUCT_CODE[code]] =
          Number(line.quantity) || 0;
        if (code === "ADDON-SURVEY") {
          this.additionalSurveyTypes = parseIncludedExtrasFromDescription(
            line.description,
            REVERSE_ADDITIONAL_SURVEY_TYPE_LABELS
          );
        }
        continue;
      }

      if (REVERSE_AGENT_TRACK_PRODUCT_CODES[code]) {
        this.agentTrackEnabled = true;
        this.agentTrackVariant = REVERSE_AGENT_TRACK_PRODUCT_CODES[code];
        this.agentCountBand = parseAgentBandFromDescription(line.description);
        continue;
      }

      if (REVERSE_RATINGS_REVIEWS_PRODUCT_CODES[code]) {
        this.ratingsReviewsEnabled = true;
        this.ratingsReviewsTier = REVERSE_RATINGS_REVIEWS_PRODUCT_CODES[code];
        this.reputationManagementExtras = parseIncludedExtrasFromDescription(
          line.description,
          REVERSE_REPUTATION_EXTRA_LABELS
        );
        continue;
      }

      if (REVERSE_IGNITE_EX_PRODUCT_CODES[code]) {
        this.igniteExEnabled = true;
        const lineKey = REVERSE_IGNITE_EX_PRODUCT_CODES[code];
        const itemKey = IGNITE_EX_ITEM_KEY_BY_LINE_KEY[lineKey];
        if (itemKey && !this.igniteExSelectedItems.includes(itemKey)) {
          this.igniteExSelectedItems = [...this.igniteExSelectedItems, itemKey];
        }
        if (itemKey === "pulse") {
          this.igniteExPulseQuantity = Number(line.quantity) || 0;
        }
        continue;
      }

      if (code === IGNITE_COMMUNITIES_PRODUCT_CODE) {
        this.igniteCommunitiesEnabled = true;
        const communityConfig = parseCommunityConfigurationFromDescription(
          line.description
        );
        if (communityConfig) {
          this.communityTier = communityConfig.tier;
          this.communityMarkets = communityConfig.markets;
          this.communitySizePerMarket = communityConfig.communitySizePerMarket;
        }
        continue;
      }

      if (REVERSE_IGNITE_DIGITAL_EXTRA_PRODUCT_CODES[code]) {
        this.igniteDigitalEnabled = true;
        const extraKey = REVERSE_IGNITE_DIGITAL_EXTRA_PRODUCT_CODES[code];
        if (!this.igniteDigitalExtras.includes(extraKey)) {
          this.igniteDigitalExtras = [...this.igniteDigitalExtras, extraKey];
        }
        if (extraKey === "mouseflowConfig") {
          this.mouseflowTier = parseMouseflowTierFromDescription(
            line.description
          );
        }
        continue;
      }

      if (code === IGNITE_DIGITAL_PRODUCT_CODE) {
        this.igniteDigitalEnabled = true;
        continue;
      }

      if (code === CASE_MANAGEMENT_PRODUCT_CODE) {
        this.caseManagementEnabled = true;
        continue;
      }

      if (code === SETUP_FEE_PRODUCT_CODE) {
        this.setupFeeEnabled = true;
        continue;
      }
    }

    if (recoveredLocations !== null) {
      this.locations = recoveredLocations;
    }

    this.dispatchEvent(
      new ShowToastEvent({
        title: "Loaded existing configuration",
        message:
          "Pre-filled from this Opportunity's current SMG Price Book products.",
        variant: "info"
      })
    );
  }

  buildAddOnLineItems(addOnLines) {
    return addOnLines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        productCode: ADD_ON_PRODUCT_CODES[line.key],
        quantity: line.quantity,
        unitPrice: round2(this.applyDiscount(line.annualTotal) / line.quantity),
        description:
          line.key === "additionalSurveys"
            ? appendIncludedExtras(
                line.label,
                this.additionalSurveyTypes,
                ADDITIONAL_SURVEY_TYPE_LABELS
              )
            : line.label,
        isOneTime: false
      }));
  }

  buildCommonLineItems() {
    const lines = [];

    if (this.igniteExEnabled) {
      for (const line of this.igniteExResult.lines) {
        lines.push({
          productCode: IGNITE_EX_PRODUCT_CODES[line.key],
          quantity: line.quantity,
          unitPrice: this.applyDiscount(line.unitPrice),
          description: `Ignite EX — ${line.label}${
            line.isCustomPricing
              ? " (price TBD — custom, see deal desk)"
              : ""
          }`,
          isOneTime: line.isOneTime
        });
      }
    }

    if (this.igniteCommunitiesEnabled) {
      const quote = this.communityQuote;
      lines.push({
        productCode: IGNITE_COMMUNITIES_PRODUCT_CODE,
        quantity: 1,
        unitPrice: this.applyDiscount(quote.totalAnnual),
        description: `Ignite Communities — ${quote.label}, ${quote.markets} market(s), ${quote.communitySizePerMarket}/market`,
        isOneTime: false
      });
    }

    if (this.igniteDigitalEnabled) {
      for (const line of this.igniteDigitalExtrasResult.lines) {
        lines.push({
          productCode: IGNITE_DIGITAL_EXTRA_PRODUCT_CODES[line.key],
          quantity: line.quantity,
          unitPrice: this.applyDiscount(line.unitPrice),
          description: `Ignite Digital — ${line.label}`,
          isOneTime: false
        });
      }
    }

    if (this.caseManagementEnabled) {
      lines.push({
        productCode: CASE_MANAGEMENT_PRODUCT_CODE,
        quantity: 1,
        unitPrice: CASE_MANAGEMENT_FEE,
        description: "Case Premium",
        isOneTime: true
      });
    }

    if (this.setupFeeEnabled) {
      lines.push({
        productCode: SETUP_FEE_PRODUCT_CODE,
        quantity: 1,
        unitPrice: this.setupFeeAmount,
        description: "Setup fee",
        isOneTime: true
      });
    }

    return lines;
  }

  get lineItemRequests() {
    const lines = [];

    lines.push({
      productCode: BASE_PACKAGE_PRODUCT_CODES[this.serviceTier],
      quantity: 1,
      unitPrice: this.applyDiscount(this.baseQuote.totalAnnual),
      description: `Ignite Platform (${this.serviceTier}) — ${this.locations} locations${
        this.baseQuote.isPriceTBD ? " (price TBD)" : ""
      }`,
      isOneTime: false
    });
    lines.push(...this.buildAddOnLineItems(this.addOnsResult.lines));

    if (this.agentTrackEnabled && this.callCenterResult.annualTotal > 0) {
      lines.push({
        productCode: AGENT_TRACK_PRODUCT_CODES[this.agentTrackVariant],
        quantity: 1,
        unitPrice: this.applyDiscount(this.callCenterResult.annualTotal),
        description: `AgentTrack (${AGENT_TRACK_LABELS[this.agentTrackVariant]}) — ${this.agentCountBand} agents`,
        isOneTime: false
      });
    }

    if (this.ratingsReviewsEnabled) {
      lines.push({
        productCode: RATINGS_REVIEWS_PRODUCT_CODES[this.ratingsReviewsTier],
        quantity: 1,
        unitPrice: this.applyDiscount(this.ratingsReviewsResult.annual),
        description: appendIncludedExtras(
          `Reputation Management (${RATINGS_REVIEWS_TIER_LABELS[this.ratingsReviewsTier]}) — ${this.ratingsReviewsResult.bracket} locations`,
          this.reputationManagementExtras,
          REPUTATION_EXTRA_LABELS
        ),
        isOneTime: false
      });
    }

    return [...lines, ...this.buildCommonLineItems()];
  }

  handleLocationsChange(event) {
    const value = Number(event.target.value);
    this.locations = Number.isFinite(value) && value > 0 ? value : 0;
  }

  handleServiceTierChange(event) {
    this.serviceTier = event.detail.value;
  }

  handleTermChange(event) {
    this.termMonths = event.detail.value;
  }

  handleIgniteExToggle(event) {
    this.igniteExEnabled = event.target.checked;
    if (!this.igniteExEnabled) {
      this.igniteExSelectedItems = [];
      this.igniteExPulseQuantity = 0;
    }
  }

  handleIgniteExItemsChange(event) {
    this.igniteExSelectedItems = event.detail.value;
    if (!this.igniteExSelectedItems.includes("pulse")) {
      this.igniteExPulseQuantity = 0;
    }
  }

  handleIgniteExPulseQuantityChange(event) {
    const value = Number(event.target.value);
    this.igniteExPulseQuantity =
      Number.isFinite(value) && value > 0 ? value : 0;
  }

  handleIgniteCommunitiesToggle(event) {
    this.igniteCommunitiesEnabled = event.target.checked;
  }

  handleCommunityTierChange(event) {
    this.communityTier = event.detail.value;
    // Reset to the new tier's included size so switching tiers doesn't carry over a
    // surcharge that no longer makes sense (e.g. Advanced's 2,000 while viewing DIY).
    this.communitySizePerMarket =
      COMMUNITY_TIER_SPECS[this.communityTier].includedCommunitySize;
  }

  handleCommunityMarketsChange(event) {
    const value = Number(event.target.value);
    this.communityMarkets = Number.isFinite(value) && value > 0 ? value : 1;
  }

  handleCommunitySizeChange(event) {
    const value = Number(event.target.value);
    this.communitySizePerMarket = Number.isFinite(value) && value >= 0 ? value : 0;
  }

  handleCommunityAgileChange(event) {
    const value = Number(event.target.value);
    this.communityAdditionalAgileProjects =
      Number.isFinite(value) && value > 0 ? value : 0;
  }

  handleCommunityConsultancyChange(event) {
    const value = Number(event.target.value);
    this.communityAdditionalConsultancyProjects =
      Number.isFinite(value) && value > 0 ? value : 0;
  }

  handleCommunityAdminChange(event) {
    const value = Number(event.target.value);
    this.communityAdditionalAdminUsers =
      Number.isFinite(value) && value > 0 ? value : 0;
  }

  handleIgniteDigitalToggle(event) {
    this.igniteDigitalEnabled = event.target.checked;
    if (!this.igniteDigitalEnabled) {
      this.igniteDigitalExtras = [];
      this.mouseflowTier = "Essential";
    }
  }

  handleIgniteDigitalExtrasChange(event) {
    this.igniteDigitalExtras = event.detail.value;
    if (!this.igniteDigitalExtras.includes("mouseflowConfig")) {
      this.mouseflowTier = "Essential";
    }
  }

  handleMouseflowTierChange(event) {
    this.mouseflowTier = event.detail.value;
  }

  handleCaseManagementToggle(event) {
    this.caseManagementEnabled = event.target.checked;
  }

  handleSetupFeeToggle(event) {
    this.setupFeeEnabled = event.target.checked;
  }

  handleAddOnQtyChange(event) {
    const field = event.target.dataset.field;
    const value = Number(event.target.value);
    this[field] = Number.isFinite(value) && value > 0 ? value : 0;
    if (field === "additionalSurveys" && this.additionalSurveys === 0) {
      this.additionalSurveyTypes = [];
    }
  }

  handleAdditionalSurveyTypesChange(event) {
    this.additionalSurveyTypes = event.detail.value;
  }

  handleAgentTrackToggle(event) {
    this.agentTrackEnabled = event.target.checked;
    this.agentTrackVariant = this.agentTrackEnabled ? "web" : "none";
    if (!this.agentTrackEnabled) {
      this.agentCountBand = "0-60";
    }
  }

  handleAgentCountBandChange(event) {
    this.agentCountBand = event.detail.value;
  }

  handleRatingsReviewsToggle(event) {
    this.ratingsReviewsEnabled = event.target.checked;
    if (!this.ratingsReviewsEnabled) {
      this.reputationManagementExtras = [];
    }
  }

  handleRatingsReviewsTierChange(event) {
    this.ratingsReviewsTier = event.detail.value;
  }

  handleReputationManagementExtrasChange(event) {
    this.reputationManagementExtras = event.detail.value;
  }

  handleDiscountChange(event) {
    const value = Number(event.target.value);
    this.discountPercent =
      Number.isFinite(value) && value >= 0
        ? Math.min(value, MAX_DISCOUNT_PERCENT)
        : 0;
  }

  async handleAddProductsToOpportunity() {
    if (this.locationsMissing) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Locations required",
          message: this.locationsRequiredMessage,
          variant: "error"
        })
      );
      return;
    }

    const lineItems = this.lineItemRequests;
    const unmapped = lineItems.find((line) => !line.productCode);
    if (unmapped) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Missing product mapping",
          message: `No product code is configured for this line: ${unmapped.description}`,
          variant: "error"
        })
      );
      return;
    }

    this.isSyncingProducts = true;
    try {
      const result = await syncLineItems({
        opportunityId: this.recordId,
        lineItemsJson: JSON.stringify(lineItems),
        ratePerLocation: this.finalRatePerLocationPerMonth,
        termLength: this.termLengthLabel,
        discountPercent: this.discountPercent,
        numberOfLocations: this.locations
      });
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Products added",
          message: `${result.lineItemCount} line item(s) added to the Opportunity.`,
          variant: "success"
        })
      );
      this.dispatchEvent(new RefreshEvent());
    } catch (error) {
      this.dispatchEvent(
        new ShowToastEvent({
          title: "Error adding products",
          message: error?.body?.message || error?.message || "Unknown error",
          variant: "error"
        })
      );
    } finally {
      this.isSyncingProducts = false;
    }
  }
}
