import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { signIn, signUp } from "../services/authApi";
import "../styles/auth.css";

export default function UserAuth() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"signup" | "signin">("signup");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [signinUsername, setSigninUsername] = useState("");
  const [signinPassword, setSigninPassword] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(signinUsername, signinPassword);
      navigate("/chats");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signUp(signupUsername, signupPassword);
      alert("Register success, please sign in");
      setActiveTab("signin");
    } catch (err: any) {
      setError(err?.message || "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-shell">
        <aside className="auth-hero">
          <div>
            <h1 className="auth-title">Chater</h1>
            <p className="auth-subtitle">Fast chat for groups and direct messages.</p>
          </div>
          <ul className="auth-bullets">
            <li>Real-time rooms with WebSocket updates</li>
            <li>Direct chat, group invite, and room rename</li>
            <li>Message search and history pagination</li>
          </ul>
        </aside>

        <main className="auth-panel">
          <div className="auth-tabs" role="tablist" aria-label="auth tabs">
            <button
              type="button"
              className={`auth-tab ${activeTab === "signup" ? "active" : ""}`}
              onClick={() => setActiveTab("signup")}
            >
              Sign up
            </button>
            <button
              type="button"
              className={`auth-tab ${activeTab === "signin" ? "active" : ""}`}
              onClick={() => setActiveTab("signin")}
            >
              Sign in
            </button>
          </div>

          {activeTab === "signup" ? (
            <form className="auth-form" onSubmit={handleSignUp}>
              <h2 className="auth-heading">Create your account</h2>
              <label className="auth-label">
                Username
                <input
                  className="auth-input"
                  placeholder="Choose a username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Create a password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
              </label>
              <button className="auth-submit" disabled={loading}>
                {loading ? "Signing up..." : "Sign up"}
              </button>
              {error && <div className="auth-error">{error}</div>}
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignIn}>
              <h2 className="auth-heading">Welcome back</h2>
              <label className="auth-label">
                Username
                <input
                  className="auth-input"
                  placeholder="Your username"
                  value={signinUsername}
                  onChange={(e) => setSigninUsername(e.target.value)}
                />
              </label>
              <label className="auth-label">
                Password
                <input
                  type="password"
                  className="auth-input"
                  placeholder="Your password"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                />
              </label>
              <button className="auth-submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
              {error && <div className="auth-error">{error}</div>}
            </form>
          )}
        </main>
      </section>
    </div>
  );
}
