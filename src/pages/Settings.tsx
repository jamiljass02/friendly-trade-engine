import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useBroker } from "@/hooks/useBroker";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plug, PlugZap, LogOut, Eye, EyeOff, Shield } from "lucide-react";

const Settings = () => {
  const { isConnected, isLoading, status, saveCredentials, login, logout } = useBroker();
  const { user, signOut } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [totp, setTotp] = useState("");
  const [hasCredentials, setHasCredentials] = useState(false);
  const [form, setForm] = useState({
    user_code: "",
    password: "",
    totp_key: "",
    vendor_code: "",
    api_key: "",
    imei: "tradex-app",
  });

  useEffect(() => {
    const loadCreds = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("broker_credentials")
        .select("user_code, vendor_code, imei")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setHasCredentials(true);
        setForm(prev => ({
          ...prev,
          user_code: data.user_code || "",
          vendor_code: data.vendor_code || "",
          imei: data.imei || "tradex-app",
        }));
      }
    };
    loadCreds();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveCredentials(form);
    setHasCredentials(true);
    setShowForm(false);
  };

  const handleLogin = async () => {
    await login(totp || undefined);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Broker connection & account settings</p>
        </div>

        {/* Broker Connection */}
        <div className="glass-card rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <PlugZap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Shoonya (Finvasia)</h3>
                <p className="text-xs text-muted-foreground">F&O broker connection</p>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-success text-success-foreground" : ""}>
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          {status?.last_connected_at && (
            <p className="text-[10px] text-muted-foreground font-mono">
              Last connected: {new Date(status.last_connected_at).toLocaleString()}
            </p>
          )}

          {/* Credential Form */}
          {!showForm && !hasCredentials && (
            <Button onClick={() => setShowForm(true)} variant="outline" className="w-full">
              <Plug className="w-4 h-4 mr-2" />
              Configure Broker Credentials
            </Button>
          )}

          {showForm && (
            <form onSubmit={handleSave} className="space-y-4 border-t border-border/50 pt-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">Broker Credentials</h4>
                <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  {showPasswords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPasswords ? "Hide" : "Show"}
                </button>
              </div>

              {[
                { key: "user_code", label: "User ID", placeholder: "FA12345", secret: false },
                { key: "password", label: "Password", placeholder: "Your trading password", secret: true },
                { key: "totp_key", label: "TOTP Secret Key", placeholder: "Base32 TOTP secret", secret: true },
                { key: "api_key", label: "API Key", placeholder: "From Shoonya API portal", secret: true },
                { key: "vendor_code", label: "Vendor Code", placeholder: "Vendor code (optional)", secret: false },
                { key: "imei", label: "IMEI / Device ID", placeholder: "tradex-app", secret: false },
              ].map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{field.label}</Label>
                  <Input
                    type={field.secret && !showPasswords ? "password" : "text"}
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="bg-secondary/50 border-border/50 font-mono text-xs"
                    required={field.key !== "vendor_code" && field.key !== "imei"}
                  />
                </div>
              ))}

              <div className="flex gap-2">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  <Shield className="w-4 h-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Credentials"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {/* Login / Connection Controls */}
          {hasCredentials && !showForm && (
            <div className="space-y-3 border-t border-border/50 pt-4">
              {!isConnected ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">TOTP Code (if not using stored key)</Label>
                    <Input
                      value={totp}
                      onChange={(e) => setTotp(e.target.value)}
                      placeholder="6-digit TOTP (optional)"
                      className="bg-secondary/50 border-border/50 font-mono text-xs"
                      maxLength={6}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleLogin} disabled={isLoading} className="flex-1">
                      <PlugZap className="w-4 h-4 mr-2" />
                      {isLoading ? "Connecting..." : "Connect to Shoonya"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowForm(true)}>Edit</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={logout} variant="destructive" className="flex-1">
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(true)}>Edit Credentials</Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Account */}
        <div className="glass-card rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Account</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-mono text-foreground">{user?.email}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
