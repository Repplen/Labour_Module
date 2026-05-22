export const MATERIAL_CATEGORIES = [
  "Cement",
  "Brick",
  "Steel",
  "Sand",
  "Aggregate",
  "Paint",
  "Electrical",
  "Plumbing",
  "Wood",
  "Hardware",
  "Others",
];

export const MATERIAL_TYPES = [
  "Consumable",
  "Non-Consumable",
  "Asset",
  "Tool",
  "Equipment",
  "Raw Material",
  "Finished Material",
];

export const GST_OPTIONS = ["", "0", "5", "12", "18", "28"];

export const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ");
export const normalizeMaterialCode = (value) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();

export const getUomLabel = (uom) =>
  [uom?.uomName, uom?.symbol ? `(${uom.symbol})` : ""].filter(Boolean).join(" ");

export const formatMoney = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return numericValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
