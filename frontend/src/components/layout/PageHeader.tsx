import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { NAV_ITEMS } from "./navItems";

interface PageHeaderProps {
  // Defaults to the description of the current page in navItems.ts.
  description?: string;
  actions?: ReactNode;
}

function PageHeader({ description, actions }: PageHeaderProps) {
  const { pathname } = useLocation();
  const text = description ?? NAV_ITEMS.find((item) => item.to === pathname)?.description;

  return (
    <div className="page-header">
      {text && <p className="page-description">{text}</p>}
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export default PageHeader;
