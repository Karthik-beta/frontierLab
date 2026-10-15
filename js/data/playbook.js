/* data/playbook.js — Growth Playbook stances. Blitzscaling's counterintuitive rules (Reid Hoffman &
 * Chris Yeh, "Blitzscaling", 2018) and Y Combinator / Paul Graham maxims. Pick up to three.
 *   fx: stat/stakeholder nudges while active · mods: engine hooks
 *   (raise ×, costs ×, bandwidth +, toxicity +/quarter, managerVolume +, viral +, stageBandwidth: ignore stage costs)
 *   earlyOnly / lateOnly: the play only helps in Family/Tribe stages, or only from City up. */
(function (FL) {
  'use strict';
  FL.MAX_PLAYS = 3;
  FL.PLAYS = [
    // Blitzscaling
    { id: 'embraceChaos', school: 'Blitzscaling', name: 'Embrace chaos', desc: 'Stop trying to keep things tidy. Speed up; the org gets messier.',
      fx: { velocity: 0.03, morale: -0.02 }, mods: { toxicity: 0.012 } },
    { id: 'hireNow', school: 'Blitzscaling', name: 'Hire right now', desc: 'Fill seats today with good-enough people instead of waiting for perfect ones.',
      fx: { talent: -0.02 }, mods: { managerVolume: 1 } },
    { id: 'badManagement', school: 'Blitzscaling', name: 'Tolerate "bad" management', desc: 'Promote fast, fix later. You stop paying the coordination tax of growing headcount.',
      fx: { morale: -0.03 }, mods: { stageBandwidth: true, toxicity: 0.005 } },
    { id: 'embarrassing', school: 'Blitzscaling', name: 'Launch a product that embarrasses you', desc: 'Ship before it is ready. Quiet launches go viral more often; the rough edges show.',
      fx: { adoption: 0.03, trust: -0.03, quality: -0.02 }, mods: { viral: 0.15 } },
    { id: 'letFiresBurn', school: 'Blitzscaling', name: 'Let fires burn', desc: 'Ignore the small crises and focus on what matters. More leadership time; the fires do some damage.',
      fx: { trust: -0.02, media: -0.05 }, mods: { bandwidth: 2 } },
    { id: 'ignoreCustomers', school: 'Blitzscaling', name: 'Ignore your customers', desc: 'Build what you believe in, not what this quarter\'s customers ask for.',
      fx: { velocity: 0.02, consumers: -0.12, enterprise: -0.12 } },
    { id: 'raiseTooMuch', school: 'Blitzscaling', name: 'Raise too much money', desc: 'Take every dollar on offer. Bigger rounds; your board and investors expect more for it.',
      fx: { board: -0.08 }, mods: { raise: 1.3 } },
    { id: 'evolveCulture', school: 'Blitzscaling', name: 'Evolve your culture', desc: 'Rewrite how you work at each stage instead of clinging to the founding culture.',
      fx: { morale: 0.02 }, mods: { toxicity: -0.012 } },
    // Y Combinator / Paul Graham
    { id: 'talkToUsers', school: 'Y Combinator', name: 'Talk to your users', desc: 'Founders and engineers in customer calls every week. Better product; less time for anything else.',
      fx: { quality: 0.03, consumers: 0.06, enterprise: 0.06 }, mods: { bandwidth: -1, pmf: 0.06 } },
    { id: 'dontScale', school: 'Y Combinator', name: 'Do things that don\'t scale', desc: 'Hand-onboard customers and recruit users one by one. Great while you are small; a drag once you are not.',
      earlyOnly: true, fx: { adoption: 0.03, brand: 0.02 }, mods: { pmf: 0.05, lateBandwidth: -2 } },
    { id: 'defaultAlive', school: 'Y Combinator', name: 'Default-alive discipline', desc: 'Every expense has to earn its keep. Lower costs, slower moves, nervous researchers.',
      fx: { velocity: -0.02, researchers: -0.05, board: 0.1 }, mods: { costs: 0.9 } },
    { id: 'founderMode', school: 'Y Combinator', name: 'Founder mode', desc: 'Skip-level meetings and direct involvement, even at scale. Huge leverage from City up; your managers feel bypassed.',
      lateOnly: true, fx: { morale: -0.02 }, mods: { lateBandwidthBonus: 3, toxicity: 0.004 } },
  ];
})(globalThis.FL = globalThis.FL || {});
