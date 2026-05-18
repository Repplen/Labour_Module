export default function OwnTaskFilterBar({
  clearFilters,
  hasFilters,
  search,
  setSearch,
  setStatusFilter,
  statusFilter,
}) {
  return (
    <div className="filter-card mb-4 own-tasks-filter-card">
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
        <div className="col-md-8">
          <input
            className="form-control"
            placeholder="Search by title or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="col-md-4">
          <select
            className="form-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All tasks</option>
            <option value="pending">Pending tasks</option>
            <option value="completed">Completed tasks</option>
          </select>
        </div>
      </div>
    </div>
  );
}
