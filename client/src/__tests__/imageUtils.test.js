import { describe, expect, it } from 'vitest';
import { buildResponsiveSrcSet, getSizedImageUrl, getTaxonResponsiveImageUrls } from '../utils/imageUtils';

describe('imageUtils', () => {
  it('replaces iNaturalist size token when possible', () => {
    const url = 'https://static.inaturalist.org/photos/123/square.jpg';
    expect(getSizedImageUrl(url, 'medium')).toBe('https://static.inaturalist.org/photos/123/medium.jpg');
  });

  it('derives responsive variants from a square-only taxon image', () => {
    const taxon = { square_url: 'https://static.inaturalist.org/photos/123/square.jpeg' };
    const urls = getTaxonResponsiveImageUrls(taxon);
    expect(urls.small).toContain('/small.jpeg');
    expect(urls.medium).toContain('/medium.jpeg');
    expect(urls.large).toContain('/large.jpeg');
  });

  it('builds a unique srcset string', () => {
    const srcSet = buildResponsiveSrcSet({
      small: 'https://static.inaturalist.org/photos/123/small.jpg',
      medium: 'https://static.inaturalist.org/photos/123/medium.jpg',
      large: 'https://static.inaturalist.org/photos/123/large.jpg',
    });
    expect(srcSet).toContain('small.jpg 320w');
    expect(srcSet).toContain('medium.jpg 640w');
    expect(srcSet).toContain('large.jpg 1024w');
  });
});
