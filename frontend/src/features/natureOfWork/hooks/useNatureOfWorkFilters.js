import { useMemo, useState } from "react";

const defaultFilters = {
  search: "",
  path: "",
  status: "",
  level: "",
  workOutturn: "",
  uomId: "",
};

export function useNatureOfWorkFilters() {
  const [filters, setFilters] = useState(defaultFilters);
  const queryParams = useMemo(
    () =>
      Object.entries(filters).reduce((result, [key, value]) => {
        if (String(value || "").trim()) result[key] = value;
        return result;
      }, {}),
    [filters]
  );

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters(defaultFilters);

  return { clearFilters, filters, queryParams, updateFilter };
}
