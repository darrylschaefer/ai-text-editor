import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import PopupModal from '@components/PopupModal';
import { ModelOptions } from '@type/document';
import { ChevronDown as DownChevronArrow } from '@carbon/icons-react';
import { modelMaxToken, completionModels } from '@constants/chat';
import { Settings } from '@carbon/icons-react';
import { _defaultChatConfig } from '@constants/chat';
import _ from 'lodash';
import { FineTuneModel } from '@type/config';
import { ModelSelector, MaxTokenSlider, TemperatureSlider, TopPSlider, FrequencyPenaltySlider, PresencePenaltySlider, ApiEndpointSelector, ProviderSelector } from '@components/Configuration/sliders';
import { ApiEndpointOptions, ProviderOptions } from '@type/document';
import { ReasoningEffortSelector, ReasoningEffort } from '@components/Configuration/reasoningEffort';
import { VerbositySelector, Verbosity } from '@components/Configuration/verbosity';
import { getDefaultValuesForEndpoint } from '@utils/apiParameters';
import { _defaultLegacyConfig } from '@constants/chat';
import StyledTextarea from '@components/Common/StyledTextarea';
import { toolRegistry, CANONICAL_TOOLS, LEGACY_TOOLS, getToolDefinitions } from '@api/tools/index';


export const PromptConfig = (
    {
        prompt, index, _updatePrompt, _prompts, _setPrompts
    }:
    {
        prompt: any;
        index: number;
        _updatePrompt: any;
        _prompts: any;
        _setPrompts: any;
    }
    ) => {
    const [isPromptConfigModalOpen, setIsPromptConfigModalOpen] = useState<boolean>(false);

    return (
        <>
        <div
        onClick={() => setIsPromptConfigModalOpen(true)
        }
        >
            <Settings />
            </div>
        {isPromptConfigModalOpen ? (
        <PromptPopup setIsModalOpen={setIsPromptConfigModalOpen} prompt={prompt} index={index} _prompts={_prompts} _setPrompts={_setPrompts} _updatePrompt={_updatePrompt} />
        ) : (<></>)
        }
        </>
    )
}

