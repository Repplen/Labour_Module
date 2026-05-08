const FIELD_LABELS = {
  employeeCode: "Employee code",
  employeeName: "Employee name",
  designation: "Designation",
  department: "Department",
  subDepartment: "Sub department",
  sites: "Site",
  superiorEmployee: "Superior employee",
  dateOfJoining: "Date of joining",
  email: "Email",
  mobile: "Mobile",
  password: "Password",
};

const normalizeText = (value) => String(value || "").trim();

const getFieldLabel = (path = "") => {
  const normalizedPath = normalizeText(path);
  const firstSegment = normalizedPath.split(".")[0];
  return FIELD_LABELS[normalizedPath] || FIELD_LABELS[firstSegment] || normalizedPath;
};

export const formatApiErrorMessage = (error, fallbackMessage = "Request failed") => {
  const responseData = error?.response?.data || {};
  const errors = Array.isArray(responseData.errors) ? responseData.errors : [];
  const validationMessages = errors
    .map((row) => {
      const message = normalizeText(row?.message);
      const fieldLabel = getFieldLabel(row?.path);
      return message || (fieldLabel ? `${fieldLabel} is invalid` : "");
    })
    .filter(Boolean);

  if (validationMessages.length) {
    return [...new Set(validationMessages)].join("\n");
  }

  return (
    normalizeText(responseData.message) ||
    normalizeText(responseData.error) ||
    fallbackMessage
  );
};
