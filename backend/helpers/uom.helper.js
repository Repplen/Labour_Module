const mongoose = require("mongoose");

const FORMULA_TYPES = {
  LENGTH_BREADTH_HEIGHT: "LENGTH_BREADTH_HEIGHT",
  LENGTH_BREADTH: "LENGTH_BREADTH",
  LENGTH: "LENGTH",
  QUANTITY: "QUANTITY",
  CUSTOM: "CUSTOM",
};

const FORMULA_FIELDS = {
  [FORMULA_TYPES.LENGTH_BREADTH_HEIGHT]: ["length", "breadth", "height"],
  [FORMULA_TYPES.LENGTH_BREADTH]: ["length", "breadth"],
  [FORMULA_TYPES.LENGTH]: ["length"],
  [FORMULA_TYPES.QUANTITY]: ["quantity"],
  [FORMULA_TYPES.CUSTOM]: ["customUomName", "quantity", "outturnDescription"],
};

const DEFAULT_UOMS = [
  { uomName: "Metre", shortCode: "M", symbol: "m", category: "Length", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Running Metre", shortCode: "RM", symbol: "m", category: "Length", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Foot", shortCode: "FT", symbol: "ft", category: "Length", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Inch", shortCode: "IN", symbol: "in", category: "Length", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Millimetre", shortCode: "MM", symbol: "mm", category: "Length", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Centimetre", shortCode: "CM", symbol: "cm", category: "Length", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Square Metre", shortCode: "SQM", symbol: "m²", category: "Area", formulaType: FORMULA_TYPES.LENGTH_BREADTH },
  { uomName: "Square Foot", shortCode: "SQFT", symbol: "sq.ft", category: "Area", formulaType: FORMULA_TYPES.LENGTH_BREADTH },
  { uomName: "Square Inch", shortCode: "SQIN", symbol: "sq.in", category: "Area", formulaType: FORMULA_TYPES.LENGTH_BREADTH },
  { uomName: "Square Yard", shortCode: "SQYD", symbol: "sq.yd", category: "Area", formulaType: FORMULA_TYPES.LENGTH_BREADTH },
  { uomName: "Acre", shortCode: "ACRE", symbol: "acre", category: "Area", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Hectare", shortCode: "HECTARE", symbol: "ha", category: "Area", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Cubic Metre", shortCode: "CUM", symbol: "m³", category: "Volume", formulaType: FORMULA_TYPES.LENGTH_BREADTH_HEIGHT },
  { uomName: "Cubic Foot", shortCode: "CUFT", symbol: "cu.ft", category: "Volume", formulaType: FORMULA_TYPES.LENGTH_BREADTH_HEIGHT },
  { uomName: "Cubic Inch", shortCode: "CUIN", symbol: "cu.in", category: "Volume", formulaType: FORMULA_TYPES.LENGTH_BREADTH_HEIGHT },
  { uomName: "Litre", shortCode: "L", symbol: "L", category: "Volume", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Millilitre", shortCode: "ML", symbol: "ml", category: "Volume", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Kilogram", shortCode: "KG", symbol: "kg", category: "Weight", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Gram", shortCode: "G", symbol: "g", category: "Weight", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Ton / Tonne", shortCode: "TON", symbol: "ton", category: "Weight", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Quintal", shortCode: "QTL", symbol: "qtl", category: "Weight", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Number", shortCode: "NO", symbol: "No.", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Each", shortCode: "EACH", symbol: "each", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Piece", shortCode: "PCS", symbol: "pcs", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Nos", shortCode: "NOS", symbol: "Nos", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Set", shortCode: "SET", symbol: "set", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Pair", shortCode: "PAIR", symbol: "pair", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Bundle", shortCode: "BUNDLE", symbol: "bundle", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Box", shortCode: "BOX", symbol: "box", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Bag", shortCode: "BAG", symbol: "bag", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Roll", shortCode: "ROLL", symbol: "roll", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Packet", shortCode: "PACKET", symbol: "packet", category: "Count", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Brass", shortCode: "BRASS", symbol: "brass", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Cum", shortCode: "CONST_CUM", symbol: "cum", category: "Construction Specific", formulaType: FORMULA_TYPES.LENGTH_BREADTH_HEIGHT },
  { uomName: "Sqm", shortCode: "CONST_SQM", symbol: "sqm", category: "Construction Specific", formulaType: FORMULA_TYPES.LENGTH_BREADTH },
  { uomName: "Rmt", shortCode: "RMT", symbol: "rmt", category: "Construction Specific", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Running Feet", shortCode: "RFT", symbol: "rft", category: "Construction Specific", formulaType: FORMULA_TYPES.LENGTH },
  { uomName: "Cement Bag", shortCode: "CEMENT_BAG", symbol: "bag", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Brick Nos", shortCode: "BRICK_NOS", symbol: "nos", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Tile Nos", shortCode: "TILE_NOS", symbol: "nos", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Load", shortCode: "LOAD", symbol: "load", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Trip", shortCode: "TRIP", symbol: "trip", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Hour", shortCode: "HOUR", symbol: "hr", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Day", shortCode: "DAY", symbol: "day", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Man Day", shortCode: "MAN_DAY", symbol: "man day", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Machine Hour", shortCode: "MACHINE_HOUR", symbol: "machine hr", category: "Construction Specific", formulaType: FORMULA_TYPES.QUANTITY },
  { uomName: "Custom / Other", shortCode: "CUSTOM", symbol: "custom", category: "Other", formulaType: FORMULA_TYPES.CUSTOM },
].map((uom) => ({ ...uom, isDefault: true, isActive: true }));

const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ");
const normalizeCode = (value) => normalizeText(value).toUpperCase();
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const createUomError = (message, statusCode = 400, field = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = field ? [{ field, message }] : [];
  return error;
};

const roundQuantity = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round((numericValue + Number.EPSILON) * 1000) / 1000;
};

const toPositiveNumber = (value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : NaN;
};

const calculateOutturnQuantity = ({ formulaType, length, breadth, height, quantity } = {}) => {
  const values = {
    length: toPositiveNumber(length),
    breadth: toPositiveNumber(breadth),
    height: toPositiveNumber(height),
    quantity: toPositiveNumber(quantity),
  };

  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH_HEIGHT) {
    return roundQuantity(values.length * values.breadth * values.height);
  }
  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH) {
    return roundQuantity(values.length * values.breadth);
  }
  if (formulaType === FORMULA_TYPES.LENGTH) {
    return roundQuantity(values.length);
  }
  if (formulaType === FORMULA_TYPES.QUANTITY || formulaType === FORMULA_TYPES.CUSTOM) {
    return roundQuantity(values.quantity);
  }
  return 0;
};

const getFormulaFieldsByUom = (formulaType) => FORMULA_FIELDS[formulaType] || [];

module.exports = {
  DEFAULT_UOMS,
  FORMULA_FIELDS,
  FORMULA_TYPES,
  calculateOutturnQuantity,
  createUomError,
  getFormulaFieldsByUom,
  isValidObjectId,
  normalizeCode,
  normalizeText,
  roundQuantity,
  toPositiveNumber,
};
