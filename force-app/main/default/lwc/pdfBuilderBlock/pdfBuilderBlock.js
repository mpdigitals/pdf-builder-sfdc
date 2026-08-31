import { LightningElement, api } from "lwc";
import {
  executeRichTextCommand,
  getRichTextCommandState
} from "c/pdfBuilderRichTextCommands";
import {
  normalizeImageUrl,
  normalizeLinkUrl,
  getFragmentHtml,
  getSanitizedInnerHtml,
  sanitizeRichTextHtml,
  setSanitizedInnerHtml
} from "c/pdfBuilderSecurity";

export default class PDFBuilderBlock extends LightningElement {
  _block = {};
  isEditing = false;
  savedSelectionRange;
  savedNonCollapsedSelectionRange;
  activeTableCellKey;
  boundWindowMouseUpHandler;
  boundSelectionChangeHandler;

  connectedCallback() {
    this.boundWindowMouseUpHandler = this.handleWindowMouseUp.bind(this);
    this.boundSelectionChangeHandler =
      this.handleDocumentSelectionChange.bind(this);
    window.addEventListener("mouseup", this.boundWindowMouseUpHandler, true);
    document.addEventListener(
      "selectionchange",
      this.boundSelectionChangeHandler
    );
  }

  disconnectedCallback() {
    if (this.boundWindowMouseUpHandler) {
      window.removeEventListener(
        "mouseup",
        this.boundWindowMouseUpHandler,
        true
      );
    }

    if (this.boundSelectionChangeHandler) {
      document.removeEventListener(
        "selectionchange",
        this.boundSelectionChangeHandler
      );
    }
  }

  @api regionId;

  @api
  get block() {
    return this._block || {};
  }

  set block(value) {
    this._block = value || {};
  }

  @api
  getImageAspectRatio() {
    const image = this.template.querySelector(".image-content");
    const width = Number(image?.naturalWidth || image?.width || 0);
    const height = Number(image?.naturalHeight || image?.height || 0);

    return width > 0 && height > 0 ? width / height : null;
  }

  get textContentEditable() {
    return this.isEditing ? "true" : "false";
  }

  get blockClassName() {
    const classes = [this.block.className || ""];
    const isCompactRegion =
      (this.regionId === "header" || this.regionId === "footer") &&
      (this.block?.isText || this.block?.isField);

    if (this.isEditing) {
      classes.push("editing-text-block");
    }

    if (isCompactRegion) {
      classes.push("compact-region-text");
    }

    return classes.join(" ").trim();
  }

  get relatedListHeaderStyle() {
    const color = this.block?.relatedListHeaderRowColor || "#e5e7eb";
    return `background-color:${color};`;
  }

  get hasTableBottomBorder() {
    return this.getTableBorderWidth() > 0;
  }

  get tableBottomBorderStyle() {
    const borderColor = this.block?.styles?.tableBorderColor || "#c9c9c9";
    return `height:${this.getTableBorderWidth()}px;background-color:${borderColor};`;
  }

  getTableBorderWidth() {
    const borderWidth = Number(this.block?.styles?.tableBorderWidth ?? 1);
    return Number.isFinite(borderWidth) ? Math.max(0, borderWidth) : 1;
  }

  get textPlaceholder() {
    if (this.block?.isField) {
      return "Drop field or type";
    }

    return "Write your text here";
  }

  renderedCallback() {
    this.syncEditableText();
    this.syncTableCells();
  }

  @api
  insertVariable(variableText) {
    const editableElement = this.getActiveEditableElement();

    if (!editableElement || !variableText) {
      return;
    }

    editableElement.focus();

    const selection = window.getSelection();
    let range = this.savedSelectionRange;

    if (!range || !editableElement.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editableElement);
      range.collapse(false);
    }

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    range.deleteContents();

