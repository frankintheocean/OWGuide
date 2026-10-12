# ✍️ Optional Authenticode signing. Credentials are injected only in a protected job.
param([ValidateSet('Binary','Msi','Setup')][string]$Phase='Binary')
$ErrorActionPreference='Stop'
if (!$env:OWGUIDE_CERTIFICATE_BASE64 -or !$env:OWGUIDE_CERTIFICATE_PASSWORD) { Write-Host 'Signing not configured; artifacts remain unsigned.'; exit 0 }
$certificate=Join-Path $env:RUNNER_TEMP 'owguide-signing.pfx'
[IO.File]::WriteAllBytes($certificate,[Convert]::FromBase64String($env:OWGUIDE_CERTIFICATE_BASE64))
try {
  $password=ConvertTo-SecureString $env:OWGUIDE_CERTIFICATE_PASSWORD -AsPlainText -Force
  $cert=Get-PfxCertificate -FilePath $certificate -Password $password
  $targets = switch ($Phase) { 'Binary' { 'src-tauri/target/release/owguide.exe' }; 'Msi' { Get-ChildItem src-tauri/target/release/bundle/msi/*.msi | ForEach-Object FullName }; 'Setup' { Get-ChildItem release/*-setup.exe | ForEach-Object FullName } }
  foreach ($file in $targets) { $result=Set-AuthenticodeSignature -FilePath $file -Certificate $cert -HashAlgorithm SHA256 -TimestampServer 'http://timestamp.digicert.com'; if ($result.Status -ne 'Valid') { throw "Signature validation failed: $file" } }
} finally { Remove-Item $certificate -Force -ErrorAction SilentlyContinue }
