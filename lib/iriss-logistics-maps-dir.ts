/** Google Maps maršruta saite tikai ar atzīmētajiem punktiem (līdz 9 starppunktiem). */

export type LogisticsDirPoint = { lat: number; lng: number };

export function logisticsGoogleMapsDirUrl(points: readonly LogisticsDirPoint[]): string | null {
  const usable = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (usable.length === 0) return null;
  const origin = usable[0]!;
  const destination = usable[usable.length - 1]!;
  const middle = usable.slice(1, -1).slice(0, 9);
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "driving",
  });
  if (middle.length) {
    params.set("waypoints", middle.map((p) => `${p.lat},${p.lng}`).join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function logisticsGoogleMapsPlaceUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
