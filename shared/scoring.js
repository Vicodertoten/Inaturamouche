// shared/scoring.js
// Single source of truth for scoring constants across server and client.

/**
 * Points awarded per taxonomic rank in Taxonomic Ascension mode.
 * Kingdom → Species progression: increasing reward for deeper identification.
 */
export const SCORE_PER_RANK = Object.freeze({
  kingdom: 5,
  phylum: 10,
  class: 15,
  order: 20,
  family: 25,
  genus: 30,
  species: 40,
});

/** Base XP for a correct answer in Easy mode. */
export const EASY_BASE_POINTS = 10;

/** Base XP for a correct answer in Riddle mode (harder than easy — no photo). */
export const RIDDLE_BASE_POINTS = 20;

/** Bonus XP per remaining guess in Hard mode. */
export const HARD_GUESS_BONUS = 10;

/** Base XP for a correct answer in Hard mode. */
export const HARD_BASE_POINTS = 30;

/** Number of correct answers needed for species mastery. */
export const MASTERY_THRESHOLD = 3;
