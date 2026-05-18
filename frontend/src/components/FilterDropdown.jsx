import { useEffect, useRef, useState } from "react";

export default function FilterDropdown({ options = [], value = "", onChange, placeholder = "Select" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value) || null;

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="filter-dropdown-toggle"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m2 5 6 6 6-6" />
        </svg>
      </button>

      <ul className={`dropdown-menu filter-dropdown-menu w-100 mt-1 ${open ? "show" : ""}`}>
        {options.map((option) => (
          <li key={option.value}>
            <button
              type="button"
              className="dropdown-item filter-option"
              onClick={() => { onChange(option.value); setOpen(false); }}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
