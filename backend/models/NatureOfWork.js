const mongoose = require("mongoose");
const { FORMULA_TYPES } = require("../helpers/uom.helper");

const NatureOfWorkSchema = new mongoose.Schema(
  {
    workName: { type: String, required: true, trim: true },
    parentWorkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NatureOfWork",
      default: null,
      index: true,
    },
    level: { type: Number, required: true, min: 1, default: 1 },
    path: { type: String, required: true, trim: true },
    hasChildren: { type: Boolean, default: false },
    isWorkOutturnRequired: { type: Boolean, required: true, default: false },
    uomId: { type: mongoose.Schema.Types.ObjectId, ref: "Uom", default: null },
    uomName: { type: String, trim: true, default: "" },
    uomSymbol: { type: String, trim: true, default: "" },
    formulaType: { type: String, enum: Object.values(FORMULA_TYPES), default: null },
    customUomName: { type: String, trim: true, default: "" },
    length: { type: Number, default: null },
    breadth: { type: Number, default: null },
    height: { type: Number, default: null },
    quantity: { type: Number, default: null },
    totalQuantity: { type: Number, default: null },
    outturnDescription: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
    deletedBy: { type: String, trim: true, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NatureOfWorkSchema.index(
  { parentWorkId: 1, workName: 1, isDeleted: 1 },
  { name: "nature_of_work_sibling_lookup" }
);
NatureOfWorkSchema.index({ path: 1, isDeleted: 1 }, { name: "nature_of_work_path_lookup" });

module.exports = mongoose.model("NatureOfWork", NatureOfWorkSchema);
