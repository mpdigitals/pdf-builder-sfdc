/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Verifies the PDF renderer output for current and legacy template schemas.
 */
@IsTest
private class PDFBuilderPdfRendererTest {
  /**
   * @description Creates record data used to characterize field and related-list merging.
   */
  @TestSetup
  static void createRecordData() {
    Account account = new Account(
      Name = 'Renderer Account',
      Phone = '+34 900 123 123',
      AnnualRevenue = 125000.50,
      NumberOfEmployees = 42,
      BillingStreet = 'Calle Mayor 1',
      BillingPostalCode = '28001',
      BillingCity = 'Madrid',
      BillingCountry = 'Spain'
    );
    insert account;
    insert new List<Contact>{
      new Contact(
        FirstName = 'Ada',
        LastName = 'Lovelace',
        Email = 'ada@example.com',
        AccountId = account.Id
      ),
      new Contact(
        FirstName = 'Grace',
        LastName = 'Hopper',
        Email = 'grace@example.com',
        AccountId = account.Id
      )
    };
    insert new PDFBuilderTemplate__c(
      Name = 'Renderer Account Template',
      ObjectApiName__c = 'Account',
      ContentJson__c = JSON.serialize(createDynamicDocumentModel()),
      GeneratedHtml__c = createPreviewShell()
    );
  }

  /**
   * @description Verifies all legacy canvas block families remain renderable.
   */
  @IsTest
  static void rendersLegacyCanvasBlockFamilies() {
    List<Object> blocks = new List<Object>{
      createLegacyBlock(
        'text',
        '<p style="color:rgb(0, 85, 170);line-height:1.5">Legacy text</p>',
        1
      ),
      createLegacyBlock('field', '{!Account.Name}', 5),
      createLegacyBlock('divider', '', 9),
      new Map<String, Object>{
        'type' => 'image',
        'imageSrc' => 'unsupported-image-name',
        'styles' => legacyStyles(13)
      },
      new Map<String, Object>{
        'type' => 'table',
        'styles' => legacyStyles(18),
        'rows' => new List<Object>{
          new Map<String, Object>{
            'cells' => new List<Object>{
              new Map<String, Object>{
                'styles' => new Map<String, Object>{
                  'horizontalAlign' => 'center',
                  'verticalAlign' => 'middle'
                },
                'children' => new List<Object>{
                  createLegacyBlock('text', 'Table value', 1)
                }
              }
            }
          }
        }
      },
      new Map<String, Object>{
        'type' => 'columns2',
        'styles' => legacyStyles(24),
        'columns' => new List<Object>{
          new Map<String, Object>{
            'children' => new List<Object>{
              createLegacyBlock('text', 'Left column', 1)
            }
          },
          new Map<String, Object>{
            'children' => new List<Object>{
              createLegacyBlock('field', 'Right column', 1)
            }
          }
        }
      },
      new Map<String, Object>{
        'type' => 'section',
        'styles' => legacyStyles(30),
        'children' => new List<Object>{
          createLegacyBlock('text', 'Section value', 1)
        }
      },
      new Map<String, Object>{
        'type' => 'relatedList',
        'relatedListRelationshipName' => 'Contacts',
        'relatedListColumns' => new List<Object>{ 'Name', 'Email' },
        'relatedListOddRowColor' => '#ffffff',
        'relatedListEvenRowColor' => '#f7f7f7',
        'relatedListHeaderRowColor' => '#005fb2',
        'relatedListTextColor' => '#ffffff',
        'relatedListFontSize' => '12',
        'relatedListBorderMode' => 'horizontal',
        'styles' => legacyStyles(36)
      }
    };

    Test.startTest();
    String rendered = PDFBuilderController.renderTemplateJsonForPdf(
      JSON.serialize(blocks)
    );
    Test.stopTest();

    Assert.isTrue(rendered.contains('Legacy text'), 'Legacy text must render.');
    Assert.isTrue(
      rendered.contains('Table value'),
      'Table content must render.'
    );
    Assert.isTrue(rendered.contains('Left column'), 'Left column must render.');
    Assert.isTrue(
      rendered.contains('Right column'),
      'Right column must render.'
    );
    Assert.isTrue(
      rendered.contains('Section value'),
      'Section content must render.'
    );
    Assert.isTrue(
      rendered.contains('Image source is not available'),
      'Unsupported legacy images must render a safe notice.'
    );
    Assert.isTrue(
      rendered.contains('[[DBRL|Contacts|Name,Email|'),
      'Legacy related lists must retain their merge token.'
    );
    Assert.isTrue(
      rendered.contains('color:#0055AA !important'),
      'Legacy RGB text color must be normalized.'
    );
    Assert.isTrue(
      rendered.contains('line-height:150%'),
      'Legacy unitless line height must be normalized.'
    );
  }

