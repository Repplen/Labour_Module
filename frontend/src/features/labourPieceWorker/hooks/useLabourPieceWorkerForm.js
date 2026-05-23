import { useState } from "react";
import { validateLabourPieceWorkerForm } from "../validators/labourPieceWorker.validator";

const defaultFormState = {
  workerCode: "",
  workerName: "",
  workerType: "Labour",
  labourCategory: "",
  natureOfWorkId: "",
  subNatureOfWorkId: "",
  uomId: "",
  rateType: "Per Day",
  standardRate: "",
  overtimeRate: "",
  pieceRate: "",
  gstApplicable: false,
  gstPercent: "",
  gstAmount: "",
  grossRate: "",
  netRate: "",
  description: "",
  isActive: true,
  mode: "create",
  editingWorker: null,
  isOpen: false,
};

const resolveRateType = (workerType, rateType) => {
  if (workerType === "Piece Worker") {
    return ["Per UOM", "Per Piece", "Per Job"].includes(rateType) ? rateType : "Per UOM";
  }
  return ["Per Day", "Per Hour", "Per Month"].includes(rateType) ? rateType : "Per Day";
};

export function useLabourPieceWorkerForm() {
  const [formState, setFormState] = useState(defaultFormState);
  const [errors, setErrors] = useState({});

  const openCreate = () => {
    setFormState({ ...defaultFormState, mode: "create", isOpen: true });
    setErrors({});
  };

  const openEdit = (worker) => {
    setFormState({
      workerCode: worker?.workerCode || "",
      workerName: worker?.workerName || "",
      workerType: worker?.workerType || "Labour",
      labourCategory: worker?.labourCategory || "",
      natureOfWorkId: worker?.natureOfWorkId?._id || worker?.natureOfWorkId || "",
      subNatureOfWorkId: worker?.subNatureOfWorkId?._id || worker?.subNatureOfWorkId || "",
      uomId: worker?.uomId?._id || worker?.uomId || "",
      rateType: resolveRateType(worker?.workerType || "Labour", worker?.rateType),
      standardRate: worker?.standardRate ?? "",
      overtimeRate: worker?.overtimeRate ?? "",
      pieceRate: worker?.pieceRate ?? "",
      gstApplicable: Boolean(worker?.gstApplicable),
      gstPercent: worker?.gstPercent ?? "",
      gstAmount: worker?.gstAmount ?? "",
      grossRate: worker?.grossRate ?? "",
      netRate: worker?.netRate ?? "",
      description: worker?.description || "",
      isActive: worker?.isActive !== false,
      mode: "edit",
      editingWorker: worker,
      isOpen: true,
    });
    setErrors({});
  };

  const closeForm = () => {
    setFormState(defaultFormState);
    setErrors({});
  };

  const updateField = (field, value) => {
    setFormState((current) => {
      if (field === "workerType") {
        return {
          ...current,
          workerType: value,
          rateType: resolveRateType(value, current.rateType),
          overtimeRate: value === "Piece Worker" ? "" : current.overtimeRate,
          pieceRate: value === "Piece Worker" ? current.pieceRate : "",
        };
      }
      if (field === "natureOfWorkId") {
        return { ...current, natureOfWorkId: value, subNatureOfWorkId: "" };
      }
      if (field === "gstApplicable") {
        return { ...current, gstApplicable: value, gstPercent: value ? current.gstPercent : "" };
      }
      return { ...current, [field]: value };
    });
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const result = validateLabourPieceWorkerForm(formState);
    setErrors(result.errors);
    return result;
  };

  return {
    closeForm,
    errors,
    formState,
    openCreate,
    openEdit,
    setErrors,
    updateField,
    validate,
  };
}
