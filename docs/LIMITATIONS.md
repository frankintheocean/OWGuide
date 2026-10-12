# 🚧 Open work before v1.0.0

This is a working development candidate. It does not meet the requested production acceptance yet.

- The official roster and October 6, 2026 retail patch were verified after using Node’s environment proxy. Current map rotation and detailed balance review remain unverified.
- The snapshot contains 54 hero entries and 59 map entries. The hero IDs match the official roster captured on 2026-10-12. The map count does not establish current rotation.
- All 54 heroes have original biography summaries and three-level coaching. All 276 captured abilities now have original source-based mechanic summaries. Some passive/ultimate classifications, numeric values, map-specific tips, and matchup guides are still missing. Empty sections say so.
- All nine matchup relationships and the single synergy are archived and need balance review. No reviewed map-fit data or full composition coverage is provided. Original hero coaching remains marked as awaiting balance review.
- Official portraits and large hero artwork are not bundled. Original monograms are the current asset fallback. Rights-cleared tactical images and verified coordinates are unavailable.
- Map fallbacks contain clearly labeled mode-level coaching. Map pan/zoom/markers work in a synthetic component test; real game-map annotation accuracy has not been established. The shipped data uses text fallbacks.
- Standard gamepad navigation is implemented and covered by simulated input tests; physical controller testing remains open. Large-list virtualization, remote image caching, a deployed content feed, and an automatic signed app updater are not implemented.
- Native Quick Reference window positioning, WebView2 cache isolation, multi-monitor behavior, screen-reader support, Windows runtime failure dialogs, and Windows crash recovery need native validation and remaining implementation. Startup errors now preserve data and use a Windows error dialog, but that path is not Windows-tested.
- MSI maintenance, the EXE wrapper, certificate signing, and portable packaging are configured, but Windows artifacts and install/repair/uninstall behavior have not been verified in this Linux task.
- GitHub API access now works. The prior Linux CI job passed. Windows compiled the app and MSI but failed during notices generation; that encoding path has been corrected and awaits another run. Native WebView2 tests are now part of Windows CI. No final release has been published.

The content and production-acceptance gates remain false. Do not create the final tag, merge as production-ready, or advertise v1.0.0 downloads until these requirements are satisfied. This file should be updated from evidence after each remaining check.