  /**
   * @description Verifies fixed regions, two-column bodies and manual pages keep their layout.
   */
  @IsTest
  static void rendersDocumentPagesAndFixedRegions() {
    Map<String, Object> model = createStaticDocumentModel();

    Map<String, Object> verticallyAlignedBlock = createDocumentBlock(
      'text',
      '<p>Vertically aligned content</p>',
      20,
      20,
      240,
      100
    );
    ((Map<String, Object>) verticallyAlignedBlock.get('styles'))
      .put('verticalAlign', 'bottom');
    Map<String, Object> body = (Map<String, Object>) model.get('body');
    List<Object> sections = (List<Object>) body.get('sections');
    Map<String, Object> firstSection = (Map<String, Object>) sections[0];
    ((List<Object>) firstSection.get('blocks')).add(verticallyAlignedBlock);

    Test.startTest();
    String rendered = PDFBuilderController.renderTemplateJsonForPdf(
      JSON.serialize(model)
    );
    Test.stopTest();

    Assert.isTrue(rendered.contains('Header content'), 'Header must render.');
    Assert.isTrue(
      rendered.contains('vertical-align:bottom'),
      'Text block vertical alignment must be rendered in the PDF.'
    );
    Assert.isTrue(
      rendered.contains('height="100" valign="bottom"'),
      'The PDF table cell must receive an explicit height and legacy vertical alignment.'
    );
    Assert.isTrue(
      rendered.contains('height:100px;table-layout:fixed'),
      'The PDF alignment table must fill the resolved block height.'
    );
    Assert.isTrue(rendered.contains('Left body'), 'Left body must render.');
    Assert.isTrue(rendered.contains('Right body'), 'Right body must render.');
    Assert.isTrue(
      rendered.contains('Manual page body'),
      'Manual page body must render.'
    );
    Assert.isTrue(rendered.contains('Footer content'), 'Footer must render.');
    Assert.isTrue(
      rendered.contains('page-break-after:always'),
      'Manual pages must preserve explicit page breaks.'
    );
    Assert.isTrue(
      rendered.contains('border-top:2px dashed #005FB2'),
      'Divider style must be preserved.'
    );
    Assert.isTrue(
      rendered.contains('src="https://example.com/logo.png"'),
      'Supported image sources must be preserved.'
    );
  }

