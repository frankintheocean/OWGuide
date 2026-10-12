# ✅ Verification record

Checked in the Linux cloud task on 2026-10-12. Results below describe actual local checks; they do not establish Windows readiness.

| Check                                       | Evidence                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript strict checks and frontend build | Passed locally                                                                                                                              |
| ESLint                                      | Passed locally                                                                                                                              |
| Content schema and references               | Passed: 54 heroes, 278 abilities including two patch passives, 41 numeric values, 59 maps, 9 archived matchups                              |
| TypeScript unit tests                       | 21 passed                                                                                                                                   |
| Rust core tests                             | 14 passed: migration/reopen, conflicts, rollback, transaction failure, signatures, references, portable paths, URLs, future DB version      |
| Browser UI tests                            | 21 browser checks passed, including the complete roster sweep and simulated gamepad input; one redundant small-layout sweep skipped         |
| Native Tauri compile and clippy             | Check, clippy, and native Linux binary build passed with the local Debian sysroot; GUI launch blocked by WebKit’s absolute helper path      |
| npm dependency audit                        | Zero reported vulnerabilities after updating test tools                                                                                     |
| Cargo dependency audit                      | Exit 0; no reported vulnerabilities. Linux GTK-chain warnings RUSTSEC-2024-0370 and RUSTSEC-2024-0429 remain                                |
| Official live roster and patch pages        | Passed: roster IDs and October 6, 2026 patch title match; source hashes recorded                                                            |
| Production content gate                     | Expected to fail; incomplete detailed mechanics, tactical reviews, and map coaching                                                         |
| Windows installer / portable / repair       | Windows app, MSI and EXE wrapper built; native UI check failed, so maintenance/portable checks have not run                                 |
| Windows signature and updater               | No signing credentials or binary updater configured                                                                                         |
| GitHub Actions and Release                  | Linux job passed; Windows notices generation and packaging passed; native UI acceptance failed and is under investigation. No final release |

Browser offline checks reject external requests while allowing the local server. Rust core tests read the embedded seed without a network service. Neither is a substitute for the native Windows WebView2 offline checklist.

Synthetic map component tests use an explicitly labeled test grid. They establish control behavior only, never the truth of game-map coordinates.
