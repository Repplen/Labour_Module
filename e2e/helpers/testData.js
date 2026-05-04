function generateUniqueName(prefix = "E2E") {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 8)}`;
}

function generateUniqueEmail(prefix = "e2e") {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function getTodayDate() {
  return toDateInputValue(new Date());
}

function getFutureDate(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return toDateInputValue(date);
}

module.exports = {
  generateUniqueName,
  generateUniqueEmail,
  getTodayDate,
  getFutureDate,
};
