import MainLocationStatusBadge from "./MainLocationStatusBadge";
import { getSiteLabel, nodeHasChildren } from "../helpers/mainLocation.helpers";

export default function MainLocationViewModal({ location, onClose }) {
  if (!location) return null;

  return (
    <div className="main-location-modal-backdrop" role="dialog" aria-modal="true">
      <div className="main-location-modal">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">{location.locationName}</h5>
            <div className="small text-muted">{location.path}</div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <div className="row g-3">
          <div className="col-md-6 detail-field">
            <div className="detail-field__label">Site</div>
            <div className="detail-field__value">{getSiteLabel(location.siteId)}</div>
          </div>
          <div className="col-md-6 detail-field">
            <div className="detail-field__label">Parent</div>
            <div className="detail-field__value">
              {location.parentLocationId?.locationName || "-"}
            </div>
          </div>
          <div className="col-md-6 detail-field">
            <div className="detail-field__label">Level</div>
            <div className="detail-field__value">Level {location.level}</div>
          </div>
          <div className="col-md-6 detail-field">
            <div className="detail-field__label">Status</div>
            <div className="detail-field__value">
              <MainLocationStatusBadge isActive={location.isActive} />
            </div>
          </div>
          <div className="col-md-6 detail-field">
            <div className="detail-field__label">Has Children</div>
            <div className="detail-field__value">{nodeHasChildren(location) ? "Yes" : "No"}</div>
          </div>
          <div className="col-12 detail-field">
            <div className="detail-field__label">Full Path</div>
            <div className="detail-field__value">{location.path}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
