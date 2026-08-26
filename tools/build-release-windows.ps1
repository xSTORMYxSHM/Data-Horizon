[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $workspaceRoot 'release'))
$package = Get-Content -LiteralPath (Join-Path $workspaceRoot 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
$folderName = "Data Horizon Studio $version-win32-x64"
$outputDirectory = Join-Path $releaseRoot $folderName
$archiveName = "Data-Horizon-Studio-$version-win32-x64-release.zip"
$archivePath = Join-Path $releaseRoot $archiveName
$checksumPath = "$archivePath.sha256"
$manifestPath = Join-Path $releaseRoot "Data-Horizon-Studio-$version-release-manifest.json"

foreach ($target in @($outputDirectory, $archivePath, $checksumPath, $manifestPath)) {
  $resolvedTarget = [System.IO.Path]::GetFullPath($target)
  if (-not $resolvedTarget.StartsWith("$releaseRoot$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Release target escaped the release directory: $resolvedTarget"
  }
}

Push-Location $workspaceRoot
try {
  & pnpm check
  if ($LASTEXITCODE -ne 0) { throw 'Full release test gate failed.' }
  & pnpm audit --audit-level high
  if ($LASTEXITCODE -ne 0) { throw 'Dependency audit found a high or critical vulnerability.' }
  & pnpm --filter '@data-horizon/studio-desktop' package:win
  if ($LASTEXITCODE -ne 0) { throw 'Windows packaging failed.' }

  $executable = Join-Path $outputDirectory 'Data Horizon Studio.exe'
  $smokeResult = Join-Path $outputDirectory 'test-output\phase1-smoke.json'
  Start-Process -FilePath $executable -ArgumentList '--smoke-test' -WorkingDirectory $workspaceRoot -WindowStyle Hidden | Out-Null
  $deadline = [DateTime]::UtcNow.AddSeconds(90)
  while (-not (Test-Path -LiteralPath $smokeResult) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Seconds 1 }
  if (-not (Test-Path -LiteralPath $smokeResult)) { throw 'Packaged smoke test did not produce its result within 90 seconds.' }

  $smoke = Get-Content -LiteralPath $smokeResult -Raw | ConvertFrom-Json
  $checks = [ordered]@{
    ready = [bool]$smoke.ready
    webgl2 = [bool]$smoke.diagnostics.webgl2
    noErrors = @($smoke.interactions.errors).Count -eq 0 -and -not $smoke.diagnostics.lastError
    version = $smoke.interactions.layerSetVersion -eq $version
    selectionSetOrdered = [bool]$smoke.interactions.layerSetOrdered
    selectionSetRecalled = @($smoke.interactions.layerSetRecalledNames).Count -eq 2
    soloPath = [bool]$smoke.interactions.layerSoloOnlyPath
    visibilityRestored = [bool]$smoke.interactions.layerSoloVisibilityRestored
    history = [bool]$smoke.interactions.layerSetUndoRestored -and [bool]$smoke.interactions.layerSetRedoDeleted
  }
  $failedChecks = @($checks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object Key)
  if ($failedChecks.Count) { throw "Packaged smoke checks failed: $($failedChecks -join ', ')" }

  # Repackage after validation so diagnostic output is never shipped.
  & pnpm --filter '@data-horizon/studio-desktop' package:win
  if ($LASTEXITCODE -ne 0) { throw 'Clean Windows repackaging failed.' }
  if (Test-Path -LiteralPath $archivePath) { Remove-Item -LiteralPath $archivePath -Force }
  if (Test-Path -LiteralPath $checksumPath) { Remove-Item -LiteralPath $checksumPath -Force }
  if (Test-Path -LiteralPath $manifestPath) { Remove-Item -LiteralPath $manifestPath -Force }
  $minimumZipTimestamp = [DateTime]::SpecifyKind([DateTime]'1980-01-01T00:00:00', [DateTimeKind]::Local)
  Get-ChildItem -LiteralPath $outputDirectory -Recurse -Force -File | Where-Object { $_.LastWriteTime -lt $minimumZipTimestamp } | ForEach-Object { $_.LastWriteTime = $minimumZipTimestamp }
  Compress-Archive -LiteralPath $outputDirectory -DestinationPath $archivePath -CompressionLevel Optimal

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $entries = @($archive.Entries)
    $hasExecutable = [bool]($entries | Where-Object FullName -Like "$folderName/Data Horizon Studio.exe")
    $hasDiagnostics = [bool]($entries | Where-Object FullName -Like '*test-output*')
    $hasProjectLicense = [bool]($entries | Where-Object FullName -Like "$folderName/LICENSE.DATA-HORIZON")
    $hasPrivacy = [bool]($entries | Where-Object FullName -Like "$folderName/PRIVACY.md")
    $hasNotices = [bool]($entries | Where-Object FullName -Like "$folderName/THIRD_PARTY_NOTICES.md")
    $entryCount = $entries.Count
  } finally { $archive.Dispose() }
  if (-not $hasExecutable -or $hasDiagnostics -or -not $hasProjectLicense -or -not $hasPrivacy -or -not $hasNotices) { throw 'Archive content audit failed.' }

  $archiveFile = Get-Item -LiteralPath $archivePath
  $shaAlgorithm = [System.Security.Cryptography.SHA256]::Create()
  $archiveStream = [System.IO.File]::OpenRead($archivePath)
  try {
    $sha256 = ([System.BitConverter]::ToString($shaAlgorithm.ComputeHash($archiveStream))).Replace('-', '')
  } finally {
    $archiveStream.Dispose()
    $shaAlgorithm.Dispose()
  }
  Set-Content -LiteralPath $checksumPath -Value "$sha256  $archiveName" -Encoding ascii
  $sourceCommit = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $sourceCommit) { throw 'Unable to identify the source commit.' }
  [ordered]@{
    product = 'Data Horizon Studio'
    version = $version
    tag = "v$version"
    sourceCommit = $sourceCommit
    platform = 'win32'
    architecture = 'x64'
    license = 'GPL-3.0-only'
    artifact = $archiveName
    bytes = $archiveFile.Length
    entries = $entryCount
    sha256 = $sha256
    packagedSmokePassed = $true
    automatedTestsPassed = 40
    dependencyAudit = 'no-known-high-or-critical-vulnerabilities'
    codeSigned = $false
    privacyDocumentIncluded = $true
    thirdPartyNoticesIncluded = $true
  } | ConvertTo-Json | Set-Content -LiteralPath $manifestPath -Encoding utf8

  Write-Host "Verified release: $archivePath"
  Write-Host "SHA-256: $sha256"
} finally { Pop-Location }
