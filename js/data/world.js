/* data/world.js — hidden world traits. Each run draws two or three. The player never sees them
 * directly; analyst notes hint at them over time, and some of those notes are wrong.
 * mods: keys the engine queries through World.mod(state, key, default).
 *   base:<stat>  additive to a stat's base  ·  capGain / rivalPace  multipliers
 *   edge:<from>><to>  multiplier on one effect edge */
(function (FL) {
  'use strict';
  FL.WORLD_TRAITS = [
    { id: 'alignmentHard', name: 'Alignment is harder than anyone thought', mods: { 'edge:capability>safety': 1.6 },
      hint: 'Your interpretability team thinks safety gets harder faster than the field assumes.' },
    { id: 'alignmentEasy', name: 'Alignment generalizes better than feared', mods: { 'edge:capability>safety': 0.5 },
      hint: 'Your alignment lead says the newest models are surprisingly steerable.' },
    { id: 'scalingWall', name: 'Scaling hits a wall', mods: { capGain: 0.82 },
      hint: 'Researchers grumble that each new run buys less than the last.' },
    { id: 'scalingBoom', name: 'Scaling keeps working', mods: { capGain: 1.12, rivalPace: 1.08 },
      hint: 'Loss curves look better than the scaling laws predicted — for everyone.' },
    { id: 'hawkish', name: 'Regulators are hawkish', mods: { 'base:regHeat': 0.08 },
      hint: 'A Senate staffer warns you that the mood in Washington is turning.' },
    { id: 'aiFriendly', name: 'The public loves AI', mods: { 'base:trust': 0.08, 'base:adoption': 0.03 },
      hint: 'Polling firms report unusual enthusiasm for AI assistants.' },
    { id: 'skeptical', name: 'The public is skeptical', mods: { 'base:trust': -0.08 },
      hint: 'Focus groups keep using the word "creepy".' },
    { id: 'enterpriseBoom', name: 'Enterprises pay up', mods: { 'edge:entSales>monetization': 1.5, 'edge:api>monetization': 1.3 },
      hint: 'CIOs are quietly tripling their AI budgets.' },
    { id: 'consumerFickle', name: 'Consumers are fickle', mods: { 'edge:consumerApp>adoption': 0.7, 'edge:hype>adoption': 0.7 },
      hint: 'Retention charts for every chat app look like ski slopes.' },
    { id: 'talentScarce', name: 'Talent is scarce', mods: { 'edge:comp>talent': 0.7, 'edge:hiring>talent': 0.7 },
      hint: 'Recruiters say there are maybe a few hundred people who can do this work.' },
    { id: 'rivalsAggressive', name: 'Rivals are aggressive', mods: { rivalPace: 1.12 },
      hint: 'Someone saw a rival lab\'s power contracts. They are enormous.' },
    { id: 'rivalsCautious', name: 'Rivals are cautious', mods: { rivalPace: 0.9 },
      hint: 'Word is a rival lab has quietly paused its biggest training run.' },
  ];
  /* Pairs that cannot both be true. */
  FL.WORLD_EXCLUSIVE = [['alignmentHard', 'alignmentEasy'], ['scalingWall', 'scalingBoom'], ['hawkish', 'aiFriendly'], ['aiFriendly', 'skeptical'], ['rivalsAggressive', 'rivalsCautious']];
})(globalThis.FL = globalThis.FL || {});
