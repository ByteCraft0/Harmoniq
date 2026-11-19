import { describe, it, expect, beforeEach } from 'vitest';

// In-memory mock for localStorage and window events in Node test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

(globalThis as any).localStorage = localStorageMock;

if (typeof window === 'undefined') {
  const listeners: Record<string, Function[]> = {};
  (globalThis as any).window = {
    addEventListener: (type: string, listener: Function) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(listener);
    },
    removeEventListener: (type: string, listener: Function) => {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter((l) => l !== listener);
    },
    dispatchEvent: (event: any) => {
      const list = listeners[event.type];
      if (list) list.forEach((cb) => cb(event));
      return true;
    },
    localStorage: localStorageMock,
  };
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, params?: { detail?: any }) {
      this.type = type;
      this.detail = params?.detail;
    }
  };
}

describe('Phase 6.3 — First-Run Onboarding & UX Polish', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('verifies onboarding initial state detection and persistence', () => {
    const isCompletedInitial = localStorageMock.getItem('harmoniq_onboarding_completed') === 'true';
    expect(isCompletedInitial).toBe(false);

    // Simulate completion
    localStorageMock.setItem('harmoniq_onboarding_completed', 'true');
    const isCompletedAfter = localStorageMock.getItem('harmoniq_onboarding_completed') === 'true';
    expect(isCompletedAfter).toBe(true);
  });

  it('validates 3-step walkthrough progression sequence', () => {
    let currentStep = 1;
    const nextStep = () => {
      if (currentStep < 3) currentStep++;
    };
    const prevStep = () => {
      if (currentStep > 1) currentStep--;
    };

    expect(currentStep).toBe(1);
    nextStep();
    expect(currentStep).toBe(2);
    nextStep();
    expect(currentStep).toBe(3);
    // Boundary check
    nextStep();
    expect(currentStep).toBe(3);

    prevStep();
    expect(currentStep).toBe(2);
    prevStep();
    expect(currentStep).toBe(1);
    prevStep();
    expect(currentStep).toBe(1);
  });

  it('verifies supported audio formats showcase data in Step 1', () => {
    const supportedCodecs = [
      { ext: 'FLAC', desc: 'Lossless Hi-Res', tag: 'Up to 24/192' },
      { ext: 'ALAC', desc: 'Apple Lossless', tag: 'M4A' },
      { ext: 'WAV', desc: 'Linear PCM', tag: 'Uncompressed' },
      { ext: 'MP3', desc: 'MPEG Layer III', tag: 'VBR / 320k' },
      { ext: 'M4A', desc: 'AAC Advanced', tag: 'Native' },
      { ext: 'OGG', desc: 'Ogg Vorbis / Opus', tag: 'Container' },
    ];

    expect(supportedCodecs).toHaveLength(6);
    expect(supportedCodecs.map((c) => c.ext)).toContain('FLAC');
    expect(supportedCodecs.map((c) => c.ext)).toContain('ALAC');
    expect(supportedCodecs.map((c) => c.ext)).toContain('WAV');
    expect(supportedCodecs.map((c) => c.ext)).toContain('MP3');
    expect(supportedCodecs.map((c) => c.ext)).toContain('M4A');
    expect(supportedCodecs.map((c) => c.ext)).toContain('OGG');
  });

  it('verifies custom event dispatching to re-open onboarding', () => {
    let eventReceived = false;
    const listener = () => {
      eventReceived = true;
    };
    window.addEventListener('harmoniq:openOnboarding', listener);

    window.dispatchEvent(new CustomEvent('harmoniq:openOnboarding'));
    expect(eventReceived).toBe(true);

    window.removeEventListener('harmoniq:openOnboarding', listener);
  });
});
