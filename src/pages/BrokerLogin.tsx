import { useState } from "react";
import { Navigate } from "react-router-dom";
import { LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { brokerFetch } from "@/lib/broker-api";

const BrokerLogin = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoggedIn, isLoading, saveSession } = useShoonyaSession();
  const { toast } = useToast();
  const [uid, setUid] = useState(() => localStorage.getItem("shoonya_pending_uid") || "FN171595_U");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
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
    if (!/^[A-Z]{1,4}\d{3,8}(_[A-Z0-9]{1,4})?$/.test(cleanUid)) {
      toast({ title: "Invalid User ID", description: "e.g. FN171595_U", variant: "destructive" });
      return;
    }
    if (!password || !/^\d{6}$/.test(totp.trim())) {
      toast({ title: "Missing credentials", description: "Password and a 6-digit TOTP are required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    localStorage.setItem("shoonya_pending_uid", cleanUid);

    try {
      const { ok, data } = await brokerFetch(
        { uid: cleanUid, password, totp: totp.trim() },
        { functionName: "shoonya-direct-login" },
      );
      if (!ok || !data.session_token) {
        throw new Error(data.error || "Login failed");
      }
      saveSession({
        userCode: cleanUid,
        sessionToken: data.session_token,
        username: data.username || cleanUid,
        actid: data.actid || cleanUid,
        loginTime: new Date().toISOString(),
      });
      toast({ title: "Connected", description: `Welcome ${data.username || cleanUid}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Login failed", description: msg, variant: "destructive" });
    } finally {
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
            Direct API login (UID + Password + TOTP). Traffic routes through your whitelisted gateway.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Shoonya User ID</Label>
            <Input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="FN171595_U"
              className="bg-secondary/50 border-border/50 font-mono text-sm uppercase"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your Shoonya password"
              className="bg-secondary/50 border-border/50 font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">TOTP (6-digit)</Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="bg-secondary/50 border-border/50 font-mono text-sm tracking-[0.4em]"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
            {loading ? "Connecting..." : "Connect Shoonya"}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center pt-2">
            Credentials are sent only to Shoonya through your whitelisted proxy and never stored.
          </p>
        </form>
      </div>
    </div>
  );
};

export default BrokerLogin;
