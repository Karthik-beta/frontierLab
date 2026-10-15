/* multiplayer.js — lobbies and the shared race (no DOM here; the UI subscribes to events).
 *
 * Each player simulates their own lab in their own browser. The host runs the lobby and a turn
 * barrier: when every active human has ended the quarter, the host plays the bot seats and
 * broadcasts "advance"; every client then runs its quarter and reports a public snapshot
 * (capability, valuation, headline, ending), which other players see as rival labs.
 * First to capability 100 wins; everyone else gets Second Place.
 *
 * Real time (default): the host's clock advances a quarter every `secondsPerQuarter`; if every human
 * presses Ready first, the quarter advances early. Turn-based mode waits for everyone.
 * Events: 'change' (lobby updated), 'start' (lobby), 'advance' (turn), 'clock' ({turn, deadline, paused}),
 *         'snaps', 'chat', 'ended', 'error', 'hostLeft'. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const MP = { conn: null, lobby: null, myId: null, bots: {} };
  const listeners = {};
  const COLORS = ['#f472b6', '#fbbf24', '#a3e635', '#c084fc', '#22d3ee', '#fb923c', '#e879f9', '#93c5fd'];
  const BOT_NAMES = ['Ouroboros AI', 'Paperclip Partners', 'Basilisk Labs', 'Tensor & Sons', 'Gradient Ascent Inc', 'Moat Capital AI'];

  MP.on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  const emit = (ev, data) => (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } });

  MP.active = () => !!(MP.lobby && MP.lobby.started);
  MP.isHost = () => !!(MP.conn && MP.conn.isHost);
  MP.me = () => MP.lobby && MP.lobby.players.find((p) => p.id === MP.myId);
  MP.inviteLink = () => `${location.origin}${location.pathname}?join=${MP.lobby.code}${MP.lobby.kind === 'local' ? '&net=local' : ''}`;

  function newPlayer(id, profile, extra) {
    const arch = FL.ARCHETYPES.find((a) => a.id === profile.archetype) || FL.ARCHETYPES[0];
    return Object.assign({ id, name: profile.name || 'Player', company: profile.company || 'Unnamed Lab', archetype: arch.id, ready: false, connected: true,
      cap: arch.cap, valuation: 0, headline: '', ended: null }, extra || {});
  }
  const publicLobby = () => JSON.parse(JSON.stringify(MP.lobby));
  function assignColors() { MP.lobby.players.forEach((p, i) => (p.color = COLORS[i % COLORS.length])); }

  // ── Host ─────────────────────────────────────────────────
  function broadcastLobby() { assignColors(); MP.conn.send({ type: 'lobby', lobby: publicLobby() }); emit('change', MP.lobby); }

  function hostHandle(msg, from) {
    const L = MP.lobby;
    let p = L.players.find((x) => x.id === from);
    switch (msg.type) {
      case 'hello':
        if (L.started && !p) { MP.conn.send({ type: 'error', error: 'That match has already started.' }, from); return; }
        if (!p) { p = newPlayer(from, msg.profile); L.players.push(p); } else { Object.assign(p, newPlayer(from, msg.profile), { connected: true }); }
        broadcastLobby();
        if (L.started) MP.conn.send({ type: 'start', lobby: publicLobby() }, from);
        break;
      case 'profile':
        if (p && !L.started) { Object.assign(p, newPlayer(from, msg.profile)); broadcastLobby(); }
        break;
      case 'ready':
        if (p && msg.turn === L.turn) { p.ready = true; broadcastLobby(); checkBarrier(); }
        break;
      case 'snap':
        if (p) { Object.assign(p, msg.snap); MP.conn.send({ type: 'snaps', players: L.players }); emit('snaps', L.players); }
        break;
      case 'chat':
        relayChat({ from: p ? p.name : '?', company: p ? p.company : '', text: String(msg.text).slice(0, 300) });
        break;
    }
  }

  function relayChat(line) {
    MP.lobby.chat.push(line);
    MP.lobby.chat = MP.lobby.chat.slice(-50);
    if (MP.isHost()) MP.conn.send({ type: 'chat', line });
    emit('chat', line);
  }

  MP.hostLobby = async function (opts) {
    MP.leave();
    MP.conn = await FL.Net.host(opts.kind || 'internet');
    MP.myId = MP.conn.myId;
    MP.lobby = { code: MP.conn.code, kind: MP.conn.kind, settings: { difficulty: opts.difficulty || 'normal', aiRivals: true, mode: 'realtime', secondsPerQuarter: 45 }, players: [newPlayer(MP.myId, opts, { host: true })],
      started: false, turn: 1, seed: Math.floor(Math.random() * 1e9), chat: [] };
    MP.conn.onMessage(hostHandle);
    MP.conn.onPeer((id, ev) => {
      if (ev !== 'leave') return;
      const p = MP.lobby.players.find((x) => x.id === id);
      if (!p) return;
      if (MP.lobby.started) p.connected = false;
      else MP.lobby.players = MP.lobby.players.filter((x) => x !== p);
      broadcastLobby();
      checkBarrier();
    });
    assignColors();
    emit('change', MP.lobby);
    return MP.lobby;
  };

  MP.setSettings = function (settings) {
    if (!MP.isHost() || MP.lobby.started) return;
    Object.assign(MP.lobby.settings, settings);
    broadcastLobby();
  };

  MP.addBot = function () {
    if (!MP.isHost() || MP.lobby.started) return;
    const n = MP.lobby.players.filter((p) => p.bot).length;
    const arch = FL.ARCHETYPES[Math.floor(Math.random() * FL.ARCHETYPES.length)];
    MP.lobby.players.push(newPlayer('bot' + n + '-' + Date.now().toString(36), { name: 'AI', company: BOT_NAMES[n % BOT_NAMES.length], archetype: arch.id }, { bot: true }));
    broadcastLobby();
  };
  MP.removePlayer = function (id) {
    if (!MP.isHost() || MP.lobby.started || id === MP.myId) return;
    MP.lobby.players = MP.lobby.players.filter((p) => p.id !== id);
    broadcastLobby();
  };

  MP.start = function () {
    if (!MP.isHost() || MP.lobby.started) return;
    const L = MP.lobby;
    if (L.players.length < 2) { emit('error', 'Add at least one more player or an AI lab first.'); return; }
    L.started = true;
    L.turn = 1;
    L.players.forEach((p, i) => {
      p.ready = false;
      if (p.bot) {
        const s = E.newGame(p.archetype, p.company, L.seed + i * 7919, L.settings.difficulty);
        MP.bots[p.id] = s;
      }
    });
    Object.keys(MP.bots).forEach((id) => setupRivals(MP.bots[id], id));
    broadcastLobby();
    MP.conn.send({ type: 'start', lobby: publicLobby() });
    emit('start', L);
    scheduleClock();
  };

  // ── Real-time clock (host-owned) ─────────────────────────
  let clockTimer = null;
  function scheduleClock() {
    clearTimeout(clockTimer);
    const L = MP.lobby;
    if (!L || !L.started || L.settings.mode !== 'realtime' || L.paused) { broadcastClock(); return; }
    const ms = (L.msLeft != null ? L.msLeft : L.settings.secondsPerQuarter * 1000);
    L.msLeft = null;
    L.deadline = Date.now() + ms;
    clockTimer = setTimeout(() => advanceNow(), ms);
    broadcastClock();
  }
  function broadcastClock() {
    const L = MP.lobby;
    const msLeft = L.paused ? L.msLeft : L.deadline ? Math.max(0, L.deadline - Date.now()) : null;
    MP.conn.send({ type: 'clock', turn: L.turn, msLeft, paused: !!L.paused, mode: L.settings.mode });
    emit('clock', { turn: L.turn, deadline: msLeft != null ? Date.now() + msLeft : null, paused: !!L.paused, msLeft });
  }
  MP.setPaused = function (paused) {
    const L = MP.lobby;
    if (!MP.isHost() || !L || !L.started || L.settings.mode !== 'realtime') return;
    if (paused && !L.paused) { L.msLeft = Math.max(0, L.deadline - Date.now()); L.paused = true; clearTimeout(clockTimer); broadcastClock(); }
    else if (!paused && L.paused) { L.paused = false; scheduleClock(); }
  };

  /** When every connected, still-playing human is ready, play the bots and advance. */
  function checkBarrier() {
    const L = MP.lobby;
    if (!L || !L.started) return;
    const waiting = L.players.filter((p) => !p.bot && p.connected && !p.ended && !p.ready);
    if (waiting.length) return;
    advanceNow();
  }

  /** Play the bot seats and move everyone to the next quarter. */
  function advanceNow() {
    const L = MP.lobby;
    if (!L || !L.started) return;
    clearTimeout(clockTimer);
    for (const p of L.players.filter((x) => x.bot && !x.ended)) {
      const s = MP.bots[p.id];
      MP.applySnapshots(s, p.id);
      if (s.ended) continue;
      FL.Bots.adaptive(s);
      E.endTurn(s);
      while (s.pendingDilemma && !s.ended) FL.Bots.decide(s);
      Object.assign(p, snapshotOf(s));
    }
    L.turn++;
    L.players.forEach((p) => (p.ready = false));
    MP.conn.send({ type: 'advance', turn: L.turn, players: L.players });
    emit('advance', L.turn);
    emit('change', L);
    if (L.players.some((p) => !p.bot && !p.ended)) scheduleClock();
  }

  // ── Guest ────────────────────────────────────────────────
  function guestHandle(msg) {
    switch (msg.type) {
      case 'lobby': MP.lobby = msg.lobby; emit('change', MP.lobby); break;
      case 'start': MP.lobby = msg.lobby; emit('start', MP.lobby); break;
      case 'advance': MP.lobby.turn = msg.turn; MP.lobby.players = msg.players; emit('advance', msg.turn); emit('change', MP.lobby); break;
      case 'snaps': MP.lobby.players = msg.players; emit('snaps', msg.players); emit('change', MP.lobby); break;
      case 'chat': MP.lobby.chat.push(msg.line); emit('chat', msg.line); break;
      case 'error': emit('error', msg.error); break;
      case 'clock': MP.lobby.turn = msg.turn; MP.lobby.paused = msg.paused; emit('clock', { turn: msg.turn, deadline: msg.msLeft != null ? Date.now() + msg.msLeft : null, paused: msg.paused, msLeft: msg.msLeft }); break;
    }
  }

  MP.joinLobby = async function (code, opts) {
    MP.leave();
    MP.conn = await FL.Net.join(opts.kind || 'internet', code);
    MP.myId = MP.conn.myId;
    MP.lobby = { code: MP.conn.code, kind: MP.conn.kind, players: [], settings: {}, started: false, turn: 1, chat: [] };
    MP.conn.onMessage(guestHandle);
    MP.conn.onPeer((id, ev) => { if (ev === 'leave') emit('hostLeft'); });
    MP.conn.send({ type: 'hello', profile: opts });
    return MP.lobby;
  };

  MP.setProfile = function (profile) {
    if (!MP.lobby || MP.lobby.started) return;
    if (MP.isHost()) { Object.assign(MP.me(), newPlayer(MP.myId, profile, { host: true })); broadcastLobby(); }
    else MP.conn.send({ type: 'profile', profile });
  };

  MP.chat = function (text) {
    if (!MP.conn || !text) return;
    if (MP.isHost()) relayChat({ from: MP.me().name, company: MP.me().company, text: String(text).slice(0, 300) });
    else MP.conn.send({ type: 'chat', text });
  };

  // ── Both ─────────────────────────────────────────────────
  /** Create this player's company for the match. */
  MP.makeGame = function () {
    const L = MP.lobby, me = MP.me();
    const i = L.players.indexOf(me);
    const s = E.newGame(me.archetype, me.company, L.seed + i * 7919, L.settings.difficulty);
    setupRivals(s, MP.myId);
    s.mp = { code: L.code };
    return s;
  };

  function setupRivals(s, selfId) {
    const others = MP.lobby.players.filter((p) => p.id !== selfId);
    if (!MP.lobby.settings.aiRivals && others.length) s.rivals = [];
    MP.applySnapshots(s, selfId);
  }

  /** Mirror other players into this company's rival list; if one reached AGI, the race is over. */
  MP.applySnapshots = function (s, selfId) {
    if (!MP.lobby) return;
    selfId = selfId || MP.myId;
    for (const p of MP.lobby.players) {
      if (p.id === selfId) continue;
      const rid = 'mp-' + p.id;
      let r = s.rivals.find((x) => x.id === rid);
      if (!r) { r = { id: rid, remote: true, rate: 0 }; s.rivals.push(r); }
      Object.assign(r, { name: p.company + (p.bot ? ' (AI)' : ''), color: p.color, cap: p.cap, player: p.name });
    }
    if (!s.ended) {
      const end = E.checkEnding(s);
      if (end && end.id === 'lostRace') { s.ended = end; if (selfId === MP.myId) emit('ended', end); }
    }
  };

  function snapshotOf(s) {
    const h = (s.history._cap || []).length;
    return { cap: s.cap, valuation: s.valuation, quarter: E.quarterLabel(s.turn), headline: (s._lastHeadline || ''), ended: s.ended ? { id: s.ended.id, title: s.ended.title, win: s.ended.win } : null, turns: h };
  }

  /** Called by the UI after this player's quarter has been played. */
  MP.sendSnap = function (s, report) {
    if (!MP.active()) return;
    if (report && report.headline) s._lastHeadline = report.headline.head;
    const snap = snapshotOf(s);
    const me = MP.me();
    if (MP.isHost()) { Object.assign(me, snap); MP.conn.send({ type: 'snaps', players: MP.lobby.players }); emit('snaps', MP.lobby.players); emit('change', MP.lobby); }
    else MP.conn.send({ type: 'snap', snap });
  };

  /** This player has finished their quarter's decisions. */
  MP.ready = function () {
    if (!MP.active()) return;
    const L = MP.lobby;
    if (MP.isHost()) { MP.me().ready = true; broadcastLobby(); checkBarrier(); }
    else { MP.me() && (MP.me().ready = true); MP.conn.send({ type: 'ready', turn: L.turn }); emit('change', L); }
  };

  MP.waitingFor = () => (MP.lobby ? MP.lobby.players.filter((p) => !p.bot && p.connected && !p.ended && !p.ready) : []);

  MP.realtime = () => !!(MP.lobby && MP.lobby.settings && MP.lobby.settings.mode === 'realtime');

  MP.leave = function () {
    clearTimeout(clockTimer);
    if (MP.conn) try { MP.conn.close(); } catch (e) { /* ignore */ }
    MP.conn = null; MP.lobby = null; MP.myId = null; MP.bots = {};
    emit('change', null);
  };

  FL.Multiplayer = MP;
})(globalThis.FL = globalThis.FL || {});
