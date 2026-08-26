# Data Horizon Studio 0.20.0

Data Horizon Studio 0.20.0 is the first Git-release-ready milestone for the non-destructive visualizer and broadcast-element editor.

The source is released under GNU GPL version 3. Windows packages include the Data Horizon license alongside the license notices supplied with third-party runtime components.

## Milestone capabilities

- Layered image, native element, mask, paint, effect, animation, and audio-reactive authoring.
- Per-parameter Bass, Mids, Highs, Beat, and RMS routing with response shaping and editable automation.
- Quartic Pulse visualizers plus Tempest Broadcast scenes, overlays, borders, transitions, and Asset Vault elements.
- Shared Studio, Live View, OBS, Quartic Pulse, Tempest Broadcast, and export rendering.
- Scalable graphics-editor workspace with custom docks, canvas guides, selection tools, animation curves, motion paths, and dense-project navigation.
- Reusable projects, layer presets, linked compositions, persistent clipboard, selection sets, and Solo/Restore.

## Git release readiness

- Frozen-lockfile Windows CI.
- Version and tag consistency validation.
- Packaged Electron/WebGL2 workflow testing before publication.
- Clean archive inspection with no diagnostic output.
- SHA-256 checksum and JSON artifact manifest.
- Automated GitHub Release creation from a `v0.20.0` tag.
- Complete dependency audit with no known vulnerabilities at release-candidate validation.
- Electron 44.0.0 security baseline, replacing the vulnerable pre-release runtime used during development.
- GitHub-signed provenance attestation for the published Windows ZIP.
- Public installation, privacy, support, security, issue, and contribution documentation.

## Compatibility

The project schema remains version 1. Existing 0.17 projects normalize into the 0.20 engine contract without destructive migration. Shared render and export formats remain compatible.

## Verification

- 40 automated tests pass.
- Source and packaged Electron/WebGL2 workflows pass with zero browser or renderer errors.
- The packaged workflow covers the complete authoring smoke fixture, including Phase 37 selection sets and hierarchy-aware Solo/Restore.
- The public ZIP is unsigned at the Windows executable level; users can verify its SHA-256 checksum and GitHub workflow attestation.

## Windows artifacts

- Development folder: `release/Data Horizon Studio 0.20.0-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.20.0-win32-x64-release.zip`
- Checksum: `release/Data-Horizon-Studio-0.20.0-win32-x64-release.zip.sha256`
- Manifest: `release/Data-Horizon-Studio-0.20.0-release-manifest.json`
- Archive audit: recorded in the attached release manifest.
- Archive size: recorded in the attached release manifest.
- SHA-256: recorded in the attached checksum and release manifest; the workflow also appends it to the published GitHub notes.
