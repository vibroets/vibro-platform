// components/AutocompleteSelect.tsx
import React, { useState, useEffect } from 'react';

interface Option {
  label: string;
  value: number;
}

interface AutocompleteSelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  fetchSuggestions: (query: string) => Promise<Option[]>;
}

const AutocompleteSelect: React.FC<AutocompleteSelectProps> = ({
  value,
  onChange,
  placeholder,
  fetchSuggestions,
}) => {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (input.trim() === '') {
      setOptions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      const results = await fetchSuggestions(input);
      setOptions(results);
      setLoading(false);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [input, fetchSuggestions]);

  return (
    <div className="autocomplete">
      <input
        type="text"
        placeholder={placeholder}
        value={options.find(opt => opt.value === value)?.label || input}
        onChange={(e) => {
          setInput(e.target.value);
          onChange(null); // Reset selected value
        }}
      />
      {loading && <div>Loading...</div>}
      <ul>
        {options.map(option => (
          <li key={option.value} onClick={() => {
            onChange(option.value);
            setInput(option.label);
            setOptions([]);
          }}>
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AutocompleteSelect;
