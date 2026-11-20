import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { navItemFor } from "./navItems";

interface PageHeaderProps {
  // Defaults to the description of the current page in navItems.ts.
  description?: string;
  actions?: ReactNode;
}

function PageHeader({ description, actions }: PageHeaderProps) {
  const { pathname } = useLocation();
  const text = description ?? navItemFor(pathname)?.description;

  return (
    <div className="page-header">
      {text && <p className="page-description">{text}</p>}
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export default PageHeader;
