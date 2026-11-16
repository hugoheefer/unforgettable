import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../app/js/layout.js';
import { THINGS as ITEMS, defaultPlan } from '../app/js/things.js';
import { LANGUAGES, textsFor } from '../app/js/texts.js';
import { REFUSALS } from '../app/js/errors.js';
import { THINGS } from '../app/js/things.js';
import { buildDay, HURRY_REASONS } from '../app/js/scenario.js';
import { TEXTS } from './texts-helper.mjs';
import { rand } from './day-helper.mjs';

const ids = (list) => list.map((entry) => entry.id);

/** Every form a sentence may need, per kind of name (see "Rules for texts" in stories.md). */
const FORMS = {
  things: ['name', 'your'],
  rooms: ['name', 'in', 'to'],
  spots: ['name', 'at'],
  garments: ['name', 'your', 'my'],
  pockets: ['name', 'at'],
};

function missingForms(kind, entryIds) {
  const missing = [];
  for (const id of entryIds) {
    const entry = TEXTS[kind]?.[id];
    for (const form of FORMS[kind]) {
      if (typeof entry?.[form] !== 'string' || entry[form].length === 0) missing.push(`${kind}.${id}.${form}`);
    }
  }
  return missing;
}

const kindOf = (value) => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value);

function mismatches(reference, other, path = '') {
  const found = [];
  for (const key of Object.keys(reference)) {
    const here = `${path}${key}`;
    if (!(key in other)) found.push(`${here} is missing`);
    else if (kindOf(other[key]) !== kindOf(reference[key])) found.push(`${here} is a ${kindOf(other[key])}, not a ${kindOf(reference[key])}`);
    else if (kindOf(reference[key]) === 'object') found.push(...mismatches(reference[key], other[key], `${here}.`));
  }
  return found;
}

test('every thing of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('things', ids(ITEMS)), []);
});

test('every room of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('rooms', ids(LAYOUT.places)), []);
});

test('every spot of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('spots', LAYOUT.places.flatMap((place) => ids(place.spots))), []);
});

test('every garment of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('garments', ids(LAYOUT.garments)), []);
});

test('every pocket of the layout has all its forms in the texts', () => {
  assert.deepEqual(missingForms('pockets', LAYOUT.garments.flatMap((garment) => ids(garment.pockets))), []);
});

test('every thing knows what to say when it has to be found', () => {
  const missing = ids(ITEMS).filter((id) => typeof TEXTS.findPrompts?.[id] !== 'string' || TEXTS.findPrompts[id].length === 0);
  assert.deepEqual(missing, []);
});

test('every refusal of the game has a sentence for the player', () => {
  const missing = Object.keys(REFUSALS).filter((code) => typeof TEXTS.refusals?.[code] !== 'string' || TEXTS.refusals[code].length === 0);
  assert.deepEqual(missing, []);
});

test('an unknown language code gives English', () => {
  assert.equal(textsFor('xx'), textsFor('en'));
});

test('English is in the table of languages under its code', () => {
  const english = LANGUAGES.find((language) => language.code === 'en');
  assert.equal(english.texts, textsFor('en'));
});

for (const language of LANGUAGES) {
  test(`${language.name} has every key of English, of the same kind`, () => {
    assert.deepEqual(mismatches(textsFor('en'), language.texts), []);
  });
}

test('the check of languages notices a missing key and a key of the wrong kind', () => {
  const broken = { ...TEXTS, notHere: () => 'x', next: undefined };
  delete broken.back;
  assert.deepEqual(mismatches(TEXTS, broken).sort(), ['back is missing', 'next is a undefined, not a string', 'notHere is a function, not a string']);
});

const isSentence = (value) => typeof value === 'string' && value.length > 0;

test('every use of every thing has the line before the find and the line after the move', () => {
  const missing = [];
  for (const thing of THINGS) {
    for (const use of thing.uses) {
      for (const form of ['need', 'after']) {
        if (!isSentence(TEXTS.uses?.[thing.id]?.[use.id]?.[form])) missing.push(`uses.${thing.id}.${use.id}.${form}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test('every reason to hurry has a sentence', () => {
  assert.deepEqual(HURRY_REASONS.filter((reason) => !isSentence(TEXTS.hurryReasons?.[reason.id])), []);
});

test('every pause and every arrival that a day can have has a text', () => {
  const things = THINGS;
  const days = [
    buildDay({ dayNumber: 1, things, nowhere: things.map((thing) => thing.id), random: rand() }),
    buildDay({ dayNumber: 2, things, nowhere: [], random: rand({ chance: () => true }) }),
  ];
  const events = days.flat();
  const pauses = new Set(events.filter((event) => event.kind === 'pause').map((event) => event.text));
  const arrivals = new Set(events.filter((event) => event.kind === 'moveTo' && event.text !== 'after').map((event) => event.text));
  assert.deepEqual([...pauses].filter((key) => TEXTS.pauses?.[key] === undefined), []);
  assert.deepEqual([...arrivals].filter((key) => TEXTS.arrivals?.[key] === undefined), []);
  assert.ok(pauses.has('outForTheDay') && arrivals.has('morning'), 'the sample days cover the leaving part');
});
