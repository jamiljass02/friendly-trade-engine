import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBroker } from "@/hooks/useBroker";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { PlugZap, LogOut } from "lucide-react";

const Settings = () => {
  const { logout } = useBroker();
  const { session } = useShoonyaSession();

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Broker connection & account settings</p>
        </div>

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
            <Badge variant="default" className="bg-success text-success-foreground">
              Connected
            </Badge>
          </div>

          {session && (
            <div className="space-y-2 border-t border-border/50 pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">User ID</span>
                <span className="font-mono text-foreground">{session.userCode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Username</span>
                <span className="font-mono text-foreground">{session.username}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Connected since</span>
                <span className="font-mono text-foreground">{new Date(session.loginTime).toLocaleString()}</span>
              </div>
            </div>
          )}

          <Button onClick={logout} variant="destructive" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Disconnect & Logout
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
