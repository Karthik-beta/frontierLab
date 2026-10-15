/* data/stats.js — simulation values (0..1) and the links between them.
 * good:false means higher is worse (drawn red as it rises). */
(function (FL) {
  'use strict';

  FL.STATS = [
    { id: 'compute', name: 'Compute Capacity', icon: '🖥️', base: 0.10, good: true,
      desc: 'GPUs you can actually train and serve on. The single biggest driver of research velocity, and the single biggest line on your burn.' },
    { id: 'talent', name: 'Talent Density', icon: '🧑‍🔬', base: 0.25, good: true,
      desc: 'How many of the world\'s best researchers work for you. Researchers follow compute, pay, mission and winning.' },
    { id: 'morale', name: 'Morale', icon: '💪', base: 0.50, good: true,
      desc: 'How the staff feel. Low morale means attrition, leaks and open letters.' },
    { id: 'velocity', name: 'Research Velocity', icon: '⚡', base: 0.00, good: true,
      desc: 'How fast frontier capability advances each quarter. Built from compute, talent, data and research programs.' },
    { id: 'safety', name: 'Safety Maturity', icon: '🛡️', base: 0.08, good: true,
      desc: 'Alignment, evals and control. Decides whether reaching AGI is a triumph or a catastrophe.' },
    { id: 'quality', name: 'Product Quality', icon: '⭐', base: 0.05, good: true,
      desc: 'How good your shipped models and products feel to users. Mostly follows capability.' },
    { id: 'adoption', name: 'Adoption', icon: '👥', base: 0.00, good: true,
      desc: 'Share of the market using your models — consumers, developers and enterprises.' },
    { id: 'monetization', name: 'Monetization', icon: '💵', base: 0.05, good: true,
      desc: 'How much revenue each unit of adoption turns into. Driven by pricing and business lines.' },
    { id: 'hype', name: 'Hype', icon: '🔥', base: 0.10, good: true,
      desc: 'The narrative. Investors pay for it, regulators notice it, and it can pop.' },
    { id: 'trust', name: 'Public Trust', icon: '🤝', base: 0.45, good: true,
      desc: 'Whether the public believes you are the responsible ones.' },
    { id: 'regHeat', name: 'Regulatory Heat', icon: '🏛️', base: 0.05, good: false,
      desc: 'Government attention. Too much leads to investigations — and eventually injunctions.' },
    { id: 'data', name: 'Data Advantage', icon: '🗄️', base: 0.15, good: true,
      desc: 'Proprietary data, usage flywheel and synthetic pipelines.' },
    { id: 'security', name: 'Security Posture', icon: '🔐', base: 0.25, good: true,
      desc: 'How hard it is to steal your weights. Matters more as capability rises.' },
    { id: 'legal', name: 'Legal Exposure', icon: '⚖️', base: 0.05, good: false,
      desc: 'Copyright, privacy and liability risk built up from how you got your data.' },
    { id: 'openness', name: 'Research Openness', icon: '📖', base: 0.15, good: true,
      desc: 'How much you share. Researchers love it; security teams and some investors do not.' },
  ];

  /* Indicators are computed directly by the engine, not by effect edges. */
  FL.INDICATORS = [
    { id: 'capability', name: 'Frontier Capability', icon: '🚀', good: true,
      desc: 'Your best model\'s capability. 100 = AGI. Everything gets more intense as it rises.' },
    { id: 'lead', name: 'Race Position', icon: '🏁', good: true,
      desc: 'Your capability relative to the best rival lab. 50% = neck and neck.' },
    { id: 'runway', name: 'Runway', icon: '⏳', good: true,
      desc: 'Quarters of cash left at current burn (100% = 8+ quarters).' },
    { id: 'revGrowth', name: 'Revenue Momentum', icon: '📈', good: true,
      desc: 'Year-on-year revenue growth. Investors care about this almost as much as hype.' },
  ];

  /* Stat → stat edges. k = weight, curve: lin | sqrt | sq | ctr ((x-.5)*2) | inv (1-x), lag in quarters. */
  FL.STAT_LINKS = [
    { from: 'compute', to: 'velocity', k: 0.40, curve: 'sqrt', lag: 2 },
    { from: 'talent', to: 'velocity', k: 0.30, lag: 2 },
    { from: 'data', to: 'velocity', k: 0.12, lag: 2 },
    { from: 'morale', to: 'velocity', k: 0.08, curve: 'ctr', lag: 1 },

    { from: 'morale', to: 'talent', k: 0.15, curve: 'ctr', lag: 3 },
    { from: 'openness', to: 'talent', k: 0.10, lag: 3 },
    { from: 'lead', to: 'talent', k: 0.12, curve: 'ctr', lag: 3 },
    { from: 'compute', to: 'talent', k: 0.10, lag: 3 },

    { from: 'lead', to: 'morale', k: 0.10, curve: 'ctr', lag: 2 },
    { from: 'runway', to: 'morale', k: 0.10, curve: 'ctr', lag: 2 },

    { from: 'talent', to: 'safety', k: 0.08, lag: 3 },

    { from: 'capability', to: 'quality', k: 0.60, lag: 1 },
    { from: 'talent', to: 'quality', k: 0.10, lag: 2 },

    { from: 'quality', to: 'adoption', k: 0.25, lag: 2 },
    { from: 'hype', to: 'adoption', k: 0.15, lag: 2 },
    { from: 'trust', to: 'adoption', k: 0.08, curve: 'ctr', lag: 2 },

    { from: 'capability', to: 'hype', k: 0.25, lag: 1 },
    { from: 'lead', to: 'hype', k: 0.15, curve: 'ctr', lag: 1 },
    { from: 'adoption', to: 'hype', k: 0.10, lag: 2 },

    { from: 'safety', to: 'trust', k: 0.25, curve: 'ctr', lag: 3 },
    { from: 'security', to: 'trust', k: 0.06, curve: 'ctr', lag: 3 },
    { from: 'legal', to: 'trust', k: -0.10, lag: 3 },

    { from: 'capability', to: 'regHeat', k: 0.30, lag: 2 },
    { from: 'adoption', to: 'regHeat', k: 0.12, lag: 3 },
    { from: 'hype', to: 'regHeat', k: 0.08, lag: 2 },
    { from: 'safety', to: 'regHeat', k: -0.12, curve: 'ctr', lag: 3 },
    { from: 'trust', to: 'regHeat', k: -0.12, curve: 'ctr', lag: 3 },
    { from: 'legal', to: 'regHeat', k: 0.10, lag: 3 },

    { from: 'adoption', to: 'data', k: 0.30, curve: 'sqrt', lag: 3 },

    { from: 'openness', to: 'security', k: -0.08, lag: 2 },
    { from: 'talent', to: 'security', k: 0.05, lag: 2 },

    { from: 'adoption', to: 'legal', k: 0.08, lag: 3 },
    { from: 'capability', to: 'legal', k: 0.05, lag: 3 },
  ];
})(globalThis.FL = globalThis.FL || {});
