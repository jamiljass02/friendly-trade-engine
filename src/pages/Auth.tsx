import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Zap, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const Auth = () => {
  const { user, isLoading: authLoading, signUp, signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [showVerifyNotice, setShowVerifyNotice] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    email: "",
    password: "",
    displayName: "",
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await signUp(form.email, form.password);
        if (error) throw error;
        setShowVerifyNotice(true);
        toast({ title: "Account created!", description: "Check your email to verify your account." });
      } else {
        const { error } = await signIn(form.email, form.password);
        if (error) throw error;
        toast({ title: "Welcome back!" });
      }
    } catch (err: any) {
      toast({
        title: mode === "signup" ? "Signup Failed" : "Login Failed",
        description: err.message || String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (showVerifyNotice) {
    return (
      <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Verify Your Email</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We've sent a verification link to <span className="text-foreground font-medium">{form.email}</span>.
            Click the link in the email to activate your account.
          </p>
          <Button
            variant="outline"
            onClick={() => { setShowVerifyNotice(false); setMode("login"); }}
            className="w-full"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-primary">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-wide">TradeX</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Execution Platform</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg bg-secondary/50 p-1 mb-6">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
              mode === "login"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 text-sm font-medium py-2 rounded-md transition-all ${
              mode === "signup"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Display Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Your name"
                  className="pl-10 bg-secondary/50 border-border/50 text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="you@example.com"
                className="pl-10 bg-secondary/50 border-border/50 text-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Min 6 characters"
                className="pl-10 bg-secondary/50 border-border/50 text-sm"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            {loading
              ? mode === "signup" ? "Creating Account..." : "Signing In..."
              : mode === "signup" ? "Create Account" : "Sign In"
            }
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Auth;
