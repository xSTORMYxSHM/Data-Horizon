# Installing Data Horizon Studio 0.20.0

## Windows x64 portable release

1. Download `Data-Horizon-Studio-0.20.0-win32-x64-release.zip` and its `.sha256` file from the GitHub release.
2. Verify the archive before opening it:

   ```powershell
   certutil -hashfile Data-Horizon-Studio-0.20.0-win32-x64-release.zip SHA256
   ```

   Compare the reported value with the checksum file or the integrity section of the GitHub release.
3. Extract the entire ZIP into a user-writable folder. Do not run the executable from inside the archive.
4. Launch `Data Horizon Studio.exe` from the extracted folder.

The 0.20.0 portable build is not code-signed and may trigger Windows SmartScreen. Verify the checksum and GitHub artifact attestation before choosing to run it. The application currently has no automatic updater; install a later release into a new folder after verifying it.

## Verifying GitHub build provenance

With GitHub CLI installed, the release ZIP can be checked against the repository's signed workflow attestation:

```powershell
gh attestation verify Data-Horizon-Studio-0.20.0-win32-x64-release.zip --repo xSTORMYxSHM/Data-Horizon
```

## Building from source

Install Node.js 22.12.0 or newer and pnpm 11.19.0, then run:

```powershell
npm install --global pnpm@11.19.0
pnpm install --frozen-lockfile
pnpm check
pnpm start
```
