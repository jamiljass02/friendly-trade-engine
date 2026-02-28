import AppLayout from "@/components/AppLayout";
import PositionStrategyView from "@/components/PositionStrategyView";
import AssetClassView from "@/components/AssetClassView";
import DetailedPositionsTable from "@/components/DetailedPositionsTable";
import HoldingsView from "@/components/HoldingsView";
import PositionsSummary from "@/components/PositionsSummary";
import { usePositions } from "@/hooks/usePositions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Loader2, AlertTriangle, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const Positions = () => {
  const { positions, loading, alerts, autoRefresh, setAutoRefresh, dismissAlert, refresh } = usePositions();

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
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors border",
                autoRefresh
                  ? "bg-success/10 border-success/30 text-profit"
                  : "bg-muted border-border/50 text-muted-foreground"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", autoRefresh ? "bg-profit animate-pulse" : "bg-muted-foreground")} />
              {autoRefresh ? "LIVE" : "Paused"}
            </button>
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
          </div>
        </div>

        {/* Alerts Banner */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-xl border",
                  alert.severity === "critical"
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-warning/10 border-warning/30"
                )}
              >
                <div className="flex items-center gap-2.5">
                  {alert.type === "margin" ? (
                    <AlertTriangle className={cn("w-4 h-4 shrink-0", alert.severity === "critical" ? "text-loss" : "text-warning")} />
                  ) : (
                    <Clock className={cn("w-4 h-4 shrink-0", alert.severity === "critical" ? "text-loss" : "text-warning")} />
                  )}
                  <span className={cn("text-xs font-medium", alert.severity === "critical" ? "text-loss" : "text-warning")}>
                    {alert.message}
                  </span>
                </div>
                <button onClick={() => dismissAlert(alert.id)} className="p-1 rounded hover:bg-muted/50 transition-colors">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        <PositionsSummary positions={positions} loading={loading} />

        <Tabs defaultValue="strategy" className="w-full">
          <TabsList className="bg-muted/80 backdrop-blur-sm w-full justify-start gap-0.5 h-auto p-1 rounded-xl">
            <TabsTrigger value="strategy" className="text-[11px] px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Strategy View
            </TabsTrigger>
            <TabsTrigger value="asset-class" className="text-[11px] px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Asset Class
            </TabsTrigger>
            <TabsTrigger value="positions" className="text-[11px] px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Positions
            </TabsTrigger>
            <TabsTrigger value="holdings" className="text-[11px] px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Holdings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strategy" className="mt-4">
            <PositionStrategyView positions={positions} loading={loading} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="asset-class" className="mt-4">
            <AssetClassView positions={positions} loading={loading} />
          </TabsContent>

          <TabsContent value="positions" className="mt-4">
            <DetailedPositionsTable positions={positions} loading={loading} onRefresh={refresh} />
          </TabsContent>

          <TabsContent value="holdings" className="mt-4">
            <HoldingsView positions={positions} loading={loading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Positions;
