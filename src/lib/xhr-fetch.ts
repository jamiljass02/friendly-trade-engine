/**
 * XMLHttpRequest-based fetch alternative.
 * Bypasses any window.fetch wrappers/interceptors.
 */
export function xhrFetch(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
      } catch {
        reject(new Error("Invalid JSON response"));
      }
    };
    
    xhr.onerror = () => reject(new Error("Network error - please check your connection"));
    xhr.ontimeout = () => reject(new Error("Request timed out"));
    xhr.timeout = 30000;
    
    xhr.send(JSON.stringify(body));
  });
}
