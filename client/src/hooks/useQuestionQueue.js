/**
 * useQuestionQueue - React hook for client-side question prefetching
 * 
 * Optimise la latence ressentie en préchargeant la question N+1 dès que la question N
 * est affichée, plutôt que d'attendre la fin du round.
 * 
 * Usage:
 * ```jsx
 * const { currentQuestion, nextQuestion, isLoading, error, prefetchNext } = useQuestionQueue(filters);
 * 
 * // Dans votre composant de question
 * useEffect(() => {
 *   if (currentQuestion) {
 *     prefetchNext(); // Lance le prefetch de la prochaine question
 *   }
 * }, [currentQuestion, prefetchNext]);
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchQuizQuestion } from '../services/api';

/**
 * Hook pour gérer une file de questions avec prefetch automatique
 * @param {Object} filters - Filtres pour les questions (taxon_ids, place_id, etc.)
 * @param {Object} options - Options { autoRefill: true, queueSize: 2 }
 * @returns {Object} État et méthodes de la queue
 */
export function useQuestionQueue(filters = {}, options = {}) {
  const { autoRefill = true, queueSize = 2 } = options;
  
  // File de questions préchargées
  const [queue, setQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Éviter les requêtes en double
  const inflightRef = useRef(false);
  const abortControllerRef = useRef(null);
  const filtersRef = useRef(filters);
  
  // Mettre à jour la ref des filtres quand ils changent
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  /**
   * Charge une nouvelle question et l'ajoute à la file
   */
  const fetchAndEnqueue = useCallback(async (signal) => {
    if (inflightRef.current) return;
    
    inflightRef.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      const question = await fetchQuizQuestion(filtersRef.current, { signal });
      
      if (!signal?.aborted) {
        setQueue(prev => [...prev, question]);
      }
    } catch (err) {
      if (!signal?.aborted && err.name !== 'AbortError') {
        console.error('Failed to prefetch question:', err);
        setError(err);
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
        inflightRef.current = false;
      }
    }
  }, []);

  /**
   * Remplit la file jusqu'à atteindre queueSize
   */
  const fillQueue = useCallback(async () => {
    // Annuler les requêtes en cours si les filtres ont changé
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    while (queue.length < queueSize && !signal.aborted) {
      await fetchAndEnqueue(signal);
    }
  }, [queue.length, queueSize, fetchAndEnqueue]);

  /**
   * Précharge la prochaine question (à appeler quand question N est affichée)
   */
  const prefetchNext = useCallback(() => {
    if (queue.length < queueSize && !inflightRef.current) {
      fetchAndEnqueue(abortControllerRef.current?.signal);
    }
  }, [queue.length, queueSize, fetchAndEnqueue]);

  /**
   * Récupère la prochaine question de la file
   */
  const dequeue = useCallback(() => {
    setQueue(prev => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      return rest;
    });
    
    // Auto-refill si activé
    if (autoRefill) {
      prefetchNext();
    }
    
    return queue[0] || null;
  }, [queue, autoRefill, prefetchNext]);

  /**
   * Vide la file et annule les requêtes en cours
   */
  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setQueue([]);
    setError(null);
    inflightRef.current = false;
  }, []);

  /**
   * Reset complet (utile quand les filtres changent)
   */
  const reset = useCallback(() => {
    clear();
    fillQueue();
  }, [clear, fillQueue]);

  // Reset automatique quand les filtres changent
  useEffect(() => {
    reset();
    
    return () => {
      // Cleanup: annuler les requêtes en cours
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [filters, reset]);

  return {
    // État
    currentQuestion: queue[0] || null,
    nextQuestion: queue[1] || null,
    queueLength: queue.length,
    isLoading,
    error,
    
    // Méthodes
    dequeue,
    prefetchNext,
    fillQueue,
    clear,
    reset,
  };
}

/**
 * Version simplifiée pour un usage basique (une seule question à la fois)
 * 
 * Usage:
 * ```jsx
 * const { question, loadNext, isLoading } = useQuizQuestion(filters);
 * 
 * // Afficher la question
 * <QuestionCard data={question} />
 * 
 * // Charger la suivante
 * <button onClick={loadNext}>Next</button>
 * ```
 */
export function useQuizQuestion(filters = {}, options = {}) {
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const loadQuestion = useCallback(async () => {
    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoading(true);
    setError(null);

    try {
      const question = await fetchQuizQuestion(filters, { 
        signal,
        ...options 
      });
      
      if (!signal.aborted) {
        setCurrentQuestion(question);
      }
    } catch (err) {
      if (!signal.aborted && err.name !== 'AbortError') {
        console.error('Failed to load question:', err);
        setError(err);
      }
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [filters, options]);

  // Charger automatiquement au montage et quand les filtres changent
  useEffect(() => {
    loadQuestion();

    return () => {
      // Cleanup: annuler les requêtes en cours
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadQuestion]);

  return {
    question: currentQuestion,
    loadNext: loadQuestion,
    isLoading,
    error,
  };
}

export default useQuestionQueue;
