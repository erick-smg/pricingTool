/**
 * Builds a one-slide PowerPoint (.pptx) file summarizing a quote and triggers a browser
 * download - no third-party library, no Salesforce Static Resource. A .pptx is just a ZIP of
 * OOXML parts, and a ZIP is valid with "store" (uncompressed) entries - both are simple enough
 * to hand-roll, which sidesteps having to vendor a library into this org (LWC can't do bare
 * npm imports at runtime; a real library would need a Static Resource + loadScript).
 *
 * No LWC/Apex dependencies here by design - keep this file plain, importable, and
 * unit-testable in isolation, same as pricingEngine.js.
 */

const EMU_PER_INCH = 914400;
const SLIDE_W_IN = 13.333;
const SLIDE_H_IN = 7.5;

function emu(inches) {
  return Math.round(inches * EMU_PER_INCH);
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatCurrency(value) {
  const rounded = Math.round(Number(value) || 0);
  return `$${rounded.toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// DrawingML fragment builders
// ---------------------------------------------------------------------------

function run(text, { size = 1200, bold = false, italic = false, color = "211F1B" } = {}) {
  return (
    `<a:r><a:rPr lang="en-US" sz="${size}" b="${bold ? 1 : 0}" i="${italic ? 1 : 0}">` +
    `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` +
    `<a:latin typeface="Calibri"/></a:rPr><a:t>${xmlEscape(text)}</a:t></a:r>`
  );
}

function paragraph(runsXml, { align = "l" } = {}) {
  return `<a:p><a:pPr algn="${align}"/>${runsXml}</a:p>`;
}

function textBox(id, xIn, yIn, wIn, hIn, paragraphsXml, { anchor = "ctr" } = {}) {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="TextBox ${id}"/>` +
    `<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${emu(xIn)}" y="${emu(yIn)}"/><a:ext cx="${emu(wIn)}" cy="${emu(hIn)}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr>` +
    `<a:lstStyle/>${paragraphsXml}</p:txBody></p:sp>`
  );
}

function fillXml(fill) {
  if (fill.gradient) {
    const stops = fill.gradient
      .map(
        (color, i) =>
          `<a:gs pos="${Math.round((i / (fill.gradient.length - 1)) * 100000)}"><a:srgbClr val="${color}"/></a:gs>`
      )
      .join("");
    return `<a:gradFill rotWithShape="1"><a:gsLst>${stops}</a:gsLst><a:lin ang="0" scaled="1"/></a:gradFill>`;
  }
  return `<a:solidFill><a:srgbClr val="${fill.color}"/></a:solidFill>`;
}

