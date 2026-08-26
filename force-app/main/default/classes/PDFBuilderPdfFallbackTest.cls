/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Verifies PDF compatibility fallbacks, image normalization, and
 * empty related-list rendering paths.
 */
@IsTest
private class PDFBuilderPdfFallbackTest {
  /**
   * @description Creates isolated records used by the PDF fallback scenarios.
   */
  @TestSetup
  static void createFixtures() {
    Account account = new Account(Name = 'PDF Fallback Account');
    insert account;

    ContentVersion imageVersion = new ContentVersion(
      Title = 'pdf-fallback-image',
      PathOnClient = 'pdf-fallback-image.png',
      VersionData = Blob.valueOf('pdf-fallback-image')
    );
    insert imageVersion;

    String imageUrl =
      '/sfc/servlet.shepherd/version/download/' + imageVersion.Id;
    insert new PDFBuilderTemplate__c(
      Name = 'PDF Fallback Template',
      ObjectApiName__c = 'Account',
      ContentJson__c = JSON.serialize(createPdfDocumentModel()),
      GeneratedHtml__c = buildImageHtml(imageUrl)
    );
  }

  /**
   * @description Verifies all public PDF entry points execute their ordered
   * compatibility attempts when Visualforce PDF output is unavailable in tests.
   */
  @IsTest
  static void retriesPdfCompatibilityRepresentations() {
    Account account = [
      SELECT Id
      FROM Account
      WHERE Name = 'PDF Fallback Account'
      LIMIT 1
    ];
    PDFBuilderTemplate__c template = [
      SELECT Id, ContentJson__c, GeneratedHtml__c
      FROM PDFBuilderTemplate__c
      WHERE Name = 'PDF Fallback Template'
      LIMIT 1
    ];

    Test.startTest();
    Integer expectedFailures = 0;
    expectedFailures += invokeExpectedPdfFailure(
      'preview',
      template,
      account.Id
    );
    expectedFailures += invokeExpectedPdfFailure(
      'record preview',
      template,
      account.Id
    );
    expectedFailures += invokeExpectedPdfFailure(
      'saved template',
      template,
      account.Id
    );
    Test.stopTest();

    Assert.areEqual(
      3,
      expectedFailures,
      'Every PDF entry point must reach its documented test-context fallback.'
    );
  }

  /**
   * @description Verifies browser preparation keeps supported image sources,
   * removes runtime artifacts, and replaces record-dependent list tokens.
   */
  @IsTest
  static void preparesImagesAndUnresolvedRelatedLists() {
    ContentVersion imageVersion = [
      SELECT Id
      FROM ContentVersion
      WHERE Title = 'pdf-fallback-image'
      LIMIT 1
    ];
    String imageUrl =
      '/sfc/servlet.shepherd/version/download/' + imageVersion.Id;
    String source =
      buildImageHtml(imageUrl) +
      '[[DBRL|Contacts|Name,Email|true|#fff|rgb(245,245,245)|#005fb2|#ffffff|12|#181818|#181818|none|8]]';

    Test.startTest();
    String prepared = PDFBuilderController.renderTemplateBodyHtmlForPreview(
      '',
      source
    );
    Test.stopTest();

    Assert.isTrue(
      prepared.contains('<div'),
      'Section elements must be converted for Visualforce compatibility.'
    );
    Assert.isFalse(
      prepared.contains('lwc-runtime'),
      'Transient LWC attributes must be removed.'
    );
    Assert.isTrue(
      prepared.contains('requires a record context'),
      'Unresolved related lists must show a safe placeholder.'
    );
    Assert.isTrue(
      prepared.contains(String.valueOf(imageVersion.Id)),
      'Salesforce image references must be retained.'
    );
    Assert.isTrue(
      prepared.contains('data:image/png;base64'),
      'Inline image data must remain available to the renderer.'
    );
    Assert.isTrue(
      prepared.contains('/resource/pdfBuilderLogo'),
      'Static resource image paths must remain available.'
    );
  }

