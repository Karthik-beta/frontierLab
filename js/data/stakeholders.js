/* data/stakeholders.js — the "voter groups". Happiness in [-1, 1].
 * weight = influence on overall approval (which feeds bandwidth and funding rounds).
 * inputs: [sourceId, k, lag=2, curve='lin'] from stats/indicators. Policies add their own edges. */
(function (FL) {
  'use strict';

  FL.STAKEHOLDERS = [
    { id: 'board', name: 'The Board', icon: '🪑', weight: 3, base: 0.10,
      desc: 'Can fire you. Cares about runway, legal and regulatory risk, and not losing the race. Below -45% they start plotting.',
      inputs: [['runway', 0.35, 2, 'ctr'], ['regHeat', -0.30], ['legal', -0.15], ['lead', 0.15, 2, 'ctr'], ['revGrowth', 0.15, 2, 'ctr']] },
    { id: 'investors', name: 'Investors', icon: '🦄', weight: 3, base: -0.15,
      desc: 'Fund you at each round. Want hype, growth and a lead in the race.',
      inputs: [['hype', 0.35], ['revGrowth', 0.30, 2, 'ctr'], ['lead', 0.35, 2, 'ctr'], ['adoption', 0.20]] },
    { id: 'researchers', name: 'Researchers', icon: '🧑‍🔬', weight: 2, base: -0.10,
      desc: 'Your staff. Want GPUs, freedom to publish, good pay and a mission.',
      inputs: [['compute', 0.35], ['morale', 0.35, 2, 'ctr'], ['openness', 0.20], ['talent', 0.10]] },
    { id: 'safetyCommunity', name: 'Safety Community', icon: '🧭', weight: 1, base: -0.10,
      desc: 'Alignment researchers, EA donors, worried academics. Want safety ahead of capability.',
      inputs: [['safety', 0.60], ['velocity', -0.20], ['capability', -0.15], ['openness', 0.10]] },
    { id: 'enterprise', name: 'Enterprise Customers', icon: '🏢', weight: 2, base: -0.20,
      desc: 'The money. Want quality, security, reliability and no lawsuits.',
      inputs: [['quality', 0.40], ['security', 0.30], ['trust', 0.20, 2, 'ctr'], ['legal', -0.20]] },
    { id: 'consumers', name: 'Consumers', icon: '📱', weight: 2, base: -0.20,
      desc: 'Hundreds of millions of users. Want a great, cheap, fun product.',
      inputs: [['quality', 0.40], ['hype', 0.15], ['trust', 0.20, 2, 'ctr'], ['adoption', 0.10]] },
    { id: 'regulators', name: 'Regulators', icon: '🏛️', weight: 2, base: 0.15,
      desc: 'Governments everywhere, slowly waking up.',
      inputs: [['regHeat', -0.50], ['safety', 0.25], ['trust', 0.20, 2, 'ctr']] },
    { id: 'openSource', name: 'Open-Source Community', icon: '🐧', weight: 1, base: -0.15,
      desc: 'Developers and hobbyists. Love open weights and papers.',
      inputs: [['openness', 0.60]] },
    { id: 'media', name: 'Media', icon: '📰', weight: 1, base: -0.10,
      desc: 'Shapes the narrative. Loves a rise, loves a fall even more.',
      inputs: [['hype', 0.20], ['trust', 0.30, 2, 'ctr'], ['legal', -0.15]] },
    { id: 'partner', name: 'Big Tech Partner', icon: '🏦', weight: 1, base: 0.00,
      desc: 'Your hyperscaler patron — if you have one.',
      inputs: [['adoption', 0.15], ['compute', 0.10]] },
  ];
})(globalThis.FL = globalThis.FL || {});
