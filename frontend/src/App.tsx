import { BrowserRouter, Route, Routes } from "react-router";
import AppLayout from "./components/layout/AppLayout";
import { AuthProvider } from "./context/AuthProvider";
import AccountsPage from "./pages/AccountsPage";
import AlertsPage from "./pages/AlertsPage";
import CloudPage from "./pages/CloudPage";
import DevicesPage from "./pages/DevicesPage";
import NotFoundPage from "./pages/NotFoundPage";
import OverviewPage from "./pages/OverviewPage";
import UsersPage from "./pages/UsersPage";

// Every page renders inside AppLayout (sidebar + top bar).
// To add a page: create it in src/pages/, add a <Route> here and an entry in
// src/components/layout/navItems.ts.
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="cloud" element={<CloudPage />} />
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
