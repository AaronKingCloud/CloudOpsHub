import { useTheme, type ThemeChoice } from "../../hooks/useTheme";
import UserNav from "../UserNav";
import Icon, { type IconName } from "./Icon";

const THEME_BUTTON: Record<ThemeChoice, { icon: IconName; label: string }> = {
  system: { icon: "monitor", label: "System theme" },
  light: { icon: "sun", label: "Light theme" },
  dark: { icon: "moon", label: "Dark theme" },
};

interface TopBarProps {
  title: string;
  onMenuClick: () => void;
}

function TopBar({ title, onMenuClick }: TopBarProps) {
  const { theme, cycleTheme } = useTheme();
  const themeButton = THEME_BUTTON[theme];

  return (
    <header className="topbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenuClick} aria-label="Open navigation">
        <Icon name="menu" />
      </button>

      <h1 className="topbar-title">{title}</h1>

      <div className="topbar-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={cycleTheme}
          title={`${themeButton.label} (click to change)`}
          aria-label={`${themeButton.label}, click to change`}
        >
          <Icon name={themeButton.icon} />
        </button>
        <UserNav />
      </div>
    </header>
  );
}

export default TopBar;
