import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfigInterface, ModelOptions, ModelMetadata } from '@type/document';
import { ChevronDown } from '@carbon/icons-react';
import { modelMaxToken, completionModels } from '@constants/chat';
import { apiEndpointOptions } from '@constants/chat';
import { ApiEndpointOptions } from '@type/document';
import { providerOptions, providerDefault, modelOptions } from '@constants/chat';
import { ProviderOptions, ApiEndpointOptions } from '@type/document';
import { apiEndpointDefault } from '@constants/chat';
import useStore from '@store/store';


export const ModelSelector = ({
  _model,
  _setModel,
  _provider,
  _apiEndpoint,
}: {
  _model: ModelOptions;
  _setModel: React.Dispatch<React.SetStateAction<ModelOptions>>;
  _provider: ProviderOptions;
  _apiEndpoint: ApiEndpointOptions;
}) => {
  const [dropDown, setDropDown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchedModels = useStore((state) => state.fetchedModels);

  /* Merge constant models with fetched models for the currently
     selected provider + endpoint. Falls back to [] if none found. */
  const availableModels = useMemo(() => {
    // Get constant models
    const constantModels = modelOptions.find(
      (o) => o.provider === _provider && o.apiEndpoint === _apiEndpoint,
    )?.models ?? [];
    
    // Get fetched models for the same provider/endpoint
    const fetchedModelsForEndpoint = fetchedModels.find(
      (o) => o.provider === _provider && o.apiEndpoint === _apiEndpoint,
    )?.models ?? [];
    
    // Extract model IDs from fetched models (they might be ModelMetadata objects)
    const fetchedModelIds = fetchedModelsForEndpoint.map((model: any) => 
      typeof model === 'string' ? model : (model as ModelMetadata).id
    );
    
    // Merge and deduplicate (fetched models take precedence)
    const modelSet = new Set([...constantModels, ...fetchedModelIds]);
    return Array.from(modelSet) as ModelOptions[];
  }, [_provider, _apiEndpoint, fetchedModels]);
  
  // Get model metadata map for the current endpoint
  const modelMetadataMap = useMemo(() => {
    const fetchedModelsForEndpoint = fetchedModels.find(
      (o) => o.provider === _provider && o.apiEndpoint === _apiEndpoint,
    );
    
    if (!fetchedModelsForEndpoint) return new Map<string, ModelMetadata>();
    
    const metadataMap = new Map<string, ModelMetadata>();
    fetchedModelsForEndpoint.models.forEach((model: any) => {
      if (typeof model === 'object' && model.id) {
        metadataMap.set(model.id, model as ModelMetadata);
      }
    });
    return metadataMap;
  }, [_provider, _apiEndpoint, fetchedModels]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropDown(false);
      }
    };

    if (dropDown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropDown]);

  return (
    <div className='relative' ref={dropdownRef}>
      <button
        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
        type='button'
        onClick={() => setDropDown((prev) => !prev)}
      >
        <span className='text-sm'>{_model}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${dropDown ? 'rotate-180' : ''}`} />
      </button>

      <div
        id='dropdown'
        className={`${
          dropDown ? '' : 'hidden'
        } absolute top-full left-0 right-0 mt-1.5 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-gray-800/30 text-gray-800 dark:text-gray-100 overflow-hidden`}
      >
        <ul className='text-sm p-1 m-0 max-h-64 overflow-y-auto'>
          {availableModels.map((m) => (
            <li
              key={m}
              className={`px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150 rounded-md mx-1 ${
                _model === m ? 'bg-gray-100 dark:bg-gray-700 font-medium' : ''
              }`}
              onClick={() => {
                _setModel(m);
                setDropDown(false);
              }}
            >
              {m}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};


export const MaxTokenSlider = ({
  _maxToken,
  _setMaxToken,
  _model,
  _label,
  _provider,
  _apiEndpoint,
}: {
  _maxToken: number;
  _setMaxToken: React.Dispatch<React.SetStateAction<number>>;
  _model: ModelOptions;
  _label?: string;
  _provider?: ProviderOptions;
  _apiEndpoint?: ApiEndpointOptions;
}) => {
  const { t } = useTranslation('model');
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchedModels = useStore((state) => state.fetchedModels);

  // Get max tokens from fetched model metadata if available
  // Only use slider if we have max_output_tokens or max_completion_tokens from API
  const maxTokens = useMemo(() => {
    if (_provider && _apiEndpoint) {
      const fetchedModelsForEndpoint = fetchedModels.find(
        (o) => o.provider === _provider && o.apiEndpoint === _apiEndpoint,
      );
      
      if (fetchedModelsForEndpoint) {
        const modelMetadata = fetchedModelsForEndpoint.models.find(
          (m: any) => (typeof m === 'object' && m.id === _model) || m === _model
        ) as ModelMetadata | undefined;
        
        if (modelMetadata && typeof modelMetadata === 'object') {
          // Only use slider if we have max_output_tokens or max_completion_tokens from API
          // Don't use context_window as it's not the same as max completion tokens
          return modelMetadata.max_output_tokens || modelMetadata.max_completion_tokens || null;
        }
      }
    }
    // Don't fall back to constants for fetched models - use input field instead
    return null;
  }, [_model, _provider, _apiEndpoint, fetchedModels]);

  // Check if we have max completion tokens from API metadata
  const hasMaxTokensFromApi = maxTokens !== null && maxTokens !== undefined;
  
  // For non-fetched models, check if we have constant max tokens
  const hasConstantMaxTokens = modelMaxToken[_model] !== undefined;
  
  // Use slider only if we have max tokens from API OR we have constant max tokens and no fetched models
  const useSlider = hasMaxTokensFromApi || (hasConstantMaxTokens && (!_provider || !_apiEndpoint || fetchedModels.length === 0));
  
  // Get the actual max value to use (from API or constant)
  const actualMaxTokens = hasMaxTokensFromApi ? maxTokens : (hasConstantMaxTokens ? modelMaxToken[_model] : null);

  useEffect(() => {
    // Only auto-update if we have a valid max tokens value and using slider
    if (useSlider && actualMaxTokens && inputRef && inputRef.current) {
      _setMaxToken(Math.min(_maxToken, actualMaxTokens));
    }
  }, [_model, actualMaxTokens, useSlider]);

  const label = _label || t('token.label');

  return (
    <div>
      <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
        {label}
      </label>
      {useSlider && actualMaxTokens ? (
        // Use slider if we have max tokens from API metadata or constants
        <>
          <div className='mb-1 text-sm text-gray-600 dark:text-gray-400'>
            {_maxToken} / {actualMaxTokens}
          </div>
          <input
            type='range'
            ref={inputRef}
            value={_maxToken}
            onChange={(e) => {
              _setMaxToken(Number(e.target.value));
            }}
            min={0}
            max={actualMaxTokens}
            step={1}
            className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700'
          />
        </>
      ) : (
        // Use text input if we don't have max tokens from API
        <input
          type='number'
          value={_maxToken}
          onChange={(e) => {
            const value = Number(e.target.value);
            if (!isNaN(value) && value >= 0) {
              _setMaxToken(value);
            }
          }}
          min={0}
          placeholder='Enter max completion tokens'
          className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      )}
      {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
        {t('token.description')}
      </div> */}
    </div>
  );
};

export const TemperatureSlider = ({
  _temperature,
  _setTemperature,
}: {
  _temperature: number;
  _setTemperature: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const { t } = useTranslation('model');

  return (
    <div className='mt-5 pt-5 border-t border-gray-500'>
      <label className='block text-sm font-medium text-gray-900 dark:text-white'>
        {t('temperature.label')}: {_temperature}
      </label>
      <input
        id='default-range'
        type='range'
        value={_temperature}
        onChange={(e) => {
          _setTemperature(Number(e.target.value));
        }}
        min={0}
        max={2}
        step={0.1}
        className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
      />
      {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
        {t('temperature.description')}
      </div> */}
    </div>
  );
};

export const TopPSlider = ({
  _topP,
  _setTopP,
}: {
  _topP: number;
  _setTopP: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const { t } = useTranslation('model');

  return (
    <div className='mt-5 pt-5 border-t border-gray-500'>
      <label className='block text-sm font-medium text-gray-900 dark:text-white'>
        {t('topP.label')}: {_topP}
      </label>
      <input
        id='default-range'
        type='range'
        value={_topP}
        onChange={(e) => {
          _setTopP(Number(e.target.value));
        }}
        min={0}
        max={1}
        step={0.05}
        className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
      />
      {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
        {t('topP.description')}
      </div> */}
    </div>
  );
};

export const PresencePenaltySlider = ({
  _presencePenalty,
  _setPresencePenalty,
}: {
  _presencePenalty: number;
  _setPresencePenalty: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const { t } = useTranslation('model');

  return (
    <div className='mt-5 pt-5 border-t border-gray-500'>
      <label className='block text-sm font-medium text-gray-900 dark:text-white'>
        {t('presencePenalty.label')}: {_presencePenalty}
      </label>
      <input
        id='default-range'
        type='range'
        value={_presencePenalty}
        onChange={(e) => {
          _setPresencePenalty(Number(e.target.value));
        }}
        min={-2}
        max={2}
        step={0.1}
        className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
      />
      {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
        {t('presencePenalty.description')}
      </div> */}
    </div>
  );
};

export const FrequencyPenaltySlider = ({
  _frequencyPenalty,
  _setFrequencyPenalty,
}: {
  _frequencyPenalty: number;
  _setFrequencyPenalty: React.Dispatch<React.SetStateAction<number>>;
}) => {
  const { t } = useTranslation('model');

  return (
    <div className='mt-5 pt-5 border-t border-gray-500'>
      <label className='block text-sm font-medium text-gray-900 dark:text-white'>
        {t('frequencyPenalty.label')}: {_frequencyPenalty}
      </label>
      <input
        id='default-range'
        type='range'
        value={_frequencyPenalty}
        onChange={(e) => {
          _setFrequencyPenalty(Number(e.target.value));
        }}
        min={-2}
        max={2}
        step={0.1}
        className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
      />
      {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
        {t('frequencyPenalty.description')}
      </div> */}
    </div>
  );
};

export const ApiEndpointSelector = ({
  _apiEndpoint,
  _setApiEndpoint,
  }: {
  _apiEndpoint: ApiEndpointOptions;
  _setApiEndpoint: React.Dispatch<React.SetStateAction<ApiEndpointOptions>>;
  }) => {
  const [dropDown, setDropDown] = useState<boolean>(false);
  
  return (
  <div className="mb-4 relative">
    <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
  API Endpoint:
  </label>
  <button
  className="btn btn-neutral btn-small flex gap-1"
  type="button"
  onClick={() => setDropDown((prev) => !prev)}
  >
  {_apiEndpoint}
  <ChevronDown />
  </button>
  <div
  className={`${dropDown ? '' : 'hidden'         } absolute top-12 z-10 bg-white rounded-lg shadow-xl border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group dark:bg-gray-800 opacity-90`}
  >
  <ul className="text-sm text-gray-700 dark:text-gray-200 p-0 m-0">
  {apiEndpointOptions.map((endpoint) => (
  <li
  key={endpoint}
  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white cursor-pointer"
  onClick={() => {
  _setApiEndpoint(endpoint);
  setDropDown(false);
  }}
  >
  {endpoint}
  </li>
  ))}
  </ul>
  </div>
  </div>
  );
  };


  export const ProviderSelector = ({
    _provider,
    _setProvider,
    }: {
    _provider: ProviderOptions;
    _setProvider: React.Dispatch<React.SetStateAction<ProviderOptions>>;
    }) => {
    const [dropDown, setDropDown] = useState<boolean>(false);
    
    return (
    <div className="mb-4 relative">
      <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
  Provider:
  </label>
    <button
    className="btn btn-neutral btn-small flex gap-1"
    type="button"
    onClick={() => setDropDown((prev) => !prev)}
    >
    {_provider}
    <ChevronDown />
    </button>
    <div
    className={`${           dropDown ? '' : 'hidden'         } absolute top-12 z-10 bg-white rounded-lg shadow-xl border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group dark:bg-gray-800 opacity-90`}
    >
    <ul className="text-sm text-gray-700 dark:text-gray-200 p-0 m-0">
    {providerOptions.map((provider) => (
    <li
    key={provider}
    className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white cursor-pointer"
    onClick={() => {
    _setProvider(provider);
    setDropDown(false);
    }}
    >
    {provider}
    </li>
    ))}
    </ul>
    </div>
    </div>
    );
    };