  /**
   * @description Verifies record fields, global fields and related rows are merged in flow preview.
   */
  @IsTest
  static void mergesRecordAndRelatedListPreview() {
    Account account = [
      SELECT Id, CreatedDate
      FROM Account
      WHERE Name = 'Renderer Account'
      LIMIT 1
    ];
    String contentJson = JSON.serialize(createDynamicDocumentModel());

    Test.startTest();
    PDFBuilderController.PreviewFlowResult result = PDFBuilderController.renderPdfFlowForRecordPreview(
      'Account',
      account.Id,
      contentJson,
      createPreviewShell()
    );
    Test.stopTest();

    Assert.isTrue(
      result.headerHtml.contains('Renderer Account'),
      'Header record tokens must be merged.'
    );
    Assert.isTrue(
      result.headerHtml.contains(UserInfo.getName()),
      'Header user tokens must be merged.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('Renderer Account'),
      'Body record tokens must be merged.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('125'),
      'Currency fields must render.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('42'),
      'Integer fields must render.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('Calle Mayor 1'),
      'Address fields must render.'
    );
    Assert.isTrue(
      result.bodyHtml.contains(account.CreatedDate.date().format()),
      'DateTime fields must render their date portion.'
    );
    Assert.isFalse(
      result.bodyHtml.contains(account.CreatedDate.format()),
      'DateTime fields must not render a time.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('Ada Lovelace'),
      'First related record must render.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('ada@example.com'),
      'Related record fields must render.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('Grace Hopper'),
      'Second related record must render.'
    );
    Assert.isFalse(
      result.bodyHtml.contains('[[DBRL|'),
      'Related-list tokens must be fully resolved.'
    );
    Assert.isTrue(
      result.footerHtml.contains('Renderer Account'),
      'Footer record tokens must be merged.'
    );
    Assert.areEqual(
      0,
      PDFBuilderPdfPageController.pageTopMarginForRender,
      'Browser preview must not reserve PDF top margins.'
    );
    Assert.areEqual(
      0,
      PDFBuilderPdfPageController.pageBottomMarginForRender,
      'Browser preview must not reserve PDF bottom margins.'
    );
  }

  /**
   * @description Verifies current-schema tables merge global variables during
   * record preview without requiring a related-list rendering context.
   */
  @IsTest
  static void mergesOrganizationNameInsideCurrentTablePreview() {
    Opportunity opportunity = new Opportunity(
      Name = 'Table preview opportunity',
      StageName = 'Prospecting',
      CloseDate = Date.today().addDays(30)
    );
    insert opportunity;

    Map<String, Object> model = createStaticDocumentModel();
    Map<String, Object> body = (Map<String, Object>) model.get('body');
    List<Object> sections = (List<Object>) body.get('sections');
    Map<String, Object> firstSection = (Map<String, Object>) sections[0];
    Map<String, Object> tableBlock = createDocumentBlock(
      'table',
      '',
      100,
      300,
      360,
      112
    );
    Map<String, Object> tableStyles = (Map<String, Object>) tableBlock.get(
      'styles'
    );
    tableStyles.put('tableRows', 3);
    tableStyles.put('tableColumns', 3);
    tableStyles.put('tableCellPadding', 8);
    tableStyles.put('tableBorderWidth', 1);
    tableStyles.put('tableBorderColor', '#c9c9c9');
    tableStyles.put('tableCellVerticalAlign', 'middle');
    tableBlock.put(
      'tableData',
      new List<Object>{
        new List<Object>{ '', '', '' },
        new List<Object>{ '{!$Organization.Name}', '', '' },
        new List<Object>{ '', '', '' }
      }
    );
    firstSection.put('blocks', new List<Object>{ tableBlock });

    Test.startTest();
    PDFBuilderController.PreviewFlowResult result = PDFBuilderController.renderPdfFlowForRecordPreview(
      'Opportunity',
      opportunity.Id,
      JSON.serialize(model),
      '<main><p>Fallback should not be used</p></main>'
    );
    Test.stopTest();

    String organizationName = [SELECT Name FROM Organization LIMIT 1].Name;
    Assert.isTrue(
      result.bodyHtml.contains(organizationName),
      'The organization name in a current table cell must be merged.'
    );
    Assert.isFalse(
      result.bodyHtml.contains('{!$Organization.Name}'),
      'The global variable must not remain unresolved.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('vertical-align:middle'),
      'Current table cell alignment must be preserved.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('overflow-wrap:anywhere'),
      'Long values must wrap inside their current table cell.'
    );
    Assert.isTrue(
      result.bodyHtml.contains('overflow:hidden'),
      'Cell overflow must not cover adjacent columns.'
    );
  }

