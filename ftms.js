import { parseRowerData } from './rower-data.js';

export const UUID = {
  ftms: 0x1826,
  rowerData: 0x2ad1,
  feature: 0x2acc,
  status: 0x2ada,
  controlPoint: 0x2ad9,
  deviceInfo: 0x180a,
  modelNumber: 0x2a24,
  firmwareRevision: 0x2a26,
  manufacturerName: 0x2a29,
};

const FEATURE_NAMES = [
  'Average Speed', 'Cadence', 'Total Distance', 'Inclination', 'Elevation Gain',
  'Pace', 'Step Count', 'Resistance Level', 'Stride Count', 'Expended Energy',
  'Heart Rate', 'Metabolic Equivalent', 'Elapsed Time', 'Remaining Time',
  'Power', 'Force on Belt / Power Output', 'User Data Retention',
];

function decodeFeatures(view) {
  const bits = view.getUint32(0, true);
  return FEATURE_NAMES.filter((_, i) => (bits & (1 << i)) !== 0);
}

async function readText(service, uuid) {
  const value = await (await service.getCharacteristic(uuid)).readValue();
  return new TextDecoder().decode(value).replace(/\0+$/, '');
}

export class Rower extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.characteristic = null;
    this.controlPoint = null;
    this.state = 'idle';
    this.info = {};
  }

  static supported() {
    return typeof navigator !== 'undefined' && !!navigator.bluetooth;
  }

  setState(state, detail = {}) {
    this.state = state;
    this.dispatchEvent(new CustomEvent('state', { detail: { state, ...detail } }));
  }

  log(message) {
    this.dispatchEvent(new CustomEvent('log', { detail: message }));
  }

  async remembered() {
    try {
      return await navigator.bluetooth.getDevices();
    } catch {
      return [];
    }
  }

  async requestDevice({ all = false } = {}) {
    const optionalServices = [UUID.ftms, UUID.deviceInfo];
    const options = all
      ? { acceptAllDevices: true, optionalServices }
      : { filters: [{ services: [UUID.ftms] }], optionalServices };
    return navigator.bluetooth.requestDevice(options);
  }

  async connect(device) {
    this.device = device;
    device.addEventListener('gattserverdisconnected', () => {
      this.characteristic = null;
      this.setState('disconnected', { name: device.name || device.id });
    });

    this.setState('connecting', { name: device.name || device.id });
    const server = await device.gatt.connect();

    this.setState('subscribing');
    const service = await server.getPrimaryService(UUID.ftms);

    try {
      const feature = await service.getCharacteristic(UUID.feature);
      this.info.features = decodeFeatures(await feature.readValue());
      this.log('Features: ' + (this.info.features.join(', ') || 'keine'));
    } catch {
      this.log('Feature-Charakteristik (0x2ACC) nicht lesbar');
    }

    try {
      const info = await server.getPrimaryService(UUID.deviceInfo);
      this.info.model = await readText(info, UUID.modelNumber);
      this.info.firmware = await readText(info, UUID.firmwareRevision);
      this.info.manufacturer = await readText(info, UUID.manufacturerName);
      this.log(`Gerät: ${this.info.manufacturer || '?'} ${this.info.model || ''} FW ${this.info.firmware || '?'}`);
    } catch {
      this.info.model = this.info.model || device.name || 'Unbekannt';
    }

    const characteristic = await service.getCharacteristic(UUID.rowerData);
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      try {
        const view = event.target.value;
        const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
        this.dispatchEvent(new CustomEvent('data', { detail: { parsed: parseRowerData(view), hex } }));
      } catch (error) {
        this.log('Parse-Fehler: ' + error.message);
      }
    });

    this.characteristic = characteristic;
    this.setState('ready', { name: device.name || device.id });
    this.log('Rower Data (0x2AD1) abonniert');

    try {
      const controlPoint = await service.getCharacteristic(UUID.controlPoint);
      await controlPoint.startNotifications();
      controlPoint.addEventListener('characteristicvaluechanged', (event) => {
        const value = event.target.value;
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        this.log('Control Point Antwort: ' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' '));
      });
      this.controlPoint = controlPoint;
      await this.startWorkout();
    } catch (error) {
      this.log('Control Point (0x2AD9) nicht verfügbar: ' + error.message);
    }
  }

  async startWorkout() {
    if (!this.controlPoint) {
      this.log('Kein Control Point – Gerät sendet ggf. ohne Aktivierung');
      return false;
    }
    try {
      await this.controlPoint.writeValue(new Uint8Array([0x00]));
      await this.controlPoint.writeValue(new Uint8Array([0x07]));
      this.log('Control Point: Request Control + Start gesendet');
      return true;
    } catch (error) {
      this.log('Control Point Schreibfehler: ' + error.message);
      return false;
    }
  }

  disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    } else {
      this.setState('idle');
    }
  }
}
