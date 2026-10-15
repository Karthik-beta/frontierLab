# Multiplayer

Real-time and peer to peer, with no game server to pay for.

## How it works
- **Transport** (`js/net.js`):
  - **Online:** WebRTC data channels via [PeerJS](https://peerjs.com/), loaded lazily from a pinned CDN build.
    The free public PeerJS broker only introduces the browsers; game traffic goes browser-to-browser.
  - **Same browser:** a `BroadcastChannel` between tabs, for couch play and testing.
- **Lobby** (`js/multiplayer.js`): the host creates a six-character room code and an invite link
  (`?join=CODE`). Guests join with a name, company and origin. The host can add AI labs, which
  play a full company simulation with the adaptive bot from `js/bots.js`. The host also picks
  the difficulty, real-time versus turn-based, the seconds per quarter (30/45/60/90), and whether
  the classic AI rivals join.
- **The race:** every player simulates their own lab locally, from a shared seed. After each quarter,
  each client sends a public snapshot (capability, valuation, headline, ending) and the host relays
  them. Other players appear as rival labs in your race. The first lab to capability 100 ends the
  race for everyone else ("Second Place").
- **Clock:** in real time, the host's clock advances a quarter every N seconds. If every human
  presses **Ready**, the quarter advances early. A decision still open when the clock runs out
  gets the default option. The host can pause. In turn-based mode, the quarter advances when
  everyone is ready.
- **Claude:** each player's browser can be driven by that player's own Claude Code through the CLI
  bridge (`./frontier lobby`, `./frontier chat`, `./frontier end` = Ready). So "my Claude versus
  your Claude" works out of the box.

## Limits and next steps
- Some networks (strict NATs) block direct WebRTC. Adding a TURN server would fix this, but it costs money.
- The host is the lobby. If the host leaves, the match ends for everyone (no host migration yet).
- Interactions between players are limited to the race for now. Next: poaching each other's
  staff, bidding for the same compute deals, leaks that boost a specific rival, and alliances.
- There's no cheating protection: each client simulates itself. That's fine among friends.
