export default function DetailField({ label, value }) {
  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className="own-tasks-detail-field">
        <div className="small text-muted mb-1 own-tasks-detail-field__label">{label}</div>
        <div className="fw-semibold own-tasks-detail-field__value">{value || "-"}</div>
      </div>
    </div>
  );
}