function shape(id, prst, xIn, yIn, wIn, hIn, fill, { lineColor = null, lineWidthIn = 0 } = {}) {
  const lineXml = lineColor
    ? `<a:ln w="${Math.round(lineWidthIn * 12700)}"><a:solidFill><a:srgbClr val="${lineColor}"/></a:solidFill></a:ln>`
    : `<a:ln><a:noFill/></a:ln>`;
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Shape ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${emu(xIn)}" y="${emu(yIn)}"/><a:ext cx="${emu(wIn)}" cy="${emu(hIn)}"/></a:xfrm>` +
    `<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fillXml(fill)}${lineXml}</p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
  );
}

function summaryRow(nextId, xIn, yIn, wIn, label, value, bgColor, accentColor) {
  return [
    shape(nextId(), "roundRect", xIn, yIn, wIn, 0.5, { color: bgColor }),
    shape(nextId(), "ellipse", xIn + 0.22, yIn + 0.12, 0.26, 0.26, { color: accentColor }),
    textBox(
      nextId(),
      xIn + 0.22,
      yIn + 0.12,
      0.26,
      0.26,
      paragraph(run("+", { size: 1400, bold: true, color: "FFFFFF" }), { align: "ctr" })
    ),
    textBox(
      nextId(),
      xIn + 0.62,
      yIn,
      wIn * 0.55,
      0.5,
      paragraph(run(label, { size: 1300, bold: true, color: accentColor }))
    ),
    textBox(
      nextId(),
      xIn + wIn * 0.55,
      yIn,
      wIn * 0.42,
      0.5,
      paragraph(run(value, { size: 1500, bold: true, color: accentColor }), { align: "r" })
    )
  ];
}

function buildSlideXml(data) {
  let idCounter = 1;
  const nextId = () => ++idCounter;
  const shapes = [];

  // Top gradient bar.
  shapes.push(
    shape(nextId(), "rect", 0, 0, SLIDE_W_IN, 0.09, {
      gradient: ["1E4FD8", "8A3FFC", "D6249F"]
    })
  );

  // "PRICING" title.
  shapes.push(
    textBox(
      nextId(),
      0.5,
      0.16,
      7.5,
      0.95,
      paragraph(run("PRICING", { size: 4000, bold: true, color: "D9D9D9" })),
      { anchor: "t" }
    )
  );

  // SMG badge.
  shapes.push(shape(nextId(), "ellipse", 12.35, 0.28, 0.55, 0.55, { color: "1E4FD8" }));
  shapes.push(
    textBox(
      nextId(),
      12.35,
      0.28,
      0.55,
      0.55,
      paragraph(run("smg", { size: 1300, bold: true, color: "FFFFFF" }), { align: "ctr" })
    )
  );

  // Section header + quote context.
  const subtitleParts = [
    `${Number(data.locations || 0).toLocaleString()} locations`,
    data.serviceTier,
    data.termLabel
  ].filter(Boolean);
  if (Number(data.discountPercent) > 0) {
    subtitleParts.push(`${data.discountPercent}% discount`);
  }
  shapes.push(
    textBox(
      nextId(),
      0.5,
      1.18,
      12.3,
      0.4,
      paragraph(
        run("QUOTE SUMMARY   ", { size: 1500, bold: true, color: "2F6F62" }) +
          run(subtitleParts.join("  ·  ").toUpperCase(), {
            size: 1000,
            bold: false,
            color: "6B6259"
          })
      )
    )
  );

  // Line-items card.
  const cardX = 0.5;
  const cardY = 1.7;
  const cardW = 12.33;
  const headerH = 0.5;
  const items = data.lines || [];
  const maxBodyH = 4.55;
  const rawRowH = maxBodyH / Math.max(items.length, 1);
  const rowH = Math.max(0.28, Math.min(0.44, rawRowH));
  const fontSz = rowH >= 0.38 ? 1200 : rowH >= 0.32 ? 1100 : 1000;
  const cardH = headerH + rowH * items.length + 0.12;

  shapes.push(
    shape(nextId(), "roundRect", cardX, cardY, cardW, cardH, { color: "FFFFFF" }, {
      lineColor: "DDD7CC",
      lineWidthIn: 0.01
    })
  );
  shapes.push(shape(nextId(), "ellipse", cardX + 0.22, cardY + 0.12, 0.26, 0.26, { color: "1E4FD8" }));
  shapes.push(
    textBox(
      nextId(),
      cardX + 0.22,
      cardY + 0.12,
      0.26,
      0.26,
      paragraph(run("-", { size: 1400, bold: true, color: "FFFFFF" }), { align: "ctr" })
    )
  );
  shapes.push(
    textBox(
      nextId(),
      cardX + 0.62,
      cardY + 0.08,
      8,
      0.34,
      paragraph(run("FINAL QUOTE — LINE ITEMS", { size: 1300, bold: true, color: "1E4FD8" }))
    )
  );

  items.forEach((line, i) => {
    const rowY = cardY + headerH + i * rowH;
    const labelRuns =
      run(line.description, { size: fontSz, bold: true, color: "211F1B" }) +
      (line.isOneTime
        ? run("  (one-time)", { size: Math.max(800, fontSz - 100), italic: true, color: "6B6259" })
        : "");
    shapes.push(textBox(nextId(), cardX + 0.3, rowY, cardW * 0.66, rowH, paragraph(labelRuns)));
    shapes.push(
      textBox(
        nextId(),
        cardX + cardW * 0.68,
        rowY,
        cardW * 0.29,
        rowH,
        paragraph(run(formatCurrency(line.totalPrice), { size: fontSz, bold: true, color: "211F1B" }), {
          align: "r"
        })
      )
    );
    if (i < items.length - 1) {
      shapes.push(shape(nextId(), "rect", cardX + 0.25, rowY + rowH - 0.005, cardW - 0.5, 0.01, { color: "DDD7CC" }));
    }
  });

  // Summary rows.
  const sumY = cardY + cardH + 0.22;
  shapes.push(
    ...summaryRow(nextId, cardX, sumY, cardW, "RECURRING ANNUAL", formatCurrency(data.recurringTotal), "EFECE5", "2F6F62")
  );
  const grandLabel = Number(data.discountPercent) > 0 ? "GRAND TOTAL (DISCOUNTED, YEAR 1)" : "GRAND TOTAL (YEAR 1)";
  shapes.push(
    ...summaryRow(nextId, cardX, sumY + 0.64, cardW, grandLabel, formatCurrency(data.grandTotal), "E4EFEC", "2F6F62")
  );

  // Footer.
  const year = new Date().getFullYear();
  shapes.push(
    textBox(
      nextId(),
      0.5,
      SLIDE_H_IN - 0.42,
      8,
      0.3,
      paragraph(
        run(`© ${year} Service Management Group | Confidential | All rights reserved`, {
          size: 900,
          color: "6B6259"
        })
      )
    )
  );
  shapes.push(shape(nextId(), "roundRect", SLIDE_W_IN - 0.9, SLIDE_H_IN - 0.55, 0.5, 0.34, { color: "1E4FD8" }));
  shapes.push(
    textBox(
      nextId(),
      SLIDE_W_IN - 0.9,
      SLIDE_H_IN - 0.55,
      0.5,
      0.34,
      paragraph(run("1", { size: 1100, bold: true, color: "FFFFFF" }), { align: "ctr" })
    )
  );

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F7F5F1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` +
    `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    shapes.join("") +
    `</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}

