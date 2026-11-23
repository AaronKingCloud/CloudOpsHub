import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { RefreshProvider } from "../../context/RefreshProvider";
import { useAuth } from "../../hooks/useAuth";
import { USE_MOCK } from "../../services/apiClient";
import "../../styles/shell.css";
import "../../styles/widgets.css";
import LoginPage from "../LoginPage";
import { navItemFor } from "./navItems";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

// Page frame: sidebar on the left, top bar above the current page (<Outlet />).
// On small screens the sidebar becomes a slide-in drawer opened from the top bar.
// RefreshProvider drives auto-refresh for every page's live data.
// When the backend requires login and nobody is signed in, the page area shows the sign-in form.
function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const { authRequired, isAuthenticated } = useAuth();
  const title = navItemFor(pathname)?.label ?? "CloudOps Hub";
  const mustSignIn = !USE_MOCK && authRequired && !isAuthenticated;

  return (
    <RefreshProvider>
      <div className="app-shell">
        <Sidebar open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />
        {drawerOpen && (
          <button
            type="button"
            className="drawer-backdrop"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        <div className="app-main">
          <TopBar title={title} onMenuClick={() => setDrawerOpen(true)} />
          <main className="page">
            {mustSignIn ? (
              <div className="login-container">
                <LoginPage />
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </div>
    </RefreshProvider>
  );
}

export default AppLayout;
