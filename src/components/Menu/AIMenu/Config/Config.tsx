import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import { ConfigInterface, ModelOptions } from '@type/document';
import { modelMaxToken, completionModels, modelOptions } from '@constants/chat';
import { max } from 'lodash';
import { PromptDropdownItem } from '@type/prompt';
import { ApiEndpointOptions } from '@type/document';
import { ProviderOptions } from '@type/document';
import { DocumentCurrent } from '@type/document';
import { providerDefault } from '@constants/chat';
import { apiEndpointDefault } from '@constants/chat';
import { ModelSelector, MaxTokenSlider, TemperatureSlider, TopPSlider, FrequencyPenaltySlider, PresencePenaltySlider, ApiEndpointSelector, ProviderSelector } from '@components/Configuration/sliders';
 
const ConfigMenu = () => {
  const { t } = useTranslation('model');

  const documentCurrent = useStore((state) => state.documentCurrent);
  const setDocumentCurrent = useStore((state) => state.setDocumentCurrent);

  // use local _config state object
  const [_config, _setConfig] = useState<DocumentCurrent>(documentCurrent);

  // Update global store only when _config changes (whole object)
  useEffect(() => {
    setDocumentCurrent(_config);
  }, [_config, setDocumentCurrent]);

  // update individual config fields helper
  const updateConfigField = (key: string, value: any) => {
    _setConfig((prevConfig) => {
      if (!prevConfig.config) {
        return prevConfig;
      }
      return {
        ...prevConfig,
        config: {
          ...prevConfig.config,
          [key]: value,
        },
      };
    });
  };

  function updateProviderDefault(provider: any) {
    let defaults = providerDefault.find((item) => item.provider === provider);
    updateConfigField('apiEndpoint', defaults?.apiEndpoint);
    updateConfigField('model', defaults?.model);
    console.log(defaults, " defaults");
  }
  
  function updateApiEndpointDefault(apiEndpoint: any) {
    let defaults = apiEndpointDefault.find((item) => item.apiEndpoint === apiEndpoint);
    updateConfigField('model', defaults?.model);
    console.log(defaults, " defaultsz");
  }

  return (
    <div className='h-full overflow-scroll'>
      <div className='text-gray-200 text-sm p-3 border border-white/10 mb-2'>
        <div className='border border-transparent'>Chat Config (Local)</div>
      </div>

      <div className='p-2'>
        {_config.config && (
          <>
            <ProviderSelector
              _provider={_config.config.provider}
              _setProvider={((provider: ProviderOptions | ((prev: ProviderOptions) => ProviderOptions)) => {
                const value = typeof provider === 'function' ? provider(_config.config!.provider) : provider;
                updateConfigField('provider', value);
                updateProviderDefault(value);
              }) as React.Dispatch<React.SetStateAction<ProviderOptions>>}
            />

            <ApiEndpointSelector
              _apiEndpoint={_config.config.apiEndpoint}
              _setApiEndpoint={((endpoint: ApiEndpointOptions | ((prev: ApiEndpointOptions) => ApiEndpointOptions)) => {
                const value = typeof endpoint === 'function' ? endpoint(_config.config!.apiEndpoint) : endpoint;
                updateConfigField('apiEndpoint', value);
                updateApiEndpointDefault(value);
              }) as React.Dispatch<React.SetStateAction<ApiEndpointOptions>>}
            />

            <ModelSelector
              _model={_config.config.model as ModelOptions}
              _setModel={((model: ModelOptions | ((prev: ModelOptions) => ModelOptions)) => {
                const value = typeof model === 'function' ? model(_config.config!.model as ModelOptions) : model;
                updateConfigField('model', value);
              }) as React.Dispatch<React.SetStateAction<ModelOptions>>}
              _provider={_config.config.provider}
              _apiEndpoint={_config.config.apiEndpoint}
            />

            <MaxTokenSlider
              _maxToken={('max_completion_tokens' in _config.config ? _config.config.max_completion_tokens : undefined) ?? 0}
              _setMaxToken={((tokens: number | ((prev: number) => number)) => {
                const value = typeof tokens === 'function' ? tokens(('max_completion_tokens' in _config.config! ? _config.config!.max_completion_tokens : undefined) ?? 0) : tokens;
                updateConfigField('max_completion_tokens', value);
              }) as React.Dispatch<React.SetStateAction<number>>}
              _model={_config.config.model as ModelOptions}
            />

            <TemperatureSlider
              _temperature={_config.config.temperature ?? 0}
              _setTemperature={((temperature: number | ((prev: number) => number)) => {
                const value = typeof temperature === 'function' ? temperature(_config.config!.temperature ?? 0) : temperature;
                updateConfigField('temperature', value);
              }) as React.Dispatch<React.SetStateAction<number>>}
            />

            <TopPSlider
              _topP={_config.config.top_p ?? 0}
              _setTopP={((top_p: number | ((prev: number) => number)) => {
                const value = typeof top_p === 'function' ? top_p(_config.config!.top_p ?? 0) : top_p;
                updateConfigField('top_p', value);
              }) as React.Dispatch<React.SetStateAction<number>>}
            />

            <PresencePenaltySlider
              _presencePenalty={_config.config.presence_penalty ?? 0}
              _setPresencePenalty={((presence_penalty: number | ((prev: number) => number)) => {
                const value = typeof presence_penalty === 'function' ? presence_penalty(_config.config!.presence_penalty ?? 0) : presence_penalty;
                updateConfigField('presence_penalty', value);
              }) as React.Dispatch<React.SetStateAction<number>>}
            />

            <FrequencyPenaltySlider
              _frequencyPenalty={_config.config.frequency_penalty ?? 0}
              _setFrequencyPenalty={((frequency_penalty: number | ((prev: number) => number)) => {
                const value = typeof frequency_penalty === 'function' ? frequency_penalty(_config.config!.frequency_penalty ?? 0) : frequency_penalty;
                updateConfigField('frequency_penalty', value);
              }) as React.Dispatch<React.SetStateAction<number>>}
            />
          </>
        )}
      </div>
    </div>
  );
};

