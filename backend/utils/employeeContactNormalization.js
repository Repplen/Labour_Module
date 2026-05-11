const normalizeEmployeeEmail = (value) =>
  String(value || "").trim().toLowerCase();

const normalizeEmployeeMobile = (value) =>
  String(value || "").replace(/\s+/g, "");

module.exports = {
  normalizeEmployeeEmail,
  normalizeEmployeeMobile,
};
