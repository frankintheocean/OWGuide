# 🖥️ Desktop acceptance tests

Use a disposable Windows machine. Build and package the candidate first. Install WebView2 Runtime. Do not point these scripts at a personal installation.

```powershell
node tests/windows-native.mjs
Remove-Item release/OWGuide-1.0.0-portable/OWGuideData -Recurse -Force
./packaging/smoke.ps1
./packaging/wrapper-smoke.ps1
```

The native test launches the packaged portable executable with a test-only WebView2 debugging port. It connects Playwright to the real desktop windows and requires Tauri IPC. It checks offline reload, five guide tabs, SQLite notes and favorites, changes between windows, native maximize/restore/resize, horizontal scrolling, automatic accessibility rules, restart persistence, and independent Quick Reference dimensions. Network name resolution is disabled for that child process; WebView2 is also put offline during interaction. The app itself does not enable remote debugging.

Screenshots, failures, and a report containing the exact commit are saved under `test-results/native-windows`. CI uploads these files. The setup UI script uses only the test process’s controls. It exercises the wrapper’s install, repair, retain-data uninstall and explicit delete-data choice. It records failures and actual outcomes separately; UAC and physical Windows 10/11 behavior remain manual checks.

The maintenance script then installs, removes and repairs a real installed executable, checks saved notes and favorites, uninstalls while keeping personal data, and verifies portable database isolation.

## 🧑‍🦯 Checks that need a person

Run on both Windows 10 and Windows 11. Record the OS build, executable hash, tested commit, reviewer, date, screenshots or logs, and observed result for each check. A Windows Server CI runner does not establish either desktop OS result.

- Turn networking off before launch, with WebView2 already installed. Browse guides and save notes after restart.
- Move the main and compact windows between monitors at different scales. Maximize and restore each; disconnect a monitor and relaunch. Check visible placement, text, focus and scrolling.
- Use keyboard navigation and a screen reader. Confirm names, focus order, tabs, filters, save results and errors can be understood.
- Run setup normally. Check Start Menu and Desktop links, app registration and icon. Damage an installed file and use the wrapper's Repair option. Confirm notes survive.
- Uninstall through the wrapper with data retention, then reinstall. Repeat with the explicit delete-data option and check only the chosen app data is removed.
- Run the portable launcher from a read-only directory. Check the error is visible and installed app state stays untouched. Try missing WebView2 on a fresh machine and check the prerequisite message.
- Review Tauri permissions, update signatures, import limits, source opening and error recovery. Do not record a security review based only on a successful build.

Record only observed passes in `content/production-acceptance.json`. Physical screen-reader and monitor checks remain separate from automatic accessibility scans.

## 🧭 Check a downloaded candidate without developer tools

A candidate is for testing and is not the final release. Download the Windows candidate artifact from the linked GitHub Actions run and extract it. Read its manifest and checksum file first. You do not need Node.js, Rust, Python or Git to run the packaged app.

1. Compare the downloaded files with `SHA256SUMS.txt`, using PowerShell `Get-FileHash <file> -Algorithm SHA256`.
2. Extract the portable ZIP into a writable folder. Use its launcher to check WebView2 and start OWGuide. If the runtime is missing, follow the launcher's prerequisite instructions.
3. Save a note, favorite a hero and complete a drill. Close both windows, turn networking off, then reopen and confirm the saved data and guides are available.
4. Resize both windows, maximize and restore the main window, and reopen the compact window. Check its saved size and placement. Try different monitor scales if those monitors are available.
5. Use the setup EXE to install, then check both shortcuts. Save a different installed-app note. Close OWGuide, remove only the installed executable, and choose Repair in setup. Confirm the executable and note are restored.
6. Choose Uninstall while retaining personal data. Reinstall and confirm the note. Then uninstall with the explicit delete-data checkbox. Portable notes should remain in their separate folder.
7. Record the commit from the manifest, file hashes, Windows build shown by `winver`, date, and results. Include any failed action and visible error. Report missing hardware or unchecked screen-reader behavior rather than recording a pass.

Automated scripts above require a build environment; these manual steps do not. Windows 11 results cannot replace the separate Windows 10 requirement.
