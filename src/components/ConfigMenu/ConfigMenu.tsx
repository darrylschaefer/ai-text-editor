import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PopupModal from '@components/PopupModal';
import { ConfigInterface, ModelOptions } from '@type/document';
import { ChevronDown } from '@carbon/icons-react';
import { modelMaxToken, completionModels } from '@constants/chat';
import { apiEndpointOptions } from '@constants/chat';
import { ApiEndpointOptions } from '@type/document';
import { providerOptions } from '@constants/chat';
import { ProviderOptions } from '@type/document';
import { ModelSelector, MaxTokenSlider, TemperatureSlider, TopPSlider, PresencePenaltySlider, FrequencyPenaltySlider, ApiEndpointSelector, ProviderSelector } from '@components/Configuration/sliders';

const ConfigMenu = ({
  setIsModalOpen,
  config,
  setConfig,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  config: ConfigInterface;
  setConfig: (config: ConfigInterface) => void;
}) => {
  const [_provider, _setProvider] = useState<ProviderOptions>(config.provider);
  const [_apiEndpoint, _setApiEndpoint] = useState<ApiEndpointOptions>(config.apiEndpoint);
  const [_maxToken, _setMaxToken] = useState<number>(config.max_completion_tokens);
  const [_model, _setModel] = useState<ModelOptions>(config.model);
  const [_temperature, _setTemperature] = useState<number>(config.temperature);
  const [_presencePenalty, _setPresencePenalty] = useState<number>(
    config.presence_penalty
  );
  const [_topP, _setTopP] = useState<number>(config.top_p);
  const [_frequencyPenalty, _setFrequencyPenalty] = useState<number>(
    config.frequency_penalty
  );
  const { t } = useTranslation('model');

  const handleConfirm = () => {
    setConfig({
      ...config,
      max_completion_tokens: _maxToken,
      model: _model,
      temperature: _temperature,
      presence_penalty: _presencePenalty,
      top_p: _topP,
      frequency_penalty: _frequencyPenalty,
      provider: _provider,
      apiEndpoint: _apiEndpoint,
    });
    setIsModalOpen(false);
  };

  return (
    <PopupModal
      title={t('configuration') as string}
      setIsModalOpen={setIsModalOpen}
      handleConfirm={handleConfirm}
      handleClickBackdrop={handleConfirm}
      fullWidth={true}
    >
      <div className='p-6 border-b border-gray-200 dark:border-gray-800/30'>
      <ProviderSelector _provider={_provider} _setProvider={_setProvider} />
      <ApiEndpointSelector _apiEndpoint={_apiEndpoint} _setApiEndpoint={_setApiEndpoint} />
        <ModelSelector _model={_model} _setModel={_setModel} _provider={_provider} _apiEndpoint={_apiEndpoint} />
        <MaxTokenSlider
          _maxToken={_maxToken}
          _setMaxToken={_setMaxToken}
          _model={_model}
        />
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
      </div>
    </PopupModal>
  );
};


export default ConfigMenu;
