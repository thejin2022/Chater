import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import React from "react";
import { API_BASE_URL } from "../config/Api";

/**
 * RequireAuth（HttpOnly Cookie + Vite proxy 版本）
 *
 * 判斷方式：
 * - 呼叫一個「一定需要登入」的 API
 * - 200 → 已登入
 * - 401 → 未登入
 */
export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/chat/chatrooms/`, // ✅ 只用相對路徑
          {
            credentials: "include",
          }
        );

        setAuthed(res.ok);
      } catch {
        setAuthed(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  if (loading) {
    return null;
  }

  if (!authed) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
