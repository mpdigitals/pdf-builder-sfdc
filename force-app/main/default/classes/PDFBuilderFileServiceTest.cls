/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Verifies PDF Builder integration with Salesforce Files.
 */
@IsTest
private class PDFBuilderFileServiceTest {
  /**
   * @description Verifies image insertion and discovery through the stable controller response.
   */
  @IsTest
  static void insertsAndFindsImageFiles() {
    String onePixelGif = 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

    Test.startTest();
    String imageUrl = PDFBuilderController.saveTemplateImage(
      'pixel.gif',
      onePixelGif,
      'image/gif'
    );
    List<PDFBuilderController.SalesforceImageFileOption> images = PDFBuilderController.getSalesforceImageFiles(
      'pixel'
    );
    Test.stopTest();

    Assert.isNotNull(imageUrl, 'Image persistence must return a URL.');
    Assert.areEqual(
      1,
      images.size(),
      'Image discovery must return the saved file.'
    );
    Assert.areEqual(
      'pixel.gif',
      images[0].fileName,
      'Image file name must be retained.'
    );
    Assert.areEqual(
      'gif',
      images[0].fileExtension.toLowerCase(),
      'Image extension must be retained.'
    );
    Assert.isNotNull(
      images[0].contentVersionId,
      'Image option must expose its version identifier.'
    );
    Assert.isNotNull(
      images[0].contentDocumentId,
      'Image option must expose its document identifier.'
    );
  }

