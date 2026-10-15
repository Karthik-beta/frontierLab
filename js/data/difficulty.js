/* data/difficulty.js — Easy / Normal / Realistic. Each knob is read by the engine via E.diff(state). */
(function (FL) {
  'use strict';
  FL.DIFFICULTIES = [
    { id: 'easy', name: 'Easy',
      blurb: 'Patient investors, slower rivals, gentler pitfalls. Learn the wiring without getting fired for it.',
      cashMult: 1.8, bandwidth: 6, bwIncome: 2, rivalPace: 0.85, pitfallPace: 0.6, fundingMult: 1.3,
      bridges: 2, coupGrace: 3, computeInflation: 1.05, failureMult: 0.5, aligned: 0.5, uneasy: 0.35 },
    { id: 'normal', name: 'Normal',
      blurb: 'The intended balance. Hard, like Democracy.',
      cashMult: 1, bandwidth: 0, bwIncome: 0, rivalPace: 1, pitfallPace: 1, fundingMult: 1,
      bridges: 1, coupGrace: 2, computeInflation: 1.06, failureMult: 1, aligned: 0.55, uneasy: 0.4 },
    { id: 'realistic', name: 'Realistic',
      blurb: 'Compute prices climb, chips fail and age out fast, rivals out-raise you, pitfalls build quicker, no bridge loans, and the board strikes on the first bad quarter.',
      cashMult: 0.8, bandwidth: -2, bwIncome: -1, rivalPace: 1.1, pitfallPace: 1.35, fundingMult: 0.85,
      bridges: 0, coupGrace: 1, computeInflation: 1.07, failureMult: 1.5, aligned: 0.6, uneasy: 0.45 },
  ];
})(globalThis.FL = globalThis.FL || {});
