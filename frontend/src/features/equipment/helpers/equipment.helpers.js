export const EQUIPMENT_CATEGORIES = [
  "Machinery",
  "Vehicle",
  "Tool",
  "Equipment",
  "Electrical Equipment",
  "Construction Equipment",
  "Safety Equipment",
  "Other",
];

export const EQUIPMENT_TYPES = [
  "Owned",
  "Rental",
  "Lease",
  "Contractor Provided",
  "Company Provided",
];

export const FUEL_TYPES = ["Diesel", "Petrol", "Electric", "Battery", "Manual", "NA"];

export const GST_OPTIONS = ["", "0", "5", "12", "18", "28"];

export const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ");
export const normalizeEquipmentCode = (value) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();

export const getUomLabel = (uom) =>
  [uom?.uomName, uom?.symbol ? `(${uom.symbol})` : ""].filter(Boolean).join(" ");

export const roundRate = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

export const calculateEquipmentRates = ({ standardRate, gstPercent } = {}) => {
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

export const getEquipmentRates = (equipment = {}) => {
  const calculated = calculateEquipmentRates({
    standardRate: equipment.standardRate,
    gstPercent: equipment.gstPercent,
  });

  return {
    gstAmount: equipment.gstAmount ?? calculated.gstAmount,
    grossRate: equipment.grossRate ?? calculated.grossRate,
    netRate: equipment.netRate ?? calculated.netRate,
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
