import { useMemo, useState } from "react";

const defaultFilters = {
  siteId: "",
  search: "",
  path: "",
  status: "",
  level: "",
  hasChildren: "",
};

export function useMainLocationFilters() {
  const [filters, setFilters] = useState(defaultFilters);

  const queryParams = useMemo(
    () =>
      Object.entries(filters).reduce((result, [key, value]) => {
        if (String(value || "").trim()) {
          result[key] = value;
        }
        return result;
      }, {}),
    [filters]
  );

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearFilters = () => setFilters(defaultFilters);

  return {
    filters,
    queryParams,
    updateFilter,
    clearFilters,
  };
}
