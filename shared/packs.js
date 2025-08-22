// On importe les listes de données statiques
import europeanMushrooms from './data/common_european_mushrooms.json' with { type: 'json' };
import europeanTrees from './data/common_european_trees.json' with { type: 'json' };

const PACKS = [
  {
    id: 'custom',
    type: 'custom', // Un type spécial pour notre filtre avancé
    title: 'Filtre Personnalisé',
    description: 'Créez votre propre quiz en sélectionnant ou excluant des taxons, un lieu et des dates.'
  },
  {
    id: 'european_mushrooms',
    type: 'list', // Ce pack est basé sur une liste d'IDs
    title: 'Champignons commestibles d\'europe',
    description: 'Une sélection des champignons les plus communs en Europe.',
    taxa_ids: europeanMushrooms.map(m => m.inaturalist_id)
  },
  {
    id: 'european_trees',
    type: 'list',
    title: 'Arbres communs d\'europe',
    description: 'Une sélection des arbres les plus communs en Europe.',
    taxa_ids: europeanTrees.map(t => t.inaturalist_id)
  },
  {
    id: 'world_birds',
    type: 'dynamic', // Ce pack sera interprété par le backend
    title: 'Oiseaux du monde',
    description: 'Les 100 espèces d\'oiseaux les plus observées sur iNaturalist.',
    api_params: { taxon_id: '3', popular: 'true' }
  },
  {
    id: 'france_mammals',
    type: 'dynamic',
    title: 'Mammifères de france',
    description: 'Toutes les observations de mammifères en France métropolitaine.',
    api_params: { taxon_id: '40151', place_id: '6753' }
  },
  {
    id: 'belgium_herps',
    type: 'dynamic',
    title: 'Reptiles & amphibiens de Belgique',
    description: 'Découvrez les serpents, lézards, grenouilles et salamandres de Belgique.',
    api_params: { taxon_id: '26036,20978', place_id: '6911' }
  },
  {
    id: 'amazing_insects',
    type: 'dynamic',
    title: 'Insectes du monde',
    description: 'Explorez la diversité incroyable des insectes, des papillons colorés aux scarabées étranges.',
    api_params: { taxon_id: '47158', popular: 'true' }
  },
  {
    id: 'mediterranean_flora',
    type: 'dynamic',
    title: 'Flore méditerranéenne',
    description: 'Les plantes, arbres et fleurs typiques du bassin méditerranéen.',
    api_params: { taxon_id: '47126', place_id: '53832', popular: 'true',}
  },
  {
  id: 'great_barrier_reef_life',
  type: 'dynamic',
  title: 'Vie marine de la grande barrière de corail',
  description: 'Poissons, coraux et mollusques du plus grand récif corallien du monde.',
  api_params: {
    taxon_id: '1',      // ID pour le règne Animalia (Animaux)
    place_id: '131021',  // ID iNaturalist pour le Parc marin de la Grande Barrière de Corail
    popular: 'true',
  }
},
];

export default PACKS;