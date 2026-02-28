import AppLayout from "@/components/AppLayout";
import EnhancedStrategyBuilder from "@/components/EnhancedStrategyBuilder";

const Strategies = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Strategy Builder</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build multi-leg strategies across indices, stocks & futures · Real-time payoff & Greeks
          </p>
        </div>
        <EnhancedStrategyBuilder />
      </div>
    </AppLayout>
  );
};

export default Strategies;
