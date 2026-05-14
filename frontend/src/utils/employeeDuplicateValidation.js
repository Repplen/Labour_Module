export const employeeDuplicateMessages = {
  employeeCode: "This employee code already exists.",
  email: "This email ID already exists.",
  mobile: "This mobile number already exists.",
};

export const normalizeEmployeeCode = (value) =>
  String(value || "").trim();

export const normalizeEmployeeEmail = (value) =>
  String(value || "").trim().toLowerCase();

export const normalizeEmployeeMobile = (value) =>
  String(value || "").replace(/[\s-]+/g, "");

const isSameEmployee = (employee, currentEmployeeId) =>
  currentEmployeeId && String(employee?._id || "") === String(currentEmployeeId);

export const getEmployeeDuplicateErrors = (
  employees = [],
  employeeData = {},
  currentEmployeeId = null,
  options = {}
) => {
  const employeeCode = normalizeEmployeeCode(employeeData.employeeCode);
  const email = normalizeEmployeeEmail(employeeData.email);
  const mobile = normalizeEmployeeMobile(employeeData.mobile);
  const skipFields = options.skipFields || {};
  const duplicateErrors = {};

  if (employeeCode && !skipFields.employeeCode) {
    const hasDuplicateEmployeeCode = employees.some(
      (employee) =>
        !isSameEmployee(employee, currentEmployeeId) &&
        normalizeEmployeeCode(employee?.employeeCode) === employeeCode
    );

    if (hasDuplicateEmployeeCode) {
      duplicateErrors.employeeCode = employeeDuplicateMessages.employeeCode;
    }
  }

  if (email && !skipFields.email) {
    const hasDuplicateEmail = employees.some(
      (employee) =>
        !isSameEmployee(employee, currentEmployeeId) &&
        normalizeEmployeeEmail(employee?.email) === email
    );

    if (hasDuplicateEmail) {
      duplicateErrors.email = employeeDuplicateMessages.email;
    }
  }

  if (mobile && !skipFields.mobile) {
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
  if (
    error?.response?.status !== 409 &&
    responseData.message !== "Duplicate employee data found"
  ) {
    return {};
  }

  const errors = Array.isArray(responseData.errors) ? responseData.errors : [];

  return errors.reduce((result, row) => {
    const field = String(row?.field || row?.path || "").trim();

    if (field === "employeeCode" || field === "email" || field === "mobile") {
      return {
        ...result,
        [field]: row?.message || employeeDuplicateMessages[field],
      };
    }

    return result;
  }, {});
};

export const getApiEmployeeFieldErrors = (error) => {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : [];

  return errors.reduce((result, row) => {
    const field = String(row?.field || row?.path || "").trim();

    if (
      field === "employeeCode" ||
      field === "employeeName" ||
      field === "email" ||
      field === "mobile"
    ) {
      return {
        ...result,
        [field]: row?.message || "",
      };
    }

    return result;
  }, {});
};
