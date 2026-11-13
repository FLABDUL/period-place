"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import type { LocationMapItem } from "@/lib/location-search";

export function MapPanel({ locations, selected, onSelect }: { locations: LocationMapItem[]; selected: string | null; onSelect: (slug: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = new MapLibreMap({
      container: container.current,
      style: { version: 8, sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } }, layers: [{ id: "osm", type: "raster", source: "osm" }] },
      center: [-3.4, 54.8],
      zoom: 5,
      cooperativeGestures: true,
    });
    map.current.addControl(new NavigationControl(), "top-right");
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = locations.map((location) => {
      const element = document.createElement("div");
      element.className = "map-marker";
      element.dataset.slug = location.slug;
      element.title = `${location.name}, ${location.city}, ${location.nation}`;
      element.setAttribute("aria-hidden", "true");
      element.addEventListener("click", () => onSelect(location.slug));
      return new Marker({ element }).setLngLat([location.longitude, location.latitude]).addTo(currentMap);
    });
    if (locations.length) {
      const bounds = new LngLatBounds();
      locations.forEach(({ longitude, latitude }) => bounds.extend([longitude, latitude]));
      currentMap.fitBounds(bounds, { padding: 65, maxZoom: 12, duration: 500 });
    }
  }, [locations, onSelect]);

  useEffect(() => {
    markers.current.forEach((marker) => marker.getElement().classList.toggle("selected", marker.getElement().dataset.slug === selected));
  }, [locations, selected]);

  return <div ref={container} className="map" role="region" aria-label={`Map showing ${locations.length} locations. Use the matching locations list for accessible location details.`} />;
}
