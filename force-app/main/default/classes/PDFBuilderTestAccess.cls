/**
 * Test-only helpers for running PDF Builder tests with the packaged permissions.
 *
 * @author mpdigitals
 * @date October 2026
 */
@IsTest
public class PDFBuilderTestAccess {
  private static final String TEST_USER_LAST_NAME = 'PDF Builder Test Runtime';

  /**
   * Creates a least-privilege user with the packaged permission set.
   *
   * API 67 database operations default to user mode. Explicitly assigning the
   * permission set keeps deployment tests representative of a configured user
   * while production CRUD, FLS, and sharing enforcement remains unchanged.
   */
  public static void createPermissionedUser() {
    Profile leastPrivilegeProfile = [
      SELECT Id
      FROM Profile
      WHERE
        UserType = 'Standard'
        AND UserLicense.Name = 'Salesforce'
        AND PermissionsModifyAllData = FALSE
        AND PermissionsCustomizeApplication = FALSE
        AND PermissionsViewAllData = FALSE
      WITH SYSTEM_MODE
      ORDER BY Name ASC
      LIMIT 1
    ];
    User builderUser = new User(
      Alias = 'pdbtest',
      Email = 'pdf.builder.test@example.com',
      EmailEncodingKey = 'UTF-8',
      LastName = TEST_USER_LAST_NAME,
      LanguageLocaleKey = 'en_US',
      LocaleSidKey = 'en_US',
      ProfileId = leastPrivilegeProfile.Id,
      TimeZoneSidKey = 'Europe/Madrid',
      Username = 'pdf.builder.test.' +
        UserInfo.getUserId() +
        '.' +
        String.valueOf(Datetime.now().getTime()) +
        '@example.com'
    );
    insert as system builderUser;

    PermissionSet builderPermissionSet = [
      SELECT Id
      FROM PermissionSet
      WHERE Name = 'PDFBuilderUser'
      WITH SYSTEM_MODE
      LIMIT 1
    ];

    System.runAs(builderUser) {
      insert as system new PermissionSetAssignment(
        AssigneeId = builderUser.Id,
        PermissionSetId = builderPermissionSet.Id
      );
    }
  }

  /**
   * Returns the permissioned user created by the current test class setup.
   *
   * @return User configured with the PDF Builder permission set.
   */
  public static User getPermissionedUser() {
    return [
      SELECT Id
      FROM User
      WHERE LastName = :TEST_USER_LAST_NAME
      WITH SYSTEM_MODE
      LIMIT 1
    ];
  }
}
