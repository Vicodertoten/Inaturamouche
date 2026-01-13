// iNaturalist iconic taxa
// https://github.com/inaturalist/inaturalist/blob/main/app/models/iconic_taxon.rb
export const ICONIC_TAXA = Object.freeze({
    Plantae: { id: 47126, name: 'Plants' },
    Insecta: { id: 47158, name: 'Insects' },
    Aves: { id: 3, name: 'Birds' },
    Fungi: { id: 47119, name: 'Fungi' },
    Mammalia: { id: 40151, name: 'Mammals' },
    Reptilia: { id: 26036, name: 'Reptiles' },
    Amphibia: { id: 20978, name: 'Amphibians' },
    Mollusca: { id: 47178, name: 'Mollusks' },
    Arachnida: { id: 47686, name: 'Arachnids' },
    Animalia: { id: 1, name: 'Other Animals' },
});

export const ICONIC_TAXA_LIST = Object.values(ICONIC_TAXA);
