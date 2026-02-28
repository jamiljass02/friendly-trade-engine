import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import PositionsTable from "@/components/PositionsTable";
import PositionStrategyView from "@/components/PositionStrategyView";
import { cn } from "@/lib/utils";

type ViewMode = "table" | "strategy";

const Positions = () => {
  const [view, setView] = useState<ViewMode>("strategy");

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Positions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track and manage your open positions
            </p>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView("strategy")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                view === "strategy"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Strategy View
            </button>
            <button
              onClick={() => setView("table")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors",
                view === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Table View
            </button>
          </div>
        </div>
        {view === "strategy" ? <PositionStrategyView /> : <PositionsTable />}
      </div>
    </AppLayout>
  );
};

export default Positions;
