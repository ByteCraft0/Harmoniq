import { AppView } from '../context/LibraryContext';
import {
  AIProviderId,
  AssistantAction,
  AssistantConfig,
  AssistantMessage,
  DEFAULT_ASSISTANT_CONFIG,
  HarmoniqAssistantContext,
  PulseOrbState,
} from '../types/assistant';
import { generateLocalAnswer, searchKnowledge } from './assistantKnowledge';
import { formatContextForPrompt } from './assistantContextService';
import { discoveryIntentService } from './discoveryIntentService';
import { musicDiscoveryEngine } from './musicDiscoveryEngine';
import { UnifiedTrack } from '../types/universalMusic';
import { PlaybackCommand } from '../types/discovery';
import { speechService } from './speechService';

export type AssistantPlaybackHandler = (
  command: PlaybackCommand,
  track?: UnifiedTrack,
  allTracks?: UnifiedTrack[]
) => Promise<{ success: boolean; message: string }>;

const HISTORY_STORAGE_KEY = 'harmoniq_assistant_messages';
const CONFIG_STORAGE_KEY = 'harmoniq_assistant_config';

const LABEL_TO_VIEW_MAP: Record<string, AppView> = {
  equalizer: 'equalizer',
  'equalizer studio': 'equalizer',
  'audio inspector': 'inspector',
  inspector: 'inspector',
  'abx comparator': 'abx',
  abx: 'abx',
  'abx audio comparison': 'abx',
  playlists: 'playlists',
  playlist: 'playlists',
  'listening calendar': 'calendar',
  calendar: 'calendar',
  'listening stats': 'stats',
  stats: 'stats',
  statistics: 'stats',
  lyrics: 'lyrics',
  'lyrics studio': 'lyrics',
  'immersive album': 'immersive_album',
  'immersive album mode': 'immersive_album',
  'vinyl collection': 'vinyl_collection',
  'vinyl collection mode': 'vinyl_collection',
  visualizer: 'visualizer',
  'online music': 'online_music',
  'online music search': 'online_music',
  'internet radio': 'radio',
  radio: 'radio',
  podcasts: 'podcasts',
  podcast: 'podcasts',
  settings: 'settings',
  'theme studio': 'settings',
  'hotkeys settings': 'settings',
  'hotkey profiles': 'settings',
  'sleep timer settings': 'settings',
  'sleep timer': 'settings',
  'system & backup': 'settings',
  'audio settings': 'audio_output',
  'audio output': 'audio_output',
  'songs library': 'songs',
  songs: 'songs',
  albums: 'albums',
  artists: 'artists',
  home: 'home',
  queue: 'now_playing',
};

