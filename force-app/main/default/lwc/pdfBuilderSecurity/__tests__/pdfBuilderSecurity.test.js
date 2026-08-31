import {
  normalizeColor,
  normalizeImageUrl,
  normalizeLinkUrl,
  sanitizeDocumentModel,
  sanitizeRichTextHtml
} from "c/pdfBuilderSecurity";

describe("pdfBuilderSecurity", () => {
  const activeScheme = `${"java"}script:`;
  describe("sanitizeRichTextHtml", () => {
    it("preserves supported rich text and removes executable markup", () => {
      const result = sanitizeRichTextHtml(
        '<p style="font-weight:700;color:#0176d3" onclick="alert(1)">' +
          "<strong>Safe</strong><script>alert(1)</script>" +
          '<a href="javascript:alert(1)" target="_blank">link</a></p>'
      );

      expect(result).toContain("<strong>Safe</strong>");
      expect(result).toContain("font-weight:700");
      expect(result).toMatch(/color:(?:#0176d3|rgb\(1, 118, 211\))/);
      expect(result).not.toMatch(/script|onclick|javascript:/i);
    });

    it.each([
      `<img src="${activeScheme}alert(1)">`,
      '<img src="data:image/svg+xml;base64,PHN2Zy8+">',
      "<svg><script>alert(1)</script></svg>",
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      '<math><mi xlink:href="data:x,<script>alert(1)</script>"></mi></math>',
      '<p style="background:url(javascript:alert(1))">unsafe</p>',
      '<a href="java&#x73;cript:alert(1)">unsafe</a>'
    ])("blocks a known HTML bypass: %s", (payload) => {
      const result = sanitizeRichTextHtml(payload);
      expect(result).not.toMatch(
        /javascript:|<script|<svg|<iframe|<math|url\s*\(/i
      );
    });

    it("normalizes safe links opened in a new tab", () => {
      const result = sanitizeRichTextHtml(
        '<a href="https://example.com/path" target="_blank" rel="opener">Example</a>'
      );
      expect(result).toContain('href="https://example.com/path"');
      expect(result).toContain('target="_blank"');
      expect(result).toContain('rel="noopener noreferrer"');
    });

    it("preserves supported table-cell images", () => {
      const result = sanitizeRichTextHtml(
        '<img class="table-cell-image unknown" src="/resource/PDFBuilderLogo" alt="Logo">'
      );
      expect(result).toContain('class="table-cell-image"');
      expect(result).toContain('src="/resource/PDFBuilderLogo"');
      expect(result).not.toContain("unknown");
    });
  });

  describe("URL and color validation", () => {
    it("accepts only renderable raster or same-origin image URLs", () => {
      expect(normalizeImageUrl("/resource/BrandLogo")).toBe(
        "/resource/BrandLogo"
      );
      expect(normalizeImageUrl("https://example.com/logo.png")).toBe(
        "https://example.com/logo.png"
      );
      expect(normalizeImageUrl(`${activeScheme}alert(1)`)).toBe("");
      expect(
        normalizeImageUrl("data:text/html,<script>alert(1)</script>")
      ).toBe("");
    });

    it("accepts supported link schemes only", () => {
      expect(normalizeLinkUrl("mailto:team@example.com")).toBe(
        "mailto:team@example.com"
      );
      expect(normalizeLinkUrl(`${activeScheme}alert(1)`)).toBe("");
    });

    it("rejects CSS injected as a page color", () => {
      expect(normalizeColor("#ffffff", "#000000")).toBe("#ffffff");
      expect(normalizeColor("rgb(16, 75, 160)", "#ffffff")).toBe(
        "rgb(16, 75, 160)"
      );
      expect(normalizeColor("rgba(16,75,160,0.5)", "#ffffff")).toBe(
        "rgba(16,75,160,0.5)"
      );
      expect(normalizeColor("red;}</style><script>", "#ffffff")).toBe(
        "#ffffff"
      );
      expect(normalizeColor("rgb(999,75,160)", "#ffffff")).toBe("#ffffff");
    });
  });

  describe("sanitizeDocumentModel", () => {
    it("keeps the supported schema and removes unknown or active values", () => {
      const result = sanitizeDocumentModel({
        pageBackground: "#ffffff;}</style><script>alert(1)</script>",
        unexpectedDocumentProperty: "unsafe",
        header: {
          id: "header",
          label: "Header",
          styles: { background: "#ffffff", position: "fixed" },
          blocks: [
            {
              id: "text-1",
              type: "text",
              content: `<b>Allowed</b><img src="${activeScheme}alert(1)">`,
              unexpectedBlockProperty: "unsafe",
              styles: {
                color: "#181818",
                fontSize: 14,
                textAlign: "expression(alert(1))",
                position: "fixed"
              }
            }
          ]
        },
        body: { layout: "three", sections: [] },
        footer: { id: "footer", label: "Footer", styles: {}, blocks: [] }
      });

      expect(result.pageBackground).toBe("#ffffff");
      expect(result).not.toHaveProperty("unexpectedDocumentProperty");
      expect(result.header.styles).not.toHaveProperty("position");
      expect(result.header.blocks[0]).not.toHaveProperty(
        "unexpectedBlockProperty"
      );
      expect(result.header.blocks[0].content).toContain("<b>Allowed</b>");
      expect(result.header.blocks[0].content).not.toContain(activeScheme);
      expect(result.header.blocks[0].styles).not.toHaveProperty("textAlign");
      expect(result.body.layout).toBe("one");
    });

    it("sanitizes rich HTML stored inside table cells", () => {
      const result = sanitizeDocumentModel({
        header: { blocks: [], styles: {} },
        body: {
          layout: "one",
          sections: [
            {
              id: "body-1",
              styles: {},
              blocks: [
                {
                  id: "table-1",
                  type: "table",
                  styles: { tableRows: 1, tableColumns: 1 },
                  tableData: [
                    [{ content: `<img src="${activeScheme}alert(1)">Safe` }]
                  ]
                }
              ]
            }
          ]
        },
        footer: { blocks: [], styles: {} }
      });

      expect(result.body.sections[0].blocks[0].tableData[0][0].content).toBe(
        "Safe"
      );
    });

    it("clears repeat flags when their fixed region is hidden", () => {
      const result = sanitizeDocumentModel({
        showHeader: false,
        showFooter: false,
        repeatHeaderOnEachPage: true,
        repeatFooterOnEachPage: true,
        header: { blocks: [], styles: {} },
        body: { sections: [] },
        footer: { blocks: [], styles: {} }
      });

      expect(result.repeatHeaderOnEachPage).toBe(false);
      expect(result.repeatFooterOnEachPage).toBe(false);
    });
  });
});
