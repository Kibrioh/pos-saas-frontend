import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiFetch, setActiveBranchId } from "../api/client";
import { resolveGooglePlaceCoordinates } from "../api/googlePlaces";
import GoogleLocationInput from "./GoogleLocationInput";

function BranchLocationEditor({ branch, onSaved }) {
  const [location, setLocation] = useState(branch.location || "");
  const [latitude, setLatitude] = useState(branch.latitude == null ? "" : String(branch.latitude));
  const [longitude, setLongitude] = useState(branch.longitude == null ? "" : String(branch.longitude));
  const [googlePlaceId, setGooglePlaceId] = useState(branch.google_place_id || "");
  const [placeCoordinatesLoading, setPlaceCoordinatesLoading] = useState(false);
  const [placeCoordinatesError, setPlaceCoordinatesError] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!googlePlaceId || latitude !== "" || longitude !== "") {
      setPlaceCoordinatesLoading(false);
      return undefined;
    }
    let active = true;
    setPlaceCoordinatesLoading(true);
    setPlaceCoordinatesError("");
    resolveGooglePlaceCoordinates(googlePlaceId)
      .then((coordinates) => {
        if (!active) return;
        if (coordinates) {
          setLatitude(String(coordinates.latitude));
          setLongitude(String(coordinates.longitude));
        } else {
          setPlaceCoordinatesError("Google did not return coordinates for the saved place. Select the location again or enter coordinates manually.");
        }
      })
      .catch(() => {
        if (active) setPlaceCoordinatesError("Google coordinates could not be loaded. Check the Google Maps key or enter coordinates manually.");
      })
      .finally(() => {
        if (active) setPlaceCoordinatesLoading(false);
      });
    return () => { active = false; };
  }, [branch.id, googlePlaceId, latitude, longitude]);

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
          latitude: googlePlaceId || latitude === "" ? null : Number(latitude),
          longitude: googlePlaceId || longitude === "" ? null : Number(longitude),
        }),
      });
      onSaved(result.branch);
      window.dispatchEvent(new CustomEvent("techpoint:branch-location-updated", {
        detail: result.branch,
      }));
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
          setPlaceCoordinatesError("");
          setLatitude("");
          setLongitude("");
          setSaved(false);
        }}
        onPlaceSelected={(place) => {
          setLocation(place.location);
          setGooglePlaceId(place.googlePlaceId);
          setPlaceCoordinatesError("");
          setLatitude(String(place.latitude));
          setLongitude(String(place.longitude));
          setSaved(false);
        }}
      />
      <small className="manager-coordinate-help">
        {placeCoordinatesLoading
          ? "Loading coordinates for the saved Google place…"
          : "Google coordinates are resolved when needed. You can enter and save coordinates manually (decimal degrees)."}
      </small>
      {placeCoordinatesError && <span className="manager-branch-error" role="status">{placeCoordinatesError}</span>}
      <input
        type="number"
        step="any"
        min="-90"
        max="90"
        value={latitude}
        onChange={(event) => {
          setLatitude(event.target.value);
          if (googlePlaceId) setLongitude("");
          setGooglePlaceId("");
          setPlaceCoordinatesError("");
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
          if (googlePlaceId) setLatitude("");
          setGooglePlaceId("");
          setPlaceCoordinatesError("");
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
  const [newBranchGooglePlaceId, setNewBranchGooglePlaceId] = useState("");
  const [branchError, setBranchError] = useState("");
  const [branchLocationExpanded, setBranchLocationExpanded] = useState(false);
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
          google_place_id: newBranchGooglePlaceId || null,
          latitude: newBranchGooglePlaceId || newBranchLatitude === "" ? null : Number(newBranchLatitude),
          longitude: newBranchGooglePlaceId || newBranchLongitude === "" ? null : Number(newBranchLongitude),
        }),
      });
      switchBranch(result.branch.id);
    } catch (error) {
      setBranchError(error.message);
    }
  };

  return (
    <aside className="manager-sidebar" aria-label="Manager navigation and branch settings">
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
            <GoogleLocationInput
              value={newBranchLocation}
              label="New branch address or location"
              onChange={(value) => {
                setNewBranchLocation(value);
                setNewBranchGooglePlaceId("");
                setNewBranchLatitude("");
                setNewBranchLongitude("");
              }}
              onPlaceSelected={(place) => {
                setNewBranchLocation(place.location);
                setNewBranchGooglePlaceId(place.googlePlaceId);
                setNewBranchLatitude(String(place.latitude));
                setNewBranchLongitude(String(place.longitude));
              }}
            />
            <small className="manager-coordinate-help">Choose a Google Maps suggestion or enter coordinates manually (decimal degrees). Google coordinates are resolved when needed; only manual coordinates are saved.</small>
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              value={newBranchLatitude}
              onChange={(event) => {
                setNewBranchLatitude(event.target.value);
                if (newBranchGooglePlaceId) setNewBranchLongitude("");
                setNewBranchGooglePlaceId("");
              }}
              aria-label="New branch latitude"
              placeholder="Latitude"
            />
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              value={newBranchLongitude}
              onChange={(event) => {
                setNewBranchLongitude(event.target.value);
                if (newBranchGooglePlaceId) setNewBranchLatitude("");
                setNewBranchGooglePlaceId("");
              }}
              aria-label="New branch longitude"
              placeholder="Longitude"
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

        <button onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default ManagerNav;
