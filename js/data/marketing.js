/* data/marketing.js — one-off campaigns and the launch-strategy decision for each new model.
 * Campaigns are booked during a quarter and resolved at quarter end with variance:
 *   outcomes: [{ p, label, fx: [[target, amount, quarters]], stat: 'signups'|'impressions'|... }]
 * cost is $M at turn 1 (scales with company size). onlyQ: quarter of the year it can run. */
(function (FL) {
  'use strict';

  FL.CAMPAIGNS = [
    { id: 'superBowl', name: 'Super Bowl Ad', cost: 300, bandwidth: 2, cooldown: 4, onlyQ: 1,
      desc: 'Sixty seconds in front of a hundred million people. Only bookable in Q1, ahead of the game.',
      outcomes: [
        { p: 0.55, label: 'The ad landed. Everyone is talking about it the next morning.', fx: [['brand', 0.14, 8], ['hype', 0.1, 3], ['adoption', 0.04, 4]] },
        { p: 0.3, label: 'Solid, forgettable. Brand awareness up; nobody remembers the ad.', fx: [['brand', 0.08, 8], ['hype', 0.03, 2]] },
        { p: 0.15, label: 'The ad is a meme — for the wrong reasons.', fx: [['brand', 0.05, 6], ['trust', -0.05, 4], ['media', -0.12, 3]] },
      ] },
    { id: 'productHunt', name: 'Launch on Product Hunt & Show HN', cost: 1, bandwidth: 1, cooldown: 6,
      desc: 'A day of upvotes and brutal comments from the most online developers alive.',
      quality: true,
      outcomes: [
        { p: 0.35, label: '#1 Product of the Day. The top comment is still a complaint.', fx: [['adoption', 0.04, 4], ['brand', 0.04, 6], ['openSource', 0.1, 3]] },
        { p: 0.45, label: 'A respectable top-ten finish.', fx: [['adoption', 0.015, 3], ['brand', 0.015, 4]] },
        { p: 0.2, label: 'The top comment found a bug in the demo. It got more upvotes than you.', fx: [['hype', -0.03, 2]] },
      ] },
    { id: 'waitlist', name: 'Invite-only Waitlist', cost: 5, bandwidth: 2, cooldown: 8,
      desc: 'Make people wait, then make them feel chosen. Scarcity drives buzz; it also sends some users elsewhere.',
      outcomes: [
        { p: 0.6, label: 'Invites are trading for real money. Waitlist: millions.', fx: [['hype', 0.09, 3], ['brand', 0.05, 6], ['adoption', -0.02, 2], ['consumers', -0.05, 2]] },
        { p: 0.4, label: 'People signed up, then forgot. The hype cooled before invites went out.', fx: [['hype', 0.03, 2], ['adoption', -0.02, 2]] },
      ] },
    { id: 'referral', name: 'Referral Program', cost: 60, bandwidth: 2, cooldown: 8,
      desc: 'Give users more free usage for every friend they bring. Your users become your sales team.',
      quality: true,
      outcomes: [
        { p: 0.5, label: 'Signups up sharply. Your users are recruiting for you.', fx: [['adoption', 0.07, 6], ['brand', 0.04, 6], ['monetization', -0.02, 4]] },
        { p: 0.5, label: 'Modest lift. Mostly existing users gaming the credits.', fx: [['adoption', 0.02, 4], ['monetization', -0.02, 3]] },
      ] },
    { id: 'stunt', name: 'Viral Stunt', cost: 25, bandwidth: 2, cooldown: 5,
      desc: 'Something loud, weird and shareable. High variance by design.',
      outcomes: [
        { p: 0.3, label: 'It went viral. Your stunt is on every feed.', fx: [['hype', 0.12, 3], ['brand', 0.07, 6]] },
        { p: 0.45, label: 'A few million views. Nice, not world-changing.', fx: [['hype', 0.03, 2], ['brand', 0.02, 4]] },
        { p: 0.25, label: 'It backfired. Op-eds call it tone-deaf.', fx: [['media', -0.2, 4], ['trust', -0.06, 4], ['brand', 0.02, 4]] },
      ] },
    { id: 'aiAd', name: 'AI-Generated Ad Campaign', cost: 10, bandwidth: 1, cooldown: 6,
      desc: 'Have your own model make the ads. Cheap, on-message, and a proof point — if people like it.',
      outcomes: [
        { p: 0.5, label: 'People loved it — a perfect demo of what the model can do.', fx: [['brand', 0.06, 6], ['hype', 0.06, 3]] },
        { p: 0.5, label: 'Backlash: viewers called it soulless and creatives called it a threat.', fx: [['trust', -0.06, 5], ['media', -0.18, 4], ['consumers', -0.1, 3], ['brand', 0.03, 4]] },
      ] },
    { id: 'billboards', name: 'Provocative Billboards', cost: 15, bandwidth: 1, cooldown: 6,
      desc: 'A slogan designed to make people angry enough to photograph it.',
      outcomes: [
        { p: 0.6, label: 'Rage-bait worked: the billboards are everywhere online.', fx: [['hype', 0.1, 3], ['brand', 0.06, 6], ['trust', -0.06, 4], ['regHeat', 0.03, 4]] },
        { p: 0.4, label: 'The backlash outran the buzz. Protesters defaced them.', fx: [['trust', -0.08, 5], ['media', -0.15, 4], ['brand', 0.03, 4]] },
      ] },
    { id: 'subway', name: 'Subway Takeover', cost: 40, bandwidth: 2, cooldown: 8,
      desc: 'Every poster in a city\'s subway system, for a month.',
      outcomes: [
        { p: 0.55, label: 'Commuters noticed. Brand awareness up across the city.', fx: [['brand', 0.08, 6], ['adoption', 0.02, 4]] },
        { p: 0.45, label: 'New Yorkers defaced half the posters — and the graffiti photos became the campaign.', fx: [['brand', 0.07, 6], ['hype', 0.05, 3], ['trust', -0.04, 4]] },
      ] },
    { id: 'pressTour', name: 'Documentary & Press Tour', cost: 20, bandwidth: 3, cooldown: 8,
      desc: 'Let a filmmaker inside the lab and sit for long interviews. Slow, deep brand building.',
      outcomes: [
        { p: 0.65, label: 'The coverage was thoughtful. People feel like they know you.', fx: [['trust', 0.06, 6], ['brand', 0.06, 8]] },
        { p: 0.35, label: 'One unguarded quote is the only thing anyone remembers.', fx: [['brand', 0.04, 6], ['media', -0.1, 3], ['regHeat', 0.04, 4]] },
      ] },
  ];

  /* The launch decision for every new model generation (queued as dilemma 'modelLaunch'). */
  FL.DILEMMAS.push({
    id: 'modelLaunch', title: 'Launch Day', launch: true, when: () => false,
    text: 'Your new flagship model is trained, evaluated and ready. How do you put it into the world?',
    options: [
      { label: 'Low-key research preview', desc: 'Ship it quietly and let the product speak. Sometimes the quiet ones explode.',
        chance: { p: 0.5, launchViral: true,
          win: { text: 'It went viral anyway. A million users in a week, and nobody planned for it.', fx: [['adoption', 0.12, 6], ['hype', 0.12, 4], ['brand', 0.08, 8]] },
          lose: { text: 'A quiet launch, as planned. The people who matter noticed.', fx: [['hype', 0.03, 3], ['researchers', 0.05, 3]] } } },
      { label: 'Livestream keynote with live demos', desc: 'Maximum attention. Live demos are a dare.',
        chance: { p: 0.5, launchDemo: true,
          win: { text: 'Flawless. The demo clips have tens of millions of views.', fx: [['hype', 0.13, 4], ['brand', 0.07, 8], ['adoption', 0.04, 4], ['investors', 0.1, 3]] },
          lose: { text: 'A live demo failed on stage. The clip of the awkward pause is everywhere.', fx: [['hype', -0.06, 4], ['investors', -0.15, 3], ['media', -0.12, 3]] } } },
      { label: 'Staged rollout with a waitlist', desc: 'Slower, safer, and scarcity makes it feel special.',
        fx: [['hype', 0.07, 3], ['brand', 0.04, 6], ['safety', 0.02, 4], ['adoption', 0.03, 6]] },
      { label: 'Benchmark blitz', desc: 'Lead with leaderboard wins. Investors love charts; researchers roll their eyes.',
        meter: ['theranos', 0.12], fx: [['hype', 0.1, 3], ['investors', 0.12, 3], ['trust', -0.04, 4], ['researchers', -0.05, 3]] },
    ],
  });
})(globalThis.FL = globalThis.FL || {});
