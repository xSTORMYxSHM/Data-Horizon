# First Public Release Checklist

## Automated gates

- [x] Stable 0.20.0 version is consistent across packages, engine, application, Tempest manifest, documentation, and tag.
- [x] Frozen-lockfile build and 40 automated tests pass.
- [x] Packaged Electron/WebGL2 smoke workflow passes before clean repackaging.
- [x] Complete dependency audit reports no known vulnerabilities.
- [x] ZIP contents, SHA-256 checksum, and JSON manifest are generated automatically.
- [x] GitHub artifact provenance is generated for the published ZIP.
- [x] Data Horizon GPL and third-party runtime notices are packaged.
- [x] Secrets, machine paths, generated files, private media, and diagnostics are excluded from Git.

## Repository-owner settings

- [x] Add and verify the intended GitHub remote.
- [x] Confirm the repository is public and the default branch is `main`.
- [ ] Enable branch protection requiring the CI workflow.
- [x] Enable private vulnerability reporting in repository security settings.
- [x] Enable Dependabot alerts and security updates.
- [ ] Enable Discussions if it will be the support channel.
- [ ] Confirm the public author email in the existing Git history is intentional.

## Publication

- [x] Push `main` and verify CI succeeds.
- [x] Push annotated tag `v0.20.0`.
- [x] Verify the GitHub Release contains the ZIP, checksum, manifest, source archives, and artifact attestation.
- [ ] Download the published ZIP on a separate Windows account or machine, verify it, and complete a clean-launch test.
