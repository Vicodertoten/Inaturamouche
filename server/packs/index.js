import europeanMushrooms from '../../shared/data/common_european_mushrooms.json' with { type: 'json' };
import europeanTrees from '../../shared/data/common_european_trees.json' with { type: 'json' };
import belgianEdiblePlants from '../../shared/data/belgian_edible_plants.json' with { type: 'json' };
import belgiumEdibleFlowers from '../../shared/data/belgium_edible_flowers.json' with { type: 'json' };
import europeEdiblePlants from '../../shared/data/europe_edible_plants.json' with { type: 'json' };
import worldEdiblePlantsBasics from '../../shared/data/world_edible_plants_basics.json' with { type: 'json' };
import mediterraneanEdiblePlants from '../../shared/data/mediterranean_edible_plants.json' with { type: 'json' };
import belgiumEdibleMushrooms from '../../shared/data/belgium_edible_mushrooms.json' with { type: 'json' };
import europeEdibleMushrooms from '../../shared/data/europe_edible_mushrooms.json' with { type: 'json' };
import worldEdibleMushroomsBasics from '../../shared/data/world_edible_mushrooms_basics.json' with { type: 'json' };
import belgiumToxicMushrooms from '../../shared/data/belgium_toxic_mushrooms.json' with { type: 'json' };
import europeToxicMushrooms from '../../shared/data/europe_toxic_mushrooms.json' with { type: 'json' };
import worldMedicinalPlants from '../../shared/data/world_medicinal_plants.json' with { type: 'json' };
import europeMedicinalPlants from '../../shared/data/europe_medicinal_plants.json' with { type: 'json' };
import europeInvasivePlants from '../../shared/data/europe_invasive_plants.json' with { type: 'json' };
import europeLookalikes from '../../shared/data/europe_lookalikes_edible_vs_toxic_mushrooms.json' with { type: 'json' };
import { PLACES, toPlaceId } from './places.js';
import { TAXA, TAXON_SETS, csvTaxonIds } from './taxa.js';
import { PACK_TAGS, normalizePackTags } from './tags.js';

const KNOWN_REGIONS = new Set(['belgium', 'france', 'europe', 'world']);
const KNOWN_CATEGORIES = new Set([
  'starter',
  'regional',
  'world',
  'threatened',
  'curated',
  'fun',
  'expert',
  'custom',
]);
const KNOWN_LEVELS = new Set(['beginner', 'intermediate', 'advanced']);
const KNOWN_VISIBILITIES = new Set(['home', 'catalog', 'legacy']);

function parseBooleanEnv(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

const PACKS_V3_ENABLED = parseBooleanEnv(process.env.PACKS_V3_ENABLED, true);

/**
 * @typedef {Object} PackDefinition
 * @property {string} id
 * @property {'custom' | 'list' | 'dynamic'} type
 * @property {string} titleKey
 * @property {string} descriptionKey
 * @property {'belgium' | 'france' | 'europe' | 'world'} [region]
 * @property {'starter' | 'regional' | 'world' | 'threatened' | 'curated' | 'fun' | 'expert' | 'custom'} category
 * @property {'beginner' | 'intermediate' | 'advanced'} level
 * @property {'home' | 'catalog' | 'legacy'} visibility
 * @property {number} sortWeight
 * @property {number[]} [taxa_ids]
 * @property {Record<string, string>} [api_params]
 * @property {string} [theme]
 * @property {string[]} [tags]
 * @property {number} [healthMinTaxa]
 */

const normalizeTaxaIds = (items = []) =>
  items
    .map((item) => Number(item?.inaturalist_id))
    .filter((id) => Number.isFinite(id) && id > 0);

const toInteger = (value, fallback = 9999) => {
  const normalized = Number.parseInt(String(value), 10);
  return Number.isFinite(normalized) ? normalized : fallback;
};

function buildDynamicParams({
  taxa,
  placeId,
  popular,
  threatened,
  sounds,
  month,
} = {}) {
  const params = {};

  const taxonIds = Array.isArray(taxa) ? taxa : [taxa];
  const taxonCsv = csvTaxonIds(taxonIds);
  if (taxonCsv) params.taxon_id = taxonCsv;

  const place = toPlaceId(placeId);
  if (place) params.place_id = place;

  if (popular === true) params.popular = 'true';
  if (threatened === true) params.threatened = 'true';
  if (sounds === true) params.sounds = 'true';

  if (Array.isArray(month) && month.length > 0) {
    const monthCsv = month
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item >= 1 && item <= 12)
      .join(',');
    if (monthCsv) params.month = monthCsv;
  }

  return params;
}

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
  if (typeof pack.theme === 'string' && pack.theme.trim()) {
    normalized.theme = pack.theme.trim();
  }

  const tags = normalizePackTags(pack.tags);
  if (tags) {
    normalized.tags = tags;
  }

  const healthMinTaxa = toInteger(pack.healthMinTaxa, 0);
  if (healthMinTaxa > 0) {
    normalized.healthMinTaxa = healthMinTaxa;
  }

  return normalized;
};

