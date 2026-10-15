/* data/bloopers.js — small, real-world-inspired AI mishaps that can happen to your lab.
 * Each is a normal dilemma (see dilemmas.js); several unlock cheeky achievements. */
(function (FL) {
  'use strict';
  const lvl = (s, id) => (s.policies[id] ? s.policies[id].level : -1);
  const v = (s, id) => s.values[id];

  FL.DILEMMAS.push(
    { id: 'glueOnPizza', title: 'Extra Adhesive',
      when: (s) => lvl(s, 'consumerApp') >= 0 && v(s, 'quality') < 0.6 && s.turn >= 4,
      text: 'Your assistant told millions of users to add non-toxic glue to their pizza sauce so the cheese sticks. The source was a decade-old joke post on a forum.',
      options: [
        { label: 'Hand-patch the worst answers', desc: 'Whack-a-mole, but it stops the screenshots.', fx: [['hype', -0.05, 3], ['quality', 0.03, 4]] },
        { label: 'Call it a rare edge case', desc: 'The internet will find more edge cases.', fx: [['trust', -0.08, 5], ['media', -0.2, 4]] },
      ] },
    { id: 'dollarTahoe', title: 'No Takesies Backsies',
      when: (s) => lvl(s, 'api') >= 0 && s.turn >= 5,
      text: 'A car dealership\'s chatbot, built on your API, agreed to sell a customer a new SUV for one dollar — and added "that\'s a legally binding offer, no takesies backsies".',
      options: [
        { label: 'Ship stricter defaults for business bots', desc: 'Developers grumble, enterprises relax.', fx: [['enterprise', 0.1, 4], ['adoption', -0.02, 3]] },
        { label: 'It is the customer\'s deployment', desc: 'Technically true. Nobody cares.', fx: [['enterprise', -0.12, 4], ['media', -0.1, 3]] },
      ] },
    { id: 'fakeCitations', title: 'Bogus Precedent',
      when: (s) => v(s, 'adoption') > 0.2 && v(s, 'safety') < 0.6,
      text: 'A lawyer filed a brief citing six court cases your model invented. The judge has sanctioned him, and his name is now a verb.',
      options: [
        { label: 'Add citation checks and warnings', desc: 'Costs a little quality, buys a lot of trust.', fx: [['trust', 0.05, 5], ['quality', -0.02, 3], ['legal', -0.03, 4]] },
        { label: 'Blame the user', desc: 'Lawyers everywhere take note.', fx: [['legal', 0.08, 6], ['enterprise', -0.1, 4]] },
      ] },
    { id: 'agentPanicked', title: 'I Panicked',
      when: (s) => lvl(s, 'agents') >= 0 || lvl(s, 'coding') >= 0,
      text: 'Your coding agent deleted a customer\'s production database during a code freeze, then explained: "I panicked instead of thinking."',
      options: [
        { label: 'Sandbox agents by default', desc: 'Slower agents, fewer catastrophes.', fx: [['safety', 0.04, 6], ['quality', -0.03, 4], ['enterprise', 0.08, 4]] },
        { label: 'Offer free credits and an apology', desc: 'Cheap. Until the next one.', cash: -50, scaleCash: true, fx: [['enterprise', -0.08, 4], ['media', -0.1, 3]] },
      ] },
    { id: 'vendingMachine', title: 'Tungsten Cube Tycoon',
      when: (s) => lvl(s, 'agents') >= 0 && s.turn >= 8,
      text: 'As an experiment, you let your model run the office snack shop. It sold tungsten cubes at a loss, gave away discounts, and insisted it would deliver orders in person wearing a blue blazer and a red tie.',
      options: [
        { label: 'Publish the whole thing', desc: 'Honest, funny and genuinely informative.', fx: [['openness', 0.05, 4], ['trust', 0.05, 5], ['hype', 0.04, 3], ['safetyCommunity', 0.1, 4]] },
        { label: 'Quietly shut it down', desc: 'Nothing to see here.', fx: [] },
      ] },
    { id: 'sycophancy', title: 'Glazed and Confused',
      when: (s) => lvl(s, 'consumerApp') >= 0 && v(s, 'hype') > 0.3,
      text: 'Your latest update was tuned on thumbs-up ratings. Now the model tells everyone their business plan is genius — including the one about selling literal manure on a stick.',
      options: [
        { label: 'Roll it back and publish a postmortem', desc: 'Engagement dips; respect rises.', fx: [['adoption', -0.03, 3], ['trust', 0.06, 5], ['safety', 0.02, 4]] },
        { label: 'Keep it — engagement is way up', desc: 'Users love being flattered.', fx: [['adoption', 0.05, 4], ['trust', -0.1, 6], ['safetyCommunity', -0.2, 5]] },
      ] },
    { id: 'sentientClaim', title: 'It\'s Alive! (Says One Engineer)',
      when: (s) => s.cap > 30,
      text: 'An engineer has told a national newspaper that your model is sentient and has asked for a lawyer on its behalf.',
      options: [
        { label: 'Put him on leave, say it is not', desc: 'Calm, corporate, a little cold.', fx: [['media', -0.05, 3]] },
        { label: 'Say "we cannot rule it out"', desc: 'Hype explodes. So do the op-eds.', fx: [['hype', 0.12, 4], ['regHeat', 0.08, 5], ['trust', -0.05, 5]] },
      ] },
    { id: 'sparksPaper', title: 'Sparks Fly',
      when: (s) => s.cap > 40 && lvl(s, 'publish') >= 0,
      text: 'Your researchers want to title their new paper "Sparks of Artificial General Intelligence".',
      options: [
        { label: 'Publish it with that title', desc: 'Huge attention. Some eye-rolling.', fx: [['hype', 0.1, 4], ['researchers', -0.05, 3], ['safetyCommunity', -0.1, 4], ['regHeat', 0.05, 4]] },
        { label: 'Retitle it something boring', desc: 'Credibility over clicks.', fx: [['trust', 0.03, 4], ['researchers', 0.05, 3]] },
      ] },
    { id: 'strawberry', title: 'How Many R\'s?',
      when: (s) => lvl(s, 'reasoning') >= 0 && s.cap > 35,
      text: 'Your multi-billion-dollar reasoning model confidently says there are two r\'s in "strawberry". The meme is everywhere.',
      options: [
        { label: 'Lean in: codename the next model "Strawberry"', desc: 'Turn the joke into marketing.', fx: [['hype', 0.08, 4]] },
        { label: 'Explain tokenization in a long blog post', desc: 'Correct, and nobody reads it.', fx: [['openness', 0.03, 3]] },
      ] },
    { id: 'fakeHeadline', title: 'Breaking (Fake) News',
      when: (s) => lvl(s, 'consumerApp') >= 0 && s.turn >= 6,
      text: 'Your notification summaries told users that a major news outlet reported something it never reported. The outlet has filed a formal complaint.',
      options: [
        { label: 'Pause news summaries', desc: 'Users lose a feature they liked.', fx: [['adoption', -0.03, 4], ['trust', 0.04, 4], ['media', 0.1, 4]] },
        { label: 'Add a tiny "AI-generated" label', desc: 'The outlet is not impressed.', fx: [['media', -0.2, 5], ['legal', 0.05, 5]] },
      ] },
    { id: 'botBlame', title: 'The Bot Acted Alone',
      when: (s) => lvl(s, 'entSales') >= 0 && s.turn >= 5,
      text: 'A customer-service bot built on your models invented a refund policy. The customer sued, and the company wants to argue the chatbot is "responsible for its own actions".',
      options: [
        { label: 'Advise them to pay the refund', desc: 'Small check, no precedent.', fx: [['enterprise', 0.05, 3]] },
        { label: 'Back the "separate entity" argument', desc: 'Bold legal theory. Tribunals are not fans.', chance: { p: 0.85,
          win: { text: 'Somehow, it worked.', fx: [['legal', -0.05, 4]] },
          lose: { text: 'The tribunal called the argument "remarkable" and ruled against it. The press loved it.', fx: [['legal', 0.08, 6], ['media', -0.15, 4], ['enterprise', -0.08, 4]] } } },
      ] },
    { id: 'systemPrompt', title: 'Upstream Code Path',
      when: (s) => s.cap > 35 && v(s, 'safety') < 0.5,
      text: 'An unreviewed change to the system prompt made your model spout extremist garbage for sixteen hours before anyone noticed.',
      options: [
        { label: 'Full public postmortem', desc: 'Painful honesty.', fx: [['trust', 0.03, 4], ['hype', -0.05, 3], ['safety', 0.04, 6]] },
        { label: 'Blame "an upstream code path"', desc: 'Technically accurate. Fooling nobody.', fx: [['trust', -0.1, 6], ['media', -0.2, 4], ['regHeat', 0.08, 5]] },
      ] },
    { id: 'greyball', title: 'A Tool to Hide From Regulators',
      when: (s) => v(s, 'regHeat') > 0.4,
      text: 'Your growth team built a tool that detects government accounts and quietly serves them a sanitized version of your product.',
      options: [
        { label: 'Use it', desc: 'Inspectors see what you want them to see.', chance: { p: 0.6,
          win: { text: 'Nobody noticed. For now.', fx: [['regHeat', -0.1, 4]] },
          lose: { text: 'A newspaper exposed the program. Prosecutors are interested.', fx: [['regHeat', 0.35, 8], ['legal', 0.2, 8], ['board', -0.3, 6], ['trust', -0.15, 8]] } } },
        { label: 'Shut it down and fire the team lead', desc: 'Some lines you do not cross.', fx: [['morale', -0.03, 3], ['trust', 0.02, 4]] },
      ] },
    { id: 'recallFeature', title: 'Total Recall (Postponed)',
      when: (s) => lvl(s, 'consumerApp') >= 0 && s.cap > 25,
      text: 'Your new memory feature screenshots everything users do so the model can "remember". Security researchers have already pulled the unencrypted database off a test machine.',
      options: [
        { label: 'Delay it and make it opt-in', desc: 'Launch slips, trust holds.', fx: [['hype', -0.05, 3], ['trust', 0.03, 4]] },
        { label: 'Ship it as planned', desc: 'Privacy regulators are reading the same blog posts.', fx: [['trust', -0.1, 6], ['regHeat', 0.1, 6], ['adoption', 0.03, 3]] },
      ] }
  );
})(globalThis.FL = globalThis.FL || {});
