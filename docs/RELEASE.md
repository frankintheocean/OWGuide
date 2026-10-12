# 🚀 OWGuide v1.0.0 release checklist

No final release has been published. This file is the notes template used only after acceptance passes.

OWGuide provides an offline Windows field guide with hero selection, strategy tools, personal notes, and transparent recommendation evidence.

Before publishing, record the verified live roster and patch, finish all hero and supported-map guides, run CI, and complete the native Windows checklist. Run the installer, repair, uninstall, portable, offline WebView2, accessibility, DPI, and multi-monitor checks. Store real reviewer evidence in `content/production-acceptance.json`; do not set flags merely to bypass the gate.

Planned final files:

- `OWGuide-1.0.0-x64-setup.exe` — install and maintenance wrapper.
- `OWGuide-1.0.0-x64.msi` — Windows Installer package with file repair.
- `OWGuide-1.0.0-portable.zip` — portable app and prerequisite launcher.
- `SHA256SUMS.txt` and `release-manifest.json` — actual artifact hashes and build details.
- `windows-validation.json`, license reports, and verification notes — evidence and rights.

Users do not need developer tools. WebView2 Runtime is required. The release manifest states whether each executable is signed. Do not describe unsigned files as signed. Binary updates are manual until a verified updater is implemented.

## 🧑‍🔬 Record native acceptance

After running the real Windows checks, get the build fingerprint with `node scripts/acceptance.mjs --print-tree`. Record it with the actual reviewer, date, observed evidence references and summaries, and check outcomes in `content/production-acceptance.json`. The fingerprint covers the frontend, Rust backend, packaging, test and content tools, native checklist, schemas, lockfile, and workflows. Each passed check needs an evidence entry with `method` (`manual` or `automated`), `reference` and `summary`. Do not mark an unrun check true.
