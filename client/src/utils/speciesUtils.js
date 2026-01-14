export const resolveImageUrls = (taxon = {}, thumbnailHint) => {
  const defaultPhoto = taxon.default_photo || {};
  const fallbackPhotoUrl = defaultPhoto.square_url || defaultPhoto.url || null;
  const square_url =
    taxon.square_url || defaultPhoto.square_url || fallbackPhotoUrl || thumbnailHint || null;
  const small_url =
    taxon.small_url || defaultPhoto.small_url || fallbackPhotoUrl || square_url || null;
  const medium_url =
    taxon.medium_url || defaultPhoto.medium_url || fallbackPhotoUrl || small_url || null;
  const thumbnail =
    thumbnailHint || taxon.thumbnail || fallbackPhotoUrl || medium_url || small_url || square_url;
  return { square_url, small_url, medium_url, thumbnail };
};

export const normalizeAncestorIds = (taxon = {}) => {
  if (Array.isArray(taxon.ancestor_ids)) return taxon.ancestor_ids;
  if (taxon.ancestor_ids !== undefined && taxon.ancestor_ids !== null) {
    return [taxon.ancestor_ids];
  }
  if (taxon.ancestor_id !== undefined && taxon.ancestor_id !== null) {
    return [taxon.ancestor_id];
  }
  return [];
};

export const buildSpeciesPayload = (taxon, thumbnailHint) => {
  if (!taxon?.id) return null;
  const rawIconicId = taxon.iconic_taxon_id ?? taxon.iconic_taxon?.id;
  const iconicTaxonId = Number.isFinite(Number(rawIconicId)) ? Number(rawIconicId) : null;
  const payload = {
    id: taxon.id,
    name: taxon.name,
    preferred_common_name: taxon.preferred_common_name,
    common_name: taxon.common_name,
    wikipedia_url: taxon.wikipedia_url,
    rank: taxon.rank,
    ancestor_ids: normalizeAncestorIds(taxon),
    default_photo: taxon.default_photo || null,
    ...resolveImageUrls(taxon, thumbnailHint),
  };
  if (iconicTaxonId !== null) {
    payload.iconic_taxon_id = iconicTaxonId;
  }
  return payload;
};

/**
 * Retourne le nom d'affichage principal pour un taxon.
 * Priorité absolue au nom commun (vernaculaire), avec le nom scientifique en fallback.
 * @param {Object} taxon - L'objet taxon
 * @returns {string} Le nom à afficher
 */
export const getDisplayName = (taxon = {}) => {
  if (!taxon) return '';
  // Priorité absolue : nom commun préféré, puis nom commun général
  const commonName = taxon.preferred_common_name || taxon.common_name;
  if (commonName) return commonName;
  // Fallback : nom scientifique
  return taxon.name || '';
};

/**
 * Retourne le nom scientifique pour affichage en italique (secondaire).
 * @param {Object} taxon - L'objet taxon
 * @returns {string} Le nom scientifique ou chaîne vide
 */
export const getScientificName = (taxon = {}) => {
  return taxon?.name || '';
};
