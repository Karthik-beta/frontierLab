/* data/archetypes.js — starting scenarios (Democracy's "choose a country") and rival labs. */
(function (FL) {
  'use strict';

  FL.ARCHETYPES = [
    { id: 'idealists', name: 'The Nonprofit Idealists', icon: '🕊️', difficulty: 'Normal',
      blurb: 'A billion dollars of pledges, a nonprofit charter and a promise to benefit all of humanity. Can the mission survive the compute bill?',
      cash: 1200, bandwidth: 20, cap: 4,
      policies: { nonprofit: 1.0, publish: 0.8, alignment: 0.3, comp: 0.4 },
      baseMods: { trust: 0.10, openness: 0.10 } },
    { id: 'defectors', name: 'The Safety Defectors', icon: '🧭', difficulty: 'Normal',
      blurb: 'You left a frontier lab because they were moving too fast. Now you have to move fast enough to matter.',
      cash: 900, bandwidth: 18, cap: 6,
      policies: { alignment: 0.6, interp: 0.4, redteam: 0.5, rsp: 0.4, comp: 0.5 },
      baseMods: { talent: 0.08, safety: 0.08, morale: 0.05 } },
    { id: 'spinout', name: 'The Big Tech Spinout', icon: '🏦', difficulty: 'Easy',
      blurb: 'Deep pockets, a cloud parent and a lot of meetings. Speed is your problem, not money.',
      cash: 3000, bandwidth: 16, cap: 5, bandwidthMod: -1,
      policies: { cloudDeal: 0.8, comp: 0.7, enterprise: 0.4, hiring: 0.5, moderation: 0.5 },
      baseMods: { compute: 0.08, trust: -0.05, morale: -0.05 } },
    { id: 'upstarts', name: 'The Open-Weight Upstarts', icon: '🐧', difficulty: 'Hard',
      blurb: 'A dozen brilliant engineers, a Discord server and very little money. Out-ship the giants.',
      cash: 450, bandwidth: 22, cap: 3,
      policies: { openWeights: 0.7, publish: 0.6, comp: 0.2, crunch: 0.4 },
      baseMods: { morale: 0.10, openness: 0.10 } },
  ];

  FL.RIVALS = [
    { id: 'prometheus', name: 'Prometheus Labs', color: '#f87171', cap: 8, rate: 2.05 },
    { id: 'colossus', name: 'Colossus AI (Big Tech)', color: '#60a5fa', cap: 6, rate: 1.95 },
    { id: 'hydra', name: 'Hydra Collective', color: '#4ade80', cap: 3, rate: 1.75 },
  ];
})(globalThis.FL = globalThis.FL || {});
