/* growth.js — Plague Inc-style user growth: users spread region by region toward your product's
 * appeal, pulled by virality, brand and neighbouring regions, held back by price, regulation and bans.
 * Revenue is earned on actual users, not on the abstract appeal stat. */
(function (FL) {
  'use strict';
  const G = {};
  /** Init regional user shares. TODO: implement. Depends on: FL.REGIONS. */
  G.init = function (state) { throw new Error('NotImplemented: Growth.init'); };
  /** Regional appeal target for this week. TODO: implement. */
  G.regionTarget = function (state, region) { throw new Error('NotImplemented: regionTarget'); };
  /** Weekly spread / churn update; emits milestones (10M, 100M, 1B users). TODO: implement. */
  G.tick = function (state, qr, dt) { throw new Error('NotImplemented: Growth.tick'); };
  /** Global share of internet users (drives revenue). TODO: implement. */
  G.share = function (state) { throw new Error('NotImplemented: share'); };
  /** Summary for UI/CLI: total users, weekly actives, growth rate, per region. TODO: implement. */
  G.summary = function (state) { throw new Error('NotImplemented: Growth.summary'); };
  FL.Growth = G;
})(globalThis.FL = globalThis.FL || {});
