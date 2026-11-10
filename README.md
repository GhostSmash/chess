# Game Review

A chess game analysis site that runs entirely in the browser: paste a PGN, get an engine evaluation, a move-by-move classification (Brilliant, Best, Inaccuracy, Mistake, Blunder), an evaluation graph, sound effects and a practice mode. Plain HTML, CSS and JavaScript, so it deploys to GitHub Pages as is.

## Features

- PGN import (parsing and move validation by chess.js)
- Stockfish 18 running locally in a Web Worker, with nothing sent to a server
- Win-probability based move classification with a Brilliant animation (pulse, particles, sound)
- Evaluation bar, clickable evaluation graph and optional best-move arrow
- "Find the best move" practice mode and keyboard navigation (left and right arrows)

## Quick start

```bash
bash scripts/fetch-assets.sh          # lite engine (about 7 MB)
bash scripts/fetch-assets.sh --full   # also the full single-threaded engine
python3 -m http.server 8000           # then open http://localhost:8000
```

The page must be served over HTTP: opening `index.html` directly from disk will not load the engine.

## Deploy to GitHub Pages

Commit the `assets/` folder, then enable Pages in Settings, Pages, Deploy from branch (`main`, root).

## Choosing an engine

| Engine | Size | Strength | Notes |
| --- | --- | --- | --- |
| Stockfish 18 Lite (single-thread) | about 7 MB | good | Default. Fast to load, works on phones |
| Stockfish 18 Full (single-thread) | large | strongest available here | Slower to start; analysis may take minutes on weak devices |

Only single-threaded builds are used because GitHub Pages cannot send the headers that multi-threaded WebAssembly needs. Processing power is therefore limited to one CPU thread; lower the depth slider if analysis is slow.

## How moves are classified

Evaluations are converted to win probability. A move is rated by how much win probability the mover loses compared with the engine's best line. A move is rated Brilliant when it loses almost nothing, gives up material to a capture, and the position is neither already won nor lost afterwards. There is no opening book yet, so "Book" moves are not detected.

## Screenshots

Screenshots will be added in `docs/` once the assets are in place.

## Credits and licence

See [CREDITS.md](CREDITS.md). Stockfish.js is GPLv3, so this project is released under GPLv3 as well.
