# 🧾 Hash only final artifacts, after signing and smoke tests.
param([string]$Version='1.0.0')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$commit=(& git rev-parse HEAD).Trim()
foreach ($report in @('release/windows-validation.json','release/windows-wrapper-validation.json','test-results/native-windows/validation.json')) {
  if (!(Test-Path $report)) { throw "Run the required native, MSI and setup UI checks first: $report" }
  $result=Get-Content $report -Raw -Encoding utf8 | ConvertFrom-Json
  $tested=if ($result.head) { $result.head } else { $result.commit }
  if ($tested -ne $commit) { throw "Validation belongs to another build: $report" }
}
if (Test-Path "release/OWGuide-$Version-portable/OWGuideData") { throw 'Do not distribute test database or cache data.' }
Compress-Archive -Path "release/OWGuide-$Version-portable/*" -DestinationPath "release/OWGuide-$Version-portable.zip" -Force
& "$PSScriptRoot/zip-smoke.ps1" -Version $Version
$files=Get-ChildItem release -File | Where-Object { $_.Extension -in @('.exe','.msi','.zip') }
$records=@($files | ForEach-Object { @{ name=$_.Name; bytes=$_.Length; sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); authenticode=if ($_.Extension -in @('.exe','.msi')) { (Get-AuthenticodeSignature $_.FullName).Status.ToString() } else { 'NotApplicable' } } })
$records | ForEach-Object { "$($_.sha256)  $($_.name)" } | Set-Content release/SHA256SUMS.txt
@{schemaVersion=1;appVersion=$Version;commit=$commit;workflow=$env:GITHUB_WORKFLOW;runId=$env:GITHUB_RUN_ID;files=$records;build='Locked dependencies; byte-identical reproducibility not established';appUpdater='Manual download; no binary updater configured'} | ConvertTo-Json -Depth 5 | Set-Content release/release-manifest.json
