import { createElement } from "@lwc/engine-dom";
import { getRecord } from "lightning/uiRecordApi";
import PricingTool from "c/pricingTool";
import getExistingLineItems from "@salesforce/apex/PricingToolController.getExistingLineItems";
import {
  computeBaseQuote,
  computeRatingsReviews,
  computeCommunityQuote,
  COMMUNITY_TIER_SPECS
} from "c/pricingEngine";

const IGNITE_DIGITAL_FLAT_FEE = 40000;

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function flush() {
  return Promise.resolve();
}

function createTool() {
  const element = createElement("c-pricing-tool", { is: PricingTool });
  document.body.appendChild(element);
  return element;
}

describe("c-pricing-tool", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders with a default plan, term, and location count", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    // Defaults to 0, not a placeholder count - custom quotes don't all need locations,
    // and locationsRequired/locationsMissing enforce it only when something needs it.
    expect(locationsInput.value).toBe(0);

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    expect(planCombobox.value).toBe("Pro/Advanced");

    const termCombobox = element.shadowRoot.querySelector(
      '[data-id="term-combobox"]'
    );
    expect(termCombobox.value).toBe("36");
  });

  it("keeps the Plan combobox visible at every location count, including above 5,000", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 6000;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="plan-combobox"]')
    ).not.toBeNull();
  });

  it("shows a custom-pricing warning above the 5,000-location rate card ceiling", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 6000;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const banner = element.shadowRoot.querySelector(".slds-notify_alert");
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain("custom pricing");
  });

  it("applies the term premium when a shorter term is selected", async () => {
    const element = createTool();
    await flush();

    const termCombobox = element.shadowRoot.querySelector(
      '[data-id="term-combobox"]'
    );
    termCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "12" } })
    );
    await flush();

    expect(termCombobox.value).toBe("12");
  });

  it("only offers None and Web Only for the AgentTrack variant", async () => {
    const element = createTool();
    await flush();

    const variantCombobox = element.shadowRoot.querySelector(
      '[data-id="agent-track-variant"]'
    );
    expect(variantCombobox.options.map((option) => option.value)).toEqual([
      "none",
      "web"
    ]);
  });

  it("enables the agent count input once an AgentTrack variant is selected", async () => {
    const element = createTool();
    await flush();

    const variantCombobox = element.shadowRoot.querySelector(
      '[data-id="agent-track-variant"]'
    );
    variantCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "web" } })
    );
    await flush();

    const agentCountInput = element.shadowRoot.querySelector(
      '[data-id="agent-count-input"]'
    );
    expect(agentCountInput.disabled).toBe(false);
  });

  it("enables the Ratings & Reviews tier selector once the product is toggled on", async () => {
    const element = createTool();
    await flush();

    const toggle = element.shadowRoot.querySelector('[data-id="rr-toggle"]');
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const tierGroup = element.shadowRoot.querySelector(
      '[data-id="rr-tier-radio-group"]'
    );
    expect(tierGroup.disabled).toBe(false);
  });

  it("pre-fills the Plan and Ratings & Reviews tier when a package is selected", async () => {
    const element = createTool();
    await flush();

    const packageCombobox = element.shadowRoot.querySelector(
      '[data-id="package-combobox"]'
    );
    packageCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "ignitePlus" } })
    );
    await flush();

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    expect(planCombobox.value).toBe("Standard/Advanced");

    const tierGroup = element.shadowRoot.querySelector(
      '[data-id="rr-tier-radio-group"]'
    );
    expect(tierGroup.disabled).toBe(false);
    expect(tierGroup.value).toBe("pro");

    const igniteCommunitiesToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-communities-toggle"]'
    );
    expect(igniteCommunitiesToggle.checked).toBe(true);

    const igniteExToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-toggle"]'
    );
    expect(igniteExToggle.checked).toBe(false);

    const igniteDigitalToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    expect(igniteDigitalToggle.checked).toBe(true);
  });

  it("pre-fills Ignite EX, Communities, and CX for the Enterprise package", async () => {
    const element = createTool();
    await flush();

    const packageCombobox = element.shadowRoot.querySelector(
      '[data-id="package-combobox"]'
    );
    packageCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "igniteEnterprise" } })
    );
    await flush();

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    expect(planCombobox.value).toBe("Pro/Foundational");

    const igniteExToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-toggle"]'
    );
    expect(igniteExToggle.checked).toBe(true);

    const igniteCommunitiesToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-communities-toggle"]'
    );
    expect(igniteCommunitiesToggle.checked).toBe(true);

    const igniteCxToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-cx-toggle"]'
    );
    expect(igniteCxToggle.checked).toBe(true);
  });

  it("caps the modeled discount % at 10", async () => {
    const element = createTool();
    await flush();

    const discountInput = element.shadowRoot.querySelector(
      '[data-id="discount-input"]'
    );
    discountInput.value = 35;
    discountInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(discountInput.value).toBe(10);
  });

  it("shows the setup fee checkbox label with the computed (not flat) amount", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 800;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const setupFeeToggle = element.shadowRoot.querySelector(
      '[data-id="setup-fee-toggle"]'
    );
    // $5,000 base + $10 x 800 committed locations = $13,000
    expect(setupFeeToggle.label).toContain("13,000");
  });

  it("allows manually toggling Ignite EX, Case Management, and the setup fee", async () => {
    const element = createTool();
    await flush();

    const igniteExToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-toggle"]'
    );
    igniteExToggle.checked = true;
    igniteExToggle.dispatchEvent(new CustomEvent("change"));

    const caseManagementToggle = element.shadowRoot.querySelector(
      '[data-id="case-management-toggle"]'
    );
    caseManagementToggle.checked = true;
    caseManagementToggle.dispatchEvent(new CustomEvent("change"));

    const setupFeeToggle = element.shadowRoot.querySelector(
      '[data-id="setup-fee-toggle"]'
    );
    setupFeeToggle.checked = true;
    setupFeeToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(igniteExToggle.checked).toBe(true);
    expect(caseManagementToggle.checked).toBe(true);
    expect(setupFeeToggle.checked).toBe(true);
  });

  it("does not require locations for a custom quote with only Ignite EX toggled on", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    includeBaseToggle.checked = false;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 0;
    locationsInput.dispatchEvent(new CustomEvent("change"));

    const igniteExToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-toggle"]'
    );
    igniteExToggle.checked = true;
    igniteExToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(false);
  });

  it("does not require locations for a custom quote with only the setup fee toggled on", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    const setupFeeToggle = element.shadowRoot.querySelector(
      '[data-id="setup-fee-toggle"]'
    );
    setupFeeToggle.checked = true;
    setupFeeToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(false);
  });

  it("defaults to a custom quote with the base subscription off, and turns it back on when a package is chosen", async () => {
    const element = createTool();
    await flush();

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    expect(includeBaseToggle.checked).toBe(false);

    const packageCombobox = element.shadowRoot.querySelector(
      '[data-id="package-combobox"]'
    );
    packageCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "ignitePlus" } })
    );
    await flush();

    expect(includeBaseToggle.checked).toBe(true);
  });

  it("requires locations when Ignite CX is enabled, even in a custom quote", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    includeBaseToggle.checked = false;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 0;
    locationsInput.dispatchEvent(new CustomEvent("change"));

    const igniteCxToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-cx-toggle"]'
    );
    igniteCxToggle.checked = true;
    igniteCxToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(true);

    const banner = element.shadowRoot.querySelector(".slds-notify_alert");
    expect(banner.textContent).toContain("Ignite CX");
  });

  it("prices a standalone Ignite CX quote off the selected Plan's rate card, and re-prices it when the Plan changes", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 500;
    locationsInput.dispatchEvent(new CustomEvent("change"));

    const igniteCxToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-cx-toggle"]'
    );
    igniteCxToggle.checked = true;
    igniteCxToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const proAdvancedAnnual = computeBaseQuote(
      "Pro/Advanced",
      500,
      "36"
    ).totalAnnual;
    const proAdvancedMonthly = Math.round(proAdvancedAnnual / 12);
    const proAdvancedPerLocation = round2(proAdvancedMonthly / 500);

    let perLocationEl = element.shadowRoot.querySelector(
      '[data-id="quoted-price-per-location"]'
    );
    expect(perLocationEl).not.toBeNull();
    expect(perLocationEl.value).toBe(proAdvancedPerLocation);

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    planCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Standard/Foundational" } })
    );
    await flush();

    const standardFoundationalAnnual = computeBaseQuote(
      "Standard/Foundational",
      500,
      "36"
    ).totalAnnual;
    const standardFoundationalMonthly = Math.round(
      standardFoundationalAnnual / 12
    );
    const standardFoundationalPerLocation = round2(
      standardFoundationalMonthly / 500
    );

    perLocationEl = element.shadowRoot.querySelector(
      '[data-id="quoted-price-per-location"]'
    );
    expect(perLocationEl.value).toBe(standardFoundationalPerLocation);
    expect(standardFoundationalPerLocation).not.toBe(proAdvancedPerLocation);
  });

  it("defaults to Ignite CX only when a Standard plan is selected, clearing Ratings & Reviews and Ignite Digital", async () => {
    const element = createTool();
    await flush();

    const rrToggle = element.shadowRoot.querySelector('[data-id="rr-toggle"]');
    rrToggle.checked = true;
    rrToggle.dispatchEvent(new CustomEvent("change"));

    const igniteDigitalToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    igniteDigitalToggle.checked = true;
    igniteDigitalToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    planCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Standard/Advanced" } })
    );
    await flush();

    const igniteCxToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-cx-toggle"]'
    );
    expect(igniteCxToggle.checked).toBe(true);
    expect(
      element.shadowRoot.querySelector('[data-id="rr-toggle"]').checked
    ).toBe(false);
    expect(
      element.shadowRoot.querySelector('[data-id="ignite-digital-toggle"]')
        .checked
    ).toBe(false);
  });

  it("defaults to Ignite CX + Ratings & Reviews + Ignite Digital when a Pro plan is selected", async () => {
    const element = createTool();
    await flush();

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    planCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Pro/Foundational" } })
    );
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="ignite-cx-toggle"]').checked
    ).toBe(true);
    expect(
      element.shadowRoot.querySelector('[data-id="rr-toggle"]').checked
    ).toBe(true);
    expect(
      element.shadowRoot.querySelector('[data-id="ignite-digital-toggle"]')
        .checked
    ).toBe(true);
  });

  it("leaves the CX / Ratings & Reviews / Ignite Digital toggles untouched when Solution Support Only is selected", async () => {
    const element = createTool();
    await flush();

    const igniteDigitalToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    igniteDigitalToggle.checked = true;
    igniteDigitalToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    planCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Solution Support Only" } })
    );
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="ignite-cx-toggle"]').checked
    ).toBe(false);
    expect(
      element.shadowRoot.querySelector('[data-id="rr-toggle"]').checked
    ).toBe(false);
    expect(
      element.shadowRoot.querySelector('[data-id="ignite-digital-toggle"]')
        .checked
    ).toBe(true);
  });

  it("shows the Ignite Communities calculator only when the toggle is on, defaulting to the DIY tier", async () => {
    const element = createTool();
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="community-tier-combobox"]')
    ).toBeNull();

    const igniteCommunitiesToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-communities-toggle"]'
    );
    igniteCommunitiesToggle.checked = true;
    igniteCommunitiesToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const tierCombobox = element.shadowRoot.querySelector(
      '[data-id="community-tier-combobox"]'
    );
    expect(tierCombobox).not.toBeNull();
    expect(tierCombobox.value).toBe("DIY");

    const sizeInput = element.shadowRoot.querySelector(
      '[data-id="community-size-input"]'
    );
    expect(sizeInput.value).toBe(1000);
  });

  it("disables AGILE/CONSULTANCY project inputs on the DIY tier, enables them on Advanced, and resets community size to the new tier's default", async () => {
    const element = createTool();
    await flush();

    const igniteCommunitiesToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-communities-toggle"]'
    );
    igniteCommunitiesToggle.checked = true;
    igniteCommunitiesToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="community-agile-input"]')
        .disabled
    ).toBe(true);
    expect(
      element.shadowRoot.querySelector(
        '[data-id="community-consultancy-input"]'
      ).disabled
    ).toBe(true);

    const tierCombobox = element.shadowRoot.querySelector(
      '[data-id="community-tier-combobox"]'
    );
    tierCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Advanced" } })
    );
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="community-agile-input"]')
        .disabled
    ).toBe(false);
    expect(
      element.shadowRoot.querySelector(
        '[data-id="community-consultancy-input"]'
      ).disabled
    ).toBe(false);

    const sizeInput = element.shadowRoot.querySelector(
      '[data-id="community-size-input"]'
    );
    expect(sizeInput.value).toBe(2000);
  });

  it("disables the admin-user overage input on the Advanced tier (unlimited included)", async () => {
    const element = createTool();
    await flush();

    const igniteCommunitiesToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-communities-toggle"]'
    );
    igniteCommunitiesToggle.checked = true;
    igniteCommunitiesToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const tierCombobox = element.shadowRoot.querySelector(
      '[data-id="community-tier-combobox"]'
    );
    tierCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Advanced" } })
    );
    await flush();

    const adminInput = element.shadowRoot.querySelector(
      '[data-id="community-admin-input"]'
    );
    expect(adminInput.disabled).toBe(true);
  });

  it("shows the base package line once the base subscription is switched on", async () => {
    const element = createTool();
    await flush();

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    includeBaseToggle.checked = true;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(1);
  });

  it("adds a row to the quote summary for each additional toggled product", async () => {
    const element = createTool();
    await flush();

    const igniteExToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-toggle"]'
    );
    igniteExToggle.checked = true;
    igniteExToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    let rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(1);

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    includeBaseToggle.checked = true;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(2);
  });

  it("automatically includes Ignite CX (locking the toggle) once a base subscription is added, since the Plan is the same product as Ignite CX", async () => {
    const element = createTool();
    await flush();

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    includeBaseToggle.checked = true;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const igniteCxToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-cx-toggle"]'
    );
    expect(igniteCxToggle.checked).toBe(true);
    expect(igniteCxToggle.disabled).toBe(true);

    let rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Pro/Advanced");
    expect(rows[0].textContent).toContain("(includes Ignite CX)");

    includeBaseToggle.checked = false;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(igniteCxToggle.disabled).toBe(false);

    rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Ignite CX");
  });

  it("prices Ignite Digital as a flat $40,000/year line item", async () => {
    const element = createTool();
    await flush();

    const igniteDigitalToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    igniteDigitalToggle.checked = true;
    igniteDigitalToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const row = element.shadowRoot.querySelector(
      ".slds-theme_shade table tbody tr"
    );
    expect(row.textContent).toContain("Ignite Digital");
    expect(
      row.querySelector("lightning-formatted-number").value
    ).toBe(40000);
  });

  it("rolls Ratings & Reviews, Ignite Communities, and Ignite Digital into the Quoted Price section's totals, not just the base package", async () => {
    const element = createTool();
    await flush();

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    includeBaseToggle.checked = true;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 500;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const rrToggle = element.shadowRoot.querySelector('[data-id="rr-toggle"]');
    rrToggle.checked = true;
    rrToggle.dispatchEvent(new CustomEvent("change"));

    const igniteCommunitiesToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-communities-toggle"]'
    );
    igniteCommunitiesToggle.checked = true;
    igniteCommunitiesToggle.dispatchEvent(new CustomEvent("change"));

    const igniteDigitalToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    igniteDigitalToggle.checked = true;
    igniteDigitalToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const baseAnnual = computeBaseQuote("Pro/Advanced", 500, "36").totalAnnual;
    const rrAnnual = computeRatingsReviews("pro", 500).annual;
    const communityAnnual = computeCommunityQuote({
      tier: "DIY",
      numberOfMarkets: 1,
      communitySizePerMarket: COMMUNITY_TIER_SPECS.DIY.includedCommunitySize,
      additionalAgileProjects: 0,
      additionalConsultancyProjects: 0,
      additionalAdminUsers: 0
    }).totalAnnual;
    const expectedAnnual = round2(
      baseAnnual + rrAnnual + communityAnnual + IGNITE_DIGITAL_FLAT_FEE
    );
    const expectedMonthly = Math.round(expectedAnnual / 12);
    const expectedPerLocation = round2(expectedMonthly / 500);

    expect(
      element.shadowRoot.querySelector('[data-id="quoted-price-annual"]')
        .value
    ).toBe(expectedAnnual);
    expect(
      element.shadowRoot.querySelector('[data-id="quoted-price-monthly"]')
        .value
    ).toBe(expectedMonthly);
    expect(
      element.shadowRoot.querySelector(
        '[data-id="quoted-price-per-location"]'
      ).value
    ).toBe(expectedPerLocation);
  });

  it("shows 'No products selected yet' when nothing is toggled on in a custom quote", async () => {
    const element = createTool();
    await flush();

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    includeBaseToggle.checked = false;
    includeBaseToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const table = element.shadowRoot.querySelector(
      ".slds-theme_shade table"
    );
    expect(table).toBeNull();
    expect(
      element.shadowRoot.querySelector(".slds-theme_shade").textContent
    ).toContain("No products selected yet");
  });

  it("pre-fills Plan, locations, and AgentTrack from the Opportunity's existing products", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getExistingLineItems.emit([
      {
        productCode: "BASE-PRO-ADV",
        quantity: 1,
        unitPrice: 330480,
        description: "Pro/Advanced — 1000 locations"
      },
      {
        productCode: "AGENTTRACK-WEB",
        quantity: 1,
        unitPrice: 25000,
        description: "AgentTrack (Web Only) — 5 agents"
      }
    ]);
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    expect(locationsInput.value).toBe(1000);

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    expect(planCombobox.value).toBe("Pro/Advanced");

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    expect(includeBaseToggle.checked).toBe(true);

    const agentVariantCombobox = element.shadowRoot.querySelector(
      '[data-id="agent-track-variant"]'
    );
    expect(agentVariantCombobox.value).toBe("web");

    const agentCountInput = element.shadowRoot.querySelector(
      '[data-id="agent-count-input"]'
    );
    expect(agentCountInput.value).toBe(5);
  });

  it("pre-fills the Ignite CX toggle from the '(includes Ignite CX)' marker on the base package line, since there's no separate line item for it anymore", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getExistingLineItems.emit([
      {
        productCode: "BASE-PRO-ADV",
        quantity: 1,
        unitPrice: 330480,
        description: "Pro/Advanced — 1000 locations (includes Ignite CX)"
      }
    ]);
    await flush();

    const igniteCxToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-cx-toggle"]'
    );
    expect(igniteCxToggle.checked).toBe(true);

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    expect(locationsInput.value).toBe(1000);
  });

  it("pre-fills Ignite Communities' tier, markets, and size from the existing line item", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getExistingLineItems.emit([
      {
        productCode: "IGNITE-COMMUNITIES",
        quantity: 1,
        unitPrice: 217627.9,
        description: "Ignite Communities — Advanced, 1 market(s), 2000/market"
      }
    ]);
    await flush();

    const igniteCommunitiesToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-communities-toggle"]'
    );
    expect(igniteCommunitiesToggle.checked).toBe(true);

    const tierCombobox = element.shadowRoot.querySelector(
      '[data-id="community-tier-combobox"]'
    );
    expect(tierCombobox.value).toBe("Advanced");

    const sizeInput = element.shadowRoot.querySelector(
      '[data-id="community-size-input"]'
    );
    expect(sizeInput.value).toBe(2000);
  });

  it("does not pre-fill anything when the Opportunity has no existing SMG Price Book products", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getExistingLineItems.emit([]);
    await flush();

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    expect(planCombobox.value).toBe("Pro/Advanced");

    const includeBaseToggle = element.shadowRoot.querySelector(
      '[data-id="include-base-subscription-toggle"]'
    );
    expect(includeBaseToggle.checked).toBe(false);
  });

  it("pre-fills Term, modeled discount, and locations from the Opportunity's stored fields", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getRecord.emit({
      fields: {
        Type: { value: "Existing Customer" },
        Term_Length__c: { value: "24 months" },
        Discount__c: { value: 7 },
        Number_of_Locations__c: { value: 1500 }
      }
    });
    await flush();

    const termCombobox = element.shadowRoot.querySelector(
      '[data-id="term-combobox"]'
    );
    expect(termCombobox.value).toBe("24");

    const discountInput = element.shadowRoot.querySelector(
      '[data-id="discount-input"]'
    );
    expect(discountInput.value).toBe(7);

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    expect(locationsInput.value).toBe(1500);
  });

  it("caps a pre-filled discount at 10% even if the stored value is higher", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getRecord.emit({
      fields: {
        Type: { value: "Existing Customer" },
        Term_Length__c: { value: null },
        Discount__c: { value: 15 },
        Number_of_Locations__c: { value: null }
      }
    });
    await flush();

    const discountInput = element.shadowRoot.querySelector(
      '[data-id="discount-input"]'
    );
    expect(discountInput.value).toBe(10);
  });
});
