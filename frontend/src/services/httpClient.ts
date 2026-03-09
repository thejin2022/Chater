import { API_BASE_URL } from "../config/Api";

// 解析瀏覽器 cookie，供 CSRF header 使用。
function getCookie(name: string): string | null {
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const item of cookies) {
    const [key, ...rest] = item.split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function isUnsafeMethod(method?: string): boolean {
  const m = (method ?? "GET").toUpperCase();
  return ["POST", "PUT", "PATCH", "DELETE"].includes(m);
}

// 先向後端要一個 CSRF cookie，之後 unsafe request 才能通過後端驗證。
async function ensureCsrfCookie(): Promise<void> {
  const hasToken = Boolean(getCookie("csrftoken"));
  if (hasToken) return;

  await fetch(`${API_BASE_URL}/auth/csrf/`, {
    method: "GET",
    credentials: "include",
  });
}

/**
 * =========================
 * Authorized HTTP request
 * =========================
 *
 * HttpOnly Cookie 架構：
 * - access / refresh token 皆由後端放在 cookie
 * - 前端不讀、不存、不刷新 token
 * - 只負責送 request
 * - 是否登入由 response status 判斷
 */
export async function authorizedRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  if (isUnsafeMethod(options.method)) {
    await ensureCsrfCookie();
  }

  const headers = new Headers(options.headers || {});
  // cookie JWT 架構下，unsafe request 額外帶 CSRF header。
  if (isUnsafeMethod(options.method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,

    /** 
     * 一定要 include，瀏覽器才會送 HttpOnly cookie
     */
    credentials: "include",

    headers,
  });
}
