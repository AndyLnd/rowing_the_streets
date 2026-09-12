import assert from 'node:assert/strict';
import { parseRowerData } from './rower-data.js';

function bytes(...b) {
  return new DataView(new Uint8Array(b).buffer);
}

// Flags 0x082C: stroke fields (bit0=0), distance, pace, power, elapsed time
const full = parseRowerData(
  bytes(
    0x2c, 0x08,
    50, // stroke rate raw -> 25.0
    0xc8, 0x00, // stroke count 200
    0xd2, 0x04, 0x00, // distance 1234
    0x78, 0x00, // instantaneous pace 120
    0xd2, 0x00, // instantaneous power 210
    0x4d, 0x0e, // elapsed time 3661
  ),
);
assert.equal(full.strokeRate, 25);
assert.equal(full.strokeCount, 200);
assert.equal(full.totalDistance, 1234);
assert.equal(full.instantaneousPace, 120);
assert.equal(full.instantaneousPower, 210);
assert.equal(full.elapsedTime, 3661);
assert.equal(full.averagePace, undefined);

// Heart rate + energy triplet + MET
const hr = parseRowerData(
  bytes(
    0x00, 0x06, // bit0=0 (stroke), bit9 heart rate, bit10 MET
    60, // stroke rate raw -> 30
    10, 0x00, // stroke count 10
    150, // heart rate
    85, // MET raw -> 8.5
  ),
);
assert.equal(hr.strokeRate, 30);
assert.equal(hr.heartRate, 150);
assert.equal(hr.metabolicEquivalent, 8.5);

// MORE_DATA set with no other fields -> flags only
const empty = parseRowerData(bytes(0x01, 0x00));
assert.equal(empty.flags, 1);
assert.equal(empty.strokeRate, undefined);
assert.equal(empty.totalDistance, undefined);

// Echte Notification der JOROTO MR280PRO (SPAX TPL3135), Flags 0x0B7E
const joroto = parseRowerData(
  bytes(
    0x7e, 0x0b, // flags = 0x0B7E
    0x00, // stroke rate raw -> 0
    0x01, 0x00, // stroke count 1
    0x00, // average stroke rate raw -> 0
    0x03, 0x00, 0x00, // total distance 3
    0x9a, 0x02, // instantaneous pace 666
    0x9a, 0x02, // average pace 666
    0x00, 0x00, // instantaneous power 0
    0x00, 0x00, // average power 0
    0x00, 0x00, // total energy 0
    0x00, 0x00, // energy per hour 0
    0x00, // energy per minute 0
    0x00, // heart rate 0
    0x04, 0x00, // elapsed time 4
  ),
);
assert.equal(joroto.flags, 0x0b7e);
assert.equal(joroto.strokeRate, 0);
assert.equal(joroto.strokeCount, 1);
assert.equal(joroto.averageStrokeRate, 0);
assert.equal(joroto.totalDistance, 3);
assert.equal(joroto.instantaneousPace, 666);
assert.equal(joroto.averagePace, 666);
assert.equal(joroto.instantaneousPower, 0);
assert.equal(joroto.averagePower, 0);
assert.equal(joroto.totalEnergy, 0);
assert.equal(joroto.energyPerHour, 0);
assert.equal(joroto.energyPerMinute, 0);
assert.equal(joroto.heartRate, 0);
assert.equal(joroto.elapsedTime, 4);
assert.equal(joroto.resistanceLevel, undefined);
assert.equal(joroto.metabolicEquivalent, undefined);
assert.equal(joroto.remainingTime, undefined);

console.log('rower-data: all checks passed');
