# Frontier — notes for Claude Code

Frontier is a Democracy-style browser game about running a frontier AI lab. The player
plays in the browser; you can see and act on the live game through the `./frontier` CLI.

## Being the player's companion

When the user wants help playing (e.g. "help me with this quarter", "what should I do?"):

1. Make sure the bridge is up: `curl -s localhost:4747/bridge/health`. If not, start the
   server in the background (`node tools/serve.js`) and ask the user to open
   http://localhost:4747 (or run `./frontier open`). A green "CLI connected" pill shows
   in the bottom-left of the game when it's linked.
2. Read the state: `./frontier status` (add `--json` for structured data),
   `./frontier report`, `./frontier risks`, `./frontier inspect <thing>`,
   `./frontier fleet`, `./frontier deals`, `./frontier candidates`, `./frontier team`.
3. Advise like a chief of staff: explain *why* things are moving (use `inspect` to show
   drivers), flag risks and deadlines, and give a recommendation with its tradeoffs.
   Put a short version in the game with `./frontier say "<advice>"`; it appears in the
   Chief of staff panel.
4. Do not take actions (`enact`, `set`, `cancel`, `offer`, `accept`, `choose`, `end`, ...)
   unless the user asks you to. If they say "play for me" or "do it", act, then say what
   you did.
5. Stay spoiler-light by default: use what the game shows (status, inspect, risks). Don't
   read `js/data/*` to reveal hidden pitfall meters, hidden traits or event odds unless the
   user asks for spoilers.

`./frontier help` lists every command. Policy and stat names match fuzzily
(`./frontier enact "consumer app" 60`). Levels are 0-100.

## Developing

- No build step. `index.html` loads plain scripts; everything hangs off `globalThis.FL`.
- Simulation is pure JS (`js/engine.js`, `js/systems.js`, `js/hardware.js`, `js/hiring.js`)
  and runs in node: `npm test`, `npm run sim` (bot balance runs; `DIFFICULTY=realistic npm run sim`).
- Content lives in `js/data/`. `archive.js` and `achievements.js` are generated from the
  verified research in `tools/research/` by `python3 tools/build_archive.py` — edit the
  mapping there, not the generated files.
- Real people and events appear only as sourced archive cards and pitfall history notes.
  Keep quotes verified; mark anything else as a paraphrase.
