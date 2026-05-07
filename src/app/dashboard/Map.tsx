"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { Job } from "@jobtracker/db";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function JobsMap({ jobs }: { jobs: Job[] }) {
  const located = jobs.filter(
    (j): j is Job & { lat: number; lng: number } =>
      typeof j.lat === "number" && typeof j.lng === "number"
  );
  const center =
    located.length > 0
      ? ([located[0].lat, located[0].lng] as [number, number])
      : ([20, 0] as [number, number]);
  return (
    <MapContainer
      center={center}
      zoom={located.length > 0 ? 4 : 2}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {located.map((j) => (
        <Marker key={j.id} position={[j.lat, j.lng]} icon={icon}>
          <Popup>
            <div className="text-sm">
              <a
                href={j.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                {j.title || "(untitled)"}
              </a>
              <div className="text-xs text-black/60">
                {j.company} · {j.location}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
