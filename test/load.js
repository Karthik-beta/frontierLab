// Loads the browser scripts into a fresh vm context and returns its FL namespace.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const FILES = ['data/stats', 'data/policies', 'data/stakeholders', 'data/situations', 'data/dilemmas', 'data/archetypes',
  'data/pitfalls', 'data/archive', 'data/progression', 'data/difficulty', 'data/hardware', 'data/hiring', 'data/bloopers', 'data/achievements', 'data/marketing', 'data/world', 'data/regions', 'data/events', 'data/legacy', 'data/ticker', 'engine', 'world', 'fog', 'systems', 'hardware', 'hiring', 'marketing', 'bots', 'growth', 'events', 'legacy'];

module.exports = function load() {
  const ctx = vm.createContext({ console, Math, JSON });
  for (const f of FILES) {
    const file = path.join(__dirname, '..', 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  return ctx.FL;
};
