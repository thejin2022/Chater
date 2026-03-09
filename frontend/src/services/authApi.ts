/**
 * authApi.ts
 * -------------------------
 * 專門處理「登入 / 註冊」這類 auth 行為
 * 採用 HttpOnly Cookie 架構：
 * - 不回傳 access / refresh
 * - token 由後端 Set-Cookie
 * - 前端只關心 request 是否成功
 */

import { API_BASE_URL } from "../config/Api";
import { authorizedRequest } from "./httpClient";

/**
 * 登入
 * - 成功條件：HTTP 200
 * - token 會由後端寫入 HttpOnly cookie
 */
export async function signIn(
  username: string,
  password: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/auth/login/`, 
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    }
  );

  if (!res.ok) {
    throw new Error("Invalid username or password");
  }
}

/**
 * 註冊
 */
export async function signUp(
  username: string,
  password: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/auth/register/`, // ✅ 移除多餘的 /api
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    }
  );

  if (!res.ok) {
    throw new Error("Register failed");
  }
}

/**
 * 登出
 * - 後端會刪除 access_token / refresh_token cookie
 */
export async function signOut(): Promise<void> {
  const res = await authorizedRequest("/auth/logout/", {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error("Logout failed");
  }
}
