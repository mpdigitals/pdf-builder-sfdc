# PDF Builder release format

Use this format for every GitHub release.

- Stable tag and title: `vX.Y.Z` / `PDF Builder vX.Y.Z`
- Beta tag and title: `vX.Y.Z-beta.N` / `PDF Builder vX.Y.Z-beta.N`
- Use concise English release notes.
- Start every bullet with a short **bold label** followed by a colon.
- Keep sections in the order shown below. Omit **Fixes** only when the release contains no separately documented fixes.

## Highlights

- **Feature name:** concise description of the user-visible improvement.

## Fixes

- **Fix name:** concise description of the corrected behavior.

## Validation

- **N LWC tests passing** across N suites.
- **N% Apex package coverage**, with the Salesforce package coverage check passed.
- **Static validation passed:** list the relevant checks.
- **Org validation completed:** identify only the orgs or workflows actually verified.

## Install

### Core package — required

- **Package:** PDF Builder
- **Package version:** `X.Y.Z.BUILD`
- **Package ID:** `04t...`
- [Install in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04t...)
- [Install in Developer Edition or Production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04t...)

### Salesforce CLI

```bash
sf package install \
  --package 04t... \
  --target-org your-target-org \
  --wait 30 \
  --publish-wait 10 \
  --no-prompt
```

For releases that include the guided AI integration, add:

### AI adapter — optional

- **Package:** PDF Builder AI
- **Package version:** `X.Y.Z.BUILD`
- **Package ID:** `04t...`
- **Requirement:** Agentforce and Models API must be available in the target org.
- [Install in a sandbox](https://test.salesforce.com/packaging/installPackage.apexp?p0=04t...)
- [Install in Developer Edition or Production](https://login.salesforce.com/packaging/installPackage.apexp?p0=04t...)

```bash
sf package install \
  --package 04t... \
  --target-org your-target-org \
  --wait 30 \
  --publish-wait 10 \
  --no-prompt
```

For beta releases, finish with:

> This unlocked package is **not promoted**. Validate it in a sandbox or Developer Edition before production use.
