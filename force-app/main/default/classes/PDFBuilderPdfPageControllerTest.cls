/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Verifies Visualforce PDF page state propagation.
 */
@IsTest
private class PDFBuilderPdfPageControllerTest {
  /**
   * @description Verifies fixed regions and margins are copied into the Visualforce controller.
   */
  @IsTest
  static void initializesFixedPageRegions() {
    Test.setCurrentPage(Page.PDFBuilderPdf);
    PDFBuilderPdfPageController.bodyHtmlForRender = '<main>Body</main>';
    PDFBuilderPdfPageController.fixedHeaderHtmlForRender = '<div>Header</div>';
    PDFBuilderPdfPageController.fixedFooterHtmlForRender = '<div>Footer</div>';
    PDFBuilderPdfPageController.pageTopMarginForRender = 110;
    PDFBuilderPdfPageController.pageRightMarginForRender = 32;
    PDFBuilderPdfPageController.pageBottomMarginForRender = 90;
    PDFBuilderPdfPageController.pageLeftMarginForRender = 32;
    PDFBuilderPdfPageController.pageContentWidthForRender = 730;
    PDFBuilderPdfPageController.pageBackgroundForRender = '#f4f1e8';

    Test.startTest();
    PDFBuilderPdfPageController controller = new PDFBuilderPdfPageController();
    Test.stopTest();

    Assert.areEqual(
      '<main>Body</main>',
      controller.bodyHtml,
      'Controller must expose the prepared body.'
    );
    Assert.areEqual(
      '<div>Header</div>',
      controller.fixedHeaderHtml,
      'Controller must expose the fixed header.'
    );
    Assert.areEqual(
      '<div>Footer</div>',
      controller.fixedFooterHtml,
      'Controller must expose the fixed footer.'
    );
    Assert.areEqual(
      110,
      controller.pageTopMargin,
      'Controller must expose the top page margin.'
    );
    Assert.areEqual(
      32,
      controller.pageRightMargin,
      'Controller must expose the right page margin.'
    );
    Assert.areEqual(
      90,
      controller.pageBottomMargin,
      'Controller must expose the bottom page margin.'
    );
    Assert.areEqual(
      32,
      controller.pageLeftMargin,
      'Controller must expose the left page margin.'
    );
    Assert.areEqual(
      730,
      controller.pageContentWidth,
      'Controller must expose the content width.'
    );
    Assert.areEqual(
      '#f4f1e8',
      controller.pageBackground,
      'Controller must expose the full-page background.'
    );
    Assert.isTrue(
      controller.hasFixedHeader,
      'Controller must identify a fixed header.'
    );
    Assert.isTrue(
      controller.hasFixedFooter,
      'Controller must identify a fixed footer.'
    );
  }

  /**
   * @description Verifies the missing-parameter fallback used by direct Visualforce requests.
   */
  @IsTest
  static void handlesMissingRequestParameters() {
    Test.setCurrentPage(Page.PDFBuilderPdf);
    PDFBuilderPdfPageController.bodyHtmlForRender = null;
    PDFBuilderPdfPageController.fixedHeaderHtmlForRender = null;
    PDFBuilderPdfPageController.fixedFooterHtmlForRender = null;
    PDFBuilderPdfPageController.pageTopMarginForRender = null;
    PDFBuilderPdfPageController.pageRightMarginForRender = null;
    PDFBuilderPdfPageController.pageBottomMarginForRender = null;
    PDFBuilderPdfPageController.pageLeftMarginForRender = null;
    PDFBuilderPdfPageController.pageContentWidthForRender = null;
    PDFBuilderPdfPageController.pageBackgroundForRender = null;

    Test.startTest();
    PDFBuilderPdfPageController controller = new PDFBuilderPdfPageController();
    Test.stopTest();

    Assert.areEqual(
      'Template and record are required.',
      controller.bodyHtml,
      'Missing parameters must produce a safe body.'
    );
    Assert.areEqual(
      0,
      controller.pageTopMargin,
      'Missing page geometry must default to zero margins.'
    );
    Assert.areEqual(
      794,
      controller.pageContentWidth,
      'Missing page width must use configured A4 width.'
    );
    Assert.areEqual(
      '#ffffff',
      controller.pageBackground,
      'Missing page background must remain white.'
    );
    Assert.isFalse(
      controller.hasFixedHeader,
      'Missing header markup must disable the fixed header.'
    );
    Assert.isFalse(
      controller.hasFixedFooter,
      'Missing footer markup must disable the fixed footer.'
    );
  }
}
