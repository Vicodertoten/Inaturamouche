import { describe, expect, it } from 'vitest';
import {
  buildPackSnapshot,
  encodePackSnapshot,
  decodePackSnapshot,
  snapshotToFilters,
  buildPackShareUrl,
} from '../utils/packShare';

describe('packShare', () => {
  const sampleFilters = {
    taxa_enabled: true,
    includedTaxa: [
      { id: 3, name: 'Aves' },
      { id: 47126, name: 'Insecta' },
    ],
    excludedTaxa: [{ id: 999, name: 'Arachnida' }],
    place_enabled: true,
    geo: { mode: 'place', place_id: '7161', place_name: 'Belgique' },
    period_enabled: true,
    d1: '2024-03-01',
    d2: '2024-06-30',
  };

  describe('buildPackSnapshot', () => {
    it('creates a snapshot with version 1', () => {
      const snap = buildPackSnapshot('Test pack', sampleFilters);
      expect(snap.v).toBe(1);
      expect(snap.n).toBe('Test pack');
      expect(snap.te).toBe(true);
      expect(snap.it).toHaveLength(2);
      expect(snap.et).toHaveLength(1);
      expect(snap.g).toEqual({ m: 'p', p: '7161', pn: 'Belgique' });
      expect(snap.d1).toBe('2024-03-01');
      expect(snap.d2).toBe('2024-06-30');
    });

    it('truncates long names', () => {
      const longName = 'A'.repeat(100);
      const snap = buildPackSnapshot(longName, sampleFilters);
      expect(snap.n.length).toBeLessThanOrEqual(80);
    });

    it('omits disabled filters', () => {
      const snap = buildPackSnapshot('Minimal', {
        taxa_enabled: false,
        includedTaxa: [],
        excludedTaxa: [],
        place_enabled: false,
        geo: { mode: 'place' },
        period_enabled: false,
        d1: '',
        d2: '',
      });
      expect(snap.te).toBeUndefined();
      expect(snap.it).toBeUndefined();
      expect(snap.g).toBeUndefined();
      expect(snap.d1).toBeUndefined();
    });

    it('returns null for null filters', () => {
      expect(buildPackSnapshot('x', null)).toBe(null);
    });
  });

  describe('encode / decode roundtrip', () => {
    it('roundtrips a snapshot correctly', () => {
      const snap = buildPackSnapshot('Roundtrip', sampleFilters);
      const token = encodePackSnapshot(snap);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);

      const decoded = decodePackSnapshot(token);
      expect(decoded).toEqual(snap);
    });

    it('rejects invalid tokens', () => {
      expect(decodePackSnapshot('')).toBe(null);
      expect(decodePackSnapshot('garbage!!!')).toBe(null);
    });
  });

  describe('snapshotToFilters', () => {
    it('rebuilds full filter state from a snapshot', () => {
      const snap = buildPackSnapshot('Full', sampleFilters);
      const filters = snapshotToFilters(snap);

      expect(filters.taxa_enabled).toBe(true);
      expect(filters.includedTaxa).toHaveLength(2);
      expect(filters.includedTaxa[0]).toEqual({ id: 3, name: 'Aves' });
      expect(filters.excludedTaxa).toHaveLength(1);
      expect(filters.place_enabled).toBe(true);
      expect(filters.geo.mode).toBe('place');
      expect(filters.geo.place_id).toBe('7161');
      expect(filters.period_enabled).toBe(true);
      expect(filters.d1).toBe('2024-03-01');
      expect(filters.d2).toBe('2024-06-30');
    });

    it('handles map-mode geo', () => {
      const mapFilters = {
        ...sampleFilters,
        geo: { mode: 'map', nelat: 51.5, nelng: 5.9, swlat: 49.5, swlng: 2.5 },
      };
      const snap = buildPackSnapshot('Map', mapFilters);
      const filters = snapshotToFilters(snap);
      expect(filters.geo.mode).toBe('map');
      expect(filters.geo.nelat).toBe(51.5);
      expect(filters.geo.swlng).toBe(2.5);
    });

    it('returns null for null snapshot', () => {
      expect(snapshotToFilters(null)).toBe(null);
    });
  });

  describe('buildPackShareUrl', () => {
    it('builds correct import URL', () => {
      const url = buildPackShareUrl('token123');
      expect(url).toContain('/pack/import/token123');
    });

    it('returns empty for falsy token', () => {
      expect(buildPackShareUrl(null)).toBe('');
      expect(buildPackShareUrl('')).toBe('');
    });
  });
});
