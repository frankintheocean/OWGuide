#!/usr/bin/env bash
# ☁️ Reproduce the prepared Debian cloud tools without changing system files.
set -euo pipefail
cd /workspace/OWGuide
export RUSTUP_HOME=/workspace/toolchains/rustup
export CARGO_HOME=/workspace/toolchains/cargo
export PATH="$CARGO_HOME/bin:$PATH"
if ! command -v rustup >/dev/null; then
  curl --fail --show-error --silent --location https://sh.rustup.rs -o /tmp/owguide-rustup.sh
  sh /tmp/owguide-rustup.sh -y --no-modify-path --profile minimal --default-toolchain 1.99.0
fi
rustup toolchain install 1.99.0 --profile minimal --component rustfmt --component clippy
npm ci --cache /workspace/.npm-cache --no-fund
# Debian verifies signed indexes and package checksums before extraction.
mkdir -p /workspace/.apt/lists/partial /workspace/.apt/cache/archives/partial /workspace/owguide-sysroot
cat > /tmp/owguide-apt.list <<'SOURCES'
deb https://deb.debian.org/debian trixie main
deb https://deb.debian.org/debian trixie-updates main
deb https://security.debian.org/debian-security trixie-security main
SOURCES
apt_options=(-o Dir::Etc::sourcelist=/tmp/owguide-apt.list -o Dir::Etc::sourceparts=/tmp/no-apt-sources -o Dir::State::lists=/workspace/.apt/lists -o Dir::Cache::archives=/workspace/.apt/cache/archives -o Debug::NoLocking=1)
apt-get "${apt_options[@]}" update
apt-get "${apt_options[@]}" --download-only -y install libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev
for package in /workspace/.apt/cache/archives/*.deb; do dpkg-deb -x "$package" /workspace/owguide-sysroot; done
python3 - <<'PY'
import pathlib
root=pathlib.Path('/workspace/owguide-sysroot/usr/lib/x86_64-linux-gnu')
for system in pathlib.Path('/usr/lib/x86_64-linux-gnu').glob('*.so*'):
    target=root/system.name
    if not target.exists() and not target.is_symlink():target.symlink_to(system)
PY
export PKG_CONFIG_PATH=/workspace/owguide-sysroot/usr/lib/x86_64-linux-gnu/pkgconfig:/workspace/owguide-sysroot/usr/share/pkgconfig
export PKG_CONFIG_SYSROOT_DIR=/workspace/owguide-sysroot
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked --no-default-features --lib
cargo check --manifest-path src-tauri/Cargo.toml --locked
