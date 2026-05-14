export const userValidationMessages = {
  nameRequired: "Name is required.",
  nameInvalid: "Name can contain only letters and spaces.",
  emailRequired: "Email is required.",
  emailInvalid: "Please enter a valid email address.",
};

const lettersAndSpacesPattern = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;
const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export const validateUserFields = (form = {}, { requirePassword = false } = {}) => {
  const errors = {};
  const name = String(form.name || "").trim().replace(/\s+/g, " ");
  const email = String(form.email || "").trim().toLowerCase();

  if (!name) {
    errors.name = userValidationMessages.nameRequired;
  } else if (!lettersAndSpacesPattern.test(name)) {
    errors.name = userValidationMessages.nameInvalid;
  }

  if (!email) {
    errors.email = userValidationMessages.emailRequired;
  } else if (!emailPattern.test(email)) {
    errors.email = userValidationMessages.emailInvalid;
  }

  if (requirePassword && !String(form.password || "").trim()) {
    errors.password = "Password is required.";
  }

  return errors;
};

export const getApiUserFieldErrors = (error) => {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : [];

  return errors.reduce((result, row) => {
    const field = String(row?.field || row?.path || "").trim();

    if (field === "name" || field === "email" || field === "password" || field === "siteId") {
      return {
        ...result,
        [field]: row?.message || "",
      };
    }

    return result;
  }, {});
};
