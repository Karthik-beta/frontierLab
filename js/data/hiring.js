/* data/hiring.js — roles, traits, hiring practices and culture values.
 * Culture values include Uber's 14 values as written under Travis Kalanick (see Mike Isaac,
 * "Super Pumped"). Each value/practice changes stats every quarter and adds or removes
 * "toxicity", which builds toward the HR-scandal pitfall. */
(function (FL) {
  'use strict';

  FL.ROLES = [
    { id: 'research', name: 'Research Scientist', weight: 3, stats: { velocity: 0.16, talent: 0.12 } },
    { id: 'infra', name: 'Infrastructure Engineer', weight: 2, stats: { compute: 0.05 }, reliability: 0.5 },
    { id: 'safety', name: 'Alignment Researcher', weight: 1.5, stats: { safety: 0.16 } },
    { id: 'product', name: 'Product Manager', weight: 1.5, stats: { quality: 0.1, adoption: 0.05 } },
    { id: 'gtm', name: 'Enterprise Sales Lead', weight: 1, stats: { monetization: 0.12 } },
    { id: 'policy', name: 'Policy Lead', weight: 0.7, stats: { regHeat: -0.1, trust: 0.03 } },
    { id: 'recruiter', name: 'Technical Recruiter', weight: 0.8, stats: {} },
  ];
  FL.SENIORITY = ['Junior', 'Senior', 'Staff', 'Principal', 'Legendary'];
  FL.SENIORITY_PAY = [0.3, 0.6, 1.5, 5, 40]; // $M per year at turn 1

  /* hidden: not shown on the profile until revealed by reference checks or a Bar Raiser loop. */
  FL.TRAITS = [
    { id: 'mission', name: 'Mission-driven', good: true, desc: 'Stays through hard times. Lifts morale.', loyalty: 0.3, morale: 0.004 },
    { id: 'builder', name: 'Builder', good: true, desc: 'Ships. A little extra velocity and quality.', velocity: 0.004, quality: 0.004 },
    { id: 'mentor', name: 'Mentor', good: true, desc: 'Makes everyone around them better. Great hiring manager.', morale: 0.004, managerQuality: 12 },
    { id: 'safetyMinded', name: 'Safety-minded', good: true, desc: 'Strengthens safety work, but quits loudly if you cut corners.', safety: 0.006 },
    { id: 'mercenary', name: 'Mercenary', desc: 'Follows the money. Leaves for the next big offer.', loyalty: -0.4 },
    { id: 'hustler', name: 'Hustler', desc: 'Moves fast, steps on toes.', velocity: 0.006, toxicity: 0.012 },
    { id: 'politician', name: 'Politician', desc: 'Great at managing up. As a hiring manager, hires many and hires friends.', toxicity: 0.008, managerVolume: 1, managerQuality: -8 },
    { id: 'founder', name: 'Ex-founder', desc: 'Brilliant and restless. Might leave to start a rival.', loyalty: -0.2, skill: 8 },
    { id: 'jerk', name: 'Brilliant jerk', hidden: true, desc: 'Genius output. Everyone else wants to quit.', skill: 20, morale: -0.012, toxicity: 0.04 },
    { id: 'leaker', name: 'Leaker', hidden: true, desc: 'Talks to journalists. You will read about your roadmap in the press.', leak: 0.06 },
    { id: 'burnout', name: 'Burnout risk', hidden: true, desc: 'Brilliant until the crunch. Then gone.', loyalty: -0.2 },
  ];

  FL.PRACTICES = [
    { id: 'barRaiser', name: 'Bar Raiser interviews', inspired: 'Amazon', desc: 'An outside interviewer with veto power on every loop. Fewer, better hires; most hidden red flags get caught.',
      quality: 10, volume: -1, reveal: 0.7 },
    { id: 'referenceChecks', name: 'Deep reference checks', inspired: 'common practice', desc: 'Back-channel every senior hire. Reveals nearly every hidden trait.',
      reveal: 0.9, volume: -0.5 },
    { id: 'referrals', name: 'Referral bonuses', inspired: 'common practice', desc: 'Pay staff to bring friends. Fast and cheap, but your culture amplifies — for better or worse.',
      volume: 1, quality: -3, toxicityMult: 1.3 },
    { id: 'noJerks', name: 'No brilliant jerks', inspired: 'Netflix culture deck', desc: 'Refuse to hire brilliant jerks, however brilliant. Lower ceiling, much healthier floor.',
      blocks: 'jerk', quality: -4, toxicity: -0.01 },
    { id: 'keeperTest', name: 'Keeper test', inspired: 'Netflix culture deck', desc: 'Every quarter, let go of anyone a manager would not fight to keep. Sharper team, nervous team.',
      cull: 0.1, morale: -0.04 },
    { id: 'aiScreening', name: 'AI résumé screening', inspired: 'Amazon\'s scrapped 2018 recruiting tool', desc: 'Let a model screen applicants. Much faster. Training data has opinions.',
      volume: 2, quality: -2 },
    { id: 'payToQuit', name: 'Pay new hires to quit', inspired: 'Zappos', desc: 'Offer every new hire a bonus to walk away after onboarding. The mercenaries take it.',
      blocks: 'mercenary', costPerHire: 0.05 },
    { id: 'hardcore', name: '"Extremely hardcore"', inspired: 'Twitter, November 2022', desc: 'Long hours at high intensity, or take severance. Velocity now, attrition later.',
      velocity: 0.05, morale: -0.15, attrition: 0.05, toxicity: 0.03 },
    { id: 'hrTeam', name: 'Independent HR & investigations', inspired: 'post-2017 best practice', desc: 'A real HR function that can investigate executives. Costs money; drains toxicity.',
      toxicity: -0.035, cost: 15 },
  ];

  FL.CULTURE_VALUES = [
    // Uber's 14 values (Super Pumped)
    { id: 'customerObsession', name: 'Customer Obsession', uber: true, fx: { quality: 0.02 }, toxicity: 0 },
    { id: 'makeMagic', name: 'Make Magic', uber: true, fx: { quality: 0.02, hype: 0.01 }, toxicity: 0 },
    { id: 'bigBoldBets', name: 'Big Bold Bets', uber: true, fx: { velocity: 0.02, hype: 0.03 }, toxicity: 0.005 },
    { id: 'insideOut', name: 'Inside Out', uber: true, fx: { data: 0.03 }, toxicity: 0 },
    { id: 'championsMindset', name: 'Champion\'s Mindset', uber: true, fx: { morale: 0.02 }, toxicity: 0.01 },
    { id: 'optimisticLeadership', name: 'Optimistic Leadership', uber: true, fx: { morale: 0.03 }, toxicity: 0 },
    { id: 'superpumped', name: 'Superpumped', uber: true, fx: { velocity: 0.02, morale: 0.02 }, toxicity: 0.01 },
    { id: 'ownerNotRenter', name: 'Be an Owner, Not a Renter', uber: true, fx: { talent: 0.02 }, toxicity: 0 },
    { id: 'toeStepping', name: 'Meritocracy and Toe-Stepping', uber: true, fx: { velocity: 0.04, talent: 0.02 }, toxicity: 0.04 },
    { id: 'letBuildersBuild', name: 'Let Builders Build', uber: true, fx: { velocity: 0.03, safety: -0.02 }, toxicity: 0.005 },
    { id: 'alwaysHustlin', name: 'Always Be Hustlin\'', uber: true, fx: { velocity: 0.04, morale: -0.02 }, toxicity: 0.03 },
    { id: 'celebrateCities', name: 'Celebrate Cities', uber: true, fx: { trust: 0.02 }, toxicity: 0 },
    { id: 'beYourself', name: 'Be Yourself', uber: true, fx: { morale: 0.02 }, toxicity: 0.01 },
    { id: 'principledConfrontation', name: 'Principled Confrontation', uber: true, fx: { quality: 0.02 }, toxicity: 0.02 },
    // Counterweights
    { id: 'psychSafety', name: 'Psychological Safety', fx: { morale: 0.03, quality: 0.01 }, toxicity: -0.03,
      note: 'Google\'s Project Aristotle found it was the biggest factor in effective teams.' },
    { id: 'safetyFirst', name: 'Safety Is Everyone\'s Job', fx: { safety: 0.04, velocity: -0.02 }, toxicity: -0.005 },
    { id: 'disagreeCommit', name: 'Disagree and Commit', fx: { velocity: 0.02 }, toxicity: 0, note: 'An Amazon leadership principle.' },
    { id: 'missionOverMoney', name: 'Mission Over Money', fx: { morale: 0.02, talent: 0.02, monetization: -0.02 }, toxicity: -0.01 },
    { id: 'radicalTransparency', name: 'Radical Transparency', fx: { trust: 0.02, morale: -0.02 }, toxicity: 0, note: 'Bridgewater\'s signature principle.' },
  ];
  FL.MAX_VALUES = 4;

  /* Profile generation pools. */
  FL.NAMES_FIRST = ['Ada', 'Wei', 'Priya', 'Mateo', 'Amara', 'Kenji', 'Sofia', 'Omar', 'Lena', 'Tariq', 'Mei', 'Jonas', 'Aisha', 'Diego', 'Yuki', 'Nikhil',
    'Chloe', 'Kwame', 'Ingrid', 'Rafael', 'Hana', 'Samir', 'Zara', 'Lucas', 'Noor', 'Ivan', 'Elif', 'Theo', 'Farah', 'Arjun', 'Maya', 'Kofi', 'Rosa', 'Daniel', 'Leila', 'Hiro'];
  FL.NAMES_LAST = ['Okafor', 'Chen', 'Raman', 'Alvarez', 'Nwosu', 'Tanaka', 'Rossi', 'Haddad', 'Fischer', 'Khan', 'Lin', 'Berg', 'Mensah', 'Costa', 'Sato', 'Iyer',
    'Dubois', 'Asante', 'Larsen', 'Moreno', 'Kim', 'Farouk', 'Petrova', 'Silva', 'Abadi', 'Novak', 'Yilmaz', 'Walsh', 'Nakamura', 'Gupta', 'Osei', 'Reyes', 'Park', 'Weiss'];
  FL.BACKGROUNDS = ['PhD from a top lab', 'ex-Big Tech', 'ex-quant fund', '2x founder', 'self-taught, famous on X', 'ex-national lab', 'ex-robotics startup',
    'Olympiad medalist', 'ex-chip designer', 'ex-government', 'ex-consulting'];
})(globalThis.FL = globalThis.FL || {});
