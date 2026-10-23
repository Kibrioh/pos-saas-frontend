import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch, setActiveBranchId } from "../api/client";

function ManagerNav({ user, onLogout }) {
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [branchError, setBranchError] = useState("");

  useEffect(() => {
    let active = true;
    apiFetch("/auth/branches")
      .then((data) => {
        if (active) setBranches(data.branches || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user.tenant_id]);

  const switchBranch = (branchId) => {
    setActiveBranchId(branchId);
    window.location.reload();
  };

  const addBranch = async (event) => {
    event.preventDefault();
    const name = newBranchName.trim();
    if (!name) return;
    setBranchError("");
    try {
      const result = await apiFetch("/auth/branches", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      switchBranch(result.branch.id);
    } catch (error) {
      setBranchError(error.message);
    }
  };

  return (
    <header className="manager-header">
      <div className="manager-brand">
        <h1>TechPoint</h1>
        <p>{user.business?.name || "Manager Portal"}</p>
      </div>

     <nav className="manager-nav">
  <NavLink to="/manager">
    Dashboard
  </NavLink>

  <NavLink to="/manager/sales">
    Sales
  </NavLink>

  <NavLink to="/manager/products">
    Products & Inventory
  </NavLink>

  <NavLink to="/manager/purchasing">
    Purchasing
  </NavLink>

  <NavLink to="/manager/shifts">
    Shifts
  </NavLink>

  <NavLink to="/manager/audit">
    Audit
  </NavLink>

  <NavLink to="/manager/cashiers">
    Cashiers
  </NavLink>
</nav>

      <div className="manager-user">
        <span>Welcome, {user.username}</span>

        <label className="manager-branch-picker">
          <span>Branch</span>
          <select
            value={user.active_branch_id || user.branch_id}
            onChange={(event) => switchBranch(event.target.value)}
            aria-label="Active branch"
          >
            {branches.map((branch) => (
              <option value={branch.id} key={branch.id}>{branch.name}</option>
            ))}
          </select>
        </label>

        <form className="manager-add-branch" onSubmit={addBranch}>
          <input
            value={newBranchName}
            onChange={(event) => setNewBranchName(event.target.value)}
            aria-label="New branch name"
            placeholder="New branch"
            maxLength={120}
          />
          <button type="submit">Add</button>
          {branchError && <span className="manager-branch-error" role="alert">{branchError}</span>}
        </form>

        <button onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default ManagerNav;
