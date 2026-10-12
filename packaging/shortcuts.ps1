# 🔗 Check only OWGuide links in the current user's and shared Windows folders.
function Find-OWGuideShortcuts {
  $roots=@(
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('CommonPrograms'),
    [Environment]::GetFolderPath('DesktopDirectory'),
    [Environment]::GetFolderPath('CommonDesktopDirectory')
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
  return @($roots | ForEach-Object { Get-ChildItem $_ -Filter 'OWGuide.lnk' -Recurse -ErrorAction Stop })
}
function Test-OWGuideShortcuts([string]$executable) {
  $links=@(Find-OWGuideShortcuts)
  $shell=New-Object -ComObject WScript.Shell
  try {
    foreach ($kind in @('Desktop','Start Menu')) {
      $candidates=@($links | Where-Object { if ($kind -eq 'Desktop') { $_.DirectoryName -match 'Desktop$' } else { $_.DirectoryName -match 'Start Menu' } })
      if (!$candidates.Count) { throw "Missing $kind shortcut." }
      foreach ($link in $candidates) {
        $shortcut=$shell.CreateShortcut($link.FullName)
        if ([IO.Path]::GetFullPath($shortcut.TargetPath) -ne [IO.Path]::GetFullPath($executable)) { throw "The $kind shortcut targets a different executable." }
        if (![string]::IsNullOrWhiteSpace($shortcut.IconLocation)) {
          $icon=$shortcut.IconLocation -replace ',\s*-?\d+$',''
          if (!(Test-Path $icon)) { throw "The $kind shortcut icon file is missing." }
        }
      }
    }
  } finally { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell) | Out-Null }
}
function Test-OWGuideShortcutsRemoved {
  if (@(Find-OWGuideShortcuts).Count) { throw 'Uninstall left an OWGuide shortcut.' }
}