const PromptPopup = ({
    setIsModalOpen,
    prompt,
    index,
    _updatePrompt,
    _prompts,
    _setPrompts
}: {
    setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    prompt: any;
    index: any;
    _updatePrompt: any;
    _prompts: any;
    _setPrompts: any;
}) => {
     const prompts = useStore((state) => state.prompts);
     const setPrompts = useStore((state) => state.setPrompts);
    const [_name, _setName] = useState<any>(prompt.name);
    const [_prompt, _setPrompt] = useState<any>(prompt.prompt);

    // Determine default config type
    const defaultChatConfig = useStore((state) => state.defaultChatConfig);
    const defaultLegacyConfig = useStore((state) => state.defaultLegacyConfig);
    const agentApiEndpoint = useStore((state) => state.agentApiEndpoint);
    
    // Determine which default type is currently being used
    const getDefaultConfigType = (): 'agent' | 'legacy_chat' | 'legacy_completions' | 'custom' => {
      if (prompt.config == null) {
        return 'legacy_chat'; // Default when no config
      }
      
      const config = prompt.config;
      
      // Check if config matches agent defaults (compare key fields)
      if (config.apiEndpoint === agentApiEndpoint && 
          config.model === defaultChatConfig.model &&
          config.provider === defaultChatConfig.provider &&
          config.max_completion_tokens === defaultChatConfig.max_completion_tokens) {
        // For responses API, check reasoning_effort and verbosity
        if (agentApiEndpoint === 'responses') {
          if (config.reasoning_effort === defaultChatConfig.reasoning_effort &&
              config.verbosity === defaultChatConfig.verbosity) {
            return 'agent';
          }
        } else {
          // For chat_completions, check temperature, top_p, etc.
          if (config.temperature === defaultChatConfig.temperature &&
              config.top_p === defaultChatConfig.top_p &&
              config.presence_penalty === defaultChatConfig.presence_penalty &&
              config.frequency_penalty === defaultChatConfig.frequency_penalty) {
            return 'agent';
          }
        }
      }
      
      // Check if config matches legacy chat completions defaults
      // Legacy chat completions must use 'chat_completions' endpoint
      if (config.apiEndpoint === 'chat_completions' &&
          config.model === defaultChatConfig.model &&
          config.provider === defaultChatConfig.provider &&
          config.max_completion_tokens === defaultChatConfig.max_completion_tokens &&
          config.temperature === defaultChatConfig.temperature &&
          config.top_p === defaultChatConfig.top_p &&
          config.presence_penalty === defaultChatConfig.presence_penalty &&
          config.frequency_penalty === defaultChatConfig.frequency_penalty) {
        return 'legacy_chat';
      }
      
      // Check if config matches legacy completions defaults
      if (config.apiEndpoint === defaultLegacyConfig.apiEndpoint &&
          config.model === defaultLegacyConfig.model &&
          config.provider === defaultLegacyConfig.provider &&
          (config.max_tokens === defaultLegacyConfig.max_tokens || config.max_completion_tokens === defaultLegacyConfig.max_tokens) &&
          config.temperature === defaultLegacyConfig.temperature &&
          config.top_p === defaultLegacyConfig.top_p &&
          config.presence_penalty === defaultLegacyConfig.presence_penalty &&
          config.frequency_penalty === defaultLegacyConfig.frequency_penalty) {
        return 'legacy_completions';
      }
      
      return 'custom';
    };
    
    const [defaultConfigType, setDefaultConfigType] = useState<'agent' | 'legacy_chat' | 'legacy_completions' | 'custom'>(getDefaultConfigType());
    const isManuallyChanging = useRef(false);
    
    // Get the current API endpoint from config or default
    const currentApiEndpoint = prompt.config?.apiEndpoint || _defaultChatConfig.apiEndpoint || 'responses';


// Update default config type when prompt config changes
// But preserve the current mode if we're manually setting it (to prevent switching when changing endpoints)
useEffect(() => {
    // Skip update if we're manually changing the config type
    if (isManuallyChanging.current) {
        isManuallyChanging.current = false;
        return;
    }
    
    const newType = getDefaultConfigType();
    // If we're currently in custom mode, stay in custom mode even if config matches a default
    // This prevents switching away from custom when changing endpoints
    if (defaultConfigType === 'custom' && newType !== 'custom') {
        // Stay in custom mode - don't switch
        return;
    }
    // Otherwise, update to the new type
    setDefaultConfigType(newType);
}, [prompts, prompt.config, defaultChatConfig, defaultLegacyConfig, agentApiEndpoint, defaultConfigType])

// Convert prompt format when API endpoint changes
useEffect(() => {
  const apiEndpoint = prompt.config?.apiEndpoint || _defaultChatConfig.apiEndpoint || 'responses';
  
  // If switching to completions and prompt is an array, convert to string
  if (apiEndpoint === 'completions' && Array.isArray(_prompt)) {
    const promptString = _prompt.map((m: any) => typeof m === 'string' ? m : m.content).join('\n');
        let tempPrompts = _prompts;
    _setPrompt(promptString);
    tempPrompts[index].prompt = promptString;
    setPrompts(tempPrompts);
        _setPrompts(tempPrompts);
  }
  // If switching from completions to messages-based endpoints and prompt is a string, convert to messages array
  else if ((apiEndpoint === 'chat_completions' || apiEndpoint === 'responses') && typeof _prompt === 'string' && _prompt.trim() !== '') {
    let tempPrompts = _prompts;
    const messagesArray = [{ role: 'user', content: _prompt }];
    _setPrompt(messagesArray);
    tempPrompts[index].prompt = messagesArray;
        setPrompts(tempPrompts);
    _setPrompts(tempPrompts);
  }
}, [prompt.config?.apiEndpoint])

function handleDefaultConfigTypeChange(newType: 'agent' | 'legacy_chat' | 'legacy_completions' | 'custom') {
    // Mark that we're manually changing the config type
    isManuallyChanging.current = true;
    setDefaultConfigType(newType);
        let tempPrompts = _prompts;
    
    if (newType === 'custom') {
      // If switching to custom, keep existing config or create a new one
      if (tempPrompts[index].config == null) {
        tempPrompts[index].config = { ..._defaultChatConfig };
      }
    } else {
      // Apply the selected default config
      if (newType === 'agent') {
        tempPrompts[index].config = {
          ...defaultChatConfig,
          apiEndpoint: agentApiEndpoint as ApiEndpointOptions,
        };
      } else if (newType === 'legacy_chat') {
        // For legacy chat, ensure apiEndpoint is 'chat_completions' to distinguish from agent defaults
        tempPrompts[index].config = {
          ...defaultChatConfig,
          apiEndpoint: 'chat_completions' as ApiEndpointOptions,
        };
      } else if (newType === 'legacy_completions') {
        tempPrompts[index].config = { ...defaultLegacyConfig } as any;
      }
    }
    
    _setPrompts(tempPrompts);
    setPrompts(tempPrompts);
    }

  const handleOnFocus = (e: React.FocusEvent<HTMLTextAreaElement, Element>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    e.target.style.maxHeight = `${e.target.scrollHeight}px`;
  };

  // Removed handleOnBlur - StyledTextarea handles auto-expand internally

const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    e.target.style.maxHeight = `${e.target.scrollHeight}px`;
  };


  return (
     <PopupModal
       title={"Prompt Config"}
       setIsModalOpen={setIsModalOpen}
       fullWidth={true}
     >
     <div className='p-6 w-full max-w-full text-sm text-gray-900 dark:text-gray-300'>
        <div className='flex mb-6 flex-col space-y-6'>
            <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>Name</label>
            <input
                  type='text'
                  className='w-full px-3 py-2 rounded-md bg-transparent border border-gray-200 dark:border-gray-800/30 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all'
                   onChange={(e) => {
                    let tempPrompts = _prompts;
                    _setName(e.target.value);
                    tempPrompts[index].name = e.target.value;
                    setPrompts(tempPrompts);
                    _setPrompts(tempPrompts);
                    _updatePrompt(index, prompt);
                   }}
                  value={_name}
                  placeholder='Macro name...'
                  maxLength={32}
                />
                </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prompt</label>
                <div className='space-y-3'>
                  {/* For completions API, always show single string input */}
                  {currentApiEndpoint === 'completions' ? (
                <div className="relative w-full">
                  <StyledTextarea
                    className='w-full px-3 py-2 rounded-md bg-transparent border border-gray-200 dark:border-gray-800/30 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all resize-none'
                    onChange={(value) => {
                      let tempPrompts = _prompts;
                      _setPrompt(value);
                      tempPrompts[index].prompt = value;
                      setPrompts(tempPrompts);
                      _setPrompts(tempPrompts);
                      _updatePrompt(index, prompt);
                    }}
                    value={typeof _prompt === 'string' ? _prompt : (Array.isArray(_prompt) ? _prompt.map((m: any) => typeof m === 'string' ? m : m.content).join('\n') : '')}
                    rows={4}
                    placeholder='Enter your prompt...'
                    autoExpand={true}
                  />
                </div>
                  ) : Array.isArray(_prompt) ? (
                    <>
                      {Array.isArray(prompts[index].prompt)
                        ? prompts[index].prompt.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-800/30">
                              <select
                                className="rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-800/30 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all flex-shrink-0"
                                value={item.role || "user"}
                                onChange={e => {
                                  let updatedPrompts = [...prompts];
                                  let promptArray = [...updatedPrompts[index].prompt];
                                  promptArray[idx] = {
                                    ...promptArray[idx],
                                    role: e.target.value,
                                  };
                                  updatedPrompts[index] = {
                                    ...updatedPrompts[index],
                                    prompt: promptArray,
                                  };
                                  setPrompts(updatedPrompts);
                                  _setPrompts(updatedPrompts);
                                }}
                                style={{ minWidth: 120 }}
                              >
                                <option value="system">Developer</option>
                                <option value="assistant">Assistant</option>
                                <option value="user">User</option>
                              </select>

                              <div className="relative flex-1">
                                <StyledTextarea
                                  className="resize-none rounded-md bg-transparent border border-gray-200 dark:border-gray-800/30 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all px-3 py-2 w-full"
                                  onChange={(value) => {
                                    let updatedPrompts = [...prompts];
                                    let promptArray = [...updatedPrompts[index].prompt];
                                    promptArray[idx] = {
                                      ...promptArray[idx],
                                      content: value,
                                    };
                                    updatedPrompts[index] = {
                                      ...updatedPrompts[index],
                                      prompt: promptArray,
                                    };
                                    setPrompts(updatedPrompts);
                                    _setPrompts(updatedPrompts);
                                    _updatePrompt(index, updatedPrompts[index]);
                                  }}
                                  value={item.content}
                                  rows={3}
                                  placeholder='Enter message content...'
                                  autoExpand={true}
                                />
                              </div>

                              <button
                                type="button"
                                className="rounded-md px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => {
                                  let updatedPrompts = [...prompts];
                                  let promptArray = [...updatedPrompts[index].prompt];
                                  promptArray.splice(idx, 1);
                                  updatedPrompts[index] = {
                                    ...updatedPrompts[index],
                                    prompt:
                                      promptArray.length > 0
                                        ? promptArray
                                        : [{ role: "user", content: "" }],
                                  };
                                  setPrompts(updatedPrompts);
                                  _setPrompts(updatedPrompts);
                                }}
                                disabled={prompts[index].prompt.length <= 1}
                                aria-label="Remove prompt"
                                title={
                                  prompts[index].prompt.length <= 1
                                    ? "Can't remove the last prompt"
                                    : "Remove prompt"
                                }
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        : (
                          <>
                            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-800/30">
                              <div className="flex gap-2 w-full">
                                <select
                                  className="rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-800/30 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all flex-shrink-0"
                                  value="user"
                                  disabled
                                  style={{ minWidth: 120 }}
                                >
                                  <option value="user">User</option>
                                </select>
                                <div className="relative flex-1">
                                  <StyledTextarea
                                    className="resize-none rounded-md bg-transparent border border-gray-200 dark:border-gray-800/30 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all px-3 py-2 w-full"
                                    onChange={(value) => {
                                      let updatedPrompts = [...prompts];
                                      _setPrompt(value);
                                      updatedPrompts[index].prompt = value;
                                      setPrompts(updatedPrompts);
                                      _setPrompts(updatedPrompts);
                                      _updatePrompt(index, updatedPrompts[index]);
                                    }}
                                    value={prompts[index].prompt}
                                    rows={3}
                                    placeholder='Enter message content...'
                                    autoExpand={true}
                                  />
                                </div>
                              </div>
                            </div>
                            {currentApiEndpoint !== 'completions' && (
                              <button
                                type="button"
                                className="mt-2 rounded-md px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors"
                                onClick={() => {
                                  let updatedPrompts = [...prompts];
                                  updatedPrompts[index] = {
                                    ...updatedPrompts[index],
                                    prompt: [
                                      { content: prompts[index].prompt, role: "user" },
                                      { content: "", role: "user" },
                                    ],
                                  };
                                  setPrompts(updatedPrompts);
                                  _setPrompts(updatedPrompts);
                                }}
                              >
                                + Convert to prompt list
                              </button>
                            )}
                          </>
                        )}

                      {/* Add new row for prompt list - only show for messages-based endpoints */}
                      {Array.isArray(prompts[index].prompt) && currentApiEndpoint !== 'completions' && (
                        <button
                          type="button"
                          className="mt-2 rounded-md px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors"
                          onClick={() => {
                            let updatedPrompts = [...prompts];
                            let promptArray = [...updatedPrompts[index].prompt];
                            promptArray.push({ content: "", role: "user" });
                            updatedPrompts[index] = {
                              ...updatedPrompts[index],
                              prompt: promptArray,
                            };
                            setPrompts(updatedPrompts);
                            _setPrompts(updatedPrompts);
                          }}
                        >
                          + Add new message
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="relative w-full">
                        <StyledTextarea
                          className="w-full px-3 py-2 rounded-md bg-transparent border border-gray-200 dark:border-gray-800/30 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all resize-none"
                          onChange={(value) => {
                            let tempPrompts = _prompts;
                            _setPrompt(value);
                            tempPrompts[index].prompt = value;
                            setPrompts(tempPrompts);
                            _setPrompts(tempPrompts);
                            _updatePrompt(index, prompt);
                          }}
                          value={_prompt}
                          rows={4}
                          placeholder='Enter your prompt...'
                          autoExpand={true}
                        />
                      </div>
                      <button
                        type="button"
                        className="mt-2 rounded-md px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors"
                        onClick={() => {
                          let updatedPrompts = [...prompts];
                          updatedPrompts[index] = {
                            ...updatedPrompts[index],
                            prompt: [
                              { content: typeof _prompt === 'string' ? _prompt : "", role: "user" },
                              { content: "", role: "user" },
                            ],
                          };
                          setPrompts(updatedPrompts);
                          _setPrompts(updatedPrompts);
                        }}
                      >
                        + Convert to prompt list
                      </button>
                    </>
                  )}
                </div>
                </div>
                <div className="mt-4 p-3 rounded-lg border border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-800/30">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1 text-xs text-gray-600 dark:text-gray-400">
                      <p className="font-medium mb-1 text-gray-700 dark:text-gray-300">Special Commands</p>
                      <p className="mb-1.5">Use <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-[11px] font-mono">${'{'}includeSelection{'}'}</code> to insert selected text anywhere in your prompt.</p>
                      <p>Chain prompts with <code className="px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-[11px] font-mono">${'{'}macroName{'}'}</code> to run other prompts and use their results.</p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>Config Source</label>
                  <select
                    className='w-full pl-3 pr-8 py-2 border border-gray-200 dark:border-gray-800/30 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all'
                    value={defaultConfigType}
                    onChange={(e) => handleDefaultConfigTypeChange(e.target.value as 'agent' | 'legacy_chat' | 'legacy_completions' | 'custom')}
                  >
                    <option value="agent">Agent Defaults</option>
                    <option value="legacy_chat">Legacy Chat Completions Defaults</option>
                    <option value="legacy_completions">Legacy Completions Defaults</option>
                    <option value="custom">Custom</option>
                  </select>
                  </div>
        </div>
        {defaultConfigType === 'custom' && prompt.config != null ? ( 
        <PromptIndividualConfig 
          prompt={prompt} 
          index={index} 
          onApiEndpointChange={(newEndpoint) => {
            // Convert prompt format when API endpoint changes in custom config
            if (newEndpoint === 'completions' && Array.isArray(_prompt)) {
              const promptString = _prompt.map((m: any) => typeof m === 'string' ? m : m.content).join('\n');
              let tempPrompts = _prompts;
              _setPrompt(promptString);
              tempPrompts[index].prompt = promptString;
              setPrompts(tempPrompts);
              _setPrompts(tempPrompts);
            } else if ((newEndpoint === 'chat_completions' || newEndpoint === 'responses') && typeof _prompt === 'string' && _prompt.trim() !== '') {
              let tempPrompts = _prompts;
              const messagesArray = [{ role: 'user', content: _prompt }];
              _setPrompt(messagesArray);
              tempPrompts[index].prompt = messagesArray;
              setPrompts(tempPrompts);
              _setPrompts(tempPrompts);
            }
          }}
        />
        ) : (
          <div className="mt-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Using <strong>{defaultConfigType === 'agent' ? 'Agent' : defaultConfigType === 'legacy_chat' ? 'Legacy Chat Completions' : 'Legacy Completions'}</strong> defaults. 
              Select "Custom" to configure individual parameters.
            </p>
          </div>
        )}

        {/* Agent Tools Selection - Only show for responses API */}
        {currentApiEndpoint === 'responses' && (
          <PromptToolSelection
            prompt={prompt}
            index={index}
            _prompts={_prompts}
            _setPrompts={_setPrompts}
          />
        )}

      </div>
     </PopupModal>
  );
};

