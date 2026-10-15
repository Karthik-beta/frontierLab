# Show HN draft

**Title:** Show HN: Frontier – a Democracy-style game about running an AI lab

**Body:**
I made a browser strategy game in the style of Positech's *Democracy*, except you're founding a
frontier AI lab instead of running a country: https://g8r-b8.github.io/frontierLab/

Everything is a slider: compute, pay, safety teams, ads, lobbying. The effects ripple through a
web of stats and stakeholders with delays. The part I'm happiest with is the pitfalls. Eighteen
traps from real AI and startup history (the board coup, copyright settlements, the safety team
exodus, the DeepSeek-style efficiency shock, an Uber-style culture blowup) build up quietly from
how you run the company, show warning signs, and then spring. Each one ends with what actually
happened and the lesson.

Other bits:
- More than 170 verified real quotes and headlines on the loading screen and in the in-game newspaper
- A GPU fleet that ages, fails and depreciates
- Real-time peer-to-peer multiplayer (WebRTC, no game server)
- A local CLI bridge, so you can play from the terminal or have Claude Code act as your chief of staff

Plain JS, no build step, open source: https://github.com/g8r-b8/frontierLab. I'd love balance
feedback. Realistic mode is meant to be brutal.
