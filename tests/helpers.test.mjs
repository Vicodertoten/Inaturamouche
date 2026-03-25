import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthDayFilter } from '../server/utils/helpers.js';

test('buildMonthDayFilter includes dates inside a simple interval', () => {
  const filter = buildMonthDayFilter('2000-01-10', '2000-02-20');

  assert.equal(filter.predicate({ month: 1, day: 10 }), true);
  assert.equal(filter.predicate({ month: 2, day: 20 }), true);
  assert.equal(filter.predicate({ month: 2, day: 21 }), false);
  assert.deepEqual(filter.months, [1, 2]);
});

test('buildMonthDayFilter supports intervals that wrap across the new year', () => {
  const filter = buildMonthDayFilter('2000-11-15', '2000-02-15');

  assert.equal(filter.predicate({ month: 11, day: 15 }), true);
  assert.equal(filter.predicate({ month: 12, day: 31 }), true);
  assert.equal(filter.predicate({ month: 1, day: 1 }), true);
  assert.equal(filter.predicate({ month: 2, day: 15 }), true);
  assert.equal(filter.predicate({ month: 3, day: 1 }), false);
  assert.deepEqual(filter.months, [11, 12, 1, 2]);
});

test('buildMonthDayFilter keeps interval bounds inclusive', () => {
  const filter = buildMonthDayFilter('2000-02-29', '2000-03-01');

  assert.equal(filter.predicate({ month: 2, day: 29 }), true);
  assert.equal(filter.predicate({ month: 3, day: 1 }), true);
  assert.equal(filter.predicate({ month: 2, day: 28 }), false);
});
