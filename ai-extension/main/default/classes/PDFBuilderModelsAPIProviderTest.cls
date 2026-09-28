@IsTest
private class PDFBuilderModelsAPIProviderTest {
  @IsTest
  static void generatesTextThroughCallableContract() {
    PDFBuilderModelsAPIProvider.testGeneratedText = '{"patch":{}}';

    Object result = new PDFBuilderModelsAPIProvider()
      .call(
        'generate',
        new Map<String, Object>{
          'modelName' => 'test-model',
          'prompt' => 'Return JSON.'
        }
      );

    Assert.areEqual('{"patch":{}}', (String) result);
  }

  @IsTest
  static void rejectsUnsupportedActions() {
    try {
      new PDFBuilderModelsAPIProvider()
        .call('unknown', new Map<String, Object>());
      Assert.fail('Expected an unsupported action error.');
    } catch (Exception error) {
      Assert.isTrue(error.getMessage().contains('Unsupported'));
    }
  }

  @IsTest
  static void rejectsMissingInputs() {
    try {
      new PDFBuilderModelsAPIProvider()
        .call(
          'generate',
          new Map<String, Object>{ 'modelName' => 'test-model' }
        );
      Assert.fail('Expected an invalid input error.');
    } catch (Exception error) {
      Assert.isTrue(error.getMessage().contains('required'));
    }
  }

  @IsTest
  static void reachesModelsApiWhenNoTestResponseIsConfigured() {
    PDFBuilderModelsAPIProvider.testGeneratedText = null;

    try {
      new PDFBuilderModelsAPIProvider()
        .call(
          'generate',
          new Map<String, Object>{
            'modelName' => 'test-model',
            'prompt' => 'Return JSON.'
          }
        );
      Assert.fail('A test context must not perform a billable generation.');
    } catch (Exception error) {
      Assert.isNotNull(error);
    }
  }
}
