import { describe, expect, it } from 'vitest';
import { normalizeGameMode } from '../hooks/game/gameUtils';

describe('normalizeGameMode', () => {
  it('keeps active modes', () => {
    expect(normalizeGameMode('easy', 'hard')).toBe('easy');
    expect(normalizeGameMode('hard', 'easy')).toBe('hard');
  });

  it('falls back for archived modes', () => {
    expect(normalizeGameMode('riddle', 'hard')).toBe('hard');
    expect(normalizeGameMode('taxonomic', 'easy')).toBe('easy');
  });

  it('falls back for unknown values', () => {
    expect(normalizeGameMode('expert', 'easy')).toBe('easy');
  });
});
