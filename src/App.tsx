import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AlgoExecutionDaemon from "@/components/AlgoExecutionDaemon";
import { Card, CardContent } from "@/components/ui/card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { AlertTriangle } from "lucide-react";
import Index from "./pages/Index";
import Strategies from "./pages/Strategies";
import Algo from "./pages/Algo";
import Positions from "./pages/Positions";
import Options from "./pages/Options";
import Futures from "./pages/Futures";
import Holdings from "./pages/Holdings";
import Analytics from "./pages/Analytics";
import Sandbox from "./pages/Sandbox";
import RiskManagement from "./pages/RiskManagement";
import Orders from "./pages/Orders";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import BrokerLogin from "./pages/BrokerLogin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[AlgoRoute] Route crash prevented:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="w-full max-w-lg">
            <CardContent className="p-8 text-center space-y-3">
              <AlertTriangle className="w-8 h-8 mx-auto text-warning" />
              <div>
                <h2 className="text-base font-semibold text-foreground">Algo page recovered</h2>
                <p className="text-sm text-muted-foreground">
                  Invalid strategy data was blocked from crashing this page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoggedIn, isLoading: brokerLoading } = useShoonyaSession();

  if (authLoading || brokerLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <Navigate to="/auth" replace />;
  if (!isLoggedIn) return <Navigate to="/broker-login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AlgoExecutionDaemon />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/broker-login" element={<BrokerLogin />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/strategies" element={<ProtectedRoute><Strategies /></ProtectedRoute>} />
          <Route path="/algo" element={<ProtectedRoute><RouteErrorBoundary><Algo /></RouteErrorBoundary></ProtectedRoute>} />
          <Route path="/positions" element={<ProtectedRoute><Positions /></ProtectedRoute>} />
          <Route path="/options" element={<ProtectedRoute><Options /></ProtectedRoute>} />
          <Route path="/futures" element={<ProtectedRoute><Futures /></ProtectedRoute>} />
          <Route path="/holdings" element={<ProtectedRoute><Holdings /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/risk" element={<ProtectedRoute><RiskManagement /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/sandbox" element={<ProtectedRoute><Sandbox /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
