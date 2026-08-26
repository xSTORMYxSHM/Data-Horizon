# Phase 38: Verified Git Release Pipeline

Phase 38 promotes Data Horizon Studio to the explicit 0.20.0 milestone and makes tagged Windows releases repeatable and auditable.

## Release contract

`pnpm verify:release` checks stable semantic versioning across every workspace package, the project engine contract, Studio footer and About surface, README, changelog, versioning document, and version-specific release notes. In GitHub Actions, the pushed tag must exactly equal `v` plus the application version.

## Continuous integration

The Windows CI workflow uses Node.js 22.12.0, pnpm 11.19.0, Electron 44.0.0, the committed frozen lockfile, read-only repository permissions, bounded run time, and concurrency cancellation. Every branch and pull request runs the full build and 40-test gate.

## Tagged releases

Pushing a `v*` tag runs the verified Windows release script. It executes the full 39-test gate and dependency audit, packages the app, launches the packaged executable through the complete Electron/WebGL2 smoke workflow, checks the 0.20 selection-set and Solo/Restore assertions, and packages a second clean copy so diagnostic output cannot enter the release.

The script audits the archive, calculates SHA-256, and emits a machine-readable manifest. GitHub signs build provenance for the ZIP through its artifact-attestation service, creates the release from version-specific notes, and attaches the ZIP, checksum, and manifest.

## Repository hygiene

Git attributes define consistent text and binary handling. Contributor, privacy, support, security, issue, and pull-request policies document expected validation, compatibility, asset hygiene, user-data handling, and private vulnerability reporting. Dependabot monitors npm and GitHub Actions dependencies. Generated dependencies, builds, autosaves, test output, and release artifacts remain ignored.

## Publishing

From a clean default branch, create and push an annotated tag:

```powershell
git tag -a v0.20.0 -m "Data Horizon Studio 0.20.0"
git push origin v0.20.0
```

The repository owner should confirm repository visibility, the remote URL, and GitHub security settings before the first public release. The existing GNU GPL version 3 license is preserved at the repository root and in packaged builds.
