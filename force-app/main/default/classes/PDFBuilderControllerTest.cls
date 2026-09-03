/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Verifies stable PDF Builder facade contracts and template persistence.
 */
@IsTest
private class PDFBuilderControllerTest {
  /**
   * @description Creates representative templates used by facade and repository tests.
   */
  @TestSetup
  static void createTemplates() {
    insert new List<PDFBuilderTemplate__c>{
      new PDFBuilderTemplate__c(
        Name = 'Account Proposal',
        ObjectApiName__c = 'Account',
        ContentJson__c = '{"pagePadding":32}',
        GeneratedHtml__c = '<main>Account proposal</main>'
      ),
      new PDFBuilderTemplate__c(
        Name = 'Quote Proposal',
        ObjectApiName__c = 'Quote',
        ContentJson__c = '{"pagePadding":32}',
        GeneratedHtml__c = '<main>Quote proposal</main>'
      )
    };
  }

  /**
   * @description Uses the source record Name as the saved PDF title.
   */
  @IsTest
  static void resolvesRecordNameForSavedPdf() {
    Account account = new Account(Name = 'Customer proposal');
    insert account;

    Test.startTest();
    String pdfTitle = PDFBuilderController.getRecordNameForPdf(account.Id);
    Test.stopTest();

    Assert.areEqual(
      'Customer proposal',
      pdfTitle,
      'The PDF title must match the source record Name.'
    );
  }

  /**
   * @description Uses the record Name, including spaces and accents, for browser downloads.
   */
  @IsTest
  static void namesDownloadedPdfAfterSourceRecord() {
    Account account = new Account(Name = 'Propuesta José 2026');
    insert account;

    Test.startTest();
    String fileName = PDFBuilderController.buildPdfFileName(
      account.Id,
      'Template fallback'
    );
    Test.stopTest();

    Assert.areEqual(
      'Propuesta José 2026.pdf',
      fileName,
      'The downloaded PDF must use the source record Name.'
    );
  }

  /**
   * @description Verifies that Custom Metadata values preserve the current UI and PDF geometry.
   */
  @IsTest
  static void returnsCompatibilityConfiguration() {
    Test.startTest();
    PDFBuilderConfiguration.Settings settings = PDFBuilderController.getConfiguration();
    Test.stopTest();

    Assert.areEqual(
      794,
      settings.pageWidth,
      'Page width must preserve the A4 preview geometry.'
    );
    Assert.areEqual(
      1123,
      settings.pageHeight,
      'Page height must preserve the A4 preview geometry.'
    );
    Assert.areEqual(
      32,
      settings.defaultPagePadding,
      'Default page padding must remain compatible.'
    );
    Assert.areEqual(
      0,
      settings.defaultElementPadding,
      'Default element padding must remain compatible.'
    );
    Assert.areEqual(
      110,
      settings.defaultHeaderHeight,
      'Default header height must remain compatible.'
    );
    Assert.areEqual(
      80,
      settings.defaultFooterHeight,
      'Default footer height must remain compatible.'
    );
    Assert.areEqual(
      5,
      settings.maxPages,
      'Maximum manual pages must remain compatible.'
    );
    Assert.areEqual(
      131072,
      settings.longTextLimit,
      'Long text limit must match Salesforce storage.'
    );
    Assert.areEqual(
      200,
      settings.templateQueryLimit,
      'Template query limit must match metadata.'
    );
    Assert.areEqual(
      60,
      settings.imageQueryLimit,
      'Image query limit must match metadata.'
    );
    Assert.areEqual(
      1800000,
      settings.maxClientImageBase64Length,
      'Client image limit must match metadata.'
    );
    Assert.areEqual(
      0.96,
      settings.pdfFontScale,
      'PDF font compensation must remain compatible.'
    );
    Assert.areEqual(
      10,
      settings.dragGridSize,
      'Drag grid size must remain compatible.'
    );
    Assert.areEqual(
      250,
      settings.inputDebounceMilliseconds,
      'Input debounce must remain compatible.'
    );
    Assert.isTrue(
      settings.includeCustomObjects,
      'Custom objects must remain enabled by default.'
    );
    Assert.isTrue(
      settings.preferredObjects.contains('Quote'),
      'Preferred objects must include Quote.'
    );
    Assert.isTrue(
      settings.supportedImageTypes.contains('PNG'),
      'Supported image types must include PNG.'
    );
  }

