import europeanMushrooms from '../../shared/data/common_european_mushrooms.json' with { type: 'json' };
import europeanTrees from '../../shared/data/common_european_trees.json' with { type: 'json' };
import belgianEdiblePlants from '../../shared/data/belgian_edible_plants.json' with { type: 'json' };

const KNOWN_REGIONS = new Set(['belgium', 'france', 'europe', 'world']);
const KNOWN_CATEGORIES = new Set(['starter', 'regional', 'world', 'expert', 'custom']);
const KNOWN_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const KNOWN_VISIBILITIES = new Set(['home', 'catalog', 'legacy']);

/**
 * @typedef {Object} PackDefinition
 * @property {string} id
 * @property {"custom" | "list" | "dynamic"} type
 * @property {string} titleKey
 * @property {string} descriptionKey
 * @property {"belgium" | "france" | "europe" | "world"} [region]
 * @property {"starter" | "regional" | "world" | "expert" | "custom"} category
 * @property {"beginner" | "intermediate" | "advanced"} level
 * @property {"home" | "catalog" | "legacy"} visibility
 * @property {number} sortWeight
 * @property {number[]} [taxa_ids]
 * @property {Record<string, string>} [api_params]
 */

const normalizeTaxaIds = (items = []) =>
  items
    .map((item) => Number(item?.inaturalist_id))
    .filter((id) => Number.isFinite(id));

