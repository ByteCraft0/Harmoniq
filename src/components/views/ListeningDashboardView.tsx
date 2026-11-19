import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { useDSP } from '../../context/DSPContext';
import { useToast } from '../../context/ToastContext';
import {
  personalIntelligenceService,
  IntelligenceTimeRange,
  PersonalListeningProfile,
} from '../../services/audio/personalIntelligenceService';
import {
  intelligentDiscoveryService,
  PersonalizedDiscoveryBundle,
} from '../../services/audio/intelligentDiscoveryService';
import {
  soundRecommendationService,
  SoundRecommendation,
} from '../../services/audio/soundRecommendationService';
import {
  deviceIntelligenceService,
  DeviceIntelligenceReport,
} from '../../services/audio/deviceIntelligenceService';
import {
  trackAudioIntelligenceService,
  TrackOptimizationReport,
} from '../../services/audio/trackAudioIntelligenceService';
import { sessionTrackingService, ListeningSession } from '../../services/sessionTrackingService';
import { TrackMetadata } from '../../types/audio';
import {
  BarChart3,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
  Headphones,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Download,
  Trash2,
  Calendar,
  Layers,
  Compass,
  CheckCircle2,
  Radio,
  Flame,
  Volume2,
} from 'lucide-react';

export const ListeningDashboardView: React.FC = () => {
  const { currentTrack, playTrack, outputDevices, currentDeviceId } = usePlayer();
  const { settings: dspSettings } = useDSP();
  const { showToast } = useToast();

  const [timeRange, setTimeRange] = useState<IntelligenceTimeRange>('30d');
  const [profile, setProfile] = useState<PersonalListeningProfile>(() =>
    personalIntelligenceService.getListeningProfile('30d')
  );
  const [discovery, setDiscovery] = useState<PersonalizedDiscoveryBundle>(() =>
    intelligentDiscoveryService.generatePersonalizedDiscovery()
  );
  const [sessions, setSessions] = useState<ListeningSession[]>(() =>
    sessionTrackingService.getSessionHistory()
  );

  const activeDevice = useMemo(() => {
    return outputDevices.find((d) => d.deviceId === currentDeviceId) || {
      deviceId: currentDeviceId || 'default',
      label: 'Default Output Device',
      groupId: '',
      kind: 'audiooutput' as MediaDeviceKind,
    };
  }, [outputDevices, currentDeviceId]);

  const deviceReport: DeviceIntelligenceReport = useMemo(() => {
    return deviceIntelligenceService.classifyDevice(activeDevice);
  }, [activeDevice]);

  const soundRec: SoundRecommendation | null = useMemo(() => {
    return soundRecommendationService.getRecommendationForContext(currentTrack, activeDevice.label);
  }, [currentTrack, activeDevice.label]);

  const trackOptReport: TrackOptimizationReport | null = useMemo(() => {
    if (!currentTrack) return null;
    return trackAudioIntelligenceService.analyzeTrack(currentTrack, dspSettings);
  }, [currentTrack, dspSettings]);

  const refreshData = useCallback(() => {
    setProfile(personalIntelligenceService.getListeningProfile(timeRange));
    setDiscovery(intelligentDiscoveryService.generatePersonalizedDiscovery());
    setSessions(sessionTrackingService.getSessionHistory());
  }, [timeRange]);

  useEffect(() => {
    refreshData();
    const unsubIntel = personalIntelligenceService.subscribe(refreshData);
    const unsubSessions = sessionTrackingService.subscribe(refreshData);
    return () => {
      unsubIntel();
      unsubSessions();
    };
  }, [refreshData]);

  const formatHours = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const handleAudition = (rec: SoundRecommendation) => {
    soundRecommendationService.auditionRecommendation(rec, dspSettings);
    showToast(`Auditioning "${rec.title}" profile`, 'info');
  };

  const handleApply = (rec: SoundRecommendation) => {
    soundRecommendationService.applyRecommendation(rec);
    showToast(`Applied "${rec.title}" profile`, 'success');
  };

  const handleExportJson = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      timeRange,
      profile,
      sessions,
      deviceReport,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harmoniq_listening_intelligence_${timeRange}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Intelligence telemetry exported', 'success');
  };

  const handleClearData = () => {
    if (window.confirm('Reset all listening intelligence history and session records?')) {
      personalIntelligenceService.resetIntelligenceData();
      refreshData();
      showToast('Intelligence data reset', 'info');
    }
  };

  const handleReplaySession = (session: ListeningSession) => {
    const tracks = sessionTrackingService.replaySession(session.id);
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
      showToast(`Replaying session (${tracks.length} tracks)`, 'info');
    }
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-6 max-w-6xl mx-auto space-y-8 select-none">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#272733]">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-[#A78BFA]" />
            <h1 className="text-xl font-black text-[#F5F3FF]">Personal Listening Intelligence</h1>
          </div>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Adaptive acoustic insights, listening telemetry, and device calibration.
          </p>
        </div>

        {/* Time Filter & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#14141B] p-1 rounded-xl border border-[#272733] text-xs font-semibold">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                timeRange === '7d'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                timeRange === '30d'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                timeRange === 'all'
                  ? 'bg-[var(--accent-dynamic)] text-white shadow-sm'
                  : 'text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={handleExportJson}
            title="Export Telemetry JSON"
            className="p-2 rounded-xl bg-[#14141B] hover:bg-[#1B1B24] border border-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] transition-colors"
          >
            <Download size={15} />
          </button>
          <button
            onClick={handleClearData}
            title="Clear Listening Data"
            className="p-2 rounded-xl bg-[#14141B] hover:bg-rose-950/40 border border-[#272733] hover:border-rose-800 text-[#71717A] hover:text-rose-400 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* 1. OVERVIEW SECTION */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={13} />
          <span>1. Overview Metrics</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] text-[#71717A] block font-medium">Total Listening Time</span>
            <span className="text-2xl font-black text-[#F5F3FF] mt-1 block">
              {formatHours(profile.totalListeningSeconds)}
            </span>
            <span className="text-[10px] text-emerald-400 font-mono-numbers mt-1 block">
              ~{profile.weeklyListeningHours} hrs weekly pace
            </span>
          </div>

          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] text-[#71717A] block font-medium">Plays Tracked</span>
            <span className="text-2xl font-black text-[#F5F3FF] mt-1 block font-mono-numbers">
              {profile.totalPlays.toLocaleString()}
            </span>
            <span className="text-[10px] text-[#A1A1AA] mt-1 block">
              {profile.completedPlays} completed plays
            </span>
          </div>

          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] text-[#71717A] block font-medium">Completion Rate</span>
            <span className="text-2xl font-black text-emerald-400 mt-1 block font-mono-numbers">
              {profile.completionRate}%
            </span>
            <span className="text-[10px] text-rose-400 mt-1 block font-mono-numbers">
              {profile.skipRate}% skip rate
            </span>
          </div>

          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] text-[#71717A] block font-medium">Prime Listening Time</span>
            <span className="text-2xl font-black text-[#A78BFA] mt-1 block">
              {profile.preferredListeningWindow}
            </span>
            <span className="text-[10px] text-[#A1A1AA] mt-1 block">
              Peak musical engagement
            </span>
          </div>
        </div>
      </section>

      {/* 2. LISTENING TRENDS */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 size={13} />
          <span>2. Listening Trends & Time Patterns</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Time of Day Distribution */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#F5F3FF]">Daily Time Distribution</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Morning (06:00 – 12:00)', count: profile.timeOfDayDistribution.morning },
                { label: 'Afternoon (12:00 – 17:00)', count: profile.timeOfDayDistribution.afternoon },
                { label: 'Evening (17:00 – 22:00)', count: profile.timeOfDayDistribution.evening },
                { label: 'Late Night (22:00 – 06:00)', count: profile.timeOfDayDistribution.night },
              ].map((slot) => {
                const total = Math.max(1, profile.totalPlays);
                const pct = Math.round((slot.count / total) * 100);
                return (
                  <div key={slot.label} className="space-y-1">
                    <div className="flex justify-between text-xs text-[#A1A1AA]">
                      <span>{slot.label}</span>
                      <span className="font-mono-numbers">{slot.count} plays ({pct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-[#1B1B24] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--accent-dynamic)] to-[#A78BFA] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Genres Breakdown */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-[#F5F3FF]">Top Genres & Completion</h3>
            {profile.topGenres.length === 0 ? (
              <p className="text-xs text-[#71717A] py-8 text-center">No genre data recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {profile.topGenres.slice(0, 4).map((g) => (
                  <div key={g.genre} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-[#F5F3FF]">{g.genre}</span>
                      <span className="text-[11px] text-[#A1A1AA] font-mono-numbers">
                        {formatHours(g.durationSeconds)} • {g.completionRate}% complete
                      </span>
                    </div>
                    <div className="h-2 w-full bg-[#1B1B24] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${g.completionRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. DISCOVERY INSIGHTS */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
          <Compass size={13} />
          <span>3. Discovery Insights & Recommendations</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Forgotten Favorites */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F3FF] flex items-center gap-2">
                <Flame size={14} className="text-amber-400" />
                <span>Forgotten Favorites</span>
              </h3>
              <span className="text-[10px] text-[#71717A]">Played &gt; 30d ago</span>
            </div>
            {discovery.forgottenFavorites.length === 0 ? (
              <p className="text-xs text-[#71717A] py-6 text-center">
                All favorite tracks are in active rotation!
              </p>
            ) : (
              <div className="space-y-2">
                {discovery.forgottenFavorites.slice(0, 3).map((item) => (
                  <div
                    key={item.track.id}
                    onClick={() => playTrack(item.track)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1B1B24]/60 hover:bg-[#252532] cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-[#F5F3FF] truncate">{item.track.title}</p>
                      <p className="text-[11px] text-[#A1A1AA] truncate">{item.track.artist}</p>
                    </div>
                    <Play size={14} className="text-[#A78BFA] shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fresh Artists */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#F5F3FF] flex items-center gap-2">
                <Sparkles size={14} className="text-[#A78BFA]" />
                <span>Fresh Artists in Your Genres</span>
              </h3>
              <span className="text-[10px] text-[#71717A]">Unexplored</span>
            </div>
            {discovery.freshArtists.length === 0 ? (
              <p className="text-xs text-[#71717A] py-6 text-center">
                Explore your collection or add new artists.
              </p>
            ) : (
              <div className="space-y-2">
                {discovery.freshArtists.slice(0, 3).map((item) => (
                  <div
                    key={item.track.id}
                    onClick={() => playTrack(item.track)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1B1B24]/60 hover:bg-[#252532] cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-[#F5F3FF] truncate">{item.track.title}</p>
                      <p className="text-[11px] text-[#A1A1AA] truncate">{item.track.artist} ({item.track.genre})</p>
                    </div>
                    <Play size={14} className="text-[#A78BFA] shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. PLAYBACK INSIGHTS & RECENT SESSIONS */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
          <Layers size={13} />
          <span>4. Playback Insights & Continuous Sessions</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top Artists with Affinity */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#F5F3FF]">Top Artists by Affinity Score</h3>
            {profile.topArtists.length === 0 ? (
              <p className="text-xs text-[#71717A] py-6 text-center">No listening affinity calculated.</p>
            ) : (
              <div className="space-y-2">
                {profile.topArtists.slice(0, 4).map((art, i) => (
                  <div key={art.name} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[#71717A] font-mono-numbers w-4">{i + 1}.</span>
                      <span className="font-bold text-[#F5F3FF] truncate">{art.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[#A78BFA] font-bold font-mono-numbers">{art.affinityScore} pts</span>
                      <span className="text-[#71717A] block text-[10px] font-mono-numbers">{formatHours(art.durationSeconds)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Continuous Sessions */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#F5F3FF]">Recent Listening Sessions</h3>
            {sessions.length === 0 ? (
              <p className="text-xs text-[#71717A] py-6 text-center">No completed sessions logged yet.</p>
            ) : (
              <div className="space-y-2">
                {sessions.slice(0, 3).map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#1B1B24]/60 border border-[#272733] text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#F5F3FF]">
                        {sess.totalTracksCount} tracks • {formatHours(sess.durationSeconds)}
                      </p>
                      <p className="text-[10px] text-[#A1A1AA]">
                        {new Date(sess.startedAt).toLocaleDateString()} at{' '}
                        {new Date(sess.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={() => handleReplaySession(sess)}
                      title="Replay Session into Queue"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 text-white font-bold text-[11px] transition-all"
                    >
                      <RotateCcw size={11} />
                      <span>Replay</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. AUDIO CONFIGURATION INSIGHTS */}
      <section className="space-y-3">
        <h2 className="text-xs font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-1.5">
          <Sliders size={13} />
          <span>5. Audio Configuration & Acoustic Optimization</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Active Audio Device Intelligence */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Headphones size={15} className="text-[#A78BFA]" />
              <h3 className="text-sm font-bold text-[#F5F3FF]">Device Acoustic Target</h3>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-2 py-0.5 rounded-full inline-block">
                {deviceReport.category.replace('_', ' ')}
              </span>
              <p className="text-xs font-bold text-[#F5F3FF] mt-2 truncate">{deviceReport.deviceLabel}</p>
              <p className="text-[11px] text-[#A1A1AA] mt-1">{deviceReport.explanation}</p>
            </div>
          </div>

          {/* Adaptive Sound Recommendation */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sliders size={15} className="text-[var(--accent-dynamic)]" />
              <h3 className="text-sm font-bold text-[#F5F3FF]">Adaptive Recommendation</h3>
            </div>
            {soundRec ? (
              <div className="space-y-2">
                <p className="text-xs font-bold text-[#A78BFA]">{soundRec.title}</p>
                <p className="text-[11px] text-[#A1A1AA] leading-relaxed">{soundRec.rationale}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleAudition(soundRec)}
                    className="px-2.5 py-1 rounded-lg bg-[#1B1B24] hover:bg-[#252532] border border-[#272733] text-[11px] font-bold text-[#F5F3FF] transition-all"
                  >
                    Audition
                  </button>
                  <button
                    onClick={() => handleApply(soundRec)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--accent-dynamic)] hover:opacity-90 text-[11px] font-bold text-white transition-all"
                  >
                    Apply Profile
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#71717A] py-4">No active recommendation.</p>
            )}
          </div>

          {/* Smart Headroom & Clipping Risk */}
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-emerald-400" />
              <h3 className="text-sm font-bold text-[#F5F3FF]">Smart Headroom & Clarity</h3>
            </div>
            {trackOptReport ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1AA]">Clipping Risk:</span>
                  {trackOptReport.clippingRisk ? (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle size={12} /> High Risk
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 size={12} /> Zero Clipping
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#A1A1AA]">Dynamic Range:</span>
                  <span className="text-[#F5F3FF] font-mono-numbers">{trackOptReport.dynamicRangeDb} dB</span>
                </div>
                <p className="text-[11px] text-[#A1A1AA] pt-1 leading-relaxed">
                  {trackOptReport.reasoning}
                </p>
              </div>
            ) : (
              <p className="text-xs text-[#71717A] py-4">Start playback to analyze signal headroom.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
