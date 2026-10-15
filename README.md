# Frontier

A Democracy-style management sim about founding a frontier AI lab. Same structure as
Positech's *Democracy*: policies on sliders, a web of lagged cause-and-effect between
simulation values, stakeholder "voter groups", emergent situations and one-off dilemmas,
except you're running a hyperscaler LLM company instead of a country.

## Play

```sh
open index.html        # or: npm start
```

No build step or server. Plain HTML/JS, and it autosaves to localStorage.

## How it maps to Democracy

| Democracy            | Frontier                                                          |
|----------------------|-------------------------------------------------------------------|
| Political capital    | Bandwidth (leadership attention)                                  |
| Policies & sliders   | 40 policies in 6 categories (research, compute, talent, ...)      |
| Simulation values    | 15 stats (compute, talent, safety, hype, regulatory heat, ...)    |
| Voter groups         | 10 stakeholders (board, investors, researchers, regulators, ...)  |
| Elections            | Funding rounds every 6 quarters (investor confidence)            |
| Assassination        | Board coup                                                        |
| Situations           | Talent exodus, GPU shortage, injunctions, jailbreaks, viral hits  |
| Dilemmas             | Hyperscaler deals, Pentagon contracts, deceptive evals, ...       |
| Win condition        | Reach AGI (capability 100) first, with enough safety maturity     |

## Layout

- `js/data/*.js`: all game content and tuning numbers (edit these to rebalance)
- `js/engine.js`: pure simulation, no DOM
- `js/ui.js`: radial board, side panels, modals
- `tools/simulate.js`: headless balance simulator with bot strategies (`npm run sim`)
- `test/`: engine tests (`npm test`)
