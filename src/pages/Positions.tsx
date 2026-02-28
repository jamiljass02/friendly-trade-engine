import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import PositionsTable from "@/components/PositionsTable";
import PositionStrategyView from "@/components/PositionStrategyView";
import PositionsSummary from "@/components/PositionsSummary";
import { usePositions } from "@/hooks/usePositions";
import { cn } from "@/lib/utils";
import { RefreshCw, Loader2 } from "lucide-react";

type ViewMode = "table" | "strategy";

const Positions = () => {
  const [view, setView] = useState<ViewMode>("strategy");
  const { positions, loading, refresh } = usePositions();

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Holdings & Positions</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comprehensive view of your portfolio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
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
        </div>

        {/* Summary Dashboard */}
        <PositionsSummary positions={positions} loading={loading} />

        {/* Positions View */}
        {view === "strategy" ? (
          <PositionStrategyView positions={positions} loading={loading} onRefresh={refresh} />
        ) : (
          <PositionsTable />
        )}
      </div>
    </AppLayout>
  );
};

export default Positions;
