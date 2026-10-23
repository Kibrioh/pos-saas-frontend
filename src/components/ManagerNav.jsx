import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch, setActiveBranchId } from "../api/client";

function BranchLocationEditor({ branch, onSaved }) {
  const [location, setLocation] = useState(branch.location || "");
  const [latitude, setLatitude] = useState(branch.latitude == null ? "" : String(branch.latitude));
  const [longitude, setLongitude] = useState(branch.longitude == null ? "" : String(branch.longitude));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    try {
      const result = await apiFetch(`/auth/branches/${branch.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          location: location.trim() || null,
          latitude: latitude === "" ? null : Number(latitude),
          longitude: longitude === "" ? null : Number(longitude),
        }),
      });
      onSaved(result.branch);
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <form className="manager-branch-form" onSubmit={save}>
      <input
        value={location}
        onChange={(event) => {
          setLocation(event.target.value);
          setSaved(false);
        }}
        aria-label="Branch address or location"
        placeholder="Address or location"
        maxLength={200}
      />
      <small className="manager-coordinate-help">Coordinates use decimal degrees.</small>
      <input
        type="number"
        step="any"
        min="-90"
        max="90"
        value={latitude}
        onChange={(event) => {
          setLatitude(event.target.value);
          setSaved(false);
        }}
        aria-label="Branch latitude"
        placeholder="Latitude"
      />
      <input
        type="number"
        step="any"
        min="-180"
        max="180"
        value={longitude}
        onChange={(event) => {
          setLongitude(event.target.value);
          setSaved(false);
        }}
        aria-label="Branch longitude"
        placeholder="Longitude"
      />
      <button type="submit">Save</button>
      {saved && <span className="manager-branch-saved" role="status">Saved</span>}
      {error && <span className="manager-branch-error" role="alert">{error}</span>}
    </form>
  );
}

function ManagerNav({ user, onLogout }) {
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchLocation, setNewBranchLocation] = useState("");
  const [newBranchLatitude, setNewBranchLatitude] = useState("");
  const [newBranchLongitude, setNewBranchLongitude] = useState("");
  const [branchError, setBranchError] = useState("");
  const activeBranchId = user.active_branch_id || user.branch_id;
  const selectedBranch = branches.find((branch) => String(branch.id) === String(activeBranchId));

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
        body: JSON.stringify({
          name,
          location: newBranchLocation.trim() || null,
          latitude: newBranchLatitude === "" ? null : Number(newBranchLatitude),
          longitude: newBranchLongitude === "" ? null : Number(newBranchLongitude),
        }),
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

  <NavLink to="/manager/locations">
    Locations
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
            value={activeBranchId}
            onChange={(event) => switchBranch(event.target.value)}
            aria-label="Active branch"
          >
            {branches.map((branch) => (
              <option value={branch.id} key={branch.id}>{branch.name}</option>
            ))}
          </select>
        </label>

        <details className="manager-branch-tools">
          <summary>Add branch</summary>
          <form className="manager-branch-form" onSubmit={addBranch}>
            <input
              value={newBranchName}
              onChange={(event) => setNewBranchName(event.target.value)}
              aria-label="New branch name"
              placeholder="Branch name"
              maxLength={120}
              required
            />
            <input
              value={newBranchLocation}
              onChange={(event) => setNewBranchLocation(event.target.value)}
              aria-label="New branch address or location"
              placeholder="Address or location"
              maxLength={200}
            />
            <small className="manager-coordinate-help">Coordinates use decimal degrees.</small>
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              value={newBranchLatitude}
              onChange={(event) => setNewBranchLatitude(event.target.value)}
              aria-label="New branch latitude"
              placeholder="Latitude"
            />
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              value={newBranchLongitude}
              onChange={(event) => setNewBranchLongitude(event.target.value)}
              aria-label="New branch longitude"
              placeholder="Longitude"
            />
            <button type="submit">Create</button>
            {branchError && <span className="manager-branch-error" role="alert">{branchError}</span>}
          </form>
        </details>

        <details className="manager-branch-tools">
          <summary>Branch location</summary>
          {selectedBranch ? (
            <BranchLocationEditor
              key={selectedBranch.id}
              branch={selectedBranch}
              onSaved={(updated) => setBranches((current) => current.map((branch) => (
                branch.id === updated.id ? updated : branch
              )))}
            />
          ) : (
            <div className="manager-branch-form manager-branch-loading">Loading branch details…</div>
          )}
        </details>

        <button onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default ManagerNav;
