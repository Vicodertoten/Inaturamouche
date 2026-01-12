import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import { autocompleteTaxa } from './services/api'; // NOUVEL IMPORT
import { useLanguage } from './context/LanguageContext.jsx';


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
  const listId = useId();
  const { language } = useLanguage();

  const fetchSuggestions = useCallback(async (searchTerm) => {
    if (searchTerm.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await autocompleteTaxa(searchTerm, extraParams, language);
      setSuggestions(data);
    } catch (error) {
      setSuggestions([]);
    }
    setIsLoading(false);
  }, [extraParams, language]);

  useEffect(() => {
    if (debouncedSearchTerm && !disabled) {
      fetchSuggestions(debouncedSearchTerm);
    } else {
      setSuggestions([]);
    }
  }, [debouncedSearchTerm, fetchSuggestions, disabled]);

  useEffect(() => {
    if (suggestions.length === 0) setActiveIndex(-1);
  }, [suggestions.length]);

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

  const isSuggestionBlocked = (suggestion) =>
    incorrectAncestorIds.length > 0 &&
    (suggestion?.ancestor_ids?.some((id) => incorrectAncestorIds.includes(id)) ||
      incorrectAncestorIds.includes(suggestion?.id));

  const handleSelect = (suggestion) => {
    if (isSuggestionBlocked(suggestion)) return;
    setInputValue('');
    setSuggestions([]);
    setActiveIndex(-1);
    onSelect(suggestion);
  };

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "ArrowDown":
        if (suggestions.length === 0) return;
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        if (suggestions.length === 0) return;
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
        if (suggestions.length === 0) return;
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          handleSelect(suggestions[activeIndex]);
        } else if (suggestions[0]) {
          handleSelect(suggestions[0]);
        }
        break;
      case "Tab":
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          e.preventDefault();
          handleSelect(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        setSuggestions([]);
        setActiveIndex(-1);
        break;
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
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={suggestions.length > 0}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        // --- AJOUTS POUR AMÉLIORER LA COMPATIBILITÉ MOBILE ---
        autoComplete="off"      // Désactive la saisie semi-automatique native du navigateur
        autoCorrect="off"       // Désactive la correction automatique
        autoCapitalize="none"   // Empêche la mise en majuscule automatique
        spellCheck="false"      // Désactive le correcteur orthographique
      />
      {isLoading && <div className="spinner-autocomplete"></div>}
      {suggestions.length > 0 && (
        <ul className="suggestions-list" role="listbox" id={listId}>
          {suggestions.map((s, index) => {
            const isIncorrect = isSuggestionBlocked(s);
            const isActive = index === activeIndex;
            
            return (
              <li 
                key={s.id} 
                onClick={() => !isIncorrect && handleSelect(s)}
                id={`${listId}-option-${index}`}
                role="option"
                aria-selected={isActive}
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
