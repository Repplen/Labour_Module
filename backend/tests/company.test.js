const { validateCompanyRequest } = require("../validators/company.validator");

const validate = (body) => {
  try {
    return {
      success: true,
      data: validateCompanyRequest(body),
    };
  } catch (error) {
    return {
      success: false,
      firstError: error.errors?.[0]?.message || error.message,
      field: error.field,
    };
  }
};

describe("validateCompanyRequest", () => {
  test("accepts a valid company name", () => {
    const { success, data } = validate({ name: "Acme Corp" });

    expect(success).toBe(true);
    expect(data.name).toBe("Acme Corp");
  });

  test("trims and normalizes company name", () => {
    const { success, data } = validate({ name: "  Acme   Corp  " });

    expect(success).toBe(true);
    expect(data.name).toBe("Acme Corp");
  });

  test("accepts common company-name characters", () => {
    expect(validate({ name: "A.K. Traders" }).success).toBe(true);
    expect(validate({ name: "M&S Associates" }).success).toBe(true);
    expect(validate({ name: "Tech-Solutions" }).success).toBe(true);
    expect(validate({ name: "Internal_System" }).success).toBe(true);
    expect(validate({ name: "Logistics/Exports" }).success).toBe(true);
    expect(validate({ name: "Company (Branch)" }).success).toBe(true);
  });

  test("rejects missing company name", () => {
    const { success, firstError, field } = validate({});

    expect(success).toBe(false);
    expect(field).toBe("name");
    expect(firstError).toMatch(/required/i);
  });

  test("rejects company name with only special characters", () => {
    const { success, firstError } = validate({ name: "###" });

    expect(success).toBe(false);
    expect(firstError).toMatch(/alphabet/i);
  });

  test("rejects company name with only numbers", () => {
    const { success, firstError } = validate({ name: "34" });

    expect(success).toBe(false);
    expect(firstError).toMatch(/alphabet/i);
  });

  test("rejects company name starting with a separator", () => {
    const { success, firstError } = validate({ name: "-Acme Corp" });

    expect(success).toBe(false);
    expect(firstError).toMatch(/start with a letter or number/i);
  });

  test("rejects unsupported company-name characters", () => {
    const { success, firstError } = validate({ name: "Company #1" });

    expect(success).toBe(false);
    expect(firstError).toMatch(/invalid characters/i);
  });

  test("rejects repeated separators", () => {
    const { success, firstError } = validate({ name: "Tech--Solutions" });

    expect(success).toBe(false);
    expect(firstError).toMatch(/repeated separators/i);
  });

  test("accepts selected director employee IDs", () => {
    const { success } = validate({
      name: "Acme Corp",
      directorEmployeeIds: ["64f1a2b3c4d5e6f7a8b9c0d1"],
    });

    expect(success).toBe(true);
  });

  test("rejects non-array director employee IDs", () => {
    const { success, field, firstError } = validate({
      name: "Acme Corp",
      directorEmployeeIds: "64f1a2b3c4d5e6f7a8b9c0d1",
    });

    expect(success).toBe(false);
    expect(field).toBe("directorEmployeeIds");
    expect(firstError).toMatch(/array/i);
  });

  test("rejects non-string director names", () => {
    const { success, field, firstError } = validate({
      name: "Acme Corp",
      directorNames: ["John Doe", 123],
    });

    expect(success).toBe(false);
    expect(field).toBe("directorNames.1");
    expect(firstError).toMatch(/string/i);
  });

  test("rejects non-boolean isActive", () => {
    const { success, field, firstError } = validate({
      name: "Acme Corp",
      isActive: "yes",
    });

    expect(success).toBe(false);
    expect(field).toBe("isActive");
    expect(firstError).toMatch(/boolean/i);
  });
});
