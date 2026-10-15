# Multiplayer (design)

TODO: fill in after implementation. Draft:
- Peer-to-peer, no game server: WebRTC via the free PeerJS broker for signaling only.
- Host runs the lobby and a turn barrier; each player simulates their own lab.
- Other players appear as rival labs; first to capability 100 wins for everyone.
- Seats: humans (any of whom can be driven by their own Claude via the CLI bridge) and host-run bots.
