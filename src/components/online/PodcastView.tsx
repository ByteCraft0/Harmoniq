import React, { useState, useEffect } from 'react';
import { podcastService, CURATED_PODCASTS } from '../../services/podcastService';
import { PodcastFeed, PodcastEpisode } from '../../types/online';
import {
  Podcast,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Loader2,
  AlertCircle,
  X,
  ExternalLink,
  ChevronLeft,
} from 'lucide-react';

export const PodcastView: React.FC = () => {
  const [feeds, setFeeds] = useState<PodcastFeed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<PodcastFeed | null>(null);
  const [playbackState, setPlaybackState] = useState(podcastService.getPlaybackState());
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFeeds(podcastService.getFeeds());
    const unsub = podcastService.subscribe(() => {
      setFeeds(podcastService.getFeeds());
      setPlaybackState(podcastService.getPlaybackState());
    });
    return unsub;
  }, []);

  const handleSubscribe = async (urlToSub: string) => {
    if (!urlToSub.trim()) return;
    setIsSubscribing(true);
    setError(null);
    try {
      const feed = await podcastService.subscribeToFeed(urlToSub);
      setFeedUrl('');
      setShowSubscribeModal(false);
      setSelectedFeed(feed);
    } catch (err: any) {
      setError(err.message || 'Failed to parse or fetch podcast RSS feed');
    } finally {
      setIsSubscribing(false);
    }
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const activeEpisode = playbackState.activeEpisode;
  const isPlayingThisEpisode = (ep: PodcastEpisode) =>
    activeEpisode?.id === ep.id && playbackState.isPlaying;

  return (
    <div className="h-full overflow-y-auto px-8 py-8 space-y-8 max-w-7xl mx-auto select-none custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {selectedFeed && (
            <button
              onClick={() => setSelectedFeed(null)}
              className="p-2 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] rounded-xl transition mr-1"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Podcast size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#F5F3FF]">
              {selectedFeed ? selectedFeed.title : 'Podcasts'}
            </h1>
            <p className="text-xs text-[#A1A1AA] mt-0.5">
              {selectedFeed
                ? `${selectedFeed.author} • ${selectedFeed.episodes.length} episodes`
                : 'RSS & Atom podcast player with resume position and progress tracking'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowSubscribeModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-[#F5F3FF] text-xs font-semibold rounded-xl shadow-md transition shrink-0"
        >
          <Plus size={16} />
          <span>Subscribe via RSS</span>
        </button>
      </div>

      {/* Podcast Player Bar (When an episode is active) */}
      {activeEpisode && (
        <div className="p-4 bg-[#14141B] border border-indigo-500/30 rounded-2xl flex flex-col gap-3 shadow-xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 w-full md:w-auto">
              <div className="w-12 h-12 rounded-xl bg-[#1B1B24] border border-[#272733] flex items-center justify-center shrink-0 overflow-hidden text-indigo-400">
                <Podcast size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#F5F3FF] truncate">{activeEpisode.title}</p>
                <p className="text-xs text-[#A1A1AA] truncate mt-0.5">{activeEpisode.podcastId}</p>
              </div>
            </div>

            {/* Playback Transport */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => podcastService.seek(playbackState.currentTime - 15)}
                className="p-2 hover:bg-[#272733] rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] transition"
                title="Rewind 15 seconds"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => podcastService.togglePlayPause()}
                className="p-3 bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#09090B] rounded-full transition shadow-md"
              >
                {playbackState.isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              </button>
              <button
                onClick={() => podcastService.seek(playbackState.currentTime + 15)}
                className="p-2 hover:bg-[#272733] rounded-lg text-[#A1A1AA] hover:text-[#F5F3FF] transition"
                title="Forward 15 seconds"
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>

          {/* Seek progress */}
          <div className="flex items-center gap-3 text-xs font-mono text-[#71717A]">
            <span>{formatSeconds(playbackState.currentTime)}</span>
            <input
              type="range"
              min="0"
              max={playbackState.duration || 100}
              value={playbackState.currentTime}
              onChange={(e) => podcastService.seek(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-400 h-1 bg-[#272733] rounded-lg cursor-pointer"
            />
            <span>{formatSeconds(playbackState.duration)}</span>
          </div>
        </div>
      )}

      {/* Main View: Either Selected Podcast Episodes or Subscribed Podcasts Grid */}
      {selectedFeed ? (
        <div className="space-y-6">
          {/* Feed Bio Header */}
          <div className="p-6 bg-[#14141B] border border-[#272733] rounded-2xl flex flex-col md:flex-row gap-6">
            <div className="w-28 h-28 rounded-xl bg-[#1B1B24] border border-[#272733] overflow-hidden shrink-0 flex items-center justify-center">
              {selectedFeed.artworkUrl ? (
                <img src={selectedFeed.artworkUrl} alt={selectedFeed.title} className="w-full h-full object-cover" />
              ) : (
                <Podcast size={40} className="text-[#71717A]" />
              )}
            </div>
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#F5F3FF]">{selectedFeed.title}</h2>
                <p className="text-xs font-semibold text-[#A78BFA] mt-1">{selectedFeed.author}</p>
                <p className="text-xs text-[#A1A1AA] mt-2 leading-relaxed">{selectedFeed.description}</p>
              </div>

              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#272733]">
                <button
                  onClick={() => {
                    if (confirm(`Unsubscribe from ${selectedFeed.title}?`)) {
                      podcastService.unsubscribe(selectedFeed.id);
                      setSelectedFeed(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-950/30 border border-red-900/30 transition"
                >
                  <Trash2 size={14} />
                  <span>Unsubscribe</span>
                </button>
              </div>
            </div>
          </div>

          {/* Episode List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#F5F3FF]">Episodes ({selectedFeed.episodes.length})</h3>
            <div className="space-y-2">
              {selectedFeed.episodes.map((ep) => {
                const isPlaying = isPlayingThisEpisode(ep);
                return (
                  <div
                    key={ep.id}
                    className={`p-4 bg-[#14141B] border rounded-xl flex items-start justify-between gap-4 transition group ${
                      isPlaying ? 'border-indigo-500/50 shadow-md shadow-indigo-950/20' : 'border-[#272733] hover:border-[#38BDF8]/40'
                    }`}
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <button
                        onClick={() => podcastService.toggleListened(ep.id)}
                        className={`mt-1 p-0.5 rounded transition ${
                          ep.isListened ? 'text-emerald-400' : 'text-[#71717A] hover:text-[#A1A1AA]'
                        }`}
                        title={ep.isListened ? 'Marked as listened' : 'Mark as listened'}
                      >
                        {ep.isListened ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                      </button>

                      <div className="min-w-0 space-y-1">
                        <h4 className="text-sm font-semibold text-[#F5F3FF]">{ep.title}</h4>
                        <p className="text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed">{ep.description}</p>
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-[#71717A]">
                          {ep.publishedAt && (
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {ep.publishedAt}
                            </span>
                          )}
                          {ep.durationSeconds > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatSeconds(ep.durationSeconds)}
                            </span>
                          )}
                          {ep.resumePosition > 0 && !ep.isListened && (
                            <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 text-[10px] font-mono border border-indigo-800">
                              Resume at {formatSeconds(ep.resumePosition)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isPlaying) {
                            podcastService.togglePlayPause();
                          } else {
                            podcastService.playEpisode(ep);
                          }
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          isPlaying
                            ? 'bg-indigo-600 text-[#F5F3FF]'
                            : 'bg-[#1B1B24] text-[#F5F3FF] hover:bg-[#272733]'
                        }`}
                      >
                        {isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                        <span>{isPlaying ? 'Pause' : ep.resumePosition > 0 ? 'Resume' : 'Play'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Subscribed Shows */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#F5F3FF]">My Subscriptions ({feeds.length})</h2>
            {feeds.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {feeds.map((feed) => (
                  <div
                    key={feed.id}
                    onClick={() => setSelectedFeed(feed)}
                    className="p-4 bg-[#14141B] border border-[#272733] hover:border-violet-500/40 rounded-2xl cursor-pointer transition group"
                  >
                    <div className="w-full aspect-square rounded-xl bg-[#1B1B24] border border-[#272733] overflow-hidden mb-3 flex items-center justify-center">
                      {feed.artworkUrl ? (
                        <img
                          src={feed.artworkUrl}
                          alt={feed.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <Podcast size={36} className="text-[#71717A]" />
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[#F5F3FF] truncate">{feed.title}</h3>
                    <p className="text-xs text-[#A1A1AA] truncate mt-0.5">{feed.author}</p>
                    <p className="text-[11px] text-[#71717A] mt-2 font-mono">
                      {feed.episodes.length} episodes
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-[#71717A] text-xs space-y-2 bg-[#14141B]/40 rounded-2xl border border-dashed border-[#272733]">
                <Podcast size={32} className="mx-auto text-[#272733]" />
                <p>No subscriptions yet. Subscribe to your favorite shows below or via RSS URL.</p>
              </div>
            )}
          </div>

          {/* Curated Recommendations */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#F5F3FF]">Featured Podcasts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CURATED_PODCASTS.map((rec) => {
                const isSubbed = feeds.some((f) => f.feedUrl.toLowerCase() === rec.feedUrl?.toLowerCase());
                return (
                  <div
                    key={rec.id}
                    className="p-4 bg-[#14141B] border border-[#272733] hover:border-[#38BDF8]/40 rounded-2xl flex flex-col justify-between transition group"
                  >
                    <div>
                      <div className="w-full aspect-video rounded-xl bg-[#1B1B24] border border-[#272733] overflow-hidden mb-3 flex items-center justify-center">
                        {rec.artworkUrl ? (
                          <img src={rec.artworkUrl} alt={rec.title} className="w-full h-full object-cover" />
                        ) : (
                          <Podcast size={32} className="text-[#71717A]" />
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#F5F3FF] truncate">{rec.title}</h3>
                      <p className="text-xs font-medium text-[#A78BFA] mt-0.5">{rec.author}</p>
                      <p className="text-xs text-[#A1A1AA] line-clamp-2 mt-2 leading-relaxed">
                        {rec.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#272733] flex items-center justify-between">
                      {isSubbed ? (
                        <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={14} /> Subscribed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSubscribe(rec.feedUrl!)}
                          disabled={isSubscribing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1B1B24] hover:bg-[#272733] text-[#F5F3FF] transition"
                        >
                          <Plus size={14} />
                          <span>Subscribe</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Subscribe Modal */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#F5F3FF]">Subscribe to Podcast Feed</h2>
              <button
                onClick={() => {
                  setShowSubscribeModal(false);
                  setError(null);
                }}
                className="p-1 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF]"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[#A1A1AA] mb-1 font-medium">RSS / Atom Feed URL *</label>
                <input
                  type="url"
                  required
                  value={feedUrl}
                  onChange={(e) => setFeedUrl(e.target.value)}
                  placeholder="https://example.com/podcast.xml"
                  className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-lg px-3 py-2.5 outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#272733]">
                <button
                  type="button"
                  onClick={() => setShowSubscribeModal(false)}
                  className="px-4 py-2 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubscribe(feedUrl)}
                  disabled={isSubscribing || !feedUrl.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] disabled:opacity-50 text-[#09090B] rounded-lg font-bold transition shadow-sm"
                >
                  {isSubscribing && <Loader2 size={14} className="animate-spin" />}
                  <span>Subscribe</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
