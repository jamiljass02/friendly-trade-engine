import { useState } from "react";
import AppSidebar from "./AppSidebar";
import TickerTape from "./TickerTape";
import { cn } from "@/lib/utils";
import { Menu, Sun, Moon, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

const assetClasses = [
  { label: "Index Options", path: "/options", icon: "📊" },
  { label: "Stock Options", path: "/options", icon: "📈" },
  { label: "Index Futures", path: "/futures", icon: "⚡" },
  { label: "Stock Futures", path: "/futures", icon: "🔥" },
  { label: "Holdings", path: "/holdings", icon: "💼" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        isMobile && !mobileOpen && "hidden",
        isMobile && mobileOpen && "block"
      )}>
        <AppSidebar
          collapsed={isMobile ? false : collapsed}
          onToggle={() => isMobile ? setMobileOpen(false) : setCollapsed((p) => !p)}
        />
      </div>

      {/* Main */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300",
          isMobile ? "ml-0" : collapsed ? "ml-16" : "ml-60"
        )}
      >
        {/* Header bar */}
        <div className="sticky top-0 z-30">
          {/* Controls row */}
          <div className="flex items-center justify-between bg-card/90 backdrop-blur-md border-b border-border px-3 py-1.5">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button
                  onClick={() => setMobileOpen(true)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}

              {/* Asset Class Quick Switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors">
                  <span>Quick Switch</span>
                  <ChevronDown className="w-3 h-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {assetClasses.map((ac) => (
                    <DropdownMenuItem
                      key={ac.label}
                      onClick={() => navigate(ac.path)}
                      className="text-xs gap-2 cursor-pointer"
                    >
                      <span>{ac.icon}</span>
                      <span>{ac.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors"
                title={theme === "dark" ? "Switch to Light" : "Switch to Dark"}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-warning" />
                ) : (
                  <Moon className="w-4 h-4 text-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Ticker tape */}
          <TickerTape />
        </div>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
