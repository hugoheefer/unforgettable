// Every sentence the player can read lives in app/js/texts/ (or, for programming mistakes, in errors.js).
// This scan looks at string literals only, so comments, import paths and regular expressions cannot trip it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const jsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../app/js');
const EXEMPT_FILES = new Set(['errors.js']);
const EXEMPT_DIRS = new Set(['texts']);
/** CSS class lists are two words with a space but no sentence. Exact strings only, so a new phrase never slips in. */
const ALLOWED_STRINGS = new Set(['primary next']);
/** A space with a word of three or more letters on both sides. */
const PHRASE = /\p{L}{3} \p{L}{3}/u;
const QUOTES = new Set(["'", '"']);
const REGEX_CAN_FOLLOW = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

/** @returns {{ line: number, text: string }[]} every piece of text of every string and template literal */
export function stringPieces(source) {
  const pieces = [];
  let i = 0;
  let line = 1;

  const skipTo = (end) => {
    while (i < source.length && !source.startsWith(end, i)) {
      if (source[i] === '\n') line += 1;
      i += 1;
    }
    i += end.length;
  };

  const readQuoted = (quote) => {
    const start = line;
    let text = '';
    i += 1;
    while (i < source.length && source[i] !== quote) {
      if (source[i] === '\\') { text += source[i + 1]; i += 2; continue; }
      text += source[i];
      i += 1;
    }
    i += 1;
    pieces.push({ line: start, text });
  };

  const skipRegex = () => {
    let inClass = false;
    i += 1;
    while (i < source.length && (source[i] !== '/' || inClass)) {
      if (source[i] === '\\') i += 1;
      else if (source[i] === '[') inClass = true;
      else if (source[i] === ']') inClass = false;
      i += 1;
    }
    i += 1;
    while (/[a-z]/i.test(source[i] ?? '')) i += 1;
  };

  const readTemplate = () => {
    let start = line;
    let text = '';
    i += 1;
    while (i < source.length && source[i] !== '`') {
      if (source[i] === '\\') { text += source[i + 1]; i += 2; continue; }
      if (source.startsWith('${', i)) {
        pieces.push({ line: start, text });
        text = '';
        i += 2;
        scanCode(true);
        start = line;
        continue;
      }
      if (source[i] === '\n') line += 1;
      text += source[i];
      i += 1;
    }
    i += 1;
    pieces.push({ line: start, text });
  };

  function scanCode(insideTemplate) {
    let last = '';
    let depth = 0;
    while (i < source.length) {
      const c = source[i];
      if (c === '\n') { line += 1; i += 1; continue; }
      if (c === '/' && source[i + 1] === '/') { skipTo('\n'); line += 1; continue; }
      if (c === '/' && source[i + 1] === '*') { skipTo('*/'); continue; }
      if (QUOTES.has(c)) { readQuoted(c); last = 'x'; continue; }
      if (c === '`') { readTemplate(); last = 'x'; continue; }
      if (c === '/' && REGEX_CAN_FOLLOW.has(last)) { skipRegex(); last = 'x'; continue; }
      if (insideTemplate && c === '}' && depth === 0) { i += 1; return; }
      if (c === '{') depth += 1;
      if (c === '}') depth -= 1;
      if (!/\s/.test(c)) last = c;
      i += 1;
    }
  }

  scanCode(false);
  return pieces;
}

/** @returns {{ line: number, text: string }[]} the pieces that read as a phrase */
export const loosePhrases = (source) =>
  stringPieces(source).filter(({ text }) => PHRASE.test(text) && !ALLOWED_STRINGS.has(text));

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return EXEMPT_DIRS.has(entry.name) ? [] : sourceFiles(join(dir, entry.name));
    return entry.name.endsWith('.js') && !EXEMPT_FILES.has(entry.name) ? [join(dir, entry.name)] : [];
  });
}

test('no file outside texts/ and errors.js has a phrase in a string', () => {
  const found = [];
  for (const file of sourceFiles(jsDir)) {
    for (const { line, text } of loosePhrases(readFileSync(file, 'utf8'))) found.push(`${file.slice(jsDir.length + 1)}:${line}  "${text}"`);
  }
  assert.deepEqual(found, []);
});

test('the scan sees a phrase in a quoted string and in a template, with its line', () => {
  assert.deepEqual(loosePhrases("const a = 1;\nconst b = 'Not here';"), [{ line: 2, text: 'Not here' }]);
  assert.deepEqual(loosePhrases('const b = `You see ${x}\nhere now`;').map((p) => p.line), [1, 1]);
});

test('the scan sees a string inside the expression of a template', () => {
  assert.equal(loosePhrases("const b = `${count === 1 ? 'one move' : 'many'}`;").length, 1);
});

test('the scan ignores comments, regular expressions, words without a space and short words', () => {
  const source = [
    "// a comment with several words 'in quotes'",
    '/* and a block comment',
    '   with several words */',
    "import { x } from './some/long-path.js';",
    "const parts = text.split(/:(.*) here/s);",
    "const id = `pocket:${a}/${b}`;",
    "const id2 = 'choice-label';",
    "const short = 'a to be';",
  ].join('\n');
  assert.deepEqual(loosePhrases(source), []);
});

test('the scan allows the class list "primary next" and nothing else like it', () => {
  assert.deepEqual(loosePhrases("el('button', 'primary next');"), []);
  assert.equal(loosePhrases("el('button', 'primary other');").length, 1);
});
