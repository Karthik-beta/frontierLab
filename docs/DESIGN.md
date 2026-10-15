# Design notes

## Pillars
1. **Democracy's structure, an AI lab's tradeoffs.** Everything is a slider with costs, lags and
   side effects on stakeholders.
2. **History rhymes.** Pitfalls, events and archive cards are grounded in real AI lab and startup
   history, sourced and verified. Triumphs and disasters both get told.
3. **Readable systems.** Hover any node to see its wiring. Warning signs telegraph pitfalls
   before they fire. No hidden gotchas without a tell.
4. **Feel.** Sound, motion and celebrations amplify real outcomes and never replace them.

## Systems at a glance
| System | Where | Key knobs |
|---|---|---|
| Effect network | `js/data/stats.js`, `policies.js`, `stakeholders.js`, `situations.js` | edge `k`, `lag`, stat `base` |
| Money | `engine.js` `computeFinances`, `valuation`, `fundingRound` | market size, cost scales, raise % |
| Race | `engine.js` `advanceCapability`, `advanceRivals`; `archetypes.js` RIVALS | velocity→gain, rival rates |
| Difficulty | `js/data/difficulty.js` | cash, rival pace, pitfall pace, bridges, coup grace, aligned threshold |
| Pitfalls | `js/data/pitfalls.js` | per-quarter `rate(state, P)`, warnings at 35% / 70%, fire at 100% |
| Hardware | `js/data/hardware.js`, `js/hardware.js` | gen cadence/perf/price, need growth, failure curve, life |
| Hiring | `js/data/hiring.js`, `js/hiring.js` | role stat caps, trait effects, practice/value toxicity |
| Director | `systems.js` `dilemmaChance`, `tension` | base chance per era, quiet-streak boost, high-tension cooldown |
| Objectives | `js/data/progression.js` | templates, deadlines, rewards |

## Balance workflow
`npm run sim` runs four bots (idle, random, sensible, adaptive) across all origins. Use
`DIFFICULTY=easy|normal|realistic`. Rough targets for the adaptive bot:
- **Easy:** mostly wins.
- **Normal:** a real mix of outcomes, with Safety Defectors the most winnable.
- **Realistic:** frequent bankruptcies and coups, but winnable.

`node tools/simulate.js 1 <origin>:<bot>:<seed>` prints a quarter-by-quarter trace.

## Endings
Aligned AGI, Uneasy Victory, Misaligned, Second Place (a rival hits 100), Out of Money,
Fired by the Board, Shut Down (3 quarters of injunction), Acquihired, and A Decade Later (turn 40).
