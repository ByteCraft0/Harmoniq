import { AppView } from '../context/LibraryContext';
import { AssistantAction, KnowledgeDocument } from '../types/assistant';

export const HARMONIQ_KNOWLEDGE_BASE: KnowledgeDocument[] = [
  {
    id: 'equalizer_studio',
    title: 'Equalizer Studio & Audio Presets',
    category: 'audio',
    keywords: ['equalizer', 'eq', 'bass', 'treble', 'preset', 'frequency', 'sound', 'bands', 'preamp', 'quality'],
    summary: 'Harmoniq features a professional 10-band graphic equalizer with pre-amp gain control (-12dB to +12dB), real-time audio shaping, and 16+ genre-tailored audio presets.',
    steps: [
      'Click Equalizer Studio in the sidebar navigation or player bar.',
      'Toggle the EQ Enabled switch to activate equalizer processing.',
      'Select a preset (e.g. Bass Boost, Acoustic, Vocal, Electronic, Flat, or Rock) or adjust individual frequency sliders (31Hz to 16kHz).',
      'Use the Pre-amp slider to prevent digital clipping when boosting multiple bands.',
      'Click Save Preset to store your custom curve for future listening sessions.'
    ],
    tips: [
      'Cutting frequencies is generally cleaner than boosting to preserve dynamic range.',
      'If audio distorts, lower the pre-amp gain slider.'
    ],
    route: 'equalizer',
    actionLabel: 'Open Equalizer Studio'
  },
  {
    id: 'audio_inspector',
    title: 'Audio Quality Inspector & Bit-Perfect Mode',
    category: 'audio',
    keywords: ['bit-perfect', 'wasapi', 'dac', 'sample rate', 'bit depth', 'hi-res', 'flac', 'lossless', 'inspector', 'diagnostics'],
    summary: 'The Audio Inspector displays comprehensive technical telemetry: exact format (FLAC, ALAC, WAV, MP3, AAC), bit depth (16/24/32-bit), sample rate (44.1kHz to 192kHz), bitrate, channel layout, and WASAPI exclusive capability.',
    steps: [
      'Navigate to Audio Quality Inspector in the sidebar or from the playback bar badge.',
      'Inspect the Active Stream badge showing live playback sample rate and bit depth.',
      'Check the WASAPI Exclusive capability indicator to see if your Windows DAC supports bit-perfect hardware bypass.',
      'Review ReplayGain metadata (Track Gain, Album Gain, Peak ratios) embedded in the current file.'
    ],
    tips: [
      'Hi-Res Lossless files (24-bit/96kHz or 192kHz) sound best through a dedicated external DAC.',
      'Bit-perfect playback bypasses the Windows audio mixer for pristine acoustic fidelity.'
    ],
    route: 'inspector',
    actionLabel: 'Open Audio Inspector'
  },
  {
    id: 'abx_comparison',
    title: 'ABX Audio Comparison Tool',
    category: 'audio',
    keywords: ['abx', 'blind test', 'audio test', 'comparison', 'codec test', 'mp3 vs flac', 'golden ears'],
    summary: 'Harmoniq includes a scientific double-blind ABX listening comparator to test if you can audibly distinguish between two audio files (e.g., Lossless FLAC vs 320kbps MP3).',
    steps: [
      'Open the ABX Audio Comparison tool from the sidebar.',
      'Select Audio Track A (Reference) and Track B (Comparison target).',
      'Harmoniq aligns playback position seamlessly between both tracks.',
      'Listen to Track A and Track B, then switch to the blinded Track X.',
      'Vote whether X is Track A or Track B, and record 5 to 20 trials.',
      'View your statistical score (p-value, correct identification percentage) to test real audible differences.'
    ],
    tips: [
      'Use neutral studio monitor headphones and a quiet room for ABX trials.',
      'Levels are automatically volume-matched to prevent loudness bias.'
    ],
    route: 'abx',
    actionLabel: 'Open ABX Comparator'
  },
  {
    id: 'waveform_navigation',
    title: 'Waveform Navigation & Volume Profiles',
    category: 'audio',
    keywords: ['waveform', 'seek', 'scrub', 'timeline', 'volume', 'night mode', 'loudness', 'replaygain'],
    summary: 'Harmoniq renders visual waveforms for tracks allowing precision timeline seeking, track section previews, and adaptive volume leveling.',
    steps: [
      'Look at the bottom player transport bar during playback.',
      'Hover over the audio timeline to view interactive waveform amplitude peaks.',
      'Click or drag across the waveform to jump instantly to verses, drops, or bridges.',
      'Configure ReplayGain and Nighttime Dynamic Compression in Settings -> Audio Output.'
    ],
    tips: [
      'Waveforms are cached locally for lightning-fast subsequent loads.',
      'Nighttime mode compresses dynamic range to prevent loud explosions while keeping quiet dialogues intelligible.'
    ],
    route: 'audio_output',
    actionLabel: 'Open Audio Settings'
  },
  {
    id: 'audio_output_routing',
    title: 'Audio Device Routing & Speaker Layout',
    category: 'audio',
    keywords: ['device', 'output', 'headphones', 'speakers', 'audio output', 'channels', 'stereo', 'surround'],
    summary: 'Select and route audio output directly to specific Windows sound devices, headphones, DACs, or surround sound configurations (Stereo, 5.1, 7.1).',
    steps: [
      'Open Audio Output from the sidebar or click the speaker icon in the bottom player.',
      'Browse detected Windows playback devices (Headphones, External DAC, HDMI/DisplayPort, Virtual Cables).',
      'Select your preferred primary playback device.',
      'Test audio output channel routing and verify stereo balance.'
    ],
    tips: [
      'Changing output devices switches active streams instantly without stopping music playback.'
    ],
    route: 'audio_output',
    actionLabel: 'Open Audio Output'
  },
  {
    id: 'playlists_and_folders',
    title: 'Playlists, Folders & History',
    category: 'library',
    keywords: ['playlist', 'create playlist', 'folder', 'organize', 'm3u', 'import playlist', 'export', 'playlist history'],
    summary: 'Create custom playlists, organize them hierarchically into playlist folders, import/export M3U files, and roll back changes using Playlist History snapshots.',
    steps: [
      'Open the Playlists section in the sidebar.',
      'Click "New Playlist" or "New Folder" in the top action bar.',
      'Drag and drop playlists into folders to categorize by mood, genre, or decade.',
      'To add songs, right-click any track in your library or click the "..." menu and choose "Add to Playlist".',
      'Use the Playlist History tab to restore previous playlist states if you accidentally remove tracks.'
    ],
    tips: [
      'You can export your playlists as standard M3U/M3U8 files for use in car stereos or portable players.'
    ],
    route: 'playlists',
    actionLabel: 'Open Playlists'
  },
  {
    id: 'saved_queues',
    title: 'Queue Management & Multiple Saved Queues',
    category: 'library',
    keywords: ['queue', 'play next', 'up next', 'saved queues', 'study queue', 'workout queue', 'reorder'],
    summary: 'Manage your active playback queue, enqueue songs via Play Next, and save multiple independent queue profiles (e.g. Study, Night Drive, Workout, Relaxation, Weekend).',
    steps: [
      'Click the Queue button (list icon) in the bottom player bar.',
      'View your currently enqueued tracks and drag to reorder.',
      'Right-click any track to select "Play Next" (inserts at top of queue) or "Add to Queue".',
      'Open the "Saved Queues" tab to save the current queue state under a custom name.',
      'Switch between saved queue sessions anytime without losing track order.'
    ],
    tips: [
      'If Harmoniq closes unexpectedly, queue crash recovery automatically restores your enqueued tracks on next startup.'
    ],
    route: 'now_playing',
    actionLabel: 'Open Queue'
  },
  {
    id: 'listening_calendar',
    title: 'Listening Calendar & Milestones',
    category: 'library',
    keywords: ['calendar', 'listening history', 'heatmap', 'stats', 'daily listening', 'milestones', 'minutes played'],
    summary: 'The Listening Calendar visualizes your genuine daily listening history with an activity heatmap, daily listening duration, track counts, most-played tracks, and milestones.',
    steps: [
      'Open Listening Calendar from the sidebar navigation.',
      'Browse the monthly calendar grid with color-coded listening intensity heatmaps.',
      'Click any specific date to view the exact tracks, artists, and timestamps played on that day.',
      'Check your Monthly Summary for total hours listened, top genres, and milestone badges.'
    ],
    tips: [
      'Listening data is generated exclusively from actual local playback—never fabricated.'
    ],
    route: 'calendar',
    actionLabel: 'Open Listening Calendar'
  },
  {
    id: 'listening_stats',
    title: 'Listening Statistics & Insights',
    category: 'library',
    keywords: ['stats', 'statistics', 'charts', 'top tracks', 'top artists', 'insights', 'analytics'],
    summary: 'Explore detailed listening analytics: top played tracks, favorite artists, genre distributions, and all-time listening time.',
    steps: [
      'Click Listening Stats in the sidebar.',
      'Switch between 7 Days, 30 Days, 6 Months, or All Time views.',
      'View interactive bar charts and pie charts of your favorite musical genres.',
      'Click on any top artist or album to open its detail page.'
    ],
    tips: [
      'Export listening stats summary as text or report directly from the stats toolbar.'
    ],
    route: 'stats',
    actionLabel: 'Open Listening Stats'
  },
  {
    id: 'lyrics_studio',
    title: 'Lyrics Studio & Synchronized Lyrics (LRC)',
    category: 'ui',
    keywords: ['lyrics', 'lrc', 'karaoke', 'sync lyrics', 'timestamps', 'lyrics editor', 'words'],
    summary: 'Harmoniq supports synchronized line-by-line scrolling lyrics (.lrc), embedded tag lyrics, and an interactive timestamp editor to align words with the beat.',
    steps: [
      'Click Lyrics in the sidebar or the microphone/quote icon in the bottom player.',
      'If an .lrc file exists with the same filename as your track, it loads automatically.',
      'To adjust timing, use the +0.5s / -0.5s timestamp offset controls.',
      'Switch to the Lyrics Editor tab to edit lyrics text or import external LRC files.'
    ],
    tips: [
      'Harmoniq auto-scrolls lyrics so the currently sung line is always centered in high-contrast lavender glow.'
    ],
    route: 'lyrics',
    actionLabel: 'Open Lyrics Studio'
  },
  {
    id: 'immersive_album',
    title: 'Immersive Album Experience',
    category: 'ui',
    keywords: ['immersive', 'album art', 'fullscreen', 'ambient', 'visual experience', 'cinema'],
    summary: 'Full-screen cinematic album experience with animated ambient color gradients, high-resolution artwork, tracklist overlay, and synchronized lyrics display.',
    steps: [
      'Navigate to Albums or Now Playing and click the "Immersive Album" button, or select it from the sidebar.',
      'Enjoy ambient fluid backdrop lighting matching the primary colors of the current album cover.',
      'Use keyboard arrow keys (Left/Right) to navigate tracks.',
      'Press Esc or click the top-right exit button to return to standard view.'
    ],
    tips: [
      'Looks breathtaking on multi-monitor setups and 4K displays.'
    ],
    route: 'immersive_album',
    actionLabel: 'Open Immersive Album Mode'
  },
  {
    id: 'vinyl_collection',
    title: 'Vinyl Collection Mode',
    category: 'ui',
    keywords: ['vinyl', 'record', 'crate', '3d', 'turntable', 'spinning vinyl', 'liner notes'],
    summary: 'Virtual record collector crate showcasing your local music albums as physical vinyl gatefolds with 3D rotating record animations during playback.',
    steps: [
      'Open Vinyl Collection from the sidebar navigation.',
      'Browse your albums arranged like a real vinyl collector shelf with realistic sleeve reflections.',
      'Click any album to slide the vinyl disc out from its jacket.',
      'Press Play to watch the vinyl record spin on the turntable with authentic groove visuals.'
    ],
    tips: [
      'Vinyl rotation animation automatically syncs with play/pause state.'
    ],
    route: 'vinyl_collection',
    actionLabel: 'Open Vinyl Collection'
  },
  {
    id: 'audio_visualizer',
    title: 'Real-Time Audio Visualizer',
    category: 'ui',
    keywords: ['visualizer', 'spectrum', 'bars', 'frequency', 'waveform', 'audio visualizer'],
    summary: 'Hardware-accelerated audio spectrum visualizer rendering real-time FFT frequency bars, fluid waves, circular oscilloscope, and particle fields.',
    steps: [
      'Click Visualizer in the sidebar navigation.',
      'Choose your preferred visualizer mode (Frequency Bars, Circular Ring, Oscilloscope, or Fluid Ribbon).',
      'Adjust sensitivity, bar density, and color palette presets.',
      'Toggle fullscreen mode (F11) for music parties or ambient background displays.'
    ],
    tips: [
      'Built with HTML5 Canvas / WebGL for silky-smooth 60fps rendering without audio latency.'
    ],
    route: 'visualizer',
    actionLabel: 'Open Visualizer'
  },
  {
    id: 'online_music_search',
    title: 'Online Music Search & Streaming',
    category: 'online',
    keywords: ['online music', 'search music', 'stream', 'itunes preview', 'archive.org', 'discover songs'],
    summary: 'Search and stream millions of tracks, high-quality 30s previews from the Open Music Catalog, and public domain recordings from Archive.org.',
    steps: [
      'Click Online Music in the sidebar.',
      'Enter an artist name, song title, or album in the search bar.',
      'Filter results by All, Tracks, or Albums.',
      'Click Play on any result to stream audio instantly.',
      'Click "+ Add to Library" or "Add to Playlist" to save online tracks to your collection.'
    ],
    tips: [
      'Preview streams are official AAC/MP3 audio streams from verified public music registries.'
    ],
    route: 'online_music',
    actionLabel: 'Open Online Music'
  },
  {
    id: 'internet_radio',
    title: 'Internet Radio Stations',
    category: 'online',
    keywords: ['radio', 'internet radio', 'live stream', 'station', 'fm', 'shoutcast', 'icecast'],
    summary: 'Tune in to thousands of live worldwide internet radio stations categorized by genre, country, and bitrate, with automatic stream health checking.',
    steps: [
      'Open Internet Radio from the sidebar.',
      'Browse stations by genre (Ambient, Jazz, Rock, Lo-Fi, Electronic, Classical).',
      'Click any station card to tune in and start streaming live broadcast audio.',
      'Click "Add Custom Station" to paste any Shoutcast/Icecast MP3/AAC stream URL.'
    ],
    tips: [
      'Harmoniq tests stream health in the background to ensure you only hear live, buffering-free streams.'
    ],
    route: 'radio',
    actionLabel: 'Open Internet Radio'
  },
  {
    id: 'podcasts',
    title: 'Podcasts & RSS Subscriptions',
    category: 'online',
    keywords: ['podcast', 'rss', 'episodes', 'subscribe', 'talk', 'shows', 'playback speed'],
    summary: 'Subscribe to RSS podcast feeds, stream episodes, skip silences, adjust playback speed (0.5x to 2.5x), and resume from your exact last position.',
    steps: [
      'Open Podcasts from the sidebar navigation.',
      'Click "Subscribe to Podcast" and enter any valid RSS podcast feed URL.',
      'Browse episode lists, read episode show notes, and click Play.',
      'Use the 15-second skip backward / 30-second skip forward buttons for quick navigation.'
    ],
    tips: [
      'Podcast episode playback positions are automatically remembered between app sessions.'
    ],
    route: 'podcasts',
    actionLabel: 'Open Podcasts'
  },
  {
    id: 'theme_studio',
    title: 'Theme Studio & Obsidian Visual Identity',
    category: 'ui',
    keywords: ['theme', 'appearance', 'colors', 'dark mode', 'accent color', 'violet', 'lavender', 'obsidian', 'glassmorphism'],
    summary: 'Customize Harmoniq’s visual identity with custom accent colors, dark obsidian backgrounds, ambient glow effects, glassmorphism blur, and dynamic album artwork color extraction.',
    steps: [
      'Open Settings -> Theme Studio.',
      'Select a theme preset (Signature Obsidian Violet, Neon Lavender, Cyber Indigo, Midnight OLED, Warm Sunset).',
      'Toggle "Dynamic Album Art Accents" to automatically tint the application with the vibrant colors of the current song.',
      'Adjust background blur and ambient lighting intensity.'
    ],
    tips: [
      'High contrast mode is available for bright environments and enhanced readability.'
    ],
    route: 'settings',
    actionLabel: 'Open Theme Studio'
  },
  {
    id: 'mini_player_desktop',
    title: 'Floating Desktop Mini-Player & Widgets',
    category: 'system',
    keywords: ['mini player', 'widget', 'floating player', 'always on top', 'compact', 'desktop widget'],
    summary: 'A sleek, compact, always-on-top floating desktop player that lets you control music, view album art, and seek tracks while working in other apps.',
    steps: [
      'Click the Mini-Player icon in the top window title bar or bottom player bar (or press Ctrl+M).',
      'The window shrinks into a compact floating card.',
      'Drag it anywhere on your desktop; position is saved automatically.',
      'Toggle between Compact (transport only) and Expanded (artwork + timeline) layouts.',
      'Click the pin icon to toggle Always-on-Top, or adjust opacity slider for subtle transparency.',
      'Click the expand icon or press Ctrl+M to return to full Harmoniq window.'
    ],
    tips: [
      'Hover over the mini-player waveform to scrub and seek without leaving your work.'
    ],
    route: 'home',
    actionLabel: 'View Home'
  },
  {
    id: 'hotkey_profiles',
    title: 'Hotkey Profiles & Global Windows Shortcuts',
    category: 'system',
    keywords: ['hotkeys', 'shortcuts', 'keyboard', 'media keys', 'key bindings', 'profiles', 'ctrl+b'],
    summary: 'Configure keyboard shortcuts, switch between hotkey profiles (Default, Compact, Gamer, Audiophile), and utilize Windows global media keys.',
    steps: [
      'Open Settings -> Hotkey Profiles.',
      'Inspect active key bindings: Space (Play/Pause), Left/Right (Seek), Ctrl+Left/Right (Prev/Next), Ctrl+B (Toggle Sidebar).',
      'Select a preset profile or click on a key binding to assign a custom shortcut.',
      'Harmoniq automatically detects key conflict warnings.'
    ],
    tips: [
      'Global Windows hardware media keys (Fn + F-keys, dedicated media keyboards) work even when Harmoniq is minimized.'
    ],
    route: 'settings',
    actionLabel: 'Open Hotkeys Settings'
  },
  {
    id: 'sleep_timer_extended',
    title: 'Extended Sleep Timer & Auto-Shutdown',
    category: 'system',
    keywords: ['sleep timer', 'timer', 'auto shutdown', 'stop playback', 'night', 'turn off'],
    summary: 'Fall asleep to your favorite music with an intelligent sleep timer that can pause playback, stop after the current track/queue, close Harmoniq, or put Windows to sleep.',
    steps: [
      'Click the Sleep Timer (moon/clock icon) in the bottom player bar or open Settings -> Sleep Timer.',
      'Choose a countdown duration (15 min, 30 min, 45 min, 1 hour, or custom minutes).',
      'Select the trigger mode: "Fade out & Pause", "Stop after Current Track", or "Stop after Current Queue".',
      'Optional: check "Close Harmoniq when finished" or "Put Windows to sleep".',
      'Click Start Timer to begin countdown with gentle audio volume fade-out.'
    ],
    tips: [
      'Audio volume fades smoothly over the last 30 seconds so you are not abruptly awakened.'
    ],
    route: 'settings',
    actionLabel: 'Open Sleep Timer Settings'
  },
  {
    id: 'backup_and_portable_mode',
    title: 'Backup, Restore & Portable USB Mode',
    category: 'system',
    keywords: ['backup', 'restore', 'export data', 'portable mode', 'usb', 'flash drive', 'database'],
    summary: 'Safeguard your playlists, listening history, bookmarks, and settings with one-click JSON backup/restore, or run Harmoniq in fully self-contained Portable Mode.',
    steps: [
      'Open Settings -> System & Backup.',
      'Click "Export Full Backup" to save a comprehensive JSON snapshot of your library metadata, playlists, and settings.',
      'To migrate to a new PC, click "Restore from Backup" and select your backup file.',
      'For USB drive usage, toggle "Portable Mode" to store all configuration, database, and cache files directly next to the executable.'
    ],
    tips: [
      'Portable Mode ensures no traces or registry entries are left behind on host Windows machines.'
    ],
    route: 'settings',
    actionLabel: 'Open System & Backup'
  },
  {
    id: 'signature_musical_navigation',
    title: 'Signature Musical Navigation (Violin & Trumpet)',
    category: 'ui',
    keywords: ['navigation', 'back', 'forward', 'violin', 'trumpet', 'history', 'musical icons'],
    summary: 'Harmoniq features custom musical navigation icons: a left-oriented Violin for Back navigation with violet glow, and a right-oriented Trumpet for Forward navigation.',
    steps: [
      'Look at the top-left title bar next to the Harmoniq logo.',
      'Click the Violin icon (or press Alt+Left / Backspace) to navigate back in your viewing history.',
      'Click the Trumpet icon (or press Alt+Right) to navigate forward.',
      'Hover over either instrument to reveal interactive musical glow animations and page tooltips.'
    ],
    tips: [
      'Violin and Trumpet navigation maintains complete stack history across all views, albums, and playlists.'
    ],
    route: 'home',
    actionLabel: 'Go to Home'
  },
  {
    id: 'local_library_management',
    title: 'Local Music Library & Automatic Folder Watcher',
    category: 'library',
    keywords: ['library', 'scan folder', 'add music', 'watcher', 'tags', 'metadata', 'mp3', 'flac', 'wav'],
    summary: 'Manage your local music collection with high-speed multi-threaded scanning, tag editing (ID3, Vorbis, FLAC metadata), album artwork extraction, and automatic folder synchronization.',
    steps: [
      'Click Songs, Albums, or Artists in the sidebar.',
      'Click "Add Folder" or drag music folders directly into Harmoniq to scan tracks.',
      'The Automatic Folder Watcher detects newly added or deleted audio files on your Windows disk in real time.',
      'Right-click any track and select "Edit Tags" to modify Title, Artist, Album, Year, Genre, or replace Album Cover art.'
    ],
    tips: [
      'Harmoniq supports MP3, FLAC, WAV, AAC, M4A, OGG, OPUS, and WMA formats natively.'
    ],
    route: 'songs',
    actionLabel: 'Open Songs Library'
  }
];

