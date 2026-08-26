/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Verifies PDF typography normalization and related-list flow geometry.
 */
@IsTest
private class PDFBuilderPdfLineHeightTest {
  /**
   * @description Verifies unitless line heights are converted without altering absolute values.
   */
  @IsTest
  static void convertsOnlyUnitlessInlineLineHeightForPdf() {
    String source =
      '<p style="line-height:0.25;margin:0">Compact</p>' +
      '<p>Unchanged</p>' +
      '<p style="line-height:2.25;">Expanded</p>' +
      '<p style="line-height:18px;">Absolute</p>' +
      '<h1 style="line-height:2">Heading</h1>' +
      '<ul><li style="line-height:0.75">Item</li></ul>';

    Test.startTest();
    String rendered = PDFBuilderController.renderRichTextContentForPdf(
      source
    );
    Test.stopTest();

    Assert.isTrue(
      rendered.contains('<p style="line-height:25%;margin:0">Compact</p>'),
      'Compact unitless line height must convert to a percentage. Rendered: ' +
      rendered
    );
    Assert.isTrue(
      rendered.contains('<p>Unchanged</p>'),
      'Unstyled paragraphs must remain unchanged.'
    );
    Assert.isTrue(
      rendered.contains('<p style="line-height:225%">Expanded</p>'),
      'Expanded unitless line height must convert to a percentage.'
    );
    Assert.isTrue(
      rendered.contains('<p style="line-height:18px">Absolute</p>'),
      'Absolute line height must remain expressed in pixels.'
    );
    Assert.isTrue(
      rendered.contains('<h1 style="line-height:200%">Heading</h1>'),
      'Heading line height must convert to a percentage.'
    );
    Assert.isTrue(
      rendered.contains('<li style="line-height:75%">Item</li>'),
      'List item line height must convert to a percentage.'
    );
  }

  /**
   * @description Verifies a dynamic related list pushes later PDF bands without clipping.
   */
  @IsTest
  static void relatedListPushesFollowingPdfBandsDown() {
    Map<String, Object> relatedList = new Map<String, Object>{
      'id' => 'related-1',
      'type' => 'relatedList',
      'relatedListRelationshipName' => 'Items',
      'relatedListColumns' => new List<String>{ 'Name' },
      'styles' => new Map<String, Object>{
        'x' => 0,
        'y' => 100,
        'width' => 700,
        'height' => 100
      }
    };
    Map<String, Object> followingText = new Map<String, Object>{
      'id' => 'text-1',
      'type' => 'text',
      'content' => '<p>After related list</p>',
      'styles' => new Map<String, Object>{
        'x' => 0,
        'y' => 210,
        'width' => 700,
        'height' => 80
      }
    };
    Map<String, Object> bodyRegion = new Map<String, Object>{
      'id' => 'body-1',
      'styles' => new Map<String, Object>{
        'height' => 659,
        'padding' => 0,
        'borderWidth' => 0
      },
      'blocks' => new List<Object>{ relatedList, followingText }
    };
    Map<String, Object> model = new Map<String, Object>{
      'pagePadding' => 32,
      'showHeader' => true,
      'showBody' => true,
      'showFooter' => true,
      'repeatHeaderOnEachPage' => true,
      'repeatFooterOnEachPage' => true,
      'manualPageCount' => 0,
      'header' => new Map<String, Object>{
        'id' => 'header',
        'styles' => new Map<String, Object>{ 'height' => 100, 'width' => 500 },
        'blocks' => new List<Object>()
      },
      'body' => new Map<String, Object>{
        'layout' => 'one',
        'sections' => new List<Object>{ bodyRegion }
      },
      'footer' => new Map<String, Object>{
        'id' => 'footer',
        'styles' => new Map<String, Object>{ 'height' => 80 },
        'blocks' => new List<Object>()
      }
    };

    Test.startTest();
    String rendered = PDFBuilderController.renderTemplateJsonForPdf(
      JSON.serialize(model)
    );
    Test.stopTest();

    Assert.isTrue(
      rendered.contains('min-height:'),
      'Dynamic body must retain a minimum height.'
    );
    Assert.isTrue(
      rendered.contains('height:auto;'),
      'Dynamic body must grow with related rows.'
    );
    Assert.isFalse(
      rendered.contains('@page {'),
      'Body fragments must not inject page-level CSS.'
    );
    Assert.areEqual(
      110,
      PDFBuilderPdfPageController.pageTopMarginForRender,
      'Repeated header must reserve its configured height.'
    );
    Assert.areEqual(
      80,
      PDFBuilderPdfPageController.pageBottomMarginForRender,
      'Repeated footer must reserve its configured height.'
    );
    Assert.isNotNull(
      PDFBuilderPdfPageController.fixedHeaderHtmlForRender,
      'Repeated header markup must be prepared.'
    );
    Assert.isTrue(
      PDFBuilderPdfPageController.fixedHeaderHtmlForRender.contains(
        'width:500px'
      ),
      'A configured fixed-region width must be rendered.'
    );
    Assert.isTrue(
      PDFBuilderPdfPageController.fixedHeaderHtmlForRender.contains(
        'margin-left:auto;margin-right:auto'
      ),
      'A narrower fixed region must remain centered.'
    );
    Assert.isNotNull(
      PDFBuilderPdfPageController.fixedFooterHtmlForRender,
      'Repeated footer markup must be prepared.'
    );
    Assert.isTrue(
      rendered.contains('position:relative;left:0px;top:0px;'),
      'Dynamic content must use flow-relative positioning.'
    );
    Assert.isTrue(
      rendered.indexOf('[[DBRL|Items|Name|') <
      rendered.indexOf('After related list'),
      'Related-list token must remain before the following block.'
    );
    Assert.isTrue(
      rendered.contains('white-space:normal'),
      'Rich HTML source whitespace must collapse like it does in the builder.'
    );
    Assert.isFalse(
      rendered.contains('white-space:pre-wrap'),
      'Formatting newlines must not create visible blank lines.'
    );
  }

  /**
   * @description Verifies browser flex rows are converted for Visualforce PDF.
   */
  @IsTest
  static void convertsTwoColumnFlexRowsForPdf() {
    String source =
      '<div style="display:flex;align-items:center;justify-content:space-between;color:#fff;">' +
      '<div><span>Proposed investment</span><br><span>Aligned</span></div>' +
      '<div style="font-size:22px;font-weight:700;text-align:right;">100 EUR</div>' +
      '</div>';

    Test.startTest();
    String rendered = PDFBuilderController.renderRichTextContentForPdf(source);
    Test.stopTest();

    Assert.isFalse(
      rendered.contains('display:flex'),
      'Unsupported flexbox markup must not reach Flying Saucer.'
    );
    Assert.isTrue(
      rendered.contains('<table border="0"'),
      'The flex row must use a PDF-compatible table.'
    );
    Assert.isTrue(
      rendered.contains('text-align:right'),
      'The value column must retain its right alignment.'
    );
    Assert.isTrue(
      rendered.contains('100 EUR'),
      'The value must remain inside the converted row.'
    );
  }
}
