# 📦 Run after a Windows x64 release build. Keeps portable state separate.
param([string]$Version = '1.0.0')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
New-Item release -ItemType Directory -Force | Out-Null
$msi = @(Get-ChildItem src-tauri/target/release/bundle/msi/*.msi)
if ($msi.Count -ne 1) { throw 'Expected exactly one MSI from this build.' }
Copy-Item $msi[0].FullName "release/OWGuide-$Version-x64.msi"
$portable = "release/OWGuide-$Version-portable"
New-Item $portable -ItemType Directory -Force | Out-Null
Copy-Item src-tauri/target/release/owguide.exe "$portable/OWGuide.exe"
Set-Content "$portable/portable.marker" 'OWGuide portable mode' -Encoding ascii
Copy-Item packaging/Launch-OWGuide.ps1 "$portable/Launch-OWGuide.ps1"
Copy-Item packaging/Launch-OWGuide.cmd "$portable/Launch-OWGuide.cmd"
Copy-Item docs/PORTABLE.md "$portable/READ-ME.md"
Copy-Item LICENSE "$portable/LICENSE.txt"
if (!(Test-Path THIRD_PARTY_NOTICES.txt)) { throw 'Generate third-party notices before packaging.' }
Copy-Item THIRD_PARTY_NOTICES.txt "$portable/THIRD_PARTY_NOTICES.txt"
$makensis = 'C:\Program Files (x86)\NSIS\makensis.exe'
if (!(Test-Path $makensis)) { throw 'Install the pinned NSIS 3.11 build first.' }
Push-Location packaging
& $makensis "/DMSI_FILE=$($msi[0].FullName)" "/DOUT_FILE=$root\release\OWGuide-$Version-x64-setup.exe" setup.nsi
if ($LASTEXITCODE -ne 0) { throw 'Installer wrapper compilation failed.' }
Pop-Location
Write-Host 'Packaging prepared. Run Windows validation before creating checksums or releasing.'
