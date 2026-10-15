# Multiplayer

Real time and peer to peer, with no game server to pay for.

## How it works
- **Transport** (`js/net.js`):
  - **Online:** WebRTC data channels via [PeerJS](https://peerjs.com/), loaded lazily from a pinned
    CDN build. The free public PeerJS broker only introduces the browsers; game traffic goes
    browser-to-browser.
  - **Same browser:** a `BroadcastChannel` between tabs, for couch play and testing.
- **Lobby** (`js/multiplayer.js`): the host creates a six-character room code and an invite link
  (`?join=CODE`). Guests join with a name, company and origin. The host can add AI labs, which
  play full company simulations with the adaptive bot from `js/bots.js`. The host also picks the
  difficulty, the speed, and whether the classic AI rivals join.
- **Real time:** every lab's simulation runs continuously in its owner's browser. The host's game
  clock is the shared clock: the host broadcasts its week and speed about once a second, and
  guests follow it. There's no pause and no turn barrier, and decisions expire on schedule for
  everyone.
- **Fog:** only public information leaves your browser: your last released model generation
  (capability rounded down to the last multiple of 10), your valuation and your latest headline.
  Other players see you as an estimate with error bars, exactly like the AI rivals.
- **The race:** the first lab to capability 100 ends the race for everyone else ("Second Place").
- **Claude:** each player's browser can be driven by that player's own Claude Code through the CLI
  bridge (`./frontier status`, `./frontier inbox`, `./frontier lobby`, `./frontier chat`). So
  "my Claude versus your Claude" works, under the same fog and the same clock.

## Limits and next steps
- Some networks (strict NATs) block direct WebRTC. Adding a TURN server would fix this, but it costs money.
- The host is the clock. If the host leaves, the match ends for everyone (no host migration yet).
- Interactions between players are limited to the race and public information for now. Next:
  poaching each other's staff, bidding on the same compute deals, targeted leaks, alliances,
  and espionage.
- There's no cheating protection: each client simulates itself. That's fine among friends.
