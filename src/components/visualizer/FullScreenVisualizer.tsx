import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { windowLifecycleService } from '../../services/windowLifecycleService';
import { visualizerSettingsService } from '../../services/visualizerSettingsService';
import { VisualizerThemeId, VISUALIZER_THEMES } from '../../types/visualizer';
import { usePlayer } from '../../context/PlayerContext';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  BarChart3,
  Waves,
  Disc3,
  Minimize2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface FullScreenVisualizerProps {
  onClose: () => void;
}

export const FullScreenVisualizer: React.FC<FullScreenVisualizerProps> = ({ onClose }) => {
  const {
    currentTrack,
    isPlaying,
    togglePlayPause,
    nextTrack,
    prevTrack,
    currentTime,
    duration,
    seekTo,
    volume,
    setVolume,
    isMuted,
    toggleMute,
  } = usePlayer();

  const [settings, setSettings] = useState(visualizerSettingsService.getVisualizerSettings());
  const [showHud, setShowHud] = useState(true);
  const [showControlsDrawer, setShowControlsDrawer] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Peak and physics caches
  const peaksRef = useRef<number[]>([]);
  const peakDecayRef = useRef<number[]>([]);
  const particlesRef = useRef<
    { x: number; y: number; z: number; vx: number; vy: number; vz: number; radius: number; alpha: number }[]
  >([]);
  const ringsRef = useRef<
    { radius: number; maxRadius: number; alpha: number; color: string; lineWidth: number }[]
  >([]);
  const lastTransientTime = useRef<number>(0);

  // Listen to visualizer settings changes
  useEffect(() => {
    return visualizerSettingsService.subscribe(() => {
      setSettings(visualizerSettingsService.getVisualizerSettings());
    });
  }, []);

  // Keyboard controls: Escape to exit, Space to play/pause, Left/Right to seek
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'ArrowRight') {
        seekTo(Math.min(duration, currentTime + 5));
      } else if (e.key === 'ArrowLeft') {
        seekTo(Math.max(0, currentTime - 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, togglePlayPause, seekTo, currentTime, duration]);

  // Autohide HUD after 3s of mouse inactivity
  const handleMouseMove = useCallback(() => {
    setShowHud(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => {
      setShowHud(false);
    }, 3500);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    };
  }, [handleMouseMove]);

  // Canvas visualizer render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const binCount = audioEngine.getFrequencyBinCount();
    const freqData = new Uint8Array(binCount);
    const timeData = new Uint8Array(audioEngine.getFftSize());

    const barCount = 72;
    if (peaksRef.current.length !== barCount) {
      peaksRef.current = new Array(barCount).fill(0);
      peakDecayRef.current = new Array(barCount).fill(0);
    }

    // Init 3D starfield particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 120; i++) {
        particlesRef.current.push({
          x: (Math.random() - 0.5) * 800,
          y: (Math.random() - 0.5) * 600,
          z: Math.random() * 1000 + 100,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          vz: -2 - Math.random() * 4,
          radius: 1.5 + Math.random() * 2.5,
          alpha: 0.8,
        });
      }
    }

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      if (windowLifecycleService.isRenderingSuspended()) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, height);

      if (isPlaying) {
        audioEngine.getFrequencyData(freqData);
        audioEngine.getTimeDomainData(timeData);
      } else {
        freqData.fill(0);
        timeData.fill(128);
      }

      const { theme, sensitivity, intensity } = settings;

      // Extract dynamic colors or fallback to obsidian violet
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-dynamic').trim() || '#A78BFA';
      const secondary = '#38BDF8';

      // 1. MINIMAL BARS
      if (theme === 'minimal-bars') {
        const gap = 4;
        const totalGap = (barCount - 1) * gap;
        const barWidth = Math.max(3, (width - totalGap) / barCount);

        for (let i = 0; i < barCount; i++) {
          const lo = Math.floor(Math.pow(binCount, i / barCount));
          const hi = Math.max(lo + 1, Math.floor(Math.pow(binCount, (i + 1) / barCount)));
          let val = 0;
          for (let b = lo; b < hi && b < binCount; b++) val = Math.max(val, freqData[b]);

          const percent = Math.min(1, (val / 255) * sensitivity);
          const barHeight = Math.max(4, percent * height * 0.75 * intensity);

          // Peak hold
          if (barHeight >= peaksRef.current[i]) {
            peaksRef.current[i] = barHeight;
            peakDecayRef.current[i] = 0;
          } else {
            peakDecayRef.current[i] += 0.4;
            peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakDecayRef.current[i]);
          }

          const x = i * (barWidth + gap);
          const y = height - barHeight;

          // Minimal clean bar
          ctx.fillStyle = `rgba(167, 139, 250, ${0.4 + percent * 0.6})`;
          ctx.fillRect(x, y, barWidth, barHeight);

          // Peak line
          const peakY = height - peaksRef.current[i] - 2;
          ctx.fillStyle = '#F5F3FF';
          ctx.fillRect(x, peakY, barWidth, 2);
        }
      }

      // 2. NEON SPECTRUM (Gradients, reflections, glow)
      else if (theme === 'neon-spectrum') {
        const gap = 4;
        const barWidth = Math.max(4, (width - (barCount - 1) * gap) / barCount);
        const baseline = height * 0.7;

        for (let i = 0; i < barCount; i++) {
          const binIndex = Math.floor(Math.pow(binCount, i / barCount));
          const val = freqData[binIndex] || 0;
          const percent = Math.min(1.2, (val / 255) * sensitivity);
          const barHeight = percent * (baseline * 0.85) * intensity;

          const x = i * (barWidth + gap);
          const y = baseline - barHeight;

          // Main neon bar
          const grad = ctx.createLinearGradient(0, baseline, 0, y);
          grad.addColorStop(0, '#4C1D95');
          grad.addColorStop(0.5, accent);
          grad.addColorStop(1, '#38BDF8');

          ctx.fillStyle = grad;
          ctx.shadowColor = accent;
          ctx.shadowBlur = Math.min(25, 12 * intensity);
          ctx.fillRect(x, y, barWidth, barHeight);
          ctx.shadowBlur = 0;

          // Mirrored Reflection below baseline
          const reflHeight = barHeight * 0.35;
          const reflGrad = ctx.createLinearGradient(0, baseline, 0, baseline + reflHeight);
          reflGrad.addColorStop(0, 'rgba(167, 139, 250, 0.35)');
          reflGrad.addColorStop(1, 'rgba(167, 139, 250, 0)');
          ctx.fillStyle = reflGrad;
          ctx.fillRect(x, baseline + 3, barWidth, reflHeight);
        }
      }

      // 3. CIRCULAR SPECTRUM (360° Radial)
      else if (theme === 'circular-spectrum') {
        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(cx, cy) * 0.38;
        const bars = 96;

        ctx.save();
        ctx.translate(cx, cy);

        // Center pulse circle
        let bassSum = 0;
        for (let b = 0; b < 10; b++) bassSum += freqData[b];
        const bassAvg = (bassSum / 10 / 255) * sensitivity;
        const currentInnerRadius = radius + bassAvg * 20 * intensity;

        ctx.beginPath();
        ctx.arc(0, 0, currentInnerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 3;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Radial bars
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2;
          const binIdx = Math.floor((i / bars) * (binCount / 2));
          const val = freqData[binIdx] || 0;
          const barLen = Math.max(4, (val / 255) * sensitivity * 140 * intensity);

          const x1 = Math.cos(angle) * currentInnerRadius;
          const y1 = Math.sin(angle) * currentInnerRadius;
          const x2 = Math.cos(angle) * (currentInnerRadius + barLen);
          const y2 = Math.sin(angle) * (currentInnerRadius + barLen);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = i % 2 === 0 ? accent : secondary;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 4. WAVEFORM (Oscilloscope)
      else if (theme === 'waveform') {
        const sliceWidth = width / timeData.length;
        ctx.lineWidth = 3;
        ctx.strokeStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 16 * intensity;
        ctx.beginPath();

        let x = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          const y = height / 2 + v * (height * 0.4) * sensitivity * intensity;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 5. PARTICLE FIELD (3D Space Warp)
      else if (theme === 'particle-field') {
        const cx = width / 2;
        const cy = height / 2;

        let bassSum = 0;
        for (let b = 0; b < 12; b++) bassSum += freqData[b];
        const bassVal = (bassSum / 12 / 255) * sensitivity;

        for (const p of particlesRef.current) {
          p.z += p.vz * (1 + bassVal * 2.5);
          if (p.z <= 10) {
            p.z = 1000;
            p.x = (Math.random() - 0.5) * 800;
            p.y = (Math.random() - 0.5) * 600;
          }

          const scale = 500 / p.z;
          const screenX = cx + p.x * scale;
          const screenY = cy + p.y * scale;
          const r = Math.max(1, p.radius * scale * (1 + bassVal * 1.5));

          ctx.beginPath();
          ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167, 139, 250, ${Math.min(1, scale * intensity)})`;
          ctx.fill();
        }
      }

      // 6. RETRO EQUALIZER (Segmented Green/Amber/Red LEDs)
      else if (theme === 'retro-equalizer') {
        const bands = 36;
        const totalSegments = 28;
        const gapX = 6;
        const gapY = 3;
        const colWidth = (width - (bands - 1) * gapX) / bands;
        const segHeight = Math.max(4, (height * 0.7) / totalSegments);
        const startY = height * 0.85;

        for (let i = 0; i < bands; i++) {
          const binIdx = Math.floor(Math.pow(binCount, i / bands));
          const val = freqData[binIdx] || 0;
          const activeSegments = Math.round(((val / 255) * sensitivity * totalSegments * intensity));

          for (let s = 0; s < totalSegments; s++) {
            const y = startY - s * (segHeight + gapY);
            const x = i * (colWidth + gapX);

            let color = '#22C55E'; // Green
            if (s > totalSegments * 0.65) color = '#EAB308'; // Amber
            if (s > totalSegments * 0.85) color = '#EF4444'; // Red

            const isActive = s <= activeSegments;
            ctx.fillStyle = isActive ? color : 'rgba(39, 39, 51, 0.4)';
            ctx.fillRect(x, y, colWidth, segHeight);
          }
        }
      }

      // 7. AMBIENT WAVES (Layered undulating ribbons)
      else if (theme === 'ambient-waves') {
        const time = Date.now() * 0.002;
        const layers = 4;

        let energy = 0;
        for (let b = 0; b < 32; b++) energy += freqData[b];
        energy = (energy / 32 / 255) * sensitivity;

        for (let l = 0; l < layers; l++) {
          const grad = ctx.createLinearGradient(0, 0, width, height);
          grad.addColorStop(0, `rgba(167, 139, 250, ${0.15 * intensity})`);
          grad.addColorStop(1, `rgba(56, 189, 248, ${0.2 * intensity})`);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, height);

          for (let x = 0; x <= width; x += 15) {
            const freq = 0.004 + l * 0.002;
            const wave =
              Math.sin(x * freq + time + l) *
              Math.cos(x * 0.002 - time * 0.5) *
              (60 + energy * 120 * intensity);
            const y = height * 0.55 + l * 40 + wave;
            ctx.lineTo(x, y);
          }

          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();
        }
      }

      // 8. FREQUENCY RINGS (Concentric transient shockwaves)
      else if (theme === 'frequency-rings') {
        const cx = width / 2;
        const cy = height / 2;

        let bassSum = 0;
        for (let b = 0; b < 8; b++) bassSum += freqData[b];
        const bass = (bassSum / 8 / 255) * sensitivity;

        // Detect kick/transient
        const now = Date.now();
        if (bass > 0.65 && now - lastTransientTime.current > 180) {
          lastTransientTime.current = now;
          ringsRef.current.push({
            radius: 20,
            maxRadius: Math.max(width, height) * 0.7,
            alpha: 1.0,
            color: ringsRef.current.length % 2 === 0 ? accent : secondary,
            lineWidth: 3 + bass * 4,
          });
        }

        // Draw and expand rings
        for (let i = ringsRef.current.length - 1; i >= 0; i--) {
          const ring = ringsRef.current[i];
          ring.radius += 6 * (1 + bass * 1.5);
          ring.alpha = Math.max(0, 1 - ring.radius / ring.maxRadius);

          ctx.beginPath();
          ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = ring.lineWidth;
          ctx.globalAlpha = ring.alpha * intensity;
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          if (ring.radius >= ring.maxRadius || ring.alpha <= 0) {
            ringsRef.current.splice(i, 1);
          }
        }

        // Center glowing orb
        ctx.beginPath();
        ctx.arc(cx, cy, 30 + bass * 30 * intensity, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.shadowColor = accent;
        ctx.shadowBlur = 25 * intensity;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      if (isPlaying && !windowLifecycleService.isRenderingSuspended()) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    const startRender = () => {
      if (!isRunning) return;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      render();
    };

    startRender();

    const unsubLifecycle = windowLifecycleService.subscribeSuspension((suspended) => {
      if (!suspended && isPlaying) {
        startRender();
      } else if (suspended && animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    });

    return () => {
      isRunning = false;
      unsubLifecycle();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [settings, isPlaying]);

  const handleSelectTheme = (id: VisualizerThemeId) => {
    visualizerSettingsService.updateVisualizerSettings({ theme: id });
  };

  const handleSensitivityChange = (val: number) => {
    visualizerSettingsService.updateVisualizerSettings({ sensitivity: val });
  };

  const handleIntensityChange = (val: number) => {
    visualizerSettingsService.updateVisualizerSettings({ intensity: val });
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#09090B] text-[#F5F3FF] flex flex-col justify-between overflow-hidden select-none">
      {/* Fullscreen Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block cursor-none" />

      {/* Top HUD: Theme Switcher & Settings */}
      <div
        className={`relative z-20 px-8 py-5 flex items-center justify-between transition-opacity duration-300 ${
          showHud ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Theme Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto bg-[#14141B]/80 border border-[#272733] backdrop-blur-md rounded-2xl p-1.5 custom-scrollbar">
          {VISUALIZER_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelectTheme(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                settings.theme === t.id
                  ? 'bg-[#A78BFA] text-[#09090B] shadow-md shadow-violet-950/40'
                  : 'text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1B1B24]'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Quick controls: Sensitivity / Intensity drawer toggle & Exit button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowControlsDrawer((prev) => !prev)}
            className="p-2.5 rounded-xl bg-[#14141B]/80 hover:bg-[#1B1B24] border border-[#272733] backdrop-blur-md text-[#A1A1AA] hover:text-[#F5F3FF] transition"
            title="Visualizer Settings"
          >
            <Sliders size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-[#14141B]/80 hover:bg-red-950/40 border border-[#272733] backdrop-blur-md text-[#A1A1AA] hover:text-red-400 transition"
            title="Exit Fullscreen (Escape)"
          >
            <Minimize2 size={18} />
          </button>
        </div>
      </div>

      {/* Settings Drawer Panel */}
      {showControlsDrawer && (
        <div className="absolute top-20 right-8 z-30 w-72 bg-[#14141B]/95 border border-[#272733] backdrop-blur-xl rounded-2xl p-5 shadow-2xl space-y-4 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#272733]">
            <span className="font-bold text-[#F5F3FF]">Visualizer Tuning</span>
            <button onClick={() => setShowControlsDrawer(false)} className="text-[#71717A] hover:text-[#F5F3FF]">
              <X size={16} />
            </button>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[#A1A1AA]">Audio Sensitivity</span>
              <span className="font-mono text-[#A78BFA]">{settings.sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={settings.sensitivity}
              onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
              className="w-full accent-violet-400 h-1 bg-[#272733] rounded-lg cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-[#A1A1AA]">Bloom Intensity</span>
              <span className="font-mono text-[#A78BFA]">{settings.intensity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={settings.intensity}
              onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
              className="w-full accent-violet-400 h-1 bg-[#272733] rounded-lg cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Bottom HUD: Transport & Track Meta */}
      <div
        className={`relative z-20 px-8 py-5 transition-opacity duration-300 ${
          showHud ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto p-4 bg-[#14141B]/80 border border-[#272733] backdrop-blur-md rounded-2xl flex flex-col gap-3 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0">
              {currentTrack?.artworkDataUrl && (
                <img
                  src={currentTrack.artworkDataUrl}
                  alt={currentTrack.title}
                  className="w-12 h-12 rounded-xl object-cover border border-[#272733] shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#F5F3FF] truncate">
                  {currentTrack?.title || 'Harmoniq Audio Engine'}
                </p>
                <p className="text-xs text-[#A1A1AA] truncate mt-0.5">
                  {currentTrack?.artist || 'Idle'} {currentTrack?.album ? `• ${currentTrack.album}` : ''}
                </p>
              </div>
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={prevTrack}
                className="p-2 text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1B1B24] rounded-xl transition"
                title="Previous Track"
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={togglePlayPause}
                className="p-3 bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#09090B] rounded-full transition shadow-md"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              </button>
              <button
                onClick={nextTrack}
                className="p-2 text-[#A1A1AA] hover:text-[#F5F3FF] hover:bg-[#1B1B24] rounded-xl transition"
                title="Next Track"
              >
                <SkipForward size={18} />
              </button>
            </div>

            {/* Volume control */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={toggleMute} className="text-[#71717A] hover:text-[#F5F3FF]">
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20 accent-violet-400 h-1 bg-[#272733] rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Seek progress bar */}
          <div className="flex items-center gap-3 text-xs font-mono text-[#71717A]">
            <span>{formatSeconds(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              className="flex-1 accent-violet-400 h-1 bg-[#272733] rounded-lg cursor-pointer"
            />
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
