const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "DIV",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "I",
  "IMG",
  "LI",
  "OL",
  "P",
  "S",
  "SPAN",
  "STRIKE",
  "STRONG",
  "SUB",
  "SUP",
  "TABLE",
  "TBODY",
  "TD",
  "TFOOT",
  "TH",
  "THEAD",
  "TR",
  "U",
  "UL"
]);

const DROP_WITH_CONTENT = new Set([
  "BASE",
  "BUTTON",
  "CANVAS",
  "EMBED",
  "FORM",
  "IFRAME",
  "INPUT",
  "LINK",
  "MATH",
  "META",
  "OBJECT",
  "OPTION",
  "SCRIPT",
  "SELECT",
  "SOURCE",
  "STYLE",
  "SVG",
  "TEXTAREA",
  "VIDEO",
  "AUDIO"
]);

const ALLOWED_STYLE_PROPERTIES = new Set([
  "align-items",
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "border-collapse",
  "color",
  "display",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "justify-content",
  "letter-spacing",
  "line-height",
  "list-style-position",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "object-fit",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
  "text-transform",
  "vertical-align",
  "white-space",
  "width"
]);

const BLOCK_KEYS = new Set([
  "id",
  "type",
  "content",
  "fieldApiName",
  "fieldLabel",
  "imageSrc",
  "imageAlt",
  "hasImage",
  "imageAspectRatio",
  "pdfImageSrc",
  "tableData",
  "tableCellAlignments",
  "relatedListRelationshipName",
  "relatedListLabel",
  "relatedListChildObjectApiName",
  "relatedListColumns",
  "relatedListZebraEnabled",
  "relatedListOddRowColor",
  "relatedListEvenRowColor",
  "relatedListHeaderRowColor",
  "relatedListTextColor",
  "relatedListOddTextColor",
  "relatedListEvenTextColor",
  "relatedListFontSize",
  "relatedListBorderMode",
  "styles"
]);

const STYLE_KEYS = new Set([
  "background",
  "padding",
  "borderWidth",
  "borderStyle",
  "borderColor",
  "borderRadius",
  "color",
  "colorExplicit",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "textAlign",
  "verticalAlign",
  "tableRows",
  "tableColumns",
  "tableCellPadding",
  "tableBorderWidth",
  "tableBorderColor",
  "tableCellVerticalAlign",
  "lineLength",
  "lineThickness",
  "lineStyle",
  "lineColor",
  "width",
  "widthRatio",
  "height",
  "heightManuallyResized",
  "x",
  "xRatio",
  "y",
  "relatedListTextColor",
  "relatedListFontSize"
]);

const BLOCK_TYPES = new Set([
  "text",
  "field",
  "divider",
  "image",
  "table",
  "relatedList",
  "verticalLine"
]);
const BORDER_STYLES = new Set(["none", "solid", "dashed", "dotted", "double"]);
const TEXT_ALIGNS = new Set(["left", "center", "right", "justify"]);
const VERTICAL_ALIGNS = new Set(["top", "middle", "bottom"]);
const FONT_STYLES = new Set(["normal", "italic", "oblique"]);
const FONT_WEIGHTS = new Set([
  "normal",
  "bold",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900"
]);
const RELATED_LIST_BORDERS = new Set(["none", "horizontal", "vertical", "all"]);
const SAFE_NAMED_COLORS = new Set(["transparent", "black", "white"]);
const SAFE_CLASSES = new Set(["table-cell-image"]);
const HEX_DIGITS = new Set([
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F"
]);

function ownEntries(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value)
    : [];
}

