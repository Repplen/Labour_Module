export const employeeValidationMessages = {
  employeeCodeRequired: "Employee code is required.",
  employeeCodeOnlyZeros: "Employee code cannot be only zeros.",
  employeeCodeInvalid: "Employee code can contain only numbers.",
  employeeNameRequired: "Employee name is required.",
  employeeNameLetters: "Employee name must contain letters.",
  employeeNameInvalid: "Employee name can contain only letters, spaces, dot, apostrophe, and hyphen.",
  mobileInvalid: "Please enter a valid 10-digit mobile number.",
  emailInvalid: "Please enter a valid email address.",
};

const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const employeeCodePattern = /^\d+$/;
const hasLetterPattern = /[A-Za-z]/;
const employeeNamePattern = /^[A-Za-z][A-Za-z\s.'-]*$/;
const onlyZerosPattern = /^0+$/;

export const normalizeEmployeeCodeInput = (value) => String(value || "").trim();
export const normalizeEmployeeNameInput = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");
export const normalizeEmployeeEmailInput = (value) =>
  String(value || "").trim().toLowerCase();
export const normalizeEmployeeMobileInput = (value) =>
  String(value || "").trim().replace(/[\s-]+/g, "");

export const validateEmployeeFields = (form = {}) => {
  const errors = {};
  const employeeCode = normalizeEmployeeCodeInput(form.employeeCode);
  const employeeName = normalizeEmployeeNameInput(form.employeeName);
  const email = normalizeEmployeeEmailInput(form.email);
  const mobile = normalizeEmployeeMobileInput(form.mobile);

  if (!employeeCode) {
    errors.employeeCode = employeeValidationMessages.employeeCodeRequired;
  } else if (onlyZerosPattern.test(employeeCode)) {
    errors.employeeCode = employeeValidationMessages.employeeCodeOnlyZeros;
  } else if (!employeeCodePattern.test(employeeCode)) {
    errors.employeeCode = employeeValidationMessages.employeeCodeInvalid;
  }

  if (!employeeName) {
    errors.employeeName = employeeValidationMessages.employeeNameRequired;
  } else if (!hasLetterPattern.test(employeeName)) {
    errors.employeeName = employeeValidationMessages.employeeNameLetters;
  } else if (!employeeNamePattern.test(employeeName)) {
    errors.employeeName = employeeValidationMessages.employeeNameInvalid;
  }

  if (mobile && !/^\d{10}$/.test(mobile)) {
    errors.mobile = employeeValidationMessages.mobileInvalid;
  }

  if (email && !emailPattern.test(email)) {
    errors.email = employeeValidationMessages.emailInvalid;
  }

  return errors;
};

export const mergeEmployeeFieldErrors = (...errorMaps) =>
  errorMaps.reduce(
    (result, errorMap = {}) => ({
      ...result,
      ...Object.entries(errorMap).reduce((nextResult, [field, message]) => {
        if (!message || result[field]) return nextResult;
        return { ...nextResult, [field]: message };
      }, {}),
    }),
    {}
  );
