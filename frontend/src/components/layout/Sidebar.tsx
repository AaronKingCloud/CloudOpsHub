import { NavLink } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import { USE_MOCK } from "../../services/apiClient";
import Icon from "./Icon";
import { NAV_ITEMS } from "./navItems";

interface SidebarProps {
  open: boolean;
  onNavigate: () => void;
}

function Sidebar({ open, onNavigate }: SidebarProps) {
  const { hasRole } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.roles || hasRole(item.roles));

  return (
    <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
      <div className="sidebar-brand">
        <Icon name="logo" size={22} />
        <span>CloudOps Hub</span>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            onClick={onNavigate}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className={`mode-dot ${USE_MOCK ? "mock" : "live"}`} />
        {USE_MOCK ? "Mock data mode" : "Live backend"}
      </div>
    </aside>
  );
}

export default Sidebar;
