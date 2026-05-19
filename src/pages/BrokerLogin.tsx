import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LogIn, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { brokerFetch } from "@/lib/broker-api";

const BrokerLogin = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isLoggedIn, isLoading, saveSession } = useShoonyaSession();
  const { toast } = useToast();
  const [uid, setUid] = useState(() => localStorage.getItem("shoonya_pending_uid") || "");
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
    if (!/^[A-Z]{1,3}\d{3,8}$/.test(cleanUid)) {
      toast({ title: "Invalid User ID", description: "e.g. FA12345", variant: "destructive" });
      return;
    }
    if (!password || !totp) {
      toast({ title: "Missing fields", description: "Password and TOTP are required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    localStorage.setItem("shoonya_pending_uid", cleanUid);

    try {
      const { ok, data } = await brokerFetch(
        { userid: cleanUid, password, totp: totp.trim() },
        { functionName: "shoonya-openalgo-login" },
      );
      if (!ok || data.error || !data.session_token) {
        throw new Error(data.error || "Login failed");
      }
      saveSession({
        userCode: cleanUid,
        sessionToken: data.session_token,
        username: data.username || cleanUid,
        actid: data.actid || cleanUid,
        loginTime: new Date().toISOString(),
      });
      localStorage.removeItem("shoonya_pending_uid");
      toast({ title: "Connected!", description: `Logged in as ${data.username || cleanUid}` });
      navigate("/", { replace: true });
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
        <h2 className="text-lg font-semibold text-foreground text-center mb-2">Connect Broker</h2>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Login via OpenAlgo bridge (static IP whitelisted)
        </p>

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

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-secondary/50 border-border/50 font-mono text-sm"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">TOTP</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              className="bg-secondary/50 border-border/50 font-mono text-sm tracking-widest"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogIn className="w-4 h-4 mr-2" />}
            {loading ? "Connecting..." : "Login"}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center pt-2">
            Credentials are sent over TLS to the backend, which calls the OpenAlgo bridge on your whitelisted IP.
          </p>
        </form>
      </div>
    </div>
  );
};

export default BrokerLogin;
