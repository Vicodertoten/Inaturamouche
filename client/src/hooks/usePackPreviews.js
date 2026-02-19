// client/src/hooks/usePackPreviews.js
// Progressive preview loader with retries and priority queue.

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../services/api.js';

const PRIORITY_LOW = 1;
const PRIORITY_HIGH = 2;
const MAX_CONCURRENT_REQUESTS = 2;
const MAX_LOW_PRIORITY_PENDING = 24;
const RETRY_BASE_DELAY_MS = 1200;
const RETRY_MAX_DELAY_MS = 60000;
const EMPTY_RETRY_BASE_DELAY_MS = 4000;
const EMPTY_RETRY_MAX_DELAY_MS = 15 * 60 * 1000;

function computeRetryDelay(baseDelayMs, maxDelayMs, attempt) {
  const expDelay = Math.min(maxDelayMs, baseDelayMs * (2 ** Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * Math.max(30, Math.floor(expDelay * 0.2)));
  return Math.min(maxDelayMs, expDelay + jitter);
}

function normalizePhotos(data) {
  if (!data || !Array.isArray(data.photos)) return [];
  return data.photos.filter((photo) => typeof photo?.url === 'string' && photo.url.length > 0);
}

function warmImageCache(photos) {
  if (typeof Image === 'undefined') return;
  for (const photo of photos) {
    const src = photo?.url;
    if (!src) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  }
}

/**
 * Loads pack previews progressively:
 * - visible/hovered packs are high priority
 * - all pack previews can be queued in background
 * - failed requests are retried with exponential backoff
 */
export function usePackPreviews() {
  const [previews, setPreviews] = useState({});
  const metaRef = useRef(new Map()); // packId => { state, attempts, nextRetryAt }
  const pendingRef = useRef(new Map()); // packId => priority
  const activeCountRef = useRef(0);
  const timerRef = useRef(null);
  const mountedRef = useRef(false);
  const processQueueRef = useRef(() => {});

  const clearScheduled = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleProcess = useCallback((delayMs = 0) => {
    clearScheduled();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      processQueueRef.current();
    }, Math.max(0, delayMs));
  }, [clearScheduled]);

  const enqueue = useCallback((packId, priority = PRIORITY_LOW, force = false) => {
    if (!packId || packId === 'custom') return;

    const previous = metaRef.current.get(packId);
    if (!force) {
      if (previous?.state === 'loaded' || previous?.state === 'loading') return;
      // If this pack is currently visible/important, bypass retry cooldown.
      if (priority === PRIORITY_HIGH && previous?.nextRetryAt) {
        metaRef.current.set(packId, { ...previous, nextRetryAt: 0 });
      }
    } else {
      metaRef.current.set(packId, {
        state: 'idle',
        attempts: previous?.attempts ?? 0,
        nextRetryAt: 0,
      });
    }

    const currentPriority = pendingRef.current.get(packId) ?? PRIORITY_LOW;
    if (
      priority === PRIORITY_LOW &&
      !pendingRef.current.has(packId) &&
      pendingRef.current.size >= MAX_LOW_PRIORITY_PENDING
    ) {
      return;
    }
    if (priority > currentPriority || !pendingRef.current.has(packId)) {
      pendingRef.current.set(packId, Math.max(priority, currentPriority));
    }
    scheduleProcess(0);
  }, [scheduleProcess]);

  processQueueRef.current = () => {
    if (!mountedRef.current) return;

    let startedAny = false;
    while (activeCountRef.current < MAX_CONCURRENT_REQUESTS) {
      const now = Date.now();
      let selectedPackId = null;
      let selectedPriority = -1;
      let nextDueAt = Number.POSITIVE_INFINITY;

      for (const [packId, priority] of pendingRef.current.entries()) {
        const meta = metaRef.current.get(packId);
        const dueAt = meta?.nextRetryAt ?? 0;
        if (dueAt > now) {
          if (dueAt < nextDueAt) nextDueAt = dueAt;
          continue;
        }
        if (priority > selectedPriority) {
          selectedPriority = priority;
          selectedPackId = packId;
          if (priority === PRIORITY_HIGH) break;
        }
      }

      if (!selectedPackId) {
        if (!startedAny && Number.isFinite(nextDueAt)) {
          scheduleProcess(nextDueAt - Date.now());
        }
        return;
      }

      pendingRef.current.delete(selectedPackId);
      const currentMeta = metaRef.current.get(selectedPackId);
      if (currentMeta?.state === 'loaded' || currentMeta?.state === 'loading') {
        continue;
      }

      startedAny = true;
      activeCountRef.current += 1;
      metaRef.current.set(selectedPackId, {
        state: 'loading',
        attempts: currentMeta?.attempts ?? 0,
        nextRetryAt: 0,
      });

      fetch(`${API_BASE_URL}/api/packs/${selectedPackId}/preview`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Preview request failed: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          const photos = normalizePhotos(data);
          if (photos.length === 0) {
            const previousMeta = metaRef.current.get(selectedPackId);
            const attempts = (previousMeta?.attempts ?? 0) + 1;
            const retryDelay = computeRetryDelay(
              EMPTY_RETRY_BASE_DELAY_MS,
              EMPTY_RETRY_MAX_DELAY_MS,
              attempts
            );
            metaRef.current.set(selectedPackId, {
              state: 'empty',
              attempts,
              nextRetryAt: Date.now() + retryDelay,
            });
            // Keep retrying in background so packs can recover from transient empty previews.
            const queuedPriority = pendingRef.current.get(selectedPackId) ?? PRIORITY_LOW;
            pendingRef.current.set(selectedPackId, Math.max(queuedPriority, PRIORITY_LOW));
            return;
          }
          metaRef.current.set(selectedPackId, {
            state: 'loaded',
            attempts: metaRef.current.get(selectedPackId)?.attempts ?? 0,
            nextRetryAt: 0,
          });
          if (mountedRef.current) {
            setPreviews((prev) => ({ ...prev, [selectedPackId]: photos }));
          }
          warmImageCache(photos);
        })
        .catch(() => {
          const previousMeta = metaRef.current.get(selectedPackId);
          const attempts = (previousMeta?.attempts ?? 0) + 1;
          const retryDelay = computeRetryDelay(RETRY_BASE_DELAY_MS, RETRY_MAX_DELAY_MS, attempts);
          metaRef.current.set(selectedPackId, {
            state: 'failed',
            attempts,
            nextRetryAt: Date.now() + retryDelay,
          });
          // Keep retrying progressively in background until success.
          const queuedPriority = pendingRef.current.get(selectedPackId) ?? PRIORITY_LOW;
          pendingRef.current.set(selectedPackId, Math.max(queuedPriority, PRIORITY_LOW));
        })
        .finally(() => {
          activeCountRef.current = Math.max(0, activeCountRef.current - 1);
          if (mountedRef.current) scheduleProcess(0);
        });
    }
  };

  const loadPreview = useCallback((packId) => {
    enqueue(packId, PRIORITY_HIGH);
  }, [enqueue]);

  const preloadPackPreviews = useCallback((packIds) => {
    if (!Array.isArray(packIds)) return;
    for (const packId of packIds) {
      enqueue(packId, PRIORITY_LOW);
    }
  }, [enqueue]);

  const getPhotos = useCallback((packId) => previews[packId] ?? null, [previews]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearScheduled();
    };
  }, [clearScheduled]);

  return { getPhotos, loadPreview, preloadPackPreviews };
}
