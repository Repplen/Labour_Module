import { z } from "zod";

export const loginSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(1, "Login ID is required"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

export const validateLoginForm = (data) => {
  const result = loginSchema.safeParse(data);
  if (result.success) return { errors: {}, valid: true };

  const errors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return { errors, valid: false };
};
