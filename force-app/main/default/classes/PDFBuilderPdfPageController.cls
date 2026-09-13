/**
 * Visualforce page-state controller for PDF Builder output.
 *
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

  /** @description Sanitized document body rendered by the Visualforce page. */
  public String bodyHtml { get; private set; }
  /** @description Sanitized fixed header rendered by the Visualforce page. */
  public String fixedHeaderHtml { get; private set; }
  /** @description Sanitized fixed footer rendered by the Visualforce page. */
  public String fixedFooterHtml { get; private set; }
  /** @description Resolved top page margin in pixels. */
  public Integer pageTopMargin { get; private set; }
  /** @description Resolved right page margin in pixels. */
  public Integer pageRightMargin { get; private set; }
  /** @description Resolved bottom page margin in pixels. */
  public Integer pageBottomMargin { get; private set; }
  /** @description Resolved left page margin in pixels. */
  public Integer pageLeftMargin { get; private set; }
  /** @description Resolved content width in pixels. */
  public Integer pageContentWidth { get; private set; }
  /** @description Validated page background color. */
  public String pageBackground { get; private set; }
  /** @description Whether a fixed header is available. */
  public Boolean hasFixedHeader { get; private set; }
  /** @description Whether a fixed footer is available. */
  public Boolean hasFixedFooter { get; private set; }

  /**
   * @description Initializes the Visualforce render state from the current Apex transaction.
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
   * @description Restricts the value interpolated into the Visualforce style sheet to the
   * six-digit hexadecimal format emitted by the builder color control.
   * @param candidate Requested color value.
   * @return A validated color literal, or white.
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
