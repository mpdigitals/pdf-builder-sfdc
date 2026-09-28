import { LightningElement, api } from "lwc";
import getFields from "@salesforce/apex/PDFBuilderController.getFields";
import getRelatedLists from "@salesforce/apex/PDFBuilderController.getRelatedLists";
import getRelatedListFields from "@salesforce/apex/PDFBuilderController.getRelatedListFields";
import getRecordTypeOptions from "@salesforce/apex/PDFBuilderController.getRecordTypeOptions";
import generateWizardProposal from "@salesforce/apex/PDFBuilderAIService.generateWizardProposal";
import {
  applyAIWizardProposal,
  applyGuidedWizardPrompt,
  createDefaultWizardRecipe,
  findExactPromptFieldMatches,
  findPromptMatches,
  rankRelatedLists
} from "c/pdfBuilderWizardModel";

const DEFAULT_AI_MAX_PROMPT_LENGTH = 4000;
const DEFAULT_AI_PROVIDER_LABEL = "Salesforce Models API";
const DEFAULT_AI_UNAVAILABLE_MESSAGE =
  "Salesforce AI is not available in this org.";
const AI_INVALID_RESPONSE_MESSAGE =
  "Salesforce AI returned a response that could not be processed. Please try again. If it continues, simplify the request or apply it in smaller sections.";
const MAX_AI_PROPOSAL_ATTEMPTS = 3;
const AI_UNAVAILABLE_ERROR_PATTERN = /AI_UNAVAILABLE:/i;
const AI_UNAVAILABLE_PREFIX_PATTERN = /^.*AI_UNAVAILABLE:\s*/i;
const AI_ERROR_PATTERN = /AI_ERROR:([A-Z_]+):\s*(.*)$/i;
const AI_ERROR_CODES = Object.freeze({
  UNAVAILABLE: "AI_UNAVAILABLE",
  INVALID_RESPONSE: "AI_INVALID_RESPONSE"
});

