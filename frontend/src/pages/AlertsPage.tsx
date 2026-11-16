import AlertsPanel from "../components/AlertsPanel";
import PageHeader from "../components/layout/PageHeader";
import RefreshControl from "../components/RefreshControl";

function AlertsPage() {
  return (
    <>
      <PageHeader actions={<RefreshControl />} />
      <AlertsPanel showFilter />
    </>
  );
}

export default AlertsPage;
