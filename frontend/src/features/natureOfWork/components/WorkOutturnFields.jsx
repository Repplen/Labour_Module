import { getUomLabel } from "../helpers/natureOfWork.helpers";

export default function WorkOutturnFields({
  errors,
  formState,
  onUpdateField,
  uoms,
}) {
  return (
    <>
      <div className="mb-3">
        <label className="form-label">Work Outturn Required</label>
        <div className="d-flex gap-3">
          <label className="form-check">
            <input
              className="form-check-input"
              type="radio"
              checked={formState.isWorkOutturnRequired === true}
              onChange={() => onUpdateField("isWorkOutturnRequired", true)}
            />
            <span className="form-check-label">Yes</span>
          </label>
          <label className="form-check">
            <input
              className="form-check-input"
              type="radio"
              checked={formState.isWorkOutturnRequired === false}
              onChange={() => onUpdateField("isWorkOutturnRequired", false)}
            />
            <span className="form-check-label">No</span>
          </label>
        </div>
      </div>

      {formState.isWorkOutturnRequired ? (
        <>
          <div className="mb-3">
            <label className="form-label">UOM</label>
            <select
              className={`form-select ${errors.uomId ? "is-invalid" : ""}`}
              value={formState.uomId}
              onChange={(event) => onUpdateField("uomId", event.target.value)}
            >
              <option value="">Select UOM</option>
              {uoms.map((uom) => (
                <option key={uom._id} value={uom._id}>
                  {getUomLabel(uom)} - {uom.formulaType}
                </option>
              ))}
            </select>
            {errors.uomId ? <div className="invalid-feedback">{errors.uomId}</div> : null}
          </div>
        </>
      ) : null}
    </>
  );
}
