// Headless balance simulator: plays N games per archetype with simple bots.
// Usage: node tools/simulate.js [gamesPerCell=40] [verboseSeed]
const load = require('../test/load');
const FL = load();
const E = FL.Engine;

const BOTS = FL.Bots;

function play(arch, bot, seed, verbose, dif) {
  const s = E.newGame(arch, 'Sim', seed, dif);
  let r;
  while (!s.ended) {
    BOTS[bot](s);
    r = E.endTurn(s);
    if (s.pendingDilemma) E.resolveDilemma(s, E.rand(s) < 0.5 ? 0 : 1);
    if (verbose) {
      console.log(`${r.label} cash=${E.fmtMoney(s.cash)} net=${E.fmtMoney(s.finance.net)} rev=${E.fmtMoney(s.finance.revenue)} cap=${s.cap.toFixed(1)} rival=${E.bestRival(s).cap.toFixed(1)} vel=${s.values.velocity.toFixed(2)} saf=${s.values.safety.toFixed(2)} adop=${s.values.adoption.toFixed(2)} heat=${s.values.regHeat.toFixed(2)} board=${s.happiness.board.toFixed(2)} inv=${s.happiness.investors.toFixed(2)} bw=${s.bandwidth} val=${E.fmtMoney(s.valuation)} sit=[${Object.keys(s.active).filter((k) => s.active[k]).join(',')}]${r.funding ? ' ROUND ' + r.funding.text : ''}`);
    }
  }
  return { ending: s.ended.id, turn: s.turn - 1, cap: s.cap, safety: s.values.safety };
}

const N = +(process.argv[2] || 40);
const DIF = process.env.DIFFICULTY || 'normal';
if (process.argv[3]) {
  const [arch, bot, seed] = process.argv[3].split(':');
  console.log(play(arch, bot, +seed, true));
  process.exit(0);
}
for (const bot of Object.keys(BOTS)) {
  for (const a of FL.ARCHETYPES) {
    const tally = {}; let turns = 0, saf = 0;
    for (let i = 0; i < N; i++) {
      const r = play(a.id, bot, 1000 + i, false, DIF);
      tally[r.ending] = (tally[r.ending] || 0) + 1;
      turns += r.turn; saf += r.safety;
    }
    console.log(`${bot.padEnd(11)} ${a.id.padEnd(10)} avgTurn=${(turns / N).toFixed(1).padStart(4)} safety=${(saf / N).toFixed(2)} ` + Object.entries(tally).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}:${v}`).join(' '));
  }
}
