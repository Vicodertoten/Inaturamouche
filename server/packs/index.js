import europeanMushrooms from "../../shared/data/common_european_mushrooms.json" with { type: "json" };
import europeanTrees from "../../shared/data/common_european_trees.json" with { type: "json" };
import belgianEdiblePlants from "../../shared/data/belgian_edible_plants.json" with { type: "json" };

/**
 * @typedef {Object} PackDefinition
 * @property {string} id
 * @property {"custom" | "list" | "dynamic"} type
 * @property {string} titleKey
 * @property {string} descriptionKey
 * @property {string} [region] - Region tag for geo-based sorting (e.g. "belgium", "europe", "world")
 * @property {string[]} [taxa_ids]
 * @property {Record<string, string>} [api_params]
 */

/**
 * @type {PackDefinition[]}
 */
const normalizeTaxaIds = (items = []) =>
  items
    .map((item) => Number(item?.inaturalist_id))
    .filter((id) => Number.isFinite(id));

const PACK_DEFINITIONS = [
  {
    id: "custom",
    type: "custom",
    titleKey: "packs.custom.title",
    descriptionKey: "packs.custom.description",
  },
  // ── European packs ──
  {
    id: "european_mushrooms",
    type: "list",
    titleKey: "packs.european_mushrooms.title",
    descriptionKey: "packs.european_mushrooms.description",
    region: "europe",
    taxa_ids: normalizeTaxaIds(europeanMushrooms),
  },
  {
    id: "european_trees",
    type: "list",
    titleKey: "packs.european_trees.title",
    descriptionKey: "packs.european_trees.description",
    region: "europe",
    taxa_ids: normalizeTaxaIds(europeanTrees),
  },
  // ── World packs ──
  {
    id: "world_birds",
    type: "dynamic",
    titleKey: "packs.world_birds.title",
    descriptionKey: "packs.world_birds.description",
    region: "world",
    api_params: { taxon_id: "3", popular: "true" },
  },
  // ── France ──
  {
    id: "france_mammals",
    type: "dynamic",
    titleKey: "packs.france_mammals.title",
    descriptionKey: "packs.france_mammals.description",
    region: "france",
    api_params: { taxon_id: "40151", place_id: "6753" },
  },
  // ── Belgium (existing) ──
  {
    id: "belgium_herps",
    type: "dynamic",
    titleKey: "packs.belgium_herps.title",
    descriptionKey: "packs.belgium_herps.description",
    region: "belgium",
    api_params: { taxon_id: "26036,20978", place_id: "7008" },
  },
  // ── World packs ──
  {
    id: "amazing_insects",
    type: "dynamic",
    titleKey: "packs.amazing_insects.title",
    descriptionKey: "packs.amazing_insects.description",
    region: "world",
    api_params: { taxon_id: "47158", popular: "true" },
  },
  {
    id: "mediterranean_flora",
    type: "dynamic",
    titleKey: "packs.mediterranean_flora.title",
    descriptionKey: "packs.mediterranean_flora.description",
    region: "europe",
    api_params: { taxon_id: "47126", place_id: "53832", popular: "true" },
  },
  // ═══════════════════════════════════════════════
  //  BELGIUM PACKS (12 thematic packs)
  //  place_id 7008 = Belgium on iNaturalist
  // ═══════════════════════════════════════════════

  // 1. Butterflies of Belgium
  {
    id: "belgium_butterflies",
    type: "dynamic",
    titleKey: "packs.belgium_butterflies.title",
    descriptionKey: "packs.belgium_butterflies.description",
    region: "belgium",
    api_params: {
      taxon_id: "47224",       // Lepidoptera – butterflies & moths
      place_id: "7008",
      popular: "true",
    },
  },
  // 2. Birds of Belgium
  {
    id: "belgium_birds",
    type: "dynamic",
    titleKey: "packs.belgium_birds.title",
    descriptionKey: "packs.belgium_birds.description",
    region: "belgium",
    api_params: {
      taxon_id: "3",           // Aves
      place_id: "7008",
      popular: "true",
    },
  },
  // 3. Wildflowers of Belgium
  {
    id: "belgium_wildflowers",
    type: "dynamic",
    titleKey: "packs.belgium_wildflowers.title",
    descriptionKey: "packs.belgium_wildflowers.description",
    region: "belgium",
    api_params: {
      taxon_id: "47125",       // Magnoliopsida (flowering plants)
      place_id: "7008",
      popular: "true",
    },
  },
  // 4. Mammals of Belgium
  {
    id: "belgium_mammals",
    type: "dynamic",
    titleKey: "packs.belgium_mammals.title",
    descriptionKey: "packs.belgium_mammals.description",
    region: "belgium",
    api_params: {
      taxon_id: "40151",       // Mammalia
      place_id: "7008",
    },
  },
  // 5. Mushrooms of Belgium
  {
    id: "belgium_mushrooms",
    type: "dynamic",
    titleKey: "packs.belgium_mushrooms.title",
    descriptionKey: "packs.belgium_mushrooms.description",
    region: "belgium",
    api_params: {
      taxon_id: "47170",       // Fungi
      place_id: "7008",
      popular: "true",
    },
  },
  // 6. Trees & Shrubs of Belgium
  {
    id: "belgium_trees",
    type: "dynamic",
    titleKey: "packs.belgium_trees.title",
    descriptionKey: "packs.belgium_trees.description",
    region: "belgium",
    api_params: {
      taxon_id: "47126",       // Plantae
      place_id: "7008",
      popular: "true",
    },
  },
  // 7. Dragonflies & Damselflies of Belgium
  {
    id: "belgium_dragonflies",
    type: "dynamic",
    titleKey: "packs.belgium_dragonflies.title",
    descriptionKey: "packs.belgium_dragonflies.description",
    region: "belgium",
    api_params: {
      taxon_id: "47792",       // Odonata
      place_id: "7008",
    },
  },
  // 8. Spiders of Belgium
  {
    id: "belgium_spiders",
    type: "dynamic",
    titleKey: "packs.belgium_spiders.title",
    descriptionKey: "packs.belgium_spiders.description",
    region: "belgium",
    api_params: {
      taxon_id: "47118",       // Arachnida
      place_id: "7008",
      popular: "true",
    },
  },
  // 9. Freshwater Fish of Belgium
  {
    id: "belgium_fish",
    type: "dynamic",
    titleKey: "packs.belgium_fish.title",
    descriptionKey: "packs.belgium_fish.description",
    region: "belgium",
    api_params: {
      taxon_id: "47178",       // Actinopterygii (ray-finned fish)
      place_id: "7008",
    },
  },
  // 10. Beetles of Belgium
  {
    id: "belgium_beetles",
    type: "dynamic",
    titleKey: "packs.belgium_beetles.title",
    descriptionKey: "packs.belgium_beetles.description",
    region: "belgium",
    api_params: {
      taxon_id: "47208",       // Coleoptera
      place_id: "7008",
      popular: "true",
    },
  },
  // 11. Mosses & Lichens of Belgium
  {
    id: "belgium_mosses_lichens",
    type: "dynamic",
    titleKey: "packs.belgium_mosses_lichens.title",
    descriptionKey: "packs.belgium_mosses_lichens.description",
    region: "belgium",
    api_params: {
      taxon_id: "311249,54743", // Bryophyta (mosses) + Lecanoromycetes (lichens)
      place_id: "7008",
    },
  },
  // 12. Mollusks of Belgium (snails & slugs)
  {
    id: "belgium_mollusks",
    type: "dynamic",
    titleKey: "packs.belgium_mollusks.title",
    descriptionKey: "packs.belgium_mollusks.description",
    region: "belgium",
    api_params: {
      taxon_id: "47115",       // Mollusca
      place_id: "7008",
    },
  },
  // 13. Edible Wild Plants of Belgium (50 species)
  {
    id: "belgium_edible_plants",
    type: "list",
    titleKey: "packs.belgium_edible_plants.title",
    descriptionKey: "packs.belgium_edible_plants.description",
    region: "belgium",
    taxa_ids: normalizeTaxaIds(belgianEdiblePlants),
  },
];

/**
 * Returns the public pack catalog.
 *
 * @returns {Array<Pick<PackDefinition, "id" | "type" | "titleKey" | "descriptionKey">>}
 */
export function listPublicPacks() {
  return PACK_DEFINITIONS.map((pack) => {
    const base = {
      id: pack.id,
      type: pack.type,
      titleKey: pack.titleKey,
      descriptionKey: pack.descriptionKey,
    };

    if (pack.region) {
      base.region = pack.region;
    }

    if (pack.type === 'list' && Array.isArray(pack.taxa_ids)) {
      base.taxa_ids = pack.taxa_ids;
    }
    if (pack.type === 'dynamic' && pack.api_params) {
      base.api_params = pack.api_params;
    }

    return base;
  });
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
