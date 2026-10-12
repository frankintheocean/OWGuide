# 🧾 Hash only final artifacts, after signing and smoke tests.
param([string]$Version='1.0.0')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
if (!(Test-Path release/windows-validation.json)) { throw 'Run Windows package smoke tests first.' }
Compress-Archive -Path "release/OWGuide-$Version-portable/*" -DestinationPath "release/OWGuide-$Version-portable.zip" -Force
$files=Get-ChildItem release -File | Where-Object { $_.Extension -in @('.exe','.msi','.zip') }
$records=@($files | ForEach-Object { @{ name=$_.Name; bytes=$_.Length; sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); authenticode=if ($_.Extension -in @('.exe','.msi')) { (Get-AuthenticodeSignature $_.FullName).Status.ToString() } else { 'NotApplicable' } } })
$records | ForEach-Object { "$($_.sha256)  $($_.name)" } | Set-Content release/SHA256SUMS.txt
@{schemaVersion=1;appVersion=$Version;commit=$env:GITHUB_SHA;workflow=$env:GITHUB_WORKFLOW;runId=$env:GITHUB_RUN_ID;files=$records;build='Locked dependencies; byte-identical reproducibility not established';appUpdater='Manual download; no binary updater configured'} | ConvertTo-Json -Depth 5 | Set-Content release/release-manifest.json