  /**
   * @description Verifies configuration lists are parsed from Custom Metadata and invalid values are rejected.
   */
  @IsTest
  static void validatesAuthoritativeConfiguration() {
    PDFBuilderSettings__mdt metadataRecord = (PDFBuilderSettings__mdt) PDFBuilderSettings__mdt.getInstance(
        'Default'
      )
      .clone(true, true, true, true);
    metadataRecord.PreferredObjectApiNames__c = 'Account\nQuote;Account,Contact';
    metadataRecord.SupportedImageTypes__c = 'png\njpeg;PNG';

    Test.startTest();
    PDFBuilderConfiguration.Settings settings = PDFBuilderConfiguration.buildSettings(
      metadataRecord
    );
    Test.stopTest();

    Assert.areEqual(
      new List<String>{ 'Account', 'Quote', 'Contact' },
      settings.preferredObjects,
      'Preferred objects must preserve configured order and remove duplicates.'
    );
    Assert.areEqual(
      new List<String>{ 'PNG', 'JPEG' },
      settings.supportedImageTypes,
      'Image types must be normalized and deduplicated.'
    );

    metadataRecord.IncludeCustomObjects__c = false;
    settings = PDFBuilderConfiguration.buildSettings(metadataRecord);
    Assert.isFalse(
      settings.includeCustomObjects,
      'The custom-object setting must preserve an explicit false value.'
    );

    metadataRecord.PageWidthPx__c = 0;
    assertInvalidConfigurationFails(metadataRecord, 'Page Width Px');
    assertInvalidConfigurationFails(null, 'Custom Metadata record');
  }

  /**
   * @description Verifies template list and detail response shapes consumed by both LWCs.
   */
  @IsTest
  static void returnsTemplateSummariesAndDetails() {
    Test.startTest();
    List<PDFBuilderController.TemplateSummary> allTemplates = PDFBuilderController.getTemplates();
    List<PDFBuilderController.TemplateSummary> accountTemplates = PDFBuilderController.getTemplatesForObject(
      'Account',
      null
    );
    PDFBuilderController.TemplateDetail detail = PDFBuilderController.getTemplate(
      accountTemplates[0].id
    );
    Test.stopTest();

    Assert.areEqual(
      2,
      allTemplates.size(),
      'The setup must expose both templates.'
    );
    Assert.areEqual(
      1,
      accountTemplates.size(),
      'The object filter must return one Account template.'
    );
    Assert.areEqual(
      'Account',
      accountTemplates[0].objectApiName,
      'The summary must retain its object.'
    );
    Assert.areEqual(
      'Account Proposal',
      detail.name,
      'The detail must retain the template name.'
    );
    Assert.areEqual(
      'Account',
      detail.objectApiName,
      'The detail must retain the object API name.'
    );
    Assert.areEqual(
      '{"pagePadding":32}',
      detail.contentJson,
      'The detail must retain its JSON model.'
    );
    Assert.areEqual(
      '<main>Account proposal</main>',
      detail.generatedHtml,
      'The detail must retain generated HTML.'
    );
  }

  /**
   * @description Verifies create, update, save-as data and delete behavior through the facade.
   */
  @IsTest
  static void createsUpdatesAndDeletesTemplate() {
    Test.startTest();
    Id templateId = PDFBuilderController.saveTemplate(
      null,
      'Service Proposal',
      'Account',
      '{"pagePadding":40}',
      '<main>Service proposal</main>',
      'ALL',
      false
    );

    PDFBuilderController.saveTemplate(
      templateId,
      'Updated Service Proposal',
      'Account',
      '{"pagePadding":48}',
      '<main>Updated service proposal</main>',
      'ALL',
      false
    );

    PDFBuilderController.TemplateDetail detail = PDFBuilderController.getTemplate(
      templateId
    );
    PDFBuilderController.deleteTemplate(templateId);
    Test.stopTest();

    Assert.areEqual(
      'Updated Service Proposal',
      detail.name,
      'Update must persist the new template name.'
    );
    Assert.areEqual(
      '{"pagePadding":48}',
      detail.contentJson,
      'Update must persist the new JSON model.'
    );
    Assert.areEqual(
      0,
      [SELECT COUNT() FROM PDFBuilderTemplate__c WHERE Id = :templateId],
      'Delete must remove the selected template.'
    );
  }

