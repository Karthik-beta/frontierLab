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
  const SPREAD = 2.6;   // logistic spread rate per quarter
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

  FL.Growth = G;
})(globalThis.FL = globalThis.FL || {});
