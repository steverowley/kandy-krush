#!/usr/bin/env bash
# Sweet Match — test runner shortcut.
# Same as `node --test tests/*.test.js` but a single short token, and
# always run from the repo root regardless of where you invoke it.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
exec node --test tests/*.test.js
