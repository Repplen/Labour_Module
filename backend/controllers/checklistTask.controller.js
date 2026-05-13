const ChecklistTask = require("../models/ChecklistTask");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value) => String(value || "").trim();

const isEmployeeRequester = (user) =>
  String(user?.role || "").trim().toLowerCase() === "employee";

const parseDateBoundary = (value, boundary = "start") => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return null;

  const timePart = boundary === "end" ? "23:59:59.999" : "00:00:00.000";
  const parsed = new Date(`${normalizedValue}T${timePart}+05:30`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
};

const buildYourChecklistFilter = (query = {}) => {
  const search = normalizeText(query.search);
  const status = normalizeText(query.status).toLowerCase();
  const scheduleType = normalizeText(query.scheduleType).toLowerCase();
  const fromDate = parseDateBoundary(query.fromDate || query.dateFrom, "start");
  const toDate = parseDateBoundary(query.toDate || query.dateTo, "end");
  const filter = {};

  if (search) {
    filter.$or = [
      { checklistNumber: { $regex: escapeRegex(search), $options: "i" } },
      { checklistName: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  if (status) {
    filter.status = status;
  }

  if (scheduleType) {
    filter.scheduleType = scheduleType;
  }

  if (fromDate || toDate) {
    filter.occurrenceDate = {};
    if (fromDate) filter.occurrenceDate.$gte = fromDate;
    if (toDate) filter.occurrenceDate.$lte = toDate;
  }

  return filter;
};

const mapYourChecklistTask = (task = {}) => ({
  _id: task._id,
  checklistNumber: task.checklistNumber || "",
  checklistName: task.checklistName || "",
  startDateTime: task.occurrenceDate || null,
  endDateTime: task.endDateTime || null,
  scheduleType: task.scheduleType || "",
  repeatSummary: task.repeatSummary || "",
  status: task.status || "",
});

exports.getYourChecklist = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view your checklist" });
    }

    const filter = {
      ...buildYourChecklistFilter(req.query),
      assignedEmployee: req.user.id,
    };

    const tasks = await ChecklistTask.find(
      filter,
      "checklistNumber checklistName occurrenceDate endDateTime scheduleType repeatSummary status"
    )
      .sort({ occurrenceDate: -1, createdAt: -1 })
      .lean();

    return res.json({
      tasks: tasks.map(mapYourChecklistTask),
    });
  } catch (err) {
    console.error("GET YOUR CHECKLIST ERROR:", err);
    return res.status(500).json({ message: "Failed to load your checklist" });
  }
};
