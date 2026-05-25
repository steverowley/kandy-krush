#!/usr/bin/env bash
# Sweet Match — fetch Atkinson Hyperlegible WOFF2 files from the
# Braille Institute's upstream Google Fonts repo, drop them at
# `assets/fonts/`. The CSS @font-face block in styles/main.css
# already references these exact paths.
#
# Run once after cloning. The fonts are open-source (SIL Open Font
# License) so they're safe to commit OR safe to .gitignore (the
# game falls back to system-ui without them).
#
# Usage:
#   ./tools/fetch-fonts.sh
#
# Requires: curl.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/assets/fonts"
mkdir -p "$DEST"

# Upstream: Google Fonts repository. Pinned to the current main HEAD
# so the file paths are stable. WOFF2 builds are committed alongside
# the .ttf masters.
BASE="https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible/main/fonts/webfonts"

curl -fL --retry 3 -o "$DEST/atkinson-hyperlegible-regular.woff2" \
  "$BASE/AtkinsonHyperlegible-Regular.woff2"
curl -fL --retry 3 -o "$DEST/atkinson-hyperlegible-bold.woff2" \
  "$BASE/AtkinsonHyperlegible-Bold.woff2"

echo "Fonts populated:"
ls -lh "$DEST"
