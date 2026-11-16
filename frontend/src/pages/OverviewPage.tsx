import AccountList from "../components/AccountList";
import AlertsPanel from "../components/AlertsPanel";
import CostMonitorPanel from "../components/CostMonitorPanel";
import CpuChart from "../components/CpuChart";
import DeviceTable from "../components/DeviceTable";
import PageHeader from "../components/layout/PageHeader";
import ResourceCharts from "../components/ResourceCharts";
import RoleBanner from "../components/RoleBanner";
import SummaryCards from "../components/SummaryCards";

// Layout follows docs/architecture/dashboard-design.md
function OverviewPage() {
  return (
    <>
      <PageHeader />
      <RoleBanner />
      <SummaryCards />

      <div className="grid-2">
        <CpuChart />
        <AlertsPanel />
      </div>

      <ResourceCharts />
      <DeviceTable />
      <AccountList />
      <CostMonitorPanel />
    </>
  );
}

export default OverviewPage;
