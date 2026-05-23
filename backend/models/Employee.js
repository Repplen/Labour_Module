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

    employeeWorkType: {
      type: String,
      enum: ["General Employee", "Labour", "Piece Worker"],
      default: "General Employee",
      trim: true,
      index: true
    },
    skillType: {
      type: String,
      trim: true,
      default: ""
    },
    natureOfWorkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NatureOfWork",
      default: null
    },
    natureOfWorkPath: {
      type: String,
      trim: true,
      default: ""
    },
    subNatureOfWorkId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NatureOfWork",
      default: null
    },
    subNatureOfWorkPath: {
      type: String,
      trim: true,
      default: ""
    },
    uomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Uom",
      default: null
    },
    uomName: {
      type: String,
      trim: true,
      default: ""
    },
    uomSymbol: {
      type: String,
      trim: true,
      default: ""
    },
    rateType: {
      type: String,
      trim: true,
      default: ""
    },
    standardRate: {
      type: Number,
      default: null
    },
    overtimeRate: {
      type: Number,
      default: null
    },
    pieceRate: {
      type: Number,
      default: null
    },
    gstApplicable: {
      type: Boolean,
      default: false
    },
    gstPercent: {
      type: Number,
      default: null
    },
    gstAmount: {
      type: Number,
      default: null
    },
    grossRate: {
      type: Number,
      default: null
    },
    netRate: {
      type: Number,
      default: null
    },
    rateEffectiveFrom: {
      type: Date,
      default: null
    },
    rateEffectiveTo: {
      type: Date,
      default: null
    },
    rateRemarks: {
      type: String,
      trim: true,
      default: ""
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

