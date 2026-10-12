# 🎒 Portable OWGuide

This document describes the planned Windows package. A portable ZIP has not yet been produced or tested on Windows.

Extract the whole ZIP to a writable folder. Keep `portable.marker` next to `OWGuide.exe`. Start `Launch-OWGuide.cmd`; it checks for WebView2 and a writable data folder before launching. It never asks you to install Node, Rust, Python, or Git.

The app stores its SQLite database and window state in `OWGuideData` beside the executable. The marker selects portable mode. Do not remove the marker: without it the executable uses the normal installed-app data location.

WebView2 Runtime is a Microsoft prerequisite, not included in this candidate. The launcher checks Microsoft's runtime registration. If it is missing, install it from Microsoft's official WebView2 page and retry. The installed edition uses Tauri's runtime bootstrapper.

Move the whole folder to move your portable state. Export a personal-data backup before upgrading. To update, close OWGuide, verify the release checksums, and replace the executable while keeping `portable.marker` and `OWGuideData`. Do not mix an unverified build into a trusted portable folder.

Portable app state does not depend on registry settings. WebView2 detection reads the registry for the Microsoft runtime only. The native WebView's own runtime cache location still needs Windows verification; do not call the edition fully portable until that check passes.
