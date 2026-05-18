export default function OwnTasksHeader({
  activeFilterPills,
  notificationPermission,
  notificationPermissionLabel,
  requestBrowserNotifications,
  stats,
}) {
  return (
    <div className="page-intro-card mb-4 own-tasks-hero">
      <div className="list-toolbar">
        <div>
          <div className="page-kicker">User Panel</div>
          <h3 className="mb-1">Own & Shared Tasks</h3>
          <div className="page-subtitle">
            Create reminders for yourself, or share a task with another employee. These
            tasks do not use marks, approvals, or checklist workflow.
          </div>

          {activeFilterPills.length ? (
            <div className="own-tasks-filter-pills mt-3">
              {activeFilterPills.map((pill) => (
                <span key={pill} className="own-tasks-filter-pill">
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

        <div className="d-flex flex-wrap gap-2 align-items-start own-tasks-hero__actions">
          <span className="summary-chip summary-chip--neutral">
            {notificationPermissionLabel}
          </span>
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" ? (
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

      <div className="own-tasks-stats mt-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`own-tasks-stat-card ${stat.accentClass}`}>
            <div className="own-tasks-stat-card__label">{stat.label}</div>
            <div className="own-tasks-stat-card__value">{stat.value}</div>
            <div className="own-tasks-stat-card__meta">{stat.meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
