import React, { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

export default function MultiSelect({ label, options, selected, onChange, renderOption, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative py-2" ref={containerRef}>
      <div className="flex justify-between items-center mb-2 group cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
         <h4 className="text-[12px] font-semibold text-gray-600 hover:text-[#0969da] transition-colors">{label}</h4>
         <svg className={`w-3.5 h-3.5 text-gray-400 group-hover:text-[#0969da] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      {(!selected || selected.length === 0) ? (
         <div className="text-[12px] text-gray-500">{placeholder}</div>
      ) : (
         <div className="flex flex-col gap-1.5 mt-1">
            {selected.map((val, i) => {
               const onRemove = () => onChange(selected.filter(s => (s._id || s.name || s) !== (val._id || val.name || val)));
               return (
                 <div key={i} className="text-[12px] text-gray-800 flex items-center gap-2">
                   {renderOption(val, true, onRemove)}
                 </div>
               );
            })}
         </div>
      )}

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-full min-w-[240px] bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
          {(!options || options.length === 0) ? <div className="px-3 py-2 text-[12px] text-gray-500">No options found</div> : null}
          {options?.map((opt, i) => {
            const isSelected = selected.some(s => (s._id || s.name || s) === (opt._id || opt.name || opt));
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    onChange(selected.filter(s => (s._id || s.name || s) !== (opt._id || opt.name || opt)));
                  } else {
                    onChange([...selected, opt]);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-gray-50 text-gray-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">{renderOption(opt, false)}</div>
                {isSelected && <Check size={14} className="text-gray-900" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  );
}