const listTaxaIds = (dataset) => normalizeTaxaIds(dataset);

const PACK_CUSTOM = {
  id: 'custom',
  type: 'custom',
  titleKey: 'packs.custom.title',
  descriptionKey: 'packs.custom.description',
  category: 'custom',
  level: 'beginner',
  visibility: 'home',
  sortWeight: 0,
  theme: 'custom',
};

// A + B + C + creative = 44 active packs
const ACTIVE_V3_PACKS = [
  // A. Discovery dynamics (14)
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
    theme: 'mixed',
    api_params: buildDynamicParams({ taxa: TAXON_SETS.STARTER_BELGIUM, placeId: PLACES.BELGIUM, popular: true }),
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
    sortWeight: 20,
    theme: 'birds',
    api_params: buildDynamicParams({ taxa: TAXA.BIRDS, popular: true }),
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
    sortWeight: 30,
    theme: 'mammals',
    api_params: buildDynamicParams({ taxa: TAXA.MAMMALS, popular: true }),
  },
  {
    id: 'world_plants',
    type: 'dynamic',
    titleKey: 'packs.world_plants.title',
    descriptionKey: 'packs.world_plants.description',
    region: 'world',
    category: 'world',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 40,
    theme: 'plants',
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, popular: true }),
  },
  {
    id: 'world_fungi',
    type: 'dynamic',
    titleKey: 'packs.world_fungi.title',
    descriptionKey: 'packs.world_fungi.description',
    region: 'world',
    category: 'world',
    level: 'intermediate',
    visibility: 'home',
    sortWeight: 50,
    theme: 'fungi',
    api_params: buildDynamicParams({ taxa: TAXA.FUNGI, popular: true }),
  },
  {
    id: 'amazing_insects',
    type: 'dynamic',
    titleKey: 'packs.amazing_insects.title',
    descriptionKey: 'packs.amazing_insects.description',
    region: 'world',
    category: 'world',
    level: 'intermediate',
    visibility: 'home',
    sortWeight: 60,
    theme: 'insects',
    api_params: buildDynamicParams({ taxa: TAXA.INSECTS, popular: true }),
  },
  {
    id: 'world_herps',
    type: 'dynamic',
    titleKey: 'packs.world_herps.title',
    descriptionKey: 'packs.world_herps.description',
    region: 'world',
    category: 'world',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 65,
    theme: 'herps',
    api_params: buildDynamicParams({ taxa: TAXON_SETS.HERPS, popular: true }),
  },
  {
    id: 'world_fish',
    type: 'dynamic',
    titleKey: 'packs.world_fish.title',
    descriptionKey: 'packs.world_fish.description',
    region: 'world',
    category: 'world',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 68,
    theme: 'fish',
    api_params: buildDynamicParams({ taxa: TAXA.FISH, popular: true }),
  },
  {
    id: 'europe_birds',
    type: 'dynamic',
    titleKey: 'packs.europe_birds.title',
    descriptionKey: 'packs.europe_birds.description',
    region: 'europe',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 70,
    theme: 'birds',
    api_params: buildDynamicParams({ taxa: TAXA.BIRDS, placeId: PLACES.EUROPE, popular: true }),
  },
  {
    id: 'europe_mammals',
    type: 'dynamic',
    titleKey: 'packs.europe_mammals.title',
    descriptionKey: 'packs.europe_mammals.description',
    region: 'europe',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 80,
    theme: 'mammals',
    api_params: buildDynamicParams({ taxa: TAXA.MAMMALS, placeId: PLACES.EUROPE, popular: true }),
  },
  {
    id: 'europe_plants',
    type: 'dynamic',
    titleKey: 'packs.europe_plants.title',
    descriptionKey: 'packs.europe_plants.description',
    region: 'europe',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 90,
    theme: 'plants',
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, placeId: PLACES.EUROPE, popular: true }),
  },
  {
    id: 'europe_fungi',
    type: 'dynamic',
    titleKey: 'packs.europe_fungi.title',
    descriptionKey: 'packs.europe_fungi.description',
    region: 'europe',
    category: 'regional',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 94,
    theme: 'fungi',
    api_params: buildDynamicParams({ taxa: TAXA.FUNGI, placeId: PLACES.EUROPE, popular: true }),
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
    sortWeight: 96,
    theme: 'birds',
    api_params: buildDynamicParams({ taxa: TAXA.BIRDS, placeId: PLACES.BELGIUM, popular: true }),
  },
  {
    id: 'belgium_plants',
    type: 'dynamic',
    titleKey: 'packs.belgium_plants.title',
    descriptionKey: 'packs.belgium_plants.description',
    region: 'belgium',
    category: 'regional',
    level: 'beginner',
    visibility: 'home',
    sortWeight: 98,
    theme: 'plants',
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, placeId: PLACES.BELGIUM, popular: true }),
  },

  // B. Threatened dynamics (12)
  {
    id: 'world_threatened_birds',
    type: 'dynamic',
    titleKey: 'packs.world_threatened_birds.title',
    descriptionKey: 'packs.world_threatened_birds.description',
    region: 'world',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 100,
    theme: 'birds',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.BIRDS, threatened: true }),
  },
  {
    id: 'world_threatened_mammals',
    type: 'dynamic',
    titleKey: 'packs.world_threatened_mammals.title',
    descriptionKey: 'packs.world_threatened_mammals.description',
    region: 'world',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 108,
    theme: 'mammals',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.MAMMALS, threatened: true }),
  },
  {
    id: 'world_threatened_insects',
    type: 'dynamic',
    titleKey: 'packs.world_threatened_insects.title',
    descriptionKey: 'packs.world_threatened_insects.description',
    region: 'world',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 116,
    theme: 'insects',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.INSECTS, threatened: true }),
  },
  {
    id: 'world_threatened_plants',
    type: 'dynamic',
    titleKey: 'packs.world_threatened_plants.title',
    descriptionKey: 'packs.world_threatened_plants.description',
    region: 'world',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 124,
    theme: 'plants',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, threatened: true }),
  },
  {
    id: 'world_threatened_fish',
    type: 'dynamic',
    titleKey: 'packs.world_threatened_fish.title',
    descriptionKey: 'packs.world_threatened_fish.description',
    region: 'world',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 132,
    theme: 'fish',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.FISH, threatened: true }),
  },
  {
    id: 'world_threatened_herps',
    type: 'dynamic',
    titleKey: 'packs.world_threatened_herps.title',
    descriptionKey: 'packs.world_threatened_herps.description',
    region: 'world',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 140,
    theme: 'herps',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXON_SETS.HERPS, threatened: true }),
  },
  {
    id: 'europe_threatened_birds',
    type: 'dynamic',
    titleKey: 'packs.europe_threatened_birds.title',
    descriptionKey: 'packs.europe_threatened_birds.description',
    region: 'europe',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 146,
    theme: 'birds',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.BIRDS, placeId: PLACES.EUROPE, threatened: true }),
  },
  {
    id: 'europe_threatened_mammals',
    type: 'dynamic',
    titleKey: 'packs.europe_threatened_mammals.title',
    descriptionKey: 'packs.europe_threatened_mammals.description',
    region: 'europe',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 150,
    theme: 'mammals',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.MAMMALS, placeId: PLACES.EUROPE, threatened: true }),
  },
  {
    id: 'europe_threatened_insects',
    type: 'dynamic',
    titleKey: 'packs.europe_threatened_insects.title',
    descriptionKey: 'packs.europe_threatened_insects.description',
    region: 'europe',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 154,
    theme: 'insects',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.INSECTS, placeId: PLACES.EUROPE, threatened: true }),
  },
  {
    id: 'europe_threatened_plants',
    type: 'dynamic',
    titleKey: 'packs.europe_threatened_plants.title',
    descriptionKey: 'packs.europe_threatened_plants.description',
    region: 'europe',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 158,
    theme: 'plants',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, placeId: PLACES.EUROPE, threatened: true }),
  },
  {
    id: 'belgium_threatened_birds',
    type: 'dynamic',
    titleKey: 'packs.belgium_threatened_birds.title',
    descriptionKey: 'packs.belgium_threatened_birds.description',
    region: 'belgium',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 162,
    theme: 'birds',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.BIRDS, placeId: PLACES.BELGIUM, threatened: true }),
  },
  {
    id: 'belgium_threatened_mammals',
    type: 'dynamic',
    titleKey: 'packs.belgium_threatened_mammals.title',
    descriptionKey: 'packs.belgium_threatened_mammals.description',
    region: 'belgium',
    category: 'threatened',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 166,
    theme: 'mammals',
    tags: [PACK_TAGS.THREATENED],
    api_params: buildDynamicParams({ taxa: TAXA.MAMMALS, placeId: PLACES.BELGIUM, threatened: true }),
  },

  // C. Curated lists (14)
  {
    id: 'belgium_edible_plants',
    type: 'list',
    titleKey: 'packs.belgium_edible_plants.title',
    descriptionKey: 'packs.belgium_edible_plants.description',
    region: 'belgium',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 190,
    theme: 'plants',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 60,
    taxa_ids: listTaxaIds(belgianEdiblePlants),
  },
  {
    id: 'belgium_edible_flowers',
    type: 'list',
    titleKey: 'packs.belgium_edible_flowers.title',
    descriptionKey: 'packs.belgium_edible_flowers.description',
    region: 'belgium',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 198,
    theme: 'plants',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 20,
    taxa_ids: listTaxaIds(belgiumEdibleFlowers),
  },
  {
    id: 'europe_edible_plants',
    type: 'list',
    titleKey: 'packs.europe_edible_plants.title',
    descriptionKey: 'packs.europe_edible_plants.description',
    region: 'europe',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 206,
    theme: 'plants',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 60,
    taxa_ids: listTaxaIds(europeEdiblePlants),
  },
  {
    id: 'world_edible_plants_basics',
    type: 'list',
    titleKey: 'packs.world_edible_plants_basics.title',
    descriptionKey: 'packs.world_edible_plants_basics.description',
    region: 'world',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 214,
    theme: 'plants',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 50,
    taxa_ids: listTaxaIds(worldEdiblePlantsBasics),
  },
  {
    id: 'mediterranean_edible_plants',
    type: 'list',
    titleKey: 'packs.mediterranean_edible_plants.title',
    descriptionKey: 'packs.mediterranean_edible_plants.description',
    region: 'europe',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 222,
    theme: 'plants',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 20,
    taxa_ids: listTaxaIds(mediterraneanEdiblePlants),
  },
  {
    id: 'belgium_edible_mushrooms',
    type: 'list',
    titleKey: 'packs.belgium_edible_mushrooms.title',
    descriptionKey: 'packs.belgium_edible_mushrooms.description',
    region: 'belgium',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 230,
    theme: 'fungi',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 30,
    taxa_ids: listTaxaIds(belgiumEdibleMushrooms),
  },
  {
    id: 'europe_edible_mushrooms',
    type: 'list',
    titleKey: 'packs.europe_edible_mushrooms.title',
    descriptionKey: 'packs.europe_edible_mushrooms.description',
    region: 'europe',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 238,
    theme: 'fungi',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 35,
    taxa_ids: listTaxaIds(europeEdibleMushrooms),
  },
  {
    id: 'world_edible_mushrooms_basics',
    type: 'list',
    titleKey: 'packs.world_edible_mushrooms_basics.title',
    descriptionKey: 'packs.world_edible_mushrooms_basics.description',
    region: 'world',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 246,
    theme: 'fungi',
    tags: [PACK_TAGS.EDIBLE],
    healthMinTaxa: 20,
    taxa_ids: listTaxaIds(worldEdibleMushroomsBasics),
  },
  {
    id: 'belgium_toxic_mushrooms',
    type: 'list',
    titleKey: 'packs.belgium_toxic_mushrooms.title',
    descriptionKey: 'packs.belgium_toxic_mushrooms.description',
    region: 'belgium',
    category: 'curated',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 254,
    theme: 'fungi',
    tags: [PACK_TAGS.TOXIC],
    healthMinTaxa: 12,
    taxa_ids: listTaxaIds(belgiumToxicMushrooms),
  },
  {
    id: 'europe_toxic_mushrooms',
    type: 'list',
    titleKey: 'packs.europe_toxic_mushrooms.title',
    descriptionKey: 'packs.europe_toxic_mushrooms.description',
    region: 'europe',
    category: 'curated',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 262,
    theme: 'fungi',
    tags: [PACK_TAGS.TOXIC],
    healthMinTaxa: 15,
    taxa_ids: listTaxaIds(europeToxicMushrooms),
  },
  {
    id: 'world_medicinal_plants',
    type: 'list',
    titleKey: 'packs.world_medicinal_plants.title',
    descriptionKey: 'packs.world_medicinal_plants.description',
    region: 'world',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 270,
    theme: 'plants',
    tags: [PACK_TAGS.MEDICINAL],
    healthMinTaxa: 30,
    taxa_ids: listTaxaIds(worldMedicinalPlants),
  },
  {
    id: 'europe_medicinal_plants',
    type: 'list',
    titleKey: 'packs.europe_medicinal_plants.title',
    descriptionKey: 'packs.europe_medicinal_plants.description',
    region: 'europe',
    category: 'curated',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 272,
    theme: 'plants',
    tags: [PACK_TAGS.MEDICINAL],
    healthMinTaxa: 25,
    taxa_ids: listTaxaIds(europeMedicinalPlants),
  },
  {
    id: 'europe_invasive_plants',
    type: 'list',
    titleKey: 'packs.europe_invasive_plants.title',
    descriptionKey: 'packs.europe_invasive_plants.description',
    region: 'europe',
    category: 'curated',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 276,
    theme: 'plants',
    tags: [PACK_TAGS.INVASIVE],
    healthMinTaxa: 12,
    taxa_ids: listTaxaIds(europeInvasivePlants),
  },
  {
    id: 'europe_lookalikes_edible_vs_toxic_mushrooms',
    type: 'list',
    titleKey: 'packs.europe_lookalikes_edible_vs_toxic_mushrooms.title',
    descriptionKey: 'packs.europe_lookalikes_edible_vs_toxic_mushrooms.description',
    region: 'europe',
    category: 'curated',
    level: 'advanced',
    visibility: 'catalog',
    sortWeight: 278,
    theme: 'fungi',
    tags: [PACK_TAGS.LOOKALIKE, PACK_TAGS.EDIBLE, PACK_TAGS.TOXIC],
    healthMinTaxa: 15,
    taxa_ids: listTaxaIds(europeLookalikes),
  },

  // Creative/fun (4)
  {
    id: 'europe_dragons_and_monsters',
    type: 'dynamic',
    titleKey: 'packs.europe_dragons_and_monsters.title',
    descriptionKey: 'packs.europe_dragons_and_monsters.description',
    region: 'europe',
    category: 'fun',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 282,
    theme: 'mythic',
    tags: [PACK_TAGS.FUN],
    api_params: buildDynamicParams({ taxa: [TAXA.DRAGONFLIES, ...TAXON_SETS.HERPS], placeId: PLACES.EUROPE, popular: true }),
  },
  {
    id: 'world_weird_invertebrates',
    type: 'dynamic',
    titleKey: 'packs.world_weird_invertebrates.title',
    descriptionKey: 'packs.world_weird_invertebrates.description',
    region: 'world',
    category: 'fun',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 290,
    theme: 'invertebrates',
    tags: [PACK_TAGS.FUN],
    api_params: buildDynamicParams({ taxa: TAXON_SETS.WEIRD_INVERTEBRATES, popular: true }),
  },
  {
    id: 'europe_autumn_colors',
    type: 'dynamic',
    titleKey: 'packs.europe_autumn_colors.title',
    descriptionKey: 'packs.europe_autumn_colors.description',
    region: 'europe',
    category: 'fun',
    level: 'beginner',
    visibility: 'catalog',
    sortWeight: 298,
    theme: 'plants',
    tags: [PACK_TAGS.FUN, PACK_TAGS.SEASONAL],
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, placeId: PLACES.EUROPE, month: [9, 10, 11], popular: true }),
  },
  {
    id: 'world_night_choir',
    type: 'dynamic',
    titleKey: 'packs.world_night_choir.title',
    descriptionKey: 'packs.world_night_choir.description',
    region: 'world',
    category: 'fun',
    level: 'intermediate',
    visibility: 'catalog',
    sortWeight: 306,
    theme: 'sounds',
    tags: [PACK_TAGS.FUN],
    api_params: buildDynamicParams({ taxa: [TAXA.BIRDS, TAXA.HERPS_AMPHIBIANS], sounds: true, popular: true }),
  },
];

