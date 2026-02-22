import AppLayout from "@/components/AppLayout";
import PositionsTable from "@/components/PositionsTable";

const Positions = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Positions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track and manage your open positions</p>
        </div>
        <PositionsTable />
      </div>
    </AppLayout>
  );
};

export default Positions;
