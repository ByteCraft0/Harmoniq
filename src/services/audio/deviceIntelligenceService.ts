import { AudioDeviceInfo } from '../../types/devices';
import { audioDeviceProfileService } from './audioDeviceProfileService';

export type DeviceAcousticCategory =
  | 'wired_headphones'
  | 'usb_dac'
  | 'bluetooth_headphones'
  | 'desktop_speakers'
  | 'laptop_speakers';

export interface DeviceIntelligenceReport {
  deviceId: string;
  deviceLabel: string;
  category: DeviceAcousticCategory;
  recommendedProfileId: string;
  acousticCompensationTarget: string;
  explanation: string;
}

export class DeviceIntelligenceService {
  private lastDeviceId: string = '';
  private switchListeners: Set<(fromId: string, toId: string, report: DeviceIntelligenceReport) => void> = new Set();

  public classifyDevice(device: AudioDeviceInfo | { deviceId: string; label: string }): DeviceIntelligenceReport {
    const label = (device.label || '').toLowerCase();
    const id = device.deviceId;

    let category: DeviceAcousticCategory = 'desktop_speakers';
    let recommendedProfileId = 'neutral_reference';
    let acousticCompensationTarget = 'Flat Nearfield Response';
    let explanation = 'Standard desktop speakers identified; neutral reference calibration recommended.';

    if (
      label.includes('schiit') ||
      label.includes('topping') ||
      label.includes('fiio') ||
      label.includes('dragonfly') ||
      label.includes('focusrite') ||
      label.includes('ifi') ||
      label.includes('dac')
    ) {
      category = 'usb_dac';
      recommendedProfileId = 'audiophile_critical';
      acousticCompensationTarget = 'Bit-Perfect Studio Master';
      explanation = 'High-resolution external USB DAC identified. Engaging high-fidelity bit-transparent profile.';
    } else if (
      label.includes('airpod') ||
      label.includes('wh-1000') ||
      label.includes('bose') ||
      label.includes('buds') ||
      label.includes('bluetooth') ||
      label.includes('wireless')
    ) {
      category = 'bluetooth_headphones';
      recommendedProfileId = 'harman_headphone';
      acousticCompensationTarget = 'Harman Target Wireless Compensation';
      explanation = 'Bluetooth wireless headphones identified. Harman target curve engaged to optimize tonal balance.';
    } else if (
      label.includes('headphone') ||
      label.includes('sennheiser') ||
      label.includes('hd650') ||
      label.includes('hd600') ||
      label.includes('iem') ||
      label.includes('earphone')
    ) {
      category = 'wired_headphones';
      recommendedProfileId = 'harman_headphone';
      acousticCompensationTarget = 'Harman Over-Ear Target';
      explanation = 'Wired audiophile headphones identified. Harman target applied for natural pinna gain and bass extension.';
    } else if (
      label.includes('laptop') ||
      label.includes('internal') ||
      (label.includes('realtek') && !label.includes('headphone'))
    ) {
      category = 'laptop_speakers';
      recommendedProfileId = 'vocal_acoustic';
      acousticCompensationTarget = 'Midrange Clarity & Bass Roll-off';
      explanation = 'Built-in laptop speakers identified. Midrange boost applied to enhance dialogue and reduce speaker rattling.';
    }

    return {
      deviceId: id,
      deviceLabel: device.label || 'Default Output Device',
      category,
      recommendedProfileId,
      acousticCompensationTarget,
      explanation,
    };
  }

  public onDeviceChanged(newDevice: AudioDeviceInfo): DeviceIntelligenceReport | null {
    if (this.lastDeviceId && this.lastDeviceId !== newDevice.deviceId) {
      const report = this.classifyDevice(newDevice);
      const prev = this.lastDeviceId;
      this.lastDeviceId = newDevice.deviceId;
      this.switchListeners.forEach((cb) => cb(prev, newDevice.deviceId, report));
      return report;
    }
    this.lastDeviceId = newDevice.deviceId;
    return null;
  }

  public subscribeDeviceSwitch(
    cb: (fromId: string, toId: string, report: DeviceIntelligenceReport) => void
  ): () => void {
    this.switchListeners.add(cb);
    return () => this.switchListeners.delete(cb);
  }
}

export const deviceIntelligenceService = new DeviceIntelligenceService();
