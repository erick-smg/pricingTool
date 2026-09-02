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
import { exportQuoteToPowerPoint } from "c/pptxExport";

jest.mock("c/pptxExport", () => ({
  exportQuoteToPowerPoint: jest.fn()
}));

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

  it("renders with a default service tier, term, and location count", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    expect(locationsInput.value).toBe(0);

    const serviceTierCombobox = element.shadowRoot.querySelector(
      '[data-id="service-tier-combobox"]'
    );
    expect(serviceTierCombobox.value).toBe("Foundational");
    expect(
      serviceTierCombobox.options.map((option) => option.value)
    ).toEqual(["Foundational", "Advanced", "Elite"]);

    const termCombobox = element.shadowRoot.querySelector(
      '[data-id="term-combobox"]'
    );
    expect(termCombobox.value).toBe("36");
  });

  it("links to the seller guide in a new tab, by relative path so it resolves per-org", async () => {
    const element = createTool();
    await flush();

    const link = element.shadowRoot.querySelector(
      '[data-id="seller-guide-link"]'
    );
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe(
      "/lightning/r/ContentDocument/069Ud00000idtptIAA/view"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("keeps the Service Tier combobox visible at every location count, including above 5,000", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 6000;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="service-tier-combobox"]')
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

  it("prices the Elite service tier off its own rate card (no more $0/TBD placeholder)", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 500;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const serviceTierCombobox = element.shadowRoot.querySelector(
      '[data-id="service-tier-combobox"]'
    );
    serviceTierCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Elite" } })
    );
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="quoted-price-annual"]')
        .value
    ).toBe(computeBaseQuote("Elite", 500, "36").totalAnnual);
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

  it("reveals Agent Experience and the Number of Agents band picklist once AgentTrack is checked", async () => {
    const element = createTool();
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="agent-count-band-combobox"]')
    ).toBeNull();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="agent-track-toggle"]'
    );
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const bandCombobox = element.shadowRoot.querySelector(
      '[data-id="agent-count-band-combobox"]'
    );
    expect(bandCombobox).not.toBeNull();
    expect(bandCombobox.value).toBe("0-60");
    expect(bandCombobox.options.map((option) => option.value)).toEqual([
      "0-60",
      "60-100",
      "100-200"
    ]);
  });

  it("reveals the Reputation Management tier and extras once toggled on", async () => {
    const element = createTool();
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="rr-tier-radio-group"]')
    ).toBeNull();

    const toggle = element.shadowRoot.querySelector('[data-id="rr-toggle"]');
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const tierGroup = element.shadowRoot.querySelector(
      '[data-id="rr-tier-radio-group"]'
    );
    expect(tierGroup).not.toBeNull();

    const extrasGroup = element.shadowRoot.querySelector(
      '[data-id="reputation-extras"]'
    );
    expect(extrasGroup).not.toBeNull();
    expect(extrasGroup.options.map((option) => option.value)).toEqual([
      "listingsManagement",
      "localPages"
    ]);
  });

  it("reveals the Ignite EX item checklist once toggled on, and a Pulse quantity input once Pulse is selected", async () => {
    const element = createTool();
    await flush();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-toggle"]'
    );
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const itemsGroup = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-items"]'
    );
    expect(itemsGroup).not.toBeNull();
    expect(
      element.shadowRoot.querySelector('[data-id="ignite-ex-pulse-quantity"]')
    ).toBeNull();

    itemsGroup.dispatchEvent(
      new CustomEvent("change", { detail: { value: ["pulse"] } })
    );
    await flush();

    const pulseInput = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-pulse-quantity"]'
    );
    expect(pulseInput).not.toBeNull();

    pulseInput.value = 2;
    pulseInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    // Pulse = $20,000 + $5,000 agile-analysis fee = $25,000 each, one-time.
    expect(
      element.shadowRoot.querySelector('[data-id="quoted-price-annual"]')
    ).not.toBeNull();
    const rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    const pulseRow = Array.from(rows).find((row) =>
      row.textContent.includes("Pulse")
    );
    expect(pulseRow).not.toBeUndefined();
    expect(pulseRow.textContent).toContain("(one-time)");
    expect(
      pulseRow.querySelector("lightning-formatted-number").value
    ).toBe(50000);
  });

  it("reveals Ignite Digital's extras checklist once toggled on", async () => {
    const element = createTool();
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="ignite-digital-extras"]')
    ).toBeNull();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const extrasGroup = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-extras"]'
    );
    expect(extrasGroup).not.toBeNull();
    expect(extrasGroup.options.map((option) => option.value)).toEqual([
      "mouseflowConfig",
      "contactUs"
    ]);
  });

  it("prices Mouseflow Config by its own tier and Contact Us (Inform) as a flat $30,000/year, each as its own line item", async () => {
    const element = createTool();
    await flush();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const extrasGroup = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-extras"]'
    );
    extrasGroup.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: ["mouseflowConfig", "contactUs"] }
      })
    );
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    const mouseflowRow = Array.from(rows).find((row) =>
      row.textContent.includes("Mouseflow Config")
    );
    const contactUsRow = Array.from(rows).find((row) =>
      row.textContent.includes("Contact Us")
    );
    // Essential is Mouseflow Config's default tier -> $45,000.
    expect(
      mouseflowRow.querySelector("lightning-formatted-number").value
    ).toBe(45000);
    expect(
      contactUsRow.querySelector("lightning-formatted-number").value
    ).toBe(30000);
  });

  it("reveals the Mouseflow Config tier picker only once Mouseflow is selected, and re-prices independently of Service Tier", async () => {
    const element = createTool();
    await flush();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    toggle.checked = true;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="mouseflow-tier-radio-group"]')
    ).toBeNull();

    const extrasGroup = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-extras"]'
    );
    extrasGroup.dispatchEvent(
      new CustomEvent("change", { detail: { value: ["mouseflowConfig"] } })
    );
    await flush();

    const tierGroup = element.shadowRoot.querySelector(
      '[data-id="mouseflow-tier-radio-group"]'
    );
    expect(tierGroup).not.toBeNull();
    expect(tierGroup.value).toBe("Essential");
    expect(tierGroup.options.map((option) => option.value)).toEqual([
      "Essential",
      "Advanced",
      "Elite"
    ]);

    // Switching the quote's Service Tier must NOT affect Mouseflow's price.
    const serviceTierCombobox = element.shadowRoot.querySelector(
      '[data-id="service-tier-combobox"]'
    );
    serviceTierCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Elite" } })
    );
    await flush();

    let mouseflowRow = Array.from(
      element.shadowRoot.querySelectorAll(".slds-theme_shade table tbody tr")
    ).find((row) => row.textContent.includes("Mouseflow Config"));
    expect(
      mouseflowRow.querySelector("lightning-formatted-number").value
    ).toBe(45000);

    // Switching Mouseflow's own tier does re-price it.
    tierGroup.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Elite" } })
    );
    await flush();

    mouseflowRow = Array.from(
      element.shadowRoot.querySelectorAll(".slds-theme_shade table tbody tr")
    ).find((row) => row.textContent.includes("Mouseflow Config"));
    expect(
      mouseflowRow.querySelector("lightning-formatted-number").value
    ).toBe(110000);
  });

  it("prices Add'l Surveys at a flat $30,000/survey, revealing the survey type checklist only once a quantity is entered", async () => {
    const element = createTool();
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="additional-survey-types"]')
    ).toBeNull();

    const qtyInput = element.shadowRoot.querySelector(
      '[data-field="additionalSurveys"]'
    );
    qtyInput.value = 2;
    qtyInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const typesGroup = element.shadowRoot.querySelector(
      '[data-id="additional-survey-types"]'
    );
    expect(typesGroup).not.toBeNull();
    expect(typesGroup.options.map((option) => option.value)).toEqual([
      "postship",
      "closeTheLoop"
    ]);

    const addOnRow = Array.from(
      element.shadowRoot.querySelectorAll('[data-id="add-ons-table"] tbody tr')
    ).find((row) => row.textContent.includes("Add'l Surveys"));
    expect(addOnRow).not.toBeUndefined();
    // 2 surveys x $30,000/survey = $60,000/yr -> at the default 0 (treated as 1)
    // locations, that's $5,000/loc/mo.
    expect(
      addOnRow.querySelector("lightning-formatted-number").value
    ).toBe(5000);

    qtyInput.value = 0;
    qtyInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="additional-survey-types"]')
    ).toBeNull();
  });

  it("hides the add-ons table entirely until at least one add-on is selected", async () => {
    const element = createTool();
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="add-ons-table"]')
    ).toBeNull();

    const qtyInput = element.shadowRoot.querySelector(
      '[data-field="additionalBrands"]'
    );
    qtyInput.value = 1;
    qtyInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const table = element.shadowRoot.querySelector('[data-id="add-ons-table"]');
    expect(table).not.toBeNull();
    const rows = table.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Add'l Brands");
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

  it("labels the Case Management add-on as Case Premium", async () => {
    const element = createTool();
    await flush();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="case-management-toggle"]'
    );
    expect(toggle.label).toContain("Case Premium");
  });

  it("allows manually toggling Ignite EX, Case Premium, and the setup fee", async () => {
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

  it("requires locations before Add Products to Opportunity is enabled, since the base package is always part of the quote", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    const setupFeeToggle = element.shadowRoot.querySelector(
      '[data-id="setup-fee-toggle"]'
    );
    setupFeeToggle.checked = true;
    setupFeeToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    let addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(true);

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 500;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(false);
  });

  it("prices the base package off the selected Service Tier's rate card, and re-prices it when the tier changes", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 500;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const foundationalAnnual = computeBaseQuote(
      "Foundational",
      500,
      "36"
    ).totalAnnual;
    const foundationalMonthly = Math.round(foundationalAnnual / 12);
    const foundationalPerLocation = round2(foundationalMonthly / 500);

    let perLocationEl = element.shadowRoot.querySelector(
      '[data-id="quoted-price-per-location"]'
    );
    expect(perLocationEl.value).toBe(foundationalPerLocation);

    const serviceTierCombobox = element.shadowRoot.querySelector(
      '[data-id="service-tier-combobox"]'
    );
    serviceTierCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "Advanced" } })
    );
    await flush();

    const advancedAnnual = computeBaseQuote("Advanced", 500, "36").totalAnnual;
    const advancedMonthly = Math.round(advancedAnnual / 12);
    const advancedPerLocation = round2(advancedMonthly / 500);

    perLocationEl = element.shadowRoot.querySelector(
      '[data-id="quoted-price-per-location"]'
    );
    expect(perLocationEl.value).toBe(advancedPerLocation);
    expect(advancedPerLocation).not.toBe(foundationalPerLocation);
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

  it("always shows the base package line in the Quote Summary, even with nothing else toggled on", async () => {
    const element = createTool();
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Ignite Platform");
  });

  it("enables Export to PowerPoint whenever there's at least one line item, and hands it the current quote", async () => {
    const element = createTool();
    await flush();

    const exportButton = element.shadowRoot.querySelector(
      '[data-id="export-pptx-button"]'
    );
    expect(exportButton.disabled).toBe(false);

    exportButton.click();

    expect(exportQuoteToPowerPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        locations: 0,
        serviceTier: "Foundational",
        lines: expect.any(Array),
        recurringTotal: expect.any(Number),
        grandTotal: expect.any(Number)
      })
    );
  });

  it("adds a row to the quote summary for each additional toggled product", async () => {
    const element = createTool();
    await flush();

    let rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(1);

    const caseManagementToggle = element.shadowRoot.querySelector(
      '[data-id="case-management-toggle"]'
    );
    caseManagementToggle.checked = true;
    caseManagementToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(2);
  });

  it("adds no line item for Ignite Digital by itself - only its selected components are priced", async () => {
    const element = createTool();
    await flush();

    const rowsBefore = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    ).length;

    const igniteDigitalToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-toggle"]'
    );
    igniteDigitalToggle.checked = true;
    igniteDigitalToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const rowsAfter = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    ).length;
    expect(rowsAfter).toBe(rowsBefore);
  });

  it("rolls Reputation Management, Ignite Communities, and Ignite Digital into the Quoted Price section's totals, not just the base package", async () => {
    const element = createTool();
    await flush();

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

    const igniteDigitalExtras = element.shadowRoot.querySelector(
      '[data-id="ignite-digital-extras"]'
    );
    igniteDigitalExtras.dispatchEvent(
      new CustomEvent("change", { detail: { value: ["mouseflowConfig"] } })
    );
    await flush();

    const baseAnnual = computeBaseQuote("Foundational", 500, "36").totalAnnual;
    const rrAnnual = computeRatingsReviews("pro", 500).annual;
    const communityAnnual = computeCommunityQuote({
      tier: "DIY",
      numberOfMarkets: 1,
      communitySizePerMarket: COMMUNITY_TIER_SPECS.DIY.includedCommunitySize,
      additionalAgileProjects: 0,
      additionalConsultancyProjects: 0,
      additionalAdminUsers: 0
    }).totalAnnual;
    // Mouseflow Config defaults to its own Essential tier -> $45,000.
    const igniteDigitalAnnual = 45000;
    const expectedAnnual = round2(
      baseAnnual + rrAnnual + communityAnnual + igniteDigitalAnnual
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

  it("pre-fills Service Tier, locations, and AgentTrack from the Opportunity's existing products", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getExistingLineItems.emit([
      {
        productCode: "BASE-STD-ADV",
        quantity: 1,
        unitPrice: 330480,
        description: "Ignite Platform (Advanced) — 1000 locations"
      },
      {
        productCode: "AGENTTRACK-WEB",
        quantity: 1,
        unitPrice: 25000,
        description: "AgentTrack (Agent Experience) — 60-100 agents"
      }
    ]);
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    expect(locationsInput.value).toBe(1000);

    const serviceTierCombobox = element.shadowRoot.querySelector(
      '[data-id="service-tier-combobox"]'
    );
    expect(serviceTierCombobox.value).toBe("Advanced");

    const bandCombobox = element.shadowRoot.querySelector(
      '[data-id="agent-count-band-combobox"]'
    );
    expect(bandCombobox.value).toBe("60-100");
  });

  it("recovers the Advanced/Foundational tier from a legacy pre-rework Pro/Standard product code", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getExistingLineItems.emit([
      {
        productCode: "BASE-PRO-ADV",
        quantity: 1,
        unitPrice: 330480,
        description: "Pro/Advanced — 1000 locations"
      }
    ]);
    await flush();

    const serviceTierCombobox = element.shadowRoot.querySelector(
      '[data-id="service-tier-combobox"]'
    );
    expect(serviceTierCombobox.value).toBe("Advanced");
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

    const serviceTierCombobox = element.shadowRoot.querySelector(
      '[data-id="service-tier-combobox"]'
    );
    expect(serviceTierCombobox.value).toBe("Foundational");
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

  it("never shows the Include Base Package checkbox for a non-Expansion Opportunity, and always requires locations", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getRecord.emit({
      fields: {
        Type: { value: "New Logo" },
        Term_Length__c: { value: null },
        Discount__c: { value: null },
        Number_of_Locations__c: { value: null }
      }
    });
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="include-base-package-toggle"]')
    ).toBeNull();
    expect(
      element.shadowRoot.querySelector('[data-id="service-tier-combobox"]')
    ).not.toBeNull();

    const addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(true);
    expect(
      element.shadowRoot.querySelector(".slds-notify_alert").textContent
    ).toContain("the Ignite Platform base package");
  });

  it("lets an Expansion Opportunity exclude the base package and quote a standalone add-on with no locations required", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getRecord.emit({
      fields: {
        Type: { value: "Expansion" },
        Term_Length__c: { value: null },
        Discount__c: { value: null },
        Number_of_Locations__c: { value: null }
      }
    });
    await flush();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="include-base-package-toggle"]'
    );
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(true);

    toggle.checked = false;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(
      element.shadowRoot.querySelector('[data-id="service-tier-combobox"]')
    ).toBeNull();

    // With the base package excluded and nothing location-priced selected, locations
    // shouldn't block syncing a standalone one-time add-on.
    const caseManagementToggle = element.shadowRoot.querySelector(
      '[data-id="case-management-toggle"]'
    );
    caseManagementToggle.checked = true;
    caseManagementToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const rows = element.shadowRoot.querySelectorAll(
      ".slds-theme_shade table tbody tr"
    );
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain("Case Premium");

    const addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(false);
  });

  it("re-requires locations on an Expansion Opportunity once Reputation Management is added back in, even with the base package excluded", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getRecord.emit({
      fields: {
        Type: { value: "Expansion" },
        Term_Length__c: { value: null },
        Discount__c: { value: null },
        Number_of_Locations__c: { value: null }
      }
    });
    await flush();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="include-base-package-toggle"]'
    );
    toggle.checked = false;
    toggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const rrToggle = element.shadowRoot.querySelector('[data-id="rr-toggle"]');
    rrToggle.checked = true;
    rrToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    const addButton = element.shadowRoot.querySelector(
      '[data-id="add-products-button"]'
    );
    expect(addButton.disabled).toBe(true);
    expect(
      element.shadowRoot.querySelector(".slds-notify_alert").textContent
    ).toContain("Reputation Management");
  });

  it("rehydrates the Include Base Package checkbox as unchecked when an existing Expansion quote has no base package line", async () => {
    const element = createTool();
    element.recordId = "006000000000001AAA";
    await flush();

    getRecord.emit({
      fields: {
        Type: { value: "Expansion" },
        Term_Length__c: { value: null },
        Discount__c: { value: null },
        Number_of_Locations__c: { value: null }
      }
    });
    await flush();

    getExistingLineItems.emit([
      {
        productCode: "CASE-MANAGEMENT",
        quantity: 1,
        unitPrice: 7500,
        description: "Case Premium"
      }
    ]);
    await flush();

    const toggle = element.shadowRoot.querySelector(
      '[data-id="include-base-package-toggle"]'
    );
    expect(toggle.checked).toBe(false);
  });
});
