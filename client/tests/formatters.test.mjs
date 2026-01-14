import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatNumber } from '../src/utils/formatters.js';

test('formatDate produces expected Intl output for en/fr/nl', () => {
  const d = new Date('2020-03-05T12:00:00Z');
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  for (const locale of ['en', 'fr', 'nl']) {
    const expected = new Intl.DateTimeFormat(locale, opts).format(d);
    const actual = formatDate(d, locale, opts);
    assert.equal(actual, expected);
  }
});

test('formatDate returns placeholder for invalid/empty inputs', () => {
  assert.equal(formatDate(null, 'en'), '—');
  assert.equal(formatDate('invalid-date', 'en'), '—');
});

test('formatNumber produces expected Intl output for en/fr/nl', () => {
  const n = 12345.6;
  for (const locale of ['en', 'fr', 'nl']) {
    const expected = new Intl.NumberFormat(locale).format(n);
    const actual = formatNumber(n, locale);
    assert.equal(actual, expected);
  }
});

test('formatNumber returns placeholder for null/undefined', () => {
  assert.equal(formatNumber(null, 'en'), '—');
  assert.equal(formatNumber(undefined, 'en'), '—');
});