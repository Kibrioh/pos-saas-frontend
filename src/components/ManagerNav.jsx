import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch, setActiveBranchId } from "../api/client";
import GoogleLocationInput from "./GoogleLocationInput";
import BranchCoordinatesPicker from "./BranchCoordinatesPicker";
import { clearPendingManagerSuccess, getPendingManagerSuccess, MANAGER_SUCCESS_EVENT, showManagerSuccess } from "../utils/managerToast";

function BranchLocationEditor({ branch, onSaved }) {
  const [location, setLocation] = useState(branch.location || "");
  const [googlePlaceId, setGooglePlaceId] = useState(branch.google_place_id || "");
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
          google_place_id: googlePlaceId || null,
          latitude: googlePlaceId || latitude === "" ? null : latitude,
          longitude: googlePlaceId || longitude === "" ? null : longitude,
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
          setLatitude("");
          setLongitude("");
          setSaved(false);
        }}
      />
      <BranchCoordinatesPicker
        latitude={latitude}
        longitude={longitude}
        onChange={(nextLatitude, nextLongitude) => {
          setLatitude(nextLatitude);
          setLongitude(nextLongitude);
          setGooglePlaceId("");
          setSaved(false);
        }}
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
  const [newBranchGooglePlaceId, setNewBranchGooglePlaceId] = useState("");
  const [newBranchLatitude, setNewBranchLatitude] = useState("");
  const [newBranchLongitude, setNewBranchLongitude] = useState("");
  const [branchError, setBranchError] = useState("");
  const [branchLocationExpanded, setBranchLocationExpanded] = useState(false);
  const [successToast, setSuccessToast] = useState(getPendingManagerSuccess);
  const activeBranchId = user.active_branch_id || user.branch_id;
  const selectedBranch = branches.find((branch) => String(branch.id) === String(activeBranchId));

  useEffect(() => {
    clearPendingManagerSuccess();
    const handleSuccess = (event) => setSuccessToast({
      message: event.detail?.message || "Action completed.",
      position: event.detail?.position || null,
    });
    window.addEventListener(MANAGER_SUCCESS_EVENT, handleSuccess);
    return () => window.removeEventListener(MANAGER_SUCCESS_EVENT, handleSuccess);
  }, []);

  useEffect(() => {
    if (!successToast) return undefined;
    const timeout = window.setTimeout(() => setSuccessToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [successToast]);

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
          latitude: newBranchGooglePlaceId || newBranchLatitude === "" ? null : newBranchLatitude,
          longitude: newBranchGooglePlaceId || newBranchLongitude === "" ? null : newBranchLongitude,
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
        <div className="manager-topbar-intro">
          <span className="manager-topbar-eyebrow">Manager workspace</span>
          <span className="manager-topbar-welcome">Welcome back, {user.name || user.username}</span>
        </div>
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
                  setNewBranchLatitude("");
                  setNewBranchLongitude("");
                }}
              />
              <BranchCoordinatesPicker
                latitude={newBranchLatitude}
                longitude={newBranchLongitude}
                onChange={(latitude, longitude) => {
                  setNewBranchLatitude(latitude);
                  setNewBranchLongitude(longitude);
                  setNewBranchGooglePlaceId("");
                }}
              />
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

          <NavLink className="manager-profile-link" to="/manager/profile" aria-label="Open manager profile">
            <span className="manager-profile-link-avatar" aria-hidden="true">
              {(user.name || user.username || "M").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>
            <span className="manager-profile-link-copy">
              <strong>My profile</strong>
              <small>Account settings</small>
            </span>
          </NavLink>

          <button className="manager-logout" onClick={onLogout}>Logout</button>
        </div>
        {successToast && (
          <div
            className="manager-success-toast"
            role="status"
            style={successToast.position ? {
              left: `${successToast.position.left}px`,
              top: `${successToast.position.top}px`,
              right: "auto",
            } : undefined}
          >
            {successToast.message}
          </div>
        )}
      </header>
    </>
  );
}

export default ManagerNav;
