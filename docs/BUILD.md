# 🔨 Build and check

## 🐧 Linux development

Install Node 24.19.0, Rust 1.99.0, a C compiler, GTK 3, WebKitGTK 4.1, librsvg, and the app-indicator development packages. Then run the commands in the README. The lockfiles are committed. Use `npm ci` and Cargo's `--locked` option.

In the prepared cloud instance, Rust is in `/workspace/toolchains/cargo/bin`. Set `RUSTUP_HOME=/workspace/toolchains/rustup` and `CARGO_HOME=/workspace/toolchains/cargo`. Desktop development libraries were downloaded with Debian's signature checks and extracted under `/workspace/owguide-sysroot`. Set:

```sh
export PATH=/workspace/toolchains/cargo/bin:$PATH
export RUSTUP_HOME=/workspace/toolchains/rustup
export CARGO_HOME=/workspace/toolchains/cargo
export PKG_CONFIG_PATH=/workspace/owguide-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/workspace/owguide-sysroot/usr/share/pkgconfig
export PKG_CONFIG_SYSROOT_DIR=/workspace/owguide-sysroot
```

This local sysroot is a development aid, not a Windows distribution requirement.

## 🏁 Windows x64

Use Windows 10/11 x64, Node 24.19.0, Rust 1.99.0 MSVC, Visual Studio C++ build tools, and WebView2. NSIS 3.11 compiles the maintenance wrapper. Tauri downloads the required WiX tools with its normal verification.

```powershell
npm ci
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib
npm run tauri -- build --bundles msi
choco install nsis --version=3.11 -y --no-progress
python scripts/notices.py
./packaging/package.ps1
./packaging/smoke.ps1
./packaging/finish.ps1
```

Run `smoke.ps1` only on a disposable machine with no existing OWGuide user data. It installs and removes OWGuide. It stops only the app processes it starts. It verifies MSI file repair and folder preservation; it is not a GUI test of the wrapper's radio buttons or delete-data checkbox.

`Windows packages` is a manual Actions workflow for candidate artifacts. `Check and build` runs on feature-branch pushes and pull requests. The release workflow requires live content, recorded GUI acceptance, audits, UI tests, and Windows smoke checks before publishing.

## 🖋️ Optional signing

Set repository secrets `OWGUIDE_CERTIFICATE_BASE64` and `OWGUIDE_CERTIFICATE_PASSWORD` to an authorized Authenticode certificate. Only the protected release job uses them. Its scripts verify the resulting signatures. Unsigned artifacts are labeled in the release manifest. No signing has been performed in the cloud instance.

Set `OWGUIDE_CONTENT_PUBLIC_KEY` as a repository variable only after establishing your own content publisher. It is a base64 raw 32-byte Ed25519 public key. Do not put a private key in the source tree or build variables.

The app binary updater is not implemented. Signed installer artifacts are not an app updater. Binary upgrades currently require downloading a verified release and running the installer.

## 🧷 Repeatability

Node, Rust, action commits, NSIS, and dependency lockfiles are pinned. Manifests record the source commit and workflow run. Tauri's downloaded build tools and OS runner images can change; byte-identical build reproducibility has not been established. Hashes describe the actual finished artifacts, not a promised future build.
