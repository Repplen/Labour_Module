import {
  EMPLOYEE_SKILL_TYPES,
  EMPLOYEE_WORK_TYPES,
  GST_OPTIONS,
  calculateEmployeeWorkRates,
  formatMoney,
  getNatureLabel,
  getRateTypesForEmployeeWorkType,
  getUomLabel,
} from "./employeeWork.helpers";

const FieldError = ({ message }) => (message ? <div className="invalid-feedback d-block">{message}</div> : null);

export default function EmployeeWorkFields({
  errors = {},
  form,
  natureOfWorks = [],
  onChange,
  uoms = [],
}) {
  const employeeWorkType = form.employeeWorkType || "General Employee";
  const isLabour = employeeWorkType === "Labour";
  const isPieceWorker = employeeWorkType === "Piece Worker";
  const showRateFields = isLabour || isPieceWorker;
  const rateTypes = getRateTypesForEmployeeWorkType(employeeWorkType);
  const topLevelNature = natureOfWorks.filter((work) => Number(work.level || 1) === 1);
  const selectedNature = natureOfWorks.find((work) => work._id === form.natureOfWorkId);
  const subNatureOptions = selectedNature
    ? natureOfWorks.filter((work) => work.path?.startsWith(`${selectedNature.path} /`))
    : natureOfWorks.filter((work) => Number(work.level || 1) > 1);
  const rates = calculateEmployeeWorkRates({
    standardRate: form.standardRate,
    gstApplicable: form.gstApplicable,
    gstPercent: form.gstPercent,
  });

  return (
    <div className="soft-card mt-3">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h5 className="mb-1">Employee Work Type</h5>
          <div className="form-help">General employees keep the existing employee process.</div>
        </div>
        <span className="summary-chip summary-chip--neutral">{employeeWorkType}</span>
      </div>

      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label">Employee Work Type</label>
          <select
            className="form-select"
            name="employeeWorkType"
            value={employeeWorkType}
            onChange={onChange}
          >
            {EMPLOYEE_WORK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        {isLabour ? (
          <div className="col-md-4">
            <label className="form-label">Skill / Work Nature</label>
            <select className={`form-select ${errors.skillType ? "is-invalid" : ""}`} name="skillType" value={form.skillType || ""} onChange={onChange}>
              <option value="">Select skill</option>
              {EMPLOYEE_SKILL_TYPES.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
            </select>
            <FieldError message={errors.skillType} />
          </div>
        ) : null}

        {showRateFields ? (
          <>
            <div className="col-md-4">
              <label className="form-label">Nature of Work{isLabour ? " (Optional)" : ""}</label>
              <select className={`form-select ${errors.natureOfWorkId ? "is-invalid" : ""}`} name="natureOfWorkId" value={form.natureOfWorkId || ""} onChange={onChange}>
                <option value="">Select nature</option>
                {(isPieceWorker ? topLevelNature : natureOfWorks).map((work) => <option key={work._id} value={work._id}>{getNatureLabel(work)}</option>)}
              </select>
              <FieldError message={errors.natureOfWorkId} />
            </div>

            {isPieceWorker ? (
              <div className="col-md-4">
                <label className="form-label">Sub Nature of Work</label>
                <select className="form-select" name="subNatureOfWorkId" value={form.subNatureOfWorkId || ""} onChange={onChange} disabled={!subNatureOptions.length}>
                  <option value="">Select sub nature</option>
                  {subNatureOptions.map((work) => <option key={work._id} value={work._id}>{getNatureLabel(work)}</option>)}
                </select>
              </div>
            ) : null}

            <div className="col-md-4">
              <label className="form-label">UOM{isLabour ? " (Optional)" : ""}</label>
              <select className={`form-select ${errors.uomId ? "is-invalid" : ""}`} name="uomId" value={form.uomId || ""} onChange={onChange}>
                <option value="">Select UOM</option>
                {uoms.map((uom) => <option key={uom._id} value={uom._id}>{getUomLabel(uom)}</option>)}
              </select>
              <FieldError message={errors.uomId} />
            </div>

            <div className="col-md-4">
              <label className="form-label">Rate Type</label>
              <select className={`form-select ${errors.rateType ? "is-invalid" : ""}`} name="rateType" value={form.rateType || ""} onChange={onChange}>
                <option value="">Select rate type</option>
                {rateTypes.map((rateType) => <option key={rateType} value={rateType}>{rateType}</option>)}
              </select>
              <FieldError message={errors.rateType} />
            </div>

            <div className="col-md-4">
              <label className="form-label">Standard Rate</label>
              <input className={`form-control ${errors.standardRate ? "is-invalid" : ""}`} name="standardRate" type="number" min="0" step="0.01" value={form.standardRate || ""} onChange={onChange} />
              <FieldError message={errors.standardRate} />
            </div>

            {isLabour ? (
              <div className="col-md-4">
                <label className="form-label">Overtime Rate</label>
                <input className={`form-control ${errors.overtimeRate ? "is-invalid" : ""}`} name="overtimeRate" type="number" min="0" step="0.01" value={form.overtimeRate || ""} onChange={onChange} />
                <FieldError message={errors.overtimeRate} />
              </div>
            ) : (
              <div className="col-md-4">
                <label className="form-label">Piece Rate</label>
                <input className={`form-control ${errors.pieceRate ? "is-invalid" : ""}`} name="pieceRate" type="number" min="0" step="0.01" value={form.pieceRate || ""} onChange={onChange} />
                <FieldError message={errors.pieceRate} />
              </div>
            )}

            <div className="col-md-4">
              <label className="form-label d-block">GST Applicable</label>
              <div className="d-flex gap-3">
                <label className="form-check">
                  <input className="form-check-input" type="radio" name="gstApplicable" checked={form.gstApplicable === true} onChange={() => onChange({ target: { name: "gstApplicable", value: true } })} />
                  <span className="form-check-label">Yes</span>
                </label>
                <label className="form-check">
                  <input className="form-check-input" type="radio" name="gstApplicable" checked={form.gstApplicable !== true} onChange={() => onChange({ target: { name: "gstApplicable", value: false } })} />
                  <span className="form-check-label">No</span>
                </label>
              </div>
            </div>

            {form.gstApplicable ? (
              <div className="col-md-4">
                <label className="form-label">GST %</label>
                <input className={`form-control ${errors.gstPercent ? "is-invalid" : ""}`} name="gstPercent" list="employee-work-gst-options" type="number" min="0" max="100" step="0.01" value={form.gstPercent || ""} onChange={onChange} />
                <datalist id="employee-work-gst-options">
                  {GST_OPTIONS.filter(Boolean).map((value) => <option key={value} value={value} />)}
                </datalist>
                <FieldError message={errors.gstPercent} />
              </div>
            ) : null}

            <div className="col-md-4">
              <label className="form-label">GST Amount</label>
              <input className="form-control" value={formatMoney(rates.gstAmount)} readOnly />
            </div>
            <div className="col-md-4">
              <label className="form-label">Gross Rate</label>
              <input className="form-control" value={formatMoney(rates.grossRate)} readOnly />
            </div>
            <div className="col-md-4">
              <label className="form-label">Net Rate</label>
              <input className="form-control" value={formatMoney(rates.netRate)} readOnly />
            </div>

            <div className="col-md-4">
              <label className="form-label">Effective From Date</label>
              <input className="form-control" name="rateEffectiveFrom" type="date" value={form.rateEffectiveFrom || ""} onChange={onChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Effective To Date</label>
              <input className="form-control" name="rateEffectiveTo" type="date" value={form.rateEffectiveTo || ""} onChange={onChange} />
            </div>
            <div className="col-12">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" name="rateRemarks" rows="2" value={form.rateRemarks || ""} onChange={onChange} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
