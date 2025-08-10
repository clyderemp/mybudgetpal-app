import React, { useState, useEffect } from "react";
import { LocateFixed } from "lucide-react";

const LocationCard = () => {
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [address, setAddress] = useState({ city: "", region: "", country: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLocation = () => {
    setLoading(true);
    setError("");

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const lat = latitude.toFixed(5);
        const lon = longitude.toFixed(5);
        setCoords({ latitude: lat, longitude: lon });

        try {
          // BigDataCloud free reverse geocoding endpoint (no key required)
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
          );
          const data = await res.json();
          setAddress({
            city: data.city || data.locality || "",
            region: data.principalSubdivision || "",
            country: data.countryName?.split("(")[0].trim() || "",
          });
        } catch (err) {
          setError("Failed to retrieve location details.");
        }

        setLoading(false);
      },
      () => {
        setError("Failed to get your location.");
        setLoading(false);
      }
    );
  };

  useEffect(fetchLocation, []);

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LocateFixed className="w-5 h-5 text-primary" />
          Your Location
        </h2>
        <button
          onClick={fetchLocation}
          className="text-sm text-blue-600 hover:underline"
        >
          Recalibrate
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500">Getting location...</p>}

      {!loading && error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && coords.latitude && (
        <div className="text-sm text-gray-800 space-y-1">
          <p>
            <strong>Latitude:</strong> {coords.latitude}
          </p>
          <p>
            <strong>Longitude:</strong> {coords.longitude}
          </p>
          <p>
            <strong>City:</strong> {address.city || "N/A"}
          </p>
          <p>
            <strong>Region:</strong> {address.region || "N/A"}
          </p>
          <p>
            <strong>Country:</strong> {address.country || "N/A"}
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationCard;
