import assert from 'node:assert/strict';
import { buildRoute, pointAt, bearing } from './route.js';
import { encodeRoute, decodeRoute } from './storage.js';

const route = buildRoute([
  [0, 0],
  [0, 0.01],
  [0.01, 0.01],
]);

assert.ok(route.length > 2000 && route.length < 2300, `length=${route.length}`);
assert.equal(route.points[0].distance, 0);

const start = pointAt(route, 0);
assert.ok(Math.abs(start.lat) < 1e-9 && Math.abs(start.lng) < 1e-9);

const mid = pointAt(route, route.length / 2);
assert.ok(Math.abs(mid.lng - 0.01) < 1e-6, `mid.lng=${mid.lng}`);

const end = pointAt(route, route.length);
assert.ok(Math.abs(end.lat - 0.01) < 1e-6 && Math.abs(end.lng - 0.01) < 1e-6);

const clamped = pointAt(route, route.length + 9999);
assert.ok(Math.abs(clamped.lat - 0.01) < 1e-6, `clamped.lat=${clamped.lat}`);

const east = bearing({ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 });
assert.ok(Math.abs(east - 90) < 0.5, `bearing=${east}`);

const encoded = encodeRoute([[52.5, 13.4], [52.51, 13.41]]);
assert.equal(encoded, '52.50000,13.40000;52.51000,13.41000');
assert.deepEqual(decodeRoute(encoded), [[52.5, 13.4], [52.51, 13.41]]);
assert.equal(decodeRoute('nonsense'), null);
assert.equal(decodeRoute('1,2'), null);

console.log('route: all checks passed');
