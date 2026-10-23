import { useState } from "react";
import { login, registerManager } from "../api/client";

const passwordMeetsRequirements = (password) =>
  Array.from(password).length >= 8 &&
  /\p{Lu}/u.test(password) &&
  /\p{Ll}/u.test(password) &&
  /[^\p{L}\p{N}\s]/u.test(password);

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanUsername = username.trim();

    if (mode === "signup") {
      if (!businessName.trim() || !name.trim() || !cleanUsername || !password || !confirmPassword) {
        setError("Please enter your business name and complete all manager account details.");
        return;
      }

      if (cleanUsername.length < 3) {
        setError("Username must be at least 3 characters.");
        return;
      }

      if (!passwordMeetsRequirements(password)) {
        setError(
          "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character."
        );
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    } else if (!cleanUsername || !password) {
      setError("Please enter your username and password.");
      return;
    }

    setSaving(true);
    try {
      const user = mode === "signup"
        ? await registerManager(businessName.trim(), name.trim(), cleanUsername, password)
        : await login(cleanUsername, password);
      setError("");
      onLogin(user);
    } catch (err) {
      if (err.status === 409 && mode === "signup") {
        setError("An account with this username already exists. Please sign in instead.");
        return;
      }
      setError(
        err.status === 401
          ? "Invalid username or password."
          : err.data?.errors
            ? Object.entries(err.data.errors)
                .map(([field, message]) => `${field}: ${message}`)
                .join(". ")
            : err.message
      );
    } finally {
      setSaving(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
  };

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="brand-icon">TP</div>

        <h1>TechPoint</h1>

        <p>
          Smart sales. Simple management.
        </p>
      </div>

      <div className="login-card">
        <div className="login-header">
          <h2>{mode === "login" ? "Welcome back" : "Set up your manager account"}</h2>

          <p>
            {mode === "login"
              ? "Sign in to access the TechPoint POS system."
              : "Create a manager account to manage your store and register cashiers."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="login-field">
              <label htmlFor="business-name">Business name</label>
              <input
                id="business-name"
                type="text"
                value={businessName}
                onChange={(e) => {
                  setBusinessName(e.target.value);
                  setError("");
                }}
                placeholder="Enter your business name"
                autoComplete="organization"
              />
            </div>
          )}

          {mode === "signup" && (
            <div className="login-field">
              <label htmlFor="manager-name">Full name</label>
              <input
                id="manager-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </div>
          )}

          <div className="login-field">
            <label htmlFor="username">
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder={mode === "signup" ? "Choose a username" : "Enter your username"}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
            {mode === "signup" && (
              <small className="login-password-help">
                At least 8 characters, with uppercase, lowercase, and a special character.
              </small>
            )}
          </div>

          {mode === "signup" && (
            <div className="login-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                placeholder="Re-enter your password"
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-button"
            type="submit"
            disabled={saving}
          >
            {saving
              ? mode === "signup" ? "Creating account..." : "Signing in..."
              : mode === "signup" ? "Create Manager Account" : "Sign In"}
          </button>
        </form>

        {mode === "login" && (
          <p className="login-mode-switch">
            Don&apos;t have a manager account?{" "}
            <button type="button" onClick={() => switchMode("signup")}>
              Sign up
            </button>
          </p>
        )}

        {mode === "signup" && (
          <p className="login-mode-switch">
            Already have a manager account?{" "}
            <button type="button" onClick={() => switchMode("login")}>
              Sign in
            </button>
          </p>
        )}

        <div className="login-footer">
          <span></span>
          <p>TechPoint POS</p>
          <span></span>
        </div>
      </div>
    </div>
  );
}

export default Login;
