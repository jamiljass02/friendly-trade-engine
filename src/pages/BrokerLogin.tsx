import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LogIn, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { brokerFetch } from "@/lib/broker-api";
import { safeRandomUUID } from "@/lib/utils";

const BrokerLogin = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoggedIn, isLoading } = useShoonyaSession();
  const { toast } = useToast();
  const [clientId, setClientId] = useState(
    () => localStorage.getItem("shoonya_pending_uid")?.replace(/_U$/, "") || "",
  );
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

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = clientId.trim().toUpperCase();
    if (!/^[A-Z]{1,4}\d{3,8}$/.test(cleanId)) {
      toast({
        title: "Invalid Client ID",
        description: "Enter your Shoonya Client ID (e.g. FA110662)",
        variant: "destructive",
      });
      return;
    }

    // Shoonya API user id is the client id with `_U` suffix
    const uid = `${cleanId}_U`;
    setLoading(true);
    localStorage.setItem("shoonya_pending_uid", uid);

    try {
      const state = safeRandomUUID();
      sessionStorage.setItem("shoonya_oauth_state", state);

      const { ok, data } = await brokerFetch(
        {
          uid,
          state,
          redirect_uri: `${window.location.origin}/broker-callback`,
        },
        { functionName: "shoonya-oauth-url" },
      );

      if (!ok || !data.authorize_url) {
        throw new Error(data.error || "Could not start Shoonya login");
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
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
            <LogIn className="w-6 h-6 text-primary" />
          </div>
          <p className="text-[10px] text-primary uppercase tracking-[0.35em]">Connect Broker</p>
          <h2 className="text-xl font-semibold text-foreground">Shoonya by Finvasia</h2>
        </div>

        <form onSubmit={handleValidate} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-xs text-foreground font-medium">Client Id</Label>
            <Input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value.toUpperCase())}
              placeholder="FA110662"
              className="bg-secondary/50 border-border/50 font-mono text-sm uppercase h-11"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <a
            href="https://prism.shoonya.com/api"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <Settings className="w-3.5 h-3.5" />
            Steps to get API key and Secret key details?
          </a>

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redirecting to Shoonya...
              </>
            ) : (
              "Validate"
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center pt-1">
            You'll be redirected to Shoonya to authorize TradeX. No password is entered here.
          </p>
        </form>
      </div>
    </div>
  );
};

export default BrokerLogin;
