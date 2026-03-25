import { describe, expect, it } from 'vitest';
import { customFilterReducer, initialCustomFilters } from '../state/filterReducer';

describe('customFilterReducer', () => {
  it('starts with all filters disabled', () => {
    expect(initialCustomFilters.taxa_enabled).toBe(false);
    expect(initialCustomFilters.place_enabled).toBe(false);
    expect(initialCustomFilters.period_enabled).toBe(false);
    expect(initialCustomFilters.includedTaxa).toEqual([]);
    expect(initialCustomFilters.excludedTaxa).toEqual([]);
  });

  it('TOGGLE_TAXA flips taxa_enabled', () => {
    const s1 = customFilterReducer(initialCustomFilters, { type: 'TOGGLE_TAXA' });
    expect(s1.taxa_enabled).toBe(true);
    const s2 = customFilterReducer(s1, { type: 'TOGGLE_TAXA' });
    expect(s2.taxa_enabled).toBe(false);
  });

  it('ADD_INCLUDED_TAXON adds a taxon', () => {
    const state = customFilterReducer(initialCustomFilters, {
      type: 'ADD_INCLUDED_TAXON',
      payload: { id: 3, name: 'Aves' },
    });
    expect(state.includedTaxa).toHaveLength(1);
    expect(state.includedTaxa[0].id).toBe(3);
  });

  it('ADD_INCLUDED_TAXON deduplicates by id', () => {
    let state = customFilterReducer(initialCustomFilters, {
      type: 'ADD_INCLUDED_TAXON',
      payload: { id: 3, name: 'Aves' },
    });
    state = customFilterReducer(state, {
      type: 'ADD_INCLUDED_TAXON',
      payload: { id: 3, name: 'Aves again' },
    });
    expect(state.includedTaxa).toHaveLength(1);
  });

  it('REMOVE_INCLUDED_TAXON removes by id', () => {
    let state = customFilterReducer(initialCustomFilters, {
      type: 'ADD_INCLUDED_TAXON',
      payload: { id: 3, name: 'Aves' },
    });
    state = customFilterReducer(state, {
      type: 'REMOVE_INCLUDED_TAXON',
      payload: 3,
    });
    expect(state.includedTaxa).toHaveLength(0);
  });

  it('TOGGLE_PLACE flips place_enabled', () => {
    const s = customFilterReducer(initialCustomFilters, { type: 'TOGGLE_PLACE' });
    expect(s.place_enabled).toBe(true);
  });

  it('SET_GEO updates geo', () => {
    const s = customFilterReducer(initialCustomFilters, {
      type: 'SET_GEO',
      payload: { mode: 'map', nelat: 51, nelng: 6, swlat: 49, swlng: 2 },
    });
    expect(s.geo.mode).toBe('map');
    expect(s.geo.nelat).toBe(51);
  });

  it('TOGGLE_PERIOD flips period_enabled', () => {
    const s = customFilterReducer(initialCustomFilters, { type: 'TOGGLE_PERIOD' });
    expect(s.period_enabled).toBe(true);
  });

  it('SET_FILTER sets arbitrary field', () => {
    const s = customFilterReducer(initialCustomFilters, {
      type: 'SET_FILTER',
      payload: { name: 'periodStartMonth', value: '01' },
    });
    expect(s.periodStartMonth).toBe('01');
  });

  it('RESTORE normalizes legacy period fields', () => {
    const restored = { ...initialCustomFilters, taxa_enabled: true, d1: '2025-01-01', d2: '2025-02-15' };
    const s = customFilterReducer(initialCustomFilters, {
      type: 'RESTORE',
      payload: restored,
    });
    expect(s.taxa_enabled).toBe(true);
    expect(s.periodStartMonth).toBe('01');
    expect(s.periodStartDay).toBe('01');
    expect(s.periodEndMonth).toBe('02');
    expect(s.periodEndDay).toBe('15');
  });

  it('RESTORE with null keeps current state', () => {
    const s = customFilterReducer(initialCustomFilters, {
      type: 'RESTORE',
      payload: null,
    });
    expect(s).toBe(initialCustomFilters);
  });

  it('unknown action returns current state', () => {
    const s = customFilterReducer(initialCustomFilters, { type: 'UNKNOWN_ACTION' });
    expect(s).toBe(initialCustomFilters);
  });
});
