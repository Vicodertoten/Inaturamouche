/**
 * Utilities pour le préchargement optimisé des images
 */
import { getSizedImageUrl } from './imageUtils';

const DEFAULT_PRELOAD_TIMEOUT_MS = 8000;
const DEFAULT_PRELOAD_CONCURRENCY = 2;
const DEFAULT_IDLE_TIMEOUT_MS = 1200;

function scheduleIdle(callback, timeoutMs = DEFAULT_IDLE_TIMEOUT_MS) {
  if (typeof requestIdleCallback === 'function') {
    return requestIdleCallback(callback, { timeout: timeoutMs });
  }
  return setTimeout(callback, 0);
}

function cancelIdle(id) {
  if (typeof cancelIdleCallback === 'function') {
    cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * Précharge une image en utilisant la méthode new Image()
 * @param {string} url - L'URL de l'image à précharger
 * @returns {Promise<string>} Résout avec l'URL si succès
 */
export function preloadImage(url, { signal, timeoutMs = DEFAULT_PRELOAD_TIMEOUT_MS } = {}) {
  if (!url) return Promise.reject(new Error('No URL provided'));
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));

  // IMPORTANT: Précharger en medium pour correspondre à l'affichage
  const optimizedUrl = getSizedImageUrl(url, 'medium');
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
      img.onabort = null;
      if (signal) signal.removeEventListener('abort', onAbort);
    };
    const finish = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve(optimizedUrl);
    };
    const onAbort = () => finish(new DOMException('Aborted', 'AbortError'));
    const onError = () => finish(new Error(`Failed to load image: ${optimizedUrl}`));
    const onTimeout = () => finish(new Error(`Image loading timeout: ${optimizedUrl}`));

    // Set timeout pour éviter les images bloquées indéfiniment
    const timeoutId = setTimeout(onTimeout, timeoutMs);
    img.onload = () => finish();
    img.onerror = onError;
    img.onabort = onAbort;
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    img.src = optimizedUrl;
  });
}

/**
 * Précharge plusieurs images en parallèle
 * @param {string[]} urls - Les URLs des images à précharger
 * @returns {Promise<Object>} Objet avec loaded (urls réussies) et failed (urls échouées)
 */
export function preloadImages(
  urls,
  { concurrency = DEFAULT_PRELOAD_CONCURRENCY, signal } = {}
) {
  if (!urls || urls.length === 0) return Promise.resolve({ loaded: [], failed: [] });

  const queue = urls.slice();
  const loaded = [];
  const failed = [];

  const worker = async () => {
    while (queue.length > 0 && !signal?.aborted) {
      const url = queue.shift();
      try {
        await preloadImage(url, { signal });
        loaded.push(url);
      } catch (_) {
        failed.push(url);
      }
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, queue.length));
  return Promise.all(Array.from({ length: workerCount }, worker)).then(() => ({ loaded, failed }));
}

/**
 * Extrait les URLs d'image d'une question
 * @param {Object} question - Objet question de l'API
 * @returns {string[]} Tableau des URLs d'images
 */
export function extractImageUrlsFromQuestion(question) {
  if (!question) return [];
  
  const urls = [];
  const seen = new Set();
  const pushUnique = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  // Priorite a l'image principale du quiz.
  if (Array.isArray(question.image_urls)) {
    question.image_urls.forEach(pushUnique);
  }
  if (question.image_url) {
    pushUnique(question.image_url);
  }

  // Bonne reponse ensuite.
  pushUnique(question.bonne_reponse?.default_photo?.url);
  pushUnique(question.bonne_reponse?.default_photo?.square_url);
  pushUnique(question.bonne_reponse?.photos?.[0]?.url);
  pushUnique(question.bonne_reponse?.photos?.[0]?.square_url);

  // Puis les choix proposes.
  if (Array.isArray(question.choices)) {
    question.choices.forEach((choice) => {
      pushUnique(choice.default_photo?.url);
      pushUnique(choice.default_photo?.square_url);
      pushUnique(choice.photos?.[0]?.url);
      pushUnique(choice.photos?.[0]?.square_url);
    });
  }

  return urls;
}

/**
 * Précharge les images d'une question de manière optimiste
 * Échoue silencieusement si les images ne peuvent pas être chargées
 * @param {Object} question - Objet question de l'API
 * @returns {Promise<void>} Toujours résout (jamais rejeté)
 */
export function preloadQuestionImages(
  question,
  { signal, priorityCount = 1, concurrency = DEFAULT_PRELOAD_CONCURRENCY } = {}
) {
  const urls = extractImageUrlsFromQuestion(question);
  
  if (urls.length === 0) {
    return Promise.resolve();
  }

  const immediate = urls.slice(0, Math.max(0, priorityCount));
  const deferred = urls.slice(immediate.length);

  const immediatePromise = preloadImages(immediate, { concurrency, signal });
  const deferredPromise = deferred.length
    ? new Promise((resolve) => {
        const idleId = scheduleIdle(() => {
          preloadImages(deferred, { concurrency, signal })
            .then(resolve)
            .catch(() => resolve({ loaded: [], failed: deferred }));
        });
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              cancelIdle(idleId);
              resolve({ loaded: [], failed: deferred });
            },
            { once: true }
          );
        }
      })
    : Promise.resolve({ loaded: [], failed: [] });

  // Précharger les images en silence (ne pas bloquer sur les erreurs)
  return Promise.all([immediatePromise, deferredPromise])
    .then((results) => {
      const failed = results.reduce((acc, result) => acc.concat(result?.failed || []), []);
      if (failed.length > 0) {
        console.warn('[Image Preload] Some images failed to load:', failed);
      }
      return undefined;
    })
    .catch((err) => {
      console.warn('[Image Preload] Preload error:', err);
      return undefined;
    });
}

export default {
  preloadImage,
  preloadImages,
  extractImageUrlsFromQuestion,
  preloadQuestionImages,
};
