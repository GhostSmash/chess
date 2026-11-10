#!/usr/bin/env bash
# Downloads all third-party assets into assets/. Run once from the repo root: bash scripts/fetch-assets.sh [--full]
set -euo pipefail
cd "$(dirname "$0")/.."
J=https://cdn.jsdelivr.net/npm
L=https://raw.githubusercontent.com/lichess-org/lila/master/public
get() { curl -fsSL "$1" -o "$2" && echo "ok  $2" || echo "MISSING  $2  ($1)"; }
get "$J/chess.js@1.4.0/+esm" assets/lib/chess.js
get "$J/stockfish@18/bin/stockfish-18-lite-single.js"   assets/engine/stockfish-18-lite-single.js
get "$J/stockfish@18/bin/stockfish-18-lite-single.wasm" assets/engine/stockfish-18-lite-single.wasm
if [ "${1:-}" = "--full" ]; then
  get "$J/stockfish@18/bin/stockfish-18-single.js"   assets/engine/stockfish-18-single.js
  get "$J/stockfish@18/bin/stockfish-18-single.wasm" assets/engine/stockfish-18-single.wasm
fi
for p in wP wN wB wR wQ wK bP bN bB bR bQ bK; do get "$L/piece/cburnett/$p.svg" "assets/pieces/$p.svg"; done
# Sounds: Lichess "standard" set mapped to the names the app expects. Check each file's licence in CREDITS.md.
get "$L/sound/standard/Move.mp3"          assets/sfx/move.mp3
get "$L/sound/standard/Capture.mp3"       assets/sfx/capture.mp3
get "$L/sound/standard/Check.mp3"         assets/sfx/check.mp3
get "$L/sound/standard/Victory.mp3"       assets/sfx/end.mp3
get "$L/sound/standard/GenericNotify.mp3" assets/sfx/brilliant.mp3
get "$L/sound/standard/Defeat.mp3"        assets/sfx/blunder.mp3
echo "Done. Serve locally with: python3 -m http.server 8000"
