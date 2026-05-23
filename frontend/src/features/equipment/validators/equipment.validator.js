import { normalizeEquipmentCode, normalizeText } from "../helpers/equipment.helpers";

const equipmentCodeRegex = /^[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*$/;
const equipmentTextRegex = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

const validateOptionalNumber = ({ errors, field, label, value }) => {
  if (value === "" || value === null || typeof value === "undefined") return;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    errors[field] = `${label} must be zero or positive.`;
  }
};

export const validateEquipmentForm = (formState) => {
  const errors = {};
  const values = {
    equipmentCode: normalizeEquipmentCode(formState.equipmentCode),
    equipmentName: normalizeText(formState.equipmentName),
    category: normalizeText(formState.category),
    equipmentType: normalizeText(formState.equipmentType),
    uomId: formState.uomId || "",
    brand: normalizeText(formState.brand),
    modelNumber: normalizeText(formState.modelNumber),
    serialNumber: normalizeText(formState.serialNumber),
    registrationNumber: normalizeText(formState.registrationNumber),
    capacitySize: normalizeText(formState.capacitySize),
    fuelType: normalizeText(formState.fuelType),
    description: normalizeText(formState.description),
    standardRate: formState.standardRate,
    gstPercent: formState.gstPercent,
    gstAmount: formState.gstAmount,
    grossRate: formState.grossRate,
    netRate: formState.netRate,
    minimumAvailability: formState.minimumAvailability,
    openingQuantity: formState.openingQuantity,
    isActive: formState.isActive !== false,
  };

  if (!values.equipmentCode) errors.equipmentCode = "Equipment code is required.";
  else if (!equipmentCodeRegex.test(values.equipmentCode)) {
    errors.equipmentCode = "Equipment code must contain valid text.";
  }

  if (!values.equipmentName) errors.equipmentName = "Equipment name is required.";
  else if (!equipmentTextRegex.test(values.equipmentName)) {
    errors.equipmentName = "Equipment name must contain valid text.";
  }

  if (!values.category) errors.category = "Equipment category is required.";
  if (!values.uomId) errors.uomId = "UOM is required.";

  if (values.standardRate !== "" && values.standardRate !== null && typeof values.standardRate !== "undefined") {
    const rate = Number(values.standardRate);
    if (!Number.isFinite(rate) || rate < 0) {
      errors.standardRate = "Rate must be a positive number.";
    }
  }

  if (values.gstPercent !== "" && values.gstPercent !== null && typeof values.gstPercent !== "undefined") {
    const gst = Number(values.gstPercent);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100) {
      errors.gstPercent = "GST must be between 0 and 100.";
    }
  }

  validateOptionalNumber({
    errors,
    field: "minimumAvailability",
    label: "Minimum availability",
    value: values.minimumAvailability,
  });
  validateOptionalNumber({
    errors,
    field: "openingQuantity",
    label: "Opening quantity",
    value: values.openingQuantity,
  });

  return { errors, values };
};
