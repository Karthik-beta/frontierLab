/* data/progression.js — eras (acts), model generations, valuation tiers, objectives and achievements. */
(function (FL) {
  'use strict';

  /* Acts by capability. tension feeds the ambient drone and the event director. */
  FL.ERAS = [
    { id: 'lab', at: 0, name: 'Act I: The Research Lab', tension: 0.15,
      blurb: 'A few hundred people, a lot of GPUs on credit, and a conviction that scale is all you need. Nobody outside the field is paying attention yet.' },
    { id: 'product', at: 25, name: 'Act II: The Product Moment', tension: 0.4,
      blurb: 'The public has noticed. Every quarter now has a launch, a scandal, or both. Revenue starts to matter.' },
    { id: 'scaling', at: 55, name: 'Act III: The Scaling Wars', tension: 0.7,
      blurb: 'Gigawatt clusters, nine-figure pay packages and Senate hearings. The labs are no longer startups. They are geopolitics.' },
    { id: 'endgame', at: 80, name: 'Act IV: The Endgame', tension: 1.0,
      blurb: 'Someone is going to get there. The only questions left are who, and whether it will listen.' },
  ];

  /* Long-term ladder: a named model ships every 10 capability. */
  FL.MODEL_GENS = [
    { at: 10, name: 'Ember', blurb: 'Writes passable poems and terrible code. Researchers are thrilled; nobody else notices.' },
    { at: 20, name: 'Spark', blurb: 'Holds a coherent conversation for an hour. Your first viral screenshots.' },
    { at: 30, name: 'Torch', blurb: 'Passes the bar exam. Lawyers are worried; investors are delighted.' },
    { at: 40, name: 'Beacon', blurb: 'Writes most of its own training code. Your engineers start asking it for code review.' },
    { at: 50, name: 'Lantern', blurb: 'Solves olympiad math. A Fields medalist calls it "a capable graduate student".' },
    { at: 60, name: 'Comet', blurb: 'Runs multi-day research projects unsupervised. Some of them work.' },
    { at: 70, name: 'Nova', blurb: 'Out-forecasts professional analysts. Governments request briefings.' },
    { at: 80, name: 'Pulsar', blurb: 'Designs chips better than your chip team. Your chip team agrees.' },
    { at: 90, name: 'Quasar', blurb: 'Your evals no longer measure anything. The model suggests better ones.' },
  ];

  FL.VALUATION_TIERS = [
    { at: 1000, name: 'Unicorn', blurb: 'A billion-dollar valuation. Your parents finally understand what you do.' },
    { at: 10000, name: 'Decacorn', blurb: 'Ten billion. The term sheets now come with private jets.' },
    { at: 100000, name: 'Hectocorn', blurb: 'A hundred billion. Bigger than most of the Fortune 500, with a fraction of the revenue.' },
    { at: 1000000, name: 'Trillion-Dollar Club', blurb: 'One trillion dollars. You are now a macroeconomic variable.' },
  ];

  /* Objectives: 3 live at once (investors, board, mission), each with a deadline.
   * kind 'reach' succeeds as soon as met; 'hold' is checked at the deadline.
   * setup(state) -> params; met(state, p) -> bool; progress(state, p) -> 0..1. */
  const v = (s, id) => s.values[id];
  const pctTxt = (x) => Math.round(x * 100) + '%';
  const money = (m) => FL.Engine.fmtMoney(m);
  const runwayQ = (s) => (s.finance.net >= 0 ? 99 : s.cash / -s.finance.net);

  FL.OBJECTIVES = [
    // investors
    { id: 'revTarget', owner: 'investors', kind: 'reach', turns: 5, minTurn: 3,
      setup: (s) => ({ target: Math.max(40, s.finance.revenue * 1.7) }),
      text: (p) => `Reach ${money(p.target)} quarterly revenue`,
      met: (s, p) => s.finance.revenue >= p.target, progress: (s, p) => s.finance.revenue / p.target },
    { id: 'adoptTarget', owner: 'investors', kind: 'reach', turns: 5,
      setup: (s) => ({ target: Math.min(0.9, v(s, 'adoption') + 0.12) }),
      text: (p) => `Grow adoption to ${pctTxt(p.target)}`,
      met: (s, p) => v(s, 'adoption') >= p.target, progress: (s, p) => v(s, 'adoption') / p.target },
    { id: 'leadTarget', owner: 'investors', kind: 'hold', turns: 6, minTurn: 4,
      setup: () => ({}),
      text: () => 'Be ahead of every rival lab at the deadline',
      met: (s) => s.cap > FL.Engine.bestRival(s).cap, progress: (s) => Math.min(1, s.cap / Math.max(1, FL.Engine.bestRival(s).cap)) },
    // board
    { id: 'runwayHold', owner: 'board', kind: 'hold', turns: 4,
      setup: () => ({ target: 5 }),
      text: (p) => `Have ${p.target}+ quarters of runway at the deadline`,
      met: (s, p) => runwayQ(s) >= p.target, progress: (s, p) => Math.min(1, runwayQ(s) / p.target) },
    { id: 'heatHold', owner: 'board', kind: 'hold', turns: 5, minTurn: 6,
      setup: (s) => ({ target: Math.max(0.2, v(s, 'regHeat') - 0.05) }),
      text: (p) => `Keep Regulatory Heat at or below ${pctTxt(p.target)}`,
      met: (s, p) => v(s, 'regHeat') <= p.target, progress: (s, p) => Math.min(1, p.target / Math.max(0.01, v(s, 'regHeat'))) },
    { id: 'legalHold', owner: 'board', kind: 'hold', turns: 5, minTurn: 6,
      setup: (s) => ({ target: Math.max(0.15, v(s, 'legal') - 0.05) }),
      text: (p) => `Get Legal Exposure down to ${pctTxt(p.target)}`,
      met: (s, p) => v(s, 'legal') <= p.target, progress: (s, p) => Math.min(1, p.target / Math.max(0.01, v(s, 'legal'))) },
    // mission
    { id: 'safetyTarget', owner: 'safetyCommunity', kind: 'reach', turns: 6,
      setup: (s) => ({ target: Math.min(0.85, Math.max(0.2, v(s, 'safety') + 0.08)) }),
      text: (p) => `Raise Safety Maturity to ${pctTxt(p.target)}`,
      met: (s, p) => v(s, 'safety') >= p.target, progress: (s, p) => v(s, 'safety') / p.target },
    { id: 'trustTarget', owner: 'media', kind: 'reach', turns: 5,
      setup: (s) => ({ target: Math.min(0.85, v(s, 'trust') + 0.08) }),
      text: (p) => `Raise Public Trust to ${pctTxt(p.target)}`,
      met: (s, p) => v(s, 'trust') >= p.target, progress: (s, p) => v(s, 'trust') / p.target },
    { id: 'capTarget', owner: 'researchers', kind: 'reach', turns: 5,
      setup: (s) => ({ target: Math.floor(s.cap) + 12 }),
      text: (p) => `Ship a model at capability ${p.target}`,
      met: (s, p) => s.cap >= p.target, progress: (s, p) => s.cap / p.target },
    { id: 'moraleTarget', owner: 'researchers', kind: 'reach', turns: 4,
      setup: (s) => ({ target: Math.min(0.85, v(s, 'morale') + 0.1) }),
      text: (p) => `Lift Morale to ${pctTxt(p.target)}`,
      met: (s, p) => v(s, 'morale') >= p.target, progress: (s, p) => v(s, 'morale') / p.target },
  ];
  FL.OBJECTIVE_SLOTS = [
    { id: 'investors', name: 'Investor ask', pool: ['revTarget', 'adoptTarget', 'leadTarget'] },
    { id: 'board', name: 'Board ask', pool: ['runwayHold', 'heatHold', 'legalHold'] },
    { id: 'mission', name: 'Mission', pool: ['safetyTarget', 'trustTarget', 'capTarget', 'moraleTarget'] },
  ];

  /* Achievements persist across runs. trigger keys match Systems.fireTrigger. */
  FL.ACHIEVEMENTS = [
    { id: 'ach-aligned', name: 'Benevolent Machine', trigger: 'ending:aligned', desc: 'Reach AGI with high safety maturity.' },
    { id: 'ach-uneasy', name: 'Mostly Harmless', trigger: 'ending:uneasy', desc: 'Reach AGI with middling safety.' },
    { id: 'ach-misaligned', name: 'Paperclips', trigger: 'ending:misaligned', desc: 'Reach AGI without the safety to steer it.' },
    { id: 'ach-lost', name: 'Second Place Is First Loser', trigger: 'ending:lostRace', desc: 'Lose the race to a rival lab.' },
    { id: 'ach-bankrupt', name: 'Webvan', trigger: 'ending:bankrupt', desc: 'Run out of money.' },
    { id: 'ach-ousted', name: 'Not Consistently Candid', trigger: 'ending:ousted', desc: 'Get fired by your own board.' },
    { id: 'ach-shutdown', name: 'Nationalised', trigger: 'ending:shutdown', desc: 'Get shut down by a federal injunction.' },
    { id: 'ach-acquihired', name: 'Reverse Acquihire', trigger: 'ending:acquihired', desc: 'Sell your team to Big Tech.' },
    { id: 'ach-decade', name: 'The Long Game', trigger: 'ending:timeout', desc: 'Survive all forty quarters.' },
    { id: 'ach-unicorn', name: 'Unicorn', trigger: 'tier:Unicorn', desc: 'Reach a $1B valuation.' },
    { id: 'ach-trillion', name: 'Trillion-Dollar Club', trigger: 'tier:Trillion-Dollar Club', desc: 'Reach a $1T valuation.' },
    { id: 'ach-alive', name: 'Default Alive', trigger: 'profitable', desc: 'Have a profitable quarter.' },
    { id: 'ach-reinstated', name: 'Five Days in November', trigger: 'reinstated', desc: 'Get fired by the board and win your job back.' },
    { id: 'ach-spawn', name: 'Traitorous Eight', trigger: 'rival:spawned', desc: 'Lose a team that founds a rival lab.' },
    { id: 'ach-objectives', name: 'Overachiever', trigger: 'objectives:10', desc: 'Complete ten objectives in one run.' },
    { id: 'ach-allpit', name: 'Lessons Learned', trigger: 'pitfalls:5', desc: 'Hit five different historical pitfalls in one run.' },
    { id: 'ach-speed', name: 'Feel the AGI', trigger: 'speedrun', desc: 'Reach AGI before 2033.' },
    { id: 'ach-archive25', name: 'Archivist', trigger: 'archive:25', desc: 'Collect 25 archive artifacts across all runs.' },
  ];
})(globalThis.FL = globalThis.FL || {});
