import { useMemo } from 'react';

export function useGameNextImage({ mediaType, nextQuestion }) {
  const nextImageUrl = useMemo(() => {
    if (mediaType === 'sounds') return null;
    if (!nextQuestion) return null;
    return nextQuestion.image_urls?.[0] || nextQuestion.image_url || null;
  }, [mediaType, nextQuestion]);

  return { nextImageUrl };
}
