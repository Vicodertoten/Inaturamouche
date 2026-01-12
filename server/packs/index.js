import europeanMushrooms from "../../shared/data/common_european_mushrooms.json" with { type: "json" };
import europeanTrees from "../../shared/data/common_european_trees.json" with { type: "json" };

/**
 * @typedef {Object} PackDefinition
 * @property {string} id
 * @property {"custom" | "list" | "dynamic"} type
 * @property {string} titleKey
 * @property {string} descriptionKey
 * @property {string[]} [taxa_ids]
 * @property {Record<string, string>} [api_params]
 */

/**
 * @type {PackDefinition[]}
 */
const PACK_DEFINITIONS = [
  {
    id: "custom",
    type: "custom",
    titleKey: "packs.custom.title",
    descriptionKey: "packs.custom.description",
  },
  {
    id: "european_mushrooms",
    type: "list",
    titleKey: "packs.european_mushrooms.title",
    descriptionKey: "packs.european_mushrooms.description",
    taxa_ids: europeanMushrooms.map((item) => item.inaturalist_id),
  },
  {
    id: "european_trees",
    type: "list",
    titleKey: "packs.european_trees.title",
    descriptionKey: "packs.european_trees.description",
    taxa_ids: europeanTrees.map((item) => item.inaturalist_id),
  },
  {
    id: "world_birds",
    type: "dynamic",
    titleKey: "packs.world_birds.title",
    descriptionKey: "packs.world_birds.description",
    api_params: { taxon_id: "3", popular: "true" },
  },
  {
    id: "france_mammals",
    type: "dynamic",
    titleKey: "packs.france_mammals.title",
    descriptionKey: "packs.france_mammals.description",
    api_params: { taxon_id: "40151", place_id: "6753" },
  },
  {
    id: "belgium_herps",
    type: "dynamic",
    titleKey: "packs.belgium_herps.title",
    descriptionKey: "packs.belgium_herps.description",
    api_params: { taxon_id: "26036,20978", place_id: "6911" },
  },
  {
    id: "amazing_insects",
    type: "dynamic",
    titleKey: "packs.amazing_insects.title",
    descriptionKey: "packs.amazing_insects.description",
    api_params: { taxon_id: "47158", popular: "true" },
  },
  {
    id: "mediterranean_flora",
    type: "dynamic",
    titleKey: "packs.mediterranean_flora.title",
    descriptionKey: "packs.mediterranean_flora.description",
    api_params: { taxon_id: "47126", place_id: "53832", popular: "true" },
  },
  {
    id: "great_barrier_reef_life",
    type: "dynamic",
    titleKey: "packs.great_barrier_reef_life.title",
    descriptionKey: "packs.great_barrier_reef_life.description",
    api_params: {
      taxon_id: "1",
      place_id: "131021",
      popular: "true",
    },
  },
];

/**
 * Returns the public pack catalog.
 *
 * @returns {Array<Pick<PackDefinition, "id" | "type" | "titleKey" | "descriptionKey">>}
 */
export function listPublicPacks() {
  return PACK_DEFINITIONS.map(({ id, type, titleKey, descriptionKey }) => ({
    id,
    type,
    titleKey,
    descriptionKey,
  }));
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
