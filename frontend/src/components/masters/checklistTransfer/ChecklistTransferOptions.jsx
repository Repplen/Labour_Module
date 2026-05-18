export default function ChecklistTransferOptions({ activeOption, onOptionOpen }) {
  return (
    <div className="soft-card mb-4">
      <div className="mb-3">
        <h5 className="mb-1">Transfer Options</h5>
        <div className="form-help">
          Choose the transfer action you want to perform inside this module.
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <button
            type="button"
            className={`btn w-100 text-start p-3 ${
              activeOption === "permanent" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => onOptionOpen("permanent")}
          >
            <div className="fw-semibold">Permanent Transfer</div>
            <div className={activeOption === "permanent" ? "text-white-50" : "text-muted"}>
              Move selected checklist masters from one employee to another and
              keep the workflow configuration intact.
            </div>
          </button>
        </div>

        <div className="col-lg-4">
          <button
            type="button"
            className={`btn w-100 text-start p-3 ${
              activeOption === "temporary" ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => onOptionOpen("temporary")}
          >
            <div className="fw-semibold">Temporary Transfer</div>
            <div className={activeOption === "temporary" ? "text-white-50" : "text-muted"}>
              Move selected checklist masters only for a selected date range
              and automatically revert them back to the original employee
              after the end date.
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
