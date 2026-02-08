"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const MAP_DEFAULT_ZOOM = 15;
const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const MARKER_ICON_URL = "/leaflet/marker-icon.png";
const MARKER_ICON_RETINA_URL = "/leaflet/marker-icon-2x.png";
const MARKER_SHADOW_URL = "/leaflet/marker-shadow.png";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

interface EventMapProps {
  latitude: number | null;
  longitude: number | null;
  location: string;
}

export function EventMap({ latitude, longitude, location }: EventMapProps) {
  useEffect(() => {
    let isActive = true;

    const configureLeafletIcons = async () => {
      const leaflet = await import("leaflet");
      if (!isActive) return;

      const L = leaflet.default;
      const iconPrototype = L.Icon.Default.prototype as {
        _getIconUrl?: () => string;
      };

      if (iconPrototype._getIconUrl) {
        delete iconPrototype._getIconUrl;
      }

      L.Icon.Default.mergeOptions({
        iconRetinaUrl: MARKER_ICON_RETINA_URL,
        iconUrl: MARKER_ICON_URL,
        shadowUrl: MARKER_SHADOW_URL,
      });
    };

    void configureLeafletIcons();

    return () => {
      isActive = false;
    };
  }, []);

  if (latitude === null || longitude === null) {
    return null;
  }

  return (
    <div className="w-full h-60 sm:h-72 md:h-80 rounded-lg overflow-hidden border border-gray-300">
      <MapContainer
        center={[latitude, longitude]}
        zoom={MAP_DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />
        <Marker position={[latitude, longitude]}>
          <Popup>{location}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
