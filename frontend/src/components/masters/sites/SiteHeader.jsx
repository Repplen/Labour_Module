export default function SiteHeader({ siteCount, selectedHeadCount }) {
  return (
    <div className="page-intro-card mb-4">
      <div className="list-toolbar">
        <div>
          <div className="page-kicker">Masters</div>
          <h3 className="mb-1">Site Master</h3>
          <p className="page-subtitle mb-0">
            Maintain site mappings, site heads, leads, and nested sub-site levels.
          </p>
        </div>

        <div className="list-summary">
          <span className="summary-chip">{siteCount} sites</span>
          <span className="summary-chip summary-chip--neutral">
            {selectedHeadCount} heads selected
          </span>
        </div>
      </div>
    </div>
  );
}
