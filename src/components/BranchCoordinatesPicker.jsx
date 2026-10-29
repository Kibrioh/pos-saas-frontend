import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [-1.286389, 36.817223];

function validCoordinates(latitude, longitude) {
  if (latitude == null || longitude == null || latitude === "" || longitude === "") return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function BranchCoordinatesPicker({ latitude, longitude, onChange }) {
  const mapElement = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const initialCoordinates = useRef({ latitude, longitude });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapElement.current) return undefined;
    const { latitude: initialLatitude, longitude: initialLongitude } = initialCoordinates.current;
    const hasCoordinates = validCoordinates(initialLatitude, initialLongitude);
    const center = hasCoordinates
      ? [Number(initialLatitude), Number(initialLongitude)]
      : DEFAULT_CENTER;
    const map = L.map(mapElement.current, { scrollWheelZoom: false })
      .setView(center, hasCoordinates ? 14 : 6);
    mapRef.current = map;

    const tileUrl = import.meta.env.VITE_MAP_TILE_URL
      || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: import.meta.env.VITE_MAP_ATTRIBUTION
        || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    if (hasCoordinates) {
      markerRef.current = L.circleMarker(center, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#41644a",
        fillOpacity: 1,
      }).addTo(map);
    }

    map.on("click", (event) => {
      const nextLatitude = event.latlng.lat;
      const nextLongitude = event.latlng.lng;
      if (markerRef.current) {
        markerRef.current.setLatLng(event.latlng);
      } else {
        markerRef.current = L.circleMarker(event.latlng, {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: "#41644a",
          fillOpacity: 1,
        }).addTo(map);
      }
      onChangeRef.current(nextLatitude.toFixed(7), nextLongitude.toFixed(7));
    });

    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 0);
    return () => {
      window.clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!validCoordinates(latitude, longitude)) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const point = [Number(latitude), Number(longitude)];
    if (markerRef.current) {
      markerRef.current.setLatLng(point);
    } else {
      markerRef.current = L.circleMarker(point, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#41644a",
        fillOpacity: 1,
      }).addTo(map);
    }
  }, [latitude, longitude]);

  return (
    <div className="branch-coordinate-picker">
      <div className="branch-coordinate-inputs">
        <label>
          <span>Latitude</span>
          <input
            type="number"
            min="-90"
            max="90"
            step="any"
            value={latitude}
            onChange={(event) => onChange(event.target.value, longitude)}
            placeholder="e.g. -1.286389"
            aria-label="Branch latitude"
          />
        </label>
        <label>
          <span>Longitude</span>
          <input
            type="number"
            min="-180"
            max="180"
            step="any"
            value={longitude}
            onChange={(event) => onChange(latitude, event.target.value)}
            placeholder="e.g. 36.817223"
            aria-label="Branch longitude"
          />
        </label>
      </div>
      <p className="branch-coordinate-hint">Enter coordinates above, or click the map to drop a pin.</p>
      <div
        className="branch-coordinate-map"
        ref={mapElement}
        role="application"
        aria-label="Click on the map to select branch coordinates"
      />
      {validCoordinates(latitude, longitude) && (
        <small className="branch-coordinate-value" role="status">
          Pin: {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}
        </small>
      )}
    </div>
  );
}

export default BranchCoordinatesPicker;
