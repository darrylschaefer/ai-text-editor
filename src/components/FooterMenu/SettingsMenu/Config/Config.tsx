// This specific config menu appears in the footer menu, it allows users to edit the legacy chat and completion configurations

import React, { useState } from 'react';
import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import { ApiEndpointOptions, LegacyConfigInterface, ProviderOptions } from '@type/document';
import PopupModal from '@components/PopupModal';
import { ModelSelector, MaxTokenSlider, TemperatureSlider, TopPSlider, FrequencyPenaltySlider, PresencePenaltySlider } from '@components/Configuration/sliders';

import { ModelOptions, LegacyModels, ConfigInterface } from '@type/document';
import { _defaultChatConfig, _defaultSystemMessage, _defaultLegacyConfig, legacyCompletionModels } from '@constants/chat';

type ConfigType = 'chat' | 'completion';

const Config = () => {
  const { t } = useTranslation('model');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  return (
    <div>
      <button className='btn btn-neutral w-48 justify-center' onClick={() => setIsModalOpen(true)}>
        Legacy Config
      </button>
      {isModalOpen && <LegacyConfigPopup setIsModalOpen={setIsModalOpen} />}
    </div>
  );
};

export const LegacyConfigPopup = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [configType, setConfigType] = useState<ConfigType>('chat');
  
  return (
    <PopupModal
      title="Legacy Config"
      setIsModalOpen={setIsModalOpen}
      cancelButton={true}
    >
      <div className='w-[90vw] max-w-full'>
        {/* Tab Selector */}
        <div className='flex border-b border-gray-200 dark:border-gray-800/30'>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              configType === 'chat'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setConfigType('chat')}
          >
            Default Chat Settings
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              configType === 'completion'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
            onClick={() => setConfigType('completion')}
          >
            Default Completion Settings
          </button>
        </div>

        {/* Content */}
        <div className='p-6 text-sm text-gray-900 dark:text-gray-300'>
          {configType === 'chat' ? (
            <ChatConfigForm setIsModalOpen={setIsModalOpen} />
          ) : (
            <CompletionConfigForm setIsModalOpen={setIsModalOpen} />
          )}
        </div>
      </div>
    </PopupModal>
  );
};

const ChatConfigForm = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const config = useStore.getState().defaultChatConfig;
  const setDefaultChatConfig = useStore((state) => state.setDefaultChatConfig);
  const setDefaultSystemMessage = useStore(
    (state) => state.setDefaultSystemMessage
  );

  const [_systemMessage, _setSystemMessage] = useState<string>(
    useStore.getState().defaultSystemMessage
  );
  const [_model, _setModel] = useState<ModelOptions>(config.model);
  const [_maxToken, _setMaxToken] = useState<number>(config.max_completion_tokens);
  const [_temperature, _setTemperature] = useState<number>(config.temperature);
  const [_topP, _setTopP] = useState<number>(config.top_p);
  const [_presencePenalty, _setPresencePenalty] = useState<number>(
    config.presence_penalty
  );
  const [_frequencyPenalty, _setFrequencyPenalty] = useState<number>(
    config.frequency_penalty
  );
  const [_provider, _setProvider] = useState<ProviderOptions>(config.provider);
  // Lock API endpoint to 'chat_completions' for legacy chat
  const [_apiEndpoint] = useState<ApiEndpointOptions>('chat_completions');

  const { t } = useTranslation('model');

  const handleSave = () => {
    const updatedConfig: ConfigInterface = {
      ...config,
      model: _model,
      max_completion_tokens: _maxToken,
      provider: _provider,
      apiEndpoint: 'chat_completions' as ApiEndpointOptions, // Locked to chat_completions
      // Include legacy generation parameters for chat_completions
      temperature: _temperature,
      top_p: _topP,
      presence_penalty: _presencePenalty,
      frequency_penalty: _frequencyPenalty,
    };
    setDefaultChatConfig(updatedConfig);
    setDefaultSystemMessage(_systemMessage);
    setIsModalOpen(false);
  };

  const handleReset = () => {
    _setModel(_defaultChatConfig.model);
    _setMaxToken(_defaultChatConfig.max_completion_tokens);
    _setTemperature(_defaultChatConfig.temperature);
    _setTopP(_defaultChatConfig.top_p);
    _setPresencePenalty(_defaultChatConfig.presence_penalty);
    _setFrequencyPenalty(_defaultChatConfig.frequency_penalty);
    _setSystemMessage(_defaultSystemMessage);
    // Provider and API endpoint are locked, no need to reset them
  };

  return (
    <>
      {/* Provider - Read-only (disabled but visible) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Provider:
        </label>
        <div className="px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          {_provider}
        </div>
      </div>
      
      {/* API Endpoint - Read-only (locked to chat_completions for legacy chat) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          API Endpoint:
        </label>
        <div className="px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          Chat Completions
        </div>
      </div>
      
      {/* Model Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Model:
        </label>
        <ModelSelector _model={_model} _setModel={_setModel} _provider={_provider} _apiEndpoint={_apiEndpoint} />
      </div>
      
      <div className="mb-4">
        <DefaultSystemChat
          _systemMessage={_systemMessage}
          _setSystemMessage={_setSystemMessage}
        />
      </div>
      
      <div className="mb-4">
        <MaxTokenSlider
          _maxToken={_maxToken}
          _setMaxToken={_setMaxToken}
          _model={_model}
        />
      </div>
      
      {/* Chat Completions API Settings */}
      <TemperatureSlider
        _temperature={_temperature}
        _setTemperature={_setTemperature}
      />
      <TopPSlider _topP={_topP} _setTopP={_setTopP} />
      <PresencePenaltySlider
        _presencePenalty={_presencePenalty}
        _setPresencePenalty={_setPresencePenalty}
      />
      <FrequencyPenaltySlider
        _frequencyPenalty={_frequencyPenalty}
        _setFrequencyPenalty={_setFrequencyPenalty}
      />
      
      <div className='flex gap-3 mt-5'>
        <button
          className='btn btn-neutral cursor-pointer'
          onClick={handleReset}
        >
          {t('resetToDefault')}
        </button>
        <button
          className='btn btn-primary cursor-pointer'
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </>
  );
};

