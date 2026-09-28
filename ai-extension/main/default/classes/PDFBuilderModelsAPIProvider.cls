/**
 * @description Optional Salesforce Models API adapter for PDF Builder.
 * This class lives in a separate package because the aiplatform namespace is
 * unavailable in orgs where Einstein1AIPlatform isn't enabled.
 */
global with sharing class PDFBuilderModelsAPIProvider implements Callable {
  private static final String ACTION_GENERATE = 'generate';
  private static final String INVALID_ACTION_MESSAGE = 'Unsupported AI provider action.';
  private static final String INVALID_INPUT_MESSAGE = 'A model name and prompt are required.';

  @TestVisible
  private static String testGeneratedText;

  /**
   * @description Invokes a supported Models API operation.
   * @param action Provider operation name.
   * @param arguments Validated values supplied by the core package.
   * @return Generated model text.
   */
  global Object call(String action, Map<String, Object> arguments) {
    if (action != ACTION_GENERATE) {
      throw new PDFBuilderModelsAPIProviderException(INVALID_ACTION_MESSAGE);
    }

    String modelName = (String) arguments?.get('modelName');
    String prompt = (String) arguments?.get('prompt');
    if (String.isBlank(modelName) || String.isBlank(prompt)) {
      throw new PDFBuilderModelsAPIProviderException(INVALID_INPUT_MESSAGE);
    }
    if (Test.isRunningTest() && testGeneratedText != null) {
      return testGeneratedText;
    }

    aiplatform.ModelsAPI modelsApi = new aiplatform.ModelsAPI();
    aiplatform.ModelsAPI.createGenerations_Request request = new aiplatform.ModelsAPI.createGenerations_Request();
    request.modelName = modelName;
    request.body = new aiplatform.ModelsAPI_GenerationRequest();
    request.body.prompt = prompt;

    aiplatform.ModelsAPI.createGenerations_Response response = modelsApi.createGenerations(
      request
    );
    return response?.Code200?.generation?.generatedText;
  }

  private class PDFBuilderModelsAPIProviderException extends Exception {
  }
}
