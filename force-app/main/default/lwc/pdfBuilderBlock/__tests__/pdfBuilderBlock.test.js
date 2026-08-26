import { createElement } from "@lwc/engine-dom";
import PDFBuilderBlock from "c/pdfBuilderBlock";

describe("c-pdf-builder-block", () => {
  afterEach(() => {
    // The jsdom instance is shared across test cases in a single file so reset the DOM
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("applies line height only to the paragraph containing the caret", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-1",
      type: "text",
      isText: true,
      content: "<p>First paragraph</p><p>Second paragraph</p>",
      styles: {},
      inlineStyle: "",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const editable = element.shadowRoot.querySelector(".text-content");
    const paragraphs = editable.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild, 2);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.queryCommandState = jest.fn(() => false);

    element.applyRichTextCommand("lineHeight", "0.25");

    expect(paragraphs[0].style.lineHeight).toBe("0.25");
    expect(paragraphs[1].style.lineHeight).toBe("");
  });

  it("reports the block vertical alignment for text boxes", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-vertical",
      type: "text",
      isText: true,
      content: "<p>Vertically aligned text</p>",
      styles: { verticalAlign: "bottom" },
      inlineStyle: "--block-height:160px;--block-vertical-align:flex-end",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const editable = element.shadowRoot.querySelector(".text-content");
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(true);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.queryCommandState = jest.fn(() => false);
    const stateChangeHandler = jest.fn();
    element.addEventListener("richtextstatechange", stateChangeHandler);

    element.applyRichTextCommand("bold");

    expect(stateChangeHandler.mock.calls.at(-1)[0].detail.verticalAlign).toBe(
      "bottom"
    );
  });

  it.each(["Verdana", "Tahoma", "Calibri", "Montserrat", "Poppins"])(
    "reports %s as the selected font instead of falling back to Arial",
    async (fontFamily) => {
      const element = createElement("c-pdf-builder-block", {
        is: PDFBuilderBlock
      });
      element.block = {
        id: "text-1",
        type: "text",
        isText: true,
        content: `<span style="font-family: ${fontFamily};">Formatted text</span>`,
        styles: {},
        inlineStyle: "",
        textStyle: "line-height:1.25"
      };

      document.body.appendChild(element);
      await Promise.resolve();

      const formattedText = element.shadowRoot.querySelector("span");
      const range = document.createRange();
      range.selectNodeContents(formattedText);
      range.collapse(true);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.queryCommandState = jest.fn(() => false);
      const stateChangeHandler = jest.fn();
      element.addEventListener("richtextstatechange", stateChangeHandler);

      element.applyRichTextCommand("bold");

      expect(stateChangeHandler.mock.calls.at(-1)[0].detail.fontFamily).toBe(
        fontFamily
      );
    }
  );

  it("applies line height to every paragraph in the selection", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-1",
      type: "text",
      isText: true,
      content:
        "<p>First paragraph</p><p>Second paragraph</p><p>Third paragraph</p>",
      styles: {},
      inlineStyle: "",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const editable = element.shadowRoot.querySelector(".text-content");
    const paragraphs = editable.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild, 2);
    range.setEnd(paragraphs[1].firstChild, 8);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.queryCommandState = jest.fn(() => false);
    const stateChangeHandler = jest.fn();
    element.addEventListener("richtextstatechange", stateChangeHandler);

    element.saveCurrentSelection();
    element.applyRichTextCommand("lineHeight", "2.5");

    expect(paragraphs[0].style.lineHeight).toBe("2.5");
    expect(paragraphs[1].style.lineHeight).toBe("2.5");
    expect(paragraphs[2].style.lineHeight).toBe("");
    expect(stateChangeHandler.mock.calls.at(-1)[0].detail.lineHeight).toBe(
      "2.5"
    );
  });

  it("aligns every selected paragraph without relying on execCommand", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-1",
      type: "text",
      isText: true,
      content:
        "<p>First paragraph</p><p>Second paragraph</p><p>Third paragraph</p>",
      styles: {},
      inlineStyle: "",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const editable = element.shadowRoot.querySelector(".text-content");
    const paragraphs = editable.querySelectorAll("p");
    const range = document.createRange();
    range.setStart(paragraphs[0].firstChild, 1);
    range.setEnd(paragraphs[1].firstChild, 8);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.queryCommandState = jest.fn(() => false);

    element.saveCurrentSelection();
    element.applyRichTextCommand("justifyCenter");

    expect(paragraphs[0].style.textAlign).toBe("center");
    expect(paragraphs[1].style.textAlign).toBe("center");
    expect(paragraphs[2].style.textAlign).toBe("");
  });

  it("moves list markers together with right-aligned list text", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-1",
      type: "text",
      isText: true,
      content: "<ul><li>First item</li><li>Second item</li></ul>",
      styles: {},
      inlineStyle: "",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const editable = element.shadowRoot.querySelector(".text-content");
    const list = editable.querySelector("ul");
    const listItems = editable.querySelectorAll("li");
    const range = document.createRange();
    range.selectNodeContents(list);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.queryCommandState = jest.fn(() => false);

    element.saveCurrentSelection();
    element.applyRichTextCommand("justifyRight");

    expect(list.style.textAlign).toBe("right");
    expect(list.style.listStylePosition).toBe("inside");
    expect(list.style.marginLeft).toBe("0px");
    expect(list.style.paddingLeft).toBe("0px");
    expect(listItems[0].style.textAlign).toBe("right");
    expect(listItems[1].style.textAlign).toBe("right");
  });

  it.each([
    ["insertUnorderedList", "ul"],
    ["insertOrderedList", "ol"]
  ])("creates an empty first item for %s", async (command, listTag) => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-1",
      type: "text",
      isText: true,
      content: "<p>Existing paragraph</p>",
      styles: {},
      inlineStyle: "",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const editable = element.shadowRoot.querySelector(".text-content");
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.queryCommandState = jest.fn(() => false);

    element.applyRichTextCommand(command);

    const listItem = editable.querySelector(`${listTag} > li`);
    expect(listItem).not.toBeNull();
    expect(listItem.textContent.replace(/\u200B/g, "")).toBe("");
    expect(editable.textContent).not.toContain("List item");
  });

  it("dispatches updated content on every text input", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-1",
      type: "text",
      isText: true,
      content: "<p>First line</p>",
      styles: {},
      inlineStyle: "",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const editable = element.shadowRoot.querySelector(".text-content");
    const textChangeHandler = jest.fn();
    element.addEventListener("textchange", textChangeHandler);
    editable.innerHTML = "<p>First line</p><p>New line</p>";

    editable.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertParagraph"
      })
    );

    expect(textChangeHandler).toHaveBeenCalled();
    expect(textChangeHandler.mock.calls.at(-1)[0].detail.content).toBe(
      "<p>First line</p><p>New line</p>"
    );
  });

  it("preserves visible bold formatting in manually rendered rich text", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "text-bold",
      type: "text",
      isText: true,
      content:
        '<ul><li><span class="s1"><b>Frequently asked question?</b></span> Answer.</li></ul>',
      styles: {},
      inlineStyle: "",
      textStyle: "line-height:1.25"
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const boldText = element.shadowRoot.querySelector(".text-content b");
    expect(boldText).not.toBeNull();
    expect(boldText.style.getPropertyValue("font-weight")).toBe("700");
  });

  it("closes a standard table with its configured border", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "table-1",
      type: "table",
      isTable: true,
      inlineStyle: "--block-padding:8px",
      styles: {
        tableBorderWidth: 2,
        tableBorderColor: "#123456"
      },
      tableRows: []
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const bottomBorder = element.shadowRoot.querySelector(
      ".table-bottom-border"
    );
    expect(bottomBorder).not.toBeNull();
    expect(bottomBorder.style.height).toBe("2px");
    expect(bottomBorder.style.backgroundColor).toBe("rgb(18, 52, 86)");
  });

  it("does not close a borderless standard table", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "table-1",
      type: "table",
      isTable: true,
      inlineStyle: "--block-padding:8px",
      styles: {
        tableBorderWidth: 0,
        tableBorderColor: "#c9c9c9"
      },
      tableRows: []
    };

    document.body.appendChild(element);
    await Promise.resolve();

    expect(element.shadowRoot.querySelector(".table-bottom-border")).toBeNull();
  });

  it("reports the intrinsic image aspect ratio to the builder", async () => {
    const element = createElement("c-pdf-builder-block", {
      is: PDFBuilderBlock
    });
    element.block = {
      id: "image-1",
      type: "image",
      isImage: true,
      hasImage: true,
      imageSrc:
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
      imageAlt: "Test image",
      inlineStyle: ""
    };

    document.body.appendChild(element);
    await Promise.resolve();

    const image = element.shadowRoot.querySelector(".image-content");
    Object.defineProperty(image, "naturalWidth", {
      configurable: true,
      value: 1200
    });
    Object.defineProperty(image, "naturalHeight", {
      configurable: true,
      value: 600
    });

    expect(element.getImageAspectRatio()).toBe(2);
  });
});
