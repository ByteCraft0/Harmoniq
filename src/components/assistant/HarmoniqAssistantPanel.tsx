import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Trash2,
  Settings,
  Sparkles,
  ExternalLink,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import { useAssistant } from '../../hooks/useAssistant';
import { useLibrary } from '../../context/LibraryContext';
import { usePlayer } from '../../context/PlayerContext';
import { AppView } from '../../context/LibraryContext';
import { getSuggestedQuestions } from '../../services/assistantKnowledge';
import { HarmoniqPulseOrb } from './HarmoniqPulseOrb';
import { DiscoveryResultsList } from './DiscoveryResultsList';
import { PlaylistPreviewCard } from './PlaylistPreviewCard';
import { AssistantAction, AssistantMessage } from '../../types/assistant';
import { UnifiedTrack, unifiedTrackToTrackMetadata } from '../../types/universalMusic';
import { GeneratedPlaylistPreview } from '../../types/playlistAssistant';
import { assistantService } from '../../services/assistantService';
import { playlistGenerationEngine } from '../../services/playlistGenerationEngine';
import { playlistIntentService } from '../../services/playlistIntentService';

interface HarmoniqAssistantPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenSettings?: () => void;
  hideHeaderOrb?: boolean;
  className?: string;
}

export const HarmoniqAssistantPanel: React.FC<HarmoniqAssistantPanelProps> = ({
  isOpen: isOpenProp,
  onClose: onCloseProp,
  onOpenSettings,
  hideHeaderOrb = false,
  className = ''
}) => {
  const {
    config,
    messages,
    orbState,
    isOpen: hookIsOpen,
    assistantContext,
    isListening,
    interimTranscript,
    closeAssistant,
    sendMessage,
    clearMessages,
    speakMessage,
    stopSpeaking,
    startListening,
    stopListening,
    cancelListening
  } = useAssistant();

  const isPanelOpen = isOpenProp !== undefined ? isOpenProp : hookIsOpen;
  const handleClose = onCloseProp || closeAssistant;

  const { activeView, setActiveView } = useLibrary();
  const { playTrack, addToQueue, playNext, currentTrack, isPlaying } = usePlayer();

  const [inputVal, setInputVal] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const userScrolledUpRef = useRef(false);
  const prevMessagesLengthRef = useRef(messages.length);

  // Register natural language playback handler with assistantService (Phase 5A.2)
  useEffect(() => {
    const unregister = assistantService.registerPlaybackHandler(async (command, track, allTracks) => {
      if (command.action === 'queue_all' && allTracks) {
        for (const t of allTracks) {
          if (
            t.playbackCapability === 'full_stream' ||
            t.playbackCapability === 'preview_stream' ||
            t.playbackCapability === 'local_file'
          ) {
            addToQueue(unifiedTrackToTrackMetadata(t));
          }
        }
        return { success: true, message: `Queued ${allTracks.length} tracks.` };
      }

      if (track) {
        const metadata = unifiedTrackToTrackMetadata(track);
        if (command.action === 'play_index') {
          await playTrack(metadata);
          return { success: true, message: `Playing ${track.title}.` };
        } else if (command.action === 'queue_index') {
          addToQueue(metadata);
          return { success: true, message: `Queued ${track.title}.` };
        } else if (command.action === 'play_next_index') {
          playNext(metadata);
          return { success: true, message: `Playing ${track.title} next.` };
        }
      }

      return { success: false, message: 'No valid track target.' };
    });

    return unregister;
  }, [playTrack, addToQueue, playNext]);

  const handlePlayDiscoveredTrack = async (ut: UnifiedTrack) => {
    const metadata = unifiedTrackToTrackMetadata(ut);
    await playTrack(metadata);
  };

  const handleAddToQueueDiscoveredTrack = (ut: UnifiedTrack) => {
    const metadata = unifiedTrackToTrackMetadata(ut);
    addToQueue(metadata);
  };

  const handlePlayNextDiscoveredTrack = (ut: UnifiedTrack) => {
    const metadata = unifiedTrackToTrackMetadata(ut);
    playNext(metadata);
  };

  const handleQueueAllDiscoveredTracks = (tracks: UnifiedTrack[]) => {
    for (const ut of tracks) {
      if (
        ut.playbackCapability === 'full_stream' ||
        ut.playbackCapability === 'preview_stream' ||
        ut.playbackCapability === 'local_file'
      ) {
        addToQueue(unifiedTrackToTrackMetadata(ut));
      }
    }
  };

  // Conversational Playlist Assistant Handlers (Phase 5A.3)
  const handleSavePlaylistPreview = async (preview: GeneratedPlaylistPreview) => {
    const res = await playlistGenerationEngine.savePlaylistPreview(preview);
    if (res.success) {
      assistantService.updateActivePlaylistPreview(preview);
    }
  };

  const handlePlayAllPlaylistTracks = async (tracks: UnifiedTrack[]) => {
    if (tracks.length === 0) return;
    const first = tracks[0];
    await playTrack(unifiedTrackToTrackMetadata(first));
    for (let i = 1; i < tracks.length; i++) {
      addToQueue(unifiedTrackToTrackMetadata(tracks[i]));
    }
  };

  const handleQueueAllPlaylistTracks = (tracks: UnifiedTrack[]) => {
    for (const t of tracks) {
      addToQueue(unifiedTrackToTrackMetadata(t));
    }
  };

  const handleRemoveTrackFromPreview = (trackId: string) => {
    assistantService.removeTrackFromPreview(trackId);
  };

  const handleDiscardPreview = () => {
    playlistIntentService.clearSession();
    assistantService.updateActivePlaylistPreview({} as any);
  };

  const handleNavigatePlaylists = () => {
    setActiveView('playlists');
  };

  // Stable Scroll Detection: track user scroll position to prevent forced jumping
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom <= 48;
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      userScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
    } else if (distanceFromBottom > 80) {
      userScrolledUpRef.current = true;
      setShowScrollBottomBtn(true);
    }
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
    isNearBottomRef.current = true;
    userScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);
  }, []);

  // Intelligent Auto-scroll:
  // 1. User sends message -> always scroll to latest
  // 2. Assistant finishes / streams -> only keep pinned if user is already near bottom
  // 3. User scrolled upward to inspect history -> preserve reading position, NEVER jerk scroll down
  useEffect(() => {
    if (!isPanelOpen) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    const lastMessage = messages[messages.length - 1];
    prevMessagesLengthRef.current = messages.length;

    if (isNewMessage) {
      if (lastMessage?.role === 'user') {
        scrollToBottom(true);
        return;
      }
      if (isNearBottomRef.current && !userScrolledUpRef.current) {
        scrollToBottom(false);
      }
      return;
    }

    // Keep pinned to bottom during live streaming ONLY if user is already at the bottom
    if (isNearBottomRef.current && !userScrolledUpRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, interimTranscript, isPanelOpen, scrollToBottom]);

  // Initial scroll on open so recent conversation is visible immediately without smooth animation jitter
  useEffect(() => {
    if (isPanelOpen) {
      const timer = setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          isNearBottomRef.current = true;
          userScrolledUpRef.current = false;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isPanelOpen]);

  // Focus input on panel open & handle Escape key
  useEffect(() => {
    if (isPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isPanelOpen, handleClose]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputVal).trim();
    if (!text) return;

    setInputVal('');
    await sendMessage(text, activeView);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleActionClick = (action: AssistantAction) => {
    if (action.actionType === 'navigate' && action.target) {
      setActiveView(action.target);
    } else if (action.actionType === 'custom' && action.payload?.url) {
      if (typeof window !== 'undefined' && (window as any).harmoniqApi?.openExternalUrl) {
        (window as any).harmoniqApi.openExternalUrl(action.payload.url);
      } else {
        window.open(action.payload.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((finalText) => {
        if (finalText.trim()) {
          handleSend(finalText);
        }
      });
    }
  };

  const suggestedQuestions = getSuggestedQuestions(activeView, assistantContext || undefined);

  if (!isPanelOpen) return null;

  return (
    <div
      aria-label="Harmoniq Assistant Window"
      className={`fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] flex flex-col bg-[#0b0813]/95 backdrop-blur-2xl border border-violet-500/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(139,92,246,0.25)] overflow-hidden transition-all duration-300 animate-assistant-enter ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-950/40 via-purple-900/20 to-transparent border-b border-violet-500/20 select-none">
        <div className="flex items-center gap-2.5">
          {hideHeaderOrb ? (
            <div className="w-8 h-8 flex-shrink-0" aria-hidden="true" />
          ) : (
            <HarmoniqPulseOrb state={orbState} onClick={handleClose} docked={true} className="!w-7 !h-7" />
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-violet-100 tracking-wide">
                Harmoniq Assistant
              </span>
              <span className="px-1.5 py-0.2 text-[10px] font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-full">
                {config.provider === 'local' ? 'Local Grounded' : config.provider.toUpperCase()}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 capitalize">
              Viewing: <span className="text-violet-300 font-medium">{activeView.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 text-zinc-400">
          <button
            onClick={() => setShowClearConfirm(true)}
            title="Clear Chat History"
            aria-label="Clear Chat History"
            className="p-1.5 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {onOpenSettings && (
            <button
              onClick={() => {
                onOpenSettings();
                handleClose();
              }}
              title="Assistant Settings"
              aria-label="Assistant Settings"
              className="p-1.5 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleClose}
            title="Close Assistant"
            aria-label="Close Assistant"
            className="p-1.5 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-colors ml-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Clear Confirmation Prompt */}
      {showClearConfirm && (
        <div className="px-4 py-2 bg-rose-950/70 border-b border-rose-500/30 flex items-center justify-between text-xs text-rose-200 animate-in fade-in">
          <span>Clear conversation history?</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearMessages();
                setShowClearConfirm(false);
              }}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-medium transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-zinc-300 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages Thread (Stable Scroll Container with Overscroll Containment) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ overscrollBehavior: 'contain' }}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5 scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent relative"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                  : 'bg-white/[0.04] border border-violet-500/20 text-zinc-200 shadow-sm'
              }`}
            >
              {/* Message Content Formatted */}
              <div className="whitespace-pre-wrap font-sans space-y-1">
                {msg.content.split('\n\n').map((paragraph, pIdx) => {
                  if (paragraph.startsWith('### ')) {
                    return (
                      <h4 key={pIdx} className="font-semibold text-violet-300 text-sm mb-1">
                        {paragraph.replace('### ', '')}
                      </h4>
                    );
                  }
                  if (paragraph.startsWith('> [!TIP]')) {
                    return (
                      <div
                        key={pIdx}
                        className="my-1.5 p-2 bg-violet-950/40 border-l-2 border-violet-400 rounded text-[11px] text-violet-200"
                      >
                        {paragraph.replace('> [!TIP]', '').replace(/>\s*/g, '')}
                      </div>
                    );
                  }
                  return <p key={pIdx}>{paragraph}</p>;
                })}
              </div>

              {/* Natural Language Music Discovery Results (Phase 5A.2) */}
              {msg.discoveryResults && msg.discoveryResults.length > 0 && (
                <DiscoveryResultsList
                  tracks={msg.discoveryResults}
                  onPlayTrack={handlePlayDiscoveredTrack}
                  onAddToQueue={handleAddToQueueDiscoveredTrack}
                  onPlayNext={handlePlayNextDiscoveredTrack}
                  onQueueAll={handleQueueAllDiscoveredTracks}
                  currentTrackId={currentTrack?.id}
                  isPlaying={isPlaying}
                />
              )}

              {/* Conversational Playlist Preview Card (Phase 5A.3) */}
              {msg.playlistPreview && (
                <PlaylistPreviewCard
                  preview={msg.playlistPreview}
                  onSave={handleSavePlaylistPreview}
                  onPlayAll={handlePlayAllPlaylistTracks}
                  onQueueAll={handleQueueAllPlaylistTracks}
                  onPlayTrack={handlePlayDiscoveredTrack}
                  onRemoveTrack={handleRemoveTrackFromPreview}
                  onDiscard={handleDiscardPreview}
                  onNavigatePlaylists={handleNavigatePlaylists}
                  currentTrackId={currentTrack?.id}
                  isPlaying={isPlaying}
                />
              )}

              {/* Action Buttons */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-violet-500/20 flex flex-wrap gap-1.5">
                  {msg.actions.map((act) => (
                    <button
                      key={act.id}
                      onClick={() => handleActionClick(act)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-600/30 hover:bg-violet-600/60 border border-violet-400/40 hover:border-violet-300 text-violet-100 rounded-lg text-[11px] font-medium transition-all shadow-sm active:scale-95"
                    >
                      <Sparkles className="w-3 h-3 text-violet-300" />
                      <span>{act.label}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Message Sub-Actions (Copy, Speech) for Assistant Messages */}
            {msg.role === 'assistant' && (
              <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-zinc-500">
                <button
                  onClick={() => handleCopy(msg.content, msg.id)}
                  className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                  title="Copy response"
                >
                  {copiedId === msg.id ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => speakMessage(msg.id)}
                  className="flex items-center gap-1 hover:text-zinc-300 transition-colors"
                  title={msg.audioPlaying ? 'Stop speaking' : 'Read aloud'}
                >
                  {msg.audioPlaying ? (
                    <>
                      <VolumeX className="w-3 h-3 text-violet-400 animate-pulse" />
                      <span className="text-violet-400">Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3 h-3" />
                      <span>Listen</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Live Interim Speech Recognition Transcript */}
        {isListening && (
          <div className="p-3 bg-cyan-950/30 border border-cyan-400/30 rounded-xl text-xs text-cyan-200 animate-pulse">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold flex items-center gap-1.5 text-[11px] text-cyan-300">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Listening to your voice...
              </span>
              <button
                onClick={cancelListening}
                className="text-[10px] text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
            <p className="italic text-zinc-300">
              {interimTranscript || 'Speak clearly into your microphone...'}
            </p>
          </div>
        )}

        {/* Orb Processing Loader */}
        {orbState === 'processing' && (
          <div className="flex items-center gap-2 p-2.5 bg-violet-950/20 border border-violet-500/20 rounded-xl max-w-[70%]">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" />
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
            <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-bounce [animation-delay:0.4s]" />
            <span className="text-xs text-violet-300 font-medium ml-1">Harmoniq thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Return to Latest Messages Button */}
      {showScrollBottomBtn && (
        <button
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest messages"
          title="Scroll to latest messages"
          className="absolute bottom-[72px] right-6 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600/90 hover:bg-violet-500 text-white text-[11px] font-medium shadow-[0_4px_14px_rgba(139,92,246,0.6)] border border-violet-400/50 backdrop-blur-md transition-all active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span>Latest</span>
        </button>
      )}

      {/* Suggested Questions Carousel / Chips */}
      {messages.length <= 3 && suggestedQuestions.length > 0 && (
        <div className="px-3 py-2 bg-black/20 border-t border-violet-500/10">
          <div className="text-[10px] font-semibold text-violet-300/80 uppercase tracking-wider mb-1.5 px-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-violet-400" />
            Suggested Questions
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto scrollbar-none">
            {suggestedQuestions.slice(0, 3).map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="text-left px-2.5 py-1 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/40 text-violet-200 rounded-lg text-[11px] transition-colors leading-snug"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input Bar */}
      <div className="p-3 bg-[#0d0917] border-t border-violet-500/20 flex items-end gap-2">
        {/* Multiline Input */}
        <div className="flex-1 relative bg-white/[0.04] border border-violet-500/25 focus-within:border-violet-400/60 rounded-xl overflow-hidden transition-colors">
          <textarea
            ref={inputRef}
            rows={1}
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening...' : 'Ask Harmoniq anything... (Shift+Enter for newline)'}
            className="w-full bg-transparent px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 resize-none outline-none max-h-24 leading-relaxed"
          />
        </div>

        {/* Microphone STT Button */}
        <button
          onClick={toggleMic}
          title={isListening ? 'Stop listening' : 'Speak question'}
          aria-label={isListening ? 'Stop microphone' : 'Start microphone'}
          className={`p-2.5 rounded-xl border transition-all ${
            isListening
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 animate-pulse'
              : 'bg-white/[0.04] border-violet-500/25 text-zinc-400 hover:text-violet-200 hover:border-violet-400/50 hover:bg-violet-500/10'
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Send Button */}
        <button
          onClick={() => handleSend()}
          disabled={!inputVal.trim() || orbState === 'processing'}
          title="Send message"
          aria-label="Send message"
          className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl shadow-md transition-all active:scale-95"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
