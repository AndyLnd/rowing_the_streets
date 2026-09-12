export const FLAG = {
  MORE_DATA: 0x0001,
  AVERAGE_STROKE_RATE: 0x0002,
  TOTAL_DISTANCE: 0x0004,
  INSTANTANEOUS_PACE: 0x0008,
  AVERAGE_PACE: 0x0010,
  INSTANTANEOUS_POWER: 0x0020,
  AVERAGE_POWER: 0x0040,
  RESISTANCE_LEVEL: 0x0080,
  EXPENDED_ENERGY: 0x0100,
  HEART_RATE: 0x0200,
  METABOLIC_EQUIVALENT: 0x0400,
  ELAPSED_TIME: 0x0800,
  REMAINING_TIME: 0x1000,
};

export function parseRowerData(view) {
  const flags = view.getUint16(0, true);
  let o = 2;
  const has = (bit) => (flags & bit) !== 0;
  const d = { flags };

  if (!has(FLAG.MORE_DATA)) {
    d.strokeRate = view.getUint8(o) / 2;
    o += 1;
    d.strokeCount = view.getUint16(o, true);
    o += 2;
  }
  if (has(FLAG.AVERAGE_STROKE_RATE)) {
    d.averageStrokeRate = view.getUint8(o) / 2;
    o += 1;
  }
  if (has(FLAG.TOTAL_DISTANCE)) {
    d.totalDistance = view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getUint8(o + 2) << 16);
    o += 3;
  }
  if (has(FLAG.INSTANTANEOUS_PACE)) {
    d.instantaneousPace = view.getUint16(o, true);
    o += 2;
  }
  if (has(FLAG.AVERAGE_PACE)) {
    d.averagePace = view.getUint16(o, true);
    o += 2;
  }
  if (has(FLAG.INSTANTANEOUS_POWER)) {
    d.instantaneousPower = view.getInt16(o, true);
    o += 2;
  }
  if (has(FLAG.AVERAGE_POWER)) {
    d.averagePower = view.getInt16(o, true);
    o += 2;
  }
  if (has(FLAG.RESISTANCE_LEVEL)) {
    d.resistanceLevel = view.getUint8(o);
    o += 1;
  }
  if (has(FLAG.EXPENDED_ENERGY)) {
    d.totalEnergy = view.getUint16(o, true);
    o += 2;
    d.energyPerHour = view.getUint16(o, true);
    o += 2;
    d.energyPerMinute = view.getUint8(o);
    o += 1;
  }
  if (has(FLAG.HEART_RATE)) {
    d.heartRate = view.getUint8(o);
    o += 1;
  }
  if (has(FLAG.METABOLIC_EQUIVALENT)) {
    d.metabolicEquivalent = view.getUint8(o) / 10;
    o += 1;
  }
  if (has(FLAG.ELAPSED_TIME)) {
    d.elapsedTime = view.getUint16(o, true);
    o += 2;
  }
  if (has(FLAG.REMAINING_TIME)) {
    d.remainingTime = view.getUint16(o, true);
    o += 2;
  }
  return d;
}