  /**
   * @description Verifies empty related lists and all supported cell border modes
   * render correctly without relying on existing organization data.
   */
  @IsTest
  static void rendersEmptyRelatedListsAcrossBorderModes() {
    Account account = [
      SELECT Id
      FROM Account
      WHERE Name = 'PDF Fallback Account'
      LIMIT 1
    ];
    Map<String, Object> model = createEmptyRelatedListModel();

    Test.startTest();
    PDFBuilderController.PreviewFlowResult result = PDFBuilderController.renderPdfFlowForRecordPreview(
      'Account',
      account.Id,
      JSON.serialize(model),
      '<main><p>Empty lists</p></main>'
    );
    Test.stopTest();

    Assert.isTrue(
      result.bodyHtml.contains('No records'),
      'Empty relationships must render an explicit empty state.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('border:none;'),
      'The no-border mode must be rendered.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('border-left:'),
      'The vertical-border mode must be rendered.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('border-top:'),
      'The horizontal-border mode must be rendered.'
    );
    Assert.isFalse(
      result.bodyHtml.contains('[[DBRL|'),
      'All related-list tokens must be resolved.'
    );
  }

  /**
   * @description Verifies non-repeated regions and manual overflow pages remain
   * available when a related list activates dynamic PDF layout.
   */
  @IsTest
  static void rendersNonRepeatedRegionsAndManualOverflow() {
    Map<String, Object> model = createEmptyRelatedListModel();
    model.put('repeatHeaderOnEachPage', false);
    model.put('repeatFooterOnEachPage', false);
    model.put('manualPageCount', 2);

    Map<String, Object> header = (Map<String, Object>) model.get('header');
    ((List<Object>) header.get('blocks'))
      .add(createTextBlock('Non-repeated header'));
    Map<String, Object> footer = (Map<String, Object>) model.get('footer');
    ((List<Object>) footer.get('blocks'))
      .add(createTextBlock('Non-repeated footer'));

    Map<String, Object> manualBody = new Map<String, Object>{
      'layout' => 'one',
      'sections' => new List<Object>{
        new Map<String, Object>{
          'id' => 'manual-body',
          'styles' => new Map<String, Object>{
            'height' => 800,
            'padding' => 0,
            'borderWidth' => 0
          },
          'blocks' => new List<Object>{
            createTextBlock('Manual overflow content')
          }
        }
      }
    };
    model.put(
      'manualPages',
      new List<Object>{
        new Map<String, Object>{ 'body' => new Map<String, Object>() },
        new Map<String, Object>{ 'body' => manualBody }
      }
    );

    Test.startTest();
    String rendered = PDFBuilderController.renderTemplateJsonForPdf(
      JSON.serialize(model)
    );
    Test.stopTest();

    Assert.isTrue(
      rendered.contains('Non-repeated header'),
      'A non-repeated header must render in the document flow.'
    );
    Assert.isTrue(
      rendered.contains('Manual overflow content'),
      'A populated manual overflow page must render after an empty page.'
    );
    Assert.isTrue(
      rendered.contains('Non-repeated footer'),
      'A non-repeated footer must render after dynamic content.'
    );
    Assert.isTrue(
      rendered.contains('page-break-before:always'),
      'Manual overflow content must start on a new page.'
    );
  }

  /**
   * @description Verifies DTO constructors preserve the fields consumed by
   * Lightning components.
   */
  @IsTest
  static void preservesPdfResultContracts() {
    ContentVersion imageVersion = [
      SELECT
        Id,
        ContentDocumentId,
        Title,
        FileExtension,
        ContentSize,
        LastModifiedDate
      FROM ContentVersion
      WHERE Title = 'pdf-fallback-image'
      LIMIT 1
    ];

    Test.startTest();
    PDFBuilderController.PdfResult pdfResult = new PDFBuilderController.PdfResult(
      'preview.pdf',
      'cGRm',
      'warning'
    );
    PDFBuilderController.PdfFileResult fileResult = new PDFBuilderController.PdfFileResult(
      'saved.pdf',
      imageVersion.Id,
      imageVersion.ContentDocumentId,
      null
    );
    PDFBuilderController.SalesforceImageFileOption imageOption = new PDFBuilderController.SalesforceImageFileOption(
      imageVersion
    );
    PDFBuilderController.PreviewFlowResult flowResult = new PDFBuilderController.PreviewFlowResult(
      'header',
      'body',
      'footer'
    );
    Test.stopTest();

    Assert.areEqual(
      'preview.pdf',
      pdfResult.fileName,
      'PDF name must persist.'
    );
    Assert.areEqual('cGRm', pdfResult.base64Data, 'PDF data must persist.');
    Assert.areEqual('warning', pdfResult.warning, 'PDF warning must persist.');
    Assert.areEqual(
      'saved.pdf',
      fileResult.fileName,
      'File name must persist.'
    );
    Assert.areEqual(
      imageVersion.Id,
      fileResult.contentVersionId,
      'Content version must persist.'
    );
    Assert.areEqual(
      imageVersion.ContentDocumentId,
      fileResult.contentDocumentId,
      'Content document must persist.'
    );
    Assert.isTrue(
      imageOption.fileName.endsWith('.png'),
      'Salesforce image options must expose the normalized extension.'
    );
    Assert.areEqual('header', flowResult.headerHtml, 'Header must persist.');
    Assert.areEqual('body', flowResult.bodyHtml, 'Body must persist.');
    Assert.areEqual('footer', flowResult.footerHtml, 'Footer must persist.');
  }

