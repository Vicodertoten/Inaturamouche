// client/src/utils/collectionUtils.js

export const ICONIC_TAXA = {
  1: { label: "Animaux", emoji: "🦁" },
  3: { label: "Oiseaux", emoji: "🐦" },
  20978: { label: "Amphibiens", emoji: "🐸" },
  26036: { label: "Reptiles", emoji: "🐍" },
  40151: { label: "Mammifères", emoji: "🦍" },
  47119: { label: "Poissons", emoji: "🐟" },
  47158: { label: "Insectes", emoji: "🦋" },
  47201: { label: "Arachnides", emoji: "🕷️" },
  47115: { label: "Mollusques", emoji: "🐌" },
  47170: { label: "Champignons", emoji: "🍄" },
  47126: { label: "Plantes", emoji: "🌿" },
  48222: { label: "Protozoaires", emoji: "🦠" },
  47686: { label: "Chromistes", emoji: "🔬" },
};

export const groupTaxaByIconic = (pokedex) => {
  if (!pokedex) return [];
  const grouped = {};
  const unknownGroup = {
    ...(ICONIC_TAXA[-1] || { label: "Inconnu", emoji: "❓" }),
    species: [],
  };

  Object.values(pokedex).forEach(species => {
    const iconicTaxonId = species.iconic_taxon_id;

    if (iconicTaxonId && ICONIC_TAXA[iconicTaxonId]) {
      if (!grouped[iconicTaxonId]) {
        grouped[iconicTaxonId] = {
          ...ICONIC_TAXA[iconicTaxonId],
          species: [],
        };
      }
      grouped[iconicTaxonId].species.push(species);
    } else {
      unknownGroup.species.push(species);
    }
  });

  // Sort species within each group alphabetically by common name
  Object.values(grouped).forEach(group => {
    group.species.sort((a, b) => {
      const nameA = a.common_name || a.name || '';
      const nameB = b.common_name || b.name || '';
      return nameA.localeCompare(nameB);
    });
  });
  if (unknownGroup.species.length > 0) {
    unknownGroup.species.sort((a, b) => {
      const nameA = a.common_name || a.name || '';
      const nameB = b.common_name || b.name || '';
      return nameA.localeCompare(nameB);
    });
  }

  const sortedGroups = Object.values(grouped).sort((a, b) => a.label.localeCompare(b.label));

  if (unknownGroup.species.length > 0) {
    return [...sortedGroups, unknownGroup];
  }

  return sortedGroups;
};
