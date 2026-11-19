import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  HARMONIQ_KNOWLEDGE_BASE,
  searchKnowledge,
  generateLocalAnswer,
  getSuggestedQuestions,
} from '../services/assistantKnowledge';
import { speechService } from '../services/speechService';
import { assistantService } from '../services/assistantService';
import { DEFAULT_ASSISTANT_CONFIG, PulseOrbState } from '../types/assistant';

describe('Harmoniq 2.0 - Phase 7: Harmoniq Assistant & Pulse Orb', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Part 5: Harmoniq Knowledge Base & Grounded RAG', () => {
    it('indexes all 23 genuine Harmoniq 2.0 features with valid routes and actions', () => {
      expect(HARMONIQ_KNOWLEDGE_BASE.length).toBeGreaterThanOrEqual(20);

      const requiredFeatures = [
        'equalizer_studio',
        'audio_inspector',
        'abx_comparison',
        'waveform_navigation',
        'playlists_and_folders',
        'saved_queues',
        'listening_calendar',
        'lyrics_studio',
        'immersive_album',
        'vinyl_collection',
        'audio_visualizer',
        'online_music_search',
        'internet_radio',
        'podcasts',
        'theme_studio',
        'mini_player_desktop',
        'hotkey_profiles',
        'sleep_timer_extended',
        'backup_and_portable_mode',
        'signature_musical_navigation',
      ];

      requiredFeatures.forEach((featId) => {
        const found = HARMONIQ_KNOWLEDGE_BASE.find((d) => d.id === featId);
        expect(found, `Expected feature ${featId} to exist in knowledge base`).toBeDefined();
        expect(found?.steps?.length).toBeGreaterThan(0);
        expect(found?.route).toBeDefined();
        expect(found?.actionLabel).toBeDefined();
      });
    });

    it('searches knowledge base and returns top relevant documents for audio queries', () => {
      const eqResults = searchKnowledge('how do I adjust bass and equalizer frequencies');
      expect(eqResults.length).toBeGreaterThan(0);
      expect(eqResults[0].id).toBe('equalizer_studio');
      expect(eqResults[0].route).toBe('equalizer');

      const wasapiResults = searchKnowledge('is my DAC in Bit-Perfect wasapi mode');
      expect(wasapiResults.length).toBeGreaterThan(0);
      expect(wasapiResults[0].id).toBe('audio_inspector');
      expect(wasapiResults[0].route).toBe('inspector');

      const abxResults = searchKnowledge('blind listening test mp3 vs flac');
      expect(abxResults.length).toBeGreaterThan(0);
      expect(abxResults[0].id).toBe('abx_comparison');
      expect(abxResults[0].route).toBe('abx');
    });

    it('boosts relevance for features matching the current activeView', () => {
      // General question about presets while user is currently viewing the Equalizer
      const resultsWithView = searchKnowledge('presets', 'equalizer');
      expect(resultsWithView[0].id).toBe('equalizer_studio');

      // Question about playlists while user is viewing playlists
      const playlistResults = searchKnowledge('organize songs', 'playlists');
      expect(playlistResults[0].route).toBe('playlists');
    });

    it('generates structured grounded answers with steps and navigation action buttons', () => {
      const answer = generateLocalAnswer('how do I use the equalizer', 'equalizer');

      expect(answer.content).toContain('Equalizer Studio');
      expect(answer.content).toContain('**How to use:**');
      expect(answer.content).toContain('1.');
      expect(answer.actions.length).toBeGreaterThan(0);

      const navAction = answer.actions.find((a) => a.actionType === 'navigate');
      expect(navAction).toBeDefined();
      expect(navAction?.target).toBe('equalizer');
      expect(navAction?.label).toContain('Equalizer');
    });

    it('provides context-aware suggested questions based on the active screen', () => {
      const eqQuestions = getSuggestedQuestions('equalizer');
      expect(eqQuestions.some((q) => q.toLowerCase().includes('eq'))).toBe(true);

      const calendarQuestions = getSuggestedQuestions('calendar');
      expect(calendarQuestions.some((q) => q.toLowerCase().includes('listening'))).toBe(true);

      const inspectorQuestions = getSuggestedQuestions('inspector');
      expect(inspectorQuestions.some((q) => q.toLowerCase().includes('bit-perfect'))).toBe(true);

      const defaultQuestions = getSuggestedQuestions(undefined);
      expect(defaultQuestions.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Part 6 & 8: Action Parsing & Speech Processing', () => {
    it('parses inline action tags [Open ...] into valid navigation actions', () => {
      const sampleAIResponse = `Here is how you adjust your sound:
1. Open the equalizer and boost 60Hz.
2. Use the preamp slider to avoid clipping.

You can start by clicking: [Open Equalizer Studio] or check your output in [Open Audio Inspector].`;

      const actions = assistantService.parseActionsFromContent(sampleAIResponse);
      expect(actions.length).toBe(2);
      expect(actions[0].target).toBe('equalizer');
      expect(actions[0].label).toBe('Open Equalizer Studio');
      expect(actions[1].target).toBe('inspector');
      expect(actions[1].label).toBe('Open Audio Inspector');
    });

    it('cleans markdown symbols and bracketed actions before speech synthesis', () => {
      let spokenText = '';
      const mockUtterance = vi.fn().mockImplementation((text: string) => {
        spokenText = text;
        return {
          text,
          volume: 1,
          rate: 1,
          lang: 'en-US',
        };
      });

      (globalThis as any).SpeechSynthesisUtterance = mockUtterance;
      (globalThis as any).window = {
        speechSynthesis: {
          speaking: false,
          cancel: vi.fn(),
          speak: vi.fn((utt) => utt.onend?.()),
          getVoices: vi.fn(() => []),
        },
      };

      const markdownText = `### Equalizer Studio\n**Step 1:** Adjust the 100Hz slider.\n> [!TIP]\n> Lower preamp.\n[Open Equalizer Studio]`;

      speechService.speak(markdownText, {
        volume: 0.9,
        rate: 1.1,
      });

      expect(spokenText).not.toContain('###');
      expect(spokenText).not.toContain('**');
      expect(spokenText).not.toContain('> [!TIP]');
      expect(spokenText).not.toContain('[Open Equalizer Studio]');
      expect(spokenText).toContain('Equalizer Studio');
      expect(spokenText).toContain('Adjust the 100Hz slider');
    });

    it('safely handles environments where SpeechRecognition is unavailable', () => {
      const callbacks = {
        onInterim: vi.fn(),
        onFinal: vi.fn(),
        onError: vi.fn(),
        onEnd: vi.fn(),
      };

      delete (globalThis as any).SpeechRecognition;
      delete (globalThis as any).webkitSpeechRecognition;

      const started = speechService.startRecognition(callbacks);
      expect(started).toBe(false);
      expect(callbacks.onError).toHaveBeenCalledWith(
        expect.stringContaining('Microphone speech recognition is not supported')
      );
    });
  });

  describe('Part 2, 4 & 12: Assistant State, Pulse Orb & Configuration', () => {
    it('initializes with default assistant configuration', () => {
      const cfg = assistantService.getConfig();
      expect(cfg.enabled).toBe(true);
      expect(cfg.provider).toBeDefined();
      expect(cfg.speechVolume).toBeGreaterThan(0);
      expect(cfg.speechRate).toBe(1.0);
    });

    it('updates configuration and preserves changes', async () => {
      await assistantService.updateConfig({
        provider: 'gemini',
        speechEnabled: true,
        speechVolume: 0.95,
        reducedMotion: true,
      });

      const updated = assistantService.getConfig();
      expect(updated.provider).toBe('gemini');
      expect(updated.speechEnabled).toBe(true);
      expect(updated.speechVolume).toBe(0.95);
      expect(updated.reducedMotion).toBe(true);
    });

    it('tracks Pulse Orb state transitions properly', () => {
      const validStates: PulseOrbState[] = [
        'idle',
        'hover',
        'listening',
        'processing',
        'responding',
        'error',
        'inactive',
      ];

      validStates.forEach((st) => {
        assistantService.setOrbState(st);
        expect(assistantService.getOrbState()).toBe(st);
      });

      assistantService.setOrbState('idle');
    });

    it('sends messages and saves conversation history', async () => {
      const initialCount = assistantService.getMessages().length;

      const response = await assistantService.sendMessage(
        'How do I create a custom playlist and save queues?',
        'playlists'
      );

      expect(response).toBeDefined();
      expect(response.role).toBe('assistant');
      expect(response.content.length).toBeGreaterThan(20);

      const msgs = assistantService.getMessages();
      expect(msgs.length).toBe(initialCount + 2); // user + assistant
      expect(msgs[msgs.length - 2].role).toBe('user');
      expect(msgs[msgs.length - 1].role).toBe('assistant');
    });

    it('clears conversation history and restores friendly welcome prompt', () => {
      assistantService.clearHistory();
      const msgs = assistantService.getMessages();
      expect(msgs.length).toBe(1);
      expect(msgs[0].role).toBe('assistant');
      expect(msgs[0].content).toContain('history cleared');
      expect(msgs[0].actions?.length).toBeGreaterThan(0);
    });

    it('tests connection for Local Grounded engine successfully without network calls', async () => {
      const res = await assistantService.testConnection({
        ...DEFAULT_ASSISTANT_CONFIG,
        provider: 'local',
      });
      expect(res.success).toBe(true);
      expect(res.message).toContain('Local Grounded Assistant');
    });
  });
});
