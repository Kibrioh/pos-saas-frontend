import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetch } from "../api/client";
import { loadGoogleMapsLibrary, resolveGooglePlaceCoordinates } from "../api/googlePlaces";
import { formatKsh, toKsh } from "../utils/formatPrice";

function dateInTimezone(date, timezone = "Africa/Nairobi") {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function moveDate(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatPercent(value) {
  return value == null ? "—" : `${Number(value).toFixed(1)}%`;
}

function BranchMap({ branches, hasLoaded }) {
  const mapElement = useRef(null);
  const resolvedPlaceCoordinates = useRef(new Map());
  const [mapError, setMapError] = useState("");
  const [placeResolutionStatus, setPlaceResolutionStatus] = useState("idle");
  const [resolvedBranches, setResolvedBranches] = useState(branches);
  const useGoogleMaps = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const unresolvedGooglePlaces = branches.some((branch) => (
    branch.google_place_id
    && (branch.latitude == null || branch.longitude == null)
    && !resolvedPlaceCoordinates.current.has(branch.google_place_id)
  ));
  useEffect(() => {
    let active = true;
    const branchesWithCachedCoordinates = branches.map((branch) => {
      if (branch.latitude != null && branch.longitude != null) return branch;
      const cached = resolvedPlaceCoordinates.current.get(branch.google_place_id);
      return cached ? { ...branch, ...cached } : branch;
    });
    setResolvedBranches(branchesWithCachedCoordinates);
    const branchesToResolve = branches.filter((branch) => (
      branch.google_place_id
      && (branch.latitude == null || branch.longitude == null)
      && !resolvedPlaceCoordinates.current.has(branch.google_place_id)
    ));
    if (!branchesToResolve.length) {
      setPlaceResolutionStatus("idle");
      return () => { active = false; };
    }
    setPlaceResolutionStatus("loading");

    Promise.all(branchesToResolve.map(async (branch) => {
      try {
        const coordinates = await resolveGooglePlaceCoordinates(branch.google_place_id);
        return [String(branch.branch_id ?? branch.id), coordinates, !coordinates];
      } catch {
        return [String(branch.branch_id ?? branch.id), null, true];
      }
    })).then((resolved) => {
      if (!active) return;
      resolved.forEach(([, coordinates, failed], index) => {
        if (!failed && coordinates) {
          resolvedPlaceCoordinates.current.set(branchesToResolve[index].google_place_id, coordinates);
        }
      });
      const coordinatesByBranch = new Map(resolved.map(([branchId, coordinates]) => [branchId, coordinates]));
      setResolvedBranches(branches.map((branch) => {
        const [coordinates] = coordinatesByBranch.get(String(branch.branch_id ?? branch.id)) || [];
        return coordinates ? { ...branch, ...coordinates } : branch;
      }));
      setPlaceResolutionStatus(resolved.some(([, , failed]) => failed) ? "error" : "idle");
    });

    return () => { active = false; };
  }, [branches]);

  const locations = useMemo(
    () => resolvedBranches.filter((branch) => (
      branch.latitude != null
      && branch.longitude != null
      && Number.isFinite(Number(branch.latitude))
      && Number.isFinite(Number(branch.longitude))
    )),
    [resolvedBranches]
  );

  useEffect(() => {
    if (!mapElement.current || !hasLoaded || (unresolvedGooglePlaces && placeResolutionStatus !== "error")) {
      return undefined;
    }

    if (useGoogleMaps) {
      let disposed = false;
      const markers = [];
      setMapError("");

      Promise.all([
        loadGoogleMapsLibrary("maps"),
        loadGoogleMapsLibrary("marker"),
        loadGoogleMapsLibrary("core"),
      ])
        .then(([googleMaps, markerLibrary, coreLibrary]) => {
          if (disposed || !mapElement.current) return;
          setMapError("");

          const map = new googleMaps.Map(mapElement.current, {
            center: { lat: -1.286389, lng: 36.817223 },
            zoom: 6,
            mapTypeControl: false,
            streetViewControl: false,
          });
          const maxSales = Math.max(...locations.map((branch) => toKsh(branch.net_sales)), 1);
          const bounds = new googleMaps.LatLngBounds();
          const infoWindow = new googleMaps.InfoWindow();
          locations.forEach((branch) => {
            const position = { lat: Number(branch.latitude), lng: Number(branch.longitude) };
            bounds.extend(position);
            const sales = Math.max(0, toKsh(branch.net_sales ?? 0));
            const radius = 8 + Math.sqrt(sales / maxSales) * 9;
            const marker = new markerLibrary.Marker({
              map,
              position,
              title: branch.branch_name || branch.name || "Shop",
              icon: {
                path: coreLibrary.SymbolPath.CIRCLE,
                scale: radius,
                fillColor: branch.is_active ? "#2563eb" : "#64748b",
                fillOpacity: 0.88,
                strokeColor: "#ffffff",
                strokeWeight: 2,
              },
            });
            markers.push(marker);

            const popup = document.createElement("div");
            const title = document.createElement("strong");
            title.textContent = branch.branch_name || branch.name || "Shop";
            popup.append(title);
            const details = [
              branch.is_active ? "Active shop" : "Inactive shop",
              branch.location,
              branch.net_sales != null && `Net sales: ${formatKsh(toKsh(branch.net_sales))}`,
              branch.transaction_count != null && `Transactions: ${branch.transaction_count}`,
              branch.low_stock_product_count != null && `Low stock products: ${branch.low_stock_product_count}`,
              branch.out_of_stock_product_count != null && `Out of stock products: ${branch.out_of_stock_product_count}`,
            ].filter(Boolean);
            details.forEach((text) => {
              const line = document.createElement("div");
              line.textContent = text;
              popup.append(line);
            });
            marker.addListener("click", () => {
              infoWindow.setContent(popup);
              infoWindow.open({ map, anchor: marker });
            });
          });

          if (locations.length === 1) {
            map.setCenter({ lat: Number(locations[0].latitude), lng: Number(locations[0].longitude) });
            map.setZoom(13);
          } else if (locations.length > 1) {
            map.fitBounds(bounds, 36);
          }
        })
        .catch((error) => {
          if (!disposed) setMapError(error.message || "Google Maps could not be loaded.");
        });

      return () => {
        disposed = true;
        markers.forEach((marker) => marker.setMap(null));
      };
    }

    const map = L.map(mapElement.current, { scrollWheelZoom: false });
    const tileUrl = import.meta.env.VITE_MAP_TILE_URL
      || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: import.meta.env.VITE_MAP_ATTRIBUTION
        || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const maxSales = Math.max(...locations.map((branch) => toKsh(branch.net_sales)), 1);
    const bounds = [];
    locations.forEach((branch) => {
      const point = [Number(branch.latitude), Number(branch.longitude)];
      bounds.push(point);
      const sales = Math.max(0, toKsh(branch.net_sales ?? 0));
      const radius = 8 + Math.sqrt(sales / maxSales) * 9;
      const marker = L.circleMarker(point, {
        radius,
        color: "#ffffff",
        weight: 2,
        fillColor: branch.is_active ? "#2563eb" : "#64748b",
        fillOpacity: 0.88,
      }).addTo(map);

      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = branch.branch_name || branch.name || "Shop";
      popup.append(title);
      const details = [
        branch.is_active ? "Active shop" : "Inactive shop",
        branch.location,
        branch.net_sales != null && `Net sales: ${formatKsh(toKsh(branch.net_sales))}`,
        branch.transaction_count != null && `Transactions: ${branch.transaction_count}`,
        branch.low_stock_product_count != null && `Low stock products: ${branch.low_stock_product_count}`,
        branch.out_of_stock_product_count != null && `Out of stock products: ${branch.out_of_stock_product_count}`,
      ].filter(Boolean);
      details.forEach((text) => {
        const line = document.createElement("div");
        line.textContent = text;
        popup.append(line);
      });
      marker.bindPopup(popup);
    });

    if (bounds.length === 1) {
      map.setView(bounds[0], 13);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    } else {
      map.setView([-1.286389, 36.817223], 6);
    }
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
    };
  }, [hasLoaded, locations, placeResolutionStatus, unresolvedGooglePlaces, useGoogleMaps]);

  return (
    <>
      {mapError && (
        <div className="location-map-notice" role="alert">
          <strong>Google Maps is unavailable.</strong>
          <span>{mapError} Check the browser key, its website restrictions, and that the Maps JavaScript API is enabled.</span>
        </div>
      )}
      {(placeResolutionStatus === "loading" || (unresolvedGooglePlaces && placeResolutionStatus !== "error")) && (
        <div className="location-map-notice" role="status">Resolving saved Google Maps locations…</div>
      )}
      {placeResolutionStatus === "error" && (
        <div className="location-map-notice" role="alert">
          <strong>Some saved Google locations could not be resolved.</strong>
          <span>Check that the Places API (New) is enabled and the browser key is available.</span>
        </div>
      )}
      {!locations.length && !unresolvedGooglePlaces && placeResolutionStatus === "idle" && (
        <div className="location-map-notice" role="status">
          <strong>No shop coordinates yet.</strong>
          <span>Use “Branch location” in the manager sidebar to add latitude and longitude. The map is centered on Kenya until shops are mapped.</span>
        </div>
      )}
      <div
        className={`location-map${mapError ? " location-map-unavailable" : ""}`}
        ref={mapElement}
        role="application"
        aria-label="Map of shop locations, with marker sizes based on net sales"
      />
    </>
  );
}

function LocationIntelligence() {
  const today = dateInTimezone(new Date());
  const [startDate, setStartDate] = useState(() => moveDate(today, -29));
  const [endDate, setEndDate] = useState(today);
  const [report, setReport] = useState(null);
  const [branchLocations, setBranchLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appliedRange, setAppliedRange] = useState({ start: startDate, end: endDate });

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      start_date: appliedRange.start,
      end_date: appliedRange.end,
    });
    apiFetch(`/reports/location-performance?${query}`)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [appliedRange]);

  useEffect(() => {
    let active = true;
    const updateBranchLocation = (event) => {
      const updatedBranch = event.detail;
      if (!updatedBranch) return;

      setBranchLocations((current) => current.map((branch) => (
        String(branch.id) === String(updatedBranch.id)
          ? { ...branch, ...updatedBranch }
          : branch
      )));
      setReport((current) => current && ({
        ...current,
        branches: current.branches.map((branch) => (
          String(branch.branch_id) === String(updatedBranch.id)
            ? {
              ...branch,
              location: updatedBranch.location,
              google_place_id: updatedBranch.google_place_id,
              latitude: updatedBranch.latitude,
              longitude: updatedBranch.longitude,
            }
            : branch
        )),
      }));
    };

    window.addEventListener("techpoint:branch-location-updated", updateBranchLocation);
    apiFetch("/auth/branches")
      .then((data) => {
        if (active) setBranchLocations(data.branches || []);
      })
      .catch(() => {});
    return () => {
      active = false;
      window.removeEventListener("techpoint:branch-location-updated", updateBranchLocation);
    };
  }, []);

  const applyDates = (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setAppliedRange({ start: startDate, end: endDate });
  };

  const summary = report?.summary;
  const mapBranches = report ? report.branches : loading ? [] : branchLocations;

  return (
    <main className="location-page">
      <section className="location-heading">
        <div>
          <p className="manager-page-kicker">BUSINESS PERFORMANCE</p>
          <h2>Location intelligence</h2>
          <p>Compare sales and inventory across your branches and see how performance varies by location.</p>
        </div>
        <form className="location-date-filter" onSubmit={applyDates}>
          <label>
            <span>From</span>
            <input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} required />
          </label>
          <label>
            <span>To</span>
            <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} required />
          </label>
          <button type="submit" disabled={loading}>Apply</button>
        </form>
      </section>

      {error && <div className="location-error" role="alert">{error}</div>}
      {loading && !report && <div className="location-loading">Loading location report…</div>}

      <section className="location-panel">
        <div className="location-panel-heading">
          <div>
            <h3>Shop distribution map</h3>
            <p>Each marker shows a shop. Blue marks active shops, gray marks inactive shops, and larger markers indicate higher net sales. Select a marker for shop details.</p>
          </div>
        </div>
            <BranchMap branches={mapBranches} hasLoaded={!loading} />
      </section>

      {report && (
        <>
          <section className="location-summary-grid" aria-label="Business totals for the selected period">
            <article className="location-summary-card">
              <span>Net sales</span>
              <strong>{formatKsh(toKsh(summary.net_sales))}</strong>
            </article>
            <article className="location-summary-card">
              <span>Transactions</span>
              <strong>{Number(summary.transaction_count).toLocaleString("en-KE")}</strong>
            </article>
            <article className="location-summary-card">
              <span>Average basket</span>
              <strong>{formatKsh(toKsh(summary.average_sale))}</strong>
            </article>
            <article className="location-summary-card">
              <span>Gross margin</span>
              <strong>{formatPercent(summary.gross_margin_rate)}</strong>
            </article>
            <article className="location-summary-card">
              <span>Branches mapped</span>
              <strong>{report.branch_count_with_coordinates} / {report.branch_count}</strong>
            </article>
          </section>

          <section className="location-panel">
            <div className="location-panel-heading">
              <div>
                <h3>Branch comparison</h3>
                <p>Current stock status is a snapshot; stockout events count sales that reduced stock to zero during the selected period.</p>
              </div>
            </div>
            {loading && <p className="location-refreshing">Refreshing report…</p>}
            <div className="location-table-scroll">
              <table className="location-table">
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Net sales</th>
                    <th>Transactions</th>
                    <th>Avg. basket</th>
                    <th>Gross profit</th>
                    <th>Margin</th>
                    <th>Refunds</th>
                    <th>Units sold</th>
                    <th>Low stock</th>
                    <th>Out of stock</th>
                    <th>Stockout events</th>
                  </tr>
                </thead>
                <tbody>
                  {report.branches.map((branch) => (
                    <tr key={branch.branch_id}>
                      <th scope="row">
                        <strong>{branch.branch_name}</strong>
                        <span>{branch.location || "Location not entered"} · {branch.is_active ? "Active" : "Inactive"}</span>
                      </th>
                      <td>{formatKsh(toKsh(branch.net_sales))}</td>
                      <td>{branch.transaction_count.toLocaleString("en-KE")}</td>
                      <td>{formatKsh(toKsh(branch.average_basket))}</td>
                      <td>{formatKsh(toKsh(branch.gross_profit))}</td>
                      <td>{formatPercent(branch.gross_margin_rate)}</td>
                      <td>{formatKsh(toKsh(branch.refund_total))}</td>
                      <td>{branch.net_units_sold.toLocaleString("en-KE")}</td>
                      <td>{branch.low_stock_product_count}</td>
                      <td>{branch.out_of_stock_product_count}</td>
                      <td>{branch.stockout_events}</td>
                    </tr>
                  ))}
                  {!report.branches.length && (
                    <tr><td colSpan="11" className="location-no-branches">No active branches found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default LocationIntelligence;
