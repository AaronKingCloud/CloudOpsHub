import { useApi } from "../hooks/useApi";
import { getDevices } from "../services/dashboardService";
import { deviceTone, usageTone } from "../utils/status";
import StatusBadge from "./StatusBadge";

function UsageBar({ percent }: { percent: number }) {
  return (
    <div className="usage">
      <div className="usage-track">
        <div className={`usage-fill ${usageTone(percent)}`} style={{ width: `${percent}%` }} />
      </div>
      {percent}%
    </div>
  );
}

function DeviceTable() {
  const { data: devices, loading, error } = useApi(getDevices);

  return (
    <section className="panel">
      <h2>Device Status</h2>
      {loading && <p className="state-message">Loading devices...</p>}
      {error && <p className="state-message">Could not load devices: {error}</p>}
      {devices && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hostname</th>
                <th>Status</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Storage</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>{device.hostname}</td>
                  <td>
                    <StatusBadge label={device.status} tone={deviceTone(device.status)} />
                  </td>
                  <td><UsageBar percent={device.cpu} /></td>
                  <td><UsageBar percent={device.memory} /></td>
                  <td><UsageBar percent={device.storage} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default DeviceTable;
