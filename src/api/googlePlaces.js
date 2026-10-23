let mapsScriptPromise;

function loadGoogleMapsScript() {
  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps);
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error("Google Places suggestions are not configured. Enter coordinates manually or set VITE_GOOGLE_MAPS_API_KEY."),
    );
  }

  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise((resolve, reject) => {
    const callbackName = "__techpointGoogleMapsReady";
    const script = document.createElement("script");
    const query = new URLSearchParams({
      key: apiKey,
      v: "weekly",
      loading: "async",
      callback: callbackName,
    });

    window[callbackName] = async () => {
      try {
        resolve(window.google.maps);
      } catch (error) {
        mapsScriptPromise = undefined;
        reject(error);
      } finally {
        delete window[callbackName];
      }
    };

    script.src = `https://maps.googleapis.com/maps/api/js?${query.toString()}`;
    script.async = true;
    script.onerror = () => {
      mapsScriptPromise = undefined;
      delete window[callbackName];
      reject(new Error("Google Places could not be loaded. Check the API key and enabled Google Maps APIs."));
    };
    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

export async function loadGoogleMapsLibrary(libraryName) {
  const maps = await loadGoogleMapsScript();
  return maps.importLibrary(libraryName);
}

export function loadGooglePlaces() {
  return loadGoogleMapsLibrary("places");
}

export async function resolveGooglePlaceCoordinates(placeId) {
  if (!placeId) return null;
  const places = await loadGooglePlaces();
  const place = new places.Place({ id: placeId });
  await place.fetchFields({ fields: ["location"] });
  if (!place.location) return null;
  return {
    latitude: place.location.lat(),
    longitude: place.location.lng(),
  };
}
