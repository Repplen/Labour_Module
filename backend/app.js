const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const { env } = require("./config/env");
const { errorHandler, errorResponseNormalizer, notFoundHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/requestLogger");
const { moduleEnabled } = require("./middleware/moduleEnabled");
const { createHttpError } = require("./utils/httpError");

const authRoutes = require("./routes/auth.routes");
const employeeRoutes = require("./routes/employee.routes");
const departmentRoutes = require("./routes/department.routes");
const designationRoutes = require("./routes/designation.routes");
const siteRoutes = require("./routes/site.routes");
const companyRoutes = require("./routes/company.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const checklistRoutes = require("./routes/checklist.routes");
const checklistTaskRoutes = require("./routes/checklistTask.routes");
const generatedChecklistTaskRoutes = require("./routes/generatedChecklistTask.routes");
const personalTaskRoutes = require("./routes/personalTask.routes");
const chatRoutes = require("./routes/chat.routes");
const departmentChatRoutes = require("./routes/departmentChat.routes");
const feedbackRoutes = require("./routes/feedback.routes");
const chatbotRoutes = require("./routes/chatbot.routes");
const permissionRoutes = require("./routes/permission.routes");
const moduleSettingsRoutes = require("./routes/moduleSettings.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const pollRoutes = require("./routes/poll.routes");
const complaintRoutes = require("./routes/complaint.routes");

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(createHttpError("Origin not allowed by CORS", 403));
  },
  credentials: true,
};

const createApp = () => {
  const app = express();

  app.set("trust proxy", 1);
  app.use(errorResponseNormalizer);
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
  app.use(requestLogger);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/departments", moduleEnabled("department_master"), departmentRoutes);
  app.use("/api/designations", moduleEnabled("designation_master"), designationRoutes);
  app.use("/api/companies", moduleEnabled("company_master"), companyRoutes);
  app.use("/api/sites", moduleEnabled("site_master"), siteRoutes);
  app.use("/api/dashboard", moduleEnabled("dashboard"), dashboardRoutes);
  app.use("/api/generated-checklist-tasks", moduleEnabled("checklist"), generatedChecklistTaskRoutes);
  app.use("/api/checklist-tasks", moduleEnabled("checklist"), checklistTaskRoutes);
  app.use("/api/checklists", moduleEnabled("checklist"), checklistRoutes);
  app.use("/api/personal-tasks", moduleEnabled("own_task"), personalTaskRoutes);
  app.use("/api/chat", moduleEnabled("site_chat"), chatRoutes);
  app.use("/api/department-chat", moduleEnabled("department_chat"), departmentChatRoutes);
  app.use("/api/feedback", moduleEnabled("feedback"), feedbackRoutes);
  app.use("/api/chatbot", moduleEnabled("checklist"), chatbotRoutes);
  app.use("/api/module-settings", moduleSettingsRoutes);
  app.use("/api/permissions", permissionRoutes);
  app.use("/api/attendance-reports", moduleEnabled("attendance"));
  app.use("/api/attendance-regularization", moduleEnabled("attendance"));
  app.use("/api/attendance-settings", moduleEnabled("attendance"));
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/poll-results", moduleEnabled("polling"));
  app.use("/api/poll-responses", moduleEnabled("polling"));
  app.use("/api/poll-notifications", moduleEnabled("polling"));
  app.use("/api/complaint-notifications", moduleEnabled("complaints"));
  app.use("/api/polls", pollRoutes);
  app.use("/api/complaints", complaintRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = {
  createApp,
};
