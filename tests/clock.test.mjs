import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../app/js/clock.js';

test('today is the local date as year-month-day', () => {
  assert.equal(createClock(() => new Date(2026, 10, 16, 14, 30)).today(), '2026-11-16');
});

test('a month and a day of one digit get a leading zero', () => {
  assert.equal(createClock(() => new Date(2026, 0, 5, 9, 0)).today(), '2026-01-05');
});

test('a minute before midnight is still today, and a minute after is the next day', () => {
  assert.equal(createClock(() => new Date(2026, 11, 31, 23, 59)).today(), '2026-12-31');
  assert.equal(createClock(() => new Date(2027, 0, 1, 0, 1)).today(), '2027-01-01');
});

test('the clock asks the time again at every call', () => {
  let now = new Date(2026, 10, 16, 12, 0);
  const clock = createClock(() => now);
  assert.equal(clock.today(), '2026-11-16');
  now = new Date(2026, 10, 17, 12, 0);
  assert.equal(clock.today(), '2026-11-17');
});

test('without a time source the clock uses the real time and still gives a date', () => {
  assert.match(createClock().today(), /^\d{4}-\d{2}-\d{2}$/);
});
