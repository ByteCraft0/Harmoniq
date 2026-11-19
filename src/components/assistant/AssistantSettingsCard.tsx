import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Volume2,
  Mic,
  Trash2,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { useAssistant } from '../../hooks/useAssistant';
import { speechService } from '../../services/speechService';
import { AIProviderId, AssistantConfig } from '../../types/assistant';

export const AssistantSettingsCard: React.FC = () => {
  const { config, updateConfig, testConnection, clearMessages } = useAssistant();

  const [provider, setProvider] = useState<AIProviderId>(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [model, setModel] = useState(config.model || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  useEffect(() => {
    setProvider(config.provider);
    setApiKey(config.apiKey || '');
    setModel(config.model || '');
  }, [config]);

  useEffect(() => {
    const updateVoices = () => {
      setAvailableVoices(speechService.getVoices());
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const handleProviderChange = (newProvider: AIProviderId) => {
    setProvider(newProvider);
    let defaultModel = '';
    if (newProvider === 'gemini') defaultModel = 'gemini-1.5-flash';
    else if (newProvider === 'openai') defaultModel = 'gpt-4o-mini';
    else if (newProvider === 'groq') defaultModel = 'llama-3.1-8b-instant';
    setModel(defaultModel);
    setTestResult(null);
  };

  const handleSave = async () => {
    await updateConfig({
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || undefined,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    const testCfg: AssistantConfig = {
      ...config,
      provider,
      apiKey: apiKey.trim(),
      model: model.trim() || undefined,
    };

    const res = await testConnection(testCfg);
    setTesting(false);
    setTestResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-6 bg-gradient-to-br from-violet-950/30 via-[#110d22] to-[#0c0919] border border-violet-500/20 rounded-2xl shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-violet-600/20 border border-violet-500/30 rounded-xl text-violet-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Harmoniq Assistant Configuration
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure your AI intelligence provider, floating Pulse Orb identity, and spoken responses.
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => updateConfig({ enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
          </label>
        </div>
      </div>

      {/* AI Provider Section */}
      <div className="p-6 bg-[#0e0a1b]/60 border border-violet-500/15 rounded-2xl space-y-5">
        <div className="flex items-center gap-2 border-b border-violet-500/15 pb-3">
          <Cpu className="w-4 h-4 text-violet-400" />
          <h4 className="text-sm font-semibold text-white tracking-wide">
            Intelligence Engine & Provider
          </h4>
        </div>

        {/* Provider Radio Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              id: 'local',
              name: 'Local Grounded',
              desc: 'Offline built-in Harmoniq knowledge base. Zero cost, no API keys needed.',
              badge: 'Offline / Built-in',
            },
            {
              id: 'gemini',
              name: 'Google Gemini',
              desc: 'Gemini 1.5 Flash / Pro. High-speed reasoning with generous free tier.',
              badge: 'Recommended',
            },
            {
              id: 'openai',
              name: 'OpenAI',
              desc: 'GPT-4o Mini or GPT-4o. Industry standard intelligence.',
              badge: 'BYOK',
            },
            {
              id: 'groq',
              name: 'Groq Cloud',
              desc: 'Ultra-low latency Llama-3.1 inference on custom LPUs.',
              badge: 'Fastest',
            },
          ].map((item) => (
            <div
              key={item.id}
              onClick={() => handleProviderChange(item.id as AIProviderId)}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                provider === item.id
                  ? 'bg-violet-600/20 border-violet-400 shadow-md ring-1 ring-violet-400/50'
                  : 'bg-white/[0.02] border-white/5 hover:border-violet-500/30 hover:bg-white/[0.04]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-zinc-100">{item.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                      item.id === 'gemini'
                        ? 'bg-violet-500/30 text-violet-200'
                        : item.id === 'local'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* API Credentials Configuration */}
        {provider !== 'local' && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                  <span>API Key</span>
                  <span className="text-[10px] text-zinc-500">Stored securely in Electron main process</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${provider.toUpperCase()} API key...`}
                    className="w-full bg-[#130f24] border border-violet-500/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-200"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Model Name</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    provider === 'gemini'
                      ? 'gemini-1.5-flash'
                      : provider === 'openai'
                      ? 'gpt-4o-mini'
                      : 'llama-3.1-8b-instant'
                  }
                  className="w-full bg-[#130f24] border border-violet-500/20 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-400"
                />
              </div>
            </div>

            {/* Test Connection Button & Status */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleTest}
                disabled={testing || !apiKey.trim()}
                className="px-4 py-2 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/40 text-violet-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing Connection...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md active:scale-95"
              >
                Save Settings
              </button>

              {saveSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Settings saved securely
                </span>
              )}

              {testResult && (
                <div
                  className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pulse Orb & Visual Appearance */}
      <div className="p-6 bg-[#0e0a1b]/60 border border-violet-500/15 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-violet-500/15 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h4 className="text-sm font-semibold text-white tracking-wide">
              Harmoniq Pulse Orb Appearance
            </h4>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-zinc-200">Reduced Motion</div>
              <div className="text-[11px] text-zinc-400">
                Disable continuous spinning and pulsing animations for the floating orb.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.reducedMotion}
                onChange={(e) => updateConfig({ reducedMotion: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-zinc-200">Save Conversation History</div>
              <div className="text-[11px] text-zinc-400">
                Preserve conversation history across application restarts.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.saveHistory}
                onChange={(e) => updateConfig({ saveHistory: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Voice & Speech Synthesis Section */}
      <div className="p-6 bg-[#0e0a1b]/60 border border-violet-500/15 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-violet-500/15 pb-3">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-violet-400" />
            <h4 className="text-sm font-semibold text-white tracking-wide">
              Voice Output (Text-to-Speech)
            </h4>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.speechEnabled}
              onChange={(e) => updateConfig({ speechEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-300">Speech Voice</label>
            <select
              value={config.speechVoiceUri || ''}
              onChange={(e) => updateConfig({ speechVoiceUri: e.target.value })}
              className="w-full bg-[#130f24] border border-violet-500/20 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-400"
            >
              <option value="">Default System Voice</option>
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300">
              <span>Speech Volume</span>
              <span className="font-mono text-violet-300">{Math.round(config.speechVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.speechVolume}
              onChange={(e) => updateConfig({ speechVolume: parseFloat(e.target.value) })}
              className="w-full accent-violet-500"
            />
          </div>
        </div>
      </div>

      {/* Privacy & Clear Data */}
      <div className="p-5 bg-zinc-950/40 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-zinc-400 leading-relaxed">
            <span className="text-zinc-200 font-semibold block mb-0.5">Privacy First Audio Assistant</span>
            Harmoniq never uploads your local audio files, folder paths, or private metadata. Only direct assistant questions and feature context are processed.
          </div>
        </div>

        <div className="shrink-0">
          {clearConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  clearMessages();
                  setClearConfirm(false);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
              >
                Confirm Delete
              </button>
              <button
                onClick={() => setClearConfirm(false)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setClearConfirm(true)}
              className="px-3 py-1.5 bg-white/5 hover:bg-rose-950/40 border border-white/10 hover:border-rose-500/30 text-zinc-300 hover:text-rose-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
