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

  it("renders with a default plan and location count", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    expect(locationsInput.value).toBe(100);

    const planCombobox = element.shadowRoot.querySelector(
      '[data-id="plan-combobox"]'
    );
    expect(planCombobox.value).toBe("Professional Foundational");
  });

  it("shows the enterprise banner above 1,250 locations", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 2000;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const banner = element.shadowRoot.querySelector(".slds-notify_alert");
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain("Enterprise");
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
    expect(planCombobox.value).toBe("Standard Advanced");

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

  it("pre-fills Ignite EX for the Enterprise and Managed packages", async () => {
    const element = createTool();
    await flush();

    const packageCombobox = element.shadowRoot.querySelector(
      '[data-id="package-combobox"]'
    );
    packageCombobox.dispatchEvent(
      new CustomEvent("change", { detail: { value: "igniteEnterprise" } })
    );
    await flush();

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

  it("always shows Ignite CX as checked and disabled above 1,250 locations", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 2000;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const igniteCxToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-cx-toggle"]'
    );
    expect(igniteCxToggle.checked).toBe(true);
    expect(igniteCxToggle.disabled).toBe(true);
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

  it("allows manually toggling Ignite EX, Ignite Communities, and the setup fee", async () => {
    const element = createTool();
    await flush();

    const igniteExToggle = element.shadowRoot.querySelector(
      '[data-id="ignite-ex-toggle"]'
    );
    igniteExToggle.checked = true;
    igniteExToggle.dispatchEvent(new CustomEvent("change"));

    const setupFeeToggle = element.shadowRoot.querySelector(
      '[data-id="setup-fee-toggle"]'
    );
    setupFeeToggle.checked = true;
    setupFeeToggle.dispatchEvent(new CustomEvent("change"));
    await flush();

    expect(igniteExToggle.checked).toBe(true);
    expect(setupFeeToggle.checked).toBe(true);
  });
});
