import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getPlatformDriver } from '../../services/platform';
import { App } from '@capacitor/app';

export type MobileTab = 'home' | 'radio' | 'library' | 'playlists' | 'settings';

export interface MobileNavigationState {
  tab: MobileTab;
  playlistId?: string | null;
}

export interface OverlayHandler {
  id: string;
  /**
   * Priority hierarchy (lower number = higher precedence):
   * 1: Active modal / confirmation dialog
   * 2: Open dropdown, popover, or context menu
   * 3: Expanded Now Playing sheet
   * 4: Active search query / temporary detail view
   * 5: Nested screen / playlist detail
   */
  priority: number;
  dismiss: () => boolean;
}

export interface MobileNavigationContextType {
  activeTab: MobileTab;
  selectedPlaylistId: string | null;
  isNowPlayingOpen: boolean;
  history: MobileNavigationState[];
  canGoBack: boolean;

  // View navigation
  navigateTab: (tab: MobileTab, options?: { playlistId?: string | null; clearHistory?: boolean }) => void;
  openPlaylist: (playlistId: string) => void;
  closePlaylist: () => void;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;

  // Unified Back action
  goBack: () => Promise<boolean>;

  // Overlay registration
  registerOverlayHandler: (handler: OverlayHandler) => () => void;
}

const MobileNavigationContext = createContext<MobileNavigationContextType | null>(null);

const MAX_HISTORY_LENGTH = 20;

