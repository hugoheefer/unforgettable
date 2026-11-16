// A sentence nobody asks for is dead weight for every translator. The name tables and the per-code tables are
// read with a computed key, so they are used when their table is read at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { en } from '../app/js/texts/en.js';

const jsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../app/js');

function sourceOutsideTexts(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return entry.name === 'texts' ? [] : sourceOutsideTexts(join(dir, entry.name));
    return entry.name.endsWith('.js') ? [readFileSync(join(dir, entry.name), 'utf8')] : [];
  });
}

test('every sentence and table of the English texts is read somewhere in the app', () => {
  const source = sourceOutsideTexts(jsDir).join('\n');
  const unused = Object.keys(en).filter((key) => !new RegExp(`\\.${key}\\b`).test(source));
  assert.deepEqual(unused, []);
});
