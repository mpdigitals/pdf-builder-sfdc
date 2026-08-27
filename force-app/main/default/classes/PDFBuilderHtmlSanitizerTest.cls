/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Verifies PDF Builder's persisted and rendered HTML trust boundary.
 */
@IsTest
private class PDFBuilderHtmlSanitizerTest {
  @IsTest
  static void preservesSupportedRichDocumentMarkup() {
    String trustedMarkup =
      '<div class="page" style="color:#123456;background-image:url(https://example.com/logo.png)">' +
      '<h1>Proposal</h1><p><strong>Important</strong> <em>content</em></p>' +
      '<table><tr><td><img src="data:image/png;base64,AAAA" /></td></tr></table>' +
      '<ul><li>First item</li></ul></div>';

    Test.startTest();
    String result = PDFBuilderHtmlSanitizer.sanitize(trustedMarkup);
    Test.stopTest();

    Assert.areEqual(
      trustedMarkup,
      result,
      'Supported layout, rich text, tables and image sources must be preserved.'
    );
  }

  @IsTest
  static void removesExecutableElementsAndAttributes() {
    String unsafeMarkup =
      '<div onclick="alert(1)"><script>alert(1)</script>' +
      '<iframe srcdoc="<script>alert(2)</script>"></iframe>' +
      '<img src="https://example.com/logo.png" onerror=alert(3) />' +
      '<form action="https://example.com"><input value="secret" /></form>' +
      '<svg onload="alert(4)"><circle /></svg><p>Safe text</p></div>';

    Test.startTest();
    String result = PDFBuilderHtmlSanitizer.sanitize(unsafeMarkup);
    Test.stopTest();

    Assert.isFalse(
      result.containsIgnoreCase('<script'),
      'Scripts must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('<iframe'),
      'Iframes must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('<form'),
      'Forms must be removed.'
    );
    Assert.isFalse(result.containsIgnoreCase('<svg'), 'SVG must be removed.');
    Assert.isFalse(
      result.containsIgnoreCase('onclick='),
      'Event handlers must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('onerror='),
      'Unquoted event handlers must be removed.'
    );
    Assert.isTrue(
      result.contains('<p>Safe text</p>'),
      'Ordinary document text must remain.'
    );
  }

  @IsTest
  static void neutralizesActiveUrlsAndCss() {
    String unsafeMarkup =
      '<a href="javascript:alert(1)">Link</a>' +
      '<a href="java&#x73;cript:alert(1)">Encoded link</a>' +
      '<a href="java\nscript:alert(1)">Whitespace link</a>' +
      '<img src=vbscript:alert(2) />' +
      '<div style="width:expression(alert(3));background:url(javascript:alert(4));behavior:url(x)">Text</div>' +
      '<style>@import "https://evil.example/x.css"; .safe{color:red}.bad{-moz-binding:url(x)}</style>';

    Test.startTest();
    String result = PDFBuilderHtmlSanitizer.sanitize(unsafeMarkup);
    Test.stopTest();

    Assert.isFalse(
      result.containsIgnoreCase('javascript:'),
      'JavaScript URLs must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('java&#x73;cript:'),
      'Encoded JavaScript URLs must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('vbscript:'),
      'VBScript URLs must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('expression('),
      'CSS expressions must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('@import'),
      'Remote CSS imports must be removed.'
    );
    Assert.isFalse(
      result.containsIgnoreCase('-moz-binding'),
      'Executable CSS bindings must be removed.'
    );
    Assert.isTrue(
      result.contains('.safe{color:red}'),
      'Safe stylesheet rules must remain.'
    );
  }

  @IsTest
  static void sanitizesGeneratedHtmlBeforePersistence() {
    Test.startTest();
    Id templateId = PDFBuilderController.saveTemplate(
      null,
      'Sanitized Proposal',
      'Account',
      '{}',
      '<main><p onmouseover="alert(1)">Proposal</p><script>alert(2)</script></main>'
    );
    Test.stopTest();

    PDFBuilderTemplate__c storedTemplate = [
      SELECT GeneratedHtml__c
      FROM PDFBuilderTemplate__c
      WHERE Id = :templateId
      WITH USER_MODE
    ];
    Assert.areEqual(
      '<main><p>Proposal</p></main>',
      storedTemplate.GeneratedHtml__c,
      'Executable markup must never be stored in GeneratedHtml__c.'
    );
  }

  @IsTest
  static void sanitizesLegacyHtmlAtTheVisualforceBoundary() {
    PDFBuilderPdfPageController.bodyHtmlForRender = '<main><img src="x" onerror="alert(1)" /><strong>Body</strong></main>';
    PDFBuilderPdfPageController.fixedHeaderHtmlForRender = '<header><script>alert(2)</script><b>Header</b></header>';
    PDFBuilderPdfPageController.fixedFooterHtmlForRender = '<footer style="width:expression(alert(3))">Footer</footer>';

    Test.startTest();
    PDFBuilderPdfPageController controller = new PDFBuilderPdfPageController();
    Test.stopTest();

    Assert.isFalse(
      controller.bodyHtml.containsIgnoreCase('onerror='),
      'Body events must be removed.'
    );
    Assert.isFalse(
      controller.fixedHeaderHtml.containsIgnoreCase('<script'),
      'Header scripts must be removed.'
    );
    Assert.isFalse(
      controller.fixedFooterHtml.containsIgnoreCase('expression('),
      'Footer CSS expressions must be removed.'
    );
    Assert.isTrue(
      controller.bodyHtml.contains('<strong>Body</strong>'),
      'Valid rich text must remain.'
    );
  }
}
