/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Centralizes Salesforce Files persistence and image discovery for PDF Builder.
 */
public with sharing class PDFBuilderFileService {
  /**
   * Inserts an image ContentVersion and returns detailed save errors to the facade.
   *
   * @param imageVersion Image file version to insert.
   * @return Database save result.
   */
  public static Database.SaveResult insertImage(ContentVersion imageVersion) {
    return Database.insert(imageVersion, false, AccessLevel.USER_MODE);
  }

  /**
   * Returns latest Salesforce image files matching an optional title search.
   *
   * @param searchTerm Optional title search.
   * @param supportedFileTypes Allowed Salesforce FileType values.
   * @param queryLimit Maximum number of files to return.
   * @return Latest matching ContentVersion records.
   */
  public static List<ContentVersion> getLatestImages(
    String searchTerm,
    Set<String> supportedFileTypes,
    Integer queryLimit
  ) {
    String normalizedSearch = String.isBlank(searchTerm)
      ? ''
      : searchTerm.trim();

    if (normalizedSearch == '') {
      return [
        SELECT
          Id,
          ContentDocumentId,
          Title,
          FileExtension,
          ContentSize,
          LastModifiedDate
        FROM ContentVersion
        WHERE IsLatest = TRUE AND FileType IN :supportedFileTypes
        WITH USER_MODE
        ORDER BY LastModifiedDate DESC
        LIMIT :queryLimit
      ];
    }

    String searchPattern = '%' + normalizedSearch + '%';

    return [
      SELECT
        Id,
        ContentDocumentId,
        Title,
        FileExtension,
        ContentSize,
        LastModifiedDate
      FROM ContentVersion
      WHERE
        IsLatest = TRUE
        AND FileType IN :supportedFileTypes
        AND Title LIKE :searchPattern
      WITH USER_MODE
      ORDER BY LastModifiedDate DESC
      LIMIT :queryLimit
    ];
  }

  /**
   * Saves a generated PDF.
   *
   * Quotes are saved through QuoteDocument so that the generated PDF appears
   * in the standard Quote PDFs related list.
   *
   * Other objects use Salesforce Files with an independent ContentDocument
   * for each generated PDF.
   */
  public static ContentVersion savePdf(
    String title,
    String fileName,
    Blob pdfData,
    Id recordId
  ) {
    /*
     * QuoteDocument is deliberately handled in system context.
     *
     * Guest Users cannot create QuoteDocument themselves, but for this
     * demo application we want the generated PDF to appear in Quote PDFs.
     */
    if (isQuoteRecord(recordId) && isQuoteDocumentAvailable()) {
      return saveQuotePdf(pdfData, recordId);
    }

    /*
     * For regular Salesforce Files, each generated PDF is an independent
     * ContentDocument.
     *
     * This is important for Guest Users because they cannot reliably
     * create a new ContentVersion on an existing ContentDocument.
     */
    Integer nextVersionNumber = getNextPdfSequenceNumber(title, recordId);

    String versionedTitle = title + ' V' + nextVersionNumber;

    String versionedFileName = appendPdfVersion(fileName, nextVersionNumber);

    ContentVersion fileVersion = new ContentVersion(
      Title = versionedTitle,
      PathOnClient = versionedFileName,
      VersionData = pdfData,
      FirstPublishLocationId = recordId
    );

    insert as user fileVersion;

    return [
      SELECT Id, ContentDocumentId, Title, PathOnClient, VersionNumber
      FROM ContentVersion
      WHERE Id = :fileVersion.Id
      WITH USER_MODE
      LIMIT 1
    ];
  }

  /**
   * Saves a Quote PDF through QuoteDocument.
   *
   * QuoteDocument causes Salesforce to create the ContentVersion and associate
   * it with the Quote's standard Quote PDFs related list.
   *
   * This method intentionally uses SYSTEM MODE so that it can also be invoked
   * from an Experience Cloud Guest User.
   */
  private static ContentVersion saveQuotePdf(Blob pdfData, Id quoteId) {
    Schema.SObjectType quoteDocumentType = Schema.getGlobalDescribe()
      .get('QuoteDocument');

    if (quoteDocumentType == null) {
      throw new AuraHandledException(
        'QuoteDocument is not available in this org.'
      );
    }

    SObject quotePdf = quoteDocumentType.newSObject();

    quotePdf.put('QuoteId', quoteId);

    quotePdf.put('Document', pdfData);

    /*
     * SYSTEM MODE.
     *
     * Do NOT use:
     *
     * insert as user quotePdf;
     *
     * because Guest Users can't insert QuoteDocument.
     */
    insert quotePdf;

    Id quoteDocumentId = (Id) quotePdf.get('Id');

    /*
     * Also SYSTEM MODE.
     *
     * Guest Users don't have direct access to QuoteDocument, so
     * WITH USER_MODE must not be used here.
     */
    List<SObject> quoteDocuments = Database.query(
      'SELECT ContentVersionDocumentId ' +
        'FROM QuoteDocument ' +
        'WHERE Id = :quoteDocumentId ' +
        'LIMIT 1'
    );

    if (quoteDocuments.isEmpty()) {
      throw new AuraHandledException(
        'The Quote PDF was created but its ContentVersion could not be resolved.'
      );
    }

    Id contentVersionId = (Id) quoteDocuments[0]
      .get('ContentVersionDocumentId');

    /*
     * SYSTEM MODE query for the generated ContentVersion as well,
     * because a Guest may not have direct visibility on the file
     * immediately after QuoteDocument creation.
     */
    List<ContentVersion> generatedVersions = [
      SELECT Id, ContentDocumentId, Title, PathOnClient, VersionNumber
      FROM ContentVersion
      WHERE Id = :contentVersionId
      LIMIT 1
    ];

    if (generatedVersions.isEmpty()) {
      throw new AuraHandledException(
        'The Quote PDF ContentVersion could not be found.'
      );
    }

    return generatedVersions[0];
  }

  /**
   * Detects Quote without creating a compile-time dependency on the optional
   * Salesforce Quotes feature.
   */
  private static Boolean isQuoteRecord(Id recordId) {
    if (recordId == null) {
      return false;
    }

    Schema.SObjectType quoteType = Schema.getGlobalDescribe().get('Quote');

    return quoteType != null && recordId.getSObjectType() == quoteType;
  }

  /**
   * QuoteDocument is exposed only in orgs where Salesforce Quotes is enabled.
   */
  private static Boolean isQuoteDocumentAvailable() {
    return Schema.getGlobalDescribe().containsKey('QuoteDocument');
  }

  /**
   * Calculates the next logical PDF sequence number for a record.
   *
   * We intentionally read V1 / V2 / V3 from the file title instead of using
   * ContentVersion.VersionNumber because every generated PDF can be a separate
   * ContentDocument.
   */
  private static Integer getNextPdfSequenceNumber(String title, Id recordId) {
    if (String.isBlank(title) || recordId == null) {
      return 1;
    }

    Set<Id> linkedDocumentIds = new Set<Id>();

    for (ContentDocumentLink link : [
      SELECT ContentDocumentId
      FROM ContentDocumentLink
      WHERE LinkedEntityId = :recordId
      WITH USER_MODE
      LIMIT 2000
    ]) {
      linkedDocumentIds.add(link.ContentDocumentId);
    }

    if (linkedDocumentIds.isEmpty()) {
      return 1;
    }

    List<ContentVersion> linkedPdfVersions = [
      SELECT ContentDocumentId, Title
      FROM ContentVersion
      WHERE
        IsLatest = TRUE
        AND ContentDocumentId IN :linkedDocumentIds
        AND FileType = 'PDF'
      WITH USER_MODE
      LIMIT 2000
    ];

    Integer maxVersionNumber = 0;

    String versionPrefix = title + ' V';

    for (ContentVersion version : linkedPdfVersions) {
      if (String.isBlank(version.Title)) {
        continue;
      }

      /*
       * Compatibility with files created before V1/V2 naming
       * was introduced.
       */
      if (version.Title == title) {
        maxVersionNumber = Math.max(maxVersionNumber, 1);

        continue;
      }

      if (!version.Title.startsWith(versionPrefix)) {
        continue;
      }

      String versionText = version.Title.substring(versionPrefix.length());

      if (!isPositiveInteger(versionText)) {
        continue;
      }

      Integer versionNumber = Integer.valueOf(versionText);

      maxVersionNumber = Math.max(maxVersionNumber, versionNumber);
    }

    return maxVersionNumber + 1;
  }

  /**
   * Checks whether a String is an integer greater than zero.
   */
  private static Boolean isPositiveInteger(String value) {
    if (String.isBlank(value)) {
      return false;
    }

    try {
      return Integer.valueOf(value) > 0;
    } catch (Exception ignored) {
      return false;
    }
  }

  /**
   * Adds the logical version to the generated PDF filename.
   *
   * Example:
   *
   * proposal.pdf -> proposal V3.pdf
   */
  private static String appendPdfVersion(
    String fileName,
    Integer versionNumber
  ) {
    String normalizedFileName = String.isBlank(fileName)
      ? 'document.pdf'
      : fileName.trim();

    String baseName = normalizedFileName.toLowerCase().endsWith('.pdf')
      ? normalizedFileName.substring(0, normalizedFileName.length() - 4)
      : normalizedFileName;

    return baseName + ' V' + versionNumber + '.pdf';
  }

  /**
   * Creates missing public distributions for the supplied file versions.
   *
   * @param versionIds ContentVersion identifiers found in rendered HTML.
   */
  public static void ensureDistributions(Set<Id> versionIds) {
    if (versionIds == null || versionIds.isEmpty()) {
      return;
    }

    Set<Id> existingVersionIds = new Map<Id, ContentVersion>(
        [
          SELECT Id
          FROM ContentVersion
          WHERE Id IN :versionIds
          WITH USER_MODE
        ]
      )
      .keySet();

    if (existingVersionIds.isEmpty()) {
      return;
    }

    Set<Id> distributedVersionIds = new Set<Id>();

    for (ContentDistribution distribution : [
      SELECT ContentVersionId
      FROM ContentDistribution
      WHERE ContentVersionId IN :existingVersionIds
      WITH USER_MODE
    ]) {
      distributedVersionIds.add(distribution.ContentVersionId);
    }

    List<ContentDistribution> distributionsToInsert = new List<ContentDistribution>();

    for (Id versionId : existingVersionIds) {
      if (!distributedVersionIds.contains(versionId)) {
        distributionsToInsert.add(createDistribution(versionId));
      }
    }

    if (!distributionsToInsert.isEmpty()) {
      Database.insert(distributionsToInsert, false, AccessLevel.USER_MODE);
    }
  }

  /**
   * Resolves an existing public file URL and optionally creates one.
   *
   * @param contentVersionId File version identifier.
   * @param allowCreate Whether a missing distribution may be created.
   * @return Public download URL, or an empty value when unavailable.
   */
  public static String getDistributionUrl(
    Id contentVersionId,
    Boolean allowCreate
  ) {
    if (
      contentVersionId == null ||
      [
        SELECT COUNT()
        FROM ContentVersion
        WHERE Id = :contentVersionId
        WITH USER_MODE
      ] == 0
    ) {
      return '';
    }

    List<ContentDistribution> existingDistributions = [
      SELECT ContentDownloadUrl
      FROM ContentDistribution
      WHERE ContentVersionId = :contentVersionId
      WITH USER_MODE
      ORDER BY CreatedDate DESC
      LIMIT 1
    ];

    if (
      !existingDistributions.isEmpty() &&
      !String.isBlank(existingDistributions[0].ContentDownloadUrl)
    ) {
      return existingDistributions[0].ContentDownloadUrl;
    }

    if (!allowCreate) {
      return '';
    }

    ContentDistribution distribution = createDistribution(contentVersionId);

    insert as user distribution;

    ContentDistribution savedDistribution = [
      SELECT ContentDownloadUrl
      FROM ContentDistribution
      WHERE Id = :distribution.Id
      WITH USER_MODE
      LIMIT 1
    ];

    return savedDistribution.ContentDownloadUrl;
  }

  /**
   * Builds a public distribution with the compatibility settings used by PDFs.
   *
   * @param contentVersionId File version identifier.
   * @return Unsaved ContentDistribution record.
   */
  private static ContentDistribution createDistribution(Id contentVersionId) {
    return new ContentDistribution(
      Name = 'PDF Builder Image',
      ContentVersionId = contentVersionId,
      PreferencesAllowOriginalDownload = true,
      PreferencesAllowViewInBrowser = true,
      PreferencesLinkLatestVersion = false,
      PreferencesNotifyOnVisit = false,
      PreferencesPasswordRequired = false
    );
  }
}
