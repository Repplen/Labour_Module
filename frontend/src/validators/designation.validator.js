export const duplicateDesignationMessage = "This designation name already exists.";

export const getDesignationNameError = ({
  name,
  designations,
  editingId,
  shouldShowRequired = false,
}) => {
  const trimmed = String(name || "").trim();

  if (!trimmed) {
    return shouldShowRequired ? "Designation name is required." : "";
  }

  if (trimmed.length < 2) return "Designation name must be at least 2 characters.";
  if (trimmed.length > 100) return "Designation name must not exceed 100 characters.";
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return "Designation name must contain at least one letter or number.";
  }

  const isDuplicate = designations.some(
    (designation) =>
      String(designation?._id || "") !== String(editingId || "") &&
      String(designation?.name || "").trim().toLowerCase() === trimmed.toLowerCase()
  );

  return isDuplicate ? duplicateDesignationMessage : "";
};

export const getBackendError = (err) => {
  const data = err?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (errors.length > 0) return errors[0]?.message || "";
  if (data?.message) return data.message;
  return "Something went wrong. Please try again.";
};