const CompletionConfigForm = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const config = useStore.getState().defaultLegacyConfig;
  const setDefaultLegacyConfig = useStore((state) => state.setDefaultLegacyConfig);

  const [_model, _setModel] = useState<LegacyModels>(config.model as LegacyModels);
  const [_maxToken, _setMaxToken] = useState<number>(config.max_tokens || 100);
  const [_temperature, _setTemperature] = useState<number>(config.temperature ?? 1);
  const [_topP, _setTopP] = useState<number>(config.top_p ?? 1);
  const [_presencePenalty, _setPresencePenalty] = useState<number>(
    config.presence_penalty ?? 0
  );
  const [_frequencyPenalty, _setFrequencyPenalty] = useState<number>(
    config.frequency_penalty ?? 0
  );
  const [_provider, _setProvider] = useState<ProviderOptions>(config.provider);
  const [_apiEndpoint, _setApiEndpoint] = useState<ApiEndpointOptions>(config.apiEndpoint);

  const { t } = useTranslation('model');

  const handleSave = () => {
    setDefaultLegacyConfig({
      ...config,
      model: _model,
      max_tokens: _maxToken,
      temperature: _temperature,
      top_p: _topP,
      presence_penalty: _presencePenalty,
      frequency_penalty: _frequencyPenalty,
      provider: _provider,
      apiEndpoint: _apiEndpoint,
    });
    setIsModalOpen(false);
  };

  const handleReset = () => {
    _setModel(_defaultLegacyConfig.model as LegacyModels);
    _setMaxToken(_defaultLegacyConfig.max_tokens || 100);
    _setTemperature(_defaultLegacyConfig.temperature ?? 1);
    _setTopP(_defaultLegacyConfig.top_p ?? 1);
    _setPresencePenalty(_defaultLegacyConfig.presence_penalty ?? 0);
    _setFrequencyPenalty(_defaultLegacyConfig.frequency_penalty ?? 0);
    _setProvider(_defaultLegacyConfig.provider);
    _setApiEndpoint(_defaultLegacyConfig.apiEndpoint);
  };

  return (
    <>
      {/* Provider - Read-only (disabled but visible) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Provider:
        </label>
        <div className="px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          {_provider}
        </div>
      </div>
      
      {/* API Endpoint - Read-only (disabled but visible) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          API Endpoint:
        </label>
        <div className="px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          {_apiEndpoint === 'completions' ? 'Completions (Legacy)' : _apiEndpoint}
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Model
        </label>
        <select
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          value={_model}
          onChange={(e) => _setModel(e.target.value as LegacyModels)}
        >
          {legacyCompletionModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
          Max Tokens: {_maxToken}
        </label>
        <input
          type="range"
          value={_maxToken}
          onChange={(e) => _setMaxToken(Number(e.target.value))}
          min={1}
          max={4096}
          step={1}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
      
      <TemperatureSlider
        _temperature={_temperature}
        _setTemperature={_setTemperature}
      />
      <TopPSlider _topP={_topP} _setTopP={_setTopP} />
      <PresencePenaltySlider
        _presencePenalty={_presencePenalty}
        _setPresencePenalty={_setPresencePenalty}
      />
      <FrequencyPenaltySlider
        _frequencyPenalty={_frequencyPenalty}
        _setFrequencyPenalty={_setFrequencyPenalty}
      />
      <div className='flex gap-3 mt-5'>
        <button
          className='btn btn-neutral cursor-pointer'
          onClick={handleReset}
        >
          {t('resetToDefault')}
        </button>
        <button
          className='btn btn-primary cursor-pointer'
          onClick={handleSave}
        >
          Save
        </button>
      </div>
    </>
  );
};

const DefaultSystemChat = ({
  _systemMessage,
  _setSystemMessage,
}: {
  _systemMessage: string;
  _setSystemMessage: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const { t } = useTranslation('model');

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    e.target.style.maxHeight = `${e.target.scrollHeight}px`;
  };

  const handleOnFocus = (e: React.FocusEvent<HTMLTextAreaElement, Element>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    e.target.style.maxHeight = `${e.target.scrollHeight}px`;
  };

  const handleOnBlur = (e: React.FocusEvent<HTMLTextAreaElement, Element>) => {
    e.target.style.height = 'auto';
    e.target.style.maxHeight = '2.5rem';
  };

  return (
    <div>
      <div className='block text-sm font-medium text-gray-900 dark:text-white'>
        {t('defaultSystemMessage')}
      </div>
      <textarea
        className='my-2 mx-0 px-2 resize-none rounded-lg bg-transparent overflow-y-hidden leading-7 p-1 border border-gray-400/50 focus:ring-1 focus:ring-blue w-full max-h-10 transition-all'
        onFocus={handleOnFocus}
        onBlur={handleOnBlur}
        onChange={(e) => {
          _setSystemMessage(e.target.value);
        }}
        onInput={handleInput}
        value={_systemMessage}
        rows={1}
      ></textarea>
    </div>
  );
};

export default Config;
