import { createElement } from "@lwc/engine-dom";
import PDFBuilderWizard from "c/pdfBuilderWizard";
import getFields from "@salesforce/apex/PDFBuilderController.getFields";
import getRelatedLists from "@salesforce/apex/PDFBuilderController.getRelatedLists";
import getRelatedListFields from "@salesforce/apex/PDFBuilderController.getRelatedListFields";
import getRecordTypeOptions from "@salesforce/apex/PDFBuilderController.getRecordTypeOptions";
import generateWizardProposal from "@salesforce/apex/PDFBuilderAIService.generateWizardProposal";

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
  "@salesforce/apex/PDFBuilderAIService.generateWizardProposal",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const flushPromises = (remaining = 10) => {
  if (remaining <= 0) {
    return Promise.resolve();
  }
  return Promise.resolve().then(() => flushPromises(remaining - 1));
};

describe("c-pdf-builder-wizard", () => {
  beforeEach(() => {
    getFields.mockResolvedValue([
      { label: "Account Name", apiName: "Name" },
      { label: "Phone", apiName: "Phone" }
    ]);
    getRelatedLists.mockResolvedValue([
      {
        label: "Contacts",
        relationshipName: "Contacts",
        childObjectApiName: "Contact"
      }
    ]);
    getRelatedListFields.mockResolvedValue([
      { label: "Name", apiName: "Name" },
      { label: "Email", apiName: "Email" }
    ]);
    getRecordTypeOptions.mockResolvedValue([
      { label: "All record types", value: "ALL" }
    ]);
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          headerBackground: "#0176d3",
          headerContentPadding: 10,
          headerContentBorderStyle: "solid",
          headerContentBorderWidth: 1,
          headerContentBorderColor: "#181818",
          headerContentSizeMode: "content",
          headerTextColor: "#ffffff",
          headerFields: ["Name"]
        },
        summary: "Blue opportunity header"
      })
    });
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
  });

  it("keeps setup direct and applies AI only to the section being edited", async () => {
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [
      { label: "Account", apiName: "Account" },
      { label: "Opportunity", apiName: "Opportunity" }
    ];
    element.configuration = {
      defaultPagePadding: 32,
      defaultElementPadding: 8
    };
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises(30);

    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Setup");
    expect(
      element.shadowRoot.querySelectorAll(".wizard-step-dot")
    ).toHaveLength(4);
    expect(
      element.shadowRoot.querySelector('[data-role="prompt-input"]')
    ).toBeNull();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity quotation";
    templateName.dispatchEvent(new CustomEvent("input"));

    const objectSelect = element.shadowRoot.querySelector(
      '[data-field="objectApiName"]'
    );
    objectSelect.value = "Opportunity";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Header");
    expect(element.shadowRoot.querySelector(".prompt-status").textContent).toBe(
      "Salesforce AI"
    );

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Data in a single text box that adjusts to the text, with a blue background and a black border. Leave space between the text and the border.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(generateWizardProposal).toHaveBeenCalled();
    expect(generateWizardProposal.mock.calls[0][0].step).toBe("header");
    expect(previews.at(-1).objectApiName).toBe("Opportunity");
    expect(previews.at(-1).headerBackground).toBe("transparent");
    expect(previews.at(-1).headerContentBackground).toBe("#0176d3");
    expect(previews.at(-1).headerContentPadding).toBe(10);
    expect(previews.at(-1).headerContentBorderStyle).toBe("solid");
    expect(previews.at(-1).headerContentBorderWidth).toBe(1);
    expect(previews.at(-1).headerContentBorderColor).toBe("#181818");
    expect(previews.at(-1).headerContentSizeMode).toBe("content");
    expect(previews.at(-1).headerFields[0].apiName).toBe("Name");
    expect(
      element.shadowRoot.querySelector(".prompt-notice").textContent
    ).not.toContain("header background");
  });

  it("replaces only the AI prompt with guidance after Models API denies access", async () => {
    generateWizardProposal.mockRejectedValue({
      body: {
        message:
          "AI_ERROR:AI_UNAVAILABLE: Enable Agentforce and Models API access."
      }
    });
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    const unavailableEvents = [];
    element.addEventListener("aiunavailable", (event) => {
      unavailableEvents.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    const objectSelect = element.shadowRoot.querySelector(
      '[data-field="objectApiName"]'
    );
    objectSelect.value = "Opportunity";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Create a blue header";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises(30);

    expect(generateWizardProposal).toHaveBeenCalled();
    expect(element.shadowRoot.querySelector(".prompt-card")).toBeNull();
    expect(
      element.shadowRoot.querySelector(".ai-unavailable-card").textContent
    ).toContain("Enable Agentforce and Models API access.");
    expect(
      element.shadowRoot.querySelector(".wizard-step-section")
    ).not.toBeNull();
    expect(unavailableEvents).toHaveLength(1);
  });

  it("offers the AI extension only when the org supports Models API", async () => {
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.aiUnavailable = true;
    element.aiAvailabilityReason = "EXTENSION_MISSING";
    element.aiUnavailableMessage = "Install PDF Builder AI.";
    element.aiInstallationUrl =
      "/packaging/installPackage.apexp?p0=04tQy000000ZbkfIAC";
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    const objectSelect = element.shadowRoot.querySelector(
      '[data-field="objectApiName"]'
    );
    objectSelect.value = "Opportunity";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    const action = element.shadowRoot.querySelector(".ai-unavailable-action");
    expect(
      element.shadowRoot.querySelector(".ai-unavailable-card h3").textContent
    ).toBe("PDF Builder AI is ready to install");
    expect(action.textContent.trim()).toBe("Install PDF Builder AI");
    expect(action.getAttribute("href")).toContain("04tQy000000ZbkfIAC");
  });

  it("shows setup guidance instead of installation for an incompatible org", async () => {
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.aiUnavailable = true;
    element.aiAvailabilityReason = "MODELS_API_UNAVAILABLE";
    element.aiUnavailableMessage = "Models API is not provisioned.";
    element.aiDocumentationUrl =
      "https://developer.salesforce.com/docs/ai/agentforce/guide/org-setup.html";
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    const objectSelect = element.shadowRoot.querySelector(
      '[data-field="objectApiName"]'
    );
    objectSelect.value = "Opportunity";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    const action = element.shadowRoot.querySelector(".ai-unavailable-action");
    expect(
      element.shadowRoot.querySelector(".ai-unavailable-card h3").textContent
    ).toBe("Models API is not available");
    expect(action.textContent).toContain("enable Einstein and Models API");
    expect(action.textContent).not.toContain("Install PDF Builder AI");
  });

  it("only includes Header and Footer steps selected during Setup", async () => {
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    document.body.appendChild(element);
    await flushPromises();

    const headerToggle = element.shadowRoot.querySelector(
      '[data-field="showHeader"]'
    );
    headerToggle.checked = false;
    headerToggle.dispatchEvent(new CustomEvent("change"));
    const footerToggle = element.shadowRoot.querySelector(
      '[data-field="showFooter"]'
    );
    footerToggle.checked = false;
    footerToggle.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelectorAll(".wizard-step-dot")
    ).toHaveLength(2);
    expect(
      element.shadowRoot.querySelector(".wizard-step-count").textContent
    ).toBe("Step 1 of 2");

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity summary";
    templateName.dispatchEvent(new CustomEvent("input"));
    const objectSelect = element.shadowRoot.querySelector(
      '[data-field="objectApiName"]'
    );
    objectSelect.value = "Opportunity";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Body");
    expect(
      element.shadowRoot.querySelector(".wizard-step-count").textContent
    ).toBe("Step 2 of 2");
    expect(
      element.shadowRoot.querySelector(".wizard-button.primary").textContent
    ).toContain("Create template");

    element.shadowRoot.querySelector(".wizard-button.secondary").click();
    await flushPromises();
    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Setup");

    const restoredHeaderToggle = element.shadowRoot.querySelector(
      '[data-field="showHeader"]'
    );
    restoredHeaderToggle.checked = true;
    restoredHeaderToggle.dispatchEvent(new CustomEvent("change"));
    const restoredFooterToggle = element.shadowRoot.querySelector(
      '[data-field="showFooter"]'
    );
    restoredFooterToggle.checked = true;
    restoredFooterToggle.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelectorAll(".wizard-step-dot")
    ).toHaveLength(4);
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();
    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Header");
  });

  it("shows validation at the top and resets scroll after step navigation", async () => {
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    document.body.appendChild(element);
    await flushPromises();

    const content = element.shadowRoot.querySelector(".wizard-content");
    content.scrollTop = 600;
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    const error = element.shadowRoot.querySelector(
      '[data-role="wizard-error"]'
    );
    expect(error.textContent).toContain("Enter a template name.");
    expect(content.scrollTop).toBe(0);
    expect(element.shadowRoot.activeElement).toBe(error);

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Account summary";
    templateName.dispatchEvent(new CustomEvent("input"));
    const objectSelect = element.shadowRoot.querySelector(
      '[data-field="objectApiName"]'
    );
    objectSelect.value = "Account";
    objectSelect.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    content.scrollTop = 600;
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Header");
    expect(content.scrollTop).toBe(0);

    content.scrollTop = 600;
    element.shadowRoot.querySelector(".wizard-button.secondary").click();
    await flushPromises();

    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Setup");
    expect(content.scrollTop).toBe(0);
  });

  it("keeps the AI loading state until the builder confirms the preview render", async () => {
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    element.initialObjectApiName = "Opportunity";
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity summary";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();
    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Header");

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Use a blue header content box.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(element.shadowRoot.querySelector(".prompt-button").textContent).toBe(
      "Applying…"
    );
    expect(element.shadowRoot.querySelector(".wizard-loading")).not.toBeNull();
    const navigationButtons = element.shadowRoot.querySelectorAll(
      ".wizard-footer .wizard-button"
    );
    expect(
      Array.from(navigationButtons).every((button) => button.disabled)
    ).toBe(true);

    element.notifyPreviewRendered();
    await flushPromises();

    expect(element.shadowRoot.querySelector(".prompt-button").textContent).toBe(
      "Apply to this section"
    );
    expect(element.shadowRoot.querySelector(".wizard-loading")).toBeNull();
    expect(
      element.shadowRoot.querySelector(".wizard-footer .wizard-button.primary")
        .disabled
    ).toBe(false);
  });

  it("suggests a direct Related List and emits cancel without mutating parent state", async () => {
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    const cancelHandler = jest.fn();
    element.addEventListener("wizardcancel", cancelHandler);
    document.body.appendChild(element);
    await flushPromises();

    expect(
      element.shadowRoot.querySelectorAll(".wizard-step-dot")
    ).toHaveLength(4);
    element.shadowRoot
      .querySelector(".wizard-close")
      .dispatchEvent(new MouseEvent("click"));

    expect(cancelHandler).toHaveBeenCalledTimes(1);
  });

  it("does not retry a valid safety refusal with an empty patch", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {},
        summary: "",
        unapplied: ["The instruction is outside the document-design scope."]
      })
    });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    element.initialObjectApiName = "Opportunity";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Test";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Keep the existing fields in a blue content box with a black border and padding.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(generateWizardProposal).toHaveBeenCalledTimes(1);
    expect(previews.at(-1).headerContentBackground).not.toBe("#0000FF");
    expect(
      element.shadowRoot.querySelector(".prompt-notice").textContent
    ).toContain("outside the document-design scope");
  });

  it("merges split header content when the prompt requests one box", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          headerTextColor: "#ffffff",
          headerBlocks: [
            {
              type: "text",
              content: "<strong>{{organization:Name}}</strong>",
              widthPercent: 49,
              styles: { background: "#032d60", padding: 16 }
            },
            {
              type: "text",
              content: "<strong>SERVICE QUOTATION</strong>",
              widthPercent: 49,
              xPercent: 51,
              styles: { background: "#032d60", padding: 16 }
            }
          ]
        }
      })
    });
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();
    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Create a full-width dark navy header. Add the Organization Name on the left and SERVICE QUOTATION on the right. Keep all content inside one box.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises(30);

    expect(generateWizardProposal).toHaveBeenCalledTimes(1);
    expect(previews.at(-1).headerTextColor).toBe("#ffffff");
    expect(previews.at(-1).headerBackground).toBe("#032d60");
    expect(previews.at(-1).headerContentBackground).toBe("#032d60");
    expect(previews.at(-1).headerContentPadding).toBe(16);
    expect(previews.at(-1).headerContentSizeMode).toBe("fullWidth");
    expect(previews.at(-1).includeOrganizationName).toBe(true);
    expect(previews.at(-1).headerBlocks).toHaveLength(1);
    expect(previews.at(-1).headerBlocks[0].widthPercent).toBe(100);
    expect(previews.at(-1).headerBlocks[0].content).toContain(
      "{!$Organization.Name}"
    );
    expect(previews.at(-1).headerBlocks[0].content).toContain(
      "SERVICE QUOTATION"
    );

    const contentBackground = element.shadowRoot.querySelector(
      '[data-field="headerContentBackground"]'
    );
    contentBackground.value = "#112233";
    contentBackground.dispatchEvent(new CustomEvent("input"));
    const contentPadding = element.shadowRoot.querySelector(
      '[data-field="headerContentPadding"]'
    );
    contentPadding.value = "20";
    contentPadding.dispatchEvent(new CustomEvent("input"));
    await flushPromises();

    expect(previews.at(-1).headerBlocks[0].styles.background).toBe("#112233");
    expect(previews.at(-1).headerBlocks[0].styles.padding).toBe(20);
  });

  it("keeps every Footer control connected to AI footer blocks", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          footerBlocks: [
            {
              type: "divider",
              widthPercent: 100,
              styles: { lineColor: "#0176d3", lineThickness: 1 }
            },
            {
              type: "text",
              content: "Thank you for your trust | {{organization:Name}}",
              widthPercent: 49,
              styles: { color: "#181818", textAlign: "left" }
            },
            {
              type: "text",
              content: "Questions about this quotation? Contact our team.",
              widthPercent: 49,
              xPercent: 51,
              styles: { color: "#181818", textAlign: "right" }
            }
          ]
        }
      })
    });
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();
    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    for (let index = 0; index < 3; index += 1) {
      element.shadowRoot
        .querySelector(".wizard-button.primary")
        .dispatchEvent(new MouseEvent("click"));
      // Each step depends on the previous step's render and metadata state.
      // eslint-disable-next-line no-await-in-loop
      await flushPromises();
    }
    expect(element.shadowRoot.querySelector("h2").textContent).toBe(
      "Footer & review"
    );

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Create a rich two-part footer with a separator.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises(30);

    expect(previews.at(-1).footerText).toBe("Thank you for your trust");
    expect(previews.at(-1).footerSecondaryText).toBe(
      "Questions about this quotation? Contact our team."
    );
    expect(previews.at(-1).includeFooterOrganizationName).toBe(true);
    expect(previews.at(-1).footerShowDivider).toBe(true);

    const updateInput = (field, value, eventName = "input") => {
      const input = element.shadowRoot.querySelector(`[data-field="${field}"]`);
      input.value = value;
      input.dispatchEvent(new CustomEvent(eventName));
    };
    updateInput("footerText", "Updated footer");
    updateInput("footerSecondaryText", "Updated support text");
    updateInput("footerAlignment", "center", "change");
    updateInput("footerBackground", "#abcdef");
    updateInput("footerTextColor", "#112233");
    updateInput("footerDividerColor", "#445566");
    const organizationToggle = element.shadowRoot.querySelector(
      '[data-field="includeFooterOrganizationName"]'
    );
    organizationToggle.checked = false;
    organizationToggle.dispatchEvent(new CustomEvent("change"));
    const dividerToggle = element.shadowRoot.querySelector(
      '[data-field="footerShowDivider"]'
    );
    dividerToggle.checked = false;
    dividerToggle.dispatchEvent(new CustomEvent("change"));
    await flushPromises();

    const finalRecipe = previews.at(-1);
    const textBlocks = finalRecipe.footerBlocks.filter(
      (block) => block.type === "text"
    );
    expect(textBlocks[0].content).toBe("Updated footer");
    expect(textBlocks[0].content).not.toContain("$Organization");
    expect(textBlocks[1].content).toBe("Updated support text");
    expect(textBlocks.every((block) => block.styles.color === "#112233")).toBe(
      true
    );
    expect(
      textBlocks.every((block) => block.styles.textAlign === "center")
    ).toBe(true);
    expect(
      textBlocks.every((block) => block.styles.background === "#abcdef")
    ).toBe(true);
    expect(
      finalRecipe.footerBlocks.some((block) => block.type === "divider")
    ).toBe(false);
  });

  it("automatically retries malformed JSON returned by Salesforce AI", async () => {
    generateWizardProposal
      .mockResolvedValueOnce({
        modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
        generatedJson:
          '{"patch":{"bodyBlocks":[{"type":"text","content":"Broken "quote""}]}}'
      })
      .mockResolvedValueOnce({
        modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
        generatedJson: JSON.stringify({
          patch: {
            bodyBlocks: [
              {
                type: "text",
                content: "<strong>Opportunity Overview</strong>",
                widthPercent: 100,
                styles: { fontSize: 26, color: "#032D60" }
              }
            ]
          }
        })
      });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "AI quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Create a polished opportunity body";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(generateWizardProposal).toHaveBeenCalledTimes(2);
    expect(generateWizardProposal.mock.calls[1][0].userPrompt).toContain(
      "strictly valid JSON"
    );
    expect(previews.at(-1).bodyBlocks).toHaveLength(1);
    expect(previews.at(-1).bodyBlocks[0].content).toContain(
      "Opportunity Overview"
    );
    element.notifyPreviewRendered();
    await flushPromises();
    expect(element.shadowRoot.querySelector(".wizard-error")).toBeNull();
  });

  it("allows two JSON correction retries before reporting an invalid proposal", async () => {
    generateWizardProposal
      .mockResolvedValueOnce({
        modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
        generatedJson: '{"patch":{"bodyBlocks":['
      })
      .mockResolvedValueOnce({
        modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
        generatedJson: '{"patch":{"bodyBlocks":[{"type":"text"}'
      })
      .mockResolvedValueOnce({
        modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
        generatedJson: JSON.stringify({
          patch: {
            bodyBlocks: [
              {
                type: "text",
                content: "<strong>Recovered proposal</strong>",
                widthPercent: 100
              }
            ]
          }
        })
      });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "AI quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Create a compact proposal";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises(30);

    expect(generateWizardProposal).toHaveBeenCalledTimes(3);
    expect(previews.at(-1).bodyBlocks[0].content).toContain(
      "Recovered proposal"
    );
  });

  it("shows actionable guidance after every JSON correction attempt fails", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: '{"patch":{"bodyBlocks":['
    });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "AI quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Create a compact proposal";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises(30);

    expect(generateWizardProposal).toHaveBeenCalledTimes(3);
    expect(
      element.shadowRoot.querySelector(".wizard-error").textContent
    ).toContain("Please try again");
    expect(
      element.shadowRoot.querySelector(".wizard-error").textContent
    ).toContain("smaller sections");
  });

  it("configures body fields and a Related List from one body prompt", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          bodyLayout: "two",
          bodyFields: ["Name"],
          relatedListRelationshipName: "Contacts",
          relatedListColumns: ["Name", "Email"],
          relatedListHeaderRowColor: "#0176d3"
        },
        summary: "Two-column account body with contacts"
      })
    });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Account summary";
    templateName.dispatchEvent(new CustomEvent("input"));

    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(element.shadowRoot.querySelector("h2").textContent).toBe("Body");
    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Dos columnas y contactos con nombre y correo";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(element.shadowRoot.querySelector(".prompt-button").textContent).toBe(
      "Applying…"
    );
    expect(element.shadowRoot.querySelector(".wizard-loading")).not.toBeNull();
    expect(
      Array.from(
        element.shadowRoot.querySelectorAll(".wizard-footer .wizard-button")
      ).every((button) => button.disabled)
    ).toBe(true);

    expect(getRelatedListFields).toHaveBeenCalledWith({
      childObjectApiName: "Contact",
      searchTerm: ""
    });
    expect(generateWizardProposal).toHaveBeenCalledTimes(1);
    expect(previews.at(-1).bodyLayout).toBe("two");
    expect(previews.at(-1).bodyFields[0].apiName).toBe("Name");
    expect(previews.at(-1).relatedListRelationshipName).toBe("Contacts");
    expect(previews.at(-1).relatedListColumns).toEqual(["Name", "Email"]);
    expect(previews.at(-1).relatedListColumnDefinitions).toEqual([
      { apiName: "Name", label: "Name" },
      { apiName: "Email", label: "Email" }
    ]);
    element.notifyPreviewRendered();
    await flushPromises();
    expect(element.shadowRoot.querySelector(".wizard-loading")).toBeNull();
  });

  it("keeps body title and Related List controls connected after AI generation", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          includeRelatedList: true,
          relatedListRelationshipName: "Contacts",
          relatedListColumns: ["Name", "Email"],
          relatedListHeaderRowColor: "#032d60",
          relatedListHeaderTextColor: "#ffffff",
          bodyBlocks: [
            {
              type: "text",
              content: "<strong>Name:</strong> {{field:Name}}",
              widthPercent: 100
            },
            {
              type: "relatedList",
              relationshipName: "Contacts",
              columns: ["Name", "Email"],
              widthPercent: 100
            }
          ]
        }
      })
    });
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Account proposal";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Create an account body with the Contacts related list";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.notifyPreviewRendered();
    await flushPromises();

    const generatedRelatedList = previews
      .at(-1)
      .bodyBlocks.find((block) => block.type === "relatedList");
    expect(generatedRelatedList.relatedListHeaderRowColor).toBe("#032d60");
    expect(generatedRelatedList.relatedListTextColor).toBe("#ffffff");

    const titleToggle = element.shadowRoot.querySelector(
      '[data-field="includeBodyTitle"]'
    );
    titleToggle.checked = true;
    titleToggle.dispatchEvent(new CustomEvent("change"));
    await flushPromises();
    const titleInput = element.shadowRoot.querySelector(
      '[data-field="documentTitle"]'
    );
    titleInput.value = "Account Overview";
    titleInput.dispatchEvent(new CustomEvent("input"));
    const headerColor = element.shadowRoot.querySelector(
      '[data-field="relatedListHeaderRowColor"]'
    );
    headerColor.value = "#112233";
    headerColor.dispatchEvent(new CustomEvent("input"));
    await flushPromises();

    expect(
      previews
        .at(-1)
        .bodyBlocks.some((block) =>
          String(block.content || "").includes("Account Overview")
        )
    ).toBe(true);
    expect(
      previews.at(-1).bodyBlocks.find((block) => block.type === "relatedList")
        .relatedListHeaderRowColor
    ).toBe("#112233");
  });

  it("restores every explicitly requested record field omitted by AI", async () => {
    getFields.mockResolvedValue([
      { label: "Opportunity Name", apiName: "Name" },
      { label: "Account Name", apiName: "Account.Name" },
      { label: "Stage", apiName: "StageName" },
      { label: "Close Date", apiName: "CloseDate" },
      { label: "Amount", apiName: "Amount" },
      { label: "Opportunity Owner", apiName: "Owner.Name" },
      { label: "Description", apiName: "Description" },
      {
        label: "Opportunity History > Close Date",
        apiName: "LastCloseDateChangedHistory.CloseDate"
      },
      {
        label: "Opportunity History > Previous Close Date",
        apiName: "LastCloseDateChangedHistory.PrevCloseDate"
      },
      { label: "Quantity", apiName: "TotalOpportunityQuantity" }
    ]);
    getRelatedLists.mockResolvedValue([
      {
        label: "Opportunity Products",
        relationshipName: "OpportunityLineItems",
        childObjectApiName: "OpportunityLineItem"
      }
    ]);
    getRelatedListFields.mockResolvedValue([
      { label: "Quantity", apiName: "Quantity" },
      { label: "Sales Price", apiName: "UnitPrice" },
      { label: "Total Price", apiName: "TotalPrice" }
    ]);
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          bodyBlocks: [
            {
              type: "text",
              content:
                "<strong>Opportunity Overview</strong><div>{{field:Name}}</div><div>{{field:Amount}}</div>",
              widthPercent: 100
            },
            {
              type: "text",
              content: "<strong>Opportunity Overview</strong>",
              widthPercent: 100
            }
          ]
        }
      })
    });
    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    element.initialObjectApiName = "Opportunity";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();
    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Quotation";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Add the centered title “Opportunity Overview”. Create two boxes on the same row. Left box: Opportunity Name, Account Name, Stage, Close Date. Right box: Amount, Opportunity Owner, Description. Add a horizontal divider and the Opportunity Products Related List. Use a dark navy header row (#032D60). Add a total amount banner.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const bodyBlocks = previews.at(-1).bodyBlocks;
    const content = bodyBlocks
      .map((block) => String(block.content || ""))
      .join(" ");
    [
      "{!Opportunity.Name}",
      "{!Opportunity.Account.Name}",
      "{!Opportunity.StageName}",
      "{!Opportunity.CloseDate}",
      "{!Opportunity.Amount}",
      "{!Opportunity.Owner.Name}",
      "{!Opportunity.Description}"
    ].forEach((token) => expect(content).toContain(token));
    expect(content).not.toContain("LastCloseDateChangedHistory");
    expect(content).not.toContain("TotalOpportunityQuantity");
    const cards = bodyBlocks.filter(
      (block) => block.wizardRole === "recordFieldCard"
    );
    expect(previews.at(-1).bodyLayout).toBe("one");
    expect(cards).toHaveLength(2);
    expect(cards[0].widthPercent).toBe(49);
    expect(cards[1].widthPercent).toBe(49);
    expect(cards[0].y).toBe(cards[1].y);
    expect(bodyBlocks[0].content).toContain("Opportunity Overview");
    expect(
      bodyBlocks.filter((block) =>
        String(block.content || "").includes("Opportunity Overview")
      )
    ).toHaveLength(1);
    expect(content).not.toContain("{{field:");
    expect(bodyBlocks.some((block) => block.type === "relatedList")).toBe(true);
    expect(
      bodyBlocks.find((block) => block.type === "relatedList")
        .relatedListHeaderRowColor
    ).toBe("#032d60");
    expect(bodyBlocks.some((block) => block.type === "divider")).toBe(true);
    expect(content).toContain("TOTAL");
    expect(content).toContain("{!Opportunity.Amount}");
    expect(
      bodyBlocks.find((block) => block.wizardRole === "relatedListTotal").styles
        .background
    ).toBe("#032d60");

    const bodyBackground = element.shadowRoot.querySelector(
      '[data-field="bodyContentBackground"]'
    );
    bodyBackground.value = "#ddeeff";
    bodyBackground.dispatchEvent(new CustomEvent("input"));
    await flushPromises();
    expect(
      previews
        .at(-1)
        .bodyBlocks.filter((block) => block.wizardRole === "recordFieldCard")
        .every((block) => block.styles.background === "#ddeeff")
    ).toBe(true);
  });

  it("resolves Opportunity Products when AI enables a Related List without its relationship name", async () => {
    getFields.mockResolvedValue([
      { label: "Opportunity Name", apiName: "Name" },
      { label: "Amount", apiName: "Amount", dataType: "Currency" }
    ]);
    getRelatedLists.mockResolvedValue([
      {
        label: "Opportunity Products",
        relationshipName: "OpportunityLineItems",
        childObjectApiName: "OpportunityLineItem"
      }
    ]);
    getRelatedListFields.mockResolvedValue([
      { label: "Discount", apiName: "Discount" },
      { label: "Line Description", apiName: "Description" },
      { label: "Opportunity Product Name", apiName: "Name" },
      { label: "Quantity", apiName: "Quantity" },
      { label: "Sales Price", apiName: "UnitPrice" },
      { label: "Total Price", apiName: "TotalPrice" }
    ]);
    generateWizardProposal
      .mockResolvedValueOnce({
        modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
        generatedJson: JSON.stringify({
          patch: {
            includeRelatedList: true,
            bodyBlocks: [
              {
                type: "text",
                content: "<strong>Name:</strong> {{field:Name}}",
                widthPercent: 100
              }
            ]
          }
        })
      })
      .mockResolvedValueOnce({
        modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
        generatedJson: JSON.stringify({
          patch: {
            includeRelatedList: true,
            relatedListColumns: ["UnitPrice", "TotalPrice"]
          }
        })
      });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    element.initialObjectApiName = "Opportunity";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity proposal";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Add the Opportunity Products related list with Product Name, Line Description, Quantity, Sales Price, Discount, and Total Price. Add a horizontal line and the total amount below it.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(getRelatedListFields).toHaveBeenCalledWith({
      childObjectApiName: "OpportunityLineItem",
      searchTerm: ""
    });
    expect(previews.at(-1).includeRelatedList).toBe(true);
    expect(previews.at(-1).relatedListRelationshipName).toBe(
      "OpportunityLineItems"
    );
    expect(previews.at(-1).relatedListColumns).toEqual([
      "Name",
      "Description",
      "Quantity",
      "UnitPrice",
      "Discount",
      "TotalPrice"
    ]);
    expect(previews.at(-1).includeBodyDivider).toBe(true);
    expect(previews.at(-1).includeRelatedListTotal).toBe(true);
    expect(previews.at(-1).relatedListTotalFieldApiName).toBe("Amount");
    expect(
      previews.at(-1).bodyBlocks.some((block) => block.type === "relatedList")
    ).toBe(true);
  });

  it("adds editable editorial boxes when AI omits them from a complete body", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          bodyFields: ["Name"]
        },
        summary: "Opportunity body"
      })
    });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    element.initialObjectApiName = "Opportunity";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Opportunity proposal";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();
    element.shadowRoot.querySelector(".wizard-button.primary").click();
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Create a professional proposal body with the main opportunity fields.";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    await flushPromises();

    expect(previews.at(-1).bodyLayout).toBe("one");
    expect(previews.at(-1).bodyTextBoxes).toHaveLength(3);
    expect(previews.at(-1).bodyTextBoxes.map((box) => box.layout)).toEqual([
      "full",
      "half",
      "half"
    ]);
    expect(
      element.shadowRoot.querySelector(".prompt-notice").textContent
    ).toContain("editorial text boxes");
  });

  it("explains when the body already matches the AI request", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: { bodyLayout: "one" },
        summary: "Single-column body"
      })
    });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Account", apiName: "Account" }];
    element.initialObjectApiName = "Account";
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Account summary";
    templateName.dispatchEvent(new CustomEvent("input"));

    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value = "Pon el body en una columna";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(element.shadowRoot.querySelector(".prompt-notice").textContent).toBe(
      "This section already matches the request. No changes were needed: body layout."
    );
  });

  it("turns selected body fields into one styled box from a Spanish prompt", async () => {
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          groupBodyFields: true,
          bodyLayout: "one",
          bodyContentBackground: "#0176d3",
          bodyContentBorderStyle: "solid",
          bodyContentBorderWidth: 1,
          bodyContentBorderColor: "#181818"
        }
      })
    });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    element.initialObjectApiName = "Opportunity";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Test";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const firstField = element.shadowRoot.querySelector(
      '.selection-option input[data-value="Name"]'
    );
    firstField.checked = true;
    firstField.dispatchEvent(new CustomEvent("change"));

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Mete los textos en una sola caja, con fondo azul y borde negro";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(previews.at(-1).groupBodyFields).toBe(true);
    expect(previews.at(-1).bodyLayout).toBe("one");
    expect(previews.at(-1).bodyContentBackground).toBe("#0176d3");
    expect(previews.at(-1).bodyContentBorderStyle).toBe("solid");
    expect(previews.at(-1).bodyContentBorderWidth).toBe(1);
    expect(previews.at(-1).bodyContentBorderColor).toBe("#181818");
    expect(
      element.shadowRoot.querySelector(".prompt-notice").textContent
    ).toContain("body field box");
  });

  it("infers customer identification fields and creates an organization box", async () => {
    getFields.mockResolvedValue([
      { label: "Account > Account ID", apiName: "Account.Id" },
      { label: "Account > Account Name", apiName: "Account.Name" },
      { label: "Account > Account Number", apiName: "Account.AccountNumber" },
      { label: "Account > Phone", apiName: "Account.Phone" }
    ]);
    generateWizardProposal.mockResolvedValue({
      modelName: "sfdc_ai__DefaultOpenAIGPT4OmniMini",
      generatedJson: JSON.stringify({
        patch: {
          bodyFields: [
            "Account.Name",
            "Account.AccountNumber",
            "Account.Phone"
          ],
          groupBodyFields: true,
          includeOrganizationBodyBox: true,
          bodyLayout: "two",
          bodyContentBorderStyle: "solid",
          bodyContentBorderWidth: 1
        }
      })
    });

    const element = createElement("c-pdf-builder-wizard", {
      is: PDFBuilderWizard
    });
    element.objectOptions = [{ label: "Opportunity", apiName: "Opportunity" }];
    element.initialObjectApiName = "Opportunity";
    const previews = [];
    element.addEventListener("wizardpreview", (event) => {
      previews.push(event.detail);
    });
    document.body.appendChild(element);
    await flushPromises();

    const templateName = element.shadowRoot.querySelector(
      '[data-field="templateName"]'
    );
    templateName.value = "Test";
    templateName.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();
    element.shadowRoot
      .querySelector(".wizard-button.primary")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    const prompt = element.shadowRoot.querySelector(
      '[data-role="prompt-input"]'
    );
    prompt.value =
      "Pon datos de identificación de la empresa interesada en una caja de texto y en la otra la de mi empresa";
    prompt.dispatchEvent(new CustomEvent("input"));
    element.shadowRoot
      .querySelector(".prompt-button")
      .dispatchEvent(new MouseEvent("click"));
    await flushPromises();

    expect(previews.at(-1).bodyFields.map((field) => field.apiName)).toEqual([
      "Account.Name",
      "Account.AccountNumber",
      "Account.Phone"
    ]);
    expect(previews.at(-1).groupBodyFields).toBe(true);
    expect(previews.at(-1).includeOrganizationBodyBox).toBe(true);
    expect(previews.at(-1).bodyLayout).toBe("two");
    expect(previews.at(-1).bodyContentBorderStyle).toBe("solid");
    expect(previews.at(-1).bodyContentBorderWidth).toBe(1);
  });
});
