# 🚧 Open work before v1.0.0

This is a working development candidate. It does not meet the requested production acceptance yet.

- The official roster and October 6, 2026 retail patch were verified after using Node’s environment proxy. Four maps have current availability evidence; the full rotation and detailed balance review remain unverified.
- The snapshot contains 54 hero entries and 59 map entries. The hero IDs match the official roster captured on 2026-10-12. The map count does not establish current rotation.
- All 54 heroes have original biography summaries, qualitative profiles and three-level coaching. The 276 captured profile abilities have original source-based summaries, and two additional passives come from the latest patch. There are 52 sourced numeric values; other values remain missing. Some passive/ultimate classifications, numeric values, map-specific tips, and matchup guides are still missing. Empty sections say so.
- The app now includes 55 current, low-confidence editorial matchup assessments. Most pairs and full good-matchup/counter coverage are missing. The original nine drafts are retained for audit; the single synergy still needs balance review. No reviewed map-fit data or full composition coverage is provided. Original hero coaching remains marked as awaiting balance review.
- Official portraits and large hero artwork are not bundled. Original monograms are the current asset fallback. Rights-cleared tactical images and verified coordinates are unavailable.
- Map fallbacks contain clearly labeled mode-level coaching. Map pan/zoom/markers work in a synthetic component test; real game-map annotation accuracy has not been established. The shipped data uses text fallbacks.
- Standard gamepad navigation is implemented and covered by simulated input tests; physical controller testing remains open. Large saved-note lists use windowed rendering with keyboard navigation. Remote image caching, a deployed content feed, and an automatic signed app updater are not implemented.
- Independent window dimensions and SQLite persistence have native Windows CI coverage on an earlier candidate. Physical multi-monitor behavior, screen-reader support, Windows runtime failure dialogs, and full crash recovery still need validation and remaining implementation. Startup errors now preserve data and use a Windows error dialog, but that path is not Windows-tested.
- Windows CI compiled the app, MSI and EXE wrapper. MSI install/repair/uninstall and portable database isolation passed on a Windows Server CI runner. The corrected native checks passed. The recache correction passed setup GUI repair after the original temporary source was removed. Setup install, shortcut restoration and both uninstall choices passed. Custom navigation shortcuts and final extracted-ZIP startup passed in run 38238477577. New matchup content and headshot support still need Windows CI. Shortcut targets and their explicit/default icon files passed. Certificate signing remains unverified.
- GitHub API access now works. Linux CI passed. MSI maintenance and native WebView2 checks passed; the EXE wrapper install/repair/uninstall checks passed. Native WebView2 tests are now part of Windows CI. No final release has been published.

The content and production-acceptance gates remain false. Do not create the final tag, merge as production-ready, or advertise v1.0.0 downloads until these requirements are satisfied. This file should be updated from evidence after each remaining check.

## 🚦 Required before release

Every hero needs a rights-cleared headshot, substantive reviewed guidance, matchup strengths and weaknesses, good matchups and counters. The current 55-matchup editorial subset and 216 perk facts are useful additions, but do not satisfy that coverage. Tactical map assets, verified annotations and current map coaching are also required. No release may replace these with monograms or generic map notes.
