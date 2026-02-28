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
        reject(new Error(`Invalid response (status ${xhr.status}): ${xhr.responseText?.substring(0, 200)}`));
      }
    };
    
    xhr.onerror = () => {
      console.error("XHR error - readyState:", xhr.readyState, "status:", xhr.status, "url:", url);
      reject(new Error(`Network error calling ${url} - this may be caused by a browser extension (ad blocker, privacy tool) blocking the request. Try disabling extensions or using incognito mode.`));
    };
    xhr.ontimeout = () => reject(new Error("Request timed out after 30s"));
    xhr.timeout = 30000;
    
    xhr.send(JSON.stringify(body));
  });
}
