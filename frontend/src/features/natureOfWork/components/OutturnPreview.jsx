export default function OutturnPreview({ preview, selectedUom }) {
  if (!selectedUom) return null;

  return (
    <div className="nature-outturn-preview">
      <div className="small text-muted">Formula Preview</div>
      <div className="fw-semibold">{preview.text || "Enter measurements to calculate quantity."}</div>
      <div className="small text-muted">
        Total Quantity: {preview.totalQuantity || 0} {selectedUom.symbol || ""}
      </div>
    </div>
  );
}