const toInteger = (value, fallback = 9999) => {
  const normalized = Number.parseInt(String(value), 10);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const normalizePackDefinition = (pack) => {
  const normalized = {
    id: String(pack.id),
    type: pack.type,
    titleKey: String(pack.titleKey),
    descriptionKey: String(pack.descriptionKey),
    category: KNOWN_CATEGORIES.has(pack.category) ? pack.category : 'world',
    level: KNOWN_LEVELS.has(pack.level) ? pack.level : 'intermediate',
    visibility: KNOWN_VISIBILITIES.has(pack.visibility) ? pack.visibility : 'catalog',
    sortWeight: toInteger(pack.sortWeight, 9999),
  };

  if (pack.region && KNOWN_REGIONS.has(pack.region)) {
    normalized.region = pack.region;
  }
  if (Array.isArray(pack.taxa_ids)) {
    normalized.taxa_ids = [...pack.taxa_ids];
  }
  if (pack.api_params && typeof pack.api_params === 'object') {
    normalized.api_params = { ...pack.api_params };
  }

  return normalized;
};

/**
 * IDs are immutable and remain backward-compatible with existing clients.
 *
 * @type {PackDefinition[]}
 */
const PACK_DEFINITIONS = [
  {
    id: 'custom',
    type: 'custom',
    titleKey: 'packs.custom.title',
    descriptionKey: 'packs.custom.description',
    category: 'custom',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 0,
  },

  // Home-focused starter set
  {
    id: 'belgium_starter_mix',
    type: 'dynamic',
    titleKey: 'packs.belgium_starter_mix.title',
    descriptionKey: 'packs.belgium_starter_mix.description',
    region: 'belgium',
    category: 'starter',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 10,
    api_params: { taxon_id: '3,40151,47126,47170', place_id: '7008', popular: 'true' },
  },
  {
    id: 'european_trees',
    type: 'list',
    titleKey: 'packs.european_trees.title',
    descriptionKey: 'packs.european_trees.description',
    region: 'europe',
    category: 'starter',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 20,
    taxa_ids: normalizeTaxaIds(europeanTrees),
  },
  {
    id: 'european_mushrooms',
    type: 'list',
    titleKey: 'packs.european_mushrooms.title',
    descriptionKey: 'packs.european_mushrooms.description',
    region: 'europe',
    category: 'starter',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 25,
    taxa_ids: normalizeTaxaIds(europeanMushrooms),
  },
  {
    id: 'world_birds',
    type: 'dynamic',
    titleKey: 'packs.world_birds.title',
    descriptionKey: 'packs.world_birds.description',
    region: 'world',
    category: 'world',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 30,
    api_params: { taxon_id: '3', popular: 'true' },
  },
  {
    id: 'france_mammals',
    type: 'dynamic',
    titleKey: 'packs.france_mammals.title',
    descriptionKey: 'packs.france_mammals.description',
    region: 'france',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 35,
    api_params: { taxon_id: '40151', place_id: '6753' },
  },
  {
    id: 'belgium_birds',
    type: 'dynamic',
    titleKey: 'packs.belgium_birds.title',
    descriptionKey: 'packs.belgium_birds.description',
    region: 'belgium',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 40,
    api_params: { taxon_id: '3', place_id: '7008', popular: 'true' },
  },
  {
    id: 'belgium_wildflowers',
    type: 'dynamic',
    titleKey: 'packs.belgium_wildflowers.title',
    descriptionKey: 'packs.belgium_wildflowers.description',
    region: 'belgium',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 45,
    api_params: { taxon_id: '47125', place_id: '7008', popular: 'true' },
  },
  {
    id: 'belgium_mammals',
    type: 'dynamic',
    titleKey: 'packs.belgium_mammals.title',
    descriptionKey: 'packs.belgium_mammals.description',
    region: 'belgium',
    category: 'regional',
    level: 'intermediate',
    visibility: 'home',
    sortWeight: 50,
    api_params: { taxon_id: '40151', place_id: '7008' },
  },
  {
    id: 'belgium_trees',
    type: 'dynamic',
    titleKey: 'packs.belgium_trees.title',
    descriptionKey: 'packs.belgium_trees.description',
    region: 'belgium',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 55,
    api_params: { taxon_id: '47126', place_id: '7008', popular: 'true' },
  },
  {
    id: 'world_mammals',
    type: 'dynamic',
    titleKey: 'packs.world_mammals.title',
    descriptionKey: 'packs.world_mammals.description',
    region: 'world',
    category: 'world',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 60,
    api_params: { taxon_id: '40151', popular: 'true' },
  },

  // Catalog extensions
  {
    id: 'world_plants',
    type: 'dynamic',
    titleKey: 'packs.world_plants.title',
    descriptionKey: 'packs.world_plants.description',
    region: 'world',
    category: 'world',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 65,
    api_params: { taxon_id: '47126', popular: 'true' },
  },
  {
    id: 'world_fungi',
    type: 'dynamic',
    titleKey: 'packs.world_fungi.title',
    descriptionKey: 'packs.world_fungi.description',
    region: 'world',
    category: 'world',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 70,
    api_params: { taxon_id: '47170', popular: 'true' },
  },
  {
    id: 'belgium_herps',
    type: 'dynamic',
    titleKey: 'packs.belgium_herps.title',
    descriptionKey: 'packs.belgium_herps.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 120,
    api_params: { taxon_id: '26036,20978', place_id: '7008' },
  },
  {
    id: 'amazing_insects',
    type: 'dynamic',
    titleKey: 'packs.amazing_insects.title',
    descriptionKey: 'packs.amazing_insects.description',
    region: 'world',
    category: 'world',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 125,
    api_params: { taxon_id: '47158', popular: 'true' },
  },
  {
    id: 'mediterranean_flora',
    type: 'dynamic',
    titleKey: 'packs.mediterranean_flora.title',
    descriptionKey: 'packs.mediterranean_flora.description',
    region: 'europe',
    category: 'regional',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 130,
    api_params: { taxon_id: '47126', place_id: '53832', popular: 'true' },
  },
  {
    id: 'belgium_butterflies',
    type: 'dynamic',
    titleKey: 'packs.belgium_butterflies.title',
    descriptionKey: 'packs.belgium_butterflies.description',
    region: 'belgium',
    category: 'regional',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 135,
    api_params: { taxon_id: '47224', place_id: '7008', popular: 'true' },
  },
  {
    id: 'belgium_mushrooms',
    type: 'dynamic',
    titleKey: 'packs.belgium_mushrooms.title',
    descriptionKey: 'packs.belgium_mushrooms.description',
    region: 'belgium',
    category: 'regional',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 140,
    api_params: { taxon_id: '47170', place_id: '7008', popular: 'true' },
  },
  {
    id: 'belgium_dragonflies',
    type: 'dynamic',
    titleKey: 'packs.belgium_dragonflies.title',
    descriptionKey: 'packs.belgium_dragonflies.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 145,
    api_params: { taxon_id: '47792', place_id: '7008' },
  },
  {
    id: 'belgium_spiders',
    type: 'dynamic',
    titleKey: 'packs.belgium_spiders.title',
    descriptionKey: 'packs.belgium_spiders.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 150,
    api_params: { taxon_id: '47118', place_id: '7008', popular: 'true' },
  },
  {
    id: 'belgium_fish',
    type: 'dynamic',
    titleKey: 'packs.belgium_fish.title',
    descriptionKey: 'packs.belgium_fish.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 155,
    api_params: { taxon_id: '47178', place_id: '7008' },
  },
  {
    id: 'belgium_beetles',
    type: 'dynamic',
    titleKey: 'packs.belgium_beetles.title',
    descriptionKey: 'packs.belgium_beetles.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 160,
    api_params: { taxon_id: '47208', place_id: '7008', popular: 'true' },
  },
  {
    id: 'belgium_mosses_lichens',
    type: 'dynamic',
    titleKey: 'packs.belgium_mosses_lichens.title',
    descriptionKey: 'packs.belgium_mosses_lichens.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 165,
    api_params: { taxon_id: '311249,54743', place_id: '7008' },
  },
  {
    id: 'belgium_mollusks',
    type: 'dynamic',
    titleKey: 'packs.belgium_mollusks.title',
    descriptionKey: 'packs.belgium_mollusks.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 170,
    api_params: { taxon_id: '47115', place_id: '7008' },
  },
  {
    id: 'belgium_edible_plants',
    type: 'list',
    titleKey: 'packs.belgium_edible_plants.title',
    descriptionKey: 'packs.belgium_edible_plants.description',
    region: 'belgium',
    category: 'regional',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 175,
    taxa_ids: normalizeTaxaIds(belgianEdiblePlants),
  },
].map(normalizePackDefinition);

const clonePackDefinition = (pack) => ({
  ...pack,
  taxa_ids: Array.isArray(pack.taxa_ids) ? [...pack.taxa_ids] : undefined,
  api_params: pack.api_params ? { ...pack.api_params } : undefined,
});

/**
 * Returns all pack definitions, including metadata used by ranking services.
 *
 * @returns {PackDefinition[]}
 */
export function getPackDefinitions() {
  return PACK_DEFINITIONS.map(clonePackDefinition);
}

/**
 * Public catalog endpoint payload. Intentionally enriched (V2 metadata)
 * while keeping backward compatibility on `id` and query behavior.
 *
 * @returns {PackDefinition[]}
 */
export function listPublicPacks() {
  return getPackDefinitions();
}

/**
 * Finds a pack definition by id.
 *
 * @param {string} id
 * @returns {PackDefinition | undefined}
 */
export function findPackById(id) {
  return PACK_DEFINITIONS.find((pack) => pack.id === id);
}
