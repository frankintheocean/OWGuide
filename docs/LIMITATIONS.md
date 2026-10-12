# 🚧 Open work before v1.0.0

This is a working development candidate. It does not meet the requested production acceptance yet.

- The official roster and October 6, 2026 retail patch were verified after using Node’s environment proxy. Current map rotation and detailed balance review remain unverified.
- The snapshot contains 54 hero entries and 59 map entries. The hero IDs match the official roster captured on 2026-10-12. The map count does not establish current rotation.
- All 54 heroes have original biography summaries and three-level coaching. Many ability mechanics, passive/ultimate classification, numeric values, map-specific tips, and matchup guides are still missing. Empty sections say so.
- All nine matchup relationships and the single synergy are archived and need balance review. No reviewed map-fit data or full composition coverage is provided. Original hero coaching remains marked as awaiting balance review.
- Official portraits and large hero artwork are not bundled. Original monograms are the current asset fallback. Rights-cleared tactical images and verified coordinates are unavailable.
- Map fallbacks contain clearly labeled mode-level coaching. Map pan/zoom/markers work in a synthetic component test; real game-map annotation accuracy has not been established. The shipped data uses text fallbacks.
- Optional gamepad navigation, large-list virtualization, remote image caching, a deployed content feed, and an automatic signed app updater are not implemented.
- Native Quick Reference window positioning, WebView2 cache isolation, multi-monitor behavior, screen-reader support, Windows runtime failure dialogs, and Windows crash recovery need native validation and remaining implementation. Startup errors now preserve data and use a Windows error dialog, but that path is not Windows-tested.
- MSI maintenance, the EXE wrapper, certificate signing, and portable packaging are configured, but Windows artifacts and install/repair/uninstall behavior have not been verified in this Linux task.
- GitHub API authentication was not working at initial inspection. CI and publishing cannot be claimed until actual remote runs and artifacts are inspected.

The content and production-acceptance gates remain false. Do not create the final tag, merge as production-ready, or advertise v1.0.0 downloads until these requirements are satisfied. This file should be updated from evidence after each remaining check.
