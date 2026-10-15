/* data/interactions.js — moves you can make toward a rival lab, and the hidden personas that decide
 * how rivals respond and how they treat you. Logic lives in js/rivals.js; numbers live here.
 * cost: bandwidth + cash ($M at turn 1, scaled with company size). cooldown: game weeks per target. */
(function (FL) {
  'use strict';

  FL.INTERACTIONS = [
    // ── Hostile ─────────────────────────────────────────────
    { id: 'poachTeam', kind: 'hostile', name: 'Poach a team', bw: 4, cash: 150, cooldown: 26,
      desc: 'Hire away a group of their researchers. Slows them, strengthens you, gives you a fresh read on their progress — and sometimes buys you a lawsuit.',
      history: 'Waymo sued Uber after an engineer who left Google founded a startup Uber acquired; Uber settled mid-trial in 2018 for equity worth about $245M.' },
    { id: 'priceWar', kind: 'hostile', name: 'Start a price war', bw: 3, cash: 0, cooldown: 26,
      desc: 'Undercut their API prices. Both of you bleed margin; they bleed more if you are bigger.',
      history: 'In 2024 a price war broke out among Chinese AI labs, with several cutting model API prices dramatically within weeks.' },
    { id: 'antitrust', kind: 'hostile', name: 'File an antitrust complaint', bw: 4, cash: 30, cooldown: 39,
      desc: 'Brief regulators on their partnerships and conduct. Works best when regulators like you; can look petty.',
      history: 'In January 2024 the US FTC opened an inquiry into the investments big tech companies had made in AI startups.' },
    { id: 'espionage', kind: 'hostile', name: 'Corporate espionage', bw: 3, cash: 50, cooldown: 26, risky: true,
      desc: 'Get your hands on their internal documents. A big edge if it works. A criminal case if it does not.',
      history: 'In 2024 a former Google engineer was indicted in the US for allegedly stealing AI trade secrets.' },
    { id: 'smear', kind: 'hostile', name: 'Smear campaign', bw: 2, cash: 40, cooldown: 26, anonymous: true,
      desc: 'Quietly fund critics, op-eds and leaks about their failures. Anonymous — until it is not.',
      history: 'Microsoft ran its "Scroogled" campaign attacking Google from 2012 to 2014.' },
    { id: 'lockout', kind: 'hostile', name: 'Outbid them for compute', bw: 3, cash: 350, cooldown: 39,
      desc: 'Buy out the capacity they were about to sign. You get some of it; they get a shortage.',
      history: 'During the 2023 GPU shortage, labs and hyperscalers raced to reserve entire production runs years in advance.' },
    { id: 'ipSuit', kind: 'hostile', name: 'Sue them over IP', bw: 3, cash: 80, cooldown: 52,
      desc: 'Claim they used your methods or data. A settlement is possible; so is an embarrassing loss.',
      history: 'Frontier labs and their partners have spent years in court over training data, trade secrets and contracts.' },
    // ── Cooperative (needs their consent) ───────────────────
    { id: 'safetyPact', kind: 'coop', name: 'Joint safety research', bw: 3, cash: 20, cooldown: 39,
      desc: 'Share evals, red-team findings and incident reports. Both of you get safer; you lose a little speed.',
      history: 'In July 2023 Anthropic, Google, Microsoft and OpenAI launched the Frontier Model Forum to share safety research.' },
    { id: 'pausePact', kind: 'coop', name: 'Propose a mutual slowdown', bw: 5, cash: 0, cooldown: 52,
      desc: 'Both labs slow frontier scaling for a quarter. They might agree. They might also secretly keep going.',
      history: 'In March 2023 an open letter called for a six-month pause on training models more powerful than GPT-4. No frontier lab paused.' },
    { id: 'sellCapacity', kind: 'coop', name: 'Sell them spare compute', bw: 2, cash: 0, cooldown: 26,
      desc: 'Rent out a slice of your fleet for a quarter. Cash now; you are arming a competitor.',
      history: 'Big cloud providers routinely rent capacity to labs they also compete with.' },
    { id: 'license', kind: 'coop', name: 'License them your model', bw: 2, cash: 0, cooldown: 39,
      desc: 'Let them build on your model for a fee. Good money; they get faster.',
      history: 'In March 2024 Microsoft paid Inflection AI about $650M, largely to license its models, while hiring most of its staff.' },
    { id: 'coalition', kind: 'coop', name: 'Form an industry coalition', bw: 3, cash: 30, cooldown: 39,
      desc: 'A joint pledge and lobbying front. Regulators relax; critics call it capture.',
      history: 'At the May 2024 Seoul AI summit, 16 AI companies signed the Frontier AI Safety Commitments.' },
    { id: 'acquire', kind: 'coop', name: 'Acquire them', bw: 6, cash: 0, cooldown: 52,
      desc: 'Buy a lab that is clearly behind you. Their people and compute become yours; antitrust regulators notice.',
      history: 'Google acquired DeepMind in 2014 for a reported $400M–$500M+.' },
  ];

  /* Hidden personas. Shown to the player only as hints that firm up after rivals act. */
  FL.PERSONAS = {
    aggressive: { name: 'Aggressive', aggression: 0.9, safety: 0.2, honesty: 0.4, open: 0.3, hint: 'plays hardball' },
    cautious: { name: 'Cautious', aggression: 0.25, safety: 0.85, honesty: 0.85, open: 0.4, hint: 'safety-minded' },
    open: { name: 'Open', aggression: 0.4, safety: 0.5, honesty: 0.7, open: 0.95, hint: 'shares everything' },
    secretive: { name: 'Secretive', aggression: 0.6, safety: 0.45, honesty: 0.35, open: 0.1, hint: 'keeps its cards close' },
  };
  FL.RIVAL_PERSONA = { prometheus: 'aggressive', colossus: 'secretive', hydra: 'open' };

  /* Rival-initiated moves land in your inbox (rendered dynamically by js/rivals.js). */
  const proposal = (id, title) => ({ id, title, rival: true, deadlineWeeks: 5, default: 1, when: () => false, text: '', options: [
    { label: 'Accept', desc: 'Go along with it.' }, { label: 'Decline', desc: 'No deal.' }] });
  FL.DILEMMAS.push(
    proposal('rv:safetyPact', 'A rival proposes joint safety research'),
    proposal('rv:pausePact', 'A rival proposes a mutual slowdown'),
    proposal('rv:coalition', 'A rival proposes an industry coalition'),
    proposal('rv:license', 'A rival wants to license your model'),
    proposal('rv:buyCapacity', 'A rival wants to rent your spare compute'),
    proposal('rv:acquire', 'A rival offers to acquire you'),
    { id: 'rv:poachOffer', title: 'A rival is courting your people', rival: true, deadlineWeeks: 4, default: 1, when: () => false, text: '',
      options: [{ label: 'Counter-offer', desc: 'Pay to keep them.' }, { label: 'Let them go', desc: 'Save the money.' }] },
    { id: 'rv:lawsuit', title: 'A rival is suing you', rival: true, deadlineWeeks: 5, default: 1, when: () => false, text: '',
      options: [{ label: 'Settle', desc: 'Pay and move on.' }, { label: 'Fight it', desc: 'Risk a bigger loss to avoid paying.' }] },
  );
})(globalThis.FL = globalThis.FL || {});
