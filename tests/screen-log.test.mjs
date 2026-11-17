import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScreenLog } from '../app/js/screen-log.js';

const screen = (command, picked = null) => ({ lead: [], command, picked });

test('a new log is empty', () => {
  const log = createScreenLog();
  assert.equal(log.isEmpty(), true);
  assert.deepEqual(log.entries(), []);
});

test('the screens come back in the order they were recorded', () => {
  const log = createScreenLog();
  log.record(screen('one'));
  log.record(screen('two', 'Go on'));
  assert.equal(log.isEmpty(), false);
  assert.deepEqual(log.entries().map((entry) => entry.command), ['one', 'two']);
  assert.equal(log.entries()[1].picked, 'Go on');
});

test('only the last screens are kept: the oldest one is pushed out', () => {
  const log = createScreenLog(3);
  for (const command of ['a', 'b', 'c', 'd']) log.record(screen(command));
  assert.deepEqual(log.entries().map((entry) => entry.command), ['b', 'c', 'd']);
});

test('clearing empties the log', () => {
  const log = createScreenLog();
  log.record(screen('one'));
  log.clear();
  assert.equal(log.isEmpty(), true);
});

test('what was recorded cannot be changed afterwards, neither through the screen given nor through the entries given back', () => {
  const log = createScreenLog();
  const given = { lead: ['x'], command: 'one', picked: null };
  log.record(given);
  given.lead.push('y');
  given.command = 'changed';
  log.entries()[0].lead.push('z');
  log.entries().pop();
  assert.deepEqual(log.entries(), [{ lead: ['x'], command: 'one', picked: null }]);
});
