/**
 * Mid-Side Stereo Width Processor for Harmoniq DSP Pipeline
 *
 * Implements M/S (Mid-Side) matrix spatial width processing:
 *   M = (L + R) / 2   (Mid / Sum: Center channel)
 *   S = (L - R) / 2   (Side / Difference: Stereo ambient width)
 *
 * Output with width factor w:
 *   L' = M + w * S = ((1 + w) / 2) * L + ((1 - w) / 2) * R
 *   R' = M - w * S = ((1 - w) / 2) * L + ((1 + w) / 2) * R
 *
 * Properties:
 *   - w = 1.0 (100%): Exact identity (LL=1, RL=0, LR=0, RR=1). Unmodified stereo image.
 *   - w = 0.0 (0%):   Pure mono downmix (LL=0.5, RL=0.5, LR=0.5, RR=0.5).
 *   - w = 1.5 (150%): Maximum safe widening (LL=1.25, RL=-0.25, LR=-0.25, RR=1.25).
 *   - Center invariant: For any center signal (L = R), L' = L and R' = R across all w!
 *   - Clean bypass path: Crossfading active/bypass gains prevents clicks.
 */

import { AudioParameterAutomation, AUTOMATION_TIME_CONSTANTS } from './audioParameterAutomation';

export class StereoWidthProcessor {
  private audioCtx: AudioContext;
  private inputNode: GainNode;
  private outputNode: GainNode;

  // Mid-Side Matrix Nodes
  private splitter: ChannelSplitterNode;
  private gainLL: GainNode;
  private gainRL: GainNode;
  private gainLR: GainNode;
  private gainRR: GainNode;
  private merger: ChannelMergerNode;

  // Bypass crossfaders
  private activeGain: GainNode;
  private bypassGain: GainNode;

  private currentWidthPercent = 100; // 0 to 150
  private isEnabled = false;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;

    // 1. Input and Output summing nodes
    this.inputNode = audioCtx.createGain();
    this.outputNode = audioCtx.createGain();

    // 2. M/S Matrix Routing
    this.splitter = audioCtx.createChannelSplitter(2);
    this.gainLL = audioCtx.createGain();
    this.gainRL = audioCtx.createGain();
    this.gainLR = audioCtx.createGain();
    this.gainRR = audioCtx.createGain();
    this.merger = audioCtx.createChannelMerger(2);

    // Initial neutral matrix coefficients (w = 1.0 / 100%)
    this.gainLL.gain.value = 1.0;
    this.gainRL.gain.value = 0.0;
    this.gainLR.gain.value = 0.0;
    this.gainRR.gain.value = 1.0;

    // Wire Splitter -> Matrix Gains
    // Ch 0 (Left in) -> LL (to Left out) and LR (to Right out)
    this.splitter.connect(this.gainLL, 0);
    this.splitter.connect(this.gainLR, 0);

    // Ch 1 (Right in) -> RL (to Left out) and RR (to Right out)
    this.splitter.connect(this.gainRL, 1);
    this.splitter.connect(this.gainRR, 1);

    // Wire Matrix Gains -> Merger
    // Left out (input 0 of merger)
    this.gainLL.connect(this.merger, 0, 0);
    this.gainRL.connect(this.merger, 0, 0);
    // Right out (input 1 of merger)
    this.gainLR.connect(this.merger, 0, 1);
    this.gainRR.connect(this.merger, 0, 1);

    // 3. Bypass / Active Crossfade Paths
    this.activeGain = audioCtx.createGain();
    this.bypassGain = audioCtx.createGain();

    // Initially bypassed (disabled by default)
    this.activeGain.gain.value = 0.0;
    this.bypassGain.gain.value = 1.0;

    // Active path: input -> splitter -> matrix -> merger -> activeGain -> output
    this.inputNode.connect(this.splitter);
    this.merger.connect(this.activeGain);
    this.activeGain.connect(this.outputNode);

