import AppLayout from "@/components/AppLayout";
import PositionStrategyView from "@/components/PositionStrategyView";
import AssetClassView from "@/components/AssetClassView";
import DetailedPositionsTable from "@/components/DetailedPositionsTable";
import HoldingsView from "@/components/HoldingsView";
import PositionsSummary from "@/components/PositionsSummary";
import { usePositions } from "@/hooks/usePositions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Loader2 } from "lucide-react";

const Positions = () => {
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
            <DetailedPositionsTable positions={positions} loading={loading} />
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
