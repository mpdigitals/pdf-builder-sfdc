/**
 * @author mpdigitals
 * @date August 2026
 *
 * @description Provides reusable Salesforce object, field, and child relationship metadata.
 */
public inherited sharing class PDFBuilderDescribeService {
  private static final String INTERNAL_TEMPLATE_OBJECT_API_NAME = 'PDFBuilderTemplate__c';

  /**
   * Describes an object option shown by PDF Builder.
   *
   * @author mpdigitals
   */
  public class ObjectDescriptor implements Comparable {
    public String label;
    public String apiName;
    public Boolean custom;

    /**
     * Creates an object descriptor.
     *
     * @param label Object label.
     * @param apiName Object API name.
     * @param custom Whether the object is custom.
     */
    public ObjectDescriptor(String label, String apiName, Boolean custom) {
      this.label = label;
      this.apiName = apiName;
      this.custom = custom;
    }

    /**
     * Sorts descriptors by localized label.
     *
     * @param value Descriptor to compare.
     * @return Standard comparison result.
     */
    public Integer compareTo(Object value) {
      ObjectDescriptor other = (ObjectDescriptor) value;
      return label.toLowerCase().compareTo(other.label.toLowerCase());
    }
  }

  /**
   * Describes an accessible field option.
   *
   * @author mpdigitals
   */
  public class FieldDescriptor implements Comparable {
    public String label;
    public String apiName;
    public String dataType;

    /**
     * Creates a field descriptor.
     *
     * @param label Field label.
     * @param apiName Field API name or relationship path.
     * @param dataType Salesforce display type.
     */
    public FieldDescriptor(String label, String apiName, String dataType) {
      this.label = label;
      this.apiName = apiName;
      this.dataType = dataType;
    }

    /**
     * Sorts descriptors by localized label.
     *
     * @param value Descriptor to compare.
     * @return Standard comparison result.
     */
    public Integer compareTo(Object value) {
      FieldDescriptor other = (FieldDescriptor) value;
      return label.toLowerCase().compareTo(other.label.toLowerCase());
    }
  }

  /**
   * Describes an accessible child relationship option.
   *
   * @author mpdigitals
   */
  public class RelatedListDescriptor implements Comparable {
    public String label;
    public String relationshipName;
    public String childObjectApiName;

    /**
     * Creates a child relationship descriptor.
     *
     * @param label Related list label.
     * @param relationshipName Child relationship API name.
     * @param childObjectApiName Child object API name.
     */
    public RelatedListDescriptor(
      String label,
      String relationshipName,
      String childObjectApiName
    ) {
      this.label = label;
      this.relationshipName = relationshipName;
      this.childObjectApiName = childObjectApiName;
    }

    /**
     * Sorts descriptors by localized label.
     *
     * @param value Descriptor to compare.
     * @return Standard comparison result.
     */
    public Integer compareTo(Object value) {
      RelatedListDescriptor other = (RelatedListDescriptor) value;
      return label.toLowerCase().compareTo(other.label.toLowerCase());
    }
  }

  /**
   * Returns preferred objects followed by accessible custom objects.
   *
   * @param preferredObjectApiNames Ordered preferred object API names.
   * @return Available object descriptors.
   */
  public static List<ObjectDescriptor> getObjects(
    List<String> preferredObjectApiNames
  ) {
    return getObjects(preferredObjectApiNames, true);
  }

  /**
   * Returns preferred objects and optionally appends accessible custom objects.
   *
   * @param preferredObjectApiNames Ordered preferred object API names.
   * @param includeCustomObjects Whether custom objects can be returned.
   * @return Available object descriptors.
   */
  public static List<ObjectDescriptor> getObjects(
    List<String> preferredObjectApiNames,
    Boolean includeCustomObjects
  ) {
    Map<String, Schema.SObjectType> objectMap = Schema.getGlobalDescribe();
    List<ObjectDescriptor> preferred = new List<ObjectDescriptor>();
    List<ObjectDescriptor> customObjects = new List<ObjectDescriptor>();
    Boolean customObjectsEnabled = includeCustomObjects != false;

    for (String apiName : preferredObjectApiNames) {
      if (!isInternalObjectApiName(apiName) && objectMap.containsKey(apiName)) {
        Schema.DescribeSObjectResult describe = objectMap.get(apiName)
          .getDescribe(SObjectDescribeOptions.DEFERRED);
        if (isObjectAvailable(describe)) {
          preferred.add(
            new ObjectDescriptor(
              describe.getLabel(),
              apiName,
              describe.isCustom()
            )
          );
        }
      }
    }

    for (String apiName : objectMap.keySet()) {
      Schema.DescribeSObjectResult describe = objectMap.get(apiName)
        .getDescribe(SObjectDescribeOptions.DEFERRED);
      if (
        !customObjectsEnabled ||
        !describe.isCustom() ||
        apiName.endsWith('__mdt') ||
        isInternalObjectApiName(apiName) ||
        preferredObjectApiNames.contains(apiName) ||
        !isObjectAvailable(describe)
      ) {
        continue;
      }
      customObjects.add(
        new ObjectDescriptor(describe.getLabel(), apiName, true)
      );
    }

    customObjects.sort();
    preferred.addAll(customObjects);
    return preferred;
  }

  /**
   * Returns direct and first-level parent fields for an object.
   *
   * @param objectApiName Object API name.
   * @param searchTerm Optional label or API-name filter.
   * @return Accessible field descriptors.
   */
  public static List<FieldDescriptor> getFields(
    String objectApiName,
    String searchTerm
  ) {
    Schema.DescribeSObjectResult objectDescribe = getAvailableObjectDescribe(
      objectApiName
    );
    String normalizedSearch = normalizeSearchTerm(searchTerm);
    List<FieldDescriptor> fields = new List<FieldDescriptor>();
    Set<String> addedFieldPaths = new Set<String>();
    Map<String, Schema.SObjectField> baseFieldMap = objectDescribe.fields.getMap();

    for (String fieldApiName : baseFieldMap.keySet()) {
      Schema.DescribeFieldResult fieldDescribe = baseFieldMap.get(fieldApiName)
        .getDescribe();
      if (!fieldDescribe.isAccessible()) {
        continue;
      }

      String label = fieldDescribe.getLabel();
      if (!matchesSearch(normalizedSearch, fieldApiName, label)) {
        continue;
      }

      addedFieldPaths.add(fieldApiName);
      fields.add(
        new FieldDescriptor(
          label,
          fieldApiName,
          String.valueOf(fieldDescribe.getType())
        )
      );
    }

    addFirstLevelParentFields(
      fields,
      addedFieldPaths,
      baseFieldMap,
      normalizedSearch
    );
    fields.sort();
    return fields;
  }

  /**
   * Returns accessible child relationships for an object.
   *
   * @param objectApiName Parent object API name.
   * @return Child relationship descriptors.
   */
  public static List<RelatedListDescriptor> getRelatedLists(
    String objectApiName
  ) {
    Schema.DescribeSObjectResult parentDescribe = getAvailableObjectDescribe(
      objectApiName
    );
    List<RelatedListDescriptor> options = new List<RelatedListDescriptor>();

    for (
      Schema.ChildRelationship relationship : parentDescribe.getChildRelationships()
    ) {
      if (String.isBlank(relationship.getRelationshipName())) {
        continue;
      }

      Schema.DescribeSObjectResult childDescribe = relationship.getChildSObject()
        .getDescribe(SObjectDescribeOptions.DEFERRED);
      if (!isObjectAvailable(childDescribe)) {
        continue;
      }

      String label =
        childDescribe.getLabelPlural() +
        ' (' +
        relationship.getRelationshipName() +
        ')';
      options.add(
        new RelatedListDescriptor(
          label,
          relationship.getRelationshipName(),
          childDescribe.getName()
        )
      );
    }

    options.sort();
    return options;
  }

  /**
   * Returns direct accessible fields for a related-list child object.
   *
   * @param childObjectApiName Child object API name.
   * @param searchTerm Optional label or API-name filter.
   * @return Accessible field descriptors.
   */
  public static List<FieldDescriptor> getRelatedListFields(
    String childObjectApiName,
    String searchTerm
  ) {
    Schema.DescribeSObjectResult childDescribe = getAvailableObjectDescribe(
      childObjectApiName
    );
    String normalizedSearch = normalizeSearchTerm(searchTerm);
    List<FieldDescriptor> fields = new List<FieldDescriptor>();

    for (String fieldApiName : childDescribe.fields.getMap().keySet()) {
      Schema.DescribeFieldResult fieldDescribe = childDescribe.fields.getMap()
        .get(fieldApiName)
        .getDescribe();
      if (
        !fieldDescribe.isAccessible() ||
        !matchesSearch(normalizedSearch, fieldApiName, fieldDescribe.getLabel())
      ) {
        continue;
      }
      fields.add(
        new FieldDescriptor(
          fieldDescribe.getLabel(),
          fieldApiName,
          String.valueOf(fieldDescribe.getType())
        )
      );
    }

    fields.sort();
    return fields;
  }

  /**
   * Determines whether an object can be queried and rendered by the builder.
   *
   * @param describe Object describe result.
   * @return True when the object is accessible, queryable, and not deprecated.
   */
  public static Boolean isObjectAvailable(
    Schema.DescribeSObjectResult describe
  ) {
    return describe.isAccessible() &&
      describe.isQueryable() &&
      !describe.isDeprecatedAndHidden();
  }

  /**
   * Resolves and validates an object describe result.
   *
   * @param objectApiName Object API name.
   * @return Validated describe result.
   */
  private static Schema.DescribeSObjectResult getAvailableObjectDescribe(
    String objectApiName
  ) {
    Map<String, Schema.SObjectType> objectMap = Schema.getGlobalDescribe();
    if (!objectMap.containsKey(objectApiName)) {
      throw new AuraHandledException('Object not found: ' + objectApiName);
    }

    Schema.DescribeSObjectResult describe = objectMap.get(objectApiName)
      .getDescribe(SObjectDescribeOptions.DEFERRED);
    if (!isObjectAvailable(describe)) {
      throw new AuraHandledException('Object not available: ' + objectApiName);
    }
    return describe;
  }

  /**
   * Adds accessible fields from non-polymorphic first-level parent relationships.
   *
   * @param fields Destination descriptors.
   * @param addedFieldPaths Previously added paths.
   * @param baseFieldMap Base object fields.
   * @param normalizedSearch Normalized search term.
   */
  private static void addFirstLevelParentFields(
    List<FieldDescriptor> fields,
    Set<String> addedFieldPaths,
    Map<String, Schema.SObjectField> baseFieldMap,
    String normalizedSearch
  ) {
    for (String fieldApiName : baseFieldMap.keySet()) {
      Schema.DescribeFieldResult referenceField = baseFieldMap.get(fieldApiName)
        .getDescribe();
      if (
        referenceField.getType() != Schema.DisplayType.Reference ||
        String.isBlank(referenceField.getRelationshipName())
      ) {
        continue;
      }

      List<Schema.SObjectType> referenceTargets = referenceField.getReferenceTo();
      if (
        referenceTargets == null ||
        referenceTargets.isEmpty() ||
        referenceTargets.size() > 1
      ) {
        continue;
      }

      Schema.DescribeSObjectResult parentDescribe = referenceTargets[0]
        .getDescribe(SObjectDescribeOptions.DEFERRED);
      if (!isObjectAvailable(parentDescribe)) {
        continue;
      }

      addParentObjectFields(
        fields,
        addedFieldPaths,
        referenceField.getRelationshipName(),
        parentDescribe,
        normalizedSearch
      );
    }
  }

  /**
   * Adds accessible fields from a resolved parent object.
   *
   * @param fields Destination descriptors.
   * @param addedFieldPaths Previously added paths.
   * @param relationshipName Parent relationship name.
   * @param parentDescribe Parent object describe result.
   * @param normalizedSearch Normalized search term.
   */
  private static void addParentObjectFields(
    List<FieldDescriptor> fields,
    Set<String> addedFieldPaths,
    String relationshipName,
    Schema.DescribeSObjectResult parentDescribe,
    String normalizedSearch
  ) {
    for (String parentFieldApiName : parentDescribe.fields.getMap().keySet()) {
      Schema.DescribeFieldResult parentFieldDescribe = parentDescribe.fields.getMap()
        .get(parentFieldApiName)
        .getDescribe();
      if (!parentFieldDescribe.isAccessible()) {
        continue;
      }

      String fieldPath = relationshipName + '.' + parentFieldApiName;
      String combinedLabel =
        parentDescribe.getLabel() +
        ' > ' +
        parentFieldDescribe.getLabel();
      String parentSearchKey =
        relationshipName.toLowerCase() +
        '.' +
        parentFieldApiName.toLowerCase();
      if (
        addedFieldPaths.contains(fieldPath) ||
        !matchesParentSearch(
          normalizedSearch,
          fieldPath,
          combinedLabel,
          parentSearchKey
        )
      ) {
        continue;
      }

      addedFieldPaths.add(fieldPath);
      fields.add(
        new FieldDescriptor(
          combinedLabel,
          fieldPath,
          String.valueOf(parentFieldDescribe.getType())
        )
      );
    }
  }

  /**
   * Normalizes an optional search term.
   *
   * @param searchTerm Raw search term.
   * @return Lowercase trimmed search term.
   */
  private static String normalizeSearchTerm(String searchTerm) {
    return String.isBlank(searchTerm) ? '' : searchTerm.trim().toLowerCase();
  }

  /**
   * Identifies PDF Builder's internal template storage object.
   *
   * @param apiName Object API name, optionally namespaced.
   * @return True when the object must remain hidden from the source-object selector.
   */
  private static Boolean isInternalObjectApiName(String apiName) {
    return apiName == INTERNAL_TEMPLATE_OBJECT_API_NAME ||
      (!String.isBlank(apiName) &&
      apiName.endsWith('__' + INTERNAL_TEMPLATE_OBJECT_API_NAME));
  }

  /**
   * Evaluates a direct field against the normalized search term.
   *
   * @param normalizedSearch Normalized search term.
   * @param apiName Field API name.
   * @param label Field label.
   * @return True when the field matches.
   */
  private static Boolean matchesSearch(
    String normalizedSearch,
    String apiName,
    String label
  ) {
    return normalizedSearch == '' ||
      apiName.toLowerCase().contains(normalizedSearch) ||
      label.toLowerCase().contains(normalizedSearch);
  }

  /**
   * Evaluates a parent field against all supported search representations.
   *
   * @param normalizedSearch Normalized search term.
   * @param fieldPath Relationship field path.
   * @param combinedLabel Relationship and field label.
   * @param parentSearchKey Normalized relationship API path.
   * @return True when the parent field matches.
   */
  private static Boolean matchesParentSearch(
    String normalizedSearch,
    String fieldPath,
    String combinedLabel,
    String parentSearchKey
  ) {
    return normalizedSearch == '' ||
      fieldPath.toLowerCase().contains(normalizedSearch) ||
      combinedLabel.toLowerCase().contains(normalizedSearch) ||
      parentSearchKey.contains(normalizedSearch);
  }
}
