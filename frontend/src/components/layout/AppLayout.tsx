import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import "../../styles/shell.css";
import { NAV_ITEMS } from "./navItems";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

// Page frame: sidebar on the left, top bar above the current page (<Outlet />).
// On small screens the sidebar becomes a slide-in drawer opened from the top bar.
function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const title = NAV_ITEMS.find((item) => item.to === pathname)?.label ?? "CloudOps Hub";

  return (
    <div className="app-shell">
      <Sidebar open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />
      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}

      <div className="app-main">
        <TopBar title={title} onMenuClick={() => setDrawerOpen(true)} />
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
