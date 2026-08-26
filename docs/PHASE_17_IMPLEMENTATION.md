# Phase 17: Bidirectional Asset Vault Library

Data Horizon Studio 0.17.1 turns the Phase 16 publishing bridge into a managed Tempest Broadcast library inside the normal workspace.

## Vault workspace

- The Layers dock now includes an **Asset Vault** tab without adding another fixed panel to the workspace.
- Installed Data Horizon elements show their preview, element kind, authored canvas, alpha mode, runtime version, source name, and last update time.
- **Publish Current** opens the existing publish workflow already configured for Tempest Broadcast.
- **Refresh Vault** re-reads the live built-in Vault rather than relying on cached installation state.

## Bidirectional workflow

- **Edit Source** validates and opens the installed `project.horizon.json` as an editable copy. It deliberately clears the normal save path so saving cannot silently desynchronize an installed runtime from its manifest and generated JavaScript.
- **Update Current** republishes the open composition into the selected stable Vault package while retaining its element kind and transparent-canvas choice.
- **Reveal** opens the package location for inspection.
- **Uninstall** validates the managed package boundary and moves the complete directory to the Windows Recycle Bin.

## Safety boundary

Vault operations accept only normalized package slugs directly below `vault-elements/data-horizon`. Symbolic links, path traversal, foreign formats, mismatched package IDs, and unmanaged directories are rejected. Listing ignores malformed packages rather than allowing them into destructive actions.

## Verification

- TypeScript and renderer builds cover the new isolated IPC surface.
- Static tests require the Vault workspace, controls, and all four IPC routes.
- Electron smoke publishes a real managed element, opens the Vault workspace, renders its preview and actions, validates its editable project, uninstalls it, and confirms the managed library is empty afterward.
- Visual capture: `test-output/phase17-vault-library.png`.
