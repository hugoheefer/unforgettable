import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT } from '../app/js/layout.js';
import { LANGUAGES, textsFor } from '../app/js/texts.js';
import { REFUSALS } from '../app/js/errors.js';
import { THINGS } from '../app/js/things.js';
import { buildDay, HURRY_REASONS } from '../app/js/scenario.js';
import { ADVICE } from '../app/js/summary.js';
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
  assert.deepEqual(missingForms('things', ids(THINGS)), []);
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

// ---- the summary of a day ----

test('every advice that the summary can give has a sentence', () => {
  assert.deepEqual(ADVICE.filter((row) => typeof TEXTS.advice?.[row.key] !== 'function'), []);
  assert.ok(ADVICE.length > 0, 'the summary has advice rows');
});

test('the home line lists the names of the things that are on their home spot', () => {
  assert.equal(TEXTS.homeLine({ things: [{ name: 'keys' }, { name: 'wallet' }] }), 'On the home spot tonight: keys, wallet.');
  assert.equal(TEXTS.homeLine({ things: [{ name: 'keys' }] }), 'On the home spot tonight: keys.');
});

test('the away line gives each thing with where it is, in brackets', () => {
  const things = [{ thing: { name: 'phone' }, where: 'on the garden table' }, { thing: { name: 'keys' }, where: 'on the sofa' }];
  assert.equal(TEXTS.awayLine({ things }), 'Somewhere else: phone (on the garden table), keys (on the sofa).');
});

test('the searching line says one step in the singular and several in the plural', () => {
  assert.equal(TEXTS.searchedLine({ searched: 9, possible: 4 }), 'Searching cost 9 steps today. Going straight to each thing: 4.');
  assert.equal(TEXTS.searchedLine({ searched: 1, possible: 1 }), 'Searching cost 1 step today. Going straight to each thing: 1.');
});

test('the putting-away line says one step in the singular and several in the plural', () => {
  assert.equal(TEXTS.puttingLine({ steps: 5 }), 'Putting things away cost 5 steps.');
  assert.equal(TEXTS.puttingLine({ steps: 1 }), 'Putting things away cost 1 step.');
  assert.equal(TEXTS.puttingLine({ steps: 0 }), 'Putting things away cost 0 steps.');
});

test('the advice sentences are the ones of the story, the someAway one without a verb that depends on the count', () => {
  const things = [{ name: 'phone' }, { name: 'keys' }];
  assert.equal(TEXTS.advice.noSearch({ things }), 'Nothing to search for today.');
  assert.equal(TEXTS.advice.costly({ things }), "Most of today's steps went into searching. A fixed place costs a few steps once.");
  assert.equal(TEXTS.advice.allHome({ things }), 'Everything is in its place. Tomorrow you will find it without thinking.');
  assert.equal(TEXTS.advice.someAway({ things }), 'Remember where you left: phone, keys. Tomorrow you will know.');
  assert.equal(TEXTS.advice.someAway({ things: [{ name: 'phone' }] }), 'Remember where you left: phone. Tomorrow you will know.');
});

test('the line about coming back tomorrow is the one of the story', () => {
  assert.equal(TEXTS.comeBackTomorrow, 'Come back tomorrow. A night in between is the real test.');
});
