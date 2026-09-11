import { kpFromRows } from "./radio.ts";
import { useAtlas } from "./store.ts";

export async function requestHere(): Promise<{ lat: number; lon: number }> {
  if (!navigator.geolocation) throw new Error("geolocation unavailable");
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 9000,
      maximumAge: 300_000,
    });
  });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude };
}

export async function pinHere(fly = true) {
  const here = await requestHere();
  const st = useAtlas.getState();
  st.setHere(here);
  if (fly) st.flyTo({ ...here, label: "Here", dist: 2.15, site: "here" });
  return here;
}

export async function pollIss() {
  const res = await fetch("https://api.wheretheiss.at/v1/satellites/25544");
  if (!res.ok) throw new Error("iss feed");
  const d = (await res.json()) as {
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
  };
  useAtlas.getState().setIss({
    lat: d.latitude,
    lon: d.longitude,
    alt: d.altitude,
    vel: d.velocity / 3600,
  });
}

export async function pollSpaceWx() {
  const res = await fetch("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json");
  if (!res.ok) throw new Error("swpc kp");
  useAtlas.getState().setKp(kpFromRows(await res.json()));
}
