import AccountList from "../components/AccountList";
import AlertsPanel from "../components/AlertsPanel";
import CpuChart from "../components/CpuChart";
import DeviceTable from "../components/DeviceTable";
import PageHeader from "../components/layout/PageHeader";
import RefreshControl from "../components/RefreshControl";
import ResourceUsageChart from "../components/ResourceUsageChart";
import RoleBanner from "../components/RoleBanner";
import SummaryCards from "../components/SummaryCards";

// Layout follows docs/architecture/dashboard-design.md
function OverviewPage() {
  return (
    <>
      <PageHeader actions={<RefreshControl />} />
      <RoleBanner />
      <SummaryCards />

      <div className="grid-2">
        <CpuChart />
        <AlertsPanel />
      </div>

      <ResourceUsageChart />
      <DeviceTable />
      <AccountList />
    </>
  );
}

export default OverviewPage;
