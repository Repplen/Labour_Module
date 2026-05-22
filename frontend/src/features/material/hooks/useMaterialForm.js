import { useState } from "react";
import { validateMaterialForm } from "../validators/material.validator";

const defaultFormState = {
  materialCode: "",
  materialName: "",
  category: "",
  uomId: "",
  materialType: "",
  brand: "",
  specification: "",
  description: "",
  standardRate: "",
  gstPercent: "",
  minimumStock: "",
  openingStock: "",
  isActive: true,
  mode: "create",
  editingMaterial: null,
  isOpen: false,
};

export function useMaterialForm() {
  const [formState, setFormState] = useState(defaultFormState);
  const [errors, setErrors] = useState({});

  const openCreate = () => {
    setFormState({ ...defaultFormState, mode: "create", isOpen: true });
    setErrors({});
  };

  const openEdit = (material) => {
    setFormState({
      materialCode: material?.materialCode || "",
      materialName: material?.materialName || "",
      category: material?.category || "",
      uomId: material?.uomId?._id || material?.uomId || "",
      materialType: material?.materialType || "",
      brand: material?.brand || "",
      specification: material?.specification || "",
      description: material?.description || "",
      standardRate: material?.standardRate ?? "",
      gstPercent: material?.gstPercent ?? "",
      minimumStock: material?.minimumStock ?? "",
      openingStock: material?.openingStock ?? "",
      isActive: material?.isActive !== false,
      mode: "edit",
      editingMaterial: material,
      isOpen: true,
    });
    setErrors({});
  };

  const closeForm = () => {
    setFormState(defaultFormState);
    setErrors({});
  };

  const updateField = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  };

  const validate = () => {
    const result = validateMaterialForm(formState);
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
