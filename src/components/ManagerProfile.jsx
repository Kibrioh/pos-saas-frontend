import { useState } from "react";
import { apiFetch } from "../api/client";
import { showManagerSuccess } from "../utils/managerToast";

function ManagerProfile({ user, onProfileUpdated }) {
  const [name, setName] = useState(user.name || "");
  const [username, setUsername] = useState(user.username || "");
  const [businessName, setBusinessName] = useState(user.business?.name || "");
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileSaving(true);

    try {
      const result = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          username,
          business_name: businessName,
        }),
      });
      onProfileUpdated?.(result.user);
      showManagerSuccess("Account details updated.");
    } catch (error) {
      setProfileError(
        Object.values(error.data?.errors || {}).join(". ") || error.message,
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          old_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showManagerSuccess("Password updated.");
    } catch (error) {
      setPasswordError(error.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials = (user.name || user.username || "M")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="manager-profile-page">
      <header className="manager-profile-heading">
        <div>
          <span className="manager-profile-eyebrow">Manager account</span>
          <h1>Profile &amp; security</h1>
          <p>Update your account details and keep your sign-in secure.</p>
        </div>
      </header>

      <section className="manager-profile-summary" aria-label="Manager profile summary">
        <div className="manager-profile-avatar" aria-hidden="true">{initials}</div>
        <div className="manager-profile-summary-copy">
          <strong>{user.name || user.username}</strong>
          <span>@{user.username}</span>
        </div>
        <span className="manager-profile-role">Manager</span>
      </section>

      <div className="manager-profile-grid">
        <section className="manager-profile-card">
          <div className="manager-profile-card-heading">
            <span className="manager-profile-card-icon" aria-hidden="true">01</span>
            <div>
              <h2>Account details</h2>
              <p>These details identify you and your business in the workspace.</p>
            </div>
          </div>

          <form className="manager-profile-form" onSubmit={saveProfile}>
            <label>
              <span>Full name</span>
              <input
                autoComplete="name"
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label>
              <span>Username</span>
              <input
                autoComplete="username"
                maxLength={80}
                minLength={3}
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
            </label>
            <label>
              <span>Business name</span>
              <input
                autoComplete="organization"
                maxLength={160}
                onChange={(event) => setBusinessName(event.target.value)}
                required
                value={businessName}
              />
            </label>
            {profileError && <p className="manager-profile-error" role="alert">{profileError}</p>}
            <div className="manager-profile-actions">
              <button type="submit" disabled={profileSaving}>
                {profileSaving ? "Saving…" : "Save account details"}
              </button>
            </div>
          </form>
        </section>

        <section className="manager-profile-card">
          <div className="manager-profile-card-heading">
            <span className="manager-profile-card-icon manager-profile-card-icon-lock" aria-hidden="true">02</span>
            <div>
              <h2>Change password</h2>
              <p>Use at least 8 characters with uppercase, lowercase, and a symbol.</p>
            </div>
          </div>

          <form className="manager-profile-form" onSubmit={updatePassword}>
            <label>
              <span>Current password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </label>
            <label>
              <span>New password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                autoComplete="new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            {passwordError && <p className="manager-profile-error" role="alert">{passwordError}</p>}
            <div className="manager-profile-actions">
              <button type="submit" disabled={passwordSaving}>
                {passwordSaving ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

export default ManagerProfile;
