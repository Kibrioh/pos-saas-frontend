import { useEffect, useId, useRef, useState } from "react";
import { loadGooglePlaces } from "../api/googlePlaces";

function GoogleLocationInput({ value, onChange, onPlaceSelected, label }) {
  const [placesLibrary, setPlacesLibrary] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("");
  const [focused, setFocused] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const sessionToken = useRef(null);
  const sessionStartedAt = useRef(0);
  const requestNumber = useRef(0);
  const listboxId = useId();

  useEffect(() => {
    if (!focused) return undefined;
    let mounted = true;
    loadGooglePlaces()
      .then((library) => {
        if (mounted) setPlacesLibrary(library);
      })
      .catch((error) => {
        if (mounted) setLoadError(error.message);
      });

    return () => { mounted = false; };
  }, [focused]);

  useEffect(() => {
    const currentRequest = ++requestNumber.current;
    const search = query.trim();

    if (!inputFocused || !placesLibrary || search.length < 3) {
      setSuggestions([]);
      setActiveIndex(-1);
      sessionToken.current = null;
      sessionStartedAt.current = 0;
      setLoading(false);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        if (!sessionToken.current || Date.now() - sessionStartedAt.current > 180000) {
          sessionToken.current = new placesLibrary.AutocompleteSessionToken();
          sessionStartedAt.current = Date.now();
        }
        const { suggestions: results = [] } = await placesLibrary.AutocompleteSuggestion
          .fetchAutocompleteSuggestions({
            input: search,
            sessionToken: sessionToken.current,
          });

        if (requestNumber.current === currentRequest) {
          const placeSuggestions = results.filter((item) => item.placePrediction);
          setSuggestions(placeSuggestions);
          setActiveIndex(placeSuggestions.length ? 0 : -1);
        }
      } catch {
        if (requestNumber.current === currentRequest) {
          setSuggestions([]);
          setSelectionError("Google Places suggestions are temporarily unavailable.");
        }
      } finally {
        if (requestNumber.current === currentRequest) setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [inputFocused, placesLibrary, query]);

  const selectPlace = async (prediction) => {
    setSuggestions([]);
    setActiveIndex(-1);
    setLoading(true);
    setSelectionError("");
    try {
      if (!prediction.placeId) {
        setSelectionError("Google did not return a place ID. Choose another suggestion or enter coordinates manually.");
        return;
      }
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["location"] });
      if (!place.location) {
        setSelectionError("Google did not return coordinates for that result. Enter latitude and longitude manually.");
        return;
      }

      onPlaceSelected({
        location: query.trim() || value.trim(),
        googlePlaceId: prediction.placeId,
        latitude: place.location.lat(),
        longitude: place.location.lng(),
      });
      setSelectedLabel(prediction.text.toString());
      setQuery("");
      sessionToken.current = null;
      sessionStartedAt.current = 0;
    } catch {
      setSelectionError("Could not load that place. Try another suggestion or enter coordinates manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setSelectionError("");
    setSelectedLabel("");
    onChange(nextValue);
    setQuery(nextValue);
  };

  const handleKeyDown = (event) => {
    if (!suggestions.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectPlace(suggestions[activeIndex].placePrediction);
    } else if (event.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  };

  return (
    <div
      className="manager-google-location"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setInputFocused(false);
          setSuggestions([]);
          setActiveIndex(-1);
        }
      }}
    >
      <input
        type="text"
        value={selectedLabel || value}
        onChange={handleChange}
        aria-label={label}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-expanded={suggestions.length > 0}
        onKeyDown={handleKeyDown}
        onFocus={(event) => {
          setFocused(true);
          setInputFocused(true);
          if (!selectedLabel) setQuery(event.currentTarget.value);
        }}
        placeholder="Search for a location"
        maxLength={200}
        autoComplete="off"
      />
      {loading && <small className="manager-geocode-status" role="status">Searching Google Maps…</small>}
      {suggestions.length > 0 && (
        <div className="manager-place-suggestions">
          <ul id={listboxId} role="listbox" aria-label="Google Maps suggestions">
            {suggestions.map((suggestion, index) => {
              const prediction = suggestion.placePrediction;
              return (
                <li key={`${prediction.placeId || prediction.text.toString()}-${index}`} role="presentation">
                  <button
                    type="button"
                    id={`${listboxId}-option-${index}`}
                    role="option"
                    aria-selected={activeIndex === index}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectPlace(prediction)}
                  >
                    {prediction.text.toString()}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="manager-google-attribution" aria-label="Google Maps attribution" translate="no">Google Maps</div>
        </div>
      )}
      {loadError && <small className="manager-geocode-status">Google suggestions unavailable; enter coordinates manually.</small>}
      {selectionError && <small className="manager-geocode-error" role="status">{selectionError}</small>}
      {selectedLabel && <small className="manager-geocode-status" role="status">Coordinates filled from the selected place.</small>}
      {selectedLabel && <small className="manager-google-attribution-inline" translate="no">Google Maps</small>}
      {!focused && !selectionError && (
        <small className="manager-geocode-status">Search Google Maps for a place, or enter coordinates manually.</small>
      )}
      {focused && !loadError && !selectionError && !selectedLabel && (
        <small className="manager-geocode-status">
          {placesLibrary ? "Type at least 3 characters and choose a Google Maps suggestion, or enter coordinates below." : "Loading Google Maps suggestions…"}
        </small>
      )}
    </div>
  );
}

export default GoogleLocationInput;
