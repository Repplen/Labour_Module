import SiteForm from "../../components/masters/sites/SiteForm";
import SiteHeader from "../../components/masters/sites/SiteHeader";
import SiteTable from "../../components/masters/sites/SiteTable";
import SubSiteManager from "../../components/masters/sites/SubSiteManager";
import { useSiteMaster } from "../../hooks/sites/useSiteMaster";

export default function SiteMaster() {
  const {
    siteForm,
    sitesTable,
    summary,
    subSiteManager,
  } = useSiteMaster();

  return (
    <div className="container mt-4 mb-5">
      <SiteHeader
        siteCount={summary.siteCount}
        selectedHeadCount={summary.selectedHeadCount}
      />
      <SiteForm {...siteForm} />
      <SiteTable {...sitesTable} />
      <SubSiteManager {...subSiteManager} />
    </div>
  );
}
