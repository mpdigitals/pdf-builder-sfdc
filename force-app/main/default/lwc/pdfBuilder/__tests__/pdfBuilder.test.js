import { createElement } from "@lwc/engine-dom";
import PDFBuilder from "c/pdfBuilder";
import getConfiguration from "@salesforce/apex/PDFBuilderController.getConfiguration";
import getObjects from "@salesforce/apex/PDFBuilderController.getObjects";
import getFields from "@salesforce/apex/PDFBuilderController.getFields";
import getRelatedLists from "@salesforce/apex/PDFBuilderController.getRelatedLists";
import getRelatedListFields from "@salesforce/apex/PDFBuilderController.getRelatedListFields";
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

  it("requires an object before expanding related-list fields", async () => {
    getTemplate.mockResolvedValueOnce({
      id: "a01000000000002AAA",
      name: "Unassigned related list",
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
          message: "Select an object before configuring related-list fields.",
          variant: "warning"
        })
      })
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

  it("keeps copied horizontal and vertical lines aligned on their fixed axis", async () => {
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
                  height: 1,
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
                  width: 1,
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
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", ctrlKey: true })
    );
    await flushPromises();

    selectBlock("vertical-line");
    await flushPromises();
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

    expect(horizontalCopy.block.styles.x).toBe(sourceHorizontal.block.styles.x);
    expect(horizontalCopy.block.styles.y).toBe(
      sourceHorizontal.block.styles.y + 16
    );
    expect(verticalCopy.block.styles.x).toBeGreaterThan(
      sourceVertical.block.styles.x
    );
    expect(verticalCopy.block.styles.y).toBe(sourceVertical.block.styles.y);
  });

  it("keeps an image container fitted to its aspect ratio and padding while resizing", async () => {
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
    expect(resizedBlock.styles.height).toBe(182);
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
});