// export const ModelSelector = ({
//   _model,
//   _setModel,
//   _provider,
//   _apiEndpoint

// }: {
//   _model: ModelOptions;
//   _setModel: React.Dispatch<React.SetStateAction<ModelOptions>>;
//   _provider: ProviderOptions;
//   _apiEndpoint: ApiEndpointOptions;
// }) => {
//   const [dropDown, setDropDown] = useState<boolean>(false);
//   const fineTuneModels = useStore((state) => state.fineTuneModels);
  
  
//   const [defaultAndFindTuneModels, setDefaultAndFineTuneModels] = useState<PromptDropdownItem[]>([]);



//   // Set defaultAndFineTuneModels to include both the model options and the fine tune options (the fine tune options are stored in the store)

//   useEffect(() => {
//     let tempModels = [];
    





//     // Iterate over models in modelOptions and turn each string into an object with it's value as both the name and model
//     for (let i = 0; i < completionModels.length; i++) {
//       tempModels.push({ name: completionModels[i], model: completionModels[i] });
//     }

//     if (fineTuneModels) {
//       // Add the fine tune models to the tempModels array
//       tempModels = [...tempModels, ...fineTuneModels];
//     }
//     setDefaultAndFineTuneModels(tempModels);
//   }
//   , [fineTuneModels]);

//   const getModelName = (modelValue: string) => {
//     const modelObj = defaultAndFindTuneModels.find(m => m.model === modelValue);
//     return modelObj ? modelObj.name : modelValue;
//   };

