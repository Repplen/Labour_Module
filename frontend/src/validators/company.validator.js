export const duplicateCompanyMessage = "This company name already exists.";

const allowedCompanyNameRegex = /^[A-Za-z0-9 .&()/_-]+$/;
const repeatedCompanySeparatorRegex = /([.&()/_-])\1/;

export const getCompanyNameError = ({
  name,
  companies,
  editingId,
  shouldShowRequired = false,
}) => {
  const trimmed = String(name || "").trim();

  if (!trimmed) {
    return shouldShowRequired ? "Company name is required." : "";
  }

  if (trimmed.length < 2) return "Company name must be at least 2 characters.";
  if (trimmed.length > 100) return "Company name must not exceed 100 characters.";
  if (!/[a-zA-Z]/.test(trimmed)) {
    return "Company name must contain at least one alphabet.";
  }
  if (!/^[A-Za-z0-9]/.test(trimmed)) {
    return "Company name must start with a letter or number.";
  }
  if (!allowedCompanyNameRegex.test(trimmed)) {
    return "Company name contains invalid characters.";
  }
  if (repeatedCompanySeparatorRegex.test(trimmed)) {
    return "Company name must not contain repeated separators.";
  }

  const isDuplicate = companies.some(
    (company) =>
      String(company?._id || "") !== String(editingId || "") &&
      String(company?.name || "").trim().toLowerCase() === trimmed.toLowerCase()
  );

  return isDuplicate ? duplicateCompanyMessage : "";
};

export const getBackendError = (err) => {
  const data = err?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (errors.length > 0) return errors[0]?.message || "";
  if (data?.message) return data.message;
  return "Something went wrong. Please try again.";
};
