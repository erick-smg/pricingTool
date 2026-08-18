import { exportQuoteToPowerPoint } from "c/pptxExport";

function sampleQuote(overrides = {}) {
  return {
    locations: 500,
    serviceTier: "Advanced",
    termLabel: "36 months (standard)",
    discountPercent: 0,
    lines: [
      { description: "Ignite Platform (Advanced) — 500 locations", totalPrice: 148500, isOneTime: false },
      { description: "Setup fee", totalPrice: 10000, isOneTime: true }
    ],
    recurringTotal: 148500,
    grandTotal: 158500,
    fileName: "Test Quote.pptx",
    ...overrides
  };
}

describe("exportQuoteToPowerPoint", () => {
  let createObjectURLMock;
  let revokeObjectURLMock;
  let clickMock;
  let blobPartsByCall;
  const OriginalBlob = global.Blob;

  beforeEach(() => {
    createObjectURLMock = jest.fn(() => "blob:mock-url");
    revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;
    clickMock = jest.fn();
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        el.click = clickMock;
      }
      return el;
    });

    // jsdom's Blob doesn't implement arrayBuffer()/text() - capture the raw parts passed to
    // the constructor instead of trying to read the Blob back out.
    blobPartsByCall = [];
    global.Blob = jest.fn(function (parts, options) {
      blobPartsByCall.push(parts);
      return new OriginalBlob(parts, options);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.Blob = OriginalBlob;
  });

  it("triggers a download with a .pptx filename", () => {
    exportQuoteToPowerPoint(sampleQuote());

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blob = createObjectURLMock.mock.calls[0][0];
    // application/octet-stream, not the real OOXML MIME type - Lightning Web Security only
    // allows Blob() a small allowlist of types, and the .pptx extension on the download
    // attribute (not this declared type) is what drives how the file opens.
    expect(blob.type).toBe("application/octet-stream");
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");
  });

  it("falls back to a default filename when none is provided", () => {
    exportQuoteToPowerPoint(sampleQuote({ fileName: undefined }));

    const anchorCreateCall = document.createElement.mock.results.find(
      (result) => result.value.tagName === "A"
    );
    expect(anchorCreateCall.value.download).toBe("SMG Pricing Quote.pptx");
  });

  it("produces a well-formed ZIP (starts with the PK local-file-header signature)", () => {
    exportQuoteToPowerPoint(sampleQuote());

    const bytes = blobPartsByCall[0][0];
    expect(bytes[0]).toBe(0x50); // "P"
    expect(bytes[1]).toBe(0x4b); // "K"
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it("does not throw when there are no line items", () => {
    expect(() =>
      exportQuoteToPowerPoint(sampleQuote({ lines: [] }))
    ).not.toThrow();
  });
});
