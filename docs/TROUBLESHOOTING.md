# 🩺 Fix common problems

**The app cannot load personal data.** It shows an error instead of resetting the database. Close OWGuide and back up its data folder before repairing anything. A future-schema database needs a compatible app version.

**Another window changed your data.** The database rejected a conflicting save. Reloaded state contains the other window's change. Keep your note draft and retry the save.

**Content update is unavailable.** This candidate has no publisher key or public feed. Configure a real publisher and compile its public key first. A failed download leaves offline data unchanged.

**Import failed.** Backups must use a supported schema and fit within 2 MiB. Unknown fields or versions are rejected. Your existing data is not replaced on a validation failure.

**Portable launch fails.** Extract the whole ZIP into a writable folder. Keep the marker. Install Microsoft's WebView2 Runtime if missing. Do not store the app in a protected Program Files folder.

**A map has no drawing.** Accurate licensed artwork and tactical coordinates are missing. The text fallback is deliberate; it does not invent a layout.

**A counter is unranked.** No reviewed data supports that combination. You may explicitly include archived advice, but it remains marked as stale and low confidence.

**Windows Installer repair fails.** Keep its error code and logs. Repair must run against the installed product's MSI. Do not assume the NSIS wrapper alone provides repair; it delegates to Windows Installer. Native maintenance checks are still required.

**Development dependency installation fails.** Use the pinned tool versions and lockfiles. In this cloud instance, use a writable npm cache such as `/workspace/.npm-cache`. Never disable TLS or package integrity verification to fix an install.

## 🩺 Setup error details

If the maintenance wrapper reports a Windows Installer error, read `%TEMP%\OWGuide-setup.log`. It records the last operation. Error 1603 is a general installer failure; the nearby failed action in the log explains more. Keep personal data until the cause is understood. The wrapper does not silently delete it after a failed MSI operation.
