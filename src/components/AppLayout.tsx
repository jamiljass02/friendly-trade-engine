import { useState } from "react";
import AppSidebar from "./AppSidebar";
import TickerTape from "./TickerTape";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

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
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
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
