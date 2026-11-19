/**
 * SpeechService provides Speech-to-Text (Speech Recognition)
 * and Text-to-Speech (Speech Synthesis) for Harmoniq Assistant.
 */

export interface SpeechSynthesisOptions {
  volume?: number;
  rate?: number;
  lang?: string;
  voiceUri?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface SpeechRecognitionCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (errorMsg: string) => void;
  onEnd: () => void;
}

class SpeechService {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private recognitionInstance: any = null;
  private isListeningActive: boolean = false;
  private silenceTimer: any = null;

  // ----------------------------------------------------
  // Text to Speech (TTS)
  // ----------------------------------------------------

  public isSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isSynthesisSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  public isSpeaking(): boolean {
    if (!this.isSynthesisSupported()) return false;
    return window.speechSynthesis.speaking;
  }

  public stopSpeaking(): void {
    if (!this.isSynthesisSupported()) return;
    try {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    } catch {
      /* ignore */
    }
  }

  public speak(text: string, options?: SpeechSynthesisOptions): void {
    if (!this.isSynthesisSupported()) {
      options?.onError?.(new Error('Speech synthesis not supported in this environment'));
      return;
    }

    this.stopSpeaking();

    // Strip markdown formatting and navigation action brackets for clean pronunciation
    const cleanText = text
      .replace(/\[Open[^\]]+\]/g, '')
      .replace(/[#*`>_~[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.volume = options?.volume !== undefined ? Math.max(0, Math.min(1, options.volume)) : 0.85;
      utterance.rate = options?.rate !== undefined ? Math.max(0.5, Math.min(2, options.rate)) : 1.0;
      utterance.lang = options?.lang || 'en-US';

      if (options?.voiceUri) {
        const voices = this.getVoices();
        const selected = voices.find(v => v.voiceURI === options.voiceUri);
        if (selected) {
          utterance.voice = selected;
        }
      }

      utterance.onstart = () => {
        options?.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        this.currentUtterance = null;
        options?.onError?.(e);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      options?.onError?.(err);
    }
  }

  // ----------------------------------------------------
  // Speech to Text (STT)
  // ----------------------------------------------------

  public isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  public isListening(): boolean {
    return this.isListeningActive;
  }

  public startRecognition(
    callbacks: SpeechRecognitionCallbacks,
    lang: string = 'en-US'
  ): boolean {
    if (!this.isRecognitionSupported()) {
      callbacks.onError('Microphone speech recognition is not supported in this browser/environment.');
      return false;
    }

    this.stopRecognition();

    try {
      const SpeechRecognitionConstructor =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionConstructor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.maxAlternatives = 1;

      this.isListeningActive = true;
      this.recognitionInstance = recognition;

      // Auto safety timeout: stop if user doesn't speak within 10 seconds
      this.silenceTimer = setTimeout(() => {
        if (this.isListeningActive) {
          this.stopRecognition();
        }
      }, 10000);

      recognition.onresult = (event: any) => {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }

        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (interim) {
          callbacks.onInterim(interim);
        }
        if (final) {
          callbacks.onFinal(final.trim());
        }
      };

      recognition.onerror = (event: any) => {
        this.isListeningActive = false;
        let message = 'Speech recognition error';
        if (event.error === 'not-allowed') {
          message = 'Microphone permission was denied. Please allow microphone access.';
        } else if (event.error === 'no-speech') {
          message = 'No speech was detected. Please try speaking again.';
        } else if (event.error === 'network') {
          message = 'Network error during speech recognition.';
        } else if (event.error === 'audio-capture') {
          message = 'No microphone device was found or audio capture failed.';
        }
        callbacks.onError(message);
      };

      recognition.onend = () => {
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
          this.silenceTimer = null;
        }
        this.isListeningActive = false;
        callbacks.onEnd();
      };

      recognition.start();
      return true;
    } catch (err: any) {
      this.isListeningActive = false;
      callbacks.onError(err?.message || 'Failed to start speech recognition');
      return false;
    }
  }

  public stopRecognition(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.stop();
      } catch {
        /* ignore */
      }
      this.recognitionInstance = null;
    }
    this.isListeningActive = false;
  }

  public cancelRecognition(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognitionInstance) {
      try {
        this.recognitionInstance.abort();
      } catch {
        /* ignore */
      }
      this.recognitionInstance = null;
    }
    this.isListeningActive = false;
  }
}

export const speechService = new SpeechService();
