const mongoose = require("mongoose");
const {
  normalizeEmployeeCode,
  normalizeEmployeeEmail,
  normalizeEmployeeMobile,
} = require("../utils/employeeContactNormalization");

const employeeSubSiteSchema = new mongoose.Schema(
  {
    site: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Site",
      required: true
    },
    subSite: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    }
  },
  { _id: false }
);

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: {
      type: String,
      required: true,
      trim: true,
      set: normalizeEmployeeCode
    },

    employeeName: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      trim: true,
      set: normalizeEmployeeEmail
    },

    password: {
      type: String,
      default: "",
      select: false
    },

    mobile: {
      type: String,
      trim: true,
      set: normalizeEmployeeMobile
    },

    /* ✅ DATE OF JOINING (FIX) */
    dateOfJoining: {
      type: Date,
      default: null
    },

    department: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Department"
        }
      ],
      default: []
    },

    subDepartment: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },

    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
      required: true
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null
    },
    accessScopeStrategy: {
      type: String,
      enum: ["inherit", "all", "mapped", "own", "managed"],
      default: "inherit"
    },
    accessCompanyIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Company",
      default: []
    },
    accessSiteIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Site",
      default: []
    },
    accessDepartmentIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Department",
      default: []
    },
    accessSubDepartmentIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: []
    },
    accessEmployeeIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Employee",
      default: []
    },
    qrToken: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true
    },
    qrCodeUrl: {
      type: String,
      default: "",
      trim: true
    },
    qrGeneratedAt: {
      type: Date,
      default: null
    },
    qrEnabled: {
      type: Boolean,
      default: true,
      index: true
    },

    superiorEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null
    },

    /* ✅ MULTIPLE SITES */
    sites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Site"
      }
    ],

    subSites: {
      type: [employeeSubSiteSchema],
      default: []
    },

    photo: {
      type: String,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

employeeSchema.index(
  { employeeCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      employeeCode: { $type: "string", $gt: "" }
    }
  }
);

employeeSchema.index(
  { email: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: {
      email: { $type: "string", $gt: "" }
    }
  }
);

employeeSchema.index(
  { mobile: 1 },
  {
    unique: true,
    partialFilterExpression: {
      mobile: { $type: "string", $gt: "" }
    }
  }
);

module.exports = mongoose.model("Employee", employeeSchema);

