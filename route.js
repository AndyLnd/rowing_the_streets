const EARTH_RADIUS = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(h));
}

export function bearing(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function buildRoute(latlngs) {
  const pts = latlngs.map(([lat, lng]) => ({ lat, lng }));
  let cumulative = 0;
  const points = pts.map((p, i) => {
    if (i > 0) cumulative += haversine(pts[i - 1], p);
    return { ...p, distance: cumulative };
  });
  return { points, length: cumulative };
}

export function pointAt(route, meters) {
  const pts = route.points;
  const target = Math.max(0, Math.min(meters, route.length));
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].distance <= target) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const segment = b.distance - a.distance;
  const t = segment > 0 ? (target - a.distance) / segment : 0;
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    bearing: bearing(a, b),
  };
}

export const DEMO_ROUTE = {
  name: 'Isar, München (Beispiel)',
  points: [
    [48.1495, 11.587],
    [48.144, 11.589],
    [48.1385, 11.5905],
    [48.133, 11.5905],
    [48.1275, 11.589],
    [48.122, 11.5865],
    [48.1165, 11.5845],
  ],
};
