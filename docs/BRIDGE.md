# CLI bridge

`tools/serve.js` serves the game on http://localhost:4747 and relays commands:

```
frontier CLI ──POST /bridge/cmd──▶ serve.js ──SSE "cmd"──▶ game tab (js/bridge.js)
             ◀── JSON result ───           ◀─POST /bridge/result─
```

- Commands return `{ ok, text, data }`. `--json` prints `data`.
- The bridge connects only when the page is served from localhost. File and GitHub Pages builds ignore it.
- The newest connected tab receives commands. Timeout is 20s.
- `./frontier help` lists commands. Names match fuzzily (`enact "consumer app" 60`).
- `frontier say "<text>"` shows a note in the in-game Chief of Staff panel. Claude Code uses
  this to give advice in-game (see `CLAUDE.md`).

Adding a command: add a `case` in `B.exec` in `js/bridge.js`. If it changes state, go through
`FL.UI` helpers (`policyChange`, `refresh`, `act`) so the board re-renders and the game saves.
