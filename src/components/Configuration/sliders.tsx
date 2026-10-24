import React, { useEffect, useId, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfigInterface, ModelOptions, ModelMetadata, ApiEndpointOptions, ProviderOptions, LegacyModels } from '@type/document';
import { ChevronDown } from '@carbon/icons-react';
import { modelMaxToken, completionModels } from '@constants/chat';
import { apiEndpointOptions } from '@constants/chat';
import { providerOptions, providerDefault, modelOptions } from '@constants/chat';
import { apiEndpointDefault } from '@constants/chat';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import { catalogAvailable, modelApis, type ModelApi } from '@utils/provider-connections';


export const ModelSelector = ({ _model, _setModel, _provider, _apiEndpoint, _connectionId, _setConnectionId, _showModelLabel = false }: {
  _model: ModelOptions; _setModel: React.Dispatch<React.SetStateAction<ModelOptions>>;
  _provider: ProviderOptions; _apiEndpoint: ApiEndpointOptions;
  _connectionId?: string; _setConnectionId?: React.Dispatch<React.SetStateAction<string | undefined>>;
  _showModelLabel?: boolean;
}) => {
  const modelId = useId();
  const connections = useConnections(state => state.connections);
  const active = useConnections(state => state.activeConnectionId);
  const connectionId = _connectionId ?? active ?? '';
  const connection = connections.find(item => item.id === connectionId);
  const models = connection && catalogAvailable(connection) ? connection.models.filter(model => modelApis(connection, model.id).includes(_apiEndpoint as ModelApi)) : [];
  const available = models.some(model => model.id === _model);
  return <div className="space-y-2">
    {_setConnectionId && <label className="block text-xs">API connection
      <select aria-label="API connection" className="w-full mt-1 p-2 border rounded bg-transparent" value={connectionId} onChange={event => { _setConnectionId(event.target.value || undefined); _setModel(''); }}>
        <option value="">Choose a connection</option>{connectionId && !connection && <option value={connectionId}>Saved connection unavailable</option>}{connections.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>}
    {_showModelLabel && <label htmlFor={modelId}>Model</label>}
    <select id={modelId} aria-label="Model" className="w-full p-2 border rounded bg-transparent" value={_model} disabled={!models.length} onChange={event => {
      _setModel(event.target.value); if (connectionId) _setConnectionId?.(connectionId);
    }}>
      <option value="">{models.length ? 'Choose a model' : 'No models available'}</option>
      {_model && !available && <option value={_model} disabled>{_model} — unavailable</option>}
      {models.map(model => <option value={model.id} key={model.id}>{model.id}</option>)}
    </select>
    {!models.length && <p className="text-xs opacity-70">Open Search → Manage API keys to load Responses models.</p>}
  </div>;
};

export const MaxTokenSlider = ({
  _maxToken,
  _setMaxToken,
  _model,
  _label,
  _provider,
  _apiEndpoint,
  _connectionId,
}: {
  _maxToken: number;
  _setMaxToken: React.Dispatch<React.SetStateAction<number>>;
  _model: ModelOptions;
  _label?: string;
  _provider?: ProviderOptions;
  _apiEndpoint?: ApiEndpointOptions;
  _connectionId?: string;
}) => {
  const { t } = useTranslation('model');
  const inputRef = useRef<HTMLInputElement>(null);
  const connections = useConnections(state => state.connections);
  const active = useConnections(state => state.activeConnectionId);
  const connection = connections.find(item => item.id === (_connectionId ?? active));
  const metadata = connection?.models.find(model => model.id === _model);
  const actualMaxTokens = metadata?.max_output_tokens ?? metadata?.max_completion_tokens ?? null;
  const useSlider = typeof actualMaxTokens === 'number' && actualMaxTokens > 0;

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

export const ApiEndpointSelector = ({ _apiEndpoint, _setApiEndpoint }: {
  _apiEndpoint: ApiEndpointOptions;
  _setApiEndpoint: React.Dispatch<React.SetStateAction<ApiEndpointOptions>>;
}) => <div className="mb-4 text-sm">
  <p>API: Responses</p>
  {_apiEndpoint !== 'responses' && <div role="status">
    <p>This saved configuration uses a retired API in fthr. Choose a Responses model to continue.</p>
    <button type="button" className="btn btn-neutral" onClick={() => _setApiEndpoint('responses')}>Use Responses</button>
  </div>}
</div>;

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
