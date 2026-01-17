/**
 * Utilities pour le préchargement optimisé des images
 */

/**
 * Précharge une image en utilisant la méthode new Image()
 * @param {string} url - L'URL de l'image à précharger
 * @returns {Promise<string>} Résout avec l'URL si succès
 */
export function preloadImage(url) {
  if (!url) return Promise.reject(new Error('No URL provided'));
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.onabort = () => reject(new Error(`Image loading aborted: ${url}`));
    // Set timeout pour éviter les images bloquées indéfiniment
    const timeout = setTimeout(() => {
      reject(new Error(`Image loading timeout: ${url}`));
    }, 8000);
    img.onload = () => {
      clearTimeout(timeout);
      resolve(url);
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
}

/**
 * Précharge plusieurs images en parallèle
 * @param {string[]} urls - Les URLs des images à précharger
 * @returns {Promise<Object>} Objet avec loaded (urls réussies) et failed (urls échouées)
 */
export function preloadImages(urls) {
  if (!urls || urls.length === 0) return Promise.resolve({ loaded: [], failed: [] });
  
  const promises = urls.map(url => 
    preloadImage(url)
      .then(() => ({ success: true, url }))
      .catch(() => ({ success: false, url }))
  );
  
  return Promise.all(promises).then(results => {
    const loaded = results.filter(r => r.success).map(r => r.url);
    const failed = results.filter(r => !r.success).map(r => r.url);
    return { loaded, failed };
  });
}

/**
 * Extrait les URLs d'image d'une question
 * @param {Object} question - Objet question de l'API
 * @returns {string[]} Tableau des URLs d'images
 */
export function extractImageUrlsFromQuestion(question) {
  if (!question) return [];
  
  const urls = [];
  
  // De la bonne réponse
  if (question.bonne_reponse?.default_photo?.square_url) {
    urls.push(question.bonne_reponse.default_photo.square_url);
  }
  if (question.bonne_reponse?.default_photo?.url) {
    urls.push(question.bonne_reponse.default_photo.url);
  }
  if (question.bonne_reponse?.photos?.[0]?.square_url) {
    urls.push(question.bonne_reponse.photos[0].square_url);
  }
  if (question.bonne_reponse?.photos?.[0]?.url) {
    urls.push(question.bonne_reponse.photos[0].url);
  }
  
  // Des choix proposés
  if (question.choices && Array.isArray(question.choices)) {
    question.choices.forEach(choice => {
      if (choice.default_photo?.square_url) urls.push(choice.default_photo.square_url);
      if (choice.default_photo?.url) urls.push(choice.default_photo.url);
      if (choice.photos?.[0]?.square_url) urls.push(choice.photos[0].square_url);
      if (choice.photos?.[0]?.url) urls.push(choice.photos[0].url);
    });
  }
  
  // De l'image principale
  if (question.image_urls && Array.isArray(question.image_urls)) {
    urls.push(...question.image_urls);
  }
  
  // Retirer les doublons
  return [...new Set(urls)];
}

/**
 * Précharge les images d'une question de manière optimiste
 * Échoue silencieusement si les images ne peuvent pas être chargées
 * @param {Object} question - Objet question de l'API
 * @returns {Promise<void>} Toujours résout (jamais rejeté)
 */
export function preloadQuestionImages(question) {
  const urls = extractImageUrlsFromQuestion(question);
  
  if (urls.length === 0) {
    return Promise.resolve();
  }
  
  // Précharger les images en silence (ne pas bloquer sur les erreurs)
  return preloadImages(urls)
    .then(result => {
      if (result.failed.length > 0) {
        console.warn('[Image Preload] Some images failed to load:', result.failed);
      }
      return undefined;
    })
    .catch(err => {
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
