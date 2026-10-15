/* growth.js — Plague Inc-style user growth: users spread region by region toward your product's
 * appeal (the Adoption stat), pulled by virality, brand and neighbouring regions, held back by
 * price, regulation and bans. Revenue is earned on actual users, not on the abstract appeal stat. */
(function (FL) {
  'use strict';
  const E = FL.Engine;
  const G = {};
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const strength = (s, id) => (s.policies[id] ? 0.2 + 0.8 * s.policies[id].level : 0);
  const DAU_RATIO = 0.35;
  const SPREAD = 3.8;   // logistic spread rate per quarter
  const CHURN = 1.4;    // pull-back rate per quarter when users exceed appeal

  G.init = function (state) {
    // Normalise so that, with no events, the population-weighted target equals the Adoption stat.
    const tot = FL.REGIONS.reduce((a, r) => a + r.pop, 0);
    const w = FL.REGIONS.reduce((a, r) => a + r.pop * r.appetite * r.access, 0);
    state.growth = { u: {}, mods: {}, K: tot / w, peakUsers: 0, milestones: {}, history: [] };
    for (const r of FL.REGIONS) state.growth.u[r.id] = state.values.adoption * 0.5 * r.access;
  };

  /** Temporary regional modifiers from world events: ban suppresses, boost multiplies access/appetite. */
  G.regionMod = function (state, id) {
    const m = state.growth.mods[id];
    if (!m || m.until <= state.week) return { ban: 0, boost: 1 };
    return { ban: m.ban || 0, boost: m.boost || 1 };
  };
  G.setRegionMod = function (state, id, mod, weeks) {
    state.growth.mods[id] = { ...mod, until: state.week + weeks };
  };

  G.regionTarget = function (state, r) {
    const appeal = state.values.adoption;
    const m = G.regionMod(state, r.id);
    const access = Math.min(1, r.access * (r.id === 'china' ? m.boost : 1));
    const appetite = r.appetite * (r.id !== 'china' ? m.boost : 1);
    const price = strength(state, 'pricing') - strength(state, 'freeTier');
    const priceFactor = 1 - r.priceSens * 0.35 * price;
    const regFactor = 1 - r.reg * 0.25 * Math.max(0, state.values.regHeat - 0.3);
    return clamp(appeal * appetite * access * state.growth.K * priceFactor * regFactor * (1 - m.ban), 0, 0.95);
  };

  G.tick = function (state, qr, dt) {
    const g = state.growth;
    if (!g) return;
    const virality = 0.6 + state.values.hype * 0.8 + (state.active.viral ? 0.6 : 0);
    const seedBase = 0.004 + state.values.brand * 0.02 + strength(state, 'marketing') * 0.01;
    for (const r of FL.REGIONS) {
      const u = g.u[r.id];
      const T = G.regionTarget(state, r);
      const neigh = r.near.reduce((a, id) => a + g.u[id], 0) / r.near.length;
      if (T > u) g.u[r.id] = Math.min(T, u + dt * SPREAD * virality * (u + seedBase + 0.3 * neigh) * (T - u));
      else g.u[r.id] = Math.max(T, u - dt * CHURN * (u - T));
    }
    const users = G.users(state);
    for (const ms of FL.USER_MILESTONES) {
      if (users >= ms && !g.milestones[ms]) {
        g.milestones[ms] = state.week;
        const label = ms >= 1000 ? `${ms / 1000} billion` : `${ms} million`;
        E.emit(state, { type: 'users', millions: ms, text: `${label} users` });
        if (FL.Systems) FL.Systems.fireTrigger(state, 'users:' + ms, qr);
      }
    }
    g.peakUsers = Math.max(g.peakUsers, users);
    G.tickCanon(state, qr);
  };

  G.users = (state) => FL.REGIONS.reduce((a, r) => a + r.pop * state.growth.u[r.id], 0); // millions
  G.share = function (state) {
    if (!state.growth) return state.values.adoption;
    return G.users(state) / FL.REGIONS.reduce((a, r) => a + r.pop, 0);
  };

  /** Quarter-over-quarter growth from the weekly metrics series. */
  G.growthRate = function (state) {
    const m = state.metrics || [];
    if (m.length < 14) return null;
    const now = m[m.length - 1].users, then = m[m.length - 14].users;
    return then > 0.5 ? now / then - 1 : null;
  };

  G.summary = function (state) {
    const users = G.users(state);
    return {
      users, dau: users * DAU_RATIO, share: G.share(state), appeal: state.values.adoption, growthQoQ: G.growthRate(state),
      regions: FL.REGIONS.map((r) => ({ id: r.id, name: r.name, share: state.growth.u[r.id], users: state.growth.u[r.id] * r.pop, target: G.regionTarget(state, r), event: G.regionMod(state, r.id) })),
    };
  };

  // ── The startup scorecard (Blitzscaling, YC, PMF, burn multiple, default alive) ──
  const PAYROLL_POLICIES = ['comp', 'tenders', 'hiring', 'culture', 'entSales', 'alignment', 'interp', 'redteam', 'secProgram', 'execTeam', 'devRel', 'prTeam', 'poach'];
  /** Rough headcount: named hires plus what your payroll-heavy programs imply. */
  G.headcount = function (state) {
    const spend = PAYROLL_POLICIES.reduce((a, id) => a + (state.policies[id] ? E.policyCost(state, id) : 0), 0);
    return Math.round(12 + spend / 2.5 + (state.people ? state.people.roster.length : 0));
  };
  G.stage = function (state) {
    const h = G.headcount(state);
    let st = FL.BLITZ_STAGES[0];
    for (const s of FL.BLITZ_STAGES) if (h >= s.min) st = s;
    return st;
  };
  /** Coordination cost of size: lost bandwidth unless the executive team scales with you. */
  G.stageBandwidth = function (state) {
    const st = G.stage(state);
    const exec = strength(state, 'execTeam');
    return Math.min(0, (st.bandwidth || 0) + Math.floor(exec * 2.5));
  };
  G.stageToxicity = (state) => (G.stage(state).toxicity || 0) * (state.people && state.people.practices.hrTeam ? 0.3 : 1);

  /** Week-over-week user growth, averaged over the last four weeks. */
  G.weeklyGrowth = function (state) {
    const m = state.metrics || [];
    if (m.length < 6) return null;
    const a = m[m.length - 5].users, b = m[m.length - 1].users;
    return a > 0.5 ? Math.pow(b / a, 1 / 4) - 1 : null;
  };

  /** Sean Ellis-style PMF: share of users who would be "very disappointed" without you. */
  G.pmf = function (state) {
    const v = state.values;
    const retention = v.adoption > 0.01 ? Math.min(1, G.share(state) / v.adoption) : 0;
    const plays = FL.Playbook ? FL.Playbook.mod(state, 'pmf', 0) : 0;
    return clamp(0.05 + 0.45 * v.quality + 0.2 * retention + 0.1 * v.brand + 0.1 * (v.trust - 0.5) + 0.1 * (state.active.viral ? 1 : 0) + plays, 0, 0.95);
  };

  /** Burn multiple: net burn per quarter / net new ARR per quarter. Null while there is no ARR growth. */
  G.burnMultiple = function (state) {
    const h = state.revHistory || [];
    if (h.length < 2) return null;
    const newArr = (h[h.length - 1] - h[h.length - 2]) * 4;
    const burn = Math.max(0, -state.finance.net);
    if (burn === 0) return 0;
    return newArr > 1 ? burn / newArr : null;
  };
  G.burnLabel = (bm) => (bm == null ? 'n/a (no new ARR)' : FL.BURN_TIERS.find((t) => bm <= t.max).label);

  /** Default alive (Paul Graham): at today's costs and recent revenue growth, do you reach profitability before the money runs out? */
  G.defaultAlive = function (state) {
    const h = state.revHistory || [];
    let rev = state.finance.revenue, cost = state.finance.costs, cash = state.cash;
    const g = h.length >= 2 && h[h.length - 2] > 5 ? clamp(h[h.length - 1] / h[h.length - 2] - 1, -0.5, 1.5) : 0;
    for (let q = 1; q <= 40; q++) {
      rev *= 1 + g;
      cash += rev - cost;
      if (rev >= cost) return { alive: true, quarters: q, growth: g };
      if (cash < 0) return { alive: false, quarters: q, growth: g };
    }
    return { alive: false, quarters: 40, growth: g };
  };

  G.scorecard = function (state) {
    const st = G.stage(state), wg = G.weeklyGrowth(state), bm = G.burnMultiple(state), da = G.defaultAlive(state);
    return { headcount: G.headcount(state), stage: st.name, stageNote: st.note, weeklyGrowth: wg, ycBar: FL.YC_GROWTH.good,
      pmf: G.pmf(state), pmfBar: FL.PMF_BAR, burnMultiple: bm, burnLabel: G.burnLabel(bm), defaultAlive: da };
  };

  /** Weekly: stage transitions and canon milestones become events (and archive triggers). */
  G.tickCanon = function (state, qr) {
    const st = G.stage(state);
    if (state.growth.stage !== st.id) {
      const first = !state.growth.stage;
      state.growth.stage = st.id;
      if (!first) { E.emit(state, { type: 'stage', name: st.name, note: st.note }); if (FL.Systems) FL.Systems.fireTrigger(state, 'stage:' + st.id, qr); }
    }
    const pmf = G.pmf(state) >= FL.PMF_BAR;
    if (pmf && !state.growth.pmfHit) { state.growth.pmfHit = state.week; E.emit(state, { type: 'pmf' }); if (FL.Systems) FL.Systems.fireTrigger(state, 'pmf', qr); }
    const wg = G.weeklyGrowth(state);
    const T = (k) => FL.Systems && FL.Systems.fireTrigger(state, k, qr);
    if (wg != null && wg >= FL.YC_GROWTH.good) T('growth:5pct');
    const fires = FL.SITUATIONS.filter((x) => !x.good && state.active[x.id]).length;
    if (fires >= 3) T('fires:3');
    const payroll = ['comp', 'tenders', 'hiring', 'culture', 'execTeam'].reduce((a, id) => a + (state.policies[id] ? E.policyCost(state, id) : 0), 0);
    if (state.finance.revenue > 10 && state.finance.revenue >= payroll) T('ramen');
    if (state.turn >= 6) { const bm = G.burnMultiple(state); if (bm != null && bm > 3) T('burn:bad'); }
    if (wg != null && wg >= FL.YC_GROWTH.exceptional && !state.growth.ycHit) { state.growth.ycHit = state.week; if (FL.Systems) FL.Systems.fireTrigger(state, 'growth:10pct', qr); }
    if (state.week % 13 === 12) {
      const da = G.defaultAlive(state);
      if (da.alive && !state.growth.aliveHit && state.finance.revenue > 20) { state.growth.aliveHit = state.week; if (FL.Systems) FL.Systems.fireTrigger(state, 'defaultAlive', qr); }
    }
  };

  /** Investors start grading capital efficiency once the easy-money years are over. */
  E.registerInput('efficiency', 'Capital efficiency (burn multiple)', (state) => {
    if (state.turn < 12 || !FL.Growth) return {};
    const bm = G.burnMultiple(state);
    if (bm == null) return {};
    // Frontier labs burn far more than SaaS norms; investors only grade relative to that.
    return { investors: clamp((4 - bm) * 0.015, -0.06, 0.05) };
  });

  FL.Growth = G;
})(globalThis.FL = globalThis.FL || {});
