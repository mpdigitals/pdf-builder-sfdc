import { createElement } from "@lwc/engine-dom";
import PDFBuilder from "c/pdfBuilder";
import getConfiguration from "@salesforce/apex/PDFBuilderController.getConfiguration";
import getObjects from "@salesforce/apex/PDFBuilderController.getObjects";
import getFields from "@salesforce/apex/PDFBuilderController.getFields";
import getRelatedLists from "@salesforce/apex/PDFBuilderController.getRelatedLists";
import getRelatedListFields from "@salesforce/apex/PDFBuilderController.getRelatedListFields";
import getRecordTypeOptions from "@salesforce/apex/PDFBuilderController.getRecordTypeOptions";
import getTemplates from "@salesforce/apex/PDFBuilderController.getTemplates";
import getTemplate from "@salesforce/apex/PDFBuilderController.getTemplate";
import saveTemplate from "@salesforce/apex/PDFBuilderController.saveTemplate";
import renderGeneratedHtmlForPreview from "@salesforce/apex/PDFBuilderController.renderGeneratedHtmlForPreview";

jest.mock(
  "@salesforce/apex/PDFBuilderController.getConfiguration",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getObjects",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getFields",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getRelatedLists",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getRelatedListFields",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getRecordTypeOptions",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getTemplates",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getTemplate",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.saveTemplate",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.deleteTemplate",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.saveTemplateImage",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.getSalesforceImageFiles",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.renderGeneratedHtmlForPreview",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.renderPdfFlowForRecordPreview",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

const createKeyboardShortcutTemplate = () => {
  const regionStyles = {
    background: "#ffffff",
    padding: 8,
    borderWidth: 0,
    borderStyle: "none",
    borderColor: "#c9c9c9",
    borderRadius: 0
  };

  return {
    pagePadding: 32,
    globalElementPadding: 8,
    showHeader: true,
    showBody: true,
    showFooter: true,
    repeatHeaderOnEachPage: true,
    repeatFooterOnEachPage: true,
    manualPageCount: 0,
    manualPages: [],
    header: {
      id: "header",
      label: "Header",
      styles: { ...regionStyles, height: 110 },
      blocks: []
    },
    body: {
      layout: "one",
      sections: [
        {
          id: "body-1",
          label: "Body",
          styles: regionStyles,
          blocks: [
            {
              id: "keyboard-test-line",
              type: "divider",
              content: "",
              styles: {
                x: 120,
                y: 160,
                lineLength: 300,
                height: 1,
                lineThickness: 1,
                lineStyle: "solid",
                lineColor: "#181818"
              }
            }
          ]
        }
      ]
    },
    footer: {
      id: "footer",
      label: "Footer",
      styles: { ...regionStyles, height: 80 },
      blocks: []
    }
  };
};

describe("c-pdf-builder", () => {
  beforeEach(() => {
    getConfiguration.mockResolvedValue({
      pageWidth: 794,
      pageHeight: 1123,
      defaultPagePadding: 32,
      defaultElementPadding: 8,
      defaultHeaderHeight: 110,
      defaultFooterHeight: 80,
      maxPages: 5,
      longTextLimit: 131072,
      maxClientImageBase64Length: 1800000,
      dragGridSize: 10,
      inputDebounceMilliseconds: 250
    });
    getObjects.mockResolvedValue([
      { label: "Account", apiName: "Account", custom: false },
      { label: "Quote", apiName: "Quote", custom: false }
    ]);
    getFields.mockResolvedValue([]);
    getRelatedLists.mockResolvedValue([]);
    getRelatedListFields.mockResolvedValue([]);
    getRecordTypeOptions.mockResolvedValue([
      { label: "All record types", value: "ALL" }
    ]);
    getTemplates.mockResolvedValue([
      {
        id: "a01000000000001AAA",
        name: "Account proposal",
        objectApiName: "Account"
      },
      {
        id: "a01000000000002AAA",
        name: "Quote proposal",
        objectApiName: "Quote"
      }
    ]);
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: "",
      generatedHtml: ""
    });
    saveTemplate.mockResolvedValue("a01000000000003AAA");
    renderGeneratedHtmlForPreview.mockImplementation(({ generatedHtml }) =>
      Promise.resolve(generatedHtml)
    );
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("loads objects and shows the associated object abbreviation in template labels", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    const objectOptions = Array.from(
      element.shadowRoot.querySelector('[data-role="object-select"]').options
    ).map((option) => option.textContent.trim());
    const templateOptions = Array.from(
      element.shadowRoot.querySelector('[data-role="template-select"]').options
    ).map((option) => option.textContent.trim());

    expect(objectOptions).toEqual(["Select object", "Account", "Quote"]);
    expect(templateOptions).toEqual([
      "Select template",
      "Account proposal (ACC)",
      "Quote proposal (QUO)"
    ]);
    expect(element.shadowRoot.querySelector(".application-logo")).toBeNull();
  });

  it("uses a compact two-column layout for page controls", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const toggleGrid = element.shadowRoot.querySelector(".layout-toggle-grid");
    const controlGrid = element.shadowRoot.querySelector(
      ".layout-control-grid"
    );
    const colorControl = element.shadowRoot.querySelector(
      ".background-color-control"
    );
    const colorInput = colorControl.querySelector(".background-color-input");
    const borderColorInput = element.shadowRoot.querySelector(
      'input[data-style="borderColor"]'
    );
    const borderColorReset = element.shadowRoot.querySelector(
      '.color-reset-button[data-style="borderColor"]'
    );

    expect(toggleGrid.querySelectorAll(".checkbox-label")).toHaveLength(4);
    expect(controlGrid.querySelectorAll(".property-group")).toHaveLength(4);
    expect(colorInput.type).toBe("color");
    expect(colorInput.getAttribute("aria-label")).toBe(
      "Choose page background color"
    );
    expect(colorControl.textContent).toContain("No fill");
    expect(
      borderColorInput.closest(".background-color-control")
    ).not.toBeNull();
    expect(borderColorReset.getAttribute("title")).toBe("Reset border color");
    expect(
      Array.from(element.shadowRoot.querySelectorAll("summary")).some(
        (summary) => summary.textContent.trim() === "Container"
      )
    ).toBe(false);
    expect(
      Array.from(element.shadowRoot.querySelectorAll("summary")).some(
        (summary) => summary.textContent.trim() === "Appearance"
      )
    ).toBe(true);
    expect(
      element.shadowRoot.querySelector(".pdf-page").getAttribute("style")
    ).toContain("background:#ffffff");

    const themeToggle = element.shadowRoot.querySelector(".theme-toggle-input");
    themeToggle.checked = true;
    themeToggle.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".pdf-page").getAttribute("style")
    ).toContain("background:#eef0f3");

    colorInput.value = "#fff4e6";
    colorInput.dispatchEvent(new CustomEvent("input"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".pdf-page").getAttribute("style")
    ).toContain("background:#fff4e6");

    borderColorInput.value = "#ff0000";
    borderColorInput.dispatchEvent(new CustomEvent("input"));
    await flushPromises();
    element.shadowRoot
      .querySelector('.color-reset-button[data-style="borderColor"]')
      .click();
    await flushPromises();

    expect(
      element.shadowRoot.querySelector('input[data-style="borderColor"]').value
    ).toBe("#c9c9c9");
  });

  it.each(["header", "footer"])(
    "keeps the initial text size when adding text to the %s",
    async (regionId) => {
      const element = createElement("c-pdf-builder", {
        is: PDFBuilder
      });
      document.body.appendChild(element);
      await flushPromises();

      const targetRegion = element.shadowRoot.querySelector(
        `[data-region-id="${regionId}"]`
      );
      Object.defineProperty(targetRegion, "clientWidth", {
        configurable: true,
        value: 700
      });
      Object.defineProperty(targetRegion, "clientHeight", {
        configurable: true,
        value: 110
      });
      targetRegion.getBoundingClientRect = jest.fn(() => ({
        top: 0,
        bottom: 110,
        left: 0,
        right: 700,
        width: 700,
        height: 110
      }));

      const textTool = element.shadowRoot.querySelector('[data-type="text"]');
      textTool.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          button: 0,
          clientX: 750,
          clientY: 20
        })
      );
      window.dispatchEvent(
        new MouseEvent("mousemove", { clientX: 100, clientY: 50 })
      );
      window.dispatchEvent(
        new MouseEvent("mouseup", { clientX: 100, clientY: 50 })
      );
      await flushPromises();

      const addedText = element.shadowRoot.querySelector(
        `[data-region-id="${regionId}"] c-pdf-builder-block`
      ).block;
      expect(addedText.styles.height).toBe(40);
      expect(addedText.styles.fontSize).toBe(28);
    }
  );

  it("uses compact resettable color controls for every component attribute", async () => {
    const content = createKeyboardShortcutTemplate();
    content.body.sections[0].blocks = [
      {
        id: "color-text",
        type: "text",
        content: "Color text",
        styles: { width: 180, height: 40, x: 0, y: 0, color: "#336699" }
      },
      {
        id: "color-table",
        type: "table",
        content: "",
        tableData: [["Header"], ["Odd"], ["Even"]],
        styles: {
          width: 240,
          height: 100,
          x: 0,
          y: 60,
          tableRows: 3,
          tableColumns: 1,
          tableBorderColor: "#336699",
          tableBorderMode: "horizontal",
          tableHeaderRowColor: "#112233",
          tableHeaderTextColor: "#fefefe",
          tableOddRowColor: "#ddeeff",
          tableOddTextColor: "#223344",
          tableEvenRowColor: "#ccddee",
          tableEvenTextColor: "#334455"
        }
      },
      {
        id: "color-line",
        type: "divider",
        content: "",
        styles: {
          width: 240,
          height: 12,
          x: 0,
          y: 180,
          lineColor: "#336699",
          lineThickness: 1,
          lineStyle: "solid"
        }
      }
    ];
    getTemplate.mockResolvedValueOnce({
      id: "a01000000000002AAA",
      name: "Color controls",
      objectApiName: "Account",
      contentJson: JSON.stringify(content),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", { is: PDFBuilder });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const assertCompactColorControl = async (
      blockId,
      styleName,
      defaultColor
    ) => {
      element.shadowRoot
        .querySelector(`[data-block-id="${blockId}"] c-pdf-builder-block`)
        .dispatchEvent(
          new CustomEvent("selectblock", {
            detail: { blockId, regionId: "body-1" },
            bubbles: true,
            composed: true
          })
        );
      await flushPromises();

      const input = element.shadowRoot.querySelector(
        `input[data-style="${styleName}"]`
      );
      expect(input.closest(".background-color-control")).not.toBeNull();
      const resetButton = element.shadowRoot.querySelector(
        `.color-reset-button[data-style="${styleName}"]`
      );
      expect(resetButton).not.toBeNull();
      resetButton.click();
      await flushPromises();
      expect(
        element.shadowRoot.querySelector(`input[data-style="${styleName}"]`)
          .value
      ).toBe(defaultColor);
    };

    await assertCompactColorControl("color-text", "color", "#181818");
    await assertCompactColorControl(
      "color-table",
      "tableBorderColor",
      "#c9c9c9"
    );
    await assertCompactColorControl(
      "color-table",
      "tableHeaderTextColor",
      "#181818"
    );
    await assertCompactColorControl(
      "color-table",
      "tableOddTextColor",
      "#181818"
    );
    await assertCompactColorControl(
      "color-table",
      "tableEvenTextColor",
      "#181818"
    );

    const tableBlock = element.shadowRoot.querySelector(
      '[data-block-id="color-table"] c-pdf-builder-block'
    ).block;
    const originalTableHeight = tableBlock.styles.height;
    expect(tableBlock.styles.tableRows).toBe(3);
    expect(originalTableHeight).toBeGreaterThan(0);
    expect(tableBlock.tableRows[0].cells[0].style).toContain(
      "background-color:#112233"
    );
    expect(tableBlock.tableRows[0].cells[0].style).toContain(
      "font-weight:bold"
    );
    expect(tableBlock.tableRows[0].cells[0].style).toContain(
      "border-top:1px solid #c9c9c9"
    );
    expect(tableBlock.tableRows[1].cells[0].style).toContain(
      "background-color:#ddeeff"
    );
    expect(tableBlock.tableRows[1].cells[0].style).toContain("color:#181818");
    expect(tableBlock.tableRows[2].cells[0].style).toContain(
      "background-color:#ccddee"
    );
    expect(tableBlock.tableRows[2].cells[0].style).toContain("color:#181818");

    ["tableHeaderRowColor", "tableOddRowColor", "tableEvenRowColor"].forEach(
      (styleName) => {
        const input = element.shadowRoot.querySelector(
          `input[data-style="${styleName}"]`
        );
        expect(input.closest(".background-color-control")).not.toBeNull();
        expect(
          element.shadowRoot.querySelector(
            `.background-no-fill-button[data-style="${styleName}"]`
          )
        ).not.toBeNull();
      }
    );

    const bodyRegion = element.shadowRoot.querySelector(
      '[data-region-id="body-1"]'
    );
    Object.defineProperty(bodyRegion, "clientWidth", {
      configurable: true,
      value: 700
    });
    Object.defineProperty(bodyRegion, "clientHeight", {
      configurable: true,
      value: 800
    });
    element.shadowRoot
      .querySelector('[data-block-id="color-table"][data-resize-dir="s"]')
      .dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          clientX: 100,
          clientY: 100
        })
      );
    window.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 100, clientY: 180 })
    );
    await flushPromises();
    window.dispatchEvent(new MouseEvent("mouseup"));

    const resizedTableBlock = element.shadowRoot.querySelector(
      '[data-block-id="color-table"] c-pdf-builder-block'
    ).block;
    expect(resizedTableBlock.styles.height).toBe(originalTableHeight + 80);
    expect(resizedTableBlock.styles.tableRows).toBe(3);
    expect(resizedTableBlock.tableRows).toHaveLength(3);

    await assertCompactColorControl("color-line", "lineColor", "#181818");
  });

  it("shows appearance controls only where each block type needs them", async () => {
    const content = createKeyboardShortcutTemplate();
    const oldContainerStyles = {
      background: "#ffeecc",
      padding: 12,
      borderWidth: 3,
      borderStyle: "solid",
      borderColor: "#336699",
      borderRadius: 7
    };
    content.body.sections[0].blocks = [
      {
        id: "appearance-text",
        type: "text",
        content: "Text",
        styles: {
          ...oldContainerStyles,
          width: 180,
          height: 40,
          x: 0,
          y: 0
        }
      },
      {
        id: "appearance-image",
        type: "image",
        imageSrc:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        styles: {
          ...oldContainerStyles,
          width: 180,
          height: 100,
          x: 200,
          y: 0
        }
      },
      {
        id: "appearance-table",
        type: "table",
        tableData: [["Header"], ["Value"]],
        styles: {
          ...oldContainerStyles,
          width: 240,
          height: 100,
          x: 0,
          y: 140,
          tableRows: 2,
          tableColumns: 1
        }
      },
      {
        id: "appearance-line",
        type: "divider",
        styles: {
          ...oldContainerStyles,
          width: 240,
          height: 12,
          x: 260,
          y: 160,
          lineThickness: 1,
          lineStyle: "solid",
          lineColor: "#181818"
        }
      }
    ];
    getTemplate.mockResolvedValueOnce({
      id: "a01000000000002AAA",
      name: "Appearance sections",
      objectApiName: "Account",
      contentJson: JSON.stringify(content),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", { is: PDFBuilder });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const selectBlock = async (blockId) => {
      element.shadowRoot
        .querySelector(`[data-block-id="${blockId}"] c-pdf-builder-block`)
        .dispatchEvent(
          new CustomEvent("selectblock", {
            detail: { blockId, regionId: "body-1" },
            bubbles: true,
            composed: true
          })
        );
      await flushPromises();
    };
    const sectionLabels = () =>
      Array.from(
        element.shadowRoot.querySelectorAll("details.property-section summary")
      ).map((summary) => summary.textContent.trim());
    const assertBorderDetailsDisabled = async () => {
      const borderStyle = element.shadowRoot.querySelector(
        'select[data-style="borderStyle"]'
      );
      borderStyle.value = "none";
      borderStyle.dispatchEvent(new CustomEvent("change"));
      await flushPromises();

      expect(
        element.shadowRoot.querySelector('input[data-style="borderWidth"]')
          .disabled
      ).toBe(true);
      expect(
        element.shadowRoot.querySelector('input[data-style="borderColor"]')
          .disabled
      ).toBe(true);
      expect(
        element.shadowRoot.querySelector(
          '.color-reset-button[data-style="borderColor"]'
        ).disabled
      ).toBe(true);
      expect(
        element.shadowRoot.querySelector('input[data-style="borderRadius"]')
          .disabled
      ).toBe(true);
    };

    await selectBlock("appearance-text");
    expect(sectionLabels()).toContain("Appearance");
    expect(sectionLabels()).not.toContain("Container");
    expect(
      element.shadowRoot.querySelector('input[data-style="background"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector('input[data-style="padding"]')
    ).not.toBeNull();
    await assertBorderDetailsDisabled();

    await selectBlock("appearance-image");
    expect(sectionLabels()).toContain("Image");
    expect(sectionLabels()).not.toContain("Appearance");
    expect(sectionLabels()).not.toContain("Container");
    expect(
      element.shadowRoot.querySelector('input[data-style="background"]')
    ).toBeNull();
    expect(
      element.shadowRoot.querySelector('input[data-style="padding"]')
    ).toBeNull();
    const imageSection = Array.from(
      element.shadowRoot.querySelectorAll("details.property-section")
    ).find(
      (section) =>
        section.querySelector("summary")?.textContent.trim() === "Image"
    );
    expect(
      imageSection.querySelector('select[data-style="borderStyle"]')
    ).not.toBeNull();
    expect(
      imageSection.querySelector('input[data-style="borderWidth"]')
    ).not.toBeNull();
    expect(
      imageSection.querySelector('input[data-style="borderColor"]')
    ).not.toBeNull();
    expect(
      imageSection.querySelector('input[data-style="borderRadius"]')
    ).not.toBeNull();
    const imageBlock = element.shadowRoot.querySelector(
      '[data-block-id="appearance-image"] c-pdf-builder-block'
    ).block;
    expect(imageBlock.styles.background).toBe("transparent");
    expect(imageBlock.styles.padding).toBe(0);
    expect(imageBlock.styles.borderWidth).toBe(3);
    expect(imageBlock.styles.borderStyle).toBe("solid");
    await assertBorderDetailsDisabled();

    const assertBareBlock = async (blockId) => {
      await selectBlock(blockId);
      expect(sectionLabels()).not.toContain("Appearance");
      expect(sectionLabels()).not.toContain("Container");
      const block = element.shadowRoot.querySelector(
        `[data-block-id="${blockId}"] c-pdf-builder-block`
      ).block;
      expect(block.styles.background).toBe("transparent");
      expect(block.styles.padding).toBe(0);
      expect(block.styles.borderWidth).toBe(0);
      expect(block.styles.borderStyle).toBe("none");
      expect(block.styles.borderRadius).toBe(0);
    };

    await assertBareBlock("appearance-table");
    await assertBareBlock("appearance-line");
  });

  it("warns when inserting a variable without a text or table block", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    document.body.appendChild(element);
    await flushPromises();

    const organizationInsertButton = element.shadowRoot.querySelector(
      'button[data-field-api-name="$Organization.Name"]'
    );
    organizationInsertButton.click();

    expect(toastHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: "Variable not inserted",
          message: "Select a text or table block before inserting a variable.",
          variant: "warning"
        })
      })
    );
  });

  it("aligns header, body, and footer when page padding changes", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const pagePaddingInput = element.shadowRoot.querySelector(
      '[data-role="page-padding"]'
    );
    pagePaddingInput.value = "48";
    pagePaddingInput.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const page = element.shadowRoot.querySelector(".pdf-page");
    const header = element.shadowRoot.querySelector(
      '[data-region-id="header"]'
    );
    const footer = element.shadowRoot.querySelector(
      '[data-region-id="footer"]'
    );

    expect(page.getAttribute("style")).toContain("padding:48px");
    expect(header.getAttribute("style")).toContain("--region-width:698px");
    expect(footer.getAttribute("style")).toContain("--region-width:698px");
  });

  it("resolves global fields in preview without a record context", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    renderGeneratedHtmlForPreview.mockResolvedValue(
      '<html><body><div class="pdf-page">Organization preview</div></body></html>'
    );
    Array.from(element.shadowRoot.querySelectorAll("button"))
      .find((button) => button.textContent.trim() === "Preview")
      .click();
    await flushPromises();

    expect(renderGeneratedHtmlForPreview).toHaveBeenCalledWith(
      expect.objectContaining({ generatedHtml: expect.any(String) })
    );
    expect(
      element.shadowRoot.querySelector(".preview-content").textContent
    ).toContain("Organization preview");
  });

  it("clears and disables region repetition when its region is hidden", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const headerVisibility = element.shadowRoot.querySelector(
      'input[data-visibility="showHeader"]'
    );
    const headerRepeat = element.shadowRoot.querySelector(
      'input[data-repeat="repeatHeaderOnEachPage"]'
    );

    expect(headerRepeat.disabled).toBe(false);
    headerVisibility.checked = false;
    headerVisibility.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const updatedHeaderRepeat = element.shadowRoot.querySelector(
      'input[data-repeat="repeatHeaderOnEachPage"]'
    );
    expect(updatedHeaderRepeat.checked).toBe(false);
    expect(updatedHeaderRepeat.disabled).toBe(true);
  });

  it("requires an object before expanding Related List fields", async () => {
    getTemplate.mockResolvedValueOnce({
      id: "a01000000000002AAA",
      name: "Unassigned Related List",
      objectApiName: "",
      contentJson: JSON.stringify({
        pagePadding: 32,
        globalElementPadding: 8,
        showHeader: true,
        showBody: true,
        showFooter: true,
        repeatHeaderOnEachPage: true,
        repeatFooterOnEachPage: true,
        manualPageCount: 0,
        manualPages: [],
        header: {
          id: "header",
          label: "Header",
          styles: { height: 110 },
          blocks: []
        },
        body: {
          layout: "one",
          sections: [
            {
              id: "body-1",
              label: "Body",
              styles: {},
              blocks: [
                {
                  id: "related-list-1",
                  type: "relatedList",
                  content: "",
                  styles: { width: 600, x: 0, y: 0 },
                  relatedListColumns: []
                }
              ]
            }
          ]
        },
        footer: {
          id: "footer",
          label: "Footer",
          styles: { height: 80 },
          blocks: []
        }
      }),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    await flushPromises();

    const relatedListBlock = Array.from(
      element.shadowRoot.querySelectorAll("c-pdf-builder-block")
    ).find((blockComponent) => blockComponent.block.type === "relatedList");
    relatedListBlock.dispatchEvent(
      new CustomEvent("selectblock", {
        detail: { blockId: "related-list-1", regionId: "body-1" },
        bubbles: true,
        composed: true
      })
    );
    await flushPromises();

    expect(
      Array.from(
        element.shadowRoot.querySelectorAll(
          '[data-block-id="related-list-1"][data-resize-dir]'
        )
      )
        .map((handle) => handle.dataset.resizeDir)
        .sort()
    ).toEqual(["e", "w"]);

    const fixedRelatedList = Array.from(
      element.shadowRoot.querySelectorAll("c-pdf-builder-block")
    ).find((blockComponent) => blockComponent.block.type === "relatedList");
    expect(fixedRelatedList.block.relatedListBuilderRows).toBe(1);
    expect(fixedRelatedList.block.relatedListPreviewRows).toHaveLength(1);
    expect(fixedRelatedList.block.styles.height).toBe(50);

    expect(
      element.shadowRoot.querySelector('input[data-style="background"]')
    ).toBeNull();
    expect(
      element.shadowRoot.querySelector('input[data-style="padding"]')
    ).toBeNull();
    const propertySectionLabels = Array.from(
      element.shadowRoot.querySelectorAll("details.property-section summary")
    ).map((summary) => summary.textContent.trim());
    expect(propertySectionLabels).not.toContain("Container");
    expect(propertySectionLabels).not.toContain("Actions");

    [
      "relatedListTextColor",
      "relatedListOddTextColor",
      "relatedListEvenTextColor",
      "relatedListGridColor"
    ].forEach((colorKey) => {
      const input = element.shadowRoot.querySelector(
        `input[data-key="${colorKey}"]`
      );
      expect(input.closest(".background-color-control")).not.toBeNull();
      expect(
        element.shadowRoot.querySelector(
          `.color-reset-button[data-key="${colorKey}"]`
        )
      ).not.toBeNull();
    });

    const gridColorInput = element.shadowRoot.querySelector(
      'input[data-key="relatedListGridColor"]'
    );
    gridColorInput.value = "#123456";
    gridColorInput.dispatchEvent(new CustomEvent("input"));
    await flushPromises();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", ctrlKey: true })
    );
    await flushPromises();
    expect(
      Array.from(
        element.shadowRoot.querySelectorAll("c-pdf-builder-block")
      ).filter((blockComponent) => blockComponent.block.type === "relatedList")
    ).toHaveLength(1);

    const relatedListSection = element.shadowRoot.querySelector(
      'details[data-section="related-list"]'
    );
    relatedListSection.open = true;
    relatedListSection.dispatchEvent(new CustomEvent("toggle"));

    expect(relatedListSection.open).toBe(false);
    expect(toastHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: "Object required",
          message: "Select an object before configuring Related List fields.",
          variant: "warning"
        })
      })
    );

    Array.from(element.shadowRoot.querySelectorAll("button"))
      .find((button) => button.textContent.trim() === "Preview")
      .click();
    await flushPromises();

    const previewTable = element.shadowRoot.querySelector(
      ".preview-content table"
    );
    expect(
      Array.from(previewTable.querySelectorAll("thead th")).map((cell) =>
        cell.textContent.trim()
      )
    ).toEqual(["Column 1", "Column 2", "Column 3"]);
    expect(
      Array.from(previewTable.querySelectorAll("tbody td")).map((cell) =>
        cell.textContent.trim()
      )
    ).toEqual(["Sample value", "Sample value", "Sample value"]);
    expect(
      previewTable.querySelector("thead th").getAttribute("style")
    ).toContain("#123456");
    expect(previewTable.style.height).toBe("50px");
    expect(previewTable.querySelector("thead tr").style.height).toBe("25px");
    expect(previewTable.querySelector("tbody tr").style.height).toBe("25px");
    expect(previewTable.querySelector("tbody td").style.padding).toBe(
      "0px 8px"
    );
    expect(previewTable.querySelector("tbody td").style.whiteSpace).toBe(
      "nowrap"
    );
  });

  it("restores every saved Related List column when legacy API-name casing differs", async () => {
    getTemplate.mockResolvedValueOnce({
      id: "a01000000000002AAA",
      name: "Opportunity proposal",
      objectApiName: "Opportunity",
      contentJson: JSON.stringify({
        pagePadding: 32,
        globalElementPadding: 8,
        showHeader: true,
        showBody: true,
        showFooter: true,
        repeatHeaderOnEachPage: true,
        repeatFooterOnEachPage: true,
        manualPageCount: 0,
        manualPages: [],
        header: {
          id: "header",
          label: "Header",
          styles: { height: 110 },
          blocks: []
        },
        body: {
          layout: "one",
          sections: [
            {
              id: "body-1",
              label: "Body",
              styles: {},
              blocks: [
                {
                  id: "related-list-1",
                  type: "relatedList",
                  content: "",
                  styles: { width: 600, x: 0, y: 0 },
                  relatedListRelationshipName: "OpportunityLineItems",
                  relatedListChildObjectApiName: "OpportunityLineItem",
                  relatedListColumns: [
                    "description",
                    "Quantity",
                    "UnitPrice",
                    "Discount",
                    "TotalPrice",
                    "IsDeleted",
                    "CreatedDate"
                  ]
                }
              ]
            }
          ]
        },
        footer: {
          id: "footer",
          label: "Footer",
          styles: { height: 80 },
          blocks: []
        }
      }),
      generatedHtml: ""
    });
    getRelatedLists.mockResolvedValue([
      {
        label: "Opportunity Products (OpportunityLineItems)",
        relationshipName: "OpportunityLineItems",
        childObjectApiName: "OpportunityLineItem"
      }
    ]);
    getRelatedListFields.mockResolvedValue([
      { label: "Line Description", apiName: "description", dataType: "String" },
      { label: "Quantity", apiName: "quantity", dataType: "Double" },
      { label: "Sales Price", apiName: "unitprice", dataType: "Currency" },
      { label: "Total Price", apiName: "totalprice", dataType: "Currency" },
      { label: "Deleted", apiName: "isdeleted", dataType: "Boolean" },
      { label: "Created Date", apiName: "createddate", dataType: "DateTime" }
    ]);

    const element = createElement("c-pdf-builder", { is: PDFBuilder });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    await flushPromises();

    const relatedListBlock = Array.from(
      element.shadowRoot.querySelectorAll("c-pdf-builder-block")
    ).find((blockComponent) => blockComponent.block.type === "relatedList");
    relatedListBlock.dispatchEvent(
      new CustomEvent("selectblock", {
        detail: { blockId: "related-list-1", regionId: "body-1" },
        bubbles: true,
        composed: true
      })
    );
    await flushPromises();
    await flushPromises();

    const normalizedBlock = Array.from(
      element.shadowRoot.querySelectorAll("c-pdf-builder-block")
    ).find((blockComponent) => blockComponent.block.id === "related-list-1");
    expect(normalizedBlock.block.relatedListColumns).toEqual([
      "description",
      "quantity",
      "unitprice",
      "Discount",
      "totalprice",
      "isdeleted",
      "createddate"
    ]);

    const columnStyles = Object.fromEntries(
      normalizedBlock.block.relatedListColumnLabels.map((column) => [
        column.apiName.toLowerCase(),
        column.style
      ])
    );
    expect(columnStyles.description).toContain("text-align:left");
    expect(columnStyles.quantity).toContain("text-align:right");
    expect(columnStyles.unitprice).toContain("text-align:right");
    expect(columnStyles.totalprice).toContain("text-align:right");
    expect(columnStyles.isdeleted).toContain("text-align:center");
    expect(columnStyles.createddate).toContain("text-align:center");

    expect(
      Array.from(
        element.shadowRoot.querySelectorAll(
          'details[data-section="related-list"] .property-grid > .property-group > label'
        )
      ).map((label) => label.textContent.trim())
    ).toEqual([
      "Child relationship",
      "Columns",
      "Header color",
      "Header text color",
      "Odd row color",
      "Odd row text color",
      "Even row color",
      "Even row text color",
      "Font size",
      "Grid lines",
      "Grid line color"
    ]);
  });

  it("keeps Related List preview rows within the builder geometry", async () => {
    const regionStyles = {
      background: "#ffffff",
      padding: 0,
      borderWidth: 0,
      borderStyle: "none",
      borderColor: "#c9c9c9",
      borderRadius: 0
    };
    getTemplate.mockResolvedValueOnce({
      id: "a01000000000002AAA",
      name: "Opportunity quotation",
      objectApiName: "Quote",
      contentJson: JSON.stringify({
        pagePadding: 0,
        globalElementPadding: 0,
        showHeader: false,
        showBody: true,
        showFooter: false,
        repeatHeaderOnEachPage: false,
        repeatFooterOnEachPage: false,
        manualPageCount: 0,
        manualPages: [],
        header: {
          id: "header",
          label: "Header",
          styles: { ...regionStyles, height: 110 },
          blocks: []
        },
        body: {
          layout: "one",
          sections: [
            {
              id: "body-1",
              label: "Body",
              styles: regionStyles,
              blocks: [
                {
                  id: "quotation-services",
                  type: "relatedList",
                  content: "",
                  relatedListColumns: ["Quantity", "Description", "Total"],
                  relatedListBuilderRows: 2,
                  relatedListBorderMode: "all",
                  styles: { width: 600, height: 75, x: 100, y: 160 }
                },
                {
                  id: "quotation-total",
                  type: "text",
                  content: "TOTAL AMOUNT",
                  styles: { width: 600, height: 75, x: 100, y: 240 }
                }
              ]
            }
          ]
        },
        footer: {
          id: "footer",
          label: "Footer",
          styles: { ...regionStyles, height: 80 },
          blocks: []
        }
      }),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", { is: PDFBuilder });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    Array.from(element.shadowRoot.querySelectorAll("button"))
      .find((button) => button.textContent.trim() === "Preview")
      .click();
    await flushPromises();

    const previewSection = element.shadowRoot.querySelector(
      ".preview-content .pdf-body section"
    );
    const previewTable = previewSection.querySelector("table");
    const relatedListBlock = previewTable.parentElement;
    const totalBlock = Array.from(previewSection.children).find((child) =>
      child.textContent.includes("TOTAL AMOUNT")
    );

    expect(previewTable.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(previewTable.style.height).toBe("75px");
    expect(parseFloat(relatedListBlock.style.top) + 75).toBeLessThanOrEqual(
      parseFloat(totalBlock.style.top)
    );
  });

  it("loads the selected template and its object without changing the template contract", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    await flushPromises();

    expect(getTemplate).toHaveBeenCalledWith({
      templateId: "a01000000000002AAA"
    });
    expect(getFields).toHaveBeenCalledWith({
      objectApiName: "Quote",
      searchTerm: ""
    });
    expect(getRelatedLists).toHaveBeenCalledWith({ objectApiName: "Quote" });
    expect(
      element.shadowRoot.querySelector('[data-role="object-select"]').value
    ).toBe("Quote");
    expect(
      element.shadowRoot.querySelector('input[placeholder="Template name"]')
        .value
    ).toBe("Quote proposal");
  });

  it.each([
    [
      "object variables",
      {
        id: "object-variable-text",
        type: "text",
        content: "Customer: {!Quote.Name}",
        styles: {}
      },
      "This template contains object variables that do not belong to Account. Review and update them before previewing or generating the PDF."
    ],
    [
      "a Related List",
      {
        id: "object-related-list",
        type: "relatedList",
        content: "",
        relatedListRelationshipName: "QuoteLineItems",
        relatedListChildObjectApiName: "QuoteLineItem",
        relatedListColumns: [],
        styles: {}
      },
      "This template contains a Related List that does not belong to Account. Review and update it before previewing or generating the PDF."
    ]
  ])(
    "warns after changing object when the template contains %s",
    async (_dependencyName, dependentBlock, expectedContent) => {
      const templateContent = createKeyboardShortcutTemplate();
      templateContent.body.sections[0].blocks = [dependentBlock];
      getTemplate.mockResolvedValue({
        id: "a01000000000002AAA",
        name: "Quote proposal",
        objectApiName: "Quote",
        contentJson: JSON.stringify(templateContent),
        generatedHtml: ""
      });

      const element = createElement("c-pdf-builder", {
        is: PDFBuilder
      });
      document.body.appendChild(element);
      await flushPromises();

      const templateSelect = element.shadowRoot.querySelector(
        '[data-role="template-select"]'
      );
      templateSelect.value = "a01000000000002AAA";
      templateSelect.dispatchEvent(new CustomEvent("change"));
      await flushPromises();
      await flushPromises();
      const objectSelect = element.shadowRoot.querySelector(
        '[data-role="object-select"]'
      );
      objectSelect.value = "Account";
      objectSelect.dispatchEvent(new CustomEvent("change"));
      await flushPromises();

      const warning = element.shadowRoot.querySelector(
        '[data-role="object-dependency-warning"]'
      );
      expect(warning).not.toBeNull();
      expect(warning.querySelector("h2").textContent.trim()).toBe(
        "Review object-dependent content"
      );
      expect(warning.querySelector("p").textContent.trim()).toBe(
        expectedContent
      );

      warning
        .querySelector('[data-role="object-dependency-warning-close"]')
        .click();
      await flushPromises();
      expect(
        element.shadowRoot.querySelector(
          '[data-role="object-dependency-warning"]'
        )
      ).toBeNull();
    }
  );

  it("does not warn after changing object when the template only contains global variables", async () => {
    const templateContent = createKeyboardShortcutTemplate();
    templateContent.body.sections[0].blocks = [
      {
        id: "global-variable-text",
        type: "text",
        content: "Company: {!$Organization.Name}",
        styles: {}
      }
    ];
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: JSON.stringify(templateContent),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    await flushPromises();
    const objectSelect = element.shadowRoot.querySelector(
      '[data-role="object-select"]'
    );
    objectSelect.value = "Account";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(
        '[data-role="object-dependency-warning"]'
      )
    ).toBeNull();
  });

  it("does not warn when object variables and the related list belong to the newly selected object", async () => {
    const templateContent = createKeyboardShortcutTemplate();
    templateContent.body.sections[0].blocks = [
      {
        id: "matching-object-variable",
        type: "text",
        content: "Customer: {!Account.Name}",
        styles: {}
      },
      {
        id: "matching-related-list",
        type: "relatedList",
        content: "",
        relatedListRelationshipName: "Contacts",
        relatedListChildObjectApiName: "Contact",
        relatedListColumns: ["Name"],
        styles: {}
      }
    ];
    getRelatedLists.mockImplementation(({ objectApiName }) => {
      return objectApiName === "Account"
        ? [
            {
              label: "Contacts (Contacts)",
              relationshipName: "Contacts",
              childObjectApiName: "Contact"
            }
          ]
        : [];
    });
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: JSON.stringify(templateContent),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    await flushPromises();

    const objectSelect = element.shadowRoot.querySelector(
      '[data-role="object-select"]'
    );
    objectSelect.value = "Account";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(
        '[data-role="object-dependency-warning"]'
      )
    ).toBeNull();
  });

  it("keeps the latest template when load requests finish out of order", async () => {
    const firstTemplate = createDeferred();
    const secondTemplate = createDeferred();
    getTemplate.mockImplementation(({ templateId }) => {
      return templateId === "a01000000000001AAA"
        ? firstTemplate.promise
        : secondTemplate.promise;
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000001AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    secondTemplate.resolve({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: "",
      generatedHtml: ""
    });
    await flushPromises();
    await flushPromises();

    firstTemplate.resolve({
      id: "a01000000000001AAA",
      name: "Account proposal",
      objectApiName: "Account",
      contentJson: "",
      generatedHtml: ""
    });
    await flushPromises();

    expect(getTemplate).toHaveBeenCalledTimes(2);
    expect(templateSelect.value).toBe("a01000000000002AAA");
    expect(
      element.shadowRoot.querySelector('[data-role="object-select"]').value
    ).toBe("Quote");
    expect(
      element.shadowRoot.querySelector('input[placeholder="Template name"]')
        .value
    ).toBe("Quote proposal");
  });

  it("resets the object when Select template is selected", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    await flushPromises();

    templateSelect.value = "";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelector('[data-role="object-select"]').value
    ).toBe("");
    expect(
      element.shadowRoot.querySelector('input[placeholder="Template name"]')
        .value
    ).toBe("");
  });

  it("asks before discarding changes when another template or Select template is chosen", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    await flushPromises();

    const borderStyleSelect = element.shadowRoot.querySelector(
      'select[data-style="borderStyle"]'
    );
    borderStyleSelect.value = "solid";
    borderStyleSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    templateSelect.value = "a01000000000001AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".unsaved-changes-confirm")
    ).not.toBeNull();
    expect(templateSelect.value).toBe("a01000000000002AAA");
    expect(getTemplate).toHaveBeenCalledTimes(1);

    element.shadowRoot.querySelector('[data-role="unsaved-cancel"]').click();
    await flushPromises();
    expect(
      element.shadowRoot.querySelector(".unsaved-changes-confirm")
    ).toBeNull();
    expect(
      element.shadowRoot.querySelector('select[data-style="borderStyle"]').value
    ).toBe("solid");

    templateSelect.value = "";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    element.shadowRoot.querySelector('[data-role="unsaved-discard"]').click();
    await flushPromises();

    expect(
      element.shadowRoot.querySelector('input[placeholder="Template name"]')
        .value
    ).toBe("");
    expect(
      element.shadowRoot.querySelector('[data-role="object-select"]').value
    ).toBe("");
    expect(
      Array.from(
        element.shadowRoot.querySelectorAll(".top-toolbar .toolbar-button")
      ).find((button) => button.textContent.trim() === "Delete").disabled
    ).toBe(true);
    expect(
      element.shadowRoot.querySelector('[data-role="template-select"]').value
    ).toBe("");
    expect(saveTemplate).not.toHaveBeenCalled();
  });

  it("saves pending changes before loading the selected template", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const objectSelect = element.shadowRoot.querySelector(
      '[data-role="object-select"]'
    );
    objectSelect.value = "Account";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    const templateNameInput = element.shadowRoot.querySelector(
      'input[placeholder="Template name"]'
    );
    templateNameInput.value = "Unsaved account proposal";
    templateNameInput.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    element.shadowRoot.querySelector('[data-role="unsaved-save"]').click();
    await flushPromises();
    await flushPromises();

    expect(saveTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: null,
        name: "Unsaved account proposal",
        objectApiName: "Account"
      })
    );
    expect(getTemplate).toHaveBeenCalledWith({
      templateId: "a01000000000002AAA"
    });
    expect(
      element.shadowRoot.querySelector(".unsaved-changes-confirm")
    ).toBeNull();
    expect(templateSelect.value).toBe("a01000000000002AAA");
  });

  it("only offers cancel or leave when the draft cannot be saved", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const borderStyleSelect = element.shadowRoot.querySelector(
      'select[data-style="borderStyle"]'
    );
    borderStyleSelect.value = "solid";
    borderStyleSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const confirmation = element.shadowRoot.querySelector(
      ".unsaved-changes-confirm"
    );
    expect(confirmation.querySelector("h2").textContent).toBe(
      "Leave without saving?"
    );
    expect(confirmation.querySelector("p").textContent).toContain(
      "no template name and no selected object"
    );
    expect(confirmation.querySelector('[data-role="unsaved-save"]')).toBeNull();
    expect(
      confirmation.querySelectorAll(".unsaved-changes-actions button")
    ).toHaveLength(2);
    expect(
      confirmation.querySelector('[data-role="unsaved-discard"]').textContent
    ).toBe("Leave without saving");

    confirmation.querySelector('[data-role="unsaved-discard"]').click();
    await flushPromises();
    await flushPromises();

    expect(saveTemplate).not.toHaveBeenCalled();
    expect(getTemplate).toHaveBeenCalledWith({
      templateId: "a01000000000002AAA"
    });
  });

  it("keeps Save enabled and reports every missing required field", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    const toastHandler = jest.fn();
    element.addEventListener("lightning__showtoast", toastHandler);

    document.body.appendChild(element);
    await flushPromises();

    const saveButton = Array.from(
      element.shadowRoot.querySelectorAll(".top-toolbar .toolbar-button")
    ).find((button) => button.textContent.trim() === "Save");
    const templateNameInput = element.shadowRoot.querySelector(
      'input[placeholder="Template name"]'
    );
    const objectSelect = element.shadowRoot.querySelector(
      '[data-role="object-select"]'
    );

    expect(saveButton.disabled).toBe(false);

    saveButton.click();
    await flushPromises();
    expect(toastHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          title: "Template not saved",
          message: "Enter a template name and select an object.",
          variant: "error"
        })
      })
    );

    templateNameInput.value = "Opportunity proposal";
    templateNameInput.dispatchEvent(new CustomEvent("change"));
    saveButton.click();
    await flushPromises();
    expect(toastHandler.mock.calls.at(-1)[0].detail.message).toBe(
      "Select an object before saving the template."
    );

    templateNameInput.value = "";
    templateNameInput.dispatchEvent(new CustomEvent("change"));
    objectSelect.value = "Account";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    saveButton.click();
    await flushPromises();
    expect(toastHandler.mock.calls.at(-1)[0].detail.message).toBe(
      "Enter a template name before saving the template."
    );
    expect(saveTemplate).not.toHaveBeenCalled();
    expect(saveButton.disabled).toBe(false);
  });

  it("moves the selected component with exact X and Y values", async () => {
    const regionStyles = {
      background: "#ffffff",
      padding: 8,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: "#c9c9c9",
      borderRadius: 4
    };
    const content = {
      pagePadding: 32,
      globalElementPadding: 8,
      showHeader: true,
      showBody: true,
      showFooter: true,
      repeatHeaderOnEachPage: true,
      repeatFooterOnEachPage: true,
      manualPageCount: 0,
      manualPages: [],
      header: {
        id: "header",
        label: "Header",
        styles: { ...regionStyles, height: 110 },
        blocks: []
      },
      body: {
        layout: "one",
        sections: [
          {
            id: "body-1",
            label: "Body",
            styles: regionStyles,
            blocks: [
              {
                id: "block-1",
                type: "text",
                content: "Precisely positioned text",
                styles: {
                  width: 180,
                  height: 60,
                  x: 120,
                  y: 160,
                  padding: 0,
                  fontSize: 14
                }
              }
            ]
          }
        ]
      },
      footer: {
        id: "footer",
        label: "Footer",
        styles: { ...regionStyles, height: 80 },
        blocks: []
      }
    };
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: JSON.stringify(content),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const bodyRegion = element.shadowRoot.querySelector(
      '[data-region-id="body-1"]'
    );
    Object.defineProperty(bodyRegion, "clientWidth", {
      configurable: true,
      value: 700
    });
    Object.defineProperty(bodyRegion, "clientHeight", {
      configurable: true,
      value: 800
    });

    const blockComponent = bodyRegion.querySelector("c-pdf-builder-block");
    blockComponent.dispatchEvent(
      new CustomEvent("selectblock", {
        detail: { blockId: "block-1", regionId: "body-1" },
        bubbles: true,
        composed: true
      })
    );
    await flushPromises();

    const xInput = element.shadowRoot.querySelector('input[data-position="x"]');
    const yInput = element.shadowRoot.querySelector('input[data-position="y"]');
    expect(xInput.value).toBe("120");
    expect(yInput.value).toBe("160");

    xInput.value = "145";
    xInput.dispatchEvent(new CustomEvent("input"));
    await flushPromises();
    yInput.value = "185";
    yInput.dispatchEvent(new CustomEvent("input"));
    await flushPromises();

    const movedBlock = element.shadowRoot.querySelector(
      '[data-region-id="body-1"] c-pdf-builder-block'
    ).block;
    expect(movedBlock.styles.x).toBe(145);
    expect(movedBlock.styles.y).toBe(185);
  });

  it("uses endpoint handles for lines and keeps copies aligned on their fixed axis", async () => {
    const regionStyles = {
      background: "#ffffff",
      padding: 8,
      borderWidth: 0,
      borderStyle: "none",
      borderColor: "#c9c9c9",
      borderRadius: 0
    };
    const content = {
      pagePadding: 32,
      globalElementPadding: 8,
      showHeader: true,
      showBody: true,
      showFooter: true,
      repeatHeaderOnEachPage: true,
      repeatFooterOnEachPage: true,
      manualPageCount: 0,
      manualPages: [],
      header: {
        id: "header",
        label: "Header",
        styles: { ...regionStyles, height: 110 },
        blocks: []
      },
      body: {
        layout: "one",
        sections: [
          {
            id: "body-1",
            label: "Body",
            styles: regionStyles,
            blocks: [
              {
                id: "horizontal-line",
                type: "divider",
                content: "",
                styles: {
                  x: 120,
                  y: 160,
                  lineLength: 300,
                  height: 12,
                  lineThickness: 1,
                  lineStyle: "solid",
                  lineColor: "#181818"
                }
              },
              {
                id: "vertical-line",
                type: "verticalLine",
                content: "",
                styles: {
                  x: 240,
                  y: 280,
                  width: 12,
                  height: 120,
                  lineThickness: 1,
                  lineStyle: "solid",
                  lineColor: "#181818"
                }
              }
            ]
          }
        ]
      },
      footer: {
        id: "footer",
        label: "Footer",
        styles: { ...regionStyles, height: 80 },
        blocks: []
      }
    };
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: JSON.stringify(content),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const selectBlock = (blockId) => {
      element.shadowRoot
        .querySelector(
          `[data-region-id="body-1"] [data-block-id="${blockId}"] c-pdf-builder-block`
        )
        .dispatchEvent(
          new CustomEvent("selectblock", {
            detail: { blockId, regionId: "body-1" },
            bubbles: true,
            composed: true
          })
        );
    };

    selectBlock("horizontal-line");
    await flushPromises();
    expect(
      element.shadowRoot.querySelector('input[data-style="lineLength"]')
    ).toBeNull();
    expect(
      Array.from(
        element.shadowRoot.querySelectorAll(
          '[data-block-id="horizontal-line"][data-resize-dir]'
        )
      )
        .map((handle) => handle.dataset.resizeDir)
        .sort()
    ).toEqual(["e", "w"]);
    expect(
      Array.from(element.shadowRoot.querySelectorAll("summary")).map(
        (summary) => summary.textContent.trim()
      )
    ).toContain("Size");
    expect(
      element.shadowRoot.querySelector('input[data-style="width"]')
    ).not.toBeNull();
    expect(
      element.shadowRoot.querySelector('input[data-style="height"]')
    ).toBeNull();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", ctrlKey: true })
    );
    await flushPromises();

    selectBlock("vertical-line");
    await flushPromises();
    expect(
      Array.from(
        element.shadowRoot.querySelectorAll(
          '[data-block-id="vertical-line"][data-resize-dir]'
        )
      )
        .map((handle) => handle.dataset.resizeDir)
        .sort()
    ).toEqual(["n", "s"]);
    expect(
      Array.from(element.shadowRoot.querySelectorAll("summary")).map(
        (summary) => summary.textContent.trim()
      )
    ).toContain("Size");
    expect(
      element.shadowRoot.querySelector('input[data-style="width"]')
    ).toBeNull();
    expect(
      element.shadowRoot.querySelector('input[data-style="height"]')
    ).not.toBeNull();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", ctrlKey: true })
    );
    await flushPromises();

    const blockComponents = Array.from(
      element.shadowRoot.querySelectorAll(
        '[data-region-id="body-1"] c-pdf-builder-block'
      )
    );
    const horizontalCopy = blockComponents.find(
      (component) =>
        component.block.type === "divider" &&
        component.block.id !== "horizontal-line"
    );
    const verticalCopy = blockComponents.find(
      (component) =>
        component.block.type === "verticalLine" &&
        component.block.id !== "vertical-line"
    );
    const sourceHorizontal = blockComponents.find(
      (component) => component.block.id === "horizontal-line"
    );
    const sourceVertical = blockComponents.find(
      (component) => component.block.id === "vertical-line"
    );

    expect(sourceHorizontal.block.styles.height).toBe(1);
    expect(sourceVertical.block.styles.width).toBe(1);
    expect(horizontalCopy.block.styles.x).toBe(sourceHorizontal.block.styles.x);
    expect(horizontalCopy.block.styles.y).toBe(
      sourceHorizontal.block.styles.y + 16
    );
    expect(verticalCopy.block.styles.x).toBeGreaterThan(
      sourceVertical.block.styles.x
    );
    expect(verticalCopy.block.styles.y).toBe(sourceVertical.block.styles.y);
  });

  it("does not delete the selected block while editing the preview Record ID", async () => {
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: JSON.stringify(createKeyboardShortcutTemplate()),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const selectedBlock = element.shadowRoot.querySelector(
      '[data-block-id="keyboard-test-line"] c-pdf-builder-block'
    );
    selectedBlock.dispatchEvent(
      new CustomEvent("selectblock", {
        detail: { blockId: "keyboard-test-line", regionId: "body-1" },
        bubbles: true,
        composed: true
      })
    );
    await flushPromises();

    Array.from(element.shadowRoot.querySelectorAll("button"))
      .find((button) => button.textContent.trim() === "Preview")
      .click();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".delete-button").disabled).toBe(
      true
    );
    const recordIdInput =
      element.shadowRoot.querySelector(".preview-record-id");
    const windowKeyDownHandler = jest.fn();
    window.addEventListener("keydown", windowKeyDownHandler);
    recordIdInput.value = "0Q0000000000000001";
    recordIdInput.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Backspace",
        bubbles: true,
        composed: true,
        cancelable: true
      })
    );
    recordIdInput.value = "";
    recordIdInput.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Delete",
        bubbles: true,
        composed: true,
        cancelable: true
      })
    );
    window.removeEventListener("keydown", windowKeyDownHandler);
    await flushPromises();

    expect(windowKeyDownHandler).not.toHaveBeenCalled();
    expect(
      element.shadowRoot.querySelector(
        '[data-block-id="keyboard-test-line"] c-pdf-builder-block'
      )
    ).not.toBeNull();
  });

  it("still deletes the selected block with the canvas keyboard shortcut", async () => {
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: JSON.stringify(createKeyboardShortcutTemplate()),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    element.shadowRoot
      .querySelector('[data-block-id="keyboard-test-line"] c-pdf-builder-block')
      .dispatchEvent(
        new CustomEvent("selectblock", {
          detail: { blockId: "keyboard-test-line", regionId: "body-1" },
          bubbles: true,
          composed: true
        })
      );
    await flushPromises();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", cancelable: true })
    );
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(
        '[data-block-id="keyboard-test-line"] c-pdf-builder-block'
      )
    ).toBeNull();
  });

  it("releases the template selector focus when a loaded block is selected", async () => {
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Opportunity service quotation",
      objectApiName: "Opportunity",
      contentJson: JSON.stringify(createKeyboardShortcutTemplate()),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    templateSelect.focus();

    element.shadowRoot
      .querySelector('[data-block-id="keyboard-test-line"] c-pdf-builder-block')
      .dispatchEvent(
        new CustomEvent("selectblock", {
          detail: { blockId: "keyboard-test-line", regionId: "body-1" },
          bubbles: true,
          composed: true
        })
      );
    await flushPromises();

    expect(element.shadowRoot.activeElement).not.toBe(templateSelect);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", cancelable: true })
    );
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(
        '[data-block-id="keyboard-test-line"] c-pdf-builder-block'
      )
    ).toBeNull();
  });

  it("keeps a padding-free image fitted to its aspect ratio while resizing", async () => {
    const regionStyles = {
      background: "#ffffff",
      padding: 8,
      borderWidth: 0,
      borderStyle: "none",
      borderColor: "#c9c9c9",
      borderRadius: 0
    };
    const content = {
      pagePadding: 32,
      globalElementPadding: 8,
      showHeader: true,
      showBody: true,
      showFooter: true,
      repeatHeaderOnEachPage: true,
      repeatFooterOnEachPage: true,
      manualPageCount: 0,
      manualPages: [],
      header: {
        id: "header",
        label: "Header",
        styles: { ...regionStyles, height: 110 },
        blocks: []
      },
      body: {
        layout: "one",
        sections: [
          {
            id: "body-1",
            label: "Body",
            styles: regionStyles,
            blocks: [
              {
                id: "image-1",
                type: "image",
                imageSrc:
                  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
                imageAlt: "Diagram",
                imageAspectRatio: 2,
                styles: {
                  width: 240,
                  height: 132,
                  x: 0,
                  y: 0,
                  padding: 10,
                  borderWidth: 2,
                  borderStyle: "solid",
                  borderColor: "#000000"
                }
              }
            ]
          }
        ]
      },
      footer: {
        id: "footer",
        label: "Footer",
        styles: { ...regionStyles, height: 80 },
        blocks: []
      }
    };
    getTemplate.mockResolvedValue({
      id: "a01000000000002AAA",
      name: "Quote proposal",
      objectApiName: "Quote",
      contentJson: JSON.stringify(content),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const bodyRegion = element.shadowRoot.querySelector(
      '[data-region-id="body-1"]'
    );
    Object.defineProperty(bodyRegion, "clientWidth", {
      configurable: true,
      value: 700
    });
    Object.defineProperty(bodyRegion, "clientHeight", {
      configurable: true,
      value: 800
    });

    const blockComponent = bodyRegion.querySelector("c-pdf-builder-block");
    blockComponent.dispatchEvent(
      new CustomEvent("selectblock", {
        detail: { blockId: "image-1", regionId: "body-1" },
        bubbles: true,
        composed: true
      })
    );
    await flushPromises();

    const resizeHandle = element.shadowRoot.querySelector(
      '[data-block-id="image-1"][data-resize-dir="se"]'
    );
    resizeHandle.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        clientX: 100,
        clientY: 100
      })
    );
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 200,
        clientY: 120
      })
    );
    await flushPromises();

    const resizedBlock = element.shadowRoot.querySelector(
      '[data-region-id="body-1"] c-pdf-builder-block'
    ).block;
    expect(resizedBlock.styles.width).toBe(340);
    expect(resizedBlock.styles.height).toBe(172);
    expect(resizedBlock.styles.padding).toBe(0);
    expect(resizedBlock.styles.heightManuallyResized).toBe(false);
    expect(resizedBlock.imageAspectRatio).toBe(2);

    window.dispatchEvent(new MouseEvent("mouseup"));
  });

  it("does not initialize the builder when organization configuration is invalid", async () => {
    getConfiguration.mockResolvedValue({ pageWidth: 0 });
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    expect(getObjects).not.toHaveBeenCalled();
    expect(element.shadowRoot.querySelector(".top-toolbar")).toBeNull();
    expect(
      element.shadowRoot.querySelector(".configuration-state h2").textContent
    ).toBe("PDF Builder configuration is unavailable");
    expect(
      element.shadowRoot.querySelector(".configuration-state p").textContent
    ).toContain('configuration "pageWidth" must be greater than zero');
  });

  it("creates header, body and footer without borders by default", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const previewButton = Array.from(
      element.shadowRoot.querySelectorAll(".top-toolbar .toolbar-button")
    ).find((button) => button.textContent.trim() === "Preview");
    previewButton.click();
    await flushPromises();

    const previewPage = element.shadowRoot.querySelector(
      ".preview-content .pdf-page"
    );
    expect(previewPage.tagName).toBe("DIV");
    const regions = [
      previewPage.querySelector("header"),
      previewPage.querySelector(".pdf-body section"),
      previewPage.querySelector("footer")
    ];

    regions.forEach((region) => {
      expect(region.style.borderStyle).toBe("none");
      expect(region.style.borderWidth).toBe("0px");
    });
  });

  it("preserves the configured solid region border in preview", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const borderStyleSelect = element.shadowRoot.querySelector(
      'select[data-style="borderStyle"]'
    );
    borderStyleSelect.value = "solid";
    borderStyleSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const previewButton = Array.from(
      element.shadowRoot.querySelectorAll(".top-toolbar .toolbar-button")
    ).find((button) => button.textContent.trim() === "Preview");
    previewButton.click();
    await flushPromises();

    const previewBodyRegion = element.shadowRoot.querySelector(
      ".preview-content .pdf-body section"
    );
    const previewPage = element.shadowRoot.querySelector(
      ".preview-content .pdf-page"
    );
    const previewHeader = previewPage.querySelector("header");
    const previewFooter = previewPage.querySelector("footer");
    expect(previewBodyRegion).not.toBeNull();
    expect(previewBodyRegion.style.borderStyle).toBe("solid");
    expect(previewHeader.style.width).toBe("100%");
    expect(previewFooter.style.width).toBe("100%");
    expect(previewPage.style.getPropertyValue("width")).toBe("794px");
    expect(previewPage.style.getPropertyValue("box-sizing")).toBe("border-box");
    expect(previewPage.style.getPropertyPriority("box-sizing")).toBe(
      "important"
    );
  });

  it("stretches preview body sections across the printable page width", async () => {
    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });

    document.body.appendChild(element);
    await flushPromises();

    const bodyLayoutSelect = element.shadowRoot.querySelector(
      '[data-role="body-layout-select"]'
    );
    bodyLayoutSelect.value = "two";
    bodyLayoutSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const previewButton = Array.from(
      element.shadowRoot.querySelectorAll(".top-toolbar .toolbar-button")
    ).find((button) => button.textContent.trim() === "Preview");
    previewButton.click();
    await flushPromises();

    const previewBody = element.shadowRoot.querySelector(
      ".preview-content .pdf-body"
    );
    const previewSections = Array.from(
      previewBody.querySelectorAll(":scope > section")
    );

    expect(previewSections).toHaveLength(2);
    expect(window.getComputedStyle(previewBody).width).toBe("100%");
    previewSections.forEach((section) => {
      const computedStyle = window.getComputedStyle(section);
      expect(computedStyle.width).toBe("0px");
      expect(computedStyle.minWidth).toBe("0");
      expect(computedStyle.flexGrow).toBe("1");
    });
  });

  it("prevents header and footer resizing from crossing their content", async () => {
    const regionStyles = {
      background: "#ffffff",
      padding: 10,
      borderWidth: 2,
      borderStyle: "solid",
      borderColor: "#c9c9c9",
      borderRadius: 0
    };
    const content = {
      pagePadding: 32,
      globalElementPadding: 8,
      showHeader: true,
      showBody: true,
      showFooter: true,
      repeatHeaderOnEachPage: true,
      repeatFooterOnEachPage: true,
      manualPageCount: 0,
      manualPages: [],
      header: {
        id: "header",
        label: "Header",
        styles: { ...regionStyles, height: 250 },
        blocks: [
          {
            id: "header-image",
            type: "image",
            imageSrc: "",
            imageAlt: "Header image",
            styles: { width: 100, height: 80, x: 0, y: 120 }
          }
        ]
      },
      body: {
        layout: "one",
        sections: [
          {
            id: "body-1",
            label: "Body",
            styles: {
              background: "#ffffff",
              padding: 8,
              borderWidth: 0,
              borderStyle: "none",
              borderColor: "#c9c9c9",
              borderRadius: 0
            },
            blocks: []
          }
        ]
      },
      footer: {
        id: "footer",
        label: "Footer",
        styles: { ...regionStyles, padding: 8, height: 160 },
        blocks: [
          {
            id: "footer-line",
            type: "verticalLine",
            content: "",
            styles: { width: 12, height: 70, x: 0, y: 60 }
          }
        ]
      }
    };
    getTemplate.mockResolvedValueOnce({
      id: "a01000000000002AAA",
      name: "Protected fixed regions",
      objectApiName: "Quote",
      contentJson: JSON.stringify(content),
      generatedHtml: ""
    });

    const element = createElement("c-pdf-builder", {
      is: PDFBuilder
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateSelect = element.shadowRoot.querySelector(
      '[data-role="template-select"]'
    );
    templateSelect.value = "a01000000000002AAA";
    templateSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    let header = element.shadowRoot.querySelector('[data-region-id="header"]');
    header.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    header = element.shadowRoot.querySelector('[data-region-id="header"]');
    const headerBlock = header.querySelector(
      '.block-shell[data-block-id="header-image"]'
    );
    header.getBoundingClientRect = jest.fn(() => ({
      top: 100,
      bottom: 350,
      left: 0,
      right: 700,
      width: 700,
      height: 250
    }));
    headerBlock.getBoundingClientRect = jest.fn(() => ({
      top: 120,
      bottom: 300,
      left: 10,
      right: 110,
      width: 100,
      height: 180
    }));

    let heightInput = element.shadowRoot.querySelector(
      'input[data-style="height"]'
    );
    heightInput.value = "40";
    heightInput.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot
        .querySelector('[data-region-id="header"]')
        .getAttribute("style")
    ).toContain("--region-height:212px");

    let footer = element.shadowRoot.querySelector('[data-region-id="footer"]');
    footer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();

    footer = element.shadowRoot.querySelector('[data-region-id="footer"]');
    const footerResizeHandle = footer.querySelector(".region-resize-handle");
    footerResizeHandle.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        clientY: 100
      })
    );
    window.dispatchEvent(new MouseEvent("mousemove", { clientY: 300 }));
    window.dispatchEvent(new MouseEvent("mouseup", { clientY: 300 }));
    await flushPromises();

    expect(
      element.shadowRoot
        .querySelector('[data-region-id="footer"]')
        .getAttribute("style")
    ).toContain("--region-height:150px");

    heightInput = element.shadowRoot.querySelector(
      'input[data-style="height"]'
    );
    expect(heightInput.value).toBe("150");
  });
});
