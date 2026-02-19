// Utility functions for handling image URLs

const INAT_SIZE_TOKEN_RE = /(square|small|medium|large|original)(?=(?:\.[^/?#]+)?(?:[?#]|$))/i;

// Replace iNaturalist size token in URL to request different sizes
export function getSizedImageUrl(url, size) {
  if (!url) return url;
  if (!INAT_SIZE_TOKEN_RE.test(url)) return url;
  return url.replace(INAT_SIZE_TOKEN_RE, size);
}

/**
 * Obtient l'URL optimisée pour un chargement rapide (medium par défaut)
 * Medium = ~500px, parfait pour mobile, chargement quasi instantané
 * @param {string} url - L'URL de l'image iNaturalist
 * @param {string} size - La taille souhaitée (défaut: 'medium')
 * @returns {string} L'URL optimisée
 */
export function getOptimizedImageUrl(url, size = 'medium') {
  return getSizedImageUrl(url, size);
}

export function getTaxonResponsiveImageUrls(taxon = {}) {
  const sourceUrl =
    taxon?.medium_url ||
    taxon?.picture_url_medium ||
    taxon?.small_url ||
    taxon?.picture_url_small ||
    taxon?.square_url ||
    taxon?.thumbnail ||
    taxon?.default_photo?.medium_url ||
    taxon?.default_photo?.small_url ||
    taxon?.default_photo?.square_url ||
    taxon?.default_photo?.url ||
    null;

  if (!sourceUrl) {
    return { source: null, square: null, small: null, medium: null, large: null, original: null };
  }

  const derivedSquare = getSizedImageUrl(sourceUrl, 'square');
  const derivedSmall = getSizedImageUrl(sourceUrl, 'small');
  const derivedMedium = getSizedImageUrl(sourceUrl, 'medium');
  const derivedLarge = getSizedImageUrl(sourceUrl, 'large');
  const derivedOriginal = getSizedImageUrl(sourceUrl, 'original');

  const square = taxon?.square_url || taxon?.default_photo?.square_url || derivedSquare;
  const small =
    taxon?.small_url || taxon?.picture_url_small || taxon?.default_photo?.small_url || derivedSmall || square;
  const medium =
    taxon?.medium_url ||
    taxon?.picture_url_medium ||
    taxon?.default_photo?.medium_url ||
    derivedMedium ||
    small;
  const large = taxon?.large_url || taxon?.default_photo?.large_url || derivedLarge || medium;
  const original =
    taxon?.original_url || taxon?.default_photo?.original_url || derivedOriginal || large;

  return { source: sourceUrl, square, small, medium, large, original };
}

export function buildResponsiveSrcSet(urls = {}, withOriginal = false) {
  const candidates = [
    { url: urls.small, descriptor: '320w' },
    { url: urls.medium, descriptor: '640w' },
    { url: urls.large, descriptor: '1024w' },
    ...(withOriginal ? [{ url: urls.original, descriptor: '1600w' }] : []),
  ];

  const seen = new Set();
  return candidates
    .filter(({ url }) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map(({ url, descriptor }) => `${url} ${descriptor}`)
    .join(', ');
}

export function getQuestionThumbnail(question) {
  if (!question) return null;
  if (Array.isArray(question.image_urls) && question.image_urls.length > 0) {
    return question.image_urls[0];
  }
  if (question.image_url) return question.image_url;
  const metaUrl = Array.isArray(question.image_meta) ? question.image_meta[0]?.url : null;
  return metaUrl || null;
}
