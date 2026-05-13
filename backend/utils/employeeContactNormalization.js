const normalizeEmployeeCode = (value) =>
  String(value || "").trim();

const normalizeEmployeeEmail = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeEmployeeMobile = (value) =>
  String(value || "").replace(/[\s-]+/g, "");

module.exports = {
  normalizeEmployeeCode,
  normalizeEmployeeEmail,
  normalizeEmployeeMobile,
};
