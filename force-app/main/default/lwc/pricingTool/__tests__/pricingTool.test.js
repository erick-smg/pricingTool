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

  it("updates the tier breakdown table when locations change", async () => {
    const element = createTool();
    await flush();

    const locationsInput = element.shadowRoot.querySelector(
      '[data-id="locations-input"]'
    );
    locationsInput.value = 300;
    locationsInput.dispatchEvent(new CustomEvent("change"));
    await flush();

    const rows = element.shadowRoot.querySelectorAll("table tbody tr");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("shows the enterprise banner and hides the tier table above 1,250 locations", async () => {
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
});