//   return (
//     <div className='mb-4'>
//       <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
//         Model:
//       </label>
//       <button
//         className='btn btn-neutral btn-small flex gap-1'
//         type='button'
//         onClick={() => setDropDown((prev) => !prev)}
//       >
//         {getModelName(_model)}
//       </button>
//       <div
//         id='dropdown'
//         className={`${
//           dropDown ? '' : 'hidden'
//         } absolute top-100 bottom-100 z-10 bg-white rounded-lg shadow-xl border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group dark:bg-gray-800 opacity-90`}
//       >
//         <ul
//           className='text-sm text-gray-700 dark:text-gray-200 p-0 m-0'
//           aria-labelledby='dropdownDefaultButton'
//         > 
//           {defaultAndFindTuneModels.map((model, index) => (
//             <li
//               className='px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white cursor-pointer'
//               onClick={() => {
//                 _setModel(model.model);
//                 setDropDown(false);
//               }}
//               key={index}
//             >
//               {model.name}
//             </li>
//           ))}
//         </ul>
//       </div>
//     </div>
//   );
// };

// export const ModelSelector = ({
//   _model,
//   _setModel,
//   _provider,
//   _apiEndpoint
//   }: ModelSelectorProps) => {
//   const [dropDown, setDropDown] = useState<boolean>(false);
  
//   // Fetched from store
//   const fineTuneModels = useStore((state) => state.fineTuneModels);
  
//   // Merged models array
//   const [defaultAndFineTuneModels, setDefaultAndFineTuneModels] =
//   useState<PromptDropdownItem[]>([]);
  
//   useEffect(() => {
//   let tempModels: PromptDropdownItem[] = [];
  
//   // 1) Find the matching provider & endpoint in modelOptions
//   const matching = modelOptions.find(
//     (option) =>
//       option.provider === _provider && option.apiEndpoint === _apiEndpoint
//   );
  
//   // 2) Convert matching.models into the shape PromptDropdownItem[] if found
//   if (matching && matching.models?.length) {
//     tempModels = matching.models.map((modelStr) => ({
//       name: modelStr,
//       model: modelStr,
//     }));
//   }
  
//   // 3) Append any fine-tune models from your store
//   if (fineTuneModels?.length) {
//     tempModels = [...tempModels, ...fineTuneModels];
//   }
  
//   // 4) Set local state
//   setDefaultAndFineTuneModels(tempModels);
//   }, [_provider, _apiEndpoint, fineTuneModels]);
  
//   // Helper to get the display name
//   const getModelName = (modelValue: string) => {
//   const modelObj = defaultAndFineTuneModels.find(
//   (m) => m.model === modelValue
//   );
//   return modelObj ? modelObj.name : modelValue;
//   };
  
//   return (
//   <div className="mb-4">
//   <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
//   Model:
//   </label>
//   <button
//   className="btn btn-neutral btn-small flex gap-1"
//   type="button"
//   onClick={() => setDropDown((prev) => !prev)}
//   >
//   {getModelName(_model)}
//   </button>
//   <div
//   id="dropdown"
//   className={`${           dropDown ? '' : 'hidden'         } absolute top-100 bottom-100 z-10 bg-white rounded-lg shadow-xl border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group dark:bg-gray-800 opacity-90`}
//   >
//   <ul
//          className="text-sm text-gray-700 dark:text-gray-200 p-0 m-0"
//          aria-labelledby="dropdownDefaultButton"
//        >
//   {defaultAndFineTuneModels.map((model, index) => (
//   <li
//   className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white cursor-pointer"
//   onClick={() => {
//   _setModel(model.model);
//   setDropDown(false);
//   }}
//   key={index}
//   >
//   {model.name}
//   </li>
//   ))}
//   </ul>
//   </div>
//   </div>
//   );
//   };


// // export const MaxTokenSlider = ({
// //   _maxToken,
// //   _setMaxToken,
// //   _model,
// // }: {
// //   _maxToken: number;
// //   _setMaxToken: React.Dispatch<React.SetStateAction<number>>;
// //   _model: ModelOptions;
// // }) => {
// //   const { t } = useTranslation('model');
// //   const inputRef = useRef<HTMLInputElement>(null);

// //   useEffect(() => {
// //     inputRef &&
// //       inputRef.current &&
// //       _setMaxToken(Number(inputRef.current.value));
// //   }, [_model]);

