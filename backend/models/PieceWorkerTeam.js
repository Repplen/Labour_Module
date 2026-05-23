const mongoose = require("mongoose");

const PieceWorkerTeamMemberSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    employeeName: { type: String, trim: true, default: "" },
    skillType: { type: String, trim: true, default: "" },
    natureOfWorkPath: { type: String, trim: true, default: "" },
    uomName: { type: String, trim: true, default: "" },
    rateType: { type: String, trim: true, default: "" },
    standardRate: { type: Number, default: null },
    gstAmount: { type: Number, default: null },
    grossRate: { type: Number, default: null },
    netRate: { type: Number, default: null },
  },
  { _id: false }
);

const PieceWorkerTeamSchema = new mongoose.Schema(
  {
    teamCode: { type: String, required: true, trim: true, uppercase: true },
    teamName: { type: String, required: true, trim: true },
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: "Site", default: null, index: true },
    siteName: { type: String, trim: true, default: "" },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    departmentName: { type: String, trim: true, default: "" },
    natureOfWorkId: { type: mongoose.Schema.Types.ObjectId, ref: "NatureOfWork", required: true },
    natureOfWorkPath: { type: String, trim: true, default: "" },
    uomId: { type: mongoose.Schema.Types.ObjectId, ref: "Uom", required: true },
    uomName: { type: String, trim: true, default: "" },
    uomSymbol: { type: String, trim: true, default: "" },
    members: { type: [PieceWorkerTeamMemberSchema], default: [] },
    teamLeadEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    teamLeadEmployeeName: { type: String, trim: true, default: "" },
    rateType: { type: String, trim: true, default: "" },
    standardRate: { type: Number, default: null },
    gstApplicable: { type: Boolean, default: false },
    gstPercent: { type: Number, default: null },
    gstAmount: { type: Number, default: null },
    grossRate: { type: Number, default: null },
    netRate: { type: Number, default: null },
    remarks: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: String, trim: true, default: "" },
    updatedBy: { type: String, trim: true, default: "" },
    deletedBy: { type: String, trim: true, default: "" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PieceWorkerTeamSchema.index({ teamCode: 1, isDeleted: 1 }, { name: "piece_worker_team_code_lookup" });
PieceWorkerTeamSchema.index(
  { teamName: 1, natureOfWorkId: 1, siteId: 1, isDeleted: 1 },
  { name: "piece_worker_team_name_work_site_lookup" }
);

module.exports = mongoose.model("PieceWorkerTeam", PieceWorkerTeamSchema);
