# 🖥️ Desktop acceptance tests

Use a disposable Windows machine. Build and package the candidate first. Install WebView2 Runtime. Do not point these scripts at a personal installation.

```powershell
node tests/windows-native.mjs
Remove-Item release/OWGuide-1.0.0-portable/OWGuideData -Recurse -Force
./packaging/smoke.ps1
```

The native test launches the packaged portable executable with a test-only WebView2 debugging port. It connects Playwright to the real desktop windows and requires Tauri IPC. It checks offline reload, five guide tabs, SQLite notes and favorites, changes between windows, native maximize/restore/resize, horizontal scrolling, automatic accessibility rules, restart persistence, and independent Quick Reference dimensions. Network name resolution is disabled for that child process; WebView2 is also put offline during interaction. The app itself does not enable remote debugging.

Screenshots, failures, and a report containing the exact commit are saved under `test-results/native-windows`. CI uploads these files. The maintenance script then installs, removes and repairs a real installed executable, checks saved notes and favorites, uninstalls while keeping personal data, and verifies portable database isolation.

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
