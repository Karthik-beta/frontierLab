/* events.js — chance in real time:
 *  - World events that help or hurt everyone, labs matching a condition, or a random subset.
 *  - Golden opportunities (Cookie Clicker's golden cookies / Plague Inc's bubbles): short-lived,
 *    clickable bonuses — and risky "wrath" ones.
 *  - Timed buffs (Frenzy-style multipliers and boosts). */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const V = {};
  const pickWeighted = (state, list) => {
    const tot = list.reduce((a, x) => a + (x.weight || 1), 0);
    let r = E.rand(state) * tot;
    for (const x of list) { r -= x.weight || 1; if (r <= 0) return x; }
    return list[list.length - 1];
  };

  // ── Buffs ────────────────────────────────────────────────
  V.addBuff = function (state, b) {
    state.buffs = (state.buffs || []).filter((x) => x.name !== b.name);
    state.buffs.push({ name: b.name, fx: b.fx || {}, mult: b.mult || {}, until: state.week + b.weeks, good: b.good !== false });
    E.emit(state, { type: 'buff', name: b.name, weeks: b.weeks });
  };
  V.mult = function (state, key) {
    let m = 1;
    for (const b of state.buffs || []) if (b.until > state.week && b.mult[key]) m *= b.mult[key];
    return m;
  };
  V.tickBuffs = function (state) {
    const before = (state.buffs || []).length;
    state.buffs = (state.buffs || []).filter((b) => b.until > state.week);
    if (state.buffs.length < before) E.emit(state, { type: 'buffEnded' });
  };
  E.registerInput('buffs', 'Active effects', (state) => {
    const out = {};
    for (const b of state.buffs || []) if (b.until > state.week) for (const [k, v] of Object.entries(b.fx)) out[k] = (out[k] || 0) + v;
    return out;
  });

  // ── World events ─────────────────────────────────────────
  /** Roughly 0.9 world events a quarter. In multiplayer, the host rolls and broadcasts them instead. */
  V.rollWorldEvent = function (state, qr, dt) {
    if (state.mp && !state.mp.host) return null;
    if (E.rand(state) > 0.9 * dt) return null;
    const pool = FL.WORLD_EVENTS.filter((e) => state.turn >= (e.minTurn || 0) && state.week - ((state.worldEventSeen || {})[e.id] || -99) > 26);
    if (!pool.length) return null;
    const ev = pickWeighted(state, pool);
    const salt = Math.floor(E.rand(state) * 1e9);
    V.applyWorldEvent(state, ev.id, salt, qr);
    if (state.mp && state.mp.host && FL.Multiplayer) FL.Multiplayer.broadcastWorldEvent(ev.id, salt);
    return ev;
  };

  /** Apply a world event to this lab and its AI rivals. `salt` makes random subsets reproducible per lab. */
  V.applyWorldEvent = function (state, eventId, salt, qr) {
    const ev = FL.WORLD_EVENTS.find((e) => e.id === eventId);
    if (!ev) return null;
    state.worldEventSeen = state.worldEventSeen || {};
    state.worldEventSeen[ev.id] = state.week;
    // A per-lab coin, stable for this event, so multiplayer subsets differ by lab but are fair.
    const coin = (k) => { let h = (salt ^ (state.seed + k * 2654435761)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    let hitMe = ev.scope === 'all' || (ev.scope === 'cond' && ev.cond(state)) || (ev.scope === 'random' && coin(0) < ev.p);
    if (hitMe) {
      (ev.fx || []).forEach(([to, amt, q]) => state.shocks.push({ to, amt, turns: q || 0.6, left: q || 0.6 }));
      if (ev.cash) state.cash += E.eventCash(state, { cash: ev.cash, scaleCash: true });
      if (ev.buff) V.addBuff(state, { ...ev.buff, good: ev.good });
      if (ev.podsLost && state.hw) {
        let lost = 0;
        for (const c of state.hw.fleet) { const l = c.pods * ev.podsLost; c.pods -= l; c.book *= 1 - ev.podsLost; lost += l; }
        state.hw.failedTotal = (state.hw.failedTotal || 0) + lost;
      }
      if (ev.region && FL.Growth && state.growth) FL.Growth.setRegionMod(state, ev.region.id, ev.region.ban != null ? { ban: ev.region.ban } : { boost: ev.region.boost }, ev.region.weeks);
      if (ev.candidate && FL.Hiring && state.people) state.people.feed.unshift(FL.Hiring.makeCandidate(state, { seniority: 4, quality: 6 }));
    }
    const rivalsHit = [];
    if (ev.rival) {
      state.rivals.forEach((r, i) => {
        if (r.remote) return;
        const hit = ev.scope === 'all' || (ev.scope === 'cond' && coin(i + 1) < (ev.rivalP || 0.5)) || (ev.scope === 'random' && coin(i + 1) < ev.p);
        if (!hit) return;
        if (ev.rival.cap) r.cap = Math.max(0, r.cap + ev.rival.cap);
        if (ev.rival.pace) { r.paceMult = ev.rival.pace; r.paceUntil = state.week + ev.rival.weeks; }
        rivalsHit.push(r.name);
      });
    }
    const line = { id: ev.id, title: ev.title, text: ev.text, good: ev.good, hitYou: hitMe, rivalsHit };
    if (qr) (qr.world = qr.world || []).push(line);
    E.emit(state, { type: 'world', ...line });
    if (FL.Systems) FL.Systems.fireTrigger(state, 'world:' + ev.id + (hitMe ? '' : ':spared'), qr);
    return line;
  };

  // ── Golden opportunities ─────────────────────────────────
  V.OPP_WEEKS = 3;
  V.tickOpportunities = function (state, qr, dt) {
    state.opps = (state.opps || []).filter((o) => {
      if (o.until > state.week) return true;
      E.emit(state, { type: 'oppMissed', name: o.name });
      return false;
    });
    const rate = (1.6 + state.values.brand * 1.2) * (state.flags.lucky ? 1.3 : 1); // per quarter
    if (state.opps.length >= 2 || E.rand(state) > rate * dt) return;
    const wrathBias = Math.max(0, 0.5 - state.values.trust) + (state.people ? state.people.toxicity * 0.5 : 0);
    const pool = FL.OPPORTUNITIES.map((o) => ({ ...o, weight: o.wrath ? o.weight * (1 + wrathBias * 3) : o.weight }));
    const t = pickWeighted(state, pool);
    const o = { uid: (state.nextUid = (state.nextUid || 0) + 1), id: t.id, name: t.name, wrath: !!t.wrath, until: state.week + V.OPP_WEEKS, x: E.rand(state), y: E.rand(state) };
    state.opps.push(o);
    E.emit(state, { type: 'opp', uid: o.uid, name: o.name, wrath: o.wrath });
  };

  V.claim = function (state, uid) {
    const o = (state.opps || []).find((x) => x.uid === +uid);
    if (!o) return { ok: false, reason: 'Too late — that opportunity is gone.' };
    state.opps = state.opps.filter((x) => x !== o);
    const t = FL.OPPORTUNITIES.find((x) => x.id === o.id);
    let text = t.text, out = t;
    if (t.wrath) {
      const good = E.rand(state) < 0.5;
      out = good ? t.win : t.lose;
      text = out.text;
    }
    if (out.buff) V.addBuff(state, out.buff);
    if (out.cash) state.cash += E.eventCash(state, { cash: out.cash, scaleCash: true });
    if (out.bandwidth) state.bandwidth = Math.min(E.BANDWIDTH_CAP, state.bandwidth + out.bandwidth);
    if (out.cap) state.cap += out.cap;
    (out.fx || []).forEach(([to, amt, q]) => state.shocks.push({ to, amt, turns: q || 0.6, left: q || 0.6 }));
    if (out.candidate && FL.Hiring) state.people.feed.unshift(FL.Hiring.makeCandidate(state, { seniority: 3, quality: 10 }));
    if (out.intel && FL.Fog) for (const r of state.rivals) if (!r.remote) FL.Fog.observeRival(state, r.id, r.cap + (E.rand(state) - 0.5) * 2, 1, 'leaked deck');
    state.oppsClaimed = (state.oppsClaimed || 0) + 1;
    const res = { ok: true, name: t.name, text, wrath: t.wrath, artifacts: [], achievements: [] };
    if (FL.Systems) {
      FL.Systems.fireTrigger(state, 'opp:claim', res);
      if (state.oppsClaimed >= 10) FL.Systems.fireTrigger(state, 'opp:10', res);
      if (t.wrath) FL.Systems.fireTrigger(state, 'opp:wrath:' + (out === t.win ? 'win' : 'lose'), res);
    }
    E.emit(state, { type: 'claimed', name: t.name, text, wrath: !!t.wrath });
    return res;
  };

  V.tick = function (state, qr, dt) {
    V.tickBuffs(state);
    V.rollWorldEvent(state, qr, dt);
    V.tickOpportunities(state, qr, dt);
  };

  FL.Events = V;
})(globalThis.FL = globalThis.FL || {});
