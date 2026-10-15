/* multiplayer.js — lobbies and the shared real-time race (no DOM here; the UI subscribes to events).
 *
 * Every lab's simulation runs continuously in its owner's browser. The host's game clock is the
 * shared clock: the host broadcasts its week and speed about once a second and guests follow it.
 * Labs only exchange public information — last released model generation, valuation, headline —
 * which other players see as foggy rival labs. First to capability 100 wins; everyone else gets
 * Second Place. The host also runs any AI lab seats.
 *
 * Events: 'change' (lobby updated), 'start' (lobby), 'clock' ({week, speed}), 'snaps', 'chat',
 *         'ended', 'error', 'hostLeft'. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const MP = { conn: null, lobby: null, myId: null, bots: {}, clock: { week: 0, speed: 1, at: 0 } };
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
    return Object.assign({ id, name: profile.name || 'Player', company: profile.company || 'Unnamed Lab', archetype: arch.id, connected: true,
      cap: Math.floor(arch.cap / 10) * 10, valuation: 0, headline: '', ended: null }, extra || {});
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
        if (L.started && !p) { MP.conn.send({ type: 'error', error: 'That race has already started.' }, from); return; }
        if (!p) { p = newPlayer(from, msg.profile); L.players.push(p); } else Object.assign(p, newPlayer(from, msg.profile), { connected: true });
        broadcastLobby();
        break;
      case 'profile':
        if (p && !L.started) { Object.assign(p, newPlayer(from, msg.profile)); broadcastLobby(); }
        break;
      case 'snap':
        if (p) { Object.assign(p, msg.snap); MP.conn.send({ type: 'snaps', players: L.players }); emit('snaps', L.players); emit('change', L); }
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
    MP.lobby = { code: MP.conn.code, kind: MP.conn.kind, settings: { difficulty: opts.difficulty || 'normal', aiRivals: true, speed: 1 },
      players: [newPlayer(MP.myId, opts, { host: true })], started: false, seed: Math.floor(Math.random() * 1e9), chat: [] };
    MP.conn.onMessage(hostHandle);
    MP.conn.onPeer((id, ev) => {
      if (ev !== 'leave') return;
      const p = MP.lobby.players.find((x) => x.id === id);
      if (!p) return;
      if (MP.lobby.started) p.connected = false;
      else MP.lobby.players = MP.lobby.players.filter((x) => x !== p);
      broadcastLobby();
    });
    assignColors();
    emit('change', MP.lobby);
    return MP.lobby;
  };

  MP.setSettings = function (settings) {
    if (!MP.isHost()) return;
    Object.assign(MP.lobby.settings, settings);
    broadcastLobby();
    if (MP.active()) MP.broadcastClock(MP.clock.week);
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
    L.players.forEach((p, i) => { if (p.bot) { MP.bots[p.id] = E.newGame(p.archetype, p.company, L.seed + i * 7919, L.settings.difficulty); MP.bots[p.id].mp = { host: false, bot: true }; } });
    Object.keys(MP.bots).forEach((id) => setupRivals(MP.bots[id], id));
    MP.clock = { week: 0, speed: L.settings.speed, at: Date.now() };
    broadcastLobby();
    MP.conn.send({ type: 'start', lobby: publicLobby() });
    emit('start', L);
  };

  /** Host: advance the AI labs in lockstep with the host's own lab. */
  MP.hostTickBots = function (week) {
    if (!MP.isHost() || !MP.active()) return;
    for (const p of MP.lobby.players.filter((x) => x.bot && !x.ended)) {
      const s = MP.bots[p.id];
      while (s.week < week && !s.ended) {
        if (s.week % 4 === 0) { MP.applySnapshots(s, p.id); FL.Bots.adaptive(s); }
        E.tick(s);
        while (s.pendingDilemma && !s.ended) FL.Bots.decide(s);
      }
      const snap = snapshotOf(s);
      if (snap.cap !== p.cap || (snap.ended && !p.ended)) { Object.assign(p, snap); MP.conn.send({ type: 'snaps', players: MP.lobby.players }); emit('snaps', MP.lobby.players); emit('change', MP.lobby); }
    }
  };

  /** Host: world events hit every lab at the table; each lab rolls its own subset coin. */
  MP.broadcastWorldEvent = function (id, salt) {
    if (!MP.isHost() || !MP.active()) return;
    MP.conn.send({ type: 'world', id, salt });
    for (const s of Object.values(MP.bots)) if (!s.ended) FL.Events.applyWorldEvent(s, id, salt, s.qr);
  };

  /** Host: share the clock about once a second. */
  MP.broadcastClock = function (week) {
    if (!MP.isHost() || !MP.active()) return;
    MP.clock = { week, speed: MP.lobby.settings.speed, at: Date.now() };
    MP.conn.send({ type: 'clock', week, speed: MP.lobby.settings.speed });
  };

  // ── Guest ────────────────────────────────────────────────
  function guestHandle(msg) {
    switch (msg.type) {
      case 'lobby': MP.lobby = msg.lobby; emit('change', MP.lobby); break;
      case 'start': MP.lobby = msg.lobby; MP.clock = { week: 0, speed: msg.lobby.settings.speed, at: Date.now() }; emit('start', MP.lobby); break;
      case 'snaps': MP.lobby.players = msg.players; emit('snaps', msg.players); emit('change', MP.lobby); break;
      case 'clock': MP.clock = { week: msg.week, speed: msg.speed, at: Date.now() }; emit('clock', MP.clock); break;
      case 'world': emit('world', msg); break;
      case 'chat': MP.lobby.chat.push(msg.line); emit('chat', msg.line); break;
      case 'error': emit('error', msg.error); break;
    }
  }

  MP.joinLobby = async function (code, opts) {
    MP.leave();
    MP.conn = await FL.Net.join(opts.kind || 'internet', code);
    MP.myId = MP.conn.myId;
    MP.lobby = { code: MP.conn.code, kind: MP.conn.kind, players: [], settings: {}, started: false, chat: [] };
    MP.conn.onMessage(guestHandle);
    MP.conn.onPeer((id, ev) => { if (ev === 'leave') emit('hostLeft'); });
    MP.conn.send({ type: 'hello', profile: opts });
    return MP.lobby;
  };

  /** Guests: the week the host's clock should be at right now. */
  MP.targetWeek = function (weekMs) {
    const c = MP.clock;
    return c.week + (Date.now() - c.at) / (weekMs / Math.max(0.001, c.speed));
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
  MP.makeGame = function () {
    const L = MP.lobby, me = MP.me();
    const i = L.players.indexOf(me);
    const s = E.newGame(me.archetype, me.company, L.seed + i * 7919, L.settings.difficulty);
    setupRivals(s, MP.myId);
    s.mp = { code: L.code, host: MP.isHost() };
    return s;
  };

  function setupRivals(s, selfId) {
    const others = MP.lobby.players.filter((p) => p.id !== selfId);
    if (!MP.lobby.settings.aiRivals && others.length) s.rivals = [];
    MP.applySnapshots(s, selfId);
  }

  /** Mirror other players into this company's rival list (public info only). */
  MP.applySnapshots = function (s, selfId) {
    if (!MP.lobby) return;
    selfId = selfId || MP.myId;
    for (const p of MP.lobby.players) {
      if (p.id === selfId) continue;
      const rid = 'mp-' + p.id;
      let r = s.rivals.find((x) => x.id === rid);
      if (!r) { r = { id: rid, remote: true, rate: 0 }; s.rivals.push(r); }
      const changed = r.cap !== p.cap;
      Object.assign(r, { name: p.company + (p.bot ? ' (AI)' : ''), color: p.color, cap: p.cap, player: p.name });
      if (changed && FL.Fog) FL.Fog.observeRival(s, rid, p.cap, 1.5, 'model release');
    }
    if (!s.ended) {
      const end = E.checkEnding(s);
      if (end && end.id === 'lostRace') { s.ended = end; if (selfId === MP.myId) emit('ended', end); }
    }
  };

  /** Only public information leaves your browser: your last released model generation. */
  function snapshotOf(s) {
    return { cap: s.cap >= E.AGI ? s.cap : Math.floor(s.cap / 10) * 10, valuation: s.valuation, quarter: E.quarterLabel(s.turn), headline: s._lastHeadline || '',
      ended: s.ended ? { id: s.ended.id, title: s.ended.title, win: s.ended.win } : null };
  }

  /** Called from the UI loop: send a snapshot when something public changed. */
  MP.maybeSnap = function (s) {
    if (!MP.active()) return;
    const snap = snapshotOf(s);
    const me = MP.me();
    if (!me || (me.cap === snap.cap && !!me.ended === !!snap.ended && me.headline === snap.headline)) return;
    Object.assign(me, snap);
    if (MP.isHost()) { MP.conn.send({ type: 'snaps', players: MP.lobby.players }); emit('snaps', MP.lobby.players); emit('change', MP.lobby); }
    else MP.conn.send({ type: 'snap', snap });
  };

  MP.leave = function () {
    if (MP.conn) try { MP.conn.close(); } catch (e) { /* ignore */ }
    MP.conn = null; MP.lobby = null; MP.myId = null; MP.bots = {};
    emit('change', null);
  };

  FL.Multiplayer = MP;
})(globalThis.FL = globalThis.FL || {});
