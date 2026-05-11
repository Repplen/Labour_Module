const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const Employee = require("../models/Employee");
const {
  normalizeEmployeeEmail,
  normalizeEmployeeMobile,
} = require("../utils/employeeContactNormalization");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/employeeapp";
const cliMongoUri = process.argv
  .find((argument) => argument.startsWith("--mongo-uri="))
  ?.split("=")
  .slice(1)
  .join("=");
const mongoUri =
  cliMongoUri || process.env.MONGO_URI || process.env.MONGODB_URI || DEFAULT_MONGO_URI;

const addToGroup = (groups, key, employee) => {
  if (!key) return;

  if (!groups.has(key)) {
    groups.set(key, []);
  }

  groups.get(key).push(employee);
};

const printDuplicateGroups = (label, groups) => {
  let duplicateCount = 0;

  groups.forEach((employees, value) => {
    if (employees.length < 2) return;

    duplicateCount += 1;
    console.log(`[employee-duplicates] ${label}=${value}`);
    employees.forEach((employee) => {
      console.log(
        `  - ${employee._id} ${employee.employeeCode || ""} ${employee.employeeName || ""}`.trim()
      );
    });
  });

  return duplicateCount;
};

async function reportEmployeeContactDuplicates() {
  await mongoose.connect(mongoUri);

  try {
    const employees = await Employee.find({}, "employeeCode employeeName email mobile").lean();
    const emailGroups = new Map();
    const mobileGroups = new Map();

    employees.forEach((employee) => {
      addToGroup(emailGroups, normalizeEmployeeEmail(employee.email), employee);
      addToGroup(mobileGroups, normalizeEmployeeMobile(employee.mobile), employee);
    });

    const emailDuplicateCount = printDuplicateGroups("email", emailGroups);
    const mobileDuplicateCount = printDuplicateGroups("mobile", mobileGroups);
    const duplicateCount = emailDuplicateCount + mobileDuplicateCount;

    console.log(
      `[employee-duplicates] scanned=${employees.length} duplicateGroups=${duplicateCount}`
    );

    if (duplicateCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

reportEmployeeContactDuplicates().catch((error) => {
  console.error("[employee-duplicates] failed", error);
  process.exit(1);
});
