import { normalizeMaterialCode, normalizeText } from "../helpers/material.helpers";

const materialCodeRegex = /^[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*$/;
const materialTextRegex = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

const validateOptionalNumber = ({ errors, field, label, positive = false, value }) => {
  if (value === "" || value === null || typeof value === "undefined") return;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || (positive ? numericValue < 0 : numericValue < 0)) {
    errors[field] = positive ? `${label} must be a positive number.` : `${label} must be zero or positive.`;
  }
};

export const validateMaterialForm = (formState) => {
  const errors = {};
  const values = {
    materialCode: normalizeMaterialCode(formState.materialCode),
    materialName: normalizeText(formState.materialName),
    category: normalizeText(formState.category),
    uomId: formState.uomId || "",
    materialType: normalizeText(formState.materialType),
    brand: normalizeText(formState.brand),
    specification: normalizeText(formState.specification),
    description: normalizeText(formState.description),
    standardRate: formState.standardRate,
    gstPercent: formState.gstPercent,
    minimumStock: formState.minimumStock,
    openingStock: formState.openingStock,
    gstAmount: formState.gstAmount,
    grossRate: formState.grossRate,
    netRate: formState.netRate,
    isActive: formState.isActive !== false,
  };

  if (!values.materialCode) errors.materialCode = "Material code is required.";
  else if (!materialCodeRegex.test(values.materialCode)) {
    errors.materialCode = "Material code must contain valid text.";
  }

  if (!values.materialName) errors.materialName = "Material name is required.";
  else if (!materialTextRegex.test(values.materialName)) {
    errors.materialName = "Material name must contain valid text.";
  }

  if (!values.category) errors.category = "Material category is required.";
  if (!values.uomId) errors.uomId = "UOM is required.";

  validateOptionalNumber({
    errors,
    field: "standardRate",
    label: "Standard rate",
    positive: true,
    value: values.standardRate,
  });

  if (values.gstPercent !== "" && values.gstPercent !== null && typeof values.gstPercent !== "undefined") {
    const gst = Number(values.gstPercent);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
      errors.gstPercent = "GST percentage must be between 0 and 100.";
    }
  }

  validateOptionalNumber({ errors, field: "minimumStock", label: "Minimum stock", value: values.minimumStock });
  validateOptionalNumber({ errors, field: "openingStock", label: "Opening stock", value: values.openingStock });

  return { errors, values };
};
