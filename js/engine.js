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
    };
    Object.entries(arch.policies).forEach(([id, level]) => (state.policies[id] = { level, since: -8 }));
    FL.STATS.forEach((s) => (state.values[s.id] = s.base + (state.baseMods[s.id] || 0)));
    FL.STAKEHOLDERS.forEach((s) => (state.happiness[s.id] = s.base));
    FL.SITUATIONS.forEach((s) => { state.pressure[s.id] = 0; state.active[s.id] = 0; });
    E.allEffects().forEach((e) => (state.contrib[e.idx] = 0));
    state.ownership = 100;
    if (FL.Hardware) FL.Hardware.init(state, arch);
    if (FL.Hiring) FL.Hiring.init(state, arch);

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
    if (FL.Systems) FL.Systems.onNewGame(state);
    return state;
  };

  // ── Indicators & network ─────────────────────────────────
  E.bestRival = (state) => state.rivals.reduce((b, r) => (r.cap > b.cap ? r : b), state.rivals[0]);

  E.updateIndicators = function (state) {
    const v = state.values;
    v.capability = clamp(state.cap / E.AGI, 0, 1);
    v.lead = clamp(0.5 + (state.cap - E.bestRival(state).cap) / 30, 0, 1);
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
  E.updateNetwork = function (state, instant) {
    const effects = E.allEffects();
    const src = {};
    for (const e of effects) if (!(e.from in src)) src[e.from] = E.sourceValue(state, e.from);
    const sums = {};
    for (const e of effects) {
      const target = e.k * E.curve(e.curve, src[e.from]);
      const lag = instant ? 1 : e.lag;
      const c = state.contrib[e.idx] || 0;
      state.contrib[e.idx] = c + (target - c) / lag;
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
      state.values[s.id] = clamp(s.base + (state.baseMods[s.id] || 0) + (sums[s.id] || 0) + E.shockTotal(state, s.id), 0, 1);
    }
    for (const s of FL.STAKEHOLDERS) {
      state.happiness[s.id] = clamp(s.base + (sums[s.id] || 0) + E.shockTotal(state, s.id), -1, 1);
    }
    for (const s of FL.SITUATIONS) state.pressure[s.id] = s.base + (sums[s.id] || 0);
  };

  /** Toggle situations with hysteresis. Returns {started, ended}. */
  E.updateSituations = function (state) {
    const started = [], ended = [];
    for (const s of FL.SITUATIONS) {
      const p = state.pressure[s.id];
      if (!state.active[s.id] && p > s.on) { state.active[s.id] = 1; started.push(s.id); }
      else if (state.active[s.id] && p < s.off) { state.active[s.id] = 0; ended.push(s.id); }
      else if (state.active[s.id]) state.active[s.id]++;
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
    const revenue = E.marketSize(state) * v.adoption * v.monetization;
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

  E.advanceCapability = function (state) {
    const t = state.turn - 1;
    let gain = 5.5 * state.values.velocity * (1 + 0.008 * t);
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

  E.advanceRivals = function (state) {
    const t = state.turn - 1;
    const news = [];
    const boost = E.rivalBoost(state), slow = E.rivalSlow(state);
    for (const r of state.rivals) {
      let rate = r.rate * (1 + 0.012 * t) * E.diff(state).rivalPace;
      if (r.cap < state.cap - 15) rate *= 1.2; // fast followers distill the leader
      const before = r.cap;
      r.cap += rate * (0.7 + 0.6 * E.rand(state)) * (1 - slow) + boost;
      if (Math.floor(r.cap / 10) > Math.floor(before / 10) && r.cap < E.AGI) {
        news.push(`${r.name} released a new frontier model (capability ${Math.floor(r.cap)}).`);
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
  E.rollDilemma = function (state) {
    if (state.pendingDilemma) return null;
    if (state.dilemmaQueue && state.dilemmaQueue.length) {
      state.pendingDilemma = state.dilemmaQueue.shift();
      return state.pendingDilemma;
    }
    const restless = FL.DILEMMAS.find((d) => d.id === 'boardRevolt');
    const lastRevolt = state.dilemmaSeen.boardRevolt;
    if (restless && state.happiness.board < -0.3 && (lastRevolt == null || state.turn - lastRevolt >= 4)) {
      state.pendingDilemma = restless.id;
      state.dilemmaSeen[restless.id] = state.turn;
      return restless.id;
    }
    const chance = FL.Systems ? FL.Systems.dilemmaChance(state) : 0.45;
    if (E.rand(state) > chance) return null;
    const eligible = FL.DILEMMAS.filter((d) => {
      const seen = state.dilemmaSeen[d.id];
      if (seen != null && (d.once || state.turn - seen < 8)) return false;
      try { return d.when(state, E); } catch (err) { return false; }
    });
    if (!eligible.length) return null;
    const d = eligible[Math.floor(E.rand(state) * eligible.length)];
    state.pendingDilemma = d.id;
    state.lastEventTurn = state.turn;
    state.dilemmaSeen[d.id] = state.turn;
    return d.id;
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
  }

  /** Cash amounts in late-game events scale with the size of the company. */
  E.eventCash = (state, o) => (o.scaleCash ? o.cash * Math.pow(1.06, state.turn - 1) : o.cash);

  E.spawnRival = function (state, name, frac) {
    const colors = ['#c084fc', '#fb7185', '#2dd4bf', '#fde047'];
    const n = state.rivals.length;
    state.rivals.push({ id: 'spawn' + n, name, color: colors[n % colors.length], cap: state.cap * frac, rate: 2.0, spawned: state.turn });
    state.flags.spawnedRival = true;
  };

  /** Apply the chosen option of the pending dilemma. Returns {text}. */
  E.resolveDilemma = function (state, optionIndex) {
    const d = FL.DILEMMAS.find((x) => x.id === state.pendingDilemma);
    state.pendingDilemma = null;
    if (!d) return { text: '' };
    const opt = d.options[optionIndex];
    applyOutcome(state, opt);
    let text = opt.desc;
    if (opt.chance) {
      let p = opt.chance.p;
      if (opt.chance.useStakeholder) p = clamp(0.5 + 0.5 * state.happiness[opt.chance.useStakeholder], 0.05, 0.95);
      const bad = E.rand(state) < (opt.chance.useStakeholder ? 1 - p : p);
      const out = bad ? opt.chance.lose : opt.chance.win;
      if (out) { applyOutcome(state, out); text = out.text; }
    }
    E.updateIndicators(state);
    state.log.push({ turn: state.turn, text: `${d.title}: ${opt.label}` });
    const res = { text, artifacts: [], achievements: [] };
    if (FL.Systems) {
      FL.Systems.fireTrigger(state, `dilemma:${d.id}:${optionIndex}`, res);
      FL.Systems.fireTrigger(state, `dilemma:${d.id}`, res);
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

  /** Advance one quarter; returns a report for the UI. */
  E.endTurn = function (state) {
    if (state.ended) return null;
    const before = { ...state.values, _cap: state.cap, _val: state.valuation };
    const label = E.quarterLabel(state.turn);
    const report = { turn: state.turn, label, warnings: [], news: [] };

    state.finance = E.computeFinances(state);
    state.cash += state.finance.net;
    state.revHistory.push(state.finance.revenue);
    report.finance = { ...state.finance };
    if (FL.Hardware) FL.Hardware.update(state, report);
    if (FL.Hiring) FL.Hiring.update(state, report);

    const capRes = E.advanceCapability(state);
    report.capGain = capRes.gain;
    report.paused = capRes.paused;
    report.news.push(...E.advanceRivals(state));

    E.updateIndicators(state);
    E.updateNetwork(state, false);
    state.shocks.forEach((s) => s.left--);
    state.shocks = state.shocks.filter((s) => s.left > 0);
    const sit = E.updateSituations(state);
    report.started = sit.started;
    report.ended = sit.ended;

    const income = E.bandwidthIncome(state);
    state.bandwidth = Math.min(E.BANDWIDTH_CAP, state.bandwidth + income);
    report.bandwidthIncome = income;

    if (state.turn === state.nextRound) {
      report.funding = E.fundingRound(state);
      state.nextRound += E.ROUND_EVERY;
    }

    if (state.cash < 0) {
      if ((state.bridgesUsed || 0) < E.diff(state).bridges && E.investorConfidence(state) > -0.4) {
        const amt = Math.max(-state.cash + 2 * Math.max(0, -state.finance.net), E.valuation(state) * 0.08);
        state.cash += amt;
        state.bridgesUsed = (state.bridgesUsed || 0) + 1;
        state.shocks.push({ to: 'board', amt: -0.3, turns: 6, left: 6 });
        state.shocks.push({ to: 'investors', amt: -0.2, turns: 6, left: 6 });
        report.bridge = `You ran out of cash. Investors grudgingly wired a ${E.fmtMoney(amt)} emergency bridge.${state.bridgesUsed >= E.diff(state).bridges ? " They won't do it again before the next round." : ''}`;
      } else state.flags.bankrupt = true;
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

    state.finance = E.computeFinances(state); // preview of next quarter at new values
    E.updateIndicators(state);
    state.valuation = E.valuation(state);
    if (state.values.runway < 0.25 && state.finance.net < 0) report.warnings.push(`Runway is down to ${(state.cash / -state.finance.net).toFixed(1)} quarters.`);

    state.turn++;
    state.turnChanges = {};
    E.recordHistory(state);

    report.deltas = FL.STATS.concat(FL.INDICATORS)
      .map((s) => ({ id: s.id, name: s.name, icon: s.icon, good: s.good, from: before[s.id], to: state.values[s.id] }))
      .filter((d) => Math.abs(d.to - d.from) >= 0.02)
      .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));

    if (FL.Systems) FL.Systems.run(state, report, before);
    report.ending = E.checkEnding(state);
    if (report.ending) {
      state.ended = report.ending;
      if (FL.Systems) FL.Systems.fireTrigger(state, 'ending:' + report.ending.id, report);
    } else report.dilemma = E.rollDilemma(state);
    return report;
  };

  E.serialize = (state) => JSON.stringify(state);
  E.deserialize = (json) => JSON.parse(json);

  FL.Engine = E;
})(globalThis.FL = globalThis.FL || {});
