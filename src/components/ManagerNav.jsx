import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch, setActiveBranchId } from "../api/client";
import GoogleLocationInput from "./GoogleLocationInput";
import { clearPendingManagerSuccess, getPendingManagerSuccess, MANAGER_SUCCESS_EVENT, showManagerSuccess } from "../utils/managerToast";

function BranchLocationEditor({ branch, onSaved }) {
  const [location, setLocation] = useState(branch.location || "");
  const [googlePlaceId, setGooglePlaceId] = useState(branch.google_place_id || "");
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
          google_place_id: googlePlaceId || null,
          latitude: googlePlaceId || location.trim() !== (branch.location || "") ? null : branch.latitude,
          longitude: googlePlaceId || location.trim() !== (branch.location || "") ? null : branch.longitude,
        }),
      });
      onSaved(result.branch);
      window.dispatchEvent(new CustomEvent("techpoint:branch-location-updated", {
        detail: result.branch,
      }));
      showManagerSuccess("Branch location saved.");
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <form className="manager-branch-form" onSubmit={save}>
      <GoogleLocationInput
        value={location}
        label="Branch address or location"
        onChange={(value) => {
          setLocation(value);
          setGooglePlaceId("");
          setSaved(false);
        }}
        onPlaceSelected={(place) => {
          setLocation(place.location);
          setGooglePlaceId(place.googlePlaceId);
          setSaved(false);
        }}
      />
      <small className="manager-branch-help">Choose a Google Maps suggestion to link this branch to a mappable location.</small>
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
  const [newBranchGooglePlaceId, setNewBranchGooglePlaceId] = useState("");
  const [branchError, setBranchError] = useState("");
  const [branchLocationExpanded, setBranchLocationExpanded] = useState(false);
  const [successMessage, setSuccessMessage] = useState(getPendingManagerSuccess);
  const activeBranchId = user.active_branch_id || user.branch_id;
  const selectedBranch = branches.find((branch) => String(branch.id) === String(activeBranchId));

  useEffect(() => {
    clearPendingManagerSuccess();
    const handleSuccess = (event) => setSuccessMessage(event.detail?.message || "Action completed.");
    window.addEventListener(MANAGER_SUCCESS_EVENT, handleSuccess);
    return () => window.removeEventListener(MANAGER_SUCCESS_EVENT, handleSuccess);
  }, []);

  useEffect(() => {
    if (!successMessage) return undefined;
    const timeout = window.setTimeout(() => setSuccessMessage(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  useEffect(() => {
    let active = true;
    apiFetch("/auth/branches")
      .then((data) => {
        if (active) setBranches(data.branches || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user.tenant_id]);

  const switchBranch = (branchId, success = "Branch switched.") => {
    setActiveBranchId(branchId);
    showManagerSuccess(success, { persist: true });
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
          google_place_id: newBranchGooglePlaceId || null,
          latitude: null,
          longitude: null,
        }),
      });
      switchBranch(result.branch.id, `Branch “${result.branch.name || name}” created and selected.`);
    } catch (error) {
      setBranchError(error.message);
    }
  };

  return (
    <>
      <aside className="manager-sidebar" aria-label="Manager navigation">
        <div className="manager-brand">
          <h1>TechPoint</h1>
          <p>{user.business?.name || "Manager Portal"}</p>
        </div>

        <nav className="manager-nav" aria-label="Manager sections">
          <NavLink to="/manager">Dashboard</NavLink>
          <NavLink to="/manager/sales">Sales</NavLink>
          <NavLink to="/manager/products">Products &amp; Inventory</NavLink>
          <NavLink to="/manager/purchasing">Purchasing</NavLink>
          <NavLink to="/manager/shifts">Shifts</NavLink>
          <NavLink to="/manager/locations">Shops &amp; map</NavLink>
          <NavLink to="/manager/audit">Audit</NavLink>
          <NavLink to="/manager/cashiers">Cashiers</NavLink>
        </nav>
      </aside>

      <header className="manager-topbar" aria-label="Manager account and branch controls">
        <span className="manager-topbar-welcome">Welcome, {user.username}</span>
        <div className="manager-topbar-controls">
          <label className="manager-branch-picker">
            <span>Branch</span>
            <select
              value={activeBranchId}
              onChange={(event) => {
                const branch = branches.find((item) => String(item.id) === event.target.value);
                switchBranch(event.target.value, `Switched to ${branch?.name || "selected branch"}.`);
              }}
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
              <GoogleLocationInput
                value={newBranchLocation}
                label="New branch address or location"
                onChange={(value) => {
                  setNewBranchLocation(value);
                  setNewBranchGooglePlaceId("");
                }}
                onPlaceSelected={(place) => {
                  setNewBranchLocation(place.location);
                  setNewBranchGooglePlaceId(place.googlePlaceId);
                }}
              />
              <small className="manager-branch-help">Choose a Google Maps suggestion to link this branch to a mappable location.</small>
              <button type="submit">Create</button>
              {branchError && <span className="manager-branch-error" role="alert">{branchError}</span>}
            </form>
          </details>

          <details
            className="manager-branch-tools"
            onToggle={(event) => setBranchLocationExpanded(event.currentTarget.open)}
          >
            <summary>Branch location</summary>
            {branchLocationExpanded && selectedBranch ? (
              <BranchLocationEditor
                key={selectedBranch.id}
                branch={selectedBranch}
                onSaved={(updated) => setBranches((current) => current.map((branch) => (
                  branch.id === updated.id ? updated : branch
                )))}
              />
            ) : branchLocationExpanded ? (
              <div className="manager-branch-form manager-branch-loading">Loading branch details…</div>
            ) : null}
          </details>

          <button className="manager-logout" onClick={onLogout}>Logout</button>
        </div>
        {successMessage && <div className="manager-success-toast" role="status">{successMessage}</div>}
      </header>
    </>
  );
}

export default ManagerNav;
