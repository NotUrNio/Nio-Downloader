#!/usr/bin/env bash
set -euo pipefail

# The official Arch Linux image is x86_64. ARM archives are inspected by the
# cross-platform verifier on their native build runner, not run under emulation.
artifact_dir="$(cd "${1:?Expected release directory}" && pwd)"
shopt -s nullglob
packages=("$artifact_dir"/*-x64.pacman)
if (( ${#packages[@]} != 1 )); then
  echo 'Expected exactly one x64 pacman package' >&2
  exit 1
fi

docker run --rm --platform linux/amd64 \
  --mount "type=bind,src=$artifact_dir,dst=/artifacts,readonly" \
  --env "NIODOWNLOADER_PACKAGE=/artifacts/$(basename "${packages[0]}")" \
  archlinux:base bash -euo pipefail -c '
    pacman -Syu --noconfirm
    pacman -U --noconfirm "$NIODOWNLOADER_PACKAGE"
    pacman -Qk niodownloader
    test "$(readlink -f /usr/bin/niodownloader)" = "/opt/Nio Downloader/niodownloader"
    test -f /usr/share/applications/niodownloader.desktop
    test -f /usr/share/icons/hicolor/256x256/apps/niodownloader.png
    test "$(cat "/opt/Nio Downloader/resources/package-type")" = pacman
    ldd "/opt/Nio Downloader/niodownloader" > /tmp/niodownloader-ldd.log
    cat /tmp/niodownloader-ldd.log
    if grep -q "not found" /tmp/niodownloader-ldd.log; then
      echo "Packaged Electron has unresolved runtime dependencies" >&2
      exit 1
    fi
    "/opt/Nio Downloader/resources/extra/linux/x64/aria2c" --version
    # Reinstallation exercises post_upgrade as well as post_install.
    pacman -U --noconfirm "$NIODOWNLOADER_PACKAGE"
    test -x /usr/bin/niodownloader
    pacman -R --noconfirm niodownloader
    test ! -e "/opt/Nio Downloader"
    test ! -e /usr/share/applications/niodownloader.desktop
    test ! -L /usr/bin/niodownloader
  '
