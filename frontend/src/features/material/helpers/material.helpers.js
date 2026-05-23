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

export const roundRate = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

export const calculateMaterialRates = ({ standardRate, gstPercent } = {}) => {
  if (standardRate === "" || standardRate === null || typeof standardRate === "undefined") {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const baseRate = Number(standardRate);
  const gstRate = gstPercent === "" || gstPercent === null || typeof gstPercent === "undefined"
    ? 0
    : Number(gstPercent);

  if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const gstAmount = roundRate((baseRate * gstRate) / 100);
  const grossRate = roundRate(baseRate + gstAmount);
  return {
    gstAmount,
    grossRate,
    netRate: grossRate,
  };
};

export const getMaterialRates = (material = {}) => {
  const calculated = calculateMaterialRates({
    standardRate: material.standardRate,
    gstPercent: material.gstPercent,
  });

  return {
    gstAmount: material.gstAmount ?? calculated.gstAmount,
    grossRate: material.grossRate ?? calculated.grossRate,
    netRate: material.netRate ?? calculated.netRate,
  };
};

export const formatMoney = (value) => {
  if (value === null || typeof value === "undefined" || value === "") return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "-";
  return `₹${numericValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
