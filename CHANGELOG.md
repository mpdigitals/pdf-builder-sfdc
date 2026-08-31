# Changelog

Notable changes to PDF Builder are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.16-beta.3] - 2026-08-31

### Fixed

- Preview waits for newly selected images to be persisted as Salesforce Files before generating HTML, preventing large embedded image payloads from exceeding the preview request limit.

## [1.0.16-beta.2] - 2026-08-31

### Fixed

- Preview now resolves Organization and User merge fields even when no record ID is selected.
- Turning off a Header or Footer now disables and clears its corresponding repeat option.
- Copying horizontal and vertical lines preserves their fixed axis, preventing pasted lines from shifting diagonally.
- Selecting another component now releases table-cell text focus so keyboard deletion applies to the selected component.

## [1.0.16-beta.1] - 2026-08-31

### Changed

- Published the first beta pre-release distribution and clarified unlocked-package installation and optional Quote support.

## [1.0.15] - 2026-08-30

### Changed

- Consolidated responsive layout helpers used by the builder panels and canvas.

## [1.0.14] - 2026-08-30

### Fixed

- Restored responsive PDF Builder panel and canvas layout behavior.

## [1.0.13] - 2026-08-28

### Added

- Salesforce Code Analyzer results are uploaded to GitHub code scanning in CI.

## [1.0.12] - 2026-08-28

### Changed

- Accessible custom objects are available in the object selector regardless of the optional custom-object setting.

### Fixed

- Changing or clearing the selected object or template now clears stale preview state.

## [1.0.11] - 2026-08-27

### Security

- Template HTML is sanitized at persistence, preview, and final PDF-render boundaries while preserving supported rich-text and layout formatting.

## [1.0.10] - 2026-08-27

### Security

- Quote PDF persistence now consistently enforces the authenticated user's object, field, and record permissions.
- Salesforce Code Analyzer reporting is restricted to the recommended security ruleset.

## [1.0.9] - 2026-08-27

### Fixed

- PDF destination controls now remain compact, separated, and responsive on narrow Lightning record-page columns.

## [1.0.8] - 2026-08-26

### Changed

- Horizontal and vertical line containers can be resized on both axes, while remaining at least as wide or tall as the configured line thickness.
- The Codacy quality badge is shown first in the README status badges.

### Added

- Initial public contribution, security, and continuous-integration documentation.

## [1.0.7] - 2026-08-26

### Added

- Public Salesforce-native visual template builder and PDF generation application.
- Opportunity, Quote, standard-object, and custom-object template support.
- Merge fields, related lists, images, tables, lines, headers, footers, and manual pages.
- Browser preview, PDF download, and Salesforce Files output.
- Installable unlocked package and portable sample templates.

[Unreleased]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.16-beta.3...HEAD
[1.0.16-beta.3]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.16-beta.2...v1.0.16-beta.3
[1.0.16-beta.2]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.16-beta.1...v1.0.16-beta.2
[1.0.16-beta.1]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.15...v1.0.16-beta.1
[1.0.15]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.14...v1.0.15
[1.0.14]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.13...v1.0.14
[1.0.13]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.12...v1.0.13
[1.0.12]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/mpdigitals/pdf-builder-sfdc/releases/tag/v1.0.7
