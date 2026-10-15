/* marketing.js — campaigns (one-off, results revealed at quarter end), launch strategy for each
 * new model, and PR damping of bad press. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const M = {};
  const camp = (id) => FL.CAMPAIGNS.find((c) => c.id === id);
  const quarterOfYear = (turn) => ((turn - 1) % 4) + 1;

  M.init = function (state) {
    state.mkt = { booked: [], bookedAt: {}, last: {}, history: [] };
  };

  M.cost = (state, c) => c.cost * Math.pow(1.06, state.turn - 1);

  /** Why a campaign can't be booked right now (null if it can). */
  M.blocker = function (state, c) {
    const mk = state.mkt;
    if (mk.booked.includes(c.id)) return 'Booked for this quarter.';
    if (c.onlyQ && quarterOfYear(state.turn) !== c.onlyQ) return `Only in Q${c.onlyQ}.`;
    const last = mk.last[c.id];
    const t = state.t || 0;
    if (last != null && t - last < c.cooldown) return `Available again in ${Math.ceil((c.cooldown - (t - last)) * 13)} weeks.`;
    if (state.bandwidth < c.bandwidth) return `Needs ${c.bandwidth} bandwidth.`;
    if (state.cash < M.cost(state, c)) return 'Not enough cash.';
    return null;
  };
  M.available = (state) => FL.CAMPAIGNS.map((c) => ({ ...c, price: M.cost(state, c), blocker: M.blocker(state, c) }));

  M.book = function (state, id) {
    const c = camp(id);
    if (!c) return { ok: false, reason: 'Unknown campaign.' };
    const b = M.blocker(state, c);
    if (b) return { ok: false, reason: b };
    state.cash -= M.cost(state, c);
    state.bandwidth -= c.bandwidth;
    state.mkt.booked.push(c.id);
    state.mkt.bookedAt = state.mkt.bookedAt || {};
    state.mkt.bookedAt[c.id] = state.t || 0;
    state.log.push({ turn: state.turn, text: `Booked campaign: ${c.name}` });
    return { ok: true };
  };
  M.unbook = function (state, id) {
    const c = camp(id);
    if (!c || !state.mkt.booked.includes(id)) return { ok: false, reason: 'Not booked.' };
    state.cash += M.cost(state, c);
    state.bandwidth += c.bandwidth;
    state.mkt.booked = state.mkt.booked.filter((x) => x !== id);
    return { ok: true };
  };

  M.RUN_QUARTERS = 4 / 13; // campaigns run for about a month before results are in

  /** Resolve campaigns that have finished running. Better products and bigger brands tilt the odds. */
  M.update = function (state, report, dt) {
    const mk = state.mkt;
    if (!mk) return;
    mk.bookedAt = mk.bookedAt || {};
    const results = report.campaigns || (report.campaigns = []);
    const due = mk.booked.filter((id) => (state.t || 0) - (mk.bookedAt[id] || 0) >= M.RUN_QUARTERS);
    for (const id of due) {
      const c = camp(id);
      const tilt = (c.quality ? state.values.quality - 0.4 : 0) * 0.5 + (state.values.brand - 0.2) * 0.2;
      // Shift probability toward the first (best) outcome by `tilt`, renormalised.
      const ps = c.outcomes.map((o, i) => Math.max(0.02, o.p + (i === 0 ? tilt : -tilt / (c.outcomes.length - 1))));
      const total = ps.reduce((a, b) => a + b, 0);
      let x = E.rand(state) * total, k = 0;
      while (k < ps.length - 1 && x > ps[k]) { x -= ps[k]; k++; }
      const o = c.outcomes[k];
      (o.fx || []).forEach(([to, amt, turns]) => state.shocks.push({ to, amt, turns: turns || 4, left: turns || 4 }));
      mk.last[id] = state.t || 0;
      const reach = Math.round((5 + 120 * state.values.brand + 60 * state.values.hype) * (0.6 + 0.8 * E.rand(state)));
      const res = { id, name: c.name, label: o.label, best: k === 0, worst: k === c.outcomes.length - 1 && c.outcomes.length > 1, reach };
      results.push(res);
      mk.history.push({ turn: state.turn, ...res });
      E.emit(state, { type: 'campaign', ...res });
      if (FL.Systems) {
        FL.Systems.fireTrigger(state, 'campaign:' + id, report);
        if (res.best) FL.Systems.fireTrigger(state, 'campaign:' + id + ':best', report);
        if (res.worst) FL.Systems.fireTrigger(state, 'campaign:' + id + ':worst', report);
        if (id === 'superBowl' && state.values.runway < 0.5) FL.Systems.fireTrigger(state, 'campaign:superBowl:broke', report);
      }
    }
    mk.booked = mk.booked.filter((id) => !due.includes(id));
  };

  /** Chance used by the launch dilemma's chance outcomes. */
  M.launchChance = function (state, opt) {
    const v = state.values;
    if (opt.chance.launchViral) return Math.min(0.85, 0.12 + v.quality * 0.45 + v.brand * 0.2);
    if (opt.chance.launchDemo) return Math.max(0.15, Math.min(0.9, 0.8 - Math.max(0, v.hype - v.quality) * 1.2 - (state.policies.benchmarks ? 0.1 : 0)));
    return opt.chance.p;
  };

  /** Queue the launch-strategy decision when a model generation ships. */
  M.onModelShipped = function (state) {
    if (!state.dilemmaQueue.includes('modelLaunch') && state.pendingDilemma !== 'modelLaunch') state.dilemmaQueue.push('modelLaunch');
  };

  /** Comms & PR soften the media and trust hit from active crises. */
  E.registerInput('marketing', 'Comms & PR during crises', (state) => {
    if (!state.policies.prTeam) return {};
    const bad = FL.SITUATIONS.filter((s) => !s.good && state.active[s.id]).length;
    if (!bad) return {};
    const k = 0.2 + 0.8 * state.policies.prTeam.level;
    return { media: 0.07 * bad * k, trust: 0.02 * bad * k };
  });

  FL.Marketing = M;
})(globalThis.FL = globalThis.FL || {});