  /**
   * @description Verifies metadata options retain their current serialized contracts.
   */
  @IsTest
  static void returnsObjectAndFieldMetadata() {
    Test.startTest();
    List<PDFBuilderController.ObjectOption> objects = PDFBuilderController.getObjects();
    List<PDFBuilderController.FieldOption> fields = PDFBuilderController.getFields(
      'Account',
      'Name'
    );
    List<PDFBuilderController.RelatedListOption> relatedLists = PDFBuilderController.getRelatedLists(
      'Account'
    );
    List<PDFBuilderController.FieldOption> relatedFields = PDFBuilderController.getRelatedListFields(
      'Contact',
      'Email'
    );
    List<PDFBuilderController.FieldOption> emptyFields = PDFBuilderController.getFields(
      '',
      ''
    );
    List<PDFBuilderController.RelatedListOption> emptyRelatedLists = PDFBuilderController.getRelatedLists(
      ''
    );
    List<PDFBuilderController.FieldOption> emptyRelatedFields = PDFBuilderController.getRelatedListFields(
      '',
      ''
    );
    Test.stopTest();

    Boolean foundInternalTemplateObject = false;
    for (PDFBuilderController.ObjectOption option : objects) {
      foundInternalTemplateObject =
        foundInternalTemplateObject ||
        option.apiName == 'PDFBuilderTemplate__c';
    }

    Boolean foundName = false;
    for (PDFBuilderController.FieldOption option : fields) {
      foundName = foundName || option.apiName == 'Name';
    }

    Boolean foundEmail = false;
    for (PDFBuilderController.FieldOption option : relatedFields) {
      foundEmail = foundEmail || option.apiName == 'Email';
    }

    Assert.isFalse(
      foundInternalTemplateObject,
      'Configured object metadata must not expose the internal template object.'
    );
    Assert.isTrue(foundName, 'Accessible Account fields must include Name.');
    Assert.isTrue(
      foundEmail,
      'Accessible Contact related-list fields must include Email.'
    );
    Assert.isNotNull(
      relatedLists,
      'Related-list metadata must always return a collection.'
    );
    Assert.areEqual(
      0,
      emptyFields.size(),
      'A missing object must return no fields.'
    );
    Assert.areEqual(
      0,
      emptyRelatedLists.size(),
      'A missing object must return no related lists.'
    );
    Assert.areEqual(
      0,
      emptyRelatedFields.size(),
      'A missing child object must return no fields.'
    );
  }

  /**
   * @description Verifies the object selector always excludes PDF Builder's internal template object.
   */
  @IsTest
  static void filtersInternalObjectFromObjectMetadata() {
    List<String> preferredObjects = new List<String>{
      'Account',
      'PDFBuilderTemplate__c'
    };

    Test.startTest();
    List<PDFBuilderDescribeService.ObjectDescriptor> objects = PDFBuilderDescribeService.getObjects(
      preferredObjects,
      false
    );
    List<PDFBuilderDescribeService.ObjectDescriptor> objectsWithCustomObjects = PDFBuilderDescribeService.getObjects(
      preferredObjects,
      true
    );
    Test.stopTest();

    Boolean foundAccount = false;
    for (PDFBuilderDescribeService.ObjectDescriptor descriptor : objects) {
      foundAccount = foundAccount || descriptor.apiName == 'Account';
      Assert.isFalse(
        descriptor.custom,
        'Custom objects must not be returned when the setting is disabled.'
      );
    }
    Assert.isTrue(
      foundAccount,
      'Preferred standard objects must remain available.'
    );

    Boolean foundInternalObject = false;
    for (
      PDFBuilderDescribeService.ObjectDescriptor descriptor : objectsWithCustomObjects
    ) {
      foundInternalObject =
        foundInternalObject || descriptor.apiName == 'PDFBuilderTemplate__c';
    }
    Assert.isFalse(
      foundInternalObject,
      'The internal template object must never be offered as a source object.'
    );
  }

