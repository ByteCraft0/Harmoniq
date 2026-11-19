/**
 * Centralized Audio Parameter Automation Helper for Harmoniq DSP Engine
 *
 * Provides safe, de-clicked, bounds-validated AudioParam transitions.
 * Eliminates zipper noise and pops caused by abrupt .value assignments.
 */

export interface AutomationOptions {
  timeConstant?: number;
  duration?: number;
  min?: number;
  max?: number;
  fallback?: number;
  cancelPrevious?: boolean;
}

export const AUTOMATION_TIME_CONSTANTS = {
  MASTER_GAIN: 0.025,  // ~75ms to 95% settling
  PREAMP: 0.025,       // ~75ms to 95% settling
  EQ_BAND: 0.030,      // ~90ms to 95% settling
  TONE_SHELF: 0.030,   // ~90ms to 95% settling
  STEREO_WIDTH: 0.040, // ~120ms to 95% settling
  REPLAY_GAIN: 0.035,  // ~100ms to 95% settling
  BYPASS_SWITCH: 0.020,// ~60ms to 95% settling
  FAST: 0.015,         // ~45ms to 95% settling
} as const;

export class AudioParameterAutomation {
  /**
   * Validate and clamp a numeric audio parameter value.
   * Protects against NaN, ±Infinity, and out-of-range parameters.
   */
  public static validateValue(
    value: unknown,
    fallback = 0,
    min?: number,
    max?: number
  ): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }
    let clamped = value;
    if (min !== undefined && Number.isFinite(min)) {
      clamped = Math.max(min, clamped);
    }
    if (max !== undefined && Number.isFinite(max)) {
      clamped = Math.min(max, clamped);
    }
    return clamped;
  }

  /**
   * Safely cancel upcoming scheduled automation without causing an abrupt discontinuity.
   * If cancelAndHoldAtTime is available, anchors the current value; otherwise uses
   * cancelScheduledValues + setValueAtTime(current).
   */
  public static cancelAutomation(
    param: AudioParam | undefined | null,
    audioCtx: AudioContext | null,
    holdCurrentValue = true
  ): void {
    if (!param || !audioCtx) return;

    try {
      if (audioCtx.state === 'closed') {
        return;
      }

      const now = Math.max(0, audioCtx.currentTime);

      if (holdCurrentValue && typeof (param as any).cancelAndHoldAtTime === 'function') {
        (param as any).cancelAndHoldAtTime(now);
      } else {
        param.cancelScheduledValues(now);
        if (holdCurrentValue) {
          try {
            param.setValueAtTime(param.value, now);
          } catch {
            // In case setValueAtTime fails (e.g. mocked environment), fallback silently
          }
        }
      }
    } catch {
      // AudioContext or param might be in an unexpected state, do not throw
    }
  }

  /**
   * Smoothly transition an AudioParam to targetValue using exponential approach (setTargetAtTime).
   * Safe against rapid successive updates (slider dragging) and AudioContext interruptions.
   */
  public static smoothTransition(
    param: AudioParam | undefined | null,
    targetValue: number,
    audioCtx: AudioContext | null,
    options: AutomationOptions = {}
  ): void {
    if (!param) return;

    const fallback = options.fallback ?? param.value ?? 0;
    const clampedTarget = this.validateValue(targetValue, fallback, options.min, options.max);

    if (!audioCtx || audioCtx.state === 'closed') {
      try {
        param.value = clampedTarget;
      } catch {
        // ignore
      }
      return;
    }

    const now = Math.max(0, audioCtx.currentTime);
    const timeConstant = options.timeConstant ?? AUTOMATION_TIME_CONSTANTS.FAST;

    try {
      if (options.cancelPrevious !== false) {
        // Cancel future events and anchor current value to avoid jumps
        this.cancelAutomation(param, audioCtx, true);
      }
      param.setTargetAtTime(clampedTarget, now, timeConstant);
    } catch {
      // Fallback for mocked AudioParam or edge states
      try {
        param.value = clampedTarget;
      } catch {
        // ignore
      }
    }
  }

  /**
   * Linearly ramp an AudioParam from its current value to targetValue over durationSec.
   * Ideal for dual-deck crossfade faders and volume transitions.
   */
  public static linearRamp(
    param: AudioParam | undefined | null,
    targetValue: number,
    durationSec: number,
    audioCtx: AudioContext | null,
    options: AutomationOptions = {}
  ): void {
    if (!param) return;

    const fallback = options.fallback ?? param.value ?? 0;
    const clampedTarget = this.validateValue(targetValue, fallback, options.min, options.max);
    const safeDuration = Math.max(0.005, Number.isFinite(durationSec) ? durationSec : 0.05);

    if (!audioCtx || audioCtx.state === 'closed') {
      try {
        param.value = clampedTarget;
      } catch {
        // ignore
      }
      return;
    }

    const now = Math.max(0, audioCtx.currentTime);

    try {
      this.cancelAutomation(param, audioCtx, true);
      param.linearRampToValueAtTime(clampedTarget, now + safeDuration);
    } catch {
      try {
        param.value = clampedTarget;
      } catch {
        // ignore
      }
    }
  }

  /**
   * Safely set an AudioParam immediately with bounds validation,
   * cancelling any active automation.
   */
  public static safeSetValue(
    param: AudioParam | undefined | null,
    targetValue: number,
    audioCtx: AudioContext | null,
    options: AutomationOptions = {}
  ): void {
    if (!param) return;

    const fallback = options.fallback ?? param.value ?? 0;
    const clampedTarget = this.validateValue(targetValue, fallback, options.min, options.max);

    if (!audioCtx || audioCtx.state === 'closed') {
      try {
        param.value = clampedTarget;
      } catch {
        // ignore
      }
      return;
    }

    const now = Math.max(0, audioCtx.currentTime);

    try {
      this.cancelAutomation(param, audioCtx, false);
      param.setValueAtTime(clampedTarget, now);
    } catch {
      try {
        param.value = clampedTarget;
      } catch {
        // ignore
      }
    }
  }
}
