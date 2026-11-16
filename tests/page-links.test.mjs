import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../app');
const pagePath = resolve(appDir, 'index.html');

function linksIn(html) {
  return [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
}

test('the game page exists so it can be mirrored as one folder', () => {
  assert.equal(existsSync(pagePath), true);
});

test('every link in the page is relative, so it works from any folder', () => {
  const links = linksIn(readFileSync(pagePath, 'utf8'));
  assert.notEqual(links.length, 0);
  for (const link of links) assert.doesNotMatch(link, /^(\/|[a-z]+:)/i, link);
});

test('every linked file exists inside the app folder', () => {
  const links = linksIn(readFileSync(pagePath, 'utf8'));
  for (const link of links) assert.equal(existsSync(resolve(appDir, link)), true, link);
});

test('the page is not indexed by search engines', () => {
  assert.match(readFileSync(pagePath, 'utf8'), /<meta name="robots" content="noindex">/);
});
