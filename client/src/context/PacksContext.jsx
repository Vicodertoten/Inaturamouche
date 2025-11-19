import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getPackCatalog } from '../services/api';

const PacksContext = createContext(null);
const DEFAULT_PACK = {
  id: 'custom',
  type: 'custom',
  titleKey: 'packs.custom.title',
  descriptionKey: 'packs.custom.description',
};

export function PacksProvider({ children }) {
  const [packs, setPacks] = useState([DEFAULT_PACK]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPackCatalog();
      const merged = Array.isArray(data) && data.length > 0 ? data : [DEFAULT_PACK];
      if (!merged.find((pack) => pack.id === DEFAULT_PACK.id)) {
        merged.unshift(DEFAULT_PACK);
      }
      setPacks(merged);
    } catch (err) {
      setError(err.message || 'Unable to load packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const value = useMemo(
    () => ({
      packs,
      loading,
      error,
      refresh: loadPacks,
      packsById: Object.fromEntries(packs.map((p) => [p.id, p])),
    }),
    [packs, loading, error, loadPacks]
  );

  return <PacksContext.Provider value={value}>{children}</PacksContext.Provider>;
}

export function usePacks() {
  const ctx = useContext(PacksContext);
  if (!ctx) {
    throw new Error('usePacks must be used within a PacksProvider');
  }
  return ctx;
}
