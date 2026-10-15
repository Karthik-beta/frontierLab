/* data/legacy.js — permanent perks bought with Legacy points (single-player only).
 * Each perk is small on purpose: an edge, not a cheat. */
(function (FL) {
  'use strict';
  FL.LEGACY_PERKS = [
    { id: 'seed', name: 'Friends & Family Round', cost: 3, desc: 'Start with 20% more cash.', apply: (s) => { s.cash *= 1.2; } },
    { id: 'network', name: 'Founder Network', cost: 3, desc: 'Start with 3 extra bandwidth.', apply: (s) => { s.bandwidth += 3; } },
    { id: 'reputation', name: 'Reputation', cost: 4, desc: 'The public starts a little more trusting.', apply: (s) => { s.baseMods.trust = (s.baseMods.trust || 0) + 0.04; } },
    { id: 'cluster', name: 'Old Friends at a Cloud', cost: 4, desc: 'Start with 4 extra pods of current chips.',
      apply: (s) => { if (s.hw) s.hw.fleet.push({ id: s.hw.nextId++, gen: 'halcyon', pods: 4, acquired: -2, health: 1, cost: 120, book: 100 }); } },
    { id: 'rolodex', name: 'Rolodex', cost: 4, desc: 'Two senior candidates are waiting in your first feed.',
      apply: (s) => { if (FL.Hiring) for (let i = 0; i < 2; i++) s.people.feed.unshift(FL.Hiring.makeCandidate(s, { seniority: 3, quality: 8 })); } },
    { id: 'lucky', name: 'Lucky', cost: 6, desc: 'Golden opportunities appear 30% more often.', apply: (s) => { s.flags.lucky = true; } },
    { id: 'insider', name: 'Insider', cost: 6, desc: 'Early in each run, one analyst note is guaranteed to be true.', apply: (s) => { s.flags.insider = true; } },
  ];
})(globalThis.FL = globalThis.FL || {});
