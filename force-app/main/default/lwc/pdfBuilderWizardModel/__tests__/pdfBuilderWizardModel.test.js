import {
  applyAIWizardProposal,
  applyGuidedWizardPrompt,
  buildWizardDocumentModel,
  createDefaultWizardRecipe,
  findExactPromptFieldMatches,
  findPromptMatches,
  rankRelatedLists
} from "c/pdfBuilderWizardModel";

const createRegion = (id, label, height) => ({
  id,
  label,
  styles: {
    background: "transparent",
    padding: 8,
    borderWidth: 0,
    borderStyle: "none",
    borderColor: "#c9c9c9",
    borderRadius: 0,
    ...(height ? { height } : {})
  },
  blocks: []
});

const createDocument = () => ({
  pagePadding: 32,
  pageBackground: "transparent",
  globalElementPadding: 8,
  showHeader: true,
  showBody: true,
  showFooter: true,
  repeatHeaderOnEachPage: true,
  repeatFooterOnEachPage: true,
  manualPageCount: 0,
  header: createRegion("header", "Header", 110),
  body: {
    layout: "one",
    sections: [createRegion("body-1", "Body")]
  },
  footer: createRegion("footer", "Footer", 80)
});

describe("c-pdf-builder-wizard-model", () => {
  it("builds through the builder factories and adds one configured Related List", () => {
    let blockSequence = 0;
    const recipe = {
      ...createDefaultWizardRecipe({
        defaultPagePadding: 20,
        defaultElementPadding: 6
      }),
      templateName: "Account overview",
      includeBodyTitle: true,
      documentTitle: "Account overview",
      objectApiName: "Account",
      bodyFields: [{ apiName: "Name", label: "Account Name" }],
      includeRelatedList: true,
      relatedListRelationshipName: "Contacts",
      relatedListChildObjectApiName: "Contact",
      relatedListLabel: "Contacts",
      relatedListColumns: ["Name", "Email"]
    };

    const result = buildWizardDocumentModel({
      recipe,
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type, field) => ({
        id: `block-${++blockSequence}`,
        type,
        content: "",
        fieldApiName: field?.apiName || null,
        styles: {}
      })
    });

    const bodyBlocks = result.body.sections[0].blocks;
    const relatedList = bodyBlocks.find(
      (block) => block.type === "relatedList"
    );

    expect(result.pagePadding).toBe(20);
    expect(result.pageBackground).toBe("transparent");
    expect(bodyBlocks.some((block) => block.type === "field")).toBe(true);
    expect(relatedList.relatedListRelationshipName).toBe("Contacts");
    expect(relatedList.relatedListColumns).toEqual(["Name", "Email"]);
    expect(relatedList.relatedListBuilderRows).toBe(1);
    expect(relatedList.styles.widthRatio).toBe(1);
    expect(bodyBlocks[0].content).toContain("Account overview");
  });

  it("adds a divider, total amount, and richer footer around a Related List", () => {
    let blockSequence = 0;
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        includeRelatedList: true,
        relatedListRelationshipName: "OpportunityLineItems",
        relatedListChildObjectApiName: "OpportunityLineItem",
        relatedListLabel: "Opportunity Products",
        relatedListColumns: ["Product2.Name", "TotalPrice"],
        includeBodyDivider: true,
        bodyDividerColor: "#0176d3",
        includeRelatedListTotal: true,
        relatedListTotalLabel: "Total amount",
        relatedListTotalFieldApiName: "Amount",
        footerText: "Thank you for your trust",
        footerSecondaryText: "Questions? Contact our team.",
        footerShowDivider: true,
        footerDividerColor: "#0176d3"
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `block-${++blockSequence}`,
        type,
        content: "",
        styles: {}
      })
    });

    const bodyBlocks = result.body.sections[0].blocks;
    const divider = bodyBlocks.find((block) => block.type === "divider");
    const total = bodyBlocks.find((block) =>
      block.content?.includes("{!Opportunity.Amount}")
    );
    expect(divider.styles.lineColor).toBe("#0176d3");
    expect(total.content).toContain("<strong>TOTAL AMOUNT</strong>");
    expect(total.content).toContain("white-space:nowrap");
    expect(total.content).toContain("{!Opportunity.Amount}");
    expect(total.styles.background).toBe("#0176d3");
    expect(total.styles.color).toBe("#ffffff");
    expect(total.styles.textAlign).toBe("center");
    expect(total.styles.verticalAlign).toBe("middle");
    expect(result.footer.blocks[0].type).toBe("divider");
    expect(result.footer.blocks[1].content).toContain(
      "Thank you for your trust"
    );
    expect(result.footer.blocks[1].content).toContain(
      "Questions? Contact our team."
    );
  });

  it("keeps the internal template name out of the PDF body by default", () => {
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        templateName: "Internal template name",
        objectApiName: "Opportunity"
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `block-${type}`,
        type,
        content: "",
        styles: {}
      })
    });

    expect(result.body.sections[0].blocks).toHaveLength(0);
  });

  it("styles a header content box and prints readable relationship labels", () => {
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        includeOrganizationName: false,
        headerFields: [
          {
            apiName: "Account.Name",
            label: "Account > Account Name"
          }
        ],
        headerContentBackground: "#0176d3",
        headerContentPadding: 12,
        headerContentBorderStyle: "solid",
        headerContentBorderWidth: 1,
        headerContentBorderColor: "#181818",
        headerContentBorderRadius: 4,
        headerContentSizeMode: "content"
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `block-${type}`,
        type,
        content: "",
        styles: {}
      })
    });

    const headerBlock = result.header.blocks[0];
    expect(headerBlock.content).toContain("<div><strong>Name:</strong>");
    expect(headerBlock.content).toContain(
      "</strong>&nbsp;{!Opportunity.Account.Name}"
    );
    expect(headerBlock.content).not.toContain("Account &gt;");
    expect(headerBlock.styles.background).toBe("#0176d3");
    expect(headerBlock.styles.borderStyle).toBe("solid");
    expect(headerBlock.styles.borderColor).toBe("#181818");
    expect(headerBlock.styles.borderRadius).toBe(4);
    expect(headerBlock.styles.width).toBeNull();
    expect(headerBlock.styles.widthFitContent).toBe(true);
    expect(headerBlock.styles.height).toBeNull();
    expect(headerBlock.styles.heightManuallyResized).toBe(false);
  });

  it("groups selected body fields into one styled text box", () => {
    let blockSequence = 0;
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        bodyFields: [
          { apiName: "Name", label: "Opportunity Name" },
          { apiName: "Amount", label: "Amount" }
        ],
        groupBodyFields: true,
        bodyContentBackground: "#0176d3",
        bodyContentPadding: 12,
        bodyContentBorderStyle: "solid",
        bodyContentBorderWidth: 1,
        bodyContentBorderColor: "#181818"
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `block-${++blockSequence}`,
        type,
        content: "",
        styles: {}
      })
    });

    const bodyBlocks = result.body.sections[0].blocks;
    expect(bodyBlocks).toHaveLength(1);
    expect(bodyBlocks[0].type).toBe("text");
    expect(bodyBlocks[0].content).toContain("{!Opportunity.Name}");
    expect(bodyBlocks[0].content).toContain("{!Opportunity.Amount}");
    expect(bodyBlocks[0].styles.background).toBe("#0176d3");
    expect(bodyBlocks[0].styles.padding).toBe(12);
    expect(bodyBlocks[0].styles.borderStyle).toBe("solid");
    expect(bodyBlocks[0].styles.borderColor).toBe("#181818");
  });

  it("builds customer and organization information in two separate boxes", () => {
    let blockSequence = 0;
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        bodyLayout: "one",
        bodyFields: [
          { apiName: "Account.Name", label: "Account Name" },
          { apiName: "Account.Phone", label: "Account Phone" }
        ],
        groupBodyFields: true,
        includeOrganizationBodyBox: true,
        bodyContentBorderStyle: "solid",
        bodyContentBorderWidth: 1
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `block-${++blockSequence}`,
        type,
        content: "",
        styles: {}
      })
    });

    expect(result.body.sections).toHaveLength(1);
    expect(result.body.sections[0].blocks).toHaveLength(2);
    expect(result.body.sections[0].blocks[0].content).toContain(
      "{!Opportunity.Account.Name}"
    );
    expect(result.body.sections[0].blocks[1].content).toContain(
      "{!$Organization.Name}"
    );
    expect(result.body.sections[0].blocks[0].styles.y).toBe(
      result.body.sections[0].blocks[1].styles.y
    );
    expect(result.body.sections[0].blocks[0].styles.width).toBe(
      result.body.sections[0].blocks[1].styles.width
    );
    expect(result.body.sections[0].blocks[1].styles.x).toBeGreaterThan(
      result.body.sections[0].blocks[0].styles.x
    );
  });

  it("understands common Spanish object, field, and Related List terms", () => {
    const objects = [
      { label: "Opportunity", apiName: "Opportunity" },
      { label: "Account", apiName: "Account" }
    ];
    const fields = [
      { label: "Name", apiName: "Name" },
      { label: "Email", apiName: "Email" }
    ];
    const relatedLists = [
      {
        label: "Contacts",
        relationshipName: "Contacts",
        childObjectApiName: "Contact"
      }
    ];

    const contextResult = applyGuidedWizardPrompt({
      recipe: createDefaultWizardRecipe(),
      step: "context",
      prompt: "Cotización predeterminada para oportunidades",
      objects
    });
    const bodyResult = applyGuidedWizardPrompt({
      recipe: {
        ...contextResult.recipe,
        objectApiName: "Account"
      },
      step: "body",
      prompt: "Añade nombre, correo y una lista de contactos",
      fields,
      relatedLists
    });

    expect(contextResult.recipe.objectApiName).toBe("Opportunity");
    expect(contextResult.recipe.isDefault).toBe(true);
    expect(bodyResult.recipe.bodyFields.map((field) => field.apiName)).toEqual([
      "Name",
      "Email"
    ]);
    expect(bodyResult.recipe.relatedListRelationshipName).toBe("Contacts");
  });

  it("ranks useful business relationships ahead of history lists", () => {
    const ranked = rankRelatedLists([
      {
        label: "Account History",
        relationshipName: "Histories",
        childObjectApiName: "AccountHistory"
      },
      {
        label: "Contacts",
        relationshipName: "Contacts",
        childObjectApiName: "Contact"
      }
    ]);

    expect(ranked[0].relationshipName).toBe("Contacts");
    expect(
      findPromptMatches(ranked, "Quiero los contactos relacionados")
    ).toHaveLength(1);
  });

  it("grounds explicitly requested field labels without matching longer labels", () => {
    const matches = findExactPromptFieldMatches(
      [
        { label: "Product", apiName: "Product2Id" },
        { label: "Product Code", apiName: "ProductCode" },
        { label: "Sales Price", apiName: "UnitPrice" },
        { label: "Total Price", apiName: "TotalPrice" }
      ],
      "Product, Sales Price and Total Price"
    );

    expect(matches.map((field) => field.apiName)).toEqual([
      "Product2Id",
      "UnitPrice",
      "TotalPrice"
    ]);
  });

  it("grounds Opportunity Product columns in the order requested", () => {
    const matches = findExactPromptFieldMatches(
      [
        { label: "Discount", apiName: "Discount" },
        { label: "Line Description", apiName: "Description" },
        { label: "Opportunity Product Name", apiName: "Name" },
        { label: "Quantity", apiName: "Quantity" },
        { label: "Sales Price", apiName: "UnitPrice" },
        { label: "Total Price", apiName: "TotalPrice" }
      ],
      "Add Product Name, Line Description, Quantity, Sales Price, Discount, and Total Price."
    );

    expect(matches.map((field) => field.apiName)).toEqual([
      "Name",
      "Description",
      "Quantity",
      "UnitPrice",
      "Discount",
      "TotalPrice"
    ]);
  });

  it("accepts only AI values backed by the supplied Salesforce metadata", () => {
    const recipe = createDefaultWizardRecipe();
    const result = applyAIWizardProposal({
      recipe,
      step: "body",
      generatedJson: JSON.stringify({
        patch: {
          bodyLayout: "two",
          bodyFields: ["Account Name", "InventedField__c"],
          relatedListRelationshipName: "Contacts",
          relatedListColumns: ["Contact Name", "InventedColumn__c"],
          relatedListHeaderRowColor: "#0176d3",
          footerText: "This key is not allowed on the body step"
        },
        summary: "Two-column contact overview"
      }),
      fields: [{ label: "Account Name", apiName: "Name" }],
      relatedLists: [
        {
          label: "Contacts",
          relationshipName: "Contacts",
          childObjectApiName: "Contact"
        }
      ],
      relatedListFields: [{ label: "Contact Name", apiName: "Name" }]
    });

    expect(result.recipe.bodyLayout).toBe("two");
    expect(result.recipe.bodyFields).toEqual([
      { label: "Account Name", apiName: "Name" }
    ]);
    expect(result.recipe.relatedListRelationshipName).toBe("Contacts");
    expect(result.recipe.relatedListChildObjectApiName).toBe("Contact");
    expect(result.recipe.relatedListColumns).toEqual(["Name"]);
    expect(result.recipe.relatedListHeaderRowColor).toBe("#0176d3");
    expect(result.unmatchedFields).toEqual([
      "InventedField__c",
      "InventedColumn__c"
    ]);
    expect(result.recipe.footerText).toBe("");
    expect(result.summary).toBe("Two-column contact overview");
  });

  it("accepts a Related List label when the AI does not return its relationship API name", () => {
    const result = applyAIWizardProposal({
      recipe: createDefaultWizardRecipe(),
      step: "body",
      generatedJson: JSON.stringify({
        patch: {
          includeRelatedList: true,
          relatedListRelationshipName: "Opportunity Products"
        }
      }),
      relatedLists: [
        {
          label: "Opportunity Products",
          relationshipName: "OpportunityLineItems",
          childObjectApiName: "OpportunityLineItem"
        }
      ]
    });

    expect(result.recipe.includeRelatedList).toBe(true);
    expect(result.recipe.relatedListRelationshipName).toBe(
      "OpportunityLineItems"
    );
    expect(result.recipe.relatedListChildObjectApiName).toBe(
      "OpportunityLineItem"
    );
    expect(result.recipe.relatedListLabel).toBe("Opportunity Products");
  });

  it("reports accepted values even when the section already matches them", () => {
    const recipe = createDefaultWizardRecipe();
    const result = applyAIWizardProposal({
      recipe,
      step: "body",
      generatedJson: JSON.stringify({
        patch: { bodyLayout: "one" },
        summary: "Single-column body"
      })
    });

    expect(result.acceptedKeys).toEqual(["bodyLayout"]);
    expect(result.changes).toEqual([]);
    expect(result.recipe.bodyLayout).toBe("one");
  });

  it("accepts body field box appearance from Salesforce AI", () => {
    const result = applyAIWizardProposal({
      recipe: createDefaultWizardRecipe(),
      step: "body",
      generatedJson: JSON.stringify({
        patch: {
          groupBodyFields: true,
          bodyContentBackground: "#0176d3",
          bodyContentPadding: 10,
          bodyContentBorderStyle: "solid",
          bodyContentBorderWidth: 1,
          bodyContentBorderColor: "#181818",
          bodyContentBorderRadius: 4
        }
      })
    });

    expect(result.recipe.groupBodyFields).toBe(true);
    expect(result.recipe.bodyContentBackground).toBe("#0176d3");
    expect(result.recipe.bodyContentBorderStyle).toBe("solid");
    expect(result.recipe.bodyContentBorderColor).toBe("#181818");
  });

  it("accepts safe AI-written body text boxes", () => {
    const result = applyAIWizardProposal({
      recipe: createDefaultWizardRecipe(),
      step: "body",
      generatedJson: JSON.stringify({
        patch: {
          bodyTextBoxes: [
            {
              title: "Thank you <team>",
              content: "A concise introduction for the proposal.",
              layout: "full"
            },
            {
              title: "Scope",
              content: "Discovery, delivery and support.",
              layout: "half"
            },
            {
              title: "Why us",
              content: "A collaborative and practical approach.",
              layout: "half"
            },
            { title: "Ignored", content: "Only three boxes are supported." }
          ]
        }
      })
    });

    expect(result.recipe.bodyTextBoxes).toHaveLength(3);
    expect(result.recipe.bodyTextBoxes[0]).toEqual({
      title: "Thank you <team>",
      content: "A concise introduction for the proposal.",
      layout: "full"
    });
    expect(result.recipe.bodyLayout).toBe("one");
    expect(result.acceptedKeys).toContain("bodyTextBoxes");
  });

  it("normalizes common footer keys returned by Salesforce AI", () => {
    const result = applyAIWizardProposal({
      recipe: createDefaultWizardRecipe(),
      step: "footer",
      generatedJson: JSON.stringify({
        patch: {
          includeFooter: true,
          footerMessage: "Thank you for your business",
          footerTextAlignment: "right",
          footerBackgroundColor: "#032d60",
          footerFontColor: "#ffffff",
          repeatFooter: false
        }
      })
    });

    expect(result.recipe.showFooter).toBe(true);
    expect(result.recipe.footerText).toBe("Thank you for your business");
    expect(result.recipe.footerAlignment).toBe("right");
    expect(result.recipe.footerBackground).toBe("#032d60");
    expect(result.recipe.footerTextColor).toBe("#ffffff");
    expect(result.recipe.repeatFooterOnEachPage).toBe(false);
  });

  it("provides a deterministic footer fallback for compatible prompts", () => {
    const result = applyGuidedWizardPrompt({
      recipe: {
        ...createDefaultWizardRecipe(),
        showFooter: false,
        repeatFooterOnEachPage: false,
        includeFooterOrganizationName: false
      },
      step: "footer",
      prompt:
        'Create a dark blue footer with white centered text "Thank you for your business", include the organization name and repeat it on every page.'
    });

    expect(result.recipe.showFooter).toBe(true);
    expect(result.recipe.repeatFooterOnEachPage).toBe(true);
    expect(result.recipe.includeFooterOrganizationName).toBe(true);
    expect(result.recipe.footerText).toBe("Thank you for your business");
    expect(result.recipe.footerAlignment).toBe("center");
    expect(result.recipe.footerBackground).toBe("#032d60");
    expect(result.recipe.footerTextColor).toBe("#ffffff");
  });

  it("builds one full-width and two aligned half-width editorial boxes", () => {
    let blockSequence = 0;
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        bodyLayout: "two",
        primaryColor: "#0b5cab",
        bodyTextBoxes: [
          {
            title: "Thank you <team>",
            content: "A concise introduction for the proposal.",
            layout: "full"
          },
          {
            title: "Scope",
            content: "Discovery, delivery and support.",
            layout: "half"
          },
          {
            title: "Why us",
            content: "<ul><li>Collaborative</li><li>Practical</li></ul>",
            layout: "half"
          }
        ]
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `block-${++blockSequence}`,
        type,
        content: "",
        styles: {}
      })
    });

    const boxes = result.body.sections[0].blocks;
    expect(result.body.layout).toBe("one");
    expect(boxes).toHaveLength(3);
    expect(boxes[2].content).toContain("<ul>");
    expect(boxes[2].content).not.toContain("&lt;ul&gt;");
    expect(boxes[0].content).toContain("Thank you &lt;team&gt;");
    expect(boxes[0].content).toContain("color:#0b5cab");
    expect(boxes[0].styles.widthRatio).toBe(1);
    expect(boxes[1].styles.width).toBe(boxes[2].styles.width);
    expect(boxes[1].styles.y).toBe(boxes[2].styles.y);
    expect(boxes[1].styles.x).toBe(0);
    expect(boxes[2].styles.x).toBeGreaterThan(boxes[1].styles.x);
    expect(boxes[0].styles.borderStyle).toBe("solid");
    expect(boxes[0].styles.background).toBe("#ffffff");
  });

  it("accepts complete header content box appearance from Salesforce AI", () => {
    const result = applyAIWizardProposal({
      recipe: createDefaultWizardRecipe(),
      step: "header",
      generatedJson: JSON.stringify({
        patch: {
          headerContentBackground: "#0176d3",
          headerContentPadding: 12,
          headerContentBorderStyle: "solid",
          headerContentBorderWidth: 1,
          headerContentBorderColor: "#181818",
          headerContentBorderRadius: 4,
          headerContentSizeMode: "content"
        },
        unapplied: ["Rotate the content box"]
      })
    });

    expect(result.recipe.headerContentBorderStyle).toBe("solid");
    expect(result.recipe.headerContentBorderWidth).toBe(1);
    expect(result.recipe.headerContentBorderColor).toBe("#181818");
    expect(result.recipe.headerContentBorderRadius).toBe(4);
    expect(result.recipe.headerContentSizeMode).toBe("content");
    expect(result.unapplied).toEqual(["Rotate the content box"]);
  });

  it("keeps a coherent header box when AI misclassifies its background", () => {
    const result = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        headerBackground: "#0176d3"
      },
      step: "header",
      generatedJson: JSON.stringify({
        patch: {
          headerBackground: "#0176d3",
          headerContentPadding: 5,
          headerContentBorderStyle: "solid",
          headerContentBorderWidth: 1,
          headerContentBorderColor: "#000000"
        }
      })
    });

    expect(result.recipe.headerBackground).toBe("transparent");
    expect(result.recipe.headerContentBackground).toBe("#0176d3");
    expect(result.recipe.headerContentPadding).toBe(5);
    expect(result.recipe.headerContentBorderStyle).toBe("solid");
    expect(result.recipe.headerContentBorderWidth).toBe(1);
    expect(result.recipe.headerContentBorderColor).toBe("#000000");
  });

  it("turns styled body fields into a real grouped content box", () => {
    const result = applyAIWizardProposal({
      recipe: createDefaultWizardRecipe(),
      step: "body",
      fields: [{ label: "Opportunity Name", apiName: "Name" }],
      generatedJson: JSON.stringify({
        patch: {
          bodyFields: ["Name"],
          textColor: "#000000",
          bodyContentBackground: "#D3D3D3",
          bodyContentPadding: 8,
          bodyContentBorderStyle: "solid",
          bodyContentBorderWidth: 1
        }
      })
    });

    expect(result.recipe.bodyFields[0].apiName).toBe("Name");
    expect(result.recipe.groupBodyFields).toBe(true);
    expect(result.recipe.textColor).toBe("#000000");
    expect(result.recipe.bodyContentBackground).toBe("#D3D3D3");
  });

  it("accepts grounded field objects when Salesforce AI returns them", () => {
    const result = applyAIWizardProposal({
      recipe: createDefaultWizardRecipe(),
      step: "body",
      relatedListFields: [
        { label: "Opportunity Product Name", apiName: "Name" },
        { label: "Quantity", apiName: "Quantity" }
      ],
      generatedJson: JSON.stringify({
        patch: {
          relatedListColumns: [
            { label: "Opportunity Product Name", apiName: "Name" },
            { label: "Quantity", apiName: "Quantity" }
          ]
        }
      })
    });

    expect(result.recipe.relatedListColumns).toEqual(["Name", "Quantity"]);
    expect(result.unmatchedFields).toEqual([]);
  });

  it("accepts validated editable blocks for a complete AI body layout", () => {
    const result = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "body",
      fields: [
        { label: "Opportunity Name", apiName: "Name" },
        { label: "Amount", apiName: "Amount" }
      ],
      relatedLists: [
        {
          label: "Opportunity Products",
          relationshipName: "OpportunityLineItems",
          childObjectApiName: "OpportunityLineItem"
        }
      ],
      relatedListFields: [
        { label: "Quantity", apiName: "Quantity", dataType: "Double" },
        { label: "Total Price", apiName: "TotalPrice", dataType: "Currency" }
      ],
      generatedJson: JSON.stringify({
        patch: {
          bodyBlocks: [
            {
              type: "text",
              content:
                '<h2>Proposal for {{field:Name}}</h2><script>alert("x")</script>',
              widthPercent: 100,
              gapAfter: 20,
              styles: { color: "#0176d3", fontSize: 24 }
            },
            {
              type: "field",
              fieldApiName: "Amount",
              displayMode: "labelAndValue",
              widthPercent: 48,
              xPercent: 52,
              y: 90,
              height: 64,
              styles: { background: "#eef4ff", padding: 8 }
            },
            {
              type: "relatedList",
              relationshipName: "OpportunityLineItems",
              columns: ["Quantity", "TotalPrice", "Invented__c"],
              widthPercent: 100,
              styles: { tableHeaderRowColor: "#032d60" }
            },
            {
              type: "table",
              tableData: [
                ["Name", "Amount"],
                ["{{field:Name}}", "{{field:Amount}}"]
              ]
            }
          ]
        }
      })
    });

    expect(result.recipe.bodyBlocks).toHaveLength(4);
    expect(result.recipe.bodyBlocks[0].content).toContain(
      "{!Opportunity.Name}"
    );
    expect(result.recipe.bodyBlocks[0].content).not.toContain("script");
    expect(result.recipe.bodyBlocks[1].fieldApiName).toBe("Amount");
    expect(result.recipe.bodyBlocks[1].widthPercent).toBe(48);
    expect(result.recipe.bodyBlocks[1].xPercent).toBe(52);
    expect(result.recipe.bodyBlocks[1].styles.height).toBe(64);
    expect(result.recipe.bodyBlocks[2].relatedListRelationshipName).toBe(
      "OpportunityLineItems"
    );
    expect(result.recipe.bodyBlocks[2].relatedListColumns).toEqual([
      "Quantity",
      "TotalPrice"
    ]);
    expect(result.recipe.bodyBlocks[2].relatedListColumnDefinitions).toEqual([
      { apiName: "Quantity", label: "Quantity", dataType: "Double" },
      {
        apiName: "TotalPrice",
        label: "Total Price",
        dataType: "Currency"
      }
    ]);
    expect(result.recipe.bodyBlocks[2].relatedListHeaderRowColor).toBe(
      "#032d60"
    );
    expect(result.recipe.relatedListHeaderRowColor).toBe("#032d60");
    expect(result.recipe.bodyBlocks[3].tableData[1]).toEqual([
      "{!Opportunity.Name}",
      "{!Opportunity.Amount}"
    ]);
    expect(result.recipe.includeRelatedList).toBe(true);
    expect(result.unmatchedFields).toEqual(["Invented__c"]);
    expect(result.acceptedKeys).toContain("bodyBlocks");
  });

  it("builds AI blocks as ordinary positioned builder elements", () => {
    let blockSequence = 0;
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        bodyFields: [{ apiName: "Name", label: "Opportunity Name" }],
        bodyBlocks: [
          {
            type: "text",
            content: "<strong>Left card</strong>",
            widthPercent: 48,
            xPercent: 0,
            horizontalAlign: "left",
            section: 1,
            gapAfter: 16,
            styles: { y: 20, height: 90, background: "#eef4ff" }
          },
          {
            type: "text",
            content: "<strong>Right card</strong>",
            widthPercent: 48,
            xPercent: 52,
            horizontalAlign: "left",
            section: 1,
            gapAfter: 16,
            styles: { y: 45, height: 60, background: "#eef4ff" }
          },
          {
            type: "divider",
            content: "",
            widthPercent: 100,
            horizontalAlign: "left",
            section: 1,
            gapAfter: 12,
            styles: {
              y: 60,
              height: 2,
              lineThickness: 2,
              lineColor: "#0176d3"
            }
          },
          {
            type: "text",
            content: "Full-width default",
            horizontalAlign: "left",
            section: 1,
            gapAfter: 12,
            styles: {}
          }
        ]
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type, field) => ({
        id: `block-${++blockSequence}`,
        type,
        content: "",
        fieldApiName: field?.apiName || null,
        fieldLabel: field?.label || null,
        styles: {}
      })
    });

    const blocks = result.body.sections[0].blocks;
    expect(blocks).toHaveLength(4);
    expect(blocks.map((block) => block.type)).toEqual([
      "text",
      "text",
      "divider",
      "text"
    ]);
    expect(blocks[0].styles.y).toBe(20);
    expect(blocks[1].styles.y).toBe(20);
    expect(blocks[0].styles.height).toBe(84);
    expect(blocks[1].styles.height).toBe(84);
    expect(blocks[1].styles.x).toBeGreaterThan(blocks[0].styles.x);
    expect(blocks[0].styles.width).toBe(blocks[1].styles.width);
    expect(
      blocks[1].styles.x - (blocks[0].styles.x + blocks[0].styles.width)
    ).toBe(12);
    expect(blocks[2].styles.y).toBeGreaterThanOrEqual(120);
    expect(blocks[2].styles.lineColor).toBe("#0176d3");
    expect(blocks[3].styles.width).toBe(714);
    expect(blocks.some((block) => block.fieldApiName === "Name")).toBe(false);
  });

  it("repairs oversized Related List gaps and undersized rich text boxes", () => {
    let blockSequence = 0;
    const result = buildWizardDocumentModel({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        bodyBlocks: [
          {
            type: "text",
            content:
              '<div style="padding:12px;font-size:18px"><div>Line one</div><div>Line two</div><div>Line three</div></div>',
            widthPercent: 100,
            section: 1,
            gapAfter: 12,
            styles: { y: 0, height: 20, fontSize: 16, padding: 8 }
          },
          {
            type: "relatedList",
            relatedListRelationshipName: "OpportunityLineItems",
            relatedListLabel: "Opportunity Products",
            relatedListChildObjectApiName: "OpportunityLineItem",
            relatedListColumns: ["Quantity"],
            widthPercent: 100,
            section: 1,
            gapAfter: 12,
            styles: { y: 400, height: 500 }
          },
          {
            type: "text",
            content: "Total amount",
            widthPercent: 100,
            section: 1,
            gapAfter: 12,
            styles: { y: 1000, height: 44 }
          }
        ]
      },
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `block-${++blockSequence}`,
        type,
        content: "",
        styles: {}
      })
    });

    const blocks = result.body.sections[0].blocks;
    expect(blocks[0].styles.height).toBeGreaterThan(20);
    expect(blocks[0].styles.height).toBeGreaterThanOrEqual(120);
    expect(blocks[1].styles.height).toBe(50);
    expect(
      blocks[1].styles.y - (blocks[0].styles.y + blocks[0].styles.height)
    ).toBeLessThanOrEqual(12);
    expect(
      blocks[2].styles.y - (blocks[1].styles.y + blocks[1].styles.height)
    ).toBeLessThanOrEqual(12);
  });

  it("keeps multi-field information cards readable when AI oversizes them", () => {
    const result = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "body",
      fields: [
        { label: "Opportunity Name", apiName: "Name" },
        { label: "Amount", apiName: "Amount" },
        { label: "Close Date", apiName: "CloseDate" }
      ],
      generatedJson: JSON.stringify({
        patch: {
          bodyBlocks: [
            {
              type: "text",
              content:
                "<div><strong>Name:</strong> {{field:Name}}</div><div><strong>Amount:</strong> {{field:Amount}}</div><div><strong>Close Date:</strong> {{field:CloseDate}}</div>",
              widthPercent: 48,
              height: 40,
              styles: { fontSize: 30, padding: 12 }
            }
          ]
        }
      })
    });

    expect(result.recipe.bodyBlocks[0].styles.fontSize).toBe(12);
  });

  it("rejects ungrounded AI fields and relationships inside custom blocks", () => {
    const result = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "body",
      fields: [{ label: "Opportunity Name", apiName: "Name" }],
      relatedLists: [],
      generatedJson: JSON.stringify({
        patch: {
          bodyBlocks: [
            { type: "field", fieldApiName: "Secret__c" },
            {
              type: "relatedList",
              relationshipName: "InventedChildren__r",
              columns: ["Name"]
            },
            {
              type: "text",
              content: "{{field:Secret__c}} {{organization:Secret__c}}"
            }
          ]
        }
      })
    });

    expect(result.recipe.bodyBlocks).toHaveLength(0);
    expect(result.unmatchedFields).toEqual([
      "Secret__c",
      "InventedChildren__r",
      "Organization.Secret__c"
    ]);
  });

  it("rejects non-JSON model output", () => {
    expect(() =>
      applyAIWizardProposal({
        recipe: createDefaultWizardRecipe(),
        step: "style",
        generatedJson: "Here is your design"
      })
    ).toThrow();
  });

  it("sanitizes executable HTML and active URLs returned by AI", () => {
    const activeImageUrl = `${"java"}script:alert(1)`;
    const result = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "body",
      generatedJson: JSON.stringify({
        patch: {
          bodyBlocks: [
            {
              type: "text",
              content:
                '<div onclick="alert(1)">Safe<script>alert(1)</script></div>'
            },
            {
              type: "image",
              imageUrl: activeImageUrl,
              imageAlt: "Unsafe image"
            }
          ]
        }
      })
    });

    expect(result.recipe.bodyBlocks[0].content).toContain("Safe");
    expect(result.recipe.bodyBlocks[0].content).not.toMatch(
      /script|onclick|javascript:/i
    );
    expect(result.recipe.bodyBlocks[1].imageSrc).toBe("");
  });

  it("repairs common non-JSON auto geometry returned by the model", () => {
    const result = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "header",
      generatedJson:
        '{"patch":{"headerBlocks":[{"type":"text","content":"<div style=\\"background:#032D60; padding:14px; border:1px solid #0176D3; border-radius:6px; display:flex; justify-content:space-between; align-items:center;\\"><div style=\\"color:#ffffff; font-size:14px;\\">{{organization:Name}}</div><div style=\\"color:#ffffff; font-size:14px;\\">SERVICE QUOTATION</div></div>","widthPercent":94,"xPercent":3,"height":auto}]}}'
    });

    expect(result.recipe.headerBlocks).toHaveLength(1);
    expect(result.recipe.headerBlocks[0].content).toContain(
      "{!$Organization.Name}"
    );
    expect(result.recipe.headerBlocks[0].content).toContain(
      "SERVICE QUOTATION"
    );
    expect(result.recipe.headerBlocks[0].styles.background).toBe("#032D60");
    expect(result.recipe.headerBlocks[0].styles.color).toBe("#ffffff");
    expect(result.recipe.headerBlocks[0].styles.padding).toBe(14);
    expect(result.recipe.headerBlocks[0].styles.borderStyle).toBe("solid");
    expect(result.recipe.headerBlocks[0].styles.height).toBeNull();

    const document = buildWizardDocumentModel({
      recipe: result.recipe,
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `header-${type}`,
        type,
        content: "",
        styles: {}
      })
    });
    expect(document.header.blocks).toHaveLength(1);
    expect(document.header.blocks[0].content).toContain("SERVICE QUOTATION");
    expect(document.header.blocks[0].styles.background).toBe("#032D60");
    expect(document.header.blocks[0].styles.width).toBe(714);
    expect(document.header.blocks[0].styles.x).toBe(0);
    expect(document.header.blocks[0].styles.height).toBeGreaterThanOrEqual(80);
  });

  it("converts an AI flex composition into two editable aligned blocks", () => {
    const proposal = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "body",
      generatedJson: JSON.stringify({
        patch: {
          bodyBlocks: [
            {
              type: "text",
              content:
                "&lt;div style=&quot;display:flex;gap:12px;background:#eef4ff;padding:12px&quot;&gt;&lt;div style=&quot;width:48%;flex:0 0 48%&quot;&gt;&lt;strong&gt;Left&lt;/strong&gt;&lt;br&gt;{{field:Name}}&lt;br&gt;Line 2&lt;br&gt;Line 3&lt;br&gt;Line 4&lt;br&gt;Line 5&lt;br&gt;Line 6&lt;/div&gt;&lt;div style=&quot;width:48%;flex-basis:48%&quot;&gt;&lt;strong&gt;Right&lt;/strong&gt;&lt;br&gt;{{field:Amount}}&lt;/div&gt;&lt;/div&gt;",
              widthPercent: 100,
              styles: { height: 400 }
            },
            {
              type: "text",
              content: "<strong>TOTAL AMOUNT</strong>",
              widthPercent: 100,
              styles: {
                height: 400,
                backgroundColor: "#032d60",
                textColor: "#ffffff"
              }
            }
          ]
        }
      }),
      fields: [
        { label: "Opportunity Name", apiName: "Name" },
        { label: "Amount", apiName: "Amount" }
      ]
    });

    expect(proposal.recipe.bodyBlocks).toHaveLength(3);
    const documentModel = buildWizardDocumentModel({
      recipe: proposal.recipe,
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `${type}-${Math.random()}`,
        type,
        content: "",
        styles: {}
      })
    });
    const [left, right, total] = documentModel.body.sections[0].blocks;
    expect(left.content).toContain("{!Opportunity.Name}");
    expect(right.content).toContain("{!Opportunity.Amount}");
    expect(left.content).not.toMatch(/(?:width|flex)\s*:/i);
    expect(right.content).not.toMatch(/(?:width|flex)\s*:/i);
    expect(left.styles.y).toBe(right.styles.y);
    expect(left.styles.width).toBe(right.styles.width);
    expect(left.styles.height).toBe(right.styles.height);
    expect(right.styles.x - left.styles.width).toBe(12);
    expect(left.styles.height).toBeLessThan(260);
    expect(total.styles.y).toBeGreaterThanOrEqual(
      left.styles.y + left.styles.height
    );
    expect(total.styles.height).toBeLessThan(120);
    expect(total.styles.background).toBe("#032d60");
    expect(total.styles.color).toBe("#ffffff");
  });

  it("does not let partial custom body blocks discard standard body content", () => {
    const proposal = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "body",
      generatedJson: JSON.stringify({
        patch: {
          includeBodyTitle: true,
          documentTitle: "Opportunity Overview",
          bodyFields: ["Name", "Amount"],
          bodyTextBoxes: [
            {
              title: "Executive Summary",
              content: "A concise proposal summary.",
              layout: "full"
            }
          ],
          includeRelatedList: true,
          relatedListRelationshipName: "OpportunityLineItems",
          relatedListColumns: ["Quantity", "TotalPrice"],
          bodyBlocks: [
            {
              type: "text",
              content: "<strong>TOTAL AMOUNT</strong>",
              widthPercent: 100
            }
          ]
        }
      }),
      fields: [
        { label: "Opportunity Name", apiName: "Name" },
        { label: "Amount", apiName: "Amount" }
      ],
      relatedLists: [
        {
          label: "Opportunity Products",
          relationshipName: "OpportunityLineItems",
          childObjectApiName: "OpportunityLineItem"
        }
      ],
      relatedListFields: [
        { label: "Quantity", apiName: "Quantity" },
        { label: "Total Price", apiName: "TotalPrice" }
      ]
    });

    expect(proposal.recipe.bodyBlocks.length).toBeGreaterThanOrEqual(5);
    const documentModel = buildWizardDocumentModel({
      recipe: proposal.recipe,
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type, field) => ({
        id: `${type}-${field?.apiName || Math.random()}`,
        type,
        content: "",
        styles: {}
      })
    });
    const bodyBlocks = documentModel.body.sections.flatMap(
      (section) => section.blocks
    );
    const bodyContent = bodyBlocks
      .map((block) => block.content || "")
      .join(" ");
    expect(bodyContent).toContain("Opportunity Overview");
    expect(bodyContent).toContain("Executive Summary");
    expect(bodyContent).toContain("{!Opportunity.Name}");
    expect(bodyContent).toContain("{!Opportunity.Amount}");
    expect(bodyBlocks.some((block) => block.type === "relatedList")).toBe(true);
  });

  it("rejects empty AI header blocks and never builds an enabled blank header", () => {
    const proposal = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        includeOrganizationName: false,
        headerBlocks: []
      },
      step: "header",
      generatedJson: JSON.stringify({
        patch: {
          headerBlocks: [
            { type: "text", content: "<div>&nbsp;</div>", widthPercent: 100 }
          ]
        }
      })
    });

    expect(proposal.recipe.headerBlocks).toHaveLength(0);
    const documentModel = buildWizardDocumentModel({
      recipe: proposal.recipe,
      configuration: { pageWidth: 794 },
      createDefaultDocument: createDocument,
      createBlock: (type) => ({
        id: `fallback-${type}`,
        type,
        content: "",
        styles: {}
      })
    });
    expect(documentModel.header.blocks).toHaveLength(1);
    expect(documentModel.header.blocks[0].content).toContain(
      "{!$Organization.Name}"
    );
  });

  it("completes a custom header with required standard content", () => {
    const proposal = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity",
        includeOrganizationName: true
      },
      step: "header",
      generatedJson: JSON.stringify({
        patch: {
          headerTextColor: "#ffffff",
          headerContentPadding: 16,
          headerBlocks: [
            {
              type: "text",
              content: "<strong>SERVICE QUOTATION</strong>",
              widthPercent: 100,
              styles: { background: "#032d60" }
            }
          ]
        }
      })
    });

    expect(proposal.recipe.headerBlocks).toHaveLength(1);
    expect(proposal.recipe.headerBlocks[0].content).toContain(
      "{!$Organization.Name}"
    );
    expect(proposal.recipe.headerBlocks[0].content).toContain(
      "SERVICE QUOTATION"
    );
    expect(proposal.recipe.headerBlocks[0].styles.padding).toBe(16);
    expect(proposal.recipe.headerBlocks[0].styles.color).toBe("#ffffff");
  });

  it("makes explicit block text colors override conflicting inline colors", () => {
    const proposal = applyAIWizardProposal({
      recipe: {
        ...createDefaultWizardRecipe(),
        objectApiName: "Opportunity"
      },
      step: "header",
      generatedJson: JSON.stringify({
        patch: {
          headerTextColor: "#ffffff",
          headerBlocks: [
            {
              type: "text",
              content:
                '<div style="display:flex;color:#181818;font-size:8px"><span style="color:#000000;font-size:8px">{{organization:Name}}</span><span>SERVICE QUOTATION</span></div>',
              widthPercent: 100,
              styles: {
                backgroundColor: "#032d60"
              }
            }
          ]
        }
      })
    });

    expect(proposal.recipe.headerBlocks[0].styles.color).toBe("#ffffff");
    expect(proposal.recipe.headerBlocks[0].styles.fontSize).toBe(14);
    expect(proposal.recipe.headerBlocks[0].content).not.toMatch(/color\s*:/i);
    expect(proposal.recipe.headerBlocks[0].content).not.toMatch(
      /font-size\s*:/i
    );
    expect(proposal.recipe.headerBlocks[0].content).toContain(
      "SERVICE QUOTATION"
    );
  });
});
