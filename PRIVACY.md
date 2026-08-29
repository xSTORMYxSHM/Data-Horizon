# Privacy

Data Horizon Studio 0.20.5 does not require an account and does not include analytics, advertising, crash reporting, or automatic update telemetry.

## Local data

Projects, presets, workspace layouts, autosaves, reference songs, imported images, and generated packages remain on the computer unless the user deliberately copies or publishes them. Reference audio is analyzed locally for Bass, Mids, Highs, Beat, and RMS features; it is not uploaded by Data Horizon Studio.

Studio can read or write explicitly selected project files and can install elements into a locally configured Tempest Broadcast Asset Vault. Published Tempest runtime elements may poll the local telemetry JSON endpoint supplied by Tempest Broadcast. Data Horizon does not configure a remote telemetry server.

## Network behavior

The editor has no built-in cloud service, account login, updater, or external analytics endpoint. Network access can occur only when a user-authored runtime is hosted by another application or when a runtime is explicitly configured with a telemetry URL. Users should review third-party images, fonts, scripts, and hosting environments they add to a project.

## User responsibility

Do not publish projects containing personal information, private stream assets, copyrighted media without permission, access tokens, or local filesystem details. Remove sensitive content before attaching a project to a public issue.
