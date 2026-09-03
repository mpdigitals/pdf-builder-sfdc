/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Centralizes persistence for PDF Builder templates.
 */
public with sharing class PDFBuilderTemplateRepository {
  /**
   * Returns the most recently modified templates.
   *
   * @param queryLimit Maximum number of templates to return.
   * @return Templates ordered by modification date descending.
   */
  public static List<PDFBuilderTemplate__c> getRecent(Integer queryLimit) {
    return [
      SELECT Id, Name, ObjectApiName__c, RecordTypeScope__c, IsDefault__c
      FROM PDFBuilderTemplate__c
      WITH USER_MODE
      ORDER BY LastModifiedDate DESC
      LIMIT :queryLimit
    ];
  }

  /**
   * Returns templates associated with a Salesforce object.
   *
   * @param objectApiName Associated object API name.
   * @param queryLimit Maximum number of templates to return.
   * @return Templates ordered by name.
   */
  public static List<PDFBuilderTemplate__c> getForObject(
    String objectApiName,
    Integer queryLimit
  ) {
    return [
      SELECT Id, Name, ObjectApiName__c, RecordTypeScope__c, IsDefault__c
      FROM PDFBuilderTemplate__c
      WHERE ObjectApiName__c = :objectApiName
      WITH USER_MODE
      ORDER BY Name ASC
      LIMIT :queryLimit
    ];
  }

  /**
   * Returns templates available to a record type scope.
   *
   * @param objectApiName Associated object API name.
   * @param recordTypeScopes All scopes available to the current record.
   * @param queryLimit Maximum number of templates to return.
   * @return Matching templates ordered by name.
   */
  public static List<PDFBuilderTemplate__c> getForObjectAndScopes(
    String objectApiName,
    Set<String> recordTypeScopes,
    Integer queryLimit
  ) {
    return [
      SELECT Id, Name, ObjectApiName__c, RecordTypeScope__c, IsDefault__c
      FROM PDFBuilderTemplate__c
      WHERE
        ObjectApiName__c = :objectApiName
        AND (RecordTypeScope__c IN :recordTypeScopes
        OR RecordTypeScope__c = NULL)
      WITH USER_MODE
      ORDER BY Name ASC
      LIMIT :queryLimit
    ];
  }

  /**
   * Returns the complete template required by rendering and editing flows.
   *
   * @param templateId Template identifier.
   * @return Matching template.
   */
  public static PDFBuilderTemplate__c getRequired(Id templateId) {
    return [
      SELECT
        Id,
        Name,
        ObjectApiName__c,
        ContentJson__c,
        GeneratedHtml__c,
        RecordTypeScope__c,
        IsDefault__c
      FROM PDFBuilderTemplate__c
      WHERE Id = :templateId
      WITH USER_MODE
      LIMIT 1
    ];
  }

  /**
   * Finds another default template with the same object and record type scope.
   *
   * @param objectApiName Associated object API name.
   * @param recordTypeScope Record type DeveloperName or ALL.
   * @param excludedTemplateId Template being updated, if any.
   * @return Existing default template or null.
   */
  public static PDFBuilderTemplate__c findDefaultForScope(
    String objectApiName,
    String recordTypeScope,
    Id excludedTemplateId
  ) {
    List<PDFBuilderTemplate__c> templates = excludedTemplateId == null
      ? [
          SELECT Id, Name
          FROM PDFBuilderTemplate__c
          WHERE
            ObjectApiName__c = :objectApiName
            AND RecordTypeScope__c = :recordTypeScope
            AND IsDefault__c = TRUE
          WITH USER_MODE
          LIMIT 1
        ]
      : [
          SELECT Id, Name
          FROM PDFBuilderTemplate__c
          WHERE
            ObjectApiName__c = :objectApiName
            AND RecordTypeScope__c = :recordTypeScope
            AND IsDefault__c = TRUE
            AND Id != :excludedTemplateId
          WITH USER_MODE
          LIMIT 1
        ];
    return templates.isEmpty() ? null : templates[0];
  }

  /**
   * Finds a template without throwing when it no longer exists.
   *
   * @param templateId Template identifier.
   * @return Matching template or null.
   */
  public static PDFBuilderTemplate__c findById(Id templateId) {
    List<PDFBuilderTemplate__c> templates = [
      SELECT Id
      FROM PDFBuilderTemplate__c
      WHERE Id = :templateId
      WITH USER_MODE
      LIMIT 1
    ];
    return templates.isEmpty() ? null : templates[0];
  }

  /**
   * Inserts or updates a template using the caller-provided identifier.
   *
   * @param template Template record to persist.
   */
  public static void save(PDFBuilderTemplate__c template) {
    if (template.Id == null) {
      insert as user template;
      return;
    }
    update as user template;
  }

  /**
   * Deletes an existing template.
   *
   * @param template Template record to delete.
   */
  public static void remove(PDFBuilderTemplate__c template) {
    delete as user template;
  }
}
