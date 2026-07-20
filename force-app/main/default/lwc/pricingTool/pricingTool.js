import { LightningElement, api, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { RefreshEvent } from "lightning/refresh";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import OPPORTUNITY_TYPE_FIELD from "@salesforce/schema/Opportunity.Type";
import syncLineItems from "@salesforce/apex/PricingToolController.syncLineItems";
import {
  PLANS,
  TERM_OPTIONS,
  RATINGS_REVIEWS_TIER_KEYS,
  RATINGS_REVIEWS_TIER_LABELS,
  MANAGED_LISTING_MANAGEMENT_REFERENCE,
  IGNITE_CX_RATE_PER_LOCATION_PER_MONTH,
  CASE_MANAGEMENT_FEE,
  COMMUNITY_TIERS,
  COMMUNITY_TIER_SPECS,
  computeBaseQuote,
  computeSetupFee,
  computeThreeYearProjection,
  computeAddOns,
  computeCallCenter,
  computeRatingsReviews,
  computeCommunityQuote,
  getDiscountGuidance
} from "c/pricingEngine";

const AGENT_TRACK_LABELS = {
  none: "None",
  web: "Web Only"
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const BASE_PACKAGE_PRODUCT_CODES = {
  "Pro/Advanced": "BASE-PRO-ADV",
  "Standard/Advanced": "BASE-STD-ADV",
  "Pro/Foundational": "BASE-PRO-FOUND",
  "Standard/Foundational": "BASE-STD-FOUND",
  "Solution Support Only": "SOLUTION-SUPPORT"
};

const ADD_ON_PRODUCT_CODES = {
  additionalLanguageSurveys: "ADDON-LANG-SURVEY",
  additionalLanguageReports: "ADDON-LANG-REPORT",
  additionalSurveys: "ADDON-SURVEY",
  additionalSurveyRevisions: "ADDON-SURVEY-REV",
  additionalIntegrations: "ADDON-INTEGRATION",
  additionalBrands: "ADDON-BRAND"
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

// Product code unchanged in Salesforce - only the display name changed to "Ignite CX".
const IGNITE_CX_PRODUCT_CODE = "ENT-LOC-SURVEY";
const IGNITE_EX_PRODUCT_CODE = "IGNITE-EX";
const IGNITE_COMMUNITIES_PRODUCT_CODE = "IGNITE-COMMUNITIES";
const IGNITE_DIGITAL_PRODUCT_CODE = "IGNITE-DIGITAL";
const CASE_MANAGEMENT_PRODUCT_CODE = "CASE-MANAGEMENT";
const SETUP_FEE_PRODUCT_CODE = "SETUP";
const NEW_LOGO_OPPORTUNITY_TYPE = "New Logo";
const MAX_DISCOUNT_PERCENT = 10;

// Packages (Discovery Guide tab) are the company's go-forward sales motion.
// Plan defaults below are a first-guess mapping onto the new 5-plan rate card (there's no
// exact 1:1 correspondence - 4 packages vs. 5 plans) and are meant to be adjusted by the
// rep afterward, not treated as authoritative. Ratings & Reviews tier is an exact mapping.
const PACKAGE_LABELS = {
  igniteStandard: "Ignite (Standard)",
  ignitePlus: "Ignite (Plus)",
  igniteEnterprise: "Ignite (Enterprise)",
  igniteManaged: "Ignite (Managed)"
};

const PACKAGE_DEFAULTS = {
  igniteStandard: {
    selectedPlan: "Standard/Foundational",
    ratingsReviewsTier: "basic",
    igniteCxEnabled: true,
    igniteExEnabled: false,
    igniteCommunitiesEnabled: false,
    igniteDigitalEnabled: false
  },
  ignitePlus: {
    selectedPlan: "Standard/Advanced",
    ratingsReviewsTier: "pro",
    igniteCxEnabled: true,
    igniteExEnabled: false,
    igniteCommunitiesEnabled: true,
    igniteDigitalEnabled: true
  },
  igniteEnterprise: {
    selectedPlan: "Pro/Foundational",
    ratingsReviewsTier: "premium",
    igniteCxEnabled: true,
    igniteExEnabled: true,
    igniteCommunitiesEnabled: true,
    igniteDigitalEnabled: true
  },
  igniteManaged: {
    selectedPlan: "Pro/Advanced",
    ratingsReviewsTier: "premium",
    igniteCxEnabled: true,
    igniteExEnabled: true,
    igniteCommunitiesEnabled: true,
    igniteDigitalEnabled: true
  }
};

export default class PricingTool extends LightningElement {
  @api recordId;

  locations = 0;
  selectedPlan = "Pro/Advanced";
  selectedPackage = "";
  termMonths = "36";
  includeBaseSubscription = false;

  additionalLanguages = 0;
  additionalSurveys = 0;
  additionalSurveyRevisions = 0;
  additionalIntegrations = 0;
  additionalBrands = 0;

  agentTrackVariant = "none";
  agentCount = 0;

  ratingsReviewsEnabled = false;
  ratingsReviewsTier = "pro";

  discountPercent = 0;

  igniteCxEnabled = false;
  igniteExEnabled = false;
  igniteCommunitiesEnabled = false;
  igniteDigitalEnabled = false;
  caseManagementEnabled = false;
  setupFeeEnabled = false;
  setupFeeDefaultApplied = false;

  communityTier = "DIY";
  communityMarkets = 1;
  communitySizePerMarket = COMMUNITY_TIER_SPECS.DIY.includedCommunitySize;
  communityAdditionalAgileProjects = 0;
  communityAdditionalConsultancyProjects = 0;
  communityAdditionalAdminUsers = 0;

  isSyncingProducts = false;

  managedListingManagementReference = MANAGED_LISTING_MANAGEMENT_REFERENCE;

  @wire(getRecord, { recordId: "$recordId", fields: [OPPORTUNITY_TYPE_FIELD] })
  wiredOpportunity({ data }) {
    if (data && !this.setupFeeDefaultApplied) {
      this.setupFeeDefaultApplied = true;
      this.setupFeeEnabled =
        getFieldValue(data, OPPORTUNITY_TYPE_FIELD) ===
        NEW_LOGO_OPPORTUNITY_TYPE;
    }
  }

  get planOptions() {
    return PLANS.map((plan) => ({ label: plan, value: plan }));
  }

  get packageOptions() {
    return [
      { label: "Custom (no package)", value: "" },
      ...Object.keys(PACKAGE_LABELS).map((key) => ({
        label: PACKAGE_LABELS[key],
        value: key
      }))
    ];
  }

  get termOptions() {
    return TERM_OPTIONS.map((term) => ({
      label: term.label,
      value: String(term.months)
    }));
  }

  get communityTierOptions() {
    return COMMUNITY_TIERS.map((tier) => ({
      label: COMMUNITY_TIER_SPECS[tier].label,
      value: tier
    }));
  }

  get agentTrackOptions() {
    return ["none", "web"].map((variant) => ({
      label: AGENT_TRACK_LABELS[variant],
      value: variant
    }));
  }

  get ratingsReviewsTierOptions() {
    return RATINGS_REVIEWS_TIER_KEYS.map((key) => ({
      label: RATINGS_REVIEWS_TIER_LABELS[key],
      value: key
    }));
  }

  get agentTrackDisabled() {
    return this.agentTrackVariant === "none";
  }

  get ratingsReviewsDisabled() {
    return !this.ratingsReviewsEnabled;
  }

  get igniteCxAnnual() {
    return round2(
      Number(this.locations) * IGNITE_CX_RATE_PER_LOCATION_PER_MONTH * 12
    );
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

  // Locations only matters to the pieces that are actually priced per location - the setup
  // fee formula ($5,000 base + $10/location) still degrades gracefully to a flat $5,000 at
  // zero locations, so it doesn't force locations to be entered like the others do.
  get locationsRequiredReasons() {
    const reasons = [];
    if (this.includeBaseSubscription) {
      reasons.push("the base subscription");
    }
    if (this.igniteCxEnabled) {
      reasons.push("Ignite CX");
    }
    if (this.ratingsReviewsEnabled) {
      reasons.push("Ratings & Reviews");
    }
    return reasons;
  }

  get locationsRequired() {
    return this.locationsRequiredReasons.length > 0;
  }

  get locationsMissing() {
    return this.locationsRequired && !(Number(this.locations) > 0);
  }

  get locationsRequiredMessage() {
    if (!this.locationsMissing) {
      return "";
    }
    return `Locations is required for: ${this.locationsRequiredReasons.join(", ")}.`;
  }

  get baseQuote() {
    return computeBaseQuote(this.selectedPlan, this.locations, this.termMonths);
  }

  get addOnsResult() {
    return computeAddOns(
      {
        additionalLanguages: this.additionalLanguages,
        additionalSurveys: this.additionalSurveys,
        additionalSurveyRevisions: this.additionalSurveyRevisions,
        additionalIntegrations: this.additionalIntegrations,
        additionalBrands: this.additionalBrands
      },
      this.locations
    );
  }

  get callCenterResult() {
    return computeCallCenter(
      this.agentTrackVariant,
      this.agentCount,
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

  get listPricePerLocationPerMonth() {
    if (!this.includeBaseSubscription) {
      return 0;
    }
    return round2(
      this.baseQuote.pricePerLocationPerMonth +
        this.addOnsResult.perLocPerMonth +
        this.callCenterResult.perLocPerMonth
    );
  }

  get listAnnual() {
    if (!this.includeBaseSubscription) {
      return 0;
    }
    return Math.round(this.listPricePerLocationPerMonth * this.locations * 12);
  }

  get listMonthly() {
    return Math.round(this.listAnnual / 12);
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
      isOneTime:
        line.productCode === SETUP_FEE_PRODUCT_CODE ||
        line.productCode === CASE_MANAGEMENT_PRODUCT_CODE,
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

  buildAddOnLineItems(addOnLines) {
    return addOnLines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        productCode: ADD_ON_PRODUCT_CODES[line.key],
        quantity: line.quantity,
        unitPrice: round2(this.applyDiscount(line.annualTotal) / line.quantity),
        description: line.label
      }));
  }

  buildCommonLineItems() {
    const lines = [];

    if (this.igniteCxEnabled) {
      lines.push({
        productCode: IGNITE_CX_PRODUCT_CODE,
        quantity: 1,
        unitPrice: this.applyDiscount(this.igniteCxAnnual),
        description: `Ignite CX — ${this.locations} locations`
      });
    }

    if (this.igniteExEnabled) {
      lines.push({
        productCode: IGNITE_EX_PRODUCT_CODE,
        quantity: 1,
        unitPrice: 0,
        description: "Ignite EX (price TBD)"
      });
    }

    if (this.igniteCommunitiesEnabled) {
      const quote = this.communityQuote;
      lines.push({
        productCode: IGNITE_COMMUNITIES_PRODUCT_CODE,
        quantity: 1,
        unitPrice: this.applyDiscount(quote.totalAnnual),
        description: `Ignite Communities — ${quote.label}, ${quote.markets} market(s), ${quote.communitySizePerMarket}/market`
      });
    }

    if (this.igniteDigitalEnabled) {
      lines.push({
        productCode: IGNITE_DIGITAL_PRODUCT_CODE,
        quantity: 1,
        unitPrice: 0,
        description: "Ignite Digital (price TBD)"
      });
    }

    if (this.caseManagementEnabled) {
      lines.push({
        productCode: CASE_MANAGEMENT_PRODUCT_CODE,
        quantity: 1,
        unitPrice: CASE_MANAGEMENT_FEE,
        description: "Case management build"
      });
    }

    if (this.setupFeeEnabled) {
      lines.push({
        productCode: SETUP_FEE_PRODUCT_CODE,
        quantity: 1,
        unitPrice: this.setupFeeAmount,
        description: "Setup fee"
      });
    }

    return lines;
  }

  get lineItemRequests() {
    const lines = [];

    // Add-Ons and AgentTrack are priced "over and above base package" - only meaningful
    // (and only synced) when the rep is actually quoting the base subscription.
    if (this.includeBaseSubscription) {
      lines.push({
        productCode: BASE_PACKAGE_PRODUCT_CODES[this.selectedPlan],
        quantity: 1,
        unitPrice: this.applyDiscount(this.baseQuote.totalAnnual),
        description: `${this.selectedPlan} — ${this.locations} locations`
      });
      lines.push(...this.buildAddOnLineItems(this.addOnsResult.lines));

      if (
        this.agentTrackVariant !== "none" &&
        this.callCenterResult.annualTotal > 0
      ) {
        lines.push({
          productCode: AGENT_TRACK_PRODUCT_CODES[this.agentTrackVariant],
          quantity: 1,
          unitPrice: this.applyDiscount(this.callCenterResult.annualTotal),
          description: `AgentTrack (${AGENT_TRACK_LABELS[this.agentTrackVariant]}) — ${this.agentCount} agents`
        });
      }
    }

    if (this.ratingsReviewsEnabled) {
      lines.push({
        productCode: RATINGS_REVIEWS_PRODUCT_CODES[this.ratingsReviewsTier],
        quantity: 1,
        unitPrice: this.applyDiscount(this.ratingsReviewsResult.annual),
        description: `Ratings & Reviews (${RATINGS_REVIEWS_TIER_LABELS[this.ratingsReviewsTier]}) — ${this.ratingsReviewsResult.bracket} locations`
      });
    }

    return [...lines, ...this.buildCommonLineItems()];
  }

  handleLocationsChange(event) {
    const value = Number(event.target.value);
    this.locations = Number.isFinite(value) && value > 0 ? value : 0;
  }

  handleIncludeBaseSubscriptionToggle(event) {
    this.includeBaseSubscription = event.target.checked;
  }

  handlePlanChange(event) {
    this.selectedPlan = event.detail.value;
  }

  handleTermChange(event) {
    this.termMonths = event.detail.value;
  }

  handlePackageChange(event) {
    const packageKey = event.detail.value;
    this.selectedPackage = packageKey;
    const defaults = PACKAGE_DEFAULTS[packageKey];
    if (defaults) {
      this.includeBaseSubscription = true;
      this.selectedPlan = defaults.selectedPlan;
      this.ratingsReviewsEnabled = true;
      this.ratingsReviewsTier = defaults.ratingsReviewsTier;
      this.igniteCxEnabled = defaults.igniteCxEnabled;
      this.igniteExEnabled = defaults.igniteExEnabled;
      this.igniteCommunitiesEnabled = defaults.igniteCommunitiesEnabled;
      this.igniteDigitalEnabled = defaults.igniteDigitalEnabled;
    }
  }

  handleIgniteCxToggle(event) {
    this.igniteCxEnabled = event.target.checked;
  }

  handleIgniteExToggle(event) {
    this.igniteExEnabled = event.target.checked;
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
  }

  handleAgentTrackVariantChange(event) {
    this.agentTrackVariant = event.detail.value;
    if (this.agentTrackVariant === "none") {
      this.agentCount = 0;
    }
  }

  handleAgentCountChange(event) {
    const value = Number(event.target.value);
    this.agentCount = Number.isFinite(value) && value > 0 ? value : 0;
  }

  handleRatingsReviewsToggle(event) {
    this.ratingsReviewsEnabled = event.target.checked;
  }

  handleRatingsReviewsTierChange(event) {
    this.ratingsReviewsTier = event.detail.value;
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
        ratePerLocation: this.finalRatePerLocationPerMonth
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
