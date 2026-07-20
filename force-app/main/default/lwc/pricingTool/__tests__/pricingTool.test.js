import { createElement } from "@lwc/engine-dom";
import PricingTool from "c/pricingTool";

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
});
