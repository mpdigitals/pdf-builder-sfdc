import {
  normalizeColor,
  normalizeImageUrl,
  sanitizeDocumentModel,
  sanitizeRichTextHtml
} from "c/pdfBuilderSecurity";

export const MAX_HEADER_RECORD_FIELDS = 5;

const COLOR_WORDS = Object.freeze({
  azul: "#0176d3",
  blue: "#0176d3",
  rojo: "#ba0517",
  red: "#ba0517",
  verde: "#2e844a",
  green: "#2e844a",
  negro: "#181818",
  black: "#181818",
  blanco: "#ffffff",
  white: "#ffffff",
  gris: "#747474",
  gray: "#747474",
  grey: "#747474",
  naranja: "#dd7a01",
  orange: "#dd7a01"
});

const PROMPT_ALIASES = Object.freeze({
  opportunity: ["oportunidad", "oportunidades"],
  quote: ["cotizacion", "cotizaciones", "presupuesto", "presupuestos"],
  account: ["cuenta", "cuentas", "empresa", "empresas"],
  contact: ["contacto", "contactos"],
  case: ["caso", "casos"],
  name: ["nombre"],
  email: ["correo", "correo electronico"],
  phone: ["telefono"],
  mobilephone: ["movil", "celular"],
  title: ["cargo", "titulo"],
  address: ["direccion"],
  amount: ["importe"],
  quantity: ["cantidad"],
  description: ["descripcion", "descripcion de linea"],
  unitprice: ["sales price", "precio de venta", "precio unitario"],
  discount: ["descuento"],
  totalprice: ["total price", "precio total"],
  createddate: ["fecha de creacion"]
});

const AI_STEP_KEYS = Object.freeze({
  context: ["templateName", "objectApiName", "recordTypeScope", "isDefault"],
  style: [
    "documentTitle",
    "pagePadding",
    "elementPadding",
    "pageBackground",
    "primaryColor",
    "textColor",
    "fontFamily",
    "bodyLayout",
    "fieldDisplayMode"
  ],
  header: [
    "showHeader",
    "repeatHeaderOnEachPage",
    "includeHeaderImage",
    "imageUrl",
    "imageAlt",
    "imageSize",
    "headerImageAlignment",
    "headerBackground",
    "headerContentBackground",
    "headerContentPadding",
    "headerContentBorderStyle",
    "headerContentBorderWidth",
    "headerContentBorderColor",
    "headerContentBorderRadius",
    "headerContentSizeMode",
    "headerTextColor",
    "includeOrganizationName",
    "headerFields",
    "headerBlocks"
  ],
  body: [
    "includeBodyTitle",
    "documentTitle",
    "textColor",
    "bodyLayout",
    "fieldDisplayMode",
    "bodyFields",
    "groupBodyFields",
    "includeOrganizationBodyBox",
    "bodyTextBoxes",
    "bodyContentBackground",
    "bodyContentPadding",
    "bodyContentBorderStyle",
    "bodyContentBorderWidth",
    "bodyContentBorderColor",
    "bodyContentBorderRadius",
    "includeBodyDivider",
    "bodyDividerColor",
    "includeRelatedList",
    "relatedListRelationshipName",
    "relatedListColumns",
    "relatedListZebraEnabled",
    "relatedListHeaderRowColor",
    "relatedListHeaderTextColor",
    "relatedListOddRowColor",
    "relatedListEvenRowColor",
    "relatedListOddTextColor",
    "relatedListEvenTextColor",
    "relatedListFontSize",
    "relatedListBorderMode",
    "relatedListGridColor",
    "includeRelatedListTotal",
    "relatedListTotalLabel",
    "relatedListTotalFieldApiName",
    "bodyBlocks"
  ],
  relatedList: [
    "includeRelatedList",
    "relatedListRelationshipName",
    "relatedListColumns",
    "relatedListZebraEnabled",
    "relatedListHeaderRowColor",
    "relatedListHeaderTextColor",
    "relatedListOddRowColor",
    "relatedListEvenRowColor",
    "relatedListOddTextColor",
    "relatedListEvenTextColor",
    "relatedListFontSize",
    "relatedListBorderMode",
    "relatedListGridColor"
  ],
  footer: [
    "showFooter",
    "repeatFooterOnEachPage",
    "footerText",
    "footerSecondaryText",
    "includeFooterOrganizationName",
    "footerAlignment",
    "footerBackground",
    "footerTextColor",
    "footerShowDivider",
    "footerDividerColor",
    "footerBlocks"
  ]
});

const AI_BLOCK_TYPES = new Set([
  "text",
  "field",
  "image",
  "divider",
  "verticalLine",
  "table",
  "relatedList"
]);

const AI_BLOCK_TYPE_ALIASES = Object.freeze({
  line: "divider",
  horizontalLine: "divider",
  vertical: "verticalLine",
  related_list: "relatedList"
});

const AI_BLOCK_DISPLAY_MODES = new Set(["value", "labelOnly", "labelAndValue"]);

const AI_FONT_FAMILIES = new Set([
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "Georgia, serif",
  "Times New Roman, serif",
  "Calibri, sans-serif"
]);

const ORGANIZATION_FIELD_NAMES = new Set([
  "Name",
  "Street",
  "City",
  "PostalCode",
  "State",
  "Country",
  "Phone",
  "Fax"
]);

const AI_BOOLEAN_KEYS = new Set([
  "isDefault",
  "showHeader",
  "repeatHeaderOnEachPage",
  "includeHeaderImage",
  "includeOrganizationName",
  "includeBodyTitle",
  "groupBodyFields",
  "includeOrganizationBodyBox",
  "includeBodyDivider",
  "includeRelatedList",
  "includeRelatedListTotal",
  "relatedListZebraEnabled",
  "showFooter",
  "repeatFooterOnEachPage",
  "includeFooterOrganizationName",
  "footerShowDivider"
]);

const AI_COLOR_KEYS = new Set([
  "pageBackground",
  "primaryColor",
  "textColor",
  "headerBackground",
  "headerContentBackground",
  "headerContentBorderColor",
  "headerTextColor",
  "bodyContentBackground",
  "bodyContentBorderColor",
  "bodyDividerColor",
  "relatedListHeaderRowColor",
  "relatedListHeaderTextColor",
  "relatedListOddRowColor",
  "relatedListEvenRowColor",
  "relatedListOddTextColor",
  "relatedListEvenTextColor",
  "relatedListGridColor",
  "footerBackground",
  "footerTextColor",
  "footerDividerColor"
]);

const RELATED_LIST_RECIPE_PROPERTY_MAP = Object.freeze({
  relatedListZebraEnabled: "relatedListZebraEnabled",
  relatedListHeaderRowColor: "relatedListHeaderRowColor",
  relatedListHeaderTextColor: "relatedListTextColor",
  relatedListOddRowColor: "relatedListOddRowColor",
  relatedListOddTextColor: "relatedListOddTextColor",
  relatedListEvenRowColor: "relatedListEvenRowColor",
  relatedListEvenTextColor: "relatedListEvenTextColor",
  relatedListFontSize: "relatedListFontSize",
  relatedListBorderMode: "relatedListBorderMode",
  relatedListGridColor: "relatedListGridColor"
});

const getRelatedListAppearance = (primary, fallback = {}) =>
  Object.fromEntries(
    Object.entries(RELATED_LIST_RECIPE_PROPERTY_MAP).map(
      ([recipeKey, blockKey]) => [
        blockKey,
        primary?.[recipeKey] ?? primary?.[blockKey] ?? fallback?.[recipeKey]
      ]
    )
  );

const AI_ENUM_VALUES = Object.freeze({
  bodyLayout: ["one", "two"],
  fieldDisplayMode: ["value", "labelOnly", "labelAndValue"],
  bodyContentBorderStyle: ["none", "solid", "dashed", "dotted"],
  headerContentBorderStyle: ["none", "solid", "dashed", "dotted"],
  headerContentSizeMode: ["content", "fullWidth"],
  imageSize: ["medium", "large"],
  headerImageAlignment: ["left", "center", "right"],
  footerAlignment: ["left", "center", "right"],
  relatedListBorderMode: ["all", "horizontal", "vertical", "none"]
});

const AI_KEY_ALIASES = Object.freeze({
  includeFooter: "showFooter",
  footerRepeat: "repeatFooterOnEachPage",
  repeatFooter: "repeatFooterOnEachPage",
  footerContent: "footerText",
  footerMessage: "footerText",
  footerTextAlignment: "footerAlignment",
  footerBackgroundColor: "footerBackground",
  footerColor: "footerTextColor",
  footerFontColor: "footerTextColor"
});

const clamp = (value, minimum, maximum, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
};

const hasFiniteNumber = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value));

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeBodyTextBoxes = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const title = String(item.title || "")
        .trim()
        .slice(0, 100);
      const content = String(item.content || "")
        .trim()
        .slice(0, 900);
      if (!title && !content) {
        return null;
      }
      return {
        title,
        content,
        layout: item.layout === "half" ? "half" : "full"
      };
    })
    .filter(Boolean)
    .slice(0, 3);
};

const decodeAIHtmlEntities = (content) => {
  let decoded = String(content || "").slice(0, 5000);
  if (typeof DOMParser === "undefined") {
    return decoded;
  }
  for (let pass = 0; pass < 2; pass += 1) {
    if (
      !/&(?:amp;)?lt;\/?(?:div|span|p|strong|b|em|ul|ol|li|h[1-6]|table|tr|td|br)\b/i.test(
        decoded
      )
    ) {
      break;
    }
    const nextValue = new DOMParser().parseFromString(decoded, "text/html").body
      .textContent;
    if (!nextValue || nextValue === decoded) {
      break;
    }
    decoded = nextValue.slice(0, 5000);
  }
  return decoded;
};

const getBodyTextBoxContent = (box, primaryColor) => {
  const title = escapeHtml(box.title);
  const rawContent = decodeAIHtmlEntities(box.content);
  const content = /<\/?(?:p|div|span|strong|b|em|ul|ol|li|br)\b/i.test(
    rawContent
  )
    ? sanitizeRichTextHtml(rawContent)
    : escapeHtml(rawContent).replaceAll("\n", "<br>");
  const heading = title
    ? `<strong style="color:${primaryColor}">${title}</strong>`
    : "";
  return [heading, content].filter(Boolean).join("<br><br>");
};

