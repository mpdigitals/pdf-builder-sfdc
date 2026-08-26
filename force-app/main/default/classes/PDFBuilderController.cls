/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Provides the stable LWC facade and PDF orchestration for PDF Builder.
 */
public with sharing class PDFBuilderController {
  private static final PDFBuilderConfiguration.Settings SETTINGS = PDFBuilderConfiguration.getSettings();
  private static final Integer PDF_SOURCE_REGION_GAP = 0;
  // The builder and the Visualforce page use the same CSS-pixel coordinate
  // system. Scaling font sizes again creates false page breaks.
  // Visualforce's PDF Arial metrics are slightly taller/wider than the
  // browser metrics used by the builder. A small compensation keeps the
  // same wrapping and prevents the last line spilling onto another page.
  private static Boolean allowContentDistributionDml = true;
  private static Boolean organizationMergeRecordLoaded = false;
  private static Organization organizationMergeRecord;
  private static Boolean currentUserMergeRecordLoaded = false;
  private static User currentUserMergeRecord;

  private static void resetPdfPageLayoutContext() {
    PDFBuilderPdfPageController.fixedHeaderHtmlForRender = null;
    PDFBuilderPdfPageController.fixedFooterHtmlForRender = null;
    PDFBuilderPdfPageController.pageTopMarginForRender = 0;
    PDFBuilderPdfPageController.pageRightMarginForRender = 0;
    PDFBuilderPdfPageController.pageBottomMarginForRender = 0;
    PDFBuilderPdfPageController.pageLeftMarginForRender = 0;
    PDFBuilderPdfPageController.pageContentWidthForRender = SETTINGS.pageWidth;
    PDFBuilderPdfPageController.pageBackgroundForRender = '#ffffff';
  }

  private static void mergePdfPageLayoutGlobalFields() {
    PDFBuilderPdfPageController.fixedHeaderHtmlForRender = mergeGlobalFields(
      PDFBuilderPdfPageController.fixedHeaderHtmlForRender
    );
    PDFBuilderPdfPageController.fixedFooterHtmlForRender = mergeGlobalFields(
      PDFBuilderPdfPageController.fixedFooterHtmlForRender
    );
  }

  private static void mergePdfPageLayoutRecordFields(
    Id recordId,
    String objectApiName
  ) {
    PDFBuilderPdfPageController.fixedHeaderHtmlForRender = mergeRelatedListTables(
      mergeRecordFields(
        PDFBuilderPdfPageController.fixedHeaderHtmlForRender,
        recordId,
        objectApiName
      ),
      recordId,
      objectApiName
    );
    PDFBuilderPdfPageController.fixedFooterHtmlForRender = mergeRelatedListTables(
      mergeRecordFields(
        PDFBuilderPdfPageController.fixedFooterHtmlForRender,
        recordId,
        objectApiName
      ),
      recordId,
      objectApiName
    );
  }

  public class ObjectOption {
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String apiName;
    @AuraEnabled
    public Boolean custom;

    public ObjectOption(String label, String apiName, Boolean custom) {
      this.label = label;
      this.apiName = apiName;
      this.custom = custom;
    }
  }

  public class FieldOption {
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String apiName;
    @AuraEnabled
    public String dataType;
    @AuraEnabled
    public String placeholder;

    public FieldOption(
      String label,
      String apiName,
      String dataType,
      String objectApiName
    ) {
      this.label = label;
      this.apiName = apiName;
      this.dataType = dataType;
      this.placeholder = '{!' + objectApiName + '.' + apiName + '}';
    }
  }

  public class RelatedListOption {
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String relationshipName;
    @AuraEnabled
    public String childObjectApiName;

    public RelatedListOption(
      String label,
      String relationshipName,
      String childObjectApiName
    ) {
      this.label = label;
      this.relationshipName = relationshipName;
      this.childObjectApiName = childObjectApiName;
    }
  }

  public class TemplateSummary {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String objectApiName;

    public TemplateSummary(PDFBuilderTemplate__c template) {
      this.id = template.Id;
      this.name = template.Name;
      this.objectApiName = template.ObjectApiName__c;
    }
  }

  public class TemplateDetail {
    @AuraEnabled
    public Id id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String objectApiName;
    @AuraEnabled
    public String contentJson;
    @AuraEnabled
    public String generatedHtml;

    public TemplateDetail(PDFBuilderTemplate__c template) {
      this.id = template.Id;
      this.name = template.Name;
      this.objectApiName = template.ObjectApiName__c;
      this.contentJson = template.ContentJson__c;
      this.generatedHtml = template.GeneratedHtml__c;
    }
  }

  public class PdfResult {
    @AuraEnabled
    public String fileName;
    @AuraEnabled
    public String base64Data;
    @AuraEnabled
    public String warning;

    public PdfResult(String fileName, String base64Data, String warning) {
      this.fileName = fileName;
      this.base64Data = base64Data;
      this.warning = warning;
    }
  }

  public class PdfFileResult {
    @AuraEnabled
    public String fileName;
    @AuraEnabled
    public Id contentVersionId;
    @AuraEnabled
    public Id contentDocumentId;
    @AuraEnabled
    public String warning;

    public PdfFileResult(
      String fileName,
      Id contentVersionId,
      Id contentDocumentId,
      String warning
    ) {
      this.fileName = fileName;
      this.contentVersionId = contentVersionId;
      this.contentDocumentId = contentDocumentId;
      this.warning = warning;
    }
  }

  public class SalesforceImageFileOption {
    @AuraEnabled
    public Id contentVersionId;
    @AuraEnabled
    public Id contentDocumentId;
    @AuraEnabled
    public String fileName;
    @AuraEnabled
    public String fileExtension;
    @AuraEnabled
    public Long contentSize;
    @AuraEnabled
    public Datetime lastModifiedDate;
    @AuraEnabled
    public String thumbnailUrl;
    @AuraEnabled
    public String downloadUrl;

    public SalesforceImageFileOption(ContentVersion version) {
      this.contentVersionId = version.Id;
      this.contentDocumentId = version.ContentDocumentId;
      this.fileExtension = version.FileExtension;
      this.contentSize = version.ContentSize;
      this.lastModifiedDate = version.LastModifiedDate;

      String extension = String.isBlank(version.FileExtension)
        ? ''
        : '.' + version.FileExtension.toLowerCase();
      this.fileName = version.Title != null &&
        version.Title.toLowerCase().endsWith(extension)
        ? version.Title
        : version.Title + extension;
      this.downloadUrl = getContentVersionDownloadPath(version.Id);
      this.thumbnailUrl =
        '/sfc/servlet.shepherd/version/renditionDownload' +
        '?rendition=THUMB720BY480&versionId=' +
        String.valueOf(version.Id);
    }
  }

  public class PreviewFlowResult {
    @AuraEnabled
    public String headerHtml;
    @AuraEnabled
    public String bodyHtml;
    @AuraEnabled
    public String footerHtml;

    public PreviewFlowResult(
      String headerHtml,
      String bodyHtml,
      String footerHtml
    ) {
      this.headerHtml = headerHtml;
      this.bodyHtml = bodyHtml;
      this.footerHtml = footerHtml;
    }
  }

  /**
   * Returns the resolved configuration shared by Apex and the builder LWC.
   *
   * @return Current PDF Builder settings.
   */
  @AuraEnabled(cacheable=true)
  public static PDFBuilderConfiguration.Settings getConfiguration() {
    return SETTINGS;
  }

  @AuraEnabled(cacheable=true)
  public static List<ObjectOption> getObjects() {
    List<ObjectOption> options = new List<ObjectOption>();
    for (
      PDFBuilderDescribeService.ObjectDescriptor descriptor : PDFBuilderDescribeService.getObjects(
        SETTINGS.preferredObjects,
        SETTINGS.includeCustomObjects
      )
    ) {
      options.add(
        new ObjectOption(
          descriptor.label,
          descriptor.apiName,
          descriptor.custom
        )
      );
    }
    return options;
  }

  @AuraEnabled(cacheable=true)
  public static List<FieldOption> getFields(
    String objectApiName,
    String searchTerm
  ) {
    if (String.isBlank(objectApiName)) {
      return new List<FieldOption>();
    }

    List<FieldOption> fields = new List<FieldOption>();
    for (
      PDFBuilderDescribeService.FieldDescriptor descriptor : PDFBuilderDescribeService.getFields(
        objectApiName,
        searchTerm
      )
    ) {
      fields.add(
        new FieldOption(
          descriptor.label,
          descriptor.apiName,
          descriptor.dataType,
          objectApiName
        )
      );
    }
    return fields;
  }

  @AuraEnabled(cacheable=true)
  public static List<RelatedListOption> getRelatedLists(String objectApiName) {
    if (String.isBlank(objectApiName)) {
      return new List<RelatedListOption>();
    }

    List<RelatedListOption> options = new List<RelatedListOption>();
    for (
      PDFBuilderDescribeService.RelatedListDescriptor descriptor : PDFBuilderDescribeService.getRelatedLists(
        objectApiName
      )
    ) {
      options.add(
        new RelatedListOption(
          descriptor.label,
          descriptor.relationshipName,
          descriptor.childObjectApiName
        )
      );
    }
    return options;
  }

  @AuraEnabled(cacheable=true)
  public static List<FieldOption> getRelatedListFields(
    String childObjectApiName,
    String searchTerm
  ) {
    if (String.isBlank(childObjectApiName)) {
      return new List<FieldOption>();
    }

    List<FieldOption> fields = new List<FieldOption>();
    for (
      PDFBuilderDescribeService.FieldDescriptor descriptor : PDFBuilderDescribeService.getRelatedListFields(
        childObjectApiName,
        searchTerm
      )
    ) {
      fields.add(
        new FieldOption(
          descriptor.label,
          descriptor.apiName,
          descriptor.dataType,
          childObjectApiName
        )
      );
    }
    return fields;
  }

  @AuraEnabled
  public static List<TemplateSummary> getTemplates() {
    List<TemplateSummary> templates = new List<TemplateSummary>();

    for (
      PDFBuilderTemplate__c template : PDFBuilderTemplateRepository.getRecent(
        SETTINGS.templateQueryLimit
      )
    ) {
      templates.add(new TemplateSummary(template));
    }

    return templates;
  }

  @AuraEnabled
  public static List<TemplateSummary> getTemplatesForObject(
    String objectApiName
  ) {
    if (String.isBlank(objectApiName)) {
      return new List<TemplateSummary>();
    }

    List<TemplateSummary> templates = new List<TemplateSummary>();

    for (
      PDFBuilderTemplate__c template : PDFBuilderTemplateRepository.getForObject(
        objectApiName,
        SETTINGS.templateQueryLimit
      )
    ) {
      templates.add(new TemplateSummary(template));
    }

    return templates;
  }

  @AuraEnabled
  public static TemplateDetail getTemplate(Id templateId) {
    if (templateId == null) {
      throw new AuraHandledException('Template id is required.');
    }

    return new TemplateDetail(
      PDFBuilderTemplateRepository.getRequired(templateId)
    );
  }

  @AuraEnabled
  public static Id saveTemplate(
    Id templateId,
    String name,
    String objectApiName,
    String contentJson,
    String generatedHtml
  ) {
    if (String.isBlank(name)) {
      throw new AuraHandledException('Template name is required.');
    }

    if (String.isBlank(objectApiName)) {
      throw new AuraHandledException('Template object is required.');
    }

    objectApiName = objectApiName.trim();

    Map<String, Schema.SObjectType> objectMap = Schema.getGlobalDescribe();
    if (
      !objectMap.containsKey(objectApiName) ||
      !isObjectAvailable(
        objectMap.get(objectApiName)
          .getDescribe(SObjectDescribeOptions.DEFERRED)
      )
    ) {
      throw new AuraHandledException(
        'Template object is not available: ' + objectApiName
      );
    }

    if (name.trim().length() > 80) {
      throw new AuraHandledException(
        'Template name must be 80 characters or fewer.'
      );
    }

    validateLongTextSize('Template content', contentJson);
    validateLongTextSize('Generated HTML', generatedHtml);

    PDFBuilderTemplate__c template = templateId == null
      ? new PDFBuilderTemplate__c()
      : new PDFBuilderTemplate__c(Id = templateId);

    template.Name = name.trim();
    template.ObjectApiName__c = objectApiName;
    template.ContentJson__c = contentJson;
    template.GeneratedHtml__c = generatedHtml;

    try {
      PDFBuilderTemplateRepository.save(template);
    } catch (DmlException error) {
      throw new AuraHandledException(error.getDmlMessage(0));
    }

    return template.Id;
  }

  @AuraEnabled
  public static void deleteTemplate(Id templateId) {
    if (templateId == null) {
      throw new AuraHandledException('Template id is required.');
    }

    if (
      !PDFBuilderTemplate__c.SObjectType.getDescribe(
          SObjectDescribeOptions.DEFERRED
        )
        .isDeletable()
    ) {
      throw new AuraHandledException(
        'You do not have permission to delete templates.'
      );
    }

    PDFBuilderTemplate__c template = PDFBuilderTemplateRepository.findById(
      templateId
    );
    if (template == null) {
      throw new AuraHandledException(
        'The selected template is no longer available.'
      );
    }

    try {
      PDFBuilderTemplateRepository.remove(template);
    } catch (DmlException error) {
      throw new AuraHandledException(error.getDmlMessage(0));
    }
  }

  @AuraEnabled
  public static String saveTemplateImage(
    String fileName,
    String base64Data,
    String contentType
  ) {
    if (String.isBlank(base64Data)) {
      throw new AuraHandledException('Image data is required.');
    }

    String normalizedFileName = sanitizeFileName(
      String.isBlank(fileName) ? 'template-image' : fileName
    );
    normalizedFileName = ensureImageFileExtension(
      normalizedFileName,
      contentType
    );

    ContentVersion imageVersion;

    try {
      imageVersion = new ContentVersion(
        Title = normalizedFileName,
        PathOnClient = normalizedFileName,
        VersionData = EncodingUtil.base64Decode(base64Data)
      );
      Database.SaveResult saveResult = PDFBuilderFileService.insertImage(
        imageVersion
      );

      if (!saveResult.isSuccess()) {
        Database.Error saveError = saveResult.getErrors()[0];
        String errorMessage = saveError.getMessage();

        if (
          saveError.getStatusCode() == StatusCode.STORAGE_LIMIT_EXCEEDED ||
          (!String.isBlank(errorMessage) &&
          errorMessage.toLowerCase().contains('storage limit'))
        ) {
          throw new AuraHandledException(
            'Salesforce file storage is full. Delete unused files or increase the organization storage limit before uploading another image.'
          );
        }

        throw new AuraHandledException(
          'The image could not be saved: ' + errorMessage
        );
      }
    } catch (Exception error) {
      if (error instanceof AuraHandledException) {
        throw error;
      }
      throw new AuraHandledException(
        'The image could not be saved: ' + error.getMessage()
      );
    }

    String imageUrl = getContentVersionDownloadPath(imageVersion.Id);

    try {
      String distributionUrl = getContentDistributionUrl(imageVersion.Id);
      if (!String.isBlank(distributionUrl)) {
        imageUrl = distributionUrl;
      }
    } catch (Exception error) {
      imageUrl = getContentVersionDownloadPath(imageVersion.Id);
    }

    return imageUrl;
  }

  @AuraEnabled(cacheable=true)
  public static List<SalesforceImageFileOption> getSalesforceImageFiles(
    String searchTerm
  ) {
    if (
      !ContentVersion.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
        .isAccessible()
    ) {
      throw new AuraHandledException(
        'You do not have permission to view Salesforce Files.'
      );
    }

    Set<String> supportedFileTypes = new Set<String>(
      SETTINGS.supportedImageTypes
    );
    List<ContentVersion> versions = PDFBuilderFileService.getLatestImages(
      searchTerm,
      supportedFileTypes,
      SETTINGS.imageQueryLimit
    );

    List<SalesforceImageFileOption> files = new List<SalesforceImageFileOption>();
    for (ContentVersion version : versions) {
      files.add(new SalesforceImageFileOption(version));
    }
    return files;
  }

  @AuraEnabled
  public static PdfResult generatePdf(Id templateId, Id recordId) {
    if (templateId == null || recordId == null) {
      throw new AuraHandledException('Template and record are required.');
    }

    PDFBuilderTemplate__c template = PDFBuilderTemplateRepository.getRequired(
      templateId
    );

    if (
      String.isBlank(template.ContentJson__c) &&
      String.isBlank(template.GeneratedHtml__c)
    ) {
      throw new AuraHandledException(
        'The selected template does not have content.'
      );
    }

    PdfResult pdfResult = convertTemplateToVisualforcePdf(template, recordId);

    return pdfResult;
  }

  @AuraEnabled
  public static PdfFileResult generatePdfToFiles(Id templateId, Id recordId) {
    if (
      !ContentVersion.SObjectType.getDescribe(SObjectDescribeOptions.DEFERRED)
        .isCreateable()
    ) {
      throw new AuraHandledException(
        'You do not have permission to save files.'
      );
    }

    PdfResult pdfResult = generatePdf(templateId, recordId);
    Blob pdfData = EncodingUtil.base64Decode(pdfResult.base64Data);
    pdfResult.base64Data = null;
    String title = getRecordNameForPdf(recordId);
    if (String.isBlank(title)) {
      String generatedFileName = String.isBlank(pdfResult.fileName)
        ? 'document.pdf'
        : pdfResult.fileName;
      title = generatedFileName.toLowerCase().endsWith('.pdf')
        ? generatedFileName.substring(0, generatedFileName.length() - 4)
        : generatedFileName;
    }
    String fileName = buildPdfFileName(recordId, title);

    ContentVersion fileVersion;
    try {
      fileVersion = PDFBuilderFileService.savePdf(
        title,
        fileName,
        pdfData,
        recordId
      );
    } catch (DmlException error) {
      throw new AuraHandledException(error.getDmlMessage(0));
    }
    fileName = fileVersion.PathOnClient;

    return new PdfFileResult(
      fileName,
      fileVersion.Id,
      fileVersion.ContentDocumentId,
      pdfResult.warning
    );
  }

  /**
   * Returns the source record Name used as the Salesforce Files PDF title.
   */
  @TestVisible
  private static String getRecordNameForPdf(Id recordId) {
    if (recordId == null) {
      return null;
    }

    Schema.DescribeSObjectResult objectDescribe = recordId
      .getSObjectType()
      .getDescribe(SObjectDescribeOptions.DEFERRED);
    Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();
    if (
      !fieldMap.containsKey('Name') ||
      !fieldMap.get('Name').getDescribe().isAccessible()
    ) {
      return null;
    }

    SObject sourceRecord = Database.query(
      'SELECT Name FROM ' +
        objectDescribe.getName() +
        ' WHERE Id = :recordId WITH USER_MODE LIMIT 1'
    );
    Object nameValue = sourceRecord.get('Name');
    return nameValue == null ? null : String.valueOf(nameValue).trim();
  }

  /**
   * Returns a safe PDF file name based on the source record Name.
   */
  @TestVisible
  private static String buildPdfFileName(Id recordId, String fallbackName) {
    String recordName = getRecordNameForPdf(recordId);
    String sourceName = String.isBlank(recordName) ? fallbackName : recordName;
    if (String.isBlank(sourceName)) {
      return 'document.pdf';
    }

    String sanitized = sourceName.trim().replaceAll('[\\/:*?"<>|]+', '_');
    sanitized = sanitized.replaceAll('[. ]+$', '');
    return (String.isBlank(sanitized) ? 'document' : sanitized) + '.pdf';
  }

  public static String renderTemplateBodyForRecord(Id templateId, Id recordId) {
    PDFBuilderTemplate__c template = PDFBuilderTemplateRepository.getRequired(
      templateId
    );

    return renderTemplateBodyForRecord(template, recordId);
  }

  public static String renderTemplateBodyHtmlForPdf(
    Id templateId,
    Id recordId
  ) {
    Boolean previousAllowContentDistributionDml = allowContentDistributionDml;

    try {
      allowContentDistributionDml = false;
      return preparePdfBodyHtml(
        renderTemplateBodyForRecord(templateId, recordId),
        true
      );
    } finally {
      allowContentDistributionDml = previousAllowContentDistributionDml;
    }
  }

  @AuraEnabled
  public static String renderTemplateBodyHtmlForPreview(
    String contentJson,
    String generatedHtml
  ) {
    String bodyHtml = buildTemplateBodyHtml(contentJson, generatedHtml);

    Boolean previousAllowContentDistributionDml = allowContentDistributionDml;

    try {
      allowContentDistributionDml = false;
      return preparePdfBodyHtml(bodyHtml, true);
    } finally {
      allowContentDistributionDml = previousAllowContentDistributionDml;
    }
  }

  @AuraEnabled
  public static String renderGeneratedHtmlForRecordPreview(
    String objectApiName,
    Id recordId,
    String contentJson,
    String generatedHtml
  ) {
    if (recordId == null) {
      throw new AuraHandledException('Record is required for preview.');
    }
    if (String.isBlank(objectApiName)) {
      throw new AuraHandledException('Object is required for preview.');
    }

    objectApiName = objectApiName.trim();
    String recordObjectApiName = recordId.getSObjectType()
      .getDescribe(SObjectDescribeOptions.DEFERRED)
      .getName();
    if (objectApiName != recordObjectApiName) {
      throw new AuraHandledException(
        'The Record ID belongs to ' +
          recordObjectApiName +
          ', not ' +
          objectApiName +
          '.'
      );
    }

    validateLongTextSize('Preview content', contentJson);
    validateLongTextSize('Preview HTML', generatedHtml);

    // Preview is displayed by the browser, not by Visualforce's Flying
    // Saucer PDF engine. Keep the browser geometry generated by the LWC:
    // PDF-only font compensation and fixed box metrics clip text here.
    String previewHtml = mergeGlobalFields(generatedHtml);
    previewHtml = mergeRecordFields(previewHtml, recordId, objectApiName);
    previewHtml = mergeRelatedListTables(
      previewHtml,
      recordId,
      objectApiName,
      false
    );
    return sanitizeLwcRuntimeArtifacts(previewHtml);
  }

  @AuraEnabled
  public static PdfResult generatePreviewPdf(
    String contentJson,
    String generatedHtml
  ) {
    String bodyHtml = buildTemplateBodyHtml(contentJson, generatedHtml);

    ensureContentDistributionsForHtml(bodyHtml);

    List<String> attempts = new List<String>{
      preparePdfBodyHtml(bodyHtml, true),
      preparePdfBodyHtml(bodyHtml, false),
      preparePdfBodyHtml(stripHtmlToText(bodyHtml), false)
    };
    List<String> warnings = new List<String>{
      null,
      'Generated without images because the Visualforce PDF renderer rejected one or more image sources.',
      'Generated as text-only because the Visualforce PDF renderer rejected the template HTML.'
    };

    for (Integer index = 0; index < attempts.size(); index += 1) {
      try {
        Blob pdf = renderVisualforcePdfForPreview(attempts[index]);
        return new PdfResult(
          'preview.pdf',
          EncodingUtil.base64Encode(pdf),
          warnings[index]
        );
      } catch (Exception error) {
        logPdfRenderFailure(index, error);
      }
    }

    throw new AuraHandledException(
      'The Visualforce PDF could not be generated even as text-only content.'
    );
  }

  @AuraEnabled
  public static PdfResult generatePreviewPdfForRecord(
    String objectApiName,
    Id recordId,
    String contentJson,
    String generatedHtml
  ) {
    if (recordId == null) {
      throw new AuraHandledException('Record is required for preview.');
    }
    if (String.isBlank(objectApiName)) {
      throw new AuraHandledException('Object is required for preview.');
    }

    String bodyHtml = buildTemplateBodyHtml(contentJson, generatedHtml);
    bodyHtml = mergeRecordFields(bodyHtml, recordId, objectApiName.trim());
    mergePdfPageLayoutRecordFields(recordId, objectApiName.trim());
    bodyHtml = mergeRelatedListTables(bodyHtml, recordId, objectApiName.trim());

    ensureContentDistributionsForHtml(bodyHtml);

    List<String> attempts = new List<String>{
      preparePdfBodyHtml(bodyHtml, true),
      preparePdfBodyHtml(bodyHtml, false),
      preparePdfBodyHtml(stripHtmlToText(bodyHtml), false)
    };
    List<String> warnings = new List<String>{
      null,
      'Generated without images because the Visualforce PDF renderer rejected one or more image sources.',
      'Generated as text-only because the Visualforce PDF renderer rejected the template HTML.'
    };

    for (Integer index = 0; index < attempts.size(); index += 1) {
      try {
        Blob pdf = renderVisualforcePdfForPreview(attempts[index]);
        return new PdfResult(
          'preview.pdf',
          EncodingUtil.base64Encode(pdf),
          warnings[index]
        );
      } catch (Exception error) {
        logPdfRenderFailure(index, error);
      }
    }

    throw new AuraHandledException(
      'The Visualforce PDF could not be generated even as text-only content.'
    );
  }

  @AuraEnabled
  public static PreviewFlowResult renderPdfFlowForRecordPreview(
    String objectApiName,
    Id recordId,
    String contentJson,
    String generatedHtml
  ) {
    if (recordId == null) {
      throw new AuraHandledException('Record is required for preview.');
    }
    if (String.isBlank(objectApiName)) {
      throw new AuraHandledException('Object is required for preview.');
    }

    objectApiName = objectApiName.trim();
    String recordObjectApiName = recordId.getSObjectType()
      .getDescribe(SObjectDescribeOptions.DEFERRED)
      .getName();
    if (objectApiName != recordObjectApiName) {
      throw new AuraHandledException(
        'The Record ID belongs to ' +
          recordObjectApiName +
          ', not ' +
          objectApiName +
          '.'
      );
    }

    validateLongTextSize('Preview content', contentJson);
    validateLongTextSize('Preview HTML', generatedHtml);

    String bodyHtml = buildTemplateBodyHtml(contentJson, generatedHtml);
    bodyHtml = mergeRecordFields(bodyHtml, recordId, objectApiName);
    mergePdfPageLayoutRecordFields(recordId, objectApiName);
    // Keep the browser flow preview on the same typography and cell spacing
    // used by the PDF renderer. Even a couple of extra pixels per row move
    // the totals onto a different page for long related lists.
    bodyHtml = mergeRelatedListTables(bodyHtml, recordId, objectApiName, true);

    String browserHeaderHtml = extractPreviewShellElement(
      generatedHtml,
      'header'
    );
    String browserFooterHtml = extractPreviewShellElement(
      generatedHtml,
      'footer'
    );
    browserHeaderHtml = mergeRelatedListTables(
      mergeRecordFields(
        mergeGlobalFields(browserHeaderHtml),
        recordId,
        objectApiName
      ),
      recordId,
      objectApiName,
      false
    );
    browserFooterHtml = mergeRelatedListTables(
      mergeRecordFields(
        mergeGlobalFields(browserFooterHtml),
        recordId,
        objectApiName
      ),
      recordId,
      objectApiName,
      false
    );

    PreviewFlowResult result = new PreviewFlowResult(
      sanitizeLwcRuntimeArtifacts(browserHeaderHtml),
      sanitizeLwcRuntimeArtifacts(bodyHtml),
      sanitizeLwcRuntimeArtifacts(browserFooterHtml)
    );
    resetPdfPageLayoutContext();
    return result;
  }

  private static String extractPreviewShellElement(
    String html,
    String tagName
  ) {
    if (String.isBlank(html) || String.isBlank(tagName)) {
      return '';
    }

    String normalizedHtml = html.toLowerCase();
    String normalizedTag = tagName.toLowerCase();
    Integer startIndex = normalizedHtml.indexOf('<' + normalizedTag);
    if (startIndex < 0) {
      return '';
    }

    String closingTag = '</' + normalizedTag + '>';
    Integer closingIndex = normalizedHtml.indexOf(closingTag, startIndex);
    if (closingIndex < 0) {
      return '';
    }

    return html.substring(startIndex, closingIndex + closingTag.length());
  }

  private static String renderTemplateBodyForRecord(
    PDFBuilderTemplate__c template,
    Id recordId
  ) {
    String recordObjectApiName = recordId.getSObjectType()
      .getDescribe(SObjectDescribeOptions.DEFERRED)
      .getName();
    if (template.ObjectApiName__c != recordObjectApiName) {
      throw new AuraHandledException(
        'The selected template is not associated with this object.'
      );
    }

    String bodyHtml = buildTemplateBodyHtml(
      template.ContentJson__c,
      template.GeneratedHtml__c
    );

    String mergedHtml = mergeRecordFields(
      bodyHtml,
      recordId,
      recordObjectApiName
    );
    mergePdfPageLayoutRecordFields(recordId, recordObjectApiName);
    return mergeRelatedListTables(mergedHtml, recordId, recordObjectApiName);
  }

  private static String buildTemplateBodyHtml(
    String contentJson,
    String generatedHtml
  ) {
    resetPdfPageLayoutContext();
    String bodyHtml = String.isBlank(contentJson)
      ? generatedHtml
      : renderTemplateJsonForPdf(contentJson);

    if (!hasRenderablePdfContent(bodyHtml) && !String.isBlank(generatedHtml)) {
      bodyHtml = generatedHtml;
    }

    String globallyMergedBodyHtml = mergeGlobalFields(bodyHtml);
    mergePdfPageLayoutGlobalFields();
    return globallyMergedBodyHtml;
  }

  private static String mergeGlobalFields(String html) {
    if (String.isBlank(html)) {
      return html;
    }

    Map<String, String> tokenToPlaceholder = new Map<String, String>{
      '{!$Organization.Name}' => '[[DB_GLOBAL_ORG_NAME]]',
      '{!$Organization.PrimaryContact}' => '[[DB_GLOBAL_ORG_PRIMARY_CONTACT]]',
      '{!$Organization.Division}' => '[[DB_GLOBAL_ORG_DIVISION]]',
      '{!$Organization.Phone}' => '[[DB_GLOBAL_ORG_PHONE]]',
      '{!$Organization.Fax}' => '[[DB_GLOBAL_ORG_FAX]]',
      '{!$Organization.Address}' => '[[DB_GLOBAL_ORG_ADDRESS]]',
      '{!$User.Name}' => '[[DB_GLOBAL_USER_NAME]]'
    };

    String transformed = html;
    for (String token : tokenToPlaceholder.keySet()) {
      transformed = transformed.replace(token, tokenToPlaceholder.get(token));
    }

    transformed = normalizeGlobalPlaceholderLineBreaks(transformed);

    Map<String, String> placeholderToValue = new Map<String, String>();
    if (transformed.contains('[[DB_GLOBAL_ORG_NAME]]')) {
      placeholderToValue.put(
        '[[DB_GLOBAL_ORG_NAME]]',
        escapeHtml(getOrganizationFieldValue('Name'))
      );
    }
    if (transformed.contains('[[DB_GLOBAL_ORG_PRIMARY_CONTACT]]')) {
      placeholderToValue.put(
        '[[DB_GLOBAL_ORG_PRIMARY_CONTACT]]',
        escapeHtml(getOrganizationFieldValue('PrimaryContact'))
      );
    }
    if (transformed.contains('[[DB_GLOBAL_ORG_DIVISION]]')) {
      placeholderToValue.put(
        '[[DB_GLOBAL_ORG_DIVISION]]',
        escapeHtml(getOrganizationFieldValue('Division'))
      );
    }
    if (transformed.contains('[[DB_GLOBAL_ORG_PHONE]]')) {
      placeholderToValue.put(
        '[[DB_GLOBAL_ORG_PHONE]]',
        escapeHtml(getOrganizationFieldValue('Phone'))
      );
    }
    if (transformed.contains('[[DB_GLOBAL_ORG_FAX]]')) {
      placeholderToValue.put(
        '[[DB_GLOBAL_ORG_FAX]]',
        escapeHtml(getOrganizationFieldValue('Fax'))
      );
    }
    if (transformed.contains('[[DB_GLOBAL_ORG_ADDRESS]]')) {
      placeholderToValue.put(
        '[[DB_GLOBAL_ORG_ADDRESS]]',
        escapeHtml(getOrganizationAddressValue())
      );
    }
    if (transformed.contains('[[DB_GLOBAL_USER_NAME]]')) {
      placeholderToValue.put(
        '[[DB_GLOBAL_USER_NAME]]',
        escapeHtml(getCurrentUserFieldValue('Name'))
      );
    }

    for (String placeholder : placeholderToValue.keySet()) {
      transformed = transformed.replace(
        placeholder,
        placeholderToValue.get(placeholder)
      );
    }

    return transformed;
  }

  private static String normalizeGlobalPlaceholderLineBreaks(String html) {
    if (String.isBlank(html)) {
      return html;
    }

    String normalized = html;
    // Only force a line break when two global placeholders are effectively adjacent.
    normalized = normalized.replaceAll(
      '(\\[\\[DB_GLOBAL_[A-Z_]+\\]\\])(?:\\s|&nbsp;|<br\\s*/?>)*(?=\\[\\[DB_GLOBAL_[A-Z_]+\\]\\])',
      '$1<br />'
    );

    return normalized;
  }

  private static String getOrganizationFieldValue(String fieldApiName) {
    Organization orgRecord = getOrganizationMergeRecord();
    if (orgRecord == null) {
      return '';
    }

    Object value = orgRecord.get(fieldApiName);
    return value == null ? '' : String.valueOf(value);
  }

  private static String getOrganizationAddressValue() {
    Organization orgRecord = getOrganizationMergeRecord();
    if (orgRecord == null) {
      return '';
    }

    List<String> parts = new List<String>();

    if (!String.isBlank(orgRecord.Street)) {
      parts.add(orgRecord.Street);
    }

    String cityLine = '';
    if (!String.isBlank(orgRecord.City)) {
      cityLine += orgRecord.City;
    }
    if (!String.isBlank(orgRecord.State)) {
      cityLine += (cityLine == '' ? '' : ', ') + orgRecord.State;
    }
    if (!String.isBlank(orgRecord.PostalCode)) {
      cityLine += (cityLine == '' ? '' : ' ') + orgRecord.PostalCode;
    }
    if (cityLine != '') {
      parts.add(cityLine);
    }

    if (!String.isBlank(orgRecord.Country)) {
      parts.add(orgRecord.Country);
    }

    return String.join(parts, ', ');
  }

  private static Organization getOrganizationMergeRecord() {
    if (!organizationMergeRecordLoaded) {
      organizationMergeRecordLoaded = true;
      try {
        organizationMergeRecord = [
          SELECT
            Name,
            PrimaryContact,
            Division,
            Phone,
            Fax,
            Street,
            City,
            State,
            PostalCode,
            Country
          FROM Organization
          WITH USER_MODE
          LIMIT 1
        ];
      } catch (Exception error) {
        organizationMergeRecord = null;
      }
    }

    return organizationMergeRecord;
  }

  private static String getCurrentUserFieldValue(String fieldApiName) {
    if (!currentUserMergeRecordLoaded) {
      currentUserMergeRecordLoaded = true;
      try {
        currentUserMergeRecord = [
          SELECT Name
          FROM User
          WHERE Id = :UserInfo.getUserId()
          WITH USER_MODE
          LIMIT 1
        ];
      } catch (Exception error) {
        currentUserMergeRecord = null;
      }
    }

    if (currentUserMergeRecord == null) {
      return '';
    }

    Object value = currentUserMergeRecord.get(fieldApiName);
    return value == null ? '' : String.valueOf(value);
  }

  private static Boolean isObjectAvailable(
    Schema.DescribeSObjectResult describe
  ) {
    return PDFBuilderDescribeService.isObjectAvailable(describe);
  }

  private static void validateLongTextSize(String label, String value) {
    if (value != null && value.length() > SETTINGS.longTextLimit) {
      throw new AuraHandledException(
        label +
          ' is too large to save. Current size: ' +
          value.length() +
          ' characters. Maximum: ' +
          SETTINGS.longTextLimit +
          '.'
      );
    }
  }

  private static String mergeRecordFields(
    String html,
    Id recordId,
    String objectApiName
  ) {
    if (String.isBlank(html)) {
      return html;
    }

    Map<String, Schema.SObjectType> objectMap = Schema.getGlobalDescribe();
    Set<String> fieldPaths = new Set<String>();
    Pattern tokenPattern = Pattern.compile(
      '\\{!' + objectApiName + '\\.([A-Za-z0-9_\\.]+)\\}'
    );
    Matcher matcher = tokenPattern.matcher(html);

    while (matcher.find()) {
      String rawPath = matcher.group(1);
      String validatedPath = validateMergeFieldPath(
        objectApiName,
        rawPath,
        objectMap
      );

      if (validatedPath != null) {
        fieldPaths.add(validatedPath);
      }
    }

    if (fieldPaths.isEmpty()) {
      return html;
    }

    List<String> selectFields = new List<String>(fieldPaths);
    selectFields.sort();
    Map<String, Schema.SObjectField> rootFieldMap = objectMap.get(objectApiName)
      .getDescribe(SObjectDescribeOptions.DEFERRED)
      .fields.getMap();
    Boolean hasCurrencyIsoCode =
      rootFieldMap.containsKey('CurrencyIsoCode') &&
      rootFieldMap.get('CurrencyIsoCode').getDescribe().isAccessible();
    if (hasCurrencyIsoCode && !selectFields.contains('CurrencyIsoCode')) {
      selectFields.add('CurrencyIsoCode');
    }

    List<SObject> records = Database.queryWithBinds(
      'SELECT ' +
        String.join(selectFields, ',') +
        ' FROM ' +
        objectApiName +
        ' WHERE Id = :recordId LIMIT 1',
      new Map<String, Object>{ 'recordId' => recordId },
      AccessLevel.USER_MODE
    );

    if (records.isEmpty()) {
      throw new AuraHandledException(
        'The record no longer exists or is not accessible.'
      );
    }

    SObject record = records[0];
    String currencyIsoCode = hasCurrencyIsoCode
      ? String.valueOf(record.get('CurrencyIsoCode'))
      : UserInfo.getDefaultCurrency();

    for (String fieldPath : fieldPaths) {
      Object value = resolveFieldPathValue(record, fieldPath);
      Schema.DescribeFieldResult fieldDescribe = resolveMergeFieldDescribe(
        objectApiName,
        fieldPath,
        objectMap
      );
      String token = '{!' + objectApiName + '.' + fieldPath + '}';
      html = html.replace(
        token,
        escapeHtml(
          formatMergeFieldValue(
            value,
            fieldDescribe,
            currencyIsoCode,
            fieldPath
          )
        )
      );
    }

    return html;
  }

  private static String validateMergeFieldPath(
    String objectApiName,
    String rawPath,
    Map<String, Schema.SObjectType> objectMap
  ) {
    if (String.isBlank(rawPath) || !objectMap.containsKey(objectApiName)) {
      return null;
    }

    List<String> segments = rawPath.split('\\.');
    if (segments.isEmpty()) {
      return null;
    }

    Schema.DescribeSObjectResult currentDescribe = objectMap.get(objectApiName)
      .getDescribe(SObjectDescribeOptions.DEFERRED);
    List<String> normalizedSegments = new List<String>();

    for (Integer index = 0; index < segments.size(); index += 1) {
      String segment = segments[index];
      if (String.isBlank(segment)) {
        return null;
      }

      Map<String, Schema.SObjectField> fieldMap = currentDescribe.fields.getMap();

      if (index == segments.size() - 1) {
        if (!fieldMap.containsKey(segment)) {
          return null;
        }

        Schema.DescribeFieldResult terminalField = fieldMap.get(segment)
          .getDescribe();
        if (!terminalField.isAccessible()) {
          return null;
        }

        normalizedSegments.add(segment);
        return String.join(normalizedSegments, '.');
      }

      Schema.DescribeFieldResult relationshipField = null;
      for (String fieldApiName : fieldMap.keySet()) {
        Schema.DescribeFieldResult candidate = fieldMap.get(fieldApiName)
          .getDescribe();
        if (
          candidate.getType() == Schema.DisplayType.Reference &&
          !String.isBlank(candidate.getRelationshipName()) &&
          candidate.getRelationshipName() == segment
        ) {
          relationshipField = candidate;
          break;
        }
      }

      if (relationshipField == null) {
        return null;
      }

      List<Schema.SObjectType> relationshipTargets = relationshipField.getReferenceTo();
      if (
        relationshipTargets == null ||
        relationshipTargets.isEmpty() ||
        relationshipTargets.size() > 1
      ) {
        return null;
      }

      Schema.DescribeSObjectResult nextDescribe = relationshipTargets[0]
        .getDescribe(SObjectDescribeOptions.DEFERRED);
      if (!isObjectAvailable(nextDescribe)) {
        return null;
      }

      normalizedSegments.add(relationshipField.getRelationshipName());
      currentDescribe = nextDescribe;
    }

    return null;
  }

  private static String formatMergeFieldValue(
    Object value,
    Schema.DescribeFieldResult fieldDescribe,
    String currencyIsoCode,
    String fieldPath
  ) {
    if (value == null) {
      return '';
    }

    if (value instanceof Address) {
      Address addressValue = (Address) value;
      List<String> addressLines = new List<String>();
      List<String> localityParts = new List<String>();

      if (!String.isBlank(addressValue.getStreet())) {
        addressLines.add(addressValue.getStreet());
      }
      if (!String.isBlank(addressValue.getPostalCode())) {
        localityParts.add(addressValue.getPostalCode());
      }
      if (!String.isBlank(addressValue.getCity())) {
        localityParts.add(addressValue.getCity());
      }
      if (!String.isBlank(addressValue.getState())) {
        localityParts.add(addressValue.getState());
      }
      if (!localityParts.isEmpty()) {
        addressLines.add(String.join(localityParts, ' '));
      }
      if (!String.isBlank(addressValue.getCountry())) {
        addressLines.add(addressValue.getCountry());
      }

      return String.join(addressLines, '\n');
    }

    if (fieldDescribe != null) {
      Schema.DisplayType fieldType = fieldDescribe.getType();

      if (fieldType == Schema.DisplayType.Date) {
        return ((Date) value).format();
      }
      if (fieldType == Schema.DisplayType.DateTime) {
        return ((Datetime) value).date().format();
      }
      if (
        fieldType == Schema.DisplayType.Currency ||
        isMonetaryAggregateField(fieldType, fieldDescribe, fieldPath)
      ) {
        Decimal currencyValue = ((Decimal) value)
          .setScale(fieldDescribe.getScale());
        return formatCurrencyForUser(
          currencyValue,
          fieldDescribe.getScale(),
          currencyIsoCode
        );
      }
      if (
        fieldType == Schema.DisplayType.Double ||
        fieldType == Schema.DisplayType.Percent
      ) {
        Decimal decimalValue = ((Decimal) value)
          .setScale(fieldDescribe.getScale());
        return formatDecimalForUser(decimalValue, fieldDescribe.getScale()) +
          (fieldType == Schema.DisplayType.Percent ? ' %' : '');
      }
      if (fieldType == Schema.DisplayType.Integer) {
        return formatDecimalForUser(Decimal.valueOf(String.valueOf(value)), 0);
      }
      if (fieldType == Schema.DisplayType.Boolean) {
        return ((Boolean) value) ? 'Yes' : 'No';
      }
    }

    return String.valueOf(value);
  }

  private static Boolean isMonetaryAggregateField(
    Schema.DisplayType fieldType,
    Schema.DescribeFieldResult fieldDescribe,
    String fieldPath
  ) {
    if (
      fieldDescribe == null ||
      fieldType != Schema.DisplayType.Double ||
      !fieldDescribe.isCalculated() ||
      String.isBlank(fieldPath)
    ) {
      return false;
    }

    List<String> segments = fieldPath.split('\\.');
    String fieldName = segments.isEmpty()
      ? fieldPath.toLowerCase()
      : segments[segments.size() - 1].toLowerCase();

    return fieldName.contains('subtotal') ||
      fieldName.contains('totalprice') ||
      fieldName.contains('grandtotal') ||
      fieldName.contains('amount') ||
      fieldName.contains('price') ||
      fieldName.contains('cost') ||
      fieldName.contains('revenue');
  }

  private static String formatDecimalForUser(Decimal value, Integer scale) {
    return formatDecimal(value, scale, userLocaleUsesDecimalComma());
  }

  private static String formatDecimal(
    Decimal value,
    Integer scale,
    Boolean usesDecimalComma
  ) {
    Integer normalizedScale = Math.max(0, scale == null ? 0 : scale);
    String normalizedValue = String.valueOf(value.setScale(normalizedScale));
    Boolean isNegative = normalizedValue.startsWith('-');

    if (isNegative) {
      normalizedValue = normalizedValue.substring(1);
    }

    List<String> numberParts = normalizedValue.split('\\.');
    String integerPart = numberParts[0];
    String fractionPart = numberParts.size() > 1 ? numberParts[1] : '';
    String groupSeparator = usesDecimalComma ? '.' : ',';
    String decimalSeparator = usesDecimalComma ? ',' : '.';
    String groupedSuffix = '';

    while (integerPart.length() > 3) {
      groupedSuffix =
        groupSeparator +
        integerPart.substring(integerPart.length() - 3) +
        groupedSuffix;
      integerPart = integerPart.substring(0, integerPart.length() - 3);
    }

    String formatted = integerPart + groupedSuffix;
    if (normalizedScale > 0) {
      while (fractionPart.length() < normalizedScale) {
        fractionPart += '0';
      }
      formatted += decimalSeparator + fractionPart;
    }

    return (isNegative ? '-' : '') + formatted;
  }

  private static Boolean userLocaleUsesDecimalComma() {
    String locale = String.valueOf(UserInfo.getLocale()).toLowerCase();
    return locale.startsWith('es') ||
      locale.startsWith('de') ||
      locale.startsWith('fr') ||
      locale.startsWith('it') ||
      locale.startsWith('pt') ||
      locale.startsWith('nl') ||
      locale.startsWith('ca');
  }

  @TestVisible
  private static String formatCurrencyForUser(
    Decimal value,
    Integer scale,
    String currencyIsoCode
  ) {
    String normalizedCode = String.isBlank(currencyIsoCode)
      ? String.valueOf(UserInfo.getDefaultCurrency()).trim().toUpperCase()
      : currencyIsoCode.trim().toUpperCase();
    Set<String> prefixCurrencyCodes = new Set<String>{
      'USD',
      'GBP',
      'JPY',
      'CNY',
      'KRW',
      'INR'
    };
    Set<String> supportedCurrencyCodes = new Set<String>(prefixCurrencyCodes);
    supportedCurrencyCodes.add('EUR');
    Boolean usesDecimalComma = normalizedCode == 'EUR'
      ? true
      : supportedCurrencyCodes.contains(normalizedCode)
          ? false
          : userLocaleUsesDecimalComma();
    String formattedValue = formatDecimal(value, scale, usesDecimalComma);
    String currencySymbol = getCurrencySymbol(normalizedCode);
    if (String.isBlank(currencySymbol)) {
      return formattedValue;
    }

    return prefixCurrencyCodes.contains(normalizedCode)
      ? currencySymbol + formattedValue
      : formattedValue + ' ' + currencySymbol;
  }

  private static String getCurrencySymbol(String currencyIsoCode) {
    String effectiveCurrencyIsoCode = String.isBlank(currencyIsoCode)
      ? UserInfo.getDefaultCurrency()
      : currencyIsoCode;
    String normalizedCode = String.isBlank(effectiveCurrencyIsoCode)
      ? ''
      : effectiveCurrencyIsoCode.trim().toUpperCase();
    Map<String, String> symbolsByCode = new Map<String, String>{
      'EUR' => '€',
      'USD' => '$',
      'GBP' => '£',
      'JPY' => '¥',
      'CNY' => '¥',
      'KRW' => '₩',
      'INR' => '₹'
    };

    return symbolsByCode.containsKey(normalizedCode)
      ? symbolsByCode.get(normalizedCode)
      : normalizedCode;
  }

  private static Schema.DescribeFieldResult resolveMergeFieldDescribe(
    String objectApiName,
    String fieldPath,
    Map<String, Schema.SObjectType> objectMap
  ) {
    if (
      String.isBlank(objectApiName) ||
      String.isBlank(fieldPath) ||
      !objectMap.containsKey(objectApiName)
    ) {
      return null;
    }

    Schema.DescribeSObjectResult currentDescribe = objectMap.get(objectApiName)
      .getDescribe(SObjectDescribeOptions.DEFERRED);
    List<String> segments = fieldPath.split('\\.');

    for (Integer index = 0; index < segments.size(); index += 1) {
      String segment = segments[index];
      Map<String, Schema.SObjectField> fieldMap = currentDescribe.fields.getMap();

      if (index == segments.size() - 1) {
        return fieldMap.containsKey(segment)
          ? fieldMap.get(segment).getDescribe()
          : null;
      }

      Schema.DescribeFieldResult relationshipField;
      for (Schema.SObjectField candidateField : fieldMap.values()) {
        Schema.DescribeFieldResult candidate = candidateField.getDescribe();
        if (
          candidate.getType() == Schema.DisplayType.Reference &&
          candidate.getRelationshipName() == segment
        ) {
          relationshipField = candidate;
          break;
        }
      }

      if (
        relationshipField == null ||
        relationshipField.getReferenceTo().size() != 1
      ) {
        return null;
      }

      currentDescribe = relationshipField.getReferenceTo()[0]
        .getDescribe(SObjectDescribeOptions.DEFERRED);
    }

    return null;
  }

  private static Object resolveFieldPathValue(
    SObject record,
    String fieldPath
  ) {
    if (record == null || String.isBlank(fieldPath)) {
      return null;
    }

    List<String> segments = fieldPath.split('\\.');
    SObject current = record;

    for (Integer index = 0; index < segments.size(); index += 1) {
      String segment = segments[index];

      if (index == segments.size() - 1) {
        return current == null ? null : current.get(segment);
      }

      current = current == null ? null : current.getSObject(segment);
      if (current == null) {
        return null;
      }
    }

    return null;
  }

  private static String escapeHtml(String value) {
    return value
      .replace('&', '&amp;')
      .replace('<', '&lt;')
      .replace('>', '&gt;')
      .replace('"', '&quot;')
      .replace('\'', '&#039;');
  }

  private static PdfResult convertTemplateToVisualforcePdf(
    PDFBuilderTemplate__c template,
    Id recordId
  ) {
    String fileName = buildPdfFileName(recordId, template.Name);
    String rawBodyHtml = renderTemplateBodyForRecord(template, recordId);
    ensureContentDistributionsForHtml(rawBodyHtml);
    Boolean previousAllowContentDistributionDml = allowContentDistributionDml;

    try {
      allowContentDistributionDml = false;
      List<String> attempts = new List<String>{
        preparePdfBodyHtml(rawBodyHtml, true),
        preparePdfBodyHtml(rawBodyHtml, false),
        preparePdfBodyHtml(stripHtmlToText(rawBodyHtml), false)
      };
      List<String> warnings = new List<String>{
        null,
        'Generated without images because the Visualforce PDF renderer rejected one or more image sources.',
        'Generated as text-only because the Visualforce PDF renderer rejected the template HTML.'
      };

      for (Integer index = 0; index < attempts.size(); index += 1) {
        try {
          Blob pdf = renderVisualforcePdf(
            attempts[index],
            template.Id,
            recordId
          );
          return new PdfResult(
            fileName,
            EncodingUtil.base64Encode(pdf),
            warnings[index]
          );
        } catch (Exception error) {
          logPdfRenderFailure(index, error);
        }
      }

      throw new AuraHandledException(
        'The Visualforce PDF could not be generated even as text-only content.'
      );
    } finally {
      allowContentDistributionDml = previousAllowContentDistributionDml;
    }
  }

  /**
   * @description Records a failed Visualforce PDF rendering attempt before the
   * renderer advances to its next compatibility fallback.
   * @param attemptIndex Zero-based index of the failed rendering attempt.
   * @param error Exception raised by the Visualforce PDF renderer.
   */
  private static void logPdfRenderFailure(
    Integer attemptIndex,
    Exception error
  ) {
    System.debug(
      LoggingLevel.WARN,
      'PDF Builder PDF rendering attempt ' +
        String.valueOf(attemptIndex + 1) +
        ' failed: ' +
        error.getMessage()
    );
  }

  private static Blob renderVisualforcePdf(
    String bodyHtml,
    Id templateId,
    Id recordId
  ) {
    PageReference pdfPage = Page.PDFBuilderPdf;

    PDFBuilderPdfPageController.bodyHtmlForRender = bodyHtml;
    pdfPage.getParameters().put('templateId', String.valueOf(templateId));
    pdfPage.getParameters().put('recordId', String.valueOf(recordId));

    try {
      return pdfPage.getContentAsPDF();
    } finally {
      PDFBuilderPdfPageController.bodyHtmlForRender = null;
    }
  }

  private static Blob renderVisualforcePdfForPreview(String bodyHtml) {
    PageReference pdfPage = Page.PDFBuilderPdf;
    PDFBuilderPdfPageController.bodyHtmlForRender = bodyHtml;

    try {
      return pdfPage.getContentAsPDF();
    } finally {
      PDFBuilderPdfPageController.bodyHtmlForRender = null;
    }
  }

  private static String preparePdfBodyHtml(String html, Boolean includeImages) {
    String body = String.isBlank(html) ? '' : html;

    // Remove transient LWC runtime attributes/tags that can leak from
    // contenteditable HTML and break Visualforce PDF rendering.
    body = sanitizeLwcRuntimeArtifacts(body);
    body = replaceUnresolvedRelatedListTokens(body);
    body = body.replaceAll('<section([^>]*)>', '<div$1>');
    body = body.replaceAll('</section>', '</div>');
    if (!includeImages) {
      body = replaceImagesWithPdfNotice(body, getImageDiagnostics(body));
    } else {
      body = rewriteHtmlImageSourcesForPdf(body);
    }
    body = body.replaceAll('<hr([^>]*)>', '<hr />');
    body = body.replaceAll('<br([^>]*)>', '<br />');
    body = body.replace('&nbsp;', '&#160;');

    if (!hasRenderablePdfContent(body)) {
      body = 'Document content is empty.';
    }

    return body;
  }

  private static String replaceUnresolvedRelatedListTokens(String html) {
    if (String.isBlank(html)) {
      return html;
    }

    Pattern tokenPattern = Pattern.compile('\\[\\[DBRL\\|([^\\]]*)\\]\\]');
    Matcher matcher = tokenPattern.matcher(html);
    String transformed = html;
    Set<String> processedTokens = new Set<String>();

    while (matcher.find()) {
      String token = matcher.group(0);
      if (processedTokens.contains(token)) {
        continue;
      }
      processedTokens.add(token);

      List<String> tokenParts = parseRelatedListTokenParts(matcher.group(1));
      String relationshipName = tokenParts.isEmpty() ? '' : tokenParts[0];
      String placeholder =
        '<div style="border:1px dashed #9ca3af;color:#706e6b;font-size:11px;text-align:center;padding:12px;">' +
        'Related list "' +
        escapeHtml(relationshipName) +
        '" requires a record context for preview/PDF.' +
        '</div>';
      transformed = transformed.replace(token, placeholder);
    }

    return transformed;
  }

  private static Boolean hasRenderablePdfContent(String html) {
    if (!String.isBlank(stripHtmlToText(html))) {
      return true;
    }

    if (String.isBlank(html)) {
      return false;
    }

    return Pattern.compile('(?i)<img\\s+[^>]*src="[^"]+"[^>]*>')
        .matcher(html)
        .find() ||
      Pattern.compile('(?i)<hr\\s*/?>').matcher(html).find() ||
      Pattern.compile('(?i)<table\\s+[^>]*>').matcher(html).find();
  }

  @TestVisible
  private static String renderTemplateJsonForPdf(String contentJson) {
    Object jsonRoot;

    try {
      jsonRoot = JSON.deserializeUntyped(contentJson);
    } catch (Exception error) {
      return '';
    }

    if (jsonRoot instanceof List<Object>) {
      return renderPdfCanvas((List<Object>) jsonRoot);
    }

    if (jsonRoot instanceof Map<String, Object>) {
      return renderPdfDocumentModel((Map<String, Object>) jsonRoot);
    }

    return '';
  }

  private static String renderPdfDocumentModel(Map<String, Object> model) {
    Integer pagePadding = getIntegerValue(
      model,
      'pagePadding',
      SETTINGS.defaultPagePadding
    );
    Integer contentWidth = getPdfDocumentContentWidth(pagePadding);
    PDFBuilderPdfPageController.pageBackgroundForRender = normalizePdfStyleValue(
      getStringValue(model, 'pageBackground'),
      '#ffffff'
    );
    Integer manualPageCount = Math.max(
      0,
      getIntegerValue(model, 'manualPageCount', 0)
    );
    Boolean showHeader = getBooleanValue(model, 'showHeader', true);
    Boolean showBody = getBooleanValue(model, 'showBody', true);
    Boolean showFooter = getBooleanValue(model, 'showFooter', true);
    Boolean repeatHeader = getBooleanValue(
      model,
      'repeatHeaderOnEachPage',
      true
    );
    Boolean repeatFooter = getBooleanValue(
      model,
      'repeatFooterOnEachPage',
      true
    );
    Map<String, Object> header = getMapValue(model, 'header');
    Map<String, Object> body = getMapValue(model, 'body');
    Map<String, Object> footer = getMapValue(model, 'footer');
    List<Object> manualPages = getObjectList(model, 'manualPages');

    if (pdfDocumentBodyContainsRelatedList(body)) {
      return renderPdfDynamicDocumentModel(
        model,
        pagePadding,
        contentWidth,
        manualPageCount,
        showHeader,
        showFooter,
        repeatHeader,
        repeatFooter,
        header,
        body,
        footer,
        manualPages
      );
    }

    Integer totalPages = 1 + manualPageCount;
    Integer bodyHeight = getPdfDocumentBodyCapacity(model, pagePadding);
    List<String> pages = new List<String>();

    for (Integer pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      Boolean isFirstPage = pageIndex == 0;
      String pageHtml = '';

      if (showHeader && (isFirstPage || repeatHeader)) {
        pageHtml += renderPdfDocumentRegion(
          header,
          'header',
          pagePadding,
          true,
          contentWidth,
          null
        );
      }
      if (showBody) {
        Map<String, Object> pageBody = body;
        Boolean includeBodyBlocks = isFirstPage;
        if (!isFirstPage && pageIndex - 1 < manualPages.size()) {
          Map<String, Object> manualPage = (Map<String, Object>) manualPages[
            pageIndex - 1
          ];
          Map<String, Object> manualBody = getMapValue(manualPage, 'body');
          if (!manualBody.isEmpty()) {
            pageBody = manualBody;
            includeBodyBlocks = true;
          }
        }
        pageHtml += renderPdfDocumentBody(
          pageBody,
          pagePadding,
          includeBodyBlocks,
          contentWidth,
          bodyHeight
        );
      }
      if (showFooter && (isFirstPage || repeatFooter)) {
        pageHtml += renderPdfDocumentRegion(
          footer,
          'footer',
          pagePadding,
          true,
          contentWidth,
          null
        );
      }

      pages.add(
        '<table border="0" cellpadding="0" cellspacing="0" width="' +
          contentWidth +
          '"' +
          ' style="width:' +
          contentWidth +
          'px;border-collapse:collapse;' +
          (pageIndex < totalPages - 1 ? 'page-break-after:always;' : '') +
          '">' +
          '<tr><td style="padding:0;margin:0;" valign="top">' +
          pageHtml +
          '</td></tr></table>'
      );
    }

    return String.join(pages, '');
  }

  private static Boolean pdfDocumentBodyContainsRelatedList(
    Map<String, Object> body
  ) {
    for (Object sectionObject : getObjectList(body, 'sections')) {
      if (
        sectionObject instanceof Map<String, Object> &&
        containsPdfRelatedList(
          getObjectList((Map<String, Object>) sectionObject, 'blocks')
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private static String renderPdfDynamicDocumentModel(
    Map<String, Object> model,
    Integer pagePadding,
    Integer contentWidth,
    Integer manualPageCount,
    Boolean showHeader,
    Boolean showFooter,
    Boolean repeatHeader,
    Boolean repeatFooter,
    Map<String, Object> header,
    Map<String, Object> body,
    Map<String, Object> footer,
    List<Object> manualPages
  ) {
    Integer headerHeight = showHeader
      ? getPdfDocumentRegionHeight(
          getMapValue(header, 'styles'),
          'header',
          pagePadding
        )
      : 0;
    Integer footerHeight = showFooter
      ? getPdfDocumentRegionHeight(
          getMapValue(footer, 'styles'),
          'footer',
          pagePadding
        )
      : 0;
    Integer repeatedHeaderHeight = showHeader && repeatHeader
      ? headerHeight
      : 0;
    Integer repeatedFooterHeight = showFooter && repeatFooter
      ? footerHeight
      : 0;
    Integer repeatedHeaderBodyGap = repeatedHeaderHeight > 0 ? 10 : 0;
    Integer bodyHeight = Math.max(
      120,
      SETTINGS.pageHeight -
        repeatedHeaderHeight -
        repeatedHeaderBodyGap -
        repeatedFooterHeight
    );

    PDFBuilderPdfPageController.pageTopMarginForRender =
      repeatedHeaderHeight + repeatedHeaderBodyGap;
    PDFBuilderPdfPageController.pageRightMarginForRender = pagePadding;
    PDFBuilderPdfPageController.pageBottomMarginForRender = repeatedFooterHeight;
    PDFBuilderPdfPageController.pageLeftMarginForRender = pagePadding;
    PDFBuilderPdfPageController.pageContentWidthForRender = contentWidth;

    String html = '';

    if (showHeader && repeatHeader) {
      PDFBuilderPdfPageController.fixedHeaderHtmlForRender = renderPdfDocumentRegionContent(
        header,
        'header',
        pagePadding,
        true,
        contentWidth,
        headerHeight
      );
    } else if (showHeader) {
      html += renderPdfDocumentRegion(
        header,
        'header',
        pagePadding,
        true,
        contentWidth,
        headerHeight
      );
    }

    if (showFooter && repeatFooter) {
      PDFBuilderPdfPageController.fixedFooterHtmlForRender = renderPdfDocumentRegionContent(
        footer,
        'footer',
        pagePadding,
        true,
        contentWidth,
        footerHeight
      );
    }

    html += renderPdfDocumentBody(
      body,
      pagePadding,
      true,
      contentWidth,
      bodyHeight
    );

    for (Integer pageIndex = 0; pageIndex < manualPageCount; pageIndex += 1) {
      if (pageIndex >= manualPages.size()) {
        break;
      }
      Map<String, Object> manualPage = (Map<String, Object>) manualPages[
        pageIndex
      ];
      Map<String, Object> manualBody = getMapValue(manualPage, 'body');
      if (manualBody.isEmpty()) {
        continue;
      }
      html +=
        '<div data-db-preview-manual-page="true" style="page-break-before:always;">' +
        renderPdfDocumentBody(
          manualBody,
          pagePadding,
          true,
          contentWidth,
          bodyHeight
        ) +
        '</div>';
    }

    if (showFooter && !repeatFooter) {
      html +=
        '<div style="page-break-inside:avoid;">' +
        renderPdfDocumentRegion(
          footer,
          'footer',
          pagePadding,
          true,
          contentWidth,
          footerHeight
        ) +
        '</div>';
    }

    return html;
  }

  private static String renderPdfDocumentBody(
    Map<String, Object> body,
    Integer pagePadding,
    Boolean includeBlocks,
    Integer contentWidth,
    Integer bodyHeight
  ) {
    List<Object> sections = getObjectList(body, 'sections');
    String layout = getStringValue(body, 'layout') == 'two' ? 'two' : 'one';

    if (sections.isEmpty()) {
      return '';
    }

    if (layout != 'two' || sections.size() == 1) {
      return renderPdfDocumentRegion(
        (Map<String, Object>) sections[0],
        'body',
        pagePadding,
        includeBlocks,
        contentWidth,
        bodyHeight
      );
    }

    Integer horizontalGap = 16;
    Integer leftWidth = Math.max(
      1,
      Integer.valueOf(
        String.valueOf(Math.floor((contentWidth - horizontalGap) / 2.0))
      )
    );
    Integer rightWidth = Math.max(1, contentWidth - horizontalGap - leftWidth);
    String leftSection = renderPdfDocumentRegionContent(
      (Map<String, Object>) sections[0],
      'body',
      pagePadding,
      includeBlocks,
      leftWidth,
      bodyHeight
    );
    String rightSection = renderPdfDocumentRegionContent(
      (Map<String, Object>) sections[1],
      'body',
      pagePadding,
      includeBlocks,
      rightWidth,
      bodyHeight
    );

    Integer regionGap = getPdfDocumentRegionGap(pagePadding);

    return '<table border="0" cellpadding="0" cellspacing="0" width="' +
      contentWidth +
      '" style="width:' +
      contentWidth +
      'px;border-collapse:collapse;margin-top:' +
      regionGap +
      'px;">' +
      '<tr>' +
      '<td width="' +
      leftWidth +
      '" valign="top" style="width:' +
      leftWidth +
      'px;">' +
      leftSection +
      '</td>' +
      '<td width="' +
      horizontalGap +
      '" style="width:' +
      horizontalGap +
      'px;font-size:1px;">&#160;</td>' +
      '<td width="' +
      rightWidth +
      '" valign="top" style="width:' +
      rightWidth +
      'px;">' +
      rightSection +
      '</td>' +
      '</tr></table>';
  }

  private static String renderPdfDocumentRegion(
    Map<String, Object> region,
    String regionKind,
    Integer pagePadding,
    Boolean includeBlocks,
    Integer contentWidth,
    Integer heightOverride
  ) {
    Integer regionGap = getPdfDocumentRegionGap(pagePadding);

    return '<div style="' +
      (regionKind == 'header' ? '' : 'margin-top:' + regionGap + 'px;') +
      '">' +
      renderPdfDocumentRegionContent(
        region,
        regionKind,
        pagePadding,
        includeBlocks,
        contentWidth,
        heightOverride
      ) +
      '</div>';
  }

  private static String renderPdfDocumentRegionContent(
    Map<String, Object> region,
    String regionKind,
    Integer pagePadding,
    Boolean includeBlocks,
    Integer contentWidth,
    Integer heightOverride
  ) {
    Map<String, Object> styles = getMapValue(region, 'styles');
    Integer height = heightOverride == null
      ? getPdfDocumentRegionHeight(styles, regionKind, pagePadding)
      : Math.max(1, heightOverride);
    Integer regionWidth = contentWidth;
    if (regionKind == 'header' || regionKind == 'footer') {
      String configuredWidth = getStyleValue(styles, 'width');
      if (!String.isBlank(configuredWidth)) {
        regionWidth = Math.max(
          40,
          Math.min(
            contentWidth,
            scalePdfDocumentValue(
              configuredWidth,
              getPdfDocumentScale(pagePadding),
              contentWidth,
              contentWidth
            )
          )
        );
      }
    }
    Integer padding = getIntegerStyleValue(styles, 'padding', 0);
    Integer borderWidth = getIntegerStyleValue(styles, 'borderWidth', 0);
    Integer innerWidth = Math.max(
      1,
      regionWidth - (padding * 2) - (borderWidth * 2)
    );
    Integer innerHeight = Math.max(
      1,
      height - (padding * 2) - (borderWidth * 2)
    );
    List<Object> blocks = getObjectList(region, 'blocks');
    Boolean hasDynamicRelatedList =
      includeBlocks &&
      regionKind == 'body' &&
      containsPdfRelatedList(blocks);
    String blocksHtml = includeBlocks
      ? renderPdfDocumentBlocks(
          blocks,
          pagePadding,
          innerWidth,
          innerHeight,
          regionKind
        )
      : '';
    return '<div' +
      ' style="' +
      buildPdfDocumentRegionStyle(
        styles,
        height,
        regionWidth,
        hasDynamicRelatedList
      ) +
      'position:relative;margin-left:auto;margin-right:auto;">' +
      '<div style="position:relative;width:' +
      innerWidth +
      'px;' +
      (hasDynamicRelatedList
        ? 'min-height:' + innerHeight + 'px;height:auto;'
        : 'height:' + innerHeight + 'px;') +
      '">' +
      blocksHtml +
      '</div>' +
      '</div>';
  }

  private static String renderPdfDocumentBlocks(
    List<Object> blocks,
    Integer pagePadding,
    Integer regionWidth,
    Integer regionHeight,
    String regionKind
  ) {
    if (regionKind == 'body' && containsPdfRelatedList(blocks)) {
      return renderPdfDocumentBlocksWithDynamicRelatedLists(
        blocks,
        pagePadding,
        regionWidth,
        regionHeight,
        regionKind
      );
    }

    String html = '';

    for (Object blockObject : blocks) {
      if (blockObject instanceof Map<String, Object>) {
        html += renderPdfDocumentBlock(
          (Map<String, Object>) blockObject,
          pagePadding,
          regionWidth,
          regionHeight,
          regionKind
        );
      }
    }

    return html;
  }

  private static Boolean containsPdfRelatedList(List<Object> blocks) {
    for (Object blockObject : blocks) {
      if (
        blockObject instanceof Map<String, Object> &&
        getStringValue((Map<String, Object>) blockObject, 'type') ==
        'relatedList'
      ) {
        return true;
      }
    }
    return false;
  }

  private static String renderPdfDocumentBlocksWithDynamicRelatedLists(
    List<Object> blockObjects,
    Integer pagePadding,
    Integer regionWidth,
    Integer regionHeight,
    String regionKind
  ) {
    List<Map<String, Object>> blocks = new List<Map<String, Object>>();
    for (Object blockObject : blockObjects) {
      if (blockObject instanceof Map<String, Object>) {
        blocks.add((Map<String, Object>) blockObject);
      }
    }
    if (blocks.isEmpty()) {
      return '';
    }

    Decimal scale = getPdfDocumentScale(pagePadding);
    Integer firstRelatedY;
    for (Map<String, Object> block : blocks) {
      if (getStringValue(block, 'type') != 'relatedList') {
        continue;
      }
      Integer blockY = getPdfDocumentBlockLayoutY(
        block,
        scale,
        regionWidth,
        regionHeight
      );
      firstRelatedY = firstRelatedY == null
        ? blockY
        : Math.min(firstRelatedY, blockY);
    }
    if (firstRelatedY == null) {
      return renderPdfDocumentBlocks(
        blockObjects,
        pagePadding,
        regionWidth,
        regionHeight,
        regionKind
      );
    }

    String html = '';
    if (firstRelatedY > 0) {
      html +=
        '<div style="position:relative;width:' +
        regionWidth +
        'px;height:' +
        firstRelatedY +
        'px;">';
      for (Map<String, Object> block : blocks) {
        Integer blockY = getPdfDocumentBlockLayoutY(
          block,
          scale,
          regionWidth,
          regionHeight
        );
        if (blockY < firstRelatedY) {
          html += renderPdfDocumentBlock(
            block,
            pagePadding,
            regionWidth,
            regionHeight,
            regionKind
          );
        }
      }
      html += '</div>';
    }

    List<Map<String, Object>> remaining = new List<Map<String, Object>>();
    for (Map<String, Object> block : blocks) {
      if (
        getPdfDocumentBlockLayoutY(block, scale, regionWidth, regionHeight) >=
        firstRelatedY
      ) {
        remaining.add(block);
      }
    }

    Integer previousConfiguredBottom = firstRelatedY;
    while (!remaining.isEmpty()) {
      Integer bandY;
      for (Map<String, Object> block : remaining) {
        Integer blockY = getPdfDocumentBlockLayoutY(
          block,
          scale,
          regionWidth,
          regionHeight
        );
        bandY = bandY == null ? blockY : Math.min(bandY, blockY);
      }

      List<Map<String, Object>> bandBlocks = new List<Map<String, Object>>();
      List<Map<String, Object>> nextRemaining = new List<Map<String, Object>>();
      for (Map<String, Object> block : remaining) {
        Integer blockY = getPdfDocumentBlockLayoutY(
          block,
          scale,
          regionWidth,
          regionHeight
        );
        // Builder columns intended as one row can differ by a pixel
        // after proportional rounding.
        if (Math.abs(blockY - bandY) <= 1) {
          bandBlocks.add(block);
        } else {
          nextRemaining.add(block);
        }
      }

      Boolean dynamicBand = false;
      Integer bandConfiguredHeight = 1;
      for (Map<String, Object> block : bandBlocks) {
        dynamicBand =
          dynamicBand || getStringValue(block, 'type') == 'relatedList';
        Integer blockHeight = getPdfDocumentBlockLayoutHeight(
          block,
          scale,
          regionHeight
        );
        bandConfiguredHeight = Math.max(bandConfiguredHeight, blockHeight);
      }

      // Preserve the builder's configured overlaps. Clamping this value
      // to zero turns overlapping blocks (for example Subtotal/Total)
      // into consecutive rows and increases their visual separation.
      Integer gap = bandY - previousConfiguredBottom;
      html +=
        '<div style="position:relative;width:' +
        regionWidth +
        'px;' +
        (gap != 0 ? 'margin-top:' + gap + 'px;' : '') +
        'min-height:' +
        bandConfiguredHeight +
        'px;' +
        (dynamicBand
          ? 'height:auto;'
          : 'height:' + bandConfiguredHeight + 'px;page-break-inside:avoid;') +
        '">';

      Boolean flowingRelatedListRendered = false;
      for (Map<String, Object> block : bandBlocks) {
        Boolean flowThisBlock =
          getStringValue(block, 'type') == 'relatedList' &&
          !flowingRelatedListRendered;
        html += renderPdfDocumentBlock(
          block,
          pagePadding,
          regionWidth,
          Math.max(regionHeight, bandConfiguredHeight),
          regionKind,
          0,
          flowThisBlock
        );
        flowingRelatedListRendered =
          flowingRelatedListRendered || flowThisBlock;
      }
      html += '</div>';

      previousConfiguredBottom = bandY + bandConfiguredHeight;
      remaining = nextRemaining;
    }

    return html;
  }

  private static Integer getPdfDocumentBlockLayoutY(
    Map<String, Object> block,
    Decimal scale,
    Integer regionWidth,
    Integer regionHeight
  ) {
    String type = getStringValue(block, 'type');
    Map<String, Object> styles = getMapValue(block, 'styles');
    Integer defaultY = type == 'image' ? 6 : 10;
    Integer y = resolvePdfBlockAxis(
      getBlockOrStyleValue(block, styles, 'y'),
      getDecimalStyleValue(styles, 'yRatio'),
      regionHeight,
      scale,
      defaultY,
      regionHeight
    );
    return Math.max(0, y);
  }

  private static Integer getPdfDocumentBlockLayoutHeight(
    Map<String, Object> block,
    Decimal scale,
    Integer regionHeight
  ) {
    String type = getStringValue(block, 'type');
    Map<String, Object> styles = getMapValue(block, 'styles');
    Integer defaultHeight = type == 'image'
      ? Math.min(110, Math.max(32, regionHeight))
      : 41;
    return Math.max(
      1,
      resolvePdfBlockAxis(
        getBlockOrStyleValue(block, styles, 'height'),
        getDecimalStyleValue(styles, 'heightRatio'),
        regionHeight,
        scale,
        defaultHeight,
        regionHeight
      )
    );
  }

  private static String renderPdfDocumentBlock(
    Map<String, Object> block,
    Integer pagePadding,
    Integer regionWidth,
    Integer regionHeight,
    String regionKind
  ) {
    return renderPdfDocumentBlock(
      block,
      pagePadding,
      regionWidth,
      regionHeight,
      regionKind,
      null,
      false
    );
  }

  private static String renderPdfDocumentBlock(
    Map<String, Object> block,
    Integer pagePadding,
    Integer regionWidth,
    Integer regionHeight,
    String regionKind,
    Integer yOverride,
    Boolean flowRelatedList
  ) {
    String type = getStringValue(block, 'type');
    Map<String, Object> styles = getMapValue(block, 'styles');
    Decimal scale = getPdfDocumentScale(pagePadding);
    Decimal xRatio = getDecimalStyleValue(styles, 'xRatio');
    Decimal yRatio = getDecimalStyleValue(styles, 'yRatio');
    Decimal widthRatio = getDecimalStyleValue(styles, 'widthRatio');
    Decimal heightRatio = getDecimalStyleValue(styles, 'heightRatio');
    Integer defaultBlockX = type == 'image' ? 6 : 10;
    Integer defaultBlockY = type == 'image' ? 6 : 10;
    String rawX = getBlockOrStyleValue(block, styles, 'x');
    Integer x = resolvePdfBlockAxis(
      rawX,
      xRatio,
      regionWidth,
      scale,
      defaultBlockX,
      regionWidth
    );
    String rawY = getBlockOrStyleValue(block, styles, 'y');
    Integer y = resolvePdfBlockAxis(
      rawY,
      yRatio,
      regionHeight,
      scale,
      defaultBlockY,
      regionHeight
    );
    if (yOverride != null) {
      y = yOverride;
    }
    Integer defaultImageWidth = Math.min(240, Math.max(40, regionWidth));
    Integer defaultImageHeight = Math.min(110, Math.max(32, regionHeight));
    String rawWidth = getBlockOrStyleValue(block, styles, 'width');
    Integer width = resolvePdfBlockAxis(
      rawWidth,
      widthRatio,
      regionWidth,
      scale,
      type == 'image' ? defaultImageWidth : regionWidth,
      regionWidth
    );
    String rawHeight = getBlockOrStyleValue(block, styles, 'height');
    Integer height = resolvePdfBlockAxis(
      rawHeight,
      heightRatio,
      regionHeight,
      scale,
      type == 'image' ? defaultImageHeight : 41,
      regionHeight
    );

    // Keep block geometry inside its region to avoid Visualforce PDF clipping artifacts.
    x = Math.max(0, Math.min(x, Math.max(0, regionWidth - 1)));
    if (type == 'image') {
      y += SETTINGS.pdfImageYOffset;
    }
    y = Math.max(0, Math.min(y, Math.max(0, regionHeight - 1)));
    width = Math.max(1, Math.min(width, Math.max(1, regionWidth - x)));
    height = Math.max(1, Math.min(height, Math.max(1, regionHeight - y)));
    Integer blockPadding = getIntegerStyleValue(styles, 'padding', 0);
    Integer blockBorderWidth = getIntegerStyleValue(styles, 'borderWidth', 0);
    Integer horizontalChrome = (blockPadding * 2) + (blockBorderWidth * 2);
    Integer verticalChrome = (blockPadding * 2) + (blockBorderWidth * 2);
    Integer innerWidth = Math.max(1, width - horizontalChrome);
    Integer innerHeight = Math.max(1, height - verticalChrome);
    String blockStyle = buildPdfDocumentBlockStyle(
      styles,
      x,
      y,
      width,
      height,
      type,
      flowRelatedList
    );

    if (type == 'text' || type == 'field') {
      String textStyle = buildPdfDocumentTextStyle(styles);
      String richText = renderRichTextContentForPdf(
        getStringValue(block, 'content')
      );
      String verticalAlign = normalizePdfStyleValue(
        getStyleValue(styles, 'verticalAlign'),
        'top'
      );

      // Flying Saucer does not vertically align ordinary div content. Keep
      // the established top-aligned output unchanged and use a one-cell
      // layout only when the user explicitly requests middle or bottom. A
      // percentage table height is ignored by Salesforce's PDF renderer when
      // its parent is absolutely positioned, so emit the resolved pixel
      // height and legacy HTML attributes as well as CSS.
      if (verticalAlign == 'middle' || verticalAlign == 'bottom') {
        return '<div class="db-pdf-rich" style="' +
          blockStyle +
          '"><table border="0" cellpadding="0" cellspacing="0" width="100%" height="' +
          innerHeight +
          '" style="width:100%;height:' +
          innerHeight +
          'px;table-layout:fixed;border-collapse:collapse;border-spacing:0;"><tbody><tr style="height:' +
          innerHeight +
          'px;"><td height="' +
          innerHeight +
          '" valign="' +
          verticalAlign +
          '" style="height:' +
          innerHeight +
          'px;padding:0;border:0;vertical-align:' +
          verticalAlign +
          ';' +
          textStyle +
          '">' +
          richText +
          '</td></tr></tbody></table></div>';
      }

      return '<div class="db-pdf-rich" style="' +
        blockStyle +
        textStyle +
        '">' +
        richText +
        '</div>';
    }
    if (type == 'image') {
      return '<div style="' +
        blockStyle +
        '">' +
        renderPdfImageContent(block, styles, innerWidth, innerHeight) +
        '</div>';
    }
    if (type == 'divider') {
      Integer lineThickness = Math.max(
        1,
        getIntegerStyleValue(styles, 'lineThickness', 1)
      );
      String lineColor = normalizePdfStyleValue(
        getStyleValue(styles, 'lineColor'),
        '#181818'
      );
      String lineStyle = normalizePdfStyleValue(
        getStyleValue(styles, 'lineStyle'),
        'solid'
      );
      String renderedLine = lineStyle == 'solid'
        ? 'height:' + lineThickness + 'px;background-color:' + lineColor + ';'
        : 'height:0;border-top:' +
          lineThickness +
          'px ' +
          lineStyle +
          ' ' +
          lineColor +
          ';';
      return '<div style="' +
        blockStyle +
        '">' +
        '<div style="display:block;width:100%;margin:0;font-size:0;line-height:0;' +
        renderedLine +
        '"></div>' +
        '</div>';
    }
    if (type == 'table') {
      return '<div style="' +
        blockStyle +
        '">' +
        renderPdfCurrentTable(block, styles) +
        '</div>';
    }
    if (type == 'relatedList') {
      return '<div style="' +
        blockStyle +
        '">' +
        renderPdfRelatedListToken(block) +
        '</div>';
    }

    return '';
  }

  private static Integer resolvePdfBlockAxis(
    String rawValue,
    Decimal ratioValue,
    Integer regionAxisSize,
    Decimal scale,
    Integer defaultValue,
    Integer maxValue
  ) {
    // The builder resolves proportional geometry first. PDF must follow
    // the same order or blocks are shifted and narrowed after page scaling.
    if (ratioValue != null) {
      return Integer.valueOf(
        String.valueOf(
          (Decimal.valueOf(regionAxisSize) * ratioValue)
            .setScale(0, System.RoundingMode.HALF_UP)
        )
      );
    }
    if (!String.isBlank(rawValue)) {
      return scalePdfDocumentValue(rawValue, scale, defaultValue, maxValue);
    }
    return defaultValue;
  }

  private static String buildPdfDocumentRegionStyle(
    Map<String, Object> styles,
    Integer height,
    Integer width,
    Boolean autoHeight
  ) {
    String background = normalizePdfStyleValue(
      getStyleValue(styles, 'background'),
      '#ffffff'
    );
    Integer padding = getIntegerStyleValue(styles, 'padding', 0);
    Integer borderWidth = getIntegerStyleValue(styles, 'borderWidth', 0);
    Integer borderRadius = Math.max(
      0,
      getIntegerStyleValue(styles, 'borderRadius', 0)
    );
    String borderStyle = normalizePdfStyleValue(
      getStyleValue(styles, 'borderStyle'),
      'solid'
    );
    String borderColor = normalizePdfStyleValue(
      getStyleValue(styles, 'borderColor'),
      '#c9c9c9'
    );
    Integer cssWidth = Math.max(1, width - (padding * 2) - (borderWidth * 2));
    Integer cssHeight = Math.max(1, height - (padding * 2) - (borderWidth * 2));

    String verticalSize = autoHeight
      ? 'min-height:' + cssHeight + 'px;height:auto;'
      : 'height:' + cssHeight + 'px;';
    return 'width:' +
      cssWidth +
      'px;' +
      verticalSize +
      'background-color:' +
      background +
      ';' +
      'padding:' +
      padding +
      'px;border:' +
      borderWidth +
      'px ' +
      borderStyle +
      ' ' +
      borderColor +
      ';' +
      buildPdfRoundedCornerStyle(borderRadius) +
      'border-collapse:collapse;';
  }

  private static String buildPdfDocumentBlockStyle(
    Map<String, Object> styles,
    Integer x,
    Integer y,
    Integer width,
    Integer height,
    String type,
    Boolean flowRelatedList
  ) {
    String background = normalizePdfStyleValue(
      getStyleValue(styles, 'background'),
      'transparent'
    );
    Integer padding = getIntegerStyleValue(styles, 'padding', 0);
    Integer borderWidth = getIntegerStyleValue(styles, 'borderWidth', 0);
    Integer borderRadius = Math.max(
      0,
      getIntegerStyleValue(styles, 'borderRadius', 0)
    );
    String borderStyle = normalizePdfStyleValue(
      getStyleValue(styles, 'borderStyle'),
      'solid'
    );
    String borderColor = normalizePdfStyleValue(
      getStyleValue(styles, 'borderColor'),
      '#c9c9c9'
    );
    Integer horizontalChrome = (padding * 2) + (borderWidth * 2);
    Integer verticalChrome = (padding * 2) + (borderWidth * 2);
    Integer cssWidth = Math.max(1, width - horizontalChrome);
    Integer cssHeight = Math.max(1, height - verticalChrome);

    // Text blocks in the builder have explicit geometry. Letting them grow
    // in Visualforce changes the containing box and makes later absolute
    // blocks appear too high or overlap it. Related lists remain dynamic
    // because their rendered row count is not known in the editor.
    String verticalSize = type == 'relatedList'
      ? 'min-height:' + cssHeight + 'px;height:auto;'
      : 'height:' + cssHeight + 'px;';
    String overflow = type == 'relatedList' ? 'visible' : 'hidden';

    String positioning = flowRelatedList
      ? 'position:relative;left:' + x + 'px;top:' + y + 'px;'
      : 'position:absolute;left:' + x + 'px;top:' + y + 'px;';
    return positioning +
      'width:' +
      cssWidth +
      'px;' +
      verticalSize +
      'background-color:' +
      background +
      ';' +
      'padding:' +
      padding +
      'px;border:' +
      borderWidth +
      'px ' +
      borderStyle +
      ' ' +
      borderColor +
      ';' +
      buildPdfRoundedCornerStyle(borderRadius) +
      'overflow:' +
      overflow +
      ';';
  }

  private static String buildPdfRoundedCornerStyle(Integer radius) {
    Integer normalizedRadius = radius == null ? 0 : Math.max(0, radius);
    String value = normalizedRadius + 'px;';

    // Salesforce PDF uses Flying Saucer. Emit both shorthand, prefixed and
    // four explicit corners because support differs between renderer builds.
    return 'border-radius:' +
      value +
      '-webkit-border-radius:' +
      value +
      '-moz-border-radius:' +
      value +
      'border-top-left-radius:' +
      value +
      'border-top-right-radius:' +
      value +
      'border-bottom-right-radius:' +
      value +
      'border-bottom-left-radius:' +
      value;
  }

  private static String buildPdfDocumentTextStyle(Map<String, Object> styles) {
    Integer requestedFontSize = getIntegerStyleValue(styles, 'fontSize', 14);
    String textColor = getStyleValue(styles, 'color');
    if (String.isBlank(textColor)) {
      // Backward compatibility with older payloads saved before `color`
      // became the canonical style key.
      textColor = getStyleValue(styles, 'textColor');
    }
    return 'font-family:' +
      normalizePdfFontFamily(getStyleValue(styles, 'fontFamily')) +
      ';' +
      'font-size:' +
      getPdfFontSizeCss(requestedFontSize) +
      ';' +
      'font-weight:' +
      normalizePdfStyleValue(getStyleValue(styles, 'fontWeight'), 'normal') +
      ';' +
      'font-style:' +
      normalizePdfStyleValue(getStyleValue(styles, 'fontStyle'), 'normal') +
      ';' +
      'line-height:1.35;' +
      // Rich text already carries its intentional paragraphs and line breaks
      // as HTML. Preserving source-code whitespace here makes indentation or
      // leading newlines consume real lines in browser preview/PDF, while the
      // builder correctly collapses them.
      'white-space:normal;' +
      'text-align:' +
      normalizePdfStyleValue(getStyleValue(styles, 'textAlign'), 'left') +
      ';' +
      'color:' +
      normalizePdfStyleValue(textColor, '#181818') +
      ';';
  }

  private static Integer getPdfDocumentRegionHeight(
    Map<String, Object> styles,
    String regionKind,
    Integer pagePadding
  ) {
    Decimal scale = getPdfDocumentScale(pagePadding);

    if (regionKind == 'header') {
      return scalePdfDocumentValue(
        getStyleValue(styles, 'height'),
        scale,
        93,
        SETTINGS.pageHeight
      );
    }
    if (regionKind == 'footer') {
      return scalePdfDocumentValue(
        getStyleValue(styles, 'height'),
        scale,
        68,
        SETTINGS.pageHeight
      );
    }

    return Math.max(
      356,
      scalePdfDocumentValue(
        getStyleValue(styles, 'height'),
        scale,
        659,
        SETTINGS.pageHeight
      )
    );
  }

  private static Integer getPdfDocumentBodyCapacity(
    Map<String, Object> model,
    Integer pagePadding
  ) {
    Boolean showHeader = getBooleanValue(model, 'showHeader', true);
    Boolean showFooter = getBooleanValue(model, 'showFooter', true);
    Map<String, Object> header = getMapValue(model, 'header');
    Map<String, Object> footer = getMapValue(model, 'footer');
    Integer visibleRegionCount =
      (showHeader ? 1 : 0) +
      1 +
      (showFooter ? 1 : 0);
    Integer gapHeight =
      Math.max(0, visibleRegionCount - 1) * PDF_SOURCE_REGION_GAP;
    Integer headerHeight = showHeader
      ? getIntegerStyleValue(
          getMapValue(header, 'styles'),
          'height',
          SETTINGS.defaultHeaderHeight
        )
      : 0;
    Integer footerHeight = showFooter
      ? getIntegerStyleValue(
          getMapValue(footer, 'styles'),
          'height',
          SETTINGS.defaultFooterHeight
        )
      : 0;
    Integer contentHeight = Math.max(
      120,
      SETTINGS.pageHeight - (pagePadding * 2)
    );

    return Math.max(
      160,
      contentHeight - gapHeight - headerHeight - footerHeight
    );
  }

  private static Integer getPdfDocumentRegionGap(Integer pagePadding) {
    return scalePdfDocumentValue(
      String.valueOf(PDF_SOURCE_REGION_GAP),
      getPdfDocumentScale(pagePadding),
      24,
      SETTINGS.pageHeight
    );
  }

  private static Decimal getPdfDocumentScale(Integer pagePadding) {
    return getPdfDocumentScale(
      pagePadding,
      getPdfDocumentContentWidth(pagePadding)
    );
  }

  private static Decimal getPdfDocumentScale(
    Integer pagePadding,
    Integer targetWidth
  ) {
    return Decimal.valueOf(targetWidth) /
      Decimal.valueOf(Math.max(1, SETTINGS.pageWidth - (pagePadding * 2)));
  }

  private static Integer getPdfDocumentContentWidth(Integer pagePadding) {
    return Math.max(1, SETTINGS.pageWidth - (pagePadding * 2));
  }

  private static Integer scalePdfDocumentValue(
    String value,
    Decimal scale,
    Integer defaultValue,
    Integer relativeMax
  ) {
    if (String.isBlank(value)) {
      return defaultValue;
    }

    try {
      String normalized = value.trim();
      Boolean isPercent = normalized.endsWith('%');
      if (isPercent) {
        Decimal percentage = Decimal.valueOf(
          normalized.substring(0, normalized.length() - 1)
        );
        return Integer.valueOf(
          String.valueOf(
            (Decimal.valueOf(relativeMax) * (percentage / 100))
              .setScale(0, System.RoundingMode.HALF_UP)
          )
        );
      }
      normalized = normalized.replace('px', '');
      return Integer.valueOf(
        String.valueOf(
          (Decimal.valueOf(normalized) * scale)
            .setScale(0, System.RoundingMode.HALF_UP)
        )
      );
    } catch (Exception error) {
      return defaultValue;
    }
  }

  private static String getBlockOrStyleValue(
    Map<String, Object> block,
    Map<String, Object> styles,
    String key
  ) {
    Object directValue = block == null ? null : block.get(key);
    if (directValue != null) {
      String asString = String.valueOf(directValue);
      if (!String.isBlank(asString)) {
        return asString;
      }
    }
    return getStyleValue(styles, key);
  }

  private static Integer getIntegerStyleValue(
    Map<String, Object> styles,
    String key,
    Integer defaultValue
  ) {
    String value = getStyleValue(styles, key);

    if (String.isBlank(value)) {
      return defaultValue;
    }

    try {
      return Integer.valueOf(
        String.valueOf(
          Decimal.valueOf(value).setScale(0, System.RoundingMode.HALF_UP)
        )
      );
    } catch (Exception error) {
      return defaultValue;
    }
  }

  private static String normalizePdfStyleValue(
    String value,
    String defaultValue
  ) {
    return String.isBlank(value) ? defaultValue : value;
  }

  private static List<Object> getObjectList(
    Map<String, Object> source,
    String key
  ) {
    Object value = source == null ? null : source.get(key);
    return value instanceof List<Object>
      ? (List<Object>) value
      : new List<Object>();
  }

  private static Integer getIntegerValue(
    Map<String, Object> source,
    String key,
    Integer defaultValue
  ) {
    Object value = source == null ? null : source.get(key);

    if (value == null) {
      return defaultValue;
    }

    try {
      return Integer.valueOf(String.valueOf(value));
    } catch (Exception error) {
      return defaultValue;
    }
  }

  private static Boolean getBooleanValue(
    Map<String, Object> source,
    String key,
    Boolean defaultValue
  ) {
    Object value = source == null ? null : source.get(key);
    return value == null
      ? defaultValue
      : Boolean.valueOf(String.valueOf(value));
  }

  private static String renderPdfCanvas(List<Object> blocks) {
    Integer canvasHeight = getPdfCanvasHeight(blocks);

    return '<table border="0" cellpadding="0" cellspacing="0" width="' +
      SETTINGS.pdfCanvasWidth +
      '" align="center" style="width:' +
      SETTINGS.pdfCanvasWidth +
      'px;border-collapse:collapse;margin:0 auto;">' +
      '<tr><td style="padding:0;">' +
      '<div style="width:' +
      SETTINGS.pdfCanvasWidth +
      'px;min-height:' +
      canvasHeight +
      'px;">' +
      renderPdfPositionedBlocks(blocks) +
      '</div>' +
      '</td></tr></table>';
  }

  private static String renderPdfPositionedBlocks(List<Object> blocks) {
    String html = '';
    Integer nextAutoRow = 1;
    Integer previousBottom = 0;

    if (blocks == null) {
      return html;
    }

    for (Object blockObject : blocks) {
      if (blockObject instanceof Map<String, Object>) {
        Map<String, Object> block = (Map<String, Object>) blockObject;
        Map<String, Object> styles = getMapValue(block, 'styles');
        Integer rowStart = getPdfGridRowStart(styles, nextAutoRow);
        Integer rowSpan = getConstrainedIntegerStyle(
          styles,
          'gridRowSpan',
          4,
          1,
          200
        );
        Integer top = (rowStart - 1) * SETTINGS.pdfGridRowHeight;
        Integer spacerHeight = Math.max(0, top - previousBottom);

        if (spacerHeight > 0) {
          html +=
            '<div style="height:' +
            spacerHeight +
            'px;line-height:' +
            spacerHeight +
            'px;font-size:1px;">&#160;</div>';
        }

        html += renderPdfGridBlockRow(block, styles, rowSpan);
        nextAutoRow = Math.max(nextAutoRow, rowStart + rowSpan + 1);
        previousBottom = top + (rowSpan * SETTINGS.pdfGridRowHeight);
      }
    }

    return html;
  }

  private static String renderPdfGridBlockRow(
    Map<String, Object> block,
    Map<String, Object> styles,
    Integer rowSpan
  ) {
    Integer span = getConstrainedIntegerStyle(
      styles,
      'gridColumnSpan',
      SETTINGS.pdfGridColumns,
      1,
      SETTINGS.pdfGridColumns
    );
    Integer start = getConstrainedIntegerStyle(
      styles,
      'gridColumnStart',
      1,
      1,
      SETTINGS.pdfGridColumns - span + 1
    );
    Decimal left = getPdfGridLeft(start);
    Decimal width = getPdfGridWidth(span);
    Integer height = rowSpan * SETTINGS.pdfGridRowHeight;
    String leftCell = left > 0
      ? '<td width="' +
        formatPdfDecimal(left) +
        '" style="width:' +
        formatPdfDecimal(left) +
        'px;font-size:1px;line-height:1px;">&#160;</td>'
      : '';

    return '<table border="0" cellpadding="0" cellspacing="0" width="' +
      SETTINGS.pdfCanvasWidth +
      '" style="width:' +
      SETTINGS.pdfCanvasWidth +
      'px;border-collapse:collapse;">' +
      '<tr>' +
      leftCell +
      '<td width="' +
      formatPdfDecimal(width) +
      '" height="' +
      height +
      '" valign="top" style="' +
      buildPdfGridBlockCellStyle(width, height) +
      '">' +
      renderPdfBuilderBlock(block) +
      '</td>' +
      '</tr>' +
      '</table>';
  }

  private static Decimal getPdfGridLeft(Integer start) {
    Decimal columnWidth =
      Decimal.valueOf(
        SETTINGS.pdfCanvasWidth -
        (SETTINGS.pdfGridGap * (SETTINGS.pdfGridColumns - 1))
      ) / SETTINGS.pdfGridColumns;

    return (start - 1) * (columnWidth + SETTINGS.pdfGridGap);
  }

  private static Decimal getPdfGridWidth(Integer span) {
    Decimal columnWidth =
      Decimal.valueOf(
        SETTINGS.pdfCanvasWidth -
        (SETTINGS.pdfGridGap * (SETTINGS.pdfGridColumns - 1))
      ) / SETTINGS.pdfGridColumns;

    return (span * columnWidth) + ((span - 1) * SETTINGS.pdfGridGap);
  }

  private static String buildPdfGridBlockCellStyle(
    Decimal width,
    Integer height
  ) {
    return 'width:' +
      formatPdfDecimal(width) +
      'px;' +
      'height:' +
      height +
      'px;' +
      'box-sizing:border-box;' +
      'overflow:hidden;';
  }

  private static Integer getPdfCanvasHeight(List<Object> blocks) {
    Integer maxRows = 44;
    Integer nextAutoRow = 1;

    if (blocks == null) {
      return maxRows * SETTINGS.pdfGridRowHeight;
    }

    for (Object blockObject : blocks) {
      if (!(blockObject instanceof Map<String, Object>)) {
        continue;
      }

      Map<String, Object> block = (Map<String, Object>) blockObject;
      Map<String, Object> styles = getMapValue(block, 'styles');
      Integer rowStart = getPdfGridRowStart(styles, nextAutoRow);
      Integer rowSpan = getConstrainedIntegerStyle(
        styles,
        'gridRowSpan',
        4,
        1,
        200
      );
      maxRows = Math.max(maxRows, rowStart + rowSpan + 2);
      nextAutoRow = Math.max(nextAutoRow, rowStart + rowSpan + 1);
    }

    return maxRows * SETTINGS.pdfGridRowHeight;
  }

  private static Integer getPdfGridRowStart(
    Map<String, Object> styles,
    Integer autoRowStart
  ) {
    String value = getStyleValue(styles, 'gridRowStart');

    if (String.isBlank(value) || value == 'auto') {
      return autoRowStart;
    }

    return getConstrainedIntegerStyle(
      styles,
      'gridRowStart',
      autoRowStart,
      1,
      200
    );
  }

  private static String renderPdfBlocks(List<Object> blocks) {
    String html = '';

    if (blocks == null) {
      return html;
    }

    for (Object blockObject : blocks) {
      if (blockObject instanceof Map<String, Object>) {
        html += renderPdfBlock((Map<String, Object>) blockObject);
      }
    }

    return html;
  }

  private static String renderPdfBlock(Map<String, Object> block) {
    String type = getStringValue(block, 'type');
    Map<String, Object> styles = getMapValue(block, 'styles');

    if (type == 'section') {
      return renderPdfSection(block, styles);
    }

    if (type == 'image') {
      return renderPdfImage(block);
    }

    if (type == 'table') {
      return renderPdfTable(getBlockList(block, 'rows'), styles);
    }

    if (type == 'relatedList') {
      return renderPdfRelatedListToken(block);
    }

    if (type == 'columns2' || type == 'columns3') {
      return renderPdfColumns(getBlockList(block, 'columns'));
    }

    if (type == 'text') {
      return '<div style="' +
        buildPdfTextStyle(styles) +
        '">' +
        renderRichTextContentForPdf(getStringValue(block, 'content')) +
        '</div>';
    }

    if (type == 'field') {
      return '<div style="' +
        buildPdfFieldStyle(styles) +
        '">' +
        renderRichTextContentForPdf(getStringValue(block, 'content')) +
        '</div>';
    }

    if (type == 'divider') {
      return '<hr />';
    }

    return '';
  }

  private static String renderPdfBuilderBlock(Map<String, Object> block) {
    String type = getStringValue(block, 'type');
    Map<String, Object> styles = getMapValue(block, 'styles');

    if (type == 'section') {
      return renderPdfBuilderSection(block, styles);
    }

    if (type == 'text') {
      return '<div style="' +
        buildPdfBuilderBlockStyle(styles) +
        '">' +
        '<div style="' +
        buildPdfTextStyle(styles) +
        '">' +
        renderRichTextContentForPdf(getStringValue(block, 'content')) +
        '</div>' +
        '</div>';
    }

    if (type == 'field') {
      return '<div style="' +
        buildPdfBuilderBlockStyle(styles) +
        '">' +
        '<div style="' +
        buildPdfFieldStyle(styles) +
        '">' +
        renderRichTextContentForPdf(getStringValue(block, 'content')) +
        '</div></div>';
    }

    if (type == 'image') {
      Integer width = getConstrainedIntegerStyle(styles, 'width', 240, 1, 2000);
      Integer height = getConstrainedIntegerStyle(
        styles,
        'height',
        98,
        1,
        2000
      );
      return '<div style="' +
        buildPdfBuilderBlockStyle(styles) +
        '">' +
        renderPdfImageContent(block, styles, width, height) +
        '</div>';
    }

    if (type == 'table') {
      return '<div style="' +
        buildPdfBuilderBlockStyle(styles) +
        '">' +
        renderPdfTable(getBlockList(block, 'rows'), styles) +
        '</div>';
    }

    if (type == 'relatedList') {
      return '<div style="' +
        buildPdfBuilderBlockStyle(styles) +
        '">' +
        renderPdfRelatedListToken(block) +
        '</div>';
    }

    if (type == 'columns2' || type == 'columns3') {
      return '<div style="' +
        buildPdfBuilderBlockStyle(styles) +
        '">' +
        renderPdfColumns(getBlockList(block, 'columns')) +
        '</div>';
    }

    if (type == 'divider') {
      return '<div style="' +
        buildPdfBuilderBlockStyle(styles) +
        '">' +
        '<hr style="margin:0;border:0;border-top:1px solid #c9c9c9;" />' +
        '</div>';
    }

    return '';
  }

  private static String renderPdfBuilderSection(
    Map<String, Object> block,
    Map<String, Object> styles
  ) {
    return '<table border="0" cellpadding="0" cellspacing="0" width="100%" style="' +
      buildPdfBuilderBlockStyle(styles) +
      'border-collapse:collapse;">' +
      '<tr><td style="' +
      buildPdfBuilderSectionDropZoneStyle(styles) +
      '">' +
      renderPdfBuilderBlocks(getBlockList(block, 'children')) +
      '</td></tr>' +
      '</table>';
  }

  private static String renderPdfBuilderBlocks(List<Object> blocks) {
    String html = '';

    if (blocks == null) {
      return html;
    }

    for (Object blockObject : blocks) {
      if (blockObject instanceof Map<String, Object>) {
        html += renderPdfBuilderBlock((Map<String, Object>) blockObject);
      }
    }

    return html;
  }

  private static String buildPdfBuilderBlockStyle(Map<String, Object> styles) {
    List<String> declarations = new List<String>();
    addDeclaration(
      declarations,
      'background-color',
      getStyleValue(styles, 'background')
    );
    addDeclaration(declarations, 'padding', getStyleValue(styles, 'padding'));
    addDeclaration(
      declarations,
      'width',
      getPdfConstrainedWidth(getStyleValue(styles, 'width'))
    );
    addDeclaration(declarations, 'height', getStyleValue(styles, 'height'));
    addDeclaration(declarations, 'text-align', getPdfTextAlign(styles));
    declarations.add('box-sizing:border-box');
    declarations.add('overflow:hidden');

    if (isStyleEnabled(styles, 'borderEnabled')) {
      String borderWidth = getStyleValue(styles, 'borderWidth');
      String borderColor = getStyleValue(styles, 'borderColor');
      declarations.add(
        'border:' +
          (String.isBlank(borderWidth) ? '1px' : borderWidth) +
          ' solid ' +
          (String.isBlank(borderColor) ? '#9ca3af' : borderColor)
      );
    }

    return String.join(declarations, ';') + ';';
  }

  private static String buildPdfBuilderSectionDropZoneStyle(
    Map<String, Object> styles
  ) {
    List<String> declarations = new List<String>{
      'min-height:100px',
      'padding:12px',
      'border:1px dashed #c9c9c9',
      'border-radius:4px',
      'background-color:transparent',
      'box-sizing:border-box',
      'vertical-align:top'
    };
    addDeclaration(declarations, 'text-align', getPdfTextAlign(styles));
    return String.join(declarations, ';') + ';';
  }

  private static String renderPdfSection(
    Map<String, Object> block,
    Map<String, Object> styles
  ) {
    String background = getStyleValue(styles, 'background');
    String backgroundAttribute = String.isBlank(background)
      ? ''
      : ' bgcolor="' + escapeHtml(background) + '"';
    String widthAttribute = getPdfDimensionAttribute(
      'width',
      getStyleValue(styles, 'width'),
      '100%'
    );
    String heightAttribute = getPdfDimensionAttribute(
      'height',
      getStyleValue(styles, 'height'),
      ''
    );
    String html =
      '<table border="0" cellpadding="0" cellspacing="0"' +
      backgroundAttribute +
      widthAttribute +
      heightAttribute +
      ' style="' +
      buildPdfSectionOuterStyle(styles) +
      '">' +
      '<tr><td' +
      backgroundAttribute +
      heightAttribute +
      ' style="' +
      buildPdfSectionInnerStyle(styles) +
      '">';

    html += renderPdfBlocks(getBlockList(block, 'children'));
    html += '</td></tr></table>';

    return html;
  }

  private static String renderPdfTable(
    List<Object> rows,
    Map<String, Object> styles
  ) {
    String html =
      '<table border="1" cellpadding="8" cellspacing="0" width="100%" style="' +
      buildPdfBlockStyle(styles, false) +
      'border-collapse:collapse;">';

    for (Object rowObject : rows) {
      if (rowObject instanceof Map<String, Object>) {
        html += '<tr>';

        for (
          Object cellObject : getBlockList(
            (Map<String, Object>) rowObject,
            'cells'
          )
        ) {
          if (cellObject instanceof Map<String, Object>) {
            Map<String, Object> cell = (Map<String, Object>) cellObject;
            html +=
              '<td style="' +
              buildPdfCellStyle(getMapValue(cell, 'styles')) +
              '">' +
              renderPdfBlocks(getBlockList(cell, 'children')) +
              '</td>';
          }
        }

        html += '</tr>';
      }
    }

    return html + '</table>';
  }

  private static String renderPdfCurrentTable(
    Map<String, Object> block,
    Map<String, Object> styles
  ) {
    Integer rowCount = getConstrainedIntegerStyle(
      styles,
      'tableRows',
      3,
      1,
      12
    );
    Integer columnCount = getConstrainedIntegerStyle(
      styles,
      'tableColumns',
      3,
      1,
      12
    );
    List<Object> tableData = getObjectList(block, 'tableData');
    List<Object> tableCellAlignments = getObjectList(
      block,
      'tableCellAlignments'
    );
    String defaultVerticalAlign = normalizePdfStyleValue(
      getStyleValue(styles, 'tableCellVerticalAlign'),
      'top'
    );
    String html =
      '<table border="0" cellpadding="0" cellspacing="0" width="100%" height="100%" style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;">' +
      '<tbody>';

    for (Integer rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      List<Object> rowData = getNestedObjectList(tableData, rowIndex);
      List<Object> rowAlignments = getNestedObjectList(
        tableCellAlignments,
        rowIndex
      );
      html += '<tr>';

      for (
        Integer columnIndex = 0; columnIndex < columnCount; columnIndex += 1
      ) {
        Object rawCellData = columnIndex < rowData.size()
          ? rowData[columnIndex]
          : null;
        String cellContent = getCurrentTableCellContent(rawCellData);
        String verticalAlign = columnIndex < rowAlignments.size()
          ? String.valueOf(rowAlignments[columnIndex])
          : defaultVerticalAlign;
        if (
          verticalAlign != 'middle' &&
          verticalAlign != 'bottom' &&
          verticalAlign != 'top'
        ) {
          verticalAlign = defaultVerticalAlign;
        }

        html +=
          '<td valign="' +
          verticalAlign +
          '" style="' +
          buildPdfCurrentTableCellStyle(styles, verticalAlign) +
          '">' +
          (String.isBlank(cellContent)
            ? '&nbsp;'
            : renderRichTextContentForPdf(cellContent)) +
          '</td>';
      }

      html += '</tr>';
    }

    return html + '</tbody></table>';
  }

  private static List<Object> getNestedObjectList(
    List<Object> values,
    Integer index
  ) {
    if (values == null || index < 0 || index >= values.size()) {
      return new List<Object>();
    }

    Object value = values[index];
    return value instanceof List<Object>
      ? (List<Object>) value
      : new List<Object>();
  }

  private static String getCurrentTableCellContent(Object rawCellData) {
    if (rawCellData == null) {
      return '';
    }
    if (rawCellData instanceof Map<String, Object>) {
      return getStringValue((Map<String, Object>) rawCellData, 'content');
    }
    return String.valueOf(rawCellData);
  }

  private static String buildPdfCurrentTableCellStyle(
    Map<String, Object> styles,
    String verticalAlign
  ) {
    Integer borderWidth = getConstrainedIntegerStyle(
      styles,
      'tableBorderWidth',
      1,
      0,
      20
    );
    Integer cellPadding = getConstrainedIntegerStyle(
      styles,
      'tableCellPadding',
      8,
      0,
      100
    );
    String borderColor = normalizePdfStyleValue(
      getStyleValue(styles, 'tableBorderColor'),
      '#c9c9c9'
    );
    String border = borderWidth == 0
      ? '0'
      : String.valueOf(borderWidth) + 'px solid ' + borderColor;
    List<String> declarations = new List<String>{
      'border:' + border,
      'padding:' +
      cellPadding +
      'px',
      'vertical-align:' + verticalAlign,
      'box-sizing:border-box',
      'min-width:0',
      'max-width:100%',
      'white-space:normal',
      'overflow:hidden',
      'overflow-wrap:anywhere',
      'word-break:break-word'
    };
    addDeclaration(
      declarations,
      'text-align',
      getStyleValue(styles, 'textAlign')
    );
    return String.join(declarations, ';') + ';';
  }

  private static String renderPdfColumns(List<Object> columns) {
    String html = '<table border="0" cellpadding="8" cellspacing="0" width="100%"><tr>';

    for (Object columnObject : columns) {
      if (columnObject instanceof Map<String, Object>) {
        html +=
          '<td>' +
          renderPdfBlocks(
            getBlockList((Map<String, Object>) columnObject, 'children')
          ) +
          '</td>';
      }
    }

    return html + '</tr></table>';
  }

  private static String renderPdfImage(Map<String, Object> block) {
    Map<String, Object> styles = getMapValue(block, 'styles');
    Integer width = getConstrainedIntegerStyle(styles, 'width', 240, 1, 2000);
    Integer height = getConstrainedIntegerStyle(styles, 'height', 98, 1, 2000);
    return renderPdfImageContent(block, styles, width, height);
  }

  private static String renderPdfImageContent(
    Map<String, Object> block,
    Map<String, Object> styles,
    Integer computedWidth,
    Integer computedHeight
  ) {
    String originalImageSrc = getStringValue(block, 'imageSrc');
    String persistedImageSrc = getStringValue(block, 'pdfImageSrc');
    String preferredImageSrc = String.isBlank(persistedImageSrc)
      ? originalImageSrc
      : persistedImageSrc;
    String imageSrc = normalizePdfImageUrl(
      getPdfRenderableImageSrc(preferredImageSrc)
    );

    if (!isPdfSupportedImageSrc(imageSrc)) {
      imageSrc = normalizePdfImageUrl(resolveStoredImageUrl(originalImageSrc));
    }

    imageSrc = getPdfImageSourceForPdf(imageSrc);

    if (!isPdfSupportedImageSrc(imageSrc)) {
      return renderPdfImageFallback(
        styles,
        String.isBlank(originalImageSrc)
          ? 'Image is empty.'
          : 'Image source is not available to the PDF renderer. Source type: ' +
            getImageSourceType(originalImageSrc) +
            '.'
      );
    }

    String effectiveWidth = String.valueOf(Math.max(1, computedWidth));
    String effectiveHeight = String.valueOf(Math.max(1, computedHeight));
    return '<div style="width:100%;height:100%;text-align:center;">' +
      '<img src="' +
      escapeHtml(imageSrc) +
      '"' +
      ' height="' +
      escapeHtml(effectiveHeight) +
      '"' +
      ' style="' +
      buildPdfImageStyle(styles, effectiveWidth, effectiveHeight) +
      '" />' +
      '</div>';
  }

  private static String getPdfRenderableImageSrc(String src) {
    if (!isDataImageSrc(src)) {
      return src;
    }

    Integer metadataEnd = src.indexOf(';base64,');
    Integer dataStart = src.indexOf(',');

    if (metadataEnd <= 5 || dataStart < 0 || dataStart >= src.length() - 1) {
      return src;
    }

    String contentType = src.substring(5, metadataEnd);
    String base64Data = src.substring(dataStart + 1);

    // Visualforce PDF rendering cannot perform DML. Data URLs from older
    // templates must degrade gracefully instead of trying to persist here.
    if (!allowContentDistributionDml) {
      return src;
    }

    try {
      return saveTemplateImage(
        'template-image' + getImageExtension(contentType),
        base64Data,
        contentType
      );
    } catch (Exception error) {
      return src;
    }
  }

  private static Boolean isDataImageSrc(String src) {
    if (String.isBlank(src)) {
      return false;
    }

    return src.toLowerCase().startsWith('data:image/');
  }

  private static String renderPdfImageFallback(
    Map<String, Object> styles,
    String message
  ) {
    return '<div style="' +
      buildPdfImagePlaceholderStyle(styles) +
      '">' +
      escapeHtml(message) +
      '</div>';
  }

  private static String replaceImagesWithPdfNotice(
    String html,
    String imageDiagnostics
  ) {
    String replacement =
      '<div style="border:1px dashed #9ca3af;color:#706e6b;font-size:11px;text-align:center;padding:12px;">' +
      escapeHtml(imageDiagnostics) +
      '</div>';

    return html.replaceAll(
      '(?i)<img\\s+[^>]*>',
      escapeRegexReplacement(replacement)
    );
  }

  private static String getImageDiagnostics(String html) {
    if (String.isBlank(html)) {
      return 'Image could not be rendered by the PDF engine. No HTML body.';
    }

    Pattern imagePattern = Pattern.compile(
      '(?i)<img\\s+[^>]*src="([^"]*)"[^>]*>'
    );
    Matcher imageMatcher = imagePattern.matcher(html);
    List<String> diagnostics = new List<String>();

    while (imageMatcher.find() && diagnostics.size() < 3) {
      String src = imageMatcher.group(1);
      diagnostics.add(
        getImageSourceType(src) + ': ' + shortenForPdfDiagnostic(src)
      );
    }

    if (diagnostics.isEmpty()) {
      return 'Image could not be rendered by the PDF engine. No img src found.';
    }

    return 'Image could not be rendered by the Visualforce PDF engine. Sources: ' +
      String.join(diagnostics, ' | ');
  }

  private static String rewriteHtmlImageSourcesForPdf(String html) {
    if (String.isBlank(html)) {
      return html;
    }

    Pattern imagePattern = Pattern.compile(
      '(?i)<img\\s+[^>]*src="([^"]*)"[^>]*>'
    );
    Matcher imageMatcher = imagePattern.matcher(html);
    Map<String, String> replacements = new Map<String, String>();

    while (imageMatcher.find()) {
      String originalSrc = imageMatcher.group(1);
      String pdfSrc = getPdfImageSourceForPdf(
        normalizePdfImageUrl(originalSrc)
      );

      if (!String.isBlank(pdfSrc) && pdfSrc != originalSrc) {
        replacements.put(originalSrc, pdfSrc);
      }
    }

    for (String originalSrc : replacements.keySet()) {
      html = html.replace(
        'src="' + originalSrc + '"',
        'src="' + escapeHtml(replacements.get(originalSrc)) + '"'
      );
    }

    return html;
  }

  private static String shortenForPdfDiagnostic(String value) {
    if (String.isBlank(value)) {
      return 'empty';
    }

    return value.length() > 120 ? value.substring(0, 120) + '...' : value;
  }

  private static String escapeRegexReplacement(String value) {
    return value.replace('\\', '\\\\').replace('$', '\\$');
  }

  private static List<Object> getBlockList(
    Map<String, Object> source,
    String key
  ) {
    Object value = source.get(key);

    if (value instanceof List<Object>) {
      return (List<Object>) value;
    }

    return new List<Object>();
  }

  private static String getStringValue(Map<String, Object> source, String key) {
    Object value = source.get(key);

    return value == null ? '' : String.valueOf(value);
  }

  private static Map<String, Object> getMapValue(
    Map<String, Object> source,
    String key
  ) {
    Object value = source.get(key);

    if (value instanceof Map<String, Object>) {
      return (Map<String, Object>) value;
    }

    return new Map<String, Object>();
  }

  private static String buildPdfBlockStyle(
    Map<String, Object> styles,
    Boolean includeMargin
  ) {
    List<String> declarations = new List<String>();
    addDeclaration(
      declarations,
      'background-color',
      getStyleValue(styles, 'background')
    );
    addDeclaration(declarations, 'padding', getStyleValue(styles, 'padding'));
    addDeclaration(
      declarations,
      'width',
      getPdfConstrainedWidth(getStyleValue(styles, 'width'))
    );
    addDeclaration(declarations, 'height', getStyleValue(styles, 'height'));
    addDeclaration(declarations, 'text-align', getPdfTextAlign(styles));

    if (isStyleEnabled(styles, 'borderEnabled')) {
      String borderWidth = getStyleValue(styles, 'borderWidth');
      String borderColor = getStyleValue(styles, 'borderColor');
      declarations.add(
        'border:' +
          (String.isBlank(borderWidth) ? '1px' : borderWidth) +
          ' solid ' +
          (String.isBlank(borderColor) ? '#9ca3af' : borderColor)
      );
    }

    if (includeMargin) {
      declarations.add('margin-bottom:12px');
    }

    return String.join(declarations, ';') + ';';
  }

  private static String buildPdfSectionOuterStyle(Map<String, Object> styles) {
    List<String> declarations = new List<String>();
    addDeclaration(
      declarations,
      'background-color',
      getStyleValue(styles, 'background')
    );
    String width = getStyleValue(styles, 'width');
    declarations.add('width:' + getPdfConstrainedWidth(width));
    addDeclaration(declarations, 'height', getStyleValue(styles, 'height'));
    addDeclaration(declarations, 'text-align', getPdfTextAlign(styles));

    if (isStyleEnabled(styles, 'borderEnabled')) {
      String borderWidth = getStyleValue(styles, 'borderWidth');
      String borderColor = getStyleValue(styles, 'borderColor');
      declarations.add(
        'border:' +
          (String.isBlank(borderWidth) ? '1px' : borderWidth) +
          ' solid ' +
          (String.isBlank(borderColor) ? '#9ca3af' : borderColor)
      );
    }

    declarations.add('margin-bottom:12px');
    declarations.add('border-collapse:collapse');
    return String.join(declarations, ';') + ';';
  }

  private static String buildPdfSectionInnerStyle(Map<String, Object> styles) {
    List<String> declarations = new List<String>();
    addDeclaration(
      declarations,
      'background-color',
      getStyleValue(styles, 'background')
    );
    addDeclaration(declarations, 'padding', getStyleValue(styles, 'padding'));
    addDeclaration(declarations, 'height', getStyleValue(styles, 'height'));
    addDeclaration(declarations, 'text-align', getPdfTextAlign(styles));
    addDeclaration(
      declarations,
      'vertical-align',
      getStyleValue(styles, 'verticalAlign')
    );
    return String.join(declarations, ';') + ';';
  }

  private static String buildPdfTextStyle(Map<String, Object> styles) {
    List<String> declarations = getPdfBlockDeclarations(styles);
    addDeclaration(
      declarations,
      'font-size',
      getPdfFontSizeCss(getIntegerStyleValue(styles, 'fontSize', 14))
    );
    addDeclaration(
      declarations,
      'font-family',
      normalizePdfFontFamily(getStyleValue(styles, 'fontFamily'))
    );
    addDeclaration(
      declarations,
      'font-weight',
      getStyleValue(styles, 'fontWeight')
    );
    addDeclaration(
      declarations,
      'font-style',
      getStyleValue(styles, 'fontStyle')
    );
    addDeclaration(
      declarations,
      'text-decoration',
      getStyleValue(styles, 'textDecoration')
    );
    String textColor = getStyleValue(styles, 'color');
    if (String.isBlank(textColor)) {
      // Backward compatibility with older payloads.
      textColor = getStyleValue(styles, 'textColor');
    }
    addDeclaration(declarations, 'color', textColor);
    declarations.add('line-height:1.35');
    declarations.add('white-space:pre-wrap');
    declarations.add('margin:0');
    return String.join(declarations, ';') + ';';
  }

  private static String normalizePdfFontFamily(String value) {
    String requested = String.isBlank(value) ? '' : value.toLowerCase();

    if (
      requested.contains('times') ||
      requested.contains('georgia') ||
      requested.contains('garamond') ||
      requested.contains('palatino') ||
      requested.contains('cambria')
    ) {
      return 'Times New Roman, serif';
    }

    if (requested.contains('courier') || requested.contains('lucida console')) {
      return 'Courier New, monospace';
    }

    // Keep sans-serif as default for PDF stability.
    return 'Arial, Helvetica, sans-serif';
  }

  private static String getPdfFontSizeCss(Integer sourceFontSizePx) {
    Integer normalized = sourceFontSizePx == null
      ? 14
      : Math.max(1, sourceFontSizePx);
    Decimal scaled = Decimal.valueOf(normalized) * SETTINGS.pdfFontScale;
    return String.valueOf(scaled.setScale(2, System.RoundingMode.HALF_UP)) +
      'px';
  }

  private static String buildPdfFieldStyle(Map<String, Object> styles) {
    List<String> declarations = getPdfBlockDeclarations(styles);
    declarations.add('display:block');
    addDeclaration(
      declarations,
      'font-size',
      getPdfFontSizeCss(getIntegerStyleValue(styles, 'fontSize', 14))
    );
    addDeclaration(
      declarations,
      'font-family',
      normalizePdfFontFamily(getStyleValue(styles, 'fontFamily'))
    );
    addDeclaration(
      declarations,
      'font-weight',
      getStyleValue(styles, 'fontWeight')
    );
    addDeclaration(
      declarations,
      'font-style',
      getStyleValue(styles, 'fontStyle')
    );
    addDeclaration(
      declarations,
      'text-decoration',
      getStyleValue(styles, 'textDecoration')
    );
    String textColor = getStyleValue(styles, 'color');
    if (String.isBlank(textColor)) {
      textColor = getStyleValue(styles, 'textColor');
    }
    addDeclaration(declarations, 'color', textColor);
    declarations.add('line-height:1.35');
    declarations.add('white-space:pre-wrap');
    declarations.add('margin:0');
    return String.join(declarations, ';') + ';';
  }

  private static String buildPdfCellStyle(Map<String, Object> styles) {
    List<String> declarations = new List<String>{
      'border:1px solid #c9c9c9',
      'padding:8px'
    };
    addDeclaration(
      declarations,
      'text-align',
      getStyleValue(styles, 'horizontalAlign')
    );
    addDeclaration(
      declarations,
      'vertical-align',
      getStyleValue(styles, 'verticalAlign')
    );
    return String.join(declarations, ';') + ';';
  }

  private static String buildPdfImageStyle(
    Map<String, Object> styles,
    String widthOverride,
    String heightOverride
  ) {
    String normalizedWidth = normalizeCssLength(widthOverride);
    String normalizedHeight = normalizeCssLength(heightOverride);

    if (String.isBlank(normalizedWidth)) {
      normalizedWidth = normalizeCssLength(getStyleValue(styles, 'width'));
    }
    if (String.isBlank(normalizedHeight)) {
      normalizedHeight = normalizeCssLength(getStyleValue(styles, 'height'));
    }

    List<String> declarations = new List<String>{ 'display:inline-block' };
    declarations.add('width:auto');
    if (!String.isBlank(normalizedHeight)) {
      declarations.add('height:' + normalizedHeight);
    } else {
      declarations.add('height:auto');
    }
    declarations.add('margin:0 auto');
    declarations.add('padding:0');
    declarations.add('border:0');
    declarations.add('vertical-align:top');
    return String.join(declarations, ';') + ';';
  }

  private static String normalizeCssLength(String value) {
    if (String.isBlank(value)) {
      return '';
    }
    String normalized = value.trim();
    if (normalized.endsWith('px') || normalized.endsWith('%')) {
      return normalized;
    }
    try {
      Decimal parsed = Decimal.valueOf(normalized);
      if (parsed < 0) {
        return '';
      }
      if (parsed == parsed.setScale(0)) {
        return String.valueOf(parsed.intValue()) + 'px';
      }
      return String.valueOf(parsed) + 'px';
    } catch (Exception ignored) {
      return '';
    }
  }

  private static String buildPdfImagePlaceholderStyle(
    Map<String, Object> styles
  ) {
    List<String> declarations = new List<String>{
      'border:1px dashed #9ca3af',
      'color:#706e6b',
      'font-size:11px',
      'text-align:center'
    };
    addDeclaration(
      declarations,
      'width',
      getPdfConstrainedWidth(getStyleValue(styles, 'width'))
    );
    addDeclaration(declarations, 'height', getStyleValue(styles, 'height'));
    addDeclaration(declarations, 'padding', getStyleValue(styles, 'padding'));
    return String.join(declarations, ';') + ';';
  }

  private static String renderPdfRelatedListToken(Map<String, Object> block) {
    String relationshipName = getStringValue(
      block,
      'relatedListRelationshipName'
    );
    String columnCsv = getStringValue(block, 'relatedListColumnCsv');
    if (String.isBlank(columnCsv)) {
      List<String> columns = new List<String>();
      for (Object columnValue : getObjectList(block, 'relatedListColumns')) {
        String columnName = columnValue == null
          ? ''
          : String.valueOf(columnValue).trim();
        if (!String.isBlank(columnName)) {
          columns.add(columnName);
        }
      }
      columnCsv = String.join(columns, ',');
    }

    if (String.isBlank(relationshipName) || String.isBlank(columnCsv)) {
      return '<div style="border:1px dashed #9ca3af;color:#706e6b;font-size:11px;text-align:center;padding:12px;">Configure related list</div>';
    }

    String zebra = '1';
    String oddColor = getStringValue(block, 'relatedListOddRowColor');
    String evenColor = getStringValue(block, 'relatedListEvenRowColor');
    String headerColor = getStringValue(block, 'relatedListHeaderRowColor');
    Map<String, Object> styles = getMapValue(block, 'styles');
    String textColor = getStringValue(block, 'relatedListTextColor');
    if (String.isBlank(textColor)) {
      textColor = getStyleValue(styles, 'relatedListTextColor');
    }
    String oddTextColor = getStringValue(block, 'relatedListOddTextColor');
    if (String.isBlank(oddTextColor)) {
      oddTextColor = getStyleValue(styles, 'relatedListOddTextColor');
    }
    if (String.isBlank(oddTextColor)) {
      oddTextColor = textColor;
    }
    String evenTextColor = getStringValue(block, 'relatedListEvenTextColor');
    if (String.isBlank(evenTextColor)) {
      evenTextColor = getStyleValue(styles, 'relatedListEvenTextColor');
    }
    if (String.isBlank(evenTextColor)) {
      evenTextColor = textColor;
    }
    String fontSize = getStringValue(block, 'relatedListFontSize');
    if (String.isBlank(fontSize)) {
      fontSize = getStyleValue(styles, 'relatedListFontSize');
    }
    String borderMode = getStringValue(block, 'relatedListBorderMode');
    if (String.isBlank(borderMode)) {
      borderMode = 'all';
    }
    String cellPadding = getStyleValue(styles, 'tableCellPadding');
    if (String.isBlank(cellPadding)) {
      cellPadding = '8';
    }

    return '[[DBRL|' +
      relationshipName +
      '|' +
      columnCsv +
      '|' +
      zebra +
      '|' +
      oddColor +
      '|' +
      evenColor +
      '|' +
      headerColor +
      '|' +
      textColor +
      '|' +
      fontSize +
      '|' +
      oddTextColor +
      '|' +
      evenTextColor +
      '|' +
      borderMode +
      '|' +
      cellPadding +
      ']]';
  }

  private static String mergeRelatedListTables(
    String html,
    Id recordId,
    String objectApiName
  ) {
    return mergeRelatedListTables(html, recordId, objectApiName, true);
  }

  private static String mergeRelatedListTables(
    String html,
    Id recordId,
    String objectApiName,
    Boolean applyPdfFontScale
  ) {
    if (
      String.isBlank(html) ||
      recordId == null ||
      String.isBlank(objectApiName)
    ) {
      return html;
    }

    Pattern tokenPattern = Pattern.compile('\\[\\[DBRL\\|([^\\]]*)\\]\\]');
    Matcher matcher = tokenPattern.matcher(html);
    String transformed = html;
    Set<String> processedTokens = new Set<String>();

    while (matcher.find()) {
      String token = matcher.group(0);
      if (processedTokens.contains(token)) {
        continue;
      }
      processedTokens.add(token);

      List<String> tokenParts = parseRelatedListTokenParts(matcher.group(1));
      if (tokenParts.size() < 6) {
        continue;
      }

      String relationshipName = tokenParts[0];
      String columnCsv = tokenParts[1];
      Boolean zebraEnabled = parseRelatedListBoolean(tokenParts[2], true);
      String oddColor = String.isBlank(tokenParts[3])
        ? '#ffffff'
        : tokenParts[3];
      String evenColor = String.isBlank(tokenParts[4])
        ? '#f7f7f7'
        : tokenParts[4];
      String headerColor = String.isBlank(tokenParts[5])
        ? '#e5e7eb'
        : tokenParts[5];
      String textColor = tokenParts.size() > 6 && !String.isBlank(tokenParts[6])
        ? tokenParts[6]
        : '#181818';
      Integer fontSize = 12;
      if (tokenParts.size() > 7 && !String.isBlank(tokenParts[7])) {
        try {
          fontSize = Math.max(8, Math.min(36, Integer.valueOf(tokenParts[7])));
        } catch (Exception ignored) {
          fontSize = 12;
        }
      }
      String oddTextColor = tokenParts.size() > 8 &&
        !String.isBlank(tokenParts[8])
        ? tokenParts[8]
        : textColor;
      String evenTextColor = tokenParts.size() > 9 &&
        !String.isBlank(tokenParts[9])
        ? tokenParts[9]
        : textColor;
      String borderMode = tokenParts.size() > 10 &&
        !String.isBlank(tokenParts[10])
        ? tokenParts[10]
        : 'all';
      Integer cellPadding = 8;
      if (tokenParts.size() > 11 && !String.isBlank(tokenParts[11])) {
        try {
          cellPadding = Math.max(
            0,
            Math.min(32, Integer.valueOf(tokenParts[11]))
          );
        } catch (Exception ignored) {
          cellPadding = 8;
        }
      }

      String tableHtml = buildRelatedListTableHtml(
        recordId,
        objectApiName,
        relationshipName,
        columnCsv,
        zebraEnabled,
        oddColor,
        evenColor,
        headerColor,
        textColor,
        fontSize,
        oddTextColor,
        evenTextColor,
        borderMode,
        cellPadding,
        applyPdfFontScale
      );

      transformed = transformed.replace(token, tableHtml);
    }

    return transformed;
  }

  private static List<String> parseRelatedListTokenParts(String payload) {
    if (String.isBlank(payload)) {
      return new List<String>();
    }

    List<String> parts = payload.split('\\|');
    List<String> normalized = new List<String>();
    for (String part : parts) {
      normalized.add(part == null ? '' : part.trim());
    }
    return normalized;
  }

  private static Boolean parseRelatedListBoolean(
    String value,
    Boolean defaultValue
  ) {
    if (String.isBlank(value)) {
      return defaultValue;
    }

    String normalized = value.trim().toLowerCase();
    if (normalized == '1' || normalized == 'true' || normalized == 'yes') {
      return true;
    }
    if (normalized == '0' || normalized == 'false' || normalized == 'no') {
      return false;
    }

    return defaultValue;
  }

  private static String buildRelatedListTableHtml(
    Id recordId,
    String objectApiName,
    String relationshipName,
    String columnCsv,
    Boolean zebraEnabled,
    String oddColor,
    String evenColor,
    String headerColor,
    String textColor,
    Integer fontSize,
    String oddTextColor,
    String evenTextColor,
    String borderMode,
    Integer cellPadding,
    Boolean applyPdfFontScale
  ) {
    Map<String, Schema.SObjectType> objectMap = Schema.getGlobalDescribe();
    if (!objectMap.containsKey(objectApiName)) {
      return '';
    }

    Schema.DescribeSObjectResult parentDescribe = objectMap.get(objectApiName)
      .getDescribe(SObjectDescribeOptions.DEFERRED);
    Schema.ChildRelationship matchedRelationship;
    for (
      Schema.ChildRelationship childRelationship : parentDescribe.getChildRelationships()
    ) {
      if (childRelationship.getRelationshipName() == relationshipName) {
        matchedRelationship = childRelationship;
        break;
      }
    }

    if (matchedRelationship == null) {
      return '';
    }

    Schema.DescribeSObjectResult childDescribe = matchedRelationship.getChildSObject()
      .getDescribe(SObjectDescribeOptions.DEFERRED);
    Map<String, Schema.SObjectField> childFieldMap = childDescribe.fields.getMap();

    List<String> requestedColumns = new List<String>();
    for (String rawColumn : columnCsv.split(',')) {
      String column = rawColumn == null ? '' : rawColumn.trim();
      if (String.isBlank(column) || !childFieldMap.containsKey(column)) {
        continue;
      }
      Schema.DescribeFieldResult fieldDescribe = childFieldMap.get(column)
        .getDescribe();
      if (!fieldDescribe.isAccessible()) {
        continue;
      }
      requestedColumns.add(column);
    }

    if (requestedColumns.isEmpty()) {
      return '';
    }

    Boolean childHasCurrencyIsoCode =
      childFieldMap.containsKey('CurrencyIsoCode') &&
      childFieldMap.get('CurrencyIsoCode').getDescribe().isAccessible();
    List<String> queryColumns = new List<String>(requestedColumns);
    if (childHasCurrencyIsoCode && !queryColumns.contains('CurrencyIsoCode')) {
      queryColumns.add('CurrencyIsoCode');
    }

    String parentFieldName = matchedRelationship.getField()
      .getDescribe()
      .getName();
    String query =
      'SELECT ' +
      String.join(queryColumns, ',') +
      ' FROM ' +
      childDescribe.getName() +
      ' WHERE ' +
      parentFieldName +
      ' = :recordId' +
      ' ORDER BY Id ASC';
    List<SObject> rows = Database.queryWithBinds(
      query,
      new Map<String, Object>{ 'recordId' => recordId },
      AccessLevel.USER_MODE
    );

    String normalizedOddColor = normalizePdfColorLiteral(oddColor, '#ffffff');
    String normalizedEvenColor = normalizePdfColorLiteral(evenColor, '#ffffff');
    String normalizedHeaderColor = normalizePdfColorLiteral(
      headerColor,
      '#e5e7eb'
    );
    String normalizedTextColor = normalizePdfColorLiteral(textColor, '#181818');
    String normalizedOddTextColor = normalizePdfColorLiteral(
      oddTextColor,
      normalizedTextColor
    );
    String normalizedEvenTextColor = normalizePdfColorLiteral(
      evenTextColor,
      normalizedTextColor
    );
    Integer normalizedFontSize = fontSize == null
      ? 12
      : Math.max(8, Math.min(36, fontSize));
    String renderedFontSize = applyPdfFontScale == false
      ? String.valueOf(normalizedFontSize) + 'px'
      : getPdfFontSizeCss(normalizedFontSize);
    Integer renderedCellPadding = applyPdfFontScale == false
      ? Math.max(0, Math.min(32, cellPadding == null ? 8 : cellPadding))
      : 6;
    String cellPaddingStyle = 'padding:' + renderedCellPadding + 'px;';
    String oddBodyTextColor = normalizedOddTextColor;
    String evenBodyTextColor = normalizedEvenTextColor;
    if (isLightColor(oddBodyTextColor) && isLightColor(normalizedOddColor)) {
      oddBodyTextColor = '#181818';
    }
    if (isLightColor(evenBodyTextColor) && isLightColor(normalizedEvenColor)) {
      evenBodyTextColor = '#181818';
    }
    String tableHtml =
      '<table border="0" cellpadding="' +
      renderedCellPadding +
      '" cellspacing="0" width="100%" style="width:100%;border-collapse:separate;border-spacing:0;">';
    tableHtml += '<thead><tr style="page-break-inside:avoid;">';
    for (
      Integer columnIndex = 0;
      columnIndex < requestedColumns.size();
      columnIndex += 1
    ) {
      String column = requestedColumns[columnIndex];
      String headerLabel = childFieldMap.get(column).getDescribe().getLabel();
      String headerCellStyle =
        getRelatedListCellBorderStyle(borderMode, true, columnIndex == 0) +
        cellPaddingStyle +
        'color:' +
        escapeHtml(normalizedTextColor) +
        ';font-size:' +
        renderedFontSize +
        ';background-color:' +
        escapeHtml(normalizedHeaderColor) +
        ' !important;';
      tableHtml +=
        '<th bgcolor="' +
        escapeHtml(normalizedHeaderColor) +
        '" style="text-align:center;' +
        headerCellStyle +
        '">' +
        escapeHtml(headerLabel) +
        '</th>';
    }
    tableHtml += '</tr></thead><tbody>';

    Integer index = 0;
    for (SObject row : rows) {
      String rowCurrencyIsoCode = childHasCurrencyIsoCode
        ? String.valueOf(row.get('CurrencyIsoCode'))
        : '';
      String rowColor = '#ffffff';
      if (zebraEnabled) {
        rowColor = Math.mod(index, 2) == 0
          ? normalizedOddColor
          : normalizedEvenColor;
      }

      tableHtml += '<tr style="page-break-inside:avoid;">';
      for (
        Integer columnIndex = 0;
        columnIndex < requestedColumns.size();
        columnIndex += 1
      ) {
        String column = requestedColumns[columnIndex];
        String rowBaseStyle = Math.mod(index, 2) == 0
          ? 'color:' +
            escapeHtml(oddBodyTextColor) +
            ';font-size:' +
            renderedFontSize +
            ';'
          : 'color:' +
            escapeHtml(evenBodyTextColor) +
            ';font-size:' +
            renderedFontSize +
            ';';
        String rowCellStyle =
          getRelatedListCellBorderStyle(borderMode, false, columnIndex == 0) +
          cellPaddingStyle +
          rowBaseStyle +
          'background-color:' +
          escapeHtml(rowColor) +
          ' !important;';
        Object value = row.get(column);
        Schema.DescribeFieldResult fieldDescribe = childFieldMap.get(column)
          .getDescribe();
        Schema.DisplayType fieldType = fieldDescribe.getType();
        String valueTextAlign = 'left';
        if (fieldType == Schema.DisplayType.Currency) {
          valueTextAlign = 'right';
        } else if (
          fieldType == Schema.DisplayType.Double ||
          fieldType == Schema.DisplayType.Percent ||
          fieldType == Schema.DisplayType.Integer ||
          fieldType == Schema.DisplayType.Long
        ) {
          valueTextAlign = 'center';
        }
        rowCellStyle += 'text-align:' + valueTextAlign + ';';
        tableHtml +=
          '<td bgcolor="' +
          escapeHtml(rowColor) +
          '" style="' +
          rowCellStyle +
          '">' +
          escapeHtml(
            formatMergeFieldValue(
              value,
              fieldDescribe,
              rowCurrencyIsoCode,
              column
            )
          ) +
          '</td>';
      }
      tableHtml += '</tr>';
      index += 1;
    }

    if (rows.isEmpty()) {
      String emptyStyle =
        getRelatedListCellBorderStyle(borderMode, false, true) +
        cellPaddingStyle +
        'font-size:' +
        renderedFontSize +
        ';color:#706e6b;text-align:left;';
      tableHtml +=
        '<tr style="page-break-inside:avoid;"><td colspan="' +
        requestedColumns.size() +
        '" style="' +
        emptyStyle +
        '">No records</td></tr>';
    }

    tableHtml += '</tbody></table>';
    return tableHtml;
  }

  private static String getRelatedListCellBorderStyle(
    String borderMode,
    Boolean isFirstRow,
    Boolean isFirstColumn
  ) {
    String normalized = String.isBlank(borderMode)
      ? 'all'
      : borderMode.trim().toLowerCase();

    if (normalized == 'none') {
      return 'border:none;';
    }
    if (normalized == 'horizontal') {
      String top = isFirstRow ? '1px solid #c9c9c9' : 'none';
      return 'border-top:' +
        top +
        ';border-bottom:1px solid #c9c9c9;border-left:none;border-right:none;';
    }
    if (normalized == 'vertical') {
      String left = isFirstColumn ? '1px solid #c9c9c9' : 'none';
      return 'border-left:' +
        left +
        ';border-right:1px solid #c9c9c9;border-top:none;border-bottom:none;';
    }

    String top = isFirstRow ? '1px solid #c9c9c9' : 'none';
    String left = isFirstColumn ? '1px solid #c9c9c9' : 'none';
    return 'border-top:' +
      top +
      ';border-right:1px solid #c9c9c9;border-bottom:1px solid #c9c9c9;border-left:' +
      left +
      ';';
  }

  private static Boolean isLightColor(String colorValue) {
    if (String.isBlank(colorValue)) {
      return false;
    }

    String color = colorValue.trim().toLowerCase();
    if (color == 'white' || color == '#fff' || color == '#ffffff') {
      return true;
    }
    if (color == 'black' || color == '#000' || color == '#000000') {
      return false;
    }

    if (color.startsWith('#')) {
      String hex = color.substring(1);
      if (hex.length() == 3) {
        hex =
          hex.substring(0, 1) +
          hex.substring(0, 1) +
          hex.substring(1, 2) +
          hex.substring(1, 2) +
          hex.substring(2, 3) +
          hex.substring(2, 3);
      }
      if (hex.length() == 6) {
        Integer red = parseHexByte(hex.substring(0, 2));
        Integer green = parseHexByte(hex.substring(2, 4));
        Integer blue = parseHexByte(hex.substring(4, 6));
        Decimal luminance =
          (Decimal.valueOf(red * 299 + green * 587 + blue * 114)) / 1000;
        return luminance >= 186;
      }
    }

    Matcher rgbMatcher = Pattern.compile(
        '(?i)rgb\\s*\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*\\)'
      )
      .matcher(color);
    if (rgbMatcher.find()) {
      Integer red = clampColorChannel(rgbMatcher.group(1));
      Integer green = clampColorChannel(rgbMatcher.group(2));
      Integer blue = clampColorChannel(rgbMatcher.group(3));
      Decimal luminance =
        (Decimal.valueOf(red * 299 + green * 587 + blue * 114)) / 1000;
      return luminance >= 186;
    }

    return false;
  }

  private static Integer parseHexByte(String hexPair) {
    if (String.isBlank(hexPair) || hexPair.length() != 2) {
      return 0;
    }

    String digits = '0123456789abcdef';
    String normalized = hexPair.toLowerCase();
    Integer high = digits.indexOf(normalized.substring(0, 1));
    Integer low = digits.indexOf(normalized.substring(1, 2));
    if (high < 0 || low < 0) {
      return 0;
    }
    return (high * 16) + low;
  }

  private static String normalizePdfColorLiteral(
    String colorValue,
    String defaultHex
  ) {
    if (String.isBlank(colorValue)) {
      return defaultHex;
    }

    String color = colorValue.trim().toLowerCase();
    if (color == 'white') {
      return '#ffffff';
    }
    if (color == 'black') {
      return '#000000';
    }
    if (color == 'transparent') {
      return defaultHex;
    }

    if (color.startsWith('#')) {
      if (color.length() == 4) {
        return '#' +
          color.substring(1, 2) +
          color.substring(1, 2) +
          color.substring(2, 3) +
          color.substring(2, 3) +
          color.substring(3, 4) +
          color.substring(3, 4);
      }
      if (color.length() == 7) {
        return color;
      }
      return defaultHex;
    }

    Matcher rgbaMatcher = Pattern.compile(
        '(?i)rgba?\\s*\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})(?:\\s*,\\s*[\\d\\.]+)?\\s*\\)'
      )
      .matcher(color);
    if (rgbaMatcher.find()) {
      Integer red = clampColorChannel(rgbaMatcher.group(1));
      Integer green = clampColorChannel(rgbaMatcher.group(2));
      Integer blue = clampColorChannel(rgbaMatcher.group(3));
      return '#' + toHexByte(red) + toHexByte(green) + toHexByte(blue);
    }

    return defaultHex;
  }

  private static List<String> getPdfBlockDeclarations(
    Map<String, Object> styles
  ) {
    List<String> declarations = new List<String>();
    addDeclaration(
      declarations,
      'background-color',
      getStyleValue(styles, 'background')
    );
    addDeclaration(declarations, 'padding', getStyleValue(styles, 'padding'));
    addDeclaration(
      declarations,
      'width',
      getPdfConstrainedWidth(getStyleValue(styles, 'width'))
    );
    addDeclaration(declarations, 'height', getStyleValue(styles, 'height'));
    addDeclaration(declarations, 'text-align', getPdfTextAlign(styles));
    addDeclaration(
      declarations,
      'border-radius',
      normalizeCssLength(getStyleValue(styles, 'borderRadius'))
    );
    declarations.add('overflow:hidden');

    if (isStyleEnabled(styles, 'borderEnabled')) {
      String borderWidth = getStyleValue(styles, 'borderWidth');
      String borderColor = getStyleValue(styles, 'borderColor');
      declarations.add(
        'border:' +
          (String.isBlank(borderWidth) ? '1px' : borderWidth) +
          ' solid ' +
          (String.isBlank(borderColor) ? '#9ca3af' : borderColor)
      );
    }

    return declarations;
  }

  private static void addDeclaration(
    List<String> declarations,
    String name,
    String value
  ) {
    if (!String.isBlank(value) && value != 'auto') {
      declarations.add(name + ':' + value);
    }
  }

  private static String getStyleValue(Map<String, Object> styles, String key) {
    Object value = styles.get(key);
    return value == null ? '' : String.valueOf(value);
  }

  private static Integer getConstrainedIntegerStyle(
    Map<String, Object> styles,
    String key,
    Integer defaultValue,
    Integer minValue,
    Integer maxValue
  ) {
    String value = getStyleValue(styles, key);

    if (String.isBlank(value) || value == 'auto') {
      return defaultValue;
    }

    try {
      Integer numericValue = Integer.valueOf(value);
      return Math.min(maxValue, Math.max(minValue, numericValue));
    } catch (Exception error) {
      return defaultValue;
    }
  }

  private static String formatPdfDecimal(Decimal value) {
    return String.valueOf(value.setScale(2));
  }

  private static String getPdfTextAlign(Map<String, Object> styles) {
    String horizontalAlign = getStyleValue(styles, 'horizontalAlign');

    if (!String.isBlank(horizontalAlign)) {
      return horizontalAlign;
    }

    return getStyleValue(styles, 'textAlign');
  }

  private static String getPdfConstrainedWidth(String value) {
    if (String.isBlank(value) || value == 'auto') {
      return '100%';
    }

    if (!value.endsWith('px')) {
      return value;
    }

    String numericPart = value.replace('px', '');

    try {
      Decimal numericValue = Decimal.valueOf(numericPart);

      if (numericValue > SETTINGS.pdfContentWidth) {
        return '100%';
      }
    } catch (Exception error) {
      return value;
    }

    return value;
  }

  private static String getPdfDimensionAttribute(
    String name,
    String value,
    String defaultValue
  ) {
    String normalizedValue = String.isBlank(value) || value == 'auto'
      ? defaultValue
      : value;

    if (String.isBlank(normalizedValue)) {
      return '';
    }

    if (name == 'width') {
      normalizedValue = getPdfConstrainedWidth(normalizedValue);
    }

    if (normalizedValue.endsWith('px')) {
      normalizedValue = normalizedValue.replace('px', '');
    }

    return ' ' + name + '="' + escapeHtml(normalizedValue) + '"';
  }

  private static Decimal getDecimalStyleValue(
    Map<String, Object> styles,
    String key
  ) {
    String value = getStyleValue(styles, key);

    if (String.isBlank(value)) {
      return null;
    }

    String normalized = value.trim();
    Boolean isPercent = normalized.endsWith('%');

    if (isPercent) {
      normalized = normalized.substring(0, normalized.length() - 1);
    }

    try {
      Decimal parsed = Decimal.valueOf(normalized);

      if (isPercent) {
        parsed = parsed / 100;
      }

      if (parsed < 0) {
        return null;
      }

      return parsed;
    } catch (Exception ignored) {
      return null;
    }
  }

  private static Boolean isStyleEnabled(
    Map<String, Object> styles,
    String key
  ) {
    return getStyleValue(styles, key) == 'true';
  }

  private static String escapeHtmlForPdfContent(String value) {
    return escapeHtml(value).replace('\n', '<br />');
  }

  private static String normalizeEditableTextContent(String value) {
    if (String.isBlank(value)) {
      return '';
    }

    String normalized = value;
    // Convert raw/editor-injected BR tags to new lines before escaping.
    normalized = normalized.replaceAll('(?i)<br\\b[^>]*>', '\n');
    // Flatten common block wrappers from contenteditable payloads.
    normalized = normalized.replaceAll('(?i)</(p|div|li)>', '\n');
    normalized = normalized.replaceAll('(?i)<(p|div|li)\\b[^>]*>', '');
    normalized = normalized.replaceAll('<[^>]+>', '');
    normalized = normalized.replace('&nbsp;', ' ');
    normalized = normalized.replace('&amp;', '&');
    normalized = normalized.replace('&lt;', '<');
    normalized = normalized.replace('&gt;', '>');
    normalized = normalized.replace('&quot;', '"');
    normalized = normalized.replace('&#039;', '\'');

    return normalized.trim();
  }

  @TestVisible
  private static String renderRichTextContentForPdf(String value) {
    if (String.isBlank(value)) {
      return '';
    }

    String candidate = sanitizeLwcRuntimeArtifacts(value);
    candidate = normalizeInlineFlexLayoutsForPdf(candidate);
    candidate = normalizeLegacyFontColorTagsForPdf(candidate);
    candidate = scaleInlineFontSizesForPdf(candidate);
    candidate = normalizeInlineLineHeightsForPdf(candidate);
    candidate = normalizeInlineRgbColorsForPdf(candidate);
    candidate = removeDefaultInlineEditorColorForPdf(candidate);
    candidate = forceInlineColorPriorityForPdf(candidate);
    candidate = removeInterBlockWhitespaceForPdf(candidate);
    // Defensive clean-up: remove script/style tags and inline event handlers.
    candidate = candidate.replaceAll('(?is)<script[^>]*>.*?</script>', '');
    candidate = candidate.replaceAll('(?is)<style[^>]*>.*?</style>', '');
    candidate = candidate.replaceAll('(?i)\\s+on[a-z]+\\s*=\\s*"[^"]*"', '');
    candidate = candidate.replaceAll('(?i)\\s+on[a-z]+\\s*=\\s*\'[^\']*\'', '');

    // If rich HTML exists, keep it so PDF preserves formatting.
    if (Pattern.compile('(?i)<[a-z][\\s\\S]*>').matcher(candidate).find()) {
      return candidate;
    }

    return escapeHtmlForPdfContent(normalizeEditableTextContent(value));
  }

  /**
   * @description Converts supported two-column flex rows to table markup for
   * the Visualforce PDF engine.
   * @param html Rich-text HTML produced by the builder.
   * @return PDF-compatible rich-text HTML.
   *
   * Flying Saucer does not implement flexbox. The builder commonly uses a
   * two-child flex row for labels and right-aligned values; when flex is
   * ignored, the second child drops below the first and is clipped by the
   * component's fixed height. Convert that small, well-defined structure to
   * an equivalent table row, which is supported by the Visualforce renderer.
   */
  private static String normalizeInlineFlexLayoutsForPdf(String html) {
    if (String.isBlank(html) || !html.toLowerCase().contains('display:flex')) {
      return html;
    }

    String normalized = html;
    Pattern twoColumnFlex = Pattern.compile(
      '(?is)<div[^>]*style="[^"]*display\\s*:\\s*flex[^"]*"[^>]*>\\s*' +
        '<div([^>]*)>(.*?)</div>\\s*' +
        '<div([^>]*)>(.*?)</div>\\s*</div>'
    );

    // A rich-text block may contain more than one independent flex row.
    // Re-run the replacement until no supported two-column row remains.
    while (true) {
      String replaced = twoColumnFlex.matcher(normalized)
        .replaceAll(
          '<table border="0" cellpadding="0" cellspacing="0" ' +
            'style="width:100%;border-collapse:collapse;table-layout:fixed;">' +
            '<tr><td valign="middle"$1>$2</td>' +
            '<td valign="middle"$3>$4</td></tr></table>'
        );
      if (replaced == normalized) {
        break;
      }
      normalized = replaced;
    }
    return normalized;
  }

  private static String normalizeInlineLineHeightsForPdf(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    /*
     * The browser accepts unitless line-height values, but Salesforce's
     * Flying Saucer PDF renderer does not apply them consistently. A
     * percentage has the same CSS meaning and is reliably inherited by
     * the text inside only the paragraph carrying the inline declaration.
     */
    Matcher matcher = Pattern.compile(
        '(?i)line-height\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)(\\s*)(;|")'
      )
      .matcher(html);
    String normalizedHtml = '';
    Integer previousEnd = 0;

    while (matcher.find()) {
      normalizedHtml += html.substring(previousEnd, matcher.start());

      Decimal multiplier;
      try {
        multiplier = Decimal.valueOf(matcher.group(1));
      } catch (Exception ignored) {
        multiplier = 1.25;
      }

      multiplier = Math.max(0.25, Math.min(3, multiplier));
      Decimal percentage = multiplier * 100;
      normalizedHtml +=
        'line-height:' +
        String.valueOf(percentage.setScale(0, System.RoundingMode.HALF_UP)) +
        '%' +
        matcher.group(2) +
        matcher.group(3);
      previousEnd = matcher.end();
    }

    return previousEnd == 0
      ? html
      : normalizedHtml + html.substring(previousEnd);
  }

  private static String removeInterBlockWhitespaceForPdf(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    /*
     * Rich-text containers use pre-wrap so plain text newlines survive.
     * Flying Saucer also turns formatting whitespace between block tags
     * into anonymous line boxes, unlike the browser editor. Remove only
     * that inter-tag whitespace; text inside paragraphs is untouched.
     */
    String normalized = html.replaceAll(
      '(?i)</(p|div|ul|ol|li|h[1-6])>\\s+<',
      '</$1><'
    );
    normalized = normalized.replaceAll(
      '(?i)<(p|div|ul|ol|h[1-6])([^>]*)>\\s+<',
      '<$1$2><'
    );
    return normalized;
  }

  private static String scaleInlineFontSizesForPdf(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    Matcher matcher = Pattern.compile(
        '(?i)font-size\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)px'
      )
      .matcher(html);
    String scaledHtml = '';
    Integer previousEnd = 0;

    while (matcher.find()) {
      scaledHtml += html.substring(previousEnd, matcher.start());

      Decimal sourceSize;
      try {
        sourceSize = Decimal.valueOf(matcher.group(1));
      } catch (Exception ignored) {
        sourceSize = 14;
      }

      Decimal scaledSize = sourceSize * SETTINGS.pdfFontScale;
      scaledHtml +=
        'font-size:' +
        String.valueOf(scaledSize.setScale(2, System.RoundingMode.HALF_UP)) +
        'px';
      previousEnd = matcher.end();
    }

    return previousEnd == 0 ? html : scaledHtml + html.substring(previousEnd);
  }

  private static String sanitizeLwcRuntimeArtifacts(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    String sanitized = html;
    // Remove synthetic-shadow/lwc runtime attributes.
    sanitized = sanitized.replaceAll('\\s+lwc-[A-Za-z0-9_-]+="[^"]*"', '');
    sanitized = sanitized.replaceAll('\\s+data-key="[^"]*"', '');
    sanitized = sanitized.replaceAll('\\s+data-id="[^"]*"', '');
    sanitized = sanitized.replaceAll('\\s+data-region-id="[^"]*"', '');
    sanitized = sanitized.replaceAll('\\s+contenteditable="[^"]*"', '');
    // Decode accidental escaped <br ...> fragments left by editor sync.
    sanitized = sanitized.replaceAll('(?i)&lt;br\\b[^&]*&gt;', '<br />');
    return sanitized;
  }

  private static String normalizeLegacyFontColorTagsForPdf(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    String normalized = html;
    // `execCommand('foreColor')` commonly produces <font color="...">.
    // Visualforce PDF is inconsistent with legacy FONT tags, so convert to span.
    normalized = normalized.replaceAll(
      '(?i)<font\\b[^>]*\\bcolor\\s*=\\s*"([^"]+)"[^>]*>',
      '<span style="color:$1;">'
    );
    normalized = normalized.replaceAll(
      '(?i)<font\\b[^>]*\\bcolor\\s*=\\s*([^\\s>]+)[^>]*>',
      '<span style="color:$1;">'
    );
    normalized = normalized.replaceAll('(?i)</font>', '</span>');
    return normalized;
  }

  private static String normalizeInlineRgbColorsForPdf(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    String normalized = html;
    Pattern rgbPattern = Pattern.compile(
      '(?i)rgb\\s*\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*\\)'
    );
    Matcher matcher = rgbPattern.matcher(normalized);
    Set<String> processedTokens = new Set<String>();

    while (matcher.find()) {
      String token = matcher.group(0);
      if (processedTokens.contains(token)) {
        continue;
      }
      processedTokens.add(token);

      Integer red = clampColorChannel(matcher.group(1));
      Integer green = clampColorChannel(matcher.group(2));
      Integer blue = clampColorChannel(matcher.group(3));
      String hexColor =
        '#' +
        toHexByte(red) +
        toHexByte(green) +
        toHexByte(blue);
      normalized = normalized.replace(token, hexColor);
    }

    return normalized;
  }

  private static String removeDefaultInlineEditorColorForPdf(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    String normalized = html;
    // The editor often injects its default dark text color inline. In PDF that
    // wins over the block/container color, so remove only that specific default.
    normalized = normalized.replaceAll(
      '(?i)color\\s*:\\s*(?:#181818|#080707|#000000|#000|black|rgb\\s*\\(\\s*24\\s*,\\s*24\\s*,\\s*24\\s*\\)|rgb\\s*\\(\\s*8\\s*,\\s*7\\s*,\\s*7\\s*\\)|rgb\\s*\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*\\))\\s*;?',
      ''
    );
    normalized = normalized.replaceAll(
      '(?i)<font\\b([^>]*)\\bcolor\\s*=\\s*"(#181818|#080707|#000000|#000|black|rgb\\s*\\(\\s*24\\s*,\\s*24\\s*,\\s*24\\s*\\)|rgb\\s*\\(\\s*8\\s*,\\s*7\\s*,\\s*7\\s*\\)|rgb\\s*\\(\\s*0\\s*,\\s*0\\s*,\\s*0\\s*\\))"([^>]*)>',
      '<font$1$3>'
    );
    normalized = normalized.replaceAll('(?i)style\\s*=\\s*"\\s*"', '');
    normalized = normalized.replaceAll('(?i)style\\s*=\\s*"\\s*;+', 'style="');
    normalized = normalized.replaceAll('(?i);\\s*"', '"');

    return normalized;
  }

  private static String forceInlineColorPriorityForPdf(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    String normalized = html;
    // Force inline color declarations to survive Visualforce PDF defaults.
    normalized = normalized.replaceAll(
      '(?i)color\\s*:\\s*([^;\"]+)\\s*;',
      'color:$1 !important;'
    );
    normalized = normalized.replaceAll(
      '(?i)color\\s*:\\s*([^;\"]+)(\\s*[\"])',
      'color:$1 !important$2'
    );
    return normalized;
  }

  private static Integer clampColorChannel(String value) {
    try {
      Integer parsed = Integer.valueOf(value);
      return Math.max(0, Math.min(255, parsed));
    } catch (Exception ignored) {
      return 0;
    }
  }

  private static String toHexByte(Integer value) {
    final String digits = '0123456789ABCDEF';
    Integer safe = Math.max(0, Math.min(255, value));
    Integer high = Integer.valueOf(Math.floor(safe / 16));
    Integer low = Math.mod(safe, 16);
    return digits.substring(high, high + 1) + digits.substring(low, low + 1);
  }

  private static String stripHtmlToText(String html) {
    if (String.isBlank(html)) {
      return '';
    }

    String text = html;
    text = text.replaceAll('(?i)<br\\s*/?>', '\n');
    text = text.replaceAll('(?i)</p>', '\n');
    text = text.replaceAll('(?i)</tr>', '\n');
    text = text.replaceAll('(?i)</td>', ' ');
    text = text.replaceAll('<[^>]+>', '');
    text = text.replace('&nbsp;', ' ');
    text = text.replace('&amp;', '&');
    text = text.replace('&lt;', '<');
    text = text.replace('&gt;', '>');
    text = text.replace('&quot;', '"');
    text = text.replace('&#039;', '\'');
    return escapeHtml(text.trim()).replace('\n', '<br />');
  }

  private static Boolean isPdfSupportedImageSrc(String src) {
    if (String.isBlank(src)) {
      return false;
    }

    String normalizedSrc = src.toLowerCase();

    return normalizedSrc.startsWith('https://') ||
      normalizedSrc.startsWith('http://') ||
      normalizedSrc.startsWith('/sfc/') ||
      normalizedSrc.startsWith('/resource/');
  }

  private static String normalizePdfImageUrl(String value) {
    if (String.isBlank(value)) {
      return value;
    }

    value = value.replace('&amp;', '&');
    return value;
  }

  private static String getPdfImageSourceForPdf(String value) {
    if (String.isBlank(value) || value.startsWith('/resource/')) {
      return value;
    }

    String versionId = extractContentVersionId(value);

    if (String.isBlank(versionId)) {
      return value;
    }

    try {
      return getContentDistributionUrl((Id) versionId);
    } catch (Exception error) {
      return value;
    }
  }

  private static void ensureContentDistributionsForHtml(String html) {
    Set<Id> versionIds = extractContentVersionIdsFromHtml(html);
    PDFBuilderFileService.ensureDistributions(versionIds);
  }

  private static Set<Id> extractContentVersionIdsFromHtml(String html) {
    Set<Id> versionIds = new Set<Id>();

    if (String.isBlank(html)) {
      return versionIds;
    }

    Pattern imagePattern = Pattern.compile(
      '(?i)<img\\s+[^>]*src="([^"]*)"[^>]*>'
    );
    Matcher imageMatcher = imagePattern.matcher(html);

    while (imageMatcher.find()) {
      String versionId = extractContentVersionId(
        normalizePdfImageUrl(imageMatcher.group(1))
      );

      if (!String.isBlank(versionId)) {
        versionIds.add((Id) versionId);
      }
    }

    return versionIds;
  }

  private static String extractContentVersionId(String value) {
    if (String.isBlank(value)) {
      return '';
    }

    value = value.replace('&amp;', '&');

    String versionId = extractQueryParameter(value, 'versionId');
    if (!String.isBlank(versionId) && versionId.startsWith('068')) {
      return versionId;
    }

    versionId = extractQueryParameter(value, 'ids');
    if (!String.isBlank(versionId) && versionId.startsWith('068')) {
      return versionId;
    }

    Pattern downloadPattern = Pattern.compile(
      '/sfc/servlet\\.shepherd/version/download/(068[A-Za-z0-9]{12,15})'
    );
    Matcher downloadMatcher = downloadPattern.matcher(value);

    if (downloadMatcher.find()) {
      return downloadMatcher.group(1);
    }

    return '';
  }

  private static String extractQueryParameter(
    String urlValue,
    String parameterName
  ) {
    if (String.isBlank(urlValue) || String.isBlank(parameterName)) {
      return '';
    }

    String marker = parameterName + '=';
    Integer markerIndex = urlValue.indexOf(marker);

    if (markerIndex < 0) {
      return '';
    }

    Integer valueStart = markerIndex + marker.length();
    Integer valueEnd = urlValue.indexOf('&', valueStart);

    if (valueEnd < 0) {
      valueEnd = urlValue.length();
    }

    return urlValue.substring(valueStart, valueEnd);
  }

  private static String resolveStoredImageUrl(String value) {
    if (String.isBlank(value) || getImageSourceType(value) != 'unknown') {
      return value;
    }

    List<ContentVersion> versions = [
      SELECT Id
      FROM ContentVersion
      WHERE Title = :value OR PathOnClient = :value
      ORDER BY CreatedDate DESC
      LIMIT 1
    ];

    if (versions.isEmpty()) {
      return value;
    }

    return getContentVersionDownloadPath(versions[0].Id);
  }

  private static String getContentVersionDownloadPath(Id contentVersionId) {
    return '/sfc/servlet.shepherd/version/download/' +
      String.valueOf(contentVersionId);
  }

  private static String getContentDistributionUrl(Id contentVersionId) {
    if (contentVersionId == null) {
      return '';
    }
    String distributionUrl = PDFBuilderFileService.getDistributionUrl(
      contentVersionId,
      allowContentDistributionDml
    );
    return String.isBlank(distributionUrl) && !allowContentDistributionDml
      ? getContentVersionDownloadPath(contentVersionId)
      : distributionUrl;
  }

  private static String getImageSourceType(String value) {
    if (String.isBlank(value)) {
      return 'empty';
    }

    String normalizedValue = value.toLowerCase();

    if (normalizedValue.startsWith('data:image/')) {
      return 'data-url';
    }

    if (
      normalizedValue.startsWith('http://') ||
      normalizedValue.startsWith('https://')
    ) {
      return 'absolute-url';
    }

    if (normalizedValue.startsWith('/')) {
      return 'relative-url';
    }

    return 'unknown';
  }

  private static String getImageExtension(String contentType) {
    if (contentType == 'image/jpeg' || contentType == 'image/jpg') {
      return '.jpg';
    }

    if (contentType == 'image/gif') {
      return '.gif';
    }

    return '.png';
  }

  private static String ensureImageFileExtension(
    String fileName,
    String contentType
  ) {
    String expectedExtension = getImageExtension(contentType);
    String lowerFileName = fileName.toLowerCase();
    Boolean hasCompatibleExtension =
      lowerFileName.endsWith(expectedExtension) ||
      (expectedExtension == '.jpg' && lowerFileName.endsWith('.jpeg'));

    if (hasCompatibleExtension) {
      return fileName;
    }

    Integer extensionIndex = fileName.lastIndexOf('.');
    String fileNameWithoutExtension = extensionIndex > 0
      ? fileName.substring(0, extensionIndex)
      : fileName;

    return fileNameWithoutExtension + expectedExtension;
  }

  private static String sanitizeFileName(String value) {
    if (String.isBlank(value)) {
      return 'document';
    }

    return value.replaceAll('[^A-Za-z0-9_.-]+', '_');
  }
}
