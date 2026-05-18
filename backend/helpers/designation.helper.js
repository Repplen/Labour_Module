const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildDesignationNameRegex = (name) =>
  new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i");

const duplicateDesignationNameError = {
  field: "name",
  message: "This designation name already exists.",
};

const isDuplicateKeyError = (err) => err?.code === 11000;

module.exports = {
  buildDesignationNameRegex,
  duplicateDesignationNameError,
  isDuplicateKeyError,
};
