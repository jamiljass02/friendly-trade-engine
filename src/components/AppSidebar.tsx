import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  GitBranch,
  BarChart3,
  ClipboardList,
  Settings,
  Zap,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useBroker } from "@/hooks/useBroker";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: GitBranch, label: "Strategies", path: "/strategies" },
  { icon: ClipboardList, label: "Positions", path: "/positions" },
  { icon: BarChart3, label: "Options Chain", path: "/options" },
  { icon: Activity, label: "Orders", path: "/orders" },
];

const AppSidebar = () => {
  const location = useLocation();
  const { isConnected, status } = useBroker();

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

      {/* Broker Status */}
      <div className="px-5 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-profit animate-pulse" : "bg-muted-foreground"}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? "Shoonya Connected" : "Broker Disconnected"}
          </span>
        </div>
        {isConnected && status?.user_code && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] font-mono text-primary">{status.user_code}</span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-profit" />
            <span className="text-xs font-mono text-profit">NIFTY 24,150</span>
          </div>
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