// Compatibility-safe legacy packs: preserved IDs, hidden from strategic rails.
const LEGACY_PACKS = [
  {
    id: 'european_trees',
    type: 'list',
    titleKey: 'packs.european_trees.title',
    descriptionKey: 'packs.european_trees.description',
    region: 'europe',
    category: 'starter',
    level: 'beginner',
    visibility: 'legacy',
    sortWeight: 910,
    theme: 'trees',
    taxa_ids: listTaxaIds(europeanTrees),
  },
  {
    id: 'european_mushrooms',
    type: 'list',
    titleKey: 'packs.european_mushrooms.title',
    descriptionKey: 'packs.european_mushrooms.description',
    region: 'europe',
    category: 'starter',
    level: 'beginner',
    visibility: 'legacy',
    sortWeight: 911,
    theme: 'fungi',
    tags: [PACK_TAGS.EDIBLE],
    taxa_ids: listTaxaIds(europeanMushrooms),
  },
  {
    id: 'france_mammals',
    type: 'dynamic',
    titleKey: 'packs.france_mammals.title',
    descriptionKey: 'packs.france_mammals.description',
    region: 'france',
    category: 'regional',
    level: 'beginner',
    visibility: 'legacy',
    sortWeight: 912,
    theme: 'mammals',
    api_params: buildDynamicParams({ taxa: TAXA.MAMMALS, placeId: PLACES.FRANCE }),
  },
  {
    id: 'belgium_wildflowers',
    type: 'dynamic',
    titleKey: 'packs.belgium_wildflowers.title',
    descriptionKey: 'packs.belgium_wildflowers.description',
    region: 'belgium',
    category: 'regional',
    level: 'beginner',
    visibility: 'legacy',
    sortWeight: 913,
    theme: 'plants',
    api_params: buildDynamicParams({ taxa: TAXA.FLOWERING_PLANTS, placeId: PLACES.BELGIUM, popular: true }),
  },
  {
    id: 'belgium_mammals',
    type: 'dynamic',
    titleKey: 'packs.belgium_mammals.title',
    descriptionKey: 'packs.belgium_mammals.description',
    region: 'belgium',
    category: 'regional',
    level: 'intermediate',
    visibility: 'legacy',
    sortWeight: 914,
    theme: 'mammals',
    api_params: buildDynamicParams({ taxa: TAXA.MAMMALS, placeId: PLACES.BELGIUM }),
  },
  {
    id: 'belgium_trees',
    type: 'dynamic',
    titleKey: 'packs.belgium_trees.title',
    descriptionKey: 'packs.belgium_trees.description',
    region: 'belgium',
    category: 'regional',
    level: 'beginner',
    visibility: 'legacy',
    sortWeight: 915,
    theme: 'plants',
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, placeId: PLACES.BELGIUM, popular: true }),
  },
  {
    id: 'belgium_herps',
    type: 'dynamic',
    titleKey: 'packs.belgium_herps.title',
    descriptionKey: 'packs.belgium_herps.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'legacy',
    sortWeight: 916,
    theme: 'herps',
    api_params: buildDynamicParams({ taxa: TAXON_SETS.HERPS, placeId: PLACES.BELGIUM }),
  },
  {
    id: 'mediterranean_flora',
    type: 'dynamic',
    titleKey: 'packs.mediterranean_flora.title',
    descriptionKey: 'packs.mediterranean_flora.description',
    region: 'europe',
    category: 'regional',
    level: 'intermediate',
    visibility: 'legacy',
    sortWeight: 917,
    theme: 'plants',
    api_params: buildDynamicParams({ taxa: TAXA.PLANTS, placeId: PLACES.MEDITERRANEAN_BASIN, popular: true }),
  },
  {
    id: 'belgium_butterflies',
    type: 'dynamic',
    titleKey: 'packs.belgium_butterflies.title',
    descriptionKey: 'packs.belgium_butterflies.description',
    region: 'belgium',
    category: 'regional',
    level: 'intermediate',
    visibility: 'legacy',
    sortWeight: 918,
    theme: 'insects',
    api_params: buildDynamicParams({ taxa: TAXA.BUTTERFLIES, placeId: PLACES.BELGIUM, popular: true }),
  },
  {
    id: 'belgium_mushrooms',
    type: 'dynamic',
    titleKey: 'packs.belgium_mushrooms.title',
    descriptionKey: 'packs.belgium_mushrooms.description',
    region: 'belgium',
    category: 'regional',
    level: 'intermediate',
    visibility: 'legacy',
    sortWeight: 919,
    theme: 'fungi',
    api_params: buildDynamicParams({ taxa: TAXA.FUNGI, placeId: PLACES.BELGIUM, popular: true }),
  },
  {
    id: 'belgium_dragonflies',
    type: 'dynamic',
    titleKey: 'packs.belgium_dragonflies.title',
    descriptionKey: 'packs.belgium_dragonflies.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'legacy',
    sortWeight: 920,
    theme: 'insects',
    api_params: buildDynamicParams({ taxa: TAXA.DRAGONFLIES, placeId: PLACES.BELGIUM }),
  },
  {
    id: 'belgium_spiders',
    type: 'dynamic',
    titleKey: 'packs.belgium_spiders.title',
    descriptionKey: 'packs.belgium_spiders.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'legacy',
    sortWeight: 921,
    theme: 'invertebrates',
    api_params: buildDynamicParams({ taxa: TAXA.SPIDERS, placeId: PLACES.BELGIUM, popular: true }),
  },
  {
    id: 'belgium_fish',
    type: 'dynamic',
    titleKey: 'packs.belgium_fish.title',
    descriptionKey: 'packs.belgium_fish.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'legacy',
    sortWeight: 922,
    theme: 'fish',
    api_params: buildDynamicParams({ taxa: TAXA.FISH, placeId: PLACES.BELGIUM }),
  },
  {
    id: 'belgium_beetles',
    type: 'dynamic',
    titleKey: 'packs.belgium_beetles.title',
    descriptionKey: 'packs.belgium_beetles.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'legacy',
    sortWeight: 923,
    theme: 'insects',
    api_params: buildDynamicParams({ taxa: TAXA.BEETLES, placeId: PLACES.BELGIUM, popular: true }),
  },
  {
    id: 'belgium_mosses_lichens',
    type: 'dynamic',
    titleKey: 'packs.belgium_mosses_lichens.title',
    descriptionKey: 'packs.belgium_mosses_lichens.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'legacy',
    sortWeight: 924,
    theme: 'plants',
    api_params: buildDynamicParams({ taxa: TAXON_SETS.MOSSES_LICHENS, placeId: PLACES.BELGIUM }),
  },
  {
    id: 'belgium_mollusks',
    type: 'dynamic',
    titleKey: 'packs.belgium_mollusks.title',
    descriptionKey: 'packs.belgium_mollusks.description',
    region: 'belgium',
    category: 'expert',
    level: 'advanced',
    visibility: 'legacy',
    sortWeight: 925,
    theme: 'invertebrates',
    api_params: buildDynamicParams({ taxa: TAXA.MOLLUSKS, placeId: PLACES.BELGIUM }),
  },
];

