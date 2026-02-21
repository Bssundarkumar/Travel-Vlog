import { useState, useRef, useEffect } from 'react';
import type { City } from '../types/travel';
import { searchCities } from '../utils/cities';

interface CityAutocompleteProps {
  label: string;
  value: City | null;
  onChange: (city: City | null) => void;
  placeholder?: string;
}

export default function CityAutocomplete({
  label,
  value,
  onChange,
  placeholder = 'Search for a city...',
}: CityAutocompleteProps) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [results, setResults] = useState<City[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInputChange(val: string) {
    setQuery(val);
    const matches = searchCities(val);
    setResults(matches);
    setIsOpen(matches.length > 0);
    setHighlightIndex(-1);
    if (!val) onChange(null);
  }

  function handleSelect(city: City) {
    setQuery(city.name);
    onChange(city);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label}
      </label>
      <input
        type="text"
        value={query}
        onChange={e => handleInputChange(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg
                   text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                   focus:ring-blue-500 focus:border-transparent transition-all"
      />
      {isOpen && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700
                       rounded-lg shadow-xl max-h-60 overflow-auto">
          {results.map((city, i) => (
            <li
              key={city.name}
              onClick={() => handleSelect(city)}
              onMouseEnter={() => setHighlightIndex(i)}
              className={`px-4 py-2.5 cursor-pointer transition-colors text-sm
                ${i === highlightIndex ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              {city.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
