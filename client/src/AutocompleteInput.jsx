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

// On ajoute une valeur par défaut `[]` à la prop pour éviter les crashs
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
      const response = await axios.get('http://localhost:3001/api/taxa/autocomplete', { params });
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
        type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown} placeholder={placeholder} disabled={disabled}
      />
      {isLoading && <div className="spinner-autocomplete"></div>}
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((s, index) => {
            // La vérification 'isIncorrect' ne sert plus à rien dans ce contexte,
            // mais on la garde pour le mode difficile. Elle ne plantera plus.
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