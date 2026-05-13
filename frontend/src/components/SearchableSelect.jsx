import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

const normalizeValue = (value) => String(value ?? "");

const getOptionValue = (option) => normalizeValue(option?.value ?? option?._id);
const getOptionLabel = (option) => option?.label || option?.name || getOptionValue(option);
const getOptionDescription = (option) => option?.description || "";

const SearchableSelect = forwardRef(function SearchableSelect(
  {
    name,
    value,
    onChange,
    options = [],
    className = "form-select",
    placeholder = "Select",
    searchPlaceholder = "Search",
    emptyLabel = "",
    emptyMessage = "No options available.",
    noResultsMessage = "No matching options found.",
    disabled = false,
    required = false,
  },
  ref
) {
  const listboxId = useId();
  const searchId = useId();
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalizedValue = normalizeValue(value);
  const normalizedOptions = useMemo(
    () =>
      (options || []).map((option) => ({
        ...option,
        value: getOptionValue(option),
        label: getOptionLabel(option),
        description: getOptionDescription(option),
      })),
    [options]
  );
  const selectedOption = useMemo(
    () => normalizedOptions.find((option) => option.value === normalizedValue) || null,
    [normalizedOptions, normalizedValue]
  );
  const filteredOptions = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((option) =>
      [option.label, option.description]
        .filter(Boolean)
        .some((optionText) => String(optionText).toLowerCase().includes(trimmedQuery))
    );
  }, [normalizedOptions, query]);

  useImperativeHandle(
    ref,
    () => ({
      focus: (options) => buttonRef.current?.focus(options),
      scrollIntoView: (options) => wrapperRef.current?.scrollIntoView(options),
    }),
    []
  );

  useEffect(() => {
    if (!open) return undefined;

    const handleDocumentMouseDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);

    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [open]);

  const emitChange = (nextValue) => {
    onChange?.({
      target: {
        name,
        value: nextValue,
        type: "select-one",
      },
    });
  };

  const openMenu = () => {
    if (disabled) return;
    setQuery("");
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const selectValue = (nextValue) => {
    emitChange(nextValue);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const handleButtonKeyDown = (event) => {
    if (["ArrowDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      openMenu();
    }
  };

  const handleMenuKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  };

  return (
    <div className="searchable-select" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`${className} searchable-select__button`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleButtonKeyDown}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        disabled={disabled}
        data-required={required ? "true" : undefined}
      >
        <span className={selectedOption ? "" : "text-muted"}>
          {selectedOption?.label || placeholder}
        </span>
      </button>

      {open ? (
        <div className="searchable-select__menu" onKeyDown={handleMenuKeyDown}>
          <label className="visually-hidden" htmlFor={searchId}>
            {searchPlaceholder}
          </label>
          <input
            id={searchId}
            ref={searchInputRef}
            type="text"
            className="form-control searchable-select__search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="searchable-select__list" id={listboxId} role="listbox">
            {emptyLabel ? (
              <button
                type="button"
                className={`searchable-select__option ${
                  normalizedValue ? "" : "searchable-select__option--active"
                }`}
                role="option"
                aria-selected={!normalizedValue}
                onClick={() => selectValue("")}
              >
                {emptyLabel}
              </button>
            ) : null}

            {!normalizedOptions.length ? (
              <div className="searchable-select__empty">{emptyMessage}</div>
            ) : !filteredOptions.length ? (
              <div className="searchable-select__empty">{noResultsMessage}</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={`searchable-select__option ${
                    option.value === normalizedValue ? "searchable-select__option--active" : ""
                  }`}
                  role="option"
                  aria-selected={option.value === normalizedValue}
                  onClick={() => selectValue(option.value)}
                >
                  <span className="searchable-select__option-label">{option.label}</span>
                  {option.description ? (
                    <span className="searchable-select__option-description">
                      {option.description}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default SearchableSelect;
