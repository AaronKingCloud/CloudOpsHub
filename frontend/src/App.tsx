import AccountList from "./components/AccountList";
import AlertsPanel from "./components/AlertsPanel";
import CpuChart from "./components/CpuChart";
import DeviceTable from "./components/DeviceTable";
import SummaryCards from "./components/SummaryCards";
import { USE_MOCK } from "./services/apiClient";

// Layout follows docs/architecture/dashboard-design.md
function App() {
  return (
    <>
      <header className="app-header">
        <h1>CloudOps Hub</h1>
        <span className="subtitle">{USE_MOCK ? "Mock data mode" : "Live data"}</span>
      </header>

      <main className="dashboard">
        <SummaryCards />

        <div className="grid-2">
          <CpuChart />
          <AlertsPanel />
        </div>

        <DeviceTable />
        <AccountList />
      </main>
    </>
  );
}

export default App;
