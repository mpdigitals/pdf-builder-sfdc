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
    this._recordId = value;
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

  get destinationOptions() {
    return [
      {
        label: "Download to computer",
        value: "local"
      },
      {
        label: "Save to Salesforce Files",
        value: "files"
      }
    ];
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
    return Boolean(this.savedContentDocumentId);
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
        objectApiName: this._objectApiName
      });

      this.templates = result || [];

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
  }

  handleDestinationChange(event) {
    this.destination = event.detail.value;
    this.statusMessage = "";
    this.errorMessage = "";
    this.savedContentDocumentId = "";
  }

  async handleGeneratePdf() {
    if (!this.selectedTemplateId || !this._recordId) {
      return;
    }

    this.isGenerating = true;
    this.errorMessage = "";
    this.statusMessage = "";
    this.savedContentDocumentId = "";

    try {
      if (this.destination === "files") {
        const savedPdf = await generatePdfToFiles({
          templateId: this.selectedTemplateId,
          recordId: this._recordId
        });

        this.savedContentDocumentId = savedPdf.contentDocumentId;

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
