const mongoose = require("mongoose");

const moduleSettingSchema = new mongoose.Schema(
  {
    moduleKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    moduleName: {
      type: String,
      required: true,
      trim: true,
    },
    parentGroup: {
      type: String,
      default: "General",
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    isSystemRequired: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    updatedBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    collection: "module_settings",
    timestamps: true,
  }
);

module.exports = mongoose.model("ModuleSetting", moduleSettingSchema);
