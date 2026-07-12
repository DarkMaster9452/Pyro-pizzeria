"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Satellite map (MapLibre GL + Esri World Imagery, no access token). Bright and
// clear in both light/dark UI, with a place-name overlay for readability, plus
// zoom/compass, fullscreen and locate controls and a brand marker.
const ESRI_SATELLITE =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_LABELS =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

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
          satellite: {
            type: "raster",
            tiles: [ESRI_SATELLITE],
            tileSize: 256,
            attribution:
              'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
          },
          labels: {
            type: "raster",
            tiles: [ESRI_LABELS],
            tileSize: 256,
          },
        },
        layers: [
          { id: "satellite", type: "raster", source: "satellite" },
          { id: "labels", type: "raster", source: "labels" },
        ],
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
  }, [lat, lng, label, accent, zoom]);

  return <div ref={ref} className="h-full min-h-[400px] w-full" />;
}
