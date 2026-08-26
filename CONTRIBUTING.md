# Contributing to Data Horizon Studio

## Development setup

Use Node.js 22.12.0 or newer and pnpm 11 or newer.

```powershell
corepack enable
corepack prepare pnpm@11.19.0 --activate
pnpm install --frozen-lockfile
pnpm check
```

Keep editor behavior non-destructive, preserve identical Studio/live/export rendering, and include focused model or Electron smoke coverage for behavioral changes. Do not commit `node_modules`, `dist`, `release`, `test-output`, local autosaves, reference songs, or user media.

Contributions are accepted under the repository's GNU GPL version 3 license.

## Pull requests

- Describe the user-visible outcome and compatibility impact.
- Keep project migrations tolerant of older version-one files.
- Run `pnpm check` before submitting.
- Update the relevant phase and release documentation when behavior changes.
- Do not include third-party source or assets unless their license and attribution have been reviewed for the repository.

## Releases

All version markers must agree before a release. `pnpm verify:release` enforces this contract. Stable releases use an annotated `vMAJOR.MINOR.PATCH` tag; pushing that tag runs the verified Windows release workflow.
