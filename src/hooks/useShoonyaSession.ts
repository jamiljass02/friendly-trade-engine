import { useState, useEffect, useCallback } from "react";

export interface ShoonyaSession {
  userCode: string;
  sessionToken: string;
  username: string;
  actid: string;
  loginTime: string;
}

const SESSION_KEY = "shoonya_session";

export function useShoonyaSession() {
  const [session, setSession] = useState<ShoonyaSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed: ShoonyaSession = JSON.parse(stored);
        const loginDate = new Date(parsed.loginTime).toDateString();
        const today = new Date().toDateString();
        if (loginDate !== today) {
          // Session expired — force re-login each day
          localStorage.removeItem(SESSION_KEY);
        } else {
          setSession(parsed);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const saveSession = useCallback((s: ShoonyaSession) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }, []);

  return { session, isLoading, isLoggedIn: !!session, saveSession, clearSession };
}
