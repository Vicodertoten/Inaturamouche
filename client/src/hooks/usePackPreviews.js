// client/src/hooks/usePackPreviews.js
// Lazy-loads pack preview images from the server API

import { useCallback, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * Hook that lazily fetches pack preview images.
 * Tracks loaded + in-flight IDs permanently to avoid duplicate requests.
 * Returns { getPhotos, loadPreview } where:
 * - getPhotos(packId) returns cached photos or null
 * - loadPreview(packId) triggers a fetch if not already loaded/loading
 */
export function usePackPreviews() {
  const [previews, setPreviews] = useState({});
  // Track both in-flight AND already-loaded IDs — never removed
  const knownRef = useRef(new Set());

  const loadPreview = useCallback((packId) => {
    if (!packId || packId === 'custom') return;
    // Once a pack is known (loading or loaded), never fetch again
    if (knownRef.current.has(packId)) return;
    knownRef.current.add(packId);

    fetch(`${API_BASE}/api/packs/${packId}/preview`)
      .then((res) => (res.ok ? res.json() : { photos: [] }))
      .then((data) => {
        setPreviews((prev) => ({ ...prev, [packId]: data.photos || [] }));
      })
      .catch(() => {
        setPreviews((prev) => ({ ...prev, [packId]: [] }));
      });
    // knownRef entry is never removed — prevents any re-fetch
  }, []);

  const getPhotos = useCallback(
    (packId) => previews[packId] ?? null,
    [previews]
  );

  return { getPhotos, loadPreview };
}
