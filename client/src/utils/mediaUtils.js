// Utility helpers for media URLs and metadata.

export function normalizeMediaUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
  return url;
}

export function getAudioMimeType(url) {
  if (typeof url !== 'string' || !url) return '';
  const cleanUrl = url.split('#')[0].split('?')[0];
  const extension = cleanUrl.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'mp3':
      return 'audio/mpeg';
    case 'm4a':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'opus':
      return 'audio/opus';
    case 'aac':
      return 'audio/aac';
    default:
      return '';
  }
}
