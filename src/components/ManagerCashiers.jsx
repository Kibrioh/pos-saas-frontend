import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { showManagerSuccess } from "../utils/managerToast";

const passwordMeetsRequirements = (password) =>
  Array.from(password).length >= 8 &&
  /\p{Lu}/u.test(password) &&
  /\p{Ll}/u.test(password) &&
  /[^\p{L}\p{N}\s]/u.test(password);

function ManagerCashiers() {
  const [cashiers, setCashiers] = useState([]);
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCashiers = () =>
    apiFetch("/auth/users")
      .then((data) => {
        setCashiers(
          (data.users || []).filter((user) => user.role === "cashier")
        );
        setLoadError("");
      })
      .catch((err) => setLoadError(err.message));

  useEffect(() => {
    loadCashiers();
  }, []);

  const registerCashier = async (e) => {
    e.preventDefault();

    const name = newName.trim();
    const username = newUsername.trim();

    if (!name || !username || !newPassword) {
      setError("Please fill in all cashier details.");
      return;
    }

    if (!passwordMeetsRequirements(newPassword)) {
      setError(
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character."
      );
      return;
    }

    setSaving(true);

    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          username,
          password: newPassword,
          role: "cashier",
        }),
      });

      setNewName("");
      setNewUsername("");
      setNewPassword("");
      setError("");
      await loadCashiers();
      showManagerSuccess(`Cashier ${name} registered successfully.`);
    } catch (err) {
      const details = err.data && err.data.errors;
      setError(
        details
          ? Object.entries(details)
              .map(([field, msg]) => field + ": " + msg)
              .join(". ")
          : err.message
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="manager-content">
      <h2>Cashier Management</h2>

      <section className="manager-section">
        <h3>Register New Cashier</h3>

        <form className="cashier-form" onSubmit={registerCashier}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Cashier name"
          />

          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Username"
          />

          <div className="cashier-password-field">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError("");
              }}
              placeholder="Create a password"
              autoComplete="new-password"
              aria-describedby="cashier-password-help"
            />
            <small id="cashier-password-help" className="cashier-password-help">
              At least 8 characters, with uppercase, lowercase, and a special character.
            </small>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={saving}>
            {saving ? "Registering..." : "Register Cashier"}
          </button>
        </form>
      </section>

      <section className="manager-section">
        <h3>Registered Cashiers</h3>

        {loadError && <p className="login-error">{loadError}</p>}

        {!loadError && cashiers.length === 0 && <p>No cashiers yet.</p>}

        <div className="cashier-list">
          {cashiers.map((cashier) => (
            <div className="cashier-row" key={cashier.id}>
              <div>
                <strong>{cashier.name}</strong>
                <p>Username: {cashier.username}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

export default ManagerCashiers;
