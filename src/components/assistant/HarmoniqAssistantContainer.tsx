import React, { useEffect, useRef } from 'react';
import { useAssistant } from '../../hooks/useAssistant';
import { HarmoniqPulseOrb } from './HarmoniqPulseOrb';
import { HarmoniqAssistantPanel } from './HarmoniqAssistantPanel';

interface HarmoniqAssistantContainerProps {
  onOpenSettings?: () => void;
  className?: string;
}

/**
 * HarmoniqAssistantContainer (Phase 5A.4)
 *
 * Persistent component architecture for Harmoniq's AI Assistant:
 * - Keeps the Harmoniq Pulse Orb persistently mounted from the moment the assistant is enabled.
 * - Fixes the lifecycle issue where opening the assistant unmounted the Orb.
 * - Smoothly transitions the single Pulse Orb between floating position (w-14 h-14)
 *   and docked panel-header position (w-8 h-8).
 * - Preserves conversation history, TTS audio, and speech state across open/close transitions.
 * - Provides full keyboard accessibility (Enter/Space to open, Escape to close, focus restoration).
 */
export const HarmoniqAssistantContainer: React.FC<HarmoniqAssistantContainerProps> = ({
  onOpenSettings,
  className = '',
}) => {
  const {
    config,
    isOpen,
    orbState,
    openAssistant,
    closeAssistant,
  } = useAssistant();

  const containerRef = useRef<HTMLDivElement>(null);
  const orbWrapperRef = useRef<HTMLDivElement>(null);

  // Keyboard accessibility: Escape closes the assistant panel and restores focus to the Orb
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAssistant();
        setTimeout(() => {
          const orbButton = orbWrapperRef.current?.querySelector('[role="button"]') as HTMLElement | null;
          orbButton?.focus();
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeAssistant]);

  if (!config.enabled) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      aria-label="Harmoniq AI Companion Container"
      className={`fixed bottom-24 right-6 select-none ${
        isOpen ? 'z-50 pointer-events-auto' : 'z-40 pointer-events-auto'
      } ${className}`}
    >
      {/* Expanded Assistant Panel */}
      <div
        aria-hidden={!isOpen}
        className={`transition-all duration-300 ease-out origin-bottom-right ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 translate-y-3 pointer-events-none'
        }`}
      >
        <HarmoniqAssistantPanel
          isOpen={isOpen}
          onClose={closeAssistant}
          onOpenSettings={onOpenSettings}
          hideHeaderOrb={true}
          className="!fixed !bottom-24 !right-6"
        />
      </div>

      {/*
        Persistent Single Pulse Orb:
        - When closed: Anchored as the floating action Orb at the bottom-right.
        - When open: Docked smoothly into the top-left of the expanded panel header.
        - NEVER unmounted, keeping animation, audio reactive state, and DOM identity intact.
      */}
      <div
        ref={orbWrapperRef}
        className={`transition-all duration-300 ease-out pointer-events-auto ${
          isOpen
            ? 'absolute top-3 left-4 z-[55]'
            : 'relative z-40'
        }`}
      >
        <HarmoniqPulseOrb
          state={orbState}
          onClick={isOpen ? closeAssistant : openAssistant}
          docked={isOpen}
          reducedMotion={config.reducedMotion}
        />
      </div>
    </div>
  );
};