  /**
   * @description Verifies saved template rendering retains the same facade and validation behavior.
   */
  @IsTest
  static void rendersSavedTemplateForRecord() {
    Account account = [
      SELECT Id
      FROM Account
      WHERE Name = 'Renderer Account'
      LIMIT 1
    ];
    PDFBuilderTemplate__c template = [
      SELECT Id
      FROM PDFBuilderTemplate__c
      WHERE Name = 'Renderer Account Template'
      LIMIT 1
    ];

    Test.startTest();
    String rendered = PDFBuilderController.renderTemplateBodyForRecord(
      template.Id,
      account.Id
    );
    String prepared = PDFBuilderController.renderTemplateBodyHtmlForPdf(
      template.Id,
      account.Id
    );
    Test.stopTest();

    Assert.isTrue(
      rendered.contains('Renderer Account'),
      'Saved template fields must be merged.'
    );
    Assert.isTrue(
      rendered.contains('Ada Lovelace'),
      'Saved template related rows must be merged.'
    );
    Assert.isTrue(
      prepared.contains('Renderer Account'),
      'Prepared PDF HTML must retain merged fields.'
    );
    Assert.isFalse(
      prepared.contains('<script'),
      'Prepared PDF HTML must not contain scripts.'
    );
  }

  /**
   * @description Verifies preview input validation and generated-HTML fallback behavior.
   */
  @IsTest
  static void validatesPreviewRequestsAndFallbacks() {
    Account account = [
      SELECT Id
      FROM Account
      WHERE Name = 'Renderer Account'
      LIMIT 1
    ];
    Contact contact = [SELECT Id FROM Contact LIMIT 1];
    Test.startTest();
    String fallback = PDFBuilderController.renderTemplateBodyHtmlForPreview(
      '{invalid-json',
      '<main><p>Fallback HTML</p></main>'
    );
    String merged = PDFBuilderController.renderGeneratedHtmlForRecordPreview(
      'Account',
      account.Id,
      '',
      '<main lwc-test="x" data-key="runtime">{!Account.Name}</main>'
    );

    assertPreviewFails('Account', null, 'missing record');
    assertPreviewFails('', account.Id, 'missing object');
    assertPreviewFails('Account', contact.Id, 'object mismatch');
    Test.stopTest();

    Assert.isTrue(
      fallback.contains('Fallback HTML'),
      'Invalid JSON must use generated HTML as a fallback.'
    );
    Assert.isTrue(
      merged.contains('Renderer Account'),
      'Generated HTML fields must be merged.'
    );
    Assert.isFalse(
      merged.contains('data-key='),
      'LWC runtime attributes must be removed.'
    );
  }

  /**
   * @description Asserts a preview request fails without depending on localized exception text.
   *
   * @param objectApiName Requested object API name.
   * @param recordId Requested record identifier.
   * @param scenario Assertion scenario label.
   */
  private static void assertPreviewFails(
    String objectApiName,
    Id recordId,
    String scenario
  ) {
    try {
      PDFBuilderController.renderGeneratedHtmlForRecordPreview(
        objectApiName,
        recordId,
        '',
        '<main>Preview</main>'
      );
      Assert.fail('Expected failure for ' + scenario);
    } catch (AuraHandledException expected) {
      Assert.isNotNull(expected, 'Preview must reject ' + scenario + '.');
    }
  }

