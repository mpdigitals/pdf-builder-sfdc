import { createElement } from "@lwc/engine-dom";
import PDFBuilderGenerator from "c/pdfBuilderGenerator";
import getTemplatesForObject from "@salesforce/apex/PDFBuilderController.getTemplatesForObject";
import generatePdf from "@salesforce/apex/PDFBuilderController.generatePdf";
import generatePdfToFiles from "@salesforce/apex/PDFBuilderController.generatePdfToFiles";
import { notifyRecordUpdateAvailable } from "lightning/uiRecordApi";

jest.mock(
  "lightning/refresh",
  () => ({
    RefreshEvent: class RefreshEvent extends CustomEvent {
      constructor() {
        super("refresh");
      }
    }
  }),
  { virtual: true }
);
jest.mock(
  "lightning/uiRecordApi",
  () => ({
    notifyRecordUpdateAvailable: jest.fn(() => Promise.resolve())
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/PDFBuilderController.getTemplatesForObject",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.generatePdf",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/PDFBuilderController.generatePdfToFiles",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const flushPromises = () => Promise.resolve();

describe("c-pdf-builder-generator", () => {
  beforeEach(() => {
    getTemplatesForObject.mockResolvedValue([
      {
        id: "a01000000000001AAA",
        name: "Account proposal",
        objectApiName: "Account"
      }
    ]);
    generatePdf.mockResolvedValue({
      fileName: "Account proposal.pdf",
      base64Data: "JVBERi0xLjQ=",
      warning: null
    });
    generatePdfToFiles.mockResolvedValue({
      fileName: "Account proposal.pdf",
      contentVersionId: "068000000000001AAA",
      contentDocumentId: "069000000000001AAA",
      warning: null
    });
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("loads templates for the current record object", async () => {
    const element = createElement("c-pdf-builder-generator", {
      is: PDFBuilderGenerator
    });
    element.recordId = "001000000000001AAA";
    element.objectApiName = "Account";

    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    expect(getTemplatesForObject).toHaveBeenCalledWith({
      objectApiName: "Account"
    });
    const combobox = element.shadowRoot.querySelector("lightning-combobox");
    expect(combobox.options).toEqual([
      { label: "Account proposal", value: "a01000000000001AAA" }
    ]);
    expect(combobox.disabled).toBe(false);
  });

  it("downloads the generated PDF when local destination is selected", async () => {
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const element = createElement("c-pdf-builder-generator", {
      is: PDFBuilderGenerator
    });
    element.recordId = "001000000000001AAA";
    element.objectApiName = "Account";

    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    const combobox = element.shadowRoot.querySelector("lightning-combobox");
    combobox.dispatchEvent(
      new CustomEvent("change", {
        detail: { value: "a01000000000001AAA" }
      })
    );
    await flushPromises();
    element.shadowRoot.querySelector("lightning-button").click();
    await flushPromises();
    await flushPromises();

    expect(generatePdf).toHaveBeenCalledWith({
      templateId: "a01000000000001AAA",
      recordId: "001000000000001AAA"
    });
    expect(generatePdfToFiles).not.toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it("saves the generated PDF to Files when Files destination is selected", async () => {
    const element = createElement("c-pdf-builder-generator", {
      is: PDFBuilderGenerator
    });
    const refreshHandler = jest.fn();
    element.addEventListener("refresh", refreshHandler);
    element.recordId = "001000000000001AAA";
    element.objectApiName = "Account";

    document.body.appendChild(element);
    await flushPromises();
    await flushPromises();

    element.shadowRoot
      .querySelector("lightning-combobox")
      .dispatchEvent(
        new CustomEvent("change", { detail: { value: "a01000000000001AAA" } })
      );
    element.shadowRoot
      .querySelector("lightning-radio-group")
      .dispatchEvent(new CustomEvent("change", { detail: { value: "files" } }));
    await flushPromises();
    element.shadowRoot.querySelector("lightning-button").click();
    await flushPromises();
    await flushPromises();

    expect(generatePdfToFiles).toHaveBeenCalledWith({
      templateId: "a01000000000001AAA",
      recordId: "001000000000001AAA"
    });
    expect(generatePdf).not.toHaveBeenCalled();
    expect(notifyRecordUpdateAvailable).toHaveBeenCalledWith([
      { recordId: "001000000000001AAA" }
    ]);
    expect(refreshHandler).toHaveBeenCalledTimes(1);
    expect(
      element.shadowRoot.querySelectorAll("lightning-button")
    ).toHaveLength(2);
  });
});
