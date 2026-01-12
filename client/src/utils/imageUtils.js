// Utility functions for handling image URLs

// Replace size segment in iNaturalist image URLs to request different sizes
export function getSizedImageUrl(url, size) {
  if (!url) return url;
  return url.replace(/(square|small|medium|large|original)/, size);
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
