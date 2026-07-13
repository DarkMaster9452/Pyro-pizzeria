"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Street map (MapLibre GL + OpenStreetMap raster tiles, no access token).
// Clearly legible in both light/dark UI, with zoom/compass, fullscreen and
// locate controls and a brand marker.
const OSM_TILES = [
  "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
  "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
];

export default function MapView({
  lat,
  lng,
  label,
  accent = "#E85D04",
  zoom = 16,
}: {
  lat: number;
  lng: number;
  label?: string;
  accent?: string;
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: OSM_TILES,
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [lng, lat],
      zoom,
      attributionControl: false,
    });

    // The container is often sized after the map is created (dynamic import,
    // grid layout) — resize once tiles are ready so the map fills its card.
    map.on("load", () => map.resize());

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right"
    );
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right"
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    const marker = new maplibregl.Marker({ color: accent }).setLngLat([
      lng,
      lat,
    ]);
    if (label) {
      marker.setPopup(
        new maplibregl.Popup({ offset: 28, closeButton: false }).setHTML(
          `<strong>${label}</strong>`
        )
      );
    }
    marker.addTo(map);

    return () => map.remove();
  }, [lat, lng, label, accent, zoom]);

  return <div ref={ref} className="h-full min-h-[400px] w-full" />;
}
