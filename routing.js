export async function fetchCarRoute(start, end) {
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Routing fehlgeschlagen (${response.status})`);
  const data = await response.json();
  if (!data.routes?.length) throw new Error('Keine Route gefunden');
  return {
    distance: data.routes[0].distance,
    points: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}
