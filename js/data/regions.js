/* data/regions.js — the world your users live in (Plague Inc-style). Internet-user counts are rough,
 * rounded game figures. x/y place each region on a 1000×480 map.
 *   appetite: enthusiasm for AI products · priceSens: how much price hurts and a free tier helps
 *   reg: regulatory strictness · access: 1 = open market, low = hard to reach · near: neighbours for spread */
(function (FL) {
  'use strict';
  FL.REGIONS = [
    { id: 'na', name: 'North America', pop: 350, x: 190, y: 160, appetite: 1.25, priceSens: 0.2, reg: 0.4, access: 1, near: ['latam', 'eu'] },
    { id: 'latam', name: 'Latin America', pop: 550, x: 300, y: 370, appetite: 1.0, priceSens: 0.7, reg: 0.3, access: 1, near: ['na', 'eu'] },
    { id: 'eu', name: 'Europe', pop: 650, x: 480, y: 120, appetite: 0.95, priceSens: 0.35, reg: 0.85, access: 1, near: ['na', 'mena', 'ssa'] },
    { id: 'mena', name: 'Middle East & N. Africa', pop: 400, x: 575, y: 255, appetite: 1.0, priceSens: 0.5, reg: 0.4, access: 0.9, near: ['eu', 'ssa', 'india'] },
    { id: 'ssa', name: 'Sub-Saharan Africa', pop: 500, x: 500, y: 390, appetite: 0.9, priceSens: 0.9, reg: 0.25, access: 0.85, near: ['mena', 'eu'] },
    { id: 'india', name: 'South Asia', pop: 900, x: 700, y: 330, appetite: 1.15, priceSens: 0.85, reg: 0.35, access: 1, near: ['mena', 'asia'] },
    { id: 'china', name: 'China', pop: 1100, x: 790, y: 135, appetite: 1.1, priceSens: 0.5, reg: 0.9, access: 0.12, near: ['asia', 'india'] },
    { id: 'asia', name: 'East & Southeast Asia', pop: 700, x: 880, y: 320, appetite: 1.15, priceSens: 0.5, reg: 0.45, access: 1, near: ['china', 'india'] },
  ];
  FL.USER_MILESTONES = [10, 100, 500, 1000, 2000]; // millions of users
})(globalThis.FL = globalThis.FL || {});
