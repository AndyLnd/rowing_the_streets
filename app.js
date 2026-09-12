import { Rower } from './ftms.js';
import {
  initMap, updateProgress, getRoute, toggleFollow, planRoute, cancelPlan,
  getProgressMeters, invalidateMapSize,
} from './map.js';
import { initStreetView, updateStreetView, clearStreetViewCache, checkCoverage } from './streetview.js';
import { GOOGLE_MAPS_API_KEY } from './config.js';

const rower = new Rower();
const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');
const connectBtn = document.getElementById('connectBtn');
const allBtn = document.getElementById('allBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const startBtn = document.getElementById('startBtn');
const overviewBtn = document.getElementById('overviewBtn');
const routeBtn = document.getElementById('routeBtn');
const streetViewBtn = document.getElementById('streetViewBtn');
const mapEl = document.getElementById('map');
const streetViewEl = document.getElementById('streetview');
const demoBtn = document.getElementById('demoBtn');
const logView = document.getElementById('log');

const STATUS_LABEL = {
  idle: 'Nicht verbunden',
  connecting: 'Verbinde…',
  subscribing: 'Initialisiere…',
  ready: 'Verbunden',
  disconnected: 'Verbindung verloren',
};

const TILE_KEYS = [
  'elapsed', 'distance', 'route', 'pace', 'avgPace', 'strokeRate',
  'strokeCount', 'power', 'avgPower', 'calories', 'heartRate', 'met',
];

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
  return `${fmtTime(secPer500)} /500m`;
}

function fmtDistance(meters) {
  if (meters == null) return null;
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters} m`;
}

function fmt(value, digits = 0) {
  return value == null ? null : value.toFixed(digits);
}

function toTiles(data) {
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

function render(data) {
  const tiles = toTiles(data);
  for (const key of TILE_KEYS) {
    const tile = document.querySelector(`.tile[data-key="${key}"]`);
    if (!tile) continue;
    const value = tiles[key];
    tile.querySelector('.v').textContent = value ?? '–';
    tile.classList.toggle('na', value == null);
  }
  if (data.totalDistance != null) {
    updateProgress(data.totalDistance);
    if (streetViewActive) updateStreetView(data.totalDistance, getRoute());
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

function resetTiles() {
  for (const key of TILE_KEYS) {
    const tile = document.querySelector(`.tile[data-key="${key}"]`);
    if (!tile) continue;
    tile.querySelector('.v').textContent = '–';
    tile.classList.add('na');
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
  resetTiles();
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
  if (state === 'ready') log(`Verbunden: ${name}`);
  if (state === 'ready') {
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

let planning = false;
let streetViewActive = false;

async function reportCoverage() {
  try {
    const cov = await checkCoverage(getRoute(), GOOGLE_MAPS_API_KEY, { step: 100 });
    const gaps = cov.gaps.length ? ` – Lücken bei ${cov.gaps.slice(0, 12).join(', ')} m` : '';
    log(`Street-View-Abdeckung: ${cov.percent}% (${cov.covered}/${cov.total})${gaps}`);
  } catch (error) {
    log('Abdeckungsprüfung fehlgeschlagen: ' + error.message);
  }
}

routeBtn.addEventListener('click', async () => {
  if (planning) {
    cancelPlan();
    return;
  }
  planning = true;
  routeBtn.textContent = 'Abbrechen';
  try {
    await planRoute({
      onStatus: (message) => {
        log(message);
        statusText.textContent = message;
      },
    });
    clearStreetViewCache();
    if (streetViewActive) {
      updateStreetView(getProgressMeters(), getRoute());
      reportCoverage();
    }
  } catch {
    // Fehler/Abbruch wurde bereits geloggt
  } finally {
    planning = false;
    routeBtn.textContent = 'Route planen';
  }
});

streetViewBtn.addEventListener('click', async () => {
  if (streetViewActive) {
    streetViewActive = false;
    streetViewEl.hidden = true;
    mapEl.hidden = false;
    streetViewBtn.textContent = 'Street View';
    invalidateMapSize();
    return;
  }
  try {
    await initStreetView('streetview', GOOGLE_MAPS_API_KEY);
    streetViewActive = true;
    streetViewEl.hidden = false;
    mapEl.hidden = true;
    streetViewBtn.textContent = 'Karte';
    updateStreetView(getProgressMeters(), getRoute());
    reportCoverage();
  } catch (error) {
    log('Street View: ' + error.message);
  }
});

demoBtn.addEventListener('click', () => {
  demoRunning = !demoRunning;
  demoRunning ? startDemo() : stopDemo();
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

resetTiles();
initMap('map');
autoConnect();