function finiteNumber(value, minimum, maximum) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function containsControlCharacters(value) {
  return Array.from(String(value || "")).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function containsWhitespace(value) {
  return Array.from(String(value || "")).some((character) => {
    return (
      character === " " ||
      character === "\n" ||
      character === "\r" ||
      character === "\t"
    );
  });
}

function isSafeBase64Payload(value) {
  return Array.from(String(value || "")).every((character) => {
    return (
      (character >= "A" && character <= "Z") ||
      (character >= "a" && character <= "z") ||
      (character >= "0" && character <= "9") ||
      character === "+" ||
      character === "/" ||
      character === "=" ||
      character === "\n" ||
      character === "\r" ||
      character === "\t" ||
      character === " "
    );
  });
}

function normalizeHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

function normalizeRelativeUrl(value) {
  return value.startsWith("/") &&
    !value.startsWith("//") &&
    !containsWhitespace(value)
    ? value
    : "";
}

function isHexColor(value) {
  if (!value.startsWith("#")) {
    return false;
  }
  const digits = value.slice(1);
  return (
    [3, 4, 6, 8].includes(digits.length) &&
    Array.from(digits).every((character) => HEX_DIGITS.has(character))
  );
}

function isCssNumericChannel(value) {
  const channel = String(value || "").trim();
  const percent = channel.endsWith("%");
  const numeric = Number(percent ? channel.slice(0, -1) : channel);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 255;
}

function isCssAlphaChannel(value) {
  const channel = String(value || "").trim();
  const percent = channel.endsWith("%");
  const numeric = Number(percent ? channel.slice(0, -1) : channel);
  return (
    Number.isFinite(numeric) && numeric >= 0 && numeric <= (percent ? 100 : 1)
  );
}

function isRgbColor(value) {
  const lowerColor = value.toLowerCase();
  const isRgb = lowerColor.startsWith("rgb(") && lowerColor.endsWith(")");
  const isRgba = lowerColor.startsWith("rgba(") && lowerColor.endsWith(")");
  if (!isRgb && !isRgba) {
    return false;
  }
  const prefixLength = isRgba ? 5 : 4;
  const channels = value.slice(prefixLength, -1).split(",");
  if (channels.length !== (isRgba ? 4 : 3)) {
    return false;
  }
  return (
    channels.slice(0, 3).every(isCssNumericChannel) &&
    (!isRgba || isCssAlphaChannel(channels[3]))
  );
}

function isSafeFontFamily(value) {
  const fontFamily = String(value || "");
  return (
    fontFamily.length > 0 &&
    fontFamily.length <= 120 &&
    Array.from(fontFamily).every((character) => {
      return (
        (character >= "a" && character <= "z") ||
        (character >= "A" && character <= "Z") ||
        (character >= "0" && character <= "9") ||
        character === " " ||
        character === "," ||
        character === "'" ||
        character === '"' ||
        character === "-"
      );
    })
  );
}

export function normalizeColor(value, fallback = null) {
  const color = String(value ?? "").trim();
  if (
    isHexColor(color) ||
    isRgbColor(color) ||
    SAFE_NAMED_COLORS.has(color.toLowerCase())
  ) {
    return color;
  }
  return fallback;
}

export function normalizeImageUrl(value) {
  const url = String(value ?? "").trim();
  if (!url || containsControlCharacters(url)) {
    return "";
  }
  const lowerUrl = url.toLowerCase();
  const dataImagePrefixes = [
    "data:image/png;base64,",
    "data:image/jpg;base64,",
    "data:image/jpeg;base64,",
    "data:image/gif;base64,",
    "data:image/webp;base64,",
    "data:image/bmp;base64,"
  ];
  const dataImagePrefix = dataImagePrefixes.find((prefix) =>
    lowerUrl.startsWith(prefix)
  );
  if (dataImagePrefix) {
    const payload = url.slice(dataImagePrefix.length);
    return payload && isSafeBase64Payload(payload) ? url : "";
  }
  if (lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://")) {
    return normalizeHttpUrl(url);
  }
  return normalizeRelativeUrl(url);
}

export function normalizeLinkUrl(value) {
  const url = String(value ?? "").trim();
  if (!url || containsControlCharacters(url)) {
    return "";
  }
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.startsWith("http://") || lowerUrl.startsWith("https://")) {
    return normalizeHttpUrl(url);
  }
  if (
    lowerUrl.startsWith("mailto:") ||
    lowerUrl.startsWith("tel:") ||
    lowerUrl.startsWith("#")
  ) {
    return containsWhitespace(url) ? "" : url;
  }
  return normalizeRelativeUrl(url);
}

