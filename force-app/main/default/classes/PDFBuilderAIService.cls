/**
 * @description Secure AI orchestration service for the PDF Builder guided designer.
 */
public with sharing class PDFBuilderAIService {
  private static final String ERROR_PREFIX = 'AI_ERROR:';
  private static final String ERROR_CODE_UNAVAILABLE = 'AI_UNAVAILABLE';
  private static final String ERROR_CODE_INVALID_REQUEST = 'AI_INVALID_REQUEST';
  private static final String ERROR_CODE_PROMPT_TOO_LONG = 'AI_PROMPT_TOO_LONG';
  private static final String ERROR_CODE_EMPTY_RESPONSE = 'AI_EMPTY_RESPONSE';
  private static final String ERROR_CODE_INVALID_RESPONSE = 'AI_INVALID_RESPONSE';
  private static final String ERROR_CODE_INVALID_RECIPE = 'AI_INVALID_RECIPE';
  private static final String REQUIRED_INPUT_ERROR = 'A wizard step and prompt are required.';
  private static final String PROMPT_TOO_LONG_ERROR = 'The AI prompt is too long.';
  private static final String EMPTY_RESPONSE_ERROR = 'Salesforce AI returned an empty proposal.';
  private static final String INVALID_RESPONSE_ERROR = 'Salesforce AI returned an invalid JSON proposal.';
  private static final String INVALID_RECIPE_ERROR = 'The current template definition is invalid.';
  private static final String AI_PERMISSION_NAME = 'PDFBuilderUseAIWizard';
  private static final String AI_PROVIDER_CLASS_NAME = 'PDFBuilderModelsAPIProvider';
  private static final String AI_PROVIDER_ACTION_GENERATE = 'generate';
  private static final String EMPTY_JSON = '{}';
  private static final String LINE_SEPARATOR = '\n';
  private static final String CURRENT_STEP_PREFIX = 'Current step: ';
  private static final String RECIPE_START = '<CURRENT_RECIPE_UNTRUSTED_JSON>';
  private static final String RECIPE_END = '</CURRENT_RECIPE_UNTRUSTED_JSON>';
  private static final String METADATA_START = '<AVAILABLE_METADATA_READ_ONLY_JSON>';
  private static final String METADATA_END = '</AVAILABLE_METADATA_READ_ONLY_JSON>';
  private static final String REQUEST_START = '<USER_REQUEST_UNTRUSTED_TEXT>';
  private static final String REQUEST_END = '</USER_REQUEST_UNTRUSTED_TEXT>';
  private static final Integer MAX_GENERATED_RESPONSE_LENGTH = 100000;
  private static final Integer MAX_RESPONSE_MESSAGE_LENGTH = 500;
  private static final Integer MAX_RESPONSE_MESSAGES = 20;
  private static final Set<String> ALLOWED_WIZARD_STEPS = new Set<String>{
    'context',
    'style',
    'header',
    'body',
    'relatedList',
    'footer'
  };

  @TestVisible
  private static String testGeneratedText;
  @TestVisible
  private static Boolean testModelsAPIAvailable;
  @TestVisible
  private static Boolean testUserAuthorized;

  /**
   * @description Availability state consumed by the builder UI.
   */
  public class AIAvailability {
    @AuraEnabled
    public Boolean available;

    @AuraEnabled
    public String message;

    @AuraEnabled
    public String providerLabel;
  }

  /**
   * @description Validated model response returned to the guided wizard.
   */
  public class WizardAIResponse {
    @AuraEnabled
    public String generatedJson;

    @AuraEnabled
    public String modelName;
  }

  /**
   * @description Returns a cost-free capability check for the AI prompt area.
   * The Models API call remains the authoritative runtime permission check.
   *
   * @return Current AI availability and user-facing configuration.
   */
  @AuraEnabled(cacheable=true)
  public static AIAvailability getAvailability() {
    PDFBuilderConfiguration.Settings settings = PDFBuilderConfiguration.getSettings();
    AIAvailability result = new AIAvailability();
    result.providerLabel = settings.aiProviderLabel;
    result.available =
      settings.aiWizardEnabled &&
      isModelsAPITypeAvailable() &&
      isUserAuthorized();
    result.message = result.available ? null : settings.aiUnavailableMessage;
    return result;
  }

  /**
   * @description Generates a constrained JSON proposal for one wizard step.
   *
   * @param step Wizard section being configured.
   * @param userPrompt User design instruction.
   * @param recipeJson Current wizard recipe.
   * @return Generated JSON proposal and configured model name.
   */
  @AuraEnabled
  public static WizardAIResponse generateWizardProposal(
    String step,
    String userPrompt,
    String recipeJson
  ) {
    PDFBuilderConfiguration.Settings settings = PDFBuilderConfiguration.getSettings();
    if (
      !settings.aiWizardEnabled ||
      !isModelsAPITypeAvailable() ||
      !isUserAuthorized()
    ) {
      throw unavailableException(settings.aiUnavailableMessage);
    }

    String normalizedStep = step == null ? null : step.trim();
    String normalizedPrompt = userPrompt == null ? null : userPrompt.trim();
    if (
      String.isBlank(normalizedStep) ||
      String.isBlank(normalizedPrompt) ||
      !ALLOWED_WIZARD_STEPS.contains(normalizedStep)
    ) {
      throw handledException(ERROR_CODE_INVALID_REQUEST, REQUIRED_INPUT_ERROR);
    }
    if (normalizedPrompt.length() > settings.aiMaxPromptLength) {
      throw handledException(ERROR_CODE_PROMPT_TOO_LONG, PROMPT_TOO_LONG_ERROR);
    }

    String trustedRecipeJson = normalizeRecipeJson(
      recipeJson,
      settings.aiMaxContextLength
    );
    String trustedContextJson = buildTrustedContext(
      trustedRecipeJson,
      settings
    );
    String generatedText;
    if (Test.isRunningTest() && testGeneratedText != null) {
      generatedText = testGeneratedText;
    } else {
      try {
        Callable provider = (Callable) Type.forName(AI_PROVIDER_CLASS_NAME)
          .newInstance();
        generatedText = (String) provider.call(
          AI_PROVIDER_ACTION_GENERATE,
          new Map<String, Object>{
            'modelName' => settings.aiModelApiName,
            'prompt' => buildPrompt(
              normalizedStep,
              normalizedPrompt,
              trustedRecipeJson,
              trustedContextJson
            )
          }
        );
      } catch (Exception ignored) {
        throw unavailableException(settings.aiUnavailableMessage);
      }
    }

    if (String.isBlank(generatedText)) {
      throw handledException(ERROR_CODE_EMPTY_RESPONSE, EMPTY_RESPONSE_ERROR);
    }

    WizardAIResponse result = new WizardAIResponse();
    result.generatedJson = validateGeneratedResponse(
      generatedText,
      normalizedPrompt
    );
    result.modelName = settings.aiModelApiName;
    return result;
  }

  /**
   * @description Checks whether the optional Models API provider is installed
   * without sending a billable generation request. Keeping the platform type
   * in a separate package allows the core Builder to install in orgs that do
   * not have Einstein1AIPlatform enabled.
   *
   * @return True when the optional Models API provider is installed.
   */
  @TestVisible
  private static Boolean isModelsAPITypeAvailable() {
    if (Test.isRunningTest()) {
      return testModelsAPIAvailable != false;
    }
    try {
      Type providerType = Type.forName(AI_PROVIDER_CLASS_NAME);
      return providerType != null;
    } catch (Exception ignored) {
      return false;
    }
  }

  /**
   * @description Enforces explicit least-privilege access to the AI feature.
   * Apex class access alone is insufficient because the non-AI builder and the
   * Models API have different security and cost implications.
   *
   * @return True when the current user has the PDF Builder AI custom permission.
   */
  @TestVisible
  private static Boolean isUserAuthorized() {
    if (Test.isRunningTest()) {
      return testUserAuthorized != false;
    }
    return FeatureManagement.checkPermission(AI_PERMISSION_NAME);
  }

  /**
   * @description Creates the stable handled error consumed by the LWC.
   *
   * @param message Configured user-facing availability message.
   * @return Handled exception marked as an AI availability failure.
   */
  private static AuraHandledException unavailableException(String message) {
    return handledException(ERROR_CODE_UNAVAILABLE, message);
  }

  /**
   * @description Creates a stable machine-readable handled error for the LWC.
   * The human-readable message remains configurable and is never used as the
   * primary branch condition in the client.
   *
   * @param code Stable error code.
   * @param message Safe user-facing detail.
   * @return Handled exception containing code and detail.
   */
  private static AuraHandledException handledException(
    String code,
    String message
  ) {
    return new AuraHandledException(formatErrorMessage(code, message));
  }

  @TestVisible
  private static String formatErrorMessage(String code, String message) {
    return ERROR_PREFIX + code + ': ' + String.valueOf(message).trim();
  }

  /**
   * @description Bounds serialized context before it is included in a prompt.
   *
   * @param value Serialized recipe or metadata context.
   * @return Bounded JSON text.
   */
  @TestVisible
  private static String limitJson(String value) {
    return limitJson(
      value,
      PDFBuilderConfiguration.getSettings().aiMaxContextLength
    );
  }

  /**
   * @description Bounds serialized context using the configured maximum.
   *
   * @param value Serialized recipe or metadata context.
   * @param maximumLength Maximum accepted character count.
   * @return Bounded context text or an empty JSON object.
   */
  private static String limitJson(String value, Integer maximumLength) {
    String normalized = String.isBlank(value) ? EMPTY_JSON : value;
    return normalized.length() <= maximumLength
      ? normalized
      : normalized.substring(0, maximumLength);
  }

  /**
   * @description Parses and reserializes the recipe so malformed JSON and raw
   * prompt-delimiter injection never reach Models API.
   *
   * @param value Serialized current template recipe.
   * @param maximumLength Maximum accepted recipe length.
   * @return Normalized, syntactically valid recipe JSON.
   */
  private static String normalizeRecipeJson(
    String value,
    Integer maximumLength
  ) {
    String bounded = String.isBlank(value) ? EMPTY_JSON : value;
    if (bounded.length() > maximumLength) {
      throw handledException(ERROR_CODE_INVALID_RECIPE, INVALID_RECIPE_ERROR);
    }
    try {
      Object parsed = JSON.deserializeUntyped(bounded);
      if (!(parsed instanceof Map<String, Object>)) {
        throw handledException(ERROR_CODE_INVALID_RECIPE, INVALID_RECIPE_ERROR);
      }
      return JSON.serialize(parsed);
    } catch (AuraHandledException handled) {
      throw handled;
    } catch (Exception ignored) {
      throw handledException(ERROR_CODE_INVALID_RECIPE, INVALID_RECIPE_ERROR);
    }
  }

  /**
   * @description Rebuilds model metadata on the server from Describe results.
   * Client-supplied metadata is deliberately not accepted as a trust boundary.
   *
   * @param recipeJson Normalized current template recipe.
   * @param settings Validated application configuration.
   * @return Accessible schema metadata serialized as bounded JSON.
   */
  @TestVisible
  private static String buildTrustedContext(
    String recipeJson,
    PDFBuilderConfiguration.Settings settings
  ) {
    Map<String, Object> recipe = (Map<String, Object>) JSON.deserializeUntyped(
      recipeJson
    );
    Map<String, Object> context = new Map<String, Object>();
    context.put(
      'layout',
      new Map<String, Object>{
        'pageWidth' => settings.pageWidth,
        'pageHeight' => settings.pageHeight,
        'availableWidth' => Math.max(
          240,
          settings.pageWidth -
            boundedNonNegativeInteger(
              recipe.get('pagePadding'),
              settings.defaultPagePadding
            ) * 2 -
            boundedNonNegativeInteger(
              recipe.get('elementPadding'),
              settings.defaultElementPadding
            ) * 2
        ),
        'headerHeight' => settings.defaultHeaderHeight,
        'footerHeight' => settings.defaultFooterHeight
      }
    );

    String objectApiName = stringValue(recipe.get('objectApiName'));
    if (String.isBlank(objectApiName)) {
      context.put('fields', new List<Object>());
      context.put('relatedLists', new List<Object>());
      context.put('relatedListFields', new List<Object>());
      return JSON.serialize(context);
    }

    List<PDFBuilderDescribeService.FieldDescriptor> fields = PDFBuilderDescribeService.getFields(
      objectApiName,
      null
    );
    List<PDFBuilderDescribeService.RelatedListDescriptor> relationships = PDFBuilderDescribeService.getRelatedLists(
      objectApiName
    );
    List<Object> fieldValues = fieldMaps(fields);
    List<Object> relationshipValues = relatedListMaps(relationships);
    context.put('fields', fieldValues);
    context.put('relatedLists', relationshipValues);

    String relationshipName = selectedRelationshipName(recipe);
    List<Object> childFields = new List<Object>();
    if (!String.isBlank(relationshipName)) {
      for (
        PDFBuilderDescribeService.RelatedListDescriptor relationship : relationships
      ) {
        if (relationship.relationshipName == relationshipName) {
          childFields = fieldMaps(
            PDFBuilderDescribeService.getRelatedListFields(
              relationship.childObjectApiName,
              null
            )
          );
          break;
        }
      }
    }
    context.put('relatedListFields', childFields);
    return serializeWithinLimit(
      context,
      new List<List<Object>>{ fieldValues, relationshipValues, childFields },
      settings.aiMaxContextLength
    );
  }

  /**
   * @description Fits metadata arrays within the configured prompt budget
   * while preserving a syntactically complete JSON document.
   *
   * @param context Trusted metadata context.
   * @param reducibleLists Metadata arrays that can be shortened safely.
   * @param maximumLength Maximum serialized context length.
   * @return Complete JSON within the configured limit.
   */
  @TestVisible
  private static String serializeWithinLimit(
    Map<String, Object> context,
    List<List<Object>> reducibleLists,
    Integer maximumLength
  ) {
    String serialized = JSON.serialize(context);
    while (serialized.length() > maximumLength) {
      List<Object> largestList;
      for (List<Object> candidate : reducibleLists) {
        if (
          !candidate.isEmpty() &&
          (largestList == null ||
          candidate.size() > largestList.size())
        ) {
          largestList = candidate;
        }
      }
      if (largestList == null) {
        throw handledException(ERROR_CODE_INVALID_RECIPE, INVALID_RECIPE_ERROR);
      }
      // Re-serializing after every single removal is quadratic for objects
      // with hundreds of fields and can exhaust the synchronous Apex CPU
      // limit. Remove a proportional chunk while retaining the beginning of
      // each sorted metadata list, then measure again.
      Integer removalCount = Math.max(1, largestList.size() / 4);
      for (Integer index = 0; index < removalCount; index++) {
        largestList.remove(largestList.size() - 1);
      }
      serialized = JSON.serialize(context);
    }
    return serialized;
  }

  private static List<Object> fieldMaps(
    List<PDFBuilderDescribeService.FieldDescriptor> descriptors
  ) {
    List<Object> values = new List<Object>();
    for (PDFBuilderDescribeService.FieldDescriptor descriptor : descriptors) {
      values.add(
        new Map<String, Object>{
          'label' => descriptor.label,
          'apiName' => descriptor.apiName,
          'dataType' => descriptor.dataType
        }
      );
    }
    return values;
  }

  private static List<Object> relatedListMaps(
    List<PDFBuilderDescribeService.RelatedListDescriptor> descriptors
  ) {
    List<Object> values = new List<Object>();
    for (
      PDFBuilderDescribeService.RelatedListDescriptor descriptor : descriptors
    ) {
      values.add(
        new Map<String, Object>{
          'label' => descriptor.label,
          'relationshipName' => descriptor.relationshipName,
          'childObjectApiName' => descriptor.childObjectApiName
        }
      );
    }
    return values;
  }

  private static String selectedRelationshipName(Map<String, Object> recipe) {
    String directValue = stringValue(recipe.get('relatedListRelationshipName'));
    if (!String.isBlank(directValue)) {
      return directValue;
    }
    Object bodyBlocksValue = recipe.get('bodyBlocks');
    if (!(bodyBlocksValue instanceof List<Object>)) {
      return null;
    }
    for (Object blockValue : (List<Object>) bodyBlocksValue) {
      if (!(blockValue instanceof Map<String, Object>)) {
        continue;
      }
      Map<String, Object> block = (Map<String, Object>) blockValue;
      if (stringValue(block.get('type')) == 'relatedList') {
        return stringValue(block.get('relationshipName'));
      }
    }
    return null;
  }

  private static Integer boundedNonNegativeInteger(
    Object value,
    Integer fallbackValue
  ) {
    try {
      Integer parsed = Decimal.valueOf(String.valueOf(value)).intValue();
      return parsed >= 0 && parsed <= 500 ? parsed : fallbackValue;
    } catch (Exception ignored) {
      return fallbackValue;
    }
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value).trim();
  }

  /**
   * @description Rejects prose, Markdown, oversized output, and unexpected
   * top-level response values before the result crosses back into the LWC.
   *
   * @param generatedText Raw Models API response.
   * @return Normalized JSON containing only patch, summary, and unapplied.
   */
  @TestVisible
  private static String validateGeneratedResponse(String generatedText) {
    return validateGeneratedResponse(generatedText, '');
  }

  private static String validateGeneratedResponse(
    String generatedText,
    String userPrompt
  ) {
    String normalized = extractGeneratedJsonObject(generatedText);
    if (
      String.isBlank(normalized) ||
      normalized.length() > MAX_GENERATED_RESPONSE_LENGTH
    ) {
      throw handledException(
        ERROR_CODE_INVALID_RESPONSE,
        INVALID_RESPONSE_ERROR
      );
    }
    try {
      Object parsed = JSON.deserializeUntyped(normalized);
      if (!(parsed instanceof Map<String, Object>)) {
        throw handledException(
          ERROR_CODE_INVALID_RESPONSE,
          INVALID_RESPONSE_ERROR
        );
      }
      Map<String, Object> source = (Map<String, Object>) parsed;
      if (!(source.get('patch') instanceof Map<String, Object>)) {
        throw handledException(
          ERROR_CODE_INVALID_RESPONSE,
          INVALID_RESPONSE_ERROR
        );
      }
      rejectInventedOutboundUrls(source.get('patch'), userPrompt);
      Map<String, Object> safeResponse = new Map<String, Object>{
        'patch' => source.get('patch'),
        'summary' => boundedMessage(source.get('summary')),
        'unapplied' => boundedMessages(source.get('unapplied'))
      };
      return JSON.serialize(safeResponse);
    } catch (AuraHandledException handled) {
      throw handled;
    } catch (Exception ignored) {
      throw handledException(
        ERROR_CODE_INVALID_RESPONSE,
        INVALID_RESPONSE_ERROR
      );
    }
  }

  /**
   * @description Extracts the first complete JSON object from a model response.
   * Models occasionally wrap otherwise valid JSON in a Markdown fence or a
   * short explanatory sentence. Only the extracted object crosses the trust
   * boundary and it is still parsed, allowlisted, and URL-validated below.
   *
   * @param generatedText Raw Models API response.
   * @return A complete JSON object candidate, or the normalized raw response
   * when no complete object exists so normal validation rejects it.
   */
  @TestVisible
  private static String extractGeneratedJsonObject(String generatedText) {
    String normalized = generatedText == null ? null : generatedText.trim();
    if (String.isBlank(normalized)) {
      return normalized;
    }

    Integer objectStart = normalized.indexOf('{');
    if (objectStart < 0) {
      return normalized;
    }

    Integer depth = 0;
    Boolean insideString = false;
    Boolean escaped = false;
    for (Integer index = objectStart; index < normalized.length(); index++) {
      String character = normalized.substring(index, index + 1);
      if (insideString) {
        if (escaped) {
          escaped = false;
        } else if (character == '\\') {
          escaped = true;
        } else if (character == '"') {
          insideString = false;
        }
        continue;
      }
      if (character == '"') {
        insideString = true;
      } else if (character == '{') {
        depth++;
      } else if (character == '}') {
        depth--;
        if (depth == 0) {
          return normalized.substring(objectStart, index + 1);
        }
      }
    }
    return normalized;
  }

  /**
   * @description Prevents model-generated URLs from becoming an exfiltration
   * channel. A remote URL is permitted only when the user supplied that exact
   * URL as part of the current design request.
   *
   * @param value Generated patch node to inspect recursively.
   * @param userPrompt Original user design request.
   */
  private static void rejectInventedOutboundUrls(
    Object value,
    String userPrompt
  ) {
    if (value instanceof Map<String, Object>) {
      for (Object child : ((Map<String, Object>) value).values()) {
        rejectInventedOutboundUrls(child, userPrompt);
      }
      return;
    }
    if (value instanceof List<Object>) {
      for (Object child : (List<Object>) value) {
        rejectInventedOutboundUrls(child, userPrompt);
      }
      return;
    }
    if (!(value instanceof String)) {
      return;
    }
    Matcher matcher = Pattern.compile('(?i)https?://[^\\s<>\"]+')
      .matcher((String) value);
    while (matcher.find()) {
      if (String.isBlank(userPrompt) || !userPrompt.contains(matcher.group())) {
        throw handledException(
          ERROR_CODE_INVALID_RESPONSE,
          INVALID_RESPONSE_ERROR
        );
      }
    }
  }

  private static String boundedMessage(Object value) {
    String message = stringValue(value);
    if (String.isBlank(message)) {
      return '';
    }
    return message.length() <= MAX_RESPONSE_MESSAGE_LENGTH
      ? message
      : message.substring(0, MAX_RESPONSE_MESSAGE_LENGTH);
  }

  private static List<String> boundedMessages(Object value) {
    List<String> messages = new List<String>();
    if (!(value instanceof List<Object>)) {
      return messages;
    }
    for (Object item : (List<Object>) value) {
      if (messages.size() >= MAX_RESPONSE_MESSAGES) {
        break;
      }
      String message = boundedMessage(item);
      if (!String.isBlank(message)) {
        messages.add(message);
      }
    }
    return messages;
  }

  /**
   * @description Builds the strict design-engine prompt sent to Models API.
   *
   * @param step Wizard section being configured.
   * @param userPrompt User design instruction.
   * @param recipeJson Current wizard recipe.
   * @param contextJson Available Salesforce metadata.
   * @return Complete model prompt.
   */
  @TestVisible
  private static String buildPrompt(
    String step,
    String userPrompt,
    String recipeJson,
    String contextJson
  ) {
    PDFBuilderConfiguration.Settings settings = PDFBuilderConfiguration.getSettings();
    return String.join(
      new List<String>{
        settings.aiPromptInstructions,
        CURRENT_STEP_PREFIX + step,
        RECIPE_START,
        recipeJson,
        RECIPE_END,
        METADATA_START,
        contextJson,
        METADATA_END,
        REQUEST_START,
        userPrompt,
        REQUEST_END
      },
      LINE_SEPARATOR
    );
  }
}