    // Bypass path: input -> bypassGain -> output
    this.inputNode.connect(this.bypassGain);
    this.bypassGain.connect(this.outputNode);
  }

  public getInputNode(): GainNode {
    return this.inputNode;
  }

  public getOutputNode(): GainNode {
    return this.outputNode;
  }

  /**
   * Set stereo width percentage (0% to 150%).
   * 0% = Mono sum
   * 100% = Standard Stereo (neutral identity)
   * 150% = Expanded Wide Stage
   */
  public setWidth(widthPercent: number, smooth = true): void {
    const clampedPercent = AudioParameterAutomation.validateValue(widthPercent, 100, 0, 150);
    this.currentWidthPercent = clampedPercent;

    const w = clampedPercent / 100; // 0.0 to 1.5

    // M/S Matrix Coefficients:
    // G_LL = (1 + w) / 2
    // G_RL = (1 - w) / 2
    // G_LR = (1 - w) / 2
    // G_RR = (1 + w) / 2
    const gLL = (1 + w) / 2;
    const gRL = (1 - w) / 2;
    const gLR = (1 - w) / 2;
    const gRR = (1 + w) / 2;

    const tc = AUTOMATION_TIME_CONSTANTS.STEREO_WIDTH;

    if (smooth && this.audioCtx.state !== 'closed') {
      AudioParameterAutomation.smoothTransition(this.gainLL.gain, gLL, this.audioCtx, { timeConstant: tc });
      AudioParameterAutomation.smoothTransition(this.gainRL.gain, gRL, this.audioCtx, { timeConstant: tc });
      AudioParameterAutomation.smoothTransition(this.gainLR.gain, gLR, this.audioCtx, { timeConstant: tc });
      AudioParameterAutomation.smoothTransition(this.gainRR.gain, gRR, this.audioCtx, { timeConstant: tc });
    } else {
      AudioParameterAutomation.safeSetValue(this.gainLL.gain, gLL, this.audioCtx);
      AudioParameterAutomation.safeSetValue(this.gainRL.gain, gRL, this.audioCtx);
      AudioParameterAutomation.safeSetValue(this.gainLR.gain, gLR, this.audioCtx);
      AudioParameterAutomation.safeSetValue(this.gainRR.gain, gRR, this.audioCtx);
    }
  }

  public getWidth(): number {
    return this.currentWidthPercent;
  }

  /**
   * Enable or bypass stereo width processing.
   * Smoothly crossfades between active matrix path and dry bypass path to avoid clicks.
   */
  public setEnabled(enabled: boolean, smooth = true): void {
    this.isEnabled = !!enabled;

    const targetActive = this.isEnabled ? 1.0 : 0.0;
    const targetBypass = this.isEnabled ? 0.0 : 1.0;
    const tc = AUTOMATION_TIME_CONSTANTS.BYPASS_SWITCH;

    if (smooth && this.audioCtx.state !== 'closed') {
      AudioParameterAutomation.smoothTransition(this.activeGain.gain, targetActive, this.audioCtx, { timeConstant: tc });
      AudioParameterAutomation.smoothTransition(this.bypassGain.gain, targetBypass, this.audioCtx, { timeConstant: tc });
    } else {
      AudioParameterAutomation.safeSetValue(this.activeGain.gain, targetActive, this.audioCtx);
      AudioParameterAutomation.safeSetValue(this.bypassGain.gain, targetBypass, this.audioCtx);
    }
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Return the current theoretical matrix coefficients for diagnostic testing
   */
  public getMatrixCoefficients(): { gLL: number; gRL: number; gLR: number; gRR: number } {
    const w = this.currentWidthPercent / 100;
    return {
      gLL: (1 + w) / 2,
      gRL: (1 - w) / 2,
      gLR: (1 - w) / 2,
      gRR: (1 + w) / 2,
    };
  }

  /**
   * Cleanly disconnect all internal AudioNodes
   */
  public dispose(): void {
    try {
      this.inputNode.disconnect();
      this.splitter.disconnect();
      this.gainLL.disconnect();
      this.gainRL.disconnect();
      this.gainLR.disconnect();
      this.gainRR.disconnect();
      this.merger.disconnect();
      this.activeGain.disconnect();
      this.bypassGain.disconnect();
      this.outputNode.disconnect();
    } catch {
      // Ignore disconnect errors if nodes are already unlinked
    }
  }
}
