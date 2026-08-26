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
      SELECT Id, Name, ObjectApiName__c
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
      SELECT Id, Name, ObjectApiName__c
      FROM PDFBuilderTemplate__c
      WHERE ObjectApiName__c = :objectApiName
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
      SELECT Id, Name, ObjectApiName__c, ContentJson__c, GeneratedHtml__c
      FROM PDFBuilderTemplate__c
      WHERE Id = :templateId
      WITH USER_MODE
      LIMIT 1
    ];
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
