import AppLayout from "@/components/AppLayout";
import OrdersTable from "@/components/OrdersTable";

const Orders = () => {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Orders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">View all executed and pending orders</p>
        </div>
        <OrdersTable />
      </div>
    </AppLayout>
  );
};

export default Orders;
