# Changelog

Notable changes to PDF Builder are documented here. The project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Aligned local tooling with Node.js 22.13+, Salesforce API 67.0 and the next `1.0.18` development line without changing the published `1.0.17` release.
- CI now verifies repository formatting, reports meaningful LWC coverage and uploads a valid CodeQL v4 SARIF result even when the security scan is clean so resolved alerts can close.
- Strengthened Apex permission coverage with a real least-privilege Salesforce user that reads, creates and deletes templates through the public controller facade.
- Refreshed repository metadata and applied the established formatter consistently across supported source files while leaving Salesforce XML formatting stable.

## [1.0.17] - 2026-09-15

### Added

- Added light and dark Builder workspace themes without changing the authored document palette.
- Added contextual guidance when a merge field or related list requires a selected object or insertion target.
- Added a review dialog when changing objects leaves merge fields or related list configuration associated with the previous object.

### Changed

- Related list values now use field-aware alignment: numeric, currency and percentage values align right; dates and booleans align centrally; text remains left-aligned.
- Header and footer resizing now stops at the bounds required by their positioned content for both pointer and numeric changes.
- User-facing Builder messages are centralized for consistent dialogs, status messages and validation feedback.
- CI now runs on Node.js 22, and the source deployment manifest includes the complete application metadata required by a clean org.

### Fixed

- Restored every saved related list column when legacy templates use different API-name casing.
- Prevented keyboard deletion shortcuts from acting on selected elements while an input, search, preview ID or editable table cell owns focus.
- Released toolbar and property-panel focus when an element is selected so `Delete` and `Backspace` apply to the canvas selection as intended.
- Prevented header and footer content from being clipped when their regions are resized.
- Improved related list preview and server-rendered PDF pagination so table rows remain visible and positioned with the following body content.

### Security

- Updated vulnerable transitive development dependencies and retained sanitization at template persistence, preview and final PDF boundaries.

## [1.0.16-beta.5] - 2026-09-03

### Added

- Templates can be assigned to all record types or to one active record type, with one default template per object and scope.
- The record-page generator now selects the most specific applicable default template automatically.
- Saved PDFs can be opened directly in the browser's native PDF viewer.

### Changed

- The Builder toolbar is grouped and responsive, with clearer separation between authoring, template context, and save/delete controls.
- Related List placeholders in the Builder now use a compact header-and-sample-row representation.
- The README now introduces the visual Builder first, highlights the Live Demo, and documents record-type template availability.

### Fixed

- Horizontal and vertical dividers are rendered in server-generated PDFs with their configured geometry, style, and page offset.

## [1.0.16-beta.4] - 2026-09-01

### Added

- `MP Opportunity Service Quotation`, a third optional sample template, with its matching static-resource logo.

### Changed

- The generated HTML dialog now presents formatted, syntax-highlighted markup and provides a copy action.
- Preview record IDs accept only 15–18 alphanumeric Salesforce IDs and are limited to 18 characters.
- Removed duplicate page labels from preview overflow pages; the existing header page indicator remains the single source of page numbering.

### Fixed

- An unconfigured Related List placeholder now remains at its configured position in preview output.

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

[Unreleased]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.17...HEAD
[1.0.17]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.16-beta.5...v1.0.17
[1.0.16-beta.5]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.16-beta.4...v1.0.16-beta.5
[1.0.16-beta.4]: https://github.com/mpdigitals/pdf-builder-sfdc/compare/v1.0.16-beta.3...v1.0.16-beta.4
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
