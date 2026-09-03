import { LightningElement, api } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { RefreshEvent } from "lightning/refresh";
import { notifyRecordUpdateAvailable } from "lightning/uiRecordApi";

import getTemplatesForObject from "@salesforce/apex/PDFBuilderController.getTemplatesForObject";
import generatePdf from "@salesforce/apex/PDFBuilderController.generatePdf";
import generatePdfToFiles from "@salesforce/apex/PDFBuilderController.generatePdfToFiles";

export default class PDFBuilderGenerator extends NavigationMixin(
  LightningElement
) {
  _recordId;
  _objectApiName;
  _loadedObjectApiName;

  @api
  get recordId() {
    return this._recordId;
  }

  set recordId(value) {
    if (this._recordId === value) {
      return;
    }

    this._recordId = value;

    if (this.isConnected && this._objectApiName) {
      this._loadedObjectApiName = null;
      this.initialize();
    }
  }

  @api
  get objectApiName() {
    return this._objectApiName;
  }

  set objectApiName(value) {
    if (this._objectApiName === value) {
      return;
    }

    this._objectApiName = value;

    if (value) {
      this.initialize();
    }
  }

  templates = [];
  selectedTemplateId = "";
  isLoading = false;
  isGenerating = false;
  errorMessage = "";
  statusMessage = "";
  destination = "local";
  savedContentDocumentId = "";
  savedPdfBase64Data = "";

  connectedCallback() {
    this.initialize();
  }

  initialize() {
    if (!this._objectApiName) {
      return;
    }

    if (this._loadedObjectApiName === this._objectApiName) {
      return;
    }

    this._loadedObjectApiName = this._objectApiName;
    this.loadTemplates();
  }

  get templateOptions() {
    return this.templates.map((template) => ({
      label: template.name,
      value: template.id
    }));
  }

  get isTemplateSelectDisabled() {
    return this.isLoading || this.templateOptions.length === 0;
  }

  get isGenerateDisabled() {
    return (
      this.isLoading ||
      this.isGenerating ||
      !this.selectedTemplateId ||
      !this._recordId
    );
  }

  get isLocalDestinationSelected() {
    return this.destination === "local";
  }

  get isFilesDestinationSelected() {
    return this.destination === "files";
  }

  get localDestinationClass() {
    return this.destinationOptionClass("local");
  }

  get filesDestinationClass() {
    return this.destinationOptionClass("files");
  }

  destinationOptionClass(value) {
    return [
      "destination-option",
      this.destination === value ? "destination-option-selected" : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  get generateButtonLabel() {
    return this.destination === "files"
      ? "Generate and save"
      : "Generate and download";
  }

  get generationAlternativeText() {
    return this.destination === "files"
      ? "Generating and saving PDF"
      : "Generating PDF";
  }

  get isBusy() {
    return this.isLoading || this.isGenerating;
  }

  get busyLabel() {
    return this.isGenerating
      ? this.generationAlternativeText
      : "Loading templates";
  }

  get destinationHelpText() {
    return this.destination === "files"
      ? "The PDF will be saved in Files and linked to this record."
      : "The PDF will be downloaded by your browser.";
  }

  get hasSavedFile() {
    return Boolean(this.savedPdfBase64Data || this.savedContentDocumentId);
  }

  async loadTemplates() {
    if (!this._objectApiName) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = "";
    this.statusMessage = "";

    try {
      const result = await getTemplatesForObject({
        objectApiName: this._objectApiName,
        recordId: this._recordId
      });

      this.templates = result || [];
      this.selectedTemplateId =
        this.templates.find((template) => template.isDefault)?.id || "";

      if (this.templates.length === 0) {
        this.statusMessage = "No templates found for this object.";
      }
    } catch (error) {
      this.templates = [];
      this._loadedObjectApiName = null;

      this.showErrorToast(
        "Templates could not be loaded",
        this.getErrorMessage(error)
      );
    } finally {
      this.isLoading = false;
    }
  }

  handleTemplateChange(event) {
    this.selectedTemplateId = event.detail.value;
    this.statusMessage = "";
    this.errorMessage = "";
    this.savedContentDocumentId = "";
    this.savedPdfBase64Data = "";
  }

  handleDestinationChange(event) {
    this.destination = event.detail.value;
    this.statusMessage = "";
    this.errorMessage = "";
    this.savedContentDocumentId = "";
    this.savedPdfBase64Data = "";
  }

  handleDestinationClick(event) {
    this.handleDestinationChange({
      detail: { value: event.currentTarget.dataset.value }
    });
  }

  async handleGeneratePdf() {
    if (!this.selectedTemplateId || !this._recordId) {
      return;
    }

    this.isGenerating = true;
    this.errorMessage = "";
    this.statusMessage = "";
    this.savedContentDocumentId = "";
    this.savedPdfBase64Data = "";

    try {
      if (this.destination === "files") {
        const savedPdf = await generatePdfToFiles({
          templateId: this.selectedTemplateId,
          recordId: this._recordId
        });

        this.savedContentDocumentId = savedPdf.contentDocumentId;
        this.savedPdfBase64Data = savedPdf.base64Data || "";

        this.statusMessage =
          `${savedPdf.fileName} was saved to Salesforce Files.` +
          `${savedPdf.warning ? ` ${savedPdf.warning}` : ""}`;

        this.showToast("PDF saved", this.statusMessage, "success");
        await this.refreshRecordPage();
      } else {
        const pdf = await generatePdf({
          templateId: this.selectedTemplateId,
          recordId: this._recordId
        });

        this.downloadPdf(pdf);

        this.statusMessage =
          `${pdf.fileName || "document.pdf"} was downloaded.` +
          `${pdf.warning ? ` ${pdf.warning}` : ""}`;
      }
    } catch (error) {
      this.showErrorToast(
        "PDF could not be generated",
        this.getErrorMessage(error)
      );
    } finally {
      this.isGenerating = false;
    }
  }

  downloadPdf(pdf) {
    const link = document.createElement("a");

    link.href = `data:application/pdf;base64,${pdf.base64Data}`;

    link.download = pdf.fileName || "document.pdf";

    this.template.appendChild(link);

    link.click();

    link.remove();
  }

  handleOpenSavedFile() {
    if (this.savedPdfBase64Data) {
      this.openPdfInBrowser(this.savedPdfBase64Data);
      return;
    }

    if (!this.savedContentDocumentId) {
      return;
    }

    this[NavigationMixin.Navigate]({
      type: "standard__namedPage",
      attributes: {
        pageName: "filePreview"
      },
      state: {
        selectedRecordId: this.savedContentDocumentId
      }
    });
  }

  openPdfInBrowser(base64Data) {
    const viewerWindow = window.open("", "_blank");

    if (!viewerWindow) {
      this.showErrorToast(
        "PDF could not be opened",
        "Allow pop-ups for Salesforce and try again."
      );
      return;
    }

    try {
      viewerWindow.opener = null;
      const pdfUrl = URL.createObjectURL(this.createPdfBlob(base64Data));

      viewerWindow.location.replace(pdfUrl);
    } catch (error) {
      viewerWindow.close();
      this.showErrorToast(
        "PDF could not be opened",
        this.getErrorMessage(error)
      );
    }
  }

  createPdfBlob(base64Data) {
    const binaryPdf = window.atob(base64Data);
    const chunkSize = 1024;
    const byteArrays = [];

    for (let offset = 0; offset < binaryPdf.length; offset += chunkSize) {
      const chunk = binaryPdf.slice(offset, offset + chunkSize);
      byteArrays.push(
        Uint8Array.from(chunk, (character) => character.charCodeAt(0))
      );
    }

    return new Blob(byteArrays, { type: "application/pdf" });
  }

  async refreshRecordPage() {
    await notifyRecordUpdateAvailable([{ recordId: this._recordId }]);
    this.dispatchEvent(new RefreshEvent());
  }

  getErrorMessage(error) {
    if (Array.isArray(error?.body)) {
      return error.body.map((item) => item.message).join(", ");
    }

    return error?.body?.message || error?.message || "Unexpected error";
  }

  showErrorToast(title, message) {
    this.showToast(title, message, "error", "sticky");
  }

  showToast(title, message, variant = "info", mode = "dismissible") {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant,
        mode
      })
    );
  }
}
