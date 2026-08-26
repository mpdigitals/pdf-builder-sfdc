/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Resolves deployable settings for PDF Builder and its PDF renderer.
 */
public inherited sharing class PDFBuilderConfiguration {
  private static final String SETTINGS_RECORD_DEVELOPER_NAME = 'Default';
  private static Settings cachedSettings;

  /**
   * @description Raised when the authoritative Custom Metadata configuration
   * is incomplete or invalid.
   *
   * @author mpdigitals
   */
  public class ConfigurationException extends Exception {
  }

  /**
   * @description Immutable-by-convention configuration exposed to Apex and LWC consumers.
   *
   * @author mpdigitals
   */
  public class Settings {
    @AuraEnabled
    public Integer longTextLimit;
    @AuraEnabled
    public Integer pageWidth;
    @AuraEnabled
    public Integer pageHeight;
    @AuraEnabled
    public Integer defaultPagePadding;
    @AuraEnabled
    public Integer defaultElementPadding;
    @AuraEnabled
    public Integer defaultHeaderHeight;
    @AuraEnabled
    public Integer defaultFooterHeight;
    @AuraEnabled
    public Integer maxPages;
    @AuraEnabled
    public Integer templateQueryLimit;
    @AuraEnabled
    public Integer imageQueryLimit;
    @AuraEnabled
    public Integer maxClientImageBase64Length;
    @AuraEnabled
    public Integer pdfContentWidth;
    @AuraEnabled
    public Integer pdfCanvasWidth;
    @AuraEnabled
    public Decimal pdfFontScale;
    @AuraEnabled
    public Integer pdfImageYOffset;
    @AuraEnabled
    public Integer pdfGridColumns;
    @AuraEnabled
    public Integer pdfGridGap;
    @AuraEnabled
    public Integer pdfGridRowHeight;
    @AuraEnabled
    public Integer dragGridSize;
    @AuraEnabled
    public Integer inputDebounceMilliseconds;
    @AuraEnabled
    public Boolean includeCustomObjects;
    @AuraEnabled
    public List<String> preferredObjects;
    @AuraEnabled
    public List<String> supportedImageTypes;
  }

  /**
   * @description Returns cached settings populated from the authoritative
   * Custom Metadata record.
   *
   * @return Resolved PDF Builder settings.
   */
  public static Settings getSettings() {
    if (cachedSettings == null) {
      cachedSettings = buildSettings(
        PDFBuilderSettings__mdt.getInstance(SETTINGS_RECORD_DEVELOPER_NAME)
      );
    }
    return cachedSettings;
  }

  /**
   * @description Maps Custom Metadata values to a validated settings object.
   *
   * @param metadataRecord Default Custom Metadata record.
   * @return Validated settings.
   */
  @TestVisible
  private static Settings buildSettings(
    PDFBuilderSettings__mdt metadataRecord
  ) {
    if (metadataRecord == null) {
      throw new ConfigurationException(
        'PDF Builder requires the PDFBuilderSettings.Default Custom Metadata record.'
      );
    }

    Settings settings = new Settings();
    settings.longTextLimit = requiredPositiveInteger(
      metadataRecord?.LongTextLimit__c,
      'Long Text Limit'
    );
    settings.pageWidth = requiredPositiveInteger(
      metadataRecord?.PageWidthPx__c,
      'Page Width Px'
    );
    settings.pageHeight = requiredPositiveInteger(
      metadataRecord?.PageHeightPx__c,
      'Page Height Px'
    );
    settings.defaultPagePadding = requiredNonNegativeInteger(
      metadataRecord?.DefaultPagePaddingPx__c,
      'Default Page Padding Px'
    );
    settings.defaultElementPadding = requiredNonNegativeInteger(
      metadataRecord?.DefaultElementPaddingPx__c,
      'Default Element Padding Px'
    );
    settings.defaultHeaderHeight = requiredPositiveInteger(
      metadataRecord?.DefaultHeaderHeightPx__c,
      'Default Header Height Px'
    );
    settings.defaultFooterHeight = requiredPositiveInteger(
      metadataRecord?.DefaultFooterHeightPx__c,
      'Default Footer Height Px'
    );
    settings.maxPages = requiredPositiveInteger(
      metadataRecord?.MaxPages__c,
      'Maximum Pages'
    );
    settings.templateQueryLimit = requiredBoundedInteger(
      metadataRecord?.TemplateQueryLimit__c,
      'Template Query Limit',
      2000
    );
    settings.imageQueryLimit = requiredBoundedInteger(
      metadataRecord?.ImageQueryLimit__c,
      'Image Query Limit',
      200
    );
    settings.maxClientImageBase64Length = requiredPositiveInteger(
      metadataRecord?.MaxClientImageBase64__c,
      'Maximum Client Image Base64'
    );
    settings.pdfContentWidth = requiredPositiveInteger(
      metadataRecord?.PdfContentWidthPx__c,
      'PDF Content Width Px'
    );
    settings.pdfCanvasWidth = requiredPositiveInteger(
      metadataRecord?.PdfCanvasWidthPx__c,
      'PDF Canvas Width Px'
    );
    settings.pdfFontScale = requiredPositiveDecimal(
      metadataRecord?.PdfFontScale__c,
      'PDF Font Scale'
    );
    settings.pdfImageYOffset = requiredNonNegativeInteger(
      metadataRecord?.PdfImageYOffsetPx__c,
      'PDF Image Y Offset Px'
    );
    settings.pdfGridColumns = requiredPositiveInteger(
      metadataRecord?.PdfGridColumns__c,
      'PDF Grid Columns'
    );
    settings.pdfGridGap = requiredNonNegativeInteger(
      metadataRecord?.PdfGridGapPx__c,
      'PDF Grid Gap Px'
    );
    settings.pdfGridRowHeight = requiredPositiveInteger(
      metadataRecord?.PdfGridRowHeightPx__c,
      'PDF Grid Row Height Px'
    );
    settings.dragGridSize = requiredPositiveInteger(
      metadataRecord?.DragGridSizePx__c,
      'Drag Grid Size Px'
    );
    settings.inputDebounceMilliseconds = requiredNonNegativeInteger(
      metadataRecord?.InputDebounceMs__c,
      'Input Debounce Ms'
    );
    settings.includeCustomObjects =
      metadataRecord?.IncludeCustomObjects__c != false;
    settings.preferredObjects = parseConfiguredList(
      metadataRecord?.PreferredObjectApiNames__c,
      'Preferred Objects',
      false
    );
    settings.supportedImageTypes = parseConfiguredList(
      metadataRecord?.SupportedImageTypes__c,
      'Supported Image Types',
      true
    );
    return settings;
  }

  /**
   * @description Resolves a required strictly positive integer value.
   *
   * @param configuredValue Custom Metadata numeric value.
   * @param fieldLabel Configuration field label.
   * @return Configured integer.
   */
  private static Integer requiredPositiveInteger(
    Decimal configuredValue,
    String fieldLabel
  ) {
    if (configuredValue == null || configuredValue <= 0) {
      throw invalidValue(fieldLabel, 'must be greater than zero');
    }
    return configuredValue.intValue();
  }

  /**
   * @description Resolves a required non-negative integer value.
   *
   * @param configuredValue Custom Metadata numeric value.
   * @param fieldLabel Configuration field label.
   * @return Configured integer.
   */
  private static Integer requiredNonNegativeInteger(
    Decimal configuredValue,
    String fieldLabel
  ) {
    if (configuredValue == null || configuredValue < 0) {
      throw invalidValue(fieldLabel, 'must be zero or greater');
    }
    return configuredValue.intValue();
  }

  /**
   * @description Resolves a numeric value within an inclusive range.
   *
   * @param configuredValue Custom Metadata numeric value.
   * @param fieldLabel Configuration field label.
   * @param maximum Maximum accepted value.
   * @return Configured integer.
   */
  private static Integer requiredBoundedInteger(
    Decimal configuredValue,
    String fieldLabel,
    Integer maximum
  ) {
    if (configuredValue == null) {
      throw invalidValue(fieldLabel, 'is required');
    }
    Integer candidate = configuredValue.intValue();
    if (candidate < 1 || candidate > maximum) {
      throw invalidValue(fieldLabel, 'must be between 1 and ' + maximum);
    }
    return candidate;
  }

  /**
   * @description Resolves a required strictly positive decimal value.
   *
   * @param configuredValue Custom Metadata numeric value.
   * @param fieldLabel Configuration field label.
   * @return Configured decimal.
   */
  private static Decimal requiredPositiveDecimal(
    Decimal configuredValue,
    String fieldLabel
  ) {
    if (configuredValue == null || configuredValue <= 0) {
      throw invalidValue(fieldLabel, 'must be greater than zero');
    }
    return configuredValue;
  }

  /**
   * @description Parses a comma, semicolon, or line-separated setting while
   * preserving configured order.
   *
   * @param configuredValue Custom Metadata text value.
   * @param fieldLabel Configuration field label.
   * @param uppercase Whether values must be normalized to uppercase.
   * @return Unique normalized values.
   */
  private static List<String> parseConfiguredList(
    String configuredValue,
    String fieldLabel,
    Boolean uppercase
  ) {
    if (String.isBlank(configuredValue)) {
      throw invalidValue(fieldLabel, 'must contain at least one value');
    }

    List<String> source = configuredValue
      .replace('\r', '\n')
      .replace(';', ',')
      .replace('\n', ',')
      .split(',');
    List<String> values = new List<String>();
    Set<String> seenValues = new Set<String>();

    for (String sourceValue : source) {
      String normalizedValue = normalizeConfiguredValue(sourceValue, uppercase);
      if (normalizedValue == '' || seenValues.contains(normalizedValue)) {
        continue;
      }
      seenValues.add(normalizedValue);
      values.add(normalizedValue);
    }
    if (values.isEmpty()) {
      throw invalidValue(fieldLabel, 'must contain at least one value');
    }
    return values;
  }

  /**
   * @description Normalizes one configured list value.
   *
   * @param sourceValue Raw configured value.
   * @param uppercase Whether the value must be normalized to uppercase.
   * @return Trimmed normalized value.
   */
  private static String normalizeConfiguredValue(
    String sourceValue,
    Boolean uppercase
  ) {
    String normalizedValue = sourceValue == null ? '' : sourceValue.trim();
    return uppercase ? normalizedValue.toUpperCase() : normalizedValue;
  }

  /**
   * @description Creates a consistent configuration validation exception.
   *
   * @param fieldLabel Configuration field label.
   * @param requirement Expected value requirement.
   * @return Configuration exception with an actionable message.
   */
  private static ConfigurationException invalidValue(
    String fieldLabel,
    String requirement
  ) {
    return new ConfigurationException(
      'PDF Builder setting "' + fieldLabel + '" ' + requirement + '.'
    );
  }
}
