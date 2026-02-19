/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getHomePackCatalog, getPackCatalog } from '../services/api';

const PacksContext = createContext(null);
const DEFAULT_PACK = {
  id: 'custom',
  type: 'custom',
  titleKey: 'packs.custom.title',
  descriptionKey: 'packs.custom.description',
};
const DEFAULT_HOME_CATALOG = {
  sections: [
    { id: 'starter', titleKey: 'home.section_starter', packs: [] },
    { id: 'near_you', titleKey: 'home.section_near_you', packs: [] },
    { id: 'explore', titleKey: 'home.section_explore', packs: [] },
  ],
  customEntry: {
    id: 'custom',
    titleKey: 'home.custom_create_title',
    descriptionKey: 'home.custom_create_desc',
  },
};

function buildHomeFallback(packs) {
  const catalog = Array.isArray(packs) && packs.length > 0 ? packs : [DEFAULT_PACK];
  const customPack = catalog.find((pack) => pack.id === 'custom') || DEFAULT_PACK;
  const visiblePacks = catalog.filter((pack) => pack.id !== 'custom' && pack.visibility !== 'legacy');

  const starter = visiblePacks.filter(
    (pack) => pack.category === 'starter' || pack.level === 'beginner'
  );
  const used = new Set(starter.map((pack) => pack.id));
  const near = visiblePacks.filter((pack) => !used.has(pack.id) && ['belgium', 'france', 'europe'].includes(pack.region));
  for (const pack of near) used.add(pack.id);
  const explore = visiblePacks.filter((pack) => !used.has(pack.id));

  return {
    sections: [
      { id: 'starter', titleKey: 'home.section_starter', packs: starter.slice(0, 10) },
      { id: 'near_you', titleKey: 'home.section_near_you', packs: near.slice(0, 10) },
      { id: 'explore', titleKey: 'home.section_explore', packs: explore.slice(0, 10) },
    ],
    customEntry: {
      id: 'custom',
      titleKey: customPack.titleKey || DEFAULT_HOME_CATALOG.customEntry.titleKey,
      descriptionKey: customPack.descriptionKey || DEFAULT_HOME_CATALOG.customEntry.descriptionKey,
    },
  };
}

function normalizeHomeCatalogPayload(payload, allPacks) {
  const fallback = buildHomeFallback(allPacks);
  if (!payload || typeof payload !== 'object') return fallback;

  const byId = new Map((Array.isArray(allPacks) ? allPacks : []).map((pack) => [pack.id, pack]));
  const inputSections = Array.isArray(payload.sections) ? payload.sections : [];
  const sections = inputSections.map((section) => {
    const sectionId = String(section?.id || '');
    const titleKey = typeof section?.titleKey === 'string' && section.titleKey
      ? section.titleKey
      : `home.section_${sectionId || 'explore'}`;
    const rawPacks = Array.isArray(section?.packs) ? section.packs : [];
    const packs = rawPacks
      .map((item) => {
        const packId = typeof item === 'string' ? item : item?.id;
        if (!packId || packId === 'custom') return null;
        const source = byId.get(packId) || item;
        if (!source || typeof source !== 'object') return null;
        return { ...source };
      })
      .filter(Boolean);

    return {
      id: sectionId || 'explore',
      titleKey,
      packs,
    };
  });

  const customEntry = {
    id: 'custom',
    titleKey:
      typeof payload.customEntry?.titleKey === 'string'
        ? payload.customEntry.titleKey
        : fallback.customEntry.titleKey,
    descriptionKey:
      typeof payload.customEntry?.descriptionKey === 'string'
        ? payload.customEntry.descriptionKey
        : fallback.customEntry.descriptionKey,
  };

  if (sections.length === 0) return { ...fallback, customEntry };
  return { sections, customEntry };
}

export function PacksProvider({ children }) {
  const [packs, setPacks] = useState([DEFAULT_PACK]);
  const packsRef = useRef([DEFAULT_PACK]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [homeSections, setHomeSections] = useState(DEFAULT_HOME_CATALOG.sections);
  const [homeCustomEntry, setHomeCustomEntry] = useState(DEFAULT_HOME_CATALOG.customEntry);
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState(null);

  useEffect(() => {
    packsRef.current = packs;
  }, [packs]);

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
      return merged;
    } catch (err) {
      setError(err.message || 'Unable to load packs');
      return packsRef.current;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHomeCatalog = useCallback(async ({ region, recentPackIds } = {}, sourcePacks = packsRef.current) => {
    setHomeLoading(true);
    setHomeError(null);

    const params = {};
    if (typeof region === 'string' && region.trim()) {
      params.region = region.trim();
    }
    if (Array.isArray(recentPackIds) && recentPackIds.length > 0) {
      params.recent_pack_ids = recentPackIds.join(',');
    }

    try {
      const payload = await getHomePackCatalog(params);
      const normalized = normalizeHomeCatalogPayload(payload, sourcePacks);
      setHomeSections(normalized.sections);
      setHomeCustomEntry(normalized.customEntry);
    } catch (err) {
      setHomeError(err.message || 'Unable to load home pack sections');
      const fallback = buildHomeFallback(sourcePacks);
      setHomeSections(fallback.sections);
      setHomeCustomEntry(fallback.customEntry);
    } finally {
      setHomeLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loadedPacks = await loadPacks();
      if (!mounted) return;
      await loadHomeCatalog({}, loadedPacks);
    })();
    return () => {
      mounted = false;
    };
  }, [loadPacks, loadHomeCatalog]);

  const value = useMemo(
    () => ({
      packs,
      loading,
      error,
      refresh: loadPacks,
      homeSections,
      homeCustomEntry,
      homeLoading,
      homeError,
      refreshHomeCatalog: loadHomeCatalog,
      orderedHomePackIds: homeSections.flatMap((section) => section.packs.map((pack) => pack.id)),
      packsById: Object.fromEntries(packs.map((p) => [p.id, p])),
    }),
    [packs, loading, error, loadPacks, homeSections, homeCustomEntry, homeLoading, homeError, loadHomeCatalog]
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
