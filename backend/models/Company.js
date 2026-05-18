const mongoose = require("mongoose");
const { validateCompanyName } = require("../utils/masterNameValidation");

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Company name is required."],
      // unique: true,
      trim: true,
      minlength: [2, "Company name must be at least 2 characters."],
      maxlength: [100, "Company name must not exceed 100 characters."],
      validate: {
        validator: (value) => !validateCompanyName(value).error,
        message: (props) => validateCompanyName(props.value).error,
      },
    },
    directorNames: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Partial unique index — only enforces uniqueness for ACTIVE companies.
// This allows a deleted company's name to be reused.
companySchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    collation: { locale: "en", strength: 2 }, 
  }
);

module.exports = mongoose.model("Company", companySchema);
