export const WORKER_TYPES = ["Labour", "Piece Worker"];

export const LABOUR_CATEGORIES = [
  "Skilled",
  "Semi-Skilled",
  "Unskilled",
  "Supervisor",
  "Contractor Team",
  "Other",
];

export const LABOUR_RATE_TYPES = ["Per Day", "Per Hour", "Per Month"];
export const PIECE_RATE_TYPES = ["Per UOM", "Per Piece", "Per Job"];
export const RATE_TYPES = [...LABOUR_RATE_TYPES, ...PIECE_RATE_TYPES];
export const GST_OPTIONS = ["", "0", "5", "12", "18", "28"];

export const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ");
export const normalizeWorkerCode = (value) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();

export const getUomLabel = (uom) =>
  [uom?.uomName, uom?.symbol ? `(${uom.symbol})` : ""].filter(Boolean).join(" ");

export const getNatureLabel = (work) => work?.path || work?.workName || "";

export const getRateTypesForWorkerType = (workerType) =>
  workerType === "Piece Worker" ? PIECE_RATE_TYPES : LABOUR_RATE_TYPES;

export const roundRate = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

export const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.trim().toLowerCase());
  return Boolean(value);
};

export const calculateLabourPieceRates = ({ standardRate, gstApplicable, gstPercent } = {}) => {
  if (standardRate === "" || standardRate === null || typeof standardRate === "undefined") {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const baseRate = Number(standardRate);
  const isGstApplicable = toBoolean(gstApplicable);
  const gstRate = isGstApplicable
    ? Number(gstPercent === "" || gstPercent === null || typeof gstPercent === "undefined" ? NaN : gstPercent)
    : 0;

  if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const gstAmount = isGstApplicable ? roundRate((baseRate * gstRate) / 100) : 0;
  const grossRate = roundRate(baseRate + gstAmount);
  return {
    gstAmount,
    grossRate,
    netRate: grossRate,
  };
};

export const getLabourPieceRates = (worker = {}) => {
  const calculated = calculateLabourPieceRates({
    standardRate: worker.standardRate,
    gstApplicable: worker.gstApplicable,
    gstPercent: worker.gstPercent,
  });

  return {
    gstAmount: worker.gstAmount ?? calculated.gstAmount,
    grossRate: worker.grossRate ?? calculated.grossRate,
    netRate: worker.netRate ?? calculated.netRate,
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