function sanitizeCss(styleText) {
  const input = String(styleText ?? "");
  if (
    !input ||
    /(?:url\s*\(|expression\s*\(|@import|javascript:|data:|[{}\\])/i.test(input)
  ) {
    return "";
  }
  const probe = document.createElement("span");
  probe.setAttribute("style", input);
  const output = [];
  Array.from(probe.style).forEach((property) => {
    const normalizedProperty = property.toLowerCase();
    const cssValue = probe.style.getPropertyValue(property).trim();
    if (
      ALLOWED_STYLE_PROPERTIES.has(normalizedProperty) &&
      cssValue &&
      !/(?:url\s*\(|expression\s*\(|@import|javascript:|data:|[{}\\])/i.test(
        cssValue
      )
    ) {
      output.push(`${normalizedProperty}:${cssValue}`);
    }
  });
  return output.join(";");
}

function sanitizeElement(element) {
  const tagName = element.tagName;
  if (DROP_WITH_CONTENT.has(tagName)) {
    element.remove();
    return;
  }
  if (!ALLOWED_TAGS.has(tagName)) {
    element.replaceWith(...Array.from(element.childNodes));
    return;
  }

  Array.from(element.attributes).forEach((attribute) => {
    const name = attribute.name.toLowerCase();
    const allowed =
      name === "style" ||
      name === "class" ||
      (tagName === "A" && ["href", "target", "rel"].includes(name)) ||
      (tagName === "IMG" && ["src", "alt", "width", "height"].includes(name)) ||
      (tagName === "OL" && name === "start") ||
      (["TD", "TH"].includes(tagName) && ["colspan", "rowspan"].includes(name));
    if (!allowed || name.startsWith("on")) {
      element.removeAttribute(attribute.name);
    }
  });

  if (element.hasAttribute("style")) {
    const safeStyle = sanitizeCss(element.getAttribute("style"));
    if (safeStyle) {
      element.setAttribute("style", safeStyle);
    } else {
      element.removeAttribute("style");
    }
  }
  if (element.hasAttribute("class")) {
    const classes = String(element.getAttribute("class") || "")
      .split(/\s+/)
      .filter((className) => SAFE_CLASSES.has(className));
    if (classes.length) {
      element.setAttribute("class", classes.join(" "));
    } else {
      element.removeAttribute("class");
    }
  }
  if (tagName === "A") {
    const href = normalizeLinkUrl(element.getAttribute("href"));
    if (href) {
      element.setAttribute("href", href);
    } else {
      element.removeAttribute("href");
    }
    if (element.getAttribute("target") === "_blank") {
      element.setAttribute("rel", "noopener noreferrer");
    } else {
      element.removeAttribute("target");
      element.removeAttribute("rel");
    }
  }
  if (tagName === "IMG") {
    const src = normalizeImageUrl(element.getAttribute("src"));
    if (!src) {
      element.remove();
      return;
    }
    element.setAttribute("src", src);
    ["width", "height"].forEach((name) => {
      const dimension = finiteNumber(element.getAttribute(name), 1, 10000);
      if (dimension === null) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, String(dimension));
      }
    });
  }
  ["start", "colspan", "rowspan"].forEach((name) => {
    if (element.hasAttribute(name)) {
      const numeric = finiteNumber(element.getAttribute(name), 1, 1000);
      if (numeric === null) {
        element.removeAttribute(name);
      } else {
        element.setAttribute(name, String(Math.trunc(numeric)));
      }
    }
  });
}

function parseHtmlFragmentInsideSecurityBoundary(value) {
  const template = document.createElement("template");
  const html = String(value ?? "");
  // This is the only raw HTML parser in the LWC security boundary. The parsed
  // fragment is always sanitized before callers can read or render it.
  // nosemgrep: javascript.browser.security.insecure-innerhtml, javascript.browser.security.insecure-document-method.insecure-document-method
  template.innerHTML = html;
  return template;
}

export function sanitizeRichTextHtml(value) {
  const html = String(value ?? "");
  if (!html) {
    return html;
  }
  const template = parseHtmlFragmentInsideSecurityBoundary(html);
  Array.from(template.content.querySelectorAll("*")).forEach(sanitizeElement);
  return template.innerHTML;
}

export function setSanitizedInnerHtml(element, value) {
  if (!element) {
    return;
  }
  const sanitizedHtml = sanitizeRichTextHtml(value);
  // Render only HTML returned by the allowlist sanitizer above.
  // nosemgrep: javascript.browser.security.insecure-innerhtml, javascript.browser.security.insecure-document-method.insecure-document-method
  element.innerHTML = sanitizedHtml;
}

export function getSanitizedInnerHtml(element) {
  // Reading markup is constrained to this module so callers never consume raw
  // editable HTML directly.
  return element ? sanitizeRichTextHtml(element.innerHTML || "") : "";
}

export function getFragmentHtml(fragment) {
  const container = document.createElement("div");
  container.appendChild(fragment);
  // Serialize the detached fragment only to pass it through the allowlist
  // sanitizer again before returning it.
  return sanitizeRichTextHtml(container.innerHTML);
}

function copyAllowed(source, allowedKeys) {
  return Object.fromEntries(
    ownEntries(source).filter(([key]) => allowedKeys.has(key))
  );
}

function sanitizeStyles(source = {}) {
  const styles = copyAllowed(source, STYLE_KEYS);
  if ("background" in styles)
    styles.background = normalizeColor(styles.background, undefined);
  if ("borderColor" in styles)
    styles.borderColor = normalizeColor(styles.borderColor, undefined);
  if ("color" in styles) styles.color = normalizeColor(styles.color, undefined);
  if ("tableBorderColor" in styles)
    styles.tableBorderColor = normalizeColor(
      styles.tableBorderColor,
      undefined
    );
  if ("lineColor" in styles)
    styles.lineColor = normalizeColor(styles.lineColor, undefined);
  if ("relatedListTextColor" in styles)
    styles.relatedListTextColor = normalizeColor(
      styles.relatedListTextColor,
      undefined
    );
  if (styles.background === undefined && source.background === "transparent")
    styles.background = "transparent";
  if ("padding" in styles)
    styles.padding = finiteNumber(styles.padding, 0, 500);
  if ("borderWidth" in styles)
    styles.borderWidth = finiteNumber(styles.borderWidth, 0, 100);
  if ("borderRadius" in styles)
    styles.borderRadius = finiteNumber(styles.borderRadius, 0, 1000);
  if ("fontSize" in styles)
    styles.fontSize = finiteNumber(styles.fontSize, 6, 200);
  if ("tableRows" in styles)
    styles.tableRows = finiteNumber(styles.tableRows, 1, 12);
  if ("tableColumns" in styles)
    styles.tableColumns = finiteNumber(styles.tableColumns, 1, 12);
  if ("tableCellPadding" in styles)
    styles.tableCellPadding = finiteNumber(styles.tableCellPadding, 0, 100);
  if ("tableBorderWidth" in styles)
    styles.tableBorderWidth = finiteNumber(styles.tableBorderWidth, 0, 100);
  if ("lineLength" in styles)
    styles.lineLength = finiteNumber(styles.lineLength, 1, 10000);
  if ("lineThickness" in styles)
    styles.lineThickness = finiteNumber(styles.lineThickness, 1, 500);
  if ("width" in styles) styles.width = finiteNumber(styles.width, 1, 10000);
  if ("widthRatio" in styles)
    styles.widthRatio = finiteNumber(styles.widthRatio, 0, 1);
  if ("height" in styles) styles.height = finiteNumber(styles.height, 1, 10000);
  if ("x" in styles) styles.x = finiteNumber(styles.x, -10000, 10000);
  if ("xRatio" in styles) styles.xRatio = finiteNumber(styles.xRatio, 0, 1);
  if ("y" in styles) styles.y = finiteNumber(styles.y, -10000, 10000);
  if ("relatedListFontSize" in styles)
    styles.relatedListFontSize = finiteNumber(
      styles.relatedListFontSize,
      8,
      36
    );
  if ("borderStyle" in styles && !BORDER_STYLES.has(styles.borderStyle))
    delete styles.borderStyle;
  if ("lineStyle" in styles && !BORDER_STYLES.has(styles.lineStyle))
    delete styles.lineStyle;
  if ("textAlign" in styles && !TEXT_ALIGNS.has(styles.textAlign))
    delete styles.textAlign;
  if ("verticalAlign" in styles && !VERTICAL_ALIGNS.has(styles.verticalAlign))
    delete styles.verticalAlign;
  if (
    "tableCellVerticalAlign" in styles &&
    !VERTICAL_ALIGNS.has(styles.tableCellVerticalAlign)
  )
    delete styles.tableCellVerticalAlign;
  if ("fontStyle" in styles && !FONT_STYLES.has(styles.fontStyle))
    delete styles.fontStyle;
  if ("fontWeight" in styles && !FONT_WEIGHTS.has(String(styles.fontWeight)))
    delete styles.fontWeight;
  if ("fontFamily" in styles && !isSafeFontFamily(styles.fontFamily))
    delete styles.fontFamily;
  if ("colorExplicit" in styles)
    styles.colorExplicit = styles.colorExplicit === true;
  if ("heightManuallyResized" in styles)
    styles.heightManuallyResized = styles.heightManuallyResized === true;
  return Object.fromEntries(
    Object.entries(styles).filter(([, value]) => value !== undefined)
  );
}

function sanitizeCell(cell) {
  if (cell && typeof cell === "object" && !Array.isArray(cell)) {
    return { content: sanitizeRichTextHtml(cell.content || "") };
  }
  return sanitizeRichTextHtml(cell || "");
}

function sanitizeBlock(source = {}) {
  const block = copyAllowed(source, BLOCK_KEYS);
  block.id = String(block.id || "").slice(0, 100);
  block.type = BLOCK_TYPES.has(block.type) ? block.type : "text";
  block.content = sanitizeRichTextHtml(block.content || "");
  block.imageSrc = normalizeImageUrl(block.imageSrc);
  block.pdfImageSrc = normalizeImageUrl(block.pdfImageSrc);
  block.imageAlt = String(block.imageAlt || "").slice(0, 1000);
  block.imageAspectRatio = finiteNumber(block.imageAspectRatio, 0.01, 100);
  block.hasImage = Boolean(block.imageSrc);
  block.fieldApiName = String(block.fieldApiName || "").slice(0, 255) || null;
  block.fieldLabel = String(block.fieldLabel || "").slice(0, 255) || null;
  block.tableData = Array.isArray(block.tableData)
    ? block.tableData.slice(0, 12).map((row) => {
        return Array.isArray(row) ? row.slice(0, 12).map(sanitizeCell) : [];
      })
    : null;
  block.tableCellAlignments = Array.isArray(block.tableCellAlignments)
    ? block.tableCellAlignments.slice(0, 12).map((row) => {
        return Array.isArray(row)
          ? row
              .slice(0, 12)
              .map((value) => (VERTICAL_ALIGNS.has(value) ? value : "top"))
          : [];
      })
    : null;
  block.relatedListRelationshipName =
    String(block.relatedListRelationshipName || "").slice(0, 255) || null;
  block.relatedListLabel =
    String(block.relatedListLabel || "").slice(0, 255) || null;
  block.relatedListChildObjectApiName =
    String(block.relatedListChildObjectApiName || "").slice(0, 255) || null;
  block.relatedListColumns = Array.isArray(block.relatedListColumns)
    ? block.relatedListColumns
        .slice(0, 50)
        .map((value) => String(value || "").slice(0, 255))
        .filter(Boolean)
    : [];
  block.relatedListZebraEnabled = block.relatedListZebraEnabled !== false;
  block.relatedListOddRowColor = normalizeColor(
    block.relatedListOddRowColor,
    undefined
  );
  block.relatedListEvenRowColor = normalizeColor(
    block.relatedListEvenRowColor,
    undefined
  );
  block.relatedListHeaderRowColor = normalizeColor(
    block.relatedListHeaderRowColor,
    undefined
  );
  block.relatedListTextColor = normalizeColor(
    block.relatedListTextColor,
    undefined
  );
  block.relatedListOddTextColor = normalizeColor(
    block.relatedListOddTextColor,
    undefined
  );
  block.relatedListEvenTextColor = normalizeColor(
    block.relatedListEvenTextColor,
    undefined
  );
  block.relatedListFontSize = finiteNumber(block.relatedListFontSize, 8, 36);
  block.relatedListBorderMode = RELATED_LIST_BORDERS.has(
    block.relatedListBorderMode
  )
    ? block.relatedListBorderMode
    : "all";
  block.styles = sanitizeStyles(block.styles);
  return Object.fromEntries(
    Object.entries(block).filter(([, value]) => value !== undefined)
  );
}

function sanitizeRegion(source = {}) {
  return {
    id: String(source.id || "").slice(0, 100),
    label: String(source.label || "").slice(0, 255),
    styles: sanitizeStyles(source.styles),
    blocks: Array.isArray(source.blocks)
      ? source.blocks.slice(0, 500).map(sanitizeBlock)
      : []
  };
}

function sanitizeBody(source = {}) {
  return {
    layout: source.layout === "two" ? "two" : "one",
    sections: Array.isArray(source.sections)
      ? source.sections.slice(0, 2).map(sanitizeRegion)
      : []
  };
}

export function sanitizeDocumentModel(source) {
  if (Array.isArray(source)) {
    return source.slice(0, 500).map(sanitizeBlock);
  }
  if (!source || typeof source !== "object") {
    return null;
  }
  const manualPageCount = Math.trunc(
    finiteNumber(source.manualPageCount, 0, 100) ?? 0
  );
  const showHeader = source.showHeader !== false;
  const showFooter = source.showFooter !== false;
  return {
    lineHeightSchemaVersion:
      finiteNumber(source.lineHeightSchemaVersion, 0, 100) ?? 0,
    pageBackground: normalizeColor(source.pageBackground, "#ffffff"),
    pagePadding: finiteNumber(source.pagePadding, 0, 500),
    globalElementPadding: finiteNumber(source.globalElementPadding, 0, 500),
    showHeader,
    showBody: true,
    showFooter,
    repeatHeaderOnEachPage:
      showHeader && source.repeatHeaderOnEachPage !== false,
    repeatFooterOnEachPage:
      showFooter && source.repeatFooterOnEachPage !== false,
    manualPageCount,
    manualPages: Array.isArray(source.manualPages)
      ? source.manualPages.slice(0, manualPageCount).map((page, index) => ({
          id: String(page?.id || `manual-${index + 1}`).slice(0, 100),
          body: sanitizeBody(page?.body)
        }))
      : [],
    header: sanitizeRegion(source.header),
    body: sanitizeBody(source.body),
    footer: sanitizeRegion(source.footer)
  };
}
