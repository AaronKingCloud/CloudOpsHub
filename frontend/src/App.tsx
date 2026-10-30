import AccountList from "./components/AccountList";
import AlertsPanel from "./components/AlertsPanel";
import CpuChart from "./components/CpuChart";
import DeviceTable from "./components/DeviceTable";
import RoleBanner from "./components/RoleBanner";
import SummaryCards from "./components/SummaryCards";
import UserNav from "./components/UserNav";
import { AuthProvider } from "./context/AuthProvider";
import { USE_MOCK } from "./services/apiClient";

// Layout follows docs/architecture/dashboard-design.md
function App() {
  return (
    <AuthProvider>
      <header className="app-header">
        <div className="header-brand">
          <h1>CloudOps Hub</h1>
          <span className="subtitle">{USE_MOCK ? "Mock data mode" : "Live data"}</span>
        </div>
        <UserNav />
      </header>

      <main className="dashboard">
        <RoleBanner />
        <SummaryCards />

        <div className="grid-2">
          <CpuChart />
          <AlertsPanel />
        </div>

        <DeviceTable />
        <AccountList />
      </main>
    </AuthProvider>
  );
}

export default App;
