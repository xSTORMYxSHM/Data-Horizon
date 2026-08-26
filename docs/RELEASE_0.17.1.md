# Data Horizon Studio 0.17.1

Data Horizon Studio 0.17.1 adds the bidirectional Tempest Asset Vault library.

## Highlights

- Browse Data Horizon elements already installed in Tempest Broadcast.
- Reopen any managed element as a safe editable project copy.
- Replace an installed element with the current canvas while preserving its deployment settings.
- Reveal package files and recoverably uninstall managed elements.
- Validate every Vault operation against the managed Data Horizon package boundary.

## Compatibility

The project schema remains version 1. Projects created by earlier builds normalize to engine version 0.17.1 when opened. Quartic Pulse and portable Tempest bundle formats remain compatible with the 0.17 runtime contract.

## Windows artifact

- Development folder: `release/Data Horizon Studio 0.17.1-win32-x64`
- ZIP distribution: `release/Data-Horizon-Studio-0.17.1-win32-x64-release.zip`
- ZIP SHA-256: `9E6ED4336525E35BA28D19E3B646671EA22A6942ED56A737F899687B8B1A7F14`

The final archive contains 87 entries and was inspected for the 0.17.1 application manifest, executable, shared renderer, Vault library UI, and managed Vault IPC routes. The package passed all 28 automated tests and the Electron smoke workflow before release.
