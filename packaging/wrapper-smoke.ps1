# 🛎️ Exercise the real setup UI on a disposable Windows runner.
param([string]$Version='1.0.0')
$ErrorActionPreference='Stop'
trap {
  $message=$_.Exception.Message.Replace('%','%25').Replace("`r",'%0D').Replace("`n",'%0A')
  Write-Host "::error title=Setup GUI acceptance::$message"
  exit 1
}
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$setup=(Resolve-Path "release/OWGuide-$Version-x64-setup.exe").Path
$data=Join-Path $env:LOCALAPPDATA 'com.owguide.desktop'
if (Test-Path $data) { throw 'Refusing GUI maintenance checks with pre-existing personal data.' }
$products=@(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -eq 'OWGuide')
if ($products.Count) { throw 'Refusing GUI maintenance checks with a pre-existing installation.' }
function Click-Control($process,[string]$control) {
  $deadline=(Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    $process.Refresh()
    if ($process.HasExited) { throw "Setup exited before control '$control' became ready." }
    try {
      $output=& pwsh -NoProfile -File tests/windows-window.ps1 -Title 'OWGuide Setup' -ProcessId $process.Id -Action click -Control $control 2>&1
      if ($LASTEXITCODE -eq 0) { return }
    } catch { }
    Start-Sleep -Milliseconds 500
  }
  throw "Setup control did not become ready: $control. Last helper output: $($output -join ' ')"
}
function Run-Setup([string]$choice,[bool]$deleteData=$false) {
  $process=Start-Process $setup -PassThru
  try {
    Click-Control $process $choice
    if ($deleteData) { Click-Control $process "Also delete this Windows user's notes and settings after uninstall" }
    Click-Control $process 'Apply'
    Click-Control $process 'Close'
    if (!$process.WaitForExit(10000)) { throw 'Setup did not exit after Close.' }
    if ($process.ExitCode -notin @(0,3010)) { throw "Setup failed: $($process.ExitCode)" }
  } finally { if (!$process.HasExited) { Stop-Process -Id $process.Id -Force } }
}
function Installed-Exe {
  $product=@(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object DisplayName -eq 'OWGuide')
  if ($product.Count -ne 1) { throw 'Setup did not register exactly one OWGuide product.' }
  $folder=$product[0].InstallLocation
  if (!$folder) { $folder=Join-Path $env:ProgramFiles 'OWGuide' }
  $exe=Join-Path $folder 'owguide.exe'
  if (!(Test-Path $exe)) { throw 'Registered installation executable is missing.' }
  return $exe
}
Run-Setup 'Install OWGuide'
$exe=Installed-Exe
$appProcess=Start-Process $exe -PassThru
try {
  $ready=$false
  for ($i=0;$i -lt 30;$i++) {
    if (Test-Path (Join-Path $data 'owguide.sqlite')) {
      & python tests/desktop-db.py (Join-Path $data 'owguide.sqlite') *> $null
      $appProcess.Refresh()
      if ($LASTEXITCODE -eq 0 -and $appProcess.MainWindowHandle -ne [IntPtr]::Zero) { $ready=$true;break }
    }
    if ($appProcess.HasExited) { throw 'GUI-installed app exited before its database was ready.' }
    Start-Sleep -Seconds 1
  }
  if (!$ready) { throw 'GUI-installed application database did not become ready.' }
} finally {
  if (!$appProcess.HasExited) {
    & pwsh -NoProfile -File tests/windows-window.ps1 -Title 'OWGuide' -ProcessId $appProcess.Id -Action close
    if ($LASTEXITCODE -ne 0 -or !$appProcess.WaitForExit(15000)) { Stop-Process -Id $appProcess.Id -Force;throw 'Installed app did not close normally.' }
  }
}
& python tests/desktop-db.py (Join-Path $data 'owguide.sqlite') --seed-personal
if ($LASTEXITCODE -ne 0) { throw 'Could not seed GUI repair notes.' }
$hash=(Get-FileHash $exe -Algorithm SHA256).Hash
Remove-Item $exe
Run-Setup 'Repair OWGuide (must already be installed)'
if (!(Test-Path $exe) -or (Get-FileHash $exe -Algorithm SHA256).Hash -ne $hash) { throw 'Setup GUI repair did not restore the expected executable.' }
& python tests/desktop-db.py (Join-Path $data 'owguide.sqlite') --check-personal
if ($LASTEXITCODE -ne 0) { throw 'Setup GUI repair changed personal data.' }
Run-Setup 'Uninstall OWGuide'
if (Test-Path $exe) { throw 'Setup GUI uninstall left the application executable.' }
& python tests/desktop-db.py (Join-Path $data 'owguide.sqlite') --check-personal
if ($LASTEXITCODE -ne 0) { throw 'Setup GUI uninstall did not retain personal data.' }
Run-Setup 'Install OWGuide'
Run-Setup 'Uninstall OWGuide' $true
if (Test-Path $data) { throw 'Explicit delete-data option left personal data.' }
@{schemaVersion=1;version=$Version;commit=(& git rev-parse HEAD).Trim();checkedAt=(Get-Date).ToUniversalTime().ToString('o');automated=@('setup GUI install and registration','setup GUI repair and notes/favorites retention','setup GUI uninstall with data retention','setup GUI explicit personal-data deletion');limitations=@('Windows Server CI, not Windows 10/11 hardware','UAC prompt and screen reader not checked')} | ConvertTo-Json -Depth 4 | Set-Content release/windows-wrapper-validation.json

Write-Host '::notice title=Setup GUI acceptance::Install, repair, retain-data uninstall and explicit delete-data uninstall passed.'