// //   return (
// //     <div className=' border-t border-gray-500 mt-5 pt-5'>
// //       <label className='block text-sm font-medium text-gray-900 dark:text-white'>
// //         {t('token.label')}: {_maxToken}
// //       </label>
// //       <input
// //         type='range'
// //         ref={inputRef}
// //         value={_maxToken}
// //         onChange={(e) => {
// //           _setMaxToken(Number(e.target.value));
// //         }}
// //         min={0}
// //         max={_model.includes(":") ? modelMaxToken[_model.split(':')[1]] : modelMaxToken[_model]}
// //         step={1}
// //         className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
// //       />
// //       <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
// //         {t('token.description')}
// //       </div>
// //     </div>
// //   );
// // };

// export const TemperatureSlider = ({
//   _temperature,
//   _setTemperature,
// }: {
//   _temperature: number;
//   _setTemperature: React.Dispatch<React.SetStateAction<number>>;
// }) => {
//   const { t } = useTranslation('model');

//   return (
//     <div className='mt-5 pt-5 border-t border-gray-500'>
//       <label className='block text-sm font-medium text-gray-900 dark:text-white'>
//         {t('temperature.label')}: {_temperature}
//       </label>
//       <input
//         id='default-range'
//         type='range'
//         value={_temperature}
//         onChange={(e) => {
//           _setTemperature(Number(e.target.value));
//         }}
//         min={0}
//         max={2}
//         step={0.1}
//         className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
//       />
//       <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('temperature.description')}
//       </div>
//     </div>
//   );
// };

// export const TopPSlider = ({
//   _topP,
//   _setTopP,
// }: {
//   _topP: number;
//   _setTopP: React.Dispatch<React.SetStateAction<number>>;
// }) => {
//   const { t } = useTranslation('model');

//   return (
//     <div className='mt-5 pt-5 border-t border-gray-500'>
//       <label className='block text-sm font-medium text-gray-900 dark:text-white'>
//         {t('topP.label')}: {_topP}
//       </label>
//       <input
//         id='default-range'
//         type='range'
//         value={_topP}
//         onChange={(e) => {
//           _setTopP(Number(e.target.value));
//         }}
//         min={0}
//         max={1}
//         step={0.05}
//         className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
//       />
//       <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('topP.description')}
//       </div>
//     </div>
//   );
// };

// export const PresencePenaltySlider = ({
//   _presencePenalty,
//   _setPresencePenalty,
// }: {
//   _presencePenalty: number;
//   _setPresencePenalty: React.Dispatch<React.SetStateAction<number>>;
// }) => {
//   const { t } = useTranslation('model');

//   return (
//     <div className='mt-5 pt-5 border-t border-gray-500'>
//       <label className='block text-sm font-medium text-gray-900 dark:text-white'>
//         {t('presencePenalty.label')}: {_presencePenalty}
//       </label>
//       <input
//         id='default-range'
//         type='range'
//         value={_presencePenalty}
//         onChange={(e) => {
//           _setPresencePenalty(Number(e.target.value));
//         }}
//         min={-2}
//         max={2}
//         step={0.1}
//         className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
//       />
//       <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('presencePenalty.description')}
//       </div>
//     </div>
//   );
// };

// export const FrequencyPenaltySlider = ({
//   _frequencyPenalty,
//   _setFrequencyPenalty,
// }: {
//   _frequencyPenalty: number;
//   _setFrequencyPenalty: React.Dispatch<React.SetStateAction<number>>;
// }) => {
//   const { t } = useTranslation('model');

//   return (
//     <div className='mt-5 pt-5 border-t border-gray-500'>
//       <label className='block text-sm font-medium text-gray-900 dark:text-white'>
//         {t('frequencyPenalty.label')}: {_frequencyPenalty}
//       </label>
//       <input
//         id='default-range'
//         type='range'
//         value={_frequencyPenalty}
//         onChange={(e) => {
//           _setFrequencyPenalty(Number(e.target.value));
//         }}
//         min={-2}
//         max={2}
//         step={0.1}
//         className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
//       />
//       <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('frequencyPenalty.description')}
//       </div>
//     </div>
//   );
// };

export default ConfigMenu;
