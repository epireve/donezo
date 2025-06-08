'use client';

import { useState, useEffect, FormEvent, ChangeEvent } from 'react';

// --- Interfaces ---
interface UserProfile {
  background: string;
  interests: string; // Stored as a comma-separated string
  shortTermGoals: string;
  midTermGoals: string;
  longTermGoals: string;
}

type ApiProvider = 'gemini' | 'openrouter';

interface ModelOption {
  id: string;
  name: string;
  provider: ApiProvider | string; // OpenRouter models might have more diverse provider strings
}

interface ApiConfig {
  apiKey: string;
  apiProvider?: ApiProvider;
  selectedModelId?: string;
}

// --- localStorage Keys ---
const USER_PROFILE_KEY = 'ai-todo-user-profile';
const API_CONFIG_KEY = 'ai-todo-api-config';

// --- Static Model Lists & URLs ---
const GEMINI_MODELS: ModelOption[] = [
  { id: 'gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash Preview (05-20)', provider: 'gemini' },
  { id: 'gemini-2.5-pro-preview-06-05', name: 'Gemini 2.5 Pro Preview (06-05)', provider: 'gemini' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'gemini' },
  { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', provider: 'gemini' },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', provider: 'gemini' },
  { id: 'gemini-pro', name: 'Gemini Pro (Legacy)', provider: 'gemini' },
  // Add more Gemini models if needed, these are for the OpenAI-compatible endpoint
];
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';


interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // User Profile State
  const [background, setBackground] = useState('');
  const [interests, setInterests] = useState('');
  const [shortTermGoals, setShortTermGoals] = useState('');
  const [midTermGoals, setMidTermGoals] = useState('');
  const [longTermGoals, setLongTermGoals] = useState('');

  // API Config State
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState<ApiProvider | ''>( '');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState<string | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    if (isOpen) {
      const storedProfile = localStorage.getItem(USER_PROFILE_KEY);
      if (storedProfile) {
        const profile: UserProfile = JSON.parse(storedProfile);
        setBackground(profile.background || '');
        setInterests(profile.interests || '');
        setShortTermGoals(profile.shortTermGoals || '');
        setMidTermGoals(profile.midTermGoals || '');
        setLongTermGoals(profile.longTermGoals || '');
      }

      const storedApiConfig = localStorage.getItem(API_CONFIG_KEY);
      if (storedApiConfig) {
        const config: ApiConfig = JSON.parse(storedApiConfig);
        setApiKey(config.apiKey || '');
        setApiProvider(config.apiProvider || '');
        // setSelectedModelId will be set by the effect below once provider and models are loaded
        // but we can pre-fill it here if we want to attempt to restore it immediately
        if (config.apiProvider && config.selectedModelId) {
            setSelectedModelId(config.selectedModelId);
        }
      } else {
        // Reset API config fields if nothing is stored
        setApiProvider('');
        setSelectedModelId('');
        setAvailableModels([]);
      }
    }
  }, [isOpen]);

  // Effect to fetch/set models when API provider changes or modal opens with a provider
 useEffect(() => {
    if (!isOpen) return;

    const fetchModels = async () => {
      if (!apiProvider) {
        setAvailableModels([]);
        setSelectedModelId(''); // Clear model if provider is cleared
        return;
      }

      setIsLoadingModels(true);
      setModelFetchError(null);
      let currentSelectedModel = selectedModelId; // Preserve current selection if possible

      // If selectedModelId was loaded from localStorage, keep it
      const storedApiConfig = localStorage.getItem(API_CONFIG_KEY);
      if (storedApiConfig) {
          const config: ApiConfig = JSON.parse(storedApiConfig);
          if (config.apiProvider === apiProvider && config.selectedModelId) {
              currentSelectedModel = config.selectedModelId;
          } else if (config.apiProvider !== apiProvider) {
            // If provider changed from what was stored, clear the stored model selection
            currentSelectedModel = '';
          }
      }


      if (apiProvider === 'gemini') {
        setAvailableModels(GEMINI_MODELS);
        setIsLoadingModels(false);
        // Check if currentSelectedModel is valid for Gemini, otherwise pick first or clear
        if (GEMINI_MODELS.find(m => m.id === currentSelectedModel)) {
            setSelectedModelId(currentSelectedModel);
        } else if (GEMINI_MODELS.length > 0) {
            setSelectedModelId(GEMINI_MODELS[0].id); // Default to first Gemini model
        } else {
            setSelectedModelId('');
        }
      } else if (apiProvider === 'openrouter') {
        try {
          const response = await fetch(OPENROUTER_MODELS_URL);
          if (!response.ok) {
            throw new Error(`Failed to fetch models: ${response.statusText}`);
          }
          const data = await response.json();
          const openRouterModels: ModelOption[] = (data.data || []).map((model: any) => ({
            id: model.id,
            name: model.name || model.id,
            provider: 'openrouter', // Or model.attributes?.provider or similar if available
          }));
          setAvailableModels(openRouterModels);
          // Check if currentSelectedModel is valid for OpenRouter, otherwise pick first or clear
          if (openRouterModels.find(m => m.id === currentSelectedModel)) {
              setSelectedModelId(currentSelectedModel);
          } else if (openRouterModels.length > 0) {
              setSelectedModelId(openRouterModels[0].id); // Default to first OpenRouter model
          } else {
              setSelectedModelId('');
          }
        } catch (error: any) {
          setModelFetchError(error.message || 'Could not fetch models from OpenRouter.');
          setAvailableModels([]);
          setSelectedModelId('');
        } finally {
          setIsLoadingModels(false);
        }
      }
    };

    fetchModels();
  }, [apiProvider, isOpen]);


  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    const userProfile: UserProfile = {
      background,
      interests,
      shortTermGoals,
      midTermGoals,
      longTermGoals,
    };
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfile));

    const apiConfig: ApiConfig = { 
        apiKey, 
        apiProvider: apiProvider || undefined, // Store empty string as undefined
        selectedModelId: selectedModelId || undefined 
    };
    localStorage.setItem(API_CONFIG_KEY, JSON.stringify(apiConfig));

    onClose();
  };

  const handleProviderChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as ApiProvider | '';
    setApiProvider(newProvider);
    setSelectedModelId(''); // Reset model when provider changes
    setAvailableModels([]); // Clear models immediately
    setModelFetchError(null);
  };


  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* User Profile Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b pb-2 dark:border-gray-600">User Profile</h3>
            {/* Background, Interests, Goals Textareas... (same as before) */}
            <div>
              <label htmlFor="background" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">My Background</label>
              <textarea id="background" value={background} onChange={(e) => setBackground(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200" placeholder="e.g., Software developer..."/>
            </div>
            <div>
              <label htmlFor="interests" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">My Interests</label>
              <textarea id="interests" value={interests} onChange={(e) => setInterests(e.target.value)} rows={2} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200" placeholder="e.g., AI, Productivity (comma-separated)"/>
            </div>
            <div>
              <label htmlFor="shortTermGoals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Short-term Goals</label>
              <textarea id="shortTermGoals" value={shortTermGoals} onChange={(e) => setShortTermGoals(e.target.value)} rows={2} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200" placeholder="e.g., Finish a project..."/>
            </div>
            <div>
              <label htmlFor="midTermGoals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mid-term Goals</label>
              <textarea id="midTermGoals" value={midTermGoals} onChange={(e) => setMidTermGoals(e.target.value)} rows={2} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200" placeholder="e.g., Career advancement..."/>
            </div>
            <div>
              <label htmlFor="longTermGoals" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Long-term Goals</label>
              <textarea id="longTermGoals" value={longTermGoals} onChange={(e) => setLongTermGoals(e.target.value)} rows={2} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-gray-200" placeholder="e.g., Major life achievements..."/>
            </div>
          </section>

          {/* API Configuration Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 border-b pb-2 dark:border-gray-600">API Configuration (BYOK)</h3>
            <div>
              <label htmlFor="apiProvider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Provider</label>
              <select
                id="apiProvider"
                value={apiProvider}
                onChange={handleProviderChange}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200"
              >
                <option value="">Select Provider</option>
                <option value="gemini">Gemini</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>

            {apiProvider && (
              <div>
                <label htmlFor="selectedModelId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Model</label>
                <select
                  id="selectedModelId"
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  disabled={isLoadingModels || availableModels.length === 0}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200 disabled:opacity-50"
                >
                  {isLoadingModels && <option value="">Loading models...</option>}
                  {!isLoadingModels && availableModels.length === 0 && apiProvider && <option value="">No models available or provider not selected</option>}
                  {!isLoadingModels && modelFetchError && <option value="">Error fetching models</option>}
                  {!isLoadingModels && !modelFetchError && availableModels.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
                {modelFetchError && <p className="mt-1 text-xs text-red-500 dark:text-red-400">{modelFetchError}</p>}
              </div>
            )}

            <div>
              <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Key {apiProvider ? `for ${apiProvider.charAt(0).toUpperCase() + apiProvider.slice(1)}` : ''}
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200"
                placeholder={`Enter your ${apiProvider || 'selected'} API key`}
                disabled={!apiProvider}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Your API key is stored locally in your browser.
              </p>
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
