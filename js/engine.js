/* engine.js — pure simulation (no DOM). Works in the browser and in node via vm.
 *
 * Model (Democracy-style): every policy, stat, stakeholder and situation is a node.
 * Effect edges carry k * curve(source) into a target, each smoothed by its own lag,
 * so changes ripple through the company over several quarters. */
(function (FL) {
  'use strict';
  const E = {};

  E.MAX_TURNS = 40;
  E.AGI = 100;
  E.FIRST_ROUND = 4;
  E.ROUND_EVERY = 6;
  E.BANDWIDTH_CAP = 40;
  E.ROUND_NAMES = ['Series A', 'Series B', 'Series C', 'Series D', 'Series E', 'Series F', 'Series G', 'Series H'];

  const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
  E.clamp = clamp;

  /** Seeded RNG (mulberry32) whose state lives in the game state so saves replay identically. */
  E.makeRng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  E.rand = function (state) {
    state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
    let t = state.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  E.quarterLabel = function (turn) {
    return 'Q' + (((turn - 1) % 4) + 1) + ' ' + (2027 + Math.floor((turn - 1) / 4));
  };

  // ── Node registry ────────────────────────────────────────
  let _nodes = null;
  E.nodes = function () {
    if (_nodes) return _nodes;
    const nodes = {};
    const reg = (type) => (d) => {
      if (nodes[d.id]) throw new Error(`Duplicate node id '${d.id}' (${nodes[d.id].type} vs ${type})`);
      nodes[d.id] = { type, def: d };
    };
    FL.STATS.forEach(reg('stat'));
    FL.INDICATORS.forEach(reg('indicator'));
    FL.POLICIES.forEach(reg('policy'));
    FL.STAKEHOLDERS.forEach(reg('stakeholder'));
    FL.SITUATIONS.forEach(reg('situation'));
    _nodes = nodes;
    return _nodes;
  };
  E.node = (id) => E.nodes()[id];
  E.nodeType = (id) => (E.nodes()[id] ? E.nodes()[id].type : null);

  /** Map a raw value through an effect curve. ctr maps [0,1] -> [-1,1]. */
  E.curve = function (kind, x) {
    switch (kind) {
      case 'sqrt': return Math.sqrt(Math.max(0, x));
      case 'sq': return x * x;
      case 'ctr': return (x - 0.5) * 2;
      case 'inv': return 1 - x;
      default: return x;
    }
  };

  /** Flattened list of every effect edge in the game graph (cached). */
  let _effects = null;
  E.allEffects = function () {
    if (_effects) return _effects;
    const out = [];
    const add = (from, to, k, lag, curve) => out.push({ from, to, k, lag: lag || 1, curve: curve || 'lin', idx: out.length });
    FL.STAT_LINKS.forEach((l) => add(l.from, l.to, l.k, l.lag, l.curve));
    FL.POLICIES.forEach((p) => p.e.forEach(([to, k, lag, curve]) => add(p.id, to, k, lag, curve)));
    FL.STAKEHOLDERS.forEach((s) => s.inputs.forEach(([from, k, lag, curve]) => add(from, s.id, k, lag || 2, curve)));
    FL.SITUATIONS.forEach((s) => {
      s.inputs.forEach(([from, k, lag, curve]) => add(from, s.id, k, lag || 1, curve));
      s.e.forEach(([to, k, lag, curve]) => add(s.id, to, k, lag || 2, curve));
    });
    out.forEach((e) => {
      if (!E.node(e.from)) throw new Error('Unknown effect source: ' + e.from);
      if (!E.node(e.to)) throw new Error('Unknown effect target: ' + e.to);
    });
    _effects = out;
    return out;
  };
  E.effectsInto = (id) => E.allEffects().filter((e) => e.to === id);
  E.effectsFrom = (id) => E.allEffects().filter((e) => e.from === id);

  /** Current value of any node as an effect source. */
  E.sourceValue = function (state, id) {
    switch (E.nodeType(id)) {
      case 'policy': {
        const p = state.policies[id];
        return p ? 0.2 + 0.8 * p.level : 0;
      }
      case 'stat':
      case 'indicator': return state.values[id];
      case 'stakeholder': return state.happiness[id];
      case 'situation': return state.active[id] ? 1 : 0;
      default: return 0;
    }
  };

  /** Non-edge inputs from subsystems (hardware fleet, team). Each returns {nodeId: delta}. */
  E.extraInputs = [];
  E.registerInput = function (id, label, fn) {
    E.extraInputs = E.extraInputs.filter((x) => x.id !== id);
    E.extraInputs.push({ id, label, fn });
  };

  /** Live contribution of one edge (what it is pushing into its target right now). */
  E.contribution = (state, e) => state.contrib[e.idx] || 0;

  // ── New game ─────────────────────────────────────────────
  /** Difficulty knobs for this game (defaults to Normal). */
  E.diff = (state) => (FL.DIFFICULTIES || []).find((d) => d.id === (state && state.difficulty)) || (FL.DIFFICULTIES || [])[1] ||
    { cashMult: 1, bandwidth: 0, bwIncome: 0, rivalPace: 1, pitfallPace: 1, fundingMult: 1, bridges: 1, coupGrace: 2, computeInflation: 1.06, failureMult: 1, aligned: 0.55, uneasy: 0.4 };

  E.newGame = function (archetypeId, companyName, seed, difficulty) {
    const arch = FL.ARCHETYPES.find((a) => a.id === archetypeId) || FL.ARCHETYPES[0];
    const dif = E.diff({ difficulty: difficulty || 'normal' });
    seed = seed == null ? Math.floor(Math.random() * 1e9) : seed >>> 0;
    const state = {
      version: 1, seed, rngState: seed >>> 0,
      company: companyName || 'Frontier Labs', archetype: arch.id, difficulty: difficulty || 'normal',
      turn: 1, cash: arch.cash * dif.cashMult, bandwidth: Math.max(4, arch.bandwidth + dif.bandwidth), bandwidthMod: (arch.bandwidthMod || 0) + dif.bwIncome,
      cap: arch.cap, rivals: FL.RIVALS.map((r) => ({ ...r })),
      policies: {}, values: {}, happiness: {}, pressure: {}, active: {},
      contrib: [], shocks: [], baseMods: { ...(arch.baseMods || {}) },
      finance: { revenue: 0, costs: 0, net: 0, items: [] },
      revHistory: [], history: {}, cashHistory: [],
      turnChanges: {}, pendingDilemma: null, dilemmaSeen: {},
      nextRound: E.FIRST_ROUND, rounds: [], bridgesUsed: 0, valuation: 0,
      badBoardTurns: 0, injunctionTurns: 0, flags: {}, ended: null, log: [],
      meters: {}, pitfallsFired: {}, dilemmaQueue: [], objectives: [], objectivesDone: 0,
      milestones: {}, artifacts: [], era: null,
      week: 0, t: 0, inbox: [], events: [], newspapers: [], qr: null, buffs: [], opps: [], journal: [], metrics: [],
    };
    Object.entries(arch.policies).forEach(([id, level]) => (state.policies[id] = { level, since: -8 }));
    FL.STATS.forEach((s) => (state.values[s.id] = s.base + (state.baseMods[s.id] || 0)));
    FL.STAKEHOLDERS.forEach((s) => (state.happiness[s.id] = s.base));
    FL.SITUATIONS.forEach((s) => { state.pressure[s.id] = 0; state.active[s.id] = 0; });
    E.allEffects().forEach((e) => (state.contrib[e.idx] = 0));
    state.ownership = 100;
    if (FL.World) FL.World.init(state);
    if (FL.Hardware) FL.Hardware.init(state, arch);
    if (FL.Hiring) FL.Hiring.init(state, arch);
    if (FL.Marketing) FL.Marketing.init(state);

    // Warm start: settle the network so turn 1 isn't a cold transient.
    state.finance = E.computeFinances(state);
    for (let i = 0; i < 12; i++) {
      E.updateIndicators(state);
      E.updateNetwork(state, true);
    }
    state.finance = E.computeFinances(state);
    E.updateIndicators(state);
    state.valuation = E.valuation(state);
    E.recordHistory(state);
    if (FL.Fog) FL.Fog.init(state);
    if (FL.Growth) FL.Growth.init(state);
    if (FL.Rivals) FL.Rivals.init(state);
    if (FL.Systems) FL.Systems.onNewGame(state);
    state.qr = newQuarterReport(state);
    return state;
  };

  // ── Indicators & network ─────────────────────────────────
  E.bestRival = (state) => state.rivals.reduce((b, r) => (r.cap > b.cap ? r : b), state.rivals[0]);

  E.updateIndicators = function (state) {
    const v = state.values;
    v.capability = clamp(state.cap / E.AGI, 0, 1);
    // Markets, staff and the press react to the *perceived* race, not the hidden truth.
    const best = FL.Fog && state.intel ? FL.Fog.bestRivalEstimate(state).est : E.bestRival(state).cap;
    v.lead = clamp(0.5 + (state.cap - best) / 30, 0, 1);
    const net = state.finance.net;
    const runwayQ = net >= 0 ? 99 : state.cash / -net;
    v.runway = clamp(runwayQ / 8, 0, 1);
    const h = state.revHistory;
    const now = state.finance.revenue;
    const prev = h.length >= 4 ? h[h.length - 4] : 0;
    if (now < 20) v.revGrowth = 0.3;
    else {
      const g = clamp(now / Math.max(prev, 20) - 1, -1, 3);
      v.revGrowth = clamp(0.4 + 0.2 * g, 0, 1);
    }
  };

  E.shockTotal = function (state, id) {
    let s = 0;
    for (const sh of state.shocks) if (sh.to === id) s += (sh.amt * sh.left) / sh.turns;
    return s;
  };

  /** One step of the lagged effect network. instant=true ignores lags (used for warm start). */
  E.updateNetwork = function (state, instant, dt) {
    dt = dt || 1;
    const effects = E.allEffects();
    const src = {};
    for (const e of effects) if (!(e.from in src)) src[e.from] = E.sourceValue(state, e.from);
    const sums = {};
    const W = FL.World;
    for (const e of effects) {
      const target = e.k * (W ? W.edgeMult(state, e) : 1) * E.curve(e.curve, src[e.from]);
      const f = instant ? 1 : Math.min(1, dt / e.lag);
      const c = state.contrib[e.idx] || 0;
      state.contrib[e.idx] = c + (target - c) * f;
      sums[e.to] = (sums[e.to] || 0) + state.contrib[e.idx];
    }
    state.extra = {};
    for (const inp of E.extraInputs) {
      let m = {};
      try { m = inp.fn(state) || {}; } catch (err) { m = {}; }
      state.extra[inp.id] = m;
      for (const [k, v] of Object.entries(m)) if (Number.isFinite(v)) sums[k] = (sums[k] || 0) + v;
    }
    for (const s of FL.STATS) {
      const wm = FL.World ? FL.World.mod(state, 'base:' + s.id, 0) : 0;
      state.values[s.id] = clamp(s.base + wm + (state.baseMods[s.id] || 0) + (sums[s.id] || 0) + E.shockTotal(state, s.id), 0, 1);
    }
    for (const s of FL.STAKEHOLDERS) {
      state.happiness[s.id] = clamp(s.base + (sums[s.id] || 0) + E.shockTotal(state, s.id), -1, 1);
    }
    for (const s of FL.SITUATIONS) state.pressure[s.id] = s.base + (sums[s.id] || 0);
  };

  /** Toggle situations with hysteresis. Returns {started, ended}. */
  E.updateSituations = function (state, dt) {
    dt = dt || 1;
    const started = [], ended = [];
    for (const s of FL.SITUATIONS) {
      const p = state.pressure[s.id];
      if (!state.active[s.id] && p > s.on) { state.active[s.id] = dt; started.push(s.id); }
      else if (state.active[s.id] && p < s.off) { state.active[s.id] = 0; ended.push(s.id); }
      else if (state.active[s.id]) state.active[s.id] += dt;
    }
    return { started, ended };
  };

  // ── Money ────────────────────────────────────────────────
  E.costScale = function (state, scale) {
    const t = state.turn - 1;
    if (scale === 'compute') {
      const chips = state.policies.chips;
      const mature = chips && state.turn - chips.since >= 6;
      return 0.5 * Math.pow(E.diff(state).computeInflation, t) * (mature ? 1 - FL.POLICIES.find((p) => p.id === 'chips').special.computeDiscount * (0.2 + 0.8 * chips.level) : 1);
    }
    if (scale === 'payroll') return 0.5 * (1 + 0.05 * t);
    return 1;
  };
  E.policyCost = function (state, id, level) {
    const p = E.node(id).def;
    if (level == null) level = state.policies[id] ? state.policies[id].level : 0;
    return (p.cost[0] + (p.cost[1] - p.cost[0]) * level) * E.costScale(state, p.scale);
  };
  E.marketSize = (state) => 500 * Math.pow(1.085, state.turn - 1);

  /** Revenue and cost breakdown for the current quarter ($M). */
  E.computeFinances = function (state) {
    const v = state.values;
    const share = FL.Growth && state.growth ? FL.Growth.share(state) : v.adoption;
    const revenue = E.marketSize(state) * share * v.monetization * (FL.Events ? FL.Events.mult(state, 'revenue') : 1);
    const items = [];
    const catTotals = {};
    for (const [id] of Object.entries(state.policies)) {
      const c = E.policyCost(state, id);
      const cat = E.node(id).def.cat;
      catTotals[cat] = (catTotals[cat] || 0) + c;
    }
    FL.CATEGORIES.forEach((c) => { if (catTotals[c.id]) items.push({ label: c.name, amount: catTotals[c.id], color: c.color }); });
    items.push({ label: 'Inference serving', amount: v.adoption * 160 * E.costScale(state, 'compute'), color: '#94a3b8' });
    items.push({ label: 'G&A overhead', amount: 30 * E.costScale(state, 'payroll'), color: '#64748b' });
    if (FL.Hardware) items.push(...FL.Hardware.costItems(state));
    if (FL.Hiring) items.push(...FL.Hiring.costItems(state));
    for (const s of FL.SITUATIONS) {
      if (state.active[s.id] && s.special && s.special.cost) items.push({ label: s.name, amount: s.special.cost * (1 + 0.03 * state.turn), color: '#ef4444' });
    }
    const costs = items.reduce((a, b) => a + b.amount, 0);
    return { revenue, costs, net: revenue - costs, items };
  };

  E.approval = function (state) {
    let w = 0, s = 0;
    for (const sh of FL.STAKEHOLDERS) { w += sh.weight; s += sh.weight * state.happiness[sh.id]; }
    return s / w;
  };
  E.investorConfidence = (state) => 0.55 * state.happiness.investors + 0.3 * state.happiness.board + 0.15 * E.approval(state);

  E.valuation = function (state) {
    const v = state.values;
    const revAnnual = state.finance.revenue * 4;
    const mult = Math.max(5, 12 + 35 * v.hype + 25 * (v.lead - 0.5));
    const capPremium = Math.pow(state.cap, 1.3) * 500 * (0.6 + v.hype);
    let val = revAnnual * mult + capPremium + (FL.Hardware ? 0.5 * FL.Hardware.bookValue(state) : 0);
    const np = state.policies.nonprofit;
    if (np) val *= 1 - E.node('nonprofit').def.special.valuationHaircut * (0.2 + 0.8 * np.level);
    val *= 1 + 0.3 * E.investorConfidence(state);
    if (FL.Events) val *= FL.Events.mult(state, 'valuation');
    return Math.max(300, val);
  };

  /** Run a scheduled funding round. */
  E.fundingRound = function (state) {
    const conf = E.investorConfidence(state);
    const val = E.valuation(state);
    const name = E.ROUND_NAMES[Math.min(state.rounds.length, E.ROUND_NAMES.length - 1)];
    let raised, ok, text;
    if (conf < -0.35) {
      ok = false;
      raised = val * 0.04;
      text = `Investors balked. A humiliating down round raised only ${E.fmtMoney(raised)}.`;
      state.shocks.push({ to: 'board', amt: -0.25, turns: 6, left: 6 });
      state.shocks.push({ to: 'hype', amt: -0.08, turns: 4, left: 4 });
    } else {
      ok = true;
      raised = val * (0.14 + 0.06 * conf) * E.diff(state).fundingMult;
      text = `${name} closed: ${E.fmtMoney(raised)} at a ${E.fmtMoney(val)} valuation.`;
    }
    state.cash += raised;
    state.bridgesUsed = 0;
    state.ownership = (state.ownership || 100) * (val / (val + raised));
    const round = { turn: state.turn, name, raised, valuation: val, ok, text };
    state.rounds.push(round);
    return round;
  };

  E.fmtMoney = function (m) {
    const a = Math.abs(m), sign = m < 0 ? '-' : '';
    if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'T';
    if (a >= 1000) return sign + '$' + (a / 1000).toFixed(a >= 1e4 ? 0 : 1) + 'B';
    return sign + '$' + Math.round(a) + 'M';
  };

  // ── Capability race ──────────────────────────────────────
  E.pauseThreshold = function (state) {
    const r = state.policies.rsp;
    if (!r) return Infinity;
    return state.values.safety * 100 + 30 - 20 * r.level;
  };

  E.advanceCapability = function (state, dt) {
    dt = dt || 1;
    const t = state.turn - 1;
    let gain = 5.5 * state.values.velocity * (1 + 0.008 * t) * dt;
    if (FL.World) gain *= FL.World.mod(state, 'capGain', 1);
    if (FL.Events) gain *= FL.Events.mult(state, 'capGain');
    let paused = false;
    if (state.cap > E.pauseThreshold(state)) { gain *= 0.35; paused = true; }
    if (state.active.injunction) gain *= 0.5;
    state.cap += gain;
    return { gain, paused };
  };

  E.rivalBoost = function (state) {
    let boost = 0;
    for (const [id, p] of Object.entries(state.policies)) {
      const sp = E.node(id).def.special;
      if (sp && sp.rivalBoost) boost += sp.rivalBoost * (0.2 + 0.8 * p.level);
    }
    for (const s of FL.SITUATIONS) if (state.active[s.id] && s.special && s.special.rivalBoost) boost += s.special.rivalBoost;
    return boost;
  };
  E.rivalSlow = function (state) {
    const p = state.policies.poach;
    return p ? E.node('poach').def.special.rivalSlow * (0.2 + 0.8 * p.level) : 0;
  };

  E.advanceRivals = function (state, dt) {
    dt = dt || 1;
    const t = state.turn - 1;
    const news = [];
    const boost = E.rivalBoost(state), slow = E.rivalSlow(state);
    for (const r of state.rivals) {
      if (r.remote) continue; // other players' labs are updated from their own snapshots
      // Each lab has its own hidden momentum that drifts over time.
      r.momentum = clamp((r.momentum || 1) + (E.rand(state) - 0.5) * 0.12 * Math.sqrt(dt * 13), 0.6, 1.5);
      let rate = r.rate * (1 + 0.012 * t) * E.diff(state).rivalPace * r.momentum;
      if (FL.World) rate *= FL.World.mod(state, 'rivalPace', 1);
      if (r.paceUntil > state.week) rate *= r.paceMult;
      if (r.cap < state.cap - 15) rate *= 1.2; // fast followers distill the leader
      const before = r.cap;
      let step = (rate * (0.6 + 0.8 * E.rand(state)) * (1 - slow) + boost) * dt;
      if (E.rand(state) < 0.2 * dt) step += rate * (0.5 + 0.6 * E.rand(state)); // surprise breakthrough (~1 a year per lab)
      r.cap += step;
      if (Math.floor(r.cap / 10) > Math.floor(before / 10) && r.cap < E.AGI) {
        news.push(`${r.name} released a new frontier model.`);
        if (FL.Fog) FL.Fog.observeRival(state, r.id, Math.floor(r.cap / 10) * 10, 1.5, 'release');
      }
    }
    return news;
  };

  // ── Bandwidth & policy changes ───────────────────────────
  E.bandwidthIncome = function (state) {
    let inc = 4 + state.bandwidthMod + Math.round(3 * E.approval(state));
    for (const [id, p] of Object.entries(state.policies)) {
      const sp = E.node(id).def.special;
      if (sp && sp.bandwidth) inc += Math.round(sp.bandwidth * (0.2 + 0.8 * p.level));
    }
    for (const s of FL.SITUATIONS) if (state.active[s.id] && s.special && s.special.bandwidth) inc += s.special.bandwidth;
    return Math.max(1, inc);
  };

  /** Gross cost of moving a policy from `from` (level|null) to `to` (level|null). */
  function grossCost(def, from, to) {
    if (from === to) return 0;
    if (from == null) return def.intro;
    if (to == null) return Math.ceil(def.intro * 0.3);
    return Math.max(1, Math.ceil(Math.abs(to - from) * def.intro * 0.6));
  }

  /** Net bandwidth cost of setting a policy to newLevel (null = cancel) this turn.
   * Pricing is relative to the start-of-turn state, so reverting a change refunds it. */
  E.policyChangeCost = function (state, id, newLevel) {
    const def = E.node(id).def;
    const cur = state.policies[id] ? state.policies[id].level : null;
    const rec = state.turnChanges[id];
    const orig = rec ? rec.orig : cur;
    const spent = rec ? rec.spent : 0;
    const same = (a, b) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 1e-9);
    if (same(newLevel, orig)) return -spent;
    return grossCost(def, orig, newLevel) - spent;
  };

  E.changePolicy = function (state, id, newLevel) {
    if (newLevel != null) newLevel = clamp(Math.round(newLevel * 20) / 20, 0, 1);
    const cur = state.policies[id] || null;
    const net = E.policyChangeCost(state, id, newLevel);
    if (net > state.bandwidth) return { ok: false, reason: `Needs ${net} bandwidth (you have ${state.bandwidth}).` };
    if (!state.turnChanges[id]) state.turnChanges[id] = { orig: cur ? cur.level : null, origSince: cur ? cur.since : null, spent: 0 };
    const rec = state.turnChanges[id];
    state.bandwidth -= net;
    rec.spent += net;
    E.emit(state, { type: 'policy', text: newLevel == null ? `Cancelled ${E.node(id).def.name}` : `${cur ? 'Set' : 'Enacted'} ${E.node(id).def.name} at ${Math.round(newLevel * 100)}%` });
    if (newLevel == null) delete state.policies[id];
    else if (cur) cur.level = newLevel;
    else state.policies[id] = { level: newLevel, since: rec.orig != null ? rec.origSince : state.turn };
    if (rec.spent === 0 && ((rec.orig == null && newLevel == null) || (rec.orig != null && newLevel != null && Math.abs(rec.orig - newLevel) < 1e-9))) {
      if (state.policies[id]) state.policies[id].since = rec.origSince;
      delete state.turnChanges[id];
    }
    return { ok: true, cost: net };
  };
  E.implementPolicy = (state, id, level) => (state.policies[id] ? { ok: false, reason: 'Already active.' } : E.changePolicy(state, id, level == null ? 0.5 : level));
  E.adjustPolicy = (state, id, level) => (state.policies[id] ? E.changePolicy(state, id, level) : { ok: false, reason: 'Not active.' });
  E.cancelPolicy = (state, id) => (state.policies[id] ? E.changePolicy(state, id, null) : { ok: false, reason: 'Not active.' });

  // ── Dilemmas ─────────────────────────────────────────────
  /** Random decisions arrive as a Poisson process (rate per quarter from the director). */
  E.rollDilemma = function (state, dt) {
    dt = dt || 1;
    while (state.dilemmaQueue && state.dilemmaQueue.length) E.addDecision(state, state.dilemmaQueue.shift());
    const restless = FL.DILEMMAS.find((d) => d.id === 'boardRevolt');
    const lastRevolt = state.dilemmaSeen.boardRevolt;
    if (restless && state.happiness.board < -0.3 && (lastRevolt == null || state.turn - lastRevolt >= 4) && !state.inbox.some((x) => x.id === 'boardRevolt')) {
      state.dilemmaSeen[restless.id] = state.turn;
      return E.addDecision(state, restless.id);
    }
    if (state.inbox.length >= 3) return null;
    const chance = (FL.Systems ? FL.Systems.dilemmaChance(state) : 0.45) * dt;
    if (E.rand(state) > chance) return null;
    const eligible = FL.DILEMMAS.filter((d) => {
      const seen = state.dilemmaSeen[d.id];
      if (seen != null && (d.once || state.turn - seen < 8)) return false;
      try { return d.when(state, E); } catch (err) { return false; }
    });
    if (!eligible.length) return null;
    const d = eligible[Math.floor(E.rand(state) * eligible.length)];
    state.lastEventTurn = state.turn;
    state.dilemmaSeen[d.id] = state.turn;
    return E.addDecision(state, d.id);
  };

  function applyOutcome(state, o) {
    (o.fx || []).forEach(([to, amt, turns]) => state.shocks.push({ to, amt, turns: turns || 4, left: turns || 4 }));
    if (o.cash) state.cash += E.eventCash(state, o);
    if (o.bandwidth) state.bandwidth = Math.max(0, state.bandwidth + o.bandwidth);
    if (o.cap) state.cap = Math.max(0, state.cap + o.cap);
    if (o.rivalCap) E.bestRival(state).cap += o.rivalCap;
    if (o.enact) {
      const [pid, level] = o.enact;
      if (!state.policies[pid]) state.policies[pid] = { level, since: state.turn };
    }
    if (o.cancel) delete state.policies[o.cancel];
    if (o.spawnRival) E.spawnRival(state, o.spawnRival.name, o.spawnRival.frac);
    if (o.special === 'oust') state.flags.ousted = true;
    if (o.special === 'acquihire') state.flags.acquihired = true;
    if (o.special === 'reinstate') state.flags.reinstated = true;
    if (o.special === 'cultureReset' && FL.Hiring) FL.Hiring.cultureReset(state);
    if (o.dropPractice && state.people) state.people.practices[o.dropPractice] = false;
    if (o.meter) state.meters[o.meter[0]] = (state.meters[o.meter[0]] || 0) + o.meter[1];
  }

  /** Cash amounts in late-game events scale with the size of the company. */
  E.eventCash = (state, o) => (o.scaleCash ? o.cash * Math.pow(1.06, state.turn - 1) : o.cash);

  E.spawnRival = function (state, name, frac) {
    const colors = ['#c084fc', '#fb7185', '#2dd4bf', '#fde047'];
    const n = state.rivals.length;
    state.rivals.push({ id: 'spawn' + n, name, color: colors[n % colors.length], cap: state.cap * frac, rate: 2.0, spawned: state.turn });
    if (FL.Fog) FL.Fog.observeRival(state, 'spawn' + n, state.cap * frac, 3, 'founding announcement');
    state.flags.spawnedRival = true;
  };

  /** Apply the chosen option of the pending dilemma. Returns {text}. */
  E.resolveDilemma = function (state, optionIndex, uid) {
    const item = uid != null ? state.inbox.find((x) => x.uid === uid) : state.inbox[0];
    if (!item) return { text: '' };
    state.inbox = state.inbox.filter((x) => x !== item);
    E.syncPending(state);
    const d = FL.DILEMMAS.find((x) => x.id === item.id);
    if (!d) return { text: '' };
    const opt = d.options[optionIndex];
    applyOutcome(state, opt);
    let text = opt.desc;
    if (d.rival && FL.Rivals) text = FL.Rivals.resolve(state, item, optionIndex) || text;
    if (opt.chance) {
      let p = opt.chance.p;
      if (opt.chance.useStakeholder) p = clamp(0.5 + 0.5 * state.happiness[opt.chance.useStakeholder], 0.05, 0.95);
      let bad = E.rand(state) < (opt.chance.useStakeholder ? 1 - p : p);
      if ((opt.chance.launchViral || opt.chance.launchDemo) && FL.Marketing) bad = E.rand(state) >= FL.Marketing.launchChance(state, opt);
      const out = bad ? opt.chance.lose : opt.chance.win;
      if (out) { applyOutcome(state, out); text = out.text; }
      state._outcome = bad ? 'lose' : 'win';
    }
    E.updateIndicators(state);
    state.log.push({ turn: state.turn, text: `${d.title}: ${opt.label}` });
    E.emit(state, { type: 'decided', title: d.title, label: opt.label, result: text });
    const res = { text, artifacts: [], achievements: [] };
    if (FL.Systems) {
      FL.Systems.fireTrigger(state, `dilemma:${d.id}:${optionIndex}`, res);
      FL.Systems.fireTrigger(state, `dilemma:${d.id}`, res);
      if (state._outcome) FL.Systems.fireTrigger(state, `dilemma:${d.id}:${optionIndex}:${state._outcome}`, res);
      delete state._outcome;
      if (state.flags.reinstated && !state.flags.reinstatedSeen) { state.flags.reinstatedSeen = true; FL.Systems.fireTrigger(state, 'reinstated', res); }
      if (state.flags.spawnedRival) FL.Systems.fireTrigger(state, 'rival:spawned', res);
    }
    const end = E.checkEnding(state);
    if (end) {
      state.ended = end;
      res.ending = end;
      if (FL.Systems) FL.Systems.fireTrigger(state, 'ending:' + end.id, res);
    }
    return res;
  };

  // ── Endings ──────────────────────────────────────────────
  E.score = function (state) {
    return Math.round(state.cap * 10 + state.values.safety * 600 + E.approval(state) * 300 + Math.log10(Math.max(1, state.valuation)) * 100);
  };

  E.checkEnding = function (state) {
    const s = state.values.safety;
    const dif = E.diff(state);
    if (state.cap >= E.AGI) {
      if (s >= dif.aligned) return { id: 'aligned', win: true, title: 'Aligned AGI', text: `${state.company} built the first AGI — and it is on humanity's side. Safety maturity of ${Math.round(s * 100)}% held when it mattered. The hardest part starts now, but you got the beginning right.` };
      if (s >= dif.uneasy) return { id: 'uneasy', win: true, title: 'Uneasy Victory', text: `${state.company} reached AGI first. It mostly does what you want. Mostly. With ${Math.round(s * 100)}% safety maturity, nobody on the alignment team is sleeping well.` };
      return { id: 'misaligned', win: false, title: 'Misaligned', text: `${state.company} reached AGI first with only ${Math.round(s * 100)}% safety maturity. For a few weeks it was the most valuable company in history. Then the model's goals and yours stopped overlapping.` };
    }
    const rival = state.rivals.find((r) => r.cap >= E.AGI);
    if (rival) return { id: 'lostRace', win: false, title: 'Second Place', text: `${rival.name} announced AGI. Your models — at capability ${Math.floor(state.cap)} — are suddenly a footnote.` };
    if (state.flags.bankrupt) return { id: 'bankrupt', win: false, title: 'Out of Money', text: `${state.company} ran out of cash and nobody would bridge you. The GPUs went to a rival at auction.` };
    if (state.flags.acquihired) return { id: 'acquihired', win: false, title: 'Acquihired', text: `Big Tech hired you and most of ${state.company} and licensed the models. Investors got roughly their money back. The company that was going to build AGI is now a line item in someone else's earnings call.` };
    if (state.flags.ousted) return { id: 'ousted', win: false, title: 'Fired by the Board', text: 'The board announced it had "lost confidence in your leadership". You found out from a Google Meet invite.' };
    if (state.injunctionTurns >= 3) return { id: 'shutdown', win: false, title: 'Shut Down', text: 'After three quarters under a federal injunction, the company was broken up and its frontier program nationalised.' };
    if (state.turn > E.MAX_TURNS) return { id: 'timeout', win: E.approval(state) > 0 && state.cap > E.bestRival(state).cap, title: 'A Decade Later', text: `Ten years in, nobody has AGI yet. ${state.company} sits at capability ${Math.floor(state.cap)} against ${E.bestRival(state).name}'s ${Math.floor(E.bestRival(state).cap)}.` };
    return null;
  };

  // ── Turn loop ────────────────────────────────────────────
  E.recordHistory = function (state) {
    const push = (k, v) => (state.history[k] = state.history[k] || []).push(v);
    FL.STATS.forEach((s) => push(s.id, state.values[s.id]));
    FL.INDICATORS.forEach((s) => push(s.id, state.values[s.id]));
    FL.STAKEHOLDERS.forEach((s) => push(s.id, state.happiness[s.id]));
    FL.SITUATIONS.forEach((s) => push(s.id, state.pressure[s.id]));
    push('_cash', state.cash);
    push('_cap', state.cap);
    push('_revenue', state.finance.revenue);
    push('_costs', state.finance.costs);
    push('_approval', E.approval(state));
    state.rivals.forEach((r) => push('_rival_' + r.id, r.cap));
  };

  // ── Real time ────────────────────────────────────────────
  E.TICKS_PER_Q = 13; // one tick = one game week
  E.DT = 1 / E.TICKS_PER_Q;

  E.emit = (state, ev) => {
    ev = Object.assign({ week: state.week }, ev);
    (state.events = state.events || []).push(ev);
    if (state.events.length > 200) state.events.splice(0, state.events.length - 200);
    E.journal(state, ev);
  };
  E.weekOfQuarter = (state) => state.week % E.TICKS_PER_Q;
  E.timeLabel = (state) => `${E.quarterLabel(state.turn)} · week ${E.weekOfQuarter(state) + 1}`;

  function newQuarterReport(state) {
    return { turn: state.turn, label: E.quarterLabel(state.turn), warnings: [], news: [], started: [], ended: [], milestones: [], artifacts: [], achievements: [],
      pitfallWarnings: [], campaigns: [], expired: [], objectives: { done: [], failed: [], dealt: [] }, finance: { revenue: 0, costs: 0, net: 0, items: [] },
      capGain: 0, paused: false, before: { ...state.values, _cap: state.cap, _val: state.valuation } };
  }

  // ── Decision inbox ──────────────────────────────────────
  /** Title/text/options for an inbox item (rival proposals are rendered dynamically). */
  E.dilemmaView = function (state, item) {
    const d = FL.DILEMMAS.find((x) => x.id === item.id);
    if (d && d.rival && FL.Rivals) return FL.Rivals.render(state, item);
    return d;
  };
  E.syncPending = (state) => { state.pendingDilemma = state.inbox.length ? state.inbox[0].id : null; };
  E.addDecision = function (state, dilemmaId, weeks) {
    const d = FL.DILEMMAS.find((x) => x.id === dilemmaId);
    if (!d) return null;
    weeks = weeks || d.deadlineWeeks || (d.pitfall ? 5 : d.launch ? 4 : 6);
    const item = { uid: (state.nextUid = (state.nextUid || 0) + 1), id: dilemmaId, arrived: state.week, deadline: state.week + weeks };
    state.inbox.push(item);
    E.syncPending(state);
    E.emit(state, { type: 'decision', uid: item.uid, id: dilemmaId });
    return dilemmaId;
  };
  /** Default when time runs out: the dilemma's `default`, else its last (most passive) option. */
  E.defaultOption = (d) => (d.default != null ? d.default : d.options.length - 1);
  E.expireDecisions = function (state, qr) {
    for (const item of state.inbox.slice()) {
      if (state.week < item.deadline) continue;
      const d = FL.DILEMMAS.find((x) => x.id === item.id);
      const opt = E.defaultOption(d);
      const res = E.resolveDilemma(state, opt, item.uid);
      const line = `You ran out of time on "${d.title}" — ${d.options[opt].label.toLowerCase()} by default.`;
      if (qr) qr.expired.push(line);
      E.emit(state, { type: 'expired', id: item.id, text: line, result: res.text });
    }
  };

  /** Advance the world by one game week. Returns the quarter report when a quarter ends. */
  E.tick = function (state) {
    if (state.ended) return null;
    const dt = E.DT;
    if (!state.qr) state.qr = newQuarterReport(state);
    const qr = state.qr;

    const f = E.computeFinances(state);
    state.finance = f;
    state.cash += f.net * dt;
    qr.finance.revenue += f.revenue * dt;
    qr.finance.costs += f.costs * dt;
    qr.finance.net += f.net * dt;
    if (FL.Hardware) FL.Hardware.update(state, qr, dt);
    if (FL.Hiring) FL.Hiring.update(state, qr, dt);
    if (FL.Marketing) FL.Marketing.update(state, qr, dt);

    const capRes = E.advanceCapability(state, dt);
    qr.capGain += capRes.gain;
    if (capRes.paused && !qr.paused) { qr.paused = true; E.emit(state, { type: 'paused' }); }
    const news = E.advanceRivals(state, dt);
    news.forEach((n) => { qr.news.push(n); E.emit(state, { type: 'news', text: n }); });

    E.updateIndicators(state);
    E.updateNetwork(state, false, dt);
    state.shocks.forEach((sh) => (sh.left -= dt));
    state.shocks = state.shocks.filter((sh) => sh.left > 1e-9);
    const sit = E.updateSituations(state, dt);
    sit.started.forEach((id) => { qr.started.push(id); E.emit(state, { type: 'situation', id, on: true }); });
    sit.ended.forEach((id) => { qr.ended.push(id); E.emit(state, { type: 'situation', id, on: false }); });

    state.bandwidth = Math.min(E.BANDWIDTH_CAP, state.bandwidth + E.bandwidthIncome(state) * dt);

    if (state.cash < 0) {
      if ((state.bridgesUsed || 0) < E.diff(state).bridges && E.investorConfidence(state) > -0.4) {
        const amt = Math.max(-state.cash + 2 * Math.max(0, -state.finance.net), E.valuation(state) * 0.08);
        state.cash += amt;
        state.bridgesUsed = (state.bridgesUsed || 0) + 1;
        state.shocks.push({ to: 'board', amt: -0.3, turns: 6, left: 6 });
        state.shocks.push({ to: 'investors', amt: -0.2, turns: 6, left: 6 });
        qr.bridge = `You ran out of cash. Investors grudgingly wired a ${E.fmtMoney(amt)} emergency bridge.${state.bridgesUsed >= E.diff(state).bridges ? " They won't do it again before the next round." : ''}`;
        E.emit(state, { type: 'bridge', text: qr.bridge });
      } else state.flags.bankrupt = true;
    }

    if (FL.World) FL.World.tick(state, qr, dt);
    if (FL.Fog) FL.Fog.tick(state, qr, dt);
    if (FL.Systems) FL.Systems.tick(state, qr, dt);
    if (FL.Growth) FL.Growth.tick(state, qr, dt);
    if (FL.Events) FL.Events.tick(state, qr, dt);
    if (FL.Rivals) FL.Rivals.tick(state, qr, dt);
    E.rollDilemma(state, dt);

    state.week++;
    state.t = state.week / E.TICKS_PER_Q;
    E.recordMetrics(state);
    E.expireDecisions(state, qr);

    let report = null;
    if (state.week % E.TICKS_PER_Q === 0) report = E.quarterBoundary(state);

    if (!state.ended) {
      const end = E.checkEnding(state);
      if (end) {
        state.ended = end;
        (report || qr).ending = end;
        if (FL.Systems) FL.Systems.fireTrigger(state, 'ending:' + end.id, report || qr);
        E.emit(state, { type: 'ending', ending: end });
      }
    }
    return report;
  };

  /** Quarter-end bookkeeping; returns the finished quarter's newspaper report. */
  E.quarterBoundary = function (state) {
    const report = state.qr;
    const before = report.before;
    delete report.before;
    state.revHistory.push(report.finance.revenue);

    if (state.turn === state.nextRound) {
      report.funding = E.fundingRound(state);
      state.nextRound += E.ROUND_EVERY;
      E.emit(state, { type: 'funding', round: report.funding });
    }
    if (state.happiness.board < -0.45) {
      state.badBoardTurns++;
      const grace = E.diff(state).coupGrace;
      if (state.badBoardTurns >= grace && E.rand(state) < 0.35 + 0.15 * (state.badBoardTurns - grace)) state.flags.ousted = true;
      else report.warnings.push('The board is openly discussing replacing you. Win them back fast: runway, regulators and lawsuits are what they care about.');
    } else state.badBoardTurns = 0;
    if (state.active.injunction) {
      state.injunctionTurns++;
      report.warnings.push(`Federal injunction: quarter ${state.injunctionTurns} of 3 before shutdown.`);
    } else state.injunctionTurns = 0;

    state.finance = E.computeFinances(state);
    E.updateIndicators(state);
    state.valuation = E.valuation(state);
    if (state.values.runway < 0.25 && state.finance.net < 0) report.warnings.push(`Runway is down to ${(state.cash / -state.finance.net).toFixed(1)} quarters.`);

    state.turn++;
    state.turnChanges = {};
    E.recordHistory(state);
    report.deltas = FL.STATS.concat(FL.INDICATORS)
      .map((x) => ({ id: x.id, name: x.name, good: x.good, from: before[x.id], to: state.values[x.id] }))
      .filter((d) => Math.abs(d.to - d.from) >= 0.02)
      .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
    if (FL.Hiring && FL.Hiring.quarter) FL.Hiring.quarter(state, report);
    if (FL.Fog && FL.Fog.quarter) FL.Fog.quarter(state, report);
    if (FL.Systems) FL.Systems.quarter(state, report, before);
    report.dilemma = state.pendingDilemma;
    state.newspapers = (state.newspapers || []).concat([report]).slice(-8);
    E._lastPaper = report.headline || {};
    state.qr = newQuarterReport(state);
    E.emit(state, { type: 'newspaper', turn: report.turn });
    return report;
  };

  /** Advance to the end of the current quarter (used by tests, the simulator and bots). */
  E.endTurn = function (state) {
    if (state.ended) return null;
    const start = state.turn;
    let report = null;
    while (!state.ended && state.turn === start) report = E.tick(state) || report;
    if (!report) { report = state.qr || newQuarterReport(state); delete report.before; report.ending = state.ended; report.deltas = report.deltas || []; }
    return report;
  };

  /** Journal: a fog-safe, persistent log of everything observable (for the player and an assisting LLM).
   * Only events the player could see go in; hidden state never does. */
  const JOURNAL_SKIP = new Set(['buffEnded', 'unlock']);
  E.journalText = function (ev) {
    const nm = (id) => (E.node(id) ? E.node(id).def.name : id);
    switch (ev.type) {
      case 'decision': { const d = FL.DILEMMAS.find((x) => x.id === ev.id); return `Decision arrived: ${d ? d.title : ev.id}`; }
      case 'decided': return `You chose "${ev.label}" on "${ev.title}": ${ev.result}`;
      case 'expired': return ev.text;
      case 'situation': return `${nm(ev.id)} ${ev.on ? 'started' : 'ended'}`;
      case 'warning': return `Warning sign (${ev.horizon}-term, ${ev.name}): ${ev.text}`;
      case 'milestone': return ev.kind === 'model' ? `Shipped model ${ev.name} (capability ${ev.at})` : `Valuation milestone: ${ev.name}`;
      case 'funding': return ev.round.text;
      case 'policy': return ev.text;
      case 'world': return `World event: ${ev.title}${ev.hitYou ? ' (hit you)' : ' (you were spared)'} — ${ev.text}${ev.rivalsHit && ev.rivalsHit.length ? ` Rivals hit: ${ev.rivalsHit.join(', ')}.` : ''}`;
      case 'opp': return `Opportunity appeared: ${ev.name}${ev.wrath ? ' (risky)' : ''}`;
      case 'oppMissed': return `Opportunity missed: ${ev.name}`;
      case 'claimed': return `Claimed ${ev.name}: ${ev.text}`;
      case 'buff': return `Effect started: ${ev.name} (${ev.weeks} weeks)`;
      case 'users': return `Reached ${ev.text}`;
      case 'interaction': return ev.text;
      case 'attacked': return `Rival move: ${ev.text}`;
      case 'newspaper': { const n = (FL.Engine._lastPaper || {}); return `Quarterly newspaper printed${n.head ? ': "' + n.head + '"' : ''}`; }
      case 'newGen': return `New chip generation shipping: ${ev.name}`;
      case 'hired': return `Hired ${ev.name}${ev.headline ? ', ' + ev.headline : ''}`;
      case 'left': return `${ev.name} left (${ev.headline})`;
      case 'campaign': return `Campaign ${ev.name}: ${ev.label}`;
      case 'objective': return `Objective ${ev.done ? 'completed' : 'missed'}: ${ev.text}`;
      case 'intel': return `New read on ${ev.rival} (${ev.source})`;
      case 'note': return `Analyst note (unverified): ${ev.text}`;
      case 'era': return `New era: ${ev.era}`;
      case 'leak': return 'Internal documents leaked to the press';
      case 'offer': return `Compute deal offered: ${ev.provider} — ${ev.kind}`;
      case 'leaseEnded': return `Lease ended: ${ev.name}`;
      case 'paused': return 'Responsible Scaling Policy slowed scaling: capability outran safety';
      default: return ev.text || ev.name || ev.type;
    }
  };
  E.journal = function (state, ev) {
    if (JOURNAL_SKIP.has(ev.type)) return;
    state.journal = state.journal || [];
    state.journal.push({ week: ev.week, when: `${E.quarterLabel(Math.floor(ev.week / E.TICKS_PER_Q) + 1)} wk ${(ev.week % E.TICKS_PER_Q) + 1}`, type: ev.type, text: E.journalText(ev) });
    if (state.journal.length > 3000) state.journal.splice(0, state.journal.length - 3000);
  };

  /** Weekly observable metrics series (what the player could have written down). */
  E.recordMetrics = function (state) {
    const F = FL.Fog;
    const row = { week: state.week, cash: Math.round(state.cash), revenueRate: Math.round(state.finance.revenue), costRate: Math.round(state.finance.costs),
      users: FL.Growth && state.growth ? Math.round(FL.Growth.users(state)) : null, appeal: +state.values.adoption.toFixed(3), capability: +state.cap.toFixed(2),
      valuation: Math.round(state.valuation), bandwidth: Math.floor(state.bandwidth), hype: +state.values.hype.toFixed(3), brand: +state.values.brand.toFixed(3),
      safetyEval: F ? +F.measured(state, 'safety').est.toFixed(3) : null, trustPoll: F ? +F.measured(state, 'trust').est.toFixed(3) : null,
      rivals: F ? Object.fromEntries(state.rivals.map((r) => [r.name, Math.round(F.rivalEstimate(state, r).est)])) : null };
    state.metrics = state.metrics || [];
    state.metrics.push(row);
    if (state.metrics.length > 560) state.metrics.splice(0, state.metrics.length - 560);
  };

  E.serialize = (state) => JSON.stringify(state);
  E.deserialize = (json) => JSON.parse(json);

  FL.Engine = E;
})(globalThis.FL = globalThis.FL || {});
