// On importe les listes de données statiques
import europeanMushrooms from './data/common_european_mushrooms.json' with { type: 'json' };
import europeanTrees from './data/common_european_trees.json' with { type: 'json' };

const PACKS = [
  {
    id: 'custom',
    type: 'custom', // Un type spécial pour notre filtre avancé
    titleKey: 'packs.custom.title',
    descriptionKey: 'packs.custom.description',
  },
  {
    id: 'european_mushrooms',
    type: 'list', // Ce pack est basé sur une liste d'IDs
    titleKey: 'packs.european_mushrooms.title',
    descriptionKey: 'packs.european_mushrooms.description',
    taxa_ids: europeanMushrooms.map(m => m.inaturalist_id)
  },
  {
    id: 'european_trees',
    type: 'list',
    titleKey: 'packs.european_trees.title',
    descriptionKey: 'packs.european_trees.description',
    taxa_ids: europeanTrees.map(t => t.inaturalist_id)
  },
  {
    id: 'world_birds',
    type: 'dynamic', // Ce pack sera interprété par le backend
    titleKey: 'packs.world_birds.title',
    descriptionKey: 'packs.world_birds.description',
    api_params: { taxon_id: '3', popular: 'true' }
  },
  {
    id: 'france_mammals',
    type: 'dynamic',
    titleKey: 'packs.france_mammals.title',
    descriptionKey: 'packs.france_mammals.description',
    api_params: { taxon_id: '40151', place_id: '6753' }
  },
  {
    id: 'belgium_herps',
    type: 'dynamic',
    titleKey: 'packs.belgium_herps.title',
    descriptionKey: 'packs.belgium_herps.description',
    api_params: { taxon_id: '26036,20978', place_id: '6911' }
  },
  {
    id: 'amazing_insects',
    type: 'dynamic',
    titleKey: 'packs.amazing_insects.title',
    descriptionKey: 'packs.amazing_insects.description',
    api_params: { taxon_id: '47158', popular: 'true' }
  },
  {
    id: 'mediterranean_flora',
    type: 'dynamic',
    titleKey: 'packs.mediterranean_flora.title',
    descriptionKey: 'packs.mediterranean_flora.description',
    api_params: { taxon_id: '47126', place_id: '53832', popular: 'true',}
  },
  {
  id: 'great_barrier_reef_life',
  type: 'dynamic',
  titleKey: 'packs.great_barrier_reef_life.title',
  descriptionKey: 'packs.great_barrier_reef_life.description',
  api_params: {
    taxon_id: '1',      // ID pour le règne Animalia (Animaux)
    place_id: '131021',  // ID iNaturalist pour le Parc marin de la Grande Barrière de Corail
    popular: 'true',
  }
},
];

export default PACKS;
