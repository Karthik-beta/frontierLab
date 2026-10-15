# TODO

Living roadmap. Newest decisions at the top of each section. See `docs/` for how things work.

## In progress
- [ ] Post the launch drafts in docs/launch/ (needs the owner; not automated)
- [ ] Set the repo's social preview image to assets/social-preview.png (GitHub Settings → General; no API)

## Next: Plague Inc-style world layer
- [ ] World map: adoption spreads region by region (US, EU, China, India, Gulf, LatAm, Africa, SEA) with different appetites
- [ ] Regions react on their own: probes, bans, AI acts (like countries closing borders), sovereign AI programs
- [ ] A global "treaty" progress bar, like Plague Inc's cure: if it completes, frontier scaling is frozen
- [ ] Clickable opportunity bubbles on the map (bandwidth, intel, talent) that expire if ignored
- [ ] Map-based fog: what each region knows about you and your rivals

## Next (multiplayer)
- [ ] Player-to-player interactions: poach staff, bid on the same compute deals, targeted leaks, alliances
- [ ] Host migration and reconnect-to-match
- [ ] Optional TURN server for strict NATs
- [ ] Spectator mode and an end-of-match comparison screen

## Next
- [ ] Rival labs that act (launch, poach, cut prices, lobby, have their own scandals), not just a capability number
- [ ] Funding rounds you take part in (pitch, choose dilution, make promises to investors that come back to bite)
- [ ] Executive team / cabinet: Chief Scientist, Head of Safety, CFO with loyalty and agendas (builds on hiring)
- [ ] Overlapping stakeholder membership and polling (Democracy-style voter model)
- [ ] Tutorial / advisor for the first 4 quarters
- [ ] Stats screen after each game (charts for every value), multiple save slots
- [ ] More dilemmas and situations so runs don't repeat (target 60+ events)
- [ ] Geopolitics: export controls, chip supply shocks, sovereign AI programs
- [ ] Mobile layout pass for the board

## Ideas / maybe
- [ ] Daily seeded challenge (same seed for everyone, compare scores)
- [ ] Mod support: load extra `js/data` packs from a URL
- [ ] Steam/itch.io build (Electron or Tauri wrapper)
- [ ] Localization (Italian first)

## Done
- [x] True real time: weekly ticks, no turns, decision inbox with deadlines and defaults, speed control, live events and newspaper feed
- [x] Fog of war: rival estimates from releases, leaks and intel; safety as an eval estimate; trust as a poll; qualitative effects with confidence; Competitive Intelligence policy
- [x] Hidden worlds: randomized effect strengths and 2-3 secret traits per run, with unreliable analyst notes; revealed at the end
- [x] Real-time multiplayer: host clock, public-only snapshots
- [x] Peer-to-peer multiplayer: lobbies, invite links, AI lab seats, chat, shared race, CLI support
- [x] In-game marketing: Brand stat, Marketing category, 9 campaigns with quarter-end results, launch-day strategy, PR damping
- [x] Marketing for the game: GitHub Pages, press kit, launch drafts, share-your-run, screenshots + social preview, meta tags
- [x] Real quotes everywhere: loading screen, between-quarter card, newspaper quote column, "From the archives"
- [x] Public GitHub repo + GitHub Pages build
- [x] CLI bridge (`./frontier`), Claude Code companion guide, advisor panel
- [x] LinkedIn-style recruiting, hiring managers, practices, culture values (Uber's 14), toxicity, culture pitfalls
- [x] GPU fleet: generations, build delays, failures (bathtub curve), depreciation, power, compute deals
- [x] Easy / Normal / Realistic
- [x] 18 historical pitfalls (short/medium/long), warning signs, risk radar
- [x] Archive (134 verified artifacts), 64 achievements, objectives, eras, event director, headlines
- [x] Synthesized audio, game-feel effects, milestone celebrations
- [x] Core Democracy-style sim: 40 policies, stats web, stakeholders, situations, dilemmas, funding, endings
