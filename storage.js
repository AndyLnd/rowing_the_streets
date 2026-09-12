const KEY = 'row.routes';
const HUD_KEY = 'row.hud';

export function listRoutes() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveRoute(name, points) {
  const routes = listRoutes();
  const id = crypto.randomUUID?.() ?? String(Date.now());
  routes.push({ id, name, points });
  localStorage.setItem(KEY, JSON.stringify(routes));
  return id;
}

export function deleteRoute(id) {
  localStorage.setItem(KEY, JSON.stringify(listRoutes().filter((route) => route.id !== id)));
}

export function encodeRoute(points) {
  return points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(';');
}

export function decodeRoute(text) {
  const points = text.split(';').map((pair) => pair.split(',').map(Number));
  const valid = points.length >= 2 && points.every(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  return valid ? points : null;
}

export function getHudFields() {
  try {
    const raw = JSON.parse(localStorage.getItem(HUD_KEY));
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setHudFields(fields) {
  localStorage.setItem(HUD_KEY, JSON.stringify(fields));
}
