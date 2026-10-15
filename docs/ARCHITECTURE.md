# Architecture

Plain HTML/CSS/JS, with no build step and no runtime dependencies. Every script attaches to `globalThis.FL`, so
the same simulation files run in the browser and under node (`test/load.js` loads them into a `vm` context).

```
index.html
├── js/data/*.js        content + tuning (pure data, a few predicate functions)
├── js/engine.js        core sim: state, effect network, finances, race, funding, endings, endTurn
├── js/systems.js       pitfalls, archive/achievement triggers, milestones, objectives, eras, director, headlines
├── js/hardware.js      GPU fleet → registers an input into Compute Capacity
├── js/hiring.js        people, practices, values, toxicity → registers an input into several stats
├── js/audio.js / fx.js synthesized sound, game-feel effects (no effect on the sim)
├── js/ui.js            board (SVG), panels, modals; owns the game state in the browser
├── js/bridge.js        executes CLI commands against the live game (localhost only)
└── js/main.js          boot
tools/serve.js          static server + Server-Sent-Events bridge (no deps)
cli/frontier.js         CLI client for the bridge
tools/simulate.js       headless balance bots
tools/build_archive.py  generates js/data/archive.js + achievements.js from tools/research/*.json
```

## The effect network (Democracy's "neural network")

Every policy, stat, indicator, stakeholder and situation is a **node**. Data files declare **edges**
`[target, k, lag, curve]`. Each quarter:

1. Each edge computes `k * curve(sourceValue)` and moves its stored contribution 1/lag of the way
   toward that target (so effects phase in over `lag` quarters).
2. A node's value = base + archetype mods + Σ edge contributions + Σ extra inputs + Σ decaying shocks.
3. Extra inputs come from subsystems registered with `E.registerInput(id, label, fn)`. Currently
   these are the hardware fleet and the team. They show in the inspector as drivers.

Source values: active policy = `0.2 + 0.8 * level`, inactive = 0; stats in [0,1]; stakeholders in [-1,1];
situations 0/1. Curves: `lin`, `sqrt`, `sq`, `ctr` (maps [0,1] to [-1,1]), `inv`.

## Time (`E.tick`)

The game runs in real time. `E.tick(state)` advances one game week (dt = 1/13 quarter). Every rate
(cash, capability, rivals, failures, attrition, pitfall meters, decision arrivals) is per quarter,
scaled by dt. Each tick:

finances → hardware → hiring → marketing → capability + rivals → indicators → network (lags scale with dt) →
shocks decay → situations → bandwidth → bankruptcy/bridge → World (hints) → Fog (intel) → Systems.tick
(milestones, triggers, pitfalls, objectives, era) → decision arrivals → week++ → expire decisions →
quarter boundary every 13 weeks (`E.quarterBoundary`: funding, board, injunction, history, newspaper) →
ending check.

`E.endTurn(state)` runs ticks until the quarter ends. The simulator, bots and tests use it.
The UI runs ticks from a `requestAnimationFrame` loop (2 s per week at 1x) and drains
`state.events` into notifications. Decisions live in `state.inbox` with deadlines; `E.defaultOption`
applies when one expires.

## Hidden world and fog

- `js/world.js`: per-run edge multipliers (0.6–1.4) and 2–3 secret traits (`js/data/world.js`),
  plus analyst notes, about a third of which are false.
- `js/fog.js`: everything the player and the CLI see. Rival estimates come from releases, leaks
  and intel, with error that grows over time. Safety is an eval estimate (biased high without audits)
  and trust is a poll. Effects are qualitative labels whose confidence grows with experience.
  The `lead` indicator, which drives markets, uses the *perceived* race.

## Determinism

All randomness goes through `E.rand(state)` (mulberry32 with its state stored in the save), so a seed plus
a sequence of choices replays identically. The tests rely on this. UI-only randomness (sound, particles,
splash quotes) uses `Math.random`.

## Saves

`localStorage['frontierlab.save.v1']` holds the run. `localStorage['frontierlab.meta.v1']` holds the
cross-run collection (artifacts, achievements). Audio prefs are in `frontierlab.audio`.
