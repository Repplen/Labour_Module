const mongoose = require("mongoose");

const MainLocationSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },
    locationName: {
      type: String,
      required: true,
      trim: true,
    },
    parentLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainLocation",
      default: null,
      index: true,
    },
    level: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    hasChildren: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: "",
    },
    updatedBy: {
      type: String,
      trim: true,
      default: "",
    },
    deletedBy: {
      type: String,
      trim: true,
      default: "",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

MainLocationSchema.index(
  {
    siteId: 1,
    parentLocationId: 1,
    locationName: 1,
    isDeleted: 1,
  },
  { name: "main_location_sibling_lookup" }
);

module.exports = mongoose.model("MainLocation", MainLocationSchema);