  /**
   * @description Creates a representative dynamic document with a related list.
   *
   * @return Current document schema fixture.
   */
  private static Map<String, Object> createDynamicDocumentModel() {
    Map<String, Object> relatedList = createDocumentBlock(
      'relatedList',
      '',
      0,
      70,
      730,
      100
    );
    relatedList.put('relatedListRelationshipName', 'Contacts');
    relatedList.put(
      'relatedListColumns',
      new List<Object>{ 'Name', 'Email', 'CreatedDate' }
    );
    relatedList.put('relatedListOddRowColor', '#ffffff');
    relatedList.put('relatedListEvenRowColor', '#f7f7f7');
    relatedList.put('relatedListHeaderRowColor', '#005fb2');
    relatedList.put('relatedListTextColor', '#ffffff');
    relatedList.put('relatedListOddTextColor', '#181818');
    relatedList.put('relatedListEvenTextColor', '#181818');
    relatedList.put('relatedListFontSize', '12');
    relatedList.put('relatedListBorderMode', 'all');

    return new Map<String, Object>{
      'pagePadding' => 32,
      'showHeader' => true,
      'showBody' => true,
      'showFooter' => true,
      'repeatHeaderOnEachPage' => true,
      'repeatFooterOnEachPage' => true,
      'manualPageCount' => 0,
      'header' => createDocumentRegion(
        'header',
        110,
        new List<Object>{
          createDocumentBlock('text', 'Dynamic header', 0, 0, 730, 70)
        }
      ),
      'body' => new Map<String, Object>{
        'layout' => 'one',
        'sections' => new List<Object>{
          createDocumentRegion(
            'body-1',
            800,
            new List<Object>{
              createDocumentBlock(
                'field',
                '{!Account.Name}<br />{!Account.AnnualRevenue}<br />' +
                  '{!Account.NumberOfEmployees}<br />{!Account.BillingAddress}<br />' +
                  '{!Account.CreatedDate}<br />' +
                  '{!Account.Owner.Name}<br />{!Account.UnknownField}',
                0,
                0,
                730,
                60
              ),
              relatedList,
              createDocumentBlock(
                'text',
                '<p>After contacts</p>',
                0,
                180,
                730,
                80
              )
            }
          )
        }
      },
      'footer' => createDocumentRegion(
        'footer',
        80,
        new List<Object>{
          createDocumentBlock('text', 'Dynamic footer', 0, 0, 730, 50)
        }
      )
    };
  }

  /**
   * @description Creates a representative multi-page document without dynamic content.
   *
   * @return Current document schema fixture.
   */
  private static Map<String, Object> createStaticDocumentModel() {
    Map<String, Object> divider = createDocumentBlock(
      'divider',
      '',
      0,
      80,
      340,
      20
    );
    Map<String, Object> dividerStyles = (Map<String, Object>) divider.get(
      'styles'
    );
    dividerStyles.put('lineThickness', 2);
    dividerStyles.put('lineStyle', 'dashed');
    dividerStyles.put('lineColor', '#005FB2');

    Map<String, Object> image = createDocumentBlock('image', '', 0, 0, 300, 90);
    image.put('imageSrc', 'https://example.com/logo.png');

    return new Map<String, Object>{
      'pagePadding' => 32,
      'showHeader' => true,
      'showBody' => true,
      'showFooter' => true,
      'repeatHeaderOnEachPage' => true,
      'repeatFooterOnEachPage' => true,
      'manualPageCount' => 1,
      'header' => createDocumentRegion(
        'header',
        110,
        new List<Object>{
          createDocumentBlock('text', 'Header content', 0, 0, 730, 70)
        }
      ),
      'body' => new Map<String, Object>{
        'layout' => 'two',
        'sections' => new List<Object>{
          createDocumentRegion(
            'body-left',
            820,
            new List<Object>{
              createDocumentBlock('text', 'Left body', 0, 0, 340, 70),
              divider
            }
          ),
          createDocumentRegion(
            'body-right',
            820,
            new List<Object>{
              createDocumentBlock('field', 'Right body', 0, 0, 340, 70),
              image
            }
          )
        }
      },
      'footer' => createDocumentRegion(
        'footer',
        80,
        new List<Object>{
          createDocumentBlock('text', 'Footer content', 0, 0, 730, 50)
        }
      ),
      'manualPages' => new List<Object>{
        new Map<String, Object>{
          'body' => new Map<String, Object>{
            'layout' => 'one',
            'sections' => new List<Object>{
              createDocumentRegion(
                'manual-body',
                820,
                new List<Object>{
                  createDocumentBlock('text', 'Manual page body', 0, 0, 730, 80)
                }
              )
            }
          }
        }
      }
    };
  }

