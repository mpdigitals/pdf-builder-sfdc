/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Establishes the trust boundary for template HTML rendered by
 * PDF Builder. The builder intentionally supports rich HTML and inline CSS,
 * so output cannot be HTML-escaped wholesale. This class removes executable
 * markup while preserving the formatting required by browser and PDF renders.
 */
public inherited sharing class PDFBuilderHtmlSanitizer {
  private static final List<String> BLOCKED_ELEMENTS = new List<String>{
    'script',
    'iframe',
    'object',
    'embed',
    'applet',
    'frame',
    'frameset',
    'form',
    'input',
    'button',
    'textarea',
    'select',
    'option',
    'base',
    'meta',
    'link',
    'svg',
    'math'
  };

  private PDFBuilderHtmlSanitizer() {
  }

  /**
   * Removes executable HTML, event handlers, active URL schemes and dangerous
   * CSS constructs. Empty and null input are normalized to an empty string.
   */
  public static String sanitize(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    String sanitized = html.replaceAll('(?is)<!--.*?-->', '');

    for (String elementName : BLOCKED_ELEMENTS) {
      sanitized = removeElement(sanitized, elementName);
    }

    // Event handlers and browser-controlled document fragments are never
    // required by a PDF Builder template.
    sanitized = sanitized.replaceAll(
      '(?is)\\s+on[a-z0-9_:-]+\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)',
      ''
    );
    sanitized = sanitized.replaceAll(
      '(?is)\\s+srcdoc\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s>]+)',
      ''
    );

    sanitized = neutralizeActiveUrlSchemes(sanitized);
    sanitized = sanitizeCss(sanitized);
    return sanitized;
  }

  private static String removeElement(String html, String elementName) {
    String result = html;
    String pairedElementPattern =
      '(?is)<' +
      elementName +
      '\\b[^>]*>.*?</' +
      elementName +
      '\\s*>';
    String previous;

    // Repeat to cover nested blocked elements without relying on recursive
    // regular expressions, which Apex does not support.
    do {
      previous = result;
      result = result.replaceAll(pairedElementPattern, '');
    } while (result != previous);

    result = result.replaceAll('(?is)</?' + elementName + '\\b[^>]*>', '');
    return result;
  }

  private static String neutralizeActiveUrlSchemes(String html) {
    String attributeName = '(?:href|src|xlink:href|action|formaction)';
    String sanitized = sanitizeUrlAttributes(
      html,
      '(?is)(\\s+' + attributeName + '\\s*=\\s*)(")([^"]*)(")'
    );
    sanitized = sanitizeUrlAttributes(
      sanitized,
      '(?is)(\\s+' + attributeName + '\\s*=\\s*)(\')([^\']*)(\')'
    );
    return sanitizeUrlAttributes(
      sanitized,
      '(?is)(\\s+' + attributeName + '\\s*=\\s*)()([^\\s>]+)()'
    );
  }

  private static String sanitizeUrlAttributes(String html, String regex) {
    Matcher matcher = Pattern.compile(regex).matcher(html);
    Integer cursor = 0;
    String result = '';

    while (matcher.find()) {
      result += html.substring(cursor, matcher.start());
      String value = matcher.group(3);
      result += matcher.group(1) + matcher.group(2);
      result += isActiveUrl(value) ? '#' : value;
      result += matcher.group(4);
      cursor = matcher.end();
    }

    return cursor == 0 ? html : result + html.substring(cursor);
  }

  private static Boolean isActiveUrl(String value) {
    String canonicalValue = value == null ? '' : value.unescapeHtml4();
    canonicalValue = canonicalValue
      .replaceAll('[\\x00-\\x20\\x7f]+', '')
      .toLowerCase();
    return canonicalValue.startsWith('javascript:') ||
      canonicalValue.startsWith('vbscript:') ||
      (canonicalValue.startsWith('data:') &&
      !Pattern.matches(
        '^data:image/(?:png|jpeg|gif|webp|bmp);base64,[a-z0-9+/=]+$',
        canonicalValue
      ));
  }

  private static String sanitizeCss(String html) {
    String sanitized = removeUnsafeStyleElements(html);
    sanitized = removeUnsafeStyleAttributes(sanitized);
    sanitized = sanitized.replaceAll('(?is)expression\\s*\\([^)]*\\)', '');
    sanitized = sanitized.replaceAll(
      '(?is)url\\s*\\(\\s*["\']?\\s*(?:javascript|vbscript|data\\s*:\\s*text\\s*/\\s*html)[^)]*\\)',
      'none'
    );
    sanitized = sanitized.replaceAll('(?is)@import\\s+[^;]+;?', '');
    sanitized = sanitized.replaceAll(
      '(?is)(?:behavior|-moz-binding)\\s*:[^;"\']+;?',
      ''
    );
    return sanitized;
  }

  private static String removeUnsafeStyleElements(String html) {
    Pattern stylePattern = Pattern.compile(
      '(?is)<style\\b([^>]*)>(.*?)</style\\s*>'
    );
    Matcher matcher = stylePattern.matcher(html);
    Integer cursor = 0;
    String result = '';

    while (matcher.find()) {
      result += html.substring(cursor, matcher.start());
      if (!containsActiveCss(matcher.group(2))) {
        result += matcher.group(0);
      }
      cursor = matcher.end();
    }
    return cursor == 0 ? html : result + html.substring(cursor);
  }

  private static String removeUnsafeStyleAttributes(String html) {
    return removeUnsafeStyleAttributes(
      removeUnsafeStyleAttributes(
        removeUnsafeStyleAttributes(
          html,
          '(?is)(\\s+style\\s*=\\s*)(")([^"]*)(")'
        ),
        '(?is)(\\s+style\\s*=\\s*)(\')([^\']*)(\')'
      ),
      '(?is)(\\s+style\\s*=\\s*)()([^\\s>]+)()'
    );
  }

  private static String removeUnsafeStyleAttributes(String html, String regex) {
    Matcher matcher = Pattern.compile(regex).matcher(html);
    Integer cursor = 0;
    String result = '';

    while (matcher.find()) {
      result += html.substring(cursor, matcher.start());
      if (!containsActiveCss(matcher.group(3))) {
        result += matcher.group(0);
      }
      cursor = matcher.end();
    }
    return cursor == 0 ? html : result + html.substring(cursor);
  }

  private static Boolean containsActiveCss(String css) {
    String canonicalCss = decodeCssEscapes(
        css == null ? '' : css.unescapeHtml4()
      )
      .replaceAll('[\\x00-\\x20\\x7f]+', '')
      .toLowerCase();
    return canonicalCss.contains('expression(') ||
      canonicalCss.contains('javascript:') ||
      canonicalCss.contains('vbscript:') ||
      canonicalCss.contains('data:text/html') ||
      canonicalCss.contains('@import') ||
      canonicalCss.contains('behavior:') ||
      canonicalCss.contains('-moz-binding:');
  }

  /**
   * Canonicalizes CSS escape sequences before security decisions. CSS permits
   * one to six hexadecimal digits followed by optional whitespace.
   */
  private static String decodeCssEscapes(String value) {
    String result = '';
    Integer index = 0;

    while (index < value.length()) {
      if (value.substring(index, index + 1) != '\\') {
        result += value.substring(index, index + 1);
        index++;
        continue;
      }

      Integer cursor = index + 1;
      String hexadecimal = '';
      while (
        cursor < value.length() &&
        hexadecimal.length() < 6 &&
        isHexadecimal(value.substring(cursor, cursor + 1))
      ) {
        hexadecimal += value.substring(cursor, cursor + 1);
        cursor++;
      }

      if (hexadecimal != '') {
        Integer codePoint = parseHexadecimal(hexadecimal);
        result += codePoint <= 127
          ? String.fromCharArray(new List<Integer>{ codePoint })
          : ' ';
        if (
          cursor < value.length() &&
          Pattern.matches('\\s', value.substring(cursor, cursor + 1))
        ) {
          cursor++;
        }
        index = cursor;
      } else if (cursor < value.length()) {
        result += value.substring(cursor, cursor + 1);
        index = cursor + 1;
      } else {
        index++;
      }
    }
    return result;
  }

  private static Boolean isHexadecimal(String character) {
    return Pattern.matches('[0-9A-Fa-f]', character);
  }

  private static Integer parseHexadecimal(String value) {
    String digits = '0123456789abcdef';
    Integer result = 0;
    String normalized = value.toLowerCase();
    for (Integer index = 0; index < normalized.length(); index++) {
      result =
        (result * 16) + digits.indexOf(normalized.substring(index, index + 1));
    }
    return result;
  }
}
