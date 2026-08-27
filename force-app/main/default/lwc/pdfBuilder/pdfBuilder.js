import { LightningElement, api, track, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import pdfBuilderLogo from "@salesforce/resourceUrl/PDFBuilderBrandLogo";
import {
  formatTemplateOptions,
  resolveBuilderConfiguration
} from "c/pdfBuilderUtils";
import {
  normalizeColor,
  normalizeImageUrl,
  sanitizeDocumentModel,
  sanitizeRichTextHtml
} from "c/pdfBuilderSecurity";
import getConfiguration from "@salesforce/apex/PDFBuilderController.getConfiguration";
import getObjects from "@salesforce/apex/PDFBuilderController.getObjects";
import getFields from "@salesforce/apex/PDFBuilderController.getFields";
import getRelatedLists from "@salesforce/apex/PDFBuilderController.getRelatedLists";
import getRelatedListFields from "@salesforce/apex/PDFBuilderController.getRelatedListFields";
import getTemplates from "@salesforce/apex/PDFBuilderController.getTemplates";
import getTemplate from "@salesforce/apex/PDFBuilderController.getTemplate";
import saveTemplate from "@salesforce/apex/PDFBuilderController.saveTemplate";
import deleteTemplate from "@salesforce/apex/PDFBuilderController.deleteTemplate";
import saveTemplateImage from "@salesforce/apex/PDFBuilderController.saveTemplateImage";
import getSalesforceImageFiles from "@salesforce/apex/PDFBuilderController.getSalesforceImageFiles";
import renderPdfFlowForRecordPreview from "@salesforce/apex/PDFBuilderController.renderPdfFlowForRecordPreview";

const BLOCK_RUNTIME_KEYS = new Set([
  "className",
  "inlineStyle",
  "shellStyle",
  "resizeHandles",
  "textStyle",
  "tableRows",
  "tableCellStyle",
  "isSelected",
  "isText",
  "isField",
  "isDivider",
  "isImage",
  "isTable",
  "isRelatedList",
  "isVerticalLine",
  "hasImage",
  "relatedListColumnCsv",
  "relatedListColumnLabels",
  "relatedListPreviewRows",
  "relatedListCellStyle",
  "relatedListHeaderCellStyle"
]);

const REGION_RUNTIME_KEYS = new Set(["className", "inlineStyle", "isEmpty"]);
const DEFAULT_TABLE_HEIGHT = 120;

export default class PDFBuilder extends LightningElement {
  @api recordId;
  applicationLogoUrl = pdfBuilderLogo;
  pageRefRecordId;
  enablePointerBlockMove = true;
  enableExistingBlockDrag = false;
  suppressMouseUpUntil = 0;
  suppressBlockMoveUntil = 0;
  suppressRegionClickUntil = 0;
  suppressBlockSelectUntil = 0;
  lastNativeDropAt = 0;
  pageWidth;
  pageHeight;
  defaultPagePadding;
  defaultElementPadding;
  defaultHeaderHeight;
  defaultFooterHeight;
  maxPages;
  longTextLimit;
  maxClientImageBase64Length;
  inputDebounceMilliseconds;

  draggedType;
  draggedField;
  draggedBlockId;
  draggedBlockRegionId;
  dragHistorySaved = false;
  lastDragOverKey = "";
  resizeState;
  blockMoveState;
  dragGridRegionId;
  dragGuideState;
  lastKnownDropPointer;
  dragGridSize;
  sidebarResizeState;
  sidebarWidth = 280;
  sidebarMinWidth = 280;
  sidebarMaxWidth = 560;
  propertiesResizeState;
  propertiesPanelWidth = 360;
  propertiesPanelMinWidth = 320;
  propertiesPanelMaxWidth = 640;
  boundMouseMoveHandler;
  boundMouseUpHandler;
  boundKeyDownHandler;
  boundOutsideMouseDownHandler;
  boundNativeBlockDragStartHandler;
  paletteDragState;
  editingTextBlockId;
  activeEditingBlockComponent;
  lastTextPointerDownBlockId;
  lastTextPointerDownAt = 0;
  copiedBlock;
  pendingImageUploadBlockId;
  imageFilePickerBlockId;
  imageFileSearchTimer;
  propertyFontSizeTimer;
  previewPaginationTimer;
  previewGenerationRequestId = 0;
  templateLoadRequestId = 0;
  relatedListFieldsRequestId = 0;

  selectedBlockId;
  selectedRegionId = "body-1";
  selectedKind = "region";
  @track documentModel;
  htmlOutput = "";
  previewHtml = "";
  previewFlow;
  previewRecordId = "";
  isPreviewGenerating = false;
  isHtmlOpen = false;
  isPreviewOpen = false;
  isFullscreen = false;
  objectOptions = [];
  fieldOptions = [];
  templateOptions = [];
  selectedObjectApiName = "";
  relatedListOptions = [];
  relatedListFieldOptions = [];
  fieldSearchTerm = "";
  fieldInsertMode = "value";
  selectedParentRelationshipKey = "";
  selectedTemplateId;
  templateName = "";
  loadedTemplateName = "";
  metadataError = "";
  templateStatus = "";
  isMetadataLoading = true;
  isConfigurationReady = false;
  isTemplateSaving = false;
  isTemplateDeleting = false;
  isTemplateLoading = false;
  isDeleteConfirmOpen = false;
  isUnsavedChangesConfirmOpen = false;
  isImageFilePickerOpen = false;
  isImageFileLoading = false;
  salesforceImageFiles = [];
  imageFileSearchTerm = "";
  pendingDeleteTemplateId = null;
  pendingDeleteTemplateLabel = "";
  pendingTemplateSelectionId = null;
  savedTemplateSnapshot = "";
  richTextState = {
    bold: false,
    italic: false,
    underline: false,
    unorderedList: false,
    orderedList: false,
    color: "#181818",
    fontFamily: "Arial",
    fontSize: "14",
    lineHeight: "1.25",
    textAlign: "left",
    verticalAlign: "top"
  };
  isLinkPopoverOpen = false;
  isFontMenuOpen = false;
  isFontSizeMenuOpen = false;
  isPropertyFontSizeMenuOpen = false;
  propertyFontSizeDraft = null;
  richToolbarPosition = null;
  linkAlias = "";
  linkUrl = "";
  linkError = "";
  history = [];
  future = [];

  get richTextToolbarStyle() {
    if (!this.richToolbarPosition) {
      return "";
    }

    return `left:${this.richToolbarPosition.left}px;top:${this.richToolbarPosition.top}px;transform:none;`;
  }

  connectedCallback() {
    this.loadPDFBuilderData();
  }

  get builderClass() {
    return this.isFullscreen ? "builder builder-fullscreen" : "builder";
  }

  get sidebarStyle() {
    return `width:${this.sidebarWidth}px;min-width:${this.sidebarMinWidth}px;`;
  }

  get propertiesPanelStyle() {
    return `width:${this.propertiesPanelWidth}px;min-width:${this.propertiesPanelMinWidth}px;`;
  }

  get blockShellDraggable() {
    return this.enableExistingBlockDrag && !this.enablePointerBlockMove;
  }

  get paletteItemDraggable() {
    return !this.enablePointerBlockMove;
  }

  get blockResizeHandles() {
    return [
      {
        key: "n",
        direction: "n",
        className: "block-resize-handle block-resize-handle-n"
      },
      {
        key: "s",
        direction: "s",
        className: "block-resize-handle block-resize-handle-s"
      },
      {
        key: "e",
        direction: "e",
        className: "block-resize-handle block-resize-handle-e"
      },
      {
        key: "w",
        direction: "w",
        className: "block-resize-handle block-resize-handle-w"
      },
      {
        key: "ne",
        direction: "ne",
        className: "block-resize-handle block-resize-handle-ne"
      },
      {
        key: "nw",
        direction: "nw",
        className: "block-resize-handle block-resize-handle-nw"
      },
      {
        key: "se",
        direction: "se",
        className: "block-resize-handle block-resize-handle-se"
      },
      {
        key: "sw",
        direction: "sw",
        className: "block-resize-handle block-resize-handle-sw"
      }
    ];
  }

  getBlockResizeHandles(type) {
    if (type === "divider" || type === "verticalLine") {
      return this.blockResizeHandles.filter(
        (handle) =>
          handle.direction === "n" ||
          handle.direction === "s" ||
          handle.direction === "e" ||
          handle.direction === "w"
      );
    }

    if (type === "relatedList") {
      return this.blockResizeHandles.filter(
        (handle) => handle.direction === "e" || handle.direction === "w"
      );
    }

    return this.blockResizeHandles;
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
  }

  renderedCallback() {
    if (!this.isConfigurationReady || !this.documentModel) {
      return;
    }

    if (!this.boundKeyDownHandler) {
      this.boundKeyDownHandler = this.handleBuilderKeyDown.bind(this);
      window.addEventListener("keydown", this.boundKeyDownHandler);
    }

    if (!this.boundMouseMoveHandler) {
      this.boundMouseMoveHandler = this.handleWindowMouseMove.bind(this);
      window.addEventListener("mousemove", this.boundMouseMoveHandler);
    }

    if (!this.boundMouseUpHandler) {
      this.boundMouseUpHandler = this.handleWindowMouseUp.bind(this);
      window.addEventListener("mouseup", this.boundMouseUpHandler);
    }

    if (!this.boundOutsideMouseDownHandler) {
      this.boundOutsideMouseDownHandler = this.handleWindowClick.bind(this);
      window.addEventListener("mousedown", this.boundOutsideMouseDownHandler);
    }

    if (!this.boundNativeBlockDragStartHandler) {
      this.boundNativeBlockDragStartHandler =
        this.handleNativeBlockDragStart.bind(this);
      window.addEventListener(
        "dragstart",
        this.boundNativeBlockDragStartHandler,
        true
      );
    }

    this.syncEditableText();
    this.syncPropertyControls();
    this.syncRichTextToolbar();
    this.syncObjectSelect();
    this.syncTemplateSelect();
    this.syncRelatedListSelect();
    this.syncBuilderSelects();
    this.forceBlockPositionStylesInDom();

    if (this.isPreviewOpen && !this.isPreviewGenerating) {
      this.renderPreviewFrame();
    }

    if (this.isHtmlOpen) {
      this.renderHtmlOutput();
    }

    this.applyActiveDragGridAndGuides();
  }

  syncObjectSelect() {
    const objectSelect = this.template.querySelector(
      '[data-role="object-select"]'
    );
    const objectApiName = String(this.selectedObjectApiName || "").trim();

    if (!objectSelect || objectSelect.value === objectApiName) {
      return;
    }

    const hasMatchingOption = Array.from(objectSelect.options || []).some(
      (option) => option.value === objectApiName
    );

    if (hasMatchingOption) {
      objectSelect.value = objectApiName;
    }
  }

  syncTemplateSelect() {
    const templateSelect = this.template.querySelector(
      '[data-role="template-select"]'
    );
    const templateId = String(this.selectedTemplateId || "").trim();

    if (!templateSelect || templateSelect.value === templateId) {
      return;
    }

    const hasMatchingOption = Array.from(templateSelect.options || []).some(
      (option) => option.value === templateId
    );

    if (hasMatchingOption) {
      templateSelect.value = templateId;
    }
  }

  syncRelatedListSelect() {
    const relatedListSelect = this.template.querySelector(
      '[data-role="related-list-select"]'
    );
    const relationshipName = String(this.relatedListSelectValue || "").trim();

    if (
      !relatedListSelect ||
      !relationshipName ||
      relatedListSelect.value === relationshipName
    ) {
      return;
    }

    const hasMatchingOption = Array.from(relatedListSelect.options || []).some(
      (option) => option.value === relationshipName
    );

    if (hasMatchingOption) {
      relatedListSelect.value = relationshipName;
    }
  }

  syncBuilderSelects() {
    const selectValues = [
      ["field-insert-mode-select", this.fieldInsertMode],
      ["parent-relationship-select", this.parentRelationshipSelectValue],
      ["body-layout-select", this.bodyLayoutValue]
    ];

    selectValues.forEach(([role, value]) => {
      const select = this.template.querySelector(`[data-role="${role}"]`);
      const normalizedValue = String(value || "");
      if (select && select.value !== normalizedValue) {
        select.value = normalizedValue;
      }
    });
  }

  forceBlockPositionStylesInDom() {
    const shellElements = this.template.querySelectorAll(
      ".block-shell[data-block-id]"
    );

    shellElements.forEach((shell) => {
      const blockId = shell.dataset.blockId;
      const block = this.findBlockById(blockId);

      if (!block) {
        return;
      }

      const x = this.toOptionalCoordinate(block.styles?.x);
      const paginatedY = this.toOptionalCoordinate(shell.dataset.renderY);
      const y =
        paginatedY === null
          ? this.toOptionalCoordinate(block.styles?.y)
          : paginatedY;

      if (x === null || y === null) {
        return;
      }

      shell.style.position = "absolute";
      shell.style.top = `calc(var(--region-padding, 0px) + ${y}px)`;
      shell.style.zIndex = "3";

      if (block.type === "divider") {
        shell.style.left = `calc(var(--region-padding, 0px) + ${x}px)`;
        const width = this.toOptionalNumber(block.styles?.width);
        shell.style.right = "";
        shell.style.width = Number.isFinite(width)
          ? `${width}px`
          : "calc(100% - (var(--region-padding, 0px) * 2))";
      } else {
        shell.style.left = `calc(var(--region-padding, 0px) + ${x}px)`;
        shell.style.right = "";
        const width = this.toOptionalNumber(block.styles?.width);
        if (Number.isFinite(width)) {
          shell.style.width = `${width}px`;
        } else {
          shell.style.width = "";
        }
      }
    });
  }

  disconnectedCallback() {
    if (this.boundKeyDownHandler) {
      window.removeEventListener("keydown", this.boundKeyDownHandler);
    }

    if (this.boundMouseMoveHandler) {
      window.removeEventListener("mousemove", this.boundMouseMoveHandler);
    }

    if (this.boundMouseUpHandler) {
      window.removeEventListener("mouseup", this.boundMouseUpHandler);
    }

    if (this.boundOutsideMouseDownHandler) {
      window.removeEventListener(
        "mousedown",
        this.boundOutsideMouseDownHandler
      );
    }

    if (this.boundNativeBlockDragStartHandler) {
      window.removeEventListener(
        "dragstart",
        this.boundNativeBlockDragStartHandler,
        true
      );
    }

    if (this.boundRichToolbarMouseMove) {
      window.removeEventListener(
        "mousemove",
        this.boundRichToolbarMouseMove,
        true
      );
    }

    if (this.boundRichToolbarMouseUp) {
      window.removeEventListener("mouseup", this.boundRichToolbarMouseUp, true);
    }

    if (this.previewPaginationTimer) {
      window.clearTimeout(this.previewPaginationTimer);
      this.previewPaginationTimer = null;
    }

    if (this.imageFileSearchTimer) {
      window.clearTimeout(this.imageFileSearchTimer);
      this.imageFileSearchTimer = null;
    }

    if (this.propertyFontSizeTimer) {
      window.clearTimeout(this.propertyFontSizeTimer);
      this.propertyFontSizeTimer = null;
    }

    this.previewGenerationRequestId += 1;
    this.templateLoadRequestId += 1;
    this.relatedListFieldsRequestId += 1;
  }

  handleWindowClick(event) {
    if (!this.editingTextBlockId) {
      return;
    }

    const target = event?.target;
    if (target && typeof target.closest === "function") {
      // Let block-level click/double-click handlers inside the canvas manage
      // selection/edit transitions. Closing editing here on window mousedown
      // can interrupt the next text box before its own dblclick fires.
      if (
        target.closest(".block-shell[data-block-id]") ||
        target.closest("[data-region-id]")
      ) {
        return;
      }
    }

    if (this.isEventInsideEditingContext(event)) {
      return;
    }

    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
    this.stopTextEditing();
  }

  handleNativeBlockDragStart(event) {
    if (!this.enablePointerBlockMove) {
      return;
    }

    const target = event?.target;
    if (!target || typeof target.closest !== "function") {
      return;
    }

    const blockShell = target.closest(".block-shell[data-block-id]");
    if (!blockShell) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.setPointerMoveCursor(null);
  }

  isEventInsideEditingContext(event) {
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    const richToolbar = this.template.querySelector(".rich-text-toolbar");
    const linkPopover = this.template.querySelector(".link-popover");
    const blockShell = this.template.querySelector(
      `.block-shell[data-block-id="${this.editingTextBlockId}"]`
    );

    if (this.isElementInEventPath(richToolbar, event, path)) {
      return true;
    }

    if (this.isElementInEventPath(linkPopover, event, path)) {
      return true;
    }

    if (this.isElementInEventPath(blockShell, event, path)) {
      return true;
    }

    return this.isPointInsideElement(blockShell, event);
  }

  isElementInEventPath(element, event, path) {
    if (!element) {
      return false;
    }

    return path.includes(element) || element.contains(event.target);
  }

  isPointInsideElement(element, event) {
    if (
      !element ||
      typeof event.clientX !== "number" ||
      typeof event.clientY !== "number"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  handleEditableMouseDown(event) {
    const blockShell = event.target.closest(".block-shell");

    if (!blockShell) {
      return;
    }

    blockShell.draggable = false;
    blockShell.dataset.dragLocked = "true";

    const restoreDraggable = () => {
      blockShell.draggable = true;
      delete blockShell.dataset.dragLocked;

      window.removeEventListener("mouseup", restoreDraggable);
      window.removeEventListener("blur", restoreDraggable);
    };

    window.addEventListener("mouseup", restoreDraggable);
    window.addEventListener("blur", restoreDraggable);
  }

  get pageStyle() {
    const bodyMinHeight = Math.max(160, this.getBodyContentCapacityPerPage());
    return [
      `width:${this.pageWidth}px`,
      `min-height:${this.pageHeight}px`,
      `height:${this.pageHeight}px`,
      `padding:${this.documentModel.pagePadding}px`,
      `background:${this.documentModel.pageBackground || "#ffffff"}`,
      `--body-min-height:${bodyMinHeight}px`
    ].join(";");
  }

  get pageBackgroundValue() {
    return this.documentModel.pageBackground || "#ffffff";
  }

  get header() {
    return this.documentModel.header;
  }

  get hasHeader() {
    return this.documentModel.showHeader;
  }

  get hasBody() {
    return this.documentModel.showBody;
  }

  get footer() {
    return this.documentModel.footer;
  }

  get hasFooter() {
    return this.documentModel.showFooter;
  }

  get repeatHeaderOnEachPage() {
    return Boolean(this.documentModel.repeatHeaderOnEachPage);
  }

  get repeatFooterOnEachPage() {
    return Boolean(this.documentModel.repeatFooterOnEachPage);
  }

  get bodySections() {
    return this.documentModel.body.sections;
  }

  get firstPageBodySections() {
    return this.getBuilderBodySectionsForPage(0);
  }

  get bodyClass() {
    return this.documentModel.body.layout === "two"
      ? "pdf-body two-sections"
      : "pdf-body one-section";
  }

  get bodyLayoutValue() {
    return this.documentModel.body.layout;
  }

  get previewModalStyle() {
    const previewHorizontalPadding = 120;
    const modalSafeMargin = 32;
    const modalWidth = this.pageWidth + previewHorizontalPadding;

    return `width:min(${modalWidth}px, calc(100vw - ${modalSafeMargin}px));`;
  }

  get continuationPages() {
    const overflowPageCount = this.getBodyOverflowPageCount();
    const manualPageCount = Math.max(
      0,
      this.toNumber(this.documentModel.manualPageCount || 0),
      (this.documentModel.manualPages || []).length
    );
    const totalContinuationPages = overflowPageCount + manualPageCount;
    const pages = [];
    const totalPages = 1 + totalContinuationPages;
    const canAddAnotherPage = totalPages < this.maxPages;

    for (let index = 0; index < totalContinuationPages; index += 1) {
      const pageNumber = index + 2;
      const isManualPage = pageNumber > overflowPageCount + 1;
      const manualPageIndex = pageNumber - overflowPageCount - 2;
      const manualPage = isManualPage
        ? (this.documentModel.manualPages || [])[manualPageIndex]
        : null;
      const headerBlocks = (this.header?.blocks || []).map(
        (block, blockIndex) => {
          return {
            ...block,
            renderKey: `${block.id}-repeat-h-${pageNumber}-${blockIndex}`,
            className: this.getBlockClass(block.type, false),
            shellClass: this.getBlockShellClass(false, block.type),
            shellStyle: this.buildBlockShellStyle(block.styles, block.type),
            isSelected: false
          };
        }
      );
      const footerBlocks = (this.footer?.blocks || []).map(
        (block, blockIndex) => {
          return {
            ...block,
            renderKey: `${block.id}-repeat-f-${pageNumber}-${blockIndex}`,
            className: this.getBlockClass(block.type, false),
            shellClass: this.getBlockShellClass(false, block.type),
            shellStyle: this.buildBlockShellStyle(block.styles, block.type),
            isSelected: false
          };
        }
      );
      pages.push({
        id: `continuation-${pageNumber}`,
        pageNumber,
        showHeader: this.hasHeader && this.repeatHeaderOnEachPage,
        showFooter: this.hasFooter && this.repeatFooterOnEachPage,
        header: this.header,
        footer: this.footer,
        headerBlocks,
        footerBlocks,
        bodyClass: this.bodyClass,
        bodySections:
          manualPage?.body?.sections ||
          this.getBuilderBodySectionsForPage(pageNumber - 1),
        isManualPage,
        canRemove: isManualPage && manualPageCount > 0,
        showAddButton: index === totalContinuationPages - 1 && canAddAnotherPage
      });
    }

    return pages;
  }

  get hasContinuationPages() {
    return this.continuationPages.length > 0;
  }

  get canAddPage() {
    return this.getTotalPageCount() < this.maxPages;
  }

  get showAddButtonOnFirstPage() {
    return this.canAddPage && !this.hasContinuationPages;
  }

  get pagePaddingValue() {
    return String(this.documentModel.pagePadding);
  }

  get globalPaddingValue() {
    return String(this.documentModel.globalElementPadding);
  }

  get showPageProperties() {
    return this.selectedKind === "region";
  }

  get isDeleteDisabled() {
    return !this.selectedBlockId;
  }

  get isCopyDisabled() {
    return !this.selectedBlockId || Boolean(this.editingTextBlockId);
  }

  get isPasteDisabled() {
    return !this.copiedBlock || Boolean(this.editingTextBlockId);
  }

  get isUndoDisabled() {
    return this.history.length === 0;
  }

  get isRedoDisabled() {
    return this.future.length === 0;
  }

  get selectedBlock() {
    return this.findBlockById(this.selectedBlockId);
  }

  get selectedRegion() {
    if (this.selectedKind !== "region") {
      return null;
    }

    return this.findRegionById(this.selectedRegionId);
  }

  get selectedElement() {
    return this.selectedBlock || this.selectedRegion;
  }

  get selectedPanelTitle() {
    if (this.selectedBlock) {
      const labels = {
        text: "Text selected",
        field: "Variable selected",
        image: "Image selected",
        table: "Table selected",
        relatedList: "Related list selected",
        divider: "Line selected",
        verticalLine: "Vertical line selected"
      };

      return labels[this.selectedBlock.type] || "Element selected";
    }

    if (this.selectedRegion) {
      return `${this.selectedRegion.label || "Section"} selected`;
    }

    return "Selected";
  }

  get showTextProperties() {
    return (
      this.selectedBlock?.type === "text" ||
      this.selectedBlock?.type === "field"
    );
  }

  get editingTextBlock() {
    return this.findBlockById(this.editingTextBlockId);
  }

  get showRichTextToolbar() {
    return (
      this.editingTextBlock?.type === "text" ||
      this.editingTextBlock?.type === "field" ||
      this.editingTextBlock?.type === "table"
    );
  }

  get richTextColor() {
    return (
      this.richTextState.color ||
      this.selectedElement?.styles?.color ||
      "#181818"
    );
  }

  get richTextFontFamily() {
    return this.richTextState.fontFamily || "Arial";
  }

  get fontOptions() {
    return [
      { label: "Arial", value: "Arial", style: "font-family: Arial;" },
      {
        label: "Helvetica",
        value: "Helvetica",
        style: "font-family: Helvetica;"
      },
      { label: "Verdana", value: "Verdana", style: "font-family: Verdana;" },
      { label: "Tahoma", value: "Tahoma", style: "font-family: Tahoma;" },
      {
        label: "Trebuchet MS",
        value: "Trebuchet MS",
        style: "font-family: Trebuchet MS;"
      },
      {
        label: "Times New Roman",
        value: "Times New Roman",
        style: "font-family: Times New Roman;"
      },
      { label: "Georgia", value: "Georgia", style: "font-family: Georgia;" },
      { label: "Garamond", value: "Garamond", style: "font-family: Garamond;" },
      {
        label: "Courier New",
        value: "Courier New",
        style: "font-family: Courier New;"
      },
      {
        label: "Lucida Console",
        value: "Lucida Console",
        style: "font-family: Lucida Console;"
      },
      { label: "Impact", value: "Impact", style: "font-family: Impact;" },
      {
        label: "Palatino",
        value: "Palatino Linotype",
        style: "font-family: Palatino Linotype;"
      },
      { label: "Segoe UI", value: "Segoe UI", style: "font-family: Segoe UI;" },
      { label: "Calibri", value: "Calibri", style: "font-family: Calibri;" },
      { label: "Cambria", value: "Cambria", style: "font-family: Cambria;" },
      {
        label: "Open Sans",
        value: "Open Sans",
        style: "font-family: Open Sans;"
      },
      { label: "Roboto", value: "Roboto", style: "font-family: Roboto;" },
      {
        label: "Montserrat",
        value: "Montserrat",
        style: "font-family: Montserrat;"
      },
      { label: "Lato", value: "Lato", style: "font-family: Lato;" },
      { label: "Poppins", value: "Poppins", style: "font-family: Poppins;" }
    ].map((option) => {
      return {
        ...option,
        className:
          option.value === this.richTextFontFamily
            ? "rich-font-option rich-font-option-selected"
            : "rich-font-option"
      };
    });
  }

  get richTextFontSize() {
    if (
      this.richTextState.fontSize !== undefined &&
      this.richTextState.fontSize !== null
    ) {
      return String(this.richTextState.fontSize);
    }

    return String(this.selectedElement?.styles?.fontSize || 14);
  }

  get fontSizeOptions() {
    return [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72].map(
      (size) => ({
        label: String(size),
        value: String(size)
      })
    );
  }

  get propertyFontSizeValue() {
    if (
      this.propertyFontSizeDraft?.blockId === this.selectedBlockId &&
      this.propertyFontSizeDraft?.value !== undefined
    ) {
      return String(this.propertyFontSizeDraft.value);
    }

    return String(this.selectedElement?.styles?.fontSize || 14);
  }

  get richTextLineHeight() {
    const rawValue = this.toNumber(this.richTextState.lineHeight || 1.25);
    return String(Math.max(0.25, Math.min(3, Math.round(rawValue * 4) / 4)));
  }

  get lineHeightOptions() {
    return Array.from({ length: 12 }, (_, index) => {
      const value = (index + 1) * 0.25;

      return {
        label: value.toFixed(2),
        value: String(value)
      };
    });
  }

  get richBoldButtonClass() {
    return this.richTextState.bold ? "rich-button rich-active" : "rich-button";
  }

  get richItalicButtonClass() {
    return this.richTextState.italic
      ? "rich-button rich-italic rich-active"
      : "rich-button rich-italic";
  }

  get richUnderlineButtonClass() {
    return this.richTextState.underline
      ? "rich-button rich-underlined rich-active"
      : "rich-button rich-underlined";
  }

  get richUnorderedListButtonClass() {
    return this.richTextState.unorderedList
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richOrderedListButtonClass() {
    return this.richTextState.orderedList
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richAlignLeftButtonClass() {
    return this.richTextState.textAlign === "left"
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richAlignCenterButtonClass() {
    return this.richTextState.textAlign === "center"
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richAlignRightButtonClass() {
    return this.richTextState.textAlign === "right"
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richAlignJustifyButtonClass() {
    return this.richTextState.textAlign === "justify"
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richVerticalTopButtonClass() {
    return this.richTextState.verticalAlign === "top"
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richVerticalMiddleButtonClass() {
    return this.richTextState.verticalAlign === "middle"
      ? "rich-button rich-active"
      : "rich-button";
  }

  get richVerticalBottomButtonClass() {
    return this.richTextState.verticalAlign === "bottom"
      ? "rich-button rich-active"
      : "rich-button";
  }

  get linkSaveDisabled() {
    return !this.linkAlias?.trim() || !this.linkUrl?.trim();
  }

  get showImageProperties() {
    return this.selectedBlock?.type === "image";
  }

  get showTableProperties() {
    return this.selectedBlock?.type === "table";
  }

  get showRelatedListProperties() {
    return this.selectedBlock?.type === "relatedList";
  }

  get relatedListSelectValue() {
    const relationshipName =
      this.selectedBlock?.relatedListRelationshipName || "";
    if (relationshipName) {
      return relationshipName;
    }

    const childObjectApiName =
      this.selectedBlock?.relatedListChildObjectApiName || "";
    return (
      (this.relatedListOptions || []).find(
        (option) => option.childObjectApiName === childObjectApiName
      )?.relationshipName || ""
    );
  }

  get relatedListSelectOptions() {
    const options = [...(this.relatedListOptions || [])];
    const block = this.selectedBlock;
    const relationshipName = block?.relatedListRelationshipName || "";

    if (
      relationshipName &&
      !options.some((option) => option.relationshipName === relationshipName)
    ) {
      const childObjectApiName = block?.relatedListChildObjectApiName || "";
      options.unshift({
        relationshipName,
        childObjectApiName,
        label:
          block?.relatedListLabel ||
          (childObjectApiName
            ? `${childObjectApiName} (${relationshipName})`
            : relationshipName)
      });
    }

    return options;
  }

  get selectedRelatedListObjectName() {
    const block = this.selectedBlock;
    if (!block || block.type !== "relatedList") {
      return "";
    }

    if (block.relatedListChildObjectApiName) {
      return block.relatedListChildObjectApiName;
    }

    return (
      this.relatedListSelectOptions.find(
        (option) => option.relationshipName === this.relatedListSelectValue
      )?.childObjectApiName || ""
    );
  }

  get selectedRelatedListColumns() {
    return this.selectedBlock?.relatedListColumns || [];
  }

  get hasSalesforceImageFiles() {
    return this.salesforceImageFiles.length > 0;
  }

  get salesforceImageFileItems() {
    return this.salesforceImageFiles.map((file) => ({
      ...file,
      displaySize: this.formatFileSize(file.contentSize)
    }));
  }

  get relatedListFieldOptionItems() {
    return (this.relatedListFieldOptions || []).map((field) => ({
      label: field.label,
      value: field.apiName
    }));
  }

  get showLineProperties() {
    return (
      this.selectedBlock?.type === "divider" ||
      this.selectedBlock?.type === "verticalLine"
    );
  }

  get showElementPaddingProperty() {
    return !this.showLineProperties;
  }

  get isBorderWidthDisabled() {
    return this.selectedElement?.styles?.borderStyle === "none";
  }

  get showBlockSizeProperties() {
    return Boolean(this.selectedBlock);
  }

  get selectedBlockX() {
    return this.getSelectedBlockCoordinate("x");
  }

  get selectedBlockY() {
    return this.getSelectedBlockCoordinate("y");
  }

  getSelectedBlockCoordinate(axis) {
    const coordinate = this.toOptionalCoordinate(
      this.selectedBlock?.styles?.[axis]
    );
    return coordinate === null ? "" : this.roundLayoutValue(coordinate);
  }

  get showBlockHeightProperty() {
    return Boolean(
      this.selectedBlock && this.selectedBlock.type !== "relatedList"
    );
  }

  get showRegionHeight() {
    return Boolean(
      this.selectedRegion &&
      (this.selectedRegionId === "header" || this.selectedRegionId === "footer")
    );
  }

  get selectedFixedRegionWidth() {
    if (!this.showRegionHeight) {
      return "";
    }

    const printableWidth = Math.max(
      40,
      this.pageWidth - this.toNumber(this.documentModel.pagePadding) * 2
    );
    return this.roundLayoutValue(
      this.clampNumber(
        this.toNumber(this.selectedRegion?.styles?.width ?? printableWidth),
        40,
        printableWidth
      )
    );
  }

  get showSizeProperties() {
    return this.showBlockSizeProperties || this.showRegionHeight;
  }

  get filteredFieldOptions() {
    const searchTerm = (this.fieldSearchTerm || "").trim().toLowerCase();
    const selectedObject = this.selectedObjectApiName;

    const visibleFields = !searchTerm
      ? this.fieldOptions
      : this.fieldOptions.filter((field) => {
          return (
            field.label.toLowerCase().includes(searchTerm) ||
            field.apiName.toLowerCase().includes(searchTerm)
          );
        });

    return visibleFields.map((field) => {
      const isRelated = field.apiName.includes(".");
      const relationshipKey = isRelated ? field.apiName.split(".")[0] : null;
      const fieldLabelParts = field.label.split(" > ");
      const relationshipLabel = isRelated
        ? fieldLabelParts[0] || relationshipKey
        : null;
      const parentFieldDisplayLabel = isRelated
        ? fieldLabelParts[fieldLabelParts.length - 1] || field.label
        : field.label;
      const mergeToken = selectedObject
        ? `{!${selectedObject}.${field.apiName}}`
        : `{!${field.apiName}}`;

      return {
        ...field,
        isRelated,
        relationshipKey,
        relationshipLabel,
        parentFieldDisplayLabel,
        mergeToken
      };
    });
  }

  get organizationFieldOptions() {
    const searchTerm = (this.fieldSearchTerm || "").trim().toLowerCase();
    const options = [
      {
        label: "Organization Name",
        apiName: "$Organization.Name",
        token: "{!$Organization.Name}"
      },
      {
        label: "Primary Contact",
        apiName: "$Organization.PrimaryContact",
        token: "{!$Organization.PrimaryContact}"
      },
      {
        label: "Division",
        apiName: "$Organization.Division",
        token: "{!$Organization.Division}"
      },
      {
        label: "Phone",
        apiName: "$Organization.Phone",
        token: "{!$Organization.Phone}"
      },
      {
        label: "Fax",
        apiName: "$Organization.Fax",
        token: "{!$Organization.Fax}"
      },
      {
        label: "Address",
        apiName: "$Organization.Address",
        token: "{!$Organization.Address}"
      },
      { label: "Current User", apiName: "$User.Name", token: "{!$User.Name}" }
    ];

    const visibleOptions = !searchTerm
      ? options
      : options.filter((field) => {
          return (
            field.label.toLowerCase().includes(searchTerm) ||
            field.apiName.toLowerCase().includes(searchTerm) ||
            field.token.toLowerCase().includes(searchTerm)
          );
        });

    return visibleOptions.map((field) => ({
      ...field,
      mergeToken: field.token,
      isOrganization: true
    }));
  }

  get hasOrganizationFields() {
    return this.organizationFieldOptions.length > 0;
  }

  get hasFields() {
    return this.baseFieldOptions.length > 0;
  }

  get baseFieldOptions() {
    return this.filteredFieldOptions.filter((field) => !field.isRelated);
  }

  get parentFieldGroups() {
    const groupsMap = new Map();

    this.filteredFieldOptions
      .filter((field) => field.isRelated)
      .forEach((field) => {
        const key = field.relationshipKey || "parent";
        const group = groupsMap.get(key) || {
          key,
          label: field.relationshipLabel || key,
          fields: []
        };

        group.fields = [...group.fields, field];
        groupsMap.set(key, group);
      });

    return Array.from(groupsMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );
  }

  get hasParentFieldGroups() {
    return this.parentFieldGroups.length > 0;
  }

  get parentObjectGroups() {
    const groupsMap = new Map();

    this.parentFieldGroups.forEach((group) => {
      const objectLabel = group.label || group.key;
      const existing = groupsMap.get(objectLabel) || {
        label: objectLabel,
        value: objectLabel,
        relationshipKeys: new Set()
      };

      existing.relationshipKeys.add(group.key);
      groupsMap.set(objectLabel, existing);
    });

    return Array.from(groupsMap.values())
      .map((group) => ({
        label: group.label,
        value: group.value,
        relationshipKeys: Array.from(group.relationshipKeys)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  get parentRelationshipOptions() {
    return this.parentObjectGroups.map((group) => ({
      label: group.label,
      value: group.value
    }));
  }

  get parentRelationshipSelectValue() {
    if (!this.selectedParentRelationshipKey) {
      return "";
    }

    const exists = this.parentObjectGroups.some(
      (group) => group.value === this.selectedParentRelationshipKey
    );
    return exists ? this.selectedParentRelationshipKey : "";
  }

  get selectedParentRelationshipLabel() {
    const selectedGroup = this.parentObjectGroups.find(
      (group) => group.value === this.parentRelationshipSelectValue
    );

    return selectedGroup?.label || "";
  }

  get displayedParentFieldOptions() {
    const selectedKey = this.parentRelationshipSelectValue;

    if (!selectedKey) {
      return [];
    }

    const selectedGroup = this.parentObjectGroups.find(
      (group) => group.value === selectedKey
    );

    if (!selectedGroup) {
      return [];
    }

    const allowedKeys = new Set(selectedGroup.relationshipKeys);

    return this.filteredFieldOptions
      .filter(
        (field) => field.isRelated && allowedKeys.has(field.relationshipKey)
      )
      .sort((a, b) => {
        const byLabel = (a.parentFieldDisplayLabel || "").localeCompare(
          b.parentFieldDisplayLabel || ""
        );

        if (byLabel !== 0) {
          return byLabel;
        }

        return (a.apiName || "").localeCompare(b.apiName || "");
      });
  }

  get hasDisplayedParentFields() {
    return this.displayedParentFieldOptions.length > 0;
  }

  get templateSelectValue() {
    return this.selectedTemplateId || "";
  }

  get isSaveTemplateDisabled() {
    return this.isTemplateBusy;
  }

  get isDeleteTemplateDisabled() {
    return this.isTemplateBusy || !this.selectedTemplateId;
  }

  get isTemplateBusy() {
    return (
      this.isTemplateSaving || this.isTemplateDeleting || this.isTemplateLoading
    );
  }

  get templateBusyLabel() {
    if (this.isTemplateDeleting) {
      return "Deleting template…";
    }
    if (this.isTemplateLoading) {
      return "Loading template…";
    }
    return "Saving template…";
  }

  get isLoadTemplateDisabled() {
    return !this.selectedTemplateId;
  }

  async loadPDFBuilderData() {
    this.isMetadataLoading = true;
    this.metadataError = "";

    try {
      const configuration = await getConfiguration();
      this.applyConfiguration(configuration);
      this.isConfigurationReady = true;

      const [objects, templates] = await Promise.all([
        getObjects(),
        getTemplates()
      ]);
      this.objectOptions = objects || [];
      this.templateOptions = formatTemplateOptions(templates);

      await Promise.all([
        this.loadFieldsForSelectedObject(),
        this.loadRelatedListsForSelectedObject()
      ]);
      this.markTemplateEditorSaved();
    } catch (error) {
      this.metadataError = this.getUserFacingErrorMessage(error);
      this.showToast(
        "PDF Builder could not be loaded",
        this.metadataError,
        "error"
      );
    } finally {
      this.isMetadataLoading = false;
    }
  }

  applyConfiguration(configuration = {}) {
    const shouldRefreshEmptyDocument = this.isEmptyUnsavedDocument();
    const resolved = resolveBuilderConfiguration(configuration);
    Object.assign(this, resolved);

    if (!this.documentModel || shouldRefreshEmptyDocument) {
      this.documentModel = this.createDefaultDocument();
    }
  }

  isEmptyUnsavedDocument() {
    if (this.selectedTemplateId || this.templateName || !this.documentModel) {
      return false;
    }

    const regions = [
      this.documentModel.header,
      ...(this.documentModel.body?.sections || []),
      this.documentModel.footer
    ].filter(Boolean);

    return regions.every((region) => (region.blocks || []).length === 0);
  }

  async loadFieldsForSelectedObject() {
    const objectApiName = this.selectedObjectApiName;
    if (!objectApiName) {
      this.fieldOptions = [];
      return;
    }

    const fields = await getFields({
      objectApiName,
      searchTerm: ""
    });
    if (this.selectedObjectApiName === objectApiName) {
      this.fieldOptions = fields || [];
    }
  }

  async loadRelatedListsForSelectedObject() {
    const objectApiName = this.selectedObjectApiName;
    if (!objectApiName) {
      this.relatedListOptions = [];
      this.relatedListFieldOptions = [];
      this.relatedListFieldsRequestId += 1;
      return;
    }

    const relatedLists = await getRelatedLists({
      objectApiName
    });
    if (this.selectedObjectApiName === objectApiName) {
      this.relatedListOptions = relatedLists || [];
      this.relatedListFieldOptions = [];
      this.relatedListFieldsRequestId += 1;
    }
  }

  async loadRelatedListFieldsForChildObject(childObjectApiName) {
    const requestId = ++this.relatedListFieldsRequestId;
    if (!childObjectApiName) {
      this.relatedListFieldOptions = [];
      return;
    }

    const fields = await getRelatedListFields({
      childObjectApiName,
      searchTerm: ""
    });
    if (requestId === this.relatedListFieldsRequestId) {
      this.relatedListFieldOptions = fields || [];
    }
  }

  handleObjectChange(event) {
    this.selectedObjectApiName = event.target.value;
    this.fieldSearchTerm = "";
    this.selectedParentRelationshipKey = "";
    Promise.all([
      this.loadFieldsForSelectedObject(),
      this.loadRelatedListsForSelectedObject()
    ]).catch((error) => {
      this.metadataError = "";
      this.showToast(
        "Object metadata could not be loaded",
        this.getUserFacingErrorMessage(error),
        "error"
      );
    });
  }

  handleFieldSearchChange(event) {
    this.fieldSearchTerm = event.target.value;
  }

  handleFieldInsertModeChange(event) {
    const mode = event.target.value;
    this.fieldInsertMode =
      mode === "labelAndValue" || mode === "labelOnly" ? mode : "value";
  }

  handleParentRelationshipChange(event) {
    this.selectedParentRelationshipKey = event.target.value || "";
  }

  handleTemplateNameChange(event) {
    this.templateName = event.target.value;
  }

  handleTemplateSelect(event) {
    const templateId = event.target.value || null;
    const currentTemplateId = this.selectedTemplateId || null;

    event.target.value = currentTemplateId || "";

    if (templateId === currentTemplateId) {
      return;
    }

    if (this.hasUnsavedTemplateChanges()) {
      this.pendingTemplateSelectionId = templateId;
      this.isUnsavedChangesConfirmOpen = true;
      return;
    }

    this.applyTemplateSelection(templateId);
  }

  applyTemplateSelection(templateId) {
    this.selectedTemplateId = templateId;
    this.syncTemplateSelect();

    if (!templateId) {
      this.resetTemplateEditor();
      return;
    }

    this.loadSelectedTemplate(templateId);
  }

  handleCancelUnsavedTemplateChanges() {
    this.closeUnsavedChangesConfirmation();
  }

  handleDiscardUnsavedTemplateChanges() {
    const templateId = this.pendingTemplateSelectionId;
    this.closeUnsavedChangesConfirmation();
    this.applyTemplateSelection(templateId);
  }

  async handleSaveUnsavedTemplateChanges() {
    if (this.isTemplateBusy) {
      return;
    }

    const templateId = this.pendingTemplateSelectionId;
    const wasSaved = await this.handleSaveTemplate();
    if (!wasSaved) {
      return;
    }

    this.closeUnsavedChangesConfirmation();
    this.applyTemplateSelection(templateId);
  }

  closeUnsavedChangesConfirmation() {
    this.isUnsavedChangesConfirmOpen = false;
    this.pendingTemplateSelectionId = null;
  }

  get unsavedChangesTemplateLabel() {
    return (
      String(this.templateName || this.loadedTemplateName || "").trim() ||
      "Untitled template"
    );
  }

  get canSaveUnsavedTemplateChanges() {
    return Boolean(
      String(this.templateName || "").trim() &&
      String(this.selectedObjectApiName || "").trim()
    );
  }

  get unsavedChangesCannotSaveReason() {
    const isTemplateNameMissing = !String(this.templateName || "").trim();
    const isObjectMissing = !String(this.selectedObjectApiName || "").trim();

    if (isTemplateNameMissing && isObjectMissing) {
      return "it has no template name and no selected object";
    }
    if (isTemplateNameMissing) {
      return "it has no template name";
    }
    return "it has no selected object";
  }

  get unsavedDiscardButtonLabel() {
    return this.canSaveUnsavedTemplateChanges
      ? "Don’t save"
      : "Leave without saving";
  }

  get unsavedChangesDialogTitle() {
    return this.canSaveUnsavedTemplateChanges
      ? "Save changes?"
      : "Leave without saving?";
  }

  resetTemplateEditor() {
    this.stopTextEditing();
    this.closeLinkPopover();
    this.resetSelectedObjectContext();
    this.templateName = "";
    this.loadedTemplateName = "";
    this.templateStatus = "";
    this.htmlOutput = "";
    this.previewHtml = "";
    this.history = [];
    this.future = [];
    this.documentModel = null;
    this.documentModel = this.createDefaultDocument();
    this.clearSelection();
    this.markTemplateEditorSaved();
    Promise.resolve().then(() => this.syncTemplateSelect());
  }

  resetSelectedObjectContext() {
    this.selectedObjectApiName = "";
    this.fieldSearchTerm = "";
    this.selectedParentRelationshipKey = "";
    this.fieldOptions = [];
    this.relatedListOptions = [];
    this.relatedListFieldOptions = [];
    this.relatedListFieldsRequestId += 1;
  }

  async handleSaveTemplate() {
    if (this.isTemplateBusy) {
      return false;
    }

    const normalizedTemplateName = String(this.templateName || "").trim();
    const objectApiName = this.getSelectedObjectApiName();
    const isTemplateNameMissing = !normalizedTemplateName;
    const isObjectMissing = !objectApiName;

    if (isTemplateNameMissing || isObjectMissing) {
      let message = "";
      if (isTemplateNameMissing && isObjectMissing) {
        message = "Enter a template name and select an object.";
      } else if (isTemplateNameMissing) {
        message = "Enter a template name before saving the template.";
      } else {
        message = "Select an object before saving the template.";
      }

      this.templateStatus = "";
      this.showToast("Template not saved", message, "error");
      return false;
    }

    this.isTemplateSaving = true;
    this.templateStatus = "";

    try {
      await this.persistEmbeddedTemplateImages();

      const contentJson = JSON.stringify(
        sanitizeDocumentModel(this.stripRuntimeState(this.documentModel))
      );
      const generatedHtml = this.getGeneratedHtml();

      if (
        contentJson.length > this.longTextLimit ||
        generatedHtml.length > this.longTextLimit
      ) {
        this.templateStatus = "";
        this.showToast(
          "Template not saved",
          `Template is too large to save. JSON: ${contentJson.length}, HTML: ${generatedHtml.length}, max: ${this.longTextLimit}.`,
          "error"
        );
        return false;
      }

      const normalizedLoadedName = String(this.loadedTemplateName || "").trim();
      const isSaveAs = Boolean(
        this.selectedTemplateId &&
        normalizedLoadedName &&
        normalizedTemplateName !== normalizedLoadedName
      );
      const templateId = await saveTemplate({
        templateId: isSaveAs ? null : this.selectedTemplateId || null,
        name: normalizedTemplateName,
        objectApiName,
        contentJson,
        generatedHtml
      });

      this.selectedTemplateId = templateId;
      this.templateName = normalizedTemplateName;
      this.loadedTemplateName = normalizedTemplateName;
      this.templateStatus = "Template saved";
      this.markTemplateEditorSaved();

      try {
        this.templateOptions = formatTemplateOptions(await getTemplates());
      } catch {
        this.showToast(
          "Template saved",
          "The template was saved, but the template list could not be refreshed.",
          "warning"
        );
      }
      return true;
    } catch (error) {
      const message = this.getUserFacingErrorMessage(error);
      this.templateStatus = "";
      this.showToast("Template could not be saved", message, "error");
      return false;
    } finally {
      this.isTemplateSaving = false;
    }
  }

  handleDeleteTemplate() {
    const templateId = this.selectedTemplateId;
    if (!templateId || this.isTemplateBusy) {
      return;
    }

    const selectedTemplate = this.templateOptions.find(
      (template) => template.id === templateId
    );
    this.pendingDeleteTemplateId = templateId;
    this.pendingDeleteTemplateLabel =
      selectedTemplate?.name || this.loadedTemplateName || this.templateName;
    this.isDeleteConfirmOpen = true;
  }

  handleCancelDeleteTemplate() {
    this.isDeleteConfirmOpen = false;
    this.pendingDeleteTemplateId = null;
    this.pendingDeleteTemplateLabel = "";
  }

  async handleConfirmDeleteTemplate() {
    const templateId = this.pendingDeleteTemplateId;
    const templateLabel = this.pendingDeleteTemplateLabel;
    if (!templateId || this.isTemplateBusy) {
      return;
    }

    this.isDeleteConfirmOpen = false;
    this.isTemplateDeleting = true;
    this.templateStatus = "";

    try {
      await deleteTemplate({ templateId });
      this.selectedTemplateId = null;
      this.resetTemplateEditor();
      this.templateOptions = formatTemplateOptions(await getTemplates());
      this.templateStatus = "Template deleted";
      this.showToast(
        "Template deleted",
        `“${templateLabel}” was deleted.`,
        "success"
      );
    } catch (error) {
      this.templateStatus = "";
      this.showToast(
        "Template could not be deleted",
        this.getUserFacingErrorMessage(error),
        "error"
      );
    } finally {
      this.isTemplateDeleting = false;
      this.pendingDeleteTemplateId = null;
      this.pendingDeleteTemplateLabel = "";
    }
  }

  async handleLoadTemplate() {
    await this.loadSelectedTemplate(this.selectedTemplateId);
  }

  async loadSelectedTemplate(templateId) {
    if (!templateId) {
      return;
    }

    const requestId = ++this.templateLoadRequestId;
    this.isTemplateLoading = true;
    this.templateStatus = "";

    try {
      const template = await getTemplate({ templateId });

      if (
        requestId !== this.templateLoadRequestId ||
        this.selectedTemplateId !== templateId
      ) {
        return;
      }

      const content = sanitizeDocumentModel(
        template.contentJson ? JSON.parse(template.contentJson) : null
      );

      this.saveHistory();
      this.templateName = template.name || "";
      this.loadedTemplateName = template.name || "";
      this.selectedObjectApiName =
        template.objectApiName || this.selectedObjectApiName;
      this.documentModel = this.decorateDocument(this.restoreDocument(content));
      this.clearSelection();
      await Promise.all([
        this.loadFieldsForSelectedObject(),
        this.loadRelatedListsForSelectedObject()
      ]);
      if (
        requestId !== this.templateLoadRequestId ||
        this.selectedTemplateId !== templateId
      ) {
        return;
      }
      this.templateStatus = "Template loaded";
      this.markTemplateEditorSaved();
    } catch (error) {
      if (requestId === this.templateLoadRequestId) {
        this.templateStatus = "";
        this.showToast(
          "Template could not be loaded",
          this.getUserFacingErrorMessage(error),
          "error"
        );
      }
    } finally {
      if (requestId === this.templateLoadRequestId) {
        this.isTemplateLoading = false;
      }
    }
  }

  getSelectedObjectApiName() {
    const objectSelect = this.template.querySelector(
      '[data-role="object-select"]'
    );

    return objectSelect?.value || this.selectedObjectApiName || "";
  }

  getTemplateEditorSnapshot() {
    if (!this.documentModel) {
      return "";
    }

    return JSON.stringify({
      templateName: String(this.templateName || ""),
      objectApiName: String(this.selectedObjectApiName || ""),
      documentModel: this.stripRuntimeState(this.documentModel)
    });
  }

  markTemplateEditorSaved() {
    this.savedTemplateSnapshot = this.getTemplateEditorSnapshot();
  }

  hasUnsavedTemplateChanges() {
    const currentSnapshot = this.getTemplateEditorSnapshot();
    return Boolean(
      this.savedTemplateSnapshot &&
      currentSnapshot &&
      currentSnapshot !== this.savedTemplateSnapshot
    );
  }

  saveHistory() {
    const snapshot = JSON.stringify(this.stripRuntimeState(this.documentModel));

    if (this.history[this.history.length - 1] === snapshot) {
      return;
    }

    this.history = [...this.history.slice(-49), snapshot];
    this.future = [];
  }

  undo() {
    if (this.history.length === 0) {
      return;
    }

    const currentSnapshot = JSON.stringify(
      this.stripRuntimeState(this.documentModel)
    );
    const previousSnapshot = this.history[this.history.length - 1];

    this.future = [currentSnapshot, ...this.future];
    this.history = this.history.slice(0, -1);
    this.documentModel = this.decorateDocument(JSON.parse(previousSnapshot));
    this.clearSelection();
  }

  redo() {
    if (this.future.length === 0) {
      return;
    }

    const currentSnapshot = JSON.stringify(
      this.stripRuntimeState(this.documentModel)
    );
    const nextSnapshot = this.future[0];

    this.history = [...this.history, currentSnapshot];
    this.future = this.future.slice(1);
    this.documentModel = this.decorateDocument(JSON.parse(nextSnapshot));
    this.clearSelection();
  }

  clearSelection() {
    this.selectedBlockId = null;
    this.selectedRegionId = "body-1";
    this.selectedKind = "region";
    this.documentModel = this.decorateDocument(this.documentModel);
  }

  handleBuilderKeyDown(event) {
    if (
      this.editingTextBlockId ||
      this.isInteractiveKeyboardTarget(event.target)
    ) {
      return;
    }

    const key = event.key?.toLowerCase();
    const isModifierPressed = event.ctrlKey || event.metaKey;

    if (isModifierPressed && key === "c") {
      if (!this.selectedBlockId) {
        return;
      }

      event.preventDefault();
      this.copySelectedBlock();
      return;
    }

    if (isModifierPressed && key === "v") {
      if (!this.copiedBlock) {
        return;
      }

      event.preventDefault();
      this.pasteCopiedBlock();
      return;
    }

    if (isModifierPressed && key === "d") {
      if (!this.selectedBlockId) {
        return;
      }

      event.preventDefault();
      this.copySelectedBlock();
      this.pasteCopiedBlock();
      return;
    }

    if (event.key !== "Delete" && event.key !== "Backspace") {
      return;
    }

    if (!this.selectedBlockId) {
      return;
    }

    event.preventDefault();
    this.deleteSelectedBlock();
  }

  handlePropertiesPanelKeyDown(event) {
    if (!this.isInteractiveKeyboardTarget(event.target)) {
      return;
    }

    event.stopPropagation();
  }

  isInteractiveKeyboardTarget(target) {
    if (!target) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    const interactiveSelector =
      'input, textarea, select, button, [contenteditable="true"]';
    if (
      typeof target.closest === "function" &&
      target.closest(interactiveSelector)
    ) {
      return true;
    }

    const tagName = target.tagName;
    return (
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT" ||
      tagName === "BUTTON"
    );
  }

  handleDragStart(event) {
    if (this.enablePointerBlockMove) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.draggedType = event.currentTarget.dataset.type;
    this.draggedField = null;
    this.draggedBlockId = null;
    this.draggedBlockRegionId = null;

    event.dataTransfer.setData("text/plain", this.draggedType);
    event.dataTransfer.setData(
      "application/x-pdf-builder-type",
      this.draggedType
    );
    event.dataTransfer.effectAllowed = "copy";
    this.applyTransparentDragImage(event);
    this.setPointerMoveCursor("copy");
  }

  handleFieldDragStart(event) {
    if (this.enablePointerBlockMove) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const fieldApiName = event.currentTarget.dataset.fieldApiName;
    const field = this.getFieldOptionByApiName(fieldApiName);

    this.draggedType = "field";
    this.draggedField = field || null;
    this.draggedBlockId = null;
    this.draggedBlockRegionId = null;

    event.dataTransfer.setData("text/plain", "field");
    event.dataTransfer.setData("application/x-pdf-builder-type", "field");
    if (fieldApiName) {
      event.dataTransfer.setData(
        "application/x-pdf-builder-field",
        fieldApiName
      );
    }
    event.dataTransfer.effectAllowed = "copy";
    this.applyTransparentDragImage(event);
    this.setPointerMoveCursor("copy");
  }

  handlePaletteToolMouseDown(event) {
    if (!this.enablePointerBlockMove || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.paletteDragState = {
      type: event.currentTarget.dataset.type,
      field: null,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      moved: false
    };
  }

  handlePaletteFieldMouseDown(event) {
    if (!this.enablePointerBlockMove || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const fieldApiName = event.currentTarget.dataset.fieldApiName;
    this.paletteDragState = {
      type: "field",
      field: this.getFieldOptionByApiName(fieldApiName),
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      moved: false
    };
  }

  handleFieldInsertMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  handleFieldInsert(event) {
    event.preventDefault();
    event.stopPropagation();

    const fieldApiName = event.currentTarget.dataset.fieldApiName;
    const field = this.getFieldOptionByApiName(fieldApiName);
    const variableText = this.getFieldVariableText(field, this.fieldInsertMode);

    if (!variableText) {
      return;
    }

    const selectedBlockType = this.selectedBlock?.type;
    if (!["text", "field", "table"].includes(selectedBlockType)) {
      this.showToast(
        "Variable not inserted",
        "Select a text or table block before inserting a variable.",
        "warning"
      );
      return;
    }

    const blockComponent = this.getSelectedBlockComponent();
    if (!blockComponent) {
      this.showToast(
        "Variable not inserted",
        "Select a text or table block before inserting a variable.",
        "warning"
      );
      return;
    }

    this.saveHistory();
    blockComponent.insertVariable(variableText);
  }

  getFieldVariableText(field, mode = "value") {
    if (!field?.apiName) {
      return "";
    }

    const variable = field.token
      ? field.token
      : this.selectedObjectApiName
        ? `{!${this.selectedObjectApiName}.${field.apiName}}`
        : `{!${field.apiName}}`;

    const rawLabel = field?.label || field.apiName;
    const labelParts = String(rawLabel).split(" > ");
    const label = labelParts[labelParts.length - 1] || rawLabel;

    if (mode === "labelOnly") {
      return label;
    }

    if (mode !== "labelAndValue") {
      return variable;
    }

    return `${label}:\u00A0${variable}`;
  }

  handleCanvasBlockMouseDown(event) {
    if (event?.target?.closest?.(".block-resize-handle")) {
      return;
    }

    if (!this.enablePointerBlockMove) {
      // Rollback to stable interaction model:
      // use native HTML5 dragstart/dragover/drop only.
      // Prevent creation of blockMoveState that can override drop position.
      return;
    }

    // Pointer move must react on first attempt after a drop.
    // Clear transient suppression windows here.
    this.suppressMouseUpUntil = 0;
    this.suppressBlockMoveUntil = 0;
    this.lastNativeDropAt = 0;

    if (event.button !== 0 || this.resizeState) {
      return;
    }

    const blockId = event.currentTarget.dataset.blockId;
    const regionId = event.currentTarget.dataset.regionId;
    const block = this.findBlockById(blockId);
    const pointerDownAt = Date.now();
    const isTextBlock = block?.type === "text" || block?.type === "field";
    const isSecondTextPointerDown = Boolean(
      isTextBlock &&
      this.lastTextPointerDownBlockId === blockId &&
      pointerDownAt - this.lastTextPointerDownAt <= 650
    );

    if (isSecondTextPointerDown) {
      this.lastTextPointerDownBlockId = null;
      this.lastTextPointerDownAt = 0;
      event.preventDefault();
      event.stopPropagation();

      if (this.editingTextBlockId && this.editingTextBlockId !== blockId) {
        this.stopTextEditing();
      }

      this.selectedKind = "block";
      this.selectedBlockId = blockId;
      this.selectedRegionId = regionId;
      this.documentModel = this.decorateDocument(this.documentModel);

      const pointer = {
        clientX: event.clientX,
        clientY: event.clientY
      };

      requestAnimationFrame(() => {
        this.getBlockComponentById(blockId)?.startTextEditing?.(pointer);
      });
      return;
    }

    this.lastTextPointerDownBlockId = isTextBlock ? blockId : null;
    this.lastTextPointerDownAt = isTextBlock ? pointerDownAt : 0;

    // When a native HTML5 drag/drop is in progress (palette -> canvas or
    // block -> region), some browsers can still emit mousedown on the
    // underlying block element near drop time. If we create a new
    // blockMoveState here, mouseup can re-finalize and override drop coords.
    if (this.draggedType || this.draggedBlockId) {
      return;
    }

    // The second press of a double click belongs to text editing. Starting
    // a pointer move here calls preventDefault(), which can stop the cloned
    // contenteditable from receiving focus/caret.
    if (
      event.detail >= 2 &&
      (block?.type === "text" || block?.type === "field")
    ) {
      return;
    }

    if (this.editingTextBlockId && this.editingTextBlockId === blockId) {
      return;
    }

    const blockShellElement = event.currentTarget;
    const regionElement =
      blockShellElement.closest(".pdf-region") ||
      this.getRegionElementById(regionId);

    if (
      !blockId ||
      !regionId ||
      !block ||
      !regionElement ||
      !blockShellElement
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const metrics = this.getRegionContentMetrics(regionId, regionElement);
    const blockRect = blockShellElement.getBoundingClientRect();
    const renderedLeft = Number.parseFloat(blockShellElement.style.left);
    const renderedTop = Number.parseFloat(blockShellElement.style.top);
    const offsetLeft = Number.isFinite(blockShellElement.offsetLeft)
      ? blockShellElement.offsetLeft
      : null;
    const offsetTop = Number.isFinite(blockShellElement.offsetTop)
      ? blockShellElement.offsetTop
      : null;
    const fallbackX =
      block.type === "divider"
        ? 0
        : Number.isFinite(offsetLeft)
          ? offsetLeft - metrics.paddingLeft
          : blockRect.left - metrics.rect.left - metrics.paddingLeft;
    const fallbackY = Number.isFinite(offsetTop)
      ? offsetTop - metrics.paddingTop
      : blockRect.top - metrics.rect.top - metrics.paddingTop;
    const measuredWidth = Math.max(1, Math.ceil(blockRect.width));
    const measuredHeight = Math.max(1, Math.ceil(blockRect.height));
    const maxInitialX = Math.max(0, metrics.availableWidth - measuredWidth);
    const maxInitialY = Math.max(0, metrics.availableHeight - measuredHeight);
    const initialX = this.clampNumber(
      Number.isFinite(renderedLeft)
        ? renderedLeft
        : this.toOptionalCoordinate(block.styles?.x) !== null
          ? this.toNumber(block.styles?.x)
          : fallbackX,
      0,
      maxInitialX
    );
    const initialY = this.clampNumber(
      Number.isFinite(renderedTop)
        ? renderedTop
        : this.toOptionalCoordinate(block.styles?.y) !== null
          ? this.toNumber(block.styles?.y)
          : fallbackY,
      0,
      maxInitialY
    );

    this.draggedType = null;
    this.draggedField = null;
    this.draggedBlockId = null;
    this.draggedBlockRegionId = null;
    this.selectedKind = "block";
    this.selectedBlockId = blockId;
    this.selectedRegionId = regionId;
    this.blockMoveState = {
      blockId,
      regionId,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      offsetX: event.clientX - blockRect.left,
      offsetY: event.clientY - blockRect.top,
      blockElement: blockShellElement,
      regionElement,
      startedFromRepeatedPage: blockShellElement.dataset.repeated === "true",
      initialX,
      initialY,
      moved: false,
      historySaved: false
    };

    blockShellElement.classList.add("is-positioning");
    this.showDragGrid(regionId, regionElement);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  handleCanvasBlockShellClick(event) {
    event.stopPropagation();

    const blockId = event.currentTarget?.dataset?.blockId;
    const regionId = event.currentTarget?.dataset?.regionId;

    if (!blockId || !this.findBlockById(blockId)) {
      return;
    }

    this.selectedKind = "block";
    this.selectedBlockId = blockId;
    this.selectedRegionId = regionId || null;
    this.documentModel = this.decorateDocument(this.documentModel);
    this.syncRelatedListFieldsForSelectedBlock();
  }

  handleCanvasBlockDragStart(event) {
    if (this.enablePointerBlockMove) {
      // Existing blocks are moved with pointer-based drag, not native
      // HTML5 drag/drop. Prevent any residual first native dragstart
      // from showing the browser ghost cursor/image.
      event.preventDefault();
      event.stopPropagation();
      this.setPointerMoveCursor(null);
      return;
    }

    // If user is explicitly starting a new drag, clear residual suppression
    // from the previous drop so first attempt is responsive.
    this.suppressMouseUpUntil = 0;
    this.suppressBlockMoveUntil = 0;

    if (!this.enableExistingBlockDrag) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Do not suppress native dragstart after drop; previous suppression was
    // causing "first drag after drop" to fail.

    const blockId = event.currentTarget.dataset.blockId;
    const isEditingThisBlock =
      this.editingTextBlockId && this.editingTextBlockId === blockId;
    const isInteractiveTarget = this.isInteractiveKeyboardTarget(event.target);

    if (
      event.currentTarget.dataset.dragLocked === "true" ||
      (isEditingThisBlock && isInteractiveTarget)
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const regionId = event.currentTarget.dataset.regionId;

    if (!blockId || !regionId) {
      event.preventDefault();
      return;
    }

    this.draggedType = null;
    this.draggedField = null;
    this.draggedBlockId = blockId;
    this.draggedBlockRegionId = regionId;
    this.dragHistorySaved = false;
    this.lastDragOverKey = "";
    this.selectedKind = "block";
    this.selectedBlockId = blockId;
    this.selectedRegionId = regionId;

    event.currentTarget.classList.add("is-dragging");
    event.dataTransfer.setData("text/plain", blockId);
    event.dataTransfer.setData("application/x-pdf-builder-block", blockId);
    event.dataTransfer.effectAllowed = "move";
    this.applyTransparentDragImage(event);
  }

  applyTransparentDragImage(event) {
    try {
      if (!event?.dataTransfer?.setDragImage) {
        return;
      }

      if (!this.transparentDragImage) {
        const image = document.createElement("img");
        image.alt = "";
        image.width = 1;
        image.height = 1;
        image.src =
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
        this.transparentDragImage = image;
      }

      event.dataTransfer.setDragImage(this.transparentDragImage, 0, 0);
    } catch {
      // Ignore browser state that became stale during the interaction.
    }
  }

  handleDragEnd() {
    this.setPointerMoveCursor(null);
    this.resetDragTransientState();
    this.template
      .querySelectorAll(".block-shell.is-dragging")
      .forEach((element) => {
        element.classList.remove("is-dragging");
      });
    this.hideDragGrid();
  }

  resetDragTransientState() {
    this.draggedType = null;
    this.draggedField = null;
    this.draggedBlockId = null;
    this.draggedBlockRegionId = null;
    this.paletteDragState = null;
    this.dragHistorySaved = false;
    this.lastDragOverKey = "";
    this.blockMoveState = null;
    this.lastKnownDropPointer = null;
  }

  handleDragOver(event) {
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.draggedType ? "copy" : "move";
    }

    if (this.draggedType || this.draggedBlockId) {
      this.setPointerMoveCursor(this.draggedType ? "copy" : "grabbing");
    }

    const regionId = event.currentTarget?.dataset?.regionId;
    this.captureDropPointer(event, regionId);

    if (
      regionId &&
      (this.draggedType || this.draggedBlockId || this.blockMoveState)
    ) {
      this.showDragGrid(regionId);
    }

    if (regionId && this.draggedType) {
      this.updateNewBlockDropGuides(regionId, event);
    } else if (regionId && this.draggedBlockId) {
      this.updateExistingBlockDropGuides(regionId, event);
    }

    // Do not mutate the document while the native drag is still active.
    // Re-rendering the dragged shell during dragover makes LWC cancel or
    // destabilize the gesture. We commit the reorder on drop instead.
  }

  handleRegionDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const draggedType = this.getDraggedType(event);
    if (!this.draggedType && draggedType) {
      this.draggedType = draggedType;
    }
    if (this.draggedType === "field" && !this.draggedField) {
      this.draggedField = this.getDraggedField(event);
    }

    const draggedBlockId = this.getDraggedBlockId(event);

    if (!this.draggedType && !draggedBlockId) {
      return;
    }

    const regionId = event.currentTarget.dataset.regionId;
    const dropEvent = this.getDropEventWithPointer(event, regionId);

    if (draggedBlockId) {
      this.moveDraggedBlockOnDrop(draggedBlockId, regionId, dropEvent);
    } else {
      this.saveHistory();
      const positionedBlock = this.createPositionedBlockForDrop(
        regionId,
        dropEvent
      );
      const region = this.findRegionById(regionId);
      const insertIndex = region?.blocks?.length || 0;
      this.selectedKind = "block";
      this.selectedBlockId = positionedBlock.id;
      this.selectedRegionId = regionId;

      const nextModel = this.insertBlockIntoRegionAtIndex(
        this.documentModel,
        regionId,
        positionedBlock,
        insertIndex
      );
      this.documentModel = this.decorateDocument(nextModel);
      this.enforceDroppedBlockGeometry(
        positionedBlock.id,
        regionId,
        positionedBlock.styles || {}
      );
    }

    this.lastNativeDropAt = Date.now();
    this.resetDragTransientState();
    this.template
      .querySelectorAll(".block-shell.is-positioning")
      .forEach((element) => {
        element.classList.remove("is-positioning");
        element.style.transform = "";
      });
    this.suppressMouseUpUntil = Date.now() + 120;
    this.suppressBlockMoveUntil = this.suppressMouseUpUntil;
    this.hideDragGrid();
    this.handleDragEnd();
  }

  enforceDroppedBlockGeometry(blockId, regionId, referenceStyles = {}) {
    if (!blockId || !regionId) {
      return;
    }

    const referenceX = this.toOptionalCoordinate(referenceStyles.x);
    const referenceY = this.toOptionalCoordinate(referenceStyles.y);
    const referenceWidth = this.toOptionalNumber(referenceStyles.width);

    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== blockId) {
          return block;
        }

        const styles = {
          ...(block.styles || {})
        };

        if (block.type !== "divider") {
          const initialWidth = this.getInitialBlockWidth(
            block.type,
            block.content || ""
          );
          const nextWidth =
            referenceWidth ??
            this.toOptionalNumber(styles.width) ??
            initialWidth;
          if (Number.isFinite(nextWidth) && nextWidth > 0) {
            styles.width = nextWidth;
            styles.widthRatio = null;
          }

          const nextX = referenceX ?? this.toOptionalCoordinate(styles.x);
          if (Number.isFinite(nextX) && nextX >= 0) {
            styles.x = nextX;
            styles.xRatio = null;
          }
        } else {
          const nextX = referenceX ?? this.toOptionalCoordinate(styles.x);
          if (Number.isFinite(nextX) && nextX >= 0) {
            styles.x = nextX;
            styles.xRatio = null;
          }
        }

        const nextY = referenceY ?? this.toOptionalCoordinate(styles.y);
        if (Number.isFinite(nextY) && nextY >= 0) {
          styles.y = nextY;
        }

        const patched = this.clampBlockToRegion(
          {
            ...block,
            styles
          },
          regionId
        );

        return patched;
      })
    );
  }

  captureDropPointer(event, regionId = null) {
    const clientX = Number(event?.clientX);
    const clientY = Number(event?.clientY);

    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }

    this.lastKnownDropPointer = {
      clientX,
      clientY,
      regionId: regionId || null
    };
  }

  getDropEventWithPointer(event, regionId = null) {
    const eventX = Number(event?.clientX);
    const eventY = Number(event?.clientY);
    const hasValidEventPointer =
      Number.isFinite(eventX) &&
      Number.isFinite(eventY) &&
      (eventX !== 0 || eventY !== 0);

    if (hasValidEventPointer) {
      return event;
    }

    const fallback = this.lastKnownDropPointer;
    if (
      !fallback ||
      !Number.isFinite(fallback.clientX) ||
      !Number.isFinite(fallback.clientY)
    ) {
      const regionElement = this.getRegionElementById(regionId);
      if (!regionElement) {
        return event;
      }
      const rect = regionElement.getBoundingClientRect();
      return {
        ...event,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      };
    }

    return {
      ...event,
      clientX: fallback.clientX,
      clientY: fallback.clientY
    };
  }

  moveDraggedBlockOnDrop(draggedBlockId, regionId, event) {
    const sourceBlock = this.findBlockById(draggedBlockId);

    if (!sourceBlock) {
      return;
    }

    if (!this.dragHistorySaved) {
      this.saveHistory();
      this.dragHistorySaved = true;
    }

    const positionedBlock = this.positionBlockForDrop(
      this.autoSizeBlockForRegion(sourceBlock, regionId),
      regionId,
      event,
      { anchorMode: "pointer" }
    );

    this.documentModel = this.decorateDocument(
      this.insertBlockIntoRegionAtIndex(
        this.removeBlock(this.documentModel, draggedBlockId),
        regionId,
        positionedBlock,
        this.findRegionById(regionId)?.blocks?.length || 0
      )
    );

    this.selectedKind = "block";
    this.selectedBlockId = draggedBlockId;
    this.selectedRegionId = regionId;
  }

  stopTextEditing() {
    const editingBlockId = this.editingTextBlockId;

    if (editingBlockId) {
      const blockComponent =
        this.activeEditingBlockComponent ||
        this.getBlockComponentById(editingBlockId);
      blockComponent?.stopTextEditing?.();
    }

    this.editingTextBlockId = null;
    this.activeEditingBlockComponent = null;
  }

  getBlockComponentById(blockId) {
    if (!blockId) {
      return null;
    }

    const blockShell = this.template.querySelector(
      `.block-shell[data-block-id="${blockId}"]`
    );

    return blockShell?.querySelector("c-pdf-builder-block") || null;
  }

  handleRegionClick(event) {
    event.stopPropagation();
    if (
      this.suppressRegionClickUntil &&
      Date.now() <= this.suppressRegionClickUntil
    ) {
      return;
    }

    if (this.editingTextBlockId) {
      return;
    }

    this.stopTextEditing();
    this.selectedKind = "region";
    this.selectedBlockId = null;
    this.selectedRegionId = event.currentTarget.dataset.regionId;
    this.documentModel = this.decorateDocument(this.documentModel);
  }

  handleBlockSelect(event) {
    event.stopPropagation();

    if (
      this.suppressBlockSelectUntil &&
      Date.now() <= this.suppressBlockSelectUntil
    ) {
      return;
    }

    const nextBlockId = event.detail.blockId;
    const previousEditingBlockId = this.editingTextBlockId;

    if (previousEditingBlockId && previousEditingBlockId !== nextBlockId) {
      this.stopTextEditing();
    }

    this.selectedKind = "block";
    this.selectedBlockId = nextBlockId;
    this.selectedRegionId = event.detail.regionId || null;
    this.documentModel = this.decorateDocument(this.documentModel);
    this.syncRelatedListFieldsForSelectedBlock();
  }

  syncRelatedListFieldsForSelectedBlock() {
    const block = this.selectedBlock;
    if (!block || block.type !== "relatedList") {
      return;
    }

    this.loadRelatedListFieldsForChildObject(
      block.relatedListChildObjectApiName
    ).catch((error) => {
      this.metadataError = "";
      this.showToast(
        "Related-list fields could not be loaded",
        this.getUserFacingErrorMessage(error),
        "error"
      );
    });
  }

  handleTextChange(event) {
    const { blockId, content } = event.detail;
    const isTablePayload =
      typeof content === "object" && content?.type === "tableData";
    const nextTableData = isTablePayload ? content.tableData : null;
    const nextTableCellAlignments = isTablePayload
      ? content.tableCellAlignments
      : null;

    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== blockId) {
          return block;
        }

        return {
          ...block,
          ...(isTablePayload
            ? {
                tableData: nextTableData,
                tableCellAlignments: nextTableCellAlignments
              }
            : { content })
        };
      })
    );

    if (!isTablePayload) {
      this.enforceAutoHeightWithinRegion(blockId);
    }
  }

  enforceAutoHeightWithinRegion(blockId) {
    const block = this.findBlockById(blockId);

    if (!block || (block.type !== "text" && block.type !== "field")) {
      return;
    }

    const regionId = this.findRegionIdForBlock(blockId);
    const blockComponent = this.getBlockComponentById(blockId);

    if (!regionId || !blockComponent) {
      return;
    }

    window.requestAnimationFrame(() => {
      const currentBlock = this.findBlockById(blockId);
      const currentRegionId = this.findRegionIdForBlock(blockId);
      const currentBlockComponent = this.getBlockComponentById(blockId);

      if (!currentBlock || !currentRegionId || !currentBlockComponent) {
        return;
      }

      const bounds = this.getBlockRegionBounds(blockId, currentRegionId);
      const measuredHeight = Math.max(
        24,
        currentBlockComponent.measureAutoHeight?.() || 24
      );
      const currentHeight = this.toOptionalNumber(currentBlock.styles?.height);
      const currentY = Math.max(0, this.toNumber(currentBlock.styles?.y));
      const isFixedRegion =
        currentRegionId === this.documentModel.header?.id ||
        currentRegionId === this.documentModel.footer?.id;
      /*
       * Body text must grow down from its existing top edge. Clamping a
       * taller block through clampBlockToRegion() also clamps `y` to
       * maxHeight - blockHeight, which moves the block upward and hides
       * its first lines. Body overflow is intentional and is handled by
       * the continuation-page calculation.
       */
      const availableFixedRegionHeight = Math.max(
        24,
        bounds.maxHeight - currentY
      );
      const desiredHeight = isFixedRegion
        ? Math.min(measuredHeight, availableFixedRegionHeight)
        : measuredHeight;
      const nextHeight = Number.isFinite(currentHeight)
        ? Math.max(currentHeight, desiredHeight)
        : desiredHeight;

      if (Number.isFinite(currentHeight) && nextHeight === currentHeight) {
        return;
      }

      this.documentModel = this.decorateDocument(
        this.updateBlocks(this.documentModel, (item) => {
          if (item.id !== blockId) {
            return item;
          }

          return {
            ...item,
            styles: {
              ...(item.styles || {}),
              height: nextHeight,
              // Auto-height must never alter the top coordinate.
              y: item.styles?.y
            }
          };
        })
      );
    });
  }

  handleTextFocus(event) {
    this.editingTextBlockId = event.detail.blockId;
    this.activeEditingBlockComponent = event.target;
    this.selectedKind = "block";
    this.selectedBlockId = event.detail.blockId;
  }

  handleRichTextStateChange(event) {
    if (
      event.detail?.blockId &&
      this.editingTextBlockId &&
      event.detail.blockId !== this.editingTextBlockId
    ) {
      return;
    }

    const state = { ...(event.detail || {}) };
    delete state.blockId;

    this.richTextState = {
      ...this.richTextState,
      ...state
    };
  }

  handleTextBlur() {
    const blurredBlockId = this.editingTextBlockId;
    const blockComponent =
      this.activeEditingBlockComponent ||
      this.getBlockComponentById(blurredBlockId);
    blockComponent?.saveCurrentSelection?.();

    window.setTimeout(() => {
      if (!blurredBlockId) {
        return;
      }

      // If focus moved into the rich text toolbar, keep editing state alive.
      if (this.isRichToolbarActive) {
        return;
      }

      // If another block took focus immediately after this blur, do not
      // tear that new editing session down.
      if (
        this.editingTextBlockId &&
        this.editingTextBlockId !== blurredBlockId
      ) {
        return;
      }

      if (this.editingTextBlockId === blurredBlockId) {
        this.stopTextEditing();
        this.documentModel = this.decorateDocument(this.documentModel);
      }
    }, 0);
  }

  handleRichToolbarMouseDown(event) {
    event.stopPropagation();
    this.isRichToolbarActive = true;

    this.getSelectedBlockComponent()?.saveCurrentSelection?.();

    const tagName = event.target?.tagName;
    const isFormControl = tagName === "SELECT" || tagName === "INPUT";
    const isInteractiveTarget = Boolean(
      event.target?.closest?.(
        "button, input, select, textarea, .rich-font-menu, .rich-size-menu, .link-popover"
      )
    );

    if (!isInteractiveTarget && !isFormControl) {
      this.startRichToolbarDrag(event);
    }

    if (!isFormControl) {
      event.preventDefault();
    }
  }

  handleRichToolbarMouseUp() {
    window.setTimeout(() => {
      this.isRichToolbarActive = false;
    }, 150);
  }

  startRichToolbarDrag(event) {
    const toolbar = this.template.querySelector(".rich-text-toolbar");
    const builder = this.template.querySelector(".builder");

    if (!toolbar || !builder) {
      return;
    }

    const builderRect = builder.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    this.richToolbarDragState = {
      offsetX: event.clientX - toolbarRect.left,
      offsetY: event.clientY - toolbarRect.top,
      builderRect
    };

    if (!this.boundRichToolbarMouseMove) {
      this.boundRichToolbarMouseMove =
        this.handleRichToolbarMouseMove.bind(this);
    }
    if (!this.boundRichToolbarMouseUp) {
      this.boundRichToolbarMouseUp = this.handleRichToolbarDragEnd.bind(this);
    }

    window.addEventListener("mousemove", this.boundRichToolbarMouseMove, true);
    window.addEventListener("mouseup", this.boundRichToolbarMouseUp, true);
  }

  handleRichToolbarMouseMove(event) {
    if (!this.richToolbarDragState) {
      return;
    }

    const toolbar = this.template.querySelector(".rich-text-toolbar");
    if (!toolbar) {
      return;
    }

    const builderRect = this.richToolbarDragState.builderRect;
    const toolbarRect = toolbar.getBoundingClientRect();
    const minLeft = 0;
    const minTop = 0;
    const maxLeft = Math.max(0, builderRect.width - toolbarRect.width);
    const maxTop = Math.max(0, builderRect.height - toolbarRect.height);
    const nextLeft = Math.max(
      minLeft,
      Math.min(
        maxLeft,
        event.clientX - builderRect.left - this.richToolbarDragState.offsetX
      )
    );
    const nextTop = Math.max(
      minTop,
      Math.min(
        maxTop,
        event.clientY - builderRect.top - this.richToolbarDragState.offsetY
      )
    );

    this.richToolbarPosition = {
      left: Math.round(nextLeft),
      top: Math.round(nextTop)
    };
  }

  handleRichToolbarDragEnd() {
    this.richToolbarDragState = null;

    if (this.boundRichToolbarMouseMove) {
      window.removeEventListener(
        "mousemove",
        this.boundRichToolbarMouseMove,
        true
      );
    }

    if (this.boundRichToolbarMouseUp) {
      window.removeEventListener("mouseup", this.boundRichToolbarMouseUp, true);
    }
  }

  handleRichColorMouseDown(event) {
    event.stopPropagation();
    this.isRichToolbarActive = true;
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
    this.closeLinkPopover();
    // Capture the text range before the native color dialog takes focus.
    this.getSelectedBlockComponent()?.saveCurrentSelection?.();
  }

  handleRichColorChange(event) {
    event.stopPropagation();

    const value = this.getSafeColorInputValue(event.target?.value);
    const blockComponent = this.getSelectedBlockComponent();

    if (!blockComponent) {
      return;
    }

    this.isRichToolbarActive = true;
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
    this.closeLinkPopover();

    // Update the control first so a parent rerender cannot put the old
    // swatch value back while the native picker is still open.
    this.richTextState = {
      ...this.richTextState,
      color: value
    };

    blockComponent.restoreSelection?.();
    this.applyRichTextCommand("foreColor", value);

    window.setTimeout(() => {
      this.isRichToolbarActive = false;
    }, 150);
  }

  handleRichTextButtonCommand(event) {
    event.preventDefault();
    event.stopPropagation();

    this.isRichToolbarActive = true;
    this.getSelectedBlockComponent()?.saveCurrentSelection?.();
    this.closeLinkPopover();
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
    const command = event.currentTarget.dataset.command;
    const value = event.currentTarget.dataset.value || null;

    this.applyRichTextCommand(command, value);

    window.setTimeout(() => {
      this.isRichToolbarActive = false;
    }, 150);
  }

  handleLinkButtonMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const blockComponent = this.getSelectedBlockComponent();

    if (!blockComponent) {
      return;
    }

    this.isRichToolbarActive = true;
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
    blockComponent.saveCurrentSelection?.();
    const selectedText = blockComponent.getSelectedTextForLink?.() || "";
    this.linkAlias = selectedText;
    this.linkUrl = this.getInitialLinkUrlValue(selectedText);
    this.linkError = "";
    this.isLinkPopoverOpen = true;
    this.editingTextBlockId = this.selectedBlockId;

    window.setTimeout(() => {
      const linkUrlInput = this.template.querySelector(".link-url-input");

      if (linkUrlInput) {
        linkUrlInput.focus();
      }
    }, 0);
  }

  handleLinkAliasChange(event) {
    this.linkAlias = event.target.value;
    this.linkError = "";
  }

  handleLinkUrlChange(event) {
    this.linkUrl = event.target.value;
    this.linkError = "";
  }

  handleLinkPopoverMouseDown(event) {
    event.stopPropagation();
    this.isRichToolbarActive = true;
  }

  handleLinkCancel() {
    this.closeLinkPopover();
    this.editingTextBlockId = this.selectedBlockId;
  }

  handleLinkSave() {
    const blockComponent = this.getSelectedBlockComponent();
    const alias = this.linkAlias?.trim();
    const normalizedUrl = this.normalizeLinkUrl(this.linkUrl);

    if (!alias) {
      this.linkError = "Enter the text that will appear in the document.";
      return;
    }

    if (!normalizedUrl) {
      this.linkError = "Enter a valid URL, email or phone number.";
      return;
    }

    if (!blockComponent) {
      this.linkError = "Select a text block before adding a link.";
      return;
    }

    this.saveHistory();
    blockComponent.applyLink(alias, normalizedUrl);
    this.closeLinkPopover();
    this.editingTextBlockId = this.selectedBlockId;
  }

  closeLinkPopover() {
    this.isLinkPopoverOpen = false;
    this.linkAlias = "";
    this.linkUrl = "";
    this.linkError = "";
  }

  getInitialLinkUrlValue(selectedText = "") {
    const value = String(selectedText || "").trim();
    if (!value) {
      return "";
    }

    if (/^(https?:\/\/|www\.|mailto:|tel:)/i.test(value)) {
      return value;
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value)) {
      return value;
    }

    return "";
  }

  normalizeLinkUrl(value = "") {
    const rawUrl = String(value).trim();

    if (!rawUrl) {
      return null;
    }

    if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(rawUrl)) {
      return rawUrl;
    }

    if (/^tel:\+?[0-9().\s-]{6,}$/i.test(rawUrl)) {
      return rawUrl.replace(/\s+/g, "");
    }

    const candidateUrl = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;

    try {
      const parsedUrl = new URL(candidateUrl);
      const protocol = parsedUrl.protocol.toLowerCase();

      if (protocol !== "http:" && protocol !== "https:") {
        return null;
      }

      if (!parsedUrl.hostname || !parsedUrl.hostname.includes(".")) {
        return null;
      }

      return parsedUrl.href;
    } catch {
      return null;
    }
  }

  handleFontMenuMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    this.isRichToolbarActive = true;
    this.closeLinkPopover();
    this.getSelectedBlockComponent()?.saveCurrentSelection?.();
    this.isFontSizeMenuOpen = false;
    this.isFontMenuOpen = !this.isFontMenuOpen;
  }

  handleFontOptionMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const fontFamily = event.currentTarget.dataset.value;

    if (!fontFamily) {
      return;
    }

    this.isRichToolbarActive = true;
    this.closeLinkPopover();
    this.getSelectedBlockComponent()?.restoreSelection?.();
    this.applyRichTextCommand("fontName", fontFamily);
    this.richTextState = {
      ...this.richTextState,
      fontFamily
    };
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
  }

  handleRichTextInputCommand(event) {
    event.stopPropagation();

    this.isRichToolbarActive = true;
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
    this.getSelectedBlockComponent()?.restoreSelection?.();
    this.closeLinkPopover();

    const command = event.currentTarget.dataset.command;
    const value = event.target.value;

    if (command === "fontSize") {
      const rawValue = String(value ?? "").trim();

      // Allow clearing the whole input before typing the next number.
      if (rawValue === "") {
        this.richTextState = {
          ...this.richTextState,
          fontSize: ""
        };
        return;
      }

      // Ignore non-numeric intermediate values for command execution.
      if (!/^\d+$/.test(rawValue)) {
        return;
      }
    }

    this.applyRichTextCommand(command, value);
    this.updateRichTextStateFromInputCommand(command, value);
  }

  handleRichTextSizeMouseDown(event) {
    event.stopPropagation();

    this.isRichToolbarActive = true;
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;
    this.closeLinkPopover();
    this.getSelectedBlockComponent()?.saveCurrentSelection?.();
  }

  handleRichTextSizeInput(event) {
    event.stopPropagation();

    this.isRichToolbarActive = true;
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = false;

    const rawValue = String(event?.target?.value ?? "");
    if (rawValue !== "" && !/^\d+$/.test(rawValue.trim())) {
      return;
    }

    this.richTextState = {
      ...this.richTextState,
      fontSize: rawValue
    };
  }

  handleRichTextSizeChange(event) {
    event.stopPropagation();
    this.commitRichTextSize(event?.target?.value);
  }

  handleRichTextSizeKeyDown(event) {
    event.stopPropagation();

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    this.commitRichTextSize(event.currentTarget.value);
  }

  handleRichTextSizeBlur(event) {
    this.commitRichTextSize(event?.target?.value);
  }

  handleFontSizeMenuMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    this.isRichToolbarActive = true;
    this.closeLinkPopover();
    this.getSelectedBlockComponent()?.saveCurrentSelection?.();
    this.isFontMenuOpen = false;
    this.isFontSizeMenuOpen = !this.isFontSizeMenuOpen;
  }

  handleFontSizeOptionMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const value = event.currentTarget.dataset.value;

    if (!value) {
      return;
    }

    this.isRichToolbarActive = true;
    this.closeLinkPopover();
    this.getSelectedBlockComponent()?.restoreSelection?.();
    this.commitRichTextSize(value);
    this.isFontSizeMenuOpen = false;
  }

  handlePropertyFontSizeMenuMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    this.isPropertyFontSizeMenuOpen = !this.isPropertyFontSizeMenuOpen;
  }

  handlePropertyFontSizeOptionMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const value = event.currentTarget.dataset.value;
    if (!value) {
      return;
    }

    window.clearTimeout(this.propertyFontSizeTimer);
    this.propertyFontSizeDraft = {
      blockId: this.selectedBlockId,
      value
    };
    const input = this.template.querySelector(".property-size-input");
    if (input) {
      // Update before closing the menu. Otherwise the input blur can
      // commit its previous value after the selected preset.
      input.value = value;
    }
    this.isPropertyFontSizeMenuOpen = false;
    this.handleStyleChange({
      target: {
        dataset: { style: "fontSize" },
        value
      }
    });
  }

  handlePropertyFontSizeInput(event) {
    event.stopPropagation();
    const value = String(event.target.value || "").trim();
    window.clearTimeout(this.propertyFontSizeTimer);
    this.propertyFontSizeDraft = {
      blockId: this.selectedBlockId,
      value
    };

    if (!/^\d+$/.test(value)) {
      return;
    }

    this.propertyFontSizeTimer = window.setTimeout(() => {
      this.handleStyleChange({
        target: {
          dataset: { style: "fontSize" },
          value
        }
      });
    }, this.inputDebounceMilliseconds);
  }

  handlePropertyColorClick(event) {
    if (
      !this.selectedBlock ||
      this.selectedBlock.styles?.colorExplicit === true
    ) {
      return;
    }

    this.handleStyleChange(event);
  }

  commitRichTextSize(rawValue) {
    const trimmedValue = String(rawValue ?? "").trim();

    if (trimmedValue === "") {
      const fallbackSize = String(this.selectedElement?.styles?.fontSize || 14);
      this.richTextState = {
        ...this.richTextState,
        fontSize: fallbackSize
      };
      return;
    }

    if (!/^\d+$/.test(trimmedValue)) {
      return;
    }

    const normalizedSize = String(
      Math.max(1, Math.min(72, this.toNumber(trimmedValue) || 14))
    );
    this.getSelectedBlockComponent()?.restoreSelection?.();
    this.applyRichTextCommand("fontSize", normalizedSize);
    this.updateRichTextStateFromInputCommand("fontSize", normalizedSize);
  }

  updateRichTextStateFromInputCommand(command, value) {
    if (command === "fontName") {
      this.richTextState = {
        ...this.richTextState,
        fontFamily: value || "Arial"
      };
      return;
    }

    if (command === "fontSize") {
      const nextSize = this.toNumber(value);
      this.richTextState = {
        ...this.richTextState,
        fontSize: String(Math.max(1, Math.min(72, nextSize || 14)))
      };
      return;
    }

    if (command === "lineHeight") {
      this.richTextState = {
        ...this.richTextState,
        lineHeight: value || "1.25"
      };
      return;
    }

    if (command === "foreColor") {
      this.richTextState = {
        ...this.richTextState,
        color: value || "#181818"
      };
    }
  }

  applyRichTextCommand(command, value = null) {
    if (command === "verticalAlign") {
      this.applyVerticalAlignStyle(value);
      return;
    }

    const blockComponent = this.getSelectedBlockComponent();

    if (!blockComponent || !command) {
      return;
    }

    this.saveHistory();

    blockComponent.applyRichTextCommand(command, value);

    this.editingTextBlockId = this.editingTextBlockId || this.selectedBlockId;
  }

  applyVerticalAlignStyle(rawValue) {
    const value =
      rawValue === "middle" || rawValue === "bottom" ? rawValue : "top";
    const selectedBlock = this.selectedBlock;

    if (!selectedBlock) {
      return;
    }

    if (selectedBlock.type === "table") {
      const blockComponent = this.getSelectedBlockComponent();
      this.saveHistory();
      blockComponent?.applyTableCellVerticalAlign?.(value);
      this.richTextState = {
        ...this.richTextState,
        verticalAlign: value
      };
      return;
    }

    const styleName = "verticalAlign";
    const blockId = selectedBlock.id;
    const regionId =
      this.selectedRegionId || this.findRegionIdForBlock(blockId);

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== blockId) {
          return block;
        }

        return this.clampBlockToRegion(
          this.updateElementStyle(block, styleName, value),
          regionId
        );
      })
    );

    this.richTextState = {
      ...this.richTextState,
      verticalAlign: value
    };
  }

  getSelectedBlockComponent() {
    if (this.activeEditingBlockComponent) {
      return this.activeEditingBlockComponent;
    }

    const blockId = this.editingTextBlockId || this.selectedBlockId;

    return this.getBlockComponentById(blockId);
  }

  handlePagePaddingChange(event) {
    const pagePadding = Math.max(0, this.toNumber(event.target.value));
    const alignedRegionWidth = Math.max(40, this.pageWidth - pagePadding * 2);

    this.saveHistory();
    this.documentModel = this.decorateDocument({
      ...this.documentModel,
      pagePadding,
      header: {
        ...this.documentModel.header,
        styles: {
          ...this.documentModel.header.styles,
          width: alignedRegionWidth
        }
      },
      footer: {
        ...this.documentModel.footer,
        styles: {
          ...this.documentModel.footer.styles,
          width: alignedRegionWidth
        }
      }
    });
  }

  handlePageBackgroundChange(event) {
    this.saveHistory();
    this.documentModel = this.decorateDocument({
      ...this.documentModel,
      pageBackground: event.target.value || "#ffffff"
    });
  }

  handleRegionVisibilityChange(event) {
    const flagName = event.target.dataset.visibility;

    this.saveHistory();
    this.documentModel = this.decorateDocument({
      ...this.documentModel,
      [flagName]: event.target.checked
    });

    if (
      (this.selectedRegionId === "header" && !this.documentModel.showHeader) ||
      (this.selectedRegionId === "body-1" && !this.documentModel.showBody) ||
      (this.selectedRegionId === "body-2" && !this.documentModel.showBody) ||
      (this.selectedRegionId === "footer" && !this.documentModel.showFooter)
    ) {
      this.clearSelection();
    }
  }

  handleRepeatRegionChange(event) {
    const flagName = event.target.dataset.repeat;

    if (!flagName) {
      return;
    }

    this.saveHistory();
    this.documentModel = this.decorateDocument({
      ...this.documentModel,
      [flagName]: event.target.checked
    });
  }

  handleAddPage() {
    if (!this.canAddPage) {
      return;
    }

    this.saveHistory();
    const manualPageIndex = Math.max(
      0,
      this.toNumber(this.documentModel.manualPageCount || 0)
    );
    const pageKey = `manual-${manualPageIndex + 1}-${Date.now()}`;
    const sections =
      this.documentModel.body.layout === "two"
        ? [
            this.createRegion(`${pageKey}-body-1`, "Body 1", null),
            this.createRegion(`${pageKey}-body-2`, "Body 2", null)
          ]
        : [this.createRegion(`${pageKey}-body-1`, "Body", null)];
    this.documentModel = this.decorateDocument({
      ...this.documentModel,
      manualPageCount: manualPageIndex + 1,
      manualPages: [
        ...(this.documentModel.manualPages || []),
        {
          id: pageKey,
          body: { layout: this.documentModel.body.layout, sections }
        }
      ]
    });
  }

  handleRemovePage() {
    const currentManualPages = Math.max(
      0,
      this.toNumber(this.documentModel.manualPageCount || 0)
    );

    if (currentManualPages === 0) {
      return;
    }

    this.saveHistory();
    this.documentModel = this.decorateDocument({
      ...this.documentModel,
      manualPageCount: currentManualPages - 1,
      manualPages: (this.documentModel.manualPages || []).slice(
        0,
        currentManualPages - 1
      )
    });
  }

  handleGlobalPaddingChange(event) {
    const padding = this.toNumber(event.target.value);

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateRegions(
        {
          ...this.documentModel,
          globalElementPadding: padding
        },
        (region) => {
          return {
            ...this.updateElementStyle(region, "padding", padding),
            blocks: (region.blocks || []).map((block) => {
              return this.updateElementStyle(block, "padding", padding);
            })
          };
        }
      )
    );
  }

  handleBodyLayoutChange(event) {
    this.saveHistory();
    this.documentModel = this.decorateDocument({
      ...this.documentModel,
      body: this.createBodyForLayout(
        event.target.value,
        this.documentModel.body
      )
    });
  }

  handleStyleChange(event) {
    const styleName = event.target.dataset.style;
    let value = event.target.value;

    if (
      styleName === "padding" ||
      styleName === "fontSize" ||
      styleName === "height" ||
      styleName === "width" ||
      styleName === "borderWidth" ||
      styleName === "borderRadius" ||
      styleName === "tableRows" ||
      styleName === "tableColumns" ||
      styleName === "tableCellPadding" ||
      styleName === "tableBorderWidth" ||
      styleName === "lineLength" ||
      styleName === "lineThickness"
    ) {
      value = this.toNumber(value);
    }

    if (styleName === "tableRows" || styleName === "tableColumns") {
      value = Math.max(1, Math.min(12, value));
    }
    if (styleName === "fontSize") {
      value = Math.max(1, Math.min(72, value || 14));
    }

    this.saveHistory();

    if (this.selectedBlock) {
      this.documentModel = this.decorateDocument(
        this.updateBlocks(this.documentModel, (block) => {
          if (block.id !== this.selectedBlockId) {
            return block;
          }

          let content = block.content;
          if (
            styleName === "fontSize" &&
            (block.type === "text" || block.type === "field")
          ) {
            content = this.applyFontSizeToWholeContent(content, value);
          }
          if (
            styleName === "color" &&
            (block.type === "text" || block.type === "field")
          ) {
            content = this.applyColorToWholeContent(content, value);
          }
          const styledBlock =
            styleName === "color"
              ? {
                  ...block,
                  content,
                  styles: { ...(block.styles || {}), colorExplicit: true }
                }
              : { ...block, content };

          return this.clampBlockToRegion(
            this.updateElementBorderState(
              this.updateElementStyle(styledBlock, styleName, value),
              styleName,
              value
            ),
            this.selectedRegionId || this.findRegionIdForBlock(block.id)
          );
        })
      );
      return;
    }

    if (this.selectedRegion) {
      let nextValue = value;
      if (
        styleName === "height" &&
        (this.selectedRegionId === "header" ||
          this.selectedRegionId === "footer")
      ) {
        nextValue = this.clampFixedRegionHeight(
          this.selectedRegionId,
          value,
          this.documentModel
        );
      } else if (
        styleName === "width" &&
        (this.selectedRegionId === "header" ||
          this.selectedRegionId === "footer")
      ) {
        nextValue = this.clampFixedRegionWidth(value, this.documentModel);
      }

      this.documentModel = this.decorateDocument(
        this.updateRegion(
          this.documentModel,
          this.selectedRegionId,
          (region) => {
            return this.updateElementBorderState(
              this.updateElementStyle(region, styleName, nextValue),
              styleName,
              nextValue
            );
          }
        )
      );
    }
  }

  handleBlockPositionChange(event) {
    const axis = event.target.dataset.position;
    const rawValue = String(event.target.value ?? "").trim();

    if ((axis !== "x" && axis !== "y") || rawValue === "") {
      return;
    }

    const requestedValue = Number(rawValue);
    if (!Number.isFinite(requestedValue) || !this.selectedBlock) {
      return;
    }

    const blockId = this.selectedBlockId;
    const regionId =
      this.selectedRegionId || this.findRegionIdForBlock(blockId);
    const currentPosition = this.getDisplayedBlockPosition(blockId, regionId);

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== blockId) {
          return block;
        }

        const storedX = this.toOptionalCoordinate(block.styles?.x);
        const storedY = this.toOptionalCoordinate(block.styles?.y);
        const styles = {
          ...(block.styles || {}),
          x:
            axis === "x"
              ? Math.max(0, requestedValue)
              : (storedX ?? currentPosition.x),
          xRatio: null,
          y:
            axis === "y"
              ? Math.max(0, requestedValue)
              : (storedY ?? currentPosition.y)
        };

        return this.clampBlockToRegion({ ...block, styles }, regionId);
      })
    );
  }

  getDisplayedBlockPosition(blockId, regionId) {
    const block = this.findBlockById(blockId);
    const storedX = this.toOptionalCoordinate(block?.styles?.x);
    const storedY = this.toOptionalCoordinate(block?.styles?.y);

    if (storedX !== null && storedY !== null) {
      return { x: storedX, y: storedY };
    }

    const shell = this.getBlockShellElement(blockId);
    const metrics = this.getRegionContentMetrics(regionId);
    const shellRect = shell?.getBoundingClientRect?.();
    const measuredX = Number.isFinite(shell?.offsetLeft)
      ? shell.offsetLeft - metrics.paddingLeft
      : this.toNumber(shellRect?.left) -
        this.toNumber(metrics.rect?.left) -
        metrics.paddingLeft;
    const measuredY = Number.isFinite(shell?.offsetTop)
      ? shell.offsetTop - metrics.paddingTop
      : this.toNumber(shellRect?.top) -
        this.toNumber(metrics.rect?.top) -
        metrics.paddingTop;

    return {
      x: storedX ?? Math.max(0, measuredX),
      y: storedY ?? Math.max(0, measuredY)
    };
  }

  applyFontSizeToWholeContent(content, fontSize) {
    const template = document.createElement("template");
    template.innerHTML = String(content || "");
    const normalizedSize = `${Math.max(1, Math.min(72, this.toNumber(fontSize) || 14))}px`;

    Array.from(template.content.querySelectorAll("*")).forEach((element) => {
      element.removeAttribute("size");
      element.style.fontSize = normalizedSize;
    });

    return template.innerHTML;
  }

  applyColorToWholeContent(content, color) {
    const template = document.createElement("template");
    template.innerHTML = String(content || "");
    const normalizedColor = this.getSafeColorInputValue(color);

    Array.from(template.content.querySelectorAll("*")).forEach((element) => {
      element.removeAttribute("color");
      element.style.color = normalizedColor;
    });

    return template.innerHTML;
  }

  handleRelatedListChange(event) {
    const relationshipName = event.target.value;
    const selectedOption = this.relatedListSelectOptions.find(
      (option) => option.relationshipName === relationshipName
    );
    const childObjectApiName = selectedOption?.childObjectApiName || null;
    const relationshipLabel = selectedOption?.label || relationshipName;

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== this.selectedBlockId) {
          return block;
        }

        return {
          ...block,
          relatedListRelationshipName: relationshipName || null,
          relatedListLabel: relationshipLabel || null,
          relatedListChildObjectApiName: childObjectApiName,
          relatedListColumns: []
        };
      })
    );

    this.loadRelatedListFieldsForChildObject(childObjectApiName).catch(
      (error) => {
        this.metadataError = "";
        this.showToast(
          "Related-list fields could not be loaded",
          this.getUserFacingErrorMessage(error),
          "error"
        );
      }
    );
  }

  handleRelatedListColumnsChange(event) {
    const selected = event.detail?.value || [];
    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== this.selectedBlockId) {
          return block;
        }

        return {
          ...block,
          relatedListColumns: selected
        };
      })
    );
  }

  handleRelatedListColorChange(event) {
    const key = event.target.dataset.key;
    const value = event.target.value;

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== this.selectedBlockId) {
          return block;
        }

        return {
          ...block,
          [key]: value,
          styles: {
            ...(block.styles || {}),
            [key]: value
          }
        };
      })
    );
  }

  handlePropertySectionToggle(event) {
    const openedSection = event.currentTarget;

    if (!openedSection?.open) {
      return;
    }

    if (
      openedSection.dataset.section === "related-list" &&
      !String(this.selectedObjectApiName || "").trim()
    ) {
      openedSection.open = false;
      this.showToast(
        "Object required",
        "Select an object before configuring related-list fields.",
        "warning"
      );
      return;
    }

    this.template
      .querySelectorAll("details.property-section")
      .forEach((section) => {
        if (section !== openedSection && section.open) {
          section.open = false;
        }
      });
  }

  handleRelatedListNumberChange(event) {
    const key = event.target.dataset.key;
    const value = this.clampNumber(this.toNumber(event.target.value), 8, 36);

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== this.selectedBlockId) {
          return block;
        }

        return {
          ...block,
          [key]: value,
          styles: {
            ...(block.styles || {}),
            [key]: value
          }
        };
      })
    );
  }

  handleRelatedListSelectChange(event) {
    const key = event.target.dataset.key;
    const value = event.target.value;

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== this.selectedBlockId) {
          return block;
        }

        return {
          ...block,
          [key]: value
        };
      })
    );
  }

  handleImageUrlChange(event) {
    this.updateSelectedImage(event.target.value, "Image");
  }

  handleOpenSalesforceImagePicker() {
    const blockId = this.selectedBlockId;
    const block = this.findBlockById(blockId);
    if (!block || block.type !== "image") {
      return;
    }

    this.imageFilePickerBlockId = blockId;
    this.imageFileSearchTerm = "";
    this.salesforceImageFiles = [];
    this.isImageFilePickerOpen = true;
    this.loadSalesforceImageFiles();
  }

  handleCloseSalesforceImagePicker() {
    if (this.imageFileSearchTimer) {
      window.clearTimeout(this.imageFileSearchTimer);
      this.imageFileSearchTimer = null;
    }
    this.isImageFilePickerOpen = false;
    this.isImageFileLoading = false;
    this.imageFilePickerBlockId = null;
    this.imageFileSearchTerm = "";
    this.salesforceImageFiles = [];
  }

  handleSalesforceImageSearch(event) {
    this.imageFileSearchTerm = event.target.value || "";
    if (this.imageFileSearchTimer) {
      window.clearTimeout(this.imageFileSearchTimer);
    }
    this.imageFileSearchTimer = window.setTimeout(() => {
      this.imageFileSearchTimer = null;
      this.loadSalesforceImageFiles();
    }, this.inputDebounceMilliseconds);
  }

  async loadSalesforceImageFiles() {
    if (!this.isImageFilePickerOpen) {
      return;
    }

    this.isImageFileLoading = true;
    try {
      this.salesforceImageFiles = await getSalesforceImageFiles({
        searchTerm: this.imageFileSearchTerm
      });
    } catch (error) {
      this.salesforceImageFiles = [];
      this.showToast(
        "Salesforce Files could not be loaded",
        this.getUserFacingErrorMessage(error),
        "error"
      );
    } finally {
      this.isImageFileLoading = false;
    }
  }

  handleSelectSalesforceImage(event) {
    const contentVersionId = event.currentTarget.dataset.versionId;
    const file = this.salesforceImageFiles.find(
      (item) => item.contentVersionId === contentVersionId
    );
    const blockId = this.imageFilePickerBlockId;
    if (!file || !blockId || !this.findBlockById(blockId)) {
      return;
    }

    this.updateImageById(
      blockId,
      file.downloadUrl,
      file.fileName,
      file.downloadUrl
    );
    this.handleCloseSalesforceImagePicker();
    this.showToast(
      "Image selected",
      `“${file.fileName}” was added from Salesforce Files.`,
      "success"
    );
  }

  formatFileSize(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  }

  resetImageUploadInput(event) {
    if (event?.target) {
      event.target.value = "";
    }
  }

  handleOpenComputerImageUpload() {
    const input = this.template.querySelector(".property-image-upload-input");

    if (input) {
      input.value = "";
      input.click();
    }
  }

  handleImageUpload(event) {
    const input = event.target;
    const file = input.files?.[0];
    const targetBlockId =
      this.pendingImageUploadBlockId || this.selectedBlockId;

    this.pendingImageUploadBlockId = null;

    this.loadImageFileForBlock(file, targetBlockId, input);
  }

  async loadImageFileForBlock(file, targetBlockId, input = null) {
    if (!file || !targetBlockId || !this.findBlockById(targetBlockId)) {
      if (input) {
        input.value = "";
      }
      return;
    }

    try {
      this.templateStatus = "";
      const imageDataUrl = await this.getUploadReadyImageDataUrl(file);

      // Render immediately in the builder, then replace the data URL with a
      // persisted Salesforce File URL so PDF rendering never needs DML.
      this.updateImageById(targetBlockId, imageDataUrl, file.name);

      try {
        const storedImageUrl = await saveTemplateImage({
          fileName: file.name,
          base64Data: this.getBase64DataFromDataUrl(imageDataUrl),
          contentType: this.getContentTypeFromDataUrl(imageDataUrl)
        });

        if (this.findBlockById(targetBlockId)) {
          this.updateBlocksWithPersistedImageSource(
            targetBlockId,
            storedImageUrl
          );
          this.templateStatus = "";
        }
      } catch (error) {
        const message = this.getUserFacingErrorMessage(error);
        this.templateStatus = "";
        this.showToast("Image could not be saved", message, "error");
      }
    } catch (error) {
      const message = this.getUserFacingErrorMessage(error);
      this.templateStatus = "";
      this.showToast("Unable to read image", message, "error");
    } finally {
      if (input) {
        input.value = "";
      }
    }
  }

  async getUploadReadyImageDataUrl(file) {
    const dataUrl = await this.readFileAsDataUrl(file);
    const maximumBase64Length = this.maxClientImageBase64Length;

    if (this.getBase64DataFromDataUrl(dataUrl).length <= maximumBase64Length) {
      return dataUrl;
    }

    return this.resizeImageDataUrl(dataUrl, maximumBase64Length);
  }

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () =>
        reject(
          reader.error || new Error("The selected image could not be read.")
        );
      reader.readAsDataURL(file);
    });
  }

  loadBrowserImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("The selected image format is not supported."));
      image.src = dataUrl;
    });
  }

  async resizeImageDataUrl(dataUrl, maximumBase64Length) {
    const image = await this.loadBrowserImage(dataUrl);
    const originalWidth = Math.max(1, image.naturalWidth || image.width);
    const originalHeight = Math.max(1, image.naturalHeight || image.height);
    const payloadRatio = Math.sqrt(
      maximumBase64Length /
        Math.max(1, this.getBase64DataFromDataUrl(dataUrl).length)
    );
    const dimensionRatio = Math.min(
      1,
      2200 / originalWidth,
      2200 / originalHeight,
      payloadRatio
    );
    let width = Math.max(1, Math.round(originalWidth * dimensionRatio));
    let height = Math.max(1, Math.round(originalHeight * dimensionRatio));
    let resizedDataUrl = "";

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("The image could not be optimized in this browser.");
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resizedDataUrl = canvas.toDataURL(
        "image/jpeg",
        Math.max(0.58, 0.86 - attempt * 0.06)
      );

      if (
        this.getBase64DataFromDataUrl(resizedDataUrl).length <=
        maximumBase64Length
      ) {
        return resizedDataUrl;
      }

      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }

    return resizedDataUrl;
  }

  getBase64DataFromDataUrl(dataUrl) {
    const separatorIndex = String(dataUrl || "").indexOf(",");

    return separatorIndex >= 0 ? String(dataUrl).slice(separatorIndex + 1) : "";
  }

  getContentTypeFromDataUrl(dataUrl) {
    const match = String(dataUrl || "").match(/^data:([^;]+);base64,/i);

    return match?.[1] || "image/png";
  }

  isEmbeddedImageDataUrl(value) {
    return /^data:image\/[^;]+;base64,/i.test(String(value || ""));
  }

  async persistEmbeddedTemplateImages() {
    const embeddedImageBlocks = [
      ...(this.documentModel.header?.blocks || []),
      ...(this.documentModel.body?.sections || []).flatMap(
        (section) => section.blocks || []
      ),
      ...(this.documentModel.footer?.blocks || [])
    ].filter(
      (block) =>
        block.type === "image" && this.isEmbeddedImageDataUrl(block.imageSrc)
    );

    if (!embeddedImageBlocks.length) {
      return;
    }

    const storedImageUrls = new Map();
    const maximumBase64Length = this.maxClientImageBase64Length;

    for (const block of embeddedImageBlocks) {
      if (block.pdfImageSrc) {
        storedImageUrls.set(block.imageSrc, block.pdfImageSrc);
        continue;
      }

      if (storedImageUrls.has(block.imageSrc)) {
        continue;
      }

      const uploadDataUrl =
        this.getBase64DataFromDataUrl(block.imageSrc).length >
        maximumBase64Length
          ? await this.resizeImageDataUrl(block.imageSrc, maximumBase64Length)
          : block.imageSrc;
      const storedImageUrl = await saveTemplateImage({
        fileName: block.imageAlt || "template-image",
        base64Data: this.getBase64DataFromDataUrl(uploadDataUrl),
        contentType: this.getContentTypeFromDataUrl(uploadDataUrl)
      });
      storedImageUrls.set(block.imageSrc, storedImageUrl);
    }

    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        return storedImageUrls.has(block.imageSrc)
          ? {
              ...block,
              imageSrc: storedImageUrls.get(block.imageSrc),
              pdfImageSrc: storedImageUrls.get(block.imageSrc),
              hasImage: true
            }
          : block;
      })
    );
  }

  handleImageDoubleClick(event) {
    const { blockId, regionId } = event.detail;

    this.selectedKind = "block";
    this.selectedBlockId = blockId;
    this.selectedRegionId = regionId || null;
    this.pendingImageUploadBlockId = null;
    this.documentModel = this.decorateDocument(this.documentModel);
    this.openImageFilePickerForBlock(blockId);
  }

  openImageFilePickerForBlock(blockId) {
    if (!blockId || !this.findBlockById(blockId)) {
      return;
    }

    this.pendingImageUploadBlockId = blockId;

    const input = this.template.querySelector(".image-upload-input");

    if (input) {
      input.value = "";
      input.click();
      return;
    }

    const fallbackInput = document.createElement("input");
    fallbackInput.type = "file";
    fallbackInput.accept = "image/*";
    fallbackInput.style.position = "fixed";
    fallbackInput.style.left = "-9999px";
    fallbackInput.style.top = "-9999px";

    fallbackInput.addEventListener("change", () => {
      const file = fallbackInput.files?.[0];
      this.loadImageFileForBlock(file, blockId, fallbackInput);
      window.setTimeout(() => {
        fallbackInput.remove();
      }, 1000);
    });

    document.body.appendChild(fallbackInput);
    fallbackInput.click();
  }

  updateBlocksWithPersistedImageSource(blockId, pdfImageSrc) {
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        return block.id === blockId
          ? {
              ...block,
              imageSrc: pdfImageSrc,
              pdfImageSrc
            }
          : block;
      })
    );
  }

  updateSelectedImage(imageSrc, imageAlt) {
    this.updateImageById(this.selectedBlockId, imageSrc, imageAlt);
  }

  updateImageById(blockId, imageSrc, imageAlt, persistedImageSrc = null) {
    if (!blockId) {
      return;
    }

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (block) => {
        if (block.id !== blockId) {
          return block;
        }

        return {
          ...block,
          imageSrc,
          imageAlt,
          pdfImageSrc: persistedImageSrc,
          hasImage: Boolean(imageSrc)
        };
      })
    );

    this.selectedKind = "block";
    this.selectedBlockId = blockId;
    this.selectedRegionId = this.findRegionIdForBlock(blockId);
    this.updateImageAspectRatioFromSource(blockId, imageSrc);
  }

  async updateImageAspectRatioFromSource(blockId, imageSrc) {
    if (!blockId || !imageSrc) {
      return;
    }

    try {
      const image = await this.loadBrowserImage(imageSrc);
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);

      const currentBlock = this.findBlockById(blockId);
      if (width > 0 && height > 0 && currentBlock?.imageSrc === imageSrc) {
        this.applyImageAspectRatio(blockId, width / height);
      }
    } catch {
      // The rendered image can still provide its intrinsic ratio when resize starts.
    }
  }

  applyImageAspectRatio(blockId, aspectRatio) {
    const ratio = Number(aspectRatio);
    const block = this.findBlockById(blockId);
    const regionId = this.findRegionIdForBlock(blockId);

    if (!block || block.type !== "image" || !regionId || !(ratio > 0)) {
      return;
    }

    const bounds = this.getBlockRegionBounds(blockId, regionId);
    const padding = Math.max(0, this.toNumber(block.styles?.padding));
    const borderWidth =
      block.styles?.borderStyle === "none"
        ? 0
        : Math.max(0, this.toNumber(block.styles?.borderWidth));
    const horizontalChrome = (padding + borderWidth) * 2;
    const verticalChrome = horizontalChrome;
    const x = Math.max(0, this.toNumber(block.styles?.x));
    const y = Math.max(0, this.toNumber(block.styles?.y));
    const maximumWidth = Math.max(1, bounds.maxWidth - x);
    const maximumHeight = Math.max(1, bounds.maxHeight - y);
    let width = this.clampNumber(
      this.toNumber(block.styles?.width || this.getInitialBlockWidth("image")),
      Math.min(32, maximumWidth),
      maximumWidth
    );
    let height = verticalChrome + Math.max(1, width - horizontalChrome) / ratio;

    if (height > maximumHeight) {
      height = maximumHeight;
      width = Math.min(
        maximumWidth,
        horizontalChrome + Math.max(1, height - verticalChrome) * ratio
      );
    }

    this.documentModel = this.decorateDocument(
      this.updateBlocks(this.documentModel, (item) => {
        if (item.id !== blockId) {
          return item;
        }

        return {
          ...item,
          imageAspectRatio: ratio,
          styles: {
            ...(item.styles || {}),
            width: this.roundLayoutValue(width),
            widthRatio: null,
            height: this.roundLayoutValue(height),
            heightManuallyResized: false
          }
        };
      })
    );
  }

  handleResizeStart(event) {
    event.preventDefault();
    event.stopPropagation();

    const regionId = event.currentTarget.dataset.regionId;
    const region = this.findRegionById(regionId);

    if (!region) {
      return;
    }

    this.saveHistory();
    this.resizeState = {
      regionId,
      kind: "region",
      startY: event.clientY,
      startHeight:
        Number(region.styles.height) ||
        this.getDefaultFixedRegionHeight(regionId)
    };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  }

  handleCanvasBlockResizeStart(event) {
    event.preventDefault();
    event.stopPropagation();

    const blockId = event.currentTarget.dataset.blockId;
    const resizeDirection = event.currentTarget.dataset.resizeDir || "se";
    const block = this.findBlockById(blockId);
    const shellElement = event.currentTarget.closest(".block-shell");
    const blockComponent = this.getBlockComponentById(blockId);

    if (!block || !shellElement) {
      return;
    }

    // Persist editable table cells before resize triggers re-render.
    blockComponent?.persistTableData?.();

    const rect = shellElement.getBoundingClientRect();

    this.handleBlockResizeStart({
      stopPropagation() {},
      detail: {
        blockId,
        startX: event.clientX,
        startY: event.clientY,
        pageX: event.pageX,
        pageY: event.pageY,
        screenX: event.screenX,
        screenY: event.screenY,
        startWidth: rect.width,
        startHeight: rect.height,
        imageAspectRatio:
          block.type === "image"
            ? blockComponent?.getImageAspectRatio?.()
            : null,
        resizeDirection
      }
    });
  }

  handleBlockResizeStart(event) {
    event.stopPropagation();

    const {
      blockId,
      startX,
      startY,
      pageX,
      pageY,
      screenX,
      screenY,
      startWidth,
      startHeight,
      imageAspectRatio,
      resizeDirection
    } = event.detail;
    const block = this.findBlockById(blockId);

    if (!block) {
      return;
    }

    // Keep focus/selection anchored to the same block while resizing.
    this.selectedKind = "block";
    this.selectedBlockId = blockId;
    this.selectedRegionId = this.findRegionIdForBlock(blockId);

    // Prevent stale drag state from interfering with resize gestures.
    this.blockMoveState = null;
    this.draggedType = null;
    this.draggedField = null;
    this.draggedBlockId = null;
    this.draggedBlockRegionId = null;

    this.saveHistory();
    const regionId = this.findRegionIdForBlock(blockId);

    this.resizeState = {
      kind: "block",
      blockId,
      regionId,
      startX,
      startY,
      startPageX: Number.isFinite(pageX) ? pageX : null,
      startPageY: Number.isFinite(pageY) ? pageY : null,
      startScreenX: Number.isFinite(screenX) ? screenX : null,
      startScreenY: Number.isFinite(screenY) ? screenY : null,
      startWidth: Number(block.styles.width) || startWidth || 180,
      startHeight: Number(block.styles.height) || startHeight || 80,
      blockType: block.type,
      imageAspectRatio:
        block.type === "image"
          ? Number(imageAspectRatio || block.imageAspectRatio) || null
          : null,
      imageHorizontalChrome:
        block.type === "image" ? this.getImageBlockChrome(block).horizontal : 0,
      imageVerticalChrome:
        block.type === "image" ? this.getImageBlockChrome(block).vertical : 0,
      resizeDirection: resizeDirection || "se",
      startBlockX: Number.isFinite(block.styles?.x) ? block.styles.x : 0,
      startBlockY: Number.isFinite(block.styles?.y) ? block.styles.y : 0,
      lastClientX: startX,
      lastClientY: startY,
      accumulatedDeltaX: 0,
      accumulatedDeltaY: 0
    };

    if (regionId) {
      this.showDragGrid(regionId);
    }

    document.body.style.cursor = this.getResizeCursor(
      this.resizeState.resizeDirection
    );
    document.body.style.userSelect = "none";
  }

  getResizeCursor(direction) {
    const normalized = (direction || "se").toLowerCase();
    if (normalized === "n" || normalized === "s") {
      return "ns-resize";
    }
    if (normalized === "e" || normalized === "w") {
      return "ew-resize";
    }
    if (normalized === "ne" || normalized === "sw") {
      return "nesw-resize";
    }
    return "nwse-resize";
  }

  getImageBlockChrome(block) {
    const padding = Math.max(0, this.toNumber(block?.styles?.padding));
    const borderWidth =
      block?.styles?.borderStyle === "none"
        ? 0
        : Math.max(0, this.toNumber(block?.styles?.borderWidth));
    const chrome = (padding + borderWidth) * 2;

    return { horizontal: chrome, vertical: chrome };
  }

  getAspectConstrainedImageGeometry({
    bounds,
    tentativeWidth,
    tentativeHeight,
    fromWest,
    fromEast,
    fromNorth,
    fromSouth,
    minWidth,
    minHeight
  }) {
    const ratio = Number(this.resizeState?.imageAspectRatio);
    if (!(ratio > 0)) {
      return null;
    }

    const horizontalChrome = Math.max(
      0,
      Number(this.resizeState.imageHorizontalChrome) || 0
    );
    const verticalChrome = Math.max(
      0,
      Number(this.resizeState.imageVerticalChrome) || 0
    );
    const startWidth = this.resizeState.startWidth;
    const startHeight = this.resizeState.startHeight;
    const startX = this.resizeState.startBlockX;
    const startY = this.resizeState.startBlockY;
    const maximumWidth = Math.max(
      1,
      fromWest ? startX + startWidth : bounds.maxWidth - startX
    );
    const maximumHeight = Math.max(
      1,
      fromNorth ? startY + startHeight : bounds.maxHeight - startY
    );
    const minimumWidth = Math.max(
      minWidth,
      horizontalChrome + 1,
      horizontalChrome + Math.max(1, minHeight - verticalChrome) * ratio
    );
    const minimumHeight = Math.max(
      minHeight,
      verticalChrome + 1,
      verticalChrome + Math.max(1, minWidth - horizontalChrome) / ratio
    );
    const horizontalChange =
      Math.abs(tentativeWidth - startWidth) / Math.max(1, startWidth);
    const verticalChange =
      Math.abs(tentativeHeight - startHeight) / Math.max(1, startHeight);
    const hasHorizontalHandle = fromWest || fromEast;
    const hasVerticalHandle = fromNorth || fromSouth;
    const resizeFromWidth =
      hasHorizontalHandle &&
      (!hasVerticalHandle || horizontalChange >= verticalChange);

    let width;
    let height;
    if (resizeFromWidth) {
      const aspectMaximumWidth =
        horizontalChrome + Math.max(1, maximumHeight - verticalChrome) * ratio;
      const allowedMaximumWidth = Math.max(
        1,
        Math.min(maximumWidth, aspectMaximumWidth)
      );
      width = this.clampNumber(
        tentativeWidth,
        Math.min(minimumWidth, allowedMaximumWidth),
        allowedMaximumWidth
      );
      height = verticalChrome + Math.max(1, width - horizontalChrome) / ratio;
    } else {
      const aspectMaximumHeight =
        verticalChrome + Math.max(1, maximumWidth - horizontalChrome) / ratio;
      const allowedMaximumHeight = Math.max(
        1,
        Math.min(maximumHeight, aspectMaximumHeight)
      );
      height = this.clampNumber(
        tentativeHeight,
        Math.min(minimumHeight, allowedMaximumHeight),
        allowedMaximumHeight
      );
      width = horizontalChrome + Math.max(1, height - verticalChrome) * ratio;
    }

    width = this.roundLayoutValue(width);
    height = this.roundLayoutValue(height);

    return {
      width,
      height,
      x: fromWest ? startX + startWidth - width : startX,
      y: fromNorth ? startY + startHeight - height : startY
    };
  }

  handleWindowMouseMove(event) {
    if (!this.enablePointerBlockMove) {
      this.blockMoveState = null;
    }

    if (
      this.enablePointerBlockMove &&
      this.paletteDragState &&
      !this.resizeState
    ) {
      const deltaX = Math.abs(event.clientX - this.paletteDragState.startX);
      const deltaY = Math.abs(event.clientY - this.paletteDragState.startY);
      const moved = this.paletteDragState.moved || deltaX > 4 || deltaY > 4;

      this.paletteDragState = {
        ...this.paletteDragState,
        currentX: event.clientX,
        currentY: event.clientY,
        moved
      };

      if (moved) {
        this.draggedType = this.paletteDragState.type;
        this.draggedField = this.paletteDragState.field;
        this.draggedBlockId = null;
        this.draggedBlockRegionId = null;

        const dropTarget =
          this.getDropTargetAtPoint(event.clientX, event.clientY) ||
          this.getNearestDropTarget(event.clientX, event.clientY);

        this.setPointerMoveCursor("copy");
        document.body.style.userSelect = "none";

        if (dropTarget?.regionId) {
          this.captureDropPointer(event, dropTarget.regionId);
          this.showDragGrid(dropTarget.regionId);
          this.updateNewBlockDropGuides(dropTarget.regionId, event);
        }
      }
    }

    if (this.sidebarResizeState) {
      const delta = event.clientX - this.sidebarResizeState.startX;
      const nextWidth = Math.max(
        this.sidebarMinWidth,
        Math.min(
          this.sidebarMaxWidth,
          this.sidebarResizeState.startWidth + delta
        )
      );

      this.sidebarWidth = nextWidth;
      return;
    }

    if (this.propertiesResizeState) {
      const delta = this.propertiesResizeState.startX - event.clientX;
      const nextWidth = Math.max(
        this.propertiesPanelMinWidth,
        Math.min(
          this.propertiesPanelMaxWidth,
          this.propertiesResizeState.startWidth + delta
        )
      );
      this.propertiesPanelWidth = nextWidth;
      return;
    }

    if (
      this.enablePointerBlockMove &&
      this.blockMoveState &&
      !this.resizeState
    ) {
      const deltaX = Math.abs(event.clientX - this.blockMoveState.startX);
      const deltaY = Math.abs(event.clientY - this.blockMoveState.startY);
      const moved = this.blockMoveState.moved || deltaX > 4 || deltaY > 4;

      this.blockMoveState = {
        ...this.blockMoveState,
        currentX: event.clientX,
        currentY: event.clientY,
        moved
      };

      if (moved) {
        const dropTarget =
          this.getDropTargetAtPoint(event.clientX, event.clientY) ||
          this.getNearestDropTarget(event.clientX, event.clientY);
        const isCrossRegionMove = Boolean(
          dropTarget?.regionId &&
          dropTarget.regionId !== this.blockMoveState.regionId
        );

        if (dropTarget?.regionId) {
          this.blockMoveState = {
            ...this.blockMoveState,
            dropRegionId: dropTarget.regionId
          };
        }

        this.setPointerMoveCursor(isCrossRegionMove ? "copy" : "grabbing");
        document.body.style.userSelect = "none";
        this.showDragGrid(
          this.blockMoveState.dropRegionId || this.blockMoveState.regionId,
          dropTarget?.regionElement || this.blockMoveState.regionElement
        );

        this.moveBlockFreelyDuringDrag(this.blockMoveState);
      }
    }

    if (!this.resizeState) {
      return;
    }

    if (this.resizeState.kind === "block") {
      const bounds = this.getBlockRegionBounds(this.resizeState.blockId);
      const currentClientX = Number.isFinite(event.clientX)
        ? event.clientX
        : Number.isFinite(event.x)
          ? event.x
          : this.resizeState.lastClientX;
      const currentClientY = Number.isFinite(event.clientY)
        ? event.clientY
        : Number.isFinite(event.y)
          ? event.y
          : this.resizeState.lastClientY;
      const lineThickness = Math.max(
        1,
        Number(
          this.findBlockById(this.resizeState.blockId)?.styles?.lineThickness
        ) || 1
      );
      const minWidth =
        this.resizeState.blockType === "verticalLine" ? lineThickness : 32;
      const minHeight =
        this.resizeState.blockType === "divider" ? lineThickness : 24;
      const resizeDirection = (
        this.resizeState.resizeDirection || "se"
      ).toLowerCase();
      const deltaX = currentClientX - this.resizeState.startX;
      const deltaY = currentClientY - this.resizeState.startY;
      const fromWest = resizeDirection.includes("w");
      const fromEast = resizeDirection.includes("e");
      const fromNorth = resizeDirection.includes("n");
      const fromSouth = resizeDirection.includes("s");

      let nextX = this.resizeState.startBlockX;
      let nextY = this.resizeState.startBlockY;
      let nextWidth = this.resizeState.startWidth;
      let nextHeight = this.resizeState.startHeight;

      if (fromWest) {
        const maxLeftShift = this.resizeState.startWidth - minWidth;
        nextX = this.clampNumber(
          this.resizeState.startBlockX + deltaX,
          0,
          this.resizeState.startBlockX + maxLeftShift
        );
        nextWidth =
          this.resizeState.startWidth + (this.resizeState.startBlockX - nextX);
      } else if (fromEast) {
        const maxWidth = Math.max(
          minWidth,
          bounds.maxWidth - this.resizeState.startBlockX
        );
        nextWidth = this.clampNumber(
          this.resizeState.startWidth + deltaX,
          minWidth,
          maxWidth
        );
      }

      if (fromNorth) {
        const maxTopShift = this.resizeState.startHeight - minHeight;
        nextY = this.clampNumber(
          this.resizeState.startBlockY + deltaY,
          0,
          this.resizeState.startBlockY + maxTopShift
        );
        nextHeight =
          this.resizeState.startHeight + (this.resizeState.startBlockY - nextY);
      } else if (fromSouth) {
        const maxHeight = Math.max(
          minHeight,
          bounds.maxHeight - this.resizeState.startBlockY
        );
        nextHeight = this.clampNumber(
          this.resizeState.startHeight + deltaY,
          minHeight,
          maxHeight
        );
      }

      if (
        this.resizeState.blockType === "image" &&
        this.resizeState.imageAspectRatio
      ) {
        const imageGeometry = this.getAspectConstrainedImageGeometry({
          bounds,
          tentativeWidth: nextWidth,
          tentativeHeight: nextHeight,
          fromWest,
          fromEast,
          fromNorth,
          fromSouth,
          minWidth,
          minHeight
        });

        if (imageGeometry) {
          nextX = imageGeometry.x;
          nextY = imageGeometry.y;
          nextWidth = imageGeometry.width;
          nextHeight = imageGeometry.height;
        }
      }

      nextWidth = this.clampNumber(
        nextWidth,
        minWidth,
        Math.max(minWidth, bounds.maxWidth - nextX)
      );
      nextHeight = this.clampNumber(
        nextHeight,
        minHeight,
        Math.max(minHeight, bounds.maxHeight - nextY)
      );

      this.resizeState = {
        ...this.resizeState,
        lastClientX: currentClientX,
        lastClientY: currentClientY
      };

      this.documentModel = this.decorateDocument(
        this.updateBlocks(this.documentModel, (item) => {
          if (item.id !== this.resizeState.blockId) {
            return item;
          }

          const nextStyles = {
            ...(item.styles || {}),
            x: nextX,
            xRatio: null,
            y: nextY,
            height: nextHeight
          };

          nextStyles.width = nextWidth;
          nextStyles.widthRatio = null;
          if (item.type === "image") {
            nextStyles.heightManuallyResized = false;
          } else if (fromNorth || fromSouth) {
            nextStyles.heightManuallyResized = true;
          }

          if (item.type === "divider" && !Number.isFinite(nextStyles.x)) {
            nextStyles.x = 0;
            nextStyles.xRatio = null;
          }

          return this.clampBlockToRegion(
            {
              ...item,
              ...(item.type === "image" && this.resizeState.imageAspectRatio
                ? { imageAspectRatio: this.resizeState.imageAspectRatio }
                : {}),
              styles: nextStyles
            },
            this.resizeState.regionId
          );
        })
      );
      return;
    }

    const delta = event.clientY - this.resizeState.startY;
    const isFooterResize = this.resizeState.regionId === "footer";
    const requestedHeight = isFooterResize
      ? this.resizeState.startHeight - delta
      : this.resizeState.startHeight + delta;
    const nextHeight = this.clampFixedRegionHeight(
      this.resizeState.regionId,
      requestedHeight,
      this.documentModel
    );

    this.documentModel = this.decorateDocument(
      this.updateRegion(
        this.documentModel,
        this.resizeState.regionId,
        (region) => {
          return this.updateElementStyle(region, "height", nextHeight);
        }
      )
    );
  }

  handleWindowMouseUp(event) {
    // Some browsers do not emit a final mousemove at the exact release
    // coordinate. Commit that last resize delta before clearing the state.
    if (
      this.resizeState &&
      Number.isFinite(event?.clientX) &&
      Number.isFinite(event?.clientY)
    ) {
      this.handleWindowMouseMove(event);
    }

    if (!this.enablePointerBlockMove) {
      this.blockMoveState = null;
    }

    if (this.enablePointerBlockMove && this.paletteDragState) {
      const dragState = { ...this.paletteDragState };
      this.paletteDragState = null;

      if (dragState.moved) {
        const dropTarget =
          this.getDropTargetAtPoint(event.clientX, event.clientY) ||
          this.getNearestDropTarget(event.clientX, event.clientY);

        if (dropTarget?.regionId) {
          this.saveHistory();
          this.draggedType = dragState.type;
          this.draggedField = dragState.field;
          this.draggedBlockId = null;
          this.draggedBlockRegionId = null;
          this.documentModel = this.decorateDocument(
            this.addNewBlockAtPoint(dropTarget.regionId, event)
          );
        }

        this.handleDragEnd();
        document.body.style.userSelect = "";
        return;
      }
    }

    const now = Date.now();
    if (this.suppressMouseUpUntil && now <= this.suppressMouseUpUntil) {
      // Defensive: if anything re-created blockMoveState between drop and
      // this mouseup, prevent re-finalization.
      this.blockMoveState = null;
      return;
    }

    if (this.suppressBlockMoveUntil && now <= this.suppressBlockMoveUntil) {
      this.blockMoveState = null;
      return;
    }

    if (this.lastNativeDropAt && now - this.lastNativeDropAt <= 2000) {
      this.blockMoveState = null;
      return;
    }

    if (this.sidebarResizeState) {
      this.sidebarResizeState = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    if (this.propertiesResizeState) {
      this.propertiesResizeState = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    if (this.enablePointerBlockMove && this.blockMoveState) {
      const moveState = { ...this.blockMoveState };
      const movingBlock = this.findBlockById(moveState.blockId);

      if (movingBlock && moveState.moved) {
        if (!moveState.historySaved) {
          this.saveHistory();
        }

        const dropTarget =
          this.getDropTargetAtPoint(event.clientX, event.clientY) ||
          this.getNearestDropTarget(event.clientX, event.clientY);
        const targetRegionId = dropTarget?.regionId || moveState.regionId;
        const positionedBlock =
          targetRegionId === moveState.regionId &&
          Number.isFinite(moveState.previewX) &&
          Number.isFinite(moveState.previewY)
            ? this.clampBlockToRegion(
                {
                  ...movingBlock,
                  styles: {
                    ...(movingBlock.styles || {}),
                    width: this.getNormalizedMovableBlockWidth(
                      movingBlock,
                      targetRegionId,
                      this.toOptionalNumber(movingBlock?.styles?.width)
                    ),
                    x: moveState.previewX,
                    xRatio: null,
                    y: moveState.previewY
                  }
                },
                targetRegionId
              )
            : this.positionBlockForDrop(
                this.autoSizeBlockForRegion(movingBlock, targetRegionId),
                targetRegionId,
                event
              );
        const finalizedBlock = this.normalizeBlockAfterDrag(
          positionedBlock,
          targetRegionId,
          {
            preserveDimensions: true
          }
        );

        if (moveState.startedFromRepeatedPage) {
          this.selectedKind = "region";
          this.selectedBlockId = null;
          this.selectedRegionId = targetRegionId;
        }

        this.documentModel = this.decorateDocument(
          this.insertBlockIntoRegionAtIndex(
            this.removeBlock(this.documentModel, moveState.blockId),
            targetRegionId,
            finalizedBlock,
            this.findRegionById(targetRegionId)?.blocks?.length || 0
          )
        );

        moveState.regionId = targetRegionId;
      }

      this.blockMoveState = null;
      this.setPointerMoveCursor(null);
      document.body.style.userSelect = "";
      this.template
        .querySelectorAll(".block-shell.is-positioning")
        .forEach((element) => {
          element.classList.remove("is-positioning");
          element.style.transform = "";
        });
      this.hideDragGrid();

      if (moveState.startedFromRepeatedPage && moveState.moved) {
        this.suppressBlockSelectUntil = Date.now() + 250;
        this.selectedKind = "region";
        this.selectedBlockId = null;
        this.selectedRegionId = moveState.regionId;
      } else {
        this.selectedKind = "block";
        this.selectedBlockId = moveState.blockId;
        this.selectedRegionId = moveState.regionId;
      }
      this.documentModel = this.decorateDocument(this.documentModel);
      this.handleDragEnd();
    } else if (!this.enablePointerBlockMove && this.blockMoveState) {
      // Safety net: with pointer-move disabled, never let stale move state
      // finalize and override native drop coordinates.

      this.blockMoveState = null;
    }

    if (!this.resizeState) {
      return;
    }

    const resizedBlockId =
      this.resizeState.kind === "block" ? this.resizeState.blockId : null;
    const resizedRegionId =
      this.resizeState.kind === "block" ? this.resizeState.regionId : null;

    this.resizeState = null;
    this.setPointerMoveCursor(null);
    document.body.style.userSelect = "";
    this.hideDragGrid();
    this.suppressRegionClickUntil = Date.now() + 250;

    // Ensure focus remains on the resized block.
    if (resizedBlockId) {
      this.selectedKind = "block";
      this.selectedBlockId = resizedBlockId;
      this.selectedRegionId =
        resizedRegionId || this.findRegionIdForBlock(resizedBlockId);
    }
  }

  handleSidebarResizeStart(event) {
    event.preventDefault();
    event.stopPropagation();

    this.sidebarResizeState = {
      startX: event.clientX,
      startWidth: this.sidebarWidth
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  setPointerMoveCursor(mode) {
    const builder = this.template.querySelector(".builder");

    document.body.style.cursor = mode || "";

    if (!builder) {
      return;
    }

    builder.classList.remove("block-move-active", "block-move-copy");

    if (mode === "copy") {
      builder.classList.add("block-move-active", "block-move-copy");
      return;
    }

    if (mode === "grabbing") {
      builder.classList.add("block-move-active");
    }
  }

  handlePropertiesResizeStart(event) {
    event.preventDefault();
    event.stopPropagation();

    this.propertiesResizeState = {
      startX: event.clientX,
      startWidth: this.propertiesPanelWidth
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  moveBlockFreelyDuringDrag(moveState) {
    const block = this.findBlockById(moveState.blockId);

    if (!block) {
      return;
    }

    const blockElement =
      moveState.blockElement || this.getBlockShellElement(moveState.blockId);

    if (!blockElement) {
      return;
    }

    const nextPosition = this.getBlockNextPosition(moveState);
    const translateX = nextPosition.x - moveState.initialX;
    const translateY = nextPosition.y - moveState.initialY;

    blockElement.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    blockElement.style.willChange = "transform";
    blockElement.classList.add("is-positioning");

    this.blockMoveState = {
      ...this.blockMoveState,
      previewX: nextPosition.x,
      previewY: nextPosition.y
    };

    this.updateDragPositionGuides(
      moveState.regionId,
      nextPosition.x,
      nextPosition.y,
      nextPosition.width,
      nextPosition.height
    );
  }

  getBlockNextPosition(moveState) {
    const metrics = this.getRegionContentMetrics(
      moveState.regionId,
      moveState.regionElement
    );
    const block = this.findBlockById(moveState.blockId);
    let blockWidth =
      this.toOptionalNumber(block?.styles?.width) ||
      this.getEstimatedBlockWidth(block);
    const blockHeight =
      this.toOptionalNumber(block?.styles?.height) ||
      this.getEstimatedBlockHeight(block);
    blockWidth = this.getNormalizedMovableBlockWidth(
      block,
      moveState.regionId,
      blockWidth
    );

    const maxX = Math.max(0, metrics.availableWidth - blockWidth);
    const maxY = Math.max(0, metrics.availableHeight - blockHeight);
    const rawX = moveState.initialX + (moveState.currentX - moveState.startX);
    const rawY = moveState.initialY + (moveState.currentY - moveState.startY);

    return {
      x: this.clampNumber(this.snapToGrid(rawX), 0, maxX),
      y: this.clampNumber(this.snapToGrid(rawY), 0, maxY),
      width: blockWidth,
      height: blockHeight
    };
  }

  clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  snapToGrid(value) {
    const gridSize = this.dragGridSize;

    if (!Number.isFinite(value) || gridSize <= 1) {
      return value;
    }

    return Math.round(value / gridSize) * gridSize;
  }

  updateNewBlockDropGuides(regionId, event) {
    const regionElement = this.getRegionElementById(regionId);

    if (
      !regionElement ||
      typeof event?.clientX !== "number" ||
      typeof event?.clientY !== "number"
    ) {
      return;
    }

    const block = this.createBlock(this.draggedType, this.draggedField);
    const regionRect = regionElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(regionElement);
    const paddingLeft = this.toCssNumber(computedStyle.paddingLeft);
    const paddingTop = this.toCssNumber(computedStyle.paddingTop);
    const paddingRight = this.toCssNumber(computedStyle.paddingRight);
    const paddingBottom = this.toCssNumber(computedStyle.paddingBottom);
    const availableWidth = Math.max(
      32,
      regionElement.clientWidth - paddingLeft - paddingRight
    );
    const availableHeight = Math.max(
      24,
      regionElement.clientHeight - paddingTop - paddingBottom
    );
    const blockWidth =
      this.toOptionalNumber(block.styles?.width) ||
      this.getEstimatedBlockWidth(block);
    const blockHeight =
      this.toOptionalNumber(block.styles?.height) ||
      this.getEstimatedBlockHeight(block);
    const rawX = event.clientX - regionRect.left - paddingLeft;
    const rawY = event.clientY - regionRect.top - paddingTop;
    const nextX = this.clampNumber(
      this.snapToGrid(rawX - blockWidth / 2),
      0,
      Math.max(0, availableWidth - blockWidth)
    );
    const nextY = this.clampNumber(
      this.snapToGrid(rawY - blockHeight / 2),
      0,
      Math.max(0, availableHeight - blockHeight)
    );

    this.updateDragPositionGuides(
      regionId,
      nextX,
      nextY,
      blockWidth,
      blockHeight
    );
  }

  updateExistingBlockDropGuides(regionId, event) {
    const draggedBlock = this.findBlockById(this.draggedBlockId);
    if (!draggedBlock) {
      return;
    }

    const positioned = this.positionBlockForDrop(
      draggedBlock,
      regionId,
      event,
      {
        anchorMode: "pointer"
      }
    );

    const width =
      this.toOptionalNumber(positioned?.styles?.width) ||
      this.getEstimatedBlockWidth(positioned);
    const height =
      this.toOptionalNumber(positioned?.styles?.height) ||
      this.getEstimatedBlockHeight(positioned);
    const x = this.toOptionalCoordinate(positioned?.styles?.x) ?? 0;
    const y = this.toOptionalCoordinate(positioned?.styles?.y) ?? 0;

    this.updateDragPositionGuides(regionId, x, y, width, height);
  }

  updateDragPositionGuides(regionId, x, y, width, height) {
    if (!regionId) {
      return;
    }

    this.dragGuideState = {
      regionId,
      x,
      y,
      width,
      height
    };

    this.applyDragPositionGuides(this.dragGuideState);
  }

  applyDragPositionGuides(guideState) {
    if (!guideState?.regionId) {
      return;
    }

    const regionElement = this.getRegionElementById(guideState.regionId);

    if (!regionElement) {
      return;
    }

    const x = Number(guideState.x) || 0;
    const y = Number(guideState.y) || 0;
    const width = Number(guideState.width) || 0;
    const height = Number(guideState.height) || 0;
    const left = Math.round(x);
    const top = Math.round(y);
    const right = Math.round(x + width);
    const bottom = Math.round(y + height);
    const centerX = Math.round(x + width / 2);
    const centerY = Math.round(y + height / 2);

    regionElement.style.setProperty("--drag-guide-left", `${left}px`);
    regionElement.style.setProperty("--drag-guide-right", `${right}px`);
    regionElement.style.setProperty("--drag-guide-center-x", `${centerX}px`);
    regionElement.style.setProperty("--drag-guide-top", `${top}px`);
    regionElement.style.setProperty("--drag-guide-bottom", `${bottom}px`);
    regionElement.style.setProperty("--drag-guide-center-y", `${centerY}px`);
  }

  applyActiveDragGridAndGuides() {
    if (!this.dragGridRegionId) {
      return;
    }

    const regionElement = this.getRegionElementById(this.dragGridRegionId);

    if (!regionElement) {
      return;
    }

    this.applyDragGridInsets(regionElement);
    regionElement.classList.add("drag-position-grid");
  }

  clearDragPositionGuides(regionElement) {
    [
      "--drag-guide-left",
      "--drag-guide-right",
      "--drag-guide-center-x",
      "--drag-guide-top",
      "--drag-guide-bottom",
      "--drag-guide-center-y",
      "--drag-guide-padding-left",
      "--drag-guide-padding-top"
    ].forEach((propertyName) => {
      regionElement.style.removeProperty(propertyName);
    });
  }

  showDragGrid(regionId, preferredRegionElement = null) {
    if (!regionId) {
      return;
    }

    if (this.dragGridRegionId && this.dragGridRegionId !== regionId) {
      this.hideDragGrid();
    }

    const regionElement =
      preferredRegionElement || this.getRegionElementById(regionId);

    if (!regionElement) {
      this.dragGridRegionId = regionId;
      return;
    }

    this.dragGridRegionId = regionId;
    this.applyDragGridInsets(regionElement);
    regionElement.classList.add("drag-position-grid");

    if (this.dragGuideState?.regionId === regionId) {
      this.applyDragPositionGuides(this.dragGuideState);
    }
  }

  hideDragGrid() {
    this.template.querySelectorAll(".drag-position-grid").forEach((element) => {
      element.classList.remove("drag-position-grid");
      this.clearDragPositionGuides(element);
      element.style.removeProperty("--drag-grid-inset-top");
      element.style.removeProperty("--drag-grid-inset-right");
      element.style.removeProperty("--drag-grid-inset-bottom");
      element.style.removeProperty("--drag-grid-inset-left");
    });

    this.dragGridRegionId = null;
    this.dragGuideState = null;
    this.dragGuideState = null;
  }

  applyDragGridInsets(regionElement) {
    if (!regionElement) {
      return;
    }

    const computedStyle = window.getComputedStyle(regionElement);
    regionElement.style.setProperty(
      "--drag-grid-inset-top",
      computedStyle.paddingTop || "0px"
    );
    regionElement.style.setProperty(
      "--drag-grid-inset-right",
      computedStyle.paddingRight || "0px"
    );
    regionElement.style.setProperty(
      "--drag-grid-inset-bottom",
      computedStyle.paddingBottom || "0px"
    );
    regionElement.style.setProperty(
      "--drag-grid-inset-left",
      computedStyle.paddingLeft || "0px"
    );
  }

  getBlockShellElement(blockId) {
    if (!blockId) {
      return null;
    }

    return this.template.querySelector(
      `.block-shell[data-block-id="${blockId}"]`
    );
  }

  getRegionElementById(regionId) {
    if (!regionId) {
      return null;
    }

    return this.template.querySelector(
      `.pdf-region[data-region-id="${regionId}"]`
    );
  }

  getDropTargetAtPoint(clientX, clientY) {
    const regions = Array.from(this.template.querySelectorAll(".pdf-region"));

    for (const region of regions) {
      const rect = region.getBoundingClientRect();
      const isInside =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;

      if (isInside && region.dataset.regionId) {
        return {
          regionId: region.dataset.regionId,
          regionElement: region
        };
      }
    }

    return null;
  }

  getNearestDropTarget(clientX, clientY) {
    const regions = Array.from(this.template.querySelectorAll(".pdf-region"));
    let nearestTarget = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const region of regions) {
      if (!region.dataset.regionId) {
        continue;
      }

      const rect = region.getBoundingClientRect();
      const horizontalDistance =
        clientX < rect.left
          ? rect.left - clientX
          : Math.max(0, clientX - rect.right);
      const verticalDistance =
        clientY < rect.top
          ? rect.top - clientY
          : Math.max(0, clientY - rect.bottom);
      const distance = horizontalDistance + verticalDistance;

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestTarget = {
          regionId: region.dataset.regionId,
          regionElement: region
        };
      }
    }

    return nearestTarget;
  }

  findRegionIdForBlock(blockId) {
    if (!blockId) {
      return null;
    }

    for (const region of this.getAllRegions(this.documentModel)) {
      if ((region.blocks || []).some((block) => block.id === blockId)) {
        return region.id;
      }
    }

    return null;
  }

  clampBlockToRegion(block, regionId) {
    if (!block) {
      return null;
    }

    const bounds = this.getBlockRegionBounds(block.id, regionId);
    const styles = {
      ...(block.styles || {})
    };

    if (
      (block.type === "image" ||
        block.type === "table" ||
        block.type === "verticalLine") &&
      !Number.isFinite(styles.width)
    ) {
      styles.width = this.getInitialBlockWidth(block.type, block.content || "");
      styles.widthRatio = null;
    }

    if (block.type === "divider") {
      if (!Number.isFinite(styles.x)) {
        styles.x = 0;
      }
      if (!Number.isFinite(styles.width)) {
        styles.width = bounds.maxWidth;
      }
    }

    if (styles.width) {
      const nextWidth = Math.min(this.toNumber(styles.width), bounds.maxWidth);

      if (nextWidth !== styles.width) {
        styles.widthRatio = null;
      }

      styles.width = nextWidth;
    }

    if (
      (block.type === "image" ||
        block.type === "table" ||
        block.type === "verticalLine") &&
      !Number.isFinite(styles.width)
    ) {
      styles.width = this.getInitialBlockWidth(block.type, block.content || "");
      styles.widthRatio = null;
    }

    if (
      (block.type === "text" || block.type === "field") &&
      Number.isFinite(styles.width)
    ) {
      // Allow manual horizontal resize for text/field blocks.
      // We only clamp to region bounds/min width, without forcing
      // back to the "preferred" baseline width.
      const requestedWidth = this.toNumber(styles.width);
      const nextWidth = this.clampNumber(requestedWidth, 32, bounds.maxWidth);

      if (nextWidth !== styles.width) {
        styles.widthRatio = null;
      }

      styles.width = nextWidth;
    }

    if (styles.height) {
      styles.height = Math.min(this.toNumber(styles.height), bounds.maxHeight);
    }

    const blockWidth =
      this.toOptionalNumber(styles.width) ||
      this.getEstimatedBlockWidth({ ...block, styles });
    const blockHeight =
      this.toOptionalNumber(styles.height) ||
      this.getEstimatedBlockHeight({ ...block, styles });

    if (Number.isFinite(styles.x)) {
      const nextX = this.clampNumber(
        styles.x,
        0,
        Math.max(0, bounds.maxWidth - blockWidth)
      );

      if (nextX !== styles.x) {
        styles.xRatio = null;
      }

      styles.x = nextX;
    }

    if (Number.isFinite(styles.y)) {
      styles.y = this.clampNumber(
        styles.y,
        0,
        Math.max(0, bounds.maxHeight - blockHeight)
      );
    }

    return {
      ...block,
      styles
    };
  }

  getBlockRegionBounds(blockId, regionId = null) {
    const resolvedRegionId = regionId || this.findRegionIdForBlock(blockId);
    const metrics = this.getRegionContentMetrics(resolvedRegionId);

    return {
      rectLeft:
        this.toNumber(metrics.rect?.left) + this.toNumber(metrics.paddingLeft),
      rectTop:
        this.toNumber(metrics.rect?.top) + this.toNumber(metrics.paddingTop),
      maxWidth: metrics.availableWidth,
      maxHeight: metrics.availableHeight
    };
  }

  getRegionContentMetrics(regionId, preferredRegionElement = null) {
    const regionElement =
      preferredRegionElement || this.getRegionElementById(regionId);

    if (!regionElement) {
      return {
        rect: {
          left: 0,
          top: 0,
          width: this.pageWidth,
          height: this.pageHeight
        },
        paddingLeft: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        availableWidth: this.pageWidth,
        availableHeight: this.pageHeight
      };
    }

    const rect = regionElement.getBoundingClientRect();
    const styles = window.getComputedStyle(regionElement);
    const paddingLeft = this.toCssNumber(styles.paddingLeft);
    const paddingTop = this.toCssNumber(styles.paddingTop);
    const paddingRight = this.toCssNumber(styles.paddingRight);
    const paddingBottom = this.toCssNumber(styles.paddingBottom);

    return {
      rect,
      paddingLeft,
      paddingTop,
      paddingRight,
      paddingBottom,
      availableWidth: Math.max(
        32,
        regionElement.clientWidth - paddingLeft - paddingRight
      ),
      availableHeight: Math.max(
        24,
        regionElement.clientHeight - paddingTop - paddingBottom
      )
    };
  }

  getLogicalRegionAvailableWidth(regionId, documentModel = this.documentModel) {
    const model = documentModel || this.documentModel;
    const pagePadding = this.toNumber(
      model?.pagePadding ?? this.defaultPagePadding
    );
    const printableWidth = Math.max(32, this.pageWidth - pagePadding * 2);
    const bodyGap = 16;
    const bodyLayout = model?.body?.layout === "two" ? "two" : "one";
    const region = this.getRegionByIdFromModel(regionId, model);
    const regionPadding = this.toNumber(
      region?.styles?.padding ??
        model?.globalElementPadding ??
        this.defaultElementPadding
    );
    const regionBorderWidth = this.toNumber(region?.styles?.borderWidth ?? 1);
    let sectionOuterWidth =
      regionId?.includes("body-") && bodyLayout === "two"
        ? Math.max(32, (printableWidth - bodyGap) / 2)
        : printableWidth;
    if (regionId === "header" || regionId === "footer") {
      sectionOuterWidth = this.clampNumber(
        this.toNumber(region?.styles?.width ?? printableWidth),
        40,
        printableWidth
      );
    }

    return Math.max(
      32,
      sectionOuterWidth - regionPadding * 2 - regionBorderWidth * 2
    );
  }

  getRegionByIdFromModel(regionId, documentModel = this.documentModel) {
    if (!regionId || !documentModel) {
      return null;
    }

    return (
      [
        documentModel.header,
        ...(documentModel.body?.sections || []),
        ...(documentModel.manualPages || []).flatMap(
          (page) => page?.body?.sections || []
        ),
        documentModel.footer
      ].find((region) => region?.id === regionId) || null
    );
  }

  getBlockHorizontalGeometry(
    block,
    region = null,
    documentModel = this.documentModel
  ) {
    const rawWidth = this.toOptionalNumber(block?.styles?.width);
    const rawX = this.toOptionalCoordinate(block?.styles?.x);
    const availableWidth = this.getLogicalRegionAvailableWidth(
      region?.id,
      documentModel
    );
    const storedWidthRatio = this.toOptionalRatio(block?.styles?.widthRatio);
    const storedXRatio = this.toOptionalRatio(block?.styles?.xRatio);
    const width = this.resolveProportionalValue(
      rawWidth,
      storedWidthRatio,
      availableWidth
    );
    const x =
      rawX === null
        ? null
        : this.resolveProportionalValue(
            rawX,
            storedXRatio,
            availableWidth,
            true
          );

    return {
      width,
      x,
      widthRatio:
        width === null
          ? null
          : this.getNormalizedRatio(
              storedWidthRatio,
              rawWidth ?? width,
              availableWidth
            ),
      xRatio:
        x === null
          ? null
          : this.getNormalizedRatio(storedXRatio, rawX ?? x, availableWidth)
    };
  }

  resolveProportionalValue(rawValue, ratio, availableWidth, allowZero = false) {
    if (ratio !== null) {
      return this.roundLayoutValue(ratio * availableWidth);
    }

    if (allowZero && rawValue === 0) {
      return 0;
    }

    return rawValue;
  }

  getNormalizedRatio(storedRatio, rawValue, availableWidth) {
    if (storedRatio !== null) {
      return storedRatio;
    }

    if (
      !Number.isFinite(rawValue) ||
      !Number.isFinite(availableWidth) ||
      availableWidth <= 0
    ) {
      return null;
    }

    return rawValue / availableWidth;
  }

  roundLayoutValue(value) {
    return Math.round(value * 1000) / 1000;
  }

  copySelectedBlock() {
    if (!this.selectedBlockId || this.editingTextBlockId) {
      return;
    }

    const block = this.findBlockById(this.selectedBlockId);

    if (!block) {
      return;
    }

    this.copiedBlock = this.cloneBlockForClipboard(block);
  }

  pasteCopiedBlock() {
    if (!this.copiedBlock || this.editingTextBlockId) {
      return;
    }

    const sourceBlock = this.cloneBlockForClipboard(this.copiedBlock);
    const block = this.preparePastedBlock(sourceBlock);
    const selectedRegionId = this.selectedBlockId
      ? this.findRegionIdForBlock(this.selectedBlockId)
      : this.selectedRegionId;
    const regionId = selectedRegionId || "body-1";
    const insertIndex = this.getPasteInsertIndex(regionId);

    this.saveHistory();

    this.documentModel = this.decorateDocument(
      this.insertBlockIntoRegionAtIndex(
        this.documentModel,
        regionId,
        block,
        insertIndex
      )
    );

    this.selectedKind = "block";
    this.selectedBlockId = block.id;
    this.selectedRegionId = regionId;
  }

  cloneBlockForClipboard(block) {
    const clone = JSON.parse(JSON.stringify(block));

    return this.stripBlockRuntimeState(clone);
  }

  preparePastedBlock(block) {
    const clonedBlock = this.assignNewBlockIds(block);
    const styles = {
      ...(clonedBlock.styles || {})
    };

    if (styles.x !== null && styles.x !== undefined) {
      styles.x = this.toNumber(styles.x) + 16;
      styles.xRatio = null;
    }

    if (styles.y !== null && styles.y !== undefined) {
      styles.y = this.toNumber(styles.y) + 16;
    }

    return this.decorateBlock({
      ...clonedBlock,
      styles
    });
  }

  assignNewBlockIds(value) {
    if (Array.isArray(value)) {
      return value.map((item) => this.assignNewBlockIds(item));
    }

    if (!value || typeof value !== "object") {
      return value;
    }

    const nextValue = {};

    Object.keys(value).forEach((key) => {
      nextValue[key] =
        key === "id" ? this.createId() : this.assignNewBlockIds(value[key]);
    });

    return nextValue;
  }

  stripBlockRuntimeState(block) {
    return Object.fromEntries(
      Object.entries(block).filter(([key]) => !BLOCK_RUNTIME_KEYS.has(key))
    );
  }

  getPasteInsertIndex(regionId) {
    const region = this.findRegionById(regionId);
    const blocks = region?.blocks || [];

    if (!this.selectedBlockId) {
      return blocks.length;
    }

    const selectedIndex = blocks.findIndex(
      (block) => block.id === this.selectedBlockId
    );

    return selectedIndex === -1 ? blocks.length : selectedIndex + 1;
  }

  deleteSelectedBlock() {
    if (!this.selectedBlockId) {
      return;
    }

    this.saveHistory();
    this.documentModel = this.decorateDocument(
      this.removeBlock(this.documentModel, this.selectedBlockId)
    );
    this.selectedKind = "region";
    this.selectedBlockId = null;
  }

  showHtml() {
    this.htmlOutput = this.getGeneratedHtml();
    this.isHtmlOpen = true;

    window.setTimeout(() => {
      this.renderHtmlOutput();
    }, 0);
  }

  closeHtml() {
    this.isHtmlOpen = false;
  }

  openPreview() {
    this.isPreviewOpen = true;
    if (!this.previewRecordId) {
      this.previewRecordId = this.recordId || this.pageRefRecordId || "";
    }
    this.generateCurrentPreview();
  }

  handlePreviewRecordIdChange(event) {
    this.previewRecordId = event.target.value;
  }

  handleGeneratePreview() {
    this.generateCurrentPreview();
  }

  generateCurrentPreview() {
    const effectiveRecordId = String(
      this.previewRecordId || this.recordId || this.pageRefRecordId || ""
    ).trim();
    const hasRecordContext = Boolean(effectiveRecordId);

    if (hasRecordContext && !this.selectedObjectApiName) {
      this.showToast(
        "Preview could not be generated",
        "Select an object before using a Record ID.",
        "error"
      );
      return;
    }

    if (!hasRecordContext) {
      this.previewFlow = null;
      this.previewHtml = this.getPreviewHtml();
      return;
    }

    const requestId = ++this.previewGenerationRequestId;
    this.isPreviewGenerating = true;
    renderPdfFlowForRecordPreview({
      objectApiName: this.selectedObjectApiName,
      recordId: effectiveRecordId,
      contentJson: JSON.stringify(this.stripRuntimeState(this.documentModel)),
      generatedHtml: this.getPreviewHtml(true)
    })
      .then((previewFlow) => {
        if (
          requestId !== this.previewGenerationRequestId ||
          !this.isPreviewOpen
        ) {
          return;
        }
        this.previewFlow = previewFlow;
      })
      .catch((error) => {
        if (requestId !== this.previewGenerationRequestId) {
          return;
        }
        this.templateStatus = "";
        this.showToast(
          "Preview could not be generated",
          this.getUserFacingErrorMessage(error),
          "error"
        );
      })
      .finally(() => {
        if (requestId === this.previewGenerationRequestId) {
          this.isPreviewGenerating = false;
        }
      });
  }

  @wire(CurrentPageReference)
  setCurrentPageReference(pageRef) {
    const pageRecordId =
      pageRef?.state?.recordId || pageRef?.attributes?.recordId;
    this.pageRefRecordId = pageRecordId || null;
  }

  closePreview() {
    this.isPreviewOpen = false;
    this.previewGenerationRequestId += 1;
    this.isPreviewGenerating = false;
    this.previewFlow = null;
  }

  renderPreviewFrame() {
    const previewContainer = this.template.querySelector(".preview-content");

    if (previewContainer && this.previewFlow) {
      this.renderPdfFlowPreview(previewContainer, this.previewFlow);
      return;
    }

    const html = this.previewHtml || this.getPreviewHtml();

    if (previewContainer) {
      const stylesHtml = [...html.matchAll(/<style[\s\S]*?<\/style>/gi)]
        .map((match) => match[0])
        .join("");
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const inlineLayoutStyle = `
                <style>
                    .preview-inline-root {
                        width: 100%;
                        padding: 24px;
                        box-sizing: border-box;
                    }
                    .preview-inline-root .pdf-page {
                        margin: 0 auto !important;
                        width: ${this.pageWidth}px !important;
                        height: ${this.pageHeight}px !important;
                        min-height: ${this.pageHeight}px !important;
                        max-height: ${this.pageHeight}px !important;
                        flex: 0 0 ${this.pageHeight}px !important;
                        overflow: hidden !important;
                        contain: layout paint !important;
                        box-sizing: border-box !important;
                        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18) !important;
                    }
                    .preview-inline-root .pdf-page + .pdf-page {
                        margin-top: 24px !important;
                    }
                </style>
            `;
      previewContainer.innerHTML = `${stylesHtml}${inlineLayoutStyle}<div class="preview-inline-root">${bodyMatch ? bodyMatch[1] : html}</div>`;
      previewContainer.scrollTop = 0;
      previewContainer.scrollLeft = 0;

      if (this.previewPaginationTimer) {
        window.clearTimeout(this.previewPaginationTimer);
        this.previewPaginationTimer = null;
      }
      // innerHTML has been parsed at this point. Reading table geometry below
      // forces layout, so delaying pagination only lets a later LWC render
      // replace the paginated DOM with the original two-page markup.
      this.markRecordPreviewRelatedLists(previewContainer);
      previewContainer
        .querySelectorAll(".preview-inline-root .pdf-page")
        .forEach((page) => this.fixRecordPreviewPageSize(page));
      // A preview without record data has the same fixed components as the
      // builder. Its HTML is already divided with the builder pagination
      // model, so running the record-aware DOM paginator here would measure
      // the placeholder related list again and move/crop unrelated blocks.
    }
  }

  renderPdfFlowPreview(previewContainer, previewFlow) {
    const pagePadding = Math.max(
      0,
      this.toNumber(this.documentModel.pagePadding)
    );
    const pageBackground = this.documentModel.pageBackground || "#ffffff";
    const contentWidth = Math.max(1, this.pageWidth - pagePadding * 2);
    const headerBodyGap =
      this.hasHeader && this.documentModel.repeatHeaderOnEachPage ? 10 : 0;
    // Dynamic Visualforce pages reserve the repeated header/footer as page
    // margins. Only the horizontal document padding remains; subtracting the
    // vertical padding here made the browser sheet 64px shorter than the PDF
    // and produced a spurious overflow page.
    const repeatedHeaderHeight =
      this.hasHeader && this.documentModel.repeatHeaderOnEachPage
        ? this.toNumber(this.header?.styles?.height ?? this.defaultHeaderHeight)
        : 0;
    const repeatedFooterHeight =
      this.hasFooter && this.documentModel.repeatFooterOnEachPage
        ? this.toNumber(this.footer?.styles?.height ?? this.defaultFooterHeight)
        : 0;
    const bodyCapacity = Math.max(
      160,
      this.pageHeight -
        repeatedHeaderHeight -
        headerBodyGap -
        repeatedFooterHeight
    );
    const parsedBody = document.createElement("div");
    parsedBody.innerHTML = previewFlow?.bodyHtml || "";
    const manualPages = Array.from(
      parsedBody.querySelectorAll('[data-db-preview-manual-page="true"]')
    ).map((page) => page.cloneNode(true));
    parsedBody
      .querySelectorAll('[data-db-preview-manual-page="true"]')
      .forEach((page) => page.remove());

    // renderPdfDocumentRegion emits the same header/body gap as a margin on
    // the body wrapper. The preview viewport already supplies that gap, so
    // retaining both shifts every body block down and inflates its measured
    // height by one extra gap.
    if (headerBodyGap > 0 && parsedBody.firstElementChild) {
      parsedBody.firstElementChild.style.marginTop = "0px";
    }

    previewContainer.innerHTML = `
            <style>
                .preview-flow-root { width:100%;padding:24px;box-sizing:border-box; }
                .preview-flow-root header,.preview-flow-root header *,
                .preview-flow-root footer,.preview-flow-root footer * { box-sizing:border-box; }
                .preview-flow-body-slice,.preview-flow-body-slice * { box-sizing:content-box; }
                .preview-flow-root .pdf-page { position:relative;display:flex;flex-direction:column;gap:0;width:${this.pageWidth}px;height:${this.pageHeight}px;min-height:${this.pageHeight}px;max-height:${this.pageHeight}px;margin:0 auto;background:${pageBackground};background-clip:border-box;overflow:hidden;contain:layout paint;outline:1px solid #d8dde6;box-shadow:0 2px 10px rgba(0,0,0,.18);box-sizing:border-box; }
                .preview-flow-root .pdf-page + .pdf-page { margin-top:24px; }
                .preview-flow-root header,.preview-flow-root footer { flex:0 0 auto; }
                .preview-flow-root p,.preview-flow-root h1,.preview-flow-root h2,.preview-flow-root h3,.preview-flow-root h4,.preview-flow-root h5,.preview-flow-root h6 { margin:0; }
                .preview-flow-root img { max-width:100%; }
                .preview-flow-root ul { list-style-type:disc;list-style-position:outside;margin:0 0 0 18px;padding-left:20px; }
                .preview-flow-root ol { list-style-type:decimal;list-style-position:outside;margin:0 0 0 18px;padding-left:20px; }
                .preview-flow-root li { display:list-item; }
            </style>
            <div class="preview-flow-root"></div>
        `;

    const previewRoot = previewContainer.querySelector(".preview-flow-root");
    const measurement = document.createElement("div");
    measurement.className = "preview-flow-body-slice";
    measurement.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;left:-100000px;top:0;width:${contentWidth}px;height:auto;overflow:visible;`;
    while (parsedBody.firstChild) {
      measurement.appendChild(parsedBody.firstChild);
    }
    previewContainer.appendChild(measurement);

    // The PDF renderer honours page-break-inside:avoid, whereas the screen
    // preview is built from clipped slices of one continuous DOM tree.
    // Add only the missing vertical space before a block that would cross
    // a slice boundary, so the whole block begins on the following page.
    Array.from(
      measurement.querySelectorAll(
        '[style*="page-break-inside:avoid"],[style*="break-inside:avoid"]'
      )
    ).forEach((block) => {
      const measurementTop = measurement.getBoundingClientRect().top;
      const blockRect = block.getBoundingClientRect();
      const blockTop = Math.max(0, blockRect.top - measurementTop);
      const blockHeight = Math.ceil(blockRect.height || 0);
      const pageOffset = blockTop % bodyCapacity;
      const availableHeight = bodyCapacity - pageOffset;
      const crossesPageBoundary =
        pageOffset > 0 &&
        blockHeight > availableHeight &&
        blockHeight <= bodyCapacity;

      if (crossesPageBoundary) {
        const currentMarginTop = parseFloat(block.style.marginTop || "0") || 0;
        block.style.marginTop = `${currentMarginTop + availableHeight}px`;
      }
    });

    const contentHeight = Math.max(
      bodyCapacity,
      measurement.scrollHeight || 0,
      Math.ceil(measurement.getBoundingClientRect().height || 0)
    );
    const primaryContent = Array.from(measurement.childNodes).map((node) =>
      node.cloneNode(true)
    );
    measurement.remove();

    const appendHtml = (parent, html) => {
      if (!html) {
        return;
      }
      const holder = document.createElement("div");
      holder.innerHTML = html;
      while (holder.firstChild) {
        parent.appendChild(holder.firstChild);
      }
    };
    const createPage = (
      pageNumber,
      bodyNodes,
      pageStart = 0,
      isManualPage = false
    ) => {
      const isPrimaryPage = pageNumber === 1;
      const isAutomaticOverflowPage = !isPrimaryPage && !isManualPage;
      const showPageHeader =
        this.hasHeader &&
        (isPrimaryPage || this.documentModel.repeatHeaderOnEachPage);
      const showPageFooter =
        this.hasFooter &&
        (isPrimaryPage || this.documentModel.repeatFooterOnEachPage);
      const viewportHeight =
        isAutomaticOverflowPage && !showPageHeader && !showPageFooter
          ? Math.max(1, this.pageHeight - pagePadding * 2)
          : bodyCapacity;
      const viewportTopGap = showPageHeader ? headerBodyGap : 0;
      const page = document.createElement("div");
      page.className = "pdf-page";
      page.dataset.previewPageKind = isManualPage
        ? "manual"
        : isPrimaryPage
          ? "primary"
          : "overflow";
      page.style.padding = `0 ${pagePadding}px`;

      if (showPageHeader) {
        appendHtml(page, previewFlow?.headerHtml);
      }

      const viewport = document.createElement("div");
      viewport.style.cssText = `position:relative;flex:0 0 ${viewportHeight}px;width:${contentWidth}px;height:${viewportHeight}px;min-height:${viewportHeight}px;max-height:${viewportHeight}px;margin-top:${viewportTopGap}px;overflow:hidden;`;
      const slice = document.createElement("div");
      slice.className = "preview-flow-body-slice";
      slice.style.cssText = `position:absolute;left:0;top:${-pageStart}px;width:${contentWidth}px;min-height:${bodyCapacity}px;overflow:visible;`;
      bodyNodes.forEach((node) => slice.appendChild(node.cloneNode(true)));
      viewport.appendChild(slice);
      page.appendChild(viewport);

      if (showPageFooter) {
        appendHtml(page, previewFlow?.footerHtml);
      }

      this.ensureRecordPreviewPageBadge(page, pageNumber);
      previewRoot.appendChild(page);
    };

    const dynamicPageCount = Math.max(
      1,
      Math.ceil(contentHeight / bodyCapacity)
    );
    for (let pageIndex = 0; pageIndex < dynamicPageCount; pageIndex += 1) {
      createPage(
        pageIndex + 1,
        primaryContent,
        pageIndex * bodyCapacity,
        false
      );
    }

    manualPages.forEach((manualPage, manualPageIndex) => {
      manualPage.style.pageBreakBefore = "auto";
      createPage(dynamicPageCount + manualPageIndex + 1, [manualPage], 0, true);
    });

    previewContainer.scrollTop = 0;
    previewContainer.scrollLeft = 0;
  }

  markRecordPreviewRelatedLists(previewContainer) {
    previewContainer
      .querySelectorAll(".preview-inline-root .pdf-body section")
      .forEach((section) => {
        Array.from(section.querySelectorAll("table")).forEach((table) => {
          let block = table;

          while (block?.parentElement && block.parentElement !== section) {
            block = block.parentElement;
          }

          if (block?.parentElement === section) {
            block.dataset.dbPreviewRelatedList = "true";
          }
        });
      });
  }

  ensureRecordPreviewPageBadge(page, pageNumber) {
    if (!page || pageNumber <= 1) {
      return;
    }

    let pageBadge = page.querySelector("[data-preview-page-badge]");
    if (!pageBadge) {
      pageBadge = document.createElement("div");
      pageBadge.dataset.previewPageBadge = "true";
      pageBadge.style.cssText =
        "position:absolute;top:8px;right:12px;padding:2px 8px;border-radius:999px;background:#0176d3;color:#fff;font-size:11px;font-weight:700;z-index:2;";
      page.appendChild(pageBadge);
    }
    pageBadge.textContent = `Page ${pageNumber}`;
  }

  fixRecordPreviewPageSize(page) {
    if (!page) {
      return;
    }

    const fixedWidth = `${this.pageWidth}px`;
    const fixedHeight = `${this.pageHeight}px`;
    page.style.setProperty("width", fixedWidth, "important");
    page.style.setProperty("height", fixedHeight, "important");
    page.style.setProperty("min-height", fixedHeight, "important");
    page.style.setProperty("max-height", fixedHeight, "important");
    page.style.setProperty("flex", `0 0 ${fixedHeight}`, "important");
    page.style.setProperty("overflow", "hidden", "important");
    page.style.setProperty("contain", "layout paint", "important");
    page.style.setProperty("box-sizing", "border-box", "important");
  }

  renderHtmlOutput() {
    const textarea = this.template.querySelector(".html-output");

    if (textarea) {
      textarea.value = this.htmlOutput || this.getGeneratedHtml();
    }
  }

  syncEditableText() {
    this.template
      .querySelectorAll("[data-text-style-id]")
      .forEach((element) => {
        const block = this.findBlockById(element.dataset.textStyleId);

        if (!block || element === document.activeElement) {
          return;
        }

        if (element.textContent !== block.content) {
          element.textContent = block.content || "";
        }
      });
  }

  syncPropertyControls() {
    const selectedElement = this.selectedElement;

    if (!selectedElement?.styles) {
      return;
    }

    this.template.querySelectorAll("[data-style]").forEach((element) => {
      const styleName = element.dataset.style;
      const value = selectedElement.styles[styleName];

      if (value === undefined || value === null) {
        return;
      }

      const normalizedValue =
        element.type === "color"
          ? this.getSafeColorInputValue(value)
          : styleName === "fontSize" &&
              element.classList?.contains("property-size-input")
            ? this.propertyFontSizeValue
            : String(value);

      if (element.value !== normalizedValue) {
        element.value = normalizedValue;
      }
    });

    const selectedBlock = this.selectedBlock;
    if (selectedBlock) {
      this.template.querySelectorAll("[data-key]").forEach((element) => {
        const value = selectedBlock[element.dataset.key];
        if (
          value !== undefined &&
          value !== null &&
          element.value !== String(value)
        ) {
          element.value = String(value);
        }
      });
    }
  }

  getSafeColorInputValue(value) {
    const stringValue = String(value || "").trim();

    if (/^#[0-9a-fA-F]{6}$/.test(stringValue)) {
      return stringValue;
    }

    return "#ffffff";
  }

  syncRichTextToolbar() {
    const toolbar = this.template.querySelector(".rich-text-toolbar");
    if (!toolbar) {
      return;
    }

    const colorInput = toolbar.querySelector(".rich-color");
    const fontSelect = toolbar.querySelector(".rich-select");
    const sizeSelect = toolbar.querySelector(".rich-size");
    const lineHeightSelect = toolbar.querySelector(".rich-line-height");

    if (colorInput) {
      colorInput.value = this.richTextColor;
    }

    if (fontSelect) {
      fontSelect.value = this.richTextFontFamily;
    }

    if (sizeSelect) {
      sizeSelect.value = this.richTextFontSize;
    }

    if (lineHeightSelect) {
      lineHeightSelect.value = this.richTextLineHeight;
    }
  }

  createDefaultDocument() {
    return this.decorateDocument({
      pagePadding: this.defaultPagePadding,
      pageBackground: "#ffffff",
      globalElementPadding: this.defaultElementPadding,
      showHeader: true,
      showBody: true,
      showFooter: true,
      repeatHeaderOnEachPage: true,
      repeatFooterOnEachPage: true,
      manualPageCount: 0,
      header: this.createRegion("header", "Header", this.defaultHeaderHeight),
      body: this.createBodyForLayout("one"),
      footer: this.createRegion("footer", "Footer", this.defaultFooterHeight)
    });
  }

  createBodyForLayout(layout, currentBody = null) {
    const currentSections = currentBody?.sections || [];
    const firstSection =
      currentSections[0] || this.createRegion("body-1", "Body", null);
    const secondSection =
      currentSections[1] || this.createRegion("body-2", "Body 2", null);
    const mergedSection = {
      ...firstSection,
      id: "body-1",
      label: "Body",
      blocks: [
        ...(firstSection.blocks || []),
        ...(layout === "one"
          ? currentSections.slice(1).flatMap((section) => section.blocks || [])
          : [])
      ]
    };

    return {
      layout,
      sections:
        layout === "two"
          ? [
              { ...firstSection, id: "body-1", label: "Body left" },
              { ...secondSection, id: "body-2", label: "Body right" }
            ]
          : [mergedSection]
    };
  }

  createRegion(id, label, height) {
    const styles = {
      background: "#ffffff",
      padding:
        this.documentModel?.globalElementPadding ?? this.defaultElementPadding,
      borderWidth: 0,
      borderStyle: "none",
      borderColor: "#c9c9c9",
      borderRadius: 4
    };

    if (height) {
      styles.height = height;
    }

    return {
      id,
      label,
      styles,
      blocks: []
    };
  }

  createBlock(type, field = null) {
    if (type === "relatedList" && this.hasRelatedListBlock()) {
      this.templateStatus = "";
      this.showToast(
        "Related list not added",
        "Only one related list block is allowed in this version.",
        "warning"
      );
      return null;
    }

    const content = this.getDefaultContent(type, field);
    const styles = {
      background: "transparent",
      padding:
        this.documentModel?.globalElementPadding ?? this.defaultElementPadding,
      borderWidth: 0,
      borderStyle: "none",
      borderColor: "#c9c9c9",
      borderRadius: 0,
      color: "#181818",
      colorExplicit: false,
      fontFamily: "Arial, sans-serif",
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      textAlign: "left",
      verticalAlign: "top",
      tableRows: type === "table" ? 3 : null,
      tableColumns: type === "table" ? 3 : null,
      tableCellPadding: type === "table" ? 8 : null,
      tableBorderWidth: type === "table" ? 1 : null,
      tableBorderColor: type === "table" ? "#c9c9c9" : null,
      tableCellVerticalAlign: type === "table" ? "top" : null,
      lineLength:
        type === "divider" ? null : type === "verticalLine" ? 120 : null,
      lineThickness: type === "divider" || type === "verticalLine" ? 1 : null,
      lineStyle: type === "divider" || type === "verticalLine" ? "solid" : null,
      lineColor:
        type === "divider" || type === "verticalLine" ? "#181818" : null,
      width: this.getInitialBlockWidth(type, content),
      widthRatio: null,
      height:
        type === "image"
          ? 140
          : type === "divider"
            ? 12
            : type === "verticalLine"
              ? 120
              : type === "relatedList"
                ? 100
                : type === "table"
                  ? DEFAULT_TABLE_HEIGHT
                  : null,
      x: null,
      xRatio: null,
      y: null
    };

    return this.decorateBlock({
      id: this.createId(),
      type,
      content,
      fieldApiName: field?.apiName || null,
      fieldLabel: field?.label || null,
      imageSrc: "",
      imageAlt: "",
      hasImage: false,
      tableData: type === "table" ? [] : null,
      relatedListRelationshipName: null,
      relatedListLabel: null,
      relatedListChildObjectApiName: null,
      relatedListColumns: [],
      relatedListZebraEnabled: true,
      relatedListOddRowColor: "#ffffff",
      relatedListEvenRowColor: "#ffffff",
      relatedListHeaderRowColor: "#e5e7eb",
      relatedListTextColor: "#181818",
      relatedListOddTextColor: "#181818",
      relatedListEvenTextColor: "#181818",
      relatedListFontSize: 12,
      relatedListBorderMode: "all",
      styles
    });
  }

  getInitialBlockWidth(type) {
    if (type === "image") {
      return 240;
    }

    if (type === "table") {
      return 360;
    }

    if (type === "relatedList") {
      return 520;
    }

    if (type === "verticalLine") {
      return 12;
    }

    if (type === "divider") {
      return null;
    }

    if (type === "text" || type === "field") {
      return 220;
    }

    return null;
  }

  getDefaultContent(type, field = null) {
    switch (type) {
      case "text":
        return "";
      case "field":
        return this.getDefaultFieldContent(field);
      case "divider":
        return "";
      case "image":
        return "";
      case "table":
        return "";
      case "relatedList":
        return "";
      case "verticalLine":
        return "";
      default:
        return "";
    }
  }

  getDefaultFieldContent(field = null) {
    const fieldName = field?.apiName || "Name";
    const fieldLabel = field?.label || fieldName;
    return this.getFieldVariableText(
      { apiName: fieldName, label: fieldLabel },
      this.fieldInsertMode
    );
  }

  decorateDocument(documentModel) {
    const model = this.migrateLineHeightModel(
      documentModel || this.createDefaultDocument()
    );
    const normalizedFixedRegionHeights =
      this.normalizeFixedRegionHeights(model);
    const geometryModel = {
      ...model,
      header: normalizedFixedRegionHeights.header,
      footer: normalizedFixedRegionHeights.footer
    };
    const manualPageCount = Math.max(
      0,
      this.toNumber(model.manualPageCount ?? 0)
    );
    const sourceManualPages = model.manualPages || [];
    const manualPages = Array.from({ length: manualPageCount }, (_, index) => {
      const existingPage = sourceManualPages[index];
      const pageKey = existingPage?.id || `manual-${index + 1}`;
      const defaultSections =
        model.body?.layout === "two"
          ? [
              this.createRegion(`${pageKey}-body-1`, "Body 1", null),
              this.createRegion(`${pageKey}-body-2`, "Body 2", null)
            ]
          : [this.createRegion(`${pageKey}-body-1`, "Body", null)];

      return {
        ...(existingPage || {}),
        id: pageKey,
        body: {
          layout:
            existingPage?.body?.layout === "two"
              ? "two"
              : model.body?.layout === "two"
                ? "two"
                : "one",
          sections: (existingPage?.body?.sections || defaultSections).map(
            (section) => {
              return this.decorateRegion(section, geometryModel);
            }
          )
        }
      };
    });

    return {
      ...model,
      lineHeightSchemaVersion: 3,
      pagePadding: this.toNumber(model.pagePadding ?? this.defaultPagePadding),
      pageBackground: normalizeColor(model.pageBackground, "#ffffff"),
      globalElementPadding: this.toNumber(
        model.globalElementPadding ?? this.defaultElementPadding
      ),
      showHeader: model.showHeader !== false,
      showBody: true,
      showFooter: model.showFooter !== false,
      repeatHeaderOnEachPage: model.repeatHeaderOnEachPage !== false,
      repeatFooterOnEachPage: model.repeatFooterOnEachPage !== false,
      manualPageCount,
      manualPages,
      header: this.decorateRegion(
        normalizedFixedRegionHeights.header,
        geometryModel
      ),
      body: {
        layout: model.body?.layout === "two" ? "two" : "one",
        sections: (
          model.body?.sections || [this.createRegion("body-1", "Body", null)]
        ).map((section) => {
          return this.decorateRegion(section, geometryModel);
        })
      },
      footer: this.decorateRegion(
        normalizedFixedRegionHeights.footer,
        geometryModel
      )
    };
  }

  migrateLineHeightModel(documentModel) {
    if (
      !documentModel ||
      this.toNumber(documentModel.lineHeightSchemaVersion) >= 3
    ) {
      return documentModel;
    }

    const migratedModel = JSON.parse(JSON.stringify(documentModel));
    const migrateValue = (value) => {
      if (typeof value !== "string" || !/<[a-z][\s\S]*>/i.test(value)) {
        return value;
      }

      const template = document.createElement("template");
      template.innerHTML = value;
      Array.from(template.content.querySelectorAll("[style]")).forEach(
        (element) => {
          const storedLineHeight = Number(element.style.lineHeight);

          if (storedLineHeight > 0 && storedLineHeight < 1) {
            element.style.lineHeight = "1.25";
          } else if (storedLineHeight >= 2) {
            element.style.lineHeight = String(storedLineHeight - 1);
          }
        }
      );
      return template.innerHTML;
    };
    const visit = (value) => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }

      if (!value || typeof value !== "object") {
        return;
      }

      Object.keys(value).forEach((key) => {
        if (key === "content") {
          value[key] = migrateValue(value[key]);
        } else {
          visit(value[key]);
        }
      });
    };

    visit(migratedModel);
    migratedModel.lineHeightSchemaVersion = 3;
    return migratedModel;
  }

  getPrintablePageHeight(model = this.documentModel) {
    const pagePadding = this.toNumber(
      model?.pagePadding ?? this.defaultPagePadding
    );

    return Math.max(120, this.pageHeight - pagePadding * 2);
  }

  getVisibleRegionGapHeight(model = this.documentModel) {
    const visibleRegionCount =
      (model?.showHeader !== false ? 1 : 0) +
      1 +
      (model?.showFooter !== false ? 1 : 0);
    const regionGap = 0;

    return Math.max(0, visibleRegionCount - 1) * regionGap;
  }

  getMinimumBodyHeight() {
    return this.pageHeight / 2;
  }

  getDefaultFixedRegionHeight(regionId) {
    return regionId === "header"
      ? this.defaultHeaderHeight
      : this.defaultFooterHeight;
  }

  getMaximumCombinedFixedRegionHeight(model = this.documentModel) {
    return Math.max(
      80,
      this.getPrintablePageHeight(model) -
        this.getVisibleRegionGapHeight(model) -
        this.getMinimumBodyHeight()
    );
  }

  clampFixedRegionHeight(
    regionId,
    requestedHeight,
    model = this.documentModel
  ) {
    const minimumRegionHeight = 40;
    const headerHeight =
      model?.showHeader === false
        ? 0
        : this.toNumber(
            model?.header?.styles?.height ?? this.defaultHeaderHeight
          );
    const footerHeight =
      model?.showFooter === false
        ? 0
        : this.toNumber(
            model?.footer?.styles?.height ?? this.defaultFooterHeight
          );
    const otherRegionHeight =
      regionId === "header" ? footerHeight : headerHeight;
    const maximumRegionHeight = Math.max(
      minimumRegionHeight,
      this.getMaximumCombinedFixedRegionHeight(model) - otherRegionHeight
    );

    return Math.min(
      maximumRegionHeight,
      Math.max(minimumRegionHeight, this.toNumber(requestedHeight))
    );
  }

  clampFixedRegionWidth(requestedWidth, model = this.documentModel) {
    const pagePadding = this.toNumber(
      model?.pagePadding ?? this.defaultPagePadding
    );
    const maximumWidth = Math.max(40, this.pageWidth - pagePadding * 2);
    return this.clampNumber(this.toNumber(requestedWidth), 40, maximumWidth);
  }

  normalizeFixedRegionHeights(model) {
    const header =
      model.header ||
      this.createRegion("header", "Header", this.defaultHeaderHeight);
    const footer =
      model.footer ||
      this.createRegion("footer", "Footer", this.defaultFooterHeight);
    const headerHeight = this.toNumber(
      header.styles?.height ?? this.defaultHeaderHeight
    );
    const footerHeight = this.toNumber(
      footer.styles?.height ?? this.defaultFooterHeight
    );
    const maximumCombinedHeight =
      this.getMaximumCombinedFixedRegionHeight(model);
    const visibleHeaderHeight = model.showHeader === false ? 0 : headerHeight;
    const visibleFooterHeight = model.showFooter === false ? 0 : footerHeight;
    const combinedHeight = visibleHeaderHeight + visibleFooterHeight;

    if (combinedHeight <= maximumCombinedHeight) {
      return { header, footer };
    }

    const minimumRegionHeight = 40;
    const overflow = combinedHeight - maximumCombinedHeight;
    const headerReducibleHeight =
      model.showHeader === false
        ? 0
        : Math.max(0, headerHeight - minimumRegionHeight);
    const footerReducibleHeight =
      model.showFooter === false
        ? 0
        : Math.max(0, footerHeight - minimumRegionHeight);
    const reducibleHeight = headerReducibleHeight + footerReducibleHeight;

    if (reducibleHeight <= 0) {
      return { header, footer };
    }

    const headerReduction =
      overflow * (headerReducibleHeight / reducibleHeight);
    const footerReduction =
      overflow * (footerReducibleHeight / reducibleHeight);

    return {
      header: {
        ...header,
        styles: {
          ...(header.styles || {}),
          height: Math.max(minimumRegionHeight, headerHeight - headerReduction)
        }
      },
      footer: {
        ...footer,
        styles: {
          ...(footer.styles || {}),
          height: Math.max(minimumRegionHeight, footerHeight - footerReduction)
        }
      }
    };
  }

  decorateRegion(region, documentModel = this.documentModel) {
    const styles = {
      background: region.styles?.background || "#ffffff",
      padding: this.toNumber(
        region.styles?.padding ?? this.defaultElementPadding
      ),
      borderWidth: this.toNumber(region.styles?.borderWidth ?? 0),
      borderStyle: region.styles?.borderStyle || "none",
      borderColor: region.styles?.borderColor || "#c9c9c9",
      borderRadius: this.toNumber(region.styles?.borderRadius ?? 4)
    };

    if (region.id === "header" || region.id === "footer") {
      styles.height = this.toNumber(
        region.styles?.height ?? this.getDefaultFixedRegionHeight(region.id)
      );
      styles.width = this.clampFixedRegionWidth(
        region.styles?.width ??
          this.pageWidth -
            this.toNumber(
              documentModel?.pagePadding ?? this.defaultPagePadding
            ) *
              2,
        documentModel
      );
    }

    return {
      ...region,
      styles,
      className: this.getRegionClass(region.id),
      inlineStyle: this.buildRegionStyle(styles),
      blocks: (region.blocks || []).map((block) =>
        this.decorateBlock(block, region, documentModel)
      ),
      isEmpty: (region.blocks || []).length === 0
    };
  }

  decorateBlock(block, region = null, documentModel = this.documentModel) {
    const horizontalGeometry = this.getBlockHorizontalGeometry(
      block,
      region,
      documentModel
    );
    const availableWidth = this.getLogicalRegionAvailableWidth(
      region?.id,
      documentModel
    );
    let normalizedWidth = horizontalGeometry.width;

    if (block.type === "text" || block.type === "field") {
      // Keep manual resized width for text/field blocks.
      // Only fallback to preferred width when width is missing.
      const preferredWidth = this.getPreferredTextFieldWidth(
        block,
        availableWidth
      );
      normalizedWidth = Number.isFinite(normalizedWidth)
        ? this.clampNumber(normalizedWidth, 32, availableWidth)
        : preferredWidth;
    }

    const lineThickness = Math.max(
      1,
      this.toNumber(block.styles?.lineThickness ?? 1)
    );
    const styles = {
      background: block.styles?.background || "transparent",
      padding:
        block.type === "divider" || block.type === "verticalLine"
          ? 0
          : this.toNumber(block.styles?.padding ?? 0),
      borderWidth: this.toNumber(block.styles?.borderWidth ?? 0),
      borderStyle: block.styles?.borderStyle || "none",
      borderColor: block.styles?.borderColor || "#c9c9c9",
      borderRadius: this.toNumber(block.styles?.borderRadius ?? 0),
      color: block.styles?.color || block.styles?.textColor || "#181818",
      colorExplicit: block.styles?.colorExplicit === true,
      fontFamily: block.styles?.fontFamily || "Arial, sans-serif",
      fontSize: this.toNumber(block.styles?.fontSize ?? 14),
      fontWeight: block.styles?.fontWeight || "normal",
      fontStyle: block.styles?.fontStyle || "normal",
      textAlign: block.styles?.textAlign || "left",
      verticalAlign: block.styles?.verticalAlign || "top",
      tableRows: this.toNumber(block.styles?.tableRows ?? 3),
      tableColumns: this.toNumber(block.styles?.tableColumns ?? 3),
      tableCellPadding: this.toNumber(block.styles?.tableCellPadding ?? 8),
      tableBorderWidth: this.toNumber(block.styles?.tableBorderWidth ?? 1),
      tableBorderColor: block.styles?.tableBorderColor || "#c9c9c9",
      tableCellVerticalAlign: block.styles?.tableCellVerticalAlign || "top",
      lineLength: this.toOptionalNumber(block.styles?.lineLength),
      lineThickness,
      lineStyle: block.styles?.lineStyle || "solid",
      lineColor: block.styles?.lineColor || "#181818",
      width:
        block.type === "verticalLine"
          ? Math.max(
              lineThickness,
              this.toOptionalNumber(block.styles?.width) || 12
            )
          : normalizedWidth,
      widthRatio: horizontalGeometry.widthRatio,
      height:
        block.type === "divider"
          ? Math.max(
              lineThickness,
              this.toOptionalNumber(block.styles?.height) || 12
            )
          : block.type === "relatedList"
            ? 100
            : block.type === "table"
              ? this.toOptionalNumber(block.styles?.height) ||
                DEFAULT_TABLE_HEIGHT
              : this.toOptionalNumber(block.styles?.height),
      heightManuallyResized: block.styles?.heightManuallyResized === true,
      x: horizontalGeometry.x,
      xRatio: horizontalGeometry.xRatio,
      y: this.toOptionalCoordinate(block.styles?.y)
    };

    return {
      ...block,
      styles,
      className: this.getBlockClass(
        block.type,
        block.id === this.selectedBlockId
      ),
      inlineStyle: this.buildBlockStyle(styles, block.type),
      shellClass: this.getBlockShellClass(
        block.id === this.selectedBlockId,
        block.type
      ),
      shellStyle: this.buildBlockShellStyle(styles, block.type),
      resizeHandles: this.getBlockResizeHandles(block.type),
      textStyle: this.buildTextStyle(styles),
      tableRows: this.getTableRows(
        styles,
        block.tableData,
        block.tableCellAlignments
      ),
      lineStyle: this.buildLineStyle(block.type, styles),
      relatedListColumns: Array.isArray(block.relatedListColumns)
        ? block.relatedListColumns
        : [],
      relatedListZebraEnabled: true,
      relatedListOddRowColor: block.relatedListOddRowColor || "#ffffff",
      relatedListEvenRowColor: block.relatedListEvenRowColor || "#ffffff",
      relatedListHeaderRowColor: block.relatedListHeaderRowColor || "#e5e7eb",
      relatedListTextColor:
        block.relatedListTextColor ||
        block.styles?.relatedListTextColor ||
        "#181818",
      relatedListOddTextColor:
        block.relatedListOddTextColor ||
        block.styles?.relatedListOddTextColor ||
        block.relatedListTextColor ||
        block.styles?.relatedListTextColor ||
        "#181818",
      relatedListEvenTextColor:
        block.relatedListEvenTextColor ||
        block.styles?.relatedListEvenTextColor ||
        block.relatedListTextColor ||
        block.styles?.relatedListTextColor ||
        "#181818",
      relatedListFontSize: this.clampNumber(
        this.toNumber(
          block.relatedListFontSize || block.styles?.relatedListFontSize || 12
        ),
        8,
        36
      ),
      relatedListBorderMode: block.relatedListBorderMode || "all",
      relatedListRelationshipName: block.relatedListRelationshipName || "",
      relatedListChildObjectApiName: block.relatedListChildObjectApiName || "",
      relatedListColumnCsv: (Array.isArray(block.relatedListColumns)
        ? block.relatedListColumns
        : []
      ).join(","),
      relatedListColumnLabels: this.getRelatedListColumnLabels(block),
      relatedListPreviewRows: this.getRelatedListPreviewRows(block),
      relatedListHeaderCellStyle: this.buildRelatedListCellStyle(
        block,
        block.relatedListTextColor ||
          block.styles?.relatedListTextColor ||
          "#181818",
        "center"
      ),
      isSelected: block.id === this.selectedBlockId,
      isText: block.type === "text",
      isField: block.type === "field",
      isDivider: block.type === "divider",
      isImage: block.type === "image",
      isTable: block.type === "table",
      isRelatedList: block.type === "relatedList",
      isVerticalLine: block.type === "verticalLine",
      hasImage: Boolean(block.imageSrc)
    };
  }

  getRelatedListColumnLabels(block) {
    const columns = Array.isArray(block.relatedListColumns)
      ? block.relatedListColumns
      : [];
    return columns.map((columnApiName, index) => {
      const option = (this.relatedListFieldOptions || []).find(
        (field) => field.apiName === columnApiName
      );
      return {
        key: `rl-col-${index}-${columnApiName}`,
        label: option?.label || columnApiName,
        apiName: columnApiName,
        dataType: option?.dataType || ""
      };
    });
  }

  getRelatedListPreviewRows(block) {
    const columns = this.getRelatedListColumnLabels(block);
    const previewColumns = columns.length
      ? columns
      : Array.from({ length: 3 }, (_, index) => ({
          apiName: `placeholder-${index}`,
          dataType: ""
        }));
    return Array.from({ length: 1 }, (_, rowIndex) => {
      const textColor =
        rowIndex % 2 === 0
          ? block.relatedListOddTextColor ||
            block.styles?.relatedListOddTextColor ||
            "#181818"
          : block.relatedListEvenTextColor ||
            block.styles?.relatedListEvenTextColor ||
            "#181818";

      return {
        key: `preview-row-${rowIndex}`,
        index: rowIndex,
        rowStyle: `background-color:${
          rowIndex % 2 === 0
            ? block.relatedListOddRowColor || "#ffffff"
            : block.relatedListEvenRowColor || "#ffffff"
        };`,
        cells: previewColumns.map((column, cellIndex) => ({
          key: `preview-cell-${rowIndex}-${cellIndex}`,
          value: rowIndex === 0 ? "..." : "",
          style: this.buildRelatedListCellStyle(
            block,
            textColor,
            this.getRelatedListValueTextAlign(column.dataType)
          )
        }))
      };
    });
  }

  getRelatedListValueTextAlign(dataType) {
    const normalizedType = String(dataType || "").toLowerCase();

    if (normalizedType === "currency") {
      return "right";
    }

    if (["double", "percent", "integer", "long"].includes(normalizedType)) {
      return "center";
    }

    return "left";
  }

  buildRelatedListCellStyle(block, textColor = "#181818", textAlign = "left") {
    const fontSize = this.clampNumber(
      this.toNumber(
        block.relatedListFontSize || block.styles?.relatedListFontSize || 12
      ),
      8,
      36
    );
    const borderStyle = this.getRelatedListCellBorderStyle(
      block.relatedListBorderMode || "all"
    );
    return `${borderStyle}padding:8px;color:${textColor};font-size:${fontSize}px;text-align:${textAlign};`;
  }

  getRelatedListCellBorderStyle(borderMode) {
    switch (borderMode) {
      case "none":
        return "border:none;";
      case "horizontal":
        return "border-top:1px solid #c9c9c9;border-bottom:1px solid #c9c9c9;border-left:none;border-right:none;";
      case "vertical":
        return "border-left:1px solid #c9c9c9;border-right:1px solid #c9c9c9;border-top:none;border-bottom:none;";
      case "all":
      default:
        return "border:1px solid #c9c9c9;";
    }
  }

  getRegionClass(regionId) {
    const selectedClass =
      this.selectedKind === "region" && this.selectedRegionId === regionId
        ? " selected-region"
        : "";

    if (regionId === "header") {
      return `pdf-region pdf-header${selectedClass}`;
    }

    if (regionId === "footer") {
      return `pdf-region pdf-footer${selectedClass}`;
    }

    return `pdf-region pdf-body-section${selectedClass}`;
  }

  getBlockClass(type, isSelected) {
    let className = "pdf-block";

    if (type === "text") {
      className += " text-block";
    }

    if (type === "field") {
      className += " field-block";
    }

    if (type === "divider") {
      className += " divider-block";
    }

    if (type === "image") {
      className += " image-block";
    }

    if (type === "table") {
      className += " table-block";
    }

    if (type === "relatedList") {
      className += " table-block";
    }

    if (type === "verticalLine") {
      className += " vertical-line-block";
    }

    if (isSelected) {
      className += " selected";
    }

    return className;
  }

  getBlockShellClass(isSelected, type) {
    const classes = ["block-shell"];

    if (type === "divider") {
      classes.push("divider-shell");
    }

    if (type === "verticalLine") {
      classes.push("vertical-line-shell");
    }

    if (isSelected) {
      classes.push("selected-block-shell");
    }

    return classes.join(" ");
  }

  buildRegionStyle(styles = {}) {
    const values = [
      `--region-background:${styles.background || "#ffffff"}`,
      `--region-padding:${this.toNumber(styles.padding)}px`,
      `--region-border-width:${this.toNumber(styles.borderWidth)}px`,
      `--region-border-style:${styles.borderStyle || "none"}`,
      `--region-border-color:${styles.borderColor || "#c9c9c9"}`,
      `--region-border-radius:${this.toNumber(styles.borderRadius)}px`
    ];

    if (styles.height) {
      values.push(`--region-height:${this.toNumber(styles.height)}px`);
    }
    if (styles.width) {
      values.push(`--region-width:${this.toNumber(styles.width)}px`);
    }

    return values.join(";");
  }

  buildBlockStyle(styles = {}, type = null) {
    const borderStyle = styles.borderStyle || "none";
    const borderWidth =
      borderStyle === "none" ? 0 : this.toNumber(styles.borderWidth);
    const widthValue = styles.width
      ? `${styles.width}px`
      : type === "divider"
        ? "100%"
        : "auto";
    const verticalAlign =
      styles.verticalAlign === "middle"
        ? "center"
        : styles.verticalAlign === "bottom"
          ? "flex-end"
          : "flex-start";

    return [
      `--block-background:${styles.background || "transparent"}`,
      `--block-padding:${this.toNumber(styles.padding)}px`,
      `--block-border-width:${borderWidth}px`,
      `--block-border-style:${borderStyle}`,
      `--block-border-color:${styles.borderColor || "#c9c9c9"}`,
      `--block-border-radius:${this.toNumber(styles.borderRadius)}px`,
      `--block-text-align:${styles.textAlign || "left"}`,
      `--block-vertical-align:${verticalAlign}`,
      `--block-width:${widthValue}`,
      `--block-height:${styles.height ? `${styles.height}px` : "auto"}`
    ].join(";");
  }

  buildBlockShellStyle(styles = {}, type = null) {
    const rawX = this.toOptionalCoordinate(styles.x);
    const rawY = this.toOptionalCoordinate(styles.y);
    const x = rawX === null ? null : Math.max(0, rawX);
    const y = rawY === null ? null : Math.max(0, rawY);

    if (x === null || y === null) {
      return "";
    }

    const values = [
      "position:absolute",
      `top:calc(var(--region-padding, 0px) + ${y}px)`,
      "z-index:3"
    ];

    if (type === "divider") {
      values.push(`left:calc(var(--region-padding, 0px) + ${x}px)`);
      const width = this.toOptionalNumber(styles.width);
      if (Number.isFinite(width)) {
        values.push(`width:${width}px`);
      } else {
        values.push("width:calc(100% - (var(--region-padding, 0px) * 2))");
      }
    } else {
      values.push(`left:calc(var(--region-padding, 0px) + ${x}px)`);
    }

    return values.join(";");
  }

  buildTextStyle(styles = {}) {
    const textColor = styles.color || styles.textColor || "#181818";
    return [
      `font-size:${this.toNumber(styles.fontSize)}px`,
      `font-family:${this.normalizePdfFontFamily(styles.fontFamily)}`,
      `font-weight:${styles.fontWeight || "normal"}`,
      `font-style:${styles.fontStyle || "normal"}`,
      `color:${textColor}`,
      `text-align:${styles.textAlign || "left"}`,
      "line-height:1.25"
    ].join(";");
  }

  normalizePdfFontFamily(value) {
    const requested = String(value || "").toLowerCase();

    if (
      requested.includes("times") ||
      requested.includes("georgia") ||
      requested.includes("garamond") ||
      requested.includes("palatino") ||
      requested.includes("cambria")
    ) {
      return "Times New Roman, serif";
    }

    if (requested.includes("courier") || requested.includes("lucida console")) {
      return "Courier New, monospace";
    }

    return "Arial, Helvetica, sans-serif";
  }

  buildTableCellStyle(styles = {}, verticalAlignOverride = null) {
    const borderWidth = this.toNumber(styles.tableBorderWidth ?? 1);
    const borderStyle =
      borderWidth > 0
        ? `${borderWidth}px solid ${styles.tableBorderColor || "#c9c9c9"}`
        : "0";

    return [
      `border:${borderStyle}`,
      `padding:${this.toNumber(styles.tableCellPadding)}px`,
      `vertical-align:${verticalAlignOverride || styles.tableCellVerticalAlign || "top"}`,
      "box-sizing:border-box",
      "min-width:0",
      "max-width:100%",
      "white-space:normal",
      "overflow:hidden",
      "overflow-wrap:anywhere",
      "word-break:break-word"
    ].join(";");
  }

  buildTableCellContentStyle(verticalAlign = "top") {
    const justifyContent =
      verticalAlign === "middle"
        ? "center"
        : verticalAlign === "bottom"
          ? "flex-end"
          : "flex-start";

    return [
      "display:flex",
      "flex-direction:column",
      `justify-content:${justifyContent}`,
      "height:100%",
      "min-height:0"
    ].join(";");
  }

  buildLineStyle(type, styles = {}) {
    const lineThickness = Math.max(1, this.toNumber(styles.lineThickness ?? 1));
    const lineStyle = styles.lineStyle || "solid";
    const lineColor = styles.lineColor || "#181818";

    if (type === "verticalLine") {
      return [
        "display:block",
        "height:100%",
        `border-left:${lineThickness}px ${lineStyle} ${lineColor}`
      ].join(";");
    }

    return [
      "display:block",
      "width:100%",
      "height:0",
      "margin:0",
      "padding:0",
      "border:0",
      `border-top:${lineThickness}px ${lineStyle} ${lineColor}`
    ].join(";");
  }

  getTableRows(styles = {}, tableData = [], tableCellAlignments = []) {
    const rowCount = Math.max(
      1,
      Math.min(12, this.toNumber(styles.tableRows || 3))
    );
    const columnCount = Math.max(
      1,
      Math.min(12, this.toNumber(styles.tableColumns || 3))
    );

    return Array.from(Array(rowCount).keys()).map((rowIndex) => {
      return {
        key: `row-${rowIndex}`,
        index: rowIndex,
        cells: Array.from(Array(columnCount).keys()).map((columnIndex) => {
          const rawCellData = tableData?.[rowIndex]?.[columnIndex];
          const content =
            typeof rawCellData === "object" && rawCellData !== null
              ? rawCellData.content || ""
              : rawCellData || "";
          const verticalAlign =
            tableCellAlignments?.[rowIndex]?.[columnIndex] ||
            styles.tableCellVerticalAlign ||
            "top";
          return {
            key: `cell-${rowIndex}-${columnIndex}`,
            columnIndex,
            content,
            style: this.buildTableCellStyle(styles, verticalAlign),
            contentStyle: this.buildTableCellContentStyle(verticalAlign)
          };
        })
      };
    });
  }

  updateElementStyle(element, styleName, value) {
    const nextStyles = {
      ...(element.styles || {}),
      [styleName]: value
    };

    if (styleName === "width") {
      nextStyles.widthRatio = null;
    }

    if (styleName === "x") {
      nextStyles.xRatio = null;
    }

    // For text-like blocks, let container grow naturally when typography changes.
    if (
      styleName === "fontSize" &&
      (element?.type === "text" || element?.type === "field")
    ) {
      nextStyles.height = null;
    }

    return {
      ...element,
      styles: nextStyles
    };
  }

  updateElementBorderState(element, styleName, value) {
    if (styleName !== "borderStyle" && styleName !== "borderWidth") {
      return element;
    }

    const styles = {
      ...(element.styles || {})
    };

    if (styleName === "borderStyle" && value === "none") {
      styles.borderWidth = 0;
    }

    if (
      styleName === "borderStyle" &&
      value !== "none" &&
      !this.toNumber(styles.borderWidth)
    ) {
      styles.borderWidth = 1;
    }

    if (styleName === "borderWidth" && styles.borderStyle === "none") {
      styles.borderWidth = 0;
    }

    return {
      ...element,
      styles
    };
  }

  addNewBlockAtPoint(regionId, event) {
    const block = this.createPositionedBlockForDrop(regionId, event);
    if (!block) {
      return this.documentModel;
    }

    this.selectedKind = "block";
    this.selectedBlockId = block.id;
    this.selectedRegionId = regionId;

    const region = this.findRegionById(regionId);
    const insertIndex = region?.blocks?.length || 0;

    return this.insertBlockIntoRegionAtIndex(
      this.documentModel,
      regionId,
      block,
      insertIndex
    );
  }

  createPositionedBlockForDrop(regionId, event) {
    let block = this.createBlock(this.draggedType, this.draggedField);
    if (!block) {
      return null;
    }

    if (regionId === "header" || regionId === "footer") {
      block = this.autoSizeBlockForRegion(block, regionId);
    }

    return this.normalizeBlockAfterDrag(
      this.positionBlockForDrop(block, regionId, event, {
        anchorMode: "pointer"
      }),
      regionId
    );
  }

  normalizeBlockAfterDrag(block, regionId, options = {}) {
    if (!block) {
      return block;
    }

    if (block.type === "divider") {
      return block;
    }

    const metrics = this.getRegionContentMetrics(regionId);
    const availableWidth = metrics?.availableWidth || this.pageWidth;
    const availableHeight = metrics?.availableHeight || this.pageHeight;
    const styles = {
      ...(block.styles || {})
    };

    if (
      !options.preserveDimensions &&
      (block.type === "text" || block.type === "field")
    ) {
      const preferredWidth = this.getPreferredTextFieldWidth(
        block,
        availableWidth
      );
      styles.width = Math.min(
        Number.isFinite(styles.width)
          ? this.toNumber(styles.width)
          : preferredWidth,
        preferredWidth
      );
      styles.widthRatio = null;
    }

    const blockWidth =
      this.toOptionalNumber(styles.width) ||
      this.getEstimatedBlockWidth({ ...block, styles });
    const blockHeight =
      this.toOptionalNumber(styles.height) ||
      this.getEstimatedBlockHeight({ ...block, styles });
    const maxX = Math.max(0, availableWidth - blockWidth);
    const maxY = Math.max(0, availableHeight - blockHeight);

    styles.x = this.clampNumber(
      Number.isFinite(styles.x) ? this.toNumber(styles.x) : 0,
      0,
      maxX
    );
    styles.y = this.clampNumber(
      Number.isFinite(styles.y) ? this.toNumber(styles.y) : 0,
      0,
      maxY
    );
    styles.xRatio = null;

    return this.clampBlockToRegion(
      {
        ...block,
        styles
      },
      regionId
    );
  }

  positionBlockForDrop(block, regionId, event, options = {}) {
    const regionElement = this.getRegionElementById(regionId);
    const anchorMode = options?.anchorMode || "center";

    if (
      !regionElement ||
      typeof event?.clientX !== "number" ||
      typeof event?.clientY !== "number"
    ) {
      return this.positionBlockAtRegionCenter(block, regionId);
    }

    const regionRect = regionElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(regionElement);
    const paddingLeft = this.toCssNumber(computedStyle.paddingLeft);
    const paddingTop = this.toCssNumber(computedStyle.paddingTop);
    const paddingRight = this.toCssNumber(computedStyle.paddingRight);
    const paddingBottom = this.toCssNumber(computedStyle.paddingBottom);
    const availableWidth = Math.max(
      32,
      regionElement.clientWidth - paddingLeft - paddingRight
    );
    const availableHeight = Math.max(
      24,
      regionElement.clientHeight - paddingTop - paddingBottom
    );
    let blockWidth =
      this.toOptionalNumber(block.styles?.width) ||
      this.getEstimatedBlockWidth(block);
    const blockHeight =
      this.toOptionalNumber(block.styles?.height) ||
      this.getEstimatedBlockHeight(block);
    let normalizedWidth = this.toOptionalNumber(block.styles?.width);

    if (
      (block.type === "image" ||
        block.type === "table" ||
        block.type === "relatedList" ||
        block.type === "verticalLine") &&
      !Number.isFinite(normalizedWidth)
    ) {
      normalizedWidth = this.getInitialBlockWidth(
        block.type,
        block.content || ""
      );
      blockWidth = normalizedWidth || blockWidth;
    }

    // If a text/field block ends up as wide as the full region, horizontal
    // movement becomes impossible (x is always clamped to 0).
    normalizedWidth = this.getNormalizedMovableBlockWidth(
      block,
      regionId,
      normalizedWidth
    );
    if (normalizedWidth !== null) {
      blockWidth = normalizedWidth;
    }

    if (
      (block.type === "text" || block.type === "field") &&
      !Number.isFinite(normalizedWidth)
    ) {
      normalizedWidth = this.getPreferredTextFieldWidth(block, availableWidth);
      blockWidth = normalizedWidth;
    }

    const anchorX = anchorMode === "pointer" ? 0 : blockWidth / 2;
    const anchorY = anchorMode === "pointer" ? 0 : blockHeight / 2;
    const rawX = event.clientX - regionRect.left - paddingLeft - anchorX;
    const rawY = event.clientY - regionRect.top - paddingTop - anchorY;
    const nextX = this.clampNumber(
      this.snapToGrid(rawX),
      0,
      Math.max(0, availableWidth - blockWidth)
    );
    const nextY = this.clampNumber(
      this.snapToGrid(rawY),
      0,
      Math.max(0, availableHeight - blockHeight)
    );

    return this.clampBlockToRegion(
      {
        ...block,
        styles: {
          ...(block.styles || {}),
          width: normalizedWidth,
          x: nextX,
          xRatio: null,
          y: nextY
        }
      },
      regionId
    );
  }

  positionBlockAtRegionCenter(block, regionId) {
    if (!block) {
      return block;
    }

    const metrics = this.getRegionContentMetrics(regionId);
    const availableWidth = metrics?.availableWidth || this.pageWidth;
    const availableHeight = metrics?.availableHeight || this.pageHeight;
    let normalizedWidth = this.toOptionalNumber(block.styles?.width);

    normalizedWidth = this.getNormalizedMovableBlockWidth(
      block,
      regionId,
      normalizedWidth
    );
    if (
      (block.type === "text" || block.type === "field") &&
      !Number.isFinite(normalizedWidth)
    ) {
      normalizedWidth = this.getPreferredTextFieldWidth(block, availableWidth);
    }

    const blockWidth = normalizedWidth || this.getEstimatedBlockWidth(block);
    const blockHeight =
      this.toOptionalNumber(block.styles?.height) ||
      this.getEstimatedBlockHeight(block);
    const x = this.clampNumber(
      this.snapToGrid((availableWidth - blockWidth) / 2),
      0,
      Math.max(0, availableWidth - blockWidth)
    );
    const y = this.clampNumber(
      this.snapToGrid((availableHeight - blockHeight) / 2),
      0,
      Math.max(0, availableHeight - blockHeight)
    );

    return this.clampBlockToRegion(
      {
        ...block,
        styles: {
          ...(block.styles || {}),
          width: normalizedWidth,
          x,
          xRatio: null,
          y
        }
      },
      regionId
    );
  }

  getEstimatedBlockWidth(block) {
    if (block.type === "image") {
      return 240;
    }

    if (block.type === "table") {
      return 360;
    }

    if (block.type === "relatedList") {
      return 520;
    }

    if (block.type === "verticalLine") {
      return 12;
    }

    if (block.type === "divider") {
      return 320;
    }

    if (block.type === "text" || block.type === "field") {
      return this.getPreferredTextFieldWidth(block);
    }

    return 220;
  }

  getPreferredTextFieldWidth(block, availableWidth = null) {
    const baselineWidth = 240;

    if (!Number.isFinite(availableWidth) || availableWidth <= 0) {
      return baselineWidth;
    }

    return Math.max(120, Math.min(baselineWidth, availableWidth));
  }

  getNormalizedMovableBlockWidth(block, regionId, rawWidth) {
    if (
      !block ||
      block.type === "divider" ||
      (block.type !== "text" && block.type !== "field")
    ) {
      return rawWidth;
    }

    const metrics = this.getRegionContentMetrics(regionId);
    const availableWidth = metrics?.availableWidth || 0;

    if (
      !Number.isFinite(rawWidth) ||
      rawWidth <= 0 ||
      !Number.isFinite(availableWidth) ||
      availableWidth <= 0
    ) {
      return rawWidth;
    }

    if (rawWidth < availableWidth) {
      return rawWidth;
    }

    return Math.min(
      this.getPreferredTextFieldWidth(block, availableWidth),
      availableWidth
    );
  }

  getEstimatedBlockHeight(block) {
    if (block.type === "image") {
      return 140;
    }

    if (block.type === "table") {
      return DEFAULT_TABLE_HEIGHT;
    }

    if (block.type === "relatedList") {
      return 100;
    }

    if (block.type === "verticalLine") {
      return 120;
    }

    if (block.type === "divider") {
      return 12;
    }

    return this.toOptionalNumber(block.styles?.height) || 48;
  }

  autoSizeBlockForRegion(block, regionId) {
    if (!block) {
      return block;
    }

    const isHeaderOrFooter = regionId === "header" || regionId === "footer";

    if (!isHeaderOrFooter) {
      return block;
    }

    const baseStyles = {
      ...(block.styles || {}),
      x: block.styles?.x,
      xRatio: block.styles?.xRatio,
      y: block.styles?.y
    };

    if (block.type !== "text" && block.type !== "field") {
      return {
        ...block,
        styles: baseStyles
      };
    }

    const content = String(block.content || "").trim();
    const nextWidth = this.getInitialBlockWidth(block.type, content);
    const region = this.findRegionById(regionId);
    const regionPadding = this.toNumber(
      region?.styles?.padding ??
        this.documentModel?.globalElementPadding ??
        this.defaultElementPadding
    );
    const regionHeight = this.toNumber(
      region?.styles?.height ?? this.getDefaultFixedRegionHeight(regionId)
    );
    const availableWidth = Math.max(
      120,
      this.pageWidth -
        this.toNumber(
          this.documentModel?.pagePadding ?? this.defaultPagePadding
        ) *
          2 -
        regionPadding * 2
    );
    const availableHeight = Math.max(24, regionHeight - regionPadding * 2);
    const maxFontSize = Math.max(
      9,
      Math.min(16, Math.floor(availableHeight * 0.32))
    );
    const currentFontSize = this.toNumber(block?.styles?.fontSize ?? 14);
    const fittedFontSize = Math.min(currentFontSize, maxFontSize);

    return {
      ...block,
      styles: {
        ...baseStyles,
        width: Math.min(nextWidth, availableWidth),
        widthRatio: null,
        height: null,
        fontSize: fittedFontSize
      }
    };
  }

  getDraggedBlockId(event = null) {
    if (this.draggedBlockId) {
      return this.draggedBlockId;
    }

    const transferredBlockId =
      event?.dataTransfer?.getData("application/x-pdf-builder-block") ||
      event?.dataTransfer?.getData("text/plain");

    return this.findBlockById(transferredBlockId) ? transferredBlockId : null;
  }

  getDraggedType(event = null) {
    if (this.draggedType) {
      return this.draggedType;
    }

    const transferredType =
      event?.dataTransfer?.getData("application/x-pdf-builder-type") ||
      event?.dataTransfer?.getData("text/plain");

    const allowedTypes = new Set([
      "text",
      "image",
      "divider",
      "verticalLine",
      "table",
      "field",
      "relatedList"
    ]);
    return allowedTypes.has(transferredType) ? transferredType : null;
  }

  getDraggedField(event = null) {
    if (this.draggedField) {
      return this.draggedField;
    }

    const fieldApiName = event?.dataTransfer?.getData(
      "application/x-pdf-builder-field"
    );
    if (!fieldApiName) {
      return null;
    }

    return this.getFieldOptionByApiName(fieldApiName);
  }

  getFieldOptionByApiName(fieldApiName) {
    if (!fieldApiName) {
      return null;
    }

    return (
      [
        ...(this.organizationFieldOptions || []),
        ...(this.filteredFieldOptions || [])
      ].find((field) => field.apiName === fieldApiName) || null
    );
  }

  insertBlockIntoRegionAtIndex(documentModel, regionId, block, insertIndex) {
    return this.updateRegion(documentModel, regionId, (region) => {
      const blocks = [...(region.blocks || [])];
      const safeIndex = Math.max(0, Math.min(blocks.length, insertIndex));

      blocks.splice(safeIndex, 0, block);

      return {
        ...region,
        blocks
      };
    });
  }

  updateBlocks(documentModel, updater) {
    return this.updateRegions(documentModel, (region) => {
      return {
        ...region,
        blocks: (region.blocks || []).map((block) => updater(block))
      };
    });
  }

  removeBlock(documentModel, blockId) {
    return this.updateRegions(documentModel, (region) => {
      return {
        ...region,
        blocks: (region.blocks || []).filter((block) => block.id !== blockId)
      };
    });
  }

  updateRegion(documentModel, regionId, updater) {
    return this.updateRegions(documentModel, (region) => {
      return region.id === regionId ? updater(region) : region;
    });
  }

  updateRegions(documentModel, updater) {
    return {
      ...documentModel,
      header: updater(documentModel.header),
      body: {
        ...documentModel.body,
        sections: documentModel.body.sections.map((section) => updater(section))
      },
      manualPages: (documentModel.manualPages || []).map((page) => ({
        ...page,
        body: {
          ...page.body,
          sections: (page.body?.sections || []).map((section) =>
            updater(section)
          )
        }
      })),
      footer: updater(documentModel.footer)
    };
  }

  findBlockById(blockId) {
    if (!blockId) {
      return null;
    }

    for (const region of this.getAllRegions(this.documentModel)) {
      const block = (region.blocks || []).find((item) => item.id === blockId);

      if (block) {
        return block;
      }
    }

    return null;
  }

  findRegionById(regionId) {
    return (
      this.getAllRegions(this.documentModel).find(
        (region) => region.id === regionId
      ) || null
    );
  }

  getAllRegions(documentModel) {
    return [
      documentModel.header,
      ...(documentModel.body?.sections || []),
      ...(documentModel.manualPages || []).flatMap(
        (page) => page?.body?.sections || []
      ),
      documentModel.footer
    ];
  }

  restoreDocument(content) {
    if (Array.isArray(content)) {
      const model = this.createDefaultDocument();

      return {
        ...model,
        body: {
          ...model.body,
          sections: [
            {
              ...model.body.sections[0],
              blocks: content
            }
          ]
        }
      };
    }

    return content || this.createDefaultDocument();
  }

  stripRuntimeState(documentModel) {
    const stripBlock = (block) => this.stripBlockRuntimeState(block);
    const stripRegion = (region) => {
      const rest = Object.fromEntries(
        Object.entries(region).filter(([key]) => !REGION_RUNTIME_KEYS.has(key))
      );

      return {
        ...rest,
        blocks: (region.blocks || []).map((block) => stripBlock(block))
      };
    };

    return {
      // Persist the schema marker. Without it, reloading treats every
      // saved template as legacy and rewrites line heights below 1.
      lineHeightSchemaVersion: 3,
      pageBackground: normalizeColor(documentModel.pageBackground, "#ffffff"),
      pagePadding: documentModel.pagePadding,
      globalElementPadding: documentModel.globalElementPadding,
      showHeader: documentModel.showHeader,
      showBody: documentModel.showBody,
      showFooter: documentModel.showFooter,
      repeatHeaderOnEachPage: documentModel.repeatHeaderOnEachPage,
      repeatFooterOnEachPage: documentModel.repeatFooterOnEachPage,
      manualPageCount: documentModel.manualPageCount,
      manualPages: (documentModel.manualPages || []).map((page) => ({
        id: page.id,
        body: {
          layout: page.body?.layout === "two" ? "two" : "one",
          sections: (page.body?.sections || []).map((section) =>
            stripRegion(section)
          )
        }
      })),
      header: stripRegion(documentModel.header),
      body: {
        layout: documentModel.body.layout,
        sections: documentModel.body.sections.map((section) =>
          stripRegion(section)
        )
      },
      footer: stripRegion(documentModel.footer)
    };
  }

  getBodyOverflowPageCount() {
    return Math.max(0, this.getBuilderBodyPaginationLayout().pageCount - 1);
  }

  getBuilderBodySectionsForPage(pageIndex) {
    const normalizedPageIndex = Math.max(0, this.toNumber(pageIndex));
    const pagination = this.getBuilderBodyPaginationLayout();

    return (this.bodySections || []).map((section, sectionIndex) => {
      const placements = pagination.sections[sectionIndex] || [];
      const blocks = placements
        .filter((placement) => placement.pageIndex === normalizedPageIndex)
        .sort((left, right) => left.originalIndex - right.originalIndex)
        .map((placement) => {
          const styles = {
            ...(placement.block.styles || {}),
            y: placement.localY
          };

          return {
            ...placement.block,
            styles,
            shellStyle: this.buildBlockShellStyle(styles, placement.block.type)
          };
        });

      return {
        ...section,
        blocks,
        // Automatic continuation pages are render slices, not new editable
        // regions. An empty column must therefore stay blank instead of
        // showing the builder's "Drop body content here" placeholder.
        isEmpty:
          normalizedPageIndex === 0 && (section.blocks || []).length === 0
      };
    });
  }

  getBuilderBodyPaginationLayout() {
    const capacity = this.getBodyContentCapacityPerPage();
    const safeCapacity = Math.max(1, capacity);
    let pageCount = 1;

    const sections = (this.bodySections || []).map((section) => {
      let flowCursor = 0;
      const measuredBlocks = (section.blocks || [])
        .map((block, originalIndex) => {
          const blockX = this.toOptionalCoordinate(block.styles?.x);
          const blockY = this.toOptionalCoordinate(block.styles?.y);
          const hasAbsolutePosition =
            Number.isFinite(blockX) && Number.isFinite(blockY);
          const height = Math.max(
            1,
            this.getEstimatedPaginationBlockHeight(block, section?.id)
          );
          const top = hasAbsolutePosition ? blockY : flowCursor;

          if (!hasAbsolutePosition) {
            flowCursor = top + height;
          }

          return { block, originalIndex, top, height };
        })
        .sort((left, right) => {
          if (Math.abs(left.top - right.top) <= 1) {
            return left.originalIndex - right.originalIndex;
          }
          return left.top - right.top;
        });

      const bands = [];
      measuredBlocks.forEach((item) => {
        const currentBand = bands[bands.length - 1];
        if (currentBand && Math.abs(currentBand.top - item.top) <= 1) {
          currentBand.items.push(item);
          currentBand.height = Math.max(currentBand.height, item.height);
          return;
        }

        bands.push({
          top: item.top,
          height: item.height,
          items: [item]
        });
      });

      let accumulatedPageShift = 0;
      const placements = [];

      bands.forEach((band) => {
        let renderedTop = Math.max(0, band.top + accumulatedPageShift);
        const pageOffset = renderedTop % safeCapacity;

        // Keep a component (and components aligned on the same row) intact.
        // When it does not fit in the remaining body area, move the complete
        // row to the top of the next page instead of clipping or duplicating it.
        if (
          band.height <= safeCapacity &&
          pageOffset > 0 &&
          pageOffset + band.height > safeCapacity
        ) {
          const shift = safeCapacity - pageOffset;
          accumulatedPageShift += shift;
          renderedTop += shift;
        }

        const pageIndex = Math.floor(renderedTop / safeCapacity);
        const localY = renderedTop - pageIndex * safeCapacity;
        pageCount = Math.max(pageCount, pageIndex + 1);

        band.items.forEach((item) => {
          placements.push({
            ...item,
            pageIndex,
            localY
          });
        });
      });

      return placements;
    });

    return { pageCount, sections };
  }

  getEstimatedPaginationBlockHeight(block) {
    const explicitHeight = this.toOptionalNumber(block?.styles?.height);
    if (Number.isFinite(explicitHeight)) {
      return explicitHeight;
    }

    if (block?.type !== "text" && block?.type !== "field") {
      return this.getEstimatedBlockHeight(block);
    }

    const fontSize = Math.max(8, this.toNumber(block?.styles?.fontSize ?? 14));
    const lineHeight = Math.max(12, Math.round(fontSize * 1.35));
    const horizontalPadding = this.toNumber(block?.styles?.padding ?? 0) * 2;
    const verticalPadding = this.toNumber(block?.styles?.padding ?? 0) * 2;
    const borderWidth = this.toNumber(block?.styles?.borderWidth ?? 0) * 2;
    const contentWidth = Math.max(
      80,
      (this.toOptionalNumber(block?.styles?.width) ||
        this.getEstimatedBlockWidth(block)) -
        horizontalPadding -
        borderWidth
    );
    const charsPerLine = Math.max(
      10,
      Math.floor(contentWidth / Math.max(4, fontSize * 0.52))
    );
    const plainText = this.extractPlainTextForPagination(block?.content || "");
    const paragraphs = plainText.split("\n");

    let lineCount = 0;
    paragraphs.forEach((paragraph) => {
      const length = (paragraph || "").trim().length;
      lineCount += Math.max(1, Math.ceil(length / charsPerLine));
    });

    const textHeight = Math.max(lineHeight, lineCount * lineHeight);
    return Math.max(24, textHeight + verticalPadding + borderWidth);
  }

  extractPlainTextForPagination(value) {
    if (!value) {
      return "";
    }

    if (!/<[a-z][\s\S]*>/i.test(value)) {
      return String(value);
    }

    const container = document.createElement("div");
    container.innerHTML = value;
    return (container.innerText || container.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n/g, "\n");
  }

  getTotalPageCount() {
    const overflowPageCount = this.getBodyOverflowPageCount();
    const manualPageCount = Math.max(
      0,
      this.toNumber(this.documentModel.manualPageCount || 0),
      (this.documentModel.manualPages || []).length
    );
    return 1 + overflowPageCount + manualPageCount;
  }

  getBodyContentCapacityPerPage() {
    const contentHeight = Math.max(
      120,
      this.pageHeight - this.documentModel.pagePadding * 2
    );
    const visibleRegionCount =
      (this.hasHeader ? 1 : 0) + 1 + (this.hasFooter ? 1 : 0);
    const regionGap = 0;
    const gapHeight = Math.max(0, visibleRegionCount - 1) * regionGap;
    const headerHeight = this.hasHeader
      ? this.toNumber(this.header?.styles?.height ?? this.defaultHeaderHeight)
      : 0;
    const footerHeight = this.hasFooter
      ? this.toNumber(this.footer?.styles?.height ?? this.defaultFooterHeight)
      : 0;

    return Math.max(
      160,
      contentHeight - gapHeight - headerHeight - footerHeight
    );
  }

  getGeneratedHtml(isPreview = false, useRelatedListTokens = false) {
    const model = sanitizeDocumentModel(
      this.stripRuntimeState(this.documentModel)
    );
    const bodyCapacity = Math.max(420, this.getBodyContentCapacityPerPage());
    const bodyMinHeightStyle = `min-height:${bodyCapacity}px;`;
    const sectionMinHeightStyle = `;min-height:${bodyCapacity}px;`;
    const previewBodySections =
      isPreview && !useRelatedListTokens
        ? this.getBuilderBodySectionsForPage(0)
        : model.body.sections;
    const bodySections = model.showBody
      ? previewBodySections
          .map((section) => {
            const regionPadding = this.toNumber(
              section?.styles?.padding ?? this.defaultElementPadding
            );
            return `
            <section style="${this.getExportRegionStyle(section.styles, {
              ignoreConfiguredWidth: true
            })}${sectionMinHeightStyle}">
                ${section.blocks
                  .map((block) =>
                    this.getBlockHtml(block, {
                      isPreview,
                      regionPadding,
                      useRelatedListTokens
                    })
                  )
                  .join("")}
            </section>`;
          })
          .join("")
      : "";
    const headerHtml = model.showHeader
      ? `<header style="${this.getExportRegionStyle(model.header.styles, {
          defaultToFullWidth: true
        })}">
            ${model.header.blocks
              .map((block) =>
                this.getBlockHtml(block, {
                  isPreview,
                  regionPadding: this.toNumber(
                    model.header?.styles?.padding ?? this.defaultElementPadding
                  ),
                  useRelatedListTokens
                })
              )
              .join("")}
        </header>`
      : "";
    const bodyHtml = model.showBody
      ? `<div class="pdf-body" style="${bodyMinHeightStyle}">
            ${bodySections}
        </div>`
      : "";
    const footerHtml = model.showFooter
      ? `<footer style="${this.getExportRegionStyle(model.footer.styles, {
          defaultToFullWidth: true
        })}">
            ${model.footer.blocks
              .map((block) =>
                this.getBlockHtml(block, {
                  isPreview,
                  regionPadding: this.toNumber(
                    model.footer?.styles?.padding ?? this.defaultElementPadding
                  ),
                  useRelatedListTokens
                })
              )
              .join("")}
        </footer>`
      : "";
    const previewPageStyle = isPreview
      ? `body { background: #f3f3f3; padding: 24px; display:flex; flex-direction:column; align-items:center; }
               .pdf-page { flex:0 0 auto; margin:0 auto; box-shadow:0 2px 10px rgba(0,0,0,0.18); }`
      : "";

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, sans-serif; color: #181818; }
        .pdf-page { display: flex; flex-direction: column; gap: 0; width: ${this.pageWidth}px; min-height: ${this.pageHeight}px; padding: ${model.pagePadding}px; background: ${model.pageBackground || "#ffffff"}; }
        .pdf-body { display: flex; align-self: stretch; width: 100%; min-width: 0; flex: 1 1 auto; gap: 16px; min-height: 420px; }
        .pdf-body section { flex: 1 1 0; width: 0; min-width: 0; max-width: none; min-height: 420px; }
        p { margin: 0; }
        h1, h2, h3, h4, h5, h6 { margin: 0; }
        img { max-width: 100%; }
        ul { list-style-type: disc; list-style-position: outside; margin: 0 0 0 18px; padding-left: 20px; }
        ol { list-style-type: decimal; list-style-position: outside; margin: 0 0 0 18px; padding-left: 20px; }
        li { display: list-item; }
        .rich-native-list { margin: 0 0 0 18px; padding-left: 20px; list-style-position: outside; }
        .rich-native-list-item { display: list-item; white-space: normal; }
        ${previewPageStyle}
    </style>
</head>
<body>
    <div class="pdf-page" data-preview-page-kind="primary">
        ${headerHtml}
        ${bodyHtml}
        ${footerHtml}
    </div>
</body>
</html>`;
  }

  getPreviewHtml(useRelatedListTokens = false) {
    const baseHtml = this.getGeneratedHtml(true, useRelatedListTokens);
    const totalPages = Math.max(1, this.getTotalPageCount());

    if (totalPages <= 1) {
      return baseHtml;
    }

    const model = this.stripRuntimeState(this.documentModel);
    const bodyCapacity = Math.max(420, this.getBodyContentCapacityPerPage());
    const overflowPageCount = this.getBodyOverflowPageCount();
    const continuationPagesHtml = Array.from(
      { length: totalPages - 1 },
      (_, index) => {
        const pageNumber = index + 2;
        const isManualPage = pageNumber > overflowPageCount + 1;
        const manualPageIndex = pageNumber - overflowPageCount - 2;
        const manualPage = isManualPage
          ? (model.manualPages || [])[manualPageIndex]
          : null;
        const headerHtml =
          model.showHeader && model.repeatHeaderOnEachPage
            ? `<header style="${this.getExportRegionStyle(model.header.styles, {
                defaultToFullWidth: true
              })}">
                    ${(model.header.blocks || [])
                      .map((block) =>
                        this.getBlockHtml(block, {
                          isPreview: true,
                          regionPadding: this.toNumber(
                            model.header?.styles?.padding ??
                              this.defaultElementPadding
                          ),
                          useRelatedListTokens
                        })
                      )
                      .join("")}
                </header>`
            : "";
        const footerHtml =
          model.showFooter && model.repeatFooterOnEachPage
            ? `<footer style="${this.getExportRegionStyle(model.footer.styles, {
                defaultToFullWidth: true
              })}">
                    ${(model.footer.blocks || [])
                      .map((block) =>
                        this.getBlockHtml(block, {
                          isPreview: true,
                          regionPadding: this.toNumber(
                            model.footer?.styles?.padding ??
                              this.defaultElementPadding
                          ),
                          useRelatedListTokens
                        })
                      )
                      .join("")}
                </footer>`
            : "";
        const automaticPageSections = !isManualPage
          ? this.getBuilderBodySectionsForPage(pageNumber - 1)
          : [];
        const pageSections = isManualPage
          ? manualPage?.body?.sections || model.body.sections || []
          : useRelatedListTokens
            ? model.body.sections || []
            : automaticPageSections;
        const bodyHtml = model.showBody
          ? `<div class="pdf-body" style="min-height:${bodyCapacity}px;">
                    ${pageSections
                      .map((section) => {
                        return `<section style="${this.getExportRegionStyle(
                          section.styles,
                          {
                            ignoreConfiguredWidth: true
                          }
                        )};min-height:${bodyCapacity}px;">
                            ${
                              isManualPage || !useRelatedListTokens
                                ? (section.blocks || [])
                                    .map((block) =>
                                      this.getBlockHtml(block, {
                                        isPreview: true,
                                        regionPadding: this.toNumber(
                                          section?.styles?.padding ??
                                            this.defaultElementPadding
                                        ),
                                        useRelatedListTokens
                                      })
                                    )
                                    .join("")
                                : '<p style="margin:0;color:#8a8d91;font-size:12px;">Content continues from previous page</p>'
                            }
                        </section>`;
                      })
                      .join("")}
                </div>`
          : "";

        return `
                <div class="pdf-page" data-preview-page-kind="${isManualPage ? "manual" : "overflow"}" style="margin-top:24px;position:relative;">
                    <div data-preview-page-badge style="position:absolute;top:8px;right:12px;padding:2px 8px;border-radius:999px;background:#0176d3;color:#fff;font-size:11px;font-weight:700;">Page ${pageNumber}</div>
                    ${headerHtml}
                    ${bodyHtml}
                    ${footerHtml}
                </div>
            `;
      }
    ).join("");

    return baseHtml.replace("</body>", `${continuationPagesHtml}</body>`);
  }

  getExportRegionStyle(styles = {}, options = {}) {
    const values = [
      `background:${styles.background || "#ffffff"}`,
      `padding:${this.toNumber(styles.padding)}px`,
      `border:${this.toNumber(styles.borderWidth)}px ${styles.borderStyle || "none"} ${styles.borderColor || "#c9c9c9"}`,
      `border-radius:${this.toNumber(styles.borderRadius)}px`,
      "position:relative",
      "overflow:hidden"
    ];

    if (styles.height) {
      values.push(`height:${this.toNumber(styles.height)}px`);
    }
    const configuredWidth = options.ignoreConfiguredWidth
      ? null
      : this.toOptionalNumber(styles.width);
    const printableWidth = Math.max(
      40,
      this.pageWidth - this.toNumber(this.documentModel?.pagePadding) * 2
    );
    const useFullWidth =
      options.defaultToFullWidth === true &&
      (!Number.isFinite(configuredWidth) || configuredWidth >= printableWidth);

    if (useFullWidth) {
      values.push(
        "width:100%",
        "max-width:100%",
        "align-self:center",
        "margin-left:auto",
        "margin-right:auto"
      );
    } else if (Number.isFinite(configuredWidth)) {
      values.push(
        `width:${configuredWidth}px`,
        "max-width:100%",
        "align-self:center",
        "margin-left:auto",
        "margin-right:auto"
      );
    }

    return values.join(";");
  }

  getBlockHtml(block, options = {}) {
    const isPreview = options.isPreview === true;
    const useRelatedListTokens = options.useRelatedListTokens === true;
    const regionPadding = Math.max(0, this.toNumber(options.regionPadding));
    const blockX = this.toOptionalCoordinate(block.styles?.x);
    const blockY = this.toOptionalCoordinate(block.styles?.y);
    const blockWidth = this.toOptionalNumber(block.styles?.width);
    const hasExplicitAbsolutePosition =
      Number.isFinite(blockX) && Number.isFinite(blockY);
    const configuredHeight = this.toOptionalNumber(block.styles?.height);
    const hasFixedHeight = Number.isFinite(configuredHeight);
    const blockStyle = [
      `background:${block.styles?.background || "transparent"}`,
      `padding:${this.toNumber(block.styles?.padding)}px`,
      this.getExportBlockBorderStyle(block.styles),
      `border-radius:${this.toNumber(block.styles?.borderRadius)}px`,
      `text-align:${block.styles?.textAlign || "left"}`,
      `box-sizing:border-box`,
      `overflow:hidden`,
      Number.isFinite(blockWidth) ? `width:${this.toNumber(blockWidth)}px` : "",
      hasFixedHeight ? `height:${this.toNumber(configuredHeight)}px` : "",
      hasExplicitAbsolutePosition
        ? `position:absolute;left:${this.toNumber(blockX) + regionPadding}px;top:${this.toNumber(blockY) + regionPadding}px`
        : ""
    ].join(";");
    const textColor =
      block.styles?.color || block.styles?.textColor || "#181818";
    const textStyle = [
      `font-size:${this.toNumber(block.styles?.fontSize)}px`,
      `font-family:${this.normalizePdfFontFamily(block.styles?.fontFamily)}`,
      `font-weight:${block.styles?.fontWeight || "normal"}`,
      `font-style:${block.styles?.fontStyle || "normal"}`,
      `color:${textColor}`,
      "line-height:1.25",
      `white-space:normal`,
      hasFixedHeight ? "display:flex" : "",
      hasFixedHeight ? "flex-direction:column" : "",
      hasFixedHeight
        ? `justify-content:${
            (block.styles?.verticalAlign || "top") === "middle"
              ? "center"
              : (block.styles?.verticalAlign || "top") === "bottom"
                ? "flex-end"
                : "flex-start"
          }`
        : ""
    ].join(";");

    switch (block.type) {
      case "text":
        return `<div style="${blockStyle};${textStyle}">${this.getRichTextHtml(block.content)}</div>`;
      case "field":
        return `<div style="${blockStyle};${textStyle}">${this.getRichTextHtml(block.content)}</div>`;
      case "divider":
        return `<div style="${blockStyle};display:flex;align-items:center;justify-content:center"><div style="${this.getExportLineStyle(block.type, block.styles)}"></div></div>`;
      case "image": {
        const safeImageSource = normalizeImageUrl(block.imageSrc);
        return safeImageSource
          ? `<div style="${blockStyle};display:block"><img src="${this.escapeHtml(safeImageSource)}" alt="${this.escapeHtml(block.imageAlt || "")}" style="display:block;width:100%;height:100%;max-width:100%;object-fit:contain"></div>`
          : "";
      }
      case "table":
        return this.getTableHtml(block, blockStyle);
      case "relatedList":
        return isPreview && !useRelatedListTokens
          ? this.getRelatedListPreviewHtml(block, blockStyle)
          : `<div class="db-record-preview-related-list" data-configured-height="${this.toNumber(configuredHeight)}" style="${blockStyle};display:block;overflow:visible">${this.getRelatedListToken(block)}</div>`;
      case "verticalLine":
        return `<div style="${blockStyle};display:flex;align-items:center;justify-content:center"><div style="${this.getExportLineStyle(block.type, block.styles)}"></div></div>`;
      default:
        return "";
    }
  }

  getExportLineStyle(type, styles = {}) {
    const lineThickness = Math.max(
      1,
      this.toNumber(styles?.lineThickness ?? 1)
    );
    const lineStyle = styles?.lineStyle || "solid";
    const lineColor = styles?.lineColor || "#181818";

    if (type === "verticalLine") {
      return `display:block;height:100%;border-left:${lineThickness}px ${lineStyle} ${lineColor}`;
    }

    return `width:100%;border-top:${lineThickness}px ${lineStyle} ${lineColor}`;
  }

  getExportBlockBorderStyle(styles = {}) {
    const borderStyle = styles.borderStyle || "none";
    const borderWidth = this.toNumber(styles.borderWidth);

    if (borderStyle === "none" || borderWidth === 0) {
      return "border:0";
    }

    return `border:${borderWidth}px ${borderStyle} ${styles.borderColor || "#c9c9c9"}`;
  }

  getTableHtml(block, blockStyle) {
    const rows = Math.max(
      1,
      Math.min(12, this.toNumber(block.styles?.tableRows || 3))
    );
    const columns = Math.max(
      1,
      Math.min(12, this.toNumber(block.styles?.tableColumns || 3))
    );
    const tableData = Array.isArray(block.tableData) ? block.tableData : [];
    const tableCellAlignments = Array.isArray(block.tableCellAlignments)
      ? block.tableCellAlignments
      : [];
    const rowHtml = Array.from(Array(rows).keys())
      .map((rowIndex) => {
        const cells = Array.from(Array(columns).keys())
          .map((columnIndex) => {
            const rawCellData = tableData?.[rowIndex]?.[columnIndex];
            const cellContent =
              typeof rawCellData === "object" && rawCellData !== null
                ? rawCellData.content || "&nbsp;"
                : rawCellData || "&nbsp;";
            const cellVerticalAlign =
              tableCellAlignments?.[rowIndex]?.[columnIndex] ||
              block.styles?.tableCellVerticalAlign ||
              "top";
            const cellStyle = this.buildTableCellStyle(
              block.styles || {},
              cellVerticalAlign
            );
            return `<td style="${cellStyle}">${sanitizeRichTextHtml(cellContent)}</td>`;
          })
          .join("");

        return `<tr>${cells}</tr>`;
      })
      .join("");

    return `<div style="${blockStyle};display:block"><table style="width:100%;height:calc(100% - 1px);border-collapse:collapse;table-layout:fixed;min-height:96px"><tbody>${rowHtml}</tbody></table></div>`;
  }

  getRelatedListToken(block) {
    const relationshipName = block.relatedListRelationshipName || "";
    const columns = Array.isArray(block.relatedListColumns)
      ? block.relatedListColumns
      : [];
    const columnCsv = columns.join(",");

    if (!relationshipName || !columnCsv) {
      return '<div style="border:1px dashed #9ca3af;color:#706e6b;font-size:11px;text-align:center;padding:12px;">Configure related list</div>';
    }

    const zebra = "1";
    const odd = block.relatedListOddRowColor || "#ffffff";
    const even = block.relatedListEvenRowColor || "#ffffff";
    const header = block.relatedListHeaderRowColor || "#e5e7eb";
    const textColor =
      block.relatedListTextColor ||
      block.styles?.relatedListTextColor ||
      "#181818";
    const oddTextColor =
      block.relatedListOddTextColor ||
      block.styles?.relatedListOddTextColor ||
      textColor;
    const evenTextColor =
      block.relatedListEvenTextColor ||
      block.styles?.relatedListEvenTextColor ||
      textColor;
    const fontSize = this.clampNumber(
      this.toNumber(
        block.relatedListFontSize || block.styles?.relatedListFontSize || 12
      ),
      8,
      36
    );
    const borderMode = block.relatedListBorderMode || "all";
    const cellPadding = this.clampNumber(
      this.toNumber(block.styles?.tableCellPadding ?? 8),
      0,
      32
    );

    return `[[DBRL|${relationshipName}|${columnCsv}|${zebra}|${odd}|${even}|${header}|${textColor}|${fontSize}|${oddTextColor}|${evenTextColor}|${borderMode}|${cellPadding}]]`;
  }

  getRelatedListPreviewHtml(block, blockStyle) {
    const columns = Array.isArray(block.relatedListColumns)
      ? block.relatedListColumns
      : [];
    const columnLabels = this.getRelatedListColumnLabels(block);

    if (!columns.length) {
      return '<div style="border:1px dashed #9ca3af;color:#706e6b;font-size:11px;text-align:center;padding:12px;">Configure related list</div>';
    }

    const previewRows = this.getRelatedListPreviewRows(block);
    const headerColor = block.relatedListHeaderRowColor || "#e5e7eb";
    const textColor =
      block.relatedListTextColor ||
      block.styles?.relatedListTextColor ||
      "#181818";
    const oddTextColor =
      block.relatedListOddTextColor ||
      block.styles?.relatedListOddTextColor ||
      textColor;
    const evenTextColor =
      block.relatedListEvenTextColor ||
      block.styles?.relatedListEvenTextColor ||
      textColor;
    const fontSize = this.clampNumber(
      this.toNumber(
        block.relatedListFontSize || block.styles?.relatedListFontSize || 12
      ),
      8,
      36
    );
    const borderStyle = this.getRelatedListCellBorderStyle(
      block.relatedListBorderMode || "all"
    );
    const headerCellStyle = `${borderStyle}padding:6px 8px;font-size:${fontSize}px;color:${textColor};`;
    const headerCells = (columnLabels.length ? columnLabels : columns)
      .map((column) => {
        const label = typeof column === "string" ? column : column?.label || "";
        return `<th style="${headerCellStyle}text-align:center;">${this.escapeHtml(label)}</th>`;
      })
      .join("");
    const bodyRows = previewRows
      .map((row) => {
        const rowTextColor = row.index % 2 === 0 ? oddTextColor : evenTextColor;
        const cellStyle = `${borderStyle}padding:6px 8px;font-size:${fontSize}px;color:${rowTextColor};`;
        const cells = row.cells
          .map((cell) => {
            const value = typeof cell === "string" ? cell : cell?.value || "";
            return `<td style="${cell.style || `${cellStyle}text-align:left;`}">${this.escapeHtml(value)}</td>`;
          })
          .join("");
        return `<tr style="${row.rowStyle}">${cells}</tr>`;
      })
      .join("");

    return `<div style="${blockStyle};display:block;overflow:hidden;">
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <thead><tr style="background-color:${this.escapeHtml(headerColor)};">${headerCells}</tr></thead>
                <tbody>${bodyRows}</tbody>
            </table>
        </div>`;
  }

  hasRelatedListBlock() {
    for (const region of this.getAllRegions(this.documentModel)) {
      if ((region.blocks || []).some((block) => block.type === "relatedList")) {
        return true;
      }
    }

    return false;
  }

  getRichTextHtml(content) {
    const value = content || "";

    if (/<[a-z][\s\S]*>/i.test(value)) {
      const container = document.createElement("div");
      container.innerHTML = sanitizeRichTextHtml(value);
      container.querySelectorAll("b, strong").forEach((element) => {
        element.style.fontWeight = "700";
      });
      return sanitizeRichTextHtml(container.innerHTML);
    }

    return this.escapeHtml(value).replace(/\r?\n/g, "<br>");
  }

  escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  createId() {
    return Date.now().toString() + Math.random().toString(16).slice(2);
  }

  toNumber(value) {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  toCssNumber(value) {
    const parsedValue = parseFloat(value);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  toOptionalNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  toOptionalRatio(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) && parsedValue >= 0
      ? parsedValue
      : null;
  }

  toOptionalCoordinate(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) && parsedValue >= 0
      ? parsedValue
      : null;
  }

  getErrorMessage(error) {
    if (Array.isArray(error?.body)) {
      return error.body.map((item) => item.message).join(", ");
    }

    return error?.body?.message || error?.message || "Unexpected error";
  }

  getUserFacingErrorMessage(error) {
    const message = this.getErrorMessage(error);

    if (/STORAGE_LIMIT_EXCEEDED|storage limit exceeded/i.test(message)) {
      return `Salesforce storage is full. Free up file/data storage or request additional capacity, then try again. Technical detail: ${message}`;
    }

    return message;
  }

  showToast(title, message, variant = "info") {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant,
        mode: variant === "error" ? "sticky" : "dismissible"
      })
    );
  }
}
