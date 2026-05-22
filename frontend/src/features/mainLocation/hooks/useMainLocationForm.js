import { useState } from "react";
import { validateMainLocationForm } from "../validators/mainLocation.validator";

const defaultFormState = {
  siteId: "",
  locationName: "",
  parentLocationId: "",
  parentLocation: null,
  mode: "create",
  isOpen: false,
};

export function useMainLocationForm() {
  const [formState, setFormState] = useState(defaultFormState);
  const [errors, setErrors] = useState({});

  const openCreate = (siteId = "") => {
    setFormState({ ...defaultFormState, siteId, mode: "create", isOpen: true });
    setErrors({});
  };

  const openChild = (parentLocation) => {
    setFormState({
      ...defaultFormState,
      siteId: parentLocation?.siteId?._id || parentLocation?.siteId || "",
      parentLocationId: parentLocation?._id || "",
      parentLocation,
      mode: "child",
      isOpen: true,
    });
    setErrors({});
  };

  const openEdit = (location) => {
    setFormState({
      siteId: location?.siteId?._id || location?.siteId || "",
      locationName: location?.locationName || "",
      parentLocationId: location?.parentLocationId?._id || location?.parentLocationId || "",
      parentLocation: location?.parentLocationId || null,
      mode: "edit",
      editingLocation: location,
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
    const result = validateMainLocationForm(formState);
    setErrors(result.errors);
    return result;
  };

  return {
    errors,
    formState,
    closeForm,
    openChild,
    openCreate,
    openEdit,
    setErrors,
    updateField,
    validate,
  };
}
