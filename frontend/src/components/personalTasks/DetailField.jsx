export default function DetailField({ label, value }) {
  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className="detail-field">
        <div className="detail-field__label">{label}</div>
        <div className="detail-field__value">{value || "-"}</div>
      </div>
    </div>
  );
}
