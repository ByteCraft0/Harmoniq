import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppView } from './LibraryContext';
import { Album, Artist, Playlist } from '../types/library';

export interface NavigationState {
  view: AppView;
  selectedAlbum?: Album | null;
  selectedArtist?: Artist | null;
  selectedPlaylist?: Playlist | null;
}

interface NavigationContextType {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  historyLength: number;
  currentIndex: number;
  // Triggered by LibraryContext / UI navigation
  recordNavigation: (entry: NavigationState) => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const NavigationProvider: React.FC<{
  children: React.ReactNode;
  activeView: AppView;
  selectedAlbum: Album | null;
  selectedArtist: Artist | null;
  selectedPlaylist: Playlist | null;
  onRestoreState: (state: NavigationState) => void;
}> = ({
  children,
  activeView,
  selectedAlbum,
  selectedArtist,
  selectedPlaylist,
  onRestoreState,
}) => {
  // History stack
  const [history, setHistory] = useState<NavigationState[]>([
    {
      view: 'home',
      selectedAlbum: null,
      selectedArtist: null,
      selectedPlaylist: null,
    },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Guard flag to avoid re-recording history when navigating back/forward
  const isNavigatingHistoryRef = useRef(false);

  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < history.length - 1;

  // Navigate Back
  const goBack = useCallback(() => {
    if (currentIndex <= 0) return;
    const targetIndex = currentIndex - 1;
    const targetState = history[targetIndex];
    if (!targetState) return;

    isNavigatingHistoryRef.current = true;
    setCurrentIndex(targetIndex);
    onRestoreState(targetState);
    setTimeout(() => {
      isNavigatingHistoryRef.current = false;
    }, 50);
  }, [currentIndex, history, onRestoreState]);

  // Navigate Forward
  const goForward = useCallback(() => {
    if (currentIndex >= history.length - 1) return;
    const targetIndex = currentIndex + 1;
    const targetState = history[targetIndex];
    if (!targetState) return;

    isNavigatingHistoryRef.current = true;
    setCurrentIndex(targetIndex);
    onRestoreState(targetState);
    setTimeout(() => {
      isNavigatingHistoryRef.current = false;
    }, 50);
  }, [currentIndex, history, onRestoreState]);

  // Record a new navigation entry (avoids consecutive duplicates and drops forward stack)
  const recordNavigation = useCallback(
    (newState: NavigationState) => {
      if (isNavigatingHistoryRef.current) return;

      setHistory((prevHistory) => {
        const currentEntry = prevHistory[currentIndex];
        // Check if identical to current state
        if (
          currentEntry &&
          currentEntry.view === newState.view &&
          currentEntry.selectedAlbum?.id === newState.selectedAlbum?.id &&
          currentEntry.selectedArtist?.name === newState.selectedArtist?.name &&
          currentEntry.selectedPlaylist?.id === newState.selectedPlaylist?.id
        ) {
          return prevHistory;
        }

        // Truncate any forward history and append new entry
        const truncated = prevHistory.slice(0, currentIndex + 1);
        const nextHistory = [...truncated, newState];
        setCurrentIndex(nextHistory.length - 1);
        return nextHistory;
      });
    },
    [currentIndex]
  );

  // Sync state changes originating from UI actions
  useEffect(() => {
    if (isNavigatingHistoryRef.current) return;

    recordNavigation({
      view: activeView,
      selectedAlbum,
      selectedArtist,
      selectedPlaylist,
    });
  }, [activeView, selectedAlbum, selectedArtist, selectedPlaylist, recordNavigation]);

  // Global Keyboard Navigation (Alt + ArrowLeft, Alt + ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never interfere with user input fields
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.altKey && (e.key === 'ArrowLeft' || e.code === 'ArrowLeft')) {
        e.preventDefault();
        e.stopPropagation();
        goBack();
      } else if (e.altKey && (e.key === 'ArrowRight' || e.code === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        goForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [goBack, goForward]);

  return (
    <NavigationContext.Provider
      value={{
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        historyLength: history.length,
        currentIndex,
        recordNavigation,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
