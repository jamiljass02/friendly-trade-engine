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

      {/* Sidebar: hidden on mobile unless open */}
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
        {/* Top bar with ticker */}
        <div className="sticky top-0 z-30">
          <div className="flex items-center bg-card/80 backdrop-blur-md border-b border-border">
            {isMobile && (
              <button
                onClick={() => setMobileOpen(true)}
                className="p-3 text-muted-foreground hover:text-foreground"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <TickerTape />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
