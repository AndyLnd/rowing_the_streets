import { DEMO_ROUTE, buildRoute, pointAt } from './route.js';
import { fetchCarRoute } from './routing.js';

const FOLLOW_ZOOM = 16;

let route = buildRoute(DEMO_ROUTE.points);
let bounds = L.latLngBounds(route.points.map((p) => [p.lat, p.lng]));

let map;
let routeLine;
let startMarker;
let endMarker;
let trackLine;
let marker;
let layerControl;
let zoomControl;
let pick = null;
let tempStart = null;
let following = true;
let followViewSet = false;
let lastMeters = 0;
let lastPoint = null;
let mode = 'mini';
let onOpenFull = null;

const START = { radius: 7, color: '#34d399', fillColor: '#34d399', fillOpacity: 1 };
const END = { radius: 7, color: '#f87171', fillColor: '#f87171', fillOpacity: 1 };

export function getRoute() {
  return route;
}

export function getCurrentPoint() {
  return lastPoint;
}

export function getProgressMeters() {
  return Math.min(lastMeters, route.length);
}

export function invalidateMapSize() {
  if (map) map.invalidateSize();
}

export function initMap(containerId) {
  map = L.map(containerId, { zoomControl: false });
  map.attributionControl.setPrefix(false);
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
  });
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19, attribution: 'Tiles © Esri' },
  );
  streets.addTo(map);
  layerControl = L.control.layers({ Karte: streets, Satellit: satellite });

  routeLine = L.polyline([], { color: '#38bdf8', weight: 4, opacity: 0.8 }).addTo(map);
  startMarker = L.circleMarker([0, 0], START).addTo(map);
  endMarker = L.circleMarker([0, 0], END).addTo(map);
  trackLine = L.polyline([], { color: '#34d399', weight: 5, opacity: 0.9 }).addTo(map);
  marker = L.circleMarker([0, 0], { radius: 9, color: '#04121c', fillColor: '#38bdf8', fillOpacity: 1 }).addTo(map);

  map.on('dragstart', () => {
    following = false;
  });
  map.on('click', (event) => {
    if (mode === 'mini') {
      onOpenFull?.();
      return;
    }
    handlePick(event);
  });

  applyRoute(route.points.map((p) => [p.lat, p.lng]));
  setMapMode('mini');
}

export function setMapMode(next) {
  if (!map) return;
  mode = next;
  const full = next === 'full';
  const container = map.getContainer();
  container.classList.toggle('map--full', full);
  container.classList.toggle('map--mini', !full);
  for (const name of ['dragging', 'scrollWheelZoom', 'doubleClickZoom', 'touchZoom', 'boxZoom', 'keyboard']) {
    if (map[name]) map[name][full ? 'enable' : 'disable']();
  }
  if (layerControl) {
    if (full) layerControl.addTo(map);
    else layerControl.remove();
  }
  if (full) {
    zoomControl ??= L.control.zoom({ position: 'bottomright' });
    zoomControl.addTo(map);
  } else if (zoomControl) {
    zoomControl.remove();
  }
  setTimeout(() => map.invalidateSize(), 60);
}

export function setOpenFullHandler(handler) {
  onOpenFull = handler;
}

function applyRoute(latlngs) {
  route = buildRoute(latlngs);
  const coords = route.points.map((p) => [p.lat, p.lng]);
  bounds = L.latLngBounds(coords);

  routeLine.setLatLngs(coords);
  startMarker.setLatLng(coords[0]);
  endMarker.setLatLng(coords[coords.length - 1]);
  trackLine.setLatLngs([]);
  marker.setLatLng(coords[0]);
  lastMeters = 0;
  following = true;
  followViewSet = false;
  map.fitBounds(bounds, { padding: [30, 30] });
}

export function setRoute(latlngs) {
  applyRoute(latlngs);
}

export function planRoute({ onStatus } = {}) {
  cancelPlan();
  return new Promise((resolve, reject) => {
    pick = { start: null, resolve, reject, onStatus };
    map.getContainer().style.cursor = 'crosshair';
    onStatus?.('Startpunkt auf der Karte anklicken');
  });
}

export function cancelPlan() {
  if (!pick) return;
  if (tempStart) {
    map.removeLayer(tempStart);
    tempStart = null;
  }
  map.getContainer().style.cursor = '';
  const current = pick;
  pick = null;
  current.onStatus?.('Route-Planung abgebrochen');
  current.reject(new Error('abgebrochen'));
}

function handlePick(event) {
  if (!pick) return;
  const current = pick;

  if (!current.start) {
    current.start = event.latlng;
    tempStart = L.circleMarker(event.latlng, START).addTo(map);
    current.onStatus?.('Zielpunkt auf der Karte anklicken');
    return;
  }

  pick = null;
  map.getContainer().style.cursor = '';
  current.onStatus?.('Route wird berechnet…');

  fetchCarRoute(current.start, event.latlng)
    .then(({ points }) => {
      if (tempStart) {
        map.removeLayer(tempStart);
        tempStart = null;
      }
      applyRoute(points);
      current.onStatus?.(`Route geladen: ${(route.length / 1000).toFixed(2)} km`);
      current.resolve();
    })
    .catch((error) => {
      if (tempStart) {
        map.removeLayer(tempStart);
        tempStart = null;
      }
      current.onStatus?.('Fehler: ' + error.message);
      current.reject(error);
    });
}

export function updateProgress(meters) {
  if (!map) return;
  lastMeters = meters;
  const pos = pointAt(route, meters);
  lastPoint = pos;
  marker.setLatLng([pos.lat, pos.lng]);

  trackLine.setLatLngs([
    ...route.points.filter((p) => p.distance <= meters).map((p) => [p.lat, p.lng]),
    [pos.lat, pos.lng],
  ]);

  if (following) {
    if (!followViewSet) {
      map.setView([pos.lat, pos.lng], FOLLOW_ZOOM);
      followViewSet = true;
    } else {
      map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 });
    }
  }
}

export function toggleFollow() {
  following = !following;
  if (following) {
    followViewSet = false;
    updateProgress(lastMeters);
  } else {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
  return following;
}
