import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playScriptedRound } from './golden-script.mjs';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/golden-round.json', import.meta.url), 'utf8'));

test('a whole scripted round shows exactly the screens it showed when the fixture was recorded', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(playScriptedRound())), fixture);
});
