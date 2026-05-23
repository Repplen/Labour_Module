import { formatMoney } from "../helpers/labourPieceWorker.helpers";

export default function LabourPieceWorkerRateSummary({ rates }) {
  return (
    <>
      <div className="col-md-2">
        <label className="form-label">GST Amount</label>
        <input className="form-control" value={formatMoney(rates.gstAmount)} readOnly />
      </div>
      <div className="col-md-2">
        <label className="form-label">Gross Rate</label>
        <input className="form-control" value={formatMoney(rates.grossRate)} readOnly />
      </div>
      <div className="col-md-2">
        <label className="form-label">Net Rate</label>
        <input className="form-control" value={formatMoney(rates.netRate)} readOnly />
      </div>
    </>
  );
}