export const PromptIndividualConfig = ({prompt, index, onApiEndpointChange}:{prompt: any; index: number; onApiEndpointChange?: (newEndpoint: ApiEndpointOptions) => void}) => {
    const [_provider, _setProvider] = useState<ProviderOptions>(prompt.config.provider || "openai");
    const [_apiEndpoint, _setApiEndpoint] = useState<ApiEndpointOptions>(prompt.config.apiEndpoint || "responses");
    const [_model, _setModel] = useState<string>(prompt.config.model);
    const [_maxToken, _setMaxToken] = useState<number>(prompt.config.max_completion_tokens);
    const [_temperature, _setTemperature] = useState<number>(prompt.config.temperature);
    const [_presencePenalty, _setPresencePenalty] = useState<number>(
      prompt.config.presence_penalty
     );
     const [_topP, _setTopP] = useState<number>(prompt.config.top_p);
     const [_frequencyPenalty, _setFrequencyPenalty] = useState<number>(
       prompt.config.frequency_penalty
     );
     const [_reasoningEffort, _setReasoningEffort] = useState<ReasoningEffort>(
       (prompt.config.reasoning_effort as ReasoningEffort) || 'medium'
     );
     const [_verbosity, _setVerbosity] = useState<Verbosity>(
       (prompt.config.verbosity as Verbosity) || 'medium'
     );
     const prompts = useStore((state) => state.prompts);
     const setPrompts = useStore((state) => state.setPrompts);

     // Track previous API endpoint to detect changes
     const prevApiEndpointRef = useRef<ApiEndpointOptions>(_apiEndpoint);
     const isInitialMount = useRef<boolean>(true);
     
     // When API endpoint changes, update model and parameters to safe defaults for that endpoint
     useEffect(() => {
       // Skip on initial mount - only update when endpoint actually changes
       if (isInitialMount.current) {
         isInitialMount.current = false;
         return;
       }
       
       const defaults = getDefaultValuesForEndpoint(_apiEndpoint);
       
       // Notify parent component about API endpoint change for prompt format conversion (only if it actually changed)
       if (onApiEndpointChange && prevApiEndpointRef.current !== _apiEndpoint) {
         onApiEndpointChange(_apiEndpoint);
         prevApiEndpointRef.current = _apiEndpoint;
       }
       
       // Only set safe default model when endpoint changes - preserve other custom values
       if (_apiEndpoint === 'completions') {
         _setModel('davinci-002');
         // Only set max_tokens if it's not already set or if switching from a different endpoint type
         if (prevApiEndpointRef.current !== 'completions' && defaults.max_tokens !== undefined) {
           _setMaxToken(defaults.max_tokens as number);
         }
       } else if (_apiEndpoint === 'chat_completions') {
         _setModel('gpt-3.5-turbo');
         // Only set defaults if switching from a different endpoint type
         if (prevApiEndpointRef.current !== 'chat_completions') {
           if (defaults.max_completion_tokens !== undefined) _setMaxToken(defaults.max_completion_tokens as number);
         }
       } else if (_apiEndpoint === 'responses') {
         _setModel('gpt-4o');
         // Only set defaults if switching from a different endpoint type
         if (prevApiEndpointRef.current !== 'responses') {
           if (defaults.max_completion_tokens !== undefined) _setMaxToken(defaults.max_completion_tokens as number);
         }
       }
       
       prevApiEndpointRef.current = _apiEndpoint;
     }, [_apiEndpoint]);

     // Watch for changes in prompt config
         useEffect(() => {
       const config: any = {
                    model: _model,
                    max_completion_tokens: _maxToken,
         apiEndpoint: _apiEndpoint,
         provider: _provider,
       };

       // Only include parameters valid for the selected endpoint
       if (_apiEndpoint === 'completions') {
         // For completions, we still store in ConfigInterface format but use max_tokens in API calls
         config.max_completion_tokens = _maxToken;
         config.temperature = _temperature;
         config.top_p = _topP;
         config.presence_penalty = _presencePenalty;
         config.frequency_penalty = _frequencyPenalty;
       } else if (_apiEndpoint === 'chat_completions') {
         config.temperature = _temperature;
         config.top_p = _topP;
         config.presence_penalty = _presencePenalty;
         config.frequency_penalty = _frequencyPenalty;
       } else if (_apiEndpoint === 'responses') {
         config.reasoning_effort = _reasoningEffort;
         config.verbosity = _verbosity;
       }

       prompts[index].config = config;
                    setPrompts(prompts);
     }, [_model, _maxToken, _temperature, _presencePenalty, _topP, _frequencyPenalty, _provider, _apiEndpoint, _reasoningEffort, _verbosity]);

    return (
        <div className="mt-6 p-4 rounded-lg border border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-800/30 space-y-6">
        <div>
          <ProviderSelector _provider={_provider} _setProvider={_setProvider} />
        </div>
        <div>
          <ApiEndpointSelector _apiEndpoint={_apiEndpoint} _setApiEndpoint={_setApiEndpoint} />
        </div>
        <div>
          <ModelSelector _model={_model} _setModel={_setModel} _provider={_provider} _apiEndpoint={_apiEndpoint} />
        </div>
        <div>
        <MaxTokenSlider
          _maxToken={_maxToken}
          _setMaxToken={_setMaxToken}
          _model={_model}
          _label={_apiEndpoint === 'completions' ? 'Max Tokens' : undefined}
        /> 
        </div>
        
        {/* Completions and Chat Completions API Settings */}
        {(_apiEndpoint === 'completions' || _apiEndpoint === 'chat_completions') && (
          <div className="space-y-4">
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
        )}
        
        {/* Responses API Settings */}
        {_apiEndpoint === 'responses' && (
          <div className="space-y-4">
            <ReasoningEffortSelector
              _reasoningEffort={_reasoningEffort}
              _setReasoningEffort={_setReasoningEffort}
            />
            <VerbositySelector
              _verbosity={_verbosity}
              _setVerbosity={_setVerbosity}
            />
          </div>
        )}
        </div>
    )
}

