import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const SHOONYA_OAUTH_API_KEY = import.meta.env.VITE_SHOONYA_OAUTH_API_KEY as string | undefined;
const AUTHORIZE_BASE = "https://trade.shoonya.com/OAuthlogin/authorize/oauth";

const BrokerLogin = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoggedIn, isLoading } = useShoonyaSession();
  const { toast } = useToast();
  const [uid, setUid] = useState(() => localStorage.getItem("shoonya_pending_uid") || "");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      toast({
        title: "Shoonya login cancelled",
        description: params.get("error_description") || params.get("error") || "Please retry.",
        variant: "destructive",
      });
    }
  }, [toast]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (isLoggedIn) return <Navigate to="/" replace />;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUid = uid.trim().toUpperCase();
    if (!/^[A-Z]{1,3}\d{3,8}$/.test(cleanUid)) {
      toast({
        title: "Invalid User ID",
        description: "Enter your Shoonya User ID (e.g. FA12345).",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem("shoonya_pending_uid", cleanUid);

    const state = crypto.randomUUID();
    sessionStorage.setItem("shoonya_oauth_state", state);

    const redirectUri = `${window.location.origin}/broker-callback`;
    const url = new URL(AUTHORIZE_BASE);
    if (SHOONYA_OAUTH_API_KEY) url.searchParams.set("api_key", SHOONYA_OAUTH_API_KEY);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("uid", cleanUid);

    window.location.href = url.toString();
  };

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <h2 className="text-lg font-semibold text-foreground text-center mb-2">Connect Broker</h2>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Login via Shoonya PRISM (SEBI-compliant OAuth flow)
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Shoonya User ID
            </Label>
            <Input
              type="text"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="FA12345"
              className="bg-secondary/50 border-border/50 font-mono text-sm uppercase"
              required
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              You'll be redirected to Shoonya to enter your password &amp; TOTP securely.
            </p>
          </div>

          <Button type="submit" className="w-full">
            <LogIn className="w-4 h-4 mr-2" />
            Login with Shoonya
          </Button>

          <p className="text-[10px] text-muted-foreground text-center pt-2">
            We never see your password. Authentication happens on Shoonya's servers and we
            receive a session token via secure callback.
          </p>
        </form>
      </div>
    </div>
  );
};

export default BrokerLogin;