export const MobileNavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [history, setHistory] = useState<MobileNavigationState[]>([]);

  // Refs to prevent stale React closures in asynchronous event callbacks
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const selectedPlaylistIdRef = useRef(selectedPlaylistId);
  selectedPlaylistIdRef.current = selectedPlaylistId;

  const isNowPlayingOpenRef = useRef(isNowPlayingOpen);
  isNowPlayingOpenRef.current = isNowPlayingOpen;

  const historyRef = useRef(history);
  historyRef.current = history;

  const overlayHandlersRef = useRef<Map<string, OverlayHandler>>(new Map());
  const isNavigatingHistoryRef = useRef(false);

  // Register an overlay handler with priority ordering
  const registerOverlayHandler = useCallback((handler: OverlayHandler) => {
    overlayHandlersRef.current.set(handler.id, handler);
    return () => {
      overlayHandlersRef.current.delete(handler.id);
    };
  }, []);

  // Navigate to a main tab with history tracking
  const navigateTab = useCallback(
    (tab: MobileTab, options?: { playlistId?: string | null; clearHistory?: boolean }) => {
      const currentTab = activeTabRef.current;
      const currentPlaylist = selectedPlaylistIdRef.current;
      const targetPlaylist = options?.playlistId ?? null;

      // Deduplicate: ignore identical consecutive state
      if (currentTab === tab && currentPlaylist === targetPlaylist && !options?.clearHistory) {
        return;
      }

      if (options?.clearHistory || (tab === 'home' && currentTab === 'home')) {
        setHistory([]);
        historyRef.current = [];
      } else if (!isNavigatingHistoryRef.current) {
        // Record current state in history
        const prevEntry: MobileNavigationState = {
          tab: currentTab,
          playlistId: currentPlaylist,
        };

        setHistory((prev) => {
          const last = prev[prev.length - 1];
          // Do not push identical consecutive entry
          if (last && last.tab === prevEntry.tab && last.playlistId === prevEntry.playlistId) {
            return prev;
          }
          const updated = [...prev, prevEntry];
          if (updated.length > MAX_HISTORY_LENGTH) {
            return updated.slice(updated.length - MAX_HISTORY_LENGTH);
          }
          return updated;
        });
      }

      setActiveTab(tab);
      activeTabRef.current = tab;
      setSelectedPlaylistId(targetPlaylist);
      selectedPlaylistIdRef.current = targetPlaylist;
    },
    []
  );

  const openPlaylist = useCallback(
    (playlistId: string) => {
      navigateTab('playlists', { playlistId });
    },
    [navigateTab]
  );

  const closePlaylist = useCallback(() => {
    setSelectedPlaylistId(null);
    selectedPlaylistIdRef.current = null;
  }, []);

  const openNowPlaying = useCallback(() => {
    setIsNowPlayingOpen(true);
    isNowPlayingOpenRef.current = true;
  }, []);

  const closeNowPlaying = useCallback(() => {
    setIsNowPlayingOpen(false);
    isNowPlayingOpenRef.current = false;
  }, []);

  // Core unified Back navigation logic
  const goBack = useCallback(async (): Promise<boolean> => {
    // 1 & 2. Check registered overlay handlers (Modals, Dropdowns, Menus, Search overlays)
    const handlers = Array.from(overlayHandlersRef.current.values()).sort(
      (a, b) => a.priority - b.priority
    );

    for (const handler of handlers) {
      const dismissed = handler.dismiss();
      if (dismissed) {
        return true; // Overlay consumed Back event
      }
    }

    // 3. Priority 3: Expanded Now Playing sheet
    if (isNowPlayingOpenRef.current) {
      closeNowPlaying();
      return true;
    }

    // 4. Priority 5: Nested playlist detail view
    if (selectedPlaylistIdRef.current) {
      closePlaylist();
      return true;
    }

    // 5. Priority 6: Main navigation history stack
    if (historyRef.current.length > 0) {
      const nextHistory = [...historyRef.current];
      const previousState = nextHistory.pop()!;
      setHistory(nextHistory);
      historyRef.current = nextHistory;

      isNavigatingHistoryRef.current = true;
      setActiveTab(previousState.tab);
      activeTabRef.current = previousState.tab;
      setSelectedPlaylistId(previousState.playlistId || null);
      selectedPlaylistIdRef.current = previousState.playlistId || null;

      setTimeout(() => {
        isNavigatingHistoryRef.current = false;
      }, 50);

      return true;
    }

    // 6. If on a sub-tab other than Home and history is empty, navigate to Home root
    if (activeTabRef.current !== 'home') {
      setActiveTab('home');
      activeTabRef.current = 'home';
      setSelectedPlaylistId(null);
      selectedPlaylistIdRef.current = null;
      return true;
    }

    // 7. Priority 7: Root-screen policy (At Home with no history and no overlays)
    // Gracefully minimize the Android app to the background without killing audio playback
    const driver = getPlatformDriver();
    if (driver.isAndroid) {
      try {
        const cap = (window as any).Capacitor;
        const appPlugin = cap?.Plugins?.App || App;
        if (appPlugin?.minimizeApp) {
          await appPlugin.minimizeApp();
          return true;
        }
      } catch (err) {
        console.warn('[MobileNavigation] Failed to minimize app at root:', err);
      }
    }

    return false;
  }, [closeNowPlaying, closePlaylist]);

  // Keep a stable ref to goBack for Capacitor native listener
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  // Single coordinated Capacitor backButton listener (Android only)
  useEffect(() => {
    const driver = getPlatformDriver();
    if (!driver.isAndroid) return;

    let backHandle: any = null;
    let isMounted = true;

    try {
      const cap = (window as any).Capacitor;
      const appPlugin = cap?.Plugins?.App || App;
      if (appPlugin?.addListener) {
        appPlugin
          .addListener('backButton', () => {
            if (isMounted) {
              goBackRef.current().catch((e: any) => {
                console.warn('[MobileNavigation] Error in backButton handler:', e);
              });
            }
          })
          .then((handle: any) => {
            if (isMounted) {
              backHandle = handle;
            } else {
              handle?.remove?.();
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      console.warn('[MobileNavigation] Failed to attach backButton listener:', e);
    }

    return () => {
      isMounted = false;
      if (backHandle?.remove) {
        backHandle.remove();
      }
    };
  }, []);

  const canGoBack =
    isNowPlayingOpen ||
    selectedPlaylistId !== null ||
    history.length > 0 ||
    activeTab !== 'home' ||
    overlayHandlersRef.current.size > 0;

  return (
    <MobileNavigationContext.Provider
      value={{
        activeTab,
        selectedPlaylistId,
        isNowPlayingOpen,
        history,
        canGoBack,
        navigateTab,
        openPlaylist,
        closePlaylist,
        openNowPlaying,
        closeNowPlaying,
        goBack,
        registerOverlayHandler,
      }}
    >
      {children}
    </MobileNavigationContext.Provider>
  );
};

export const useMobileNavigation = (): MobileNavigationContextType => {
  const context = useContext(MobileNavigationContext);
  if (!context) {
    throw new Error('useMobileNavigation must be used within a MobileNavigationProvider');
  }
  return context;
};

/**
 * Hook to register dismissible overlays, dialogs, dropdowns, and search states.
 * Automatically unregisters upon unmount or when `active` becomes false.
 */
export function useBackHandler(
  priority: number,
  onDismiss: () => boolean,
  active = true
): void {
  const { registerOverlayHandler } = useMobileNavigation();
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!active) return;
    const id = `overlay_${priority}_${Math.random().toString(36).substring(2, 9)}`;
    return registerOverlayHandler({
      id,
      priority,
      dismiss: () => onDismissRef.current(),
    });
  }, [active, priority, registerOverlayHandler]);
}
