import { pointAt } from './route.js';

const BUCKET = 10;
const PREFETCH_STEPS = [1, 2];

let panorama = null;
let service = null;
let streetViewSource = null;
let loading = null;
let lastPanoId = null;
let currentHeading = 0;
let targetHeading = 0;
let animating = false;

const cache = new Map();
const pending = new Set();

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const callbackName = '__rowGoogleMapsReady';
    window[callbackName] = () => resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => reject(new Error('Google-Maps-Skript konnte nicht geladen werden (Key/Netzwerk?)'));
    document.head.appendChild(script);
  });
  return loading;
}

export async function initStreetView(containerId, apiKey) {
  if (panorama) return;
  if (!apiKey) throw new Error('Kein Google-API-Key hinterlegt (config.js)');
  await loadGoogleMaps(apiKey);
  const { StreetViewPanorama, StreetViewService, StreetViewSource } = await google.maps.importLibrary('streetView');
  panorama = new StreetViewPanorama(document.getElementById(containerId), {
    pov: { heading: 0, pitch: 0 },
    zoom: 1,
    motionTracking: false,
    motionTrackingControl: false,
    fullscreenControl: false,
    addressControl: false,
    showRoadLabels: false,
    enableCloseButton: false,
  });
  service = new StreetViewService();
  streetViewSource = StreetViewSource;
  clearStreetViewCache();
  lastPanoId = null;
  currentHeading = 0;
  targetHeading = 0;
}

export function clearStreetViewCache() {
  cache.clear();
  pending.clear();
}

export async function checkCoverage(route, apiKey, { step = 100 } = {}) {
  await loadGoogleMaps(apiKey);
  const lib = await google.maps.importLibrary('streetView');
  const svc = service || new lib.StreetViewService();
  const source = streetViewSource || lib.StreetViewSource;

  const total = Math.floor(route.length / step) + 1;
  let covered = 0;
  const gaps = [];
  for (let i = 0; i < total; i++) {
    const meters = Math.min(i * step, route.length);
    const point = pointAt(route, meters);
    const options = { location: { lat: point.lat, lng: point.lng }, radius: 50, preference: 'nearest' };
    if (source) options.sources = [source.OUTDOOR];
    const status = await new Promise((resolve) => svc.getPanorama(options, (data, s) => resolve(s)));
    if (status === 'OK') covered++;
    else gaps.push(Math.round(meters));
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  return { total, covered, percent: Math.round((covered / total) * 100), gaps };
}

function bucketOf(route, meters) {
  const clamped = Math.max(0, Math.min(meters, route.length));
  const maxBucket = Math.round(route.length / BUCKET) * BUCKET;
  return Math.min(Math.round(clamped / BUCKET) * BUCKET, maxBucket);
}

function request(route, bucket, onReady) {
  if (cache.has(bucket)) {
    onReady?.(cache.get(bucket));
    return;
  }
  if (pending.has(bucket)) return;
  const point = pointAt(route, bucket);
  pending.add(bucket);
  const options = {
    location: { lat: point.lat, lng: point.lng },
    radius: 50,
    preference: 'nearest',
  };
  if (streetViewSource) options.sources = [streetViewSource.OUTDOOR];
  service.getPanorama(options, (data, status) => {
    pending.delete(bucket);
    if (status !== 'OK' || !data?.location) return;
    const entry = { pano: data.location.pano };
    cache.set(bucket, entry);
    onReady?.(entry);
  });
}

function setHeading(target) {
  targetHeading = target;
  if (!animating) {
    animating = true;
    requestAnimationFrame(stepHeading);
  }
}

function stepHeading() {
  const diff = ((targetHeading - currentHeading + 540) % 360) - 180;
  if (Math.abs(diff) < 0.5) {
    currentHeading = targetHeading;
    animating = false;
  } else {
    currentHeading = (currentHeading + diff * 0.2 + 360) % 360;
  }
  panorama.setPov({ heading: currentHeading, pitch: 0 });
  if (animating) requestAnimationFrame(stepHeading);
}

function applyPano(entry) {
  if (entry.pano !== lastPanoId) {
    panorama.setPano(entry.pano);
    lastPanoId = entry.pano;
  }
}

export function updateStreetView(meters, route) {
  if (!panorama || !service || !route) return;
  const bucket = bucketOf(route, meters);
  const bearing = pointAt(route, meters).bearing;

  request(route, bucket, applyPano);
  for (const step of PREFETCH_STEPS) request(route, bucket + step * BUCKET);

  setHeading(bearing);
}
