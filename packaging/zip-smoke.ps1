# 🧳 Launch the actual extracted portable ZIP through its prerequisite launcher.
param([string]$Version='1.0.0')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location $root
$archive=(Resolve-Path "release/OWGuide-$Version-portable.zip").Path
$folder=Join-Path $env:TEMP ("OWGuide-zip-"+[Guid]::NewGuid().ToString('N'))
$installed=Join-Path $env:LOCALAPPDATA 'com.owguide.desktop'
if (Test-Path $installed) { throw 'Refusing ZIP checks with pre-existing installed-app data.' }
$appProcess=$null
try {
  Expand-Archive $archive -DestinationPath $folder
  # Windows TEMP may use an 8.3 alias while Process.Path returns the long name.
  Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class OWGuideZipPath {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern uint GetLongPathName(string path, StringBuilder result, uint size);
}
'@
  $longFolder=[Text.StringBuilder]::new(32768)
  $length=[OWGuideZipPath]::GetLongPathName($folder,$longFolder,32768)
  if ($length -eq 0 -or $length -ge 32768) { throw 'Could not resolve the extracted folder to its full Windows path.' }
  $folder=$longFolder.ToString()
  foreach ($file in @('OWGuide.exe','portable.marker','Launch-OWGuide.ps1','Launch-OWGuide.cmd','READ-ME.md','LICENSE.txt','THIRD_PARTY_NOTICES.txt')) {
    if (!(Test-Path (Join-Path $folder $file))) { throw "Portable ZIP is missing $file" }
  }
  if (Test-Path (Join-Path $folder 'OWGuideData')) { throw 'Portable ZIP contains personal data.' }
  $exe=Join-Path $folder 'OWGuide.exe'
  if ((Get-FileHash $exe).Hash -ne (Get-FileHash "release/OWGuide-$Version-portable/OWGuide.exe").Hash) { throw 'Portable ZIP changed executable bytes.' }
  $launcher=Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$folder\Launch-OWGuide.ps1`"" -PassThru
  if (!$launcher.WaitForExit(15000)) { Stop-Process -Id $launcher.Id -Force;throw 'Portable prerequisite launcher did not finish.' }
  if ($launcher.ExitCode -ne 0) { throw "Portable launcher failed: $($launcher.ExitCode)" }
  $ready=$false
  $databaseCheck='Database file not created'
  $processSummary='No matching process'
  for ($i=0;$i -lt 30;$i++) {
    $zipProcesses=@(Get-Process -Name OWGuide -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe })
    $processSummary=(@(Get-Process -Name OWGuide -ErrorAction SilentlyContinue | ForEach-Object { "PID=$($_.Id) path=$($_.Path) window=$($_.MainWindowHandle)" }) -join '; ')
    if ($zipProcesses.Count -eq 1) {
      $appProcess=$zipProcesses[0]
      $database=Join-Path $folder 'OWGuideData/owguide.sqlite'
      if (Test-Path $database) {
        $databaseCheck=(& python tests/desktop-db.py $database 2>&1 | Out-String).Trim()
        $appProcess.Refresh()
        if ($LASTEXITCODE -eq 0 -and $appProcess.MainWindowHandle -ne [IntPtr]::Zero) { $ready=$true;break }
      }
    }
    Start-Sleep -Seconds 1
  }
  if (!$ready) { throw "The extracted portable app did not initialize its database and window. Processes: $processSummary. Database: $databaseCheck. Expected executable: $exe" }
  if (Test-Path $installed) { throw 'The extracted portable app created installed-app data.' }
  & pwsh -NoProfile -File tests/windows-window.ps1 -Title 'OWGuide' -ProcessId $appProcess.Id -Action close
  if ($LASTEXITCODE -ne 0 -or !$appProcess.WaitForExit(15000)) { throw 'The extracted portable app did not close normally.' }
  @{schemaVersion=1;commit=(& git rev-parse HEAD).Trim();checkedAt=(Get-Date).ToUniversalTime().ToString('o');archiveSha256=(Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant();automated=@('final ZIP extraction and file layout','executable byte preservation','packaged prerequisite launcher','portable SQLite initialization and installed-state isolation','normal window shutdown');limitations=@('missing WebView2 and read-only directories need a separate manual machine')} | ConvertTo-Json -Depth 4 | Set-Content release/portable-zip-validation.json
  Write-Host '::notice title=Portable ZIP acceptance::Final ZIP extraction, launcher, executable bytes, SQLite, isolation and shutdown passed.'
} catch {
  $message=$_.Exception.Message.Replace('%','%25').Replace("`r",'%0D').Replace("`n",'%0A')
  Write-Host "::error title=Portable ZIP acceptance::$message"
  throw
} finally {
  if ($appProcess -and !$appProcess.HasExited) { Stop-Process -Id $appProcess.Id -Force }
  if (Test-Path $folder) {
    for ($attempt=0;$attempt -lt 10;$attempt++) {
      try { Remove-Item $folder -Recurse -Force;break } catch { if ($attempt -eq 9) { throw };Start-Sleep -Milliseconds 500 }
    }
  }
}
