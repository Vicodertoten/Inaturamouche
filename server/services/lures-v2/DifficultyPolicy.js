// server/services/lures-v2/DifficultyPolicy.js
// Politique de difficulté statique (sans adaptatif runtime)

import { config } from '../../config/index.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const MODE_PRESETS = {
  easy: {
    minCloseness: config.easyLureMinCloseness,
    closeThreshold: 0.9,
    midThreshold: 0.78,
    composition: [
      { bucket: 'close', count: 2 },
      { bucket: 'mid', count: 1 },
    ],
  },
  riddle: {
    minCloseness: Math.max(config.riddleLureMinCloseness, config.easyLureMinCloseness + 0.06, 0.88),
    closeThreshold: 0.94,
    midThreshold: 0.82,
    composition: [{ bucket: 'close', count: 3 }],
  },
};

/**
 * Resolve the difficulty policy for lure selection based on game mode.
 *
 * Returns closeness thresholds and bucket composition that the Selector
 * uses to pick close/mid/far lures. The globalDifficultyBoost env var
 * shifts the minimum closeness up or down.
 *
 * @param {string} gameMode          Game mode ('easy' | 'riddle').
 * @param {object} [options]
 * @param {number} [options.globalDifficultyBoost] Global difficulty shift (-0.5 … +0.8).
 * @param {number} [options.minClosenessOverride]  Hard override for minCloseness.
 * @returns {{ mode: string, minCloseness: number, closeThreshold: number, midThreshold: number, composition: Array<{ bucket: string, count: number }> }}
 */
export function getDifficultyPolicy(gameMode, options = {}) {
  const mode = gameMode === 'riddle' ? 'riddle' : 'easy';
  const preset = MODE_PRESETS[mode];

  const globalBoost = clamp(options.globalDifficultyBoost ?? config.globalDifficultyBoost, -0.5, 0.8);
  const boostFactor = globalBoost >= 0
    ? globalBoost * (1 - preset.minCloseness)
    : globalBoost * preset.minCloseness;

  const minBase = clamp(preset.minCloseness + boostFactor, 0.45, 0.97);
  const minCloseness = options.minClosenessOverride == null
    ? minBase
    : clamp(options.minClosenessOverride, 0, 0.98);

  return {
    mode,
    minCloseness,
    closeThreshold: clamp(preset.closeThreshold, 0.55, 0.99),
    midThreshold: clamp(preset.midThreshold, 0.4, 0.95),
    composition: preset.composition,
  };
}

export default getDifficultyPolicy;