  /**
   * @description Verifies rich text sanitization, typography scaling, legacy
   * color conversion, and plain-text escaping as one public rendering contract.
   */
  @IsTest
  static void normalizesRichAndPlainTextSafely() {
    String source =
      '<font color=#123456><span style="font-size:20px;line-height:4;color:rgb(300, 10, 20);" onclick="alert(1)">Rich</span></font>' +
      '<span style="color:rgb(300, 10, 20);">Repeated</span>' +
      '<script>unsafe()</script><style>.unsafe{}</style>';

    Test.startTest();
    String rich = PDFBuilderController.renderRichTextContentForPdf(source);
    String plain = PDFBuilderController.renderRichTextContentForPdf(
      'First & second\nThird'
    );
    String blank = PDFBuilderController.renderRichTextContentForPdf('');
    Test.stopTest();

    Assert.isTrue(
      rich.contains('font-size:19.20px'),
      'Inline font sizes must use PDF typography compensation.'
    );
    Assert.isTrue(
      rich.contains('line-height:300%'),
      'Unsafe line-height extremes must be clamped.'
    );
    Assert.isTrue(
      rich.contains('#FF0A14'),
      'RGB colors must be normalized and clamped.'
    );
    Assert.isFalse(rich.contains('<font'), 'Legacy font tags must be removed.');
    Assert.isFalse(
      rich.contains('onclick='),
      'Inline handlers must be removed.'
    );
    Assert.isFalse(rich.contains('<script'), 'Scripts must be removed.');
    Assert.isFalse(rich.contains('<style'), 'Style tags must be removed.');
    Assert.areEqual(
      'First &amp; second<br />Third',
      plain,
      'Plain text must be escaped and retain line breaks.'
    );
    Assert.areEqual('', blank, 'Blank rich text must remain blank.');
  }

  /**
   * @description Invokes one PDF facade and returns one when the known
   * Visualforce test-context exception is reached.
   * @param scenario PDF facade selector.
   * @param template Saved template fixture.
   * @param recordId Source record identifier.
   * @return One when the expected platform exception is raised.
   */
  private static Integer invokeExpectedPdfFailure(
    String scenario,
    PDFBuilderTemplate__c template,
    Id recordId
  ) {
    try {
      if (scenario == 'preview') {
        PDFBuilderController.generatePreviewPdf(
          '',
          template.GeneratedHtml__c
        );
      } else if (scenario == 'record preview') {
        PDFBuilderController.generatePreviewPdfForRecord(
          'Account',
          recordId,
          template.ContentJson__c,
          template.GeneratedHtml__c
        );
      } else {
        PDFBuilderController.generatePdf(template.Id, recordId);
      }
      Assert.fail(
        'Visualforce getContentAsPDF must not complete inside an Apex unit test.'
      );
    } catch (AuraHandledException expected) {
      Assert.isNotNull(
        expected,
        'The PDF facade must expose a handled compatibility error.'
      );
      return 1;
    }
    return 0;
  }

  /**
   * @description Builds HTML containing every supported image source family.
   * @param salesforceImageUrl Salesforce Files version URL.
   * @return Representative generated HTML.
   */
  private static String buildImageHtml(String salesforceImageUrl) {
    return '<section lwc-runtime="true"><p>PDF fallback {!Account.Name}</p>' +
      '<img src="' +
      salesforceImageUrl +
      '" />' +
      '<img src="data:image/png;base64,iVBORw0KGgo=" />' +
      '<img src="/resource/pdfBuilderLogo" />' +
      '<img src="https://example.com/logo.png?value=one&amp;other=two" />' +
      '</section>';
  }

