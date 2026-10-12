# 🧭 OWGuide

OWGuide is an independent Windows hero guide and strategy companion for Overwatch. It uses Tauri 2, React, TypeScript, Rust, and SQLite.

**Status: development candidate, not a production v1.0.0 release.** The app works with offline content and verified official hero metadata. The official roster and latest patch title were verified. Detailed balance review, map rotation, and Windows release acceptance remain unfinished. No installer download or released binary is claimed.

## 🎮 What works

- Hero selector with search, role filters, sorting, keyboard and standard gamepad navigation, and original role graphics.
- Five guide sections for each of 54 official roster entries. All 54 have original profiles and coaching; 278 abilities include 52 sourced numeric facts. Missing content is clearly labeled.
- Counter Picker with deterministic scores, role filters, team selection, synergy evidence, confidence, and missing-evidence states. Stale advice is excluded unless you select it.
- A library of 59 snapshot map entries with honest text fallbacks. Map geometry is not invented.
- Favorites, recent guides, three-hero comparison, notes, named strategies, guide/map bookmarks, practice progress, and a configurable dashboard.
- Themes, motion and quality settings, text size, contrast, selection sounds, and configurable search/page/Quick Reference shortcuts.
- Validated personal-data backups and v0 → v1 import migration.
- SQLite migrations, atomic signed-content installation, rollback, and a separate Quick Reference window.

The browser development mode uses browser storage. The desktop app uses SQLite. Their data is separate.

## 🛠️ Start developing

Use the existing checkout. A cloud task is already isolated; do not create a worktree unless explicitly requested.

You need Node 24.19.0 and Rust 1.99.0. Windows builds also need Visual Studio C++ tools and WebView2. Linux desktop builds need GTK 3 and WebKitGTK 4.1 development packages.

```sh
npm ci
npm run dev                 # Browser development
npm run tauri -- dev        # Desktop development
```

```sh
npm run typecheck
npm run lint
npm run test
npm run content:validate
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-targets -- -D warnings
npx playwright install chromium
npm run test:e2e
```

For an existing system Chromium, set `OWGUIDE_CHROMIUM` to its executable path. The UI tests block external requests while keeping the local development server reachable. They do not prove native WebView2 offline launch.

## 🗂️ Files

| Folder                 | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `src/components`       | 🧩 Shared screens and controls                             |
| `src/domain`           | 🧮 Typed data, search, storage bridge, and recommendations |
| `src/data`             | 📚 Attributed offline content snapshot                     |
| `src-tauri/src`        | 🦀 Desktop commands, database, and signature checks        |
| `src-tauri/migrations` | 🗃️ Database changes                                        |
| `content`              | 🔎 Schemas and release-review records                      |
| `scripts`              | 🔧 Content, source, and license tools                      |
| `tests`                | 🧪 Unit and browser checks                                 |
| `packaging`            | 📦 Windows install, repair, portable, and smoke scripts    |
| `.github/workflows`    | ⚙️ CI, candidate packages, and gated releases              |
| `docs`                 | 📖 Build, trust, and verification notes                    |

## 🔗 Read next

[Build](docs/BUILD.md) · [Architecture](docs/ARCHITECTURE.md) · [Content publishing](docs/CONTENT.md) · [Portable edition](docs/PORTABLE.md) · [Verification](docs/VERIFICATION.md) · [Known gaps](docs/LIMITATIONS.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Asset rights](docs/ASSETS.md)

## ⚖️ Rights

The repository keeps its original GPL-3.0 license. OWGuide is not affiliated with Blizzard. Overwatch and hero names belong to their owners. No Blizzard images, map screenshots, audio, or proprietary fonts are bundled. The interface requests a system font; SF Pro is used only when already available. See [asset provenance](docs/ASSETS.md).
