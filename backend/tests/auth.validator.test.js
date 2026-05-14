const { updateUserSchema } = require("../validators/auth.validator");

describe("auth validators", () => {
  test("allows an admin user update with a new password and blank site fields", () => {
    const parsed = updateUserSchema.parse({
      name: "Main Admin",
      email: "admin@example.com",
      password: "newpass123",
      role: "admin",
      siteId: "",
      site: "",
      roleId: "",
      checklistMasterAccess: false,
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        name: "Main Admin",
        email: "admin@example.com",
        password: "newpass123",
        role: "admin",
        checklistMasterAccess: false,
      })
    );
    expect(parsed.siteId).toBeUndefined();
    expect(parsed.site).toBeUndefined();
    expect(parsed.roleId).toBeUndefined();
  });

  test("still rejects short password updates", () => {
    expect(() =>
      updateUserSchema.parse({
        name: "Main Admin",
        email: "admin@example.com",
        password: "12345",
        role: "admin",
        siteId: "",
      })
    ).toThrow("Password must be at least 6 characters");
  });

  test("rejects user names with numbers and invalid email formats", () => {
    expect(() =>
      updateUserSchema.parse({
        name: "kmnjnj7686778",
        email: "1001@!#ghygmail.com",
        role: "user",
        siteId: "",
      })
    ).toThrow("Name can contain only letters and spaces.");
  });
});
