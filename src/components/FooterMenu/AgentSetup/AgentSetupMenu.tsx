import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { ApiEndpointOptions, ConfigInterface, ModelOptions, ProviderOptions, AvailableEndpoints, ModelMetadata } from '@type/document';
import PopupModal from '@components/PopupModal';
import { toolRegistry, getToolDefinitions, LEGACY_TOOLS, CANONICAL_TOOLS } from '@api/tools';
import { getModelsList } from '@api/api';
import {
  ModelSelector,
  MaxTokenSlider,
  TemperatureSlider,
  TopPSlider,
  FrequencyPenaltySlider,
  PresencePenaltySlider,
  ProviderSelector,
} from '@components/Configuration/sliders';
import { ReasoningEffortSelector, ReasoningEffort } from '@components/Configuration/reasoningEffort';
import { VerbositySelector, Verbosity } from '@components/Configuration/verbosity';
import { debug } from '@utils/debug';

const dbg = debug.tag('AgentSetupMenu');

const AgentSetupMenu = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { t } = useTranslation(['main', 'api']);

  const enabledTools = useStore((state) => state.enabledTools);
  const setEnabledTools = useStore((state) => state.setEnabledTools);
  const agentApiEndpoint = useStore((state) => state.agentApiEndpoint);
  const setAgentApiEndpoint = useStore((state) => state.setAgentApiEndpoint);
  const defaultChatConfig = useStore((state) => state.defaultChatConfig);
  const setDefaultChatConfig = useStore((state) => state.setDefaultChatConfig);
  const toolConfirmationSettings = useStore((state) => state.toolConfirmationSettings);
  const setToolConfirmation = useStore((state) => state.setToolConfirmation);
  const setToolConfirmationSettings = useStore((state) => state.setToolConfirmationSettings);
  const fetchedModels = useStore((state) => state.fetchedModels);
  const setFetchedModels = useStore((state) => state.setFetchedModels);

  const [_enabledTools, _setEnabledTools] = useState<string[]>(enabledTools || []);
  const [_toolConfirmationSettings, _setToolConfirmationSettings] = useState<Record<string, boolean>>(toolConfirmationSettings || {});
  // Lock API endpoint to 'responses' for agents
  const [_agentApiEndpoint] = useState<string>('responses');
  
  // Configuration state
  const [_provider, _setProvider] = useState<ProviderOptions>(
    defaultChatConfig?.provider || 'openai'
  );
  const [_model, _setModel] = useState<ModelOptions>(
    defaultChatConfig?.model || 'gpt-3.5-turbo'
  );
  const [_maxToken, _setMaxToken] = useState<number>(
    defaultChatConfig?.max_completion_tokens || 1200
  );
  const [_temperature, _setTemperature] = useState<number>(
    defaultChatConfig?.temperature ?? 1
  );
  const [_topP, _setTopP] = useState<number>(
    defaultChatConfig?.top_p ?? 1
  );
  const [_presencePenalty, _setPresencePenalty] = useState<number>(
    defaultChatConfig?.presence_penalty ?? 0
  );
  const [_frequencyPenalty, _setFrequencyPenalty] = useState<number>(
    defaultChatConfig?.frequency_penalty ?? 0
  );
  const [_reasoningEffort, _setReasoningEffort] = useState<ReasoningEffort>(
    (defaultChatConfig?.reasoning_effort as ReasoningEffort) || 'medium'
  );
  const [_verbosity, _setVerbosity] = useState<Verbosity>(
    (defaultChatConfig?.verbosity as Verbosity) || 'medium'
  );

  // State for update models functionality
  const [isUpdatingModels, setIsUpdatingModels] = useState<boolean>(false);
  const [updateModelsMessage, setUpdateModelsMessage] = useState<string>('');
  const apiKey = useStore((state) => state.apiKey);
  const apiEndpoint = useStore((state) => state.apiEndpoint);

  // Initialize with all tools enabled if empty
  useEffect(() => {
    if (!enabledTools || enabledTools.length === 0) {
      const allToolNames = Object.keys(toolRegistry);
      _setEnabledTools(allToolNames);
    }
  }, []);

  const handleSave = () => {
    // Filter out any legacy tools that might have been selected
    const canonicalOnlyTools = _enabledTools.filter(
      toolName => !LEGACY_TOOLS.has(toolName) && CANONICAL_TOOLS.has(toolName)
    );
    setEnabledTools(canonicalOnlyTools);
    setAgentApiEndpoint('responses'); // Always set to 'responses' for agents
    
    // Save tool confirmation settings
    setToolConfirmationSettings(_toolConfirmationSettings);
    
    // Update default chat config with agent settings
    if (defaultChatConfig) {
      const updatedConfig: ConfigInterface = {
        ...defaultChatConfig,
        provider: _provider,
        model: _model,
        apiEndpoint: 'responses' as ApiEndpointOptions, // Locked to 'responses'
        max_completion_tokens: _maxToken,
        // Include Responses API specific parameters
        reasoning_effort: _reasoningEffort,
        verbosity: _verbosity,
      };
      setDefaultChatConfig(updatedConfig);
    }
    
    setIsModalOpen(false);
  };

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
    // Only select canonical tools (filter out legacy)
    const canonicalToolNames = Array.from(CANONICAL_TOOLS).filter(
      toolName => toolName in toolRegistry
    );
    _setEnabledTools(canonicalToolNames);
  };

  const deselectAllTools = () => {
    _setEnabledTools([]);
  };

  const handleUpdateModels = async () => {
    setIsUpdatingModels(true);
    setUpdateModelsMessage('');
    
    try {
      const response = await getModelsList(apiEndpoint, apiKey);
      dbg.log('Models fetched:', response);
      
      // The response should have a 'data' array with model objects
      if (response && response.data && Array.isArray(response.data)) {
        // Extract full model metadata from API response
        const modelMetadataList: ModelMetadata[] = response.data
          .filter((model: any) => model.id) // Only include models with IDs
          .map((model: any) => {
            // Extract all relevant fields from the API response
            const metadata: ModelMetadata = {
              id: model.id,
              context_window: model.context_window,
              max_output_tokens: model.max_output_tokens,
              max_completion_tokens: model.max_completion_tokens || model.max_output_tokens,
              created: model.created,
              owned_by: model.owned_by,
              // Store any additional fields that might be useful
              object: model.object,
              root: model.root,
              parent: model.parent,
              // Store the entire permission array if present
              permission: model.permission,
            };
            
            // Include any other fields from the API response
            Object.keys(model).forEach(key => {
              if (!metadata.hasOwnProperty(key)) {
                metadata[key] = model[key];
              }
            });
            
            return metadata;
          });
        
        // Organize models by endpoint type with full metadata
        // Filter models that are likely for responses API (gpt-4, gpt-3.5-turbo, o1, o3, etc.)
        const responsesModels = modelMetadataList.filter((model: ModelMetadata) => 
          model.id.startsWith('gpt-') || model.id.startsWith('o1') || model.id.startsWith('o3')
        );
        
        // Filter models for chat_completions (similar but might include more)
        const chatCompletionsModels = modelMetadataList.filter((model: ModelMetadata) => 
          model.id.startsWith('gpt-') || model.id.startsWith('o1') || model.id.startsWith('o3')
        );
        
        // Filter legacy completion models
        const legacyModels = modelMetadataList.filter((model: ModelMetadata) => 
          model.id.includes('davinci') || model.id.includes('curie') || 
          model.id.includes('babbage') || model.id.includes('ada')
        );
        
        // Update fetched models in store with full metadata
        const updatedFetchedModels: AvailableEndpoints[] = [];
        
        // Add responses models if we found any
        if (responsesModels.length > 0) {
          updatedFetchedModels.push({
            provider: 'openai',
            apiEndpoint: 'responses',
            models: responsesModels
          });
        }
        
        // Add chat_completions models if we found any
        if (chatCompletionsModels.length > 0) {
          updatedFetchedModels.push({
            provider: 'openai',
            apiEndpoint: 'chat_completions',
            models: chatCompletionsModels
          });
        }
        
        // Add completions models if we found any
        if (legacyModels.length > 0) {
          updatedFetchedModels.push({
            provider: 'openai',
            apiEndpoint: 'completions',
            models: legacyModels
          });
        }
        
        setFetchedModels(updatedFetchedModels);
        
        const totalModels = modelMetadataList.length;
        const responsesCount = responsesModels.length;
        const modelsWithContextWindow = modelMetadataList.filter(m => m.context_window).length;
        const modelsWithMaxTokens = modelMetadataList.filter(m => m.max_output_tokens || m.max_completion_tokens).length;
        
        setUpdateModelsMessage(
          `Successfully fetched ${totalModels} models (${responsesCount} for responses API). ` +
          `${modelsWithContextWindow} with context window, ${modelsWithMaxTokens} with max tokens.`
        );
      } else {
        setUpdateModelsMessage('Models fetched successfully, but response format was unexpected.');
      }
    } catch (error: any) {
      dbg.error('Error fetching models:', error);
      setUpdateModelsMessage(`Error: ${error.message || 'Failed to fetch models'}`);
    } finally {
      setIsUpdatingModels(false);
    }
  };

  // Filter out legacy tools from UI - only show canonical tools
  // Double-check: exclude any tool that's in LEGACY_TOOLS or not in CANONICAL_TOOLS
  // Also exclude deprecated search tools (search_text, search_semantic) - replaced by unified 'search' tool
  // Exclude doc_metadata_get and context_packet_get from UI
  const deprecatedTools = new Set(['search_text', 'search_semantic', 'doc_metadata_get', 'context_packet_get']);
  const availableTools = Object.keys(toolRegistry).filter((toolName) => {
    const isLegacy = LEGACY_TOOLS.has(toolName);
    const isCanonical = CANONICAL_TOOLS.has(toolName);
    const isDeprecated = deprecatedTools.has(toolName);
    // Only include if it's canonical AND not legacy AND not deprecated
    return !isLegacy && isCanonical && !isDeprecated;
  });
  const toolDefinitions = getToolDefinitions().filter(td => td && td.function); // Filter out any undefined or invalid definitions

  return (
    <PopupModal
      title="Agent Setup"
      setIsModalOpen={setIsModalOpen}
      cancelButton={true}
      handleConfirm={handleSave}
    >
      <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
        {/* Provider - Read-only (locked) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Provider:
          </label>
          <div className="px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {_provider}
          </div>
        </div>

        {/* API Endpoint - Read-only (locked to responses for agents) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Endpoint for Agents
          </label>
          <div className="px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            Responses
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            The Responses API is required for agents and function calling support.
          </p>
        </div>

        {/* Model Selection - Moved to top, below API Endpoint */}
        <div className="mb-6 relative">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Model
            </label>
            <button
              type="button"
              onClick={handleUpdateModels}
              disabled={isUpdatingModels}
              className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded transition-colors duration-200"
            >
              {isUpdatingModels ? 'Updating...' : 'Update Models'}
            </button>
          </div>
          {updateModelsMessage && (
            <div className={`mt-2 text-xs p-2 rounded ${
              updateModelsMessage.startsWith('Error') 
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' 
                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            }`}>
              {updateModelsMessage}
            </div>
          )}
          <ModelSelector
            _model={_model}
            _setModel={_setModel}
            _provider={_provider}
            _apiEndpoint={'responses' as ApiEndpointOptions}
          />
        </div>

        {/* Responses API Specific Settings */}
        <div className="mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Responses API Settings
          </h3>
          
          <MaxTokenSlider
            _maxToken={_maxToken}
            _setMaxToken={_setMaxToken}
            _model={_model}
            _provider={_provider}
            _apiEndpoint={'responses' as ApiEndpointOptions}
          />
          
          <ReasoningEffortSelector
            _reasoningEffort={_reasoningEffort}
            _setReasoningEffort={_setReasoningEffort}
          />
          
          <VerbositySelector
            _verbosity={_verbosity}
            _setVerbosity={_setVerbosity}
          />
        </div>

        {/* Tool Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Available Tools
            </label>
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
            {/* Group tools by category */}
            {(() => {
              // Categorize canonical tools only
              const selectionMetaTools = ['selection_read', 'meta_read', 'meta_write', 'doc_metadata_get'];
              const searchContextTools = ['search', 'context_packet_get', 'doc_structure_get', 'doc_read'];
              const projectTools = ['project_get_tree'];
              const patchTools = ['edit_preview', 'edit_apply'];
              const documentTools = ['doc_create', 'doc_rename', 'doc_move'];
              const snippetTools = ['clip_list', 'clip_read', 'clip_create', 'clip_update'];
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
                // Double-check: never categorize legacy tools
                if (LEGACY_TOOLS.has(toolName) || !CANONICAL_TOOLS.has(toolName)) {
                  dbg.warn(`Skipping non-canonical tool: ${toolName}`);
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
                'patch': 'Patch Operations',
                'document': 'Document Management',
                'snippet': 'Snippet Tools',
                'revision': 'Revision History',
                'other': 'Other Tools',
              };
              
              return Object.entries(categorized)
                .filter(([category, tools]) => tools.length > 0) // Don't show empty categories
                .map(([category, tools]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    {categoryLabels[category] || category}
                  </h4>
                  {tools.map((toolName) => {
                    // Final safeguard: skip legacy tools
                    if (LEGACY_TOOLS.has(toolName) || !CANONICAL_TOOLS.has(toolName)) {
                      return null;
                    }
                    // Get tool definition from registry directly to avoid undefined issues
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
                          id={`tool-${toolName}`}
                          checked={isEnabled}
                          onChange={() => toggleTool(toolName)}
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`tool-${toolName}`}
                              className="block text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                            >
                              {toolName}
                            </label>
                            <div className="flex items-center gap-2">
                              <label
                                htmlFor={`confirm-${toolName}`}
                                className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                              >
                                Require confirmation
                              </label>
                              <input
                                type="checkbox"
                                id={`confirm-${toolName}`}
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
              ));
            })()}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Select which tools the AI can use during conversations. Tools allow the AI to interact with your documents.
          </p>
        </div>
      </div>
    </PopupModal>
  );
};

export default AgentSetupMenu;

