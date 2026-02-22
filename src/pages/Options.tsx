import AppLayout from "@/components/AppLayout";
import OptionsChain from "@/components/OptionsChain";

const Options = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Options Chain</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time options data and analytics</p>
        </div>
        <OptionsChain />
      </div>
    </AppLayout>
  );
};

export default Options;