const RELATED_LIST_BLOCK_PROPERTY_MAP = Object.freeze({
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

const STEPS = Object.freeze([
  { key: "context", label: "Setup" },
  { key: "header", label: "Header" },
  { key: "body", label: "Body" },
  { key: "footer", label: "Footer & review" }
]);

const CHANGE_LABELS = Object.freeze({
  documentTitle: "document title",
  includeBodyTitle: "body title visibility",
  pagePadding: "page padding",
  elementPadding: "element padding",
  pageBackground: "page color",
  primaryColor: "primary color",
  textColor: "text color",
  fontFamily: "font",
  bodyLayout: "body layout",
  fieldDisplayMode: "field display",
  showHeader: "header visibility",
  repeatHeaderOnEachPage: "repeating header",
  includeHeaderImage: "header image",
  imageUrl: "image URL",
  imageAlt: "image description",
  imageSize: "image size",
  headerImageAlignment: "image alignment",
  headerBackground: "header background",
  headerContentBackground: "header content background",
  headerContentPadding: "header content padding",
  headerContentBorderStyle: "header content border",
  headerContentBorderWidth: "header content border width",
  headerContentBorderColor: "header content border color",
  headerContentBorderRadius: "header content corner radius",
  headerContentSizeMode: "header content sizing",
  headerTextColor: "header text color",
  includeOrganizationName: "organization name",
  headerFields: "header fields",
  headerBlocks: "custom header layout",
  bodyFields: "body fields",
  groupBodyFields: "body field box",
  includeOrganizationBodyBox: "organization information box",
  bodyTextBoxes: "editorial text boxes",
  bodyContentBackground: "body field box background",
  bodyContentPadding: "body field box padding",
  bodyContentBorderStyle: "body field box border",
  bodyContentBorderWidth: "body field box border width",
  bodyContentBorderColor: "body field box border color",
  bodyContentBorderRadius: "body field box corner radius",
  includeBodyDivider: "body divider",
  bodyDividerColor: "body divider color",
  includeRelatedList: "related list visibility",
  relatedListRelationshipName: "related list",
  relatedListChildObjectApiName: "related object",
  relatedListLabel: "related list label",
  relatedListColumns: "related list columns",
  relatedListZebraEnabled: "alternating rows",
  relatedListHeaderRowColor: "related list header color",
  relatedListHeaderTextColor: "related list header text",
  relatedListOddRowColor: "odd row color",
  relatedListEvenRowColor: "even row color",
  relatedListOddTextColor: "odd row text",
  relatedListEvenTextColor: "even row text",
  relatedListFontSize: "related list font size",
  relatedListBorderMode: "grid lines",
  relatedListGridColor: "grid color",
  includeRelatedListTotal: "related list total",
  relatedListTotalLabel: "total label",
  relatedListTotalFieldApiName: "total amount field",
  bodyBlocks: "custom body layout",
  showFooter: "footer visibility",
  repeatFooterOnEachPage: "repeating footer",
  footerText: "footer text",
  footerSecondaryText: "footer secondary text",
  includeFooterOrganizationName: "footer organization name",
  footerAlignment: "footer alignment",
  footerBackground: "footer background",
  footerTextColor: "footer text color",
  footerShowDivider: "footer divider",
  footerDividerColor: "footer divider color",
  footerBlocks: "custom footer layout"
});

const normalizePromptText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const escapeMarkup = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getPlainMarkupText = (value) =>
  String(value || "")
    .replace(/\{!\$Organization\.Name\}/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/\s*\|\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getHexColorNearTerms = (prompt, terms, maximumDistance = 120) => {
  const source = String(prompt || "");
  const normalized = source.toLowerCase();
  const colors = [...source.matchAll(/#[0-9a-f]{6}\b/gi)].map((match) => ({
    value: match[0].toLowerCase(),
    index: match.index
  }));
  let closest = null;
  for (const term of terms) {
    let termIndex = normalized.indexOf(term);
    while (termIndex >= 0) {
      for (const color of colors) {
        const distance = Math.abs(color.index - termIndex);
        if (
          distance <= maximumDistance &&
          (!closest || distance < closest.distance)
        ) {
          closest = { ...color, distance };
        }
      }
      termIndex = normalized.indexOf(term, termIndex + term.length);
    }
  }
  return closest?.value || "";
};

const getBlockFieldApiNames = (content, objectApiName) => {
  const apiNames = [];
  const pattern = /\{!([^}]+)\}/g;
  let match = pattern.exec(String(content || ""));
  while (match) {
    const path = String(match[1] || "").trim();
    const prefix = `${objectApiName}.`;
    if (path.toLowerCase().startsWith(prefix.toLowerCase())) {
      apiNames.push(path.slice(prefix.length));
    }
    match = pattern.exec(String(content || ""));
  }
  return [...new Set(apiNames)];
};

const FONT_OPTIONS = Object.freeze([
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Calibri", value: "Calibri, sans-serif" }
]);

const clone = (value) => JSON.parse(JSON.stringify(value));

const getDefaultBodyTextBoxes = (prompt) => {
  const normalized = String(prompt || "").toLowerCase();
  const isSpanish =
    /[áéíóúñ¿¡]/.test(normalized) ||
    /\b(crea|crear|diseña|diseñar|añade|cuerpo|campos|lista|propuesta|cotización)\b/.test(
      normalized
    );
  if (isSpanish) {
    return [
      {
        title: "Gracias por considerar nuestra propuesta",
        content:
          "Hemos preparado este documento para presentar de forma clara la información principal, el alcance previsto y los próximos pasos. El contenido puede adaptarse a las necesidades específicas de cada oportunidad.",
        layout: "full"
      },
      {
        title: "Resumen del proyecto",
        content:
          "La propuesta reúne los servicios y entregables principales para facilitar una ejecución ordenada, transparente y orientada a resultados.",
        layout: "half"
      },
      {
        title: "Nuestro enfoque",
        content:
          "Trabajamos de forma colaborativa, con comunicación continua y una solución adaptable que aporte valor durante todo el proyecto.",
        layout: "half"
      }
    ];
  }
  return [
    {
      title: "Thank you for considering our proposal",
      content:
        "This document presents the key information, intended scope and next steps in a clear format. The content can be tailored to the specific needs of each opportunity.",
      layout: "full"
    },
    {
      title: "Project scope summary",
      content:
        "The proposal brings together the main services and deliverables to support an organized, transparent and outcome-focused engagement.",
      layout: "half"
    },
    {
      title: "Our approach",
      content:
        "We work collaboratively through clear communication and an adaptable solution designed to provide value throughout the project.",
      layout: "half"
    }
  ];
};

const shouldAddDefaultBodyTextBoxes = (prompt, recipe) => {
  const normalized = String(prompt || "").toLowerCase();
  const excludesEditorialCopy =
    /\b(fields only|data only|no text|without text|solo campos|solo datos|sin texto|sin cajas)\b/.test(
      normalized
    );
  const requestsCompleteBody =
    /\b(create|build|design|professional|proposal|quotation|crea|crear|construye|diseña|diseñar|profesional|propuesta|cotización)\b/.test(
      normalized
    );
  return Boolean(
    !excludesEditorialCopy &&
    requestsCompleteBody &&
    !recipe.bodyTextBoxes?.length
  );
};

export default class PDFBuilderWizard extends LightningElement {
  @api objectOptions = [];
  @api configuration = {};
  @api aiUnavailable = false;
  @api aiUnavailableMessage = "";
  @api darkTheme = false;
  @api initialObjectApiName = "";

  recipe = createDefaultWizardRecipe();
  stepIndex = 0;
  fields = [];
  relatedLists = [];
  relatedListFields = [];
  recordTypeOptions = [{ label: "All record types", value: "ALL" }];
  isLoading = false;
  isApplyingPrompt = false;
  isAIRuntimeAvailable = true;
  aiRuntimeUnavailableMessage = "";
  errorMessage = "";
  promptText = "";
  promptNotice = "";
  fieldSearchTerm = "";
  previewRenderResolve;
  previewRenderTimeoutId;
  objectContextPromise = Promise.resolve();
  loadingOperationCount = 0;
  objectContextRequestId = 0;
  relatedListContextRequestId = 0;

  connectedCallback() {
    this.recipe = {
      ...createDefaultWizardRecipe(this.configuration),
      objectApiName: this.initialObjectApiName || ""
    };
    if (this.recipe.objectApiName) {
      this.objectContextPromise = this.loadObjectContext(
        this.recipe.objectApiName
      );
    }
    this.emitPreview();
  }

  renderedCallback() {
    const promptInput = this.template.querySelector(
      '[data-role="prompt-input"]'
    );
    if (promptInput && promptInput.value !== this.promptText) {
      promptInput.value = this.promptText;
    }

    this.template.querySelectorAll("select[data-field]").forEach((select) => {
      const value = String(this.recipe[select.dataset.field] ?? "");
      if (select.value !== value) {
        select.value = value;
      }
    });
  }

  disconnectedCallback() {
    this.resolvePreviewRendered();
  }

  @api
  notifyPreviewRendered() {
    this.resolvePreviewRendered();
  }

  get wizardClass() {
    return `wizard${this.darkTheme ? " wizard-dark" : ""}`;
  }

  get steps() {
    return STEPS.filter((step) => {
      if (step.key === "header") {
        return this.recipe.showHeader;
      }
      if (step.key === "footer") {
        return this.recipe.showFooter;
      }
      return true;
    });
  }

  get currentStepIndex() {
    return Math.min(this.stepIndex, this.steps.length - 1);
  }

  get currentStep() {
    return this.steps[this.currentStepIndex];
  }

  get title() {
    return this.currentStep.label;
  }

  get stepIndicator() {
    return `Step ${this.currentStepIndex + 1} of ${this.steps.length}`;
  }

  get progressStyle() {
    return `width:${Math.round(((this.currentStepIndex + 1) / this.steps.length) * 100)}%;`;
  }

  get stepItems() {
    return this.steps.map((step, index) => ({
      ...step,
      number: index + 1,
      className:
        index === this.currentStepIndex
          ? "wizard-step-dot current"
          : index < this.currentStepIndex
            ? "wizard-step-dot complete"
            : "wizard-step-dot"
    }));
  }

  get isContextStep() {
    return this.currentStep.key === "context";
  }

  get isHeaderStep() {
    return this.currentStep.key === "header";
  }

  get isBodyStep() {
    return this.currentStep.key === "body";
  }

  get isFooterStep() {
    return this.currentStep.key === "footer";
  }

  get showAIPrompt() {
    return !this.isContextStep;
  }

  get showAIInput() {
    return this.showAIPrompt && this.isAIEnabled;
  }

  get showAIUnavailable() {
    return this.showAIPrompt && !this.isAIEnabled;
  }

  get isAIEnabled() {
    return !this.aiUnavailable && this.isAIRuntimeAvailable;
  }

  get resolvedAIUnavailableMessage() {
    return (
      this.aiRuntimeUnavailableMessage ||
      this.aiUnavailableMessage ||
      this.configuration?.aiUnavailableMessage ||
      DEFAULT_AI_UNAVAILABLE_MESSAGE
    );
  }

  get aiProviderAttribution() {
    return `Powered by ${
      this.configuration?.aiProviderLabel || DEFAULT_AI_PROVIDER_LABEL
    }.`;
  }

  get aiMaxPromptLength() {
    const configuredLength = Number(this.configuration?.aiMaxPromptLength);
    return Number.isInteger(configuredLength) && configuredLength > 0
      ? configuredLength
      : DEFAULT_AI_MAX_PROMPT_LENGTH;
  }

  get isFirstStep() {
    return this.currentStepIndex === 0;
  }

  get isLastStep() {
    return this.currentStepIndex === this.steps.length - 1;
  }

  get fontOptions() {
    return FONT_OPTIONS;
  }

  get pageColorValue() {
    return this.recipe.pageBackground === "transparent"
      ? "#ffffff"
      : this.recipe.pageBackground;
  }

  get headerBackgroundColorValue() {
    return this.getColorValue(this.recipe.headerBackground);
  }

  get headerContentBackgroundColorValue() {
    return this.getColorValue(this.recipe.headerContentBackground);
  }

  get headerContentBorderColorValue() {
    return this.getColorValue(this.recipe.headerContentBorderColor);
  }

  get bodyContentBackgroundColorValue() {
    return this.getColorValue(this.recipe.bodyContentBackground);
  }

  get bodyContentBorderColorValue() {
    return this.getColorValue(this.recipe.bodyContentBorderColor);
  }

  get footerBackgroundColorValue() {
    return this.getColorValue(this.recipe.footerBackground);
  }

  get relatedListOddRowColorValue() {
    return this.getColorValue(this.recipe.relatedListOddRowColor);
  }

  get relatedListEvenRowColorValue() {
    return this.getColorValue(this.recipe.relatedListEvenRowColor);
  }

  get pageHasNoFill() {
    return this.recipe.pageBackground === "transparent";
  }

  get bodyContentHasNoFill() {
    return this.recipe.bodyContentBackground === "transparent";
  }

  get defaultTemplateLabel() {
    return this.recipe.recordTypeScope === "ALL"
      ? "Use as the default template for all record types"
      : "Use as the default template for this record type";
  }

  get promptPlaceholder() {
    switch (this.currentStep.key) {
      case "header":
        return "Blue header with the logo on the right, customer name and date";
      case "body":
        return "Create a professional proposal body with record fields, a product list, an introductory text box and two supporting text boxes";
      case "footer":
        return "Centered footer with “Thank you for your business”";
      default:
        return "Describe what you want";
    }
  }

  get promptButtonDisabled() {
    return !String(this.promptText || "").trim() || this.isBusy;
  }

  get isBusy() {
    return this.isLoading || this.isApplyingPrompt;
  }

  get backButtonDisabled() {
    return this.isFirstStep || this.isBusy;
  }

  get promptButtonLabel() {
    return this.isApplyingPrompt ? "Applying…" : "Apply to this section";
  }

  get promptStatusLabel() {
    return this.isApplyingPrompt ? "Applying…" : "Salesforce AI";
  }

  get loadingMessage() {
    return this.isApplyingPrompt
      ? "Applying the AI design…"
      : "Loading Salesforce metadata…";
  }

  get filteredFieldItems() {
    const search = String(this.fieldSearchTerm || "")
      .trim()
      .toLowerCase();
    const headerSelected = new Set(
      (this.recipe.headerFields || []).map((field) => field.apiName)
    );
    const bodySelected = new Set(
      (this.recipe.bodyFields || []).map((field) => field.apiName)
    );
    return this.fields
      .filter(
        (field) =>
          !search ||
          String(field.label || "")
            .toLowerCase()
            .includes(search) ||
          String(field.apiName || "")
            .toLowerCase()
            .includes(search)
      )
      .map((field) => ({
        ...field,
        headerSelected: headerSelected.has(field.apiName),
        bodySelected: bodySelected.has(field.apiName)
      }));
  }

  get hasFields() {
    return this.filteredFieldItems.length > 0;
  }

  get relatedListItems() {
    return rankRelatedLists(this.relatedLists).map((item) => ({
      ...item,
      selected:
        item.relationshipName === this.recipe.relatedListRelationshipName,
      className:
        item.relationshipName === this.recipe.relatedListRelationshipName
          ? "suggestion-chip selected"
          : "suggestion-chip"
    }));
  }

  get suggestedRelatedListItems() {
    return this.relatedListItems.slice(0, 5);
  }

  get hasRelatedLists() {
    return this.relatedLists.length > 0;
  }

  get relatedListFieldItems() {
    const selected = new Set(this.recipe.relatedListColumns || []);
    return this.relatedListFields.map((field) => ({
      ...field,
      selected: selected.has(field.apiName)
    }));
  }

  get hasRelatedListFields() {
    return this.relatedListFields.length > 0;
  }

  get selectedObjectLabel() {
    return (
      this.objectOptions.find(
        (option) => option.apiName === this.recipe.objectApiName
      )?.label ||
      this.recipe.objectApiName ||
      "Not selected"
    );
  }

  get selectedRelatedListLabel() {
    return this.recipe.includeRelatedList
      ? this.recipe.relatedListLabel || "Related List"
      : "None";
  }

  get selectedBodyFieldCount() {
    return this.recipe.bodyFields?.length || 0;
  }

  get selectedHeaderFieldCount() {
    return this.recipe.headerFields?.length || 0;
  }

  get selectedRelatedListColumnCount() {
    return this.recipe.relatedListColumns?.length || 0;
  }

  get totalFieldOptions() {
    const preferred = this.fields.filter((field) => {
      const apiName = String(field.apiName || "").toLowerCase();
      const label = String(field.label || "").toLowerCase();
      return (
        String(field.dataType || "").toLowerCase() === "currency" ||
        ["amount", "total", "grandtotal"].some(
          (term) => apiName.includes(term) || label.includes(term)
        )
      );
    });
    return preferred.length ? preferred : this.fields;
  }

  get showHeaderSettings() {
    return this.recipe.showHeader;
  }

  get showFooterSettings() {
    return this.recipe.showFooter;
  }

  get showBodyTitleSettings() {
    return this.recipe.includeBodyTitle;
  }

  get showBodyContentBoxSettings() {
    return this.recipe.groupBodyFields;
  }

  get bodyLayoutDisabled() {
    return this.recipe.groupBodyFields;
  }

  get bodyContentBorderDisabled() {
    return this.recipe.bodyContentBorderStyle === "none";
  }

  get headerContentBorderDisabled() {
    return this.recipe.headerContentBorderStyle === "none";
  }

  get showHeaderImageSettings() {
    return this.recipe.showHeader && this.recipe.includeHeaderImage;
  }

  get showRelatedListConfiguration() {
    return (
      this.recipe.includeRelatedList &&
      Boolean(this.recipe.relatedListRelationshipName)
    );
  }

  get showBodyRelatedListConfiguration() {
    return this.isBodyStep && this.showRelatedListConfiguration;
  }

  get showRelatedListTotalSettings() {
    return (
      this.showBodyRelatedListConfiguration &&
      this.recipe.includeRelatedListTotal
    );
  }

  handleCancel() {
    this.dispatchEvent(new CustomEvent("wizardcancel"));
  }

  handleBack() {
    this.errorMessage = "";
    this.stepIndex = Math.max(0, this.currentStepIndex - 1);
    this.resetPromptState();
    this.scrollWizardContentToTop();
  }

  handleNext() {
    this.errorMessage = this.validateStep();
    if (this.errorMessage) {
      this.scrollWizardContentToTop(true);
      return;
    }

    this.stepIndex = Math.min(this.steps.length - 1, this.currentStepIndex + 1);
    if (this.isFooterStep && this.recipe.footerBlocks?.length) {
      this.hydrateFooterControlsFromBlocks({ acceptedKeys: [] });
    }
    this.resetPromptState();
    this.scrollWizardContentToTop();
  }

  handleComplete() {
    this.errorMessage = this.validateStep();
    if (this.errorMessage) {
      this.scrollWizardContentToTop(true);
      return;
    }
    this.dispatchEvent(
      new CustomEvent("wizardcomplete", { detail: this.getRecipeSnapshot() })
    );
  }

  handleInput(event) {
    const fieldName = event.target.dataset.field;
    if (!fieldName) {
      return;
    }
    const value =
      event.target.type === "number"
        ? Number(event.target.value)
        : event.target.value;
    this.updateRecipe({ [fieldName]: value });
  }

  handleColorInput(event) {
    const fieldName = event.target.dataset.field;
    if (fieldName) {
      this.updateRecipe({ [fieldName]: event.target.value });
    }
  }

  handleCheckbox(event) {
    const fieldName = event.target.dataset.field;
    if (!fieldName) {
      return;
    }
    this.updateRecipe({ [fieldName]: Boolean(event.target.checked) });
  }

  handlePageNoFill(event) {
    this.updateRecipe({
      pageBackground: event.target.checked ? "transparent" : "#ffffff"
    });
  }

  handleBodyContentNoFill(event) {
    this.updateRecipe({
      bodyContentBackground: event.target.checked ? "transparent" : "#ffffff"
    });
  }

  handleBodyGroupingChange(event) {
    const groupBodyFields = Boolean(event.target.checked);
    this.updateRecipe({
      groupBodyFields,
      includeOrganizationBodyBox: false,
      bodyLayout: "one"
    });
  }

  handleOrganizationBodyBoxChange(event) {
    const includeOrganizationBodyBox = Boolean(event.target.checked);
    this.updateRecipe({
      includeOrganizationBodyBox,
      bodyLayout: "one"
    });
  }

  handleBodyContentBorderStyle(event) {
    const borderStyle = event.target.value;
    this.updateRecipe({
      bodyContentBorderStyle: borderStyle,
      bodyContentBorderWidth:
        borderStyle === "none"
          ? 0
          : Math.max(1, Number(this.recipe.bodyContentBorderWidth) || 0)
    });
  }

  handleHeaderContentBorderStyle(event) {
    const borderStyle = event.target.value;
    this.updateRecipe({
      headerContentBorderStyle: borderStyle,
      headerContentBorderWidth:
        borderStyle === "none"
          ? 0
          : Math.max(1, Number(this.recipe.headerContentBorderWidth) || 0)
    });
  }

  handlePromptInput(event) {
    this.promptText = event.target.value;
    this.promptNotice = "";
  }

  handleFieldSearch(event) {
    this.fieldSearchTerm = event.target.value;
  }

  async handleObjectChange(event) {
    const objectApiName = event.target.value;
    this.recipe = {
      ...this.recipe,
      objectApiName,
      recordTypeScope: "ALL",
      headerFields: [],
      bodyFields: [],
      includeRelatedList: false,
      relatedListRelationshipName: "",
      relatedListChildObjectApiName: "",
      relatedListLabel: "",
      relatedListColumns: [],
      headerBlocks: [],
      bodyBlocks: [],
      footerBlocks: []
    };
    this.emitPreview();
    this.objectContextPromise = this.loadObjectContext(objectApiName);
    await this.objectContextPromise;
  }

  handleHeaderFieldToggle(event) {
    this.updateFieldSelection(
      "headerFields",
      event.target.dataset.value,
      event.target.checked
    );
  }

  handleBodyFieldToggle(event) {
    this.updateFieldSelection(
      "bodyFields",
      event.target.dataset.value,
      event.target.checked
    );
  }

  async handleRelatedListToggle(event) {
    const enabled = Boolean(event.target.checked);
    if (!enabled) {
      this.relatedListContextRequestId += 1;
      this.relatedListFields = [];
      this.updateRecipe({
        includeRelatedList: false,
        relatedListRelationshipName: "",
        relatedListChildObjectApiName: "",
        relatedListLabel: "",
        relatedListColumns: []
      });
      return;
    }

    const selected = this.relatedListItems[0];
    this.updateRecipe({ includeRelatedList: true });
    if (selected && !this.recipe.relatedListRelationshipName) {
      await this.selectRelatedList(selected);
    }
  }

  async handleRelatedListSelect(event) {
    const selected = this.relatedLists.find(
      (item) => item.relationshipName === event.target.value
    );
    if (selected) {
      await this.selectRelatedList(selected);
    }
  }

  async handleRelatedListSuggestion(event) {
    const selected = this.relatedLists.find(
      (item) => item.relationshipName === event.currentTarget.dataset.value
    );
    if (selected) {
      await this.selectRelatedList(selected);
    }
  }

  handleRelatedListFieldToggle(event) {
    const value = event.target.dataset.value;
    const selected = new Set(this.recipe.relatedListColumns || []);
    if (event.target.checked) {
      selected.add(value);
    } else {
      selected.delete(value);
    }
    this.updateRecipe({ relatedListColumns: [...selected] });
  }

  applyGeneratedProposal(generatedJson) {
    return applyAIWizardProposal({
      recipe: this.recipe,
      step: this.currentStep.key,
      generatedJson,
      objects: this.objectOptions,
      fields: this.fields,
      relatedLists: this.relatedLists,
      relatedListFields: this.relatedListFields,
      recordTypes: this.recordTypeOptions
    });
  }

  isMalformedAIResponse(error) {
    const aiError = this.getAIError(error);
    if (aiError.code === AI_ERROR_CODES.INVALID_RESPONSE) {
      return true;
    }
    return /json|unexpected token|expected .*position|unterminated/i.test(
      aiError.message
    );
  }

  async requestAIProposal(userPrompt) {
    const request = async (prompt) => {
      const response = await generateWizardProposal({
        step: this.currentStep.key,
        userPrompt: prompt,
        recipeJson: JSON.stringify(this.recipe)
      });
      return this.applyGeneratedProposal(response.generatedJson);
    };

    const requestWithCorrection = async (attempt) => {
      const retryPrefix = [
        `JSON correction attempt ${attempt} of ${MAX_AI_PROPOSAL_ATTEMPTS - 1}.`,
        "Return exactly one compact, strictly valid JSON object.",
        "Escape every double quote inside JSON string values. Do not use Markdown fences or prose.",
        "Use simple HTML tags without attributes and put visual styling in block styles.",
        "Do not omit any compatible instruction from the original request.",
        "Original request:"
      ].join("\n");
      const availableLength = Math.max(
        0,
        this.aiMaxPromptLength - retryPrefix.length - 1
      );
      const prompt =
        attempt === 0
          ? userPrompt
          : `${retryPrefix}\n${userPrompt.slice(0, availableLength)}`;
      try {
        return await request(prompt);
      } catch (error) {
        if (
          !this.isMalformedAIResponse(error) ||
          attempt >= MAX_AI_PROPOSAL_ATTEMPTS - 1
        ) {
          throw error;
        }
        return requestWithCorrection(attempt + 1);
      }
    };
    return requestWithCorrection(0);
  }

  async handleApplyPrompt() {
    const prompt = String(this.promptText || "").trim();
    if (!prompt) {
      return;
    }

    const previousRelationship = this.recipe.relatedListRelationshipName;
    const previousObjectApiName = this.recipe.objectApiName;
    this.beginLoading();
    this.isApplyingPrompt = true;
    this.errorMessage = "";
    this.promptNotice = "";
    let usedSuggestedColumns = false;
    let missingBodyBoxContent = false;
    try {
      await this.objectContextPromise;
      const recipeBeforeAI = clone(this.recipe);
      let result = await this.requestAIProposal(prompt);

      // A valid empty patch can be an intentional safety refusal. Never send a
      // second semantic generation that pressures the model to override it.
      // The deterministic fallback is safe only when the model did not report
      // that any part of the instruction was refused or unsupported.
      if (!result.acceptedKeys.length && !result.unapplied?.length) {
        const fallback = applyGuidedWizardPrompt({
          recipe: this.recipe,
          step: this.currentStep.key,
          prompt,
          objects: this.objectOptions,
          fields: this.fields,
          relatedLists: this.relatedLists,
          relatedListFields: this.relatedListFields
        });
        const fallbackKeys = Object.keys(fallback.recipe).filter(
          (key) =>
            JSON.stringify(this.recipe[key]) !==
            JSON.stringify(fallback.recipe[key])
        );
        if (fallbackKeys.length) {
          result = {
            ...result,
            recipe: fallback.recipe,
            acceptedKeys: fallbackKeys,
            changes: fallbackKeys
          };
        }
      }
      this.recipe = result.recipe;

      if (this.isHeaderStep) {
        this.hydrateHeaderControlsFromBlocks(result);
        this.ensureRequestedHeaderContent(prompt, result);
        this.hydrateHeaderControlsFromBlocks(result);
      }
      if (this.isFooterStep) {
        this.hydrateFooterControlsFromBlocks(result);
      }

      const normalizedPrompt = normalizePromptText(prompt);
      const promptRequestsRelatedList =
        this.isBodyStep &&
        /\b(?:related list|related products|opportunity products|lista relacionada|productos relacionados|productos de la oportunidad)\b/.test(
          normalizedPrompt
        );
      if (promptRequestsRelatedList && !this.recipe.includeRelatedList) {
        const selected = rankRelatedLists(
          findPromptMatches(this.relatedLists, prompt)
        )[0];
        if (selected) {
          this.recipe = {
            ...this.recipe,
            includeRelatedList: true,
            relatedListRelationshipName: selected.relationshipName,
            relatedListChildObjectApiName: selected.childObjectApiName,
            relatedListLabel: selected.label,
            relatedListColumns: []
          };
          ["includeRelatedList", "relatedListRelationshipName"].forEach(
            (key) => {
              if (!result.acceptedKeys.includes(key)) {
                result.acceptedKeys.push(key);
              }
              if (!result.changes.includes(key)) {
                result.changes.push(key);
              }
            }
          );
        }
      }

      if (
        this.isBodyStep &&
        this.recipe.includeRelatedList &&
        !this.recipe.relatedListRelationshipName
      ) {
        const selected = rankRelatedLists(
          findPromptMatches(this.relatedLists, prompt)
        )[0];
        if (selected) {
          this.recipe = {
            ...this.recipe,
            relatedListRelationshipName: selected.relationshipName,
            relatedListChildObjectApiName: selected.childObjectApiName,
            relatedListLabel: selected.label,
            relatedListColumns: []
          };
          result = {
            ...result,
            acceptedKeys: [
              ...new Set([
                ...result.acceptedKeys,
                "includeRelatedList",
                "relatedListRelationshipName"
              ])
            ],
            changes: [
              ...new Set([
                ...result.changes,
                "includeRelatedList",
                "relatedListRelationshipName"
              ])
            ]
          };
        }
      }

      if (
        this.isBodyStep &&
        shouldAddDefaultBodyTextBoxes(prompt, this.recipe)
      ) {
        this.recipe = {
          ...this.recipe,
          bodyLayout: "one",
          bodyTextBoxes: getDefaultBodyTextBoxes(prompt)
        };
        result = {
          ...result,
          acceptedKeys: [
            ...new Set([...result.acceptedKeys, "bodyTextBoxes", "bodyLayout"])
          ],
          changes: [
            ...new Set([...result.changes, "bodyTextBoxes", "bodyLayout"])
          ]
        };
      }

      if (this.isBodyStep) {
        this.ensureRequestedBodyContent(prompt, result);
      }

      if (this.isBodyStep) {
        const wantsDivider = [
          "horizontal line",
          "separator line",
          "divider",
          "linea horizontal",
          "linea separadora"
        ].some((term) => normalizedPrompt.includes(term));
        const wantsTotal = [
          "total amount",
          "grand total",
          "related list total",
          "sum of",
          "importe total",
          "suma de"
        ].some((term) => normalizedPrompt.includes(term));
        const totalField = this.fields.find((field) =>
          ["amount", "grandtotal", "totalamount"].includes(
            String(field.apiName || "")
              .replace(/[^a-z0-9]/gi, "")
              .toLowerCase()
          )
        );
        const additionalChanges = [];
        if (wantsDivider && !this.recipe.includeBodyDivider) {
          this.recipe = { ...this.recipe, includeBodyDivider: true };
          additionalChanges.push("includeBodyDivider");
        }
        if (
          wantsTotal &&
          this.recipe.includeRelatedList &&
          totalField &&
          (!this.recipe.includeRelatedListTotal ||
            !this.recipe.relatedListTotalFieldApiName)
        ) {
          this.recipe = {
            ...this.recipe,
            includeRelatedListTotal: true,
            relatedListTotalLabel: this.recipe.relatedListTotalLabel || "Total",
            relatedListTotalFieldApiName: totalField.apiName
          };
          additionalChanges.push(
            "includeRelatedListTotal",
            "relatedListTotalFieldApiName"
          );
        }
        if (additionalChanges.length) {
          result = {
            ...result,
            acceptedKeys: [
              ...new Set([...result.acceptedKeys, ...additionalChanges])
            ],
            changes: [...new Set([...result.changes, ...additionalChanges])]
          };
        }
      }

      if (
        this.isBodyStep &&
        this.recipe.groupBodyFields &&
        !this.recipe.bodyFields.length
      ) {
        missingBodyBoxContent = true;
        this.recipe = {
          ...this.recipe,
          groupBodyFields: false,
          includeOrganizationBodyBox: false,
          bodyLayout: recipeBeforeAI.bodyLayout
        };
      }

      if (this.recipe.objectApiName !== previousObjectApiName) {
        this.recipe = {
          ...this.recipe,
          recordTypeScope: "ALL",
          headerFields: [],
          bodyFields: [],
          includeRelatedList: false,
          relatedListRelationshipName: "",
          relatedListChildObjectApiName: "",
          relatedListLabel: "",
          relatedListColumns: [],
          headerBlocks: [],
          bodyBlocks: [],
          footerBlocks: []
        };
        await this.loadObjectContext(this.recipe.objectApiName);
      }

      if (
        this.recipe.relatedListRelationshipName &&
        (this.recipe.relatedListRelationshipName !== previousRelationship ||
          !this.recipe.relatedListColumns.length ||
          !this.relatedListFields.length)
      ) {
        const selected = this.relatedLists.find(
          (item) =>
            item.relationshipName === this.recipe.relatedListRelationshipName
        );
        if (selected) {
          await this.loadRelatedListContext(selected.childObjectApiName);
          if (this.recipe.relatedListColumns.length) {
            this.syncAIBlockRelatedListColumns(this.recipe.relatedListColumns);
          }
          const explicitlyRequestedColumns = findExactPromptFieldMatches(
            this.relatedListFields,
            prompt
          );
          if (explicitlyRequestedColumns.length) {
            const requestedApiNames = explicitlyRequestedColumns.map(
              (field) => field.apiName
            );
            this.recipe = {
              ...this.recipe,
              relatedListColumns: requestedApiNames
            };
            this.syncAIBlockRelatedListColumns(requestedApiNames);
            if (!result.changes.includes("relatedListColumns")) {
              result.changes.push("relatedListColumns");
            }
            if (!result.acceptedKeys.includes("relatedListColumns")) {
              result.acceptedKeys.push("relatedListColumns");
            }
          } else if (!this.recipe.relatedListColumns.length) {
            const suggestedApiNames = this.getPreferredRelatedListColumns().map(
              (field) => field.apiName
            );
            this.recipe = {
              ...this.recipe,
              relatedListColumns: suggestedApiNames
            };
            this.syncAIBlockRelatedListColumns(suggestedApiNames);
            if (!result.changes.includes("relatedListColumns")) {
              result.changes.push("relatedListColumns");
            }
            if (!result.acceptedKeys.includes("relatedListColumns")) {
              result.acceptedKeys.push("relatedListColumns");
            }
            usedSuggestedColumns = true;
          }
        }
      }

      // Enforce the Related List as a postcondition of this same Apply action.
      // The model may choose the relationship before its child-field metadata
      // is available; never require a second click to finish that work.
      if (this.isBodyStep && this.recipe.includeRelatedList) {
        const selected =
          this.relatedLists.find(
            (item) =>
              item.relationshipName === this.recipe.relatedListRelationshipName
          ) ||
          rankRelatedLists(findPromptMatches(this.relatedLists, prompt))[0];
        if (selected) {
          if (
            this.recipe.relatedListRelationshipName !==
              selected.relationshipName ||
            this.recipe.relatedListChildObjectApiName !==
              selected.childObjectApiName
          ) {
            this.recipe = {
              ...this.recipe,
              relatedListRelationshipName: selected.relationshipName,
              relatedListChildObjectApiName: selected.childObjectApiName,
              relatedListLabel: selected.label
            };
          }
          if (!this.relatedListFields.length) {
            await this.loadRelatedListContext(selected.childObjectApiName);
          }
          const availableColumns = new Set(
            this.relatedListFields.map((field) => field.apiName)
          );
          const requestedColumns = findExactPromptFieldMatches(
            this.relatedListFields,
            prompt
          ).map((field) => field.apiName);
          const existingColumns = (this.recipe.relatedListColumns || []).filter(
            (apiName) => availableColumns.has(apiName)
          );
          const relatedListColumns = requestedColumns.length
            ? requestedColumns
            : existingColumns.length
              ? existingColumns
              : this.getPreferredRelatedListColumns().map(
                  (field) => field.apiName
                );
          this.recipe = {
            ...this.recipe,
            includeRelatedList: true,
            relatedListColumns,
            relatedListColumnDefinitions: this.relatedListFields
              .filter((field) => relatedListColumns.includes(field.apiName))
              .map((field) => ({
                apiName: field.apiName,
                label: field.label,
                ...(field.dataType ? { dataType: field.dataType } : {})
              }))
          };
          this.syncAIBlockRelatedListColumns(relatedListColumns);
          [
            "includeRelatedList",
            "relatedListRelationshipName",
            "relatedListColumns"
          ].forEach((key) => {
            if (!result.acceptedKeys.includes(key)) {
              result.acceptedKeys.push(key);
            }
            if (!result.changes.includes(key)) {
              result.changes.push(key);
            }
          });
        }
      }

      // Relationship and child-field metadata can arrive after the AI patch
      // has been normalized. Run the structural postconditions once more over
      // the final recipe so one click produces the same result as a retry.
      if (this.isBodyStep) {
        this.ensureRequestedBodyContent(prompt, result);
        this.enforceRequestedBodyPalette(prompt, result);
        // Custom AI blocks are the rendered source of truth. Hydrate the
        // standard controls before enforcing visibility switches so an AI
        // divider or total is not removed merely because its old control
        // value was false.
        this.hydrateBodyControlsFromBlocks(result);
        if (this.recipe.includeRelatedList) {
          this.syncAIBlockRelatedListColumns(this.recipe.relatedListColumns);
          this.syncAIBlockRelatedListSettings(
            Object.fromEntries(
              Object.keys(RELATED_LIST_BLOCK_PROPERTY_MAP).map((key) => [
                key,
                this.recipe[key]
              ])
            )
          );
        }
        this.syncAIBlockBodyRequestedElements(result);
        this.hydrateBodyControlsFromBlocks(result);
      }

      const unmatchedNotice = result.unmatchedFields?.length
        ? ` Could not match: ${result.unmatchedFields.slice(0, 4).join(", ")}.`
        : "";
      const fallbackNotice = usedSuggestedColumns
        ? " Suggested columns were used because no requested columns could be matched."
        : "";
      const unappliedNotice = result.unapplied?.length
        ? ` Could not apply: ${result.unapplied.slice(0, 3).join("; ")}.`
        : "";
      if (missingBodyBoxContent) {
        this.promptNotice =
          "No box was created because there are no compatible record fields available. Select fields under Content or name the fields you want.";
      } else if (result.changes.length) {
        this.promptNotice = `Applied ${result.changes.length} change${result.changes.length === 1 ? "" : "s"}: ${this.formatAppliedChanges(result.changes)}.${unmatchedNotice}${fallbackNotice}${unappliedNotice}`;
      } else if (result.unmatchedFields?.length) {
        this.promptNotice = `No changes were applied because these fields could not be found: ${result.unmatchedFields.slice(0, 4).join(", ")}. Use the field labels shown below.`;
      } else if (result.unapplied?.length) {
        this.promptNotice = `These instructions could not be applied with the available controls: ${result.unapplied.slice(0, 3).join("; ")}.`;
      } else if (result.acceptedKeys.length) {
        this.promptNotice = `This section already matches the request. No changes were needed: ${this.formatAppliedChanges(result.acceptedKeys)}.`;
      } else {
        this.promptNotice = this.getUnsupportedPromptMessage();
      }
      await this.emitPreview(true);
    } catch (error) {
      const aiError = this.getAIError(error);
      const message = aiError.message;
      if (this.isMalformedAIResponse(error)) {
        this.errorMessage = AI_INVALID_RESPONSE_MESSAGE;
      } else if (
        aiError.code === AI_ERROR_CODES.UNAVAILABLE ||
        AI_UNAVAILABLE_ERROR_PATTERN.test(message)
      ) {
        this.isAIRuntimeAvailable = false;
        this.aiRuntimeUnavailableMessage = message
          .replace(AI_UNAVAILABLE_PREFIX_PATTERN, "")
          .trim();
        this.errorMessage = "";
        this.dispatchEvent(
          new CustomEvent("aiunavailable", {
            detail: { message: this.resolvedAIUnavailableMessage },
            bubbles: true,
            composed: true
          })
        );
      } else {
        this.errorMessage = message;
      }
    } finally {
      this.isApplyingPrompt = false;
      this.endLoading();
    }
  }

  formatAppliedChanges(changes) {
    const labels = [...new Set(changes)]
      .map((key) => CHANGE_LABELS[key])
      .filter(Boolean);
    const visible = labels.slice(0, 5);
    const remaining = labels.length - visible.length;
    return `${visible.join(", ")}${remaining > 0 ? ` and ${remaining} more` : ""}`;
  }

  ensureRequestedHeaderContent(prompt, result) {
    if (!this.recipe.headerBlocks?.length) {
      return;
    }
    const normalizedPrompt = normalizePromptText(prompt);
    const requestsOneBox =
      /\b(?:one|single|1|un|una)\s+(?:single\s+)?(?:box|container|card|caja|contenedor|tarjeta)\b/.test(
        normalizedPrompt
      ) ||
      /\b(?:inside|within|in|dentro de|en)\s+(?:the\s+)?(?:same|one|single|la misma|una)\s+(?:box|container|caja|contenedor)\b/.test(
        normalizedPrompt
      );
    if (!requestsOneBox) {
      return;
    }
    const textEntries = this.recipe.headerBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => ["text", "field"].includes(block.type));
    if (textEntries.length < 2) {
      return;
    }
    const first = textEntries[0].block;
    const last = textEntries.at(-1).block;
    const merged = {
      ...first,
      type: "text",
      wizardRole: "headerContentBox",
      content: `<div style="display:flex;justify-content:space-between;align-items:center;width:100%;"><div>${first.content || ""}</div><div style="text-align:right;">${textEntries
        .slice(1)
        .map(({ block }) => block.content || "")
        .join("&nbsp;&nbsp;")}</div></div>`,
      widthPercent: 100,
      xPercent: 0,
      horizontalAlign: "left",
      gapAfter: Math.max(
        0,
        ...textEntries.map(({ block }) => Number(block.gapAfter) || 0)
      ),
      styles: {
        ...(first.styles || {}),
        background:
          first.styles?.background ||
          last.styles?.background ||
          this.recipe.headerContentBackground,
        color: this.recipe.headerTextColor,
        padding: Math.max(
          Number(first.styles?.padding) || 0,
          Number(this.recipe.headerContentPadding) || 0
        )
      }
    };
    const textIndexes = new Set(textEntries.map(({ index }) => index));
    const headerBlocks = this.recipe.headerBlocks.filter(
      (_block, index) => !textIndexes.has(index)
    );
    headerBlocks.splice(textEntries[0].index, 0, merged);
    this.recipe = { ...this.recipe, headerBlocks };
    if (!result.acceptedKeys.includes("headerBlocks")) {
      result.acceptedKeys.push("headerBlocks");
    }
    if (!result.changes.includes("headerBlocks")) {
      result.changes.push("headerBlocks");
    }
  }

  hydrateHeaderControlsFromBlocks(result = {}) {
    if (!this.recipe.headerBlocks?.length) {
      return;
    }
    const textBlocks = this.recipe.headerBlocks.filter((block) =>
      ["text", "field"].includes(block.type)
    );
    const contentBlock =
      textBlocks.find((block) => block.wizardRole === "headerContentBox") ||
      textBlocks.find((block) => Number(block.widthPercent) === 100) ||
      textBlocks[0];
    const imageBlock = this.recipe.headerBlocks.find(
      (block) => block.type === "image"
    );
    const styles = contentBlock?.styles || {};
    const accepted = new Set(result.acceptedKeys || []);
    const changes = {
      showHeader: true,
      includeOrganizationName: textBlocks.some((block) =>
        /\{!\$Organization\.Name\}/i.test(String(block.content || ""))
      ),
      includeHeaderImage: Boolean(imageBlock)
    };
    const styleMap = {
      background: "headerContentBackground",
      color: "headerTextColor",
      padding: "headerContentPadding",
      borderStyle: "headerContentBorderStyle",
      borderWidth: "headerContentBorderWidth",
      borderColor: "headerContentBorderColor",
      borderRadius: "headerContentBorderRadius"
    };
    Object.entries(styleMap).forEach(([styleKey, recipeKey]) => {
      if (styles[styleKey] !== undefined && styles[styleKey] !== null) {
        changes[recipeKey] = styles[styleKey];
      }
    });
    if (contentBlock) {
      changes.headerContentSizeMode =
        Number(contentBlock.widthPercent) === 100 ? "fullWidth" : "content";
      if (
        Number(contentBlock.widthPercent) === 100 &&
        styles.background &&
        styles.background !== "transparent" &&
        !accepted.has("headerBackground")
      ) {
        // A full-width colored AI header is intended to fill the complete
        // header region, including the region padding around its content box.
        changes.headerBackground = styles.background;
      }
    }
    const selectedApiNames = new Set(
      textBlocks.flatMap((block) =>
        getBlockFieldApiNames(block.content, this.recipe.objectApiName)
      )
    );
    changes.headerFields = this.fields.filter((field) =>
      selectedApiNames.has(field.apiName)
    );
    if (imageBlock) {
      changes.imageUrl = imageBlock.imageSrc || "";
      changes.imageAlt = imageBlock.imageAlt || "";
      changes.headerImageAlignment =
        imageBlock.horizontalAlign || styles.textAlign || "left";
      changes.imageSize =
        Number(imageBlock.widthPercent) >= 30 ? "large" : "medium";
    }
    this.recipe = { ...this.recipe, ...changes };
    const acceptedKeys = result.acceptedKeys || [];
    Object.keys(changes).forEach((key) => {
      if (!acceptedKeys.includes(key)) {
        acceptedKeys.push(key);
      }
    });
  }

  hydrateBodyControlsFromBlocks(result = {}) {
    if (!this.recipe.bodyBlocks?.length) {
      return;
    }
    const blocks = this.recipe.bodyBlocks;
    const titleBlock = blocks.find((block) => block.wizardRole === "bodyTitle");
    const recordCards = blocks.filter(
      (block) =>
        block.wizardRole === "recordFieldCard" ||
        (["text", "field"].includes(block.type) &&
          getBlockFieldApiNames(block.content, this.recipe.objectApiName)
            .length &&
          block.wizardRole !== "relatedListTotal")
    );
    const representative = recordCards[0];
    const styles = representative?.styles || {};
    const selectedApiNames = new Set(
      recordCards.flatMap((block) =>
        getBlockFieldApiNames(block.content, this.recipe.objectApiName)
      )
    );
    const divider = blocks.find((block) => block.type === "divider");
    const totalBlock = blocks.find(
      (block) =>
        block.wizardRole === "relatedListTotal" ||
        /\b(total|subtotal|grand total|importe total)\b/i.test(
          String(block.content || "")
        )
    );
    const accepted = new Set(result.acceptedKeys || []);
    const changes = {};
    if (recordCards.length || !accepted.has("bodyFields")) {
      changes.bodyFields = this.fields.filter((field) =>
        selectedApiNames.has(field.apiName)
      );
      changes.groupBodyFields = recordCards.length > 0;
      // Multiple cards positioned side by side are still children of one
      // full-width Body section. Only an explicit section: 2 block represents
      // the builder's outer two-column Body layout.
      changes.bodyLayout = blocks.some(
        (block) => Math.max(1, Number(block.section) || 1) > 1
      )
        ? "two"
        : "one";
      changes.fieldDisplayMode = recordCards.some((block) =>
        /<strong\b/i.test(String(block.content || ""))
      )
        ? "labelAndValue"
        : "value";
    }
    // A structural block proves that the feature is enabled. Its absence does
    // not override an explicit AI/control value: the deterministic sync below
    // may still need to create that block during this same Apply action.
    if (divider || !accepted.has("includeBodyDivider")) {
      changes.includeBodyDivider = Boolean(divider);
    }
    if (totalBlock || !accepted.has("includeRelatedListTotal")) {
      changes.includeRelatedListTotal = Boolean(totalBlock);
    }
    if (titleBlock) {
      changes.includeBodyTitle = true;
      changes.documentTitle = getPlainMarkupText(titleBlock.content);
      if (titleBlock.styles?.color) {
        changes.primaryColor = titleBlock.styles.color;
      }
    }
    const styleMap = {
      background: "bodyContentBackground",
      color: "textColor",
      padding: "bodyContentPadding",
      borderStyle: "bodyContentBorderStyle",
      borderWidth: "bodyContentBorderWidth",
      borderColor: "bodyContentBorderColor",
      borderRadius: "bodyContentBorderRadius"
    };
    Object.entries(styleMap).forEach(([styleKey, recipeKey]) => {
      if (styles[styleKey] !== undefined && styles[styleKey] !== null) {
        changes[recipeKey] = styles[styleKey];
      }
    });
    if (divider?.styles?.lineColor) {
      changes.bodyDividerColor = divider.styles.lineColor;
    }
    if (totalBlock) {
      const totalFields = getBlockFieldApiNames(
        totalBlock.content,
        this.recipe.objectApiName
      );
      if (totalFields[0]) {
        changes.relatedListTotalFieldApiName = totalFields[0];
      }
      const label = getPlainMarkupText(totalBlock.content).split(":")[0];
      if (label) {
        changes.relatedListTotalLabel = label;
      }
    }
    this.recipe = { ...this.recipe, ...changes };
    const acceptedKeys = result.acceptedKeys || [];
    Object.keys(changes).forEach((key) => {
      if (!acceptedKeys.includes(key)) {
        acceptedKeys.push(key);
      }
    });
  }

  enforceRequestedBodyPalette(prompt, result = {}) {
    if (!this.recipe.bodyBlocks?.length) {
      return;
    }
    const normalizedPrompt = normalizePromptText(prompt);
    const requestsSharedColor =
      /\b(?:same|matching|consistent|shared)\s+(?:header\s+)?colou?r\b/.test(
        normalizedPrompt
      ) || /\b(?:mismo|misma)\s+(?:color|paleta)\b/.test(normalizedPrompt);
    const requestedHeaderColor = getHexColorNearTerms(prompt, [
      "related list header",
      "table header",
      "header row",
      "cabecera de la lista",
      "cabecera de la tabla",
      "fila de cabecera"
    ]);
    const existingHeaderColor = [
      this.recipe.headerContentBackground,
      this.recipe.headerBackground
    ].find(
      (color) =>
        /^#[0-9a-f]{6}$/i.test(String(color || "")) &&
        String(color).toLowerCase() !== "#ffffff"
    );
    const accentColor =
      requestedHeaderColor || (requestsSharedColor ? existingHeaderColor : "");
    if (!accentColor) {
      return;
    }
    this.recipe = {
      ...this.recipe,
      primaryColor: accentColor,
      relatedListHeaderRowColor: accentColor,
      bodyBlocks: this.recipe.bodyBlocks.map((block) => {
        if (block.wizardRole !== "bodyTitle") {
          return block;
        }
        return {
          ...block,
          styles: { ...(block.styles || {}), color: accentColor }
        };
      })
    };
    this.syncAIBlockRelatedListSettings({
      relatedListHeaderRowColor: accentColor
    });
    ["primaryColor", "relatedListHeaderRowColor"].forEach((key) => {
      if (!result.acceptedKeys.includes(key)) {
        result.acceptedKeys.push(key);
      }
      if (!result.changes.includes(key)) {
        result.changes.push(key);
      }
    });
  }

  hydrateFooterControlsFromBlocks(result) {
    if (!this.recipe.footerBlocks?.length) {
      return;
    }
    const accepted = new Set(result.acceptedKeys || []);
    const textBlocks = this.recipe.footerBlocks.filter((block) =>
      ["text", "field"].includes(block.type)
    );
    const divider = this.recipe.footerBlocks.find(
      (block) => block.type === "divider"
    );
    const changes = {};
    const allContent = textBlocks
      .map((block) => String(block.content || ""))
      .join(" ");
    if (!accepted.has("footerText") && textBlocks[0]) {
      changes.footerText = getPlainMarkupText(textBlocks[0].content);
    }
    if (!accepted.has("footerSecondaryText") && textBlocks[1]) {
      changes.footerSecondaryText = getPlainMarkupText(textBlocks[1].content);
    }
    if (!accepted.has("includeFooterOrganizationName")) {
      changes.includeFooterOrganizationName = /\{!\$Organization\.Name\}/i.test(
        allContent
      );
    }
    if (!accepted.has("footerShowDivider")) {
      changes.footerShowDivider = Boolean(divider);
    }
    if (!accepted.has("footerAlignment") && textBlocks[0]?.styles?.textAlign) {
      changes.footerAlignment = textBlocks[0].styles.textAlign;
    }
    if (!accepted.has("footerTextColor") && textBlocks[0]?.styles?.color) {
      changes.footerTextColor = textBlocks[0].styles.color;
    }
    if (
      !accepted.has("footerBackground") &&
      textBlocks[0]?.styles?.background
    ) {
      changes.footerBackground = textBlocks[0].styles.background;
    }
    if (!accepted.has("footerDividerColor") && divider?.styles?.lineColor) {
      changes.footerDividerColor = divider.styles.lineColor;
    }
    this.recipe = { ...this.recipe, ...changes };
    this.syncAIBlockFooterControls(changes);
  }

  ensureRequestedBodyContent(prompt, result) {
    const sourcePrompt = String(prompt || "");
    const requestedTitle = sourcePrompt.match(
      /\b(?:title|t[ií]tulo)\s*(?:called|titled|:)?\s*[“"]([^”"]+)[”"]/i
    )?.[1];
    if (requestedTitle) {
      this.recipe = {
        ...this.recipe,
        includeBodyTitle: true,
        documentTitle: requestedTitle.trim()
      };
      this.syncAIBlockBodyStructure({
        includeBodyTitle: true,
        documentTitle: requestedTitle.trim()
      });
      ["includeBodyTitle", "documentTitle"].forEach((key) => {
        if (!result.acceptedKeys.includes(key)) {
          result.acceptedKeys.push(key);
        }
        if (!result.changes.includes(key)) {
          result.changes.push(key);
        }
      });
    }

    if (!this.recipe.bodyBlocks?.length) {
      return;
    }

    const fieldsByName = new Map();
    this.fields.forEach((field) => {
      [field.apiName, field.label].forEach((value) => {
        const normalized = normalizePromptText(value).replace(/[^a-z0-9]/g, "");
        if (normalized && !fieldsByName.has(normalized)) {
          fieldsByName.set(normalized, field);
        }
      });
    });
    const normalizeMergeTokens = (content) =>
      String(content || "")
        .replace(
          /\{\{\s*field\s*[:.]\s*([^}]+)\s*\}\}/gi,
          (token, requestedName) => {
            const normalized = normalizePromptText(requestedName).replace(
              /[^a-z0-9]/g,
              ""
            );
            const field = fieldsByName.get(normalized);
            return field
              ? `{!${this.recipe.objectApiName}.${field.apiName}}`
              : token;
          }
        )
        .replace(
          /\{\{\s*organization\s*[:.]\s*name\s*\}\}/gi,
          "{!$Organization.Name}"
        );
    this.recipe = {
      ...this.recipe,
      bodyBlocks: this.recipe.bodyBlocks.map((block) => ({
        ...block,
        ...(block.content
          ? { content: normalizeMergeTokens(block.content) }
          : {})
      }))
    };
    const relatedListMarker = normalizePromptText(sourcePrompt).search(
      /\b(?:related list|lista relacionada|productos relacionados)\b/
    );
    const parentFieldPrompt =
      relatedListMarker >= 0
        ? sourcePrompt.slice(0, relatedListMarker)
        : sourcePrompt;
    const matchedFields = findExactPromptFieldMatches(
      this.fields,
      parentFieldPrompt
    );
    const fieldsByRequestedLabel = new Map();
    matchedFields.forEach((field) => {
      const normalizedLabel = normalizePromptText(field.label || field.apiName);
      const leafLabel = normalizedLabel.split(">").at(-1).trim();
      if (
        !leafLabel ||
        !normalizePromptText(parentFieldPrompt).includes(leafLabel)
      ) {
        return;
      }
      const current = fieldsByRequestedLabel.get(leafLabel);
      const score =
        (normalizedLabel === leafLabel ? 1000 : 0) -
        String(field.apiName || "").split(".").length * 100 -
        String(field.apiName || "").length;
      if (!current || score > current.score) {
        fieldsByRequestedLabel.set(leafLabel, { field, score });
      }
    });
    const requestedFields = [...fieldsByRequestedLabel.values()].map(
      (entry) => entry.field
    );
    const existingContent = this.recipe.bodyBlocks
      .map((block) => String(block.content || ""))
      .join(" ")
      .toLowerCase();
    const missingFields = requestedFields.filter(
      (field) =>
        !existingContent.includes(
          `{!${this.recipe.objectApiName}.${field.apiName}}`.toLowerCase()
        )
    );

    const normalizedPrompt = normalizePromptText(sourcePrompt);
    const leftMarker = normalizedPrompt.search(
      /\b(?:left box|left column|caja izquierda|columna izquierda)\b/
    );
    const rightMarker = normalizedPrompt.search(
      /\b(?:right box|right column|caja derecha|columna derecha)\b/
    );
    const requestsTwoBoxes =
      (leftMarker >= 0 && rightMarker >= 0) ||
      /\b(?:two|2|dos)\s+(?:separate\s+)?(?:boxes|columns|cajas|columnas)\b/.test(
        normalizedPrompt
      );
    if (!missingFields.length && !requestsTwoBoxes) {
      return;
    }
    const fieldsForCards = requestsTwoBoxes ? requestedFields : missingFields;
    const groups = requestsTwoBoxes ? [[], []] : [[]];
    fieldsForCards.forEach((field, index) => {
      if (groups.length === 1) {
        groups[0].push(field);
        return;
      }
      const fieldTerms = [field.label, field.apiName]
        .map((value) => normalizePromptText(value))
        .filter(Boolean);
      const fieldPosition = fieldTerms
        .map((term) => normalizedPrompt.indexOf(term))
        .filter((position) => position >= 0)
        .sort((left, right) => left - right)[0];
      if (
        leftMarker >= 0 &&
        rightMarker > leftMarker &&
        fieldPosition >= leftMarker
      ) {
        groups[fieldPosition >= rightMarker ? 1 : 0].push(field);
      } else {
        groups[index % 2].push(field);
      }
    });

    const nonEmptyGroups = groups.filter((group) => group.length);
    const cardWidth = nonEmptyGroups.length === 2 ? 49 : 100;
    const cards = nonEmptyGroups.map((group, index) => ({
      type: "text",
      wizardRole: "recordFieldCard",
      content: group
        .map(
          (field) =>
            `<div><strong>${escapeMarkup(field.label || field.apiName)}:</strong>&nbsp;{!${this.recipe.objectApiName}.${field.apiName}}</div>`
        )
        .join(""),
      widthPercent: cardWidth,
      xPercent: index === 1 ? 51 : 0,
      y: nonEmptyGroups.length === 2 ? 0 : undefined,
      horizontalAlign: "left",
      gapAfter: 12,
      styles: {
        background:
          this.recipe.bodyContentBackground === "transparent"
            ? "#eef4ff"
            : this.recipe.bodyContentBackground,
        color: this.recipe.textColor,
        padding: Math.max(12, Number(this.recipe.bodyContentPadding) || 0),
        borderStyle:
          this.recipe.bodyContentBorderStyle === "none"
            ? "solid"
            : this.recipe.bodyContentBorderStyle,
        borderWidth: Math.max(
          1,
          Number(this.recipe.bodyContentBorderWidth) || 0
        ),
        borderColor:
          this.recipe.bodyContentBorderStyle === "none"
            ? "#b5cde8"
            : this.recipe.bodyContentBorderColor,
        borderRadius: Math.max(
          6,
          Number(this.recipe.bodyContentBorderRadius) || 0
        ),
        fontSize: 12
      }
    }));
    let insertionIndex = this.recipe.bodyBlocks.findIndex(
      (block) =>
        block.type === "relatedList" ||
        block.type === "table" ||
        /\b(total|subtotal|grand total|importe total)\b/i.test(
          String(block.content || "")
        )
    );
    if (insertionIndex < 0) {
      insertionIndex = this.recipe.bodyBlocks.length;
    }
    let bodyBlocks = [...this.recipe.bodyBlocks];
    if (requestsTwoBoxes) {
      const requestedTokens = requestedFields.map((field) =>
        `{!${this.recipe.objectApiName}.${field.apiName}}`.toLowerCase()
      );
      bodyBlocks = bodyBlocks.filter((block) => {
        if (block.type !== "text" && block.type !== "field") {
          return true;
        }
        if (
          /\b(total|subtotal|grand total|importe total)\b/i.test(
            String(block.content || "")
          )
        ) {
          return true;
        }
        const content = String(block.content || "").toLowerCase();
        return !requestedTokens.some((token) => content.includes(token));
      });
      insertionIndex = bodyBlocks.findIndex(
        (block) =>
          block.type === "relatedList" ||
          block.type === "table" ||
          /\b(total|subtotal|grand total|importe total)\b/i.test(
            String(block.content || "")
          )
      );
      if (insertionIndex < 0) {
        insertionIndex = bodyBlocks.length;
      }
    }
    bodyBlocks.splice(insertionIndex, 0, ...cards);
    this.recipe = { ...this.recipe, bodyBlocks };
    if (!result.acceptedKeys.includes("bodyFields")) {
      result.acceptedKeys.push("bodyFields");
    }
    if (!result.changes.includes("bodyFields")) {
      result.changes.push("bodyFields");
    }
  }

  syncAIBlockBodyRequestedElements(result) {
    if (!this.recipe.bodyBlocks?.length) {
      return;
    }
    let bodyBlocks = [...this.recipe.bodyBlocks];
    const addChange = (key) => {
      if (!result.acceptedKeys.includes(key)) {
        result.acceptedKeys.push(key);
      }
      if (!result.changes.includes(key)) {
        result.changes.push(key);
      }
    };
    if (!this.recipe.includeBodyDivider) {
      bodyBlocks = bodyBlocks.filter((block) => block.type !== "divider");
    } else if (
      this.recipe.includeBodyDivider &&
      !bodyBlocks.some((block) => block.type === "divider")
    ) {
      const divider = {
        type: "divider",
        wizardRole: "bodyDivider",
        widthPercent: 100,
        xPercent: 0,
        gapAfter: 12,
        styles: {
          lineColor: this.recipe.bodyDividerColor,
          lineStyle: "solid",
          lineThickness: 1
        }
      };
      const relatedListIndex = bodyBlocks.findIndex(
        (block) => block.type === "relatedList" || block.type === "table"
      );
      bodyBlocks.splice(
        relatedListIndex >= 0 ? relatedListIndex : bodyBlocks.length,
        0,
        divider
      );
      addChange("includeBodyDivider");
    }
    let totalIndex = bodyBlocks.findIndex((block) =>
      /\b(total|subtotal|grand total|importe total)\b/i.test(
        String(block.content || "")
      )
    );
    if (!this.recipe.includeRelatedListTotal && totalIndex >= 0) {
      bodyBlocks.splice(totalIndex, 1);
      totalIndex = -1;
    } else if (
      this.recipe.includeRelatedListTotal &&
      this.recipe.relatedListTotalFieldApiName &&
      totalIndex < 0
    ) {
      const totalBlock = {
        type: "text",
        wizardRole: "relatedListTotal",
        content: `<strong>${escapeMarkup(
          String(this.recipe.relatedListTotalLabel || "Total").toUpperCase()
        )}:</strong>&nbsp;<strong>{!${this.recipe.objectApiName}.${this.recipe.relatedListTotalFieldApiName}}</strong>`,
        widthPercent: 100,
        xPercent: 0,
        horizontalAlign: "center",
        gapAfter: 16,
        styles: {
          background:
            this.recipe.relatedListHeaderRowColor ||
            this.recipe.primaryColor ||
            "#032d60",
          color: this.recipe.relatedListHeaderTextColor || "#ffffff",
          padding: 16,
          fontSize: 16,
          fontWeight: "bold",
          textAlign: "center"
        }
      };
      const relatedListIndex = bodyBlocks.findIndex(
        (block) => block.type === "relatedList" || block.type === "table"
      );
      bodyBlocks.splice(
        relatedListIndex >= 0 ? relatedListIndex + 1 : bodyBlocks.length,
        0,
        totalBlock
      );
      addChange("includeRelatedListTotal");
    } else if (
      this.recipe.includeRelatedListTotal &&
      this.recipe.relatedListTotalFieldApiName &&
      totalIndex >= 0
    ) {
      const current = bodyBlocks[totalIndex];
      bodyBlocks[totalIndex] = {
        ...current,
        wizardRole: "relatedListTotal",
        content: `<strong>${escapeMarkup(
          String(this.recipe.relatedListTotalLabel || "Total").toUpperCase()
        )}:</strong>&nbsp;<strong>{!${this.recipe.objectApiName}.${this.recipe.relatedListTotalFieldApiName}}</strong>`,
        styles: {
          ...(current.styles || {}),
          background:
            this.recipe.relatedListHeaderRowColor ||
            this.recipe.primaryColor ||
            "#032d60",
          color: this.recipe.relatedListHeaderTextColor || "#ffffff"
        }
      };
    }
    this.recipe = { ...this.recipe, bodyBlocks };
  }

  getUnsupportedPromptMessage() {
    if (this.isHeaderStep) {
      return "Salesforce AI could not translate that request into supported Header elements. Describe the text, fields, image, lines, positions, sizes, or appearance you want.";
    }
    if (this.isBodyStep) {
      return "Salesforce AI could not translate that request into supported Body elements. Describe the text, fields, boxes, lines, tables, Related List, order, positions, sizes, or appearance you want.";
    }
    if (this.isFooterStep) {
      return "Salesforce AI could not translate that request into supported Footer elements. Describe the text, fields, lines, positions, sizes, colors, or repetition you want.";
    }
    return "Salesforce AI could not translate that request into the available Setup controls. Describe the document appearance or use the controls below.";
  }

  updateRecipe(changes) {
    this.recipe = { ...this.recipe, ...changes };
    this.syncAIBlockHeaderControls(changes);
    this.syncAIBlockRelatedListSettings(changes);
    this.syncAIBlockAppearanceSettings(changes);
    this.syncAIBlockBodyStructure(changes);
    this.syncAIBlockBodyFieldControls(changes);
    this.syncAIBlockBodyRequestedElements({ acceptedKeys: [], changes: [] });
    this.syncAIBlockFooterControls(changes);
    this.errorMessage = "";
    this.promptNotice = "";
    this.emitPreview();
  }

  syncAIBlockBodyFieldControls(changes = {}) {
    if (!this.recipe.bodyBlocks?.length) {
      return;
    }
    const changedKeys = new Set(Object.keys(changes));
    if (
      ![
        "bodyFields",
        "groupBodyFields",
        "includeOrganizationBodyBox",
        "bodyLayout",
        "fieldDisplayMode"
      ].some((key) => changedKeys.has(key))
    ) {
      return;
    }
    const selectedFields = this.recipe.bodyFields || [];
    let bodyBlocks = this.recipe.bodyBlocks.filter(
      (block) =>
        block.wizardRole !== "recordFieldCard" &&
        block.wizardRole !== "organizationBodyCard" &&
        block.wizardRole !== "wizardBodyField"
    );
    const style = {
      background: this.recipe.bodyContentBackground,
      color: this.recipe.textColor,
      padding: this.recipe.bodyContentPadding,
      borderStyle: this.recipe.bodyContentBorderStyle,
      borderWidth: this.recipe.bodyContentBorderWidth,
      borderColor: this.recipe.bodyContentBorderColor,
      borderRadius: this.recipe.bodyContentBorderRadius,
      fontSize: 12
    };
    const fieldContent = (field) => {
      const token = `{!${this.recipe.objectApiName}.${field.apiName}}`;
      if (this.recipe.fieldDisplayMode === "value") {
        return token;
      }
      if (this.recipe.fieldDisplayMode === "labelOnly") {
        return `<strong>${escapeMarkup(field.label || field.apiName)}</strong>`;
      }
      return `<div><strong>${escapeMarkup(field.label || field.apiName)}:</strong>&nbsp;${token}</div>`;
    };
    const generatedBlocks = [];
    if (this.recipe.groupBodyFields && selectedFields.length) {
      generatedBlocks.push({
        type: "text",
        wizardRole: "recordFieldCard",
        content: selectedFields.map(fieldContent).join(""),
        widthPercent: this.recipe.includeOrganizationBodyBox ? 49 : 100,
        xPercent: 0,
        gapAfter: 12,
        styles: { ...style }
      });
    } else {
      selectedFields.forEach((field, index) => {
        const twoColumns = this.recipe.bodyLayout === "two";
        generatedBlocks.push({
          type: "field",
          wizardRole: "wizardBodyField",
          fieldApiName: field.apiName,
          fieldLabel: field.label,
          content: fieldContent(field),
          widthPercent: twoColumns ? 49 : 100,
          xPercent: twoColumns && index % 2 === 1 ? 51 : 0,
          ...(twoColumns ? { y: Math.floor(index / 2) * 84 } : {}),
          gapAfter: 12,
          styles: { ...style }
        });
      });
    }
    if (this.recipe.includeOrganizationBodyBox) {
      generatedBlocks.push({
        type: "text",
        wizardRole: "organizationBodyCard",
        content:
          "<div><strong>{!$Organization.Name}</strong></div><div>{!$Organization.Street}</div><div>{!$Organization.City} {!$Organization.PostalCode}</div><div>{!$Organization.Phone}</div>",
        widthPercent: 49,
        xPercent: 51,
        y: 0,
        gapAfter: 12,
        styles: { ...style }
      });
    }
    const insertionIndex = bodyBlocks.findIndex(
      (block) => block.type === "relatedList" || block.type === "table"
    );
    bodyBlocks.splice(
      insertionIndex >= 0 ? insertionIndex : bodyBlocks.length,
      0,
      ...generatedBlocks
    );
    this.recipe = { ...this.recipe, bodyBlocks };
  }

  syncAIBlockHeaderControls(changes = {}) {
    if (!this.recipe.headerBlocks?.length) {
      return;
    }
    const changedKeys = new Set(Object.keys(changes));
    let headerBlocks = this.recipe.headerBlocks.map((block) => ({ ...block }));
    if (changedKeys.has("includeOrganizationName")) {
      const organizationPattern = /\{!\$Organization\.Name\}/gi;
      headerBlocks = headerBlocks.map((block) => {
        return ["text", "field"].includes(block.type)
          ? {
              ...block,
              content: String(block.content || "")
                .replace(organizationPattern, "")
                .trim()
            }
          : block;
      });
      if (this.recipe.includeOrganizationName) {
        const targetIndex = headerBlocks.findIndex((block) =>
          ["text", "field"].includes(block.type)
        );
        if (targetIndex >= 0) {
          headerBlocks[targetIndex] = {
            ...headerBlocks[targetIndex],
            content: `{!$Organization.Name}${headerBlocks[targetIndex].content ? `&nbsp;&nbsp;${headerBlocks[targetIndex].content}` : ""}`
          };
        }
      }
    }
    if (changedKeys.has("includeHeaderImage")) {
      headerBlocks = headerBlocks.filter((block) => block.type !== "image");
      if (this.recipe.includeHeaderImage) {
        headerBlocks.unshift({
          type: "image",
          wizardRole: "headerImage",
          imageSrc: this.recipe.imageUrl || "",
          imageAlt: this.recipe.imageAlt || "Header image",
          widthPercent: this.recipe.imageSize === "large" ? 32 : 20,
          horizontalAlign: this.recipe.headerImageAlignment,
          gapAfter: 8,
          styles: {}
        });
      }
    }
    if (
      changedKeys.has("imageUrl") ||
      changedKeys.has("imageAlt") ||
      changedKeys.has("imageSize") ||
      changedKeys.has("headerImageAlignment")
    ) {
      headerBlocks = headerBlocks.map((block) => {
        return block.type === "image"
          ? {
              ...block,
              imageSrc: this.recipe.imageUrl || "",
              imageAlt: this.recipe.imageAlt || "Header image",
              widthPercent: this.recipe.imageSize === "large" ? 32 : 20,
              horizontalAlign: this.recipe.headerImageAlignment
            }
          : block;
      });
    }
    if (changedKeys.has("headerFields")) {
      const selectedFields = this.recipe.headerFields || [];
      headerBlocks = headerBlocks.filter(
        (block) => block.wizardRole !== "headerField"
      );
      const existingApiNames = new Set(
        headerBlocks.flatMap((block) =>
          getBlockFieldApiNames(block.content, this.recipe.objectApiName)
        )
      );
      const referenceStyles =
        headerBlocks.find((block) => ["text", "field"].includes(block.type))
          ?.styles || {};
      selectedFields
        .filter((field) => !existingApiNames.has(field.apiName))
        .forEach((field) => {
          headerBlocks.push({
            type: "field",
            wizardRole: "headerField",
            fieldApiName: field.apiName,
            fieldLabel: field.label,
            content: `<strong>${escapeMarkup(field.label || field.apiName)}:</strong>&nbsp;{!${this.recipe.objectApiName}.${field.apiName}}`,
            widthPercent: 100,
            xPercent: 0,
            gapAfter: 4,
            styles: { ...referenceStyles }
          });
        });
    }
    this.recipe = { ...this.recipe, headerBlocks };
  }

  syncAIBlockBodyStructure(changes = {}) {
    if (!this.recipe.bodyBlocks?.length) {
      return;
    }
    const changedKeys = new Set(Object.keys(changes));
    let bodyBlocks = [...this.recipe.bodyBlocks];
    if (
      changedKeys.has("includeBodyTitle") ||
      changedKeys.has("documentTitle") ||
      changedKeys.has("primaryColor")
    ) {
      const titleText = String(this.recipe.documentTitle || "").trim();
      let titleIndex = bodyBlocks.findIndex(
        (block) => block.wizardRole === "bodyTitle"
      );
      if (titleIndex < 0 && titleText) {
        titleIndex = bodyBlocks.findIndex((block) =>
          String(block.content || "").includes(titleText)
        );
      }
      if (!this.recipe.includeBodyTitle || !titleText) {
        if (
          titleIndex >= 0 &&
          bodyBlocks[titleIndex].wizardRole === "bodyTitle"
        ) {
          bodyBlocks.splice(titleIndex, 1);
        }
      } else {
        const titleBlock = {
          ...(titleIndex >= 0 ? bodyBlocks[titleIndex] : {}),
          type: "text",
          wizardRole: "bodyTitle",
          content: `<strong>${escapeMarkup(titleText)}</strong>`,
          widthPercent: 100,
          xPercent: 0,
          horizontalAlign: "center",
          gapAfter: 12,
          styles: {
            ...(titleIndex >= 0 ? bodyBlocks[titleIndex].styles || {} : {}),
            color: this.recipe.primaryColor,
            fontSize: 24,
            fontWeight: "bold",
            textAlign: "center",
            padding: 4
          }
        };
        bodyBlocks = bodyBlocks.filter((block, index) => {
          if (index === titleIndex || block.wizardRole === "bodyTitle") {
            return false;
          }
          const plainText = String(block.content || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;|&#160;/gi, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          return plainText !== titleText.toLowerCase();
        });
        bodyBlocks.unshift(titleBlock);
      }
    }
    this.recipe = { ...this.recipe, bodyBlocks };
  }

  syncAIBlockAppearanceSettings(changes = {}) {
    const changedKeys = new Set(Object.keys(changes));
    const updateTextBlocks = (blocks, styleMap, extra = {}) =>
      (blocks || []).map((block) => {
        if (
          !["text", "field"].includes(block.type) ||
          (extra.matches && !extra.matches(block))
        ) {
          return block;
        }
        const styles = { ...(block.styles || {}) };
        Object.entries(styleMap).forEach(([recipeKey, styleKey]) => {
          if (changedKeys.has(recipeKey)) {
            styles[styleKey] = this.recipe[recipeKey];
          }
        });
        const nextBlock = { ...block, styles };
        if (extra.sizeMode && changedKeys.has(extra.sizeMode)) {
          if (this.recipe[extra.sizeMode] === "fullWidth") {
            nextBlock.widthPercent = 100;
            nextBlock.xPercent = 0;
          } else {
            delete nextBlock.widthPercent;
          }
        }
        return nextBlock;
      });

    const headerStyleMap = {
      headerContentBackground: "background",
      headerContentPadding: "padding",
      headerContentBorderStyle: "borderStyle",
      headerContentBorderWidth: "borderWidth",
      headerContentBorderColor: "borderColor",
      headerContentBorderRadius: "borderRadius",
      headerTextColor: "color"
    };
    if (
      this.recipe.headerBlocks?.length &&
      Object.keys(headerStyleMap).some((key) => changedKeys.has(key))
    ) {
      this.recipe = {
        ...this.recipe,
        headerBlocks: updateTextBlocks(
          this.recipe.headerBlocks,
          headerStyleMap,
          { sizeMode: "headerContentSizeMode" }
        )
      };
    } else if (
      this.recipe.headerBlocks?.length &&
      changedKeys.has("headerContentSizeMode")
    ) {
      this.recipe = {
        ...this.recipe,
        headerBlocks: updateTextBlocks(
          this.recipe.headerBlocks,
          {},
          {
            sizeMode: "headerContentSizeMode"
          }
        )
      };
    }

    const bodyStyleMap = {
      bodyContentBackground: "background",
      bodyContentPadding: "padding",
      bodyContentBorderStyle: "borderStyle",
      bodyContentBorderWidth: "borderWidth",
      bodyContentBorderColor: "borderColor",
      bodyContentBorderRadius: "borderRadius",
      textColor: "color"
    };
    if (
      this.recipe.bodyBlocks?.length &&
      Object.keys(bodyStyleMap).some((key) => changedKeys.has(key))
    ) {
      this.recipe = {
        ...this.recipe,
        bodyBlocks: updateTextBlocks(this.recipe.bodyBlocks, bodyStyleMap, {
          matches: (block) => {
            const content = String(block.content || "");
            return (
              block.wizardRole === "recordFieldCard" ||
              block.wizardRole === "organizationBodyCard" ||
              block.wizardRole === "wizardBodyField" ||
              block.type === "field" ||
              (content.includes("{!") &&
                !/\b(total|subtotal|tax|discount)\b/i.test(content)) ||
              (block.type === "text" &&
                block.wizardRole !== "bodyTitle" &&
                block.wizardRole !== "relatedListTotal" &&
                (block.styles?.background || block.styles?.borderStyle))
            );
          }
        })
      };
    }

    const footerStyleMap = {
      footerTextColor: "color",
      footerAlignment: "textAlign"
    };
    if (
      this.recipe.footerBlocks?.length &&
      Object.keys(footerStyleMap).some((key) => changedKeys.has(key))
    ) {
      this.recipe = {
        ...this.recipe,
        footerBlocks: updateTextBlocks(this.recipe.footerBlocks, footerStyleMap)
      };
    }
  }

  syncAIBlockFooterControls(changes = {}) {
    if (!this.recipe.footerBlocks?.length) {
      return;
    }
    const changedKeys = new Set(Object.keys(changes));
    let footerBlocks = this.recipe.footerBlocks.map((block) => ({
      ...block,
      styles: { ...(block.styles || {}) }
    }));
    const textIndexes = () =>
      footerBlocks
        .map((block, index) => ({ block, index }))
        .filter(({ block }) => ["text", "field"].includes(block.type))
        .map(({ index }) => index);
    const ensureTextBlock = (position) => {
      const existing = textIndexes()[position];
      if (existing !== undefined) {
        return existing;
      }
      footerBlocks.push({
        type: "text",
        wizardRole: position === 0 ? "footerPrimary" : "footerSecondary",
        content: "",
        widthPercent: 100,
        xPercent: 0,
        horizontalAlign: this.recipe.footerAlignment,
        gapAfter: 0,
        styles: {
          color: this.recipe.footerTextColor,
          textAlign: this.recipe.footerAlignment,
          fontSize: 12
        }
      });
      return footerBlocks.length - 1;
    };
    const buildPrimaryContent = () => {
      const parts = [];
      if (String(this.recipe.footerText || "").trim()) {
        parts.push(escapeMarkup(this.recipe.footerText.trim()));
      }
      if (this.recipe.includeFooterOrganizationName) {
        parts.push("{!$Organization.Name}");
      }
      return parts.join(" | ");
    };
    if (
      changedKeys.has("footerText") ||
      changedKeys.has("includeFooterOrganizationName")
    ) {
      const primaryIndex = ensureTextBlock(0);
      footerBlocks[primaryIndex] = {
        ...footerBlocks[primaryIndex],
        wizardRole: "footerPrimary",
        content: buildPrimaryContent()
      };
    }
    if (changedKeys.has("footerSecondaryText")) {
      const secondaryText = String(
        this.recipe.footerSecondaryText || ""
      ).trim();
      const currentSecondaryIndex = textIndexes()[1];
      if (!secondaryText && currentSecondaryIndex !== undefined) {
        footerBlocks.splice(currentSecondaryIndex, 1);
      } else if (secondaryText) {
        const secondaryIndex = ensureTextBlock(1);
        footerBlocks[secondaryIndex] = {
          ...footerBlocks[secondaryIndex],
          wizardRole: "footerSecondary",
          content: escapeMarkup(secondaryText)
        };
      }
    }
    if (changedKeys.has("footerShowDivider")) {
      footerBlocks = footerBlocks.filter((block) => block.type !== "divider");
      if (this.recipe.footerShowDivider) {
        footerBlocks.unshift({
          type: "divider",
          wizardRole: "footerDivider",
          widthPercent: 100,
          xPercent: 0,
          gapAfter: 10,
          styles: {
            lineColor: this.recipe.footerDividerColor,
            lineStyle: "solid",
            lineThickness: 1
          }
        });
      }
    }
    footerBlocks = footerBlocks.map((block) => {
      if (block.type === "divider") {
        return changedKeys.has("footerDividerColor")
          ? {
              ...block,
              styles: {
                ...(block.styles || {}),
                lineColor: this.recipe.footerDividerColor
              }
            }
          : block;
      }
      if (!["text", "field"].includes(block.type)) {
        return block;
      }
      const styles = { ...(block.styles || {}) };
      if (changedKeys.has("footerTextColor")) {
        styles.color = this.recipe.footerTextColor;
      }
      if (changedKeys.has("footerAlignment")) {
        styles.textAlign = this.recipe.footerAlignment;
      }
      if (changedKeys.has("footerBackground")) {
        styles.background = this.recipe.footerBackground;
      }
      return {
        ...block,
        ...(changedKeys.has("footerAlignment")
          ? { horizontalAlign: this.recipe.footerAlignment }
          : {}),
        styles
      };
    });
    this.recipe = { ...this.recipe, footerBlocks };
  }

  updateFieldSelection(fieldName, apiName, isSelected) {
    const selected = new Map(
      (this.recipe[fieldName] || []).map((field) => [field.apiName, field])
    );
    if (isSelected) {
      const field = this.fields.find((item) => item.apiName === apiName);
      if (field) {
        selected.set(apiName, field);
      }
    } else {
      selected.delete(apiName);
    }
    this.updateRecipe({ [fieldName]: [...selected.values()] });
  }

  async selectRelatedList(selected) {
    this.recipe = {
      ...this.recipe,
      includeRelatedList: true,
      relatedListRelationshipName: selected.relationshipName,
      relatedListChildObjectApiName: selected.childObjectApiName,
      relatedListLabel: selected.label,
      relatedListColumns: []
    };
    await this.loadRelatedListContext(selected.childObjectApiName);
    if (
      this.recipe.relatedListRelationshipName !== selected.relationshipName ||
      this.recipe.relatedListChildObjectApiName !== selected.childObjectApiName
    ) {
      return;
    }
    this.recipe = {
      ...this.recipe,
      relatedListColumns: this.getPreferredRelatedListColumns().map(
        (field) => field.apiName
      )
    };
    this.syncAIBlockRelatedListSettings({
      relatedListRelationshipName: this.recipe.relatedListRelationshipName,
      relatedListChildObjectApiName: this.recipe.relatedListChildObjectApiName,
      relatedListLabel: this.recipe.relatedListLabel,
      relatedListColumns: this.recipe.relatedListColumns
    });
    this.emitPreview();
  }

  getPreferredRelatedListColumns() {
    const preferredNames = [
      "Name",
      "Description",
      "Email",
      "Phone",
      "Title",
      "Quantity",
      "UnitPrice",
      "TotalPrice",
      "Amount",
      "Status"
    ];
    const fieldsByName = new Map(
      this.relatedListFields.map((field) => [field.apiName, field])
    );
    const preferred = preferredNames
      .map((name) => fieldsByName.get(name))
      .filter(Boolean)
      .slice(0, 4);
    return preferred.length ? preferred : this.relatedListFields.slice(0, 4);
  }

  syncAIBlockRelatedListColumns(columns) {
    if (!this.recipe.bodyBlocks?.length) {
      return;
    }
    const selectedColumns = new Set(columns || []);
    const definitions = this.relatedListFields
      .filter((field) => selectedColumns.has(field.apiName))
      .map((field) => ({
        apiName: field.apiName,
        label: field.label,
        ...(field.dataType ? { dataType: field.dataType } : {})
      }));
    let bodyBlocks = this.recipe.bodyBlocks.map((block) => {
      return block.type === "relatedList" &&
        block.relatedListRelationshipName ===
          this.recipe.relatedListRelationshipName
        ? {
            ...block,
            relatedListColumns: [...selectedColumns],
            relatedListColumnDefinitions: definitions,
            ...Object.fromEntries(
              Object.entries(RELATED_LIST_BLOCK_PROPERTY_MAP).map(
                ([recipeKey, blockKey]) => [
                  blockKey,
                  block[blockKey] ?? this.recipe[recipeKey]
                ]
              )
            )
          }
        : block;
    });
    if (
      this.recipe.includeRelatedList &&
      this.recipe.relatedListRelationshipName &&
      selectedColumns.size &&
      !bodyBlocks.some((block) => block.type === "relatedList")
    ) {
      const relatedListBlock = {
        type: "relatedList",
        relatedListRelationshipName: this.recipe.relatedListRelationshipName,
        relatedListChildObjectApiName:
          this.recipe.relatedListChildObjectApiName,
        relatedListLabel: this.recipe.relatedListLabel,
        relatedListColumns: [...selectedColumns],
        relatedListColumnDefinitions: definitions,
        ...Object.fromEntries(
          Object.entries(RELATED_LIST_BLOCK_PROPERTY_MAP).map(
            ([recipeKey, blockKey]) => [blockKey, this.recipe[recipeKey]]
          )
        ),
        widthPercent: 100,
        gapAfter: 12,
        styles: {}
      };
      const totalIndex = bodyBlocks.findIndex((block) =>
        /\b(total|subtotal|grand total|importe total)\b/i.test(
          String(block.content || "")
        )
      );
      if (totalIndex >= 0) {
        bodyBlocks.splice(totalIndex, 0, relatedListBlock);
      } else {
        bodyBlocks.push(relatedListBlock);
      }
    }
    this.recipe = {
      ...this.recipe,
      bodyBlocks
    };
  }

  syncAIBlockRelatedListSettings(changes = {}) {
    if (!this.recipe.bodyBlocks?.length) {
      return;
    }
    const changedKeys = Object.keys(changes);
    if (changedKeys.includes("includeRelatedList")) {
      if (!this.recipe.includeRelatedList) {
        this.recipe = {
          ...this.recipe,
          bodyBlocks: this.recipe.bodyBlocks.filter(
            (block) => block.type !== "relatedList"
          )
        };
        return;
      }
      this.syncAIBlockRelatedListColumns(this.recipe.relatedListColumns);
    }
    const updates = Object.entries(RELATED_LIST_BLOCK_PROPERTY_MAP).filter(
      ([recipeKey]) => changedKeys.includes(recipeKey)
    );
    const updatesRelationship = changedKeys.some((key) =>
      [
        "relatedListRelationshipName",
        "relatedListChildObjectApiName",
        "relatedListLabel"
      ].includes(key)
    );
    const updatesColumns = changedKeys.includes("relatedListColumns");
    if (!updates.length && !updatesRelationship && !updatesColumns) {
      return;
    }
    const selectedColumns = new Set(this.recipe.relatedListColumns || []);
    const definitions = this.relatedListFields
      .filter((field) => selectedColumns.has(field.apiName))
      .map((field) => ({
        apiName: field.apiName,
        label: field.label,
        ...(field.dataType ? { dataType: field.dataType } : {})
      }));
    const hasRelatedListBlock = this.recipe.bodyBlocks.some(
      (block) => block.type === "relatedList"
    );
    const tableStyleMap = {
      relatedListHeaderRowColor: "tableHeaderRowColor",
      relatedListHeaderTextColor: "tableHeaderTextColor",
      relatedListOddRowColor: "tableOddRowColor",
      relatedListOddTextColor: "tableOddTextColor",
      relatedListEvenRowColor: "tableEvenRowColor",
      relatedListEvenTextColor: "tableEvenTextColor",
      relatedListFontSize: "fontSize",
      relatedListBorderMode: "tableBorderMode",
      relatedListGridColor: "tableBorderColor"
    };
    this.recipe = {
      ...this.recipe,
      bodyBlocks: this.recipe.bodyBlocks.map((block) => {
        const isRelatedList = block.type === "relatedList";
        const isLegacyRelatedTable =
          block.type === "table" && !hasRelatedListBlock;
        if (!isRelatedList && !isLegacyRelatedTable) {
          return block;
        }
        const nextBlock = { ...block };
        if (isRelatedList) {
          updates.forEach(([recipeKey, blockKey]) => {
            nextBlock[blockKey] = this.recipe[recipeKey];
          });
        } else {
          nextBlock.styles = { ...(nextBlock.styles || {}) };
          updates.forEach(([recipeKey]) => {
            const styleKey = tableStyleMap[recipeKey];
            if (styleKey) {
              nextBlock.styles[styleKey] = this.recipe[recipeKey];
            }
          });
        }
        if (updatesRelationship) {
          nextBlock.relatedListRelationshipName =
            this.recipe.relatedListRelationshipName;
          nextBlock.relatedListChildObjectApiName =
            this.recipe.relatedListChildObjectApiName;
          nextBlock.relatedListLabel = this.recipe.relatedListLabel;
        }
        if (updatesColumns) {
          nextBlock.relatedListColumns = [...selectedColumns];
          nextBlock.relatedListColumnDefinitions = definitions;
        }
        return nextBlock;
      })
    };
  }

  async loadObjectContext(objectApiName) {
    const requestId = ++this.objectContextRequestId;
    if (!objectApiName) {
      this.fields = [];
      this.relatedLists = [];
      this.relatedListFields = [];
      this.recordTypeOptions = [{ label: "All record types", value: "ALL" }];
      return;
    }

    this.beginLoading();
    this.errorMessage = "";
    try {
      const [fields, relatedLists, recordTypes] = await Promise.all([
        getFields({ objectApiName, searchTerm: "" }),
        getRelatedLists({ objectApiName }),
        getRecordTypeOptions({ objectApiName })
      ]);
      if (
        requestId === this.objectContextRequestId &&
        this.recipe.objectApiName === objectApiName
      ) {
        this.fields = fields || [];
        this.relatedLists = relatedLists || [];
        this.recordTypeOptions = recordTypes?.length
          ? recordTypes
          : [{ label: "All record types", value: "ALL" }];
      }
    } catch (error) {
      if (requestId === this.objectContextRequestId) {
        this.errorMessage = this.getErrorMessage(error);
        this.fields = [];
        this.relatedLists = [];
      }
    } finally {
      this.endLoading();
    }
  }

  async loadRelatedListContext(childObjectApiName) {
    const requestId = ++this.relatedListContextRequestId;
    if (!childObjectApiName) {
      this.relatedListFields = [];
      return;
    }

    this.beginLoading();
    try {
      const fields =
        (await getRelatedListFields({
          childObjectApiName,
          searchTerm: ""
        })) || [];
      if (
        requestId === this.relatedListContextRequestId &&
        this.recipe.relatedListChildObjectApiName === childObjectApiName
      ) {
        this.relatedListFields = fields;
      }
    } catch (error) {
      if (requestId === this.relatedListContextRequestId) {
        this.errorMessage = this.getErrorMessage(error);
        this.relatedListFields = [];
      }
    } finally {
      this.endLoading();
    }
  }

  beginLoading() {
    this.loadingOperationCount += 1;
    this.isLoading = true;
  }

  endLoading() {
    this.loadingOperationCount = Math.max(0, this.loadingOperationCount - 1);
    this.isLoading = this.loadingOperationCount > 0;
  }

  validateStep() {
    if (this.isContextStep && !String(this.recipe.templateName).trim()) {
      return "Enter a template name.";
    }
    if (this.isContextStep && !this.recipe.objectApiName) {
      return "Select a Salesforce object.";
    }
    if (
      this.isBodyStep &&
      this.recipe.includeRelatedList &&
      !this.recipe.relatedListColumns.length
    ) {
      return "Select at least one Related List column.";
    }
    return "";
  }

  emitPreview(waitForRender = false) {
    let renderPromise = Promise.resolve();
    if (waitForRender) {
      this.resolvePreviewRendered();
      renderPromise = new Promise((resolve) => {
        this.previewRenderResolve = resolve;
        // The timeout is a safety net if the parent render acknowledgement is lost.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.previewRenderTimeoutId = window.setTimeout(
          () => this.resolvePreviewRendered(),
          30000
        );
      });
      this.dispatchEvent(new CustomEvent("wizardpreviewstart"));
    }
    this.dispatchEvent(
      new CustomEvent("wizardpreview", { detail: this.getRecipeSnapshot() })
    );
    return renderPromise;
  }

  getRecipeSnapshot() {
    const snapshot = clone(this.recipe);
    const selectedColumns = new Set(snapshot.relatedListColumns || []);
    snapshot.relatedListColumnDefinitions = this.relatedListFields
      .filter((field) => selectedColumns.has(field.apiName))
      .map((field) => ({
        apiName: field.apiName,
        label: field.label,
        ...(field.dataType ? { dataType: field.dataType } : {})
      }));
    return snapshot;
  }

  resetPromptState() {
    this.promptText = "";
    this.promptNotice = "";
    this.errorMessage = "";
  }

  scrollWizardContentToTop(focusError = false) {
    Promise.resolve().then(() => {
      const content = this.template.querySelector(".wizard-content");
      if (content) {
        content.scrollTop = 0;
      }
      if (focusError) {
        this.template.querySelector('[data-role="wizard-error"]')?.focus();
      }
    });
  }

  resolvePreviewRendered() {
    if (this.previewRenderTimeoutId) {
      window.clearTimeout(this.previewRenderTimeoutId);
      this.previewRenderTimeoutId = null;
    }
    const resolve = this.previewRenderResolve;
    this.previewRenderResolve = null;
    resolve?.();
  }

  getErrorMessage(error) {
    return (
      error?.body?.message ||
      error?.message ||
      "The wizard could not load Salesforce metadata."
    );
  }

  getAIError(error) {
    const rawMessage = this.getErrorMessage(error);
    const match = rawMessage.match(AI_ERROR_PATTERN);
    if (!match) {
      return { code: "", message: rawMessage };
    }
    return {
      code: String(match[1] || "").toUpperCase(),
      message: String(match[2] || "").trim()
    };
  }

  getColorValue(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : "#ffffff";
  }
}
