import DeviceTable from "../components/DeviceTable";
import PageHeader from "../components/layout/PageHeader";
import RefreshControl from "../components/RefreshControl";
import ResourceUsageChart from "../components/ResourceUsageChart";

function DevicesPage() {
  return (
    <>
      <PageHeader actions={<RefreshControl />} />
      <DeviceTable showControls />
      <ResourceUsageChart />
    </>
  );
}

export default DevicesPage;
