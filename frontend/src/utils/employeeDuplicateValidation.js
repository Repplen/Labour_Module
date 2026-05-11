export const employeeDuplicateMessages = {
  email: "This email ID already exists. Please use a different email.",
  mobile: "This mobile number already exists. Please use a different mobile number.",
};

export const normalizeEmployeeEmail = (value) =>
  String(value || "").trim().toLowerCase();

export const normalizeEmployeeMobile = (value) =>
  String(value || "").replace(/\s+/g, "");

const isSameEmployee = (employee, currentEmployeeId) =>
  currentEmployeeId && String(employee?._id || "") === String(currentEmployeeId);

export const getEmployeeDuplicateErrors = (
  employees = [],
  employeeData = {},
  currentEmployeeId = null
) => {
  const email = normalizeEmployeeEmail(employeeData.email);
  const mobile = normalizeEmployeeMobile(employeeData.mobile);
  const duplicateErrors = {};

  if (email) {
    const hasDuplicateEmail = employees.some(
      (employee) =>
        !isSameEmployee(employee, currentEmployeeId) &&
        normalizeEmployeeEmail(employee?.email) === email
    );

    if (hasDuplicateEmail) {
      duplicateErrors.email = employeeDuplicateMessages.email;
    }
  }

  if (mobile) {
    const hasDuplicateMobile = employees.some(
      (employee) =>
        !isSameEmployee(employee, currentEmployeeId) &&
        normalizeEmployeeMobile(employee?.mobile) === mobile
    );

    if (hasDuplicateMobile) {
      duplicateErrors.mobile = employeeDuplicateMessages.mobile;
    }
  }

  return duplicateErrors;
};

export const getApiDuplicateEmployeeErrors = (error) => {
  const responseData = error?.response?.data || {};
  const errors = Array.isArray(responseData.errors) ? responseData.errors : [];

  return errors.reduce((result, row) => {
    const field = String(row?.field || row?.path || "").trim();

    if (field === "email" || field === "mobile") {
      return {
        ...result,
        [field]: employeeDuplicateMessages[field],
      };
    }

    return result;
  }, {});
};
