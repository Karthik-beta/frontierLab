/* systems.js — long-arc systems layered on the core engine:
 * pitfalls (short/medium/long-term traps with warning signs), the historical archive,
 * milestones (model generations, valuation tiers), objectives, eras, the event director and headlines. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const S = {};
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const WARN_AT = [0.35, 0.7];

  /* Pitfall events ride on the dilemma machinery, but are never rolled at random. */
  S.registerPitfallEvents = function () {
    for (const p of FL.PITFALLS || []) {
      const id = 'pit:' + p.id;
      if (FL.DILEMMAS.some((d) => d.id === id)) continue;
      FL.DILEMMAS.push({ id, pitfall: p.id, title: p.event.title, text: p.event.text, options: p.event.options, when: () => false });
    }
  };
  S.registerPitfallEvents();

  const policyStrength = (state) => (id) => (state.policies[id] ? 0.2 + 0.8 * state.policies[id].level : 0);

  /** Advance every pitfall meter; report warning signs and fire at most one pitfall per quarter. */
  S.updatePitfalls = function (state, report) {
    const P = policyStrength(state);
    report.pitfallWarnings = report.pitfallWarnings || [];
    const ready = [];
    for (const p of FL.PITFALLS || []) {
      const last = state.pitfallsFired[p.id];
      if (p.once && last != null) continue;
      if ((p.minTurn && state.turn < p.minTurn) || (p.cooldown && last != null && state.turn - last < p.cooldown)) { state.meters[p.id] = 0; continue; }
      const prev = state.meters[p.id] || 0;
      let rate = 0;
      try { rate = p.rate(state, P); } catch (e) { rate = 0; }
      const m = clamp(prev + (Number.isFinite(rate) ? rate : 0), 0, 1.2);
      state.meters[p.id] = m;
      WARN_AT.forEach((t, i) => {
        if (prev < t && m >= t) report.pitfallWarnings.push({ id: p.id, name: p.name, horizon: p.horizon, text: p.warn[i], level: i + 1 });
      });
      if (m >= 1) ready.push(p);
    }
    if (!ready.length || state.dilemmaQueue.length) return;
    ready.sort((a, b) => state.meters[b.id] - state.meters[a.id]);
    const p = ready[0];
    state.dilemmaQueue.push('pit:' + p.id);
    state.pitfallsFired[p.id] = state.turn;
    state.meters[p.id] = 0.15;
    state.lastEventTurn = state.turn;
    report.pitfall = p.id;
    S.fireTrigger(state, 'pitfall:' + p.id, report);
    if (Object.keys(state.pitfallsFired).length >= 5) S.fireTrigger(state, 'pitfalls:5', report);
  };

  /** Visible risk list for the UI: meters at or above the first warning threshold. */
  S.risks = function (state) {
    return (FL.PITFALLS || [])
      .filter((p) => (state.meters[p.id] || 0) >= WARN_AT[0] && !(p.once && state.pitfallsFired[p.id] != null))
      .map((p) => ({ id: p.id, name: p.name, horizon: p.horizon, meter: state.meters[p.id], warn: p.warn[state.meters[p.id] >= WARN_AT[1] ? 1 : 0] }))
      .sort((a, b) => b.meter - a.meter);
  };
  S.hiddenRiskCount = (state) => (FL.PITFALLS || []).filter((p) => { const m = state.meters[p.id] || 0; return m > 0.1 && m < WARN_AT[0]; }).length;

  // ── Archive & achievements ───────────────────────────────
  const triggersOf = (a) => (Array.isArray(a.trigger) ? a.trigger : [a.trigger]);

  /** Unlock every archive artifact / achievement whose trigger matches `key`. */
  S.fireTrigger = function (state, key, report) {
    const sink = report || (state.unseen = state.unseen || { artifacts: [], achievements: [] });
    sink.artifacts = sink.artifacts || [];
    sink.achievements = sink.achievements || [];
    for (const a of FL.ARCHIVE || []) {
      if (state.artifacts.includes(a.id) || !triggersOf(a).includes(key)) continue;
      state.artifacts.push(a.id);
      sink.artifacts.push(a.id);
    }
    state.achievementsRun = state.achievementsRun || [];
    for (const a of FL.ACHIEVEMENTS || []) {
      if (a.trigger !== key || state.achievementsRun.includes(a.id)) continue;
      state.achievementsRun.push(a.id);
      sink.achievements.push(a.id);
    }
  };

  /** Emit triggers implied by the quarter's state changes. */
  S.scanTriggers = function (state, report) {
    state.seenPolicies = state.seenPolicies || {};
    for (const [id, p] of Object.entries(state.policies)) {
      if (!state.seenPolicies[id]) { state.seenPolicies[id] = true; S.fireTrigger(state, 'policy:' + id, report); }
      if (p.level >= 0.9 && !state.seenPolicies[id + ':max']) { state.seenPolicies[id + ':max'] = true; S.fireTrigger(state, 'policy:' + id + ':max', report); }
    }
    for (const id of Object.keys(state.seenPolicies)) {
      if (id.includes(':') || state.policies[id] || state.seenPolicies[id + ':cancel']) continue;
      state.seenPolicies[id + ':cancel'] = true;
      S.fireTrigger(state, 'cancel:' + id, report);
    }
    (report.started || []).forEach((id) => S.fireTrigger(state, 'situation:' + id, report));
    if (report.funding) {
      S.fireTrigger(state, report.funding.ok ? 'round:ok' : 'round:failed', report);
      if (state.rounds.length === 1) S.fireTrigger(state, 'round:first', report);
    }
    if (report.bridge) S.fireTrigger(state, 'bridge', report);
    if (report.finance && report.finance.net > 0 && report.finance.revenue > 50) S.fireTrigger(state, 'profitable', report);
    if (report.paused) S.fireTrigger(state, 'rsp:pause', report);
    if (report.news && report.news.length) S.fireTrigger(state, 'rival:release', report);
    S.fireTrigger(state, 'turn:' + state.turn, report);
  };

  /** Model generations and valuation tiers crossed this quarter. */
  S.checkMilestones = function (state, report) {
    report.milestones = report.milestones || [];
    for (const g of FL.MODEL_GENS) {
      const key = 'gen' + g.at;
      if (state.cap >= g.at && !state.milestones[key]) {
        state.milestones[key] = state.turn;
        state.lastModel = g.name;
        report.milestones.push({ kind: 'model', name: g.name, at: g.at, blurb: g.blurb });
        S.fireTrigger(state, 'model:' + g.name, report);
        S.fireTrigger(state, 'cap:' + g.at, report);
      }
    }
    for (const t of FL.VALUATION_TIERS) {
      const key = 'tier' + t.at;
      if (state.valuation >= t.at && !state.milestones[key]) {
        state.milestones[key] = state.turn;
        report.milestones.push({ kind: 'tier', name: t.name, at: t.at, blurb: t.blurb });
        S.fireTrigger(state, 'tier:' + t.name, report);
      }
    }
    if (state.cap >= E.AGI && state.turn <= 25) S.fireTrigger(state, 'speedrun', report);
  };

  // ── Objectives ───────────────────────────────────────────
  const tplOf = (id) => FL.OBJECTIVES.find((o) => o.id === id);

  S.dealObjective = function (state, slot) {
    const lastId = (state.lastObjective || {})[slot.id];
    const pool = slot.pool.map(tplOf).filter((t) => t && (!t.minTurn || state.turn >= t.minTurn) && t.id !== lastId && !(t.kind === 'reach' && t.met(state, t.setup(state))));
    if (!pool.length) return null;
    const t = pool[Math.floor(E.rand(state) * pool.length)];
    const o = { slot: slot.id, id: t.id, owner: t.owner, kind: t.kind, params: t.setup(state), dealt: state.turn, deadline: state.turn + t.turns };
    o.text = t.text(o.params);
    state.objectives.push(o);
    return o;
  };

  S.objectiveProgress = function (state, o) {
    const t = tplOf(o.id);
    return t ? clamp(t.progress(state, o.params), 0, 1) : 0;
  };

  /** Resolve due objectives (rewards/penalties) and deal new ones into empty slots. */
  S.updateObjectives = function (state, report) {
    const res = { done: [], failed: [], dealt: [] };
    state.lastObjective = state.lastObjective || {};
    state.objectiveCooldown = state.objectiveCooldown || {};
    state.objectives = state.objectives.filter((o) => {
      const t = tplOf(o.id);
      if (!t) return false;
      const met = t.met(state, o.params);
      const due = state.turn >= o.deadline;
      if ((t.kind === 'reach' && met) || (due && met)) {
        res.done.push(o);
        state.objectivesDone++;
        state.bandwidth = Math.min(E.BANDWIDTH_CAP, state.bandwidth + 4);
        state.shocks.push({ to: o.owner, amt: 0.18, turns: 5, left: 5 });
      } else if (due) {
        res.failed.push(o);
        state.shocks.push({ to: o.owner, amt: -0.15, turns: 4, left: 4 });
      } else return true;
      state.lastObjective[o.slot] = o.id;
      state.objectiveCooldown[o.slot] = state.turn + 1;
      return false;
    });
    for (const slot of FL.OBJECTIVE_SLOTS) {
      if (state.objectives.some((o) => o.slot === slot.id)) continue;
      if ((state.objectiveCooldown[slot.id] || 0) > state.turn) continue;
      const o = S.dealObjective(state, slot);
      if (o) res.dealt.push(o);
    }
    if (state.objectivesDone >= 10) S.fireTrigger(state, 'objectives:10', report);
    report.objectives = res;
  };

  // ── Eras, director, tension ──────────────────────────────
  S.eraOf = function (state) {
    let era = FL.ERAS[0];
    for (const e of FL.ERAS) if (state.cap >= e.at) era = e;
    return era;
  };

  /** 0..1 stakes level: runway, heat, board, crises, and how close the race is. */
  S.tension = function (state) {
    const v = state.values;
    const crises = FL.SITUATIONS.filter((s) => !s.good && state.active[s.id]).length;
    const closeRace = 1 - Math.min(1, Math.abs(state.cap - E.bestRival(state).cap) / 20);
    const raw = 0.25 * (1 - v.runway) + 0.2 * v.regHeat + 0.2 * clamp(-state.happiness.board, 0, 1) + 0.12 * crises + 0.15 * closeRace * v.capability + 0.25 * S.eraOf(state).tension;
    return clamp(raw, 0, 1);
  };

  /** Director: build-up / peak / relax. Busier in later acts, quieter right after a spike,
   * and guaranteed to stir after a long quiet stretch. */
  S.dilemmaChance = function (state) {
    const base = { lab: 0.32, product: 0.42, scaling: 0.52, endgame: 0.62 }[S.eraOf(state).id] || 0.45;
    const quiet = state.turn - (state.lastEventTurn || 0);
    if (state.tension > 0.75) return 0.15;
    if (quiet >= 3) return 0.95;
    if (quiet >= 2) return Math.min(0.9, base + 0.3);
    return base;
  };

  /** Situations that are close to starting (telegraphed 1–2 quarters ahead). */
  S.rumors = function (state) {
    return FL.SITUATIONS.filter((s) => !state.active[s.id] && state.pressure[s.id] > s.on * 0.85 && state.pressure[s.id] <= s.on)
      .map((s) => ({ id: s.id, name: s.name, good: s.good }));
  };

  // ── Headlines & epigraphs ────────────────────────────────
  const pick = (state, arr) => arr[Math.floor(E.rand(state) * arr.length)];

  S.headline = function (state, report) {
    const co = state.company;
    const tabloid = state.values.trust < 0.35;
    const paper = tabloid ? 'The Daily Byte' : 'The Ledger';
    const money = E.fmtMoney;
    let head, sub;
    const pit = report.pitfall && FL.PITFALLS.find((p) => p.id === report.pitfall);
    const model = (report.milestones || []).find((m) => m.kind === 'model');
    const tier = (report.milestones || []).find((m) => m.kind === 'tier');
    const badStart = (report.started || []).map((id) => E.node(id).def).find((s) => !s.good);
    const goodStart = (report.started || []).map((id) => E.node(id).def).find((s) => s.good);
    if (pit) { head = pit.event.title; sub = tabloid ? `Insiders say ${co} "never learned from history".` : `Echoes of past tech crises as ${co} faces a familiar trap.`; }
    else if (report.funding && !report.funding.ok) { head = pick(state, [`Investors Balk at ${co}`, `${co} Limps Through Down Round`]); sub = report.funding.text; }
    else if (badStart) { head = pick(state, tabloid ? [`${badStart.name.toUpperCase()}! ${co.toUpperCase()} IN CHAOS`, `MELTDOWN AT ${co.toUpperCase()}`] : [`${badStart.name} Rocks ${co}`, `${co} Grapples With ${badStart.name}`]); sub = badStart.desc; }
    else if (model) { head = pick(state, [`${co} Unveils ${model.name}`, `${model.name} Is Here`, `Meet ${model.name}, ${co}'s New Flagship`]); sub = model.blurb; }
    else if (report.funding) { head = `${co} Raises ${money(report.funding.raised)}`; sub = `The ${report.funding.name} values the lab at ${money(report.funding.valuation)}.`; }
    else if (tier) { head = `${co} Joins the ${tier.name}`; sub = tier.blurb; }
    else if (goodStart) { head = `${goodStart.name}: ${co} Rides High`; sub = goodStart.desc; }
    else if (report.news && report.news.length) { head = report.news[0].replace(/\.$/, ''); sub = `${co} is under pressure to respond.`; }
    else {
      const d = (report.deltas || [])[0];
      head = d ? `${d.name} ${(d.to - d.from) * (d.good === false ? -1 : 1) > 0 ? 'Improves' : 'Slides'} at ${co}` : pick(state, [`Quiet Quarter at ${co}`, `Rivals Circle as ${co} Regroups`, 'All Quiet on the Frontier']);
      sub = d ? `${d.name} moved from ${Math.round(d.from * 100)} to ${Math.round(d.to * 100)} this quarter.` : 'Analysts expect a busier quarter ahead.';
    }
    return { paper, head, sub, tabloid };
  };

  /** A quote for the quarter's report. Common artifacts shown this way are added to the archive. */
  S.epigraph = function (state, report) {
    // Only commons or cards you already own, so epigraphs never spoil locked artifacts.
    const pool = (FL.ARCHIVE || []).filter((a) => a.quote && (a.rarity === 'common' || state.artifacts.includes(a.id)));
    if (!pool.length) return null;
    const unseen = pool.filter((a) => !state.artifacts.includes(a.id));
    const a = pick(state, unseen.length && E.rand(state) < 0.5 ? unseen : pool);
    if (a.rarity === 'common' && !state.artifacts.includes(a.id)) {
      state.artifacts.push(a.id);
      report.artifacts.push(a.id);
    }
    return a.id;
  };

  // ── Hooks ────────────────────────────────────────────────
  S.onNewGame = function (state) {
    state.lastEventTurn = 1;
    state.era = S.eraOf(state).id;
    state.tension = S.tension(state);
    S.fireTrigger(state, 'start', null);
    S.fireTrigger(state, 'start:' + state.archetype, null);
    for (const slot of FL.OBJECTIVE_SLOTS) S.dealObjective(state, slot);
  };

  /** Called by E.endTurn after the core update (state.turn is already the new quarter). */
  S.run = function (state, report) {
    report.artifacts = report.artifacts || [];
    report.achievements = report.achievements || [];
    if ((report.started || []).length || report.funding) state.lastEventTurn = state.turn;
    S.checkMilestones(state, report);
    S.scanTriggers(state, report);
    S.updatePitfalls(state, report);
    S.updateObjectives(state, report);
    const era = S.eraOf(state);
    if (era.id !== state.era) { state.era = era.id; report.era = era; S.fireTrigger(state, 'era:' + era.id, report); }
    report.rumors = S.rumors(state);
    state.tension = S.tension(state);
    report.tension = state.tension;
    report.epigraph = S.epigraph(state, report);
    report.headline = S.headline(state, report);
  };

  FL.Systems = S;
})(globalThis.FL = globalThis.FL || {});
