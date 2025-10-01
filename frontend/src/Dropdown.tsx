import React, { useState, useRef, useEffect } from 'react';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = "Выберите опцию",
  disabled = false,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  
  // Закрытие dropdown при клике вне компонента
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
              setIsOpen(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (option: DropdownOption) => {
    onChange?.(option.value);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div 
      ref={dropdownRef}
      className={`relative w-64 ${className}`}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        className={`
          w-full px-4 py-[6px] text-left border-[2px] border-gray-300 rounded-lg shadow-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          transition-all duration-200 ease-in-out
          ${disabled 
            ? 'bg-gray-100 cursor-not-allowed' 
            : 'hover:border-gray-400 cursor-pointer'
          }
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <span className={`truncate ${!selectedOption ? '' : ''}`}>
            {selectedOption?.label || placeholder}
          </span>
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="py-1 max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option)}
                className={`
                  w-full px-4 py-2 text-left transition-colors duration-150 ease-in-out
                  hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:outline-none
                  ${value === option.value 
                    ? 'bg-blue-100 text-blue-700 font-medium' 
                    : 'text-gray-700'
                  }
                `}
              >
                {option.label}
              </button>
            ))}
            
            {options.length === 0 && (
              <div className="px-4 py-2 text-gray-500 text-center">
                Нет доступных опций
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dropdown;