/**
 * Searches the Harmoniq knowledge base with relevance scoring.
 */
export function searchKnowledge(query: string, currentView?: string): KnowledgeDocument[] {
  if (!query || query.trim().length === 0) {
    if (currentView) {
      const match = HARMONIQ_KNOWLEDGE_BASE.filter(doc => doc.route === currentView);
      return match.length > 0 ? match : HARMONIQ_KNOWLEDGE_BASE.slice(0, 3);
    }
    return HARMONIQ_KNOWLEDGE_BASE.slice(0, 3);
  }

  const cleanQuery = query.toLowerCase();
  const queryTokens = cleanQuery.split(/\s+/).filter(t => t.length > 2);

  const scored = HARMONIQ_KNOWLEDGE_BASE.map(doc => {
    let score = 0;

    // Exact title or keyword match
    if (doc.title.toLowerCase().includes(cleanQuery)) score += 40;
    if (doc.summary.toLowerCase().includes(cleanQuery)) score += 20;

    // Token match
    for (const token of queryTokens) {
      if (doc.title.toLowerCase().includes(token)) score += 15;
      if (doc.keywords.some(k => k.toLowerCase().includes(token))) score += 12;
      if (doc.summary.toLowerCase().includes(token)) score += 6;
      if (doc.steps?.some(s => s.toLowerCase().includes(token))) score += 5;
    }

    // Active view contextual boost
    if (currentView && doc.route === currentView) {
      score += 15;
    }

    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.filter(item => item.score > 5).map(item => item.doc);

  return relevant.length > 0 ? relevant.slice(0, 3) : HARMONIQ_KNOWLEDGE_BASE.slice(0, 2);
}

/**
 * Generates an accurate, grounded local answer with step-by-step guidance and action buttons.
 */
export function generateLocalAnswer(
  query: string,
  currentView?: string
): { content: string; actions: AssistantAction[] } {
  const docs = searchKnowledge(query, currentView);
  const primaryDoc = docs[0] || HARMONIQ_KNOWLEDGE_BASE[0];

  const actions: AssistantAction[] = [];
  if (primaryDoc.route) {
    actions.push({
      id: `nav_${primaryDoc.route}`,
      label: primaryDoc.actionLabel || `Open ${primaryDoc.title}`,
      actionType: 'navigate',
      target: primaryDoc.route,
    });
  }

  // If there's a second closely matching doc with a different route
  if (docs[1] && docs[1].route && docs[1].route !== primaryDoc.route) {
    actions.push({
      id: `nav_${docs[1].route}`,
      label: docs[1].actionLabel || `Open ${docs[1].title}`,
      actionType: 'navigate',
      target: docs[1].route,
    });
  }

  let content = `### ${primaryDoc.title}\n\n${primaryDoc.summary}\n\n`;

  if (primaryDoc.steps && primaryDoc.steps.length > 0) {
    content += `**How to use:**\n`;
    primaryDoc.steps.forEach((step, index) => {
      content += `${index + 1}. ${step}\n`;
    });
    content += `\n`;
  }

  if (primaryDoc.tips && primaryDoc.tips.length > 0) {
    content += `> [!TIP]\n> ${primaryDoc.tips.join('\n> ')}\n\n`;
  }

  content += `Click below to jump directly to this feature:`;

  return { content, actions };
}

/**
 * Returns context-aware suggested questions for the chat interface.
 */
export function getSuggestedQuestions(currentView?: string): string[] {
  switch (currentView) {
    case 'equalizer':
      return [
        'How do I create a custom EQ preset?',
        'What frequencies boost vocal clarity?',
        'What does pre-amp gain do?',
        'How does ReplayGain prevent distortion?'
      ];
    case 'inspector':
      return [
        'What is Bit-Perfect WASAPI mode?',
        'How do I verify if my FLAC is 24-bit Hi-Res?',
        'What do Track Gain and Album Gain mean?'
      ];
    case 'abx':
      return [
        'How do I conduct an ABX blind listening test?',
        'Can humans hear the difference between FLAC and 320kbps MP3?',
        'What does p-value significance mean in audio?'
      ];
    case 'playlists':
      return [
        'How do I organize playlists into folders?',
        'How do I export an M3U playlist file?',
        'How do I recover an earlier version of my playlist?'
      ];
    case 'now_playing':
    case 'songs':
      return [
        'How do I save and restore multiple playback queues?',
        'How does Play Next differ from Add to Queue?',
        'How do I open Immersive Album Mode?'
      ];
    case 'calendar':
    case 'stats':
      return [
        'How is my daily listening time recorded?',
        'Can I see the exact songs I played on a specific date?',
        'How are top artists and genres calculated?'
      ];
    case 'lyrics':
      return [
        'How do I synchronize lyrics with timestamp offsets?',
        'Where does Harmoniq load .lrc files from?',
        'How do I edit and save lyrics text?'
      ];
    case 'vinyl_collection':
      return [
        'How do I browse my albums in Vinyl Collection mode?',
        'Can I customize vinyl disc animation speed?',
        'How do I view detailed album liner notes?'
      ];
    case 'radio':
    case 'online_music':
    case 'podcasts':
      return [
        'How do I add a custom Icecast/Shoutcast radio URL?',
        'How do I stream online music previews?',
        'How do I subscribe to an RSS podcast show?'
      ];
    case 'settings':
      return [
        'How do I enable the floating desktop mini-player?',
        'How do I customize keyboard hotkey profiles?',
        'How do I back up my library and use Portable Mode?'
      ];
    default:
      return [
        'How do I improve audio quality and use the Equalizer?',
        'How do I create playlists and organize them in folders?',
        'How do I view my listening calendar and statistics?',
        'What is Bit-Perfect mode and how does the Inspector work?',
        'How do I customize the Obsidian Violet theme?'
      ];
  }
}
