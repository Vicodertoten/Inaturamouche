// Utility functions for handling image URLs

// Replace size segment in iNaturalist image URLs to request different sizes
export function getSizedImageUrl(url, size) {
  if (!url) return url;
  return url.replace(/(square|small|medium|large|original)/, size);
}

