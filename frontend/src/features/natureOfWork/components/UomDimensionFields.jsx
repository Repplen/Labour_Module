import { FORMULA_TYPES } from "../helpers/natureOfWork.helpers";

const NumberField = ({ errors, label, name, onUpdateField, value }) => (
  <div className="col-md-4">
    <label className="form-label">{label}</label>
    <input
      className={`form-control ${errors[name] ? "is-invalid" : ""}`}
      min="0"
      step="0.001"
      type="number"
      value={value}
      onChange={(event) => onUpdateField(name, event.target.value)}
    />
    {errors[name] ? <div className="invalid-feedback">{errors[name]}</div> : null}
  </div>
);

export default function UomDimensionFields({ errors, formState, onUpdateField, selectedUom }) {
  if (!selectedUom) return null;

  const formulaType = selectedUom.formulaType;

  return (
    <div className="row g-3">
      {formulaType === FORMULA_TYPES.CUSTOM ? (
        <div className="col-md-6">
          <label className="form-label">Custom UOM Name</label>
          <input
            className={`form-control ${errors.customUomName ? "is-invalid" : ""}`}
            value={formState.customUomName}
            onChange={(event) => onUpdateField("customUomName", event.target.value)}
          />
          {errors.customUomName ? <div className="invalid-feedback">{errors.customUomName}</div> : null}
        </div>
      ) : null}

      {[FORMULA_TYPES.LENGTH_BREADTH_HEIGHT, FORMULA_TYPES.LENGTH_BREADTH, FORMULA_TYPES.LENGTH].includes(formulaType) ? (
        <NumberField errors={errors} label="Length" name="length" value={formState.length} onUpdateField={onUpdateField} />
      ) : null}
      {[FORMULA_TYPES.LENGTH_BREADTH_HEIGHT, FORMULA_TYPES.LENGTH_BREADTH].includes(formulaType) ? (
        <NumberField errors={errors} label="Breadth" name="breadth" value={formState.breadth} onUpdateField={onUpdateField} />
      ) : null}
      {formulaType === FORMULA_TYPES.LENGTH_BREADTH_HEIGHT ? (
        <NumberField errors={errors} label="Height" name="height" value={formState.height} onUpdateField={onUpdateField} />
      ) : null}
      {[FORMULA_TYPES.QUANTITY, FORMULA_TYPES.CUSTOM].includes(formulaType) ? (
        <NumberField errors={errors} label="Quantity" name="quantity" value={formState.quantity} onUpdateField={onUpdateField} />
      ) : null}
      {formulaType === FORMULA_TYPES.CUSTOM ? (
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea
            className="form-control"
            rows="2"
            value={formState.outturnDescription}
            onChange={(event) => onUpdateField("outturnDescription", event.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