const PACK_DEFINITIONS = [PACK_CUSTOM, ...ACTIVE_V3_PACKS, ...LEGACY_PACKS].map(normalizePackDefinition);

const ROLLBACK_VISIBILITY_BY_ID = Object.freeze({
  belgium_starter_mix: 'home',
  world_birds: 'home',
  world_mammals: 'home',
  world_plants: 'home',
  world_fungi: 'home',
  amazing_insects: 'home',
  european_trees: 'home',
  european_mushrooms: 'home',
  france_mammals: 'home',
  europe_birds: 'home',
  europe_mammals: 'home',
  europe_plants: 'home',
  belgium_birds: 'home',
  belgium_plants: 'home',
  belgium_wildflowers: 'home',
  belgium_mammals: 'home',
  belgium_trees: 'home',
  world_herps: 'catalog',
  world_fish: 'catalog',
  europe_fungi: 'catalog',
  belgium_herps: 'catalog',
  mediterranean_flora: 'catalog',
  belgium_butterflies: 'catalog',
  belgium_mushrooms: 'catalog',
  belgium_dragonflies: 'catalog',
  belgium_spiders: 'catalog',
  belgium_fish: 'catalog',
  belgium_beetles: 'catalog',
  belgium_mosses_lichens: 'catalog',
  belgium_mollusks: 'catalog',
});

