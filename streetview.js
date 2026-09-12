import { haversine } from './route.js';

let panorama = null;
let service = null;
let loading = null;
let lastPoint = null;
let lastPanoId = null;

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
  const { StreetViewPanorama, StreetViewService } = await google.maps.importLibrary('streetView');
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
  lastPoint = null;
  lastPanoId = null;
}

export function updateStreetView(point) {
  if (!panorama || !service || !point) return;
  if (lastPoint && haversine(lastPoint, point) < 5) {
    panorama.setPov({ heading: point.bearing, pitch: 0 });
    return;
  }
  service.getPanorama(
    { location: { lat: point.lat, lng: point.lng }, radius: 50, preference: 'nearest' },
    (data, status) => {
      if (status !== 'OK' || !data?.location) return;
      lastPoint = point;
      if (data.location.pano !== lastPanoId) {
        panorama.setPano(data.location.pano);
        lastPanoId = data.location.pano;
      } else {
        panorama.setPosition(data.location.latLng);
      }
      panorama.setPov({ heading: point.bearing, pitch: 0 });
    },
  );
}
