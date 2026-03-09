import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { signIn, signUp } from "../services/authApi";

export default function UserAuth() {
  const navigate = useNavigate();

  /* ===== Tab ===== */
  const [activeTab, setActiveTab] =
    useState<"signup" | "signin">("signup");

  /* ===== 共用狀態 ===== */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ===== Sign In ===== */
  const [signinUsername, setSigninUsername] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  /* ===== Sign Up ===== */
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  /* =========================
     Sign In
     ========================= */
async function handleSignIn(e: React.FormEvent) {
  e.preventDefault();
  console.log("[UserAuth] submit clicked");

  setLoading(true);
  setError("");

  try {
    console.log("[UserAuth] before signIn");

    await signIn(signinUsername, signinPassword);

    console.log("[UserAuth] signIn success");

    sessionStorage.setItem("username", signinUsername);

    console.log("[UserAuth] navigating to /chats");
    navigate("/chats");
  } catch (err: any) {
    console.error("[UserAuth] signIn failed:", err);
    setError(err?.message || "Login failed");
  } finally {
    console.log("[UserAuth] finally");
    setLoading(false);
  }
}


  /* =========================
     Sign Up
     ========================= */
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      /**
       * 註冊流程與 HttpOnly 無直接關係
       * 不涉及 token，因此不需要額外調整
       */
      await signUp(signupUsername, signupPassword);

      alert("Register success, please sign in");
      setActiveTab("signin");
    } catch (err: any) {
      setError(err?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     UI
     ========================= */
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#919ca4ff",
      }}
    >
      <div
        className="bg-white rounded shadow p-4"
        style={{ width: "100%", maxWidth: "480px" }}
      >
        <div className="text-center mb-4">
          <h1>Welcome to Chater!</h1>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs nav-justified">
          <li className="nav-item">
            <a
              href="#"
              className={`nav-link ${
                activeTab === "signup" ? "active" : ""
              }`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("signup");
              }}
            >
              Sign Up
            </a>
          </li>

          <li className="nav-item">
            <a
              href="#"
              className={`nav-link ${
                activeTab === "signin" ? "active" : ""
              }`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab("signin");
              }}
            >
              Sign In
            </a>
          </li>
        </ul>

        {/* Form */}
        <div className="border border-top-0 p-4">
          {activeTab === "signup" && (
            <form onSubmit={handleSignUp}>
              <input
                className="form-control mb-3"
                placeholder="Username"
                value={signupUsername}
                onChange={(e) =>
                  setSignupUsername(e.target.value)
                }
              />
              <input
                type="password"
                className="form-control mb-3"
                placeholder="Password"
                value={signupPassword}
                onChange={(e) =>
                  setSignupPassword(e.target.value)
                }
              />
              <button
                className="btn btn-primary w-100"
                disabled={loading}
              >
                {loading ? "Signing up..." : "Sign up"}
              </button>
            </form>
          )}

          {activeTab === "signin" && (
            <form onSubmit={handleSignIn}>
              <input
                className="form-control mb-3"
                placeholder="Username"
                value={signinUsername}
                onChange={(e) =>
                  setSigninUsername(e.target.value)
                }
              />
              <input
                type="password"
                className="form-control mb-3"
                placeholder="Password"
                value={signinPassword}
                onChange={(e) =>
                  setSigninPassword(e.target.value)
                }
              />
              <button
                className="btn btn-primary w-100"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>

              {error && (
                <div className="text-danger mt-2">
                  {error}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
