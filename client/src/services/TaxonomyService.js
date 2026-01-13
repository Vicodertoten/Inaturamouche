import db, { speciesTable, taxonGroupsTable } from './db';
import { buildSpeciesPayload } from '../utils/speciesUtils';

const TAXON_API_BASE = 'https://api.inaturalist.org/v1';
const BATCH_INTERVAL_MS = 2000;
const MAX_BATCH_SIZE = 25;
const BROADCAST_CHANNEL_NAME = 'inaturamouche_channel';

const pendingIds = new Set();
let flushTimer;
let isFlushing = false;

const rootScope =
  typeof window !== 'undefined'
    ? window
    : typeof globalThis !== 'undefined'
      ? globalThis
      : undefined;

const scheduleFlush = () => {
  if (!rootScope) return;
  if (flushTimer) return;
  flushTimer = rootScope.setTimeout(() => {
    flushTimer = null;
    void flushTaxonomyQueue();
  }, BATCH_INTERVAL_MS);
};

const fetcher = rootScope?.fetch ? rootScope.fetch.bind(rootScope) : null;

const getBroadcastChannelConstructor = () => {
  if (typeof BroadcastChannel !== 'undefined') {
    return BroadcastChannel;
  }
  return rootScope?.BroadcastChannel ?? null;
};

const processTaxaBatch = async (ids) => {
  if (!ids.length) return;
  if (!fetcher) {
    console.warn('TaxonomyService: fetch is unavailable, skipping taxonomy enrichment.');
    return;
  }
  try {
    const url = new URL(`${TAXON_API_BASE}/taxa/${ids.join(',')}`);
    url.searchParams.set('locale', 'fr');
    const response = await fetcher(url.toString());
    if (!response.ok) {
      throw new Error(`TaxonomyService: failed to fetch taxa (${response.status})`);
    }
    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : payload.taxa || [];
    if (!results.length) return;

    await db.transaction('rw', speciesTable, taxonGroupsTable, async () => {
      for (const taxon of results) {
        const record = buildSpeciesPayload(taxon);
        if (record) {
          await speciesTable.put(record);
        }

        const ancestors = Array.isArray(taxon.ancestors) ? taxon.ancestors : [];
        const uniqueAncestors = [];
        const seen = new Set();
        for (const ancestor of ancestors) {
          if (!ancestor?.id || seen.has(ancestor.id)) continue;
          seen.add(ancestor.id);
          uniqueAncestors.push({
            id: ancestor.id,
            name: ancestor.name,
            rank: ancestor.rank,
          });
        }
        if (!uniqueAncestors.length) continue;
        const ancestorsWithParents = uniqueAncestors.map((ancestor, index) => ({
          ...ancestor,
          parent_id: index === 0 ? null : uniqueAncestors[index - 1].id,
        }));
        const fetched = await taxonGroupsTable.bulkGet(ancestorsWithParents.map(({ id }) => id));
        const missing = ancestorsWithParents.filter((_, index) => !fetched[index]);
        if (missing.length) {
          await taxonGroupsTable.bulkPut(missing);
        }
      }
    });
    const BroadcastChannelConstructor = getBroadcastChannelConstructor();
    if (BroadcastChannelConstructor) {
      const channel = new BroadcastChannelConstructor(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: 'COLLECTION_UPDATED' });
      channel.close();
    }
  } catch (error) {
    console.error('TaxonomyService: Failed to enrich taxa batch', error);
    throw error;
  }
};

export const flushTaxonomyQueue = async () => {
  if (isFlushing || !pendingIds.size) {
    if (pendingIds.size && !flushTimer) {
      scheduleFlush();
    }
    return;
  }
  isFlushing = true;
  const idsToProcess = Array.from(pendingIds).slice(0, MAX_BATCH_SIZE);
  idsToProcess.forEach((id) => pendingIds.delete(id));
  try {
    await processTaxaBatch(idsToProcess);
  } catch (error) {
    console.error('TaxonomyService: Failed to flush taxonomy queue', error);
  } finally {
    isFlushing = false;
    if (pendingIds.size) {
      scheduleFlush();
    }
  }
};

export const queueTaxonForEnrichment = (taxonId) => {
  if (!taxonId) return;
  pendingIds.add(taxonId);
  scheduleFlush();
};
