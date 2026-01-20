import { useEffect, useMemo } from 'react';

export function useGameNextImage({ mediaType, nextQuestion }) {
  const nextImageUrl = useMemo(() => {
    if (mediaType === 'sounds') return null;
    if (!nextQuestion) return null;
    return nextQuestion.image_urls?.[0] || nextQuestion.image_url || null;
  }, [mediaType, nextQuestion]);

  useEffect(() => {
    if (nextImageUrl) {
      const img = new Image();
      img.src = nextImageUrl;
    }
  }, [nextImageUrl]);

  return { nextImageUrl };
}
