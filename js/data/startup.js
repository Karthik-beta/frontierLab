/* data/startup.js — the startup canon used to frame growth: Blitzscaling stages (Hoffman & Yeh, 2018),
 * YC's weekly growth bar (Paul Graham, "Startup = Growth", 2012), product-market fit (Sean Ellis' 40% test),
 * burn multiple (David Sacks, 2020) and default alive / default dead (Paul Graham, 2015). */
(function (FL) {
  'use strict';
  FL.BLITZ_STAGES = [
    { id: 'family', name: 'Family', min: 1, note: 'Everyone knows everything. The founders do every job.' },
    { id: 'tribe', name: 'Tribe', min: 10, note: 'You can still know everyone\'s name. Hire for speed and judgment.' },
    { id: 'village', name: 'Village', min: 100, note: 'You need managers now. Some of them will be bad; blitzscaling says tolerate it and keep moving.', bandwidth: 0 },
    { id: 'city', name: 'City', min: 1000, note: 'Specialists, layers and process. Without an executive team, every decision routes through you.', bandwidth: -1, toxicity: 0.01 },
    { id: 'nation', name: 'Nation', min: 10000, note: 'Multiple lines of business and a culture you can no longer see directly.', bandwidth: -2, toxicity: 0.02 },
  ];
  FL.YC_GROWTH = { good: 0.05, exceptional: 0.10 }; // per week
  FL.PMF_BAR = 0.40; // share of users who would be "very disappointed" without your product
  FL.BURN_TIERS = [
    { max: 1, label: 'amazing' }, { max: 1.5, label: 'great' }, { max: 2, label: 'good' }, { max: 3, label: 'suspect' }, { max: Infinity, label: 'bad' },
  ];
})(globalThis.FL = globalThis.FL || {});
