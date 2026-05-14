const { ZodError } = require("zod");
const { createHttpError } = require("../utils/httpError");

const buildValidationErrors = (issues = []) =>
  issues.map((issue) => ({
    field: Array.isArray(issue.path) ? issue.path.join(".") : "",
    path: Array.isArray(issue.path) ? issue.path.join(".") : "",
    message: issue.message,
  }));

const validateRequest =
  ({ body, params, query } = {}) =>
  (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }

      if (params) {
        req.params = params.parse(req.params);
      }

      if (query) {
        req.query = query.parse(req.query);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          createHttpError("Validation failed", 400, buildValidationErrors(error.issues))
        );
      }

      next(error);
    }
  };

module.exports = {
  validateRequest,
};
