export default function OwnTasksHeader({
  activeFilterPills,
  notificationPermission,
  notificationPermissionLabel,
  requestBrowserNotifications,
  stats,
}) {
  return (
    <div className="page-intro-card mb-4">
      <div className="list-toolbar">
        <div>
          <div className="page-kicker">User Panel</div>
          <h3 className="mb-1">Own & Shared Tasks</h3>
          <div className="page-subtitle">
            Create reminders for yourself, or share a task with another employee. These
            tasks do not use marks, approvals, or checklist workflow.
          </div>

          {activeFilterPills.length ? (
            <div className="employee-directory-filter-pills mt-3">
              {activeFilterPills.map((pill) => (
                <span key={pill} className="employee-directory-filter-pill">
                  {pill}
                </span>
              ))}
            </div>
          ) : (
            <div className="form-help mt-3">
              Build reminders, monitor due work, and jump into any shared task from one place.
            </div>
          )}
        </div>

        <div className="d-flex flex-wrap gap-2 align-items-start">
          <span className="summary-chip summary-chip--neutral">
            {notificationPermissionLabel}
          </span>
          {notificationPermission === "default" ? (
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={requestBrowserNotifications}
            >
              Enable Browser Alerts
            </button>
          ) : null}
        </div>
      </div>

      <div className="page-stats-row mt-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`page-stat-card ${stat.accentClass}`}>
            <div className="page-stat-card__label">{stat.label}</div>
            <div className="page-stat-card__value">{stat.value}</div>
            <div className="page-stat-card__meta">{stat.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
