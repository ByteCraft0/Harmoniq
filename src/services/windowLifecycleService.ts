/**
 * Harmoniq 2.0.1 - Window Lifecycle & Render Suspension Service
 *
 * Coordinates OS window states (minimized, restored, hidden, visible) and DOM visibility
 * to provide a single, unified signal for when non-essential UI rendering, Canvas visualizers,
 * and high-frequency polling can be safely suspended to achieve near-zero CPU usage.
 */

export type RenderSuspensionListener = (isSuspended: boolean) => void;
export type WindowMinimizedListener = (isMinimized: boolean) => void;

export class WindowLifecycleService {
  private _isMinimized = false;
  private _isVisible = true;
  private suspensionListeners: Set<RenderSuspensionListener> = new Set();
  private minimizedListeners: Set<WindowMinimizedListener> = new Set();
  private cleanups: (() => void)[] = [];

  // Testing overrides
  private mockMinimized: boolean | null = null;
  private mockSuspended: boolean | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined') return;

    // 1. Standard DOM Page Visibility API
    const handleDomVisibility = () => {
      this.evaluateState();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleDomVisibility);
      this.cleanups.push(() => document.removeEventListener('visibilitychange', handleDomVisibility));
    }

    // 2. Electron Native Window Events via IPC bridge
    if (window.harmoniqApi?.onWindowMinimizedChange) {
      const unsub = window.harmoniqApi.onWindowMinimizedChange((minimized: boolean) => {
        this._isMinimized = minimized;
        this.notifyMinimized(minimized);
        this.evaluateState();
      });
      this.cleanups.push(unsub);
    }

    if (window.harmoniqApi?.onWindowVisibilityChange) {
      const unsub = window.harmoniqApi.onWindowVisibilityChange((visible: boolean) => {
        this._isVisible = visible;
        this.evaluateState();
      });
      this.cleanups.push(unsub);
    }

    // Initial check from main process if available
    if (window.harmoniqApi?.isWindowMinimized) {
      window.harmoniqApi.isWindowMinimized().then((minimized) => {
        if (typeof minimized === 'boolean') {
          this._isMinimized = minimized;
          this.evaluateState();
        }
      }).catch(() => {});
    }
  }

  private evaluateState(): void {
    const suspended = this.isRenderingSuspended();
    this.suspensionListeners.forEach((listener) => {
      try {
        listener(suspended);
      } catch (err) {
        console.warn('Error in render suspension listener:', err);
      }
    });
  }

  private notifyMinimized(minimized: boolean): void {
    this.minimizedListeners.forEach((listener) => {
      try {
        listener(minimized);
      } catch (err) {
        console.warn('Error in window minimized listener:', err);
      }
    });
  }

  /**
   * Returns true if non-essential UI rendering, canvas animations, and high-frequency
   * visual timers should be paused to preserve CPU and battery.
   */
  public isRenderingSuspended(): boolean {
    if (this.mockSuspended !== null) return this.mockSuspended;
    if (this.mockMinimized !== null) return this.mockMinimized;

    const isDomHidden = typeof document !== 'undefined' ? document.hidden : false;
    return this._isMinimized || !this._isVisible || isDomHidden;
  }

  public isMinimized(): boolean {
    if (this.mockMinimized !== null) return this.mockMinimized;
    return this._isMinimized;
  }

  public isVisible(): boolean {
    return this._isVisible && (typeof document !== 'undefined' ? !document.hidden : true);
  }

  /**
   * Subscribe to render suspension status changes.
   * Callback receives true when rendering should be suspended, and false when resumed.
   */
  public subscribeSuspension(listener: RenderSuspensionListener): () => void {
    this.suspensionListeners.add(listener);
    // Immediately emit current state to new subscriber
    listener(this.isRenderingSuspended());
    return () => {
      this.suspensionListeners.delete(listener);
    };
  }

  /**
   * Subscribe to window minimized state changes.
   */
  public subscribeMinimized(listener: WindowMinimizedListener): () => void {
    this.minimizedListeners.add(listener);
    listener(this.isMinimized());
    return () => {
      this.minimizedListeners.delete(listener);
    };
  }

  // Unit Test / Benchmark Mocks
  public setMockMinimized(val: boolean | null): void {
    this.mockMinimized = val;
    this.evaluateState();
  }

  public setMockSuspended(val: boolean | null): void {
    this.mockSuspended = val;
    this.evaluateState();
  }

  public destroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.suspensionListeners.clear();
    this.minimizedListeners.clear();
  }
}

export const windowLifecycleService = new WindowLifecycleService();
