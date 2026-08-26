# Contributing to PDF Builder

Thank you for helping improve PDF Builder. Bug reports, documentation improvements, tests, and focused code changes are welcome.

## Before starting

- Search existing issues and pull requests to avoid duplicate work.
- Open an issue before implementing a large feature, a breaking change, or a change to the template model.
- Never include credentials, customer data, Salesforce record IDs, or organization-specific URLs.

## Development workflow

1. Fork the repository and create a branch from `main`.
2. Make one focused change and include tests where behavior changes.
3. Run the local checks:

   ```bash
   npm ci
   npm run lint
   npm run test:ci
   ```

4. Validate Salesforce metadata in a scratch org or sandbox when the change affects Apex, permissions, metadata, PDF rendering, or packaging.
5. Open a pull request and complete its checklist.

Do not commit generated files, local Salesforce state, credentials, or deployment artifacts.

## Pull requests

Pull requests must explain the reason for the change, its user-visible effect, and how it was tested. Keep unrelated refactoring out of functional changes.

A maintainer reviews each pull request. Automated checks must pass, review conversations must be resolved, and at least one required approval must be present before merging. Maintainers may request changes for security, compatibility, maintainability, test coverage, or Salesforce platform constraints.

The project uses squash merging so that each pull request produces one clear commit on `main`.

## Salesforce considerations

- Respect sharing, CRUD, and field-level security.
- Avoid organization-specific assumptions and hard-coded IDs or domains.
- Preserve compatibility with supported standard and custom objects.
- Test browser preview and server-side PDF output when rendering changes.
- Document permission, data-model, packaging, and upgrade implications.
- Add or update Apex and LWC tests for changed behavior.

## Reporting security issues

Do not disclose vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md) instead.
