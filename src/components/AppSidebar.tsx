import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  BarChart3,
  ClipboardList,
  Settings,
  Zap,
  Activity,
  Sun,
  Moon,
  TrendingUp,
  LineChart,
  Briefcase,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useBroker } from "@/hooks/useBroker";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: GitBranch, label: "Strategy Builder", path: "/strategies" },
  { icon: BarChart3, label: "Option Chain", path: "/options" },
  { icon: TrendingUp, label: "Futures", path: "/futures" },
  { icon: ClipboardList, label: "Positions", path: "/positions" },
  { icon: Briefcase, label: "Holdings", path: "/holdings" },
  { icon: Zap, label: "Risk Manager", path: "/risk" },
  { icon: Activity, label: "Orders", path: "/orders" },
  { icon: LineChart, label: "Analytics", path: "/analytics" },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const location = useLocation();
  const { isConnected, session } = useBroker();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo + Collapse */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-sidebar-border">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center w-full")}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-foreground tracking-wide">TradeX</h1>
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Pro</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Broker Status */}
      {!collapsed && (
        <div className="px-4 py-2.5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isConnected ? "bg-profit animate-pulse" : "bg-muted-foreground"
              )}
            />
            <span className="text-[10px] text-muted-foreground truncate">
              {isConnected ? "Shoonya Connected" : "Broker Disconnected"}
            </span>
          </div>
          {isConnected && session?.userCode && (
            <span className="text-[10px] font-mono text-primary mt-0.5 block">{session.userCode}</span>
          )}
        </div>
      )}

      {collapsed && (
        <div className="flex justify-center py-2.5 border-b border-sidebar-border">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-profit animate-pulse" : "bg-muted-foreground"
            )}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm transition-all duration-200 group",
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                isActive
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              {!collapsed && <span className="font-medium truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={toggleTheme}
          title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
          )}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-warning shrink-0" />
          ) : (
            <Moon className="w-4 h-4 text-primary shrink-0" />
          )}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        <Link
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-lg text-sm transition-colors",
            collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
            location.pathname === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <Settings className="w-4 h-4 text-muted-foreground shrink-0" />
          {!collapsed && <span className="text-xs">Settings</span>}
        </Link>

        {collapsed && (
          <button
            onClick={onToggle}
            className="flex items-center justify-center w-full px-2 py-2.5 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        {!collapsed && (
          <div className="px-3 pt-1">
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
              {isConnected ? "Live Trading" : "Paper Trading"}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
