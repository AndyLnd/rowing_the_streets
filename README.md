# rowing_the_streets

Rudergerät steuert eine virtuelle Route: Live-Metriken per Bluetooth (FTMS), Karte mit Routenplaner und Google Street View, die der geruderten Distanz folgt.

## Funktionen
- Verbindet FTMS-konforme Rudergeräte (getestet: JOROTO MR280PRO) via Web Bluetooth
- Live: Zeit, Distanz, Pace, Ø-Pace, Schlagrate, Schläge, Power, Energie, HF
- Karte (Leaflet, OSM/Esri) mit Routenplanung (OSRM) per Klick auf Start/Ziel
- Street View Panorama-Kamera synchron zur Distanz

## Voraussetzungen
- Chrome/Edge (Desktop) oder Chrome/Samsung Internet (Android). **Kein** iOS/Safari/Firefox.
- Secure Context: HTTPS oder `localhost`.
- Street View: Google-API-Key (Maps JavaScript API, Billing aktiv, Referrer-beschränkt).

## Setup
```sh
cp .env.example .env      # GOOGLE_MAPS_API_KEY eintragen
npm run serve             # erzeugt config.js aus .env, startet auf :8000
npm test                  # Parser- und Routen-Checks
```

## Deployment
Push auf `main` → GitHub Actions generiert `config.js` aus dem Secret `GOOGLE_MAPS_API_KEY` und deployt nach GitHub Pages. Dafür Secret anlegen und Pages auf „GitHub Actions" stellen.

## Dateien
- `ftms.js`, `rower-data.js` – BLE-Verbindung und FTMS-Rower-Data-Parser
- `map.js`, `route.js`, `routing.js` – Karte, Geo-Mathe, OSRM-Routing
- `streetview.js` – Google-Street-View-Kamera
- `app.js` – UI und Zustand
- `scripts/env-to-config.mjs` – `.env` → `config.js`