function toLegacyRollbackVisibility(pack) {
  if (pack.id === PACK_CUSTOM.id) {
    return pack;
  }
  const override = ROLLBACK_VISIBILITY_BY_ID[pack.id];
  if (!override) {
    return { ...pack, visibility: 'legacy' };
  }
  return { ...pack, visibility: override };
}

const PUBLIC_PACK_DEFINITIONS = PACKS_V3_ENABLED
  ? PACK_DEFINITIONS
  : PACK_DEFINITIONS.map(toLegacyRollbackVisibility);

const duplicateIds = (() => {
  const seen = new Set();
  const duplicates = new Set();
  for (const pack of PACK_DEFINITIONS) {
    if (seen.has(pack.id)) duplicates.add(pack.id);
    seen.add(pack.id);
  }
  return [...duplicates];
})();

if (duplicateIds.length > 0) {
  throw new Error(`Duplicate pack IDs detected: ${duplicateIds.join(', ')}`);
}

const clonePackDefinition = (pack) => ({
  ...pack,
  taxa_ids: Array.isArray(pack.taxa_ids) ? [...pack.taxa_ids] : undefined,
  tags: Array.isArray(pack.tags) ? [...pack.tags] : undefined,
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
 * Public catalog endpoint payload. Intentionally enriched while keeping backward compatibility.
 *
 * @returns {PackDefinition[]}
 */
export function listPublicPacks() {
  return PUBLIC_PACK_DEFINITIONS.map(clonePackDefinition);
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

export function isPacksV3Enabled() {
  return PACKS_V3_ENABLED;
}
