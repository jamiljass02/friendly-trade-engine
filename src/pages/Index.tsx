import AppLayout from "@/components/AppLayout";
import MetricCard from "@/components/MetricCard";
import PositionsTable from "@/components/PositionsTable";
import StrategyBuilder from "@/components/StrategyBuilder";
import { TrendingUp, Wallet, Target, BarChart3, Activity } from "lucide-react";

const Dashboard = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">22 Feb 2026 • NSE F&O Segment</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
              <Activity className="w-3 h-3 text-profit" />
              <span className="text-xs font-medium text-profit">Live</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total P&L"
            value="₹2,301"
            change="+3.2% today"
            changeType="profit"
            icon={TrendingUp}
          />
          <MetricCard
            title="Margin Used"
            value="₹1,85,400"
            change="18.5% of available"
            changeType="neutral"
            icon={Wallet}
          />
          <MetricCard
            title="Win Rate"
            value="68%"
            change="Last 30 trades"
            changeType="profit"
            icon={Target}
          />
          <MetricCard
            title="Active Strategies"
            value="3"
            change="2 profitable"
            changeType="neutral"
            icon={BarChart3}
          />
        </div>

        {/* Strategy Builder + Positions */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <StrategyBuilder />
          <div className="space-y-6">
            <PositionsTable />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
