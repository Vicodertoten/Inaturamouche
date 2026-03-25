import { describe, expect, it } from 'vitest';
import {
  buildPeriodApiParams,
  formatPeriodLabel,
  getPeriodTokens,
  hasCompletePeriodRange,
  isPeriodFilterIncomplete,
  normalizeCustomFilters,
  normalizeMonthDayToken,
} from '../utils/periodFilter';

describe('periodFilter', () => {
  it('normalizes legacy ISO dates to month-day tokens', () => {
    expect(normalizeMonthDayToken('2024-01-15')).toBe('01-15');
    expect(normalizeMonthDayToken('2024-02-29')).toBe('02-29');
  });

  it('rejects invalid or incomplete values', () => {
    expect(normalizeMonthDayToken('')).toBe('');
    expect(normalizeMonthDayToken('2024-02-31')).toBe('');
    expect(normalizeMonthDayToken('03-')).toBe('');
  });

  it('converts a complete range to anchored API dates', () => {
    const params = buildPeriodApiParams({
      periodStartMonth: '01',
      periodStartDay: '10',
      periodEndMonth: '02',
      periodEndDay: '20',
    });

    expect(params).toEqual({
      d1: '2000-01-10',
      d2: '2000-02-20',
    });
  });

  it('keeps 29 February as a valid selectable date', () => {
    const filters = {
      periodStartMonth: '02',
      periodStartDay: '29',
      periodEndMonth: '03',
      periodEndDay: '01',
    };

    expect(hasCompletePeriodRange(filters)).toBe(true);
    expect(getPeriodTokens(filters)).toEqual({ d1: '02-29', d2: '03-01' });
  });

  it('marks enabled incomplete filters as invalid', () => {
    expect(
      isPeriodFilterIncomplete({
        period_enabled: true,
        periodStartMonth: '01',
        periodStartDay: '',
        periodEndMonth: '02',
        periodEndDay: '20',
      })
    ).toBe(true);
  });

  it('normalizes legacy custom filters and formats a yearless label', () => {
    const filters = normalizeCustomFilters({
      period_enabled: true,
      d1: '2024-11-15',
      d2: '2024-02-15',
    });

    expect(filters.periodStartMonth).toBe('11');
    expect(filters.periodStartDay).toBe('15');
    expect(filters.periodEndMonth).toBe('02');
    expect(filters.periodEndDay).toBe('15');
    expect(formatPeriodLabel(filters, 'fr')).toContain('15');
  });
});
