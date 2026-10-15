# Adding content

## Policies, stats, situations
Add to the relevant `js/data/*.js` file. Ids must be unique across all node types (enforced at load).
Edges are `[targetId, k, lag, curve]`. Run `npm test` (it validates every edge) and `npm run sim`.

## Dilemmas and bloopers
`js/data/dilemmas.js` and `js/data/bloopers.js`. `when(state)` must return a boolean. Options support
`fx` shocks, `cash` (`scaleCash` scales it with company size), `bandwidth`, `cap`, `rivalCap`, `enact`, `cancel`,
`chance {p, win, lose}`, `special`, `spawnRival`, `dropPractice`.

## Pitfalls
`js/data/pitfalls.js`. Give each a `horizon`, two `warn` lines, factual `history`, a one-line `lesson`,
`rate(state, P)` (per-quarter meter change; `P(id)` is policy strength), and an `event`. Keep history
text factual and sourced. Put direct quotes in archive cards instead.

## Archive artifacts and achievements (real-world content)
1. Research and verify. Every card needs a source URL. Only use a direct quote when the exact wording
   is verified; otherwise set `quote: null, paraphrase: true` and describe it.
2. Add it to the research JSON in `tools/research/`.
3. Map it to an in-game trigger key in `tools/build_archive.py`. Valid keys are listed in
   `test/systems.test.js` (`validTrigger`).
4. Run `python3 tools/build_archive.py && npm test`.

The labs, chips, providers and candidates you meet in play are fictional. Real people and companies
appear only in sourced archive cards, pitfall history notes and achievement descriptions.
