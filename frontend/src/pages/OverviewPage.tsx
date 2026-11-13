import AccountList from "../components/AccountList";
import AlertsPanel from "../components/AlertsPanel";
import CpuChart from "../components/CpuChart";
import DeviceTable from "../components/DeviceTable";
import PageHeader from "../components/layout/PageHeader";
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

      <DeviceTable />
      <AccountList />
    </>
  );
}

export default OverviewPage;