  /**
   * @description Verifies controller image persistence and Salesforce Files response contracts.
   */
  @IsTest
  static void savesAndListsTemplateImages() {
    Test.startTest();
    String imageUrl = PDFBuilderController.saveTemplateImage(
      'builder logo',
      EncodingUtil.base64Encode(Blob.valueOf('pdf-builder-image')),
      'image/png'
    );
    List<PDFBuilderController.SalesforceImageFileOption> files = PDFBuilderController.getSalesforceImageFiles(
      'builder_logo'
    );
    Test.stopTest();

    Assert.isTrue(
      imageUrl.contains('/sfc/') || imageUrl.startsWith('http'),
      'Saved image must expose a usable URL.'
    );
    Assert.areEqual(
      1,
      files.size(),
      'Image search must return the saved image.'
    );
    Assert.areEqual(
      'builder_logo.png',
      files[0].fileName,
      'Image file name must be normalized.'
    );
    Assert.areEqual(
      'png',
      files[0].fileExtension.toLowerCase(),
      'Image extension must be preserved.'
    );
    Assert.isTrue(
      files[0].downloadUrl.contains('/sfc/servlet.shepherd/version/download/'),
      'Image must expose a download URL.'
    );
    Assert.isTrue(
      files[0].thumbnailUrl.contains('rendition=THUMB720BY480'),
      'Image must expose a thumbnail URL.'
    );
  }

  /**
   * @description Verifies facade validation rejects incomplete or unavailable template data.
   */
  @IsTest
  static void validatesTemplateRequests() {
    Test.startTest();
    assertMissingTemplateDetailFails();
    assertTemplateSaveFails('', 'Account', 'missing template name');
    assertTemplateSaveFails('Name', '', 'missing template object');
    assertTemplateSaveFails('Name', 'Missing__c', 'invalid template object');
    assertTemplateSaveFails(
      '123456789012345678901234567890123456789012345678901234567890123456789012345678901',
      'Account',
      'long template name'
    );
    assertMissingDeleteIdFails();
    assertMissingImageDataFails();
    assertMissingPdfIdsFail();
    List<PDFBuilderController.TemplateSummary> noTemplates = PDFBuilderController.getTemplatesForObject(
      '',
      null
    );
    Test.stopTest();

    Assert.areEqual(
      0,
      noTemplates.size(),
      'A missing object must return no templates.'
    );
  }

  /**
   * @description Verifies currency symbols and decimal separators follow the selected currency.
   */
  @IsTest
  static void formatsCurrencySymbolsByCurrency() {
    String usdValue = PDFBuilderController.formatCurrencyForUser(
      100000,
      2,
      'USD'
    );
    String eurValue = PDFBuilderController.formatCurrencyForUser(
      100000,
      2,
      'EUR'
    );
    String gbpValue = PDFBuilderController.formatCurrencyForUser(
      100000,
      2,
      'GBP'
    );

    Assert.areEqual(
      '$100,000.00',
      usdValue,
      'USD must use a leading symbol, comma grouping and a decimal point.'
    );
    Assert.areEqual(
      '100.000,00 €',
      eurValue,
      'EUR must use dot grouping, a decimal comma and a trailing symbol.'
    );
    Assert.areEqual(
      '£100,000.00',
      gbpValue,
      'GBP must use a leading symbol, comma grouping and a decimal point.'
    );
  }

