import { LightningElement, api, wire } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { RefreshEvent } from "lightning/refresh";
import { getRecord, getFieldValue } from "lightning/uiRecordApi";
import OPPORTUNITY_TYPE_FIELD from "@salesforce/schema/Opportunity.Type";
import syncLineItems from "@salesforce/apex/PricingToolController.syncLineItems";
import {
  PLANS,
  ENTERPRISE_LOCATION_THRESHOLD,
  ENTERPRISE,
  RATINGS_REVIEWS_TIER_KEYS,
  RATINGS_REVIEWS_TIER_LABELS,
  MANAGED_LISTING_MANAGEMENT_REFERENCE,
  computeBaseQuote,
  computeAddOns,
  computeCallCenter,
  computeRatingsReviews,
  computeEnterpriseQuote,
  getDiscountGuidance
} from "c/pricingEngine";

const AGENT_TRACK_LABELS = {
  none: "None",
  web: "Web Only"
};

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const ENTERPRISE_SERVICE_LEVELS = ["foundational", "advanced", "elite"];
const ENTERPRISE_SERVICE_LEVEL_LABELS = {
  foundational: "Foundational",
  advanced: "Advanced (+25%)",
  elite: "Elite (+30% over Advanced)"
};

const BASE_PACKAGE_PRODUCT_CODES = {
  "Standard Foundational": "BASE-STD-FOUND",
  "Standard Advanced": "BASE-STD-ADV",
  "Standard Elite": "BASE-STD-ELITE",
  "Professional Foundational": "BASE-PRO-FOUND",
  "Professional Advanced": "BASE-PRO-ADV",
  "Professional Elite": "BASE-PRO-ELITE"
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
const ENTERPRISE_WEBSITE_SURVEY_PRODUCT_CODE = "ENT-WEBSITE-SURVEY";
const ENTERPRISE_TIER_PREMIUM_PRODUCT_CODE = "ENT-TIER-PREMIUM";

const IGNITE_EX_PRODUCT_CODE = "IGNITE-EX";
const IGNITE_COMMUNITIES_PRODUCT_CODE = "IGNITE-COMMUNITIES";
const IGNITE_DIGITAL_PRODUCT_CODE = "IGNITE-DIGITAL";
const SETUP_FEE_PRODUCT_CODE = "SETUP";
const SETUP_FEE_AMOUNT = 10000;
const NEW_LOGO_OPPORTUNITY_TYPE = "New Logo";
const MAX_DISCOUNT_PERCENT = 10;

// Packages (Discovery Guide tab) are the company's go-forward sales motion.
// Plan-tier defaults below are a first-guess mapping onto the existing 6 Plans (there's no
// 1:1 correspondence - 4 packages vs. 2 tracks x 3 tiers) and are meant to be adjusted by the
// rep afterward, not treated as authoritative. Ratings & Reviews tier is an exact mapping.
const PACKAGE_LABELS = {
  igniteStandard: "Ignite (Standard)",
  ignitePlus: "Ignite (Plus)",
  igniteEnterprise: "Ignite (Enterprise)",
  igniteManaged: "Ignite (Managed)"
};

const PACKAGE_DEFAULTS = {
  igniteStandard: {
    selectedPlan: "Standard Foundational",
    ratingsReviewsTier: "basic",
    igniteCxEnabled: true,
    igniteExEnabled: false,
    igniteCommunitiesEnabled: false,
    igniteDigitalEnabled: false
  },
  ignitePlus: {
    selectedPlan: "Standard Advanced",
    ratingsReviewsTier: "pro",
    igniteCxEnabled: true,
    igniteExEnabled: false,
    igniteCommunitiesEnabled: true,
    igniteDigitalEnabled: true
  },
  igniteEnterprise: {
    selectedPlan: "Standard Elite",
    ratingsReviewsTier: "premium",
    igniteCxEnabled: true,
    igniteExEnabled: true,
    igniteCommunitiesEnabled: true,
    igniteDigitalEnabled: true
  },
  igniteManaged: {
    selectedPlan: "Professional Elite",
    ratingsReviewsTier: "premium",
    igniteCxEnabled: true,
    igniteExEnabled: true,
    igniteCommunitiesEnabled: true,
    igniteDigitalEnabled: true
  }
};

export default class PricingTool extends LightningElement {
  @api recordId;

  locations = 100;
  selectedPlan = "Professional Foundational";
  selectedPackage = "";

  additionalLanguages = 0;
  additionalSurveys = 0;
  additionalSurveyRevisions = 0;
  additionalIntegrations = 0;
  additionalBrands = 0;

  agentTrackVariant = "none";
  agentCount = 0;

  ratingsReviewsEnabled = false;
  ratingsReviewsTier = "pro";

  websiteSurveyNeeded = false;
  enterpriseServiceLevel = "foundational";
  discountPercent = 0;

  igniteCxEnabled = false;
  igniteExEnabled = false;
  igniteCommunitiesEnabled = false;
  igniteDigitalEnabled = false;
  setupFeeEnabled = false;
  setupFeeDefaultApplied = false;

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

  get isEnterprise() {
    return Number(this.locations) > ENTERPRISE_LOCATION_THRESHOLD;
  }

  get agentTrackDisabled() {
    return this.agentTrackVariant === "none";
  }

  get ratingsReviewsDisabled() {
    return !this.ratingsReviewsEnabled;
  }

  get igniteCxAnnual() {
    return round2(
      Number(this.locations) * ENTERPRISE.locationSurveyPricePerMonth * 12
    );
  }

  get igniteCxDisplayChecked() {
    return this.isEnterprise || this.igniteCxEnabled;
  }

  get baseQuote() {
    if (this.isEnterprise) {
      return null;
    }
    return computeBaseQuote(this.selectedPlan, this.locations);
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

  get ratingsReviewsSelection() {
    return {
      enabled: this.ratingsReviewsEnabled,
      tier: this.ratingsReviewsTier
    };
  }

  get ratingsReviewsResult() {
    if (!this.ratingsReviewsEnabled) {
      return null;
    }
    return computeRatingsReviews(this.ratingsReviewsTier, this.locations);
  }

  get enterpriseQuote() {
    return computeEnterpriseQuote(
      this.locations,
      {
        additionalLanguages: this.additionalLanguages,
        additionalSurveys: this.additionalSurveys,
        additionalSurveyRevisions: this.additionalSurveyRevisions,
        additionalIntegrations: this.additionalIntegrations,
        additionalBrands: this.additionalBrands
      },
      this.ratingsReviewsSelection,
      this.websiteSurveyNeeded
    );
  }

  get discountGuidance() {
    return getDiscountGuidance(this.locations);
  }

  get enterpriseServiceLevelOptions() {
    return ENTERPRISE_SERVICE_LEVELS.map((level) => ({
      label: ENTERPRISE_SERVICE_LEVEL_LABELS[level],
      value: level
    }));
  }

  get listPricePerLocationPerMonth() {
    if (this.isEnterprise) {
      return 0;
    }
    return round2(
      this.baseQuote.pricePerLocationPerMonth +
        this.addOnsResult.perLocPerMonth +
        this.callCenterResult.perLocPerMonth
    );
  }

  get listAnnual() {
    if (this.isEnterprise) {
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

  get finalAmount() {
    if (this.isEnterprise) {
      return this.enterpriseQuote[this.enterpriseServiceLevel].annual;
    }
    return this.hasDiscount ? this.discountedAnnual : this.listAnnual;
  }

  get finalRatePerLocationPerMonth() {
    if (this.isEnterprise) {
      return this.enterpriseQuote[this.enterpriseServiceLevel].perLocPerMonth;
    }
    return this.hasDiscount
      ? this.discountedPerLocationPerMonth
      : this.listPricePerLocationPerMonth;
  }

  get addProductsDisabled() {
    return (
      this.isSyncingProducts || !this.recordId || !(this.finalAmount > 0)
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

    // Above 1,250 locations, the Enterprise branch already includes Ignite CX
    // unconditionally (its own line, priced off the enterprise quote) - avoid double-adding it.
    if (this.igniteCxEnabled && !this.isEnterprise) {
      lines.push({
        productCode: IGNITE_CX_PRODUCT_CODE,
        quantity: 1,
        unitPrice: this.applyDiscount(this.igniteCxAnnual),
        description: `${this.locations} locations`
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
      lines.push({
        productCode: IGNITE_COMMUNITIES_PRODUCT_CODE,
        quantity: 1,
        unitPrice: 0,
        description: "Ignite Communities (price TBD)"
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

    if (this.setupFeeEnabled) {
      lines.push({
        productCode: SETUP_FEE_PRODUCT_CODE,
        quantity: 1,
        unitPrice: SETUP_FEE_AMOUNT,
        description: "One-time setup fee"
      });
    }

    return lines;
  }

  get lineItemRequests() {
    if (this.isEnterprise) {
      const quote = this.enterpriseQuote;
      const lines = [
        {
          productCode: IGNITE_CX_PRODUCT_CODE,
          quantity: 1,
          unitPrice: quote.locationSurveyAnnual,
          description: `${this.locations} locations`
        },
        ...this.buildAddOnLineItems(quote.addOns.lines)
      ];

      if (quote.ratingsReviews) {
        lines.push({
          productCode: RATINGS_REVIEWS_PRODUCT_CODES[this.ratingsReviewsTier],
          quantity: 1,
          unitPrice: quote.ratingsReviews.annual,
          description: `${quote.ratingsReviews.bracket} locations`
        });
      }

      if (this.websiteSurveyNeeded) {
        lines.push({
          productCode: ENTERPRISE_WEBSITE_SURVEY_PRODUCT_CODE,
          quantity: 1,
          unitPrice: quote.websiteSurveyAnnual,
          description: "Contact Us website survey"
        });
      }

      if (this.enterpriseServiceLevel !== "foundational") {
        const tierAnnual = quote[this.enterpriseServiceLevel].annual;
        lines.push({
          productCode: ENTERPRISE_TIER_PREMIUM_PRODUCT_CODE,
          quantity: 1,
          unitPrice: round2(tierAnnual - quote.foundational.annual),
          description: `${ENTERPRISE_SERVICE_LEVEL_LABELS[this.enterpriseServiceLevel]} tier premium`
        });
      }

      return [...lines, ...this.buildCommonLineItems()];
    }

    const lines = [
      {
        productCode: BASE_PACKAGE_PRODUCT_CODES[this.selectedPlan],
        quantity: 1,
        unitPrice: this.applyDiscount(this.baseQuote.totalAnnual),
        description: `${this.selectedPlan} — ${this.locations} locations`
      },
      ...this.buildAddOnLineItems(this.addOnsResult.lines)
    ];

    if (this.agentTrackVariant !== "none" && this.callCenterResult.annualTotal > 0) {
      lines.push({
        productCode: AGENT_TRACK_PRODUCT_CODES[this.agentTrackVariant],
        quantity: 1,
        unitPrice: this.applyDiscount(this.callCenterResult.annualTotal),
        description: `${this.agentCount} agents`
      });
    }

    if (this.ratingsReviewsEnabled) {
      lines.push({
        productCode: RATINGS_REVIEWS_PRODUCT_CODES[this.ratingsReviewsTier],
        quantity: 1,
        unitPrice: this.applyDiscount(this.ratingsReviewsResult.annual),
        description: `${this.ratingsReviewsResult.bracket} locations`
      });
    }

    return [...lines, ...this.buildCommonLineItems()];
  }

  handleLocationsChange(event) {
    const value = Number(event.target.value);
    this.locations = Number.isFinite(value) && value > 0 ? value : 0;
  }

  handlePlanChange(event) {
    this.selectedPlan = event.detail.value;
  }

  handlePackageChange(event) {
    const packageKey = event.detail.value;
    this.selectedPackage = packageKey;
    const defaults = PACKAGE_DEFAULTS[packageKey];
    if (defaults) {
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

  handleIgniteDigitalToggle(event) {
    this.igniteDigitalEnabled = event.target.checked;
  }

  handleIgniteCommunitiesToggle(event) {
    this.igniteCommunitiesEnabled = event.target.checked;
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

  handleWebsiteSurveyToggle(event) {
    this.websiteSurveyNeeded = event.target.checked;
  }

  handleEnterpriseServiceLevelChange(event) {
    this.enterpriseServiceLevel = event.detail.value;
  }

  handleDiscountChange(event) {
    const value = Number(event.target.value);
    this.discountPercent =
      Number.isFinite(value) && value >= 0
        ? Math.min(value, MAX_DISCOUNT_PERCENT)
        : 0;
  }

  async handleAddProductsToOpportunity() {
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