  /**
   * @description Verifies generated PDFs are independently saved and linked to a source record.
   */
  @IsTest
  static void savesPdfToFiles() {
    Account account = new Account(Name = 'PDF Account');
    insert account;

    Test.startTest();
    ContentVersion fileVersion = PDFBuilderFileService.savePdf(
      'Account proposal',
      'Account proposal.pdf',
      Blob.valueOf('%PDF-1.4 test'),
      account.Id
    );
    ContentVersion secondVersion = PDFBuilderFileService.savePdf(
      'Account proposal',
      'Account proposal.pdf',
      Blob.valueOf('%PDF-1.4 updated test'),
      account.Id
    );
    Test.stopTest();

    Assert.isNotNull(
      fileVersion.Id,
      'Saved PDF must expose its version identifier.'
    );
    Assert.isNotNull(
      fileVersion.ContentDocumentId,
      'Saved PDF must expose its document identifier.'
    );
    Assert.areNotEqual(
      fileVersion.ContentDocumentId,
      secondVersion.ContentDocumentId,
      'Each generated PDF must be stored as an independent Salesforce File.'
    );
    Assert.areEqual(
      'Account proposal V1',
      fileVersion.Title,
      'The initial PDF must be labelled as version one.'
    );
    Assert.areEqual(
      'Account proposal V1.pdf',
      fileVersion.PathOnClient,
      'The initial PDF file name must include V1.'
    );
    Assert.areEqual(
      'Account proposal V2',
      secondVersion.Title,
      'The next PDF must advance the visible version label.'
    );
    Assert.areEqual(
      'Account proposal V2.pdf',
      secondVersion.PathOnClient,
      'The next PDF file name must include V2.'
    );
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM ContentVersion
        WHERE ContentDocumentId = :fileVersion.ContentDocumentId
      ],
      'The first generated file must contain only its own ContentVersion.'
    );
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM ContentDocumentLink
        WHERE
          ContentDocumentId = :fileVersion.ContentDocumentId
          AND LinkedEntityId = :account.Id
      ],
      'Saved PDF must be linked to the source record.'
    );
  }

  /**
   * @description Saves a Quote PDF once through the standard QuoteDocument object.
   */
  @IsTest
  static void savesQuotePdfWithoutDuplicatingFiles() {
    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
    if (
      !globalDescribe.containsKey('Quote') ||
      !globalDescribe.containsKey('QuoteDocument')
    ) {
      // Quotes is an optional Salesforce feature. The production class must
      // compile and all non-Quote behavior remains covered when it is absent.
      return;
    }

    Account account = new Account(Name = 'Quote PDF Account');
    insert account;
    Opportunity opportunity = new Opportunity(
      Name = 'Quote PDF Opportunity',
      AccountId = account.Id,
      StageName = 'Prospecting',
      CloseDate = Date.today().addDays(30),
      Pricebook2Id = Test.getStandardPricebookId()
    );
    insert opportunity;
    SObject quote = globalDescribe.get('Quote').newSObject();
    quote.put('Name', 'Quote PDF');
    quote.put('OpportunityId', opportunity.Id);
    quote.put('Pricebook2Id', Test.getStandardPricebookId());
    Database.SaveResult quoteSaveResult = Database.insert(
      quote,
      AccessLevel.SYSTEM_MODE
    );
    Assert.isTrue(quoteSaveResult.isSuccess(), 'The Quote fixture must save.');
    Id quoteId = quoteSaveResult.getId();

    Test.startTest();
    ContentVersion fileVersion = PDFBuilderFileService.savePdf(
      'Quote PDF',
      'Quote_PDF.pdf',
      Blob.valueOf('%PDF-1.4 quote test'),
      quoteId
    );
    Test.stopTest();

    List<SObject> quotePdfs = Database.query(
      'SELECT QuoteId, ContentVersionDocumentId FROM QuoteDocument WHERE QuoteId = :quoteId LIMIT 1'
    );
    Id quoteContentVersionId = (Id) quotePdfs[0]
      .get('ContentVersionDocumentId');
    Assert.areEqual(
      fileVersion.Id,
      quoteContentVersionId,
      'Quote PDFs and Files must reference the same generated version.'
    );
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM ContentVersion
        WHERE ContentDocumentId = :fileVersion.ContentDocumentId
      ],
      'The initial Quote PDF must create only one binary version.'
    );
    Assert.areEqual(
      1,
      [
        SELECT COUNT()
        FROM ContentDocumentLink
        WHERE
          LinkedEntityId = :quoteId
          AND ContentDocumentId = :fileVersion.ContentDocumentId
      ],
      'The Quote must receive only one link to the generated document.'
    );
  }

  /**
   * @description Verifies distribution lookup and bulk creation for rendered image files.
   */
  @IsTest
  static void createsAndReusesImageDistributions() {
    ContentVersion imageVersion = new ContentVersion(
      Title = 'distribution-image.png',
      PathOnClient = 'distribution-image.png',
      VersionData = Blob.valueOf('distribution-image')
    );
    insert imageVersion;

    String withoutCreation;
    String firstUrl;
    String secondUrl;
    Integer distributionCount;
    String missingVersionUrl;
    Test.startTest();
    withoutCreation = PDFBuilderFileService.getDistributionUrl(
      imageVersion.Id,
      false
    );
    PDFBuilderFileService.ensureDistributions(new Set<Id>{ imageVersion.Id });
    firstUrl = PDFBuilderFileService.getDistributionUrl(imageVersion.Id, false);
    secondUrl = PDFBuilderFileService.getDistributionUrl(imageVersion.Id, true);
    distributionCount = [
      SELECT COUNT()
      FROM ContentDistribution
      WHERE ContentVersionId = :imageVersion.Id
    ];
    PDFBuilderFileService.ensureDistributions(null);
    PDFBuilderFileService.ensureDistributions(new Set<Id>());
    missingVersionUrl = PDFBuilderFileService.getDistributionUrl(null, true);
    Test.stopTest();

    Assert.areEqual(
      '',
      withoutCreation,
      'Lookup without creation must not create a distribution.'
    );
    Assert.isFalse(
      String.isBlank(firstUrl),
      'Created distribution must expose a URL.'
    );
    Assert.areEqual(
      firstUrl,
      secondUrl,
      'Existing distributions must be reused.'
    );
    Assert.areEqual(
      1,
      distributionCount,
      'Only one distribution must exist for the file version.'
    );
    Assert.areEqual(
      '',
      missingVersionUrl,
      'A missing file identifier must return an empty URL.'
    );
  }
}
