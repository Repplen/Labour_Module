const {
  completePersonalTaskForEmployee,
  createPersonalTaskForEmployee,
  deletePersonalTaskForEmployee,
  getPersonalTaskForViewer,
  isEmployeeRequester,
  listPersonalTaskNotifications,
  listPersonalTasks,
  listShareableEmployees,
  markPersonalTaskNotificationReadForEmployee,
  sharePersonalTaskForEmployee,
  updatePersonalTaskForEmployee,
} = require("../services/personalTask.service");

const normalizeText = (value) => String(value || "").trim();

const requireEmployeeRequester = (req, res, message) => {
  if (isEmployeeRequester(req.user)) return true;

  res.status(403).json({ message });
  return false;
};

const sendServiceResult = (res, result, successStatus = 200) => {
  if (result?.status && result?.message) {
    return res.status(result.status).json({ message: result.message });
  }

  return res.status(successStatus).json(result);
};

exports.getMyPersonalTasks = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can view personal reminders"
      )
    ) {
      return;
    }

    const rows = await listPersonalTasks({
      employeeId: req.user.id,
      search: req.query?.search,
      status: req.query?.status,
    });

    return res.json(rows);
  } catch (err) {
    console.error("GET MY PERSONAL TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to load personal reminders" });
  }
};

exports.getPersonalTaskById = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can view personal reminders"
      )
    ) {
      return;
    }

    const task = await getPersonalTaskForViewer({
      taskId: req.params.id,
      employeeId: req.user.id,
    });

    if (!task) {
      return res.status(404).json({ message: "Personal reminder not found" });
    }

    return res.json(task);
  } catch (err) {
    console.error("GET PERSONAL TASK BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load personal reminder" });
  }
};

exports.getShareableEmployees = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can share personal reminders"
      )
    ) {
      return;
    }

    const rows = await listShareableEmployees({
      search: req.query?.search,
    });

    return res.json(rows);
  } catch (err) {
    console.error("GET SHAREABLE EMPLOYEES ERROR:", err);
    return res.status(500).json({ message: "Failed to load employees" });
  }
};

exports.createPersonalTask = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can create personal reminders"
      )
    ) {
      return;
    }

    const result = await createPersonalTaskForEmployee({
      body: req.body,
      employeeId: req.user.id,
      file: req.file,
    });

    if (result.message && !result.task) {
      return res.status(result.status || 400).json({ message: result.message });
    }

    return res.status(201).json({
      message: "Personal reminder created successfully",
      task: result.task,
    });
  } catch (err) {
    console.error("CREATE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to create personal reminder" });
  }
};

exports.sharePersonalTask = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can share personal reminders"
      )
    ) {
      return;
    }

    const result = await sharePersonalTaskForEmployee({
      taskId: req.params.id,
      employeeId: req.user.id,
      assignedEmployeeId: normalizeText(
        req.body?.assignedEmployeeId || req.body?.employeeId
      ),
    });

    return sendServiceResult(res, result);
  } catch (err) {
    console.error("SHARE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to share personal reminder" });
  }
};

exports.completePersonalTask = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can complete personal reminders"
      )
    ) {
      return;
    }

    const result = await completePersonalTaskForEmployee({
      taskId: req.params.id,
      employeeId: req.user.id,
    });

    return sendServiceResult(res, result);
  } catch (err) {
    console.error("COMPLETE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to complete personal reminder" });
  }
};

exports.markPersonalTaskNotificationRead = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can update reminder notifications"
      )
    ) {
      return;
    }

    const result = await markPersonalTaskNotificationReadForEmployee({
      taskId: req.params.id,
      employeeId: req.user.id,
    });

    return sendServiceResult(res, result);
  } catch (err) {
    console.error("MARK PERSONAL TASK NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Failed to update reminder notification" });
  }
};

exports.updatePersonalTask = async (req, res) => {
  try {
    if (!requireEmployeeRequester(req, res, "Only employees can update personal reminders")) {
      return;
    }

    const result = await updatePersonalTaskForEmployee({
      taskId: req.params.id,
      employeeId: req.user.id,
      body: req.body,
      file: req.file || null,
    });

    return sendServiceResult(res, result);
  } catch (err) {
    console.error("UPDATE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to update personal reminder" });
  }
};

exports.deletePersonalTask = async (req, res) => {
  try {
    if (!requireEmployeeRequester(req, res, "Only employees can delete personal reminders")) {
      return;
    }

    const result = await deletePersonalTaskForEmployee({
      taskId: req.params.id,
      employeeId: req.user.id,
    });

    return sendServiceResult(res, result);
  } catch (err) {
    console.error("DELETE PERSONAL TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to delete personal reminder" });
  }
};

exports.getMyPersonalTaskNotifications = async (req, res) => {
  try {
    if (
      !requireEmployeeRequester(
        req,
        res,
        "Only employees can view reminder notifications"
      )
    ) {
      return;
    }

    const result = await listPersonalTaskNotifications({
      employeeId: req.user.id,
    });

    return res.json(result);
  } catch (err) {
    console.error("GET PERSONAL TASK NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load reminder notifications" });
  }
};