  /**
   * @description Verifies the permission set grants the same facade access to a non-admin user.
   */
  @IsTest
  static void runsFacadeAsPermissionedUser() {
    String uniqueUsername =
      'document.builder.' +
      UserInfo.getUserId() +
      '.' +
      String.valueOf(Datetime.now().getTime()) +
      '@example.com';
    User standardUser = new User(
      Alias = 'dbuser',
      Email = 'document.builder@example.com',
      EmailEncodingKey = 'UTF-8',
      LastName = 'PDF Builder User',
      LanguageLocaleKey = 'en_US',
      LocaleSidKey = 'en_US',
      ProfileId = UserInfo.getProfileId(),
      TimeZoneSidKey = 'Europe/Madrid',
      Username = uniqueUsername
    );
    insert standardUser;
    PermissionSet builderPermissionSet = [
      SELECT Id
      FROM PermissionSet
      WHERE Name = 'PDFBuilderUser'
      LIMIT 1
    ];
    insert new PermissionSetAssignment(
      AssigneeId = standardUser.Id,
      PermissionSetId = builderPermissionSet.Id
    );

    List<PDFBuilderController.TemplateSummary> templates;
    Test.startTest();
    System.runAs(standardUser) {
      templates = PDFBuilderController.getTemplates();
    }
    Test.stopTest();

    Assert.areEqual(
      2,
      templates.size(),
      'The permissioned user must access shared templates.'
    );
  }

  /**
   * @description Verifies a missing template identifier is rejected.
   */
  private static void assertMissingTemplateDetailFails() {
    try {
      PDFBuilderController.getTemplate(null);
      Assert.fail('A missing template identifier must fail.');
    } catch (AuraHandledException expected) {
      Assert.isNotNull(expected, 'The lookup must expose a handled error.');
    }
  }

  /**
   * @description Verifies invalid template values are rejected during save.
   *
   * @param name Template name.
   * @param objectApiName Template object API name.
   * @param scenario Assertion scenario label.
   */
  private static void assertTemplateSaveFails(
    String name,
    String objectApiName,
    String scenario
  ) {
    try {
      PDFBuilderController.saveTemplate(
        null,
        name,
        objectApiName,
        '{}',
        '<p>x</p>',
        'ALL',
        false
      );
      Assert.fail('Expected failure for ' + scenario);
    } catch (AuraHandledException expected) {
      Assert.isNotNull(
        expected,
        'The facade must raise an AuraHandledException for ' + scenario + '.'
      );
    }
  }

  /**
   * @description Verifies deletion requires a template identifier.
   */
  private static void assertMissingDeleteIdFails() {
    try {
      PDFBuilderController.deleteTemplate(null);
      Assert.fail('Deletion without a template identifier must fail.');
    } catch (AuraHandledException expected) {
      Assert.isNotNull(expected, 'Deletion must expose a handled error.');
    }
  }

  /**
   * @description Verifies image persistence requires encoded data.
   */
  private static void assertMissingImageDataFails() {
    try {
      PDFBuilderController.saveTemplateImage('image.png', '', 'image/png');
      Assert.fail('Image persistence without data must fail.');
    } catch (AuraHandledException expected) {
      Assert.isNotNull(
        expected,
        'Image persistence must expose a handled error.'
      );
    }
  }

  /**
   * @description Verifies PDF generation requires template and record identifiers.
   */
  private static void assertMissingPdfIdsFail() {
    try {
      PDFBuilderController.generatePdf(null, null);
      Assert.fail('PDF generation without identifiers must fail.');
    } catch (AuraHandledException expected) {
      Assert.isNotNull(expected, 'PDF generation must expose a handled error.');
    }
  }

  /**
   * @description Verifies incomplete Custom Metadata cannot silently fall back to code values.
   *
   * @param metadataRecord Configuration record to validate.
   * @param expectedMessage Expected exception message fragment.
   */
  private static void assertInvalidConfigurationFails(
    PDFBuilderSettings__mdt metadataRecord,
    String expectedMessage
  ) {
    try {
      PDFBuilderConfiguration.buildSettings(metadataRecord);
      Assert.fail('Invalid configuration must be rejected.');
    } catch (PDFBuilderConfiguration.ConfigurationException expected) {
      Assert.isTrue(
        expected.getMessage().contains(expectedMessage),
        'The validation error must identify the invalid configuration.'
      );
    }
  }
}
