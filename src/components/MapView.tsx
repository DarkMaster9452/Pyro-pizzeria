"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useApp } from "@/lib/store";

// mapcn-style map (MapLibre GL + CARTO basemaps, no access token). Light/dark
// aware, with zoom/compass, fullscreen and locate controls and a brand marker.
const CARTO = (variant: "light_all" | "dark_all") =>
  ["a", "b", "c", "d"].map(
    (s) =>
      `https://${s}.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}.png`
  );

export default function MapView({
  lat,
  lng,
  label,
  accent = "#E85D04",
  zoom = 14,
}: {
  lat: number;
  lng: number;
  label?: string;
  accent?: string;
  zoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useApp((s) => s.theme);

  useEffect(() => {
    if (!ref.current) return;
    const dark = theme === "dark";
    const map = new maplibregl.Map({
      container: ref.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: "raster",
            tiles: CARTO(dark ? "dark_all" : "light_all"),
            tileSize: 256,
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [{ id: "basemap", type: "raster", source: "basemap" }],
      },
      center: [lng, lat],
      zoom,
      attributionControl: false,
    });

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
  }, [lat, lng, label, accent, zoom, theme]);

  return <div ref={ref} className="h-full min-h-[400px] w-full" />;
}
