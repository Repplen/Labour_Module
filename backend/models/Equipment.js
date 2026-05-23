const mongoose = require("mongoose");

const EquipmentSchema = new mongoose.Schema(
  {
    equipmentCode: { type: String, required: true, trim: true, uppercase: true },
    equipmentName: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    equipmentType: { type: String, trim: true, default: "" },
    uomId: { type: mongoose.Schema.Types.ObjectId, ref: "Uom", required: true, index: true },
    uomName: { type: String, required: true, trim: true },
    uomSymbol: { type: String, trim: true, default: "" },
    brand: { type: String, trim: true, default: "" },
    modelNumber: { type: String, trim: true, default: "" },
    serialNumber: { type: String, trim: true, default: "" },
    registrationNumber: { type: String, trim: true, default: "" },
    capacitySize: { type: String, trim: true, default: "" },
    fuelType: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    standardRate: { type: Number, default: null },
    gstPercent: { type: Number, default: null },
    gstAmount: { type: Number, default: null },
    grossRate: { type: Number, default: null },
    netRate: { type: Number, default: null },
    minimumAvailability: { type: Number, default: null },
    openingQuantity: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
    deletedBy: { type: String, trim: true, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

EquipmentSchema.index({ equipmentCode: 1, isDeleted: 1 }, { name: "equipment_code_lookup" });
EquipmentSchema.index(
  { equipmentName: 1, category: 1, uomId: 1, isDeleted: 1 },
  { name: "equipment_name_category_uom_lookup" }
);
EquipmentSchema.index({ serialNumber: 1, isDeleted: 1 }, { name: "equipment_serial_lookup" });
EquipmentSchema.index({ registrationNumber: 1, isDeleted: 1 }, { name: "equipment_registration_lookup" });

module.exports = mongoose.model("Equipment", EquipmentSchema);
