import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LogIn, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { brokerFetch } from "@/lib/broker-api";

const BrokerLogin = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoggedIn, isLoading } = useShoonyaSession();
  const { toast } = useToast();
  const [uid, setUid] = useState(() => localStorage.getItem("shoonya_pending_uid") || "");
  const [loading, setLoading] = useState(false);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isLoggedIn) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = uid.trim().toUpperCase();
    if (!/^[A-Z]{1,3}\d{3,8}$/.test(cleanUid)) {
      toast({ title: "Invalid User ID", description: "e.g. FA12345", variant: "destructive" });
      return;
    }

    setLoading(true);
    localStorage.setItem("shoonya_pending_uid", cleanUid);
    const state = crypto.randomUUID();
    sessionStorage.setItem("shoonya_oauth_state", state);
    const redirectUri = `${window.location.origin}/broker-callback`;

    try {
      const { ok, data } = await brokerFetch(
        { uid: cleanUid, state, redirect_uri: redirectUri },
        { functionName: "shoonya-oauth-url" },
      );
      if (!ok || !data.authorize_url) {
        throw new Error(data.error || "Could not build Shoonya login URL");
      }
      window.location.href = data.authorize_url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6 space-y-2">
          <p className="text-[10px] text-primary uppercase tracking-[0.35em]">TradeX Broker Login</p>
          <h2 className="text-xl font-semibold text-foreground">Connect Shoonya</h2>
          <p className="text-xs text-muted-foreground">
            Authorize your broker session securely, then return to TradeX automatically.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Shoonya User ID</Label>
            <Input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="FA12345"
              className="bg-secondary/50 border-border/50 font-mono text-sm uppercase"
              required
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
            {loading ? "Opening Shoonya..." : "Continue to Shoonya"}
            {!loading && <ExternalLink className="w-3 h-3 ml-2 opacity-60" />}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center pt-2">
            No broker password is stored in TradeX.
          </p>
        </form>
      </div>
    </div>
  );
};

export default BrokerLogin;
