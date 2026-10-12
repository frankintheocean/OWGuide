# 🪟 Checks the portable prerequisite without changing app state in the registry.
$ErrorActionPreference = 'Stop'
$runtime = 'Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$found = $false
foreach ($path in @("HKLM:\SOFTWARE\WOW6432Node\$runtime", "HKLM:\SOFTWARE\$runtime", "HKCU:\SOFTWARE\$runtime")) {
  if (Test-Path $path) { $version = (Get-ItemProperty $path -Name pv -ErrorAction SilentlyContinue).pv; if ($version -and $version -ne '0.0.0.0') { $found = $true } }
}
if (!$found) {
  Write-Host 'OWGuide needs Microsoft Edge WebView2 Runtime. Install it from https://developer.microsoft.com/microsoft-edge/webview2/ and launch again.'
  Read-Host 'Press Enter to close'
  exit 1
}
if (!(Test-Path "$PSScriptRoot\portable.marker")) { throw 'portable.marker is missing. Extract the whole ZIP again.' }
New-Item "$PSScriptRoot\OWGuideData" -ItemType Directory -Force | Out-Null
$probe = "$PSScriptRoot\OWGuideData\.write-check"
Set-Content $probe 'writable'
Remove-Item $probe
Start-Process -FilePath "$PSScriptRoot\OWGuide.exe" -WorkingDirectory $PSScriptRoot
