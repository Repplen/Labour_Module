import FilterDropdown from "../FilterDropdown";

const STATUS_OPTIONS = [
  { value: "", label: "All tasks" },
  { value: "pending", label: "Pending tasks" },
  { value: "completed", label: "Completed tasks" },
];

const REMINDER_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "one_time", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function OwnTaskFilterBar({
  clearFilters,
  hasFilters,
  reminderTypeFilter,
  search,
  setReminderTypeFilter,
  setSearch,
  setStatusFilter,
  statusFilter,
}) {
  return (
    <div className="filter-card mb-4">
      <div className="list-toolbar">
        <div>
          <h6 className="mb-1">Own & Shared Task List</h6>
          <div className="form-help">
            Review tasks you created and tasks assigned to you, then filter for pending or completed work.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={clearFilters}
          disabled={!hasFilters}
        >
          Clear Filters
        </button>
      </div>

      <div className="row g-2 mt-1">
        <div className="col-md-6">
          <input
            className="form-control"
            placeholder="Search by title or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="col-md-3">
          <FilterDropdown
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>

        <div className="col-md-3">
          <FilterDropdown
            options={REMINDER_TYPE_OPTIONS}
            value={reminderTypeFilter}
            onChange={setReminderTypeFilter}
          />
        </div>
      </div>
    </div>
  );
}
