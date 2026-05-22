const mongoose = require("mongoose");
const { FORMULA_TYPES } = require("../helpers/uom.helper");

const UomSchema = new mongoose.Schema(
  {
    uomName: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, trim: true, uppercase: true },
    symbol: { type: String, trim: true, default: "" },
    category: { type: String, trim: true, default: "Other" },
    formulaType: {
      type: String,
      enum: Object.values(FORMULA_TYPES),
      required: true,
      default: FORMULA_TYPES.QUANTITY,
    },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

UomSchema.index({ shortCode: 1, isDeleted: 1 }, { name: "uom_shortcode_lookup" });
UomSchema.index({ uomName: 1, isDeleted: 1 }, { name: "uom_name_lookup" });

module.exports = mongoose.model("Uom", UomSchema);
