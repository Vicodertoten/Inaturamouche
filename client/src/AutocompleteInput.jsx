import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => { clearTimeout(handler); };
  }, [value, delay]);
  return debouncedValue;
}

function AutocompleteInput({ placeholder, onSelect, extraParams, disabled, incorrectAncestorIds = [] }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1); 
  const debouncedSearchTerm = useDebounce(inputValue, 400);
  const containerRef = useRef(null);

  const fetchSuggestions = useCallback(async (searchTerm) => {
    if (searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const params = { q: searchTerm, ...extraParams };
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get(`${apiUrl}/api/taxa/autocomplete`, { params });
      setSuggestions(response.data);
    } catch (error) {
      console.error(`Erreur de recherche pour l'autocomplétion`, error);
      setSuggestions([]);
    }
    setIsLoading(false);
  }, [extraParams]);

  useEffect(() => {
    if (debouncedSearchTerm && !disabled) {
      fetchSuggestions(debouncedSearchTerm);
    } else {
      setSuggestions([]);
    }
  }, [debouncedSearchTerm, fetchSuggestions, disabled]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (suggestion) => {
    setInputValue('');
    setSuggestions([]);
    setActiveIndex(-1);
    onSelect(suggestion);
  };

  const handleKeyDown = (e) => {
    if (suggestions.length === 0) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActiveIndex(prev => (prev + 1) % suggestions.length); break;
      case "ArrowUp": e.preventDefault(); setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length); break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case "Escape": setSuggestions([]); setActiveIndex(-1); break;
      default: break;
    }
  };

  return (
    <div className="autocomplete-container" ref={containerRef}>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        // --- AJOUTS POUR AMÉLIORER LA COMPATIBILITÉ MOBILE ---
        autoComplete="off"      // Désactive la saisie semi-automatique native du navigateur
        autoCorrect="off"       // Désactive la correction automatique
        autoCapitalize="none"   // Empêche la mise en majuscule automatique
        spellCheck="false"      // Désactive le correcteur orthographique
      />
      {isLoading && <div className="spinner-autocomplete"></div>}
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((s, index) => {
            const isIncorrect = incorrectAncestorIds.length > 0 && (s.ancestor_ids?.some(id => incorrectAncestorIds.includes(id)) || incorrectAncestorIds.includes(s.id));
            const isActive = index === activeIndex;
            
            return (
              <li 
                key={s.id} 
                onClick={() => !isIncorrect && handleSelect(s)}
                className={`${isIncorrect ? 'incorrect-suggestion' : ''} ${isActive ? 'suggestion-active' : ''}`}
              >
                {s.name} <span className="rank">({s.rank})</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default AutocompleteInput;