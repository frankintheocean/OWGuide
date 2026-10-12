# 🧪 Runs on a disposable Windows runner. Never run against a user's installation.
param([string]$Version = '1.0.0')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$msi = (Resolve-Path "release/OWGuide-$Version-x64.msi").Path
$install = Join-Path $env:TEMP 'OWGuide-install-smoke'
$data = Join-Path $env:LOCALAPPDATA 'com.owguide.desktop'
if (Test-Path $data) { throw 'Refusing to test with pre-existing app data.' }
function Run-Msi([string]$arguments) {
  $p = Start-Process msiexec.exe -ArgumentList $arguments -Wait -PassThru
  if ($p.ExitCode -notin @(0,3010)) { throw "Windows Installer failed: $($p.ExitCode)" }
}
function Wait-Database([string]$path, [System.Diagnostics.Process]$appProcess) {
  for ($i=0;$i -lt 30;$i++) {
    $appProcess.Refresh()
    if ($appProcess.HasExited) { throw 'The app exited before its database and main window became ready.' }
    if ((Test-Path $path) -and (Get-Item $path).Length -gt 0 -and $appProcess.MainWindowHandle -ne [IntPtr]::Zero) { return }
    Start-Sleep -Seconds 1
  }
  throw "Application did not create its database: $path"
}
Run-Msi "/i `"$msi`" /qn /norestart INSTALLDIR=`"$install`" /l*v `"$env:TEMP\owguide-install.log`""
$exe = Join-Path $install 'OWGuide.exe'
if (!(Test-Path $exe)) { $exe = Join-Path $install 'owguide.exe' }
if (!(Test-Path $exe)) { throw 'Installed executable missing.' }
$process = Start-Process $exe -PassThru
try { Wait-Database (Join-Path $data 'owguide.sqlite') $process } finally { if (!$process.HasExited) { Stop-Process -Id $process.Id -Force } }
& python tests/desktop-db.py (Join-Path $data 'owguide.sqlite') --seed-personal
if ($LASTEXITCODE -ne 0) { throw 'Could not seed personal data for the maintenance test.' }
$sentinel = Join-Path $data 'preserve-test.txt'
Set-Content $sentinel 'personal data sentinel'
Remove-Item $exe
Run-Msi "/fa `"$msi`" /qn /norestart /l*v `"$env:TEMP\owguide-repair.log`""
if (!(Test-Path $exe)) { throw 'MSI repair did not restore the executable.' }
if ((Get-Content $sentinel) -ne 'personal data sentinel') { throw 'Repair changed personal data.' }
& python tests/desktop-db.py (Join-Path $data 'owguide.sqlite') --check-personal
if ($LASTEXITCODE -ne 0) { throw 'Repair changed personal database contents.' }
Run-Msi "/x `"$msi`" /qn /norestart /l*v `"$env:TEMP\owguide-uninstall.log`""
if (Test-Path $exe) { throw 'Uninstall left the installed executable.' }
if (!(Test-Path $sentinel)) { throw 'Uninstall unexpectedly removed personal data.' }
& python tests/desktop-db.py (Join-Path $data 'owguide.sqlite') --check-personal
if ($LASTEXITCODE -ne 0) { throw 'Uninstall changed personal database contents.' }
$before = (Get-FileHash (Join-Path $data 'owguide.sqlite')).Hash
$portable = Join-Path $root "release/OWGuide-$Version-portable"
$process = Start-Process "$portable\OWGuide.exe" -WorkingDirectory $portable -PassThru
try { Wait-Database "$portable\OWGuideData\owguide.sqlite" $process } finally { if (!$process.HasExited) { Stop-Process -Id $process.Id -Force } }
if ((Get-FileHash (Join-Path $data 'owguide.sqlite')).Hash -ne $before) { throw 'Portable launch touched installed app data.' }
& python tests/desktop-db.py "$portable\OWGuideData\owguide.sqlite"
if ($LASTEXITCODE -ne 0) { throw 'Portable database validation failed.' }
Remove-Item "$portable\OWGuideData" -Recurse -Force
Remove-Item $data -Recurse -Force
@{ schemaVersion=1; version=$Version; automated=@('MSI install','MSI file repair','MSI uninstall','personal folder preservation','portable database isolation'); manualGui='Not tested by this script'; checkedAt=(Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json -Depth 4 | Set-Content release/windows-validation.json
