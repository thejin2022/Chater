import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import React from "react";
import { fetchCurrentUser } from "../services/chatApi";

/**
 * RequireAuth（HttpOnly Cookie + Vite proxy 版本）
 *
 * 判斷方式：
 * - 呼叫一個「一定需要登入」的 API
 * - 200 → 已登入
 * - 401 → 未登入
 */
export default function RequireAuth({
  children,}: {children: React.ReactNode;}) 
{
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        await fetchCurrentUser();
        setAuthed(true);
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
