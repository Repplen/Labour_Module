import {
  WORKER_TYPES,
  getRateTypesForWorkerType,
  normalizeText,
  normalizeWorkerCode,
  toBoolean,
} from "../helpers/labourPieceWorker.helpers";

const workerCodeRegex = /^[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*$/;
const workerTextRegex = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

const validateOptionalNumber = ({ errors, field, label, value }) => {
  if (value === "" || value === null || typeof value === "undefined") return;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    errors[field] = `${label} must be zero or positive.`;
  }
};

export const validateLabourPieceWorkerForm = (formState) => {
  const errors = {};
  const values = {
    workerCode: normalizeWorkerCode(formState.workerCode),
    workerName: normalizeText(formState.workerName),
    workerType: normalizeText(formState.workerType),
    labourCategory: normalizeText(formState.labourCategory),
    natureOfWorkId: formState.natureOfWorkId || "",
    subNatureOfWorkId: formState.subNatureOfWorkId || "",
    uomId: formState.uomId || "",
    rateType: normalizeText(formState.rateType),
    standardRate: formState.standardRate,
    overtimeRate: formState.overtimeRate,
    pieceRate: formState.pieceRate,
    gstApplicable: toBoolean(formState.gstApplicable),
    gstPercent: formState.gstPercent,
    gstAmount: formState.gstAmount,
    grossRate: formState.grossRate,
    netRate: formState.netRate,
    description: normalizeText(formState.description),
    isActive: formState.isActive !== false,
  };

  if (!values.workerCode) errors.workerCode = "Worker code is required.";
  else if (!workerCodeRegex.test(values.workerCode)) {
    errors.workerCode = "Worker code must contain valid text.";
  }

  if (!values.workerName) errors.workerName = "Worker name is required.";
  else if (!workerTextRegex.test(values.workerName)) {
    errors.workerName = "Worker name must contain valid text.";
  }

  if (!values.workerType || !WORKER_TYPES.includes(values.workerType)) {
    errors.workerType = "Worker type is required.";
  }
  if (!values.labourCategory) errors.labourCategory = "Labour category is required.";
  if (!values.rateType || !getRateTypesForWorkerType(values.workerType).includes(values.rateType)) {
    errors.rateType = "Rate type is required.";
  }
  if (values.workerType === "Piece Worker" && !values.uomId) {
    errors.uomId = "UOM is required for piece worker.";
  }

  if (values.standardRate === "" || values.standardRate === null || typeof values.standardRate === "undefined") {
    errors.standardRate = "Standard rate must be a positive number.";
  } else {
    const standardRate = Number(values.standardRate);
    if (!Number.isFinite(standardRate) || standardRate < 0) {
      errors.standardRate = "Standard rate must be a positive number.";
    }
  }

  validateOptionalNumber({ errors, field: "overtimeRate", label: "Overtime rate", value: values.overtimeRate });
  validateOptionalNumber({ errors, field: "pieceRate", label: "Piece rate", value: values.pieceRate });

  if (values.gstApplicable) {
    const gst = Number(values.gstPercent);
    if (values.gstPercent === "" || values.gstPercent === null || typeof values.gstPercent === "undefined" || !Number.isFinite(gst) || gst < 0 || gst > 100) {
      errors.gstPercent = "GST percentage must be between 0 and 100.";
    }
  }

  return { errors, values };
};
