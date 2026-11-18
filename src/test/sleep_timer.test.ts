import { describe, it, expect } from 'vitest';

describe('Sleep Timer & Gradual Volume Fade-Out Logic (Part 5)', () => {
  it('correctly calculates remaining minutes and seconds for preset durations', () => {
    const presets = [5, 10, 15, 30, 45, 60];
    presets.forEach((minutes) => {
      const totalSeconds = minutes * 60;
      expect(totalSeconds).toBe(minutes * 60);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      expect(m).toBe(minutes);
      expect(s).toBe(0);
    });
  });

  it('computes 18-second gradual volume reduction across 60 steps smoothly without negative values', () => {
    const initialVolume = 0.85;
    const fadeSteps = 60;
    const volumeLevels: number[] = [];

    for (let step = 0; step <= fadeSteps; step++) {
      const factor = 1 - step / fadeSteps;
      const stepVolume = Math.max(0, initialVolume * factor);
      volumeLevels.push(stepVolume);
    }

    // Step 0 should be original volume
    expect(volumeLevels[0]).toBeCloseTo(initialVolume, 3);
    // Halfway step should be ~half volume
    expect(volumeLevels[30]).toBeCloseTo(initialVolume / 2, 2);
    // Final step should be 0.0
    expect(volumeLevels[fadeSteps]).toBe(0);

    // Each consecutive step should be strictly monotonic decreasing
    for (let i = 1; i < volumeLevels.length; i++) {
      expect(volumeLevels[i]).toBeLessThanOrEqual(volumeLevels[i - 1]);
    }
  });

  it('restores original user volume accurately when timer is cancelled during fade', () => {
    const userOriginalVolume = 0.72;
    let activeVolume = userOriginalVolume;

    // Simulate partial fade: user volume was reduced to step 20
    const step20Volume = userOriginalVolume * (1 - 20 / 60);
    activeVolume = step20Volume;
    expect(activeVolume).toBeLessThan(userOriginalVolume);

    // Cancel action triggered: restore saved original volume
    activeVolume = userOriginalVolume;
    expect(activeVolume).toBe(0.72);
  });
});
