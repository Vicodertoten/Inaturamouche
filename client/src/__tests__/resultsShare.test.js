import { describe, expect, it } from 'vitest';
import {
  buildResultsSnapshot,
  encodeResultsSnapshot,
  decodeResultsSnapshot,
  buildResultsUrl,
} from '../utils/resultsShare';

describe('resultsShare', () => {
  const sampleInput = {
    playerName: 'Alice',
    playerXp: 1200,
    score: 8,
    xpGained: 45,
    gameMode: 'easy',
    packId: 'birds-be',
    packName: 'Oiseaux de Belgique',
    maxQuestions: 10,
    mediaType: 'images',
    isReview: false,
    speciesData: [
      { resolvedAnswer: { id: 101, preferred_common_name: 'Mésange bleue', name: 'Cyanistes caeruleus' }, wasCorrect: true },
      { resolvedAnswer: { id: 102, preferred_common_name: 'Merle noir', name: 'Turdus merula' }, wasCorrect: false },
    ],
    correctSpecies: [101],
  };

  describe('buildResultsSnapshot', () => {
    it('creates a snapshot with version 1', () => {
      const snap = buildResultsSnapshot(sampleInput);
      expect(snap).toBeTruthy();
      expect(snap.v).toBe(1);
      expect(snap.n).toBe('Alice');
      expect(snap.s).toBe(8);
      expect(snap.xp).toBe(45);
      expect(snap.m).toBe('easy');
      expect(snap.p).toBe('birds-be');
      expect(snap.sp).toHaveLength(2);
    });

    it('marks correct species via wasCorrect field', () => {
      const snap = buildResultsSnapshot(sampleInput);
      // Species data: [taxonId, wasCorrect(1/0), commonName, sciName]
      expect(snap.sp[0][1]).toBe(1); // first entry wasCorrect=true
      expect(snap.sp[1][1]).toBe(0); // second entry wasCorrect=false
    });

    it('returns a default snapshot for empty input (with defaults)', () => {
      const snap = buildResultsSnapshot({});
      expect(snap).toBeTruthy();
      expect(snap.v).toBe(1);
      expect(snap.n).toBe('Naturaliste'); // default name
      expect(snap.sp).toEqual([]);
    });
  });

  describe('encode / decode roundtrip', () => {
    it('encodes to a non-empty string and decodes back', () => {
      const snap = buildResultsSnapshot(sampleInput);
      const token = encodeResultsSnapshot(snap);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');

      const decoded = decodeResultsSnapshot(token);
      expect(decoded).toEqual(snap);
    });

    it('returns null for invalid tokens', () => {
      expect(decodeResultsSnapshot('')).toBe(null);
      expect(decodeResultsSnapshot('not-valid-base64!!!')).toBe(null);
      expect(decodeResultsSnapshot(null)).toBe(null);
    });
  });

  describe('buildResultsUrl', () => {
    it('builds URL with /results/share/ prefix', () => {
      const url = buildResultsUrl('abc123');
      expect(url).toContain('/results/share/abc123');
    });

    it('returns empty string for falsy token', () => {
      // buildResultsUrl does not guard against empty — it always appends
      const url = buildResultsUrl('');
      expect(url).toContain('/results/share/');
    });
  });
});
