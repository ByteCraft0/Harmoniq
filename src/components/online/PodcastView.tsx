import React, { useState, useEffect } from 'react';
import { podcastService, CURATED_PODCASTS } from '../../services/podcastService';
import { PodcastFeed, PodcastEpisode } from '../../types/online';
import { HarmoniqEmptyState } from '../brand/HarmoniqEmptyState';
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
  Check,
  Radio,
  FileAudio,
} from 'lucide-react';

export const PodcastView: React.FC = () => {
  const [feeds, setFeeds] = useState<PodcastFeed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<PodcastFeed | null>(null);
  const [playbackState, setPlaybackState] = useState(podcastService.getPlaybackState());
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewFeed, setPreviewFeed] = useState<PodcastFeed | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [curatedSubscribingId, setCuratedSubscribingId] = useState<string | null>(null);

  useEffect(() => {
    setFeeds(podcastService.getFeeds());
    const unsub = podcastService.subscribe(() => {
      setFeeds(podcastService.getFeeds());
      setPlaybackState(podcastService.getPlaybackState());
    });
    return unsub;
  }, []);

  // Open modal with guaranteed clean state
  const handleOpenSubscribeModal = () => {
    setFeedUrl('');
    setError(null);
    setValidationWarning(null);
    setPreviewFeed(null);
    setIsFetchingPreview(false);
    setShowSubscribeModal(true);
  };

  // Close modal and reset
  const handleCloseSubscribeModal = () => {
    setShowSubscribeModal(false);
    setFeedUrl('');
    setError(null);
    setValidationWarning(null);
    setPreviewFeed(null);
    setIsFetchingPreview(false);
  };

  // 10-Step Workflow: Step 1-6 Preview Feed
  const handlePreviewFeed = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanUrl = feedUrl.trim();

    // Step 1-3: Strict validation before network attempt
    if (!cleanUrl) {
      setValidationWarning('Please enter a valid podcast RSS or Atom feed URL.');
      return;
    }

    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setValidationWarning('Please enter a valid podcast RSS or Atom feed URL starting with http:// or https://');
        return;
      }
    } catch {
      setValidationWarning('Please enter a valid podcast RSS or Atom feed URL.');
      return;
    }

    setValidationWarning(null);
    setError(null);
    setIsFetchingPreview(true);

    try {
      // Step 4-6: Fetch & parse feed
      const preview = await podcastService.previewFeed(cleanUrl);
      setPreviewFeed(preview);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch or parse podcast feed.');
    } finally {
      setIsFetchingPreview(false);
    }
  };

  // 10-Step Workflow: Step 8-10 Confirm Subscription
  const handleConfirmSubscribe = () => {
    if (!previewFeed) return;
    try {
      const saved = podcastService.saveSubscription(previewFeed);
      handleCloseSubscribeModal();
      setSelectedFeed(saved);
    } catch (err: any) {
      setError(err.message || 'Failed to save podcast subscription.');
    }
  };

  // Curated 1-click subscription
  const handleCuratedSubscribe = async (rec: Partial<PodcastFeed>) => {
    if (!rec.feedUrl) return;
    setCuratedSubscribingId(rec.id || rec.feedUrl);
    try {
      const feed = await podcastService.subscribeToFeed(rec.feedUrl);
      setSelectedFeed(feed);
    } catch (err: any) {
      alert(`Could not subscribe to ${rec.title}: ${err.message}`);
    } finally {
      setCuratedSubscribingId(null);
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
          onClick={handleOpenSubscribeModal}
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
            <div className="w-28 h-28 rounded-xl bg-[#1B1B24] border border-[#272733] overflow-hidden shrink-0 flex items-center justify-center relative">
              <Podcast size={36} className="text-[#71717A] absolute" />
              {selectedFeed.artworkUrl && (
                <img
                  src={selectedFeed.artworkUrl}
                  alt={selectedFeed.title}
                  className="w-full h-full object-cover relative z-10"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
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
                    <div className="w-full aspect-square rounded-xl bg-[#1B1B24] border border-[#272733] overflow-hidden mb-3 flex items-center justify-center relative">
                      <Podcast size={36} className="text-[#71717A] absolute" />
                      {feed.artworkUrl && (
                        <img
                          src={feed.artworkUrl}
                          alt={feed.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300 relative z-10"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
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
              <div className="py-10">
                <HarmoniqEmptyState
                  type="empty_search"
                  title="No Podcast Subscriptions"
                  description="Subscribe to featured podcast shows below or enter an RSS feed URL to stream audio episodes."
                  action={{
                    label: 'Add RSS Feed',
                    onClick: () => setShowSubscribeModal(true),
                  }}
                />
              </div>
            )}
          </div>

          {/* Curated Recommendations */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#F5F3FF]">Featured Podcasts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CURATED_PODCASTS.map((rec) => {
                const isSubbed = feeds.some((f) => f.feedUrl.toLowerCase() === rec.feedUrl?.toLowerCase());
                const isBusy = curatedSubscribingId === (rec.id || rec.feedUrl);
                return (
                  <div
                    key={rec.id}
                    className="p-4 bg-[#14141B] border border-[#272733] hover:border-[#38BDF8]/40 rounded-2xl flex flex-col justify-between transition group"
                  >
                    <div>
                      <div className="w-full aspect-video rounded-xl bg-[#1B1B24] border border-[#272733] overflow-hidden mb-3 flex items-center justify-center relative">
                        <Podcast size={32} className="text-[#71717A] absolute" />
                        {rec.artworkUrl && (
                          <img
                            src={rec.artworkUrl}
                            alt={rec.title}
                            className="w-full h-full object-cover relative z-10"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
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
                          onClick={() => handleCuratedSubscribe(rec)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1B1B24] hover:bg-[#272733] text-[#F5F3FF] transition"
                        >
                          {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                          <span>{isBusy ? 'Subscribing...' : 'Subscribe'}</span>
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

      {/* Subscribe Modal with 10-Step Workflow & Preview Card */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14141B] border border-[#272733] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Podcast size={18} className="text-indigo-400" />
                <h2 className="text-base font-bold text-[#F5F3FF]">
                  {previewFeed ? 'Confirm Podcast Subscription' : 'Subscribe via RSS / Atom'}
                </h2>
              </div>
              <button
                onClick={handleCloseSubscribeModal}
                className="p-1 hover:bg-[#272733] rounded-lg text-[#71717A] hover:text-[#F5F3FF] transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Validation / Format Warning (Step 1-3) */}
            {validationWarning && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{validationWarning}</span>
              </div>
            )}

            {/* Network / Parsing Error */}
            {error && (
              <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!previewFeed ? (
              /* Step 1-6: Enter Feed URL & Fetch Preview */
              <form onSubmit={handlePreviewFeed} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#A1A1AA] mb-1 font-medium">
                    Podcast RSS / Atom Feed URL *
                  </label>
                  <input
                    type="url"
                    value={feedUrl}
                    onChange={(e) => {
                      setFeedUrl(e.target.value);
                      if (validationWarning) setValidationWarning(null);
                      if (error) setError(null);
                    }}
                    placeholder="https://feeds.npr.org/510289/podcast.xml"
                    className="w-full bg-[#1B1B24] border border-[#272733] focus:border-[#A78BFA] text-sm text-[#F5F3FF] rounded-xl px-3.5 py-2.5 outline-none font-mono"
                    autoFocus
                  />
                  <p className="text-[11px] text-[#71717A] mt-1.5">
                    Supports RSS 2.0 with iTunes enclosures and Atom feeds. Feed is fetched safely without CORS restrictions.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#272733]">
                  <button
                    type="button"
                    onClick={handleCloseSubscribeModal}
                    className="px-4 py-2 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] rounded-xl font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isFetchingPreview}
                    className="flex items-center gap-2 px-5 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] disabled:opacity-50 text-[#09090B] rounded-xl font-bold transition shadow-sm"
                  >
                    {isFetchingPreview && <Loader2 size={14} className="animate-spin" />}
                    <span>{isFetchingPreview ? 'Fetching Feed...' : 'Preview Feed'}</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Step 7-10: Feed Preview Card & Confirm Subscription */
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-[#1B1B24] border border-indigo-500/30 rounded-xl space-y-3">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-lg bg-[#14141B] border border-[#272733] overflow-hidden shrink-0 flex items-center justify-center relative">
                      <Podcast size={28} className="text-[#71717A] absolute" />
                      {previewFeed.artworkUrl && (
                        <img
                          src={previewFeed.artworkUrl}
                          alt={previewFeed.title}
                          className="w-full h-full object-cover relative z-10"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-[#F5F3FF] truncate">{previewFeed.title}</h3>
                      <p className="text-xs text-[#A78BFA] font-medium truncate mt-0.5">{previewFeed.author}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                          {previewFeed.episodes.length} episodes found
                        </span>
                      </div>
                    </div>
                  </div>

                  {previewFeed.description && (
                    <p className="text-xs text-[#A1A1AA] line-clamp-3 leading-relaxed border-t border-[#272733] pt-2">
                      {previewFeed.description}
                    </p>
                  )}

                  {previewFeed.episodes.length > 0 && (
                    <div className="p-2.5 bg-[#14141B] rounded-lg border border-[#272733] flex items-center gap-2">
                      <FileAudio size={14} className="text-indigo-400 shrink-0" />
                      <div className="min-w-0 text-[11px] truncate">
                        <span className="text-[#71717A]">Latest episode: </span>
                        <span className="text-[#F5F3FF] font-medium">{previewFeed.episodes[0].title}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#272733]">
                  <button
                    type="button"
                    onClick={() => setPreviewFeed(null)}
                    className="px-4 py-2 bg-[#1B1B24] hover:bg-[#272733] text-[#A1A1AA] hover:text-[#F5F3FF] rounded-xl font-medium transition"
                  >
                    Back to URL
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSubscribe}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-[#F5F3FF] rounded-xl font-bold transition shadow-md"
                  >
                    <Check size={14} />
                    <span>Confirm Subscription</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
