const mongoose = require("mongoose");

const LabourPieceWorkerSchema = new mongoose.Schema(
  {
    workerCode: { type: String, required: true, trim: true, uppercase: true },
    workerName: { type: String, required: true, trim: true },
    workerType: { type: String, required: true, trim: true },
    labourCategory: { type: String, required: true, trim: true },
    natureOfWorkId: { type: mongoose.Schema.Types.ObjectId, ref: "NatureOfWork", default: null, index: true },
    natureOfWorkName: { type: String, trim: true, default: "" },
    subNatureOfWorkId: { type: mongoose.Schema.Types.ObjectId, ref: "NatureOfWork", default: null, index: true },
    subNatureOfWorkPath: { type: String, trim: true, default: "" },
    uomId: { type: mongoose.Schema.Types.ObjectId, ref: "Uom", default: null, index: true },
    uomName: { type: String, trim: true, default: "" },
    uomSymbol: { type: String, trim: true, default: "" },
    rateType: { type: String, required: true, trim: true },
    standardRate: { type: Number, required: true, default: 0 },
    overtimeRate: { type: Number, default: null },
    pieceRate: { type: Number, default: null },
    gstApplicable: { type: Boolean, default: false },
    gstPercent: { type: Number, default: null },
    gstAmount: { type: Number, default: 0 },
    grossRate: { type: Number, default: 0 },
    netRate: { type: Number, default: 0 },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
    deletedBy: { type: String, trim: true, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

LabourPieceWorkerSchema.index({ workerCode: 1, isDeleted: 1 }, { name: "labour_piece_worker_code_lookup" });
LabourPieceWorkerSchema.index(
  { workerName: 1, workerType: 1, natureOfWorkId: 1, uomId: 1, isDeleted: 1 },
  { name: "labour_piece_worker_identity_lookup" }
);

module.exports = mongoose.model("LabourPieceWorker", LabourPieceWorkerSchema);
