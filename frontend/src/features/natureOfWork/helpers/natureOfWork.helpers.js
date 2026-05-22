export const FORMULA_TYPES = {
  LENGTH_BREADTH_HEIGHT: "LENGTH_BREADTH_HEIGHT",
  LENGTH_BREADTH: "LENGTH_BREADTH",
  LENGTH: "LENGTH",
  QUANTITY: "QUANTITY",
  CUSTOM: "CUSTOM",
};

export const FORMULA_FIELDS = {
  [FORMULA_TYPES.LENGTH_BREADTH_HEIGHT]: ["length", "breadth", "height"],
  [FORMULA_TYPES.LENGTH_BREADTH]: ["length", "breadth"],
  [FORMULA_TYPES.LENGTH]: ["length"],
  [FORMULA_TYPES.QUANTITY]: ["quantity"],
  [FORMULA_TYPES.CUSTOM]: ["customUomName", "quantity", "outturnDescription"],
};

export const getNodeId = (node) => String(node?._id || node?.id || "");
export const nodeHasChildren = (node) =>
  Boolean(node?.hasChildren || (Array.isArray(node?.children) && node.children.length));

export const normalizeWorkName = (value) => String(value || "").trim().replace(/\s+/g, " ");

const roundQuantity = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round((numericValue + Number.EPSILON) * 1000) / 1000;
};

const toNumber = (value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  return Number(value);
};

export const calculateOutturnQuantity = ({ formulaType, length, breadth, height, quantity }) => {
  const values = {
    length: toNumber(length),
    breadth: toNumber(breadth),
    height: toNumber(height),
    quantity: toNumber(quantity),
  };

  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH_HEIGHT) {
    return roundQuantity(values.length * values.breadth * values.height);
  }
  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH) {
    return roundQuantity(values.length * values.breadth);
  }
  if (formulaType === FORMULA_TYPES.LENGTH) return roundQuantity(values.length);
  if (formulaType === FORMULA_TYPES.QUANTITY || formulaType === FORMULA_TYPES.CUSTOM) {
    return roundQuantity(values.quantity);
  }
  return 0;
};

const formatNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  return Number.isInteger(numericValue) ? String(numericValue) : String(Number(numericValue.toFixed(3)));
};

export const buildOutturnPreview = ({ formulaType, length, breadth, height, quantity, uomSymbol }) => {
  const totalQuantity = calculateOutturnQuantity({ formulaType, length, breadth, height, quantity });
  const symbol = uomSymbol ? ` ${uomSymbol}` : "";

  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH_HEIGHT) {
    return `${formatNumber(length)} × ${formatNumber(breadth)} × ${formatNumber(height)} = ${formatNumber(totalQuantity)}${symbol}`;
  }
  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH) {
    return `${formatNumber(length)} × ${formatNumber(breadth)} = ${formatNumber(totalQuantity)}${symbol}`;
  }
  if (formulaType === FORMULA_TYPES.LENGTH) return `${formatNumber(length)}${symbol}`;
  if (formulaType === FORMULA_TYPES.QUANTITY || formulaType === FORMULA_TYPES.CUSTOM) {
    return `${formatNumber(quantity)}${symbol}`;
  }
  return "";
};

export const flattenNatureOfWorkTree = (nodes = []) => {
  const rows = [];
  const visit = (node, depth = 0) => {
    rows.push({ ...node, depth });
    (node.children || []).forEach((child) => visit(child, depth + 1));
  };
  nodes.forEach((node) => visit(node, 0));
  return rows;
};

export const getUomLabel = (uom) =>
  [uom?.uomName, uom?.symbol ? `(${uom.symbol})` : ""].filter(Boolean).join(" ");
