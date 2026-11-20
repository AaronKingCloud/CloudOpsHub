import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import DeviceFormDialog from "../components/devices/DeviceFormDialog";
import DeviceTable from "../components/DeviceTable";
import PageHeader from "../components/layout/PageHeader";
import RefreshControl from "../components/RefreshControl";
import ResourceUsageChart from "../components/ResourceUsageChart";
import { useAuth } from "../hooks/useAuth";
import "../styles/devices.css";

function DevicesPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [adding, setAdding] = useState(false);
  // Set by the device page after a delete, shown once.
  const [deleted] = useState(() => (location.state as { deleted?: string } | null)?.deleted);
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  return (
    <>
      <PageHeader
        actions={
          <>
            <RefreshControl />
            {can("manageDevices") && (
              <button type="button" className="btn primary" onClick={() => setAdding(true)}>
                + Add device
              </button>
            )}
          </>
        }
      />
      {deleted && (
        <div className="notice ok" role="status">
          <p className="notice-title">Deleted {deleted}.</p>
        </div>
      )}
      <DeviceTable showControls />
      <ResourceUsageChart />

      {adding && (
        <DeviceFormDialog
          onClose={() => setAdding(false)}
          // Open the new device so its agent key (shown once) and setup steps are right there.
          onSaved={(device, agentKey) => navigate(`/devices/${device.id}`, { state: { agentKey } })}
        />
      )}
    </>
  );
}

export default DevicesPage;
