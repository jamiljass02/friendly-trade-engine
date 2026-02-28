/**
 * Calls the Shoonya broker edge function using standard fetch with proper Supabase headers.
 */
const FUNCTION_URL = "https://ytzzmnharipqcucfachn.supabase.co/functions/v1/shoonya-api";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0enptbmhhcmlwcWN1Y2ZhY2huIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMzc3ODUsImV4cCI6MjA4NzgxMzc4NX0.IjrxQYoFZRBuC_hpqDU8Wr2C3QQGHZsrb1XsaO9m9R4";

export async function brokerFetch(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
        "Authorization": `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: `Non-JSON response: ${text.slice(0, 200)}` };
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error("brokerFetch error:", err);
    if (err.name === "AbortError") {
      throw new Error("Request timed out after 25s. The server may be slow or unreachable.");
    }
    throw new Error(
      `Network error: ${err.message}. Check your internet connection and try again.`
    );
  }
}
