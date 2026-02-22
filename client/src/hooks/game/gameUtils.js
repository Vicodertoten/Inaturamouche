export const DEFAULT_MAX_QUESTIONS = 5;
export const DEFAULT_MEDIA_TYPE = 'images';
export const ACTIVE_GAME_MODES = Object.freeze(['easy', 'hard']);

export const normalizeMaxQuestions = (value, fallback = DEFAULT_MAX_QUESTIONS) => {
  if (value === null || value === -1 || value === 'infinite') return null;
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
};

export const normalizeMediaType = (value, fallback = DEFAULT_MEDIA_TYPE) => {
  if (value === 'images' || value === 'sounds' || value === 'both') return value;
  return fallback;
};

export const normalizeGameMode = (value, fallback = 'easy') => {
  if (ACTIVE_GAME_MODES.includes(value)) {
    return value;
  }
  return fallback;
};

export const hasQuestionLimit = (value) => Number.isInteger(value) && value > 0;

export const resolveTotalQuestions = (maxQuestions, questionCount) =>
  hasQuestionLimit(maxQuestions) ? maxQuestions : questionCount || 0;

export const createSeedSessionId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const getBiomesForQuestion = (question, pack) => {
  if (Array.isArray(question?.biome_tags) && question.biome_tags.length > 0) {
    return question.biome_tags;
  }
  if (Array.isArray(question?.pack_context?.biomes) && question.pack_context.biomes.length > 0) {
    return question.pack_context.biomes;
  }
  if (Array.isArray(pack?.biomes) && pack.biomes.length > 0) {
    return pack.biomes;
  }
  if (pack?.biome) return [pack.biome];
  return [];
};