class AssistantService {
  private config: AssistantConfig = { ...DEFAULT_ASSISTANT_CONFIG };
  private messages: AssistantMessage[] = [];
  private orbState: PulseOrbState = 'idle';
  private isOpen: boolean = false;
  private currentContext: HarmoniqAssistantContext | null = null;
  private playbackHandler: AssistantPlaybackHandler | null = null;
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Load configuration
    try {
      if (typeof window !== 'undefined' && window.harmoniqApi?.getAssistantConfig) {
        const stored = await window.harmoniqApi.getAssistantConfig();
        if (stored) {
          this.config = { ...DEFAULT_ASSISTANT_CONFIG, ...stored };
        }
      } else if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (local) {
          this.config = { ...DEFAULT_ASSISTANT_CONFIG, ...JSON.parse(local) };
        }
      }
    } catch (e) {
      console.warn('Failed to load assistant configuration:', e);
    }

    // Load message history if enabled
    if (this.config.saveHistory && typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (saved) {
          this.messages = JSON.parse(saved);
        }
      } catch {
        this.messages = [];
      }
    }

    // If history is empty, provide a warm welcome message
    if (this.messages.length === 0) {
      this.messages = [
        {
          id: 'welcome',
          role: 'assistant',
          content: `Welcome to **Harmoniq Assistant**! 🎵\n\nI can guide you through any feature in Harmoniq 2.0, explain audio settings, troubleshoot playback, and help you navigate the app.\n\nTry asking a question or selecting one of the suggested topics below!`,
          timestamp: Date.now(),
          actions: [
            { id: 'act_eq', label: 'Open Equalizer Studio', actionType: 'navigate', target: 'equalizer' },
            { id: 'act_cal', label: 'Open Listening Calendar', actionType: 'navigate', target: 'calendar' },
            { id: 'act_insp', label: 'Open Audio Inspector', actionType: 'navigate', target: 'inspector' }
          ]
        }
      ];
    }

    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('Error in AssistantService listener:', err);
      }
    });
  }

  // ----------------------------------------------------
  // Getters & Setters
  // ----------------------------------------------------

  public getConfig(): AssistantConfig {
    return { ...this.config };
  }

  public async updateConfig(updates: Partial<AssistantConfig>): Promise<boolean> {
    this.config = { ...this.config, ...updates };

    // Persist
    try {
      if (typeof window !== 'undefined' && window.harmoniqApi?.saveAssistantConfig) {
        await window.harmoniqApi.saveAssistantConfig(this.config);
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
      }
    } catch (e) {
      console.warn('Failed to persist assistant config:', e);
    }

    this.notify();
    return true;
  }

  public getMessages(): AssistantMessage[] {
    return [...this.messages];
  }

  public getAssistantContext(): HarmoniqAssistantContext | null {
    return this.currentContext ? { ...this.currentContext } : null;
  }

  public setAssistantContext(ctx: HarmoniqAssistantContext | null): void {
    this.currentContext = ctx;
    this.notify();
  }

  public registerPlaybackHandler(handler: AssistantPlaybackHandler): () => void {
    this.playbackHandler = handler;
    return () => {
      if (this.playbackHandler === handler) {
        this.playbackHandler = null;
      }
    };
  }

  public getOrbState(): PulseOrbState {
    return this.orbState;
  }

  public setOrbState(state: PulseOrbState): void {
    if (this.orbState !== state) {
      this.orbState = state;
      this.notify();
    }
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public setIsOpen(open: boolean): void {
    if (this.isOpen !== open) {
      this.isOpen = open;
      this.notify();
    }
  }

  public open(): void {
    this.setIsOpen(true);
  }

  public close(): void {
    if (speechService.isListening()) {
      speechService.stopRecognition();
    }
    this.setIsOpen(false);
    this.setOrbState('idle');
  }

  public toggle(): void {
    this.setIsOpen(!this.isOpen);
  }

  public clearHistory(): void {
    speechService.stopSpeaking();
    speechService.cancelRecognition();
    this.messages = [
      {
        id: 'cleared_welcome',
        role: 'assistant',
        content: 'Conversation history cleared. How can I assist you with Harmoniq today?',
        timestamp: Date.now(),
        actions: [
          { id: 'act_eq', label: 'Open Equalizer Studio', actionType: 'navigate', target: 'equalizer' },
          { id: 'act_cal', label: 'Open Listening Calendar', actionType: 'navigate', target: 'calendar' }
        ]
      }
    ];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
    this.setOrbState('idle');
    this.notify();
  }

  // ----------------------------------------------------
  // Action Parsing
  // ----------------------------------------------------

  public parseActionsFromContent(content: string): AssistantAction[] {
    const actions: AssistantAction[] = [];
    const openRegex = /\[Open\s+([^\]]+)\]/gi;
    let match;

    while ((match = openRegex.exec(content)) !== null) {
      const label = match[1].trim();
      const lower = label.toLowerCase();
      const target = LABEL_TO_VIEW_MAP[lower];
      if (target) {
        actions.push({
          id: `act_${target}_${Math.random().toString(36).substring(2, 7)}`,
          label: `Open ${label}`,
          actionType: 'navigate',
          target,
        });
      }
    }

    return actions;
  }

  // ----------------------------------------------------
  // Chat Messaging
  // ----------------------------------------------------

  public async sendMessage(prompt: string, currentView?: AppView): Promise<AssistantMessage> {
    const userMessage: AssistantMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: prompt.trim(),
      timestamp: Date.now()
    };

    this.messages.push(userMessage);
    this.setOrbState('processing');
    this.saveMessagesToStorage();
    this.notify();

    // Natural Language Music Discovery & Playback Actions (Phase 5A.2)
    if (discoveryIntentService.isDiscoveryOrPlaybackIntent(prompt)) {
      if (discoveryIntentService.isPlaybackCommand(prompt)) {
        const cmd = discoveryIntentService.extractPlaybackCommand(prompt);
        const lastResults = discoveryIntentService.getLastResults();

        let replyContent = '';
        const actions: AssistantAction[] = [];

        if (lastResults.length === 0) {
          replyContent = `There are no recent discovery results to play. Try asking for music first, like *"Find relaxing acoustic music"* or *"Discover songs similar to my current track"*.`;
          actions.push({ id: 'act_online', label: 'Open Universal Music', actionType: 'navigate', target: 'online_music' });
        } else if (cmd.action === 'queue_all') {
          const playableTracks = lastResults.filter(
            t => t.playbackCapability === 'full_stream' || t.playbackCapability === 'preview_stream' || t.playbackCapability === 'local_file'
          );
          if (playableTracks.length === 0) {
            replyContent = `None of the ${lastResults.length} recent discovery results have direct audio streaming capabilities (they are external links or catalog metadata).`;
          } else {
            if (this.playbackHandler) {
              await this.playbackHandler(cmd, undefined, playableTracks);
            }
            replyContent = `Added **${playableTracks.length} tracks** to your playback queue from the discovery results! 🎶`;
            actions.push({ id: 'act_queue', label: 'View Queue', actionType: 'navigate', target: 'now_playing' });
          }
        } else {
          const targetIndex = cmd.targetIndex ?? 0;
          const targetTrack = lastResults[targetIndex];

          if (!targetTrack) {
            replyContent = `Result #${targetIndex + 1} does not exist. There are currently ${lastResults.length} discovery results displayed.`;
          } else if (targetTrack.playbackCapability === 'external_link' || targetTrack.playbackCapability === 'metadata_only') {
            replyContent = `**"${targetTrack.title}"** by **${targetTrack.artist}** is an external destination on ${targetTrack.providerId.toUpperCase()} and cannot be played directly inside Harmoniq.\n\nClick the link button to view it on the official provider platform.`;
            if (targetTrack.providerWebUrl) {
              actions.push({ id: `open_${targetTrack.id}`, label: `Open on ${targetTrack.providerId.toUpperCase()}`, actionType: 'custom', payload: { url: targetTrack.providerWebUrl } });
            }
          } else {
            // Playable full_stream, preview_stream, or local_file
            if (this.playbackHandler) {
              await this.playbackHandler(cmd, targetTrack, lastResults);
            }
            if (cmd.action === 'play_index') {
              replyContent = `Now playing **"${targetTrack.title}"** by **${targetTrack.artist}** (${targetTrack.providerId.toUpperCase()}${targetTrack.playbackCapability === 'preview_stream' ? ' — 30s Preview' : ''}). 🎵`;
              actions.push({ id: 'act_now_playing', label: 'Now Playing', actionType: 'navigate', target: 'now_playing' });
            } else if (cmd.action === 'queue_index') {
              replyContent = `Added **"${targetTrack.title}"** by **${targetTrack.artist}** to your playback queue.`;
              actions.push({ id: 'act_queue', label: 'View Queue', actionType: 'navigate', target: 'now_playing' });
            } else if (cmd.action === 'play_next_index') {
              replyContent = `Set **"${targetTrack.title}"** by **${targetTrack.artist}** to play next after the current song.`;
            }
          }
        }

        const assistantMsg: AssistantMessage = {
          id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          role: 'assistant',
          content: replyContent,
          timestamp: Date.now(),
          actions,
        };
        this.messages.push(assistantMsg);
        this.saveMessagesToStorage();
        this.setOrbState('idle');
        this.notify();
        return assistantMsg;
      }

      // Natural Language Discovery Query
      const intent = discoveryIntentService.parseIntent(prompt);
      const discoveryResult = await musicDiscoveryEngine.discoverMusic(intent, this.currentContext);
      discoveryIntentService.setSession(intent, discoveryResult.tracks);

      let content = `### Music Discovery 🎵\n\n${discoveryResult.summary}\n\n`;
      if (discoveryResult.appliedFilters.length > 0) {
        content += `**Filters Applied:** ${discoveryResult.appliedFilters.join(' • ')}\n\n`;
      }
      if (discoveryResult.tracks.length > 0) {
        content += `You can play, queue, or view details for any track below, or ask follow-ups like *"more acoustic"* or *"play the first song"*.`;
      }

      const actions: AssistantAction[] = [
        { id: 'act_online', label: 'Open in Universal Music', actionType: 'navigate', target: 'online_music' },
      ];

      const assistantMsg: AssistantMessage = {
        id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        actions,
        discoveryResults: discoveryResult.tracks,
        discoverySummary: discoveryResult.summary,
      };

      this.messages.push(assistantMsg);
      this.saveMessagesToStorage();
      this.setOrbState('idle');
      this.notify();
      return assistantMsg;
    }

    // Grounded RAG retrieval & live playback context injection
    const relevantDocs = searchKnowledge(prompt, currentView);
    const ragContext = relevantDocs
      .map(
        d =>
          `Feature: ${d.title}\nCategory: ${d.category}\nRoute: ${d.route}\nSummary: ${d.summary}\nSteps: ${
            d.steps ? d.steps.join(' -> ') : 'N/A'
          }\nTips: ${d.tips ? d.tips.join('. ') : 'N/A'}`
      )
      .join('\n\n');

    const formattedPlayback = this.currentContext ? formatContextForPrompt(this.currentContext) : '';
    const combinedContext = [formattedPlayback, ragContext ? `Harmoniq Feature Documentation:\n${ragContext}` : '']
      .filter(Boolean)
      .join('\n\n');

    let assistantContent = '';
    let extractedActions: AssistantAction[] = [];
    let isError = false;

    // Call backend API if available and configured
    if (
      this.config.provider !== 'local' &&
      this.config.apiKey &&
      typeof window !== 'undefined' &&
      window.harmoniqApi?.sendAssistantChat
    ) {
      try {
        const historyForApi = this.messages.slice(-6).map(m => ({
          role: m.role,
          content: m.content
        }));

        const result = await window.harmoniqApi.sendAssistantChat({
          messages: historyForApi,
          context: combinedContext,
          assistantContext: this.currentContext || undefined
        });

        if (result && !result.error && result.content) {
          assistantContent = result.content;
          extractedActions = this.parseActionsFromContent(assistantContent);

          // If AI did not include an action tag but we found a strong doc match with route
          if (extractedActions.length === 0 && relevantDocs[0]?.route) {
            extractedActions.push({
              id: `act_${relevantDocs[0].route}`,
              label: relevantDocs[0].actionLabel || `Open ${relevantDocs[0].title}`,
              actionType: 'navigate',
              target: relevantDocs[0].route
            });
          }
        } else {
          // Fallback to local grounded generator
          const local = generateLocalAnswer(prompt, currentView, this.currentContext || undefined);
          assistantContent = local.content;
          extractedActions = local.actions;
        }
      } catch (err: any) {
        console.warn('API sendAssistantChat failed, using local grounded engine:', err);
        const local = generateLocalAnswer(prompt, currentView, this.currentContext || undefined);
        assistantContent = local.content;
        extractedActions = local.actions;
      }
    } else {
      // Local Grounded Engine
      const local = generateLocalAnswer(prompt, currentView, this.currentContext || undefined);
      assistantContent = local.content;
      extractedActions = local.actions;
    }

    const assistantMsg: AssistantMessage = {
      id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'assistant',
      content: assistantContent,
      timestamp: Date.now(),
      actions: extractedActions,
      error: isError
    };

    this.messages.push(assistantMsg);
    this.saveMessagesToStorage();

    // Handle speech playback if enabled
    if (this.config.speechEnabled) {
      this.setOrbState('responding');
      assistantMsg.audioPlaying = true;
      this.notify();

      speechService.speak(assistantContent, {
        volume: this.config.speechVolume,
        rate: this.config.speechRate,
        lang: this.config.speechLang,
        voiceUri: this.config.speechVoiceUri,
        onEnd: () => {
          assistantMsg.audioPlaying = false;
          this.setOrbState('idle');
          this.notify();
        },
        onError: () => {
          assistantMsg.audioPlaying = false;
          this.setOrbState('idle');
          this.notify();
        }
      });
    } else {
      // Brief responding visual state
      this.setOrbState('responding');
      setTimeout(() => {
        if (this.orbState === 'responding') {
          this.setOrbState('idle');
        }
      }, 1500);
    }

    this.notify();
    return assistantMsg;
  }

  public speakMessage(messageId: string): void {
    const msg = this.messages.find(m => m.id === messageId);
    if (!msg || !msg.content) return;

    if (speechService.isSpeaking()) {
      speechService.stopSpeaking();
      this.messages.forEach(m => (m.audioPlaying = false));
      this.setOrbState('idle');
      this.notify();
      return;
    }

    this.messages.forEach(m => (m.audioPlaying = m.id === messageId));
    this.setOrbState('responding');
    this.notify();

    speechService.speak(msg.content, {
      volume: this.config.speechVolume,
      rate: this.config.speechRate,
      lang: this.config.speechLang,
      voiceUri: this.config.speechVoiceUri,
      onEnd: () => {
        msg.audioPlaying = false;
        this.setOrbState('idle');
        this.notify();
      },
      onError: () => {
        msg.audioPlaying = false;
        this.setOrbState('idle');
        this.notify();
      }
    });
  }

  public stopSpeaking(): void {
    speechService.stopSpeaking();
    this.messages.forEach(m => (m.audioPlaying = false));
    this.setOrbState('idle');
    this.notify();
  }

  public async testConnection(configToTest?: AssistantConfig): Promise<{ success: boolean; message: string; model?: string }> {
    const cfg = configToTest || this.config;
    if (cfg.provider === 'local') {
      return { success: true, message: 'Local Grounded Assistant is online and operational.' };
    }

    if (typeof window !== 'undefined' && window.harmoniqApi?.testAssistantConnection) {
      return await window.harmoniqApi.testAssistantConnection(cfg);
    }

    return { success: false, message: 'Electron API is unavailable in this environment.' };
  }

  private saveMessagesToStorage(): void {
    if (this.config.saveHistory && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.messages.slice(-30)));
      } catch {
        /* ignore */
      }
    }
  }
}

export const assistantService = new AssistantService();
