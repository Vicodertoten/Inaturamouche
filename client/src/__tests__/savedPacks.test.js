import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getSavedPacks,
  savePack,
  deleteSavedPack,
  getSavedPackById,
  packNameExists,
} from '../utils/savedPacks';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('savedPacks', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const sampleFilters = {
    taxa_enabled: true,
    includedTaxa: [{ id: 3, name: 'Aves' }],
    excludedTaxa: [],
    place_enabled: false,
    geo: { mode: 'place' },
    period_enabled: false,
    d1: '',
    d2: '',
  };

  it('returns empty array when no packs saved', () => {
    expect(getSavedPacks()).toEqual([]);
  });

  it('saves a pack and retrieves it', () => {
    const pack = savePack('My birds', sampleFilters);
    expect(pack.id).toBeTruthy();
    expect(pack.name).toBe('My birds');
    expect(pack.filters.taxa_enabled).toBe(true);

    const all = getSavedPacks();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('My birds');
  });

  it('saves multiple packs in order (newest first)', () => {
    savePack('Pack A', sampleFilters);
    savePack('Pack B', sampleFilters);
    const all = getSavedPacks();
    expect(all).toHaveLength(2);
    // Newest first (Pack B was saved last, has higher createdAt)
    expect(all[0].name).toBe('Pack B');
  });

  it('deletes a pack by id', () => {
    const pack = savePack('To delete', sampleFilters);
    expect(getSavedPacks()).toHaveLength(1);
    deleteSavedPack(pack.id);
    expect(getSavedPacks()).toHaveLength(0);
  });

  it('gets a pack by id', () => {
    const pack = savePack('Find me', sampleFilters);
    const found = getSavedPackById(pack.id);
    expect(found).toBeTruthy();
    expect(found.name).toBe('Find me');
  });

  it('returns null for unknown id', () => {
    expect(getSavedPackById('nonexistent')).toBe(null);
  });

  it('detects duplicate names', () => {
    savePack('Oiseaux', sampleFilters);
    expect(packNameExists('Oiseaux')).toBe(true);
    expect(packNameExists('oiseaux')).toBe(true); // case insensitive
    expect(packNameExists('Papillons')).toBe(false);
  });

  it('limits to 20 saved packs', () => {
    for (let i = 0; i < 25; i++) {
      savePack(`Pack ${i}`, sampleFilters);
    }
    expect(getSavedPacks().length).toBeLessThanOrEqual(20);
  });

  it('truncates long pack names', () => {
    const pack = savePack('A'.repeat(100), sampleFilters);
    expect(pack.name.length).toBeLessThanOrEqual(80);
  });
});
