const test = require('node:test');
const assert = require('node:assert');
const load = require('./load');

const FL = load();
const E = FL.Engine, R = FL.Rivals;

test('every interaction can be performed against an AI rival', () => {
  for (const a of FL.INTERACTIONS) {
    const s = E.newGame('spinout', 'T', 21);
    s.bandwidth = 40; s.cash = 1e6; s.cap = 60; // far enough ahead to make an acquisition possible
    const r = s.rivals[2];
    s.intel[r.id] = { est: 10, sd: 1, seenAt: s.t, source: 'test' };
    if (a.id === 'sellCapacity' && !s.hw.fleet.length) s.hw.fleet.push({ id: 99, gen: 'halcyon', pods: 5, acquired: 0, health: 1, cost: 150, book: 150 });
    const res = R.act(s, a.id, r.id);
    assert.ok(res.ok, `${a.id}: ${res.reason}`);
    assert.ok(typeof res.text === 'string' && res.text.length, a.id);
    assert.ok(R.blocker(s, a.id, r.id), `${a.id} should be on cooldown`);
  }
});

test('hostile moves sour the relationship and build a grudge', () => {
  const s = E.newGame('defectors', 'T', 22);
  s.bandwidth = 40; s.cash = 1e6;
  const r = s.rivals[0];
  R.act(s, 'priceWar', r.id);
  const rec = R.rec(s, r);
  assert.ok(rec.rel < 0);
  assert.ok(rec.grudge >= 1);
});

test('AI rivals act on you over time, and their proposals resolve', () => {
  let incoming = 0, resolved = 0;
  for (let seed = 0; seed < 6; seed++) {
    const s = E.newGame('defectors', 'T', 30 + seed);
    for (let q = 0; q < 10 && !s.ended; q++) {
      E.endTurn(s);
      for (const item of s.inbox.slice()) {
        if (!item.id.startsWith('rv:')) continue;
        const view = E.dilemmaView(s, item);
        assert.ok(view.title && view.text, item.id);
        E.resolveDilemma(s, q % 2, item.uid);
        resolved++;
      }
      while (s.pendingDilemma && !s.ended) E.resolveDilemma(s, 0);
    }
    incoming += s.journal.filter((j) => j.type === 'attacked' || (j.type === 'decision' && /rival/i.test(j.text))).length;
  }
  assert.ok(incoming > 0, 'rivals never acted');
  assert.ok(resolved > 0, 'no rival proposals were resolved');
});
