import { useState } from "react";
import { validateEquipmentForm } from "../validators/equipment.validator";

const defaultFormState = {
  equipmentCode: "",
  equipmentName: "",
  category: "",
  equipmentType: "",
  uomId: "",
  brand: "",
  modelNumber: "",
  serialNumber: "",
  registrationNumber: "",
  capacitySize: "",
  fuelType: "",
  description: "",
  standardRate: "",
  gstPercent: "",
  gstAmount: "",
  grossRate: "",
  netRate: "",
  minimumAvailability: "",
  openingQuantity: "",
  isActive: true,
  mode: "create",
  editingEquipment: null,
  isOpen: false,
};

export function useEquipmentForm() {
  const [formState, setFormState] = useState(defaultFormState);
  const [errors, setErrors] = useState({});

  const openCreate = () => {
    setFormState({ ...defaultFormState, mode: "create", isOpen: true });
    setErrors({});
  };

  const openEdit = (equipment) => {
    setFormState({
      equipmentCode: equipment?.equipmentCode || "",
      equipmentName: equipment?.equipmentName || "",
      category: equipment?.category || "",
      equipmentType: equipment?.equipmentType || "",
      uomId: equipment?.uomId?._id || equipment?.uomId || "",
      brand: equipment?.brand || "",
      modelNumber: equipment?.modelNumber || "",
      serialNumber: equipment?.serialNumber || "",
      registrationNumber: equipment?.registrationNumber || "",
      capacitySize: equipment?.capacitySize || "",
      fuelType: equipment?.fuelType || "",
      description: equipment?.description || "",
      standardRate: equipment?.standardRate ?? "",
      gstPercent: equipment?.gstPercent ?? "",
      gstAmount: equipment?.gstAmount ?? "",
      grossRate: equipment?.grossRate ?? "",
      netRate: equipment?.netRate ?? "",
      minimumAvailability: equipment?.minimumAvailability ?? "",
      openingQuantity: equipment?.openingQuantity ?? "",
      isActive: equipment?.isActive !== false,
      mode: "edit",
      editingEquipment: equipment,
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
    const result = validateEquipmentForm(formState);
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