// ---------------------------------------------------------------------------
// Static OOXML package parts - boilerplate PowerPoint expects around the slide itself.
// ---------------------------------------------------------------------------

const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
  `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>` +
  `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>` +
  `<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>` +
  `<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
  `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
  `</Types>`;

const ROOT_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
  `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>` +
  `</Relationships>`;

const PRESENTATION_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
  `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
  `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
  `<p:sldSz cx="${emu(SLIDE_W_IN)}" cy="${emu(SLIDE_H_IN)}"/>` +
  `<p:notesSz cx="6858000" cy="9144000"/>` +
  `</p:presentation>`;

const PRESENTATION_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>` +
  `</Relationships>`;

const THEME_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="SMG Pricing">` +
  `<a:themeElements>` +
  `<a:clrScheme name="SMG">` +
  `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
  `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="211F1B"/></a:dk2>` +
  `<a:lt2><a:srgbClr val="EFECE5"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="2F6F62"/></a:accent1>` +
  `<a:accent2><a:srgbClr val="1E4FD8"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="8A3FFC"/></a:accent3>` +
  `<a:accent4><a:srgbClr val="D6249F"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="9A6E28"/></a:accent5>` +
  `<a:accent6><a:srgbClr val="6B6259"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="2F6F62"/></a:hlink>` +
  `<a:folHlink><a:srgbClr val="8A3FFC"/></a:folHlink>` +
  `</a:clrScheme>` +
  `<a:fontScheme name="SMG">` +
  `<a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
  `<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
  `</a:fontScheme>` +
  `<a:fmtScheme name="SMG">` +
  `<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>` +
  `<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>` +
  `<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>` +
  `<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>` +
  `</a:fmtScheme>` +
  `</a:themeElements>` +
  `</a:theme>`;

const SLIDE_MASTER_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
  `<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>` +
  `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
  `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>` +
  `<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>` +
  `</p:sldMaster>`;

const SLIDE_MASTER_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>` +
  `</Relationships>`;

const SLIDE_LAYOUT_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">` +
  `<p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>` +
  `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
  `</p:sldLayout>`;

const SLIDE_LAYOUT_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

const SLIDE_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `</Relationships>`;

function coreXml() {
  const now = new Date().toISOString();
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>SMG Pricing Quote</dc:title>` +
    `<dc:creator>SMG Pricing Tool</dc:creator>` +
    `<cp:lastModifiedBy>SMG Pricing Tool</cp:lastModifiedBy>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>` +
    `</cp:coreProperties>`
  );
}

