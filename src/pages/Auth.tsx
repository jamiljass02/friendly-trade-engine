import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Zap, Eye, EyeOff, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { xhrFetch } from "@/lib/xhr-fetch";

const FUNCTION_URL = "https://ytzzmnharipqcucfachn.supabase.co/functions/v1/shoonya-api";

const Auth = () => {
  const { isLoggedIn, isLoading, saveSession } = useShoonyaSession();
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    user_code: "",
    password: "",
    totp: "",
    api_key: "",
    vendor_code: "",
    imei: "tradex-app",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoggedIn) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { ok, data } = await xhrFetch(FUNCTION_URL, {
        action: "direct_login",
        user_code: form.user_code,
        password: form.password,
        totp: form.totp,
        api_key: form.api_key,
        vendor_code: form.vendor_code,
        imei: form.imei,
      });

      if (!ok || data.error) throw new Error(data.error || "Login failed");

      saveSession({
        userCode: form.user_code,
        sessionToken: data.session_token,
        username: data.username,
        actid: data.actid,
        loginTime: new Date().toISOString(),
      });

      toast({ title: "Connected!", description: `Logged in as ${data.username}` });
    } catch (err: any) {
      console.error("Login error:", err);
      toast({ title: "Login Failed", description: err.message || String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-wide">TradeX</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Execution Platform</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground text-center mb-2">Shoonya Login</h2>
        <p className="text-xs text-muted-foreground text-center mb-6">Connect with your Finvasia broker account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showPasswords ? "Hide" : "Show"} secrets
            </button>
          </div>

          {[
            { key: "user_code", label: "User ID", placeholder: "FA12345", secret: false, required: true },
            { key: "password", label: "Password", placeholder: "Trading password", secret: true, required: true },
            { key: "totp", label: "TOTP Code", placeholder: "6-digit code or TOTP secret", secret: false, required: true },
            { key: "api_key", label: "API Key", placeholder: "From Shoonya API portal", secret: true, required: true },
            { key: "vendor_code", label: "Vendor Code", placeholder: "Vendor code (optional)", secret: false, required: false },
          ].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</Label>
              <Input
                type={field.secret && !showPasswords ? "password" : "text"}
                value={form[field.key as keyof typeof form]}
                onChange={(e) => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="bg-secondary/50 border-border/50 font-mono text-sm"
                required={field.required}
              />
            </div>
          ))}

          <Button type="submit" className="w-full" disabled={loading}>
            <PlugZap className="w-4 h-4 mr-2" />
            {loading ? "Connecting..." : "Connect to Shoonya"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