  /**
   * @description Creates a current-schema region fixture.
   *
   * @param regionId Region identifier.
   * @param height Region height.
   * @param blocks Region blocks.
   * @return Region fixture.
   */
  private static Map<String, Object> createDocumentRegion(
    String regionId,
    Integer height,
    List<Object> blocks
  ) {
    return new Map<String, Object>{
      'id' => regionId,
      'styles' => new Map<String, Object>{
        'height' => height,
        'padding' => 0,
        'borderWidth' => 0,
        'borderStyle' => 'solid',
        'borderColor' => '#c9c9c9',
        'borderRadius' => 0,
        'background' => '#ffffff'
      },
      'blocks' => blocks
    };
  }

  /**
   * @description Creates a current-schema block fixture.
   *
   * @param type Block type.
   * @param content Block content.
   * @param x Horizontal position.
   * @param y Vertical position.
   * @param width Block width.
   * @param height Block height.
   * @return Block fixture.
   */
  @SuppressWarnings('PMD.ExcessiveParameterList')
  private static Map<String, Object> createDocumentBlock(
    String type,
    String content,
    Integer x,
    Integer y,
    Integer width,
    Integer height
  ) {
    return new Map<String, Object>{
      'id' => type +
      '-' +
      String.valueOf(x) +
      '-' +
      String.valueOf(y),
      'type' => type,
      'content' => content,
      'styles' => new Map<String, Object>{
        'x' => x,
        'y' => y,
        'width' => width,
        'height' => height,
        'padding' => 0,
        'borderWidth' => 0,
        'borderStyle' => 'solid',
        'borderColor' => '#c9c9c9',
        'borderRadius' => 0,
        'background' => 'transparent',
        'color' => '#181818',
        'fontFamily' => 'Arial, sans-serif',
        'fontSize' => 14,
        'fontWeight' => 'normal',
        'fontStyle' => 'normal',
        'textDecoration' => 'none',
        'textAlign' => 'left',
        'verticalAlign' => 'top',
        'tableCellPadding' => 8
      }
    };
  }

  /**
   * @description Creates a legacy-schema block fixture.
   *
   * @param type Block type.
   * @param content Block content.
   * @param gridRowStart Grid row.
   * @return Legacy block fixture.
   */
  private static Map<String, Object> createLegacyBlock(
    String type,
    String content,
    Integer gridRowStart
  ) {
    return new Map<String, Object>{
      'type' => type,
      'content' => content,
      'styles' => legacyStyles(gridRowStart)
    };
  }

  /**
   * @description Creates legacy grid styles.
   *
   * @param gridRowStart Grid row.
   * @return Legacy style fixture.
   */
  private static Map<String, Object> legacyStyles(Integer gridRowStart) {
    return new Map<String, Object>{
      'gridColumnStart' => 1,
      'gridColumnSpan' => 12,
      'gridRowStart' => gridRowStart,
      'gridRowSpan' => 4,
      'width' => '100%',
      'height' => '80px',
      'padding' => '8px',
      'background' => '#ffffff',
      'fontSize' => '14',
      'fontFamily' => 'Arial',
      'fontWeight' => 'normal',
      'fontStyle' => 'normal',
      'textDecoration' => 'none',
      'color' => '#181818',
      'horizontalAlign' => 'left',
      'verticalAlign' => 'top',
      'borderEnabled' => 'true',
      'borderWidth' => '1px',
      'borderColor' => '#c9c9c9'
    };
  }

  /**
   * @description Creates browser shell HTML used to characterize repeated regions.
   *
   * @return Preview shell HTML.
   */
  private static String createPreviewShell() {
    return '<header data-key="header"><strong>{!Account.Name}</strong> {!$User.Name}</header>' +
      '<main><p>{!Account.Name}</p></main>' +
      '<footer data-region-id="footer">Footer {!Account.Name}</footer>';
  }
}
