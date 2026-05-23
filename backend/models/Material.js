const mongoose = require("mongoose");

const MaterialSchema = new mongoose.Schema(
  {
    materialCode: { type: String, required: true, trim: true, uppercase: true },
    materialName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    uomId: { type: mongoose.Schema.Types.ObjectId, ref: "Uom", required: true, index: true },
    uomName: { type: String, required: true, trim: true },
    uomSymbol: { type: String, trim: true, default: "" },
    materialType: { type: String, trim: true, default: "" },
    brand: { type: String, trim: true, default: "" },
    specification: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    standardRate: { type: Number, default: null },
    gstPercent: { type: Number, default: null },
    gstAmount: { type: Number, default: null },
    grossRate: { type: Number, default: null },
    netRate: { type: Number, default: null },
    minimumStock: { type: Number, default: null },
    openingStock: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
    deletedBy: { type: String, trim: true, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MaterialSchema.index({ materialCode: 1, isDeleted: 1 }, { name: "material_code_lookup" });
MaterialSchema.index(
  { materialName: 1, category: 1, uomId: 1, isDeleted: 1 },
  { name: "material_name_category_uom_lookup" }
);

module.exports = mongoose.model("Material", MaterialSchema);
