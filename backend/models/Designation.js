const mongoose = require("mongoose");

const DesignationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Designation name is required."],
      unique: true,
      trim: true,
      minlength: [2, "Designation name must be at least 2 characters."],
      maxlength: [100, "Designation name must not exceed 100 characters."],
      match: [/[a-zA-Z0-9]/, "Designation name must contain at least one letter or number."],
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Designation", DesignationSchema);