    const textNode = document.createTextNode(variableText);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.savedSelectionRange = range.cloneRange();
    if (this.block?.isTable) {
      this.dispatchTableDataChange();
    } else {
      this.dispatchTextChange(this.getSanitizedEditableHtml(editableElement));
    }
    this.emitRichTextState();
  }

  handleEditableMouseDown(event) {
    if (!this.isEditing) {
      return;
    }

    event.stopPropagation();

    const blockShell = this.template.host?.parentElement;
    if (blockShell?.classList?.contains("block-shell")) {
      blockShell.draggable = false;
      blockShell.dataset.dragLocked = "true";

      const restoreDraggable = () => {
        blockShell.draggable = true;
        delete blockShell.dataset.dragLocked;

        window.removeEventListener("mouseup", restoreDraggable, true);
        window.removeEventListener("blur", restoreDraggable, true);
      };

      window.addEventListener("mouseup", restoreDraggable, true);
      window.addEventListener("blur", restoreDraggable, true);
    }

    window.setTimeout(() => {
      this.saveSelection();
    }, 0);
  }

  handleEditableClick(event) {
    if (this.isEditing) {
      event.stopPropagation();

      const editableElement = event.currentTarget;
      if (editableElement && editableElement === event.target) {
        window.setTimeout(() => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount > 0) {
            return;
          }
          this.moveCursorToEnd(editableElement);
        }, 0);
      }
    }
  }

  @api
  applyRichTextCommand(command, value = null) {
    const editableElement = this.getActiveEditableElement();

    if (!editableElement || !command) {
      return;
    }

    this.isEditing = true;
    editableElement.setAttribute("contenteditable", "true");
    editableElement.dataset.editing = "true";
    this.restoreSelection();

    const selection = window.getSelection();

    if (
      !selection ||
      selection.rangeCount === 0 ||
      !editableElement.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      editableElement.focus({ preventScroll: true });
      this.restoreSelection();
    }

    let shouldSyncContent = true;

    if (command === "bold" || command === "italic" || command === "underline") {
      this.restoreFormattingSelection();
      executeRichTextCommand(command);
      shouldSyncContent = true;
    } else if (command === "fontName") {
      this.restoreFormattingSelection();
      shouldSyncContent = this.wrapSelectionWithInlineElement("span", {
        fontFamily: value || "Arial"
      });
    } else if (command === "foreColor") {
      this.restoreFormattingSelection();
      shouldSyncContent = this.applyTextColor(value || "#181818");
    } else if (command === "fontSize") {
      this.restoreFormattingSelection();
      shouldSyncContent = this.applyFontSize(value);
    } else if (command === "lineHeight") {
      // Line spacing is paragraph-scoped. Preserve a multi-paragraph
      // selection made before the toolbar receives focus.
      this.restoreFormattingSelection();
      const lineHeight = Math.max(0.25, Math.min(3, Number(value) || 1.25));
      shouldSyncContent = this.applyLineHeight(lineHeight);
    } else if (command === "insertUnorderedList") {
      this.applyList("ul");
    } else if (command === "insertOrderedList") {
      this.applyList("ol");
    } else if (
      command === "justifyLeft" ||
      command === "justifyCenter" ||
      command === "justifyRight" ||
      command === "justifyFull"
    ) {
      this.restoreFormattingSelection();
      const alignmentByCommand = {
        justifyLeft: "left",
        justifyCenter: "center",
        justifyRight: "right",
        justifyFull: "justify"
      };
      shouldSyncContent = this.applyTextAlignment(
        alignmentByCommand[command] || "left"
      );
    } else {
      executeRichTextCommand(command, value);
    }

    if (shouldSyncContent) {
      if (this.block?.isTable) {
        this.dispatchTableDataChange();
      } else {
        this.dispatchTextChange(this.getSanitizedEditableHtml(editableElement));
      }
    }

    this.saveSelection();

    this.emitRichTextState();
  }

  selectNodeContents(node) {
    const selection = window.getSelection();

    if (!selection || !node) {
      return;
    }

    const nextRange = document.createRange();
    nextRange.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(nextRange);
    this.savedSelectionRange = nextRange.cloneRange();

    if (!nextRange.collapsed) {
      this.savedNonCollapsedSelectionRange = nextRange.cloneRange();
    }
  }

  wrapSelectionWithInlineElement(tagName, styles = {}) {
    const editableElement = this.getActiveEditableElement();
    const selection = window.getSelection();

    if (!editableElement || !selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);

    if (!editableElement.contains(range.commonAncestorContainer)) {
      return false;
    }

    if (range.collapsed) {
      this.insertTypingStyleSpan(styles);
      return false;
    }

    const wrapper = document.createElement(tagName);

    Object.keys(styles).forEach((propertyName) => {
      wrapper.style[propertyName] = styles[propertyName];
    });

    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);

    range.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
    return true;
  }

  applyTextColor(value) {
    const editableElement = this.getActiveEditableElement();
    const selection = window.getSelection();

    if (!editableElement || !selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);

    if (!editableElement.contains(range.commonAncestorContainer)) {
      return false;
    }

    const color = String(value || "#181818");

    if (range.collapsed) {
      this.insertTypingStyleSpan({ color });
      return false;
    }

    const wrapper = document.createElement("span");
    wrapper.style.color = color;
    wrapper.appendChild(range.extractContents());

    // Existing inline colors inside the selected fragment would otherwise
    // override the color on the new outer wrapper.
    Array.from(wrapper.querySelectorAll("*")).forEach((element) => {
      element.removeAttribute("color");
      element.style.color = color;
    });

    range.insertNode(wrapper);
    range.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
    this.savedNonCollapsedSelectionRange = range.cloneRange();
    return true;
  }

  insertTypingStyleSpan(styles = {}) {
    const editableElement = this.getActiveEditableElement();
    const selection = window.getSelection();

    if (!editableElement || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (!editableElement.contains(range.commonAncestorContainer)) {
      return;
    }

    const span = document.createElement("span");
    const placeholder = document.createTextNode("​");

    Object.keys(styles).forEach((propertyName) => {
      span.style[propertyName] = styles[propertyName];
    });

    span.appendChild(placeholder);
    range.deleteContents();
    range.insertNode(span);
    range.setStart(placeholder, 1);
    range.setEnd(placeholder, 1);

    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
  }

  @api
  getSelectedTextForLink() {
    const selection = window.getSelection();
    const liveRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const fallbackRange =
      this.savedNonCollapsedSelectionRange || this.savedSelectionRange;
    const effectiveRange =
      liveRange && !liveRange.collapsed ? liveRange : fallbackRange;
    const editableElement = this.getActiveEditableElement(effectiveRange);

    if (!editableElement || !effectiveRange) {
      return "";
    }

    if (!editableElement.contains(effectiveRange.commonAncestorContainer)) {
      return "";
    }

    this.savedSelectionRange = effectiveRange.cloneRange();
    if (!effectiveRange.collapsed) {
      this.savedNonCollapsedSelectionRange = effectiveRange.cloneRange();
    }

    return effectiveRange.toString().trim();
  }

  @api
  applyLink(alias, url) {
    const safeUrl = normalizeLinkUrl(url);
    const savedRange =
      this.savedNonCollapsedSelectionRange || this.savedSelectionRange;
    const editableElement = this.getActiveEditableElement(savedRange);

    if (!editableElement || !alias || !safeUrl) {
      return;
    }

    this.isEditing = true;
    editableElement.focus();
    this.restoreFormattingSelection();

    const selection = window.getSelection();
    let range =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (
      this.savedNonCollapsedSelectionRange &&
      editableElement.contains(
        this.savedNonCollapsedSelectionRange.commonAncestorContainer
      )
    ) {
      range = this.savedNonCollapsedSelectionRange.cloneRange();
    } else if (
      (!range || !editableElement.contains(range.commonAncestorContainer)) &&
      this.savedSelectionRange &&
      editableElement.contains(this.savedSelectionRange.commonAncestorContainer)
    ) {
      range = this.savedSelectionRange.cloneRange();
    }

    if (!range || !editableElement.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editableElement);
      range.collapse(false);
    }

    const anchor = document.createElement("a");
    anchor.setAttribute("href", safeUrl);
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
    anchor.textContent = alias;

    if (!range.collapsed) {
      range.deleteContents();
    }
    range.insertNode(anchor);
    range.setStartAfter(anchor);
    range.setEndAfter(anchor);

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.savedSelectionRange = range.cloneRange();
    this.savedNonCollapsedSelectionRange = null;
    if (this.block?.isTable) {
      this.dispatchTableDataChange();
    } else {
      this.dispatchTextChange(this.getSanitizedEditableHtml(editableElement));
    }
    this.emitRichTextState();
  }

  applyFontSize(value) {
    const fontSize = Math.max(1, Math.min(72, Number(value) || 14));
    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    const editableElement = this.getActiveEditableElement();
    if (!editableElement) {
      return false;
    }

    let range = null;

    if (selection.rangeCount > 0) {
      const liveRange = selection.getRangeAt(0);
      if (editableElement.contains(liveRange.commonAncestorContainer)) {
        range = liveRange;
      }
    }

    // Toolbar interactions can move focus away from contenteditable.
    // Recover with the latest saved range from the editable block.
    if (
      !range &&
      this.savedSelectionRange &&
      editableElement.contains(this.savedSelectionRange.commonAncestorContainer)
    ) {
      range = this.savedSelectionRange.cloneRange();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (
      !range &&
      this.savedNonCollapsedSelectionRange &&
      editableElement.contains(
        this.savedNonCollapsedSelectionRange.commonAncestorContainer
      )
    ) {
      range = this.savedNonCollapsedSelectionRange.cloneRange();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (!range) {
      return false;
    }

    // If the current selection got collapsed by toolbar interaction,
    // recover the last non-collapsed text selection before applying size.
    if (range.collapsed && this.savedNonCollapsedSelectionRange) {
      const savedRange = this.savedNonCollapsedSelectionRange.cloneRange();
      if (editableElement.contains(savedRange.commonAncestorContainer)) {
        selection.removeAllRanges();
        selection.addRange(savedRange);
        range = savedRange;
      }
    }

    if (range.collapsed) {
      this.insertTypingStyleSpan({ fontSize: `${fontSize}px` });
      return false;
    }

    const wrapper = document.createElement("span");
    wrapper.style.fontSize = `${fontSize}px`;
    wrapper.appendChild(range.extractContents());
    Array.from(wrapper.querySelectorAll("*")).forEach((element) => {
      element.removeAttribute("size");
      element.style.fontSize = `${fontSize}px`;
    });
    range.insertNode(wrapper);

    range.selectNodeContents(wrapper);
    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
    this.saveSelection(false);
    return true;
  }

  applyLineHeight(value) {
    const editableElement = this.getActiveEditableElement();
    const selection = window.getSelection();

    if (!editableElement || !selection) {
      return false;
    }

    let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    if (
      (!range || range.collapsed) &&
      this.savedNonCollapsedSelectionRange &&
      editableElement.contains(
        this.savedNonCollapsedSelectionRange.commonAncestorContainer
      )
    ) {
      range = this.savedNonCollapsedSelectionRange.cloneRange();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (
      (!range || !editableElement.contains(range.commonAncestorContainer)) &&
      this.savedSelectionRange &&
      editableElement.contains(this.savedSelectionRange.commonAncestorContainer)
    ) {
      range = this.savedSelectionRange.cloneRange();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (!range) {
      return false;
    }

    const normalizedValue = String(
      Math.max(0.25, Math.min(3, Number(value) || 1.25))
    );
    const paragraphTags = [
      "P",
      "DIV",
      "LI",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6"
    ];
    const findParagraph = (node) => {
      let paragraph =
        node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;

      while (
        paragraph &&
        paragraph !== editableElement &&
        !paragraphTags.includes(paragraph.tagName)
      ) {
        paragraph = paragraph.parentElement;
      }

      return paragraph && paragraph !== editableElement ? paragraph : null;
    };
    const selectedParagraphs = [];
    const addParagraph = (paragraph) => {
      if (paragraph && !selectedParagraphs.includes(paragraph)) {
        selectedParagraphs.push(paragraph);
      }
    };

    addParagraph(findParagraph(range.startContainer));

    if (!range.collapsed) {
      const paragraphSelector = paragraphTags
        .map((tagName) => tagName.toLowerCase())
        .join(",");

      Array.from(editableElement.querySelectorAll(paragraphSelector)).forEach(
        (paragraph) => {
          // A DIV may be only a structural wrapper around real paragraphs.
          // In that case, format its paragraph children instead of the wrapper.
          if (
            paragraph.tagName === "DIV" &&
            paragraph.querySelector(paragraphSelector)
          ) {
            return;
          }

          try {
            if (range.intersectsNode(paragraph)) {
              addParagraph(paragraph);
            }
          } catch {
            // A detached node cannot be part of the active selection.
          }
        }
      );

      addParagraph(findParagraph(range.endContainer));
    }

    if (selectedParagraphs.length === 0) {
      return false;
    }

    selectedParagraphs.forEach((paragraph) => {
      paragraph.style.lineHeight = normalizedValue;
      paragraph.style.marginTop = "0";
      paragraph.style.marginBottom = "0";
    });

    const appliedRange = range.cloneRange();
    editableElement.focus({ preventScroll: true });

    // Focusing a contenteditable can collapse the browser selection onto the
    // editable root. Restore the original range so the toolbar reads the
    // paragraph value that was just applied instead of the root default.
    selection.removeAllRanges();
    selection.addRange(appliedRange);
    this.savedSelectionRange = appliedRange.cloneRange();
    if (!appliedRange.collapsed) {
      this.savedNonCollapsedSelectionRange = appliedRange.cloneRange();
    }

    this.saveSelection(false);
    return true;
  }

  applyTextAlignment(rawValue) {
    const editableElement = this.getActiveEditableElement();
    const selection = window.getSelection();

    if (!editableElement || !selection) {
      return false;
    }

    const alignment = ["center", "right", "justify"].includes(rawValue)
      ? rawValue
      : "left";
    let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (
      (!range || range.collapsed) &&
      this.savedNonCollapsedSelectionRange &&
      editableElement.contains(
        this.savedNonCollapsedSelectionRange.commonAncestorContainer
      )
    ) {
      range = this.savedNonCollapsedSelectionRange.cloneRange();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (
      (!range || !editableElement.contains(range.commonAncestorContainer)) &&
      this.savedSelectionRange &&
      editableElement.contains(this.savedSelectionRange.commonAncestorContainer)
    ) {
      range = this.savedSelectionRange.cloneRange();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    if (!range) {
      return false;
    }

    const paragraphTags = [
      "P",
      "DIV",
      "LI",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6"
    ];
    const paragraphSelector = paragraphTags
      .map((tagName) => tagName.toLowerCase())
      .join(",");
    const selectedParagraphs = [];
    const addParagraph = (paragraph) => {
      if (paragraph && !selectedParagraphs.includes(paragraph)) {
        selectedParagraphs.push(paragraph);
      }
    };
    const findParagraph = (node) => {
      let paragraph =
        node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;

      while (
        paragraph &&
        paragraph !== editableElement &&
        !paragraphTags.includes(paragraph.tagName)
      ) {
        paragraph = paragraph.parentElement;
      }

      return paragraph && paragraph !== editableElement ? paragraph : null;
    };

    addParagraph(findParagraph(range.startContainer));

    if (!range.collapsed) {
      Array.from(editableElement.querySelectorAll(paragraphSelector)).forEach(
        (paragraph) => {
          if (
            paragraph.tagName === "DIV" &&
            paragraph.querySelector(paragraphSelector)
          ) {
            return;
          }

          try {
            if (range.intersectsNode(paragraph)) {
              addParagraph(paragraph);
            }
          } catch {
            // Ignore detached nodes left behind by a browser selection update.
          }
        }
      );

      addParagraph(findParagraph(range.endContainer));
    }

    let appliedRange = range.cloneRange();

    if (selectedParagraphs.length === 0) {
      const paragraph = document.createElement("div");

      while (editableElement.firstChild) {
        paragraph.appendChild(editableElement.firstChild);
      }
      editableElement.appendChild(paragraph);
      selectedParagraphs.push(paragraph);
      appliedRange = document.createRange();
      appliedRange.selectNodeContents(paragraph);
      if (range.collapsed) {
        appliedRange.collapse(false);
      }
    }

    const selectedLists = [];
    selectedParagraphs.forEach((paragraph) => {
      paragraph.style.textAlign = alignment;

      const list =
        paragraph.tagName === "LI"
          ? paragraph.parentElement?.closest?.("ul,ol")
          : paragraph.closest?.("li")?.parentElement?.closest?.("ul,ol");
      if (list && !selectedLists.includes(list)) {
        selectedLists.push(list);
      }
    });

    selectedLists.forEach((list) => {
      const markerFollowsText = alignment !== "left";
      list.style.textAlign = alignment;
      list.style.listStylePosition = markerFollowsText ? "inside" : "outside";
      list.style.marginLeft = markerFollowsText ? "0" : "18px";
      list.style.paddingLeft = markerFollowsText ? "0" : "20px";
      Array.from(list.children).forEach((listItem) => {
        if (listItem.tagName === "LI") {
          listItem.style.textAlign = alignment;
        }
      });
    });

    editableElement.focus({ preventScroll: true });
    selection.removeAllRanges();
    selection.addRange(appliedRange);
    this.savedSelectionRange = appliedRange.cloneRange();
    if (!appliedRange.collapsed) {
      this.savedNonCollapsedSelectionRange = appliedRange.cloneRange();
    }

    this.saveSelection(false);
    return true;
  }

  applyList(listTagName) {
    const editableElement = this.getActiveEditableElement();
    if (!editableElement) {
      return;
    }

    editableElement.focus({ preventScroll: true });
    this.restoreFormattingSelection();

    const selection = window.getSelection();
    const syncListChange = () => {
      if (this.block?.isTable) {
        this.dispatchTableDataChange();
      } else {
        this.dispatchTextChange(this.getSanitizedEditableHtml(editableElement));
      }
    };

    if (this.toggleExistingList(listTagName, editableElement)) {
      this.saveSelection(false);
      syncListChange();
      return;
    }

    if (this.block?.isTable) {
      this.applyTableCellList(listTagName, editableElement);
      this.saveSelection(false);
      syncListChange();
      return;
    }

    const listElement = this.createListElement(listTagName);

    if (!selection || selection.rangeCount === 0) {
      listElement.appendChild(this.createListItem("", listTagName));
      editableElement.appendChild(listElement);
      this.selectList(listElement);
      syncListChange();
      return;
    }

    const range = selection.getRangeAt(0);

    if (!editableElement.contains(range.commonAncestorContainer)) {
      listElement.appendChild(this.createListItem("", listTagName));
      editableElement.appendChild(listElement);
      this.selectList(listElement);
      syncListChange();
      return;
    }

    if (range.collapsed) {
      listElement.appendChild(this.createListItem("", listTagName));
      range.insertNode(listElement);
      this.selectList(listElement);
      syncListChange();
      return;
    }

    const selectedContent = range.extractContents();
    const temporaryElement = document.createElement("div");
    temporaryElement.appendChild(selectedContent);

    const lines = this.extractListLines(temporaryElement);

    const values = lines.length ? lines : [""];

    values.forEach((line) => {
      listElement.appendChild(this.createListItem(line, listTagName));
    });

    range.insertNode(listElement);
    this.selectList(listElement);
    syncListChange();
  }

  applyTableCellList(listTagName, editableElement) {
    const selection = window.getSelection();
    let range =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (
      (!range || !editableElement.contains(range.commonAncestorContainer)) &&
      this.savedNonCollapsedSelectionRange
    ) {
      const savedRange = this.savedNonCollapsedSelectionRange.cloneRange();
      if (editableElement.contains(savedRange.commonAncestorContainer)) {
        range = savedRange;
        selection?.removeAllRanges();
        selection?.addRange(savedRange);
      }
    }

    const listElement = this.createListElement(listTagName);

    if (!range || !editableElement.contains(range.commonAncestorContainer)) {
      listElement.appendChild(this.createListItem("", listTagName));
      editableElement.appendChild(listElement);
      this.selectList(listElement);
      return;
    }

    if (range.collapsed) {
      if (
        this.wrapCurrentTableLineInList(range, editableElement, listTagName)
      ) {
        return;
      }

      listElement.appendChild(this.createListItem("", listTagName));
      range.insertNode(listElement);
      this.selectList(listElement);
      return;
    }

    const selectedContent = range.extractContents();
    const temporaryElement = document.createElement("div");
    temporaryElement.appendChild(selectedContent);

    const lines = this.extractListLines(temporaryElement);

    const values = lines.length ? lines : [selection?.toString()?.trim() || ""];
    values.forEach((line) => {
      listElement.appendChild(this.createListItem(line, listTagName));
    });

    range.insertNode(listElement);
    this.selectList(listElement);
  }

  wrapCurrentTableLineInList(range, editableElement, listTagName) {
    if (!range || !editableElement) {
      return false;
    }

    const paragraphRange = this.getCurrentTableLineRange(
      range,
      editableElement
    );
    if (!paragraphRange) {
      return false;
    }

    const extracted = paragraphRange.cloneContents();
    const temporaryElement = document.createElement("div");
    temporaryElement.appendChild(extracted);
    const lineText = (temporaryElement.textContent || "")
      .replace(/\u200B/g, "")
      .trim();

    if (!lineText) {
      return false;
    }

    const listElement = this.createListElement(listTagName);
    listElement.appendChild(this.createListItem(lineText, listTagName));
    paragraphRange.deleteContents();
    paragraphRange.insertNode(listElement);
    this.selectList(listElement);
    return true;
  }

  getCurrentTableLineRange(range, editableElement) {
    if (!range || !editableElement) {
      return null;
    }

    const normalizedRange = range.cloneRange();
    normalizedRange.collapse(true);

    const lineRange = document.createRange();
    lineRange.setStart(
      normalizedRange.startContainer,
      normalizedRange.startOffset
    );
    lineRange.setEnd(normalizedRange.endContainer, normalizedRange.endOffset);

    while (
      this.moveRangeBoundaryBackwardToLineEdge(lineRange, editableElement)
    ) {
      // Walk to the beginning of the current visual line.
    }

    while (
      this.moveRangeBoundaryForwardToLineEdge(lineRange, editableElement)
    ) {
      // Walk to the end of the current visual line.
    }

    return lineRange;
  }

  moveRangeBoundaryBackwardToLineEdge(range, root) {
    const probe = range.cloneRange();

    try {
      if (probe.startContainer === root && probe.startOffset === 0) {
        return false;
      }

      probe.setStart(probe.startContainer, Math.max(0, probe.startOffset - 1));
    } catch {
      return false;
    }

    const fragment = probe.cloneContents();
    const html = this.getFragmentHtml(fragment);
    if (/<br\b[^>]*>$/i.test(html)) {
      return false;
    }

    range.setStart(probe.startContainer, probe.startOffset);
    return true;
  }

  moveRangeBoundaryForwardToLineEdge(range, root) {
    const probe = range.cloneRange();

    try {
      if (
        probe.endContainer === root &&
        probe.endOffset >= root.childNodes.length
      ) {
        return false;
      }

      probe.setEnd(probe.endContainer, probe.endOffset + 1);
    } catch {
      return false;
    }

    const fragment = probe.cloneContents();
    const html = this.getFragmentHtml(fragment);
    if (/^<br\b[^>]*>/i.test(html.replace(/^[\s\u200B]+/, ""))) {
      return false;
    }

    range.setEnd(probe.endContainer, probe.endOffset);
    return true;
  }

  getFragmentHtml(fragment) {
    return getFragmentHtml(fragment);
  }

  extractListLines(container) {
    if (!container) {
      return [];
    }

    const lines = [];
    let currentLine = "";
    const blockTags = new Set([
      "DIV",
      "P",
      "LI",
      "TR",
      "TD",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6"
    ]);

    const flushLine = () => {
      const normalized = currentLine.replace(/\u200B/g, "").trim();
      if (normalized) {
        lines.push(normalized);
      }
      currentLine = "";
    };

    const walk = (node) => {
      if (!node) {
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        currentLine += node.textContent || "";
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (node.tagName === "BR") {
        flushLine();
        return;
      }

      const isBlock = blockTags.has(node.tagName);
      if (isBlock && currentLine.trim()) {
        flushLine();
      }

      Array.from(node.childNodes).forEach(walk);

      if (isBlock) {
        flushLine();
      }
    };

    Array.from(container.childNodes).forEach(walk);
    flushLine();

    return lines;
  }

  toggleExistingList(listTagName, editableElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    if (!editableElement.contains(range.commonAncestorContainer)) {
      return false;
    }

    const container =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    const existingList = container?.closest?.("ul,ol");

    if (!existingList || !editableElement.contains(existingList)) {
      return false;
    }

    if (existingList.tagName.toLowerCase() !== listTagName) {
      const replacementList = this.createListElement(listTagName);

      while (existingList.firstChild) {
        replacementList.appendChild(existingList.firstChild);
      }

      existingList.replaceWith(replacementList);
      this.selectList(replacementList);
      return true;
    }

    const fragment = document.createDocumentFragment();
    Array.from(existingList.children).forEach((child) => {
      if (child.tagName?.toLowerCase() === "li") {
        const lines = Array.from(child.childNodes);
        lines.forEach((node, index) => {
          fragment.appendChild(node.cloneNode(true));
          if (index < lines.length - 1) {
            fragment.appendChild(document.createElement("br"));
          }
        });
        fragment.appendChild(document.createElement("br"));
      } else {
        fragment.appendChild(child.cloneNode(true));
      }
    });

    if (fragment.lastChild?.nodeName === "BR") {
      fragment.removeChild(fragment.lastChild);
    }

    existingList.replaceWith(fragment);
    this.moveCursorToEnd(editableElement);
    return true;
  }

  createListElement(listTagName) {
    const listElement = document.createElement(listTagName);
    listElement.className =
      listTagName === "ol"
        ? "rich-native-list rich-native-list-ordered"
        : "rich-native-list rich-native-list-unordered";
    return listElement;
  }

  createListItem(text) {
    const listItem = document.createElement("li");

    listItem.className = "rich-native-list-item";
    if (text) {
      listItem.textContent = text;
    } else {
      // Keep an editable caret anchor without showing placeholder text.
      // Sanitization removes this zero-width character before saving.
      listItem.appendChild(document.createTextNode("​"));
    }

    return listItem;
  }

  selectList(listElement) {
    const selection = window.getSelection();

    if (!selection) {
      return;
    }

    const lastItem = listElement?.querySelector?.("li:last-child");
    if (lastItem) {
      const range = document.createRange();
      range.selectNodeContents(lastItem);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      this.savedSelectionRange = range.cloneRange();
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(listElement);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
  }

  handleTableListEnter(editableElement, shouldInsertBreak = false) {
    const selection = window.getSelection();
    if (!editableElement || !selection || selection.rangeCount === 0) {
      return false;
    }

    const range = selection.getRangeAt(0);
    if (!editableElement.contains(range.commonAncestorContainer)) {
      return false;
    }

    const container =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentElement
        : range.commonAncestorContainer;
    const currentItem = container?.closest?.("li");
    const currentList = container?.closest?.("ul,ol");

    if (
      !currentItem ||
      !currentList ||
      !editableElement.contains(currentList)
    ) {
      return false;
    }

    if (shouldInsertBreak) {
      this.insertLineBreak(currentItem);
      return true;
    }

    const currentText = (currentItem.textContent || "")
      .replace(/\u200B/g, "")
      .trim();

    if (!currentText) {
      const trailingBreak = document.createElement("br");
      currentList.parentNode?.insertBefore(
        trailingBreak,
        currentList.nextSibling
      );
      currentItem.remove();

      if (!currentList.querySelector("li")) {
        currentList.remove();
      }

      this.placeCaretAfterNode(trailingBreak);
      this.dispatchTableDataChange();
      this.emitRichTextState();
      return true;
    }

    const nextItem = this.createListItem("");
    const caretNode = document.createTextNode("​");
    nextItem.textContent = "";
    nextItem.appendChild(caretNode);
    currentItem.parentNode.insertBefore(nextItem, currentItem.nextSibling);
    this.placeCaretInsideNode(caretNode);
    this.dispatchTableDataChange();
    this.emitRichTextState();
    return true;
  }

  placeCaretAfterNode(node) {
    const selection = window.getSelection();
    if (!selection || !node) {
      return;
    }

    const range = document.createRange();
    range.setStartAfter(node);
    range.setEndAfter(node);
    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
  }

  placeCaretInsideNode(node) {
    const selection = window.getSelection();
    if (!selection || !node) {
      return;
    }

    const range = document.createRange();
    const offset = node.textContent?.length || 0;
    range.setStart(node, offset);
    range.setEnd(node, offset);
    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
  }

  handleWindowMouseUp() {
    if (!this.isEditing) {
      return;
    }

    window.setTimeout(() => {
      this.saveSelection();
    }, 0);
  }

  handleDocumentSelectionChange() {
    if (!this.isEditing) {
      return;
    }

    window.setTimeout(() => {
      this.saveSelection();
    }, 0);
  }

  syncEditableText() {
    const editableElement = this.template.querySelector("[data-text-style-id]");

    if (
      !editableElement ||
      this.isEditing ||
      editableElement === document.activeElement
    ) {
      return;
    }

    const content = this._block.content || "";

    const normalizedContent = this.normalizeRichTextContent(content);
    if (getSanitizedInnerHtml(editableElement) !== normalizedContent) {
      setSanitizedInnerHtml(editableElement, normalizedContent);
    }
  }

  handleClick(event) {
    event.stopPropagation();
    if (event.target?.closest?.(".table-cell-editable")) {
      return;
    }

    // Enter edit mode on the second click directly. Waiting for `dblclick`
    // is unreliable when the parent selection causes an LWC rerender
    // between both clicks, especially for newly pasted text blocks.
    if (event.detail >= 2 && (this._block?.isText || this._block?.isField)) {
      event.preventDefault();
      this.startTextEditing(event);
      return;
    }

    this.dispatchEvent(
      new CustomEvent("selectblock", {
        detail: {
          blockId: this._block.id,
          regionId: this.regionId,
          clientX: event.clientX,
          clientY: event.clientY
        }
      })
    );
  }

  handleNativeDragStart(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  handleMouseDown(event) {
    if (event.target?.closest?.(".table-cell-editable")) {
      event.stopPropagation();
    }
  }

  handleDoubleClick(event) {
    if (this.isEditing && this.isEditableTextTarget(event.target)) {
      event.stopPropagation();

      window.setTimeout(() => {
        this.saveSelection();
        this.emitRichTextState();
      }, 0);

      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (this._block?.isText || this._block?.isField) {
      this.startTextEditing(event);
      return;
    }

    if (!this._block?.isImage) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent("imagedoubleclick", {
        detail: {
          blockId: this._block.id,
          regionId: this.regionId
        },
        bubbles: true,
        composed: true
      })
    );
  }

  isEditableTextTarget(target) {
    const editableElement = this.template.querySelector("[data-text-style-id]");

    return Boolean(
      editableElement && target && editableElement.contains(target)
    );
  }

  @api
  startTextEditing(event = null) {
    this.isEditing = true;
    const activateEditing = () => {
      const editableElement = this.template.querySelector(
        "[data-text-style-id]"
      );

      if (!editableElement) {
        return false;
      }

      editableElement.setAttribute("contenteditable", "true");
      editableElement.dataset.editing = "true";
      editableElement.focus({ preventScroll: true });
      if (
        !this.moveCursorToPoint(editableElement, event?.clientX, event?.clientY)
      ) {
        this.moveCursorToEnd(editableElement);
      }
      this.handleTextFocus();
      return true;
    };

    requestAnimationFrame(() => {
      activateEditing();
    });
  }

  moveCursorToPoint(editableElement, clientX, clientY) {
    if (
      !editableElement ||
      !Number.isFinite(clientX) ||
      !Number.isFinite(clientY)
    ) {
      return false;
    }

    const range =
      typeof document.caretRangeFromPoint === "function"
        ? document.caretRangeFromPoint(clientX, clientY)
        : null;

    if (!range || !editableElement.contains(range.startContainer)) {
      return false;
    }

    const selection = window.getSelection();
    if (!selection) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    this.savedSelectionRange = range.cloneRange();
    return true;
  }

  moveCursorToEnd(editableElement) {
    const range = document.createRange();
    const selection = window.getSelection();

    range.selectNodeContents(editableElement);
    range.collapse(false);

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    this.savedSelectionRange = range.cloneRange();
  }

  handleEditableKeyDown(event) {
    if (!this.isEditing) {
      return;
    }

    event.stopPropagation();
  }

  insertLineBreak(editableElement) {
    const selection = window.getSelection();

    if (!editableElement || !selection || selection.rangeCount === 0) {
      return;
    }

    let range = selection.getRangeAt(0);

    if (!editableElement.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(editableElement);
      range.collapse(false);
    }

    range.deleteContents();

    const lineBreak = document.createElement("br");
    const caretNode = document.createTextNode("​");

    range.insertNode(lineBreak);
    range.setStartAfter(lineBreak);
    range.collapse(true);
    range.insertNode(caretNode);
    range.setStartAfter(caretNode);
    range.setEndAfter(caretNode);

    selection.removeAllRanges();
    selection.addRange(range);

    this.savedSelectionRange = range.cloneRange();

    if (this.block?.isTable) {
      this.dispatchTableDataChange();
    } else {
      this.dispatchTextChange(this.getSanitizedEditableHtml(editableElement));
    }

    this.emitRichTextState();
  }

  handleTextInput(event) {
    const editableElement = event.currentTarget;

    // Keep the parent model and auto-height in sync for every edit
    // (typing, Enter, paste, delete and native rich-text mutations).
    // Previously content was dispatched only on blur or toolbar commands,
    // leaving the box at its old fixed height while the browser scrolled
    // the contenteditable internally and hid its first lines.
    this.saveSelection(false);
    this.dispatchTextChange(this.getSanitizedEditableHtml(editableElement));

    window.setTimeout(() => {
      if (!this.isEditing || document.activeElement !== editableElement) {
        return;
      }

      this.saveSelection(false);
    }, 0);
  }

  handleTableCellInput(event) {
    // Keep parent table state in sync while editing so sibling cell focus
    // cannot restore stale content on the next render.
    this.activeTableCellKey =
      event.currentTarget?.dataset?.cellKey || this.activeTableCellKey;
    this.saveSelection(false);
    this.dispatchTableDataChange();
  }

  handleTableCellFocus(event) {
    this.activeTableCellKey =
      event.currentTarget?.dataset?.cellKey || this.activeTableCellKey;
    this.handleTextFocus();
  }

  handleTableCellMouseDown(event) {
    if (!this.isEditing) {
      return;
    }

    event.stopPropagation();
    window.setTimeout(() => {
      this.saveSelection();
    }, 0);
  }

  handleTableCellClick(event) {
    event.stopPropagation();
    this.activeTableCellKey =
      event.currentTarget?.dataset?.cellKey || this.activeTableCellKey;
    this.saveSelection();
    this.emitRichTextState();
  }

  handleTableCellKeyDown(event) {
    this.activeTableCellKey =
      event.currentTarget?.dataset?.cellKey || this.activeTableCellKey;
    event.stopPropagation();

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (this.handleTableListEnter(event.currentTarget, event.shiftKey)) {
      return;
    }

    this.insertLineBreak(event.currentTarget);
  }

  handleTableCellKeyUp(event) {
    this.activeTableCellKey =
      event.currentTarget?.dataset?.cellKey || this.activeTableCellKey;
    this.saveSelection();
    this.emitRichTextState();
  }

  handleTableCellBlur(event) {
    this.activeTableCellKey =
      event.currentTarget?.dataset?.cellKey || this.activeTableCellKey;
    this.saveSelection();
    this.dispatchTableDataChange();
    this.isEditing = false;
  }

  handleTableCellDragOver(event) {
    event.preventDefault();
  }

  handleTableCellDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const cellElement = event.currentTarget;
    const transfer = event.dataTransfer;
    if (!cellElement || !transfer) {
      return;
    }

    const files = Array.from(transfer.files || []);
    const imageFile = files.find((file) => file.type?.startsWith("image/"));

    if (imageFile) {
      const reader = new FileReader();
      reader.onload = () => {
        setSanitizedInnerHtml(
          cellElement,
          this.buildTableCellImageHtml(reader.result)
        );
        this.dispatchTableDataChange();
      };
      reader.readAsDataURL(imageFile);
      return;
    }

    const uri =
      transfer.getData("text/uri-list") || transfer.getData("text/plain");
    if (normalizeImageUrl(uri)) {
      setSanitizedInnerHtml(
        cellElement,
        this.buildTableCellImageHtml(uri.trim())
      );
      this.dispatchTableDataChange();
      return;
    }

    const html = transfer.getData("text/html");
    if (html) {
      const srcMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (srcMatch?.[1]) {
        setSanitizedInnerHtml(
          cellElement,
          this.buildTableCellImageHtml(srcMatch[1])
        );
        this.dispatchTableDataChange();
      }
    }
  }

  dispatchTextChange(content) {
    this.dispatchEvent(
      new CustomEvent("textchange", {
        detail: {
          blockId: this._block.id,
          content
        }
      })
    );
  }

  dispatchTableDataChange() {
    this.dispatchTextChange({
      type: "tableData",
      ...this.collectTableData()
    });
  }

  @api
  persistTableData() {
    if (!this.block?.isTable) {
      return;
    }

    this.dispatchTableDataChange();
  }

  collectTableData() {
    const rows = this.block?.tableRows || [];
    const rowCount = rows.length;
    const columnCount = rowCount > 0 ? rows[0].cells?.length || 0 : 0;
    const data = Array.from(Array(rowCount).keys()).map((rowIndex) =>
      Array.from(Array(columnCount).keys()).map(
        (columnIndex) =>
          this.block?.tableRows?.[rowIndex]?.cells?.[columnIndex]?.content || ""
      )
    );
    const tableCellAlignments = Array.from(Array(rowCount).keys()).map(
      (rowIndex) =>
        Array.from(Array(columnCount).keys()).map(
          (columnIndex) =>
            this.block?.tableCellAlignments?.[rowIndex]?.[columnIndex] || "top"
        )
    );

    const editedCells = new Map();
    const editedAlignments = new Map();

    this.template
      .querySelectorAll(".table-cell-editable")
      .forEach((cellElement) => {
        const rowIndex = Number(cellElement.dataset.rowIndex);
        const columnIndex = Number(cellElement.dataset.columnIndex);
        const tableCell = cellElement.closest("td");

        if (
          Number.isInteger(rowIndex) &&
          Number.isInteger(columnIndex) &&
          data[rowIndex] &&
          columnIndex < data[rowIndex].length
        ) {
          const cellKey = `${rowIndex}:${columnIndex}`;
          editedCells.set(cellKey, getSanitizedInnerHtml(cellElement));
          editedAlignments.set(
            cellKey,
            tableCell?.style?.verticalAlign ||
              this.block?.tableCellAlignments?.[rowIndex]?.[columnIndex] ||
              "top"
          );
        }
      });

    return {
      tableData: data.map((row, rowIndex) =>
        row.map((cell, columnIndex) => {
          const cellKey = `${rowIndex}:${columnIndex}`;
          return editedCells.has(cellKey) ? editedCells.get(cellKey) : cell;
        })
      ),
      tableCellAlignments: tableCellAlignments.map((row, rowIndex) =>
        row.map((alignment, columnIndex) => {
          const cellKey = `${rowIndex}:${columnIndex}`;
          return editedAlignments.has(cellKey)
            ? editedAlignments.get(cellKey)
            : alignment;
        })
      )
    };
  }

  syncTableCells() {
    if (!this.block?.isTable) {
      return;
    }

    if (this.isEditing) {
      return;
    }

    this.template
      .querySelectorAll(".table-cell-editable")
      .forEach((cellElement) => {
        const rowIndex = Number(cellElement.dataset.rowIndex);
        const columnIndex = Number(cellElement.dataset.columnIndex);
        const nextHtml = sanitizeRichTextHtml(
          this.block?.tableRows?.[rowIndex]?.cells?.[columnIndex]?.content || ""
        );
        const isActiveCell =
          cellElement === document.activeElement ||
          cellElement.dataset.cellKey === this.activeTableCellKey;

        if (!isActiveCell && getSanitizedInnerHtml(cellElement) !== nextHtml) {
          setSanitizedInnerHtml(cellElement, nextHtml);
        }
      });
  }

  buildTableCellImageHtml(source) {
    const normalizedSource = normalizeImageUrl(source);
    if (!normalizedSource) {
      return "";
    }
    const safeSource = normalizedSource
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    return `<img src="${safeSource}" alt="" class="table-cell-image" />`;
  }

  handleTextFocus() {
    this.isEditing = true;
    // Set the active block in the parent before publishing the formatting
    // at the caret. This matters when focus moves directly between texts.
    this.dispatchEvent(
      new CustomEvent("textfocus", {
        detail: {
          blockId: this._block.id
        }
      })
    );
    this.saveSelection();
  }

  handleTextBlur() {
    this.saveSelection();
    this.dispatchTextChange(this.getEditableHtml());

    this.dispatchEvent(
      new CustomEvent("textblur", {
        detail: {
          blockId: this._block.id
        },
        bubbles: true,
        composed: true
      })
    );
  }

  @api
  stopTextEditing() {
    const editableElement = this.getActiveEditableElement();

    if (this.block?.isTable) {
      this.dispatchTableDataChange();
    } else {
      this.dispatchTextChange(this.getEditableHtml());
    }

    this.isEditing = false;
    this.savedSelectionRange = null;
    this.savedNonCollapsedSelectionRange = null;

    // Table cells remain contenteditable so a user can enter a cell directly.
    // Ending an editing session must therefore explicitly release native DOM
    // focus; otherwise Backspace/Delete is still handled by the old cell even
    // after another block has been selected in the builder.
    if (editableElement && typeof editableElement.blur === "function") {
      editableElement.blur();
    }
    this.activeTableCellKey = undefined;
  }

  @api
  measureAutoHeight() {
    if (!(this.block?.isText || this.block?.isField)) {
      return null;
    }

    const blockElement = this.template.querySelector(".pdf-block");
    const contentElement = this.getPrimaryEditableElement();

    if (!blockElement || !contentElement) {
      return null;
    }

    const blockStyle = window.getComputedStyle(blockElement);
    const contentStyle = window.getComputedStyle(contentElement);
    const paddingY =
      (parseFloat(blockStyle.paddingTop) || 0) +
      (parseFloat(blockStyle.paddingBottom) || 0);
    const borderY =
      (parseFloat(blockStyle.borderTopWidth) || 0) +
      (parseFloat(blockStyle.borderBottomWidth) || 0);
    const marginY =
      (parseFloat(contentStyle.marginTop) || 0) +
      (parseFloat(contentStyle.marginBottom) || 0);
    const contentHeight = Math.max(
      contentElement.scrollHeight || 0,
      Math.ceil(contentElement.getBoundingClientRect().height) || 0,
      18
    );

    return Math.ceil(contentHeight + paddingY + borderY + marginY);
  }

  getEditableHtml() {
    const editableElement = this.getPrimaryEditableElement();
    return editableElement
      ? this.getSanitizedEditableHtml(editableElement)
      : this._block.content || "";
  }

  getSanitizedEditableHtml(editableElement) {
    const clone = editableElement.cloneNode(true);
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    let node = walker.nextNode();

    while (node) {
      textNodes.push(node);
      node = walker.nextNode();
    }

    textNodes.forEach((textNode) => {
      textNode.textContent = textNode.textContent.replace(/\u200B/g, "");
    });

    clone.querySelectorAll("span").forEach((span) => {
      if (!span.textContent && !span.querySelector("img, a, br")) {
        span.remove();
      }
    });

    this.removeFrameworkRuntimeAttributes(clone);
    this.removeDefaultInlineEditorColors(clone);
    return getSanitizedInnerHtml(clone);
  }

  removeFrameworkRuntimeAttributes(container) {
    if (!container) {
      return;
    }

    container.querySelectorAll("*").forEach((element) => {
      Array.from(element.attributes || []).forEach((attribute) => {
        if (attribute.name.toLowerCase().startsWith("lwc-")) {
          element.removeAttribute(attribute.name);
        }
      });
    });
  }

  removeDefaultInlineEditorColors(container) {
    if (!container) {
      return;
    }

    const isDefaultEditorColor = (value) => {
      const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      return [
        "#181818",
        "#080707",
        "#000",
        "#000000",
        "black",
        "rgb(24,24,24)",
        "rgb(8,7,7)",
        "rgb(0,0,0)"
      ].includes(normalized);
    };

    container.querySelectorAll("[style]").forEach((element) => {
      if (!isDefaultEditorColor(element.style.color)) {
        return;
      }

      element.style.removeProperty("color");
      if (
        !element.getAttribute("style") ||
        !element.getAttribute("style").trim()
      ) {
        element.removeAttribute("style");
      }
    });

    container.querySelectorAll("font[color]").forEach((element) => {
      if (isDefaultEditorColor(element.getAttribute("color"))) {
        element.removeAttribute("color");
      }
    });
  }

  @api
  applyTableCellVerticalAlign(rawValue) {
    if (!this.block?.isTable) {
      return;
    }

    const value =
      rawValue === "middle" || rawValue === "bottom" ? rawValue : "top";
    const editableElement = this.getActiveEditableElement();
    const tableCell = editableElement?.closest?.("td");

    if (!editableElement || !tableCell) {
      return;
    }

    tableCell.style.verticalAlign = value;
    editableElement.style.display = "flex";
    editableElement.style.flexDirection = "column";
    editableElement.style.justifyContent =
      value === "middle"
        ? "center"
        : value === "bottom"
          ? "flex-end"
          : "flex-start";
    editableElement.style.height = "100%";
    editableElement.style.minHeight = "20px";
    this.saveSelection(false);
    this.dispatchTableDataChange();
    this.emitRichTextState();
  }

  @api
  saveCurrentSelection() {
    this.saveSelection();
  }

  saveSelection(emitState = true) {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const editableElement = this.getActiveEditableElement(
      selection.getRangeAt(0)
    );
    const range = selection.getRangeAt(0);

    if (
      !editableElement ||
      !editableElement.contains(range.commonAncestorContainer)
    ) {
      return;
    }

    this.savedSelectionRange = range.cloneRange();

    if (!range.collapsed) {
      this.savedNonCollapsedSelectionRange = range.cloneRange();
    }

    if (emitState) {
      this.emitRichTextState();
    }
  }

  @api
  restoreSelection() {
    this.restoreSelectionRange(this.savedSelectionRange);
  }

  restoreFormattingSelection() {
    const rangeToRestore =
      this.savedSelectionRange && !this.savedSelectionRange.collapsed
        ? this.savedSelectionRange
        : this.savedNonCollapsedSelectionRange;

    this.restoreSelectionRange(rangeToRestore);
  }

  restoreSelectionRange(rangeToRestore) {
    if (!rangeToRestore) {
      return;
    }

    const editableElement = this.getActiveEditableElement(rangeToRestore);
    const selection = window.getSelection();

    if (!editableElement || !selection) {
      return;
    }

    try {
      if (!editableElement.contains(rangeToRestore.commonAncestorContainer)) {
        return;
      }

      selection.removeAllRanges();
      selection.addRange(rangeToRestore.cloneRange());
      this.savedSelectionRange = rangeToRestore.cloneRange();

      if (!rangeToRestore.collapsed) {
        this.savedNonCollapsedSelectionRange = rangeToRestore.cloneRange();
      }
    } catch {
      // Ignore browser state that became stale during the interaction.
    }
  }

  emitRichTextState() {
    this.dispatchEvent(
      new CustomEvent("richtextstatechange", {
        detail: {
          blockId: this._block.id,
          ...this.getRichTextState()
        },
        bubbles: true,
        composed: true
      })
    );
  }

  getRichTextState() {
    const selection = window.getSelection();
    const selectedElement = this.getSelectionElement(selection);
    const computedStyle = selectedElement
      ? window.getComputedStyle(selectedElement)
      : null;
    const fontSize = computedStyle
      ? Math.round(parseFloat(computedStyle.fontSize))
      : 14;
    const fontFamily = computedStyle
      ? this.normalizeFontFamily(computedStyle.fontFamily)
      : "Arial";
    const color = computedStyle
      ? this.rgbToHex(computedStyle.color)
      : "#181818";
    const paragraphElement =
      selectedElement?.closest?.("p,div,li,h1,h2,h3,h4,h5,h6") ||
      selectedElement;
    const paragraphStyle = paragraphElement
      ? window.getComputedStyle(paragraphElement)
      : computedStyle;
    const paragraphFontSize = paragraphStyle
      ? parseFloat(paragraphStyle.fontSize)
      : fontSize;
    const computedLineHeight = paragraphStyle
      ? parseFloat(paragraphStyle.lineHeight)
      : 0;
    const inlineLineHeight = String(
      paragraphElement?.style?.lineHeight || ""
    ).trim();
    const explicitUnitlessLineHeight = /^\d*\.?\d+$/.test(inlineLineHeight)
      ? Number(inlineLineHeight)
      : 0;
    const lineHeight =
      explicitUnitlessLineHeight > 0
        ? explicitUnitlessLineHeight
        : computedLineHeight > 0 && paragraphFontSize > 0
          ? Math.round((computedLineHeight / paragraphFontSize) * 100) / 100
          : 1.25;
    const editableElement = this.getActiveEditableElement(
      selection?.rangeCount ? selection.getRangeAt(0) : null
    );
    const listContainer = selectedElement?.closest?.("ul,ol");
    let verticalAlign = "top";
    let textAlign = "left";

    if (this.block?.isTable) {
      const tableCell = editableElement?.closest?.("td");
      const localJustify = editableElement
        ? window.getComputedStyle(editableElement).justifyContent
        : "";
      if (localJustify === "center") {
        verticalAlign = "middle";
      } else if (localJustify === "flex-end") {
        verticalAlign = "bottom";
      } else {
        const cellAlign = tableCell
          ? window.getComputedStyle(tableCell).verticalAlign
          : "";
        if (cellAlign === "middle" || cellAlign === "bottom") {
          verticalAlign = cellAlign;
        }
      }
      const localTextAlign =
        computedStyle?.textAlign ||
        (selectedElement
          ? window.getComputedStyle(selectedElement).textAlign
          : "") ||
        (editableElement
          ? window.getComputedStyle(editableElement).textAlign
          : "");
      if (
        localTextAlign === "left" ||
        localTextAlign === "center" ||
        localTextAlign === "right" ||
        localTextAlign === "justify"
      ) {
        textAlign = localTextAlign;
      } else {
        const cellTextAlign = tableCell
          ? window.getComputedStyle(tableCell).textAlign
          : "";
        if (
          cellTextAlign === "center" ||
          cellTextAlign === "right" ||
          cellTextAlign === "justify"
        ) {
          textAlign = cellTextAlign;
        }
      }
    } else {
      const configuredVerticalAlign = this.block?.styles?.verticalAlign;
      const justifyContent = editableElement
        ? window.getComputedStyle(editableElement).justifyContent
        : "";
      if (configuredVerticalAlign === "middle" || justifyContent === "center") {
        verticalAlign = "middle";
      } else if (
        configuredVerticalAlign === "bottom" ||
        justifyContent === "flex-end"
      ) {
        verticalAlign = "bottom";
      }

      const computedTextAlign =
        computedStyle?.textAlign ||
        (editableElement || selectedElement
          ? window.getComputedStyle(editableElement || selectedElement)
              .textAlign
          : "");
      if (
        computedTextAlign === "center" ||
        computedTextAlign === "right" ||
        computedTextAlign === "justify"
      ) {
        textAlign = computedTextAlign;
      }
    }

    return {
      bold:
        getRichTextCommandState("bold") ||
        Number(computedStyle?.fontWeight || 400) >= 600,
      italic:
        getRichTextCommandState("italic") ||
        computedStyle?.fontStyle === "italic",
      underline:
        getRichTextCommandState("underline") ||
        (computedStyle?.textDecorationLine || "").includes("underline"),
      unorderedList:
        listContainer?.tagName?.toLowerCase() === "ul" ||
        getRichTextCommandState("insertUnorderedList"),
      orderedList:
        listContainer?.tagName?.toLowerCase() === "ol" ||
        getRichTextCommandState("insertOrderedList"),
      color,
      fontFamily,
      fontSize: String(Math.max(1, Math.min(72, fontSize || 14))),
      lineHeight: String(Math.max(0.25, Math.min(3, lineHeight || 1.25))),
      textAlign,
      verticalAlign
    };
  }

  getSelectionElement(selection) {
    if (!selection || selection.rangeCount === 0) {
      return this.getPrimaryEditableElement();
    }

    let node = selection.anchorNode;

    if (node?.nodeType === Node.TEXT_NODE) {
      node = node.parentElement;
    }

    return node || this.getPrimaryEditableElement();
  }

  getPrimaryEditableElement() {
    if (this.block?.isTable) {
      return (
        this.getPreferredTableCellElement() ||
        this.template.querySelector(".table-cell-editable")
      );
    }

    return this.template.querySelector("[data-text-style-id]");
  }

  getActiveEditableElement(range = null) {
    if (this.block?.isTable) {
      const activeElement = document.activeElement;
      if (
        activeElement?.classList?.contains("table-cell-editable") &&
        this.template.contains(activeElement)
      ) {
        return activeElement;
      }

      if (range?.commonAncestorContainer) {
        const container =
          range.commonAncestorContainer.nodeType === Node.TEXT_NODE
            ? range.commonAncestorContainer.parentElement
            : range.commonAncestorContainer;
        const cell = container?.closest?.(".table-cell-editable");
        if (cell && this.template.contains(cell)) {
          return cell;
        }
      }

      return (
        this.getPreferredTableCellElement() ||
        this.template.querySelector(".table-cell-editable")
      );
    }

    return this.template.querySelector("[data-text-style-id]");
  }

  getPreferredTableCellElement() {
    if (!this.activeTableCellKey) {
      return null;
    }

    return this.template.querySelector(
      `.table-cell-editable[data-cell-key="${this.activeTableCellKey}"]`
    );
  }

  normalizeFontFamily(value = "") {
    const fontFamily = value.split(",")[0].replace(/["']/g, "").trim();
    const supportedFonts = [
      "Arial",
      "Helvetica",
      "Verdana",
      "Tahoma",
      "Trebuchet MS",
      "Times New Roman",
      "Georgia",
      "Garamond",
      "Courier New",
      "Lucida Console",
      "Impact",
      "Palatino Linotype",
      "Segoe UI",
      "Calibri",
      "Cambria",
      "Open Sans",
      "Roboto",
      "Montserrat",
      "Lato",
      "Poppins"
    ];
    const normalizedFontFamily = supportedFonts.find(
      (supportedFont) =>
        supportedFont.toLowerCase() === fontFamily.toLowerCase()
    );

    return normalizedFontFamily || "Arial";
  }

  rgbToHex(value = "") {
    const match = value.match(/\d+/g);

    if (!match || match.length < 3) {
      return "#181818";
    }

    return `#${match
      .slice(0, 3)
      .map((part) => {
        return Number(part).toString(16).padStart(2, "0");
      })
      .join("")}`;
  }

  normalizeRichTextContent(value) {
    const content = value || "";

    if (content.includes("<") && content.includes(">")) {
      const container = document.createElement("div");
      setSanitizedInnerHtml(container, content);
      this.removeFrameworkRuntimeAttributes(container);
      this.removeDefaultInlineEditorColors(container);
      container.querySelectorAll("b, strong").forEach((element) => {
        element.style.fontWeight = "700";
      });
      return getSanitizedInnerHtml(container);
    }

    return this.escapeHtml(content).replace(/\r?\n/g, "<br>");
  }

  escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
