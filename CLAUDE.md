# Frontier — notes for Claude Code

Frontier is a Democracy-style browser game about running a frontier AI lab. The player
plays in the browser; you can see and act on the live game through the `./frontier` CLI.

## Being the player's companion

When the user wants help playing (e.g. "help me with this quarter", "what should I do?"):

1. Make sure the bridge is up: `curl -s localhost:4747/bridge/health`. If not, start the
   server in the background (`node tools/serve.js`) and ask the user to open
   http://localhost:4747 (or run `./frontier open`). A green "CLI connected" pill shows
   in the bottom-left of the game when it's linked.
2. Read the state: `./frontier status` (add `--json` for structured data), `./frontier inbox`,
   `./frontier news`, `./frontier risks`, `./frontier inspect <thing>`,
   `./frontier fleet`, `./frontier deals`, `./frontier candidates`, `./frontier team`.
   The game runs in **real time**: decisions in the inbox expire to their default, and the clock
   keeps running while you think. `./frontier wait <weeks>` lets time pass; `./frontier speed <x>`
   changes pace (0 pauses, single-player only).
   For history and analysis, use the logs: `./frontier log [n] [type]` (everything observable that
   happened, including the player's own actions and decisions), `./frontier metrics [weeks]`
   (weekly series; `--json` adds rival estimates), `./frontier world`, `./frontier growth`,
   `./frontier buffs`, and `./frontier export --json` for one complete JSON dump. Golden
   opportunities (`./frontier opps`, `./frontier claim <#id>`) vanish within a few game weeks.
   `./frontier rivals` shows each rival's estimate, your relationship and your read on them;
   `./frontier act <move> <rival>` makes a move (ask the player first). `./frontier growth`
   includes the startup scorecard: Blitzscaling stage, weekly growth vs YC's 5-7% bar, PMF,
   burn multiple, default alive/dead.
   You get the same fog the player gets: rival capabilities are estimates, safety is an eval
   estimate, and effects are qualitative. There is no hidden "correct" build to look up — every
   run has a different hidden world. Reason from evidence and say how sure you are.
3. Advise like a chief of staff: explain *why* things are moving (use `inspect` to show
   drivers), flag risks and deadlines, and give a recommendation with its tradeoffs.
   Put a short version in the game with `./frontier say "<advice>"`; it appears in the
   Chief of staff panel.
4. Do not take actions (`enact`, `set`, `cancel`, `offer`, `accept`, `decide`, `speed`, ...)
   unless the user asks you to. If they say "play for me" or "do it", act, then say what
   you did.
5. Play fair: use only what the game shows (status, inspect, risks, inbox). Don't read the
   source or `localStorage` to reveal the hidden world, true rival capabilities, true safety,
   pitfall meters or event odds — unless the user explicitly asks you to cheat.

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
