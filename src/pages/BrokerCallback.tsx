import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShoonyaSession } from "@/hooks/useShoonyaSession";
import { brokerFetch } from "@/lib/broker-api";
import { useToast } from "@/hooks/use-toast";

type Status = "exchanging" | "success" | "error";

const BrokerCallback = () => {
  const navigate = useNavigate();
  const { saveSession } = useShoonyaSession();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("exchanging");
  const [message, setMessage] = useState("Completing Shoonya login...");
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const exchange = async () => {
      const params = new URLSearchParams(window.location.search);
      // Shoonya may return either `code` or `request_code`
      const requestCode = params.get("code") || params.get("request_code");
      const returnedState = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(params.get("error_description") || error);
        return;
      }

      const expectedState = sessionStorage.getItem("shoonya_oauth_state");
      sessionStorage.removeItem("shoonya_oauth_state");
      if (expectedState && returnedState && expectedState !== returnedState) {
        setStatus("error");
        setMessage("Login state mismatch. Please retry to prevent CSRF.");
        return;
      }

      const uid = (localStorage.getItem("shoonya_pending_uid") || params.get("uid") || "").toUpperCase();
      if (!requestCode || !uid) {
        setStatus("error");
        setMessage("Missing request_code or User ID. Please start login again.");
        return;
      }

      try {
        const { ok, data } = await brokerFetch(
          { request_code: requestCode, uid },
          { functionName: "shoonya-oauth-exchange" },
        );

        if (!ok || data.error || !data.session_token) {
          throw new Error(data.error || "Login failed");
        }

        saveSession({
          userCode: uid,
          sessionToken: data.session_token,
          username: data.username,
          actid: data.actid || uid,
          loginTime: new Date().toISOString(),
        });

        localStorage.removeItem("shoonya_pending_uid");
        setStatus("success");
        setMessage(`Connected as ${data.username || uid}. Redirecting...`);
        toast({ title: "Connected!", description: `Logged in as ${data.username || uid}` });
        setTimeout(() => navigate("/", { replace: true }), 1000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("OAuth exchange failed:", err);
        setStatus("error");
        setMessage(msg);
        toast({ title: "Login failed", description: msg, variant: "destructive" });
      }
    };

    exchange();
  }, [navigate, saveSession, toast]);

  const Icon = status === "success" ? CheckCircle2 : status === "error" ? XCircle : Loader2;

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center p-4">
      <div className="glass-card rounded-2xl p-8 w-full max-w-md text-center space-y-4">
        <Icon
          className={`w-10 h-10 mx-auto ${
            status === "success"
              ? "text-success"
              : status === "error"
              ? "text-destructive"
              : "text-primary animate-spin"
          }`}
        />
        <h2 className="text-lg font-semibold text-foreground">
          {status === "success"
            ? "Login Successful"
            : status === "error"
            ? "Login Failed"
            : "Finishing Login"}
        </h2>
        <p className="text-sm text-muted-foreground break-words">{message}</p>
        {status === "error" && (
          <Button onClick={() => navigate("/broker-login", { replace: true })} className="w-full">
            Back to login
          </Button>
        )}
      </div>
    </div>
  );
};

export default BrokerCallback;
