import React, { useState, useMemo } from 'react';
import useSubmit from '@hooks/useSubmitPromptAdjust';
import { Play, Settings, Document as DocumentIcon } from '@carbon/icons-react';
import useStore from '@store/store';
import { useOpenAssistant } from '@components/Workspace/WorkspaceContext';
import useClearChatPrompt from '@hooks/useClearChatPrompt';
import { PromptButtonConfig } from '@components/Menu/AIMenu/PromptLibrary/PromptButton/Config';
import { extractMacroReferences, extractMacroReferencesWithPositions, executeMacroQueue, executeMacro, replaceMacroReferences, replaceSpecialCommands, MacroQueueItem } from '@utils/actionRunner';
import { MessageInterface, DocumentCurrent } from '@type/document';
import { submitConversation } from '@utils/conversation-runner';

const PromptButton = ({prompt, index, activeMenu, setActiveMenu}: {
  prompt: any;
  index: number;
  activeMenu: string;
  setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
}) => {
  
  const openAssistant = useOpenAssistant();

  const chats = useStore((state) => state.chats);
  const setChats = useStore((state) => state.setChats);
  const useClearChat = useClearChatPrompt();
  const { handleFunction } = useSubmit();
  const editorSettings = useStore((state) => state.editorSettings);
  const setEditorSettings = useStore((state) => state.setEditorSettings);
  const generating = useStore.getState().generating;
  const setGenerating = useStore.getState().setGenerating;
  const [_promptName, _setPromptName] = useState(prompt.name);
  const documentCurrent = useStore((state) => state.documentCurrent);
  const setDocumentCurrent = useStore((state) => state.setDocumentCurrent);

  // Check if this macro chains other macros
  const hasChainedMacros = useMemo(() => {
    let promptContent = '';
    if (Array.isArray(prompt.prompt)) {
      promptContent = prompt.prompt
        .map((msg: any) => {
          if (typeof msg === 'string') {
            return msg;
          } else if (msg && typeof msg === 'object' && 'content' in msg) {
            return msg.content || '';
          }
          return '';
        })
        .join('\n');
    } else {
      promptContent = typeof prompt.prompt === 'string' ? prompt.prompt : '';
    }
    const macroRefs = extractMacroReferences(promptContent);
    return macroRefs.length > 0;
  }, [prompt.prompt]);

  // use local _config state object
  const [_config, _setConfig] = useState<DocumentCurrent>(documentCurrent);

  // // Update global store only when _config changes (whole object)
  // useEffect(() => {
  //   setDocumentCurrent(_config);
  // }, [_config, setDocumentCurrent]);

  // update individual config fields helper
  // const updateConfigField = (key: string, value: any) => {
  //   _setConfig((prevConfig) => ({
  //     ...prevConfig,
  //     config: {
  //       ...prevConfig.config,
  //       [key]: value,
  //     },
  //   }));
  // };
















  const handleClickPlay = async (e: any) => {
    e.stopPropagation();
    if(useStore.getState().generating){
      setGenerating(false);
    }

    // Get store functions
    const addConversation = useStore.getState().addConversation;
    const setActiveConversationId = useStore.getState().setActiveConversationId;
    const addMessage = useStore.getState().addMessage;
    const currentSelection = useStore.getState().getCurrentSelection();
    
    console.log('[PromptButton] Current selection state:', {
      hasSelection: !!currentSelection,
      selectionLength: currentSelection?.length || 0,
      selectionPreview: currentSelection?.substring(0, 50) || '(empty)',
    });
    const defaultChatConfig = useStore.getState().defaultChatConfig;
    const defaultLegacyConfig = useStore.getState().defaultLegacyConfig;
    const prompts = useStore.getState().prompts;
    const apiKey = useStore.getState().apiKey;
    const setActionQueue = useStore.getState().setActionQueue;
    const clearActionQueue = useStore.getState().clearActionQueue;
    const setToastShow = useStore.getState().setToastShow;
    const setToastMessage = useStore.getState().setToastMessage;
    const setToastStatus = useStore.getState().setToastStatus;

    // Get prompt config
    const promptConfig = prompt.config || defaultChatConfig;
    const apiEndpointType = promptConfig.apiEndpoint || defaultChatConfig.apiEndpoint || 'chat_completions';
    
    // Determine conversation type
    const isCompletion = apiEndpointType === 'completions';
    const conversationType = isCompletion ? 'completion' : 'regular';

    // Build prompt content string for macro reference extraction
    let promptContentForExtraction = '';
    if (Array.isArray(prompt.prompt)) {
      promptContentForExtraction = prompt.prompt.map((msg: any) => {
        if (typeof msg === 'string') {
          return msg;
        } else if (msg && typeof msg === 'object' && 'content' in msg) {
          return msg.content || '';
        }
        return '';
      }).join('\n');
    } else {
      promptContentForExtraction = typeof prompt.prompt === 'string' ? prompt.prompt : '';
    }

    // Check if ${includeSelection} was used BEFORE replacement
    const hasIncludeSelectionCommand = promptContentForExtraction.includes('${includeSelection}');
    
    console.log('[PromptButton] Special command check:', {
      hasIncludeSelectionCommand,
      hasIncludeSelection: promptContentForExtraction.includes('${includeSelection}'),
      currentSelectionLength: currentSelection?.length || 0,
      promptContentLength: promptContentForExtraction.length,
    });

    // Extract ALL macro references with positions (including duplicates)
    // This allows us to execute each occurrence separately
    const allMacroOccurrences = extractMacroReferencesWithPositions(promptContentForExtraction);
    
    // Create conversation title based on prompt name
    const allConversations = useStore.getState().conversations;
    const promptName = prompt.name || (isCompletion ? 'Completion' : 'Chat');
    let title = promptName;
    let titleIndex = 1;
    
    // Check if a conversation with this name already exists, add number if needed
    while (allConversations.some((c) => c.title === title)) {
      titleIndex += 1;
      title = `${promptName} ${titleIndex}`;
    }

    // Create new conversation IMMEDIATELY
    const conversationId = addConversation({
      type: conversationType,
      title,
      messages: [],
      config: isCompletion 
        ? { ...defaultLegacyConfig, ...promptConfig, apiEndpoint: 'completions' }
        : { ...defaultChatConfig, ...promptConfig, apiEndpoint: apiEndpointType },
    });

    // Set as active conversation
    setActiveConversationId(conversationId);

    // Switch to chat menu IMMEDIATELY
    setActiveMenu('chat');
    openAssistant();

    // Get updateMessage function for updating messages as actions complete
    const updateMessage = useStore.getState().updateMessage;

    // Process and add prompt as message(s) WITH action references visible (not replaced yet)
    if (Array.isArray(prompt.prompt)) {
      // Handle array of message objects
      prompt.prompt.forEach((msg: any) => {
        let content = '';
        if (typeof msg === 'string') {
          content = msg;
        } else if (msg && typeof msg === 'object' && 'content' in msg) {
          content = msg.content || '';
        }
        
        // Replace special commands like ${includeSelection} with actual values
        // Note: Missing clips and meta are automatically added to macro queue by replaceSpecialCommands
        const specialCommandsResult = replaceSpecialCommands(content, currentSelection);
        content = specialCommandsResult.result;
        
        // Add message with macro references still visible (not replaced yet)
        addMessage(conversationId, {
          role: (typeof msg === 'object' && msg.role) ? msg.role : 'user', 
          content 
        });
      });
    } else {
      // Single string prompt
      let promptContent = typeof prompt.prompt === 'string' ? prompt.prompt : '';
      
      // Replace special commands like ${includeSelection} with actual values
      // Note: Missing clips and meta are automatically added to macro queue by replaceSpecialCommands
      const specialCommandsResult = replaceSpecialCommands(promptContent, currentSelection);
      promptContent = specialCommandsResult.result;
      
      // Add as user message with macro references still visible
      addMessage(conversationId, {
        role: 'user',
        content: promptContent,
      });
    }

    // Now execute each macro occurrence separately and update messages as they complete
    let macroResults = new Map<string, string>();
    
    if (allMacroOccurrences.length > 0) {
      // Create macro queue items for all occurrences
      const queue: MacroQueueItem[] = allMacroOccurrences.map((occ, idx) => ({
        macroName: occ.name,
        status: 'pending' as const,
      }));
      setActionQueue(queue);

      // Execute each occurrence separately
      // We'll process them sequentially and replace them one by one in the message
      for (let i = 0; i < allMacroOccurrences.length; i++) {
        const occurrence = allMacroOccurrences[i];
        const macroName = occurrence.name;
        
        // Find the macro
        let macro = prompts.find(p => p.name === macroName);
        if (!macro) {
          macro = prompts.find(p => p.name.toLowerCase() === macroName.toLowerCase());
        }
        
        if (!macro) {
          queue[i].status = 'error';
          queue[i].error = `Macro "${macroName}" not found`;
          setActionQueue([...queue]);
          continue;
        }

        try {
          // Update queue status
          queue[i].status = 'running';
          setActionQueue([...queue]);

          // Execute the macro
          const result = await executeMacro(
            macro,
            currentSelection,
            useStore.getState().apiEndpoint,
            apiKey,
            new Set(), // Fresh visited set for each occurrence
            prompts
          );

          // Store result (we'll use this for final replacement)
          macroResults.set(macroName, result);
          queue[i].status = 'completed';
          queue[i].result = result;
          setActionQueue([...queue]);

          // Update message content - replace the FIRST remaining occurrence of this macro reference
          // Since we execute in order, we replace them in order (first execution replaces first occurrence, etc.)
          const conversation = useStore.getState().getActiveConversation();
          if (conversation && conversation.id === conversationId) {
            const messages = conversation.messages;
            messages.forEach((msg, msgIdx) => {
              if (msg.role === 'user' && msg.content.includes(`\${${macroName}}`)) {
                // Replace only the FIRST occurrence of this macro reference
                // We need to find the first match and replace it manually
                const escapedMacroName = macroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\$\\{\\s*${escapedMacroName}\\s*\\}`);
                const match = msg.content.match(regex);
                if (match && match.index !== undefined) {
                  // Replace only this specific occurrence
                  const before = msg.content.substring(0, match.index);
                  const after = msg.content.substring(match.index + match[0].length);
                  const updatedContent = before + result + after;
                  updateMessage(conversationId, msgIdx, updatedContent);
                }
              }
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          queue[i].status = 'error';
          queue[i].error = errorMessage;
          setActionQueue([...queue]);
          console.error(`[PromptButton] Macro "${macroName}" failed:`, error);
        }
      }
    }

    // Macro references and selection commands have already been expanded.
    // Use the shared cancellable transport without expanding that text again.
    try { await submitConversation(conversationId, { prepared: true }); }
    finally { clearActionQueue(); }
  }
  const mouseDown = (e: any) => {
    e.preventDefault();
  }

  const handleClickButton = (e: any) => {
    e.stopPropagation();
    useClearChat(prompt.prompt);
    openAssistant();
    if(chats){
      let tempSettings = editorSettings;
      tempSettings.activeMenu = 'chat';
      setEditorSettings(tempSettings);
      setActiveMenu('chat');
    }
  }



    // const documentCurrent = useStore((state) => state.documentCurrent);
    // const setDocumentCurrent = useStore((state) => state.setDocumentCurrent);
  
    // // use local _config state object
    // const [_config, _setConfig] = useState<DocumentCurrent>(documentCurrent);
  
    // // Update global store only when _config changes (whole object)
    // useEffect(() => {
    //   setDocumentCurrent(_config);
    // }, [_config, setDocumentCurrent]);
  
    // // update individual config fields helper
    // const updateConfigField = (key: string, value: any) => {
    //   _setConfig((prevConfig) => ({
    //     ...prevConfig,
    //     config: {
    //       ...prevConfig.config,
    //       [key]: value,
    //     },
    //   }));
    // };


  return (
    <div
      className='assistant-macro'
    >
      {/* Macro Icon */}
      <DocumentIcon size={16} aria-hidden="true" />

      {/* Macro Name */}
      <button
        type="button"
        className='assistant-macro-name'
        onClick={handleClickButton}
      >
        <span>
          {prompt.name.length > 0 ? _promptName : 'Unnamed Macro'}
        </span>
        {hasChainedMacros && (
          <small>
            Complex macro
          </small>
        )}
      </button>

      {/* Macro Buttons */}
      <div className='assistant-macro-actions'>
        <div
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Settings"
        >
          <PromptButtonConfig prompt={prompt} _promptName={_promptName} _setPromptName={_setPromptName} index={index} />
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClickPlay(e);
          }}
          onMouseDown={mouseDown}
          title="Run macro"
        >
          <Play size={16} className="ml-0.5" />
        </button>
      </div>
    </div>
  );
}


export default PromptButton;
