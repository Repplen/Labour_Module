export const EMPLOYEE_WORK_TYPES = ["General Employee", "Labour", "Piece Worker"];
export const EMPLOYEE_SKILL_TYPES = [
  "Skilled",
  "Semi-Skilled",
  "Unskilled",
  "Mason",
  "Helper",
  "Carpenter",
  "Painter",
  "Electrician",
  "Plumber",
  "Bar Bender",
  "Tile Worker",
  "Welder",
  "Driver",
  "Operator",
  "Other",
];
export const LABOUR_RATE_TYPES = ["Per Day", "Per Hour", "Per Month"];
export const PIECE_WORKER_RATE_TYPES = ["Per UOM", "Per Piece", "Per Job"];
export const GST_OPTIONS = ["", "0", "5", "12", "18", "28"];

export const defaultEmployeeWorkFields = {
  employeeWorkType: "General Employee",
  skillType: "",
  natureOfWorkId: "",
  subNatureOfWorkId: "",
  uomId: "",
  rateType: "",
  standardRate: "",
  overtimeRate: "",
  pieceRate: "",
  gstApplicable: false,
  gstPercent: "",
  gstAmount: "",
  grossRate: "",
  netRate: "",
  rateEffectiveFrom: "",
  rateEffectiveTo: "",
  rateRemarks: "",
};

export const getRateTypesForEmployeeWorkType = (employeeWorkType) =>
  employeeWorkType === "Piece Worker" ? PIECE_WORKER_RATE_TYPES : LABOUR_RATE_TYPES;

export const getNatureLabel = (work) => work?.path || work?.workName || "";

export const getUomLabel = (uom) =>
  [uom?.uomName, uom?.symbol ? `(${uom.symbol})` : ""].filter(Boolean).join(" ");

export const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.trim().toLowerCase());
  return Boolean(value);
};

export const roundRate = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

export const calculateEmployeeWorkRates = ({ standardRate, gstApplicable, gstPercent } = {}) => {
  if (standardRate === "" || standardRate === null || typeof standardRate === "undefined") {
    return { gstAmount: null, grossRate: null, netRate: null };
  }
  const baseRate = Number(standardRate);
  const hasGst = toBoolean(gstApplicable);
  const gstRate = hasGst
    ? Number(gstPercent === "" || gstPercent === null || typeof gstPercent === "undefined" ? NaN : gstPercent)
    : 0;
  if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return { gstAmount: null, grossRate: null, netRate: null };
  }
  const gstAmount = hasGst ? roundRate((baseRate * gstRate) / 100) : 0;
  const grossRate = roundRate(baseRate + gstAmount);
  return { gstAmount, grossRate, netRate: grossRate };
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

export const validateEmployeeWorkFields = (form = {}) => {
  const errors = {};
  const employeeWorkType = form.employeeWorkType || "General Employee";
  if (employeeWorkType === "General Employee") return errors;

  if (employeeWorkType === "Labour" && !form.skillType) {
    errors.skillType = "Skill / work nature is required.";
  }
  if (!form.rateType) errors.rateType = "Rate type is required.";
  if (form.standardRate === "" || form.standardRate === null || typeof form.standardRate === "undefined") {
    errors.standardRate = "Standard rate must be a positive number.";
  } else {
    const rate = Number(form.standardRate);
    if (!Number.isFinite(rate) || rate < 0) errors.standardRate = "Standard rate must be a positive number.";
  }
  if (employeeWorkType === "Piece Worker") {
    if (!form.natureOfWorkId) errors.natureOfWorkId = "Nature of work is required.";
    if (!form.uomId) errors.uomId = "UOM is required.";
  }

  ["overtimeRate", "pieceRate"].forEach((field) => {
    if (form[field] === "" || form[field] === null || typeof form[field] === "undefined") return;
    const value = Number(form[field]);
    if (!Number.isFinite(value) || value < 0) {
      errors[field] = `${field === "overtimeRate" ? "Overtime rate" : "Piece rate"} must be zero or positive.`;
    }
  });

  if (toBoolean(form.gstApplicable)) {
    const gst = Number(form.gstPercent);
    if (form.gstPercent === "" || form.gstPercent === null || typeof form.gstPercent === "undefined" || !Number.isFinite(gst) || gst < 0 || gst > 100) {
      errors.gstPercent = "GST percentage must be between 0 and 100.";
    }
  }

  return errors;
};
