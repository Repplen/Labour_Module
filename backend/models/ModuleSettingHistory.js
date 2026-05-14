const mongoose = require("mongoose");

const moduleSettingHistorySchema = new mongoose.Schema(
  {
    moduleKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    oldStatus: {
      type: Boolean,
      required: true,
    },
    newStatus: {
      type: Boolean,
      required: true,
    },
    changedBy: {
      type: String,
      default: "",
      trim: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    collection: "module_settings_history",
    timestamps: true,
  }
);

module.exports = mongoose.model("ModuleSettingHistory", moduleSettingHistorySchema);
