import { useEffect, useState, useCallback } from 'react';
import { AssistantConfig, AssistantMessage, PulseOrbState } from '../types/assistant';
import { assistantService } from '../services/assistantService';
import { speechService } from '../services/speechService';
import { AppView } from '../context/LibraryContext';

export function useAssistant() {
  const [config, setConfig] = useState<AssistantConfig>(assistantService.getConfig());
  const [messages, setMessages] = useState<AssistantMessage[]>(assistantService.getMessages());
  const [orbState, setOrbState] = useState<PulseOrbState>(assistantService.getOrbState());
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  useEffect(() => {
    const unsubscribe = assistantService.subscribe(() => {
      setConfig(assistantService.getConfig());
      setMessages(assistantService.getMessages());
      setOrbState(assistantService.getOrbState());
    });
    return unsubscribe;
  }, []);

  const openAssistant = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    if (speechService.isListening()) {
      speechService.stopRecognition();
      setIsListening(false);
      setInterimTranscript('');
      assistantService.setOrbState('idle');
    }
  }, []);

  const toggleAssistant = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const sendMessage = useCallback(async (prompt: string, currentView?: AppView) => {
    if (!prompt.trim()) return;
    return await assistantService.sendMessage(prompt, currentView);
  }, []);

  const clearMessages = useCallback(() => {
    assistantService.clearHistory();
    setInterimTranscript('');
  }, []);

  const updateConfig = useCallback(async (updates: Partial<AssistantConfig>) => {
    return await assistantService.updateConfig(updates);
  }, []);

  const testConnection = useCallback(async (cfg?: AssistantConfig) => {
    return await assistantService.testConnection(cfg);
  }, []);

  const speakMessage = useCallback((id: string) => {
    assistantService.speakMessage(id);
  }, []);

  const stopSpeaking = useCallback(() => {
    assistantService.stopSpeaking();
  }, []);

  // Voice STT Controls
  const startListening = useCallback((onFinalResult?: (transcript: string) => void) => {
    if (!speechService.isRecognitionSupported()) {
      assistantService.setOrbState('error');
      setTimeout(() => assistantService.setOrbState('idle'), 2500);
      return false;
    }

    setIsListening(true);
    setInterimTranscript('');
    assistantService.setOrbState('listening');

    return speechService.startRecognition(
      {
        onInterim: (text) => {
          setInterimTranscript(text);
        },
        onFinal: (text) => {
          setIsListening(false);
          setInterimTranscript('');
          assistantService.setOrbState('idle');
          if (onFinalResult) {
            onFinalResult(text);
          }
        },
        onError: (err) => {
          setIsListening(false);
          setInterimTranscript('');
          assistantService.setOrbState('error');
          setTimeout(() => assistantService.setOrbState('idle'), 2500);
        },
        onEnd: () => {
          setIsListening(false);
          setInterimTranscript('');
          if (assistantService.getOrbState() === 'listening') {
            assistantService.setOrbState('idle');
          }
        }
      },
      config.speechLang
    );
  }, [config.speechLang]);

  const stopListening = useCallback(() => {
    speechService.stopRecognition();
    setIsListening(false);
    setInterimTranscript('');
    assistantService.setOrbState('idle');
  }, []);

  const cancelListening = useCallback(() => {
    speechService.cancelRecognition();
    setIsListening(false);
    setInterimTranscript('');
    assistantService.setOrbState('idle');
  }, []);

  return {
    config,
    messages,
    orbState,
    isOpen,
    isListening,
    interimTranscript,
    openAssistant,
    closeAssistant,
    toggleAssistant,
    sendMessage,
    clearMessages,
    updateConfig,
    testConnection,
    speakMessage,
    stopSpeaking,
    startListening,
    stopListening,
    cancelListening,
    setOrbState: (state: PulseOrbState) => assistantService.setOrbState(state)
  };
}