const estimateBodyTextBoxHeight = (box, width, padding) => {
  const charactersPerLine = Math.max(28, Math.floor(width / 7.5));
  const paragraphs = String(box.content || "").split("\n");
  const contentLines = paragraphs.reduce(
    (total, paragraph) =>
      total + Math.max(1, Math.ceil(paragraph.length / charactersPerLine)),
    0
  );
  const titleLines = box.title ? 1 : 0;
  return Math.max(84, (titleLines + contentLines) * 20 + padding * 2 + 16);
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const includesAny = (value, terms) =>
  terms.some((term) => value.includes(term));

const getRequestedColor = (prompt) => {
  const hex = String(prompt || "").match(/#[0-9a-f]{6}\b/i)?.[0];
  if (hex) {
    return hex.toLowerCase();
  }

  const normalized = normalizeText(prompt);
  return Object.entries(COLOR_WORDS).find(([word]) =>
    normalized.includes(word)
  )?.[1];
};

const getFieldContent = (objectApiName, field, displayMode) => {
  const token = `{!${objectApiName}.${field.apiName}}`;
  const pathSegments = String(field.apiName || "").split(".");
  const parentName = pathSegments.length > 1 ? pathSegments.at(-2) : "";
  let displayLabel = String(field.label || field.apiName || "")
    .split(">")
    .at(-1)
    .trim();
  if (
    parentName &&
    displayLabel.toLowerCase().startsWith(`${parentName.toLowerCase()} `)
  ) {
    displayLabel = displayLabel.slice(parentName.length).trim();
  }
  if (displayMode === "labelOnly") {
    return `<div><strong>${escapeHtml(displayLabel)}</strong></div>`;
  }
  if (displayMode === "value") {
    return `<div>${token}</div>`;
  }
  return `<div><strong>${escapeHtml(displayLabel)}:</strong>&nbsp;${token}</div>`;
};

const getAlignmentX = (alignment, availableWidth, width) => {
  if (alignment === "right") {
    return Math.max(0, availableWidth - width);
  }
  if (alignment === "center") {
    return Math.max(0, Math.round((availableWidth - width) / 2));
  }
  return 0;
};

const updateBlock = (block, overrides = {}, styleOverrides = {}) => ({
  ...block,
  ...overrides,
  styles: {
    ...block.styles,
    ...styleOverrides
  }
});

const configureBodySections = (model, recipe) => {
  const firstSection = model.body.sections[0];
  const sectionStyles = {
    ...firstSection.styles,
    background: "transparent",
    padding: recipe.elementPadding
  };

  if (recipe.bodyLayout === "two") {
    model.body = {
      layout: "two",
      sections: [
        {
          ...firstSection,
          id: "body-1",
          label: "Body left",
          styles: { ...sectionStyles },
          blocks: []
        },
        {
          ...firstSection,
          id: "body-2",
          label: "Body right",
          styles: { ...sectionStyles },
          blocks: []
        }
      ]
    };
    return;
  }

  model.body = {
    layout: "one",
    sections: [
      {
        ...firstSection,
        id: "body-1",
        label: "Body",
        styles: sectionStyles,
        blocks: []
      }
    ]
  };
};

const addHeaderBlocks = (model, recipe, metrics, createBlock) => {
  if (!recipe.showHeader) {
    return;
  }

  const blocks = [];
  const normalizedImageUrl = normalizeImageUrl(recipe.imageUrl);
  const hasImage = Boolean(recipe.includeHeaderImage && normalizedImageUrl);
  const imageWidth = recipe.imageSize === "large" ? 190 : 140;
  const imageHeight = recipe.imageSize === "large" ? 82 : 66;
  const imageAlignment = recipe.headerImageAlignment || "left";

  if (hasImage) {
    const image = createBlock("image");
    blocks.push(
      updateBlock(
        image,
        {
          imageSrc: normalizedImageUrl,
          imageAlt: String(recipe.imageAlt || "Document logo"),
          hasImage: true
        },
        {
          width: imageWidth,
          height: imageHeight,
          x: getAlignmentX(imageAlignment, metrics.availableWidth, imageWidth),
          y: 4,
          textAlign: imageAlignment
        }
      )
    );
  }

  const information = [];
  if (recipe.includeOrganizationName) {
    information.push("<div><strong>{!$Organization.Name}</strong></div>");
  }
  (recipe.headerFields || []).forEach((field) => {
    information.push(
      getFieldContent(recipe.objectApiName, field, "labelAndValue")
    );
  });

  if (information.length) {
    const text = createBlock("text");
    const fitContent = recipe.headerContentSizeMode === "content";
    const textWidth = hasImage
      ? Math.max(220, metrics.availableWidth - imageWidth - 24)
      : metrics.availableWidth;
    const textX = hasImage && imageAlignment === "left" ? imageWidth + 24 : 0;
    blocks.push(
      updateBlock(
        text,
        { content: information.join("") },
        {
          width: fitContent ? null : textWidth,
          widthRatio: fitContent || hasImage ? null : 1,
          widthFitContent: fitContent,
          height: null,
          heightManuallyResized: false,
          x: textX,
          y: hasImage && imageAlignment === "center" ? imageHeight + 12 : 12,
          background: recipe.headerContentBackground,
          padding: recipe.headerContentPadding,
          borderStyle: recipe.headerContentBorderStyle,
          borderWidth:
            recipe.headerContentBorderStyle === "none"
              ? 0
              : recipe.headerContentBorderWidth,
          borderColor: recipe.headerContentBorderColor,
          borderRadius: recipe.headerContentBorderRadius,
          color: recipe.headerTextColor,
          colorExplicit: true,
          fontFamily: recipe.fontFamily,
          fontSize: 14,
          textAlign: hasImage && imageAlignment === "center" ? "center" : "left"
        }
      )
    );
  }

  model.header.blocks = blocks;
};

const addBodyBlocks = (model, recipe, metrics, createBlock) => {
  const sections = model.body.sections;
  const hasBodyTitle = Boolean(
    recipe.includeBodyTitle && String(recipe.documentTitle || "").trim()
  );
  if (hasBodyTitle) {
    const title = createBlock("text");
    sections[0].blocks.push(
      updateBlock(
        title,
        {
          content: `<strong>${escapeHtml(recipe.documentTitle)}</strong>`
        },
        {
          width: metrics.sectionWidth,
          widthRatio: 1,
          height: 36,
          x: 0,
          y: 0,
          color: recipe.primaryColor,
          colorExplicit: true,
          fontFamily: recipe.fontFamily,
          fontSize: 24,
          fontWeight: "bold"
        }
      )
    );
  }

  const sectionY = sections.map(() => (hasBodyTitle ? 44 : 0));
  const bodyFields = recipe.bodyFields || [];
  if (recipe.groupBodyFields && bodyFields.length) {
    const customerContent = bodyFields
      .map((field) =>
        getFieldContent(recipe.objectApiName, field, recipe.fieldDisplayMode)
      )
      .join("");
    const addContentBox = (sectionIndex, content, lineCount, geometry = {}) => {
      const block = createBlock("text");
      const height = Math.max(
        40,
        lineCount * 24 + recipe.bodyContentPadding * 2
      );
      sections[sectionIndex].blocks.push(
        updateBlock(
          block,
          { content },
          {
            width:
              geometry.width ||
              (recipe.bodyLayout === "two"
                ? metrics.sectionWidth
                : metrics.availableWidth),
            widthRatio: geometry.width ? null : 1,
            height: geometry.height || height,
            x: geometry.x || 0,
            y: sectionY[sectionIndex],
            background: recipe.bodyContentBackground,
            padding: recipe.bodyContentPadding,
            color: recipe.textColor,
            colorExplicit: true,
            fontFamily: recipe.fontFamily,
            fontSize: 14,
            borderStyle: recipe.bodyContentBorderStyle,
            borderWidth:
              recipe.bodyContentBorderStyle === "none"
                ? 0
                : recipe.bodyContentBorderWidth,
            borderColor: recipe.bodyContentBorderColor,
            borderRadius: recipe.bodyContentBorderRadius
          }
        )
      );
      sectionY[sectionIndex] += (geometry.height || height) + 8;
    };

    if (recipe.includeOrganizationBodyBox) {
      const organizationContent = [
        "<div><strong>{!$Organization.Name}</strong></div>",
        "<div>{!$Organization.Street}</div>",
        "<div>{!$Organization.City} {!$Organization.PostalCode}</div>",
        "<div>{!$Organization.State} {!$Organization.Country}</div>",
        "<div>{!$Organization.Phone}</div>"
      ].join("");
      const gap = 12;
      const boxWidth = Math.floor((metrics.availableWidth - gap) / 2);
      const sharedHeight = Math.max(
        40,
        Math.max(bodyFields.length, 5) * 24 + recipe.bodyContentPadding * 2
      );
      addContentBox(0, customerContent, bodyFields.length, {
        width: boxWidth,
        height: sharedHeight,
        x: 0
      });
      sectionY[0] -= sharedHeight + 8;
      addContentBox(0, organizationContent, 5, {
        width: boxWidth,
        height: sharedHeight,
        x: boxWidth + gap
      });
    } else {
      addContentBox(0, customerContent, bodyFields.length);
    }
  } else {
    bodyFields.forEach((field, index) => {
      const sectionIndex = recipe.bodyLayout === "two" ? index % 2 : 0;
      const block = createBlock("field", field);
      sections[sectionIndex].blocks.push(
        updateBlock(
          block,
          {
            content: getFieldContent(
              recipe.objectApiName,
              field,
              recipe.fieldDisplayMode
            )
          },
          {
            width: metrics.sectionWidth,
            widthRatio: 1,
            height: 32,
            x: 0,
            y: sectionY[sectionIndex],
            color: recipe.textColor,
            colorExplicit: true,
            fontFamily: recipe.fontFamily,
            fontSize: 14
          }
        )
      );
      sectionY[sectionIndex] += 38;
    });
  }

  let nextBodyY = Math.max(...sectionY);
  if (
    recipe.includeRelatedList &&
    recipe.relatedListRelationshipName &&
    recipe.relatedListColumns?.length
  ) {
    const block = createBlock("relatedList");
    const relatedListY = nextBodyY + 8;
    sections[0].blocks.push(
      updateBlock(
        block,
        {
          relatedListRelationshipName: recipe.relatedListRelationshipName,
          relatedListLabel: recipe.relatedListLabel,
          relatedListChildObjectApiName: recipe.relatedListChildObjectApiName,
          relatedListColumns: [...recipe.relatedListColumns],
          relatedListColumnDefinitions: [
            ...(recipe.relatedListColumnDefinitions || [])
          ],
          relatedListZebraEnabled: Boolean(recipe.relatedListZebraEnabled),
          relatedListOddRowColor: recipe.relatedListOddRowColor,
          relatedListEvenRowColor: recipe.relatedListEvenRowColor,
          relatedListHeaderRowColor: recipe.relatedListHeaderRowColor,
          relatedListTextColor: recipe.relatedListHeaderTextColor,
          relatedListOddTextColor: recipe.relatedListOddTextColor,
          relatedListEvenTextColor: recipe.relatedListEvenTextColor,
          relatedListFontSize: recipe.relatedListFontSize,
          relatedListBorderMode: recipe.relatedListBorderMode,
          relatedListGridColor: recipe.relatedListGridColor,
          relatedListBuilderRows: 1
        },
        {
          width: metrics.availableWidth,
          widthRatio: 1,
          height: 50,
          x: 0,
          y: relatedListY,
          fontFamily: recipe.fontFamily
        }
      )
    );
    nextBodyY = relatedListY + 58;
  }

  if (recipe.includeBodyDivider) {
    const divider = createBlock("divider");
    const dividerY = nextBodyY + 8;
    sections[0].blocks.push(
      updateBlock(
        divider,
        {},
        {
          width: metrics.availableWidth,
          widthRatio: 1,
          height: 1,
          x: 0,
          y: dividerY,
          lineThickness: 1,
          lineStyle: "solid",
          lineColor: recipe.bodyDividerColor
        }
      )
    );
    nextBodyY = dividerY + 16;
  }

  if (
    recipe.includeRelatedListTotal &&
    String(recipe.relatedListTotalFieldApiName || "").trim()
  ) {
    const total = createBlock("text");
    const totalLabel = String(recipe.relatedListTotalLabel || "Total").trim();
    const totalToken = `{!${recipe.objectApiName}.${recipe.relatedListTotalFieldApiName}}`;
    const totalBackground =
      recipe.relatedListHeaderRowColor &&
      recipe.relatedListHeaderRowColor !== "transparent"
        ? recipe.relatedListHeaderRowColor
        : recipe.primaryColor;
    const totalTextColor = recipe.relatedListHeaderTextColor || "#ffffff";
    sections[0].blocks.push(
      updateBlock(
        total,
        {
          content: `<table style="width:100%;border-collapse:collapse"><tbody><tr><td style="width:50%;padding:0 16px 0 0;text-align:right;vertical-align:middle;white-space:nowrap"><strong>${escapeHtml(totalLabel.toUpperCase())}</strong></td><td style="width:50%;padding:0 0 0 16px;text-align:left;vertical-align:middle;white-space:nowrap"><strong>${totalToken}</strong></td></tr></tbody></table>`
        },
        {
          width: metrics.availableWidth,
          widthRatio: 1,
          height: 64,
          x: 0,
          y: nextBodyY,
          background: totalBackground,
          padding: 12,
          borderStyle: "none",
          borderWidth: 0,
          borderRadius: 0,
          color: totalTextColor,
          colorExplicit: true,
          fontFamily: recipe.fontFamily,
          fontSize: 18,
          fontWeight: "bold",
          textAlign: "center",
          verticalAlign: "middle"
        }
      )
    );
    nextBodyY += 76;
  }

  const textBoxes = normalizeBodyTextBoxes(recipe.bodyTextBoxes) || [];
  if (!textBoxes.length) {
    return;
  }

  const gap = 8;
  const fullWidth = metrics.availableWidth;
  const halfWidth = Math.floor((fullWidth - gap) / 2);
  const defaultBackground =
    recipe.bodyContentBackground === "transparent"
      ? "#ffffff"
      : recipe.bodyContentBackground;
  const defaultBorderStyle =
    recipe.bodyContentBorderStyle === "none"
      ? "solid"
      : recipe.bodyContentBorderStyle;
  const defaultBorderWidth =
    recipe.bodyContentBorderStyle === "none"
      ? 1
      : recipe.bodyContentBorderWidth;
  const defaultBorderColor =
    recipe.bodyContentBorderStyle === "none"
      ? "#c9c9c9"
      : recipe.bodyContentBorderColor;
  const padding = Math.max(8, recipe.bodyContentPadding);
  let halfColumn = 0;
  let halfRowHeight = 0;

  textBoxes.forEach((box) => {
    const usesHalfWidth = box.layout === "half";
    if (!usesHalfWidth && halfColumn === 1) {
      nextBodyY += halfRowHeight + gap;
      halfColumn = 0;
      halfRowHeight = 0;
    }

    const width = usesHalfWidth ? halfWidth : fullWidth;
    const height = estimateBodyTextBoxHeight(box, width, padding);
    const block = createBlock("text");
    sections[0].blocks.push(
      updateBlock(
        block,
        {
          content: getBodyTextBoxContent(box, recipe.primaryColor)
        },
        {
          width,
          widthRatio: usesHalfWidth ? null : 1,
          height,
          x: usesHalfWidth && halfColumn === 1 ? halfWidth + gap : 0,
          y: nextBodyY,
          background: defaultBackground,
          padding,
          color: recipe.textColor,
          colorExplicit: true,
          fontFamily: recipe.fontFamily,
          fontSize: 14,
          borderStyle: defaultBorderStyle,
          borderWidth: defaultBorderWidth,
          borderColor: defaultBorderColor,
          borderRadius: recipe.bodyContentBorderRadius
        }
      )
    );

    if (!usesHalfWidth) {
      nextBodyY += height + gap;
      return;
    }

    halfRowHeight = Math.max(halfRowHeight, height);
    if (halfColumn === 0) {
      halfColumn = 1;
    } else {
      nextBodyY += halfRowHeight + gap;
      halfColumn = 0;
      halfRowHeight = 0;
    }
  });
};

const addFooterBlocks = (model, recipe, metrics, createBlock) => {
  if (!recipe.showFooter) {
    return;
  }

  const parts = [];
  if (String(recipe.footerText || "").trim()) {
    parts.push(escapeHtml(recipe.footerText.trim()));
  }
  if (recipe.includeFooterOrganizationName) {
    parts.push("{!$Organization.Name}");
  }
  if (!parts.length && !String(recipe.footerSecondaryText || "").trim()) {
    return;
  }

  const content = [
    parts.length ? `<div><strong>${parts.join(" · ")}</strong></div>` : "",
    String(recipe.footerSecondaryText || "").trim()
      ? `<div>${escapeHtml(recipe.footerSecondaryText.trim())}</div>`
      : ""
  ]
    .filter(Boolean)
    .join("");
  const blocks = [];
  if (recipe.footerShowDivider) {
    const divider = createBlock("divider");
    blocks.push(
      updateBlock(
        divider,
        {},
        {
          width: metrics.availableWidth,
          widthRatio: 1,
          height: 1,
          x: 0,
          y: 4,
          lineThickness: 1,
          lineStyle: "solid",
          lineColor: recipe.footerDividerColor
        }
      )
    );
  }

  const block = createBlock("text");
  blocks.push(
    updateBlock(
      block,
      { content },
      {
        width: metrics.availableWidth,
        height: recipe.footerSecondaryText ? 54 : 40,
        x: 0,
        y: recipe.footerShowDivider ? 14 : 8,
        color: recipe.footerTextColor,
        colorExplicit: true,
        fontFamily: recipe.fontFamily,
        fontSize: 12,
        textAlign: recipe.footerAlignment
      }
    )
  );
  model.footer.blocks = blocks;
};

const removeConflictingInlineTypography = (
  content,
  { color, fontSize, fontFamily } = {}
) => {
  if (!color && !fontSize && !fontFamily) {
    return content;
  }
  return String(content || "").replace(
    /style\s*=\s*(["'])(.*?)\1/gi,
    (_attribute, quote, styleText) => {
      const declarations = String(styleText)
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .filter((declaration) => {
          const property = declaration.split(":", 1)[0].trim().toLowerCase();
          return !(
            (color && property === "color") ||
            (fontSize && property === "font-size") ||
            (fontFamily && property === "font-family")
          );
        });
      return declarations.length
        ? `style=${quote}${declarations.join(";")}${quote}`
        : "";
    }
  );
};

const estimateAIBlockHeight = (spec, width) => {
  if (spec.type === "divider") {
    return Math.max(1, Number(spec.styles?.lineThickness) || 1);
  }
  if (spec.type === "verticalLine") {
    return 120;
  }
  if (spec.type === "image") {
    return 140;
  }
  if (spec.type === "relatedList") {
    return 50;
  }
  if (spec.type === "table") {
    const rows = Math.max(
      1,
      Number(spec.styles?.tableRows) || spec.tableData?.length || 3
    );
    return Math.max(48, rows * 38);
  }
  if (spec.type === "field") {
    return Math.max(34, Number(spec.styles?.height) || 0);
  }

  const plainText = String(spec.content || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:div|p|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
  const inlineFontSizes = [
    ...String(spec.content || "").matchAll(
      /font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px/gi
    )
  ].map((match) => Number(match[1]));
  const headingFontSizes = [
    ...String(spec.content || "").matchAll(/<h([1-6])(?:\s|>)/gi)
  ].map((match) => 34 - Number(match[1]) * 3);
  const fontSize = Math.max(
    6,
    Number(spec.styles?.fontSize) || 14,
    ...inlineFontSizes,
    ...headingFontSizes
  );
  const charactersPerLine = Math.max(
    12,
    Math.floor(width / Math.max(7, fontSize * 0.62))
  );
  const lineCount = String(plainText || " ")
    .split("\n")
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
      0
    );
  const inlinePaddings = [
    ...String(spec.content || "").matchAll(
      /padding\s*:\s*([0-9]+(?:\.[0-9]+)?)px/gi
    )
  ].map((match) => Number(match[1]));
  const outerPadding = Number(spec.styles?.padding) || 0;
  const innerPadding = inlinePaddings.length ? Math.max(...inlinePaddings) : 0;
  const contentHeight = Math.max(
    44,
    lineCount * Math.max(20, fontSize * 1.5) +
      (outerPadding + innerPadding) * 2 +
      20
  );
  const requestedHeight = Math.max(0, Number(spec.styles?.height) || 0);
  return Math.max(contentHeight, Math.min(requestedHeight, contentHeight + 40));
};

const buildAIBlock = ({
  spec,
  recipe,
  region,
  availableWidth,
  cursorY,
  resolvedY,
  createBlock
}) => {
  const field = spec.fieldApiName
    ? { apiName: spec.fieldApiName, label: spec.fieldLabel }
    : null;
  const block = createBlock(spec.type, field);
  if (!block) {
    return null;
  }

  const requestedWidthPercent = hasFiniteNumber(spec.widthPercent)
    ? Number(spec.widthPercent)
    : null;
  const widthPercent =
    requestedWidthPercent !== null && requestedWidthPercent >= 90
      ? 100
      : requestedWidthPercent;
  const defaultWidthPercent =
    spec.type === "image" ? 35 : spec.type === "verticalLine" ? null : 100;
  const width = Number.isFinite(widthPercent)
    ? Math.max(1, Math.round((availableWidth * widthPercent) / 100))
    : hasFiniteNumber(spec.styles?.width)
      ? Number(spec.styles.width)
      : defaultWidthPercent === null
        ? Math.max(1, Number(spec.styles?.lineThickness) || 1)
        : Math.max(1, Math.round((availableWidth * defaultWidthPercent) / 100));
  const xPercent = hasFiniteNumber(spec.xPercent)
    ? Number(spec.xPercent)
    : null;
  let x = Number.isFinite(xPercent)
    ? Math.round((availableWidth * xPercent) / 100)
    : hasFiniteNumber(spec.styles?.x)
      ? Number(spec.styles.x)
      : getAlignmentX(spec.horizontalAlign, availableWidth, width);
  x = Math.max(0, Math.min(x, Math.max(0, availableWidth - width)));
  const y = Number.isFinite(Number(resolvedY))
    ? Math.max(0, Number(resolvedY))
    : hasFiniteNumber(spec.styles?.y)
      ? Math.max(0, Number(spec.styles.y))
      : cursorY;
  const height = estimateAIBlockHeight(spec, width);
  const styles = {
    ...spec.styles,
    fontFamily: recipe.fontFamily,
    width,
    widthRatio: null,
    height,
    x,
    xRatio: null,
    y
  };
  if (["text", "field"].includes(spec.type)) {
    styles.color =
      spec.styles?.color ||
      (region === "header"
        ? recipe.headerTextColor
        : region === "footer"
          ? recipe.footerTextColor
          : recipe.textColor) ||
      "#181818";
    styles.fontSize =
      Number(spec.styles?.fontSize) ||
      (region === "header" ? 16 : region === "footer" ? 11 : 14);
    styles.colorExplicit = true;
  }
  if (spec.type === "table") {
    styles.tableRows = Math.max(
      1,
      Number(spec.styles?.tableRows) || spec.tableData?.length || 3
    );
    styles.tableColumns = Math.max(
      1,
      Number(spec.styles?.tableColumns) || spec.tableData?.[0]?.length || 3
    );
  }

  const overrides = {};
  if (spec.type === "text") {
    overrides.content = removeConflictingInlineTypography(spec.content, {
      color: styles.color,
      fontSize: styles.fontSize,
      fontFamily: styles.fontFamily
    });
  } else if (spec.type === "field") {
    overrides.content = getFieldContent(
      recipe.objectApiName,
      field,
      spec.displayMode
    );
  } else if (spec.type === "image") {
    overrides.imageSrc = spec.imageSrc;
    overrides.imageAlt = spec.imageAlt;
    overrides.hasImage = Boolean(spec.imageSrc);
  } else if (spec.type === "table") {
    overrides.tableData = spec.tableData || [];
  } else if (spec.type === "relatedList") {
    Object.assign(overrides, {
      relatedListRelationshipName: spec.relatedListRelationshipName,
      relatedListLabel: spec.relatedListLabel,
      relatedListChildObjectApiName: spec.relatedListChildObjectApiName,
      relatedListColumns: [...(spec.relatedListColumns || [])],
      relatedListColumnDefinitions: [
        ...(spec.relatedListColumnDefinitions || [])
      ],
      relatedListZebraEnabled: spec.relatedListZebraEnabled,
      relatedListOddRowColor: spec.relatedListOddRowColor,
      relatedListEvenRowColor: spec.relatedListEvenRowColor,
      relatedListHeaderRowColor: spec.relatedListHeaderRowColor,
      relatedListTextColor: spec.relatedListTextColor,
      relatedListOddTextColor: spec.relatedListOddTextColor,
      relatedListEvenTextColor: spec.relatedListEvenTextColor,
      relatedListFontSize: spec.relatedListFontSize,
      relatedListBorderMode: spec.relatedListBorderMode,
      relatedListGridColor: spec.relatedListGridColor,
      relatedListBuilderRows: spec.relatedListBuilderRows || 1
    });
  }

  return updateBlock(block, overrides, styles);
};

const addAIBlocksToRegion = ({
  region,
  specs,
  recipe,
  availableWidth,
  createBlock
}) => {
  let cursorY = 0;
  let maximumBottom = 0;
  const blocks = [];
  const blockGaps = new Map();
  const resolvedRows = new Map();
  (specs || []).forEach((spec) => {
    const requestedY = hasFiniteNumber(spec.styles?.y)
      ? Math.max(0, Number(spec.styles.y))
      : null;
    let resolvedY = cursorY;
    if (requestedY !== null) {
      const rowKey = String(requestedY);
      if (resolvedRows.has(rowKey)) {
        resolvedY = resolvedRows.get(rowKey);
      } else {
        resolvedY = Math.max(requestedY, cursorY);
        if (cursorY > 0) {
          resolvedY = cursorY;
        }
        resolvedRows.set(rowKey, resolvedY);
      }
    }
    const block = buildAIBlock({
      spec,
      recipe,
      region:
        region.id === "header" || region.id === "footer" ? region.id : "body",
      availableWidth,
      cursorY,
      resolvedY,
      createBlock
    });
    if (!block) {
      return;
    }
    blocks.push(block);
    blockGaps.set(block.id, Math.max(0, Number(spec.gapAfter) || 0));
    const bottom =
      Number(block.styles?.y || 0) + Number(block.styles?.height || 0);
    maximumBottom = Math.max(maximumBottom, bottom);
    cursorY = Math.max(
      cursorY,
      bottom + Math.max(0, Number(spec.gapAfter) || 0)
    );
  });
  const columnCandidates = blocks
    .filter((block) => ["text", "field"].includes(block.type))
    .filter((block) => {
      const ratio = Number(block.styles.width) / availableWidth;
      return ratio >= 0.35 && ratio <= 0.55;
    })
    .sort((left, right) => left.styles.y - right.styles.y);
  const pairedBlockIds = new Set();
  const pairedBlocks = new Map();
  columnCandidates.forEach((first) => {
    if (pairedBlockIds.has(first.id)) {
      return;
    }
    const firstIsLeft = first.styles.x < availableWidth / 2;
    const partner = columnCandidates
      .filter((candidate) => {
        if (candidate.id === first.id || pairedBlockIds.has(candidate.id)) {
          return false;
        }
        const candidateIsLeft = candidate.styles.x < availableWidth / 2;
        return firstIsLeft !== candidateIsLeft;
      })
      .sort(
        (left, right) =>
          Math.abs(left.styles.y - first.styles.y) -
          Math.abs(right.styles.y - first.styles.y)
      )[0];
    if (!partner) {
      return;
    }
    const cards = [first, partner].sort(
      (left, right) => left.styles.x - right.styles.x
    );
    const gap = 12;
    const columnWidth = Math.floor((availableWidth - gap) / 2);
    const rowY = Math.min(cards[0].styles.y, cards[1].styles.y);
    const rowHeight = Math.max(
      Number(cards[0].styles.height) || 0,
      Number(cards[1].styles.height) || 0
    );
    cards[0].styles.width = columnWidth;
    cards[0].styles.x = 0;
    cards[0].styles.y = rowY;
    cards[0].styles.height = rowHeight;
    cards[1].styles.width = columnWidth;
    cards[1].styles.x = columnWidth + gap;
    cards[1].styles.y = rowY;
    cards[1].styles.height = rowHeight;
    [
      "background",
      "padding",
      "borderStyle",
      "borderWidth",
      "borderColor",
      "borderRadius",
      "color",
      "fontSize"
    ].forEach((property) => {
      if (
        (cards[1].styles[property] === undefined ||
          cards[1].styles[property] === null ||
          cards[1].styles[property] === "") &&
        cards[0].styles[property] !== undefined
      ) {
        cards[1].styles[property] = cards[0].styles[property];
      }
    });
    pairedBlockIds.add(cards[0].id);
    pairedBlockIds.add(cards[1].id);
    pairedBlocks.set(cards[0].id, cards[1]);
    pairedBlocks.set(cards[1].id, cards[0]);
  });
  if (pairedBlockIds.size) {
    // Reflow rows without pulling the entire composition to the top. Style-only
    // control changes rebuild the preview, so the original top offset must be
    // preserved instead of being reset to zero on every render.
    let flowY = Math.min(
      ...blocks.map((block) => Math.max(0, Number(block.styles?.y) || 0))
    );
    const flowedBlockIds = new Set();
    blocks.forEach((block) => {
      if (flowedBlockIds.has(block.id)) {
        return;
      }
      const partner = pairedBlocks.get(block.id);
      if (partner) {
        block.styles.y = flowY;
        partner.styles.y = flowY;
        const rowHeight = Math.max(
          Number(block.styles.height) || 0,
          Number(partner.styles.height) || 0
        );
        const rowGap = Math.max(
          blockGaps.get(block.id) || 0,
          blockGaps.get(partner.id) || 0
        );
        flowY += rowHeight + rowGap;
        flowedBlockIds.add(block.id);
        flowedBlockIds.add(partner.id);
        return;
      }
      block.styles.y = flowY;
      flowY +=
        (Number(block.styles.height) || 0) + (blockGaps.get(block.id) || 0);
      flowedBlockIds.add(block.id);
    });
  }
  region.blocks = blocks;
  return blocks.reduce(
    (bottom, block) =>
      Math.max(
        bottom,
        Number(block.styles?.y || 0) + Number(block.styles?.height || 0)
      ),
    maximumBottom
  );
};

const addAIRegionBlocks = (model, recipe, metrics, createBlock) => {
  if (recipe.headerBlocks?.length && recipe.showHeader) {
    const maximumBottom = addAIBlocksToRegion({
      region: model.header,
      specs: recipe.headerBlocks,
      recipe,
      availableWidth: metrics.availableWidth,
      createBlock
    });
    model.header.styles.height = Math.max(
      Number(model.header.styles.height) || 0,
      maximumBottom + Number(model.header.styles.padding || 0) * 2
    );
  }

  if (recipe.bodyBlocks?.length) {
    model.body.sections.forEach((section, index) => {
      addAIBlocksToRegion({
        region: section,
        specs: recipe.bodyBlocks.filter(
          (spec) => Math.max(1, Number(spec.section) || 1) === index + 1
        ),
        recipe,
        availableWidth:
          model.body.layout === "two"
            ? metrics.sectionWidth
            : metrics.availableWidth,
        createBlock
      });
    });
  }

  if (recipe.footerBlocks?.length && recipe.showFooter) {
    const maximumBottom = addAIBlocksToRegion({
      region: model.footer,
      specs: recipe.footerBlocks,
      recipe,
      availableWidth: metrics.availableWidth,
      createBlock
    });
    model.footer.styles.height = Math.max(
      Number(model.footer.styles.height) || 0,
      maximumBottom + Number(model.footer.styles.padding || 0) * 2
    );
  }
};

export const createDefaultWizardRecipe = (configuration = {}) => ({
  schemaVersion: 1,
  templateName: "",
  objectApiName: "",
  recordTypeScope: "ALL",
  isDefault: false,
  includeBodyTitle: false,
  documentTitle: "",
  pagePadding: clamp(configuration.defaultPagePadding, 0, 96, 32),
  elementPadding: clamp(configuration.defaultElementPadding, 0, 48, 8),
  pageBackground: "transparent",
  primaryColor: "#0176d3",
  textColor: "#181818",
  fontFamily: "Arial, sans-serif",
  spacing: "normal",
  bodyLayout: "one",
  fieldDisplayMode: "labelAndValue",
  bodyFields: [],
  groupBodyFields: false,
  includeOrganizationBodyBox: false,
  bodyTextBoxes: [],
  bodyContentBackground: "transparent",
  bodyContentPadding: 8,
  bodyContentBorderStyle: "none",
  bodyContentBorderWidth: 0,
  bodyContentBorderColor: "#181818",
  bodyContentBorderRadius: 0,
  includeBodyDivider: false,
  bodyDividerColor: "#0176d3",
  showHeader: true,
  repeatHeaderOnEachPage: true,
  includeHeaderImage: false,
  imageUrl: "",
  imageAlt: "Document logo",
  imageSize: "medium",
  headerImageAlignment: "left",
  headerBackground: "transparent",
  headerContentBackground: "transparent",
  headerContentPadding: 0,
  headerContentBorderStyle: "none",
  headerContentBorderWidth: 0,
  headerContentBorderColor: "#181818",
  headerContentBorderRadius: 0,
  headerContentSizeMode: "fullWidth",
  headerTextColor: "#181818",
  includeOrganizationName: true,
  headerFields: [],
  headerBlocks: [],
  includeRelatedList: false,
  relatedListRelationshipName: "",
  relatedListChildObjectApiName: "",
  relatedListLabel: "",
  relatedListColumns: [],
  relatedListColumnDefinitions: [],
  relatedListZebraEnabled: true,
  relatedListHeaderRowColor: "#0176d3",
  relatedListHeaderTextColor: "#ffffff",
  relatedListOddRowColor: "transparent",
  relatedListEvenRowColor: "#f8fafc",
  relatedListOddTextColor: "#181818",
  relatedListEvenTextColor: "#181818",
  relatedListFontSize: 12,
  relatedListBorderMode: "all",
  relatedListGridColor: "#c9c9c9",
  includeRelatedListTotal: false,
  relatedListTotalLabel: "Total",
  relatedListTotalFieldApiName: "",
  bodyBlocks: [],
  showFooter: true,
  repeatFooterOnEachPage: true,
  footerText: "",
  footerSecondaryText: "",
  includeFooterOrganizationName: true,
  footerAlignment: "center",
  footerBackground: "transparent",
  footerTextColor: "#181818",
  footerShowDivider: false,
  footerDividerColor: "#0176d3",
  footerBlocks: []
});

export const buildWizardDocumentModel = ({
  recipe,
  configuration,
  createDefaultDocument,
  createBlock
}) => {
  const model = createDefaultDocument();
  const documentRecipe =
    !recipe.bodyBlocks?.length &&
    normalizeBodyTextBoxes(recipe.bodyTextBoxes)?.length > 0
      ? { ...recipe, bodyLayout: "one" }
      : recipe;
  const pageWidth = clamp(configuration?.pageWidth, 320, 2400, 794);
  const pagePadding = clamp(recipe.pagePadding, 0, 96, 32);
  const elementPadding = clamp(recipe.elementPadding, 0, 48, 8);
  const pageBackground = normalizeColor(recipe.pageBackground, "transparent");

  model.pagePadding = pagePadding;
  model.pageBackground = pageBackground;
  model.globalElementPadding = elementPadding;
  model.showHeader = Boolean(recipe.showHeader);
  model.showFooter = Boolean(recipe.showFooter);
  model.repeatHeaderOnEachPage =
    model.showHeader && Boolean(recipe.repeatHeaderOnEachPage);
  model.repeatFooterOnEachPage =
    model.showFooter && Boolean(recipe.repeatFooterOnEachPage);
  model.header.styles = {
    ...model.header.styles,
    background: normalizeColor(recipe.headerBackground, "transparent"),
    padding: elementPadding
  };
  model.footer.styles = {
    ...model.footer.styles,
    background: normalizeColor(recipe.footerBackground, "transparent"),
    padding: elementPadding
  };

  configureBodySections(model, {
    ...documentRecipe,
    pageBackground,
    elementPadding
  });

  const availableWidth = Math.max(
    240,
    pageWidth - pagePadding * 2 - elementPadding * 2
  );
  const sectionGap = documentRecipe.bodyLayout === "two" ? 12 : 0;
  const sectionWidth =
    documentRecipe.bodyLayout === "two"
      ? Math.floor((availableWidth - sectionGap) / 2)
      : availableWidth;
  const metrics = { availableWidth, sectionWidth };

  if (!documentRecipe.headerBlocks?.length) {
    addHeaderBlocks(model, documentRecipe, metrics, createBlock);
  }
  if (!documentRecipe.bodyBlocks?.length) {
    addBodyBlocks(model, documentRecipe, metrics, createBlock);
  }
  if (!documentRecipe.footerBlocks?.length) {
    addFooterBlocks(model, documentRecipe, metrics, createBlock);
  }
  addAIRegionBlocks(model, documentRecipe, metrics, createBlock);
  const hasVisibleHeaderContent = model.header.blocks.some((block) => {
    if (block.type === "image") {
      return Boolean(block.imageSrc || block.hasImage);
    }
    if (!["text", "field"].includes(block.type)) {
      return false;
    }
    return Boolean(
      String(block.content || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;|\s/gi, "")
    );
  });
  if (model.showHeader && !hasVisibleHeaderContent) {
    addHeaderBlocks(
      model,
      {
        ...documentRecipe,
        headerBlocks: [],
        includeOrganizationName: true
      },
      metrics,
      createBlock
    );
  }
  return model;
};

export const rankRelatedLists = (relatedLists = []) => {
  const preferred = [
    "contact",
    "lineitem",
    "line item",
    "product",
    "opportunity",
    "case",
    "asset"
  ];
  const discouraged = ["history", "share", "feed", "event", "process"];

  return [...relatedLists]
    .map((item) => {
      const haystack = normalizeText(
        `${item.label} ${item.relationshipName} ${item.childObjectApiName}`
      );
      let score = 0;
      preferred.forEach((word, index) => {
        if (haystack.includes(word)) {
          score += preferred.length - index;
        }
      });
      discouraged.forEach((word) => {
        if (haystack.includes(word)) {
          score -= 20;
        }
      });
      if (
        normalizeText(item.relationshipName) ===
        `${normalizeText(item.childObjectApiName)}s`
      ) {
        score += 10;
      }
      return { ...item, suggestionScore: score };
    })
    .sort(
      (left, right) =>
        right.suggestionScore - left.suggestionScore ||
        String(left.label).localeCompare(String(right.label))
    );
};

export const findPromptMatches = (options = [], prompt = "") => {
  const normalizedPrompt = normalizeText(prompt);
  if (!normalizedPrompt) {
    return [];
  }

  return options.filter((option) => {
    const sourceValues = [
      option.label,
      option.apiName,
      option.relationshipName,
      option.childObjectApiName
    ].filter(Boolean);
    const candidates = sourceValues.filter(Boolean).flatMap((value) =>
      normalizeText(value)
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((token) => token.length >= 3)
    );
    sourceValues.forEach((value) => {
      const key = normalizeText(value).replace(/[^a-z0-9]/g, "");
      candidates.push(...(PROMPT_ALIASES[key] || []));
    });
    return candidates.some((candidate) => normalizedPrompt.includes(candidate));
  });
};

export const findExactPromptFieldMatches = (fields = [], prompt = "") => {
  const normalizedPrompt = ` ${normalizeText(prompt)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
  if (!normalizedPrompt.trim()) {
    return [];
  }

  return (fields || [])
    .map((field, fieldIndex) => {
      const apiKey = normalizeText(field.apiName).replace(/[^a-z0-9]/g, "");
      const normalizedLabel = normalizeText(field.label)
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const labelTokens = normalizedLabel.split(" ").filter(Boolean);
      const labelSuffixes =
        labelTokens.length > 2
          ? labelTokens
              .slice(1, -1)
              .map((_, index) => labelTokens.slice(index + 1).join(" "))
          : [];
      const productNameAliases =
        apiKey === "name" && labelTokens.includes("product")
          ? ["product name", "nombre del producto"]
          : [];
      const candidates = [
        field.label,
        ...labelSuffixes,
        ...productNameAliases,
        ...(PROMPT_ALIASES[apiKey] || [])
      ]
        .map((value) =>
          normalizeText(value)
            .replace(/[^a-z0-9]+/g, " ")
            .trim()
        )
        .filter((value) => value.length >= 3);
      const matchPositions = candidates
        .map((candidate) => normalizedPrompt.indexOf(` ${candidate} `))
        .filter((position) => position >= 0);
      return {
        field,
        fieldIndex,
        promptIndex: matchPositions.length ? Math.min(...matchPositions) : -1
      };
    })
    .filter((match) => match.promptIndex >= 0)
    .sort(
      (left, right) =>
        left.promptIndex - right.promptIndex ||
        left.fieldIndex - right.fieldIndex
    )
    .map((match) => match.field);
};

const parseAIResponse = (generatedJson) => {
  const normalized = String(generatedJson || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    const repaired = normalized
      .replace(
        /("(?:height|width|x|y|widthPercent|xPercent)"\s*:\s*)(?:auto|undefined|NaN)(?=\s*[,}])/gi,
        "$1null"
      )
      .replace(/,\s*([}\]])/g, "$1");
    if (repaired === normalized) {
      throw error;
    }
    parsed = JSON.parse(repaired);
  }
  const patch = parsed?.patch ?? parsed;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new Error("Salesforce AI returned an invalid proposal.");
  }
  return {
    patch,
    summary: String(parsed?.summary || "AI design proposal").slice(0, 240),
    unapplied: Array.isArray(parsed?.unapplied)
      ? parsed.unapplied
          .filter((item) => typeof item === "string" && item.trim())
          .map((item) => item.trim().slice(0, 240))
          .slice(0, 8)
      : []
  };
};

const findOption = (options, key, value) => {
  const normalizedValue = normalizeText(value);
  return (options || []).find(
    (option) => normalizeText(option?.[key]) === normalizedValue
  );
};

const findRelatedListOption = (relatedLists, value) => {
  const normalizedValue = normalizeText(value);
  const compactValue = normalizedValue.replace(/[^a-z0-9]/g, "");
  if (!compactValue) {
    return null;
  }

  return (relatedLists || []).find((option) =>
    [option.label, option.relationshipName, option.childObjectApiName].some(
      (candidate) => {
        const normalizedCandidate = normalizeText(candidate);
        return (
          normalizedCandidate === normalizedValue ||
          normalizedCandidate.replace(/[^a-z0-9]/g, "") === compactValue
        );
      }
    )
  );
};

const getLookupKeys = (value) => {
  const normalized = normalizeText(value).trim();
  return [normalized, normalized.replace(/[^a-z0-9]/g, "")].filter(Boolean);
};

const applyInlineTextStyleFallbacks = (content, requestedStyles) => {
  const styleText = [
    ...String(content || "").matchAll(/style\s*=\s*["']([^"']*)["']/gi)
  ]
    .map((match) => match[1])
    .join(";");
  if (!styleText) {
    return;
  }
  const declarations = new Map();
  styleText.split(";").forEach((declaration) => {
    const separator = declaration.indexOf(":");
    if (separator <= 0) {
      return;
    }
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const value = declaration.slice(separator + 1).trim();
    if (value && !declarations.has(property)) {
      declarations.set(property, value);
    }
  });
  const setIfMissing = (key, value) => {
    if (requestedStyles[key] === undefined && value !== undefined) {
      requestedStyles[key] = value;
    }
  };
  const pixels = (property) => {
    const match = declarations
      .get(property)
      ?.match(/^([0-9]+(?:\.[0-9]+)?)px$/i);
    return match ? Number(match[1]) : undefined;
  };
  setIfMissing(
    "background",
    declarations.get("background-color") || declarations.get("background")
  );
  setIfMissing("color", declarations.get("color"));
  setIfMissing("padding", pixels("padding"));
  setIfMissing("borderRadius", pixels("border-radius"));
  setIfMissing("fontSize", pixels("font-size"));
  const border = declarations
    .get("border")
    ?.match(/^([0-9]+(?:\.[0-9]+)?)px\s+(solid|dashed|dotted|double)\s+(.+)$/i);
  if (border) {
    setIfMissing("borderWidth", Number(border[1]));
    setIfMissing("borderStyle", border[2].toLowerCase());
    setIfMissing("borderColor", border[3]);
  }
};

const expandTwoColumnTextBlocks = (values, region) => {
  return (Array.isArray(values) ? values : []).flatMap((source) => {
    const decodedContent = decodeAIHtmlEntities(source?.content);
    const normalizedSource = source
      ? { ...source, content: decodedContent }
      : source;
    if (
      region !== "body" ||
      !normalizedSource ||
      typeof normalizedSource !== "object" ||
      Array.isArray(normalizedSource) ||
      String(normalizedSource.type || "text") !== "text" ||
      !String(decodedContent || "").trim() ||
      typeof DOMParser === "undefined" ||
      typeof XMLSerializer === "undefined"
    ) {
      return [normalizedSource];
    }

    const parsedDocument = new DOMParser().parseFromString(
      sanitizeRichTextHtml(decodedContent),
      "text/html"
    );
    const topLevelElements = Array.from(parsedDocument.body.children);
    const layoutRoot =
      topLevelElements.length === 1 ? topLevelElements[0] : null;
    const layoutStyle = String(layoutRoot?.getAttribute("style") || "");
    const isColumnLayout =
      /display\s*:\s*(?:flex|grid)/i.test(layoutStyle) ||
      /grid-template-columns\s*:/i.test(layoutStyle);
    const columns = layoutRoot ? Array.from(layoutRoot.children) : [];
    if (!isColumnLayout || columns.length !== 2) {
      return [normalizedSource];
    }

    const gapMatch = layoutStyle.match(
      /(?:column-gap|gap)\s*:\s*([0-9]+(?:\.[0-9]+)?)px/i
    );
    const requestedGap = gapMatch ? Number(gapMatch[1]) : 12;
    const gapPercent = Math.min(8, Math.max(1, (requestedGap / 7.14) * 1));
    const columnWidthPercent = (100 - gapPercent) / 2;
    const sharedStyles = { ...(source.styles || {}) };
    applyInlineTextStyleFallbacks(`style="${layoutStyle}"`, sharedStyles);
    const serializer = new XMLSerializer();
    return columns.map((column, index) => ({
      ...source,
      content: (() => {
        const normalizedColumn = column.cloneNode(true);
        [
          "width",
          "min-width",
          "max-width",
          "flex",
          "flex-basis",
          "grid-column"
        ].forEach((property) =>
          normalizedColumn.style.removeProperty(property)
        );
        return serializer.serializeToString(normalizedColumn);
      })(),
      widthPercent: columnWidthPercent,
      xPercent: index === 0 ? 0 : columnWidthPercent + gapPercent,
      horizontalAlign: "left",
      styles: {
        ...sharedStyles,
        x: null,
        width: null,
        height: null,
        y: hasFiniteNumber(sharedStyles.y) ? Number(sharedStyles.y) : 0
      }
    }));
  });
};

const resolveAIFields = (values, fields) => {
  if (!Array.isArray(values)) {
    return { fields: null, unmatched: [] };
  }
  const fieldsByName = new Map();
  (fields || []).forEach((field) => {
    [...getLookupKeys(field.apiName), ...getLookupKeys(field.label)].forEach(
      (key) => {
        if (!fieldsByName.has(key)) {
          fieldsByName.set(key, field);
        }
      }
    );
  });

  const resolved = [];
  const unmatched = [];
  values.forEach((value) => {
    const requestedValue =
      value && typeof value === "object"
        ? value.apiName || value.label || ""
        : value;
    const field = getLookupKeys(requestedValue)
      .map((key) => fieldsByName.get(key))
      .find(Boolean);
    if (field && !resolved.some((item) => item.apiName === field.apiName)) {
      resolved.push(field);
    } else if (!field) {
      unmatched.push(String(requestedValue));
    }
  });
  return { fields: resolved, unmatched };
};

const resolveAIBlockContent = ({
  content,
  objectApiName,
  fields,
  unmatchedFields
}) => {
  const fieldsByName = new Map();
  (fields || []).forEach((field) => {
    [...getLookupKeys(field.apiName), ...getLookupKeys(field.label)].forEach(
      (key) => {
        if (!fieldsByName.has(key)) {
          fieldsByName.set(key, field);
        }
      }
    );
  });

  let resolved = decodeAIHtmlEntities(content);
  resolved = resolved.replace(
    /\{\{\s*field(?:\s*[:.]\s*)([^}]+)\s*\}\}/gi,
    (_match, requestedName) => {
      const field = getLookupKeys(requestedName)
        .map((key) => fieldsByName.get(key))
        .find(Boolean);
      if (!field) {
        unmatchedFields.push(String(requestedName).trim());
        return "";
      }
      return `{!${objectApiName}.${field.apiName}}`;
    }
  );
  resolved = resolved.replace(
    /\{\{\s*organization(?:\s*[:.]\s*)([^}]+)\s*\}\}/gi,
    (_match, requestedName) => {
      const fieldName = [...ORGANIZATION_FIELD_NAMES].find(
        (name) => normalizeText(name) === normalizeText(requestedName).trim()
      );
      if (!fieldName) {
        unmatchedFields.push(`Organization.${String(requestedName).trim()}`);
        return "";
      }
      return `{!$Organization.${fieldName}}`;
    }
  );

  resolved = resolved.replace(/\{!([^}]+)\}/g, (token, path) => {
    const normalizedPath = String(path || "").trim();
    if (normalizedPath.startsWith("$Organization.")) {
      const organizationField = normalizedPath.slice("$Organization.".length);
      return ORGANIZATION_FIELD_NAMES.has(organizationField) ? token : "";
    }
    const prefix = `${objectApiName}.`;
    if (!normalizedPath.toLowerCase().startsWith(prefix.toLowerCase())) {
      return "";
    }
    const requestedField = normalizedPath.slice(prefix.length);
    const field = getLookupKeys(requestedField)
      .map((key) => fieldsByName.get(key))
      .find(Boolean);
    return field ? `{!${objectApiName}.${field.apiName}}` : "";
  });
  return sanitizeRichTextHtml(resolved);
};

const normalizeAIBlockSpecs = ({
  value,
  region,
  objectApiName,
  fields,
  relatedLists,
  relatedListFields,
  regionTextColor
}) => {
  if (!Array.isArray(value)) {
    return { blocks: null, unmatchedFields: [], relatedList: null };
  }

  const unmatchedFields = [];
  let selectedRelatedList = null;
  const blocks = expandTwoColumnTextBlocks(value, region)
    .slice(0, 30)
    .map((source, index) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) {
        return null;
      }
      const requestedType = String(source.type || "text");
      const type = AI_BLOCK_TYPE_ALIASES[requestedType] || requestedType;
      if (!AI_BLOCK_TYPES.has(type)) {
        return null;
      }

      const requestedStyles = {
        ...(source.styles && typeof source.styles === "object"
          ? source.styles
          : {})
      };
      requestedStyles.color =
        requestedStyles.color ||
        requestedStyles.textColor ||
        source.textColor ||
        source.color ||
        regionTextColor;
      requestedStyles.background =
        requestedStyles.background ||
        requestedStyles.backgroundColor ||
        source.backgroundColor ||
        source.background;
      ["x", "y", "width", "height"].forEach((key) => {
        if (source[key] !== undefined && requestedStyles[key] === undefined) {
          requestedStyles[key] = source[key];
        }
      });
      if (type === "text") {
        applyInlineTextStyleFallbacks(source.content, requestedStyles);
      }
      if (["divider", "verticalLine"].includes(type)) {
        requestedStyles.lineColor =
          requestedStyles.lineColor || requestedStyles.borderColor;
        requestedStyles.lineStyle =
          requestedStyles.lineStyle || requestedStyles.borderStyle;
        requestedStyles.lineThickness =
          requestedStyles.lineThickness || requestedStyles.borderWidth;
      }

      let field = null;
      let relationship = null;
      let relatedColumns = [];
      if (type === "field") {
        const resolved = resolveAIFields(
          [source.fieldApiName || source.field || source.label],
          fields
        );
        field = resolved.fields?.[0] || null;
        unmatchedFields.push(...resolved.unmatched);
        if (!field) {
          return null;
        }
      }
      if (type === "relatedList") {
        if (selectedRelatedList) {
          return null;
        }
        relationship = findRelatedListOption(
          relatedLists,
          source.relationshipName ||
            source.relatedListRelationshipName ||
            source.label
        );
        if (!relationship) {
          unmatchedFields.push(
            String(
              source.relationshipName ||
                source.relatedListRelationshipName ||
                source.label ||
                "Related List"
            )
          );
          return null;
        }
        selectedRelatedList = relationship;
        if ((relatedListFields || []).length) {
          const resolved = resolveAIFields(
            source.columns || source.relatedListColumns || [],
            relatedListFields
          );
          relatedColumns = resolved.fields || [];
          unmatchedFields.push(...resolved.unmatched);
        }
      }

      const content = resolveAIBlockContent({
        content: removeConflictingInlineTypography(source.content, {
          color: requestedStyles.color,
          fontSize: requestedStyles.fontSize
        }),
        objectApiName,
        fields,
        unmatchedFields
      });
      if (
        type === "text" &&
        !String(content || "")
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;|&#160;/gi, " ")
          .trim()
      ) {
        return null;
      }
      const tableData = Array.isArray(source.tableData)
        ? source.tableData.slice(0, 12).map((row) => {
            return Array.isArray(row)
              ? row.slice(0, 12).map((cell) => {
                  const cellContent =
                    cell && typeof cell === "object" && !Array.isArray(cell)
                      ? cell.content
                      : cell;
                  return resolveAIBlockContent({
                    content: cellContent,
                    objectApiName,
                    fields,
                    unmatchedFields
                  });
                })
              : [];
          })
        : source.tableData;
      const minimumWidthPercent = ["divider", "verticalLine"].includes(type)
        ? 1
        : 20;
      const sanitized = sanitizeDocumentModel([
        {
          id: `ai-${region}-${index + 1}`,
          type,
          content,
          fieldApiName: field?.apiName,
          fieldLabel: field?.label,
          imageSrc: source.imageUrl || source.imageSrc,
          imageAlt: source.imageAlt || source.alt,
          tableData,
          relatedListRelationshipName: relationship?.relationshipName,
          relatedListLabel: relationship?.label,
          relatedListChildObjectApiName: relationship?.childObjectApiName,
          relatedListColumns: relatedColumns.map((item) => item.apiName),
          relatedListZebraEnabled: source.relatedListZebraEnabled,
          relatedListOddRowColor:
            source.relatedListOddRowColor || requestedStyles.tableOddRowColor,
          relatedListEvenRowColor:
            source.relatedListEvenRowColor || requestedStyles.tableEvenRowColor,
          relatedListHeaderRowColor:
            source.relatedListHeaderRowColor ||
            requestedStyles.tableHeaderRowColor,
          relatedListTextColor:
            source.relatedListHeaderTextColor ||
            source.relatedListTextColor ||
            requestedStyles.tableHeaderTextColor,
          relatedListOddTextColor:
            source.relatedListOddTextColor || requestedStyles.tableOddTextColor,
          relatedListEvenTextColor:
            source.relatedListEvenTextColor ||
            requestedStyles.tableEvenTextColor,
          relatedListFontSize: source.relatedListFontSize,
          relatedListBorderMode:
            source.relatedListBorderMode || requestedStyles.tableBorderMode,
          relatedListGridColor:
            source.relatedListGridColor || requestedStyles.tableBorderColor,
          relatedListBuilderRows: source.relatedListBuilderRows,
          styles: requestedStyles
        }
      ])?.[0];
      if (!sanitized) {
        return null;
      }
      const mergeTokenCount = (content.match(/\{![^}]+\}/g) || []).length;
      if (type === "text") {
        const plainContent = content
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const requestedFontSize = Number(sanitized.styles?.fontSize) || 14;
        const minimumFontSize =
          region === "header" ? 14 : region === "footer" ? 9 : 10;
        let normalizedFontSize = Math.max(minimumFontSize, requestedFontSize);
        if (mergeTokenCount > 1 && region === "body") {
          normalizedFontSize = Math.min(normalizedFontSize, 12);
        } else if (
          plainContent.length > 40 ||
          /<(?:ul|ol|li|p|div)\b/i.test(content)
        ) {
          normalizedFontSize = Math.min(
            normalizedFontSize,
            region === "header" ? 18 : 16
          );
        }
        sanitized.styles.fontSize = normalizedFontSize;
      }

      return {
        ...sanitized,
        displayMode: AI_BLOCK_DISPLAY_MODES.has(source.displayMode)
          ? source.displayMode
          : "labelAndValue",
        widthPercent: clamp(
          source.widthPercent,
          minimumWidthPercent,
          100,
          null
        ),
        xPercent: clamp(source.xPercent, 0, 95, null),
        horizontalAlign: ["left", "center", "right"].includes(
          source.horizontalAlign
        )
          ? source.horizontalAlign
          : "left",
        section: clamp(source.section, 1, 2, 1),
        gapAfter: clamp(source.gapAfter, 0, 120, 12),
        relatedListColumnDefinitions: relatedColumns.map((item) => ({
          apiName: item.apiName,
          label: item.label,
          ...(item.dataType ? { dataType: item.dataType } : {})
        }))
      };
    })
    .filter(Boolean);

  return {
    blocks,
    unmatchedFields: [...new Set(unmatchedFields.filter(Boolean))],
    relatedList: selectedRelatedList
  };
};

const completeMixedBodyBlocks = (patch, recipe) => {
  const blocks = [...(patch.bodyBlocks || [])];
  const objectApiName = patch.objectApiName || recipe.objectApiName;
  const searchableContent = () =>
    blocks
      .map((block) => String(block.content || ""))
      .join(" ")
      .toLowerCase();
  const containsText = (value) =>
    searchableContent().includes(
      String(value || "")
        .trim()
        .toLowerCase()
    );

  if (
    patch.includeBodyTitle &&
    patch.documentTitle &&
    !containsText(patch.documentTitle)
  ) {
    blocks.unshift({
      type: "text",
      content: `<strong>${escapeHtml(patch.documentTitle)}</strong>`,
      widthPercent: 100,
      horizontalAlign: "center",
      gapAfter: 12,
      styles: {
        color: patch.primaryColor || recipe.primaryColor,
        fontSize: 24,
        fontWeight: "bold",
        textAlign: "center",
        padding: 4
      }
    });
  }

  const missingFields = (patch.bodyFields || []).filter(
    (field) =>
      !containsText(`{!${objectApiName}.${field.apiName}}`) &&
      !containsText(`{{field:${field.apiName}}}`)
  );
  if (missingFields.length) {
    blocks.splice(patch.includeBodyTitle ? 1 : 0, 0, {
      type: "text",
      content: missingFields
        .map((field) => getFieldContent(objectApiName, field, "labelAndValue"))
        .join(""),
      widthPercent: 100,
      gapAfter: 12,
      styles: {
        background: patch.bodyContentBackground || "transparent",
        color: patch.textColor || recipe.textColor,
        padding: patch.bodyContentPadding ?? recipe.bodyContentPadding,
        borderStyle:
          patch.bodyContentBorderStyle || recipe.bodyContentBorderStyle,
        borderWidth:
          patch.bodyContentBorderWidth ?? recipe.bodyContentBorderWidth,
        borderColor:
          patch.bodyContentBorderColor || recipe.bodyContentBorderColor,
        borderRadius:
          patch.bodyContentBorderRadius ?? recipe.bodyContentBorderRadius,
        fontSize: 14
      }
    });
  }

  if (
    patch.includeRelatedList &&
    patch.relatedListRelationshipName &&
    patch.relatedListColumns?.length &&
    !blocks.some((block) => block.type === "relatedList")
  ) {
    const relatedListBlock = {
      type: "relatedList",
      relatedListRelationshipName: patch.relatedListRelationshipName,
      relatedListLabel: patch.relatedListLabel,
      relatedListChildObjectApiName: patch.relatedListChildObjectApiName,
      relatedListColumns: [...patch.relatedListColumns],
      relatedListColumnDefinitions: [
        ...(patch.relatedListColumnDefinitions || [])
      ],
      ...getRelatedListAppearance(patch, recipe),
      widthPercent: 100,
      gapAfter: 12,
      styles: {}
    };
    const totalIndex = blocks.findIndex((block) =>
      /\b(total|subtotal|grand total|importe total)\b/i.test(
        String(block.content || "")
      )
    );
    if (totalIndex >= 0) {
      blocks.splice(totalIndex, 0, relatedListBlock);
    } else {
      blocks.push(relatedListBlock);
    }
  }

  if (
    patch.includeRelatedListTotal &&
    patch.relatedListTotalFieldApiName &&
    !blocks.some((block) =>
      /\b(total|subtotal|grand total|importe total)\b/i.test(
        String(block.content || "")
      )
    )
  ) {
    const label = patch.relatedListTotalLabel || "Total";
    blocks.push({
      type: "text",
      content: `<strong>${escapeHtml(label.toUpperCase())}:</strong>&nbsp;<strong>{!${objectApiName}.${patch.relatedListTotalFieldApiName}}</strong>`,
      widthPercent: 100,
      gapAfter: 16,
      styles: {
        background:
          patch.relatedListHeaderRowColor || recipe.primaryColor || "#032d60",
        color: patch.relatedListHeaderTextColor || "#ffffff",
        padding: 16,
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center"
      }
    });
  }

  const editorialBoxes = normalizeBodyTextBoxes(patch.bodyTextBoxes) || [];
  editorialBoxes.forEach((box, index) => {
    if (containsText(box.title)) {
      return;
    }
    const isHalf = box.layout === "half";
    const previousHalfCount = editorialBoxes
      .slice(0, index)
      .filter((item) => item.layout === "half").length;
    blocks.push({
      type: "text",
      content: getBodyTextBoxContent(
        box,
        patch.primaryColor || recipe.primaryColor
      ),
      widthPercent: isHalf ? 49 : 100,
      xPercent: isHalf && previousHalfCount % 2 === 1 ? 51 : 0,
      y: isHalf ? 100000 + Math.floor(previousHalfCount / 2) : undefined,
      gapAfter: isHalf ? 12 : 16,
      styles: {
        background: patch.bodyContentBackground || "#ffffff",
        color: patch.textColor || recipe.textColor,
        padding: Math.max(
          8,
          patch.bodyContentPadding ?? recipe.bodyContentPadding
        ),
        borderStyle: patch.bodyContentBorderStyle || "solid",
        borderWidth: Math.max(1, patch.bodyContentBorderWidth || 0),
        borderColor: patch.bodyContentBorderColor || "#c9c9c9",
        borderRadius:
          patch.bodyContentBorderRadius ?? recipe.bodyContentBorderRadius,
        fontSize: 14
      }
    });
  });
  if (patch.includeBodyTitle && patch.documentTitle) {
    const titleIndex = blocks.findIndex((block) =>
      String(block.content || "")
        .toLowerCase()
        .includes(String(patch.documentTitle).trim().toLowerCase())
    );
    if (titleIndex > 0) {
      const [titleBlock] = blocks.splice(titleIndex, 1);
      blocks.unshift(titleBlock);
    }
  }
  return blocks;
};

const completeHeaderBlocks = (patch, recipe) => {
  const blocks = [...(patch.headerBlocks || [])];
  const objectApiName = patch.objectApiName || recipe.objectApiName;
  const content = () =>
    blocks.map((block) => String(block.content || "")).join(" ");
  const textBlocks = () =>
    blocks.filter((block) => ["text", "field"].includes(block.type));
  const desiredOrganizationName =
    patch.includeOrganizationName ?? recipe.includeOrganizationName;
  if (desiredOrganizationName && !content().includes("{!$Organization.Name}")) {
    const organizationMarkup = "<strong>{!$Organization.Name}</strong>";
    if (textBlocks().length) {
      const target = textBlocks()[0];
      target.content = [organizationMarkup, target.content]
        .filter(Boolean)
        .join("&nbsp;&nbsp;");
    } else {
      blocks.unshift({
        type: "text",
        content: organizationMarkup,
        widthPercent: 100,
        gapAfter: 0,
        styles: {}
      });
    }
  }

  const desiredFields = patch.headerFields || recipe.headerFields || [];
  desiredFields.forEach((field) => {
    const token = `{!${objectApiName}.${field.apiName}}`;
    if (!content().includes(token)) {
      blocks.push({
        type: "text",
        content: getFieldContent(objectApiName, field, "labelAndValue"),
        widthPercent: 100,
        gapAfter: 0,
        styles: {}
      });
    }
  });

  const styleMap = {
    background: patch.headerContentBackground,
    padding: patch.headerContentPadding,
    borderStyle: patch.headerContentBorderStyle,
    borderWidth: patch.headerContentBorderWidth,
    borderColor: patch.headerContentBorderColor,
    borderRadius: patch.headerContentBorderRadius,
    color: patch.headerTextColor
  };
  blocks.forEach((block) => {
    if (!["text", "field"].includes(block.type)) {
      return;
    }
    block.styles = { ...(block.styles || {}) };
    Object.entries(styleMap).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        block.styles[key] = value;
      }
    });
  });
  return blocks;
};

export const applyAIWizardProposal = ({
  recipe,
  step,
  generatedJson,
  objects = [],
  fields = [],
  relatedLists = [],
  relatedListFields = [],
  recordTypes = []
}) => {
  const {
    patch: rawPatch,
    summary,
    unapplied
  } = parseAIResponse(generatedJson);
  const allowedKeys = new Set(AI_STEP_KEYS[step] || []);
  const patch = {};
  const unmatchedFields = [];
  const normalizedRawPatch = { ...rawPatch };
  Object.entries(AI_KEY_ALIASES).forEach(([alias, canonical]) => {
    if (
      Object.prototype.hasOwnProperty.call(rawPatch, alias) &&
      !Object.prototype.hasOwnProperty.call(normalizedRawPatch, canonical)
    ) {
      normalizedRawPatch[canonical] = rawPatch[alias];
    }
    delete normalizedRawPatch[alias];
  });

  Object.entries(normalizedRawPatch).forEach(([key, value]) => {
    if (!allowedKeys.has(key)) {
      return;
    }

    if (AI_BOOLEAN_KEYS.has(key)) {
      if (typeof value === "boolean") {
        patch[key] = value;
      }
      return;
    }

    if (AI_COLOR_KEYS.has(key)) {
      const color = normalizeColor(value, null);
      if (color) {
        patch[key] = color;
      }
      return;
    }

    if (key === "pagePadding") {
      patch[key] = clamp(value, 0, 96, recipe.pagePadding);
      return;
    }
    if (key === "elementPadding") {
      patch[key] = clamp(value, 0, 48, recipe.elementPadding);
      return;
    }
    if (key === "headerContentPadding") {
      patch[key] = clamp(value, 0, 48, recipe.headerContentPadding);
      return;
    }
    if (key === "headerContentBorderWidth") {
      patch[key] = clamp(value, 0, 12, recipe.headerContentBorderWidth);
      return;
    }
    if (key === "headerContentBorderRadius") {
      patch[key] = clamp(value, 0, 48, recipe.headerContentBorderRadius);
      return;
    }
    if (key === "bodyContentPadding") {
      patch[key] = clamp(value, 0, 48, recipe.bodyContentPadding);
      return;
    }
    if (key === "bodyContentBorderWidth") {
      patch[key] = clamp(value, 0, 12, recipe.bodyContentBorderWidth);
      return;
    }
    if (key === "bodyContentBorderRadius") {
      patch[key] = clamp(value, 0, 48, recipe.bodyContentBorderRadius);
      return;
    }
    if (key === "relatedListFontSize") {
      patch[key] = clamp(value, 8, 36, recipe.relatedListFontSize);
      return;
    }

    if (key === "objectApiName") {
      const objectOption = findOption(objects, "apiName", value);
      if (objectOption) {
        patch[key] = objectOption.apiName;
      }
      return;
    }

    if (key === "recordTypeScope") {
      const recordType = findOption(recordTypes, "value", value);
      if (recordType) {
        patch[key] = recordType.value;
      }
      return;
    }

    if (key === "headerFields" || key === "bodyFields") {
      const resolved = resolveAIFields(value, fields);
      if (resolved.fields) {
        patch[key] =
          key === "headerFields"
            ? resolved.fields.slice(0, MAX_HEADER_RECORD_FIELDS)
            : resolved.fields;
        unmatchedFields.push(...resolved.unmatched);
      }
      return;
    }

    if (key === "bodyTextBoxes") {
      const textBoxes = normalizeBodyTextBoxes(value);
      if (textBoxes) {
        patch[key] = textBoxes;
      }
      return;
    }

    if (["headerBlocks", "bodyBlocks", "footerBlocks"].includes(key)) {
      const region = key.replace("Blocks", "");
      const normalized = normalizeAIBlockSpecs({
        value,
        region,
        objectApiName: recipe.objectApiName,
        fields,
        relatedLists,
        relatedListFields,
        regionTextColor:
          region === "header"
            ? normalizedRawPatch.headerTextColor
            : region === "footer"
              ? normalizedRawPatch.footerTextColor
              : normalizedRawPatch.textColor
      });
      if (normalized.blocks?.length) {
        patch[key] = normalized.blocks;
      }
      unmatchedFields.push(...normalized.unmatchedFields);
      if (normalized.relatedList) {
        patch.includeRelatedList = true;
        patch.relatedListRelationshipName =
          normalized.relatedList.relationshipName;
        patch.relatedListChildObjectApiName =
          normalized.relatedList.childObjectApiName;
        patch.relatedListLabel = normalized.relatedList.label;
        const relatedListBlock = normalized.blocks?.find(
          (block) => block.type === "relatedList"
        );
        if (relatedListBlock?.relatedListColumns?.length) {
          patch.relatedListColumns = [...relatedListBlock.relatedListColumns];
        }
        Object.entries(RELATED_LIST_RECIPE_PROPERTY_MAP).forEach(
          ([recipeKey, blockKey]) => {
            if (relatedListBlock?.[blockKey] != null) {
              patch[recipeKey] = relatedListBlock[blockKey];
            }
          }
        );
      }
      return;
    }

    if (key === "relatedListColumns") {
      const resolved = resolveAIFields(value, relatedListFields);
      if (resolved.fields) {
        patch[key] = resolved.fields.map((field) => field.apiName);
        unmatchedFields.push(...resolved.unmatched);
      }
      return;
    }

    if (key === "relatedListTotalFieldApiName") {
      const resolved = resolveAIFields([value], fields);
      if (resolved.fields?.length) {
        patch[key] = resolved.fields[0].apiName;
      } else {
        unmatchedFields.push(...resolved.unmatched);
      }
      return;
    }

    if (key === "relatedListRelationshipName") {
      const relatedList = findRelatedListOption(relatedLists, value);
      if (relatedList) {
        patch.relatedListRelationshipName = relatedList.relationshipName;
        patch.relatedListChildObjectApiName = relatedList.childObjectApiName;
        patch.relatedListLabel = relatedList.label;
        patch.includeRelatedList = true;
      }
      return;
    }

    if (AI_ENUM_VALUES[key]) {
      if (AI_ENUM_VALUES[key].includes(value)) {
        patch[key] = value;
      }
      return;
    }

    if (key === "imageUrl") {
      patch[key] = normalizeImageUrl(value);
      return;
    }

    if (key === "fontFamily") {
      if (AI_FONT_FAMILIES.has(value)) {
        patch[key] = value;
      }
      return;
    }

    if (typeof value === "string") {
      patch[key] = value.slice(0, key === "footerText" ? 500 : 160);
    }
  });

  const headerContentBoxStyled = [
    "headerContentPadding",
    "headerContentBorderStyle",
    "headerContentBorderWidth",
    "headerContentBorderColor",
    "headerContentBorderRadius"
  ].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
  if (
    step === "header" &&
    headerContentBoxStyled &&
    patch.headerBackground &&
    !patch.headerContentBackground
  ) {
    patch.headerContentBackground = patch.headerBackground;
    patch.headerBackground = "transparent";
  }

  const bodyContentBoxStyled = [
    "bodyContentBackground",
    "bodyContentPadding",
    "bodyContentBorderStyle",
    "bodyContentBorderWidth",
    "bodyContentBorderColor",
    "bodyContentBorderRadius"
  ].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
  if (
    step === "body" &&
    bodyContentBoxStyled &&
    (patch.bodyFields?.length || recipe.bodyFields?.length)
  ) {
    patch.groupBodyFields = true;
  }
  if (step === "body" && patch.bodyTextBoxes?.length) {
    patch.bodyLayout = "one";
  }

  // A custom block array replaces the complete region. Models occasionally
  // return a partial bodyBlocks array together with standard body controls.
  // Keeping both makes the partial array win during rendering and silently
  // drops titles, fields and editorial boxes. Prefer the complete, validated
  // standard representation whenever the response mixes both contracts.
  const standardBodyStructureKeys = [
    "includeBodyTitle",
    "documentTitle",
    "bodyLayout",
    "fieldDisplayMode",
    "bodyFields",
    "groupBodyFields",
    "includeOrganizationBodyBox",
    "bodyTextBoxes",
    "includeBodyDivider",
    "includeRelatedList",
    "relatedListRelationshipName",
    "relatedListColumns",
    "includeRelatedListTotal",
    "relatedListTotalLabel",
    "relatedListTotalFieldApiName"
  ];
  const mixedBodyRepresentations =
    step === "body" &&
    patch.bodyBlocks?.length &&
    standardBodyStructureKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(normalizedRawPatch, key)
    );
  if (mixedBodyRepresentations) {
    patch.bodyBlocks = completeMixedBodyBlocks(patch, recipe);
  }
  if (step === "header" && patch.headerBlocks?.length) {
    patch.headerBlocks = completeHeaderBlocks(patch, recipe);
  }

  return {
    recipe: { ...recipe, ...patch },
    acceptedKeys: Object.keys(patch),
    changes: Object.keys(patch).filter(
      (key) => JSON.stringify(recipe[key]) !== JSON.stringify(patch[key])
    ),
    summary,
    unapplied,
    unmatchedFields: [...new Set(unmatchedFields)]
  };
};

export const applyGuidedWizardPrompt = ({
  recipe,
  step,
  prompt,
  objects = [],
  fields = [],
  relatedLists = [],
  relatedListFields = []
}) => {
  const next = JSON.parse(JSON.stringify(recipe));
  const normalized = normalizeText(prompt);
  const color = getRequestedColor(prompt);
  const changes = [];

  if (!normalized) {
    return { recipe: next, changes };
  }

  if (step === "context") {
    if (!next.templateName) {
      next.templateName = String(prompt).trim().slice(0, 80);
      next.documentTitle = next.templateName;
      changes.push("Template name");
    }
    if (includesAny(normalized, ["default", "predeterminad"])) {
      next.isDefault = true;
      changes.push("Default template");
    }
    const matchedObjects = findPromptMatches(objects, prompt);
    if (matchedObjects.length) {
      next.objectApiName = matchedObjects[0].apiName;
      changes.push(`Object: ${matchedObjects[0].label}`);
    }
  }

  if (step === "style") {
    if (color) {
      next.primaryColor = color;
      changes.push("Primary color");
    }
    if (includesAny(normalized, ["dos columna", "two column"])) {
      next.bodyLayout = "two";
      changes.push("Two body columns");
    }
    if (includesAny(normalized, ["compact", "compacto"])) {
      next.spacing = "compact";
      next.elementPadding = 4;
      changes.push("Compact spacing");
    }
    if (includesAny(normalized, ["amplio", "spacious", "espacioso"])) {
      next.spacing = "spacious";
      next.elementPadding = 14;
      changes.push("Spacious spacing");
    }
  }

  if (step === "header") {
    if (color) {
      next.headerBackground = color;
      next.headerTextColor = color === "#ffffff" ? "#181818" : "#ffffff";
      changes.push("Header colors");
    }
    if (includesAny(normalized, ["logo", "imagen", "image"])) {
      next.includeHeaderImage = true;
      changes.push("Header image");
    }
    if (includesAny(normalized, ["derecha", "right"])) {
      next.headerImageAlignment = "right";
      changes.push("Right alignment");
    } else if (includesAny(normalized, ["centro", "center", "centrad"])) {
      next.headerImageAlignment = "center";
      changes.push("Center alignment");
    } else if (includesAny(normalized, ["izquierda", "left"])) {
      next.headerImageAlignment = "left";
      changes.push("Left alignment");
    }
    const matchedFields = findPromptMatches(fields, prompt);
    if (matchedFields.length) {
      next.headerFields = matchedFields.slice(0, MAX_HEADER_RECORD_FIELDS);
      changes.push("Header fields");
    }
  }

  if (step === "body") {
    if (includesAny(normalized, ["dos columna", "two column"])) {
      next.bodyLayout = "two";
      changes.push("Two body columns");
    }
    const matchedFields = findPromptMatches(fields, prompt);
    if (matchedFields.length) {
      next.bodyFields = matchedFields;
      changes.push("Body fields");
    }
    const matchedLists = rankRelatedLists(
      findPromptMatches(relatedLists, prompt)
    );
    if (matchedLists.length) {
      const selected = matchedLists[0];
      next.includeRelatedList = true;
      next.relatedListRelationshipName = selected.relationshipName;
      next.relatedListChildObjectApiName = selected.childObjectApiName;
      next.relatedListLabel = selected.label;
      next.relatedListColumns = [];
      changes.push(`Related List: ${selected.label}`);
    }
  }

  if (step === "relatedList") {
    if (color) {
      next.relatedListHeaderRowColor = color;
      next.relatedListHeaderTextColor =
        color === "#ffffff" ? "#181818" : "#ffffff";
      changes.push("Related List header colors");
    }
    const matchedColumns = findPromptMatches(relatedListFields, prompt);
    if (matchedColumns.length) {
      next.relatedListColumns = matchedColumns.map((field) => field.apiName);
      changes.push("Related List columns");
    }
    if (includesAny(normalized, ["sin linea", "no line"])) {
      next.relatedListBorderMode = "none";
      changes.push("No grid lines");
    }
  }

  if (step === "footer") {
    if (includesAny(normalized, ["footer", "pie de pagina", "pie pagina"])) {
      next.showFooter = true;
      changes.push("Footer visibility");
    }
    if (
      includesAny(normalized, [
        "do not repeat",
        "dont repeat",
        "only first page",
        "no repetir",
        "solo primera pagina"
      ])
    ) {
      next.repeatFooterOnEachPage = false;
      changes.push("Footer repetition");
    } else if (
      includesAny(normalized, [
        "repeat",
        "every page",
        "repetir",
        "cada pagina"
      ])
    ) {
      next.repeatFooterOnEachPage = true;
      changes.push("Footer repetition");
    }
    if (
      includesAny(normalized, [
        "organization",
        "company name",
        "empresa",
        "organizacion"
      ])
    ) {
      next.includeFooterOrganizationName = true;
      changes.push("Footer organization name");
    }
    if (color) {
      next.footerBackground = color;
      next.footerTextColor = color === "#ffffff" ? "#181818" : "#ffffff";
      changes.push("Footer colors");
    }
    if (includesAny(normalized, ["dark blue", "navy", "azul oscuro"])) {
      next.footerBackground = "#032d60";
      changes.push("Footer background");
    }
    if (
      includesAny(normalized, ["white text", "texto blanco", "letras blancas"])
    ) {
      next.footerTextColor = "#ffffff";
      changes.push("Footer text color");
    }
    if (includesAny(normalized, ["derecha", "right"])) {
      next.footerAlignment = "right";
      changes.push("Footer alignment");
    } else if (includesAny(normalized, ["izquierda", "left"])) {
      next.footerAlignment = "left";
      changes.push("Footer alignment");
    } else if (includesAny(normalized, ["centro", "center", "centrad"])) {
      next.footerAlignment = "center";
      changes.push("Footer alignment");
    }
    const quotedText = String(prompt).match(/[“"]([^”"]+)[”"]/)?.[1];
    if (quotedText) {
      next.footerText = quotedText;
      changes.push("Footer text");
    }
  }

  return { recipe: next, changes };
};
