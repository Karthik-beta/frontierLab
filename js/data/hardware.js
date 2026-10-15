/* data/hardware.js — accelerator generations and compute deal templates.
 * 1 pod = 1,000 accelerators. perf is relative to a first-gen pod; price is $M per pod;
 * power is MW per pod. A new generation ships roughly every six quarters (fictional names). */
(function (FL) {
  'use strict';

  FL.CHIP_GENS = [
    { id: 'halcyon', name: 'Halcyon', turn: -8, perf: 1, price: 30, power: 1.2 },
    { id: 'borealis', name: 'Borealis', turn: 3, perf: 2.5, price: 45, power: 1.6 },
    { id: 'corona', name: 'Corona', turn: 9, perf: 6, price: 60, power: 2.0 },
    { id: 'dynamo', name: 'Dynamo', turn: 15, perf: 14, price: 80, power: 2.4 },
    { id: 'eclipse', name: 'Eclipse', turn: 21, perf: 32, price: 100, power: 2.8 },
    { id: 'fulcrum', name: 'Fulcrum', turn: 27, perf: 75, price: 125, power: 3.2 },
    { id: 'gravitas', name: 'Gravitas', turn: 33, perf: 170, price: 150, power: 3.6 },
  ];

  FL.HW = {
    needBase: 40,            // perf-units a frontier lab needs at turn 1
    needGrowth: 1.11,       // per quarter (~1.5x a year)
    buildQuarters: 3,       // datacenter capex -> online
    spotRate: 0.15,         // rental $ per pod per quarter, as a share of list price
    opexPerMW: 0.3,         // $M per MW per quarter (power + upkeep)
    lifeQuarters: 20,       // straight-line depreciation (Realistic uses 12)
    basePower: 120,         // MW available at start
    mwPerEnergyDollar: 0.35, // MW added per $M spent on Nuclear & Energy Deals
    dcPowerShare: 0.5,      // share of a new datacenter's power that comes with the build
  };

  /* Offer templates. size = share of the frontier need it covers. term in quarters.
   * pay: 'lease' ($/q obligation), 'equity' (dilution %), 'upfront' ($ now), 'vendor' (cash now + purchase commitment). */
  FL.COMPUTE_OFFERS = [
    { id: 'neocloud', provider: 'Coreline Cloud', kind: 'Neocloud lease', size: 0.25, term: 8, pay: 'lease', rate: 0.11,
      text: 'A GPU-rich neocloud will lease you a block of current-generation capacity. Cheaper than spot, but it is take-or-pay: you owe every quarter until it ends.',
      fx: [] },
    { id: 'equity', provider: 'Vastline (hyperscaler)', kind: 'Compute for equity', size: 0.4, term: 12, pay: 'equity', dilution: 6,
      text: 'A hyperscaler offers a huge block of compute in exchange for a slice of the company. No cash needed. Strings very much attached.',
      fx: [['partner', 0.3, 8], ['board', -0.1, 4], ['openSource', -0.1, 4]], meter: ['platformCapture', 0.25] },
    { id: 'circular', provider: 'Verdant Semiconductor', kind: 'Vendor financing', size: 0, term: 6, pay: 'vendor', cash: 1500, commitPods: 1.0,
      text: 'The dominant chipmaker will invest cash in you, if you commit to buy its next-generation chips with that money and more. Critics call these deals circular.',
      fx: [['hype', 0.08, 4], ['investors', 0.1, 4], ['media', -0.08, 4]] },
    { id: 'sovereign', provider: 'Gulf Sovereign Compute', kind: 'Sovereign cluster', size: 0.5, term: 10, pay: 'lease', rate: 0.06,
      text: 'A sovereign wealth fund will build a cluster in its desert and rent it to you at a steep discount. Washington will ask questions.',
      fx: [['regHeat', 0.12, 8], ['regulators', -0.2, 8], ['trust', -0.05, 6]] },
    { id: 'fireSale', provider: 'Defunct startup liquidator', kind: 'Used GPU fire sale', size: 0.2, term: 0, pay: 'upfront', discount: 0.25, genBack: 2, health: 0.75,
      text: 'A failed startup is liquidating two-generation-old GPUs at a quarter of list price. Well used, but cheap.',
      fx: [] },
    { id: 'power', provider: 'Riverbend Nuclear', kind: 'Nuclear restart PPA', size: 0, term: 0, pay: 'upfront', mw: 300, cost: 900,
      text: 'A utility will restart a mothballed reactor and sell you its entire output for twenty years. Clean, firm power for your clusters.',
      fx: [['trust', 0.05, 6], ['regulators', 0.08, 4]] },
    { id: 'rivalCloud', provider: 'Northwind Cloud', kind: 'Custom accelerator lease', size: 0.35, term: 16, pay: 'lease', rate: 0.09, perfMult: 0.8,
      text: 'A rival cloud offers long-term access to its in-house accelerators. Not quite top-of-the-line, but plentiful and cheap.',
      fx: [['partner', -0.3, 6]] },
  ];
})(globalThis.FL = globalThis.FL || {});