/**
 * Prompt-specific tool selection component
 * Allows configuring which tools are available for this specific prompt action
 */
const PromptToolSelection = ({
  prompt,
  index,
  _prompts,
  _setPrompts
}: {
  prompt: any;
  index: number;
  _prompts: any;
  _setPrompts: any;
}) => {
  const prompts = useStore((state) => state.prompts);
  const setPrompts = useStore((state) => state.setPrompts);
  const globalEnabledTools = useStore((state) => state.enabledTools);
  const globalToolConfirmationSettings = useStore((state) => state.toolConfirmationSettings);

  // Initialize with prompt-specific tools or fall back to global defaults
  const [useCustomTools, setUseCustomTools] = useState<boolean>(
    prompt.enabledTools !== undefined && prompt.enabledTools !== null
  );
  const [_enabledTools, _setEnabledTools] = useState<string[]>(
    prompt.enabledTools || globalEnabledTools || []
  );
  const [_toolConfirmationSettings, _setToolConfirmationSettings] = useState<Record<string, boolean>>(
    prompt.toolConfirmationSettings || globalToolConfirmationSettings || {}
  );

  // Update prompt when tools change
  useEffect(() => {
    // Get fresh prompts to avoid stale closure
    const currentPrompts = useStore.getState().prompts;
    let tempPrompts = [...currentPrompts];
    
    // Check if we actually need to update (avoid unnecessary updates)
    const currentEnabledTools = tempPrompts[index]?.enabledTools;
    const currentToolConfirmationSettings = tempPrompts[index]?.toolConfirmationSettings;
    
    if (useCustomTools) {
      // Only update if values actually changed
      const enabledToolsChanged = JSON.stringify(currentEnabledTools) !== JSON.stringify(_enabledTools);
      const confirmationChanged = JSON.stringify(currentToolConfirmationSettings) !== JSON.stringify(_toolConfirmationSettings);
      
      if (enabledToolsChanged || confirmationChanged) {
        tempPrompts[index].enabledTools = _enabledTools;
        tempPrompts[index].toolConfirmationSettings = _toolConfirmationSettings;
        setPrompts(tempPrompts);
        _setPrompts(tempPrompts);
      }
    } else {
      // Only update if custom tools exist (need to clear them)
      if (currentEnabledTools !== undefined || currentToolConfirmationSettings !== undefined) {
        delete tempPrompts[index].enabledTools;
        delete tempPrompts[index].toolConfirmationSettings;
        setPrompts(tempPrompts);
        _setPrompts(tempPrompts);
      }
    }
  }, [useCustomTools, _enabledTools, _toolConfirmationSettings, index, setPrompts, _setPrompts]);

  const toggleTool = (toolName: string) => {
    if (_enabledTools.includes(toolName)) {
      _setEnabledTools(_enabledTools.filter((t) => t !== toolName));
    } else {
      _setEnabledTools([..._enabledTools, toolName]);
    }
  };

  const toggleToolConfirmation = (toolName: string) => {
    _setToolConfirmationSettings({
      ..._toolConfirmationSettings,
      [toolName]: !_toolConfirmationSettings[toolName],
    });
  };

  const selectAllTools = () => {
    const canonicalToolNames = Array.from(CANONICAL_TOOLS).filter(
      toolName => toolName in toolRegistry && !LEGACY_TOOLS.has(toolName)
    );
    _setEnabledTools(canonicalToolNames);
  };

  const deselectAllTools = () => {
    _setEnabledTools([]);
  };

  const useGlobalTools = () => {
    setUseCustomTools(false);
    _setEnabledTools(globalEnabledTools || []);
    _setToolConfirmationSettings(globalToolConfirmationSettings || {});
  };

  const useCustomToolConfig = () => {
    setUseCustomTools(true);
    // Initialize with current global if prompt doesn't have custom tools
    if (!prompt.enabledTools) {
      _setEnabledTools(globalEnabledTools || []);
      _setToolConfirmationSettings(globalToolConfirmationSettings || {});
    }
  };

  // Filter out legacy tools and deprecated tools from UI
  const deprecatedTools = new Set(['search_text', 'search_semantic', 'doc_metadata_get', 'context_packet_get']);
  const availableTools = Object.keys(toolRegistry).filter((toolName) => {
    const isLegacy = LEGACY_TOOLS.has(toolName);
    const isCanonical = CANONICAL_TOOLS.has(toolName);
    const isDeprecated = deprecatedTools.has(toolName);
    return !isLegacy && isCanonical && !isDeprecated;
  });

  // Categorize tools
  const selectionMetaTools = ['selection_read', 'meta_read', 'meta_write'];
  const searchContextTools = ['search', 'doc_structure_get', 'doc_read'];
  const projectTools = ['project_get_tree'];
  const patchTools = ['edit_preview', 'edit_apply'];
  const documentTools = ['doc_create', 'doc_update', 'doc_duplicate', 'doc_delete', 'folder_create', 'folder_update', 'folder_delete'];
  const snippetTools = ['snippet_list', 'snippet_read', 'snippet_create', 'snippet_update'];
  const revisionTools = ['revision_list', 'revision_get', 'revision_diff'];

  const categorizeTool = (toolName: string): string => {
    if (selectionMetaTools.includes(toolName)) return 'selection-meta';
    if (searchContextTools.includes(toolName)) return 'search-context';
    if (projectTools.includes(toolName)) return 'project';
    if (patchTools.includes(toolName)) return 'patch';
    if (documentTools.includes(toolName)) return 'document';
    if (snippetTools.includes(toolName)) return 'snippet';
    if (revisionTools.includes(toolName)) return 'revision';
    return 'other';
  };

  const categorized = availableTools.reduce((acc, toolName) => {
    if (LEGACY_TOOLS.has(toolName) || !CANONICAL_TOOLS.has(toolName)) {
      return acc;
    }
    const category = categorizeTool(toolName);
    if (!acc[category]) acc[category] = [];
    acc[category].push(toolName);
    return acc;
  }, {} as Record<string, string[]>);

  const categoryLabels: Record<string, string> = {
    'selection-meta': 'Selection & Metadata Tools',
    'search-context': 'Search & Context Tools',
    'project': 'Project Navigation',
    'patch': 'Edit Operations',
    'document': 'Document Management',
    'snippet': 'Snippet Tools',
    'revision': 'Revision History',
    'other': 'Other Tools',
  };

  return (
    <div className="mt-6 p-4 rounded-lg border border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-800/30">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Agent Tools (Exclusive to this macro)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={useGlobalTools}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                !useCustomTools
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'
              }`}
            >
              Use Global
            </button>
            <button
              type="button"
              onClick={useCustomToolConfig}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                useCustomTools
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'
              }`}
            >
              Custom
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {useCustomTools
            ? 'Configure which tools are available exclusively for this macro. This overrides the global agent tool settings.'
            : 'Using global agent tool settings. Enable "Custom" to configure tools specific to this macro.'}
        </p>
      </div>

      {useCustomTools && (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Available Tools
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllTools}
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAllTools}
                className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded text-gray-700 dark:text-gray-200"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-800/30 rounded-md p-3">
            {Object.entries(categorized)
              .filter(([category, tools]) => tools.length > 0)
              .map(([category, tools]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {categoryLabels[category] || category}
                  </h4>
                  {tools.map((toolName) => {
                    if (LEGACY_TOOLS.has(toolName) || !CANONICAL_TOOLS.has(toolName)) {
                      return null;
                    }
                    const registryEntry = toolRegistry[toolName];
                    const toolDef = registryEntry?.definition;
                    const isEnabled = _enabledTools.includes(toolName);
                    const requiresConfirmation = _toolConfirmationSettings[toolName] ?? false;

                    return (
                      <div
                        key={toolName}
                        className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded ml-2"
                      >
                        <input
                          type="checkbox"
                          id={`prompt-tool-${index}-${toolName}`}
                          checked={isEnabled}
                          onChange={() => toggleTool(toolName)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`prompt-tool-${index}-${toolName}`}
                              className="block text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                            >
                              {toolName}
                            </label>
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={`prompt-confirm-${index}-${toolName}`}
                                className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                              >
                                Require confirmation
                              </label>
                              <input
                                type="checkbox"
                                id={`prompt-confirm-${index}-${toolName}`}
                                checked={requiresConfirmation}
                                onChange={() => toggleToolConfirmation(toolName)}
                                className="h-3.5 w-3.5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                            </div>
                          </div>
                          {toolDef?.function?.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {toolDef.function.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
};

// export const ModelSelector = ({
//     _model,
//     _setModel,
//   }: {
//     _model: ModelOptions;
//     _setModel: React.Dispatch<React.SetStateAction<ModelOptions>>;
//   }) => {
//     const [dropDown, setDropDown] = useState<boolean>(false);
//     const fineTuneModels = useStore((state) => state.fineTuneModels);
  
//     const [defaultAndFindTuneModels, setDefaultAndFineTuneModels] = useState<FineTuneModel[]>([]);
 
//     // Set defaultAndFineTuneModels to include both the model options and the fine tune options (the fine tune options are stored in the store)
  
//     useEffect(() => {
//       let tempModels = [];
//       // Iterate over models in modelOptions and turn each string into an object with it's value as both the name and model
//       for (let i = 0; i < completionModels.length; i++) {
//         tempModels.push({ name: completionModels[i], model: completionModels[i] });
//       }
  
//       if (fineTuneModels) {
//         // Add the fine tune models to the tempModels array
//         tempModels = [...tempModels, ...fineTuneModels];
//       }
//       setDefaultAndFineTuneModels(tempModels);
//     }
//     , [fineTuneModels]);
  
//     const getModelName = (modelValue: any) => {
//       const modelObj = defaultAndFindTuneModels.find(m => m.model === modelValue);
//       return modelObj ? modelObj.name : modelValue;
//     };
  
//     return (
//       <div className='mb-4'>
//         <button
//           className='btn btn-neutral btn-small flex gap-1'
//           type='button'
//           onClick={() => setDropDown((prev) => !prev)}
//         >
//           {getModelName(_model)}
//           <DownChevronArrow />
//         </button>
//         <div
//           id='dropdown'
//           className={`${
//             dropDown ? '' : 'hidden'
//           } absolute top-100 bottom-100 z-10 bg-white rounded-lg shadow-xl border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group dark:bg-gray-800 opacity-90`}
//         >
//           <ul
//             className='text-sm text-gray-700 dark:text-gray-200 p-0 m-0'
//             aria-labelledby='dropdownDefaultButton'
//           > 
//             {defaultAndFindTuneModels.map((model, index) => (
//               <li
//                 className='px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white cursor-pointer'
//                 onClick={() => {
//                   _setModel(model.model);
//                   setDropDown(false);
//                 }}
//                 key={index}
//               >
//                 {model.name}
//               </li>
//             ))}
//           </ul>
//         </div>
//       </div>
//     );
//   };

//   export const MaxTokenSlider = ({
//     _maxToken,
//     _setMaxToken,
//     _model,
//   }: {
//     _maxToken: number;
//     _setMaxToken: React.Dispatch<React.SetStateAction<number>>;
//     _model: ModelOptions;
//   }) => {
//     const { t } = useTranslation('model');
//     const inputRef = useRef<HTMLInputElement>(null);
  
//     useEffect(() => {
//       inputRef &&
//         inputRef.current &&
//         _setMaxToken(Number(inputRef.current.value));
//     }, [_model]);
  
//     return (
//       <div>
//         <label className='block text-sm font-medium text-gray-900 dark:text-white'>
//           {t('token.label')}: {_maxToken}
//         </label>
//         <input
//           type='range'
//           ref={inputRef}
//           value={_maxToken}
//           onChange={(e) => {
//             _setMaxToken(Number(e.target.value));
//           }}
//           min={0}
//           max={_model.includes(":") ? modelMaxToken[_model.split(':')[1]] : modelMaxToken[_model]}
//           step={1}
//           className='w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer'
//         />
//         {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//           {t('token.description')}
//         </div> */}
//       </div>
//     );
//   };

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
//       {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('temperature.description')}
//       </div> */}
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
//       {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('topP.description')}
//       </div> */}
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
//       {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('presencePenalty.description')}
//       </div> */}
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
//       {/* <div className='min-w-fit text-gray-500 dark:text-gray-300 text-sm mt-2'>
//         {t('frequencyPenalty.description')}
//       </div> */}
//     </div>
//   );
// };

export default PromptConfig;