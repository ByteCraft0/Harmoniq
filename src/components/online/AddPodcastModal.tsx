import React, { useState } from 'react';
import {
  Podcast,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  FileAudio,
  Radio,
  ExternalLink,
  Sparkles,
  Check,
  Globe,
  Info,
} from 'lucide-react';
import { podcastResolver } from '../../services/podcastResolver';
import { podcastService } from '../../services/podcastService';
import {
  PodcastUrlType,
  ResolvedPodcastPreview,
  ResolverProgressState,
} from '../../types/podcastResolver';
import { PodcastFeed } from '../../types/online';

interface AddPodcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribed: (feed: PodcastFeed) => void;
}

export const AddPodcastModal: React.FC<AddPodcastModalProps> = ({
  isOpen,
  onClose,
  onSubscribed,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [progress, setProgress] = useState<ResolverProgressState | null>(null);
  const [preview, setPreview] = useState<ResolvedPodcastPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  if (!isOpen) return null;

  const existingFeeds = podcastService.getFeeds();

  const handleFindPodcast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = urlInput.trim();
    if (!clean) {
      setError('Please enter a podcast website, Apple Podcasts, Spotify, or RSS link.');
      return;
    }

    setError(null);
    setPreview(null);
    setIsResolving(true);
    setProgress({
      currentStep: 'normalize',
      message: 'Analyzing URL and identifying source platform...',
      percent: 25,
    });

    try {
      const res = await podcastResolver.resolve(clean, (p) => {
        setProgress(p);
      });

      setIsResolving(false);
      if (res.success) {
        setPreview(res);
      } else {
        setError(res.error || 'Failed to resolve podcast. Please check the URL and try again.');
      }
    } catch (err: any) {
      setIsResolving(false);
      setError(err?.message || 'An error occurred during podcast discovery.');
    }
  };

  const isAlreadySubscribed = preview?.resolvedFeedUrl
    ? existingFeeds.some(
        (f) =>
          f.feedUrl.toLowerCase() === preview.resolvedFeedUrl?.toLowerCase() ||
          f.title.toLowerCase() === preview.title.toLowerCase()
      )
    : false;

  const handleSubscribe = async () => {
    if (!preview || !preview.resolvedFeedUrl) return;

    setIsSubscribing(true);
    setError(null);

    try {
      const feed = await podcastService.subscribeToFeed(preview.resolvedFeedUrl);
      setIsSubscribing(false);
      onSubscribed(feed);
      onClose();
    } catch (err: any) {
      setIsSubscribing(false);
      setError(err?.message || 'Failed to save podcast subscription.');
    }
  };

  const getPlatformBadge = (type: PodcastUrlType) => {
    switch (type) {
      case 'apple_podcasts':
        return { label: 'Apple Podcasts', color: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-700/50' };
      case 'spotify_show':
        return { label: 'Spotify Show', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' };
      case 'direct_rss':
        return { label: 'Direct RSS Feed', color: 'bg-amber-950/60 text-amber-300 border-amber-700/50' };
      case 'website':
        return { label: 'Podcast Website', color: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50' };
      case 'search_query':
        return { label: 'Directory Search', color: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50' };
      default:
        return { label: 'Open Feed', color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-podcast-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-[#0b0813]/95 border border-violet-500/30 rounded-2xl w-full max-w-xl p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(139,92,246,0.18)] overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-violet-500/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-600/20 border border-violet-500/30 rounded-xl text-violet-300">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 id="smart-podcast-title" className="text-base font-bold text-white tracking-wide">
                Smart Podcast URL Importer
              </h2>
              <p className="text-[11px] text-zinc-400">
                Paste any podcast website, Spotify, Apple Podcasts or RSS feed URL.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl text-zinc-400 hover:text-white transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-3.5 bg-rose-950/60 border border-rose-500/30 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold block mb-0.5">Could not import podcast</span>
              {error}
            </div>
          </div>
        )}

        {/* Warning / Notice */}
        {preview?.warning && (
          <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-indigo-200 text-xs flex items-center gap-2">
            <Info size={16} className="shrink-0 text-indigo-400" />
            <span>{preview.warning}</span>
          </div>
        )}

        {/* Step 1: Input & Discovery Form */}
        {!preview ? (
          <form onSubmit={handleFindPodcast} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300">
                Podcast Link or Website
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isResolving}
                  placeholder="Paste a podcast website, Spotify, Apple Podcasts or RSS link..."
                  className="w-full bg-[#130f24] border border-violet-500/25 focus:border-violet-400 text-xs text-white placeholder-zinc-500 rounded-xl px-4 py-3 outline-none transition"
                  autoFocus
                />
              </div>

              {/* Supported Platforms Hints */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-zinc-400">
                <span className="text-zinc-500">Supports:</span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-zinc-300">
                  Apple Podcasts
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-zinc-300">
                  Spotify Shows
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-zinc-300">
                  Direct RSS / Atom
                </span>
                <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/5 text-zinc-300">
                  Podcast Websites
                </span>
              </div>
            </div>

            {/* Animated Progress Bar when resolving */}
            {isResolving && progress && (
              <div className="p-4 bg-violet-950/30 border border-violet-500/20 rounded-xl space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-violet-200 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-violet-400" />
                    {progress.message}
                  </span>
                  <span className="font-mono text-violet-400 text-[11px]">{progress.percent}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bottom Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-violet-500/15">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isResolving || !urlInput.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95"
              >
                {isResolving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Resolving Podcast...</span>
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    <span>Find Podcast</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Discovered Podcast Preview & Confirmation Card */
          <div className="space-y-4">
            <div className="p-4 bg-[#130f24] border border-violet-500/30 rounded-xl space-y-3.5">
              <div className="flex gap-4">
                {/* Artwork */}
                <div className="w-24 h-24 rounded-xl bg-[#090710] border border-violet-500/20 overflow-hidden shrink-0 flex items-center justify-center relative shadow-md">
                  <Podcast size={32} className="text-zinc-600 absolute" />
                  {preview.artworkUrl && (
                    <img
                      src={preview.artworkUrl}
                      alt={preview.title}
                      className="w-full h-full object-cover relative z-10"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>

                {/* Show Details */}
                <div className="min-w-0 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {(() => {
                        const badge = getPlatformBadge(preview.urlType);
                        return (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-violet-950/60 text-violet-300 border border-violet-800/40">
                        {preview.episodeCount} episodes
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white truncate">{preview.title}</h3>
                    <p className="text-xs text-violet-300 font-medium truncate mt-0.5">
                      {preview.author}
                    </p>
                  </div>

                  {preview.resolvedFeedUrl && (
                    <div className="text-[10px] text-zinc-500 font-mono truncate max-w-sm mt-1">
                      Feed: {preview.resolvedFeedUrl}
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              {preview.description && (
                <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed border-t border-violet-500/15 pt-2.5">
                  {preview.description}
                </p>
              )}

              {/* Latest Episode Preview */}
              {preview.latestEpisodeTitle && (
                <div className="p-2.5 bg-black/30 rounded-lg border border-white/5 flex items-center gap-2 text-xs">
                  <FileAudio size={14} className="text-violet-400 shrink-0" />
                  <div className="min-w-0 flex-1 truncate text-[11px]">
                    <span className="text-zinc-400">Latest: </span>
                    <span className="text-zinc-100 font-medium">{preview.latestEpisodeTitle}</span>
                  </div>
                  {preview.latestEpisodeDate && (
                    <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                      {preview.latestEpisodeDate}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Already Subscribed Badge */}
            {isAlreadySubscribed && (
              <div className="p-3 bg-emerald-950/50 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  You are already subscribed to this podcast.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-violet-500/15">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-semibold transition"
              >
                Back to Search
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={isSubscribing || isAlreadySubscribed}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-md active:scale-95"
                >
                  {isSubscribing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Subscribing...</span>
                    </>
                  ) : isAlreadySubscribed ? (
                    <>
                      <Check size={14} />
                      <span>Subscribed</span>
                    </>
                  ) : (
                    <>
                      <Podcast size={14} />
                      <span>Subscribe to Podcast</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
