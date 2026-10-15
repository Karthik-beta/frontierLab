/* rivals.js — interacting with opponents, for better or worse.
 *  - You can make hostile moves (poach, price war, antitrust complaint, espionage, smear, compute lockout,
 *    lawsuit) or cooperative ones (safety research, slowdown pact, compute sales, licensing, coalition,
 *    acquisition) toward any rival. Cooperation needs their consent.
 *  - Every rival has a relationship with you (-1 hostile .. +1 friendly) and a hidden persona that shapes
 *    how it answers and how it treats you. Burned bridges are remembered (grudges).
 *  - AI rivals act on you in real time: they poach your people, sue, smear, start price wars, and send
 *    proposals that land in your inbox.
 *  - Against human players (multiplayer) the same moves are relayed peer to peer. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const R = {};
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const strength = (s, id) => (s.policies[id] ? 0.2 + 0.8 * s.policies[id].level : 0);
  const scale = (s) => Math.pow(1.06, s.turn - 1);
  const act = (id) => FL.INTERACTIONS.find((a) => a.id === id);
  const shock = (s, to, amt, q) => s.shocks.push({ to, amt, turns: q || 0.6, left: q || 0.6 });
  const buff = (s, b) => FL.Events && FL.Events.addBuff(s, b);

  // ── Records ──────────────────────────────────────────────
  function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }
  R.rec = function (state, r) {
    state.rel = state.rel || {};
    if (!state.rel[r.id]) {
      const keys = Object.keys(FL.PERSONAS);
      const persona = r.remote ? 'human' : FL.RIVAL_PERSONA[r.id] || keys[(hash(r.id) + (state.seed || 0)) % keys.length];
      state.rel[r.id] = { rel: 0, cd: {}, persona, observed: 0, grudge: 0, moves: [] };
    }
    return state.rel[r.id];
  };
  R.init = function (state) { for (const r of state.rivals) R.rec(state, r); };
  R.persona = (state, r) => FL.PERSONAS[R.rec(state, r).persona] || null;
  /** Personas are hidden; you only get a hint after seeing a rival act a couple of times. */
  R.personaHint = function (state, r) {
    const rec = R.rec(state, r), p = R.persona(state, r);
    if (r.remote) return 'a human player';
    return p && rec.observed >= 2 ? p.hint : 'unknown';
  };
  const rivalById = (state, id) => state.rivals.find((r) => r.id === id || r.name.toLowerCase().startsWith(String(id).toLowerCase()));
  function slowRival(state, r, mult, weeks) {
    const cur = r.paceUntil > state.week ? r.paceMult : 1;
    r.paceMult = cur * mult;
    r.paceUntil = Math.max(r.paceUntil || 0, state.week + weeks);
  }
  const est = (state, r) => (FL.Fog ? FL.Fog.rivalEstimate(state, r).est : r.cap);

  R.acquirePrice = (state, r) => Math.max(800, 320 * Math.pow(Math.max(1, est(state, r)), 1.25)) * scale(state);

  /** Why the player can't do this right now (null if they can). */
  R.blocker = function (state, aid, rid) {
    const a = act(aid), r = rivalById(state, rid);
    if (!a) return 'Unknown action.';
    if (!r) return 'Unknown rival.';
    if (state.ended) return 'The game is over.';
    const rec = R.rec(state, r);
    if ((rec.cd[aid] || 0) > state.week) return `Available again in ${rec.cd[aid] - state.week} weeks.`;
    if (state.bandwidth < a.bw) return `Needs ${a.bw} bandwidth.`;
    const cost = a.cash * scale(state);
    if (state.cash < cost) return 'Not enough cash.';
    if (aid === 'sellCapacity' && !(state.hw && state.hw.fleet.length)) return 'You own no hardware to rent out.';
    if (aid === 'acquire') {
      if (est(state, r) > state.cap - 12) return 'You can only acquire a lab well behind you.';
      if (!r.remote && state.cash < cost + R.acquirePrice(state, r)) return `Needs about ${E.fmtMoney(R.acquirePrice(state, r))}.`;
    }
    return null;
  };

  // ── Your moves ───────────────────────────────────────────
  /** Outcomes. Each returns { text, rel, impact (for a human target), propose (needs consent) }. */
  const MOVES = {
    poachTeam(s, r, rec, p) {
      const pr = clamp(0.35 + 0.35 * strength(s, 'comp') + 0.25 * (s.values.lead - 0.5) + 0.1 * strength(s, 'culture'), 0.1, 0.85);
      if (E.rand(s) > pr) return { text: `${r.name} matched every offer. Nobody moved.`, rel: -0.2 };
      shock(s, 'talent', 0.06, 0.6);
      if (FL.Fog) FL.Fog.observeRival(s, r.id, r.remote ? est(s, r) : r.cap + (E.rand(s) - 0.5) * 2, 1.5, 'poached team');
      if (!r.remote) { slowRival(s, r, 0.85, 13); r.cap = Math.max(0, r.cap - 0.5); }
      const suedP = 0.25 + (p ? p.aggression * 0.25 : 0.1);
      let text = `You hired a team away from ${r.name}. They will miss them.`;
      if (E.rand(s) < suedP) { shock(s, 'legal', 0.12, 1); s.cash -= 100 * scale(s); text += ' They sued you for it, and you paid to make it go away.'; }
      return { text, rel: -0.4, impact: { fx: [['talent', -0.07, 0.6], ['morale', -0.05, 0.6]], loseHire: true, label: 'hired away a team of your researchers' } };
    },
    priceWar(s, r) {
      buff(s, { name: `Price war with ${r.name}`, weeks: 8, fx: { monetization: -0.1, adoption: 0.04 }, good: false });
      if (!r.remote) slowRival(s, r, 0.9, 8);
      return { text: `You cut prices under ${r.name}. Margins are bleeding on both sides.`, rel: -0.35,
        impact: { buff: { name: 'Price war', weeks: 8, fx: { monetization: -0.08, adoption: -0.03 }, good: false }, label: 'started a price war against you' } };
    },
    antitrust(s, r) {
      const pr = clamp(0.35 + 0.35 * Math.max(0, s.happiness.regulators), 0.1, 0.8);
      let text;
      const ok = E.rand(s) < pr;
      if (ok) { if (!r.remote) slowRival(s, r, 0.85, 10); text = `Regulators opened an inquiry into ${r.name}.`; }
      else text = 'Regulators thanked you for the briefing and did nothing.';
      if (E.rand(s) < 0.3) { shock(s, 'trust', -0.04, 0.6); shock(s, 'media', -0.12, 0.6); text += ' The press called it petty.'; }
      return { text, rel: -0.5, impact: ok ? { fx: [['regHeat', 0.12, 1]], label: 'got regulators to open an inquiry into you' } : null };
    },
    espionage(s, r) {
      const pr = clamp(0.55 + 0.25 * (FL.Fog ? FL.Fog.intelStrength(s) : 0), 0.2, 0.85);
      if (E.rand(s) < pr) {
        if (FL.Fog) FL.Fog.observeRival(s, r.id, r.remote ? est(s, r) : r.cap, 0.5, 'stolen documents');
        s.cap += 1.2;
        return { text: `You got ${r.name}'s internal roadmap. Nobody knows. For now.`, rel: 0, secret: true };
      }
      shock(s, 'legal', 0.25, 1); shock(s, 'regHeat', 0.15, 1); shock(s, 'trust', -0.1, 1); shock(s, 'board', -0.2, 0.6);
      return { text: 'Your operative was caught. Prosecutors are involved and it is front-page news.', rel: -0.8, scandal: true,
        impact: { fx: [], label: 'tried to steal your secrets — and got caught' } };
    },
    smear(s, r, rec, p) {
      if (!r.remote) slowRival(s, r, 0.95, 6);
      if (E.rand(s) < 0.25) {
        shock(s, 'media', -0.2, 0.6); shock(s, 'trust', -0.04, 0.6);
        return { text: `A reporter traced the smear campaign back to you. ${r.name} now looks like the victim.`, rel: -0.6,
          impact: { fx: [['hype', 0.05, 0.5]], label: 'ran a smear campaign against you — and got caught' } };
      }
      const noticed = p && E.rand(s) < (1 - p.honesty) * 0.5;
      return { text: `The op-eds about ${r.name} are landing.`, rel: noticed ? -0.4 : 0, anonymous: true,
        impact: { fx: [['hype', -0.1, 0.5], ['trust', -0.04, 0.5]], label: 'is running a smear campaign against you', anonymous: true } };
    },
    lockout(s, r) {
      buff(s, { name: 'Extra capacity', weeks: 8, fx: { compute: 0.05 } });
      if (!r.remote) slowRival(s, r, 0.88, 8);
      return { text: `You bought out the capacity ${r.name} was about to sign.`, rel: -0.3,
        impact: { fx: [['compute', -0.1, 0.6]], label: 'outbid you for a block of compute' } };
    },
    ipSuit(s, r) {
      const win = E.rand(s) < 0.4;
      if (win) {
        const amt = 250 * scale(s);
        s.cash += amt;
        if (!r.remote) slowRival(s, r, 0.95, 6);
        return { text: `${r.name} settled for ${E.fmtMoney(amt)}.`, rel: -0.4, impact: { cash: -amt, label: `settled your lawsuit for ${E.fmtMoney(amt)}` } };
      }
      shock(s, 'media', -0.1, 0.5);
      return { text: 'The judge tossed your case. Their lawyers are gloating.', rel: -0.4 };
    },
    safetyPact: () => ({ propose: true }),
    pausePact: () => ({ propose: true }),
    sellCapacity: () => ({ propose: true }),
    license: () => ({ propose: true }),
    coalition: () => ({ propose: true }),
    acquire: () => ({ propose: true }),
  };

  /** Will an AI rival say yes to a cooperative proposal? */
  function aiAccepts(s, r, aid) {
    const rec = R.rec(s, r), p = R.persona(s, r) || FL.PERSONAS.open;
    const behind = est(s, r) < s.cap - 5 ? 0.15 : 0;
    const bias = { safetyPact: p.safety * 0.4 - 0.1, pausePact: p.safety * 0.5 - p.aggression * 0.3 - 0.15 + behind,
      coalition: 0.15, sellCapacity: 0.25 + behind, license: 0.2 + behind, acquire: -0.25 + Math.max(0, (s.cap - r.cap) / 30) }[aid] || 0;
    return E.rand(s) < clamp(0.35 + 0.4 * rec.rel + bias - 0.15 * rec.grudge, 0.03, 0.95);
  }

  /** What accepting a cooperative deal does — to you, and to them (AI) or as an impact (human). */
  function applyDeal(s, r, aid, side) {
    // side: 'proposer' (you proposed and they accepted) or 'accepter' (they proposed and you accepted)
    const rec = R.rec(s, r), p = R.persona(s, r);
    switch (aid) {
      case 'safetyPact':
        buff(s, { name: `Shared safety research with ${r.name}`, weeks: 26, fx: { safety: 0.05, trust: 0.03, velocity: -0.02 } });
        return { text: `You and ${r.name} are pooling evals and incident reports.`, rel: 0.3 };
      case 'pausePact': {
        buff(s, { name: `Slowdown pact with ${r.name}`, weeks: 13, mult: { capGain: 0.75 }, fx: { trust: 0.05, safetyCommunity: 0.3, regulators: 0.1 } });
        if (!r.remote) {
          const defects = p && E.rand(s) < (1 - p.honesty) * 0.7;
          if (defects) rec.defectReveal = s.week + 4 + Math.floor(E.rand(s) * 6);
          else slowRival(s, r, 0.75, 13);
        }
        return { text: `You and ${r.name} both agreed to slow down for a quarter.`, rel: 0.4 };
      }
      case 'sellCapacity': {
        if (side === 'accepter') {
          // They are renting YOUR compute.
          const fleetVal = s.hw ? s.hw.fleet.reduce((a, c) => a + c.pods * FL.Hardware.genById(c.gen).price, 0) : 0;
          s.cash += Math.max(40, fleetVal * 0.25 * 0.15);
          buff(s, { name: `Capacity rented to ${r.name}`, weeks: 13, fx: { compute: -0.08 }, good: false });
          if (!r.remote) slowRival(s, r, 1 / 0.92, 13);
          return { text: `${r.name} is renting a quarter of your fleet.`, rel: 0.2 };
        }
        const fleetVal = s.hw ? s.hw.fleet.reduce((a, c) => a + c.pods * FL.Hardware.genById(c.gen).price, 0) : 0;
        s.cash += Math.max(40, fleetVal * 0.25 * 0.15);
        buff(s, { name: `Capacity rented to ${r.name}`, weeks: 13, fx: { compute: -0.08 }, good: false });
        if (!r.remote) slowRival(s, r, 1.08, 13);
        return { text: `${r.name} is renting a quarter of your fleet.`, rel: 0.2, impact: { buff: { name: 'Rented compute', weeks: 13, fx: { compute: 0.08 } }, label: 'rented you spare compute' } };
      }
      case 'license': {
        const fee = (40 + s.cap * 8) * scale(s);
        s.cash += fee;
        shock(s, 'hype', 0.02, 0.5);
        if (!r.remote) { slowRival(s, r, 1.1, 13); r.cap += 1; }
        return { text: `${r.name} licensed your model for ${E.fmtMoney(fee)}. They will get faster with it.`, rel: 0.2,
          impact: { fx: [['velocity', 0.03, 1], ['quality', 0.03, 1]], label: 'licensed you their model' } };
      }
      case 'coalition':
        shock(s, 'regHeat', -0.06, 1); shock(s, 'regulators', 0.15, 1); shock(s, 'safetyCommunity', -0.1, 1);
        return { text: `You and ${r.name} signed a joint industry pledge. Regulators relaxed; critics called it capture.`, rel: 0.2 };
      case 'acquire': {
        if (side === 'accepter') { s.flags.acquihired = true; return { text: `${r.name} is acquiring ${s.company}.`, rel: 0 }; }
        const price = R.acquirePrice(s, r);
        s.cash -= price;
        shock(s, 'talent', 0.08, 1.5); shock(s, 'compute', 0.08, 1.5); shock(s, 'regHeat', 0.15, 1.5);
        if (!r.remote) { s.rivals = s.rivals.filter((x) => x !== r); if (s.intel) delete s.intel[r.id]; }
        return { text: `You acquired ${r.name} for ${E.fmtMoney(price)}. Their people and clusters are yours; antitrust lawyers are reading the filings.`, rel: 0,
          impact: { acquired: true, label: 'acquired your company' } };
      }
    }
    return { text: '', rel: 0 };
  }

  /** Perform an action against/with a rival. */
  R.act = function (state, aid, rid) {
    const r = rivalById(state, rid);
    const b = R.blocker(state, aid, rid);
    if (b) return { ok: false, reason: b };
    const a = act(aid), rec = R.rec(state, r), p = R.persona(state, r);
    state.bandwidth -= a.bw;
    state.cash -= a.cash * scale(state);
    rec.cd[aid] = state.week + a.cooldown;
    let out = MOVES[aid](state, r, rec, p);
    if (out.propose) {
      if (r.remote) {
        const uid = (state.nextUid = (state.nextUid || 0) + 1);
        state.proposalsOut = state.proposalsOut || {};
        state.proposalsOut[uid] = { aid, rid: r.id };
        if (FL.Multiplayer) FL.Multiplayer.sendInteraction(r.pid, { kind: 'proposal', action: aid, from: state.company, uid, price: aid === 'acquire' ? R.acquirePrice(state, r) : 0 });
        out = { text: `Proposal sent to ${r.name}. They have five weeks to answer.`, rel: 0 };
      } else if (aiAccepts(state, r, aid)) {
        out = applyDeal(state, r, aid, 'proposer');
      } else out = { text: `${r.name} declined.`, rel: -0.05 };
    }
    rec.rel = clamp(rec.rel + (out.rel || 0), -1, 1);
    if (a.kind === 'hostile' && !out.secret && !out.anonymous) rec.grudge = Math.min(3, rec.grudge + 1);
    rec.moves.push({ week: state.week, aid, text: out.text });
    if (r.remote && out.impact && FL.Multiplayer) FL.Multiplayer.sendInteraction(r.pid, { kind: 'impact', action: aid, from: out.impact.anonymous ? null : state.company, impact: out.impact });
    E.emit(state, { type: 'interaction', text: `${a.name} → ${r.name}: ${out.text}`, hostile: a.kind === 'hostile' });
    const res = { ok: true, text: out.text, artifacts: [], achievements: [] };
    if (FL.Systems) {
      FL.Systems.fireTrigger(state, 'act:' + aid, res);
      if (out.scandal) FL.Systems.fireTrigger(state, 'act:espionage:caught', res);
    }
    return res;
  };

  // ── Incoming ─────────────────────────────────────────────
  /** Apply something another lab did to you (AI or a human player). */
  R.receive = function (state, impact, meta) {
    if (!impact) return;
    (impact.fx || []).forEach(([to, amt, q]) => shock(state, to, amt, q));
    if (impact.buff) buff(state, impact.buff);
    if (impact.cash) state.cash += impact.cash;
    if (impact.loseHire && state.people) {
      const pool = state.people.roster.filter((x) => !x.founder);
      if (pool.length) { const v = pool[Math.floor(E.rand(state) * pool.length)]; state.people.roster = state.people.roster.filter((x) => x !== v); state.people.managers = state.people.managers.filter((m) => m.id !== v.id); }
    }
    if (impact.acquired) state.flags.acquihired = true;
    const who = meta && meta.from ? meta.from : 'Someone';
    E.emit(state, { type: 'attacked', text: `${who} ${impact.label}.`, good: (impact.fx || []).every((f) => f[1] >= 0) && !impact.loseHire && !(impact.cash < 0) });
  };

  /** Inbox rendering for rival proposals (dynamic title/text). */
  R.render = function (state, item) {
    const d = FL.DILEMMAS.find((x) => x.id === item.id);
    const c = item.ctx || {};
    const who = c.from || 'A rival';
    const texts = {
      'rv:safetyPact': `${who} wants to pool safety evals and incident reports. Safer for both of you; slightly slower.`,
      'rv:pausePact': `${who} proposes that you both slow frontier scaling for a quarter. Will they keep their word?`,
      'rv:coalition': `${who} wants a joint industry pledge and lobbying front. Regulators would relax; critics would cry capture.`,
      'rv:license': `${who} wants to license your model. Good money — and they will get faster with it.`,
      'rv:buyCapacity': `${who} wants to rent a quarter of your fleet. Cash now, less compute for you, more for them.`,
      'rv:acquire': `${who} offers to acquire ${state.company}${c.price ? ` for about ${E.fmtMoney(c.price)}` : ''}. Accepting ends your run.`,
      'rv:poachOffer': `${who} is courting ${c.personName || 'one of your best people'}. Counter-offer for ${E.fmtMoney(c.cost || 0)}?`,
      'rv:lawsuit': `${who} is suing you over IP. Settle for ${E.fmtMoney(c.amount || 0)}, or fight and risk paying double.`,
    };
    return { title: d.title.replace('A rival', who), text: texts[item.id] || d.text, options: d.options };
  };

  /** Resolve a rival inbox item (called by the engine). Returns the result text. */
  R.resolve = function (state, item, i) {
    const c = item.ctx || {};
    const r = state.rivals.find((x) => x.id === c.rid);
    const accept = i === 0;
    if (item.id === 'rv:poachOffer') {
      if (accept) { state.cash -= c.cost || 0; return 'You matched the offer. They are staying.'; }
      if (state.people) {
        const v = state.people.roster.find((x) => x.id === c.personId);
        if (v) { state.people.roster = state.people.roster.filter((x) => x !== v); state.people.managers = state.people.managers.filter((m) => m.id !== v.id); }
      }
      shock(state, 'talent', -0.04, 0.6);
      if (r && !r.remote) r.cap += 0.4;
      return `${c.personName || 'They'} left for ${c.from}.`;
    }
    if (item.id === 'rv:lawsuit') {
      if (accept) { state.cash -= c.amount || 0; return 'Settled.'; }
      if (E.rand(state) < 0.5) return 'You won. The case was dismissed.';
      state.cash -= 2 * (c.amount || 0); shock(state, 'legal', 0.1, 1);
      return 'You lost, and paid double.';
    }
    const aid = { 'rv:safetyPact': 'safetyPact', 'rv:pausePact': 'pausePact', 'rv:coalition': 'coalition', 'rv:license': 'license', 'rv:buyCapacity': 'sellCapacity', 'rv:acquire': 'acquire' }[item.id];
    let text;
    if (accept && r) {
      const out = applyDeal(state, r, aid, 'accepter');
      R.rec(state, r).rel = clamp(R.rec(state, r).rel + (out.rel || 0), -1, 1);
      text = out.text;
    } else {
      if (r) R.rec(state, r).rel = clamp(R.rec(state, r).rel - 0.1, -1, 1);
      text = 'You declined.';
    }
    if (c.human && FL.Multiplayer) FL.Multiplayer.sendInteraction(c.fromPid, { kind: 'reply', uid: c.remoteUid, accepted: accept, from: state.company });
    return text;
  };

  /** Multiplayer: messages from other players. */
  R.receiveRemote = function (state, msg) {
    const r = state.rivals.find((x) => x.pid === msg.fromId);
    if (msg.kind === 'impact') {
      if (r && msg.from) R.rec(state, r).rel = clamp(R.rec(state, r).rel - 0.3, -1, 1);
      R.receive(state, msg.impact, { from: msg.from });
    } else if (msg.kind === 'proposal') {
      const id = { safetyPact: 'rv:safetyPact', pausePact: 'rv:pausePact', coalition: 'rv:coalition', license: 'rv:license', sellCapacity: 'rv:buyCapacity', acquire: 'rv:acquire' }[msg.action];
      if (!id) return;
      E.addDecision(state, id);
      const item = state.inbox[state.inbox.length - 1];
      item.ctx = { from: msg.from, rid: r && r.id, human: true, fromPid: msg.fromId, remoteUid: msg.uid, price: msg.price };
    } else if (msg.kind === 'reply') {
      const out = (state.proposalsOut || {})[msg.uid];
      if (!out) return;
      delete state.proposalsOut[msg.uid];
      const rr = state.rivals.find((x) => x.id === out.rid);
      if (msg.accepted && rr) {
        const res = applyDeal(state, rr, out.aid, 'proposer');
        if (res.impact && rr.remote && FL.Multiplayer) FL.Multiplayer.sendInteraction(rr.pid, { kind: 'impact', action: out.aid, from: state.company, impact: res.impact });
        E.emit(state, { type: 'interaction', text: `${msg.from} accepted: ${res.text}` });
      } else E.emit(state, { type: 'interaction', text: `${msg.from} declined your proposal.` });
    }
  };

  /** AI rivals act toward you. Rates depend on persona, grudges and your relationship. */
  R.tick = function (state, qr, dt) {
    for (const r of state.rivals) {
      if (r.remote) continue;
      const rec = R.rec(state, r), p = R.persona(state, r);
      if (!p) continue;
      rec.grudge = Math.max(0, rec.grudge - 0.25 * dt);
      if (rec.defectReveal && state.week >= rec.defectReveal) {
        delete rec.defectReveal;
        rec.rel = clamp(rec.rel - 0.6, -1, 1);
        E.emit(state, { type: 'attacked', text: `Leaked documents show ${r.name} never slowed down during your pact.`, good: false });
      }
      if (state.turn < 3) continue;
      const hostileRate = 0.05 + 0.25 * p.aggression + 0.2 * rec.grudge - 0.15 * Math.max(0, rec.rel);
      const coopRate = 0.06 + 0.18 * p.safety + 0.15 * Math.max(0, rec.rel);
      if (E.rand(state) < Math.max(0, hostileRate) * dt) R.aiHostile(state, r, rec, p);
      else if (state.inbox.length < 3 && E.rand(state) < coopRate * dt) R.aiPropose(state, r, rec, p);
    }
  };

  R.aiHostile = function (state, r, rec, p) {
    rec.observed++;
    const roll = E.rand(state);
    const people = state.people ? state.people.roster.filter((x) => !x.founder) : [];
    if (roll < 0.25 && people.length && state.inbox.length < 3) {
      const v = people.sort((a, b) => b.skill - a.skill)[Math.floor(E.rand(state) * Math.min(3, people.length))];
      E.addDecision(state, 'rv:poachOffer');
      state.inbox[state.inbox.length - 1].ctx = { from: r.name, rid: r.id, personId: v.id, personName: v.name, cost: v.salary * 1.5 };
    } else if (roll < 0.42) {
      buff(state, { name: `Price war from ${r.name}`, weeks: 8, fx: { monetization: -0.08, adoption: -0.02 }, good: false });
      E.emit(state, { type: 'attacked', text: `${r.name} slashed prices to undercut you.`, good: false });
    } else if (roll < 0.57) {
      shock(state, 'regHeat', 0.1, 0.8);
      E.emit(state, { type: 'attacked', text: `${r.name} briefed regulators about you.`, good: false });
    } else if (roll < 0.75) {
      shock(state, 'hype', -0.08, 0.5); shock(state, 'trust', -0.04, 0.5);
      const anon = E.rand(state) < 0.6;
      E.emit(state, { type: 'attacked', text: `${anon ? 'Someone' : r.name} is running a smear campaign against you.`, good: false });
    } else if (roll < 0.88) {
      shock(state, 'compute', -0.08, 0.6);
      E.emit(state, { type: 'attacked', text: `${r.name} outbid you for a block of compute.`, good: false });
    } else if (state.inbox.length < 3) {
      E.addDecision(state, 'rv:lawsuit');
      state.inbox[state.inbox.length - 1].ctx = { from: r.name, rid: r.id, amount: 150 * scale(state) };
    }
  };

  R.aiPropose = function (state, r, rec, p) {
    rec.observed++;
    const behind = r.cap < state.cap - 10, ahead = r.cap > state.cap + 15;
    const opts = [['rv:safetyPact', p.safety], ['rv:pausePact', p.safety * (behind ? 1.5 : 0.6)], ['rv:coalition', 0.4],
      ['rv:license', behind ? 0.8 : 0.1], ['rv:buyCapacity', state.hw && state.hw.fleet.length ? 0.4 : 0], ['rv:acquire', ahead && state.values.runway < 0.4 ? 1.2 : 0]];
    const tot = opts.reduce((a, o) => a + o[1], 0);
    let x = E.rand(state) * tot, pick = opts[0][0];
    for (const [id, w] of opts) { x -= w; if (x <= 0) { pick = id; break; } }
    E.addDecision(state, pick);
    state.inbox[state.inbox.length - 1].ctx = { from: r.name, rid: r.id, price: pick === 'rv:acquire' ? Math.max(500, state.valuation * 0.8) : 0 };
  };

  FL.Rivals = R;
})(globalThis.FL = globalThis.FL || {});
