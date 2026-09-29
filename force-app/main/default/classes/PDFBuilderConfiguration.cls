/**
 * Deployable configuration provider for PDF Builder.
 *
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
    public Integer relatedListQueryLimit;
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
    public Boolean aiWizardEnabled;
    @AuraEnabled
    public String aiModelApiName;
    @AuraEnabled
    public String aiProviderLabel;
    @AuraEnabled
    public String aiUnavailableMessage;
    @AuraEnabled
    public String aiExtensionPackageVersionId;
    @AuraEnabled
    public String aiSetupDocumentationUrl;
    public String aiPromptInstructions;
    @AuraEnabled
    public Integer aiMaxPromptLength;
    @AuraEnabled
    public Integer aiMaxContextLength;
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
      if (cachedSettings.aiWizardEnabled) {
        cachedSettings.aiPromptInstructions = requiredText(
          loadAIPromptInstructions(),
          'AI Prompt Instructions'
        );
      }
    }
    return cachedSettings;
  }

  /**
   * @description Loads the complete AI system instructions. Custom Metadata
   * static accessors truncate Long Text Area values, so this field must be
   * queried explicitly.
   *
   * @return Full AI prompt instructions from the Default settings record.
   */
  private static String loadAIPromptInstructions() {
    List<PDFBuilderSettings__mdt> records = [
      SELECT AIPromptInstructions__c
      FROM PDFBuilderSettings__mdt
      WHERE DeveloperName = :SETTINGS_RECORD_DEVELOPER_NAME
      WITH USER_MODE
      LIMIT 1
    ];
    return records.isEmpty() ? null : records[0].AIPromptInstructions__c;
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
    settings.relatedListQueryLimit = requiredBoundedInteger(
      metadataRecord?.RelatedListQueryLimit__c,
      'Related List Query Limit',
      2000
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
    settings.aiWizardEnabled = metadataRecord?.EnableAIWizard__c == true;
    settings.aiUnavailableMessage = requiredText(
      metadataRecord?.AIUnavailableMessage__c,
      'AI Unavailable Message'
    );
    settings.aiModelApiName = optionalText(metadataRecord?.AIModelApiName__c);
    settings.aiProviderLabel = optionalText(metadataRecord?.AIProviderLabel__c);
    settings.aiExtensionPackageVersionId = optionalText(
      metadataRecord?.AIExtensionPackageVersionId__c
    );
    settings.aiSetupDocumentationUrl = optionalText(
      metadataRecord?.AISetupDocumentationUrl__c
    );
    settings.aiPromptInstructions = optionalText(
      metadataRecord?.AIPromptInstructions__c
    );
    settings.aiMaxPromptLength = requiredBoundedInteger(
      metadataRecord?.AIMaxPromptLength__c,
      'AI Maximum Prompt Length',
      32000
    );
    settings.aiMaxContextLength = requiredBoundedInteger(
      metadataRecord?.AIMaxContextLength__c,
      'AI Maximum Context Length',
      100000
    );
    if (settings.aiWizardEnabled) {
      settings.aiModelApiName = requiredText(
        settings.aiModelApiName,
        'AI Model API Name'
      );
      settings.aiProviderLabel = requiredText(
        settings.aiProviderLabel,
        'AI Provider Label'
      );
      settings.aiExtensionPackageVersionId = requiredPackageVersionId(
        settings.aiExtensionPackageVersionId,
        'AI Extension Package Version ID'
      );
      settings.aiSetupDocumentationUrl = requiredHttpsUrl(
        settings.aiSetupDocumentationUrl,
        'AI Setup Documentation URL'
      );
      settings.aiPromptInstructions = requiredText(
        settings.aiPromptInstructions,
        'AI Prompt Instructions'
      );
    }
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
   * @description Validates an installable Salesforce subscriber package version ID.
   */
  private static String requiredPackageVersionId(
    String configuredValue,
    String fieldLabel
  ) {
    String value = requiredText(configuredValue, fieldLabel);
    if (!Pattern.matches('^04t[A-Za-z0-9]{12}([A-Za-z0-9]{3})?$', value)) {
      throw invalidValue(fieldLabel, 'must be a 15 or 18 character 04t ID');
    }
    return value;
  }

  /**
   * @description Restricts externally rendered documentation links to HTTPS.
   */
  private static String requiredHttpsUrl(
    String configuredValue,
    String fieldLabel
  ) {
    String value = requiredText(configuredValue, fieldLabel);
    if (!value.toLowerCase().startsWith('https://')) {
      throw invalidValue(fieldLabel, 'must use HTTPS');
    }
    return value;
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
   * @description Resolves a required trimmed text setting.
   *
   * @param configuredValue Custom Metadata text value.
   * @param fieldLabel Configuration field label.
   * @return Trimmed configured value.
   */
  private static String requiredText(
    String configuredValue,
    String fieldLabel
  ) {
    String normalizedValue = optionalText(configuredValue);
    if (String.isBlank(normalizedValue)) {
      throw invalidValue(fieldLabel, 'is required');
    }
    return normalizedValue;
  }

  /**
   * @description Trims an optional text setting without inventing a fallback.
   *
   * @param configuredValue Custom Metadata text value.
   * @return Trimmed value or null.
   */
  private static String optionalText(String configuredValue) {
    return String.isBlank(configuredValue) ? null : configuredValue.trim();
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