  /**
   * @description Builds a current-schema document containing empty related
   * lists with distinct border and color configurations.
   * @return Isolated current-schema document model.
   */
  private static Map<String, Object> createEmptyRelatedListModel() {
    return new Map<String, Object>{
      'pagePadding' => 32,
      'showHeader' => true,
      'showBody' => true,
      'showFooter' => true,
      'repeatHeaderOnEachPage' => true,
      'repeatFooterOnEachPage' => true,
      'manualPageCount' => 0,
      'header' => createDocumentRegion('header', 80),
      'footer' => createDocumentRegion('footer', 80),
      'body' => new Map<String, Object>{
        'layout' => 'one',
        'sections' => new List<Object>{
          new Map<String, Object>{
            'id' => 'empty-related-lists',
            'styles' => new Map<String, Object>{
              'height' => 800,
              'padding' => 0,
              'borderWidth' => 0
            },
            'blocks' => new List<Object>{
              createRelatedListBlock('none-list', 0, 'none', '#fff'),
              createRelatedListBlock(
                'vertical-list',
                130,
                'vertical',
                'rgb(255,255,255)'
              ),
              createRelatedListBlock(
                'horizontal-list',
                260,
                'horizontal',
                '#000000'
              )
            }
          }
        }
      }
    };
  }

  /**
   * @description Builds a minimal complete document used by record-aware PDF
   * entry points.
   * @return Current-schema document model with repeatable empty regions.
   */
  private static Map<String, Object> createPdfDocumentModel() {
    return new Map<String, Object>{
      'pagePadding' => 32,
      'showHeader' => true,
      'showBody' => true,
      'showFooter' => true,
      'repeatHeaderOnEachPage' => true,
      'repeatFooterOnEachPage' => true,
      'manualPageCount' => 0,
      'header' => createDocumentRegion('header', 80),
      'body' => new Map<String, Object>{
        'layout' => 'one',
        'sections' => new List<Object>{
          new Map<String, Object>{
            'id' => 'body',
            'styles' => new Map<String, Object>{
              'height' => 800,
              'padding' => 0,
              'borderWidth' => 0
            },
            'blocks' => new List<Object>{
              createTextBlock('PDF fallback {!Account.Name}'),
              createRelatedListBlock(
                'fallback-related-list',
                100,
                'all',
                '#ffffff'
              )
            }
          }
        }
      },
      'footer' => createDocumentRegion('footer', 80)
    };
  }

  /**
   * @description Builds an empty document region with explicit geometry.
   * @param regionId Region identifier.
   * @param height Region height in builder pixels.
   * @return Current-schema document region.
   */
  private static Map<String, Object> createDocumentRegion(
    String regionId,
    Integer height
  ) {
    return new Map<String, Object>{
      'id' => regionId,
      'styles' => new Map<String, Object>{
        'height' => height,
        'padding' => 0,
        'borderWidth' => 0
      },
      'blocks' => new List<Object>()
    };
  }

  /**
   * @description Builds a text block that makes the fixture renderable.
   * @param content Block content.
   * @return Current-schema text block.
   */
  private static Map<String, Object> createTextBlock(String content) {
    return new Map<String, Object>{
      'id' => 'fallback-text',
      'type' => 'text',
      'content' => content,
      'styles' => new Map<String, Object>{
        'x' => 0,
        'y' => 0,
        'width' => 730,
        'height' => 80,
        'padding' => 0,
        'borderWidth' => 0,
        'fontSize' => 14
      }
    };
  }

  /**
   * @description Creates one related-list block for the empty-state model.
   * @param blockId Block identifier.
   * @param y Vertical position.
   * @param borderMode Related-list border mode.
   * @param rowColor Empty-row background color.
   * @return Related-list block fixture.
   */
  @SuppressWarnings('PMD.ExcessiveParameterList')
  private static Map<String, Object> createRelatedListBlock(
    String blockId,
    Integer y,
    String borderMode,
    String rowColor
  ) {
    return new Map<String, Object>{
      'id' => blockId,
      'type' => 'relatedList',
      'relatedListRelationshipName' => 'Contacts',
      'relatedListColumns' => new List<Object>{ 'Name', 'Email' },
      'relatedListEnableZebra' => false,
      'relatedListOddRowColor' => rowColor,
      'relatedListEvenRowColor' => 'transparent',
      'relatedListHeaderRowColor' => 'rgba(0,95,178,0.8)',
      'relatedListTextColor' => 'white',
      'relatedListOddTextColor' => 'black',
      'relatedListEvenTextColor' => '#181818',
      'relatedListFontSize' => '11',
      'relatedListBorderMode' => borderMode,
      'relatedListCellPadding' => 6,
      'styles' => new Map<String, Object>{
        'x' => 0,
        'y' => y,
        'width' => 730,
        'height' => 100,
        'padding' => 0,
        'borderWidth' => 0,
        'fontSize' => 14
      }
    };
  }
}
