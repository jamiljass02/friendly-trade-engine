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
  TrendingDown,
} from "lucide-react";
import { useBroker } from "@/hooks/useBroker";
import { useIndexPrices } from "@/hooks/useIndexPrices";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: GitBranch, label: "Strategies", path: "/strategies" },
  { icon: ClipboardList, label: "Positions", path: "/positions" },
  { icon: BarChart3, label: "Options Chain", path: "/options" },
  { icon: TrendingUp, label: "Futures", path: "/futures" },
  { icon: Activity, label: "Orders", path: "/orders" },
];

const AppSidebar = () => {
  const location = useLocation();
  const { isConnected, session } = useBroker();
  const { prices } = useIndexPrices();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground tracking-wide">TradeX</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Execution Platform</p>
        </div>
      </div>

      {/* Broker Status + Live Prices */}
      <div className="px-5 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-profit animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? "Shoonya Connected" : "Broker Disconnected"}
          </span>
        </div>
        {isConnected && session?.userCode && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-mono text-primary">{session.userCode}</span>
          </div>
        )}

        {/* Live Index Prices */}
        <div className="mt-3 space-y-1.5">
          {prices.map((idx) => (
            <div key={idx.name} className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground">{idx.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-semibold text-foreground">
                  {idx.price > 0 ? idx.price.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—"}
                </span>
                {idx.price > 0 && (
                  <span className={cn(
                    "text-[9px] font-mono flex items-center gap-0.5",
                    idx.change >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {idx.change >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {idx.change >= 0 ? "+" : ""}{idx.changePercent.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                isActive
                  ? "bg-primary/10 text-primary glow-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 mb-3 px-3">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-warning" /> : <Moon className="w-4 h-4 text-primary" />}
            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            location.pathname === "/settings"
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent"
          }`}
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span>Settings</span>
        </Link>
        <div className="mt-3 px-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {isConnected ? "Live Trading" : "Paper Trading"}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
