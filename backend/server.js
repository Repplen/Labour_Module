const mongoose = require("mongoose");
const { createApp } = require("./app");
const { env, validateEnv } = require("./config/env");
const { startComplaintScheduler } = require("./services/complaintLifecycle.service");
const { startChecklistScheduler } = require("./services/checklistWorkflow.service");
const { startPersonalTaskScheduler } = require("./services/personalTask.service");
const { syncModuleSettingsSeed } = require("./services/moduleSettings.service");
const { syncPermissionSeed } = require("./services/permissionCatalog.service");

const app = createApp();

const startServer = async () => {
  try {
    validateEnv({ allowMissingCors: env.nodeEnv === "test" });
    await mongoose.connect(env.mongodbUri);
    console.log("[startup] MongoDB connected");
    await syncPermissionSeed();
    console.log("[startup] Permission catalog synchronized");
    await syncModuleSettingsSeed();
    console.log("[startup] Module settings synchronized");

    startChecklistScheduler();
    startPersonalTaskScheduler();
    startComplaintScheduler();
    console.log("[startup] Background schedulers started");

    const server = app.listen(env.port, () => {
      console.log(`[startup] Server running on port ${env.port} (${env.nodeEnv})`);
      console.log(`[startup] Allowed CORS origins: ${env.corsOrigins.join(", ")}`);
    });

    return server;
  } catch (err) {
    console.error("SERVER START ERROR:", err);
    process.exit(1);
  }
};

if (require.main === module) {
  void startServer();
}

module.exports = {
  app,
  startServer,
};
