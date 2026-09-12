import { Rower } from './ftms.js';
import {
  initMap, updateProgress, getRoute, toggleFollow, planRoute, cancelPlan,
  getProgressMeters, setRoute, setMapMode, setOpenFullHandler,
} from './map.js';
import { initStreetView, updateStreetView, clearStreetViewCache, checkCoverage } from './streetview.js';
import { DEMO_ROUTE } from './route.js';
import {
  listRoutes, saveRoute, deleteRoute, encodeRoute, decodeRoute,
  getHudFields, setHudFields,
} from './storage.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

const rower = new Rower();
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const menuBtn = document.getElementById('menuBtn');
const menu = document.getElementById('menu');
const menuClose = document.getElementById('menuClose');
const backdrop = document.getElementById('backdrop');
const hud = document.getElementById('hud');
const hudOptions = document.getElementById('hudOptions');
const connectBtn = document.getElementById('connectBtn');
const allBtn = document.getElementById('allBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const startBtn = document.getElementById('startBtn');
const overviewBtn = document.getElementById('overviewBtn');
const viewBtn = document.getElementById('viewBtn');
const routeBtn = document.getElementById('routeBtn');
const routeSelect = document.getElementById('routeSelect');
const saveBtn = document.getElementById('saveBtn');
const deleteBtn = document.getElementById('deleteBtn');
const shareBtn = document.getElementById('shareBtn');
const demoBtn = document.getElementById('demoBtn');
const debugBtn = document.getElementById('debugBtn');
const logView = document.getElementById('log');

const STATUS_LABEL = {
  idle: 'Nicht verbunden',
  connecting: 'Verbinde…',
  subscribing: 'Initialisiere…',
  ready: 'Verbunden',
  disconnected: 'Verbindung verloren',
};

const FIELDS = [
  { key: 'elapsed', label: 'Zeit' },
  { key: 'distance', label: 'Distanz' },
  { key: 'pace', label: 'Pace /500m' },
  { key: 'strokeRate', label: 'Schläge/min' },
  { key: 'route', label: 'Strecke' },
  { key: 'avgPace', label: 'Ø Pace /500m' },
  { key: 'strokeCount', label: 'Schläge' },
  { key: 'power', label: 'Power' },
  { key: 'avgPower', label: 'Ø Power' },
  { key: 'calories', label: 'Kalorien' },
  { key: 'heartRate', label: 'Herzfrequenz' },
  { key: 'met', label: 'MET' },
];
const DEFAULT_HUD = ['elapsed', 'distance', 'pace', 'strokeRate', 'strokeCount'];

let hudFields = (getHudFields() ?? DEFAULT_HUD).filter((key) => FIELDS.some((f) => f.key === key));
if (!hudFields.length) hudFields = [...DEFAULT_HUD];

let view = 'row';
let streetViewReady = false;
let planning = false;
let activeRouteId = '__current';

function log(message) {
  const line = `${new Date().toLocaleTimeString()}  ${message}`;
  logView.textContent += line + '\n';
  logView.scrollTop = logView.scrollHeight;
}

function fmtTime(seconds) {
  if (seconds == null) return null;
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtPace(secPer500) {
  if (secPer500 == null || secPer500 === 0) return null;
  return fmtTime(secPer500);
}

function fmtDistance(meters) {
  if (meters == null) return null;
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters} m`;
}

function fmt(value, digits = 0) {
  return value == null ? null : value.toFixed(digits);
}

function toValues(data) {
  return {
    elapsed: fmtTime(data.elapsedTime),
    distance: fmtDistance(data.totalDistance),
    route: data.totalDistance != null
      ? `${fmtDistance(Math.min(data.totalDistance, getRoute().length))} / ${(getRoute().length / 1000).toFixed(2)} km`
      : null,
    pace: fmtPace(data.instantaneousPace),
    avgPace: fmtPace(data.averagePace),
    strokeRate: fmt(data.strokeRate, 1),
    strokeCount: fmt(data.strokeCount),
    power: data.instantaneousPower != null ? `${data.instantaneousPower} W` : null,
    avgPower: data.averagePower != null ? `${data.averagePower} W` : null,
    calories: data.totalEnergy != null ? `${data.totalEnergy} kcal` : null,
    heartRate: data.heartRate != null ? `${data.heartRate} bpm` : null,
    met: fmt(data.metabolicEquivalent, 1),
  };
}

function buildHud() {
  hud.innerHTML = '';
  for (const key of hudFields) {
    const field = FIELDS.find((f) => f.key === key);
    if (!field) continue;
    const cell = document.createElement('div');
    cell.className = 'hud-cell na';
    cell.dataset.key = key;
    const value = document.createElement('span');
    value.className = 'v';
    value.textContent = '–';
    const label = document.createElement('span');
    label.className = 'l';
    label.textContent = field.label;
    cell.append(value, label);
    hud.appendChild(cell);
  }
}

function buildHudOptions() {
  hudOptions.innerHTML = '';
  for (const field of FIELDS) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = hudFields.includes(field.key);
    input.addEventListener('change', () => {
      hudFields = input.checked
        ? [...hudFields, field.key]
        : hudFields.filter((key) => key !== field.key);
      setHudFields(hudFields);
      buildHud();
    });
    label.append(input, document.createTextNode(field.label));
    hudOptions.appendChild(label);
  }
}

function render(data) {
  const values = toValues(data);
  for (const cell of hud.querySelectorAll('.hud-cell')) {
    const value = values[cell.dataset.key];
    cell.querySelector('.v').textContent = value ?? '–';
    cell.classList.toggle('na', value == null);
  }
  if (data.totalDistance != null) {
    updateProgress(data.totalDistance);
    if (streetViewReady) updateStreetView(data.totalDistance, getRoute());
  }
}

function resetHud() {
  for (const cell of hud.querySelectorAll('.hud-cell')) {
    cell.querySelector('.v').textContent = '–';
    cell.classList.add('na');
  }
}

function openMenu() {
  menu.classList.add('open');
  backdrop.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMenu() {
  menu.classList.remove('open');
  backdrop.hidden = true;
  menuBtn.setAttribute('aria-expanded', 'false');
}

menuBtn.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
backdrop.addEventListener('click', closeMenu);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

function setView(next) {
  view = next;
  const isMap = next === 'map';
  setMapMode(isMap ? 'full' : 'mini');
  hud.hidden = isMap;
  viewBtn.textContent = isMap ? 'Street View' : 'Karte groß';
}

viewBtn.addEventListener('click', () => {
  closeMenu();
  if (view === 'row') {
    setView('map');
  } else if (streetViewReady) {
    setView('row');
  } else {
    initStreetViewSafe();
  }
});

async function initStreetViewSafe() {
  try {
    await initStreetView('streetview', GOOGLE_MAPS_API_KEY);
    streetViewReady = true;
    setView('row');
    updateStreetView(getProgressMeters(), getRoute());
    reportCoverage();
  } catch (error) {
    streetViewReady = false;
    log('Street View: ' + error.message);
    setView('map');
  }
}

let rawCount = 0;
let lastRawAt = 0;
let lastDataAt = 0;
let dataWarned = false;

setInterval(() => {
  if (rower.state === 'ready' && lastDataAt && !dataWarned && Date.now() - lastDataAt > 5000) {
    dataWarned = true;
    log('Keine Daten seit 5s. Tipp: einen Schlag rudern, Display drücken oder „Training starten".');
  }
}, 2000);

function logRaw(hex) {
  rawCount += 1;
  const now = Date.now();
  if (rawCount <= 3 || now - lastRawAt > 2000) {
    lastRawAt = now;
    log('RAW: ' + hex);
  }
}

let demoTimer = null;
let demoRunning = false;

function startDemo() {
  let elapsed = 0;
  let distance = 0;
  demoBtn.textContent = 'Stop';
  demoTimer = setInterval(() => {
    elapsed += 1;
    const pace = 125 + Math.round(Math.sin(elapsed / 5) * 12);
    distance += Math.round(500 / pace);
    render({
      elapsedTime: elapsed,
      totalDistance: distance,
      instantaneousPace: pace,
      averagePace: 128,
      strokeRate: 22 + Math.sin(elapsed / 3) * 1.5,
      strokeCount: Math.round(elapsed * 0.4),
      instantaneousPower: 180 + Math.round(Math.sin(elapsed / 4) * 40),
      averagePower: 185,
      totalEnergy: Math.round(elapsed * 0.2),
      heartRate: 130 + Math.round(Math.sin(elapsed / 6) * 8),
      metabolicEquivalent: 8.5,
    });
  }, 1000);
}

function stopDemo() {
  clearInterval(demoTimer);
  demoTimer = null;
  demoBtn.textContent = 'Demo';
  resetHud();
  updateProgress(0);
}

rower.addEventListener('state', (event) => {
  const { state, name } = event.detail;
  dot.className = 'dot ' + state;
  statusText.textContent = STATUS_LABEL[state] ?? state;
  if (name) statusText.textContent += ` – ${name}`;
  connectBtn.hidden = state === 'ready' || state === 'connecting' || state === 'subscribing';
  disconnectBtn.hidden = state !== 'ready';
  startBtn.hidden = state !== 'ready';
  if (state === 'ready') {
    log(`Verbunden: ${name}`);
    lastDataAt = Date.now();
    dataWarned = false;
  }
});

rower.addEventListener('data', (event) => {
  lastDataAt = Date.now();
  dataWarned = false;
  render(event.detail.parsed);
  logRaw(event.detail.hex);
});
rower.addEventListener('log', (event) => log(event.detail));

function bluetoothBlockedHint() {
  log('Bluetooth-Berechtigung blockiert. Fix: Adressleiste → Website-Einstellungen → Bluetooth → Zulassen, oder chrome://settings/content/bluetoothDevices. Danach Seite neu laden.');
  statusText.textContent = 'Bluetooth blockiert – in den Website-Einstellungen erlauben';
  dot.className = 'dot error';
}

async function bluetoothPermission() {
  try {
    return (await navigator.permissions.query({ name: 'bluetooth' })).state;
  } catch {
    return 'unknown';
  }
}

function handleConnectError(error) {
  if (error.name === 'NotFoundError') {
    log('Kein Gerät ausgewählt. Nutze ggf. „Alle Geräte".');
  } else if (error.name === 'SecurityError') {
    bluetoothBlockedHint();
    return;
  } else {
    log('Verbindungsfehler: ' + error.message);
  }
  rower.setState('idle');
}

connectBtn.addEventListener('click', async () => {
  try {
    const device = await rower.requestDevice();
    await rower.connect(device);
  } catch (error) {
    handleConnectError(error);
  }
});

allBtn.addEventListener('click', async () => {
  try {
    const device = await rower.requestDevice({ all: true });
    await rower.connect(device);
  } catch (error) {
    handleConnectError(error);
  }
});

disconnectBtn.addEventListener('click', () => rower.disconnect());
startBtn.addEventListener('click', () => rower.startWorkout());
overviewBtn.addEventListener('click', () => {
  overviewBtn.textContent = toggleFollow() ? 'Übersicht' : 'Folgen';
});

async function reportCoverage() {
  try {
    const cov = await checkCoverage(getRoute(), GOOGLE_MAPS_API_KEY, { step: 100 });
    const gaps = cov.gaps.length ? ` – Lücken bei ${cov.gaps.slice(0, 12).join(', ')} m` : '';
    log(`Street-View-Abdeckung: ${cov.percent}% (${cov.covered}/${cov.total})${gaps}`);
  } catch (error) {
    log('Abdeckungsprüfung fehlgeschlagen: ' + error.message);
  }
}

function currentPoints() {
  return getRoute().points.map((p) => [p.lat, p.lng]);
}

function setHash(points) {
  history.replaceState(null, '', '#r=' + encodeRoute(points));
}

function routeFromHash() {
  const match = location.hash.match(/[#&]r=([^&]+)/);
  return match ? decodeRoute(decodeURIComponent(match[1])) : null;
}

function refreshRouteSelect(value = activeRouteId) {
  const saved = listRoutes();
  routeSelect.innerHTML = '';
  routeSelect.add(new Option('Aktuelle Route', '__current'));
  routeSelect.add(new Option('Standard (Müggelheim)', '__demo'));
  for (const route of saved) routeSelect.add(new Option(route.name, route.id));
  routeSelect.value = [...routeSelect.options].some((o) => o.value === value) ? value : '__current';
  deleteBtn.disabled = !saved.some((route) => route.id === routeSelect.value);
}

function loadRoute(points, id, { updateUrl = true } = {}) {
  setRoute(points);
  clearStreetViewCache();
  activeRouteId = id;
  if (updateUrl) setHash(points);
  refreshRouteSelect(id);
  if (streetViewReady && view === 'row') {
    updateStreetView(getProgressMeters(), getRoute());
    reportCoverage();
  }
}

routeSelect.addEventListener('change', () => {
  const value = routeSelect.value;
  if (value === '__current') return;
  if (value === '__demo') {
    loadRoute(DEMO_ROUTE.points, '__demo');
    return;
  }
  const saved = listRoutes().find((route) => route.id === value);
  if (saved) loadRoute(saved.points, saved.id);
});

saveBtn.addEventListener('click', () => {
  const name = (prompt('Name der Route:', 'Neue Route') || '').trim();
  if (!name) return;
  const id = saveRoute(name, currentPoints());
  activeRouteId = id;
  setHash(currentPoints());
  refreshRouteSelect(id);
  log('Route gespeichert: ' + name);
});

deleteBtn.addEventListener('click', () => {
  const saved = listRoutes().find((route) => route.id === routeSelect.value);
  if (!saved) return;
  deleteRoute(saved.id);
  activeRouteId = '__current';
  refreshRouteSelect('__current');
  log('Route gelöscht: ' + saved.name);
});

shareBtn.addEventListener('click', async () => {
  setHash(currentPoints());
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    log('Link kopiert: ' + url);
  } catch {
    log('Link: ' + url);
  }
});

routeBtn.addEventListener('click', async () => {
  if (planning) {
    cancelPlan();
    return;
  }
  closeMenu();
  planning = true;
  routeBtn.textContent = 'Abbrechen';
  setView('map');
  try {
    await planRoute({
      onStatus: (message) => {
        log(message);
        statusText.textContent = message;
      },
    });
    clearStreetViewCache();
    activeRouteId = '__current';
    setHash(currentPoints());
    refreshRouteSelect('__current');
  } catch {
    // Fehler/Abbruch wurde bereits geloggt
  } finally {
    planning = false;
    routeBtn.textContent = 'Route planen';
    if (streetViewReady) {
      setView('row');
      updateStreetView(getProgressMeters(), getRoute());
      reportCoverage();
    }
  }
});

demoBtn.addEventListener('click', () => {
  demoRunning = !demoRunning;
  demoRunning ? startDemo() : stopDemo();
});

debugBtn.addEventListener('click', () => {
  logView.hidden = !logView.hidden;
});

async function autoConnect() {
  if (!Rower.supported()) {
    statusText.textContent = 'Web Bluetooth nicht verfügbar – Chrome/Edge auf Android oder Desktop nutzen';
    connectBtn.disabled = true;
    allBtn.disabled = true;
    return;
  }
  if ((await bluetoothPermission()) === 'denied') {
    bluetoothBlockedHint();
    return;
  }
  const devices = await rower.remembered();
  if (!devices.length) return;
  log(`Früheres Gerät gefunden: ${devices[0].name || devices[0].id} – verbinde automatisch`);
  try {
    await rower.connect(devices[0]);
  } catch (error) {
    log('Auto-Connect fehlgeschlagen: ' + error.message);
    rower.setState('idle');
  }
}

initMap('map');
setOpenFullHandler(() => setView('map'));
buildHud();
buildHudOptions();

const sharedRoute = routeFromHash();
if (sharedRoute) {
  loadRoute(sharedRoute, '__current', { updateUrl: false });
} else {
  activeRouteId = '__demo';
  refreshRouteSelect('__demo');
}

setView('row');
initStreetViewSafe();
autoConnect();