const APP_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
  `<Application>SMG Pricing Tool</Application>` +
  `<PresentationFormat>Widescreen</PresentationFormat>` +
  `<Slides>1</Slides>` +
  `</Properties>`;

// ---------------------------------------------------------------------------
// Minimal ZIP writer (store method only - no compression needed for a valid ZIP/OOXML file)
// ---------------------------------------------------------------------------

let crcTable = null;

function getCrcTable() {
  if (crcTable) {
    return crcTable;
  }
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  crcTable = table;
  return table;
}

function crc32(bytes) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

// Hand-rolled UTF-8 encoder rather than relying on a global TextEncoder - it isn't guaranteed
// present in every environment this file might run under (e.g. this repo's Jest/jsdom setup
// doesn't expose one), and the XML content here does include non-ASCII characters (em dashes,
// the copyright mark, middot separators).
function stringToBytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i);
    if (code > 0xffff) {
      i++; // this code point was a surrogate pair - skip its second UTF-16 unit
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

function concatBytes(arrays) {
  let total = 0;
  for (const arr of arrays) {
    total += arr.length;
  }
  const result = new Uint8Array(total);
  let pos = 0;
  for (const arr of arrays) {
    result.set(arr, pos);
    pos += arr.length;
  }
  return result;
}

// 1980-01-01, 00:00:00 - the minimum valid DOS date/time; the exact timestamp doesn't matter
// for a generated-on-demand file like this one.
const DOS_TIME = 0;
const DOS_DATE = 0x21;

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = stringToBytes(file.name);
    const data = file.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20), ...u16(0), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0)
    ]);
    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02,
      ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset)
    ]);
    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);

  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralSize), ...u32(centralStart),
    ...u16(0)
  ]);

  return concatBytes([...localParts, ...centralParts, eocd]);
}

/**
 * Builds a one-slide .pptx summarizing the quote and downloads it. `data` shape:
 * { locations, serviceTier, termLabel, discountPercent, lines: [{description, totalPrice,
 * isOneTime}], recurringTotal, grandTotal, fileName }.
 */
export function exportQuoteToPowerPoint(data) {
  const files = [
    { name: "[Content_Types].xml", data: stringToBytes(CONTENT_TYPES_XML) },
    { name: "_rels/.rels", data: stringToBytes(ROOT_RELS_XML) },
    { name: "docProps/core.xml", data: stringToBytes(coreXml()) },
    { name: "docProps/app.xml", data: stringToBytes(APP_XML) },
    { name: "ppt/presentation.xml", data: stringToBytes(PRESENTATION_XML) },
    { name: "ppt/_rels/presentation.xml.rels", data: stringToBytes(PRESENTATION_RELS_XML) },
    { name: "ppt/theme/theme1.xml", data: stringToBytes(THEME_XML) },
    { name: "ppt/slideMasters/slideMaster1.xml", data: stringToBytes(SLIDE_MASTER_XML) },
    { name: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: stringToBytes(SLIDE_MASTER_RELS_XML) },
    { name: "ppt/slideLayouts/slideLayout1.xml", data: stringToBytes(SLIDE_LAYOUT_XML) },
    { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: stringToBytes(SLIDE_LAYOUT_RELS_XML) },
    { name: "ppt/slides/slide1.xml", data: stringToBytes(buildSlideXml(data)) },
    { name: "ppt/slides/_rels/slide1.xml.rels", data: stringToBytes(SLIDE_RELS_XML) }
  ];

  const zipBytes = buildZip(files);
  // Lightning Web Security only allows Blob() to be constructed with a small allowlist of
  // MIME types, and the real OOXML presentation type isn't on it ("Unsupported MIME type").
  // application/octet-stream is on the allowlist - the .pptx extension on the download
  // attribute below is what actually drives how the OS/PowerPoint open the saved file, not
  // this declared type.
  const blob = new Blob([zipBytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  // Deliberately not inserted into document.body - every current browser fires a download
  // from a detached <a download> on .click(), and under Salesforce's Lightning Web Security
  // sandboxing, reaching into the global document.body from outside the component that owns
  // it is exactly the kind of cross-realm DOM touch that tends to surface as an opaque
  // "Script error." in the console instead of a real, catchable error.
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = data.fileName || "SMG Pricing Quote.pptx";
  anchor.click();
  URL.revokeObjectURL(url);
}
