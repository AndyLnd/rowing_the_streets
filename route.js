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
  name: 'Müggelspree, Berlin-Müggelheim → Hessenwinkel',
  points: [
    [52.42522, 13.65883],
    [52.42463, 13.65773],
    [52.41672, 13.65366],
    [52.41506, 13.6567],
    [52.41726, 13.65998],
    [52.41754, 13.66088],
    [52.41763, 13.66277],
    [52.41748, 13.66544],
    [52.41699, 13.66736],
    [52.41613, 13.66905],
    [52.42062, 13.67568],
    [52.41841, 13.68002],
    [52.42003, 13.68207],
    [52.41975, 13.68268],
  ],
};
