/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Supplies prepared PDF Builder markup and page geometry to Visualforce.
 */
public with sharing class PDFBuilderPdfPageController {
  public static String bodyHtmlForRender;
  public static String fixedHeaderHtmlForRender;
  public static String fixedFooterHtmlForRender;
  public static Integer pageTopMarginForRender;
  public static Integer pageRightMarginForRender;
  public static Integer pageBottomMarginForRender;
  public static Integer pageLeftMarginForRender;
  public static Integer pageContentWidthForRender;
  public static String pageBackgroundForRender;

  public String bodyHtml { get; private set; }
  public String fixedHeaderHtml { get; private set; }
  public String fixedFooterHtml { get; private set; }
  public Integer pageTopMargin { get; private set; }
  public Integer pageRightMargin { get; private set; }
  public Integer pageBottomMargin { get; private set; }
  public Integer pageLeftMargin { get; private set; }
  public Integer pageContentWidth { get; private set; }
  public String pageBackground { get; private set; }
  public Boolean hasFixedHeader { get; private set; }
  public Boolean hasFixedFooter { get; private set; }

  /**
   * Initializes the Visualforce render state from the current Apex transaction.
   */
  public PDFBuilderPdfPageController() {
    if (!String.isBlank(bodyHtmlForRender)) {
      bodyHtml = bodyHtmlForRender;
    } else {
      String templateIdValue = ApexPages.currentPage()
        .getParameters()
        .get('templateId');
      String recordIdValue = ApexPages.currentPage()
        .getParameters()
        .get('recordId');

      if (String.isBlank(templateIdValue) || String.isBlank(recordIdValue)) {
        bodyHtml = 'Template and record are required.';
      } else {
        bodyHtml = PDFBuilderController.renderTemplateBodyHtmlForPdf(
          (Id) templateIdValue,
          (Id) recordIdValue
        );
      }
    }

    bodyHtml = PDFBuilderHtmlSanitizer.sanitize(bodyHtml);
    fixedHeaderHtml = PDFBuilderHtmlSanitizer.sanitize(
      fixedHeaderHtmlForRender
    );
    fixedFooterHtml = PDFBuilderHtmlSanitizer.sanitize(
      fixedFooterHtmlForRender
    );
    pageTopMargin = pageTopMarginForRender == null ? 0 : pageTopMarginForRender;
    pageRightMargin = pageRightMarginForRender == null
      ? 0
      : pageRightMarginForRender;
    pageBottomMargin = pageBottomMarginForRender == null
      ? 0
      : pageBottomMarginForRender;
    pageLeftMargin = pageLeftMarginForRender == null
      ? 0
      : pageLeftMarginForRender;
    pageContentWidth = pageContentWidthForRender == null
      ? PDFBuilderConfiguration.getSettings().pageWidth
      : pageContentWidthForRender;
    pageBackground = normalizePageBackground(pageBackgroundForRender);
    hasFixedHeader = !String.isBlank(fixedHeaderHtml);
    hasFixedFooter = !String.isBlank(fixedFooterHtml);
  }

  /**
   * Restricts the value interpolated into the Visualforce style sheet to the
   * six-digit hexadecimal format emitted by the builder color control.
   */
  @TestVisible
  private static String normalizePageBackground(String candidate) {
    if (
      !String.isBlank(candidate) &&
      Pattern.matches('^#[0-9A-Fa-f]{6}$', candidate)
    ) {
      return candidate;
    }
    return '#ffffff';
  }
}
