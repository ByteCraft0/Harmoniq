import React, { useState } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useLibrary } from '../../context/LibraryContext';
import { AdvancedVisualizer, VisualizerStyle } from '../visualizer/AdvancedVisualizer';
import { RealTimeFrequencySpectrum } from '../visualizer/RealTimeFrequencySpectrum';
import { CircularAudioVisualizer } from '../visualizer/CircularAudioVisualizer';
import { FullScreenVisualizer } from '../visualizer/FullScreenVisualizer';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  Disc3,
  Sliders,
  BarChart3,
  Waves,
  Activity,
  ArrowLeft,
  Volume2,
} from 'lucide-react';

export const VisualizerView: React.FC = () => {
  const { currentTrack, isPlaying } = usePlayer();
  const { setActiveView } = useLibrary();
  const [activeTab, setActiveTab] = useState<'advanced' | 'circular' | 'spectrum'>('advanced');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  if (isFullscreen) {
    return <FullScreenVisualizer onClose={toggleFullscreen} />;
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col gap-5 select-none relative p-6 sm:p-8 pb-10 max-w-6xl mx-auto scrollbar-thin">
      {/* Top Header / Mode Bar */}
      <div className="flex flex-wrap items-center justify-between z-20 pb-4 border-b border-[#272733] shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('now_playing')}
            className="p-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            title="Return to Now Playing"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-[var(--accent-dynamic)] to-[#A78BFA] text-white shadow-glow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F5F3FF] tracking-tight">Audio Visualizer Studio</h2>
              <p className="text-xs text-[#A1A1AA]">
                Real-time frequency analysis & reactive 60fps audio synthesis
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none max-w-full">
          <div className="flex items-center bg-[#14141B] border border-[#272733] rounded-xl p-0.5 text-xs shrink-0">
            <button
              onClick={() => setActiveTab('advanced')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === 'advanced'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              <Sparkles size={13} />
              <span>Multi-Style Visualizer</span>
            </button>
            <button
              onClick={() => setActiveTab('circular')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === 'circular'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              <Disc3 size={13} />
              <span>Circular Vinyl Hub</span>
            </button>
            <button
              onClick={() => setActiveTab('spectrum')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap ${
                activeTab === 'spectrum'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-glow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              <BarChart3 size={13} />
              <span>7-Band Log Spectrum</span>
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors shrink-0"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Visualizer Stage */}
      <div className="flex-1 w-full my-auto flex items-center justify-center min-h-[280px] max-h-[620px] py-4 relative z-10">
        {activeTab === 'advanced' && (
          <div className="w-full h-full min-h-[280px] max-h-[540px]">
            <AdvancedVisualizer
              height={480}
              fullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              showControlsBar={true}
            />
          </div>
        )}

        {activeTab === 'circular' && (
          <div className="w-full h-full max-h-[540px] flex items-center justify-center">
            <CircularAudioVisualizer
              size={460}
              fullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>
        )}

        {activeTab === 'spectrum' && (
          <div className="w-full h-full min-h-[280px] max-h-[480px]">
            <RealTimeFrequencySpectrum height={400} compact={false} />
          </div>
        )}
      </div>

      {/* Bottom Track Meta Pill */}
      {currentTrack && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#14141B]/80 border border-[#272733] backdrop-blur-md text-xs shrink-0 z-20">
          <div className="flex items-center gap-3">
            {currentTrack.artworkDataUrl && (
              <img
                src={currentTrack.artworkDataUrl}
                alt=""
                className="w-10 h-10 rounded-lg object-cover border border-[#272733]"
              />
            )}
            <div>
              <span className="font-bold text-[#F5F3FF] text-sm block truncate max-w-md">
                {currentTrack.title}
              </span>
              <span className="text-[#A1A1AA] font-medium">{currentTrack.artist}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono-numbers px-2.5 py-1 rounded-full bg-[#1B1B24] text-[var(--accent-dynamic)] border border-[#272733]">
              {currentTrack.codec} • {currentTrack.sampleRate} Hz
            </span>
            <button
              onClick={() => setActiveView('equalizer')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1B1B24] hover:bg-[#252535] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
            >
              <Sliders size={13} className="text-[var(--accent-dynamic)]" />
              <span>Equalizer Studio</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
